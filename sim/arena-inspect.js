#!/usr/bin/env node
// Print one arena fight: node sim/arena-inspect.js heavy/twoHanded light/archery close 3
'use strict';
const L = require('./lib');
const { makeCombatant, ARENAS } = require('./arena');
const [ka = 'heavy/twoHanded', kb = 'light/archery', arena = 'open', seed = '1'] = process.argv.slice(2);
(async () => {
  const a = makeCombatant(...ka.split('/'), 'A');
  const b = makeCombatant(...kb.split('/'), 'B');
  for (const c of [a, b]) {
    console.log(`${c.name}: stamina ${L.C.maxStamina(c)}, regen ${L.C.regen(c)}, quickest blow ${Math.min(...L.C.attackOptions(c).map((o) => o.ticks))} ticks, CON ${L.C.attr(c, 'CON')}, SP ${L.B.Magic.maxSP(c)}, feats ${Object.keys(c.feats).join(', ')}`);
    console.log('   ' + L.C.attackOptions(c).filter((o) => !o.unarmed).map((o) => `${o.label} ${o.ticks}t/${o.stamina}st r${o.minRange}-${o.maxRange}${o.windUp ? ' WU' : ''}`).join('; '));
  }
  const A = ARENAS[arena];
  const r = await L.fight({ A: a, B: b, grid: { w: A.w, h: A.h }, seed: Number(seed), keepLog: true });
  for (const l of r.log) console.log((l.cls === 'round' ? '\n' : '  ') + l.text);
  console.log('\nwinner', r.winner, 'rounds', r.beats);
})();
