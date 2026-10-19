// Loads the browser scripts into Node's global scope, in the same order as index.html, then
// installs the YAML content from data/.
const path = require('path');
const files = ['data/yaml', 'data/content', 'rules/config', 'rules/data', 'rules/items', 'rules/character', 'rules/conditions', 'rules/terrain', 'rules/magic', 'rules/ritual', 'rules/combat', 'rules/enemies', 'rules/recovery', 'rules/ai', 'game/rand', 'game/conditions', 'game/skills', 'game/factions', 'game/world', 'game/equip', 'game/economy', 'game/loot', 'game/explore', 'game/battle', 'game/parley', 'game/town', 'game/save', 'game/auto'];
for (const f of files) require(path.join(__dirname, '..', 'src', f + '.js'));
const res = globalThis.BBB.Content.loadSync();
if (!res.ok) throw new Error('Content failed to load:\n' + res.errors.join('\n'));
module.exports = globalThis.BBB;
