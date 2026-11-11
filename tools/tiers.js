#!/usr/bin/env node
/*
 * Monster tiers (the user, 2026-11-09): how many heroes of the monster's own level make an even fight of it.
 *
 *   M = the number of heroes at which one of these is an even match (win 50%): found from n heroes against one
 *   (n = 1, 2, 3, 4, 6), log-interpolated. Weaker than one hero: one hero against k of them, M = 1 / k.
 *
 *   tier  1 very weak   one hero wins easily               M ≈ 0.35 or less
 *         2 weak        one hero wins, at some cost        M ≈ 0.6
 *         3 moderate    an even match one on one           M ≈ 1
 *         4 tough       an even match for two heroes       M ≈ 2
 *         5 boss        two heroes almost always lose      M ≈ 3.5
 *         6 epic        six of them at best an even match  M ≈ 6 or more
 *
 * A rough, continuous scale (the user: "plenty of room to wiggle"). monsters.yaml `tier` says what a creature is
 * meant to be; this says what it is. Encounters scale mostly by how many come at once.
 *
 * The heroes are every start.yaml hero, grown along their plans to the monster's level (World.settle), picked at
 * random for each fight, with a gear ladder standing in for what they'd have taken off the foes of the levels
 * before (GEAR below). AI on both sides; each fight fresh.
 *
 *   node tools/tiers.js [ids… | --all] [--n 24] [--level L] [--jobs 7] [--coat <oil>] [--only <heroes>]
 *   node tools/tiers.js --enc <place>/<encounter> [--enc …] [--heroes 2,3] [--coat <oil>]   (a whole encounter as
 *     authored, against n heroes of the place's level: the check for a boss and its leg-up)
 */
'use strict';
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(opt('n', 24));
const LEVEL = opt('level', null);
const COAT = opt('coat', null);
const ONLY = opt('only', null); // n heroes (or n×k) only: just that one rate, e.g. --only 3
const JOBS = Number(opt('jobs', Math.max(1, os.cpus().length - 1)));
const TIER_M = { 1: 0.35, 2: 0.6, 3: 1, 4: 2, 5: 3.5, 6: 6 };
const tierOf = (m) => { let best = 1; for (const [t, v] of Object.entries(TIER_M)) if (Math.abs(Math.log(m) - Math.log(v)) < Math.abs(Math.log(m) - Math.log(TIER_M[best]))) best = Number(t); return best; };

// The gear ladder and the growth: sim/grow.js (shared with sim/swarm.js).
const { gear } = require('../sim/grow.js');

// ---- One monster (a worker) ----------------------------------------------------------------------------------------
async function measure(key, n) {
  const B = require('../tests/load.js');
  const { World, Battle, Auto, Rand, Character: C } = B;
  const M = B.Enemies.MONSTERS[key];
  const level = LEVEL ? Number(LEVEL) : (M.level || 1);
  const heroes = World.heroes().map((h) => gear(World.settle(h, level), level));
  let seed = 1000;
  async function rate(nh, nm) {
    let won = 0, con = 0;
    for (let i = 0; i < n; i++) {
      Rand.seed(seed++);
      const pick = heroes.slice().sort(() => Rand.rng() - 0.5).slice(0, nh);
      const w = World.create(pick, { log: false });
      w.supplies.bandages = 0;
      // --coat <oil>: every hero's weapon worked with a bane oil (the boss's leg-up), as Use does in town.
      if (COAT) for (const c of World.party(w)) { const wpn = C.wieldedWeapon(c), g = World.goodDef(COAT); if (wpn) wpn.coat = { good: COAT, name: g.name, slay: g.coat.slay, hits: g.coat.hits }; }
      Battle.start(w, { foes: [{ monster: key, n: nm }] });
      const enc = await Auto.battle(w, { maxRounds: 30 });
      if (enc.winner === 'party') { won++; con += World.party(w).reduce((t, c) => t + (c.damage.CON || 0), 0) / nh; }
    }
    return { p: won / n, con: won ? con / won : null };
  }
  const pts = [];
  const at = async (nh, nm) => { const r = await rate(nh, nm); pts.push({ nh, nm, x: nh / nm, ...r }); return r; };
  if (ONLY) { await at(Number(ONLY), 1); const p = pts[0]; return { key, level, tier: M.tier || null, m: p.p, note: `p(${ONLY}v1)=`, pts }; }
  const one = await at(1, 1);
  const cross = (a, b) => Math.exp(Math.log(a.x) + (Math.log(b.x) - Math.log(a.x)) * (a.p - 0.5) / (a.p - b.p || 1e-9));
  let m = null, note = '';
  if (one.p >= 0.5) {
    let prev = pts[0];
    for (const k of [2, 3, 4, 6]) {
      const r = await at(1, k);
      const cur = pts[pts.length - 1];
      if (r.p < 0.5) { m = cross(prev, cur); break; }
      prev = cur;
    }
    if (m == null) { m = 1 / 6; note = '≤'; }
  } else {
    let prev = pts[0];
    for (const h of [2, 3, 4, 6]) {
      const r = await at(h, 1);
      const cur = pts[pts.length - 1];
      if (r.p >= 0.5) { m = cross(prev, cur); break; }
      prev = cur;
    }
    if (m == null) { m = 6; note = '>'; }
  }
  return { key, level, tier: M.tier || null, m, note, pts };
}

// ---- A whole encounter (--enc place/id): n heroes of the place's level against it as authored --------------------------
async function encounter(spec, sizes, n) {
  const B = require('../tests/load.js');
  const { World, Battle, Auto, Rand, Character: C } = B;
  const [pid, eid] = spec.split('/');
  const place = B.Content.world.places[pid];
  const e = place.encounters[eid];
  const level = LEVEL ? Number(LEVEL) : (place.level || 1);
  const heroes = World.heroes().map((h) => gear(World.settle(h, level), level));
  const out = [];
  let seed = 5000;
  for (const nh of sizes) {
    let won = 0, dead = 0;
    for (let i = 0; i < n; i++) {
      Rand.seed(seed++);
      const pick = heroes.slice().sort(() => Rand.rng() - 0.5).slice(0, nh);
      const w = World.create(pick, { log: false });
      w.supplies.bandages = 0;
      if (COAT) for (const c of World.party(w)) { const wpn = C.wieldedWeapon(c), g = World.goodDef(COAT); if (wpn) wpn.coat = { good: COAT, name: g.name, slay: g.coat.slay, hits: g.coat.hits }; }
      Battle.start(w, e);
      const enc = await Auto.battle(w, { maxRounds: 30 });
      if (enc.winner === 'party') won++;
      dead += World.party(w).filter((c) => c.status.dead).length;
    }
    out.push(`${nh} heroes ${Math.round(100 * won / n)}% (${(dead / n).toFixed(1)} dead)`);
  }
  return `${spec.padEnd(28)} L${level}${COAT ? ' +' + COAT : ''}: ${out.join(', ')}`;
}

// ---- The driver ----------------------------------------------------------------------------------------------------
if (process.env.TIERS_ENC) {
  encounter(process.env.TIERS_ENC, String(opt('heroes', '2,3')).split(',').map(Number), N).then((r) => process.stdout.write(JSON.stringify({ enc: r })));
} else if (process.env.TIERS_WORKER) {
  measure(process.env.TIERS_WORKER, N).then((r) => { process.stdout.write(JSON.stringify(r)); });
} else {
  const B = require('../tests/load.js');
  const all = Object.keys(B.Enemies.MONSTERS).filter((k) => !B.Enemies.MONSTERS[k].group);
  const encs = argv.includes('--enc') ? argv.filter((a, i) => i > 0 && argv[i - 1] === '--enc') : [];
  const ids = encs.length ? encs : argv.includes('--all') ? all : argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
  if (!ids.length) { console.log('node tools/tiers.js [ids… | --all] [--n 24] [--level L] [--jobs 7]'); process.exit(0); }
  const queue = ids.slice();
  const out = [];
  const fmt = (r) => {
    const want = r.tier ? `tier ${r.tier} (M≈${TIER_M[r.tier]})` : 'no tier';
    const got = `M ${r.note}${r.m.toFixed(2)} → tier ${tierOf(r.m)}`;
    const pts = r.pts.map((p) => `${p.nh}v${p.nm} ${Math.round(100 * p.p)}%${p.con != null ? ` (${p.con.toFixed(1)} CON)` : ''}`).join(', ');
    const flag = r.tier && tierOf(r.m) !== r.tier ? ' ✗' : '';
    return `${r.key.padEnd(20)} L${String(r.level).padEnd(3)} ${want.padEnd(18)} ${got.padEnd(20)}${flag}  ${pts}`;
  };
  const run = () => new Promise((done) => {
    let live = 0;
    const next = () => {
      if (!queue.length && !live) return done();
      while (live < JOBS && queue.length) {
        const key = queue.shift();
        live++;
        execFile(process.execPath, [__filename, ...argv], { env: Object.assign({}, process.env, encs.length ? { TIERS_ENC: key } : { TIERS_WORKER: key }), maxBuffer: 1 << 24, cwd: path.join(__dirname, '..') }, (err, stdout) => {
          live--;
          if (err) console.log(`${key}: ${err.message.split('\n')[0]}`);
          else { const r = JSON.parse(stdout); out.push(r); console.log(r.enc || fmt(r)); }
          next();
        });
      }
    };
    next();
  });
  run().then(() => {
    if (argv.includes('--json')) require('fs').writeFileSync(opt('json'), JSON.stringify(out, null, 1));
  });
}
