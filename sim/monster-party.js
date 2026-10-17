#!/usr/bin/env node
// Monsters against a small party: node sim/monster-party.js [--n 60]
'use strict';
const L = require('./lib');
const { makeCombatant, ARENAS } = require('./arena');
const argv = process.argv.slice(2);
const N = Number(argv[argv.indexOf('--n') + 1] || 60);
const PARTIES = {
  'Shield, archer, heavy two-hander': ['medium/shield', 'light/archery', 'heavy/twoHanded'],
  'Light party: shield, archer, grappler': ['light/shield', 'light/archery', 'unarmored/grappler'],
};
const MONS = (argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : 'wolfPack,caveTroll,owlbear,rustBeetle').split(',');
(async () => {
  let seed = 7;
  for (const mk of MONS) {
    for (const [pname, keys] of Object.entries(PARTIES)) {
      const line = [];
      for (const ar of Object.keys(ARENAS)) {
        let mw = 0, deadParty = 0, rounds = 0;
        for (let i = 0; i < N; i++) {
          const party = keys.map((k, j) => makeCombatant(...k.split('/'), 'P' + j));
          const r = await L.fight({ A: party, B: L.Enemies.makeMonster(mk), grid: { w: ARENAS[ar].w, h: ARENAS[ar].h }, seed: seed++ });
          if (r.winner === 'B') mw++;
          deadParty += r.deadA; rounds += r.rounds;
        }
        line.push(`${ARENAS[ar].label}: monster wins ${Math.round(100 * mw / N)}%, party deaths ${(deadParty / N).toFixed(2)}/fight, ${(rounds / N).toFixed(1)} rounds`);
      }
      console.log(`${L.Enemies.MONSTERS[mk].name} vs ${pname}\n  ${line.join('\n  ')}`);
    }
  }
})();
