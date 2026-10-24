/*
 * The policy for computer-controlled combatants, also used by the simulator. It only uses
 * information the character could see: a blow hidden by Feint is judged by what the attacker
 * might be doing, not what they are doing, and nobody sees anyone else's AP.
 *
 * choose() is called again and again during a character's turn until it returns 'endTurn'.
 * Each action resolves at once. Each turn decision, in order:
 *   1. stand up; 2. release a wind-up if the target is in range; 3. grapple or get loose;
 *   4. bandage, re-arm; 5. switch weapons when another fits the distance better; 6. occasional
 *   trip/grapple; 7. keep a ranged weapon out of melee; 8. attack, or wind up when the delayed
 *   blow is worth more; 9. move toward the distance its weapons like best; 10. end the turn.
 * Throughout, it keeps AP back to defend with when foes still to act this round can reach it.
 *
 * react() answers out of turn: a defence when a blow comes, an opportunity strike when a foe
 * leaves its reach.
 *
 * policy (all optional):
 *   maneuverRate  chance per action to try a trip/grapple when one is in reach (default 0.15)
 *   kickBias      multiplier on the value of kicks (default 1)
 *   defendFloor   minimum expected value before spending AP on a defence (default 1.5)
 *   cautious      keep AP back for defences against foes still to act (default true)
 *   windUp        willingness to wind up (multiplier on its value; 0 = never; default 1)
 *   grappler      works up the grappling ladder: clinch, hold, pin, then stab or throw (default: has Grappler)
 *   kite          ranged characters back away from melee (default true)
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const Combat = G.Combat;

  const DEFAULTS = { maneuverRate: 0.15, kickBias: 1, defendFloor: 1.5, cautious: true, windUp: 1, kite: true, grappler: null };

  function attrDmgOrStamina(h) {
    return h.toCON + h.slashToAttrs + h.bluntToCON + h.bluntToStamina;
  }

  // How much a hit is worth to the attacker, in stamina-equivalent points.
  // Attribute damage costs max stamina and bleeds; a hit that drops the target is worth most.
  function hitValue(attacker, target, option, distance) {
    // Rust: worth the armor it eats, if there's iron or steel to eat.
    // Web: worth what it costs the target over the next actions.
    if (option.web) return (target.status.webbed || 0) >= (G.CONFIG.web.maxLayers || 2) ? 0 : (target.status.webbed ? 5 : 10);
    if (option.rust) {
      const metal = target.armor && G.Items.rusts(Object.assign({ kind: 'armor' }, target.armor)) && target.armor.durability > 0;
      return metal ? Math.min(option.rust, target.armor.durability) * 1.0 : 0;
    }
    const h = Combat.computeHit(attacker, target, option, { distance: distance || (option.minRange || 1) + (option.closePenalty ? 1 : 0) });
    // A CON point now is worth 5, a point of bleeding later 3 (it can be bandaged). Piercing
    // bleeds by the wound's width; a vital wound (wound roll) multiplies it.
    const bleedV = h.noBleed ? 0 : 3;
    const pierceV = h.toCON * (5 + bleedV * h.bleedFactor);
    const pV = Combat.vitalNeed(h.pierceVital) / 10, cV = Combat.vitalNeed(h.cutVital) / 10;
    let v = pierceV * (1 + pV * (G.CONFIG.vital.mult - 1)) + h.slashToAttrs * (5 + bleedV) * (1 + cV) + h.bluntToCON * 5 + h.bluntToStamina;
    if (option.venom && h.toCON + h.slashToAttrs > 0) v += Math.min(option.venom.con, h.toCON + h.slashToAttrs) * option.venom.rounds * 6;
    // A spell's after-effects (Magic: noun onHit), if anything got through.
    if (option.spell && option.spell.noun && attrDmgOrStamina(h) > 0) {
      const H = (G.CONFIG.magic.words[option.spell.noun] || {}).onHit || {};
      const conds = G.Conditions ? G.Conditions : null;
      if (H.cond && conds && !conds.has(target, H.cond)) v += ({ burning: 8, slowed: 6, chilled: 6, shocked: 6, rooted: 8, paralyzed: 24 }[H.cond] || 4) * 0.6;
      if (H.corrode && target.armor && target.armor.durability > 0) v += option.spell.magnitude * 0.8;
      if (H.knockdown && !target.status.prone) v += 4;
      if (H.push) v += 2;
      if (option.spell.lingering) v += Math.max(1, Math.round(option.spell.magnitude / 4)) * 3 * 5 * 0.6;
    }
    // A kill, at the odds of a point finding a gap when it has to (CONFIG.pierce).
    const con = C.attr(target, 'CON');
    const k = h.gap ? h.gap.got : h, kp = h.gap ? h.gap.chance : 1;
    if (k.toCON + k.bluntToCON >= con) v += 60 * kp;
    else if (k.toCON > 0 && k.toCON * G.CONFIG.vital.mult + k.bluntToCON >= con) v += 60 * pV * kp;
    else if (h.bluntToStamina >= target.stamina && target.stamina > 0) v += 40;
    return v;
  }

  // Value per (scaled) AP of an attack against a target at a distance.
  function rate(c, target, opt, d) {
    if (!C.inRange(opt, d)) return 0;
    if (opt.stamina && opt.stamina >= c.stamina) return 0; // can't pay for it
    let v = (hitValue(c, target, opt, d) * C.costScale()) / Math.max(1, opt.ap);
    if (opt.unarmed === 'kick' || opt.unarmed === 'shieldBash') {
      const pDown = target.status.prone ? 0 : Combat.knockdownOdds(c, target, C.rank(c, 'trip') ? G.CONFIG.maneuver.tripFeatBonus : 0, G.CONFIG.maneuver.kickKnockdownMargin);
      v += (pDown * 10 * C.costScale()) / Math.max(1, opt.ap);
    }
    if (opt.spell) v *= 0.85; // spell points are finite and backlash is a risk
    const disp = target.traits && target.traits.displacement;
    if (disp) v *= 1 - (opt.ranged || opt.spell ? disp.ranged : disp.melee);
    return v;
  }

  const MANEUVER_THREAT = { trip: 8, disarm: 6, shove: 3, clinch: 6, grapple: 8, pin: 10, throw: 10, break: 2 };

  // Threat of an incoming declaration, as the defender perceives it.
  function perceivedThreat(enc, chars, decl, viewerId) {
    const atk = chars[decl.actor];
    const me = chars[viewerId];
    if (decl.type !== 'strike') return { threat: MANEUVER_THREAT[decl.type] || 6, motion: 'maneuver' };
    const hidden = Combat.describeDecl(enc, chars, decl, viewerId).hidden;
    const d = Combat.dist(enc.pos[atk.id], enc.pos[viewerId]);
    if (!hidden) return { threat: hitValue(atk, me, decl.option, d), motion: decl.option.motion };
    const opts = C.attackOptions(atk);
    if (!opts.length) return { threat: 4, motion: 'swing' };
    const mean = opts.reduce((t, o) => t + hitValue(atk, me, o, d), 0) / opts.length;
    return { threat: mean, motion: 'swing' };
  }

  // Foes this character knows of: an unseen one beyond arm's reach isn't there as far as it can tell.
  function enemiesOf(enc, chars, id) {
    return enc.ids.filter((o) => chars[o].side !== chars[id].side && C.isActive(chars[o]) && !(Combat.unseenBy && Combat.unseenBy(enc, chars, chars[o], chars[id])));
  }

  // Frightened (Fear, a wail): get away from what frightens you while it is close.
  function fleeFrom(enc, chars, id, la) {
    const c = chars[id];
    const fear = G.Conditions && G.Conditions.get(c, 'frightened');
    const src = fear && chars[fear.src];
    if (!src || !C.isActive(src) || !la.move || !enc.pos[src.id]) return null;
    const me = enc.pos[id], from = enc.pos[src.id];
    if (Combat.dist(me, from) > 3) return null;
    let best = null, bd = Combat.dist(me, from);
    const R = la.move.maxSquares;
    for (let y = me.y - R; y <= me.y + R; y++) for (let x = me.x - R; x <= me.x + R; x++) {
      if (!G.Terrain.passable(enc, x, y) || (x === me.x && y === me.y)) continue;
      if (enc.ids.some((o) => o !== id && C.isActive(chars[o]) && enc.pos[o].x === x && enc.pos[o].y === y)) continue;
      const d = Combat.dist({ x, y }, from);
      if (d <= bd) continue;
      if (enc.tiles) { const pc = G.Terrain.pathCost(enc, me, { x, y }, c); if (!pc.reaches || pc.cost > R) continue; }
      bd = d; best = { x, y };
    }
    return best ? { actor: id, type: 'move', to: best } : null;
  }

  // What an AP of mine is worth right now, in the units of hitValue: more while my own turn is
  // still to come this round (it could be a blow), less once I have had it (it can only defend).
  function apWorth(enc, id) {
    const S = C.costScale();
    const turnAhead = !enc.turnDone[id] && enc.order.indexOf(id) >= Math.max(0, enc.turn) && Combat.currentActor(enc) !== id;
    return (turnAhead ? 1.0 : 0.45) / S;
  }

  // AP to keep back on my turn for defences: one cheapest defence for each foe still to act this
  // round who could reach me and would hurt me (armor that shrugs off their blows needs no reserve).
  function reserveAP(enc, chars, id, P) {
    if (!P.cautious) return 0;
    const c = chars[id];
    const me = enc.pos[id];
    const costs = Combat.DEFENSE_TYPES.filter((k) => !Combat.defenseUnavailable(c, k, null, chars, enc) && (k !== 'offParry' || C.offhandWeapon(c))).map((k) => C.actionCost(c, k).ap);
    if (!costs.length) return 0;
    const cheapest = Math.min(...costs);
    const myTurn = enc.order.indexOf(id);
    let n = 0;
    for (const f of enemiesOf(enc, chars, id)) {
      if (enc.turnDone[f] || enc.order.indexOf(f) <= myTurn) continue;
      const foe = chars[f];
      const d = Combat.dist(me, enc.pos[f]);
      const walk = Math.floor(C.squaresFor(foe, Combat.apLeft(enc, f)) / 2);
      let worst = 0;
      for (const o of C.attackOptions(foe)) {
        if (o.windUp && !(foe.status.windUp && foe.status.windUp.key === C.optionKey(o))) continue;
        if (o.ranged && o.weaponId && C.ammoLeft(foe, o) <= 0) continue;
        if (d - (o.ranged || o.spell ? 0 : walk) > (o.maxRange || 1)) continue;
        worst = Math.max(worst, hitValue(foe, c, o, Math.max(o.minRange || 1, Math.min(d, o.maxRange || 1))));
      }
      if (worst >= 2) n++;
    }
    return Math.min(2, n) * cheapest;
  }

  // Out of turn. req.kind 'defend': { actor, attacker, decl, hidden, options: [{type, ap, stamina, odds}] }
  // → a defence type or null. req.kind 'opportunity': { actor, target, options: [attack options] }
  // → an option or null.
  function react(enc, chars, req) {
    const c = chars[req.actor];
    const P = Object.assign({}, DEFAULTS, c.policy || {});
    const per = apWorth(enc, req.actor);
    if (req.kind === 'defend') {
      const atk = chars[req.attacker];
      const { threat, motion } = perceivedThreat(enc, chars, req.decl, req.actor);
      let pick = null;
      for (const o of req.options) {
        if (o.type === 'offParry' && (req.hidden || motion !== 'thrust')) continue;
        const p = o.odds != null ? o.odds : 0.4;
        // A parry a heavy swing beats through saves only part of it (CONFIG.defense.parryCarry), if I can see the blow.
        const carry = (o.type === 'parry' || o.type === 'offParry') && !req.hidden && req.decl && req.decl.option ? Combat.parryCarryShare(c, o.type, req.decl.option) : 0;
        let v = p * threat * (1 - carry);
        if (o.type === 'dodge' && C.rank(c, 'roll_with_it')) v += (1 - p) * 0.5 * threat;
        v -= per * o.ap + 0.3 * o.stamina;
        if (v >= P.defendFloor && (!pick || v > pick.v)) pick = { v, type: o.type };
      }
      return pick ? pick.type : null;
    }
    if (req.kind === 'opportunity') {
      const t = chars[req.target];
      const d = Combat.dist(enc.pos[req.actor], enc.pos[req.target]);
      let pick = null;
      for (const o of req.options) {
        // About even odds the mover answers it; still a free blow at someone walking away.
        const v = hitValue(c, t, o, d) * 0.6 - per * o.ap - 0.3 * o.stamina;
        if (v >= P.defendFloor && (!pick || v > pick.v)) pick = { v, o };
      }
      return pick ? pick.o : null;
    }
    return null;
  }

  // For planning, an attack that needs a wind-up counts at its full two-round AP cost.
  function forPlanning(c, o) {
    return o.windUp ? Object.assign({}, o, { why: null, ap: o.ap + C.actionCost(c, 'windUp', { option: o }).ap }) : o;
  }

  const WIND_REASONS = ['Wind up first', 'Release next round', 'Already released'];

  // Attack options with a different weapon in hand (for weighing a switch).
  function optionsWith(c, wieldId) {
    const keep = c.wield;
    c.wield = wieldId;
    const opts = C.attackOptions(c).filter((o) => !o.unarmed).map((o) => forPlanning(c, o));
    c.wield = keep;
    return opts;
  }

  function bestRate(c, target, opts, d) {
    let best = 0;
    for (const o of opts) {
      if (o.why) continue;
      best = Math.max(best, rate(c, target, o, d));
    }
    return best;
  }

  // What a foe could do to me at a distance (their best rate), as I can see it.
  function foeRate(foe, me, d) {
    let best = 0;
    for (const o of C.attackOptions(foe)) {
      if (o.windUp && !(foe.status.windUp && foe.status.windUp.key === C.optionKey(o))) continue;
      if (o.ranged && o.weaponId && C.ammoLeft(foe, o) <= 0) continue;
      if (o.spell && G.Magic && o.spCost > G.Magic.availableSP(foe)) continue;
      best = Math.max(best, rate(foe, me, o, d));
    }
    return best;
  }

  const RISK = 0.8; // how much the foe's threat at a distance counts against my own

  // The distance this loadout likes best against a target: the best of
  // (my rate − RISK × their rate), and among near-equal choices the farthest.
  // If nothing scores above zero, fall back to my best raw rate (someone has to fight).
  // The cost of getting from distance `from` in to `d` against a foe who can strike at d: entering its
  // reach, or two steps within it, is an opportunity strike (counted at half, once).
  function entryCost(c, target, d, from) {
    if (!G.CONFIG.opportunityStrikes || from == null || d >= from) return 0;
    let worst = 0;
    for (const o of C.attackOptions(target)) {
      const r = o.maxRange || 1;
      if (o.ranged || o.spell || o.windUp || r < d || (from <= r && from - d < 2)) continue;
      worst = Math.max(worst, hitValue(target, c, o, Math.min(from, o.maxRange)));
    }
    return worst * 0.5;
  }

  // What walking away from here costs: every foe whose reach I stand in may strike as I go.
  function leaveCost(enc, chars, id) {
    if (!G.CONFIG.opportunityStrikes) return 0;
    let total = 0;
    for (const f of enemiesOf(enc, chars, id)) {
      const opts = Combat.opportunityOptions(enc, chars, chars[f], enc.pos[id]);
      if (!opts.length) continue;
      const d = Combat.dist(enc.pos[id], enc.pos[f]);
      total += Math.max(...opts.map((o) => hitValue(chars[f], chars[id], o, d))) * 0.5;
    }
    return total;
  }

  // How much the AI still fears the stop-thrust on its way in: in full at first, half after each round in
  // which nobody struck (two sides waiting at the edge of each other's reach; someone has to go in).
  function wariness(enc) {
    let last = 0;
    for (const d of enc.decls) if (d.type === 'strike' && d.round > last) last = d.round;
    return Math.pow(0.5, Math.max(0, enc.round - Math.max(1, last + 1)));
  }

  function preferredDistance(c, target, opts, from, wary) {
    const myMax = Math.max(1, ...opts.map((o) => o.maxRange || 1));
    const theirMax = Math.max(1, ...C.attackOptions(target).map((o) => o.maxRange || 1));
    const top = Math.min(16, Math.max(myMax, theirMax + 1));
    let best = null, bestRaw = null;
    for (let d = 1; d <= top; d++) {
      const mine = bestRate(c, target, opts, d);
      if (mine <= 0) continue;
      const net = mine - RISK * foeRate(target, c, d) - entryCost(c, target, d, from) * (wary == null ? 1 : wary);
      if (!best || net > best.net + 0.01 || (Math.abs(net - best.net) <= 0.01 && d > best.d)) best = { d, rate: mine, net };
      if (!bestRaw || mine > bestRaw.rate) bestRaw = { d, rate: mine, net };
    }
    if (!best) return { d: 1, rate: 0, net: 0 };
    const ranged = opts.some((o) => o.ranged);
    const pick = best.net > 0 || ranged ? best : bestRaw;
    if (ranged && pick.d > 8 && bestRate(c, target, opts, 8) >= pick.rate * 0.9) return { d: 8, rate: bestRate(c, target, opts, 8), net: pick.net };
    return pick;
  }

  // Farthest any foe can strike from.
  function threatReach(chars, foes) {
    let r = 1;
    for (const f of foes) for (const o of C.attackOptions(chars[f])) if (!o.ranged) r = Math.max(r, o.maxRange || 1);
    return r;
  }

  function nearestFoe(enc, chars, id, foes, posFn) {
    const me = posFn(id);
    let best = null, bd = Infinity;
    for (const f of foes) {
      const d = Combat.dist(me, posFn(f));
      if (d < bd) { bd = d; best = f; }
    }
    return { id: best, d: bd };
  }

  // Which foe to go after. Teamwork: a foe an ally is already fighting, or one that's already
  // hurt, is worth walking a little farther for, so a party focuses its blows.
  function pickTarget(enc, chars, id, foes, posFn) {
    const me = posFn(id);
    const allies = enc.ids.filter((o) => o !== id && chars[o].side === chars[id].side && C.isActive(chars[o]));
    let best = null;
    for (const f of foes) {
      const foe = chars[f];
      const d = Combat.dist(me, posFn(f));
      const engaged = allies.filter((a) => Combat.dist(posFn(a), posFn(f)) <= 2).length;
      const conLeft = C.attr(foe, 'CON') / Math.max(1, C.attrMax(foe, 'CON'));
      const stLeft = C.tireless(foe) ? 1 : foe.stamina / Math.max(1, C.maxStamina(foe));
      const hurt = 1 - conLeft * stLeft;
      const score = d - 2 * Math.min(engaged, 2) - 4 * hurt;
      if (!best || score < best.score) best = { id: f, d, score };
    }
    return best || { id: null, d: Infinity };
  }

  // Best square within the move budget for a goal distance to the target.
  // ---- Casting (magic overhaul) -------------------------------------------------------
  // Value of each cast spell in the same units as an attack's rate (stamina-equivalent points
  // per AP). Rough by design: hold a melee foe off with a wall, a pit or roots; hazards and
  // bursts where foes bunch and friends don't; bane the dangerous; bless the engaged.
  function meleeReach(c) {
    let r = 0;
    for (const o of C.attackOptions(c)) if (!o.ranged && !o.spell) r = Math.max(r, o.maxRange || 1);
    return r;
  }

  // What mending a creature is worth: waking the downed most, then stopping bleeding, closing
  // wounds and restoring stamina it's short of.
  function mendValue(a, s, share) {
    if (!a || a.status.dead || C.tireless(a)) return 0;
    const H = G.CONFIG.magic.heal;
    const short = C.maxStamina(a) - a.stamina;
    const stamina = Math.min(short, (H.stamina + H.staminaPerMag * s.magnitude) * share);
    let v = stamina * 0.6;
    if (a.status.unconscious) v += 40;
    v += a.bleeds.filter((b) => !b.poison).reduce((t, b) => t + b.remaining, 0) * 3;
    v += Math.min(s.condMag, a.damage.CON || 0) * 6;
    return v;
  }

  // What Restore is worth on a creature: mending (Life) plus the conditions it would lift.
  function restoreValue(a, s, share) {
    if (!a || a.status.dead) return 0;
    let v = 0;
    for (const n of s.nouns || [s.noun]) {
      if (G.CONFIG.magic.words[n].heals) v += mendValue(a, s, share);
      for (const k of G.Magic.curesOf(n)) if (G.Conditions.has(a, k)) v += { controlled: 40, mesmerized: 30, confused: 24, calmed: 16, frightened: 16, rooted: 14, poisoned: 16, withering: 18, diseased: 10 }[k] || 10;
      if (n === 'venom') v += a.bleeds.filter((b) => b.poison).reduce((t, b) => t + b.remaining, 0) * 3;
    }
    return v;
  }

  // Spell points to hold back: a caster who can raise the dead keeps enough for it until a body
  // lies within reach (then the raise itself may spend them).
  function spReserve(enc, chars, id, la) {
    const raise = (la.spells || []).find((o) => o.spell.shape === 'raise' && !o.spell.mod && !o.power);
    if (!raise) return 0;
    const body = enc.ids.some((o2) => chars[o2] && chars[o2].status.dead && !chars[o2].vanished && !chars[o2].raised);
    return body ? 0 : raise.spCost;
  }

  function castChoice(enc, chars, id, la, foes) {
    if (!la.spells || !la.spells.length) return null;
    const keep = spReserve(enc, chars, id, la);
    const c = chars[id];
    const S = C.costScale();
    const me = Combat.projectedPos(enc, id);
    const Cn = G.Conditions;
    const allies = enc.ids.filter((o) => chars[o] && chars[o].side === c.side && C.isActive(chars[o]));
    const posOf = (o) => Combat.projectedPos(enc, o);
    const closing = foes.filter((f) => meleeReach(chars[f]) > 0).map((f) => ({ f, d: Combat.dist(me, posOf(f)) })).sort((x, y) => x.d - y.d)[0];
    const engaged = (o) => foes.some((f) => Combat.dist(posOf(o), posOf(f)) <= Math.max(1, meleeReach(chars[f])));
    const inArea = (list, p, r) => list.filter((o) => Combat.dist(posOf(o), p) <= r);
    const conjuredUp = enc.ids.some((o) => chars[o] && chars[o].conjured && chars[o].conjured.by === id && !chars[o].status.dead);
    let best = null;
    const consider = (v, decl, o) => {
      const r = (v * S) / Math.max(1, o.ap);
      if (r > 0 && (!best || r > best.v)) best = { v: r, decl };
    };
    for (const o of la.spells) {
      if (!o.affordable) continue;
      const isRaise = o.spell.shape === 'raise';
      if (!isRaise && G.Magic.availableSP(chars[id]) - o.spCost < keep) continue;
      const s = o.spell, N = G.CONFIG.magic.words[s.noun];
      const cast = (extra) => Object.assign({ actor: id, type: 'cast', option: o }, extra);
      if (s.shape === 'mind') {
        // Mind spells on a dangerous foe: the closer and harder-hitting, the better.
        const key = s.combo || N.mind;
        const worth = { mesmerized: 30, calmed: 20, enraged: 14, frightened: 18, controlled: 40, enthralled: 34, confused: 24, baited: 6 }[key] || 10;
        for (const t of o.targets) {
          if (!t.inReach || !foes.includes(t.id)) continue;
          const foe = chars[t.id];
          if (Cn.has(foe, key) || C.tireless(foe)) continue;
          if (key === 'enraged' && !enc.ids.some((o2) => o2 !== t.id && chars[o2] && chars[o2].side === foe.side && C.isActive(chars[o2]) && Combat.dist(posOf(o2), posOf(t.id)) <= 2)) continue;
          const resist = 0.5 + (Math.floor(C.attr(c, 'INT') / 2) - Math.floor(C.attr(foe, 'WIL') / 2)) * 0.08;
          consider(worth * Math.max(0.15, Math.min(0.85, resist)), cast({ target: t.id }), o);
        }
      } else if (o.target === 'foe') {
        const key = N.bane;
        for (const t of o.targets) {
          if (!t.inReach || !foes.includes(t.id)) continue;
          const foe = chars[t.id];
          if (Cn.has(foe, key) || (G.CONFIG.conditions[key].living && C.tireless(foe))) continue;
          let v = { rooted: closing && closing.f === t.id && t.distance >= 2 ? 30 : 6, paralyzed: 34, corroded: 8, slowed: 14, shocked: 12, numbed: 10, withering: 22, burning: 12, baited: 6, enfeebled: 12, clumsy: 10, poisoned: 16, diseased: 12, dazzled: 6, blinded: 18 }[key] || 6;
          consider(v * 0.55, cast({ target: t.id }), o);
        }
      } else if (s.shape === 'ward') {
        // Ward myself (or a friend) against what the foes throw: spells and missiles (force),
        // missiles (wind), or one element.
        const ranged = foes.filter((f) => C.attackOptions(chars[f]).some((x) => x.ranged));
        const casters = foes.filter((f) => G.Magic.maxSP(chars[f]) > 0);
        for (const t of o.targets) {
          if (!t.inReach || Cn.has(chars[t.id], 'warded')) continue;
          const kind = N.ward;
          let v = 0;
          if (kind === 'magic') v = (ranged.length + casters.length) * 7;
          else if (kind === 'missiles') v = ranged.filter((f) => !G.Magic.maxSP(chars[f])).length * 8;
          consider(v, cast({ target: t.id }), o);
        }
      } else if (s.shape === 'restore') {
        // Restore: the downed first, then the bleeding, the afflicted and the worn out. Wide
        // reaches everyone around the target, so foes there count against it.
        const share = s.radius ? G.CONFIG.magic.heal.areaShare : 1;
        for (const t of o.targets) {
          if (!t.inReach) continue;
          const around = s.radius ? enc.ids.filter((o2) => chars[o2] && !chars[o2].status.dead && enc.pos[o2] && Combat.dist(posOf(o2), posOf(t.id)) <= s.radius) : [t.id];
          let v = 0;
          for (const o2 of around) {
            const x = chars[o2];
            const friend = x.side === c.side || (x.charmed && x.charmed.side === c.side);
            v += (friend ? 1 : -1) * restoreValue(x, s, share);
          }
          consider(v, cast({ target: t.id }), o);
        }
      } else if (o.target === 'ally') {
        const key = N.boon;
        for (const t of o.targets) {
          if (!t.inReach) continue;
          const a = chars[t.id];
          if (Cn.has(a, key)) continue;
          let v = 0;
          const fighting = engaged(t.id);
          if (key === 'innervated') v = (C.bleedPerRound(a) >= 1 ? 18 : 0) + (a.damage.CON ? 6 : 0);
          else if (key === 'freedom') v = (!Cn.canMove(a) || a.status.webbed) ? 20 : 0;
          else if (key === 'hasted') v = fighting || t.id === id ? 14 : 4;
          else if (['stoneskin', 'barkskin', 'shielded'].includes(key)) v = fighting ? 12 : 0;
          else if (key === 'kindled') v = fighting && t.id !== id ? 10 : 0;
          else if (key === 'frostWard') v = 0;
          else if (key === 'foresight') v = fighting ? 12 : 0;
          else if (key === 'empowered' || key === 'deft') v = fighting && t.id !== id ? 10 : 0;
          else if (key === 'shrouded') v = foes.some((f) => C.attackOptions(chars[f]).some((x) => x.ranged)) ? 10 : 0;
          else if (key === 'unseen') v = t.id === id && foes.some((f) => Combat.dist(posOf(f), me) <= Math.max(1, meleeReach(chars[f])) + 1) ? 16 : 0;
          else if (key === 'steadied' || key === 'resolute') v = foes.some((f) => G.Magic.maxSP(chars[f]) > 0) ? 8 : 0;
          consider(v, cast({ target: t.id }), o);
        }
      } else if (s.shape === 'blink') {
        // Out of a melee I'm losing (a caster), or out of a hold or roots.
        const stuck = C.isActive(c) && (Combat.linkOf(c) || !Cn.canMove(c));
        const pressed = foes.some((f) => Combat.dist(posOf(f), me) <= Math.max(1, meleeReach(chars[f])));
        if (!stuck && !(pressed && meleeReach(c) <= 1)) continue;
        let spot = null, far = -1;
        for (let y = me.y - o.maxRange; y <= me.y + o.maxRange; y++) for (let x = me.x - o.maxRange; x <= me.x + o.maxRange; x++) {
          if (!G.Terrain.passable(enc, x, y) || Combat.dist(me, { x, y }) < o.minRange || Combat.dist(me, { x, y }) > o.maxRange) continue;
          if (enc.ids.some((o2) => chars[o2] && !chars[o2].status.dead && posOf(o2).x === x && posOf(o2).y === y)) continue;
          const away = Math.min(...foes.map((f) => Combat.dist(posOf(f), { x, y })));
          if (away > far) { far = away; spot = { x, y }; }
        }
        if (spot && far >= 3) consider(stuck ? 30 : 22, cast({ at: spot }), o);
      } else if (s.shape === 'area') {
        // Aim at a foe or a square beside one, so a burst can catch foes pressed close without
        // catching the caster.
        const seen = {};
        for (const f of foes) {
          const fp = posOf(f);
          for (let dx = -s.radius; dx <= s.radius; dx++) for (let dy = -s.radius; dy <= s.radius; dy++) {
            const p = { x: fp.x + dx, y: fp.y + dy };
            if (seen[p.x + ',' + p.y] || !G.Terrain.inGrid(enc, p.x, p.y)) continue;
            seen[p.x + ',' + p.y] = true;
            const d = Combat.dist(me, p);
            if (d > o.maxRange || d < o.minRange || d <= s.radius) continue;
            if (G.Terrain && enc.tiles && d >= 2 && G.Terrain.lineCheck(enc, me, p, 'missile').blocked) continue;
            const hitF = inArea(foes, p, s.radius), hitA = inArea(allies, p, s.radius);
            // A Delayed spell is seen coming: foes may step out of it before it breaks.
            consider((hitF.length - 1.5 * hitA.length) * s.magnitude * 2.2 * (s.delayed ? 0.55 : 1), cast({ at: p }), o);
          }
        }
      } else if (s.shape === 'ground') {
        for (const f of foes) {
          const p = posOf(f);
          const d = Combat.dist(me, p);
          if (d > o.maxRange) continue;
          const hitF = inArea(foes, p, s.radius), hitA = inArea(allies, p, s.radius);
          if (hitA.length) continue;
          consider(hitF.length * 7 + (closing && closing.f === f && closing.d >= 2 ? 6 : 0), cast({ at: p }), o);
        }
      } else if ((s.shape === 'wall' || s.shape === 'terrain') && closing && closing.d >= 2 && closing.d <= 7) {
        // Across the way of the nearest melee foe: a square or two in front of me, or (a pit)
        // right under them.
        const fp = posOf(closing.f);
        const step = (k) => ({ x: me.x + Math.round(((fp.x - me.x) * k) / closing.d), y: me.y + Math.round(((fp.y - me.y) * k) / closing.d) });
        const at = s.shape === 'terrain' ? fp : step(Math.min(2, closing.d - 1));
        if (Combat.dist(me, at) > o.maxRange || Combat.dist(me, at) < o.minRange) continue;
        if (allies.some((a) => a !== id && Combat.dist(posOf(a), at) <= 1)) continue;
        if (s.shape === 'wall' && enc.tiles && G.Terrain.at(enc, at.x, at.y).some((t) => G.CONFIG.terrain[t.kind].wall)) continue;
        // A wall that stops a body is worth far more than one that only singes it.
        const stops = s.shape === 'terrain' || !!G.CONFIG.terrain[G.CONFIG.magic.words[s.noun].wall].wall;
        consider(s.shape === 'terrain' ? 24 : stops ? 26 : 8, cast({ at }), o);
      } else if (s.shape === 'rune' && closing && closing.d >= 2 && closing.d <= 6) {
        const fp = posOf(closing.f);
        const at = { x: me.x + Math.sign(fp.x - me.x), y: me.y + Math.sign(fp.y - me.y) };
        if (G.Terrain.at(enc, at.x, at.y).some((t) => t.kind === 'rune')) continue;
        consider(s.magnitude * 2.5, cast({ at }), o);
      } else if (s.shape === 'raise' && foes.length) {
        // Raising the fallen turns a body against its friends: worth more than a summoned beast, and more the
        // stronger what rises (a skeleton, a zombie, a revenant with the body's own strength and gear).
        // The body rises where it lies, within the spell's range.
        const body = enc.ids.find((o2) => chars[o2] && chars[o2].status.dead && !chars[o2].vanished && !chars[o2].raised && enc.pos[o2] && Combat.dist(enc.pos[o2], me) <= o.maxRange);
        if (body) consider({ skeleton: 50, zombie: 70, revenant: 110 }[N.raise] || 60, cast({ at: enc.pos[body] }), o);
      } else if (s.shape === 'conjure' && !conjuredUp && foes.length) {
        const at = { x: me.x + (foes.length ? Math.sign(posOf(foes[0]).x - me.x) : 1), y: me.y };
        if (!G.Terrain.passable(enc, at.x, at.y) || enc.ids.some((o2) => chars[o2] && !chars[o2].status.dead && posOf(o2).x === at.x && posOf(o2).y === at.y)) continue;
        consider(30, cast({ at }), o);
      }
    }
    return best;
  }

  function planMove(enc, chars, id, la, targetId, goal, foes, avoid) {
    if (!la.move) return null;
    const c = chars[id];
    const from = la.move.from;
    const tp = Combat.projectedPos(enc, targetId);
    const cur = Combat.dist(from, tp);
    const step = la.move.maxSquares;
    const taken = new Set();
    for (const o of enc.ids) if (o !== id && C.isActive(chars[o])) { const q = Combat.projectedPos(enc, o); taken.add(q.x + ',' + q.y); }
    const foePos = foes.map((f) => Combat.projectedPos(enc, f));
    // Opportunity strikes: a route that enters a foe's reach, leaves it, or takes two steps within it
    // gives that foe a free blow (about half its worth; less from one who has had its turn).
    const wary = wariness(enc);
    const provokers = G.CONFIG.opportunityStrikes ? foes.map((f) => {
      const foe = chars[f];
      let reach = 0, worst = 0;
      for (const o of C.attackOptions(foe)) {
        if (o.ranged || o.spell || o.windUp) continue;
        reach = Math.max(reach, o.maxRange || 1);
        worst = Math.max(worst, hitValue(foe, c, o, Math.min(o.maxRange || 1, 2)));
      }
      return { at: Combat.projectedPos(enc, f), reach, cost: worst * (enc.turnDone[f] ? 0.25 : 0.5) * wary };
    }).filter((p) => p.reach) : [];
    // With terrain about: walk around walls (cost map), keep out of hazards this side can see.
    const terrain = G.Terrain && enc.tiles && Object.keys(enc.tiles).length;
    const map = terrain ? G.Terrain.costMap(enc, from, c) : null;
    let best = null;
    const x0 = Math.max(0, from.x - step), x1 = Math.min(enc.grid.w - 1, from.x + step);
    const y0 = Math.max(0, from.y - step), y1 = Math.min(enc.grid.h - 1, from.y + step);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const dx = x - from.x, dy = y - from.y;
        if ((!dx && !dy) || taken.has(x + ',' + y)) continue;
        let squares = Math.max(Math.abs(dx), Math.abs(dy)), hazard = 0;
        if (map) {
          const k = map.cost[map.idx(x, y)];
          if (k === Infinity) continue;
          squares = Math.round(k);
          for (const q of G.Terrain.trace(map, from, x, y)) hazard += G.Terrain.danger(enc, q.x, q.y, c.side, c);
        }
        const need = C.moveCost(c, squares);
        if (need > la.ap) continue;
        const dd = Combat.dist({ x, y }, tp);
        let score = Math.abs(dd - goal) * 10 + need / C.costScale() + hazard;
        for (const p of provokers) {
          const inFrom = Combat.dist(from, p.at) <= p.reach, inTo = Combat.dist({ x, y }, p.at) <= p.reach;
          if (inFrom !== inTo || (inFrom && squares >= 2)) score += p.cost * 2;
        }
        if (avoid) {
          // Stay out of every foe's reach if possible, and out of corners you can't leave.
          for (const fp of foePos) if (Combat.dist({ x, y }, fp) <= avoid) score += 25;
          const edge = Math.min(x, y, enc.grid.w - 1 - x, enc.grid.h - 1 - y);
          if (edge === 0) score += 4;
          if (Math.min(x, enc.grid.w - 1 - x) === 0 && Math.min(y, enc.grid.h - 1 - y) === 0) score += 8;
        }
        if (!best || score < best.score) best = { x, y, dd, need, score };
      }
    }
    if (!best) return null;
    if (avoid) {
      // A retreat must actually gain distance from the nearest threat.
      const near = (p) => Math.min(...foePos.map((fp) => Combat.dist(p, fp)));
      if (near({ x: best.x, y: best.y }) <= near(from) && Math.abs(best.dd - goal) >= Math.abs(cur - goal)) return null;
    } else if (Math.abs(best.dd - goal) >= Math.abs(cur - goal)) return null;
    return { actor: id, type: 'move', to: { x: best.x, y: best.y } };
  }

  function choose(enc, chars, id, rng, policy) {
    rng = rng || Math.random;
    const P = Object.assign({}, DEFAULTS, policy || {});
    const c = chars[id];
    const la = Combat.legalActions(enc, chars, id);
    const ap = la.ap;
    const endTurn = { actor: id, type: 'endTurn' };
    if (P.grappler == null) P.grappler = C.rank(c, 'grappler') > 0;
    // AP to keep back for defences against foes still to act this round, and whether this turn
    // has already done something (after the first action, the reserve is not dipped into).
    const reserve = reserveAP(enc, chars, id, P);
    const acted = enc.decls.some((d) => d.actor === id && d.round === enc.round && !d.reaction && !d.opportunity);
    const S = C.costScale();
    let foes = enemiesOf(enc, chars, id);
    // In a frenzy (Rage) the nearest body is the foe, friend or not; confused, anyone near.
    if (G.Conditions && (G.Conditions.flag(c, 'berserk') || (G.Conditions.flag(c, 'confused') && rng() < 0.5))) {
      const me = Combat.projectedPos(enc, id);
      const near = enc.ids.filter((o) => o !== id && chars[o] && C.isActive(chars[o])).sort((x, y) => Combat.dist(me, Combat.projectedPos(enc, x)) - Combat.dist(me, Combat.projectedPos(enc, y)));
      if (near.length) foes = G.Conditions.flag(c, 'confused') ? [near[Math.floor(rng() * Math.min(3, near.length))]] : [near[0]];
    }
    const at = (x) => enc.pos[x];

    // 1. Get up; tear free of webs.
    const stand = la.other.find((o) => o.type === 'standUp' && o.affordable);
    if (stand) return { actor: id, type: 'standUp' };
    const tear = la.other.find((o) => o.type === 'tearFree' && o.affordable);
    if (tear && rng() < 0.7) return { actor: id, type: 'tearFree' };
    const flee = fleeFrom(enc, chars, id, la);
    if (flee && !enc.decls.some((d) => d.actor === id && d.round === enc.round && d.type === 'move')) return flee;

    // 2. Release a wound-up blow at whoever is in range.
    for (const atk of la.attacks) {
      if (!atk.windUp || !atk.affordable) continue;
      const t = atk.targets.filter((x) => x.inReach && foes.includes(x.id)).sort((x, y) => hitValue(c, chars[y.id], atk, y.distance) - hitValue(c, chars[x.id], atk, x.distance))[0];
      if (t) return { actor: id, type: 'strike', option: atk, target: t.id };
    }

    // 2b. Grappling: work the ladder (grapplers), or get loose (everyone else).
    const gm = (type) => la.maneuvers.find((m) => m.type === type && m.affordable);
    const link = la.grapple;
    if (link) {
      const partner = chars[link.partner];
      if (link.role === 'held') {
        const br = gm('break');
        return br ? { actor: id, type: 'break', target: link.partner } : endTurn;
      }
      if (link.role === 'holder') {
        if (P.grappler && link.level === 'hold' && gm('pin')) return { actor: id, type: 'pin', target: link.partner };
        // Pinned (or not a grappler): stab if a dagger works, else throw.
        const stab = la.attacks.find((o) => o.affordable && !o.why && o.weaponType && G.DATA.WEAPONS[o.weaponType].dagger && o.targets.some((t) => t.id === link.partner && t.inReach));
        if (stab && (link.level === 'pin' || !gm('throw'))) return { actor: id, type: 'strike', option: stab, target: link.partner };
        if (gm('throw')) return { actor: id, type: 'throw', target: link.partner };
      }
      if (link.level === 'clinch') {
        if (P.grappler && gm('grapple')) return { actor: id, type: 'grapple', target: link.partner };
        // Not a grappler: stay and fight if something works up close, else break away.
        const close = la.attacks.filter((o) => o.affordable && !o.why && !o.unarmed);
        const hereRate = bestRate(c, partner, close, 1);
        if ((hereRate < 1 || C.rank(partner, 'grappler') > C.rank(c, 'grappler')) && gm('break')) return { actor: id, type: 'break', target: link.partner };
      }
    } else if (P.grappler) {
      const cl = gm('clinch');
      const t = cl && cl.targets.find((x) => x.inReach && foes.includes(x.id));
      if (t) return { actor: id, type: 'clinch', target: t.id };
    }

    // 4. Bandage, re-arm.
    const band = la.other.find((o) => o.type === 'bandage' && o.affordable);
    if (band && C.bleedPerRound(c) >= 1.5 && band.targets.some((t) => t.id === id)) return { actor: id, type: 'bandage', target: id };
    if (!C.wieldedWeapon(c)) {
      const draw = la.other.find((o) => (o.type === 'drawSidearm' || o.type === 'pickUp') && o.affordable);
      if (draw) return { actor: id, type: draw.type };
    }
    if (!foes.length) return { actor: id, type: 'concede' };

    const near = pickTarget(enc, chars, id, foes, at);
    const target = chars[near.id];
    // Everything this loadout can do, counting wind-up attacks at their full cost.
    const planBase = la.attacks.filter((o) => !o.why || (o.windUp && WIND_REASONS.includes(o.why))).map((o) => forPlanning(c, o));

    // 5. Switch weapons when another fits the current distance much better.
    const primaryOnGround = c.status.dropped.includes((c.weapons.find((w) => w.id !== c.sidearm) || {}).id);
    const swap = la.other.find((o) => (o.type === 'drawSidearm' || o.type === 'readyPrimary' || (o.type === 'pickUp' && primaryOnGround)) && o.affordable);
    const winding = c.status.windUp || enc.decls.some((d) => d.actor === id && d.type === 'windUp');
    if (swap && !winding) {
      const nowOpts = planBase.filter((o) => !o.unarmed);
      const altId = swap.type === 'drawSidearm' ? c.sidearm : c.weapons.find((w) => w.id !== c.sidearm).id;
      const alt = optionsWith(c, altId).filter((o) => !(o.ranged && C.ammoLeft(c, o) <= 0));
      const threatHere = RISK * foeRate(target, c, near.d);
      const nowR = bestRate(c, target, nowOpts, near.d) - threatHere;
      const altR = bestRate(c, target, alt, near.d) - threatHere;
      const nowPref = preferredDistance(c, target, nowOpts, near.d, wariness(enc));
      const altPref = preferredDistance(c, target, alt, near.d, wariness(enc));
      // Swap if the other weapon is much better right here, or its best distance is
      // much better than this weapon's best distance (and reachable).
      const canReach = la.move && Math.abs(altPref.d - near.d) <= la.move.maxSquares;
      const hereBetter = bestRate(c, target, alt, near.d) > 0 && altR > Math.max(nowR, 0) * 1.5 + 0.5;
      const thereBetter = canReach && altPref.net > Math.max(nowPref.net, nowR) * 1.5 + 0.5;
      if (hereBetter || thereBetter) {
        return { actor: id, type: swap.type };
      }
    }

    // 5b. Inside my reach with nothing that works there: shove them back out (or step away).
    const shove = la.maneuvers.find((m) => m.type === 'shove' && m.affordable);
    const armed = planBase.filter((o) => !o.unarmed);
    if (shove && near.d === 1 && armed.length && bestRate(c, target, armed, 1) === 0 && !winding) {
      const t = shove.targets.find((x) => x.id === near.id && x.inReach);
      if (t && Combat.shoveOdds(c, target) >= 0.4) return { actor: id, type: 'shove', target: near.id };
    }

    // 6. Occasionally trip or grapple a standing foe in reach.
    if (rng() < P.maneuverRate) {
      for (const m of la.maneuvers) {
        if (!m.affordable || m.type === 'disarm' || m.type === 'bait' || m.type === 'readIntent') continue;
        if (Combat.GRAPPLE_STEPS.includes(m.type) && !C.rank(c, 'grappler') && P.maneuverRate < 0.3) continue;
        const t = m.targets.find((x) => x.inReach && foes.includes(x.id) && !chars[x.id].status.prone);
        if (t) return { actor: id, type: m.type, target: t.id };
      }
    }

    const keep = spReserve(enc, chars, id, la);
    const usable = la.attacks.filter((o) => !o.windUp && !o.why && !(o.spell && G.Magic.availableSP(c) - o.spCost < keep));
    // A ranged loadout kites only if its ranged blows are worth at least as much as its blade:
    // a knight with a bolt spell still closes in; a bowman or a mage backs away.
    const rangedOpts = planBase.filter((o) => o.ranged && !o.unarmed);
    const meleeOpts = planBase.filter((o) => !o.ranged && !o.unarmed);
    const bestOver = (opts, ds) => Math.max(0, ...ds.map((d) => bestRate(c, target, opts, d)));
    const rangedLoadout = rangedOpts.length > 0 && (!meleeOpts.length || bestOver(rangedOpts, [2, 3, 4, 5, 6]) >= bestOver(meleeOpts, [1, 2, 3]));
    // A kiting loadout plans its distance around its ranged options only.
    const planOpts = rangedLoadout && P.kite ? planBase.filter((o) => o.ranged) : planBase.filter((o) => !o.unarmed).length ? planBase.filter((o) => !o.unarmed) : planBase;
    const pref = preferredDistance(c, target, planOpts, near.d, wariness(enc));

    // 7. Ranged characters step out of melee reach before shooting.
    if (P.kite && rangedLoadout && la.move) {
      const reach = threatReach(chars, foes);
      if (near.d <= reach + 1 && ap >= C.moveCost(c, 2) + S) {
        const mv = planMove(enc, chars, id, la, near.id, Math.max(pref.d, reach + 2), foes, reach);
        // Backing off draws a blow from every foe whose reach I'm in: only worth it against a light one.
        if (mv && Combat.dist(mv.to, Combat.projectedPos(enc, near.id)) > near.d && leaveCost(enc, chars, id) <= 3) return mv;
      }
    }

    // 7a. Bait a foe who will defend (one still to take their turn, so likely with AP in hand), or
    // read the intent of the one I'm fighting, when there's AP left after it for a blow.
    const bait = la.maneuvers.find((m) => m.type === 'bait' && m.affordable);
    const blowAP = Math.min(...usable.filter((o) => !o.spell).map((o) => o.ap).concat([99]));
    if (bait && !acted && la.ap >= bait.ap + Math.min(blowAP, 99) + reserve && blowAP < 99) {
      const guarded = bait.targets.find((x) => x.inReach && foes.includes(x.id) && !enc.turnDone[x.id] && usable.some((o) => C.inRange(o, x.distance)));
      if (guarded && Math.floor(C.attr(c, 'CHA') / 2) + C.rank(c, 'feint') >= Math.floor(C.attr(chars[guarded.id], 'WIS') / 2)) return { actor: id, type: 'bait', target: guarded.id };
    }
    const read = la.maneuvers.find((m) => m.type === 'readIntent' && m.affordable);
    // One look a round: a misread leaves nothing to show for it, so don't keep trying.
    const readThisRound = enc.decls.some((d) => d.actor === id && d.type === 'readIntent');
    if (read && !readThisRound && G.Conditions && !G.Conditions.has(c, 'reading') && la.ap >= read.ap + 2 * C.costScale()) {
      const close = read.targets.find((x) => x.inReach && x.distance <= 2 && foes.includes(x.id));
      if (close && Math.floor(C.attr(c, 'WIS') / 2) + C.rank(c, 'read_attack') >= Math.floor(C.attr(chars[close.id], 'CHA') / 2)) return { actor: id, type: 'readIntent', target: close.id };
    }

    // 8. Attack now, or wind up for a bigger blow next round.
    let best = null;
    for (const atk of usable) {
      if (!atk.affordable) continue;
      for (const t of atk.targets) {
        if (!t.inReach || !foes.includes(t.id)) continue;
        let v = rate(c, chars[t.id], atk, t.distance) * P.kickBias ** (atk.unarmed === 'kick' ? 1 : 0);
        // Digging into the AP kept for defence: never after the first action of the turn; the first
        // blow is still worth something, a little less.
        if (la.ap - atk.ap < reserve) { if (acted) continue; v *= 0.85; }
        if (!best || v > best.v) best = { v, decl: { actor: id, type: 'strike', option: atk, target: t.id } };
      }
    }
    const winds = la.other.filter((o) => o.type === 'windUp' && o.affordable);
    // Spells cast at squares, foes or friends, when one is worth more than the best blow.
    const castBest = castChoice(enc, chars, id, la, foes);
    if (castBest && castBest.v > (best ? best.v : 0)) return castBest.decl;
    if (winds.length && P.windUp > 0 && !acted) {
      let bestW = null;
      for (const w of winds) {
        const release = la.attacks.find((o) => C.optionKey(o) === C.optionKey(w.option)) || w.option;
        // Don't wind up a close-range blow you intend to kite away from.
        if (rangedLoadout && P.kite && !release.ranged && near.d > (release.maxRange || 1)) continue;
        const d = C.inRange(release, near.d) ? near.d : Math.min(Math.max(near.d, release.minRange || 1), release.maxRange);
        const dmg = hitValue(c, target, release, d);
        // Spread over both rounds' AP, discounted for the risk of losing it.
        const v = ((dmg * S) / (w.ap + release.ap)) * 0.8 * P.windUp;
        // Close enough that the blow can land next round (the foe may be walking in now).
        const soon = Math.min(near.d, Combat.dist(Combat.projectedPos(enc, id), Combat.projectedPos(enc, near.id)));
        const reachable = soon <= release.maxRange + Math.floor(la.move ? la.move.maxSquares / 2 : 0);
        if (reachable && (!bestW || v > bestW.v)) bestW = { v, decl: { actor: id, type: 'windUp', option: w.option } };
      }
      if (bestW && bestW.v > (best ? best.v : 0) * 1.15) return bestW.decl;
    }
    // Step to a better distance when it is clearly better than fighting from here.
    const hereNet = (best ? best.v : 0) - RISK * foeRate(target, c, near.d);
    if (la.move && !rangedLoadout && pref.d !== near.d && pref.net > hereNet + Math.max(1, Math.abs(hereNet)) + leaveCost(enc, chars, id) && ap >= C.moveCost(c, Math.abs(pref.d - near.d)) + S) {
      const mv = planMove(enc, chars, id, la, near.id, pref.d, foes, 0);
      if (mv) return mv;
    }
    if (best && best.v > 0.2) return best.decl;

    // 9. Move toward the distance this loadout likes best.
    const goal = pref.rate > 0 ? pref.d : 1;
    const mv = planMove(enc, chars, id, la, near.id, goal, foes, rangedLoadout && P.kite ? threatReach(chars, foes) : 0);
    if (mv) return mv;
    return endTurn;
  }

  G.AI = { choose, react, reserveAP, hitValue, perceivedThreat, preferredDistance, DEFAULTS };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
