#!/usr/bin/env node
/*
 * A crawl: the tuning baseline (2026-11-09). A party walks into a place and fights its groups nearest first, on
 * the dungeon map as the game does (groups within earshot join), resting between fights and never retreating,
 * until the place is clear or the party is beaten. tools/tiers.js and tools/encounters.js fight each group fresh
 * and alone; this is what a player meets.
 *
 *   node sim/crawl.js <place> [<place>…] [--n 30] [--party 3] [--arrive '<'] [--seed 4242] [--set path=value …]
 *
 *   --party   heroes taken from start.yaml's presets (picked at random when fewer than all)
 *   --arrive  the map letter the party comes in at (default '<', or 'S' where a map has none)
 *   --set     try a rule number without editing it: --set apCurve.knee=3 --set weaponPhysics.pointDamage=0.18
 *             (a path into CONFIG)
 *
 * Reports how often the place is cleared, each fight in turn (reached, won, foes with joiners, rounds, heroes
 * dead), and what landed and what killed: the action and location of each blow, read from the fight log.
 */
'use strict';
const path = require('path');
const B = require(path.join(__dirname, '..', 'tests', 'load.js'));
const { World, Battle, Auto, Rand, Content, Explore, CONFIG } = B;

const argv = process.argv.slice(2);
const flags = {}, sets = [], places = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--set') sets.push(argv[++i]);
  else if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i];
  else places.push(argv[i]);
}
const N = Number(flags.n || 30), SIZE = Number(flags.party || 3), SEED = Number(flags.seed || 4242);
if (!places.length) { console.error('usage: node sim/crawl.js <place> [--n 30] [--party 3] [--arrive <] [--set path=value]'); process.exit(1); }

for (const s of sets) {
  const [p, raw] = s.split('=');
  const keys = p.split('.');
  let o = CONFIG;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys[keys.length - 1]] = isNaN(Number(raw)) ? raw : Number(raw);
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

async function crawl(place, tally) {
  const specs = World.presetParty();
  const pick = SIZE >= specs.length ? specs : specs.slice().sort(() => Rand.rng() - 0.5).slice(0, SIZE);
  const world = World.create(pick, { log: false });
  Explore.enter(world, place, flags.arrive || (Explore.findChar(place, '<') ? '<' : 'S'));
  for (let k = 1; ; k++) {
    const t = open(world)[0];
    if (!t) return true;
    Battle.start(world, Object.assign({ name: t.def.label }, Explore.encounterSpec(world, t.def)), { ctx: { x: t.x, y: t.y, back: true } });
    const enc = await Auto.battle(world, { maxRounds: 40 });
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
    if (out.result !== 'won' || !World.living(world).length) return false;
    f.won++;
    World.restAndRepair(world);
    world.explore.x = t.x; world.explore.y = t.y;
  }
}

(async () => {
  if (sets.length) console.log('with ' + sets.join(', '));
  for (const place of places) {
    if (!Content.world.places[place]) { console.error('no such place: ' + place); continue; }
    Rand.seed(SEED);
    const tally = { fights: {}, blows: 0, kills: 0, landed: {}, by: {}, killedBy: {} };
    let cleared = 0;
    for (let i = 0; i < N; i++) if (await crawl(place, tally)) cleared++;
    console.log(`${place}: party of ${SIZE}, cleared ${cleared}/${N}`);
    for (const [k, f] of Object.entries(tally.fights)) {
      console.log(`  fight ${String(k).padStart(2)}: reached ${String(f.n).padStart(3)}, won ${pct(f.won, f.n).padStart(4)}, foes ${(f.foes / f.n).toFixed(1)}, rounds ${(f.rounds / f.n).toFixed(1)}, heroes dead ${(f.dead / f.n).toFixed(2)}`);
    }
    console.log(`  blows landed ${tally.blows}, killing ${pct(tally.kills, tally.blows)}; landed on: ${share(tally.landed)}`);
    console.log(`  landed by: ${share(tally.by)}`);
    console.log(`  killed by: ${share(tally.killedBy)}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
