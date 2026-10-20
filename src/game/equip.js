/*
 * Equipment slots. Body (armor), shield, main hand, sidearm, off hand (a parrying dagger) and two
 * trinket slots (ring, charm). What isn't worn lives in the party pack (world.pack.gear for
 * weapons, armor and shields; goods for trinkets), so gear is shared and swapped freely in town
 * and camp. The engine reads c.armor, c.shield, c.weapons / c.wield / c.sidearm / c.offhand and
 * c.trinkets, so nothing else needs to know the slots exist.
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const Items = G.Items;
  const W = () => G.DATA.WEAPONS;

  const SLOTS = [
    ['main', 'Main hand'], ['off', 'Off hand'], ['side', 'Sidearm'],
    ['shield', 'Shield'], ['body', 'Body'], ['ring', 'Ring'], ['charm', 'Charm'],
  ];

  const twoHanded = (w) => !!w && W()[w.type].hands >= 2;

  function itemIn(c, slot) {
    switch (slot) {
      case 'main': return c.weapons.find((w) => w.id === c.wield) || null;
      case 'side': return c.weapons.find((w) => w.id === c.sidearm) || null;
      case 'off': return c.weapons.find((w) => w.id === c.offhand) || null;
      case 'shield': return c.shield || null;
      case 'body': return c.armor || null;
      case 'ring': return (c.trinkets || []).find((t) => t.slot === 'ring') || null;
      case 'charm': return (c.trinkets || []).find((t) => t.slot === 'charm') || null;
      default: return null;
    }
  }

  function slotsOf(c) {
    return SLOTS.map(([slot, label]) => ({ slot, label, item: itemIn(c, slot) }));
  }

  // Slots an item could go in.
  function fits(item) {
    if (!item) return [];
    if (item.kind === 'armor') return ['body'];
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
    if (slot === 'body') { c.armor = null; stow(world, it); }
    else if (slot === 'shield') { c.shield = null; stow(world, it); }
    else if (slot === 'main') { c.wield = null; stow(world, it); }
    else if (slot === 'side') { c.sidearm = null; stow(world, it); }
    else if (slot === 'off') { c.offhand = null; stow(world, it); }
    else if (slot === 'ring' || slot === 'charm') {
      c.trinkets = c.trinkets.filter((t) => t !== it);
      G.World.addGood(world, it.goodId, 1);
    }
    if (slot === 'main' || slot === 'side' || slot === 'off') cleanup(c);
    // Keep a sidearm in hand if the main hand was emptied.
    if (slot === 'main' && !c.wield && c.sidearm) { c.wield = c.sidearm; c.sidearm = null; }
    if (!quiet) C.updateCondition(c);
    return { ok: true };
  }

  function equipTrinket(world, c, goodId) {
    const g = G.World.goodDef(goodId);
    if (!g || g.kind !== 'trinket') return { ok: false, reason: 'Not wearable' };
    if (!G.World.removeGood(world, goodId, 1)) return { ok: false, reason: 'None in the pack' };
    c.trinkets = c.trinkets || [];
    const prev = itemIn(c, g.slot);
    if (prev) unequip(world, c, g.slot, true);
    c.trinkets.push({ id: Items.uid('trk'), goodId, name: g.name, slot: g.slot, attrs: g.attrs || {}, ap: g.ap || 0 });
    return { ok: true };
  }

  // One-line summary of an item for the pack and shop lists.
  function describe(item) {
    if (!item) return '';
    const D = G.DATA;
    if (item.kind === 'armor') {
      const b = Items.armorBase(item);
      return `P${b.mit.P} S${b.mit.S} B${b.mit.B}` + (b.pierce ? ` · points burst at ${b.pierce.resist}, gap ${b.pierce.gap}` : '') + (b.spd || b.dex ? ` · SPD−${b.spd} DEX−${b.dex}` : '') + (b.weight ? ` · ${b.weight} kg` : '') + ` · dur ${item.durability}/${b.maxDurability}`;
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

  G.Equip = { SLOTS, slotsOf, itemIn, fits, canEquip, equip, unequip, equipTrinket, describe, twoHanded };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
