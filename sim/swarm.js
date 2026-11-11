#!/usr/bin/env node
/*
 * Action economy (docs/PLAN.md targets): one hero grown along its start.yaml plan to level 8 (as tools/tiers.js grows
 * them: sim/grow.js), against N level-1 foes from foes.yaml (one template a fight, all N of it), N = 1..6. The target:
 * the hero loses by about N = 4. AI on both sides; the game's open arena (11 x 7); each fight fresh, no bandages.
 *
 *   node sim/swarm.js [--n 8] [--level 8] [--max 6] [--seed 4242] [--heroes beren,cyrus] [--set path=value …] [--json file]
 *   (--n fights for each hero, template and N; --set path=value is a number or word, a dotted key into CONFIG)
 */
'use strict';
const path = require('path');
const B = require(path.join(__dirname, '..', 'tests', 'load.js'));
const { World, Battle, Auto, Rand, Enemies, CONFIG } = B;
const { heroesAt } = require('./grow');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('n', 8)), LEVEL = Number(arg('level', 8)), MAX = Number(arg('max', 6)), SEED = Number(arg('seed', 4242));
argv.forEach((a, i) => {
  if (a !== '--set') return;
  const [p, raw] = argv[i + 1].split('=');
  const keys = p.split('.');
  let o = CONFIG;
  for (const k of keys.slice(0, -1)) o = o[k];
  let v; try { v = JSON.parse(raw); } catch (e) { v = raw; }
  o[keys[keys.length - 1]] = v;
});

const pct = (x) => Math.round(100 * x) + '%';
const only = arg('heroes', null) && arg('heroes').split(',');
const heroes = heroesAt(LEVEL).filter((h) => !only || only.includes(h.id) || only.includes(h.name));
const templates = Object.keys(Enemies.TEMPLATES);

(async () => {
  console.log(`one hero of level ${LEVEL} against N level-1 foes; ${N} fights for each hero, template and N; seed ${SEED}\n`);
  console.log('hero'.padEnd(14) + Array.from({ length: MAX }, (_, i) => `N=${i + 1}`.padEnd(7)).join(''));
  const byN = Array.from({ length: MAX }, () => [0, 0]);
  const byT = {};
  const rows = [];
  for (const h of heroes) {
    const row = [];
    for (let n = 1; n <= MAX; n++) {
      let won = 0, fights = 0;
      for (const t of templates) {
        for (let i = 0; i < N; i++) {
          Rand.seed(SEED + 7919 * n + i);
          const w = World.create([h], { log: false });
          w.supplies.bandages = 0;
          Battle.start(w, { foes: [{ template: t, level: 1, n }] });
          const enc = await Auto.battle(w, { maxRounds: 30 });
          const win = enc.winner === 'party';
          won += win; fights++;
          const bt = ((byT[t] = byT[t] || Array.from({ length: MAX }, () => [0, 0]))[n - 1]);
          bt[0] += win; bt[1]++;
        }
      }
      row.push(won / fights);
      byN[n - 1][0] += won; byN[n - 1][1] += fights;
    }
    rows.push({ hero: h.name, rates: row });
    console.log(h.name.padEnd(14) + row.map((x) => pct(x).padEnd(7)).join(''));
  }
  console.log('all heroes'.padEnd(14) + byN.map(([w, f]) => pct(w / f).padEnd(7)).join(''));
  console.log('\nby template (all heroes)');
  for (const [t, r] of Object.entries(byT)) console.log(t.padEnd(14) + r.map(([w, f]) => pct(w / f).padEnd(7)).join(''));
  if (arg('json', null)) require('fs').appendFileSync(arg('json'), JSON.stringify({ sim: 'swarm', n: N, level: LEVEL, seed: SEED, rows, byN, byT }) + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
