/* Character sheet: attributes, derived numbers, gear, attacks, feats. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, select, num, bar, toast } = UI;
  const C = G.Character;
  const Items = G.Items;
  const D = G.DATA;
  const CONFIG = G.CONFIG;

  // Natural (monster) items stay out of the lists, except the one already chosen.
  const opts = (obj, keep) => Object.keys(obj).filter((k) => !obj[k].natural || k === keep).map((k) => [k, obj[k].name]);

  function attrTable(app, c) {
    const change = () => { c.stamina = Math.min(c.stamina, C.maxStamina(c)); app.save(); app.render(); };
    return h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, 'Attribute'), h('th', { class: 'n' }, 'Base'), h('th', { class: 'n' }, 'Cond.'), h('th', { class: 'n' }, 'Damage'), h('th', { class: 'n' }, 'Current'), h('th', { class: 'n' }, 'In armor'))),
      h('tbody', null, CONFIG.attributes.map((a) => h('tr', null,
        h('th', { scope: 'row' }, a),
        h('td', { class: 'n' }, num('base-' + a, c.base[a], (v) => { c.base[a] = Math.max(CONFIG.attrMin, Math.min(c.monster ? CONFIG.monsterAttrMax : CONFIG.attrMax, Math.round(v))); change(); }, { min: CONFIG.attrMin, max: c.monster ? CONFIG.monsterAttrMax : CONFIG.attrMax, 'aria-label': a + ' base' })),
        h('td', { class: 'n' }, C.conditioning(c, a) ? '+' + C.conditioning(c, a) : '—'),
        h('td', { class: 'n' }, num('dmg-' + a, c.damage[a], (v) => {
          const before = C.maxStamina(c);
          c.damage[a] = Math.max(0, Math.round(v));
          const after = C.maxStamina(c);
          c.stamina = Math.max(0, Math.min(after, c.stamina + (after - before)));
          C.updateCondition(c);
          app.save(); app.render();
        }, { min: 0, 'aria-label': a + ' damage' })),
        h('td', { class: 'n' }, h('b', null, C.attr(c, a))),
        h('td', { class: 'n muted' }, a === 'SPD' || a === 'DEX' ? C.combatAttr(c, a) : ''))))));
  }

  function derived(c) {
    const max = C.maxStamina(c);
    const items = [
      ['Max stamina', max, '4×CON + STR + SPD + DEX'],
      ['Regen / round', (C.regen(c) >= 0 ? '+' : '') + C.regen(c), '⌊(CON+WIL)/4⌋ − armor'],
      ['AP pool', C.apPool(c), `(3 + ⌊SPD/2⌋${C.fatiguePenalty(c) ? ' − ' + C.fatiguePenalty(c) + ' fatigue' : ''})${C.apScale() > 1 ? ' × ' + C.apScale() : ''}`],
      ['Movement', `${C.squaresPerAP(c)} sq`, `per ${C.apScale()} AP · 1 + ⌊SPD/4⌋`],
      ['Initiative', 'd10+' + C.combatAttr(c, 'SPD'), 'SPD in armor'],
      ['STR damage', (C.strBonus(c) >= 0 ? '+' : '') + C.strBonus(c), '⌊(STR−5)/2⌋'],
    ];
    return h('div', { class: 'derived' }, items.map(([k, v, f]) => h('div', { class: 'd', title: f }, h('span', { class: 'label' }, k), h('b', null, v), h('span', { class: 'small muted' }, f))));
  }

  function staminaRow(app, c) {
    const max = C.maxStamina(c);
    return h('div', { class: 'stack tight' },
      h('div', { class: 'row spread' },
        h('label', { class: 'inline', for: 'cur-stamina' }, h('span', { class: 'label' }, 'Current stamina'),
          num('cur-stamina', c.stamina, (v) => { c.stamina = Math.max(0, Math.min(max, Math.round(v))); if (c.stamina > 0 && !c.status.dead) c.status.unconscious = false; C.updateCondition(c); app.save(); app.render(); }, { min: 0, max })),
        h('span', { class: 'num' }, `${c.stamina} / ${max}`)),
      bar(c.stamina, max),
      c.bleeds.length ? h('div', { class: 'row small' },
        h('span', { class: 'chip bad' }, `Bleeding: ${c.bleeds.reduce((t, b) => t + b.remaining, 0)} CON over ${Math.max(...c.bleeds.map((b) => b.rounds))} rounds`),
        h('button', { class: 'small', onclick: () => { c.bleeds = []; app.save(); app.render(); toast('Bleeding stopped'); } }, 'Stop bleeding')) : null,
      (c.status.unconscious || c.status.dead) ? h('div', { class: 'row small' }, UI.Cards.statusChips(c),
        h('button', { class: 'small', onclick: () => { c.status = C.freshStatus(); C.updateCondition(c); app.save(); app.render(); } }, 'Clear status')) : null);
  }

  function armorEditor(app, c) {
    const a = c.armor;
    const ai = C.armorInfo(c);
    const set = (type, cov, q) => {
      c.armor = type ? Items.makeArmor(type, cov, q) : null;
      app.save(); app.render();
    };
    return h('div', { class: 'stack tight' },
      h('div', { class: 'row' },
        h('span', { class: 'label', style: { minWidth: '4.5em' } }, 'Armor'),
        select('armor-type', a ? a.type : '', [['', 'None']].concat(opts(D.ARMOR, a && a.type)), (v) => set(v, a ? a.coverage : 'full', a ? a.quality : 'standard'), { 'aria-label': 'Armor type' }),
        a ? select('armor-cov', a.coverage, opts(D.COVERAGE), (v) => set(a.type, v, a.quality), { 'aria-label': 'Coverage' }) : null,
        a ? select('armor-q', a.quality, opts(D.QUALITY), (v) => set(a.type, a.coverage, v), { 'aria-label': 'Armor quality' }) : null),
      a ? h('div', { class: 'row small' },
        h('label', { class: 'inline', for: 'armor-dur' }, 'Durability', num('armor-dur', a.durability, (v) => { a.durability = Math.max(0, Math.min(ai.maxDurability, Math.round(v))); app.save(); app.render(); }, { min: 0, max: ai.maxDurability })),
        h('span', { class: 'muted num' }, `/ ${ai.maxDurability}`),
        h('span', { class: 'muted' }, `Mitigation P/S/B ${ai.effMit.P}/${ai.effMit.S}/${ai.effMit.B}`),
        h('span', { class: 'muted' }, `SPD −${ai.spd} · DEX −${ai.dex} · +${ai.stamina} stamina/action · regen −${ai.regen}`)) : null);
  }

  function shieldEditor(app, c) {
    const s = c.shield;
    const si = C.shieldInfo(c);
    const set = (size, mat, q) => { c.shield = size ? Items.makeShield(size, mat, q) : null; app.save(); app.render(); };
    return h('div', { class: 'stack tight' },
      h('div', { class: 'row' },
        h('span', { class: 'label', style: { minWidth: '4.5em' } }, 'Shield'),
        select('shield-size', s ? s.size : '', [['', 'None']].concat(opts(D.SHIELDS)), (v) => set(v, s ? s.material : 'wood', s ? s.quality : 'standard'), { 'aria-label': 'Shield size' }),
        s ? select('shield-mat', s.material, opts(D.SHIELD_MATERIALS), (v) => set(s.size, v, s.quality), { 'aria-label': 'Shield material' }) : null,
        s ? select('shield-q', s.quality, opts(D.QUALITY), (v) => set(s.size, s.material, v), { 'aria-label': 'Shield quality' }) : null),
      s ? h('div', { class: 'row small' },
        h('label', { class: 'inline', for: 'shield-dur' }, 'Durability', num('shield-dur', s.durability, (v) => { s.durability = Math.max(0, Math.min(si.maxDurability, Math.round(v))); app.save(); app.render(); }, { min: 0, max: si.maxDurability })),
        h('span', { class: 'muted num' }, `/ ${si.maxDurability}`),
        h('span', { class: 'muted' }, `Block ${si.blockAP} AP · breaks above ${si.threshold}`),
        !si.ready ? h('span', { class: 'chip warn' }, s.durability <= 0 ? 'Broken' : 'Slung (two-handed weapon)') : null) : null);
  }

  function weaponsEditor(app, c) {
    const rows = c.weapons.map((w) => h('tr', null,
      h('td', null, select('wt-' + w.id, w.type, opts(D.WEAPONS), (v) => { w.type = v; app.save(); app.render(); }, { 'aria-label': 'Weapon type' })),
      h('td', null, select('wq-' + w.id, w.quality, opts(D.QUALITY), (v) => { w.quality = v; app.save(); app.render(); }, { 'aria-label': 'Weapon quality' })),
      h('td', null, h('input', { type: 'radio', name: 'wield', id: 'wield-' + w.id, checked: c.wield === w.id, 'aria-label': 'In hand', onchange: () => { c.wield = w.id; c.status.dropped = null; app.save(); app.render(); } })),
      h('td', null, h('input', { type: 'radio', name: 'sidearm', id: 'side-' + w.id, checked: c.sidearm === w.id, 'aria-label': 'Sidearm', onchange: () => { c.sidearm = w.id; app.save(); app.render(); } })),
      h('td', null, D.WEAPONS[w.type].offhand ? h('input', { type: 'radio', name: 'offhand', id: 'off-' + w.id, checked: c.offhand === w.id, 'aria-label': 'Off hand', title: 'Held in the off hand (no shield, no two-handed weapon)', onchange: () => { c.offhand = w.id; app.save(); app.render(); } }) : null),
      h('td', { class: 'small muted' }, `${D.WEAPONS[w.type].hands === 1.5 ? '1½' : D.WEAPONS[w.type].hands}H · ${G.Items.weaponStats(w).weight} · ${D.WEAPONS[w.type].reachName}`),
      h('td', null, h('button', { class: 'small ghost', 'aria-label': 'Move to pack', title: 'Move to pack', onclick: () => {
        c.weapons = c.weapons.filter((x) => x !== w);
        if (c.wield === w.id) c.wield = null;
        if (c.sidearm === w.id) c.sidearm = null;
        if (c.offhand === w.id) c.offhand = null;
        c.inventory.items.push(w);
        app.save(); app.render();
      } }, 'To pack'))));
    return h('div', { class: 'stack tight' },
      h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Weapon'), h('th', null, 'Quality'), h('th', null, 'In hand'), h('th', null, 'Sidearm'), h('th', null, 'Off hand'), h('th', null, ''), h('th', null, ''))),
        h('tbody', null, rows,
          h('tr', null, h('td', { colspan: 2, class: 'muted' }, 'Unarmed'),
            h('td', null, h('input', { type: 'radio', name: 'wield', id: 'wield-none', checked: c.wield == null, 'aria-label': 'Fight unarmed', onchange: () => { c.wield = null; app.save(); app.render(); } })),
            h('td', null, h('input', { type: 'radio', name: 'sidearm', id: 'side-none', checked: c.sidearm == null, 'aria-label': 'No sidearm', onchange: () => { c.sidearm = null; app.save(); app.render(); } })),
            h('td', null, h('input', { type: 'radio', name: 'offhand', id: 'off-none', checked: c.offhand == null, 'aria-label': 'Nothing in the off hand', onchange: () => { c.offhand = null; app.save(); app.render(); } })),
            h('td', { colspan: 2 }))))),
      h('div', { class: 'row' },
        select('add-weapon', '', [['', 'Add a weapon…']].concat(opts(D.WEAPONS)), (v) => {
          if (!v) return;
          const w = Items.makeWeapon(v, 'standard');
          c.weapons.push(w);
          if (c.wield == null) c.wield = w.id;
          app.save(); app.render();
        }, { 'aria-label': 'Add a weapon' })));
  }

  function inventoryEditor(app, c) {
    const items = c.inventory.items;
    const equip = (it) => {
      c.inventory.items = items.filter((x) => x !== it);
      if (it.kind === 'armor') { if (c.armor) c.inventory.items.push(c.armor); c.armor = it; }
      else if (it.kind === 'shield') { if (c.shield) c.inventory.items.push(c.shield); c.shield = it; }
      else if (it.kind === 'weapon') { c.weapons.push(it); }
      app.save(); app.render();
    };
    return h('div', { class: 'stack tight' },
      h('div', { class: 'row' },
        h('label', { class: 'inline', for: 'inv-band' }, h('span', { class: 'label' }, 'Bandages'), num('inv-band', c.inventory.bandages, (v) => { c.inventory.bandages = Math.max(0, Math.round(v)); app.save(); app.render(); }, { min: 0 })),
        h('label', { class: 'inline', for: 'inv-gold' }, h('span', { class: 'label' }, 'Gold'), num('inv-gold', c.inventory.gold, (v) => { c.inventory.gold = Math.max(0, Math.round(v)); app.save(); app.render(); }, { min: 0 })),
        h('label', { class: 'inline', for: 'inv-arrows' }, h('span', { class: 'label' }, 'Broadheads'), num('inv-arrows', c.inventory.arrows || 0, (v) => { c.inventory.arrows = Math.max(0, Math.round(v)); app.save(); app.render(); }, { min: 0 })),
        h('label', { class: 'inline', for: 'inv-bodkins' }, h('span', { class: 'label' }, 'Bodkins'), num('inv-bodkins', c.inventory.bodkins || 0, (v) => { c.inventory.bodkins = Math.max(0, Math.round(v)); app.save(); app.render(); }, { min: 0 }))),
      items.length ? h('div', { class: 'stack tight' }, h('span', { class: 'label' }, 'Pack'),
        items.map((it) => h('div', { class: 'row spread small' },
          h('span', null, Items.itemName(it), it.durability != null ? h('span', { class: 'muted num' }, ` · dur ${it.durability}`) : null, ' ', h('span', { class: 'chip' }, Items.itemRarity(it))),
          h('span', { class: 'row' },
            h('button', { class: 'small', onclick: () => equip(it) }, it.kind === 'weapon' ? 'Carry' : 'Equip'),
            UI.confirmButton('Drop', 'Drop it?', () => { c.inventory.items = c.inventory.items.filter((x) => x !== it); app.save(); app.render(); }))))) : h('p', { class: 'small muted' }, 'Pack is empty. Loot from battles lands here.'));
  }

  function attacksTable(c) {
    const atks = C.attackOptions(c);
    const fmt = (v) => v.join('/');
    const others = ['block', 'parry', 'offParry', 'dodge', 'trip', 'disarm', 'grapple', 'standUp', 'drawSidearm', 'pickUp', 'bandage', 'escape'];
    return h('div', { class: 'grid-2' },
      h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Attack'), h('th', { class: 'n' }, 'AP'), h('th', { class: 'n' }, 'Stam.'), h('th', { class: 'n' }, 'Damage'), h('th', { class: 'n' }, 'Range'))),
        h('tbody', null, atks.map((o) => h('tr', null,
          h('td', null, o.label, o.windUp ? h('span', { class: 'chip warn', style: { marginLeft: '6px' }, title: 'Wind up the round before; you cannot block or parry while wound up' }, 'wind-up') : null),
          h('td', { class: 'n' }, o.windUp ? `${C.actionCost(c, 'windUp', { option: o }).ap} + ${o.ap}` : o.ap),
          h('td', { class: 'n' }, o.spell ? `${o.spCost} SP` : o.windUp ? `${C.actionCost(c, 'windUp', { option: o }).stamina} + ${o.stamina}` : o.stamina),
          h('td', { class: 'n' }, o.spell ? `${o.spell.magnitude} ${o.spell.element}` : fmt(o.damage)),
          h('td', { class: 'n' }, rangeText(o))))))),
      h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Action'), h('th', { class: 'n' }, 'AP'), h('th', { class: 'n' }, 'Stam.'))),
        h('tbody', null,
          h('tr', null, h('td', null, 'Move'), h('td', { class: 'n' }, 1), h('td', { class: 'n' }, C.actionCost(c, 'move', { ap: 1 }).stamina)),
          others.map((k) => { const cost = C.actionCost(c, k); return h('tr', null, h('td', null, D.ACTIONS[k].name), h('td', { class: 'n' }, cost.ap), h('td', { class: 'n' }, cost.stamina)); })))));
  }

  function rangeText(o) {
    const r = o.minRange === o.maxRange ? String(o.maxRange) : `${o.minRange}–${o.maxRange}`;
    return r + (o.closePenalty ? (G.CONFIG.range.closeRule === 'blunt' ? ' (½ blunt at 1)' : ' (½ at 1)') : '');
  }

  function magicEditor(app, c) {
    const M = G.Magic;
    const words = G.CONFIG.magic.words;
    const nouns = Object.keys(words).filter((k) => words[k].kind === 'noun');
    const max = M.maxSP(c);
    return h('div', { class: 'stack tight' },
      h('div', { class: 'row' },
        h('span', { class: 'label' }, 'Spell points'),
        h('span', { class: 'num' }, max ? `${M.availableSP(c)} usable · ${Math.max(0, max - (c.spSpent || 0))} / ${max} left` : '— (take Casting to gain a pool)'),
        c.spSpent ? h('button', { class: 'small', onclick: () => { c.spSpent = 0; app.save(); app.render(); } }, 'Restore') : null),
      h('div', { class: 'row' }, h('span', { class: 'label' }, 'Nouns known'),
        nouns.map((n) => h('label', { class: 'inline small', for: 'noun-' + n },
          h('input', { id: 'noun-' + n, type: 'checkbox', checked: c.nouns.includes(n), onchange: (e) => { c.nouns = e.target.checked ? c.nouns.concat(n) : c.nouns.filter((x) => x !== n); app.save(); app.render(); } }),
          words[n].name))),
      h('p', { class: 'small muted' }, 'Verbs and modifiers come from Magic feats; nouns are found in the world. Spells and their costs appear under Actions and costs. Placeholder rules — see the Rules tab.'));
  }

  function featsSection(app, c) {
    const open = app.ui.openTrees || (app.ui.openTrees = {});
    const budget = C.featBudget(c);
    const used = C.featCount(c);
    return h('div', { class: 'stack' },
      h('div', { class: 'row spread' },
        h('div', { class: 'row' },
          h('span', { class: 'num', style: { fontSize: '1.2rem' } }, `${used} / ${budget}`), h('span', { class: 'muted' }, 'feats taken'),
          used > budget ? h('span', { class: 'chip bad' }, 'Over budget') : null),
        h('span', { class: 'small muted' }, 'Tier in a tree = feats taken in it: apprentice 2, adept 4, expert 6, master 8. ', h('span', { class: 'chip manual' }, 'table ruling'), ' = not yet automated in battle.')),
      D.TREES.map((t) => {
        const feats = Object.values(D.FEATS).filter((f) => f.tree === t.id);
        const count = C.treeCount(c, t.id);
        return h('details', { class: 'feat-tree', open: !!open[t.id], ontoggle: (e) => (open[t.id] = e.target.open) },
          h('summary', null, h('span', null, t.name, ' ', h('span', { class: 'muted small' }, `(${t.attrs})`)),
            h('span', { class: 'small ' + (count ? '' : 'muted') }, count ? `${count} · ${C.tierName(count)}` : '—')),
          h('div', { class: 'feat-list' }, feats.map((f) => {
            const r = C.rank(c, f.id);
            const can = C.canTakeFeat(c, f.id);
            const rem = C.canRemoveFeat(c, f.id);
            return h('div', { class: 'feat' + (r ? ' has' : '') },
              h('div', { class: 'stack tight' },
                h('div', null, h('span', { class: 'fname' }, f.name),
                  f.ranks.length > 1 ? h('span', { class: 'pips', 'aria-label': `rank ${r} of ${f.ranks.length}` }, f.ranks.map((_, i) => h('i', { class: i < r ? 'on' : '' }))) : null,
                  ' ', h('span', { class: 'small muted' }, f.ranks.length > 1 ? f.ranks.join(' / ') : f.ranks[0]),
                  f.auto ? null : h('span', { class: 'chip manual', style: { marginLeft: '6px' } }, 'table ruling')),
                h('div', { class: 'small' }, f.effect),
                f.requires.length ? h('div', { class: 'why' }, 'Requires ' + f.requires.map((g) => C.reqText(g)).join(', ')) : null,
                !can.ok && r < f.ranks.length ? h('div', { class: 'why' }, can.reason) : null),
              h('div', { class: 'row', style: { gap: '4px' } },
                h('button', { class: 'small', disabled: !rem.ok, title: rem.ok ? 'Remove a rank' : rem.reason, 'aria-label': 'Remove ' + f.name, onclick: () => { C.removeFeat(c, f.id); app.save(); app.render(); } }, '−'),
                h('button', { class: 'small', disabled: !can.ok, title: can.ok ? 'Take' : can.reason, 'aria-label': 'Take ' + f.name, onclick: () => { C.addFeat(c, f.id); app.save(); app.render(); } }, '+')));
          })));
      }));
  }

  function view(app) {
    const s = app.state;
    const c = s.characters[s.selected] || s.characters[s.order[0]];
    if (!c) return h('div', { class: 'panel' }, h('p', null, 'No characters yet.'), h('button', { class: 'primary', onclick: () => { const n = C.newCharacter(); app.addCharacter(n); app.go('sheet', n.id); } }, 'New character'));
    s.selected = c.id;
    return h('div', { class: 'stack', style: { gap: '20px' } },
      h('div', { class: 'view-head' },
        h('div', { class: 'stack tight', style: { flex: '1 1 320px', minWidth: 0 } },
          h('label', { class: 'label', for: 'pick-char' }, 'Character sheet'),
          h('div', { class: 'row' },
            h('input', { id: 'char-name', value: c.name, 'aria-label': 'Name', style: { fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, flex: '1 1 260px', minWidth: 0 }, onchange: (e) => { c.name = e.target.value || 'Unnamed'; app.save(); app.render(); } }))),
        h('div', { class: 'row' },
          select('pick-char', c.id, s.order.map((id) => [id, (s.characters[id].side === 'party' ? '' : '⚑ ') + s.characters[id].name]), (v) => app.go('sheet', v), { 'aria-label': 'Switch character' }))),
      h('div', { class: 'row' },
        h('label', { class: 'inline', for: 'side' }, h('span', { class: 'label' }, 'Side'), select('side', c.side, [['party', 'Party'], ['enemy', 'Enemy']], (v) => { c.side = v; app.save(); app.render(); })),
        h('label', { class: 'inline', for: 'level' }, h('span', { class: 'label' }, 'Level'), num('level', c.level, (v) => { c.level = Math.max(1, Math.round(v)); app.save(); app.render(); }, { min: 1 })),
        h('label', { class: 'inline', for: 'bonus' }, h('span', { class: 'label' }, 'Bonus feats'), num('bonus', c.bonusFeats, (v) => { c.bonusFeats = Math.max(0, Math.round(v)); app.save(); app.render(); }, { min: 0, title: 'Feats from training, quests or items' })),
        h('label', { class: 'inline', for: 'control' }, h('span', { class: 'label' }, 'Dice'), select('control', c.control, [['manual', 'Player enters rolls'], ['auto', 'Roll automatically (and AI in battle)']], (v) => { c.control = v; app.save(); app.render(); }))),
      h('div', { class: 'grid-2' },
        h('section', { class: 'panel' }, h('h2', null, 'Attributes'), attrTable(app, c), staminaRow(app, c)),
        h('section', { class: 'panel' }, h('h2', null, 'Derived'), derived(c),
          h('p', { class: 'small muted' }, 'Con is effectively your hit points: CON 0 is death, stamina 0 is unconsciousness. Every lost point of CON also costs 4 max stamina.'))),
      h('section', { class: 'panel' }, h('h2', null, 'Gear'), armorEditor(app, c), shieldEditor(app, c), weaponsEditor(app, c)),
      h('div', { class: 'grid-2' },
        h('section', { class: 'panel' }, h('h2', null, 'Pack'), inventoryEditor(app, c)),
        h('section', { class: 'panel' }, h('h2', null, 'Notes'), h('textarea', { id: 'notes', value: c.notes || '', 'aria-label': 'Notes', onchange: (e) => { c.notes = e.target.value; app.save(); } }))),
      h('section', { class: 'panel' }, h('h2', null, 'Actions and costs'), attacksTable(c)),
      h('section', { class: 'panel' }, h('h2', null, 'Magic'), magicEditor(app, c)),
      h('section', { class: 'panel' }, h('h2', null, 'Feats'), featsSection(app, c)));
  }

  UI.Views.sheet = view;
})(globalThis.BBB);
