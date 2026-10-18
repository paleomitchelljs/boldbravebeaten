/*
 * Enemy generation: a template sets attribute emphasis, gear and feat
 * preferences; the level sets feat count and gear quality. Gear follows the
 * rarity table, so rare kit only shows up on high-level foes.
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const Items = G.Items;
  const { FEATS } = G.DATA;

  const NAMES = ['Aldo', 'Brann', 'Cyne', 'Dagna', 'Edric', 'Fenna', 'Gorm', 'Hilde', 'Ivo', 'Jorun', 'Kell', 'Liesl', 'Marek', 'Nyssa', 'Osric', 'Petra', 'Quill', 'Rurik', 'Sabine', 'Tamsin', 'Ulf', 'Vesna', 'Wulf', 'Yrsa', 'Zdenek'];

  // Gear lists are [weight, value] pairs, picked by level band: [1–2, 3–5, 6+].
  const TEMPLATES = {
    bandit: {
      name: 'Bandit', primary: ['DEX', 'SPD'], weak: ['INT'],
      armor: [[[3, 'padded'], [1, 'leather']], [[2, 'leather'], [1, 'mail']], [[1, 'leather'], [2, 'mail']]],
      coverage: [[[2, 'partial'], [2, 'half'], [1, 'full']], [[1, 'half'], [2, 'full']], [[1, 'full']]],
      weapons: [[[2, 'club'], [2, 'dagger']], [[1, 'club'], [1, 'dagger'], [1, 'spikedMace']], [[1, 'rapier'], [1, 'spikedMace']]],
      shield: [[[2, null], [2, 'buckler']], [[1, null], [2, 'buckler']], [[1, 'buckler'], [1, 'round']]],
      sidearm: 'dagger',
      feats: ['quick_thrust', 'light_touch', 'trip', 'dodge_training', 'kip_up', 'precision', 'fleet_foot', 'agility', 'quickness'],
    },
    militia: {
      name: 'Militia', primary: ['CON', 'STR'], weak: ['DEX'],
      armor: [[[1, 'padded']], [[2, 'padded'], [1, 'leather']], [[1, 'leather'], [1, 'mail']]],
      coverage: [[[1, 'full']], [[1, 'full']], [[1, 'full']]],
      weapons: [[[2, 'club'], [1, 'spikedMace']], [[1, 'spikedMace'], [1, 'club']], [[1, 'spikedMace'], [1, 'flangedMace']]],
      shield: [[[1, 'round']], [[1, 'round']], [[1, 'round'], [1, 'heater']]],
      feats: ['shield_training', 'quick_block', 'economical_block', 'toughness', 'light_armor_training', 'heavy_weapon_training', 'strength'],
      sidearm: 'dagger',
    },
    sellsword: {
      name: 'Sellsword', primary: ['STR', 'CON'], weak: ['CHA'],
      armor: [[[2, 'leather'], [1, 'mail']], [[1, 'mail']], [[2, 'mail'], [1, 'scale']]],
      coverage: [[[1, 'half'], [1, 'full']], [[1, 'half'], [2, 'full']], [[1, 'full']]],
      weapons: [[[2, 'longsword'], [1, 'spikedMace']], [[1, 'longsword']], [[1, 'longsword']]],
      shield: [[[1, 'round']], [[1, 'round'], [1, 'heater']], [[1, 'heater']]],
      sidearm: 'dagger',
      feats: ['shield_training', 'mail_mobility', 'parry_training', 'mail_endurance', 'quick_block', 'half_swording', 'murder_stroke', 'read_attack', 'strength'],
    },
    brute: {
      name: 'Brute', primary: ['STR', 'CON'], weak: ['INT', 'DEX'],
      armor: [[[2, 'padded'], [1, 'leather']], [[1, 'leather'], [1, 'mail']], [[1, 'mail'], [1, 'scale']]],
      coverage: [[[1, 'half'], [1, 'full']], [[1, 'full']], [[1, 'full']]],
      weapons: [[[2, 'club'], [1, 'warhammer']], [[1, 'warhammer'], [1, 'greatsword']], [[1, 'warhammer'], [1, 'greatsword']]],
      shield: [[[1, null]], [[1, null]], [[1, null]]],
      feats: ['power_swing', 'heavy_weapon_training', 'weight_of_the_blow', 'strength', 'heavy_tempo', 'crushing_blow', 'shield_breaker', 'toughness'],
      sidearm: 'dagger',
    },
    duelist: {
      name: 'Duelist', primary: ['DEX', 'SPD'], weak: ['STR'],
      armor: [[[1, null], [1, 'padded']], [[1, 'leather']], [[1, 'leather'], [1, 'mail']]],
      coverage: [[[1, 'partial']], [[1, 'half']], [[1, 'half'], [1, 'full']]],
      weapons: [[[1, 'rapier']], [[1, 'rapier']], [[1, 'rapier']]],
      shield: [[[1, null]], [[1, null], [1, 'buckler']], [[1, 'buckler']]],
      sidearm: 'dagger',
      feats: ['quick_thrust', 'parry_training', 'feint', 'riposte', 'read_attack', 'precision', 'quick_parry', 'light_touch', 'find_the_gap', 'agility'],
    },
    brawler: {
      name: 'Brawler', primary: ['STR', 'DEX'], weak: ['INT'],
      armor: [[[1, 'padded']], [[1, 'padded'], [1, 'leather']], [[1, 'leather']]],
      coverage: [[[1, 'partial']], [[1, 'half']], [[1, 'full']]],
      weapons: [[[1, null]], [[1, null]], [[1, null]]],
      shield: [[[1, null]], [[1, null]], [[1, null]]],
      sidearm: 'dagger',
      feats: ['grappler', 'trip', 'quick_hands', 'heavy_hands', 'brawlers_wind', 'pin', 'dogpile', 'takedown', 'coup_de_grace', 'strength'],
    },
    manAtArms: {
      name: 'Man-at-arms', primary: ['STR', 'CON'], weak: ['CHA'],
      armor: [[[1, 'mail']], [[2, 'mail'], [1, 'scale']], [[1, 'scale'], [1, 'plate']]],
      coverage: [[[1, 'half'], [1, 'full']], [[1, 'full']], [[2, 'full'], [1, 'half']]],
      weapons: [[[1, 'spikedMace'], [1, 'flangedMace']], [[1, 'flangedMace'], [1, 'longsword']], [[1, 'flangedMace'], [1, 'warhammer']]],
      shield: [[[1, 'round']], [[1, 'heater']], [[1, 'heater']]],
      sidearm: 'dagger',
      feats: ['shield_training', 'mail_mobility', 'quick_block', 'weight_of_the_blow', 'shield_training', 'economical_block', 'mail_endurance', 'iron_stance', 'toughness'],
    },
    knight: {
      name: 'Knight', primary: ['STR', 'CON'], weak: ['SPD'],
      armor: [[[1, 'mail']], [[1, 'scale'], [1, 'plate']], [[1, 'plate']]],
      coverage: [[[1, 'full']], [[1, 'half'], [2, 'full']], [[1, 'full']]],
      weapons: [[[1, 'longsword']], [[2, 'longsword'], [1, 'greatsword']], [[1, 'longsword'], [1, 'greatsword'], [1, 'warhammer']]],
      shield: [[[1, 'heater']], [[1, 'heater']], [[2, 'heater'], [1, 'tower']]],
      sidearm: 'dagger',
      feats: ['plate_mobility', 'shield_training', 'plate_endurance', 'half_swording', 'murder_stroke', 'quick_block', 'strength', 'iron_stance', 'toughness', 'power_swing'],
    },
  };

  function makeRng(seed) {
    if (seed == null) return Math.random;
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function pick(rng, weighted) {
    const total = weighted.reduce((t, [w]) => t + w, 0);
    let r = rng() * total;
    for (const [w, v] of weighted) {
      r -= w;
      if (r < 0) return v;
    }
    return weighted[weighted.length - 1][1];
  }

  function band(level) {
    return level <= 2 ? 0 : level <= 5 ? 1 : 2;
  }

  function rollQuality(rng, level) {
    return pick(rng, [
      [[3, 'crude'], [7, 'standard']],
      [[1, 'crude'], [6, 'standard'], [3, 'fine']],
      [[3, 'standard'], [5, 'fine'], [2, 'masterwork']],
    ][band(level)]);
  }

  function shieldMaterial(rng, level) {
    return pick(rng, [
      [[3, 'wood'], [1, 'hide']],
      [[1, 'wood'], [2, 'hide'], [2, 'iron']],
      [[1, 'hide'], [2, 'iron'], [2, 'steel']],
    ][band(level)]);
  }

  function generate(templateId, level, opts) {
    opts = opts || {};
    const rng = makeRng(opts.seed);
    const T = TEMPLATES[templateId];
    const b = band(level);
    const base = {};
    for (const a of G.CONFIG.attributes) {
      let v = 3 + Math.floor(rng() * 4); // 3–6
      if (T.primary.includes(a)) v += 1;
      if (T.weak.includes(a)) v -= 1;
      base[a] = Math.max(2, Math.min(8, v));
    }
    const name = opts.name || `${NAMES[Math.floor(rng() * NAMES.length)]} the ${T.name.toLowerCase()}`;
    const c = C.newCharacter({ name, side: 'enemy', base, starterGear: false });
    c.level = level;
    c.template = templateId;

    const armorType = pick(rng, T.armor[b]);
    if (armorType) c.armor = Items.makeArmor(armorType, pick(rng, T.coverage[b]), rollQuality(rng, level));
    const shieldSize = pick(rng, T.shield[b]);
    if (shieldSize) c.shield = Items.makeShield(shieldSize, shieldMaterial(rng, level), rollQuality(rng, level));
    const wType = pick(rng, T.weapons[b]);
    if (wType) {
      const w = Items.makeWeapon(wType, rollQuality(rng, level));
      c.weapons.push(w);
      c.wield = w.id;
      // A greatsword means the shield stays home.
      if (G.DATA.WEAPONS[wType].hands === 2) c.shield = null;
    }
    if (T.sidearm && wType !== T.sidearm) {
      const s = Items.makeWeapon(T.sidearm, 'standard');
      c.weapons.push(s);
      c.sidearm = s.id;
      if (!c.wield) c.wield = null;
    }
    c.inventory = { bandages: Math.floor(rng() * 2), gold: Math.floor(rng() * 6 * level) + level, items: [] };

    chooseFeats(c, T.feats, rng);
    c.stamina = C.maxStamina(c);
    return c;
  }

  function chooseFeats(c, prefs, rng) {
    const budget = C.featBudget(c);
    let progress = true;
    while (C.featCount(c) < budget && progress) {
      progress = false;
      for (const id of prefs) {
        if (C.featCount(c) >= budget) break;
        if (FEATS[id] && C.canTakeFeat(c, id).ok) {
          C.addFeat(c, id);
          progress = true;
        }
      }
    }
    // Fill anything left with random legal combat feats.
    const pool = Object.keys(FEATS).filter((id) => FEATS[id].auto);
    let guard = 200;
    while (C.featCount(c) < budget && guard-- > 0) {
      const id = pool[Math.floor(rng() * pool.length)];
      if (C.canTakeFeat(c, id).ok) C.addFeat(c, id);
    }
  }

  // ---- Monsters (PROVISIONAL draft) --------------------------------------------------
  // Fixed builds rather than rolled ones. Each is meant to be strong against one kind of
  // fighter; the arena (sim/monsters.js) tests whether it is.
  //   natural  — natural weapons (data.js), always ready
  //   armor    — natural armor type
  //   traits   — pack (+1 damage per packmate beside the target, up to N), displacement
  //              (chance an attack strikes an illusion: ranged / melee), regen (CON and stamina
  //              back each round unless burned; a downed troll can get back up), apMult and
  //              staminaMult (a boss: more AP, a bigger per-pass allowance, more stamina),
  //              tireless (undead and constructs: no stamina; damage goes to attributes, never
  //              tires, no bleeding or venom), resist ({P, S, B} damage multipliers),
  //              nimble (+dodge), slippery (+ against being grappled and to break free),
  //              moveMult (leapers cover more ground), grip (a huge hand: + to grapple rolls),
  //              flying, magicImmune, incorporeal, constrict, aura, size (big bodies: fewer
  //              vital wounds, less bleeding per wound)
  //   weapons, shield, sidearm, quality, arrows — carried gear, for monsters that use it
  //   policy   — AI policy (grappler, kite…)
  //   group    — several creatures (a pack)
  const MONSTERS = {
    wolf: {
      name: 'Wolf', blurb: 'Fast; its bite drags you down. Dangerous in numbers.',
      attrs: { STR: 5, CON: 5, DEX: 7, SPD: 8, INT: 2, WIS: 6, CHA: 2 },
      natural: ['wolfBite'], armor: 'fur', traits: { pack: 2 }, feats: { dodge_training: 1 },
    },
    alphaWolf: {
      name: 'Alpha wolf', blurb: 'The pack leader: bigger, harder bite.',
      attrs: { STR: 6, CON: 6, DEX: 7, SPD: 8, INT: 3, WIS: 6, CHA: 3 },
      natural: ['alphaBite'], armor: 'fur', traits: { pack: 2 }, feats: { dodge_training: 1, toughness: 1 },
    },
    rat: {
      name: 'Giant rat', blurb: 'A dog-sized rat: quick, weak, a nuisance alone.',
      attrs: { STR: 3, CON: 3, DEX: 7, SPD: 7, INT: 1, WIS: 4, CHA: 1 },
      natural: ['ratBite'], traits: { pack: 1, staminaMult: 0.35 }, feats: {},
    },
    ratPack: { name: 'Rat swarm', blurb: 'Six giant rats: each bite is nothing; a dozen a round is something.', group: ['rat', 'rat', 'rat', 'rat', 'rat', 'rat'] },
    wolfPack: { name: 'Wolf pack', blurb: 'An alpha and two wolves. Surround, drag down, tear.', group: ['alphaWolf', 'wolf', 'wolf'] },
    rustBeetle: {
      name: 'Rust beetle', blurb: 'Its antennae turn metal armor to flaking rust. Meant to beat plate; harmless-looking to the unarmored.',
      attrs: { STR: 10, CON: 12, DEX: 5, SPD: 6, INT: 1, WIS: 5, CHA: 1 },
      natural: ['antennae', 'mandibles'], armor: 'chitin', traits: {}, feats: { toughness: 1 },
    },
    displacer: {
      name: 'Displacer beast', blurb: 'Seen where it isn\'t: arrows mostly strike an illusion. Fast, with reach-2 tentacles. Meant to beat archers.',
      attrs: { STR: 12, CON: 11, DEX: 7, SPD: 8, INT: 3, WIS: 6, CHA: 3 },
      natural: ['tentacles'], armor: 'fur', traits: { displacement: { ranged: 0.5, melee: 0.25 } }, feats: {},
    },
    giantSpider: {
      name: 'Giant spider', blurb: 'Spits sticky webs that make every action cost more, then closes for venomous bites. Armor keeps the fangs out; bare skin doesn\'t. Meant to beat the unarmored.',
      attrs: { STR: 8, CON: 6, DEX: 8, SPD: 7, INT: 1, WIS: 5, CHA: 1 },
      natural: ['spiderBite', 'webSpinner'], armor: 'chitin', traits: {}, feats: {}, policy: { kite: false },
    },
    owlbear: {
      name: 'Owlbear', blurb: 'Hugs and won\'t let go: no room for a greatsword or a bow. Meant to beat two-handers.',
      attrs: { STR: 18, CON: 16, DEX: 5, SPD: 5, INT: 2, WIS: 5, CHA: 2 },
      natural: ['claws', 'beak'], armor: 'fur', traits: {}, feats: { grappler: 2, pin: 1 }, policy: { grappler: true },
    },
    caveTroll: {
      name: 'Cave troll', blurb: 'Regenerates unless burned; wound-up slams break shields and knock you flat. Meant to beat sword and shield.',
      attrs: { STR: 20, CON: 18, DEX: 4, SPD: 4, INT: 2, WIS: 4, CHA: 2 },
      natural: ['trollFists', 'claws'], armor: 'trollHide', traits: { regen: { con: 1, stamina: 6 } }, feats: { power_swing: 1, shield_breaker: 1 },
    },
    trollChieftain: {
      name: 'Troll chieftain', blurb: 'A boss for a whole party: acts like two fighters (AP and per-pass allowance ×2) on a STR-24, CON-24 body.',
      attrs: { STR: 24, CON: 24, DEX: 4, SPD: 4, INT: 3, WIS: 4, CHA: 3 },
      natural: ['trollFists', 'claws'], armor: 'trollHide', traits: { regen: { con: 1, stamina: 6 }, apMult: 2 }, feats: { power_swing: 1, shield_breaker: 1, toughness: 1 },
    },
    ogre: {
      name: 'Ogre', blurb: 'Like a troll but bigger and stronger: a club and fists that knock you flat. It doesn\'t regenerate.',
      level: 8, attrs: { STR: 23, CON: 21, DEX: 4, SPD: 5, INT: 3, WIL: 5, WIS: 4, CHA: 3 },
      natural: ['trollFists'], armor: 'ogreHide', weapons: ['giantClub'], quality: 'crude', keepUnarmed: true,
      traits: { grip: 2, apMult: 1.5, size: 1.5 }, feats: { power_swing: 1, shield_breaker: 1, toughness: 1 },
    },
    hillGiant: {
      name: 'Hill giant', blurb: 'Bigger and stronger than an ogre: a tree-trunk club, boulders hurled from afar, and a hand big enough to seize a man and hold him.',
      level: 12, attrs: { STR: 28, CON: 26, DEX: 4, SPD: 5, INT: 4, WIL: 6, WIS: 5, CHA: 4 },
      natural: ['boulder'], armor: 'giantHide', weapons: ['giantClub'], quality: 'crude', keepUnarmed: true,
      traits: { grip: 5, apMult: 1.75, size: 2.5 }, feats: { power_swing: 1, shield_breaker: 1, grappler: 2, pin: 1, toughness: 2 },
    },
    displacerPair: { name: 'Displacer pair', blurb: 'Two displacer beasts: arrows mostly strike illusions, so the archers have to close while the beasts maul the front line.', group: ['displacer', 'displacer'] },
    // ---- Undead and constructs: tireless ----
    skeleton: {
      name: 'Skeleton', blurb: 'Bones and a rusty sword. Arrows and thrusts pass between the ribs; slashing chips; a mace breaks it. Never tires.',
      attrs: { STR: 5, CON: 10, DEX: 5, SPD: 5, INT: 1, WIS: 1, CHA: 1 },
      natural: [], weapons: ['longsword'], shield: ['round', 'wood'], quality: 'crude',
      traits: { tireless: true, undead: true, resist: { P: 0, S: 0.5 } }, feats: { shield_training: 1 }, keepUnarmed: true,
    },
    skeletonSquad: { name: 'Skeleton squad', blurb: 'Three skeletons with swords and shields.', group: ['skeleton', 'skeleton', 'skeleton'] },
    zombie: {
      name: 'Zombie', blurb: 'Slow, grabbing, biting. Piercing does half as much; no stamina to run down. Never tires.',
      attrs: { STR: 9, CON: 12, DEX: 3, SPD: 3, INT: 1, WIS: 1, CHA: 1 },
      natural: ['claws', 'zombieBite'], traits: { tireless: true, undead: true, resist: { P: 0.5 } }, feats: { grappler: 1 }, policy: { grappler: true },
    },
    zombieHorde: { name: 'Zombie horde', blurb: 'Four zombies.', group: ['zombie', 'zombie', 'zombie', 'zombie'] },
    stoneGolem: {
      name: 'Stone golem', blurb: 'A construct of stone: blades skate off, hammers crack it. Slow, tireless, and its fists crush shields.',
      attrs: { STR: 22, CON: 22, DEX: 3, SPD: 3, INT: 1, WIS: 1, CHA: 1 },
      natural: ['golemFists'], armor: 'golemStone', traits: { tireless: true, magicImmune: true }, feats: {},
    },
    // ---- Drakes and wyverns: armored scales, wings ----
    drake: {
      name: 'Drake', blurb: 'A small dragon (about level 8): fire breath over an area, flies fast over anything in its way, claws, bite and wing buffets.',
      level: 8, attrs: { STR: 14, CON: 16, DEX: 8, SPD: 8, INT: 6, WIL: 8, WIS: 6, CHA: 6 },
      natural: ['drakeBite', 'drakeClaws', 'wingBuffet'], armor: 'drakeScales', nouns: ['fire'],
      traits: { flying: true, moveMult: 1.5, slippery: 2 }, feats: { casting: 2, verb_burst: 1, mod_strong: 1, dodge_training: 1, toughness: 1 },
    },
    wyvern: {
      name: 'Wyvern', blurb: 'A bigger winged beast with heavy scales: a powerful bite, a venomous stinger and wing beats that knock you flat.',
      level: 10, attrs: { STR: 17, CON: 16, DEX: 6, SPD: 7, INT: 3, WIL: 7, WIS: 5, CHA: 3 },
      natural: ['wyvernBite', 'wyvernSting', 'wyvernWings'], armor: 'wyvernScales', traits: { flying: true, slippery: 1 }, feats: { toughness: 2, strength: 1 },
    },
    // ---- A constrictor: a grappler beyond any human, weak against a crowd ----
    constrictor: {
      name: 'Giant constrictor', blurb: 'A huge snake: it wraps one victim and crushes them every round, but while it holds one, the rest can cut at it.',
      attrs: { STR: 18, CON: 12, DEX: 7, SPD: 5, INT: 2, WIL: 6, WIS: 5, CHA: 2 },
      natural: ['constrictorBite'], armor: 'scaleHide', traits: { constrict: { stamina: 8, con: 1 }, slippery: 2 },
      feats: { grappler: 3, pin: 1, takedown: 1, brawlers_wind: 1 }, policy: { grappler: true },
    },
    // ---- Humanoids with natural armor ----
    kobold: {
      name: 'Kobold', blurb: 'Small, quick, scaly, cowardly alone and vicious in a pack. Spear.',
      attrs: { STR: 3, CON: 4, DEX: 6, SPD: 7, INT: 4, WIS: 4, CHA: 3 },
      natural: [], armor: 'scaleHide', weapons: ['spear'], quality: 'crude', traits: { pack: 1, nimble: 1 }, feats: {}, keepUnarmed: true,
    },
    koboldBand: { name: 'Kobold band', blurb: 'Four kobolds with spears.', group: ['kobold', 'kobold', 'kobold', 'kobold'] },
    goblin: {
      name: 'Goblin', blurb: 'Nimble and nasty: crude leather, a club, and a knife.',
      attrs: { STR: 4, CON: 4, DEX: 7, SPD: 7, INT: 4, WIS: 3, CHA: 3 },
      natural: [], armorItem: ['leather', 'half'], weapons: ['club'], sidearm: 'dagger', quality: 'crude', traits: { nimble: 2 }, feats: {}, keepUnarmed: true,
    },
    goblinArcher: {
      name: 'Goblin archer', blurb: 'A goblin with a shortbow, keeping its distance.',
      attrs: { STR: 4, CON: 4, DEX: 7, SPD: 7, INT: 4, WIS: 3, CHA: 3 },
      natural: [], armorItem: ['leather', 'half'], weapons: ['shortbow'], sidearm: 'dagger', quality: 'crude', arrows: 15, traits: { nimble: 2 }, feats: {}, keepUnarmed: true,
    },
    goblinBand: { name: 'Goblin band', blurb: 'Two goblins and an archer.', group: ['goblin', 'goblin', 'goblinArcher'] },
    froglok: {
      name: 'Froglok', blurb: 'Frog-folk with spear and shield: they leap into the fight and slip out of any grip.',
      attrs: { STR: 5, CON: 5, DEX: 6, SPD: 6, INT: 4, WIS: 5, CHA: 4 },
      natural: [], armor: 'frogSkin', weapons: ['spear'], shield: ['round', 'wood'], traits: { slippery: 2, moveMult: 1.5 }, feats: { shield_training: 1 }, keepUnarmed: true,
    },
    frogPatrol: { name: 'Froglok patrol', blurb: 'Three frogloks.', group: ['froglok', 'froglok', 'froglok'] },
    sarnak: {
      name: 'Sarnak', blurb: 'A big scaled reptilian warrior with a warhammer and a tail that sweeps legs.',
      attrs: { STR: 12, CON: 11, DEX: 5, SPD: 5, INT: 4, WIS: 4, CHA: 3 },
      natural: ['tail'], armor: 'sarnakScales', weapons: ['warhammer'], traits: {}, feats: { heavy_weapon_training: 1, toughness: 1 }, keepUnarmed: true,
    },
    sarnakPair: { name: 'Sarnak pair', blurb: 'Two sarnak warriors.', group: ['sarnak', 'sarnak'] },
    // ---- A non-monster boss: an end-game character (PROVISIONAL test build) ----
    // Level 20 at the human attribute cap, in legendary plate with an adamant heater and
    // Soulreaver, a longsword that drinks half the stamina and wounds it deals. Battle Casting
    // lets him cast with sword and shield in hand: Burst + Life + Strong (a withering burst, no
    // armor stops it) and Conjure + Life (raises the fallen to fight for him).
    deathKnight: {
      name: 'Death knight', blurb: 'An end-game knight: legendary plate, an adamant shield, a blade that drinks stamina and wounds, a withering burst, an aura of dread that saps everyone near him, a silk sash that quickens him, and the dead rise for him.',
      level: 20, attrs: { STR: 10, CON: 10, DEX: 8, SPD: 7, INT: 10, WIL: 10, WIS: 7, CHA: 8 },
      natural: [], keepUnarmed: true, nouns: ['life', 'shadow', 'fire'],
      armorItem: ['plate', 'full'], armorQuality: 'legendary',
      weaponItems: [{ type: 'longsword', quality: 'legendary', name: 'Soulreaver', enchant: { drain: { stamina: 0.5, attrs: 0.5 } } }],
      sidearm: 'dagger', shield: ['heater', 'adamant'], shieldQuality: 'legendary',
      trinkets: [{ name: 'Flowing black silk sash', attrs: { SPD: 1 }, ap: 1 }],
      traits: { aura: { name: 'aura of dread', radius: 2, stamina: 3, cond: 'dread' } },
      featPrefs: ['casting', 'verb_strike', 'verb_launch', 'casting', 'verb_burst', 'verb_bless', 'battle_casting', 'verb_conjure', 'mod_strong', 'casting',
        'plate_mobility', 'plate_mobility', 'shield_training', 'half_swording', 'plate_endurance', 'shield_training', 'quick_block', 'iron_stance', 'plate_endurance',
        'living_fortress', 'strength', 'toughness', 'parry_training', 'riposte', 'casting', 'control', 'quick_casting', 'half_swording'],
    },
    // A high-level undead: only magic hurts it (incorporeal: weapons without an enchantment pass
    // through), a scythe that drinks life, and a wail that panics those near it (WIL resists).
    spectre: {
      name: 'Spectre', blurb: 'A high-level undead. Only spells and magical weapons hurt it; its scythe drinks life; its wail panics the living near it.',
      level: 15, attrs: { STR: 10, CON: 14, DEX: 9, SPD: 9, INT: 9, WIL: 12, WIS: 8, CHA: 10 },
      natural: [], keepUnarmed: false,
      weaponItems: [{ type: 'warScythe', quality: 'legendary', name: 'Reaping scythe', enchant: { drain: { stamina: 0.5, attrs: 0.5 } } }],
      traits: { tireless: true, undead: true, incorporeal: true, aura: { name: 'wail', radius: 2, cond: 'frightened', resisted: true } },
      featPrefs: ['heavy_weapon_training', 'power_swing', 'heavy_tempo', 'dodge_training', 'dodge_training', 'dodge_training', 'parry_training', 'parry_training', 'parry_training', 'quick_parry', 'agility', 'agility', 'toughness', 'toughness', 'heavy_tempo', 'riposte', 'iron_stance'],
    },
    deathKnightCourt: { name: 'Death knight and his dead', blurb: 'The death knight with two skeletons at his side.', group: ['deathKnight', 'skeleton', 'skeleton'] },
  };

  // A conjured creature (Magic: Conjure). 'elemental': a spirit of the noun whose blows carry it,
  // tireless, stronger with the spell's magnitude. 'raise': the dead walk (a zombie).
  function makeConjured(kind, noun, mag) {
    if (kind === 'raise') {
      const [z] = makeMonster('zombie');
      z.name = 'Raised dead';
      return z;
    }
    if (kind !== 'elemental') return null;
    const name = (G.CONFIG.magic.words[noun] || {}).name || noun;
    const c = C.newCharacter({ name: `${name} elemental`, side: 'enemy', starterGear: false,
      base: { STR: 4 + mag, CON: 4 + Math.floor(mag / 2), DEX: 6, SPD: 6, INT: 1, WIL: 5, WIS: 3, CHA: 1 } });
    c.level = 1;
    c.monster = 'elemental';
    c.natural = ['elementalTouch'];
    c.noUnarmed = true;
    c.traits = { tireless: true, element: noun };
    c.feats = {};
    c.stamina = C.maxStamina(c);
    return c;
  }

  // Make a monster (or, for a group, all its members). Returns an array of characters.
  function makeMonster(key, opts) {
    opts = opts || {};
    const M = MONSTERS[key];
    if (M.group) return M.group.map((k, i) => makeMonster(k, Object.assign({}, opts, { n: i }))[0]);
    const c = C.newCharacter({ name: opts.name || M.name + (opts.n ? ' ' + (opts.n + 1) : ''), side: opts.side || 'enemy', base: Object.assign({ WIL: M.attrs.WIS }, M.attrs), starterGear: false });
    c.level = opts.level || M.level || 5;
    c.monster = key;
    c.natural = (M.natural || []).slice();
    c.noUnarmed = !M.keepUnarmed;
    c.traits = JSON.parse(JSON.stringify(M.traits || {}));
    c.feats = Object.assign({}, M.feats || {});
    if (M.featPrefs) chooseFeats(c, M.featPrefs, makeRng(c.level * 7919 + 1));
    if (M.nouns) c.nouns = M.nouns.slice();
    if (M.trinkets) c.trinkets = JSON.parse(JSON.stringify(M.trinkets));
    if (M.armor) c.armor = Items.makeArmor(M.armor, 'full', 'standard');
    if (M.armorItem) c.armor = Items.makeArmor(M.armorItem[0], M.armorItem[1] || 'full', M.armorQuality || M.quality || 'standard');
    const q = M.quality || 'standard';
    for (const [i, type] of (M.weapons || []).entries()) {
      const w = Items.makeWeapon(type, q);
      c.weapons.push(w);
      if (i === 0) c.wield = w.id;
    }
    // Named or enchanted weapons: { type, quality, name, enchant }.
    for (const spec of M.weaponItems || []) {
      const w = Object.assign(Items.makeWeapon(spec.type, spec.quality || q), spec.name ? { name: spec.name } : {}, spec.enchant ? { enchant: JSON.parse(JSON.stringify(spec.enchant)) } : {});
      c.weapons.push(w);
      if (!c.wield) c.wield = w.id;
    }
    if (M.sidearm) { const s = Items.makeWeapon(M.sidearm, q); c.weapons.push(s); c.sidearm = s.id; }
    if (M.shield) c.shield = Items.makeShield(M.shield[0], M.shield[1], M.shieldQuality || q);
    c.policy = Object.assign({}, M.policy || {});
    c.inventory = { bandages: 0, gold: 0, arrows: M.arrows || 0, bodkins: 0, items: [] };
    c.stamina = C.maxStamina(c);
    return [c];
  }

  G.Enemies = { makeConjured, TEMPLATES, generate, makeRng, chooseFeats, MONSTERS, makeMonster };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
