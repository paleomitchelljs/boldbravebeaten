/*
 * Simulation helpers: controlled character builds and a headless fight runner
 * that drives the real rules engine (src/rules) with the AI policy.
 */
'use strict';
const B = require('../tests/load');
const { Character: C, Combat, Items, Enemies, AI, CONFIG } = B;

// ---- Builds ---------------------------------------------------------------
// Every archetype spends the same 35 attribute points, so level and gear are
// the only things that differ between equals.
const ARCHETYPES = {
  militia: {
    label: 'Militia (padded, round shield, club)',
    attrs: { STR: 5, CON: 5, DEX: 5, SPD: 5, INT: 5, WIS: 5, CHA: 5 },
    armor: ['padded', 'full'], shield: ['round', 'wood'], weapon: 'club', sidearm: 'dagger',
    feats: ['shield_training', 'toughness', 'quick_block', 'strength', 'light_armor_training', 'economical_block', 'heavy_hands', 'trip'],
  },
  duelist: {
    label: 'Duelist (unarmored, rapier)',
    attrs: { STR: 4, CON: 5, DEX: 7, SPD: 6, INT: 5, WIS: 4, CHA: 4 },
    armor: null, shield: null, weapon: 'rapier', sidearm: 'dagger',
    feats: ['quick_thrust', 'parry_training', 'precision', 'riposte', 'quick_parry', 'light_touch', 'feint', 'dodge_training', 'find_the_gap', 'agility'],
  },
  sellsword: {
    label: 'Sellsword (mail, longsword, round shield)',
    attrs: { STR: 6, CON: 6, DEX: 5, SPD: 5, INT: 4, WIS: 5, CHA: 4 },
    armor: ['mail', 'full'], shield: ['round', 'iron'], weapon: 'longsword', sidearm: 'dagger',
    feats: ['shield_training', 'mail_mobility', 'parry_training', 'mail_endurance', 'quick_block', 'half_swording', 'toughness', 'strength', 'economical_block'],
  },
  knight: {
    label: 'Knight (plate, longsword, heater)',
    attrs: { STR: 6, CON: 6, DEX: 5, SPD: 4, INT: 5, WIS: 5, CHA: 4 },
    armor: ['plate', 'full'], shield: ['heater', 'steel'], weapon: 'longsword', sidearm: 'dagger',
    feats: ['plate_mobility', 'shield_training', 'plate_endurance', 'quick_block', 'half_swording', 'strength', 'toughness', 'iron_stance', 'plate_mobility'],
  },
  heavy: {
    label: 'Heavy (plate, greatsword)',
    attrs: { STR: 7, CON: 6, DEX: 4, SPD: 4, INT: 4, WIS: 5, CHA: 5 },
    armor: ['plate', 'full'], shield: null, weapon: 'greatsword', sidearm: 'dagger',
    feats: ['power_swing', 'heavy_weapon_training', 'plate_mobility', 'weight_of_the_blow', 'plate_endurance', 'heavy_tempo', 'strength', 'half_swording', 'toughness'],
  },
  brute: {
    label: 'Brute (leather, warhammer)',
    attrs: { STR: 7, CON: 6, DEX: 5, SPD: 5, INT: 3, WIS: 5, CHA: 4 },
    armor: ['leather', 'full'], shield: null, weapon: 'warhammer', sidearm: null,
    feats: ['power_swing', 'heavy_weapon_training', 'weight_of_the_blow', 'strength', 'heavy_tempo', 'light_armor_training', 'crushing_blow', 'toughness'],
  },
  brawler: {
    label: 'Brawler (padded, grapples, dagger)',
    attrs: { STR: 6, CON: 6, DEX: 6, SPD: 5, INT: 4, WIS: 4, CHA: 4 },
    armor: ['padded', 'full'], shield: null, weapon: null, sidearm: 'dagger',
    feats: ['grappler', 'trip', 'quick_hands', 'heavy_hands', 'pin', 'grappler', 'takedown', 'coup_de_grace', 'brawlers_wind', 'strength'],
    policy: { maneuverRate: 0.5 },
  },
};

// opts: { level, quality, feats (explicit {id: rank}), attrs (overrides), armor/shield/weapon overrides, name }
function build(arch, opts) {
  opts = opts || {};
  const A = typeof arch === 'string' ? ARCHETYPES[arch] : arch;
  const level = opts.level || 1;
  const q = opts.quality || 'standard';
  const c = C.newCharacter({ name: opts.name || arch, starterGear: false, base: Object.assign({}, A.attrs, opts.attrs || {}) });
  c.level = level;
  const armor = opts.armor !== undefined ? opts.armor : A.armor;
  const shield = opts.shield !== undefined ? opts.shield : A.shield;
  const weapon = opts.weapon !== undefined ? opts.weapon : A.weapon;
  if (armor) c.armor = Items.makeArmor(armor[0], armor[1] || 'full', q);
  if (shield) c.shield = Items.makeShield(shield[0], shield[1] || 'wood', q);
  if (weapon) {
    const w = Items.makeWeapon(weapon, q);
    c.weapons.push(w);
    c.wield = w.id;
    if (G_WEAPON(weapon).hands === 2) c.shield = null;
  }
  const side = opts.sidearm !== undefined ? opts.sidearm : A.sidearm;
  if (side && side !== weapon) {
    const s = Items.makeWeapon(side, 'standard');
    c.weapons.push(s);
    c.sidearm = s.id;
  }
  c.inventory.bandages = 1;
  if (opts.feats) {
    c.feats = Object.assign({}, opts.feats);
  } else {
    // Deterministic feat choice: preference list only, then the generator's fill.
    Enemies.chooseFeats(c, A.feats, Enemies.makeRng(level * 7919 + 1));
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
 * fight({ A: [chars], B: [chars], grid: {w, h}, seed, maxRounds })
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
  place(enc, A.map((c) => c.id), Bs.map((c) => c.id));
  const roller = makeRoller(seed * 2654435761 % 4294967296);
  const rng = Enemies.makeRng(seed * 40503 + 17);
  const maxRounds = spec.maxRounds || 30;
  const stats = { hitsA: 0, hitsB: 0, firstBloodRound: null, collapses: 0 };
  while (enc.phase !== 'over' && enc.round < maxRounds) {
    await Combat.startRound(enc, chars, roller);
    const before = enc.log.length;
    await playRound(enc, chars, roller, rng);
    for (let i = before; i < enc.log.length; i++) {
      const t = enc.log[i].text || '';
      if (/ hits /.test(t)) {
        const actor = Object.values(chars).find((c) => t.startsWith(c.name + "'s"));
        if (actor) actor.side === 'party' ? stats.hitsA++ : stats.hitsB++;
      }
    }
  }
  const down = (list) => list.filter((c) => !C.isActive(c)).length;
  const dead = (list) => list.filter((c) => c.status.dead).length;
  const winner = enc.phase !== 'over' ? 'timeout' : enc.winner === 'party' ? 'A' : enc.winner === 'enemy' ? 'B' : 'draw';
  return {
    winner, rounds: enc.round, downA: down(A), downB: down(Bs), deadA: dead(A), deadB: dead(Bs),
    hitsA: stats.hitsA, hitsB: stats.hitsB, log: spec.keepLog ? enc.log : null,
  };
}

// Drive one round with the AI: turns, defense steps and pass resolution.
async function playRound(enc, chars, roller, rng) {
  let guard = 1000;
  while ((enc.phase === 'declare' || enc.phase === 'resolve') && guard-- > 0) {
    if (enc.phase === 'resolve') { await Combat.resolvePass(enc, chars, roller); continue; }
    const id = Combat.currentActor(enc);
    Combat.submit(enc, chars, AI.choose(enc, chars, id, rng, chars[id].policy));
  }
  if (guard <= 0) throw new Error('round did not finish');
}

// Run n fights of a matchup; factories make fresh characters each time.
async function series(n, makeA, makeB, grid, opts) {
  opts = opts || {};
  const results = [];
  for (let i = 0; i < n; i++) {
    const seed = (opts.seed || 1000) + i;
    results.push(await fight({ A: makeA(i), B: makeB(i), grid, seed, maxRounds: opts.maxRounds }));
  }
  return summarize(results);
}

function summarize(results) {
  const n = results.length;
  const count = (f) => results.filter(f).length;
  const rounds = results.map((r) => r.rounds).sort((a, b) => a - b);
  const q = (p) => rounds[Math.min(n - 1, Math.floor(p * n))];
  return {
    n,
    winA: count((r) => r.winner === 'A') / n,
    winB: count((r) => r.winner === 'B') / n,
    draw: count((r) => r.winner === 'draw') / n,
    timeout: count((r) => r.winner === 'timeout') / n,
    medianRounds: q(0.5), p90Rounds: q(0.9),
    meanRounds: rounds.reduce((t, x) => t + x, 0) / n,
    deathRate: results.reduce((t, r) => t + r.deadA + r.deadB, 0) / n,
    deadA: results.reduce((t, r) => t + r.deadA, 0) / n,
    deadB: results.reduce((t, r) => t + r.deadB, 0) / n,
    results,
  };
}

const pct = (x) => (100 * x).toFixed(0) + '%';

module.exports = { B, C, Combat, Items, Enemies, AI, CONFIG, ARCHETYPES, build, fight, playRound, series, summarize, makeRoller, pct };
