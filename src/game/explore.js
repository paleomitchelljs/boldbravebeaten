/*
 * Exploring a dungeon: a grid map walked one square at a time, seen first-person.
 * DOM-free. The UI calls move()/turn()/interact()/act() and shows the events they return.
 *
 * Map characters: # wall, . floor, + door, space = rock; the ground letters of rules.yaml game.ground (grass, water,
 * bridges…) mean the same on every map; anything else is defined in the place's `legend` (see data/places.yaml). Persistent per-square state lives in world.maps[place].ents["x,y"]:
 *   open, found, done, sprung, disarmed, opened, woken, alerted, unseen, pacified, passive…
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const R = G.Rand;
  const W = G.World;
  const S = G.Skills;

  const cfg = () => G.CONFIG.game;
  const places = () => G.Content.world.places || {};
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
  const DIR_NAMES = ['north', 'east', 'south', 'west'];

  // ---- Parsed maps (cached by place and map text) ----------------------------
  const cache = {};
  function grid(placeId) {
    const p = places()[placeId];
    if (!p || !p.map) return null;
    // The same rows as last time: the cached grid. Only when they differ is the whole map joined to compare (the Test
    // bench edits a map in place); joining on every call made each square looked at cost the whole map.
    const c0 = cache[placeId];
    if (c0 && c0.rows === p.map && c0.len === p.map.length) return c0;
    const key = placeId + '|' + p.map.join('');
    if (c0 && c0.key === key) { c0.rows = p.map; c0.len = p.map.length; return c0; }
    const rows = p.map;
    const under = p.look && p.look.ground ? groundOf(p.look.ground) : null;
    return (cache[placeId] = { key, rows, len: rows.length, w: rows[0].length, h: rows.length, legend: p.legend || {}, under });
  }

  // The ground a letter stands for (rules.yaml game.ground), with its letter; null for none.
  function groundOf(ch) {
    const d = (cfg().ground || {})[ch];
    return d ? Object.assign({ ch }, d) : null;
  }

  const place = (world) => places()[world.place];
  // How far the party sees: the place's look.light (an open court in daylight), else the torch's game.lightRadius.
  const lightRadius = (world) => { const p = place(world); return (p && p.look && p.look.light) || cfg().lightRadius; };
  const here = (world) => grid(world.place);
  const ents = (world, placeId) => W.mapState(world, placeId || world.place).ents;
  const posKey = (x, y) => x + ',' + y;
  // Reading a square's state creates it, except while drawing (peek), which must not grow the save.
  const NO_STATE = Object.freeze({});
  let peeking = false;
  function state(world, x, y) {
    const e = ents(world);
    if (peeking) return e[posKey(x, y)] || NO_STATE;
    return e[posKey(x, y)] || (e[posKey(x, y)] = {});
  }
  // A fingerprint of the squares of a place that have state (a door open, a secret found, a lock picked), for a map
  // view to know when what it has drawn of the ground and walls is out of date. Squares merely looked at keep an empty
  // state, which doesn't count. Worked out again only when the world has moved on (the clock or the log: opening a
  // door, finding a secret or picking a lock takes time and says so), not on every frame.
  const tileKeys = new WeakMap();
  function tileKey(world, placeId) {
    const e = ents(world, placeId), last = world.log[world.log.length - 1];
    const sig = world.minutes + '|' + world.log.length + '|' + (last ? last.text : '');
    const m = tileKeys.get(e);
    if (m && m.sig === sig) return m.key;
    const parts = [];
    for (const k of Object.keys(e)) for (const f in e[k]) { parts.push(k + JSON.stringify(e[k])); break; }
    const key = (placeId || world.place) + '|' + parts.join(';');
    tileKeys.set(e, { sig, key });
    return key;
  }

  function peek(world, x, y) {
    peeking = true;
    try { return cell(world, x, y); } finally { peeking = false; }
  }

  // ---- Cells -----------------------------------------------------------------
  // Returns { ch, def, kind, solid, opaque, st, ground } for a square. `ground` is what it stands on (rules.yaml
  // game.ground), when that is more than plain floor. Deep water is kind 'water': solid to walkers, open to the eye.
  function cell(world, x, y) {
    const g = here(world);
    if (!g || x < 0 || y < 0 || x >= g.w || y >= g.h) return { ch: ' ', kind: 'rock', solid: true, opaque: true };
    const ch = g.rows[y][x];
    if (ch === ' ') return { ch, kind: 'rock', solid: true, opaque: true };
    if (ch === '#') return { ch, kind: 'wall', solid: true, opaque: true };
    const gr = groundOf(ch);
    if (gr) {
      if (gr.wall) return { ch, kind: 'wall', solid: true, opaque: true, ground: gr };
      if (gr.walk === false) return { ch, kind: 'water', solid: true, opaque: false, ground: gr };
      return { ch, kind: 'floor', solid: false, opaque: false, st: state(world, x, y), ground: gr };
    }
    const c = square(world, g, ch, x, y);
    if (c.kind !== 'wall' && c.kind !== 'rock') { const on = c.def && c.def.on ? groundOf(c.def.on) : g.under; if (on) c.ground = on; }
    return c;
  }

  function square(world, g, ch, x, y) {
    const st = state(world, x, y);
    if (ch === '.') return { ch, kind: 'floor', solid: false, opaque: false, st };
    if (ch === '+') return st.open ? { ch, kind: 'floor', solid: false, opaque: false, st } : { ch, kind: 'door', solid: true, opaque: true, st };
    const def = g.legend[ch];
    if (!def) return { ch, kind: 'floor', solid: false, opaque: false, st };
    switch (def.kind) {
      case 'secret': return st.found ? (st.open ? { ch, def, kind: 'floor', solid: false, opaque: false, st } : { ch, def, kind: 'door', solid: true, opaque: true, st }) : { ch, def, kind: 'wall', solid: true, opaque: true, st, hidden: true };
      // A portcullis (`see`) shuts the way but not the view; `opensWhen` raises it once its condition holds.
      case 'locked': return st.open || (def.opensWhen && G.Cond.test(world, def.opensWhen)) ? { ch, def, kind: 'floor', solid: false, opaque: false, st } : { ch, def, kind: 'locked', solid: true, opaque: !def.see, st };
      case 'chest': return { ch, def, kind: 'chest', solid: true, opaque: false, st };
      case 'npc': return { ch, def, kind: 'npc', solid: true, opaque: false, st };
      case 'shrine': return { ch, def, kind: 'shrine', solid: true, opaque: false, st };
      case 'monster': return { ch, def, kind: 'monster', solid: !st.done && !st.pacified && !world.peaceful, opaque: false, st };
      case 'prop': return { ch, def, kind: 'prop', solid: def.solid !== false, opaque: false, st };
      // A trap found and still live stands in the way: getting past it is a choice (describe, act).
      case 'trap': return { ch, def, kind: 'trap', solid: !!(st.found && live(world, def, st)), opaque: false, st };
      default: return { ch, def, kind: def.kind, solid: false, opaque: false, st };
    }
  }

  const opaque = (world, x, y) => cell(world, x, y).opaque;

  // Bresenham line of sight; the endpoints themselves don't block.
  function lineClear(world, x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    while (!(x === x1 && y === y1)) {
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if (!(x === x1 && y === y1) && opaque(world, x, y)) return false;
    }
    return true;
  }

  // Distance on the map: the fight's measure (Combat.dist, rounded Euclidean), for notice, waking and search.
  const dist = (a, b) => G.Combat.dist(a, b);

  // What the party sees from where it stands (or from `at`: a fighter's square in a fight on the map).
  function markSeen(world, at) {
    const ex = at || world.explore;
    const ms = W.mapState(world, world.place);
    // An open place (outdoors: `open: true`) hides nothing: all of it is seen the first time the party is there.
    const pl = places()[world.place];
    if (pl && pl.open) {
      if (ms.allSeen) return;
      const g = here(world);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) ms.seen[posKey(x, y)] = 1;
      ms.allSeen = 1;
      return;
    }
    const r = lightRadius(world);
    for (let y = ex.y - r; y <= ex.y + r; y++) {
      for (let x = ex.x - r; x <= ex.x + r; x++) {
        const g = here(world);
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
        if ((x - ex.x) ** 2 + (y - ex.y) ** 2 > r * r + 1) continue;
        if (lineClear(world, ex.x, ex.y, x, y)) ms.seen[posKey(x, y)] = 1;
      }
    }
  }

  // The ways out on a place's edge (a stairs square, or a note drawn as nothing, in its first or last row or column), each with the way it leads
  // off the map: [{x, y, dx, dy}]. The map draws the ground running on past the edge there, and a click beyond the
  // edge walks to the nearest.
  const exitCache = {};
  function exits(placeId) {
    // Cached on the map's own rows (grid() joins the whole map to check its cache, too slow for every square drawn).
    const map = (places()[placeId] || {}).map;
    if (!map) return [];
    if (exitCache[placeId] && exitCache[placeId].map === map) return exitCache[placeId].list;
    const g = grid(placeId);
    const list = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const def = g.legend[g.rows[y][x]];
      // A road's end marked with a note drawn as nothing counts too (the road runs on to a place not built yet).
      if (!def || !(def.kind === 'stairs' || (def.kind === 'note' && def.sprite === 'none'))) continue;
      const d = x === 0 ? [-1, 0] : x === g.w - 1 ? [1, 0] : y === 0 ? [0, -1] : y === g.h - 1 ? [0, 1] : null;
      if (d) list.push({ x, y, dx: d[0], dy: d[1] });
    }
    exitCache[placeId] = { map, list };
    return list;
  }

  // The exit whose road runs on through square x, y off the map (up to `reach` squares past the edge), if any.
  function beyond(placeId, x, y, reach) {
    for (const e of exits(placeId)) {
      const k = e.dx ? (x - e.x) * e.dx : (y - e.y) * e.dy;
      if (k >= 1 && k <= (reach || 3) && (e.dx ? y === e.y : x === e.x)) return e;
    }
    return null;
  }

  // ---- Entering and leaving ----------------------------------------------------
  function findChar(placeId, ch) {
    const g = grid(placeId);
    if (!g) return null;
    for (let y = 0; y < g.h; y++) { const x = g.rows[y].indexOf(ch); if (x >= 0) return { x, y }; }
    return null;
  }

  // Where you come in. Off one place's edge into the next (`from`: the place and square you left by), the square across
  // from it: of the ways back on the facing edge, the one nearest the same distance along. Else the first `arrive`.
  function arrival(placeId, arrive, from) {
    const g = grid(placeId), fg = from && from.place && grid(from.place);
    if (g && fg) {
      const d = from.x === 0 ? 'W' : from.x === fg.w - 1 ? 'E' : from.y === 0 ? 'N' : from.y === fg.h - 1 ? 'S' : null;
      if (d) {
        const across = d === 'W' || d === 'E', n = across ? g.h : g.w;
        const want = (across ? from.y / Math.max(1, fg.h - 1) : from.x / Math.max(1, fg.w - 1)) * (n - 1);
        let best = null, bd = Infinity;
        for (let k = 0; k < n; k++) {
          const x = across ? (d === 'W' ? g.w - 1 : 0) : k, y = across ? k : (d === 'N' ? g.h - 1 : 0);
          const def = g.legend[g.rows[y][x]];
          if (!def || def.kind !== 'stairs' || def.to !== from.place) continue;
          if (Math.abs(k - want) < bd) { bd = Math.abs(k - want); best = { x, y }; }
        }
        if (best) return best;
      }
    }
    const at = findChar(placeId, arrive || '<');
    if (at || !g) return at;
    // No such square (a debug jump to a place with no '<'): its first way in or out.
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const def = g.legend[g.rows[y][x]]; if (def && def.kind === 'stairs') return { x, y }; }
    return null;
  }

  // Walk out of the entry stairs facing into the map.
  function enter(world, placeId, arrive, from) {
    const p = places()[placeId];
    world.place = placeId;
    world.location = null;
    if (!p || !p.map) { world.explore = null; return; }
    const at = arrival(placeId, arrive, from) || { x: 1, y: 1 };
    let dir = 0;
    for (let d = 0; d < 4; d++) {
      const nx = at.x + DIRS[d][0], ny = at.y + DIRS[d][1];
      if (!cell(world, nx, ny).solid && cell(world, nx, ny).kind !== 'wall') { dir = d; break; }
    }
    world.explore = { x: at.x, y: at.y, dir, sneak: false, clock: world.minutes, danger: 0 };
    if (!W.mapState(world, placeId).visited) { W.mapState(world, placeId).visited = true; W.logLine(world, `You enter ${p.name}.`, 'info'); }
    markSeen(world);
  }

  function leave(world, toPlace, arrive) {
    const p = places()[toPlace];
    if (p && p.kind === 'town') { world.place = toPlace; world.explore = null; world.location = null; W.logLine(world, `You return to ${p.name}.`, 'info'); }
    else enter(world, toPlace, arrive);
  }

  // ---- Movement ------------------------------------------------------------------
  const front = (world) => {
    const ex = world.explore;
    return { x: ex.x + DIRS[ex.dir][0], y: ex.y + DIRS[ex.dir][1] };
  };

  // Pathfinder (feat): a quarter less time a step.
  function minutesPerStep(world) {
    const path = W.active(world).some((c) => C.rank(c, 'pathfinder')) ? 0.75 : 1;
    return (world.explore && world.explore.sneak ? cfg().sneakStepSeconds : cfg().stepSeconds) / 60 * path;
  }

  // ---- The dungeon's clock: time and noise draw wanderers (rules.yaml game.wanderers) -----------------------------
  // Every minute passed in this place since the last look, whatever passed it, counts toward the next check, as
  // does noise. A camp has its own roll and starts the count afresh (settleClock).
  function noise(world, kind) {
    const ex = world.explore, n = ((cfg().wanderers || {}).noise || {})[kind] || 0;
    if (ex && n) ex.danger = (ex.danger || 0) + n;
  }
  function settleClock(world) { if (world.explore) world.explore.clock = world.minutes; }

  // Emits 'wander' ({ spec, check, surprise }) when a wandering group finds the party.
  function wanderCheck(world, ev) {
    const ex = world.explore, cw = cfg().wanderers;
    if (!ex || !cw || world.peaceful) return;
    if (ex.clock == null) ex.clock = world.minutes;
    ex.danger = (ex.danger || 0) + Math.max(0, world.minutes - ex.clock);
    ex.clock = world.minutes;
    while (ex.danger >= cw.every) {
      ex.danger -= cw.every;
      if (!R.chance(cw.chance)) continue;
      const w = wanderingFor(world);
      if (!w || w.nothing) continue;
      const party = W.active(world);
      // Tracker (feat): heard first, so never surprised, and a chance to slip away even when not sneaking.
      const track = party.some((c) => C.rank(c, 'tracker'));
      if (ex.sneak || track) {
        const r = S.groupCheck(party, 'stealth', foeAwareness({ foes: w.foes }), 0);
        ev.push({ type: 'check', r });
        if (r.ok) { ev.push({ type: 'log', text: `${w.text ? w.text + ' ' : ''}You keep still, and they pass you by.`, cls: 'find' }); continue; }
      }
      const heard = S.bestCheck(party, 'perception', cw.hearTn || 8, 0);
      ev.push({ type: 'wander', spec: { foes: w.foes, text: w.text, name: 'Wanderers' }, check: heard, surprise: heard.ok || track ? null : 'party' });
      ex.danger = 0;
      return;
    }
  }
  const met = (ev) => ev.some((e) => e.type === 'encounter' || e.type === 'unseen' || e.type === 'stairs' || e.type === 'fall');

  function turn(world, delta) {
    const ex = world.explore;
    ex.dir = (ex.dir + delta + 4) % 4;
    const ev = [];
    passive(world, ev);
    scan(world, ev);
    return { moved: false, events: ev };
  }

  // forward 0, right 1, back 2, left 3 (relative to facing)
  function move(world, rel) {
    const ex = world.explore;
    const d = (ex.dir + rel) % 4;
    const nx = ex.x + DIRS[d][0], ny = ex.y + DIRS[d][1];
    const ev = [];
    // Off the map's edge from a way across: into the next place.
    const way = edgeWay(world.place, ex.x, ex.y);
    if (way && way.dx === DIRS[d][0] && way.dy === DIRS[d][1]) {
      const g = here(world);
      if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) return { moved: false, events: [{ type: 'cross', def: g.legend[g.rows[ex.y][ex.x]] }] };
    }
    const c = cell(world, nx, ny);
    if (c.kind === 'wall' || c.kind === 'rock') return { moved: false, events: [{ type: 'bump', text: c.ground ? `${c.ground.name}.` : 'A wall.' }] };
    if (c.kind === 'water') return { moved: false, events: [{ type: 'bump', text: `${c.ground.name}: no way across here.` }] };
    if (c.kind === 'door') {
      c.st.open = true;
      W.advance(world, minutesPerStep(world));
      ev.push({ type: 'log', text: 'You open the door.' });
      markSeen(world);
      scan(world, ev);
      if (!met(ev)) wanderCheck(world, ev);
      return { moved: false, events: ev };
    }
    if (c.solid) {
      // Something to deal with: face it and let the UI offer actions.
      ex.dir = d;
      ev.push({ type: 'prompt', target: { x: nx, y: ny } });
      return { moved: false, events: ev };
    }
    ex.x = nx; ex.y = ny;
    W.advance(world, minutesPerStep(world));
    const pending = enterSquare(world, c, nx, ny, ev);
    markSeen(world);
    passive(world, ev);
    scan(world, ev);
    if (!met(ev)) wanderCheck(world, ev);
    return pending ? { moved: true, events: ev, pending } : { moved: true, events: ev };
  }

  // The compass steps from the party to (tx, ty) over squares it has seen and can walk (doors open as it goes).
  // Returns [] when there is no way, or the target is a thing to deal with rather than walk onto.
  function path(world, tx, ty) {
    const ex = world.explore;
    const ms = W.mapState(world, world.place);
    const g = here(world);
    if (tx === ex.x && ty === ex.y) return [];
    const ok = (x, y) => {
      if (x < 0 || y < 0 || x >= g.w || y >= g.h || !ms.seen[posKey(x, y)]) return false;
      const c = peek(world, x, y);
      if (c.kind === 'door') return true;
      if (c.kind === 'trap' && c.st.found && live(world, c.def, c.st)) return false;
      return !c.solid && c.kind !== 'wall' && c.kind !== 'rock';
    };
    if (!ok(tx, ty)) return [];
    const prev = { [posKey(ex.x, ex.y)]: null }, q = [[ex.x, ex.y]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1], k = posKey(nx, ny);
        if (k in prev || !ok(nx, ny)) continue;
        prev[k] = { from: posKey(x, y), d };
        q.push([nx, ny]);
      }
    }
    if (!(posKey(tx, ty) in prev)) return [];
    const out = [];
    for (let k = posKey(tx, ty); prev[k]; k = prev[k].from) out.unshift(prev[k].d);
    return out;
  }

  // Top-down walking: face a compass direction (0 N, 1 E, 2 S, 3 W) and step that way.
  function go(world, d) {
    world.explore.dir = ((d % 4) + 4) % 4;
    return move(world, 0);
  }

  // Returns a promise of more events when a trap springs (its blow is the combat engine's, which is async).
  function enterSquare(world, c, x, y, ev) {
    if (c.kind === 'trap' && live(world, c.def, c.st)) {
      // A party that has seen the tell walks on wary: the one who sets it off may get clear.
      if (!world.peaceful) return springTrap(world, { def: c.def, st: c.st }, x, y, ev, { aware: !!c.st.wary });
    } else if (c.kind === 'pickup' && !c.st.done) {
      c.st.done = true;
      W.addGood(world, c.def.good, 1);
      ev.push({ type: 'log', text: `${c.def.text ? c.def.text + ' ' : ''}You take the ${W.goodDef(c.def.good).name}.`, cls: 'loot' });
      updateQuests(world, ev);
    } else if (c.kind === 'note' && !c.st.done) {
      c.st.done = true;
      ev.push({ type: 'note', text: c.def.text });
      if (c.def.sets) for (const f of c.def.sets) W.setFlag(world, f);
    } else if ((c.kind === 'stairs' && !edgeWay(world.place, x, y)) || c.kind === 'drop') {
      ev.push({ type: 'stairs', def: c.def, x, y });
    }
  }

  // An open world's way across (a stairs square on the map's edge drawn as nothing, `edge: true`): no prompt on
  // stepping onto it; a step on, off the map, crosses. Returns the way off the map it leads ({dx, dy}), or null.
  function edgeWay(placeId, x, y) {
    const g = grid(placeId), def = g && x >= 0 && y >= 0 && x < g.w && y < g.h ? g.legend[g.rows[y][x]] : null;
    if (!def || def.kind !== 'stairs' || !(def.edge || def.sprite === 'none')) return null;
    const to = places()[def.to];
    if (!to || !to.open || !(places()[placeId] || {}).open) return null;
    return x === 0 ? { dx: -1, dy: 0 } : x === g.w - 1 ? { dx: 1, dy: 0 } : y === 0 ? { dx: 0, dy: -1 } : y === g.h - 1 ? { dx: 0, dy: 1 } : null;
  }

  // ---- The open world: the places round this one ----------------------------------------------------------
  // Places with `world: [row, col]` lie side by side; past one's edge is the next one's map. A square off the map
  // (x, y in this place's squares) as the place beside it has it, for drawing: {ch, kind, ground}; the sea where no
  // place is; null if this place is not in the open world.
  let worldIndex = null, worldFor = null;
  function placeAt(r, c) {
    const all = places();
    if (worldFor !== all) { worldIndex = {}; worldFor = all; for (const [id, p] of Object.entries(all)) if (p.world) worldIndex[p.world[0] + ',' + p.world[1]] = id; }
    return worldIndex[r + ',' + c] || null;
  }
  function across(placeId, x, y) {
    const p = places()[placeId];
    if (!p || !p.world) return null;
    const g = grid(placeId);
    const dc = Math.floor(x / g.w), dr = Math.floor(y / g.h);
    const sea = { ch: '~', kind: 'water', ground: groundOf('~') };
    const id = placeAt(p.world[0] + dr, p.world[1] + dc), o = id && grid(id);
    if (!o) return sea;
    const ox = x - dc * g.w, oy = y - dr * g.h;
    if (ox < 0 || oy < 0 || ox >= o.w || oy >= o.h) return sea;
    const ch = o.rows[oy][ox];
    if (ch === '#') return { ch, kind: 'wall', ground: groundOf(ch) };
    const gr = groundOf(ch);
    if (gr) return { ch, kind: gr.wall ? 'wall' : gr.walk === false ? 'water' : 'floor', ground: gr };
    const def = o.legend[ch];
    const on = def && def.on ? groundOf(def.on) : o.under;
    // A tree or a boulder there is drawn too (not monsters, people or doors: only what stands still in the land).
    if (def && def.kind === 'prop' && def.sprite && def.sprite !== 'none') return { ch, kind: 'prop', def, ground: on || null, st: {} };
    return { ch: '.', kind: 'floor', ground: on || null };
  }

  // A one-way drop (a well, a hole): its text, and any harm from the fall, before the party arrives below.
  function fall(world, def) {
    if (def.text) W.logLine(world, def.text, 'info');
    for (const v of W.active(world)) {
      // damage {ATTR: n}: n points of harm where wounds.attrPlace puts that attribute (CON: the torso).
      for (const [a, n] of Object.entries(def.damage || {})) { C.harm(v, n, G.CONFIG.wounds.attrPlace[a] || 'torso', 'fall'); W.logLine(world, `${v.name} is hurt in the fall (${n} harm).`, 'hurt'); }
      C.updateCondition(v);
    }
  }

  function updateQuests(world, ev) {
    for (const t of W.updateQuests(world)) ev.push({ type: 'log', text: t, cls: 'quest' });
  }

  // ---- Traps: what they are on a square ------------------------------------------------------------
  const TK = () => cfg().traps || {};
  // The trap on a square, if any: a trap square, or a chest's lid trap (its state kept under the chest's, st.trap).
  function trapOf(c) {
    if (!c || !c.def) return null;
    if (c.kind === 'trap') return { def: c.def, st: c.st };
    if (c.kind === 'chest' && c.def.trap && c.st) {
      const st = c.st.trap || (Object.isFrozen(c.st) ? {} : (c.st.trap = {}));
      return { def: c.def.trap, st, lid: true };
    }
    return null;
  }
  // Still able to spring: not disarmed, and not sprung (or sprung and set again: reset.minutes since).
  function live(world, def, st) {
    if (!st || st.disarmed) return false;
    if (!st.sprung) return true;
    const m = def && def.reset && def.reset.minutes;
    return m != null && st.sprungAt != null && world.minutes - st.sprungAt >= m;
  }
  // How far the party has found a trap: 0 nothing, 1 the tell, 2 the square, 3 the square and its working.
  const degreeOf = (st) => (st.known ? 3 : st.found ? 2 : st.wary ? 1 : 0);
  // The degree a Perception check's margin gives (rules.yaml game.traps.find).
  function degreeFor(margin) {
    const F = TK().find || { tell: -3, square: 0, mechanism: 3 };
    return margin >= F.mechanism ? 3 : margin >= F.square ? 2 : margin >= F.tell ? 1 : 0;
  }
  // The party comes to know a trap to degree d (never less than it knew). Logs what it now knows.
  function learn(world, t, d, ev, how) {
    if (d <= degreeOf(t.st)) return;
    const label = (t.def.label || 'a trap');
    if (d >= 1) t.st.wary = true;
    if (d >= 2) t.st.found = true;
    if (d >= 3) t.st.known = true;
    const text = d === 1 ? `Something is off here: ${t.def.tell || 'you cannot say what'}`
      : d === 2 ? `You spot a trap${t.lid ? ' on the chest' : ' ahead'}: ${label.toLowerCase()}. What sets it off, you cannot tell.`
      : `${how === 'know' ? 'You know this one' : `You spot a trap${t.lid ? ' on the chest' : ' ahead'} and see how it works`}: ${label.toLowerCase()}. ${G.Traps.describe(t.def)}`;
    ev.push({ type: 'log', text, cls: 'find' });
  }

  // ---- Perception: hidden traps and doors ---------------------------------------
  function hiddenNear(world) {
    const ex = world.explore;
    const out = [];
    for (let d = 0; d < 4; d++) {
      const x = ex.x + DIRS[d][0], y = ex.y + DIRS[d][1];
      const c = cell(world, x, y);
      if (c.hidden) out.push({ x, y, c });
    }
    return out;
  }

  const revealed = (world, def) => def && def.reveal && G.Cond.test(world, def.reveal);

  // The live traps within r squares the party has not fully made out: [{x, y, t, d}].
  function trapsNear(world, r) {
    const ex = world.explore, out = [];
    for (let y = ex.y - r; y <= ex.y + r; y++) for (let x = ex.x - r; x <= ex.x + r; x++) {
      const c = cell(world, x, y), t = trapOf(c);
      if (!t || !live(world, t.def, t.st) || degreeOf(t.st) >= 3) continue;
      out.push({ x, y, t, d: dist(ex, { x, y }) });
    }
    return out;
  }

  // Walking past: hidden doors in the four squares around (one look each); traps in sight within game.traps.notice
  // (one look from there, one more from beside it), each found to the degree the margin gives. Knowing beats looking.
  function passive(world, ev) {
    for (const h of hiddenNear(world)) {
      if (h.c.st.passive) continue;
      if (revealed(world, h.c.def)) { h.c.st.found = true; ev.push({ type: 'log', text: `You know to look for it: ${h.c.def.label || 'something'}.`, cls: 'find' }); continue; }
      h.c.st.passive = true;
      const r = S.groupCheck(W.active(world), 'perception', h.c.def.tn || 8, -cfg().passivePenalty);
      if (r.ok) { h.c.st.found = true; ev.push({ type: 'log', text: 'A seam in the wall: a hidden door.', cls: 'find' }); }
    }
    const ex = world.explore;
    for (const n of trapsNear(world, TK().notice || 1)) {
      if (revealed(world, n.t.def)) { learn(world, n.t, 3, ev, 'know'); continue; }
      const near = n.d <= 1;
      if (near ? n.t.st.passiveNear : n.t.st.passive) continue;
      if (!lineClear(world, ex.x, ex.y, n.x, n.y)) continue;
      n.t.st.passive = true;
      if (near) n.t.st.passiveNear = true;
      const r = S.groupCheck(W.active(world), 'perception', n.t.def.tn || 8, -cfg().passivePenalty);
      learn(world, n.t, degreeFor(r.margin), ev);
    }
  }

  // An active search: slower, better, and covers a wider area.
  function search(world) {
    const ex = world.explore;
    const ev = [];
    W.advance(world, cfg().searchMinutes);
    let found = 0;
    const bonus = cfg().searchBonus == null ? 3 : cfg().searchBonus;
    for (let y = ex.y - 2; y <= ex.y + 2; y++) for (let x = ex.x - 2; x <= ex.x + 2; x++) {
      const c = cell(world, x, y);
      if (!c.hidden || !lineClear(world, ex.x, ex.y, x, y) && dist(ex, { x, y }) > 1) continue;
      const r = S.groupCheck(W.active(world), 'perception', c.def.tn || 8, bonus);
      if (r.ok || revealed(world, c.def)) { c.st.found = true; found++; ev.push({ type: 'log', text: 'A seam in the wall: a hidden door.', cls: 'find' }); }
    }
    for (const n of trapsNear(world, 2)) {
      if (!lineClear(world, ex.x, ex.y, n.x, n.y) && n.d > 1) continue;
      const before = degreeOf(n.t.st);
      if (revealed(world, n.t.def)) learn(world, n.t, 3, ev, 'know');
      else learn(world, n.t, degreeFor(S.groupCheck(W.active(world), 'perception', n.t.def.tn || 8, bonus).margin), ev);
      if (degreeOf(n.t.st) > before) found++;
    }
    if (!found) ev.push({ type: 'log', text: 'You search carefully and find nothing new.' });
    wanderCheck(world, ev);
    return { events: ev };
  }

  // ---- Traps: sprung ------------------------------------------------------------------------
  // The trap t ({def, st}) at (x, y) springs. Its victims are the party's in marching order (Traps.victims), or
  // opts.victims; opts.aware: they know it is coming (a get-clear roll), opts.extra: Traps.avoidBonus's extra.
  // The blow goes through the combat engine on a scratch encounter, then the party binds its wounds (World.breather).
  // Returns a promise of the log events of the harm (the rest are pushed on ev at once).
  function springTrap(world, t, x, y, ev, opts) {
    opts = opts || {};
    const def = t.def, E = def.effect || {};
    t.st.sprung = true;
    t.st.sprungAt = world.minutes;
    t.st.found = true; // everyone knows where it is now
    ev.push({ type: 'log', text: def.text || 'A trap springs.', cls: 'hurt' });
    ev.push({ type: 'trap' });
    noise(world, 'trap');
    const party = W.active(world);
    const victims = opts.victims || G.Traps.victims(def, party);
    const pending = strikeParty(world, def, victims, opts, posKey(x, y));
    // A pit that drops to another place: the floor gives way and the party goes down whether it likes it or not.
    if (E.to) ev.push({ type: 'fall', def: { kind: 'drop', to: E.to, at: E.at, label: def.label } });
    return pending;
  }

  const autoRoller = async (req) => Array.from({ length: req.count }, () => R.d(req.sides));
  async function strikeParty(world, def, victims, opts, key) {
    if (!victims.length) return [];
    const chars = {};
    for (const v of victims) { chars[v.id] = v; v.hero = !!world.hero; }
    const enc = G.Combat.createEncounter(def.label || 'Trap', victims.map((v) => v.id), chars, 5, 5);
    for (const v of victims) await G.Traps.strike(enc, chars, v, def, autoRoller, { aware: !!opts.aware, extra: opts.extra, key: world.place + ':' + key, from: { x: 2, y: 2 } });
    G.Combat.cleanup(enc, chars);
    W.breather(world);
    const out = enc.log.map((l) => ({ type: 'log', text: l.text, cls: l.cls === 'defend' ? 'find' : 'hurt' }));
    return out;
  }

  // ---- Awareness: sleeping and watching foes ----------------------------------------------
  function encounterSpec(world, def) {
    const p = place(world);
    const enc = (p.encounters || {})[def.encounter];
    if (enc) return enc;
    return { foes: [{ monster: def.encounter }] };
  }

  // The perception target number of a group (from the foes' WIS).
  function foeAwareness(spec) {
    let best = 4;
    for (const f of spec.foes || []) {
      if (f.monster) {
        const m = G.Enemies.MONSTERS[f.monster];
        const members = m.group ? m.group.map((k) => G.Enemies.MONSTERS[k]) : [m];
        for (const mm of members) best = Math.max(best, (mm.attrs && mm.attrs.WIS) || 4);
      } else best = Math.max(best, 5);
    }
    return 5 + Math.floor(best / 2);
  }

  // Called after every step and turn. Sleeping and watching foes within range roll to notice the
  // party (or the party's stealth holds). Emits 'encounter' (they know you are there) and
  // 'unseen' (you have not been noticed; the UI offers an ambush, a parley, or sneaking on).
  function scan(world, ev) {
    if (world.peaceful) return;  // the debug tools' no-fights mode: foes and traps leave the party alone
    const ex = world.explore;
    const g = here(world);
    const me = { x: ex.x, y: ex.y };
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const def = g.legend[g.rows[y][x]];
        if (!def || def.kind !== 'monster') continue;
        const st = state(world, x, y);
        if (st.done || st.pacified) continue;
        // An encounter whose peace flag is already set (the gnomes trust you, so their machines do) stands down unfought.
        const peace = encounterSpec(world, def);
        if (peace && peace.peaceFlags && peace.peaceFlags.some((f) => world.flags[f])) { st.pacified = true; continue; }
        const d = dist(me, { x, y });
        const sleeping = def.asleep && !st.woken;
        const range = sleeping ? cfg().sleepNoticeDistance : cfg().noticeDistance;
        if (d > range + 1) { st.unseen = false; st.alerted = false; st.closeRolled = false; continue; }
        if (d > range || !lineClear(world, me.x, me.y, x, y)) continue;
        const spec = encounterSpec(world, def);
        const stealthRoll = () => S.groupCheck(W.active(world), 'stealth', foeAwareness(spec) - (sleeping ? 3 : 0), 0);
        if (st.alerted) { ev.push({ type: 'encounter', x, y, def, aware: true }); continue; }
        if (st.unseen) {
          if (d > 1 || st.closeRolled) continue;
          st.closeRolled = true;
          const r = ex.sneak ? stealthRoll() : { ok: false };
          if (r.ok) { ev.push({ type: 'log', text: 'You hold your breath and they do not stir.' }); continue; }
          st.alerted = true; st.unseen = false; st.woken = true;
          ev.push({ type: 'encounter', x, y, def, aware: true, check: r.total != null ? r : null });
          continue;
        }
        // First contact.
        if (ex.sneak) {
          const r = stealthRoll();
          if (r.ok) { st.unseen = true; ev.push({ type: 'unseen', x, y, def, check: r }); }
          else { st.alerted = true; st.woken = true; ev.push({ type: 'encounter', x, y, def, aware: true, check: r }); }
        } else if (sleeping && d > 1) {
          st.unseen = true;
          ev.push({ type: 'unseen', x, y, def });
        } else {
          st.alerted = true; st.woken = true;
          ev.push({ type: 'encounter', x, y, def, aware: true });
        }
      }
    }
  }

  // ---- Facing a thing: what can be done ---------------------------------------------------
  function facing(world) {
    const f = front(world);
    const c = cell(world, f.x, f.y);
    return Object.assign({ x: f.x, y: f.y }, describe(world, c, f.x, f.y));
  }

  // The ways past a found trap the party can take now (rules.yaml game.traps.ways; the trap's `bypass`, `disarm`):
  // each an action with its check, or what it needs. `spring` is a pole, a stone or a shield, as the trigger allows.
  function trapWays(world, t, x, y) {
    const party = W.active(world), def = t.def, K = TK(), ways = K.ways || {};
    const out = [];
    const tnOf = (w, base) => (w && typeof w === 'object' && w.tn != null ? w.tn : base);
    if (def.disarm != null) out.push({ id: 'disarm', label: t.st.known ? 'Disarm it' : 'Disarm it (working it out as you go)', skill: (ways.disarm || {}).check || 'trapcraft', tn: def.disarm + (t.st.known ? 0 : K.unknownDisarm || 0), who: S.best(party, (ways.disarm || {}).check || 'trapcraft') });
    const list = (def.bypass || K.bypass || []).flatMap((w) => ((typeof w === 'string' ? w : w.way) === 'spring' ? ['pole', 'stone', 'shield'] : [w]));
    const fits = (way) => !way.triggers || (t.st.known && way.triggers.includes(def.trigger));
    const ex = world.explore;
    const dir = DIRS[ex.dir];
    const land = cell(world, x + dir[0], y + dir[1]);
    const landOk = !t.lid && !land.solid && land.kind !== 'wall' && land.kind !== 'rock' && land.kind !== 'water';
    const worst = (check) => able(party).slice().sort((a, b) => S.mod(a, check) - S.mod(b, check))[0];
    for (const w of list) {
      const id = typeof w === 'string' ? w : w.way;
      const way = ways[id] || {};
      if ((id === 'leap' || id === 'edge') && landOk) {
        out.push({ id, label: id === 'leap' ? 'Leap it (each of you)' : 'Edge round it (each of you)', skill: way.check || id, tn: tnOf(w, way.tn || 7), who: worst(way.check || id) });
      } else if (id === 'pole' && fits(way)) {
        const have = !way.good || W.goodCount(world, way.good) > 0;
        if (have) out.push({ id, label: t.lid ? 'Lift the lid with a pole (loud)' : 'Set it off with a pole (loud)' });
      } else if (id === 'stone' && !t.lid && fits(way)) {
        out.push({ id, label: 'Throw a stone to set it off (loud)' });
      } else if (id === 'shield' && !t.lid && fits(way) && (def.effect || {}).blow) {
        const bearer = party.find((m) => C.shieldReady(m));
        if (bearer) out.push({ id, label: `${bearer.name} sets it off under a shield (loud)`, who: bearer });
      } else if (id === 'mark' && !t.lid && !t.st.marked) out.push({ id, label: 'Mark it and leave it' });
    }
    return out;
  }
  const able = (chars) => chars.filter((c) => C.isActive(c));

  function describe(world, c, x, y) {
    const out = { kind: c.kind, label: (c.def && c.def.label) || c.kind, actions: [] };
    const party = W.active(world);
    const have = (item) => item && W.goodCount(world, item) > 0;
    switch (c.kind) {
      case 'locked': {
        const d = c.def;
        out.text = d.text || 'It is locked.';
        if (d.key && have(d.key)) out.actions.push({ id: 'key', label: `Unlock with the ${W.goodDef(d.key).name}` });
        if (d.tn && d.tn < 90) out.actions.push({ id: 'pick', label: 'Pick the lock', skill: 'lockpicking', tn: d.tn + (c.st.jammed ? 2 : 0), who: S.best(party, 'lockpicking') });
        if (d.forceTn) out.actions.push({ id: 'force', label: 'Force it (loud)', skill: 'forcing', tn: d.forceTn, who: S.best(party, 'forcing') });
        (d.alt || []).forEach((a, i) => { if (G.Cond.test(world, a.requires)) out.actions.push({ id: 'alt', alt: i, label: a.label }); });
        break;
      }
      case 'chest': {
        out.text = c.st.opened ? 'Empty.' : 'A chest.';
        if (c.st.opened) break;
        const t = trapOf(c);
        if (t && t.st.found && live(world, t.def, t.st)) {
          out.text = `A chest, and a trap on it: ${(t.def.label || 'a trap').toLowerCase()}. ${t.st.known ? G.Traps.describe(t.def) : 'What it does, you cannot tell.'}`;
          out.actions.push(...trapWays(world, t, x, y));
        }
        if (c.def.tn && !c.st.unlocked) {
          out.actions.push({ id: 'pick', label: 'Pick the lock', skill: 'lockpicking', tn: c.def.tn, who: S.best(party, 'lockpicking') });
          out.actions.push({ id: 'force', label: 'Break it open (loud)', skill: 'forcing', tn: c.def.tn + 3, who: S.best(party, 'forcing') });
        } else out.actions.push({ id: 'open', label: 'Open it' });
        break;
      }
      case 'trap': {
        const t = trapOf(c);
        out.text = (t.st.known ? `${c.def.how ? c.def.how + ' ' : ''}${G.Traps.describe(c.def)}` : 'You have found it, but not how it works. Walking onto it would spring it.') + (t.st.marked ? ' You have marked it.' : '');
        out.actions.push(...trapWays(world, t, x, y));
        break;
      }
      case 'npc': {
        if (c.def.npc) out.actions.push({ id: 'talk', label: `Talk to ${G.Content.world.npcs[c.def.npc].name}` });
        serviceList(c.def).forEach((s, i) => out.actions.push({ id: 'service', alt: i, label: s.name }));
        break;
      }
      case 'shrine': out.actions.push({ id: 'pray', label: 'Kneel' }); break;
      case 'monster': {
        const spec = encounterSpec(world, c.def);
        const unaware = c.st.unseen && !c.st.alerted;
        out.actions.push({ id: unaware ? 'ambush' : 'fight', label: unaware ? 'Strike from ambush' : 'Attack' });
        if (spec.parley) out.actions.push({ id: 'parley', label: `Talk to ${G.Content.world.npcs[spec.parley].name}` });
        break;
      }
      default: break;
    }
    return out;
  }

  // ---- Doing it -------------------------------------------------------------------------------
  // Returns { events, ok } for an action id on the square in front.
  function act(world, action, arg) {
    const f = front(world);
    const c = cell(world, f.x, f.y);
    const ev = [];
    const party = W.active(world);
    let pending = null;
    const open = (why) => { c.st.open = true; c.st.unlocked = true; ev.push({ type: 'log', text: why, cls: 'find' }); };
    const roll = (skill, tn, bonus) => {
      const who = S.best(party, skill);
      const r = S.check(who, skill, tn, bonus);
      ev.push({ type: 'check', r });
      return r;
    };
    // Opening, picking or forcing a chest with a live trap on its lid springs it on whoever does it.
    const lid = c.kind === 'chest' && trapOf(c);
    if (lid && live(world, lid.def, lid.st) && ['open', 'pick', 'force'].includes(action) && !world.peaceful) {
      const who = action === 'open' ? party[0] : S.best(party, action === 'pick' ? 'lockpicking' : 'forcing');
      if (who) pending = springTrap(world, lid, f.x, f.y, ev, { victims: [who], aware: !!lid.st.found });
    }
    switch (action) {
      case 'key': open(`The ${W.goodDef(c.def.key).name} turns.`); break;
      case 'pick': {
        W.advance(world, 10);
        const tn = (c.def.tn || 8) + (c.st.jammed ? 2 : 0);
        const r = roll('lockpicking', tn);
        if (r.ok) {
          if (c.kind === 'chest') { c.st.unlocked = true; ev.push({ type: 'log', text: 'Click. The lid lifts.' }); } else open('Click. The lock gives.');
        } else if (r.fumble) { c.st.jammed = true; ev.push({ type: 'log', text: 'The pick snaps in the lock. It will be harder now.' }); }
        else ev.push({ type: 'log', text: 'The lock holds.' });
        break;
      }
      case 'force': {
        W.advance(world, 5);
        const tn = c.kind === 'chest' ? (c.def.tn || 8) + 3 : c.def.forceTn;
        const r = roll('forcing', tn);
        if (r.ok) { if (c.kind === 'chest') { c.st.unlocked = true; ev.push({ type: 'log', text: 'The lid splinters.' }); } else open('The door gives with a crack that carries.'); }
        else ev.push({ type: 'log', text: 'It does not budge. The noise echoes.' });
        wake(world, f.x, f.y, 6, ev);
        noise(world, 'force');
        break;
      }
      case 'alt': {
        const a = c.def.alt[arg];
        if (!a || !G.Cond.test(world, a.requires)) break;
        if (a.takes) W.removeGood(world, a.takes, 1);
        for (const fl of a.sets || []) W.setFlag(world, fl);
        if (a.opens) c.st.open = true;
        if (a.seals) seal(world, a.seals);
        ev.push({ type: 'log', text: a.text, cls: 'find' });
        break;
      }
      case 'open': {
        c.st.opened = true;
        const lootId = c.def.loot;
        const loot = G.Loot.roll(lootId, c.def.rolls || (lootId === 'strongbox' || lootId.endsWith('hoard') ? 2 : 1));
        const lines = G.Loot.give(world, loot);
        c.st.contents = lines;
        ev.push({ type: 'loot', title: c.def.label, lines });
        break;
      }
      case 'disarm': case 'leap': case 'edge': case 'pole': case 'stone': case 'shield': case 'mark': {
        const t = trapOf(c);
        if (!t || !live(world, t.def, t.st)) break;
        const way = trapWays(world, t, f.x, f.y).find((a) => a.id === action);
        if (!way) break;
        pending = trapAct(world, t, f, way, ev, roll);
        break;
      }
      case 'pray': {
        if (c.st.done) { ev.push({ type: 'log', text: 'The shrine is quiet.' }); break; }
        c.st.done = true;
        for (const m of W.living(world)) { C.mendWounds(m, 1, c.def.heal || 1); m.stamina = C.maxStamina(m); }
        ev.push({ type: 'log', text: c.def.text || 'Warmth. Something mends.', cls: 'find' });
        break;
      }
      default: break;
    }
    updateQuests(world, ev);
    wanderCheck(world, ev);
    return pending ? { events: ev, pending } : { events: ev };
  }

  // One way past a trap (an action from trapWays) taken: time passes, the check is rolled, and a fumble, a short
  // leap or a shield held over springs it on that one, who knew it was coming. Returns the springing's promise or null.
  function trapAct(world, t, f, way, ev, roll) {
    const K = TK(), W8 = (K.ways || {})[way.id] || {};
    const party = W.active(world);
    W.advance(world, W8.minutes || 1);
    if (W8.loud) { noise(world, 'trap'); wake(world, f.x, f.y, 6, ev); }
    const caught = { caught: K.caught || 0 };
    const beyond = () => { const d = DIRS[world.explore.dir]; world.explore.x = f.x + d[0]; world.explore.y = f.y + d[1]; markSeen(world); };
    switch (way.id) {
      case 'disarm': {
        const r = roll(way.skill, way.tn);
        if (r.ok) { t.st.disarmed = true; t.st.found = true; ev.push({ type: 'log', text: 'You disarm it carefully.', cls: 'find' }); return null; }
        if (r.fumble) { ev.push({ type: 'log', text: `${r.name}'s hand slips.`, cls: 'hurt' }); return springTrap(world, t, f.x, f.y, ev, { victims: [party.find((m) => m.id === r.who) || party[0]], aware: true, extra: caught }); }
        ev.push({ type: 'log', text: 'You cannot get it to give. It is still set.' });
        return null;
      }
      case 'leap': case 'edge': {
        // Each in marching order; the first to fall short lands on it.
        let short = null;
        for (const m of party) {
          const r = G.Skills.check(m, way.skill, way.tn);
          ev.push({ type: 'check', r });
          if (!r.ok) { short = m; break; }
        }
        beyond();
        if (!short) { ev.push({ type: 'log', text: way.id === 'leap' ? 'You leap it, one by one.' : 'You edge round it, one by one.' }); return null; }
        ev.push({ type: 'log', text: `${short.name} ${way.id === 'leap' ? 'comes down short' : 'puts a foot wrong'}.`, cls: 'hurt' });
        return springTrap(world, t, f.x, f.y, ev, { victims: [short], aware: true, extra: caught });
      }
      case 'pole': case 'stone':
        ev.push({ type: 'log', text: way.id === 'pole' ? 'You reach out with the pole from two squares off.' : 'You throw a stone at it.' });
        return springTrap(world, t, f.x, f.y, ev, { victims: [] });
      case 'shield':
        ev.push({ type: 'log', text: `${way.who.name} walks onto it with the shield held over.` });
        return springTrap(world, t, f.x, f.y, ev, { victims: [way.who], aware: true, extra: { block: W8.block || 0 } });
      case 'mark':
        t.st.marked = true;
        ev.push({ type: 'log', text: 'You scratch a mark beside it and leave it be.' });
        return null;
      default: return null;
    }
  }

  // Noise wakes sleepers within `r` squares.
  function wake(world, x, y, r, ev) {
    const g = here(world);
    for (let yy = 0; yy < g.h; yy++) for (let xx = 0; xx < g.w; xx++) {
      const def = g.legend[g.rows[yy][xx]];
      if (!def || def.kind !== 'monster' || !def.asleep) continue;
      const st = state(world, xx, yy);
      if (st.woken || st.done) continue;
      if (dist({ x, y }, { x: xx, y: yy }) <= r) { st.woken = true; ev.push({ type: 'log', text: 'Something stirs in the dark.', cls: 'hurt' }); }
    }
  }

  // Close a barrow door on what is behind it: every square with this encounter is settled.
  function seal(world, encounterId) {
    const g = here(world);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const def = g.legend[g.rows[y][x]];
      if (def && def.kind === 'monster' && def.encounter === encounterId) { const st = state(world, x, y); st.done = true; st.sealed = true; }
    }
  }

  // After a fight or a parley on the square at (x, y).
  function resolveSquare(world, x, y, how, spec) {
    const st = state(world, x, y);
    if (how === 'defeated') st.done = true;
    else if (how === 'pacified') st.pacified = true;
    for (const f of (spec && spec.flags) || []) if (how === 'defeated') W.setFlag(world, f);
    if (spec && spec.peaceFlags && how === 'pacified') for (const f of spec.peaceFlags) W.setFlag(world, f);
  }

  // ---- Camp ---------------------------------------------------------------------------
  function wanderingFor(world) {
    const p = place(world);
    return p && p.wandering ? R.weighted(p.wandering) : null;
  }

  // What a person on the map offers besides talk (a priest's healing, a merchant's stall, a trainer): `services` is a
  // list, or {place, location} to borrow a town location's.
  function serviceList(def) {
    const S = def && def.services;
    if (!S) return [];
    if (Array.isArray(S)) return S;
    const p = G.Content.world.places[S.place];
    const loc = p && (p.locations || []).find((l) => l.id === S.location);
    return (loc && loc.services) || [];
  }

  G.Explore = {
    serviceList,
    trapOf, live, learn, springTrap,
    DIRS, DIR_NAMES, grid, groundOf, place, lightRadius, here, cell, state, tileKey, opaque, lineClear, dist, markSeen, findChar, exits, beyond, edgeWay, across, placeAt,
    enter, leave, fall, front, turn, move, go, peek, path, search, facing, describe, act, scan, wake,
    encounterSpec, foeAwareness, resolveSquare, wanderingFor, minutesPerStep, noise, settleClock, wanderCheck,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
