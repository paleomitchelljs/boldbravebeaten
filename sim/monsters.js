#!/usr/bin/env node
/*
 * Monster arena: each monster (or pack) against every level-5 arena fighter
 * (four armor classes × four fighting styles), in the open field and in close quarters.
 *
 *   node sim/monsters.js [--n 30] [--only wolf,caveTroll] [--out sim/results/monsters] [--set key=value ...]
 *
 * Writes monsters.json and report.md. The question for each monster: is it strong against
 * the fighters it was designed to beat, and beatable by the others?
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const { makeCombatant, ARENAS, KEYS } = require('./arena');
const { Enemies, CONFIG } = L;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('n', 30));
const OUT = arg('out', path.join(__dirname, 'results', 'monsters'));
argv.forEach((a, i) => {
  if (a !== '--set') return;
  const [k, v] = argv[i + 1].split('=');
  const keys = k.split('.');
  let o = CONFIG;
  for (const key of keys.slice(0, -1)) o = o[key];
  o[keys[keys.length - 1]] = JSON.parse(v);
});

// What each monster is meant to beat (for the report).
const INTENT = {
  wolf: 'a lone animal: weaker than a trained fighter',
  wolfPack: 'anyone alone, especially the lightly armored',
  rustBeetle: 'plate (heavy armor)',
  displacer: 'archers',
  giantSpider: 'the unarmored',
  owlbear: 'two-handers',
  caveTroll: 'sword and shield',
  trollChieftain: 'a whole party (a boss; one-on-one it should crush anyone)',
};

// Small parties for the party test (three arena fighters).
const PARTIES = {
  mixed: { label: 'Shield, archer, heavy two-hander', keys: ['medium/shield', 'light/archery', 'heavy/twoHanded'] },
  light: { label: 'Light party: shield, archer, grappler', keys: ['light/shield', 'light/archery', 'unarmored/grappler'] },
};
const PARTY_N = Number(arg('party-n', 40));
const ONLY = arg('only', null);
const MONSTERS = ONLY ? ONLY.split(',') : Object.keys(INTENT);

const EVENTS = {
  rust: /flakes with rust|eat into .*shield/, illusion: /passes through an illusion/, venom: /poisoned/,
  venomTick: /^Venom costs/, regen: / regenerates/, getsUp: /heaves itself back up/,
  knockdown: /is knocked prone/, clinch: / clinches with | seizes /, hold: / takes hold of /, pin: / pins | into a pin/,
  shieldBroken: /BREAKS it|SHATTERS|is destroyed/, pack: /\(pack \+/,
};

(async () => {
  const t0 = Date.now();
  const out = { n: N, generated: new Date().toISOString(), monsters: {} };
  let seed = 1;
  for (const mk of MONSTERS) {
    const res = { intent: INTENT[mk], byArena: {} };
    for (const ar of Object.keys(ARENAS)) {
      const rows = {};
      for (const fk of KEYS) {
        const agg = { n: 0, monsterWins: 0, fighterWins: 0, draws: 0, rounds: 0, fighterDead: 0, monstersDown: 0, ev: {} };
        for (let i = 0; i < N; i++) {
          const fighter = makeCombatant(...fk.split('/'), 'A');
          const mons = Enemies.makeMonster(mk);
          const r = await L.fight({ A: fighter, B: mons, grid: { w: ARENAS[ar].w, h: ARENAS[ar].h }, seed: seed++, keepLog: true, maxRounds: 30 });
          agg.n++;
          if (r.winner === 'B') agg.monsterWins++;
          else if (r.winner === 'A') agg.fighterWins++;
          else agg.draws++;
          agg.rounds += r.rounds;
          agg.fighterDead += r.deadA;
          agg.monstersDown += r.downB;
          for (const l of r.log) for (const [k, re] of Object.entries(EVENTS)) if (re.test(l.text)) agg.ev[k] = (agg.ev[k] || 0) + 1;
        }
        rows[fk] = agg;
      }
      res.byArena[ar] = rows;
      process.stderr.write('.');
    }
    // Against a party of three.
    res.party = {};
    for (const [pk, P] of Object.entries(PARTIES)) {
      res.party[pk] = { label: P.label };
      for (const ar of Object.keys(ARENAS)) {
        let w = 0, dead = 0, rounds = 0;
        for (let i = 0; i < PARTY_N; i++) {
          const party = P.keys.map((k, j) => makeCombatant(...k.split('/'), 'P' + j));
          const r = await L.fight({ A: party, B: Enemies.makeMonster(mk), grid: { w: ARENAS[ar].w, h: ARENAS[ar].h }, seed: seed++, maxRounds: 30 });
          if (r.winner === 'B') w++;
          dead += r.deadA; rounds += r.rounds;
        }
        res.party[pk][ar] = { n: PARTY_N, monsterWin: w / PARTY_N, partyDeaths: dead / PARTY_N, rounds: rounds / PARTY_N };
      }
    }
    out.monsters[mk] = res;
  }
  process.stderr.write('\n');
  out.seconds = Math.round((Date.now() - t0) / 1000);
  out.partyN = PARTY_N;

  // ---- Report ----
  const pct = (x) => Math.round(100 * x) + '%';
  const group = (rows, idx) => {
    const g = {};
    for (const [k, a] of Object.entries(rows)) {
      const key = k.split('/')[idx];
      g[key] = g[key] || { n: 0, w: 0 };
      g[key].n += a.n; g[key].w += a.monsterWins;
    }
    return g;
  };
  const md = [`# Monster arena\n\nEach monster against all 16 level-5 arena fighters, ${N} fights per pairing per arena, ${out.seconds} s. Cells are the **monster's** win rate. Generated by \`node sim/monsters.js\`.\n`];
  for (const mk of MONSTERS) {
    const M = out.monsters[mk];
    md.push(`## ${Enemies.MONSTERS[mk].name}\n\nMeant to beat: ${M.intent}.\n`);
    md.push('| | Overall | Heavy | Medium | Light | Unarmored | Two-handed | Sword & shield | Grappler | Archery | Rounds |');
    md.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const ar of Object.keys(ARENAS)) {
      const rows = M.byArena[ar];
      const all = Object.values(rows);
      const n = all.reduce((t, a) => t + a.n, 0);
      const w = all.reduce((t, a) => t + a.monsterWins, 0);
      const ga = group(rows, 0), gs = group(rows, 1);
      const rounds = all.reduce((t, a) => t + a.rounds, 0) / n;
      md.push(`| ${ARENAS[ar].label} | **${pct(w / n)}** | ${['heavy', 'medium', 'light', 'unarmored'].map((k) => pct(ga[k].w / ga[k].n)).join(' | ')} | ${['twoHanded', 'shield', 'grappler', 'archery'].map((k) => pct(gs[k].w / gs[k].n)).join(' | ')} | ${rounds.toFixed(1)} |`);
    }
    const ev = {};
    let fights = 0;
    for (const ar of Object.keys(ARENAS)) for (const a of Object.values(M.byArena[ar])) { fights += a.n; for (const [k, v] of Object.entries(a.ev)) ev[k] = (ev[k] || 0) + v; }
    const evs = Object.entries(ev).filter(([, v]) => v).map(([k, v]) => `${k} ${(v / fights).toFixed(2)}`).join(', ');
    md.push(`\nPer fight: ${evs || 'no special events'}.\n`);
    md.push('Against a party of three (monster win rate, party deaths per fight):\n');
    for (const p of Object.values(M.party)) md.push(`- ${p.label}: ${Object.keys(ARENAS).map((ar) => `${ARENAS[ar].label} ${pct(p[ar].monsterWin)} (${p[ar].partyDeaths.toFixed(2)})`).join(', ')}`);
    md.push('');
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'monsters.json'), JSON.stringify(out));
  fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n') + '\n');
  console.log(md.join('\n'));
})();
