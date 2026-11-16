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

    // ---- Stamina (PROVISIONAL, docs/OVERHAUL.md step E) -------------------------------------------------
    // Stamina is exertion: what a fighter spends on actions, and what blunt that breaks nothing winds (wounds.winding).
    // It is no life pool. Max stamina = stamina.base + STR + SPD + DEX, the same order for everyone; CON and WIL set
    // how fast it comes back (stamina.regen).
    // PROVISIONAL (step F): fatigue adds a share of an action's ticks below half stamina, more below a quarter.
    fatigueSteps: [
      { below: 0.5, share: 0.2 },
      { below: 0.25, share: 0.4 },
    ],
    // PROVISIONAL: an action cannot be paid if it would take you to 0 stamina
    // (otherwise characters could exert themselves unconscious).
    exertionCanKnockOut: false,
    // PROVISIONAL (the tuning plan's rulings R1 to R3, the user, 2026-11-11; step E's plain numbers):
    //   base        max stamina = base + STR + SPD + DEX (+ gear; × a creature's staminaMult).
    //   regen       R1. Each beat, struck or not: ⌊(CON + WIL) × per⌋ − the armor's regen penalty (+ gear, conditions,
    //               hero mode) in a beat the fighter lost no stamina to a blow, `struck` of it (rounded up, at least
    //               1) in a beat they did. Heavy armor's negative regeneration is whole every beat.
    //   spent       R2. An action whose stamina the fighter can't pay is taken spent instead of refused: it takes
    //               stamina down to 1 at most, the defender gets `attack` on its roll against a spent blow (and the
    //               blow lands at vigor.spent), and a defence taken spent is `defense` worse. null: refused.
    //   collapse    R3. Stamina 0 is a collapse: prone, no actions or reactions until the beat ends and
    //               beats − ⌊WIL / perWil⌋ more (WIL brings them round sooner; Second Wind: none), then the fighter
    //               comes round with one beat's regeneration (at least 1) and must stand.
    stamina: {
      base: 20,
      regen: { per: 0.75, struck: 0.5 },
      spent: { attack: 2, defense: 2 },
      collapse: { beats: 2, perWil: 5 },
      // The AI's weights for these rules (judgement, not rules; here so a sim can --set them). finish: a blow at a
      // collapsed foe against the same at a standing one, `now` when they come round at this round's end, `later` when
      // they stay down a round more. spentWorth: a spent blow is thrown only if it is worth this much (hitValue's
      // units: a likely kill is 60, a likely collapse 40), else the fighter steps back or stands to get its breath.
      ai: { finish: { now: 1.25, later: 0.95 }, spentWorth: 30 },
    },

    // PROVISIONAL (the tuning plan's ruling R8, the user, 2026-11-11; sim/FINDINGS.md "Re-tuned on the new rules"): the
    // swing's setting. A swung edge or head (a weapon's swing, two-handed or power blow; not a fist, a bash or a natural
    // weapon) that drops its target, or passes it (dodged, or the target already down when it lands), carries on into
    // one more foe within the blow's reach and beside the first (a square away), at `force` of its damage and punch
    // (`heavy` for a two-handed or power blow). That foe defends against it as against any blow; it costs nothing more
    // and carries no further. null: off.
    sweep: { force: 0.5, heavy: 0.75, motions: ['swing', 'twoHanded', 'power'] },
    // PROVISIONAL (docs/PLAN.md step 9; the Reaper capstone, docs/PROPOSALS.md 3.2 "a swing at every foe in reach"): the
    // Whirlwind feat adds to every swung edge or head of a two-handed weapon (a swing or two-handed blow, not a power
    // blow) a Whirlwind option at `ticks` times its ticks and `stamina` times its stamina: the blow lands as
    // made on its target, then at `force` of its damage on every other foe the blow reaches, each defending for itself.
    // null: the feat does nothing.
    whirlwind: { ticks: 1, stamina: 1.5, force: 0.75 },

    // ---- The clock (docs/OVERHAUL.md step F; PROVISIONAL) --------------------------------------------------
    // There are no rounds, turns or AP. Time is counted in ticks; every fighter has a clock, and whoever's clock is
    // lowest takes one action, whose cost is added to their clock. Ties: higher SPD, then gear's `init`, then a d10
    // rolled once at the fight's start. An action's cost is its base (data.js MOTIONS and ACTIONS `ticks`: a one-handed
    // swing is 10, the standard action) × the weapon's speed and strain × the SPD factor × gear's costMult ÷ a body's
    // tempo, plus armor, Quick feats (minus), webs, an arm wound and fatigue (a share of the rest), rounded once at
    // the end, never under `min`.
    //   spd       the SPD factor: (base + 5 × per) / (base + SPD × per): SPD 4 ×1.1, SPD 6 ×0.92, SPD 8 ×0.79
    //   armor     ticks added to every action a point of the armor's SPD penalty (mail +0.5, plate +1.5)
    //   quick     ticks a Quick feat takes off its actions a rank (Quick Thrust I–III: a thrust 5 → 4, 3, 2)
    //   stretch   a move: ticks for each stretch of `pace` squares (round(1 + SPD/4), the mobility and leg wounds),
    //             plus the armor's ticks once (Character.moveTicks): about 2 a square at SPD 5
    //   lead      an action's ticks are split: `lead` before it takes effect and the rest (recovery) after. The share
    //             is data.js's (`lead` on a motion or an action; a bow's draw; a Strong spell's gathering). A committed
    //             fighter can be struck, shoved or stepped away from; knocked down, grappled, disarmed or put down,
    //             the action is spoiled (Combat.spoil).
    //   exposes   a power blow, a drawn bow and a Strong spell leave the fighter unable to block or parry while
    //             they are committed (the lead)
    //   overreach a fighter whose clock is more than this many ticks past now can't react: a block, parry, dodge,
    //             cover, riposte or opportunity strike adds its ticks to the reactor's clock
    //   beat      everything that happens "each round" happens each beat, a fixed number of ticks kept by the
    //             timeline (Combat.beat): bleeding, regeneration, conditions' durations (in beats), terrain, holds,
    //             auras, groups joining, the getting-away check. TUNED (step F): 14, started at 20 as the plan says.
    //             A round's AP was about 14 ticks of actions (5.5 AP at 2.5 ticks an AP), so 14 keeps every per-round
    //             number (regeneration, bleeding, a condition's length) at the rate per action it was tuned at; at 20
    //             heroes ran out of breath and waited a third of their time in reach of a foe, and the court was
    //             cleared 3 times in 10 against 6 (docs/overhaul/F-report.md).
    //   surprise  a side caught off guard starts this many ticks late
    //   die       the tie-break die, rolled once at the start
    //   rebound   a blow blocked or parried costs the attacker this share of its ticks (block, parry; Beat adds
    //             perRank a rank to a parry's), added to their clock
    clock: {
      spd: { base: 3, per: 0.5 },
      armor: 0.5,
      quick: { quick_thrust: 1, quick_parry: 1, quick_block: 1, quick_dodge: 1, quick_hands: 1, heavy_tempo: 2, quick_casting: 1, quick_draw: 1 },
      stretch: 5,
      min: 1,
      exposes: { motions: ['power'], bows: true, strongSpells: true, guards: ['block', 'parry'] },
      overreach: 10,
      beat: 14,
      surprise: 10,
      die: 10,
      rebound: { block: 1 / 3, parry: 1 / 6, offParry: 1 / 6, perRank: 1 / 6 },
      command: 3, // Command (a feat): ticks a friend's clock comes sooner
      moveMax: 14, // a move is at most the squares this many ticks carry (a beat's walk)
      veryLight: 2.5, // ticks off a very light weapon's thrust or swing (hand-set table weapons only: physics has speed)
    },
    minStrikeStamina: 0, // floor for weapon strikes' stamina
    // Squares in a stretch of a move = round(moveBase + SPD / moveSpdDivisor) (+ Fleet Foot, − a tower shield, ×
    // moveMult, − a leg wound, + boots). Squares are about an arm's length and a step (the user's reach scale); a move
    // counts every second diagonal step as two (Combat.steps); reach and range are rounded Euclidean (Combat.dist).
    moveBase: 1,
    moveSpdDivisor: 4,

    // ---- Damage (Specifics) ----------------------------------------------
    motionMultiplier: { thrust: 1.0, swing: 1.0, twoHanded: 1.3, power: 1.6 },
    heavyMultiplierAdjust: { thrust: -0.2, swing: 0, twoHanded: 0.2, power: 0.2 },
    // Slashing→blunt conversion by motion (Specifics)
    conversion: { thrust: 0.2, swing: 0.33, twoHanded: 0.5, power: 0.66 },
    // STR bonus: +floor((STR − 5)/2) to the main damage type
    strBonusPivot: 5,
    strBonusDivisor: 2,
    // PROVISIONAL (docs/OVERHAUL.md step A): a point against armor goes through or is turned, by the blow's punch and
    // its margin (rules.yaml contest). Punch (Items.weaponStats(...).punch: the mass behind the point; a swung beak
    // or spikes, the head's mass × the haft's leverage × swingPunch; × the motion's damage multiplier; × (1 + strPer
    // × STR bonus); arrows the bow's × the arrowhead's), as a share of the armor's resist where it lands (armor.yaml ×
    // material and origin protect), gains perMargin per point of margin; at 1 or more the point is through, and the
    // piercing past the armor's P mitigation goes into the body whole. Below, the armor turns it: deflectBlunt of its
    // piercing lands as blunt (then blunt mitigation as usual), and its weapon takes weaponWear.deflected wear.
    // Margin for this only (not the vital wound): Find the Gap and Spot Weakness (feats), a prone target, a
    // half-sword thrust. A pinned or helpless target: always through, and past the P mitigation (in at a gap).
    // At 0.13 a point with half the punch it needs gets through at a margin of 4, one with a seventh (a level-1
    // spear against steel plate) at 7.
    pierce: {
      swingPunch: 2.5,
      strPer: 0.1,
      perMargin: 0.13,
      feats: { find_the_gap: 2, spot_weakness: 1 },
      prone: 3,
      halfSword: 3,
      deflectBlunt: 0.5,
    },
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
      // PROVISIONAL (the user, 2026-11-09: the longsword is the generalist; blunt swings are best against armor and
      // the undead, spear and rapier thrusts against the living; not yet simmed). edgeBlunt: a swung edge's blunt,
      // edge × this × √(mass × length × grip) (it was a seventh of the cut): longsword 3, rapier 1, battle axe 4, great axe 6 (a warhammer 6 in one hand, a staff 10 in two).
      // buttDamage: a staff's butt jab (it used headDamage: 6 blunt for 1.9 AP, a warhammer's blow). thrustHeavy: a
      // bladed point (one with an edge behind it; spears are held at the balance) heavier than `ref` kg (÷ grip in two hands) is slower to drive: + slope × (mass/ref − 1).
      edgeBlunt: 2.2,
      buttDamage: 2.5,
      thrustHeavy: { ref: 1.1, slope: 0.6 },
      hiltDamage: { base: 2, k: 2 },
      // Weight class (stamina factor, Heavy Weapon Training) from mass, kg upper bounds.
      weightClass: [[0.5, 'very light'], [1.2, 'light'], [1.8, 'medium'], [Infinity, 'heavy']],
      // STR adds strBonus × this (rounded toward zero). A sharp point needs little force (rapier
      // ≈ 0.3, broad spearhead 0.5); a swing needs mass and grip (mace 1, greatsword 1.5).
      str: { thrustBase: 0.25, thrustWidth: 0.25, swingRefMass: 1.4, max: 1.5 },
      // Bleeding: a piercing wound bleeds by its point's width / bleedWidth (CONFIG.wounds.bleed).
      bleedWidth: 4,
    },
    // ---- Vital wounds (PROVISIONAL, docs/OVERHAUL.md step A) -------------------------------------------------
    // A point or a cut that reaches the body is a vital wound (neck, heart, a big artery) when the blow's margin is at
    // least the threshold where it landed (rules.yaml wounds.vital), + armor[type] of the piece there (a
    // pinned body's armor guards nothing: pinnedOpensArmor), − round(lower × the blow's wound.vital) (its depth or
    // edge: Items.weaponStats), + round(perSize × (size − 1)) for a big body. A vital wound is a step more severe and
    // bleeds more (CONFIG.wounds). Undead and constructs have none.
    // wound.vital itself: piercing depth × perDepth (at most max), a cut cut × edge, a natural weapon natural.
    vital: {
      perDepth: 0.01, max: 0.4, cut: 0.1, natural: 0.1,
      lower: 10,
      armor: { padded: 1, leather: 1, mail: 2, plate: 6, fur: 0, bogSkin: 0, chitin: 2, scaleHide: 1, scalewardScales: 1, trollHide: 1, golemStone: 99 },
      otherArmor: 1,
      perSize: 4,
      pinnedOpensArmor: true,
    },

    // ---- Weight (Specifics) ----------------------------------------------
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

    // ---- Flanking (PROVISIONAL, the overhaul, step B) -----------------------
    // A defence against a blow is at −penalty while another foe on its feet that threatens the defender stands on
    // the far side (bearings more than 120° apart), unless the square beside the defender towards that foe holds a
    // wall or a standing ally of theirs (Combat.flanked). No facing.
    flank: { penalty: 2 },

    // PROVISIONAL: a character held in a grapple fights cramped with any weapon, dagger included
    // (the grapple is "inside" even a dagger's reach): the same penalty as range.closeRule.
    grappledWeaponsCramped: true,

    // ---- Getting up (PROVISIONAL, the user's call) ------------------------
    // Standing from prone gets steeply harder in heavier armor. Base ticks and stamina by armor (plus the armor's
    // usual stamina penalty); half of it is the lead (still on the ground until it is done). Kip-Up: 3 ticks.
    standUp: {
      ticks: { none: 3, padded: 3, leather: 3, mail: 5, plate: 15 },
      stamina: { none: 3, padded: 3, leather: 3, mail: 6, plate: 15 },
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
    // Grappling is exhausting: base stamina per step, and holdUpkeep at the end
    // of every round you hold or pin someone; a holder who can't pay lets go.
    grappling: {
      jointLock: { place: 'arms', points: 2 }, // the Joint Lock feat: the harm a hold or pin that holds does (Character.harm)
      stamina: { clinch: 9, grapple: 15, pin: 15, throw: 15, break: 9 },
      holdUpkeep: 6,
      bigMargin: 5,
      handles: { mail: 1, plate: 2 },
      throwDamage: 3,
      pinBonus: 2, // Pin feat
      dogpile: { perAlly: 1, withFeat: 2 },
    },

    // ---- Webs (PROVISIONAL, monster draft) ---------------------------------
    // Each layer of sticky web adds ticks and stamina to every action. Up to maxLayers. Tear free: d10 + ⌊STR/2⌋ ≥
    // tearTN clears them all. Fire burns them away. wearOff layers come loose by themselves each beat.
    web: { ticks: 3, stamina: 3, maxLayers: 2, tearTN: 8, wearOff: 1 },

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
    social: { bait: { range: 3 }, readIntent: { range: 4, tn: 5, misreadBy: 4, beats: 2 }, readBonus: 2 },
    // PROVISIONAL (the user's rulings, 2026-10-24 and 2026-11-02: docs/PROPOSALS.md §1): coming up to the edge
    // of a foe's melee reach is free; the foe may strike at a mover who steps from there to closer still,
    // leaves its reach, or takes a second step within it in one move that brings them no closer (one guarded
    // step is free). Once per foe per move, paid from the foe's AP; a hit stops the mover where they were. At
    // equal reach the one who steps in strikes first; a longer weapon holds a shorter one at its edge.
    opportunityStrikes: true,

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
      // (spells.yaml), and spells.yaml `shapes` holds each shape's numbers: mag (magnitude), range [min, max], ticks
      // (base ticks, else castTicks), radius / length / beats. A modifier scales it: shapes (the shapes it goes on), area
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
      // (lightning goes straight through metal); every fireConPer points left burn (a wound's point), the
      // rest is stamina. Life withers the body: half its magnitude a withering wound's points, no armor; the dead
      // and the made (tireless) are past withering.
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
      // Healing (Give + Life). PROVISIONAL. Mends one creature: every wound stops bleeding, the worst condMag
      // severity steps better (1; 2 with Strong), stamina + staminaPerMag × magnitude stamina back (the collapsed come
      // round; the down come to once under their wound boxes). With Wide, every living creature within a square of
      // the target, friend or foe, at areaShare of the stamina. The dead stay dead, but see revive.
      heal: { stamina: 4, staminaPerMag: 2, areaShare: 0.5 },
      // The user (2026-11-04): one who dies in a fight can be called back for `beats` beats after the one they died
      // in: Raise + Life (or Move + Life given) stops the bleeding, mends the worst
      // wound `mend` steps and leaves them alive but down, at 0 stamina. After that they are beyond saving there (a priest in town still can).
      // PROVISIONAL (the user, 2026-11-07): a fight won while one of the party is still revivable leaves time to save
      // them: a living companion with a Life spell that calls back the dead, and the points for it, casts it; else
      // the best at `skill` rolls against `tn` (a check name in rules.yaml) to bring them back unconscious.
      // TUNED (the user, 2026-11-09: the CON hit is already a large lever against going down): the Medicine check is
      // hard (11), was moderate (8). Jabiku (+5 at level 1, +7 at level 5) saves one in two, then seven in ten; was
      // eight in ten, then always. Spells that call back the dead are untouched.
      revive: { beats: 2, mend: 1, afterFight: { skill: 'medicine', tn: 'hard' } },
      // PROVISIONAL (the user's Transfer, 2026-11-01): what the target loses, the caster gains: each severity step it
      // wounds mends a step of the caster's own wounds, or, with none, gives this much stamina.
      // PROVISIONAL (the user, 2026-11-07): Transfer aimed at an ally gives instead: ceil(magnitude / 2) points of the
      // caster's own life, each mending a severity step of their wounds (else staminaPerCON stamina), each costing the caster
      // staminaPerCON stamina. It stops bleeding and calls back the revivably dead.
      transfer: { staminaPerCON: 3 },
      castTicks: 5, // base ticks of a cast, before Quick Casting, armor and the SPD factor (PROVISIONAL)
      // PROVISIONAL (step F): a cast's lead share; a Strong spell is gathered, `gather.ticks` dearer with a lead of
      // `gather.lead` of the whole, exposed. A summons or a raised body acts `joins` ticks after it comes.
      lead: 0.2,
      gather: { ticks: 2.5, lead: 0.5 },
      joins: 10,
      poolPerCasting: 3, // spell points = INT + 3 × Casting rank
      // PROVISIONAL (the user, 2026-10-29): a rest after a fight brings spent points back, but each point spent takes
      // this much off the maximum until a long rest, as weariness does stamina. A caster can go hard in a fight and
      // still has only so many fights in a day.
      // TUNED (the user, 2026-10-30: a long rest after clearing an area, about 6 fights): was 0.5, which halved a
      // caster who emptied the pool every fight. At 0.15 the maximum runs 100, 85, 72, 61, 52, 44% fight by fight.
      spWeary: 0.15,
      // A tired caster can't draw as much power: usable points scale with stamina.
      staminaLimitsPoints: true,
      // Fire: armor stops half its blunt mitigation; every 2 points left over burn (a wound's point), the rest goes
      // to stamina.
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
      heals: { partial: 1, full: 2, exceptional: 4 }, // Mend: severity steps (+ Wound Tending on full+)
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
    // worth (the AI's, step 5 of docs/PLAN.md): what it takes the condition to be worth, in the units of a blow's value
    // (AI.hitValue): on a foe for a harm, on a friend for a boon; where it matters is the AI's (a root on a foe closing in,
    // a ward against what the foes throw), read from the condition's other fields, so a new condition needs no AI edit.
    // Every field is listed in src/rules/effects.js (KEYS.condition); the effect ones (ticks, attrs, resist, moveMult,
    // regen, flags…) are read through Effects with the same keys as traits and gear.
    conditions: {
      burning: { worth: 12, type: 'fire', name: 'Burning', dot: { harm: 1 } },
      slowed: { worth: 14, name: 'Slowed', ticks: 2, resistedBy: 'CON' },
      hasted: { worth: 14, name: 'Hasted', ticks: -2 },
      shocked: { worth: 12, name: 'Shocked', ticks: 2, resistedBy: 'CON' },
      rooted: { worth: 14, name: 'Rooted', noMove: true, breakAttr: 'STR', resistedBy: 'STR' },
      numbed: { worth: 10, name: 'Numbed', attrs: { DEX: -1, SPD: -1 }, resistedBy: 'CON' },
      withering: { worth: 22, type: 'life', name: 'Withering', dot: { harm: 1 }, ticks: 2, resistedBy: 'CON', living: true }, // Life bane (asystole)
      innervated: { worth: 18, name: 'Innervated', regen: 6 },
      kindled: { worth: 10, name: 'Kindled', kindled: true }, // blows set targets burning
      frostWard: { worth: 6, name: 'Frost ward', resist: { fire: 0.5 } },
      freedom: { worth: 20, name: 'Freedom', freedom: true },
      stoneskin: { worth: 12, name: 'Stoneskin', mit: { B: 2 }, attrs: { SPD: -1 } },
      barkskin: { worth: 12, name: 'Barkskin', mit: { P: 1, S: 1 } },
      shielded: { worth: 12, name: 'Shielded', mit: { P: 1, S: 1, B: 1 } },
      afflicted: { worth: 10, name: 'Lingering harm', dot: { harm: 1 } }, // a Lingering spell's after-burn
      // Ward (verb): kind 'magic' absorbs `pool` points of spell or missile damage; 'missiles'
      // turns aside half of the arrows and bolts; an element's ward halves that element and
      // keeps off its after-effects; 'mind' keeps off baits and the like.
      warded: { worth: 10, name: 'Warded' },
      // Bait (CHA vs WIS) and Read intent (WIS vs CHA); Hex + Mind and Bless + Mind do the same.
      baited: { worth: 6, name: 'Baited', resistedBy: 'WIL', defense: -2 }, // guards drawn out; −2 to defend
      reading: { worth: 6, name: 'Reading', read: 2 }, // +2 to defend against and to beat the defense of `vs`
      foresight: { worth: 12, name: 'Foresight', read: 2, all: true }, // reading every foe
      // ---- Phase 2 (draft) -------------------------------------------------------------
      // Mind (WIL resists). breakOnHarm: ends when the bearer takes damage.
      calmed: { worth: 20, name: 'Calmed', resistedBy: 'WIL', noAttack: true, breakOnHarm: true },
      mesmerized: { worth: 30, name: 'Mesmerized', resistedBy: 'WIL', breakOnHarm: true, noAct: true },
      enraged: { worth: 14, name: 'Enraged', resistedBy: 'WIL', noGuard: true, berserk: true },
      // The user (2026-11-08): can't come closer to the source, and must first step at least a square farther from it
      // each turn (Combat.mustFlee). It may still strike or shoot at it.
      frightened: { worth: 18, name: 'Frightened', resistedBy: 'WIL', fearOf: true },
      controlled: { worth: 40, name: 'Controlled', resistedBy: 'WIL', control: true }, // fights for the caster
      // PROVISIONAL (the user's spell list): Charm — the bearer takes the caster's side without the caster holding
      // it (no concentration), but any harm breaks it at once.
      enthralled: { worth: 34, name: 'Charmed', resistedBy: 'WIL', control: true, free: true, breakOnHarm: true },
      confused: { worth: 24, name: 'Confused', resistedBy: 'WIL', confused: true, noGuard: true },
      concentrating: { worth: 4, name: 'Concentrating', ticks: 1 }, // holding a Will spell
      steadied: { worth: 8, name: 'Steadied', mindWard: true },
      emboldened: { worth: 8, name: 'Emboldened', attrs: { STR: 1 }, noFear: true },
      resolute: { worth: 8, name: 'Resolute', mindWard: true, attrs: { WIL: 2 } },
      // Body (CON resists the banes).
      enfeebled: { worth: 12, name: 'Enfeebled', resistedBy: 'CON', attrs: { STR: -2 } },
      empowered: { worth: 10, name: 'Empowered', attrs: { STR: 2 } },
      clumsy: { worth: 10, name: 'Clumsy', resistedBy: 'CON', attrs: { DEX: -2 } },
      deft: { worth: 10, name: 'Deft', attrs: { DEX: 2 } },
      // Poison and disease. persist: outlasts the fight (until cured or run its course).
      poisoned: { worth: 16, type: 'venom', name: 'Poisoned', resistedBy: 'CON', dot: { harm: 1 }, living: true },
      antivenom: { worth: 8, name: 'Antivenom', immune: ['poisoned'] },
      diseased: { worth: 12, type: 'plague', name: 'Diseased', resistedBy: 'CON', attrs: { STR: -1 }, regen: -6, living: true, persist: true },
      // PROVISIONAL (the user's spell list and magic items).
      chilled: { worth: 10, type: 'frost', name: 'Chilled', resistedBy: 'CON', moveMult: 0.5, attrs: { SPD: -1 }, living: true }, // frost: half the squares
      // PROVISIONAL (the user's spell list: Give + Frost, a curse that stacks): numb and losing stamina each round.
      frostbite: { worth: 10, type: 'frost', name: 'Frostbite', resistedBy: 'CON', dot: { stamina: 2 }, attrs: { DEX: -1 }, living: true },
      // PROVISIONAL (Take + Earth on an ally): floats over pits and hazards, as a flier does.
      levitating: { worth: 16, name: 'Levitating', flying: true },
      paralyzed: { worth: 34, name: 'Paralyzed', resistedBy: 'CON', noAct: true, noGuard: true, helpless: true },
      stunned: { worth: 12, name: 'Stunned', resistedBy: 'CON', stagger: 5, noGuard: true }, // ticks on the clock at once; no guard for the beat
      riled: { worth: 8, name: 'Riled', mit: { P: 1, S: 1, B: 1 }, breakOnHarm: true }, // a goading blade: until the bearer is hurt
      unseen: { worth: 16, name: 'Unseen', unseen: true }, // can't be picked out beyond arm's reach; striking ends it
      // Feat conditions (feats.yaml: Feign Death, Dirty Trick, Name the Weakness).
      feigning: { worth: 10, name: 'Playing dead', unseen: true, feign: true }, // no foe can aim at them, near or far; acting ends it
      exposed: { worth: 10, name: 'Exposed', noGuard: true }, // no defence for the beat
      named: { worth: 12, name: 'Weakness named', named: true }, // blows ignore its resistances
      corroded: { worth: 8, type: 'decay', name: 'Corroded', resistedBy: 'CON', dot: { stamina: 2 }, living: true },
      // Mystic.
      dread: { worth: 10, name: 'Dread', attrs: { STR: -1, DEX: -1, SPD: -1 }, defense: -1 }, // a revenant knight's aura
      dazzled: { worth: 6, name: 'Dazzled', resistedBy: 'CON', defense: -1 },
      blinded: { worth: 18, name: 'Blinded', resistedBy: 'CON', defense: -2, blind: true }, // strikes only at range 1
      radiant: { worth: 6, name: 'Radiant', resist: { shadow: 0.5 } },
      shrouded: { worth: 10, name: 'Shrouded', shroud: 0.5 }, // missiles at the bearer miss half the time
      spiritShield: { worth: 10, name: 'Spirit shield', mit: { P: 1, S: 1, B: 1 }, vsUndead: true },
    },

    // ---- Terrain (PROVISIONAL, magic overhaul) ------------------------------------------
    // Features on tiles (src/rules/terrain.js). wall: can't be entered; solid: blocks sight and
    // missiles; blocksMissiles: arrows and bolts can't pass; cost: extra squares of movement to
    // enter; slick: a footing roll on entering or fall; pit: fall in (prone, the move ends, and
    // climbing out costs climbCost extra); onEnter/perBeat: an element's blow with that
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
      lava: { name: 'Lava', onEnter: { fire: 6 }, perBeat: { fire: 6 }, deadly: true, burns: true, permanent: true },
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
      hot: { name: 'Hot ground', onEnter: { fire: 1 }, perBeat: { fire: 1 }, burns: true },
      ice: { name: 'Ice', slick: true, cost: 1 },
      charged: { name: 'Charged ground', onEnter: { storm: 2 } },
      winds: { name: 'Swirling winds', cost: 1, missileMiss: 0.5 },
      rough: { name: 'Rough ground', cost: 1 },
      brambles: { name: 'Brambles', cost: 1, onEnter: { vine: 2 }, flammable: true },
      pit: { name: 'Pit', pit: true },
      rune: { name: 'Rune', rune: true, hidden: true },
      // PROVISIONAL (docs/OVERHAUL.md step C): a trap laid on the map (places.yaml kind trap), carried into a fight on it.
      // Hidden to every side not in the feature's knownBy; stepping or being driven onto it springs it (src/rules/traps.js).
      trap: { name: 'Trap', trap: true, hidden: true },
      miasma: { name: 'Miasma', perBeat: { decay: 1 }, onEnter: { decay: 1 } },
      radiance: { name: 'Radiance', reveals: true, perBeat: { light: 1 } },
      lightWall: { name: 'Wall of light', onEnter: { light: 3 } },
      // PROVISIONAL (the user's spell list): darkness hurts and drags at the feet as well as hiding.
      darkness: { name: 'Darkness', blocksSight: true, cost: 1, perBeat: { shadow: 1 } },
      acidPool: { name: 'Acid pool', onEnter: { decay: 2 }, perBeat: { decay: 1 } },
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
      // PROVISIONAL (the user, 2026-11-03): a successful parry opens the attacker to a riposte. Anyone may answer a
      // parry they made with a blow of the parrying weapon at once (a reaction, its ticks on their clock, a blow the
      // attacker may defend). The Riposte feat makes it cost no ticks. false: only the feat, as a free thrust.
      riposteOpen: true,
      // PROVISIONAL (the user's call): a defence that works still costs stamina, this share of the
      // blow's force: a block most (the arm takes it), a parry some, a dodge none. null: nothing.
      absorb: { block: 0.5, parry: 0.25, offParry: 0.25, dodge: 0 },
      // PROVISIONAL: dodging costs 1 base stamina (Specifics: 2), so a dodge is the cheapest
      // defence in stamina when it works and the block the dearest.
      dodgeStamina: 3,
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

    // PROVISIONAL (the user, 2026-11-10): a punch or a kick breaks nothing without this feat: it winds only, so it
    // does nothing to a tireless body (a skeleton) or to someone already out cold.
    unarmed: { attrFeat: 'heavy_hands' },

    // ---- Impact (PROVISIONAL, the user's call) -----------------------------
    // Crushing: blunt that gets past armor beyond crushAt (× the target's size) breaks bone: a point of a crushing
    //   wound (CONFIG.wounds) per crushPer points over, on top of the winding it costs.
    // PROVISIONAL (docs/PLAN.md R5, step 3): crushBare is crushAt where the blow lands on a location with no armor
    //   (bare skin breaks sooner). Unarmed blows without Heavy Hands still crush nothing.
    // Knockback: a blow that lands throws its target back 1 square per knockbackPer points landed
    //   (blunt in full, cuts and stabs at half), ÷ the target's size, up to knockbackMax squares.
    impact: { crushAt: 8, crushBare: 3, crushPer: 2, knockbackPer: 8, knockbackMax: 3 },

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
    // PROVISIONAL: a tower shield takes a square off each stretch of a move ("slows movement")
    towerMovePenalty: 1,

    // ---- Armor ------------------------------------------------------------
    // Base durability per armor type lives in armor.yaml (Outline: durability like HP; numbers Open).
    // Armor coverage keyword: only `full` is read. Where a piece is worn is its locations (rules.yaml locations,
    // Items.coversOf); half and partial are kept for old saves' sake.
    coverage: {
      full: { mitigation: 0, penalty: 0 },
      half: { mitigation: -1, penalty: -1 },
      partial: { mitigation: -2, penalty: -2 },
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
    //   deflected  a point turned by armor it did not get through (CONFIG.pierce)
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
    armorAdjust: { plate: { stamina: 1, regen: 9 } },
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
      proneDefenseTicks: 3, // "defensive actions cost more"
      grappledDefenseTicks: 3,
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
    // PROVISIONAL (the user's idea, on trial): every beat of combat lowers each fighter's
    // maximum stamina by perBeat (up to `cap` of it); only a long rest (camp, inn) clears it.
    // Long fights cost more than their wounds, and the party has a reason to camp. null: off.
    // PROVISIONAL (the user, 2026-10-28): time awake wears too: perHour of fresh stamina each hour (half of it after
    // a 16-hour day: game.exploreDay), sleep excepted, so a day in a dungeon ends in a camp. The cap covers both
    // (was 0.5 for fights alone; a fight reaches it only after 30-odd rounds).
    // PROVISIONAL (the user, 2026-11-01): by effort, not by round. Each point of stamina a fighter spends or loses in a
    // round takes perStamina off the maximum (was a flat 1 a round, so a fight won in one blow wore the whole party as
    // much as a hard one). In sim/FINDINGS.md: a preset fighter spends 8-14 stamina in a median fight and 30-50 in
    // a hard one, so 0.25 costs about what the flat rate did on average (2-3 points), nothing for standing by.
    weariness: { perBeat: 0, perStamina: 0.25, perHour: 1 / 32, cap: 0.75 },
    // PROVISIONAL (the user, 2026-11-01: duels too spongy; "more energy = harder swing"): a weapon blow's damage ×
    // `full` from a fighter at full fresh stamina down to × `empty` from one with none left. null: off.
    // 1.25 / 0.75 (sim/duels.js; FINDINGS 2026-11-01): it barely shortens duels (armor takes most of a blow), but a
    // fresh fighter hits a quarter harder and a spent one a quarter softer, so saving stamina pays.
    // PROVISIONAL (R2, 2026-11-11): a spent blow (CONFIG.stamina.spent) lands at × `spent` whatever stamina is left.
    vigor: { full: 1.25, empty: 0.75, spent: 0.5 },
    // PROVISIONAL (the user, 2026-10-29): there is no flee roll. The party gets away when, at a beat, no foe can reach
    // striking distance of any of them (a wall across the way, or held where it stands) or none could in `outrun`
    // beats of running, and no foe with a missile or a spell has a clear line to them.
    disengage: { outrun: 3 },

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
    'The clock (docs/OVERHAUL.md step F, the user, 2026-11-14: straight to the clock): no rounds, turns or AP. Every fighter has a clock in ticks; whoever\'s clock is lowest takes one action and its ticks go on their clock. Ties: higher SPD, gear\'s init, then a d10 rolled once at the start. A side caught off guard starts CONFIG.clock.surprise (10) ticks late (an ambusher doubles it). Waiting is an action: until the next thing happens (another\'s action, a blow landing, a beat), just after a named fighter has acted, or by n ticks; a waiting fighter can react.',
    'Costs in ticks (step F): a one-handed swing at SPD 5 is 10 ticks. Base ticks (data.js): thrust 5, swing 10, two-handed 15, power 15, parry and dodge 5, a block by the shield (buckler 2.5, round and heater 5, tower 10), kick 5, punch 2.5; a bow\'s shot its shootTicks (shortbow 8, longbow 15). × the weapon\'s speed and strain × the SPD factor (3 + 2.5) / (3 + SPD/2) × gear\'s costMult ÷ a body\'s tempo, − Quick feats (a tick a rank; Heavy Tempo 2), + armor, gear, conditions (slowed +2), webs (3 a layer), an arm wound; then fatigue (+20% below half stamina, +40% below a quarter); rounded once.',
    'Lead and recovery (step F): an action\'s ticks are split, `lead` before it takes effect: a thrust, a kick, a punch or a shove none; a swing 30%, a two-handed swing 40%, a power blow 50%, a bow its draw (shortbow 3, longbow 5), a cast 20%, a Strong (gathered) spell 50% and 2.5 ticks dearer, a bandage or standing up 50%. Committed, a fighter can be struck, shoved or stepped away from; knocked down, grappled, disarmed or put down, the action is spoiled. A power blow, a drawn bow and a gathered spell leave the fighter unable to block or parry until they land.',
    'Rebound (step F, from the user\'s 2026-11-03 ruling): a blow blocked puts a third of its ticks on the attacker\'s clock, one parried a sixth (Beat: another sixth a rank). A dodge costs the attacker nothing.',
    'The beat (step F): every CONFIG.clock.beat ticks the timeline runs what happened each round: bleeding, a torso wound\'s drain, regeneration, conditions\' harm and durations (in beats), regrowth, weariness, a collapse running its course, hold upkeep, webs loosening, terrain\'s harm, Delayed spells breaking, conjured things fading, traps resetting, auras, groups joining and the getting-away check. TUNED: 14, started at 20 as the plan said: a round\'s AP was about 14 ticks of actions, so 14 keeps every per-round number at the rate per action it was tuned at (at 20 heroes ran out of breath; docs/overhaul/F-report.md). Durations kept their numbers (a 3-round condition lasts 3 beats).',
    'Command (step F): a friend within 4 acts CONFIG.clock.command (3) ticks sooner (never before now). Stunned: 5 ticks on the clock at once. A summons or a raised body comes onto the clock 10 ticks after it appears.',
    'One contest per blow (docs/OVERHAUL.md step A): one opposed roll decides a blow, the attacker\'s d10 + ⌊(STR + SPD)/4⌋ + the motion (− the aim) against the defender\'s d10 + their defence, ties to the defender. Its margin (the attacker\'s total less the defender\'s) settles what the gap roll, the pass-through dice, the vital roll and the on-target roll did: whether a point gets through armor (CONFIG.pierce), whether a wound is vital (CONFIG.vital) and whether an unaimed blow finds the worst-guarded place beside where it fell (margin 6 or more: rules.yaml contest.shift). A blow nobody defends always lands, its margin the attacker\'s d10 + bonus less a passive number: 6 ready (standing, aware, too far ahead on the clock to react or not defending), 3 unaware or prone, 2 held, 0 down (rules.yaml contest.passive). A blow rolls the contest and its location and nothing else before the wound tables.',
    'Vital wounds by margin (step A; step E): a point or a cut that reaches the body is vital when the margin reaches the place\'s threshold (head 7, torso 9, arms 12, legs 11: rules.yaml wounds.vital), + the armor there (padded and leather 1, mail 2, plate 6; a pinned body\'s armor none), − round(10 × the blow\'s wound.vital) (a spear, a rapier or a longsword thrust 3, a rondel 2, a dagger or a cut 1), + 4 × (size − 1). A vital wound is a step more severe and bleeds 1 more.',
    'Armor for the deleted pass-through roll (step A): the pass-through dice (every point past the armor reached the body on a d10 of 5 or less, 2 against plate) are gone, and a point that gets through goes in whole. P mitigation rises in their place: padded, leather and mail 1 → 2, plate 4 → 4.5 (iron 5, steel 7). A level-1 spear into steel plate needs a margin of 7 and then does about 1 CON: about 0.1 CON a thrust that lands undefended, as before (0.09).',
    'Wounds and life (docs/OVERHAUL.md step E; rules.yaml wounds): a blow that gets past the armor leaves a named wound {place, severity 1–3, kind, bleeding}; no rolls per point. Severity: points past the armor 1+, 4+, 7+ (× size), a step more if vital. A body holds 6 × size wound boxes of severity; filling them, a head wound of 3, or a severity-3 wound whose shock check fails (d10 + CON under 12) takes it down. What a wound does, by severity: arms +0/1.25/2.5 ticks to blows, parries and blocks and −1/2/3 damage, at 3 drops what is held; legs −1/2/3 squares a stretch and −1/2/3 dodge, at 3 fells and the body can\'t stand; head stuns (1: CON resists; 2: no save), at 3 down; torso −2/4/6 stamina a round. WIL acts through ⌊WIL/4⌋ of each place\'s severity (pain).',
    'Down before dead (step E): down is out of the fight, keeping its armor. A wound on a body already down kills it (a finishing blow); the AI strikes the down only with the trait finishes (beasts that feed, the cruel, the undead). When the fight ends, a body down and still bleeding is bound by its own side if one of them stands; else d10 + CON against 10 + its bleeding, or it bleeds out. Hero mode: a hero is only ever down. Medicine (a bandage) and Give + Life stop bleeding and mend a severity step; a down body mended under its boxes comes to.',
    'Bleeding and harm (step E): a cut bleeds 1 a severity, a point by its width (rounded up), a vital wound 1 more, ÷ size; each point of bleeding costs 2 stamina a round, less ⌊CON/5⌋. Harm without a blow (burning, poison, withering, a joint lock, a squeeze, a fall, overchannelling) adds points to one wound of its kind at its place (the torso unless named) and reads its severity again; no shock check. After a fight a bleeding wound takes a bandage or is a step worse, and the party\'s best at Medicine tends each wound once.',
    'Stamina is exertion (step E): it is spent on actions and wound by blunt that breaks nothing: a fixed winding by the severity the blunt would be (3, 6, 10), not point for point. Heat and a ghost\'s chill still take stamina point for point.',
    'Monsters\' CON (step E): every CON above 10 was cut to 10; big bodies keep their size (wound boxes and severity × size), hides their armor; the rest was padding. Small animals have a size under 1 (rat 0.5, dusk bat and fae drake 0.4, fire sprite 0.5). Regrowth mends a severity step a round; a constrictor\'s squeeze is a point of harm.',
    'Whirlwind (docs/PLAN.md step 9, docs/PROPOSALS.md 3.2): the Reaper capstone. A two-handed weapon\'s swung edge or head gains a Whirlwind option at the same ticks and 1.5 times the stamina that strikes every foe the blow reaches, the others at three quarters of its force, each defending for itself (CONFIG.whirlwind; null: the feat does nothing). The numbers are first guesses; sim/feats.js and a swarm crawl are the check.',
    'Standing orders for reactions (docs/PLAN.md step 8, src/game/orders.js, rules.yaml game.orders): each hero blocks with a shield, parries thrusts, dodges when unarmored and takes a free blow at a foe passing, and the player is asked only for a blow whose chance of dropping that hero is 10% or more. Heroes can be set to be asked every time or never.',
    'The swing\'s setting (docs/PLAN.md R8, step 6): a swung edge or head that drops its target, or passes it (dodged, or the target already down), carries on into one more foe in its reach beside the first, at half force (three quarters for a two-handed or power blow); that foe defends as against any blow (CONFIG.sweep).',
    'Aiming at what can still be covered (docs/PLAN.md R6, step 4): against a defender who can still react (standing, free, aware) and defends, a blow aimed at the head costs 5 off the contest (rules.yaml locations.aim.guarded; arms and legs 1, the torso 0); against one prone, collapsed, held, caught off guard, not seeing the blow, or not defending, 3 (locations.aim.penalty; TUNED in step A from 2, when an aimed blow stopped missing its place: the head was 35% of located blows in sim/duels.js, now 21%). A thrust is one less either way. The AI sees the body and the clock (step F): a foe too far ahead to react is open; before step F it guessed a foe spent from an average pool less what it has watched it spend this round. The command panel shows the aimed place, its cost and why under the Aim menu.',
    'Head cover (docs/PLAN.md R7, step 4): the foe templates (foes.yaml) wear half or partial armor with head cover of the same type (rules.yaml locations.coverage halfHead, partialHead), as do the humanoid monsters of level 2 and up that wear armor (goblins, goblin archers, the orc centurion and emissary, the kobold high shaman, the sarnak knight); Cyrus\'s gambeson has a padded cap. The kits already gave full padded armor, the head included. Magic items and loot tables are untouched; the clockwork gnome (a construct) is left as it is.',
    'Blunt on bare skin (docs/PLAN.md R5, step 3): blunt that lands on a location with no armor breaks bone from 3 (CONFIG.impact.crushBare; armored, still crushAt 8): a point of a crushing wound per 2 over. An untrained punch or kick still only winds (the user, 2026-11-10).',
    'Tireless bodies (step 3; step E): a skeleton, a golem, a construct has no stamina: blunt that would wind it breaks its frame (a crushing wound) wherever it lands; it neither bleeds nor feels shock, and down is broken for good. What its body resists (a skeleton: no piercing, half slashing; each golem two of slashing, blunt and fire) is unchanged, so a point still does nothing to bone.',
    'Maximum stamina reads current attributes (step 3; docs/REVIEW.md §2.3 settled): a condition that lowers STR, DEX or SPD lowers it at once, and current stamina with it. Wounds don\'t touch attributes (step E).',
    'Skills (the user, 2026-11-07): twenty skills, 0–10, +1 a rank to the rolls they govern; 10 points at level 1 and 3 a level, spent whenever the party isn\'t fighting. Skills give numbers, feats large benefits; a tree\'s skill unlocks its feats (novice 1, apprentice 3, adept 5, expert 7, master 9). Feats that were only a number became skills. Defences add the gap between the defender\'s skill and the attacker\'s: parry Melee, dodge Evasion + Anticipation, block half of Block; against Melee, Ranged or Arcane.',
    'The spell words (the user, 2026-11-08; docs/PROPOSALS.md §4): a spell is a verb and a noun, 1 to 3 words: a verb alone (Bind holds a foe still, Move steps through space, See reveals), a verb and a noun, either with one modifier, or Summon + Bind + a noun. Verbs: Strike, Give, Take, Move, Raise, Bind, Summon, Shape (not built), See. Nouns: Fire, Frost, Storm, Decay, Force, Earth, Life, Death, Speed, Might, Grace, Mind, Shadow, Magic, Outsider, and a Name you know. Modifiers: Wide, Far, Long, Strong, Hidden, Delayed. Each noun says what each verb makes of it (spells.yaml `does`), and where a verb does two things (Give Fire on a foe burns, on the ground covers it) each is its own spell. Retired: Hex, Bless, Restore, Cover, Ward, Increase, Decrease, Transfer, Launch, Build, Open, Inscribe, Blink, Burst, Beguile, Conjure; Lightning (now Storm), Venom, Acid, Plague (now Decay), Wind, Vine, Light, Bone, Spirit, Veil, Stillness, Calm, Dream, Rage, Fear, Will, Charm; the modifiers Launch, Burst, Lingering and Name, and Word Doubling. Numbers: each shape\'s base in spells.yaml `shapes` (a bolt magnitude 6 at 1–6; a Wide bolt an area of magnitude 4).',
    'Give, Take, Move (the user, 2026-11-01 as Increase, Decrease, Transfer; renamed 2026-11-08): Give puts the noun into a creature or onto the ground (Give Life heals; Give Fire, Frost, Storm or Decay on a foe is a curse that stacks; on the ground a hazard), Take removes it or keeps it off (Take Life harms at arm\'s reach; Take Speed, Might, Grace slow, weaken, make clumsy; Take + an element on an ally lifts what it left and wards against it, halving it; Take Earth opens a pit or makes an ally float; Take Magic lifts every spell on a creature or the ground), Move shifts a creature or a noun (Move Life drains a foe to mend the caster or, aimed at an ally, gives the caster\'s own life: half the magnitude in points, each a lost CON mended or 3 stamina, each costing the caster 3 stamina).',
    'Summoning (the user, 2026-11-08): Summon + an element (Fire, Frost, Storm, Earth) brings an elemental; Summon + Death a ghost; Summon + an outsider\'s name that kind of outsider; nothing else is summoned, and animals and people never are. What comes is simply in the world for 4 beats: unbound it is frenzied (strikes the nearest body, friend or foe) until a Bind (Bind + Outsider, + Death, + its name) takes hold; Summon + Bind brings it bound. It stands with the caster\'s side, so the caster\'s friends leave it be unless it goes for them. Take + Outsider banishes one (WIL resists).',
    'Ghosts (the user, 2026-11-08): only spells and magical weapons touch one; its touch (Take + Death, a power of its own) passes armor and takes stamina only, half the magnitude, never an attribute: it can exhaust you, not kill you. A shell of force (Give + Force: 3 × magnitude points against spells and missiles) soaks it; a ward of Death (Take + Death on an ally) keeps it off altogether. A named ghost is not built.',
    'Raise (the user, 2026-11-08): Raise + Death on a corpse raises a skeleton; Raise the Flesh (necromancy feat) a zombie; Raise the Wrapped Dead a mummy. It fights for the caster for the rest of the fight and falls when the caster does. Raise + Life calls back an ally dead within the window (CONFIG.magic.revive); Give + Life no longer does. Raise + Earth, Fire, Frost, Storm or Force is a wall.',
    'Bind (the user, 2026-11-08): alone it paralyzes a foe for a round (CON resists); Bind + Mind charms the living (free, ends on harm); Bind + Death commands the undead and Bind + Outsider an outsider (the caster concentrates); Bind + a name holds one whose name the caster knows, +3 to the contest (CONFIG.magic.nameBonus). The old Name modifier, reaching anyone anywhere, is gone.',
    'Traditions (the user, 2026-11-08: no classes, specialization): feat trees whose feats strengthen spells by their words (feats.yaml `spell`): Necromancy (Take and Move Life, Give Death, Take on a foe; zombies, mummies, ghosts, Bind + Death), Devotion (Give Life, Wide Mercy to 2 squares, blessings, Take on an ally, Take Death, Raise Life), Summoning (binding, banishing, longer summons). Living Flame (fire affinity capstone) now brings fire elementals bound.',
    'Saving the fallen after a fight (the user, 2026-11-07): when a fight is won while a party member is dead but still revivable, a companion with a Life spell that calls back the dead and the points for it casts it; failing that, the party\'s best healer makes a Medicine check (hard, 11; TUNED 2026-11-09 from moderate) to bring them back, down. Since step E the dead are few: those finished while down, and those who bled out with no one of their side standing.',
    'Traps as terrain (docs/OVERHAUL.md step C, 2026-11-14): a trap is a places.yaml legend entry with a tell, a trigger, an effect (a blow as a weapon option through Combat.applyHit, an element, a terrain, a drop), a reset, knownTo and ways past (rules.yaml game.traps). Finding is by the Perception margin: the tell (-3), the square (0), the working (+3); knowing (reveal) gives the last without a roll. Ways past: disarm (Trapcraft; a fumble springs it on the disarmer), leap or edge round (each member, Athletics), a pole, a stone or a shield (loud), mark it. Whoever is on the square by marching order takes it; one who knew it was coming gets clear on d10 + the better of dodge and shield against strike 13. In a fight on the map a live trap is hidden terrain (CONFIG.terrain.trap), seen by the sides that know it; its own people walk it safely; the AI shoves foes onto a trap it knows.',
    'Monster tiers (the user, 2026-11-09): every placed monster has a level (its place\'s) and a tier, measured by tools/tiers.js as M, the number of heroes of its level at which it is an even fight: 1 very weak (~0.35), 2 weak (~0.6), 3 moderate (1), 4 tough (2), 5 boss (~3.5: two heroes almost always lose, three have a very tough fight), 6 epic (6+). Encounters scale by numbers; a party is three for tuning. Each boss has a bane oil near it (a leg-up). sim/FINDINGS.md has the numbers.',
    'Parties and the fallen (the user, 2026-11-09): a new game begins with 1 to 6 heroes at level 1, each growing along their own plan; a fallen hero is back in the village to be recruited again, at the party\'s level, and a party wiped out rises there (testing only).',
    'Movement (the user, 2026-11-01; step F): a stretch of a move covers round(1 + SPD/4) squares for CONFIG.clock.stretch (5) ticks, about 2 a square at SPD 5; a move is at most CONFIG.clock.moveMax (14) ticks of walking.',
    'Vigor (the user\'s idea, 2026-11-01): a weapon blow\'s damage × 1.25 from a fighter at full fresh stamina down to × 0.75 from one with none left. Spells and shots are untouched.',
    'Reading intent lasts 2 beats (3 rounds before step F; 1 before 2026-11-01): the AI read every round it could, half a duel\'s actions spent watching.',
    'A staff (the user, 2026-11-01: Jabiku starts with one): a caster\'s focus, so spells can be cast with it in both hands (weapons.yaml `focus`; elsewhere a two-handed weapon needs Battle Casting), and it jabs with its butt end (a blunt thrust, reach 2, from `phys.butt`: 3 against the swung head\'s 10; it was 6, a warhammer\'s blow for a thrust\'s AP, until 2026-11-10).',
    'Unarmed blows (the user, 2026-11-10): a punch or a kick only winds; it breaks nothing (no crushing, nothing against a tireless body such as a skeleton), unless the striker has Heavy Hands. A shield bash is its own feat and is unchanged.',
    'Weapon roles (the user, 2026-11-09; the numbers are first guesses, crawled once: sim/FINDINGS.md): blunt swings are for armor and the undead, spear and rapier thrusts for the living, the longsword is the generalist, an axe is a heavier, slower sword swing with no thrust. A swung edge carries blunt by its weight (weaponPhysics.edgeBlunt × edge × √(mass × length × grip); it was a seventh of the cut): rapier 1, shortsword 2, longsword 3, battle axe 4, great axe 8, against a warhammer\'s 6 in one hand and a staff\'s 10 in two. A blade heavier than 1.1 kg is slower to drive point-first (thrustHeavy; spears, held at the balance, are not): a longsword thrust 2.3 AP against a rapier\'s 1.9 and a short spear\'s 1.7 for the same wound. `phys.heft` marks a head-heavy edge (the new battle axe, 1.2): a harder and slower swing than the same mass as a blade.',
    'Armor adds ticks (step F): its SPD penalty adds CONFIG.clock.armor (0.5) ticks to every action a point (mail +0.5, plate +1.5, rounded with the rest of the cost; the mobility feats lower it), and still slows the feet (a move\'s stretch is round(1 + SPD in armor / 4) squares).',
    'Weapon wear (the user\'s call): every weapon has a durability (weapons.yaml × its material\'s toughness × origin × craftsmanship; a rapier 40, a longsword 100, a mace 120). Each blow wears it by its force × rate × fragility (rapier 1.25, mace 0.5) × (what it meets ÷ its own hardness): landing on armor 0.2 (metal chews an edge; cloth, leather and flesh barely touch it), a point turned by armor 0.3, being parried 0.075, parrying 0.125 (by the force of the blow met), being blocked 0.125 (by the shield\'s material); fractions of a point carry to the next knock (TUNED 2026-10-30: was 0.4/1.0/0.15/0.25/0.25 and a rapier\'s fragility 2, which broke a rapier in two fights against scales). Spell points: each spent point takes 0.15 off the maximum until a long rest (TUNED 2026-10-30, was 0.5). A dodge costs nothing. A worn weapon keeps 60% of its damage at the end of its life; at 0 it breaks and is out of the fight until a smith mends it. Thrusts now wear armor too (half their piercing).',
    'After a fight (the user\'s call): one click rests an hour (was 15 minutes) and mends: stamina back to the weary maximum, armor, shields and weapons get 25% back (50% with Field Repair in the party); broken weapons and shields need a smith. Pressing on keeps stamina where it is.',
    'Weariness (the user\'s idea, on trial): each point of stamina a fighter spends or loses in combat lowers the maximum by 0.25 (by effort since 2026-11-01; was 1 a round for everyone), and every hour awake by 1/32 of it (half after a 16-hour day), at most three quarters in all; only a long rest (camp, inn) clears it.',
    'Getting away (the user, 2026-10-29): no flee roll and no pause between beats. The party is away when, at a beat, no foe can reach striking distance of any of them (a wall across the way, or held fast) or none could in 2 beats of running, and no foe with a missile or a spell has a clear line to them. A wall of fire (Build + Fire) can\'t be walked through and scorches anyone within a square of it for Fire 2 at the end of each round.',
    'Spell points and rest (the user, 2026-10-29): a rest after a fight brings spent points back, but each point spent takes half a point off the maximum until a long rest.',
    'Time in a dungeon (the user, 2026-10-28): a step is 10 seconds and sneaking 20 (seeing the whole temple by the shortest route takes 2.8 h, walking every square about 12, tools/pace.js; a thorough exploration with searches should come close to a 16-hour day), a search 10 minutes. Every 20 minutes there is a 35% chance of drawing from the place\'s wandering table; loud things (forcing, a fight, a trap) count as extra minutes; a sneaking party can let wanderers pass on a stealth check.',
    'Quick feats (Quick Thrust, Parry, Block, Dodge, Hands, Heavy Tempo, Quick Casting) take a share off every such action: half at the top rank (Quick Thrust I–III: −1/6, −1/3, −1/2; Quick Parry I–II: −1/4, −1/2).',
    'Reactions (step F): defences are not declared ahead. When a blow comes, the target may block, parry or dodge, its ticks going on their clock on the spot (shown with the odds). A fighter whose clock is more than CONFIG.clock.overreach (10) ticks past now can\'t react: its armor takes the blow. A fighter committed to a power blow, a drawn bow or a gathered spell can\'t block or parry until it lands.',
    'Ground on the map (for the temple, 2026-10-24): map letters with a fixed meaning (rules.yaml game.ground): grass and rubble to walk on, deep water no one can walk through (fliers cross it; it stops neither sight, missiles nor reach), shallow water that costs an extra square, plank bridges over the water. A fight on the map keeps its water. A well can be a one-way drop.',
    'Fights draw in their neighbours (for the open courtyard, 2026-10-24): when a fight starts on the map, every other group that is awake, within game.joinDistance (6) squares of the party or of the group it fights (with a clear line), and inside the slice the fight is played on joins it from where it stood. Sleepers sleep on. Beating them settles their squares too. Not simulated: set for the courtyard, to be tried in play.',
    'Opportunity strikes (the user\'s rulings, 2026-10-24 and 2026-11-02): coming up to the edge of a foe\'s melee reach is free; a foe may strike at a mover who steps from there to closer still, leaves its reach, or takes a second step within it in one move that brings them no closer (one guarded step is free). Once per foe per move, its ticks on the foe\'s clock; a hit stops the mover at the square they stepped from (AP for squares not walked is refunded). So two swordsmen meet at thrust range (2) and the one who steps in strikes first; closing from there to arm\'s length (1) provokes; a spearman holds a swordsman at 3, and each step nearer provokes again; nobody can step inside a dagger\'s or a fist\'s reach of 1, so coming up to one is free.',
    'Points against armor (the user\'s call; reworked in docs/OVERHAUL.md step A): punch = the mass behind the point (two hands ×1.5; a swung beak or spikes, the head\'s mass × the haft × 2.5) × the motion × (1 + 0.1 × STR bonus); a dagger 0.9, a rondel 1.4, a rapier 1.1 (its flexible blade bends past 1.2), a longsword 1.4, a spear 1.7, a greatsword thrust 3.75, a heavy spear 3.9, a warhammer beak 4 (5.2 two-handed, 6.4 a power blow); arrows by the bow (shortbow 0.8, longbow 1.8) × the head (bodkin 1.5, broadhead 0.7). Resistance: padded 0.75, leather 1, mail 1.3, plate 5 (× material and origin protection: bronze 0.85, steel 1.5, dwarven 1.2). A point gets through when punch ÷ resist + 0.13 × the blow\'s margin (+ Find the Gap 2, Spot Weakness 1, a prone target 3, a half-sword thrust 3) reaches 1, and the piercing past the P mitigation then goes in whole; otherwise the armor turns it (half its piercing as blunt, the weapon wears hard). A pinned or helpless body: always through, past the mitigation. So a rapier needs no margin against padding or leather and 2 against iron mail; a longsword none against iron mail, 2 against steel; a level-1 spear 7 against steel plate.',
    'The user\'s armor research (2026-10-20): flexible mail passes 1.5× as much of a cut\'s leftover force as blunt (armor.yaml transmit), so a greatsword power cut breaks bones through it; padding and leather stop a cut unless it carries massive momentum: slashing left after their mitigation beyond 8 (× protection) cuts through (armor.yaml cutThrough); hardened steel protects ×1.5 (was 1.25). Padding is assumed under mail and plate (one piece, no layering).',
    'Plate spreads a blow it turns (the user\'s call): half of the blunt left after its mitigation from a cut or a point (converted cuts, turned points) never reaches stamina; a crushing blow (a mace, a hammer, a club, a fist) carries as before (armor.yaml dissipate {glancing: 0.5, crushing: 0}; less as the plate wears). Spreading crushing blows too left maces 2–13% against plate in the weapon sweep (sim/FINDINGS.md).',
    'Armor wear per hit is a third of (blunt + converted slashing); armor keeps at least 75% of its mitigation until destroyed.',
    'Cover (the user\'s choice, 2026-10-29): when a blow comes at someone who puts up no defence of their own, an ally within a square with a ready shield may block it for them, paying a block\'s ticks and stamina, at −1 to the block roll; the bearer\'s shield and arm take it.',
    'Blocks are contested (the user\'s call) and the easiest defence: d10 + Shield Training + the shield (buckler 1, round 2, heater 3, tower 4) + ⌊(STR + DEX)/4⌋ against the attacker\'s d10 + ⌊(STR + SPD)/4⌋ + motion. A dodge was the hardest (−2; since 2026-11-03 it pays the armor\'s penalties again instead). A defence that works still costs stamina: half the blow\'s force for a block, a quarter for a parry, none for a dodge; a dodge costs 1 base stamina (Specifics 2). Untrained against a sword swing: block 72% (a round shield), parry 64%, dodge 55% unarmored, 45% in leather, 36% in mail, 10% in plate (before 2026-11-03: 36% in all but plate, 28%). Bind (feat): a successful parry lets you try a disarm at once.',
    'Range (the user\'s reach, compressed to 1–3 in the overhaul\'s step B): daggers 1; one-handed swords, maces and axes swing 1 and thrust 2; two-handed weapons swing 2 and thrust 3, cramped at 1 (pommel, haft); spears thrust to 3 (the spear and heavy spear cramped at 1, the short spear reaches 2); the war scythe sweeps at 2 and does not thrust; Lunge adds 1 to a thrust. Long blades and spears are cramped in a clinch; daggers, clubs, maces and hammers are not, nor are half-swording and the murder stroke. Cramped blows land with half their force, all as blunt. Movement covers twice the Specifics squares.',
    'Weapons in hand: drawing a weapon takes 1 tick; dropping one costs nothing; picking one up 5. Drawing while holding a weapon drops it (a dagger is sheathed instead). A character held in a grapple fights cramped with any weapon, dagger included: half force, all blunt.',
    'Shove (5 ticks, range 1): opposed d10 + ⌊STR/2⌋ (+2 with a two-handed weapon) vs d10 + footing. A win pushes the target back 1 square, 2 on a margin of 5+; if they can\'t move, a margin of 5+ knocks them down.',
    'Shields vs power attacks: a blocked power swing breaks the shield outright if the weapon is at least as hard as the shield (wood < iron < steel) unless the shield is masterwork, and force above the shield\'s break threshold drives through as blunt damage. Every block wears a shield twice as fast as before.',
    'Spear and heavy spear (not in the catalog): spear point 8/0/0, thrusting 2–3, one hand, 1.7 kg; heavy spear the same point, two hands, 2.6 kg, which bursts any mail.',
    'Bows (not in the design docs): every bow is drawn, then loosed (the user, 2026-11-01), a stronger bow dearer for more range and damage (weapons.yaml `draw`): shortbow arrow 5 P, range 2–12, 8 ticks with a 3-tick draw (step F; drawn 1 AP and loosed 2 before); longbow 7 P, range 2–16, drawn 2 AP and loosed 4; −2 damage at long range; arrows can be blocked, not parried or dodged (2026-11-03: dodging is for melee blows); no STR bonus; one arrow per shot.',
    'Arrows and armor (history): armor catches arrows better than a thrust. Extra piercing protection against arrows: padded +2, leather and mail +1, plate 0. Two arrowheads: broadheads cut terrible wounds (bleed ×1.5) but punch weakly (×0.7: a longbow broadhead needs a margin against mail); bodkins do 1 less damage but punch hard (×1.5: a longbow bodkin goes through mail at any margin; plate needs a big one).',
    'Weapons from physics: each weapon has a mass, a length, hands and a point (depth, width), an edge or a head. Damage: point depth/4 piercing; edge (2 + 3√(mass × length × grip)) slashing; head 1 + 6√(head mass × length × grip) blunt. Speed: thrusts cost more with mass, swings with √(mass × length), the longsword costing what the motion table lists. STR adds strBonus × 0.25–0.5 to a thrust (by wound width) and × mass/1.4 (× 1.5 two-handed, up to 1.5) to a swing. A piercing wound bleeds damage × width/4 over 2 + depth/15 rounds.',
    'Fend off and push back: with a long weapon (reaching 3 or more) a shove reaches 2 squares; a ready shield adds +1.',
    'Bait and Read intent (in-combat charm and wisdom): Bait (3 ticks, within 3 squares) is d10 + ⌊CHA/2⌋ + Feint against d10 + ⌊WIS/2⌋ + Read Attack: they are drawn off balance and defend at −2 until the next beat. Read intent (a tick, within 4, in sight): the reader rolls d10 + ⌊WIS/2⌋ + Read Attack against 5 + the foe\'s ⌊CHA/2⌋ + Feint, a number they don\'t see. Made it: the foe\'s true intent (what they have committed to this round, feints seen through) and +2 to defend against them and to beat their defenses. Missed by 1–3: nothing to go on. Missed by 4 or more: a confident misread — a false intent and −2 — reported just like a true read. Hex + Mind baits by magic (WIL resists); Bless + Mind gives foresight (true reads of every foe).',
    'Impact: blunt past armor beyond 8 points breaks bone (a point of a crushing wound per 2 over, the threshold × size for big bodies) as well as winding; a blow that lands throws its target back a square per 8 points landed (blunt in full, cuts and points at half), ÷ size, up to 3.',
    'Weapon weight and strength (TUNED): a weapon has a natural speed strength can\'t beat (light and short is quick; long travels farther), and a strain: its load (mass for a thrust; mass with the leverage of its length for a swing) over the wielder\'s capacity (0.3 kg per STR point, ×1.5 two-handed, +10% per Heavy Weapon Training rank). Within capacity it swings at its natural speed; past it ticks and stamina rise with strain²; past 3× it is too ungainly to use. A man (STR 7) can barely lift a giant\'s club; an ogre swings it like a sword.',
    'Ogre and hill giant; size and grip: big creatures (trait size: ogre 1.5, giant 2.5) take vital wounds less often (+4 × (size − 1) to the margin one needs: CONFIG.vital.perSize) and bleed less per wound (÷ size): a man-sized wound is shallow in a big body. Grip (giant 5, ogre 2) adds to grapple rolls: a giant seizes a man in one hand. A big body holds wound boxes × size and needs points × size for each severity (step E: where an ogre\'s toughness comes from). The ogre (level 8, STR 23, CON 10) swings a crude giant club and its fists; no regeneration. The hill giant (level 12, STR 28, CON 10) swings a giant club one-handed, hurls boulders (range 2–10, 14 blunt, can knock down) and grapples.',
    'Drakes, wyverns, the constrictor and the golem: fliers (drake, wyvern) pass over rough ground, pits, traps, hazards and walls that aren\'t solid (solid walls still stop them) and are slippery to grab. The drake (level 8) has drake scales (P4 S4 B2), a bite, claws, a reach-2 wing buffet that can knock you down, 1.5× movement and fire breath (Burst + Fire, Strong for a bigger one). The wyvern (level 10) has heavier scales (P5 S5 B3), a reach-2 bite, a venomous stinger (3 CON a round over 4 rounds at full depth) and a crushing wing beat. The giant constrictor grapples beyond any human (Grappler III, STR 18) and crushes whoever it holds every round (−8 stamina, −1 CON), but it has one victim at a time and thin scales. The golems (clay, stone, iron) share one body and reach-2 fists and never tire; each is immune to two of fire, slashing and blunt and weak (×1.5) to the third, and all three are immune to mind and life magic (resist by damage keyword).',
    'Rats and the spectre: giant rats are weak (STR 3, a third of the stamina) and come alone or as a swarm of six. The spectre is a level-15 undead: incorporeal (weapons without an enchantment pass through; nothing to grab, trip or shove), a legendary war scythe that drinks half the stamina and wounds it deals, and a wail each round that frightens every foe within 2 squares unless they resist (WIL). Magical weapons (high-level gear) and spells hurt it.',
    'Aura of dread and trinkets: at the fight\'s start and each beat, every foe within the aura (2 squares of the revenant knight) loses 3 stamina and is in Dread until the next beat (−1 STR, DEX and SPD, −1 to guard). Trinkets are worn items that shift attributes or ticks: the revenant knight\'s flowing black silk sash gives +1 SPD and +1 AP.',
    'End-game gear and the revenant knight (test build): masterwork dwarven steel plate, a masterwork adamant heater (×3.5) and Soulreaver, a masterwork longsword enchanted with Drinking and Keenness. Battle Casting (feat, adept, needs Casting II): cast with both hands full. Drinking: the wielder takes back half the stamina and half the attribute points each blow deals. The revenant knight is a level-20 character at the human cap (22 feats: Casting IV, Burst, Conjure, Strong, Battle Casting, plate and shield training); Burst + Life + Strong withers a whole area through armor, and Conjure + Life raises the fallen.',
    'Rituals (magic phase 3 draft): Read, Seek, Divine, Speak, Mend, Prepare, Summon, Raise. Each takes time (shortened by Ritualist), spell points (−1 per Ritualist rank) and components (spent win or lose). Roll d10 + ⌊INT/2⌋ + Ritualist (+3 with True Naming and a true name) against the GM\'s tier (easy 6, moderate 8, hard 10, very hard 12, legendary 14): margin 0+ partial, 3+ full, 6+ exceptional; −5 or worse turns on the caster. Information rituals reveal the GM\'s secrets about the subject that the roll could reach (1 / 2 / 3 by outcome). Mend heals 1 / 2 / 4 CON and stops bleeding (exceptional draws out poison and disease). Prepare lays a ward, boon or rune that takes hold when the next fight starts, twice as long.',
    'WIL split from WIS (the user\'s call): eight attributes. WIL is resolve: magic defense, resisting fear and compulsion, acting through wounds (step E: pain), coming round from a collapse sooner, and with CON stamina regeneration (⌊(CON + WIL) × 0.75⌋ − armor). WIS stays judgment and perception. Older characters get WIL = their WIS.',
    'Monster attributes go past the human range (1–10, 13 with Conditioning feats), up to 30: bears and trolls STR 16–20, a troll chieftain 24. The usual formulas apply to the raw number (damage bonus ⌊(STR−5)/2⌋, grappling ⌊STR/2⌋, stamina). CON stays in the human range (step E): what a monster\'s high CON stood for is its size (wound boxes), its hide (armor) or nothing.',
    'Monsters (draft): natural weapons are always ready and can\'t be dropped; natural armor can\'t be looted. Traits: knockdown bites, pack bonus (+1 damage per packmate beside the target), venom (Poisoned: up to 2 points of harm a round for 3 rounds, no more than the wound\'s severity; bandages don\'t stop it), rust (corrodes metal armor and shields), displacement (each attack first rolls a d10 to find the real creature: arrows miss on 1–5, blows on 1–2), springy chitin (a blow that lands costs the attacker 3 stamina), sticky webs (each layer adds 3 ticks and 3 stamina to every action, up to two layers; one layer comes loose each round; tear free with d10 + ⌊STR/2⌋ ≥ 8, or burn them), shield-crushing blows, regeneration (unless burned), tireless (undead and constructs: no stamina, blunt breaks the frame, no bleeding, shock or venom), finishes (the AI strikes foes that are down: beasts that feed, the cruel, the undead), resistances (skeletons: no piercing, half slashing), nimble, slippery, leaping, and boss multipliers on AP and stamina.',
    'Magic feat tiers count feats across all four magic sub-trees (otherwise Casting and Fire Affinity can never pass rank I).',
    'Plate: +1 stamina per action and −9 regeneration a round (Specifics: +2 and −4, before the ×3 was folded in), tuned in the arena.',
    'Defense checks: parry and dodge are opposed rolls: defender d10 + Training + ⌊(DEX + SPD)/4⌋ (armor lowers both) against attacker d10 + ⌊(STR + SPD)/4⌋, +1 for a two-handed swing, +2 for a power swing. Ties go to the defender. A power blow can\'t be parried, only dodged or blocked. Blocks: see above.',
    'Block, parry and dodge differ in kind (the user, 2026-11-03). Block: the best odds (the shield\'s size), and the blow rebounds: the attacker\'s clock takes a third of the blow\'s ticks (CONFIG.clock.rebound). Parry: no shield, so worse odds, by leverage: + 3 × x / (1 + |x|), rounded, x = log2(my weapon\'s best blow ÷ the blow\'s force), 0 between equal weapons, toward +3 (a heater\'s worth) as mine outweighs the blow, toward −3 as it is outweighed (this replaces the force term); the blow rebounds a sixth of its ticks (Beat, a new feat: another sixth per rank); and a successful parry opens a riposte, a blow of the parrying weapon at once for its ticks, which the attacker may defend (the Riposte feat makes it cost none; before, only the feat, a free undefended thrust). Dodge: melee blows only (no arrows or bolts), pays the armor\'s SPD and DEX penalties again (−2 dropped), negates the blow and costs the attacker nothing.',
    'Parrying dagger: held in the off hand (no shield, no two-handed weapon). It stabs (off-hand thrust) and gives an Off-hand parry (2.5 ticks, +1 to the roll) that meets thrusts only.',
    'A successful parry or dodge negates the strike\'s damage completely (a parry still costs stamina, see blocks).',
    'Stamina as a pool (the tuning plan\'s rulings R1 to R3, the user, 2026-11-11; CONFIG.stamina; step E\'s plain numbers). Max stamina = 20 + STR + SPD + DEX. R1: regeneration every round, struck or not: ⌊(CON + WIL) × 0.75⌋ − armor, half of it (rounded up, at least 1) in a round a blow took stamina; heavy armor\'s negative regeneration whole every round. R2: an action whose stamina the fighter can\'t pay is taken spent instead of refused: it leaves them at 1, a spent blow is 2 easier to meet and lands at × 0.5 (vigor.spent), a defence taken spent is 2 harder. R3: stamina 0 is a collapse: prone, no actions or reactions for the rest of the round and 2 − ⌊WIL/5⌋ more (WIL 5: one), then they come round with a round\'s regeneration (at least 1) and must stand; rouse, healing and Rally bring them round at once; a collapsed body keeps its armor; the tireless never collapse. A fight still ends when a side has nobody standing (collapsed counts as down). Second Wind: regenerates in full when struck and a collapse lasts only its own round. Rally: a round\'s regeneration at once to your side within 3 and the collapsed among them come round.',
    'Actions cannot be paid if they would drop your own stamina to 0 (with CONFIG.stamina.spent they are taken spent instead, down to 1).',
    'Heavy-armor negative regeneration applies every beat, struck or not. The down and the collapsed don\'t regenerate.',
    'Items (the user\'s call): every weapon, armor piece and shield is a type plus a material (materials.yaml: cloth, leather, bronze, iron, steel; exotic spider silk, dragon hide, star iron, adamant), an origin (origins.yaml: common, elven, dwarven, goblin: how weight trades against durability, damage and protection), a craftsmanship (crafts.yaml: poor, average, masterwork: how fast it wears and how easily it breaks, never its damage or protection) and enchantments (enchantments.yaml; usually none). Armor tiers: padded, leather, mail, plate (scale is folded into steel mail). Old saves: quality crude → poor, standard and fine → average, masterwork and legendary → masterwork.',
    'Armor durability: padded 20, leather 25, mail 40, plate 60 (× material toughness, origin, craftsmanship and coverage; padding takes no wear).',
    'Parry carry-through (the user\'s idea, 2026-10-24): a parried swing whose force (its expected damage) beats the parrying weapon\'s own best blow carries through, weakened: (force − mine) / force of each face lands. A parried thrust is stopped. The overwhelm term left the parry odds (parryForce.over 2 → none), so a heavy blow isn\'t counted twice; force still makes a parry harder (parryForce.per). A rapier parrying a greatsword cut keeps off about half of it when the parry succeeds; a sword against a giant\'s club, almost none.',
    'Aimed blows (armor by location, step 2; step A): a strike may name a location (a Location menu beside the attack; the AI and the menu default to the place worth most: the blow\'s value there × the chance it lands against the target\'s best defence). Aiming costs off the contest: head 3, arms 1, legs 1, torso 0 (guarded, head 5: R6); a thrust one less; a shield blocks blows aimed at the torso or arms 1 more easily. An aimed blow that lands, lands where aimed (step A: the on-target roll, locations.aim.hold, is gone).',
    'Armor by hit location (the user\'s choice, 2026-10-24; docs/PROPOSALS.md §2, step 1; four since step A): four locations (head 8%, torso 40%, arms 23%, legs 29% of the body: rules.yaml locations; the arms take in the hands and the legs the feet), which are also the armor slots. A piece covers some of them, protects fully there, and carries that share of its type\'s weight, penalties, durability and price; a coverage keyword reads as locations (half = torso, arms, legs; partial = torso). A blow against a body rolls d100 for where it lands; the AI sees the expectation over them. A cut that gets through a limb or the head (bare, or cutting through cloth or leather) carries the slashing beyond 3 into the worst-guarded place beside it (locations.next), whose armor meets it. An old save\'s pieces fold hands into arms and feet into legs (src/game/save.js); a piece that then overlaps another comes off into the pack.',
    'Shield wear per block = ½P + ½S + B.',
    'Kick: opposed d10 + ⌊STR/2⌋; a kick knocks down only on a win by 3 or more. Trip wins on any margin.',
    'Disarm: d10 + ⌊DEX/2⌋ opposed (+2 for a two-handed grip). Grapple: d10 + ⌊STR/2⌋ + Grappler rank vs. d10 + ⌊max(STR,DEX)/2⌋.',
    'Prone: +1 damage to attacks against you, +3 ticks on your defences, no dodging. Grappled: +3 ticks on defences, no movement.',
    'Grappling ladder: free → clinch → hold → pin, each step a directly opposed d10 roll (⌊STR/2⌋ + Grappler; breaking free may use ⌊max(STR, DEX)/2⌋ + Escape Artist). Win by 5+ for two steps; lose by 5+ and it can reverse. Clinch: both cramped with long weapons, no two-handed swings or bows, no stepping away without a break. Hold: the held fighter can\'t move and fights cramped with every weapon, dagger included; the holder keeps a dagger hand and can drag them a square. Pin: the pinned fighter can only try to break; a point always gets through their armor, past its mitigation, and a Coup de Grâce dagger ignores it. Throw: from a hold or pin, prone a square away. Armor is easy to grab (+1 mail, +2 plate to grapple and pin) but hard to throw (footing +1 / +2). Costs in base ticks / stamina: clinch 5 / 3, grapple, pin and throw 10 / 5, break 2 / 3, and 2 stamina a round to keep a hold.',
    'Getting up from prone, base ticks / stamina by armor: none, padded or leather 3 / 1; mail 5 / 2; plate 15 / 5; half of it is the lead (still on the ground till it is done). Kip-Up: 3 ticks.',
    'Movement costs only the armor stamina penalty, once per move action.',
    'Bandage: 10 ticks, half of them lead (3 with Field Dressing) and uses one bandage: every wound stops bleeding, and Medicine (d10 + Medicine + ⌊(INT + WIS)/4⌋ against 6 + severity) mends the worst wound not yet tended a step (step E, CONFIG.wounds.tend).',
    'Long rest repairs 25% of max armor and shield durability (+25% with Field Repair).',
    'Spell bolts and shields (the user\'s magic items, 2026-10): an ordinary shield can\'t block a spell bolt (and since 2026-11-03 it can\'t be dodged either: dodging is for melee blows); a shield enchanted with Spellcatching can, and a weapon with parrySpells can parry one. Before, any shield stopped a fire bolt whole and took no wear from it.',
    'Magic items (the user\'s list, 2026-10): worn things (head, neck, shoulders, cape, arms, hands, two rings, legs, boots; the chest is the armor) and enchantments carry effects (attributes, ticks and × ticks on every action, regeneration, stamina, spell points, magnitude, a tie on the clock, to beat a defence, squares per move, elemental resistance, auras, retaliation, bane damage, disposition, healing per rest), weapon on-hit effects (conditions, a burning blow, sapping STR and stamina, eating armor, Riled: +n mitigation until next hurt) and powers (a spell cast with no spell points, free hand or backlash, from charges that come back each long rest). Placeholder names; numbers untested by sims.',
    'Companions (the user\'s idea): Familiar (magic, casting I) and Animal Companion (perception, Keen Eye I) give a creature that fights beside its owner, run by the AI, wounds kept between fights (rules.yaml game.companions). A familiar adds 2 spell points per rank while it lives; its death costs the owner 2 WIL. A dead companion is replaced after a rest in town.',
    'Fear (the user, 2026-11-08): a frightened creature can\'t come closer to what frightens it, not even a square of the way, and each beat its first action must be a step at least a square farther from it (no other action, no ending or deferring the turn), unless it can\'t: down, held, or hemmed in. It may strike or shoot at it (before: it could not). The same for Give + Fear, Demoralize, the spectre\'s wail and every fear aura. The AI keeps backing away while within 3 squares. Shoves, throws and knockback stop at walls, and the squares a body is driven into count as entered (pits, runes, fire).',
    'Very light and light weapons count as "light weapons" for Light Touch and Precision.',
    'Lava (the fire-goblin mine, 2026-10-31; the user, 2026-11-02): Fire 6 on entering and at each round\'s end in it. Nobody walks into lava they can see (a route neither ends in nor crosses it; fliers pass over); only a shove or a fall puts someone there, and they can walk out. Other visible hazards are gone round when there is a way round, and a move onto or across one takes a second confirmation.',
    'Distance (the overhaul, step B): reach, range, spell radii and every "within n squares" are rounded Euclidean distance (Combat.dist: round(hypot(dx, dy))), so reach 1 is the eight squares around, reach 2 leaves out the far corners (2, 2) and a radius-2 area is a rounded disc. A move counts every second diagonal step as two squares (Combat.steps; paths round walls count the same). Before, both were Chebyshev: a diagonal was free and a reach-4 spear covered a 9 × 9 block.',
    'Reach compressed to 1–3 (the overhaul, step B; weapons.yaml): spear and heavy spear thrust 3 (cramped at 1), short spear 2, war scythe 2, giant\'s club 3; natural weapons 1–2 as before; Lunge +1. Before: spears 4, short spear 3, scythe 2–3.',
    'Flanking (the overhaul, step B; CONFIG.flank): a defence against a blow is at −2 while another foe on its feet that threatens the defender (a melee blow that reaches them, the line clear) stands on the far side, the two bearings from the defender more than 120° apart. No facing. A foe whose way in is covered, the square beside the defender towards it holding a wall or a standing ally of theirs, doesn\'t count. The AI weighs it: it walks in to put a foe between itself and an ally, takes a free step to do so before a blow, prefers a flanked target, and keeps out from between two foes (a wall at its back, a corner, a friend beside it). The odds panel shows it. The number is a first guess.',
  ];

  G.CONFIG = CONFIG;
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
