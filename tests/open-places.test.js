// Outdoors and its edges (the user, 2026-11-02): an open place hides nothing; a way out on the map's edge has its road
// running on past the edge, which a click can aim at.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Explore } = B;

test('open places: the whole map is seen on arrival; a dungeon still starts dark', () => {
  const w = World.create(World.presetParty(), { log: false });
  Explore.enter(w, 'tarn_plains_west', 'Q');
  const g = Explore.here(w), ms = World.mapState(w, w.place);
  assert.equal(Object.keys(ms.seen).length, g.w * g.h);
  Explore.enter(w, 'ember_hall', 'L');
  const h = Explore.here(w);
  assert.ok(Object.keys(World.mapState(w, w.place).seen).length < h.w * h.h / 2);
});

test('edge exits: found on the edge, with the way they lead off; the road runs three squares past', () => {
  const ex = Explore.exits('tarn_plains_west');
  const east = ex.filter((e) => e.dx === 1).map((e) => e.y).sort((a, b) => a - b);
  const west = ex.filter((e) => e.dx === -1).map((e) => e.y).sort((a, b) => a - b);
  assert.deepEqual(east, [12, 13]);
  assert.deepEqual(west, [13, 14]);
  const e = Explore.beyond('tarn_plains_west', 38, 12);
  assert.ok(e && e.x === 35 && e.y === 12);
  assert.equal(Explore.beyond('tarn_plains_west', 39, 12), null, 'only three squares out');
  assert.equal(Explore.beyond('tarn_plains_west', 37, 10), null, 'only in line with the exit');
  assert.ok(Explore.beyond('tarn_plains_west', -2, 14));
});
