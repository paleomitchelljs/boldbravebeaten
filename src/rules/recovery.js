/*
 * Recovery (Mechanics Outline + Specifics):
 *   - A long rest restores stamina fully and partly repairs armor and shields.
 *   - Daily heal roll (d6): 1 = −1 CON, 2 = no change, 3–6 = +1 (one point total).
 *   - Tending: reroll 1s, +1 per Wound Tending rank. Town rest: two rolls a day.
 */
(function (G) {
  'use strict';
  const CONFIG = G.CONFIG;
  const C = G.Character;
  const Items = G.Items;

  // Which damaged attribute heals first: CON, then the most damaged.
  function healTarget(c) {
    if (c.damage.CON > 0) return 'CON';
    let best = null;
    for (const a of CONFIG.attributes) if (c.damage[a] > 0 && (!best || c.damage[a] > c.damage[best])) best = a;
    return best;
  }

  async function longRest(c, opts, roller) {
    opts = opts || {};
    const tender = opts.tender || null; // a character (may be c), or null
    const lines = [];
    if (c.status.dead) return [`${c.name} is dead.`];

    // Untreated bleeding runs its course; tending stops it.
    if (c.bleeds.length) {
      if (tender) {
        lines.push(`${tender.name} stops ${c.name}'s bleeding.`);
      } else {
        let total = 0;
        for (const b of c.bleeds) total += b.remaining;
        C.damageAttr(c, 'CON', total);
        lines.push(`Untended wounds bleed ${total} CON.`);
      }
      c.bleeds = [];
    }

    if (C.attr(c, 'CON') <= 0) {
      c.status.dead = true;
      lines.push(`${c.name} dies of their wounds.`);
      return lines;
    }

    const tendRank = tender ? C.rank(tender, 'wound_tending') : 0;
    const surgeon = tender && C.rank(tender, 'surgeon');
    const physician = tender && C.rank(tender, 'physician');
    const rolls = opts.town || physician ? 2 : 1;
    for (let i = 0; i < rolls; i++) {
      if (C.totalDamage(c) === 0) break;
      let r = (await roller({ actorId: c.id, sides: CONFIG.healDie, count: 1, label: `${c.name}: daily heal roll`, detail: tender ? `d6 (tended: 1s reroll, +${tendRank})` : 'd6: 1 worsen, 2 nothing, 3–6 heal' }))[0];
      if (tender && r === 1) {
        r = (await roller({ actorId: c.id, sides: CONFIG.healDie, count: 1, label: `${c.name}: reroll 1 (tended)`, detail: 'd6' }))[0];
      }
      if (r !== 1) r += tendRank;
      if (r === 1 && !surgeon) {
        C.damageAttr(c, 'CON', 1);
        lines.push(`Heal roll 1: the wounds worsen (−1 CON).`);
      } else if (r <= 2) {
        lines.push(`Heal roll ${r}: no change.`);
      } else {
        const a = healTarget(c);
        C.healAttr(c, a, 1);
        lines.push(`Heal roll ${r}: +1 ${a}.`);
      }
      if (surgeon && C.totalDamage(c) > 0) {
        let worst = null;
        for (const a of CONFIG.attributes) if (c.damage[a] > 0 && (!worst || c.damage[a] > c.damage[worst])) worst = a;
        C.healAttr(c, worst, 1);
        lines.push(`Surgeon: +1 ${worst}.`);
      }
    }

    if (C.attr(c, 'CON') <= 0) {
      c.status.dead = true;
      lines.push(`${c.name} dies of their wounds.`);
      return lines;
    }

    // Gear that heals (a bloodstone breastplate: effects.heal): more points back each night.
    for (let i = 0; i < C.gearSum(c, 'heal'); i++) {
      const a = healTarget(c);
      if (!a) break;
      C.healAttr(c, a, 1);
      lines.push(`Healing gear: +1 ${a}.`);
    }
    // Items' powers come back with the night.
    if (G.Magic && G.Magic.rechargeAll) G.Magic.rechargeAll(c);
    c.weary = 0; // a night's sleep clears the weariness of the day's fights
    c.stamina = C.maxStamina(c);
    c.spSpent = 0;
    c.status = C.freshStatus();

    const repairer = [c, tender].some((x) => x && C.rank(x, 'field_repair'));
    lines.push(...mendGear(c, CONFIG.restRepairFraction * (repairer || opts.town ? 2 : 1)));
    lines.push(`Stamina restored to ${c.stamina}.`);
    return lines;
  }

  // Field repairs: armor, shield and weapons each get `frac` of their durability back. A broken
  // shield or weapon needs a smith.
  function mendGear(c, frac) {
    const lines = [];
    const mend = (item, max, label, broken) => {
      const before = item.durability == null ? max : item.durability;
      if (broken) { lines.push(`${label} is broken beyond field repair.`); return; }
      item.durability = Math.min(max, before + Math.ceil(max * frac));
      if (item.durability > before) lines.push(`${label} repaired ${before} → ${item.durability}/${max}.`);
    };
    for (const p of C.armorPieces(c)) mend(p, Items.armorMaxDurability(p), C.armorPieces(c).length > 1 ? Items.itemName(p) : 'Armor', false);
    if (c.shield) mend(c.shield, Items.shieldStats(c.shield).maxDurability, 'Shield', c.shield.durability <= 0);
    for (const w of c.weapons) {
      const max = Items.weaponMaxDurability(w);
      if (max && Items.weaponDurability(w) < max) mend(w, max, Items.itemName(w), Items.weaponBroken(w));
    }
    return lines;
  }

  G.Recovery = { longRest, mendGear, healTarget };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
