/*
 * Magic (PROVISIONAL; the spell words of 2026-11-08, docs/PROPOSALS.md §4).
 *
 * A spell is a verb and a noun, 1 to 3 words: a verb alone (Bind, Move, See), a verb and a noun, either with one
 * modifier, or Summon + Bind + a noun. Cost = the sum of the words' costs. Verbs and modifiers are studied (Magic:
 * words feats); nouns are found in the world (c.nouns). Every number lives in spells.yaml or CONFIG.magic.
 *
 *   verb — what happens: Strike, Give, Take, Move, Raise, Bind, Summon, Shape, See
 *   noun — what it happens to. Each noun's `does` says what each verb makes of it: a shape the engine knows
 *          (bolt, area, ground, wall, terrain, rune, bane, boon, mind, restore, revive, drain, give, ward, blink,
 *          raise, summon, dispel, banish, channel, see) and what it is aimed at (foe, ally, any, ground).
 *   mod  — strong (+magnitude), wide (an area, a longer wall, a heal for everyone near), long (twice as long),
 *          far (twice the range), hidden (a ground spell waits as a rune), delayed (an area that breaks at round end)
 *
 * Bolts are declared like attacks ('strike' with a spell option) and resolve through the combat engine (guards,
 * armor). Everything else is a 'cast' declaration aimed at a square or a character, resolved here (resolveCast).
 * Tradition feats (feats.yaml `spell`) strengthen the spells whose words match theirs (spellBonus).
 */
(function (G) {
  'use strict';
  const CONFIG = G.CONFIG;

  const C = () => G.Character;
  const Items = () => G.Items;
  const W = () => CONFIG.magic.words;
  const SHAPES = () => W().shapes || {};
  const BOLT = ['bolt'];
  // What a shape is aimed at when its effect doesn't say.
  const SQUARE = ['area', 'ground', 'wall', 'terrain', 'rune', 'raise', 'summon', 'see', 'blink', 'dispel'];

  // Spell points: INT + CONFIG.skills.spPerRank per Arcane rank (none at Arcane 0), + what worn gear adds (sp), + 2 per
  // Familiar rank while it lives.
  function freshSP(c) {
    const r = C().skill(c, 'arcane');
    if (r <= 0) return 0;
    const fam = C().rank(c, 'familiar') && c.companion && c.companion.familiar && !c.companion.status.dead ? 2 * C().rank(c, 'familiar') : 0;
    return C().attr(c, 'INT') + CONFIG.skills.spPerRank * r + G.Effects.sum(c, 'sp') + fam;
  }

  // Less what the day's casting has worn off it (c.spWeary, CONFIG.magic.spWeary; a long rest clears it).
  function maxSP(c) {
    const f = freshSP(c);
    return f ? Math.max(0, Math.floor(f - (c.spWeary || 0))) : 0;
  }

  // A rest after a fight: the points spent come back, and each wears spWeary off the maximum. Returns the points lost.
  function restSP(c) {
    const spent = c.spSpent || 0;
    if (!spent) return 0;
    const before = maxSP(c);
    c.spWeary = Math.min(freshSP(c), (c.spWeary || 0) + spent * (CONFIG.magic.spWeary || 0));
    c.spSpent = 0;
    return before - maxSP(c);
  }

  // Points the caster can draw on right now.
  // Overchannel (feat): points beyond the pool, paid in CON, short of the last point of it.
  function overchannelSP(c) {
    return C().rank(c, 'overchannel') ? Math.max(0, C().attr(c, 'CON') - 1) : 0;
  }

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

  // A noun is known when found (c.nouns); Name when the caster knows anyone's name; verbs and modifiers by feat.
  function knows(c, key) {
    const w = W()[key];
    if (!w || !w.kind) return false;
    if (key === 'name') return (c.knownNames || []).length > 0;
    if (w.kind === 'noun') return (c.nouns || []).includes(key);
    return !!(w.feat && C().rank(c, w.feat));
  }

  // A Bind + Name reaches anyone whose name the caster knows: companions (and themself), or a foe whose name they've
  // learned (c.knownNames, matched without case).
  function knowsName(c, t) {
    if (!t) return false;
    if (t.id === c.id || t.side === c.side || (t.charmed && t.charmed.side === c.side)) return true;
    return (c.knownNames || []).some((n) => String(n).trim().toLowerCase() === String(t.name).trim().toLowerCase());
  }

  // Kinds a spell may be limited to (an effect's `only`).
  function undead(t) { return !!(t && G.Effects.has(t, 'undead')); }
  function outsider(t) { return !!(t && (G.Effects.has(t, 'outsider') || (t.conjured && t.conjured.summoned && !undead(t)))); }
  function fits(t, only) {
    if (!only) return true;
    if (only === 'undead') return undead(t);
    if (only === 'outsider') return outsider(t);
    if (only === 'living') return !C().tireless(t) && !outsider(t);
    return true;
  }

  // What a verb makes of a noun (or of nothing, for a verb alone): a list of effects, each with its aim filled in.
  function effectsOf(v, n) {
    const V = W()[v];
    if (!V || V.kind !== 'verb') return [];
    let raw;
    if (n == null) raw = V.alone;
    else {
      const N = W()[n];
      if (!N || N.kind !== 'noun') return [];
      raw = (N.does || {})[v];
    }
    return [].concat(raw || []).map((e) => Object.assign({ aim: SQUARE.includes(e.shape) ? 'ground' : 'foe' }, e));
  }

  function modFits(e, m) {
    if (!m) return true;
    const M = W()[m];
    if (!M || M.kind !== 'mod') return false;
    return !M.shapes || M.shapes.includes(e.shape);
  }

  // Does this verb make anything of this noun (and take this modifier)? (Validation of item powers.)
  function combines(v, n, m) {
    return effectsOf(v, n || null).some((e) => modFits(e, m));
  }

  // The conditions a noun inflicts (its blow's, and its curses'), which a ward of it keeps off and lifts.
  function curesOf(n) {
    const N = W()[n];
    if (!N || N.kind !== 'noun') return [];
    const out = [N.onHit && N.onHit.cond];
    for (const v in N.does || {}) for (const e of [].concat(N.does[v])) {
      if (e.cond && e.aim !== 'ally' && e.shape !== 'boon') out.push(e.cond);
      for (const k of e.cures || []) out.push(k);
    }
    return [...new Set(out.filter((k) => k && CONFIG.conditions[k]))];
  }

  // Tradition feats (feats.yaml `spell`: { match: [{verb, noun, aim, mod, shape}], mag, cost, radius, roundsMult,
  // contest, bound }): what the caster's feats add to a spell. A rule matches when every field it names agrees.
  function spellBonus(c, sp) {
    const out = { mag: 0, cost: 0, radius: 0, roundsMult: 1, contest: 0, bound: false };
    const F = G.DATA && G.DATA.FEATS;
    if (!F) return out;
    const agrees = (r) => (!r.verb || (sp.verbs || [sp.verb]).includes(r.verb)) && (!r.noun || [].concat(r.noun).includes(sp.noun)) &&
      (!r.aim || r.aim === sp.aim) && (!r.mod || r.mod === sp.mod) && (!r.shape || r.shape === sp.shape);
    for (const id in c.feats || {}) {
      const f = F[id];
      if (!f || !f.spell || !(c.feats[id] > 0)) continue;
      const S = f.spell;
      if (!S.match || ![].concat(S.match).some(agrees)) continue;
      const k = c.feats[id];
      out.mag += (S.mag || 0) * k;
      out.cost += (S.cost || 0) * k;
      out.radius += S.radius || 0;
      out.contest += (S.contest || 0) * k;
      if (S.roundsMult) out.roundsMult *= S.roundsMult;
      if (S.bound) out.bound = true;
    }
    return out;
  }

  function spellOptions(c) {
    return castableOptions(c).concat(powerOptions(c));
  }

  // Powers of worn and wielded things (a circlet that veils at will, a staff with charges of a dread gaze) and a
  // monster's own (monsters.yaml `powers`: a ghost's chill touch): item.power or an enchantment's power =
  // { verb, noun, mod, aim, charges (a day; null = at will), name }. A power needs no spell points, no free hand and
  // no backlash; the wielder's own INT and Arcane still set the contest.
  function powerSources(c) {
    const out = [];
    for (const p of c.powers || []) out.push({ item: c, power: p });
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
      const e = effectsOf(p.verb, p.noun || null).find((x) => (!p.aim || x.aim === p.aim) && modFits(x, p.mod || null));
      if (!e) continue;
      const o = makeOption(c, p.verb, p.noun || null, p.mod || null, { effect: e });
      const left = chargesLeft(item, p);
      Object.assign(o, { spCost: 0, power: { item: item.id, name: p.name, left: left === Infinity ? null : left }, label: `${p.name} (${o.label.replace(/ \(([^)]*)\)$/, ', $1')}${left === Infinity ? '' : `, ${left} left`})`, spellKey: `power:${item.id}:${p.name}` });
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
    for (const it of [c, c.armor, c.shield].concat(c.pieces || [], c.weapons || [], c.trinkets || [])) if (it && it.used) delete it.used;
  }

  // Kinds of outsider the caster can call by name: a known name that is a summonable monster's (monsters.yaml traits
  // outsider), as [monster key, its name].
  function namedOutsiders(c) {
    const M = (G.Enemies && G.Enemies.MONSTERS) || {};
    const out = [];
    for (const n of c.knownNames || []) {
      const want = String(n).trim().toLowerCase();
      const k = Object.keys(M).find((key) => !M[key].group && (M[key].traits || {}).outsider && String(M[key].name).toLowerCase() === want);
      if (k && !out.some((x) => x[0] === k)) out.push([k, M[k].name]);
    }
    return out;
  }

  function castableOptions(c) {
    const words = W();
    if (!maxSP(c)) return [];
    const verbs = Object.keys(words).filter((k) => words[k].kind === 'verb' && knows(c, k));
    const nouns = [null].concat(Object.keys(words).filter((k) => words[k].kind === 'noun' && knows(c, k)));
    const mods = [null].concat(Object.keys(words).filter((k) => words[k].kind === 'mod' && knows(c, k)));
    const out = [];
    for (const v of verbs) for (const n of nouns) for (const e of effectsOf(v, n)) {
      // Summon + a name: one spell for each kind of outsider whose name the caster knows.
      const kinds = e.shape === 'summon' && e.named ? namedOutsiders(c) : [null];
      for (const kind of kinds) {
        const extra = kind ? { monster: kind[0], monsterName: kind[1] } : {};
        for (const m of mods) {
          if (!modFits(e, m)) continue;
          out.push(makeOption(c, v, n, m, Object.assign({ effect: e }, extra)));
        }
        // Two verbs (Summon + Bind): the third word, so no modifier.
        for (const p of words[v].pairs || []) if (knows(c, p)) out.push(makeOption(c, v, n, null, Object.assign({ effect: e, pair: p }, extra)));
      }
    }
    return out;
  }

  // Raise + Life calls back the dead still in the window, and so does Move + Life given to them.
  function callsBack(s) {
    return !!s && (s.shape === 'revive' || s.shape === 'give');
  }

  // Magnitude: the shape's, + the modifier's, + affinity with the noun, + gear.
  function magnitude(c, base, n, M) {
    let mag = (base || 0) + (M ? M.mag || 0 : 0);
    const aff = n && (CONFIG.magic.affinity || {})[n];
    if (aff) mag += C().rank(c, aff);
    // Worn gear: a skullcap that strengthens every spell, an amulet that strengthens one noun.
    if (n) mag += G.Effects.sum(c, 'mag', n);
    mag += G.Effects.sum(c, 'mag', '*');
    return mag;
  }

  // The damage vector a noun's blow carries (energies — fire, frost, lightning, decay, spirit, life — are worked out
  // by Combat.computeHit from spell.element and magnitude instead).
  function damageVector(n, mag) {
    const kind = n && (W()[n] || {}).hurt;
    if (kind === 'blunt') return [0, 0, mag];
    if (kind === 'halfBlunt') return [0, 0, Math.ceil(mag / 2)];
    if (kind === 'thorns') return [0, Math.ceil(mag / 2), 0];
    return [0, 0, 0];
  }

  const AIM_TEXT = { foe: 'on a foe', ally: 'on an ally', any: 'on anyone', ground: 'on the ground' };

  // One spell. opts: { effect (one of effectsOf(v, n); the first when not given), pair (a second verb: Summon +
  // Bind), monster and monsterName (Summon + a name) }.
  function makeOption(c, v, n, m, opts) {
    opts = opts || {};
    const w = W();
    const e = opts.effect || effectsOf(v, n || null)[0];
    if (!e) return null;
    const V = w[v], N = n ? w[n] : null, M = m ? w[m] : null;
    // A Wide or Delayed bolt bursts over an area; a Hidden ground spell waits as a rune.
    const shape = e.shape === 'bolt' && M && M.area ? 'area' : M && M.hidden ? 'rune' : e.shape;
    const S = SHAPES()[shape] || {};
    const verbs = [v].concat(opts.pair ? [opts.pair] : []);
    // A raise's tier: the best of `better` whose feat the caster has.
    let raiseKind = e.raise || null;
    for (const b of e.better || []) if (C().rank(c, b.feat)) raiseKind = b.raise;
    const sp = { verb: v, verbs, noun: n || null, aim: e.aim, mod: m || null, shape };
    const fb = spellBonus(c, sp);
    const baseMag = shape !== e.shape ? S.mag : e.mag != null ? e.mag : S.mag;
    const mag = magnitude(c, baseMag, n, M) + fb.mag;
    // Firestorm: Fire with Wide costs a point less.
    const storm = n === 'fire' && m === 'wide' && C().rank(c, 'firestorm') ? 1 : 0;
    const cost = Math.max(1, verbs.reduce((t, k) => t + (w[k].cost || 0), 0) + (N ? N.cost : 0) + (M ? M.cost : 0) + (e.cost || 0) + fb.cost - storm);
    const bolt = BOLT.includes(shape);
    const windUp = !!(bolt && M && M.windUp && CONFIG.windUp && CONFIG.windUp.spells);
    // Base AP (Specifics units) through the turn-budget curve, then Quick Casting and armor.
    let baseAP = (e.ap || S.ap || CONFIG.magic.castAP) + (!bolt && M && M.windUp ? 1 : 0) + (M && M.ap ? M.ap : 0);
    if (windUp) baseAP -= CONFIG.windUp.ap;
    const full = Math.max(C().minAP(), Math.round(C().baseAP(baseAP)));
    const ap = C().gearAP(c, Math.max(C().minAP(), full - C().quickCut(c, 'quick_casting', full)) + C().armorAP(c));
    const far = M && M.rangeMult ? M.rangeMult : 1;
    // An area keeps its bolt's reach (Take Life Wide: round the caster or a square beside them).
    const reach = shape === 'area' ? [0, (e.range || S.range || [0, 6])[1]] : e.range || S.range || [1, 1];
    const range = [reach[0], reach[1] * far];
    const rounds = e.rounds != null ? e.rounds : S.rounds;
    const named = !!e.named;
    const verbLabel = verbs.map((k) => w[k].name).join(' + ');
    const nounName = opts.monsterName || (N ? N.name : null);
    const twoAims = n != null && effectsOf(v, n).length > 1;
    const nounLabel = (nounName || '—') + (twoAims ? ` (${AIM_TEXT[e.aim] || e.aim})` : '');
    const label = [verbLabel, nounName, M ? M.name : null].filter(Boolean).join(' + ') + (twoAims ? ` (${AIM_TEXT[e.aim] || e.aim})` : '');
    const spell = Object.assign(sp, {
      nouns: n ? [n] : [], element: N ? N.element : null, magnitude: mag, cost,
      radius: (S.radius || 0) + (e.radius || 0) + (M && M.radius ? M.radius : 0) + (fb.radius || 0),
      length: (S.length || 1) + (M && M.length ? M.length : 0),
      rounds: rounds == null ? null : Math.round(rounds * (M && M.roundsMult ? M.roundsMult : 1) * fb.roundsMult),
      delayed: !!(M && M.delayed),
      condMag: 1 + (M && M.mag ? 1 : 0),
      named, contest: fb.contest + (named ? CONFIG.magic.nameBonus || 0 : 0),
      cond: e.cond || null, ground: e.ground || null, wall: e.wall || null, terrain: e.terrain || null, ward: e.ward || null,
      raise: raiseKind, monster: opts.monster || e.monster || null, stack: !!e.stack, only: e.only || null, undeadMend: e.undead === 'mend',
      bound: !!opts.pair || fb.bound, heals: !!e.heals, cures: e.cures || [], what: e.what || null,
      verbKey: verbs.join('+'), verbLabel, nounKey: (n || '') + (opts.monster ? ':' + opts.monster : '') + (twoAims ? '@' + e.aim : ''), nounLabel,
    });
    const base = {
      spellKey: [verbs.join('+'), n, opts.monster, twoAims ? e.aim : null, m].filter(Boolean).join('+'), label, spell, ap, stamina: 0, spCost: cost,
      minRange: range[0], maxRange: range[1], reach: range[1], closePenalty: false,
    };
    if (bolt) {
      return Object.assign(base, {
        kind: 'strike', motion: 'spell', windUp, ranged: range[0] > 1,
        damage: damageVector(n, mag),
      });
    }
    // target: what the caster aims at — a square, a foe, an ally or themself, or anyone.
    const target = SQUARE.includes(shape) && !(shape === 'dispel' && e.aim === 'any') ? 'square' : shape === 'drain' ? (spell.radius ? 'square' : 'foe') : e.aim === 'ground' ? 'square' : e.aim;
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

  // Caster's d10 + ⌊INT/2⌋ + Arcane (+ bonus: a known name, a tradition feat) against the target's d10 + its resisting
  // attribute ('avoid' = ⌊(DEX + SPD)/4⌋, like a dodge; otherwise ⌊attribute/2⌋). Ties: the target.
  async function contest(roller, caster, target, attr, what, bonus) {
    const cb = Math.floor(C().attr(caster, 'INT') / 2) + C().skill(caster, 'arcane') + (bonus || 0);
    const tb = attr === 'avoid'
      ? Math.floor((C().combatAttr(target, 'DEX') + C().combatAttr(target, 'SPD')) / 4) + C().skill(target, 'evasion')
      : Math.floor(C().attr(target, attr) / 2);
    const rc = (await roller({ actorId: caster.id, sides: 10, count: 1, label: `${caster.name}: ${what}`, detail: `d10 + ${cb}` }))[0];
    const rt = (await roller({ actorId: target.id, sides: 10, count: 1, label: `${target.name}: resist ${what}`, detail: `d10 + ${tb} (${attr === 'avoid' ? 'DEX/SPD, Evasion' : attr})` }))[0];
    return { resisted: rt + tb >= rc + cb, a: rc + cb, b: rt + tb };
  }

  function logger(enc) {
    return (t, cls) => G.Combat.log(enc, t, cls);
  }

  // Put a condition on a target, who may resist (CONFIG.conditions[key].resistedBy).
  async function afflict(enc, caster, target, key, opts, roller) {
    if (!G.Conditions || !CONFIG.conditions[key] || !G.Character.isActive(target)) return false;
    if (caster && C().damageMult(target, 'magic') === 0) { logger(enc)(`The magic washes off ${target.name}.`, 'defend'); return false; }
    if (C().tireless(target) && CONFIG.conditions[key].living) return false;
    if (C().damageMult(target, G.Conditions.typeOf(key)) === 0) { logger(enc)(`${target.name} shrugs it off.`, 'defend'); return false; }
    const ward = G.Conditions.get(target, 'warded');
    const mindish = CONFIG.conditions[key].resistedBy === 'WIL';
    if (mindish && ((ward && ward.kind === 'mind') || G.Effects.has(target, 'mindWard'))) {
      logger(enc)(`${target.name}'s mind is shut against it.`, 'defend');
      return false;
    }
    if (CONFIG.conditions[key].fearOf && G.Effects.has(target, 'noFear')) return false;
    if (G.Conditions.list(target).some((x) => ((CONFIG.conditions[x.key] || {}).immune || []).includes(key))) {
      logger(enc)(`${target.name} shrugs it off.`, 'defend');
      return false;
    }
    if (ward && ward.kind && curesOf(ward.kind).includes(key)) {
      logger(enc)(`${target.name}'s ward keeps it off.`, 'defend');
      return false;
    }
    const resist = CONFIG.conditions[key].resistedBy;
    const name = CONFIG.conditions[key].name;
    if (resist && caster && caster !== target) {
      const k = await contest(roller, caster, target, resist, name.toLowerCase(), opts.contest);
      if (k.resisted) {
        logger(enc)(`${target.name} resists being ${name.toLowerCase()} (${k.b} vs ${k.a}).`, 'defend');
        return false;
      }
    }
    const had = opts.stack && G.Conditions.get(target, key);
    const before = had ? had.mag : 0;
    const n = G.Conditions.add(target, key, Object.assign({ src: caster ? caster.id : null }, opts));
    // A curse cast again (stack) adds to the one already there.
    if (had && n) n.mag = before + (opts.mag || 1);
    logger(enc)(`${target.name} is ${name.toLowerCase()} (${opts.rounds} round${opts.rounds > 1 ? 's' : ''}${n && n.mag > 1 && opts.stack ? `, ×${n.mag}` : ''}).`, 'hit');
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
    const N = W()[n] || {};
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

  // Decay eats what it touches: armor, the shield and the weapon in hand (CONFIG.magic.corrode).
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
    if (bits.length) logger(enc)(`Decay eats at ${t.name}'s gear (${bits.join(', ')}).`, 'hit');
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
    // A noun, or a bare element a hazard names (radiance: light) with no word of its own.
    const N = W()[n] || { element: n, name: n };
    let m = mag;
    if (opts.half) m = Math.floor(m / 2);
    const w = wardAgainst(enc, target, { spell: { element: N.element, noun: n, magnitude: m } }, false);
    if (w.blocked) return;
    m = w.magnitude;
    const option = { kind: 'strike', motion: 'spell', label, spell: { noun: n, element: N.element, magnitude: m }, damage: damageVector(n, m) };
    const r = await G.Combat.applyHit(enc, chars, caster, target, option, roller, {});
    logger(enc)(`${label} hits ${target.name}${opts.half ? ' (half: dodged aside)' : ''}: ${r.text}`, 'hit');
    if (m > 0) await onHit(enc, chars, caster, target, n, roller, { from: opts.from || enc.pos[caster.id], condMag: opts.condMag, mag: m });
  }

  // After a bolt lands (combat engine): the noun's after-effects.
  async function afterHit(enc, chars, a, t, option, hit, roller) {
    const s = option.spell;
    for (const n of s.nouns || [s.noun]) await onHit(enc, chars, a, t, n, roller, { from: enc.pos[a.id], condMag: s.condMag, mag: s.magnitude });
    // Kindling: a fire spell that lands sets its target burning.
    if (s.element === 'fire' && C().rank(a, 'kindling') && G.Conditions && G.Character.isActive(t)) await afflict(enc, a, t, 'burning', { rounds: 2, mag: 1 }, roller);
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
      // A ward of Death keeps a ghost's touch off altogether; the others halve their element.
      if ((W()[ward.kind] || {}).wardBlocks) {
        out.magnitude = 0;
        out.blocked = true;
        log(`${target.name}'s ward against ${(W()[ward.kind] || {}).name || ward.kind} turns it aside.`, 'defend');
      } else {
        out.magnitude = Math.floor(out.magnitude / 2);
        log(`${target.name}'s ward against ${(W()[ward.kind] || {}).name || ward.kind} halves it.`, 'defend');
      }
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
  // A Hidden spell: the noun's blow on whoever is on it (or within its radius), a pit opening (Take + Earth), the
  // ground the spell would have laid (Give + Fire: hot ground) round the square.
  async function springRune(enc, chars, f, x, y, roller) {
    const caster = chars[f.owner] || null;
    const N = W()[f.noun];
    const r = f.radius || 0;
    for (const id of within(enc, chars, x, y, r)) {
      const t = chars[id];
      if (f.terrain === 'pit' && enc.pos[id].x === x && enc.pos[id].y === y) {
        G.Terrain.add(enc, x, y, 'pit', { side: f.side, owner: f.owner });
        t.status.prone = true;
        logger(enc)(`The ground opens under ${t.name}!`, 'hit');
      }
      await elementBlow(enc, chars, caster || t, t, f.noun, f.mag, roller, `The rune of ${N.name.toLowerCase()}`, { from: { x, y }, condMag: f.condMag });
    }
    if (f.ground && CONFIG.terrain[f.ground]) for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
      if (G.Terrain.passable(enc, xx, yy)) G.Terrain.add(enc, xx, yy, f.ground, { rounds: 3, mag: Math.max(0, (f.mag || 1) - 4), noun: f.noun, owner: f.owner, side: f.side });
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
    if (woke) C().comeRound(t);
    const bits = [stopped ? 'bleeding stops' : null, con ? `+${con} CON` : null, t.stamina > before ? `+${t.stamina - before} stamina` : null].filter(Boolean);
    return `${t.name}: ${bits.length ? bits.join(', ') : 'nothing to mend'}${woke ? `; ${t.name} comes to` : ''}.`;
  }

  // What a given Transfer does: bleeding stopped, then each point a lost CON back, or with none lost, stamina.
  function giveLife(t, pts) {
    const stopped = t.bleeds.some((b) => !b.poison);
    t.bleeds = t.bleeds.filter((b) => b.poison);
    const con = Math.min(pts, t.damage.CON || 0);
    if (con) C().healAttr(t, 'CON', con);
    const before = t.stamina;
    t.stamina = Math.min(C().maxStamina(t), t.stamina + (pts - con) * CONFIG.magic.transfer.staminaPerCON);
    const woke = t.status.unconscious && !t.status.dead && t.stamina > 0;
    if (woke) C().comeRound(t);
    C().updateCondition(t);
    const bits = [stopped ? 'bleeding stops' : null, con ? `+${con} CON` : null, t.stamina > before ? `+${t.stamina - before} stamina` : null].filter(Boolean);
    return `${t.name}: ${bits.length ? bits.join(', ') : 'nothing to mend'}${woke ? `; ${t.name} comes to` : ''}.`;
  }

  // Dead, but still within reach of a Life restore (CONFIG.magic.revive): the fight stamps the round they died in.
  function revivable(enc, c) {
    const R = CONFIG.magic.revive;
    return !!(R && c && c.status.dead && !c.vanished && !c.raised && !c.conjured && !C().tireless(c) && c.status.diedRound != null && enc && enc.round - c.status.diedRound <= R.rounds);
  }

  // Called back from death: CON up to revive.con, bleeding stopped, alive but unconscious at 0 stamina.
  function revive(t) {
    // attr() reads 0 however far below a blow took CON, so mend a point at a time until it shows.
    while (C().attr(t, 'CON') < CONFIG.magic.revive.con && (t.damage.CON || 0) > 0) C().healAttr(t, 'CON', 1);
    t.bleeds = t.bleeds.filter((b) => b.poison);
    t.stamina = 0;
    t.status.dead = false;
    t.status.unconscious = true;
    t.status.collapsed = null; // called back by a spell: unconscious until roused or healed, not a collapse
    delete t.status.diedRound;
    return `${t.name} is called back from death, breathing but unconscious.`;
  }

  // Give + Life mends; a ward taken against a noun (Take + Fire on an ally) first lifts the conditions it inflicts
  // (Decay also drains the poison from the blood). Returns log lines.
  function restore(t, s, share) {
    const lines = [];
    for (const n of s.nouns || [s.noun]) {
      const N = W()[n];
      if (s.heals && !C().tireless(t)) lines.push(mend(t, s, share));
      const lifted = (s.heals ? [] : curesOf(n)).concat(s.cures || []).filter((k) => G.Conditions.has(t, k));
      for (const k of lifted) G.Conditions.remove(t, k);
      if (N.curesPoison && t.bleeds.some((b) => b.poison)) { t.bleeds = t.bleeds.filter((b) => !b.poison); lifted.push('poison'); }
      if (lifted.length) lines.push(`${t.name}: ${lifted.map((k) => (CONFIG.conditions[k] ? CONFIG.conditions[k].name : k).toLowerCase()).join(', ')} lifted.`);
    }
    return lines;
  }

  // Summon (verb): an elemental of the noun, a ghost (Death), or a kind of outsider called by name. It is simply in
  // the world for its rounds: unbound, it is frenzied (strikes the nearest body, friend or foe) until a Bind takes
  // hold of it; Summon + Bind brings it bound to the caster. It stands with the caster's side either way, so the
  // caster's friends don't go for it unless it goes for them.
  function summon(enc, chars, caster, s, at) {
    if (!G.Enemies || !G.Enemies.makeConjured) return null;
    const kind = s.monster === 'elemental' ? 'elemental' : { monster: s.monster };
    const c = G.Enemies.makeConjured(kind, s.noun, s.magnitude);
    if (!c) return null;
    c.traits = Object.assign({}, c.traits, undead(c) ? {} : { outsider: true });
    join(enc, chars, caster, c, at, { by: caster.id, rounds: s.rounds || 4, summoned: true, bound: !!s.bound });
    if (!s.bound) frenzy(c, s.rounds || 4);
    return c;
  }

  // An unbound summons: the frenzy lasts as long as it does (a Bind ends it).
  function frenzy(c, rounds) {
    G.Conditions.add(c, 'enraged', { rounds: rounds + 1, src: null });
    c.conjured.bound = false;
  }

  // Raise (verb): the body nearest the aim (within a square) gets up on the caster's side, as the spell says
  // (CONFIG.magic.raise: a skeleton; with the feats, a zombie or a mummy). It lasts the fight and falls when its
  // caster does.
  function raise(enc, chars, caster, spell, at) {
    const body = enc.ids.map((id) => chars[id]).filter((d) => d && d.status.dead && !d.vanished && !d.raised && enc.pos[d.id] && G.Combat.dist(enc.pos[d.id], at) <= 1)
      .sort((x, y) => G.Combat.dist(enc.pos[x.id], at) - G.Combat.dist(enc.pos[y.id], at))[0];
    if (!body || !G.Enemies || !G.Enemies.makeRaised) return null;
    const c = G.Enemies.makeRaised(spell.raise, body);
    if (!c) return null;
    body.raised = true;
    body.vanished = true; // the body is up and walking: it no longer lies there
    return join(enc, chars, caster, c, enc.pos[body.id], { by: caster.id, rounds: null, bound: true });
  }

  // Give + Death on the undead: as Life on the living (stamina back by magnitude; the tireless mend CON instead).
  function mendUndead(t, s) {
    const con = Math.min(Math.max(1, Math.ceil(s.magnitude / 2)) + s.condMag - 1, t.damage.CON || 0);
    if (con) C().healAttr(t, 'CON', con);
    return `${t.name} drinks the death in: ${con ? `+${con} CON` : 'nothing to mend'}.`;
  }

  // Conditions a spell can lay (any noun's or verb's effect), and wards: what Take + Magic lifts.
  function dispellable() {
    const out = new Set(['warded', 'controlled', 'enthralled', 'concentrating']);
    for (const k of Object.keys(W())) {
      const x = W()[k];
      if (x.alone && x.alone.cond) out.add(x.alone.cond);
      for (const v in x.does || {}) for (const e of [].concat(x.does[v])) if (e.cond) out.add(e.cond);
      if (x.onHit && x.onHit.cond) out.add(x.onHit.cond);
    }
    return out;
  }

  // Lift every spell on a creature; one held by a charm comes back to themselves. Returns the names lifted.
  function dispelOn(t) {
    const set = dispellable();
    const gone = G.Conditions.list(t).filter((x) => set.has(x.key));
    for (const x of gone) G.Conditions.remove(t, x.key);
    if (t.charmed && !G.Conditions.list(t).some((x) => (CONFIG.conditions[x.key] || {}).control)) {
      t.side = t.charmed.side; t.control = t.charmed.control; delete t.charmed;
    }
    // A summons raging unbound stays unbound: its frenzy is what it is, not a spell on it.
    if (t.conjured && t.conjured.summoned && !t.conjured.bound && gone.some((x) => x.key === 'enraged')) G.Conditions.add(t, 'enraged', { rounds: t.conjured.rounds + 1 });
    return gone.map((x) => CONFIG.conditions[x.key].name.toLowerCase());
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
    // A name: only one whose name the caster knows.
    if (s.named && (!d.target || !knowsName(a, chars[d.target]))) return log(`${a.name}'s ${o.label} fizzles — the name means nothing.`, 'fizzle');
    if (distance > o.maxRange || distance < (o.target === 'ally' || o.target === 'any' ? 0 : o.minRange)) return log(`${a.name}'s ${o.label} fizzles — out of range.`, 'fizzle');
    // Blink needs no line (it goes through); everything else does.
    if (distance >= 2 && s.shape !== 'blink' && G.Terrain.lineCheck(enc, from, at, 'missile').blocked) return log(`${a.name}'s ${o.label} fizzles — no clear line.`, 'fizzle');
    // Spells for one kind (Bind + Death: the undead; Take + Outsider: outsiders) have no hold on others.
    const t0 = d.target ? chars[d.target] : null;
    if (t0 && s.only && !fits(t0, s.only)) return log(`${a.name}'s ${o.label} has no hold on ${t0.name}.`, 'fizzle');
    if (!(await G.Combat.castSpell(enc, a, o, roller))) return;
    const side = a.side;
    switch (s.shape) {
      case 'area': {
        if (s.delayed) {
          // Delayed: the area is marked for everyone to see and breaks at the end of the round (endRound).
          for (let y = at.y - s.radius; y <= at.y + s.radius; y++) for (let x = at.x - s.radius; x <= at.x + s.radius; x++) G.Terrain.add(enc, x, y, 'gathering', { rounds: 1, owner: a.id, side, noun: s.noun });
          (enc.delayed || (enc.delayed = [])).push({ caster: a.id, at: { x: at.x, y: at.y }, spell: s, label: o.label });
          return log(`${a.name} casts ${o.label}: the air over (${at.x + 1}, ${at.y + 1}) begins to gather; it breaks at the end of the round.`, 'hit');
        }
        log(`${a.name} casts ${o.label} at (${at.x + 1}, ${at.y + 1}).`, 'hit');
        // Round the caster's own square (aimed at themself): the caster is spared.
        const centred = at.x === from.x && at.y === from.y;
        for (const id of within(enc, chars, at.x, at.y, s.radius)) {
          if (centred && id === a.id) continue;
          const t = chars[id];
          const k = await contest(roller, a, t, 'avoid', o.label);
          await elementBlow(enc, chars, a, t, s.noun, s.magnitude, roller, o.label, { half: k.resisted, from: at, condMag: s.condMag });
        }
        return;
      }
      case 'ground': {
        let n = 0;
        const grounds = [s.ground];
        for (let y = at.y - s.radius; y <= at.y + s.radius; y++) for (let x = at.x - s.radius; x <= at.x + s.radius; x++) {
          if (!G.Terrain.passable(enc, x, y)) continue;
          let any = false;
          for (const g of grounds) if (G.Terrain.add(enc, x, y, g, { rounds: s.rounds, mag: s.magnitude - 1, noun: s.noun, owner: a.id, side })) any = true;
          if (any) n++;
        }
        return log(`${a.name} casts ${o.label}: ${grounds.map((g) => CONFIG.terrain[g].name.toLowerCase()).join(' and ')} cover${grounds.length > 1 ? '' : 's'} ${n} squares.`, 'hit');
      }
      case 'wall': {
        const solid = !!CONFIG.terrain[s.wall].wall;
        const squares = lineAcross(from, at.x, at.y, s.length).filter((q) => G.Terrain.inGrid(enc, q.x, q.y) && !(solid && occupied(enc, chars, q.x, q.y)));
        for (const q of squares) G.Terrain.add(enc, q.x, q.y, s.wall, { rounds: s.rounds, mag: Math.max(0, s.magnitude - 1), noun: s.noun, owner: a.id, side });
        return log(`${a.name} casts ${o.label}: a ${CONFIG.terrain[s.wall].name.toLowerCase()} rises across ${squares.length} square${squares.length === 1 ? '' : 's'}.`, 'hit');
      }
      case 'terrain': {
        const squares = lineAcross(from, at.x, at.y, s.length).filter((q) => G.Terrain.passable(enc, q.x, q.y));
        for (const q of squares) {
          G.Terrain.add(enc, q.x, q.y, s.terrain, { rounds: s.rounds, noun: s.noun, owner: a.id, side });
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
        if (f) { f.radius = s.radius; f.condMag = s.condMag; f.terrain = s.terrain; f.ground = s.ground; }
        return log(`${a.name} traces a rune on the ground.`, 'pass');
      }
      case 'bane':
      case 'mind': {
        const t = chars[d.target];
        if (!t || !C().isActive(t)) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        log(`${a.name} casts ${o.label} on ${t.name}.`, 'hit');
        // Give + Death mends the undead it would wither in the living.
        if (s.undeadMend && undead(t)) return log(mendUndead(t, s), 'defend');
        // A Bind on a summons of the caster's own, raging unbound: it is bound now.
        if (s.cond === 'controlled' && t.side === a.side && t.conjured && t.conjured.summoned && !t.conjured.bound) {
          const k = await contest(roller, a, t, 'WIL', 'binding', s.contest);
          if (k.resisted) return log(`${t.name} slips the binding (${k.b} vs ${k.a}).`, 'defend');
          G.Conditions.remove(t, 'enraged');
          t.conjured.bound = true;
          return log(`${t.name} is bound to ${a.name}'s will (${k.a} vs ${k.b}).`, 'hit');
        }
        if (t.side === a.side) return log(`${a.name}'s ${o.label} finds no foe in ${t.name}.`, 'fizzle');
        await afflict(enc, a, t, s.cond, { rounds: s.rounds, mag: s.condMag, stack: s.stack, contest: s.contest }, roller);
        return;
      }
      case 'boon': {
        const t = chars[d.target];
        if (!t || t.status.dead) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        log(`${a.name} casts ${o.label} on ${t === a ? 'themself' : t.name}.`, 'defend');
        G.Conditions.add(t, s.cond, { rounds: s.rounds, mag: s.condMag, src: a.id });
        return log(`${t.name} is ${CONFIG.conditions[s.cond].name.toLowerCase()} (${s.rounds} rounds).`, 'defend');
      }
      case 'drain': {
        // Transfer: what each one hit loses of the noun (Life: CON), the caster gains (CONFIG.magic.transfer).
        const who = s.radius ? within(enc, chars, at.x, at.y, s.radius).filter((id) => id !== a.id) : d.target ? [d.target] : [];
        if (!who.length) return log(`${a.name}'s ${o.label} finds no one.`, 'fizzle');
        if (s.radius) log(`${a.name} casts ${o.label} at (${at.x + 1}, ${at.y + 1}).`, 'hit');
        let taken = 0;
        for (const id of who) {
          const t = chars[id];
          if (!t || t.status.dead) continue;
          const k = await contest(roller, a, t, 'avoid', o.label);
          const before = t.damage.CON || 0;
          await elementBlow(enc, chars, a, t, s.noun, s.magnitude, roller, o.label, { half: k.resisted, from: at, condMag: s.condMag });
          taken += Math.max(0, (t.damage.CON || 0) - before);
        }
        if (!taken) return log(`${a.name} draws nothing back.`, 'fizzle');
        const mend = Math.min(taken, a.damage.CON || 0);
        if (mend) C().healAttr(a, 'CON', mend);
        const st = (taken - mend) * CONFIG.magic.transfer.staminaPerCON;
        const was = a.stamina;
        if (st) a.stamina = Math.min(C().maxStamina(a), a.stamina + st);
        const bits = [mend ? `+${mend} CON` : null, a.stamina > was ? `+${a.stamina - was} stamina` : null].filter(Boolean);
        return log(`${a.name} draws in what was taken${bits.length ? ': ' + bits.join(', ') : ''}.`, 'defend');
      }
      case 'give': {
        // Transfer to an ally: points of the caster's own life, each a lost CON mended (else stamina), each paid in
        // the caster's stamina (CONFIG.magic.transfer). The caster keeps enough to stay on their feet.
        const t = chars[d.target];
        const per = CONFIG.magic.transfer.staminaPerCON;
        const can = Math.min(Math.ceil(s.magnitude / 2), Math.floor((a.stamina - 1) / per));
        if (!t || t === a || !enc.pos[t.id] || (t.status.dead && !revivable(enc, t))) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        if (!can) return log(`${a.name} has no life left to give.`, 'fizzle');
        a.stamina -= can * per;
        C().updateCondition(a);
        log(`${a.name} gives ${t.name} of their own life (−${can * per} stamina).`, 'defend');
        if (t.status.dead) return log(revive(t), 'defend');
        return log(giveLife(t, can), 'defend');
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
      case 'revive': {
        // Raise + Life: one who died in this fight, still in the window, is called back.
        const t = chars[d.target];
        if (!t || !revivable(enc, t) || !enc.pos[t.id]) return log(`${a.name}'s ${o.label} fizzles — no one to call back.`, 'fizzle');
        log(`${a.name} casts ${o.label} on the body of ${t.name}.`, 'defend');
        return log(revive(t), 'defend');
      }
      case 'ward': {
        const t = chars[d.target];
        if (!t || t.status.dead) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        // Take + an element on an ally: what that element left on them is lifted, then it is kept off.
        if (s.noun && s.ward !== 'magic') for (const line of restore(t, Object.assign({}, s, { heals: false }), 1)) log(line, 'defend');
        const kind = s.ward;
        const pool = kind === 'magic' ? s.magnitude * 3 : null;
        G.Conditions.add(t, 'warded', { rounds: s.rounds, mag: s.condMag, kind, pool, src: a.id });
        const wname = ((W()[kind] || {}).name || kind).toLowerCase();
        const what = { magic: `a shell of force (${pool} points against spells and missiles)` }[kind] || `a ward against ${wname}`;
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
      case 'summon': {
        if (!G.Terrain.passable(enc, at.x, at.y) || occupied(enc, chars, at.x, at.y)) return log(`${a.name}'s ${o.label} fizzles — no room.`, 'fizzle');
        const c = summon(enc, chars, a, s, at);
        if (!c) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        const p = enc.pos[c.id];
        return log(`${a.name} casts ${o.label}: ${c.name} appears at (${p.x + 1}, ${p.y + 1}) for ${c.conjured.rounds} rounds${s.bound ? ', bound' : ', unbound and raging'}.`, 'hit');
      }
      case 'dispel': {
        // Take + Magic: every spell on a creature (curses, charms, boons, wards), or every spell laid on the squares
        // round the one aimed at (walls, hazards, runes).
        if (d.target) {
          const t = chars[d.target];
          if (!t || t.status.dead) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
          const gone = dispelOn(t);
          return log(`${a.name} casts ${o.label} on ${t.name}: ${gone.length ? gone.join(', ') + ' lifted' : 'nothing there to lift'}.`, gone.length ? 'hit' : 'fizzle');
        }
        let n = 0;
        for (let y = at.y - s.radius; y <= at.y + s.radius; y++) for (let x = at.x - s.radius; x <= at.x + s.radius; x++) {
          const before = G.Terrain.at(enc, x, y).length;
          G.Terrain.remove(enc, x, y, (f) => !!f.owner && !(CONFIG.terrain[f.kind] || {}).permanent);
          n += before - G.Terrain.at(enc, x, y).length;
        }
        return log(`${a.name} casts ${o.label}: ${n ? `${n} spell${n > 1 ? 's' : ''} on the ground unmade` : 'nothing laid there'}.`, n ? 'hit' : 'fizzle');
      }
      case 'banish': {
        const t = chars[d.target];
        if (!t || !C().isActive(t)) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        const k = await contest(roller, a, t, 'WIL', 'banishing', s.contest);
        if (k.resisted) return log(`${t.name} holds to the world (${k.b} vs ${k.a}).`, 'defend');
        t.status.dead = true;
        t.vanished = true;
        return log(`${a.name} casts ${o.label}: ${t.name} is sent out of the world (${k.a} vs ${k.b}).`, 'hit');
      }
      case 'channel': {
        // Give + Magic: the caster's stamina becomes spell points, theirs or an ally's (CONFIG.magic.channel).
        const t = chars[d.target];
        if (!t || !C().isActive(t)) return log(`${a.name}'s ${o.label} fizzles.`, 'fizzle');
        const per = (CONFIG.magic.channel || {}).staminaPerPoint || 3;
        const pts = Math.min(s.magnitude, t.spSpent || 0, Math.floor((a.stamina - 1) / per));
        if (pts <= 0) return log(`${a.name}'s ${o.label} finds nothing to fill.`, 'fizzle');
        a.stamina -= pts * per;
        t.spSpent -= pts;
        C().updateCondition(a);
        return log(`${a.name} casts ${o.label}: −${pts * per} stamina, ${t === a ? 'their' : `${t.name}'s`} pool +${pts}.`, 'defend');
      }
      case 'see': {
        // See: hidden runes and traps round the square come to light for everyone, and the unseen are picked out;
        // See + Magic also names the spells on everyone there, See + Outsider the outsiders.
        let found = 0;
        for (let y = at.y - s.radius; y <= at.y + s.radius; y++) for (let x = at.x - s.radius; x <= at.x + s.radius; x++) {
          for (const f of G.Terrain.at(enc, x, y)) if (f.hidden) { f.hidden = false; found++; }
        }
        const near = within(enc, chars, at.x, at.y, s.radius).map((id) => chars[id]).filter((t) => C().isActive(t));
        for (const t of near) if (G.Conditions.has(t, 'unseen') && t.side !== side) { G.Conditions.remove(t, 'unseen'); found++; }
        const bits = [found ? `${found} hidden thing${found > 1 ? 's' : ''} brought to light` : 'nothing hidden'];
        if (s.what === 'magic') {
          const on = near.map((t) => [t, G.Conditions.list(t).filter((x) => dispellable().has(x.key))]).filter(([, l]) => l.length);
          bits.push(on.length ? on.map(([t, l]) => `${t.name}: ${l.map((x) => CONFIG.conditions[x.key].name.toLowerCase()).join(', ')}`).join('; ') : 'no spells on anyone');
        }
        if (s.what === 'outsider') {
          const os = near.filter(outsider);
          bits.push(os.length ? `outsiders: ${os.map((t) => t.name).join(', ')}` : 'no outsiders');
        }
        return log(`${a.name} casts ${o.label}: ${bits.join('; ')}.`, 'pass');
      }
      case 'raise': {
        const c = raise(enc, chars, a, s, at);
        if (!c) return log(`${a.name}'s ${o.label} fizzles — no body to raise there.`, 'fizzle');
        const p = enc.pos[c.id];
        return log(`${a.name} casts ${o.label}: ${c.name} rises at (${p.x + 1}, ${p.y + 1}).`, 'hit');
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
        await elementBlow(enc, chars, a, t, s.noun, s.magnitude, roller, d.label, { from: d.at, condMag: s.condMag });
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

  G.Magic = { effectsOf, spellBonus, fits, undead, outsider, summon, dispelOn, dispellable, namedOutsiders, revivable, revive, callsBack, giveLife, breakDelayed, raise, join, corrode, chainOn, powerOptions, castableOptions, usePower, rechargeAll, chargesLeft, mend, restore, curesOf, knowsName, wardAgainst, freshSP, maxSP, restSP, availableSP, overchannelSP, spellOptions, knows, combines, backlash, makeOption, contest, afflict, onHit, elementBlow, afterHit, springRune, resolveCast, lineAcross, endRound, push };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
