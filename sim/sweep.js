#!/usr/bin/env node
/*
 * The swing's setting (docs/PLAN.md R8, step 6): does a longsword's swing get chosen against two or more unarmored
 * foes, and still not against armor? One hero with a longsword (Beren's preset at level 1, with and without his
 * shield) against N level-1 bandits (foes.yaml) whose armor is set to none, padded or mail, everywhere. AI on both
 * sides; the game's open arena; each fight fresh, no bandages.
 *
 *   node sim/sweep.js [--n 40] [--max 3] [--seed 4242] [--weapon longsword] [--only swing|thrust] [--set path=value …]
 *
 * Reports, by armor and N: the hero's win rate, the share of its strikes that are swings (of the longsword's swing,
 * two-handed and power blows), how many sweeps carried on and how many of those landed.
 */
'use strict';
const path = require('path');
const B = require(path.join(__dirname, '..', 'tests', 'load.js'));
const { World, Battle, Rand, Combat, AI, Items, CONFIG } = B;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('n', 40)), MAX = Number(arg('max', 3)), SEED = Number(arg('seed', 4242)), WEAPON = arg('weapon', 'longsword');
argv.forEach((a, i) => {
  if (a !== '--set') return;
  const [p, raw] = argv[i + 1].split('=');
  const keys = p.split('.');
  let o = CONFIG;
  for (const k of keys.slice(0, -1)) o = o[k];
  let v; try { v = JSON.parse(raw); } catch (e) { v = raw; }
  o[keys[keys.length - 1]] = v;
});

// --only swing|thrust: the hero's weapon blows limited to that motion (swing: swing, two-handed, power), to see what
// each is worth in the fight rather than in the AI's valuation.
const ONLY = arg('only', null);
if (ONLY) {
  const base = B.Character.attackOptions;
  B.Character.attackOptions = function (c, ...rest) {
    const opts = base.call(this, c, ...rest);
    if (c.side !== 'party') return opts;
    return opts.filter((o) => o.unarmed || o.ranged || o.spell || (ONLY === 'swing' ? ['swing', 'twoHanded', 'power'].includes(o.motion) : o.motion === ONLY));
  };
}
const beren = World.heroes().find((h) => h.id === 'beren');
const kits = {
  'sword & shield': Object.assign({}, beren, { weaponItems: [{ weapon: WEAPON, material: 'steel' }, { weapon: 'dagger' }] }),
  'sword alone': Object.assign({}, beren, { weaponItems: [{ weapon: WEAPON, material: 'steel' }, { weapon: 'dagger' }], shieldItem: null }),
};
const armors = { none: null, padded: 'padded', mail: 'mail' };
const SWINGS = new Set(['swing', 'twoHanded', 'power']);

async function fight(spec, armor, n) {
  const w = World.create([spec], { log: false });
  w.supplies.bandages = 0;
  Battle.start(w, { foes: [{ template: 'bandit', level: 1, n }] });
  for (const f of Object.values(w.battle.foes)) f.armor = armor ? Items.makeArmor(armor, 'full', 'average') : null;
  const b = w.battle, enc = b.enc, chars = Battle.table(w).characters;
  const hero = World.party(w)[0].id;
  const out = { strikes: 0, swings: 0, sweeps: 0, sweptHome: 0 };
  while (enc.phase !== 'over' && enc.round < 30) {
    await Combat.startRound(enc, chars, B.Town.autoRoller);
    let guard = 2000;
    while (enc.phase === 'turn' && guard-- > 0) {
      const id = Combat.currentActor(enc);
      const d = AI.choose(enc, chars, id, () => Rand.rng(), chars[id].policy);
      if (id === hero && d && d.type === 'strike' && d.option && !d.option.unarmed) { out.strikes++; if (SWINGS.has(d.option.motion)) out.swings++; }
      await Combat.submit(enc, chars, d, { roller: B.Town.autoRoller });
    }
  }
  for (const l of enc.log) {
    const t = String(l.text || l);
    if (/ into .*\.$/.test(t) && /(carries through|carries past|passes over)/.test(t)) out.sweeps++;
    if (/\(sweep\) hits /.test(t)) out.sweptHome++;
  }
  out.won = enc.winner === 'party';
  return out;
}

(async () => {
  console.log(`a level-1 ${WEAPON} (Beren) against N level-1 bandits, armor set on every bandit; ${N} fights a cell; seed ${SEED}` + (ONLY ? `; ${ONLY} only` : '') + (CONFIG.sweep ? `; sweep ${CONFIG.sweep.force} / ${CONFIG.sweep.heavy}` : '; sweep off'));
  for (const [kname, spec] of Object.entries(kits)) {
    console.log(`\n${kname}`);
    console.log('armor'.padEnd(8) + Array.from({ length: MAX }, (_, i) => `N=${i + 1}: won, swings of strikes, sweeps (home)`.padEnd(44)).join(''));
    for (const [aname, armor] of Object.entries(armors)) {
      const cells = [];
      for (let n = 1; n <= MAX; n++) {
        const t = { won: 0, strikes: 0, swings: 0, sweeps: 0, sweptHome: 0 };
        for (let i = 0; i < N; i++) {
          Rand.seed(SEED + 7919 * n + i);
          const r = await fight(spec, armor, n);
          for (const k of Object.keys(t)) t[k] += Number(r[k]);
        }
        cells.push(`${Math.round(100 * t.won / N)}%, ${t.strikes ? Math.round(100 * t.swings / t.strikes) : 0}% of ${t.strikes}, ${t.sweeps} (${t.sweptHome})`.padEnd(44));
      }
      console.log(aname.padEnd(8) + cells.join(''));
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
