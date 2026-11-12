#!/usr/bin/env node
/*
 * What a feat, an attribute point or a skill rank is worth (step 9 of docs/PLAN.md).
 *
 * A preset hero at a level (World.settle along its start.yaml plan, the gear ladder of sim/grow.js) fights the same foes
 * on the same seeds with and without one change, so the two runs share their dice and the difference is not the luck of
 * the draw. The change is one of:
 *
 *   +feat  one more rank of a feat the hero could hold (its skill, tier and requirements met, the budget ignored)
 *   -feat  one rank of a feat the hero holds taken away (only where nothing else depends on it)
 *   +attr  one point on an attribute (--attrs)
 *   +skill one rank in a skill (--skills; not at its top)
 *
 * The foes (--foes): the other presets at the same level, and a few monsters that stand for the level (--monsters).
 * Reported: win rate (a timeout counts a half) and its change from the hero as planned, with the standard error of the
 * paired difference (so "+6 ± 5" is noise); the change in mean rounds, in heroes dead a fight, and in the attribute
 * points of harm taken and dealt (a finer measure than a win, which only flips in a close fight). Metrics' median rounds,
 * collapses and stamina are in the baseline line.
 *
 *   node sim/feats.js [--level 3] [--heroes Beren,Cyrus,Lorc,Jabiku] [--n 12] [--seed 700] [--jobs 7]
 *       [--feat id,id] [--attrs] [--skills] [--no-feats] [--also leadership,shadow,deception,athletics,lore]
 *       [--lab] [--monsters a,b,c] [--json file]
 *   (--lab: for each feat the hero's skills do not open, the hero with the feat and the skills and feats it needs)
 *   (--also adds feat trees outside the body, combat and magic groups whose feats touch a fight)
 *   node sim/feats.js --crawl temple_court [--party Beren,Cyrus,Lorc] [--n 20] [--level 1]
 *       the same changes (on --hero, default the party's first) over a crawl of a place with a party of those heroes:
 *       cleared of n, heroes dead a fight (Metrics), against the party as planned.
 *
 * A fight is a duel in a 12 x 6 room, AI on both sides. n is the number of seeds a foe, so a hero meets
 * n x (foes) fights a variant. Magic feats are shown for the casters only where they touch the fight; a mage in a duel
 * is a weak test of a healer (the crawl is the better one for Jabiku).
 */
'use strict';
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);
const LEVEL = Number(opt('level', 3));
const N = Number(opt('n', 12));
const SEED = Number(opt('seed', 700));
const JOBS = Number(opt('jobs', Math.max(1, os.cpus().length - 1)));
const HEROES = opt('heroes', 'Beren,Cyrus,Lorc,Jabiku').split(',');
const CRAWL = opt('crawl', null);
const FEAT_ONLY = opt('feat', null);

// Monsters that stand for a level: tier 2 to 3 foes of about the level, so a hero of that level is a fair match.
const MONSTERS = {
  1: ['goblinWarrior', 'scaleward', 'fireGoblin'],
  2: ['goblinWarrior', 'scaleward', 'orcCenturion'],
  3: ['orcCenturion', 'gnomeWarrior', 'koboldSpearman'],
  4: ['orcCenturion', 'koboldChampion', 'sarnak'],
  5: ['koboldChampion', 'sarnakKnight', 'orcWarlord'],
};
const monstersFor = (level) => (opt('monsters', null) ? opt('monsters').split(',') : MONSTERS[Math.min(5, Math.max(1, level))] || MONSTERS[5]);

// ---- The pieces both sides use ---------------------------------------------------------------------------------------
function load() {
  const B = require(path.join(__dirname, '..', 'tests', 'load.js'));
  const L = require('./lib');
  const Metrics = require('./metrics');
  const { gear } = require('./grow');
  return { B, L, Metrics, gear };
}

// Apply a change to a character. 'lab': a feat the hero's skills do not open, given with the skills and feats it needs
// (a lab hero: the worth of the feat and of opening it, not what it costs).
function apply(env, c, change) {
  const { B } = env, { Character: C, DATA, CONFIG } = B;
  if (!change) return;
  if (change.kind === 'feat+') C.addFeat(c, change.id);
  else if (change.kind === 'feat-') C.removeFeat(c, change.id);
  else if (change.kind === 'attr') c.base[change.id] += 1;
  else if (change.kind === 'skill') C.raiseSkill(c, change.id);
  else if (change.kind === 'lab') {
    const grant = (id, depth) => {
      const f = DATA.FEATS[id];
      if (!f || depth > 6 || C.rank(c, id) >= f.ranks.length) return;
      const sk = C.featSkill(f), need = CONFIG.skills.tiers[f.ranks[C.rank(c, id)]] || 0;
      if (sk && C.skill(c, sk) < need) c.skills[sk] = need;
      for (const group of f.requires) {
        const first = group.find((r) => C.reqMet(c, r)) || group[0], r = C.parseReq(first);
        if (r.skill) { if (C.skill(c, r.skill) < r.rank) c.skills[r.skill] = r.rank; } else while (C.rank(c, r.id) < r.rank) grant(r.id, depth + 1), C.rank(c, r.id) < r.rank && C.addFeat(c, r.id);
      }
      C.addFeat(c, id);
    };
    grant(change.id, 0);
  }
}

// A hero as planned, then the change. Returns a fresh character.
function makeHero(env, name, level, change) {
  const { B, gear } = env, { World, Character: C } = B;
  const spec = World.heroes().find((h) => h.name === name);
  const s = gear(World.settle(spec, level), level);
  const w = World.create([s], { log: false });
  World.loadSupplies(w); // the bandages and arrows start in the party's pool; a fight deals them out (an archer needs his)
  const c = World.party(w)[0];
  c.policy = undefined;
  apply(env, c, change);
  c.stamina = C.maxStamina(c);
  return c;
}

// What a hero could change: every auto feat of the body, combat and magic groups it holds a rank of or could take.
function changesFor(env, name, level) {
  const { B, gear } = env, { World, Character: C, DATA } = B;
  const spec = World.heroes().find((h) => h.name === name);
  const c = World.party(World.create([gear(World.settle(spec, level), level)], { log: false }))[0];
  const out = [];
  if (!has('no-feats')) {
    for (const f of Object.values(DATA.FEATS)) {
      const tree = DATA.TREES.find((t) => t.id === f.tree);
      const groups = ['body', 'combat', 'magic'], also = (opt('also', '') || '').split(',');
      if (!tree || !(groups.includes(tree.group) || also.includes(tree.id)) || f.auto === false) continue;
      if (has('attrs') && f.attr) continue; // Conditioning is +1 to an attribute: --attrs measures that, once
      if (FEAT_ONLY && !FEAT_ONLY.split(',').includes(f.id)) continue;
      if (has('lab')) { if (C.rank(c, f.id) < f.ranks.length && !C.canTakeFeat(c, f.id, true).ok) out.push({ kind: 'lab', id: f.id, label: '+lab ' + f.id }); continue; }
      if (C.rank(c, f.id) > 0 && C.canRemoveFeat(c, f.id).ok) out.push({ kind: 'feat-', id: f.id, label: '-' + f.id + (f.ranks.length > 1 ? ' ' + C.rank(c, f.id) : '') });
      if (C.canTakeFeat(c, f.id, true).ok) out.push({ kind: 'feat+', id: f.id, label: '+' + f.id + (f.ranks.length > 1 ? ' ' + (C.rank(c, f.id) + 1) : '') });
    }
  }
  if (has('attrs')) for (const a of ['STR', 'CON', 'DEX', 'SPD', 'INT', 'WIL', 'WIS', 'CHA']) out.push({ kind: 'attr', id: a, label: '+' + a });
  if (has('skills')) {
    for (const id of Object.keys(B.Content.world.skills.skills)) if (C.canRaiseSkill({ skills: c.skills, level: 99 }, id).ok) out.push({ kind: 'skill', id, label: '+skill ' + id });
  }
  return out;
}

// ---- A duel run: one hero (with a change) against every foe, n seeds each -------------------------------------------
async function duels(env, name, level, change) {
  const { B, L, Metrics } = env;
  const foes = [];
  for (const h of B.World.heroes().filter((x) => ['Beren', 'Cyrus', 'Lorc', 'Jabiku'].includes(x.name) && x.name !== name)) foes.push({ hero: h.name });
  for (const m of monstersFor(level)) foes.push({ monster: m });
  const M = Metrics.create();
  const wins = [], deaths = [], rounds = [], taken = [], dealt = [];
  // Harm: attribute points lost, plus the share of fresh stamina gone (up to one more point), at the fight's end.
  const harm = (c) => Object.values(c.damage || {}).reduce((t, x) => t + x, 0) + (B.Character.maxStamina(c) > 0 ? 1 - Math.max(0, c.stamina) / B.Character.maxStamina(c) : 0);
  let k = 0;
  for (const f of foes) {
    for (let i = 0; i < N; i++, k++) {
      const A = makeHero(env, name, level, change);
      const Bc = f.hero ? makeHero(env, f.hero, level, null) : B.Enemies.makeMonster(f.monster, {})[0];
      const r = await L.fight({
        A: [A], B: [Bc], grid: { w: 12, h: 6 }, seed: SEED + k, maxRounds: 30,
        watch: (enc) => M.watch(enc, { [A.id]: A, [Bc.id]: Bc }, [A.id]),
      });
      wins.push(r.winner === 'A' ? 1 : r.winner === 'B' ? 0 : 0.5);
      deaths.push(r.deadA); rounds.push(r.rounds); taken.push(harm(A)); dealt.push(harm(Bc));
    }
  }
  const s = Metrics.summary(M);
  return { wins, deaths, rounds, taken, dealt, med: s.medianRounds, half: s.half, collapsed: s.hero.collapses / (s.fights || 1) };
}

// ---- A crawl run: a party of those heroes, the hero with the change, n crawls ---------------------------------------
async function crawl(env, place, partyNames, name, level, change) {
  const { B, Metrics } = env;
  const { World, Battle, Auto, Explore, Character: C, Rand, Content } = B;
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const open = (w) => {
    const g = Explore.here(w), out = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const d = g.legend[g.rows[y][x]]; if (d && d.kind === 'monster' && !Explore.state(w, x, y).done) out.push({ x, y, def: d }); }
    return out.sort((a, b) => cheb(a, w.explore) - cheb(b, w.explore));
  };
  const cleared = [], dead = [], fights = [];
  for (let i = 0; i < N; i++) {
    Rand.seed(SEED + i);
    const specs = partyNames.map((n) => B.World.heroes().find((h) => h.name === n)).map((h) => env.gear(World.settle(h, level), level));
    const w = World.create(specs, { log: false });
    const hero = World.party(w).find((c) => c.name === name);
    if (hero && change) { apply(env, hero, change); hero.stamina = C.maxStamina(hero); }
    Explore.enter(w, place, Explore.findChar(place, '<') ? '<' : 'S');
    let ok = true, nd = 0, nf = 0;
    for (;;) {
      const t = open(w)[0];
      if (!t) break;
      const before = World.party(w).filter((c) => c.status.dead).length;
      Battle.start(w, Object.assign({ name: t.def.label }, Explore.encounterSpec(w, t.def)), { ctx: { x: t.x, y: t.y, back: true } });
      await Auto.battle(w, { maxRounds: 40 });
      const out = Battle.finish(w);
      nf++; nd += World.party(w).filter((c) => c.status.dead).length - before;
      if (out.result !== 'won' || !World.living(w).length) { ok = false; break; }
      World.restAndRepair(w);
      w.explore.x = t.x; w.explore.y = t.y;
    }
    cleared.push(ok ? 1 : 0); dead.push(nd); fights.push(nf);
  }
  return { wins: cleared, deaths: dead, rounds: fights, taken: [], dealt: [], med: null, half: null, collapsed: null, crawl: true };
}

// ---- Worker: one task, JSON out ---------------------------------------------------------------------------------------
async function runTask(task) {
  const env = load();
  const r = CRAWL ? await crawl(env, CRAWL, task.party, task.hero, task.level, task.change) : await duels(env, task.hero, task.level, task.change);
  return r;
}

if (process.env.FEATS_TASK) {
  runTask(JSON.parse(process.env.FEATS_TASK)).then((r) => { process.stdout.write('\n@@' + JSON.stringify(r) + '\n'); }).catch((e) => { console.error(e); process.exit(1); });
} else {
  // ---- Parent: lay out the tasks, run them JOBS at a time, report ------------------------------------------------------
  const env = load();
  const tasks = [];
  const heroes = CRAWL ? [HEROES[0]] : HEROES;
  const partyNames = CRAWL ? opt('party', 'Beren,Cyrus,Lorc').split(',') : null;
  for (const h of (CRAWL ? [opt('hero', partyNames[0])] : heroes)) {
    tasks.push({ hero: h, level: LEVEL, change: null, party: partyNames, base: true });
    for (const ch of changesFor(env, h, LEVEL)) tasks.push({ hero: h, level: LEVEL, change: ch, party: partyNames });
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const results = new Array(tasks.length);
  let next = 0, doneN = 0;
  const run = (t) => new Promise((resolve) => {
    const args = process.argv.slice(1);
    execFile(process.execPath, ['--max-old-space-size=3000', ...args], { env: Object.assign({}, process.env, { FEATS_TASK: JSON.stringify(t) }), maxBuffer: 1 << 26 }, (err, out, errout) => {
      if (err) { resolve({ error: String(errout || err).slice(0, 300) }); return; }
      const m = out.split('\n@@')[1];
      resolve(m ? JSON.parse(m) : { error: 'no result' });
    });
  });
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await run(tasks[i]);
      process.stderr.write(`\r${++doneN}/${tasks.length} `);
    }
  };
  Promise.all(Array.from({ length: Math.min(JOBS, tasks.length) }, worker)).then(() => {
    process.stderr.write('\n');
    const f1 = (x) => x.toFixed(1), pc = (x) => Math.round(100 * x);
    const jsonOut = opt('json', null);
    const unit = CRAWL ? `crawls of ${CRAWL}, party ${partyNames.join(', ')}` : `fights (${N} seeds a foe)`;
    console.log(`Level ${LEVEL}, ${unit}; seed ${SEED}. "Δ" is the change in ${CRAWL ? 'places cleared' : 'win rate'} from the hero as planned, in points, ± the standard error of the paired difference.\n`);
    for (const h of CRAWL ? [tasks[0].hero] : heroes) {
      const idx = tasks.map((t, i) => (t.hero === h ? i : -1)).filter((i) => i >= 0);
      const base = results[idx.find((i) => tasks[i].base)];
      if (!base || base.error) { console.log(`${h}: baseline failed ${base && base.error}`); continue; }
      console.log(`${h} as planned: ${CRAWL ? 'cleared' : 'win rate'} ${pc(mean(base.wins))}% of ${base.wins.length}` + (base.crawl ? `; heroes dead a crawl ${f1(mean(base.deaths))}` : `; median rounds ${base.med}, heroes dead a fight ${f1(mean(base.deaths))}, collapses a fight ${f1(base.collapsed)}`));
      const rows = [];
      for (const i of idx) {
        if (tasks[i].base) continue;
        const r = results[i];
        if (r.error) { rows.push({ label: tasks[i].change.label, err: r.error }); continue; }
        const d = r.wins.map((x, j) => x - base.wins[j]);
        const md = mean(d), sd = Math.sqrt(mean(d.map((x) => (x - md) ** 2)) * d.length / Math.max(1, d.length - 1));
        rows.push({ label: tasks[i].change.label, kind: tasks[i].change.kind, delta: 100 * md, se: 100 * sd / Math.sqrt(d.length), win: pc(mean(r.wins)), dead: mean(r.deaths) - mean(base.deaths), rounds: r.crawl ? mean(r.rounds) : mean(r.rounds) - mean(base.rounds), taken: r.crawl ? 0 : mean(r.taken) - mean(base.taken), dealt: r.crawl ? 0 : mean(r.dealt) - mean(base.dealt), half: r.half != null ? r.half - base.half : null });
        if (jsonOut) require('fs').appendFileSync(jsonOut, JSON.stringify({ sim: 'feats', hero: h, level: LEVEL, crawl: CRAWL, n: N, seed: SEED, change: tasks[i].change, base: mean(base.wins), win: mean(r.wins), delta: md, se: sd / Math.sqrt(d.length), deadDelta: mean(r.deaths) - mean(base.deaths) }) + '\n');
      }
      rows.sort((a, b) => (b.delta || 0) - (a.delta || 0));
      console.log('  change'.padEnd(34) + 'Δ win'.padEnd(14) + 'win'.padEnd(6) + 'Δ dead/fight'.padEnd(14) + (CRAWL ? 'fights' : 'Δ rounds'.padEnd(10) + 'Δ harm taken'.padEnd(14) + 'Δ harm dealt'));
      for (const r of rows) {
        if (r.err) { console.log('  ' + r.label.padEnd(32) + 'ERROR ' + r.err.split('\n')[0]); continue; }
        const sig = Math.abs(r.delta) > 2 * r.se ? '*' : ' ';
        console.log(('  ' + r.label).padEnd(34) + `${r.delta >= 0 ? '+' : ''}${f1(r.delta)} ±${f1(r.se)}${sig}`.padEnd(14) + (r.win + '%').padEnd(6) + `${r.dead >= 0 ? '+' : ''}${r.dead.toFixed(2)}`.padEnd(14) + (CRAWL ? f1(r.rounds) : (r.rounds >= 0 ? '+' : '') + r.rounds.toFixed(2).padEnd(10 - (r.rounds >= 0 ? 1 : 0)) + ((r.taken >= 0 ? '+' : '') + r.taken.toFixed(2)).padEnd(14) + (r.dealt >= 0 ? '+' : '') + r.dealt.toFixed(2)));
      }
      console.log('');
    }
  });
}
