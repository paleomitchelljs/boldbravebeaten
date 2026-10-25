// The ritual chamber: the sewer drain drops you into its pool; the pool is shallow; the dais is in the way.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Explore, Rand, Content } = B;

test('ritual chamber: the sewer drain is a one-way drop into its pool', () => {
  const pl = Content.world.places;
  assert.equal(pl.temple_sewer.legend.X.kind, 'drop');
  assert.equal(pl.temple_sewer.legend.X.to, 'temple_ritual');
  Rand.seed(4);
  const w = World.create(World.presetParty(), { log: false });
  Explore.enter(w, 'temple_ritual', 'D');
  const c = Explore.cell(w, w.explore.x, w.explore.y);
  assert.equal(c.ground.name, 'Shallow water');
  assert.equal(c.solid, false);
  const g = Explore.here(w);
  const oy = g.rows.findIndex((r) => r.includes('O')), ox = g.rows[oy].indexOf('O');
  assert.equal(Explore.cell(w, ox, oy).solid, true);
});
