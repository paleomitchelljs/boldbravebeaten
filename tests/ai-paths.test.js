// The AI finds its way to a foe across water (the user, 2026-11-01: skinks stared across a sewer canal at an archer
// on a bridge while a way round lay open). Two failures: a route through a foe on the bridge was refused, and a bank
// as near as the crow flies looked as good as it got.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Battle, Rand, Explore, AI, Combat, Character: C } = B;

// A skink against Lorc alone in the sewer; returns the turns the skink takes to get a blow in (Infinity: never).
function approach(skinkAt, archerAt) {
  Rand.seed(1);
  const w = World.create(World.presetParty(), { log: false });
  Explore.enter(w, 'temple_sewer', 'G');
  w.explore.x = 12; w.explore.y = 12;
  const b = Battle.start(w, { foes: [{ monster: 'suracaylSkink' }] }, { ctx: { x: 14, y: 12 } });
  const enc = b.enc, chars = Object.assign({}, w.chars, b.foes);
  const archer = World.active(w).find((c) => c.name === 'Lorc');
  const skink = Object.values(b.foes)[0];
  enc.ids = [skink.id, archer.id];
  enc.pos[archer.id] = archerAt;
  enc.pos[skink.id] = skinkAt;
  for (let t = 1; t <= 8; t++) {
    enc.round = t; enc.phase = 'turn'; enc.order = [skink.id, archer.id]; enc.turn = 0; enc.decls = []; enc.turnDone = {};
    for (const id of enc.order) { enc.ap[id] = C.apPool(chars[id]); enc.apStart[id] = enc.ap[id]; }
    const d = AI.choose(enc, chars, skink.id, () => 0.9);
    if (d.type === 'strike' || d.type === 'bait') return t;
    if (d.type !== 'move') return Infinity;
    const v = Combat.validate(enc, chars, d);
    assert.ok(!(v && v.err), `move refused: ${v && v.err}`);
    enc.pos[skink.id] = d.to;
  }
  return Infinity;
}

test('AI paths: a foe on the bridge is gone around, not walked through', () => {
  assert.ok(approach({ x: 12, y: 7 }, { x: 12, y: 10 }) <= 4);
});

test('AI paths: a foe across water is reached the long way round, not stared at from the bank', () => {
  assert.ok(approach({ x: 30, y: 10 }, { x: 35, y: 16 }) <= 6);
});
