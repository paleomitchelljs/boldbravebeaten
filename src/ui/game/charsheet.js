/*
 * The character sheet pop-up: a portrait, the gear in dropdowns, the numbers in small tiles, and an (i) for anything
 * that needs explaining. Opened by clicking a party member or a token on the map. Foes get the same sheet, read-only.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, bar, toast, ibtn, icon, tip } = UI;
  const C = G.Character;
  const World = G.World;
  const Items = G.Items;
  const Equip = G.Equip;
  const D = G.DATA;

  UI.Overlays = UI.Overlays || {};

  // Held slots, then the worn slots in data/rules.yaml (game.wornSlots).
  const slotOrder = () => ['main', 'side', 'off', 'shield', 'body'].concat(Equip.wornSlots().map((w) => w.id));
  const slotName = (slot) => (Equip.slotList().find((x) => x[0] === slot) || [slot, slot])[1];
  const ATTR_NAME = { STR: 'Strength', CON: 'Constitution', DEX: 'Dexterity', SPD: 'Speed', INT: 'Intellect', WIL: 'Will', WIS: 'Wisdom', CHA: 'Charisma' };
  const ATTR_INFO = {
    STR: 'Force: damage, grappling, carrying heavy gear.', CON: 'Toughness: your wounds. At 0 you are dead.', DEX: 'Aim, parrying, locks and traps.',
    SPD: 'Initiative, AP, movement, stealth.', INT: 'Magic, lore, deception.', WIL: 'Resolve: stamina regeneration and resisting magic.',
    WIS: 'Perception and reading people.', CHA: 'Charm, appeal and bargaining.',
  };

  const itemName = (it) => (it ? (it.kind === 'weapon' || it.kind === 'armor' || it.kind === 'shield' ? Items.itemName(it) : it.name) : '');

  // The dropdown for one slot: what is worn, what the pack could put there, and "empty".
  function slotRow(game, o, c, slot, editable) {
    const w = game.world;
    const cur = Equip.itemIn(c, slot);
    const label = slotName(slot);
    const opts = [h('option', { value: 'keep', selected: true }, cur ? itemName(cur) : '— empty —')];
    if (editable) {
      if (cur) opts.push(h('option', { value: 'none' }, '↧ Take off'));
      if (Equip.isWorn(slot)) {
        for (const [id, n] of Object.entries(w.pack.goods)) {
          const g = World.goodDef(id);
          if (g && g.kind === 'trinket' && Equip.wornFor(g.slot).includes(slot)) opts.push(h('option', { value: 't:' + id }, `${g.name}${n > 1 ? ' ×' + n : ''}`));
        }
      }
      // Gear from the pack: weapons, shields, and armor pieces for any location they cover.
      {
        w.pack.gear.forEach((it, i) => {
          if (!Equip.fits(it).includes(slot)) return;
          const chk = Equip.canEquip(c, it, slot);
          opts.push(h('option', { value: 'g:' + i, disabled: !chk.ok }, itemName(it) + (chk.ok ? '' : ` — ${chk.reason}`)));
        });
      }
    }
    const change = (e) => {
      const v = e.target.value;
      if (v === 'keep') return;
      let r = { ok: true };
      if (v === 'none') r = Equip.unequip(w, c, slot);
      else if (v.startsWith('t:')) r = Equip.equipTrinket(w, c, v.slice(2), slot);
      else r = Equip.equip(w, c, w.pack.gear[Number(v.slice(2))], slot);
      if (r && r.ok === false) toast(r.reason);
      for (const l of (r && r.lines) || []) toast(l);
      game.save(); game.openOverlay('sheet', o); game.render();
    };
    if (!cur && opts.length < 2) return null;
    const detail = cur && cur.kind ? Equip.describe(cur) : cur ? cur.blurb : '';
    return h('div', { class: 'gear-row' + (cur ? ' filled' : '') },
      h('span', { class: 'label' }, label),
      editable && opts.length > 1 ? h('select', { 'aria-label': label, onchange: change }, opts) : h('span', { class: 'gear-name' }, cur ? itemName(cur) : '—'),
      detail ? tip(detail, itemName(cur)) : h('span', { class: 'tip-gap' }));
  }

  function gearTab(game, o, c, editable) {
    const shown = slotOrder().filter((s) => s !== 'off' || (c.weapons.some((x) => D.WEAPONS[x.type] && D.WEAPONS[x.type].offhand) || Equip.itemIn(c, 'off') || (editable && game.world.pack.gear.some((it) => Equip.fits(it).includes('off')))));
    const nat = (c.natural || []).map((t) => D.WEAPONS[t] && D.WEAPONS[t].name).filter(Boolean);
    const ai = C.armorInfo(c);
    const sh = c.shield ? Items.shieldStats(c.shield) : null;
    const slots = shown.filter((s) => editable || Equip.itemIn(c, s));
    const rows = slots.map((s) => slotRow(game, o, c, s, editable));
    const empty = editable ? slots.filter((s, i) => !rows[i]) : [];
    return h('div', { class: 'stack tight' },
      c.side === 'party' ? null : h('div', { class: 'gear-row filled' }, h('span', { class: 'label' }, 'Wields'), h('span', { class: 'gear-name' }, nat.length ? nat.join(', ') : (C.wieldedWeapon(c) ? Items.itemName(C.wieldedWeapon(c)) : 'Unarmed')), h('span', { class: 'tip-gap' })),
      h('div', { class: 'gear-grid' }, rows.filter(Boolean)),
      empty.length ? h('p', { class: 'small muted' }, `Nothing for: ${[...new Set(empty.map(slotName))].join(', ').toLowerCase()}`) : null,
      h('div', { class: 'chips' },
        c.armor ? h('span', { class: 'chip', title: 'Torso armor: mitigation by damage type once wear is counted. Other locations have their own piece, or none.' }, `Torso P${ai.effMit.P} S${ai.effMit.S} B${ai.effMit.B}`) : h('span', { class: 'chip' }, C.armorPieces(c).length ? 'Torso bare' : 'No armor'),
        c.armor ? h('span', { class: 'chip', title: 'Armor durability' }, `Dur ${ai.durability}/${ai.maxDurability}`) : null,
        ai.pierce ? h('span', { class: 'chip', title: `Points: one with ${ai.pierce.resist}+ punch bursts through; a lighter one must find a gap (d10 + ⌊DEX/4⌋ + feats against ${ai.pierce.gap}) or is turned` }, `Pierce ${ai.pierce.resist}/${ai.pierce.gap}`) : null,
        ai.spd || ai.dex ? h('span', { class: 'chip warn', title: 'Armor slows and stiffens you' }, `SPD −${ai.spd} · DEX −${ai.dex}`) : null,
        sh ? h('span', { class: 'chip', title: `Shield: a block costs ${C.fmtAP(C.actionCost(c, 'block').ap)} AP and holds blows up to ${sh.threshold}; durability ${c.shield.durability}/${sh.maxDurability}` }, `Shield ${C.fmtAP(C.actionCost(c, 'block').ap)} AP · ${sh.threshold}`) : null),
      editable ? h('div', { class: 'row small muted' }, 'Gear comes from the pack.', tip('Swapping is for town, camp and the quiet before a fight. Pick from a slot\'s list to put something on; "Take off" sends it to the pack.')) : null);
  }

  function statsTab(c) {
    const max = C.maxStamina(c);
    const tile = (a) => {
      const now = C.attr(c, a), cap = C.attrMax(c, a);
      const parts = [`Base ${c.base[a]}`, C.conditioning(c, a) ? `feats +${C.conditioning(c, a)}` : null, c.damage[a] ? `damage −${c.damage[a]}` : null].filter(Boolean).join(', ');
      return h('div', { class: 'tile' + (c.damage[a] ? ' hurt' : ''), title: `${ATTR_NAME[a]}. ${ATTR_INFO[a]} ${parts}` },
        h('span', { class: 'label' }, a), h('b', { class: 'num' }, now), now < cap ? h('span', { class: 'small muted num' }, `/${cap}`) : null);
    };
    const derived = [['AP', C.fmtAP(C.apPool(c)), 'Action points each round.'], ['Move', G.CONFIG.moveAP ? `${C.squaresPerAP(c)} sq` : `${C.squaresPerAP(c)} sq/AP`, G.CONFIG.moveAP ? `Squares one move covers, for ${C.fmtAP(C.moveCost(c, 1))} AP.` : 'Squares moved per AP.'], ['Init', 'd10+' + C.combatAttr(c, 'SPD'), 'Initiative roll.'],
      ['Regen', (C.regen(c) >= 0 ? '+' : '') + C.regen(c), 'Stamina regained each round.'], ['Dmg', (C.strBonus(c) >= 0 ? '+' : '') + C.strBonus(c), 'Strength damage bonus.']];
    return h('div', { class: 'stack' },
      h('div', { class: 'tiles' }, G.CONFIG.attributes.map(tile)),
      h('div', { class: 'tiles small' }, derived.map(([k, v, t]) => h('div', { class: 'tile', title: t }, h('span', { class: 'label' }, k), h('b', { class: 'num' }, v)))),
      h('div', { class: 'row small' }, h('span', { class: 'muted' }, 'Bleeding'), h('span', null, c.bleeds.length ? `${C.bleedPerRound(c).toFixed(1)}/round` : 'none'), tip('CON is your life: at 0 you are dead. Stamina is how long you can keep fighting: at 0 you are unconscious. Armor decides how much of the first you keep.')));
  }

  function featsTab(game, c) {
    const owned = Object.keys(c.feats).filter((id) => D.FEATS[id]);
    const left = C.featBudget(c) - C.featCount(c);
    const inTown = game.world.place && G.Content.world.places[game.world.place].kind === 'town';
    return h('div', { class: 'stack tight' },
      h('div', { class: 'row spread small' }, h('span', null, `${C.featCount(c)} of ${C.featBudget(c)} feats`), left > 0 && c.side === 'party' ? h('span', { class: 'chip ok' }, `${left} to spend${inTown ? ' at the Training Yard' : ' in town'}`) : null),
      c.side === 'party' ? h('div', { class: 'small muted' }, `Level ${c.level} · ${c.xp || 0} XP · next at ${World.xpFor(c.level + 1)}`) : null,
      owned.length ? h('div', { class: 'chips' }, owned.map((id) => { const f = D.FEATS[id]; return h('span', { class: 'chip feat' }, f.name + (f.ranks.length > 1 ? ' ' + C.roman(c.feats[id]) : ''), tip(f.effect + (f.auto === false ? ' (No effect in the game yet.)' : ''), f.name)); })) : h('p', { class: 'muted small' }, 'No feats.'),
      (c.nouns || []).length ? h('div', { class: 'small' }, h('b', null, 'Words known: '), c.nouns.join(', ')) : null);
  }

  function skillsTab(c) {
    const defs = G.Skills.defs();
    return h('div', { class: 'stack tight' },
      h('div', { class: 'chips' }, Object.entries(defs).map(([id, s]) => h('span', { class: 'chip skill' }, s.name, ' ', h('b', { class: 'num' }, (G.Skills.mod(c, id) >= 0 ? '+' : '') + G.Skills.mod(c, id)), tip(s.blurb, s.name)))),
      h('div', { class: 'row small muted' }, 'd10 + this against a target', tip('Easy 6, moderate 8, hard 11, formidable 14.')));
  }

  UI.Overlays.sheet = function (game, o) {
    const w = game.world;
    const members = World.party(w);
    const foe = w.battle && w.battle.foes[o.id];
    const c = w.chars[o.id] || foe || members[0];
    o.id = c.id;
    const mine = !foe && c.side === 'party';
    const tab = o.tab || 'gear';
    const close = () => game.closeOverlay();
    const editable = mine && !w.battle;
    const max = C.maxStamina(c);
    const tabBtn = (id, label) => h('button', { class: `tab ${tab === id ? 'active' : ''}`, onclick: () => { o.tab = id; game.openOverlay('sheet', o); } }, label);
    const L = UI.Sprites.look(c);
    const enc = w.battle && w.battle.enc;
    const apLine = enc && enc.ap && enc.ap[c.id] != null && (mine || enc.phase !== 'declare') ? `${C.fmtAP(enc.ap[c.id])} AP left` : null;
    const body = tab === 'gear' ? gearTab(game, o, c, editable) : tab === 'stats' ? statsTab(c) : tab === 'feats' ? featsTab(game, c) : tab === 'skills' ? skillsTab(c)
      : h('textarea', { 'aria-label': 'Notes', value: c.notes || '', placeholder: 'Notes about this character', onchange: (e) => { c.notes = e.target.value; game.save(); } });
    const tabs = mine ? ['gear', 'Gear', 'stats', 'Stats', 'feats', 'Feats', 'skills', 'Skills', 'notes', 'Notes'] : ['gear', 'Gear', 'stats', 'Stats', 'feats', 'Feats'];
    const tabList = []; for (let i = 0; i < tabs.length; i += 2) tabList.push(tabBtn(tabs[i], tabs[i + 1]));
    return h('div', { class: 'modal game-modal sheet-pop', role: 'dialog', 'aria-modal': 'true', 'aria-label': c.name, onclick: (e) => e.stopPropagation() },
      h('div', { class: 'sheet-top' },
        mine ? h('div', { class: 'switcher' }, members.map((m) => h('button', { class: `sw ${m.id === c.id ? 'selected' : ''} ${m.status.dead ? 'down' : ''}`, title: m.name, onclick: () => { o.id = m.id; game.openOverlay('sheet', o); } }, UI.Art.portrait(m, 30)))) : h('span'),
        ibtn('close', 'Close', close, { size: 14 })),
      h('div', { class: 'sheet-head' },
        h('div', { class: 'alcove' }, UI.Sprites.figure(c, 5), L.tint ? null : null),
        h('div', { class: 'stack tight grow' },
          h('span', { class: 'label' }, `${mine ? 'Party' : 'Foe'} · level ${c.level}${c.faction && !mine ? ' · ' + c.faction : ''}`),
          h('h2', null, c.name),
          h('div', { class: 'row small' }, h('span', { class: 'num', title: c.weary ? `Wearied: ${C.freshStamina(c)} after a long rest` : null }, `Stamina ${c.stamina}/${max}${c.weary ? ` (−${c.weary} weary)` : ''}`), apLine ? h('span', { class: 'num muted' }, apLine) : null, h('span', { class: 'num' }, `CON ${C.attr(c, 'CON')}/${C.attrMax(c, 'CON')}`)),
          bar(c.stamina, max),
          UI.Cards.statusChips(c).length ? h('div', { class: 'chips' }, UI.Cards.statusChips(c)) : null,
          foe && foe.monster && G.Enemies.MONSTERS[foe.monster] && G.Enemies.MONSTERS[foe.monster].blurb ? h('p', { class: 'small muted' }, G.Enemies.MONSTERS[foe.monster].blurb) : null)),
      h('div', { class: 'tabs' }, tabList),
      h('div', { class: 'sheet-body' }, body));
  };
})(globalThis.BBB);
