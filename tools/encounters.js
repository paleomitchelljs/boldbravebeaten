#!/usr/bin/env node
// Runs every authored encounter against the example party (AI on both sides) and prints how it goes.
// Use it after editing a map or a monster: a first-dungeon fight should be dangerous, not hopeless.
//   node tools/encounters.js [--n 30] [--level 1]
'use strict';
const B = require('../tests/load.js');
const { World, Battle, Auto, Rand, Character: C, Content } = B;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const N = arg('n', 30), LEVEL = arg('level', 1);

(async () => {
  console.log(`Example party at level ${LEVEL}, ${N} fights each (fresh and at full strength)\n`);
  console.log('encounter'.padEnd(34) + 'won   lost  rounds  dead/fight');
  for (const [pid, p] of Object.entries(Content.world.places)) {
    for (const [eid, e] of Object.entries(p.encounters || {})) {
      let won = 0, lost = 0, rounds = 0, dead = 0;
      Rand.seed(777);
      for (let i = 0; i < N; i++) {
        const w = World.create(World.presetParty(), { log: false });
        if (LEVEL > 1) World.grantXP(w, World.xpFor(LEVEL));
        Battle.start(w, e);
        const enc = await Auto.battle(w, { maxRounds: 40 });
        rounds += enc.round;
        if (enc.winner === 'party') won++; else if (enc.winner === 'enemy') lost++;
        dead += World.party(w).filter((c) => c.status.dead).length;
      }
      const pct = (x) => (Math.round(100 * x / N) + '%').padEnd(6);
      console.log(`${pid}/${eid}`.padEnd(34) + pct(won) + pct(lost) + (rounds / N).toFixed(1).padEnd(8) + (dead / N).toFixed(2));
    }
  }
})();
