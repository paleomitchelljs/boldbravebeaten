#!/usr/bin/env node
// Print the log of one simulated fight: node sim/inspect.js <archA[:level]> <archB[:level]> [open|corridor] [seed] [countA] [countB]
'use strict';
const L = require('./lib');
const [a = 'sellsword', b = 'sellsword', ground = 'open', seed = '1', na = '1', nb = '1'] = process.argv.slice(2);
const parse = (s) => { const [arch, lvl] = s.split(':'); return { arch, level: Number(lvl || 1) }; };
const A = parse(a), B = parse(b);
const grid = ground === 'corridor' ? { w: 7, h: 1 } : { w: 8, h: 5 };
(async () => {
  const sideA = [], sideB = [];
  for (let i = 0; i < Number(na); i++) sideA.push(L.build(A.arch, { level: A.level, name: `${A.arch}${na > 1 ? ' ' + (i + 1) : ''} (A)` }));
  for (let i = 0; i < Number(nb); i++) sideB.push(L.build(B.arch, { level: B.level, name: `${B.arch}${nb > 1 ? ' ' + (i + 1) : ''} (B)` }));
  for (const c of sideA.concat(sideB)) {
    console.log(`${c.name}: stamina ${L.C.maxStamina(c)}, regen ${L.C.regen(c)}, AP ${L.C.apPool(c)}, CON ${L.C.attr(c, 'CON')}, feats ${JSON.stringify(c.feats)}`);
    console.log('   attacks: ' + L.C.attackOptions(c).map((o) => `${o.label} ${o.ap}AP/${o.stamina}st ${o.damage.join('/')} r${o.reach}`).join('; '));
  }
  const r = await L.fight({ A: sideA, B: sideB, grid, seed: Number(seed), keepLog: true });
  for (const l of r.log) console.log((l.cls === 'round' ? '\n' : '  ') + l.text);
  console.log('\nwinner', r.winner, 'rounds', r.rounds);
})();
