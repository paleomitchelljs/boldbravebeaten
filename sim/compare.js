#!/usr/bin/env node
/*
 * Compare rule variants side by side.
 *   node sim/compare.js [--n 60] [--only builds,weapons,...]
 * Edit VARIANTS below; each is a list of --set overrides for sim/run.js.
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = arg('n', '60');
const ONLY = arg('only', 'length,gap,twoOnOne,builds,weapons,armor,party,kick');
const FILE = arg('variants', path.join(__dirname, 'variants.json'));
const VARIANTS = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const KEYS = [
  ['graded pass', null],
  ['duelist avg (builds open)', (r) => r.scenario === 'builds' && r.condition === 'duelist L4 open'],
  ['knight avg (builds open)', (r) => r.scenario === 'builds' && r.condition === 'knight L4 open'],
  ['heavy avg (builds open)', (r) => r.scenario === 'builds' && r.condition === 'heavy L4 open'],
  ['sellsword avg (builds open)', (r) => r.scenario === 'builds' && r.condition === 'sellsword L4 open'],
  ['brute avg (builds open)', (r) => r.scenario === 'builds' && r.condition === 'brute L4 open'],
  ['militia avg (builds open)', (r) => r.scenario === 'builds' && r.condition === 'militia L4 open'],
  ['dagger avg (weapons)', (r) => r.scenario === 'weapons' && r.condition === 'dagger (mail, no shield)'],
  ['rapier avg (weapons)', (r) => r.scenario === 'weapons' && r.condition === 'rapier (mail, no shield)'],
  ['longsword avg (weapons)', (r) => r.scenario === 'weapons' && r.condition === 'longsword (mail, no shield)'],
  ['warhammer avg (weapons)', (r) => r.scenario === 'weapons' && r.condition === 'warhammer (mail, no shield)'],
  ['club avg (weapons)', (r) => r.scenario === 'weapons' && r.condition === 'club (mail, no shield)'],
  ['plate trained avg', (r) => r.scenario === 'armor' && r.condition === 'plate (trained)'],
  ['mail trained avg', (r) => r.scenario === 'armor' && r.condition === 'mail (trained)'],
  ['padded trained avg', (r) => r.scenario === 'armor' && r.condition === 'padded (trained)'],
  ['none trained avg', (r) => r.scenario === 'armor' && r.condition === 'none (trained)'],
  ['buckler avg', (r) => r.scenario === 'shields' && r.condition === 'buckler'],
  ['tower avg', (r) => r.scenario === 'shields' && r.condition === 'tower'],
  ['no shield avg', (r) => r.scenario === 'shields' && r.condition === 'none'],
  ['heavy L1 vs duelist L6 corridor', (r) => r.scenario === 'gap' && r.condition === 'heavy L1 vs duelist L6 corridor'],
  ['knight L1 vs duelist L6 corridor', (r) => r.scenario === 'gap' && r.condition === 'knight L1 vs duelist L6 corridor'],
  ['3 starters vs L6 tower knight', (r) => r.scenario === 'party' && r.condition === '3 starters'],
  ['2 sellswords vs knight L4', (r) => r.scenario === 'twoOnOne' && r.condition === '2 sellswords vs knight L4' && r.metric === 'pair_win'],
  ['knight L4 mirror median rds', (r) => r.scenario === 'length' && r.condition === 'knight L4 open' && r.metric === 'median_rounds'],
  ['sellsword L4 mirror median rds', (r) => r.scenario === 'length' && r.condition === 'sellsword L4 open' && r.metric === 'median_rounds'],
  ['duelist L4 mirror median rds', (r) => r.scenario === 'length' && r.condition === 'duelist L4 open' && r.metric === 'median_rounds'],
];

function parseCSV(text) {
  const lines = text.trim().split('\n').slice(1);
  return lines.map((l) => {
    const cells = l.match(/"((?:[^"]|"")*)"/g).map((c) => c.slice(1, -1).replace(/""/g, '"'));
    return { scenario: cells[0], condition: cells[1], metric: cells[2], value: Number(cells[3]), target: cells[4], verdict: cells[5] };
  });
}

const cols = [];
for (const [name, sets] of Object.entries(VARIANTS)) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bbb-'));
  const args = [path.join(__dirname, 'run.js'), '--n', N, '--only', ONLY, '--out', out];
  for (const s of sets) args.push('--set', s);
  process.stderr.write(`${name}… `);
  execFileSync('node', args, { stdio: ['ignore', 'ignore', 'ignore'] });
  const rows = parseCSV(fs.readFileSync(path.join(out, 'summary.csv'), 'utf8'));
  const graded = rows.filter((r) => r.verdict !== 'info');
  const col = { name, values: {} };
  for (const [label, f] of KEYS) {
    if (!f) { col.values[label] = `${graded.filter((r) => r.verdict === 'pass').length}/${graded.length}`; continue; }
    const r = rows.find(f);
    col.values[label] = r ? (r.metric.includes('rounds') ? String(r.value) : Math.round(r.value * 100) + '%') : '';
  }
  cols.push(col);
  process.stderr.write('done\n');
}
const w = Math.max(...KEYS.map(([k]) => k.length));
console.log(''.padEnd(w) + '  ' + cols.map((c) => c.name.padStart(8)).join(' '));
for (const [label] of KEYS) console.log(label.padEnd(w) + '  ' + cols.map((c) => String(c.values[label]).padStart(8)).join(' '));
