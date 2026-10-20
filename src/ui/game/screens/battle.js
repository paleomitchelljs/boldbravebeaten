/*
 * Battle: the same top-down map you were walking, with the fighters on it. The map stays in view the whole
 * time. Under it, one compact row of dropdowns declares the active character's actions; the log is a strip over
 * the map that opens on a click; sheets and explanations are pop-ups. The engine, and the turn commands, are
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
      },
    };
    game.ui.battleApp = app;
    return app;
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
  // `bs` is what the last render knew: the encounter, the characters, and what the map should highlight.
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
      cell: g ? (x, y) => G.Explore.peek(w, x, y) : open,
      actors: [], marks: [],
      describe: (x, y) => {
        const id = occupant(enc, chars, x - ox, y - oy);
        if (!id) return '';
        const c = chars[id];
        return `${c.name} · stamina ${c.stamina}/${C.maxStamina(c)}${C.isActive(c) ? '' : c.status.dead ? ' · dead' : ' · down'}`;
      },
    };
    const live = enc.ids.filter((id) => chars[id] && enc.pos[id]);
    for (const id of live) {
      const c = chars[id];
      const p = enc.pos[id];
      const L = Sprites.look(c);
      const foesOf = live.filter((o) => (chars[o].side === 'party') !== (c.side === 'party') && C.isActive(chars[o]));
      let near = null, nd = 99;
      for (const o of foesOf) { const d = Math.abs(enc.pos[o].x - p.x) + Math.abs(enc.pos[o].y - p.y); if (d < nd) { nd = d; near = enc.pos[o]; } }
      const down = !C.isActive(c);
      sc.actors.push({
        id, x: p.x + ox, y: p.y + oy, kind: L.kind, tint: L.tint, size: L.size, tag: c.side === 'party' ? 'party' : 'enemy',
        flip: near ? near.x < p.x : c.side !== 'party', down, alpha: c.status.dead ? 0.6 : down ? 0.8 : 1, speed: 9, phase: id.length,
        bar: C.maxStamina(c) ? c.stamina / C.maxStamina(c) : 0,
        ring: map && id === map.actor ? 'rgba(255,224,130,0.95)' : map && map.targets[id] ? 'rgba(255,100,90,0.95)' : null,
      });
    }
    if (map) {
      for (const k of Object.keys(map.ghosts)) { const [x, y] = k.split(',').map(Number); sc.marks.push({ x: x + ox, y: y + oy, type: 'ghost' }); }
      for (const k of Object.keys(map.ground)) {
        const [x, y] = k.split(',').map(Number);
        const list = map.ground[k].filter((t) => t.f.kind !== 'dungeonWall');
        if (!list.length) continue;
        sc.marks.push({ x: x + ox, y: y + oy, type: list.some((t) => t.f.kind === 'fire' || /fire|hot|storm/i.test(t.f.kind)) ? 'target' : 'cast', text: P().TILE_GLYPH[list[list.length - 1].f.kind] || '·' });
      }
      if (map.reach) for (const k of Object.keys(map.reach)) { const [x, y] = k.split(',').map(Number); sc.marks.push({ x: x + ox, y: y + oy, type: map.late(map.reach[k]) ? 'late' : 'move', text: String(map.reach[k]) }); }
      if (map.castable) for (const k of Object.keys(map.castable)) { const [x, y] = k.split(',').map(Number); sc.marks.push({ x: x + ox, y: y + oy, type: 'cast' }); }
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

  function onCell(game, x, y) {
    const bs = game.ui.bs;
    if (!bs || game.overlay || game.ui.result) return;
    const ox = bs.arena ? bs.arena.ox : 0, oy = bs.arena ? bs.arena.oy : 0;
    const ax = x - ox, ay = y - oy;
    if (ax < 0 || ay < 0 || ax >= bs.enc.grid.w || ay >= bs.enc.grid.h) return;
    // A tap on a figure's head (the tile above its feet) counts as the figure, unless that square is a move or cast target.
    const m = bs.map, key = ax + ',' + ay;
    let id = occupant(bs.enc, bs.chars, ax, ay);
    const marked = m && ((m.reach && m.reach[key] != null) || (m.castable && m.castable[key]));
    if (!id && !marked) id = occupant(bs.enc, bs.chars, ax, ay + 1);
    P().cellClick(bs.app, bs.enc, bs.legal, ax, ay, id, m && m.reach, m && m.castable);
  }

  // ---- Pieces around the map ----------------------------------------------------------------------------------
  function initiativeBar(game, app, enc) {
    const chars = app.state.characters;
    const actor = Combat.currentActor(enc);
    const ids = enc.order.length ? enc.order.concat(enc.ids.filter((id) => !enc.order.includes(id))) : enc.ids;
    return h('nav', { class: 'initbar', 'aria-label': 'Initiative order' }, ids.filter((id) => chars[id]).map((id) => {
      const c = chars[id];
      const max = C.maxStamina(c);
      return h('button', { class: `init ${c.side === 'party' ? 'party' : 'enemy'} ${C.isActive(c) ? '' : 'down'} ${id === actor ? 'current' : ''}`,
        title: `${c.name} · stamina ${c.stamina}/${max}${enc.initiative[id] != null ? ` · initiative ${enc.initiative[id]}` : ''}`, onclick: () => game.openOverlay('sheet', { id }) },
      Sprites.portrait(c, 28), UI.bar(c.stamina, max));
    }));
  }

  function logStrip(game, enc) {
    const open = !!game.ui.logOpen;
    const lines = enc.log.slice(-(open ? 80 : 3));
    const box = h('div', { class: 'logbox' + (open ? ' open' : ''), role: 'log', title: open ? 'Click to shrink' : 'Click to read the whole fight', onclick: () => { game.ui.logOpen = !open; game.render(); } },
      lines.length ? lines.map((l) => h('p', { class: 'l ' + (l.cls || '') }, l.text)) : h('p', { class: 'l' }, 'The fight is about to begin.'));
    if (open) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 0);
    return box;
  }

  function declaredPop(game, app, enc) {
    const chars = app.state.characters;
    const live = enc.decls.filter((d) => d.declaredPass != null);
    if (!live.length) return null;
    const viewer = app.state.settings.gmView ? null : Combat.currentActor(enc);
    const openIt = !!game.ui.declOpen;
    return h('div', { class: 'declwrap' },
      ibtn('scroll', `Declared this round: ${live.length}`, () => { game.ui.declOpen = !openIt; game.render(); }, { on: openIt, text: String(live.length) }),
      openIt ? h('div', { class: 'declpop' }, live.map((d) => {
        const desc = viewer === null ? Combat.describeDecl(enc, chars, d, d.actor) : Combat.describeDecl(enc, chars, d, viewer);
        return h('div', { class: 'decl' + (desc.hidden ? ' hidden' : '') + (d.done ? ' done' : '') }, h('span', { class: 'p' }, 'P' + d.declaredPass), h('span', null, desc.text));
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
        h('button', { class: 'primary', onclick: () => (wiped ? game.go('gameover') : game.afterBattle()) }, 'Continue'),
        ibtn('pack', 'Pack', () => game.openOverlay('pack')),
        game.ui.finalLog ? ibtn('scroll', 'The last of it', () => game.openOverlay('text', { title: 'The last of it', text: game.ui.finalLog.map((l) => l.text).join('\n') })) : null));
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
      legal = enc.phase === 'declare' ? Combat.legalActions(enc, chars, Combat.currentActor(enc)) : null;
      if (enc.phase !== 'over') P().scheduleAI(app, enc);
      human = !!(legal && !P().aiControlled(app, chars[Combat.currentActor(enc)]));
      sync = human ? P().syncCommand(app, enc, legal) : null;
      const bu = P().bui(app);
      if (legal && !human && bu.mode !== 'place') { bu.mode = null; bu.pending = null; }
      game.ui.bs = { app, enc, chars, legal, arena: w.battle.arena, map: legal && human ? P().mapState(app, enc, legal) : null };
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
      game.ui.mv = UI.MapView.create({ cols: a ? a.w : Math.min(15, bs.enc.grid.w), rows: a ? a.h : Math.min(10, bs.enc.grid.h), scale: 3, label: 'The battlefield', scene: () => scene(game), onCell: (x, y) => onCell(game, x, y) });
      game.ui.mv.start();
    }
    const live = !game.ui.result;
    const spec = game.ui.spec || {};
    const status = !live ? 'Over' : enc.phase === 'declare' ? `Pass ${enc.pass}` : enc.phase === 'resolve' || enc.phase === 'resolving' ? `Pass ${enc.pass} · resolving` : '';
    const topExtra = live ? [
      h('span', { class: 'chip' }, enc.round ? `Round ${enc.round}` : 'Ready'),
      status ? h('span', { class: 'chip muted' }, status) : null,
      app.hooks.flee && game.world.battle.canFlee !== false ? ibtn('flee', 'Flee: speed against the quickest foe', () => app.hooks.flee(app, enc)) : null,
      declaredPop(game, app, enc),
    ] : null;
    return h('div', { class: 'battle-screen' },
      UI.Bits.topBar(game, { title: spec.name || 'Battle', extra: topExtra }),
      live ? initiativeBar(game, app, enc) : null,
      h('div', { class: 'stage' },
        game.ui.mv ? game.ui.mv.el : null,
        live ? logStrip(game, enc) : null,
        !live ? resultCard(game) : null),
      live ? P().phasePanel(app, enc, legal, sync) : null);
  };

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
