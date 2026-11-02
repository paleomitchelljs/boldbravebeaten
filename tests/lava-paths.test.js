// A route across a fight never cuts through lava (the user, 2026-11-02: autopathing walked a fighter into it).
// Deadly ground is only ever where a walker means to end up; lesser hazards it can see are gone round when there is
// a way round; the squares a move costs are the squares walked.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { Combat, Terrain, World } = B;

const on = (enc, q, kind) => Terrain.at(enc, q.x, q.y).some((f) => f.kind === kind);

// A 7 x 5 floor with lava down column 3 except at the bottom row (the way round).
function field(kind) {
  const w = World.create(World.presetParty(), { log: false });
  const c = World.active(w)[0];
  c.side = 'party';
  const enc = Combat.createEncounter('t', [c.id], { [c.id]: c }, 7, 5);
  enc.pos[c.id] = { x: 1, y: 1 };
  for (let y = 0; y < 4; y++) Terrain.add(enc, 3, y, kind);
  return { enc, c };
}

test('lava paths: a route goes round lava, never through it', () => {
  const { enc, c } = field('lava');
  const steps = Terrain.path(enc, { x: 1, y: 1 }, { x: 5, y: 1 }, c);
  assert.deepEqual(steps[steps.length - 1], { x: 5, y: 1 }, 'gets there');
  assert.ok(!steps.some((q) => on(enc, q, 'lava')), 'not a step in the lava: ' + JSON.stringify(steps));
  const pc = Terrain.pathCost(enc, { x: 1, y: 1 }, { x: 5, y: 1 }, c);
  assert.equal(Math.round(pc.cost), steps.length, 'the cost is the squares walked, not the detour weighting');
});

test('lava paths: with no way round, the route stops short rather than wade in', () => {
  const { enc, c } = field('lava');
  Terrain.add(enc, 3, 4, 'lava');
  const steps = Terrain.path(enc, { x: 1, y: 1 }, { x: 5, y: 1 }, c);
  assert.ok(!steps.some((q) => on(enc, q, 'lava')), JSON.stringify(steps));
  const end = steps[steps.length - 1];
  assert.ok(end.x < 3, 'ends on the near side');
});

test('lava paths: stepping into lava on purpose still works', () => {
  const { enc, c } = field('lava');
  const steps = Terrain.path(enc, { x: 1, y: 1 }, { x: 3, y: 1 }, c);
  assert.deepEqual(steps, [{ x: 2, y: 1 }, { x: 3, y: 1 }]);
});

test('lava paths: a lesser hazard is gone round when it can be, crossed when it cannot', () => {
  const { enc, c } = field('hot');
  let steps = Terrain.path(enc, { x: 1, y: 1 }, { x: 5, y: 1 }, c);
  assert.ok(!steps.some((q) => on(enc, q, 'hot')), 'round: ' + JSON.stringify(steps));
  Terrain.add(enc, 3, 4, 'hot');
  steps = Terrain.path(enc, { x: 1, y: 1 }, { x: 5, y: 1 }, c);
  assert.deepEqual(steps[steps.length - 1], { x: 5, y: 1 }, 'through when there is no other way');
});
