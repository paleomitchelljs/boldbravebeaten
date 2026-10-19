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
  // If the earlier run had fighters this one doesn't (magic users), recompute its averages
  // over the fighters both runs share, so the comparison is like for like.
  const keys = Object.keys(data.agg[Object.keys(data.agg)[0]]);
  const extra = Object.keys(b.agg[Object.keys(b.agg)[0]]).filter((k) => !keys.includes(k));
  if (extra.length) {
    for (const ar of Object.keys(b.agg)) {
      for (const k of keys) {
        const others = keys.filter((o) => o !== k);
        const pair = (o) => b.results[ar][k + '|' + o] || b.results[ar][o + '|' + k];
        data.baseline.agg[ar][k].avgWin = others.reduce((t, o) => t + b.view[ar][k][o], 0) / others.length;
        data.baseline.agg[ar][k].meanRounds = others.reduce((t, o) => t + pair(o).meanRounds, 0) / others.length;
      }
      for (const k of extra) delete data.baseline.agg[ar][k];
    }
    data.baseline.label += ' (without ' + extra.map((k) => k.split('/')[1]).filter((v, i, a) => a.indexOf(v) === i).join(', ') + ')';
  }
}
// Keep the page light: drop per-pair event detail the page doesn't use.
for (const ar of Object.keys(data.results)) for (const r of Object.values(data.results[ar])) { delete r.evA; delete r.evB; }
const template = fs.readFileSync(path.join(__dirname, 'arena-page.template.html'), 'utf8');
const html = template.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c'));
fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${Math.round(html.length / 1024)} KB)`);
