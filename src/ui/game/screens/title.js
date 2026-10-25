/* Title screen: new game, continue, load, import, and the test bench. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, toast } = UI;

  function slotRow(game, s) {
    const label = s.slot === 'auto' ? 'Autosave' : 'Slot ' + s.slot;
    if (!s.world) return h('div', { class: 'slot empty' }, h('span', { class: 'label' }, label), h('span', { class: 'muted' }, 'empty'));
    const i = s.info;
    return h('div', { class: 'slot' },
      h('div', { class: 'stack tight' },
        h('span', { class: 'label' }, label),
        h('b', null, i.names),
        h('span', { class: 'small muted' }, `${i.place} · day ${i.day} · level ${i.level} · ${i.gold} gold`)),
      h('div', { class: 'row' },
        h('button', { class: 'primary small', onclick: () => game.loadWorld(s.world) }, 'Load'),
        UI.confirmButton('Delete', 'Delete?', () => { G.Save.remove(s.slot); game.render(); })));
  }

  function importFile(game) {
    const input = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { game.loadWorld(G.Save.deserialize(await f.text())); } catch (err) { toast(err.message); }
    } });
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 60000);
  }

  UI.Screens.title = function (game) {
    const slots = G.Save.list();
    const auto = slots.find((s) => s.slot === 'auto' && s.world);
    const any = slots.some((s) => s.world);
    return h('div', { class: 'title-screen' },
      h('div', { class: 'title-art', 'aria-hidden': 'true' }, h('span', null, '⚔')),
      h('div', { class: 'stack title-body' },
        h('div', { class: 'stack tight' },
          h('h1', { class: 'game-title' }, 'Bold Brave Beaten'),
          h('p', { class: 'muted' }, 'A turn-based party RPG about gear, preparation and knowing when not to fight.')),
        h('div', { class: 'stack' },
          auto ? h('button', { class: 'primary big', onclick: () => game.loadWorld(auto.world) }, `Continue — ${auto.info.place}, day ${auto.info.day}`) : null,
          h('button', { class: auto ? 'big' : 'primary big', onclick: () => game.go('create') }, 'New game'),
          h('div', { class: 'row' },
            ((G.Content.world.start || {}).trials || []).map((t) => h('button', { onclick: () => { game.newGame(G.World.trialParty(t.id)); if (t.go) game.travel(t.go); } }, t.label)),
            h('button', { onclick: () => importFile(game) }, 'Import a save file'),
            h('a', { class: 'button', href: 'bench.html' }, 'Test bench'))),
        any ? h('details', { class: 'panel' }, h('summary', null, h('h3', null, 'Saved games')), h('div', { class: 'stack' }, slots.map((s) => slotRow(game, s)))) : null,
        h('details', { class: 'panel' }, h('summary', null, h('h3', null, 'How it plays')),
          h('div', { class: 'stack small howto' },
            h('p', null, 'Fights are lethal and quick. Armor matters more than levels, and a stab that gets through can kill anyone. Win by reacting more, lasting longer and taking less.'),
            h('p', null, 'Not every problem is a fight. Sneak past sleepers, pick locks, talk your way through, or buy someone off. Each style has a place where it shines and a place where it is useless.'),
            h('p', null, 'Your standing with factions, and your name for good or violence, change prices, doors and how people speak to you. Training happens only in town, between adventures.'),
            h('p', null, 'Keys: W/S move, A/D sidestep, Q/E turn, F interact, X search, C camp, H sneak, M map.')))));
  };
})(globalThis.BBB);
