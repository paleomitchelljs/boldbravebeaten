/*
 * Catalogs from the Game System Specifics doc: weapons, armor, shields,
 * item keywords, rarity, and feat trees.
 */
(function (G) {
  'use strict';

  // The catalogs below are filled from data/*.yaml by Content.install (src/data/content.js),
  // in place, so every module that holds a reference sees the same objects.
  // armor.yaml: mit {P,S,B}, spd, dex, stamina, regen, standUp, rarity, natural, recoil.
  const ARMOR = {};
  // shields.yaml: blockAP, threshold, durability, rarity (types); mult, rarity (materials).
  const SHIELDS = {};
  const SHIELD_MATERIALS = {};
  // qualities.yaml: durability and threshold multipliers, a bonus, rarity.
  const QUALITY = {};

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
  //   phys         — PROVISIONAL physical description (CONFIG.weaponPhysics). Under the
  //                  'physical' weapon model, damage, AP, weight class, STR scaling and wounds
  //                  are worked out from it (Items.weaponStats) and `faces` and `weight` are only
  //                  the old hand-set table. mass kg, length m; point {depth cm it can drive in,
  //                  width cm of the wound}; edge 0–1 (how much cutting edge); head {mass kg at
  //                  the striking end, spikes {depth, width}, cut}; beak {depth, width}; hilt
  //                  (pommel strikes); arrow {depth, width} for bows.
  const WEAPONS = {}; // weapons.yaml

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
    // PROVISIONAL: a parry with the off-hand parrying dagger; meets thrusts only.
    offParry: { name: 'Off-hand parry', ap: 1, stamina: 1 },
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
    tearFree: { name: 'Tear free of webs', ap: 2, stamina: 1 },
    // PROVISIONAL: in-combat charm and wisdom actions (CONFIG.social).
    bait: { name: 'Bait', ap: 1, stamina: 1 },
    readIntent: { name: 'Read intent', ap: 0.5, stamina: 0 }, // cheap: a glance
    bandage: { name: 'Bandage', ap: 3, stamina: 0 },
    move: { name: 'Move', ap: 1, stamina: 0 },
    windUp: { name: 'Wind up', ap: 2, stamina: 1 }, // costs set in CONFIG.windUp
    readyPrimary: { name: 'Draw main weapon', ap: 0.5, stamina: 0 },
  };

  const RARITY = ['common', 'uncommon', 'rare', 'very rare', 'unique'];

  // ---- Feats (feats.yaml) ----------------------------------------------------
  // ranks: tiers for each rank. requires: list of AND-groups, each an OR-list of "id:rank".
  // auto: true when the engine applies the feat's effect automatically.
  const FEATS = {};
  const TREES = [];

  G.DATA = {
    ARMOR, SHIELDS, SHIELD_MATERIALS, QUALITY, COVERAGE, WEAPONS, MOTIONS, ACTIONS, RARITY, FEATS, TREES,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
