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

  // Craft, metal and origin by level band (rules.yaml enemyGear).
  function rollGear(rng, level, what, fallback) {
    const T = G.CONFIG.enemyGear && G.CONFIG.enemyGear[what];
    return T ? pick(rng, T[band(level)]) : fallback;
  }

  // Tags for a rolled armor piece or weapon: a metal one gets a rolled metal; any may get an origin.
  function rollTags(rng, level, usual) {
    const tags = { origin: rollGear(rng, level, 'origin', 'common') };
    const M = G.DATA.MATERIALS[usual];
    if (M && M.metal) tags.material = rollGear(rng, level, 'metal', usual);
    return tags;
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
    if (armorType) c.armor = Items.makeArmor(armorType, pick(rng, T.coverage[b]), rollGear(rng, level, 'craft', 'average'), rollTags(rng, level, G.DATA.ARMOR[armorType].material));
    const shieldSize = pick(rng, T.shield[b]);
    if (shieldSize) c.shield = Items.makeShield(shieldSize, shieldMaterial(rng, level), rollGear(rng, level, 'craft', 'average'));
    const wType = pick(rng, T.weapons[b]);
    if (wType) {
      const tags = rollTags(rng, level, G.DATA.WEAPONS[wType].material);
      const w = Items.makeWeapon(wType, rollGear(rng, level, 'craft', 'average'), tags.material, tags);
      c.weapons.push(w);
      c.wield = w.id;
      // A greatsword means the shield stays home.
      if (G.DATA.WEAPONS[wType].hands === 2) c.shield = null;
    }
    if (T.sidearm && wType !== T.sidearm) {
      const s = Items.makeWeapon(T.sidearm, 'average');
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
  //   weapons, shield, sidearm, craft, arrows — carried gear, for monsters that use it; armorItem,
  //   weaponItems, shieldItem — items with their tags spelled out
  //   policy   — AI policy (grappler, kite…)
  //   group    — several creatures (a pack)
  const MONSTERS = {}; // monsters.yaml

  // A conjured creature (Magic: Conjure). 'elemental': a spirit of the noun whose blows carry it,
  // tireless, stronger with the spell's magnitude. 'raise': the dead walk (a zombie).
  function makeConjured(kind, noun, mag) {
    // A summoned beast: a monster from monsters.yaml ({monster, name}).
    if (kind && typeof kind === 'object' && kind.monster && MONSTERS[kind.monster]) {
      const [b] = makeMonster(kind.monster);
      if (kind.name) b.name = kind.name;
      b.lootTable = null;
      b.xp = 0;
      return b;
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

  // The dead raised (Magic.raise; CONFIG.magic.raise). 'skeleton' and 'zombie' are monster templates; 'revenant'
  // copies the body: its physical attributes (unhurt), its gear, its fighting feats and natural weapons, as a
  // tireless undead with no mind of its own (no spells, no nouns).
  function makeRaised(tier, body) {
    const R = G.CONFIG.magic.raise || {};
    let c;
    if (tier === 'revenant') {
      c = JSON.parse(JSON.stringify(body));
      c.id = G.Items.uid('chr');
      c.name = `Revenant ${body.name}`;
      c.damage = {};
      for (const a of G.CONFIG.attributes) c.damage[a] = 0;
      Object.assign(c.base, { INT: 1, WIS: 3, CHA: 1, WIL: Math.max(5, c.base.WIL || 5) });
      for (const f of Object.keys(c.feats || {})) if (G.DATA.FEATS[f] && /^magic/.test(G.DATA.FEATS[f].tree)) delete c.feats[f];
      c.nouns = [];
      c.spSpent = 0;
      c.bleeds = [];
      c.traits = Object.assign({}, c.traits || {}, { tireless: true, undead: true });
      c.status = C.freshStatus();
      c.trinkets = [];
      c.companion = null;
      c.look = null;
      c.sprite = { art: 'shadow-knight', kind: 'skeleton_warrior', tint: '#7a7a9a' };
      for (const w of c.weapons || []) w.id = G.Items.uid('wpn');
      c.wield = c.weapons && c.weapons.length ? (c.weapons.find((w) => !G.Items.weaponBroken(w)) || c.weapons[0]).id : null;
      c.sidearm = null;
      c.offhand = null;
    } else {
      const key = R[tier];
      if (!key || !MONSTERS[key]) return null;
      [c] = makeMonster(key);
      c.name = `Risen ${MONSTERS[key].name.toLowerCase()}`;
    }
    c.lootTable = null;
    c.xp = 0;
    c.faction = null;
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
    // Gear: `craft` (or an old `quality`) for everything carried; armorItem, weaponItems and shieldItem
    // spell out an item's tags ({type | size, coverage, material, origin, craft, enchantments, name}).
    // `origin` is the make of everything carried that doesn't name its own.
    const q = M.craft || M.quality || 'average';
    const made = (spec) => Object.assign({ origin: M.origin }, spec || {});
    if (M.armor) c.armor = Items.makeArmor(M.armor, 'full', 'average');
    if (M.armorItem) { const a = made(M.armorItem); c.armor = Items.makeArmor(a.type, a.coverage || 'full', a.craft || q, a); }
    for (const [i, type] of (M.weapons || []).entries()) {
      const w = Items.makeWeapon(type, q, null, made());
      c.weapons.push(w);
      if (i === 0) c.wield = w.id;
    }
    for (const spec of M.weaponItems || []) {
      const w = Items.makeWeapon(spec.type, spec.craft || q, spec.material, made(spec));
      c.weapons.push(w);
      if (!c.wield) c.wield = w.id;
    }
    if (M.sidearm) { const s = Items.makeWeapon(M.sidearm, q, null, made()); c.weapons.push(s); c.sidearm = s.id; }
    if (M.shield) c.shield = Items.makeShield(M.shield[0], M.shield[1], q, made());
    if (M.shieldItem) { const sh = made(M.shieldItem); c.shield = Items.makeShield(sh.size, sh.material, sh.craft || q, sh); }
    c.policy = Object.assign({}, M.policy || {});
    c.inventory = { bandages: 0, gold: 0, arrows: M.arrows || 0, bodkins: 0, items: [] };
    c.stamina = C.maxStamina(c);
    return [c];
  }

  G.Enemies = { makeConjured, makeRaised, TEMPLATES, generate, makeRng, chooseFeats, MONSTERS, makeMonster };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
