#!/usr/bin/env node
/*
 * Broad simulation sweep against the design targets.
 *
 *   node sim/run.js                     full sweep, default sample sizes
 *   node sim/run.js --n 60              smaller samples (faster)
 *   node sim/run.js --only length,gap   run some scenarios
 *   node sim/run.js --set defense.parry.tn=5 --set bleedRounds=4
 *                                       override any CONFIG value for this run
 *   node sim/run.js --out sim/results/try1
 *
 * Writes report.md and summary.csv (one row per measured value) to the output
 * directory. summary.csv is tidy and loads directly into R:
 *   read.csv("sim/results/summary.csv")
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const { C, CONFIG, build, series, pct } = L;
const TARGETS = require('./targets');

// ---- CLI ------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : dflt;
};
const N = Number(arg('n', 200));
const ONLY = arg('only', '') ? arg('only').split(',') : null;
const OUT = arg('out', path.join(__dirname, 'results'));
const overrides = [];
argv.forEach((a, i) => { if (a === '--set') overrides.push(argv[i + 1]); });
for (const o of overrides) {
  const [k, v] = o.split('=');
  const keys = k.split('.');
  let obj = CONFIG;
  for (const key of keys.slice(0, -1)) obj = obj[key];
  obj[keys[keys.length - 1]] = JSON.parse(v);
}

const OPEN = { w: 8, h: 5 };
const CORRIDOR = { w: 7, h: 1 };
const LEVELS = [1, 4, 8];
const rows = []; // tidy summary rows
const sections = [];

function record(scenario, condition, metric, value, target, pass) {
  rows.push({ scenario, condition, metric, value, target: target || '', verdict: pass == null ? 'info' : pass ? 'pass' : 'FAIL' });
}

function table(head, body) {
  return ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|']
    .concat(body.map((r) => '| ' + r.join(' | ') + ' |')).join('\n');
}

const mk = (arch, level, extra) => () => build(arch, Object.assign({ level }, extra || {}));

// ---- Scenarios ------------------------------------------------------------
const SCENARIOS = {};

// Fights between rough equals end quickly at every level; how often do both die?
SCENARIOS.length = async () => {
  const T = TARGETS.length;
  const out = [];
  for (const arch of ['militia', 'duelist', 'sellsword', 'knight', 'heavy', 'brute']) {
    for (const lvl of LEVELS) {
      for (const [gname, grid] of [['open', OPEN], ['corridor', CORRIDOR]]) {
        const s = await series(N, mk(arch, lvl), mk(arch, lvl), grid, { seed: 1 });
        const pass = s.medianRounds <= T.medianRoundsMax;
        record('length', `${arch} L${lvl} ${gname}`, 'median_rounds', s.medianRounds, `≤ ${T.medianRoundsMax}`, pass);
        record('length', `${arch} L${lvl} ${gname}`, 'p90_rounds', s.p90Rounds);
        record('length', `${arch} L${lvl} ${gname}`, 'draw_rate', s.draw);
        record('length', `${arch} L${lvl} ${gname}`, 'deaths_per_fight', s.deathRate);
        out.push([arch, 'L' + lvl, gname, s.medianRounds + (pass ? '' : ' ✗'), s.p90Rounds, pct(s.draw), pct(s.timeout), s.deathRate.toFixed(2)]);
      }
    }
  }
  return {
    title: 'Fight length between equals',
    question: 'Philosophy: "Fights between rough equals end quickly at every level." Specifics: fight length at early vs late level; how often mutual kills happen.',
    body: `Mirror matches, ${N} fights each. Target: median ≤ ${T.medianRoundsMax} rounds. A draw is both sides down at once.\n\n` +
      table(['Build', 'Level', 'Ground', 'Median rounds', '90th pct', 'Draws', 'Timeouts', 'Deaths/fight'], out),
  };
};

// Armor is king: heavy armor in a confined space beats unarmored across a level gap.
SCENARIOS.gap = async () => {
  const T = TARGETS.gap;
  const out = [];
  for (const armored of ['heavy', 'knight', 'sellsword']) {
    for (const foeLvl of [1, 4, 6, 8]) {
      for (const foe of ['duelist']) {
        for (const [gname, grid] of [['corridor', CORRIDOR], ['open', OPEN]]) {
          const s = await series(N, mk(armored, 1), mk(foe, foeLvl), grid, { seed: 7 });
          const graded = gname === 'corridor' && foeLvl >= T.gapLevel && armored !== 'sellsword';
          const pass = graded ? s.winA >= T.minWin : null;
          record('gap', `${armored} L1 vs ${foe} L${foeLvl} ${gname}`, 'armored_win', s.winA, graded ? `≥ ${pct(T.minWin)}` : '', pass);
          out.push([`${armored} L1`, `${foe} L${foeLvl}`, gname, pct(s.winA) + (pass === false ? ' ✗' : ''), s.medianRounds]);
        }
      }
    }
  }
  return {
    title: 'Armor across a level gap',
    question: 'Philosophy: "Heavy armor and a big weapon in a confined space beat an unarmored opponent across a large level gap."',
    body: `A level-1 armored fighter against an unarmored duelist of higher level. Graded: plate builds in the corridor against level ${T.gapLevel}+; target win rate ≥ ${pct(T.minWin)}.\n\n` +
      table(['Armored', 'Unarmored foe', 'Ground', 'Armored wins', 'Median rounds'], out),
  };
};

// 2v1 ends quickly for every build, including the armored heavy.
SCENARIOS.twoOnOne = async () => {
  const T = TARGETS.twoOnOne;
  const out = [];
  for (const solo of ['duelist', 'sellsword', 'knight', 'heavy', 'brute', 'brawler']) {
    for (const lvl of [4, 8]) {
      const s = await series(N, (i) => [build('sellsword', { level: lvl, name: 'sellsword A' }), build('sellsword', { level: lvl, name: 'sellsword B' })], () => [build(solo, { level: lvl })], OPEN, { seed: 11 })
        .catch((e) => { throw e; });
      const pass = s.winA >= T.pairMinWin && s.medianRounds <= T.medianRoundsMax;
      record('twoOnOne', `2 sellswords vs ${solo} L${lvl}`, 'pair_win', s.winA, `≥ ${pct(T.pairMinWin)}`, s.winA >= T.pairMinWin);
      record('twoOnOne', `2 sellswords vs ${solo} L${lvl}`, 'median_rounds', s.medianRounds, `≤ ${T.medianRoundsMax}`, s.medianRounds <= T.medianRoundsMax);
      out.push([solo, 'L' + lvl, pct(s.winA) + (s.winA >= T.pairMinWin ? '' : ' ✗'), s.medianRounds + (s.medianRounds <= T.medianRoundsMax ? '' : ' ✗'), s.deadA.toFixed(2)]);
    }
  }
  return {
    title: 'Two against one',
    question: 'Specifics: "Does 2v1 end quickly for every build, including the armored heavy?" Outline: numbers are a counter to the armored heavy.',
    body: `Two same-level sellswords against one fighter, open ground. Targets: pair wins ≥ ${pct(T.pairMinWin)}, median ≤ ${T.medianRoundsMax} rounds.\n\n` +
      table(['Lone fighter', 'Level', 'Pair wins', 'Median rounds', 'Pair deaths/fight'], out),
  };
};

// Stamina curve: rounds of all-out effort before a character can no longer attack.
function endurance(c, maxRounds) {
  const opts = () => C.attackOptions(c).filter((o) => !o.unarmed);
  for (let r = 1; r <= maxRounds; r++) {
    let ap = C.apPool(c);
    let acted = false;
    for (;;) {
      const choices = opts().filter((o) => o.ap <= ap && c.stamina > o.stamina);
      if (!choices.length) break;
      choices.sort((a, b) => b.damage.reduce((t, x) => t + x, 0) / b.ap - a.damage.reduce((t, x) => t + x, 0) / a.ap);
      const o = choices[0];
      ap -= o.ap;
      c.stamina -= o.stamina;
      acted = true;
    }
    if (!acted) return { rounds: r - 1, fatiguedAt: c.fatiguedAt || null };
    c.stamina = Math.max(0, Math.min(C.maxStamina(c), c.stamina + C.regen(c)));
    if (!c.fatiguedAt && C.fatiguePenalty(c) > 0) c.fatiguedAt = r;
  }
  return { rounds: maxRounds, fatiguedAt: c.fatiguedAt || null };
}

SCENARIOS.stamina = async () => {
  const T = TARGETS.stamina;
  const cases = [
    ['Unarmored L1 (sellsword stats, no armor)', 'sellsword', 1, { armor: null, shield: null }],
    ['Unarmored L5', 'sellsword', 5, { armor: null, shield: null }],
    ['Unarmored L8', 'sellsword', 8, { armor: null, shield: null }],
    ['Duelist L1', 'duelist', 1, {}],
    ['Duelist L5', 'duelist', 5, {}],
    ['Mail L1 (sellsword)', 'sellsword', 1, {}],
    ['Mail L5', 'sellsword', 5, {}],
    ['Plate + greatsword L1', 'heavy', 1, {}],
    ['Plate + greatsword L5', 'heavy', 5, {}],
    ['Plate + greatsword L8', 'heavy', 8, {}],
    ['Plate + longsword + heater L5', 'knight', 5, {}],
  ];
  const res = {};
  const out = [];
  for (const [label, arch, lvl, extra] of cases) {
    const c = build(arch, Object.assign({ level: lvl }, extra));
    const e = endurance(c, T.indefinite);
    res[label] = e.rounds;
    const fresh = build(arch, Object.assign({ level: lvl }, extra));
    out.push([label, C.maxStamina(fresh), (C.regen(fresh) >= 0 ? '+' : '') + C.regen(fresh), C.apPool(fresh), e.rounds >= T.indefinite ? `${T.indefinite}+` : e.rounds, e.fatiguedAt || '—']);
    record('stamina', label, 'rounds_full_effort', e.rounds);
  }
  const v = [
    ['Early unarmored tires within a few rounds', res['Unarmored L1 (sellsword stats, no armor)'], `${T.earlyMin}–${T.earlyMax}`, res['Unarmored L1 (sellsword stats, no armor)'] >= T.earlyMin && res['Unarmored L1 (sellsword stats, no armor)'] <= T.earlyMax],
    ['Mid-level unarmored acts almost indefinitely', res['Unarmored L5'], `≥ ${T.midMin}`, res['Unarmored L5'] >= T.midMin],
    ['Armored tires much faster (plate L5 ≤ half of unarmored L5)', res['Plate + greatsword L5'], `≤ ${Math.floor(res['Unarmored L5'] / 2)}`, res['Plate + greatsword L5'] <= res['Unarmored L5'] / 2],
  ];
  for (const [t, val, tgt, pass] of v) record('stamina', t, 'rounds', val, tgt, pass);
  return {
    title: 'Stamina curve',
    question: 'Outline target curve: an unarmored mid-level character can act almost indefinitely; an early-level unarmored character tires within a few rounds; a fully armored character tires much faster. Specifics: how many rounds does plate + two-hander last?',
    body: `Each character spends every AP on its best attack each round with no one hitting back, regenerating at round end. "Rounds" = rounds until it can no longer afford any attack (capped at ${T.indefinite}).\n\n` +
      table(['Character', 'Max stamina', 'Regen', 'AP', 'Rounds of full effort', 'First fatigued'], out) + '\n\n' +
      table(['Target', 'Measured', 'Target', 'Verdict'], v.map(([t, val, tgt, pass]) => [t, val, tgt, pass ? 'pass' : '**FAIL**'])),
  };
};

// Is any build, weapon, armor or shield dominant?
async function roundRobin(name, entries, grid, n) {
  const keys = Object.keys(entries);
  const wins = {}, games = {};
  keys.forEach((k) => { wins[k] = 0; games[k] = 0; });
  const matrix = {};
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const s = await series(n, entries[keys[i]], entries[keys[j]], grid, { seed: 101 + i * 31 + j });
      matrix[keys[i] + '|' + keys[j]] = s.winA;
      matrix[keys[j] + '|' + keys[i]] = s.winB;
      wins[keys[i]] += s.winA * n; wins[keys[j]] += s.winB * n;
      games[keys[i]] += n; games[keys[j]] += n;
    }
  }
  const avg = {};
  keys.forEach((k) => (avg[k] = wins[k] / games[k]));
  return { keys, matrix, avg };
}

function matrixTable(rr) {
  const head = ['vs →'].concat(rr.keys).concat(['Avg win']);
  const body = rr.keys.map((a) => [a].concat(rr.keys.map((b) => (a === b ? '—' : pct(rr.matrix[a + '|' + b])))).concat([pct(rr.avg[a])]));
  return table(head, body);
}

SCENARIOS.builds = async () => {
  const T = TARGETS.dominance;
  const n = Math.max(30, Math.round(N / 2));
  const entries = {};
  for (const a of ['militia', 'duelist', 'sellsword', 'knight', 'heavy', 'brute', 'brawler']) entries[a] = mk(a, 4);
  let body = '';
  for (const [gname, grid] of [['open', OPEN], ['corridor', CORRIDOR]]) {
    const rr = await roundRobin('builds', entries, grid, n);
    for (const k of rr.keys) {
      const graded = !['knight', 'heavy'].includes(k);
      record('builds', `${k} L4 ${gname}`, 'avg_win', rr.avg[k], graded ? `≤ ${pct(T.maxAvgWin)}` : 'plate expected to lead', graded ? rr.avg[k] <= T.maxAvgWin : null);
    }
    body += `\n\n**${gname}** (${n} fights per pairing; row's win rate against column)\n\n` + matrixTable(rr);
  }
  return {
    title: 'Builds at equal level',
    question: 'Specifics: "Is any weapon, armor, or shield dominant across matchups?" Philosophy: armor is king in melee; speed wins elsewhere.',
    body: `Level-4 archetypes with equal attribute points. Plate builds are expected to lead in melee, so they are not graded; no other build should average above ${pct(T.maxAvgWin)}.` + body,
  };
};

SCENARIOS.weapons = async () => {
  const T = TARGETS.dominance;
  const n = Math.max(30, Math.round(N / 2));
  const feats = { toughness: 1, strength: 1, power_swing: 1, shield_training: 1, mail_mobility: 1, half_swording: 1 };
  const entries = {};
  for (const w of ['club', 'spikedMace', 'flangedMace', 'dagger', 'rapier', 'longsword', 'greatsword', 'warhammer']) {
    entries[w] = () => build('sellsword', { level: 4, weapon: w, shield: null, feats, sidearm: null });
  }
  let body = '';
  for (const [gname, grid] of [['vs mail, open', OPEN]]) {
    const rr = await roundRobin('weapons', entries, grid, n);
    for (const k of rr.keys) record('weapons', `${k} (mail, no shield)`, 'avg_win', rr.avg[k], `≤ ${pct(T.maxWeaponAvgWin)}`, rr.avg[k] <= T.maxWeaponAvgWin);
    body += `\n\n**Everyone in mail, no shield** (${n} fights per pairing)\n\n` + matrixTable(rr);
  }
  const plateEntries = {};
  for (const w of ['club', 'spikedMace', 'flangedMace', 'rapier', 'longsword', 'greatsword', 'warhammer']) {
    plateEntries[w] = () => build('heavy', { level: 4, weapon: w, shield: null, feats: { toughness: 1, strength: 1, power_swing: 1, plate_mobility: 1, half_swording: 1, plate_endurance: 1 }, sidearm: null });
  }
  const rr2 = await roundRobin('weapons-plate', plateEntries, OPEN, n);
  for (const k of rr2.keys) record('weapons', `${k} (plate, no shield)`, 'avg_win', rr2.avg[k]);
  body += `\n\n**Everyone in plate, no shield** (info: which weapons work against plate)\n\n` + matrixTable(rr2);
  return {
    title: 'Weapons',
    question: 'Specifics weapon budget: damage + reach should track AP, stamina and hands so no weapon dominates.',
    body: `Identical level-4 fighters (sellsword attributes, same six feats) differing only in weapon. Target: no weapon averages above ${pct(T.maxWeaponAvgWin)}.` + body,
  };
};

SCENARIOS.armor = async () => {
  const n = Math.max(30, Math.round(N / 2));
  const feats = { toughness: 1, strength: 1, shield_training: 1, power_swing: 1, half_swording: 1, quick_block: 0 };
  delete feats.quick_block;
  const entries = { none: () => build('sellsword', { level: 4, armor: null, feats }) };
  const ARMORS = { padded: ['padded'], leather: ['leather'], mail: ['mail'], steelMail: ['mail', 'full', { material: 'steel' }], plate: ['plate'] };
  for (const a of Object.keys(ARMORS)) entries[a] = () => build('sellsword', { level: 4, armor: ARMORS[a], feats });
  const rr = await roundRobin('armor', entries, OPEN, n);
  for (const k of rr.keys) record('armor', k + ' (untrained)', 'avg_win', rr.avg[k]);
  // Trained: each wearer spends two feats on its armor (others take generic feats).
  const train = { none: { toughness: 2 }, padded: { light_armor_training: 1, toughness: 2 }, leather: { light_armor_training: 1, toughness: 2 },
    mail: { mail_mobility: 1, mail_endurance: 1 }, steelMail: { mail_mobility: 1, mail_endurance: 1 }, plate: { plate_mobility: 2 } };
  const trained = {};
  for (const k of Object.keys(entries)) {
    const f = Object.assign({ strength: 1, shield_training: 1, power_swing: 1, half_swording: 1 }, train[k]);
    trained[k] = () => build('sellsword', { level: 4, armor: k === 'none' ? null : ARMORS[k], feats: f });
  }
  const rt = await roundRobin('armor-trained', trained, OPEN, n);
  for (const k of rt.keys) record('armor', k + ' (trained)', 'avg_win', rt.avg[k]);
  const order = ['none', 'padded', 'leather', 'mail', 'steelMail', 'plate'];
  const mono = order.every((k, i) => i === 0 || rt.avg[k] >= rt.avg[order[i - 1]] - 0.05);
  record('armor', 'heavier armor wins more when trained (within 5 points)', 'monotonic', mono ? 1 : 0, 'true', mono);
  const shields = { none: () => build('sellsword', { level: 4, shield: null, feats }) };
  for (const s of ['buckler', 'round', 'heater', 'tower']) shields[s] = () => build('sellsword', { level: 4, shield: [s, 'wood'], feats });
  const rs = await roundRobin('shields', shields, OPEN, n);
  for (const k of rs.keys) record('shields', k, 'avg_win', rs.avg[k]);
  return {
    title: 'Armor and shields',
    question: 'Philosophy: better gear is better; full plate is exceedingly good. Specifics: is any armor or shield dominant?',
    body: `Identical level-4 longsword fighters with a wooden round shield, differing only in armor; then identical mail-wearers differing only in wooden shield. "Trained" wearers spend two feats on their armor (Plate Mobility II, Mail Mobility + Endurance, and so on). Heavier armor should win more when trained (graded: ${mono ? 'pass' : '**FAIL**'}).\n\n**Armor, trained** (${n} per pairing)\n\n` +
      matrixTable(rt) + `\n\n**Armor, untrained** (no armor feats)\n\n` + matrixTable(rr) + `\n\n**Shields** (${n} per pairing)\n\n` + matrixTable(rs),
  };
};

// Feint vs Read Attack: is Read Attack effectively mandatory?
SCENARIOS.feint = async () => {
  const T = TARGETS.feint;
  const base = { quick_thrust: 2, parry_training: 2, precision: 1, dodge_training: 1 };
  const feinter = () => build('duelist', { level: 6, feats: Object.assign({ feint: 3 }, base, { agility: 1 }) });
  const blind = () => build('duelist', { level: 6, feats: Object.assign({}, base, { riposte: 1, quick_parry: 1, light_touch: 1, agility: 1 }) });
  const reader = () => build('duelist', { level: 6, feats: Object.assign({ read_attack: 3 }, base, { agility: 1 }) });
  const out = [];
  const a = await series(N, feinter, blind, OPEN, { seed: 21 });
  const b = await series(N, feinter, reader, OPEN, { seed: 21 });
  const gap = a.winA - b.winA;
  record('feint', 'Feint III vs no Read Attack', 'feinter_win', a.winA);
  record('feint', 'Feint III vs Read Attack III', 'feinter_win', b.winA);
  record('feint', 'gap', 'win_gap', gap, `≤ ${pct(T.maxGap)}`, gap <= T.maxGap);
  out.push(['Feint III vs no Read Attack', pct(a.winA)], ['Feint III vs Read Attack III', pct(b.winA)], ['Gap', pct(gap) + (gap <= T.maxGap ? '' : ' ✗')]);
  return {
    title: 'Feint and Read Attack',
    question: 'Specifics: "With Feint in play, how large is the win-rate gap for fighters with vs. without Read Attack? A large gap means the feat is effectively mandatory."',
    body: `Level-6 duelists with the same core feats. The opponent without Read Attack spends those 3 feats on other light-weapon feats. The AI only uses what it can see: a hidden strike is judged by the attacker's average option. Target gap ≤ ${pct(T.maxGap)}.\n\n` + table(['Matchup', 'Feinter wins'], out),
  };
};

// Does cheap kick spam for knockdowns dominate?
SCENARIOS.kick = async () => {
  const T = TARGETS.kick;
  const out = [];
  for (const arch of ['militia', 'sellsword', 'duelist', 'knight']) {
    const s = await series(N, () => build(arch, { level: 4, policy: { kickBias: 20 } }), mk(arch, 4), OPEN, { seed: 31 });
    record('kick', `${arch} L4 kicker vs normal`, 'kicker_win', s.winA, `≤ ${pct(T.maxWin)}`, s.winA <= T.maxWin);
    out.push([arch, pct(s.winA) + (s.winA <= T.maxWin ? '' : ' ✗'), s.medianRounds]);
  }
  return {
    title: 'Kick spam',
    question: 'Specifics: "Does cheap kick spam for knockdowns dominate?"',
    body: `Mirror matches where one side kicks whenever it can. Target: the kicker wins ≤ ${pct(T.maxWin)}.\n\n` + table(['Build', 'Kicker wins', 'Median rounds'], out),
  };
};

// Starting party vs the plate-and-tower prize.
SCENARIOS.party = async () => {
  const T = TARGETS.party;
  const out = [];
  const knight = () => build('knight', { level: 6, shield: ['tower', 'steel'] });
  for (const [label, size, rate] of [['3 starters', 3, 0.15], ['3 starters, grapple-heavy', 3, 0.5], ['4 starters', 4, 0.15], ['4 starters, grapple-heavy', 4, 0.5]]) {
    const party = () => {
      const list = [];
      for (let k = 0; k < size; k++) list.push(build(k % 2 ? 'militia' : 'brawler', { level: 1, name: 'starter ' + k, policy: { maneuverRate: rate } }));
      return list;
    };
    const s = await series(N, party, knight, OPEN, { seed: 41 });
    const pass = s.winA >= T.minWin && s.winA <= T.maxWin;
    record('party', label, 'party_win', s.winA, `${pct(T.minWin)}–${pct(T.maxWin)}`, pass);
    record('party', label, 'party_deaths', s.deadA);
    out.push([label, pct(s.winA) + (pass ? '' : ' ✗'), s.deadA.toFixed(2), s.medianRounds]);
  }
  return {
    title: 'Starting party against a plate-and-tower knight',
    question: 'Specifics: "Can a starting party (padded, wooden shields) beat a plate-and-tower-shield enemy with numbers, grapples, and knockdowns, and at what cost?" Philosophy: such an enemy is both deadly and a huge prize.',
    body: `Level-1 starters (alternating militia and brawler) against a level-6 knight in plate with a steel tower shield. Target: the party wins sometimes but not easily (${pct(T.minWin)}–${pct(T.maxWin)}).\n\n` +
      table(['Party', 'Party wins', 'Party deaths/fight', 'Median rounds'], out),
  };
};

// Does the stamina→AP fatigue link shorten or lengthen fights?
SCENARIOS.fatigue = async () => {
  const out = [];
  const saved = CONFIG.fatigueSteps;
  for (const arch of ['sellsword', 'knight', 'duelist']) {
    CONFIG.fatigueSteps = saved;
    const withF = await series(N, mk(arch, 4), mk(arch, 4), OPEN, { seed: 51 });
    CONFIG.fatigueSteps = [];
    const noF = await series(N, mk(arch, 4), mk(arch, 4), OPEN, { seed: 51 });
    CONFIG.fatigueSteps = saved;
    record('fatigue', arch, 'mean_rounds_with', withF.meanRounds);
    record('fatigue', arch, 'mean_rounds_without', noF.meanRounds);
    out.push([arch, withF.meanRounds.toFixed(2), noF.meanRounds.toFixed(2)]);
  }
  return {
    title: 'Fatigue and fight length',
    question: 'Specifics: "Does the stamina→AP fatigue link shorten or lengthen fights?"',
    body: 'Level-4 mirror matches with and without the fatigue AP penalty.\n\n' + table(['Build', 'Mean rounds with fatigue', 'Without'], out),
  };
};

// Philosophy: an unmitigated stab takes out anyone, at any level.
SCENARIOS.stab = async () => {
  const out = [];
  for (const lvl of LEVELS) {
    for (const [wname, arch] of [['dagger', 'brawler'], ['rapier', 'duelist']]) {
      const atk = build(arch, { level: 1 });
      const w = atk.weapons.find((x) => x.type === wname);
      atk.wield = w.id;
      const thrust = C.attackOptions(atk).find((o) => o.motion === 'thrust');
      const tgt = build('heavy', { level: lvl, armor: null });
      const h = L.Combat.computeHit(atk, tgt, thrust);
      const total = h.toCON * 2; // plus equal bleed
      const con = C.attr(tgt, 'CON');
      const pass = total >= con;
      record('stab', `${wname} thrust vs unarmored L${lvl}`, 'con_loss_with_bleed', total, `≥ CON ${con}`, pass);
      out.push([wname, 'L' + lvl, con, h.toCON, total + (pass ? '' : ' ✗')]);
    }
  }
  return {
    title: 'An unmitigated stab',
    question: 'Philosophy: "An unmitigated stab takes out anyone, at any level."',
    body: 'A level-1 attacker\'s thrust against an unarmored target of each level (the heavy build, which takes Toughness). The stab plus its untreated bleed should reach the target\'s CON.\n\n' +
      table(['Weapon', 'Target level', 'Target CON', 'CON from the hit', 'With bleed'], out),
  };
};

// ---- Main -----------------------------------------------------------------
(async () => {
  const t0 = Date.now();
  const names = ONLY || Object.keys(SCENARIOS);
  for (const name of names) {
    const t = Date.now();
    process.stderr.write(`running ${name}… `);
    const sec = await SCENARIOS[name]();
    sections.push(sec);
    process.stderr.write(`${((Date.now() - t) / 1000).toFixed(1)}s\n`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const graded = rows.filter((r) => r.verdict !== 'info');
  const fails = graded.filter((r) => r.verdict === 'FAIL');
  const md = [
    '# Simulation report',
    '',
    `Generated by \`node sim/run.js\`${argv.length ? ' `' + argv.join(' ') + '`' : ''}. ${N} fights per matchup unless noted. Total time ${((Date.now() - t0) / 1000).toFixed(0)} s.`,
    overrides.length ? `\nConfig overrides: ${overrides.map((o) => '`' + o + '`').join(', ')}` : '',
    '',
    'Fights are played by the built-in AI (src/rules/ai.js), which is simple. Treat win rates as evidence about the rules filtered through a mediocre player, not as balance truth. Thresholds live in sim/targets.js and are one reading of the design docs\' qualitative goals.',
    '',
    `**${graded.length - fails.length} of ${graded.length} graded checks pass.**`,
    fails.length ? '\nFailing:\n\n' + fails.map((f) => `- ${f.scenario} — ${f.condition}: ${f.metric} = ${typeof f.value === 'number' && f.value <= 1 && f.metric.includes('win') ? pct(f.value) : f.value} (target ${f.target})`).join('\n') : '',
    '',
  ].concat(sections.map((s) => `## ${s.title}\n\n*${s.question}*\n\n${s.body}\n`)).join('\n');
  fs.writeFileSync(path.join(OUT, 'report.md'), md);
  const csv = ['scenario,condition,metric,value,target,verdict'].concat(rows.map((r) =>
    [r.scenario, r.condition, r.metric, typeof r.value === 'number' ? +r.value.toFixed(4) : r.value, r.target, r.verdict].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))).join('\n');
  fs.writeFileSync(path.join(OUT, 'summary.csv'), csv + '\n');
  console.log(`${graded.length - fails.length}/${graded.length} graded checks pass. Report: ${path.relative(process.cwd(), path.join(OUT, 'report.md'))}`);
  for (const f of fails) console.log(`  FAIL ${f.scenario} — ${f.condition}: ${f.metric}=${typeof f.value === 'number' ? +f.value.toFixed(3) : f.value} (target ${f.target})`);
})();
