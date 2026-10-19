/* New game: build a party of four. Attributes by point buy, a starter kit, starting feats, a look. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, toast } = UI;
  const C = G.Character;
  const Art = UI.Art;

  const ATTR_BLURB = { STR: 'Force: damage, grappling, carrying heavy gear', CON: 'Toughness: your wounds. CON 0 is death', DEX: 'Aim, parry, locks, traps', SPD: 'Initiative, AP, movement, stealth', INT: 'Magic, lore, deception', WIL: 'Resolve: stamina regeneration, resisting magic', WIS: 'Perception, reading people', CHA: 'Charm, appeal, bargaining' };
  const NOUNS = ['fire', 'frost', 'lightning', 'wind', 'earth', 'vine', 'life', 'force'];

  function blankMember(i) {
    return { name: ['Aldric', 'Brea', 'Cassian', 'Dara'][i], kit: 'sword', attrs: { STR: 5, CON: 5, DEX: 5, SPD: 5, INT: 5, WIL: 5, WIS: 5, CHA: 5 }, feats: [], nouns: [], look: { skin: i % 6, hair: (i * 2 + 1) % 7, cloth: i % 6, build: 1 } };
  }

  function state(game) {
    if (!game.ui.create) game.ui.create = { slot: 0, members: [0, 1, 2, 3].map(blankMember) };
    return game.ui.create;
  }

  const spent = (m) => Object.values(m.attrs).reduce((t, v) => t + v, 0);
  const startingFeats = () => G.CONFIG.startingFeats;

  // Feats a new character may take: first-rank, no prerequisites, and in the game.
  function startFeats() {
    const out = [];
    for (const t of C.TREES) {
      const feats = Object.values(G.DATA.FEATS).filter((f) => f.tree === t.id && f.ranks[0] === 'novice' && !f.requires.length && f.auto);
      if (feats.length) out.push({ tree: t, feats });
    }
    return out;
  }

  function problems(m) {
    const p = [];
    if (!m.name.trim()) p.push('needs a name');
    if (spent(m) !== G.CONFIG.game.party.attrPool) p.push(`spend all ${G.CONFIG.game.party.attrPool} attribute points (${spent(m)} spent)`);
    if (m.feats.length !== startingFeats()) p.push(`choose ${startingFeats()} feats (${m.feats.length} chosen)`);
    const casts = m.feats.some((f) => /^verb_/.test(f));
    if (casts && !m.nouns.length) p.push('a caster needs a starting word (noun)');
    return p;
  }

  function memberEditor(game, st) {
    const m = st.members[st.slot];
    const P = G.CONFIG.game.party;
    const kits = G.Content.world.start.kits;
    const preview = G.World.makeCharacter(m);
    const left = P.attrPool - spent(m);
    const set = () => game.render();
    const attrRow = (a) => h('div', { class: 'attr-row' },
      h('div', { class: 'stack tight' }, h('b', null, a), h('span', { class: 'small muted' }, ATTR_BLURB[a])),
      h('div', { class: 'row stepper' },
        h('button', { class: 'small', disabled: m.attrs[a] <= P.attrMin, 'aria-label': `Lower ${a}`, onclick: () => { m.attrs[a]--; set(); } }, '−'),
        h('span', { class: 'num val' }, m.attrs[a]),
        h('button', { class: 'small', disabled: m.attrs[a] >= P.attrMax || left <= 0, 'aria-label': `Raise ${a}`, onclick: () => { m.attrs[a]++; set(); } }, '+')));
    const featBox = ({ tree, feats }) => h('div', { class: 'stack tight' },
      h('span', { class: 'label' }, tree.name),
      feats.map((f) => {
        const on = m.feats.includes(f.id);
        return h('label', { class: `feat-pick ${on ? 'on' : ''}`, title: f.effect },
          h('input', { type: 'checkbox', checked: on, disabled: !on && m.feats.length >= startingFeats(), onchange: (e) => { m.feats = e.target.checked ? m.feats.concat(f.id) : m.feats.filter((x) => x !== f.id); if (!m.feats.some((x) => /^verb_/.test(x))) m.nouns = []; set(); } }),
          h('span', null, h('b', null, f.name), ' ', h('span', { class: 'small muted' }, f.effect)));
      }));
    const casts = m.feats.some((f) => /^verb_/.test(f));
    return h('div', { class: 'create-grid' },
      h('div', { class: 'create-doll stack' },
        h('div', { class: 'doll-stage' }, Art.paperDoll(preview, { size: 300 })),
        h('div', { class: 'stack tight' },
          swatches('Skin', Art.SKIN, m.look.skin, (i) => { m.look.skin = i; set(); }),
          swatches('Hair', Art.HAIR, m.look.hair, (i) => { m.look.hair = i; set(); }),
          swatches('Clothes', Art.CLOTH, m.look.cloth, (i) => { m.look.cloth = i; set(); }),
          h('div', { class: 'row' }, h('span', { class: 'label' }, 'Build'), [['Slight', 0], ['Average', 1], ['Broad', 2]].map(([l, v]) => h('button', { class: `small ${m.look.build === v ? 'selected' : ''}`, onclick: () => { m.look.build = v; set(); } }, l))))),
      h('div', { class: 'stack create-form' },
        h('label', { class: 'field', for: 'cname' }, h('span', { class: 'label' }, 'Name'), h('input', { id: 'cname', value: m.name, maxlength: 24, oninput: (e) => { m.name = e.target.value; refreshTabs(); }, onchange: set })),
        h('section', { class: 'stack tight' }, h('h3', null, 'Starting kit'),
          h('div', { class: 'kits' }, kits.map((k) => h('button', { class: `kit ${m.kit === k.id ? 'selected' : ''}`, onclick: () => { m.kit = k.id; set(); } }, h('b', null, k.name), h('span', { class: 'small muted' }, k.blurb))))),
        h('section', { class: 'stack tight' },
          h('div', { class: 'row spread' }, h('h3', null, 'Attributes'), h('span', { class: `chip ${left === 0 ? 'ok' : 'warn'}` }, `${left} points left`)),
          h('p', { class: 'small muted' }, `${P.attrPool} points, ${P.attrMin} to ${P.attrMax} each. Attributes only rise further through Conditioning feats; levels do not raise them.`),
          G.CONFIG.attributes.map(attrRow)),
        h('section', { class: 'stack tight' },
          h('div', { class: 'row spread' }, h('h3', null, 'Starting feats'), h('span', { class: `chip ${m.feats.length === startingFeats() ? 'ok' : 'warn'}` }, `${m.feats.length} of ${startingFeats()}`)),
          h('p', { class: 'small muted' }, 'Feats buy efficiency and options, not raw stats. More come with levels, at the Training Yard.'),
          h('div', { class: 'feat-grid' }, startFeats().map(featBox))),
        casts ? h('section', { class: 'stack tight' }, h('h3', null, 'A word you know'),
          h('p', { class: 'small muted' }, 'Nouns are found in the world, in books and from teachers. A caster begins knowing one.'),
          h('div', { class: 'row' }, NOUNS.map((n) => h('button', { class: `small ${m.nouns.includes(n) ? 'selected' : ''}`, onclick: () => { m.nouns = [n]; set(); } }, n)))) : null));
  }

  function swatches(label, list, cur, pick) {
    return h('div', { class: 'row' }, h('span', { class: 'label' }, label),
      list.map((c, i) => h('button', { class: `swatch ${cur === i ? 'selected' : ''}`, style: { background: c }, 'aria-label': `${label} ${i + 1}`, onclick: () => pick(i) })));
  }

  function refreshTabs() {
    const st = UI.Game.ui.create;
    if (!st) return;
    document.querySelectorAll('[data-slot-tab]').forEach((el) => { el.textContent = st.members[Number(el.dataset.slotTab)].name || '—'; });
  }

  UI.Screens.create = function (game) {
    const st = state(game);
    const bad = st.members.map(problems);
    const ok = bad.every((p) => !p.length);
    return h('div', { class: 'stack create' },
      h('div', { class: 'view-head' },
        h('div', { class: 'stack tight' }, h('h1', null, 'Your company'), h('p', { class: 'muted' }, 'Four adventurers. Everyone starts in padded armor with what they can carry; the rest you earn.')),
        h('div', { class: 'row' },
          h('button', { onclick: () => { st.members = G.World.presetParty().map((p) => ({ name: p.name, kit: p.kit, attrs: Object.assign({}, p.attrs), feats: p.feats.slice(), nouns: (p.nouns || []).slice(), look: Object.assign({}, p.look) })); st.slot = 0; game.render(); } }, 'Use the example party'),
          h('button', { onclick: () => game.go('title') }, 'Back'))),
      h('div', { class: 'tabs members', role: 'tablist' }, st.members.map((m, i) => h('button', { class: `tab ${st.slot === i ? 'active' : ''}`, role: 'tab', 'aria-selected': st.slot === i, onclick: () => { st.slot = i; game.render(); } },
        Art.portrait(G.World.makeCharacter(m), 34), h('span', { 'data-slot-tab': i }, m.name || '—'), bad[i].length ? h('span', { class: 'chip warn' }, '!') : h('span', { class: 'chip ok' }, '✓')))),
      bad[st.slot].length ? h('p', { class: 'small', style: { color: 'var(--warn)' } }, 'This character ' + bad[st.slot].join('; ') + '.') : null,
      memberEditor(game, st),
      h('div', { class: 'row create-foot' },
        h('button', { class: 'primary big', disabled: !ok, onclick: () => game.newGame(st.members.map((m) => Object.assign({}, m, { name: m.name.trim() }))) }, 'Begin in Stonebridge'),
        !ok ? h('span', { class: 'small muted' }, 'Every character needs a name, all attribute points spent, and their feats chosen.') : null));
  };
})(globalThis.BBB);
