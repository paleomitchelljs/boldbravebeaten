#!/usr/bin/env node
/*
 * Build the arena results page from sim/results/arena/arena.json.
 *   node sim/arena-page.js [--in sim/results/arena/arena.json] [--out sim/results/arena/report.html]
 *                          [--baseline sim/results/arena-r2/arena.json --baseline-label "round 2"]
 * The page embeds the data, so it is a single self-contained file.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const IN = arg('in', path.join(__dirname, 'results', 'arena', 'arena.json'));
const OUT = arg('out', path.join(__dirname, 'results', 'arena', 'report.html'));
const BASE = arg('baseline', null);
const data = JSON.parse(fs.readFileSync(IN, 'utf8'));
if (BASE) {
  // Keep only what the comparison needs from the earlier run.
  const b = JSON.parse(fs.readFileSync(BASE, 'utf8'));
  data.baseline = { label: arg('baseline-label', 'previous run'), agg: {}, rollups: b.rollups };
  for (const ar of Object.keys(b.agg)) {
    data.baseline.agg[ar] = {};
    for (const [k, v] of Object.entries(b.agg[ar])) data.baseline.agg[ar][k] = { avgWin: v.avgWin, meanRounds: v.meanRounds, deathRate: v.deathRate, koRate: v.koRate };
  }
}
// Keep the page light: drop per-pair event detail the page doesn't use.
for (const ar of Object.keys(data.results)) for (const r of Object.values(data.results[ar])) { delete r.evA; delete r.evB; }
const template = fs.readFileSync(path.join(__dirname, 'arena-page.template.html'), 'utf8');
const html = template.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c'));
fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${Math.round(html.length / 1024)} KB)`);
