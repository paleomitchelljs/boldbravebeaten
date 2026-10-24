/*
 * Items: every weapon, armor piece and shield is a type plus the same tags:
 *   material      what it is made of (materials.yaml): hardness, toughness, weight, protection
 *   origin        where and in what style it was made (origins.yaml): how weight trades against durability,
 *                 damage and protection
 *   craft         how well it was made (crafts.yaml): how fast it wears and how easily it breaks
 *   enchantments  usually none (enchantments.yaml)
 * Armor also has a coverage (full, half, partial); shields a size. Everything the rules need about an item
 * comes through here.
 */
(function (G) {
  'use strict';
  const { ARMOR, SHIELDS, SHIELD_MATERIALS, MATERIALS, ORIGINS, CRAFTS, ENCHANTMENTS, COVERAGE, WEAPONS, RARITY } = G.DATA;
  const CONFIG = G.CONFIG;

  let nextId = 1;
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + (nextId++).toString(36) + Math.random().toString(36).slice(2, 6);
  }

  const COVERAGE_DURABILITY = { full: 1.0, half: 0.75, partial: 0.5 }; // PROVISIONAL

  // ---- Tags ----------------------------------------------------------------------------------
  // Old saves and data name a quality: crude → poor; standard and fine → average; masterwork and legendary → master.
  const OLD_QUALITY = { crude: 'poor', standard: 'average', fine: 'average', masterwork: 'master', legendary: 'master' };
  function craftId(q) {
    if (!q) return 'average';
    return CRAFTS[q] ? q : OLD_QUALITY[q] || null;
  }

  function craftOf(item) {
    return CRAFTS[craftId(item && (item.craft || item.quality)) || 'average'] || {};
  }

  function originOf(item) {
    return ORIGINS[(item && item.origin) || 'common'] || {};
  }

  function enchantsOf(item) {
    return ((item && item.enchantments) || []).map((x) => ENCHANTMENTS[x]).filter(Boolean);
  }

  // The type's usual material (a shield's is its own: shields are sized, not typed by material).
  function usualMaterial(item) {
    if (!item) return null;
    if (item.kind === 'armor') return (ARMOR[item.type] || {}).material || null;
    if (item.kind === 'shield') return item.material || null;
    return (WEAPONS[item.type] || {}).material || null;
  }

  function materialOf(item) {
    return (item && item.material) || usualMaterial(item);
  }

  // A material property of this item against its type's usual material (weight, protect, toughness).
  function matRatio(item, key) {
    const own = MATERIALS[usualMaterial(item)] || {}, mine = MATERIALS[materialOf(item)] || own;
    const a = mine[key] != null ? mine[key] : 1, b = own[key] != null ? own[key] : 1;
    return a / b;
  }

  // Origin × enchantments for a multiplier key (weight, protect, damage, durability, wear).
  function tagMult(item, key) {
    const o = originOf(item);
    let m = o[key] != null ? o[key] : 1;
    for (const e of enchantsOf(item)) if (e[key] != null) m *= e[key];
    return m;
  }

  // How much of the wear a blow does this item actually takes: craft and enchantments.
  function wearMult(item) {
    const c = craftOf(item);
    return (c.wear != null ? c.wear : 1) * tagMult(item, 'wear');
  }

  function isMetal(item) {
    return !!(MATERIALS[materialOf(item)] || {}).metal;
  }

  function rusts(item) {
    return !!(MATERIALS[materialOf(item)] || {}).rusts;
  }

  function hardness(material) {
    return (MATERIALS[material] || {}).hardness || 0;
  }

  // Tags given to a maker: material (kept even when usual), origin, enchantments.
  function applyTags(item, tags) {
    tags = tags || {};
    if (tags.origin && tags.origin !== 'common') item.origin = tags.origin;
    if (tags.enchantments && tags.enchantments.length) item.enchantments = tags.enchantments.slice();
    if (tags.name) item.name = tags.name;
    return item;
  }

  // An item from an old save: quality becomes craft; scale armor (no longer a tier) becomes steel mail.
  function normalizeItem(item) {
    if (!item || !item.kind) return item;
    if (item.quality != null) {
      if (!item.craft) item.craft = craftId(item.quality) || 'average';
      delete item.quality;
    }
    if (!item.craft) item.craft = 'average';
    if (item.kind === 'armor' && item.type === 'scale') { item.type = 'mail'; item.material = 'steel'; }
    if (item.kind === 'armor' && !item.material) item.material = usualMaterial(item);
    return item;
  }

  // ---- Makers --------------------------------------------------------------------------------
  // craft: poor | average | master (an old quality name is read as one). tags: {material, origin, enchantments, name}.
  function makeArmor(type, coverage, craft, tags) {
    const a = { id: uid('arm'), kind: 'armor', type, coverage: coverage || 'full', craft: craftId(craft) || 'average' };
    a.material = (tags && tags.material) || ARMOR[type].material || null;
    applyTags(a, tags);
    a.durability = armorMaxDurability(a);
    return a;
  }

  function makeShield(size, material, craft, tags) {
    const s = { id: uid('shd'), kind: 'shield', size, material: material || 'wood', craft: craftId(craft) || 'average' };
    applyTags(s, tags);
    s.durability = shieldStats(s).maxDurability;
    return s;
  }

  // material: optional, when it differs from the weapon type's own (an iron longsword).
  function makeWeapon(type, craft, material, tags) {
    const w = { id: uid('wpn'), kind: 'weapon', type, craft: craftId(craft) || 'average' };
    if (material && material !== WEAPONS[type].material) w.material = material;
    applyTags(w, tags);
    const max = weaponMaxDurability(w);
    if (max) w.durability = max;
    return w;
  }

  // ---- Weapon wear (CONFIG.weaponWear) ------------------------------------------------------
  function weaponMaterial(w) {
    return (w && (w.material || (WEAPONS[w.type] && WEAPONS[w.type].material))) || null;
  }

  // 0 for weapons that never wear (natural weapons, bows, anything without a durability).
  function weaponMaxDurability(w) {
    const def = w && WEAPONS[w.type];
    if (!def || !def.durability || w.natural || !CONFIG.weaponWear) return 0;
    const item = Object.assign({ kind: 'weapon' }, w);
    return Math.max(1, Math.round(def.durability * matRatio(item, 'toughness') * craftOf(w).durability * tagMult(w, 'durability')));
  }

  // Current durability; a weapon that has never been knocked is whole.
  function weaponDurability(w) {
    const max = weaponMaxDurability(w);
    if (!max) return null;
    return w.durability == null ? max : Math.max(0, Math.min(max, w.durability));
  }

  function weaponBroken(w) {
    const d = weaponDurability(w);
    return d != null && d <= 0;
  }

  // Share of its damage a worn weapon still does: CONFIG.weaponWear.floor at the end of its life, all of it when whole.
  function weaponEfficacy(w) {
    const max = weaponMaxDurability(w);
    if (!max) return 1;
    const fl = CONFIG.weaponWear.floor;
    return fl + (1 - fl) * (weaponDurability(w) / max);
  }

  // ---- Armor -----------------------------------------------------------------------------------
  function armorMaxDurability(a) {
    const t = ARMOR[a.type];
    const base = t.durability || 20;
    const item = Object.assign({ kind: 'armor' }, a);
    return Math.max(1, Math.round(base * matRatio(item, 'toughness') * tagMult(a, 'durability') * craftOf(a).durability * COVERAGE_DURABILITY[a.coverage || 'full']));
  }

  const tenth = (x) => Math.round(x * 10) / 10;

  // Mitigation, penalties and the point-in-armor numbers before feats and before durability scaling.
  // Material and origin protection scale slashing and piercing mitigation and the pierce resistance;
  // their weight scales the penalties (to a tenth: elven mail is lighter than common mail).
  function armorBase(a) {
    const item = Object.assign({ kind: 'armor' }, a);
    const t = Object.assign({}, ARMOR[a.type], (CONFIG.armorAdjust || {})[a.type] || {});
    const cov = CONFIG.coverage[a.coverage || 'full'];
    const protect = matRatio(item, 'protect') * tagMult(a, 'protect');
    const weight = matRatio(item, 'weight') * tagMult(a, 'weight');
    const mit = {};
    const bonus = { P: 0, S: 0, B: 0 };
    let resistBonus = 0;
    for (const e of enchantsOf(a)) { for (const k of ['P', 'S', 'B']) bonus[k] += (e.mitBonus && e.mitBonus[k]) || 0; resistBonus += e.resistBonus || 0; }
    for (const k of ['P', 'S', 'B']) mit[k] = Math.max(0, Math.round(t.mit[k] * (k === 'B' ? 1 : protect)) + cov.mitigation + bonus[k]);
    const pen = (v) => Math.max(0, tenth(tenth(v * weight) + cov.penalty));
    const PC = CONFIG.pierce;
    const pierce = t.pierce ? {
      resist: Math.round((t.pierce.resist * protect + resistBonus) * 100) / 100,
      gap: t.pierce.gap + ((PC && PC.coverageGap && PC.coverageGap[a.coverage || 'full']) || 0),
    } : null;
    return {
      mit,
      spd: pen(t.spd),
      dex: pen(t.dex),
      stamina: pen(t.stamina),
      regen: Math.round(pen(t.regen)),
      standUp: t.standUp,
      passThrough: cov.passThrough * ((CONFIG.passThroughByArmor && CONFIG.passThroughByArmor[a.type] != null) ? CONFIG.passThroughByArmor[a.type] : 1),
      maxDurability: armorMaxDurability(a),
      pierce,
      passBurst: cov.passThrough, // a point that has burst the armor: coverage only, not plate's glancing factor
      transmit: t.transmit || 1,
      cutThrough: t.cutThrough != null ? t.cutThrough * protect : null,
      dissipate: { glancing: (t.dissipate && t.dissipate.glancing) || 0, crushing: (t.dissipate && t.dissipate.crushing) || 0 },
      material: materialOf(item),
      metal: isMetal(item),
      weight: t.weight ? tenth(t.weight * weight * (COVERAGE_DURABILITY[a.coverage || 'full'])) : null,
    };
  }

  function shieldStats(s) {
    const base = SHIELDS[s.size];
    const m = SHIELD_MATERIALS[s.material].mult;
    const c = craftOf(s);
    return {
      blockAP: base.blockAP,
      threshold: Math.round(base.threshold * m * tagMult(s, 'protect') * (c.break != null ? c.break : 1)),
      maxDurability: Math.round(base.durability * m * tagMult(s, 'durability') * (c.durability != null ? c.durability : 1)),
      unbreakable: !!c.unbreakable,
    };
  }

  // ---- Names and rarity ------------------------------------------------------------------------
  // [craft] [origin] [material] [coverage] type [of enchantments]: "Masterwork dwarven steel plate armor".
  // The material is named when it isn't the type's usual one, or when the type is made in several metals.
  function itemName(item) {
    if (!item) return '—';
    if (item.name) return item.name;
    const words = [];
    const c = craftOf(item).name, o = originOf(item).name;
    if (c) words.push(c.toLowerCase());
    if (o) words.push(o.toLowerCase());
    const mat = materialOf(item), M = MATERIALS[mat];
    if (item.kind === 'armor') {
      const t = ARMOR[item.type];
      const usual = MATERIALS[t.material];
      if (M && (mat !== t.material || (usual && usual.metal))) words.push(M.name.toLowerCase());
      if (item.coverage && item.coverage !== 'full') words.push(COVERAGE[item.coverage].name.toLowerCase());
      words.push(t.name.toLowerCase() + ' armor');
    } else if (item.kind === 'shield') {
      words.push(SHIELD_MATERIALS[item.material].name.toLowerCase(), SHIELDS[item.size].name.toLowerCase() + ' shield');
    } else if (item.kind === 'weapon') {
      if (item.material && M && item.material !== WEAPONS[item.type].material) words.push(M.name.toLowerCase());
      words.push(WEAPONS[item.type].name.toLowerCase());
    } else return 'Item';
    const ench = enchantsOf(item).map((e) => e.name.toLowerCase());
    return cap(words.join(' ') + (ench.length ? ' of ' + ench.join(' and ') : ''));
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function itemRarity(item) {
    const tiers = [craftOf(item).rarity, originOf(item).rarity];
    const M = MATERIALS[materialOf(item)];
    if (M && item.kind !== 'shield') tiers.push(M.rarity);
    if (item.kind === 'armor') tiers.push(ARMOR[item.type].rarity);
    if (item.kind === 'shield') tiers.push(SHIELDS[item.size].rarity, SHIELD_MATERIALS[item.material].rarity);
    if (item.kind === 'weapon') tiers.push(WEAPONS[item.type].rarity);
    for (const e of enchantsOf(item)) tiers.push(e.rarity);
    let best = 0;
    for (const r of tiers) if (r) best = Math.max(best, RARITY.indexOf(r));
    return RARITY[best];
  }

  // Price multiplier from the tags (the type's own value is the economy's business).
  function tagValue(item) {
    let v = (craftOf(item).value || 1) * (originOf(item).value || 1);
    if (item.kind !== 'shield') {
      const own = MATERIALS[usualMaterial(item)], mine = MATERIALS[materialOf(item)];
      if (own && mine && own !== mine) v *= (mine.value || 1) / (own.value || 1);
    }
    for (const e of enchantsOf(item)) v *= e.value || 1;
    return v;
  }

  // ---- Weapon stats ------------------------------------------------------------------
  // Everything the rules need to know about a weapon goes through here, for a particular item
  // (or a bare type). Under CONFIG.weaponModel 'physical' the numbers come from the weapon's
  // physical description; under 'table' they're the hand-set catalog values. Material and origin
  // change the item's physical inputs (inputsFor: a lighter make is quicker and hits softer);
  // origin and enchantments scale the outputs (outputsFor). Nothing else reads the catalog's
  // damage, weight or AP numbers directly.
  //
  // Returns the catalog entry plus:
  //   faces   {face: [P, S, B]}      weight  weight class      speed {thrust, swing} AP factors
  //   strMult {motion: ×STR bonus}   wound   {face: {vital, bleed, rounds, kind}}
  //   punch   {face: force a point drives into armor (CONFIG.pierce), one-handed motion}
  const statCache = {};
  function weaponStats(item) {
    const type = typeof item === 'string' ? item : item.type;
    const key = type + '|' + CONFIG.weaponModel + '|' + (typeof item === 'string' ? '' : itemKey(item));
    if (statCache[key]) return statCache[key];
    const def = WEAPONS[type];
    const physical = CONFIG.weaponModel === 'physical' && def.phys && !def.phys.arrow; // bows: hand-set arrows, physical wounds
    const out = physical ? derivePhysical(def, inputsFor(def, item)) : tableStats(def);
    return (statCache[key] = Object.freeze(outputsFor(Object.assign({}, def, out), item)));
  }
  // What about an item can change its stats: material, origin, enchantments.
  function itemKey(item) {
    return [item.material || '', item.origin || '', (item.enchantments || []).join('+')].join('|');
  }
  // Material and origin weight change the mass (and the head's): speed, damage, strain and punch follow.
  function inputsFor(def, item) {
    const ph = def.phys;
    if (typeof item === 'string' || !ph) return ph;
    const k = matRatio(Object.assign({ kind: 'weapon' }, item), 'weight') * tagMult(item, 'weight');
    if (k === 1) return ph;
    const out = Object.assign({}, ph, { mass: ph.mass * k });
    if (ph.head) out.head = Object.assign({}, ph.head, { mass: ph.head.mass * k });
    return out;
  }
  // The item's mass in kg (its type's, × material and origin weight); null for bows and natural weapons.
  function weaponMass(item) {
    const def = WEAPONS[item.type];
    if (!def || def.natural || !def.phys || !def.phys.mass) return null;
    return Math.round(inputsFor(def, item).mass * 100) / 100;
  }
  function outputsFor(stats, item) {
    if (typeof item === 'string') return stats;
    const k = tagMult(item, 'damage');
    if (k === 1) return stats;
    const faces = {};
    for (const f of Object.keys(stats.faces)) faces[f] = stats.faces[f].map((x) => Math.round(x * k));
    return Object.assign(stats, { faces });
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
    return { faces: def.faces, weight: def.weight, speed: { thrust: 1, swing: 1 }, strMult, wound, punch: punchOf(def, def.phys), model: 'table' };
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

  // Punch (CONFIG.pierce): the force a point drives into armor, for a one-handed motion (two-handed
  // weapons count both hands). A thrust: the mass behind the point. A swung beak or spikes: the head's mass
  // with the leverage of the haft, × swingPunch. Arrows: the bow's. A `punch` on the point overrides
  // (a dagger is driven by the whole arm), scaled with the item's mass.
  function punchOf(def, ph) {
    const out = {};
    if (!ph) return out;
    const X = CONFIG.weaponPhysics, P = CONFIG.pierce || {};
    const grip = def.hands === 2 ? X.grip : 1;
    const scale = def.phys && def.phys.mass ? ph.mass / def.phys.mass : 1;
    if (ph.arrow) out.arrow = ph.arrow.punch || 0;
    if (ph.point) out.point = ph.point.punch != null ? ph.point.punch * scale : ph.mass * grip;
    const swung = ((ph.head && ph.head.mass) || ph.mass) * (ph.length / X.ref.length) * (P.swingPunch || 1) * grip;
    if (ph.beak) out.beak = ph.beak.punch != null ? ph.beak.punch * scale : swung;
    if (ph.head && ph.head.spikes) out.head = ph.head.spikes.punch != null ? ph.head.spikes.punch * scale : swung;
    for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 100) / 100;
    if (ph.point && ph.point.maxPunch != null) out.pointMax = ph.point.maxPunch; // a flexible blade bends past this
    return out;
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
    // Natural speed (no STR in it): lighter and shorter is quicker; heavier is a matter of strain
    // (Character.strikeOption), not of the weapon alone. Load: what the wielder must move.
    const speed = {
      thrust: 1 + X.thrustSlope * (Math.min(1, ph.mass / grip / X.ref.mass) - 1),
      swing: 1 + X.swingSlope * (Math.min(1, Math.sqrt(ml) / refMl) - 1) + (X.reachSlope || 0) * Math.max(0, ph.length / X.ref.length - 1),
    };
    const load = { thrust: ph.mass * ((X.strain && X.strain.thrustLoad) || 1), swing: ph.mass * ph.length / X.ref.length };
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
    return { faces, weight: def.natural ? def.weight : weight, speed, load, strMult, wound, punch: punchOf(def, ph), model: 'physical' };
  }

  // Squares a weapon reaches with a motion family ('thrust', or 'swing' for every swing), and the
  // closest it works without being cramped. A bare number is an old file's swing reach.
  function reachOf(def, motion) {
    const r = def && def.reach;
    if (r == null) return 0;
    if (typeof r === 'number') return r;
    return (motion === 'thrust' ? r.thrust : r.swing) || 0;
  }
  function reachMin(def) {
    return (def && def.reach && typeof def.reach === 'object' && def.reach.min) || 1;
  }
  function longestReach(def) {
    return Math.max(reachOf(def, 'swing'), reachOf(def, 'thrust'));
  }

  G.Items = {
    weaponStats, uid, makeArmor, makeShield, makeWeapon, armorBase, armorMaxDurability, shieldStats, itemName, itemRarity,
    weaponMaterial, weaponMaxDurability, weaponDurability, weaponBroken, weaponEfficacy, hardness,
    craftId, craftOf, originOf, enchantsOf, materialOf, tagMult, wearMult, tagValue, isMetal, rusts, normalizeItem,
    reachOf, reachMin, longestReach, weaponMass,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
