#!/usr/bin/env node
/*
 * The gauntlet: a party of level-5 adventurers crawls through a fixed run of eight rooms, ordered
 * by how hard each fight was for a fresh party in the party arena. In attrition mode, wounds,
 * bleeding, spent spell points, spent arrows and battered shields carry from room to room;
 * between rooms there is only a breather (stamina back, bandages used up), and a camp partway.
 * The run ends when the party clears the last room, is wiped out, or can't win a room in time.
 *
 *   node sim/gauntlet.js [--n 50] [--only mage,core] [--mode attrition|reset] [--out sim/results/gauntlet]
 *
 * Two modes: attrition (wounds carry on, with a camp partway) and reset (a fresh party for every
 * room, the dead restored, deaths still recorded).
 *
 * Lineups: a core trio (knight with shield, mail two-hander, archer) alone and with each fourth
 * member, and the mage party with each core member left out. Every lineup runs the same seeds,
 * so differences between lineups are paired. How useful a member is:
 *   - marginal value: rooms cleared with them minus rooms cleared without them (same seeds);
 *   - share of the harm the party dealt (attribute points and stamina) and of the foes it downed;
 *   - harm taken, and how often they die.
 *
 * Writes gauntlet.json (read by sim/gauntlet-page.js), gauntlet.md and runs.csv (one row per
 * run per member, for R).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const { makeCombatant } = require('./arena');
const { C, Combat, Enemies } = L;
const T = L.B.Terrain;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('n', 50));
const OUT = arg('out', path.join(__dirname, 'results', 'gauntlet'));

// ---- The rooms ------------------------------------------------------------------------
// Map legend: A party start, E foe start, # stone pillar, O pit, : rough ground, D darkness,
// ^ hot coals, F hidden fire rune (a trap), P hidden pit rune (a trap). Traps belong to the
// foes' side: the foes know where they are, the party doesn't.
const ROOMS = [
  {
    key: 'gatehouse', name: 'Gatehouse', foes: 'goblinBand', blurb: 'Goblins and an archer behind two pillars.',
    map: [
      '............',
      'A.....#.....',
      'A.....#....E',
      'A..........E',
      'A.....#....E',
      '......#.....',
      '............',
    ],
  },
  {
    key: 'kennels', name: 'Kennels', foes: 'wolfPack', blurb: 'A wolf pack across a floor of broken straw and rubble.',
    map: [
      '..........',
      'A..::::..E',
      'A..::::...',
      'A........E',
      'A..::::..E',
      '..........',
    ],
  },
  {
    key: 'corridor', name: 'Trapped corridor', foes: 'sarnakPair', blurb: 'Two sarnaks at the end of a narrow corridor sown with fire and pit traps.',
    map: [
      '..............',
      'AA...F...P...E',
      'AA..P...F....E',
    ],
  },
  {
    key: 'den', name: 'Troll den', foes: 'caveTroll', blurb: 'A cave troll among rubble and boulders.',
    map: [
      '..........',
      'A...#.....',
      'A..:::....',
      'A..:::...E',
      'A...#.....',
      '..........',
    ],
  },
  {
    key: 'cistern', name: 'Cistern', foes: 'frogPatrol', blurb: 'Frogloks beyond a flooded channel with one walkway across.',
    map: [
      '............',
      'A....OO.....',
      'A....OO....E',
      'A..........E',
      'A....OO....E',
      '.....OO.....',
      '.....OO.....',
    ],
  },
  {
    key: 'warren', name: 'Kobold warren', foes: 'koboldBand', blurb: 'Kobold spearmen in a low warren, a pit trap at the mouth.',
    map: [
      '..........',
      'A...#..#.E',
      'A..P.....E',
      'A...#..#.E',
      'A........E',
    ],
  },
  {
    key: 'crypt', name: 'Crypt', foes: 'skeletonSquad', blurb: 'Skeletons among pillars, a pool of darkness between.',
    map: [
      '..........',
      'A..#..#..E',
      'A..DDDD..E',
      'A..DDDD..E',
      'A..#..#...',
      '..........',
    ],
  },
  {
    key: 'hall', name: 'Chieftain\'s hall', foes: 'trollChieftain', blurb: 'The troll chieftain in a pillared hall with braziers of coals.',
    map: [
      '..............',
      'A..#...#..^#..',
      'A............E',
      'A..........^..',
      'A..#...#...#..',
      '..............',
    ],
  },
];
const TILE = {
  '#': (enc, x, y) => T.add(enc, x, y, 'stoneWall'),
  O: (enc, x, y) => T.add(enc, x, y, 'pit'),
  ':': (enc, x, y) => T.add(enc, x, y, 'rough'),
  D: (enc, x, y) => T.add(enc, x, y, 'darkness'),
  '^': (enc, x, y) => T.add(enc, x, y, 'hot'),
  F: (enc, x, y) => { const f = T.add(enc, x, y, 'rune', { noun: 'fire', mag: 3, side: 'enemy', hidden: true }); f.radius = 0; },
  P: (enc, x, y) => { const f = T.add(enc, x, y, 'rune', { noun: 'earth', mag: 2, side: 'enemy', hidden: true }); f.radius = 0; },
};

function cells(room, ch) {
  const out = [];
  room.map.forEach((row, y) => [...row].forEach((c, x) => { if (c === ch) out.push({ x, y }); }));
  return out;
}

// Starts from the map; extra bodies go to the nearest open squares.
function placer(room) {
  return (enc, idsA, idsB) => {
    const taken = new Set();
    const open = (x, y) => x >= 0 && y >= 0 && x < enc.grid.w && y < enc.grid.h && '.:'.includes(room.map[y][x]) && !taken.has(x + ',' + y);
    const put = (ids, starts) => {
      const q = starts.slice();
      for (const id of ids) {
        let spot = q.find((p) => !taken.has(p.x + ',' + p.y));
        if (!spot) {
          // Breadth-first from the starts.
          const seen = new Set(), queue = starts.slice();
          while (queue.length && !spot) {
            const p = queue.shift();
            for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
              const x = p.x + dx, y = p.y + dy, k = x + ',' + y;
              if (seen.has(k)) continue;
              seen.add(k);
              if (open(x, y)) { spot = { x, y }; break; }
              if (x >= 0 && y >= 0 && x < enc.grid.w && y < enc.grid.h) queue.push({ x, y });
            }
          }
        }
        taken.add(spot.x + ',' + spot.y);
        enc.pos[id] = { x: spot.x, y: spot.y };
      }
    };
    put(idsA, cells(room, 'A'));
    put(idsB, cells(room, 'E'));
  };
}

function setup(room) {
  return (enc) => {
    room.map.forEach((row, y) => [...row].forEach((ch, x) => { if (TILE[ch]) TILE[ch](enc, x, y); }));
  };
}

// ---- Lineups ----------------------------------------------------------------------------
const MEMBERS = {
  knight: { key: 'heavy/shield', label: 'Knight (plate, sword and shield)' },
  twoHander: { key: 'medium/twoHanded', label: 'Two-hander (mail, greatsword)' },
  archer: { key: 'light/archery', label: 'Archer (leather, longbow)' },
  mage: { key: 'unarmored/magic', label: 'Mage (fire, earth, vine, force)' },
  enchanter: { key: 'unarmored/enchanter', label: 'Enchanter (mind spells)' },
  grappler: { key: 'light/grappler', label: 'Grappler (leather)' },
  duelist: { key: 'light/duelist', label: 'Duelist (leather, rapier and dagger)' },
};
const CORE = ['knight', 'twoHander', 'archer'];
const LINEUPS = {
  core: { label: 'Core trio', members: CORE },
  mage: { label: '+ Mage', members: CORE.concat('mage') },
  enchanter: { label: '+ Enchanter', members: CORE.concat('enchanter') },
  grappler: { label: '+ Grappler', members: CORE.concat('grappler') },
  duelist: { label: '+ Duelist', members: CORE.concat('duelist') },
  noKnight: { label: 'Mage party, no knight', members: ['twoHander', 'archer', 'mage'] },
  noTwoHander: { label: 'Mage party, no two-hander', members: ['knight', 'archer', 'mage'] },
  noArcher: { label: 'Mage party, no archer', members: ['knight', 'twoHander', 'mage'] },
};
// Marginal value of a member: [with, without].
const MARGINAL = {
  knight: ['mage', 'noKnight'], twoHander: ['mage', 'noTwoHander'], archer: ['mage', 'noArcher'],
  mage: ['mage', 'core'], enchanter: ['enchanter', 'core'], grappler: ['grappler', 'core'], duelist: ['duelist', 'core'],
};
const ONLY = arg('only', null);
const RUN = ONLY ? Object.fromEntries(Object.entries(LINEUPS).filter(([k]) => ONLY.split(',').includes(k))) : LINEUPS;

// ---- Between rooms: a breather --------------------------------------------------------
function breather(party) {
  const living = party.filter((c) => !c.status.dead);
  let bandages = living.reduce((t, c) => t + (c.inventory.bandages || 0), 0);
  const take = () => { const holder = living.find((c) => c.inventory.bandages > 0); holder.inventory.bandages--; bandages--; };
  for (const c of living) {
    if (!c.bleeds.length) continue;
    if (bandages > 0) { take(); c.bleeds = c.bleeds.filter((b) => b.poison); }
    const left = c.bleeds.reduce((t, b) => t + b.remaining, 0);
    if (left) C.damageAttr(c, 'CON', left);
    c.bleeds = [];
    C.updateCondition(c);
  }
  for (const c of party) {
    if (c.status.dead) continue;
    c.stamina = C.maxStamina(c);
    c.status.unconscious = false;
    C.updateCondition(c);
  }
}

// ---- Camp: a long rest partway through (attrition mode) -------------------------------
// After this many rooms the party makes camp: the existing long-rest rules (bleeding tended,
// stamina and spell points back, one daily heal roll, a little armor and shield repair).
// Arrows and bandages are not restocked.
const CAMP_AFTER = 4;
async function camp(party, seed) {
  const living = party.filter((c) => !c.status.dead);
  const tender = living.slice().sort((a, b) => C.rank(b, 'wound_tending') - C.rank(a, 'wound_tending'))[0] || null;
  const roller = L.makeRoller(seed);
  for (const c of living) await L.B.Recovery.longRest(c, { tender }, roller);
}

// ---- Running ----------------------------------------------------------------------------
// mode 'attrition': one party through the rooms in order, wounds carried, a camp after room
// CAMP_AFTER; the run ends at the first room it can't win.
// mode 'reset': a fresh, full-strength party for every room (the dead restored), so every room
// is fought by every run; deaths are still recorded, room by room.
function freshParty(lineup) {
  return lineup.members.map((m, j) => {
    const c = makeCombatant(...MEMBERS[m].key.split('/'), 'P' + j);
    c.name = MEMBERS[m].label.split(' (')[0];
    c.role = m;
    return c;
  });
}

async function runGauntlet(lineup, runIdx, mode) {
  let party = freshParty(lineup);
  const stat = Object.fromEntries(lineup.members.map((m) => [m, { dealtAttrs: 0, dealtStamina: 0, downs: 0, takenAttrs: 0, takenStamina: 0, timesDowned: 0, deaths: [] }]));
  const rooms = [];
  for (let r = 0; r < ROOMS.length; r++) {
    const room = ROOMS[r];
    if (mode === 'reset' && r > 0) party = freshParty(lineup);
    if (mode === 'attrition' && r === CAMP_AFTER) await camp(party, 31337 * runIdx + 7);
    const byId = Object.fromEntries(party.map((c) => [c.id, c]));
    const up = party.filter((c) => C.isActive(c));
    if (!up.length) break;
    const foes = Enemies.makeMonster(room.foes);
    const deadBefore = new Set(party.filter((c) => c.status.dead).map((c) => c.id));
    const credit = (c) => byId[c.id] || (c.conjured && byId[c.conjured.by]) || null;
    const res = await L.fight({
      A: up, B: foes, grid: { w: room.map[0].length, h: room.map.length }, seed: 7919 * runIdx + 104729 * r + 1, maxRounds: 30,
      place: placer(room), setup: setup(room), keepEnc: true,
      onHit: (e) => {
        const a = credit(e.attacker), t = byId[e.target.id];
        if (a && e.target.side !== 'party') { const s = stat[a.role]; s.dealtAttrs += e.attrs; s.dealtStamina += e.stamina; if (e.downed) s.downs++; }
        if (t) { const s = stat[t.role]; s.takenAttrs += e.attrs; s.takenStamina += e.stamina; if (e.downed) s.timesDowned++; }
      },
    });
    Combat.cleanup(res.enc, Object.fromEntries(res.enc.ids.map((id) => [id, up.find((c) => c.id === id) || foes.find((c) => c.id === id)]).filter(([, c]) => c)));
    const cleared = res.winner === 'A';
    if (cleared && mode === 'attrition') breather(party);
    const died = party.filter((c) => c.status.dead && !deadBefore.has(c.id)).map((c) => c.role);
    for (const m of died) stat[m].deaths.push(r);
    rooms.push({ cleared, rounds: res.rounds, deaths: died.length, died, timeout: res.winner === 'timeout' });
    if (!cleared && mode === 'attrition') break;
  }
  const won = rooms.filter((x) => x.cleared).length;
  return { score: won, rooms, stat, survivors: party.filter((c) => !c.status.dead).length };
}

const MODES = {
  attrition: { label: 'Attrition', blurb: `One party through all eight rooms; wounds carry on, with a breather between rooms and a camp (a long rest) after room ${CAMP_AFTER}. The run ends at the first room the party can't win.`, score: 'rooms cleared in a row' },
  reset: { label: 'Reset', blurb: 'A fresh, full-strength party for every room, the dead restored. Every room is fought in every run; deaths are recorded room by room.', score: 'rooms won' },
};
const ONLY_MODE = arg('mode', null);

async function runMode(mode, csv) {
  const res = { lineups: {}, marginal: {} };
  for (const [lk, lineup] of Object.entries(RUN)) {
    const runs = [];
    for (let i = 0; i < N; i++) runs.push(await runGauntlet(lineup, i, mode));
    const reach = ROOMS.map((_, r) => runs.filter((x) => x.rooms.length > r).length / N);
    const clear = ROOMS.map((_, r) => runs.filter((x) => x.score > r).length / N);
    const roomStats = ROOMS.map((_, r) => {
      const at = runs.map((x) => x.rooms[r]).filter(Boolean);
      const memberDeaths = Object.fromEntries(lineup.members.map((m) => [m, at.length ? at.filter((x) => x.died.includes(m)).length / at.length : null]));
      return { reached: at.length, cleared: at.filter((x) => x.cleared).length, timeouts: at.filter((x) => x.timeout).length, rounds: at.length ? at.reduce((t, x) => t + x.rounds, 0) / at.length : null, deaths: at.length ? at.reduce((t, x) => t + x.deaths, 0) / at.length : null, memberDeaths };
    });
    const members = {};
    for (const m of lineup.members) {
      const s = (f) => runs.reduce((t, x) => t + f(x.stat[m]), 0) / N;
      members[m] = {
        dealtAttrs: s((x) => x.dealtAttrs), dealtStamina: s((x) => x.dealtStamina), downs: s((x) => x.downs),
        takenAttrs: s((x) => x.takenAttrs), takenStamina: s((x) => x.takenStamina), timesDowned: s((x) => x.timesDowned),
        // Attrition: the share of runs in which they die. Reset: deaths per run (out of eight rooms).
        deathRate: mode === 'reset' ? s((x) => x.deaths.length) : runs.filter((x) => x.stat[m].deaths.length).length / N,
        diedIn: ROOMS.map((_, r) => runs.filter((x) => x.stat[m].deaths.includes(r)).length / N),
      };
    }
    const tot = (k) => Object.values(members).reduce((t, x) => t + x[k], 0) || 1;
    for (const m of Object.values(members)) { m.shareAttrs = m.dealtAttrs / tot('dealtAttrs'); m.shareStamina = m.dealtStamina / tot('dealtStamina'); m.shareDowns = m.downs / tot('downs'); }
    res.lineups[lk] = {
      label: lineup.label, members: lineup.members, meanCleared: runs.reduce((t, x) => t + x.score, 0) / N, fullClear: runs.filter((x) => x.score === ROOMS.length).length / N,
      meanSurvivors: runs.reduce((t, x) => t + x.survivors, 0) / N, reach, clear, roomStats, memberStats: members, perRun: runs.map((x) => x.score),
      winRate: roomStats.map((s) => (s.reached ? s.cleared / s.reached : null)),
    };
    runs.forEach((x, i) => lineup.members.forEach((m) => {
      const s = x.stat[m];
      csv.push([mode, lk, i, m, x.score, s.deaths.length, s.dealtAttrs, s.dealtStamina, s.downs, s.takenAttrs, s.takenStamina, s.timesDowned, s.deaths.map((r) => r + 1).join(';')].join(','));
    }));
    process.stderr.write(`${mode}:${lk} `);
  }
  // Marginal value, paired by seed: the score with the member minus without.
  for (const [m, [w, wo]] of Object.entries(MARGINAL)) {
    const a = res.lineups[w], b = res.lineups[wo];
    if (!a || !b) continue;
    const d = a.perRun.map((x, i) => x - b.perRun[i]);
    const mean = d.reduce((t, x) => t + x, 0) / d.length;
    const sd = Math.sqrt(d.reduce((t, x) => t + (x - mean) ** 2, 0) / Math.max(1, d.length - 1));
    res.marginal[m] = { with: w, without: wo, mean, se: sd / Math.sqrt(d.length), fullClearWith: a.fullClear, fullClearWithout: b.fullClear };
  }
  return res;
}

(async () => {
  const t0 = Date.now();
  const out = { n: N, generated: new Date().toISOString(), campAfter: CAMP_AFTER, rooms: ROOMS.map(({ key, name, foes, blurb, map }) => ({ key, name, foes, foeNames: Enemies.makeMonster(foes).map((c) => c.name), blurb, map })), members: MEMBERS, modes: {} };
  const csv = ['mode,lineup,run,member,score,deaths,dealt_attrs,dealt_stamina,downs,taken_attrs,taken_stamina,times_downed,died_in_rooms'];
  for (const [mk, M] of Object.entries(MODES)) {
    if (ONLY_MODE && mk !== ONLY_MODE) continue;
    out.modes[mk] = Object.assign({ label: M.label, blurb: M.blurb, score: M.score }, await runMode(mk, csv));
  }
  process.stderr.write('\n');
  out.seconds = Math.round((Date.now() - t0) / 1000);

  const pct = (x) => (x == null ? '—' : Math.round(100 * x) + '%');
  const f1 = (x) => x.toFixed(1);
  const md = [`# Gauntlet\n\n${N} runs per lineup per mode, the same seeds for every lineup, ${out.seconds} s. Rooms in order: ${ROOMS.map((r) => `${r.name} (${out.rooms.find((x) => x.key === r.key).foeNames.length} × ${r.foes})`).join(', ')}.\n`];
  for (const [mk, R] of Object.entries(out.modes)) {
    md.push(`## ${R.label} mode\n\n${R.blurb}\n`);
    md.push(`| Lineup | Mean ${R.score} | All eight | ` + ROOMS.map((r) => (mk === 'reset' ? `Wins ${r.name}` : `Clears ${r.name}`)).join(' | ') + ' |', '|---|---|---|' + ROOMS.map(() => '---|').join(''));
    for (const l of Object.values(R.lineups)) md.push(`| ${l.label} | ${l.meanCleared.toFixed(2)} | ${pct(l.fullClear)} | ` + (mk === 'reset' ? l.winRate : l.clear).map(pct).join(' | ') + ' |');
    md.push(`\n### Marginal value (${R.score} with minus without, paired; ± one standard error)\n`, '| Member | With | Without | Δ | All eight with / without |', '|---|---|---|---|---|');
    for (const [m, v] of Object.entries(R.marginal)) md.push(`| ${MEMBERS[m].label} | ${R.lineups[v.with].label} | ${R.lineups[v.without].label} | ${v.mean >= 0 ? '+' : ''}${v.mean.toFixed(2)} ± ${v.se.toFixed(2)} | ${pct(v.fullClearWith)} / ${pct(v.fullClearWithout)} |`);
    md.push('\n### Who does what (per run)\n', `| Lineup | Member | Harm dealt (attr / stamina) | Share of harm | Foes downed (share) | Harm taken (attr / stamina) | ${mk === 'reset' ? 'Deaths per run' : 'Dies'} |`, '|---|---|---|---|---|---|---|');
    for (const l of Object.values(R.lineups)) for (const [m, s] of Object.entries(l.memberStats)) {
      md.push(`| ${l.label} | ${MEMBERS[m].label.split(' (')[0]} | ${f1(s.dealtAttrs)} / ${f1(s.dealtStamina)} | ${pct(s.shareAttrs)} | ${f1(s.downs)} (${pct(s.shareDowns)}) | ${f1(s.takenAttrs)} / ${f1(s.takenStamina)} | ${mk === 'reset' ? s.deathRate.toFixed(2) : pct(s.deathRate)} |`);
    }
    if (mk === 'reset') {
      md.push('\n### Deaths by room (reset mode, share of fights in which each member dies)\n', '| Lineup | Member | ' + ROOMS.map((r) => r.name).join(' | ') + ' |', '|---|---|' + ROOMS.map(() => '---|').join(''));
      for (const l of Object.values(R.lineups)) for (const m of l.members) md.push(`| ${l.label} | ${MEMBERS[m].label.split(' (')[0]} | ` + l.roomStats.map((s) => pct(s.memberDeaths[m])).join(' | ') + ' |');
    }
    md.push('');
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'gauntlet.json'), JSON.stringify(out));
  fs.writeFileSync(path.join(OUT, 'gauntlet.md'), md.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'runs.csv'), csv.join('\n') + '\n');
  console.log(md.join('\n'));
})();
