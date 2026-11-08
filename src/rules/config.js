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

    // ---- Action points (Specifics, with the user's turn budget) ------------------------
    // AP are counted in tenths: apScale internal units are one AP (apDisplay divides them back for
    // the sheet), so costs can be fractional (a dagger thrust 1.5) with no rounding drift. Rounds
    // 1–8 ran at 2 (pool 10) to keep −1 AP feats from halving a 2-AP thrust; Quick feats now cut a
    // share instead (quickCut).
    apScale: 10,
    apDisplay: 10,
    // Multiplies every base action cost instead of apScale, if set (null = apScale).
    costScale: null,
    // PROVISIONAL (the user's turn budget): at level 1 a turn holds one big action (a two-handed or
    // power swing), a step and a medium action (a swing), or three quick actions (thrust, parry,
    // dodge, block, a step). Pool = apBase + SPD / apSpdDivisor, unrounded: 6 at SPD 5, every point
    // of SPD worth half an AP. (Specifics: 3 + ⌊SPD/2⌋.)
    apBase: 3.5,
    apSpdDivisor: 2,
    apSpdContinuous: true,
    // PROVISIONAL (turn budget): base costs (the Specifics table) up to `knee` stand; every AP above it
    // costs `above`. Thrust, parry, dodge, a step 2; a swing 3 → 4; a two-handed swing 4 → 6; a power
    // swing 2 to wind up + 3 → 4 to release. Weapon speed and strain multiply the result.
    apCurve: { knee: 2, above: 2 },
    // PROVISIONAL (turn budget): a move is a quick action, moveAP for each stretch of up to
    // (1 + ⌊SPD/4⌋) × moveScale squares (4 at SPD 5). null: the Specifics' 1 AP per stretch.
    moveAP: 2,
    // PROVISIONAL: someone who has spent nothing this round may take one action that costs more than
    // their whole pool, as their whole turn, so a tired or armored fighter can always make one big swing.
    wholeTurnAction: true,
    // PROVISIONAL (the user, 2026-11-07): Defer. On your turn, pay `ap` (sheet AP) to let the next one in the initiative
    // order take their turn now; yours resumes after theirs. As often as the AP lasts.
    defer: { ap: 1 },
    // PROVISIONAL (the user's call: armor makes actions dearer): armor's SPD penalty no longer
    // shrinks the pool; every action costs this many AP more per point of it (plate 3 → +0.5,
    // mail 1 → +0.2; the mobility feats lower it). It still slows moving, initiative and
    // dodging. 0: as written (the penalty lowers the pool).
    armorActionAP: 1 / 6,
    // PROVISIONAL: a Quick feat (Quick Thrust, Parry, Block, Dodge, Hands, Heavy Tempo, Casting) at its
    // top rank takes this share off the action's cost, each rank its part (Quick Thrust I–III: −1/6,
    // −1/3, −1/2). null: as written (−1 AP per rank).
    quickCut: 0.5,
    moveBase: 1, // squares per AP = (1 + floor(SPD/4)) × moveScale
    // PROVISIONAL: squares are about an arm's length and a step (the user's reach scale: daggers and
    // one-handed swings 1, one-handed thrusts and two-handed swings 2, two-handed thrusts 3, spears 4), so
    // movement covers twice as many of them as the Specifics formula gives.
    // TUNED (the user, 2026-11-01: Cyrus crossed a courtyard in one round): ×1 and SPD counted unrounded
    // (squares a stretch = round(1 + SPD/4)), was ×2 and ⌊SPD/4⌋. A round spent only moving now carries the
    // presets 4 / 6 / 9 / 12 squares (Beren in plate, Jabiku, Lorc, Cyrus), was 4 / 12 / 12 / 24.
    moveScale: 1,
    moveSpdDivisor: 4,
    moveSpdContinuous: true,
    // PROVISIONAL (the user's turn model): a turn spends as much of the AP pool as the character
    // likes; each action resolves at once; AP kept back pays for reactions (block, parry, dodge, an
    // opportunity strike) on others' turns. No per-pass cap, no passes.
    minActionAP: 0.5, // sheet AP: costs never drop below half an AP (as written: 1) or 0 stamina
    minStrikeAP: 0.5, // floor for weapon strikes specifically (tunable separately)
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
    // (pierceMode and pass-through apply only when CONFIG.pierce is null.)
    passThroughByArmor: { plate: 0.4 },
    // PROVISIONAL (the user's call): a point against armor either bursts through it or must find a gap.
    //   Burst: the blow's punch (Items.weaponStats(...).punch: the mass behind the point; a swung beak or spikes,
    //   the head's mass × the haft's leverage × swingPunch; × the motion's damage multiplier; × (1 + strPer ×
    //   STR bonus); arrows the bow's × the arrowhead's) at least the armor's resist (armor.yaml × material and
    //   origin protect): the point is through, and the piercing past the armor's P mitigation takes the
    //   pass-through roll above, as every point did before. (Sending all of it through made padding nearly
    //   useless: level-1 encounter deaths up by half, sim/FINDINGS.md.)
    //   Gap: otherwise d10 + ⌊DEX/gapDiv⌋ + feats (+ prone, half-sword) ≥ the armor's gap number (armor.yaml,
    //   + coverageGap). natural10: a 10 always finds one (false: skill and feats alone). Through a gap the
    //   armor's P mitigation is bypassed, and (gapPass) the piercing takes the pass-through roll; without
    //   gapPass all of it goes in. A pinned target always gives one, and a half-sword thrust or a pinned or
    //   prone target goes in whole (pronePassThrough).
    //   TUNED (sim, the user's call: "thrusts to find a gap should be less effective"; V4 in sim/FINDINGS.md):
    //   gapPass true, natural10 false. With a whole gap hit and an automatic 10, one lucky thrust killed a
    //   plate wearer outright (28 of mail's 50 wins over plate).
    //   Turned: the point lands as deflectBlunt of its piercing, blunt (then blunt mitigation as usual), and its
    //   weapon takes weaponWear.deflected wear instead of `hit`.
    // A rapier (1.1) bursts padding (0.75) and leather (1.0) but not iron mail (1.6); a spear (1.7) bursts iron
    // mail but not steel (2.0); a heavy spear (3.9, two hands) any mail; nothing a person swings bursts plate (5).
    // null: the pass-through roll above.
    pierce: {
      gapPass: true,
      natural10: false,
      swingPunch: 2.5,
      strPer: 0.1,
      gapDiv: 4,
      feats: { find_the_gap: 2, spot_weakness: 1 },
      prone: 3,
      halfSword: 3,
      coverageGap: { full: 0, half: -2, partial: -4 },
      deflectBlunt: 0.5,
    },
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
    // Materials, origins and enchantments act through Items.weaponStats, either on the
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
      //  Strain = load / capacity. Load: the mass × thrustLoad for a thrust; mass × length/ref
      //  length for a swing (leverage). Capacity: STR × strain.kgPerStr, × grip with both hands on it, × (1 +
      //  strain.perTraining × Heavy Weapon Training). Within capacity the weapon runs at its natural
      //  speed (more STR doesn't make a light weapon faster); past it, AP and stamina × strain^exp;
      //  past strain.max it is too ungainly to use at all. Natural weapons are the body: no strain.
      thrustSlope: 0.3,
      swingSlope: 0.4,
      reachSlope: 0.3,
      strain: { kgPerStr: 0.3, exp: 2, max: 3, perTraining: 0.1, thrustLoad: 0.7 }, // a thrust drives the point, not the whole mass round
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
      armor: { padded: 0.6, leather: 0.5, mail: 0.3, plate: 0.1, fur: 0.8, bogSkin: 0.8, chitin: 0.4, scaleHide: 0.5, scalewardScales: 0.6, trollHide: 0.5, golemStone: 0 },
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

    // ---- Range (PROVISIONAL; weapon reach is weapons.yaml `reach: {swing, thrust, min}`) ----------
    range: {
      // Attacks inside a weapon's reach.min (a spear or greatsword at range 1), or in a clinch with a
      // weapon that isn't closeOK (a sword, a rapier, a spear):
      //   'blunt'  — the blow lands with closeMult of its total force, all as blunt (pommel, haft,
      //              guard); a spear can be jabbed with the shaft (round-6 rule, the user's call)
      //   'cannot' — the attack can't be made; shove, grapple, draw a dagger or use a close technique
      //   'half'   — the attack does half damage (round-2 rule)
      closeRule: 'blunt',
      closeMult: 0.5,
      longRangePenalty: 2, // bows: −2 damage beyond their long range
      maneuverMax: 1, // trips, disarms, grapples, shoves, kicks and punches need range 1
    },

    // PROVISIONAL: a character held in a grapple fights cramped with any weapon, dagger included
    // (the grapple is "inside" even a dagger's reach): the same penalty as range.closeRule.
    grappledWeaponsCramped: true,

    // ---- Getting up (PROVISIONAL, the user's call) ------------------------
    // Standing from prone gets steeply harder in heavier armor. Base AP and stamina by armor
    // (× apScale and × staminaScale; plus the armor's usual stamina penalty). Specifics: 2 AP
    // + 0/0/1/1/2 for padded/leather/mail/scale/plate (scale is now steel mail). The AP is capped at the character's
    // pool, so getting up is always possible, if it takes the whole round. Kip-Up: 1 base AP.
    standUp: {
      ap: { none: 1, padded: 1, leather: 1, mail: 2, plate: 4 },
      stamina: { none: 1, padded: 1, leather: 1, mail: 2, plate: 5 },
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
      jointLock: { attr: 'DEX', points: 1 }, // the Joint Lock feat: what a hold or pin that holds takes
      stamina: { clinch: 3, grapple: 5, pin: 5, throw: 5, break: 3 },
      holdUpkeep: 2,
      bigMargin: 5,
      handles: { mail: 1, plate: 2 },
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
    // long weapon (reaching 3+: a spear, a greatsword, a scythe) shoves at range 2 with the haft or
    // point; shieldBonus — a ready shield adds to the shove.
    shove: { twoHandBonus: 2, farMargin: 5, fendReach: 2, shieldBonus: 1 },
    // PROVISIONAL (the user asked for in-combat charm and wisdom actions): Bait — d10 + ⌊CHA/2⌋
    // + Feint against d10 + ⌊WIS/2⌋: the foe is drawn off balance and defends at
    // −2 for the rest of the round. Read intent (cheap, 1 AP on the sheet) — the reader rolls
    // d10 + ⌊WIS/2⌋ + Read Attack against tn + ⌊CHA/2⌋ + Feint (the foe's, unseen). Made it: the
    // foe's true intent and, for the round, +2 to defend against them and to beat their defenses.
    // Missed by less than misreadBy: nothing to go on. Missed by misreadBy or more: a confident
    // misread — a false intent and −2 — that looks just like a true read. Range: in sight.
    social: { bait: { range: 3 }, readIntent: { range: 4, tn: 5, misreadBy: 4, rounds: 3 }, readBonus: 2 },
    // PROVISIONAL (the user's rulings, 2026-10-24 and 2026-11-02: docs/PROPOSALS.md §1): coming up to the edge
    // of a foe's melee reach is free; the foe may strike at a mover who steps from there to closer still,
    // leaves its reach, or takes a second step within it in one move that brings them no closer (one guarded
    // step is free). Once per foe per move, paid from the foe's AP; a hit stops the mover where they were. At
    // equal reach the one who steps in strikes first; a longer weapon holds a shorter one at its edge.
    opportunityStrikes: true,

    // ---- Wind-up (PROVISIONAL) --------------------------------------------
    // Motions that must be wound up before they can be released: the wind-up costs part of the AP and stamina, the
    // release the rest. While wound up you cannot block or parry. The wind-up is lost if you are knocked prone,
    // grappled, disarmed or drop, or if you haven't released it by the end of the next round.
    windUp: {
      motions: ['power'],
      ap: 2,
      stamina: 1,
      exposed: ['block', 'parry'],
      spells: true, // spells using the Strong modifier must be gathered the same way
      // After releasing in a round you may wind up again that round (a steady archer looses
      // and redraws; a swinger chains blows). Either way you stay exposed.
      rewindAfterRelease: true,
      // PROVISIONAL (the user, 2026-11-01): a wind-up may be released in the same turn, AP allowing (false: not
      // before the next round). Two actions either way; a wind-up made ahead carries over into the next round.
      sameTurn: true,
    },

    // ---- Archery (PROVISIONAL; nothing in the design docs yet) -----------
    archery: {
      strBonus: false, // STR does not add to arrow damage
      parry: false, // arrows can be blocked, not parried (nor dodged: CONFIG.defense.dodgeMeleeOnly)
      // PROVISIONAL (history, the user's call): armor stops arrows better than it stops a thrust
      // at arm's length. Layered textile catches a shaft (padded most); mail is worn over padding.
      // Extra piercing mitigation against arrows only, by armor type.
      vsArrows: { padded: 2, leather: 1, mail: 1, plate: 0, fur: 1, chitin: 1, trollHide: 1, scaleHide: 1, scalewardScales: 2, golemStone: 0 },
      // Arrowheads. Broadheads cut terrible wounds (bleed × bleed) but a broad blade has little punch
      // (× punch against the bow's, CONFIG.pierce); bodkins are narrow armor-piercers that make a smaller
      // wound (damage on the main type) but punch harder: a longbow bodkin bursts mail, a broadhead doesn't.
      heads: {
        broadhead: { name: 'broadhead', ammo: 'arrows', damage: 0, punch: 0.7, bleed: 1.5 },
        bodkin: { name: 'bodkin', ammo: 'bodkins', damage: -1, punch: 1.5, bleed: 1 },
      },
    },

    // ---- Magic (PROVISIONAL) ---------------------------------------------------------
    // Spells are a verb and a noun (the user's spell words, 2026-11-08; docs/PROPOSALS.md §4); cost = sum of word costs.
    magic: {
      // PROVISIONAL. The verb says what happens, the noun what to; each noun's `does` names the shape for each verb
      // (spells.yaml), and spells.yaml `shapes` holds each shape's numbers: mag (magnitude), range [min, max], ap
      // (base AP, else castAP), radius / length / rounds. A modifier scales it: shapes (the shapes it goes on), area
      // (a bolt becomes an area: Wide, Delayed), hidden (a ground spell becomes a rune).
      words: {}, // spells.yaml,
      affinity: { fire: 'fire_affinity' }, // +magnitude per rank
      // PROVISIONAL (the user, 2026-11-08: a name greatly strengthens a spell): Bind + a name adds this to the caster's
      // side of the contest.
      nameBonus: 3,
      // PROVISIONAL: Give + Magic turns the caster's stamina into spell points, this much stamina a point.
      channel: { staminaPerPoint: 3 },
      // Energies the undead fear: light and spirit (Death's harm) do double to them; spirit does nothing to the
      // living beyond a chill (half, to stamina): a ghost's touch never harms attributes (the user, 2026-11-08).
      undeadBane: { light: 2, spirit: 2 },
      // Energies (fire, frost, lightning): armor stops this share of its blunt protection
      // (lightning goes straight through metal); every fireConPer points left cost 1 CON, the
      // rest stamina. Life withers the body: half its magnitude to CON, no armor; the dead and
      // the made (tireless) are past withering.
      energyMitigation: { fire: 0.5, frost: 0.5, lightning: 0.5, light: 0.5, shadow: 0.5, spirit: 0, acid: 0, decay: 0 },
      // PROVISIONAL (the user's spell list): Decay goes past armor and eats it instead: each point of magnitude
      // takes `armor` durability from the armor and `gear` from the shield and the weapon in hand.
      corrode: { armor: 1, gear: 0.5 },
      // Lightning jumps: after a bolt lands, a d10 ≤ chance × 10 sends it on to the nearest other creature within
      // `range` (friend or foe) at `share` of the magnitude, and again from there.
      chain: { chance: 0.5, range: 2, share: 0.5 },
      // Raise + Death: what comes back (the user, 2026-11-08: a skeleton, a zombie or a mummy by feats). Each is a
      // monsters.yaml template; revenant copies the body (no spell raises one now). Lasts the fight; falls if the
      // caster does.
      raise: { skeleton: 'skeleton', zombie: 'zombie', mummy: 'mummy' },
      // Healing (Give + Life). PROVISIONAL. Mends one creature: bleeding stops (not poison),
      // condMag CON back (1; 2 with Strong), stamina + staminaPerMag × magnitude stamina back (which
      // wakes the unconscious). With Wide, every living creature within a square of the target,
      // friend or foe, at areaShare of the stamina. The dead stay dead, but see revive.
      heal: { stamina: 4, staminaPerMag: 2, areaShare: 0.5 },
      // The user (2026-11-04): one who dies in a fight can be called back for `rounds` rounds after the one they died
      // in (three more turns of their own): Raise + Life (or Move + Life given) brings CON back up to `con` and leaves
      // them alive but unconscious, at 0 stamina. After that they are beyond saving there (a priest in town still can).
      // PROVISIONAL (the user, 2026-11-07): a fight won while one of the party is still revivable leaves time to save
      // them: a living companion with a Life spell that calls back the dead, and the points for it, casts it; else
      // the best at `skill` rolls against `tn` (a check name in rules.yaml) to bring them back unconscious.
      revive: { rounds: 3, con: 1, afterFight: { skill: 'medicine', tn: 'moderate' } },
      // PROVISIONAL (the user's Transfer, 2026-11-01): what the target loses, the caster gains: each CON taken mends a
      // point of the caster's own lost CON, or, with none lost, gives this much stamina.
      // PROVISIONAL (the user, 2026-11-07): Transfer aimed at an ally gives instead: ceil(magnitude / 2) points of the
      // caster's own life, each mending a lost CON of theirs (else staminaPerCON stamina), each costing the caster
      // staminaPerCON stamina. It stops bleeding and calls back the revivably dead.
      transfer: { staminaPerCON: 3 },
      castAP: 2, // base, × apScale. PROVISIONAL: at 3, a bolt cost 6 sheet AP for a third of a sword thrust
      poolPerCasting: 3, // spell points = INT + 3 × Casting rank
      // PROVISIONAL (the user, 2026-10-29): a rest after a fight brings spent points back, but each point spent takes
      // this much off the maximum until a long rest, as weariness does stamina. A caster can go hard in a fight and
      // still has only so many fights in a day.
      // TUNED (the user, 2026-10-30: a long rest after clearing an area, about 6 fights): was 0.5, which halved a
      // caster who emptied the pool every fight. At 0.15 the maximum runs 100, 85, 72, 61, 52, 44% fight by fight.
      spWeary: 0.15,
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
        speak: { name: 'Speak', minutes: 30, sp: 3, components: { graveDirt: 1, incense: 1 }, feat: 'ritualist', needs: 'Ritualist', nouns: ['death', 'outsider', 'mind'], reveals: 'speak', subject: 'the dead (Death), an outsider (Outsider) or a beast (Mind)' },
        mend: { name: 'Mend', minutes: 60, sp: 2, components: { herbs: 2 }, feat: 'rite_of_healing', needs: 'Rite of Healing', subject: 'a patient' },
        prepare: { name: 'Prepare', minutes: 30, sp: 0, components: { chalk: 1 }, feat: 'warding', needs: 'Warding', subject: 'a ward, boon or rune laid in advance' },
        summon: { name: 'Summon', minutes: 60, sp: 6, components: { gem: 1, chalk: 2 }, feat: 'binding_circle', verbFeat: 'verb_summon', needs: 'Binding Circle and the verb Summon', needsName: true, subject: 'a creature, by its true name' },
        raise: { name: 'Raise', minutes: 120, sp: 6, components: { graveDirt: 3, candle: 2 }, feat: 'necromancy', needs: 'Necromancy', evil: true, subject: 'a body' },
      },
    },

    // ---- Conditions (PROVISIONAL, magic overhaul) ------------------------------------
    // Timed effects (src/rules/conditions.js). type: the damage keyword it counts as (C.damageMult; a mind
    // condition, resisted by WIL, is 'mind' without saying). Values are per point of magnitude. resistedBy: the
    // attribute a target rolls to shake it off as it lands (d10 + ⌊attr/2⌋ against the caster's
    // d10 + ⌊INT/2⌋ + Casting); living: the tireless (undead, constructs) are immune.
    // Every field is listed in src/rules/effects.js (KEYS.condition); the effect ones (ap, attrs, resist, moveMult,
    // regen, flags…) are read through Effects with the same keys as traits and gear.
    conditions: {
      burning: { type: 'fire', name: 'Burning', dot: { CON: 1 } },
      slowed: { name: 'Slowed', ap: -1, resistedBy: 'CON' },
      hasted: { name: 'Hasted', ap: 1 },
      shocked: { name: 'Shocked', ap: -1, resistedBy: 'CON' },
      rooted: { name: 'Rooted', noMove: true, breakAttr: 'STR', resistedBy: 'STR' },
      numbed: { name: 'Numbed', attrs: { DEX: -1, SPD: -1 }, resistedBy: 'CON' },
      withering: { type: 'life', name: 'Withering', dot: { CON: 1 }, ap: -1, resistedBy: 'CON', living: true }, // Life bane (asystole)
      innervated: { name: 'Innervated', regen: 2 },
      kindled: { name: 'Kindled', kindled: true }, // blows set targets burning
      frostWard: { name: 'Frost ward', resist: { fire: 0.5 } },
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
      baited: { name: 'Baited', resistedBy: 'WIL', defense: -2 }, // guards drawn out; −2 to defend
      reading: { name: 'Reading', read: 2 }, // +2 to defend against and to beat the defense of `vs`
      foresight: { name: 'Foresight', read: 2, all: true }, // reading every foe
      // ---- Phase 2 (draft) -------------------------------------------------------------
      // Mind (WIL resists). breakOnHarm: ends when the bearer takes damage.
      calmed: { name: 'Calmed', resistedBy: 'WIL', noAttack: true, breakOnHarm: true },
      mesmerized: { name: 'Mesmerized', resistedBy: 'WIL', ap: -99, breakOnHarm: true, noAct: true },
      enraged: { name: 'Enraged', resistedBy: 'WIL', noGuard: true, berserk: true },
      frightened: { name: 'Frightened', resistedBy: 'WIL', fearOf: true }, // won't close with or strike the source
      controlled: { name: 'Controlled', resistedBy: 'WIL', control: true }, // fights for the caster
      // PROVISIONAL (the user's spell list): Charm — the bearer takes the caster's side without the caster holding
      // it (no concentration), but any harm breaks it at once.
      enthralled: { name: 'Charmed', resistedBy: 'WIL', control: true, free: true, breakOnHarm: true },
      confused: { name: 'Confused', resistedBy: 'WIL', confused: true, noGuard: true },
      concentrating: { name: 'Concentrating', ap: -1 }, // holding a Will spell
      steadied: { name: 'Steadied', mindWard: true },
      emboldened: { name: 'Emboldened', attrs: { STR: 1 }, noFear: true },
      resolute: { name: 'Resolute', mindWard: true, attrs: { WIL: 2 } },
      // Body (CON resists the banes).
      enfeebled: { name: 'Enfeebled', resistedBy: 'CON', attrs: { STR: -2 } },
      empowered: { name: 'Empowered', attrs: { STR: 2 } },
      clumsy: { name: 'Clumsy', resistedBy: 'CON', attrs: { DEX: -2 } },
      deft: { name: 'Deft', attrs: { DEX: 2 } },
      // Poison and disease. persist: outlasts the fight (until cured or run its course).
      poisoned: { type: 'venom', name: 'Poisoned', resistedBy: 'CON', dot: { CON: 1 }, living: true },
      antivenom: { name: 'Antivenom', immune: ['poisoned'] },
      diseased: { type: 'plague', name: 'Diseased', resistedBy: 'CON', attrs: { STR: -1 }, regen: -2, living: true, persist: true },
      // PROVISIONAL (the user's spell list and magic items).
      chilled: { type: 'frost', name: 'Chilled', resistedBy: 'CON', moveMult: 0.5, attrs: { SPD: -1 }, living: true }, // frost: half the squares
      // PROVISIONAL (the user's spell list: Give + Frost, a curse that stacks): numb and losing stamina each round.
      frostbite: { type: 'frost', name: 'Frostbite', resistedBy: 'CON', dot: { stamina: 2 }, attrs: { DEX: -1 }, living: true },
      // PROVISIONAL (Take + Earth on an ally): floats over pits and hazards, as a flier does.
      levitating: { name: 'Levitating', flying: true },
      paralyzed: { name: 'Paralyzed', resistedBy: 'CON', ap: -99, drainAP: 99, noAct: true, noGuard: true, helpless: true },
      stunned: { name: 'Stunned', resistedBy: 'CON', drainAP: 2, noGuard: true }, // AP lost at once; no guard this round
      riled: { name: 'Riled', mit: { P: 1, S: 1, B: 1 }, breakOnHarm: true }, // a goading blade: until the bearer is hurt
      unseen: { name: 'Unseen', unseen: true }, // can't be picked out beyond arm's reach; striking ends it
      // Feat conditions (feats.yaml: Feign Death, Dirty Trick, Name the Weakness).
      feigning: { name: 'Playing dead', unseen: true, feign: true }, // no foe can aim at them, near or far; acting ends it
      exposed: { name: 'Exposed', noGuard: true }, // no defence this round
      named: { name: 'Weakness named', named: true }, // blows ignore its resistances
      corroded: { type: 'decay', name: 'Corroded', resistedBy: 'CON', dot: { stamina: 2 }, living: true },
      // Mystic.
      dread: { name: 'Dread', attrs: { STR: -1, DEX: -1, SPD: -1 }, defense: -1 }, // a revenant knight's aura
      dazzled: { name: 'Dazzled', resistedBy: 'CON', defense: -1 },
      blinded: { name: 'Blinded', resistedBy: 'CON', defense: -2, blind: true }, // strikes only at range 1
      radiant: { name: 'Radiant', resist: { shadow: 0.5 } },
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
      // near: {element: magnitude}, at the end of each round, to whoever stands within a square (not on it).
      stoneWall: { name: 'Stone wall', wall: true, solid: true },
      dungeonWall: { name: 'Dungeon wall', wall: true, solid: true, permanent: true },
      // The map's own ground (rules.yaml game.ground), carried into a fight on it. Deep water keeps walkers out (fliers
      // cross) but not sight, missiles or a spear's reach; shallows drag at the feet.
      deepWater: { name: 'Deep water', deep: true, permanent: true },
      shallows: { name: 'Shallow water', cost: 1, permanent: true },
      // PROVISIONAL (the fire-goblin mine, 2026-10-31; the user, 2026-11-02): nobody walks into lava (`deadly`: a move
      // can't end in or cross it; fliers pass over). A shove or a fall into it is a Fire 6 blow, and again at each
      // round's end while still in it; whoever is in it can walk out.
      lava: { name: 'Lava', onEnter: { fire: 6 }, perRound: { fire: 6 }, deadly: true, burns: true, permanent: true },
      // A murder hole or a portcullis: nobody passes, but sight, missiles, spells and a spear's reach go through.
      bars: { name: 'Bars', wall: true, permanent: true },
      iceWall: { name: 'Ice wall', wall: true, solid: true, meltsInFire: true },
      brambleWall: { name: 'Bramble wall', wall: true, flammable: true },
      forceWall: { name: 'Force wall', wall: true, blocksMissiles: true },
      // PROVISIONAL (the user, 2026-10-29): a wall of fire can't be walked through, and scorches whoever ends a round
      // beside it (near: an element's blow to anyone within a square of it, once a round however many squares).
      fireWall: { name: 'Wall of fire', wall: true, near: { fire: 2 }, burns: true },
      windWall: { name: 'Wind wall', blocksMissiles: true, cost: 2 },
      stormWall: { name: 'Storm wall', onEnter: { storm: 3 } },
      hot: { name: 'Hot ground', onEnter: { fire: 1 }, perRound: { fire: 1 }, burns: true },
      ice: { name: 'Ice', slick: true, cost: 1 },
      charged: { name: 'Charged ground', onEnter: { storm: 2 } },
      winds: { name: 'Swirling winds', cost: 1, missileMiss: 0.5 },
      rough: { name: 'Rough ground', cost: 1 },
      brambles: { name: 'Brambles', cost: 1, onEnter: { vine: 2 }, flammable: true },
      pit: { name: 'Pit', pit: true },
      rune: { name: 'Rune', rune: true, hidden: true },
      miasma: { name: 'Miasma', perRound: { decay: 1 }, onEnter: { decay: 1 } },
      radiance: { name: 'Radiance', reveals: true, perRound: { light: 1 } },
      lightWall: { name: 'Wall of light', onEnter: { light: 3 } },
      // PROVISIONAL (the user's spell list): darkness hurts and drags at the feet as well as hiding.
      darkness: { name: 'Darkness', blocksSight: true, cost: 1, perRound: { shadow: 1 } },
      acidPool: { name: 'Acid pool', onEnter: { decay: 2 }, perRound: { decay: 1 } },
      gathering: { name: 'Gathering spell', warn: true }, // where a Delayed spell will break
      shadowWall: { name: 'Wall of shadow', blocksSight: true, cost: 1 },
      slickFootingTN: 6, // d10 + ⌊(DEX + SPD)/4⌋ ≥ this, or fall
      climbCost: 2, // extra squares to climb out of a pit
      pitDamage: 2, // blunt, to stamina
    },

    // ---- Defense checks: all PROVISIONAL (Outline: "success checks Open") --
    // Success when d10 + bonuses ≥ target number.
    defense: {
      die: 10,
      // PROVISIONAL (the user's choice, 2026-10-29, against groups snowballing: docs/REVIEW.md Risk 1): cover. When a
      // blow comes at someone who puts up no defence of their own, an ally within `reach` squares of them with a
      // ready shield may block it for them, paid from the bearer's AP and stamina as a block, at −penalty to the
      // block roll. The shield takes the blow (wear, and force past its threshold) and the bearer its impact. null: off.
      cover: { reach: 1, penalty: 1 },
      // + Shield Training rank. PROVISIONAL: smaller shields cover less.
      block: {
        tn: 3, tnBySize: { buckler: 5, round: 4, heater: 3, tower: 2 },
        // PROVISIONAL (the user's call): blocks are contested like parries and dodges, and the
        // easiest of the three: d10 + Shield Training + the shield's size + ⌊(STR + DEX)/4⌋ against
        // the attacker's d10 + ⌊(STR + SPD)/4⌋ + motion. false: the fixed numbers above.
        opposed: true, bySize: { buckler: 1, round: 2, heater: 3, tower: 4 },
      },
      // PROVISIONAL (the user, 2026-11-03: block, parry and dodge differ in kind). The dodge takes the body out of
      // the blow's way: it meets melee blows only (no dodging an arrow or a bolt), and it pays the armor's SPD and DEX
      // penalties again on top of what they take off agility (`dodgeArmor` × them), so it is best unarmored and
      // hopeless in plate. It costs the attacker nothing. (Before: −2 to every dodge, any armor, missiles too.)
      dodgeBonus: 0,
      dodgeArmor: 1,
      dodgeMeleeOnly: true,
      // PROVISIONAL (the user, 2026-11-03): a blow that is blocked or parried rebounds, and the attacker loses this
      // share of the blow's AP cost getting their weapon back: a blocked two-handed swing (6 AP) costs 2, a parried
      // one 1. Recoil feats (Beat) add `perRank` to a parry's share each rank. AP the attacker hasn't got this round
      // comes off their next (`carry`; owed AP count as spent, so a fighter who owes can't take an action dearer than
      // their whole pool). A dodge costs the attacker nothing; a parry beaten through, nothing.
      rebound: { block: 1 / 3, parry: 1 / 6, offParry: 1 / 6, perRank: 1 / 6, carry: true },
      // PROVISIONAL (the user, 2026-11-03): a successful parry opens the attacker to a riposte. Anyone may answer a
      // parry they made with a blow of the parrying weapon at once (a reaction, its AP from their pool, a blow the
      // attacker may defend). The Riposte feat makes it cost no AP. false: only the feat, as a free thrust.
      riposteOpen: true,
      // PROVISIONAL (the user's call): a defence that works still costs stamina, this share of the
      // blow's force: a block most (the arm takes it), a parry some, a dodge none. null: nothing.
      absorb: { block: 0.5, parry: 0.25, offParry: 0.25, dodge: 0 },
      // PROVISIONAL: dodging costs 1 base stamina (Specifics: 2), so a dodge is the cheapest
      // defence in stamina when it works and the block the dearest.
      dodgeStamina: 1,
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
      // PROVISIONAL (the user's magic items: a shield that "can be used to block spells"): an ordinary shield can't
      // block a spell bolt, only dodge it; a shield enchanted with blockSpells can. (Before: any shield stopped a
      // fire bolt whole and took no wear from it.) true: any shield blocks bolts.
      blockSpells: false,
      // PROVISIONAL (the user's call): a parry meets the blow's force with the parrying weapon's
      // own. Force = expected damage (STR is in it). The attacker's side: motion penalty +
      // ⌊attacker SPD / 4⌋ (the blow's quickness) +
      // ⌊max(0, force − mine/2) / per⌋ (+ ⌊max(0, force − mine) / over⌋ when over is set: the overwhelm), where
      // mine = the parrying weapon's best blow in this wielder's hands. No special rule for big
      // creatures: their force does it (a giant's club against a sword is hopeless; against a
      // strong two-hander with Parry Training, a chance).
      // PROVISIONAL (the user's idea, 2026-10-24): the overwhelm moved out of the odds into parryCarry, so a
      // heavy blow isn't counted twice. (Before: over 2.)
      // PROVISIONAL (the user, 2026-11-03): replaced by `leverage`; null. (Was { per: 4, over: null }.)
      parryForce: null,
      // PROVISIONAL (the user, 2026-11-03): a parry is a worse defence than a block, nearing a shield only as the
      // parrying weapon outweighs the blow. The parrier adds max × x / (1 + |x|), rounded, where x = log2 of the
      // parrying weapon's best blow in their hands ÷ the blow's force (both expected damage): equal weapons 0, a
      // greatsword against a sword's swing +1, against a rapier's thrust +2, never as much as max (a heater shield's
      // 3); a sword against a greatsword −1, against a giant's club −2. The attacker's side is the same as against a
      // block or a dodge (⌊(STR + SPD)/4⌋ + motion), so between equal weapons the odds are about what they were.
      leverage: { max: 3 },
      // Skill in a defence: CONFIG.skills.defense (data/rules.yaml skills).
      // PROVISIONAL (the user's idea): a parried swing whose force beats the parrying weapon's carries through,
      // weakened: share × (force − mine) / force of each face lands (rounded down). A parried thrust is stopped:
      // turning a point aside takes little force. motions: which blows can carry through a parry.
      parryCarry: { share: 1, motions: ['swing', 'twoHanded', 'power', 'unarmed'] },
      // Heavier motions are harder to parry/dodge
      motionPenalty: { thrust: 0, swing: 0, twoHanded: 1, power: 2, unarmed: 0, maneuver: 0 },
      // PROVISIONAL: a successful parry or dodge negates the strike fully
      parryNegates: 1.0,
      dodgeNegates: 1.0,
    },

    // ---- Impact (PROVISIONAL, the user's call) -----------------------------
    // Crushing: blunt that gets past armor beyond crushAt (× the target's size) breaks bones:
    //   1 CON per crushPer points over, on top of the stamina it takes.
    // Knockback: a blow that lands throws its target back 1 square per knockbackPer points landed
    //   (blunt in full, cuts and stabs at half), ÷ the target's size, up to knockbackMax squares.
    impact: { crushAt: 8, crushPer: 2, knockbackPer: 8, knockbackMax: 3 },

    // ---- Shields ----------------------------------------------------------
    // PROVISIONAL: wear per block is multiplied by this (fewer hits before a shield fails).
    shieldWearScale: 2,
    // PROVISIONAL: a blocked power attack pushes through: force above the shield's break
    // threshold reaches the bearer as blunt damage.
    powerMotions: ['power'],
    powerPushThrough: true,
    // PROVISIONAL: a blocked power attack breaks the shield outright when the weapon is at
    // least as hard as the shield (materials.yaml hardness), unless the shield's craft is unbreakable
    // (crafts.yaml: masterwork). Hardness also sets how fast a weapon wears on what it strikes
    // (weaponWear): cloth and leather barely touch an edge, metal chews it.
    // Specifics: 10% break chance per point over threshold
    shieldBreakPerPoint: 10,
    // PROVISIONAL: shield wear from a blocked hit = 0.5×P + 0.5×S + 1×B ("blunt wears it most")
    shieldWear: { P: 0.5, S: 0.5, B: 1.0 },
    // PROVISIONAL: tower shields cost 1 square of movement per AP ("slows movement")
    towerMovePenalty: 1,

    // ---- Armor ------------------------------------------------------------
    // Base durability per armor type lives in armor.yaml (Outline: durability like HP; numbers Open).
    // Armor coverage keyword: only `full` is read now (the pass-through of a burst point). Where a piece is worn is
    // its locations (rules.yaml locations, Items.coversOf); half and partial are kept for old saves' sake.
    coverage: {
      full: { mitigation: 0, penalty: 0, passThrough: 0.5 },
      half: { mitigation: -1, penalty: -1, passThrough: 0.6 },
      partial: { mitigation: -2, penalty: -2, passThrough: 0.75 },
    },
    // PROVISIONAL: durability lost per hit = (incoming blunt + slashing converted to blunt)
    // × armorWearScale × the armor's craft wear (padding exempt). Mitigation scales with current/max durability,
    // keeping at least durabilityMitigationFloor of its value until the armor is destroyed.
    // TUNED (sim): full wear let three harmless kicks strip a point of plate mitigation.
    armorWearScale: 0.33,
    // PROVISIONAL (the user's call: armor wears with the intensity of the blows): thrusts wear it
    // too, at this share of their piercing (a point through mail breaks rings). 0: blunt and cuts only.
    armorPierceWear: 0.5,
    // ---- Weapon wear (PROVISIONAL, the user's call) ---------------------------------------------
    // Every weapon has a durability (weapons.yaml × its material's toughness × origin × craft). Wear per
    // blow = the blow's force × rate × fragility × (hardness of what it meets ÷ its own hardness) × craft wear:
    //   hit      the blow lands on armor (metal chews an edge; cloth, leather and flesh barely touch it)
    //   deflected  a point turned by armor it could neither burst nor find a gap in (CONFIG.pierce)
    //   parried  the attacker's weapon, against the parrying weapon
    //   parry    the parrying weapon, against the blow it meets (heavier blows, more wear)
    //   blocked  the attacker's weapon, against the shield
    // A dodge costs a weapon nothing. A worn weapon keeps `floor` of its damage, sliding down as it
    // wears; at 0 it breaks and can't be used until a smith mends it. null: weapons never wear.
    // TUNED (the user, 2026-10-30: "real but not a tedium"; sim/FINDINGS.md): every rate halved and a turned point
    // 1.5× a landed blow (was 2.5×). At 0.4/1.0 a rapier lost about half its life a fight to the Suracayl's scales and
    // broke in two; now about an eighth (a fifth against mail), a longsword about 1%.
    // organic: × wear against an organic material (materials.yaml: hide, chitin, bone, wood…), which gives under an
    // edge where metal chews it (PROVISIONAL, the user, 2026-10-30).
    weaponWear: { hit: 0.2, deflected: 0.3, parried: 0.075, parry: 0.125, blocked: 0.125, organic: 0.5, floor: 0.6 },
    // Warnings shown on a fighter (C.gearWarnings): a weapon at or below this share of its durability, arrows at or
    // below this count for someone carrying a bow.
    gearWarn: { weaponWorn: 0.5, arrowsLow: 5 },
    // How much more a material lasts than iron is its toughness in materials.yaml.
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
      armorStability: { none: 0, padded: 0, leather: 0, mail: 1, plate: 2 },
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
    // PROVISIONAL (the user's call): after a fight, one click rests and mends: `minutes` pass,
    // stamina refills (to the weary maximum), gear gets restRepairFraction back (Field Repair
    // doubles it; broken weapons and shields need a smith). Skipping it keeps stamina where it is.
    // null: the old automatic breather (stamina refilled for free).
    // (the user, 2026-10-28: an hour, so stopping to rest and mend costs time in the dungeon.)
    afterBattle: { minutes: 60 },
    // PROVISIONAL (the user's idea, on trial): every round of combat lowers each fighter's
    // maximum stamina by perRound (up to `cap` of it); only a long rest (camp, inn) clears it.
    // Long fights cost more than their wounds, and the party has a reason to camp. null: off.
    // PROVISIONAL (the user, 2026-10-28): time awake wears too: perHour of fresh stamina each hour (half of it after
    // a 16-hour day: game.exploreDay), sleep excepted, so a day in a dungeon ends in a camp. The cap covers both
    // (was 0.5 for fights alone; a fight reaches it only after 30-odd rounds).
    // PROVISIONAL (the user, 2026-11-01): by effort, not by round. Each point of stamina a fighter spends or loses in a
    // round takes perStamina off the maximum (was a flat 1 a round, so a fight won in one blow wore the whole party as
    // much as a hard one). In sim/FINDINGS.md: a preset fighter spends 8-14 stamina in a median fight and 30-50 in
    // a hard one, so 0.25 costs about what the flat rate did on average (2-3 points), nothing for standing by.
    weariness: { perRound: 0, perStamina: 0.25, perHour: 1 / 32, cap: 0.75 },
    // PROVISIONAL (the user, 2026-11-01: duels too spongy; "more energy = harder swing"): a weapon blow's damage ×
    // `full` from a fighter at full fresh stamina down to × `empty` from one with none left. null: off.
    // 1.25 / 0.75 (sim/duels.js; FINDINGS 2026-11-01): it barely shortens duels (armor takes most of a blow), but a
    // fresh fighter hits a quarter harder and a spent one a quarter softer, so saving stamina pays.
    vigor: { full: 1.25, empty: 0.75 },
    // PROVISIONAL (the user, 2026-10-29): there is no flee roll. The party gets away when, at the end of a round, no
    // foe can reach striking distance of any of them (a wall across the way, or held where it stands) or none could
    // in `outrun` rounds of running, and no foe with a missile or a spell has a clear line to them.
    // TUNED (2026-11-01, with movement halved): 4 rounds (was 2), so the gap to open is as many squares as before.
    disengage: { outrun: 4 },

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
    'Skills (the user, 2026-11-07): twenty skills, 0–10, +1 a rank to the rolls they govern; 10 points at level 1 and 3 a level, spent whenever the party isn\'t fighting. Skills give numbers, feats large benefits; a tree\'s skill unlocks its feats (novice 1, apprentice 3, adept 5, expert 7, master 9). Feats that were only a number became skills. Defences add the gap between the defender\'s skill and the attacker\'s: parry Melee, dodge Evasion + Anticipation, block half of Block; against Melee, Ranged or Arcane.',
    'The spell words (the user, 2026-11-08; docs/PROPOSALS.md §4): a spell is a verb and a noun, 1 to 3 words: a verb alone (Bind holds a foe still, Move steps through space, See reveals), a verb and a noun, either with one modifier, or Summon + Bind + a noun. Verbs: Strike, Give, Take, Move, Raise, Bind, Summon, Shape (not built), See. Nouns: Fire, Frost, Storm, Decay, Force, Earth, Life, Death, Speed, Might, Grace, Mind, Shadow, Magic, Outsider, and a Name you know. Modifiers: Wide, Far, Long, Strong, Hidden, Delayed. Each noun says what each verb makes of it (spells.yaml `does`), and where a verb does two things (Give Fire on a foe burns, on the ground covers it) each is its own spell. Retired: Hex, Bless, Restore, Cover, Ward, Increase, Decrease, Transfer, Launch, Build, Open, Inscribe, Blink, Burst, Beguile, Conjure; Lightning (now Storm), Venom, Acid, Plague (now Decay), Wind, Vine, Light, Bone, Spirit, Veil, Stillness, Calm, Dream, Rage, Fear, Will, Charm; the modifiers Launch, Burst, Lingering and Name, and Word Doubling. Numbers: each shape\'s base in spells.yaml `shapes` (a bolt magnitude 6 at 1–6; a Wide bolt an area of magnitude 4).',
    'Give, Take, Move (the user, 2026-11-01 as Increase, Decrease, Transfer; renamed 2026-11-08): Give puts the noun into a creature or onto the ground (Give Life heals; Give Fire, Frost, Storm or Decay on a foe is a curse that stacks; on the ground a hazard), Take removes it or keeps it off (Take Life harms at arm\'s reach; Take Speed, Might, Grace slow, weaken, make clumsy; Take + an element on an ally lifts what it left and wards against it, halving it; Take Earth opens a pit or makes an ally float; Take Magic lifts every spell on a creature or the ground), Move shifts a creature or a noun (Move Life drains a foe to mend the caster or, aimed at an ally, gives the caster\'s own life: half the magnitude in points, each a lost CON mended or 3 stamina, each costing the caster 3 stamina).',
    'Summoning (the user, 2026-11-08): Summon + an element (Fire, Frost, Storm, Earth) brings an elemental; Summon + Death a ghost; Summon + an outsider\'s name that kind of outsider; nothing else is summoned, and animals and people never are. What comes is simply in the world for 4 rounds: unbound it is frenzied (strikes the nearest body, friend or foe) until a Bind (Bind + Outsider, + Death, + its name) takes hold; Summon + Bind brings it bound. It stands with the caster\'s side, so the caster\'s friends leave it be unless it goes for them. Take + Outsider banishes one (WIL resists).',
    'Ghosts (the user, 2026-11-08): only spells and magical weapons touch one; its touch (Take + Death, a power of its own) passes armor and takes stamina only, half the magnitude, never an attribute: it can exhaust you, not kill you. A shell of force (Give + Force: 3 × magnitude points against spells and missiles) soaks it; a ward of Death (Take + Death on an ally) keeps it off altogether. A named ghost is not built.',
    'Raise (the user, 2026-11-08): Raise + Death on a corpse raises a skeleton; Raise the Flesh (necromancy feat) a zombie; Raise the Wrapped Dead a mummy. It fights for the caster for the rest of the fight and falls when the caster does. Raise + Life calls back an ally dead within the window (CONFIG.magic.revive); Give + Life no longer does. Raise + Earth, Fire, Frost, Storm or Force is a wall.',
    'Bind (the user, 2026-11-08): alone it paralyzes a foe for a round (CON resists); Bind + Mind charms the living (free, ends on harm); Bind + Death commands the undead and Bind + Outsider an outsider (the caster concentrates); Bind + a name holds one whose name the caster knows, +3 to the contest (CONFIG.magic.nameBonus). The old Name modifier, reaching anyone anywhere, is gone.',
    'Traditions (the user, 2026-11-08: no classes, specialization): feat trees whose feats strengthen spells by their words (feats.yaml `spell`): Necromancy (Take and Move Life, Give Death, Take on a foe; zombies, mummies, ghosts, Bind + Death), Devotion (Give Life, Wide Mercy to 2 squares, blessings, Take on an ally, Take Death, Raise Life), Summoning (binding, banishing, longer summons). Living Flame (fire affinity capstone) now brings fire elementals bound.',
    'Saving the fallen after a fight (the user, 2026-11-07): when a fight is won while a party member is dead but still revivable, a companion with a Life spell that calls back the dead and the points for it casts it; failing that, the party\'s best healer makes a Medicine check (moderate) to bring them back unconscious.',
    'Defer (the user, 2026-11-07): on your turn, pay 1 AP to let the next one in the initiative order take their turn now; yours resumes after theirs, with what AP you have left. As often as the AP lasts.',
    'Wind-ups are released in the same turn if the AP is there (the user, 2026-11-01; was: not before the next round): a bow\'s draw and its loose, a power swing\'s wind-up and its blow, a Strong spell\'s gathering and its casting are two actions, both in one turn when the AP allows (Lorc: draw 2, loose 3 of her 6), or the first made ahead and carried into the next round (`windUp.sameTurn`).',
    'Movement (the user, 2026-11-01): a stretch of a move covers round(1 + SPD/4) squares (was (1 + ⌊SPD/4⌋) × 2), so a round spent only moving carries the presets 4 / 6 / 9 / 12 squares, not 4 / 12 / 12 / 24.',
    'Vigor (the user\'s idea, 2026-11-01): a weapon blow\'s damage × 1.25 from a fighter at full fresh stamina down to × 0.75 from one with none left. Spells and shots are untouched.',
    'Reading intent lasts 3 rounds (was 1; 2026-11-01): the AI read every round it could, half a duel\'s actions spent watching.',
    'A staff (the user, 2026-11-01: Jabiku starts with one): a caster\'s focus, so spells can be cast with it in both hands (weapons.yaml `focus`; elsewhere a two-handed weapon needs Battle Casting), and it jabs with its butt end (a blunt thrust, reach 2, from `phys.butt`: 6 against the swung head\'s 8).',
    'The turn budget (the user\'s call): AP pool = 3.5 + SPD/2, unrounded (6 at SPD 5), costs in tenths. At level 1 a turn holds one big action, a step and a medium action, or three quick actions: base costs up to 2 (thrust, parry, dodge, block) stand, every Specifics AP above 2 costs 2 (a swing 3 → 4, a two-handed swing 4 → 6, a power swing 2 + 4, a shortbow 1 + 2, a longbow 2 + 4, trip and disarm 4, grapple, pin and throw 4); weapon speed multiplies the result (a dagger thrust 1.5). A move is a quick action: 2 AP for up to (1 + ⌊SPD/4⌋) × 2 squares. Someone who has spent nothing this round may take one action dearer than the whole pool as the whole turn.',
    'Armor makes actions dearer (the user\'s call): its SPD penalty no longer shrinks the pool; every action costs 1/6 AP more per point of it (plate +0.5, mail +0.2; the mobility feats lower it). The penalty still slows moving, initiative, dodging and fleeing.',
    'Weapon wear (the user\'s call): every weapon has a durability (weapons.yaml × its material\'s toughness × origin × craftsmanship; a rapier 40, a longsword 100, a mace 120). Each blow wears it by its force × rate × fragility (rapier 1.25, mace 0.5) × (what it meets ÷ its own hardness): landing on armor 0.2 (metal chews an edge; cloth, leather and flesh barely touch it), a point turned by armor 0.3, being parried 0.075, parrying 0.125 (by the force of the blow met), being blocked 0.125 (by the shield\'s material); fractions of a point carry to the next knock (TUNED 2026-10-30: was 0.4/1.0/0.15/0.25/0.25 and a rapier\'s fragility 2, which broke a rapier in two fights against scales). Spell points: each spent point takes 0.15 off the maximum until a long rest (TUNED 2026-10-30, was 0.5). A dodge costs nothing. A worn weapon keeps 60% of its damage at the end of its life; at 0 it breaks and is out of the fight until a smith mends it. Thrusts now wear armor too (half their piercing).',
    'After a fight (the user\'s call): one click rests an hour (was 15 minutes) and mends: stamina back to the weary maximum, armor, shields and weapons get 25% back (50% with Field Repair in the party); broken weapons and shields need a smith. Pressing on keeps stamina where it is.',
    'Weariness (the user\'s idea, on trial): each point of stamina a fighter spends or loses in combat lowers the maximum by 0.25 (by effort since 2026-11-01; was 1 a round for everyone), and every hour awake by 1/32 of it (half after a 16-hour day), at most three quarters in all; only a long rest (camp, inn) clears it.',
    'Getting away (the user, 2026-10-29): no flee roll and no pause between rounds. The party is away when, at the end of a round, no foe can reach striking distance of any of them (a wall across the way, or held fast) or none could in 2 rounds of running, and no foe with a missile or a spell has a clear line to them. A wall of fire (Build + Fire) can\'t be walked through and scorches anyone within a square of it for Fire 2 at the end of each round.',
    'Spell points and rest (the user, 2026-10-29): a rest after a fight brings spent points back, but each point spent takes half a point off the maximum until a long rest.',
    'Time in a dungeon (the user, 2026-10-28): a step is 10 seconds and sneaking 20 (seeing the whole temple by the shortest route takes 2.8 h, walking every square about 12, tools/pace.js; a thorough exploration with searches should come close to a 16-hour day), a search 10 minutes. Every 20 minutes there is a 35% chance of drawing from the place\'s wandering table; loud things (forcing, a fight, a trap) count as extra minutes; a sneaking party can let wanderers pass on a stealth check.',
    'Quick feats (Quick Thrust, Parry, Block, Dodge, Hands, Heavy Tempo, Quick Casting) take a share off every such action: half at the top rank (Quick Thrust I–III: −1/6, −1/3, −1/2; Quick Parry I–II: −1/4, −1/2).',
    'Rounds and turns (the user\'s model): a round starts with initiative; each character takes one turn in initiative order and may spend their whole AP pool on it; every action resolves as it is taken. The round ends when everyone has had their turn; unspent AP is lost.',
    'Reactions: defences are not declared ahead. When a blow comes, the target may block, parry or dodge, paying the AP from their pool on the spot (shown with the odds). AP spent on your turn is AP you cannot defend with; a fighter out of AP takes what comes on their armor. A Feint the defender cannot read hides the blow: they choose blind, and a defence that cannot meet it (a parry against a power swing) is wasted. Untouchable: after your first dodge in a round, further dodges that round cost nothing.',
    'Ground on the map (for the temple, 2026-10-24): map letters with a fixed meaning (rules.yaml game.ground): grass and rubble to walk on, deep water no one can walk through (fliers cross it; it stops neither sight, missiles nor reach), shallow water that costs an extra square, plank bridges over the water. A fight on the map keeps its water. A well can be a one-way drop.',
    'Fights draw in their neighbours (for the open courtyard, 2026-10-24): when a fight starts on the map, every other group that is awake, within game.joinDistance (6) squares of the party or of the group it fights (with a clear line), and inside the slice the fight is played on joins it from where it stood. Sleepers sleep on. Beating them settles their squares too. Not simulated: set for the courtyard, to be tried in play.',
    'Opportunity strikes (the user\'s rulings, 2026-10-24 and 2026-11-02): coming up to the edge of a foe\'s melee reach is free; a foe may strike at a mover who steps from there to closer still, leaves its reach, or takes a second step within it in one move that brings them no closer (one guarded step is free). Once per foe per move, from the foe\'s AP; a hit stops the mover at the square they stepped from (AP for squares not walked is refunded). So two swordsmen meet at thrust range (2) and the one who steps in strikes first; closing from there to arm\'s length (1) provokes; a spearman holds a swordsman at 4, and each step nearer provokes again; nobody can step inside a dagger\'s or a fist\'s reach of 1, so coming up to one is free.',
    'Stamina scale ×3: every base stamina cost is tripled. Chosen by simulation so the stamina curve matches the Outline.',
    'Piercing through armor (when a point bursts it, or CONFIG.pierce is off): each leftover point rolls a d10 and reaches CON on ≤ pass-through × 10 (plate 2, other full armor 5). Chosen by simulation over rounding.',
    'Points against armor (the user\'s call): a point bursts armor only if its punch reaches the armor\'s resistance. Punch = the mass behind it (two hands ×1.5; a swung beak or spikes, the head\'s mass × the haft × 2.5) × the motion × (1 + 0.1 × STR bonus); a dagger 0.9, a rondel 1.4, a rapier 1.1 (its flexible blade bends past 1.2), a longsword 1.4, a spear 1.7, a greatsword thrust 3.75, a heavy spear 3.9, a warhammer beak 4 (5.2 two-handed, 6.4 a power blow); arrows by the bow (shortbow 0.8, longbow 1.8) × the head (bodkin 1.5, broadhead 0.7). Resistance: padded 0.75, leather 1, mail 1.3, plate 5 (× material and origin protection: bronze 0.85, steel 1.5, dwarven 1.2). A burst point then takes mitigation and the pass-through roll as before (against plate without its glancing factor: it has gone through). Otherwise it must find a gap: d10 + ⌊DEX/4⌋ + Find the Gap (+2) + Spot Weakness (+1) (+3 prone, +3 half-sword) ≥ the armor\'s gap number (padded 8, leather 8, mail 10, plate 12; half coverage −2, partial −4), skill alone (no automatic 10); a pinned foe always gives one. Through a gap the armor\'s P mitigation is bypassed but the piercing takes the pass-through roll (whole for a half-sword thrust or a pinned or prone foe). Failing that the armor turns the point: half its piercing lands as blunt and the weapon takes the deflected wear (1.0 against 0.4 for a blow that lands). So a rapier bursts padding and leather but not mail; a longsword or a rondel bursts iron mail but not steel; a spear iron mail; a heavy spear any mail; of plate, only a warhammer\'s beak swung two-handed (iron) or with a strong power blow (steel). TUNED (sim, V4 in sim/FINDINGS.md): with whole gap hits and a lucky 10, one thrust killed a plate wearer outright and mail beat plate.',
    'The user\'s armor research (2026-10-20): flexible mail passes 1.5× as much of a cut\'s leftover force as blunt (armor.yaml transmit), so a greatsword power cut breaks bones through it; padding and leather stop a cut unless it carries massive momentum: slashing left after their mitigation beyond 8 (× protection) cuts through (armor.yaml cutThrough); hardened steel protects ×1.5 (was 1.25). Padding is assumed under mail and plate (one piece, no layering).',
    'Plate spreads a blow it turns (the user\'s call): half of the blunt left after its mitigation from a cut or a point (converted cuts, turned points) never reaches stamina; a crushing blow (a mace, a hammer, a club, a fist) carries as before (armor.yaml dissipate {glancing: 0.5, crushing: 0}; less as the plate wears). Spreading crushing blows too left maces 2–13% against plate in the weapon sweep (sim/FINDINGS.md).',
    'Armor wear per hit is a third of (blunt + converted slashing); armor keeps at least 75% of its mitigation until destroyed.',
    'Cover (the user\'s choice, 2026-10-29): when a blow comes at someone who puts up no defence of their own, an ally within a square with a ready shield may block it for them, paying a block\'s AP and stamina, at −1 to the block roll; the bearer\'s shield and arm take it.',
    'Blocks are contested (the user\'s call) and the easiest defence: d10 + Shield Training + the shield (buckler 1, round 2, heater 3, tower 4) + ⌊(STR + DEX)/4⌋ against the attacker\'s d10 + ⌊(STR + SPD)/4⌋ + motion. A dodge was the hardest (−2; since 2026-11-03 it pays the armor\'s penalties again instead). A defence that works still costs stamina: half the blow\'s force for a block, a quarter for a parry, none for a dodge; a dodge costs 1 base stamina (Specifics 2). Untrained against a sword swing: block 72% (a round shield), parry 64%, dodge 55% unarmored, 45% in leather, 36% in mail, 10% in plate (before 2026-11-03: 36% in all but plate, 28%). Bind (feat): a successful parry lets you try a disarm at once.',
    'Range (the user\'s reach): daggers 1; one-handed swords, maces and axes swing 1 and thrust 2; two-handed weapons swing 2 and thrust 3, cramped at 1 (pommel, haft); spears thrust to 4 (the spear and heavy spear cramped at 1, the short spear to 3); the war scythe sweeps 2–3 and does not thrust. Long blades and spears are cramped in a clinch; daggers, clubs, maces and hammers are not, nor are half-swording and the murder stroke. Cramped blows land with half their force, all as blunt. Movement covers twice the Specifics squares.',
    'Weapons in hand: drawing a weapon costs half an AP; dropping one costs nothing; picking one up costs 2. Drawing while holding a weapon drops it (a dagger is sheathed instead). A character held in a grapple fights cramped with any weapon, dagger included: half force, all blunt.',
    'Shove (2 AP, range 1): opposed d10 + ⌊STR/2⌋ (+2 with a two-handed weapon) vs d10 + footing. A win pushes the target back 1 square, 2 on a margin of 5+; if they can\'t move, a margin of 5+ knocks them down.',
    'Wind-up: a power swing, a longbow shot and a Strong spell are wound up (drawn) for 2 AP and released for the rest of the cost, in the same turn or the next round. After releasing you may wind up again in the same round. While wound up you cannot block or parry; the wind-up is lost if you are knocked down, grappled, disarmed or drop, or if you haven\'t released it by the end of the next round.',
    'Shields vs power attacks: a blocked power swing breaks the shield outright if the weapon is at least as hard as the shield (wood < iron < steel) unless the shield is masterwork, and force above the shield\'s break threshold drives through as blunt damage. Every block wears a shield twice as fast as before.',
    'Spear and heavy spear (not in the catalog): spear point 8/0/0, thrusting 2–4, one hand, 1.7 kg; heavy spear the same point, two hands, 2.6 kg, which bursts any mail.',
    'Bows (not in the design docs): every bow is drawn, then loosed (the user, 2026-11-01), a stronger bow dearer for more range and damage (weapons.yaml `draw`): shortbow arrow 5 P, range 2–12, drawn 1 AP and loosed 2 (was 4 AP in one action); longbow 7 P, range 2–16, drawn 2 AP and loosed 4; −2 damage at long range; arrows can be blocked, not parried or dodged (2026-11-03: dodging is for melee blows); no STR bonus; one arrow per shot.',
    'Arrows and armor (history): armor catches arrows better than a thrust. Extra piercing protection against arrows that burst it: padded +2, leather and mail +1, plate 0. Two arrowheads: broadheads cut terrible wounds (bleed ×1.5) but punch weakly (×0.7: a longbow broadhead must find a gap in mail); bodkins do 1 less damage but punch hard (×1.5: a longbow bodkin bursts mail; nothing bursts plate).',
    'Weapons from physics: each weapon has a mass, a length, hands and a point (depth, width), an edge or a head. Damage: point depth/4 piercing; edge (2 + 3√(mass × length × grip)) slashing; head 1 + 6√(head mass × length × grip) blunt. Speed: thrusts cost more with mass, swings with √(mass × length), the longsword costing what the motion table lists. STR adds strBonus × 0.25–0.5 to a thrust (by wound width) and × mass/1.4 (× 1.5 two-handed, up to 1.5) to a swing. A piercing wound bleeds damage × width/4 over 2 + depth/15 rounds.',
    'Fend off and push back: with a long weapon (reaching 3 or more) a shove reaches 2 squares; a ready shield adds +1.',
    'Bait and Read intent (in-combat charm and wisdom): Bait (1 AP, within 3 squares) is d10 + ⌊CHA/2⌋ + Feint against d10 + ⌊WIS/2⌋ + Read Attack: they are drawn off balance and defend at −2 for the rest of the round. Read intent (half an AP, within 4, in sight): the reader rolls d10 + ⌊WIS/2⌋ + Read Attack against 5 + the foe\'s ⌊CHA/2⌋ + Feint, a number they don\'t see. Made it: the foe\'s true intent (what they have committed to this round, feints seen through) and +2 to defend against them and to beat their defenses. Missed by 1–3: nothing to go on. Missed by 4 or more: a confident misread — a false intent and −2 — reported just like a true read. Hex + Mind baits by magic (WIL resists); Bless + Mind gives foresight (true reads of every foe).',
    'Impact: blunt past armor beyond 8 points breaks bones (1 CON per 2 points over, ÷ size for big bodies) as well as winding; a blow that lands throws its target back 1 square per 8 points landed (blunt in full, cuts and stabs at half; ÷ size; up to 3); A parry meets force with force: the attacker adds ⌊(blow − half my weapon\'s blow)/4⌋ + ⌊(blow − my weapon\'s blow)/2⌋ (+ motion) against my d10 + agility + Parry Training — equal weapons parry as before or a little easier; a giant\'s club against a sword is hopeless, against a strong two-hander with Parry Training a chance. Shields already wear by force, shatter past their threshold, and break outright under a power blow from as hard a material.',
    'Weapon weight and strength (TUNED): a weapon has a natural speed strength can\'t beat (light and short is quick; long travels farther), and a strain: its load (mass for a thrust; mass with the leverage of its length for a swing) over the wielder\'s capacity (0.3 kg per STR point, ×1.5 two-handed, +10% per Heavy Weapon Training rank). Within capacity it swings at its natural speed; past it AP and stamina rise with strain²; past 3× it is too ungainly to use. A man (STR 7) can barely lift a giant\'s club; an ogre swings it like a sword.',
    'Ogre and hill giant; size and grip: big creatures (trait size: ogre 1.5, giant 2.5) take vital wounds less often (the wound roll\'s target ÷ size) and bleed less per wound (÷ size): a man-sized wound is shallow in a big body. Grip (giant 5, ogre 2) adds to grapple rolls: a giant seizes a man in one hand. The ogre (level 8, STR 23, CON 21) swings a crude giant club and its fists; no regeneration. The hill giant (level 12, STR 28, CON 26) swings a giant club one-handed, hurls boulders (range 2–10, 14 blunt, can knock down) and grapples.',
    'Drakes, wyverns, the constrictor and the golem: fliers (drake, wyvern) pass over rough ground, pits, traps, hazards and walls that aren\'t solid (solid walls still stop them) and are slippery to grab. The drake (level 8) has drake scales (P4 S4 B2), a bite, claws, a reach-2 wing buffet that can knock you down, 1.5× movement and fire breath (Burst + Fire, Strong for a bigger one). The wyvern (level 10) has heavier scales (P5 S5 B3), a reach-2 bite, a venomous stinger (3 CON a round over 4 rounds at full depth) and a crushing wing beat. The giant constrictor grapples beyond any human (Grappler III, STR 18) and crushes whoever it holds every round (−8 stamina, −1 CON), but it has one victim at a time and thin scales. The golems (clay, stone, iron) share one body and reach-2 fists and never tire; each is immune to two of fire, slashing and blunt and weak (×1.5) to the third, and all three are immune to mind and life magic (resist by damage keyword).',
    'Rats and the spectre: giant rats are weak (STR 3, a third of the stamina) and come alone or as a swarm of six. The spectre is a level-15 undead: incorporeal (weapons without an enchantment pass through; nothing to grab, trip or shove), a legendary war scythe that drinks half the stamina and wounds it deals, and a wail each round that frightens every foe within 2 squares unless they resist (WIL). Magical weapons (high-level gear) and spells hurt it.',
    'Aura of dread and trinkets: at the start of each round, every foe within the aura (2 squares of the revenant knight) loses 3 stamina and is in Dread for the round (−1 STR, DEX and SPD, −1 to guard). Trinkets are worn items that shift attributes or AP: the revenant knight\'s flowing black silk sash gives +1 SPD and +1 AP.',
    'End-game gear and the revenant knight (test build): masterwork dwarven steel plate, a masterwork adamant heater (×3.5) and Soulreaver, a masterwork longsword enchanted with Drinking and Keenness. Battle Casting (feat, adept, needs Casting II): cast with both hands full. Drinking: the wielder takes back half the stamina and half the attribute points each blow deals. The revenant knight is a level-20 character at the human cap (22 feats: Casting IV, Burst, Conjure, Strong, Battle Casting, plate and shield training); Burst + Life + Strong withers a whole area through armor, and Conjure + Life raises the fallen.',
    'Rituals (magic phase 3 draft): Read, Seek, Divine, Speak, Mend, Prepare, Summon, Raise. Each takes time (shortened by Ritualist), spell points (−1 per Ritualist rank) and components (spent win or lose). Roll d10 + ⌊INT/2⌋ + Ritualist (+3 with True Naming and a true name) against the GM\'s tier (easy 6, moderate 8, hard 10, very hard 12, legendary 14): margin 0+ partial, 3+ full, 6+ exceptional; −5 or worse turns on the caster. Information rituals reveal the GM\'s secrets about the subject that the roll could reach (1 / 2 / 3 by outcome). Mend heals 1 / 2 / 4 CON and stops bleeding (exceptional draws out poison and disease). Prepare lays a ward, boon or rune that takes hold when the next fight starts, twice as long.',
    'Wound roll: a blow that reaches the body rolls a d10; on 10 × chance or less it is a vital wound. Piercing chance = depth/100 (dagger 1, swords 2, spear and greatsword 3 on the d10): triple CON damage, double bleeding. Cuts: chance = edge/10: the cut takes its damage again from CON. Armor guards the vitals: padded ×0.6, leather ×0.5, mail ×0.3, plate ×0.1 (×1.5 half armor, ×2 partial).',
    'WIL split from WIS (the user\'s call): eight attributes. WIL is resolve: magic defense, resisting fear and compulsion, and stamina regeneration (⌊(CON + WIL)/4⌋ − armor). WIS stays judgment and perception. Older characters get WIL = their WIS.',
    'Monster attributes go past the human range (1–10, 13 with Conditioning feats), up to 30: bears and trolls STR 16–20, a stone golem 22, a troll chieftain 24. The usual formulas apply to the raw number (damage bonus ⌊(STR−5)/2⌋, grappling ⌊STR/2⌋, stamina, death at CON 0).',
    'Monsters (draft): natural weapons are always ready and can\'t be dropped; natural armor can\'t be looted. Traits: knockdown bites, pack bonus (+1 damage per packmate beside the target), venom (poison up to 2 CON a round for 3 rounds, no more than the wound; bandages don\'t stop it), rust (corrodes metal armor and shields), displacement (each attack first rolls a d10 to find the real creature: arrows miss on 1–5, blows on 1–2), springy chitin (a blow that lands costs the attacker 3 stamina), sticky webs (each layer adds 2 AP and 3 stamina to every action, up to two layers; one layer comes loose each round; tear free with d10 + ⌊STR/2⌋ ≥ 8, or burn them), shield-crushing blows, regeneration (unless burned), tireless (undead and constructs: no stamina, damage to attributes, no bleeding or venom), resistances (skeletons: no piercing, half slashing), nimble, slippery, leaping, and boss multipliers on AP and stamina.',
    'Magic feat tiers count feats across all four magic sub-trees (otherwise Casting and Fire Affinity can never pass rank I).',
    'Plate: +1 stamina per action and −3 regeneration (Specifics: +2 and −4), tuned in the arena.',
    'Initiative: d10 + effective SPD.',
    'Defense checks: parry and dodge are opposed rolls: defender d10 + Training + ⌊(DEX + SPD)/4⌋ (armor lowers both) against attacker d10 + ⌊(STR + SPD)/4⌋, +1 for a two-handed swing, +2 for a power swing. Ties go to the defender. A power blow can\'t be parried, only dodged or blocked. Blocks: see above.',
    'Block, parry and dodge differ in kind (the user, 2026-11-03). Block: the best odds (the shield\'s size), and the blow rebounds: the attacker loses a third of the AP the blow took. Parry: no shield, so worse odds, by leverage: + 3 × x / (1 + |x|), rounded, x = log2(my weapon\'s best blow ÷ the blow\'s force), 0 between equal weapons, toward +3 (a heater\'s worth) as mine outweighs the blow, toward −3 as it is outweighed (this replaces the force term); the blow rebounds a sixth of its AP (Beat, a new feat: another sixth per rank); and a successful parry opens a riposte, a blow of the parrying weapon at once for its AP, which the attacker may defend (the Riposte feat makes it cost no AP; before, only the feat, a free undefended thrust). Dodge: melee blows only (no arrows or bolts), pays the armor\'s SPD and DEX penalties again (−2 dropped), negates the blow and costs the attacker nothing. AP a rebound takes that the attacker hasn\'t got come off their next round, and a fighter who owes can\'t take an action dearer than the whole pool.',
    'Parrying dagger: held in the off hand (no shield, no two-handed weapon). It stabs (off-hand thrust) and gives an Off-hand parry (1 AP on the sheet ×2, +1 to the roll) that meets thrusts only.',
    'A successful parry or dodge negates the strike\'s damage completely (a parry still costs stamina, see blocks).',
    'Actions cannot be paid if they would drop your own stamina to 0.',
    'Unconscious characters do not regenerate in combat. Heavy-armor negative regen always applies.',
    'Excess blunt beyond remaining stamina is lost; later hits go to attributes.',
    'Blunt damage on an unconscious target goes to CON.',
    'Items (the user\'s call): every weapon, armor piece and shield is a type plus a material (materials.yaml: cloth, leather, bronze, iron, steel; exotic spider silk, dragon hide, star iron, adamant), an origin (origins.yaml: common, elven, dwarven, goblin: how weight trades against durability, damage and protection), a craftsmanship (crafts.yaml: poor, average, masterwork: how fast it wears and how easily it breaks, never its damage or protection) and enchantments (enchantments.yaml; usually none). Armor tiers: padded, leather, mail, plate (scale is folded into steel mail). Old saves: quality crude → poor, standard and fine → average, masterwork and legendary → masterwork.',
    'Armor durability: padded 20, leather 25, mail 40, plate 60 (× material toughness, origin, craftsmanship and coverage; padding takes no wear).',
    'Parry carry-through (the user\'s idea, 2026-10-24): a parried swing whose force (its expected damage) beats the parrying weapon\'s own best blow carries through, weakened: (force − mine) / force of each face lands. A parried thrust is stopped. The overwhelm term left the parry odds (parryForce.over 2 → none), so a heavy blow isn\'t counted twice; force still makes a parry harder (parryForce.per). A rapier parrying a greatsword cut keeps off about half of it when the parry succeeds; a sword against a giant\'s club, almost none.',
    'Wounds by location (armor by location, step 3; rules.yaml locations.wounds): every blow at a body rolls where it lands (d100 by share) unless aimed. A cut\'s points take attributes from the location: head CON/INT/WIL, torso CON/STR, arms STR/DEX/CON, hands DEX/STR, legs SPD/CON, feet SPD (a point that goes in still takes CON). The wound roll\'s odds × head 2, torso 1.5, arms 0.4, legs 0.7, hands and feet 0 (weighted by share to 1, so overall lethality is unchanged). Per point of wound there: arms 8% and hands 15% to drop the weapon in hand, legs 8% and feet 10% to fall; per point of blunt on the head 10% to be stunned (CON resists). The AI counts these when it chooses where to aim; aiming is offered against anyone.',
    'Aimed blows (armor by location, step 2): a strike may name a location (a Location menu beside the attack; the AI and the menu default to the place worth most: the blow\'s value there × the chance it lands against the target\'s best defence). Aiming costs against a defence: head 2, arms 1, hands 2, legs 1, feet 3, torso 0 (a thrust one less); a shield blocks blows aimed at the torso or arms 1 more easily. An aimed blow lands where it was aimed (no location roll). Offered only against someone whose locations differ (rules.yaml locations.aim).',
    'Armor by hit location (the user\'s choice, 2026-10-24; docs/PROPOSALS.md §2, step 1): six locations (head 8%, torso 40%, arms 18%, hands 5%, legs 24%, feet 5% of the body: rules.yaml locations), which are also the armor slots. A piece covers some of them, protects fully there, and carries that share of its type\'s weight, penalties, durability and price; a coverage keyword reads as locations (half = torso, arms, legs; partial = torso). A blow against a body whose locations differ rolls d100 for where it lands; the AI sees the expectation over them. A cut that gets through a limb or the head (bare, or cutting through cloth or leather) carries the slashing beyond 3 into the next location (arm → torso or head, hand → arm, leg → the other leg, foot → leg), whose armor meets it. Before: half coverage was −1 mitigation and −1 penalties everywhere, gap −2; partial −2.',
    'Shield wear per block = ½P + ½S + B.',
    'Kick: opposed d10 + ⌊STR/2⌋; a kick knocks down only on a win by 3 or more. Trip wins on any margin.',
    'Disarm: d10 + ⌊DEX/2⌋ opposed (+2 for a two-handed grip). Grapple: d10 + ⌊STR/2⌋ + Grappler rank vs. d10 + ⌊max(STR,DEX)/2⌋.',
    'Prone: +1 damage to attacks against you, +1 AP on your defenses, no dodging. Grappled: +1 AP on defenses, no movement.',
    'Trip and disarm each cost 3 base AP (4 on the turn-budget curve) and 2 base stamina.',
    'Grappling ladder: free → clinch → hold → pin, each step a directly opposed d10 roll (⌊STR/2⌋ + Grappler; breaking free may use ⌊max(STR, DEX)/2⌋ + Escape Artist). Win by 5+ for two steps; lose by 5+ and it can reverse. Clinch: both cramped with long weapons, no two-handed swings or bows, no stepping away without a break. Hold: the held fighter can\'t move and fights cramped with every weapon, dagger included; the holder keeps a dagger hand and can drag them a square. Pin: the pinned fighter can only try to break; piercing and a Coup de Grâce dagger go through their armor. Throw: from a hold or pin, prone a square away. Armor is easy to grab (+1 mail, +2 plate to grapple and pin) but hard to throw (footing +1 / +2). Costs in base AP / stamina: clinch 2 / 3, grapple, pin and throw 3 / 5, break 2 / 3, and 2 stamina a round to keep a hold.',
    'Getting up from prone, base AP / stamina by armor: none, padded or leather 1 / 1; mail 2 / 2; plate 4 / 5 (on the turn-budget curve: plate is 6 AP, the whole of an SPD-5 turn). Never more AP than your pool. Kip-Up: 1 AP.',
    'Movement costs only the armor stamina penalty, once per move action.',
    'Bandage: 4 AP (1 AP with Field Dressing) and uses one bandage.',
    'Long rest repairs 25% of max armor and shield durability (+25% with Field Repair).',
    'Daggers get −1 AP on thrusts and swings ("lowest AP").',
    'Spell bolts and shields (the user\'s magic items, 2026-10): an ordinary shield can\'t block a spell bolt (and since 2026-11-03 it can\'t be dodged either: dodging is for melee blows); a shield enchanted with Spellcatching can, and a weapon with parrySpells can parry one. Before, any shield stopped a fire bolt whole and took no wear from it.',
    'Magic items (the user\'s list, 2026-10): worn things (head, neck, shoulders, cape, arms, hands, two rings, legs, boots; the chest is the armor) and enchantments carry effects (attributes, AP, ×AP on every action, regeneration, stamina, spell points, magnitude, initiative, to beat a defence, squares per move, elemental resistance, auras, retaliation, bane damage, disposition, healing per rest), weapon on-hit effects (conditions, a burning blow, sapping STR and stamina, eating armor, Riled: +n mitigation until next hurt) and powers (a spell cast with no spell points, free hand or backlash, from charges that come back each long rest). Placeholder names; numbers untested by sims.',
    'Companions (the user\'s idea): Familiar (magic, casting I) and Animal Companion (perception, Keen Eye I) give a creature that fights beside its owner, run by the AI, wounds kept between fights (rules.yaml game.companions). A familiar adds 2 spell points per rank while it lives; its death costs the owner 2 WIL. A dead companion is replaced after a rest in town.',
    'Fear: a frightened creature run by the AI moves away from what frightens it while within 3 squares (before: it only could not close with or strike it). Shoves, throws and knockback stop at walls, and the squares a body is driven into count as entered (pits, runes, fire).',
    'Very light and light weapons count as "light weapons" for Light Touch and Precision.',
    'Lava (the fire-goblin mine, 2026-10-31; the user, 2026-11-02): Fire 6 on entering and at each round\'s end in it. Nobody walks into lava they can see (a route neither ends in nor crosses it; fliers pass over); only a shove or a fall puts someone there, and they can walk out. Other visible hazards are gone round when there is a way round, and a move onto or across one takes a second confirmation.',
  ];

  G.CONFIG = CONFIG;
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
