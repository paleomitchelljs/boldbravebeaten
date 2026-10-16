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

  G.Enemies = { TEMPLATES, generate, makeRng, chooseFeats };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
