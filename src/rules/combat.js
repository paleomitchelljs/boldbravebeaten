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

  const ATTACK_TYPES = ['strike', 'trip', 'disarm', 'grapple', 'takedown', 'shove'];
  const DEFENSE_TYPES = ['block', 'parry', 'dodge'];

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
    enc.phase = 'initiative';
    enc.decls = [];
    enc.conceded = {};
    enc.hitThisRound = {};
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
    for (const id of enc.order) {
      enc.ap[id] = C.apPool(chars[id]);
      enc.apStart[id] = enc.ap[id];
    }
    log(enc, `Round ${enc.round} — initiative: ` + enc.order.map((id) => `${chars[id].name} ${enc.initiative[id]}`).join(', '), 'round');
    startPass(enc, chars);
    return enc;
  }

  // ---- Passes and turns --------------------------------------------------
  // Most AP a character may spend in one pass (Infinity when there is no cap).
  function passCap() {
    return CONFIG.apPerPass ? CONFIG.apPerPass * C.apScale() : Infinity;
  }

  function spentIn(enc, id, pass) {
    return (enc.spent[id] && enc.spent[id][pass]) || 0;
  }

  // AP this character can still put in this pass.
  function passLeft(enc, id) {
    return Math.max(0, Math.min(enc.ap[id] || 0, passCap() - spentIn(enc, id, enc.pass)));
  }

  // Pay an action's AP from this pass's allowance, then the next passes'. Returns the
  // pass in which the last of it is paid.
  function payAP(enc, id, ap) {
    const cap = passCap();
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

  function eligible(enc, id) {
    return id != null && !enc.conceded[id] && passLeft(enc, id) >= CONFIG.minActionAP && !enc.turnDone[id];
  }

  function startPass(enc, chars) {
    enc.pass += 1;
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
    if (held && held.id !== wid && WEAPONS[held.type].weight !== 'very light') {
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

  // Everything the current actor may declare now, for the UI.
  function legalActions(enc, chars, id) {
    const c = chars[id];
    const ap = enc.ap[id] || 0;
    const left = passLeft(enc, id);
    // An action can be started with any AP left this pass; the rest comes out of later passes.
    const can = (cost) => cost <= ap && left >= CONFIG.minActionAP;
    const me = posAtPass(enc, id, enc.pass);
    const others = enc.ids.filter((o) => o !== id && !chars[o].status.dead);
    const out = { ap, passLeft: left, passCap: passCap(), pass: enc.pass, attacks: [], defenses: [], guards: [], maneuvers: [], other: [], move: null, incoming: [], incomingLater: [] };

    // Guards: ready a block, parry or dodge for the next attack, or the next from one attacker.
    for (const kind of DEFENSE_TYPES) {
      const cost = C.actionCost(c, kind);
      const why = defenseUnavailable(c, kind, null, chars, enc);
      out.defenses.push({ type: kind, ap: cost.ap, stamina: cost.stamina, affordable: can(cost.ap) && !why, spans: cost.ap > left, why });
    }
    out.guardAgainst = others.filter((o) => chars[o].side !== c.side && C.isActive(chars[o]));
    out.guards = guardsUp(enc, id, enc.pass);
    // Attacks already declared at me: landing this pass, and slow ones landing later.
    out.incoming = incomingAttacks(enc, id).filter((d) => d.pass === enc.pass);
    out.incomingLater = incomingAttacks(enc, id).filter((d) => d.pass > enc.pass);

    const planned = plannedAttackOptions(enc, c);
    const spPlanned = enc.decls.filter((d) => d.actor === id && d.type === 'strike' && d.option.spell).reduce((t, d) => t + d.option.spCost, 0);
    for (const opt of planned) {
      const why = attackUnavailable(enc, c, opt, spPlanned);
      out.attacks.push(Object.assign({}, opt, {
        affordable: can(opt.ap) && !why,
        spans: opt.ap > left,
        why,
        targets: others.map((o) => {
          const dd = dist(me, posAtPass(enc, o, enc.pass));
          return { id: o, inReach: C.inRange(opt, dd), tooClose: dd < (opt.minRange || 1), distance: dd };
        }),
      }));
    }

    const reach = CONFIG.range.maneuverMax;
    const grappled = isGrappled(c);
    for (const kind of ['shove', 'trip', 'disarm', 'grapple', 'takedown']) {
      if (kind === 'takedown' && !C.rank(c, 'takedown')) continue;
      if (c.status.prone || c.status.grappling) continue;
      const cost = C.actionCost(c, kind);
      let r = reach;
      if (kind === 'trip' && hookWeapon(c)) r = WEAPONS[C.wieldedWeapon(c).type].reach;
      out.maneuvers.push({
        type: kind, ap: cost.ap, stamina: cost.stamina, affordable: can(cost.ap) && !(grappled && kind !== 'grapple'), spans: cost.ap > left,
        targets: others.filter((o) => !chars[o].status.unconscious).map((o) => ({ id: o, inReach: dist(me, posAtPass(enc, o, enc.pass)) <= r })),
      });
    }

    if (!c.status.prone && !grappled && !c.status.grappling && can(1)) {
      const spa = C.squaresPerAP(c);
      const cost1 = C.actionCost(c, 'move', { ap: 1 });
      out.move = {
        squaresPerAP: spa, maxAP: ap, stamina: cost1.stamina, from: projectedPos(enc, id),
        maxSquares: Math.floor((ap * spa) / C.apScale()),
        passSquares: Math.floor((left * spa) / C.apScale()), // as far as it can go and still land this pass
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
    const dropNote = heldW && WEAPONS[heldW.type].weight !== 'very light' ? { note: `drops ${Items.itemName(heldW)}` } : {};
    if (sidearm && hands.wield !== c.sidearm && !hands.dropped.includes(c.sidearm)) addOther('drawSidearm', dropNote);
    if (primary && hands.wield !== primary && !hands.dropped.includes(primary)) addOther('readyPrimary', dropNote);
    if (hands.dropped.length && !declared('pickUp')) addOther('pickUp', dropNote);
    if (hands.wield) addOther('dropWeapon', { note: Items.itemName(heldW) });
    if (grappled) addOther('escape');
    if (c.status.grappling && !declared('release')) addOther('release');
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
    if (opt.ranged && opt.weaponId && (c.inventory.arrows || 0) <= 0) return 'No arrows';
    if (opt.spell) return spellShort(c, opt, spPlanned);
    return null;
  }

  function hookWeapon(c) {
    const w = C.wieldedWeapon(c);
    return w && WEAPONS[w.type].hook && C.rank(c, 'hook');
  }

  function defenseUnavailable(c, kind, attackDecl, chars, enc) {
    const grapplers = c.status.grappledBy.map((g) => chars[g]).filter(Boolean);
    if (grapplers.some((g) => C.rank(g, 'pin'))) return 'Pinned';
    const winding = c.status.windUp || (enc && enc.decls.some((d) => d.actor === c.id && d.type === 'windUp'));
    if (winding && (CONFIG.windUp.exposed || []).includes(kind)) return 'Winding up';
    const opt = attackDecl ? attackDecl.option : null;
    if (kind === 'parry' && opt && (opt.spell || (opt.ranged && !CONFIG.archery.parry))) return opt.spell ? "Can't parry a spell" : "Can't parry an arrow";
    if (kind === 'block' && !C.shieldReady(c)) return 'No ready shield';
    if (kind === 'parry') {
      if (!C.wieldedWeapon(c)) return 'No weapon';
      const atk = attackDecl ? chars[attackDecl.actor] : null;
      if (opt && opt.motion === 'power' && atk && C.rank(atk, 'juggernaut')) return 'Juggernaut';
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
    const defense = DEFENSE_TYPES.includes(decl.type);
    if (decl.type === 'strike') {
      const key = C.optionKey(decl.option);
      const opt = plannedAttackOptions(enc, c).find((o) => C.optionKey(o) === key);
      if (!opt) return 'Attack not available';
      const spPlanned = enc.decls.filter((d) => d.actor === id && d.type === 'strike' && d.option.spell).reduce((t, d) => t + d.option.spCost, 0);
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
      const need = C.moveCost(c, d);
      ({ ap, stamina } = C.actionCost(c, 'move', { ap: need }));
      decl.from = from;
    } else {
      if (!ACTIONS[decl.type]) return 'Unknown action';
      ({ ap, stamina } = C.actionCost(c, decl.type));
      if (['trip', 'disarm', 'grapple', 'takedown', 'shove', 'bandage'].includes(decl.type) && !decl.target) return 'Choose a target';
    }
    if (ap > enc.ap[id]) return 'Not enough AP';
    if (passLeft(enc, id) < CONFIG.minActionAP) return 'No AP left this pass';
    decl.ap = ap;
    decl.stamina = stamina;
    decl.declaredPass = enc.pass;
    const lands = payAP(enc, id, ap);
    // A guard is up at once (any AP over the cap is owed from later passes); everything
    // else lands when fully paid, unless CONFIG.spanLands says it lands now.
    decl.pass = defense || CONFIG.spanLands === 'now' ? enc.pass : lands;
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
    if (d.type === 'move') return { text: `${a.name}: move to (${d.to.x + 1}, ${d.to.y + 1}) [${d.ap} AP]` };
    if (d.type === 'windUp') return { text: `${a.name}: winds up ${d.option.label} [${d.ap} AP]` };
    return { text: `${a.name}: ${ACTIONS[d.type].name.toLowerCase()}${tn ? ' ' + tn : ''} [${d.ap} AP]` };
  }

  // ---- Damage pipeline ---------------------------------------------------
  // Pure: works out what a hit would do (before d4 hit-location rolls).
  function computeHit(attacker, target, option, flags) {
    flags = flags || {};
    if (option.spell && option.spell.element === 'fire') return computeFire(attacker, target, option, flags);
    const v = option.damage.slice();
    const st = target.status;
    const prone = st.prone;
    const grappled = isGrappled(target);
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
    return res;
  }

  // Fire (magic stub): armor stops part of it; every few points left over cost 1 CON,
  // the rest goes to stamina. Burns don't bleed.
  function computeFire(attacker, target, option, flags) {
    const M = CONFIG.magic;
    let mag = option.spell.magnitude;
    if (flags.half) mag = Math.floor(mag / 2);
    const res = { vec: [0, 0, 0], P: 0, S: 0, B: 0, fire: mag, armored: false, toCON: 0, slashToAttrs: 0, bluntToStamina: 0, bluntToCON: 0, converted: 0, durLoss: 0, mitigated: { P: 0, S: 0, B: 0 }, noBleed: true };
    const unconscious = target.stamina <= 0;
    let left = mag;
    if (target.armor && target.armor.durability > 0) {
      const stop = Math.round(C.armorInfo(target).effMit.B * M.fireMitigation);
      left = Math.max(0, mag - stop);
      res.fireStopped = mag - left;
    }
    if (unconscious) res.toCON = left;
    else {
      res.toCON = Math.floor(left / M.fireConPer);
      res.bluntToStamina = left - res.toCON;
    }
    return res;
  }

  // Apply a hit, rolling d4s for slashing. Returns a short description.
  async function applyHit(enc, chars, attacker, target, option, roller, flags) {
    const h = computeHit(attacker, target, option, flags);
    const parts = [];
    const st = target.status;

    if (h.fire != null && h.fireStopped) parts.push(`armor stops ${h.fireStopped} fire`);
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
    if (wound > 0 && !h.noBleed) {
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

  // Bonus and target number for a defense; shared by the check and the AI's odds.
  function defenseNumbers(defender, kind, motion) {
    const D = CONFIG.defense;
    let bonus = 0, tn = D[kind].tn;
    if (kind === 'block') {
      bonus = C.rank(defender, 'shield_training');
      const bySize = D.block.tnBySize;
      if (bySize && defender.shield && bySize[defender.shield.size] != null) tn = bySize[defender.shield.size];
    } else if (kind === 'parry') {
      bonus = C.rank(defender, 'parry_training') + half(C.combatAttr(defender, 'DEX'));
      tn += D.motionPenalty[motion] || 0;
    } else {
      bonus = C.rank(defender, 'dodge_training') + half(C.combatAttr(defender, 'SPD')) - C.armorInfo(defender).dex;
      tn += D.motionPenalty[motion] || 0;
    }
    return { bonus, tn };
  }

  // Chance that d(die) + bonus ≥ tn.
  function defenseOdds(defender, kind, motion) {
    const { bonus, tn } = defenseNumbers(defender, kind, motion);
    const die = CONFIG.defense.die;
    return Math.max(0, Math.min(1, (die - (tn - bonus) + 1) / die));
  }

  async function defenseCheck(enc, chars, defender, kind, atkDecl, roller) {
    const D = CONFIG.defense;
    const motion = atkDecl.type === 'strike' ? atkDecl.option.motion : 'maneuver';
    const { bonus, tn } = defenseNumbers(defender, kind, motion);
    const label = `${ACTIONS[kind].name}: d10 + ${bonus} ≥ ${tn}`;
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
  // Resolve everything that lands this pass, then start the next pass or end the round.
  async function resolvePass(enc, chars, roller) {
    enc.phase = 'resolving';
    const p = enc.pass;
    const rank = (id) => enc.order.indexOf(id);
    const actsThisPass = enc.decls
      .filter((d) => d.pass === p && !d.done && !DEFENSE_TYPES.includes(d.type))
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
    for (const d of enc.decls) if (d.pass === p) d.done = true;

    // Another pass while anything is still on its way or anyone can still act. A pass in
    // which nobody started or landed anything (everyone waited) ends the round.
    const pending = enc.decls.some((d) => !d.done);
    const started = enc.decls.some((d) => d.declaredPass === p && !DEFENSE_TYPES.includes(d.type));
    const sides = {};
    for (const id of enc.ids) if (C.isActive(chars[id])) sides[chars[id].side] = true;
    for (const id of enc.order) if (!C.isActive(chars[id])) enc.conceded[id] = true;
    const canAct = enc.order.some((id) => !enc.conceded[id] && (enc.ap[id] || 0) >= CONFIG.minActionAP);
    if (Object.keys(sides).length > 1 && (pending || (canAct && (started || actsThisPass.length)))) startPass(enc, chars);
    else endRound(enc, chars);
  }

  // Resolve passes until someone has to decide something (or the round ends).
  async function resolveRound(enc, chars, roller) {
    while (enc.phase === 'resolve') await resolvePass(enc, chars, roller);
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
      let band = { minRange: 1, maxRange: CONFIG.range.maneuverMax };
      if (d.type === 'strike') band = d.option;
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
      if (d.type === 'strike' && d.option.weaponId && (a.wield !== d.option.weaponId || a.status.dropped.includes(d.option.weaponId))) {
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
      if (d.type === 'strike' && d.option.ranged && d.option.weaponId) {
        if ((a.inventory.arrows || 0) <= 0) {
          log(enc, `${a.name} is out of arrows.`, 'fizzle');
          return;
        }
        a.inventory.arrows -= 1;
      }
      if (!payStamina(enc, a, d.stamina)) return;
      if (d.type === 'strike' && d.option.spell) {
        if (!(await castSpell(enc, a, d.option, roller))) return;
      }

      // The target's guard meets it: one aimed at this attacker first, then a general one.
      // A guard that can't meet this attack (a parry against an arrow) stays up for the next.
      const name = d.type === 'strike' ? d.option.label : ACTIONS[d.type].name;
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
        const r = await applyHit(enc, chars, a, t, d.option, roller, { half, distance });
        const note = (distance === 1 && d.option.closePenalty) || (CONFIG.grappledWeaponsCramped && d.option.weaponId && !d.option.ranged && isGrappled(a))
          ? (CONFIG.range.closeRule === 'blunt' ? ' (cramped: blunt, half force)' : ' (cramped: half damage)') : d.option.ranged && d.option.longRange && distance > d.option.longRange ? ' (long range)' : '';
        log(enc, `${a.name}'s ${name} hits ${t.name}${half ? ' (Roll With It: half)' : ''}${note}: ${r.text}`, 'hit');
        if (d.option.spell && d.option.spell.element === 'force' && C.isActive(t) && !t.status.prone) {
          const k = await opposed(roller, a, Math.floor(C.attr(a, 'INT') / 2), 'Force knockdown', t, stability(t), 'Keep footing');
          if (k.margin >= CONFIG.magic.forceKnockdownMargin) {
            knockDown(enc, t);
            log(enc, `${t.name} is knocked prone by the force (${k.a} vs ${k.b}).`, 'hit');
          }
        }
        if (!C.isActive(t)) loseWindUp(enc, t, null);
        if ((d.option.unarmed === 'kick' || d.option.unarmed === 'shieldBash') && C.isActive(t) && !t.status.prone) {
          const k = await knockdownCheck(roller, a, t, C.rank(a, 'trip') ? CONFIG.maneuver.tripFeatBonus : 0, 'Knockdown');
          if (k.margin >= CONFIG.maneuver.kickKnockdownMargin) {
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
        if (a.status.prone || isGrappled(a) || (d.option.weaponId && C.wieldedWeapon(a) && C.wieldedWeapon(a).id !== d.option.weaponId) || (d.option.weaponId && !C.wieldedWeapon(a))) {
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

  async function shieldAbsorb(enc, chars, a, t, d, roller) {
    const s = t.shield;
    const ss = Items.shieldStats(s);
    const v = d.type === 'strike' ? d.option.damage : [0, 0, 0];
    const W = CONFIG.shieldWear;
    const wear = Math.round((v[0] * W.P + v[1] * W.S + v[2] * W.B) * (CONFIG.shieldWearScale || 1));
    s.durability = Math.max(0, s.durability - wear);
    const label = d.type === 'strike' ? d.option.label : d.type;
    let msg = `${t.name} blocks ${a.name}'s ${label} with the shield (durability −${wear})`;
    let force = v[0] + v[1] + v[2];
    if (C.rank(a, 'shield_breaker')) force *= 2;
    const power = d.type === 'strike' && (CONFIG.powerMotions || []).includes(d.option.motion);
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
    if (d.type === 'shove') {
      const S = CONFIG.shove;
      const w = C.wieldedWeapon(a);
      const aB = Math.floor(C.attr(a, 'STR') / 2) + (w && WEAPONS[w.type].hands === 2 ? S.twoHandBonus : 0);
      const o = await opposed(roller, a, aB, 'Shove', t, stability(t), 'Hold ground');
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
    } else if (d.type === 'grapple' || d.type === 'takedown') {
      const aB = Math.floor(C.attr(a, 'STR') / 2) + C.rank(a, 'grappler');
      const bB = Math.floor(Math.max(C.attr(t, 'STR'), C.combatAttr(t, 'DEX')) / 2) + (C.rank(t, 'escape_artist') ? M.escapeArtistBonus : 0);
      const o = await opposed(roller, a, aB, d.type === 'takedown' ? 'Takedown' : 'Grapple', t, bB, 'Resist grapple');
      if (o.margin > 0 || t.status.unconscious) {
        if (!t.status.grappledBy.includes(a.id)) t.status.grappledBy.push(a.id);
        a.status.grappling = t.id;
        loseWindUp(enc, t, 'grappled');
        if (d.type === 'takedown') knockDown(enc, t);
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
      if (c.status.unconscious) { releaseGrapples(chars, c); c.status.windUp = null; }
      // Holding someone is exhausting: pay the upkeep or let go.
      const G2 = CONFIG.grappling;
      if (c.status.grappling && G2 && G2.holdUpkeep && !c.status.unconscious) {
        const cost = G2.holdUpkeep * (CONFIG.staminaScale || 1);
        if (c.stamina > cost) {
          c.stamina -= cost;
          log(enc, `${c.name} spends ${cost} stamina holding ${chars[c.status.grappling] ? chars[c.status.grappling].name : 'their foe'}.`);
        } else {
          const t2 = chars[c.status.grappling];
          if (t2) t2.status.grappledBy = t2.status.grappledBy.filter((g) => g !== c.id);
          c.status.grappling = null;
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
      c.status.prone = false;
      c.status.windUp = null;
      c.status.grappling = null;
      c.status.grappledBy = [];
      // Weapons on the ground are gathered up after the fight.
      if (c.status.dropped.length || c.wield == null) {
        c.status.dropped = [];
        if (c.wield == null) c.wield = primaryWeaponId(c) || (c.weapons[0] ? c.weapons[0].id : null);
      }
    }
  }

  G.Combat = {
    ATTACK_TYPES, DEFENSE_TYPES,
    createEncounter, autoPlace, startRound, currentActor, legalActions, declare, concede, endTurn, submit, describeDecl, passCap, passLeft,
    projectedPos, posAtPass, dist, defenseOdds, knockdownOdds, opposedOdds, shoveOdds, defenseUnavailable, computeHit, applyHit, resolvePass, resolveRound, endRound, cleanup, grappleStrength,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
