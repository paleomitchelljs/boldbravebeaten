/*
 * Catalogs from the Game System Specifics doc: weapons, armor, shields,
 * item keywords, rarity, and feat trees.
 */
(function (G) {
  'use strict';

  // ---- Armor (Specifics: full-coverage values) ----------------------------
  const ARMOR = {
    padded: { name: 'Padded', mit: { P: 1, S: 1, B: 3 }, spd: 0, dex: 0, stamina: 0, regen: 1, standUp: 0, rarity: 'common' },
    leather: { name: 'Leather', mit: { P: 1, S: 2, B: 1 }, spd: 0, dex: 1, stamina: 0, regen: 1, standUp: 0, rarity: 'common' },
    mail: { name: 'Mail', mit: { P: 1, S: 4, B: 1 }, spd: 1, dex: 1, stamina: 1, regen: 2, standUp: 1, rarity: 'uncommon' },
    scale: { name: 'Scale', mit: { P: 2, S: 4, B: 2 }, spd: 2, dex: 2, stamina: 1, regen: 3, standUp: 1, rarity: 'rare' },
    plate: { name: 'Plate', mit: { P: 4, S: 6, B: 3 }, spd: 3, dex: 2, stamina: 2, regen: 4, standUp: 2, rarity: 'very rare' },
    // PROVISIONAL (monster draft): natural armor. No penalties; it can't be taken off or looted.
    fur: { name: 'Thick fur', mit: { P: 1, S: 1, B: 2 }, spd: 0, dex: 0, stamina: 0, regen: 0, standUp: 0, rarity: 'common', natural: true },
    chitin: { name: 'Chitin', mit: { P: 2, S: 3, B: 1 }, spd: 0, dex: 0, stamina: 0, regen: 0, standUp: 0, rarity: 'common', natural: true },
    trollHide: { name: 'Troll hide', mit: { P: 1, S: 2, B: 3 }, spd: 0, dex: 0, stamina: 0, regen: 0, standUp: 0, rarity: 'common', natural: true },
  };

  // ---- Shields (Specifics) ------------------------------------------------
  const SHIELDS = {
    buckler: { name: 'Buckler', blockAP: 1, threshold: 6, durability: 10, rarity: 'common' },
    round: { name: 'Round', blockAP: 2, threshold: 9, durability: 20, rarity: 'uncommon' },
    heater: { name: 'Heater', blockAP: 2, threshold: 12, durability: 30, rarity: 'rare' },
    tower: { name: 'Tower', blockAP: 3, threshold: 16, durability: 45, rarity: 'very rare' },
  };

  const SHIELD_MATERIALS = {
    wood: { name: 'Wooden', mult: 1.0, rarity: 'common' },
    hide: { name: 'Hide-faced', mult: 1.2, rarity: 'common' },
    iron: { name: 'Iron-rimmed', mult: 1.5, rarity: 'uncommon' },
    steel: { name: 'Steel', mult: 2.0, rarity: 'rare' },
  };

  // ---- Quality (Specifics) ------------------------------------------------
  const QUALITY = {
    crude: { name: 'Crude', durability: 0.6, bonus: -1, threshold: 0.6, rarity: 'common' },
    standard: { name: 'Standard', durability: 1.0, bonus: 0, threshold: 1.0, rarity: 'common' },
    fine: { name: 'Fine', durability: 1.3, bonus: 1, threshold: 1.3, rarity: 'uncommon' },
    masterwork: { name: 'Masterwork', durability: 1.6, bonus: 2, threshold: 1.6, rarity: 'very rare' },
  };

  const COVERAGE = {
    full: { name: 'Full' },
    half: { name: 'Half' },
    partial: { name: 'Partial' },
  };

  // ---- Weapons (Specifics) ------------------------------------------------
  // faces: [P, S, B]. motions: which motions the weapon allows.
  // Range, in grid squares (PROVISIONAL scale: 1 = clinch, 2 = sword distance, 3+ = long):
  //   reach        — farthest a swing reaches; swings work from 1 up to reach
  //   thrust.ext   — extra reach for thrusts; thrust.min — closest a thrust works
  //   closeOK      — works up close (range 1); otherwise its attacks need range 2+ (CONFIG.range.closeRule)
  //   ranged       — bows: { min, max, long } (beyond `long` damage drops)
  //   material     — what the striking part is made of (for breaking shields)
  //   drawWindUp   — the shot must be drawn (wound up) a round ahead
  const WEAPONS = {
    club: {
      name: 'Club', hands: 1, weight: 'light', reach: 2, reachName: 'short', closeOK: true, material: 'wood',
      faces: { head: [0, 0, 4] }, motions: ['swing', 'power'], rarity: 'common',
      notes: 'Cheapest; common starter.',
    },
    spikedMace: {
      name: 'Spiked mace', hands: 1, weight: 'medium', reach: 2, reachName: 'short', closeOK: true, material: 'steel',
      faces: { head: [3, 0, 6] }, motions: ['swing', 'power'], rarity: 'uncommon',
      notes: 'Spikes carry piercing through armor to CON.',
    },
    flangedMace: {
      name: 'Flanged mace', hands: 1, weight: 'medium', reach: 2, reachName: 'short', closeOK: true, material: 'steel',
      faces: { head: [0, 2, 7] }, motions: ['swing', 'power'], rarity: 'uncommon',
      bluntMitigationIgnore: 2, notes: 'Flanges concentrate force: −2 to target blunt mitigation.',
    },
    dagger: {
      name: 'Dagger', hands: 1, weight: 'very light', reach: 1, reachName: 'close only', closeOK: true, material: 'steel',
      faces: { point: [5, 0, 0], edge: [0, 3, 0] }, motions: ['thrust', 'swing'], rarity: 'common',
      sidearm: true, grappleUsable: true,
      notes: 'Lowest AP; works up close with no penalty but cannot reach sword distance; usable while grappling.',
    },
    rapier: {
      name: 'Rapier', hands: 1, weight: 'light', reach: 2, reachName: 'long thrust', thrust: { ext: 1, min: 1 }, material: 'steel',
      faces: { point: [6, 0, 0], edge: [0, 2, 0] }, motions: ['thrust', 'swing'], rarity: 'uncommon',
      notes: 'Thrusts reach one square farther; ungainly up close; weak edge.',
    },
    longsword: {
      name: 'Longsword', hands: 1.5, weight: 'medium', reach: 2, reachName: 'medium', material: 'steel',
      faces: { point: [5, 0, 0], edge: [0, 7, 1], hilt: [0, 0, 5] }, motions: ['thrust', 'swing', 'twoHanded'],
      sword: true, rarity: 'uncommon', notes: 'Versatile; half-sword and murder stroke work up close.',
    },
    greatsword: {
      name: 'Greatsword', hands: 2, weight: 'heavy', reach: 3, reachName: 'long', material: 'steel',
      faces: { point: [6, 0, 0], edge: [0, 9, 2], hilt: [0, 0, 6] }, motions: ['thrust', 'twoHanded', 'power'],
      sword: true, rarity: 'rare', notes: 'No shield; long reach.',
    },
    warhammer: {
      name: 'Warhammer', hands: 1.5, weight: 'heavy', reach: 2, reachName: 'medium', closeOK: true, material: 'steel',
      faces: { head: [0, 0, 8], beak: [6, 0, 1] }, motions: ['swing', 'twoHanded', 'power'], rarity: 'rare',
      hook: true, notes: 'Anti-plate: head drains stamina, beak pierces to CON.',
    },
    // PROVISIONAL: the spear is listed in the rarity table but not the weapon catalog.
    spear: {
      name: 'Spear', hands: 1, weight: 'medium', reach: 2, reachName: 'thrusts 2–4, not up close', thrust: { ext: 2, min: 2 }, material: 'steel',
      faces: { point: [6, 0, 0] }, motions: ['thrust'], rarity: 'uncommon',
      notes: 'Thrusts reach far but not up close; shove an enemy back out to range.',
    },
    // PROVISIONAL: bows are not in the design docs yet.
    shortbow: {
      name: 'Shortbow', hands: 2, weight: 'light', reach: 0, reachName: 'range 2–12', ranged: { min: 2, max: 12, long: 8 },
      faces: { arrow: [5, 0, 0] }, motions: ['shoot'], rarity: 'common', shootAP: 3, shootStamina: 1, material: 'steel',
      notes: 'Arrows can be blocked or dodged, not parried. −2 damage beyond 8 squares.',
    },
    longbow: {
      name: 'Longbow', hands: 2, weight: 'medium', reach: 0, reachName: 'range 2–16', ranged: { min: 2, max: 16, long: 10 },
      faces: { arrow: [7, 0, 0] }, motions: ['shoot'], rarity: 'uncommon', shootAP: 4, shootStamina: 2, material: 'steel', drawWindUp: true,
      notes: 'Heavy draw: drawn one round, loosed the next. −2 damage beyond 10 squares.',
    },

    // ---- Natural weapons (PROVISIONAL, monster draft) ------------------------------
    // Always ready, can't be dropped or disarmed. `trait` adds a special effect to the blow:
    //   knockdown  — opposed STR check after a hit; wins by `margin` → prone (wolves drag prey down)
    //   venom      — a bite that draws blood poisons: up to con CON a round (no more than the wound)
    //                for `rounds` rounds; a bandage doesn't stop it
    //   rust       — no damage; corrodes metal armor (or a blocking metal shield) by `rust` durability
    //   shieldCrush — every blow caught on a shield counts as a power blow (can break it, drives through)
    wolfBite: {
      name: 'Bite', hands: 1, weight: 'light', reach: 1, reachName: 'close', closeOK: true, natural: true, grappleUsable: true,
      faces: { point: [4, 0, 1] }, motions: ['thrust'], rarity: 'common', trait: { knockdown: { bonus: 2, margin: 3 } },
    },
    alphaBite: {
      name: 'Bite', hands: 1, weight: 'light', reach: 1, reachName: 'close', closeOK: true, natural: true, grappleUsable: true,
      faces: { point: [5, 0, 1] }, motions: ['thrust'], rarity: 'common', trait: { knockdown: { bonus: 3, margin: 3 } },
    },
    spiderBite: {
      name: 'Venomous bite', hands: 1, weight: 'very light', reach: 1, reachName: 'close', closeOK: true, natural: true, grappleUsable: true,
      faces: { point: [3, 0, 0] }, motions: ['thrust'], rarity: 'common', trait: { venom: { con: 2, rounds: 3 } },
    },
    antennae: {
      name: 'Rusting antennae', hands: 1, weight: 'very light', reach: 2, reachName: 'reach 2', closeOK: true, natural: true,
      faces: { head: [0, 0, 0] }, motions: ['swing'], rarity: 'common', trait: { rust: 25 },
    },
    mandibles: {
      name: 'Mandibles', hands: 1, weight: 'light', reach: 1, reachName: 'close', closeOK: true, natural: true, grappleUsable: true,
      faces: { point: [2, 1, 0] }, motions: ['thrust'], rarity: 'common',
    },
    tentacles: {
      name: 'Spiked tentacles', hands: 1, weight: 'light', reach: 2, reachName: 'reach 2', closeOK: true, natural: true,
      faces: { head: [3, 2, 3] }, motions: ['swing'], rarity: 'common', material: 'bone',
    },
    claws: {
      name: 'Claws', hands: 1, weight: 'medium', reach: 1, reachName: 'close', closeOK: true, natural: true, grappleUsable: true,
      faces: { edge: [0, 5, 1] }, motions: ['swing'], rarity: 'common', material: 'bone',
    },
    beak: {
      name: 'Beak', hands: 1, weight: 'medium', reach: 1, reachName: 'close', closeOK: true, natural: true, grappleUsable: true,
      faces: { point: [4, 0, 2] }, motions: ['thrust'], rarity: 'common', material: 'bone',
    },
    trollFists: {
      name: 'Fists', hands: 2, weight: 'heavy', reach: 2, reachName: 'reach 2', closeOK: true, natural: true,
      faces: { head: [0, 0, 7] }, motions: ['swing', 'power'], rarity: 'common', material: 'stone', trait: { knockdown: { bonus: 2, margin: 3 }, shieldCrush: true },
    },
  };

  const MOTIONS = {
    thrust: { name: 'Thrust', ap: 2, stamina: 1, faces: ['point'] },
    swing: { name: 'Swing', ap: 3, stamina: 2, faces: ['edge', 'head', 'beak', 'hilt'] },
    twoHanded: { name: 'Two-handed swing', ap: 4, stamina: 3, faces: ['edge', 'head', 'beak', 'hilt'], twoHands: true },
    power: { name: 'Power swing', ap: 5, stamina: 4, faces: ['edge', 'head', 'beak'], requiresFeat: 'power_swing' },
    shoot: { name: 'Shoot', ap: 3, stamina: 1, faces: ['arrow'] },
  };

  // Other actions (Specifics: Action points table; PROVISIONAL rows noted in config)
  const ACTIONS = {
    punch: { name: 'Punch', ap: 1, stamina: 0, damage: [0, 0, 1] },
    kick: { name: 'Kick', ap: 2, stamina: 1, damage: [0, 0, 2] },
    shieldBash: { name: 'Shield bash', ap: 2, stamina: 1, damage: [0, 0, 3] },
    parry: { name: 'Parry', ap: 2, stamina: 1 },
    dodge: { name: 'Dodge', ap: 2, stamina: 2 },
    block: { name: 'Block', ap: null, stamina: 1 }, // AP by shield size
    standUp: { name: 'Stand up', ap: 2, stamina: 1 },
    // PROVISIONAL: drawing is quick; dropping is free. Drawing while holding a weapon drops it
    // (a dagger is sheathed instead).
    drawSidearm: { name: 'Draw sidearm', ap: 0.5, stamina: 0 },
    dropWeapon: { name: 'Drop weapon', ap: 0, stamina: 0 },
    pickUp: { name: 'Pick up weapon', ap: 2, stamina: 1 },
    trip: { name: 'Trip', ap: 3, stamina: 2 },
    disarm: { name: 'Disarm', ap: 3, stamina: 2 },
    shove: { name: 'Shove', ap: 2, stamina: 1 },
    // The grappling ladder (PROVISIONAL; stamina in CONFIG.grappling): free → clinch → hold → pin.
    clinch: { name: 'Clinch', ap: 2, stamina: 3 },
    grapple: { name: 'Grapple', ap: 3, stamina: 5 },
    pin: { name: 'Pin', ap: 3, stamina: 5 },
    throw: { name: 'Throw', ap: 3, stamina: 5 },
    break: { name: 'Break grapple', ap: 2, stamina: 3 },
    release: { name: 'Release hold', ap: 1, stamina: 0 },
    bandage: { name: 'Bandage', ap: 3, stamina: 0 },
    move: { name: 'Move', ap: 1, stamina: 0 },
    windUp: { name: 'Wind up', ap: 2, stamina: 1 }, // costs set in CONFIG.windUp
    readyPrimary: { name: 'Draw main weapon', ap: 0.5, stamina: 0 },
  };

  const RARITY = ['common', 'uncommon', 'rare', 'very rare', 'unique'];

  // ---- Feats (Specifics) --------------------------------------------------
  // ranks: tiers for each rank. requires: list of AND-groups, each an OR-list of "id:rank".
  // auto: true when the engine applies the feat's effect automatically.
  const N = 'novice', A = 'apprentice', D = 'adept', E = 'expert', M = 'master';
  const FEATS = {};
  const TREES = [];
  function tree(id, name, attrs) { TREES.push({ id, name, attrs }); return id; }
  function feat(treeId, id, name, ranks, requires, effect, auto) {
    FEATS[id] = { id, tree: treeId, name, ranks, requires: requires || [], effect, auto: !!auto };
  }

  let t = tree('conditioning', 'Conditioning', 'attributes');
  [['strength', 'Strength', 'STR'], ['toughness', 'Toughness', 'CON'], ['agility', 'Agility', 'DEX'],
   ['quickness', 'Quickness', 'SPD'], ['intellect', 'Intellect', 'INT'], ['insight', 'Insight', 'WIS'],
   ['presence', 'Presence', 'CHA']].forEach(([id, name, attr]) => {
    feat(t, id, name, [N, A, D], [], `+1 ${attr} per rank`, true);
    FEATS[id].attr = attr;
  });

  t = tree('handToHand', 'Hand-to-hand', 'STR, DEX');
  feat(t, 'quick_hands', 'Quick Hands', [N, A, D], [], 'Punch and kick −1 AP per rank', true);
  feat(t, 'brawlers_wind', "Brawler's Wind", [N, A], [], 'Punch, kick, and grapple −1 stamina per rank', true);
  feat(t, 'heavy_hands', 'Heavy Hands', [N, A], [], '+1 blunt on punches and kicks per rank', true);
  feat(t, 'trip', 'Trip', [N], [], 'Better knockdown chance', true);
  feat(t, 'disarm', 'Disarm', [N], [], 'Better disarm chance', true);
  feat(t, 'grappler', 'Grappler', [N, A, D], [], '+1 grapple checks per rank', true);
  feat(t, 'pin', 'Pin', [A], [['grappler:1']], '+2 to pin a held foe and to keep a pinned one down', true);
  feat(t, 'dogpile', 'Dogpile', [A], [['grappler:1']], 'Each ally next to your target adds +2 to your grapple rolls (not +1)', true);
  feat(t, 'takedown', 'Takedown', [D], [['trip:1'], ['grappler:2']], 'Throw straight from a clinch, without a hold first', true);
  feat(t, 'joint_lock', 'Joint Lock', [E], [['pin:1']], 'Grapple deals STR or DEX damage', false);
  feat(t, 'human_shield', 'Human Shield', [E], [['grappler:3']], 'Block a strike with a grappled foe', false);
  feat(t, 'iron_grip', 'Iron Grip', [M], [['joint_lock:1']], "A grappled foe can't escape while you keep paying AP", false);

  t = tree('lightWeapons', 'Light weapons', 'DEX');
  feat(t, 'quick_thrust', 'Quick Thrust', [N, A, D], [], 'Thrust −1 AP per rank', true);
  feat(t, 'light_touch', 'Light Touch', [N, A], [], 'Light-weapon thrusts and swings −1 stamina per rank', true);
  feat(t, 'precision', 'Precision', [N, A], [], '+1 damage with light weapons per rank', true);
  feat(t, 'feint', 'Feint', [N, A, D, E, M], [], 'Hide attack type and cost from Read Attack below your rank', true);
  feat(t, 'parry_training', 'Parry Training', [N, A, D], [], '+parry success per rank', true);
  feat(t, 'quick_parry', 'Quick Parry', [A, D], [['parry_training:1']], 'Parry −1 AP per rank', true);
  feat(t, 'economical_parry', 'Economical Parry', [A, D], [['parry_training:1']], 'Parry −1 stamina per rank', true);
  feat(t, 'riposte', 'Riposte', [A], [['parry_training:1']], 'A successful parry grants a free thrust', true);
  feat(t, 'offhand_dagger', 'Off-hand Dagger', [A], [], 'Parry or strike with an off-hand dagger', false);
  feat(t, 'find_the_gap', 'Find the Gap', [D], [['precision:2']], 'More piercing passes through armor', true);
  feat(t, 'coup_de_grace', 'Coup de Grâce', [D], [], 'Dagger vs. prone or pinned ignores armor', true);
  feat(t, 'lunge', 'Lunge', [E], [['find_the_gap:1']], 'Thrust at +1 reach', true);
  feat(t, 'flurry', 'Flurry', [M], [['quick_thrust:3'], ['riposte:1']], 'Declare two thrusts as one action', false);

  t = tree('heavyWeapons', 'Heavy weapons', 'STR');
  feat(t, 'heavy_weapon_training', 'Heavy Weapon Training', [N, A, D], [], '−1 effective weight per rank (lowers stamina cost)', true);
  feat(t, 'heavy_tempo', 'Heavy Tempo', [A, D], [['heavy_weapon_training:1']], 'Two-handed and power swings −1 AP per rank', true);
  feat(t, 'weight_of_the_blow', 'Weight of the Blow', [N, A], [], '+1 damage on two-handed and power swings per rank', true);
  feat(t, 'power_swing', 'Power Swing', [N], [], 'Unlocks the power swing', true);
  feat(t, 'half_swording', 'Half-Swording', [A], [], 'Unlocks half-sword with swords', true);
  feat(t, 'murder_stroke', 'Murder Stroke', [A], [], 'Unlocks hilt strikes with swords', true);
  feat(t, 'hook', 'Hook', [A], [], 'Beaked or hooked weapons can trip', true);
  feat(t, 'shield_breaker', 'Shield Breaker', [D], [['power_swing:1']], "Blows count double against a shield's break threshold", true);
  feat(t, 'crushing_blow', 'Crushing Blow', [D], [['weight_of_the_blow:2']], 'Blunt ignores 2 points of armor mitigation', true);
  feat(t, 'cleave', 'Cleave', [E], [['power_swing:1']], 'A blow that drops a foe carries the excess to an adjacent foe', false);
  feat(t, 'sweep', 'Sweep', [E], [['heavy_weapon_training:3']], 'A two-handed swing hits two adjacent foes', false);
  feat(t, 'juggernaut', 'Juggernaut', [M], [['crushing_blow:1'], ['cleave:1']], "Power swings can't be parried, only blocked or dodged", true);

  t = tree('armorShields', 'Armor and shields', 'CON, STR');
  feat(t, 'light_armor_training', 'Padded/Leather Training', [N], [], 'Halve padded and leather SPD/DEX penalties', true);
  feat(t, 'mail_mobility', 'Mail Mobility', [N, A], [], '−1 SPD/DEX penalty per rank in mail', true);
  feat(t, 'mail_endurance', 'Mail Endurance', [A], [['mail_mobility:1']], "Removes mail's stamina penalty per action", true);
  feat(t, 'plate_mobility', 'Plate Mobility', [N, A, D], [], '−1 SPD/DEX penalty per rank in plate', true);
  feat(t, 'plate_endurance', 'Plate Endurance', [A, D], [['plate_mobility:1']], '−1 plate stamina penalty per action per rank', true);
  feat(t, 'shield_training', 'Shield Training', [N, A, D], [], '+block success per rank', true);
  feat(t, 'quick_block', 'Quick Block', [A, D], [['shield_training:1']], 'Block −1 AP per rank', true);
  feat(t, 'economical_block', 'Economical Block', [A, D], [['shield_training:1']], 'Block −1 stamina per rank', true);
  feat(t, 'shield_bash', 'Shield Bash', [N], [['shield_training:1']], 'Shield strike: blunt with a knockdown chance', true);
  feat(t, 'field_repair', 'Field Repair', [N], [], 'Restore armor durability outside town', true);
  feat(t, 'quick_donning', 'Quick Donning', [A], [], 'Don armor in half the time', false);
  feat(t, 'iron_stance', 'Iron Stance', [D], [['plate_mobility:1', 'shield_training:2']], 'Resist knockdown and disarm', true);
  feat(t, 'second_wind', 'Second Wind', [D], [['mail_endurance:1']], 'Regenerate stamina even after taking ≤2 blunt last round', true);
  feat(t, 'shield_wall', 'Shield Wall', [E], [['shield_training:3']], 'Block for an adjacent ally', false);
  feat(t, 'living_fortress', 'Living Fortress', [M], [['plate_endurance:2'], ['iron_stance:1']], 'The first blocked or converted hit each round costs no stamina', true);

  t = tree('evasion', 'Evasion', 'SPD, DEX');
  feat(t, 'dodge_training', 'Dodge Training', [N, A, D], [], '+dodge success per rank', true);
  feat(t, 'quick_dodge', 'Quick Dodge', [A, D], [['dodge_training:1']], 'Dodge −1 AP per rank', true);
  feat(t, 'light_on_your_feet', 'Light on Your Feet', [N, A], [], 'Dodge and movement −1 stamina per rank', true);
  feat(t, 'fleet_foot', 'Fleet Foot', [N, A, D], [], '+1 square per movement AP per rank', true);
  feat(t, 'stealth', 'Stealth', [N, A, D], [], '+1 stealth per rank', false);
  feat(t, 'kip_up', 'Kip-up', [N], [], 'Stand from prone for 1 AP', true);
  feat(t, 'escape_artist', 'Escape Artist', [A], [], '+2 to break a clinch, hold or pin', true);
  feat(t, 'slip_through', 'Slip Through', [A], [['fleet_foot:1']], 'Move past enemies without being grabbed', false);
  feat(t, 'roll_with_it', 'Roll With It', [D], [['dodge_training:2']], "A failed dodge halves the strike's damage", true);
  feat(t, 'counter_step', 'Counter-step', [E], [['dodge_training:3']], 'A successful dodge grants a free move', false);
  feat(t, 'untouchable', 'Untouchable', [M], [['counter_step:1']], 'One dodge answers every strike aimed at you in that pass', true);

  t = tree('persuasion', 'Persuasion', 'CHA; WIS to read people');
  feat(t, 'silver_tongue', 'Silver Tongue', [N, A, D], [], '+1 disposition gain per rank', false);
  feat(t, 'read_the_room', 'Read the Room', [N], [], "See an NPC's disposition band", false);
  feat(t, 'flattery', 'Flattery', [N], [], 'Disposition moves cost half patience; weak vs. high-WIS NPCs', false);
  feat(t, 'intimidate', 'Intimidate', [N], [], 'Raise willingness at a disposition cost; uses STR or CHA', false);
  feat(t, 'bargain', 'Bargain', [A], [['read_the_room:1']], 'Better prices; trade concessions for willingness', false);
  feat(t, 'appeal_to_interest', 'Appeal to Interest', [A], [['read_the_room:1']], "Raise willingness by invoking the NPC's faction or goals", false);
  feat(t, 'leading_questions', 'Leading Questions', [D], [['silver_tongue:2']], 'Help an NPC work out knowledge with no disposition loss', false);
  feat(t, 'reputation_control', 'Reputation Control', [E], [['bargain:1', 'appeal_to_interest:1']], 'Choose which side of your reputation an NPC reacts to', false);
  feat(t, 'rally_demoralize', 'Rally / Demoralize', [E], [['intimidate:1']], 'In combat: allies regenerate stamina even when hit, or enemies lose 1 AP next round', false);
  feat(t, 'kingmaker', 'Kingmaker', [M], [['reputation_control:1']], "Shift an NPC's faction allegiance over several meetings", false);

  t = tree('perception', 'Perception', 'WIS; INT for analysis');
  feat(t, 'read_attack', 'Read Attack', [N, A, D, E, M], [], 'See through Feint of equal or lower rank', true);
  feat(t, 'keen_eye', 'Keen Eye', [N, A], [], 'Spot traps, hidden foes, and hidden doors', false);
  feat(t, 'appraise', 'Appraise', [N], [], "Identify an item's keywords and quality", false);
  feat(t, 'tracker', 'Tracker', [A], [['keen_eye:1']], 'Follow trails', false);
  feat(t, 'read_intent', 'Read Intent', [A], [['keen_eye:1']], "See an NPC's willingness and knowledge bands", false);
  feat(t, 'spot_weakness', 'Spot Weakness', [D], [['read_attack:2']], "See an armor's weakest mitigation; more piercing passes through it", true);
  feat(t, 'danger_sense', 'Danger Sense', [D], [['keen_eye:2']], 'Never surprised', false);
  feat(t, 'read_spell', 'Read Spell', [D], [], 'Identify the words of a spell being cast', false);
  feat(t, 'word_thief', 'Word Thief', [E], [['read_spell:1']], 'Learn a noun by watching it cast several times', false);
  feat(t, 'truesight', 'Truesight', [M], [['danger_sense:1'], ['read_spell:1']], 'See through illusions and disguises', false);

  t = tree('medicine', 'Medicine and alchemy', 'INT, WIS');
  feat(t, 'field_dressing', 'Field Dressing', [N], [], 'Stop bleeding with a bandage as a 1-AP action', true);
  feat(t, 'diagnose', 'Diagnose', [N], [], "See a patient's attribute damage and bleed", false);
  feat(t, 'herbalism', 'Herbalism', [N], [], 'Find and identify plant components', false);
  feat(t, 'wound_tending', 'Wound Tending', [N, A, D], [], "+1 per rank to patients' daily heal roll", true);
  feat(t, 'alchemy', 'Alchemy', [N, A, D], [['herbalism:1']], 'Brew potions: stamina, anti-bleed, healing over time', false);
  feat(t, 'poisoner', 'Poisoner', [A], [['alchemy:1']], 'Blade poisons', false);
  feat(t, 'antidotes', 'Antidotes', [D], [['alchemy:2']], 'Cure poison and disease', false);
  feat(t, 'surgeon', 'Surgeon', [D], [['wound_tending:2']], "Patients can't worsen; heal 1 extra point a day from the worst wound", true);
  feat(t, 'reagent_craft', 'Reagent Craft', [E], [['alchemy:3']], 'Refine spell components for rituals', false);
  feat(t, 'physician', 'Physician', [M], [['surgeon:1'], ['antidotes:1']], 'Patients heal at the town rate anywhere', true);

  t = tree('magicCasting', 'Magic: casting', 'INT, WIS/WIL');
  feat(t, 'casting', 'Casting', [N, A, D, E, M], [], 'Larger casting pool per rank', false);
  feat(t, 'control', 'Control', [A, D, E], [['casting:1']], '−backlash per rank', false);
  feat(t, 'quick_casting', 'Quick Casting', [A, D], [['casting:1']], 'Spell AP −1 per rank', false);
  feat(t, 'steady_mind', 'Steady Mind', [D], [['control:1']], 'Cast while grappled or after taking damage this pass', false);
  feat(t, 'focus_bond', 'Focus Bond', [E], [['casting:3']], 'Bond a held weapon or shield as a casting focus', false);
  feat(t, 'overchannel', 'Overchannel', [M], [['casting:5']], 'Cast beyond your pool by paying CON', false);

  t = tree('magicWords', 'Magic: words', 'INT');
  ['Attack', 'Calm', 'Ward', 'Mend'].forEach((w) => feat(t, 'verb_' + w.toLowerCase(), 'Verb: ' + w, [N], [], 'Learn the verb ' + w, false));
  const anyNoviceVerb = ['verb_attack:1', 'verb_calm:1', 'verb_ward:1', 'verb_mend:1'];
  ['Launch', 'Bind', 'Reveal', 'Hold'].forEach((w) => feat(t, 'verb_' + w.toLowerCase(), 'Verb: ' + w, [A], [anyNoviceVerb], 'Learn the verb ' + w, false));
  feat(t, 'verb_explode', 'Verb: Explode', [D], [['verb_launch:1']], 'Learn the verb Explode', false);
  feat(t, 'verb_summon', 'Verb: Summon', [D], [['verb_bind:1']], 'Learn the verb Summon', false);
  feat(t, 'verb_raise', 'Verb: Raise', [E], [['verb_summon:1']], 'Reanimation; needs evil components', false);
  ['Strong', 'Wide', 'Long'].forEach((w) => feat(t, 'mod_' + w.toLowerCase(), 'Modifier: ' + w, [N], [], 'Learn the modifier ' + w, false));
  const anyNoviceMod = ['mod_strong:1', 'mod_wide:1', 'mod_long:1'];
  ['Far', 'Swift', 'Lingering'].forEach((w) => feat(t, 'mod_' + w.toLowerCase(), 'Modifier: ' + w, [A], [anyNoviceMod], 'Learn the modifier ' + w, false));

  t = tree('magicAffinity', 'Magic: affinity (fire)', 'INT');
  feat(t, 'fire_affinity', 'Fire Affinity', [N, A, D], [], '+magnitude for Fire spells per rank (requires knowing the Fire noun)', false);
  feat(t, 'kindling', 'Kindling', [A], [['fire_affinity:1']], 'Fire spells set targets burning', false);
  feat(t, 'cauterize', 'Cauterize', [A], [['fire_affinity:1'], ['field_dressing:1']], 'Stop bleeding with fire; costs 1 CON', false);
  feat(t, 'firestorm', 'Firestorm', [D], [['fire_affinity:2'], ['mod_wide:1']], 'Fire + Wide costs 1 less', false);
  feat(t, 'ember_heart', 'Ember Heart', [E], [['fire_affinity:3']], 'Resist fire; recover casting power standing in flame', false);
  feat(t, 'living_flame', 'Living Flame', [M], [['ember_heart:1']], 'Summon a fire spirit without knowing its name', false);

  t = tree('magicRitual', 'Magic: ritual', 'INT, WIS');
  feat(t, 'ritualist', 'Ritualist', [N, A, D], [], 'Faster rituals; fewer components per rank', false);
  feat(t, 'binding_circle', 'Binding Circle', [N], [['ritualist:1']], 'Prepare binding runes for summons', false);
  feat(t, 'warding', 'Warding', [A], [['ritualist:1']], 'Wards, barriers, and magical traps', false);
  feat(t, 'rite_of_healing', 'Rite of Healing', [A], [['ritualist:1'], ['verb_mend:1']], 'Healing ritual', false);
  feat(t, 'true_naming', 'True Naming', [D], [['ritualist:2']], 'Name substitution gives a larger bonus', false);
  feat(t, 'imbue', 'Imbue', [E], [['ritualist:3']], 'Enchant words into items with gems', false);
  feat(t, 'necromancy', 'Necromancy', [E], [['verb_raise:1']], 'Reanimation rituals; evil components', false);
  feat(t, 'archmages_seal', "Archmage's Seal", [M], [['imbue:1']], 'Create items that grant feats', false);

  G.DATA = {
    ARMOR, SHIELDS, SHIELD_MATERIALS, QUALITY, COVERAGE, WEAPONS, MOTIONS, ACTIONS, RARITY, FEATS, TREES,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
