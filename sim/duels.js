#!/usr/bin/env node
// One-on-one fights: each preset hero against the others and against a few common foes, AI on both sides, in a
// 12 x 6 room. How long they last (rounds), how they end (a death or a knockout), and how much of a fresh fighter's
// stamina one landed blow takes. For the user's 2026-11-01 note: duels run slow, stamina and damage are spongy.
//   node sim/duels.js [--n 40] [--set key=value ...]   (--set takes a JSON value, a dotted key into CONFIG)
'use strict';
const L = require('./lib');
const { B, C, CONFIG, Enemies } = L;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('n', 40));
argv.forEach((a, i) => {
  if (a !== '--set') return;
  const [k, v] = argv[i + 1].split('=');
  const keys = k.split('.');
  let o = CONFIG;
  for (const key of keys.slice(0, -1)) o = o[key];
  o[keys[keys.length - 1]] = JSON.parse(v);
});

const hero = (name) => () => {
  const w = B.World.create(B.World.presetParty(), { log: false });
  const c = B.World.party(w).find((x) => x.name === name);
  c.policy = undefined;
  return c;
};
const monster = (id) => () => Enemies.makeMonster(id, {})[0];

const PAIRS = [
  ['Beren', 'Cyrus'], ['Beren', 'Jabiku'], ['Cyrus', 'Jabiku'],
  ['Beren', 'scaleward'], ['Cyrus', 'scaleward'], ['Jabiku', 'scaleward'],
  ['Beren', 'fireGoblin'], ['Cyrus', 'fireGoblin'], ['Cyrus', 'goblinWarrior'], ['Beren', 'wolf'],
];
const make = (k) => (/^[A-Z]/.test(k) ? hero(k) : monster(k));

(async () => {
  console.log(`${N} fights each, 12 x 6 room\n`);
  console.log('A vs B'.padEnd(26) + 'A wins  B wins  rounds (median, 90th)  deaths  blow / fresh stamina (A, B)');
  const all = [];
  for (const [a, b] of PAIRS) {
    const res = [];
    const blows = { A: [], B: [] };
    for (let i = 0; i < N; i++) {
      const A = make(a)(i), Bc = make(b)(i);
      const fresh = { [A.id]: C.maxStamina(A) || 1, [Bc.id]: C.maxStamina(Bc) || 1 };
      const r = await L.fight({
        A: [A], B: [Bc], grid: { w: 12, h: 6 }, seed: 500 + i, maxRounds: 30,
        onHit: (ev) => { const t = ev && ev.target && (ev.target.id || ev.target); if (t && ev.stamina != null && !ev.spell) (t === Bc.id ? blows.A : blows.B).push(ev.stamina / fresh[t]); },
      });
      res.push(r);
    }
    const s = L.summarize(res);
    all.push(...res);
    const m = (xs) => (xs.length ? (xs.reduce((t, x) => t + x, 0) / xs.length).toFixed(2) : '–');
    console.log(`${a} vs ${b}`.padEnd(26) + L.pct(s.winA).padEnd(8) + L.pct(s.winB).padEnd(8) + `${s.medianRounds}, ${s.p90Rounds}`.padEnd(22) + s.deathRate.toFixed(2).padEnd(8) + `${m(blows.A)}, ${m(blows.B)}`);
  }
  const s = L.summarize(all);
  console.log(`\nall: median ${s.medianRounds} rounds, mean ${s.meanRounds.toFixed(1)}, 90th ${s.p90Rounds}; deaths ${s.deathRate.toFixed(2)} a fight; timeouts ${L.pct(s.timeout)}`);
})();
