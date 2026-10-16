/*
 * Tunable numbers for the rules engine.
 *
 * Values marked "Specifics" come straight from the Game System Specifics doc.
 * Values marked "PROVISIONAL" fill a rule the Mechanics Outline lists as Open;
 * they exist only so the game is playable and should be replaced by playtest or
 * simulation results. Every provisional value is listed on the Rules tab.
 */
(function (G) {
  'use strict';

  const CONFIG = {
    // ---- Attributes -------------------------------------------------------
    attributes: ['STR', 'CON', 'DEX', 'SPD', 'INT', 'WIS', 'CHA'],
    attrMin: 1,
    attrMax: 10, // Specifics: attributes run 1–10
    conditioningCap: 3, // Specifics: feats raise each attribute by at most +3

    // ---- Stamina (Specifics) ---------------------------------------------
    // Max stamina = 4×CON + STR + SPD + DEX
    staminaWeights: { CON: 4, STR: 1, SPD: 1, DEX: 1 },
    // Regen = floor((CON + WIS)/4) − armor regen penalty
    regenDivisor: 4,
    // Fatigue: −1 AP below 50% stamina, −2 below 25%
    fatigueSteps: [
      { below: 0.5, ap: 1 },
      { below: 0.25, ap: 2 },
    ],
    // PROVISIONAL: an action cannot be paid if it would take you to 0 stamina
    // (otherwise characters could exert themselves unconscious).
    exertionCanKnockOut: false,
    // PROVISIONAL: negative regeneration (heavy armor) applies even on rounds you were hit.
    negativeRegenAlwaysApplies: true,
    // PROVISIONAL: unconscious characters do not regenerate during combat.
    unconsciousRegenerates: false,

    // ---- Action points (Specifics) ---------------------------------------
    // Multiplies every base AP cost and the AP pool; feats still cut a flat 1.
    // At 1, a "−1 AP" feat halves a 2-AP thrust; at 2 it cuts it by a quarter.
    // TUNED (sim): 2. With 4–6 AP pools a −1 AP feat halved a 2-AP thrust or block, so play
    // collapsed into 1-AP thrust/block spam and numbers stopped countering plate.
    apScale: 2,
    apBase: 3, // AP = 3 + floor(SPD/2)
    apSpdDivisor: 2,
    moveBase: 1, // squares per AP = 1 + floor(SPD/4)
    moveSpdDivisor: 4,
    minActionAP: 1, // costs never drop below 1 AP or 0 stamina
    minStrikeAP: 1, // floor for weapon strikes specifically (tunable separately)
    minStrikeStamina: 0, // floor for weapon strikes' stamina
    // PROVISIONAL: very light weapons (dagger) get −1 AP on thrust/swing ("lowest AP").
    veryLightApDiscount: 1,

    // ---- Initiative -------------------------------------------------------
    // PROVISIONAL: initiative = d10 + effective SPD
    initiativeDie: 10,

    // ---- Damage (Specifics) ----------------------------------------------
    motionMultiplier: { thrust: 1.0, swing: 1.0, twoHanded: 1.3, power: 1.6 },
    heavyMultiplierAdjust: { thrust: -0.2, swing: 0, twoHanded: 0.2, power: 0.2 },
    // Slashing→blunt conversion by motion (Specifics)
    conversion: { thrust: 0.2, swing: 0.33, twoHanded: 0.5, power: 0.66 },
    // STR bonus: +floor((STR − 5)/2) to the main damage type
    strBonusPivot: 5,
    strBonusDivisor: 2,
    // Piercing pass-through after mitigation (Specifics: 50% for full armor), rounded down
    piercePassThrough: 0.5,
    // How leftover piercing becomes CON damage:
    //   'floor' — leftover × pass-through, rounded down;
    //   'roll'  — each leftover point rolls a d10 and reaches CON on ≤ pass-through × 10
    //             (the Outline's "coverage-based chance").
    // TUNED (sim): 'roll'. With 'floor', plate's value hinged on one integer threshold
    // (thrusts did exactly 0 or 1 CON) and matchups flipped between trivial and invincible.
    pierceMode: 'roll',
    // Multiplier on pass-through by armor type, e.g. {plate: 0.5}; null = 1 for all.
    // TUNED (sim): plate 0.4 (so 20% per point). At 0.5 plate won 42% against lighter armor.
    passThroughByArmor: { plate: 0.4 },
    // Slashing to an unarmored target: 1d4 per point → 1 STR, 2 CON, 3 SPD, 4 DEX
    slashAttributeTable: { 1: 'STR', 2: 'CON', 3: 'SPD', 4: 'DEX' },
    // Bleed: every 3 points of P/S reaching attributes = 1 bleed/round for 3 rounds.
    // Implemented as "the wound bleeds its own damage again, spread over 3 rounds",
    // which reproduces the Specifics worked example (7 slashing → 7 CON of bleed).
    bleedRounds: 3,

    // ---- Weight (Specifics) ----------------------------------------------
    // Multiplies the base stamina cost of every action (before weight and armor).
    // TUNED (sim): 3. At ×1 an early unarmored fighter could attack flat out for 30+ rounds
    // (Outline target: tires within a few rounds), fatigue never mattered, and plate mirrors
    // ran 8–11 rounds. At ×3 the measured curve matches the Outline: early unarmored 4 rounds,
    // mid-level with cost feats indefinitely, plate 3.
    staminaScale: 3,
    weightFactor: { 'very light': 1.0, light: 1.0, medium: 1.25, heavy: 1.5 },
    weightOrder: ['very light', 'light', 'medium', 'heavy'],
    // STR offsets 1 point of armor/weight penalty per 2 STR above 5
    strOffsetPivot: 5,
    strOffsetDivisor: 2,

    // ---- Defense checks: all PROVISIONAL (Outline: "success checks Open") --
    // Success when d10 + bonuses ≥ target number.
    defense: {
      die: 10,
      // + Shield Training rank. PROVISIONAL: smaller shields cover less.
      block: { tn: 3, tnBySize: { buckler: 5, round: 4, heater: 3, tower: 2 } },
      parry: { tn: 6 }, // + Parry Training rank + floor((DEX−5)/2)
      dodge: { tn: 6 }, // + Dodge Training rank + floor((SPD−5)/2) − armor DEX penalty
      // Heavier motions are harder to parry/dodge
      motionPenalty: { thrust: 0, swing: 0, twoHanded: 1, power: 2, unarmed: 0, maneuver: 0 },
      // PROVISIONAL: a successful parry or dodge negates the strike fully
      parryNegates: 1.0,
      dodgeNegates: 1.0,
    },

    // ---- Shields ----------------------------------------------------------
    // Specifics: 10% break chance per point over threshold
    shieldBreakPerPoint: 10,
    // PROVISIONAL: shield wear from a blocked hit = 0.5×P + 0.5×S + 1×B ("blunt wears it most")
    shieldWear: { P: 0.5, S: 0.5, B: 1.0 },
    // PROVISIONAL: tower shields cost 1 square of movement per AP ("slows movement")
    towerMovePenalty: 1,

    // ---- Armor ------------------------------------------------------------
    // PROVISIONAL: base durability per armor type (Outline: durability like HP; numbers Open)
    armorDurability: { padded: 20, leather: 25, mail: 40, scale: 45, plate: 60 },
    // PROVISIONAL: armor coverage keyword
    coverage: {
      full: { mitigation: 0, penalty: 0, passThrough: 0.5 },
      half: { mitigation: -1, penalty: -1, passThrough: 0.6 },
      partial: { mitigation: -2, penalty: -2, passThrough: 0.75 },
    },
    // PROVISIONAL: durability lost per hit = (incoming blunt + slashing converted to blunt)
    // × armorWearScale (padding exempt). Mitigation scales with current/max durability,
    // keeping at least durabilityMitigationFloor of its value until the armor is destroyed.
    // TUNED (sim): full wear let three harmless kicks strip a point of plate mitigation.
    armorWearScale: 0.33,
    durabilityMitigationFloor: 0.75,

    // ---- Maneuvers: all PROVISIONAL (Outline: chances Open) ---------------
    maneuver: {
      die: 10,
      // knockdown resistance from armor weight
      armorStability: { none: 0, padded: 0, leather: 0, mail: 1, scale: 1, plate: 2 },
      kickKnockdownMargin: 3, // a kick knocks down only if it wins the opposed roll by 3+
      tripMargin: 1, // a trip needs to win the opposed roll by this much
      tripFeatBonus: 2,
      disarmFeatBonus: 2,
      twoHandGripBonus: 2,
      ironStanceBonus: 3,
      escapeArtistBonus: 2,
      proneDamageBonus: 1, // "attacks against the target gain a bonus"
      proneDefenseExtraAP: 1, // "defensive actions cost more"
      grappledDefenseExtraAP: 1,
      // Lean: piercing vs a prone or grappled armored target passes through fully
      pronePassThrough: 1.0,
      dogpileFraction: 0.5, // extra grapplers add half their STR without the Dogpile feat
    },

    // ---- Recovery (Specifics) --------------------------------------------
    healDie: 6, // 1 = −1 CON, 2 = no change, 3–6 = +1
    // PROVISIONAL: a long rest repairs 25% of max durability (Field Repair: +25% more)
    restRepairFraction: 0.25,

    // ---- Progression (Outline Lean) --------------------------------------
    startingFeats: 3,
    featsPerLevel: 1,
    tierThresholds: { novice: 0, apprentice: 2, adept: 4, expert: 6, master: 8 },
  };

  // Every PROVISIONAL choice, shown on the Rules tab so nothing is hidden.
  CONFIG.provisional = [
    'AP scale ×2: every base AP cost and the AP pool are doubled (pool 8–12); feats still cut a flat 1 AP. Chosen by simulation.',
    'Stamina scale ×3: every base stamina cost is tripled. Chosen by simulation so the stamina curve matches the Outline.',
    'Piercing through armor: each leftover point rolls a d10 and reaches CON on ≤ pass-through × 10 (plate 2, other full armor 5). Chosen by simulation over rounding.',
    'Armor wear per hit is a third of (blunt + converted slashing); armor keeps at least 75% of its mitigation until destroyed.',
    'Block target numbers by shield: buckler 5, round 4, heater 3, tower 2 (d10 + Shield Training).',
    'Initiative: d10 + effective SPD.',
    'Defense checks: d10 + bonuses vs. target number. Parry TN 6 (+Parry Training, +⌊(DEX−5)/2⌋), dodge TN 6 (+Dodge Training, +⌊(SPD−5)/2⌋, −armor DEX penalty). Two-handed swings +1 TN, power swings +2.',
    'A successful parry or dodge negates the strike completely.',
    'A defense can answer any strike already declared against you this round, including one from an earlier pass.',
    'Within a pass, reach is checked against positions at the start of that pass; moves take effect afterwards.',
    'Actions cannot be paid if they would drop your own stamina to 0.',
    'Unconscious characters do not regenerate in combat. Heavy-armor negative regen always applies.',
    'Excess blunt beyond remaining stamina is lost; later hits go to attributes.',
    'Blunt damage on an unconscious target goes to CON.',
    'Armor durability: padded 20, leather 25, mail 40, scale 45, plate 60 (padding takes no wear).',
    'Armor coverage: half = −1 mitigation and −1 penalties, 60% piercing pass-through; partial = −2 / −2, 75%.',
    'Shield wear per block = ½P + ½S + B.',
    'Kick: opposed d10 + ⌊STR/2⌋; a kick knocks down only on a win by 3 or more. Trip wins on any margin.',
    'Disarm: d10 + ⌊DEX/2⌋ opposed (+2 for a two-handed grip). Grapple: d10 + ⌊STR/2⌋ + Grappler rank vs. d10 + ⌊max(STR,DEX)/2⌋.',
    'Prone: +1 damage to attacks against you, +1 AP on your defenses, no dodging. Grappled: +1 AP on defenses, no movement.',
    'Trip, disarm and grapple each cost 3 AP and 2 stamina; escape costs 2 AP and 1 stamina.',
    'Movement costs only the armor stamina penalty, once per move action.',
    'Bandage: 3 AP (1 AP with Field Dressing) and uses one bandage.',
    'Long rest repairs 25% of max armor and shield durability (+25% with Field Repair).',
    'Daggers get −1 AP on thrusts and swings ("lowest AP").',
    'Very light and light weapons count as "light weapons" for Light Touch and Precision.',
  ];

  G.CONFIG = CONFIG;
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
