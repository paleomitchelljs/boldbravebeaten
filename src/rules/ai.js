/*
 * A declaration policy for computer-controlled combatants, also used by the
 * simulator. It only uses information the character could see: a strike hidden
 * by Feint is judged by what the attacker might be doing, not what they are doing.
 *
 * policy (all optional):
 *   maneuverRate  chance per declaration to try a trip/grapple when one is in reach (default 0.15)
 *   kickBias      multiplier on the value of kicks (default 1; the kick-spam test uses a large value)
 *   defendFloor   minimum expected value before spending AP on a defense (default 1.5)
 *   cautious      keep 2 AP spare during pass 1 to answer strikes (default true)
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const Combat = G.Combat;

  const DEFAULTS = { maneuverRate: 0.15, kickBias: 1, defendFloor: 1.5, cautious: true };

  // How much a hit is worth to the attacker, in stamina-equivalent points.
  // Attribute damage costs max stamina and bleeds; a hit that drops the target is worth most.
  function hitValue(attacker, target, option) {
    const h = Combat.computeHit(attacker, target, option);
    const attrDmg = h.toCON + h.slashToAttrs + h.bluntToCON;
    let v = attrDmg * 8 + h.bluntToStamina;
    if (h.toCON + h.bluntToCON >= C.attr(target, 'CON')) v += 60;
    else if (h.bluntToStamina >= target.stamina && target.stamina > 0) v += 40;
    return v;
  }

  const MANEUVER_THREAT = { trip: 8, grapple: 8, takedown: 12, disarm: 6 };

  // Threat of an incoming declaration, as the defender perceives it.
  function perceivedThreat(enc, chars, decl, viewerId) {
    const atk = chars[decl.actor];
    const me = chars[viewerId];
    if (decl.type !== 'strike') return { threat: MANEUVER_THREAT[decl.type] || 6, motion: 'maneuver' };
    const hidden = Combat.describeDecl(enc, chars, decl, viewerId).hidden;
    if (!hidden) return { threat: hitValue(atk, me, decl.option), motion: decl.option.motion };
    const opts = C.attackOptions(atk);
    if (!opts.length) return { threat: 4, motion: 'swing' };
    const mean = opts.reduce((t, o) => t + hitValue(atk, me, o), 0) / opts.length;
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
        let p = Combat.defenseOdds(c, o.type, motion);
        let value = p * threat;
        if (o.type === 'dodge' && C.rank(c, 'roll_with_it')) value += (1 - p) * 0.5 * threat;
        value -= (0.6 * o.ap) / C.apScale() + 0.3 * o.stamina;
        if (value >= P.defendFloor && (!best || value > best.value)) best = { value, decl: { actor: id, type: o.type, answers: d.n } };
      }
    }
    return best;
  }

  function choose(enc, chars, id, rng, policy) {
    rng = rng || Math.random;
    const P = Object.assign({}, DEFAULTS, policy || {});
    const c = chars[id];
    const la = Combat.legalActions(enc, chars, id);
    const ap = la.ap;

    // 1. Get up.
    const stand = la.other.find((o) => o.type === 'standUp' && o.affordable);
    if (stand) return { actor: id, type: 'standUp' };

    // 2. Defend against the most valuable-to-stop incoming attack.
    const def = chooseDefense(enc, chars, id, la, P);
    if (def) return def.decl;

    // 3. Escape a grapple.
    const esc = la.other.find((o) => o.type === 'escape' && o.affordable);
    if (esc) return { actor: id, type: 'escape' };

    // 4. Stop own bleeding if it is serious.
    const band = la.other.find((o) => o.type === 'bandage' && o.affordable);
    if (band && C.bleedPerRound(c) >= 1.5 && band.targets.some((t) => t.id === id)) return { actor: id, type: 'bandage', target: id };

    // 5. Pick up or draw a weapon if disarmed.
    if (!C.wieldedWeapon(c)) {
      const draw = la.other.find((o) => (o.type === 'drawSidearm' || o.type === 'pickUp') && o.affordable);
      if (draw) return { actor: id, type: draw.type };
    }

    const foes = enemiesOf(enc, chars, id);

    // 5b. Switch to the sidearm when it would hurt the nearest foe much more.
    const draw = la.other.find((o) => o.type === 'drawSidearm' && o.affordable);
    if (draw && foes.length && enc.pass === 1) {
      const near = foes.slice().sort((x, y) => Combat.dist(Combat.posAtPass(enc, id, enc.pass), Combat.posAtPass(enc, x, enc.pass)) - Combat.dist(Combat.posAtPass(enc, id, enc.pass), Combat.posAtPass(enc, y, enc.pass)))[0];
      const bestWith = () => Math.max(0, ...C.attackOptions(c).filter((o) => !o.unarmed).map((o) => hitValue(c, chars[near], o) / o.ap));
      const now = bestWith();
      const keep = c.wield;
      c.wield = c.sidearm;
      const alt = bestWith();
      c.wield = keep;
      if (alt > now * 1.5 + 0.5) return { actor: id, type: 'drawSidearm' };
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

    // 7. Attack: best value per AP among foes in reach.
    let best = null;
    for (const atk of la.attacks) {
      if (!atk.affordable) continue;
      for (const t of atk.targets) {
        if (!t.inReach || !foes.includes(t.id)) continue;
        let v = (hitValue(c, chars[t.id], atk) * C.apScale()) / Math.max(1, atk.ap);
        if (atk.unarmed === 'kick' || atk.unarmed === 'shieldBash') {
          // A knockdown is worth a lot: the target loses AP standing up and defends poorly.
          const tgt = chars[t.id];
          const pDown = tgt.status.prone ? 0 : Combat.knockdownOdds(c, tgt, C.rank(c, 'trip') ? G.CONFIG.maneuver.tripFeatBonus : 0, G.CONFIG.maneuver.kickKnockdownMargin);
          v = (v + (pDown * 10 * C.apScale()) / Math.max(1, atk.ap)) * P.kickBias;
        }
        if (P.cautious && enc.pass === 1 && ap - atk.ap < 2 * C.apScale() && la.ap > 3 * C.apScale()) v *= 0.75;
        if (!best || v > best.v) best = { v, decl: { actor: id, type: 'strike', option: atk, target: t.id } };
      }
    }
    if (best && best.v > 0.2) return best.decl;

    // 8. Close the distance to the nearest foe.
    if (la.move && foes.length) {
      const from = la.move.from;
      let target = null, td = Infinity;
      for (const f of foes) {
        const d = Combat.dist(from, Combat.projectedPos(enc, f));
        if (d < td) { td = d; target = f; }
      }
      const myReach = Math.max(1, ...la.attacks.map((a) => a.reach));
      if (td > myReach) {
        const tp = Combat.projectedPos(enc, target);
        const step = Math.min(td - 1, la.move.maxSquares);
        const occupied = (x, y) => enc.ids.some((o) => o !== id && C.isActive(chars[o]) && Combat.projectedPos(enc, o).x === x && Combat.projectedPos(enc, o).y === y);
        let best2 = null;
        for (let dx = -step; dx <= step; dx++) {
          for (let dy = -step; dy <= step; dy++) {
            const x = from.x + dx, y = from.y + dy;
            if (x < 0 || y < 0 || x >= enc.grid.w || y >= enc.grid.h) continue;
            if (occupied(x, y)) continue;
            const moved = Math.max(Math.abs(dx), Math.abs(dy));
            const need = C.moveCost(c, moved);
            if (need > ap || need === 0) continue;
            const dd = Combat.dist({ x, y }, tp);
            // Stop at our own reach; prefer the cheapest move that gets there.
            const score = Math.max(dd, myReach) * 10 + need;
            if (!best2 || score < best2.score) best2 = { x, y, dd, need, score };
          }
        }
        if (best2 && best2.dd < td) return { actor: id, type: 'move', to: { x: best2.x, y: best2.y } };
      }
    }
    return { actor: id, type: 'concede' };
  }

  G.AI = { choose, hitValue, perceivedThreat, DEFAULTS };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
