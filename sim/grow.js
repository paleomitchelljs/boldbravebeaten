/*
 * Heroes grown to a level, as tools/tiers.js grows them: every start.yaml hero along its plan (World.settle), with a
 * gear ladder standing in for what they'd have taken off the foes of the levels before.
 *
 * The gear ladder (PROVISIONAL, sims only): steel weapons from level 3, steel armor and shield from 5, masterwork
 * star-iron weapons from 7. Wood stays wood, leather leather.
 */
'use strict';
const path = require('path');

function gear(spec, level) {
  const B = require(path.join(__dirname, '..', 'tests', 'load.js'));
  const D = B.DATA;
  const metal = (m) => !!(D.MATERIALS[m] || {}).metal;
  const s = JSON.parse(JSON.stringify(spec));
  const kit = ((B.Content.world.start || {}).kits || []).find((k) => k.id === s.kit) || {};
  if (!s.weaponItems) s.weaponItems = [kit.wield && { weapon: kit.wield }, kit.sidearm && { weapon: kit.sidearm }].filter(Boolean);
  if (s.armorItem === undefined && kit.armor) s.armorItem = { armor: kit.armor };
  if (s.shieldItem === undefined && kit.shield) s.shieldItem = { shield: kit.shield, material: 'wood' };
  for (const w of s.weaponItems) {
    if (!metal(D.WEAPONS[w.weapon].material)) continue;
    if (level >= 7) { w.material = 'starIron'; w.craft = 'master'; } else if (level >= 3) w.material = 'steel';
  }
  if (level >= 5 && s.armorItem && metal(s.armorItem.material || D.ARMOR[s.armorItem.armor].material)) s.armorItem.material = 'steel';
  if (level >= 5 && s.shieldItem) s.shieldItem.material = 'steel';
  if (level >= 7 && s.armorItem) s.armorItem.craft = 'master';
  return s;
}

// Every start.yaml hero (presets and recruits), grown to the level: specs for World.create.
function heroesAt(level) {
  const B = require(path.join(__dirname, '..', 'tests', 'load.js'));
  return B.World.heroes().map((h) => gear(B.World.settle(h, level), level));
}

module.exports = { gear, heroesAt };
