// The retired first dungeons and town quests (tests/fixtures/legacy.yaml), merged over the loaded content for tests
// that need their doors, traps, locks, sleepers and quest chains. Requiring it twice is harmless.
const fs = require('fs');
const path = require('path');
const B = require('./load.js');
const W = B.Content.world;
if (!W.places.undercroft_1) {
  const L = B.Yaml.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'legacy.yaml'), 'utf8'));
  Object.assign(W.places, L.places);
  W.quests = Object.assign(W.quests || {}, L.quests);
  Object.assign(W.npcs, L.npcs);
  for (const [id, topics] of Object.entries(L.npcTopics)) W.npcs[id].topics = (W.npcs[id].topics || []).concat(topics);
  Object.assign(W.items.goods, L.goods);
  W.places.stonebridge.exits = W.places.stonebridge.exits.concat(['undercroft_1', 'barrow', 'trollhole'].map((to) => ({ to, label: W.places[to].name, arrive: '<' })));
  const errs = B.Content.validate();
  if (errs.length) throw new Error('legacy fixture:\n' + errs.join('\n'));
}
module.exports = B;
