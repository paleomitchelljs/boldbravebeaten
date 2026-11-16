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
 *   beats           the beat the fight ended in (enc.now / CONFIG.clock.beat, rounded up)
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
    fights: 0, beats: [], heroesDead: 0, heroesDown: 0, heroesBled: 0, heroFights: 0, woundSev: [0, 0, 0, 0],
    half: 0, quarter: 0, collapses: 0, gotUp: 0, downDied: 0, downAtEnd: 0, downWon: 0, hero: { collapses: 0, gotUp: 0, downDied: 0, downAtEnd: 0, downWon: 0 }, attrWound: 0, heroAttrWound: 0,
    blows: { all: {}, heroes: {} }, locs: { all: {}, heroes: {} }, kills: {},
    heroDeaths: { n: 0, action: {}, loc: {}, apLeft: 0, down: 0, round1: 0, byFoe: {} },
    heroDowns: { n: 0, action: {}, loc: {}, byFoe: {}, sev: {} }, // blows that took a hero down (step E)
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
    if (ev.downed && ev.target && heroes.has(ev.target.id) && C.isDown(ev.target)) {
      const D = M.heroDowns, w = C.wounds(ev.target)[C.wounds(ev.target).length - 1];
      const who = ev.attacker ? String(ev.attacker.monster || ev.attacker.template || ev.attacker.name || '?') : '?';
      D.n++; D.action[a] = (D.action[a] || 0) + 1; D.loc[loc] = (D.loc[loc] || 0) + 1; D.byFoe[who] = (D.byFoe[who] || 0) + 1;
      const k = w ? `${w.sev}` : '?'; D.sev[k] = (D.sev[k] || 0) + 1;
    }
    // What kills a hero (step 6): the blow's action and place, whether they had AP left to meet it, were down already,
    // and the round; the killer by name (the template or monster, not the individual).
    if (ev.target && ev.target.status.dead && heroes.has(ev.target.id) && !(start[ev.target.id] || {}).dead && !killed.has(ev.target.id)) {
      killed.add(ev.target.id);
      const D = M.heroDeaths;
      D.n++;
      D.action[a] = (D.action[a] || 0) + 1;
      D.loc[loc] = (D.loc[loc] || 0) + 1;
      if (down[ev.target.id]) D.down++;
      else if (B.Combat.ahead(enc, ev.target.id) <= B.CONFIG.clock.overreach) D.apLeft++; // standing, near enough on the clock to have met the blow
      if ((enc.beat || 0) === 0) D.round1++;
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
      M.beats.push(Math.max(1, Math.ceil((enc.now || 0) / B.CONFIG.clock.beat)));
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
//   intoReach       moves that come in from outside a standing foe's melee reach to inside it; "bare": the mover too far
//                   ahead on the clock to react (CONFIG.clock.overreach) while one of those foes has a blow worth fearing
//                   there (AI.hitValue 10 or more): it walked in and can't meet it
//   sidearm         sidearms drawn; "trade down": while the weapon in hand could still hurt the nearest foe from where
//                   it stood (not inside its reach.min, not broken, the foe not immune to it)
//   immune          strikes at a body immune to every kind of harm they carry (AI.immuneTo)
//   worthless       other strikes that could do nothing to their target (the armor turns all of it; kicks and bashes,
//                   thrown for the fall too, aside)
//   idle beats      beats after the first in which nobody struck, cast or grappled while two foes stood within striking
//                   distance at the beat (the edge of a melee reach + 2, or in range and in line of a shot or bolt): the walk
//                   up across a big map doesn't count; a stand-off: three such beats in a row
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
  let round = enc.beat || 0, busy = false, idleRun = 0, stood = false;
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
    if (round > 0 && !busy && sides() && engaged()) { A.idleRounds++; idleRun++; if (idleRun >= 3 && !stood) { A.standOffs++; stood = true; } }
    else if (busy) idleRun = 0;
  };
  const meleeReach = (f) => Math.max(0, ...C.attackOptions(f).filter((o) => !o.ranged && !o.spell && !o.exposes).map((o) => o.maxRange || 1));
  const nearestFoe = (c) => {
    let best = null;
    for (const f of Object.values(chars)) if (f.side !== c.side && C.isActive(f) && enc.pos[f.id]) { const d = Combat.dist(enc.pos[c.id], enc.pos[f.id]); if (!best || d < best.d) best = { f, d }; }
    return best;
  };
  // The weapon it held (just dropped for the sidearm, if two-handed) as it was: in hand, not on the ground.
  const could = (c, wid, f, d) => {
    const keep = c.wield, dropped = c.status.dropped;
    c.wield = wid; c.status.dropped = dropped.filter((x) => x !== wid);
    const opts = C.attackOptions(c).filter((o) => !o.unarmed && C.inRange(o, d) && !(o.closePenalty && d <= (o.minRange || 1)));
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
      if ((enc.beat || 0) !== round) { closeRound(); round = enc.beat || 0; busy = false; }
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
          // Bare: too far ahead on the clock to react, and one of them with a blow worth fearing (AI.hitValue 10 or
          // more: plate shrugs off much of a greatsword's thrust).
          const armed = (f) => {
            const d = Combat.dist(enc.pos[c.id], enc.pos[f.id]);
            const opts = C.attackOptions(f).filter((o) => !o.ranged && !o.spell && !o.exposes && C.inRange(o, d));
            return opts.some((o) => AI.hitValue(f, c, o, d) >= 10);
          };
          if (entered.length) { A.intoReach++; if (Combat.ahead(enc, c.id) > B.CONFIG.clock.overreach && entered.some(armed)) A.intoReachBare++; }
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


// ---- Tempo (docs/OVERHAUL.md step D, restated in ticks for step F) --------------------------------------------------
// The measures read time through a clock adapter. On step F's clock, per fighter, in ticks:
//   own      the ticks of its own actions (an action's ticks, and what a block or parry rebounds onto it)
//   react    the ticks of its reactions (defences, covers, opportunity strikes, ripostes)
//   wait     ticks it chose to wait while a harmful blow was in reach (a deliberate wait: Combat.wait)
//   idle     ticks it waited with nothing in reach worth doing (nothing useful could be done)
//   cut      the part of a last action or wait still running when the fight ended (out of the shares)
// A wait lasts from the decision to the fighter's next one, less the reactions it made meanwhile.
function tickClock(enc, chars) {
  const time = {};
  const T = (id) => time[id] || (time[id] = { avail: 0, own: 0, react: 0, wait: 0, idle: 0, cut: 0 });
  const waiting = {}; // id → { at, deliberate, react (reaction ticks since) }
  let actor = null, mark = 0, before = null;
  const closeWait = (id) => {
    const w = waiting[id];
    if (!w) return;
    delete waiting[id];
    const span = Math.max(0, enc.now - w.at - w.react);
    T(id)[w.deliberate ? 'wait' : 'idle'] += span;
  };
  return {
    unit: 'ticks', scale: 1, time,
    before(id, deliberate) { actor = id; closeWait(id); mark = enc.decls.length; before = enc.clock[id]; this.deliberate = deliberate; },
    after() {
      const fresh = enc.decls.slice(mark);
      mark = enc.decls.length;
      for (const d of fresh) {
        if (!chars[d.actor]) continue;
        if (d.reaction || (d.opportunity && d.actor !== actor)) { T(d.actor).react += d.ticks || 0; if (waiting[d.actor]) waiting[d.actor].react += d.ticks || 0; continue; }
        if (d.actor !== actor || d.flurrySecond || d.sweep || d.whirl || d.cleave) continue;
        if (d.type === 'wait') waiting[actor] = { at: d.tick, deliberate: !!this.deliberate, react: 0 };
        else T(actor).own += d.ticks || 0;
      }
    },
    now() { return { period: (enc.beat || 0) + 1, at: (enc.now % B.CONFIG.clock.beat) / B.CONFIG.clock.beat, t: enc.now / B.CONFIG.clock.beat, tick: enc.now }; },
    canPay() { return true; },
    close() {
      for (const id of Object.keys(waiting)) {
        const w = waiting[id];
        delete waiting[id];
        T(id).cut += Math.max(0, enc.now - w.at - w.react);
      }
      for (const id of Object.keys(time)) { const t = time[id]; t.avail = t.own + t.react + t.wait + t.idle; }
    },
  };
}

function newTempo() {
  return {
    unit: 'ticks', scale: 1,
    time: { all: zeroTime(), heroes: zeroTime(), foes: zeroTime() },
    first: { landed: { n: 0, won: 0, at: [], round1: 0, heroes: 0, heroesWon: 0 }, tried: { n: 0, won: 0, at: [], round1: 0 } },
    turns: { all: [0, 0], heroes: [0, 0], foes: [0, 0] }, // [decisions with a foe in reach, of them a wait]
    turnsHarm: { all: [0, 0], heroes: [0, 0], foes: [0, 0] }, // the same, a harmful blow in reach
    reachTime: { all: [0, 0], heroes: [0, 0], foes: [0, 0] }, // [ticks of decisions with a harmful blow in reach, of them waited]
    landed: 0, heavy: 0, heavyBy: {},
    committed: { started: 0, landed: 0, spoiled: 0, exposed: 0 },
    mirror: {}, // a fighter's kind (its name) → [fights with a winner, of them won by the side that landed first] (duels --mirror)
  };
}
const zeroTime = () => ({ avail: 0, own: 0, react: 0, wait: 0, idle: 0, cut: 0 });

// Heavy: a two-handed or power blow, or one that commits the fighter exposed (a drawn bow, a gathered spell).
const isHeavy = (o) => !!o && (!!o.exposes || o.motion === 'twoHanded' || o.motion === 'power');

// What tempo counts:
//   time            per side, the ticks of own actions, reactions, deliberate waits and idle waits (tickClock)
//   first blow      the first blow landed in a fight (a hit through Combat.applyHit) and the first tried (a strike or
//                   cast declared at a foe): whose side won the fight; when (the beat, and the tick). Fights with no
//                   winner (timeouts) are left out.
//   waiting         decisions taken with a standing foe in reach of an attack (in range, a shot or bolt in line) that
//                   were a wait: of such decisions, the share; and the same counting only decisions with a blow in reach
//                   that could harm the foe. In time: of the ticks that followed decisions with a harmful blow in reach,
//                   the share spent waiting (the plan's "under 15% of the fight waiting").
//   heavy           the share of blows landed that are heavy (isHeavy)
//   committed       actions with a lead: started, landed, spoiled before they landed (knocked down, grappled,
//                   disarmed, put down); exposed: of those, a power blow, a drawn bow or a gathered spell
function tempoWatch(R, enc, chars, heroes) {
  const Combat = B.Combat, C = B.Character;
  const clock = tickClock(enc, chars);
  R.unit = clock.unit; R.scale = clock.scale;
  const ATTACK = new Set(['strike', 'cast', 'trip', 'disarm', 'shove', 'clinch', 'grapple', 'pin', 'throw', 'kick', 'bash']);
  let firstLanded = null, firstTried = null, mark = 0;
  let pending = null; // the decision being taken: { id, inReach }
  const foeOf = (a, t) => a && t && a.side && t.side && a.side !== t.side;
  // In reach: any attack in range (a shot or bolt in line); "harmful": one of those that could do the foe some harm
  // (Combat.computeHit's expectation above 0, as aiWatch's "worthless" reads it; a spell counts).
  const harmful = (c, f, o, d) => {
    if (o.spell) return true;
    const h = Combat.computeHit(c, f, o, { distance: d });
    return (h.pts || 0) + (C.tireless(f) ? 0 : (h.winding || 0) + (h.stamina || 0)) > 0;
  };
  const reach = (c) => {
    const out = { any: false, harm: false };
    const p = enc.pos[c.id];
    if (!p || !C.isActive(c)) return out;
    const opts = C.attackOptions(c).filter((o) => !(o.ranged && o.weaponId && !o.natural && C.ammoLeft(c, o) <= 0));
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
  const book = (id, waited, ticks) => {
    const x = pending;
    if (!x) return;
    const k = heroes.has(id) ? 'heroes' : 'foes';
    if (x.inReach.any) { R.turns.all[0]++; R.turns[k][0]++; if (waited) { R.turns.all[1]++; R.turns[k][1]++; } }
    if (x.inReach.harm) {
      R.turnsHarm.all[0]++; R.turnsHarm[k][0]++; if (waited) { R.turnsHarm.all[1]++; R.turnsHarm[k][1]++; }
      R.reachTime.all[0] += ticks; R.reachTime[k][0] += ticks; if (waited) { R.reachTime.all[1] += ticks; R.reachTime[k][1] += ticks; }
    }
  };
  const waitStarts = {}; // id → the tick and whether a harmful blow was in reach, for the time measure
  return {
    before(id) {
      const c = chars[id];
      // A wait that ends now: its ticks go to the decision that began it.
      const w = waitStarts[id];
      if (w) { delete waitStarts[id]; pending = w.pending; book(id, true, Math.max(0, enc.now - w.at)); }
      pending = c ? { id, inReach: reach(c) } : null;
      clock.before(id, !!(pending && pending.inReach.harm));
      mark = enc.decls.length;
    },
    after() {
      const fresh = enc.decls.slice(mark);
      clock.after();
      mark = enc.decls.length;
      const me = pending && pending.id;
      for (const d of fresh) {
        const a = chars[d.actor], t = chars[d.target];
        if (!a) continue;
        if (d.actor === me && !d.reaction && !d.opportunity) {
          if (d.type === 'wait') waitStarts[me] = { at: d.tick, pending };
          else book(me, false, d.ticks || 0);
          if (d.lead > 0) { R.committed.started++; if (d.option && d.option.exposes) R.committed.exposed++; }
        }
        if (!ATTACK.has(d.type) || d.reaction) continue;
        if (!firstTried && (!t || foeOf(a, t)) && (t || d.type === 'cast')) firstTried = { side: a.side, now: clock.now() };
      }
      pending = null;
    },
    hit(ev) {
      if (!ev || !ev.attacker || !ev.target || !foeOf(ev.attacker, ev.target)) return;
      if (!firstLanded) firstLanded = { side: ev.attacker.side, hero: heroes.has(ev.attacker.id), name: ev.attacker.name, now: clock.now() };
      R.landed++;
      if (isHeavy(ev.option)) { R.heavy++; const a = actionOf(ev.option); R.heavyBy[a] = (R.heavyBy[a] || 0) + 1; }
    },
    end() {
      for (const [id, w] of Object.entries(waitStarts)) { pending = w.pending; book(id, true, Math.max(0, enc.now - w.at)); }
      clock.close();
      for (const [id, t] of Object.entries(clock.time)) {
        for (const k of ['all', heroes.has(id) ? 'heroes' : 'foes']) for (const f of Object.keys(t)) R.time[k][f] += t[f];
      }
      for (const d of enc.decls) if (d.lead > 0 && !d.reaction) { if (d.spoiled) R.committed.spoiled++; else if (d.done) R.committed.landed++; }
      const winner = enc.phase === 'over' && (enc.winner === 'party' || enc.winner === 'enemy') ? enc.winner : null;
      if (!winner) return;
      const F = R.first;
      if (firstLanded) {
        F.landed.n++; if (firstLanded.side === winner) F.landed.won++;
        F.landed.at.push(firstLanded.now.t); if (firstLanded.now.period <= 1) F.landed.round1++;
        if (firstLanded.hero) { F.landed.heroes++; if (firstLanded.side === winner) F.landed.heroesWon++; }
        // A mirror (both sides the same kind): the first landing blow's side won, by kind.
        const kinds = new Set(Object.values(chars).filter((c) => !c.conjured).map((c) => String(c.name).replace(/\s*\(?\b(twin|B|2)\)?$/i, '')));
        if (kinds.size === 1) { const k = [...kinds][0]; const m = R.mirror[k] || (R.mirror[k] = [0, 0]); m[0]++; if (firstLanded.side === winner) m[1]++; }
      }
      if (firstTried) {
        F.tried.n++; if (firstTried.side === winner) F.tried.won++;
        F.tried.at.push(firstTried.now.t); if (firstTried.now.period <= 1) F.tried.round1++;
      }
    },
  };
}

// A proportion and its binomial standard error.
const propSE = (k, n) => (n ? { p: k / n, se: Math.sqrt((k / n) * (1 - k / n) / n), n } : { p: null, se: null, n: 0 });

function tempoSummary(R) {
  const shares = (t) => { const a = t.own + t.react + t.wait + t.idle; return { avail: a, own: t.own, react: t.react, wait: t.wait, idle: t.idle, cut: t.cut, ownShare: a ? t.own / a : null, reactShare: a ? t.react / a : null, waitShare: a ? t.wait / a : null, idleShare: a ? t.idle / a : null }; };
  const tshare = (x) => ({ p: x[0] ? x[1] / x[0] : null, ticks: x[0] });
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    unit: R.unit,
    time: { all: shares(R.time.all), heroes: shares(R.time.heroes), foes: shares(R.time.foes) },
    firstLanded: Object.assign(propSE(R.first.landed.won, R.first.landed.n), { meanAt: mean(R.first.landed.at), round1: R.first.landed.n ? R.first.landed.round1 / R.first.landed.n : null, byHeroes: R.first.landed.n ? R.first.landed.heroes / R.first.landed.n : null, heroesWon: propSE(R.first.landed.heroesWon, R.first.landed.heroes) }),
    firstTried: Object.assign(propSE(R.first.tried.won, R.first.tried.n), { meanAt: mean(R.first.tried.at), round1: R.first.tried.n ? R.first.tried.round1 / R.first.tried.n : null }),
    waiting: { all: propSE(R.turns.all[1], R.turns.all[0]), heroes: propSE(R.turns.heroes[1], R.turns.heroes[0]), foes: propSE(R.turns.foes[1], R.turns.foes[0]) },
    waitingHarm: { all: propSE(R.turnsHarm.all[1], R.turnsHarm.all[0]), heroes: propSE(R.turnsHarm.heroes[1], R.turnsHarm.heroes[0]), foes: propSE(R.turnsHarm.foes[1], R.turnsHarm.foes[0]) },
    waitingTime: { all: tshare(R.reachTime.all), heroes: tshare(R.reachTime.heroes), foes: tshare(R.reachTime.foes) },
    heavy: Object.assign(propSE(R.heavy, R.landed), { by: Object.assign({}, R.heavyBy) }),
    committed: Object.assign({}, R.committed, { spoiledShare: R.committed.started ? R.committed.spoiled / R.committed.started : null }),
    mirror: Object.entries(R.mirror).map(([k, [n, w]]) => Object.assign({ kind: k }, propSE(w, n))),
  };
}

function tempoReport(R, I) {
  const t = tempoSummary(R);
  const pe = (x) => (x.p == null ? '-' : `${Math.round(100 * x.p)}% ± ${Math.round(100 * x.se)} (n ${x.n})`);
  const tl = (k) => { const x = t.time[k]; return x.avail ? `${k} ${x.avail.toFixed(0)} ${t.unit}: own ${pc(x.ownShare)}, reactions ${pc(x.reactShare)}, waits ${pc(x.waitShare)}, idle ${pc(x.idleShare)} (and ${x.cut.toFixed(0)} cut by the fight's end)` : null; };
  const wt = (k) => (t.waitingTime[k].p == null ? '-' : pc(t.waitingTime[k].p));
  return [
    `${I}  tempo: first blow landed: its side won ${pe(t.firstLanded)}; landed at beat ${t.firstLanded.meanAt == null ? '-' : t.firstLanded.meanAt.toFixed(2)} on average, in beat 1 ${pc(t.firstLanded.round1)}` + (R.first.landed.heroes && R.first.landed.heroes < R.first.landed.n ? `; by the heroes ${pc(t.firstLanded.byHeroes)}, then won ${pe(t.firstLanded.heroesWon)}` : ''),
    `${I}    first blow tried: its side won ${pe(t.firstTried)}; tried at beat ${t.firstTried.meanAt == null ? '-' : t.firstTried.meanAt.toFixed(2)} on average`,
    t.mirror.length ? `${I}    mirrors, first blow landed won: ` + t.mirror.map((m) => `${m.kind} ${pe(m)}`).join('; ') : null,
    `${I}    waiting: decisions with a foe in reach that were a wait ${pe(t.waiting.all)}` + (R.turns.heroes[0] && R.turns.foes[0] ? `; heroes ${pe(t.waiting.heroes)}, foes ${pe(t.waiting.foes)}` : ''),
    `${I}    waiting with a harmful blow in reach ${pe(t.waitingHarm.all)}` + (R.turnsHarm.heroes[0] && R.turnsHarm.foes[0] ? `; heroes ${pe(t.waitingHarm.heroes)}, foes ${pe(t.waitingHarm.foes)}` : '') + `; in time ${wt('all')} of ${t.waitingTime.all.ticks} ticks (heroes ${wt('heroes')}, foes ${wt('foes')})`,
    `${I}    time (${t.unit}): ` + ['all', 'heroes', 'foes'].map(tl).filter(Boolean).join('; '),
    `${I}    heavy blows ${pe(t.heavy)} of blows landed (${Object.entries(t.heavy.by).map(([k, v]) => k + ' ' + v).join(', ') || 'none'}); actions with a lead started ${t.committed.started} (exposed ${t.committed.exposed}), landed ${t.committed.landed}, spoiled ${t.committed.spoiled} (${pc(t.committed.spoiledShare)})`,
  ].filter(Boolean);
}

const q = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const shareOf = (o) => { const t = Object.values(o).reduce((a, b) => a + b, 0); const out = {}; for (const [k, v] of Object.entries(o)) out[k] = t ? v / t : 0; return { total: t, share: out }; };

const located = (o) => shareOf(Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'none')));

function summary(M) {
  const n = M.fights || 1;
  return {
    fights: M.fights, medianBeats: q(M.beats, 0.5), p90Beats: q(M.beats, 0.9),
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
    `${I}metrics: ${s.fights} fights; beats median ${s.medianBeats}, 90th ${s.p90Beats}` + (s.heroesDead != null ? `; heroes down a fight ${s.heroesDown.toFixed(2)}, dead a fight ${s.heroesDead.toFixed(2)} (bled out ${s.heroesBled.toFixed(2)}, struck down ${(s.heroesDead - s.heroesBled).toFixed(2)})` : ''),
    `${I}  stamina: someone under ½ in ${pc(s.half)} of fights, under ¼ in ${pc(s.quarter)}; collapses ${s.collapses}, got up ${s.gotUp}, died down ${s.downDied}, down at the end ${s.downAtEnd} (${s.downWon} on the winning side)` + (s.hero.collapses ? `; heroes ${s.hero.collapses} / ${s.hero.gotUp} / ${s.hero.downDied} / ${s.hero.downAtEnd} (${s.hero.downWon})` : ''),
    `${I}  a survivor ends with a wound: ${pc(s.attrWound)} of fights` + (s.heroAttrWound != null ? ` (a hero: ${pc(s.heroAttrWound)})` : '') + `; wounds dealt by severity 1/2/3: ${s.woundSev.slice(1).join(' / ')}`,
    `${I}  blows landed by action (${s.blows.total}): ${fmtShares(s.blows)}`,
    s.heroBlows.total ? `${I}    the heroes' (${s.heroBlows.total}): ${fmtShares(s.heroBlows)}` : null,
    `${I}  blows landed by location (${s.locs.total - (M.locs.all.none || 0)} with a location; ${M.locs.all.none || 0} without, spells and bursts): ${fmtShares(located(M.locs.all))}`,
    s.heroLocs.total ? `${I}    the heroes': ${fmtShares(located(M.locs.heroes))}` : null,
    `${I}  killing blows by action (${s.kills.total}): ${fmtShares(s.kills)}`,
    M.heroDowns.n ? `${I}  heroes downed by a blow (${M.heroDowns.n}): by ${fmtShares(shareOf(M.heroDowns.action))}; at ${fmtShares(shareOf(M.heroDowns.loc))}; the last wound's severity ${fmtShares(shareOf(M.heroDowns.sev))}; by ${fmtShares(shareOf(M.heroDowns.byFoe))}` : null,
    M.heroDeaths.n ? `${I}  heroes killed (${M.heroDeaths.n}): by ${fmtShares(shareOf(M.heroDeaths.action))}; at ${fmtShares(shareOf(M.heroDeaths.loc))}; down already ${pc(M.heroDeaths.down / M.heroDeaths.n)}, standing and able to react ${pc(M.heroDeaths.apLeft / M.heroDeaths.n)}, in beat 1 ${pc(M.heroDeaths.round1 / M.heroDeaths.n)}; by ${fmtShares(shareOf(M.heroDeaths.byFoe))}` : null,
    `${I}  AI: moves into a foe's reach ${s.ai.intoReach}, unable to react ${s.ai.intoReachBare} (${pc(s.ai.intoReach ? s.ai.intoReachBare / s.ai.intoReach : 0)}); sidearms drawn ${s.ai.sidearm}, trading down ${s.ai.tradeDown}; strikes ${s.ai.strikes}, at a body immune to them ${s.ai.immune}, that could do nothing else ${s.ai.worthless}`,
    `${I}    idle beats ${s.ai.idleRounds} (${(s.ai.idleRounds / (s.fights || 1)).toFixed(2)} a fight), stand-offs ${s.ai.standOffs}; casts ${s.ai.casts} (${s.ai.casterFights ? (s.ai.casts / s.ai.casterFights).toFixed(2) : '-'} a caster a fight, ${s.ai.spMax ? pc(s.ai.spLeft / s.ai.spMax) : '-'} of spell points unspent at the end), overchannels ${s.ai.overchannel}; spent actions ${s.ai.spent}; feat actions ${Object.entries(s.ai.feat).map(([k, v]) => k + ' ' + v).join(', ') || 'none'}`,
  ].filter(Boolean).concat(tempoReport(M.tempo, I));
}

module.exports = { ACTIONS, actionOf, isHeavy, create, summary, report, tickClock, tempoSummary, propSE };
