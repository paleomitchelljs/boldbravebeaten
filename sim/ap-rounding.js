#!/usr/bin/env node
// R9 (docs/PLAN.md step 8): what rounding every cost to half an AP does to the things that cut or add AP. For each, the
// cost in sheet AP with apStep off (tenths) and on (halves): Quick feats by rank, armor's per-action cost by armor, weapon
// strain by STR, and the dearest and cheapest of a few weapons' motions. A line where the ranks no longer differ
// is a bonus that rounds away.
//   node sim/ap-rounding.js
'use strict';
const L = require('./lib');
const { C, CONFIG } = L;
const B = require('../tests/load.js');
const { Items } = B;

const mk = (weapon, kit) => {
  const c = C.newCharacter({ name: 'T', side: 'party', starterGear: false });
  c.id = 'T';
  if (weapon) { const w = Items.makeWeapon(weapon); c.weapons.push(w); c.wield = w.id; }
  if (kit) kit(c);
  c.stamina = C.maxStamina(c);
  return c;
};
const fm = (n) => C.fmtAP(n);
const both = (f) => { const out = []; for (const v of [null, 0.5]) { CONFIG.apStep = v; out.push(f()); } return out; };
const row = (label, vals) => console.log(`  ${label.padEnd(34)} ${vals.map(([a, b]) => `${a}${a === b ? '' : '→' + b}`.padEnd(11)).join('')}`);

console.log('Quick feats: cost by rank 0..3  (tenths → halves where they differ)');
const QUICK = [
  ['Quick Thrust, rapier thrust', 'rapier', 'quick_thrust', (c) => C.attackOptions(c).find((o) => o.motion === 'thrust' && !o.windUp).ap],
  ['Quick Thrust, longsword thrust', 'longsword', 'quick_thrust', (c) => C.attackOptions(c).find((o) => o.motion === 'thrust' && !o.windUp).ap],
  ['Quick Thrust, dagger thrust', 'dagger', 'quick_thrust', (c) => C.attackOptions(c).find((o) => o.motion === 'thrust' && !o.windUp).ap],
  ['Quick Thrust, short spear thrust', 'shortSpear', 'quick_thrust', (c) => C.attackOptions(c).find((o) => o.motion === 'thrust' && !o.windUp).ap],
  ['Quick Parry, longsword', 'longsword', 'quick_parry', (c) => C.actionCost(c, 'parry').ap],
  ['Quick Dodge', 'longsword', 'quick_dodge', (c) => C.actionCost(c, 'dodge').ap],
  ['Quick Block (round shield)', 'longsword', 'quick_block', (c) => C.actionCost(c, 'block').ap, (c) => { c.shield = Items.makeShield('round'); }],
  ['Heavy Tempo, great axe two-handed', 'greatAxe', 'heavy_tempo', (c) => { const o = C.attackOptions(c).find((x) => x.motion === 'twoHanded' || x.motion === 'power'); return o ? o.ap : 0; }],
  ['Quick Hands, punch', null, 'quick_hands', (c) => C.attackOptions(c).find((x) => x.unarmed === 'punch').ap],
];
for (const [label, wpn, feat, cost, kit] of QUICK) {
  const per = [];
  for (let r = 0; r <= 3; r++) per.push(both(() => { const c = mk(wpn, kit); c.feats = { [feat]: r }; return fm(cost(c)); }));
  const max = (L.C.DATA || B.DATA).FEATS && (B.DATA.FEATS[feat] || {}).ranks ? B.DATA.FEATS[feat].ranks.length : 3;
  const hs = per.map((p) => p[1]);
  const flat = hs.slice(1, max + 1).filter((v, i, a) => i > 0 && v === a[i - 1]).length;
  row(label, per.slice(0, max + 1));
  if (flat) console.log(`    ↳ ${flat} rank${flat > 1 ? 's' : ''} no better than the one before, in halves`);
}

console.log('\nArmor: a thrust, a parry and a move of 4 squares, by armor worn (none, then each)');
const types = ['none'].concat(Object.keys(B.DATA.ARMOR || {}));
for (const t of types) {
  const vals = [0, 1, 2].map((k) => both(() => { const c = mk('longsword'); if (t !== 'none') c.armor = Items.makeArmor(t); return fm(k === 0 ? C.attackOptions(c).find((o) => o.motion === 'thrust' && !o.windUp).ap : k === 1 ? C.actionCost(c, 'parry').ap : C.moveCost(c, 4)); }));
  row(t, vals);
}

console.log('\nWeapon strain: a heavy weapon\'s dearest swing and its thrust (where it has one), by STR (past its capacity, AP × strain²)');
for (const w of ['longsword', 'warhammer', 'battleAxe', 'greatAxe']) for (const str of [2, 3, 4, 5, 6, 8]) {
  const vals = ['swing', 'thrust'].map((m) => both(() => {
    const c = mk(w); c.base = Object.assign({}, c.base, { STR: str }); c.stamina = C.maxStamina(c);
    const os = C.attackOptions(c).filter((x) => !x.windUp && (m === 'thrust' ? x.motion === 'thrust' : x.motion === 'swing' || x.motion === 'twoHanded' || x.motion === 'power'));
    return os.length ? fm(Math.max(...os.map((x) => x.ap))) : '–';
  }));
  row(`${w}, STR ${str}`, vals);
}
CONFIG.apStep = 0.5;
