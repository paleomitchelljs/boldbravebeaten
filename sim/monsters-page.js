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
const TARGET = { rustBeetle: [0, 'heavy'], displacer: [1, 'archery'], giantSpider: [0, 'unarmored'], owlbear: [1, 'twoHanded'], caveTroll: [1, 'shield'], skeleton: [1, 'archery'], froglok: [1, 'grappler'], sarnak: [0, 'light'] };
const { C, Enemies } = L;
// Plain-words summary of a creature's traits for the page.
function traitText(c) {
  const t = c.traits || {};
  const out = [];
  if (t.tireless) out.push('tireless (no stamina; no bleeding)');
  if (t.resist) out.push('takes ' + Object.entries(t.resist).map(([k, v]) => `${{ P: 'piercing', S: 'slashing', B: 'blunt' }[k]} ×${v}`).join(', '));
  if (t.pack) out.push(`pack +${t.pack}`);
  if (t.displacement) out.push(`displacement (arrows miss ${t.displacement.ranged * 100}%, blows ${t.displacement.melee * 100}%)`);
  if (t.regen) out.push('regenerates');
  if (t.apMult) out.push(`boss ×${t.apMult}`);
  if (t.nimble) out.push(`nimble +${t.nimble}`);
  if (t.slippery) out.push(`slippery +${t.slippery}`);
  if (t.moveMult) out.push(`leaps ×${t.moveMult} movement`);
  return out.join('; ');
}
data.meta = {};
for (const m of Object.keys(data.monsters)) {
  const M = Enemies.MONSTERS[m];
  const body = Enemies.makeMonster(m);
  const one = body[0];
  const stats = M.group
    ? [['members', M.group.map((k) => Enemies.MONSTERS[k].name).join(', ')]]
    : [['stamina', C.maxStamina(one)], ['AP', C.apPool(one)], ['CON', C.attr(one, 'CON')],
      ['armor', one.armor ? L.B.DATA.ARMOR[one.armor.type].name : 'none'],
      ['attacks', C.attackOptions(one).filter((o) => !o.unarmed).map((o) => `${o.label} ${o.damage.join('/')}`).join(', ')]]
      .concat(traitText(one) ? [['traits', traitText(one)]] : []);
  data.meta[m] = { name: M.name, blurb: M.blurb, group: !!M.group, boss: !!(M.traits && M.traits.apMult), target: TARGET[m] || null, stats };
}
// Party fights, if they've been run (sim/party-arena.js).
const PARTY = path.join(path.dirname(IN), 'party.json');
if (fs.existsSync(PARTY)) data.party = JSON.parse(fs.readFileSync(PARTY, 'utf8'));
const template = fs.readFileSync(path.join(__dirname, 'monsters-page.template.html'), 'utf8');
const html = template.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c'));
fs.writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${Math.round(html.length / 1024)} KB)`);
