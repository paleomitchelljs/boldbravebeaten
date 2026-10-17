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
    moveBase: 1, // squares per AP = (1 + floor(SPD/4)) × moveScale
    // PROVISIONAL: squares are about a pace (1 = clinch, 2 = sword distance), so
    // movement covers twice as many of them as the Specifics formula gives.
    moveScale: 2,
    moveSpdDivisor: 4,
    // PROVISIONAL (trial): most AP one character may spend in a single pass, in base AP
    // (× apScale, so 4 on the sheet). A turn can hold several cheap actions up to the cap; an
    // action costing more keeps paying from the next passes' allowance. null = no cap.
    apPerPass: 2,
    // When an action spills past this pass's allowance it lands:
    //   'late' — at the end of the pass in which it is fully paid (slow actions are telegraphed)
    //   'now'  — this pass, and the overspend is owed from the next passes (recovery time)
    // Guards always go up at once.
    spanLands: 'late',
    // PROVISIONAL: a guard (a readied block, parry or dodge) meets the next attack that lands on
    // you, or the next from the attacker you name. It lasts until used or:
    //   'pass'  — the end of the pass it was readied in (so AP saved for the last passes buys
    //             attacks the spent can't answer)
    //   'round' — the end of the round
    guardLasts: 'pass',
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

    // ---- Range (PROVISIONAL; weapon reach data lives in data.js) ----------
    range: {
      // Attacks with weapons that aren't closeOK, at range 1 ("inside the weapon's reach"):
      //   'blunt'  — the blow lands with closeMult of its total force, all as blunt (pommel, haft,
      //              guard); a spear can be jabbed with the shaft (round-6 rule, the user's call)
      //   'cannot' — the attack can't be made; shove, grapple, draw a dagger or use a close technique
      //   'half'   — the attack does half damage (round-2 rule)
      closeRule: 'blunt',
      closeMult: 0.5,
      longRangePenalty: 2, // bows: −2 damage beyond their long range
      maneuverMax: 1, // trips, disarms, grapples, shoves, kicks and punches need clinch distance
    },

    // PROVISIONAL: a character held in a grapple fights cramped with any weapon, dagger included
    // (the grapple is "inside" even a dagger's reach): the same penalty as range.closeRule.
    grappledWeaponsCramped: true,

    // ---- Getting up (PROVISIONAL, the user's call) ------------------------
    // Standing from prone gets steeply harder in heavier armor. Base AP and stamina by armor
    // (× apScale and × staminaScale; plus the armor's usual stamina penalty). Specifics: 2 AP
    // + 0/0/1/1/2 for padded/leather/mail/scale/plate. The AP is capped at the character's
    // pool, so getting up is always possible, if it takes the whole round. Kip-Up: 1 base AP.
    standUp: {
      ap: { none: 1, padded: 1, leather: 1, mail: 2, scale: 3, plate: 4 },
      stamina: { none: 1, padded: 1, leather: 1, mail: 2, scale: 3, plate: 5 },
    },

    // ---- Grappling (PROVISIONAL, designed with the user) -------------------
    // A ladder between two adjacent fighters: free → clinch (mutual) → hold → pin. Every step is a
    // directly opposed roll, d10 + score each; guards never apply. Grapple score = ⌊STR/2⌋ +
    // Grappler rank; breaking free uses ⌊max(STR, DEX)/2⌋ + Escape Artist (+2).
    //   Clinch  (free → clinch; win by bigMargin → you hold them)
    //   Grapple (clinch → you hold; by bigMargin → pin; lose by bigMargin → they hold you)
    //   Pin     (hold → pin; lose by bigMargin → back to a clinch)
    //   Throw   (from a hold or pin: they land prone a square away, the grapple ends; by
    //            bigMargin they also take throwDamage blunt + STR bonus)
    //   Break   (the lower side, or either side of a clinch: one step down; by bigMargin two
    //            steps, or from a hold a reversal)
    // Armor (option 4, the user's choice): plate is easy to grab — `handles` adds to the attacker's
    // grapple and pin rolls — but hard to throw: footing (maneuver.armorStability) adds to the
    // defender's roll against throws.
    // Grappling is exhausting: base stamina per step (× staminaScale), and holdUpkeep at the end
    // of every round you hold or pin someone; a holder who can't pay lets go.
    grappling: {
      stamina: { clinch: 3, grapple: 5, pin: 5, throw: 5, break: 3 },
      holdUpkeep: 2,
      bigMargin: 5,
      handles: { mail: 1, scale: 1, plate: 2 },
      throwDamage: 3,
      pinBonus: 2, // Pin feat
      dogpile: { perAlly: 1, withFeat: 2 },
    },

    // ---- Shove (PROVISIONAL) ----------------------------------------------
    // Opposed d10 + ⌊STR/2⌋ (+2 two-handed weapon) vs d10 + footing. A win pushes the
    // target straight back (1 square, 2 on a margin of 5+); a blocked push on a margin of
    // 5+ knocks them down instead.
    shove: { twoHandBonus: 2, farMargin: 5 },

    // ---- Wind-up (PROVISIONAL) --------------------------------------------
    // Motions that must be wound up in an earlier round before they can be released.
    // The wind-up costs part of the AP and stamina; the release costs the rest.
    // While wound up you cannot block or parry. The wind-up is lost if you are knocked
    // prone, grappled, disarmed or drop, or if you don't release it the next round.
    windUp: {
      motions: ['power'],
      ap: 2,
      stamina: 1,
      exposed: ['block', 'parry'],
      spells: true, // spells using the Strong modifier must be gathered the same way
      // After releasing in a round you may wind up again that round (a steady archer looses
      // and redraws; a swinger chains blows). Either way you stay exposed.
      rewindAfterRelease: true,
    },

    // ---- Archery (PROVISIONAL; nothing in the design docs yet) -----------
    archery: {
      strBonus: false, // STR does not add to arrow damage
      parry: false, // arrows can be blocked or dodged, not parried
    },

    // ---- Magic (PROVISIONAL stub so casters can be tested) ---------------
    // Spells are an unordered verb + noun (+ modifier); cost = sum of word costs.
    magic: {
      words: {
        attack: { kind: 'verb', cost: 2, magnitude: 4, range: [1, 2], feat: 'verb_attack', name: 'Attack' },
        launch: { kind: 'verb', cost: 3, magnitude: 3, range: [2, 12], feat: 'verb_launch', name: 'Launch' },
        fire: { kind: 'noun', cost: 1, element: 'fire', name: 'Fire' },
        force: { kind: 'noun', cost: 1, element: 'force', name: 'Force' },
        strong: { kind: 'mod', cost: 2, magnitude: 3, feat: 'mod_strong', name: 'Strong', windUp: true },
      },
      castAP: 3, // base, × apScale
      poolPerCasting: 3, // spell points = INT + 3 × Casting rank
      // A tired caster can't draw as much power: usable points scale with stamina.
      staminaLimitsPoints: true,
      // Fire: armor stops half its blunt mitigation; every 2 points left over cost 1 CON,
      // the rest goes to stamina.
      fireMitigation: 0.5,
      fireConPer: 2,
      // Force: blunt, mitigated normally, with a knockdown check (INT/2 vs footing).
      forceKnockdownMargin: 2,
      // Backlash: d10 + Control rank; if below the spell's cost, lose 2 stamina per point short.
      backlashPerPoint: 2,
    },

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
    // PROVISIONAL: wear per block is multiplied by this (fewer hits before a shield fails).
    shieldWearScale: 2,
    // PROVISIONAL: a blocked power attack pushes through: force above the shield's break
    // threshold reaches the bearer as blunt damage.
    powerMotions: ['power'],
    powerPushThrough: true,
    // PROVISIONAL: a blocked power attack breaks the shield outright when the weapon is at
    // least as hard as the shield, unless the shield is of a powerful quality.
    materialHardness: { wood: 1, hide: 1, iron: 2, steel: 3 },
    powerfulShieldQualities: ['masterwork'],
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
    // Per-armor overrides of the Specifics armor table, e.g. { plate: { stamina: 1, regen: 3 } }.
    // TUNED (arena, round 3): plate +1 stamina per action (was +2) and −3 regen (was −4).
    // Plate fighters were losing by exhaustion (0.6 collapses a fight); this brings heavy
    // armor from worst to about par in the open and best in close quarters.
    armorAdjust: { plate: { stamina: 1, regen: 3 } },
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
      // Lean: piercing vs a prone or pinned armored target passes through fully (held is not enough)
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
    // PROVISIONAL reading: the four magic sub-trees "interlock", so tier counts feats across
    // all of them. Counted per sub-tree, Casting and each Affinity line can never pass rank I
    // (their only novice feat is rank I, and everything after needs 2 feats in the tree).
    featTierGroups: { magicCasting: 'magic', magicWords: 'magic', magicAffinity: 'magic', magicRitual: 'magic' },
  };

  // Every PROVISIONAL choice, shown on the Rules tab so nothing is hidden.
  CONFIG.provisional = [
    'AP scale ×2: every base AP cost and the AP pool are doubled (pool 8–12); feats still cut a flat 1 AP. Chosen by simulation.',
    'Rounds, turns and passes: a round starts with initiative; characters take turns in initiative order; one set of everyone\'s turns is a pass, and the pass resolves at its end. Passes repeat until no one has actions left.',
    'Guards: on your turn you ready a block, parry or dodge. It meets the next attack that lands on you this pass, or the next one from a foe you name; it lasts until used or the end of the pass. A guard that can\'t meet an attack (a parry against an arrow) stays up for the next one. Within a pass, attacks land in initiative order, so the fastest attacker meets a general guard first.',
    'AP per pass (trial): at most 2 base AP (4 on the sheet) per pass. A turn may hold several actions up to that. An action costing more keeps paying from the next passes and lands at the end of the pass in which it is fully paid (a 6-AP swing lands a pass later). Guards go up at once and borrow any overspend from the next pass. A pass in which no one starts or lands anything ends the round.',
    'Stamina scale ×3: every base stamina cost is tripled. Chosen by simulation so the stamina curve matches the Outline.',
    'Piercing through armor: each leftover point rolls a d10 and reaches CON on ≤ pass-through × 10 (plate 2, other full armor 5). Chosen by simulation over rounding.',
    'Armor wear per hit is a third of (blunt + converted slashing); armor keeps at least 75% of its mitigation until destroyed.',
    'Block target numbers by shield: buckler 5, round 4, heater 3, tower 2 (d10 + Shield Training).',
    'Range: a square is about a pace (1 = clinch, 2 = sword distance). Swings reach 1 to the weapon\'s reach; thrusts reach farther on some weapons (rapier +1, spear +2). Inside a long weapon\'s reach (range 1) its blows land with half their force, all as blunt (pommel, haft, guard). Daggers, clubs, maces and hammers work fully at 1, as do half-swording and the murder stroke. Movement covers twice the Specifics squares.',
    'Weapons in hand: drawing a weapon costs 1 AP on the sheet; dropping one costs nothing; picking one up costs 4. Drawing while holding a weapon drops it (a dagger is sheathed instead). A character held in a grapple fights cramped with any weapon, dagger included: half force, all blunt.',
    'Shove (2 AP, range 1): opposed d10 + ⌊STR/2⌋ (+2 with a two-handed weapon) vs d10 + footing. A win pushes the target back 1 square, 2 on a margin of 5+; if they can\'t move, a margin of 5+ knocks them down.',
    'Wind-up: a power swing, a longbow shot and a Strong spell are wound up (drawn) in one round (2 AP) and released the next for the rest of the cost. After releasing you may wind up again in the same round. While wound up you cannot block or parry; the wind-up is lost if you are knocked down, grappled, disarmed or drop, or if you don\'t release it the next round.',
    'Shields vs power attacks: a blocked power swing breaks the shield outright if the weapon is at least as hard as the shield (wood < iron < steel) unless the shield is masterwork, and force above the shield\'s break threshold drives through as blunt damage. Every block wears a shield twice as fast as before.',
    'Spear (not in the catalog): point 6/0/0, thrusting 2–4, one hand.',
    'Bows (not in the design docs): shortbow arrow 5 P, range 2–12, 3 AP, single action; longbow 7 P, range 2–16, drawn one round and loosed the next; −2 damage at long range; arrows can be blocked or dodged, not parried; no STR bonus; one arrow per shot.',
    'Magic (stub): verbs Attack (range 1–2, magnitude 4, cost 2) and Launch (2–12, 3, 3); nouns Fire and Force (cost 1); modifier Strong (+3, cost 2, must be wound up). Spell points = INT + 3 × Casting rank, limited by stamina. Fire: armor stops half its blunt mitigation, every 2 points left cost 1 CON, the rest stamina. Force: blunt with a knockdown check. Backlash: d10 + Control below the cost loses 2 stamina per point short.',
    'Magic feat tiers count feats across all four magic sub-trees (otherwise Casting and Fire Affinity can never pass rank I).',
    'Plate: +1 stamina per action and −3 regeneration (Specifics: +2 and −4), tuned in the arena.',
    'Initiative: d10 + effective SPD.',
    'Defense checks: d10 + bonuses vs. target number. Parry TN 6 (+Parry Training, +⌊(DEX−5)/2⌋), dodge TN 6 (+Dodge Training, +⌊(SPD−5)/2⌋, −armor DEX penalty). Two-handed swings +1 TN, power swings +2.',
    'A successful parry or dodge negates the strike completely.',
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
    'Trip and disarm each cost 3 AP and 2 stamina (base).',
    'Grappling ladder: free → clinch → hold → pin, each step a directly opposed d10 roll (⌊STR/2⌋ + Grappler; breaking free may use ⌊max(STR, DEX)/2⌋ + Escape Artist). Win by 5+ for two steps; lose by 5+ and it can reverse. Clinch: both cramped with long weapons, no two-handed swings or bows, no stepping away without a break. Hold: the held fighter can\'t move and fights cramped with every weapon, dagger included; the holder keeps a dagger hand and can drag them a square. Pin: the pinned fighter can only try to break; piercing and a Coup de Grâce dagger go through their armor. Throw: from a hold or pin, prone a square away. Armor is easy to grab (+1 mail and scale, +2 plate to grapple and pin) but hard to throw (footing +1 / +2). Costs in base AP / stamina: clinch 2 / 3, grapple, pin and throw 3 / 5, break 2 / 3, and 2 stamina a round to keep a hold.',
    'Getting up from prone, base AP / stamina by armor: none, padded or leather 1 / 1; mail 2 / 2; scale 3 / 3; plate 4 / 5 (on the sheet: plate is 8 AP and about 15 stamina). Never more AP than your pool. Kip-Up: 1 AP.',
    'Movement costs only the armor stamina penalty, once per move action.',
    'Bandage: 3 AP (1 AP with Field Dressing) and uses one bandage.',
    'Long rest repairs 25% of max armor and shield durability (+25% with Field Repair).',
    'Daggers get −1 AP on thrusts and swings ("lowest AP").',
    'Very light and light weapons count as "light weapons" for Light Touch and Precision.',
  ];

  G.CONFIG = CONFIG;
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
