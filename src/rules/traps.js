/*
 * Traps (PROVISIONAL, docs/OVERHAUL.md step C): a trap is a thing in the world with a tell, a trigger, an effect and
 * ways past, and it is the same object exploring and fighting. Its definition is a places.yaml legend entry (kind
 * trap, or a chest's `trap`; docs/DATA.md has the schema); its numbers are rules.yaml game.traps.
 *
 * This is the rules side, with no world in it: the blow a sprung trap strikes (through Combat.applyHit, so armor,
 * shield and location count), the getting clear of it by one who knows it is coming, the ground it leaves, who knows
 * it, and the trap as hidden terrain in a fight (Terrain.enter springs it). src/game/explore.js has the exploring
 * side: finding it by degrees and the ways past.
 */
(function (G) {
  'use strict';
  const K = () => (G.CONFIG.game && G.CONFIG.game.traps) || {};
  const C = () => G.Character;
  const log = (enc, t, cls) => G.Combat.log(enc, t, cls || 'hit');

  // The trap as a striker: no feats, no skill, never tires. Its blow is its own numbers, not a wielder's.
  function actor(def, key) {
    const a = C().newCharacter({ name: def.label || 'A trap', side: 'trap', starterGear: false });
    a.id = 'trap:' + (key || 'here');
    a.traits = { tireless: true };
    a.noUnarmed = true;
    return a;
  }

  const effect = (def) => (def && def.effect) || {};

  // The blow as a weapon option (Character.attackOptions' shape): damage vector, motion, punch, wound.
  function blowOption(def) {
    const b = effect(def).blow;
    if (!b) return null;
    return {
      kind: 'strike', trap: true, label: b.name || def.label || 'The trap', motion: b.motion || 'thrust', face: b.face || null,
      damage: b.damage.slice(), punch: b.punch || 0, wound: b.wound || null, venom: b.venom || null,
      ap: 0, stamina: 0, reach: 1, minRange: 1, maxRange: 1,
    };
  }

  // Does this character walk the trap safely (its faction or its kind is in `knownTo`)?
  function knows(def, c) {
    const k = (def && def.knownTo) || [];
    return !!c && k.length > 0 && (k.includes(c.faction) || k.includes(c.monster));
  }

  // Getting clear of a trap one knows is coming: the better of a dodge (⌊(DEX + SPD)/4⌋ with armor's penalties,
  // Evasion and Anticipation) and, against a blow, a ready shield (its size, ⌊(STR + DEX)/4⌋, Block), against the
  // trap's `strike` (rules.yaml game.traps.strike when it names none). `extra.block`: a shield held over on purpose;
  // `extra.caught`: caught in the middle of something (a fumbled disarm, a leap that fell short).
  function avoidBonus(v, def, extra) {
    extra = extra || {};
    const E = effect(def);
    let best = null, how = null;
    if (E.dodge !== false) {
      best = Math.floor((C().combatAttr(v, 'DEX') + C().combatAttr(v, 'SPD')) / 4) + C().defenseSkill(v, 'dodge');
      how = 'dodge';
    }
    if (E.blow && E.block !== false && C().shieldReady(v)) {
      const D = G.CONFIG.defense.block || {};
      const size = v.shield && D.bySize ? D.bySize[v.shield.size] || 0 : 0;
      const b = size + Math.floor((C().attr(v, 'STR') + C().combatAttr(v, 'DEX')) / 4) + C().defenseSkill(v, 'block') + (extra.block || 0);
      if (best == null || b > best) { best = b; how = 'block'; }
    }
    if (best == null) return null;
    return { bonus: best - (extra.caught || 0), how };
  }

  // What a sprung trap does to one victim: an avoid roll if they know it is coming, then its blow (applyHit, at the
  // location it aims at, else rolled) and its element (a hazard's blow, Magic.elementBlow). opts: { aware, extra,
  // from: the trap's square }. Logs into enc. Returns { avoided }.
  async function strike(enc, chars, v, def, roller, opts) {
    opts = opts || {};
    const E = effect(def);
    if (!C().isActive(v) && !v.status.unconscious) return { avoided: false };
    const a = actor(def, opts.key);
    if (opts.aware) {
      const av = avoidBonus(v, def, opts.extra);
      if (av) {
        const tn = def.strike != null ? def.strike : K().strike || 13;
        const r = (await roller({ actorId: v.id, sides: 10, count: 1, label: `${v.name}: get clear`, detail: `d10 + ${av.bonus} ≥ ${tn}` }))[0];
        if (r + av.bonus >= tn) {
          log(enc, av.how === 'block' ? `${v.name} takes it on the shield (${r + av.bonus} against ${tn}).` : `${v.name} throws themselves clear (${r + av.bonus} against ${tn}).`, 'defend');
          if (av.how === 'block' && v.shield) v.shield.durability = Math.max(0, v.shield.durability - 1);
          return { avoided: true };
        }
        log(enc, `${v.name} is too slow (${r + av.bonus} against ${tn}).`, 'fail');
      }
    }
    const o = blowOption(def);
    if (o) {
      const flags = E.blow.aim ? { location: E.blow.aim } : {};
      const r = await G.Combat.applyHit(enc, chars, a, v, o, roller, flags);
      log(enc, `${o.label} hits ${v.name}: ${r.text}`);
    }
    if (E.element && G.Magic) await G.Magic.elementBlow(enc, chars, a, v, E.element.noun, E.element.mag, roller, E.element.name || def.label || 'The trap', { from: opts.from });
    return { avoided: false };
  }

  // Who a sprung trap catches among a party walking in marching order (exploring): radius 0, the one on the square
  // (`who: lead`, the first; `who: next`, the one behind, for a trap that bites a beat late); a radius, all of them.
  function victims(def, party) {
    const E = effect(def);
    if (!party.length) return [];
    if ((E.radius || 0) > 0) return party.slice();
    if (E.who === 'next') return [party[Math.min(1, party.length - 1)]];
    return [party[0]];
  }

  // ---- In a fight ------------------------------------------------------------------------------------------
  // A live trap in the field of a fight is a terrain feature (CONFIG.terrain.trap): hidden to every side not in
  // f.knownBy; f.def is the trap, f.at its square on the map, f.key its id. Terrain.enter calls this when someone
  // steps or is driven onto it (how: 'driven' for a shove, a hurl or a blast). A group in `knownTo` that walks onto
  // its own trap steps where it is safe; driven onto it, it springs like anyone's. Returns true when the move ends.
  async function springInFight(enc, chars, c, f, x, y, roller, how) {
    const def = f.def || {};
    if (how !== 'driven' && knows(def, c)) return false;
    const E = effect(def);
    f.sprung = true;
    f.hidden = false;
    f.sprungRound = enc.round;
    if (def.reset && def.reset.rounds) f.rearm = enc.round + def.reset.rounds;
    log(enc, `${c.name} ${how === 'driven' ? 'is driven onto' : 'steps on'} ${(def.label || 'a trap').replace(/^A /, 'a ')}! ${def.text || ''}`.trim());
    const r = E.radius || 0;
    const caught = enc.ids.filter((id) => chars[id] && !chars[id].status.dead && enc.pos[id] && Math.max(Math.abs(enc.pos[id].x - x), Math.abs(enc.pos[id].y - y)) <= r);
    for (const id of caught) {
      const v = chars[id];
      const aware = how !== 'driven' && G.Terrain.visible(f, v.side);
      await strike(enc, chars, v, def, roller, { aware, key: f.key, from: { x, y } });
    }
    if (E.terrain && G.CONFIG.terrain[E.terrain]) {
      const R = E.terrainRadius || 0;
      for (let yy = y - R; yy <= y + R; yy++) for (let xx = x - R; xx <= x + R; xx++) {
        if (!G.Terrain.passable(enc, xx, yy)) continue;
        G.Terrain.add(enc, xx, yy, E.terrain, { rounds: E.rounds == null ? null : E.rounds, mag: E.mag || 0 });
      }
      if (G.CONFIG.terrain[E.terrain].pit && C().isActive(c)) { c.status.prone = true; log(enc, `${c.name} goes down into the pit.`); }
    }
    return !C().isActive(c) || c.status.prone;
  }

  // End of a round: a trap that resets (`reset.rounds`) is set again, and everyone who saw it spring knows it now.
  function rearm(enc) {
    for (const t of G.Terrain.all(enc)) {
      const f = t.f;
      if (!t.def.trap || !f.sprung || f.rearm == null || enc.round < f.rearm) continue;
      f.sprung = false;
      f.rearm = null;
      f.hidden = true;
      f.knownBy = ['party', 'enemy'];
    }
  }

  // What a trap does, in a line, for one who has made out its working: trigger, blow, element, ground, reset.
  function describe(def) {
    const E = effect(def), names = (G.CONFIG.locations && G.CONFIG.locations.names) || {};
    const trig = (K().triggers || {})[def.trigger] || def.trigger || 'something';
    const bits = [];
    if (E.blow) {
      const d = E.blow.damage, kinds = [['piercing', d[0]], ['cutting', d[1]], ['crushing', d[2]]].filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`);
      bits.push(`a blow${E.blow.aim ? ` at the ${(names[E.blow.aim] || E.blow.aim).toLowerCase()}` : ''} (${kinds.join(', ')})`);
    }
    if (E.element) bits.push(`${E.element.noun} ${E.element.mag}`);
    if (E.terrain) bits.push(((G.CONFIG.terrain[E.terrain] || {}).name || E.terrain).toLowerCase());
    if (E.to) bits.push('a drop to somewhere below');
    const who = (E.radius || 0) > 0 ? 'everyone near' : E.who === 'next' ? 'the one behind whoever sets it off' : 'whoever sets it off';
    const reset = def.reset ? ' It sets itself again.' : '';
    return `Set off by ${trig}: ${bits.join(', ') || 'nothing you can see'}, on ${who}.${reset}`;
  }

  G.Traps = { actor, blowOption, knows, avoidBonus, strike, victims, springInFight, rearm, describe };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
