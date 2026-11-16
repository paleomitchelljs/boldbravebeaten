/*
 * Simulation helpers: controlled character builds and a headless fight runner
 * that drives the real rules engine (src/rules) with the AI policy.
 */
'use strict';
const B = require('../tests/load');
const { Character: C, Combat, Items, Enemies, AI, CONFIG } = B;
// A feat list that names a retired feat fails loudly in a sim (Enemies.chooseFeats skips it in the game).
Enemies.strict = true;

// Every feat and skill id a sim names must exist: throws with the ids that don't (docs/OVERHAUL.md step D).
function checkIds(where, feats, skills) {
  const SK = B.Content.world.skills.skills;
  const badF = [...new Set([].concat(feats || []))].filter((id) => !B.DATA.FEATS[id]);
  const badS = [...new Set([].concat(skills || []).flatMap((s) => (typeof s === 'string' ? [s] : Object.keys(s || {}))))].filter((id) => !SK[id]);
  if (badF.length || badS.length) throw new Error(`${where}: ${badF.length ? 'no such feat: ' + badF.join(', ') : ''}${badF.length && badS.length ? '; ' : ''}${badS.length ? 'no such skill: ' + badS.join(', ') : ''}`);
}

// ---- Builds ---------------------------------------------------------------
// Every archetype spends the same 35 attribute points, so level and gear are the only things that differ between
// equals. Skills and feats are a plan to grow by, as start.yaml's heroes have (World.growAlongPlan, step 9 of
// docs/PLAN.md): skills raised to each stage's ranks in order, then feats taken in order (the k-th mention of a feat is
// rank k), while the level's points last. Feat and skill ids are checked by tests/lib-sim.test.js, so a retired one
// fails loudly instead of being skipped (it was, until 2026-11-12).
const ARCHETYPES = {
  militia: {
    label: 'Militia (padded, round shield, club)',
    attrs: { STR: 5, CON: 5, DEX: 5, SPD: 5, INT: 5, WIS: 5, CHA: 5 },
    armor: ['padded', 'full'], shield: ['round', 'wood'], weapon: 'club', sidearm: 'dagger',
    skills: [{ melee: 3, block: 4, armor: 2 }, { block: 6, melee: 5, armor: 3 }, { melee: 7, block: 8 }],
    feats: ['quick_block', 'toughness', 'strength', 'light_armor_training', 'economical_block', 'heavy_hands', 'trip', 'quick_block', 'toughness'],
  },
  duelist: {
    label: 'Duelist (unarmored, rapier)',
    attrs: { STR: 4, CON: 5, DEX: 7, SPD: 6, INT: 5, WIS: 4, CHA: 4 },
    armor: null, shield: null, weapon: 'rapier', sidearm: 'dagger',
    skills: [{ melee: 5, evasion: 4, anticipation: 4, deception: 2 }, { melee: 7, evasion: 6, anticipation: 5 }, { melee: 9, evasion: 7, deception: 4 }],
    feats: ['quick_thrust', 'riposte', 'quick_parry', 'precision', 'feint', 'quick_thrust', 'find_the_gap', 'light_touch', 'agility', 'lunge'],
  },
  sellsword: {
    label: 'Sellsword (mail, longsword, round shield)',
    attrs: { STR: 6, CON: 6, DEX: 5, SPD: 5, INT: 4, WIS: 5, CHA: 4 },
    armor: ['mail', 'full'], shield: ['round', 'iron'], weapon: 'longsword', sidearm: 'dagger',
    skills: [{ melee: 4, block: 4, armor: 4 }, { melee: 6, block: 6, armor: 6 }, { melee: 8, block: 8, armor: 7 }],
    feats: ['mail_mobility', 'quick_block', 'mail_endurance', 'economical_block', 'half_swording', 'mail_mobility', 'toughness', 'strength', 'quick_parry'],
  },
  knight: {
    label: 'Knight (plate, longsword, heater)',
    attrs: { STR: 6, CON: 6, DEX: 5, SPD: 4, INT: 5, WIS: 5, CHA: 4 },
    armor: ['plate', 'full'], shield: ['heater', 'steel'], weapon: 'longsword', sidearm: 'dagger',
    skills: [{ melee: 4, block: 5, armor: 5 }, { block: 7, armor: 7, melee: 6 }, { block: 9, armor: 9, melee: 7 }],
    feats: ['plate_mobility', 'plate_endurance', 'quick_block', 'iron_stance', 'plate_mobility', 'half_swording', 'strength', 'toughness', 'plate_mobility'],
  },
  heavy: {
    label: 'Heavy (plate, greatsword)',
    attrs: { STR: 7, CON: 6, DEX: 4, SPD: 4, INT: 4, WIL: 5, WIS: 5, CHA: 5 },
    armor: ['plate', 'full'], shield: null, weapon: 'greatsword', sidearm: 'dagger',
    skills: [{ melee: 5, armor: 5, athletics: 1 }, { melee: 7, armor: 7 }, { melee: 9, armor: 8, athletics: 3 }],
    feats: ['power_swing', 'heavy_weapon_training', 'plate_mobility', 'weight_of_the_blow', 'plate_endurance', 'heavy_tempo', 'strength', 'toughness', 'plate_mobility'],
  },
  brute: {
    label: 'Brute (leather, warhammer)',
    attrs: { STR: 7, CON: 6, DEX: 5, SPD: 5, INT: 3, WIS: 5, CHA: 4 },
    armor: ['leather', 'full'], shield: null, weapon: 'warhammer', sidearm: null,
    skills: [{ melee: 5, armor: 3, athletics: 1 }, { melee: 7, armor: 4 }, { melee: 9, athletics: 3 }],
    feats: ['power_swing', 'heavy_weapon_training', 'weight_of_the_blow', 'strength', 'heavy_tempo', 'light_armor_training', 'crushing_blow', 'toughness'],
  },
  brawler: {
    label: 'Brawler (padded, grapples, dagger)',
    attrs: { STR: 6, CON: 6, DEX: 6, SPD: 5, INT: 4, WIS: 4, CHA: 4 },
    armor: ['padded', 'full'], shield: null, weapon: null, sidearm: 'dagger',
    skills: [{ melee: 4, athletics: 4, armor: 2 }, { athletics: 6, melee: 6 }, { athletics: 8, melee: 7 }],
    feats: ['trip', 'quick_hands', 'heavy_hands', 'pin', 'brawlers_wind', 'coup_de_grace', 'takedown', 'strength'],
    policy: { maneuverRate: 0.5 },
  },
};

// opts: { level, quality (a craft; old quality names work), feats (explicit {id: rank}), attrs (overrides),
//   armor [type, coverage, tags]/shield/weapon/offhand/sidearm overrides, name }. An archetype may also carry nouns.
function build(arch, opts) {
  opts = opts || {};
  const A = typeof arch === 'string' ? ARCHETYPES[arch] : arch;
  if (!A) throw new Error('sim/lib build: no such archetype: ' + arch);
  checkIds('sim/lib build ' + (opts.name || A.label || arch), opts.feats ? Object.keys(opts.feats) : A.feats, opts.feats ? (opts.skills ? [opts.skills] : []) : A.skills);
  const level = opts.level || 1;
  const q = opts.quality || 'average';
  const c = C.newCharacter({ name: opts.name || arch, starterGear: false, base: Object.assign({}, A.attrs, opts.attrs || {}) });
  c.level = level;
  const armor = opts.armor !== undefined ? opts.armor : A.armor;
  const shield = opts.shield !== undefined ? opts.shield : A.shield;
  const weapon = opts.weapon !== undefined ? opts.weapon : A.weapon;
  if (armor) c.armor = Items.makeArmor(armor[0], armor[1] || 'full', q, armor[2]);
  if (shield) c.shield = Items.makeShield(shield[0], shield[1] || 'wood', q);
  if (weapon) {
    const w = Items.makeWeapon(weapon, q);
    c.weapons.push(w);
    c.wield = w.id;
    if (G_WEAPON(weapon).hands === 2) c.shield = null;
  }
  const off = opts.offhand !== undefined ? opts.offhand : A.offhand;
  if (off) {
    const o = Items.makeWeapon(off, q);
    c.weapons.push(o);
    c.offhand = o.id;
  }
  const side = opts.sidearm !== undefined ? opts.sidearm : A.sidearm;
  if (side && side !== weapon) {
    const s = Items.makeWeapon(side, 'average');
    c.weapons.push(s);
    c.sidearm = s.id;
  }
  c.inventory.bandages = 1;
  if (A.nouns) c.nouns = A.nouns.slice();
  if (A.arrows) c.inventory.arrows = A.arrows;
  if (opts.feats) {
    // Explicit feats ({id: rank}) are held as given; skills are opts.skills, else the archetype's plan for the level
    // (until 2026-11-14 they were none, so a build with explicit feats fought at skill 0).
    for (const [id, r] of Object.entries(opts.feats)) if (r > B.DATA.FEATS[id].ranks.length) throw new Error(`sim/lib build: ${id} has ${B.DATA.FEATS[id].ranks.length} rank(s), not ${r}`);
    if (opts.skills) c.skills = Object.assign({}, opts.skills);
    else B.World.growAlongPlan(c, { skills: A.skills, feats: [] });
    c.feats = Object.fromEntries(Object.entries(opts.feats).filter(([, r]) => r > 0));
  } else {
    B.World.growAlongPlan(c, { skills: A.skills, feats: A.feats });
  }
  c.stamina = C.maxStamina(c);
  c.policy = Object.assign({}, A.policy || {}, opts.policy || {});
  return c;
}

function G_WEAPON(type) {
  return B.DATA.WEAPONS[type];
}

// ---- Fight runner ---------------------------------------------------------
function makeRoller(seed) {
  const rng = Enemies.makeRng(seed);
  return async (req) => {
    const out = [];
    for (let i = 0; i < req.count; i++) out.push(1 + Math.floor(rng() * req.sides));
    return out;
  };
}

// Place side A from the left edge and side B from the right, filling columns
// from the middle row outward.
function place(enc, idsA, idsB) {
  const h = enc.grid.h, w = enc.grid.w;
  const rows = [];
  const mid = Math.floor((h - 1) / 2);
  for (let k = 0; k < h; k++) rows.push(mid + (k % 2 ? Math.ceil(k / 2) : -k / 2));
  const fill = (ids, x0, dir) => ids.forEach((id, i) => {
    const col = x0 + dir * Math.floor(i / h);
    enc.pos[id] = { x: col, y: rows[i % h] };
  });
  fill(idsA, 0, 1);
  fill(idsB, w - 1, -1);
}

/*
 * fight({ A: [chars], B: [chars], grid: {w, h}, seed, maxBeats })
 * Characters are used as-is (pass fresh builds). Sides alternate which one is
 * listed first by seed, so ties and placement don't favor a side.
 */
async function fight(spec) {
  const seed = spec.seed || 1;
  const A = [].concat(spec.A), Bs = [].concat(spec.B);
  const chars = {};
  for (const c of A) { c.side = 'party'; chars[c.id] = c; }
  for (const c of Bs) { c.side = 'enemy'; chars[c.id] = c; }
  const flip = seed % 2 === 1;
  const ids = flip ? Bs.concat(A).map((c) => c.id) : A.concat(Bs).map((c) => c.id);
  const enc = Combat.createEncounter('sim', ids, chars, spec.grid.w, spec.grid.h);
  (spec.place || place)(enc, A.map((c) => c.id), Bs.map((c) => c.id));
  if (spec.setup) spec.setup(enc, chars);
  if (spec.onHit) enc.onHit = spec.onHit;
  // spec.watch(enc, chars) → { before(id)?, poll, end }: an observer (sim/metrics.js), told who acts before each action
  // and polled after it. It must not change the fight (tests/metrics-tempo.test.js).
  const watcher = spec.watch ? spec.watch(enc, chars) : null;
  const roller = makeRoller(seed * 2654435761 % 4294967296);
  const rng = Enemies.makeRng(seed * 40503 + 17);
  // A fight that runs past maxBeats beats (CONFIG.clock.beat ticks each) is a timeout. 20 beats is about the 30
  // rounds the old limit allowed (a round's AP was about 14 ticks of actions).
  const maxBeats = spec.maxBeats || 20;
  const stats = { hitsA: 0, hitsB: 0, firstBloodRound: null, collapses: 0 };
  await Combat.begin(enc, chars, roller);
  await play(enc, chars, roller, rng, watcher, maxBeats);
  for (let i = 0; i < enc.log.length; i++) {
    const t = enc.log[i].text || '';
    if (/ hits /.test(t)) {
      const actor = Object.values(chars).find((c) => t.startsWith(c.name + "'s"));
      if (actor) actor.side === 'party' ? stats.hitsA++ : stats.hitsB++;
    }
  }
  if (watcher) watcher.end();
  const down = (list) => list.filter((c) => !C.isActive(c)).length;
  const dead = (list) => list.filter((c) => c.status.dead).length;
  const winner = enc.phase !== 'over' ? 'timeout' : enc.winner === 'party' ? 'A' : enc.winner === 'enemy' ? 'B' : 'draw';
  return {
    winner, beats: beatsOf(enc), ticks: enc.now, downA: down(A), downB: down(Bs), deadA: dead(A), deadB: dead(Bs),
    hitsA: stats.hitsA, hitsB: stats.hitsB, log: spec.keepLog ? enc.log : null, enc: spec.keepEnc ? enc : null,
  };
}

// The beat a fight ended in (1 for one over inside the first beat): the measure fights are counted in.
function beatsOf(enc) {
  return Math.max(1, Math.ceil((enc.now || 0) / CONFIG.clock.beat));
}

// Drive a fight with the AI, one action at a time, until it is over or maxBeats beats have passed; the AI answers
// every reaction.
async function play(enc, chars, roller, rng, watcher, maxBeats) {
  const io = { roller };
  let guard = 20000;
  while (enc.phase === 'act' && enc.beat < (maxBeats || 20) && guard-- > 0) {
    const id = Combat.currentActor(enc);
    if (watcher && watcher.before) watcher.before(id);
    await Combat.submit(enc, chars, AI.choose(enc, chars, id, rng, chars[id].policy), io);
    if (watcher) watcher.poll();
  }
  if (guard <= 0) throw new Error('fight did not finish');
}

// Run n fights of a matchup; factories make fresh characters each time.
async function series(n, makeA, makeB, grid, opts) {
  opts = opts || {};
  const results = [];
  for (let i = 0; i < n; i++) {
    const seed = (opts.seed || 1000) + i;
    results.push(await fight({ A: makeA(i), B: makeB(i), grid, seed, maxBeats: opts.maxBeats }));
  }
  return summarize(results);
}

function summarize(results) {
  const n = results.length;
  const count = (f) => results.filter(f).length;
  const beats = results.map((r) => r.beats).sort((a, b) => a - b);
  const q = (p) => beats[Math.min(n - 1, Math.floor(p * n))];
  return {
    n,
    winA: count((r) => r.winner === 'A') / n,
    winB: count((r) => r.winner === 'B') / n,
    draw: count((r) => r.winner === 'draw') / n,
    timeout: count((r) => r.winner === 'timeout') / n,
    medianBeats: q(0.5), p90Beats: q(0.9),
    meanBeats: beats.reduce((t, x) => t + x, 0) / n,
    deathRate: results.reduce((t, r) => t + r.deadA + r.deadB, 0) / n,
    deadA: results.reduce((t, r) => t + r.deadA, 0) / n,
    deadB: results.reduce((t, r) => t + r.deadB, 0) / n,
    results,
  };
}

const pct = (x) => (100 * x).toFixed(0) + '%';

module.exports = { checkIds, B, C, Combat, Items, Enemies, AI, CONFIG, ARCHETYPES, build, fight, play, beatsOf, series, summarize, makeRoller, pct };
