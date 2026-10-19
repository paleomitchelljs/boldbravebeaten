/* Battle: the rules engine's battle screen, inside the game. The party's turns are yours; the foes are the AI's. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, toast } = UI;
  const World = G.World;
  const Battle = G.Battle;

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
      game.ui.finalLog = enc.log.slice(-10);
      game.save();
    } else toast('They stay on you.');
    game.render();
  }

  function resultView(game) {
    const res = game.ui.result;
    const w = game.world;
    const title = res.result === 'won' ? 'Victory' : res.result === 'fled' ? 'You got away' : res.result === 'lost' ? 'Defeat' : 'No one stands';
    const wiped = World.wiped(w);
    return h('div', { class: 'battle-result stack' },
      h('div', { class: 'panel stack' },
        h('span', { class: 'label' }, game.ui.spec && game.ui.spec.name ? game.ui.spec.name : 'Battle'),
        h('h1', null, title),
        res.lines.length ? h('div', { class: 'stack tight' }, res.lines.map((l) => h('p', null, l))) : null,
        res.loot && res.loot.length ? h('div', { class: 'stack tight' }, h('h3', null, 'Spoils'), h('ul', { class: 'loot-list' }, res.loot.map((l) => h('li', null, l)))) : null,
        res.result === 'fled' ? h('p', { class: 'muted' }, 'You run for the stairs. The foes stay where they were.') : null,
        res.result === 'won' ? h('p', { class: 'small muted' }, 'Gear that fell with them is in the pack. Take what suits you from the Pack screen.') : null,
        h('div', { class: 'row' },
          wiped ? h('button', { class: 'primary', onclick: () => game.go('gameover') }, 'Continue') : h('button', { class: 'primary', onclick: () => game.afterBattle() }, 'Continue'),
          h('button', { onclick: () => game.openOverlay('pack') }, 'Pack'))),
      game.ui.finalLog ? h('details', { class: 'panel' }, h('summary', null, h('h3', null, 'The last of it')), h('div', { class: 'gamelog' }, game.ui.finalLog.map((l) => h('p', { class: 'l ' + (l.cls || '') }, l.text)))) : null);
  }

  UI.Screens.battle = function (game) {
    const w = game.world;
    if (!game.ui.result && !w.battle) { game.go(w.explore ? 'explore' : 'town'); return h('div'); }
    if (!game.ui.result && w.battle.enc.phase === 'over') {
      game.ui.spec = w.battle.spec;
      game.ui.finalLog = w.battle.enc.log.slice(-10);
      game.ui.result = Battle.finish(w);
      game.save();
    }
    if (game.ui.result) return h('div', { class: 'stack' }, UI.Bits.topBar(game, { title: 'Aftermath' }), resultView(game));
    const app = battleApp(game);
    const spec = w.battle.spec;
    return h('div', { class: 'stack battle-screen' },
      UI.Bits.topBar(game, { title: spec.name || 'Battle' }),
      spec.text && w.battle.enc.round <= 1 ? h('p', { class: 'muted flavor' }, spec.text) : null,
      UI.Views.battle(app));
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
