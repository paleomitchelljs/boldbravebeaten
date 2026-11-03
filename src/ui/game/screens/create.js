/*
 * New game (the user, 2026-11-02): the portraits of every hero who can start (start.yaml presets and recruits); pick
 * up to four, then begin with them as they are or edit them first: name, attributes, feats, words and gear. Those
 * not picked wait in the village to be recruited.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, tip, icon, toast } = UI;
  const C = G.Character;
  const Items = G.Items;
  const Sprites = UI.Sprites;

  const ATTR_BLURB = { STR: 'Force: damage, grappling, carrying heavy gear', CON: 'Toughness: your wounds. CON 0 is death', DEX: 'Aim, parry, locks, traps', SPD: 'Initiative, AP, movement, stealth', INT: 'Magic, lore, deception', WIL: 'Resolve: stamina regeneration, resisting magic', WIS: 'Perception, reading people', CHA: 'Charm, appeal, bargaining' };
  const NOUNS = ['fire', 'frost', 'lightning', 'wind', 'earth', 'vine', 'life', 'force'];
  const SIZE = () => G.CONFIG.game.party.size;
  const keyOf = (hero) => hero.id || hero.name;
  const startName = () => { const S = G.Content.world.start || {}, id = (S.go && S.go.to) || S.place; return (G.Content.world.places[id] || {}).name || id; };
  const begin = (game, specs) => { game.draft = null; game.newGame(specs, (G.Content.world.start || {}).go); };
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // What a hero carries, in a few words: the weapon in hand and the armor.
  function gearLine(c) {
    const w = C.wieldedWeapon(c);
    return [w ? Items.itemName(w) : 'unarmed', c.armor ? Items.itemName(c.armor) : 'no armor'].join(', ');
  }

  // ---- The portraits ------------------------------------------------------------------------------------------------
  // The new party being drawn up lives on the game (game.go clears game.ui), so going back from the editor keeps the
  // picks, and going on to it again keeps the edits for the same heroes. The title's New Game starts it afresh.
  function picks(game) {
    if (!game.draft) game.draft = { picked: [], members: null, pools: null, keys: null, slot: 0 };
    return game.draft;
  }
  function editPicks(game, st, chosen) {
    const keys = chosen.map(keyOf);
    if (!st.members || String(st.keys) !== String(keys)) { st.members = chosen.map(clone); st.pools = chosen.map(spent); st.keys = keys; st.slot = 0; }
    game.go('create');
  }

  function heroCard(game, st, hero) {
    const c = G.World.makeCharacter(hero);
    const k = keyOf(hero), at = st.picked.indexOf(k), on = at >= 0;
    const toggle = () => {
      if (on) st.picked.splice(at, 1);
      else if (st.picked.length >= SIZE()) { toast(`A party is ${SIZE()} at most. Take someone out first.`); return; }
      else st.picked.push(k);
      game.render();
    };
    return h('button', { class: 'hero-card' + (on ? ' selected' : ''), 'aria-pressed': String(on), 'data-hero': k, onclick: toggle },
      on ? h('span', { class: 'hero-pick num', 'aria-label': `Pick ${at + 1}` }, String(at + 1)) : null,
      h('div', { class: 'alcove' }, Sprites.figure(c, 3)),
      h('b', { class: 'hero-name' }, hero.name),
      h('span', { class: 'small muted' }, `Level ${c.level} · ${gearLine(c)}`),
      hero.blurb ? h('span', { class: 'small hero-blurb' }, hero.blurb) : null);
  }

  UI.Screens.heroes = function (game) {
    const st = picks(game);
    const all = G.World.heroes();
    const chosen = st.picked.map((k) => all.find((x) => keyOf(x) === k)).filter(Boolean);
    const n = chosen.length;
    return h('div', { class: 'create' },
      h('div', { class: 'view-head compact' },
        h('div', { class: 'row' }, h('h1', null, 'Choose your company'), tip(`Pick up to ${SIZE()}. Those you leave wait in ${startName()}: you can recruit them there later, to fill a place or take a fallen friend's.`, 'Your company')),
        h('button', { onclick: () => game.go('title') }, 'Back')),
      h('p', { class: 'muted small' }, n ? `${n} of ${SIZE()} chosen: ${chosen.map((x) => x.name).join(', ')}.` : `Pick ${SIZE()} heroes.`),
      h('div', { class: 'hero-grid' }, all.map((hero) => heroCard(game, st, hero))),
      h('div', { class: 'row create-foot' },
        h('button', { class: 'primary big', disabled: !n, onclick: () => begin(game, chosen.map(clone)) }, 'Begin'),
        h('button', { class: 'big', disabled: !n, onclick: () => editPicks(game, st, chosen) }, 'Edit Characters'),
        n && n < SIZE() ? h('span', { class: 'small muted' }, `${SIZE() - n} place${SIZE() - n === 1 ? '' : 's'} left empty: recruit in ${startName()}.`) : null));
  };

  // ---- Editing the chosen ---------------------------------------------------------------------------------------------
  const spent = (m) => Object.values(m.attrs).reduce((t, v) => t + v, 0);

  // The character as built, and which of its feats could not be taken in order (a prerequisite removed) and why.
  function build(m) {
    const base = G.World.makeCharacter(Object.assign({}, m, { feats: [] }));
    const skipped = [];
    for (const f of m.feats) { const r = C.canTakeFeat(base, f); if (r.ok) C.addFeat(base, f); else skipped.push({ f, why: r.reason }); }
    return { c: base, skipped };
  }

  function problems(m, pool) {
    const p = [];
    const { c, skipped } = build(m);
    if (!m.name.trim()) p.push('needs a name');
    if (spent(m) !== pool) p.push(`spend all ${pool} attribute points (${spent(m)} spent)`);
    for (const s of skipped) p.push(`${(G.DATA.FEATS[s.f] || {}).name || s.f}: ${s.why.toLowerCase()}`);
    if (m.feats.some((f) => /^verb_/.test(f)) && !(m.nouns || []).length) p.push('a caster needs a word');
    void c;
    return p;
  }

  const sel = (id, label, value, options, onchange, cls) => h('label', { class: 'pick ' + (cls || '') },
    h('span', { class: 'label' }, label),
    h('select', { id, 'aria-label': label, onchange: (e) => onchange(e.target.value) }, options.map((o) => (o.group
      ? h('optgroup', { label: o.group }, o.items.map(([v, l, dis]) => h('option', { value: v, selected: String(v) === String(value), disabled: !!dis }, l)))
      : h('option', { value: o[0], selected: String(o[0]) === String(value), disabled: !!o[2] }, o[1])))));

  // Materials a starting item may be made of (nothing exotic): its usual one and the ordinary others it allows.
  const ordinary = (ids) => ids.filter((id, i) => ids.indexOf(id) === i && G.DATA.MATERIALS[id] && !G.DATA.MATERIALS[id].exotic);
  const armorMaterials = (t) => ordinary([G.DATA.ARMOR[t].material].concat(G.DATA.ARMOR[t].materials || []));
  const weaponMaterials = (t) => { const m = G.DATA.WEAPONS[t].material; return (G.DATA.MATERIALS[m] || {}).metal ? ordinary([m, 'bronze', 'iron', 'steel']) : [m]; };
  const shieldMaterials = () => Object.keys(G.DATA.SHIELD_MATERIALS).filter((id) => !(G.DATA.MATERIALS[id] || {}).exotic);
  const matName = (id) => (G.DATA.MATERIALS[id] || G.DATA.SHIELD_MATERIALS[id] || {}).name || id;
  const wieldable = () => Object.entries(G.DATA.WEAPONS).filter(([, w]) => !w.natural);

  // The gear: armor, the weapon in hand and the one at the belt (or in the off hand), the shield; each with a material.
  function gearEditor(game, m, c) {
    const set = () => game.render();
    const main = C.wieldedWeapon(c);
    const second = c.weapons.find((w) => w.id === (c.offhand || c.sidearm));
    // The editor writes the gear as item specs, starting from what the hero has now.
    const weapons = () => [main && { weapon: main.type, material: Items.materialOf(main) }, second && { weapon: second.type, material: Items.materialOf(second) }];
    const setWeapons = (list) => { m.weaponItems = list.filter(Boolean); };
    const armorT = c.armor && c.armor.type !== 'none' ? c.armor.type : '';
    const shieldT = c.shield ? c.shield.size : '';
    const twoHanded = main && G.DATA.WEAPONS[main.type].hands === 2;
    const rows = [
      h('div', { class: 'row2' },
        sel('gear-armor', 'Armor', armorT, [['', 'None']].concat(Object.entries(G.DATA.ARMOR).filter(([, a]) => !a.natural).map(([id, a]) => [id, a.name])),
          (v) => { m.armorItem = v ? { armor: v, material: G.DATA.ARMOR[v].material } : null; set(); }),
        armorT ? sel('gear-armor-mat', 'Of', Items.materialOf(c.armor), armorMaterials(armorT).map((id) => [id, matName(id)]), (v) => { m.armorItem = { armor: armorT, material: v }; set(); }) : h('span')),
      h('div', { class: 'row2' },
        sel('gear-main', 'In hand', main ? main.type : '', wieldable().map(([id, w]) => [id, w.name]), (v) => {
          const list = weapons(); list[0] = { weapon: v, material: G.DATA.WEAPONS[v].material }; setWeapons(list);
          if (G.DATA.WEAPONS[v].hands === 2) m.shieldItem = null;
          if (/bow/.test(v) && !m.arrows) m.arrows = 20;
          set();
        }),
        main ? sel('gear-main-mat', 'Of', Items.materialOf(main), weaponMaterials(main.type).map((id) => [id, matName(id)]), (v) => { const list = weapons(); list[0].material = v; setWeapons(list); set(); }) : h('span')),
      h('div', { class: 'row2' },
        sel('gear-second', 'At the belt', second ? second.type : '', [['', 'None']].concat(wieldable().filter(([, w]) => w.hands === 1).map(([id, w]) => [id, w.name + (w.offhand ? ' (off hand)' : '')])), (v) => {
          const list = weapons(); list[1] = v ? { weapon: v, material: G.DATA.WEAPONS[v].material } : null; setWeapons(list); set();
        }),
        second ? sel('gear-second-mat', 'Of', Items.materialOf(second), weaponMaterials(second.type).map((id) => [id, matName(id)]), (v) => { const list = weapons(); list[1].material = v; setWeapons(list); set(); }) : h('span')),
      h('div', { class: 'row2' },
        sel('gear-shield', 'Shield', shieldT, [['', 'None']].concat(Object.entries(G.DATA.SHIELDS).map(([id, s]) => [id, s.name, twoHanded])),
          (v) => { m.shieldItem = v ? { shield: v, material: 'wood' } : null; set(); }),
        shieldT ? sel('gear-shield-mat', 'Of', c.shield.material, shieldMaterials().map((id) => [id, matName(id)]), (v) => { m.shieldItem = { shield: shieldT, material: v }; set(); }) : h('span')),
    ];
    return h('section', { class: 'stack tight' },
      h('div', { class: 'row spread' }, h('span', { class: 'label' }, 'Gear'), tip('What they set out with. Anything exotic has to be found or bought. A two-handed weapon leaves no hand for a shield.', 'Gear')),
      rows,
      /bow/.test(main ? main.type : '') ? h('p', { class: 'small muted' }, `${m.arrows || 0} arrows`) : null);
  }

  // Feats: what they have (each can go), and a list of what they could take next, up to their level's budget.
  function featEditor(game, m, c, skipped) {
    const set = () => game.render();
    const budget = C.featBudget(c), have = m.feats.length;
    const name = (id) => (G.DATA.FEATS[id] || {}).name || id;
    const chips = m.feats.map((id, i) => {
      const bad = skipped.find((s) => s.f === id);
      return h('span', { class: 'chip feat-chip' + (bad ? ' warn' : ''), title: bad ? bad.why : (G.DATA.FEATS[id] || {}).effect || '' },
        name(id),
        h('button', { class: 'chip-x', 'aria-label': `Remove ${name(id)}`, onclick: () => { m.feats.splice(i, 1); if (!m.feats.some((f) => /^verb_/.test(f))) m.nouns = []; set(); } }, icon('close', 9)));
    });
    const open = [];
    if (have < budget) {
      for (const t of C.TREES) {
        const items = Object.values(G.DATA.FEATS).filter((f) => f.tree === t.id && f.auto && C.canTakeFeat(c, f.id).ok).map((f) => [f.id, f.name + (C.rank(c, f.id) ? ` (rank ${C.rank(c, f.id) + 1})` : '')]);
        if (items.length) open.push({ group: t.name, items });
      }
    }
    return h('section', { class: 'stack tight' },
      h('div', { class: 'row spread' }, h('span', { class: 'label' }, 'Feats'),
        h('span', { class: 'row' }, tip('Feats buy efficiency and options, not raw stats. Some need others first, or several in their tree. More come with levels, at the Training Yard.', 'Feats'), h('span', { class: `chip ${have === budget ? 'ok' : 'warn'}` }, `${have}/${budget}`))),
      h('div', { class: 'row wrap' }, chips.length ? chips : h('span', { class: 'small muted' }, 'None yet.')),
      open.length ? sel('feat-add', 'Add a feat', '', [['', '— choose —']].concat(open), (v) => { if (v) { m.feats.push(v); set(); } }, 'grow') : null);
  }

  function memberEditor(game, st) {
    const m = st.members[st.slot];
    const pool = st.pools[st.slot];
    const P = G.CONFIG.game.party;
    const { c, skipped } = build(m);
    const left = pool - spent(m);
    const set = () => game.render();
    const attr = (a) => h('div', { class: 'astep', title: ATTR_BLURB[a] },
      h('span', { class: 'label' }, a),
      h('div', { class: 'row stepper' },
        h('button', { class: 'step', disabled: m.attrs[a] <= P.attrMin, 'aria-label': `Lower ${a}`, onclick: () => { m.attrs[a]--; set(); } }, icon('minus', 10)),
        h('span', { class: 'num val' }, m.attrs[a]),
        h('button', { class: 'step', disabled: m.attrs[a] >= P.attrMax || left <= 0, 'aria-label': `Raise ${a}`, onclick: () => { m.attrs[a]++; set(); } }, icon('plus', 10))));
    const casts = m.feats.some((f) => /^verb_/.test(f));
    const nouns = NOUNS.concat((m.nouns || []).filter((n) => !NOUNS.includes(n)));
    return h('div', { class: 'create-grid' },
      h('div', { class: 'create-doll' },
        h('div', { class: 'alcove big' }, Sprites.figure(c, 7)),
        h('label', { class: 'pick' }, h('span', { class: 'label' }, 'Name'), h('input', { id: 'cname', value: m.name, maxlength: 24, oninput: (e) => { m.name = e.target.value; refreshTabs(); }, onchange: set })),
        h('span', { class: 'small muted' }, `Level ${c.level}`)),
      h('div', { class: 'create-form' },
        h('section', { class: 'stack tight' },
          h('div', { class: 'row spread' }, h('span', { class: 'label' }, 'Attributes'), h('span', { class: 'row' }, tip(`${pool} points, ${P.attrMin} to ${P.attrMax} each. Attributes only rise further through Conditioning feats; levels do not raise them.`, 'Attributes'), h('span', { class: `chip ${left === 0 ? 'ok' : 'warn'}` }, `${left} left`))),
          h('div', { class: 'attrs' }, G.CONFIG.attributes.map(attr))),
        featEditor(game, m, c, skipped),
        casts ? h('section', { class: 'stack tight' },
          h('div', { class: 'row spread' }, h('span', { class: 'label' }, 'Words known'), tip('Nouns are found in the world, in books and from teachers. A caster begins knowing at least one.', 'Words')),
          h('div', { class: 'row wrap' }, nouns.map((n) => { const on = (m.nouns || []).includes(n); return h('button', { class: 'chip' + (on ? ' ok' : ''), 'aria-pressed': String(on), onclick: () => { m.nouns = on ? m.nouns.filter((x) => x !== n) : (m.nouns || []).concat(n); set(); } }, n); }))) : null,
        gearEditor(game, m, c)));
  }

  function refreshTabs() {
    const st = UI.Game.draft;
    if (!st || !st.members) return;
    document.querySelectorAll('[data-slot-tab]').forEach((el) => { el.textContent = st.members[Number(el.dataset.slotTab)].name || '—'; });
  }

  UI.Screens.create = function (game) {
    const st = game.draft;
    if (!st || !st.members || !st.members.length) return UI.Screens.heroes(game);
    const bad = st.members.map((m, i) => problems(m, st.pools[i]));
    const ok = bad.every((p) => !p.length);
    return h('div', { class: 'create' },
      h('div', { class: 'view-head compact' },
        h('div', { class: 'row' }, h('h1', null, 'Your company'), tip('Change what you like: names, attributes, feats and gear. Each keeps their own pool of attribute points and their level\'s feats.', 'Your company')),
        h('button', { onclick: () => game.go('heroes') }, 'Back to the heroes')),
      h('div', { class: 'tabs members', role: 'tablist' }, st.members.map((m, i) => h('button', { class: `tab ${st.slot === i ? 'active' : ''}`, role: 'tab', 'aria-selected': st.slot === i, onclick: () => { st.slot = i; game.render(); } },
        Sprites.portrait(build(m).c, 28), h('span', { 'data-slot-tab': i }, m.name || '—'), bad[i].length ? h('span', { class: 'chip warn', title: bad[i].join('; ') }, '!') : h('span', { class: 'chip ok' }, '✓')))),
      bad[st.slot].length ? h('p', { class: 'small warn-text' }, 'Needs: ' + bad[st.slot].join('; ') + '.') : null,
      memberEditor(game, st),
      h('div', { class: 'row create-foot' },
        h('button', { class: 'primary big', disabled: !ok, onclick: () => begin(game, st.members.map((m) => Object.assign({}, m, { name: m.name.trim() }))) }, `Begin in ${startName()}`),
        !ok ? h('span', { class: 'small muted' }, 'Every hero needs a name, all their points spent, and feats they can hold. Hover the ! on a tab.') : null));
  };
})(globalThis.BBB);
