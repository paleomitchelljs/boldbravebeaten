#!/usr/bin/env node
/*
 * The towns' streets, from assets/world/cities.yaml (its comments are the reference):
 *   data/cities.yaml    each town's map, legend and look, laid over its entry in data/places.yaml (Content merges
 *                       field by field), so the town keeps its name, locations and services, and its doors open them;
 *   data/citizens.yaml  the placeholder townsfolk (parley needs a person for each);
 *   assets/wip/cities/<town>-buildings.json
 *                       the building pictures the map asks for, for tools/buildings.py to draw.
 *   node tools/citygen.js [--only <town>] [--show]       (--show prints each map)
 * Deterministic: a town's `seed` picks the buildings, gaps, props and people.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
// Only the YAML reader: the content as authored, not as a previous run of this tool left it.
require(repo + '/src/data/yaml.js');
const G = globalThis.BBB;
const read = (f) => G.Yaml.parse(fs.readFileSync(path.join(repo, f), 'utf8'));
const SPEC = read('assets/world/cities.yaml');
const GROUND = read('data/rules.yaml').game.ground;
const AUTHORED = read('data/places.yaml');
const FACTIONS = read('data/factions.yaml');

// ---- Small things ------------------------------------------------------------------------------------------------
function rng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), pick: (arr) => arr[Math.floor(next() * arr.length)], weighted: (obj) => { const e = Object.entries(obj); let t = e.reduce((s, [, w]) => s + w, 0) * next(); for (const [k, w] of e) { t -= w; if (t < 0) return k; } return e[e.length - 1][0]; } };
}
// Legend letters: anything that is not a ground letter or one the map reads itself.
const POOL = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψωБГДЖЗИЙЛПФЦЧШЩЪЫЬЭЮЯбвгджзийклмнптфцчшщъыьэюяÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽž'].filter((c) => !(c in GROUND) && !'#.+ '.includes(c));

// One line of YAML flow: keys bare where YAML allows (`on` is quoted, a 1.1 boolean), strings JSON-quoted.
function flow(v) {
  if (Array.isArray(v)) return '[' + v.map(flow).join(', ') + ']';
  if (v && typeof v === 'object') return '{' + Object.entries(v).filter(([, x]) => x !== undefined && x !== null).map(([k, x]) => `${/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && !['on', 'off', 'yes', 'no', 'y', 'n', 'true', 'false'].includes(k) ? k : JSON.stringify(k)}: ${flow(x)}`).join(', ') + '}';
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

// ---- Names ---------------------------------------------------------------------------------------------------------
// A name from two roots of a people's word list: the first syllable or two of one and the last one or two of the
// other (or, with `join`, two whole roots run together).
const syllables = (w) => w.match(/[^aeiou]*[aeiou]+(?:[^aeiou](?![aeiou]))?|[^aeiou]+$/g) || [w];
function namer(people, r) {
  const P = SPEC.peoples[people];
  if (!P) throw new Error(`peoples.${people}: no such people`);
  const used = new Set();
  return () => {
    for (let tries = 0; tries < 200; tries++) {
      const a = r.pick(P.roots), b = r.pick(P.roots);
      if (a === b) continue;
      let n;
      if (P.join) n = a + b;
      else {
        const sa = syllables(a), sb = syllables(b);
        const head = sa.slice(0, 1 + r.int(Math.min(2, sa.length))), tail = sb.slice(Math.max(1, sb.length - 1 - r.int(2)));
        n = head.join('') + tail.join('');
      }
      if (n.length < 4 || n.length > 11 || used.has(n)) continue;
      used.add(n);
      return n[0].toUpperCase() + n.slice(1);
    }
    throw new Error('ran out of names');
  };
}

// ---- A town ---------------------------------------------------------------------------------------------------------
function build(id, T) {
  const town = AUTHORED[id];
  if (!town || town.kind !== 'town') throw new Error(`${id}: not a town in places.yaml`);
  const [W, H] = T.size;
  const r = rng(T.seed || 1);
  const grid = Array.from({ length: H }, () => Array(W).fill(T.ground || '.'));
  const mark = Array.from({ length: H }, () => Array(W).fill(null));   // a legend def per square, or null
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x, y, ch) => { if (inside(x, y)) { grid[y][x] = ch; mark[y][x] = null; } };
  const put = (x, y, def) => { if (inside(x, y)) mark[y][x] = def; };
  const free = (x, y) => inside(x, y) && !mark[y][x] && !(GROUND[grid[y][x]] && (GROUND[grid[y][x]].wall || GROUND[grid[y][x]].walk === false));
  const sprite = (type) => (T.prefix || '') + type;
  const want = {};       // sprite -> what tools/buildings.py is to draw
  const doorsOf = [];    // [{x, y}] squares in front of doors, kept clear
  const notes = [];

  // Ground.
  for (const p of T.paint || []) { const [x0, y0, x1, y1] = p.rect; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, p.ground); }
  if (T.sea) {
    const S = T.sea;
    for (let x = 0; x < W; x++) { const d = S.depth + (S.wobble ? r.int(S.wobble + 1) * ((x >> 2) % 2) : 0); for (let k = 0; k < d; k++) set(x, S.side === 'south' ? H - 1 - k : k, '~'); }
  }
  // A line of squares, `width` wide: a horizontal run widens downward, any other rightward.
  const line = (pts, width, fn) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) || 1;
      const horiz = Math.abs(bx - ax) > Math.abs(by - ay);
      for (let s = 0; s <= n; s++) {
        const x = Math.round(ax + (bx - ax) * s / n), y = Math.round(ay + (by - ay) * s / n);
        for (let k = 0; k < width; k++) fn(horiz ? x : x + k, horiz ? y + k : y);
      }
    }
  };
  for (const rv of T.rivers || []) line(rv.path, rv.width || 3, (x, y) => set(x, y, '~'));
  for (const st of T.streets || []) line(st.path, st.width || 2, (x, y) => { if (!inside(x, y)) return; set(x, y, grid[y][x] === '~' ? '=' : (T.ground || '.')); });
  for (const [x, y0, y1] of T.piers || []) for (let y = y0; y <= y1; y++) if (inside(x, y) && grid[y][x] === '~') set(x, y, '=');

  // The pyramid: risers (^) round terraces two squares wide, each a tier higher, the top a platform; a stair up the
  // south face at columns `stairs` and `stairs`+1 (the temple court's stair props).
  if (T.pyramid) {
    const P = T.pyramid, [x0, y0, x1, y1] = P.rect, tiers = ['-', ':', '*', '&'];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ring = Math.min(x - x0, x1 - x, y - y0, y1 - y);
      const k = Math.floor(ring / 3), onRiser = ring % 3 === 0;
      const top = Math.floor((Math.min(x1 - x0, y1 - y0) / 2) / 3);
      set(x, y, onRiser && k <= top ? '^' : tiers[Math.min(k, tiers.length - 1)]);
      if (onRiser && k <= top && y === y1 - ring && (x === P.stairs || x === P.stairs + 1) && k < 4) {
        put(x, y, { kind: 'prop', sprite: `pyr_stair_${x === P.stairs ? 'l' : 'r'}${k + 1}`, solid: false, on: '^', label: `Steps up ${P.label ? P.label.replace(/^The /, 'the ') : 'the pyramid'}` });
      }
    }
  }

  // A building: its squares from (x, bottom) up, its picture on the bottom-left square, its door in the bottom row.
  const placed = [];
  function building(type, x, bottom, extra) {
    const t = T.types[type];
    if (!t) throw new Error(`${id}: building type "${type}" unknown`);
    const h = t.d + 2, door = t.door || 'single';
    const label = (extra && extra.label) || t.label || type;
    for (let y = bottom - h + 1; y <= bottom; y++) for (let xx = x; xx < x + t.w; xx++) if (!free(xx, y)) return null;
    const cols = door === 'none' ? [] : door === 'double' ? [x + Math.floor(t.w / 2) - 1, x + Math.floor(t.w / 2)] : [x + Math.floor(t.w / 2)];
    const loc = extra && extra.location;
    const locDef = loc && (town.locations || []).find((l) => l.id === loc);
    if (loc && !locDef) throw new Error(`${id}: location "${loc}" is not in places.yaml`);
    const name = locDef ? locDef.name : label;
    for (let y = bottom - h + 1; y <= bottom; y++) for (let xx = x; xx < x + t.w; xx++) put(xx, y, { kind: 'prop', sprite: 'none', label: name });
    // Houses of one type come in `variants` (a roof a shade darker, lighter, warmer), picked at random.
    const v = t.variants ? r.int(t.variants) : 0;
    const spr = sprite(type) + (v ? '_' + v : '');
    put(x, bottom, { kind: 'prop', sprite: spr, label: name });
    for (const c of cols) {
      if (locDef) put(c, bottom, { kind: 'enter', location: loc, label: name });
      doorsOf.push({ x: c, y: bottom + 1 });
    }
    want[spr] = { kit: t.kit, w: t.w, d: t.d, door, variant: v };
    placed.push({ type, x, bottom, w: t.w, h, location: loc || null });
    return true;
  }

  // Walls: a horizontal run is a walk on top (its row) over a face two squares high; a vertical run is the walk only,
  // seen from above. Gates are gaps ([at, width] along the run), with towers either side.
  for (const wl of T.walls || []) {
    const [ax, ay] = wl.from, [bx, by] = wl.to, horiz = ay === by;
    const gaps = (wl.gates || []).map(([at, wd]) => [at, at + wd - 1]);
    const inGap = (v) => gaps.some(([a, b]) => v >= a && v <= b);
    const label = wl.label || 'A wall';
    const kitOf = (s) => { want[sprite(s)] = { kit: wl.kit, wall: s }; return sprite(s); };
    if (horiz) {
      for (let x = ax; x <= bx; x++) {
        if (inGap(x)) { for (let k = 0; k < 3; k++) set(x, ay + k, T.ground || '.'); continue; }
        const l = x === ax || inGap(x - 1), rr = x === bx || inGap(x + 1);
        const s = l && rr ? 'wall_h_m' : l ? 'wall_h_l' : rr ? 'wall_h_r' : 'wall_h_m';
        put(x, ay, { kind: 'prop', sprite: 'none', label }); put(x, ay + 1, { kind: 'prop', sprite: 'none', label });
        put(x, ay + 2, { kind: 'prop', sprite: kitOf(s), label });
      }
    } else {
      for (let y = ay; y <= by; y++) {
        if (inGap(y)) { set(ax, y, T.ground || '.'); continue; }
        put(ax, y, { kind: 'prop', sprite: kitOf(y === ay || inGap(y - 1) ? 'wall_v_n' : 'wall_v_m'), label });
      }
    }
    if (wl.towers && horiz) for (const [a, b] of gaps) {
      const tw = T.types[wl.towers].w;
      for (const x of [a - tw, b + 1]) {
        for (let y = ay - 1; y <= ay + 2; y++) for (let xx = x; xx < x + tw; xx++) mark[y][xx] = null;
        building(wl.towers, x, ay + 2, { label: 'A gate tower' });
      }
    }
  }

  // The town's own buildings first, then the districts' rows.
  for (const b of T.buildings || []) if (!building(b.type, b.at[0], b.at[1], b)) throw new Error(`${id}: no room for ${b.type} at ${b.at}`);
  for (const D of T.districts || []) {
    const [x0, y0, x1] = D.rect, rows = [...D.rows].sort((a, b) => b - a);
    rows.forEach((front, i) => {
      const next = rows[i + 1];
      const maxH = next == null ? front - y0 + 1 : front - (next + 2);
      const fits = Object.fromEntries(Object.entries(D.types).filter(([k]) => T.types[k].d + 2 <= maxH));
      let x = x0;
      while (x <= x1) {
        if (!free(x, front)) { x++; continue; }
        const choice = Object.fromEntries(Object.entries(fits).filter(([k]) => x + T.types[k].w - 1 <= x1));
        if (!Object.keys(choice).length) break;
        const type = r.weighted(choice);
        if (building(type, x, front)) {
          x += T.types[type].w;
          const gap = 1 + (r.next() < 0.25 ? 1 : 0);
          const g = D.gaps && r.pick(D.gaps);
          // A prop in a gap stands at its back, so the way between the rows stays open.
          if (g && x <= x1 && free(x, front - 1) && gap === 2) put(x, front - 1, { kind: 'prop', sprite: g });
          x += gap;
        } else x++;
      }
    });
  }
  for (const p of T.props || []) for (const [x, y] of p.at) {
    if (!free(x, y)) { notes.push(`prop ${p.sprite} at ${x},${y}: not free`); continue; }
    put(x, y, { kind: 'prop', sprite: p.sprite, label: p.label });
  }

  // The way out.
  const E = T.exit;
  put(E.at[0], E.at[1], { kind: 'stairs', to: E.to, at: E.arrive, sprite: 'none', label: E.label });

  // Reachable from the way out, walking: every door must be.
  const walkable = (x, y) => { if (!inside(x, y)) return false; const m = mark[y][x]; if (m) return m.kind === 'stairs' || m.kind === 'enter' || (m.kind === 'prop' && m.solid === false); const g = GROUND[grid[y][x]]; return !(g && (g.wall || g.walk === false)); };
  const reach = () => {
    const seen = new Set([E.at + '']), q = [E.at];
    while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = [x + dx, y + dy] + ''; if (!seen.has(k) && walkable(x + dx, y + dy) && !(mark[y] && mark[y][x] && mark[y][x].kind === 'enter' && !(x === E.at[0] && y === E.at[1]))) { seen.add(k); q.push([x + dx, y + dy]); } } }
    return seen;
  };

  // The townsfolk: on free squares of their rect, not in front of a door, keeping every door in reach.
  const citizens = {};
  const greet = T.greetings || {}, rumors = T.rumors || [];
  let rumor = 0;
  const names = {};
  const nameFor = (people) => (names[people] = names[people] || namer(people, r))();
  const doorFront = new Set(doorsOf.map((d) => d.x + ',' + d.y));
  const mustReach = () => { const s = reach(); return placed.filter((b) => b.location).every((b) => { const t = T.types[b.type]; const c = t.door === 'double' ? b.x + Math.floor(t.w / 2) - 1 : b.x + Math.floor(t.w / 2); return s.has([c, b.bottom + 1] + ''); }); };
  let n = 0;
  for (const R of T.roles || []) {
    const count = R.home ? 1 : (R.n || 1);
    for (let i = 0; i < count; i++) {
      const people = R.people || T.people;
      const nm = nameFor(people);
      const nid = `${id.replace(/_city$/, '')}_${(++n).toString().padStart(2, '0')}_${nm.toLowerCase().replace(/[^a-z]/g, '')}`;
      const faction = R.faction && FACTIONS[R.faction] ? R.faction : undefined;
      const topics = [];
      if (rumors.length) topics.push({ id: 'rumors', label: "What's the talk?", need: 1, kind: 'info', text: rumors[rumor++ % rumors.length] });
      citizens[nid] = {
        name: nm, title: R.title, faction, sprite: { art: R.sprite, kind: 'knight' }, placeholder: true,
        look: `${R.title} of ${town.name}. (A placeholder: tools/citygen.js.)`,
        attrs: { WIS: 5, WIL: 5, CHA: 5, INT: 5 }, disposition: R.temper === 'provincial' ? -1 : 0, willingness: 3, courage: 4, patience: 5,
        temperament: [R.temper || 'provincial'], interests: [],
        greeting: greet[R.title] || `${R.title}. What do you want?`,
        topics,
        home: R.home ? { place: id, location: R.home } : undefined,
      };
      if (R.home) continue;
      const [x0, y0, x1, y1] = R.rect;
      const spots = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (free(x, y) && !doorFront.has(x + ',' + y) && grid[y][x] !== '=') spots.push([x, y]);
      let ok = false;
      for (let t = 0; t < 40 && spots.length; t++) {
        const k = r.int(spots.length), [x, y] = spots.splice(k, 1)[0];
        put(x, y, { kind: 'npc', npc: nid, label: `${nm}, ${R.title.toLowerCase()}`, services: R.serves ? { place: id, location: R.serves } : undefined });
        if (mustReach()) { ok = true; break; }
        mark[y][x] = null;
      }
      if (!ok) { notes.push(`${R.title}: no room in ${R.rect}`); delete citizens[nid]; }
    }
  }
  if (!mustReach()) notes.push('a door cannot be reached from the way out');

  // Letters for the legend: one per distinct entry.
  const letters = new Map(), legend = {};
  let li = 0;
  const rows = grid.map((row, y) => row.map((ch, x) => {
    const m = mark[y][x];
    if (!m) return ch;
    const def = Object.assign({}, m);
    if (!def.on && ch in GROUND) def.on = ch;
    const key = flow(def);
    // The way out is '<', where a party coming in arrives.
    if (!letters.has(key) && def.kind === 'stairs') { letters.set(key, '<'); legend['<'] = def; }
    if (!letters.has(key)) { if (li >= POOL.length) throw new Error('out of legend letters'); letters.set(key, POOL[li++]); legend[POOL[li - 1]] = def; }
    return letters.get(key);
  }).join(''));
  // The menu's banner colours stay; its `ground` (a colour there) would read as a ground letter on a map.
  const look = Object.assign({}, town.look, { tileset: T.tileset, light: T.light || 30 });
  delete look.ground;
  return { id, rows, legend, look, citizens, want, notes, placed };
}

// ---- Run --------------------------------------------------------------------------------------------------------------
const only = opt('--only');
const outPlaces = ['# Generated by tools/citygen.js from assets/world/cities.yaml. Do not edit; edit that and run it again.', '# Each town\'s streets, laid field by field over its entry in places.yaml (Content: cities.yaml).', ''];
const outPeople = ['# Generated by tools/citygen.js from assets/world/cities.yaml. Do not edit; edit that and run it again.', '# Placeholder townsfolk of the generated towns (merged over npcs.yaml). `home` puts one inside a location.', ''];
for (const [id, T] of Object.entries(SPEC.towns)) {
  if (only && only !== id) continue;
  const b = build(id, T);
  outPlaces.push(`${id}:`, '  open: true', `  look: ${flow(b.look)}`, '  map:', ...b.rows.map((r) => `    - ${JSON.stringify(r)}`), '  legend:');
  for (const [ch, def] of Object.entries(b.legend)) outPlaces.push(`    ${JSON.stringify(ch)}: ${flow(def)}`);
  outPlaces.push('');
  for (const [nid, c] of Object.entries(b.citizens)) {
    outPeople.push(`${nid}:`);
    for (const [k, v] of Object.entries(c)) {
      if (v === undefined) continue;
      if (k === 'topics' && v.length) { outPeople.push('  topics:'); for (const t of v) outPeople.push(`    - ${flow(t)}`); }
      else outPeople.push(`  ${k}: ${flow(v)}`);
    }
  }
  outPeople.push('');
  const dir = path.join(repo, 'assets/wip/cities');
  fs.mkdirSync(dir, { recursive: true });
  const kits = {};
  for (const w of Object.values(b.want)) kits[w.kit] = SPEC.kits[w.kit];
  fs.writeFileSync(path.join(dir, `${id}-buildings.json`), JSON.stringify({ town: id, tileset: T.tileset, art: T.art, kits, sprites: b.want }, null, 1));
  console.log(`${id}: ${T.size.join('x')}, ${b.placed.length} buildings, ${Object.keys(b.citizens).length} townsfolk, ${Object.keys(b.legend).length} legend letters`);
  for (const nt of b.notes) console.log('  ' + nt);
  if (argv.includes('--show')) console.log(b.rows.join('\n'));
}
if (!only) {
  fs.writeFileSync(path.join(repo, 'data/cities.yaml'), outPlaces.join('\n'));
  fs.writeFileSync(path.join(repo, 'data/citizens.yaml'), outPeople.join('\n'));
}
