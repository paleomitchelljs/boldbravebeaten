/* Enemy generator. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, select, num, toast } = UI;
  const E = G.Enemies;
  const D = G.DATA;

  const BLURB = {
    bandit: 'Light armor, clubs and daggers, quick on their feet.',
    militia: 'Padded armor and round shields; they block and hold.',
    sellsword: 'Mail, longsword and shield; trained to parry.',
    brute: 'Big two-handers and power swings, no shield.',
    duelist: 'Rapier and feints; dangerous to the unarmored.',
    brawler: 'Grapples, trips, and a dagger for the finish.',
    manAtArms: 'Mail or scale, maces, heater shield.',
    knight: 'Plate at high level. A deadly foe and a huge prize.',
  };

  function view(app) {
    const ui = app.ui.gen || (app.ui.gen = { template: 'bandit', level: 1, count: 2, last: [] });
    const s = app.state;
    const generate = () => {
      const made = [];
      for (let i = 0; i < ui.count; i++) {
        const c = E.generate(ui.template, ui.level);
        app.addCharacter(c, true);
        made.push(c.id);
      }
      ui.last = made;
      app.save();
      app.render();
      toast(`${made.length} ${E.TEMPLATES[ui.template].name.toLowerCase()}${made.length > 1 ? 's' : ''} added`);
    };
    const last = ui.last.map((id) => s.characters[id]).filter(Boolean);
    return h('div', { class: 'stack', style: { gap: '20px' } },
      h('div', { class: 'view-head' },
        h('div', { class: 'stack tight' }, h('h1', null, 'Enemies'),
          h('p', { class: 'muted' }, 'Roll up foes from a template and level. Level sets their feat count and the rarity of their kit: plate and masterwork only appear on high-level enemies. Each one is a full character you can edit.'))),
      h('section', { class: 'panel' },
        h('div', { class: 'row', style: { alignItems: 'end', gap: '14px' } },
          h('label', { class: 'field', for: 'gen-template' }, h('span', { class: 'label' }, 'Template'),
            select('gen-template', ui.template, Object.keys(E.TEMPLATES).map((k) => [k, E.TEMPLATES[k].name]), (v) => { ui.template = v; app.render(); })),
          h('label', { class: 'field', for: 'gen-level' }, h('span', { class: 'label' }, 'Level'),
            num('gen-level', ui.level, (v) => { ui.level = Math.max(1, Math.min(12, Math.round(v))); app.render(); }, { min: 1, max: 12 })),
          h('label', { class: 'field', for: 'gen-count' }, h('span', { class: 'label' }, 'How many'),
            num('gen-count', ui.count, (v) => { ui.count = Math.max(1, Math.min(8, Math.round(v))); app.render(); }, { min: 1, max: 8 })),
          h('button', { class: 'primary', onclick: generate }, 'Generate')),
        h('p', { class: 'small muted' }, BLURB[ui.template]),
        h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, 'Level band'), h('th', null, 'Armor'), h('th', null, 'Weapon'), h('th', null, 'Shield'))),
          h('tbody', null, ['1–2', '3–5', '6+'].map((band, i) => {
            const T = E.TEMPLATES[ui.template];
            const names = (list, cat) => list[i].map(([, v]) => (v ? (cat[v] ? cat[v].name : v) : 'none')).join(' / ');
            return h('tr', null, h('td', { class: 'num' }, band), h('td', null, names(T.armor, D.ARMOR)), h('td', null, names(T.weapons, D.WEAPONS)), h('td', null, names(T.shield, D.SHIELDS)));
          }))))),
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', null, 'Monsters'), h('span', { class: 'small muted' }, 'Draft: fixed builds, tested in sim/monsters.js')),
        h('div', { class: 'row', style: { alignItems: 'end', gap: '14px' } },
          h('label', { class: 'field', for: 'gen-monster' }, h('span', { class: 'label' }, 'Monster'),
            select('gen-monster', ui.monster || 'wolf', Object.keys(E.MONSTERS).map((k) => [k, E.MONSTERS[k].name]), (v) => { ui.monster = v; app.render(); })),
          h('button', { class: 'primary', onclick: () => {
            const made = E.makeMonster(ui.monster || 'wolf');
            for (const c of made) app.addCharacter(c, true);
            ui.last = made.map((c) => c.id);
            app.save(); app.render();
            toast(`${E.MONSTERS[ui.monster || 'wolf'].name} added`);
          } }, 'Add')),
        h('p', { class: 'small muted' }, E.MONSTERS[ui.monster || 'wolf'].blurb)),
      last.length ? h('section', { class: 'stack' },
        h('div', { class: 'section-title' }, h('h2', null, 'Just generated'),
          h('button', { onclick: () => { app.ui.battleSetup = { picked: Object.fromEntries(s.order.filter((id) => s.characters[id].side === 'party' && !s.characters[id].status.dead).concat(ui.last).map((id) => [id, true])) }; app.go('battle'); } }, 'Fight them')),
        h('div', { class: 'grid-3' }, last.map((c) => UI.Cards.card(app, c, h('div', { class: 'row' },
          h('button', { class: 'small', onclick: () => app.go('sheet', c.id) }, 'Open sheet'),
          UI.confirmButton('Delete', 'Confirm delete', () => { ui.last = ui.last.filter((x) => x !== c.id); app.removeCharacter(c.id); })))))) : null);
  }

  UI.Views.enemies = view;
})(globalThis.BBB);
