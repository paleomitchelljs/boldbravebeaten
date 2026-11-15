// The tempo measures of sim/metrics.js (docs/OVERHAUL.md step D): the observer changes no fight, the clock adapter
// books every AP it sees, and the counts are consistent.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../sim/lib');
const Metrics = require('../sim/metrics');

const hero = (name) => {
  const w = L.B.World.create(L.B.World.presetParty(), { log: false });
  const c = L.B.World.party(w).find((x) => x.name === name);
  c.policy = undefined;
  return c;
};
const PAIRS = [
  [() => [hero('Beren')], () => [hero('Cyrus')]],
  [() => [hero('Lorc')], () => [hero('Beren')]], // a bow's draw: wind-ups
  [() => [L.build('heavy', { level: 3, name: 'h1' }), hero('Jabiku')], () => [L.build('brute', { level: 3, name: 'b1' }), L.Enemies.makeMonster('goblinWarrior', {})[0]]],
];

test('tempo: a watched fight ends exactly as an unwatched one (the whole log)', async () => {
  const M = Metrics.create();
  for (const [a, b] of PAIRS) for (const seed of [3, 4]) {
    const run = async (watch) => {
      const A = a(), Bs = b();
      const r = await L.fight({ A, B: Bs, grid: { w: 12, h: 6 }, seed, maxRounds: 30, keepLog: true, watch: watch && ((enc, chars) => M.watch(enc, chars, A.map((c) => c.id))) });
      return { winner: r.winner, rounds: r.rounds, log: r.log.map((l) => l.text) };
    };
    assert.deepEqual(await run(true), await run(false), `seed ${seed}`);
  }
  assert.equal(M.fights, PAIRS.length * 2);
});

test('tempo: the AP clock books all the time it sees, and the counts hold together', async () => {
  const M = Metrics.create();
  let decided = 0;
  for (const [a, b] of PAIRS) for (let seed = 10; seed < 16; seed++) {
    const A = a(), Bs = b();
    const r = await L.fight({ A, B: Bs, grid: { w: 12, h: 6 }, seed, maxRounds: 30, watch: (enc, chars) => M.watch(enc, chars, A.map((c) => c.id)) });
    if (r.winner === 'A' || r.winner === 'B') decided++;
  }
  const T = M.tempo;
  for (const k of ['all', 'heroes', 'foes']) {
    const t = T.time[k];
    assert.ok(Math.abs(t.own + t.react + t.unused + t.cut - t.avail) < 1e-6, `${k}: own + reactions + unused + cut = available`);
    assert.ok(t.own >= 0 && t.react >= 0 && t.unused >= 0);
  }
  assert.ok(T.time.all.avail > 0 && T.time.all.react > 0, 'some reactions');
  const s = Metrics.summary(M).tempo;
  assert.equal(s.unit, 'AP');
  assert.ok(s.firstLanded.n <= decided && s.firstLanded.n > 0);
  assert.ok(s.firstTried.n <= decided && s.firstTried.n >= s.firstLanded.n - 1);
  assert.ok(s.waiting.all.n > 0 && s.waiting.all.p >= 0 && s.waiting.all.p <= 1);
  assert.equal(s.waiting.all.n, s.waiting.heroes.n + s.waiting.foes.n);
  assert.ok(s.heavy.n > 0 && s.heavy.p > 0, 'the greatsword and the warhammer land heavy blows');
  assert.ok(T.windUps.started > 0 && T.windUps.spoiled + T.windUps.released <= T.windUps.started + T.windUps.cantStart, 'wind-ups: spoiled and released come from those started');
  assert.ok(s.byRolled.length > 0 && s.byRolled.every((x) => x.n > 0), 'win rate by AP rolled (baseline only)');
  const lines = Metrics.report(M).join('\n');
  assert.match(lines, /first blow landed/);
  assert.match(lines, /\[baseline only\]/);
});

test('tempo: isHeavy names the actions with a lead', () => {
  assert.equal(Metrics.isHeavy({ motion: 'twoHanded' }), true);
  assert.equal(Metrics.isHeavy({ motion: 'power' }), true);
  assert.equal(Metrics.isHeavy({ motion: 'shoot', windUp: true }), true);
  assert.equal(Metrics.isHeavy({ motion: 'thrust' }), false);
  assert.equal(Metrics.isHeavy(null), false);
});
