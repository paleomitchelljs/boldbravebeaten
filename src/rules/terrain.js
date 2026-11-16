/*
 * Terrain (PROVISIONAL): features on the grid — walls, pits, hazards, runes — and the rules
 * for moving through them square by square and seeing or shooting past them.
 *
 * enc.tiles maps "x,y" to a list of features { id, kind, beats, mag, noun, owner, side,
 * hidden }. What a kind does lives in CONFIG.terrain. Features with `beats` count down at
 * each beat; null lasts the fight.
 */
(function (G) {
  'use strict';
  const CONFIG = G.CONFIG;
  let nextId = 1;

  const C = () => G.Character;
  const T = () => CONFIG.terrain;
  const key = (x, y) => x + ',' + y;
  const def = (f) => T()[f.kind] || {};

  function tiles(enc) {
    return enc.tiles || (enc.tiles = {});
  }

  function at(enc, x, y) {
    return tiles(enc)[key(x, y)] || [];
  }

  function inGrid(enc, x, y) {
    return x >= 0 && y >= 0 && x < enc.grid.w && y < enc.grid.h;
  }

  function add(enc, x, y, kind, opts) {
    if (!inGrid(enc, x, y) || !T()[kind]) return null;
    opts = opts || {};
    const f = { id: 't' + nextId++, kind, beats: opts.beats == null ? null : opts.beats, mag: opts.mag || 0, noun: opts.noun || null, owner: opts.owner || null, side: opts.side || null, hidden: !!(opts.hidden != null ? opts.hidden : T()[kind].hidden) };
    const list = tiles(enc)[key(x, y)] || (tiles(enc)[key(x, y)] = []);
    // One ground or wall of a kind per square: a fresh one replaces the old.
    const i = list.findIndex((g) => g.kind === kind);
    if (i >= 0) list.splice(i, 1);
    list.push(f);
    // Radiance lays bare what was hidden on its square.
    if (T()[kind].reveals) for (const g of list) g.hidden = false;
    else if (list.some((g) => (T()[g.kind] || {}).reveals)) f.hidden = false;
    return f;
  }

  function remove(enc, x, y, pred) {
    const k = key(x, y);
    const list = tiles(enc)[k];
    if (!list) return;
    tiles(enc)[k] = list.filter((f) => !pred(f));
    if (!tiles(enc)[k].length) delete tiles(enc)[k];
  }

  function has(enc, x, y, prop) {
    return at(enc, x, y).some((f) => def(f)[prop]);
  }

  // Can a character step onto this square (not a wall, not deep water, inside the grid)?
  function passable(enc, x, y) {
    return inGrid(enc, x, y) && !has(enc, x, y, 'wall') && !has(enc, x, y, 'deep');
  }

  // Squares of movement it costs to step onto (x, y): 1 + the ground's extra cost.
  // Fliers (trait flying) pass over ground, pits, traps and hazards, and over walls that
  // aren't solid; solid walls still stop them.
  function flies(c) {
    return !!(c && G.Effects.has(c, 'flying'));
  }

  // Can this character end a move here? A flier may hang over deep water.
  function canStand(enc, x, y, c) {
    return passable(enc, x, y) || (flies(c) && inGrid(enc, x, y) && !has(enc, x, y, 'wall'));
  }

  function stepCost(enc, x, y, c) {
    if (flies(c) || (c && G.Effects.has(c, 'freedom'))) return 1;
    return 1 + at(enc, x, y).reduce((t, f) => t + (def(f).cost || 0), 0);
  }

  // The cheapest way from `from` to `to`, step by step (8 directions; walls can't be entered;
  // rough ground costs more; every second diagonal step counts two, as Combat.steps). Without a way through, the path
  // ends at the reachable square nearest the goal. `c` (optional) is the walker, for Freedom.
  // Cheapest cost from `from` to every square (Dijkstra; stops early at `to` if given). `block` (a Set of "x,y"):
  // squares that can't be walked through, the walker's foes (Combat.foeSquares): they have to be gone around.
  // Nobody walks onto deadly ground (lava) they can see; only a shove or a fall puts them there, and they can walk out.
  // Other hazards they can see (a pit, fire, a foe's rune) are crossed only when there is no way round. `cost` is the
  // true squares walked; the detours only steer which way is taken.
  // The search runs over (square, diagonals so far odd or even), so a walk's second diagonal is charged wherever it falls.
  function costMap(enc, from, c, to, block) {
    const W = enc.grid.w, H = enc.grid.h, N = W * H;
    const idx = (x, y) => y * W + x;
    const cost = new Array(N).fill(Infinity);
    const best = new Int32Array(N).fill(-1); // the state each square was first reached in
    const rank = new Float64Array(2 * N).fill(Infinity);
    const sCost = new Float64Array(2 * N).fill(Infinity);
    const prevS = new Int32Array(2 * N).fill(-1);
    const done = new Uint8Array(2 * N);
    const shun = new Array(N);
    const s0 = idx(from.x, from.y) * 2;
    rank[s0] = sCost[s0] = 0;
    const heap = [[0, s0]];
    const push = (r, s) => {
      heap.push([r, s]);
      for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };
    while (heap.length) {
      const [r, s] = pop();
      if (done[s] || r > rank[s]) continue;
      done[s] = 1;
      const u = s >> 1, odd = s & 1;
      if (best[u] < 0) { best[u] = s; cost[u] = sCost[s]; }
      const ux = u % W, uy = (u - ux) / W;
      if (to && ux === to.x && uy === to.y) break;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = ux + dx, ny = uy + dy;
        if (!passable(enc, nx, ny) && !(flies(c) && inGrid(enc, nx, ny) && !has(enc, nx, ny, 'solid'))) continue;
        if (block && block.has(key(nx, ny))) continue;
        const v = idx(nx, ny);
        const diag = dx && dy;
        // The second diagonal of a pair counts two; a hair's preference for straight steps keeps paths tidy.
        const sc = stepCost(enc, nx, ny, c) + (diag ? (odd ? 1 : 0) + 0.001 : 0);
        if (shun[v] === undefined) shun[v] = avoid(enc, nx, ny, c);
        if (shun[v] === Infinity) continue;
        const t = v * 2 + (diag ? 1 - odd : odd);
        const nr = rank[s] + sc + shun[v];
        if (nr < rank[t]) { rank[t] = nr; sCost[t] = sCost[s] + sc; prevS[t] = s; push(nr, t); }
      }
    }
    return { cost, best, prevS, start: s0, W, idx, shun };
  }

  // How hard a walker steers clear of (x, y): Infinity for deadly ground it can see (never entered), a large detour for
  // other hazards it can see, 0 otherwise. Fliers pass over all of it.
  const DETOUR = 50;
  function avoid(enc, x, y, c) {
    if (!c || flies(c)) return 0;
    let a = 0;
    for (const f of at(enc, x, y)) {
      if (!visible(f, c.side)) continue;
      const t = def(f);
      if (t.deadly) return Infinity;
      if (t.pit || t.onEnter || t.perBeat || (t.rune && f.side !== c.side) || (t.trap && !f.sprung)) a = DETOUR;
    }
    return a;
  }

  // The names of the hazards a walker can see along these squares (the ones avoid() steers round), each once.
  function hazardsOn(enc, steps, c) {
    const out = [];
    for (const q of steps) {
      if (!avoid(enc, q.x, q.y, c)) continue;
      for (const f of at(enc, q.x, q.y)) { const n = def(f).name; if (n && visible(f, c.side) && !out.includes(n)) out.push(n); }
    }
    return out;
  }

  // The squares of the cheapest way to (x, y) in a cost map.
  function trace(map, from, x, y) {
    const out = [];
    for (let s = map.best[map.idx(x, y)]; s >= 0 && s !== map.start; s = map.prevS[s]) {
      const v = s >> 1;
      out.unshift({ x: v % map.W, y: (v - (v % map.W)) / map.W });
    }
    return out;
  }

  function path(enc, from, to, c, block) {
    if ((!enc.tiles || !Object.keys(enc.tiles).length) && !(block && block.size)) return straight(from, to);
    const map = costMap(enc, from, c, to, block);
    const { cost, idx } = map;
    const W = enc.grid.w, H = enc.grid.h;
    const far = (x, y) => G.Combat.dist({ x, y }, to);
    let end = idx(to.x, to.y);
    if (cost[end] === Infinity) {
      // No way through: as close as can be reached.
      let bestD = Infinity;
      for (let i = 0; i < W * H; i++) {
        if (cost[i] === Infinity || map.shun[i]) continue;
        const x = i % W, y = (i - x) / W, d = far(x, y);
        if (d < bestD || (d === bestD && cost[i] < cost[end])) { bestD = d; end = i; }
      }
    }
    return trace(map, from, end % W, (end - (end % W)) / W);
  }

  // Open ground: diagonals first, then straight.
  function straight(from, to) {
    const out = [];
    let x = from.x, y = from.y;
    while (x !== to.x || y !== to.y) {
      x += Math.sign(to.x - x);
      y += Math.sign(to.y - y);
      out.push({ x, y });
    }
    return out;
  }

  // Cost in squares to walk from `from` to `to`, and whether the path gets there. Every second diagonal step counts two.
  function pathCost(enc, from, to, c, block) {
    const steps = path(enc, from, to, c, block);
    let cost = 0, diagonals = 0, at = from;
    let climbing = has(enc, from.x, from.y, 'pit') && !(c && G.Effects.has(c, 'freedom'));
    for (const q of steps) {
      cost += stepCost(enc, q.x, q.y, c) + (climbing ? T().climbCost : 0);
      if (q.x !== at.x && q.y !== at.y && ++diagonals % 2 === 0) cost += 1;
      climbing = false;
      at = q;
    }
    const last = steps[steps.length - 1] || from;
    return { cost, steps, reaches: last.x === to.x && last.y === to.y };
  }

  // Squares strictly between two points (Bresenham).
  function between(a, b) {
    const out = [];
    let x = a.x, y = a.y;
    const dx = Math.abs(b.x - a.x), dy = -Math.abs(b.y - a.y);
    const sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 128; guard++) {
      if (x === b.x && y === b.y) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      if (x === b.x && y === b.y) break;
      out.push({ x, y });
    }
    return out;
  }

  // What lies between attacker and target. kind: 'missile' (arrows, bolts, spells), 'melee'
  // (a weapon reaching past a square), 'sight'. Returns { blocked, by, miss, at (the square that stops it) }.
  function lineCheck(enc, a, b, kind) {
    if (!enc.tiles) return { blocked: false, miss: 0 };
    let miss = 0;
    for (const q of between(a, b)) {
      for (const f of at(enc, q.x, q.y)) {
        const d = def(f);
        if (d.solid) return { blocked: true, by: d.name, miss: 0, at: q };
        if (kind === 'melee' && d.wall) return { blocked: true, by: d.name, miss: 0, at: q };
        if ((kind === 'missile' || kind === 'sight') && d.blocksSight) return { blocked: true, by: d.name, miss: 0, at: q };
        if (kind === 'missile' && d.blocksMissiles) return { blocked: true, by: d.name, miss: 0, at: q };
        if (kind === 'missile' && d.missileMiss) miss = 1 - (1 - miss) * (1 - d.missileMiss);
      }
    }
    return { blocked: false, miss };
  }

  // Features a side can see (hidden runes belong to the side that laid them; a hidden trap shows to the sides in
  // f.knownBy: its own people, a party that has found it).
  function visible(f, side) {
    return !f.hidden || f.side === side || !!(f.knownBy && f.knownBy.includes(side));
  }

  // A character steps onto (x, y). Springs runes and traps, falls into pits, slips on ice, takes the
  // ground's blow. Returns true if the move ends here. how: 'driven' when shoved or hurled there (a trap's own
  // people walk it safely, but not when driven onto it).
  async function enter(enc, chars, c, x, y, roller, log, how) {
    if (flies(c)) return !C().isActive(c) || (G.Conditions && !G.Conditions.canMove(c));
    const free = G.Effects.has(c, 'freedom');
    for (const f of at(enc, x, y).slice()) {
      const d = def(f);
      if (d.rune && f.side !== c.side) {
        remove(enc, x, y, (g) => g.id === f.id);
        log(`${c.name} steps on a hidden rune of ${f.noun}!`);
        if (G.Magic && G.Magic.springRune) await G.Magic.springRune(enc, chars, f, x, y, roller);
      }
      if (d.trap && !f.sprung && G.Traps) await G.Traps.springInFight(enc, chars, c, f, x, y, roller, how);
      if (d.pit) {
        c.status.prone = true;
        c.stamina = Math.max(0, c.stamina - T().pitDamage);
        log(`${c.name} falls into the pit (−${T().pitDamage} stamina).`);
        return true;
      }
      if (d.slick && !free) {
        const bonus = Math.floor((C().combatAttr(c, 'DEX') + C().combatAttr(c, 'SPD')) / 4);
        const r = (await roller({ actorId: c.id, sides: 10, count: 1, label: `${c.name}: footing on ice`, detail: `d10 + ${bonus} ≥ ${T().slickFootingTN} or fall` }))[0];
        if (r + bonus < T().slickFootingTN) {
          c.status.prone = true;
          log(`${c.name} slips on the ice and falls.`);
          return true;
        }
      }
      if (d.onEnter && !(free && !d.burns)) {
        for (const [noun, mag] of Object.entries(d.onEnter)) {
          if (G.Magic && G.Magic.elementBlow) await G.Magic.elementBlow(enc, chars, chars[f.owner] || c, c, noun, mag + (f.mag || 0), roller, d.name);
        }
      }
    }
    return !C().isActive(c) || c.status.prone || (G.Conditions && !G.Conditions.canMove(c));
  }

  // A beat: standing in a hazard hurts; fire burns away what burns; everything counts down.
  async function beat(enc, chars, roller, log) {
    if (!enc.tiles) return;
    for (const id of enc.ids) {
      const c = chars[id];
      if (!c || c.status.dead || !enc.pos[id] || flies(c)) continue;
      const p = enc.pos[id];
      for (const f of at(enc, p.x, p.y)) {
        const d = def(f);
        if (!d.perBeat) continue;
        for (const [noun, mag] of Object.entries(d.perBeat)) {
          if (G.Magic && G.Magic.elementBlow) await G.Magic.elementBlow(enc, chars, chars[f.owner] || c, c, noun, mag + (f.mag || 0), roller, d.name);
        }
      }
    }
    // A wall of fire scorches whoever stands beside it: once a beat for each kind of wall, however many squares of it.
    const near = all(enc).filter((t) => t.def.near);
    if (near.length) for (const id of enc.ids) {
      const c = chars[id];
      if (!c || c.status.dead || !enc.pos[id]) continue;
      const p = enc.pos[id];
      const seen = {};
      for (const t of near) {
        if (seen[t.f.kind] || G.Combat.dist(t, p) !== 1) continue;
        seen[t.f.kind] = 1;
        for (const [noun, mag] of Object.entries(t.def.near)) {
          if (G.Magic && G.Magic.elementBlow) await G.Magic.elementBlow(enc, chars, chars[t.f.owner] || c, c, noun, mag + (t.f.mag || 0), roller, t.def.name);
        }
      }
    }
    if (G.Traps) G.Traps.rearm(enc);
    for (const k of Object.keys(enc.tiles)) {
      let list = enc.tiles[k];
      if (list.some((f) => def(f).burns)) {
        const burnt = list.filter((f) => def(f).flammable || def(f).meltsInFire);
        if (burnt.length) log(`${burnt.map((f) => def(f).name).join(', ')} at (${k.split(',').map((n) => +n + 1).join(', ')}) ${burnt.length > 1 ? 'burn' : 'burns'} away.`);
        list = list.filter((f) => !(def(f).flammable || def(f).meltsInFire));
      }
      for (const f of list) if (f.beats != null) f.beats -= 1;
      list = list.filter((f) => f.beats == null || f.beats > 0);
      if (list.length) enc.tiles[k] = list;
      else delete enc.tiles[k];
    }
  }

  // Every feature, for drawing the map: [{ x, y, f, def }].
  function all(enc) {
    const out = [];
    for (const [k, list] of Object.entries(enc.tiles || {})) {
      const [x, y] = k.split(',').map(Number);
      for (const f of list) out.push({ x, y, f, def: def(f) });
    }
    return out;
  }

  // How much a side dislikes stepping onto (x, y): pits, slick ice, hazards it can see.
  function danger(enc, x, y, side, c) {
    if (flies(c)) return 0;
    let d = 0;
    const beside = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => at(enc, x + dx, y + dy))).flat();
    if (beside.some((f) => def(f).near && visible(f, side))) d += 6;
    for (const f of at(enc, x, y)) {
      if (!visible(f, side)) continue;
      const t = def(f);
      if (t.rune && f.side !== side) d += 25;
      if (t.pit || (t.trap && !f.sprung)) d += 30;
      if (t.slick) d += 8;
      if (t.onEnter) d += 10;
      if (t.deadly) d += 100;
      if (t.perBeat) d += 6;
    }
    return d;
  }

  G.Terrain = { flies, canStand, costMap, avoid, hazardsOn, trace, danger, tiles, at, add, remove, has, passable, stepCost, path, pathCost, between, lineCheck, visible, enter, beat, all, inGrid };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
