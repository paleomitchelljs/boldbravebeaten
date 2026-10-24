/*
 * Magic (PROVISIONAL overhaul, phase 1).
 *
 * A spell is a verb, a noun and at most one modifier (unordered; cost = the sum of the word
 * costs). Verbs and modifiers are studied (Magic: words feats); nouns are truths found in the
 * world (c.nouns). Every number lives in CONFIG.magic.
 *
 *   verb — the shape: strike / launch (a bolt at one target), burst (an area), cover (ground
 *          hazard), build (a wall across several squares), open (a pit), inscribe (a hidden rune
 *          on a square), hex (a bane on a foe), bless (a boon on an ally), conjure (a creature)
 *   noun — what it is: fire, frost, lightning, wind, earth, vine, life, force. Each noun says
 *          how it hurts and what it leaves (CONFIG.magic.words[noun]: ground, wall, terrain,
 *          bane, boon, conjure, onHit). A verb that needs something the noun lacks (Build +
 *          Life) makes no spell.
 *   mod  — strong (+magnitude), wide (bigger area, longer wall), long (twice as long),
 *          far (twice the range), lingering (part of the damage burns on over rounds)
 *
 * Bolts (strike, launch) are declared like attacks ('strike' with a spell option) and resolve
 * through the combat engine (guards, armor). Everything else is a 'cast' declaration aimed at a
 * square or a character, resolved here (resolveCast).
 */
(function (G) {
  'use strict';
  const CONFIG = G.CONFIG;

  const C = () => G.Character;
  const Items = () => G.Items;
  const W = () => CONFIG.magic.words;
  const BOLT = ['bolt'];

  // Spell points: INT + 3 per Casting rank, + what worn gear adds (sp), + 2 per Familiar rank while it lives.
  function maxSP(c) {
    const r = C().rank(c, 'casting');
    if (r <= 0) return 0;
    const fam = C().rank(c, 'familiar') && c.companion && c.companion.familiar && !c.companion.status.dead ? 2 * C().rank(c, 'familiar') : 0;
    return C().attr(c, 'INT') + CONFIG.magic.poolPerCasting * r + C().gearSum(c, 'sp') + fam;
  }

  // Points the caster can draw on right now.
  function availableSP(c) {
    const max = maxSP(c);
    let left = Math.max(0, max - (c.spSpent || 0));
    if (CONFIG.magic.staminaLimitsPoints) {
      const ms = C().maxStamina(c);
      const cap = ms > 0 ? Math.floor((max * Math.max(0, c.stamina)) / ms) : 0;
      left = Math.min(left, cap);
    }
    return left;
  }

  function knows(c, key) {
    const w = W()[key];
    if (!w) return false;
    if (w.kind === 'noun') return (c.nouns || []).includes(key);
    return !!(w.feat && C().rank(c, w.feat));
  }

  // Does this verb make anything of this noun (and take this modifier)?
  // A Named spell reaches anyone whose name the caster knows: companions (and themself), or a
  // foe whose name they've learned (c.knownNames, matched without case).
  function knowsName(c, t) {
    if (!t) return false;
    if (t.id === c.id || t.side === c.side || (t.charmed && t.charmed.side === c.side)) return true;
    return (c.knownNames || []).some((n) => String(n).trim().toLowerCase() === String(t.name).trim().toLowerCase());
  }

  // The conditions a noun inflicts, which Restore + that noun lifts.
  function curesOf(n) {
    const N = W()[n];
    if (!N) return [];
    const out = [N.onHit && N.onHit.cond, N.bane, N.mind].filter((k) => k && CONFIG.conditions[k]);
    return [...new Set(out)];
  }

  function combines(v, n, m) {
    const V = W()[v], N = W()[n];
    if (!V || !N) return false;
    if (V.shape === 'restore' && !N.heals && !curesOf(n).length) return false;
    const need = { ground: 'ground', wall: 'wall', terrain: 'terrain', bane: 'bane', boon: 'boon', conjure: 'conjure', ward: 'ward', mind: 'mind', raise: 'raise' }[V.shape];
    if (need && !N[need]) return false;
    if (m) {
      const M = W()[m];
      if (M.shapes && !M.shapes.includes(V.shape)) return false;
    }
    return true;
  }

  function spellOptions(c) {
    return castableOptions(c).concat(powerOptions(c));
  }

  // Powers of worn and wielded things (a circlet that veils at will, a staff with charges of a dread gaze):
  // item.power or an enchantment's power = { verb, noun, mod, charges (a day; null = at will), name }. A power
  // needs no spell points, no free hand and no backlash; the wearer's own INT and Casting still set the contest.
  function powerSources(c) {
    const out = [];
    for (const t of c.trinkets || []) if (t.power) out.push({ item: t, power: t.power });
    const held = C().armorPieces(c).filter((p) => p.durability > 0).concat([c.shield && c.shield.durability > 0 ? c.shield : null, C().wieldedWeapon(c), C().offhandWeapon(c)]);
    for (const it of held) if (it) for (const e of Items().enchantsOf(it)) if (e.power) out.push({ item: it, power: e.power });
    return out;
  }

  function chargesLeft(item, p) {
    if (p.charges == null) return Infinity;
    const used = (item.used || {})[p.name] || 0;
    return Math.max(0, p.charges - used);
  }

  function powerOptions(c) {
    const out = [];
    for (const { item, power: p } of powerSources(c)) {
      if (!W()[p.verb] || !W()[p.noun] || !combines(p.verb, p.noun, p.mod || null)) continue;
      const o = makeOption(c, p.verb, p.noun, p.mod || null);
      const left = chargesLeft(item, p);
      Object.assign(o, { spCost: 0, power: { item: item.id, name: p.name, left: left === Infinity ? null : left }, label: `${p.name} (${o.label}${left === Infinity ? '' : `, ${left} left`})`, spellKey: `power:${item.id}:${p.name}` });
      out.push(o);
    }
    return out;
  }

  // A power is used: one charge gone (charges come back with a long rest: Magic.rechargeAll).
  function usePower(c, o) {
    const src = powerSources(c).find((s) => s.item.id === o.power.item && s.power.name === o.power.name);
    if (!src || chargesLeft(src.item, src.power) <= 0) return false;
    if (src.power.charges != null) { src.item.used = src.item.used || {}; src.item.used[src.power.name] = (src.item.used[src.power.name] || 0) + 1; }
    return true;
  }

  function rechargeAll(c) {
    for (const it of [c.armor, c.shield].concat(c.pieces || [], c.weapons || [], c.trinkets || [])) if (it && it.used) delete it.used;
  }

  function castableOptions(c) {
    const words = W();
    if (!maxSP(c)) return [];
    const verbs = Object.keys(words).filter((k) => words[k].kind === 'verb' && knows(c, k));
    const nouns = Object.keys(words).filter((k) => words[k].kind === 'noun' && knows(c, k));
    const mods = [null].concat(Object.keys(words).filter((k) => words[k].kind === 'mod' && knows(c, k)));
    const out = [];
    for (const v of verbs) for (const n of nouns) for (const m of mods) if (combines(v, n, m)) out.push(makeOption(c, v, n, m));
    // Doubled nouns (Word Doubling): two nouns, no modifier; both do the verb.
    if (C().rank(c, 'word_doubling')) {
      for (const v of verbs) for (let i = 0; i < nouns.length; i++) for (let j = i + 1; j < nouns.length; j++) {
        const a = nouns[i], b = nouns[j];
        if (combines(v, a, null) && combines(v, b, null)) out.push(makeOption(c, v, a, null, b));
      }
    }
    return out;
  }

  // Magnitude: the verb's, + the modifier's, + affinity with the noun.
  function magnitude(c, v, n, m) {
    const w = W();
    let mag = (w[v].mag || 0) + (m ? w[m].mag || 0 : 0);
    const aff = (CONFIG.magic.affinity || {})[n];
    if (aff) mag += C().rank(c, aff);
    // Worn gear: a skullcap that strengthens every spell, an amulet that strengthens one noun.
    mag += C().gearSum(c, 'mag', n) + C().gearSum(c, 'mag', '*');
    return mag;
  }

  // The damage vector a noun's blow carries (energies — fire, frost, lightning, life — are
  // worked out by Combat.computeHit from spell.element and magnitude instead).
  function damageVector(n, mag) {
    const kind = W()[n].hurt;
    if (kind === 'blunt') return [0, 0, mag];
    if (kind === 'halfBlunt') return [0, 0, Math.ceil(mag / 2)];
    if (kind === 'thorns') return [0, Math.ceil(mag / 2), 0];
    return [0, 0, 0];
  }

  function makeOption(c, v, n, m, n2) {
    const w = W();
    const V = w[v], N = w[n], M = m ? w[m] : null;
    const mag = magnitude(c, v, n, m);
    const cost = V.cost + N.cost + (M ? M.cost : 0) + (n2 ? w[n2].cost + CONFIG.magic.doubleSurcharge : 0) + (V.shape === 'raise' ? N.raiseCost || 0 : 0);
    const bolt = BOLT.includes(V.shape);
    const windUp = !!(bolt && M && M.windUp && CONFIG.windUp && CONFIG.windUp.spells);
    // Base AP (Specifics units) through the turn-budget curve, then Quick Casting and armor.
    let baseAP = (V.ap || CONFIG.magic.castAP) + (!bolt && M && M.windUp ? 1 : 0) + (M && M.ap ? M.ap : 0);
    if (windUp) baseAP -= CONFIG.windUp.ap;
    const full = Math.max(C().minAP(), Math.round(C().baseAP(baseAP)));
    const ap = C().gearAP(c, Math.max(C().minAP(), full - C().quickCut(c, 'quick_casting', full)) + C().armorAP(c));
    const far = M && M.rangeMult ? M.rangeMult : 1;
    const named = !!(M && M.named);
    const range = [V.range[0], V.range[1] * far];
    const label = [V.name, N.name, n2 ? w[n2].name : null, M ? M.name : null].filter(Boolean).join(' + ');
    const nouns = n2 ? [n, n2] : [n];
    const combo = n2 ? (CONFIG.magic.combos || {})[nouns.slice().sort().join('+')] || null : null;
    const spell = {
      verb: v, noun: n, nouns, combo, mod: m, shape: V.shape, element: N.element, magnitude: mag, cost,
      radius: (V.radius || 0) + (M && M.radius ? M.radius : 0),
      length: (V.length || 1) + (M && M.length ? M.length : 0),
      rounds: V.rounds == null ? null : V.rounds * (M && M.roundsMult ? M.roundsMult : 1),
      lingering: !!(M && M.lingering),
      delayed: !!(M && M.delayed),
      condMag: 1 + (M && M.mag ? 1 : 0),
      named,
    };
    const base = {
      spellKey: [v, n, n2, m].filter(Boolean).join('+'), label, spell, ap, stamina: 0, spCost: cost,
      minRange: range[0], maxRange: range[1], reach: range[1], closePenalty: false,
    };
    if (bolt) {
      return Object.assign(base, {
        kind: 'strike', motion: 'spell', windUp, ranged: range[0] > 1,
        damage: damageVector(n, spell.lingering ? Math.ceil(mag / 2) : mag),
      });
    }
    // target: what the caster aims at — a square, a foe (hex), or an ally or self (bless).
    const target = V.shape === 'bane' || V.shape === 'mind' ? 'foe' : V.shape === 'boon' || V.shape === 'ward' || V.shape === 'restore' ? 'ally' : 'square';
    // Areas and hazards land on squares; Raise aims at the square a body lies on.
    return Object.assign(base, { kind: 'cast', target, windUp: false, ranged: true });
  }

  // Backlash: d10 + Control vs the spell's cost; stamina lost per point short.
  async function backlash(c, cost, roller) {
    const control = C().rank(c, 'control');
    const r = (await roller({ actorId: c.id, sides: 10, count: 1, label: `${c.name}: backlash`, detail: `d10 + ${control} ≥ ${cost} to cast safely` }))[0];
    const short = cost - (r + control);
    if (short <= 0) return 0;
    return short * CONFIG.magic.backlashPerPoint;
  }

  // ---- Resolution ----------------------------------------------------------------------

  // Caster's d10 + ⌊INT/2⌋ + Casting against the target's d10 + its resisting attribute
  // ('avoid' = ⌊(DEX + SPD)/4⌋, like a dodge; otherwise ⌊attribute/2⌋). Ties: the target.
  async function contest(roller, caster, target, attr, what) {
    const cb = Math.floor(C().attr(caster, 'INT') / 2) + C().rank(caster, 'casting');
    const tb = attr === 'avoid'
      ? Math.floor((C().combatAttr(target, 'DEX') + C().combatAttr(target, 'SPD')) / 4)
      : Math.floor(C().attr(target, attr) / 2);
    const rc = (await roller({ actorId: caster.id, sides: 10, count: 1, label: `${caster.name}: ${what}`, detail: `d10 + ${cb}` }))[0];
    const rt = (await roller({ actorId: target.id, sides: 10, count: 1, label: `${target.name}: resist ${what}`, detail: `d10 + ${tb} (${attr === 'avoid' ? 'DEX/SPD' : attr})` }))[0];
    return { resisted: rt + tb >= rc + cb, a: rc + cb, b: rt + tb };
  }

  function logger(enc) {
    return (t, cls) => G.Combat.log(enc, t, cls);
  }

  // Put a condition on a target, who may resist (CONFIG.conditions[key].resist).
  async function afflict(enc, caster, target, key, opts, roller) {
    if (!G.Conditions || !CONFIG.conditions[key] || !G.Character.isActive(target)) return false;
    if (target.traits && target.traits.magicImmune && caster) { logger(enc)(`The magic washes off ${target.name}.`, 'defend'); return false; }
    if (C().tireless(target) && CONFIG.conditions[key].living) return false;
    const ward = G.Conditions.get(target, 'warded');
    const mindish = CONFIG.conditions[key].resist === 'WIL';
    if (mindish && ((ward && ward.kind === 'mind') || G.Conditions.flag(target, 'mindWard'))) {
      logger(enc)(`${target.name}'s mind is shut against it.`, 'defend');
      return false;
    }
    if (key === 'frightened' && G.Conditions.flag(target, 'noFear')) return false;
    if (G.Conditions.list(target).some((x) => ((CONFIG.conditions[x.key] || {}).immune || []).includes(key))) {
      logger(enc)(`${target.name} shrugs it off.`, 'defend');
      return false;
    }
    if (ward && ward.kind && CONFIG.magic.words[ward.kind] && (CONFIG.magic.words[ward.kind].bane === key || (CONFIG.magic.words[ward.kind].onHit || {}).cond === key)) {
      logger(enc)(`${target.name}'s ward keeps it off.`, 'defend');
      return false;
    }
    const resist = CONFIG.conditions[key].resist;
    const name = CONFIG.conditions[key].name;
    if (resist && caster && caster !== target) {
      const k = await contest(roller, caster, target, resist, name.toLowerCase());
      if (k.resisted) {
        logger(enc)(`${target.name} resists being ${name.toLowerCase()} (${k.b} vs ${k.a}).`, 'defend');
        return false;
      }
    }
    G.Conditions.add(target, key, Object.assign({ src: caster ? caster.id : null }, opts));
    logger(enc)(`${target.name} is ${name.toLowerCase()} (${opts.rounds} round${opts.rounds > 1 ? 's' : ''}).`, 'hit');
    // Stunned, paralyzed: AP lost at once, not only next round.
    const drain = CONFIG.conditions[key].drainAP;
    if (drain && enc.ap && enc.ap[target.id] != null) enc.ap[target.id] = Math.max(0, enc.ap[target.id] - Math.round(drain * (opts.mag || 1) * C().apScale()));
    // Controlled: fights for the caster while it lasts; the caster must hold it (unless it is free: a charm).
    if (CONFIG.conditions[key].control && caster) {
      if (!target.charmed) target.charmed = { side: target.side, control: target.control };
      target.side = caster.side;
      target.control = caster.control || 'auto';
      if (!CONFIG.conditions[key].free) G.Conditions.add(caster, 'concentrating', { rounds: opts.rounds, src: caster.id });
    }
    return true;
  }

  // What a noun does after its blow lands: conditions, a push, a knockdown.
  async function onHit(enc, chars, caster, target, n, roller, opts) {
    const N = W()[n];
    const H = N.onHit;
    if (!H || !G.Character.isActive(target)) return;
    const ward = G.Conditions && G.Conditions.get(target, 'warded');
    if (ward && ward.kind === n) return; // warded against this element
    const condMag = (opts && opts.condMag) || 1;
    if (H.cond) await afflict(enc, caster, target, H.cond, { rounds: H.rounds || 1, mag: condMag }, roller);
    if (H.corrode && opts && opts.mag) corrode(enc, target, opts.mag);
    if (H.push && opts && opts.from) await push(enc, chars, target, opts.from, H.push, roller);
    if (H.knockdown && !target.status.prone) {
      const k = await contest(roller, caster, target, 'STR', 'knockdown');
      if (!k.resisted) {
        target.status.prone = true;
        logger(enc)(`${target.name} is knocked flat (${k.a} vs ${k.b}).`, 'hit');
      }
    }
  }

  // Acid eats what it touches: armor, the shield and the weapon in hand (CONFIG.magic.corrode).
  function corrode(enc, t, mag) {
    const K = CONFIG.magic.corrode || { armor: 1, gear: 0.5 };
    const bits = [];
    const eat = (it, n, label) => {
      if (!it || !(it.durability > 0) || n <= 0) return;
      it.durability = Math.max(0, it.durability - n);
      bits.push(`${label} −${n}${it.durability ? '' : ', ruined'}`);
    };
    eat(t.armor, Math.round(mag * K.armor), 'armor');
    eat(t.shield, Math.round(mag * K.gear), 'shield');
    const w = C().wieldedWeapon(t);
    if (w && Items().weaponMaxDurability(w)) { if (w.durability == null) w.durability = Items().weaponMaxDurability(w); eat(w, Math.round(mag * K.gear), Items().itemName(w).toLowerCase()); }
    if (bits.length) logger(enc)(`The acid eats at ${t.name}'s gear (${bits.join(', ')}).`, 'hit');
  }

  // Lightning leaps on from where a bolt struck (CONFIG.magic.chain): to the nearest other creature within
  // range, friend or foe, at a share of the magnitude, while the d10 allows.
  async function chainOn(enc, chars, caster, first, n, mag, roller) {
    const K = CONFIG.magic.chain;
    if (!K) return;
    const struck = new Set([first.id, caster.id]);
    let from = first, m = mag;
    for (let hop = 0; hop < 6; hop++) {
      m = Math.floor(m * K.share);
      if (m < 1 || !enc.pos[from.id]) return;
      const r = (await roller({ actorId: caster.id, sides: 10, count: 1, label: `${caster.name}: the lightning leaps`, detail: `d10 ≤ ${Math.round(K.chance * 10)} jumps to the nearest within ${K.range}` }))[0];
      if (r > Math.round(K.chance * 10)) return;
      const next = enc.ids.map((id) => chars[id]).filter((x) => x && !struck.has(x.id) && C().isActive(x) && enc.pos[x.id] && G.Combat.dist(enc.pos[x.id], enc.pos[from.id]) <= K.range)
        .sort((a, b) => G.Combat.dist(enc.pos[a.id], enc.pos[from.id]) - G.Combat.dist(enc.pos[b.id], enc.pos[from.id]))[0];
      if (!next) return;
      struck.add(next.id);
      logger(enc)(`The lightning leaps from ${from.name} to ${next.name}.`, 'hit');
      await elementBlow(enc, chars, caster, next, n, m, roller, 'Leaping lightning', { from: enc.pos[from.id], noChain: true });
      from = next;
    }
  }

  // Shove a character `n` squares directly away from a point (stopped by walls and bodies). Each square it is
  // driven into counts as entered: pits take it, runes spring, fire burns (Terrain.enter). Returns the squares moved.
  async function push(enc, chars, t, from, n, roller, verb) {
    const at = enc.pos[t.id];
    const dx = Math.sign(at.x - from.x), dy = Math.sign(at.y - from.y);
    if (!dx && !dy) return 0;
    let moved = 0, stop = false;
    for (let k = 0; k < n && !stop; k++) {
      const nx = enc.pos[t.id].x + dx, ny = enc.pos[t.id].y + dy;
      const free = G.Terrain.passable(enc, nx, ny) && !enc.ids.some((o) => o !== t.id && G.Character.isActive(chars[o]) && enc.pos[o] && enc.pos[o].x === nx && enc.pos[o].y === ny);
      if (!free) break;
      enc.pos[t.id] = { x: nx, y: ny };
      moved++;
      if (enc.tiles && roller) stop = await G.Terrain.enter(enc, chars, t, nx, ny, roller, logger(enc));
    }
    if (moved && verb !== false) logger(enc)(`${t.name} is hurled back ${moved} square${moved > 1 ? 's' : ''}.`, 'hit');
    return moved;
  }

  // A noun's blow of some magnitude against one character: damage through the combat engine,
  // then its after-effects. Used by bursts, runes, hazards and walls.
  async function elementBlow(enc, chars, caster, target, n, mag, roller, label, opts) {
    if (!G.Character.isActive(target) && !target.status.unconscious) return;
    if (target.status.dead) return;
    opts = opts || {};
    const N = W()[n];
    let m = mag;
    if (opts.half) m = Math.floor(m / 2);
    if (N.element === 'fire' && G.Conditions && G.Conditions.flag(target, 'halveFire')) m = Math.floor(m / 2);
    const w = wardAgainst(enc, target, { spell: { element: N.element, noun: n, magnitude: m } }, false);
    if (w.blocked) return;
    m = w.magnitude;
    const option = { kind: 'strike', motion: 'spell', label, spell: { noun: n, element: N.element, magnitude: m }, damage: damageVector(n, m) };
    const r = await G.Combat.applyHit(enc, chars, caster, target, option, roller, {});
    logger(enc)(`${label} hits ${target.name}${opts.half ? ' (half: dodged aside)' : ''}: ${r.text}`, 'hit');
    if (m > 0) await onHit(enc, chars, caster, target, n, roller, { from: opts.from || enc.pos[caster.id], condMag: opts.condMag, mag: m });
  }

  // After a bolt lands (combat engine): the noun's after-effects and lingering damage.
  async function afterHit(enc, chars, a, t, option, hit, roller) {
    const s = option.spell;
    for (const n of s.nouns || [s.noun]) await onHit(enc, chars, a, t, n, roller, { from: enc.pos[a.id], condMag: s.condMag, mag: s.magnitude });
    if (s.lingering && G.Conditions && G.Character.isActive(t)) await afflict(enc, a, t, 'afflicted', { rounds: 3, mag: Math.max(1, Math.round(s.magnitude / 4)) }, roller);
    for (const n of s.nouns || [s.noun]) if ((W()[n].onHit || {}).chain) await chainOn(enc, chars, a, t, n, s.magnitude, roller);
  }

  // A ward meets a spell or a missile. Returns { blocked, magnitude, damage } for the blow to
  // go ahead with (missile weapons: damage vector; spells: magnitude). `missile`: an arrow or a
  // ranged bolt. Logs what the ward does.
  function wardAgainst(enc, target, option, missile) {
    const out = { blocked: false, magnitude: option.spell ? option.spell.magnitude : 0, damage: option.damage ? option.damage.slice() : null };
    const ward = G.Conditions && G.Conditions.get(target, 'warded');
    if (!ward) return out;
    const log = logger(enc);
    const spell = option.spell;
    if (ward.kind === 'magic' && (spell || missile)) {
      let pool = ward.pool || 0;
      if (spell && out.magnitude > 0) { const take = Math.min(pool, out.magnitude); out.magnitude -= take; pool -= take; }
      else if (out.damage) for (let i = 0; i < 3 && pool > 0; i++) { const take = Math.min(pool, out.damage[i]); out.damage[i] -= take; pool -= take; }
      log(`${target.name}'s ward of force takes ${(ward.pool || 0) - pool} of it${pool <= 0 ? ' and breaks' : ''}.`, 'defend');
      ward.pool = pool;
      if (pool <= 0) G.Conditions.remove(target, 'warded');
      if ((spell && out.magnitude <= 0) || (!spell && out.damage && out.damage.every((v) => v <= 0))) out.blocked = true;
    } else if (ward.kind === 'missiles' && missile) {
      // Half the missiles are turned aside (rolled where a die is at hand: the caller decides).
      out.deflect = 0.5;
    } else if (spell && ward.kind === spell.noun) {
      out.magnitude = Math.floor(out.magnitude / 2);
      log(`${target.name}'s ward against ${spell.noun} halves it.`, 'defend');
    }
    return out;
  }

  // Characters within `r` squares of (x, y).
  function within(enc, chars, x, y, r) {
    return enc.ids.filter((id) => chars[id] && !chars[id].status.dead && enc.pos[id] && Math.max(Math.abs(enc.pos[id].x - x), Math.abs(enc.pos[id].y - y)) <= r);
  }

  function occupied(enc, chars, x, y) {
    return enc.ids.some((id) => chars[id] && !chars[id].status.dead && enc.pos[id] && enc.pos[id].x === x && enc.pos[id].y === y);
  }

  // Squares of a wall or trench: `length` squares centred on (x, y), across the line from the
  // caster.
  function lineAcross(from, x, y, length) {
    let dx = Math.sign(x - from.x), dy = Math.sign(y - from.y);
    if (!dx && !dy) dx = 1;
    const px = -dy, py = dx; // perpendicular
    const h = Math.floor(length / 2);
    const out = [];
    for (let k = -h; k <= h; k++) out.push({ x: x + k * px, y: y + k * py });
    if (length % 2 === 0) out.pop();
    return out;
  }

  // A rune springs on whoever stepped on it (Terrain.enter calls this).
  async function springRune(enc, chars, f, x, y, roller) {
    const caster = chars[f.owner] || null;
    const N = W()[f.noun];
    const r = f.radius || 0;
    for (const id of within(enc, chars, x, y, r)) {
      const t = chars[id];
      if (N.terrain === 'pit' && enc.pos[id].x === x && enc.pos[id].y === y) {
        G.Terrain.add(enc, x, y, 'pit', { side: f.side, owner: f.owner });
        t.status.prone = true;
        logger(enc)(`The ground opens under ${t.name}!`, 'hit');
      }
      await elementBlow(enc, chars, caster || t, t, f.noun, f.mag, roller, `The rune of ${N.name.toLowerCase()}`, { from: { x, y }, condMag: f.condMag });
      if (N.bane && !N.onHit) await afflict(enc, caster, t, N.bane, { rounds: 3, mag: f.condMag || 1 }, roller);
    }
  }

  // Life mends a living body: bleeding stops (poison doesn't), condMag CON back, and stamina
  // back by the spell's magnitude (share < 1 for a burst), waking the unconscious. Returns a line.
  function mend(t, s, share) {
    const H = CONFIG.magic.heal;
    const stopped = t.bleeds.some((b) => !b.poison);
    t.bleeds = t.bleeds.filter((b) => b.poison);
    const con = Math.min(s.condMag, t.damage.CON || 0);
    if (con) C().healAttr(t, 'CON', con);
    const before = t.stamina;
    t.stamina = Math.min(C().maxStamina(t), t.stamina + Math.round((H.stamina + H.staminaPerMag * s.magnitude) * share));
    const woke = t.status.unconscious && !t.status.dead && t.stamina > 0;
    if (woke) t.status.unconscious = false;
    const bits = [stopped ? 'bleeding stops' : null, con ? `+${con} CON` : null, t.stamina > before ? `+${t.stamina - before} stamina` : null].filter(Boolean);
    return `${t.name}: ${bits.length ? bits.join(', ') : 'nothing to mend'}${woke ? `; ${t.name} comes to` : ''}.`;
  }

  // Restore: Life mends; every noun lifts the conditions it inflicts (Venom also drains the
  // poison from the blood). Returns log lines.
  function restore(t, s, share) {
    const lines = [];
    for (const n of s.nouns || [s.noun]) {
      const N = W()[n];
      if (N.heals && !C().tireless(t)) lines.push(mend(t, s, share));
      const lifted = curesOf(n).filter((k) => G.Conditions.has(t, k));
      for (const k of lifted) G.Conditions.remove(t, k);
      if (n === 'venom' && t.bleeds.some((b) => b.poison)) { t.bleeds = t.bleeds.filter((b) => !b.poison); lifted.push('poison'); }
      if (lifted.length) lines.push(`${t.name}: ${lifted.map((k) => (CONFIG.conditions[k] ? CONFIG.conditions[k].name : k).toLowerCase()).join(', ')} lifted.`);
    }
    return lines;
  }

  // A conjured creature: a fresh character on the caster's side for a few rounds.
  function conjure(enc, chars, caster, n, at, spell) {
    const N = W()[n];
    if (!G.Enemies || !G.Enemies.makeConjured) return null;
    const c = G.Enemies.makeConjured(N.conjure, n, spell.magnitude);
    if (!c) return null;
    return join(enc, chars, caster, c, at, { by: caster.id, rounds: spell.rounds || 4 });
  }

  // Raise (verb): the body nearest the aim (within a square) gets up on the caster's side, as the noun says
  // (CONFIG.magic.raise: a skeleton, a zombie, or a revenant copied from the body). It lasts the fight and falls
  // when its caster does.
  function raise(enc, chars, caster, spell, at) {
    const N = W()[spell.noun];
    const body = enc.ids.map((id) => chars[id]).filter((d) => d && d.status.dead && !d.vanished && !d.raised && enc.pos[d.id] && G.Combat.dist(enc.pos[d.id], at) <= 1)
      .sort((x, y) => G.Combat.dist(enc.pos[x.id], at) - G.Combat.dist(enc.pos[y.id], at))[0];
    if (!body || !G.Enemies || !G.Enemies.makeRaised) return null;
    const c = G.Enemies.makeRaised(N.raise, body);
    if (!c) return null;
    body.raised = true;
    body.vanished = true; // the body is up and walking: it no longer lies there
    return join(enc, chars, caster, c, enc.pos[body.id], { by: caster.id, rounds: null, bound: true });
  }

  // A new fighter on the caster's side, acting from next round.
  function join(enc, chars, caster, c, at, conjured) {
    c.side = caster.side;
    c.control = 'auto';
    c.conjured = conjured;
    chars[c.id] = c;
    (enc.extra || (enc.extra = {}))[c.id] = c;
    enc.ids.push(c.id);
    enc.order.push(c.id);
    enc.initiative[c.id] = 0;
    enc.ap[c.id] = 0;
    enc.conceded[c.id] = true; // acts from next round
    enc.pos[c.id] = { x: at.x, y: at.y };
    return c;
  }

  // Resolve a 'cast' declaration. posAtStart: where everyone stood when the pass began.
  async function resolveCast(enc, chars, d, roller, posAtStart) {
    const a = chars[d.actor];
    const o = d.option, s = o.spell;
    const log = logger(enc);
    const from = posAtStart[a.id];
    const at = d.target ? posAtStart[d.target] : d.at;
    if (!at) return;
    const distance = G.Combat.dist(from, at);
    // Named: it finds the one named, wherever they are (if their name is known).
    if (s.named) {
      if (!d.target || !knowsName(a, chars[d.target])) return log(`${a.name}'s ${o.label} fizzles — the name means nothing.`, 'fizzle');
    } else if (distance > o.maxRange || distance < (o.target === 'ally' ? 0 : o.minRange)) return log(`${a.name}'s ${o.label} fizzles — out of range.`, 'fizzle');
    // Blink needs no line (it goes through); everything else does.
    if (!s.named && distance >= 2 && s.shape !== 'blink' && G.Terrain.lineCheck(enc, from, at, 'missile').blocked) return log(`${a.name}'s ${o.label} fizzles — no clear line.`, 'fizzle');
    if (!(await G.Combat.castSpell(enc, a, o, roller))) return;
    const side = a.side;
    const N = W()[s.noun];
    switch (s.shape) {
      case 'area': {
        if (s.delayed) {
          // Delayed: the area is marked for everyone to see and breaks at the end of the round (endRound).
          for (let y = at.y - s.radius; y <= at.y + s.radius; y++) for (let x = at.x - s.radius; x <= at.x + s.radius; x++) G.Terrain.add(enc, x, y, 'gathering', { rounds: 1, owner: a.id, side, noun: s.noun });
          (enc.delayed || (enc.delayed = [])).push({ caster: a.id, at: { x: at.x, y: at.y }, spell: s, label: o.label });
          return log(`${a.name} casts ${o.label}: the air over (${at.x + 1}, ${at.y + 1}) begins to gather; it breaks at the end of the round.`, 'hit');
        }
        log(`${a.name} casts ${o.label} at (${at.x + 1}, ${at.y + 1}).`, 'hit');
        for (const id of within(enc, chars, at.x, at.y, s.radius)) {
          const t = chars[id];
          const k = await contest(roller, a, t, 'avoid', o.label);
          await elementBlow(enc, chars, a, t, s.noun, s.lingering ? Math.ceil(s.magnitude / 2) : s.magnitude, roller, o.label, { half: k.resisted, from: at, condMag: s.condMag });
          if (s.lingering && G.Character.isActive(t)) await afflict(enc, a, t, 'afflicted', { rounds: 3, mag: Math.max(1, Math.round(s.magnitude / 4)) }, roller);
        }
        return;
      }
      case 'ground': {
        let n = 0;
        const grounds = (s.nouns || [s.noun]).map((k) => W()[k].ground);
        for (let y = at.y - s.radius; y <= at.y + s.radius; y++) for (let x = at.x - s.radius; x <= at.x + s.radius; x++) {
          if (!G.Terrain.passable(enc, x, y)) continue;
          let any = false;
          for (const g of grounds) if (G.Terrain.add(enc, x, y, g, { rounds: s.rounds, mag: s.magnitude - 1, noun: s.noun, owner: a.id, side })) any = true;
          if (any) n++;
        }
        return log(`${a.name} casts ${o.label}: ${grounds.map((g) => CONFIG.terrain[g].name.toLowerCase()).join(' and ')} cover${grounds.length > 1 ? '' : 's'} ${n} squares.`, 'hit');
      }
      case 'wall': {
        const solid = !!CONFIG.terrain[N.wall].wall;
        const squares = lineAcross(from, at.x, at.y, s.length).filter((q) => G.Terrain.inGrid(enc, q.x, q.y) && !(solid && occupied(enc, chars, q.x, q.y)));
        for (const q of squares) G.Terrain.add(enc, q.x, q.y, N.wall, { rounds: s.rounds, mag: Math.max(0, s.magnitude - 1), noun: s.noun, owner: a.id, side });
        return log(`${a.name} casts ${o.label}: a ${CONFIG.terrain[N.wall].name.toLowerCase()} rises across ${squares.length} square${squares.length === 1 ? '' : 's'}.`, 'hit');
      }
      case 'terrain': {
        const squares = lineAcross(from, at.x, at.y, s.length).filter((q) => G.Terrain.passable(enc, q.x, q.y));
        for (const q of squares) {
          G.Terrain.add(enc, q.x, q.y, N.terrain, { rounds: s.rounds, noun: s.noun, owner: a.id, side });
          const who = enc.ids.find((id) => chars[id] && C().isActive(chars[id]) && enc.pos[id].x === q.x && enc.pos[id].y === q.y);
          if (who) {
            const t = chars[who];
            const k = await contest(roller, a, t, 'avoid', 'the opening pit');
            if (k.resisted) log(`${t.name} keeps to the edge of the pit (${k.b} vs ${k.a}).`, 'defend');
            else {
              t.status.prone = true;
              t.stamina = Math.max(0, t.stamina - CONFIG.terrain.pitDamage);
              log(`${t.name} drops into the pit.`, 'hit');
            }
          }
        }
        return log(`${a.name} casts ${o.label}: the ground opens across ${squares.length} square${squares.length === 1 ? '' : 's'}.`, 'hit');
      }
      case 'rune': {
        const f = G.Terrain.add(enc, at.x, at.y, 'rune', { noun: s.noun, mag: s.magnitude, owner: a.id, side, hidden: true });
        if (f) { f.radius = s.radius; f.condMag = s.condMag; }
        return log(`${a.name} traces a rune on the ground.`, 'pass');
      }
      case 'bane':
      case 'mind': {
        const t = chars[d.target];
        if (!t || !C().isActive(t)) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        log(`${a.name} casts ${o.label} on ${t.name}.`, 'hit');
        const field = s.shape === 'mind' ? 'mind' : 'bane';
        // A combination of two nouns can make something new (Rage + Dream: confusion).
        const keys = s.combo ? [s.combo] : (s.nouns || [s.noun]).map((k) => W()[k][field]);
        for (const key of keys) await afflict(enc, a, t, key, { rounds: s.rounds, mag: s.condMag }, roller);
        return;
      }
      case 'boon': {
        const t = chars[d.target];
        if (!t || t.status.dead) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        log(`${a.name} casts ${o.label} on ${t === a ? 'themself' : t.name}.`, 'defend');
        for (const k of s.nouns || [s.noun]) {
          const boon = W()[k].boon;
          G.Conditions.add(t, boon, { rounds: s.rounds, mag: s.condMag, src: a.id });
          log(`${t.name} is ${CONFIG.conditions[boon].name.toLowerCase()} (${s.rounds} rounds).`, 'defend');
        }
        return;
      }
      case 'restore': {
        const t = chars[d.target];
        if (!t || t.status.dead || !enc.pos[t.id]) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        log(`${a.name} casts ${o.label} on ${t === a ? 'themself' : t.name}${s.radius ? ' and all around' : ''}.`, 'defend');
        // Wide: everyone living within the radius, friend or foe, at a share of the stamina.
        const who = s.radius ? within(enc, chars, enc.pos[t.id].x, enc.pos[t.id].y, s.radius).map((id) => chars[id]) : [t];
        const share = s.radius ? CONFIG.magic.heal.areaShare : 1;
        for (const x of who) for (const line of restore(x, s, share)) log(line, 'defend');
        return;
      }
      case 'ward': {
        const t = chars[d.target];
        if (!t || t.status.dead) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        const kind = N.ward;
        const pool = kind === 'magic' ? s.magnitude * 3 : null;
        G.Conditions.add(t, 'warded', { rounds: s.rounds, mag: s.condMag, kind, pool, src: a.id });
        const what = { magic: `a ward of force (${pool} points against spells and missiles)`, missiles: 'a ward of wind that turns missiles aside', mind: 'a ward on the mind' }[kind] || `a ward against ${kind}`;
        return log(`${a.name} casts ${o.label}: ${t === a ? 'themself' : t.name} is wrapped in ${what} (${s.rounds} rounds).`, 'defend');
      }
      case 'blink': {
        if (!G.Terrain.passable(enc, at.x, at.y) || occupied(enc, chars, at.x, at.y)) return log(`${a.name}'s ${o.label} fizzles — no room there.`, 'fizzle');
        // A step through space: walls, pits and grips don't hold you.
        if (G.Combat.releaseAll) G.Combat.releaseAll(chars, a);
        if (G.Conditions) for (const x of G.Conditions.list(a).slice()) if ((CONFIG.conditions[x.key] || {}).noMove) G.Conditions.remove(a, x.key);
        a.status.webbed = 0;
        enc.pos[a.id] = { x: at.x, y: at.y };
        return log(`${a.name} blinks to (${at.x + 1}, ${at.y + 1}).`, 'defend');
      }
      case 'raise': {
        const c = raise(enc, chars, a, s, at);
        if (!c) return log(`${a.name}'s ${o.label} fizzles — no body to raise there.`, 'fizzle');
        const p = enc.pos[c.id];
        return log(`${a.name} casts ${o.label}: ${c.name} rises at (${p.x + 1}, ${p.y + 1}).`, 'hit');
      }
      case 'conjure': {
        if (!G.Terrain.passable(enc, at.x, at.y) || occupied(enc, chars, at.x, at.y)) return log(`${a.name}'s ${o.label} fizzles — no room.`, 'fizzle');
        const c = conjure(enc, chars, a, s.noun, at, s);
        if (!c) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        const p = enc.pos[c.id];
        return log(`${a.name} ${typeof N.conjure === 'object' ? 'summons' : 'conjures'} ${c.name} at (${p.x + 1}, ${p.y + 1}) for ${c.conjured.rounds} rounds.`, 'hit');
      }
      default:
        return log(`${a.name}'s ${o.label} does nothing.`, 'fizzle');
    }
  }

  // End of round, before wounds and conditions: Delayed spells break.
  async function breakDelayed(enc, chars, roller) {
    const due = enc.delayed || [];
    enc.delayed = [];
    for (const d of due) {
      const a = chars[d.caster];
      if (!a) continue;
      const s = d.spell;
      logger(enc)(`${a.name}'s ${d.label} breaks over (${d.at.x + 1}, ${d.at.y + 1}).`, 'hit');
      for (const id of within(enc, chars, d.at.x, d.at.y, s.radius)) {
        const t = chars[id];
        if (!C().isActive(t)) continue;
        await elementBlow(enc, chars, a, t, s.noun, s.lingering ? Math.ceil(s.magnitude / 2) : s.magnitude, roller, d.label, { from: d.at, condMag: s.condMag });
      }
    }
  }

  // End of round: conjured creatures fade; the raised fall when the one who raised them does.
  function endRound(enc, chars) {
    const lines = [];
    for (const id of enc.ids) {
      const c = chars[id];
      if (!c || !c.conjured || c.status.dead) continue;
      if (c.conjured.rounds == null) {
        const by = chars[c.conjured.by];
        if (c.conjured.bound && (!by || !C().isActive(by))) { c.status.dead = true; c.vanished = true; lines.push(`${c.name} falls, its maker gone.`); }
        continue;
      }
      c.conjured.rounds -= 1;
      if (c.conjured.rounds <= 0) {
        c.status.dead = true;
        c.vanished = true;
        lines.push(`${c.name} fades away.`);
      }
    }
    return lines;
  }

  G.Magic = { breakDelayed, raise, join, corrode, chainOn, powerOptions, castableOptions, usePower, rechargeAll, chargesLeft, mend, restore, curesOf, knowsName, wardAgainst, maxSP, availableSP, spellOptions, knows, combines, backlash, makeOption, contest, afflict, onHit, elementBlow, afterHit, springRune, resolveCast, lineAcross, endRound, push };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
