// One-time: dumped the catalogs that used to live in src/rules/data.js, enemies.js and config.js
// into data/*.yaml. Kept for the record; the YAML files are now the source of truth.
const fs = require('fs'), path = require('path');
const B = require('../../tests/load.js'); require('../../src/data/yaml.js');
const Y = B.Yaml;
const out = (name, header, obj) => fs.writeFileSync(path.join(__dirname, '../../data', name), header.replace(/^/gm, '# ').replace(/ +$/gm, '') + '\n\n' + Y.stringify(obj));
const D = B.DATA;
out('armor.yaml', 'Armor types. mit = mitigation per damage face (P pierce, S slash, B blunt) at full coverage.\nspd/dex = penalty to SPD and DEX; stamina = extra stamina per action; regen = stamina regeneration penalty;\nstandUp = extra AP to rise from prone. natural: true marks monster hides (cannot be worn or looted).\nrecoil: attackers lose this much stamina per blow that lands.', D.ARMOR);
out('shields.yaml', 'Shield sizes (types) and the materials they are made of.\nblockAP = AP cost of a block; threshold = force a shield stops before it breaks or lets blunt through;\ndurability = base hit points; mult (materials) scales threshold and durability.', { types: D.SHIELDS, materials: D.SHIELD_MATERIALS });
out('qualities.yaml', 'Quality grades for weapons, armor and shields. bonus = to-hit/parry style bonus, durability and threshold are multipliers.', D.QUALITY);
out('weapons.yaml', 'Weapons, including the natural weapons of monsters (natural: true).\nphys describes the weapon physically (mass kg, length m, point/edge/head); damage, AP, STR scaling and\nwounds are worked out from it (Items.weaponStats). See src/rules/data.js for the field list.', D.WEAPONS);
const trees = D.TREES.map((t) => {
  const feats = {};
  for (const f of Object.values(D.FEATS).filter((f) => f.tree === t.id)) { const { id, tree, ...rest } = f; feats[id] = rest; }
  return { ...t, feats };
});
out('feats.yaml', 'Feat trees. A feat has ranks (novice to master), requires (a list of alternatives; each alternative is a list of\n"feat:rank" that must all hold), an effect line, and auto: true when the engine implements it\n(auto: false feats are recorded on the sheet but have no effect yet).', trees);
out('spells.yaml', 'The magic grammar: verbs, nouns and modifiers. feat = the feat that teaches a verb or modifier.\nNouns are found in the world; see the nouns list in each character (c.nouns).', B.CONFIG.magic.words);
out('monsters.yaml', 'Monsters. attrs may exceed the human cap. natural = natural weapons (weapons.yaml). group lists a pack.\ntraits are mechanical hooks: pack, regen, resist, tireless, apMult, staminaMult, size, aura, and so on.', B.Enemies.MONSTERS);
out('foes.yaml', 'Templates for generated human foes (bandits, guards). Gear lists are [weight, value] pairs by level band [1-2, 3-5, 6+].', B.Enemies.TEMPLATES);
