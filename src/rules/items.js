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
    const t = ARMOR[a.type];
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
      passThrough: cov.passThrough,
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
    if (item.kind === 'weapon') return cap(q + WEAPONS[item.type].name.toLowerCase());
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

  G.Items = { uid, makeArmor, makeShield, makeWeapon, armorBase, armorMaxDurability, shieldStats, itemName, itemRarity };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
