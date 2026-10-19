#!/usr/bin/env node
/*
 * Build the revenant knight scaling page from sim/results/dk-scaling/dk-scaling.json.
 *   node sim/dk-scaling-page.js [--in …/dk-scaling.json] [--out …/report.html]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const IN = arg('in', path.join(__dirname, 'results', 'dk-scaling', 'dk-scaling.json'));
const OUT = arg('out', path.join(path.dirname(IN), 'report.html'));
const data = JSON.parse(fs.readFileSync(IN, 'utf8'));
const template = fs.readFileSync(path.join(__dirname, 'dk-scaling-page.template.html'), 'utf8');
const html = template.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c'));
fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${Math.round(html.length / 1024)} KB)`);
