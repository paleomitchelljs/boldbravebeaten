/*
 * Catalogs from the Game System Specifics doc: weapons, armor, shields,
 * item keywords, rarity, and feat trees.
 */
(function (G) {
  'use strict';

  // The catalogs below are filled from data/*.yaml by Content.install (src/data/content.js),
  // in place, so every module that holds a reference sees the same objects.
  // armor.yaml: mit {P,S,B}, spd, dex, stamina, regen, standUp, weight, durability, material(s), pierce
  // {resist, gap}, rarity, natural, recoil.
  const ARMOR = {};
  // shields.yaml: blockAP, threshold, durability, rarity (types); mult, rarity (materials).
  const SHIELDS = {};
  const SHIELD_MATERIALS = {};
  // The tags every weapon, armor piece and shield carries besides its type:
  //   materials.yaml     hardness, toughness, weight, protect, metal, exotic, rarity, value
  //   origins.yaml       weight, protect, damage, durability (how weight trades against the rest), rarity, value
  //   crafts.yaml        durability, wear, break, unbreakable (how fast it wears, how easily it breaks)
  //   enchantments.yaml  kinds, the same multipliers, drain
  const MATERIALS = {};
  const ORIGINS = {};
  const CRAFTS = {};
  const ENCHANTMENTS = {};

  const COVERAGE = {
    full: { name: 'Full' },
    half: { name: 'Half' },
    partial: { name: 'Partial' },
  };

  // ---- Weapons (Specifics) ------------------------------------------------
  // faces: [P, S, B]. motions: which motions the weapon allows.
  // Range, in grid squares (PROVISIONAL scale, the user's: 1 = arm's length, where daggers, one-handed
  // swings and fists work; 2 = a one-handed thrust or a two-handed swing; 3 = a two-handed thrust; 4 = a spear):
  //   reach        — { swing, thrust, min }: farthest each motion reaches (swing covers the two-handed and
  //                  power swings); inside `min` (default 1) the weapon is cramped (CONFIG.range.closeRule)
  //   closeOK      — works in a clinch without being cramped; long blades and spears don't
  //   ranged       — bows: { min, max, long } (beyond `long` damage drops)
  //   material     — what the striking part is made of (wear, breaking shields); an item may carry its own
  //   draw         — bows: {ticks, stamina}, the part of shootTicks / shootStamina spent drawing: the shot's lead,
  //                  exposed (CONFIG.clock.exposes); a stronger bow draws longer for more range and damage
  //   focus        — a caster's focus: spells can be cast with it in hand, though it takes both (a staff)
  //   phys         — PROVISIONAL physical description (CONFIG.weaponPhysics). Under the
  //                  'physical' weapon model, damage, ticks, weight class, STR scaling and wounds
  //                  are worked out from it (Items.weaponStats) and `faces` and `weight` are only
  //                  the old hand-set table. mass kg, length m; point {depth cm it can drive in,
  //                  width cm of the wound}; edge 0–1 (how much cutting edge); head {mass kg at
  //                  the striking end, spikes {depth, width}, cut}; beak {depth, width}; hilt
  //                  (pommel strikes); butt {mass kg driven by a jab with the blunt end: a staff}; arrow {depth, width} for bows. point.punch / arrow.punch override the
  //                  punch through armor worked out from mass (CONFIG.pierce).
  const WEAPONS = {}; // weapons.yaml

  // Ticks (CONFIG.clock): a motion's or an action's base cost, before the weapon's speed and strain, the SPD factor,
  // armor, gear, Quick feats, webs, wounds and fatigue (Character.ticksFor). A one-handed swing is the standard, 10.
  // lead: the share of the cost before the action takes effect (the rest is recovery after). Quick things are all
  // recovery: they happen now. Heavy ones commit the fighter for their lead, and others act in between.
  const MOTIONS = {
    thrust: { name: 'Thrust', ticks: 5, lead: 0, stamina: 3, faces: ['point', 'butt'] },
    swing: { name: 'Swing', ticks: 10, lead: 0.3, stamina: 6, faces: ['edge', 'head', 'beak', 'hilt'] },
    twoHanded: { name: 'Two-handed swing', ticks: 15, lead: 0.4, stamina: 9, faces: ['edge', 'head', 'beak', 'hilt'], twoHands: true },
    power: { name: 'Power swing', ticks: 15, lead: 0.5, stamina: 12, faces: ['edge', 'head', 'beak'], requiresFeat: 'power_swing' },
    shoot: { name: 'Shoot', ticks: 10, lead: 0.3, stamina: 3, faces: ['arrow'] }, // a bow's own shootTicks and draw (the lead)
  };

  // Other actions (PROVISIONAL rows noted in config). Reactions (block, parry, dodge, offParry) have no lead: they are
  // taken when the blow comes, and their ticks go on the reactor's clock.
  const ACTIONS = {
    punch: { name: 'Punch', ticks: 2.5, stamina: 0, damage: [0, 0, 1] },
    kick: { name: 'Kick', ticks: 5, lead: 0, stamina: 3, damage: [0, 0, 2] },
    shieldBash: { name: 'Shield bash', ticks: 5, lead: 0.2, stamina: 3, damage: [0, 0, 3] },
    parry: { name: 'Parry', ticks: 5, stamina: 3 },
    // PROVISIONAL: a parry with the off-hand parrying dagger; meets thrusts only.
    offParry: { name: 'Off-hand parry', ticks: 2.5, stamina: 3 },
    dodge: { name: 'Dodge', ticks: 5, stamina: 6 },
    block: { name: 'Block', ticks: null, stamina: 3 }, // ticks by shield size (shields.yaml blockTicks)
    standUp: { name: 'Stand up', ticks: 5, lead: 0.5, stamina: 3 }, // ticks by armor (CONFIG.standUp)
    // PROVISIONAL: drawing is quick; dropping is free. Drawing while holding a weapon drops it
    // (a dagger is sheathed instead).
    drawSidearm: { name: 'Draw sidearm', ticks: 1.25, stamina: 0 },
    dropWeapon: { name: 'Drop weapon', ticks: 0, stamina: 0 },
    pickUp: { name: 'Pick up weapon', ticks: 5, lead: 0.5, stamina: 3 },
    trip: { name: 'Trip', ticks: 10, lead: 0.3, stamina: 6 },
    disarm: { name: 'Disarm', ticks: 10, lead: 0.3, stamina: 6 },
    shove: { name: 'Shove', ticks: 5, lead: 0, stamina: 3 },
    // The grappling ladder (PROVISIONAL; stamina in CONFIG.grappling): free → clinch → hold → pin.
    clinch: { name: 'Clinch', ticks: 5, lead: 0.2, stamina: 9 },
    grapple: { name: 'Grapple', ticks: 10, lead: 0.3, stamina: 15 },
    pin: { name: 'Pin', ticks: 10, lead: 0.3, stamina: 15 },
    throw: { name: 'Throw', ticks: 10, lead: 0.3, stamina: 15 },
    break: { name: 'Break grapple', ticks: 5, lead: 0.2, stamina: 9 },
    release: { name: 'Release hold', ticks: 2.5, stamina: 0 },
    tearFree: { name: 'Tear free of webs', ticks: 5, stamina: 3 },
    // PROVISIONAL: in-combat charm and wisdom actions (CONFIG.social).
    bait: { name: 'Bait', ticks: 2.5, stamina: 3 },
    readIntent: { name: 'Read intent', ticks: 1.25, stamina: 0 }, // cheap: a glance
    bandage: { name: 'Bandage', ticks: 10, lead: 0.5, stamina: 0 },
    cauterize: { name: 'Cauterize', ticks: 5, lead: 0.5, stamina: 0 }, // Fire's feat (feats.yaml): no bandage; the burn is a small wound (CONFIG.wounds.cauterize)
    // Feat actions (feats.yaml): Shadow, Leadership, Lore, Deception.
    vanish: { name: 'Vanish', ticks: 5, stamina: 3 },
    rally: { name: 'Rally', ticks: 5, stamina: 0 },
    command: { name: 'Command', ticks: 5, stamina: 0 },
    rouse: { name: 'To your feet!', ticks: 5, stamina: 0 },
    demoralize: { name: 'Demoralize', ticks: 5, stamina: 3 },
    nameWeakness: { name: 'Name the weakness', ticks: 5, stamina: 0 },
    feign: { name: 'Feign death', ticks: 5, stamina: 0 },
    move: { name: 'Move', ticks: null, stamina: 0 }, // CONFIG.clock.stretch a stretch of squares (Character.moveTicks)
    readyPrimary: { name: 'Draw main weapon', ticks: 1.25, stamina: 0 },
    // Waiting is an action (Combat.wait): to just after a named fighter's next action, or by a number of ticks.
    wait: { name: 'Wait', ticks: 0, stamina: 0 },
  };

  const RARITY = ['common', 'uncommon', 'rare', 'very rare', 'unique'];

  // ---- Feats (feats.yaml) ----------------------------------------------------
  // ranks: tiers for each rank. requires: list of AND-groups, each an OR-list of "id:rank".
  // auto: true when the engine applies the feat's effect automatically.
  const FEATS = {};
  const TREES = [];

  G.DATA = {
    ARMOR, SHIELDS, SHIELD_MATERIALS, MATERIALS, ORIGINS, CRAFTS, ENCHANTMENTS, COVERAGE, WEAPONS, MOTIONS, ACTIONS, RARITY, FEATS, TREES,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
