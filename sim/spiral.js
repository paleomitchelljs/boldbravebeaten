#!/usr/bin/env node
/*
 * The death spiral (docs/PLAN.md targets): a preset hero against its twin, who starts the fight with k points of
 * damage to STR, SPD or DEX (k = 0..4). The wounded twin's win rate by k should be clearly below half and fall
 * with k. k = 0 is a mirror match (about half, a check on the sim). AI on both sides, a 12 x 6 room, as sim/duels.js.
 * Each cell is the wounded twin's wins / fights, with the share that ran out of rounds (30) in brackets when any did.
 *
 *   node sim/spiral.js [--n 40] [--seed 4242] [--max 4] [--heroes Beren,Cyrus] [--set key=value …] [--json file]
 *   (--n fights for each hero, attribute and k, the same seeds for every k; --set takes a JSON value, a dotted key into CONFIG)
 */
'use strict';
const L = require('./lib');
const { B, C, CONFIG } = L;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('n', 40)), SEED = Number(arg('seed', 4242)), KMAX = Number(arg('max', 4));
const ATTRS = ['STR', 'SPD', 'DEX'];
argv.forEach((a, i) => {
  if (a !== '--set') return;
  const [k, v] = argv[i + 1].split('=');
  const keys = k.split('.');
  let o = CONFIG;
  for (const key of keys.slice(0, -1)) o = o[key];
  o[keys[keys.length - 1]] = JSON.parse(v);
});

const names = arg('heroes', null) ? arg('heroes').split(',') : B.World.presetParty().map((p) => p.name);
const hero = (name) => {
  const w = B.World.create(B.World.presetParty(), { log: false });
  const c = B.World.party(w).find((x) => x.name === name);
  c.policy = undefined;
  return c;
};

(async () => {
  console.log(`${N} fights for each hero, attribute and k; seed ${SEED}; 12 x 6 room. The wounded twin's win rate:\n`);
  const head = 'hero'.padEnd(10) + 'attr  ' + Array.from({ length: KMAX + 1 }, (_, k) => `k=${k}`.padEnd(11)).join('') + ` (attr at k=${KMAX})`;
  console.log(head);
  const pooled = {}; // attr → k → [won, n]
  const out = [];
  for (const name of names) {
    for (const at of ATTRS) {
      const row = [], outs = [];
      let left = null;
      for (let k = 0; k <= KMAX; k++) {
        let won = 0, draws = 0;
        for (let i = 0; i < N; i++) {
          const A = hero(name), T = hero(name);
          T.damage[at] = (T.damage[at] || 0) + k;
          T.stamina = Math.min(T.stamina, C.maxStamina(T));
          left = C.attr(T, at);
          const r = await L.fight({ A: [A], B: [T], grid: { w: 12, h: 6 }, seed: SEED + i, maxRounds: 30 });
          if (r.winner === 'B') won++;
          else if (r.winner !== 'A') draws++;
        }
        row.push(won / N);
        outs.push(draws / N);
        const p = ((pooled[at] = pooled[at] || {})[k] = pooled[at][k] || [0, 0]);
        p[0] += won; p[1] += N; p[2] = (p[2] || 0) + draws;
      }
      out.push({ hero: name, attr: at, rates: row, timeouts: outs });
      console.log(name.padEnd(10) + at.padEnd(6) + row.map((x, k) => (L.pct(x) + (outs[k] ? ` (${L.pct(outs[k])})` : '')).padEnd(11)).join('') + ` (${at} ${left})`);
    }
  }
  console.log('\npooled over heroes');
  for (const at of ATTRS) console.log(''.padEnd(10) + at.padEnd(6) + Object.values(pooled[at]).map(([w, n, d]) => (L.pct(w / n) + (d ? ` (${L.pct(d / n)})` : '')).padEnd(11)).join(''));
  if (arg('json', null)) require('fs').appendFileSync(arg('json'), JSON.stringify({ sim: 'spiral', n: N, seed: SEED, rows: out, pooled }) + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
