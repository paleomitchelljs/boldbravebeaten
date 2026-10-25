/*
 * The game shell: owns the world, routes between screens, and turns rules-layer results into
 * screen changes. Screens live in src/ui/game/screens/*.js and register themselves in UI.Screens.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, toast } = UI;
  const World = G.World;
  const Explore = G.Explore;
  const Battle = G.Battle;

  UI.Screens = UI.Screens || {};

  const Game = {
    world: null,
    screen: 'title',
    ui: {},            // per-screen view state (not saved)
    overlay: null,     // { type: 'sheet' | 'pack' | 'journal' | 'factions' | 'menu' | 'map' | 'text' | 'loot', ... }
    debug: false,
    error: null,
  };

  // ---- Rendering --------------------------------------------------------------------------------
  function render() {
    const root = document.getElementById('app');
    if (!root) return;
    const scroll = window.scrollY;
    root.innerHTML = '';
    document.documentElement.dataset.mode = 'game';
    try {
      const screen = UI.Screens[Game.screen];
      const el = screen(Game);
      root.appendChild(h('div', { class: `game screen-${Game.screen}` }, el));
      renderOverlay();
    } catch (e) {
      console.error(e);
      Game.error = e;
      root.appendChild(h('div', { class: 'game' }, h('div', { class: 'panel stack' }, h('h2', null, 'Something broke on this screen'),
        h('p', { class: 'mono small' }, String(e && e.stack || e)),
        h('div', { class: 'row' },
          h('button', { onclick: () => Game.go(Game.world ? (Game.world.explore ? 'explore' : 'town') : 'title') }, 'Back'),
          Game.world ? h('button', { onclick: () => { Game.save(); toast('Saved'); } }, 'Save anyway') : null))));
    }
    if (Game.screen !== 'explore' && Game.screen !== 'battle') window.scrollTo(0, scroll);
    if (UI.sweepHover) UI.sweepHover();
  }

  function renderOverlay() {
    const root = document.getElementById('modal-root');
    if (!root) return;
    root.innerHTML = '';
    const o = Game.overlay;
    if (!o) return;
    const maker = UI.Overlays[o.type];
    if (!maker) return;
    const body = maker(Game, o);
    root.appendChild(h('div', { class: 'modal-backdrop game-overlay', onclick: (e) => { if (e.target === e.currentTarget && !o.sticky) Game.closeOverlay(); } }, body));
  }

  UI.Overlays = UI.Overlays || {};

  function go(screen) {
    if (Game.ui && Game.ui.mv) Game.ui.mv.destroy();
    if (Game.ui && Game.ui.walk) clearTimeout(Game.ui.walk.timer);
    Game.screen = screen;
    Game.overlay = null;
    Game.ui = {};
    render();
    window.scrollTo(0, 0);
  }

  function openOverlay(type, data) {
    Game.overlay = Object.assign({ type }, data || {});
    renderOverlay();
  }
  function closeOverlay() {
    Game.overlay = null;
    renderOverlay();
    if (Game.screen === 'explore' || Game.screen === 'battle') render();
  }

  // ---- Saving ---------------------------------------------------------------------------------
  function save(slot) {
    if (!Game.world) return false;
    const ok = G.Save.write(slot || 'auto', Game.world);
    if (!ok && !Game.warnedStorage) { Game.warnedStorage = true; toast('This browser is not saving. Use Menu → Export to keep your game.'); }
    return ok;
  }

  // ---- Messages -----------------------------------------------------------------------------------
  function say(text, cls) {
    World.logLine(Game.world, text, cls);
  }

  // ---- Flow -------------------------------------------------------------------------------------------
  function newGame(specs) {
    Game.world = World.create(specs);
    Game.world.settings.autoRoll = 'all';
    save();
    go('town');
  }

  function loadWorld(w) {
    Game.world = w;
    go(w.battle ? 'battle' : w.parley ? 'parley' : w.explore ? 'explore' : 'town');
  }

  function travel(exit) {
    Explore.enter(Game.world, exit.to, exit.arrive || '<');
    save();
    go('explore');
  }

  function takeStairs(def) {
    const w = Game.world;
    const to = G.Content.world.places[def.to];
    if (to.kind === 'town') { Explore.leave(w, def.to); save(); go('town'); return; }
    if (def.kind === 'drop') { Explore.fall(w, def); if (World.wiped(w)) { save(); go('gameover'); return; } }
    Explore.enter(w, def.to, def.at || '<');
    save();
    go('explore');
  }

  function startBattle(spec, opts) {
    Battle.start(Game.world, spec, opts);
    save();
    go('battle');
  }

  function talk(npcId, ctx) {
    G.Parley.start(Game.world, npcId, ctx);
    Game.ui = {};
    Game.screen = 'parley';
    render();
  }

  function endParley() {
    const w = Game.world;
    const ctx = w.parley && w.parley.ctx;
    G.Parley.close(w);
    save();
    if (ctx && ctx.type === 'encounter') {
      const pacified = w.flags[ctx.peaceFlag || ''] || (ctx.spec && (ctx.spec.peaceFlags || []).some((f) => w.flags[f]));
      if (pacified) {
        Explore.resolveSquare(w, ctx.x, ctx.y, 'pacified', ctx.spec);
        say('They let you pass.', 'info');
        go('explore');
      } else {
        Game.screen = 'explore';
        Game.ui = { prompt: { type: 'encounter', x: ctx.x, y: ctx.y, def: Explore.cell(w, ctx.x, ctx.y).def, aware: true, afterParley: true } };
        render();
      }
      return;
    }
    go(w.explore ? 'explore' : 'town');
  }

  // Shown after a battle's result is settled.
  function afterBattle() {
    const w = Game.world;
    save();
    if (World.wiped(w)) { go('gameover'); return; }
    go(w.explore ? 'explore' : 'town');
  }

  Object.assign(Game, { render, go, openOverlay, closeOverlay, save, say, newGame, loadWorld, travel, takeStairs, startBattle, talk, endParley, afterBattle });
  UI.Game = Game;
})(globalThis.BBB);
