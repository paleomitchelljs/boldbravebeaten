// The debug tools' no-fights mode: for looking round a place without its foes or traps getting in the way.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Explore, Rand } = B;

test('no fights: foes never notice the party and can be walked through', () => {
  Rand.seed(3);
  const w = World.create(World.presetParty(), { log: false });
  w.peaceful = true;
  Explore.enter(w, 'temple_wall', '1');
  // The guardhouse watch stands at (3, 10); walk down past the well and onto it.
  const ex = w.explore;
  ex.x = 3; ex.y = 9; ex.dir = 2;
  const r = Explore.move(w, 0);
  assert.equal(r.moved, true);
  assert.deepEqual([ex.x, ex.y], [3, 10]);
  assert.ok(!r.events.some((e) => e.type === 'encounter' || e.type === 'unseen' || e.type === 'prompt'));
  // With it off, the same square is a fight again.
  w.peaceful = false;
  assert.equal(Explore.cell(w, 3, 10).solid, true);
});
