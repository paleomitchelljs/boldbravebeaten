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
 *   collapses       a fighter who goes down without dying (stamina 0: a collapse, CONFIG.stamina.collapse); "got
 *                   up": later in the same fight active again; "died down": killed while down; "down at the end":
 *                   still down when the fight ended (the side with nobody standing loses at once), and of those, how
 *                   many were on the side that won (they come round after it)
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
    half: 0, quarter: 0, collapses: 0, gotUp: 0, downDied: 0, downAtEnd: 0, downWon: 0, hero: { collapses: 0, gotUp: 0, downDied: 0, downAtEnd: 0, downWon: 0 }, attrWound: 0, heroAttrWound: 0,
    blows: { all: {}, heroes: {} }, locs: { all: {}, heroes: {} }, kills: {},
    heroDeaths: { n: 0, action: {}, loc: {}, apLeft: 0, down: 0, round1: 0, byFoe: {} },
    ai: { intoReach: 0, intoReachBare: 0, sidearm: 0, tradeDown: 0, strikes: 0, worthless: 0, immune: 0, idleRounds: 0, standOffs: 0, feat: {}, casts: 0, casterFights: 0, spLeft: 0, spMax: 0, overchannel: 0, spent: 0 },
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
  const killed = new Set();
  const look = (c) => {
    const H = c && heroes.has(c.id) ? M.hero : null;
    if (c && c.status.dead && down[c.id]) { down[c.id] = false; M.downDied++; if (H) H.downDied++; }
    if (!c || c.status.dead) return;
    if (!C.tireless(c)) {
      const max = C.maxStamina(c) || 1;
      if (c.stamina < max / 2) f.half = true;
      if (c.stamina < max / 4) f.quarter = true;
    }
    const up = C.isActive(c);
    if (!up && !down[c.id] && !(start[c.id] && start[c.id].down)) { down[c.id] = true; M.collapses++; if (H) H.collapses++; }
    else if (up && down[c.id]) { down[c.id] = false; M.gotUp++; if (H) H.gotUp++; }
  };
  const ai = aiWatch(M.ai, enc, chars);
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
    // What kills a hero (step 6): the blow's action and place, whether they had AP left to meet it, were down already,
    // and the round; the killer by name (the template or monster, not the individual).
    if (ev.target && ev.target.status.dead && heroes.has(ev.target.id) && !(start[ev.target.id] || {}).dead && !killed.has(ev.target.id)) {
      killed.add(ev.target.id);
      const D = M.heroDeaths;
      D.n++;
      D.action[a] = (D.action[a] || 0) + 1;
      D.loc[loc] = (D.loc[loc] || 0) + 1;
      if (down[ev.target.id]) D.down++;
      else if (B.Combat.apLeft(enc, ev.target.id) > 0) D.apLeft++; // standing, with AP it could have met the blow with
      if (enc.round <= 1) D.round1++;
      const who = ev.attacker ? String(ev.attacker.monster || ev.attacker.template || ev.attacker.name || '?') : '?';
      D.byFoe[who] = (D.byFoe[who] || 0) + 1;
    }
    look(ev.target);
  };
  return {
    poll() { for (const c of Object.values(chars)) { if (!start[c.id]) start[c.id] = snap(c); look(c); } ai.poll(); },
    end() {
      this.poll();
      ai.end();
      enc.onHit = prev;
      M.fights++;
      M.rounds.push(enc.round);
      for (const id of Object.keys(down)) {
        if (!down[id]) continue;
        const won = chars[id] && enc.winner === chars[id].side; // their side won: they come round after the fight
        M.downAtEnd++; if (won) M.downWon++;
        if (heroes.has(id)) { M.hero.downAtEnd++; if (won) M.hero.downWon++; }
      }
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

// What the AI did (docs/PLAN.md step 5), read from the declarations as they are made: nothing here changes a fight.
//   intoReach       moves that come in from outside a standing foe's melee reach to inside it; "bare": with less AP left than the mover's
//                   cheapest defence while one of those foes still has the AP for a blow worth fearing there (AI.hitValue
//                   10 or more): it walked in and can't meet it
//   sidearm         sidearms drawn; "trade down": while the weapon in hand could still hurt the nearest foe from where
//                   it stood (not inside its reach.min, not broken, the foe not immune to it)
//   immune          strikes at a body immune to every kind of harm they carry (AI.immuneTo)
//   worthless       other strikes that could do nothing to their target (the armor turns all of it; kicks and bashes,
//                   thrown for the fall too, aside)
//   idle rounds     rounds after the first in which nobody struck, cast or grappled while two foes stood within striking
//                   distance at the round's end (the edge of a melee reach + 2, or in range and in line of a shot or bolt): the walk
//                   up across a big map doesn't count; a stand-off: three such rounds in a row
//   feat actions    Vanish, Feign, Rally, Command, To Your Feet, Demoralize, Name the Weakness, by count
//   casts           spells cast (a bolt or a cast), per fight of each fighter with spell points; the share of their
//                   spell points still unspent at the fight's end; overchannels
function aiWatch(A, enc, chars) {
  const Combat = B.Combat, AI = B.AI;
  const seen = new WeakSet();
  const wield = {}, was = {};
  for (const c of Object.values(chars)) { wield[c.id] = c.wield; if (enc.pos[c.id]) was[c.id] = { x: enc.pos[c.id].x, y: enc.pos[c.id].y }; }
  const FEAT = ['vanish', 'feign', 'rally', 'command', 'rouse', 'demoralize', 'nameWeakness'];
  const ACT = new Set(['strike', 'cast', 'trip', 'disarm', 'shove', 'clinch', 'grapple', 'pin', 'throw', 'demoralize', 'nameWeakness']);
  let round = enc.round, busy = false, idleRun = 0, stood = false;
  const casters = Object.values(chars).filter((c) => B.Magic && B.Magic.maxSP(c) > 0).length;
  const sides = () => new Set(Object.values(chars).filter((c) => C.isActive(c)).map((c) => c.side)).size > 1;
  // Within striking distance: two foes at the edge of a melee reach (+2), or one in range of the other's shot or bolt.
  const engaged = () => {
    const up = Object.values(chars).filter((c) => C.isActive(c) && enc.pos[c.id]);
    return up.some((a) => up.some((b) => {
      if (a.side === b.side) return false;
      const d = Combat.dist(enc.pos[a.id], enc.pos[b.id]);
      const line = () => !(B.Terrain && enc.tiles && B.Terrain.lineCheck(enc, enc.pos[a.id], enc.pos[b.id], 'missile').blocked);
      return C.attackOptions(a).some((o) => (o.ranged || o.spell ? d <= (o.maxRange || 1) && line() : d <= (o.maxRange || 1) + 2));
    }));
  };
  const closeRound = () => {
    if (round > 1 && !busy && sides() && engaged()) { A.idleRounds++; idleRun++; if (idleRun >= 3 && !stood) { A.standOffs++; stood = true; } }
    else if (busy) idleRun = 0;
  };
  const meleeReach = (f) => Math.max(0, ...C.attackOptions(f).filter((o) => !o.ranged && !o.spell && !o.windUp).map((o) => o.maxRange || 1));
  const cheapestDefence = (c) => Math.min(99, ...Combat.DEFENSE_TYPES.filter((k) => !Combat.defenseUnavailable(c, k, null, chars, enc) && (k !== 'offParry' || C.offhandWeapon(c))).map((k) => C.actionCost(c, k).ap));
  const nearestFoe = (c) => {
    let best = null;
    for (const f of Object.values(chars)) if (f.side !== c.side && C.isActive(f) && enc.pos[f.id]) { const d = Combat.dist(enc.pos[c.id], enc.pos[f.id]); if (!best || d < best.d) best = { f, d }; }
    return best;
  };
  // The weapon it held (just dropped for the sidearm, if two-handed) as it was: in hand, not on the ground.
  const could = (c, wid, f, d) => {
    const keep = c.wield, dropped = c.status.dropped;
    c.wield = wid; c.status.dropped = dropped.filter((x) => x !== wid);
    const opts = C.attackOptions(c).filter((o) => !o.unarmed && !o.windUp && C.inRange(o, d) && !(o.closePenalty && d <= (o.minRange || 1)));
    const v = opts.reduce((m, o) => Math.max(m, AI.hitValue(c, f, o, d)), 0);
    const broken = (c.weapons.find((w) => w.id === wid) || {}).durability === 0;
    c.wield = keep; c.status.dropped = dropped;
    return v > 0 && !broken;
  };
  // As AI.immuneTo (step 5), here so the count reads the same on code from before it.
  const immune = (c, t, o) => {
    if (!o || o.web || o.rust || o.spell || B.Effects.has(t, 'named')) return false;
    if (Combat.passesThrough ? Combat.passesThrough(c, t, o) : false) return true;
    const v = o.damage || [0, 0, 0];
    return !!(v[0] || v[1] || v[2]) && ['P', 'S', 'B'].every((k, i) => !v[i] || C.damageMult(t, k) === 0);
  };
  return {
    poll() {
      if (enc.round !== round) { closeRound(); round = enc.round; busy = false; }
      for (const d of enc.decls) {
        if (seen.has(d)) continue;
        seen.add(d);
        const c = chars[d.actor];
        if (!c) continue;
        if (ACT.has(d.type)) busy = true;
        if (d.spent) A.spent++;
        if (FEAT.includes(d.type)) A.feat[d.type] = (A.feat[d.type] || 0) + 1;
        if (d.type === 'cast' || (d.type === 'strike' && d.option && d.option.spell)) A.casts++;
        if (d.type === 'move' && !d.reaction && enc.pos[c.id] && was[c.id]) {
          // Came in: from outside a standing foe's reach to inside it.
          const entered = Object.values(chars).filter((f) => f.side !== c.side && C.isActive(f) && enc.pos[f.id] && Combat.dist(enc.pos[c.id], enc.pos[f.id]) <= meleeReach(f) && Combat.dist(was[c.id], enc.pos[f.id]) > meleeReach(f));
          // Bare: less AP left than a defence, and one of them with the AP for a blow (now, or on its turn to come).
          // ...and a blow from it worth fearing (AI.hitValue 10 or more: plate shrugs off much of a greatsword's thrust).
          const armed = (f) => {
            const d = Combat.dist(enc.pos[c.id], enc.pos[f.id]);
            const opts = C.attackOptions(f).filter((o) => !o.ranged && !o.spell && !o.windUp && C.inRange(o, d) && o.ap <= Combat.apLeft(enc, f.id));
            return opts.some((o) => AI.hitValue(f, c, o, d) >= 10);
          };
          if (entered.length) { A.intoReach++; if (Combat.apLeft(enc, c.id) < cheapestDefence(c) && entered.some(armed)) A.intoReachBare++; }
        }
        if (d.type === 'drawSidearm') {
          A.sidearm++;
          const n = nearestFoe(c);
          if (n && wield[c.id] && wield[c.id] !== c.sidearm && could(c, wield[c.id], n.f, n.d)) A.tradeDown++;
        }
        if (d.type === 'strike' && d.option && !d.option.web && !d.option.rust && chars[d.target] && enc.pos[d.target]) {
          A.strikes++;
          const t = chars[d.target];
          const h = Combat.computeHit(c, t, d.option, { distance: Combat.dist(enc.pos[c.id], enc.pos[t.id]) });
          const any = h.toCON + (h.pointToAttrs || 0) + h.slashToAttrs + h.bluntToCON + (h.crushToAttrs || 0) + (C.tireless(t) ? 0 : h.bluntToStamina);
          // A kick or a bash is also thrown for the fall it may cause: only one at a body immune to it counts.
          if (immune(c, t, d.option)) A.immune++;
          else if (!(any > 0) && !(d.option.spell && d.option.spell.noun) && d.option.unarmed !== 'kick' && d.option.unarmed !== 'shieldBash') A.worthless++;
        }
      }
      for (const c of Object.values(chars)) { wield[c.id] = c.wield; if (enc.pos[c.id]) was[c.id] = { x: enc.pos[c.id].x, y: enc.pos[c.id].y }; }
    },
    end() {
      this.poll();
      closeRound();
      A.casterFights += casters;
      // Spell points a caster still had at the end (of a fight it was in at the start): what it never used.
      for (const c of Object.values(chars)) { const mx = B.Magic ? B.Magic.maxSP(c) : 0; if (mx > 0) { A.spMax += mx; A.spLeft += Math.min(mx, B.Magic.availableSP(c)); } }
      for (const l of enc.log) if (/ overchannels: /.test(l.text || '')) A.overchannel++;
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
    half: M.half / n, quarter: M.quarter / n, collapses: M.collapses, gotUp: M.gotUp, downDied: M.downDied, downAtEnd: M.downAtEnd, downWon: M.downWon, hero: Object.assign({}, M.hero),
    heroDeaths: M.heroDeaths,
    attrWound: M.attrWound / n, heroAttrWound: M.heroFights ? M.heroAttrWound / M.heroFights : null,
    blows: shareOf(M.blows.all), heroBlows: shareOf(M.blows.heroes),
    locs: shareOf(M.locs.all), heroLocs: shareOf(M.locs.heroes), kills: shareOf(M.kills),
    located: located(M.locs.all), heroLocated: located(M.locs.heroes),
    ai: Object.assign({}, M.ai, { feat: Object.assign({}, M.ai.feat) }),
  };
}

const pc = (x) => (x == null ? '-' : Math.round(100 * x) + '%');
const fmtShares = (s) => Object.entries(s.share).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v)}`).join(', ') || 'none';

function report(M, indent) {
  const s = summary(M), I = indent == null ? '  ' : indent;
  return [
    `${I}metrics: ${s.fights} fights; rounds median ${s.medianRounds}, 90th ${s.p90Rounds}` + (s.heroesDead != null ? `; heroes dead a fight ${s.heroesDead.toFixed(2)}` : ''),
    `${I}  stamina: someone under ½ in ${pc(s.half)} of fights, under ¼ in ${pc(s.quarter)}; collapses ${s.collapses}, got up ${s.gotUp}, died down ${s.downDied}, down at the end ${s.downAtEnd} (${s.downWon} on the winning side)` + (s.hero.collapses ? `; heroes ${s.hero.collapses} / ${s.hero.gotUp} / ${s.hero.downDied} / ${s.hero.downAtEnd} (${s.hero.downWon})` : ''),
    `${I}  a survivor ends with a STR/DEX/SPD wound: ${pc(s.attrWound)} of fights` + (s.heroAttrWound != null ? ` (a hero: ${pc(s.heroAttrWound)})` : ''),
    `${I}  blows landed by action (${s.blows.total}): ${fmtShares(s.blows)}`,
    s.heroBlows.total ? `${I}    the heroes' (${s.heroBlows.total}): ${fmtShares(s.heroBlows)}` : null,
    `${I}  blows landed by location (${s.locs.total - (M.locs.all.none || 0)} with a location; ${M.locs.all.none || 0} without, spells and bursts): ${fmtShares(located(M.locs.all))}`,
    s.heroLocs.total ? `${I}    the heroes': ${fmtShares(located(M.locs.heroes))}` : null,
    `${I}  killing blows by action (${s.kills.total}): ${fmtShares(s.kills)}`,
    M.heroDeaths.n ? `${I}  heroes killed (${M.heroDeaths.n}): by ${fmtShares(shareOf(M.heroDeaths.action))}; at ${fmtShares(shareOf(M.heroDeaths.loc))}; down already ${pc(M.heroDeaths.down / M.heroDeaths.n)}, standing with AP left ${pc(M.heroDeaths.apLeft / M.heroDeaths.n)}, in round 1 ${pc(M.heroDeaths.round1 / M.heroDeaths.n)}; by ${fmtShares(shareOf(M.heroDeaths.byFoe))}` : null,
    `${I}  AI: moves into a foe's reach ${s.ai.intoReach}, with no defence left ${s.ai.intoReachBare} (${pc(s.ai.intoReach ? s.ai.intoReachBare / s.ai.intoReach : 0)}); sidearms drawn ${s.ai.sidearm}, trading down ${s.ai.tradeDown}; strikes ${s.ai.strikes}, at a body immune to them ${s.ai.immune}, that could do nothing else ${s.ai.worthless}`,
    `${I}    idle rounds ${s.ai.idleRounds} (${(s.ai.idleRounds / (s.fights || 1)).toFixed(2)} a fight), stand-offs ${s.ai.standOffs}; casts ${s.ai.casts} (${s.ai.casterFights ? (s.ai.casts / s.ai.casterFights).toFixed(2) : '-'} a caster a fight, ${s.ai.spMax ? pc(s.ai.spLeft / s.ai.spMax) : '-'} of spell points unspent at the end), overchannels ${s.ai.overchannel}; spent actions ${s.ai.spent}; feat actions ${Object.entries(s.ai.feat).map(([k, v]) => k + ' ' + v).join(', ') || 'none'}`,
  ].filter(Boolean);
}

module.exports = { ACTIONS, actionOf, create, summary, report };
