// The sims' metrics (sim/metrics.js): an observer on enc.onHit that sees each landed blow's option and location, and
// changes nothing about the fight.
const test = require('node:test');
const assert = require('node:assert');
const L = require('../sim/lib');
const Metrics = require('../sim/metrics');

const hero = (name) => {
  const w = L.B.World.create(L.B.World.presetParty(), { log: false });
  const c = L.B.World.party(w).find((x) => x.name === name);
  c.policy = undefined;
  return c;
};

test('metrics: actionOf names the plan\'s actions', () => {
  assert.strictEqual(Metrics.actionOf({ motion: 'thrust' }), 'thrust');
  assert.strictEqual(Metrics.actionOf({ motion: 'twoHanded' }), 'twoHanded');
  assert.strictEqual(Metrics.actionOf({ motion: 'swing', unarmed: 'shieldBash' }), 'bash');
  assert.strictEqual(Metrics.actionOf({ motion: 'unarmed', unarmed: 'kick' }), 'kick');
  assert.strictEqual(Metrics.actionOf({ motion: 'spell', spell: {} }), 'spell');
  assert.strictEqual(Metrics.actionOf({ motion: 'thrust', natural: true }), 'natural');
});

test('metrics: watching a fight counts its blows and leaves the result as it was', async () => {
  const run = async (watch) => {
    const M = Metrics.create();
    const A = hero('Beren'), Bc = hero('Cyrus');
    const r = await L.fight({ A: [A], B: [Bc], grid: { w: 12, h: 6 }, seed: 7, maxRounds: 30, watch: watch && ((enc, chars) => M.watch(enc, chars, [A.id, Bc.id])) });
    return { r, M };
  };
  const plain = await run(false), seen = await run(true);
  assert.deepStrictEqual([seen.r.winner, seen.r.rounds, seen.r.hitsA, seen.r.hitsB], [plain.r.winner, plain.r.rounds, plain.r.hitsA, plain.r.hitsB]);
  const s = Metrics.summary(seen.M);
  assert.strictEqual(s.fights, 1);
  assert.strictEqual(s.medianRounds, seen.r.rounds);
  assert.ok(s.blows.total >= seen.r.hitsA + seen.r.hitsB, 'every logged hit is a landed blow');
  assert.ok(Object.keys(s.locs.share).length > 0);
  assert.strictEqual(s.heroesDead, seen.r.deadA + seen.r.deadB);
});
