#!/usr/bin/env node
/*
 * Party size (docs/OVERHAUL.md step D): how a place goes for parties of 1 to 6, so encounter scaling can be judged.
 * A crawl as sim/crawl.js does it (the place's groups nearest first, on the dungeon map, groups in earshot joining,
 * rest and repair between fights, never retreating) for each size.
 *
 *   node sim/partysize.js [temple_court,ember_hall,orc_valley] [--sizes 1,2,3,4,5,6] [--n 30] [--seed 4242] [--jobs 3] [--json file]
 *
 * The party: up to four, drawn at random from start.yaml's presets (as sim/crawl.js --party does); five and six, the four
 * presets and one or two recruits drawn from start.yaml's recruits. Level 1, as they start. Crawl i of every size and
 * place is seeded SEED + i, so a size's column differs from the next by the party, not the dice.
 *
 * Reported for each place and size: cleared of n (± its standard error); fights fought a crawl; heroes dead a fight
 * (the party's deaths over the fights it fought, ± a standard error by crawl: deaths and fights are counted per crawl
 * and the ratio's error taken across crawls); heroes dead a crawl; the share of crawls with nobody dead.
 */
'use strict';
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PLACES = (argv[0] && !argv[0].startsWith('--') ? argv[0] : 'temple_court,ember_hall,orc_valley').split(',');
const SIZES = opt('sizes', '1,2,3,4,5,6').split(',').map(Number);
const N = Number(opt('n', 30)), SEED = Number(opt('seed', 4242));
const JOBS = Number(opt('jobs', Math.max(1, Math.min(3, os.cpus().length - 1))));

// ---- One place, one size: n crawls (a worker) ---------------------------------------------------------------------
async function runCell(place, size) {
  const B = require(path.join(__dirname, '..', 'tests', 'load.js'));
  const { World, Battle, Auto, Rand, Explore } = B;
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const open = (world) => {
    const g = Explore.here(world), out = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const def = g.legend[g.rows[y][x]];
      if (def && def.kind === 'monster' && !Explore.state(world, x, y).done) out.push({ x, y, def });
    }
    return out.sort((a, b) => cheb(a, world.explore) - cheb(b, world.explore));
  };
  const presets = World.presetParty();
  const recruits = World.heroes().filter((h) => !presets.some((p) => (p.id || p.name) === (h.id || h.name)));
  const pick = (list, k) => list.slice().sort(() => Rand.rng() - 0.5).slice(0, k);
  const party = (k) => (k <= presets.length ? pick(presets, k) : presets.concat(pick(recruits, k - presets.length)));
  if (size > presets.length + recruits.length) throw new Error(`no party of ${size}: start.yaml has ${presets.length + recruits.length} heroes`);
  const rows = [];
  for (let i = 0; i < N; i++) {
    Rand.seed(SEED + i);
    const world = World.create(party(size), { log: false });
    Explore.enter(world, place, Explore.findChar(place, '<') ? '<' : 'S');
    let fights = 0, cleared = false;
    for (;;) {
      const t = open(world)[0];
      if (!t) { cleared = true; break; }
      Battle.start(world, Object.assign({ name: t.def.label }, Explore.encounterSpec(world, t.def)), { ctx: { x: t.x, y: t.y, back: true } });
      await Auto.battle(world, { maxBeats: 27 });
      const out = Battle.finish(world);
      fights++;
      if (out.result !== 'won' || !World.living(world).length) break;
      World.restAndRepair(world);
      world.explore.x = t.x; world.explore.y = t.y;
    }
    const dead = World.party(world).filter((c) => c.status.dead).length;
    rows.push({ cleared: cleared ? 1 : 0, fights, dead, party: World.party(world).map((c) => c.name) });
  }
  return rows;
}

function stats(rows) {
  const n = rows.length, mean = (f) => rows.reduce((t, r) => t + f(r), 0) / (n || 1);
  const p = mean((r) => r.cleared);
  const F = mean((r) => r.fights), D = mean((r) => r.dead);
  const ratio = F ? D / F : 0;
  const seRatio = n > 1 && F ? Math.sqrt(rows.reduce((t, r) => t + (r.dead - ratio * r.fights) ** 2, 0) / (n * (n - 1))) / F : null;
  const sd = (f, m) => (n > 1 ? Math.sqrt(rows.reduce((t, r) => t + (f(r) - m) ** 2, 0) / (n - 1)) : 0);
  return { n, cleared: p, clearedSE: Math.sqrt(p * (1 - p) / (n || 1)), fights: F, deadPerFight: ratio, deadPerFightSE: seRatio, deadPerCrawl: D, deadPerCrawlSE: sd((r) => r.dead, D) / Math.sqrt(n || 1), noneDead: mean((r) => (r.dead ? 0 : 1)) };
}

if (process.env.PARTYSIZE_TASK) {
  const t = JSON.parse(process.env.PARTYSIZE_TASK);
  runCell(t.place, t.size).then((rows) => process.stdout.write('\n@@' + JSON.stringify(rows) + '\n')).catch((e) => { console.error(e); process.exit(1); });
} else {
  const B = require(path.join(__dirname, '..', 'tests', 'load.js'));
  for (const p of PLACES) if (!B.Content.world.places[p]) { console.error('no such place: ' + p); process.exit(1); }
  const tasks = [];
  for (const place of PLACES) for (const size of SIZES) tasks.push({ place, size });
  const results = new Array(tasks.length);
  let next = 0, done = 0;
  const run = (t) => new Promise((resolve) => {
    execFile(process.execPath, ['--max-old-space-size=3000', __filename, ...argv], { env: Object.assign({}, process.env, { PARTYSIZE_TASK: JSON.stringify(t) }), maxBuffer: 1 << 26 }, (err, out, errout) => {
      if (err) { resolve({ error: String(errout || err).slice(0, 500) }); return; }
      const m = out.split('\n@@')[1];
      resolve(m ? JSON.parse(m) : { error: 'no result' });
    });
  });
  const worker = async () => { while (next < tasks.length) { const i = next++; results[i] = await run(tasks[i]); process.stderr.write(`\r${++done}/${tasks.length} `); } };
  Promise.all(Array.from({ length: Math.min(JOBS, tasks.length) }, worker)).then(() => {
    process.stderr.write('\n');
    const pc = (x) => Math.round(100 * x) + '%';
    console.log(`Party size: ${N} crawls a place and size, seed ${SEED}, level 1. Sizes up to 4 drawn from the presets, 5 and 6 the presets and recruits.\n`);
    let failed = false;
    for (const place of PLACES) {
      console.log(place);
      console.log('  size  cleared            fights/crawl  heroes dead a fight   dead a crawl     nobody dead');
      for (const size of SIZES) {
        const r = results[tasks.findIndex((t) => t.place === place && t.size === size)];
        if (!r || r.error) { console.log(`  ${size}     ERROR ${r && r.error}`); failed = true; continue; }
        const s = stats(r);
        console.log(`  ${String(size).padEnd(6)}${`${Math.round(s.cleared * N)}/${N} (${pc(s.cleared)} ± ${pc(s.clearedSE)})`.padEnd(19)}${s.fights.toFixed(1).padEnd(14)}${`${s.deadPerFight.toFixed(2)} ± ${s.deadPerFightSE == null ? '-' : s.deadPerFightSE.toFixed(2)}`.padEnd(22)}${`${s.deadPerCrawl.toFixed(2)} ± ${s.deadPerCrawlSE.toFixed(2)}`.padEnd(17)}${pc(s.noneDead)}`);
        if (opt('json', null)) require('fs').appendFileSync(opt('json'), JSON.stringify(Object.assign({ sim: 'partysize', place, size, seed: SEED }, s)) + '\n');
      }
      console.log('');
    }
    if (failed) process.exitCode = 1;
  });
}
