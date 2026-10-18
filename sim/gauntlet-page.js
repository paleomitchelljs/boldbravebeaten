#!/usr/bin/env node
/*
 * Build the gauntlet results page from sim/results/gauntlet/gauntlet.json.
 *   node sim/gauntlet-page.js [--in …/gauntlet.json] [--out …/report.html] [--title "…"]
 * The boss run (rooms starting with the chapel) is titled Death Knight Trials by default.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const IN = arg('in', path.join(__dirname, 'results', 'gauntlet', 'gauntlet.json'));
const OUT = arg('out', path.join(path.dirname(IN), 'report.html'));
const data = JSON.parse(fs.readFileSync(IN, 'utf8'));
const template = fs.readFileSync(path.join(__dirname, 'gauntlet-page.template.html'), 'utf8');
const title = arg('title', data.rooms[0] && data.rooms[0].key === 'chapel' ? 'Death Knight Trials' : 'The Gauntlet');
const html = template.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c'))
  .replace('<title>The Gauntlet</title>', `<title>${title}</title>`).replace('<h1>The Gauntlet</h1>', `<h1>${title}</h1>`);
fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${Math.round(html.length / 1024)} KB)`);
