/*
 * A declaration policy for computer-controlled combatants, also used by the
 * simulator. It only uses information the character could see: a strike hidden
 * by Feint is judged by what the attacker might be doing, not what they are doing.
 *
 * choose() is called again and again during a character's turn until it returns
 * 'endTurn' (done for this pass) or 'concede' (done for the round).
 *
 * Each turn decision, in order:
 *   1. stand up; 2. release a wind-up if the target is in range; 3. ready a guard;
 *   4. escape, bandage, re-arm; 5. switch weapons when another fits the distance
 *   better; 6. occasional trip/grapple; 7. keep a ranged weapon out of melee;
 *   8. attack, or wind up when the delayed blow is worth more; 9. move toward the
 *   distance its weapons like best; 10. end the round.
 *
 * policy (all optional):
 *   maneuverRate  chance per declaration to try a trip/grapple when one is in reach (default 0.15)
 *   kickBias      multiplier on the value of kicks (default 1)
 *   defendFloor   minimum expected value before spending AP on a defense (default 1.5)
 *   cautious      think twice about spending the whole pass when a foe still to act can reach (default true)
 *   windUp        willingness to wind up (multiplier on its value; 0 = never; default 1)
 *   grappler      works up the grappling ladder: clinch, hold, pin, then stab or throw (default: has Grappler)
 *   kite          ranged characters back away from melee (default true)
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const Combat = G.Combat;

  const DEFAULTS = { maneuverRate: 0.15, kickBias: 1, defendFloor: 1.5, cautious: true, windUp: 1, kite: true, grappler: null };

  // How much a hit is worth to the attacker, in stamina-equivalent points.
  // Attribute damage costs max stamina and bleeds; a hit that drops the target is worth most.
  function hitValue(attacker, target, option, distance) {
    // Rust: worth the armor it eats, if there's metal to eat.
    if (option.rust) {
      const metal = target.armor && (G.CONFIG.archery.metalArmor || []).includes(target.armor.type) && target.armor.durability > 0;
      return metal ? Math.min(option.rust, target.armor.durability) * 1.0 : 0;
    }
    const h = Combat.computeHit(attacker, target, option, { distance: distance || (option.minRange || 1) + (option.closePenalty ? 1 : 0) });
    const attrDmg = h.toCON + h.slashToAttrs + h.bluntToCON;
    let v = attrDmg * (h.noBleed ? 5 : 8) + h.bluntToStamina;
    if (option.venom && h.toCON + h.slashToAttrs > 0) v += Math.min(option.venom.con, h.toCON + h.slashToAttrs) * option.venom.rounds * 6;
    if (h.toCON + h.bluntToCON >= C.attr(target, 'CON')) v += 60;
    else if (h.bluntToStamina >= target.stamina && target.stamina > 0) v += 40;
    return v;
  }

  // Value per (scaled) AP of an attack against a target at a distance.
  function rate(c, target, opt, d) {
    if (!C.inRange(opt, d)) return 0;
    if (opt.stamina && opt.stamina >= c.stamina) return 0; // can't pay for it
    let v = (hitValue(c, target, opt, d) * C.apScale()) / Math.max(1, opt.ap);
    if (opt.unarmed === 'kick' || opt.unarmed === 'shieldBash') {
      const pDown = target.status.prone ? 0 : Combat.knockdownOdds(c, target, C.rank(c, 'trip') ? G.CONFIG.maneuver.tripFeatBonus : 0, G.CONFIG.maneuver.kickKnockdownMargin);
      v += (pDown * 10 * C.apScale()) / Math.max(1, opt.ap);
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
    const d = Combat.dist(Combat.posAtPass(enc, atk.id, decl.pass), Combat.posAtPass(enc, viewerId, decl.pass));
    if (!hidden) return { threat: hitValue(atk, me, decl.option, d), motion: decl.option.motion };
    const opts = C.attackOptions(atk);
    if (!opts.length) return { threat: 4, motion: 'swing' };
    const mean = opts.reduce((t, o) => t + hitValue(atk, me, o, d), 0) / opts.length;
    return { threat: mean, motion: 'swing' };
  }

  function enemiesOf(enc, chars, id) {
    return enc.ids.filter((o) => chars[o].side !== chars[id].side && C.isActive(chars[o]));
  }

  // Ready a guard? Weighs attacks already declared at me that land this pass (aimed at
  // that attacker) and foes still to take their turn this pass who could reach me (a
  // general guard), against the guards already up.
  function chooseGuard(enc, chars, id, la, P) {
    const c = chars[id];
    const threats = [];
    for (const d of la.incoming) {
      if (!C.isActive(chars[d.actor]) || Combat.GRAPPLE_STEPS.includes(d.type)) continue; // guards don't meet grapples
      const { threat, motion } = perceivedThreat(enc, chars, d, id);
      threats.push({ threat, motion, prob: 1, against: d.actor, decl: d });
    }
    const myTurn = enc.order.indexOf(id);
    const me = Combat.posAtPass(enc, id, enc.pass);
    for (const f of enemiesOf(enc, chars, id)) {
      if (enc.order.indexOf(f) < myTurn || enc.turnDone[f] || Combat.passLeft(enc, f) <= 0) continue;
      const foe = chars[f];
      const d = Combat.dist(me, Combat.posAtPass(enc, f, enc.pass));
      let best = 0;
      for (const o of C.attackOptions(foe)) {
        if (!C.inRange(o, d) || o.ap > Combat.passLeft(enc, f) + Combat.passCap(enc, f)) continue;
        if (o.windUp && !(foe.status.windUp && foe.status.windUp.key === C.optionKey(o))) continue;
        if (o.ranged && o.weaponId && C.ammoLeft(foe, o) <= 0) continue;
        best = Math.max(best, hitValue(foe, c, o, d));
      }
      if (best > 0) threats.push({ threat: best, motion: 'swing', prob: 0.6, against: null });
    }
    threats.sort((x, y) => y.threat * y.prob - x.threat * x.prob);
    const open = threats.slice(la.guards.length); // the guards already up cover the worst ones
    let pick = null;
    for (const th of open.slice(0, 1)) {
      for (const o of la.defenses) {
        if (!o.affordable) continue;
        if (th.decl && Combat.defenseUnavailable(c, o.type, th.decl, chars, enc)) continue;
        const p = Combat.defenseOdds(c, o.type, th.motion);
        let value = p * th.threat * th.prob;
        if (o.type === 'dodge' && C.rank(c, 'roll_with_it')) value += (1 - p) * 0.5 * th.threat * th.prob;
        value -= (0.6 * o.ap) / C.apScale() + 0.3 * o.stamina;
        if (value >= P.defendFloor && (!pick || value > pick.value)) pick = { value, decl: { actor: id, type: o.type, against: th.against } };
      }
    }
    return pick;
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
  function preferredDistance(c, target, opts) {
    const myMax = Math.max(1, ...opts.map((o) => o.maxRange || 1));
    const theirMax = Math.max(1, ...C.attackOptions(target).map((o) => o.maxRange || 1));
    const top = Math.min(16, Math.max(myMax, theirMax + 1));
    let best = null, bestRaw = null;
    for (let d = 1; d <= top; d++) {
      const mine = bestRate(c, target, opts, d);
      if (mine <= 0) continue;
      const net = mine - RISK * foeRate(target, c, d);
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
    let best = null;
    const x0 = Math.max(0, from.x - step), x1 = Math.min(enc.grid.w - 1, from.x + step);
    const y0 = Math.max(0, from.y - step), y1 = Math.min(enc.grid.h - 1, from.y + step);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const dx = x - from.x, dy = y - from.y;
        if ((!dx && !dy) || taken.has(x + ',' + y)) continue;
        const need = C.moveCost(c, Math.max(Math.abs(dx), Math.abs(dy)));
        if (need > la.ap) continue;
        const dd = Combat.dist({ x, y }, tp);
        let score = Math.abs(dd - goal) * 10 + need / C.apScale();
        if (need > la.passLeft) score += 4; // lands a pass later
        if (avoid) {
          // Stay out of every foe's reach if possible.
          for (const fp of foePos) if (Combat.dist({ x, y }, fp) <= avoid) score += 25;
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
    // One move per pass: it lands at the end of the pass, so a second one would plan from a
    // square the character hasn't reached yet.
    const movedThisPass = enc.decls.some((d) => d.actor === id && d.type === 'move' && d.declaredPass === enc.pass);
    if (movedThisPass) la.move = null;
    // Foes who still take a turn this pass and can reach me.
    const myTurn = enc.order.indexOf(id);
    const threatened = enemiesOf(enc, chars, id).some((f) => enc.order.indexOf(f) > myTurn && !enc.turnDone[f] && Combat.passLeft(enc, f) > 0 &&
      foeRate(chars[f], c, Combat.dist(Combat.posAtPass(enc, id, enc.pass), Combat.posAtPass(enc, f, enc.pass))) > 0);
    const minDefense = Math.min(...['block', 'parry', 'dodge'].map((k) => C.actionCost(c, k).ap));
    const S = C.apScale();
    const foes = enemiesOf(enc, chars, id);
    const at = (x) => Combat.posAtPass(enc, x, enc.pass);

    // 1. Get up.
    const stand = la.other.find((o) => o.type === 'standUp' && o.affordable);
    if (stand) return { actor: id, type: 'standUp' };

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
        const stab = la.attacks.find((o) => o.affordable && !o.why && o.weaponType === 'dagger' && o.targets.some((t) => t.id === link.partner && t.inReach));
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

    // 3. Ready a guard against the attack most worth stopping.
    const def = chooseGuard(enc, chars, id, la, P);
    if (def) return def.decl;

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
      const nowPref = preferredDistance(c, target, nowOpts);
      const altPref = preferredDistance(c, target, alt);
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
        if (!m.affordable || m.type === 'disarm') continue;
        if (Combat.GRAPPLE_STEPS.includes(m.type) && !C.rank(c, 'grappler') && P.maneuverRate < 0.3) continue;
        const t = m.targets.find((x) => x.inReach && foes.includes(x.id) && !chars[x.id].status.prone);
        if (t) return { actor: id, type: m.type, target: t.id };
      }
    }

    const usable = la.attacks.filter((o) => !o.windUp && !o.why);
    const rangedLoadout = planBase.some((o) => o.ranged && !o.unarmed);
    // A kiting loadout plans its distance around its ranged options only.
    const planOpts = rangedLoadout && P.kite ? planBase.filter((o) => o.ranged) : planBase.filter((o) => !o.unarmed).length ? planBase.filter((o) => !o.unarmed) : planBase;
    const pref = preferredDistance(c, target, planOpts);

    // 7. Ranged characters step out of melee reach before shooting.
    if (P.kite && rangedLoadout && la.move) {
      const reach = threatReach(chars, foes);
      if (near.d <= reach + 1 && ap >= C.moveCost(c, 2) + S) {
        const mv = planMove(enc, chars, id, la, near.id, Math.max(pref.d, reach + 2), foes, reach);
        if (mv && Combat.dist(mv.to, Combat.projectedPos(enc, near.id)) > near.d) return mv;
      }
    }

    // 8. Attack now, or wind up for a bigger blow next round.
    let best = null;
    for (const atk of usable) {
      if (!atk.affordable) continue;
      for (const t of atk.targets) {
        if (!t.inReach || !foes.includes(t.id)) continue;
        let v = rate(c, chars[t.id], atk, t.distance) * P.kickBias ** (atk.unarmed === 'kick' ? 1 : 0);
        if (P.cautious && threatened && la.passLeft - atk.ap < minDefense) v *= 0.85;
        if (!best || v > best.v) best = { v, decl: { actor: id, type: 'strike', option: atk, target: t.id } };
      }
    }
    const winds = la.other.filter((o) => o.type === 'windUp' && o.affordable);
    if (winds.length && P.windUp > 0 && enc.pass <= 2) {
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
    if (la.move && !rangedLoadout && pref.d !== near.d && pref.net > hereNet + Math.max(1, Math.abs(hereNet)) && ap >= C.moveCost(c, Math.abs(pref.d - near.d)) + S) {
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

  G.AI = { choose, hitValue, perceivedThreat, preferredDistance, DEFAULTS };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
