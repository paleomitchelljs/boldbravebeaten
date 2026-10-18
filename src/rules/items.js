/*
 * Item generation: every armor piece, shield and weapon is quality + size + type.
 */
(function (G) {
  'use strict';
  const { ARMOR, SHIELDS, SHIELD_MATERIALS, QUALITY, COVERAGE, WEAPONS, RARITY } = G.DATA;
  const CONFIG = G.CONFIG;

  let nextId = 1;
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + (nextId++).toString(36) + Math.random().toString(36).slice(2, 6);
  }

  const COVERAGE_DURABILITY = { full: 1.0, half: 0.75, partial: 0.5 }; // PROVISIONAL

  function makeArmor(type, coverage, quality) {
    const a = { id: uid('arm'), kind: 'armor', type, coverage: coverage || 'full', quality: quality || 'standard' };
    a.durability = armorMaxDurability(a);
    return a;
  }

  function makeShield(size, material, quality) {
    const s = { id: uid('shd'), kind: 'shield', size, material: material || 'wood', quality: quality || 'standard' };
    s.durability = shieldStats(s).maxDurability;
    return s;
  }

  function makeWeapon(type, quality) {
    return { id: uid('wpn'), kind: 'weapon', type, quality: quality || 'standard' };
  }

  function armorMaxDurability(a) {
    const base = CONFIG.armorDurability[a.type] || 20;
    return Math.max(1, Math.round(base * QUALITY[a.quality].durability * COVERAGE_DURABILITY[a.coverage]));
  }

  // Mitigation and penalties before feats and before durability scaling.
  function armorBase(a) {
    const t = Object.assign({}, ARMOR[a.type], (CONFIG.armorAdjust || {})[a.type] || {});
    const cov = CONFIG.coverage[a.coverage];
    const q = QUALITY[a.quality].bonus;
    const mit = {};
    for (const k of ['P', 'S', 'B']) mit[k] = Math.max(0, t.mit[k] + q + cov.mitigation);
    const pen = (v) => Math.max(0, v + cov.penalty);
    return {
      mit,
      spd: pen(t.spd),
      dex: pen(t.dex),
      stamina: pen(t.stamina),
      regen: pen(t.regen),
      standUp: t.standUp,
      passThrough: cov.passThrough * ((CONFIG.passThroughByArmor && CONFIG.passThroughByArmor[a.type] != null) ? CONFIG.passThroughByArmor[a.type] : 1),
      maxDurability: armorMaxDurability(a),
    };
  }

  function shieldStats(s) {
    const base = SHIELDS[s.size];
    const m = SHIELD_MATERIALS[s.material].mult;
    const q = QUALITY[s.quality];
    return {
      blockAP: base.blockAP,
      threshold: Math.round(base.threshold * m * q.threshold),
      maxDurability: Math.round(base.durability * m * q.durability),
    };
  }

  function itemName(item) {
    if (!item) return '—';
    const q = item.quality && item.quality !== 'standard' ? QUALITY[item.quality].name + ' ' : '';
    if (item.kind === 'armor') {
      const cov = item.coverage === 'full' ? '' : COVERAGE[item.coverage].name.toLowerCase() + ' ';
      return cap(q + cov + ARMOR[item.type].name.toLowerCase() + ' armor');
    }
    if (item.kind === 'shield') {
      return cap(q + SHIELD_MATERIALS[item.material].name.toLowerCase() + ' ' + SHIELDS[item.size].name.toLowerCase() + ' shield');
    }
    if (item.kind === 'weapon') return item.name || cap(q + WEAPONS[item.type].name.toLowerCase());
    return item.name || 'Item';
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function itemRarity(item) {
    const tiers = [];
    if (item.quality) tiers.push(QUALITY[item.quality].rarity);
    if (item.kind === 'armor') tiers.push(ARMOR[item.type].rarity);
    if (item.kind === 'shield') tiers.push(SHIELDS[item.size].rarity, SHIELD_MATERIALS[item.material].rarity);
    if (item.kind === 'weapon') tiers.push(WEAPONS[item.type].rarity);
    let best = 0;
    for (const r of tiers) best = Math.max(best, RARITY.indexOf(r));
    return RARITY[best];
  }


  // ---- Weapon stats ------------------------------------------------------------------
  // Everything the rules need to know about a weapon goes through here, for a particular item
  // (or a bare type). Under CONFIG.weaponModel 'physical' the numbers come from the weapon's
  // physical description; under 'table' they're the hand-set catalog values. Later, materials
  // and enchantments change an item's physical inputs (inputsFor) or its outputs (outputsFor);
  // nothing else reads the catalog's damage, weight or AP numbers directly.
  //
  // Returns the catalog entry plus:
  //   faces   {face: [P, S, B]}      weight  weight class      speed {thrust, swing} AP factors
  //   strMult {motion: ×STR bonus}   wound   {face: {vital, bleed, rounds, kind}}
  const statCache = {};
  function weaponStats(item) {
    const type = typeof item === 'string' ? item : item.type;
    const key = type + '|' + CONFIG.weaponModel + '|' + (typeof item === 'string' ? '' : itemKey(item));
    if (statCache[key]) return statCache[key];
    const def = WEAPONS[type];
    const physical = CONFIG.weaponModel === 'physical' && def.phys && !def.phys.arrow; // bows: hand-set arrows, physical wounds
    const out = physical ? derivePhysical(def, inputsFor(def.phys, item)) : tableStats(def);
    return (statCache[key] = Object.freeze(outputsFor(Object.assign({}, def, out), item)));
  }
  // What about an item can change its stats (none yet: materials and enchantments will).
  function itemKey(item) {
    return [item.material || '', item.enchant || ''].join('|');
  }
  function inputsFor(phys, item) {
    return phys;
  }
  function outputsFor(stats, item) {
    return stats;
  }

  function tableStats(def) {
    const wound = {};
    for (const f of Object.keys(def.faces)) {
      const kind = mainKind(def.faces[f]);
      wound[f] = { kind, vital: 0, bleed: 1, rounds: CONFIG.bleedRounds };
      if (def.natural && CONFIG.weaponModel === 'physical' && kind !== 'B') wound[f].vital = kind === 'P' ? CONFIG.vital.natural : CONFIG.vital.natural / 2;
      if (def.phys && def.phys.arrow && CONFIG.weaponModel === 'physical') Object.assign(wound[f], pointWound(def.phys.arrow));
    }
    const strMult = {};
    for (const m of Object.keys(G.DATA.MOTIONS)) strMult[m] = 1;
    return { faces: def.faces, weight: def.weight, speed: { thrust: 1, swing: 1 }, strMult, wound, model: 'table' };
  }

  function mainKind(v) {
    const i = v.indexOf(Math.max(v[0], v[1], v[2]));
    return ['P', 'S', 'B'][i];
  }

  function pointWound(pt) {
    const X = CONFIG.weaponPhysics, V = CONFIG.vital;
    return {
      kind: 'P',
      vital: Math.min(V.max, pt.depth * V.perDepth),
      bleed: pt.width / X.bleedWidth,
      rounds: Math.round(X.bleedRounds.base + pt.depth / X.bleedRounds.perDepth),
    };
  }

  function derivePhysical(def, ph) {
    const X = CONFIG.weaponPhysics, V = CONFIG.vital;
    const grip = def.hands === 2 ? X.grip : 1;
    const ml = ph.mass * ph.length;
    const faces = {}, wound = {};
    if (ph.point) {
      faces.point = [Math.round(ph.point.depth * X.pointDamage), 0, 0];
      wound.point = pointWound(ph.point);
    }
    if (ph.edge) {
      const S = Math.round(ph.edge * (X.edgeDamage.base + X.edgeDamage.k * Math.sqrt(ml * grip)));
      faces.edge = [0, S, Math.round(S / 7)];
      wound.edge = { kind: 'S', vital: V.cut * ph.edge, bleed: 1, rounds: CONFIG.bleedRounds };
    }
    if (ph.head) {
      const B = Math.round(1 + X.headDamage * Math.sqrt(ph.head.mass * ph.length * grip));
      const sp = ph.head.spikes;
      faces.head = [sp ? Math.round(sp.depth * X.pointDamage) : 0, ph.head.cut || 0, B];
      wound.head = sp ? pointWound(sp) : { kind: 'B', vital: 0, bleed: 1, rounds: CONFIG.bleedRounds };
    }
    if (ph.beak) {
      faces.beak = [Math.round(ph.beak.depth * X.pointDamage), 0, 1];
      wound.beak = pointWound(ph.beak);
    }
    if (ph.hilt) {
      faces.hilt = [0, 0, Math.round(X.hiltDamage.base + X.hiltDamage.k * Math.sqrt(ml))];
      wound.hilt = { kind: 'B', vital: 0, bleed: 1, rounds: CONFIG.bleedRounds };
    }
    const refMl = Math.sqrt(X.ref.mass * X.ref.length);
    const speed = {
      thrust: 1 + X.thrustSlope * (ph.mass / grip / X.ref.mass - 1),
      swing: 1 + X.swingSlope * (Math.sqrt(ml) / refMl - 1),
    };
    const weight = X.weightClass.find(([max]) => ph.mass < max)[1];
    const width = (ph.point || ph.beak || {}).width || 0;
    const swingMult = (g) => Math.min(X.str.max, (ph.mass * g) / X.str.swingRefMass);
    const strMult = {
      thrust: X.str.thrustBase + X.str.thrustWidth * Math.min(1, width / 5),
      swing: swingMult(grip),
      twoHanded: swingMult(X.grip),
      power: swingMult(X.grip),
      shoot: 0,
    };
    // Natural weapons are the body itself: STR counts in full, and the effort is the creature's
    // (the catalog's weight class), not a carried mass.
    if (def.natural) for (const m of Object.keys(strMult)) if (m !== 'shoot') strMult[m] = 1;
    return { faces, weight: def.natural ? def.weight : weight, speed, strMult, wound, model: 'physical' };
  }

  G.Items = { weaponStats, uid, makeArmor, makeShield, makeWeapon, armorBase, armorMaxDurability, shieldStats, itemName, itemRarity };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
