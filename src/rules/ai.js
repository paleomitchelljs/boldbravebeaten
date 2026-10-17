/*
 * A declaration policy for computer-controlled combatants, also used by the
 * simulator. It only uses information the character could see: a strike hidden
 * by Feint is judged by what the attacker might be doing, not what they are doing.
 *
 * Each declaration, in order:
 *   1. stand up; 2. release a wind-up if the target is in range; 3. defend;
 *   4. escape, bandage, re-arm; 5. switch weapons when another fits the distance
 *   better; 6. occasional trip/grapple; 7. keep a ranged weapon out of melee;
 *   8. attack, or wind up when the delayed blow is worth more; 9. move toward the
 *   distance its weapons like best; 10. end the round.
 *
 * policy (all optional):
 *   maneuverRate  chance per declaration to try a trip/grapple when one is in reach (default 0.15)
 *   kickBias      multiplier on the value of kicks (default 1)
 *   defendFloor   minimum expected value before spending AP on a defense (default 1.5)
 *   cautious      keep some AP spare during pass 1 to answer strikes (default true)
 *   windUp        willingness to wind up (multiplier on its value; 0 = never; default 1)
 *   kite          ranged characters back away from melee (default true)
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const Combat = G.Combat;

  const DEFAULTS = { maneuverRate: 0.15, kickBias: 1, defendFloor: 1.5, cautious: true, windUp: 1, kite: true };

  // How much a hit is worth to the attacker, in stamina-equivalent points.
  // Attribute damage costs max stamina and bleeds; a hit that drops the target is worth most.
  function hitValue(attacker, target, option, distance) {
    const h = Combat.computeHit(attacker, target, option, { distance: distance || (option.minRange || 1) + (option.closePenalty ? 1 : 0) });
    const attrDmg = h.toCON + h.slashToAttrs + h.bluntToCON;
    let v = attrDmg * (h.noBleed ? 5 : 8) + h.bluntToStamina;
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
    return v;
  }

  const MANEUVER_THREAT = { trip: 8, grapple: 8, takedown: 12, disarm: 6 };

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

  function chooseDefense(enc, chars, id, la, P) {
    const c = chars[id];
    let best = null;
    for (const inc of la.defenses) {
      const d = inc.decl;
      if (!C.isActive(chars[d.actor])) continue;
      const { threat, motion } = perceivedThreat(enc, chars, d, id);
      for (const o of inc.options) {
        if (!o.affordable) continue;
        const p = Combat.defenseOdds(c, o.type, motion);
        let value = p * threat;
        if (o.type === 'dodge' && C.rank(c, 'roll_with_it')) value += (1 - p) * 0.5 * threat;
        value -= (0.6 * o.ap) / C.apScale() + 0.3 * o.stamina;
        if (value >= P.defendFloor && (!best || value > best.value)) best = { value, decl: { actor: id, type: o.type, answers: d.n } };
      }
    }
    return best;
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
      if (o.ranged && o.weaponId && (foe.inventory.arrows || 0) <= 0) continue;
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

    // 3. Defend against the most valuable-to-stop incoming attack.
    const def = chooseDefense(enc, chars, id, la, P);
    if (def) return def.decl;

    // 4. Escape, bandage, re-arm.
    const esc = la.other.find((o) => o.type === 'escape' && o.affordable);
    if (esc) return { actor: id, type: 'escape' };
    const band = la.other.find((o) => o.type === 'bandage' && o.affordable);
    if (band && C.bleedPerRound(c) >= 1.5 && band.targets.some((t) => t.id === id)) return { actor: id, type: 'bandage', target: id };
    if (!C.wieldedWeapon(c)) {
      const draw = la.other.find((o) => (o.type === 'drawSidearm' || o.type === 'pickUp') && o.affordable);
      if (draw) return { actor: id, type: draw.type };
    }
    if (!foes.length) return { actor: id, type: 'concede' };

    const near = nearestFoe(enc, chars, id, foes, at);
    const target = chars[near.id];
    // Everything this loadout can do, counting wind-up attacks at their full cost.
    const planBase = la.attacks.filter((o) => !o.why || (o.windUp && WIND_REASONS.includes(o.why))).map((o) => forPlanning(c, o));

    // 5. Switch weapons when another fits the current distance much better.
    const swap = la.other.find((o) => (o.type === 'drawSidearm' || o.type === 'readyPrimary') && o.affordable);
    const winding = c.status.windUp || enc.decls.some((d) => d.actor === id && d.type === 'windUp');
    if (swap && !winding) {
      const nowOpts = planBase.filter((o) => !o.unarmed);
      const altId = swap.type === 'drawSidearm' ? c.sidearm : c.weapons.find((w) => w.id !== c.sidearm).id;
      const alt = optionsWith(c, altId).filter((o) => !(o.ranged && (c.inventory.arrows || 0) <= 0));
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
        if (m.type === 'grapple' && !C.rank(c, 'grappler') && P.maneuverRate < 0.3) continue;
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
        if (P.cautious && enc.pass === 1 && ap - atk.ap < 2 * S && la.ap > 3 * S) v *= 0.75;
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
    return { actor: id, type: 'concede' };
  }

  G.AI = { choose, hitValue, perceivedThreat, preferredDistance, DEFAULTS };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
