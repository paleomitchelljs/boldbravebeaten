#!/usr/bin/env node
// Two of sim/arena.js's fighting styles against each other over every pair of armors, in the open field and in close
// quarters, at the arena's level: the row's win rate, averaged over the armor pairs as arena.js's report does. Faster
// than the whole arena when one matchup is the question (docs/PLAN.md step 5: two-handed against sword & shield).
//   node sim/styles.js [twoHanded] [shield] [--n 10] [--metrics] [--set key=value ...]
'use strict';
const L = require('./lib');
const { CONFIG } = L;
const { makeCombatant, ARENAS } = require('./arena');
const Metrics = require('./metrics');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('n', 10));
const METRICS = argv.includes('--metrics');
argv.forEach((a, i) => {
  if (a !== '--set') return;
  const [k, v] = argv[i + 1].split('=');
  const keys = k.split('.');
  let o = CONFIG;
  for (const key of keys.slice(0, -1)) o = o[key];
  o[keys[keys.length - 1]] = JSON.parse(v);
});
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && argv[i - 1] !== '--metrics'));
const [SA, SB] = [pos[0] || 'twoHanded', pos[1] || 'shield'];
const ARMORS = ['heavy', 'medium', 'light', 'unarmored'];

(async () => {
  console.log(`${SA} against ${SB}, ${N} fights for each armor pair and arena`);
  for (const [ak, arena] of Object.entries(ARENAS)) {
    const M = METRICS ? Metrics.create() : null;
    let wins = 0, losses = 0, n = 0, timeouts = 0;
    const rows = [];
    for (let i = 0; i < ARMORS.length; i++) for (let j = 0; j < ARMORS.length; j++) {
      let w = 0;
      for (let f = 0; f < N; f++) {
        const a = makeCombatant(ARMORS[i], SA, 'A'), b = makeCombatant(ARMORS[j], SB, 'B');
        const seed = 7000 + f + 97 * i + 13 * j;
        const r = await L.fight({ A: a, B: b, grid: { w: arena.w, h: arena.h }, seed, maxRounds: 30, watch: M && ((enc, chars) => M.watch(enc, chars, [])) });
        n++;
        if (r.winner === 'A') { wins++; w++; } else if (r.winner === 'B') losses++; else timeouts++;
      }
      rows.push(`${ARMORS[i]}/${ARMORS[j]} ${Math.round((100 * w) / N)}`);
    }
    console.log(`${arena.label}: ${SA} wins ${Math.round((100 * wins) / n)}%, loses ${Math.round((100 * losses) / n)}%, no result ${Math.round((100 * timeouts) / n)}% (${n} fights)`);
    console.log('  by armor (row/column, row wins %): ' + rows.join(', '));
    if (M) for (const l of Metrics.report(M)) console.log(l);
  }
})().catch((e) => { console.error(e); process.exit(1); });
