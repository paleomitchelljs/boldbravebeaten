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

  function topBar(game, opts) {
    opts = opts || {};
    const w = game.world;
    const p = G.Content.world.places[w.place];
    return h('header', { class: 'gamebar' },
      h('div', { class: 'stack tight' },
        h('span', { class: 'label' }, G.World.clockText(w)),
        h('h2', null, opts.title || (p && p.name) || '')),
      h('div', { class: 'row gamebar-actions' },
        h('span', { class: 'gold num', title: 'Gold' }, `◈ ${w.gold}`),
        h('button', { class: 'small', onclick: () => game.openOverlay('pack') }, 'Pack'),
        h('button', { class: 'small', onclick: () => game.openOverlay('journal') }, 'Journal'),
        h('button', { class: 'small', onclick: () => game.openOverlay('factions') }, 'Standing'),
        h('button', { class: 'small', onclick: () => game.openOverlay('menu') }, 'Menu')));
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

  UI.Bits = { checkText, topBar, partyStrip, logPanel };
})(globalThis.BBB);
