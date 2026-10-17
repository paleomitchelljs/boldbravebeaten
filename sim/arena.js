#!/usr/bin/env node
/*
 * Arena: every armor class × fighting strategy against every other, in an open
 * field and in close quarters.
 *
 *   node sim/arena.js [--n 40] [--level 5] [--out sim/results/arena] [--set key=value ...]
 *
 * Writes arena.json (everything the results page needs), report.md and
 * matchups.csv (one row per pairing per arena, for R).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const { C, CONFIG, Items } = L;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('n', 40));
const LEVEL = Number(arg('level', 5));
const OUT = arg('out', path.join(__dirname, 'results', 'arena'));
argv.forEach((a, i) => {
  if (a !== '--set') return;
  const [k, v] = argv[i + 1].split('=');
  const keys = k.split('.');
  let o = CONFIG;
  for (const key of keys.slice(0, -1)) o = o[key];
  o[keys[keys.length - 1]] = JSON.parse(v);
});

const ARENAS = {
  open: { label: 'Open field', w: 20, h: 12 },
  close: { label: 'Close quarters', w: 6, h: 2 },
};

const ARMOR = {
  heavy: { label: 'Heavy', armor: 'plate', feats: ['plate_mobility', 'plate_mobility'] },
  medium: { label: 'Medium', armor: 'mail', feats: ['mail_mobility', 'mail_endurance'] },
  light: { label: 'Light', armor: 'leather', feats: ['light_armor_training'] },
  unarmored: { label: 'Unarmored', armor: null, feats: [] },
};

// Every strategy spends the same 35 attribute points.
const STRATEGY = {
  twoHanded: {
    label: 'Two-handed', attrs: { STR: 7, CON: 6, DEX: 5, SPD: 5, INT: 3, WIS: 5, CHA: 4 },
    weapon: 'greatsword', shield: null,
    feats: ['power_swing', 'heavy_weapon_training', 'weight_of_the_blow', 'heavy_tempo', 'heavy_weapon_training', 'weight_of_the_blow', 'strength', 'toughness'],
  },
  shield: {
    label: 'Sword & shield', attrs: { STR: 6, CON: 6, DEX: 5, SPD: 5, INT: 4, WIS: 5, CHA: 4 },
    weapon: 'longsword', shield: ['round', 'iron'],
    feats: ['shield_training', 'parry_training', 'shield_training', 'half_swording', 'quick_block', 'economical_block', 'toughness', 'strength'],
  },
  magic: {
    label: 'Magic', attrs: { STR: 4, CON: 5, DEX: 5, SPD: 5, INT: 8, WIS: 5, CHA: 3 },
    weapon: null, shield: null, nouns: ['fire', 'force'],
    feats: ['casting', 'verb_attack', 'mod_strong', 'verb_launch', 'casting', 'control', 'fire_affinity', 'quick_casting', 'casting'],
  },
  grappler: {
    label: 'Grappler', attrs: { STR: 7, CON: 6, DEX: 6, SPD: 5, INT: 3, WIS: 4, CHA: 4 },
    weapon: null, shield: null, policy: { grappler: true },
    // Works the clinch → hold → pin ladder with a dagger in the free hand.
    feats: ['grappler', 'pin', 'coup_de_grace', 'grappler', 'escape_artist', 'brawlers_wind', 'trip', 'takedown', 'toughness', 'strength'],
  },
  duelist: {
    label: 'Rapier & dagger', attrs: { STR: 5, CON: 5, DEX: 7, SPD: 7, INT: 3, WIS: 4, CHA: 4 },
    weapon: 'rapier', shield: null, offhand: 'parryingDagger',
    // A rapier with a parrying dagger in the off hand: thrusts, parries, ripostes.
    feats: ['parry_training', 'quick_thrust', 'parry_training', 'riposte', 'quick_parry', 'lunge', 'precision', 'economical_parry', 'toughness'],
  },
  archery: {
    label: 'Archery', attrs: { STR: 5, CON: 5, DEX: 7, SPD: 6, INT: 4, WIS: 4, CHA: 4 },
    weapon: 'longbow', shield: null, arrows: 20, bodkins: 10,
    // There are no archery feats in the design docs; archers take mobility and evasion.
    feats: ['fleet_foot', 'dodge_training', 'light_on_your_feet', 'fleet_foot', 'quickness', 'dodge_training', 'toughness'],
  },
};

function makeCombatant(armorKey, stratKey, side) {
  const A = ARMOR[armorKey], S = STRATEGY[stratKey];
  const c = C.newCharacter({ name: `${A.label} ${S.label} [${side}]`, starterGear: false, base: Object.assign({}, S.attrs) });
  c.level = LEVEL;
  if (A.armor) c.armor = Items.makeArmor(A.armor, 'full', 'standard');
  if (S.shield) c.shield = Items.makeShield(S.shield[0], S.shield[1], 'standard');
  if (S.weapon) {
    const w = Items.makeWeapon(S.weapon, 'standard');
    c.weapons.push(w);
    c.wield = w.id;
  }
  if (S.offhand) {
    const off = Items.makeWeapon(S.offhand, 'standard');
    c.weapons.push(off);
    c.offhand = off.id;
  }
  const d = Items.makeWeapon('dagger', 'standard');
  c.weapons.push(d);
  c.sidearm = d.id;
  if (!S.weapon) c.wield = d.id;
  c.inventory.arrows = S.arrows || 0;
  c.inventory.bodkins = S.bodkins || 0;
  c.inventory.bandages = 1;
  c.nouns = (S.nouns || []).slice();
  L.Enemies.chooseFeats(c, A.feats.concat(S.feats), L.Enemies.makeRng(1));
  c.stamina = C.maxStamina(c);
  c.policy = Object.assign({}, S.policy || {});
  return c;
}

// Magic users are left out for now (the user's call): the magic rules are a placeholder stub.
// Pass --with-magic to include them.
if (!argv.includes('--with-magic')) delete STRATEGY.magic;

const KEYS = [];
for (const a of Object.keys(ARMOR)) for (const s of Object.keys(STRATEGY)) KEYS.push(a + '/' + s);

// ---- Event counting from the fight log ---------------------------------------
const EVENTS = {
  // Tested against the text after the acting character's name.
  windUps: /^ winds up /, windLost: /^ loses the wind-up|^ lost the wind-up/, powerHits: /^'s Power swing .* hits /,
  shots: /^'s Shoot \(arrow\) /, shotHits: /^'s Shoot \(arrow\) hits /,
  spells: /^'s (Attack|Launch) \+ /, spellHits: /^'s (Attack|Launch) \+ .* hits /,
  noPower: /^ can't draw enough power/,
  closeHits: /^'s .*\((up close|cramped)/, tooClose: /^'s .* is too close\./, outOfReach: /^'s .* is out of reach\./,
  exhausted: /^ is too exhausted /, blocks: /^ blocks /, parries: /^ parries /, offParries: /^ catches on the parrying dagger /, dodges: /^ dodges /,
  hits: /^'s .* hits /, sidearmDraws: /^ (drops .* and )?draws Dagger/, readiesMain: /^ (drops .* and )?(readies|picks up) /, drops: /^ drops [^.]*\.$/,
  shieldsBroken: /^ blocks .*(BREAKS it|SHATTERS|is destroyed)/, shoves: /^ shoves /, shoveFails: /^'s shove fails/,
};

function countEvents(log, nameA, nameB) {
  const out = { A: {}, B: {} };
  for (const k of Object.keys(EVENTS).concat(['backlash'])) { out.A[k] = 0; out.B[k] = 0; }
  for (const l of log) {
    const t = l.text || '';
    if (t.startsWith('Backlash: ')) {
      const who = t.slice(10).startsWith(nameA) ? 'A' : 'B';
      out[who].backlash++;
      continue;
    }
    const side = t.startsWith(nameA) ? 'A' : t.startsWith(nameB) ? 'B' : null;
    if (!side) continue;
    const rest = t.slice((side === 'A' ? nameA : nameB).length);
    for (const [k, re] of Object.entries(EVENTS)) if (re.test(rest)) out[side][k]++;
  }
  return out;
}

if (require.main !== module) {
  module.exports = { makeCombatant, ARENAS, KEYS };
  return;
}

// ---- Run ----------------------------------------------------------------------
(async () => {
  const t0 = Date.now();
  const results = {};
  const fightsRows = [];
  for (const [arenaKey, arena] of Object.entries(ARENAS)) {
    results[arenaKey] = {};
    process.stderr.write(`${arena.label}: `);
    for (let i = 0; i < KEYS.length; i++) {
      for (let j = i + 1; j < KEYS.length; j++) {
        const ka = KEYS[i], kb = KEYS[j];
        const agg = { n: 0, winA: 0, winB: 0, draw: 0, timeout: 0, rounds: [], deadA: 0, deadB: 0, koA: 0, koB: 0, evA: {}, evB: {} };
        for (let f = 0; f < N; f++) {
          const seed = 7000 + f + 97 * i + 13 * j;
          const a = makeCombatant(...ka.split('/'), 'A');
          const b = makeCombatant(...kb.split('/'), 'B');
          const r = await L.fight({ A: a, B: b, grid: { w: arena.w, h: arena.h }, seed, maxRounds: 30, keepLog: true });
          agg.n++;
          if (r.winner === 'A') agg.winA++;
          else if (r.winner === 'B') agg.winB++;
          else if (r.winner === 'draw') agg.draw++;
          else agg.timeout++;
          agg.rounds.push(r.rounds);
          if (a.status.dead) agg.deadA++; else if (!C.isActive(a)) agg.koA++;
          if (b.status.dead) agg.deadB++; else if (!C.isActive(b)) agg.koB++;
          const ev = countEvents(r.log, a.name, b.name);
          for (const k of Object.keys(ev.A)) { agg.evA[k] = (agg.evA[k] || 0) + ev.A[k]; agg.evB[k] = (agg.evB[k] || 0) + ev.B[k]; }
        }
        agg.rounds.sort((x, y) => x - y);
        agg.medRounds = agg.rounds[Math.floor(agg.n / 2)];
        agg.meanRounds = agg.rounds.reduce((t, x) => t + x, 0) / agg.n;
        delete agg.rounds;
        results[arenaKey][ka + '|' + kb] = agg;
        fightsRows.push([arenaKey, ka, kb, agg.n, agg.winA / agg.n, agg.winB / agg.n, agg.draw / agg.n, agg.timeout / agg.n, agg.medRounds, agg.meanRounds.toFixed(2)]);
      }
      process.stderr.write('.');
    }
    process.stderr.write('\n');
  }

  // ---- Aggregates -------------------------------------------------------------
  const view = {}; // view[arena][a][b] = win rate of a against b
  const agg = {};
  for (const arenaKey of Object.keys(ARENAS)) {
    view[arenaKey] = {};
    const per = {};
    for (const k of KEYS) { view[arenaKey][k] = {}; per[k] = { wins: 0, games: 0, rounds: 0, deaths: 0, kos: 0, losses: 0, timeouts: 0, ev: {} }; }
    for (const [pair, r] of Object.entries(results[arenaKey])) {
      const [ka, kb] = pair.split('|');
      view[arenaKey][ka][kb] = r.winA / r.n;
      view[arenaKey][kb][ka] = r.winB / r.n;
      per[ka].wins += r.winA; per[kb].wins += r.winB;
      per[ka].games += r.n; per[kb].games += r.n;
      per[ka].rounds += r.meanRounds * r.n; per[kb].rounds += r.meanRounds * r.n;
      per[ka].deaths += r.deadA; per[kb].deaths += r.deadB;
      per[ka].kos += r.koA; per[kb].kos += r.koB;
      per[ka].losses += r.winB; per[kb].losses += r.winA;
      per[ka].timeouts += r.timeout; per[kb].timeouts += r.timeout;
      for (const k of Object.keys(r.evA)) { per[ka].ev[k] = (per[ka].ev[k] || 0) + r.evA[k]; per[kb].ev[k] = (per[kb].ev[k] || 0) + r.evB[k]; }
    }
    agg[arenaKey] = {};
    for (const k of KEYS) {
      const p = per[k];
      const ev = {};
      for (const e of Object.keys(p.ev)) ev[e] = p.ev[e] / p.games;
      agg[arenaKey][k] = { avgWin: p.wins / p.games, meanRounds: p.rounds / p.games, deathRate: p.deaths / p.games, koRate: p.kos / p.games, timeoutRate: p.timeouts / p.games, perFight: ev };
    }
  }
  // Group rollups (strategy × strategy and armor × armor), each averaged over the other factor.
  function rollup(arenaKey, groupIdx) {
    const groups = groupIdx === 0 ? Object.keys(ARMOR) : Object.keys(STRATEGY);
    const m = {};
    for (const g1 of groups) {
      m[g1] = {};
      for (const g2 of groups) {
        let sum = 0, n = 0;
        for (const a of KEYS) for (const b of KEYS) {
          if (a === b || a.split('/')[groupIdx] !== g1 || b.split('/')[groupIdx] !== g2) continue;
          sum += view[arenaKey][a][b]; n++;
        }
        m[g1][g2] = n ? sum / n : null;
      }
    }
    return m;
  }
  const rollups = {};
  for (const arenaKey of Object.keys(ARENAS)) rollups[arenaKey] = { armor: rollup(arenaKey, 0), strategy: rollup(arenaKey, 1) };

  const combatants = KEYS.map((k) => {
    const [a, s] = k.split('/');
    const c = makeCombatant(a, s, 'A');
    return {
      key: k, armor: a, strategy: s, label: `${ARMOR[a].label} ${STRATEGY[s].label}`,
      maxStamina: C.maxStamina(c), ap: C.apPool(c), con: C.attr(c, 'CON'), regen: C.regen(c), sp: L.B.Magic.maxSP(c),
      feats: Object.entries(c.feats).map(([f, r]) => (r > 1 ? `${L.B.DATA.FEATS[f].name} ${r}` : L.B.DATA.FEATS[f].name)),
      attacks: C.attackOptions(c).filter((o) => !o.unarmed).map((o) => ({ label: o.label, ap: o.ap, stamina: o.stamina, range: [o.minRange, o.maxRange], damage: o.damage, windUp: !!o.windUp, sp: o.spCost || 0 })),
    };
  });

  const data = {
    generated: new Date().toISOString(), n: N, level: LEVEL, seconds: Math.round((Date.now() - t0) / 1000),
    arenas: ARENAS, armorClasses: Object.fromEntries(Object.entries(ARMOR).map(([k, v]) => [k, v.label])),
    strategies: Object.fromEntries(Object.entries(STRATEGY).map(([k, v]) => [k, v.label])),
    combatants, view, agg, rollups, results,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'arena.json'), JSON.stringify(data));
  fs.writeFileSync(path.join(OUT, 'matchups.csv'), ['arena,a,b,n,win_a,win_b,draw,timeout,median_rounds,mean_rounds'].concat(fightsRows.map((r) => r.join(','))).join('\n') + '\n');

  // ---- Markdown summary -------------------------------------------------------
  const pct = (x) => (x == null ? '—' : Math.round(100 * x) + '%');
  let md = `# Arena\n\nLevel ${LEVEL}, ${N} fights per pairing per arena, ${data.seconds} s. Generated by \`node sim/arena.js\`.\n`;
  for (const [ak, arena] of Object.entries(ARENAS)) {
    md += `\n## ${arena.label} (${arena.w}×${arena.h})\n\n### Strategy vs strategy (row's win rate, averaged over armor)\n\n`;
    const S = Object.keys(STRATEGY);
    md += '| | ' + S.map((s) => STRATEGY[s].label).join(' | ') + ' |\n|' + '---|'.repeat(S.length + 1) + '\n';
    for (const a of S) md += `| ${STRATEGY[a].label} | ` + S.map((b) => pct(rollups[ak].strategy[a][b])).join(' | ') + ' |\n';
    md += `\n### Average win rate by armor and strategy\n\n| | ` + S.map((s) => STRATEGY[s].label).join(' | ') + ' |\n|' + '---|'.repeat(S.length + 1) + '\n';
    for (const a of Object.keys(ARMOR)) md += `| ${ARMOR[a].label} | ` + S.map((s) => pct(agg[ak][a + '/' + s].avgWin)).join(' | ') + ' |\n';
  }
  fs.writeFileSync(path.join(OUT, 'report.md'), md);
  console.log(md);
})();
