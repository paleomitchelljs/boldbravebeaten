/* Exploring: the first-person view, movement, interacting with what is in front of you, camp. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, toast } = UI;
  const Explore = G.Explore;
  const World = G.World;
  const Bits = UI.Bits;

  // ---- Turning events into screen state -----------------------------------------------------------
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
        case 'trap': game.ui.shake = true; break;
        default: break;
      }
    }
    if (World.wiped(w)) { game.go('gameover'); return false; }
    return true;
  }

  function act(game, fn) {
    const out = fn();
    const events = out && out.events ? out.events : [];
    if (!handle(game, events)) return;
    game.save();
    game.render();
  }

  function step(game, rel) {
    // Moving cancels a standing prompt.
    if (game.ui.prompt && game.ui.prompt.type === 'encounter' && game.ui.prompt.aware) { toast('They have seen you. Fight or talk.'); return; }
    game.ui.prompt = null;
    act(game, () => Explore.move(game.world, rel));
  }
  function turn(game, d) {
    if (game.ui.prompt && game.ui.prompt.type === 'encounter' && game.ui.prompt.aware) return;
    game.ui.prompt = null;
    act(game, () => Explore.turn(game.world, d));
  }

  function interact(game) {
    const w = game.world;
    const f = Explore.facing(w);
    if (!f.actions.length && f.kind !== 'door') { toast(f.kind === 'wall' || f.kind === 'rock' ? 'Just a wall.' : 'Nothing to do here.'); return; }
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
    // Herbalists find something while resting.
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

  // ---- Prompts -------------------------------------------------------------------------------------------
  function startFight(game, p, ambush) {
    const w = game.world;
    const spec = Explore.encounterSpec(w, p.def);
    const opts = { ctx: { x: p.x, y: p.y, back: true } };
    if (ambush) { opts.surprise = 'enemy'; opts.factor = G.Battle.ambushFactor(w); World.logLine(w, 'You strike from hiding.', 'fight'); }
    game.startBattle(Object.assign({ name: p.def.label }, spec), opts);
  }

  function encounterPrompt(game, p) {
    const w = game.world;
    const spec = Explore.encounterSpec(w, p.def);
    const label = p.def.label || 'Foes';
    const parley = spec.parley && !p.afterParley ? G.Content.world.npcs[spec.parley] : null;
    return h('section', { class: 'panel prompt encounter' },
      h('div', { class: 'row spread' }, h('h3', null, p.aware ? `${label} — they have seen you` : `${label} — unaware of you`), h('span', { class: 'glyph' }, G.UI.FirstPerson.spriteAt(w, p.x, p.y) ? G.UI.FirstPerson.spriteAt(w, p.x, p.y).glyph : '')),
      spec.text ? h('p', { class: 'muted' }, spec.text) : null,
      p.afterParley ? h('p', { class: 'small', style: { color: 'var(--warn)' } }, 'The talking is over.') : null,
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => startFight(game, p, !p.aware) }, p.aware ? 'Fight' : 'Strike from ambush'),
        parley ? h('button', { onclick: () => game.talk(spec.parley, { type: 'encounter', x: p.x, y: p.y, spec }) }, `Talk to ${parley.name}`) : null,
        !p.aware ? h('button', { onclick: () => { game.ui.prompt = null; game.render(); } }, 'Leave them be') : null),
      !p.aware ? h('p', { class: 'small muted' }, 'Sneaking past is possible. Stay quiet (H) and keep your distance, or you may wake them. An ambush costs them part of their first round.') : h('p', { class: 'small muted' }, 'You can try to flee once the fight starts, but they are quicker than most.'));
  }

  function facePrompt(game) {
    const w = game.world;
    const f = Explore.facing(w);
    if (!f.actions.length) { return null; }
    return h('section', { class: 'panel prompt' },
      h('div', { class: 'row spread' }, h('h3', null, f.label), h('button', { class: 'small', onclick: () => { game.ui.prompt = null; game.render(); } }, 'Leave it')),
      f.text ? h('p', { class: 'muted' }, f.text) : null,
      h('div', { class: 'stack tight' }, f.actions.map((a) => h('button', { class: 'act', onclick: () => doAction(game, f, a) },
        h('span', null, a.label),
        a.skill ? h('span', { class: 'small muted num' }, `${G.Skills.defs()[a.skill].name}: ${a.who ? a.who.name + ' ' : ''}+${G.Skills.mod(a.who || World.active(w)[0], a.skill)} vs ${a.tn}`) : null))));
  }

  function doAction(game, f, a) {
    const w = game.world;
    if (a.id === 'talk') { const def = Explore.cell(w, f.x, f.y).def; game.talk(def.npc, { type: 'npc', x: f.x, y: f.y }); return; }
    if (a.id === 'fight' || a.id === 'ambush') { startFight(game, { x: f.x, y: f.y, def: Explore.cell(w, f.x, f.y).def, aware: a.id === 'fight' }, a.id === 'ambush'); return; }
    if (a.id === 'parley') { const def = Explore.cell(w, f.x, f.y).def; const spec = Explore.encounterSpec(w, def); game.talk(spec.parley, { type: 'encounter', x: f.x, y: f.y, spec }); return; }
    act(game, () => Explore.act(w, a.id, a.alt));
    // The prompt closes once the thing in front is no longer something to act on.
    const now = Explore.facing(w);
    if (!now.actions.length) game.ui.prompt = null;
    game.render();
  }

  function stairsPrompt(game, p) {
    const to = G.Content.world.places[p.def.to];
    return h('section', { class: 'panel prompt' },
      h('h3', null, p.def.label || 'Stairs'),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => game.takeStairs(p.def) }, to.kind === 'town' ? `Leave for ${to.name}` : `Go to ${to.name}`),
        h('button', { onclick: () => { game.ui.prompt = null; game.render(); } }, 'Stay')));
  }

  // ---- The screen --------------------------------------------------------------------------------------------
  UI.Screens.explore = function (game) {
    const w = game.world;
    if (!w.explore) return h('p', null, 'You are not in a dungeon.');
    const ex = w.explore;
    const p = Explore.place(w);
    const view = h('canvas', { class: 'fp', width: 480, height: 300, role: 'img', 'aria-label': 'First-person view of the dungeon' });
    const mini = h('canvas', { class: 'mini', width: 220, height: 220, role: 'img', 'aria-label': 'Map of what you have seen' });
    UI.FirstPerson.render(view, w);
    UI.FirstPerson.minimap(mini, w);
    if (game.ui.anim) clearInterval(game.ui.anim);
    game.ui.anim = setInterval(() => { if (!view.isConnected) { clearInterval(game.ui.anim); return; } UI.FirstPerson.render(view, w); }, 160);

    const pr = game.ui.prompt;
    let prompt = null;
    if (pr) {
      if (pr.type === 'encounter') prompt = encounterPrompt(game, pr);
      else if (pr.type === 'stairs') prompt = stairsPrompt(game, pr);
      else if (pr.type === 'face') prompt = facePrompt(game);
    }
    const key = (k, label, fn, title) => h('button', { class: 'padkey', title: `${title || label} (${k})`, 'aria-label': title || label, onclick: fn }, label);
    return h('div', { class: 'explore stack' },
      Bits.topBar(game, { title: p.name }),
      h('div', { class: 'explore-main' },
        h('div', { class: 'view-col stack' },
          h('div', { class: `viewport ${game.ui.shake ? 'shake' : ''}` }, view,
            h('div', { class: 'hud' }, h('span', { class: 'compass' }, `Facing ${Explore.DIR_NAMES[ex.dir]}`), ex.sneak ? h('span', { class: 'chip ok' }, 'Sneaking') : null)),
          prompt,
          h('div', { class: 'controls' },
            h('div', { class: 'padgrid' },
              key('Q', '↶', () => turn(game, -1), 'Turn left'), key('W', '▲', () => step(game, 0), 'Forward'), key('E', '↷', () => turn(game, 1), 'Turn right'),
              key('A', '◀', () => step(game, 3), 'Sidestep left'), key('S', '▼', () => step(game, 2), 'Back'), key('D', '▶', () => step(game, 1), 'Sidestep right')),
            h('div', { class: 'stack tight actions' },
              h('button', { onclick: () => interact(game) }, 'Interact (F)'),
              h('button', { onclick: () => search(game) }, 'Search (X)'),
              h('button', { class: ex.sneak ? 'selected' : '', onclick: () => toggleSneak(game) }, 'Sneak (H)'),
              h('button', { onclick: () => camp(game) }, 'Camp (C)'),
              h('button', { onclick: () => game.openOverlay('map') }, 'Map (M)')))),
        h('aside', { class: 'stack side' }, mini, Bits.partyStrip(game), Bits.logPanel(game, 7))));
  };

  // ---- Keys -------------------------------------------------------------------------------------------------------
  if (typeof document !== 'undefined' && !UI._exploreKeys) {
    UI._exploreKeys = true;
    document.addEventListener('keydown', (e) => {
      const game = UI.Game;
      if (!game || game.screen !== 'explore' || game.overlay || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
      if (document.querySelector('#modal-root .modal-backdrop')) return;
      const k = e.key.toLowerCase();
      const map = { w: () => step(game, 0), arrowup: () => step(game, 0), s: () => step(game, 2), arrowdown: () => step(game, 2), a: () => step(game, 3), d: () => step(game, 1), q: () => turn(game, -1), arrowleft: () => turn(game, -1), e: () => turn(game, 1), arrowright: () => turn(game, 1), f: () => interact(game), ' ': () => interact(game), x: () => search(game), c: () => camp(game), h: () => toggleSneak(game), m: () => game.openOverlay('map') };
      if (map[k]) { e.preventDefault(); map[k](); }
    });
  }
})(globalThis.BBB);
