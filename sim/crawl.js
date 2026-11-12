#!/usr/bin/env node
/*
 * A crawl: the tuning baseline (2026-11-09). A party walks into a place and fights its groups nearest first, on
 * the dungeon map as the game does (groups within earshot join), resting between fights and never retreating,
 * until the place is clear or the party is beaten. tools/tiers.js and tools/encounters.js fight each group fresh
 * and alone; this is what a player meets.
 *
 *   node sim/crawl.js <place> [<place>…] [--n 30] [--party 3] [--arrive '<'] [--seed 4242] [--set path=value …] [--metrics]
 *
 *   --party   heroes taken from start.yaml's presets (picked at random when fewer than all)
 *   --arrive  the map letter the party comes in at (default '<', or 'S' where a map has none)
 *   --set     try a rule number without editing it: --set apCurve.knee=3 --set weaponPhysics.pointDamage=0.18
 *             (a path into CONFIG)
 *   --campaign the places as one run in the order given (a first area, then the next…): between places and after a
 *             beaten party, a night in town, the fallen recruited again at the party's level, the living trained along
 *             their start.yaml plans and kitted by the gear ladder (sim/grow.js); a beaten party tries a place again
 *             (--tries 3), the groups it beat staying beaten
 *   --metrics the tuning plan's metrics for each place (sim/metrics.js): rounds, deaths, stamina, collapses, wounds,
 *             blows by action and location
 *
 * Reports how often the place is cleared, each fight in turn (reached, won, foes with joiners, rounds, heroes dead so
 * far: the party's dead after that fight, counting earlier fights' too; --metrics counts each fight's own), and what
 * landed and what killed: the action and location of each blow, read from the fight log.
 */
'use strict';
const path = require('path');
const B = require(path.join(__dirname, '..', 'tests', 'load.js'));
const { World, Battle, Auto, Rand, Content, Explore, CONFIG, Combat } = B;
const Metrics = require('./metrics');
const { outfit } = require('./grow');

const argv = process.argv.slice(2);
const flags = {}, sets = [], places = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--set') sets.push(argv[++i]);
  else if (argv[i] === '--metrics') flags.metrics = true;
  else if (argv[i] === '--campaign') flags.campaign = true;
  else if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i];
  else places.push(argv[i]);
}
const TRIES = Number(flags.tries || 3);
const N = Number(flags.n || 30), SIZE = Number(flags.party || 3), SEED = Number(flags.seed || 4242);
if (!places.length) { console.error('usage: node sim/crawl.js <place> [--n 30] [--party 3] [--arrive <] [--set path=value]'); process.exit(1); }

for (const s of sets) {
  const [p, raw] = s.split('=');
  const keys = p.split('.');
  let o = CONFIG;
  for (const k of keys.slice(0, -1)) o = o[k];
  let v; try { v = JSON.parse(raw); } catch (e) { v = raw; } // numbers, null, true/false, {…}; else the text
  o[keys[keys.length - 1]] = v;
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const pct = (n, d) => (d ? Math.round((100 * n) / d) + '%' : '-');
const share = (o) => { const t = Object.values(o).reduce((a, b) => a + b, 0); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, t)}`).join(', ') || 'none'; };

// The groups still standing, nearest first.
function open(world) {
  const g = Explore.here(world), out = [];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const def = g.legend[g.rows[y][x]];
    if (def && def.kind === 'monster' && !Explore.state(world, x, y).done) out.push({ x, y, def });
  }
  return out.sort((a, b) => cheb(a, world.explore) - cheb(b, world.explore));
}

// Auto.battle with the metrics watching: the same loop, polled after each action.
async function watched(world, M, max) {
  const b = world.battle;
  const chars = Battle.table(world).characters;
  const w = M.watch(b.enc, chars, World.party(world).map((c) => c.id));
  while (b.enc.phase !== 'over' && b.enc.round < max) {
    Battle.reinforce(world);
    await Combat.startRound(b.enc, chars, B.Town.autoRoller);
    let guard = 2000;
    while (b.enc.phase === 'turn' && guard-- > 0) {
      const id = Combat.currentActor(b.enc);
      await Combat.submit(b.enc, chars, B.AI.choose(b.enc, chars, id, () => Rand.rng(), chars[id].policy), { roller: B.Town.autoRoller });
      w.poll();
    }
    if (guard <= 0) throw new Error('round did not finish');
  }
  w.end();
  return b.enc;
}

function party(n) {
  const specs = World.presetParty();
  return n >= specs.length ? specs : specs.slice().sort(() => Rand.rng() - 0.5).slice(0, n);
}
const arrival = (place) => flags.arrive || (Explore.findChar(place, '<') ? '<' : 'S');

async function crawl(place, tally) {
  const world = World.create(party(SIZE), { log: false });
  Explore.enter(world, place, arrival(place));
  return through(world, tally);
}

// Fight a place's groups, nearest first, from where the party stands, until it is clear (true) or the party is beaten.
async function through(world, tally, P) {
  for (let k = 1; ; k++) {
    const t = open(world)[0];
    if (!t) return true;
    const dead0 = World.party(world).filter((c) => c.status.dead).length;
    Battle.start(world, Object.assign({ name: t.def.label }, Explore.encounterSpec(world, t.def)), { ctx: { x: t.x, y: t.y, back: true } });
    const enc = tally.metrics ? await watched(world, tally.metrics, 40) : await Auto.battle(world, { maxRounds: 40 });
    const f = tally.fights[k] || (tally.fights[k] = { n: 0, won: 0, foes: 0, rounds: 0, dead: 0 });
    f.n++; f.foes += Object.keys(world.battle.foes).length; f.rounds += enc.round;
    for (const l of enc.log) {
      const text = String(l.text || l);
      const m = text.match(/'s ([A-Z][A-Za-z\- ()]+?) hits .*?→ on the (\w+)/);
      if (!m) continue;
      tally.blows++;
      tally.landed[m[2]] = (tally.landed[m[2]] || 0) + 1;
      tally.by[m[1]] = (tally.by[m[1]] || 0) + 1;
      if (/is DEAD/.test(text)) { tally.killedBy[m[1]] = (tally.killedBy[m[1]] || 0) + 1; tally.kills++; }
    }
    const out = Battle.finish(world);
    f.dead += World.party(world).filter((c) => c.status.dead).length;
    if (P) { P.fights++; P.dead += World.party(world).filter((c) => c.status.dead).length - dead0; }
    if (out.result !== 'won' || !World.living(world).length) return false;
    f.won++;
    World.restAndRepair(world);
    world.explore.x = t.x; world.explore.y = t.y;
  }
}

// ---- A campaign (--campaign): the places in the order given, as a player goes through them -------------------------
// Between places, and after a beaten party, the party goes to town (World's PROVISIONAL rule of 2026-11-09): a night
// at the inn (Town.sleep), every fallen hero recruited again at the party's level (World.respawnAll, grown along its
// plan), and the living trained along their own plans with the points their level gives (World.growAlongPlan) and
// kitted by the gear ladder (sim/grow.js). A beaten party goes back into the same place, the groups it beat still
// beaten, at most --tries times. XP is the game's (Battle.finish). Reported a place: reached, cleared, tries, the
// party's level coming in, each fight's own deaths, and the metrics with --metrics.
async function town(world) {
  World.respawnAll(world);
  await B.Town.sleep(world, 'inn');
  const specs = Object.fromEntries(World.heroes().filter((h) => h.id).map((h) => [h.id, h]));
  for (const [id, cid] of Object.entries(world.recruited || {})) {
    const c = world.chars[cid];
    if (!c || c.status.dead || !world.partyIds.includes(cid) || !specs[id]) continue;
    outfit(c, specs[id], c.level || 1);
    c.stamina = B.Character.maxStamina(c);
  }
}

async function campaign(tally) {
  const world = World.create(party(SIZE), { log: false });
  for (const c of World.party(world)) { const sp = World.heroes().find((h) => h.name === c.name); if (sp) outfit(c, sp, 1); }
  for (const place of places) {
    const P = tally.places[place] || (tally.places[place] = { reached: 0, cleared: 0, tries: 0, level: 0, dead: 0, fights: 0, metrics: tally.metricsOn ? Metrics.create() : null });
    P.reached++;
    P.level += Math.max(...World.party(world).map((c) => c.level || 1));
    let ok = false;
    for (let t = 1; t <= TRIES && !ok; t++) {
      P.tries++;
      Explore.enter(world, place, arrival(place));
      tally.metrics = P.metrics;
      ok = await through(world, tally, P);
      await town(world);
    }
    if (!ok) return place;
    P.cleared++;
  }
  return null;
}

(async () => {
  if (sets.length) console.log('with ' + sets.join(', '));
  if (flags.campaign) {
    Rand.seed(SEED);
    const tally = { fights: {}, blows: 0, kills: 0, landed: {}, by: {}, killedBy: {}, places: {}, metricsOn: !!flags.metrics, deaths: 0 };
    let done = 0;
    const stuck = {};
    for (let i = 0; i < N; i++) { const s = await campaign(tally); if (!s) done++; else stuck[s] = (stuck[s] || 0) + 1; }
    console.log(`campaign ${places.join(' → ')}: party of ${SIZE}, at most ${TRIES} tries a place; finished ${done}/${N}` + (Object.keys(stuck).length ? `; stopped at ${Object.entries(stuck).map(([k, v]) => k + ' ' + v).join(', ')}` : ''));
    for (const place of places) {
      const P = tally.places[place];
      if (!P) continue;
      console.log(`  ${place.padEnd(18)} reached ${String(P.reached).padStart(3)}, cleared ${String(P.cleared).padStart(3)}, tries ${(P.tries / P.reached).toFixed(2)} a party, level coming in ${(P.level / P.reached).toFixed(1)}, fights ${P.fights}, heroes dead a fight ${(P.dead / (P.fights || 1)).toFixed(2)}`);
      if (P.metrics) for (const l of Metrics.report(P.metrics, '    ')) console.log(l);
      if (flags.json) require('fs').appendFileSync(flags.json, JSON.stringify({ sim: 'campaign', place, party: SIZE, n: N, seed: SEED, sets, reached: P.reached, cleared: P.cleared, tries: P.tries, level: P.level / P.reached, dead: P.dead / (P.fights || 1), metrics: P.metrics ? Metrics.summary(P.metrics) : null }) + '\n');
    }
    console.log(`  killed by: ${share(tally.killedBy)}`);
    return;
  }
  for (const place of places) {
    if (!Content.world.places[place]) { console.error('no such place: ' + place); continue; }
    Rand.seed(SEED);
    const tally = { fights: {}, blows: 0, kills: 0, landed: {}, by: {}, killedBy: {}, metrics: flags.metrics ? Metrics.create() : null };
    let cleared = 0;
    for (let i = 0; i < N; i++) if (await crawl(place, tally)) cleared++;
    console.log(`${place}: party of ${SIZE}, cleared ${cleared}/${N}`);
    for (const [k, f] of Object.entries(tally.fights)) {
      console.log(`  fight ${String(k).padStart(2)}: reached ${String(f.n).padStart(3)}, won ${pct(f.won, f.n).padStart(4)}, foes ${(f.foes / f.n).toFixed(1)}, rounds ${(f.rounds / f.n).toFixed(1)}, heroes dead so far ${(f.dead / f.n).toFixed(2)}`);
    }
    console.log(`  blows landed ${tally.blows}, killing ${pct(tally.kills, tally.blows)}; landed on: ${share(tally.landed)}`);
    console.log(`  landed by: ${share(tally.by)}`);
    console.log(`  killed by: ${share(tally.killedBy)}`);
    if (tally.metrics) {
      for (const l of Metrics.report(tally.metrics)) console.log(l);
      console.log(`  cleared ${cleared}/${N}`);
      if (flags.json) require('fs').appendFileSync(flags.json, JSON.stringify({ sim: 'crawl', place, party: SIZE, n: N, seed: SEED, cleared, sets, metrics: Metrics.summary(tally.metrics) }) + '\n');
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
