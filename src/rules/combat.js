/*
 * Combat engine: round structure, declarations, resolution, damage.
 *
 * Terms:
 *   Round  starts with everyone rolling initiative (AP pool = f(SPD) − fatigue) and
 *          ends when everyone is out of actions; then bleed, regeneration, fatigue.
 *   Turn   one character's actions in a pass, taken in initiative order. A turn may
 *          hold several actions, up to the per-pass AP cap (CONFIG.apPerPass).
 *   Pass   one set of everyone's turns; then every action of the pass resolves together.
 *
 * Defenses are guards: on your turn you ready a block, parry or dodge for the next attack
 * that lands on you (or the next one from a named attacker). A guard lasts until it is used
 * or the pass ends (CONFIG.guardLasts).
 *
 * An action costing more than the AP left in this pass keeps paying from the next
 * passes' allowance; a strike, maneuver or move lands at the end of the pass in
 * which it is fully paid; a guard is up at once. Unspent AP is lost at the end of the
 * round.
 *
 * Every die roll goes through an async `roller(request)` so the UI can ask the
 * player to type in their physical roll, or roll automatically.
 */
(function (G) {
  'use strict';
  const CONFIG = G.CONFIG;
  const { WEAPONS, MOTIONS, ACTIONS } = G.DATA;
  const C = G.Character;
  const Items = G.Items;

  const GRAPPLE_STEPS = ['clinch', 'grapple', 'pin', 'throw', 'break'];
  const ATTACK_TYPES = ['strike', 'trip', 'disarm', 'shove'].concat(GRAPPLE_STEPS);
  const DEFENSE_TYPES = ['block', 'parry', 'dodge', 'offParry'];
  // Held through the pass like guards (not resolved at its end): guards and readied thrusts.
  const HELD_TYPES = DEFENSE_TYPES.concat(['readyStrike']);

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
    return r[0];
  }

  // ---- Round start -------------------------------------------------------
  async function startRound(enc, chars, roller) {
    enc.round += 1;
    // The first round: wards, boons and runes laid in advance by ritual take hold.
    if (enc.round === 1 && G.Ritual) for (const line of G.Ritual.applyPrepared(enc, chars)) log(enc, line, 'pass');
    enc.phase = 'initiative';
    enc.decls = [];
    enc.conceded = {};
    enc.hitThisRound = {};
    enc.burned = {};
    enc.fortressUsed = {};
    enc.pass = 0;
    enc.spent = {};
    enc.initiative = {};
    const active = enc.ids.filter((id) => C.isActive(chars[id]));
    for (const id of active) {
      const c = chars[id];
      const spd = C.combatAttr(c, 'SPD');
      const r = await rollDie(roller, id, CONFIG.initiativeDie, 'Initiative', `d${CONFIG.initiativeDie} + SPD ${spd}`);
      enc.initiative[id] = r + spd;
    }
    enc.order = active.slice().sort((a, b) => {
      const d = enc.initiative[b] - enc.initiative[a];
      if (d) return d;
      return C.combatAttr(chars[b], 'SPD') - C.combatAttr(chars[a], 'SPD');
    });
    enc.capMult = {};
    for (const id of enc.order) {
      enc.capMult[id] = (chars[id].traits && chars[id].traits.apMult) || 1;
      enc.ap[id] = C.apPool(chars[id]);
      enc.apStart[id] = enc.ap[id];
    }
    log(enc, `Round ${enc.round} — initiative: ` + enc.order.map((id) => `${chars[id].name} ${enc.initiative[id]}`).join(', '), 'round');
    startPass(enc, chars);
    return enc;
  }

  // ---- Passes and turns --------------------------------------------------
  // Most AP a character may spend in one pass (Infinity when there is no cap).
  // Monster trait apMult also raises a boss's per-pass allowance (enc.capMult, set each round).
  function passCap(enc, id) {
    const m = (enc && enc.capMult && enc.capMult[id]) || 1;
    return CONFIG.apPerPass ? CONFIG.apPerPass * C.apScale() * m : Infinity;
  }

  function spentIn(enc, id, pass) {
    return (enc.spent[id] && enc.spent[id][pass]) || 0;
  }

  // AP this character can still put in this pass.
  function passLeft(enc, id) {
    return Math.max(0, Math.min(enc.ap[id] || 0, passCap(enc, id) - spentIn(enc, id, enc.pass)));
  }

  // Pay an action's AP from this pass's allowance, then the next passes'. Returns the
  // pass in which the last of it is paid.
  function payAP(enc, id, ap) {
    const cap = passCap(enc, id);
    const s = enc.spent[id] || (enc.spent[id] = {});
    let p = enc.pass, left = ap;
    while (left > 0) {
      const put = Math.min(left, cap - (s[p] || 0));
      if (put > 0) { s[p] = (s[p] || 0) + put; left -= put; }
      if (left > 0) p += 1;
    }
    enc.ap[id] -= ap;
    return p;
  }

  // Attacks aimed at this character that are on their way (not yet landed).
  function incomingAttacks(enc, id) {
    return enc.decls.filter((d) => ATTACK_TYPES.includes(d.type) && d.target === id && !d.done);
  }

  // Guards this character has up that could still be used by an attack landing in `pass`.
  function guardsUp(enc, id, pass) {
    return enc.decls.filter((x) => x.actor === id && DEFENSE_TYPES.includes(x.type) && !x.used &&
      (CONFIG.guardLasts === 'round' ? x.pass <= pass : x.pass === pass));
  }

  // Thrusts held ready this pass.
  function readiesUp(enc, id, pass) {
    return enc.decls.filter((x) => x.actor === id && x.type === 'readyStrike' && !x.used && x.pass === pass);
  }

  // What can be held ready: a melee thrust that reaches past arm's length (a spear, a sword, a
  // rapier), not one that has to be wound up.
  function readyable(opt) {
    return opt.kind === 'strike' && opt.motion === 'thrust' && !opt.ranged && !opt.windUp && !opt.halfSword && (opt.maxRange || 1) >= 2;
  }

  // Shoving reaches clinch distance; a long weapon fends off at range 2 (haft, crossguard, point).
  function shoveReach(c) {
    const w = C.wieldedWeapon(c);
    const f = CONFIG.shove.fendReach;
    return f && w && !WEAPONS[w.type].ranged && (WEAPONS[w.type].reach || 1) >= 2 ? Math.max(CONFIG.range.maneuverMax, f) : CONFIG.range.maneuverMax;
  }

  // A mover stepping to `to`: every foe with a thrust ready, whom the step brings closer and
  // into the thrust's reach, thrusts first (initiative order), where the mover enters its reach.
  // Returns true if the advance is stopped (a hit, or the mover goes down).
  async function stopThrusts(enc, chars, m, to, roller) {
    const from = enc.pos[m.id];
    const holders = enc.decls
      .filter((x) => x.type === 'readyStrike' && !x.used && x.pass === enc.pass && chars[x.actor].side !== m.side && (!x.against || x.against === m.id))
      .sort((x, y) => enc.order.indexOf(x.actor) - enc.order.indexOf(y.actor));
    for (const r of holders) {
      const h = chars[r.actor];
      if (!C.isActive(h) || h.status.prone || isGrappled(h) || h.status.clinch) continue;
      const hp = enc.pos[h.id];
      const d0 = dist(from, hp), d1 = dist(to, hp);
      if (!(d1 < d0 && d1 <= r.option.maxRange)) continue;
      r.used = true;
      const at = Math.max(1, Math.min(d0, r.option.maxRange));
      const virtual = Object.assign({}, enc.pos, { [m.id]: { x: hp.x + at, y: hp.y } });
      const before = { stamina: m.stamina, dmg: C.totalDamage(m), active: C.isActive(m), bleeds: m.bleeds.length };
      log(enc, `${m.name} steps into ${h.name}'s readied point.`, 'pass');
      const sd = { actor: h.id, type: 'strike', option: r.option, target: m.id, pass: enc.pass, stamina: r.stamina, n: ++enc.seq, ready: true };
      await resolveAction(enc, chars, sd, roller, virtual);
      const hit = m.stamina < before.stamina || C.totalDamage(m) > before.dmg || m.bleeds.length > before.bleeds || !C.isActive(m);
      if (hit) {
        if (C.isActive(m)) log(enc, `${h.name}'s point stops ${m.name}'s advance.`, 'hit');
        return true;
      }
    }
    return false;
  }

  function eligible(enc, id) {
    return id != null && !enc.conceded[id] && passLeft(enc, id) >= CONFIG.minActionAP && !enc.turnDone[id];
  }

  function startPass(enc, chars) {
    enc.pass += 1;
    enc.disrupted = {};
    enc.turn = -1;
    enc.turnDone = {};
    enc.phase = 'declare';
    for (const id of enc.order) if (!C.isActive(chars[id])) enc.conceded[id] = true;
    advance(enc);
  }

  function currentActor(enc) {
    return enc.phase === 'declare' ? enc.order[enc.turn] : null;
  }

  // Next character to take a turn in initiative order; after the last, the pass resolves.
  function advance(enc) {
    const n = enc.order.length;
    for (;;) {
      enc.turn += 1;
      if (enc.turn >= n) {
        enc.phase = 'resolve';
        return;
      }
      if (eligible(enc, enc.order[enc.turn])) return;
    }
  }

  // Finish this turn for the pass; any AP left stays for later passes.
  function endTurn(enc, id) {
    if (currentActor(enc) !== id) return;
    enc.turnDone[id] = true;
    advance(enc);
  }

  // Done for the whole round: no more actions or guards until the next round.
  function concede(enc, id) {
    enc.conceded[id] = true;
    if (currentActor(enc) === id) advance(enc);
  }

  // One entry point for a decision: a declaration, 'endTurn' or 'concede'.
  // A declaration that can't be made ends the turn and returns the reason.
  function submit(enc, chars, d) {
    if (d.type === 'concede') return concede(enc, d.actor), null;
    if (d.type === 'endTurn') return endTurn(enc, d.actor), null;
    const err = declare(enc, chars, d);
    if (err) endTurn(enc, d.actor);
    return err;
  }

  // Where a character will be after its own declared moves.
  function projectedPos(enc, id) {
    let p = enc.pos[id];
    for (const d of enc.decls) if (d.actor === id && d.type === 'move' && !d.done) p = d.to;
    return p;
  }

  // Where a character will stand when actions of the given pass resolve
  // (moves take effect at the end of the pass in which they land).
  function posAtPass(enc, id, pass) {
    let p = enc.pos[id];
    for (const d of enc.decls) if (d.actor === id && d.type === 'move' && !d.done && d.pass < pass) p = d.to;
    return p;
  }

  function isGrappled(c) {
    return c.status.grappledBy && c.status.grappledBy.length > 0;
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

  // Apply a weapon-handling declaration to a character (shared by planning and resolution).
  function handle(c, type) {
    if (type === 'drawSidearm') return takeInHand(c, c.sidearm);
    if (type === 'readyPrimary') return takeInHand(c, primaryWeaponId(c));
    if (type === 'pickUp') { const w = pickUpTarget(c); return w ? takeInHand(c, w) : null; }
    if (type === 'dropWeapon') return dropHeld(c);
    return null;
  }
  const HANDLING = ['drawSidearm', 'readyPrimary', 'pickUp', 'dropWeapon'];

  // Attack options as they will be once this character's declared weapon handling
  // (draw, drop, pick up) has resolved.
  function plannedAttackOptions(enc, c) {
    const keep = { wield: c.wield, dropped: c.status.dropped.slice() };
    for (const d of enc.decls) if (d.actor === c.id && !d.done && HANDLING.includes(d.type)) handle(c, d.type);
    const opts = C.attackOptions(c);
    c.wield = keep.wield;
    c.status.dropped = keep.dropped;
    return opts;
  }

  // The weapon state after declared handling, for deciding what can be declared next.
  function plannedHands(enc, c) {
    const keep = { wield: c.wield, dropped: c.status.dropped.slice() };
    for (const d of enc.decls) if (d.actor === c.id && !d.done && HANDLING.includes(d.type)) handle(c, d.type);
    const out = { wield: C.wieldedWeapon(c) ? c.wield : null, dropped: c.status.dropped.slice() };
    c.wield = keep.wield;
    c.status.dropped = keep.dropped;
    return out;
  }

  // Everything the current actor may declare now, for the UI — with what conditions forbid
  // (calmed, mesmerized, in a frenzy, afraid, blinded) marked unavailable.
  function legalActions(enc, chars, id) {
    const out = legalActionsRaw(enc, chars, id);
    const c = chars[id];
    if (!G.Conditions || !G.Conditions.list(c).length) return out;
    const no = (decl) => conditionForbids(enc, chars, c, decl);
    const mark = (o, decl) => { const f = no(decl); if (f) { o.affordable = false; o.why = f; } return !f; };
    for (const o of out.attacks) if (mark(o, { type: 'strike' })) for (const t of o.targets) if (no({ type: 'strike', target: t.id })) t.inReach = false;
    for (const o of out.defenses) mark(o, { type: o.type });
    for (const m of out.maneuvers) if (mark(m, { type: m.type })) for (const t of m.targets) if (no({ type: m.type, target: t.id })) t.inReach = false;
    for (const o of out.spells || []) if (mark(o, { type: 'cast', option: o })) for (const t of o.targets || []) if (no({ type: 'cast', option: o, target: t.id })) t.inReach = false;
    for (const o of out.readies || []) mark(o, { type: 'strike' });
    if (G.Conditions.has(c, 'mesmerized')) { out.move = null; for (const o of out.other) o.affordable = false; }
    return out;
  }

  function legalActionsRaw(enc, chars, id) {
    const c = chars[id];
    const ap = enc.ap[id] || 0;
    const left = passLeft(enc, id);
    // An action can be started with any AP left this pass; the rest comes out of later passes.
    const can = (cost) => cost <= ap && left >= CONFIG.minActionAP;
    const me = posAtPass(enc, id, enc.pass);
    const others = enc.ids.filter((o) => o !== id && !chars[o].status.dead);
    const out = { ap, passLeft: left, passCap: passCap(enc, id), pass: enc.pass, attacks: [], defenses: [], guards: [], maneuvers: [], other: [], move: null, incoming: [], incomingLater: [] };

    // Guards: ready a block, parry or dodge for the next attack, or the next from one attacker.
    for (const kind of DEFENSE_TYPES) {
      if (kind === 'offParry' && !C.offhandWeapon(c)) continue;
      const cost = C.actionCost(c, kind);
      const why = defenseUnavailable(c, kind, null, chars, enc);
      out.defenses.push({ type: kind, ap: cost.ap, stamina: cost.stamina, affordable: can(cost.ap) && !why, spans: cost.ap > left, why });
    }
    out.guardAgainst = others.filter((o) => chars[o].side !== c.side && C.isActive(chars[o]));
    out.readied = readiesUp(enc, id, enc.pass);
    out.guards = guardsUp(enc, id, enc.pass);
    // Attacks already declared at me: landing this pass, and slow ones landing later.
    out.incoming = incomingAttacks(enc, id).filter((d) => d.pass === enc.pass);
    out.incomingLater = incomingAttacks(enc, id).filter((d) => d.pass > enc.pass);

    const planned = plannedAttackOptions(enc, c);
    const spPlanned = enc.decls.filter((d) => d.actor === id && (d.type === 'strike' || d.type === 'cast') && d.option.spell).reduce((t, d) => t + d.option.spCost, 0);
    for (const opt of planned) {
      const why = attackUnavailable(enc, c, opt, spPlanned);
      out.attacks.push(Object.assign({}, opt, {
        affordable: can(opt.ap) && !why,
        spans: opt.ap > left,
        why,
        targets: others.map((o) => {
          const op = posAtPass(enc, o, enc.pass);
          const dd = dist(me, op);
          const line = G.Terrain && enc.tiles && dd >= 2 ? G.Terrain.lineCheck(enc, me, op, opt.ranged || opt.spell ? 'missile' : 'melee') : null;
          return { id: o, inReach: C.inRange(opt, dd) && !(line && line.blocked), tooClose: dd < (opt.minRange || 1), distance: dd, blockedBy: line && line.blocked ? line.by : null };
        }),
      }));
    }

    // Ready a thrust: hold the point; whoever steps closer into its reach this pass meets it.
    out.readies = [];
    if (CONFIG.readyStrike && !c.status.prone && !isGrappled(c) && !c.status.clinch) {
      for (const opt of planned) {
        if (!readyable(opt)) continue;
        const why = attackUnavailable(enc, c, opt, spPlanned);
        out.readies.push({ type: 'readyStrike', option: opt, name: `Ready ${opt.label.toLowerCase()}`, ap: opt.ap, stamina: opt.stamina, affordable: can(opt.ap) && !why, spans: opt.ap > left, why });
      }
    }

    // Spells cast at a square, a foe or an ally (bolts are among the attacks above).
    out.spells = [];
    if (G.Magic && C.handsBusy(c) < 2 && !c.status.pinned) {
      for (const opt of G.Magic.spellOptions(c)) {
        if (opt.kind !== 'cast') continue;
        if (isGrappled(c) && opt.spell.shape !== 'blink') continue; // held: only a blink gets you out
        const why = spellShort(c, opt, spPlanned);
        const targets = opt.target === 'square' ? null : enc.ids.filter((o) => {
          const t = chars[o];
          if (!t || t.status.dead) return false;
          // Restore reaches a friend turned by a mind spell, too (to free them).
          if (opt.target === 'ally') return t.side === c.side || (opt.spell.shape === 'restore' && t.charmed && t.charmed.side === c.side);
          return t.side !== c.side && C.isActive(t);
        }).map((o) => {
          const op = posAtPass(enc, o, enc.pass);
          const dd = dist(me, op);
          const line = G.Terrain && enc.tiles && dd >= 2 ? G.Terrain.lineCheck(enc, me, op, 'missile') : null;
          if (opt.spell.named) return { id: o, distance: dd, inReach: G.Magic.knowsName(c, chars[o]) };
          return { id: o, distance: dd, inReach: dd <= opt.maxRange && dd >= (opt.target === 'ally' ? 0 : opt.minRange) && !(line && line.blocked) };
        });
        out.spells.push(Object.assign({}, opt, { affordable: can(opt.ap) && !why, spans: opt.ap > left, why, targets }));
      }
    }

    const reach = CONFIG.range.maneuverMax;
    const grappled = isGrappled(c);
    const link = linkOf(c);
    out.grapple = link;
    const pushManeuver = (kind, targets) => {
      const cost = C.actionCost(c, kind);
      out.maneuvers.push({ type: kind, ap: cost.ap, stamina: cost.stamina, affordable: can(cost.ap) && targets.some((t) => t.inReach), spans: cost.ap > left, targets });
    };
    const near = (o) => ({ id: o, inReach: dist(me, posAtPass(enc, o, enc.pass)) <= reach });
    // Trips, disarms and shoves: free, or a trip or disarm from a clinch.
    if (!c.status.prone && !grappled && !c.status.grappling) {
      for (const kind of ['shove', 'trip', 'disarm']) {
        if (kind === 'shove' && link) continue;
        let r = reach;
        if (kind === 'trip' && hookWeapon(c)) r = WEAPONS[C.wieldedWeapon(c).type].reach;
        if (kind === 'shove') r = shoveReach(c);
        pushManeuver(kind, others.filter((o) => !chars[o].status.unconscious).map((o) => ({ id: o, inReach: dist(me, posAtPass(enc, o, enc.pass)) <= r })));
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
          const op = posAtPass(enc, o, enc.pass);
          const dd = dist(me, op);
          const sight = !(G.Terrain && enc.tiles && dd >= 2 && G.Terrain.lineCheck(enc, me, op, 'sight').blocked);
          return { id: o, inReach: dd <= r && sight, distance: dd };
        }));
      }
    }
    if (c.status.pinned) {
      // Pinned: only trying to break free.
      out.maneuvers = out.maneuvers.filter((m) => m.type === 'break');
      out.defenses.forEach((o) => { o.affordable = false; o.why = 'Pinned'; });
      return out;
    }

    // Moving: not while prone, held or clinched. A holder drags the held fighter one square.
    if (!c.status.prone && !grappled && !c.status.clinch && can(1) && (!G.Conditions || G.Conditions.canMove(c))) {
      const spa = C.squaresPerAP(c);
      const cost1 = C.actionCost(c, 'move', { ap: 1 });
      const drag = !!c.status.grappling;
      out.move = {
        squaresPerAP: spa, maxAP: ap, stamina: cost1.stamina, from: projectedPos(enc, id),
        maxSquares: drag ? 1 : Math.floor((ap * spa) / C.apScale()),
        passSquares: drag ? 1 : Math.floor((left * spa) / C.apScale()), // as far as it can go and still land this pass
        drag,
      };
    }

    const addOther = (type, extra) => {
      const cost = C.actionCost(c, type);
      out.other.push(Object.assign({ type, name: ACTIONS[type].name, ap: cost.ap, stamina: cost.stamina, affordable: can(cost.ap), spans: cost.ap > left }, extra || {}));
    };
    const declared = (type) => enc.decls.some((d) => d.actor === id && d.type === type);
    if (c.status.prone && !declared('standUp')) addOther('standUp');
    const hands = plannedHands(enc, c);
    const sidearm = c.weapons.find((w) => w.id === c.sidearm);
    const primary = primaryWeaponId(c);
    const heldW = hands.wield ? c.weapons.find((w) => w.id === hands.wield) : null;
    const dropNote = heldW && Items.weaponStats(heldW).weight !== 'very light' ? { note: `drops ${Items.itemName(heldW)}` } : {};
    if (sidearm && hands.wield !== c.sidearm && !hands.dropped.includes(c.sidearm)) addOther('drawSidearm', dropNote);
    if (primary && hands.wield !== primary && !hands.dropped.includes(primary)) addOther('readyPrimary', dropNote);
    if (hands.dropped.length && !declared('pickUp')) addOther('pickUp', dropNote);
    if (hands.wield) addOther('dropWeapon', { note: Items.itemName(heldW) });
    if (c.status.grappling && !declared('release')) addOther('release');
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
        const why = opt.spell ? spellShort(c, opt, spPlanned) : null;
        out.other.push({ type: 'windUp', option: opt, name: `Wind up: ${opt.label}`, ap: cost.ap, stamina: cost.stamina, affordable: can(cost.ap) && !why, spans: cost.ap > left, why });
      }
    }
    if (c.inventory.bandages > 0) {
      const patients = enc.ids.filter((o) => chars[o].bleeds.length > 0 && !chars[o].status.dead && (o === id || dist(me, posAtPass(enc, o, enc.pass)) <= 1));
      if (patients.length) addOther('bandage', { targets: patients.map((o) => ({ id: o, inReach: true })) });
    }
    return out;
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
    const w = c.weapons.find((x) => x.id !== c.sidearm);
    return w ? w.id : null;
  }

  function spellShort(c, opt, spPlanned) {
    return G.Magic && opt.spCost > G.Magic.availableSP(c) - (spPlanned || 0) ? 'Not enough spell points' : null;
  }

  // Why an attack can't be declared right now (beyond AP), or null.
  function attackUnavailable(enc, c, opt, spPlanned) {
    if (opt.windUp) {
      const w = c.status.windUp;
      const key = C.optionKey(opt);
      if (enc.decls.some((d) => d.actor === c.id && d.type === 'windUp' && C.optionKey(d.option) === key)) return 'Release next round';
      if (enc.decls.some((d) => d.actor === c.id && d.type === 'strike' && d.option.windUp && C.optionKey(d.option) === key)) return 'Already released';
      if (!w || w.key !== key) return 'Wind up first';
      if (w.round >= enc.round) return 'Release next round';
    }
    if (opt.ranged && opt.weaponId && !opt.natural && C.ammoLeft(c, opt) <= 0) return opt.arrowHead ? `No ${opt.arrowHead}s` : 'No arrows';
    if (opt.spell) return spellShort(c, opt, spPlanned);
    return null;
  }

  function hookWeapon(c) {
    const w = C.wieldedWeapon(c);
    return w && WEAPONS[w.type].hook && C.rank(c, 'hook');
  }

  function defenseUnavailable(c, kind, attackDecl, chars, enc) {
    if (c.status.pinned) return 'Pinned';
    const winding = c.status.windUp || (enc && enc.decls.some((d) => d.actor === c.id && d.type === 'windUp'));
    if (winding && (CONFIG.windUp.exposed || []).includes(kind)) return 'Winding up';
    const opt = attackDecl ? attackDecl.option : null;
    const parry = kind === 'parry' || kind === 'offParry';
    if (parry && opt && (opt.spell || (opt.ranged && !CONFIG.archery.parry))) return opt.spell ? "Can't parry a spell" : "Can't parry an arrow";
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
    return null;
  }

  // What a condition forbids this declaration (calmed, mesmerized, enraged, frightened, blind).
  function conditionForbids(enc, chars, c, decl) {
    if (!G.Conditions) return null;
    const F = (f) => G.Conditions.flag(c, f);
    if (G.Conditions.has(c, 'mesmerized') && decl.type !== 'endTurn' && decl.type !== 'concede') return 'Mesmerized';
    const attack = decl.type === 'strike' || (ATTACK_TYPES.includes(decl.type) && decl.type !== 'strike') || (decl.type === 'cast' && decl.option && decl.option.target === 'foe');
    if (attack && F('noAttack')) return 'Calmed: won\'t attack';
    if (DEFENSE_TYPES.includes(decl.type) && F('noGuard')) return 'In a frenzy: no guards';
    const fear = G.Conditions.get(c, 'frightened');
    if (fear && fear.src && chars[fear.src]) {
      if (attack && decl.target === fear.src) return 'Too afraid';
      if (decl.type === 'move' && dist(decl.to, projectedPos(enc, fear.src)) < dist(projectedPos(enc, c.id), projectedPos(enc, fear.src))) return 'Too afraid to close';
    }
    if (F('blind') && decl.type === 'strike' && decl.target && dist(projectedPos(enc, c.id), projectedPos(enc, decl.target)) > 1) return 'Blinded: only at arm\'s reach';
    return null;
  }

  // Validate and record a declaration. Returns an error string or null.
  function declare(enc, chars, decl) {
    const id = currentActor(enc);
    if (decl.actor !== id) return 'Not your turn';
    const c = chars[id];
    const forbid = conditionForbids(enc, chars, c, decl);
    if (forbid) return forbid;
    let ap, stamina;
    const defense = DEFENSE_TYPES.includes(decl.type);
    if (decl.type === 'strike') {
      const key = C.optionKey(decl.option);
      const opt = plannedAttackOptions(enc, c).find((o) => C.optionKey(o) === key);
      if (!opt) return 'Attack not available';
      const spPlanned = enc.decls.filter((d) => d.actor === id && (d.type === 'strike' || d.type === 'cast') && d.option.spell).reduce((t, d) => t + d.option.spCost, 0);
      const why = attackUnavailable(enc, c, opt, spPlanned);
      if (why) return why;
      decl.option = opt;
      ap = opt.ap;
      stamina = opt.stamina;
      if (!decl.target) return 'Choose a target';
    } else if (defense) {
      if (decl.against && (!chars[decl.against] || chars[decl.against].side === c.side)) return 'Guard against a foe';
      const why = defenseUnavailable(c, decl.type, null, chars, enc);
      if (why) return why;
      ({ ap, stamina } = C.actionCost(c, decl.type));
    } else if (decl.type === 'cast') {
      if (!G.Magic || !decl.option) return 'Choose a spell';
      const key = decl.option.spellKey;
      const opt = G.Magic.spellOptions(c).find((o) => o.kind === 'cast' && o.spellKey === key);
      if (!opt) return 'Spell not available';
      if (C.handsBusy(c) >= 2 || (isGrappled(c) && opt.spell.shape !== 'blink')) return 'Needs a free hand';
      const spPlanned = enc.decls.filter((d) => d.actor === id && (d.type === 'strike' || d.type === 'cast') && d.option.spell).reduce((t, d) => t + d.option.spCost, 0);
      const why = spellShort(c, opt, spPlanned);
      if (why) return why;
      if (opt.target === 'square') {
        if (!decl.at || !G.Terrain.inGrid(enc, decl.at.x, decl.at.y)) return 'Choose a square';
        const dd = dist(projectedPos(enc, id), decl.at);
        if (dd > opt.maxRange || dd < opt.minRange) return 'Out of range';
      } else if (!decl.target || !chars[decl.target]) return 'Choose a target';
      decl.option = opt;
      ap = opt.ap;
      stamina = 0;
    } else if (decl.type === 'readyStrike') {
      if (!CONFIG.readyStrike) return 'Unknown action';
      if (!decl.option) return 'Choose a thrust to ready';
      if (decl.against && (!chars[decl.against] || chars[decl.against].side === c.side)) return 'Ready it against a foe';
      const key = C.optionKey(decl.option);
      const opt = plannedAttackOptions(enc, c).find((o) => C.optionKey(o) === key && readyable(o));
      if (!opt) return 'Nothing to ready';
      if (c.status.prone || isGrappled(c) || c.status.clinch) return 'Not from here';
      decl.option = opt;
      // AP now; the stamina only if the thrust is made.
      ap = opt.ap;
      stamina = opt.stamina;
    } else if (decl.type === 'windUp') {
      if (!decl.option) return 'Choose what to wind up';
      const key = C.optionKey(decl.option);
      const opt = plannedAttackOptions(enc, c).find((o) => C.optionKey(o) === key && o.windUp);
      if (!opt) return 'Nothing to wind up';
      if (!canWindUp(enc, c)) return 'Already winding up';
      decl.option = opt;
      ({ ap, stamina } = C.actionCost(c, 'windUp', { option: opt }));
    } else if (decl.type === 'move') {
      const from = projectedPos(enc, id);
      const d = dist(from, decl.to);
      if (d === 0) return 'Pick a different square';
      // Walls are walked around; rough ground, brambles and climbing out of a pit cost extra.
      let squares = d;
      if (G.Terrain && enc.tiles) {
        if (!G.Terrain.passable(enc, decl.to.x, decl.to.y)) return 'A wall stands there';
        const pc = G.Terrain.pathCost(enc, from, decl.to, c);
        if (!pc.reaches) return 'No way through';
        squares = pc.cost;
      }
      const need = C.moveCost(c, squares);
      ({ ap, stamina } = C.actionCost(c, 'move', { ap: need }));
      decl.from = from;
    } else {
      if (!ACTIONS[decl.type]) return 'Unknown action';
      ({ ap, stamina } = C.actionCost(c, decl.type));
      if (['trip', 'disarm', 'shove', 'bandage', 'bait', 'readIntent'].concat(GRAPPLE_STEPS).includes(decl.type) && !decl.target) return 'Choose a target';
      if (GRAPPLE_STEPS.includes(decl.type)) {
        const m = legalActions(enc, chars, id).maneuvers.find((x) => x.type === decl.type);
        if (!m || !m.targets.some((t) => t.id === decl.target)) return 'Not possible from here';
      }
    }
    if (ap > enc.ap[id]) return 'Not enough AP';
    if (passLeft(enc, id) < CONFIG.minActionAP) return 'No AP left this pass';
    decl.ap = ap;
    decl.stamina = stamina;
    decl.declaredPass = enc.pass;
    const lands = payAP(enc, id, ap);
    // A guard is up at once (any AP over the cap is owed from later passes); everything
    // else lands when fully paid, unless CONFIG.spanLands says it lands now.
    decl.pass = defense || decl.type === 'readyStrike' || CONFIG.spanLands === 'now' ? enc.pass : lands;
    decl.n = ++enc.seq;
    if (decl.target) decl.targetWasDown = !C.isActive(chars[decl.target]);
    enc.decls.push(decl);
    if (passLeft(enc, id) < CONFIG.minActionAP) advance(enc);
    return null;
  }

  // How a declaration looks to a given viewer (Feint vs Read Attack).
  function describeDecl(enc, chars, d, viewerId) {
    const r = describeBare(enc, chars, d, viewerId);
    if (d.declaredPass != null && d.pass > d.declaredPass) r.text += ` — lands pass ${d.pass}`;
    return r;
  }

  function describeBare(enc, chars, d, viewerId) {
    const a = chars[d.actor];
    const t = d.target ? chars[d.target] : null;
    const tn = t ? t.name : '';
    if (d.type === 'strike') {
      const hidden = viewerId !== d.actor && C.rank(a, 'feint') > (viewerId ? C.rank(chars[viewerId], 'read_attack') : 0);
      if (hidden) return { text: `${a.name}: strike at ${tn}`, hidden: true };
      const w = d.option.weaponId ? a.weapons.find((x) => x.id === d.option.weaponId) : null;
      return { text: `${a.name}: ${d.option.label}${w ? ' — ' + Items.itemName(w) : ''} at ${tn} [${d.ap} AP]` };
    }
    if (DEFENSE_TYPES.includes(d.type)) {
      const vs = d.against && chars[d.against] ? `${chars[d.against].name}'s next attack` : 'the next attack';
      return { text: `${a.name}: ready to ${d.type} ${vs} [${d.ap} AP]` };
    }
    if (d.type === 'readyStrike') {
      const vs = d.against && chars[d.against] ? chars[d.against].name : 'anyone';
      return { text: `${a.name}: holds a ${d.option.label.toLowerCase()} ready for ${vs} who comes closer [${d.ap} AP]` };
    }
    if (d.type === 'move') return { text: `${a.name}: move to (${d.to.x + 1}, ${d.to.y + 1}) [${d.ap} AP]` };
    if (d.type === 'windUp') return { text: `${a.name}: winds up ${d.option.label} [${d.ap} AP]` };
    if (d.type === 'cast') return { text: `${a.name}: casts ${d.option.label} ${d.at ? `at (${d.at.x + 1}, ${d.at.y + 1})` : `on ${tn}`} [${d.ap} AP]` };
    return { text: `${a.name}: ${ACTIONS[d.type].name.toLowerCase()}${tn ? ' ' + tn : ''} [${d.ap} AP]` };
  }

  // ---- Damage pipeline ---------------------------------------------------
  // Pure: works out what a hit would do (before d4 hit-location rolls).
  function computeHit(attacker, target, option, flags) {
    flags = flags || {};
    if (option.spell && CONFIG.magic.energyMitigation && CONFIG.magic.energyMitigation[option.spell.element] != null) return computeFire(attacker, target, option, flags);
    if (option.spell && option.spell.element === 'life') return computeLife(attacker, target, option, flags);
    const v = option.damage.slice();
    const st = target.status;
    const prone = st.prone;
    const pinned = !!st.pinned;
    // Cramped: inside the weapon's reach, or wielding a weapon while held in a grapple. Under the
    // 'blunt' rule the blow lands as a fraction of its force, all blunt (pommel, haft, guard).
    const cramped = (flags.distance === 1 && option.closePenalty) ||
      (CONFIG.grappledWeaponsCramped && option.weaponId && !option.ranged && isGrappled(attacker));
    if (cramped) {
      if (CONFIG.range.closeRule === 'blunt') {
        const total = v[0] + v[1] + v[2];
        v[0] = 0; v[1] = 0; v[2] = Math.floor(total * CONFIG.range.closeMult);
      } else for (let i = 0; i < 3; i++) v[i] = Math.floor(v[i] * CONFIG.range.closeMult);
    }
    if (option.ranged && option.longRange && flags.distance > option.longRange) v[C.mainIndex(v)] = Math.max(0, v[C.mainIndex(v)] - CONFIG.range.longRangePenalty);
    if (prone) v[C.mainIndex(v)] += CONFIG.maneuver.proneDamageBonus;
    if (flags.pack) v[C.mainIndex(v)] += flags.pack; // pack hunters: allies at the target's side
    if (flags.half) for (let i = 0; i < 3; i++) v[i] = Math.floor(v[i] / 2);
    // Resistances (monster trait): multipliers on piercing, slashing and blunt, e.g. a skeleton
    // takes no piercing and half slashing; only blunt breaks bones cleanly.
    const resist = target.traits && target.traits.resist;
    if (resist) ['P', 'S', 'B'].forEach((k, i) => { if (resist[k] != null) v[i] = Math.floor(v[i] * resist[k]); });
    // Stoneskin, barkskin, a shield of force: protection that isn't armor.
    if (G.Conditions) ['P', 'S', 'B'].forEach((k, i) => { v[i] = Math.max(0, v[i] - G.Conditions.mitigation(target, k)); });
    const [P, S, B] = v;
    const motion = option.motion === 'unarmed' ? 'swing' : option.motion;
    const res = { vec: v, P, S, B, armored: false, toCON: 0, slashToAttrs: 0, bluntToStamina: 0, bluntToCON: 0, converted: 0, durLoss: 0, mitigated: { P: 0, S: 0, B: 0 } };

    const unconscious = target.stamina <= 0;
    const weapon = option.weaponType ? WEAPONS[option.weaponType] : null;
    const coupDeGrace = weapon && option.weaponType === 'dagger' && C.rank(attacker, 'coup_de_grace') && (prone || pinned);
    const ai = C.armorInfo(target);
    const armored = target.armor && target.armor.durability > 0 && !unconscious && !coupDeGrace;

    if (armored) {
      res.armored = true;
      const mit = Object.assign({}, ai.effMit);
      // Arrows: armor (textile most) catches a shaft better than a thrust; broadheads are stopped
      // by metal, bodkins slip through it.
      if (option.arrowHead) {
        const A = CONFIG.archery;
        const hd = A.heads[option.arrowHead];
        const type = ai.type;
        mit.P = Math.max(0, mit.P + ((A.vsArrows || {})[type] || 0) + ((A.metalArmor || []).includes(type) ? hd.metalMit : 0));
      }
      let ignoreB = 0;
      if (weapon && weapon.bluntMitigationIgnore) ignoreB += weapon.bluntMitigationIgnore;
      if (C.rank(attacker, 'crushing_blow')) ignoreB += 2;
      mit.B = Math.max(0, mit.B - ignoreB);
      const Pr = Math.max(0, P - mit.P);
      const Sr = Math.max(0, S - mit.S);
      const Br = Math.max(0, B - mit.B);
      res.mitigated = { P: P - Pr, S: S - Sr, B: B - Br };
      let pass = ai.passThrough;
      if (C.rank(attacker, 'find_the_gap')) pass += 0.25;
      if (C.rank(attacker, 'spot_weakness')) pass += 0.25;
      if (option.halfSword || prone || pinned) pass = CONFIG.maneuver.pronePassThrough;
      pass = Math.min(1, pass);
      res.pierceLeft = Pr;
      res.pass = pass;
      // 'floor': piercing that only barely beats the armor does not reach CON.
      // 'roll': toCON here is the expectation; applyHit rolls each point.
      res.toCON = CONFIG.pierceMode === 'roll' && pass < 1 ? Pr * pass : Math.floor(Pr * pass);
      res.converted = Math.round(Sr * (CONFIG.conversion[motion] || 0));
      res.bluntToStamina = Br + res.converted;
      res.durLoss = target.armor.type === 'padded' ? 0 : Math.round((B + res.converted) * (CONFIG.armorWearScale == null ? 1 : CONFIG.armorWearScale));
    } else {
      res.toCON = P;
      res.slashToAttrs = S;
      if (unconscious) res.bluntToCON = B;
      else res.bluntToStamina = B;
    }
    // Tireless creatures have no stamina to absorb a blow: blunt goes to the body (CON), and
    // they neither bleed nor take venom.
    if (C.tireless(target)) {
      res.bluntToCON += res.bluntToStamina;
      res.bluntToStamina = 0;
      res.noBleed = true;
    } else if (target.traits && target.traits.noBleed) res.noBleed = true;
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
        const t = target.armor.type;
        guard = Math.min(1, (V.armor[t] != null ? V.armor[t] : V.otherArmor) * (V.coverage[target.armor.coverage] || 1));
      }
      if (w.kind === 'S') res.cutVital = w.vital * guard;
      else res.pierceVital = w.vital * guard;
    }
    return res;
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
    const res = { vec: [0, 0, 0], P: 0, S: 0, B: 0, fire: mag, armored: false, toCON: 0, slashToAttrs: 0, bluntToStamina: 0, bluntToCON: 0, converted: 0, durLoss: 0, mitigated: { P: 0, S: 0, B: 0 }, noBleed: true, pierceVital: 0, cutVital: 0, bleedFactor: 1, bleedRounds: CONFIG.bleedRounds };
    const unconscious = target.stamina <= 0;
    let left = mag;
    const el = option.spell.element;
    const share = M.energyMitigation ? M.energyMitigation[el] : M.fireMitigation;
    // Lightning runs straight through metal armor.
    const conducts = el === 'lightning' && target.armor && (CONFIG.archery.metalArmor || []).includes(target.armor.type);
    if (target.armor && target.armor.durability > 0 && !conducts) {
      const stop = Math.round(C.armorInfo(target).effMit.B * (share == null ? M.fireMitigation : share));
      left = Math.max(0, mag - stop);
      res.fireStopped = mag - left;
    }
    // Light and spirit sear the undead; spirit only chills the living (half, to stamina).
    const bane = (M.undeadBane || {})[el];
    if (bane && target.traits && target.traits.undead) left *= bane;
    if (el === 'spirit' && !(target.traits && target.traits.undead)) {
      res.bluntToStamina = Math.floor(left / 2);
      return res;
    }
    if (el === 'shadow' && G.Conditions && G.Conditions.flag(target, 'halveShadow')) left = Math.floor(left / 2);
    if (unconscious) res.toCON = left;
    else {
      res.toCON = Math.floor(left / M.fireConPer);
      res.bluntToStamina = left - res.toCON;
    }
    return res;
  }

  // Life withers the living body: half its magnitude to CON, no armor stops it. The tireless
  // (undead, constructs) have no life to wither.
  function computeLife(attacker, target, option, flags) {
    let mag = option.spell.magnitude;
    if (flags.half) mag = Math.floor(mag / 2);
    const res = { vec: [0, 0, 0], P: 0, S: 0, B: 0, armored: false, toCON: 0, slashToAttrs: 0, bluntToStamina: 0, bluntToCON: 0, converted: 0, durLoss: 0, mitigated: { P: 0, S: 0, B: 0 }, noBleed: true, pierceVital: 0, cutVital: 0, bleedFactor: 1, bleedRounds: CONFIG.bleedRounds };
    if (!C.tireless(target)) res.toCON = Math.floor(mag / 2);
    return res;
  }

  // Apply a hit, rolling d4s for slashing. Returns a short description.
  async function applyHit(enc, chars, attacker, target, option, roller, flags) {
    const h = computeHit(attacker, target, option, flags);
    const parts = [];
    const st = target.status;
    const before = enc.onHit ? { dmg: C.totalDamage(target), stamina: target.stamina, up: C.isActive(target) } : null;

    if (h.fire != null && h.fireStopped) parts.push(`armor stops ${h.fireStopped} ${option.spell ? option.spell.element : 'fire'}`);
    if (h.armored && target.armor) {
      const before = target.armor.durability;
      target.armor.durability = Math.max(0, before - h.durLoss);
      if (h.mitigated.P + h.mitigated.S + h.mitigated.B > 0) parts.push(`armor stops ${h.mitigated.P}/${h.mitigated.S}/${h.mitigated.B}`);
      if (h.converted) parts.push(`${h.converted} slashing → blunt`);
      if (h.durLoss) parts.push(`armor durability −${h.durLoss}`);
    }

    let wound = 0;
    if (h.armored && CONFIG.pierceMode === 'roll' && h.pierceLeft > 0 && h.pass < 1) {
      const need = Math.round(h.pass * 10);
      const rolls = await roller({ actorId: attacker.id, sides: 10, count: h.pierceLeft, label: 'Piercing through armor', detail: `${h.pierceLeft}d10 vs ${target.name}'s armor: each ${need} or less reaches CON` });
      h.toCON = rolls.filter((r) => r <= need).length;
    }
    let pierced = 0, vital = false, cutVital = false;
    if (h.toCON > 0) {
      C.damageAttr(target, 'CON', h.toCON);
      parts.push(`${h.toCON} CON`);
      wound += h.toCON;
      pierced = h.toCON;
      const need = vitalNeed(h.pierceVital);
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
    if (h.slashToAttrs > 0) {
      const rolls = await roller({ actorId: attacker.id, sides: 4, count: h.slashToAttrs, label: 'Slashing hit locations', detail: `${h.slashToAttrs}d4 on ${target.name}: 1 STR, 2 CON, 3 SPD, 4 DEX` });
      const tally = {};
      for (const r of rolls) {
        const a = CONFIG.slashAttributeTable[r];
        tally[a] = (tally[a] || 0) + 1;
        C.damageAttr(target, a, 1);
      }
      parts.push(Object.keys(tally).map((a) => `${tally[a]} ${a}`).join(', '));
      wound += h.slashToAttrs;
      const need = vitalNeed(h.cutVital);
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
    if (option.venom && wound > 0 && !h.noBleed) {
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
      target.bleeds = target.bleeds.filter((b) => b.remaining > 0);
      parts.push('bleeding');
    }
    // A blow that hurts wakes the mesmerized and ends a calm.
    const harmed = h.toCON + h.slashToAttrs + h.bluntToCON + h.bluntToStamina > 0;
    if (harmed && G.Conditions) for (const x of G.Conditions.list(target).slice()) {
      if ((CONFIG.conditions[x.key] || {}).breakOnHarm) { G.Conditions.remove(target, x.key); parts.push(`${CONFIG.conditions[x.key].name.toLowerCase()} no more`); }
    }
    if (!parts.length) parts.push('no effect');
    const wasDown = st.unconscious;
    C.updateCondition(target);
    let tail = '';
    if (st.dead) tail = ` ${target.name} is DEAD.`;
    else if (st.unconscious && !wasDown) tail = ` ${target.name} collapses, unconscious.`;
    // Sims attach enc.onHit to credit harm and knockdowns to whoever dealt them.
    if (before) enc.onHit({ attacker, target, attrs: C.totalDamage(target) - before.dmg, stamina: Math.max(0, before.stamina - target.stamina), downed: before.up && !C.isActive(target), spell: !!option.spell });
    return { text: `${h.P}/${h.S}/${h.B} P/S/B → ${parts.join(', ')}.${tail}`, hit: h };
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

  function defenseNumbers(defender, kind, motion, attacker, atkOption) {
    const r = defenseNumbersBase(defender, kind, motion, attacker, atkOption);
    const m = intentMods(defender, attacker);
    r.bonus += m.def;
    if (r.opposed) r.attack += m.atk;
    else r.tn += m.atk;
    return r;
  }

  function defenseNumbersBase(defender, kind, motion, attacker, atkOption) {
    const D = CONFIG.defense;
    if (kind === 'block') {
      let tn = D.block.tn;
      const bySize = D.block.tnBySize;
      if (bySize && defender.shield && bySize[defender.shield.size] != null) tn = bySize[defender.shield.size];
      return { bonus: C.rank(defender, 'shield_training'), tn };
    }
    const parry = kind === 'parry' || kind === 'offParry';
    if (D.opposed) {
      const agile = Math.floor((C.combatAttr(defender, 'DEX') + C.combatAttr(defender, 'SPD')) / 4);
      let bonus = agile + (parry ? C.rank(defender, 'parry_training') : C.rank(defender, 'dodge_training') + ((defender.traits && defender.traits.nimble) || 0));
      if (kind === 'offParry') bonus += D.offhandBonus || 0;
      let atk = D.motionPenalty[motion] || 0;
      atk += attacker ? Math.floor((C.attr(attacker, 'STR') + C.combatAttr(attacker, 'SPD')) / 4) : D.typicalAttacker;
      if (parry && atkOption && atkOption.weaponType) {
        const order = CONFIG.weightOrder;
        const theirs = order.indexOf(Items.weaponStats(atkOption.weaponType).weight);
        const mine = parryingWeapon(defender, kind);
        const gap = theirs - (mine ? order.indexOf(Items.weaponStats(mine).weight) : 0);
        atk += Math.max(0, gap);
      }
      return { bonus, attack: atk, opposed: true };
    }
    let bonus = 0, tn = D[parry ? 'parry' : kind].tn;
    if (parry) {
      bonus = C.rank(defender, 'parry_training') + half(C.combatAttr(defender, 'DEX'));
      tn += D.motionPenalty[motion] || 0;
    } else {
      bonus = C.rank(defender, 'dodge_training') + half(C.combatAttr(defender, 'SPD')) - C.armorInfo(defender).dex + ((defender.traits && defender.traits.nimble) || 0);
      tn += D.motionPenalty[motion] || 0;
    }
    return { bonus, tn };
  }

  // The weapon a parry is made with.
  function parryingWeapon(c, kind) {
    return kind === 'offParry' ? C.offhandWeapon(c) : C.wieldedWeapon(c);
  }

  // Chance a defense succeeds (the attacker's numbers when known).
  function defenseOdds(defender, kind, motion, attacker, atkOption) {
    const n = defenseNumbers(defender, kind, motion, attacker, atkOption);
    if (n.opposed) return opposedOdds(n.bonus, n.attack, 0);
    const die = CONFIG.defense.die;
    return Math.max(0, Math.min(1, (die - (n.tn - n.bonus) + 1) / die));
  }

  async function defenseCheck(enc, chars, defender, kind, atkDecl, roller) {
    const D = CONFIG.defense;
    const motion = atkDecl.type === 'strike' ? atkDecl.option.motion : 'maneuver';
    const attacker = chars[atkDecl.actor];
    const n = defenseNumbers(defender, kind, motion, attacker, atkDecl.type === 'strike' ? atkDecl.option : null);
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
    return Math.floor(C.attr(c, 'STR') / 2) + (M.armorStability[c.armor ? c.armor.type : 'none'] || 0) + (C.rank(c, 'iron_stance') ? M.ironStanceBonus : 0);
  }

  // Chance that an opposed d10 roll wins by at least `margin`.
  function opposedOdds(aBonus, bBonus, margin) {
    const die = CONFIG.maneuver.die;
    let wins = 0;
    for (let a = 1; a <= die; a++) for (let b = 1; b <= die; b++) if (a + aBonus - (b + bBonus) >= margin) wins++;
    return wins / (die * die);
  }

  function knockdownOdds(atk, tgt, featBonus, margin) {
    return opposedOdds(Math.floor(C.attr(atk, 'STR') / 2) + featBonus, stability(tgt), margin);
  }

  function shoveOdds(a, t) {
    const w = C.wieldedWeapon(a);
    const aB = Math.floor(C.attr(a, 'STR') / 2) + (w && WEAPONS[w.type].hands === 2 ? CONFIG.shove.twoHandBonus : 0);
    return opposedOdds(aB, stability(t), 1);
  }

  async function knockdownCheck(roller, atk, tgt, featBonus, label) {
    const aB = Math.floor(C.attr(atk, 'STR') / 2) + featBonus;
    return opposed(roller, atk, aB, label, tgt, stability(tgt), 'Keep footing');
  }

  // ---- Grappling ladder -----------------------------------------------------
  // State lives on both fighters: a clinch is status.clinch on each; a hold is the holder's
  // status.grappling and the held fighter's status.grappledBy; a pin adds status.pinned.
  function linkOf(c) {
    const st = c.status;
    if (st.clinch) return { partner: st.clinch, level: 'clinch', role: 'mutual' };
    if (st.grappling) return { partner: st.grappling, level: st.grappling && st.grapplingPin ? 'pin' : 'hold', role: 'holder' };
    if (st.grappledBy && st.grappledBy.length) return { partner: st.grappledBy[0], level: st.pinned ? 'pin' : 'hold', role: 'held' };
    return null;
  }

  // Set the grapple between a and b. level: null (free), 'clinch', 'hold' or 'pin'; for a hold
  // or pin, a is the holder.
  function setGrapple(chars, a, b, level) {
    for (const c of [a, b]) {
      const L = linkOf(c);
      if (L && chars[L.partner] && ![a.id, b.id].includes(L.partner)) clearGrapple(chars, c);
    }
    for (const [x, y] of [[a, b], [b, a]]) {
      x.status.clinch = null;
      if (x.status.grappling === y.id) { x.status.grappling = null; x.status.grapplingPin = false; }
      x.status.grappledBy = x.status.grappledBy.filter((g) => g !== y.id);
      x.status.pinned = false;
    }
    if (level === 'clinch') { a.status.clinch = b.id; b.status.clinch = a.id; }
    if (level === 'hold' || level === 'pin') {
      a.status.grappling = b.id;
      b.status.grappledBy = [a.id];
      if (level === 'pin') { b.status.pinned = true; a.status.grapplingPin = true; }
    }
  }

  function clearGrapple(chars, c) {
    const L = linkOf(c);
    if (L && chars[L.partner]) setGrapple(chars, c, chars[L.partner], null);
    c.status.clinch = null; c.status.grappling = null; c.status.grappledBy = []; c.status.pinned = false; c.status.grapplingPin = false;
  }
  const releaseGrapples = clearGrapple;

  // d10 + this for clinching, grappling, pinning and throwing.
  function grappleScore(c) {
    return Math.floor(C.attr(c, 'STR') / 2) + C.rank(c, 'grappler');
  }

  // d10 + this for breaking a clinch, hold or pin.
  function breakScore(c) {
    return Math.floor(Math.max(C.attr(c, 'STR'), C.combatAttr(c, 'DEX')) / 2) + (C.rank(c, 'escape_artist') ? CONFIG.maneuver.escapeArtistBonus : 0) + slippery(c);
  }

  // Monster trait: slick-skinned creatures (frogloks) are hard to get a grip on.
  function slippery(c) {
    return (c.traits && c.traits.slippery) || 0;
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
      if (o.margin > 0) { setGrapple(chars, a, t, 'pin'); return log(enc, `${a.name} pins ${t.name} ${show(o)}.`, 'hit'); }
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
      const free = nx >= 0 && ny >= 0 && nx < enc.grid.w && ny < enc.grid.h && !enc.ids.some((id) => id !== t.id && C.isActive(chars[id]) && enc.pos[id].x === nx && enc.pos[id].y === ny);
      if (free) enc.pos[t.id] = { x: nx, y: ny };
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
      const holderBonus = L.level === 'pin' && C.rank(t, 'pin') ? G2.pinBonus : 0;
      const o = await opposed(roller, a, breakScore(a), 'Break free', t, grappleScore(t) + holderBonus, 'Hold on');
      if (o.margin <= 0) return log(enc, `${a.name} can't break ${t.name}'s grip ${show(o)}.`, 'fail');
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
  async function resolvePass(enc, chars, roller) {
    enc.phase = 'resolving';
    const p = enc.pass;
    const rank = (id) => enc.order.indexOf(id);
    const actsThisPass = enc.decls
      .filter((d) => d.pass === p && !d.done && !HELD_TYPES.includes(d.type))
      .sort((x, y) => rank(x.actor) - rank(y.actor) || x.n - y.n);
    if (actsThisPass.length) {
      log(enc, `Pass ${p}`, 'pass');
      const activeAtStart = {};
      enc.ids.forEach((id) => (activeAtStart[id] = C.isActive(chars[id])));
      const posAtStart = JSON.parse(JSON.stringify(enc.pos));
      const moves = [];
      for (const d of actsThisPass) {
        const a = chars[d.actor];
        if (!activeAtStart[d.actor]) {
          log(enc, `${a.name} is down and cannot act (${describeDecl(enc, chars, d, d.actor).text.replace(a.name + ': ', '')}).`, 'fizzle');
          continue;
        }
        if (d.type === 'move') {
          moves.push(d);
          continue;
        }
        await resolveAction(enc, chars, d, roller, posAtStart);
      }
      // Moves resolve after the pass's other actions; ties go to higher initiative.
      const claimed = {};
      for (const d of moves) {
        const a = chars[d.actor];
        if (a.status.prone || isGrappled(a) || a.status.clinch) {
          log(enc, `${a.name} can't move (${a.status.prone ? 'prone' : 'grappled'}).`, 'fizzle');
          continue;
        }
        // A holder drags the held fighter one square, into the square the holder leaves.
        const dragged = a.status.grappling ? chars[a.status.grappling] : null;
        if (dragged && dist(enc.pos[a.id], d.to) > 1) {
          log(enc, `${a.name} can only drag ${dragged.name} one square.`, 'fizzle');
          continue;
        }
        const key = d.to.x + ',' + d.to.y;
        // Moves are in initiative order, so an earlier mover already holds the square.
        const occupied = enc.ids.some((o) => o !== d.actor && C.isActive(chars[o]) && enc.pos[o].x === d.to.x && enc.pos[o].y === d.to.y);
        if (claimed[key] || occupied) {
          log(enc, `${a.name}'s move is blocked.`, 'fizzle');
          continue;
        }
        if (!C.isActive(a)) continue;
        if ((enc.disrupted || {})[a.id]) {
          log(enc, `${a.name} is driven back and can't press on.`, 'fizzle');
          continue;
        }
        if (!payStamina(enc, a, d.stamina)) continue;
        claimed[key] = d.actor;
        if (dragged) {
          // Readied points: stepping closer into one meets it first; a hit stops the advance.
          if (await stopThrusts(enc, chars, a, d.to, roller)) continue;
          const left = enc.pos[d.actor];
          enc.pos[d.actor] = { x: d.to.x, y: d.to.y };
          enc.pos[dragged.id] = { x: left.x, y: left.y };
          log(enc, `${a.name} drags ${dragged.name} to (${d.to.x + 1}, ${d.to.y + 1}).`);
          continue;
        }
        // Square by square: around walls, past allies (not foes), into readied points, runes,
        // pits and hazards, any of which can end the move early.
        const steps = G.Terrain ? G.Terrain.path(enc, enc.pos[a.id], d.to, a) : [d.to];
        let moved = false, why = '';
        for (const q of steps) {
          if (await stopThrusts(enc, chars, a, q, roller)) { why = 'stopped'; break; }
          if (enc.ids.some((o) => o !== a.id && chars[o].side !== a.side && C.isActive(chars[o]) && enc.pos[o].x === q.x && enc.pos[o].y === q.y)) { why = 'blocked'; break; }
          enc.pos[a.id] = { x: q.x, y: q.y };
          moved = true;
          if (G.Terrain && enc.tiles && (await G.Terrain.enter(enc, chars, a, q.x, q.y, roller, (t) => log(enc, t, 'hit')))) { why = 'stops'; break; }
        }
        const at = enc.pos[a.id];
        if (moved) log(enc, `${a.name} moves to (${at.x + 1}, ${at.y + 1})${at.x !== d.to.x || at.y !== d.to.y ? ' and gets no farther' : ''}.`);
        else if (why === 'blocked') log(enc, `${a.name}'s way is blocked.`, 'fizzle');
      }
    }
    for (const d of enc.decls) if (d.pass === p) d.done = true;
    settleGrapples(enc, chars);

    // Another pass while anything is still on its way or anyone can still act. A pass in
    // which nobody started or landed anything (everyone waited) ends the round.
    const pending = enc.decls.some((d) => !d.done);
    const started = enc.decls.some((d) => d.declaredPass === p && !HELD_TYPES.includes(d.type));
    const sides = {};
    for (const id of enc.ids) if (C.isActive(chars[id])) sides[chars[id].side] = true;
    for (const id of enc.order) if (!C.isActive(chars[id])) enc.conceded[id] = true;
    const canAct = enc.order.some((id) => !enc.conceded[id] && (enc.ap[id] || 0) >= CONFIG.minActionAP);
    if (Object.keys(sides).length > 1 && (pending || (canAct && (started || actsThisPass.length)))) startPass(enc, chars);
    else {
      // Standing in a hazard hurts; fire burns what burns; terrain ticks down; conjured
      // creatures fade.
      if (G.Terrain && enc.tiles) await G.Terrain.endRound(enc, chars, roller, (t) => log(enc, t, 'hit'));
      if (G.Magic && G.Magic.endRound) for (const line of G.Magic.endRound(enc, chars)) log(enc, line, 'pass');
      endRound(enc, chars);
    }
  }

  // Resolve passes until someone has to decide something (or the round ends).
  async function resolveRound(enc, chars, roller) {
    while (enc.phase === 'resolve') await resolvePass(enc, chars, roller);
  }

  function payStamina(enc, c, cost) {
    if (!cost || C.tireless(c)) return true;
    const ok = CONFIG.exertionCanKnockOut ? c.stamina >= cost : c.stamina > cost;
    if (!ok) {
      log(enc, `${c.name} is too exhausted (needs ${cost} stamina, has ${c.stamina}); the action fails.`, 'fizzle');
      return false;
    }
    c.stamina -= cost;
    C.updateCondition(c);
    return true;
  }

  async function resolveAction(enc, chars, d, roller, posAtStart) {
    const a = chars[d.actor];
    const t = d.target ? chars[d.target] : null;

    if (ATTACK_TYPES.includes(d.type)) {
      if (!t) return;
      if (!d.targetWasDown && !C.isActive(t)) {
        log(enc, `${a.name}'s ${d.type === 'strike' ? d.option.label : d.type} fizzles — ${t.name} is already down.`, 'fizzle');
        return;
      }
      let band = { minRange: 1, maxRange: CONFIG.range.maneuverMax };
      if (d.type === 'strike') band = d.option;
      if (d.type === 'shove') band = { minRange: 1, maxRange: shoveReach(a) };
      if (d.type === 'trip' && hookWeapon(a)) band = { minRange: 1, maxRange: WEAPONS[C.wieldedWeapon(a).type].reach };
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
      if (!payStamina(enc, a, d.stamina)) return;
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

      // The target's guard meets it: one aimed at this attacker first, then a general one.
      // A guard that can't meet this attack (a parry against an arrow) stays up for the next.
      const name = d.type === 'strike' ? d.option.label : ACTIONS[d.type].name;
      // Displacement (monster trait): the target isn't quite where it appears to be.
      const disp = d.type === 'strike' && t.traits && t.traits.displacement;
      if (disp) {
        const chance = d.option.ranged || d.option.spell ? disp.ranged : disp.melee;
        const r = await rollDie(roller, a.id, 10, `${a.name}: Find the real ${t.name}`, `d10: ${Math.round(chance * 10)} or less strikes only an illusion`);
        if (r <= Math.round(chance * 10)) return log(enc, `${a.name}'s ${name} passes through an illusion of ${t.name}.`, 'defend');
      }
      let failedDodge = false;
      if (C.isActive(t)) {
        const guard = guardsUp(enc, t.id, d.pass)
          .filter((x) => (!x.against || x.against === d.actor) && !defenseUnavailable(t, x.type, d, chars, enc))
          .sort((x, y) => (y.against === d.actor) - (x.against === d.actor) || x.n - y.n)[0];
        const defs = [];
        if (guard) {
          const untouchable = guard.type === 'dodge' && C.rank(t, 'untouchable');
          if (!untouchable) guard.used = true; // Untouchable: one dodge meets every attack that pass
          defs.push(Object.assign({}, guard, { untouchable: untouchable && guard.paid }));
          guard.paid = true;
        }
        for (const def of defs) {
          if (!def.untouchable && !payStamina(enc, t, def.stamina)) continue;
          const chk = await defenseCheck(enc, chars, t, def.type, d, roller);
          if (chk.ok) {
            if (def.type === 'block') {
              await shieldAbsorb(enc, chars, a, t, d, roller);
            } else {
              const verb = { parry: 'parries', offParry: 'catches on the parrying dagger', dodge: 'dodges' }[def.type];
              log(enc, `${t.name} ${verb} ${a.name}'s ${name} (${chk.total} vs ${chk.tn}).`, 'defend');
              if ((def.type === 'parry' || def.type === 'offParry') && C.rank(t, 'riposte')) await riposte(enc, chars, t, a, roller, posAtStart);
            }
            return;
          }
          log(enc, `${t.name}'s ${ACTIONS[def.type].name.toLowerCase()} fails (${chk.total} vs ${chk.tn}).`, 'fail');
          if (def.type === 'dodge') failedDodge = true;
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
        const pack = a.traits && a.traits.pack
          ? Math.min(a.traits.pack, enc.ids.filter((o) => o !== a.id && o !== t.id && chars[o].side === a.side && C.isActive(chars[o]) && dist(posAtStart[o], posAtStart[t.id]) <= 1).length)
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
        const r = await applyHit(enc, chars, a, t, hitOpt, roller, { half, distance, pack });
        const note = (distance === 1 && d.option.closePenalty) || (CONFIG.grappledWeaponsCramped && d.option.weaponId && !d.option.ranged && isGrappled(a))
          ? (CONFIG.range.closeRule === 'blunt' ? ' (cramped: blunt, half force)' : ' (cramped: half damage)') : d.option.ranged && d.option.longRange && distance > d.option.longRange ? ' (long range)' : '';
        log(enc, `${a.name}'s ${name} hits ${t.name}${half ? ' (Roll With It: half)' : ''}${pack ? ` (pack +${pack})` : ''}${note}: ${r.text}`, 'hit');
        // Kindled (Bless + Fire): a blade wreathed in flame sets what it strikes burning.
        if (G.Conditions && G.Conditions.flag(a, 'kindled') && !d.option.ranged && !d.option.spell && C.isActive(t) && !C.tireless(t)) {
          G.Conditions.add(t, 'burning', { rounds: 2, mag: 1, src: a.id });
          log(enc, `${t.name} catches fire.`, 'hit');
        }
        if (d.option.spell && G.Magic && G.Magic.afterHit) await G.Magic.afterHit(enc, chars, a, t, d.option, r.hit, roller);
        // A conjured elemental's blows carry its element.
        if (a.traits && a.traits.element && !d.option.spell && G.Magic && C.isActive(t)) await G.Magic.onHit(enc, chars, a, t, a.traits.element, roller, { from: posAtStart[a.id] });
        // Springy armor (chitin): the blow rebounds and jars the attacker.
        const recoil = t.armor && t.armor.durability > 0 && (G.DATA.ARMOR[t.armor.type] || {}).recoil;
        if (recoil && !d.option.ranged && !d.option.spell && !C.tireless(a)) {
          const jar = Math.min(a.stamina - 1, recoil * (CONFIG.staminaScale || 1));
          if (jar > 0) { a.stamina -= jar; log(enc, `The springy ${t.armor.type === 'chitin' ? 'chitin' : 'hide'} jars ${a.name}'s arms (−${jar} stamina).`, 'fail'); }
        }
        if (!C.isActive(t)) loseWindUp(enc, t, null);
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
        log(enc, `${a.name} winds up a ${d.option.label} — exposed until it lands.`);
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
          const o = await opposed(roller, a, Math.floor(C.attr(a, 'CHA') / 2) + C.rank(a, 'feint'), 'Bait', t, Math.floor(C.attr(t, 'WIS') / 2) + C.rank(t, 'read_attack'), 'See through it');
          if (o.margin > 0) {
            // The bait draws out their guards and leaves them off balance for the round.
            for (const g of enc.decls) if (g.actor === t.id && DEFENSE_TYPES.includes(g.type) && !g.used) g.used = true;
            if (G.Conditions) G.Conditions.add(t, 'baited', { rounds: 1, src: a.id });
            log(enc, `${a.name} baits ${t.name}, who commits too early and is off balance (${o.a} vs ${o.b}).`, 'hit');
          } else log(enc, `${t.name} sees through ${a.name}'s bait (${o.a} vs ${o.b}).`, 'fail');
        } else {
          // The reader rolls against a number they can't see: a true read, nothing, or a
          // confident misread that looks just like a true one.
          const RI = R.readIntent;
          const bonus = Math.floor(C.attr(a, 'WIS') / 2) + C.rank(a, 'read_attack');
          const tn = RI.tn + Math.floor(C.attr(t, 'CHA') / 2) + C.rank(t, 'feint');
          const r = await rollDie(roller, a.id, 10, `${a.name}: Read intent`, `d10 + ${bonus} (WIS) against ${t.name}'s guarded face`);
          const margin = r + bonus - tn;
          if (margin < 0 && margin > -RI.misreadBy) {
            log(enc, `${a.name} studies ${t.name} but can't read them.`, 'fail');
            break;
          }
          const truth = margin >= 0;
          const note = intentNote(enc, chars, t, truth, r);
          if (G.Conditions) G.Conditions.add(a, 'reading', { rounds: 1, vs: t.id, src: a.id, truth, note });
          log(enc, `${a.name} reads ${t.name}: ${note}`, 'defend');
        }
        break;
      }
      case 'tearFree': {
        const W = CONFIG.web;
        const bonus = Math.floor(C.attr(a, 'STR') / 2);
        if (!a.status.webbed && G.Conditions && !G.Conditions.canMove(a)) {
          const root = G.Conditions.list(a).find((x) => (CONFIG.conditions[x.key] || {}).noMove);
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
        if (a.status.grappling && chars[a.status.grappling]) {
          setGrapple(chars, a, chars[a.status.grappling], null);
          log(enc, `${a.name} lets go.`);
        }
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

  // Pay spell points and roll backlash. Returns false if the spell fails to go off.
  async function castSpell(enc, a, opt, roller) {
    const avail = G.Magic.availableSP(a);
    if (opt.spCost > avail) {
      log(enc, `${a.name} can't draw enough power for ${opt.label} (${avail} of ${opt.spCost} points).`, 'fizzle');
      return false;
    }
    a.spSpent = (a.spSpent || 0) + opt.spCost;
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

  // Rust (monster trait): no wound, but metal armor corrodes.
  function rustTouch(enc, a, t, amount) {
    const metal = t.armor && (CONFIG.archery.metalArmor || []).includes(t.armor.type) && t.armor.durability > 0;
    if (!metal) return log(enc, `${a.name}'s antennae brush ${t.name}, finding no metal.`, 'fizzle');
    t.armor.durability = Math.max(0, t.armor.durability - amount);
    log(enc, `${a.name}'s antennae touch ${t.name}'s armor: it flakes with rust (durability −${amount}${t.armor.durability ? '' : ', destroyed'}).`, 'hit');
  }

  async function shieldAbsorb(enc, chars, a, t, d, roller) {
    const s = t.shield;
    const ss = Items.shieldStats(s);
    const v = d.type === 'strike' ? d.option.damage : [0, 0, 0];
    const W = CONFIG.shieldWear;
    const wear = Math.round((v[0] * W.P + v[1] * W.S + v[2] * W.B) * (CONFIG.shieldWearScale || 1));
    s.durability = Math.max(0, s.durability - wear);
    if (d.type === 'strike' && d.option.rust && ['iron', 'steel'].includes(s.material)) {
      s.durability = Math.max(0, s.durability - d.option.rust);
      log(enc, `The rusting antennae eat into ${t.name}'s ${s.material}-bound shield (durability −${d.option.rust}).`, 'hit');
    }
    const label = d.type === 'strike' ? d.option.label : d.type;
    let msg = `${t.name} blocks ${a.name}'s ${label} with the shield (durability −${wear})`;
    let force = v[0] + v[1] + v[2];
    if (C.rank(a, 'shield_breaker')) force *= 2;
    const power = d.type === 'strike' && ((CONFIG.powerMotions || []).includes(d.option.motion) || d.option.shieldCrush);
    const weapon = d.type === 'strike' && d.option.weaponType ? WEAPONS[d.option.weaponType] : null;
    const H = CONFIG.materialHardness || {};
    const powerful = (CONFIG.powerfulShieldQualities || []).includes(s.quality);
    let broken = false;
    if (power && weapon && weapon.material && !powerful && (H[weapon.material] || 0) >= (H[s.material] || 0)) {
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

  async function riposte(enc, chars, t, a, roller, posAtStart) {
    const w = C.wieldedWeapon(t);
    if (!w || !Items.weaponStats(w).faces.point) return;
    const opt = C.attackOptions(t).find((o) => o.motion === 'thrust' && o.weaponId === w.id && !o.halfSword);
    if (!opt || dist(posAtStart[t.id], posAtStart[a.id]) > opt.reach) return;
    if (!payStamina(enc, t, opt.stamina)) return;
    const r = await applyHit(enc, chars, t, a, opt, roller);
    log(enc, `${t.name} ripostes: ${r.text}`, 'hit');
  }

  async function resolveManeuver(enc, chars, d, roller) {
    const a = chars[d.actor];
    const t = chars[d.target];
    const M = CONFIG.maneuver;
    if (d.type === 'shove') {
      const S = CONFIG.shove;
      const w = C.wieldedWeapon(a);
      const aB = Math.floor(C.attr(a, 'STR') / 2) + (w && WEAPONS[w.type].hands === 2 ? S.twoHandBonus : 0) + (C.shieldReady(a) ? S.shieldBonus || 0 : 0);
      const o = await opposed(roller, a, aB, dist(enc.pos[a.id], enc.pos[t.id]) > 1 ? 'Fend off' : 'Shove', t, stability(t), 'Hold ground');
      if (o.margin <= 0) return log(enc, `${a.name}'s shove fails (${o.a} vs ${o.b}).`, 'fail');
      const from = enc.pos[a.id], at = enc.pos[t.id];
      const dx = Math.sign(at.x - from.x), dy = Math.sign(at.y - from.y);
      const want = o.margin >= S.farMargin ? 2 : 1;
      let moved = 0;
      for (let k = 0; k < want; k++) {
        const nx = enc.pos[t.id].x + dx, ny = enc.pos[t.id].y + dy;
        const free = nx >= 0 && ny >= 0 && nx < enc.grid.w && ny < enc.grid.h && !enc.ids.some((id) => id !== t.id && C.isActive(chars[id]) && enc.pos[id].x === nx && enc.pos[id].y === ny);
        if (!free) break;
        enc.pos[t.id] = { x: nx, y: ny };
        moved++;
      }
      // Driven back: whatever advance they had in mind this pass is spoiled.
      if (moved || o.margin >= S.farMargin) (enc.disrupted || (enc.disrupted = {}))[t.id] = true;
      if (moved) log(enc, `${a.name} shoves ${t.name} back ${moved} square${moved > 1 ? 's' : ''} (${o.a} vs ${o.b}).`, 'hit');
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
  function endRound(enc, chars) {
    log(enc, 'End of round', 'pass');
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
        if (!G.Conditions.has(c, 'controlled')) {
          c.side = c.charmed.side; c.control = c.charmed.control; delete c.charmed;
          log(enc, `${c.name} comes back to themselves.`, 'pass');
        }
      }
      // Regeneration (monster trait): wounds close and strength returns, unless burned this round.
      const R = c.traits && c.traits.regen;
      if (R && !(enc.burned || {})[id] && C.attr(c, 'CON') > 0) {
        const healed = Math.min(R.con, c.damage.CON || 0);
        if (healed) C.healAttr(c, 'CON', healed);
        c.bleeds = c.bleeds.filter((b) => b.poison);
        const before = c.stamina;
        c.stamina = Math.min(C.maxStamina(c), c.stamina + R.stamina);
        if (c.status.unconscious && c.stamina > 0) { c.status.unconscious = false; log(enc, `${c.name} heaves itself back up.`, 'death'); }
        if (healed || c.stamina > before) log(enc, `${c.name} regenerates${healed ? ` ${healed} CON` : ''}${c.stamina > before ? `${healed ? ' and' : ''} ${c.stamina - before} stamina` : ''}.`);
      }
      // Regeneration.
      const r = C.regen(c);
      const conscious = !c.status.unconscious;
      if (conscious || CONFIG.unconsciousRegenerates) {
        const took = enc.hitThisRound[id] || 0;
        const allowed = took === 0 || (C.rank(c, 'second_wind') && took <= 2);
        if (r < 0 && CONFIG.negativeRegenAlwaysApplies) {
          c.stamina = Math.max(0, c.stamina + r);
          log(enc, `${c.name} loses ${-r} stamina to heavy armor.`);
        } else if (r > 0 && allowed) {
          const before = c.stamina;
          c.stamina = Math.min(C.maxStamina(c), c.stamina + r);
          if (c.stamina > before) log(enc, `${c.name} recovers ${c.stamina - before} stamina.`);
        }
      }
      const wasDown = c.status.unconscious;
      C.updateCondition(c);
      if (c.status.dead) log(enc, `${c.name} has died.`, 'death');
      else if (c.status.unconscious && !wasDown) log(enc, `${c.name} collapses, unconscious.`, 'death');
      if (c.status.unconscious) { releaseGrapples(chars, c); c.status.windUp = null; }
      // Webs loosen as you struggle: a layer comes off each round.
      if (c.status.webbed && CONFIG.web && CONFIG.web.wearOff) c.status.webbed = Math.max(0, c.status.webbed - CONFIG.web.wearOff);
      // Holding someone is exhausting: pay the upkeep or let go.
      const G2 = CONFIG.grappling;
      if (c.status.grappling && G2 && G2.holdUpkeep && !c.status.unconscious) {
        const cost = G2.holdUpkeep * (CONFIG.staminaScale || 1);
        if (c.stamina > cost) {
          c.stamina -= cost;
          log(enc, `${c.name} spends ${cost} stamina holding ${chars[c.status.grappling] ? chars[c.status.grappling].name : 'their foe'}.`);
        } else {
          clearGrapple(chars, c);
          log(enc, `${c.name} is too spent to keep the hold and lets go.`, 'fizzle');
        }
      }
      // A wind-up must be released the round after it is made.
      if (c.status.windUp && c.status.windUp.round < enc.round) loseWindUp(enc, c, 'not released in time');
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
      c.status.prone = false;
      c.status.windUp = null;
      c.status.grappling = null;
      c.status.grappledBy = [];
      c.status.clinch = null;
      c.status.pinned = false;
      c.status.grapplingPin = false;
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

  G.Combat = {
    conditionForbids, ATTACK_TYPES, DEFENSE_TYPES, HELD_TYPES, readiesUp, readyable, shoveReach, log, rollDie, castSpell, knockDown, stability, releaseAll: clearGrapple,
    createEncounter, autoPlace, startRound, currentActor, legalActions, declare, concede, endTurn, submit, describeDecl, passCap, passLeft,
    vitalNeed, projectedPos, posAtPass, dist, defenseOdds, knockdownOdds, opposedOdds, shoveOdds, defenseUnavailable, computeHit, applyHit, resolvePass, resolveRound, endRound, cleanup, linkOf, grappleScore, breakScore, GRAPPLE_STEPS,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
