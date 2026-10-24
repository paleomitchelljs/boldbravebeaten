/*
 * Equipment slots. Main hand, sidearm, off hand (a parrying dagger), shield, torso, and the worn slots in
 * data/rules.yaml game.wornSlots (head, neck, shoulders, cape, waist, two ears, arms, hands, two rings, legs,
 * boots: the user's list). Worn things are goods of kind 'trinket' whose `slot` names a slot id or a slot's `takes`
 * (both ring slots take 'ring', both ear slots 'ear'). What isn't worn lives in the party pack (world.pack.gear for weapons, armor
 * and shields; goods for worn things), so gear is shared and swapped freely in town and camp. The engine
 * reads c.armor (the piece over the torso), c.pieces (other armor), c.shield, c.weapons / c.wield / c.sidearm /
 * c.offhand and c.trinkets (each worn thing with `at`, the slot it is in), so nothing else needs to know the
 * slots exist.
 *
 * Armor (CONFIG.locations): the six locations are slots too: the torso, and the head, arms, hands, legs and
 * feet slots, which a worn thing may take instead (a crown or a helm, not both). A piece takes every slot it
 * covers (a hauberk the torso and arms); putting it on takes off whatever was there.
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const Items = G.Items;
  const W = () => G.DATA.WEAPONS;

  const HELD = [['main', 'Main hand'], ['off', 'Off hand'], ['side', 'Sidearm'], ['shield', 'Shield'], ['body', 'Torso']];
  // A location's slot: the torso is the 'body' slot (its old name); the others share the worn slots' ids.
  const LOCS = () => (G.CONFIG.locations ? G.CONFIG.locations.order : ['torso']);
  const slotOfLoc = (loc) => (loc === 'torso' ? 'body' : loc);
  const locOfSlot = (slot) => (slot === 'body' ? 'torso' : LOCS().includes(slot) ? slot : null);
  const DEFAULT_WORN = [{ id: 'head', name: 'Head' }, { id: 'neck', name: 'Neck' }, { id: 'ring1', name: 'Ring', takes: 'ring' }, { id: 'ring2', name: 'Ring', takes: 'ring' }];
  function wornSlots() {
    const g = G.CONFIG.game || {};
    return g.wornSlots && g.wornSlots.length ? g.wornSlots : DEFAULT_WORN;
  }
  const isWorn = (slot) => wornSlots().some((w) => w.id === slot);
  // [[id, label]] for every slot, held then worn.
  function slotList() {
    return HELD.concat(wornSlots().map((w) => [w.id, w.name]));
  }
  // Which worn slots a good's slot type fits (a ring fits either ring slot).
  function wornFor(type) {
    return wornSlots().filter((w) => w.id === type || w.takes === type).map((w) => w.id);
  }

  const twoHanded = (w) => !!w && W()[w.type].hands >= 2;

  function itemIn(c, slot) {
    switch (slot) {
      case 'main': return c.weapons.find((w) => w.id === c.wield) || null;
      case 'side': return c.weapons.find((w) => w.id === c.sidearm) || null;
      case 'off': return c.weapons.find((w) => w.id === c.offhand) || null;
      case 'shield': return c.shield || null;
      case 'body': return C.armorAt(c, 'torso');
      default: return (c.trinkets || []).find((t) => t.at === slot) || (locOfSlot(slot) ? C.armorAt(c, locOfSlot(slot)) : null);
    }
  }

  function slotsOf(c) {
    return slotList().map(([slot, label]) => ({ slot, label, item: itemIn(c, slot) }));
  }

  // Slots an item could go in.
  function fits(item) {
    if (!item) return [];
    if (item.kind === 'armor') return Items.coversOf(item).map(slotOfLoc);
    if (item.kind === 'shield') return ['shield'];
    if (item.kind === 'weapon') {
      const d = W()[item.type];
      const out = ['main', 'side'];
      if (d.offhand) out.push('off');
      return out;
    }
    return [];
  }

  function canEquip(c, item, slot) {
    if (!fits(item).includes(slot)) return { ok: false, reason: 'Does not go there' };
    if (item.kind === 'shield') {
      const main = itemIn(c, 'main');
      if (twoHanded(main)) return { ok: false, reason: 'Hands full: a two-handed weapon is wielded' };
      if (itemIn(c, 'off')) return { ok: false, reason: 'Hands full: off-hand weapon in use' };
    }
    if (item.kind === 'weapon' && slot === 'off') {
      if (c.shield) return { ok: false, reason: 'Remove the shield first' };
      if (twoHanded(itemIn(c, 'main'))) return { ok: false, reason: 'A two-handed weapon needs both hands' };
    }
    if (item.kind === 'weapon' && slot === 'main' && twoHanded(item) && (c.shield || itemIn(c, 'off'))) {
      return { ok: true, note: 'Shield and off hand will be put away' };
    }
    return { ok: true };
  }

  function stow(world, item) {
    if (item) world.pack.gear.push(item);
  }

  // Take `item` from the pack (or from wherever it is) and put it in the slot, stowing what was there.
  function equip(world, c, item, slot) {
    const chk = canEquip(c, item, slot);
    if (!chk.ok) return { ok: false, reason: chk.reason };
    const lines = [];
    world.pack.gear = world.pack.gear.filter((x) => x.id !== item.id);
    if (item.kind === 'armor') {
      // Everything over the places it covers comes off first: other pieces, and worn things in those slots.
      for (const s of fits(item)) while (itemIn(c, s)) unequip(world, c, s, true);
      if (Items.coversOf(item).includes('torso')) c.armor = item;
      else c.pieces = (c.pieces || []).concat([item]);
      cleanup(c);
      return { ok: true, lines };
    }
    const prev = itemIn(c, slot);
    if (prev) unequip(world, c, slot, true);
    if (item.kind === 'armor') c.armor = item;
    else if (item.kind === 'shield') c.shield = item;
    else if (item.kind === 'weapon') {
      c.weapons.push(item);
      if (slot === 'main') {
        c.wield = item.id;
        if (twoHanded(item)) {
          if (c.shield) { stow(world, c.shield); c.shield = null; lines.push('The shield goes into the pack.'); }
          if (c.offhand) { unequip(world, c, 'off', true); lines.push('The off-hand weapon goes into the pack.'); }
        }
      }
      if (slot === 'side') c.sidearm = item.id;
      if (slot === 'off') c.offhand = item.id;
    }
    cleanup(c);
    return { ok: true, lines };
  }

  // A weapon in c.weapons that is no slot's weapon is carried but not equipped: stow it.
  function cleanup(c) {
    c.weapons = c.weapons.filter((w) => [c.wield, c.sidearm, c.offhand].includes(w.id));
    if (c.stamina > C.maxStamina(c)) c.stamina = C.maxStamina(c);
  }

  function unequip(world, c, slot, quiet) {
    const it = itemIn(c, slot);
    if (!it) return { ok: false };
    if (it.kind === 'armor') {
      if (c.armor === it) c.armor = null;
      c.pieces = (c.pieces || []).filter((p) => p !== it);
      stow(world, it);
    }
    else if (slot === 'shield') { c.shield = null; stow(world, it); }
    else if (slot === 'main') { c.wield = null; stow(world, it); }
    else if (slot === 'side') { c.sidearm = null; stow(world, it); }
    else if (slot === 'off') { c.offhand = null; stow(world, it); }
    else if (isWorn(slot)) {
      c.trinkets = c.trinkets.filter((t) => t !== it);
      if (it.goodId) G.World.addGood(world, it.goodId, 1);
      if (!quiet && c.stamina > C.maxStamina(c)) c.stamina = C.maxStamina(c);
    }
    if (slot === 'main' || slot === 'side' || slot === 'off') cleanup(c);
    // Keep a sidearm in hand if the main hand was emptied.
    if (slot === 'main' && !c.wield && c.sidearm) { c.wield = c.sidearm; c.sidearm = null; }
    if (!quiet) C.updateCondition(c);
    return { ok: true };
  }

  // Wear a good from the pack. `slot`: which slot (for a ring, which hand); otherwise the first free one that fits.
  function equipTrinket(world, c, goodId, slot) {
    const g = G.World.goodDef(goodId);
    if (!g || g.kind !== 'trinket') return { ok: false, reason: 'Not wearable' };
    const fitsIn = wornFor(g.slot);
    if (!fitsIn.length) return { ok: false, reason: `No ${g.slot} slot` };
    if (slot && !fitsIn.includes(slot)) return { ok: false, reason: 'Does not go there' };
    const at = slot || fitsIn.find((s) => !itemIn(c, s)) || fitsIn[0];
    if (!G.World.removeGood(world, goodId, 1)) return { ok: false, reason: 'None in the pack' };
    c.trinkets = c.trinkets || [];
    if (itemIn(c, at)) unequip(world, c, at, true);
    c.trinkets.push(wornItem(goodId, g, at));
    return { ok: true };
  }

  // The worn copy of a good: its effects and power travel with it (a save keeps them as worn).
  function wornItem(goodId, g, at) {
    const t = { id: Items.uid('trk'), goodId, name: g.name, slot: g.slot, at, attrs: g.attrs || {}, ap: g.ap || 0 };
    if (g.effects) t.effects = JSON.parse(JSON.stringify(g.effects));
    if (g.power) t.power = Object.assign({}, g.power);
    if (g.blurb) t.blurb = g.blurb;
    return t;
  }

  // One-line summary of an item for the pack and shop lists.
  function describe(item) {
    if (!item) return '';
    const D = G.DATA;
    if (item.kind === 'armor') {
      const b = Items.armorBase(item);
      const L = G.CONFIG.locations;
      const where = L && b.covers.length < L.order.length ? `${L.order.filter((l) => b.covers.includes(l)).map((l) => L.names[l] || l).join(', ')} · ` : '';
      return where + `P${b.mit.P} S${b.mit.S} B${b.mit.B}` + (b.pierce ? ` · points burst at ${b.pierce.resist}, gap ${b.pierce.gap}` : '') + (b.spd || b.dex ? ` · SPD−${b.spd} DEX−${b.dex}` : '') + (b.weight ? ` · ${b.weight} kg` : '') + ` · dur ${item.durability}/${b.maxDurability}`;
    }
    if (item.kind === 'shield') {
      const s = Items.shieldStats(item);
      return `block ${s.blockAP} AP · holds ${s.threshold} · dur ${item.durability}/${s.maxDurability}`;
    }
    if (item.kind === 'weapon') {
      const d = D.WEAPONS[item.type];
      const st = Items.weaponStats(item);
      const faces = Object.entries(st.faces).map(([f, v]) => `${f} ${v.join('/')}`).join(' · ');
      const punch = Object.entries(st.punch || {}).map(([f, x]) => `${f === 'point' || f === 'arrow' ? '' : f + ' '}punch ${x}`).join(' · ');
      const kg = Items.weaponMass(item);
      const mass = kg ? ` · ${kg} kg` : '';
      const max = Items.weaponMaxDurability(item);
      const dur = max ? ` · ${Items.weaponBroken(item) ? 'BROKEN' : `dur ${Items.weaponDurability(item)}/${max}`}` : '';
      return `${d.hands >= 2 ? 'two-handed' : d.hands > 1 ? 'versatile' : 'one-handed'} · ${d.reachName || ''} · ${faces}${punch ? ' · ' + punch : ''}${mass}${dur}`;
    }
    return '';
  }

  G.Equip = { slotList, wornSlots, wornFor, isWorn, wornItem, slotsOf, itemIn, fits, canEquip, equip, unequip, equipTrinket, describe, twoHanded, slotOfLoc, locOfSlot };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
