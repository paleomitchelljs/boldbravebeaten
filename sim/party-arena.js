#!/usr/bin/env node
/*
 * Party arena: parties of cooperating level-5 adventurers against single creatures and small
 * groups, in the open field and in a cramped room.
 *
 *   node sim/party-arena.js [--n 40] [--only wolfPack,skeletonSquad] [--out sim/results/monsters]
 *
 * Writes party.json (read by sim/monsters-page.js) and party.md.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const { makeCombatant } = require('./arena');
const { Enemies, C } = L;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('n', 40));
const OUT = arg('out', path.join(__dirname, 'results', 'monsters'));

const ARENAS = {
  open: { label: 'Open field', w: 20, h: 12 },
  room: { label: 'Cramped room', w: 8, h: 4 },
};
const PARTIES = {
  veterans: { label: 'Veterans (4): knight with shield, mail two-hander, archer, grappler', keys: ['heavy/shield', 'medium/twoHanded', 'light/archery', 'light/grappler'] },
  light: { label: 'Light party (3): shield, archer, grappler', keys: ['light/shield', 'light/archery', 'unarmored/grappler'] },
  mage: { label: 'With a mage (4): knight with shield, mail two-hander, archer, mage', keys: ['heavy/shield', 'medium/twoHanded', 'light/archery', 'unarmored/magic'] },
};
const ROLE = (k) => ({ 'unarmored/magic': 'mage', 'heavy/shield': 'knight', 'medium/twoHanded': 'two-hander', 'light/archery': 'archer', 'light/grappler': 'grappler', 'light/shield': 'shield', 'unarmored/grappler': 'grappler' }[k] || k);
const ENCOUNTERS = arg('only', null) ? arg('only', '').split(',') : [
  'wolf', 'wolfPack', 'koboldBand', 'goblinBand', 'bogPatrol', 'scaleward', 'scalewardPair',
  'skeleton', 'skeletonSquad', 'zombie', 'zombieHorde', 'stoneGolem',
  'giantSpider', 'rustBeetle', 'mirageCat', 'mirageCatPair', 'beakbear', 'caveTroll', 'trollChieftain',
  'rat', 'ratPack', 'drake', 'wyvern', 'constrictor', 'ogre', 'hillGiant', 'spectre',
];

(async () => {
  const t0 = Date.now();
  const out = { n: N, arenas: ARENAS, parties: {}, encounters: {} };
  for (const [pk, P] of Object.entries(PARTIES)) out.parties[pk] = { label: P.label, roles: P.keys.map(ROLE) };
  let seed = 11;
  for (const ek of ENCOUNTERS) {
    const E = Enemies.MONSTERS[ek];
    const enc = { name: E.name, blurb: E.blurb, size: Enemies.makeMonster(ek).length, results: {} };
    for (const [pk, P] of Object.entries(PARTIES)) {
      enc.results[pk] = {};
      for (const [ak, A] of Object.entries(ARENAS)) {
        const agg = { n: 0, partyWins: 0, rounds: 0, partyDead: 0, partyDown: 0, foesDead: 0, roleDead: {} };
        for (let i = 0; i < N; i++) {
          const party = P.keys.map((k, j) => { const c = makeCombatant(...k.split('/'), 'P' + j); c.role = ROLE(k); return c; });
          const foes = Enemies.makeMonster(ek);
          const r = await L.fight({ A: party, B: foes, grid: { w: A.w, h: A.h }, seed: seed++, maxRounds: 30 });
          agg.n++;
          if (r.winner === 'A') agg.partyWins++;
          agg.rounds += r.rounds;
          agg.partyDead += r.deadA;
          agg.partyDown += r.downA;
          agg.foesDead += r.downB;
          for (const c of party) if (c.status.dead) agg.roleDead[c.role] = (agg.roleDead[c.role] || 0) + 1;
        }
        enc.results[pk][ak] = {
          partyWin: agg.partyWins / agg.n, rounds: agg.rounds / agg.n, partyDeaths: agg.partyDead / agg.n,
          partyDown: agg.partyDown / agg.n, roleDeaths: Object.fromEntries(Object.entries(agg.roleDead).map(([k, v]) => [k, v / agg.n])),
        };
      }
    }
    out.encounters[ek] = enc;
    process.stderr.write('.');
  }
  process.stderr.write('\n');
  out.seconds = Math.round((Date.now() - t0) / 1000);
  const pct = (x) => Math.round(100 * x) + '%';
  const md = [`# Party arena\n\n${N} fights per party per arena per encounter, ${out.seconds} s. Cells: party win rate (party deaths per fight).\n`,
    '| Encounter | ' + Object.values(PARTIES).map((p) => Object.values(ARENAS).map((a) => `${p.label.split(':')[0]}, ${a.label.toLowerCase()}`).join(' | ')).join(' | ') + ' |',
    '|---|' + Object.keys(PARTIES).map(() => Object.keys(ARENAS).map(() => '---|').join('')).join('')];
  for (const [ek, e] of Object.entries(out.encounters)) {
    md.push(`| ${e.name} | ` + Object.keys(PARTIES).map((pk) => Object.keys(ARENAS).map((ak) => { const r = e.results[pk][ak]; return `${pct(r.partyWin)} (${r.partyDeaths.toFixed(2)})`; }).join(' | ')).join(' | ') + ' |');
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'party.json'), JSON.stringify(out));
  fs.writeFileSync(path.join(OUT, 'party.md'), md.join('\n') + '\n');
  console.log(md.join('\n'));
})();
