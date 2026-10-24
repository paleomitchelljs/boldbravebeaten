#!/usr/bin/env node
/*
 * Hit locations (docs/PROPOSALS.md §2): what a landed blow does to each harness, by weapon and motion.
 * Every blow lands (no defence); armor is fresh before each one. Prints the mean CON and other attribute
 * damage, stamina, and how often the blow is vital, per harness.
 *
 *   node sim/locations.js [--n 4000] [--str 12]
 */
'use strict';
const B = require('../tests/load');
const { Character: C, Combat, Items, Rand } = B;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const N = arg('n', 4000), STR = arg('str', 12);

const piece = (type, covers, material) => Items.makeArmor(type, null, 'average', { covers, material });
const HARNESS = {
  'bare': () => [],
  'full mail': () => [Items.makeArmor('mail', 'full', 'average')],
  'full plate': () => [Items.makeArmor('plate', 'full', 'average')],
  'half plate (torso, arms, legs)': () => [Items.makeArmor('plate', 'half', 'average')],
  'breastplate only': () => [piece('plate', ['torso'])],
  'breastplate + helm + mail limbs': () => [piece('plate', ['torso']), piece('plate', ['head']), piece('mail', ['arms', 'legs'])],
  'mail shirt (torso, arms)': () => [piece('mail', ['torso', 'arms'])],
  'gambeson (torso, arms)': () => [piece('padded', ['torso', 'arms'])],
};
const WEAPONS = [['longsword', 'thrust'], ['longsword', 'swing'], ['greatsword', 'twoHanded'], ['warhammer', null], ['spikedMace', null]];

function attacker(type) {
  const a = C.newCharacter({ name: 'A', side: 'party', starterGear: false });
  a.base.STR = STR;
  const w = Items.makeWeapon(type, 'average');
  a.weapons.push(w); a.wield = w.id;
  return a;
}
function target(pieces) {
  const t = C.newCharacter({ name: 'T', side: 'enemy', starterGear: false });
  t.base.CON = 99; t.armor = null; t.pieces = [];
  for (const p of pieces) { if (Items.coversOf(p).includes('torso')) t.armor = p; else t.pieces.push(p); }
  return t;
}
const roller = async (req) => Array.from({ length: req.count }, () => Rand.d(req.sides));

(async () => {
  Rand.seed(11);
  console.log(`Every blow lands, ${N} blows each, STR ${STR}. CON / other attributes / stamina per blow; vital %.\n`);
  for (const [wt, motion] of WEAPONS) {
    const a = attacker(wt);
    const opt = C.attackOptions(a).find((o) => (motion ? o.motion === motion : o.weaponId) && !o.power && !o.windUp && !o.halfSword);
    console.log(`${opt.label} — ${Items.itemName(a.weapons[0])} [${opt.damage.join('/')}]`);
    for (const [name, make] of Object.entries(HARNESS)) {
      let con = 0, attrs = 0, st = 0, vital = 0, carried = 0;
      for (let i = 0; i < N; i++) {
        const t = target(make());
        t.stamina = C.maxStamina(t);
        const st0 = t.stamina;
        const before = Object.assign({}, t.damage);
        const enc = { hitThisRound: {}, fortressUsed: {}, log: [], pos: {} };
        const r = await Combat.applyHit(enc, { [a.id]: a, [t.id]: t }, a, t, opt, roller);
        con += t.damage.CON - (before.CON || 0);
        for (const k of Object.keys(t.damage)) if (k !== 'CON') attrs += t.damage[k] - (before[k] || 0);
        st += st0 - t.stamina;
        if (/VITAL/.test(r.text)) vital++;
        if (/carries/.test(r.text)) carried++;
      }
      const f = (x) => (x / N).toFixed(2).padStart(6);
      console.log(`  ${name.padEnd(34)} CON${f(con)}  attrs${f(attrs)}  stamina${f(st)}  vital ${(100 * vital / N).toFixed(1).padStart(4)}%${carried ? `  carried ${(100 * carried / N).toFixed(0)}%` : ''}`);
    }
    console.log('');
  }
})();
