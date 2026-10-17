#!/usr/bin/env node
/*
 * Build the monster results page from sim/results/monsters/monsters.json.
 *   node sim/monsters-page.js [--in …/monsters.json] [--out …/report.html]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const IN = arg('in', path.join(__dirname, 'results', 'monsters', 'monsters.json'));
const OUT = arg('out', path.join(__dirname, 'results', 'monsters', 'report.html'));
const data = JSON.parse(fs.readFileSync(IN, 'utf8'));

// What each monster targets, as [0 = armor class | 1 = fighting style, key].
const TARGET = { rustBeetle: [0, 'heavy'], displacer: [1, 'archery'], giantSpider: [0, 'unarmored'], owlbear: [1, 'twoHanded'], caveTroll: [1, 'shield'] };
const { C, Enemies } = L;
data.meta = {};
for (const m of Object.keys(data.monsters)) {
  const M = Enemies.MONSTERS[m];
  const body = Enemies.makeMonster(m);
  const one = body[0];
  const stats = M.group
    ? [['members', M.group.map((k) => Enemies.MONSTERS[k].name).join(', ')]]
    : [['stamina', C.maxStamina(one)], ['AP', C.apPool(one)], ['CON', C.attr(one, 'CON')],
      ['armor', L.B.DATA.ARMOR[one.armor.type].name], ['attacks', C.attackOptions(one).map((o) => `${o.label} ${o.damage.join('/')}`).join(', ')]];
  data.meta[m] = { name: M.name, blurb: M.blurb, group: !!M.group, boss: !!(M.traits && M.traits.apMult), target: TARGET[m] || null, stats };
}
// Drop per-pairing event detail the page doesn't use beyond totals.
const template = fs.readFileSync(path.join(__dirname, 'monsters-page.template.html'), 'utf8');
const html = template.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c'));
fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${Math.round(html.length / 1024)} KB)`);
