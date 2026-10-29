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
    const key = placeId + '|' + p.map.join('');
    if (cache[placeId] && cache[placeId].key === key) return cache[placeId];
    const rows = p.map;
    const under = p.look && p.look.ground ? groundOf(p.look.ground) : null;
    return (cache[placeId] = { key, rows, w: rows[0].length, h: rows.length, legend: p.legend || {}, under });
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
      case 'locked': return st.open ? { ch, def, kind: 'floor', solid: false, opaque: false, st } : { ch, def, kind: 'locked', solid: true, opaque: true, st };
      case 'chest': return { ch, def, kind: 'chest', solid: true, opaque: false, st };
      case 'npc': return { ch, def, kind: 'npc', solid: true, opaque: false, st };
      case 'shrine': return { ch, def, kind: 'shrine', solid: true, opaque: false, st };
      case 'monster': return { ch, def, kind: 'monster', solid: !st.done && !st.pacified && !world.peaceful, opaque: false, st };
      case 'prop': return { ch, def, kind: 'prop', solid: def.solid !== false, opaque: false, st };
      case 'trap': return { ch, def, kind: 'trap', solid: !!(st.found && !st.disarmed && !st.sprung), opaque: false, st };
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

  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  function markSeen(world) {
    const ex = world.explore;
    const ms = W.mapState(world, world.place);
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

  // ---- Entering and leaving ----------------------------------------------------
  function findChar(placeId, ch) {
    const g = grid(placeId);
    if (!g) return null;
    for (let y = 0; y < g.h; y++) { const x = g.rows[y].indexOf(ch); if (x >= 0) return { x, y }; }
    return null;
  }

  // Walk out of the entry stairs facing into the map.
  function enter(world, placeId, arrive) {
    const p = places()[placeId];
    world.place = placeId;
    world.location = null;
    if (!p || !p.map) { world.explore = null; return; }
    const at = findChar(placeId, arrive || '<') || { x: 1, y: 1 };
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

  function minutesPerStep(world) {
    return (world.explore && world.explore.sneak ? cfg().sneakStepSeconds : cfg().stepSeconds) / 60;
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
      if (ex.sneak) {
        const r = S.groupCheck(party, 'stealth', foeAwareness({ foes: w.foes }), 0);
        ev.push({ type: 'check', r });
        if (r.ok) { ev.push({ type: 'log', text: `${w.text ? w.text + ' ' : ''}You keep still, and they pass you by.`, cls: 'find' }); continue; }
      }
      const heard = S.bestCheck(party, 'perception', cw.hearTn || 8, 0);
      ev.push({ type: 'wander', spec: { foes: w.foes, text: w.text, name: 'Wanderers' }, check: heard, surprise: heard.ok ? null : 'party' });
      ex.danger = 0;
      return;
    }
  }
  const met = (ev) => ev.some((e) => e.type === 'encounter' || e.type === 'unseen' || e.type === 'stairs');

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
    enterSquare(world, c, nx, ny, ev);
    markSeen(world);
    passive(world, ev);
    scan(world, ev);
    if (!met(ev)) wanderCheck(world, ev);
    return { moved: true, events: ev };
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
      if (c.kind === 'trap' && c.st.found && !c.st.disarmed && !c.st.sprung) return false;
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

  function enterSquare(world, c, x, y, ev) {
    if (c.kind === 'trap' && !c.st.sprung && !c.st.disarmed) { if (!world.peaceful) springTrap(world, c, ev); }
    else if (c.kind === 'pickup' && !c.st.done) {
      c.st.done = true;
      W.addGood(world, c.def.good, 1);
      ev.push({ type: 'log', text: `${c.def.text ? c.def.text + ' ' : ''}You take the ${W.goodDef(c.def.good).name}.`, cls: 'loot' });
      updateQuests(world, ev);
    } else if (c.kind === 'note' && !c.st.done) {
      c.st.done = true;
      ev.push({ type: 'note', text: c.def.text });
      if (c.def.sets) for (const f of c.def.sets) W.setFlag(world, f);
    } else if (c.kind === 'stairs' || c.kind === 'drop') {
      ev.push({ type: 'stairs', def: c.def, x, y });
    }
  }

  // A one-way drop (a well, a hole): its text, and any harm from the fall, before the party arrives below.
  function fall(world, def) {
    if (def.text) W.logLine(world, def.text, 'info');
    for (const v of W.active(world)) {
      for (const [a, n] of Object.entries(def.damage || {})) { C.damageAttr(v, a, n); W.logLine(world, `${v.name} takes ${n} ${a} damage from the fall.`, 'hurt'); }
      C.updateCondition(v);
    }
  }

  function updateQuests(world, ev) {
    for (const t of W.updateQuests(world)) ev.push({ type: 'log', text: t, cls: 'quest' });
  }

  // ---- Perception: hidden traps and doors ---------------------------------------
  function hiddenNear(world) {
    const ex = world.explore;
    const out = [];
    for (let d = 0; d < 4; d++) {
      const x = ex.x + DIRS[d][0], y = ex.y + DIRS[d][1];
      const c = cell(world, x, y);
      if (c.hidden || (c.kind === 'trap' && !c.st.found && !c.st.disarmed && !c.st.sprung)) out.push({ x, y, c });
    }
    return out;
  }

  const revealed = (world, c) => c.def && c.def.reveal && G.Cond.test(world, c.def.reveal);

  function passive(world, ev) {
    for (const h of hiddenNear(world)) {
      if (h.c.st.passive) continue;
      if (revealed(world, h.c)) { h.c.st.found = true; ev.push({ type: 'log', text: `You know to look for it: ${h.c.def.label || 'something'}.`, cls: 'find' }); continue; }
      h.c.st.passive = true;
      const r = S.groupCheck(W.active(world), 'perception', h.c.def.tn || 8, -cfg().passivePenalty);
      if (r.ok) { h.c.st.found = true; ev.push({ type: 'log', text: foundText(h.c), cls: 'find' }); }
    }
  }
  const foundText = (c) => c.kind === 'trap' ? `You spot a trap ahead: ${c.def.label.toLowerCase()}.` : 'A seam in the wall: a hidden door.';

  // An active search: slower, better, and covers a wider area.
  function search(world) {
    const ex = world.explore;
    const ev = [];
    W.advance(world, cfg().searchMinutes);
    let found = 0;
    for (let y = ex.y - 2; y <= ex.y + 2; y++) for (let x = ex.x - 2; x <= ex.x + 2; x++) {
      const c = cell(world, x, y);
      const hidden = c.hidden || (c.kind === 'trap' && !c.st.found && !c.st.disarmed && !c.st.sprung);
      if (!hidden || !lineClear(world, ex.x, ex.y, x, y) && cheb(ex, { x, y }) > 1) continue;
      const r = S.groupCheck(W.active(world), 'perception', c.def.tn || 8, 3);
      if (r.ok || revealed(world, c)) { c.st.found = true; found++; ev.push({ type: 'log', text: foundText(c), cls: 'find' }); }
    }
    if (!found) ev.push({ type: 'log', text: 'You search carefully and find nothing new.' });
    wanderCheck(world, ev);
    return { events: ev };
  }

  // ---- Traps ------------------------------------------------------------------------
  function springTrap(world, c, ev) {
    c.st.sprung = true;
    const victims = W.active(world);
    if (!victims.length) return;
    const v = R.pick(victims.slice(0, Math.max(1, Math.min(2, victims.length)))); // the front rank takes it
    const lines = [c.def.text || 'A trap springs.'];
    for (const [a, n] of Object.entries(c.def.damage || {})) {
      C.damageAttr(v, a, n);
      lines.push(`${v.name} takes ${n} ${a} damage.`);
    }
    C.updateCondition(v);
    for (const l of lines) ev.push({ type: 'log', text: l, cls: 'hurt' });
    ev.push({ type: 'trap' });
    noise(world, 'trap');
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
        const d = cheb(me, { x, y });
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
        if (c.def.tn && !c.st.unlocked) {
          out.actions.push({ id: 'pick', label: 'Pick the lock', skill: 'lockpicking', tn: c.def.tn, who: S.best(party, 'lockpicking') });
          out.actions.push({ id: 'force', label: 'Break it open (loud)', skill: 'forcing', tn: c.def.tn + 3, who: S.best(party, 'forcing') });
        } else out.actions.push({ id: 'open', label: 'Open it' });
        break;
      }
      case 'trap':
        out.text = 'You have found it. Walking onto it would spring it.';
        out.actions.push({ id: 'disarm', label: 'Disarm it', skill: 'trapcraft', tn: c.def.disarm || 8, who: S.best(party, 'trapcraft') });
        out.actions.push({ id: 'hop', label: 'Jump over it', skill: 'forcing', tn: 7 });
        break;
      case 'npc': out.actions.push({ id: 'talk', label: `Talk to ${G.Content.world.npcs[c.def.npc].name}` }); break;
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
    const open = (why) => { c.st.open = true; c.st.unlocked = true; ev.push({ type: 'log', text: why, cls: 'find' }); };
    const roll = (skill, tn, bonus) => {
      const who = S.best(party, skill);
      const r = S.check(who, skill, tn, bonus);
      ev.push({ type: 'check', r });
      return r;
    };
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
      case 'disarm': {
        W.advance(world, 10);
        const r = roll('trapcraft', c.def.disarm || 8);
        if (r.ok) { c.st.disarmed = true; ev.push({ type: 'log', text: 'You disarm it carefully.', cls: 'find' }); }
        else if (r.fumble) { springTrap(world, c, ev); }
        else ev.push({ type: 'log', text: 'You cannot find how it works.' });
        break;
      }
      case 'hop': {
        const r = roll('forcing', 7, C.attr(party[0] || {}, 'SPD') ? 0 : 0);
        if (r.ok) { world.explore.x = f.x + DIRS[world.explore.dir][0]; world.explore.y = f.y + DIRS[world.explore.dir][1]; ev.push({ type: 'log', text: 'You leap the trap.' }); markSeen(world); }
        else { world.explore.x = f.x; world.explore.y = f.y; springTrap(world, c, ev); }
        break;
      }
      case 'pray': {
        if (c.st.done) { ev.push({ type: 'log', text: 'The shrine is quiet.' }); break; }
        c.st.done = true;
        for (const m of W.living(world)) { const a = G.Recovery.healTarget(m); if (a) C.healAttr(m, a, c.def.heal || 1); m.stamina = C.maxStamina(m); }
        ev.push({ type: 'log', text: c.def.text || 'Warmth. Something mends.', cls: 'find' });
        break;
      }
      default: break;
    }
    updateQuests(world, ev);
    wanderCheck(world, ev);
    return { events: ev };
  }

  // Noise wakes sleepers within `r` squares.
  function wake(world, x, y, r, ev) {
    const g = here(world);
    for (let yy = 0; yy < g.h; yy++) for (let xx = 0; xx < g.w; xx++) {
      const def = g.legend[g.rows[yy][xx]];
      if (!def || def.kind !== 'monster' || !def.asleep) continue;
      const st = state(world, xx, yy);
      if (st.woken || st.done) continue;
      if (cheb({ x, y }, { x: xx, y: yy }) <= r) { st.woken = true; ev.push({ type: 'log', text: 'Something stirs in the dark.', cls: 'hurt' }); }
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

  G.Explore = {
    DIRS, DIR_NAMES, grid, groundOf, place, lightRadius, here, cell, state, opaque, lineClear, cheb, markSeen, findChar,
    enter, leave, fall, front, turn, move, go, peek, path, search, facing, describe, act, scan, wake,
    encounterSpec, foeAwareness, resolveSquare, wanderingFor, minutesPerStep, noise, settleClock, wanderCheck,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
