/*
 * A simple declaration policy for computer-controlled combatants.
 * Not clever: defend against the most dangerous incoming strike, otherwise hit
 * the most damaging affordable target in reach, otherwise close the distance.
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const Combat = G.Combat;

  // Rough threat score for one hit: CON damage is ~4 stamina (it lowers max stamina too).
  function hitValue(attacker, target, option) {
    const h = Combat.computeHit(attacker, target, option);
    return h.toCON * 5 + h.slashToAttrs * 5 + h.bluntToCON * 5 + h.bluntToStamina;
  }

  function enemiesOf(enc, chars, id) {
    return enc.ids.filter((o) => chars[o].side !== chars[id].side && C.isActive(chars[o]));
  }

  function choose(enc, chars, id, rng) {
    rng = rng || Math.random;
    const c = chars[id];
    const la = Combat.legalActions(enc, chars, id);
    const ap = la.ap;

    // 1. Get up.
    const stand = la.other.find((o) => o.type === 'standUp' && o.affordable);
    if (stand) return { actor: id, type: 'standUp' };

    // 2. Defend against the most threatening incoming attack.
    let bestDef = null;
    for (const inc of la.defenses) {
      const d = inc.decl;
      const threat = d.type === 'strike' ? hitValue(chars[d.actor], c, d.option) : 6;
      if (threat < 2) continue;
      const pref = ['block', 'parry', 'dodge'];
      for (const kind of pref) {
        const o = inc.options.find((x) => x.type === kind && x.affordable);
        if (o && (!bestDef || threat > bestDef.threat)) {
          bestDef = { threat, decl: { actor: id, type: kind, answers: d.n } };
          break;
        }
      }
    }
    if (bestDef && rng() < 0.85) return bestDef.decl;

    // 3. Stop own bleeding if it is serious.
    const band = la.other.find((o) => o.type === 'bandage' && o.affordable);
    if (band && C.bleedPerRound(c) >= 2 && band.targets.some((t) => t.id === id)) return { actor: id, type: 'bandage', target: id };

    // 4. Attack.
    const foes = enemiesOf(enc, chars, id);
    let best = null;
    for (const atk of la.attacks) {
      if (!atk.affordable) continue;
      for (const t of atk.targets) {
        if (!t.inReach || !foes.includes(t.id)) continue;
        let v = hitValue(c, chars[t.id], atk) / Math.max(1, atk.ap);
        // Keep some AP for defense early in the round.
        if (ap - atk.ap < 2 && enc.pass === 1) v *= 0.8;
        if (!best || v > best.v) best = { v, decl: { actor: id, type: 'strike', option: atk, target: t.id } };
      }
    }
    // Trip or grapple heavily armored foes occasionally.
    if (rng() < 0.15) {
      for (const m of la.maneuvers) {
        if (!m.affordable) continue;
        const t = m.targets.find((x) => x.inReach && foes.includes(x.id) && !chars[x.id].status.prone);
        if (t && (m.type === 'trip' || (m.type === 'grapple' && C.rank(c, 'grappler')))) return { actor: id, type: m.type, target: t.id };
      }
    }
    if (best && best.v > 0) return best.decl;

    // 5. Close the distance to the nearest foe.
    if (la.move && foes.length) {
      const from = la.move.from;
      let target = null, td = Infinity;
      for (const f of foes) {
        const d = Combat.dist(from, Combat.projectedPos(enc, f));
        if (d < td) { td = d; target = f; }
      }
      if (td > 1) {
        const tp = Combat.projectedPos(enc, target);
        const step = Math.min(td - 1, la.move.squaresPerAP * ap);
        const occupied = (x, y) => enc.ids.some((o) => o !== id && C.isActive(chars[o]) && Combat.projectedPos(enc, o).x === x && Combat.projectedPos(enc, o).y === y);
        let best2 = null;
        for (let dx = -step; dx <= step; dx++) {
          for (let dy = -step; dy <= step; dy++) {
            const x = from.x + dx, y = from.y + dy;
            if (x < 0 || y < 0 || x >= enc.grid.w || y >= enc.grid.h) continue;
            if (Math.max(Math.abs(dx), Math.abs(dy)) > step || occupied(x, y)) continue;
            const dd = Combat.dist({ x, y }, tp);
            const need = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / la.move.squaresPerAP);
            if (need > ap || need === 0) continue;
            if (!best2 || dd < best2.dd || (dd === best2.dd && need < best2.need)) best2 = { x, y, dd, need };
          }
        }
        if (best2 && best2.dd < td) return { actor: id, type: 'move', to: { x: best2.x, y: best2.y } };
      }
    }
    return { actor: id, type: 'concede' };
  }

  G.AI = { choose, hitValue };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
