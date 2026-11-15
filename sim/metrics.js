/*
 * The tuning plan's metrics (docs/PLAN.md, targets table), gathered from a fight without changing it.
 *
 *   const M = Metrics.create();            // one per place or pairing
 *   const w = M.watch(enc, chars, heroIds); // when a fight starts (sets enc.onHit, chaining any observer already there)
 *   w.before(id);                           // before each action, with the actor's id (the tempo measures need it)
 *   w.poll();                               // after each action (cheap: reads stamina and status)
 *   w.end();                                // when the fight is over
 *   Metrics.report(M) → lines of text;  Metrics.summary(M) → the numbers
 *
 * What counts:
 *   rounds          enc.round at the end
 *   heroes dead     heroes alive at the start and dead at the end (the crawl's own column counts the dead so far):
 *                   finished (killed by a blow while down) or bled out (Combat.settleFallen at the fight's end)
 *   heroes down     heroes up at the start who went down from wounds in the fight (dead or not: step E's "down")
 *   below ½, ¼      any fighter (either side, not tireless) seen under half / a quarter of their maximum stamina,
 *                   seen after each blow and each action
 *   collapses       a fighter who goes down without dying (stamina 0: a collapse, CONFIG.stamina.collapse); "got
 *                   up": later in the same fight active again; "died down": killed while down; "down at the end":
 *                   still down when the fight ended (the side with nobody standing loses at once), and of those, how
 *                   many were on the side that won (they come round after it)
 *   wound           a fighter alive at the end with more wounds than at the start (step E: a survivor carries a wound)
 *   blows landed    each blow that reaches the body or armor (Combat.applyHit), by action and by location
 *   tempo           (docs/OVERHAUL.md step D, step F's "before"): see tempoWatch below
 *
 * Nothing here changes a fight: the watcher reads state and the log, and calls only functions that read
 * (tests/metrics-tempo.test.js checks that a watched fight ends exactly as an unwatched one).
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
    fights: 0, rounds: [], heroesDead: 0, heroesDown: 0, heroesBled: 0, heroFights: 0, woundSev: [0, 0, 0, 0],
    half: 0, quarter: 0, collapses: 0, gotUp: 0, downDied: 0, downAtEnd: 0, downWon: 0, hero: { collapses: 0, gotUp: 0, downDied: 0, downAtEnd: 0, downWon: 0 }, attrWound: 0, heroAttrWound: 0,
    blows: { all: {}, heroes: {} }, locs: { all: {}, heroes: {} }, kills: {},
    heroDeaths: { n: 0, action: {}, loc: {}, apLeft: 0, down: 0, round1: 0, byFoe: {} },
    tempo: newTempo(),
    ai: { intoReach: 0, intoReachBare: 0, sidearm: 0, tradeDown: 0, strikes: 0, worthless: 0, immune: 0, idleRounds: 0, standOffs: 0, feat: {}, casts: 0, casterFights: 0, spLeft: 0, spMax: 0, overchannel: 0, spent: 0 },
    watch(enc, chars, heroIds) { return watch(this, enc, chars, heroIds); },
  };
}

function watch(M, enc, chars, heroIds) {
  const heroes = new Set(heroIds || []);
  const start = {};
  const snap = (c) => ({ wounds: C.wounds(c).length, dead: !!c.status.dead, down: !C.isActive(c), woundDown: C.isDown(c) });
  const wentDown = new Set(); // heroes who went down from wounds in this fight
  for (const c of Object.values(chars)) start[c.id] = snap(c);
  const f = { half: false, quarter: false };
  const down = {}; // id → collapsed and not yet up
  const killed = new Set();
  const look = (c) => {
    const H = c && heroes.has(c.id) ? M.hero : null;
    if (c && c.status.dead && down[c.id]) { down[c.id] = false; M.downDied++; if (H) H.downDied++; }
    if (c && heroes.has(c.id) && (C.isDown(c) || c.status.dead) && start[c.id] && !start[c.id].dead && !start[c.id].woundDown) wentDown.add(c.id);
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
  const tempo = tempoWatch(M.tempo, enc, chars, heroes);
  const prev = enc.onHit;
  enc.onHit = (ev) => {
    if (prev) prev(ev);
    tempo.hit(ev);
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
    before(id) { tempo.before(id); },
    poll() { for (const c of Object.values(chars)) { if (!start[c.id]) start[c.id] = snap(c); look(c); } ai.poll(); tempo.after(); },
    end() {
      this.poll();
      ai.end();
      tempo.end();
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
        if (!s) continue;
        for (const w of C.wounds(c).slice(s.wounds)) M.woundSev[w.sev] = (M.woundSev[w.sev] || 0) + 1;
        if (c.status.dead) continue;
        if (C.wounds(c).length > s.wounds) { wound = true; if (heroes.has(c.id)) heroWound = true; }
      }
      if (wound) M.attrWound++;
      if (heroWound) M.heroAttrWound++;
      if (heroes.size) {
        M.heroFights++;
        for (const id of heroes) if (chars[id] && chars[id].status.dead && start[id] && !start[id].dead) { M.heroesDead++; if (!killed.has(id)) M.heroesBled++; }
        for (const id of heroes) if (chars[id] && (C.isDown(chars[id]) || chars[id].status.dead) && start[id] && !start[id].dead && !start[id].woundDown) wentDown.add(id);
        M.heroesDown += wentDown.size;
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
          const any = (h.pts || 0) + (C.tireless(t) ? 0 : (h.winding || 0) + (h.stamina || 0));
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


// ---- Tempo (docs/OVERHAUL.md step D, for step F) --------------------------------------------------------------------
// The measures read time only through a clock adapter, so step F's tick clock needs a new adapter, not new measures.
// An adapter answers, per fighter, "time available", "time spent on its own actions", "time spent on reactions" and
// "time unused" (lost or waited away), in its own unit, and says when now is:
//   clock.unit                      the unit's name ('AP' here; 'ticks' on step F's clock)
//   clock.before(id) / clock.after() around each action the fighter `id` takes on its own time
//   clock.newTurn(id)               true at a fighter's first action of a period (a round here): the start of its turn
//   clock.now()                     { period, at, t }: the round, the share of its turns gone (0 to 1), and t = period + at
//   clock.canPay(id, option)        whether the fighter could pay for the option now
//   clock.rolled(id)                AP rolled this round (BASELINE ONLY: the AP die goes in step F; null on a clock without it)
//   clock.close(final)              books the period's unused time; `final`: the fight ended in it (its leftover is
//                                   "cut", not "unused": nobody lost it, the fight was over)
//   clock.time                      id → { avail, own, react, unused, cut }
//
// The AP adapter (today's rules): a round's available AP is the AP rolled (enc.apStart); a fall in a fighter's AP during
// its own action is its own spending, except the defences it declared as reactions (decls with reaction: true; a
// riposte or opportunity strike it answers on its own turn is booked as its own); a fall in anyone else's is a
// reaction; what is left when the round ends is unused. AP owed from last round's rebound is booked as own spending.
function apClock(enc, chars) {
  const C = B.Character;
  const time = {}, prev = {}, rolledNow = {};
  let round = null, order = [], actor = null, mark = 0, turns = new Set();
  const T = (id) => time[id] || (time[id] = { avail: 0, own: 0, react: 0, unused: 0, cut: 0 });
  const closeRound = (final) => {
    for (const id of order) if (prev[id] != null) T(id)[final ? 'cut' : 'unused'] += Math.max(0, prev[id]);
  };
  const sync = () => {
    if (enc.round === round) return;
    if (round != null) closeRound(false);
    round = enc.round; order = (enc.order || []).slice(); turns = new Set();
    for (const k of Object.keys(prev)) delete prev[k];
    for (const id of order) {
      const start = enc.apStart[id] || 0;
      T(id).avail += start;
      rolledNow[id] = start;
      if (start > (enc.ap[id] || 0)) T(id).own += start - (enc.ap[id] || 0); // owed from a rebound
      prev[id] = enc.ap[id] || 0;
    }
  };
  return {
    unit: 'AP', scale: C.apScale(), time,
    before(id) { sync(); actor = id; mark = enc.decls.length; },
    newTurn(id) { sync(); if (turns.has(id)) return false; turns.add(id); return true; },
    after() {
      if (enc.round !== round) return; // nothing booked before the first before()
      const fresh = enc.decls.slice(mark);
      mark = enc.decls.length;
      for (const id of order) {
        if (prev[id] == null) continue;
        const cur = enc.ap[id] || 0, d = prev[id] - cur;
        prev[id] = cur;
        if (!d) continue;
        if (id === actor) {
          const r = fresh.filter((x) => x.actor === id && x.reaction).reduce((t, x) => t + (x.ap || 0), 0);
          T(id).own += d - r; T(id).react += r;
        } else T(id).react += d;
      }
    },
    now() { const n = (enc.order || []).length || 1; const at = Math.max(0, Math.min(1, (enc.turn < 0 ? 0 : enc.turn) / n)); return { period: enc.round, at, t: enc.round + at }; },
    canPay(id, o) { return (o.ap || 0) <= B.Combat.apLeft(enc, id); },
    rolled(id) { return B.CONFIG.apDie ? (rolledNow[id] != null ? rolledNow[id] : null) : null; },
    close(final) { if (round != null) closeRound(final); round = null; },
  };
}

function newTempo() {
  return {
    unit: 'AP', scale: 1,
    time: { all: zeroTime(), heroes: zeroTime(), foes: zeroTime() },
    first: { landed: { n: 0, won: 0, at: [], round1: 0, heroes: 0, heroesWon: 0 }, tried: { n: 0, won: 0, at: [], round1: 0 } },
    turns: { all: [0, 0], heroes: [0, 0], foes: [0, 0] }, // [turns with a foe in reach, of them with no attack]
    turnsHarm: { all: [0, 0], heroes: [0, 0], foes: [0, 0] }, // the same, a harmful blow in reach
    landed: 0, heavy: 0, heavyBy: {},
    windUps: { started: 0, released: 0, spoiled: 0, cantStart: 0 },
    byRolled: {}, // BASELINE ONLY (the AP die goes in step F): AP rolled that round → [fighter-rounds, of them on the side that won]
  };
}
const zeroTime = () => ({ avail: 0, own: 0, react: 0, unused: 0, cut: 0 });

// Heavy: an action with a lead before it lands: a wind-up (a power blow, a drawn bow, a gathered Strong spell) or a
// two-handed motion.
const isHeavy = (o) => !!o && (!!o.windUp || o.motion === 'twoHanded' || o.motion === 'power');

// What tempo counts:
//   time            per side, the clock's available time and the shares of it spent on own actions, on reactions and
//                   left unused (the last round's leftover is "cut" and out of the shares: the fight ended)
//   first blow      the first blow landed in a fight (a hit through Combat.applyHit) and the first tried (a strike or
//                   wind-up declared at a foe): whose side won the fight; when (round, and the share of the round's turns
//                   gone). Fights with no winner (timeouts) are left out.
//   waiting         a fighter's turn that began with a standing foe in reach of an attack it could pay for (in range, a
//                   shot or bolt in line), in which it made no attack (strike, wind-up, cast, grapple, trip, shove…):
//                   of such turns, the share with none; and the same counting only turns with a blow in reach that could
//                   harm the foe (a blow plate turns entirely is no reason to strike)
//   heavy           the share of blows landed that are heavy (isHeavy)
//   wind-ups        started (the log's "winds up" / "draws for"), released (a strike made from one), spoiled (lost
//                   before release: knocked down, grappled, disarmed, not released in time)
//   by AP rolled    BASELINE ONLY: each fighter-round's AP rolled, and whether that fighter's side won the fight
function tempoWatch(R, enc, chars, heroes) {
  const Combat = B.Combat, C = B.Character;
  const clock = apClock(enc, chars);
  R.unit = clock.unit; R.scale = clock.scale;
  const ATTACK = new Set(['strike', 'windUp', 'cast', 'trip', 'disarm', 'shove', 'clinch', 'grapple', 'pin', 'throw', 'kick', 'bash']);
  const logStart = enc.log.length;
  let firstLanded = null, firstTried = null, mark = 0, markRound = null;
  const pending = {}; // id → { inReach: { any, harm }, attacked } for this period
  const rolled = []; // [id, AP rolled]
  const foeOf = (a, t) => a && t && a.side && t.side && a.side !== t.side;
  // In reach: any attack it could pay for, in range (a shot or bolt in line); "harmful": one of those that could do
  // the foe some harm (Combat.computeHit's expectation above 0, as aiWatch's "worthless" reads it; a spell counts).
  const harmful = (c, f, o, d) => {
    if (o.spell) return true;
    const h = Combat.computeHit(c, f, o, { distance: d });
    return (h.pts || 0) + (C.tireless(f) ? 0 : (h.winding || 0) + (h.stamina || 0)) > 0;
  };
  const reach = (c) => {
    const out = { any: false, harm: false };
    const p = enc.pos[c.id];
    if (!p || !C.isActive(c)) return out;
    const opts = C.attackOptions(c).filter((o) => clock.canPay(c.id, o));
    for (const f of Object.values(chars)) {
      if (!foeOf(c, f) || !C.isActive(f) || !enc.pos[f.id]) continue;
      const d = Combat.dist(p, enc.pos[f.id]);
      for (const o of opts) {
        if (!C.inRange(o, d) || ((o.ranged || o.spell) && B.Terrain && enc.tiles && B.Terrain.lineCheck(enc, p, enc.pos[f.id], 'missile').blocked)) continue;
        out.any = true;
        if (harmful(c, f, o, d)) { out.harm = true; return out; }
      }
    }
    return out;
  };
  const settle = () => {
    for (const [id, x] of Object.entries(pending)) {
      const k = heroes.has(id) ? 'heroes' : 'foes';
      if (x.inReach.any) { R.turns.all[0]++; R.turns[k][0]++; if (!x.attacked) { R.turns.all[1]++; R.turns[k][1]++; } }
      if (x.inReach.harm) { R.turnsHarm.all[0]++; R.turnsHarm[k][0]++; if (!x.attacked) { R.turnsHarm.all[1]++; R.turnsHarm[k][1]++; } }
    }
    for (const k of Object.keys(pending)) delete pending[k];
  };
  return {
    before(id) {
      if (enc.round !== markRound) { settle(); markRound = enc.round; mark = 0; for (const x of enc.order || []) { const r = clock.rolled(x); if (r != null) rolled.push([x, r]); } }
      if (clock.newTurn(id) && chars[id]) pending[id] = { inReach: reach(chars[id]), attacked: false };
      clock.before(id);
    },
    after() {
      clock.after();
      if (enc.round !== markRound) return;
      for (const d of enc.decls.slice(mark)) {
        const a = chars[d.actor], t = chars[d.target];
        if (!a || !ATTACK.has(d.type) || d.reaction) continue;
        if (pending[a.id]) pending[a.id].attacked = true;
        if (!firstTried && (!t || foeOf(a, t)) && (t || d.type === 'cast')) firstTried = { side: a.side, now: clock.now() };
        if (d.type === 'strike' && d.option && d.option.windUp) R.windUps.released++;
      }
      mark = enc.decls.length;
    },
    hit(ev) {
      if (!ev || !ev.attacker || !ev.target || !foeOf(ev.attacker, ev.target)) return;
      if (!firstLanded) firstLanded = { side: ev.attacker.side, hero: heroes.has(ev.attacker.id), now: clock.now() };
      R.landed++;
      if (isHeavy(ev.option)) { R.heavy++; const a = actionOf(ev.option); R.heavyBy[a] = (R.heavyBy[a] || 0) + 1; }
    },
    end() {
      settle();
      clock.close(true);
      for (const [id, t] of Object.entries(clock.time)) {
        for (const k of ['all', heroes.has(id) ? 'heroes' : 'foes']) for (const f of Object.keys(t)) R.time[k][f] += t[f];
      }
      for (const l of enc.log.slice(logStart)) {
        const x = l.text || '';
        if (/ winds up .* — exposed| draws for a .* — exposed/.test(x)) R.windUps.started++;
        else if (/ can't wind up now\./.test(x)) R.windUps.cantStart++;
        else if (/ loses the wind-up| lost the wind-up/.test(x)) R.windUps.spoiled++;
      }
      const winner = enc.phase === 'over' && (enc.winner === 'party' || enc.winner === 'enemy') ? enc.winner : null;
      if (!winner) return;
      const F = R.first;
      if (firstLanded) {
        F.landed.n++; if (firstLanded.side === winner) F.landed.won++;
        F.landed.at.push(firstLanded.now.t); if (firstLanded.now.period <= 1) F.landed.round1++;
        if (firstLanded.hero) { F.landed.heroes++; if (firstLanded.side === winner) F.landed.heroesWon++; }
      }
      if (firstTried) {
        F.tried.n++; if (firstTried.side === winner) F.tried.won++;
        F.tried.at.push(firstTried.now.t); if (firstTried.now.period <= 1) F.tried.round1++;
      }
      for (const [id, r] of rolled) {
        if (!chars[id]) continue;
        const k = String(Math.round((r / clock.scale) * 2) / 2);
        const b = R.byRolled[k] || (R.byRolled[k] = [0, 0]);
        b[0]++; if (chars[id].side === winner) b[1]++;
      }
    },
  };
}

// A proportion and its binomial standard error.
const propSE = (k, n) => (n ? { p: k / n, se: Math.sqrt((k / n) * (1 - k / n) / n), n } : { p: null, se: null, n: 0 });

function tempoSummary(R) {
  const shares = (t) => { const a = t.own + t.react + t.unused; return { avail: t.avail / R.scale, own: t.own / R.scale, react: t.react / R.scale, unused: t.unused / R.scale, cut: t.cut / R.scale, ownShare: a ? t.own / a : null, reactShare: a ? t.react / a : null, unusedShare: a ? t.unused / a : null }; };
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    unit: R.unit,
    time: { all: shares(R.time.all), heroes: shares(R.time.heroes), foes: shares(R.time.foes) },
    firstLanded: Object.assign(propSE(R.first.landed.won, R.first.landed.n), { meanAt: mean(R.first.landed.at), round1: R.first.landed.n ? R.first.landed.round1 / R.first.landed.n : null, byHeroes: R.first.landed.n ? R.first.landed.heroes / R.first.landed.n : null, heroesWon: propSE(R.first.landed.heroesWon, R.first.landed.heroes) }),
    firstTried: Object.assign(propSE(R.first.tried.won, R.first.tried.n), { meanAt: mean(R.first.tried.at), round1: R.first.tried.n ? R.first.tried.round1 / R.first.tried.n : null }),
    waiting: { all: propSE(R.turns.all[1], R.turns.all[0]), heroes: propSE(R.turns.heroes[1], R.turns.heroes[0]), foes: propSE(R.turns.foes[1], R.turns.foes[0]) },
    waitingHarm: { all: propSE(R.turnsHarm.all[1], R.turnsHarm.all[0]), heroes: propSE(R.turnsHarm.heroes[1], R.turnsHarm.heroes[0]), foes: propSE(R.turnsHarm.foes[1], R.turnsHarm.foes[0]) },
    heavy: Object.assign(propSE(R.heavy, R.landed), { by: Object.assign({}, R.heavyBy) }),
    windUps: Object.assign({}, R.windUps, { spoiledShare: R.windUps.started ? R.windUps.spoiled / R.windUps.started : null }),
    byRolled: Object.entries(R.byRolled).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, [n, w]]) => Object.assign({ ap: Number(k) }, propSE(w, n))), // BASELINE ONLY
  };
}

function tempoReport(R, I) {
  const t = tempoSummary(R);
  const pe = (x) => (x.p == null ? '-' : `${Math.round(100 * x.p)}% ± ${Math.round(100 * x.se)} (n ${x.n})`);
  const tl = (k) => { const x = t.time[k]; return x.avail ? `${k} ${x.avail.toFixed(0)} ${t.unit}: own ${pc(x.ownShare)}, reactions ${pc(x.reactShare)}, unused ${pc(x.unusedShare)} (and ${x.cut.toFixed(0)} cut by the fight's end)` : null; };
  return [
    `${I}  tempo: first blow landed: its side won ${pe(t.firstLanded)}; landed at round ${t.firstLanded.meanAt == null ? '-' : t.firstLanded.meanAt.toFixed(2)} on average, in round 1 ${pc(t.firstLanded.round1)}` + (R.first.landed.heroes && R.first.landed.heroes < R.first.landed.n ? `; by the heroes ${pc(t.firstLanded.byHeroes)}, then won ${pe(t.firstLanded.heroesWon)}` : ''),
    `${I}    first blow tried: its side won ${pe(t.firstTried)}; tried at round ${t.firstTried.meanAt == null ? '-' : t.firstTried.meanAt.toFixed(2)} on average`,
    `${I}    waiting: turns begun with a foe in reach and no attack ${pe(t.waiting.all)}` + (R.turns.heroes[0] && R.turns.foes[0] ? `; heroes ${pe(t.waiting.heroes)}, foes ${pe(t.waiting.foes)}` : ''),
    `${I}    waiting with a harmful blow in reach ${pe(t.waitingHarm.all)}` + (R.turnsHarm.heroes[0] && R.turnsHarm.foes[0] ? `; heroes ${pe(t.waitingHarm.heroes)}, foes ${pe(t.waitingHarm.foes)}` : ''),
    `${I}    time (${t.unit}): ` + ['all', 'heroes', 'foes'].map(tl).filter(Boolean).join('; '),
    `${I}    heavy blows ${pe(t.heavy)} of blows landed (${Object.entries(t.heavy.by).map(([k, v]) => k + ' ' + v).join(', ') || 'none'}); wind-ups started ${t.windUps.started}, released ${t.windUps.released}, spoiled ${t.windUps.spoiled} (${pc(t.windUps.spoiledShare)})${t.windUps.cantStart ? `, could not start ${t.windUps.cantStart}` : ''}`,
    t.byRolled.length ? `${I}    [baseline only] the side's win rate by AP rolled that round (AP: win, fighter-rounds): ` + t.byRolled.map((x) => `${x.ap}: ${Math.round(100 * x.p)}% (${x.n})`).join(', ') : null,
  ].filter(Boolean);
}

const q = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const shareOf = (o) => { const t = Object.values(o).reduce((a, b) => a + b, 0); const out = {}; for (const [k, v] of Object.entries(o)) out[k] = t ? v / t : 0; return { total: t, share: out }; };

const located = (o) => shareOf(Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'none')));

function summary(M) {
  const n = M.fights || 1;
  return {
    fights: M.fights, medianRounds: q(M.rounds, 0.5), p90Rounds: q(M.rounds, 0.9),
    heroesDead: M.heroFights ? M.heroesDead / M.heroFights : null,
    heroesDown: M.heroFights ? M.heroesDown / M.heroFights : null, heroesBled: M.heroFights ? M.heroesBled / M.heroFights : null, woundSev: M.woundSev.slice(),
    half: M.half / n, quarter: M.quarter / n, collapses: M.collapses, gotUp: M.gotUp, downDied: M.downDied, downAtEnd: M.downAtEnd, downWon: M.downWon, hero: Object.assign({}, M.hero),
    heroDeaths: M.heroDeaths,
    attrWound: M.attrWound / n, heroAttrWound: M.heroFights ? M.heroAttrWound / M.heroFights : null,
    blows: shareOf(M.blows.all), heroBlows: shareOf(M.blows.heroes),
    locs: shareOf(M.locs.all), heroLocs: shareOf(M.locs.heroes), kills: shareOf(M.kills),
    located: located(M.locs.all), heroLocated: located(M.locs.heroes),
    ai: Object.assign({}, M.ai, { feat: Object.assign({}, M.ai.feat) }),
    tempo: tempoSummary(M.tempo),
  };
}

const pc = (x) => (x == null ? '-' : Math.round(100 * x) + '%');
const fmtShares = (s) => Object.entries(s.share).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v)}`).join(', ') || 'none';

function report(M, indent) {
  const s = summary(M), I = indent == null ? '  ' : indent;
  return [
    `${I}metrics: ${s.fights} fights; rounds median ${s.medianRounds}, 90th ${s.p90Rounds}` + (s.heroesDead != null ? `; heroes down a fight ${s.heroesDown.toFixed(2)}, dead a fight ${s.heroesDead.toFixed(2)} (bled out ${s.heroesBled.toFixed(2)}, struck down ${(s.heroesDead - s.heroesBled).toFixed(2)})` : ''),
    `${I}  stamina: someone under ½ in ${pc(s.half)} of fights, under ¼ in ${pc(s.quarter)}; collapses ${s.collapses}, got up ${s.gotUp}, died down ${s.downDied}, down at the end ${s.downAtEnd} (${s.downWon} on the winning side)` + (s.hero.collapses ? `; heroes ${s.hero.collapses} / ${s.hero.gotUp} / ${s.hero.downDied} / ${s.hero.downAtEnd} (${s.hero.downWon})` : ''),
    `${I}  a survivor ends with a wound: ${pc(s.attrWound)} of fights` + (s.heroAttrWound != null ? ` (a hero: ${pc(s.heroAttrWound)})` : '') + `; wounds dealt by severity 1/2/3: ${s.woundSev.slice(1).join(' / ')}`,
    `${I}  blows landed by action (${s.blows.total}): ${fmtShares(s.blows)}`,
    s.heroBlows.total ? `${I}    the heroes' (${s.heroBlows.total}): ${fmtShares(s.heroBlows)}` : null,
    `${I}  blows landed by location (${s.locs.total - (M.locs.all.none || 0)} with a location; ${M.locs.all.none || 0} without, spells and bursts): ${fmtShares(located(M.locs.all))}`,
    s.heroLocs.total ? `${I}    the heroes': ${fmtShares(located(M.locs.heroes))}` : null,
    `${I}  killing blows by action (${s.kills.total}): ${fmtShares(s.kills)}`,
    M.heroDeaths.n ? `${I}  heroes killed (${M.heroDeaths.n}): by ${fmtShares(shareOf(M.heroDeaths.action))}; at ${fmtShares(shareOf(M.heroDeaths.loc))}; down already ${pc(M.heroDeaths.down / M.heroDeaths.n)}, standing with AP left ${pc(M.heroDeaths.apLeft / M.heroDeaths.n)}, in round 1 ${pc(M.heroDeaths.round1 / M.heroDeaths.n)}; by ${fmtShares(shareOf(M.heroDeaths.byFoe))}` : null,
    `${I}  AI: moves into a foe's reach ${s.ai.intoReach}, with no defence left ${s.ai.intoReachBare} (${pc(s.ai.intoReach ? s.ai.intoReachBare / s.ai.intoReach : 0)}); sidearms drawn ${s.ai.sidearm}, trading down ${s.ai.tradeDown}; strikes ${s.ai.strikes}, at a body immune to them ${s.ai.immune}, that could do nothing else ${s.ai.worthless}`,
    `${I}    idle rounds ${s.ai.idleRounds} (${(s.ai.idleRounds / (s.fights || 1)).toFixed(2)} a fight), stand-offs ${s.ai.standOffs}; casts ${s.ai.casts} (${s.ai.casterFights ? (s.ai.casts / s.ai.casterFights).toFixed(2) : '-'} a caster a fight, ${s.ai.spMax ? pc(s.ai.spLeft / s.ai.spMax) : '-'} of spell points unspent at the end), overchannels ${s.ai.overchannel}; spent actions ${s.ai.spent}; feat actions ${Object.entries(s.ai.feat).map(([k, v]) => k + ' ' + v).join(', ') || 'none'}`,
  ].filter(Boolean).concat(tempoReport(M.tempo, I));
}

module.exports = { ACTIONS, actionOf, isHeavy, create, summary, report, apClock, tempoSummary, propSE };
