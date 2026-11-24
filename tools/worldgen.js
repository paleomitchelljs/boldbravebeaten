#!/usr/bin/env node
// Builds the outdoor places of an open world from a world raster and a layout (assets/world/*-layout.yaml):
// one place per land slot of a grid laid over the raster, every walkable square that meets one across a shared edge a
// way across, the layout's sites stamped on, roads between them, and the places written to data/outdoors.yaml.
// It also writes a gap report (what each family of places draws with a stand-in) beside the layout.
//   node tools/worldgen.js assets/world/w1-layout.yaml [--preview out.ppm] [--json out.json] [--out data/outdoors.yaml]
// The world named by the layout is content: this tool names none.
'use strict';
const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const layoutPath = path.resolve(argv[0] || 'assets/world/w1-layout.yaml');
const outPath = path.resolve(opt('--out') || path.join(repo, 'data/outdoors.yaml'));
process.chdir(repo + '/tests');
require(repo + '/tests/load.js');
const G = globalThis.BBB; G.UI = G.UI || {}; require(repo + '/src/ui/game/tilemap.js');
process.chdir(repo);
const Tm = G.UI.Tilemap;
const L = G.Yaml.parse(fs.readFileSync(layoutPath, 'utf8'));
const GROUND = G.CONFIG.game.ground;

// ---- Randomness and noise (seeded, so a layout always builds the same world) -----------------------------------
const SEED = L.seed || 1;
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s + SEED) * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const fbm = (x, y, s, oct = 3) => { let t = 0, amp = 1, f = 1, norm = 0; for (let o = 0; o < oct; o++) { t += vnoise(x * f, y * f, s + o * 17) * amp; norm += amp; amp *= 0.5; f *= 2; } return t / norm; };

// ---- The raster --------------------------------------------------------------------------------------------------
const csv = fs.readFileSync(path.resolve(repo, L.cells), 'utf8').trim().split('\n');
const hdr = csv[0].split(',');
const cells = new Map();
for (const line of csv.slice(1)) {
  const v = line.split(','), o = {};
  hdr.forEach((h, i) => { o[h] = v[i] === undefined ? '' : v[i].replace(/"/g, ''); });
  for (const k of ['row', 'col', 'land', 'strahler', 'flow_to', 'lake', 'swamp']) o[k] = +o[k] || 0;
  for (const k of ['lon', 'lat', 'elev', 'relief', 'q']) o[k] = +o[k] || 0;
  if (o.flow_to === 0 && v[hdr.indexOf('flow_to')] === '-1') o.flow_to = -1;
  cells.set(o.row * 720 + o.col, o);
}
const cellIdx = (lon, lat) => Math.floor((90 - lat) / 0.5) * 720 + Math.floor((lon + 180) / 0.5);
// The continent: land joined to the layout's seed cell.
const continent = new Set();
{
  const s = cellIdx(L.continent[0], L.continent[1]); const q = [s]; continent.add(s);
  while (q.length) { const k = q.pop(); const c = cells.get(k); for (const d of [720, -720, 1, -1]) { const n = k + d, nc = cells.get(n); if (nc && nc.land && !continent.has(n) && Math.abs(nc.col - c.col) <= 1) { continent.add(n); q.push(n); } } }
}
const landAt = (lon, lat) => { const k = cellIdx(lon, lat); return continent.has(k) ? cells.get(k) : null; };
// Relief and elevation, interpolated between cell centres (smooth fields for hills and mountains).
function field(lon, lat, key) {
  const x = (lon + 180) / 0.5 - 0.5, y = (90 - lat) / 0.5 - 0.5, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const v = (r, c) => { const k = r * 720 + c; return continent.has(k) ? cells.get(k)[key] : 0; };
  return v(iy, ix) * (1 - fx) * (1 - fy) + v(iy, ix + 1) * fx * (1 - fy) + v(iy + 1, ix) * (1 - fx) * fy + v(iy + 1, ix + 1) * fx * fy;
}

// ---- The grid ------------------------------------------------------------------------------------------------------
const { lon0, lat0, step, cols, rows, size: N } = L.grid;
const spd = N / step;                         // squares a degree
const GW = cols * N, GH = rows * N;
const toG = (lon, lat) => [Math.floor((lon - lon0) * spd), Math.floor((lat0 - lat) * spd)];
const lonOf = (gx) => lon0 + (gx + 0.5) / spd, latOf = (gy) => lat0 - (gy + 0.5) / spd;
const slotOf = (gx, gy) => [Math.floor(gy / N), Math.floor(gx / N)];
const slotKey = (r, c) => r + ',' + c;
const land = {};
for (const k of continent) { const c = cells.get(k); const [gx, gy] = toG(c.lon, c.lat); const [r, cc] = slotOf(gx, gy); if (r < 0 || cc < 0 || r >= rows || cc >= cols) continue; const s = (land[slotKey(r, cc)] = land[slotKey(r, cc)] || { n: 0, b: {} }); s.n++; s.b[c.biome] = (s.b[c.biome] || 0) + 1; }
const sites = (L.sites || []).map((s) => Object.assign({}, s, { g: toG(s.at[0], s.at[1]) }));
for (const s of sites) s.slot = slotOf(s.g[0], s.g[1]);
const included = new Set(Object.keys(land).filter((k) => land[k].n >= (L.minLand || 1)));
for (const s of sites) included.add(slotKey(...s.slot));
const zones = {};
for (const k of included) {
  const [r, c] = k.split(',').map(Number);
  const b = (land[k] || { b: { G: 1 } }).b, dom = Object.entries(b).sort((x, y) => y[1] - x[1])[0][0];
  const over = (L.slots || {})[k] || {};
  const famId = over.family || L.familyOf[dom] || Object.values(L.familyOf)[0];
  zones[k] = { r, c, key: k, id: `${L.prefix}${r}_${c}`, fam: L.families[famId], famId, over, dom, biomes: b, land: (land[k] || {}).n || 0, kludge: {} };
}
const zoneAt = (gx, gy) => (gx < 0 || gy < 0 || gx >= GW || gy >= GH) ? null : zones[slotKey(...slotOf(gx, gy))] || null;

// ---- Terrain classes over the whole world ---------------------------------------------------------------------------
// One class a square first (ocean, lake, river, swamp, ground, dry, forest, jungle, hill, mountain, ledge, summit,
// road, bridge), turned into each family's letters after.
const CLS = new Array(GW * GH).fill('ocean');
const FIX = new Uint8Array(GW * GH);          // stamped: later passes leave it
const CH = new Array(GW * GH).fill(null);     // letters, once decided
const I = (x, y) => y * GW + x;
const WARP = 0.35, WF = 0.8;                  // degrees of warp, and its wavelength in degrees
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
  if (!zoneAt(gx, gy)) continue;
  const lon = lonOf(gx), lat = latOf(gy);
  const wl = lon + (fbm(lon / WF, lat / WF, 1) - 0.5) * 2 * WARP, wt = lat + (fbm(lon / WF, lat / WF, 2) - 0.5) * 2 * WARP;
  const c = landAt(wl, wt);
  if (!c) continue;
  if (c.lake) { CLS[I(gx, gy)] = 'lake'; continue; }
  const rel = field(lon, lat, 'relief') + (fbm(lon * 3, lat * 3, 5) - 0.5) * 0.45;
  let k;
  if (rel > 1.32) k = 'summit'; else if (rel > 1.2) k = 'ledge'; else if (rel > 1.06) k = 'mountain';
  else if (c.swamp && fbm(lon * 4, lat * 4, 7) > 0.35) k = 'swamp';
  else if (rel > 0.86 && fbm(lon * 3, lat * 3, 8) > 0.45) k = 'hill';
  else {
    const n = fbm(lon * 2.5, lat * 2.5, 9);
    if (c.biome === 'F') k = n > 0.5 ? 'forest' : 'ground';
    else if (c.biome === 'J') k = n > 0.5 ? 'jungle' : 'ground';
    else if (c.biome === 'D') k = 'dry';
    else k = fbm(lon * 3, lat * 3, 11) > 0.72 ? 'forest' : (fbm(lon * 1.5, lat * 1.5, 12) > 0.66 ? 'dry' : 'ground');
  }
  CLS[I(gx, gy)] = k;
}
// Mountains climb a ring a square: a ledge stands wholly on mountain, a summit wholly on ledge.
const rankOf = { mountain: 1, ledge: 2, summit: 3 };
for (let pass = 0; pass < 3; pass++) for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
  const k = CLS[I(gx, gy)], r = rankOf[k]; if (!r || r === 1) continue;
  let ok = true;
  for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if ((rankOf[CLS[I(gx + dx, gy + dy)]] || 0) < r - 1) { ok = false; break; }
  if (!ok) CLS[I(gx, gy)] = r === 3 ? 'ledge' : 'mountain';
}
// Rivers: each reach of Strahler order 2 and up, from its cell's centre to the next downstream, wider as it grows.
for (const k of continent) {
  const c = cells.get(k); if (c.strahler < 2 || c.lake || c.flow_to < 0) continue;
  const d = cells.get(c.flow_to); if (!d) continue;
  const [x0, y0] = [(c.lon - lon0) * spd, (lat0 - c.lat) * spd], [x1, y1] = [(d.lon - lon0) * spd, (lat0 - d.lat) * spd];
  const w = c.strahler >= 4 ? 1.6 : c.strahler >= 3 ? 1.1 : 0.55;
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3) + 1;
  // A gentle meander: the reach bows to one side by noise.
  const bow = (vnoise(x0 / 7, y0 / 7, 21) - 0.5) * 3, nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, b = Math.sin(Math.PI * t) * bow;
    const x = x0 + (x1 - x0) * t + nx / nl * b, y = y0 + (y1 - y0) * t + ny / nl * b;
    for (let gy = Math.floor(y - w); gy <= Math.ceil(y + w); gy++) for (let gx = Math.floor(x - w); gx <= Math.ceil(x + w); gx++) {
      if (!zoneAt(gx, gy) || Math.hypot(gx + 0.5 - x, gy + 0.5 - y) > w + 0.15) continue;
      const cl = CLS[I(gx, gy)]; if (cl === 'ocean' || cl === 'lake') continue;
      CLS[I(gx, gy)] = 'river';
    }
  }
}
// Calderas: a ring of peaks round a crater (forest and a lake in it).
for (const s of sites) if (s.ring) {
  const [cx, cy] = s.g, { inner, rim, outer } = s.ring;
  for (let gy = cy - outer - 1; gy <= cy + outer + 1; gy++) for (let gx = cx - outer - 1; gx <= cx + outer + 1; gx++) {
    if (!zoneAt(gx, gy)) continue;
    const d = Math.hypot(gx - cx, gy - cy) + (vnoise(gx / 3, gy / 3, 31) - 0.5) * 1.2;
    let k = null;
    if (d < inner - 1.5) k = 'lake';
    else if (d < inner) k = 'forest';
    else if (d <= outer) { const h = 3 * (1 - Math.abs(d - rim) / (d < rim ? rim - inner : outer - rim)); k = h >= 2.2 ? 'summit' : h >= 1.3 ? 'ledge' : h >= 0.4 ? 'mountain' : 'ground'; }
    if (k) CLS[I(gx, gy)] = k;
  }
}

// ---- Families: class to letter -------------------------------------------------------------------------------------
const note = (z, what) => { z.kludge[what] = (z.kludge[what] || 0) + 1; };
function letter(z, k, gx, gy) {
  const ch = z.fam.chars;
  if (ch[k]) return ch[k];
  const st = z.fam.stand[k];
  if (!st) { note(z, `${k} -> ground (no stand-in named)`); return ch.ground; }
  note(z, `${k} drawn as ${st}`);
  if (st === 'pools') return vnoise(gx / 2, gy / 2, 41) > 0.55 ? ch.lake : ch.ground;
  return ch[st] || ch.ground;
}
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
  const z = zoneAt(gx, gy); if (!z) continue;
  CH[I(gx, gy)] = letter(z, CLS[I(gx, gy)], gx, gy);
}

// Walkable by letter (as tests/game.test.js and tools/diagonals.js read it).
const groundOf = (ch) => GROUND[ch];
const walkCh = (ch) => { if (ch == null || ch === '#' || ch === ' ') return false; const g = groundOf(ch); return !(g && (g.wall || g.walk === false)); };
const legendOf = {};                           // zone key -> { letter: def }
const isLegend = (gx, gy) => { const z = zoneAt(gx, gy); return !!(z && legendOf[z.key] && legendOf[z.key][CH[I(gx, gy)]]); };
const walk = (gx, gy) => { const z = zoneAt(gx, gy); if (!z) return false; const c = CH[I(gx, gy)]; if (legendOf[z.key] && legendOf[z.key][c]) return true; return walkCh(c); };

// Cliff sets (forest, jungle) draw only shapes made of whole 2x2 blocks on the even grid: no one-row steps, no
// one-square spurs or strips. So a block is all one cliff letter or none: a block mostly cliff over plain ground is
// filled, the rest cleared. Every later cut clears whole blocks (layPath), and nothing later lays a cliff letter.
const cliffLetters = new Set(['}', ']', '▩', '@']);
const blockOf = (i) => { const x = (i % GW) & ~1, y = Math.floor(i / GW) & ~1; return [I(x, y), I(x + 1, y), I(x, y + 1), I(x + 1, y + 1)]; };
const famAt = (i) => zoneAt(i % GW, Math.floor(i / GW)).fam;
const clearSq = (i) => { CH[i] = famAt(i).chars.ground; CLS[i] = 'ground'; };
const sameZoneXY = (x0, y0, x1, y1) => Math.floor(x0 / N) === Math.floor(x1 / N) && Math.floor(y0 / N) === Math.floor(y1 / N);
for (let by = 0; by < GH; by += 2) for (let bx = 0; bx < GW; bx += 2) {
  if (!zoneAt(bx, by)) continue;
  const q = blockOf(I(bx, by)), c = q.map((i) => CH[i]).find((ch) => cliffLetters.has(ch));
  if (!c) continue;
  const n = q.filter((i) => CH[i] === c).length, plain = q.every((i) => CH[i] === c || CH[i] === famAt(i).chars.ground);
  for (const i of q) if (n >= 2 && plain) CH[i] = c; else if (cliffLetters.has(CH[i])) clearSq(i);
}
// Clear (to plain ground) every cliff square not in a whole block of it, and one of two whole blocks that meet only at
// a corner. Stamped squares stay. Returns how many squares it cleared.
function alignCliffs() {
  let n = 0;
  for (let by = 0; by < GH; by += 2) for (let bx = 0; bx < GW; bx += 2) {
    if (!zoneAt(bx, by)) continue;
    const q = blockOf(I(bx, by)), c = CH[q[0]];
    // A whole block stays unless another cliff set (a stamped fort) touches it: each counts the other as its own.
    const touches = () => { for (let y = by - 1; y <= by + 2; y++) for (let x = bx - 1; x <= bx + 2; x++) { const k = CH[I(x, y)]; if (zoneAt(x, y) && sameZoneXY(bx, by, x, y) && cliffLetters.has(k) && k !== c) return true; } return false; };
    if (cliffLetters.has(c) && q.every((i) => CH[i] === c) && !touches()) continue;
    for (const i of q) if (cliffLetters.has(CH[i]) && !FIX[i]) { clearSq(i); n++; }
  }
  const whole = (bx, by) => { const q = blockOf(I(bx, by)), c = CH[q[0]]; return cliffLetters.has(c) && q.every((i) => CH[i] === c) ? c : null; };
  for (let by = 0; by + 2 < GH; by += 2) for (let bx = 0; bx + 2 < GW; bx += 2) {
    if (bx % N === N - 2 || by % N === N - 2 || !zoneAt(bx, by)) continue;   // the four blocks in one place
    const a = whole(bx, by), b = whole(bx + 2, by), c = whole(bx, by + 2), d = whole(bx + 2, by + 2);
    const pairs = [];
    if (a && a === d && b !== a && c !== a) pairs.push([bx + 2, by + 2], [bx, by]);
    if (b && b === c && a !== b && d !== b) pairs.push([bx, by + 2], [bx + 2, by]);
    for (let k = 0; k < pairs.length; k += 2) {
      const pick = [pairs[k], pairs[k + 1]].find(([x, y]) => blockOf(I(x, y)).every((i) => !FIX[i]));
      if (pick) for (const i of blockOf(I(...pick))) { clearSq(i); n++; }
    }
  }
  return n;
}

// ---- Sites: stamps, rings' marks ---------------------------------------------------------------------------------------
const recruits = [];
const siteAnchor = {};                         // site id -> [gx, gy] squares the roads may start from
function stampSite(s) {
  const z = zoneAt(...s.g); if (!z) throw new Error(`site ${s.id} is off the map`);
  const lg = (legendOf[z.key] = legendOf[z.key] || {});
  for (const [k, d] of Object.entries(s.legend || {})) { if (lg[k] && JSON.stringify(lg[k]) !== JSON.stringify(d)) throw new Error(`site ${s.id}: legend "${k}" is taken in ${z.id}`); lg[k] = d; }
  z.encounters = Object.assign(z.encounters || {}, s.encounters || {});
  if (s.wandering) z.wandering = (z.wandering || []).concat(s.wandering);
  const anchors = [];
  if (s.stamp) {
    const fc = z.fam.chars;
    // `·` the family's ground, `+` its road, a space the terrain as it is; any other letter as written.
    const tok = (row) => [...row].map((c) => c === '·' ? fc.ground : c === '+' ? fc.road : c === ' ' ? null : c);
    const st = s.stamp.map(tok), h = st.length, w = st[0].length;
    st.forEach((r, i) => { if (r.length !== w) throw new Error(`site ${s.id}: stamp row ${i} is ${r.length} wide, not ${w}`); });
    // Keep it inside its place, two squares off the edges (the edges are the ways across).
    const zx0 = z.c * N, zy0 = z.r * N;
    let x0 = Math.max(zx0 + 2, Math.min(zx0 + N - 2 - w, s.g[0] - Math.floor(w / 2)));
    let y0 = Math.max(zy0 + 2, Math.min(zy0 + N - 2 - h, s.g[1] - Math.floor(h / 2)));
    s.origin = [x0, y0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = st[y][x]; if (c === null) continue;
      const gx = x0 + x, gy = y0 + y;
      if (/[1-8]/.test(c)) { recruits.push({ n: +c, place: z.id, at: [gx - zx0, gy - zy0] }); c = fc.ground; }
      CH[I(gx, gy)] = c; FIX[I(gx, gy)] = 1;
      if (c === fc.road) anchors.push([gx, gy]);
    }
  }
  for (const m of s.marks || []) { const gx = s.g[0] + m.at[0], gy = s.g[1] + m.at[1]; CH[I(gx, gy)] = m.char; FIX[I(gx, gy)] = 1; anchors.push([gx, gy]);
    // clear the ground round a mark so its door stands free
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = I(gx + dx, gy + dy); if (!FIX[j] && !walkCh(CH[j]) && !['lake', 'ocean'].includes(CLS[j])) { const r = rankOf[CLS[j]] || 0; if (r <= 1) CH[j] = z.fam.chars.ground; } }
  }
  if (!anchors.length) anchors.push(s.g);
  siteAnchor[s.id] = anchors;
}
for (const s of sites) stampSite(s);

// ---- Roads -------------------------------------------------------------------------------------------------------------
// A binary heap for the searches.
class Heap { constructor() { this.a = []; } push(p, v) { const a = this.a; a.push([p, v]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } } pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; } get size() { return this.a.length; } }
const COST = { ground: 1, dry: 1, hill: 1.6, swamp: 2.5, forest: 3, jungle: 3, river: 7, lake: 14, mountain: 18, ledge: 60, summit: Infinity, ocean: Infinity, road: 0.35, bridge: 0.5 };
function stepCost(gx, gy) {
  const z = zoneAt(gx, gy); if (!z) return Infinity;
  const i = I(gx, gy);
  let c;
  if (FIX[i]) c = walk(gx, gy) && !isLegend(gx, gy) ? (CH[i] === z.fam.chars.road ? 0.35 : 1) : Infinity;
  else c = CH[i] === z.fam.chars.road && CLS[i] === 'road' ? 0.35 : (COST[CLS[i]] ?? 2);
  const ex = gx % N, ey = gy % N;
  if (ex === 0 || ey === 0 || ex === N - 1 || ey === N - 1) c += 3;   // not along the edges
  return c;
}
const DIST = new Float64Array(GW * GH), PREV = new Int32Array(GW * GH);
// Cheapest way from any start to a square isGoal accepts; a goal square may be entered whatever it costs.
function search(starts, isGoal, costFn) {
  DIST.fill(Infinity); PREV.fill(-1);
  const h = new Heap();
  for (const [x, y] of starts) { const i = I(x, y); DIST[i] = 0; h.push(0, i); }
  while (h.size) {
    const [d, i] = h.pop(); if (d > DIST[i]) continue;
    const x = i % GW, y = Math.floor(i / GW);
    if (isGoal(x, y, i)) { const p = []; for (let k = i; k >= 0; k = PREV[k]) p.push(k); return p.reverse(); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const j = I(nx, ny);
      let c = costFn(nx, ny); if (c === Infinity) { if (!isGoal(nx, ny, j)) continue; c = 1; }
      const nd = d + c;
      if (nd < DIST[j]) { DIST[j] = nd; PREV[j] = i; h.push(nd, j); }
    }
  }
  return null;
}
function layPath(p, how) {
  for (const i of p) {
    if (FIX[i]) continue;
    if (cliffLetters.has(CH[i])) for (const j of blockOf(i)) if (!FIX[j] && cliffLetters.has(CH[j])) clearSq(j);
    const gx = i % GW, gy = Math.floor(i / GW), z = zoneAt(gx, gy), fc = z.fam.chars, was = CLS[i];
    if (['river', 'lake', 'ocean'].includes(was)) { CH[i] = fc.bridge || letter(z, 'shallows', gx, gy); if (!fc.bridge) note(z, 'bridge drawn as shallows'); CLS[i] = 'bridge'; }
    else if (how === 'road') { CH[i] = fc.road; CLS[i] = 'road'; }
    else if (!walkCh(CH[i])) { CH[i] = fc.ground; CLS[i] = 'ground'; }
  }
}
let roadsLaid = 0;
const siteById = Object.fromEntries(sites.map((s) => [s.id, s]));
for (const s of sites) for (const t of s.road || []) {
  const T = siteById[t]; if (!T) throw new Error(`site ${s.id}: road to unknown site ${t}`);
  const goals = new Set(siteAnchor[t].map(([x, y]) => I(x, y)));
  const p = search(siteAnchor[s.id], (x, y, i) => goals.has(i), stepCost);
  if (!p) { console.warn(`no road from ${s.id} to ${t}`); continue; }
  layPath(p, 'road'); roadsLaid++;
}

// ---- One world: each place one piece of walkable ground, and every place reached from home's --------------------------
const wet = (i) => CH[i] === '~';
const sameZone = (x0, y0, x1, y1) => Math.floor(x0 / N) === Math.floor(x1 / N) && Math.floor(y0 / N) === Math.floor(y1 / N);
// Closing (x, y) cuts no way: the walkable squares round it stay one piece through its eight neighbours.
function locallyOne(x, y) {
  const ring = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => sameZone(x, y, a, b) && walk(a, b));
  if (!ring.length) return true;
  const key = ([a, b]) => a + ',' + b, set = new Set(ring.map(key)), seen = new Set([key(ring[0])]), q = [ring[0]];
  while (q.length) { const [a, b] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (a + dx) + ',' + (b + dy); if (set.has(k) && !seen.has(k)) { seen.add(k); q.push([a + dx, b + dy]); } } }
  return seen.size === ring.length;
}
// Walkable squares that touch only at a corner (tools/diagonals.js): beside water, one of them becomes water if that
// cuts nothing; else the cheaper square between is opened (a whole block of a cliff set); else one is closed.
function fixDiagonals() {
  let n = 0;
  for (let gy = 0; gy < GH - 1; gy++) for (let gx = 0; gx < GW - 1; gx++) {
    if (gx % N === N - 1 || gy % N === N - 1 || !zoneAt(gx, gy)) continue;
    const a = walk(gx, gy), b = walk(gx + 1, gy), c = walk(gx, gy + 1), d = walk(gx + 1, gy + 1);
    if (!((a && d && !b && !c) || (b && c && !a && !d))) continue;
    const walkers = (a && d ? [[gx, gy], [gx + 1, gy + 1]] : [[gx + 1, gy], [gx, gy + 1]]).filter(([x, y]) => !FIX[I(x, y)] && !isLegend(x, y));
    const blockers = a && d ? [[gx + 1, gy], [gx, gy + 1]] : [[gx, gy], [gx + 1, gy + 1]];
    if (blockers.some(([x, y]) => wet(I(x, y)))) {
      const w = walkers.find(([x, y]) => locallyOne(x, y));
      if (w) { const i = I(...w); CH[i] = famAt(i).chars.lake; CLS[i] = 'lake'; n++; continue; }
    }
    const opens = blockers.filter(([x, y]) => !FIX[I(x, y)]).sort((p, q) => (COST[CLS[I(...p)]] ?? 9) - (COST[CLS[I(...q)]] ?? 9));
    if (opens.length) { layPath([I(...opens[0])], 'ground'); n++; continue; }
    if (walkers.length) { const i = I(...walkers[0]); CH[i] = famAt(i).chars.lake; CLS[i] = 'lake'; n++; }
  }
  return n;
}
// Walkable pieces within each place (not across its edges).
function components() {
  const comp = new Int32Array(GW * GH).fill(-1), sizes = [], zoneOfComp = [];
  for (let i = 0; i < GW * GH; i++) {
    const x0 = i % GW, y0 = Math.floor(i / GW);
    if (comp[i] >= 0 || !walk(x0, y0)) continue;
    const id = sizes.length; let n = 0; const q = [i]; comp[i] = id;
    while (q.length) {
      const j = q.pop(); n++; const x = j % GW, y = Math.floor(j / GW);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || !sameZone(x, y, nx, ny)) continue; const k = I(nx, ny); if (comp[k] < 0 && walk(nx, ny)) { comp[k] = id; q.push(k); } }
    }
    sizes.push(n); zoneOfComp.push(zoneAt(x0, y0).key);
  }
  return { comp, sizes, zoneOfComp };
}
const homeSite = siteById[L.home];
const CARVE = { ground: 1, dry: 1, hill: 1, swamp: 1, road: 1, bridge: 1, forest: 2.5, jungle: 2.5, river: 6, lake: 10, mountain: 8, ledge: 30, summit: 200, ocean: 80 };
const carveCost = (x, y) => { const z = zoneAt(x, y); if (!z) return Infinity; const i = I(x, y); if (FIX[i]) return walk(x, y) && !isLegend(x, y) ? 1 : Infinity; return walk(x, y) ? 1 : (CARVE[CLS[i]] ?? 3); };
let carved = 0, filled = 0;
// In each place, pieces cut off from its largest: a small one by water becomes water; the rest are joined to the
// largest by the cheapest way within the place. Returns how many pieces it dealt with.
function joinPlaces() {
  const { comp, sizes, zoneOfComp } = components();
  const main = {};
  for (let id = 0; id < sizes.length; id++) { const k = zoneOfComp[id]; if (main[k] === undefined || sizes[id] > sizes[main[k]]) main[k] = id; }
  const members = {};
  for (let i = 0; i < GW * GH; i++) if (comp[i] >= 0 && comp[i] !== main[zoneOfComp[comp[i]]]) (members[comp[i]] = members[comp[i]] || []).push(i);
  let dealt = 0;
  for (const [idS, sq] of Object.entries(members)) {
    const id = +idS, z = zones[zoneOfComp[id]];
    dealt++;
    const byWater = sq.some((i) => [1, -1, GW, -GW].some((d) => wet(i + d)));
    if (sizes[id] < 24 && byWater && sq.every((i) => !FIX[i] && !isLegend(i % GW, Math.floor(i / GW)))) { for (const i of sq) { CH[i] = z.fam.chars.lake; CLS[i] = 'lake'; filled++; } continue; }
    const inZ = (x, y) => zoneAt(x, y) === z ? carveCost(x, y) : Infinity;
    const p = search(sq.map((i) => [i % GW, Math.floor(i / GW)]), (x, y, i) => comp[i] === main[z.key], inZ);
    if (!p) { console.warn(`${z.id}: a piece of ${sizes[id]} squares can't be joined; flooded`); for (const i of sq) if (!FIX[i]) { CH[i] = z.fam.chars.lake; CLS[i] = 'lake'; } continue; }
    layPath(p, 'ground'); carved++;
  }
  return dealt;
}
// Places reached from home's across their edges (a pair of walkable squares facing each other); one not reached gets
// the cheapest way to one that is.
function joinWorld() {
  const homeZ = zoneAt(...siteAnchor[L.home][0]), seen = new Set([homeZ.key]), q = [homeZ];
  const crosses = (z, o, dx, dy) => { for (let t = 1; t < N - 1; t++) { const x = z.c * N + (dx === 1 ? N - 1 : dx === -1 ? 0 : t), y = z.r * N + (dy === 1 ? N - 1 : dy === -1 ? 0 : t); if (walk(x, y) && walk(x + dx, y + dy) && !isLegend(x, y) && !isLegend(x + dx, y + dy)) return true; } return false; };
  while (q.length) { const z = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = zones[slotKey(z.r + dy, z.c + dx)]; if (o && !seen.has(o.key) && crosses(z, o, dx, dy)) { seen.add(o.key); q.push(o); } } }
  const lost = Object.values(zones).filter((z) => !seen.has(z.key));
  if (!lost.length) return 0;
  const z = lost[0], starts = [];
  for (let y = z.r * N; y < z.r * N + N; y++) for (let x = z.c * N; x < z.c * N + N; x++) if (walk(x, y)) starts.push([x, y]);
  if (!starts.length) { const c = [z.c * N + N / 2, z.r * N + N / 2]; starts.push(c); }
  const p = search(starts, (x, y) => { const o = zoneAt(x, y); return !!o && seen.has(o.key) && walk(x, y); }, (x, y) => { const c = carveCost(x, y); const ex = x % N, ey = y % N; return c + ((ex === 0 || ey === 0 || ex === N - 1 || ey === N - 1) && !walk(x, y) ? 2 : 0); });
  if (!p) { console.warn(`${z.id} can't be reached`); return 0; }
  layPath(p, 'ground'); carved++;
  return 1;
}
alignCliffs();
// Each step can undo another's work (opening a block makes a corner elsewhere; a way cut leaves a piece): until still.
let settle = 0;
for (; settle < 30; settle++) {
  const n = fixDiagonals() + joinPlaces() + joinWorld() + alignCliffs();
  if (!n) break;
}
if (settle === 30) console.warn('the map did not settle: some corners or pieces may be left');

// ---- What the cliff sets still cannot draw (should be nothing) -----------------------------------------------------------
function zoneScene(z) {
  const zx0 = z.c * N, zy0 = z.r * N, lg = legendOf[z.key] || {}, gl = z.fam.look.ground || '.';
  return { w: N, h: N, misfits: true, cell: (x, y) => {
    if (x < 0 || y < 0 || x >= N || y >= N) return { kind: 'rock', ch: ' ' };
    const ch = CH[I(zx0 + x, zy0 + y)];
    if (ch === '#') return { kind: 'wall', ch };
    const def = lg[ch];
    if (def) return { kind: def.kind, ch, def, ground: G.Explore.groundOf(def.on || gl) };
    const gr = G.Explore.groundOf(ch);
    if (gr && gr.wall) return { kind: 'wall', ch, ground: gr };
    return { kind: gr && gr.walk === false ? 'water' : 'floor', ch, ground: gr || G.Explore.groundOf(gl) };
  } };
}
const misfits = {};
for (const z of Object.values(zones)) { const m = Tm.planTiles(zoneScene(z), Tm.tileset(z.fam.tileset), 0, 0, N - 1, N - 1).misfit || []; if (m.length) misfits[z.id] = m; }
const misfitLeft = Object.values(misfits).reduce((t, m) => t + m.length, 0);

// ---- Scattered props: only where all eight neighbours are open plain ground (a prop never shuts a way) -----------------
const propsUsed = {};
for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
  const z = zoneAt(gx, gy); if (!z || FIX[I(gx, gy)]) continue;
  const ex = gx % N, ey = gy % N; if (ex < 2 || ey < 2 || ex > N - 3 || ey > N - 3) continue;
  const fc = z.fam.chars, c = CH[I(gx, gy)], cl = CLS[I(gx, gy)];
  let table = null;
  if (cl === 'road' || cl === 'bridge') continue;
  if (c === fc.ground && cl === 'jungle' && z.famId !== 'w1_jungle') table = z.fam.scatter.jungleAsForest;
  else if (c === fc.ground && cl === 'swamp') table = z.fam.scatter.pools || z.fam.scatter.swamp;
  else if (c === fc.ground) table = z.fam.scatter.ground;
  else if (c === fc.dry) table = z.fam.scatter.dry;
  else if (c === fc.swamp) table = z.fam.scatter.swamp;
  else if (c === fc.oasis) table = z.fam.scatter.oasis;
  if (!table) continue;
  let open = true;
  for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) { const j = I(gx + dx, gy + dy); if (FIX[j] || !walkCh(CH[j]) || isLegend(gx + dx, gy + dy)) { open = false; break; } }
  const r = hash(gx, gy, 77);
  let acc = 0;
  for (const [p, w] of Object.entries(table)) {
    acc += w; if (r >= acc) continue;
    const def = z.fam.props[p]; if (def.solid !== false && !open) break;
    // A letter for each prop on each ground it stands on (a legend entry has one ground under it).
    const lg = (legendOf[z.key] = legendOf[z.key] || {}), used = (propsUsed[z.key] = propsUsed[z.key] || {}), key = p + '|' + c;
    if (!used[key]) {
      const pool = [...'ŧɨƥǥǿʀƙϻƨçαβδεζηθικλμνξπρστυφχψωϐϑϒϕϖϗϙϛϝϟϡϣϥϧϩϫϭϯ'];
      const ch = pool.find((x) => !lg[x]); if (!ch) break;
      used[key] = ch;
      lg[ch] = Object.assign({ kind: 'prop' }, def); if (c !== '.') lg[ch].on = c;
    }
    CH[I(gx, gy)] = used[key]; FIX[I(gx, gy)] = 2;
    break;
  }
}

// ---- Ways across: every pair of walkable squares facing each other over a shared edge ---------------------------------
// Each side's squares take a letter by the ground they are on (a legend entry has one ground); each arrives on the
// letter facing it (Explore.enter puts you on the square across from where you left).
const EXIT = { N: [...'NŇṄṆŊṈ'], S: [...'SŠṠȘŚṢ'], E: [...'EĒĖĘĚẸ'], W: [...'WŴẀẂẄẈ'] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const DIRN = { N: 'North', S: 'South', E: 'East', W: 'West' };
const zoneOf = (r, c) => zones[slotKey(r, c)];
const exitsOf = {};
for (const z of Object.values(zones)) for (const [d, dx, dy] of [['E', 1, 0], ['S', 0, 1]]) {
  const o = zoneOf(z.r + dy, z.c + dx); if (!o) continue;
  const pairs = [];
  for (let t = 1; t < N - 1; t++) {   // not the corners: each belongs to two edges
    const gx = z.c * N + (dx ? N - 1 : t), gy = z.r * N + (dy ? N - 1 : t), ox = gx + dx, oy = gy + dy;
    if (walk(gx, gy) && walk(ox, oy) && !isLegend(gx, gy) && !isLegend(ox, oy)) pairs.push([I(gx, gy), I(ox, oy)]);
  }
  const sides = [[z, o, d, 0], [o, z, OPP[d], 1]];
  const letters = [{}, {}];
  for (const [me, them, dd, k] of sides) for (const pr of pairs) { const on = CH[pr[k]]; if (!(on in letters[k])) letters[k][on] = EXIT[dd][Object.keys(letters[k]).length] || null; }
  for (const pr of pairs) if (!letters[0][CH[pr[0]]] || !letters[1][CH[pr[1]]]) { pr.skip = true; }
  for (const [me, them, dd, k] of sides) {
    const lg = (legendOf[me.key] = legendOf[me.key] || {});
    for (const pr of pairs) {
      if (pr.skip) continue;
      const on = CH[pr[k]], ch = letters[k][on], facing = letters[1 - k][CH[pr[1 - k]]];
      if (lg[ch] && lg[ch].kind !== 'stairs') throw new Error(`${me.id}: exit letter ${ch} is taken`);
      if (!lg[ch]) lg[ch] = { kind: 'stairs', to: them.id, at: facing, sprite: 'none', label: `${DIRN[dd]}, to ${them.over.name || '{{name:' + them.key + '}}'}`, on: on === '.' ? undefined : on };
      pr['ch' + k] = ch;
    }
  }
  for (const pr of pairs) if (!pr.skip) { CH[pr[0]] = pr.ch0; CH[pr[1]] = pr.ch1; (exitsOf[z.key] = exitsOf[z.key] || []).push(pr.ch0); (exitsOf[o.key] = exitsOf[o.key] || []).push(pr.ch1); }
}

// ---- Names, levels, blurbs ---------------------------------------------------------------------------------------------
const homeZone = zoneAt(...homeSite.g);
{ const dist = { [homeZone.key]: 0 }, q = [homeZone];
  while (q.length) { const z = q.shift(); for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = zoneOf(z.r + dr, z.c + dc); if (o && !(o.key in dist) && (exitsOf[z.key] || []).length) { dist[o.key] = dist[z.key] + 1; q.push(o); } } }
  for (const z of Object.values(zones)) { z.dist = dist[z.key] ?? 99; z.level = Math.min(L.level.max, L.level.base + Math.round((z.dist === 99 ? 12 : z.dist) * L.level.per)); }
}
const biomeWord = { G: 'grassland', F: 'forest', J: 'jungle', D: 'desert' };
for (const z of Object.values(zones)) {
  const share = Object.entries(z.biomes).sort((a, b) => b[1] - a[1]).map(([b, n]) => `${biomeWord[b] || b} ${Math.round(100 * n / Math.max(1, z.land))}%`).join(', ');
  z.name = z.over.name || null;
  z.blurb = z.over.blurb || `${biomeWord[z.dom] ? biomeWord[z.dom][0].toUpperCase() + biomeWord[z.dom].slice(1) : 'Land'}: ${share} of it, by the world map. Not yet crafted.`;
}
// An unnamed place is named by its land and the nearest named one: "Jungle west of Zhomelonga", "far west" two or more
// places off; a name still taken gets a number.
{
  const named = Object.values(zones).filter((z) => z.name), taken = {};
  const cap = (w) => w[0].toUpperCase() + w.slice(1);
  for (const z of Object.values(zones).filter((q) => !q.name).sort((a, b) => a.r - b.r || a.c - b.c)) {
    const a = named.slice().sort((p, q) => Math.hypot(p.r - z.r, p.c - z.c) - Math.hypot(q.r - z.r, q.c - z.c))[0];
    const dr = z.r - a.r, dc = z.c - a.c, ns = Math.abs(dr) * 2 > Math.abs(dc) ? (dr < 0 ? 'north' : 'south') : '', ew = Math.abs(dc) * 2 > Math.abs(dr) ? (dc < 0 ? 'west' : 'east') : '';
    let n = `${cap(biomeWord[z.dom] || 'land')} ${Math.max(Math.abs(dr), Math.abs(dc)) >= 2 ? 'far ' : ''}${ns}${ew} of ${a.name.replace(/^The /, 'the ')}`;
    taken[n] = (taken[n] || 0) + 1; if (taken[n] > 1) n += ` (${taken[n]})`;
    z.name = n;
  }
}
for (const z of Object.values(zones)) for (const d of Object.values(legendOf[z.key] || {})) if (d.label && d.label.includes('{{name:')) d.label = d.label.replace(/\{\{name:([0-9,]+)\}\}/, (_, k) => zones[k].name);

// ---- Write ----------------------------------------------------------------------------------------------------------------
const q = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const bare = (s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && !['true', 'false', 'null', 'yes', 'no', 'on', 'off', 'y', 'n'].includes(s.toLowerCase());
function flow(v) {
  if (v === null || v === undefined) return '~';
  if (Array.isArray(v)) return '[' + v.map(flow).join(', ') + ']';
  if (typeof v === 'object') return '{' + Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${bare(k) ? k : q(k)}: ${flow(x)}`).join(', ') + '}';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return bare(v) ? v : q(v);
}
const out = ['# Generated by tools/worldgen.js from ' + path.relative(repo, layoutPath) + '. The outdoor places of the open world: one a',
  '# slot of the layout\'s grid. Regenerating overwrites this file: edit the layout, or edit a map here and keep it.', ''];
const order = Object.values(zones).sort((a, b) => a.r - b.r || a.c - b.c);
// `.` is plain floor, not a ground letter: a legend entry or look without a ground stands on the floor.
const noFloor = (d) => { if (d.on !== '.') return d; const e = Object.assign({}, d); delete e.on; return e; };
for (const z of order) {
  const zx0 = z.c * N, zy0 = z.r * N;
  out.push(`${z.id}:`, `  name: ${q(z.name)}`, '  kind: dungeon', '  open: true', `  world: [${z.r}, ${z.c}]`, `  blurb: ${q(z.blurb)}`, `  level: ${z.level}`,
    `  look: ${flow(Object.assign({}, z.fam.look, { tileset: z.fam.tileset, ground: z.fam.look.ground === '.' ? undefined : z.fam.look.ground }))}`, '  map:');
  for (let y = 0; y < N; y++) { let row = ''; for (let x = 0; x < N; x++) row += CH[I(zx0 + x, zy0 + y)]; out.push(`    - ${q(row)}`); }
  out.push('  legend:');
  const lg = legendOf[z.key] || {};
  const onMap = new Set(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) onMap.add(CH[I(zx0 + x, zy0 + y)]);
  for (const [k, d] of Object.entries(lg)) if (onMap.has(k)) out.push(`    ${q(k)}: ${flow(noFloor(d))}`);
  out.push('  encounters:' + (z.encounters && Object.keys(z.encounters).length ? '' : ' {}'));
  for (const [k, e] of Object.entries(z.encounters || {})) out.push(`    ${k}: ${flow(e)}`);
  if (z.wandering) { out.push('  wandering:'); for (const w of z.wandering) out.push(`    - ${flow(w)}`); }
  out.push('');
}
fs.writeFileSync(outPath, out.join('\n'));

// ---- The gap report ---------------------------------------------------------------------------------------------------------
const famCount = {}, kl = {};
for (const z of order) { famCount[z.famId] = (famCount[z.famId] || 0) + 1; for (const [k, n] of Object.entries(z.kludge)) { const e = (kl[z.famId + ': ' + k] = kl[z.famId + ': ' + k] || { n: 0, z: [] }); e.n += n; e.z.push(z.id); } }
const gaps = ['# Gaps in the open world\'s art (generated by tools/worldgen.js; ' + new Date().toISOString().slice(0, 10) + ')', '',
  `${order.length} places from ${path.relative(repo, layoutPath)}: ` + Object.entries(famCount).map(([f, n]) => `${n} ${f}`).join(', ') + '.', '',
  '## Terrain drawn with a stand-in', '', '| Family: terrain | Squares | Places |', '|---|---|---|',
  ...Object.entries(kl).sort((a, b) => b[1].n - a[1].n).map(([k, e]) => `| ${k} | ${e.n} | ${e.z.length} |`), ''];
const spriteMiss = {};
for (const z of order) { const ts = G.Content.world.tilesets[z.fam.tileset]; for (const d of Object.values(legendOf[z.key] || {})) { const s = typeof d.sprite === 'string' ? d.sprite : null; if (s && s !== 'none' && d.kind !== 'npc' && !(ts.props || {})[s]) (spriteMiss[s + ' in ' + z.fam.tileset] = spriteMiss[s + ' in ' + z.fam.tileset] || []).push(z.id); } }
if (Object.keys(spriteMiss).length) gaps.push('## Sprites a family has no picture for (drawn as a stone block)', '', ...Object.entries(spriteMiss).map(([k, v]) => `- ${k}: ${v.join(', ')}`), '');
if (L.gaps) gaps.push('## Known kludges (from the layout\'s `gaps`)', '', ...L.gaps.map((g) => `- ${g}`), '');
fs.writeFileSync(path.join(path.dirname(layoutPath), path.basename(layoutPath).replace(/-layout\.yaml$/, '') + '-gaps.md'), gaps.join('\n'));

// ---- Preview: the world as one picture, and the data for the map page ------------------------------------------------------
// Preview colours: a ground letter's colour; the floor (`.`) by family; a legend entry its ground's, a door red, a fight orange.
const floorColour = (z) => z.famId === 'w1_jungle' ? '#4a3a28' : z.famId === 'w1_desert' ? '#d8b878' : '#9a6a44';
const groundColour = (z, ch) => ch === '.' ? floorColour(z) : (GROUND[ch] && GROUND[ch].color) || '#ff00ff';
const colour = (ch, z) => {
  const lg = z && legendOf[z.key] && legendOf[z.key][ch];
  if (lg) {
    if (lg.kind === 'stairs' && !EXIT.N.concat(EXIT.S, EXIT.E, EXIT.W).includes(ch)) return '#ff3030';
    if (['monster', 'chest', 'trap', 'note', 'npc'].includes(lg.kind)) return '#ff9020';
    return groundColour(z, lg.on || z.fam.look.ground);
  }
  if (ch === '#') return '#6a6a6a';
  return groundColour(z, ch);
};
const pv = opt('--preview');
if (pv) {
  const buf = Buffer.alloc(GW * GH * 3);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const z = zoneAt(gx, gy); let hex = z ? colour(CH[I(gx, gy)], z) : '#1a2a40';
    if (z && (gx % N === 0 || gy % N === 0)) hex = '#000000';
    const v = parseInt(hex.slice(1), 16), i = (gy * GW + gx) * 3; buf[i] = v >> 16; buf[i + 1] = (v >> 8) & 255; buf[i + 2] = v & 255;
  }
  fs.writeFileSync(pv, Buffer.concat([Buffer.from(`P6\n${GW} ${GH}\n255\n`), buf]));
}
const js = opt('--json');
if (js) {
  const palette = {}; const zonesOut = {};
  for (const z of order) { const zx0 = z.c * N, zy0 = z.r * N, rowsOut = []; for (let y = 0; y < N; y++) { let row = ''; for (let x = 0; x < N; x++) { const ch = CH[I(zx0 + x, zy0 + y)]; palette[z.famId + ch] = palette[z.famId + ch] || colour(ch, z); row += ch; } rowsOut.push(row); }
    const lg = {}; for (const [k, d] of Object.entries(legendOf[z.key] || {})) if (rowsOut.some((r) => r.includes(k))) lg[k] = [d.kind, d.label || d.sprite || ''];
    zonesOut[z.id] = { r: z.r, c: z.c, name: z.name, level: z.level, fam: z.famId, rows: rowsOut, blurb: z.blurb, legend: lg, sites: sites.filter((s) => zoneAt(...s.g) === z).map((s) => s.id) }; }
  fs.writeFileSync(js, JSON.stringify({ N, cols, rows, lon0, lat0, step, palette, zones: zonesOut, sites: sites.map((s) => ({ id: s.id, at: s.at, g: s.g })) }));
}
console.log(`${order.length} places (${Object.entries(famCount).map(([f, n]) => n + ' ' + f).join(', ')}); ${roadsLaid} roads, ${carved} ways cut, ${filled} squares flooded, settled in ${settle} rounds, ${misfitLeft} cliff corners no tile fits`);
for (const [id, ms] of Object.entries(misfits)) console.log(`  ${id}: ` + ms.slice(0, 6).map((m) => `${m.x},${m.y} ${m.t} ${m.g.match(/..../g).join(' ')}`).join('; '));
console.log('recruits: ' + recruits.sort((a, b) => a.n - b.n).map((r) => `${r.n} ${r.place} [${r.at}]`).join('; '));
console.log('entrances: ' + sites.flatMap((s) => Object.entries(s.legend || {}).filter(([, d]) => d.kind === 'stairs').map(([k, d]) => `${zoneAt(...s.g).id} ${k} -> ${d.to}`)).join('; '));
