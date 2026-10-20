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
  const TEMPLATES = {}; // foes.yaml

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
    c.sprite = T.sprite || null;
    c.faction = T.faction || null;
    c.xp = (T.xpPerLevel || 20) * level;
    c.lootTable = T.loot || 'humanoid_purse';

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
  const MONSTERS = {}; // monsters.yaml

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
    c.faction = M.faction || null;
    c.xp = M.xp || 10;
    c.glyph = M.glyph || null;
    c.sprite = M.sprite || null;
    c.lootTable = M.loot || null;
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
