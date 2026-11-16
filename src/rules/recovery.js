/*
 * Recovery (Mechanics Outline + Specifics, on step E's wounds):
 *   - A long rest restores stamina fully and partly repairs armor and shields.
 *   - Daily heal roll (d6) for one wounded: 1 = the worst wound a step worse, 2 = no change, 3–6 = a step better.
 *   - Tending: reroll 1s, +1 per Wound Tending rank. Town rest: two rolls a day. Untended bleeding: each bleeding
 *     wound a step worse before it clots.
 */
(function (G) {
  'use strict';
  const CONFIG = G.CONFIG;
  const C = G.Character;
  const Items = G.Items;

  // The worst wound (the one healing works on), or null.
  function healTarget(c) {
    return C.wounds(c).filter((w) => w.sev > 0).sort((a, b) => b.sev - a.sev)[0] || null;
  }
  const placeOf = (w) => ((CONFIG.locations.names || {})[w.place] || w.place).toLowerCase();

  // A wound a step worse; dies of their wounds once the boxes are full (hero mode: never).
  function worsen(c, w, lines, why) {
    w.sev = Math.min(3, w.sev + 1);
    lines.push(`${why}: the ${placeOf(w)} wound worsens (${w.sev}).`);
    if (C.woundLoad(c) >= C.boxes(c) && !c.hero) {
      c.status.dead = true;
      lines.push(`${c.name} dies of their wounds.`);
      return true;
    }
    return false;
  }

  async function longRest(c, opts, roller) {
    opts = opts || {};
    const tender = opts.tender || null; // a character (may be c), or null
    const lines = [];
    if (c.status.dead) return [`${c.name} is dead.`];

    // Untreated bleeding: each bleeding wound a step worse before it clots; tending stops it.
    if (C.bleeding(c) > 0) {
      if (tender) lines.push(`${tender.name} stops ${c.name}'s bleeding.`);
      else for (const w of C.wounds(c).filter((x) => x.bleed > 0)) if (worsen(c, w, lines, 'Untended, it bleeds')) return lines;
      C.bindWounds(c);
    }
    c.wounds = C.wounds(c).filter((w) => w.sev > 0).map((w) => { delete w.ongoing; delete w.tended; return w; });

    const tendRank = tender ? C.rank(tender, 'wound_tending') : 0;
    const surgeon = tender && C.rank(tender, 'surgeon');
    const physician = tender && C.rank(tender, 'physician');
    const rolls = opts.town || physician ? 2 : 1;
    for (let i = 0; i < rolls; i++) {
      const w = healTarget(c);
      if (!w) break;
      let r = (await roller({ actorId: c.id, sides: CONFIG.healDie, count: 1, label: `${c.name}: daily heal roll`, detail: tender ? `d6 (tended: 1s reroll, +${tendRank})` : 'd6: 1 worsen, 2 nothing, 3–6 heal' }))[0];
      if (tender && r === 1) {
        r = (await roller({ actorId: c.id, sides: CONFIG.healDie, count: 1, label: `${c.name}: reroll 1 (tended)`, detail: 'd6' }))[0];
      }
      if (r !== 1) r += tendRank;
      if (r === 1 && !surgeon) {
        if (worsen(c, w, lines, 'Heal roll 1')) return lines;
      } else if (r <= 2) {
        lines.push(`Heal roll ${r}: no change.`);
      } else {
        C.mendWounds(c, 1, 1);
        lines.push(`Heal roll ${r}: the ${placeOf(w)} wound mends a step.`);
      }
      if (surgeon && healTarget(c)) {
        const x = healTarget(c);
        C.mendWounds(c, 1, 1);
        lines.push(`Surgeon: the ${placeOf(x)} wound mends a step.`);
      }
    }

    // Gear that heals (a bloodstone breastplate: effects.heal): more steps back each night.
    for (let i = 0; i < G.Effects.sum(c, 'heal'); i++) {
      const x = healTarget(c);
      if (!x) break;
      C.mendWounds(c, 1, 1);
      lines.push(`Healing gear: the ${placeOf(x)} wound mends a step.`);
    }
    // Items' powers come back with the night.
    if (G.Magic && G.Magic.rechargeAll) G.Magic.rechargeAll(c);
    c.weary = 0; // a night's sleep clears the weariness of the day's fights and hours
    c.wearyCarry = 0;
    c.stamina = C.maxStamina(c);
    c.spSpent = 0;
    c.spWeary = 0;
    c.status = C.freshStatus();
    C.updateCondition(c); // still over their wound boxes: down until mended

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
