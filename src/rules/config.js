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
    // WIL (resolve: magic defense, stamina regeneration, resisting fear and compulsion) is split
    // from WIS (judgment, perception) at the user's call: INT/WIL for magic, CHA/WIS for social.
    attributes: ['STR', 'CON', 'DEX', 'SPD', 'INT', 'WIL', 'WIS', 'CHA'],
    attrMin: 1,
    attrMax: 10, // Specifics: attributes run 1–10
    conditioningCap: 3, // Specifics: feats raise each attribute by at most +3
    // PROVISIONAL (monster draft): the 1–10 range (13 with Conditioning) is the human range.
    // Beasts and monsters can go past it: a bear or a troll is stronger and tougher than any
    // human can be. Every formula (damage bonus, grappling, stamina, death at CON 0) runs on
    // the raw number, so a STR-20 troll hits for +7 and grapples at +10.
    monsterAttrMax: 30,

    // ---- Stamina (Specifics) ---------------------------------------------
    // Max stamina = 4×CON + STR + SPD + DEX
    staminaWeights: { CON: 4, STR: 1, SPD: 1, DEX: 1 },
    // Regen = floor((CON + WIL)/4) − armor regen penalty (Specifics had WIS; WIL is resolve)
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

    // ---- Weapons from physics (PROVISIONAL; the user asked for a weapon pass) ----------
    // 'physical': each weapon's damage, AP, weight class, STR scaling and wounds are worked out
    // from its mass, length, hands and point/edge/head (data.js `phys`; Items.weaponStats).
    // 'table': the hand-set faces of rounds 1–8 (flat STR bonus, every wound bleeds the same).
    // Materials, quality and (later) enchantments act through Items.weaponStats, either on the
    // physical inputs (a lighter metal changes mass, so speed follows) or on the outputs.
    weaponModel: 'physical',
    weaponPhysics: {
      // The longsword is the reference: it costs what the motion table lists.
      ref: { mass: 1.4, length: 1.2 },
      grip: 1.5, // two hands on the weapon: more force (and STR) into the blow
      // Speed (TUNED): AP = motion AP × natural speed × strain factor.
      //  Natural speed, which strength never changes: a weapon lighter or shorter than the
      //  reference is quicker (thrust: 1 + thrustSlope × (min(1, mass/ref) − 1); swing:
      //  1 + swingSlope × (min(1, √(mass×length)/ref) − 1)), and a longer one travels farther
      //  (+ reachSlope × (length/ref − 1) on swings).
      //  Strain = load / capacity. Load: the mass for a thrust; mass × length/ref length for a
      //  swing (leverage). Capacity: STR × strain.kgPerStr, × grip with both hands on it, × (1 +
      //  strain.perTraining × Heavy Weapon Training). Within capacity the weapon runs at its natural
      //  speed (more STR doesn't make a light weapon faster); past it, AP and stamina × strain^exp;
      //  past strain.max it is too ungainly to use at all. Natural weapons are the body: no strain.
      thrustSlope: 0.3,
      swingSlope: 0.4,
      reachSlope: 0.3,
      strain: { kgPerStr: 0.3, exp: 2, max: 3, perTraining: 0.1 },
      // Damage. Point: depth × pointDamage piercing. Edge: edge × (base + k × √(mass × length ×
      // grip)) slashing, a seventh of it blunt. Head: 1 + k × √(head mass × length × grip)
      // blunt. Pommel: base + k × √(mass × length).
      pointDamage: 0.25,
      edgeDamage: { base: 2, k: 3 },
      headDamage: 6,
      hiltDamage: { base: 2, k: 2 },
      // Weight class (stamina factor, Heavy Weapon Training) from mass, kg upper bounds.
      weightClass: [[0.5, 'very light'], [1.2, 'light'], [1.8, 'medium'], [Infinity, 'heavy']],
      // STR adds strBonus × this (rounded toward zero). A sharp point needs little force (rapier
      // ≈ 0.3, broad spearhead 0.5); a swing needs mass and grip (mace 1, greatsword 1.5).
      str: { thrustBase: 0.25, thrustWidth: 0.25, swingRefMass: 1.4, max: 1.5 },
      // Bleeding: a piercing wound bleeds damage × width/bleedWidth over 2 + depth/15 rounds
      // (deep wounds don't clot). Cuts bleed their damage over CONFIG.bleedRounds, as before.
      bleedWidth: 4,
      bleedRounds: { base: 2, perDepth: 15 },
    },
    // ---- Wound roll (PROVISIONAL) -------------------------------------------------
    // A blow that reaches the body rolls a d10: at or under 10 × chance it's a vital wound (neck,
    // heart, a big artery). Piercing: chance = depth/100 (max 0.4); the wound does `mult` × its
    // CON damage and bleeds twice as much. Cuts: chance = cut × edge; the cut also takes its
    // damage again from CON (a throat or an artery). Armor guards the vital spots: the chance is
    // multiplied by armor[type] (×coverage for half or partial armor, up to 1). Natural weapons
    // use `natural`. Undead and constructs have no vital spots.
    vital: {
      perDepth: 0.01, max: 0.4, mult: 3, cut: 0.1, natural: 0.1,
      armor: { padded: 0.6, leather: 0.5, mail: 0.3, scale: 0.25, plate: 0.1, fur: 0.8, frogSkin: 0.8, chitin: 0.4, scaleHide: 0.5, sarnakScales: 0.4, trollHide: 0.5, golemStone: 0 },
      otherArmor: 0.5,
      coverage: { full: 1, half: 1.5, partial: 2 },
      // A pinned fighter's armor doesn't guard the vitals: the point goes in at the armpit,
      // the visor, the groin (how armored men were finished with a dagger).
      pinnedOpensArmor: true,
    },

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

    // ---- Webs (PROVISIONAL, monster draft) ---------------------------------
    // Each layer of sticky web adds base AP and stamina (× the scales) to every action. Up to
    // maxLayers. Tear free: d10 + ⌊STR/2⌋ ≥ tearTN clears them all. Fire burns them away.
    // wearOff layers come loose by themselves at the end of each round.
    web: { ap: 1, stamina: 1, maxLayers: 2, tearTN: 8, wearOff: 1 },

    // ---- Shove (PROVISIONAL) ----------------------------------------------
    // Opposed d10 + ⌊STR/2⌋ (+2 two-handed weapon) vs d10 + footing. A win pushes the
    // target straight back (1 square, 2 on a margin of 5+); a blocked push on a margin of
    // 5+ knocks them down instead.
    // PROVISIONAL (user asked for ways to stop an advance or push a foe back): fendReach — a
    // long weapon (reach 2+) shoves at range 2 with the haft or point; shieldBonus — a ready
    // shield adds to the shove. A shove that moves or floors a foe spoils their move that pass.
    shove: { twoHandBonus: 2, farMargin: 5, fendReach: 2, shieldBonus: 1 },
    // PROVISIONAL (the user asked for in-combat charm and wisdom actions): Bait — d10 + ⌊CHA/2⌋
    // + Feint against d10 + ⌊WIS/2⌋: the foe's guards are drawn out (spent) and they defend at
    // −2 for the rest of the round. Read intent (cheap, 1 AP on the sheet) — the reader rolls
    // d10 + ⌊WIS/2⌋ + Read Attack against tn + ⌊CHA/2⌋ + Feint (the foe's, unseen). Made it: the
    // foe's true intent and, for the round, +2 to defend against them and to beat their defenses.
    // Missed by less than misreadBy: nothing to go on. Missed by misreadBy or more: a confident
    // misread — a false intent and −2 — that looks just like a true read. Range: in sight.
    social: { bait: { range: 3 }, readIntent: { range: 4, tn: 5, misreadBy: 4 }, readBonus: 2 },
    // PROVISIONAL: Ready a thrust (a long melee thrust: sword, rapier, spear). Declared on your
    // turn for its AP (stamina only if made); lasts the pass. A foe whose move this pass brings
    // them closer and into its reach is thrust at first, where they enter the reach; a hit stops
    // their advance. Guards meet it as usual. Optionally aimed at one foe.
    readyStrike: true,

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
      // PROVISIONAL (history, the user's call): armor stops arrows better than it stops a thrust
      // at arm's length. Layered textile catches a shaft (padded most); mail is worn over padding.
      // Extra piercing mitigation against arrows only, by armor type.
      vsArrows: { padded: 2, leather: 1, mail: 1, scale: 1, plate: 0, fur: 1, chitin: 1, trollHide: 1, scaleHide: 1, sarnakScales: 1, golemStone: 0 },
      // Arrowheads. Broadheads cut terrible wounds (bleed × bleed) but a broad blade is stopped by
      // metal armor (+metalMit); bodkins are narrow armor-piercers that make a smaller wound
      // (damage on the main type) but slip through mail and plate (metalMit < 0).
      heads: {
        broadhead: { name: 'broadhead', ammo: 'arrows', damage: 0, metalMit: 1, bleed: 1.5 },
        bodkin: { name: 'bodkin', ammo: 'bodkins', damage: -1, metalMit: -2, bleed: 1 },
      },
      metalArmor: ['mail', 'scale', 'plate'],
    },

    // ---- Magic (PROVISIONAL stub so casters can be tested) ---------------
    // Spells are an unordered verb + noun (+ modifier); cost = sum of word costs.
    magic: {
      // PROVISIONAL (magic overhaul, phase 1). Verbs set the shape, nouns what it is, a modifier
      // scales it. Verbs and modifiers come from Magic: words feats; nouns are found in the world.
      // Verbs: cost (spell points), mag (magnitude), range [min, max], ap (base AP, else castAP),
      // radius / length / rounds for areas, walls and lingering effects.
      words: {
        strike: { kind: 'verb', shape: 'bolt', cost: 2, mag: 6, range: [1, 2], feat: 'verb_strike', name: 'Strike' },
        launch: { kind: 'verb', shape: 'bolt', cost: 3, mag: 5, range: [2, 12], feat: 'verb_launch', name: 'Launch' },
        burst: { kind: 'verb', shape: 'area', cost: 4, mag: 4, range: [2, 8], radius: 1, ap: 3, feat: 'verb_burst', name: 'Burst' },
        cover: { kind: 'verb', shape: 'ground', cost: 3, mag: 1, range: [1, 8], radius: 1, rounds: 3, feat: 'verb_cover', name: 'Cover' },
        build: { kind: 'verb', shape: 'wall', cost: 3, mag: 1, range: [1, 6], length: 3, rounds: 3, ap: 3, feat: 'verb_build', name: 'Build' },
        open: { kind: 'verb', shape: 'terrain', cost: 3, mag: 0, range: [1, 6], length: 1, rounds: null, ap: 3, feat: 'verb_open', name: 'Open' },
        inscribe: { kind: 'verb', shape: 'rune', cost: 2, mag: 5, range: [0, 1], radius: 0, ap: 3, feat: 'verb_inscribe', name: 'Inscribe' },
        hex: { kind: 'verb', shape: 'bane', cost: 2, mag: 1, range: [1, 8], rounds: 3, feat: 'verb_hex', name: 'Hex' },
        bless: { kind: 'verb', shape: 'boon', cost: 2, mag: 1, range: [0, 2], rounds: 3, ap: 2, feat: 'verb_bless', name: 'Bless' },
        // Restore undoes a noun's harm on an ally: Life mends wounds; other nouns lift the
        // conditions they inflict (Venom cures poison, Fire puts out burning, Will frees the
        // controlled). Wide spreads it to everyone within a square, friend or foe. PROVISIONAL.
        restore: { kind: 'verb', shape: 'restore', cost: 2, mag: 1, range: [0, 2], ap: 2, feat: 'verb_restore', name: 'Restore' },
        ward: { kind: 'verb', shape: 'ward', cost: 2, mag: 2, range: [0, 2], rounds: 3, ap: 2, feat: 'verb_ward', name: 'Ward' },
        beguile: { kind: 'verb', shape: 'mind', cost: 3, mag: 1, range: [1, 6], rounds: 2, feat: 'verb_beguile', name: 'Beguile' },
        blink: { kind: 'verb', shape: 'blink', cost: 3, mag: 0, range: [1, 4], ap: 2, feat: 'verb_blink', name: 'Blink' },
        conjure: { kind: 'verb', shape: 'conjure', cost: 5, mag: 3, range: [1, 4], rounds: 4, ap: 4, feat: 'verb_conjure', name: 'Conjure' },
        // Nouns: element (how computeHit treats it), hurt (blunt / halfBlunt / thorns for vectors),
        // onHit (after a blow: a condition, a push, a knockdown), and what the other verbs make.
        fire: { kind: 'noun', cost: 1, element: 'fire', ward: 'fire', name: 'Fire', onHit: { cond: 'burning', rounds: 2 }, ground: 'hot', wall: 'fireWall', bane: 'burning', boon: 'kindled', conjure: 'elemental' },
        frost: { kind: 'noun', cost: 1, element: 'frost', ward: 'frost', name: 'Frost', onHit: { cond: 'slowed', rounds: 1 }, ground: 'ice', wall: 'iceWall', bane: 'numbed', boon: 'frostWard', conjure: 'elemental' },
        lightning: { kind: 'noun', cost: 1, element: 'lightning', ward: 'lightning', name: 'Lightning', onHit: { cond: 'shocked', rounds: 1 }, ground: 'charged', wall: 'stormWall', bane: 'shocked', boon: 'hasted', conjure: 'elemental' },
        wind: { kind: 'noun', cost: 1, element: 'wind', ward: 'missiles', hurt: 'halfBlunt', name: 'Wind', onHit: { push: 2 }, ground: 'winds', wall: 'windWall', boon: 'freedom', conjure: 'elemental' },
        earth: { kind: 'noun', cost: 1, element: 'earth', ward: 'earth', hurt: 'blunt', name: 'Earth', ground: 'rough', wall: 'stoneWall', terrain: 'pit', bane: 'slowed', boon: 'stoneskin', conjure: 'elemental' },
        vine: { kind: 'noun', cost: 1, element: 'vine', ward: 'vine', hurt: 'thorns', name: 'Vine', onHit: { cond: 'rooted', rounds: 1 }, ground: 'brambles', wall: 'brambleWall', bane: 'rooted', boon: 'barkskin', conjure: 'elemental' },
        life: { kind: 'noun', cost: 1, element: 'life', ward: 'life', name: 'Life', bane: 'withering', boon: 'innervated', heals: true, conjure: 'raise' },
        force: { kind: 'noun', cost: 1, element: 'force', ward: 'magic', hurt: 'blunt', name: 'Force', onHit: { knockdown: true }, wall: 'forceWall', boon: 'shielded' },
        // Mind (a first mind noun; more in phase 2): no blow to speak of, but it baits (draws out
        // guards) and gives foresight (reads every foe's intent).
        mind: { kind: 'noun', cost: 1, element: 'mind', name: 'Mind', onHit: { cond: 'baited', rounds: 1 }, bane: 'baited', boon: 'foresight', ward: 'mind' },
        // ---- Phase 2 (draft) -----------------------------------------------------------
        // Mind nouns: Beguile casts them (WIL resists). No blow of their own.
        calm: { kind: 'noun', cost: 1, element: 'mind', name: 'Calm', mind: 'calmed', boon: 'steadied', ward: 'mind' },
        dream: { kind: 'noun', cost: 2, element: 'mind', name: 'Dream', mind: 'mesmerized', ward: 'mind' },
        rage: { kind: 'noun', cost: 1, element: 'mind', name: 'Rage', mind: 'enraged', boon: 'emboldened', ward: 'mind' },
        fear: { kind: 'noun', cost: 1, element: 'mind', name: 'Fear', mind: 'frightened', ward: 'mind' },
        will: { kind: 'noun', cost: 3, element: 'mind', name: 'Will', mind: 'controlled', boon: 'resolute', ward: 'mind' },
        // Body nouns: a bolt carries the bane (CON resists); Bless gives the boon.
        swiftness: { kind: 'noun', cost: 1, element: 'body', name: 'Swiftness', onHit: { cond: 'slowed', rounds: 2 }, bane: 'slowed', boon: 'hasted' },
        might: { kind: 'noun', cost: 1, element: 'body', name: 'Might', onHit: { cond: 'enfeebled', rounds: 2 }, bane: 'enfeebled', boon: 'empowered' },
        grace: { kind: 'noun', cost: 1, element: 'body', name: 'Grace', onHit: { cond: 'clumsy', rounds: 2 }, bane: 'clumsy', boon: 'deft' },
        // Poison and disease.
        venom: { kind: 'noun', cost: 1, element: 'venom', name: 'Venom', onHit: { cond: 'poisoned', rounds: 3 }, ground: 'miasma', bane: 'poisoned', boon: 'antivenom', ward: 'venom' },
        plague: { kind: 'noun', cost: 2, element: 'plague', name: 'Plague', onHit: { cond: 'diseased', rounds: 10 }, bane: 'diseased', ward: 'plague' },
        // Mystic nouns.
        light: { kind: 'noun', cost: 1, element: 'light', name: 'Light', onHit: { cond: 'dazzled', rounds: 1 }, ground: 'radiance', wall: 'lightWall', bane: 'dazzled', boon: 'radiant', ward: 'light', conjure: 'elemental' },
        shadow: { kind: 'noun', cost: 1, element: 'shadow', name: 'Shadow', onHit: { cond: 'blinded', rounds: 1 }, ground: 'darkness', wall: 'shadowWall', bane: 'blinded', boon: 'shrouded', ward: 'shadow', conjure: 'elemental' },
        spirit: { kind: 'noun', cost: 1, element: 'spirit', name: 'Spirit', mind: 'frightened', boon: 'spiritShield', ward: 'spirit', conjure: 'elemental' },
        // Modifiers: shapes they work on (all if absent).
        strong: { kind: 'mod', cost: 2, mag: 3, feat: 'mod_strong', name: 'Strong', windUp: true },
        wide: { kind: 'mod', cost: 2, radius: 1, length: 2, feat: 'mod_wide', name: 'Wide', shapes: ['area', 'ground', 'wall', 'terrain', 'rune', 'restore'] },
        long: { kind: 'mod', cost: 1, roundsMult: 2, feat: 'mod_long', name: 'Long', shapes: ['ground', 'wall', 'terrain', 'bane', 'boon', 'conjure', 'mind', 'ward'] },
        // Name: say the target's name and the spell finds them anywhere on the field, with no
        // range or line needed. Companions' names are known; a foe's only if learned
        // (c.knownNames). PROVISIONAL.
        name: { kind: 'mod', cost: 2, named: true, feat: 'mod_name', name: 'Name', shapes: ['restore', 'boon', 'ward', 'bane', 'mind'] },
        far: { kind: 'mod', cost: 1, rangeMult: 2, feat: 'mod_far', name: 'Far', shapes: ['bolt', 'area', 'ground', 'wall', 'terrain', 'bane', 'mind', 'conjure', 'blink'] },
        lingering: { kind: 'mod', cost: 1, lingering: true, feat: 'mod_lingering', name: 'Lingering', shapes: ['bolt', 'area'] },
      },
      affinity: { fire: 'fire_affinity' }, // +magnitude per rank
      // Doubled nouns (Outline): with the Word Doubling feat, a spell may take two nouns instead
      // of a modifier; both do the verb. Cost: the words + doubleSurcharge. Some pairs make
      // something new (combos).
      doubleSurcharge: 2,
      combos: { 'dream+rage': 'confused' },
      // Energies the undead fear: light and spirit do double to them; spirit does nothing to the
      // living beyond a chill (half, to stamina).
      undeadBane: { light: 2, spirit: 2 },
      // Energies (fire, frost, lightning): armor stops this share of its blunt protection
      // (lightning goes straight through metal); every fireConPer points left cost 1 CON, the
      // rest stamina. Life withers the body: half its magnitude to CON, no armor; the dead and
      // the made (tireless) are past withering.
      energyMitigation: { fire: 0.5, frost: 0.5, lightning: 0.5, light: 0.5, shadow: 0.5, spirit: 0 },
      // Healing (Restore + Life). PROVISIONAL. Mends one creature: bleeding stops (not poison),
      // condMag CON back (1; 2 with Strong), stamina + staminaPerMag × magnitude stamina back (which
      // wakes the unconscious). With Wide, every living creature within a square of the target,
      // friend or foe, at areaShare of the stamina. The dead stay dead.
      heal: { stamina: 4, staminaPerMag: 2, areaShare: 0.5 },
      castAP: 2, // base, × apScale. PROVISIONAL: at 3, a bolt cost 6 sheet AP for a third of a sword thrust
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

    // ---- Rituals (PROVISIONAL draft, magic phase 3; src/rules/ritual.js) ----------------
    ritual: {
      // Difficulty tiers the GM sets: d10 + ⌊INT/2⌋ + Ritualist against these.
      tiers: { easy: 6, moderate: 8, hard: 10, veryHard: 12, legendary: 14 },
      // Margin over the tier for each outcome (below partial: fail).
      outcomes: { partial: 0, full: 3, exceptional: 6 },
      reveals: { partial: 1, full: 2, exceptional: 3 }, // secrets learned
      heals: { partial: 1, full: 2, exceptional: 4 }, // Mend: CON (+ Wound Tending on full+)
      backlashAt: -5, // a failure this bad turns on the caster (2 stamina per point short)
      trueNameBonus: 3, // with True Naming, a true name used in the ritual
      // Components (inventory.components): rituals spend them, success or not.
      components: {
        chalk: { name: 'Chalk', rarity: 'common' }, salt: { name: 'Salt', rarity: 'common' },
        candle: { name: 'Candles', rarity: 'common' }, ink: { name: 'Ink', rarity: 'common' },
        herbs: { name: 'Herbs', rarity: 'common' }, incense: { name: 'Incense', rarity: 'uncommon' },
        silverDust: { name: 'Silver dust', rarity: 'uncommon' }, graveDirt: { name: 'Grave dirt', rarity: 'uncommon' },
        gem: { name: 'Gem', rarity: 'rare' },
      },
      // The rituals: time (minutes, shortened by Ritualist), spell points (less 1 per Ritualist
      // rank), components, the feat it needs, the nouns it takes (true: any known), and which
      // secrets it reveals.
      kinds: {
        read: { name: 'Read', minutes: 60, sp: 1, components: { ink: 1, candle: 1 }, feat: 'ritualist', needs: 'Ritualist', reveals: 'read', subject: 'a tome or writing' },
        seek: { name: 'Seek', minutes: 10, sp: 2, components: { salt: 1 }, feat: 'ritualist', needs: 'Ritualist', nouns: true, reveals: 'seek', subject: 'the place you stand' },
        divine: { name: 'Divine', minutes: 60, sp: 3, components: { candle: 1, silverDust: 1 }, feat: 'ritualist', needs: 'Ritualist', reveals: 'divine', subject: 'a person, place or thing' },
        speak: { name: 'Speak', minutes: 30, sp: 3, components: { graveDirt: 1, incense: 1 }, feat: 'ritualist', needs: 'Ritualist', nouns: ['life', 'spirit', 'vine'], reveals: 'speak', subject: 'the dead (Life), a spirit (Spirit) or a beast (Vine)' },
        mend: { name: 'Mend', minutes: 60, sp: 2, components: { herbs: 2 }, feat: 'rite_of_healing', needs: 'Rite of Healing', subject: 'a patient' },
        prepare: { name: 'Prepare', minutes: 30, sp: 0, components: { chalk: 1 }, feat: 'warding', needs: 'Warding', subject: 'a ward, boon or rune laid in advance' },
        summon: { name: 'Summon', minutes: 60, sp: 6, components: { gem: 1, chalk: 2 }, feat: 'binding_circle', verbFeat: 'verb_summon', needs: 'Binding Circle and the verb Summon', needsName: true, subject: 'a creature, by its true name' },
        raise: { name: 'Raise', minutes: 120, sp: 6, components: { graveDirt: 3, candle: 2 }, feat: 'necromancy', needs: 'Necromancy', evil: true, subject: 'a body' },
      },
    },

    // ---- Conditions (PROVISIONAL, magic overhaul) ------------------------------------
    // Timed effects (src/rules/conditions.js). Values are per point of magnitude. resist: the
    // attribute a target rolls to shake it off as it lands (d10 + ⌊attr/2⌋ against the caster's
    // d10 + ⌊INT/2⌋ + Casting); living: the tireless (undead, constructs) are immune.
    conditions: {
      burning: { name: 'Burning', dot: { CON: 1 } },
      slowed: { name: 'Slowed', ap: -1, resist: 'CON' },
      hasted: { name: 'Hasted', ap: 1 },
      shocked: { name: 'Shocked', ap: -1, resist: 'CON' },
      rooted: { name: 'Rooted', noMove: true, breakAttr: 'STR', resist: 'STR' },
      numbed: { name: 'Numbed', attrs: { DEX: -1, SPD: -1 }, resist: 'CON' },
      withering: { name: 'Withering', dot: { CON: 1 }, ap: -1, resist: 'CON', living: true }, // Life bane (asystole)
      innervated: { name: 'Innervated', regen: 2 },
      kindled: { name: 'Kindled', kindled: true }, // blows set targets burning
      frostWard: { name: 'Frost ward', halveFire: true },
      freedom: { name: 'Freedom', freedom: true },
      stoneskin: { name: 'Stoneskin', mit: { B: 2 }, attrs: { SPD: -1 } },
      barkskin: { name: 'Barkskin', mit: { P: 1, S: 1 } },
      shielded: { name: 'Shielded', mit: { P: 1, S: 1, B: 1 } },
      afflicted: { name: 'Lingering harm', dot: { CON: 1 } }, // a Lingering spell's after-burn
      // Ward (verb): kind 'magic' absorbs `pool` points of spell or missile damage; 'missiles'
      // turns aside half of the arrows and bolts; an element's ward halves that element and
      // keeps off its after-effects; 'mind' keeps off baits and the like.
      warded: { name: 'Warded' },
      // Bait (CHA vs WIS) and Read intent (WIS vs CHA); Hex + Mind and Bless + Mind do the same.
      baited: { name: 'Baited', resist: 'WIL', defense: -2 }, // guards drawn out; −2 to defend
      reading: { name: 'Reading', read: 2 }, // +2 to defend against and to beat the defense of `vs`
      foresight: { name: 'Foresight', read: 2, all: true }, // reading every foe
      // ---- Phase 2 (draft) -------------------------------------------------------------
      // Mind (WIL resists). breakOnHarm: ends when the bearer takes damage.
      calmed: { name: 'Calmed', resist: 'WIL', noAttack: true, breakOnHarm: true },
      mesmerized: { name: 'Mesmerized', resist: 'WIL', ap: -99, breakOnHarm: true },
      enraged: { name: 'Enraged', resist: 'WIL', noGuard: true, berserk: true },
      frightened: { name: 'Frightened', resist: 'WIL', fearOf: true }, // won't close with or strike the source
      controlled: { name: 'Controlled', resist: 'WIL', control: true }, // fights for the caster
      confused: { name: 'Confused', resist: 'WIL', confused: true, noGuard: true },
      concentrating: { name: 'Concentrating', ap: -1 }, // holding a Will spell
      steadied: { name: 'Steadied', mindWard: true },
      emboldened: { name: 'Emboldened', attrs: { STR: 1 }, noFear: true },
      resolute: { name: 'Resolute', mindWard: true, attrs: { WIL: 2 } },
      // Body (CON resists the banes).
      enfeebled: { name: 'Enfeebled', resist: 'CON', attrs: { STR: -2 } },
      empowered: { name: 'Empowered', attrs: { STR: 2 } },
      clumsy: { name: 'Clumsy', resist: 'CON', attrs: { DEX: -2 } },
      deft: { name: 'Deft', attrs: { DEX: 2 } },
      // Poison and disease. persist: outlasts the fight (until cured or run its course).
      poisoned: { name: 'Poisoned', resist: 'CON', dot: { CON: 1 }, living: true },
      antivenom: { name: 'Antivenom', immune: ['poisoned'] },
      diseased: { name: 'Diseased', resist: 'CON', attrs: { STR: -1 }, regen: -2, living: true, persist: true },
      // Mystic.
      dread: { name: 'Dread', attrs: { STR: -1, DEX: -1, SPD: -1 }, defense: -1 }, // a death knight's aura
      dazzled: { name: 'Dazzled', resist: 'CON', defense: -1 },
      blinded: { name: 'Blinded', resist: 'CON', defense: -2, blind: true }, // strikes only at range 1
      radiant: { name: 'Radiant', halveShadow: true },
      shrouded: { name: 'Shrouded', shroud: 0.5 }, // missiles at the bearer miss half the time
      spiritShield: { name: 'Spirit shield', mit: { P: 1, S: 1, B: 1 }, vsUndead: true },
    },

    // ---- Terrain (PROVISIONAL, magic overhaul) ------------------------------------------
    // Features on tiles (src/rules/terrain.js). wall: can't be entered; solid: blocks sight and
    // missiles; blocksMissiles: arrows and bolts can't pass; cost: extra squares of movement to
    // enter; slick: a footing roll on entering or fall; pit: fall in (prone, the move ends, and
    // climbing out costs climbCost extra); onEnter/perRound: an element's blow with that
    // magnitude to whoever enters / stands there at the end of the round; flammable: fire burns
    // it away; hidden: unseen by the other side until it springs.
    terrain: {
      stoneWall: { name: 'Stone wall', wall: true, solid: true },
      iceWall: { name: 'Ice wall', wall: true, solid: true, meltsInFire: true },
      brambleWall: { name: 'Bramble wall', wall: true, flammable: true },
      forceWall: { name: 'Force wall', wall: true, blocksMissiles: true },
      fireWall: { name: 'Wall of fire', onEnter: { fire: 3 }, perRound: { fire: 2 }, burns: true },
      windWall: { name: 'Wind wall', blocksMissiles: true, cost: 2 },
      stormWall: { name: 'Storm wall', onEnter: { lightning: 3 } },
      hot: { name: 'Hot ground', onEnter: { fire: 1 }, perRound: { fire: 1 }, burns: true },
      ice: { name: 'Ice', slick: true, cost: 1 },
      charged: { name: 'Charged ground', onEnter: { lightning: 2 } },
      winds: { name: 'Swirling winds', cost: 1, missileMiss: 0.5 },
      rough: { name: 'Rough ground', cost: 1 },
      brambles: { name: 'Brambles', cost: 1, onEnter: { vine: 2 }, flammable: true },
      pit: { name: 'Pit', pit: true },
      rune: { name: 'Rune', rune: true, hidden: true },
      miasma: { name: 'Miasma', perRound: { venom: 1 }, onEnter: { venom: 1 } },
      radiance: { name: 'Radiance', reveals: true, perRound: { light: 1 } },
      lightWall: { name: 'Wall of light', onEnter: { light: 3 } },
      darkness: { name: 'Darkness', blocksSight: true },
      shadowWall: { name: 'Wall of shadow', blocksSight: true, cost: 1 },
      slickFootingTN: 6, // d10 + ⌊(DEX + SPD)/4⌋ ≥ this, or fall
      climbCost: 2, // extra squares to climb out of a pit
      pitDamage: 2, // blunt, to stamina
    },

    // ---- Defense checks: all PROVISIONAL (Outline: "success checks Open") --
    // Success when d10 + bonuses ≥ target number.
    defense: {
      die: 10,
      // + Shield Training rank. PROVISIONAL: smaller shields cover less.
      block: { tn: 3, tnBySize: { buckler: 5, round: 4, heater: 3, tower: 2 } },
      parry: { tn: 6 }, // (opposed: false) + Parry Training rank + floor((DEX−5)/2)
      dodge: { tn: 6 }, // (opposed: false) + Dodge Training rank + floor((SPD−5)/2) − armor DEX penalty
      // PROVISIONAL (the user's call): parries and dodges are opposed rolls. Defender d10 +
      // Training + ⌊(DEX + SPD)/4⌋ vs attacker d10 + ⌊(STR + SPD)/4⌋ + motion penalty (+ for a
      // parry, the attacking weapon's weight classes above the parrying one). Ties: defender.
      opposed: true,
      typicalAttacker: 2, // the AI's guess when it can't see who will attack
      offhandBonus: 1, // a parrying dagger is made to catch a blade
      // PROVISIONAL (the user's call): a power blow can't be parried, only dodged or blocked.
      noParryVsPower: true,
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
    materialHardness: { wood: 1, hide: 1, bone: 1, iron: 2, stone: 2, steel: 3 },
    powerfulShieldQualities: ['masterwork'],
    // Specifics: 10% break chance per point over threshold
    shieldBreakPerPoint: 10,
    // PROVISIONAL: shield wear from a blocked hit = 0.5×P + 0.5×S + 1×B ("blunt wears it most")
    shieldWear: { P: 0.5, S: 0.5, B: 1.0 },
    // PROVISIONAL: tower shields cost 1 square of movement per AP ("slows movement")
    towerMovePenalty: 1,

    // ---- Armor ------------------------------------------------------------
    // PROVISIONAL: base durability per armor type (Outline: durability like HP; numbers Open)
    armorDurability: { padded: 20, leather: 25, mail: 40, scale: 45, plate: 60, fur: 30, chitin: 40, trollHide: 40, scaleHide: 25, frogSkin: 20, sarnakScales: 45, golemStone: 80 },
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
    'Arrows and armor (history): armor catches arrows better than a thrust. Extra piercing protection against arrows: padded +2, leather, mail and scale +1, plate 0. Two arrowheads: broadheads cut terrible wounds (bleed ×1.5) but metal armor (mail, scale, plate) stops them better (+1); bodkins do 1 less damage but slip through metal armor (−2 to its protection). A longbow hit, expected CON (broadhead / bodkin): unarmored 7 / 6, padded 2 / 1.5, mail 2 / 3, scale 1.5 / 2.5, plate 0.4 / 0.8.',
    'Weapons from physics: each weapon has a mass, a length, hands and a point (depth, width), an edge or a head. Damage: point depth/4 piercing; edge (2 + 3√(mass × length × grip)) slashing; head 1 + 6√(head mass × length × grip) blunt. Speed: thrusts cost more with mass, swings with √(mass × length), the longsword costing what the motion table lists. STR adds strBonus × 0.25–0.5 to a thrust (by wound width) and × mass/1.4 (× 1.5 two-handed, up to 1.5) to a swing. A piercing wound bleeds damage × width/4 over 2 + depth/15 rounds.',
    'Ready a thrust: on your turn, hold a long thrust (sword, rapier, spear) ready for its AP; stamina only if it is made. It lasts the pass. A foe whose move this pass brings them closer and into its reach meets it first, struck where they enter the reach (no inside-reach penalty); a hit stops their advance. Guards meet it as usual; it can be aimed at one foe.',
    'Fend off and push back: with a long weapon (reach 2+) a shove reaches 2 squares; a ready shield adds +1. A shove that drives a foe back or floors them also spoils their move that pass.',
    'Ward (verb) and Blink (verb): Ward + Force soaks 3 × magnitude points of spells and missiles; Ward + Wind turns half the missiles aside; Ward + an element halves that element and keeps off its after-effects; Ward + Mind keeps out baits. Blink steps up to 4 squares through walls and out of any hold, roots or webs. Wind blows now hurl a target back 2 squares.',
    'Bait and Read intent (in-combat charm and wisdom): Bait (2 AP on the sheet, within 3 squares) is d10 + ⌊CHA/2⌋ + Feint against d10 + ⌊WIS/2⌋ + Read Attack: the foe\'s guards are drawn out and spent, and they defend at −2 for the rest of the round. Read intent (1 AP, within 4, in sight): the reader rolls d10 + ⌊WIS/2⌋ + Read Attack against 5 + the foe\'s ⌊CHA/2⌋ + Feint, a number they don\'t see. Made it: the foe\'s true intent (what they have committed to this round, feints seen through) and +2 to defend against them and to beat their defenses. Missed by 1–3: nothing to go on. Missed by 4 or more: a confident misread — a false intent and −2 — reported just like a true read. Hex + Mind baits by magic (WIL resists); Bless + Mind gives foresight (true reads of every foe).',
    'Weapon weight and strength (TUNED): a weapon has a natural speed strength can\'t beat (light and short is quick; long travels farther), and a strain: its load (mass for a thrust; mass with the leverage of its length for a swing) over the wielder\'s capacity (0.3 kg per STR point, ×1.5 two-handed, +10% per Heavy Weapon Training rank). Within capacity it swings at its natural speed; past it AP and stamina rise with strain²; past 3× it is too ungainly to use. A man (STR 7) can barely lift a giant\'s club; an ogre swings it like a sword.',
    'Ogre and hill giant; size and grip: big creatures (trait size: ogre 1.5, giant 2.5) take vital wounds less often (the wound roll\'s target ÷ size) and bleed less per wound (÷ size): a man-sized wound is shallow in a big body. Grip (giant 5, ogre 2) adds to grapple rolls: a giant seizes a man in one hand. The ogre (level 8, STR 23, CON 21) swings a crude giant club and its fists; no regeneration. The hill giant (level 12, STR 28, CON 26) swings a giant club one-handed, hurls boulders (range 2–10, 14 blunt, can knock down) and grapples.',
    'Drakes, wyverns, the constrictor and the golem: fliers (drake, wyvern) pass over rough ground, pits, traps, hazards and walls that aren\'t solid (solid walls still stop them) and are slippery to grab. The drake (level 8) has drake scales (P4 S4 B2), a bite, claws, a reach-2 wing buffet that can knock you down, 1.5× movement and fire breath (Burst + Fire, Strong for a bigger one). The wyvern (level 10) has heavier scales (P5 S5 B3), a reach-2 bite, a venomous stinger (3 CON a round over 4 rounds at full depth) and a crushing wing beat. The giant constrictor grapples beyond any human (Grappler III, STR 18) and crushes whoever it holds every round (−8 stamina, −1 CON), but it has one victim at a time and thin scales. The stone golem is immune to magic: spells do nothing to it and it shrugs off conditions; it never tires.',
    'Rats and the spectre: giant rats are weak (STR 3, a third of the stamina) and come alone or as a swarm of six. The spectre is a level-15 undead: incorporeal (weapons without an enchantment pass through; nothing to grab, trip or shove), a legendary war scythe that drinks half the stamina and wounds it deals, and a wail each round that frightens every foe within 2 squares unless they resist (WIL). Magical weapons (high-level gear) and spells hurt it.',
    'Aura of dread and trinkets: at the start of each round, every foe within the aura (2 squares of the death knight) loses 3 stamina and is in Dread for the round (−1 STR, DEX and SPD, −1 to guard). Trinkets are worn items that shift attributes or AP: the death knight\'s flowing black silk sash gives +1 SPD and +1 AP.',
    'End-game gear and the death knight (test build): Legendary quality (+3, durability ×2.2, shield threshold ×2.0) and Adamant shields (×3.5). Battle Casting (feat, adept, needs Casting II): cast with both hands full. An enchanted blade that drinks (Soulreaver): the wielder takes back half the stamina and half the attribute points each blow deals. The death knight is a level-20 character at the human cap (22 feats: Casting IV, Burst, Conjure, Strong, Battle Casting, plate and shield training) in legendary plate with a legendary adamant heater and Soulreaver; Burst + Life + Strong withers a whole area through armor, and Conjure + Life raises the fallen.',
    'Name (modifier): say the target\'s name and a targeted spell (Restore, Bless, Ward, Hex, Beguile) reaches them anywhere on the field, with no range or line of sight; +2 spell points. Companions\' names are known; a foe\'s only if learned (a true name). Restore + Life + Name is the far heal.',
    'Restore (verb) and healing: Restore + a noun undoes that noun\'s harm on an ally (range 2). Restore + Life mends: bleeding stops (poison doesn\'t), 1 CON back (2 with Strong), 4 + 2 × magnitude stamina back (enough to wake the unconscious). Restore + another noun lifts the conditions it inflicts: Venom cures poison, Plague disease, Fire burning, Frost numbness, Will control, Calm calm, Dream a trance, and so on. Wide spreads it to everyone within a square of the target, friend or foe, at half the stamina. Bless + Life stays a boon (Innervated); Strike, Hex and Burst + Life wither. The dead stay dead. The Cleric (arena and gauntlet) is a mage in mail with a mace and Life, Light and Force.',
    'Magic phase 2 (draft): Beguile (verb, WIL resists, 2 rounds) with the mind nouns — Calm (won\'t attack; a blow ends it), Dream (mesmerized: no actions until harmed), Rage (a frenzy: no guards, strikes the nearest body, friend or foe), Fear (won\'t close with or strike the caster), Will (fights for the caster while the caster concentrates, −1 AP). Word Doubling (feat): two nouns instead of a modifier, both do the verb (+2 cost); Rage + Dream makes confusion. Body nouns Swiftness, Might, Grace: a bolt or Hex slows, enfeebles (−2 STR) or makes clumsy (−2 DEX), CON resists; Bless hastens, empowers, makes deft. Venom (poison, 1 CON a round; miasma ground; antivenom boon) and Plague (disease: −1 STR, −2 regeneration, lasts past the fight). Light (sears the undead ×2; dazzles; radiance reveals runes; wall of light), Shadow (blinds — strikes only at arm\'s reach; darkness blocks sight and missiles but not blades; shroud turns half the missiles), Spirit (harms only the undead, ×2; chills the living for half, to stamina; Beguile + Spirit frightens). Conditions now shift every attribute but CON.',
    'Rituals (magic phase 3 draft): Read, Seek, Divine, Speak, Mend, Prepare, Summon, Raise. Each takes time (shortened by Ritualist), spell points (−1 per Ritualist rank) and components (spent win or lose). Roll d10 + ⌊INT/2⌋ + Ritualist (+3 with True Naming and a true name) against the GM\'s tier (easy 6, moderate 8, hard 10, very hard 12, legendary 14): margin 0+ partial, 3+ full, 6+ exceptional; −5 or worse turns on the caster. Information rituals reveal the GM\'s secrets about the subject that the roll could reach (1 / 2 / 3 by outcome). Mend heals 1 / 2 / 4 CON and stops bleeding (exceptional draws out poison and disease). Prepare lays a ward, boon or rune that takes hold when the next fight starts, twice as long.',
    'Wound roll: a blow that reaches the body rolls a d10; on 10 × chance or less it is a vital wound. Piercing chance = depth/100 (dagger 1, swords 2, spear and greatsword 3 on the d10): triple CON damage, double bleeding. Cuts: chance = edge/10: the cut takes its damage again from CON. Armor guards the vitals: padded ×0.6, leather ×0.5, mail ×0.3, scale ×0.25, plate ×0.1 (×1.5 half armor, ×2 partial).',
    'WIL split from WIS (the user\'s call): eight attributes. WIL is resolve: magic defense, resisting fear and compulsion, and stamina regeneration (⌊(CON + WIL)/4⌋ − armor). WIS stays judgment and perception. Older characters get WIL = their WIS.',
    'Monster attributes go past the human range (1–10, 13 with Conditioning feats), up to 30: bears and trolls STR 16–20, a stone golem 22, a troll chieftain 24. The usual formulas apply to the raw number (damage bonus ⌊(STR−5)/2⌋, grappling ⌊STR/2⌋, stamina, death at CON 0).',
    'Monsters (draft): natural weapons are always ready and can\'t be dropped; natural armor can\'t be looted. Traits: knockdown bites, pack bonus (+1 damage per packmate beside the target), venom (poison up to 2 CON a round for 3 rounds, no more than the wound; bandages don\'t stop it), rust (corrodes metal armor and shields), displacement (each attack first rolls a d10 to find the real creature: arrows miss on 1–5, blows on 1–2), springy chitin (a blow that lands costs the attacker 3 stamina), sticky webs (each layer adds 2 AP and 3 stamina to every action, up to two layers; one layer comes loose each round; tear free with d10 + ⌊STR/2⌋ ≥ 8, or burn them), shield-crushing blows, regeneration (unless burned), tireless (undead and constructs: no stamina, damage to attributes, no bleeding or venom), resistances (skeletons: no piercing, half slashing), nimble, slippery, leaping, and boss multipliers on AP, per-pass allowance and stamina.',
    'Magic (overhaul, phase 1): a spell is a verb, a noun and at most one modifier; cost = the sum of the words. Verbs (studied, Magic: words feats) set the shape: Strike (a bolt, range 1–2, magnitude 6), Launch (a bolt, 2–12, 5), Burst (radius 1 at 2–8, 4), Cover (ground hazard, radius 1, 3 rounds), Build (a wall 3 squares across, 3 rounds), Open (a pit), Inscribe (a hidden rune on an adjacent square), Hex (a bane, 3 rounds, resisted), Bless (a boon, 3 rounds), Conjure (a creature for 4 rounds). Nouns (found in the world) set what it is: Fire (burns; hot ground; wall of fire; kindled blades), Frost (slows; ice; ice wall; numbs; frost ward), Lightning (straight through metal armor; shocks; charged ground; storm wall; haste), Wind (hurls back; swirling winds that send missiles astray; wind wall; freedom of movement), Earth (stone; rough ground; stone wall; pits; slows; stoneskin), Vine (thorns that root; brambles; bramble wall; barkskin), Life (withers the living — CON, no armor; withering bane; blessing closes wounds and innervates; raises the dead), Force (knocks down; force wall; shielded). Modifiers: Strong (+3, wound up), Wide (bigger area, longer wall), Long (twice as long), Far (twice the range), Lingering (half now, the rest burns on). Resisting: caster d10 + ⌊INT/2⌋ + Casting against the target d10 + ⌊attribute/2⌋ (DEX/SPD to dodge an area or a pit). Areas and hazards hit friends too. Casting costs 2 base AP (4 on the sheet) unless the verb says more.',
    'Magic feat tiers count feats across all four magic sub-trees (otherwise Casting and Fire Affinity can never pass rank I).',
    'Plate: +1 stamina per action and −3 regeneration (Specifics: +2 and −4), tuned in the arena.',
    'Initiative: d10 + effective SPD.',
    'Defense checks: block is d10 + Shield Training against the shield\'s number. Parry and dodge are opposed rolls: defender d10 + Training + ⌊(DEX + SPD)/4⌋ (armor lowers both) against attacker d10 + ⌊(STR + SPD)/4⌋, +1 for a two-handed swing, +2 for a power swing; a parry also faces +1 per weight class the attacking weapon has over the parrying one. Ties go to the defender. A power blow can\'t be parried, only dodged or blocked.',
    'Parrying dagger: held in the off hand (no shield, no two-handed weapon). It stabs (off-hand thrust) and gives an Off-hand parry (1 AP on the sheet ×2, +1 to the roll) that meets thrusts only.',
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
