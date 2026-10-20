#!/usr/bin/env node
/*
 * The revenant knight as a recurring foe: what level, feats and items does he need to beat parties
 * of each level consistently?
 *
 *   node sim/dk-scaling.js [--dk 5,10,15,20] [--n 25] [--out sim/results/dk-scaling]
 *   node sim/dk-scaling.js --merge          (combine the parts into dk-scaling.json)
 *
 * Factors:
 *   DK level   5, 10, 15, 20 (feats only: his attributes are those of the full revenant knight)
 *   build      martial (plate, shield, parry, strength) or caster (the full build: Battle
 *              Casting, a withering burst, raising the dead)
 *   gear tier  0 basic (standard plate, steel heater, a plain longsword)
 *              1 + Soulreaver (a legendary blade that drinks)
 *              2 + legendary plate and an adamant shield
 *              3 + the silk sash and the aura of dread (the full revenant knight)
 *   party      the core trio (knight, two-hander, archer) plus a mage, cleric, duelist or grappler,
 *              at level 2 (standard gear), 6 (fine) or 15 (masterwork, magical weapons)
 * Each cell is n fights in the black chapel, the knight alone. "Consistent" = he wins at least
 * 80% against every one of the four lineups.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const { makeCombatant } = require('./arena');
const { C, Enemies, Items } = L;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('n', 25));
const OUT = arg('out', path.join(__dirname, 'results', 'dk-scaling'));
const DK_LEVELS = arg('dk', '5,10,15,20').split(',').map(Number);
const CONSISTENT = 0.8;

const BUILDS = {
  martial: {
    label: 'Martial',
    prefs: ['strength', 'toughness', 'plate_mobility', 'shield_training', 'parry_training', 'plate_mobility', 'plate_endurance', 'shield_training', 'quick_block',
      'half_swording', 'parry_training', 'iron_stance', 'plate_endurance', 'riposte', 'living_fortress', 'economical_block', 'quick_parry', 'strength', 'toughness',
      'parry_training', 'shield_training', 'quick_thrust', 'precision'],
  },
  caster: { label: 'Caster', prefs: null }, // the revenant knight's own preference list
};
const GEAR = [
  { label: 'Basic' },
  { label: '+ Soulreaver' },
  { label: '+ legendary plate, adamant shield' },
  { label: '+ sash and aura' },
];
const PARTY_LEVELS = {
  2: { label: 'Early (L2)', quality: 'standard' },
  6: { label: 'Mid (L6)', quality: 'fine' },
  15: { label: 'High (L15)', quality: 'masterwork', magical: true },
};
const CORE = ['heavy/shield', 'medium/twoHanded', 'light/archery'];
const LINEUPS = {
  mage: { label: '+ Mage', keys: CORE.concat('unarmored/magic') },
  cleric: { label: '+ Cleric', keys: CORE.concat('medium/cleric') },
  duelist: { label: '+ Duelist', keys: CORE.concat('light/duelist') },
  grappler: { label: '+ Grappler', keys: CORE.concat('light/grappler') },
};

function makeDK(level, build, tier) {
  const [d] = Enemies.makeMonster('revenantKnight', { level });
  if (BUILDS[build].prefs) {
    d.feats = {};
    Enemies.chooseFeats(d, BUILDS[build].prefs, Enemies.makeRng(level * 7919 + 3));
  }
  const blade = d.weapons.find((w) => w.enchant || (w.enchantments || []).length);
  if (tier < 1) {
    // A plain longsword in place of Soulreaver.
    const plain = Items.makeWeapon('longsword', 'average');
    d.weapons = d.weapons.map((w) => (w === blade ? plain : w));
    d.wield = plain.id;
  }
  if (tier < 2) {
    d.armor = Items.makeArmor('plate', 'full', 'average');
    d.shield = Items.makeShield('heater', 'steel', 'average');
  }
  if (tier < 3) {
    d.trinkets = [];
    delete d.traits.aura;
  }
  d.stamina = C.maxStamina(d);
  return d;
}

async function runPart() {
  const rows = [];
  let seed = 1;
  for (const dl of DK_LEVELS) for (const b of Object.keys(BUILDS)) for (let t = 0; t < GEAR.length; t++) {
    for (const [pl, P] of Object.entries(PARTY_LEVELS)) for (const [lk, Lu] of Object.entries(LINEUPS)) {
      let wins = 0, rounds = 0, partyDead = 0, dkDead = 0;
      for (let i = 0; i < N; i++) {
        const party = Lu.keys.map((k, j) => makeCombatant(...k.split('/'), 'P' + j, { level: Number(pl), quality: P.quality, magical: P.magical }));
        const dk = makeDK(dl, b, t);
        const r = await L.fight({ A: party, B: [dk], grid: { w: 14, h: 6 }, seed: 104729 * i + 7 * seed, maxRounds: 30 });
        if (r.winner === 'B') wins++;
        rounds += r.rounds; partyDead += r.deadA; dkDead += r.deadB;
      }
      rows.push({ dk: dl, build: b, tier: t, party: Number(pl), lineup: lk, n: N, dkWin: wins / N, rounds: rounds / N, partyDeaths: partyDead / N, dkDeath: dkDead / N });
      seed++;
    }
    process.stderr.write(`DK L${dl} ${b} tier ${t} done\n`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `part-${DK_LEVELS.join('-')}.json`), JSON.stringify(rows));
}

function merge() {
  const rows = [];
  for (const f of fs.readdirSync(OUT).filter((x) => /^part-.*\.json$/.test(x))) rows.push(...JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')));
  const dkLevels = [...new Set(rows.map((r) => r.dk))].sort((a, b) => a - b);
  // Cheapest consistent loadout per DK level × party level: fewest gear tiers first, then the
  // martial build before the caster (no magic needed).
  const cheapest = {};
  for (const dl of dkLevels) for (const pl of Object.keys(PARTY_LEVELS).map(Number)) {
    let found = null;
    for (let t = 0; t < GEAR.length && !found; t++) for (const b of Object.keys(BUILDS)) {
      const cell = rows.filter((r) => r.dk === dl && r.party === pl && r.build === b && r.tier === t);
      if (cell.length && cell.every((r) => r.dkWin >= CONSISTENT)) { found = { build: b, tier: t, worst: Math.min(...cell.map((r) => r.dkWin)) }; break; }
    }
    cheapest[dl + '|' + pl] = found;
  }
  const out = { generated: new Date().toISOString(), n: rows[0] ? rows[0].n : N, consistent: CONSISTENT, dkLevels, builds: BUILDS, gear: GEAR, partyLevels: PARTY_LEVELS, lineups: Object.fromEntries(Object.entries(LINEUPS).map(([k, v]) => [k, v.label])), rows, cheapest };
  fs.writeFileSync(path.join(OUT, 'dk-scaling.json'), JSON.stringify(out));
  const pct = (x) => Math.round(100 * x) + '%';
  const md = [`# Revenant knight scaling\n\n${out.n} fights per cell. "Consistent": wins ≥ ${pct(CONSISTENT)} against every lineup.\n`,
    '## Cheapest consistent loadout\n', '| DK level | ' + Object.values(PARTY_LEVELS).map((p) => p.label).join(' | ') + ' |', '|---|' + Object.keys(PARTY_LEVELS).map(() => '---|').join('')];
  for (const dl of dkLevels) md.push(`| ${dl} | ` + Object.keys(PARTY_LEVELS).map((pl) => { const c = cheapest[dl + '|' + pl]; return c ? `${BUILDS[c.build].label}, ${GEAR[c.tier].label} (worst ${pct(c.worst)})` : 'none'; }).join(' | ') + ' |');
  md.push('\n## Win rate, averaged over the four lineups (worst lineup in brackets)\n');
  for (const pl of Object.keys(PARTY_LEVELS).map(Number)) {
    md.push(`### Against ${PARTY_LEVELS[pl].label} parties\n`, '| DK level | Build | ' + GEAR.map((g) => g.label).join(' | ') + ' |', '|---|---|' + GEAR.map(() => '---|').join(''));
    for (const dl of dkLevels) for (const b of Object.keys(BUILDS)) {
      md.push(`| ${dl} | ${BUILDS[b].label} | ` + GEAR.map((_, t) => {
        const cell = rows.filter((r) => r.dk === dl && r.party === pl && r.build === b && r.tier === t);
        if (!cell.length) return '—';
        return `${pct(cell.reduce((s, r) => s + r.dkWin, 0) / cell.length)} (${pct(Math.min(...cell.map((r) => r.dkWin)))})`;
      }).join(' | ') + ' |');
    }
    md.push('');
  }
  fs.writeFileSync(path.join(OUT, 'dk-scaling.md'), md.join('\n') + '\n');
  console.log(md.join('\n'));
}

if (argv.includes('--merge')) merge();
else runPart();
