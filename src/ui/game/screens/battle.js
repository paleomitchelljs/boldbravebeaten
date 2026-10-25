/*
 * Battle: the same top-down map you were walking, with the fighters on it. The map stays in view the whole
 * time. The log is a strip just under it (inside the map's frame, so it never covers a square) that opens on a
 * click; under that, one compact row of dropdowns declares the active character's actions; sheets and explanations
 * are pop-ups. The engine, and the turn commands, are
 * the rules layer's (src/ui/views/battle.js exports the command panel; this file is the screen around it).
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, toast, ibtn, icon } = UI;
  const C = G.Character;
  const Combat = G.Combat;
  const World = G.World;
  const Battle = G.Battle;
  const Sprites = UI.Sprites;
  const P = () => UI.Views.battleParts;

  function battleApp(game) {
    const w = game.world;
    if (game.ui.battleApp && game.ui.battleApp.world === w) {
      game.ui.battleApp.state = Battle.table(w);
      return game.ui.battleApp;
    }
    const app = {
      world: w,
      state: Battle.table(w),
      ui: {},
      save: () => game.save(),
      render: () => game.render(),
      go: (tab, id) => { if (id) game.openOverlay('sheet', { id }); },
      removeCharacter: () => {},
      hooks: {
        autoStart: true,
        flee: (a, enc) => flee(game, enc),
        over: () => null,
        sheet: (id) => game.openOverlay('sheet', { id }),
        choose: true,       // the player picks every target; nothing is pre-selected
        react: (req, enc, chars) => askOnMap(game, req, enc, chars),
      },
    };
    game.ui.battleApp = app;
    return app;
  }

  // A reaction asked of one of the party: a card over the map; the fight waits for the answer.
  function askOnMap(game, req, enc, chars) {
    return new Promise((resolve) => {
      game.ui.reacting = { req, model: P().reactionModel(game.ui.battleApp, req, enc, chars), resolve };
      game.render();
    });
  }

  function answer(game, value) {
    const r = game.ui.reacting;
    if (!r) return;
    game.ui.reacting = null;
    r.resolve(value);
    game.render();
  }

  function reactionCard(game) {
    const r = game.ui.reacting;
    const m = r.model;
    return h('section', { class: 'popcard react' },
      h('div', { class: 'popcard-head' }, h('div', { class: 'stack tight grow' }, h('span', { class: 'label' }, `Reaction · ${C.fmtAP(m.ap)} AP left`), h('h3', null, m.title)), UI.tip(r.req.kind === 'defend' ? 'AP you spend now is gone from this round: from your turn if it is still to come. A defence that fails still costs its AP.' : 'A strike at a mover costs its AP now; a hit stops them where they are.')),
      h('p', { class: 'small muted' }, m.sub),
      h('div', { class: 'stack tight' },
        m.choices.map((c, i) => h('button', { class: 'act', onclick: () => answer(game, c.value) }, h('span', null, h('kbd', null, String(i + 1)), ' ', c.label), h('span', { class: 'small muted num' }, `${c.cost}${c.odds ? ' · ' + c.odds : ''}`))),
        h('button', { class: 'act none', onclick: () => answer(game, null) }, h('span', null, h('kbd', null, 'Esc'), ' ', m.none.label), h('span', { class: 'small muted' }, m.none.note))));
  }

  function flee(game, enc) {
    const w = game.world;
    const r = Battle.flee(w);
    for (const l of r.lines) World.logLine(w, l, 'fight');
    if (r.ok) {
      const res = Battle.finish(w, 'fled');
      if (w.explore) G.Explore.enter(w, w.place, '<');
      res.lines.unshift(...r.lines);
      game.ui.result = res;
      game.ui.finalLog = enc.log.slice(-12);
      game.save();
    } else toast('They stay on you.');
    game.render();
  }

  // ---- The scene -----------------------------------------------------------------------------------------------
  // `bs` is what the last render knew: the encounter, the characters, the command being built and what the map highlights.
  const INTENT = {
    strike: { color: '#ff6b5e', icon: 'sword' }, spell: { color: '#c79bff', icon: 'star' }, maneuver: { color: '#ffb35c', icon: 'hand' },
    other: { color: '#8fe3a8', icon: 'hand' }, guard: { color: '#8ab4ff', icon: 'shield' }, move: { color: '#7fdcff' }, far: { color: '#d9b055' },
  };
  const SELF_ICON = { windUp: 'sword', standUp: 'up', bandage: 'heart', drawSidearm: 'hand', pickUp: 'hand', drop: 'hand' };
  const isSpell = (e) => !!(e && e.option && e.option.spell);
  const ranged = (e) => !!(e && e.option && (e.option.maxRange || 1) > 1.5);

  function scene(game) {
    const bs = game.ui.bs;
    const w = game.world;
    const { enc, chars, map, arena } = bs;
    const ox = arena ? arena.ox : 0, oy = arena ? arena.oy : 0;
    const g = arena ? G.Explore.grid(arena.place) : null;
    const open = (x, y) => ({ kind: x >= 0 && y >= 0 && x < enc.grid.w && y < enc.grid.h ? 'floor' : 'rock', st: {} });
    const sc = {
      w: g ? g.w : enc.grid.w, h: g ? g.h : enc.grid.h,
      origin: { x: ox, y: oy },
      tileset: arena ? ((G.Content.world.places[arena.place] || {}).look || {}).tileset : null,
      cell: g ? (x, y) => G.Explore.peek(w, x, y) : open,
      actors: [], marks: [], lines: [], reticles: [], badges: [],
      describe: (x, y) => {
        const id = occupant(enc, chars, x - ox, y - oy);
        if (!id) return '';
        const c = chars[id];
        const e = bs.sync && bs.sync.entry;
        const t = e && e.targets ? e.targets.find((q) => q.id === id) : null;
        const prev = t && bs.map ? P().blowPreview(enc, chars, { decl: e.kind === 'strike' && !isSpell(e) ? { actor: bs.map.actor, target: id, type: 'strike', option: e.option } : {} }) : null;
        return `${c.name}${C.isActive(c) ? '' : c.status.dead ? ' (dead)' : ' (down)'}\nStamina ${c.stamina}/${C.maxStamina(c)}${t ? ` · ${t.distance} sq${t.inReach ? '' : t.tooClose ? ', too close' : ', out of reach'}` : ''}${prev ? `\nIf it lands: ${prev.text}` : ''}`;
      },
    };
    const at = (p) => ({ x: p.x + ox, y: p.y + oy });
    const entry = bs.sync && bs.sync.entry;
    const cmd = bs.app && P().bui(bs.app).cmd;
    const actor = map && map.actor;
    const live = enc.ids.filter((id) => chars[id] && enc.pos[id]);
    for (const id of live) {
      const c = chars[id];
      const p = enc.pos[id];
      const L = Sprites.look(c);
      const foesOf = live.filter((o) => (chars[o].side === 'party') !== (c.side === 'party') && C.isActive(chars[o]));
      let near = null, nd = 99;
      for (const o of foesOf) { const d = Math.abs(enc.pos[o].x - p.x) + Math.abs(enc.pos[o].y - p.y); if (d < nd) { nd = d; near = enc.pos[o]; } }
      const down = !C.isActive(c);
      // The active character wears a gold ring; someone the chosen action could be aimed at, a faint one.
      // (Friends only count for actions meant for friends: an attack can hit an ally, but rings on the party would be noise.)
      const forFriends = entry && (entry.kind === 'other' || (isSpell(entry) && entry.option.target === 'ally'));
      const candidate = map && map.targets[id] && !(cmd && cmd.target === id) && (forFriends || (actor && chars[actor] && chars[actor].side !== c.side));
      sc.actors.push({
        id, x: p.x + ox, y: p.y + oy, kind: L.kind, tint: L.tint, size: L.size, art: L.art, artTint: L.artTint, artScale: L.artScale, artSize: L.artSize, tag: c.side === 'party' ? 'party' : 'enemy',
        flip: near ? near.x < p.x : c.side !== 'party', face: near ? { x: near.x + ox, y: near.y + oy } : null, down, alpha: c.status.dead ? 0.6 : down ? 0.8 : 1, speed: 9, phase: id.length,
        bar: C.maxStamina(c) ? c.stamina / C.maxStamina(c) : 0,
        ring: id === actor ? 'rgba(255,224,130,0.95)' : candidate ? 'rgba(255,110,95,0.4)' : null,
      });
    }
    if (map) {
      for (const k of Object.keys(map.ground)) {
        const [x, y] = k.split(',').map(Number);
        const list = map.ground[k].filter((t) => t.f.kind !== 'dungeonWall');
        if (!list.length) continue;
        sc.marks.push({ x: x + ox, y: y + oy, type: list.some((t) => /fire|hot|storm/i.test(t.f.kind)) ? 'target' : 'cast', text: P().TILE_GLYPH[list[list.length - 1].f.kind] || '·' });
      }
    }
    // Where the party has already said it will go this round: a faint ghost of each mover at the end of the move.
    for (const d of enc.decls) {
      if (d.type !== 'move' || d.done || !chars[d.actor] || chars[d.actor].side !== 'party' || !d.to) continue;
      const L = Sprites.look(chars[d.actor]);
      sc.actors.push({ id: 'ghost-' + d.actor + '-' + d.to.x + ',' + d.to.y, x: d.to.x + ox, y: d.to.y + oy, kind: L.kind, tint: L.tint, size: L.size, art: L.art, artTint: L.artTint, artScale: L.artScale, artSize: L.artSize, alpha: 0.28, speed: 30 });
    }
    // A reaction being asked: the blow's line and the one it threatens.
    const rq = game.ui.reacting && game.ui.reacting.req;
    if (rq) {
      const from = rq.kind === 'defend' ? rq.attacker : rq.actor, to = rq.kind === 'defend' ? rq.actor : rq.target;
      if (enc.pos[from] && enc.pos[to]) {
        sc.lines.push({ pts: [at(enc.pos[from]), at(enc.pos[to])], color: rq.kind === 'defend' ? INTENT.strike.color : INTENT.guard.color, style: 'solid', alpha: 0.9 });
        sc.reticles.push({ x: enc.pos[to].x + ox, y: enc.pos[to].y + oy, color: rq.kind === 'defend' ? INTENT.strike.color : INTENT.guard.color, strong: true });
        sc.badges.push({ id: rq.actor, icon: rq.kind === 'defend' ? 'shield' : 'sword', color: INTENT.guard.color });
      }
    }
    if (!map || !actor || !entry || !cmd) return sc;
    const me = enc.pos[actor];
    const hv = game.ui.mv && game.ui.mv.hover ? { x: game.ui.mv.hover.x - ox, y: game.ui.mv.hover.y - oy } : null;
    const hk = hv ? hv.x + ',' + hv.y : null;
    // What the active character has already declared this round, faintly: lines to its targets.
    for (const d of enc.decls) {
      if (d.actor !== actor || d.done || !d.target || !enc.pos[d.target]) continue;
      sc.lines.push({ pts: [at(me), at(enc.pos[d.target])], color: d.option && d.option.spell ? INTENT.spell.color : INTENT.strike.color, style: 'dash', alpha: 0.3 });
    }
    // The choice being made now.
    if (entry.kind === 'move' && map.reach) {
      for (const k of Object.keys(map.reach)) {
        const [x, y] = k.split(',').map(Number);
        const pick = cmd.moveTo && cmd.moveTo.x === x && cmd.moveTo.y === y;
        sc.marks.push({ x: x + ox, y: y + oy, type: map.late(map.reach[k]) ? 'reachLate' : 'reach', text: pick || k === hk ? String(map.reach[k]) : null });
      }
      const dest = cmd.moveTo || (hv && map.reach[hk] != null ? hv : null);
      if (dest) {
        const L = Sprites.look(chars[actor]);
        const strong = !!cmd.moveTo;
        sc.actors.push({ id: 'phantom', x: dest.x + ox, y: dest.y + oy, kind: L.kind, tint: L.tint, size: L.size, art: L.art, artTint: L.artTint, artScale: L.artScale, artSize: L.artSize, alpha: strong ? 0.55 : 0.32, flip: dest.x < me.x, speed: 16 });
        const route = G.Terrain && enc.tiles && Object.keys(enc.tiles).length ? G.Terrain.path(enc, me, dest, chars[actor]) : [dest];
        sc.lines.push({ pts: [at(me)].concat(route.map(at)), color: map.late(map.reach[dest.x + ',' + dest.y]) ? INTENT.far.color : INTENT.move.color, style: 'dots', alpha: strong ? 0.95 : 0.5 });
        if (strong) sc.reticles.push({ x: dest.x + ox, y: dest.y + oy, color: INTENT.move.color, strong: true });
      }
    } else if (entry.square && map.castable) {
      for (const k of Object.keys(map.castable)) { const [x, y] = k.split(',').map(Number); sc.marks.push({ x: x + ox, y: y + oy, type: 'reach' }); }
      const aim = cmd.castAt || (hv && map.castable[hk] ? hv : null);
      if (aim) {
        const r = (entry.option.spell && entry.option.spell.radius) || 0;
        for (let y = aim.y - r; y <= aim.y + r; y++) for (let x = aim.x - r; x <= aim.x + r; x++) if (x >= 0 && y >= 0 && x < enc.grid.w && y < enc.grid.h) sc.marks.push({ x: x + ox, y: y + oy, type: 'area' });
        sc.lines.push({ pts: [at(me), at(aim)], color: INTENT.spell.color, style: 'dash', alpha: cmd.castAt ? 0.9 : 0.45 });
        sc.reticles.push({ x: aim.x + ox, y: aim.y + oy, color: INTENT.spell.color, strong: !!cmd.castAt });
      }
    } else if (entry.targets) {
      const look = isSpell(entry) ? INTENT.spell : entry.kind === 'maneuver' ? INTENT.maneuver : entry.kind === 'other' ? INTENT.other : INTENT.strike;
      const aimAt = (id, strong) => {
        const t = entry.targets.find((q) => q.id === id);
        if (!t || !enc.pos[id]) return;
        const col = t.inReach ? look.color : INTENT.far.color;
        sc.lines.push({ pts: [at(me), at(enc.pos[id])], color: col, style: ranged(entry) || isSpell(entry) ? 'dash' : 'solid', alpha: strong ? 0.85 : 0.35 });
        sc.reticles.push({ x: enc.pos[id].x + ox, y: enc.pos[id].y + oy, color: col, strong });
        if (strong) sc.badges.push({ id, icon: look.icon, color: col });
      };
      if (cmd.target) aimAt(cmd.target, true);
      const hoverId = hv ? occupant(enc, chars, hv.x, hv.y) || occupant(enc, chars, hv.x, hv.y + 1) : null;
      if (hoverId && hoverId !== cmd.target) aimAt(hoverId, false);
    } else if (entry.kind === 'guard' || entry.kind === 'ready') {
      sc.badges.push({ id: actor, icon: entry.kind === 'ready' ? 'sword' : 'shield', color: INTENT.guard.color });
      if (cmd.vs && enc.pos[cmd.vs]) sc.lines.push({ pts: [at(me), at(enc.pos[cmd.vs])], color: INTENT.guard.color, style: 'dash', alpha: 0.5 });
    } else {
      sc.badges.push({ id: actor, icon: SELF_ICON[entry.type] || 'dots', color: INTENT.other.color });
    }
    return sc;
  }

  function occupant(enc, chars, x, y) {
    let best = null;
    for (const id of enc.ids) {
      const p = enc.pos[id];
      if (!p || p.x !== x || p.y !== y) continue;
      if (!best || (C.isActive(chars[id]) && !C.isActive(chars[best]))) best = id;
    }
    return best;
  }

  // Clicking the map builds the command: a first click chooses (a target, a square), a second click on the same thing
  // commits it. A figure that is not a target opens its sheet.
  function onCell(game, x, y) {
    const bs = game.ui.bs;
    if (!bs || game.overlay || game.ui.result) return;
    const ox = bs.arena ? bs.arena.ox : 0, oy = bs.arena ? bs.arena.oy : 0;
    const ax = x - ox, ay = y - oy;
    if (ax < 0 || ay < 0 || ax >= bs.enc.grid.w || ay >= bs.enc.grid.h) return;
    const m = bs.map, key = ax + ',' + ay;
    let id = occupant(bs.enc, bs.chars, ax, ay);
    const marked = m && ((m.reach && m.reach[key] != null) || (m.castable && m.castable[key]));
    if (!id && !marked) id = occupant(bs.enc, bs.chars, ax, ay + 1); // a click on a figure's head
    const entry = bs.sync && bs.sync.entry;
    const cmd = bs.app && P().bui(bs.app).cmd;
    const actor = m && m.actor;
    const same = (p) => p && p.x === ax && p.y === ay;
    if (entry && cmd && actor) {
      if (entry.kind === 'move' && m.reach && m.reach[key] != null) {
        if (same(cmd.moveTo)) P().declare(bs.app, bs.enc, { actor, type: 'move', to: { x: ax, y: ay } });
        else { cmd.moveTo = { x: ax, y: ay }; game.render(); }
        return;
      }
      if (entry.square && m.castable && m.castable[key]) {
        if (same(cmd.castAt)) P().declare(bs.app, bs.enc, { actor, type: 'cast', option: entry.option, at: { x: ax, y: ay } });
        else { cmd.castAt = { x: ax, y: ay }; game.render(); }
        return;
      }
      if (entry.targets && id && entry.targets.some((t) => t.id === id)) {
        if (cmd.target === id) { if (entry.affordable) P().declareEntry(bs.app, bs.enc, actor, entry, cmd); else toast(entry.why || 'Not enough AP'); }
        else { cmd.target = id; game.render(); }
        return;
      }
      if (!id && (cmd.moveTo || cmd.castAt)) { cmd.moveTo = null; cmd.castAt = null; game.render(); return; }
    }
    if (id) game.openOverlay('sheet', { id });
  }

  // ---- What happened when a pass resolved: lunges, bolts and numbers over the figures -----------------------------
  // Declarations aimed at someone, which get a lunge or a bolt when they land.
  const AIMED = ['strike', 'cast', 'trip', 'disarm', 'shove', 'clinch', 'grapple', 'pin', 'throw', 'bait'];
  const DEFEND = { blocks: 'Blocked', parries: 'Parried', dodges: 'Dodged', slips: 'Dodged', catches: 'Caught', deflects: 'Deflected' };

  function snapshot(enc, chars) {
    const s = { enc, log: enc.log.length, done: new Set(enc.decls.filter((d) => d.done)), st: {}, dmg: {}, down: {}, dead: {} };
    for (const id of enc.ids) {
      const c = chars[id];
      if (!c) continue;
      s.st[id] = c.stamina; s.dmg[id] = Object.assign({}, c.damage); s.down[id] = !C.isActive(c); s.dead[id] = !!c.status.dead;
    }
    return s;
  }

  function effects(game, enc, chars) {
    const prev = game.ui.snap;
    const now = snapshot(enc, chars);
    game.ui.snap = now;
    const mv = game.ui.mv;
    if (!mv || !mv.popup || !prev || prev.enc !== enc) return;
    const delay = {}; // when each struck figure's numbers should appear, so a pass plays out in order
    let i = 0;
    const struck = new Set();
    for (const d of enc.decls) {
      if (!d.done || prev.done.has(d) || !d.target || !enc.pos[d.actor] || !enc.pos[d.target] || !AIMED.includes(d.type)) continue;
      const t0 = i++ * 260;
      const a = enc.pos[d.actor], b = enc.pos[d.target], ox = game.ui.bs.arena ? game.ui.bs.arena.ox : 0, oy = game.ui.bs.arena ? game.ui.bs.arena.oy : 0;
      const far = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > 1;
      if (far || (d.option && d.option.spell)) mv.bolt(d.actor, d.target, d.option && d.option.spell ? '#d7b4ff' : '#ffe9a0', t0, d.option && d.option.spell ? d.option.spell.element || 'force' : null);
      else mv.lunge(d.actor, b.x + ox, b.y + oy, t0);
      if (delay[d.target] == null) delay[d.target] = t0 + (far ? 200 : 140);
      struck.add(d.target);
    }
    const last = i * 260;
    // Defences and misses, from the log lines written since last time.
    const names = enc.ids.filter((id) => chars[id]).map((id) => [chars[id].name, id]).sort((p, q) => q[0].length - p[0].length);
    const who = (text) => { const hit = names.find(([n]) => text.startsWith(n + ' ') || text.startsWith(n + "'")); return hit ? hit[1] : null; };
    for (const l of enc.log.slice(prev.log)) {
      const id = who(l.text);
      if (!id) continue;
      if (l.cls === 'defend') { const verb = (l.text.slice(chars[id].name.length + 1).split(' ')[0] || ''); if (DEFEND[verb]) mv.popup(id, /SHATTERS|BREAKS|destroyed/.test(l.text) ? 'Shield broken' : DEFEND[verb], '#9fd1ff', delay[id] != null ? delay[id] : last); }
      else if (l.cls === 'fizzle' && /astray|illusion/.test(l.text)) mv.popup(id, 'Miss', '#cfd6da', last);
    }
    // Numbers: stamina for those struck, wounds and falls for anyone.
    for (const id of enc.ids) {
      if (!chars[id] || prev.st[id] == null) continue;
      const t = delay[id] != null ? delay[id] : last;
      const lost = prev.st[id] - chars[id].stamina;
      if (struck.has(id) && lost > 0) { mv.popup(id, '−' + lost, '#ffd166', t); mv.shudder(id, t); if (mv.hurt) mv.hurt(id, t); }
      for (const [k, v] of Object.entries(chars[id].damage || {})) {
        const more = v - ((prev.dmg[id] || {})[k] || 0);
        if (more > 0) { mv.popup(id, `−${more} ${k}`, '#ff6b6b', t + 260); mv.shudder(id, t); if (mv.hurt) mv.hurt(id, t, true); }
      }
      if (chars[id].status.dead && !prev.dead[id]) mv.popup(id, 'Dead', '#ff4d4d', t + 520);
      else if (!C.isActive(chars[id]) && !prev.down[id]) mv.popup(id, 'Down', '#c8c8c8', t + 520);
    }
  }

  // ---- Pieces around the map ----------------------------------------------------------------------------------
  function initiativeBar(game, app, enc) {
    const chars = app.state.characters;
    const actor = Combat.currentActor(enc);
    const ids = enc.order.length ? enc.order.concat(enc.ids.filter((id) => !enc.order.includes(id))) : enc.ids;
    return h('nav', { class: 'initbar', 'aria-label': 'Initiative order' }, ids.filter((id) => chars[id]).map((id) => {
      const c = chars[id];
      const max = C.maxStamina(c);
      const mine = c.side === 'party';
      const ap = enc.ap[id] != null ? Combat.apLeft(enc, id) : null;
      return h('button', { class: `init ${mine ? 'party' : 'enemy'} ${C.isActive(c) ? '' : 'down'} ${id === actor || id === enc.order[enc.turn] ? 'current' : ''} ${enc.turnDone && enc.turnDone[id] ? 'done' : ''}`,
        title: `${c.name} · stamina ${c.stamina}/${max}${enc.initiative[id] != null ? ` · initiative ${enc.initiative[id]}` : ''}${mine && ap != null ? ` · ${C.fmtAP(ap)} AP left` : ''}${enc.turnDone && enc.turnDone[id] ? ' · turn taken' : ''}`, onclick: () => game.openOverlay('sheet', { id }) },
      Sprites.portrait(c, 28), UI.bar(c.stamina, max), mine && ap != null ? h('span', { class: 'init-ap num' }, C.fmtAP(ap)) : null);
    }));
  }

  function logStrip(game, enc) {
    const open = !!game.ui.logOpen;
    const lines = enc.log.slice(-(open ? 80 : 2));
    const box = h('div', { class: 'logbox' + (open ? ' open' : ''), role: 'log', title: open ? 'Click to shrink' : 'Click to read the whole fight', onclick: () => { game.ui.logOpen = !open; game.render(); } },
      lines.length ? lines.map((l) => h('p', { class: 'l ' + (l.cls || '') }, l.text)) : h('p', { class: 'l' }, 'The fight is about to begin.'));
    if (open) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 0);
    return box;
  }

  function declaredPop(game, app, enc) {
    const chars = app.state.characters;
    const live = enc.decls.filter((d) => chars[d.actor]);
    if (!live.length) return null;
    const viewer = app.state.settings.gmView ? null : Combat.currentActor(enc);
    const openIt = !!game.ui.declOpen;
    return h('div', { class: 'declwrap' },
      ibtn('scroll', `This round so far: ${live.length} actions`, () => { game.ui.declOpen = !openIt; game.render(); }, { on: openIt, text: String(live.length) }),
      openIt ? h('div', { class: 'declpop' }, live.map((d) => {
        const desc = viewer === null ? Combat.describeDecl(enc, chars, d, d.actor) : Combat.describeDecl(enc, chars, d, viewer);
        return h('div', { class: 'decl' + (desc.hidden ? ' hidden' : '') }, h('span', { class: 'p' }, d.reaction || d.opportunity ? '↺' : '•'), h('span', null, desc.text));
      })) : null);
  }

  function resultCard(game) {
    const res = game.ui.result;
    const w = game.world;
    const title = res.result === 'won' ? 'Victory' : res.result === 'fled' ? 'You got away' : res.result === 'lost' ? 'Defeat' : 'No one stands';
    const wiped = World.wiped(w);
    return h('section', { class: 'popcard result ' + res.result },
      h('div', { class: 'popcard-head' }, h('h2', { class: 'grow' }, title), game.ui.spec && game.ui.spec.name ? h('span', { class: 'label' }, game.ui.spec.name) : null),
      res.lines.length ? h('div', { class: 'stack tight' }, res.lines.map((l) => h('p', { class: 'small' }, l))) : null,
      res.loot && res.loot.length ? h('div', { class: 'stack tight' }, h('span', { class: 'label' }, 'Spoils'), h('ul', { class: 'loot-list' }, res.loot.map((l) => h('li', null, l)))) : null,
      res.result === 'fled' ? h('p', { class: 'muted small' }, 'You run for the stairs. The foes stay where they were.') : null,
      res.result === 'won' ? h('p', { class: 'small muted' }, 'Gear that fell with them is in the pack. Take what suits you from the Pack.') : null,
      h('div', { class: 'row' },
        wiped || !G.CONFIG.afterBattle
          ? h('button', { class: 'primary', onclick: () => (wiped ? game.go('gameover') : game.afterBattle()) }, 'Continue')
          : [
            h('button', { class: 'primary', title: `${G.CONFIG.afterBattle.minutes} minutes: stamina back to full (weariness stays until you camp), gear patched up`, onclick: () => { World.restAndRepair(w); game.afterBattle(); } }, 'Rest and repair'),
            h('button', { title: 'Move on at once: no time passes, stamina stays where it is', onclick: () => game.afterBattle() }, 'Press on'),
          ],
        ibtn('pack', 'Pack', () => game.openOverlay('pack')),
        game.ui.finalLog ? ibtn('scroll', 'The last of it', () => game.openOverlay('text', { title: 'The last of it', text: game.ui.finalLog.map((l) => l.text).join('\n') })) : null));
  }

  // A banner across the map when a new round or a new turn begins. It is part of each render, so its animation is set
  // back by the time already gone and it simply stops being drawn once it has played.
  const BANNER_MS = 1300;
  function turnBanner(game, enc, chars) {
    const id = (enc.phase === 'turn' || enc.phase === 'acting') && enc.order[enc.turn];
    if (!id || !chars[id]) return null;
    const key = enc.round + ':' + enc.turn + ':' + id;
    const b = game.ui.banner;
    const now = Date.now();
    if (!b || b.key !== key) game.ui.banner = { key, at: now, round: !b || b.inRound !== enc.round ? enc.round : null, inRound: enc.round };
    const cur = game.ui.banner;
    const gone = now - cur.at;
    if (gone > BANNER_MS) return null;
    if (gone < BANNER_MS) setTimeout(() => { if (game.ui.banner === cur && game.screen === 'battle') game.render(); }, BANNER_MS - gone + 20);
    const c = chars[id];
    return h('div', { class: 'turn-banner ' + (c.side === 'party' ? 'party' : 'enemy'), style: { animationDelay: `-${gone}ms` }, 'aria-live': 'polite' },
      cur.round ? h('span', { class: 'tb-round' }, `Round ${cur.round}`) : null,
      h('span', { class: 'tb-who' }, c.name), h('span', { class: 'tb-sub' }, c.side === 'party' ? 'your turn' : 'their turn'));
  }

  // ---- The screen ------------------------------------------------------------------------------------------------------
  UI.Screens.battle = function (game) {
    const w = game.world;
    if (!game.ui.result && !w.battle) { game.go(w.explore ? 'explore' : 'town'); return h('div'); }
    const hadBattle = !!w.battle;
    let app = null, enc = null, legal = null, sync = null, human = false;
    if (hadBattle) {
      app = battleApp(game);
      enc = w.battle.enc;
      const chars = app.state.characters;
      legal = enc.phase === 'turn' ? Combat.legalActions(enc, chars, Combat.currentActor(enc)) : null;
      if (enc.phase !== 'over') P().scheduleAI(app, enc);
      human = !!(legal && !P().aiControlled(app, chars[Combat.currentActor(enc)]));
      sync = human ? P().syncCommand(app, enc, legal) : null;
      const bu = P().bui(app);
      if (legal && !human && bu.mode !== 'place') { bu.mode = null; bu.pending = null; }
      game.ui.bs = { app, enc, chars, legal, sync, arena: w.battle.arena, map: legal && human ? P().mapState(app, enc, legal) : null };
      app.ui.lastReach = game.ui.bs.map && game.ui.bs.map.reach;
      game.ui.spec = w.battle.spec;
      if (enc.phase === 'over') {
        game.ui.finalLog = enc.log.slice(-12);
        game.ui.result = Battle.finish(w);
        game.save();
      }
    }
    const bs = game.ui.bs;
    if (!game.ui.mv && bs) {
      UI.MapView.preload();
      const a = bs.arena;
      game.ui.mv = UI.MapView.create({ cols: a ? a.w : Math.min(15, bs.enc.grid.w), rows: a ? a.h : Math.min(10, bs.enc.grid.h), scale: UI.MapView.scaleFor(a && a.place, 3), label: 'The battlefield', scene: () => scene(game), onCell: (x, y) => onCell(game, x, y) });
      game.ui.mv.start();
    }
    if (bs && bs.enc) effects(game, bs.enc, bs.chars);
    const live = !game.ui.result;
    const spec = game.ui.spec || {};
    const topExtra = live ? [
      h('span', { class: 'chip' }, enc.round ? `Round ${enc.round}` : 'Ready'),
      app.hooks.flee && game.world.battle.canFlee !== false ? ibtn('flee', 'Flee: speed against the quickest foe', () => app.hooks.flee(app, enc), { disabled: !!game.ui.reacting || enc.phase === 'acting' || !!P().bui(app).busy }) : null,
      declaredPop(game, app, enc),
    ] : null;
    return h('div', { class: 'battle-screen' + (live ? '' : ' over') },
      UI.Bits.topBar(game, { title: spec.name || 'Battle', extra: topExtra }),
      h('div', { class: 'battle-body' },
        h('div', { class: 'battle-main' },
          live ? initiativeBar(game, app, enc) : null,
          h('div', { class: 'stage' },
            game.ui.mv ? game.ui.mv.el : null,
            live ? logStrip(game, enc) : null,
            live ? turnBanner(game, enc, bs.chars) : null,
            live && game.ui.reacting ? reactionCard(game) : null,
            !live ? resultCard(game) : null)),
        live ? h('div', { class: 'battle-side' }, P().phasePanel(app, enc, legal, sync)) : null));
  };

  // Enter commits the action being built; Escape lets go of a chosen target or square.
  if (typeof document !== 'undefined' && !UI._battleKeys) {
    UI._battleKeys = true;
    document.addEventListener('keydown', (e) => {
      const game = UI.Game;
      if (!game || game.screen !== 'battle' || game.overlay || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target && e.target.tagName) || '')) return;
      const r = game.ui.reacting;
      if (r) {
        const n = Number(e.key);
        if (n >= 1 && n <= r.model.choices.length) { e.preventDefault(); answer(game, r.model.choices[n - 1].value); }
        else if (e.key === 'Escape') { e.preventDefault(); answer(game, null); }
        return;
      }
      if (e.key === 'Enter') { const b = document.querySelector('.battle-screen .cmd-go .primary'); if (b && !b.disabled) { e.preventDefault(); b.click(); } }
      if (e.key === 'e' || e.key === 'E') { const b = document.querySelector('.battle-screen .cmd-end .end'); if (b && !b.disabled) { e.preventDefault(); b.click(); } }
      const n = Number(e.key);
      if (n >= 1 && n <= 9) { const tabs = document.querySelectorAll('.battle-screen .cmd-tab'); if (tabs[n - 1]) { e.preventDefault(); tabs[n - 1].click(); } }
      if (e.key === 'Escape') {
        const bs = game.ui.bs;
        const cmd = bs && bs.app && P().bui(bs.app).cmd;
        if (cmd && (cmd.target || cmd.moveTo || cmd.castAt)) { cmd.target = null; cmd.moveTo = null; cmd.castAt = null; game.render(); }
      }
    });
  }

  UI.Screens.gameover = function (game) {
    const w = game.world;
    const survivors = World.living(w);
    const auto = G.Save.read('auto');
    return h('div', { class: 'gameover stack' },
      h('div', { class: 'panel stack' },
        h('h1', null, survivors.length ? 'The company falls' : 'None are left'),
        h('p', { class: 'muted' }, survivors.length ? 'Everyone who could stand is down. The dead are dead. Whatever walks away from a fight like this does not always take its time.' : 'There is no one to carry the dead home.'),
        h('div', { class: 'row' },
          survivors.length ? h('button', { class: 'primary', onclick: () => { const r = G.Town.leftForDead(w); if (r.ok) { game.save(); game.go('town'); } } }, 'Wake in Stonebridge (lose half your gold)') : null,
          auto ? h('button', { onclick: () => game.loadWorld(auto.world) }, 'Reload the last autosave') : null,
          h('button', { onclick: () => game.go('title') }, 'Title screen'))));
  };
})(globalThis.BBB);
