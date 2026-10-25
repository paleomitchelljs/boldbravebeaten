/* Pieces shared by the game screens: the top bar, the party strip, roll text. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, bar } = UI;
  const C = G.Character;
  const World = G.World;

  function checkText(r) {
    const skill = (G.Skills.defs()[r.skill] || {}).name || r.skill;
    return `${r.name} · ${skill}: d10 ${r.roll} ${r.mod >= 0 ? '+' : '−'} ${Math.abs(r.mod)}${r.bonus ? (r.bonus > 0 ? ' + ' : ' − ') + Math.abs(r.bonus) : ''} = ${r.total} vs ${r.tn}: ${r.ok ? 'success' : 'failure'}${r.fumble ? ' (fumble)' : r.crit ? ' (a clean 10)' : ''}`;
  }

  // The slim bar over every game screen: where and when, gold, and icon buttons for the pop-ups.
  function topBar(game, opts) {
    opts = opts || {};
    const w = game.world;
    const p = G.Content.world.places[w.place];
    const ib = UI.ibtn;
    return h('header', { class: 'gamebar' },
      h('div', { class: 'gamebar-title' },
        h('h2', null, opts.title || (p && p.name) || ''),
        h('span', { class: 'label' }, G.World.clockText(w))),
      h('div', { class: 'row gamebar-actions' },
        opts.extra || null,
        h('span', { class: 'gold num', title: 'Gold' }, UI.icon('coin', 14), ` ${w.gold}`),
        ib('pack', 'Pack: gear, goods and supplies', () => game.openOverlay('pack')),
        ib('book', 'Journal: quests, what you know, the log', () => game.openOverlay('journal')),
        ib('banner', 'Standing with the factions', () => game.openOverlay('factions')),
        ib('menu', 'Menu: save, export, options', () => game.openOverlay('menu'))));
  }

  function partyStrip(game, opts) {
    opts = opts || {};
    const w = game.world;
    return h('div', { class: 'party-strip' }, World.party(w).map((c) => {
      const max = C.maxStamina(c);
      const down = c.status.dead || c.status.unconscious;
      return h('button', { class: `member ${down ? 'down' : ''} ${opts.pick === c.id ? 'selected' : ''}`, onclick: () => (opts.onPick ? opts.onPick(c) : game.openOverlay('sheet', { id: c.id })), title: `${c.name}: open sheet` },
        UI.Art.portrait(c, 48),
        h('span', { class: 'stack tight grow' },
          h('b', { class: 'nm' }, c.name),
          h('span', { class: 'small muted num' }, `L${c.level} · ${c.stamina}/${max}${C.totalDamage(c) ? ` · −${C.totalDamage(c)} attr` : ''}`),
          bar(c.stamina, max),
          UI.Cards.statusChips(c).length ? h('span', { class: 'row chips', style: { gap: '3px' } }, UI.Cards.statusChips(c)) : null));
    }));
  }

  function logPanel(game, n) {
    const lines = game.world.log.slice(-(n || 6));
    return h('div', { class: 'gamelog', role: 'log', 'aria-live': 'polite' }, lines.map((l) => h('p', { class: `l ${l.cls}` }, l.text)));
  }

  // An item on one line: its name and the first two parts of its stat line; the whole line on hover.
  function itemLine(item, who) {
    const full = G.Equip.describe(item);
    const tag = full.split(' · ').filter(Boolean).slice(0, 2).join(' · ');
    return h('span', { class: 'item-line', title: (who ? who + ' · ' : '') + full }, h('b', null, G.Items.itemName(item)), h('span', { class: 'small muted' }, (who ? who + ' · ' : '') + tag));
  }
  // Goods: the name, their kind, the description on hover.
  const goodLine = (name, g) => h('span', { class: 'item-line', title: g.blurb }, h('b', null, name), h('span', { class: 'small muted' }, g.kind || 'goods'));

  UI.Bits = { checkText, topBar, partyStrip, logPanel, itemLine, goodLine };
})(globalThis.BBB);
