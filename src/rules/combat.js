/*
 * Combat engine: round structure, actions, reactions, resolution, damage.
 *
 * Terms:
 *   Round     starts with everyone rolling their AP (f(SPD) + a die − fatigue; the order is the AP rolled) and ends when
 *             everyone has had their turn; then bleed, regeneration, fatigue. Unspent AP is lost.
 *   Turn      one character's go, in initiative order: as many actions as their AP pays for.
 *             Each action resolves as it is taken.
 *   Reaction  something done out of turn, paid from the same AP pool: a block, parry or dodge
 *             when a blow comes at you, or an opportunity strike at a foe who leaves your reach.
 *             AP kept back from your turn is AP to react with; AP spent reacting is gone from it.
 *
 * So the faster side sets the rhythm: whoever acts first makes the others spend their pool
 * answering, and a fighter who has spent theirs takes what comes on their armor.
 *
 * Every die roll goes through an async io.roller(request) and every reaction through an async
 * io.react(request), so the UI can ask the player, or the AI can decide.
 */
(function (G) {
  'use strict';
  const CONFIG = G.CONFIG;
  const { WEAPONS, MOTIONS, ACTIONS } = G.DATA;
  const C = G.Character;
  const Items = G.Items;

  const GRAPPLE_STEPS = ['clinch', 'grapple', 'pin', 'throw', 'break'];
  const FEAT_OTHER = ['vanish', 'feign', 'rally', 'command', 'rouse'];
  const ATTACK_TYPES = ['strike', 'trip', 'disarm', 'shove'].concat(GRAPPLE_STEPS);
  // Defences are reactions: taken when a blow comes, paid from the defender's AP.
  const DEFENSE_TYPES = ['block', 'parry', 'dodge', 'offParry'];

  // ---- Encounter setup ---------------------------------------------------
  function createEncounter(name, ids, chars, w, h) {
    const enc = {
      id: Items.uid('enc'), name: name || 'Encounter', round: 0, phase: 'setup',
      ids: ids.slice(), grid: { w: w || 10, h: h || 8 }, pos: {},
      initiative: {}, order: [], ap: {}, apStart: {}, conceded: {}, pass: 1, turn: 0, step: 'turns',
      spent: {}, turnDone: {},
      decls: [], seq: 0, log: [], hitThisRound: {}, fortressUsed: {}, startedAt: Date.now(),
    };
    autoPlace(enc, chars);
    return enc;
  }

  function autoPlace(enc, chars) {
    const party = enc.ids.filter((id) => chars[id].side === 'party');
    const foes = enc.ids.filter((id) => chars[id].side !== 'party');
    const midY = Math.floor(enc.grid.h / 2);
    const place = (list, x) => {
      list.forEach((id, i) => {
        const off = i % 2 === 0 ? i / 2 : -Math.ceil(i / 2);
        let y = midY + off;
        let col = x;
        if (y < 0 || y >= enc.grid.h) {
          y = ((y % enc.grid.h) + enc.grid.h) % enc.grid.h;
          col = x + (x === 1 ? 1 : -1);
        }
        enc.pos[id] = { x: col, y };
      });
    };
    place(party, 1);
    place(foes, enc.grid.w - 2);
  }

  function dist(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  function log(enc, text, cls) {
    enc.log.push({ round: enc.round, text, cls: cls || '' });
  }

  async function rollDie(roller, actorId, sides, label, detail) {
    const r = await roller({ actorId, sides, count: 1, label, detail });
    return Math.max(1, Math.min(sides, r[0]));
  }

  // ---- Round start -------------------------------------------------------
  // Auras (trait aura: { radius, stamina, cond }): at the start of each round every foe within
  // the radius loses stamina and takes the condition for the round.
  async function auras(enc, chars, roller) {
    for (const id of enc.ids) {
      const c = chars[id];
      if (!c || !C.isActive(c) || !enc.pos[id]) continue;
      // A creature's own aura, and any its gear gives (a mail that breathes poison).
      for (const A of G.Effects.list(c, 'aura')) await aura(enc, chars, c, A, roller);
    }
  }

  async function aura(enc, chars, c, A, roller) {
    const id = c.id;
    const hit = enc.ids.filter((o) => chars[o] && chars[o].side !== c.side && C.isActive(chars[o]) && enc.pos[o] && dist(enc.pos[id], enc.pos[o]) <= A.radius);
    for (const o of hit) {
      const t = chars[o];
      if (A.stamina && !C.tireless(t)) { t.stamina = Math.max(0, t.stamina - A.stamina); C.updateCondition(t); }
      if (A.cond && G.Conditions) {
        // A resisted aura (a spectre's wail) is contested like a spell; otherwise it simply takes hold.
        if (A.resisted && G.Magic && t === chars[hit[0]]) log(enc, `${c.name}'s ${A.name || 'aura'} rises over ${hit.map((o) => chars[o].name).join(', ')}.`, 'hit');
        if (A.resisted && G.Magic) await G.Magic.afflict(enc, c, t, A.cond, { rounds: A.rounds || 1, mag: A.mag || 1 }, roller);
        else G.Conditions.add(t, A.cond, { rounds: A.rounds || 1, src: id });
      }
    }
    if (hit.length && !A.resisted) log(enc, `${c.name}'s ${A.name || 'aura'} falls on ${hit.map((o) => chars[o].name).join(', ')}${A.stamina ? ` (−${A.stamina} stamina` : ' ('}${A.cond ? `${A.stamina ? ', ' : ''}${CONFIG.conditions[A.cond].name.toLowerCase()}` : ''}).`, 'hit');
  }

  async function startRound(enc, chars, roller) {
    enc.round += 1;
    // Stamina at the round's start, so its end can tell how much each fighter spent (CONFIG.weariness.perStamina).
    enc.staminaAtStart = {};
    for (const id of enc.ids) if (chars[id]) enc.staminaAtStart[id] = chars[id].stamina;
    // The first round: wards, boons and runes laid in advance by ritual take hold.
    if (enc.round === 1 && G.Ritual) for (const line of G.Ritual.applyPrepared(enc, chars)) log(enc, line, 'pass');
    await auras(enc, chars, roller);
    enc.phase = 'initiative';
    enc.decls = [];
    enc.conceded = {};
    enc.hitThisRound = {};
    enc.burned = {};
    enc.fortressUsed = {};
    enc.turnDone = {};
    enc.dodged = {};
    enc.fled = {};
    enc.turn = -1;
    enc.initiative = {};
    const active = enc.ids.filter((id) => C.isActive(chars[id]));
    const sp = enc.surprise;
    const rolled = {};
    for (const id of active) {
      const c = chars[id];
      const spd = C.combatAttr(c, 'SPD');
      const gear = G.Effects.sum(c, 'init');
      if (CONFIG.apDie) {
        // The round's AP (CONFIG.apDie): rolled, and the order is the AP rolled, most first. Surprise (an ambush, a
        // trap sprung) leaves that side part of its AP, and so later in the order.
        const r = await rollDie(roller, id, CONFIG.apDie, 'AP', `d${CONFIG.apDie} + ${CONFIG.apBase} + SPD/${CONFIG.apSpdDivisor}`);
        rolled[id] = C.apPool(c, r);
        if (sp && sp.round === enc.round && c.side === sp.side) rolled[id] = Math.floor(rolled[id] * sp.factor);
        enc.initiative[id] = rolled[id] + gear * C.apScale() / 100; // gear's `init` breaks a tie
      } else {
        const r = await rollDie(roller, id, CONFIG.initiativeDie, 'Initiative', `d${CONFIG.initiativeDie} + SPD ${spd}${gear ? ` + ${gear} (gear)` : ''}`);
        enc.initiative[id] = r + spd + gear;
      }
    }
    enc.order = active.slice().sort((a, b) => {
      const d = enc.initiative[b] - enc.initiative[a];
      if (d) return d;
      return C.combatAttr(chars[b], 'SPD') - C.combatAttr(chars[a], 'SPD');
    });
    for (const id of enc.order) {
      if (CONFIG.apDie) enc.ap[id] = rolled[id];
      else {
        enc.ap[id] = C.apPool(chars[id]);
        if (sp && sp.round === enc.round && chars[id].side === sp.side) enc.ap[id] = Math.floor(enc.ap[id] * sp.factor);
      }
      enc.apStart[id] = enc.ap[id];
      // AP owed from a blow that rebounded last round (CONFIG.defense.rebound.carry): already spent.
      const owed = enc.owed && enc.owed[id];
      if (owed) enc.ap[id] = Math.max(0, enc.ap[id] - owed);
    }
    enc.owed = {};
    if (enc.surprise && enc.surprise.round === enc.round) log(enc, `${enc.surprise.side === 'party' ? 'The party is' : 'The enemy is'} caught off guard.`, 'round');
    log(enc, CONFIG.apDie
      ? `Round ${enc.round} — AP rolled: ` + enc.order.map((id) => `${chars[id].name} ${C.fmtAP(enc.apStart[id])}`).join(', ')
      : `Round ${enc.round} — initiative: ` + enc.order.map((id) => `${chars[id].name} ${enc.initiative[id]}`).join(', '), 'round');
    await advance(enc, chars, { roller });
    return enc;
  }

  // ---- Turns and reactions --------------------------------------------------
  // AP this character has left this round (for their turn, and for reactions on anyone's turn).
  function apLeft(enc, id) {
    return Math.max(0, enc.ap[id] || 0);
  }

  // Ask the reactor what they do: the host's react(req) (a player prompt, or the AI for
  // computer-run fighters), or the AI when the host gave none. Resolves to the chosen
  // option's type/key, or null for "no reaction".
  function react(enc, chars, req, io) {
    if (io && io.react) return Promise.resolve(io.react(req, enc, chars));
    return Promise.resolve(G.AI ? G.AI.react(enc, chars, req) : null);
  }

  // Defences this character could put up against an attack right now, with their cost and odds.
  // A hidden attack (Feint over Read Attack) offers every defence the defender could make in
  // general, with no odds: they choose blind, and a defence that can't meet the blow is wasted.
  function defenseOptions(enc, chars, t, a, d) {
    if (!C.isActive(t) || GRAPPLE_STEPS.includes(d.type)) return { hidden: false, options: [] };
    const hidden = describeBare(enc, chars, d, t.id).hidden;
    const free = C.rank(t, 'untouchable') && enc.dodged && enc.dodged[t.id];
    const motion = d.type === 'strike' ? d.option.motion : 'maneuver';
    const options = [];
    for (const kind of DEFENSE_TYPES) {
      if (kind === 'offParry' && !C.offhandWeapon(t)) continue;
      if (conditionForbids(enc, chars, t, { type: kind, target: a.id })) continue;
      if (defenseUnavailable(t, kind, hidden ? null : d, chars, enc)) continue;
      let { ap, stamina } = C.actionCost(t, kind);
      if (kind === 'dodge' && free) { ap = 0; stamina = 0; }
      if (ap > apLeft(enc, t.id)) continue;
      const spent = isSpent(t, stamina);
      options.push(Object.assign({ type: kind, name: ACTIONS[kind].name, ap, stamina, odds: hidden ? null : defenseOdds(t, kind, motion, a, d.option, spent ? -CONFIG.stamina.spent.defense : 0, enc) }, spent ? { spent } : {}));
    }
    return { hidden, options };
  }

  // The defender's reaction to an attack about to land: pays its AP and returns the defence, or null.
  async function askDefense(enc, chars, t, a, d, io) {
    const { hidden, options } = defenseOptions(enc, chars, t, a, d);
    if (!options.length) return null;
    const pick = await react(enc, chars, { kind: 'defend', actor: t.id, attacker: a.id, decl: d, hidden, options, ap: apLeft(enc, t.id) }, io);
    const o = options.find((x) => x.type === pick);
    if (!o) return null;
    enc.ap[t.id] -= o.ap;
    if (o.type === 'dodge' && C.rank(t, 'untouchable')) (enc.dodged || (enc.dodged = {}))[t.id] = true;
    enc.decls.push({ actor: t.id, type: o.type, against: a.id, reaction: true, ap: o.ap, stamina: o.stamina, n: ++enc.seq, done: true });
    return o;
  }

  // Cover (CONFIG.defense.cover): allies with a ready shield within reach of the target who could block this blow for
  // them now, each with the block's cost and odds (none when the blow can't be read).
  function coverOptions(enc, chars, t, a, d) {
    const K = CONFIG.defense.cover;
    if (!K || d.type !== 'strike' || GRAPPLE_STEPS.includes(d.type)) return [];
    const out = [];
    for (const id of enc.order.concat(enc.ids.filter((x) => !enc.order.includes(x)))) {
      const b = chars[id];
      if (!b || id === t.id || id === a.id || b.side !== t.side || !C.isActive(b)) continue;
      // Shield Wall: a square farther, and no harder than a block of your own.
      const wall = C.rank(b, 'shield_wall') > 0;
      if (dist(enc.pos[id], enc.pos[t.id]) > K.reach + (wall ? 1 : 0) || isGrappled(b)) continue;
      if (defenseUnavailable(b, 'block', d, chars, enc) || conditionForbids(enc, chars, b, { type: 'block', target: a.id })) continue;
      const { ap, stamina } = C.actionCost(b, 'block');
      if (ap > apLeft(enc, id)) continue;
      const hidden = describeBare(enc, chars, d, id).hidden;
      const penalty = wall ? 0 : K.penalty;
      const spent = isSpent(b, stamina);
      out.push(Object.assign({ actor: id, type: 'cover', name: 'Cover', ap, stamina, penalty, odds: hidden ? null : defenseOdds(b, 'block', d.option.motion, a, d.option, -penalty - (spent ? CONFIG.stamina.spent.defense : 0), enc), hidden }, spent ? { spent } : {}));
    }
    return out;
  }

  // A blow nobody defended: the first shield-bearer beside the target who takes the offer covers. Returns the bearer
  // and the offer, or null.
  async function askCover(enc, chars, t, a, d, io) {
    for (const o of coverOptions(enc, chars, t, a, d)) {
      const pick = await react(enc, chars, { kind: 'cover', actor: o.actor, attacker: a.id, target: t.id, decl: d, hidden: o.hidden, options: [o], ap: apLeft(enc, o.actor) }, io);
      if (pick !== 'cover') continue;
      enc.ap[o.actor] -= o.ap;
      enc.decls.push({ actor: o.actor, type: 'block', cover: t.id, against: a.id, reaction: true, ap: o.ap, stamina: o.stamina, n: ++enc.seq, done: true });
      return { bearer: chars[o.actor], o };
    }
    return null;
  }

  // Melee blows this fighter could aim at a square right now (an opportunity strike).
  function opportunityOptions(enc, chars, f, from) {
    if (!C.isActive(f) || f.status.prone || isGrappled(f) || C.inClinch(f)) return [];
    const dd = dist(from, enc.pos[f.id]);
    // Snap Shot: a bow already drawn may loose too.
    const snap = C.rank(f, 'snap_shot') > 0;
    return C.attackOptions(f).filter((o) => (snap && o.ranged && !o.spell ? true : !o.ranged && !o.spell && !o.windUp) && C.inRange(o, dd) && o.ap <= apLeft(enc, f.id) && !attackUnavailable(enc, f, o));
  }

  // A mover's step from `from` to `to` past foes' reach (CONFIG.opportunityStrikes, the user's ruling,
  // 2026-11-02): coming up to the edge of a foe's reach is free; a foe strikes at a mover who steps from within
  // its reach to closer still, leaves it, or takes a second step within it that brings them no closer. Each foe
  // strikes once per move, paying from its own AP, with the mover still at `from`: a hit stops them there.
  // Returns true if a blow lands and stops the move.
  async function opportunities(enc, chars, m, from, to, state, io) {
    const foes = enc.order.concat(enc.ids.filter((x) => !enc.order.includes(x)))
      .filter((f) => f !== m.id && chars[f] && chars[f].side !== m.side && !state.provoked[f]);
    for (const f of foes) {
      const reactor = chars[f];
      if (conditionForbids(enc, chars, reactor, { type: 'strike', target: m.id })) continue;
      const inFrom = opportunityOptions(enc, chars, reactor, from).length > 0;
      const inTo = opportunityOptions(enc, chars, reactor, to).length > 0;
      if (!inFrom) continue;
      const at = from;
      let why = '';
      if (!inTo) why = 'leaves';
      else if (dist(to, enc.pos[f]) < dist(from, enc.pos[f])) why = 'closes';
      else {
        state.within[f] = (state.within[f] || 0) + 1;
        if (state.within[f] >= 2) why = 'moves';
      }
      if (!why) continue;
      // Slip Through: only closing in draws a blow. Counter Step: the step after a good dodge draws none.
      if (C.rank(m, 'slip_through') && why !== 'closes') continue;
      if (state.free) continue;
      if (C.rank(m, 'shadow_step') && G.Effects.has(m, 'unseen')) continue;
      const options = opportunityOptions(enc, chars, reactor, at);
      state.provoked[f] = true;
      const pick = await react(enc, chars, { kind: 'opportunity', actor: f, target: m.id, options, ap: apLeft(enc, f), why }, io);
      const opt = options.find((o) => o === pick || C.optionKey(o) === pick || (pick && C.optionKey(o) === C.optionKey(pick)));
      if (!opt) continue;
      enc.ap[f] -= opt.ap;
      const before = { stamina: m.stamina, dmg: C.totalDamage(m), active: C.isActive(m), bleeds: m.bleeds.length };
      log(enc, `${reactor.name} strikes at ${m.name} as they ${why === 'closes' ? 'close in' : why === 'leaves' ? 'go' : 'move'}.`, 'pass');
      const sd = { actor: f, type: 'strike', option: opt, target: m.id, ap: opt.ap, stamina: opt.stamina, n: ++enc.seq, opportunity: true, round: enc.round };
      enc.decls.push(sd);
      await resolveAction(enc, chars, sd, io, Object.assign({}, enc.pos, { [m.id]: at }));
      sd.done = true;
      const hit = m.stamina < before.stamina || C.totalDamage(m) > before.dmg || m.bleeds.length > before.bleeds || !C.isActive(m);
      if (hit) {
        if (C.isActive(m)) log(enc, `${reactor.name}'s blow stops ${m.name} where they stand.`, 'hit');
        return true;
      }
    }
    return false;
  }

  // Shoving reaches range 1; a long weapon (reaching 3 or more) fends off at range 2 (haft, crossguard, point).
  function shoveReach(c) {
    const w = C.wieldedWeapon(c);
    const f = CONFIG.shove.fendReach;
    return f && w && !WEAPONS[w.type].ranged && Items.longestReach(WEAPONS[w.type]) >= 3 ? Math.max(CONFIG.range.maneuverMax, f) : CONFIG.range.maneuverMax;
  }

  // CONFIG.wholeTurnAction: someone who has spent nothing this round may take one action that costs
  // more than their whole pool, as their whole turn (a tired or armored fighter can always make one
  // big swing).
  function wholeTurn(enc, id) {
    return !!CONFIG.wholeTurnAction && apLeft(enc, id) > 0 && apLeft(enc, id) >= (enc.apStart[id] || 0);
  }

  function eligible(enc, chars, id) {
    return id != null && !enc.turnDone[id] && C.isActive(chars[id]) && apLeft(enc, id) >= C.minAP();
  }

  function currentActor(enc) {
    return enc.phase === 'turn' ? enc.order[enc.turn] : null;
  }

  // On to the next character with a turn to take this round, in initiative order. When no one
  // is left, the round ends.
  async function advance(enc, chars, io) {
    if (enc.phase === 'over') return;
    const n = enc.order.length;
    for (;;) {
      enc.turn += 1;
      if (enc.turn >= n) return finishRound(enc, chars, io);
      if (eligible(enc, chars, enc.order[enc.turn])) { enc.phase = 'turn'; return; }
    }
  }

  // End of the round: hazards, spells and conditions tick, wounds bleed, the winded recover.
  async function finishRound(enc, chars, io) {
    const roller = io && io.roller;
    if (G.Magic && enc.delayed && enc.delayed.length) await G.Magic.breakDelayed(enc, chars, roller);
    if (G.Terrain && enc.tiles) await G.Terrain.endRound(enc, chars, roller, (t) => log(enc, t, 'hit'));
    if (G.Magic && G.Magic.endRound) for (const line of G.Magic.endRound(enc, chars)) log(enc, line, 'pass');
    endRound(enc, chars);
  }

  // Done with this turn: any AP left stays in hand for reactions until the round ends.
  async function endTurn(enc, chars, id, io) {
    if (currentActor(enc) !== id) return;
    enc.turnDone[id] = true;
    await advance(enc, chars, io);
  }

  // One entry point for a decision: an action, or 'endTurn'. An action that can't be taken
  // ends the turn and returns the reason (so a confused AI can't loop).
  async function submit(enc, chars, d, io) {
    // Afraid: the turn can't end (or be put off) before the step away it owes, while one can be taken.
    if ((d.type === 'endTurn' || d.type === 'concede') && currentActor(enc) === d.actor && mustFlee(enc, chars, chars[d.actor])) return `Afraid: first step away from ${fearSource(enc, chars, chars[d.actor]).name}`;
    if (d.type === 'endTurn' || d.type === 'concede') { await endTurn(enc, chars, d.actor, io); return null; }
    if (d.type === 'defer') return defer(enc, chars, d.actor, io);
    const err = await act(enc, chars, d, io);
    if (err) await endTurn(enc, chars, d.actor, io);
    return err;
  }

  // Everyone's positions are where they stand: actions resolve as they are taken.
  function projectedPos(enc, id) {
    return enc.pos[id];
  }

  function isGrappled(c) {
    return C.isHeld(c);
  }

  // Put a weapon in hand. Whatever was in hand is dropped, unless it is very light (a dagger
  // is sheathed instead).
  function takeInHand(c, wid) {
    const held = C.wieldedWeapon(c);
    let dropped = null;
    if (held && held.id !== wid && Items.weaponStats(held).weight !== 'very light') {
      c.status.dropped.push(held.id);
      dropped = held;
    }
    c.status.dropped = c.status.dropped.filter((x) => x !== wid);
    c.wield = wid;
    return dropped;
  }

  function dropHeld(c) {
    const held = C.wieldedWeapon(c);
    if (!held) return null;
    c.status.dropped.push(held.id);
    c.wield = null;
    return held;
  }

  // Which weapon a pick-up takes: the main weapon if it is on the ground, else the last dropped.
  function pickUpTarget(c) {
    const g = c.status.dropped;
    if (!g.length) return null;
    const primary = primaryWeaponId(c);
    return g.includes(primary) ? primary : g[g.length - 1];
  }

  // Everything the current actor may declare now, for the UI — with what conditions forbid
  // (calmed, mesmerized, in a frenzy, afraid, blinded) marked unavailable.
  function legalActions(enc, chars, id) {
    const out = legalActionsRaw(enc, chars, id);
    const c = chars[id];
    // R2: what this fighter can't pay the stamina for is taken spent (weaker), not refused.
    for (const o of out.attacks.concat(out.maneuvers, out.other, out.spells || [], out.move ? [out.move] : [])) if (isSpent(c, o.stamina)) o.spent = true;
    if (!G.Conditions) return out;
    // A foe beyond arm's reach who is unseen can't be aimed at.
    const hide = (t) => { if (t.inReach && unseenBy(enc, chars, chars[t.id], c)) { t.inReach = false; t.unseen = true; } };
    for (const o of out.attacks.concat(out.maneuvers, out.spells || [])) for (const t of o.targets || []) hide(t);
    if (!G.Conditions.list(c).length) return out;
    const no = (decl) => conditionForbids(enc, chars, c, decl);
    const mark = (o, decl) => { const f = no(decl); if (f) { o.affordable = false; o.why = f; } return !f; };
    for (const o of out.attacks) if (mark(o, { type: 'strike' })) for (const t of o.targets) if (no({ type: 'strike', target: t.id })) t.inReach = false;
    for (const m of out.maneuvers) if (mark(m, { type: m.type })) for (const t of m.targets) if (no({ type: m.type, target: t.id })) t.inReach = false;
    for (const o of out.spells || []) if (mark(o, { type: 'cast', option: o })) for (const t of o.targets || []) if (no({ type: 'cast', option: o, target: t.id })) t.inReach = false;
    if (G.Effects.has(c, 'noAct')) { out.move = null; for (const o of out.other) o.affordable = false; }
    return out;
  }

  function legalActionsRaw(enc, chars, id) {
    const c = chars[id];
    const ap = apLeft(enc, id);
    const fits = (cost) => cost <= ap && ap >= C.minAP();
    const whole = wholeTurn(enc, id);
    const can = (cost) => fits(cost) || (whole && ap >= C.minAP());
    const me = enc.pos[id];
    const others = enc.ids.filter((o) => o !== id && !chars[o].status.dead);
    // Defences are not taken on your turn any more: they are reactions, asked for when a blow comes.
    const out = { ap, pool: enc.apStart[id] || ap, attacks: [], defenses: [], maneuvers: [], other: [], move: null };

    const planned = C.attackOptions(c);
    for (const opt of planned) {
      const why = attackUnavailable(enc, c, opt);
      out.attacks.push(Object.assign({}, opt, {
        affordable: can(opt.ap) && !why,
        why,
        targets: others.map((o) => {
          const op = enc.pos[o];
          const dd = dist(me, op);
          const line = G.Terrain && enc.tiles && dd >= 2 ? G.Terrain.lineCheck(enc, me, op, opt.ranged || opt.spell ? 'missile' : 'melee') : null;
          return { id: o, inReach: C.inRange(opt, dd) && !(line && line.blocked), tooClose: dd < (opt.minRange || 1), distance: dd, blockedBy: line && line.blocked ? line.by : null };
        }),
      }));
    }

    // Spells cast at a square, a foe or an ally (bolts are among the attacks above).
    out.spells = [];
    if (G.Magic && !C.isPinned(c)) {
      for (const opt of G.Magic.spellOptions(c)) {
        if (opt.kind !== 'cast') continue;
        if (!opt.power && !C.castingHands(c)) continue; // spells need a free hand; an item's power doesn't
        if (isGrappled(c) && opt.spell.shape !== 'blink' && !C.rank(c, 'steady_mind')) continue; // held: only a blink gets you out (or Steady Mind)
        const why = spellShort(c, opt);
        const targets = opt.target === 'square' ? null : enc.ids.filter((o) => {
          const t = chars[o];
          if (!t) return false;
          // The newly dead can be called back (Raise + Life, a given Move + Life: CONFIG.magic.revive).
          if (t.status.dead) return opt.target === 'ally' && t.side === c.side && G.Magic.callsBack(opt.spell) && G.Magic.revivable(enc, t);
          // Raise + Life is for the dead alone.
          if (opt.spell.shape === 'revive') return false;
          // Transfer gives to someone else, never back to the caster.
          if (opt.spell.shape === 'give' && t === c) return false;
          // A heal or a cleansing ward reaches a friend turned by a mind spell, too (to free them).
          if (opt.target === 'ally') return t.side === c.side || ((opt.spell.shape === 'restore' || opt.spell.shape === 'ward') && t.charmed && t.charmed.side === c.side);
          if (opt.target === 'any') return C.isActive(t);
          return t.side !== c.side && C.isActive(t);
        }).map((o) => {
          const op = enc.pos[o];
          const dd = dist(me, op);
          const line = G.Terrain && enc.tiles && dd >= 2 ? G.Terrain.lineCheck(enc, me, op, 'missile') : null;
          const named = !opt.spell.named || G.Magic.knowsName(c, chars[o]);
          const fits = !opt.spell.only || G.Magic.fits(chars[o], opt.spell.only);
          return { id: o, distance: dd, inReach: named && fits && dd <= opt.maxRange && dd >= (opt.target === 'ally' || opt.target === 'any' ? 0 : opt.minRange) && !(line && line.blocked) };
        });
        out.spells.push(Object.assign({}, opt, { affordable: can(opt.ap) && !why, why, targets }));
      }
    }

    const reach = CONFIG.range.maneuverMax;
    const grappled = isGrappled(c);
    const link = linkOf(c);
    out.grapple = link;
    const pushManeuver = (kind, targets) => {
      const cost = C.actionCost(c, kind);
      // Nothing to grab, trip or shove on the incorporeal (bait and reading still work).
      if (kind !== 'bait' && kind !== 'readIntent') for (const t of targets) if (chars[t.id] && G.Effects.has(chars[t.id], 'incorporeal')) t.inReach = false;
      out.maneuvers.push({ type: kind, ap: cost.ap, stamina: cost.stamina, affordable: can(cost.ap) && targets.some((t) => t.inReach), targets });
    };
    const near = (o) => ({ id: o, inReach: dist(me, enc.pos[o]) <= reach });
    // Trips, disarms and shoves: free, or a trip or disarm from a clinch.
    if (!c.status.prone && !grappled && !C.holding(c)) {
      for (const kind of ['shove', 'trip', 'disarm']) {
        if (kind === 'shove' && link) continue;
        let r = reach;
        if (kind === 'trip' && hookWeapon(c)) r = Math.max(r, Items.longestReach(WEAPONS[C.wieldedWeapon(c).type]));
        if (kind === 'shove') r = shoveReach(c);
        pushManeuver(kind, others.filter((o) => !chars[o].status.unconscious).map((o) => ({ id: o, inReach: dist(me, enc.pos[o]) <= r })));
      }
    }
    // The grappling ladder.
    if (!link) {
      if (!c.status.prone) pushManeuver('clinch', others.filter((o) => C.isActive(chars[o]) && !linkOf(chars[o])).map(near));
    } else if (link.level === 'clinch') {
      pushManeuver('grapple', [near(link.partner)]);
      if (C.rank(c, 'takedown')) pushManeuver('throw', [near(link.partner)]);
      pushManeuver('break', [near(link.partner)]);
    } else if (link.role === 'holder') {
      if (link.level === 'hold') pushManeuver('pin', [near(link.partner)]);
      pushManeuver('throw', [near(link.partner)]);
    } else {
      pushManeuver('break', [near(link.partner)]);
    }
    // Bait (CHA vs WIS) and Read intent (WIS vs CHA): any foe in sight within range.
    if (CONFIG.social) {
      for (const kind of ['bait', 'readIntent']) {
        const r = CONFIG.social[kind].range;
        pushManeuver(kind, others.filter((o) => chars[o].side !== c.side && C.isActive(chars[o])).map((o) => {
          const op = enc.pos[o];
          const dd = dist(me, op);
          const sight = !(G.Terrain && enc.tiles && dd >= 2 && G.Terrain.lineCheck(enc, me, op, 'sight').blocked);
          return { id: o, inReach: dd <= r && sight, distance: dd };
        }));
      }
    }
    // Feat actions at foes: Demoralize (within 3), Name the Weakness (a creature within 6 in sight).
    const sightTo = (o, r) => {
      const dd = dist(me, enc.pos[o]);
      return dd <= r && !(G.Terrain && enc.tiles && dd >= 2 && G.Terrain.lineCheck(enc, me, enc.pos[o], 'sight').blocked);
    };
    const foesUp = others.filter((o) => chars[o].side !== c.side && C.isActive(chars[o]));
    if (C.rank(c, 'demoralize')) pushManeuver('demoralize', foesUp.map((o) => ({ id: o, inReach: sightTo(o, 3), distance: dist(me, enc.pos[o]) })));
    if (C.rank(c, 'name_weakness')) pushManeuver('nameWeakness', foesUp.map((o) => ({ id: o, inReach: !!chars[o].monster && sightTo(o, 6), distance: dist(me, enc.pos[o]) })));
    if (C.isPinned(c)) {
      // Pinned: only trying to break free.
      out.maneuvers = out.maneuvers.filter((m) => m.type === 'break');
      return out;
    }

    // Moving: not while prone, held or clinched. A holder drags the held fighter one square.
    if (!c.status.prone && !grappled && !C.inClinch(c) && fits(C.moveCost(c, 1)) && (!G.Conditions || G.Conditions.canMove(c))) {
      const spa = C.squaresPerAP(c);
      const cost1 = C.actionCost(c, 'move', { ap: 1 });
      const drag = !!C.holding(c);
      out.move = {
        squaresPerAP: spa, maxAP: ap, stamina: cost1.stamina, from: enc.pos[id],
        maxSquares: drag ? 1 : C.squaresFor(c, ap),
        drag,
      };
    }

    const addOther = (type, extra) => {
      const cost = C.actionCost(c, type);
      out.other.push(Object.assign({ type, name: ACTIONS[type].name, ap: cost.ap, stamina: cost.stamina, affordable: can(cost.ap) }, extra || {}));
    };
    const declared = (type) => enc.decls.some((d) => d.actor === id && d.type === type);
    if (c.status.prone && !declared('standUp')) addOther('standUp');
    const hands = { wield: C.wieldedWeapon(c) ? c.wield : null, dropped: c.status.dropped.slice() };
    const sidearm = c.weapons.find((w) => w.id === c.sidearm);
    const primary = primaryWeaponId(c);
    const heldW = hands.wield ? c.weapons.find((w) => w.id === hands.wield) : null;
    const dropNote = heldW && Items.weaponStats(heldW).weight !== 'very light' ? { note: `drops ${Items.itemName(heldW)}` } : {};
    if (sidearm && hands.wield !== c.sidearm && !hands.dropped.includes(c.sidearm)) addOther('drawSidearm', dropNote);
    if (primary && hands.wield !== primary && !hands.dropped.includes(primary)) addOther('readyPrimary', dropNote);
    if (hands.dropped.length && !declared('pickUp')) addOther('pickUp', dropNote);
    if (hands.wield) addOther('dropWeapon', { note: Items.itemName(heldW) });
    if (C.holding(c) && !declared('release')) addOther('release');
    if (c.status.webbed && !declared('tearFree')) addOther('tearFree', { note: `${c.status.webbed} layer${c.status.webbed > 1 ? 's' : ''}` });
    else if (G.Conditions && !G.Conditions.canMove(c) && !declared('tearFree')) addOther('tearFree', { name: 'Break free', note: 'rooted' });
    // Wind-ups for attacks that need one (power swings, Strong spells).
    if (canWindUp(enc, c) && !c.status.prone && !grappled) {
      const seen = {};
      for (const opt of planned) {
        if (!opt.windUp) continue;
        const key = C.optionKey(opt);
        if (seen[key]) continue;
        seen[key] = true;
        const cost = C.actionCost(c, 'windUp', { option: opt });
        const why = opt.spell ? spellShort(c, opt) : null;
        out.other.push({ type: 'windUp', option: opt, name: `Wind up: ${opt.label}`, ap: cost.ap, stamina: cost.stamina, affordable: can(cost.ap) && !why, why });
      }
    }
    // Feat actions for yourself and your side (feats.yaml).
    const friends = enc.ids.filter((o) => o !== id && chars[o] && chars[o].side === c.side && !chars[o].status.dead && enc.pos[o]);
    if (C.rank(c, 'vanish') && !grappled && !others.some((o) => chars[o].side !== c.side && C.isActive(chars[o]) && dist(me, enc.pos[o]) <= 1)) addOther('vanish');
    if (C.rank(c, 'feign_death') && !declared('feign')) addOther('feign');
    if (C.rank(c, 'rally') && !declared('rally')) addOther('rally');
    if (C.rank(c, 'command')) {
      const t = friends.filter((o) => C.isActive(chars[o]) && dist(me, enc.pos[o]) <= 4);
      if (t.length) addOther('command', { targets: t.map((o) => ({ id: o, inReach: true })) });
    }
    if (C.rank(c, 'to_your_feet')) {
      const t = friends.filter((o) => chars[o].status.unconscious && !(enc.roused || {})[o] && dist(me, enc.pos[o]) <= 1);
      if (t.length) addOther('rouse', { targets: t.map((o) => ({ id: o, inReach: true })) });
    }
    if (c.inventory.bandages > 0) {
      const patients = enc.ids.filter((o) => chars[o].bleeds.length > 0 && !chars[o].status.dead && (o === id || dist(me, enc.pos[o]) <= 1));
      if (patients.length) addOther('bandage', { targets: patients.map((o) => ({ id: o, inReach: true })) });
    }
    out.defer = deferOption(enc, chars, id);
    return out;
  }

  // Defer (CONFIG.defer): pay the AP to let the next one in the initiative order take their turn now; mine resumes
  // after theirs. { ap, next, affordable } on my turn, or null when there is no one left to go.
  function deferAP() {
    return Math.round(((CONFIG.defer && CONFIG.defer.ap) || 0) * (CONFIG.apDisplay || 1));
  }
  function deferOption(enc, chars, id) {
    if (!CONFIG.defer || currentActor(enc) !== id) return null;
    let j = enc.turn + 1;
    while (j < enc.order.length && !eligible(enc, chars, enc.order[j])) j++;
    if (j >= enc.order.length) return null;
    return { ap: deferAP(), next: enc.order[j], affordable: apLeft(enc, id) >= deferAP() };
  }
  async function defer(enc, chars, id, io) {
    if (mustFlee(enc, chars, chars[id])) return `Afraid: first step away from ${fearSource(enc, chars, chars[id]).name}`;
    const o = deferOption(enc, chars, id);
    if (!o) return 'No one left to defer to';
    if (!o.affordable) return 'Not enough AP';
    enc.ap[id] -= o.ap;
    // Step back behind the next one: they go now (enc.turn points at them), and I come up again after.
    const j = enc.order.indexOf(o.next);
    enc.order.splice(enc.turn, 1);
    enc.order.splice(j, 0, id);
    enc.turn = j - 1;
    log(enc, `${chars[id].name} holds back and lets ${chars[o.next].name} go first.`, 'pass');
    enc.phase = 'turn';
    return null;
  }

  // A new wind-up needs no wind-up held, or (with rewindAfterRelease) the held one
  // already released this round. Only one wind-up may be declared per round.
  function canWindUp(enc, c) {
    if (enc.decls.some((d) => d.actor === c.id && d.type === 'windUp')) return false;
    if (!c.status.windUp) return true;
    if (!CONFIG.windUp.rewindAfterRelease) return false;
    const key = c.status.windUp.key;
    return enc.decls.some((d) => d.actor === c.id && d.type === 'strike' && d.option.windUp && C.optionKey(d.option) === key);
  }

  function primaryWeaponId(c) {
    const w = c.weapons.find((x) => x.id !== c.sidearm && !Items.weaponBroken(x));
    return w ? w.id : null;
  }

  function spellShort(c, opt) {
    if (opt.power) return opt.power.left === 0 ? 'No charges left' : null;
    return G.Magic && opt.spCost > G.Magic.availableSP(c) + G.Magic.overchannelSP(c) ? 'Not enough spell points' : null;
  }

  // Why an attack can't be made right now (beyond AP), or null.
  function attackUnavailable(enc, c, opt) {
    if (opt.ranged && opt.weaponId && !opt.natural && C.ammoLeft(c, opt) <= 0) return opt.arrowHead ? `No ${opt.arrowHead}s` : 'No arrows';
    if (opt.windUp) {
      const w = c.status.windUp;
      const key = C.optionKey(opt);
      // Released at once if the AP is there (windUp.sameTurn), else not before the next round.
      const now = !!CONFIG.windUp.sameTurn;
      if (!now && enc.decls.some((d) => d.actor === c.id && d.type === 'windUp' && C.optionKey(d.option) === key)) return 'Release next round';
      // Released already this round: again only after winding up again (then AP is the only limit).
      if (!w && enc.decls.some((d) => d.actor === c.id && d.type === 'strike' && d.option.windUp && C.optionKey(d.option) === key)) return 'Already released';
      if (!w || w.key !== key) return 'Wind up first';
      if (w.round >= enc.round && !now) return 'Release next round';
    }
    if (opt.spell) return spellShort(c, opt);
    return null;
  }

  function hookWeapon(c) {
    const w = C.wieldedWeapon(c);
    return w && WEAPONS[w.type].hook && C.rank(c, 'hook');
  }

  function defenseUnavailable(c, kind, attackDecl, chars, enc) {
    if (C.isPinned(c)) return 'Pinned';
    const winding = c.status.windUp || (enc && enc.decls.some((d) => d.actor === c.id && d.type === 'windUp'));
    if (winding && (CONFIG.windUp.exposed || []).includes(kind)) return 'Winding up';
    const opt = attackDecl ? attackDecl.option : null;
    const parry = kind === 'parry' || kind === 'offParry';
    // A spell bolt can't be parried or blocked (PROVISIONAL, the user's call), except with gear made for it
    // (enchantments.yaml blockSpells on a shield, parrySpells on a weapon). It can be dodged.
    if (parry && opt && opt.spell && !(C.weaponStrike(parryingWeapon(c, kind)).parrySpells)) return "Can't parry a spell";
    if (parry && opt && !opt.spell && opt.ranged && !CONFIG.archery.parry) return "Can't parry an arrow";
    if (kind === 'block' && opt && opt.spell && CONFIG.defense.blockSpells === false && !(c.shield && Items.enchantsOf(c.shield).some((e) => e.blockSpells))) return "Can't block a spell";
    if (parry && opt && opt.motion === 'power' && CONFIG.defense.noParryVsPower) return "Can't parry a power blow";

    if (kind === 'block' && !C.shieldReady(c)) return 'No ready shield';
    if (kind === 'offParry') {
      if (!C.offhandWeapon(c)) return 'No off-hand dagger';
      if (attackDecl && !(attackDecl.type === 'strike' && opt.motion === 'thrust')) return 'Only meets thrusts';
    }
    if (kind === 'parry') {
      if (!C.wieldedWeapon(c)) return 'No weapon';
      const atk = attackDecl ? chars[attackDecl.actor] : null;
      if (opt && opt.motion === 'power' && atk && C.rank(atk, 'juggernaut')) return 'Juggernaut';
    }
    if (kind === 'dodge' && c.status.prone) return 'Prone';
    if (kind === 'dodge' && opt && (opt.ranged || opt.spell) && CONFIG.defense.dodgeMeleeOnly) return opt.spell ? "Can't dodge a bolt" : "Can't dodge a missile";
    return null;
  }

  // Fear (the user, 2026-11-08): the frightened can't come closer to what frightens them (Conditions.fear: the
  // condition's src), and on their turn must first step at least a square farther from it, unless no step can (down,
  // held, out of AP, hemmed in). The source must still be up and on the field.
  function fearSource(enc, chars, c) {
    const f = G.Conditions && c && G.Conditions.fear(c);
    const s = f && f.src && chars[f.src];
    return s && C.isActive(s) && enc.pos[s.id] && enc.pos[c.id] ? s : null;
  }

  // The squares beside a frightened character that take it farther from its fear, and that it can step to now.
  function fleeSteps(enc, chars, c) {
    const src = fearSource(enc, chars, c);
    if (!src || c.status.prone || isGrappled(c) || C.inClinch(c) || G.Effects.has(c, 'noAct') || (G.Conditions && !G.Conditions.canMove(c))) return [];
    const me = enc.pos[c.id], from = enc.pos[src.id], d0 = dist(me, from);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const q = { x: me.x + dx, y: me.y + dy };
      if ((!dx && !dy) || dist(q, from) <= d0) continue;
      if (G.Terrain && (!G.Terrain.passable(enc, q.x, q.y) || (enc.tiles && !G.Terrain.canStand(enc, q.x, q.y, c)))) continue;
      if (enc.ids.some((o) => o !== c.id && C.isActive(chars[o]) && enc.pos[o] && enc.pos[o].x === q.x && enc.pos[o].y === q.y)) continue;
      let squares = 1;
      if (G.Terrain && enc.tiles) {
        const pc = G.Terrain.pathCost(enc, me, q, c, foeSquares(enc, chars, c));
        if (!pc.reaches) continue;
        squares = pc.cost;
      }
      if (C.actionCost(c, 'move', { ap: C.moveCost(c, squares) }).ap > apLeft(enc, c.id)) continue;
      out.push(q);
    }
    return out;
  }

  // Must this character still step away from its fear before anything else this turn?
  function mustFlee(enc, chars, c) {
    return !!c && !(enc.fled || {})[c.id] && fleeSteps(enc, chars, c).length > 0;
  }

  // What a condition forbids this declaration (calmed, mesmerized, enraged, frightened, blind).
  function conditionForbids(enc, chars, c, decl) {
    if (!G.Conditions) return null;
    const F = (f) => G.Effects.has(c, f);
    if (F('noAct') && decl.type !== 'endTurn' && decl.type !== 'concede') return G.Conditions.has(c, 'paralyzed') ? 'Paralyzed' : 'Mesmerized';
    const attack = decl.type === 'strike' || (ATTACK_TYPES.includes(decl.type) && decl.type !== 'strike') || (decl.type === 'cast' && decl.option && decl.option.target === 'foe');
    if (attack && F('noAttack')) return 'Calmed: won\'t attack';
    if (DEFENSE_TYPES.includes(decl.type) && F('noGuard')) return 'In a frenzy: no guards';
    const fear = fearSource(enc, chars, c);
    if (fear) {
      if (decl.type === 'move') { if (dist(decl.to, projectedPos(enc, fear.id)) < dist(projectedPos(enc, c.id), projectedPos(enc, fear.id))) return 'Too afraid to close'; }
      else if (!['standUp', 'tearFree', 'break'].includes(decl.type) && mustFlee(enc, chars, c)) return `Afraid: first step away from ${fear.name}`;
    }
    if (F('blind') && decl.type === 'strike' && decl.target && dist(projectedPos(enc, c.id), projectedPos(enc, decl.target)) > 1) return 'Blinded: only at arm\'s reach';
    if (decl.target && chars[decl.target] && unseenBy(enc, chars, chars[decl.target], c)) return 'Can\'t see them';
    return null;
  }

  // An unseen character (Bless + Veil, a veiling circlet) can't be picked out by a foe farther than arm's reach.
  function unseenBy(enc, chars, t, viewer) {
    if (!G.Conditions || !t || !viewer || t.side === viewer.side || !G.Effects.has(t, 'unseen')) return false;
    if (!enc.pos[t.id] || !enc.pos[viewer.id]) return false;
    if (G.Effects.has(t, 'feign')) return true;
    return dist(enc.pos[t.id], enc.pos[viewer.id]) > 1;
  }

  // Check an action and work out its cost. Returns { err } or { ap, stamina }; fills in decl.option.
  function validate(enc, chars, decl) {
    const id = currentActor(enc);
    if (decl.actor !== id) return { err: 'Not your turn' };
    const c = chars[id];
    const forbid = conditionForbids(enc, chars, c, decl);
    if (forbid) return { err: forbid };
    let ap, stamina;
    if (DEFENSE_TYPES.includes(decl.type)) return { err: 'Defences are reactions: they are offered when a blow comes' };
    if (decl.type === 'strike') {
      const key = C.optionKey(decl.option);
      const opt = C.attackOptions(c).find((o) => C.optionKey(o) === key);
      if (!opt) return { err: 'Attack not available' };
      const why = attackUnavailable(enc, c, opt);
      if (why) return { err: why };
      if (!decl.target || !chars[decl.target]) return { err: 'Choose a target' };
      const dd = dist(enc.pos[id], enc.pos[decl.target]);
      if (dd > opt.maxRange) return { err: 'Out of reach' };
      if (dd < (opt.minRange || 1)) return { err: 'Too close' };
      // An aimed blow (CONFIG.locations.aim): the location travels with the option (defence odds, the hit).
      const L = CONFIG.locations;
      if (decl.location && !(L && L.order.includes(decl.location))) return { err: 'No such place to aim at' };
      decl.option = decl.location && !opt.spell ? Object.assign({}, opt, { aim: decl.location }) : opt;
      ({ ap, stamina } = opt);
    } else if (decl.type === 'cast') {
      if (!G.Magic || !decl.option) return { err: 'Choose a spell' };
      const key = decl.option.spellKey;
      const opt = G.Magic.spellOptions(c).find((o) => o.kind === 'cast' && o.spellKey === key);
      if (!opt) return { err: 'Spell not available' };
      if ((!opt.power && !C.castingHands(c)) || (isGrappled(c) && opt.spell.shape !== 'blink' && !C.rank(c, 'steady_mind'))) return { err: 'Needs a free hand' };
      const why = spellShort(c, opt);
      if (why) return { err: why };
      if (opt.target === 'square') {
        if (!decl.at || !G.Terrain.inGrid(enc, decl.at.x, decl.at.y)) return { err: 'Choose a square' };
        const dd = dist(enc.pos[id], decl.at);
        if (dd > opt.maxRange || dd < opt.minRange) return { err: 'Out of range' };
      } else if (!decl.target || !chars[decl.target]) return { err: 'Choose a target' };
      decl.option = opt;
      ap = opt.ap;
      stamina = 0;
    } else if (decl.type === 'windUp') {
      if (!decl.option) return { err: 'Choose what to wind up' };
      const key = C.optionKey(decl.option);
      const opt = C.attackOptions(c).find((o) => C.optionKey(o) === key && o.windUp);
      if (!opt) return { err: 'Nothing to wind up' };
      if (!canWindUp(enc, c)) return { err: 'Already winding up' };
      decl.option = opt;
      ({ ap, stamina } = C.actionCost(c, 'windUp', { option: opt }));
    } else if (decl.type === 'move') {
      const from = enc.pos[id];
      const d = dist(from, decl.to);
      if (d === 0) return { err: 'Pick a different square' };
      if (c.status.prone || isGrappled(c) || C.inClinch(c)) return { err: c.status.prone ? 'Prone: stand up first' : 'Held fast' };
      // Walls are walked around; rough ground, brambles and climbing out of a pit cost extra.
      let squares = d;
      if (G.Terrain && enc.tiles) {
        if (!G.Terrain.canStand(enc, decl.to.x, decl.to.y, c)) return { err: G.Terrain.has(enc, decl.to.x, decl.to.y, 'deep') ? 'Deep water' : 'A wall stands there' };
        const pc = G.Terrain.pathCost(enc, from, decl.to, c, foeSquares(enc, chars, c));
        if (!pc.reaches) return { err: 'No way through' };
        squares = pc.cost;
      }
      if (C.holding(c) && d > 1) return { err: 'Dragging someone: one square at a time' };
      if (enc.ids.some((o) => o !== id && C.isActive(chars[o]) && enc.pos[o].x === decl.to.x && enc.pos[o].y === decl.to.y)) return { err: 'Someone stands there' };
      // Allies can be passed; a foe on the way has to be gone around (the path does, where there is a way).
      const route = G.Terrain ? G.Terrain.path(enc, from, decl.to, c, foeSquares(enc, chars, c)) : [decl.to];
      if (route.some((q) => enc.ids.some((o) => chars[o].side !== c.side && C.isActive(chars[o]) && enc.pos[o].x === q.x && enc.pos[o].y === q.y))) return { err: 'A foe is in the way' };
      // Afraid: no square of the way may come closer to the fear than where the move began.
      const fear = fearSource(enc, chars, c);
      if (fear && route.some((q) => dist(q, enc.pos[fear.id]) < dist(from, enc.pos[fear.id]))) return { err: 'Too afraid to close' };
      const need = C.moveCost(c, squares);
      ({ ap, stamina } = C.actionCost(c, 'move', { ap: need }));
      decl.from = from;
      decl.squares = squares;
    } else {
      if (!ACTIONS[decl.type]) return { err: 'Unknown action' };
      ({ ap, stamina } = C.actionCost(c, decl.type));
      if (['trip', 'disarm', 'shove', 'bandage', 'bait', 'readIntent'].concat(GRAPPLE_STEPS).includes(decl.type) && !decl.target) return { err: 'Choose a target' };
      if (ATTACK_TYPES.includes(decl.type) || decl.type === 'bait' || decl.type === 'readIntent' || decl.type === 'demoralize' || decl.type === 'nameWeakness') {
        const m = legalActions(enc, chars, id).maneuvers.find((x) => x.type === decl.type);
        if (!m || !m.targets.some((t) => t.id === decl.target && t.inReach)) return { err: 'Not possible from here' };
      }
      if (FEAT_OTHER.includes(decl.type)) {
        const o = legalActions(enc, chars, id).other.find((x) => x.type === decl.type);
        if (!o) return { err: 'Not possible now' };
        if (o.targets && !o.targets.some((t) => t.id === decl.target)) return { err: 'Choose a target' };
      }
    }
    if (ap > apLeft(enc, id)) {
      if (decl.type === 'move' || !wholeTurn(enc, id)) return { err: 'Not enough AP' };
      ap = apLeft(enc, id); // the whole turn
    }
    if (isSpent(c, stamina)) return { ap, stamina, spent: true };
    if (!canPay(c, stamina)) return { err: 'Too exhausted' };
    return { ap, stamina };
  }

  // Take an action on your turn: it is paid for and resolves at once, with whatever reactions it
  // draws (defences, opportunity strikes). io: { roller, react }. Returns an error string or null.
  async function act(enc, chars, decl, io) {
    if (enc.phase !== 'turn') return 'Not now';
    const v = validate(enc, chars, decl);
    if (v.err) return v.err;
    const id = decl.actor;
    decl.ap = v.ap;
    decl.stamina = v.stamina;
    if (v.spent) decl.spent = true;
    decl.n = ++enc.seq;
    decl.round = enc.round;
    if (decl.target) decl.targetWasDown = !C.isActive(chars[decl.target]);
    // Playing dead ends with any action; striking or casting gives the unseen away.
    if (G.Conditions && G.Conditions.has(chars[id], 'feigning') && decl.type !== 'feign') { G.Conditions.remove(chars[id], 'feigning'); log(enc, `${chars[id].name} is not dead after all.`, 'pass'); }
    // Backstab (unseen) and Charge (the move before it): a melee blow made heavier, before the unseen is given away.
    if (decl.type === 'strike' && !decl.option.ranged && !decl.option.spell) {
      const me = chars[id];
      const extra = (C.rank(me, 'backstab') && G.Effects.has(me, 'unseen') ? 3 : 0) + (me.status.charging === enc.round ? 2 : 0);
      if (extra) {
        const dmg = decl.option.damage.slice();
        dmg[C.mainIndex(dmg)] += extra;
        decl.option = Object.assign({}, decl.option, { damage: dmg });
        log(enc, `${me.name} ${me.status.charging === enc.round ? 'charges in' : 'strikes from the shadows'} (+${extra}).`, 'pass');
      }
    }
    if (decl.type !== 'move') chars[id].status.charging = null;
    // Striking or casting gives the unseen away.
    if (G.Conditions && G.Conditions.has(chars[id], 'unseen') && (ATTACK_TYPES.includes(decl.type) || (decl.type === 'cast' && decl.option.target !== 'ally'))) {
      G.Conditions.remove(chars[id], 'unseen');
      log(enc, `${chars[id].name} is seen again.`, 'pass');
    }
    enc.ap[id] -= v.ap;
    enc.decls.push(decl);
    enc.phase = 'acting';
    try {
      if (decl.type === 'move') await resolveMove(enc, chars, decl, io);
      else {
        await resolveAction(enc, chars, decl, io, Object.assign({}, enc.pos));
        // Flurry: the second thrust of the pair, at once, if the first left them standing.
        if (decl.type === 'strike' && decl.option.flurry && C.isActive(chars[id]) && C.isActive(chars[decl.target])) {
          log(enc, `${chars[id].name} thrusts again.`, 'pass');
          const sd = Object.assign({}, decl, { n: ++enc.seq, ap: 0, stamina: 0, flurrySecond: true });
          enc.decls.push(sd);
          await resolveAction(enc, chars, sd, io, Object.assign({}, enc.pos));
          sd.done = true;
        }
        if (decl.type === 'strike') await sweep(enc, chars, chars[id], decl, io);
        if (decl.type === 'strike' && !decl.targetWasDown && !C.isActive(chars[decl.target])) await cleave(enc, chars, chars[id], decl, io);
      }
    } finally {
      decl.done = true;
    }
    settleGrapples(enc, chars);
    markDeaths(enc, chars);
    for (const o of enc.order) if (!C.isActive(chars[o])) enc.turnDone[o] = true;
    // A side wiped out mid-turn ends the round, and the fight, at once.
    const sides = {};
    for (const o of enc.ids) if (C.isActive(chars[o])) sides[chars[o].side] = true;
    if (Object.keys(sides).length < 2) { await finishRound(enc, chars, io); return null; }
    enc.phase = 'turn';
    if (!eligible(enc, chars, id)) { enc.turnDone[id] = true; await advance(enc, chars, io); }
    return null;
  }

  // A move, square by square: around walls, past allies (not foes), into and out of foes' reach (see
  // opportunities(); a hit stops the move), into runes, pits and hazards. AP for squares not walked is
  // given back.
  // The squares of c's foes still standing, as "x,y": a walk goes around them.
  function foeSquares(enc, chars, c) {
    const out = new Set();
    for (const o of enc.ids) if (chars[o] && chars[o].side !== c.side && C.isActive(chars[o]) && enc.pos[o]) out.add(enc.pos[o].x + ',' + enc.pos[o].y);
    return out;
  }

  async function resolveMove(enc, chars, d, io) {
    const a = chars[d.actor];
    if (!payStamina(enc, a, d.stamina)) return;
    const state = { provoked: {}, within: {} };
    // Counter Step: a good dodge this round makes the next move's first square free and unanswered.
    const counter = a.status.counterStep === enc.round && !C.holding(a);
    if (counter) a.status.counterStep = null;
    const dragged = C.holding(a) ? chars[C.holding(a)] : null;
    const start = { x: enc.pos[a.id].x, y: enc.pos[a.id].y };
    const steps = dragged ? [d.to] : G.Terrain ? G.Terrain.path(enc, enc.pos[a.id], d.to, a, foeSquares(enc, chars, a)) : [d.to];
    let walked = 0, why = '';
    for (const q of steps) {
      const from = enc.pos[a.id];
      state.free = counter && walked === 0;
      // Unstoppable: a blow that lands does not stop the move.
      if (await opportunities(enc, chars, a, from, q, state, io) && !C.rank(a, 'unstoppable')) { why = 'stopped'; break; }
      if (!C.isActive(a)) { why = 'stopped'; break; }
      if (enc.ids.some((o) => o !== a.id && chars[o].side !== a.side && C.isActive(chars[o]) && enc.pos[o].x === q.x && enc.pos[o].y === q.y)) { why = 'blocked'; break; }
      enc.pos[a.id] = { x: q.x, y: q.y };
      if (dragged) { enc.pos[dragged.id] = { x: from.x, y: from.y }; }
      walked += G.Terrain && enc.tiles ? G.Terrain.stepCost(enc, q.x, q.y, a) : 1;
      if (G.Terrain && enc.tiles && (await G.Terrain.enter(enc, chars, a, q.x, q.y, io && io.roller, (t) => log(enc, t, 'hit')))) { why = 'stops'; break; }
    }
    const at = enc.pos[a.id];
    // Fear: a step farther from it is the step the turn owed (Combat.mustFlee).
    const fear = fearSource(enc, chars, a);
    if (fear && walked && dist(at, enc.pos[fear.id]) > dist(start, enc.pos[fear.id])) (enc.fled || (enc.fled = {}))[a.id] = true;
    if (dragged && walked) log(enc, `${a.name} drags ${dragged.name} to (${at.x + 1}, ${at.y + 1}).`);
    else if (walked) log(enc, `${a.name} moves to (${at.x + 1}, ${at.y + 1})${at.x !== d.to.x || at.y !== d.to.y ? ' and gets no farther' : ''}.`);
    else if (why === 'blocked') log(enc, `${a.name}'s way is blocked.`, 'fizzle');
    if ((why || (counter && walked)) && C.isActive(a)) {
      // Stopped short: the squares not walked are given back, but a move always costs its first AP. After a Counter
      // Step the first square is free.
      const paid = counter ? Math.max(0, walked - 1) : walked;
      const used = Math.max(counter ? 0 : C.minAP(), paid ? C.actionCost(a, 'move', { ap: C.moveCost(a, paid) }).ap : 0);
      const back = Math.max(0, d.ap - used);
      if (back) { enc.ap[a.id] += back; d.ap -= back; }
      if (counter && walked) log(enc, `${a.name} steps off the dodge.`, 'pass');
    }
    // Charge: two squares or more, ending beside a foe.
    if (C.rank(a, 'charge') && walked >= 2 && C.isActive(a) && enc.ids.some((o) => chars[o].side !== a.side && C.isActive(chars[o]) && dist(enc.pos[a.id], enc.pos[o]) <= 1)) a.status.charging = enc.round;
    d.to = { x: at.x, y: at.y };
  }

  // How a declaration looks to a given viewer (Feint vs Read Attack).
  function describeDecl(enc, chars, d, viewerId) {
    return describeBare(enc, chars, d, viewerId);
  }

  function describeBare(enc, chars, d, viewerId) {
    const a = chars[d.actor];
    const t = d.target ? chars[d.target] : null;
    const tn = t ? t.name : '';
    if (d.type === 'strike') {
      const hidden = viewerId !== d.actor && C.rank(a, 'feint') > 0 && feintScore(a) > (viewerId ? readScore(chars[viewerId]) : 0);
      if (hidden) return { text: `${a.name}: strike at ${tn}`, hidden: true };
      const w = d.option.weaponId ? a.weapons.find((x) => x.id === d.option.weaponId) : null;
      return { text: `${a.name}: ${d.option.label}${w ? ' — ' + Items.itemName(w) : ''} at ${tn} [${C.fmtAP(d.ap)} AP]` };
    }
    if (DEFENSE_TYPES.includes(d.type)) {
      const vs = d.against && chars[d.against] ? ` ${chars[d.against].name}` : '';
      return { text: `${a.name}: ${ACTIONS[d.type].name.toLowerCase()} against${vs} [${C.fmtAP(d.ap)} AP]` };
    }
    if (d.type === 'move') return { text: `${a.name}: move to (${d.to.x + 1}, ${d.to.y + 1}) [${C.fmtAP(d.ap)} AP]` };
    if (d.type === 'windUp') return { text: `${a.name}: winds up ${d.option.label} [${C.fmtAP(d.ap)} AP]` };
    if (d.type === 'cast') return { text: `${a.name}: casts ${d.option.label} ${d.at ? `at (${d.at.x + 1}, ${d.at.y + 1})` : `on ${tn}`} [${C.fmtAP(d.ap)} AP]` };
    return { text: `${a.name}: ${ACTIONS[d.type].name.toLowerCase()}${tn ? ' ' + tn : ''} [${C.fmtAP(d.ap)} AP]` };
  }

  // ---- Damage pipeline ---------------------------------------------------
  // Pure: works out what a hit would do (before d4 hit-location rolls).
  function magicalWeapon(c, option) {
    const w = option && option.weaponId && c.weapons ? c.weapons.find((x) => x.id === option.weaponId) : null;
    return !!(w && Items.enchantsOf(w).length);
  }

  function passesThrough(attacker, target, option) {
    return !!(G.Effects.has(target, 'incorporeal') && !option.spell && !magicalWeapon(attacker, option));
  }

  // A hit result that does nothing (the base the special cases fill in).
  function blankHit() {
    return { vec: [0, 0, 0], P: 0, S: 0, B: 0, armored: false, toCON: 0, slashToAttrs: 0, bluntToStamina: 0, bluntToCON: 0, pointToAttrs: 0, crushToAttrs: 0, expCON: 0, expAttrs: 0, converted: 0, durLoss: 0, mitigated: { P: 0, S: 0, B: 0 }, noBleed: true, pierceVital: 0, cutVital: 0, bleedFactor: 1, bleedRounds: CONFIG.bleedRounds };
  }

  // What a spell of some element does to the target: its element's keyword times `magic` (every spell).
  function spellMult(target, el) {
    return C.damageMult(target, el) * C.damageMult(target, 'magic');
  }

  // How a fighter going down is told: a collapse (R3) or, from a wound or a spell, unconscious.
  function downWord(c) {
    return C.collapsed(c) ? 'collapses' : 'falls unconscious';
  }

  // Rounds after the one it began in that a collapse lasts (CONFIG.stamina.collapse); Second Wind: none.
  function collapseRounds(c) {
    const K = CONFIG.stamina && CONFIG.stamina.collapse;
    if (!K) return Infinity;
    return C.rank(c, 'second_wind') ? 0 : K.rounds;
  }

  // The round a collapsed fighter comes round at the end of (what everyone can see), or null.
  function comesRoundAt(enc, c) {
    if (!C.collapsed(c)) return null;
    const r = c.status.collapsed.round != null ? c.status.collapsed.round : enc.round;
    return r + collapseRounds(c);
  }

  // How hard a weapon blow lands for the striker's stamina left (of their fresh stamina, so weariness tells too):
  // CONFIG.vigor.full at full, .empty at none, straight between. Spells, shots and the tireless are untouched.
  function vigorMult(a, option) {
    const V = CONFIG.vigor;
    if (!V || !a || option.spell || option.ranged || C.tireless(a)) return 1;
    if (option.spent && V.spent != null) return V.spent;
    const fresh = C.freshStamina(a);
    const f = fresh > 0 ? Math.max(0, Math.min(1, (a.stamina || 0) / fresh)) : 1;
    return V.empty + (V.full - V.empty) * f;
  }

  // Hero mode (CONFIG.hero): a hero's blows land harder and blows on a hero land softer.
  function heroMult(attacker, target) {
    const H = CONFIG.hero;
    if (!H) return 1;
    return (attacker && attacker.hero ? H.dealt || 1 : 1) * (target.hero ? H.taken || 1 : 1);
  }

  function computeHit(attacker, target, option, flags) {
    flags = flags || {};
    // Immune to the spell (resist 0 for its element, or for `magic`, every spell: a golem and mind or life magic).
    if (option.spell && spellMult(target, option.spell.element) === 0) {
      return Object.assign(blankHit(), { magicImmune: true });
    }
    if (option.spell && CONFIG.magic.energyMitigation && CONFIG.magic.energyMitigation[option.spell.element] != null) return computeFire(attacker, target, option, flags);
    if (option.spell && option.spell.element === 'life') return computeLife(attacker, target, option, flags);
    const v = option.damage.slice();
    // Vigor (CONFIG.vigor): a fresh fighter hits harder than a spent one.
    const vm = vigorMult(attacker, option);
    if (vm !== 1) for (let i = 0; i < 3; i++) v[i] = Math.round(v[i] * vm);
    // Incorporeal (a spectre): blows from weapons without an enchantment pass through.
    if (passesThrough(attacker, target, option)) v[0] = v[1] = v[2] = 0;
    const st = target.status;
    const prone = st.prone;
    // A paralyzed body (helpless) gives up its gaps as a pinned one does.
    const pinned = C.isPinned(target) || G.Effects.has(target, 'helpless');
    if (!flags.carried && isCramped(attacker, option, flags.distance)) {
      if (CONFIG.range.closeRule === 'blunt') {
        const total = v[0] + v[1] + v[2];
        v[0] = 0; v[1] = 0; v[2] = Math.floor(total * CONFIG.range.closeMult);
      } else for (let i = 0; i < 3; i++) v[i] = Math.floor(v[i] * CONFIG.range.closeMult);
    }
    // A cut carried on into a second location (flags.carried) has had all of this already.
    if (!flags.carried) {
      if (option.ranged && option.longRange && flags.distance > option.longRange && !C.rank(attacker, 'far_shot')) v[C.mainIndex(v)] = Math.max(0, v[C.mainIndex(v)] - CONFIG.range.longRangePenalty);
      if (prone) v[C.mainIndex(v)] += CONFIG.maneuver.proneDamageBonus;
      if (flags.pack) v[C.mainIndex(v)] += flags.pack; // pack hunters: allies at the target's side
      if (flags.half) for (let i = 0; i < 3; i++) v[i] = Math.floor(v[i] / 2);
      // Resistances by damage keyword (C.damageMult): piercing, slashing and blunt, e.g. a skeleton takes no
      // piercing and half slashing; only blunt breaks bones cleanly. A spell's blow also answers to its element.
      // Name the Weakness: its resistances (not its weaknesses) count for nothing for now.
      const named = G.Effects.has(target, 'named');
      ['P', 'S', 'B'].forEach((k, i) => { const m = C.damageMult(target, k); if (m !== 1 && !(named && m < 1)) v[i] = Math.floor(v[i] * m); });
      if (option.spell) { const m = spellMult(target, option.spell.element); if (m !== 1 && !(named && m < 1)) for (let i = 0; i < 3; i++) v[i] = Math.floor(v[i] * m); }
      // Bane Lore: a creature's body known, not a person's.
      if (target.monster && attacker && C.rank(attacker, 'bane_lore')) v[C.mainIndex(v)] += C.rank(attacker, 'bane_lore');
      const hm = heroMult(attacker, target);
      if (hm !== 1) for (let i = 0; i < 3; i++) v[i] = Math.round(v[i] * hm);
    }
    // Stoneskin, barkskin, a shield of force: protection that isn't armor.
    if (G.Conditions) ['P', 'S', 'B'].forEach((k, i) => { v[i] = Math.max(0, v[i] - G.Conditions.mitigation(target, k, attacker)); });

    const unconscious = target.stamina <= 0;
    const weapon = option.weaponType ? WEAPONS[option.weaponType] : null;
    const coupDeGrace = weapon && weapon.dagger && C.rank(attacker, 'coup_de_grace') && (prone || pinned);
    // Where the blow lands (CONFIG.locations): the piece there, or bare skin. flags.location is the one rolled
    // (applyHit); without it a body whose locations differ gets the expectation over them, by share, which is
    // what the AI and the preview see. A full harness or a bare body is the same everywhere.
    const L = CONFIG.locations;
    const at = (loc) => hitAt(attacker, target, option, { v: v.slice(), prone, pinned, unconscious, weapon, coupDeGrace }, loc);
    // An aimed blow lands there with aimHold's chance, else where the location roll puts it.
    const hold = !flags.location && option.aim ? aimHold(attacker, target, option) : 1;
    if (option.aim && !flags.location && hold < 1 && L && !(C.armorUniform(target) && !L.wounds)) {
      const parts = [{ loc: option.aim, w: hold, h: at(option.aim) }].concat(L.order.map((loc) => ({ loc, w: (1 - hold) * (L.share[loc] || 0), h: at(loc) })));
      const res = blendMany(parts);
      res.location = option.aim; // aimed there; aimHold says how often it holds
      res.aimHold = hold;
      return res;
    }
    const where = flags.location || option.aim || null;
    // With wounds that differ by location (R4, R5) a body the same everywhere still differs underneath.
    if (where || !L || (C.armorUniform(target) && !woundsByLocation())) return at(where);
    const parts = L.order.map((loc) => ({ loc, w: L.share[loc] || 0, h: at(loc) }));
    const res = blendMany(parts);
    res.byLocation = parts;
    return res;
  }

  // loc null: nowhere in particular (a body the same everywhere, for the AI and the preview): the armor is the
  // piece over all of it, and the wound has the body's average odds.
  function hitAt(attacker, target, option, base, loc) {
    const { v, prone, pinned, unconscious, weapon, coupDeGrace } = base;
    const L = CONFIG.locations;
    const armorLoc = loc || (L ? L.order[0] : null);
    const piece = armorLoc ? C.armorAt(target, armorLoc) : target.armor;
    const armored = !!(piece && piece.durability > 0 && !unconscious && !coupDeGrace);
    const ctx = { v, prone, pinned, unconscious, weapon, armored, piece, loc, ai: armorLoc ? C.armorInfo(target, armorLoc) : C.armorInfo(target) };
    // A point against armor (CONFIG.pierce): it bursts through, or it must find a gap; the expectation
    // over the gap roll is what the AI and the preview see, and applyHit rolls it.
    const pc = CONFIG.pierce && armored ? pierceCheck(attacker, option, ctx) : null;
    let res;
    if (pc && pc.roll) {
      const got = armorHit(attacker, target, option, ctx, 'gap');
      const turned = armorHit(attacker, target, option, ctx, 'turned');
      res = blendHits(got, turned, pc.chance);
      res.gap = Object.assign({}, pc, { got, turned });
    } else {
      res = armorHit(attacker, target, option, ctx, pc ? pc.way : null);
      if (pc) Object.assign(res, { punch: pc.punch, resist: pc.resist });
    }
    res.location = loc;
    res.piece = armored ? piece : null;
    return res;
  }

  // The expectation over several outcomes [{w, h}] (weights summing to 1): hit locations.
  function blendMany(parts) {
    const out = Object.assign({}, parts[0].h);
    const keys = ['toCON', 'slashToAttrs', 'bluntToStamina', 'bluntToCON', 'durLoss', 'converted', 'pierceVital', 'cutVital', 'pointToAttrs', 'crushToAttrs', 'expCON', 'expAttrs'];
    for (const k of keys) out[k] = parts.reduce((n, p) => n + (p.h[k] || 0) * p.w, 0);
    out.mitigated = {};
    for (const k of ['P', 'S', 'B']) out.mitigated[k] = parts.reduce((n, p) => n + p.h.mitigated[k] * p.w, 0);
    out.armored = parts.some((p) => p.h.armored);
    out.pierce = null; out.gap = null; out.location = null; out.piece = null;
    // Armor the same everywhere (wounds that differ by location blend it too): the point meets it the same way at
    // every location, so keep how (burst, a gap at the same odds), with what a found gap and a turned point do blended.
    // Only with R4/R5 on, so that off they restore the old fight exactly (the AI's kill check reads the gap).
    if (!woundsByLocation()) return out;
    const p0 = parts[0].h;
    if (parts.every((p) => p.h.pierce === p0.pierce)) out.pierce = p0.pierce;
    if (p0.gap && parts.every((p) => p.h.gap && p.h.gap.chance === p0.gap.chance)) {
      out.gap = Object.assign({}, p0.gap, { got: blendMany(parts.map((p) => ({ w: p.w, h: p.h.gap.got }))), turned: blendMany(parts.map((p) => ({ w: p.w, h: p.h.gap.turned }))) });
    }
    return out;
  }

  // Cramped: inside the weapon's reach.min (a spear's point at range 1), in a clinch with a weapon that
  // isn't closeOK (a sword, a spear), or wielding a weapon while held in a grapple. Under the 'blunt' rule
  // the blow lands as a fraction of its force, all blunt (pommel, haft, guard).
  function isCramped(attacker, option, distance) {
    return !!((distance === 1 && option.closePenalty) ||
      (option.clinchPenalty && attacker.status && C.inClinch(attacker) && (distance == null || distance <= 1)) ||
      (CONFIG.grappledWeaponsCramped && option.weaponId && !option.ranged && isGrappled(attacker)));
  }

  // CONFIG.pierce: what a blow's piercing does against worn armor. { way: 'burst' } when its punch beats
  // the armor's resist; { way: 'gap' } when the target is pinned (the point goes in at the armpit or
  // the visor); otherwise { roll: true, need, chance }: d10 + ⌊DEX/gapDiv⌋ + feats ≥ the armor's gap
  // number finds one (a 10 always does), and failing that the armor turns the point. null: no piercing.
  function pierceCheck(attacker, option, ctx) {
    const P = CONFIG.pierce;
    const pierce = ctx.ai.pierce;
    if (!(ctx.v[0] > 0) || option.spell || !pierce) return null;
    const punch = option.punch || 0;
    const base = { punch, resist: pierce.resist };
    if (punch >= pierce.resist) return Object.assign(base, { way: 'burst' });
    if (ctx.pinned) return Object.assign(base, { way: 'gap' });
    let bonus = Math.floor(C.combatAttr(attacker, 'DEX') / P.gapDiv);
    for (const [f, b] of Object.entries(P.feats || {})) if (C.rank(attacker, f)) bonus += b;
    if (ctx.prone) bonus += P.prone || 0;
    if (option.halfSword) bonus += P.halfSword || 0;
    // A 10 always finds one unless P.natural10 is false (then it is skill and feats alone).
    const need = Math.max(1, Math.min(P.natural10 === false ? 11 : 10, pierce.gap - bonus));
    return Object.assign(base, { way: 'gap', roll: true, need, tn: pierce.gap, bonus, chance: Math.max(0, (11 - need) / 10) });
  }

  // The expectation of two outcomes (a gap found or the point turned) for the AI and the preview.
  function blendHits(a, b, p) {
    const out = Object.assign({}, a);
    for (const k of ['toCON', 'slashToAttrs', 'bluntToStamina', 'bluntToCON', 'durLoss', 'converted', 'pointToAttrs', 'crushToAttrs', 'expCON', 'expAttrs']) out[k] = (a[k] || 0) * p + (b[k] || 0) * (1 - p);
    out.mitigated = {};
    for (const k of ['P', 'S', 'B']) out.mitigated[k] = a.mitigated[k] * p + b.mitigated[k] * (1 - p);
    out.pierce = null;
    return out;
  }

  // What a blow does to this target, armored or not. way (CONFIG.pierce): 'burst' — the point is through,
  // and the piercing past the armor's P mitigation takes the pass-through rule (CONFIG.pierceMode) as any
  // blow did before; 'gap' — all of it reaches the body; 'turned' — it lands as blunt instead; null — no
  // point, or CONFIG.pierce is off (the pass-through rule), or no armor at all.
  function armorHit(attacker, target, option, ctx, way) {
    const { v, prone, pinned, unconscious, weapon, armored, ai, piece, loc } = ctx;
    let [P, S, B] = v;
    // Force that changes form on the armor (a turned point, a cut's force through mail) lands as blunt, and answers
    // to the blunt keyword (C.damageMult): a golem immune to blunt takes nothing from an arrow its body turns.
    const toBlunt = C.damageMult(target, 'B');
    if (way === 'turned') { B += Math.round(P * CONFIG.pierce.deflectBlunt * toBlunt); P = 0; }
    const motion = option.motion === 'unarmed' ? 'swing' : option.motion;
    const res = { vec: [P, S, B], P, S, B, armored: false, toCON: 0, slashToAttrs: 0, bluntToStamina: 0, bluntToCON: 0, crushToAttrs: 0, pointToAttrs: 0, converted: 0, durLoss: 0, mitigated: { P: 0, S: 0, B: 0 }, pierce: way };

    if (armored) {
      res.armored = true;
      const mit = Object.assign({}, ai.effMit);
      // Arrows: armor (textile most) catches a shaft better than a thrust. (Arrowheads differ in punch.)
      if (option.arrowHead) {
        const A = CONFIG.archery;
        mit.P = Math.max(0, mit.P + ((A.vsArrows || {})[ai.type] || 0) + (CONFIG.pierce ? 0 : ((A.heads[option.arrowHead] || {}).metalMit && ai.metal ? A.heads[option.arrowHead].metalMit : 0)));
      }
      let ignoreB = 0;
      if (weapon && weapon.bluntMitigationIgnore) ignoreB += weapon.bluntMitigationIgnore;
      if (C.rank(attacker, 'crushing_blow')) ignoreB += 2;
      mit.B = Math.max(0, mit.B - ignoreB);
      const Pr = way === 'gap' ? P : Math.max(0, P - mit.P);
      const Sr = Math.max(0, S - mit.S);
      const Br = Math.max(0, B - mit.B);
      res.mitigated = { P: P - Pr, S: S - Sr, B: B - Br };
      // Soft armor stops a cut unless the blow carries massive momentum (armor.yaml cutThrough): slashing past
      // it by more than that cuts through to the body; the rest lands as blunt.
      let Sc = Sr;
      if (ai.cutThrough != null && Sr > ai.cutThrough) {
        res.slashToAttrs = Math.round(Sr - ai.cutThrough);
        res.cutThrough = res.slashToAttrs;
        Sc = Sr - res.slashToAttrs;
      }
      // A point in a gap goes in whole, or (P.gapPass) takes the pass-through roll like a burst one.
      if (way === 'turned' || (way === 'gap' && !(CONFIG.pierce && CONFIG.pierce.gapPass))) res.toCON = Pr;
      else {
        // A point that burst the armor isn't glancing off it: coverage alone (no plate factor).
        let pass = way === 'burst' && ai.passBurst != null ? ai.passBurst : ai.passThrough;
        if (C.rank(attacker, 'find_the_gap')) pass += 0.25;
        if (C.rank(attacker, 'spot_weakness')) pass += 0.25;
        if (option.halfSword || prone || pinned) pass = CONFIG.maneuver.pronePassThrough;
        pass = Math.min(1, pass);
        res.pierceLeft = Pr;
        res.pass = pass;
        // 'floor': piercing that only barely beats the armor does not reach CON.
        // 'roll': toCON here is the expectation; applyHit rolls each point.
        res.toCON = CONFIG.pierceMode === 'roll' && pass < 1 ? Pr * pass : Math.floor(Pr * pass);
      }
      // Flexible armor (mail: armor.yaml transmit) passes more of a cut's force to the bone.
      res.converted = Math.round(Sc * Math.min(1, (CONFIG.conversion[motion] || 0) * (ai.transmit || 1)) * toBlunt);
      res.bluntToStamina = Br + res.converted;
      // Plate spreads what is left of a blow over the whole body (armor.yaml dissipate): a cut or a point it
      // turns (glancing), less or nothing of a crushing blow (a mace, a hammer, a fist).
      const spread = ai.dissipate && (C.mainIndex(option.damage) === 2 ? ai.dissipate.crushing : ai.dissipate.glancing);
      if (spread > 0 && res.bluntToStamina > 0) {
        const kept = Math.floor(res.bluntToStamina * (1 - spread));
        res.dissipated = res.bluntToStamina - kept;
        res.bluntToStamina = kept;
      }
      // Wear: blunt, converted cuts and (but for a point that went round it through a gap) piercing.
      const pierceWear = way === 'gap' ? 0 : P * (CONFIG.armorPierceWear || 0);
      res.durLoss = piece.type === 'padded' ? 0 : Math.round((B + res.converted + pierceWear) * (CONFIG.armorWearScale == null ? 1 : CONFIG.armorWearScale) * Items.wearMult(piece));
    } else {
      res.toCON = P;
      res.slashToAttrs = S;
      if (unconscious) res.bluntToCON = B;
      else res.bluntToStamina = B;
    }
    // Crushing: blunt past the armor beyond a threshold breaks bones (CON) as well as winding.
    // R5 (CONFIG.impact.crushBare): on a location with no armor, bone breaks sooner; with crushAttrs, a crush where
    // the blow landed takes that location's attributes (rolled per point in applyHit), not CON alone.
    const I = CONFIG.impact;
    if (I && res.bluntToStamina > 0 && !C.tireless(target)) {
      const bare = !(piece && piece.durability > 0);
      const at = bare && I.crushBare != null ? I.crushBare : I.crushAt;
      const crush = Math.floor(Math.max(0, res.bluntToStamina - at * sizeOf(target)) / I.crushPer);
      if (crush > 0) {
        if (I.crushAttrs && loc) res.crushToAttrs += crush;
        else res.bluntToCON += crush;
        res.crushed = crush;
      }
    }
    // Tireless creatures have no stamina to absorb a blow: blunt goes to the body (CON), and
    // they neither bleed nor take venom.
    if (C.tireless(target)) {
      res.bluntToCON += res.bluntToStamina;
      res.bluntToStamina = 0;
      res.noBleed = true;
    } else if (G.Effects.has(target, 'noBleed')) res.noBleed = true;
    // An untrained punch or kick takes stamina only: no broken bones, nothing off a body that has no stamina to lose.
    if (option.staminaOnly) { res.bluntToCON = 0; res.crushToAttrs = 0; res.crushed = 0; }
    // R4 (locations.wounds.pointToCON): a point into a limb takes the limb's attributes; the wound roll sends it to CON.
    if (pointIntoLimb(target, loc)) { res.pointLimb = true; res.pointToAttrs = res.toCON; res.toCON = 0; }
    // Wound roll odds (CONFIG.vital): deep points find vital spots; armor guards them.
    const w = option.wound;
    res.pierceVital = 0;
    res.cutVital = 0;
    res.bleedFactor = w ? w.bleed : 1;
    res.bleedRounds = w ? w.rounds : CONFIG.bleedRounds;
    if (w && w.vital && !C.tireless(target)) {
      const V = CONFIG.vital;
      let guard = 1;
      if (res.armored && !(pinned && V.pinnedOpensArmor)) {
        // The piece over where the blow lands guards the vitals there (CONFIG.locations: bare is unguarded).
        const t = piece.type;
        guard = Math.min(1, V.armor[t] != null ? V.armor[t] : V.otherArmor);
      }
      // Where it lands (CONFIG.locations.wounds.vital): the throat and the heart, not the hand.
      const WV = loc && CONFIG.locations && CONFIG.locations.wounds && CONFIG.locations.wounds.vital;
      if (WV && WV[loc] != null) guard *= WV[loc];
      if (w.kind === 'S') res.cutVital = w.vital * guard;
      else res.pierceVital = w.vital * guard;
    }
    expectWounds(target, res, loc);
    return res;
  }

  // CONFIG.locations.wounds: what one point of a wound takes where it lands, rolled among these. A tireless body
  // (tirelessCON) has no strength or speed to lose, only its frame: CON wherever it lands. Nowhere in particular: the
  // old d4 (STR, CON, SPD, DEX).
  function woundTable(target, loc) {
    const W = CONFIG.locations && CONFIG.locations.wounds;
    if (W && W.tirelessCON && C.tireless(target)) return ['CON'];
    if (loc && W && W.attrs && W.attrs[loc]) return W.attrs[loc];
    return [1, 2, 3, 4].map((i) => CONFIG.slashAttributeTable[i]);
  }

  // R4: a point that goes in here takes the location's attributes rather than CON (not the head or the torso).
  function pointIntoLimb(target, loc) {
    const W = CONFIG.locations && CONFIG.locations.wounds;
    if (!loc || !W || !W.pointToCON || !W.attrs || !W.attrs[loc] || W.pointToCON.includes(loc)) return false;
    return !(W.tirelessCON && C.tireless(target));
  }

  // Do wounds differ by location beyond the vital odds (R4, R5)? Then the AI and the preview blend over locations
  // even on a body whose armor is the same everywhere.
  function woundsByLocation() {
    const W = CONFIG.locations && CONFIG.locations.wounds, I = CONFIG.impact;
    return !!(W && (W.pointToCON || (I && (I.crushAttrs || I.crushBare != null))));
  }

  // The expectation of what applyHit takes for this hit at this location (wound rolls, the vital roll, the attribute
  // rolls), as res.expCON and res.expAttrs (every other attribute). Linear, so blends over gaps and locations stay
  // exact. A carried cut is not in it (it is rolled where it carries).
  function expectWounds(target, res, loc) {
    const m = CONFIG.vital ? CONFIG.vital.mult : 1;
    const pV = sizedVital(target, vitalNeed(res.pierceVital || 0)) / 10;
    const cV = sizedVital(target, vitalNeed(res.cutVital || 0)) / 10;
    const t = woundTable(target, loc);
    const c = t.filter((a) => a === 'CON').length / t.length;
    const pt = res.pointToAttrs || 0, sl = res.slashToAttrs || 0, cr = res.crushToAttrs || 0;
    res.expCON = res.toCON * (1 + pV * (m - 1)) + res.bluntToCON + pt * (pV * m + (1 - pV) * c) + sl * (c + cV) + cr * c;
    res.expAttrs = pt * (1 - pV) * (1 - c) + sl * (1 - c) + cr * (1 - c);
    return res;
  }

  // Roll n points of a wound among the attributes of where it landed; returns {attr: points}.
  async function rollWound(attacker, target, loc, n, label, roller) {
    const table = woundTable(target, loc);
    const tally = {};
    if (n <= 0) return tally;
    if (table.length === 1) { tally[table[0]] = n; C.damageAttr(target, table[0], n); return tally; }
    const where = loc ? ` (${(CONFIG.locations.names[loc] || loc).toLowerCase()})` : '';
    const rolls = await roller({ actorId: attacker.id, sides: table.length, count: n, label, detail: `${n}d${table.length} on ${target.name}${where}: ` + table.map((a, i) => `${i + 1} ${a}`).join(', ') });
    for (const r of rolls) {
      const a = table[Math.max(0, Math.min(table.length - 1, r - 1))];
      tally[a] = (tally[a] || 0) + 1;
      C.damageAttr(target, a, 1);
    }
    return tally;
  }

  // The d10 result at or under which a wound roll is vital (0: no roll).
  function vitalNeed(chance) {
    return Math.floor(chance * 10 + 1e-9);
  }

  // Fire (magic stub): armor stops part of it; every few points left over cost 1 CON,
  // the rest goes to stamina. Burns don't bleed.
  function computeFire(attacker, target, option, flags) {
    const M = CONFIG.magic;
    let mag = option.spell.magnitude;
    if (flags.half) mag = Math.floor(mag / 2);
    // Resisting the element (a mail that shrugs off fire, a frost ward, a golem; `magic` for every spell).
    const gr = spellMult(target, option.spell.element);
    if (gr !== 1) mag = Math.floor(mag * gr);
    const hm = heroMult(attacker, target);
    if (hm !== 1) mag = Math.round(mag * hm);
    const res = Object.assign(blankHit(), { fire: mag });
    const unconscious = target.stamina <= 0;
    let left = mag;
    const el = option.spell.element;
    const share = M.energyMitigation ? M.energyMitigation[el] : M.fireMitigation;
    // Lightning runs straight through metal armor.
    const conducts = el === 'lightning' && target.armor && C.armorInfo(target).metal;
    if (target.armor && target.armor.durability > 0 && !conducts) {
      const stop = Math.round(C.armorInfo(target).effMit.B * (share == null ? M.fireMitigation : share));
      left = Math.max(0, mag - stop);
      res.fireStopped = mag - left;
    }
    // Light and spirit sear the undead; spirit only chills the living (half, to stamina).
    const bane = (M.undeadBane || {})[el];
    if (bane && G.Effects.has(target, 'undead')) left *= bane;
    if (el === 'spirit' && !G.Effects.has(target, 'undead')) {
      res.bluntToStamina = Math.floor(left / 2);
      return res;
    }
    if (unconscious) res.toCON = left;
    else {
      res.toCON = Math.floor(left / M.fireConPer);
      res.bluntToStamina = left - res.toCON;
    }
    res.expCON = res.toCON;
    return res;
  }

  // Life withers the living body: half its magnitude to CON, no armor stops it. The tireless
  // (undead, constructs) have no life to wither.
  function computeLife(attacker, target, option, flags) {
    let mag = option.spell.magnitude;
    if (flags.half) mag = Math.floor(mag / 2);
    mag = Math.floor(mag * spellMult(target, 'life'));
    const res = blankHit();
    if (!C.tireless(target)) res.toCON = Math.floor(mag / 2);
    res.expCON = res.toCON;
    return res;
  }

  // Size (monster trait, 1 = a person): a blade's reach into a big body is shallow; its vitals
  // are harder to reach and its wounds bleed less in proportion.
  function sizeOf(c) {
    return (c.traits && c.traits.size) || 1;
  }

  function sizedVital(target, need) {
    const sz = sizeOf(target);
    return sz > 1 ? Math.floor(need / sz) : need;
  }

  // Spells that don't go through armor by the blow's faces: no hit location (computeHit's early returns).
  function bodyBlow(target, option) {
    if (!option.spell) return true;
    const el = option.spell.element;
    if (spellMult(target, el) === 0) return false;
    if (CONFIG.magic.energyMitigation && CONFIG.magic.energyMitigation[el] != null) return false;
    return el !== 'life';
  }

  // The chance an aimed blow lands where it was aimed (CONFIG.locations.aim.hold): a body that can still move covers
  // what is aimed at and opens something else; one that can't (prone, down, held, or not seeing the blow) can't.
  function aimHold(attacker, target, option) {
    const H = CONFIG.locations && CONFIG.locations.aim && CONFIG.locations.aim.hold;
    if (!H) return 1;
    if (target.status.prone || !C.isActive(target) || C.isHeld(target) || C.isPinned(target)) return 1;
    if (attacker && G.Effects.has(attacker, 'unseen')) return 1;
    const sk = attacker ? C.attackSkill(attacker, option) : 0;
    return Math.max(0, Math.min(H.max != null ? H.max : 1, (H.base || 0) + (H.perSkill || 0) * sk));
  }

  // Roll where a blow lands (CONFIG.locations: d100 against the shares). Only against a body whose locations
  // differ; null otherwise.
  async function rollLocation(attacker, target, option, roller) {
    const L = CONFIG.locations;
    if (!L || !bodyBlow(target, option) || (!L.wounds && C.armorUniform(target))) return null;
    const r = (await roller({ actorId: attacker.id, sides: 100, count: 1, label: 'Hit location', detail: `d100 on ${target.name}: ` + L.order.map((l) => `${L.names[l] || l} ${Math.round((L.share[l] || 0) * 100)}%`).join(', ') }))[0];
    let acc = 0;
    for (const l of L.order) { acc += Math.round((L.share[l] || 0) * 100); if (r <= acc) return l; }
    return L.order[L.order.length - 1];
  }

  // A point that can't burst the armor must find a gap (CONFIG.pierce); failing that, the armor turns it.
  async function resolveGap(attacker, target, h, roller) {
    if (!h.gap) return h;
    const g = h.gap;
    const r = (await roller({ actorId: attacker.id, sides: 10, count: 1, label: 'Finding a gap', detail: `d10 ≥ ${g.need} finds a gap in ${target.name}'s armor (punch ${g.punch} against ${g.resist}: too little to burst it); otherwise the point is turned` }))[0];
    return Object.assign(r >= g.need ? g.got : g.turned, { location: h.location, piece: h.piece });
  }

  // Carry-through (CONFIG.locations.carry, the user's call): a cut that got through a limb or the head
  // (bare, or cutting through cloth or leather) carries the slashing beyond a limb's worth into the next
  // location, where that location's armor meets it. Returns the second hit (applied with the first), or null.
  async function carryCut(attacker, target, option, h, roller) {
    const K = CONFIG.locations && CONFIG.locations.carry;
    if (!K || !h.location || !(h.slashToAttrs > K.limb)) return null;
    const next = (K.next || {})[h.location];
    if (!next || !next.length) return null;
    const into = next.length > 1 ? next[(await roller({ actorId: attacker.id, sides: next.length, count: 1, label: 'The cut carries on', detail: `d${next.length}: ` + next.map((l, i) => `${i + 1} ${CONFIG.locations.names[l] || l}`).join(', ') }))[0] - 1] : next[0];
    const extra = h.slashToAttrs - K.limb;
    h.slashToAttrs = K.limb;
    const h2 = await resolveGap(attacker, target, computeHit(attacker, target, Object.assign({}, option, { damage: [0, extra, 0], punch: 0 }), { location: into, carried: true }), roller);
    h2.carried = extra;
    return h2;
  }

  // What a wound does where it lands (CONFIG.locations.wounds.effects): a hand or arm may lose its grip, a leg go
  // out from under, a blow to the head stun. Odds per point that reached the body there (blunt for a stun), ÷ size.
  async function woundEffects(enc, attacker, target, option, primary, roller, parts) {
    const E = CONFIG.locations && CONFIG.locations.wounds && CONFIG.locations.wounds.effects;
    const fx = E && primary.loc ? E[primary.loc] : null;
    if (!fx || !C.isActive(target)) return;
    const wound = primary.toCON + primary.slash;
    const sz = sizeOf(target);
    const chance = (per, n) => Math.min(0.9, (per * n) / sz);
    const roll = async (p, label) => p > 0 && (await rollDie(roller, attacker.id, 100, label, `d100: ${Math.round(p * 100)} or less`)) <= Math.round(p * 100);
    if (fx.disarm && wound > 0 && C.wieldedWeapon(target) && !C.wieldedWeapon(target).natural) {
      if (await roll(chance(fx.disarm, wound), `${target.name}: keep hold`)) {
        const w = dropHeld(target);
        if (w) parts.push(`${target.name}'s hand opens: ${Items.itemName(w)} falls`);
      }
    }
    if (fx.trip && wound > 0 && !target.status.prone && !G.Effects.has(target, 'flying')) {
      if (await roll(chance(fx.trip, wound), `${target.name}: keep footing`)) {
        knockDown(enc, target);
        parts.push(`${target.name}'s leg gives: down`);
      }
    }
    if (fx.stun && primary.blunt > 0 && G.Magic && G.Conditions && !C.tireless(target)) {
      if (await roll(chance(fx.stun, primary.blunt), `${target.name}: a blow to the head`)) {
        const got = await G.Magic.afflict(enc, attacker, target, 'stunned', { rounds: 1 }, roller);
        if (got !== false) parts.push(`${target.name} is stunned`);
      }
    }
  }

  // Apply a hit, rolling d4s for slashing. Returns a short description.
  async function applyHit(enc, chars, attacker, target, option, roller, flags) {
    let loc = flags && flags.location;
    if (!loc && option.aim && bodyBlow(target, option)) {
      // An aimed blow lands there only if the body doesn't close it (aimHold); else where it is open.
      const p = aimHold(attacker, target, option);
      if (p >= 1) loc = option.aim;
      else {
        const r = (await roller({ actorId: attacker.id, sides: 100, count: 1, label: 'On target', detail: `d100 ≤ ${Math.round(p * 100)}: lands on the ${(CONFIG.locations.names[option.aim] || option.aim).toLowerCase()} as aimed; else wherever ${target.name} is open` }))[0];
        loc = r <= Math.round(p * 100) ? option.aim : null;
      }
    }
    if (!loc) loc = await rollLocation(attacker, target, option, roller);
    let h = computeHit(attacker, target, option, Object.assign({}, flags, loc ? { location: loc } : {}));
    const parts = [];
    if (h.location) parts.push(`on the ${(CONFIG.locations.names[h.location] || h.location).toLowerCase()}${h.piece ? '' : ' (bare)'}`);
    h = await resolveGap(attacker, target, h, roller);
    const carried = await carryCut(attacker, target, option, h, roller);
    if (h.pierce === 'burst') parts.push('the point bursts through');
    else if (h.pierce === 'gap') parts.push('the point finds a gap');
    else if (h.pierce === 'turned') parts.push('the armor turns the point');
    // The blade meets the armor: metal chews an edge, cloth and leather barely touch it, flesh not at all.
    // A turned point takes it worst.
    const piece = h.piece || (h.location ? null : target.armor);
    if (h.armored && piece) wearWeapon(enc, attacker, weaponItem(attacker, option), blowForce(option), h.pierce === 'turned' ? 'deflected' : 'hit', armorMaterial(piece));
    const st = target.status;
    const before0 = { dmg: C.totalDamage(target), stamina: target.stamina, up: C.isActive(target) };
    const before = enc.onHit ? before0 : null;

    if (h.fire != null && h.fireStopped) parts.push(`armor stops ${h.fireStopped} ${option.spell ? option.spell.element : 'fire'}`);
    if (h.armored && piece) {
      piece.durability = Math.max(0, piece.durability - h.durLoss);
      if (h.mitigated.P + h.mitigated.S + h.mitigated.B > 0) parts.push(`armor stops ${h.mitigated.P}/${h.mitigated.S}/${h.mitigated.B}`);
      if (h.converted) parts.push(`${h.converted} slashing → blunt`);
      if (h.dissipated) parts.push(`the plate spreads ${h.dissipated} of the blow`);
      if (h.cutThrough) parts.push('the blade cuts through');
      if (h.durLoss) parts.push(`armor durability −${h.durLoss}`);
    }
    // What landed where it struck, for the location's wound effects (before a carried cut joins it).
    const primary = { loc: h.location, toCON: h.toCON + (h.pointToAttrs || 0), slash: h.slashToAttrs, blunt: h.bluntToStamina + h.bluntToCON + (h.crushToAttrs || 0) };
    // The carried part of a cut: its own armor, its own wear, then it counts with the rest of the blow.
    if (carried) {
      const cn = (CONFIG.locations.names[carried.location] || carried.location).toLowerCase();
      parts.push(`the cut carries ${carried.carried} into the ${cn}${carried.piece ? '' : ' (bare)'}`);
      if (carried.armored && carried.piece) {
        carried.piece.durability = Math.max(0, carried.piece.durability - carried.durLoss);
        if (carried.mitigated.S + carried.mitigated.B > 0) parts.push(`armor there stops ${carried.mitigated.S}`);
      }
      h = Object.assign({}, h, {
        slashToAttrs: h.slashToAttrs + carried.slashToAttrs,
        bluntToStamina: h.bluntToStamina + carried.bluntToStamina,
        bluntToCON: h.bluntToCON + carried.bluntToCON,
        cutVital: Math.max(h.cutVital || 0, carried.cutVital || 0),
      });
    }

    let wound = 0;
    if (h.armored && h.pierce !== 'turned' && (h.pierce !== 'gap' || CONFIG.pierce.gapPass) && CONFIG.pierceMode === 'roll' && h.pierceLeft > 0 && h.pass < 1) {
      const need = Math.round(h.pass * 10);
      const rolls = await roller({ actorId: attacker.id, sides: 10, count: h.pierceLeft, label: 'Piercing through armor', detail: `${h.pierceLeft}d10 vs ${target.name}'s armor: each ${need} or less reaches CON` });
      const n = rolls.filter((r) => r <= need).length;
      if (h.pointLimb) h.pointToAttrs = n; else h.toCON = n;
    }
    let pierced = 0, vital = false, cutVital = false;
    if (h.toCON > 0) {
      C.damageAttr(target, 'CON', h.toCON);
      parts.push(`${h.toCON} CON`);
      wound += h.toCON;
      pierced = h.toCON;
      const need = sizedVital(target, vitalNeed(h.pierceVital));
      if (need > 0) {
        const r = (await roller({ actorId: attacker.id, sides: 10, count: 1, label: 'Wound roll', detail: `d10: ${need} or less is a vital wound (×${CONFIG.vital.mult} CON)` }))[0];
        if (r <= need) {
          const extra = h.toCON * (CONFIG.vital.mult - 1);
          C.damageAttr(target, 'CON', extra);
          parts.push(`VITAL WOUND +${extra} CON`);
          vital = true;
        }
      }
    }
    if (h.pointToAttrs > 0) {
      // R4: a point into a limb. The wound roll (weighted by location) finds an artery or a vital spot: CON × mult, as
      // anywhere; otherwise each point takes one of the limb's attributes.
      const n = h.pointToAttrs;
      wound += n;
      pierced += n;
      const need = sizedVital(target, vitalNeed(h.pierceVital));
      if (need > 0 && (await roller({ actorId: attacker.id, sides: 10, count: 1, label: 'Wound roll', detail: `d10: ${need} or less is a vital wound (${n} × ${CONFIG.vital.mult} CON); else the ${(CONFIG.locations.names[primary.loc] || primary.loc).toLowerCase()} takes it` }))[0] <= need) {
        C.damageAttr(target, 'CON', n * CONFIG.vital.mult);
        parts.push(`VITAL WOUND ${n * CONFIG.vital.mult} CON`);
        vital = true;
      } else {
        const tally = await rollWound(attacker, target, primary.loc, n, 'Where the point goes in', roller);
        parts.push(Object.keys(tally).map((a) => `${tally[a]} ${a}`).join(', '));
      }
    }
    if (h.slashToAttrs > 0) {
      // Each point of a cut takes an attribute: from the location's table (CONFIG.locations.wounds.attrs), else the
      // old d4 (1 STR, 2 CON, 3 SPD, 4 DEX). A carried cut's points take from where it carried to.
      const groups = [{ loc: primary.loc, n: h.slashToAttrs - (carried ? carried.slashToAttrs : 0) }];
      if (carried && carried.slashToAttrs > 0) groups.push({ loc: carried.location, n: carried.slashToAttrs });
      const tally = {};
      for (const g of groups) {
        const got = await rollWound(attacker, target, g.loc, g.n, 'Slashing hit locations', roller);
        for (const a in got) tally[a] = (tally[a] || 0) + got[a];
      }
      parts.push(Object.keys(tally).map((a) => `${tally[a]} ${a}`).join(', '));
      wound += h.slashToAttrs;
      const need = sizedVital(target, vitalNeed(h.cutVital));
      if (need > 0) {
        const r = (await roller({ actorId: attacker.id, sides: 10, count: 1, label: 'Wound roll', detail: `d10: ${need} or less opens a throat or an artery (+${h.slashToAttrs} CON)` }))[0];
        if (r <= need) {
          C.damageAttr(target, 'CON', h.slashToAttrs);
          parts.push(`VITAL CUT +${h.slashToAttrs} CON`);
          cutVital = true;
        }
      }
    }
    if (h.bluntToCON > 0) {
      C.damageAttr(target, 'CON', h.bluntToCON);
      parts.push(`${h.bluntToCON} CON (blunt)`);
    }
    if (h.crushToAttrs > 0) {
      // R5: bone breaks where the blow landed.
      const tally = await rollWound(attacker, target, primary.loc, h.crushToAttrs, 'Broken bones', roller);
      parts.push('bone breaks: ' + Object.keys(tally).map((a) => `${tally[a]} ${a}`).join(', '));
    }
    if (h.bluntToStamina > 0) {
      let amt = h.bluntToStamina;
      if (h.armored && C.rank(target, 'living_fortress') && !enc.fortressUsed[target.id]) {
        enc.fortressUsed[target.id] = true;
        parts.push('Living Fortress absorbs the blow');
        amt = 0;
      }
      if (amt > 0) {
        target.stamina = Math.max(0, target.stamina - amt);
        enc.hitThisRound[target.id] = (enc.hitThisRound[target.id] || 0) + amt;
        parts.push(`${amt} stamina`);
      }
    }
    await woundEffects(enc, attacker, target, option, primary, roller, parts);
    if (option.venom && wound > 0 && !h.noBleed && C.damageMult(target, 'venom') > 0) {
      // The deeper the bite, the more venom: up to `con` a round, never more than the wound.
      const per = Math.min(option.venom.con, wound);
      target.bleeds.push({ remaining: per * option.venom.rounds, rounds: option.venom.rounds, poison: true });
      parts.push('poisoned');
    }
    if (option.spell && option.spell.element === 'fire') {
      (enc.burned || (enc.burned = {}))[target.id] = true;
      if (target.status.webbed) { target.status.webbed = 0; parts.push('the webs burn away'); }
    }
    if (wound > 0 && !h.noBleed) {
      // A piercing wound bleeds by its width, for longer the deeper it goes (a vital one twice
      // as much); a cut bleeds its own damage again. A broadhead's wide cut bleeds worse.
      const hd = option.arrowHead && CONFIG.archery.heads[option.arrowHead];
      const hdMult = hd ? hd.bleed : 1;
      const cut = h.slashToAttrs * (cutVital ? 2 : 1);
      const pierceBleed = pierced * h.bleedFactor * (vital ? 2 : 1);
      if (h.bleedRounds === CONFIG.bleedRounds) {
        target.bleeds.push({ remaining: Math.round((pierceBleed + cut) * hdMult), rounds: CONFIG.bleedRounds });
      } else {
        if (pierceBleed > 0) target.bleeds.push({ remaining: Math.round(pierceBleed * hdMult), rounds: h.bleedRounds });
        if (cut > 0) target.bleeds.push({ remaining: Math.round(cut * hdMult), rounds: CONFIG.bleedRounds });
      }
      // A big body (trait size) loses less of itself to a man-sized wound.
      const sz = sizeOf(target);
      if (sz > 1) for (const b of target.bleeds) if (!b.sized) { b.remaining = Math.round(b.remaining / sz); b.sized = true; }
      target.bleeds = target.bleeds.filter((b) => b.remaining > 0);
      parts.push('bleeding');
    }
    // A blow that hurts wakes the mesmerized and ends a calm.
    const harmed = h.toCON + (h.pointToAttrs || 0) + h.slashToAttrs + h.bluntToCON + (h.crushToAttrs || 0) + h.bluntToStamina > 0;
    if (harmed && G.Conditions) for (const x of G.Conditions.list(target).slice()) {
      if ((CONFIG.conditions[x.key] || {}).breakOnHarm) { G.Conditions.remove(target, x.key); parts.push(`${CONFIG.conditions[x.key].name.toLowerCase()} no more`); }
    }
    // A charm broken by harm gives the bearer back to their own side at once.
    if (target.charmed && G.Conditions && !G.Conditions.list(target).some((x) => (CONFIG.conditions[x.key] || {}).control)) {
      target.side = target.charmed.side; target.control = target.charmed.control; delete target.charmed;
      parts.push(`${target.name} comes back to themselves`);
    }
    if (passesThrough(attacker, target, option)) parts.push('it passes through');
    if (h.magicImmune) parts.push('the magic washes off it');
    if (!parts.length) parts.push('no effect');
    const wasDown = st.unconscious;
    C.updateCondition(target);
    let tail = '';
    if (st.dead) tail = ` ${target.name} is DEAD.`;
    else if (st.unconscious && !wasDown) tail = ` ${target.name} ${downWord(target)}.`;
    // Impact: a hard blow throws its target back.
    if (harmed && CONFIG.impact) {
      const landed = h.bluntToStamina + h.bluntToCON + (h.crushToAttrs || 0) + (h.toCON + (h.pointToAttrs || 0) + h.slashToAttrs) / 2;
      const back = Math.min(CONFIG.impact.knockbackMax, Math.floor(landed / CONFIG.impact.knockbackPer / sizeOf(target)));
      if (back > 0 && !option.spell && !st.dead && attacker !== target && enc.pos[attacker.id] && enc.pos[target.id] && G.Magic) {
        await G.Magic.push(enc, chars, target, enc.pos[attacker.id], back, roller);
      }
    }
    // An enchanted blade that drinks (enchantments.yaml drain): the wielder
    // takes back a share of the stamina and attribute points the blow dealt.
    const blade = option.weaponId && attacker.weapons ? attacker.weapons.find((w) => w.id === option.weaponId) : null;
    const drain = blade && (Items.enchantsOf(blade).find((e) => e.drain) || {}).drain;
    if (drain && before0) {
      const took = { attrs: C.totalDamage(target) - before0.dmg, stamina: Math.max(0, before0.stamina - target.stamina) };
      const st = Math.round(took.stamina * (drain.stamina || 0));
      let heal = Math.round(took.attrs * (drain.attrs || 0));
      const gotSt = Math.min(st, C.maxStamina(attacker) - attacker.stamina);
      if (gotSt > 0) attacker.stamina += gotSt;
      let healed = 0;
      while (heal > 0) {
        const a = G.Recovery ? G.Recovery.healTarget(attacker) : (attacker.damage.CON ? 'CON' : null);
        if (!a) break;
        C.healAttr(attacker, a, 1);
        heal--; healed++;
      }
      if (gotSt > 0 || healed) tail += ` ${Items.itemName(blade)} drinks: ${attacker.name} ${[gotSt ? `+${gotSt} stamina` : null, healed ? `+${healed} healed` : null].filter(Boolean).join(', ')}.`;
    }
    // Sims attach enc.onHit to credit harm and knockdowns to whoever dealt them (sim/metrics.js reads the option and
    // location too). Unset in play: nothing is built.
    if (before) enc.onHit({ attacker, target, option, location: h.location || null, attrs: C.totalDamage(target) - before.dmg, stamina: Math.max(0, before.stamina - target.stamina), downed: before.up && !C.isActive(target), spell: !!option.spell });
    // Pinning Shot: an arrow in the legs or feet that draws blood roots them.
    if (option.ranged && attacker && C.rank(attacker, 'pinning_shot') && ['legs', 'feet'].includes(h.location) && C.isActive(target) && (C.totalDamage(target) > before0.dmg || target.bleeds.length) && G.Conditions) {
      G.Conditions.add(target, 'rooted', { rounds: 2, src: attacker.id });
      log(enc, `The arrow pins ${target.name} where they stand.`, 'hit');
    }
    return { text: `${h.P}/${h.S}/${h.B} P/S/B → ${parts.join(', ')}.${tail}`, hit: h };
  }

  // Deceiving and reading in a fight: Deception and Anticipation, + gear's feint and readAttack.
  function feintScore(c) {
    return C.skill(c, 'deception') + G.Effects.sum(c, 'feint');
  }
  function readScore(c) {
    return C.skill(c, 'anticipation') + G.Effects.sum(c, 'readAttack');
  }

  // ---- Checks ------------------------------------------------------------
  const half = (n) => Math.floor((n - 5) / 2);

  // Numbers for a defense; shared by the check and the AI's odds.
  //   block: d10 + Shield Training ≥ the shield's target number.
  //   parry, dodge (CONFIG.defense.opposed): directly opposed. Defender d10 + Training +
  //   ⌊(DEX + SPD)/4⌋ (armor-reduced) against attacker d10 + ⌊(STR + SPD)/4⌋ + the motion's
  //   penalty (+ for a parry, how much heavier the attacking weapon is). Ties go to the defender.
  //   Off-hand parry: a parry with the off-hand dagger (+offhandBonus), against thrusts only.
  // What a read of `t` says: their real commitments this round (feints seen through), or, on a
  // misread, something they aren't doing. `seed` picks the false one.
  function intentNote(enc, chars, t, truth, seed) {
    const pending = enc.decls.filter((d) => d.actor === t.id && !d.done && !d.used);
    const say = (d) => describeBare(enc, chars, d, t.id).text.replace(t.name + ': ', '').replace(/ \[\d+ AP\]$/, '');
    if (truth) return pending.length ? `they mean to ${pending.map(say).join(', then ')}.` : 'they are holding back, waiting for an opening.';
    const real = new Set(pending.filter((d) => d.type === 'strike').map((d) => d.option.label));
    const opts = C.attackOptions(t).filter((o) => !real.has(o.label));
    const fakes = opts.map((o) => `${o.label.toLowerCase()} at the nearest foe`).concat(['ready a parry', 'fall back', 'rush in close']);
    return `they mean to ${fakes[seed % fakes.length]}.`;
  }

  // Reading and bait: +read to the one who reads the other's intent (−read on a misread);
  // baited defends worse.
  function intentMods(defender, attacker) {
    const out = { def: 0, atk: 0 };
    if (!G.Conditions) return out;
    const bonus = CONFIG.social ? CONFIG.social.readBonus : 2;
    // +bonus for a true read, −bonus for a misread, 0 for none.
    const reads = (x, y) => {
      const k = G.Conditions.list(x).find((q) => { const D = CONFIG.conditions[q.key] || {}; return D.read && (D.all || (y && q.vs === y.id)); });
      return !k ? 0 : k.truth === false ? -bonus : bonus;
    };
    if (attacker) out.def += reads(defender, attacker);
    if (attacker) out.atk += reads(attacker, defender);
    out.def += G.Conditions.list(defender).reduce((t, k) => t + ((CONFIG.conditions[k.key] || {}).defense || 0), 0);
    return out;
  }

  // R6 (docs/PLAN.md; rules.yaml locations.aim.guarded): can the one meeting this blow still move to cover a small
  // target? Not if prone, down or collapsed, held or pinned, caught off guard (the surprised side in its first round),
  // or not seeing the blow. Out of AP is the other case, and needs no test here: a defender with none puts up no
  // defence, so no aim penalty is paid at all.
  // aimOpen says why not (a word for the panel), or null when they can.
  function aimOpen(defender, attacker, enc) {
    if (!defender || !defender.status) return null;
    if (!C.isActive(defender)) return C.collapsed && C.collapsed(defender) ? 'collapsed' : 'down';
    if (defender.status.prone) return 'prone';
    if (C.isHeld(defender) || C.isPinned(defender)) return 'held';
    if (attacker && G.Effects.has(attacker, 'unseen')) return 'unseen';
    const sp = enc && enc.surprise;
    if (sp && sp.round === enc.round && defender.side === sp.side) return 'caught off guard';
    return null;
  }
  function aimGuarded(defender, attacker, enc) {
    return !!defender && !aimOpen(defender, attacker, enc);
  }

  // What aiming a blow at a location costs it against a defence (CONFIG.locations.aim): `guarded` against a defender
  // who can still react (aimGuarded), `penalty` against one who can't; a thrust `thrustLess` less either way.
  function aimPenalty(option, loc, guarded) {
    const A = CONFIG.locations && CONFIG.locations.aim;
    if (!A || !loc) return 0;
    const table = guarded && A.guarded ? A.guarded : A.penalty;
    return Math.max(0, (table[loc] || 0) - (option && option.motion === 'thrust' ? A.thrustLess || 0 : 0));
  }

  function defenseNumbers(defender, kind, motion, attacker, atkOption, enc) {
    const r = defenseNumbersBase(defender, kind, motion, attacker, atkOption);
    const m = intentMods(defender, attacker);
    const aim = atkOption && atkOption.aim;
    if (aim) {
      // The AI weighs a blow it hasn't thrown with its own guess (atkOption.aimGuarded); a real defence reads the body.
      const guarded = atkOption.aimGuarded != null ? atkOption.aimGuarded : aimGuarded(defender, attacker, enc);
      if (!(atkOption.ranged && attacker && C.rank(attacker, 'deadeye'))) m.atk -= aimPenalty(atkOption, aim, guarded);
      const S = CONFIG.locations.aim.shield;
      if (kind === 'block' && S && (S.covers || []).includes(aim)) m.def += S.block || 0;
    }
    // Gear that guides the blow (effects.hit); a blow from someone unseen is hard to meet.
    if (attacker) m.atk += G.Effects.sum(attacker, 'hit') + (G.Effects.has(attacker, 'unseen') ? 2 : 0);
    // A spent blow (R2) is easier to meet.
    if (atkOption && atkOption.spent && CONFIG.stamina && CONFIG.stamina.spent) m.atk -= CONFIG.stamina.spent.attack || 0;
    r.bonus += m.def;
    if (r.opposed) r.attack += m.atk;
    else r.tn += m.atk;
    return r;
  }

  function defenseNumbersBase(defender, kind, motion, attacker, atkOption) {
    const D = CONFIG.defense;
    const strikeBonus = () => (attacker ? Math.floor((C.attr(attacker, 'STR') + C.combatAttr(attacker, 'SPD')) / 4) : D.typicalAttacker);
    if (kind === 'block' && D.block.opposed) {
      // Contested: d10 + Shield Training + the shield's size + ⌊(STR + DEX)/4⌋ (bracing) against the blow.
      const size = defender.shield && D.block.bySize ? D.block.bySize[defender.shield.size] || 0 : 0;
      const bonus = G.Effects.sum(defender, 'block') + size + Math.floor((C.attr(defender, 'STR') + C.combatAttr(defender, 'DEX')) / 4) + skillEdge(defender, attacker, 'block', atkOption);
      return { bonus, attack: strikeBonus() + (D.motionPenalty[motion] || 0), opposed: true };
    }
    if (kind === 'block') {
      let tn = D.block.tn;
      const bySize = D.block.tnBySize;
      if (bySize && defender.shield && bySize[defender.shield.size] != null) tn = bySize[defender.shield.size];
      return { bonus: G.Effects.sum(defender, 'block'), tn };
    }
    const parry = kind === 'parry' || kind === 'offParry';
    if (D.opposed) {
      const agile = Math.floor((C.combatAttr(defender, 'DEX') + C.combatAttr(defender, 'SPD')) / 4);
      let bonus = agile + (parry ? G.Effects.sum(defender, 'parry') : G.Effects.sum(defender, 'dodge') + (D.dodgeBonus || 0));
      if (kind === 'offParry') bonus += D.offhandBonus || 0;
      // The dodge pays the armor's weight again (CONFIG.defense.dodgeArmor).
      if (kind === 'dodge' && D.dodgeArmor) {
        const ai = C.armorInfo(defender);
        bonus -= Math.round((ai.spd + ai.dex) * D.dodgeArmor);
      }
      let atk = D.motionPenalty[motion] || 0;
      bonus += skillEdge(defender, attacker, kind, atkOption);
      if (parry && D.leverage) {
        // A parry meets the blow with the parrying weapon's weight: nearer a shield the more it outweighs the blow.
        bonus += leverage(defender, kind, atkOption);
        atk += strikeBonus();
      } else if (parry && D.parryForce) {
        // A parry meets the blow's force with the parrying weapon's own (its best blow in my hands).
        if (atkOption && atkOption.damage) {
          const f = blowForce(atkOption), mine = parryForce(defender, kind);
          atk += Math.floor(Math.max(0, f - mine / 2) / D.parryForce.per) + (D.parryForce.over ? Math.floor(Math.max(0, f - mine) / D.parryForce.over) : 0);
          if (attacker) atk += Math.floor(C.combatAttr(attacker, 'SPD') / 4); // the quickness of the blow
        } else atk += D.typicalAttacker;
      } else {
        atk += strikeBonus();
        if (parry && atkOption && atkOption.weaponType) {
          const order = CONFIG.weightOrder;
          const theirs = order.indexOf(Items.weaponStats(atkOption.weaponType).weight);
          const mine = parryingWeapon(defender, kind);
          const gap = theirs - (mine ? order.indexOf(Items.weaponStats(mine).weight) : 0);
          atk += Math.max(0, gap);
        }
      }
      return { bonus, attack: atk, opposed: true };
    }
    let bonus = 0, tn = D[parry ? 'parry' : kind].tn;
    if (parry) {
      bonus = G.Effects.sum(defender, 'parry') + half(C.combatAttr(defender, 'DEX'));
      tn += D.motionPenalty[motion] || 0;
    } else {
      bonus = G.Effects.sum(defender, 'dodge') + half(C.combatAttr(defender, 'SPD')) - C.armorInfo(defender).dex;
      tn += D.motionPenalty[motion] || 0;
    }
    return { bonus, tn };
  }

  // CONFIG.defense.leverage: what the parrying weapon's weight adds to a parry of this blow (0 for an equal weapon,
  // nearing +max as it outweighs the blow, −max as it is outweighed). Against a blow whose force can't be seen, 0.
  function leverage(defender, kind, atkOption) {
    const K = CONFIG.defense.leverage;
    const mine = parryForce(defender, kind), f = blowForce(atkOption);
    if (!(f > 0)) return 0;
    const x = Math.log2(Math.max(mine, 0.5) / f);
    return Math.round(K.max * x / (1 + Math.abs(x)));
  }

  // CONFIG.skills.defense: the share of (the defender's skill in this defence − the attacker's with the blow) that
  // adds to it (0 against an attacker not known).
  function skillEdge(defender, attacker, kind, atkOption) {
    const K = CONFIG.skills && CONFIG.skills.defense;
    if (!K || !attacker) return 0;
    const share = K[kind === 'offParry' ? 'parry' : kind || 'parry'] || 0;
    return Math.round(share * (C.defenseSkill(defender, kind || 'parry') - C.attackSkill(attacker, atkOption)));
  }

  // A blow's force: its expected damage, all kinds together.
  function blowForce(o) {
    return o && o.damage ? o.damage[0] + o.damage[1] + o.damage[2] : 0;
  }

  // The force a parrying weapon can meet a blow with: its best blow in this wielder's hands.
  function parryForce(c, kind) {
    const w = parryingWeapon(c, kind);
    if (!w) return 0;
    let best = 0;
    for (const o of C.attackOptions(c)) if (o.weaponId === w.id && !o.unarmed) best = Math.max(best, blowForce(o));
    return best;
  }

  // CONFIG.defense.parryCarry: the share of a parried blow that still lands (0 for a thrust, or a blow the
  // parrying weapon can meet in full).
  function parryCarryShare(defender, kind, option) {
    const K = CONFIG.defense.parryCarry;
    if (!K || !option || !option.damage || option.ranged || option.spell || !(K.motions || []).includes(option.motion)) return 0;
    const f = blowForce(option), mine = parryForce(defender, kind);
    return f > mine ? Math.min(1, K.share * (f - mine) / f) : 0;
  }

  // The weapon a parry is made with.
  function parryingWeapon(c, kind) {
    return kind === 'offParry' ? C.offhandWeapon(c) : C.wieldedWeapon(c);
  }

  // Chance a defense succeeds (the attacker's numbers when known).
  function defenseOdds(defender, kind, motion, attacker, atkOption, extra, enc) {
    const n = defenseNumbers(defender, kind, motion, attacker, atkOption, enc);
    n.bonus += extra || 0;
    if (n.opposed) return opposedOdds(n.bonus, n.attack, 0);
    const die = CONFIG.defense.die;
    return Math.max(0, Math.min(1, (die - (n.tn - n.bonus) + 1) / die));
  }

  async function defenseCheck(enc, chars, defender, kind, atkDecl, roller, extra) {
    const D = CONFIG.defense;
    const motion = atkDecl.type === 'strike' ? atkDecl.option.motion : 'maneuver';
    const attacker = chars[atkDecl.actor];
    const n = defenseNumbers(defender, kind, motion, attacker, atkDecl.type === 'strike' ? atkDecl.option : null, enc);
    n.bonus += extra || 0;
    const name = ACTIONS[kind].name;
    if (n.opposed) {
      const o = await opposed(roller, defender, n.bonus, name, attacker, n.attack, 'Press the attack');
      return { ok: o.margin >= 0, roll: o.a - n.bonus, total: o.a, tn: o.b };
    }
    const label = `${name}: d10 + ${n.bonus} ≥ ${n.tn}`;
    const r = await rollDie(roller, defender.id, D.die, `${defender.name}: ${name}`, label);
    return { ok: r + n.bonus >= n.tn, roll: r, total: r + n.bonus, tn: n.tn };
  }

  async function opposed(roller, a, aBonus, aLabel, b, bBonus, bLabel) {
    const ra = await rollDie(roller, a.id, CONFIG.maneuver.die, `${a.name}: ${aLabel}`, `d10 + ${aBonus}`);
    const rb = await rollDie(roller, b.id, CONFIG.maneuver.die, `${b.name}: ${bLabel}`, `d10 + ${bBonus}`);
    return { a: ra + aBonus, b: rb + bBonus, margin: ra + aBonus - (rb + bBonus) };
  }

  function stability(c) {
    const M = CONFIG.maneuver;
    return Math.floor(C.attr(c, 'STR') / 2) + C.skill(c, 'athletics') + (M.armorStability[c.armor ? c.armor.type : 'none'] || 0) + (C.rank(c, 'iron_stance') ? M.ironStanceBonus : 0);
  }

  // Chance that an opposed d10 roll wins by at least `margin`.
  function opposedOdds(aBonus, bBonus, margin) {
    const die = CONFIG.maneuver.die;
    let wins = 0;
    for (let a = 1; a <= die; a++) for (let b = 1; b <= die; b++) if (a + aBonus - (b + bBonus) >= margin) wins++;
    return wins / (die * die);
  }

  function knockdownOdds(atk, tgt, featBonus, margin) {
    return opposedOdds(Math.floor(C.attr(atk, 'STR') / 2) + C.skill(atk, 'athletics') + featBonus, stability(tgt), margin);
  }

  function shoveOdds(a, t) {
    const w = C.wieldedWeapon(a);
    const aB = Math.floor(C.attr(a, 'STR') / 2) + C.skill(a, 'athletics') + (w && WEAPONS[w.type].hands === 2 ? CONFIG.shove.twoHandBonus : 0);
    return opposedOdds(aB, stability(t), 1);
  }

  async function knockdownCheck(roller, atk, tgt, featBonus, label) {
    const aB = Math.floor(C.attr(atk, 'STR') / 2) + C.skill(atk, 'athletics') + featBonus;
    return opposed(roller, atk, aB, label, tgt, stability(tgt), 'Keep footing');
  }

  // ---- Grappling ladder -----------------------------------------------------
  // One link on each fighter (Character.grapple): { partner, level: clinch | hold | pin, role: mutual | holder | held }.
  // Only setGrapple writes it, to both at once, so the two sides always agree.
  const linkOf = (c) => C.grapple(c);

  // Set the grapple between a and b. level: null (free), 'clinch', 'hold' or 'pin'; for a hold
  // or pin, a is the holder.
  function setGrapple(chars, a, b, level) {
    for (const c of [a, b]) {
      const L = linkOf(c);
      if (L && ![a.id, b.id].includes(L.partner)) clearGrapple(chars, c);
    }
    a.status.grapple = level ? { partner: b.id, level, role: level === 'clinch' ? 'mutual' : 'holder' } : null;
    b.status.grapple = level ? { partner: a.id, level, role: level === 'clinch' ? 'mutual' : 'held' } : null;
  }

  function clearGrapple(chars, c) {
    const L = linkOf(c);
    const p = L && chars[L.partner];
    if (p && linkOf(p) && linkOf(p).partner === c.id) p.status.grapple = null;
    c.status.grapple = null;
  }
  const releaseGrapples = clearGrapple;

  // d10 + this for clinching, grappling, pinning and throwing.
  function grappleScore(c) {
    // grip: a giant's hand closes around a man (monster trait).
    return Math.floor(C.attr(c, 'STR') / 2) + G.Effects.sum(c, 'grip') + C.skill(c, 'athletics');
  }

  // d10 + this for breaking a clinch, hold or pin.
  function breakScore(c) {
    return Math.floor(Math.max(C.attr(c, 'STR'), C.combatAttr(c, 'DEX')) / 2) + (C.rank(c, 'escape_artist') ? CONFIG.maneuver.escapeArtistBonus : 0) + slippery(c);
  }

  // Monster trait: slick-skinned creatures (bogfolk) are hard to get a grip on.
  function slippery(c) {
    return G.Effects.sum(c, 'slippery');
  }

  // Allies next to the target add to the attacker's grapple rolls.
  function dogpileBonus(enc, chars, a, t) {
    const D = CONFIG.grappling.dogpile;
    const allies = enc.ids.filter((o) => o !== a.id && o !== t.id && chars[o].side === a.side && C.isActive(chars[o]) && dist(enc.pos[o], enc.pos[t.id]) <= 1).length;
    return allies * (C.rank(a, 'dogpile') ? D.withFeat : D.perAlly);
  }

  // Armor is easy to grab (option 4).
  function handles(t) {
    return (CONFIG.grappling.handles || {})[C.armorInfo(t).type] || 0;
  }

  // Footing against throws: armor weight and Iron Stance (the same as against trips).
  function footing(t) {
    const M = CONFIG.maneuver;
    return (M.armorStability[t.armor ? t.armor.type : 'none'] || 0) + (C.rank(t, 'iron_stance') ? M.ironStanceBonus : 0);
  }

  // Resolve one rung of the ladder. Preconditions are rechecked: the grapple may have changed
  // earlier in the pass.
  async function resolveGrapple(enc, chars, d, roller) {
    const a = chars[d.actor];
    const t = chars[d.target];
    const G2 = CONFIG.grappling;
    const big = G2.bigMargin;
    const L = linkOf(a);
    const withT = L && L.partner === t.id;
    const fizzle = (why) => log(enc, `${a.name}'s ${ACTIONS[d.type].name.toLowerCase()} fizzles — ${why}.`, 'fizzle');
    const show = (o) => `(${o.a} vs ${o.b})`;
    if (d.type === 'clinch') {
      if (L || linkOf(t)) return fizzle('someone is already tangled up');
      const o = await opposed(roller, a, grappleScore(a) + dogpileBonus(enc, chars, a, t), 'Clinch', t, grappleScore(t) + slippery(t), 'Keep clear');
      if (o.margin >= big) { setGrapple(chars, a, t, 'hold'); loseWindUp(enc, t, 'grappled'); return log(enc, `${a.name} closes and seizes ${t.name} in a hold ${show(o)}.`, 'hit'); }
      if (o.margin > 0) { setGrapple(chars, a, t, 'clinch'); loseWindUp(enc, t, 'clinched'); loseWindUp(enc, a, null); return log(enc, `${a.name} clinches with ${t.name} ${show(o)}.`, 'hit'); }
      return log(enc, `${t.name} keeps ${a.name} off ${show(o)}.`, 'fail');
    }
    if (!withT) return fizzle(`not grappling ${t.name}`);
    if (d.type === 'grapple') {
      if (L.level !== 'clinch') return fizzle('not in a clinch');
      const o = await opposed(roller, a, grappleScore(a) + handles(t) + dogpileBonus(enc, chars, a, t), 'Grapple', t, grappleScore(t) + slippery(t), 'Resist');
      if (o.margin >= big) { setGrapple(chars, a, t, 'pin'); return log(enc, `${a.name} drives ${t.name} down into a pin ${show(o)}.`, 'hit'); }
      if (o.margin > 0) { setGrapple(chars, a, t, 'hold'); return log(enc, `${a.name} takes hold of ${t.name} ${show(o)}.`, 'hit'); }
      if (o.margin <= -big) { setGrapple(chars, t, a, 'hold'); loseWindUp(enc, a, 'grappled'); return log(enc, `${t.name} reverses and holds ${a.name} ${show(o)}.`, 'hit'); }
      return log(enc, `${a.name} can't get a hold on ${t.name} ${show(o)}.`, 'fail');
    }
    if (d.type === 'pin') {
      if (L.role !== 'holder' || L.level !== 'hold') return fizzle('not holding them');
      const o = await opposed(roller, a, grappleScore(a) + handles(t) + (C.rank(a, 'pin') ? G2.pinBonus : 0) + dogpileBonus(enc, chars, a, t), 'Pin', t, breakScore(t), 'Resist');
      if (o.margin > 0) { setGrapple(chars, a, t, 'pin'); log(enc, `${a.name} pins ${t.name} ${show(o)}.`, 'hit'); return jointLock(enc, a, t); }
      if (o.margin <= -big) { setGrapple(chars, a, t, 'clinch'); return log(enc, `${t.name} twists out of the hold into a clinch ${show(o)}.`, 'defend'); }
      return log(enc, `${a.name} can't pin ${t.name} ${show(o)}.`, 'fail');
    }
    if (d.type === 'throw') {
      if (!(L.role === 'holder' || (L.level === 'clinch' && C.rank(a, 'takedown')))) return fizzle('no grip to throw from');
      const o = await opposed(roller, a, grappleScore(a), 'Throw', t, grappleScore(t) + footing(t), 'Keep footing');
      if (o.margin <= 0) return log(enc, `${t.name} keeps their feet against ${a.name}'s throw ${show(o)}.`, 'fail');
      setGrapple(chars, a, t, null);
      // Land a square beyond, away from the thrower, if there is room.
      const from = enc.pos[a.id], at = enc.pos[t.id];
      const nx = at.x + Math.sign(at.x - from.x), ny = at.y + Math.sign(at.y - from.y);
      const free = (G.Terrain ? G.Terrain.passable(enc, nx, ny) : nx >= 0 && ny >= 0 && nx < enc.grid.w && ny < enc.grid.h) && !enc.ids.some((id) => id !== t.id && C.isActive(chars[id]) && enc.pos[id].x === nx && enc.pos[id].y === ny);
      if (free) { enc.pos[t.id] = { x: nx, y: ny }; if (G.Terrain && enc.tiles) await G.Terrain.enter(enc, chars, t, nx, ny, roller, (x) => log(enc, x, 'hit')); }
      knockDown(enc, t);
      log(enc, `${a.name} throws ${t.name} to the ground ${show(o)}.`, 'hit');
      if (o.margin >= big) {
        const slam = { kind: 'strike', motion: 'swing', damage: [0, 0, Math.max(0, G2.throwDamage + C.strBonus(a))], label: 'Throw' };
        const r = await applyHit(enc, chars, a, t, slam, roller, {});
        log(enc, `The fall jars ${t.name}: ${r.text}`, 'hit');
      }
      return;
    }
    if (d.type === 'break') {
      // Iron Grip: a holder who pays a step's AP is not broken out of a hold or a pin.
      if (L.level !== 'clinch' && C.rank(t, 'iron_grip') && C.isActive(t) && apLeft(enc, t.id) >= C.minAP()) {
        enc.ap[t.id] -= C.minAP();
        log(enc, `${t.name}'s grip does not give: ${a.name} stays held.`, 'defend');
        return jointLock(enc, t, a);
      }
      const holderBonus = L.level === 'pin' && C.rank(t, 'pin') ? G2.pinBonus : 0;
      const o = await opposed(roller, a, breakScore(a), 'Break free', t, grappleScore(t) + holderBonus, 'Hold on');
      if (o.margin <= 0) { log(enc, `${a.name} can't break ${t.name}'s grip ${show(o)}.`, 'fail'); return L.level !== 'clinch' ? jointLock(enc, t, a) : undefined; }
      if (L.level === 'clinch') { setGrapple(chars, a, t, null); return log(enc, `${a.name} breaks the clinch with ${t.name} ${show(o)}.`, 'defend'); }
      if (L.level === 'hold') {
        if (o.margin >= big) { setGrapple(chars, a, t, 'hold'); loseWindUp(enc, t, 'grappled'); return log(enc, `${a.name} reverses ${t.name}'s hold ${show(o)}.`, 'defend'); }
        setGrapple(chars, a, t, 'clinch');
        return log(enc, `${a.name} works out of the hold into a clinch ${show(o)}.`, 'defend');
      }
      // Pinned.
      if (o.margin >= big) { setGrapple(chars, a, t, 'clinch'); return log(enc, `${a.name} bursts out of the pin into a clinch ${show(o)}.`, 'defend'); }
      setGrapple(chars, t, a, 'hold');
      return log(enc, `${a.name} gets out from under the pin; still held ${show(o)}.`, 'defend');
    }
  }

  // Joint Lock: a hold or pin that holds wrenches a joint (CONFIG.grappling.jointLock: the attribute and points).
  function jointLock(enc, holder, held) {
    if (!C.rank(holder, 'joint_lock') || !C.isActive(holder)) return;
    const J = CONFIG.grappling.jointLock || { attr: 'DEX', points: 1 };
    C.damageAttr(held, J.attr, J.points);
    log(enc, `${holder.name} wrenches ${held.name}'s joint (−${J.points} ${J.attr}).`, 'hit');
  }

  // Grapples come apart when the fighters are no longer adjacent or one goes down; a clinch
  // also breaks when either is knocked prone.
  function settleGrapples(enc, chars) {
    for (const id of enc.ids) {
      const c = chars[id];
      const L = linkOf(c);
      if (!L) continue;
      const p = chars[L.partner];
      if (!p || !C.isActive(c) || !C.isActive(p) || dist(enc.pos[id], enc.pos[p.id]) > 1 || (L.level === 'clinch' && (c.status.prone || p.status.prone))) clearGrapple(chars, c);
    }
  }

  // ---- Resolution --------------------------------------------------------
  // Resolve everything that lands this pass, then start the next pass or end the round.
  // Pays an action's stamina: true, or 'spent' when the fighter couldn't pay and took it spent (R2,
  // CONFIG.stamina.spent: stamina down to 1 at most, the action weaker), or false when it fails.
  function payStamina(enc, c, cost) {
    if (!cost || C.tireless(c)) return true;
    if (isSpent(c, cost)) {
      log(enc, `${c.name} acts spent (needs ${cost} stamina, has ${c.stamina}).`, 'fail');
      c.stamina = Math.min(c.stamina, 1);
      C.updateCondition(c);
      return 'spent';
    }
    const ok = canPay(c, cost);
    if (!ok) {
      log(enc, `${c.name} is too exhausted (needs ${cost} stamina, has ${c.stamina}); the action fails.`, 'fizzle');
      return false;
    }
    c.stamina -= cost;
    C.updateCondition(c);
    return true;
  }

  // The roll penalty a defence taken spent carries (R2).
  function spentDefense(paid) {
    return paid === 'spent' ? CONFIG.stamina.spent.defense || 0 : 0;
  }

  function canPay(c, cost) {
    if (!cost || C.tireless(c)) return true;
    return CONFIG.exertionCanKnockOut ? c.stamina >= cost : c.stamina > cost;
  }

  // An action this fighter can't pay for but may take spent (R2): any living fighter with stamina left.
  function isSpent(c, cost) {
    return !!(CONFIG.stamina && CONFIG.stamina.spent) && !canPay(c, cost) && c.stamina > 0;
  }

  // R8 (CONFIG.sweep): can this blow sweep on? A weapon's swung edge or head, not already a sweep.
  function sweeps(o) {
    const S = CONFIG.sweep;
    return !!(S && o && !o.sweep && !o.unarmed && !o.natural && !o.spell && !o.ranged && o.weaponId && (S.motions || []).includes(o.motion) && (o.face === 'edge' || o.face === 'head'));
  }
  // The foe a sweep would carry into from `t`: within the blow's reach of the attacker and a square from `t`, standing;
  // the nearest the attacker first, then the one with least stamina. pos: where everyone stood as the blow was made.
  function sweepTarget(enc, chars, a, t, o, pos) {
    pos = pos || enc.pos;
    if (!sweeps(o) || !pos[a.id] || !pos[t.id]) return null;
    let best = null;
    for (const id of enc.ids) {
      const b = chars[id];
      if (!b || id === t.id || id === a.id || b.side === a.side || !C.isActive(b) || !pos[id]) continue;
      const d = dist(pos[a.id], pos[id]);
      if (d > (o.maxRange || 1) || d < (o.minRange || 1) || dist(pos[t.id], pos[id]) > 1) continue;
      if (!best || d < best.d || (d === best.d && b.stamina < best.b.stamina)) best = { b, d };
    }
    return best ? best.b : null;
  }
  // The share of a blow's force a sweep carries (heavy for two-handed and power blows).
  function sweepForce(o) {
    const S = CONFIG.sweep;
    return S ? (o.motion === 'twoHanded' || o.motion === 'power' ? S.heavy : S.force) : 0;
  }
  async function sweepOn(enc, chars, a, t, d, io, pos, how) {
    if (!sweeps(d.option) || !C.isActive(a)) return;
    const b = sweepTarget(enc, chars, a, t, d.option, pos);
    if (!b) return;
    const f = sweepForce(d.option);
    const o = Object.assign({}, d.option, { sweep: true, windUp: false, label: `${d.option.label} (sweep)`, damage: d.option.damage.map((x) => Math.floor(x * f)), punch: (d.option.punch || 0) * f });
    if (!o.damage.some((x) => x > 0)) return;
    log(enc, `${a.name}'s ${d.option.label} ${how} ${t.name} into ${b.name}.`, 'hit');
    await resolveAction(enc, chars, { actor: a.id, target: b.id, type: 'strike', option: o, stamina: 0, ap: 0 }, io, pos);
  }

  // Resolve one action now. pos: where everyone stands as it is made (an opportunity strike sees
  // the mover still in the square they are leaving).
  async function resolveAction(enc, chars, d, io, pos) {
    const roller = io && io.roller;
    const posAtStart = pos || enc.pos;
    const a = chars[d.actor];
    const t = d.target ? chars[d.target] : null;

    if (ATTACK_TYPES.includes(d.type)) {
      if (!t) return;
      if (!d.targetWasDown && !C.isActive(t)) {
        log(enc, `${a.name}'s ${d.type === 'strike' ? d.option.label : d.type} fizzles — ${t.name} is already down.`, 'fizzle');
        if (d.type === 'strike') await sweepOn(enc, chars, a, t, d, io, posAtStart, 'passes over');
        return;
      }
      let band = { minRange: 1, maxRange: CONFIG.range.maneuverMax };
      if (d.type === 'strike') band = d.option;
      if (d.type === 'shove') band = { minRange: 1, maxRange: shoveReach(a) };
      if (d.type === 'trip' && hookWeapon(a)) band = { minRange: 1, maxRange: Math.max(CONFIG.range.maneuverMax, Items.longestReach(WEAPONS[C.wieldedWeapon(a).type])) };
      const distance = dist(posAtStart[d.actor], posAtStart[d.target]);
      const label = d.type === 'strike' ? d.option.label : d.type;
      if (distance > (band.maxRange != null ? band.maxRange : band.reach)) {
        log(enc, `${a.name}'s ${label} fizzles — ${t.name} is out of reach.`, 'fizzle');
        return;
      }
      if (distance < (band.minRange || 1)) {
        log(enc, `${a.name}'s ${label} fizzles — ${t.name} is too close.`, 'fizzle');
        return;
      }
      const inHand = d.option && (d.option.offhand ? (C.offhandWeapon(a) || {}).id === d.option.weaponId : a.wield === d.option.weaponId);
      if (d.type === 'strike' && d.option.weaponId && !d.option.natural && (!inHand || a.status.dropped.includes(d.option.weaponId))) {
        log(enc, `${a.name} no longer holds that weapon; the strike fizzles.`, 'fizzle');
        return;
      }
      if (d.type === 'strike' && d.option.windUp) {
        const w = a.status.windUp;
        if (!w || w.key !== C.optionKey(d.option)) {
          log(enc, `${a.name} lost the wind-up; the ${label} fizzles.`, 'fizzle');
          return;
        }
        a.status.windUp = null;
      }
      if (d.type === 'strike' && d.option.ranged && d.option.weaponId && !d.option.natural) {
        if (C.ammoLeft(a, d.option) <= 0) {
          log(enc, `${a.name} is out of ${d.option.arrowHead ? d.option.arrowHead + 's' : 'arrows'}.`, 'fizzle');
          return;
        }
        a.inventory[d.option.ammo || 'arrows'] -= 1;
      }
      const paid = payStamina(enc, a, d.stamina);
      if (!paid) return;
      if (paid === 'spent' && d.option) d.option = Object.assign({}, d.option, { spent: true });
      // Walls in the way: solid ones stop everything, others stop blades or missiles; swirling
      // winds carry missiles astray.
      // A shrouded target (Bless + Shadow) is hard to pick out at range.
      if (d.type === 'strike' && distance >= 2) {
        const missile = d.option.ranged || !!d.option.spell;
        const lc = G.Terrain && enc.tiles ? G.Terrain.lineCheck(enc, posAtStart[d.actor], posAtStart[d.target], missile ? 'missile' : 'melee') : { blocked: false, miss: 0 };
        if (lc.blocked) return log(enc, `${a.name}'s ${label} is stopped by the ${lc.by.toLowerCase()}.`, 'fizzle');
        const shroud = G.Conditions ? G.Conditions.list(t).reduce((m, x) => Math.max(m, (CONFIG.conditions[x.key] || {}).shroud || 0), 0) : 0;
        if (shroud && missile) lc.miss = 1 - (1 - lc.miss) * (1 - shroud);
        if (lc.miss > 0 && missile) {
          const need = Math.round(lc.miss * 10);
          const r = await rollDie(roller, a.id, 10, `${a.name}: through ${shroud ? 'the shroud' : 'the winds'}`, `d10: ${need} or less goes astray`);
          if (r <= need) return log(enc, `${a.name}'s ${label} goes astray.`, 'fizzle');
        }
      }
      // Grappling is a directly opposed roll; guards never meet it.
      if (GRAPPLE_STEPS.includes(d.type)) return resolveGrapple(enc, chars, d, roller);
      if (d.type === 'strike' && d.option.spell) {
        if (!(await castSpell(enc, a, d.option, roller))) return;
      }

      // The target may react: spend AP from their pool to block, parry or dodge (they see it coming).
      const name = d.type === 'strike' ? d.option.label : ACTIONS[d.type].name;
      // Displacement (monster trait): the target isn't quite where it appears to be.
      const disp = d.type === 'strike' && t.traits && t.traits.displacement && !C.rank(a, 'truesight');
      if (disp) {
        const chance = d.option.ranged || d.option.spell ? disp.ranged : disp.melee;
        const r = await rollDie(roller, a.id, 10, `${a.name}: Find the real ${t.name}`, `d10: ${Math.round(chance * 10)} or less strikes only an illusion`);
        if (r <= Math.round(chance * 10)) return log(enc, `${a.name}'s ${name} passes through an illusion of ${t.name}.`, 'defend');
      }
      let failedDodge = false, beatThrough = 0, defPaid = false;
      // Human Shield: someone holding a foe turns the held body into the blow (a block's AP), if they can pay.
      const shieldBody = d.type === 'strike' && C.rank(t, 'human_shield') && C.holding(t) !== a.id ? chars[C.holding(t)] : null;
      if (shieldBody && C.isActive(shieldBody) && linkOf(t).level !== 'clinch' && C.actionCost(t, 'block').ap <= apLeft(enc, t.id)) {
        enc.ap[t.id] -= C.actionCost(t, 'block').ap;
        log(enc, `${t.name} hauls ${shieldBody.name} into the way of ${a.name}'s ${name}.`, 'defend');
        const r = await applyHit(enc, chars, a, shieldBody, d.option, roller, { distance: dist(posAtStart[a.id], posAtStart[t.id]) });
        log(enc, `${shieldBody.name} takes it: ${r.text}`, 'hit');
        C.updateCondition(shieldBody);
        return;
      }
      const def = await askDefense(enc, chars, t, a, d, io);
      // Nobody defends themselves: a shield beside them may.
      const cover = !def && C.isActive(t) ? await askCover(enc, chars, t, a, d, io) : null;
      const coverPaid = cover ? payStamina(enc, cover.bearer, cover.o.stamina) : false;
      if (coverPaid) {
        const b = cover.bearer;
        const chk = await defenseCheck(enc, chars, b, 'block', d, roller, -cover.o.penalty - spentDefense(coverPaid));
        if (chk.ok) {
          log(enc, `${b.name} gets a shield in front of ${t.name} (${chk.total} vs ${chk.tn}).`, 'defend');
          await shieldAbsorb(enc, chars, a, b, d, roller);
          absorbImpact(enc, b, 'block', d);
          const theirs = weaponItem(a, d.option);
          if (b.shield) wearWeapon(enc, a, theirs, blowForce(d.option), 'blocked', b.shield.material);
          rebound(enc, a, d, 'block', b);
          return;
        }
        log(enc, `${b.name} reaches to cover ${t.name}, too late (${chk.total} vs ${chk.tn}).`, 'fail');
      }
      if (def) {
        // Chosen blind (Feint): a defence that can't meet this blow is spent for nothing.
        const wrong = defenseUnavailable(t, def.type, d, chars, enc);
        if (wrong) log(enc, `${t.name}'s ${ACTIONS[def.type].name.toLowerCase()} is wasted (${wrong.toLowerCase()}).`, 'fail');
        else if ((defPaid = payStamina(enc, t, def.stamina))) {
          const chk = await defenseCheck(enc, chars, t, def.type, d, roller, -spentDefense(defPaid));
          if (chk.ok) {
            if (def.type === 'block') {
              await shieldAbsorb(enc, chars, a, t, d, roller);
            } else {
              const verb = { parry: 'parries', offParry: 'catches on the parrying dagger', dodge: 'dodges' }[def.type];
              log(enc, `${t.name} ${verb} ${a.name}'s ${name} (${chk.total} vs ${chk.tn}).`, 'defend');
              if (def.type === 'dodge' && C.rank(t, 'counter_step')) t.status.counterStep = enc.round;
            }
            absorbImpact(enc, t, def.type, d);
            const parried = def.type === 'parry' || def.type === 'offParry';
            // A heavy swing the parrying weapon can't meet in full beats through it, weakened (parryCarry).
            const carry = parried && d.type === 'strike' ? parryCarryShare(t, def.type, d.option) : 0;
            if (d.type === 'strike') {
              const force = blowForce(d.option);
              const theirs = weaponItem(a, d.option);
              if (parried) {
                const mine = parryingWeapon(t, def.type);
                wearWeapon(enc, a, theirs, force, 'parried', Items.weaponMaterial(mine));
                wearWeapon(enc, t, mine, force, 'parry', theirs ? Items.weaponMaterial(theirs) : naturalMaterial(d.option));
              } else if (def.type === 'block' && t.shield) wearWeapon(enc, a, theirs, force, 'blocked', t.shield.material);
            }
            const through = carry > 0 && d.option.damage.some((x) => Math.floor(x * carry) > 0);
            if (through) {
              beatThrough = carry;
              log(enc, `${a.name}'s ${name} beats through the parry (${Math.round(carry * 100)}% of its force carries on).`, 'hit');
            }
            if (!through && def.type !== 'dodge') rebound(enc, a, d, def.type, t);
            if (!through && parried && C.isActive(t) && C.isActive(a)) await riposte(enc, chars, t, a, def.type, io, posAtStart);
            if (!through && parried && C.rank(t, 'bind') && C.isActive(t) && C.wieldedWeapon(a) && payStamina(enc, t, C.actionCost(t, 'disarm').stamina)) {
              log(enc, `${t.name} binds ${a.name}'s blade.`, 'defend');
              await resolveManeuver(enc, chars, { actor: t.id, target: a.id, type: 'disarm' }, roller);
            }
            if (!through) {
              if (def.type === 'dodge' && d.type === 'strike') await sweepOn(enc, chars, a, t, d, io, posAtStart, 'carries past');
              return;
            }
          } else {
            log(enc, `${t.name}'s ${ACTIONS[def.type].name.toLowerCase()} fails (${chk.total} vs ${chk.tn}).`, 'fail');
            if (def.type === 'dodge') failedDodge = true;
          }
        }
      }

      if (d.type === 'strike' && d.option.rust) return rustTouch(enc, a, t, d.option.rust);
      if (d.type === 'strike' && d.option.web) {
        const W = CONFIG.web;
        t.status.webbed = Math.min(W.maxLayers, (t.status.webbed || 0) + d.option.web);
        return log(enc, `${a.name}'s web sticks to ${t.name} (${t.status.webbed} layer${t.status.webbed > 1 ? 's' : ''}: every action costs more).`, 'hit');
      }
      if (d.type === 'strike') {
        const half = failedDodge && C.rank(t, 'roll_with_it');
        const packN = G.Effects.sum(a, 'pack');
        const pack = packN
          ? Math.min(packN, enc.ids.filter((o) => o !== a.id && o !== t.id && chars[o].side === a.side && C.isActive(chars[o]) && dist(posAtStart[o], posAtStart[t.id]) <= 1).length)
          : 0;
        // A ward meets spells and missiles first.
        let hitOpt = d.option;
        if (G.Magic && G.Conditions && G.Conditions.has(t, 'warded') && (d.option.spell || d.option.ranged)) {
          const w = G.Magic.wardAgainst(enc, t, d.option, !!d.option.ranged);
          if (w.deflect) {
            const r0 = await rollDie(roller, t.id, 10, `${t.name}: ward of wind`, 'd10: 5 or less turns it aside');
            if (r0 <= 5) return log(enc, `${t.name}'s ward of wind turns ${a.name}'s ${name} aside.`, 'defend');
          }
          if (w.blocked) return;
          hitOpt = Object.assign({}, d.option, { damage: w.damage || d.option.damage, spell: d.option.spell ? Object.assign({}, d.option.spell, { magnitude: w.magnitude }) : undefined });
        }
        // A bane blade (enchantments.yaml strike.slay: [{trait, damage}]) bites harder into what it was made for.
        const blade = weaponItem(a, d.option);
        const fx = blade ? C.weaponStrike(blade) : {};
        // Worn bane gear (gauntlets that slay dragons: effects.slay) counts for any blow but a spell or an arrow.
        const gearSlay = d.option.spell || d.option.ranged ? [] : C.gearSources(a).flatMap((x) => x.effects.slay || []);
        // An oil worked into the blade (items.yaml kind oil: coat {slay, hits}) is used up a landed blow at a time.
        const coat = blade && blade.coat && blade.coat.hits > 0 ? blade.coat : null;
        const coatSlay = coat ? coat.slay.filter((x) => G.Effects.has(t, x.trait)).reduce((n, x) => n + (x.damage || 0), 0) : 0;
        const slay = coatSlay + (fx.slay || []).concat(gearSlay).filter((x) => G.Effects.has(t, x.trait)).reduce((n, x) => n + (x.damage || 0), 0);
        if (slay) { hitOpt = Object.assign({}, hitOpt, { damage: hitOpt.damage.slice() }); hitOpt.damage[C.mainIndex(hitOpt.damage)] += slay; }
        if (coat && --coat.hits <= 0) delete blade.coat;
        // What beat through a parry lands with that share of its force (and of its punch into armor).
        if (beatThrough) hitOpt = Object.assign({}, hitOpt, { damage: hitOpt.damage.map((x) => Math.floor(x * beatThrough)), punch: (hitOpt.punch || 0) * beatThrough });
        const pre = { stamina: t.stamina, dmg: C.totalDamage(t) };
        const r = await applyHit(enc, chars, a, t, hitOpt, roller, { half, distance, pack });
        const note = isCramped(a, d.option, distance)
          ? (CONFIG.range.closeRule === 'blunt' ? ' (cramped: blunt, half force)' : ' (cramped: half damage)') : d.option.ranged && d.option.longRange && distance > d.option.longRange ? ' (long range)' : '';
        log(enc, `${a.name}'s ${name} hits ${t.name}${half ? ' (Roll With It: half)' : ''}${pack ? ` (pack +${pack})` : ''}${coatSlay ? ` (${coat.name.toLowerCase()} +${coatSlay})` : ''}${note}: ${r.text}`, 'hit');
        if (coat && !blade.coat) log(enc, `The ${coat.name.toLowerCase()} on ${a.name}'s ${Items.itemName(blade)} is spent.`, 'info');
        // Kindled (Bless + Fire): a blade wreathed in flame sets what it strikes burning.
        if (G.Effects.has(a, 'kindled') && !d.option.ranged && !d.option.spell && C.isActive(t) && !C.tireless(t)) {
          G.Conditions.add(t, 'burning', { rounds: 2, mag: 1, src: a.id });
          log(enc, `${t.name} catches fire.`, 'hit');
        }
        if (d.option.spell && G.Magic && G.Magic.afterHit) await G.Magic.afterHit(enc, chars, a, t, d.option, r.hit, roller);
        if (blade && Object.keys(fx).length) await strikeEffects(enc, chars, a, t, blade, fx, roller, t.stamina < pre.stamina || C.totalDamage(t) > pre.dmg, posAtStart);
        // A natural weapon that saps (weapons.yaml trait.sap: the Avatar's claws), as an enchanted blade's strike does.
        else if (!blade && d.option.sap) await strikeEffects(enc, chars, a, t, { name: d.option.label || 'The blow' }, { sap: d.option.sap }, roller, t.stamina < pre.stamina || C.totalDamage(t) > pre.dmg, posAtStart);
        // Gear that bites back (effects.retaliate): whoever lands a melee blow on the wearer takes an element's blow.
        if (!d.option.ranged && !d.option.spell && G.Magic && C.isActive(a)) for (const x of G.Effects.list(t, 'retaliate')) await G.Magic.elementBlow(enc, chars, t, a, x.noun, x.mag, roller, x.name || `${Items.itemName(x.from) || x.from.name}`, { from: posAtStart[t.id] });
        // A conjured elemental's blows carry its element.
        if (a.traits && a.traits.element && !d.option.spell && G.Magic && C.isActive(t)) await G.Magic.onHit(enc, chars, a, t, a.traits.element, roller, { from: posAtStart[a.id] });
        // Springy armor (chitin): the blow rebounds and jars the attacker.
        const recoil = t.armor && t.armor.durability > 0 && (G.DATA.ARMOR[t.armor.type] || {}).recoil;
        if (recoil && !d.option.ranged && !d.option.spell && !C.tireless(a)) {
          const jar = Math.min(a.stamina - 1, recoil * (CONFIG.staminaScale || 1));
          if (jar > 0) { a.stamina -= jar; log(enc, `The springy ${t.armor.type === 'chitin' ? 'chitin' : 'hide'} jars ${a.name}'s arms (−${jar} stamina).`, 'fail'); }
        }
        if (!C.isActive(t)) loseWindUp(enc, t, null);
        if (!C.isActive(t)) await sweepOn(enc, chars, a, t, d, io, posAtStart, 'carries through');
        if ((d.option.unarmed === 'kick' || d.option.unarmed === 'shieldBash' || d.option.knockdown) && C.isActive(t) && !t.status.prone) {
          const kd = d.option.knockdown;
          const k = await knockdownCheck(roller, a, t, (C.rank(a, 'trip') ? CONFIG.maneuver.tripFeatBonus : 0) + (kd ? kd.bonus : 0), 'Knockdown');
          if (k.margin >= (kd ? kd.margin : CONFIG.maneuver.kickKnockdownMargin)) {
            knockDown(enc, t);
            log(enc, `${t.name} is knocked prone (${k.a} vs ${k.b}).`, 'hit');
          }
        }
        return;
      }
      await resolveManeuver(enc, chars, d, roller);
      return;
    }

    if (!payStamina(enc, a, d.stamina)) return;
    switch (d.type) {
      case 'standUp':
        a.status.prone = false;
        log(enc, `${a.name} stands up.`);
        break;
      case 'windUp':
        const armed = !d.option.weaponId || d.option.natural || (C.wieldedWeapon(a) && C.wieldedWeapon(a).id === d.option.weaponId);
        if (a.status.prone || isGrappled(a) || !armed) {
          log(enc, `${a.name} can't wind up now.`, 'fizzle');
          break;
        }
        a.status.windUp = { key: C.optionKey(d.option), label: d.option.label, round: enc.round };
        log(enc, d.option.motion === 'shoot' ? `${a.name} draws for a ${d.option.label} — exposed until it is loosed.` : `${a.name} winds up a ${d.option.label} — exposed until it lands.`);
        break;
      case 'readyPrimary':
      case 'drawSidearm':
      case 'pickUp': {
        const want = d.type === 'pickUp' ? pickUpTarget(a) : d.type === 'drawSidearm' ? a.sidearm : primaryWeaponId(a);
        if (!want || (d.type !== 'pickUp' && a.status.dropped.includes(want))) { log(enc, `${a.name} has nothing to take up.`, 'fizzle'); break; }
        const fell = takeInHand(a, want);
        const w = a.weapons.find((x) => x.id === want);
        log(enc, `${a.name} ${fell ? `drops ${Items.itemName(fell)} and ` : ''}${d.type === 'pickUp' ? 'picks up' : d.type === 'drawSidearm' ? 'draws' : 'readies'} ${Items.itemName(w)}.`);
        break;
      }
      case 'dropWeapon': {
        const w = dropHeld(a);
        if (w) log(enc, `${a.name} drops ${Items.itemName(w)}.`);
        break;
      }
      case 'cast':
        if (G.Magic) await G.Magic.resolveCast(enc, chars, d, roller, posAtStart);
        break;
      case 'bait':
      case 'readIntent': {
        if (!t || !C.isActive(t)) break;
        const R = CONFIG.social;
        if (dist(posAtStart[a.id], posAtStart[t.id]) > R[d.type].range) { log(enc, `${a.name}'s ${ACTIONS[d.type].name.toLowerCase()} fizzles — ${t.name} is too far.`, 'fizzle'); break; }
        if (d.type === 'bait') {
          const o = await opposed(roller, a, Math.floor(C.attr(a, 'CHA') / 2) + feintScore(a), 'Bait', t, Math.floor(C.attr(t, 'WIS') / 2) + readScore(t), 'See through it');
          if (o.margin > 0) {
            // The bait leaves them off balance: they defend worse for the round.
            if (G.Conditions) G.Conditions.add(t, 'baited', { rounds: 1, src: a.id });
            if (G.Conditions && C.rank(a, 'dirty_trick')) { G.Conditions.add(t, 'exposed', { rounds: 1, src: a.id }); log(enc, `${t.name} is left wide open.`, 'hit'); }
            log(enc, `${a.name} baits ${t.name}, who commits too early and is off balance (${o.a} vs ${o.b}).`, 'hit');
          } else log(enc, `${t.name} sees through ${a.name}'s bait (${o.a} vs ${o.b}).`, 'fail');
        } else {
          // The reader rolls against a number they can't see: a true read, nothing, or a
          // confident misread that looks just like a true one.
          const RI = R.readIntent;
          const bonus = Math.floor(C.attr(a, 'WIS') / 2) + readScore(a);
          const tn = RI.tn + Math.floor(C.attr(t, 'CHA') / 2) + feintScore(t);
          const r = await rollDie(roller, a.id, 10, `${a.name}: Read intent`, `d10 + ${bonus} (WIS) against ${t.name}'s guarded face`);
          const margin = r + bonus - tn;
          if (margin < 0 && margin > -RI.misreadBy) {
            log(enc, `${a.name} studies ${t.name} but can't read them.`, 'fail');
            break;
          }
          const truth = margin >= 0;
          const note = intentNote(enc, chars, t, truth, r);
          if (G.Conditions) G.Conditions.add(a, 'reading', { rounds: RI.rounds || 1, vs: t.id, src: a.id, truth, note });
          log(enc, `${a.name} reads ${t.name}: ${note}`, 'defend');
        }
        break;
      }
      case 'tearFree': {
        const W = CONFIG.web;
        let bonus = Math.floor(C.attr(a, 'STR') / 2);
        if (!a.status.webbed && G.Conditions && !G.Conditions.canMove(a)) {
          const root = G.Conditions.list(a).find((x) => (CONFIG.conditions[x.key] || {}).noMove);
          bonus = Math.floor(C.attr(a, CONFIG.conditions[root.key].breakAttr || 'STR') / 2);
          const tn = W.tearTN + (root ? root.mag - 1 : 0);
          const r = await rollDie(roller, a.id, 10, `${a.name}: Break free`, `d10 + ${bonus} ≥ ${tn}`);
          if (r + bonus >= tn) { G.Conditions.remove(a, root.key); log(enc, `${a.name} breaks free (${r + bonus}).`, 'defend'); }
          else log(enc, `${a.name} strains against the roots (${r + bonus} vs ${tn}).`, 'fail');
          break;
        }
        const r = await rollDie(roller, a.id, 10, `${a.name}: Tear free`, `d10 + ${bonus} ≥ ${W.tearTN}`);
        if (r + bonus >= W.tearTN) { a.status.webbed = 0; log(enc, `${a.name} tears free of the webs (${r + bonus}).`, 'defend'); }
        else log(enc, `${a.name} strains against the webs (${r + bonus} vs ${W.tearTN}).`, 'fail');
        break;
      }
      case 'release':
        if (C.holding(a) && chars[C.holding(a)]) {
          setGrapple(chars, a, chars[C.holding(a)], null);
          log(enc, `${a.name} lets go.`);
        }
        break;
      case 'vanish':
        if (G.Conditions) { G.Conditions.add(a, 'unseen', { rounds: 2, src: a.id }); log(enc, `${a.name} slips out of sight.`, 'defend'); }
        break;
      case 'feign':
        knockDown(enc, a);
        if (G.Conditions) G.Conditions.add(a, 'feigning', { rounds: 99, src: a.id });
        log(enc, `${a.name} crumples and lies still.`, 'death');
        break;
      case 'rally': {
        enc.rallied = enc.rallied || {};
        if (CONFIG.stamina && CONFIG.stamina.regen) {
          // R1 gives everyone their breath back, struck or not; Rally gives it now: a round's regeneration at once to
          // each of my side within 3 squares, and the collapsed among them come round.
          const heard = enc.ids.filter((o) => chars[o].side === a.side && !chars[o].status.dead && !C.tireless(chars[o]) && (C.isActive(chars[o]) || C.collapsed(chars[o])) && dist(posAtStart[a.id], enc.pos[o]) <= 3);
          const bits = [];
          for (const o of heard) {
            const f = chars[o];
            const r = Math.max(1, C.roundRegen(f, false));
            const before = f.stamina;
            const woke = C.collapsed(f) && C.comeRound(f, r);
            if (!woke) f.stamina = Math.min(C.maxStamina(f), f.stamina + r);
            enc.rallied[o] = enc.round;
            if (woke) bits.push(`${f.name} comes round`);
            else if (f.stamina > before) bits.push(`${f.name} +${f.stamina - before}`);
          }
          log(enc, `${a.name} rallies ${heard.length > 1 ? 'their side' : 'themself'}${bits.length ? `: ${bits.join(', ')}` : ''}.`, 'defend');
          break;
        }
        const heard = enc.ids.filter((o) => chars[o].side === a.side && C.isActive(chars[o]) && dist(posAtStart[a.id], enc.pos[o]) <= 3);
        for (const o of heard) enc.rallied[o] = enc.round;
        log(enc, `${a.name} rallies ${heard.length > 1 ? 'their side' : 'themself'}: they will get their breath back this round, struck or not.`, 'defend');
        break;
      }
      case 'command':
        if (t && C.isActive(t)) {
          const gift = Math.round(C.baseAP(1));
          enc.ap[t.id] = (enc.ap[t.id] || 0) + gift;
          if (enc.turnDone[t.id] && eligible(enc, chars, t.id)) log(enc, `${t.name} has had their turn; the AP will serve for reactions.`, 'pass');
          log(enc, `${a.name} commands ${t.name}: +${C.fmtAP(gift)} AP.`, 'defend');
        }
        break;
      case 'rouse':
        if (t && t.status.unconscious && !t.status.dead) {
          enc.roused = enc.roused || {};
          enc.roused[t.id] = true;
          t.stamina = Math.max(1, Math.floor(C.maxStamina(t) / 4));
          C.comeRound(t);
          C.updateCondition(t);
          log(enc, `${a.name} hauls ${t.name} to their feet.`, 'defend');
        }
        break;
      case 'demoralize': {
        const targets = C.rank(a, 'dread') ? enc.ids.filter((o) => chars[o].side !== a.side && C.isActive(chars[o]) && dist(posAtStart[a.id], enc.pos[o]) <= 3) : t ? [t.id] : [];
        const bonus = Math.floor(Math.max(C.attr(a, 'STR'), C.attr(a, 'CHA')) / 2) + C.skill(a, 'intimidation');
        for (const o of targets) {
          const f = chars[o];
          const r = await opposed(roller, a, bonus, 'Demoralize', f, Math.floor(C.attr(f, 'WIL') / 2), 'Hold their nerve');
          if (r.margin > 0 && G.Conditions) { G.Conditions.add(f, 'frightened', { rounds: 1, src: a.id }); log(enc, `${f.name} quails before ${a.name} (${r.a} vs ${r.b}).`, 'hit'); }
          else log(enc, `${f.name} holds their nerve against ${a.name} (${r.a} vs ${r.b}).`, 'fail');
        }
        break;
      }
      case 'nameWeakness':
        if (t && G.Conditions) { G.Conditions.add(t, 'named', { rounds: 2, src: a.id }); log(enc, `${a.name} names ${t.name}'s weakness: its hide will not save it now.`, 'hit'); }
        break;
      case 'bandage':
        if (t && a.inventory.bandages > 0) {
          a.inventory.bandages -= 1;
          t.bleeds = t.bleeds.filter((b) => b.poison); // a bandage doesn't draw out venom
          log(enc, `${a.name} bandages ${t === a ? 'themself' : t.name}; the bleeding stops.`, 'defend');
        }
        break;
    }
  }

  // What an enchanted weapon's blow carries (enchantments.yaml `strike`), once it has landed:
  //   onHit {cond, rounds, chance}   a condition, resisted as a spell (Magic.afflict) — stun, roots
  //   element {noun, mag}            an element's blow as well (a burning blade)
  //   sap {attr, n, stamina}         drains an attribute and stamina into the wielder
  //   armorWear n                    eats the target's armor
  //   riled n                        the wielder is Riled: +n to all mitigation until next hurt
  // `landed`: the blow did harm (onHit, sap and armorWear need it; an element burns regardless).
  async function strikeEffects(enc, chars, a, t, blade, fx, roller, landed, pos) {
    const name = Items.itemName(blade);
    if (fx.riled && C.isActive(a) && G.Conditions) {
      G.Conditions.add(a, 'riled', { rounds: 99, mag: fx.riled, src: a.id });
      log(enc, `${name} rouses ${a.name}: riled (+${fx.riled} to all mitigation until hurt).`, 'defend');
    }
    if (fx.element && G.Magic && !t.status.dead) await G.Magic.elementBlow(enc, chars, a, t, fx.element.noun, fx.element.mag, roller, name, { from: pos[a.id] });
    if (!landed) return;
    if (fx.armorWear && t.armor && t.armor.durability > 0) {
      t.armor.durability = Math.max(0, t.armor.durability - fx.armorWear);
      log(enc, `${name} eats at ${t.name}'s armor (durability −${fx.armorWear}).`, 'hit');
    }
    if (fx.sap && !t.status.dead) {
      const S = fx.sap;
      if (S.attr && S.n) C.damageAttr(t, S.attr, S.n);
      const took = C.tireless(t) ? 0 : Math.min(t.stamina, S.stamina || 0);
      t.stamina -= took;
      const got = Math.min(took, C.maxStamina(a) - a.stamina);
      if (got > 0) a.stamina += got;
      C.updateCondition(t);
      log(enc, `${name} saps ${t.name}${S.attr ? ` (−${S.n} ${S.attr}` : ' ('}${took ? `, −${took} stamina` : ''})${got ? `; ${a.name} +${got} stamina` : ''}.`, 'hit');
    }
    if (fx.onHit && C.isActive(t) && G.Magic) {
      const H = fx.onHit;
      const need = Math.round((H.chance == null ? 1 : H.chance) * 10);
      const r = need >= 10 ? 1 : await rollDie(roller, a.id, 10, `${a.name}: ${name}`, `d10 ≤ ${need}: ${(CONFIG.conditions[H.cond] || {}).name || H.cond}`);
      if (r <= need) await G.Magic.afflict(enc, a, t, H.cond, { rounds: H.rounds || 1, mag: H.mag || 1 }, roller);
    }
  }

  // Pay spell points and roll backlash. Returns false if the spell fails to go off.
  async function castSpell(enc, a, opt, roller) {
    // An item's power: a charge, no spell points, no backlash.
    if (opt.power) {
      if (!G.Magic.usePower(a, opt)) { log(enc, `${a.name}'s ${opt.power.name} has nothing left in it.`, 'fizzle'); return false; }
      return true;
    }
    const avail = G.Magic.availableSP(a);
    if (opt.spCost > avail + G.Magic.overchannelSP(a)) {
      log(enc, `${a.name} can't draw enough power for ${opt.label} (${avail} of ${opt.spCost} points).`, 'fizzle');
      return false;
    }
    a.spSpent = (a.spSpent || 0) + Math.min(avail, opt.spCost);
    // Overchannel: the points the pool lacks are paid from the body, a point of CON each.
    if (opt.spCost > avail) {
      C.damageAttr(a, 'CON', opt.spCost - avail);
      log(enc, `${a.name} overchannels: ${opt.spCost - avail} CON for the points the pool lacks.`, 'hit');
    }
    const lost = await G.Magic.backlash(a, opt.spCost, roller);
    if (lost > 0) {
      a.stamina = Math.max(0, a.stamina - lost);
      enc.hitThisRound[a.id] = (enc.hitThisRound[a.id] || 0) + lost;
      C.updateCondition(a);
      log(enc, `Backlash: ${a.name} loses ${lost} stamina.`, 'fail');
      if (!C.isActive(a)) {
        log(enc, `${a.name} collapses from the backlash; the spell is lost.`, 'death');
        return false;
      }
    }
    return true;
  }

  function knockDown(enc, t) {
    t.status.prone = true;
    loseWindUp(enc, t, 'knocked down');
  }

  function loseWindUp(enc, c, why) {
    if (!c.status.windUp) return;
    c.status.windUp = null;
    if (why) log(enc, `${c.name} loses the wind-up (${why}).`, 'fizzle');
  }

  // Rust (monster trait): no wound, but iron and steel armor corrodes (bronze doesn't rust).
  function rustTouch(enc, a, t, amount) {
    const metal = t.armor && Items.rusts(Object.assign({ kind: 'armor' }, t.armor)) && t.armor.durability > 0;
    if (!metal) return log(enc, `${a.name}'s antennae brush ${t.name}, finding nothing that rusts.`, 'fizzle');
    t.armor.durability = Math.max(0, t.armor.durability - amount);
    log(enc, `${a.name}'s antennae touch ${t.name}'s armor: it flakes with rust (durability −${amount}${t.armor.durability ? '' : ', destroyed'}).`, 'hit');
  }

  async function shieldAbsorb(enc, chars, a, t, d, roller) {
    const s = t.shield;
    const ss = Items.shieldStats(s);
    const v = d.type === 'strike' ? d.option.damage : [0, 0, 0];
    const W = CONFIG.shieldWear;
    const wear = Math.round((v[0] * W.P + v[1] * W.S + v[2] * W.B) * (CONFIG.shieldWearScale || 1) * Items.wearMult(s));
    s.durability = Math.max(0, s.durability - wear);
    if (d.type === 'strike' && d.option.rust && Items.rusts(s)) {
      s.durability = Math.max(0, s.durability - d.option.rust);
      log(enc, `The rusting antennae eat into ${t.name}'s ${s.material}-bound shield (durability −${d.option.rust}).`, 'hit');
    }
    const label = d.type === 'strike' ? d.option.label : d.type;
    let msg = `${t.name} blocks ${a.name}'s ${label} with the shield (durability −${wear})`;
    let force = v[0] + v[1] + v[2];
    if (C.rank(a, 'shield_breaker')) force *= 2;
    const power = d.type === 'strike' && ((CONFIG.powerMotions || []).includes(d.option.motion) || d.option.shieldCrush);
    const weapon = d.type === 'strike' && d.option.weaponType ? WEAPONS[d.option.weaponType] : null;
    const blade = d.type === 'strike' ? weaponItem(a, d.option) : null;
    const bladeMaterial = blade ? Items.weaponMaterial(blade) : weapon && weapon.material;
    let broken = false;
    if (power && weapon && bladeMaterial && !ss.unbreakable && Items.hardness(bladeMaterial) >= Items.hardness(s.material)) {
      s.durability = 0;
      broken = true;
      msg += ' — the power blow BREAKS it';
    } else if (force > ss.threshold) {
      const chance = Math.min(100, (force - ss.threshold) * CONFIG.shieldBreakPerPoint);
      const r = await rollDie(roller, a.id, 100, `${a.name}: Shield break`, `d100 ≤ ${chance} breaks it (force ${force} vs threshold ${ss.threshold})`);
      if (r <= chance) {
        s.durability = 0;
        broken = true;
        msg += ' — the shield SHATTERS';
      }
    }
    if (s.durability <= 0 && !broken) msg += ' — the shield is destroyed';
    log(enc, msg + '.', 'defend');
    // A blocked power blow still drives through: force above the threshold lands as blunt.
    if (power && CONFIG.powerPushThrough && force > ss.threshold && C.isActive(t)) {
      const excess = Math.round((force - ss.threshold) / (C.rank(a, 'shield_breaker') ? 2 : 1));
      const push = { kind: 'strike', motion: 'swing', weaponType: d.option.weaponType, damage: [0, 0, excess], label: 'push-through' };
      const r = await applyHit(enc, chars, a, t, push, roller, {});
      log(enc, `The blow drives through the shield into ${t.name}: ${r.text}`, 'hit');
    }
  }

  // ---- Weapon wear (CONFIG.weaponWear) ------------------------------------------------------
  // The weapon item behind an attack option (natural weapons and spells have none).
  function weaponItem(c, option) {
    return option && option.weaponId && !option.natural && !option.ranged ? c.weapons.find((w) => w.id === option.weaponId) || null : null;
  }

  function armorMaterial(armor) {
    return Items.materialOf(Object.assign({ kind: 'armor' }, armor));
  }

  // What a natural weapon is made of (a claw is bone), for wear on the blade that meets it.
  function naturalMaterial(option) {
    return option && option.weaponType && WEAPONS[option.weaponType] ? WEAPONS[option.weaponType].material || 'bone' : null;
  }

  // Wear = the blow's force × rate × fragility × (what it meets ÷ its own hardness), less against organic
  // materials (weaponWear.organic). Durability stays whole: the
  // fraction of a point is carried on the weapon (w.wearCarry) to the next knock, so small knocks add up instead of
  // rounding away (or up). A weapon that drops below half says so; one that reaches 0 breaks.
  function wearWeapon(enc, owner, w, force, rate, against) {
    const W = CONFIG.weaponWear;
    const max = Items.weaponMaxDurability(w);
    if (!W || !max || !against || !force) return;
    const own = Items.hardness(Items.weaponMaterial(w)) || 1;
    const give = (G.DATA.MATERIALS[against] || {}).organic ? W.organic || 1 : 1; // horn and chitin give under an edge
    const raw = (w.wearCarry || 0) + force * W[rate] * (WEAPONS[w.type].fragility || 1) * (Items.hardness(against) / own) * give * Items.wearMult(w);
    const wear = Math.floor(raw);
    w.wearCarry = Math.round((raw - wear) * 1000) / 1000;
    if (wear <= 0) return;
    const before = Items.weaponDurability(w);
    w.durability = Math.max(0, before - wear);
    if (w.durability <= 0) log(enc, `${owner.name}'s ${Items.itemName(w).toLowerCase()} breaks.`, 'hit');
    else if (before > max / 2 && w.durability <= max / 2) log(enc, `${owner.name}'s ${Items.itemName(w).toLowerCase()} is badly worn (${w.durability}/${max}).`, 'fail');
  }

  // A defence that works still costs the defender something of the blow's force (CONFIG.defense.absorb):
  // a block takes most of it on the arm, a parry some, a dodge none.
  function absorbImpact(enc, t, kind, d) {
    const share = CONFIG.defense.absorb && CONFIG.defense.absorb[kind];
    if (!share || d.type !== 'strike' || C.tireless(t) || !C.isActive(t)) return;
    const loss = Math.min(t.stamina, Math.round(blowForce(d.option) * share));
    if (loss <= 0) return;
    t.stamina -= loss;
    enc.hitThisRound[t.id] = (enc.hitThisRound[t.id] || 0) + loss;
    C.updateCondition(t);
    log(enc, `The blow jars ${t.name} (−${loss} stamina).`, 'hit');
  }

  // CONFIG.defense.rebound: a blow blocked or parried costs the attacker a share of its AP getting the weapon back
  // (more for a parry with Beat). What they haven't got this round comes off the next (`carry`).
  function rebound(enc, a, d, kind, t) {
    const R = CONFIG.defense.rebound;
    if (!R || !d.ap || !(kind in R)) return;
    const share = R[kind] + (kind === 'block' ? 0 : G.Effects.sum(t, 'recoil') * (R.perRank || 0));
    const lose = Math.round(d.ap * share);
    if (lose <= 0) return;
    const now = Math.min(apLeft(enc, a.id), lose), owe = R.carry ? lose - now : 0;
    enc.ap[a.id] = (enc.ap[a.id] || 0) - now;
    if (owe) (enc.owed || (enc.owed = {}))[a.id] = (enc.owed[a.id] || 0) + owe;
    const what = kind === 'block' ? 'off the shield' : 'off the parry';
    log(enc, `${a.name}'s blow rebounds ${what}: −${C.fmtAP(lose)} AP${owe ? ` (${C.fmtAP(owe)} of it next round)` : ''}.`, 'defend');
  }

  // Sweep: a two-handed swing carries on into one more foe beside its target and in reach, free, at half its force
  // (that foe may defend).
  async function sweep(enc, chars, a, d, io) {
    const o = d.option;
    if (!C.rank(a, 'sweep') || !C.isActive(a) || o.ranged || o.spell || !o.weaponId || o.motion === 'thrust' || o.offhand) return;
    const w = a.weapons.find((x) => x.id === o.weaponId);
    if (!w || WEAPONS[w.type].hands !== 2) return;
    const me = enc.pos[a.id], at = enc.pos[d.target];
    const next = enc.ids.find((x) => x !== d.target && chars[x].side !== a.side && C.isActive(chars[x]) && enc.pos[x] && dist(enc.pos[x], at) <= 1 && C.inRange(o, dist(me, enc.pos[x])));
    if (!next) return;
    const half = Object.assign({}, o, { damage: o.damage.map((v) => Math.floor(v / 2)), ap: 0, label: 'Sweep' });
    log(enc, `${a.name}'s swing sweeps on into ${chars[next].name}.`, 'pass');
    const sd = { actor: a.id, type: 'strike', option: half, target: next, ap: 0, stamina: 0, n: ++enc.seq, opportunity: true, sweep: true, round: enc.round };
    enc.decls.push(sd);
    await resolveAction(enc, chars, sd, io, Object.assign({}, enc.pos));
    sd.done = true;
  }

  // Cleave: a melee blow that drops its foe carries on, free, into another foe the same weapon can reach (the
  // striker chooses; that foe may defend). Once a blow.
  async function cleave(enc, chars, a, d, io) {
    if (!C.rank(a, 'cleave') || !C.isActive(a) || d.option.ranged || d.option.spell || !d.option.weaponId) return;
    const me = enc.pos[a.id];
    const foes = enc.ids.filter((o) => o !== d.target && chars[o].side !== a.side && C.isActive(chars[o]) && enc.pos[o])
      .sort((x, y) => dist(me, enc.pos[x]) - dist(me, enc.pos[y]));
    for (const o of foes) {
      const dd = dist(me, enc.pos[o]);
      const options = C.attackOptions(a)
        .filter((x) => x.weaponId === d.option.weaponId && !x.ranged && !x.spell && !x.windUp && C.inRange(x, dd) && !attackUnavailable(enc, a, x))
        .map((x) => Object.assign({}, x, { ap: 0 }));
      if (!options.length) continue;
      const pick = await react(enc, chars, { kind: 'opportunity', actor: a.id, target: o, options, ap: apLeft(enc, a.id), why: 'cleave' }, io);
      const opt = options.find((x) => x === pick || (pick && C.optionKey(x) === (typeof pick === 'string' ? pick : C.optionKey(pick))));
      if (!opt) continue;
      log(enc, `${a.name} cleaves on into ${chars[o].name}.`, 'pass');
      const sd = { actor: a.id, type: 'strike', option: opt, target: o, ap: 0, stamina: opt.stamina, n: ++enc.seq, opportunity: true, cleave: true, round: enc.round };
      enc.decls.push(sd);
      await resolveAction(enc, chars, sd, io, Object.assign({}, enc.pos));
      sd.done = true;
      return;
    }
  }

  // A successful parry opens the attacker (CONFIG.defense.riposteOpen): the parrier may answer at once with a blow of
  // the parrying weapon that reaches them, paying its AP (none with the Riposte feat), and the attacker may defend it.
  // With riposteOpen off, only the feat's free thrust, undefended (as before 2026-11-03).
  async function riposte(enc, chars, t, a, kind, io, posAtStart) {
    const w = parryingWeapon(t, kind);
    if (!w) return;
    const free = C.rank(t, 'riposte') > 0;
    const d0 = dist(posAtStart[t.id], posAtStart[a.id]);
    if (!CONFIG.defense.riposteOpen) {
      if (!free || !Items.weaponStats(w).faces.point) return;
      const opt = C.attackOptions(t).find((o) => o.motion === 'thrust' && o.weaponId === w.id && !o.halfSword);
      if (!opt || d0 > opt.reach) return;
      if (!payStamina(enc, t, opt.stamina)) return;
      const r = await applyHit(enc, chars, t, a, opt, io && io.roller);
      return log(enc, `${t.name} ripostes: ${r.text}`, 'hit');
    }
    if (t.status.prone || isGrappled(t) || C.inClinch(t)) return;
    const options = C.attackOptions(t)
      .filter((o) => o.weaponId === w.id && !o.ranged && !o.spell && !o.windUp && o.motion !== 'power' && C.inRange(o, d0) && !attackUnavailable(enc, t, o))
      .map((o) => (free ? Object.assign({}, o, { ap: 0 }) : o))
      .filter((o) => o.ap <= apLeft(enc, t.id));
    if (!options.length) return;
    const pick = await react(enc, chars, { kind: 'opportunity', actor: t.id, target: a.id, options, ap: apLeft(enc, t.id), why: 'riposte' }, io);
    const opt = options.find((o) => o === pick || (pick && C.optionKey(o) === (typeof pick === 'string' ? pick : C.optionKey(pick))));
    if (!opt) return;
    enc.ap[t.id] -= opt.ap;
    log(enc, `${t.name} ripostes.`, 'pass');
    const sd = { actor: t.id, type: 'strike', option: opt, target: a.id, ap: opt.ap, stamina: opt.stamina, n: ++enc.seq, opportunity: true, riposte: true, round: enc.round };
    enc.decls.push(sd);
    await resolveAction(enc, chars, sd, io, posAtStart);
    sd.done = true;
  }

  async function resolveManeuver(enc, chars, d, roller) {
    const a = chars[d.actor];
    const t = chars[d.target];
    const M = CONFIG.maneuver;
    if (d.type === 'shove') {
      const S = CONFIG.shove;
      const w = C.wieldedWeapon(a);
      const aB = Math.floor(C.attr(a, 'STR') / 2) + C.skill(a, 'athletics') + (w && WEAPONS[w.type].hands === 2 ? S.twoHandBonus : 0) + (C.shieldReady(a) ? S.shieldBonus || 0 : 0) + (C.rank(a, 'bull_rush') ? 2 : 0);
      const o = await opposed(roller, a, aB, dist(enc.pos[a.id], enc.pos[t.id]) > 1 ? 'Fend off' : 'Shove', t, stability(t), 'Hold ground');
      if (o.margin <= 0) return log(enc, `${a.name}'s shove fails (${o.a} vs ${o.b}).`, 'fail');
      const from = enc.pos[a.id], at = enc.pos[t.id];
      const want = o.margin >= S.farMargin ? 2 : 1;
      // Walls stop a shove (a body can't be driven into stone); a pit, a rune or a fire on the way takes it.
      const moved = await G.Magic.push(enc, chars, t, from, want, roller, false);
      if (moved) {
        log(enc, `${a.name} shoves ${t.name} back ${moved} square${moved > 1 ? 's' : ''} (${o.a} vs ${o.b}).`, 'hit');
        // Bull Rush: follow them into the square they were driven from.
        if (C.rank(a, 'bull_rush') && dist(from, at) <= 1 && !C.holding(a) && !enc.ids.some((o) => o !== t.id && C.isActive(chars[o]) && enc.pos[o].x === at.x && enc.pos[o].y === at.y)) {
          enc.pos[a.id] = { x: at.x, y: at.y };
          log(enc, `${a.name} follows through.`, 'pass');
        }
      }
      else if (o.margin >= S.farMargin) {
        knockDown(enc, t);
        log(enc, `${a.name} shoves ${t.name} against the obstacle and down (${o.a} vs ${o.b}).`, 'hit');
      } else log(enc, `${a.name} shoves ${t.name}, but there's nowhere to go (${o.a} vs ${o.b}).`, 'fail');
      return;
    }
    if (d.type === 'trip') {
      const bonus = (C.rank(a, 'trip') ? M.tripFeatBonus : 0) + (hookWeapon(a) ? 2 : 0);
      const k = await knockdownCheck(roller, a, t, bonus, 'Trip');
      if (k.margin >= (M.tripMargin || 1)) {
        knockDown(enc, t);
        log(enc, `${a.name} trips ${t.name} — prone (${k.a} vs ${k.b}).`, 'hit');
      } else log(enc, `${a.name}'s trip fails (${k.a} vs ${k.b}).`, 'fail');
    } else if (d.type === 'disarm') {
      const w = C.wieldedWeapon(t);
      if (!w) return log(enc, `${t.name} has nothing to disarm.`, 'fizzle');
      const aB = Math.floor(C.combatAttr(a, 'DEX') / 2) + (C.rank(a, 'disarm') ? M.disarmFeatBonus : 0);
      const grip = WEAPONS[w.type].hands === 2 || (WEAPONS[w.type].hands === 1.5 && !C.shieldReady(t)) ? M.twoHandGripBonus : 0;
      const bB = Math.floor(C.combatAttr(t, 'DEX') / 2) + grip + (C.rank(t, 'iron_stance') ? M.ironStanceBonus : 0);
      const o = await opposed(roller, a, aB, 'Disarm', t, bB, 'Keep grip');
      if (o.margin > 0) {
        dropHeld(t);
        loseWindUp(enc, t, 'disarmed');
        log(enc, `${a.name} disarms ${t.name}; ${Items.itemName(w)} falls (${o.a} vs ${o.b}).`, 'hit');
      } else log(enc, `${a.name}'s disarm fails (${o.a} vs ${o.b}).`, 'fail');
    }
  }

  // ---- End of round ------------------------------------------------------
  // The round each death happened in, for the window in which a Life restore can still call them back.
  function markDeaths(enc, chars) {
    for (const id of enc.ids) {
      const c = chars[id];
      if (c && c.status.dead && c.status.diedRound == null && !c.conjured && !c.vanished) c.status.diedRound = enc.round;
    }
  }

  function endRound(enc, chars) {
    log(enc, 'End of round', 'pass');
    // Constrictors (trait constrict: { stamina, con }) crush whoever they hold.
    for (const id of enc.ids) {
      const c = chars[id];
      const K = c && c.traits && c.traits.constrict;
      const held = K && C.isActive(c) && C.holding(c) ? chars[C.holding(c)] : null;
      if (!held || held.status.dead) continue;
      if (K.stamina && !C.tireless(held)) {
        const took = Math.min(held.stamina, K.stamina);
        held.stamina -= took;
        enc.hitThisRound[held.id] = (enc.hitThisRound[held.id] || 0) + took; // a crush is a blow: half regeneration (R1)
      }
      if (K.con) C.damageAttr(held, 'CON', K.con);
      const wasDown = held.status.unconscious;
      C.updateCondition(held);
      log(enc, `${c.name} crushes ${held.name} (${[K.stamina ? `−${K.stamina} stamina` : null, K.con ? `−${K.con} CON` : null].filter(Boolean).join(', ')}).${held.status.dead ? ` ${held.name} is DEAD.` : held.status.unconscious && !wasDown ? ` ${held.name} ${downWord(held)}.` : ''}`, 'hit');
    }
    for (const id of enc.ids) {
      const c = chars[id];
      if (c.status.dead) continue;
      // Bleed: each wound bleeds its damage again over its remaining rounds.
      let bleed = 0, poison = 0;
      for (const b of c.bleeds) {
        const loss = Math.round(b.remaining / b.rounds);
        b.remaining -= loss;
        b.rounds -= 1;
        if (b.poison) poison += loss; else bleed += loss;
      }
      c.bleeds = c.bleeds.filter((b) => b.rounds > 0 && b.remaining > 0);
      if (bleed > 0) {
        C.damageAttr(c, 'CON', bleed);
        log(enc, `${c.name} bleeds ${bleed} CON.`, 'bleed');
      }
      if (poison > 0) {
        C.damageAttr(c, 'CON', poison);
        log(enc, `Venom costs ${c.name} ${poison} CON.`, 'bleed');
      }
      // Conditions: damage over time, then each ticks down a round.
      if (G.Conditions) for (const line of G.Conditions.endRound(c)) log(enc, line, 'bleed');
      // A controlled fighter comes back to themselves when the spell ends or its caster falls.
      if (c.charmed) {
        const ctl = G.Conditions.get(c, 'controlled');
        if (ctl && chars[ctl.src] && !C.isActive(chars[ctl.src])) G.Conditions.remove(c, 'controlled');
        if (!G.Conditions.list(c).some((x) => (CONFIG.conditions[x.key] || {}).control)) {
          c.side = c.charmed.side; c.control = c.charmed.control; delete c.charmed;
          log(enc, `${c.name} comes back to themselves.`, 'pass');
        }
      }
      // Regrowth (monster trait): wounds close and strength returns, unless burned this round.
      const R = c.traits && c.traits.regrow;
      if (R && !(enc.burned || {})[id] && C.attr(c, 'CON') > 0) {
        const healed = Math.min(R.con, c.damage.CON || 0);
        if (healed) C.healAttr(c, 'CON', healed);
        c.bleeds = c.bleeds.filter((b) => b.poison);
        const before = c.stamina;
        c.stamina = Math.min(C.maxStamina(c), c.stamina + R.stamina);
        if (c.status.unconscious && c.stamina > 0) { C.comeRound(c); log(enc, `${c.name} heaves itself back up.`, 'death'); }
        if (healed || c.stamina > before) log(enc, `${c.name} regenerates${healed ? ` ${healed} CON` : ''}${c.stamina > before ? `${healed ? ' and' : ''} ${c.stamina - before} stamina` : ''}.`);
      }
      // Weariness: the stamina a fighter spent or lost this round lowers the most it can come back to.
      if (C.isActive(c)) C.wearyRound(c, Math.max(0, ((enc.staminaAtStart || {})[id] ?? c.stamina) - c.stamina));
      // A collapse (CONFIG.stamina.collapse) that began this round is stamped with it.
      if (c.status.collapsed && c.status.collapsed.round == null) c.status.collapsed.round = enc.round;
      // Regeneration.
      const conscious = !c.status.unconscious;
      const R1 = CONFIG.stamina && CONFIG.stamina.regen;
      if ((conscious || CONFIG.unconsciousRegenerates) && R1) {
        // R1: every round; a share of it in a round a blow took stamina, in full with Second Wind (or in hero mode).
        const took = enc.hitThisRound[id] || 0;
        const struck = took > 0 && !C.rank(c, 'second_wind') && !(c.hero && CONFIG.hero && CONFIG.hero.regenWhenHit);
        const r = C.roundRegen(c, struck);
        if (r < 0) {
          c.stamina = Math.max(0, c.stamina + r);
          log(enc, `${c.name} loses ${-r} stamina to heavy armor.`);
        } else if (r > 0) {
          const before = c.stamina;
          c.stamina = Math.min(C.maxStamina(c), c.stamina + r);
          if (c.stamina > before) log(enc, `${c.name} recovers ${c.stamina - before} stamina${struck ? ' (struck: a share)' : ''}.`);
        }
      } else if (conscious || CONFIG.unconsciousRegenerates) {
        const r = C.regen(c);
        const took = enc.hitThisRound[id] || 0;
        const allowed = took === 0 || (C.rank(c, 'second_wind') && took <= 2) || (c.hero && CONFIG.hero && CONFIG.hero.regenWhenHit) || (enc.rallied || {})[id] === enc.round;
        if (r < 0 && CONFIG.negativeRegenAlwaysApplies) {
          c.stamina = Math.max(0, c.stamina + r);
          log(enc, `${c.name} loses ${-r} stamina to heavy armor.`);
        } else if (r > 0 && allowed) {
          const before = c.stamina;
          c.stamina = Math.min(C.maxStamina(c), c.stamina + r);
          if (c.stamina > before) log(enc, `${c.name} recovers ${c.stamina - before} stamina.`);
        }
      }
      // R3: a collapse runs its course; they come round with a round's regeneration, still on the ground.
      if (C.collapsed(c) && enc.round >= c.status.collapsed.round + collapseRounds(c)) {
        C.comeRound(c, Math.max(1, C.roundRegen(c, false)));
        log(enc, `${c.name} comes round (${c.stamina} stamina), still on the ground.`, 'death');
      }
      const wasDown = c.status.unconscious;
      C.updateCondition(c);
      if (c.status.collapsed && c.status.collapsed.round == null) c.status.collapsed.round = enc.round;
      if (c.status.dead) log(enc, `${c.name} has died.`, 'death');
      else if (c.status.unconscious && !wasDown) log(enc, `${c.name} ${downWord(c)}.`, 'death');
      if (c.status.unconscious) { releaseGrapples(chars, c); c.status.windUp = null; }
      // Webs loosen as you struggle: a layer comes off each round.
      if (c.status.webbed && CONFIG.web && CONFIG.web.wearOff) c.status.webbed = Math.max(0, c.status.webbed - CONFIG.web.wearOff);
      // Holding someone is exhausting: pay the upkeep or let go.
      const G2 = CONFIG.grappling;
      if (C.holding(c) && G2 && G2.holdUpkeep && !c.status.unconscious) {
        const cost = G2.holdUpkeep * (CONFIG.staminaScale || 1);
        if (c.stamina > cost) {
          c.stamina -= cost;
          log(enc, `${c.name} spends ${cost} stamina holding ${chars[C.holding(c)] ? chars[C.holding(c)].name : 'their foe'}.`);
        } else {
          clearGrapple(chars, c);
          log(enc, `${c.name} is too spent to keep the hold and lets go.`, 'fizzle');
        }
      }
      // A wind-up must be released by the end of the round after it is made.
      if (c.status.windUp && c.status.windUp.round < enc.round) loseWindUp(enc, c, 'not released in time');
    }
    markDeaths(enc, chars);
    const R = CONFIG.magic && CONFIG.magic.revive;
    for (const id of enc.ids) {
      const c = chars[id];
      if (R && c && c.status.dead && c.status.diedRound != null && !c.conjured && !c.vanished && !C.tireless(c) && enc.round - c.status.diedRound === R.rounds) log(enc, `${c.name} is beyond saving now.`, 'death');
    }
    const sides = {};
    for (const id of enc.ids) if (C.isActive(chars[id])) sides[chars[id].side] = true;
    const left = Object.keys(sides);
    if (left.length <= 1) {
      enc.phase = 'over';
      enc.winner = left[0] || null;
      log(enc, left.length ? `The ${left[0] === 'party' ? 'party' : 'enemy'} side wins.` : 'No one is left standing.', 'round');
    } else {
      enc.phase = 'roundEnd';
    }
  }

  // Remove combat-only state from characters after an encounter.
  function cleanup(enc, chars) {
    for (const id of enc.ids) {
      const c = chars[id];
      if (!c) continue;
      // Conjured creatures and the raised dead don't outlast the fight.
      if (c.conjured) { delete chars[id]; continue; }
      // A collapse ends with the fight: they come round, winded.
      if (C.collapsed(c)) C.comeRound(c, 1);
      c.status.collapsed = null;
      c.status.prone = false;
      c.status.windUp = null;
      c.status.grapple = null;
      c.status.webbed = 0;
      // Diseases and the like outlast the fight; everything else ends with it.
      c.status.conds = (c.status.conds || []).filter((x) => (CONFIG.conditions[x.key] || {}).persist);
      if (c.charmed) { c.side = c.charmed.side; c.control = c.charmed.control; delete c.charmed; }
      // Weapons on the ground are gathered up after the fight.
      if (c.status.dropped.length || c.wield == null) {
        c.status.dropped = [];
        if (c.wield == null) c.wield = primaryWeaponId(c) || (c.weapons[0] ? c.weapons[0].id : null);
      }
    }
  }

  // ---- What a blow will likely do (docs/PLAN.md step 7: the battle panel tells you the odds) -------------------
  // The rolls applyHit makes, as a distribution rather than one throw: where it lands (the aim's hold, the location
  // roll), the gap roll, the cut that carries on, the pass-through dice, the vital roll and the wound tables. Each
  // landed blow is computeHit at that location; nothing here is a second model of the blow, only its dice laid out.
  // Returns [{ p, dmg: {attr: points}, stamina, vital, wear }].
  function locationBranches(attacker, target, option) {
    const L = CONFIG.locations;
    const rolled = () => {
      if (!L || !bodyBlow(target, option) || (!L.wounds && C.armorUniform(target))) return [{ loc: null, w: 1 }];
      let acc = 0;
      return L.order.map((l, i) => {
        const w = i === L.order.length - 1 ? 1 - acc : Math.round((L.share[l] || 0) * 100) / 100;
        acc += w;
        return { loc: l, w };
      });
    };
    if (option.aim && bodyBlow(target, option)) {
      const p = aimHold(attacker, target, option);
      if (p >= 1) return [{ loc: option.aim, w: 1 }];
      const hp = Math.round(p * 100) / 100;
      return [{ loc: option.aim, w: hp }].concat(rolled().map((b) => ({ loc: b.loc, w: b.w * (1 - hp) })));
    }
    return rolled();
  }

  function hitOutcomes(attacker, target, option, flags) {
    const out = new Map();
    const add = (o) => {
      const k = dmgKey(o.dmg) + '|' + o.stamina + '|' + o.vital;
      const x = out.get(k);
      if (x) { x.p += o.p; x.wear += o.wear; } else out.set(k, o);
    };
    const K = CONFIG.locations && CONFIG.locations.carry;
    for (const b of locationBranches(attacker, target, option)) {
      if (!(b.w > 0)) continue;
      const h0 = computeHit(attacker, target, option, Object.assign({}, flags, b.loc ? { location: b.loc } : {}));
      const gaps = h0.gap
        ? [{ w: h0.gap.chance, h: Object.assign({}, h0.gap.got, { location: h0.location, piece: h0.piece }) }, { w: 1 - h0.gap.chance, h: Object.assign({}, h0.gap.turned, { location: h0.location, piece: h0.piece }) }]
        : [{ w: 1, h: h0 }];
      for (const g of gaps) {
        if (!(g.w > 0)) continue;
        const h = g.h;
        // carryCut: the slashing past a limb's worth goes on into the next location (rolled among them).
        const next = K && h.location && h.slashToAttrs > K.limb ? (K.next || {})[h.location] : null;
        const carries = next && next.length
          ? next.map((into) => ({ w: 1 / next.length, c: computeHit(attacker, target, Object.assign({}, option, { damage: [0, h.slashToAttrs - K.limb, 0], punch: 0 }), { location: into, carried: true }) }))
          : [{ w: 1, c: null }];
        for (const cy of carries) laidOut(target, h, cy.c, b.w * g.w * cy.w, add);
      }
    }
    return Array.from(out.values());
  }

  // One landed blow's dice (applyHit's order), given where it landed and what carried on.
  function laidOut(target, h0, carried, w, add) {
    const K = CONFIG.locations && CONFIG.locations.carry;
    const V = CONFIG.vital;
    const loc = h0.location;
    const h = Object.assign({}, h0);
    let wear = (h.armored && h.piece ? h.durLoss || 0 : 0);
    if (carried) {
      h.slashToAttrs = K.limb + carried.slashToAttrs;
      h.bluntToStamina += carried.bluntToStamina;
      h.bluntToCON += carried.bluntToCON;
      h.cutVital = Math.max(h.cutVital || 0, carried.cutVital || 0);
      if (carried.armored && carried.piece) wear += carried.durLoss || 0;
    }
    // A list of { p, dmg, vital } that each die below splits.
    let list = [{ p: w, dmg: {}, vital: false }];
    const plus = (dmg, a, n) => { const d = Object.assign({}, dmg); if (n > 0) d[a] = (d[a] || 0) + n; return d; };
    const split = (fn) => { const nx = []; for (const o of list) for (const r of fn(o)) if (r.p > 0) nx.push(r); list = nx; };
    const table = (where, n) => split((o) => {
      // n points, each one of the location's attributes at even odds.
      const t = woundTable(target, where);
      let ways = [{ p: o.p, dmg: o.dmg }];
      for (let i = 0; i < n; i++) {
        const m = new Map();
        for (const x of ways) for (const a of t) {
          const d = plus(x.dmg, a, 1), k = dmgKey(d);
          const y = m.get(k);
          if (y) y.p += x.p / t.length; else m.set(k, { p: x.p / t.length, dmg: d });
        }
        ways = Array.from(m.values());
      }
      return ways.map((x) => ({ p: x.p, dmg: x.dmg, vital: o.vital }));
    });
    const chance = (pc) => sizedVital(target, vitalNeed(pc || 0)) / 10;
    // The pass-through dice: each point left over reaches the body on a d10 of round(pass × 10) or less.
    const rolls = h.armored && h.pierce !== 'turned' && (h.pierce !== 'gap' || CONFIG.pierce.gapPass) && CONFIG.pierceMode === 'roll' && h.pierceLeft > 0 && h.pass < 1;
    const pts = rolls ? binomial(h.pierceLeft, Math.round(h.pass * 10) / 10) : [{ n: h.pointLimb ? h.pointToAttrs || 0 : h.toCON, p: 1 }];
    split((o) => pts.map((x) => ({ p: o.p * x.p, dmg: o.dmg, vital: o.vital, n: x.n })));
    if (!h.pointLimb) {
      const pv = chance(h.pierceVital);
      split((o) => {
        const n = o.n;
        if (!(n > 0)) return [o];
        const d = plus(o.dmg, 'CON', n);
        return pv > 0 ? [{ p: o.p * pv, dmg: plus(d, 'CON', n * (V.mult - 1)), vital: true }, { p: o.p * (1 - pv), dmg: d, vital: o.vital }] : [{ p: o.p, dmg: d, vital: o.vital }];
      });
    } else {
      const pv = chance(h.pierceVital);
      // A point into a limb: vital (n × mult CON) or the limb's attributes, n points.
      const groups = new Map();
      for (const o of list) { const n = o.n || 0; if (!groups.has(n)) groups.set(n, []); groups.get(n).push(o); }
      const keep = [];
      for (const [n, os] of groups) {
        if (!(n > 0)) { keep.push(...os); continue; }
        const vit = os.map((o) => ({ p: o.p * pv, dmg: plus(o.dmg, 'CON', n * V.mult), vital: true }));
        list = os.map((o) => ({ p: o.p * (1 - pv), dmg: o.dmg, vital: o.vital }));
        table(loc, n);
        keep.push(...vit, ...list);
      }
      list = keep;
    }
    if (h.slashToAttrs > 0) {
      const own = h.slashToAttrs - (carried ? carried.slashToAttrs : 0);
      table(loc, own);
      if (carried && carried.slashToAttrs > 0) table(carried.location, carried.slashToAttrs);
      const cv = chance(h.cutVital);
      if (cv > 0) split((o) => [{ p: o.p * cv, dmg: plus(o.dmg, 'CON', h.slashToAttrs), vital: true }, { p: o.p * (1 - cv), dmg: o.dmg, vital: o.vital }]);
    }
    if (h.bluntToCON > 0) split((o) => [{ p: o.p, dmg: plus(o.dmg, 'CON', h.bluntToCON), vital: o.vital }]);
    if (h.crushToAttrs > 0) table(loc, h.crushToAttrs);
    for (const o of list) add({ p: o.p, dmg: o.dmg, stamina: h.bluntToStamina || 0, vital: o.vital, wear: o.p * wear });
  }

  // A wound tally's key, whatever order its attributes were added in.
  function dmgKey(d) {
    return Object.keys(d).sort().map((a) => a + d[a]).join(',');
  }

  function binomial(n, q) {
    const out = [];
    let c = 1;
    for (let k = 0; k <= n; k++) {
      out.push({ n: k, p: c * Math.pow(q, k) * Math.pow(1 - q, n - k) });
      c = (c * (n - k)) / (k + 1);
    }
    return out;
  }

  // What the outcomes add up to on this target: the expected harm by kind, and the chance of a vital wound, of
  // dropping them (dead, or collapsed: stamina gone, counting what a wound takes off its maximum) and of a kill.
  function sumOutcomes(target, list) {
    const res = { attrs: {}, CON: 0, stamina: 0, wear: 0, vital: 0, drop: 0, kill: 0 };
    const con = C.attr(target, 'CON');
    const down = !C.isActive(target);
    const max0 = C.maxStamina(target);
    for (const o of list) {
      for (const a in o.dmg) { if (a === 'CON') res.CON += o.p * o.dmg[a]; else res.attrs[a] = (res.attrs[a] || 0) + o.p * o.dmg[a]; }
      res.stamina += o.p * Math.min(Math.max(0, target.stamina), o.stamina);
      res.wear += o.wear;
      if (o.vital) res.vital += o.p;
      if ((o.dmg.CON || 0) >= con) {
        // Hero mode knocks a hero out rather than kill them (Character.damageAttr).
        if (!target.hero) res.kill += o.p;
        res.drop += o.p;
        continue;
      }
      if (down || C.tireless(target)) continue;
      // A wound lowers the stamina maximum, and stamina with it (Character.damageAttr), before the blunt lands.
      const keep = target.damage;
      target.damage = Object.assign({}, keep);
      for (const a in o.dmg) target.damage[a] = (target.damage[a] || 0) + o.dmg[a];
      const max1 = C.maxStamina(target);
      target.damage = keep;
      if (target.stamina - Math.max(0, max0 - max1) - o.stamina <= 0) res.drop += o.p;
    }
    return res;
  }

  // Run fn with a fighter's stamina set to s for the moment (what paying for an action leaves them).
  function withStamina(c, s, fn) {
    const keep = c.stamina;
    c.stamina = s;
    try { return fn(); } finally { c.stamina = keep; }
  }

  // What a fighter's stamina is after paying `cost` (payStamina): taken spent, down to 1.
  function afterPaying(c, cost) {
    if (!cost || C.tireless(c)) return c.stamina;
    if (isSpent(c, cost)) return Math.min(c.stamina, 1);
    return canPay(c, cost) ? c.stamina - cost : c.stamina;
  }

  // foresee(attacker, target, option, { enc, chars, distance }): what the attacker's character could know of this
  // blow, from what it can see of the target: the shield and weapon in hand, the armor, whether they are prone, held
  // or down, their stamina; not their AP, nor feats that don't show (Living Fortress, Untouchable, Roll With It).
  // Returns null for a blow that does no harm by these rules (rust, web), else
  //   hit: on a blow that lands untouched: CON, attrs {STR: n…} (expected points), stamina, wear (armor durability),
  //        vital, drop, kill (chances), aimHold (an aimed blow: how often it lands where aimed);
  //   defences: each the target could put up: { kind, name, odds (theirs, to stop it), ap, stamina, spent, absorb
  //        (stamina a stopped blow still takes), carry (share that beats through a parry), shieldBreak, through (what
  //        gets past a successful one), drop, kill (overall, if they choose it) };
  //   best: the defence they are likeliest to stop it with (or null: none); lands: the chance it beats that one (1
  //   with none); drop, kill: overall against that defence.
  // The attacker pays for the blow before it lands (payStamina), so vigor and a spent blow are as they will be.
  function foresee(attacker, target, option, ctx) {
    ctx = ctx || {};
    if (!attacker || !target || !option || option.rust || option.web) return null;
    if (option.spell && !option.damage && !option.spell.magnitude) return null;
    const enc = ctx.enc || null;
    const distance = ctx.distance != null ? ctx.distance : enc && enc.pos[attacker.id] && enc.pos[target.id] ? dist(enc.pos[attacker.id], enc.pos[target.id]) : (option.minRange || 1) + (option.closePenalty ? 1 : 0);
    let o = option;
    if (o.stamina && !C.tireless(attacker) && !o.spent && isSpent(attacker, o.stamina)) o = Object.assign({}, o, { spent: true });
    const paid = afterPaying(attacker, option.stamina);
    return withStamina(attacker, paid, () => {
      const flags = { distance };
      const landed = (s) => withStamina(target, s, () => sumOutcomes(target, hitOutcomes(attacker, target, o, flags)));
      const hit = landed(target.stamina);
      if (o.aim) hit.aimHold = aimHold(attacker, target, o);
      const motion = o.motion;
      const decl = { type: 'strike', option: o, actor: attacker.id, target: target.id };
      const chars = Object.assign({}, ctx.chars || {}, { [attacker.id]: attacker, [target.id]: target });
      const defences = [];
      if (C.isActive(target) && !C.isPinned(target)) {
        for (const kind of DEFENSE_TYPES) {
          if (kind === 'offParry' && !C.offhandWeapon(target)) continue;
          if (defenseUnavailable(target, kind, decl, chars, enc)) continue;
          if (enc && ctx.chars && conditionForbids(enc, chars, target, { type: kind, target: attacker.id })) continue;
          defences.push(defenceOutlook(attacker, target, o, kind, motion, enc, flags, hit));
        }
      }
      let best = null;
      for (const d of defences) if (!best || d.odds > best.odds + 1e-9 || (Math.abs(d.odds - best.odds) < 1e-9 && d.ap < best.ap)) best = d;
      return {
        option: o, distance, spent: !!o.spent, hit, defences,
        best: best ? best.kind : null,
        lands: best ? 1 - best.odds : 1,
        drop: best ? best.drop : hit.drop,
        kill: best ? best.kill : hit.kill,
        down: !C.isActive(target),
      };
    });
  }

  // One defence against this blow: its odds, its cost, and what the blow does if it fails (after the defender has paid
  // for it) or if it holds (a stopped blow jars them; a heavy swing beats through a parry; a power blow drives through a
  // shield, or breaks it).
  function defenceOutlook(attacker, target, o, kind, motion, enc, flags, open) {
    const cost = C.actionCost(target, kind);
    const spent = isSpent(target, cost.stamina);
    const odds = defenseOdds(target, kind, motion, attacker, o, spent ? -(CONFIG.stamina.spent.defense || 0) : 0, enc);
    const s0 = afterPaying(target, cost.stamina);
    const failed = withStamina(target, s0, () => sumOutcomes(target, hitOutcomes(attacker, target, o, flags)));
    const share = CONFIG.defense.absorb && CONFIG.defense.absorb[kind];
    const absorb = share && !C.tireless(target) ? Math.min(Math.max(0, s0), Math.round(blowForce(o) * share)) : 0;
    const s1 = s0 - absorb;
    let through = null, carry = 0, shieldBreak = 0;
    if (kind === 'parry' || kind === 'offParry') {
      carry = parryCarryShare(target, kind, o);
      if (carry > 0 && o.damage.some((x) => Math.floor(x * carry) > 0)) {
        const co = Object.assign({}, o, { damage: o.damage.map((x) => Math.floor(x * carry)), punch: (o.punch || 0) * carry });
        through = withStamina(target, s1, () => sumOutcomes(target, hitOutcomes(attacker, target, co, flags)));
      }
    }
    if (kind === 'block' && target.shield) {
      const ss = Items.shieldStats(target.shield);
      let force = blowForce(o);
      if (C.rank(attacker, 'shield_breaker')) force *= 2;
      const power = (CONFIG.powerMotions || []).includes(o.motion) || o.shieldCrush;
      const weapon = o.weaponType ? WEAPONS[o.weaponType] : null;
      const blade = weaponItem(attacker, o);
      const mat = blade ? Items.weaponMaterial(blade) : weapon && weapon.material;
      if (power && weapon && mat && !ss.unbreakable && Items.hardness(mat) >= Items.hardness(target.shield.material)) shieldBreak = 1;
      else if (force > ss.threshold) shieldBreak = Math.min(100, (force - ss.threshold) * CONFIG.shieldBreakPerPoint) / 100;
      if (power && CONFIG.powerPushThrough && force > ss.threshold) {
        const excess = Math.round((force - ss.threshold) / (C.rank(attacker, 'shield_breaker') ? 2 : 1));
        const push = { kind: 'strike', motion: 'swing', weaponType: o.weaponType, damage: [0, 0, excess], label: 'push-through' };
        through = withStamina(target, s1, () => sumOutcomes(target, hitOutcomes(attacker, target, push, {})));
      }
    }
    // Stopped, it may still knock the last of their stamina out of them.
    const jarred = !C.tireless(target) && s1 <= 0 && target.stamina > 0 ? 1 : 0;
    const held = through ? { drop: Math.max(jarred, through.drop), kill: through.kill } : { drop: jarred, kill: 0 };
    return {
      kind, name: ACTIONS[kind].name, odds, ap: cost.ap, stamina: cost.stamina, spent, absorb, carry, shieldBreak, failed, through,
      drop: (1 - odds) * failed.drop + odds * held.drop,
      kill: (1 - odds) * failed.kill + odds * held.kill,
    };
  }

  G.Combat = {
    foresee, hitOutcomes,
    foeSquares, fearSource, fleeSteps, mustFlee,
    unseenBy, strikeEffects, conditionForbids, ATTACK_TYPES, DEFENSE_TYPES, shoveReach, log, rollDie, castSpell, knockDown, stability, releaseAll: clearGrapple,
    createEncounter, autoPlace, startRound, currentActor, legalActions, act, validate, endTurn, defer, submit, describeDecl, apLeft, defenseOptions, coverOptions, opportunityOptions,
    vitalNeed, woundTable, aimHold, projectedPos, dist, comesRoundAt, collapseRounds, isSpent, canPay, defenseOdds, parryCarryShare, leverage, skillEdge, feintScore, readScore, blowForce, aimPenalty, aimGuarded, aimOpen, knockdownOdds, opposedOdds, shoveOdds, defenseUnavailable, computeHit, passesThrough, sweeps, sweepTarget, sweepForce, applyHit, resolveAction, finishRound, endRound, cleanup, linkOf, grappleScore, breakScore, GRAPPLE_STEPS,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
