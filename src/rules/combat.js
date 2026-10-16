/*
 * Combat engine: round structure, declarations, resolution, damage.
 *
 * Round (Mechanics Outline):
 *   1. Roll initiative; AP pool = f(SPD) − fatigue.
 *   2. Declaration passes in initiative order, one action per pass, until every
 *      character has spent all AP or conceded. No holding.
 *   3. Resolution: replay pass by pass. Actions within a pass are simultaneous;
 *      passes resolve in sequence.
 *   4. End of round: bleed, regeneration, fatigue.
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

  const ATTACK_TYPES = ['strike', 'trip', 'disarm', 'grapple', 'takedown'];
  const DEFENSE_TYPES = ['block', 'parry', 'dodge'];

  // ---- Encounter setup ---------------------------------------------------
  function createEncounter(name, ids, chars, w, h) {
    const enc = {
      id: Items.uid('enc'), name: name || 'Encounter', round: 0, phase: 'setup',
      ids: ids.slice(), grid: { w: w || 10, h: h || 8 }, pos: {},
      initiative: {}, order: [], ap: {}, apStart: {}, conceded: {}, pass: 1, turn: 0,
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
    enc.phase = 'initiative';
    enc.decls = [];
    enc.conceded = {};
    enc.hitThisRound = {};
    enc.fortressUsed = {};
    enc.pass = 1;
    enc.turn = 0;
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
    for (const id of enc.order) {
      enc.ap[id] = C.apPool(chars[id]);
      enc.apStart[id] = enc.ap[id];
    }
    log(enc, `Round ${enc.round} — initiative: ` + enc.order.map((id) => `${chars[id].name} ${enc.initiative[id]}`).join(', '), 'round');
    enc.phase = 'declare';
    if (!canDeclare(enc, enc.order[0])) advance(enc);
    return enc;
  }

  // ---- Declarations ------------------------------------------------------
  function canDeclare(enc, id) {
    return id != null && !enc.conceded[id] && (enc.ap[id] || 0) >= CONFIG.minActionAP;
  }

  function currentActor(enc) {
    return enc.phase === 'declare' ? enc.order[enc.turn] : null;
  }

  function advance(enc) {
    const n = enc.order.length;
    for (let step = 0; step < n * 2 + 1; step++) {
      enc.turn += 1;
      if (enc.turn >= n) {
        enc.turn = 0;
        if (!enc.order.some((id) => canDeclare(enc, id))) break;
        enc.pass += 1;
      }
      if (canDeclare(enc, enc.order[enc.turn])) return;
    }
    enc.phase = 'resolve';
  }

  function concede(enc, id) {
    enc.conceded[id] = true;
    advance(enc);
  }

  // Where a character will be after its own declared moves.
  function projectedPos(enc, id) {
    let p = enc.pos[id];
    for (const d of enc.decls) if (d.actor === id && d.type === 'move') p = d.to;
    return p;
  }

  // Where a character will stand when actions of the given pass resolve
  // (moves take effect at the end of their own pass).
  function posAtPass(enc, id, pass) {
    let p = enc.pos[id];
    for (const d of enc.decls) if (d.actor === id && d.type === 'move' && d.pass < pass) p = d.to;
    return p;
  }

  function isGrappled(c) {
    return c.status.grappledBy && c.status.grappledBy.length > 0;
  }

  // Everything the current actor may declare now, for the UI.
  function legalActions(enc, chars, id) {
    const c = chars[id];
    const ap = enc.ap[id] || 0;
    const me = posAtPass(enc, id, enc.pass);
    const others = enc.ids.filter((o) => o !== id && !chars[o].status.dead);
    const out = { ap, attacks: [], defenses: [], maneuvers: [], other: [], move: null };

    for (const opt of C.attackOptions(c)) {
      out.attacks.push(Object.assign({}, opt, {
        affordable: opt.ap <= ap,
        targets: others.map((o) => ({ id: o, inReach: dist(me, posAtPass(enc, o, enc.pass)) <= opt.reach })),
      }));
    }

    // Defenses against declared attacks aimed at me that I have not answered yet.
    const incoming = enc.decls.filter((d) => ATTACK_TYPES.includes(d.type) && d.target === id);
    for (const d of incoming) {
      if (enc.decls.some((x) => x.actor === id && x.answers === d.n)) continue;
      const opts = [];
      for (const kind of DEFENSE_TYPES) {
        const cost = C.actionCost(c, kind);
        const why = defenseUnavailable(c, kind, d, chars);
        opts.push({ type: kind, ap: cost.ap, stamina: cost.stamina, affordable: cost.ap <= ap && !why, why });
      }
      out.defenses.push({ decl: d, options: opts });
    }

    const reach = 1;
    const grappled = isGrappled(c);
    for (const kind of ['trip', 'disarm', 'grapple', 'takedown']) {
      if (kind === 'takedown' && !C.rank(c, 'takedown')) continue;
      if (c.status.prone || c.status.grappling) continue;
      const cost = C.actionCost(c, kind);
      let r = reach;
      if (kind === 'trip' && hookWeapon(c)) r = WEAPONS[C.wieldedWeapon(c).type].reach;
      out.maneuvers.push({
        type: kind, ap: cost.ap, stamina: cost.stamina, affordable: cost.ap <= ap && !(grappled && kind !== 'grapple'),
        targets: others.filter((o) => !chars[o].status.unconscious).map((o) => ({ id: o, inReach: dist(me, posAtPass(enc, o, enc.pass)) <= r })),
      });
    }

    if (!c.status.prone && !grappled && !c.status.grappling) {
      const spa = C.squaresPerAP(c);
      const cost1 = C.actionCost(c, 'move', { ap: 1 });
      out.move = { squaresPerAP: spa, maxAP: ap, stamina: cost1.stamina, from: projectedPos(enc, id) };
    }

    const addOther = (type, extra) => {
      const cost = C.actionCost(c, type);
      out.other.push(Object.assign({ type, name: ACTIONS[type].name, ap: cost.ap, stamina: cost.stamina, affordable: cost.ap <= ap }, extra || {}));
    };
    if (c.status.prone) addOther('standUp');
    const sidearm = c.weapons.find((w) => w.id === c.sidearm);
    if (sidearm && c.wield !== c.sidearm && c.status.dropped !== c.sidearm) addOther('drawSidearm');
    if (c.status.dropped) addOther('pickUp');
    if (grappled) addOther('escape');
    if (c.status.grappling) addOther('release');
    if (c.inventory.bandages > 0) {
      const patients = enc.ids.filter((o) => chars[o].bleeds.length > 0 && !chars[o].status.dead && (o === id || dist(me, posAtPass(enc, o, enc.pass)) <= 1));
      if (patients.length) addOther('bandage', { targets: patients.map((o) => ({ id: o, inReach: true })) });
    }
    return out;
  }

  function hookWeapon(c) {
    const w = C.wieldedWeapon(c);
    return w && WEAPONS[w.type].hook && C.rank(c, 'hook');
  }

  function defenseUnavailable(c, kind, attackDecl, chars) {
    const grapplers = c.status.grappledBy.map((g) => chars[g]).filter(Boolean);
    if (grapplers.some((g) => C.rank(g, 'pin'))) return 'Pinned';
    if (kind === 'block' && !C.shieldReady(c)) return 'No ready shield';
    if (kind === 'parry') {
      if (!C.wieldedWeapon(c)) return 'No weapon';
      const atk = chars[attackDecl.actor];
      if (attackDecl.option && attackDecl.option.motion === 'power' && atk && C.rank(atk, 'juggernaut')) return 'Juggernaut';
    }
    if (kind === 'dodge' && c.status.prone) return 'Prone';
    return null;
  }

  // Validate and record a declaration. Returns an error string or null.
  function declare(enc, chars, decl) {
    const id = currentActor(enc);
    if (decl.actor !== id) return 'Not your turn';
    const c = chars[id];
    let ap, stamina;
    if (decl.type === 'strike') {
      const opt = C.attackOptions(c).find((o) => o.label === decl.option.label && o.weaponId === decl.option.weaponId && !!o.halfSword === !!decl.option.halfSword);
      if (!opt) return 'Attack not available';
      decl.option = opt;
      ap = opt.ap;
      stamina = opt.stamina;
      if (!decl.target) return 'Choose a target';
    } else if (DEFENSE_TYPES.includes(decl.type)) {
      const atk = enc.decls.find((d) => d.n === decl.answers);
      if (!atk || atk.target !== id) return 'Choose a strike to answer';
      const why = defenseUnavailable(c, decl.type, atk, chars);
      if (why) return why;
      ({ ap, stamina } = C.actionCost(c, decl.type));
    } else if (decl.type === 'move') {
      const from = projectedPos(enc, id);
      const d = dist(from, decl.to);
      if (d === 0) return 'Pick a different square';
      const need = Math.ceil(d / C.squaresPerAP(c));
      ({ ap, stamina } = C.actionCost(c, 'move', { ap: need }));
      decl.from = from;
    } else {
      if (!ACTIONS[decl.type]) return 'Unknown action';
      ({ ap, stamina } = C.actionCost(c, decl.type));
      if (['trip', 'disarm', 'grapple', 'takedown', 'bandage'].includes(decl.type) && !decl.target) return 'Choose a target';
    }
    if (ap > enc.ap[id]) return 'Not enough AP';
    decl.ap = ap;
    decl.stamina = stamina;
    decl.pass = enc.pass;
    decl.n = ++enc.seq;
    if (decl.target) decl.targetWasDown = !C.isActive(chars[decl.target]);
    enc.decls.push(decl);
    enc.ap[id] -= ap;
    advance(enc);
    return null;
  }

  // How a declaration looks to a given viewer (Feint vs Read Attack).
  function describeDecl(enc, chars, d, viewerId) {
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
      const atk = enc.decls.find((x) => x.n === d.answers);
      return { text: `${a.name}: ${ACTIONS[d.type].name.toLowerCase()} vs. ${atk ? chars[atk.actor].name : '?'}'s strike [${d.ap} AP]` };
    }
    if (d.type === 'move') return { text: `${a.name}: move to (${d.to.x + 1}, ${d.to.y + 1}) [${d.ap} AP]` };
    return { text: `${a.name}: ${ACTIONS[d.type].name.toLowerCase()}${tn ? ' ' + tn : ''} [${d.ap} AP]` };
  }

  // ---- Damage pipeline ---------------------------------------------------
  // Pure: works out what a hit would do (before d4 hit-location rolls).
  function computeHit(attacker, target, option, flags) {
    flags = flags || {};
    const v = option.damage.slice();
    const st = target.status;
    const prone = st.prone;
    const grappled = isGrappled(target);
    if (prone) v[C.mainIndex(v)] += CONFIG.maneuver.proneDamageBonus;
    if (flags.half) for (let i = 0; i < 3; i++) v[i] = Math.floor(v[i] / 2);
    const [P, S, B] = v;
    const motion = option.motion === 'unarmed' ? 'swing' : option.motion;
    const res = { vec: v, P, S, B, armored: false, toCON: 0, slashToAttrs: 0, bluntToStamina: 0, bluntToCON: 0, converted: 0, durLoss: 0, mitigated: { P: 0, S: 0, B: 0 } };

    const unconscious = target.stamina <= 0;
    const weapon = option.weaponType ? WEAPONS[option.weaponType] : null;
    const coupDeGrace = weapon && option.weaponType === 'dagger' && C.rank(attacker, 'coup_de_grace') && (prone || grappled);
    const ai = C.armorInfo(target);
    const armored = target.armor && target.armor.durability > 0 && !unconscious && !coupDeGrace;

    if (armored) {
      res.armored = true;
      const mit = Object.assign({}, ai.effMit);
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
      if (option.halfSword || prone || grappled) pass = CONFIG.maneuver.pronePassThrough;
      pass = Math.min(1, pass);
      res.toCON = Math.round(Pr * pass);
      res.converted = Math.round(Sr * CONFIG.conversion[motion]);
      res.bluntToStamina = Br + res.converted;
      res.durLoss = target.armor.type === 'padded' ? 0 : B + res.converted;
    } else {
      res.toCON = P;
      res.slashToAttrs = S;
      if (unconscious) res.bluntToCON = B;
      else res.bluntToStamina = B;
    }
    return res;
  }

  // Apply a hit, rolling d4s for slashing. Returns a short description.
  async function applyHit(enc, chars, attacker, target, option, roller, flags) {
    const h = computeHit(attacker, target, option, flags);
    const parts = [];
    const st = target.status;

    if (h.armored && target.armor) {
      const before = target.armor.durability;
      target.armor.durability = Math.max(0, before - h.durLoss);
      if (h.mitigated.P + h.mitigated.S + h.mitigated.B > 0) parts.push(`armor stops ${h.mitigated.P}/${h.mitigated.S}/${h.mitigated.B}`);
      if (h.converted) parts.push(`${h.converted} slashing → blunt`);
      if (h.durLoss) parts.push(`armor durability −${h.durLoss}`);
    }

    let wound = 0;
    if (h.toCON > 0) {
      C.damageAttr(target, 'CON', h.toCON);
      parts.push(`${h.toCON} CON`);
      wound += h.toCON;
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
    if (wound > 0) {
      target.bleeds.push({ remaining: wound, rounds: CONFIG.bleedRounds });
      parts.push('bleeding');
    }
    if (!parts.length) parts.push('no effect');
    const wasDown = st.unconscious;
    C.updateCondition(target);
    let tail = '';
    if (st.dead) tail = ` ${target.name} is DEAD.`;
    else if (st.unconscious && !wasDown) tail = ` ${target.name} collapses, unconscious.`;
    return { text: `${h.P}/${h.S}/${h.B} P/S/B → ${parts.join(', ')}.${tail}`, hit: h };
  }

  // ---- Checks ------------------------------------------------------------
  const half = (n) => Math.floor((n - 5) / 2);

  async function defenseCheck(enc, chars, defender, kind, atkDecl, roller) {
    const D = CONFIG.defense;
    const motion = atkDecl.type === 'strike' ? atkDecl.option.motion : 'maneuver';
    let bonus = 0, tn = D[kind].tn, label = '';
    if (kind === 'block') {
      bonus = C.rank(defender, 'shield_training');
      label = `Block: d10 + ${bonus} ≥ ${tn}`;
    } else if (kind === 'parry') {
      bonus = C.rank(defender, 'parry_training') + half(C.combatAttr(defender, 'DEX'));
      tn += D.motionPenalty[motion] || 0;
      label = `Parry: d10 + ${bonus} ≥ ${tn}`;
    } else {
      bonus = C.rank(defender, 'dodge_training') + half(C.combatAttr(defender, 'SPD')) - C.armorInfo(defender).dex;
      tn += D.motionPenalty[motion] || 0;
      label = `Dodge: d10 + ${bonus} ≥ ${tn}`;
    }
    const r = await rollDie(roller, defender.id, D.die, `${defender.name}: ${ACTIONS[kind].name}`, label);
    return { ok: r + bonus >= tn, roll: r, total: r + bonus, tn };
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

  async function knockdownCheck(roller, atk, tgt, featBonus, label) {
    const aB = Math.floor(C.attr(atk, 'STR') / 2) + featBonus;
    return opposed(roller, atk, aB, label, tgt, stability(tgt), 'Keep footing');
  }

  function grappleStrength(chars, c) {
    const gs = c.status.grappledBy.map((g) => chars[g]).filter((g) => g && C.isActive(g));
    if (!gs.length) return 0;
    const vals = gs.map((g) => Math.floor(C.attr(g, 'STR') / 2) + C.rank(g, 'grappler'));
    vals.sort((x, y) => y - x);
    let total = vals[0];
    gs.forEach((g, i) => {
      if (i === 0) return;
      const frac = C.rank(g, 'dogpile') ? 1 : CONFIG.maneuver.dogpileFraction;
      total += Math.floor((Math.floor(C.attr(g, 'STR') / 2) + C.rank(g, 'grappler')) * frac);
    });
    return total;
  }

  function releaseGrapples(chars, c) {
    if (c.status.grappling) {
      const t = chars[c.status.grappling];
      if (t) t.status.grappledBy = t.status.grappledBy.filter((g) => g !== c.id);
      c.status.grappling = null;
    }
    for (const g of c.status.grappledBy) if (chars[g]) chars[g].status.grappling = null;
    c.status.grappledBy = [];
  }

  // ---- Resolution --------------------------------------------------------
  async function resolveRound(enc, chars, roller) {
    enc.phase = 'resolving';
    const passes = Math.max(0, ...enc.decls.map((d) => d.pass));
    for (let p = 1; p <= passes; p++) {
      const actsThisPass = enc.decls.filter((d) => d.pass === p && !DEFENSE_TYPES.includes(d.type));
      if (!actsThisPass.length) continue;
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
        if (a.status.prone || isGrappled(a) || a.status.grappling) {
          log(enc, `${a.name} can't move (${a.status.prone ? 'prone' : 'grappled'}).`, 'fizzle');
          continue;
        }
        const key = d.to.x + ',' + d.to.y;
        // Moves are in initiative order, so an earlier mover already holds the square.
        const occupied = enc.ids.some((o) => o !== d.actor && C.isActive(chars[o]) && enc.pos[o].x === d.to.x && enc.pos[o].y === d.to.y);
        if (claimed[key] || occupied) {
          log(enc, `${a.name}'s move is blocked.`, 'fizzle');
          continue;
        }
        if (!payStamina(enc, a, d.stamina)) continue;
        claimed[key] = d.actor;
        enc.pos[d.actor] = { x: d.to.x, y: d.to.y };
        log(enc, `${a.name} moves to (${d.to.x + 1}, ${d.to.y + 1}).`);
      }
    }
    endRound(enc, chars);
  }

  function payStamina(enc, c, cost) {
    if (!cost) return true;
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
      let reach = 1;
      if (d.type === 'strike') reach = d.option.reach;
      if (d.type === 'trip' && hookWeapon(a)) reach = WEAPONS[C.wieldedWeapon(a).type].reach;
      if (dist(posAtStart[d.actor], posAtStart[d.target]) > reach) {
        log(enc, `${a.name}'s ${d.type === 'strike' ? d.option.label : d.type} fizzles — ${t.name} is out of reach.`, 'fizzle');
        return;
      }
      if (d.type === 'strike' && d.option.weaponId && (a.wield !== d.option.weaponId || a.status.dropped === d.option.weaponId)) {
        log(enc, `${a.name} no longer holds that weapon; the strike fizzles.`, 'fizzle');
        return;
      }
      if (!payStamina(enc, a, d.stamina)) return;

      // Defenses that answer this attack.
      const name = d.type === 'strike' ? d.option.label : ACTIONS[d.type].name;
      const defs = enc.decls.filter((x) => x.actor === d.target && x.answers === d.n);
      let failedDodge = false;
      if (C.isActive(t)) {
        if (C.rank(t, 'untouchable') && !defs.some((x) => x.type === 'dodge')) {
          const dodge = enc.decls.find((x) => x.actor === t.id && x.type === 'dodge' && x.pass === d.pass);
          if (dodge) defs.push(Object.assign({}, dodge, { untouchable: true }));
        }
        for (const def of defs) {
          const why = defenseUnavailable(t, def.type, d, chars);
          if (why) {
            log(enc, `${t.name} can't ${def.type} (${why.toLowerCase()}).`, 'fizzle');
            continue;
          }
          if (!def.untouchable && !payStamina(enc, t, def.stamina)) continue;
          const chk = await defenseCheck(enc, chars, t, def.type, d, roller);
          if (chk.ok) {
            if (def.type === 'block') {
              await shieldAbsorb(enc, chars, a, t, d, roller);
            } else {
              log(enc, `${t.name} ${def.type === 'parry' ? 'parries' : 'dodges'} ${a.name}'s ${name} (${chk.total} vs ${chk.tn}).`, 'defend');
              if (def.type === 'parry' && C.rank(t, 'riposte')) await riposte(enc, chars, t, a, roller, posAtStart);
            }
            return;
          }
          log(enc, `${t.name}'s ${def.type} fails (${chk.total} vs ${chk.tn}).`, 'fail');
          if (def.type === 'dodge') failedDodge = true;
        }
      }

      if (d.type === 'strike') {
        const half = failedDodge && C.rank(t, 'roll_with_it');
        const r = await applyHit(enc, chars, a, t, d.option, roller, { half });
        log(enc, `${a.name}'s ${name} hits ${t.name}${half ? ' (Roll With It: half)' : ''}: ${r.text}`, 'hit');
        if ((d.option.unarmed === 'kick' || d.option.unarmed === 'shieldBash') && C.isActive(t) && !t.status.prone) {
          const k = await knockdownCheck(roller, a, t, C.rank(a, 'trip') ? CONFIG.maneuver.tripFeatBonus : 0, 'Knockdown');
          if (k.margin >= CONFIG.maneuver.kickKnockdownMargin) {
            t.status.prone = true;
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
      case 'drawSidearm':
        a.wield = a.sidearm;
        log(enc, `${a.name} draws ${Items.itemName(a.weapons.find((w) => w.id === a.sidearm))}.`);
        break;
      case 'pickUp':
        if (a.status.dropped) {
          a.wield = a.status.dropped;
          a.status.dropped = null;
          log(enc, `${a.name} picks up their weapon.`);
        }
        break;
      case 'escape': {
        const str = grappleStrength(chars, a);
        const bonus = Math.floor(Math.max(C.attr(a, 'STR'), C.combatAttr(a, 'DEX')) / 2) + (C.rank(a, 'escape_artist') ? CONFIG.maneuver.escapeArtistBonus : 0);
        const ra = await rollDie(roller, a.id, 10, `${a.name}: Escape`, `d10 + ${bonus}`);
        const g = chars[a.status.grappledBy[0]];
        const rb = g ? await rollDie(roller, g.id, 10, `${g.name}: Hold on`, `d10 + ${str}`) : 0;
        if (ra + bonus > rb + str) {
          releaseGrapples(chars, a);
          log(enc, `${a.name} breaks free (${ra + bonus} vs ${rb + str}).`, 'defend');
        } else log(enc, `${a.name} fails to escape (${ra + bonus} vs ${rb + str}).`, 'fail');
        break;
      }
      case 'release':
        if (a.status.grappling) {
          const t2 = chars[a.status.grappling];
          if (t2) t2.status.grappledBy = t2.status.grappledBy.filter((g) => g !== a.id);
          a.status.grappling = null;
          log(enc, `${a.name} releases their hold.`);
        }
        break;
      case 'bandage':
        if (t && a.inventory.bandages > 0) {
          a.inventory.bandages -= 1;
          t.bleeds = [];
          log(enc, `${a.name} bandages ${t === a ? 'themself' : t.name}; the bleeding stops.`, 'defend');
        }
        break;
    }
  }

  async function shieldAbsorb(enc, chars, a, t, d, roller) {
    const s = t.shield;
    const ss = Items.shieldStats(s);
    const v = d.type === 'strike' ? d.option.damage : [0, 0, 0];
    const W = CONFIG.shieldWear;
    const wear = Math.round(v[0] * W.P + v[1] * W.S + v[2] * W.B);
    s.durability = Math.max(0, s.durability - wear);
    let msg = `${t.name} blocks ${a.name}'s ${d.type === 'strike' ? d.option.label : d.type} with the shield (durability −${wear})`;
    let force = v[0] + v[1] + v[2];
    if (C.rank(a, 'shield_breaker')) force *= 2;
    if (force > ss.threshold) {
      const chance = Math.min(100, (force - ss.threshold) * CONFIG.shieldBreakPerPoint);
      const r = await rollDie(roller, a.id, 100, `${a.name}: Shield break`, `d100 ≤ ${chance} breaks it (force ${force} vs threshold ${ss.threshold})`);
      if (r <= chance) {
        s.durability = 0;
        msg += ' — the shield SHATTERS';
      }
    }
    if (s.durability <= 0 && !msg.includes('SHATTERS')) msg += ' — the shield is destroyed';
    log(enc, msg + '.', 'defend');
  }

  async function riposte(enc, chars, t, a, roller, posAtStart) {
    const w = C.wieldedWeapon(t);
    if (!w || !WEAPONS[w.type].faces.point) return;
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
    if (d.type === 'trip') {
      const bonus = (C.rank(a, 'trip') ? M.tripFeatBonus : 0) + (hookWeapon(a) ? 2 : 0);
      const k = await knockdownCheck(roller, a, t, bonus, 'Trip');
      if (k.margin > 0) {
        t.status.prone = true;
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
        t.status.dropped = w.id;
        log(enc, `${a.name} disarms ${t.name}; ${Items.itemName(w)} falls (${o.a} vs ${o.b}).`, 'hit');
      } else log(enc, `${a.name}'s disarm fails (${o.a} vs ${o.b}).`, 'fail');
    } else if (d.type === 'grapple' || d.type === 'takedown') {
      const aB = Math.floor(C.attr(a, 'STR') / 2) + C.rank(a, 'grappler');
      const bB = Math.floor(Math.max(C.attr(t, 'STR'), C.combatAttr(t, 'DEX')) / 2) + (C.rank(t, 'escape_artist') ? M.escapeArtistBonus : 0);
      const o = await opposed(roller, a, aB, d.type === 'takedown' ? 'Takedown' : 'Grapple', t, bB, 'Resist grapple');
      if (o.margin > 0 || t.status.unconscious) {
        if (!t.status.grappledBy.includes(a.id)) t.status.grappledBy.push(a.id);
        a.status.grappling = t.id;
        if (d.type === 'takedown') t.status.prone = true;
        log(enc, `${a.name} grapples ${t.name}${d.type === 'takedown' ? ' and takes them down' : ''} (${o.a} vs ${o.b}).`, 'hit');
      } else log(enc, `${a.name}'s grapple fails (${o.a} vs ${o.b}).`, 'fail');
    }
  }

  // ---- End of round ------------------------------------------------------
  function endRound(enc, chars) {
    log(enc, 'End of round', 'pass');
    for (const id of enc.ids) {
      const c = chars[id];
      if (c.status.dead) continue;
      // Bleed: each wound bleeds its damage again over its remaining rounds.
      let bleed = 0;
      for (const b of c.bleeds) {
        const loss = Math.round(b.remaining / b.rounds);
        b.remaining -= loss;
        b.rounds -= 1;
        bleed += loss;
      }
      c.bleeds = c.bleeds.filter((b) => b.rounds > 0 && b.remaining > 0);
      if (bleed > 0) {
        C.damageAttr(c, 'CON', bleed);
        log(enc, `${c.name} bleeds ${bleed} CON.`, 'bleed');
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
      if (c.status.unconscious) releaseGrapples(chars, c);
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
      c.status.prone = false;
      c.status.grappling = null;
      c.status.grappledBy = [];
      if (c.status.dropped) {
        c.wield = c.status.dropped;
        c.status.dropped = null;
      }
    }
  }

  G.Combat = {
    ATTACK_TYPES, DEFENSE_TYPES,
    createEncounter, autoPlace, startRound, currentActor, legalActions, declare, concede, describeDecl,
    projectedPos, posAtPass, dist, computeHit, applyHit, resolveRound, endRound, cleanup, grappleStrength,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
