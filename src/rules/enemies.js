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
  //              moveMult (leapers cover more ground)
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
    wolfPack: { name: 'Wolf pack', blurb: 'An alpha and two wolves. Surround, drag down, tear.', group: ['alphaWolf', 'wolf', 'wolf'] },
    rustBeetle: {
      name: 'Rust beetle', blurb: 'Its antennae turn metal armor to flaking rust. Meant to beat plate; harmless-looking to the unarmored.',
      attrs: { STR: 6, CON: 8, DEX: 5, SPD: 6, INT: 1, WIS: 5, CHA: 1 },
      natural: ['antennae', 'mandibles'], armor: 'chitin', traits: {}, feats: { toughness: 1 },
    },
    displacer: {
      name: 'Displacer beast', blurb: 'Seen where it isn\'t: arrows mostly strike an illusion. Fast, with reach-2 tentacles. Meant to beat archers.',
      attrs: { STR: 7, CON: 7, DEX: 7, SPD: 8, INT: 3, WIS: 6, CHA: 3 },
      natural: ['tentacles'], armor: 'fur', traits: { displacement: { ranged: 0.5, melee: 0.25 } }, feats: {},
    },
    giantSpider: {
      name: 'Giant spider', blurb: 'Spits sticky webs that make every action cost more, then closes for venomous bites. Armor keeps the fangs out; bare skin doesn\'t. Meant to beat the unarmored.',
      attrs: { STR: 5, CON: 5, DEX: 8, SPD: 7, INT: 1, WIS: 5, CHA: 1 },
      natural: ['spiderBite', 'webSpinner'], armor: 'chitin', traits: {}, feats: {}, policy: { kite: false },
    },
    owlbear: {
      name: 'Owlbear', blurb: 'Hugs and won\'t let go: no room for a greatsword or a bow. Meant to beat two-handers.',
      attrs: { STR: 10, CON: 9, DEX: 5, SPD: 5, INT: 2, WIS: 5, CHA: 2 },
      natural: ['claws', 'beak'], armor: 'fur', traits: {}, feats: { grappler: 2, pin: 1 }, policy: { grappler: true },
    },
    caveTroll: {
      name: 'Cave troll', blurb: 'Regenerates unless burned; wound-up slams break shields and knock you flat. Meant to beat sword and shield.',
      attrs: { STR: 10, CON: 10, DEX: 4, SPD: 4, INT: 2, WIS: 4, CHA: 2 },
      natural: ['trollFists', 'claws'], armor: 'trollHide', traits: { regen: { con: 1, stamina: 6 } }, feats: { power_swing: 1, shield_breaker: 1 },
    },
    trollChieftain: {
      name: 'Troll chieftain', blurb: 'A boss for a whole party: acts like two and a half fighters (AP, per-pass allowance and stamina ×2.5) on a CON-15 body.',
      attrs: { STR: 10, CON: 15, DEX: 4, SPD: 4, INT: 3, WIS: 4, CHA: 3 },
      natural: ['trollFists', 'claws'], armor: 'trollHide', traits: { regen: { con: 1, stamina: 6 }, apMult: 2.5, staminaMult: 2.5 }, feats: { power_swing: 1, shield_breaker: 1, toughness: 1 },
    },
    displacerPair: { name: 'Displacer pair', blurb: 'Two displacer beasts: arrows mostly strike illusions, so the archers have to close while the beasts maul the front line.', group: ['displacer', 'displacer'] },
    // ---- Undead and constructs: tireless ----
    skeleton: {
      name: 'Skeleton', blurb: 'Bones and a rusty sword. Arrows and thrusts pass between the ribs; slashing chips; a mace breaks it. Never tires.',
      attrs: { STR: 5, CON: 10, DEX: 5, SPD: 5, INT: 1, WIS: 1, CHA: 1 },
      natural: [], weapons: ['longsword'], shield: ['round', 'wood'], quality: 'crude',
      traits: { tireless: true, resist: { P: 0, S: 0.5 } }, feats: { shield_training: 1 }, keepUnarmed: true,
    },
    skeletonSquad: { name: 'Skeleton squad', blurb: 'Three skeletons with swords and shields.', group: ['skeleton', 'skeleton', 'skeleton'] },
    zombie: {
      name: 'Zombie', blurb: 'Slow, grabbing, biting. Piercing does half as much; no stamina to run down. Never tires.',
      attrs: { STR: 7, CON: 12, DEX: 3, SPD: 3, INT: 1, WIS: 1, CHA: 1 },
      natural: ['claws', 'zombieBite'], traits: { tireless: true, resist: { P: 0.5 } }, feats: { grappler: 1 }, policy: { grappler: true },
    },
    zombieHorde: { name: 'Zombie horde', blurb: 'Four zombies.', group: ['zombie', 'zombie', 'zombie', 'zombie'] },
    stoneGolem: {
      name: 'Stone golem', blurb: 'A construct of stone: blades skate off, hammers crack it. Slow, tireless, and its fists crush shields.',
      attrs: { STR: 10, CON: 14, DEX: 3, SPD: 3, INT: 1, WIS: 1, CHA: 1 },
      natural: ['golemFists'], armor: 'golemStone', traits: { tireless: true }, feats: {},
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
      attrs: { STR: 8, CON: 7, DEX: 5, SPD: 5, INT: 4, WIS: 4, CHA: 3 },
      natural: ['tail'], armor: 'sarnakScales', weapons: ['warhammer'], traits: {}, feats: { heavy_weapon_training: 1, toughness: 1 }, keepUnarmed: true,
    },
    sarnakPair: { name: 'Sarnak pair', blurb: 'Two sarnak warriors.', group: ['sarnak', 'sarnak'] },
  };

  // Make a monster (or, for a group, all its members). Returns an array of characters.
  function makeMonster(key, opts) {
    opts = opts || {};
    const M = MONSTERS[key];
    if (M.group) return M.group.map((k, i) => makeMonster(k, Object.assign({}, opts, { n: i }))[0]);
    const c = C.newCharacter({ name: opts.name || M.name + (opts.n ? ' ' + (opts.n + 1) : ''), side: opts.side || 'enemy', base: Object.assign({}, M.attrs), starterGear: false });
    c.level = opts.level || 5;
    c.monster = key;
    c.natural = M.natural.slice();
    c.noUnarmed = !M.keepUnarmed;
    c.traits = JSON.parse(JSON.stringify(M.traits || {}));
    c.feats = Object.assign({}, M.feats || {});
    if (M.armor) c.armor = Items.makeArmor(M.armor, 'full', 'standard');
    if (M.armorItem) c.armor = Items.makeArmor(M.armorItem[0], M.armorItem[1] || 'full', M.quality || 'standard');
    const q = M.quality || 'standard';
    for (const [i, type] of (M.weapons || []).entries()) {
      const w = Items.makeWeapon(type, q);
      c.weapons.push(w);
      if (i === 0) c.wield = w.id;
    }
    if (M.sidearm) { const s = Items.makeWeapon(M.sidearm, q); c.weapons.push(s); c.sidearm = s.id; }
    if (M.shield) c.shield = Items.makeShield(M.shield[0], M.shield[1], q);
    c.policy = Object.assign({}, M.policy || {});
    c.inventory = { bandages: 0, gold: 0, arrows: M.arrows || 0, bodkins: 0, items: [] };
    c.stamina = C.maxStamina(c);
    return [c];
  }

  G.Enemies = { TEMPLATES, generate, makeRng, chooseFeats, MONSTERS, makeMonster };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
