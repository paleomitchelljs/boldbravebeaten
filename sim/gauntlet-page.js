#!/usr/bin/env node
/*
 * Build the gauntlet results page from sim/results/gauntlet/gauntlet.json.
 *   node sim/gauntlet-page.js [--in …/gauntlet.json] [--out …/report.html] [--title "…"]
 *   node sim/gauntlet-page.js --levels    (every sim/results/gauntlet/L{level} run, one page with a level switch)
 * The boss run (rooms starting with the chapel) is titled Death Knight Trials by default.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const LEVELS = argv.includes('--levels');
const DIR = arg('dir', path.join(__dirname, 'results', 'gauntlet'));
const IN = arg('in', path.join(DIR, 'gauntlet.json'));
const OUT = arg('out', LEVELS ? path.join(DIR, 'report.html') : path.join(path.dirname(IN), 'report.html'));
let data;
if (LEVELS) {
  // Every party level that has been run: { levels: { 2: run, 6: run, 15: run } }.
  data = { levels: {} };
  for (const d of fs.readdirSync(DIR).filter((x) => /^L\d+$/.test(x))) {
    const f = path.join(DIR, d, 'gauntlet.json');
    if (fs.existsSync(f)) data.levels[d.slice(1)] = JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  data.rooms = Object.values(data.levels)[0].rooms;
} else data = JSON.parse(fs.readFileSync(IN, 'utf8'));
const template = fs.readFileSync(path.join(__dirname, 'gauntlet-page.template.html'), 'utf8');
const title = arg('title', data.rooms[0] && data.rooms[0].key === 'chapel' ? 'Death Knight Trials' : 'The Gauntlet');
const html = template.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c'))
  .replace('<title>The Gauntlet</title>', `<title>${title}</title>`).replace('<h1>The Gauntlet</h1>', `<h1>${title}</h1>`);
fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${Math.round(html.length / 1024)} KB)`);
