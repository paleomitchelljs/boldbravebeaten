/*
 * Exploring: the dungeon seen from above. Arrow keys or WASD walk, a click on a square walks there, a click on
 * a person or thing next to you deals with it, a click on a party member opens their sheet. Everything else is
 * an icon with a tooltip; prompts are small cards over the map.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, toast, ibtn, icon } = UI;
  const Explore = G.Explore;
  const World = G.World;
  const Bits = UI.Bits;
  const Sprites = UI.Sprites;

  // ---- Turning events into screen state ---------------------------------------------------------------
  function handle(game, events) {
    const w = game.world;
    for (const e of events) {
      switch (e.type) {
        case 'log': World.logLine(w, e.text, e.cls); break;
        case 'check': World.logLine(w, Bits.checkText(e.r), e.r.ok ? 'find' : 'check'); break;
        case 'bump': game.ui.bump = e.text; break;
        case 'prompt': game.ui.prompt = { type: 'face' }; break;
        case 'encounter': game.ui.prompt = { type: 'encounter', x: e.x, y: e.y, def: e.def, aware: true }; if (e.check) World.logLine(w, Bits.checkText(e.check), 'check'); break;
        case 'unseen':
          if (!(game.ui.prompt && game.ui.prompt.type === 'encounter')) game.ui.prompt = { type: 'encounter', x: e.x, y: e.y, def: e.def, aware: false };
          if (e.check) World.logLine(w, Bits.checkText(e.check), 'find');
          break;
        case 'stairs': game.ui.prompt = { type: 'stairs', def: e.def }; break;
        case 'note': game.openOverlay('text', { title: 'You read', text: e.text }); break;
        case 'loot': game.openOverlay('loot', { title: e.title, lines: e.lines }); break;
        case 'trap': game.ui.hurt = Date.now(); break;
        default: break;
      }
    }
    if (World.wiped(w)) { game.go('gameover'); return false; }
    return true;
  }

  function act(game, fn) {
    const out = fn();
    const events = out && out.events ? out.events : [];
    if (!handle(game, events)) return false;
    game.save();
    game.render();
    return true;
  }

  const locked = (game) => game.ui.prompt && game.ui.prompt.type === 'encounter' && game.ui.prompt.aware;

  // The party walks in a line: each follower stands where the one ahead stood a step ago.
  function trail(game) {
    const ex = game.world.explore;
    if (!game.ui.trail) game.ui.trail = [];
    return game.ui.trail;
  }

  function step(game, d) {
    if (locked(game)) { toast('They have seen you. Fight or talk.'); return false; }
    game.ui.prompt = null;
    const ex = game.world.explore;
    const before = { x: ex.x, y: ex.y };
    let moved = false;
    const ok = act(game, () => { const r = Explore.go(game.world, d); moved = r.moved; return r; });
    if (moved) { const t = trail(game); t.unshift(before); t.length = Math.min(t.length, 6); }
    return ok && moved;
  }

  function stopWalk(game) { if (game.ui.walk) { clearTimeout(game.ui.walk.timer); game.ui.walk = null; } }

  // Click to walk: one step at a time, stopping at anything that needs an answer.
  function walkTo(game, x, y) {
    stopWalk(game);
    const dirs = Explore.path(game.world, x, y);
    if (!dirs.length) return false;
    const run = { dirs, timer: null };
    game.ui.walk = run;
    const next = () => {
      if (game.ui.walk !== run || game.screen !== 'explore' || game.overlay) { return; }
      const d = run.dirs.shift();
      if (d == null) { game.ui.walk = null; return; }
      const before = game.world.explore.x + ',' + game.world.explore.y;
      const moved = step(game, d);
      if (game.ui.walk !== run) return;
      if (!moved || game.ui.prompt || !run.dirs.length) { if (game.ui.walk === run) game.ui.walk = null; return; }
      void before;
      run.timer = setTimeout(next, 150);
    };
    next();
    return true;
  }

  function interact(game) {
    const w = game.world;
    const f = Explore.facing(w);
    if (!f.actions.length && f.kind !== 'door') { toast(f.kind === 'wall' || f.kind === 'rock' ? 'Just a wall.' : 'Nothing to do here.'); return; }
    if (f.kind === 'door') { step(game, w.explore.dir); return; }
    game.ui.prompt = { type: 'face' };
    game.render();
  }

  function search(game) { game.ui.prompt = null; act(game, () => Explore.search(game.world)); }

  async function camp(game) {
    const w = game.world;
    if (game.ui.busy) return;
    game.ui.busy = true;
    const r = await G.Town.campRest(w);
    game.ui.busy = false;
    if (r.interrupted) {
      World.logLine(w, 'You are woken by something in the dark.', 'fight');
      if (r.check) World.logLine(w, Bits.checkText(r.check), 'check');
      const surprise = World.active(w).some((c) => G.Character.rank(c, 'danger_sense')) ? null : r.surprise;
      game.startBattle(r.interrupted, { surprise, factor: 0.5, ctx: { camp: true } });
      return;
    }
    const herb = G.Skills.bestCheck(World.active(w), 'herbalism', 8, 0);
    const lines = r.lines.slice();
    if (herb.ok && G.Character.rank(G.Skills.best(World.active(w), 'herbalism'), 'herbalism')) { World.addGood(w, 'herbs', 1 + (herb.margin >= 4 ? 1 : 0)); lines.push('A forager among you finds hedge herbs.'); }
    game.save();
    game.openOverlay('text', { title: 'You make camp', text: lines.length ? lines.join('\n') : 'Eight hours of rest. Everyone is restored.' });
    game.render();
  }

  function toggleSneak(game) {
    const ex = game.world.explore;
    ex.sneak = !ex.sneak;
    World.logLine(game.world, ex.sneak ? 'You move quietly (slower). Heavy armor will still ring.' : 'You walk normally.', 'info');
    game.render();
  }

  // ---- Prompts --------------------------------------------------------------------------------------------
  function startFight(game, p, ambush) {
    const w = game.world;
    const spec = Explore.encounterSpec(w, p.def);
    const opts = { ctx: { x: p.x, y: p.y, back: true } };
    if (ambush) { opts.surprise = 'enemy'; opts.factor = G.Battle.ambushFactor(w); World.logLine(w, 'You strike from hiding.', 'fight'); }
    game.startBattle(Object.assign({ name: p.def.label }, spec), opts);
  }

  const closeBtn = (game) => ibtn('close', 'Close', () => { game.ui.prompt = null; game.render(); }, { cls: 'tiny', size: 12 });

  function encounterPrompt(game, p) {
    const w = game.world;
    const spec = Explore.encounterSpec(w, p.def);
    const label = p.def.label || 'Foes';
    const parley = spec.parley && !p.afterParley ? G.Content.world.npcs[spec.parley] : null;
    const look = Sprites.forEncounter(spec);
    const face = Sprites.portrait({ side: 'enemy', sprite: look.kind === 'orc' && !look.tint ? null : { kind: look.kind, tint: look.tint }, name: label }, 40);
    return h('section', { class: 'popcard encounter' },
      h('div', { class: 'popcard-head' }, face, h('div', { class: 'stack tight grow' }, h('h3', null, label), h('span', { class: 'small ' + (p.aware ? 'bad' : 'muted') }, p.aware ? 'They have seen you' : 'Unaware of you')), p.aware ? null : closeBtn(game)),
      spec.text ? h('p', { class: 'muted small' }, spec.text) : null,
      p.afterParley ? h('p', { class: 'small bad' }, 'The talking is over.') : null,
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => startFight(game, p, !p.aware) }, icon('sword', 14), p.aware ? 'Fight' : 'Ambush'),
        parley ? h('button', { onclick: () => game.talk(spec.parley, { type: 'encounter', x: p.x, y: p.y, spec }) }, `Talk to ${parley.name}`) : null,
        !p.aware ? h('button', { onclick: () => { game.ui.prompt = null; game.render(); } }, 'Leave them') : null,
        h('button', { class: 'info-btn', type: 'button', onclick: () => game.openOverlay('text', { title: 'About this meeting', text: p.aware ? 'They know you are here. You can flee once the fight starts, but they are quicker than most.' : 'Sneaking past is possible: stay quiet (H) and keep your distance, or you may wake them. An ambush costs them part of their first round.' }) }, 'i')));
  }

  function facePrompt(game) {
    const w = game.world;
    const f = Explore.facing(w);
    if (!f.actions.length) return null;
    return h('section', { class: 'popcard' },
      h('div', { class: 'popcard-head' }, h('h3', { class: 'grow' }, f.label), closeBtn(game)),
      f.text ? h('p', { class: 'muted small' }, f.text) : null,
      h('div', { class: 'stack tight' }, f.actions.map((a) => h('button', { class: 'act', onclick: () => doAction(game, f, a) },
        h('span', null, a.label),
        a.skill ? h('span', { class: 'small muted num' }, `${G.Skills.defs()[a.skill].name} +${G.Skills.mod(a.who || World.active(w)[0], a.skill)} vs ${a.tn}${a.who ? ' · ' + a.who.name : ''}`) : null))));
  }

  function doAction(game, f, a) {
    const w = game.world;
    if (a.id === 'talk') { const def = Explore.cell(w, f.x, f.y).def; game.talk(def.npc, { type: 'npc', x: f.x, y: f.y }); return; }
    if (a.id === 'fight' || a.id === 'ambush') { startFight(game, { x: f.x, y: f.y, def: Explore.cell(w, f.x, f.y).def, aware: a.id === 'fight' }, a.id === 'ambush'); return; }
    if (a.id === 'parley') { const def = Explore.cell(w, f.x, f.y).def; const spec = Explore.encounterSpec(w, def); game.talk(spec.parley, { type: 'encounter', x: f.x, y: f.y, spec }); return; }
    act(game, () => Explore.act(w, a.id, a.alt));
    const now = Explore.facing(w);
    if (!now.actions.length) game.ui.prompt = null;
    game.render();
  }

  function stairsPrompt(game, p) {
    const to = G.Content.world.places[p.def.to];
    return h('section', { class: 'popcard' },
      h('div', { class: 'popcard-head' }, icon('door', 18), h('h3', { class: 'grow' }, p.def.label || 'Stairs')),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => game.takeStairs(p.def) }, to.kind === 'town' ? `Leave for ${to.name}` : `Go to ${to.name}`),
        h('button', { onclick: () => { game.ui.prompt = null; game.render(); } }, 'Stay')));
  }

  // ---- The scene the map view draws -----------------------------------------------------------------------------
  // Squares that hold something with a body: monsters and people.
  function bodies(game) {
    const w = game.world;
    const g = Explore.here(w);
    const key = w.place;
    if (game.ui.bodiesFor === key) return game.ui.bodies;
    const list = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const def = g.legend[g.rows[y][x]];
      if (def && (def.kind === 'monster' || def.kind === 'npc')) list.push({ x, y, def });
    }
    game.ui.bodiesFor = key; game.ui.bodies = list;
    return list;
  }

  const SPREAD = [[[0, 0]], [[-0.22, 0.04], [0.22, -0.04]], [[-0.3, 0.1], [0.3, 0.1], [0, -0.14]]];

  function scene(game) {
    const w = game.world;
    const g = Explore.here(w);
    const ex = w.explore;
    const ms = World.mapState(w, w.place);
    const members = World.active(w);
    const tr = trail(game);
    const cfg = G.CONFIG.game;
    const sc = {
      w: g.w, h: g.h,
      cell: (x, y) => Explore.peek(w, x, y),
      seen: (x, y) => !!ms.seen[x + ',' + y],
      light: { x: ex.x, y: ex.y, r: cfg.lightRadius },
      cam: { x: ex.x, y: ex.y },
      actors: [], marks: [],
      describe: (x, y) => {
        const c = Explore.peek(w, x, y);
        if (!sc.seen(x, y)) return '';
        if (c.kind === 'monster' && !(c.st && (c.st.done || c.st.pacified))) return c.def.label || 'Foes';
        if (c.kind === 'npc') return G.Content.world.npcs[c.def.npc].name;
        return c.def && c.def.label ? c.def.label : '';
      },
    };
    members.forEach((m, i) => {
      // Before the party has walked far enough to string out, followers cluster around the leader.
      const off = SPREAD[2][(i - 1) % 3] || [0, 0];
      const at = i === 0 ? { x: ex.x, y: ex.y } : (tr[i - 1] || { x: ex.x + off[0], y: ex.y + off[1] + 0.12 });
      const L = Sprites.look(m);
      sc.actors.push({ id: m.id, x: at.x, y: at.y, kind: L.kind, tint: L.tint, size: L.size, tag: 'party', speed: 8, phase: i, ring: i === 0 && ex.sneak ? 'rgba(150,200,255,0.8)' : null, alpha: ex.sneak ? 0.8 : 1, who: m.id });
    });
    for (const b of bodies(game)) {
      if (!sc.seen(b.x, b.y)) continue;
      const c = Explore.peek(w, b.x, b.y);
      const st = c.st || {};
      if (b.def.kind === 'monster') {
        if (st.done) continue;
        const spec = Explore.encounterSpec(w, b.def);
        const look = Sprites.forEncounter(spec);
        const n = Math.min(3, Sprites.crowd(spec));
        SPREAD[n - 1].forEach(([dx, dy], i) => sc.actors.push({ id: `m${b.x},${b.y},${i}`, x: b.x + dx, y: b.y + dy, kind: look.kind, tint: look.tint, size: look.size, tag: 'enemy', flip: ex.x < b.x, sleep: !!(b.def.asleep && !st.woken), ring: st.pacified ? 'rgba(120,230,160,0.7)' : null, phase: i * 2 + b.x }));
      } else {
        const npc = G.Content.world.npcs[b.def.npc] || {};
        const look = Sprites.lookFor(npc.sprite || 'wizard', npc.name);
        sc.actors.push({ id: `n${b.x},${b.y}`, x: b.x, y: b.y, kind: look.kind, tint: look.tint, size: look.size, tag: 'npc', flip: ex.x < b.x, ring: 'rgba(120,190,255,0.55)', phase: b.y });
      }
    }
    if (game.ui.prompt && game.ui.prompt.type === 'face') { const f = Explore.front(w); sc.marks.push({ x: f.x, y: f.y, type: 'select' }); }
    return sc;
  }

  // Which party member (if any) is drawn at this square? Figures stand a tile and a bit tall.
  function memberAt(game, x, y) {
    const sc = game.ui.lastScene;
    if (!sc) return null;
    for (const a of sc.actors) if (a.tag === 'party' && Math.round(a.x) === x && (Math.round(a.y) === y || Math.round(a.y) - 1 === y)) return a.who;
    return null;
  }

  function onCell(game, x, y) {
    const w = game.world;
    if (game.overlay) return;
    const who = memberAt(game, x, y);
    if (who) { game.openOverlay('sheet', { id: who }); return; }
    const ex = w.explore;
    stopWalk(game);
    const dx = x - ex.x, dy = y - ex.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      step(game, dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0);
      return;
    }
    if (!walkTo(game, x, y)) {
      const c = Explore.peek(w, x, y);
      if (c.kind === 'wall' || c.kind === 'rock') return;
      if (!game.ui.lastScene || !game.ui.lastScene.seen(x, y)) { toast('You have not seen that far.'); return; }
      toast('No way through to there.');
    }
  }

  // ---- The screen ------------------------------------------------------------------------------------------------
  function logBox(game) {
    const lines = game.world.log.slice(-(game.ui.logOpen ? 40 : 2));
    const open = !!game.ui.logOpen;
    const box = h('div', { class: 'logbox' + (open ? ' open' : ''), role: 'log', 'aria-live': 'polite', title: open ? 'Click to shrink' : 'Click to read more', onclick: () => { game.ui.logOpen = !open; game.render(); } },
      lines.map((l) => h('p', { class: 'l ' + l.cls }, l.text)));
    if (open) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 0);
    return box;
  }

  function dock(game) {
    return h('div', { class: 'dock' }, World.party(game.world).map((c) => {
      const max = G.Character.maxStamina(c);
      const down = c.status.dead || c.status.unconscious;
      const hurt = G.Character.totalDamage(c);
      return h('button', { class: 'dock-member' + (down ? ' down' : ''), title: `${c.name} · L${c.level} · stamina ${c.stamina}/${max}${hurt ? ` · −${hurt} attributes` : ''}${c.status.dead ? ' · dead' : down ? ' · down' : ''}. Click for the sheet.`, onclick: () => game.openOverlay('sheet', { id: c.id }) },
        Sprites.portrait(c, 40),
        UI.bar(c.stamina, max),
        hurt ? h('span', { class: 'dock-hurt' }, '−' + hurt) : null);
    }));
  }

  UI.Screens.explore = function (game) {
    const w = game.world;
    if (!w.explore) return h('p', null, 'You are not in a dungeon.');
    const ex = w.explore;
    const p = Explore.place(w);
    if (!game.ui.mv) {
      UI.MapView.preload();
      game.ui.mv = UI.MapView.create({ cols: 15, rows: 10, scale: 3, label: `Map of ${p.name}`, scene: () => (game.ui.lastScene = scene(game)), onCell: (x, y) => onCell(game, x, y) });
      game.ui.mv.start();
    }
    trail(game);
    const pr = game.ui.prompt;
    let prompt = null;
    if (pr) {
      if (pr.type === 'encounter') prompt = encounterPrompt(game, pr);
      else if (pr.type === 'stairs') prompt = stairsPrompt(game, pr);
      else if (pr.type === 'face') prompt = facePrompt(game);
    }
    return h('div', { class: 'explore' },
      Bits.topBar(game, { title: p.name }),
      h('div', { class: 'stage' },
        game.ui.mv.el,
        dock(game),
        h('div', { class: 'toolbar' },
          ibtn('hand', 'Interact with what is in front of you (F)', () => interact(game)),
          ibtn('search', 'Search nearby for traps and hidden doors (X)', () => search(game)),
          ibtn('eye', ex.sneak ? 'Sneaking: slower and quieter (H)' : 'Sneak: slower and quieter (H)', () => toggleSneak(game), { on: ex.sneak }),
          ibtn('tent', 'Make camp and rest (C)', () => camp(game)),
          ibtn('scroll', 'Map of the whole level (M)', () => game.openOverlay('map'))),
        ex.sneak ? h('span', { class: 'chip ok sneak-chip' }, 'Sneaking') : null,
        prompt,
        logBox(game)));
  };

  // ---- Keys ---------------------------------------------------------------------------------------------------------
  if (typeof document !== 'undefined' && !UI._exploreKeys) {
    UI._exploreKeys = true;
    document.addEventListener('keydown', (e) => {
      const game = UI.Game;
      if (!game || game.screen !== 'explore' || game.overlay || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
      if (document.querySelector('#modal-root .modal-backdrop')) return;
      const k = e.key.toLowerCase();
      const dir = { w: 0, arrowup: 0, d: 1, arrowright: 1, s: 2, arrowdown: 2, a: 3, arrowleft: 3 }[k];
      if (dir != null) { e.preventDefault(); stopWalk(game); step(game, dir); return; }
      const map = { f: () => interact(game), ' ': () => interact(game), x: () => search(game), c: () => camp(game), h: () => toggleSneak(game), m: () => game.openOverlay('map'), escape: () => { stopWalk(game); if (game.ui.prompt && !locked(game)) { game.ui.prompt = null; game.render(); } } };
      if (map[k]) { e.preventDefault(); map[k](); }
    });
  }

  UI.ExploreActions = { step, walkTo, interact, search };
})(globalThis.BBB);
