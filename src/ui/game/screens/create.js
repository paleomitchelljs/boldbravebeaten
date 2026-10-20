/*
 * New game: build a party of four. Compact: dropdowns for the look, the kit and the starting feats, small
 * steppers for the eight attributes, and an (i) on anything that needs explaining.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, tip, ibtn, icon } = UI;
  const C = G.Character;
  const Sprites = UI.Sprites;

  const ATTR_BLURB = { STR: 'Force: damage, grappling, carrying heavy gear', CON: 'Toughness: your wounds. CON 0 is death', DEX: 'Aim, parry, locks, traps', SPD: 'Initiative, AP, movement, stealth', INT: 'Magic, lore, deception', WIL: 'Resolve: stamina regeneration, resisting magic', WIS: 'Perception, reading people', CHA: 'Charm, appeal, bargaining' };
  const NOUNS = ['fire', 'frost', 'lightning', 'wind', 'earth', 'vine', 'life', 'force'];

  function blankMember(i) {
    return { name: ['Aldric', 'Brea', 'Cassian', 'Dara'][i], kit: ['sword', 'bow', 'hammer', 'staff'][i], attrs: { STR: 5, CON: 5, DEX: 5, SPD: 5, INT: 5, WIL: 5, WIS: 5, CHA: 5 }, feats: [], nouns: [], look: { skin: i % 6, hair: (i * 2 + 1) % 7, cloth: i % 6, build: 1, sprite: null, tint: [0, 2, 3, 1][i] } };
  }

  function state(game) {
    if (!game.ui.create) game.ui.create = { slot: 0, members: [0, 1, 2, 3].map(blankMember) };
    return game.ui.create;
  }

  const spent = (m) => Object.values(m.attrs).reduce((t, v) => t + v, 0);
  const startingFeats = () => G.CONFIG.startingFeats;
  const chosen = (m) => m.feats.filter(Boolean);

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
    if (chosen(m).length !== startingFeats()) p.push(`choose ${startingFeats()} feats (${chosen(m).length} chosen)`);
    if (chosen(m).some((f) => /^verb_/.test(f)) && !m.nouns.length) p.push('a caster needs a starting word');
    return p;
  }

  const sel = (id, label, value, options, onchange, cls) => h('label', { class: 'pick ' + (cls || '') },
    h('span', { class: 'label' }, label),
    h('select', { id, 'aria-label': label, onchange: (e) => onchange(e.target.value) }, options.map((o) => (o.group
      ? h('optgroup', { label: o.group }, o.items.map(([v, l, dis]) => h('option', { value: v, selected: String(v) === String(value), disabled: !!dis }, l)))
      : h('option', { value: o[0], selected: String(o[0]) === String(value), disabled: !!o[2] }, o[1])))));

  function memberEditor(game, st) {
    const m = st.members[st.slot];
    const P = G.CONFIG.game.party;
    const kits = G.Content.world.start.kits;
    const kit = kits.find((k) => k.id === m.kit) || kits[0];
    const preview = G.World.makeCharacter(Object.assign({}, m, { feats: chosen(m) }));
    const left = P.attrPool - spent(m);
    const set = () => game.render();
    const L = Sprites.look(preview);
    const attr = (a) => h('div', { class: 'astep', title: ATTR_BLURB[a] },
      h('span', { class: 'label' }, a),
      h('div', { class: 'row stepper' },
        h('button', { class: 'step', disabled: m.attrs[a] <= P.attrMin, 'aria-label': `Lower ${a}`, onclick: () => { m.attrs[a]--; set(); } }, icon('minus', 10)),
        h('span', { class: 'num val' }, m.attrs[a]),
        h('button', { class: 'step', disabled: m.attrs[a] >= P.attrMax || left <= 0, 'aria-label': `Raise ${a}`, onclick: () => { m.attrs[a]++; set(); } }, icon('plus', 10))));
    // One dropdown per starting feat; a feat taken in one slot is greyed in the others.
    const slots = [];
    for (let i = 0; i < startingFeats(); i++) {
      const cur = m.feats[i] || '';
      const f = cur ? G.DATA.FEATS[cur] : null;
      const opts = [['', '— choose —']].concat(startFeats().map(({ tree, feats }) => ({ group: tree.name, items: feats.map((x) => [x.id, x.name, m.feats.includes(x.id) && x.id !== cur]) })));
      slots.push(h('div', { class: 'featslot' },
        sel(`feat-${i}`, `Feat ${i + 1}`, cur, opts, (v) => { m.feats[i] = v; while (m.feats.length > startingFeats()) m.feats.pop(); if (!chosen(m).some((x) => /^verb_/.test(x))) m.nouns = []; set(); }, 'grow'),
        f ? tip(f.effect, f.name) : h('span', { class: 'tip-gap' })));
    }
    const casts = chosen(m).some((f) => /^verb_/.test(f));
    return h('div', { class: 'create-grid' },
      h('div', { class: 'create-doll' },
        h('div', { class: 'alcove big' }, Sprites.figure(preview, 7)),
        h('label', { class: 'pick' }, h('span', { class: 'label' }, 'Name'), h('input', { id: 'cname', value: m.name, maxlength: 24, oninput: (e) => { m.name = e.target.value; refreshTabs(); }, onchange: set })),
        h('div', { class: 'row2' },
          sel('look-sprite', 'Look', L.kind, Sprites.PARTY_KINDS, (v) => { m.look.sprite = v; set(); }),
          sel('look-tint', 'Colour', m.look.tint, Sprites.TINTS.map((t, i) => [i, t[1]]), (v) => { m.look.tint = Number(v); set(); }))),
      h('div', { class: 'create-form' },
        h('div', { class: 'row kitrow' }, sel('kit', 'Starting kit', m.kit, kits.map((k) => [k.id, k.name]), (v) => { m.kit = v; m.look.sprite = null; set(); }, 'grow'), tip(kit.blurb, kit.name)),
        h('section', { class: 'stack tight' },
          h('div', { class: 'row spread' }, h('span', { class: 'label' }, 'Attributes'), h('span', { class: 'row' }, tip(`${P.attrPool} points, ${P.attrMin} to ${P.attrMax} each. Attributes only rise further through Conditioning feats; levels do not raise them.`, 'Attributes'), h('span', { class: `chip ${left === 0 ? 'ok' : 'warn'}` }, `${left} left`))),
          h('div', { class: 'attrs' }, G.CONFIG.attributes.map(attr))),
        h('section', { class: 'stack tight' },
          h('div', { class: 'row spread' }, h('span', { class: 'label' }, 'Starting feats'), h('span', { class: 'row' }, tip('Feats buy efficiency and options, not raw stats. More come with levels, at the Training Yard.', 'Feats'), h('span', { class: `chip ${chosen(m).length === startingFeats() ? 'ok' : 'warn'}` }, `${chosen(m).length}/${startingFeats()}`))),
          slots),
        casts ? h('div', { class: 'row kitrow' }, sel('noun', 'A word you know', m.nouns[0] || '', [['', '— choose —']].concat(NOUNS.map((n) => [n, n])), (v) => { m.nouns = v ? [v] : []; set(); }, 'grow'), tip('Nouns are found in the world, in books and from teachers. A caster begins knowing one.', 'Words')) : null));
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
    return h('div', { class: 'create' },
      h('div', { class: 'view-head compact' },
        h('div', { class: 'row' }, h('h1', null, 'Your company'), tip('Four adventurers. Everyone starts in padded armor with what they can carry; the rest you earn.', 'Your company')),
        h('div', { class: 'row' },
          h('button', { onclick: () => { st.members = G.World.presetParty().map((p) => ({ name: p.name, kit: p.kit, attrs: Object.assign({}, p.attrs), feats: p.feats.slice(), nouns: (p.nouns || []).slice(), look: Object.assign({}, p.look) })); st.slot = 0; game.render(); } }, 'Example party'),
          h('button', { onclick: () => game.go('title') }, 'Back'))),
      h('div', { class: 'tabs members', role: 'tablist' }, st.members.map((m, i) => h('button', { class: `tab ${st.slot === i ? 'active' : ''}`, role: 'tab', 'aria-selected': st.slot === i, onclick: () => { st.slot = i; game.render(); } },
        Sprites.portrait(G.World.makeCharacter(Object.assign({}, m, { feats: chosen(m) })), 28), h('span', { 'data-slot-tab': i }, m.name || '—'), bad[i].length ? h('span', { class: 'chip warn', title: bad[i].join('; ') }, '!') : h('span', { class: 'chip ok' }, '✓')))),
      bad[st.slot].length ? h('p', { class: 'small warn-text' }, 'Needs: ' + bad[st.slot].join('; ') + '.') : null,
      memberEditor(game, st),
      h('div', { class: 'row create-foot' },
        h('button', { class: 'primary big', disabled: !ok, onclick: () => game.newGame(st.members.map((m) => Object.assign({}, m, { name: m.name.trim(), feats: chosen(m) }))) }, 'Begin in Stonebridge'),
        !ok ? h('span', { class: 'small muted' }, 'Every character needs a name, all points spent and feats chosen. Hover the ! on a tab.') : null));
  };
})(globalThis.BBB);
