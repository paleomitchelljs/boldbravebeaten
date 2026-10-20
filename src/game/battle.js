/*
 * Fights in the game: building foes from an encounter spec, starting the engine's encounter,
 * and settling it (XP, loot, standing, flags) when it ends. DOM-free; the battle screen
 * (src/ui/views/battle.js) drives the engine itself through a table state from Battle.table.
 *
 * An encounter spec (data/places.yaml `encounters`):
 *   foes: [{monster, n, name} | {template, level, n, name}]
 *   flags: set on victory     arena: {w, h}     text: shown at the start     parley: npc id
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
      b._table = { characters: Object.assign({}, world.chars, b.foes), order: Object.keys(world.chars).concat(Object.keys(b.foes)), encounter: b.enc, settings: world.settings, secrets: world.secrets, lore: { log: [] } };
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

  // Can the party's square reach `to` without crossing a wall?
  function connected(arena, from, to) {
    const seen = { [from.x + ',' + from.y]: 1 }, q = [from];
    while (q.length) {
      const p = q.shift();
      if (p.x === to.x && p.y === to.y) return true;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = p.x + dx, ny = p.y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= arena.w || ny >= arena.h || seen[k] || arena.wall[k]) continue;
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
      if (!arena.wall[p.x + ',' + p.y] && !taken[p.x + ',' + p.y]) { out.push(p); taken[p.x + ',' + p.y] = 1; }
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = p.x + dx, ny = p.y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= arena.w || ny >= arena.h || seen[k] || arena.wall[k]) continue;
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
    const wall = {};
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (blocked(world, ox + x, oy + y, anchor)) wall[x + ',' + y] = 1;
    const arena = { place: world.place, ox, oy, w, h, wall, party: { x: me.x - ox, y: me.y - oy }, anchor: anchor ? { x: anchor.x - ox, y: anchor.y - oy } : null };
    // If the window cuts the two sides apart (a long way round), only true walls stay walls.
    if (arena.anchor && !connected(arena, arena.party, arena.anchor)) {
      for (const k of Object.keys(wall)) { const [x, y] = k.split(',').map(Number); const kind = G.Explore.cell(world, ox + x, oy + y).kind; if (kind !== 'wall' && kind !== 'rock') delete wall[k]; }
    }
    return arena;
  }

  // Put the sides on the arena: the foes where they stood (or across the room if they came to you), the party where it was.
  function placeOnArena(enc, arena, partyIds, foeIds) {
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
    const partySq = nearestOpen(arena, arena.party, taken, partyIds.length);
    foeIds.forEach((id, i) => { enc.pos[id] = foeSq[i] || { x: 0, y: 0 }; });
    partyIds.forEach((id, i) => { enc.pos[id] = partySq[i] || { x: 0, y: 0 }; });
  }

  // opts: { surprise: the side caught off guard ('party' | 'enemy'), factor (share of AP it keeps), ctx: {x, y}, canFlee }
  function start(world, spec, opts) {
    opts = opts || {};
    const foes = buildFoes(spec);
    const foeMap = {};
    for (const f of foes) foeMap[f.id] = f;
    World.loadSupplies(world);
    const members = World.active(world);
    const chars = Object.assign({}, world.chars, foeMap);
    const arena = spec.arena ? null : dungeonArena(world, opts.ctx);
    const a = arena || spec.arena || { w: 11, h: 7 };
    const enc = Combat.createEncounter(spec.name || 'Battle', members.map((c) => c.id).concat(foes.map((f) => f.id)), chars, a.w, a.h);
    if (arena) {
      for (const k of Object.keys(arena.wall)) { const [x, y] = k.split(',').map(Number); G.Terrain.add(enc, x, y, 'dungeonWall'); }
      placeOnArena(enc, arena, members.map((c) => c.id), foes.map((f) => f.id));
    }
    if (opts.surprise) enc.surprise = { side: opts.surprise, factor: opts.factor == null ? 0.5 : opts.factor, round: 1 };
    world.battle = { enc, foes: foeMap, spec, arena: arena ? { place: arena.place, ox: arena.ox, oy: arena.oy, w: arena.w, h: arena.h } : null, ctx: opts.ctx || null, canFlee: opts.canFlee !== false, startedDay: world.day };
    world.stats.fights++;
    if (spec.text) World.logLine(world, spec.text, 'fight');
    return world.battle;
  }

  // The scope of a party's ambush: sleepers hit hardest; a party with an ambusher does best.
  function ambushFactor(world) {
    const best = Math.max(0, ...World.active(world).map((c) => C.rank(c, 'ambusher')));
    return best >= 2 ? 0 : best === 1 ? 0.25 : 0.5;
  }

  // Run away from a fight that hasn't turned yet. SPD against the quickest foe.
  function flee(world, rng) {
    const b = world.battle;
    const chars = table(world).characters;
    const mine = b.enc.ids.map((id) => chars[id]).filter((c) => c.side === 'party' && C.isActive(c));
    const theirs = b.enc.ids.map((id) => chars[id]).filter((c) => c.side !== 'party' && C.isActive(c));
    if (!mine.length || !theirs.length) return { ok: true, lines: [] };
    const slow = Math.min(...mine.map((c) => C.combatAttr(c, 'SPD')));
    const quick = Math.max(...theirs.map((c) => C.combatAttr(c, 'SPD')));
    const roll = R.d(10);
    const total = roll + Math.floor(slow / 2) + Math.floor(mine.reduce((t, c) => t + C.combatAttr(c, 'SPD'), 0) / mine.length / 2);
    const need = 5 + quick;
    const ok = total >= need;
    const lines = [`Flee: d10 ${roll} + speed vs ${need}: ${ok ? 'you break away' : 'they stay on you'}.`];
    if (!ok) b.enc.surprise = { side: 'party', factor: 0.75, round: b.enc.round + 1 };
    return { ok, lines };
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
        if (f.status.dead) { dead[f.faction] = (dead[f.faction] || 0) + 1; world.stats.kills++; if (f.faction === 'cutthroats') world.bounty = (world.bounty || 0) + 1; }
      }
      if (b.spec.loot) G.Loot.merge(loot, G.Loot.roll(b.spec.loot));
      out.lines.push(...World.grantXP(world, xp));
      for (const [fac, n] of Object.entries(dead)) if (fac && fac !== 'null') out.lines.push(...G.Factions.killed(world, fac, n));
      out.loot = G.Loot.give(world, loot);
      for (const fl of b.spec.flags || []) World.setFlag(world, fl);
      if (b.ctx && b.ctx.x != null) G.Explore.resolveSquare(world, b.ctx.x, b.ctx.y, 'defeated', b.spec);
    }
    // Clean up conjured creatures and put supplies back in the pack.
    World.collectSupplies(world);
    if (out.result === 'won' || out.result === 'fled') World.breather(world);
    for (const l of World.updateQuests(world)) out.lines.push(l);
    world.battle = null;
    return out;
  }

  G.Battle = { dungeonArena, buildFoes, table, start, ambushFactor, flee, finish };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
