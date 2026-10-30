/*
 * Fights in the game: building foes from an encounter spec, starting the engine's encounter,
 * and settling it (XP, loot, standing, flags) when it ends. DOM-free; the battle screen
 * (src/ui/views/battle.js) drives the engine itself through a table state from Battle.table.
 *
 * An encounter spec (data/places.yaml `encounters`):
 *   foes: [{monster, n, name} | {template, level, n, name}]
 *   flags: set on victory     arena: {w, h}     text: shown at the start     parley: npc id
 *
 * A fight on the map keeps the map's ground (deep water, shallows, rubble) and draws in any other group that is awake,
 * close (game.joinDistance), in sight of it and inside the slice the fight is played on.
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const R = G.Rand;
  const Combat = G.Combat;
  const World = G.World;

  function buildFoes(spec) {
    const foes = [];
    for (const e of spec.foes || []) {
      const n = e.n || 1;
      for (let i = 0; i < n; i++) {
        if (e.monster) {
          const made = G.Enemies.makeMonster(e.monster, { name: e.name && n === 1 ? e.name : undefined, n: n > 1 ? i : 0 });
          // An encounter may dress its monster differently (another colour of the same creature).
          if (e.sprite) for (const m of made) m.sprite = Object.assign({}, m.sprite, e.sprite);
          foes.push(...made);
        } else {
          foes.push(G.Enemies.generate(e.template, e.level || 1, { seed: R.int(1, 1e9), name: e.name && n === 1 ? e.name : undefined }));
        }
      }
    }
    for (const f of foes) { f.side = 'enemy'; f.control = 'auto'; }
    return foes;
  }

  // The state object the battle screen expects: { characters, order, encounter, settings, secrets }.
  function table(world) {
    const b = world.battle;
    if (!b) return null;
    if (!b._table) {
      const allies = b.allies || {};
      b._table = { characters: Object.assign({}, world.chars, allies, b.foes), order: Object.keys(world.chars).concat(Object.keys(allies), Object.keys(b.foes)), encounter: b.enc, settings: world.settings, secrets: world.secrets, lore: { log: [] } };
    }
    b._table.encounter = b.enc;
    return b._table;
  }

  // ---- The arena: a fight is played on a slice of the dungeon you were walking ----------------------------
  // A square the fighters cannot enter: rock, walls, shut doors and the furniture, chests and people on the floor.
  function blocked(world, x, y, anchor) {
    if (anchor && anchor.x === x && anchor.y === y) return false;
    const c = G.Explore.cell(world, x, y);
    // A shut ordinary door does not keep a fight apart: it gets kicked open.
    return ['wall', 'rock', 'locked', 'chest', 'npc', 'shrine', 'monster'].includes(c.kind) || (c.kind === 'prop' && c.solid);
  }

  const closed = (arena, k) => arena.wall[k] || arena.ground[k] === 'deepWater';

  // Can the party's square reach `to` without crossing a wall or deep water?
  function connected(arena, from, to) {
    const seen = { [from.x + ',' + from.y]: 1 }, q = [from];
    while (q.length) {
      const p = q.shift();
      if (p.x === to.x && p.y === to.y) return true;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = p.x + dx, ny = p.y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= arena.w || ny >= arena.h || seen[k] || closed(arena, k)) continue;
        seen[k] = 1; q.push({ x: nx, y: ny });
      }
    }
    return false;
  }

  // Squares nearest `from` that are open and unclaimed, nearest first (breadth-first through the open floor).
  function nearestOpen(arena, from, taken, n) {
    const out = [], seen = { [from.x + ',' + from.y]: 1 }, q = [from];
    while (q.length && out.length < n) {
      const p = q.shift();
      if (!closed(arena, p.x + ',' + p.y) && !taken[p.x + ',' + p.y]) { out.push(p); taken[p.x + ',' + p.y] = 1; }
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = p.x + dx, ny = p.y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= arena.w || ny >= arena.h || seen[k] || closed(arena, k)) continue;
        seen[k] = 1; q.push({ x: nx, y: ny });
      }
    }
    return out;
  }

  // Cut the window of the map the fight is played on, centred between the party and what it fights.
  function dungeonArena(world, ctx) {
    const g = G.Explore.here(world);
    if (!g || !world.explore) return null;
    const A = G.CONFIG.game.arena || { w: 15, h: 10 };
    const w = Math.min(A.w, g.w), h = Math.min(A.h, g.h);
    const me = world.explore;
    const anchor = ctx && ctx.x != null ? { x: ctx.x, y: ctx.y } : null;
    const cx = anchor ? (me.x + anchor.x) / 2 : me.x, cy = anchor ? (me.y + anchor.y) / 2 : me.y;
    const ox = Math.max(0, Math.min(g.w - w, Math.round(cx - w / 2))), oy = Math.max(0, Math.min(g.h - h, Math.round(cy - h / 2)));
    const wall = {}, ground = {};
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (blocked(world, ox + x, oy + y, anchor)) { wall[x + ',' + y] = 1; continue; }
      const gr = G.Explore.cell(world, ox + x, oy + y).ground;
      if (gr && gr.fight) ground[x + ',' + y] = gr.fight;
    }
    const arena = { place: world.place, ox, oy, w, h, wall, ground, party: { x: me.x - ox, y: me.y - oy }, anchor: anchor ? { x: anchor.x - ox, y: anchor.y - oy } : null };
    // If the window cuts the two sides apart (a long way round), only true walls stay walls.
    if (arena.anchor && !connected(arena, arena.party, arena.anchor)) {
      for (const k of Object.keys(wall)) { const [x, y] = k.split(',').map(Number); const kind = G.Explore.cell(world, ox + x, oy + y).kind; if (kind !== 'wall' && kind !== 'rock') delete wall[k]; }
    }
    return arena;
  }

  // Other groups on the map that hear the fight and come: awake, not beaten or calmed, within game.joinDistance of the
  // party or of the group it fights, with a clear line to that one, and inside the slice. Returns [{x, y, def, spec}]
  // in map squares.
  function joiners(world, arena, anchor) {
    const me = { x: world.explore.x, y: world.explore.y };
    const near = (q) => [me, anchor].some((at) => at && G.Explore.cheb(at, q) <= r && G.Explore.lineClear(world, q.x, q.y, at.x, at.y));
    const r = G.CONFIG.game.joinDistance || 0;
    const g = G.Explore.here(world);
    const out = [];
    if (!r) return out;
    for (let y = arena.oy; y < arena.oy + arena.h; y++) for (let x = arena.ox; x < arena.ox + arena.w; x++) {
      if (anchor && x === anchor.x && y === anchor.y) continue;
      const def = g.legend[g.rows[y][x]];
      if (!def || def.kind !== 'monster') continue;
      const st = G.Explore.state(world, x, y);
      if (st.done || st.pacified || (def.asleep && !st.woken)) continue;
      if (!near({ x, y })) continue;
      out.push({ x, y, def, spec: G.Explore.encounterSpec(world, def) });
    }
    return out;
  }

  // Put the sides on the arena: the foes where they stood (or across the room if they came to you), the party where it
  // was, and each group that joined around its own square.
  function placeOnArena(enc, arena, partyIds, foeIds, joined) {
    const taken = {};
    // The side with an anchor claims its squares first.
    let seed = arena.anchor;
    if (!seed) {
      // A wandering group: the open square farthest from the party that is still in sight of the window's middle.
      let best = null, bd = -1;
      for (let y = 0; y < arena.h; y++) for (let x = 0; x < arena.w; x++) {
        if (arena.wall[x + ',' + y]) continue;
        const d = Math.max(Math.abs(x - arena.party.x), Math.abs(y - arena.party.y));
        if (d > bd && d <= 5) { bd = d; best = { x, y }; }
      }
      seed = best || arena.party;
    }
    const foeSq = nearestOpen(arena, seed, taken, foeIds.length);
    for (const j of joined || []) {
      const sq = nearestOpen(arena, { x: j.x - arena.ox, y: j.y - arena.oy }, taken, j.ids.length);
      j.ids.forEach((id, i) => { enc.pos[id] = sq[i] || { x: 0, y: 0 }; });
    }
    const partySq = nearestOpen(arena, arena.party, taken, partyIds.length);
    foeIds.forEach((id, i) => { enc.pos[id] = foeSq[i] || { x: 0, y: 0 }; });
    partyIds.forEach((id, i) => { enc.pos[id] = partySq[i] || { x: 0, y: 0 }; });
  }

  // opts: { surprise: the side caught off guard ('party' | 'enemy'), factor (share of AP it keeps), ctx: {x, y}, canFlee (false: no getting away) }
  function start(world, spec, opts) {
    opts = opts || {};
    const foes = buildFoes(spec);
    if (world.explore && G.Explore) G.Explore.noise(world, 'fight');
    const arena = spec.arena ? null : dungeonArena(world, opts.ctx);
    const joined = arena ? joiners(world, arena, opts.ctx && opts.ctx.x != null ? opts.ctx : null) : [];
    for (const j of joined) { const more = buildFoes(j.spec); j.ids = more.map((f) => f.id); foes.push(...more); }
    const foeMap = {};
    for (const f of foes) foeMap[f.id] = f;
    World.loadSupplies(world);
    // Familiars and animal companions fight beside their owners.
    if (G.Companions) G.Companions.ensure(world);
    const allies = {};
    for (const b of G.Companions ? G.Companions.fighting(world) : []) allies[b.id] = b;
    const members = World.active(world).concat(Object.values(allies));
    const chars = Object.assign({}, world.chars, allies, foeMap);
    const a = arena || spec.arena || { w: 11, h: 7 };
    const enc = Combat.createEncounter(spec.name || 'Battle', members.map((c) => c.id).concat(foes.map((f) => f.id)), chars, a.w, a.h);
    if (arena) {
      for (const k of Object.keys(arena.wall)) { const [x, y] = k.split(',').map(Number); G.Terrain.add(enc, x, y, 'dungeonWall'); }
      for (const [k, kind] of Object.entries(arena.ground)) { const [x, y] = k.split(',').map(Number); G.Terrain.add(enc, x, y, kind); }
      const joinIds = new Set(joined.flatMap((j) => j.ids));
      placeOnArena(enc, arena, members.map((c) => c.id), foes.filter((f) => !joinIds.has(f.id)).map((f) => f.id), joined);
    }
    if (opts.surprise) enc.surprise = { side: opts.surprise, factor: opts.factor == null ? 0.5 : opts.factor, round: 1 };
    world.battle = { enc, foes: foeMap, allies, spec, joined: joined.map((j) => ({ x: j.x, y: j.y, spec: j.spec })), arena: arena ? { place: arena.place, ox: arena.ox, oy: arena.oy, w: arena.w, h: arena.h } : null, ctx: opts.ctx || null, canFlee: opts.canFlee !== false, startedDay: world.day };
    world.stats.fights++;
    if (spec.text) World.logLine(world, spec.text, 'fight');
    for (const j of joined) World.logLine(world, `${j.def.label || 'More of them'} hear${j.def.label ? 's' : ''} the fighting and come${j.def.label ? 's' : ''} running.`, 'fight');
    return world.battle;
  }

  // The scope of a party's ambush: sleepers hit hardest; a party with an ambusher does best.
  function ambushFactor(world) {
    const best = Math.max(0, ...World.active(world).map((c) => C.rank(c, 'ambusher')));
    return best >= 2 ? 0 : best === 1 ? 0.25 : 0.5;
  }

  // Has the party got away? Asked at the end of a round (CONFIG.disengage). Every foe still standing either can't reach
  // striking distance of anyone in the party (a wall across the way, or held where it stands) or couldn't in `outrun`
  // rounds of running, and none has a missile or a spell with a clear line to them. The fallen count: a foe that can
  // reach one of yours lying on the floor keeps the fight going. Returns { ok, why }.
  function disengaged(world) {
    const b = world.battle;
    if (!b || b.canFlee === false) return { ok: false };
    const enc = b.enc;
    const chars = table(world).characters;
    const T = G.Terrain;
    const mine = enc.ids.filter((id) => chars[id] && chars[id].side === 'party' && !chars[id].status.dead && enc.pos[id]);
    const theirs = enc.ids.filter((id) => chars[id] && chars[id].side !== 'party' && C.isActive(chars[id]) && enc.pos[id]);
    if (!mine.some((id) => C.isActive(chars[id])) || !theirs.length) return { ok: false };
    const D = G.CONFIG.disengage || { outrun: 2 };
    const near = (p, q, r) => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) <= r;
    for (const id of theirs) {
      const f = chars[id], at = enc.pos[id];
      const opts = C.attackOptions(f);
      const shoots = opts.some((o) => o.ranged) || (G.Magic && G.Magic.availableSP(f) > 0);
      if (shoots && mine.some((m) => !T.lineCheck(enc, at, enc.pos[m], 'missile').blocked)) return { ok: false, why: `${f.name} can still shoot` };
      const reach = Math.max(1, ...opts.filter((o) => !o.ranged).map((o) => o.maxRange || 1));
      if (mine.some((m) => near(at, enc.pos[m], reach))) return { ok: false, why: `${f.name} is on you` };
      if (G.Conditions && !G.Conditions.canMove(f)) continue;
      const run = D.outrun * C.squaresFor(f, C.apPool(f));
      const map = T.costMap(enc, at, f);
      for (let y = 0; y < enc.grid.h; y++) for (let x = 0; x < enc.grid.w; x++) {
        if (map.cost[map.idx(x, y)] > run || !T.canStand(enc, x, y, f)) continue;
        if (mine.some((m) => near({ x, y }, enc.pos[m], reach))) return { ok: false, why: `${f.name} can reach you` };
      }
    }
    return { ok: true };
  }

  // The party has got away (disengaged): the fight ends, and on the map they stand where the first of them stood on
  // the field, not back at the way in.
  function getAway(world) {
    const b = world.battle;
    const lead = b.arena && World.active(world).find((c) => b.enc.pos[c.id]);
    const at = lead && { x: b.arena.ox + b.enc.pos[lead.id].x, y: b.arena.oy + b.enc.pos[lead.id].y };
    const res = finish(world, 'fled');
    if (at && world.explore) { world.explore.x = at.x; world.explore.y = at.y; G.Explore.markSeen(world); }
    res.lines.unshift('You get clear: nothing can come after you.');
    return res;
  }

  // Settle a finished (or fled) battle. Returns { result: 'won'|'lost'|'fled'|'draw', lines, loot }.
  function finish(world, how) {
    const b = world.battle;
    const t = table(world);
    const enc = b.enc;
    const out = { result: how || null, lines: [], loot: [] };
    const alive = (side) => enc.ids.some((id) => t.characters[id] && (side === 'party' ? t.characters[id].side === 'party' : t.characters[id].side !== 'party') && C.isActive(t.characters[id]));
    if (!out.result) out.result = alive('party') && !alive('enemy') ? 'won' : alive('enemy') && !alive('party') ? 'lost' : 'draw';
    Combat.cleanup(enc, t.characters);
    const foes = Object.values(b.foes).filter((f) => !f.conjured);
    if (out.result === 'won') {
      const fallen = foes;
      let xp = 0;
      const loot = { gold: 0, goods: [], gear: [] };
      const dead = {};
      for (const f of fallen) {
        xp += f.xp || 0;
        G.Loot.merge(loot, G.Loot.fromFoe(f));
        if (f.status.dead) { dead[f.faction] = (dead[f.faction] || 0) + 1; world.stats.kills++; if (f.faction && f.faction === (G.CONFIG.game.bounty || {}).on) world.bounty = (world.bounty || 0) + 1; }
      }
      if (b.spec.loot) G.Loot.merge(loot, G.Loot.roll(b.spec.loot));
      for (const j of b.joined || []) if (j.spec.loot) G.Loot.merge(loot, G.Loot.roll(j.spec.loot));
      out.lines.push(...World.grantXP(world, xp));
      for (const [fac, n] of Object.entries(dead)) if (fac && fac !== 'null') out.lines.push(...G.Factions.killed(world, fac, n));
      out.loot = G.Loot.give(world, loot);
      for (const fl of b.spec.flags || []) World.setFlag(world, fl);
      if (b.ctx && b.ctx.x != null) G.Explore.resolveSquare(world, b.ctx.x, b.ctx.y, 'defeated', b.spec);
      for (const j of b.joined || []) G.Explore.resolveSquare(world, j.x, j.y, 'defeated', j.spec);
    }
    // Clean up conjured creatures and put supplies back in the pack. A familiar lost tears at its owner.
    if (G.Companions) out.lines.push(...G.Companions.afterFight(world));
    World.collectSupplies(world);
    if (out.result === 'won' || out.result === 'fled') World.breather(world);
    for (const l of World.updateQuests(world)) out.lines.push(l);
    world.battle = null;
    return out;
  }

  G.Battle = { dungeonArena, joiners, buildFoes, table, start, ambushFactor, disengaged, getAway, finish };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
