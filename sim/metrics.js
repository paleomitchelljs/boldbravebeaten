/*
 * The tuning plan's metrics (docs/PLAN.md, targets table), gathered from a fight without changing it.
 *
 *   const M = Metrics.create();            // one per place or pairing
 *   const w = M.watch(enc, chars, heroIds); // when a fight starts (sets enc.onHit, chaining any observer already there)
 *   w.poll();                               // after each action (cheap: reads stamina and status)
 *   w.end();                                // when the fight is over
 *   Metrics.report(M) → lines of text;  Metrics.summary(M) → the numbers
 *
 * What counts:
 *   rounds          enc.round at the end
 *   heroes dead     heroes alive at the start and dead at the end (the crawl's own column counts the dead so far)
 *   below ½, ¼      any fighter (either side, not tireless) seen under half / a quarter of their maximum stamina,
 *                   seen after each blow and each action
 *   collapses       a fighter who goes down without dying (stamina 0 today: unconscious); "got up": later in the
 *                   same fight active again
 *   attr wound      a fighter alive at the end with more damage to STR, DEX or SPD than at the start
 *   blows landed    each blow that reaches the body or armor (Combat.applyHit), by action and by location
 */
'use strict';
const path = require('path');
const B = require(path.join(__dirname, '..', 'tests', 'load.js'));
const C = B.Character;

const ACTIONS = ['thrust', 'swing', 'twoHanded', 'power', 'shoot', 'bash', 'kick', 'punch', 'spell', 'natural', 'other'];

// The plan's action names, from a strike option.
function actionOf(o) {
  if (!o) return 'other';
  if (o.spell || o.motion === 'spell') return 'spell';
  if (o.unarmed === 'shieldBash') return 'bash';
  if (o.unarmed === 'kick' || o.unarmed === 'punch') return o.unarmed;
  if (o.unarmed) return 'other';
  if (o.natural) return 'natural';
  if (['thrust', 'swing', 'twoHanded', 'power', 'shoot'].includes(o.motion)) return o.motion;
  return 'other';
}

function create() {
  return {
    fights: 0, rounds: [], heroesDead: 0, heroFights: 0,
    half: 0, quarter: 0, collapses: 0, gotUp: 0, attrWound: 0, heroAttrWound: 0,
    blows: { all: {}, heroes: {} }, locs: { all: {}, heroes: {} }, kills: {},
    watch(enc, chars, heroIds) { return watch(this, enc, chars, heroIds); },
  };
}

function watch(M, enc, chars, heroIds) {
  const heroes = new Set(heroIds || []);
  const start = {};
  const snap = (c) => ({ STR: c.damage.STR || 0, DEX: c.damage.DEX || 0, SPD: c.damage.SPD || 0, dead: !!c.status.dead, down: !C.isActive(c) });
  for (const c of Object.values(chars)) start[c.id] = snap(c);
  const f = { half: false, quarter: false };
  const down = {}; // id → collapsed and not yet up
  const look = (c) => {
    if (!c || c.status.dead) return;
    if (!C.tireless(c)) {
      const max = C.maxStamina(c) || 1;
      if (c.stamina < max / 2) f.half = true;
      if (c.stamina < max / 4) f.quarter = true;
    }
    const up = C.isActive(c);
    if (!up && !down[c.id] && !(start[c.id] && start[c.id].down)) { down[c.id] = true; M.collapses++; }
    else if (up && down[c.id]) { down[c.id] = false; M.gotUp++; }
  };
  const prev = enc.onHit;
  enc.onHit = (ev) => {
    if (prev) prev(ev);
    const a = actionOf(ev.option);
    const loc = ev.location || 'none';
    const hero = ev.attacker && heroes.has(ev.attacker.id);
    M.blows.all[a] = (M.blows.all[a] || 0) + 1;
    M.locs.all[loc] = (M.locs.all[loc] || 0) + 1;
    if (hero) { M.blows.heroes[a] = (M.blows.heroes[a] || 0) + 1; M.locs.heroes[loc] = (M.locs.heroes[loc] || 0) + 1; }
    if (ev.target && ev.target.status.dead) M.kills[a] = (M.kills[a] || 0) + 1;
    look(ev.target);
  };
  return {
    poll() { for (const c of Object.values(chars)) { if (!start[c.id]) start[c.id] = snap(c); look(c); } },
    end() {
      this.poll();
      enc.onHit = prev;
      M.fights++;
      M.rounds.push(enc.round);
      if (f.half) M.half++;
      if (f.quarter) M.quarter++;
      let wound = false, heroWound = false;
      for (const c of Object.values(chars)) {
        const s = start[c.id];
        if (!s || c.status.dead) continue;
        if (['STR', 'DEX', 'SPD'].some((k) => (c.damage[k] || 0) > s[k])) { wound = true; if (heroes.has(c.id)) heroWound = true; }
      }
      if (wound) M.attrWound++;
      if (heroWound) M.heroAttrWound++;
      if (heroes.size) {
        M.heroFights++;
        for (const id of heroes) if (chars[id] && chars[id].status.dead && start[id] && !start[id].dead) M.heroesDead++;
      }
    },
  };
}

const q = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const shareOf = (o) => { const t = Object.values(o).reduce((a, b) => a + b, 0); const out = {}; for (const [k, v] of Object.entries(o)) out[k] = t ? v / t : 0; return { total: t, share: out }; };

const located = (o) => shareOf(Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'none')));

function summary(M) {
  const n = M.fights || 1;
  return {
    fights: M.fights, medianRounds: q(M.rounds, 0.5), p90Rounds: q(M.rounds, 0.9),
    heroesDead: M.heroFights ? M.heroesDead / M.heroFights : null,
    half: M.half / n, quarter: M.quarter / n, collapses: M.collapses, gotUp: M.gotUp,
    attrWound: M.attrWound / n, heroAttrWound: M.heroFights ? M.heroAttrWound / M.heroFights : null,
    blows: shareOf(M.blows.all), heroBlows: shareOf(M.blows.heroes),
    locs: shareOf(M.locs.all), heroLocs: shareOf(M.locs.heroes), kills: shareOf(M.kills),
    located: located(M.locs.all), heroLocated: located(M.locs.heroes),
  };
}

const pc = (x) => (x == null ? '-' : Math.round(100 * x) + '%');
const fmtShares = (s) => Object.entries(s.share).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v)}`).join(', ') || 'none';

function report(M, indent) {
  const s = summary(M), I = indent == null ? '  ' : indent;
  return [
    `${I}metrics: ${s.fights} fights; rounds median ${s.medianRounds}, 90th ${s.p90Rounds}` + (s.heroesDead != null ? `; heroes dead a fight ${s.heroesDead.toFixed(2)}` : ''),
    `${I}  stamina: someone under ½ in ${pc(s.half)} of fights, under ¼ in ${pc(s.quarter)}; collapses ${s.collapses}, got up ${s.gotUp}`,
    `${I}  a survivor ends with a STR/DEX/SPD wound: ${pc(s.attrWound)} of fights` + (s.heroAttrWound != null ? ` (a hero: ${pc(s.heroAttrWound)})` : ''),
    `${I}  blows landed by action (${s.blows.total}): ${fmtShares(s.blows)}`,
    s.heroBlows.total ? `${I}    the heroes' (${s.heroBlows.total}): ${fmtShares(s.heroBlows)}` : null,
    `${I}  blows landed by location (${s.locs.total - (M.locs.all.none || 0)} with a location; ${M.locs.all.none || 0} without, spells and bursts): ${fmtShares(located(M.locs.all))}`,
    s.heroLocs.total ? `${I}    the heroes': ${fmtShares(located(M.locs.heroes))}` : null,
    `${I}  killing blows by action (${s.kills.total}): ${fmtShares(s.kills)}`,
  ].filter(Boolean);
}

module.exports = { ACTIONS, actionOf, create, summary, report };
