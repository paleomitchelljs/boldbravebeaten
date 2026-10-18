/*
 * Rituals and information magic (PROVISIONAL draft, magic phase 3).
 *
 * A ritual takes time, spell points and components (CONFIG.ritual). The caster rolls d10 +
 * ⌊INT/2⌋ + Ritualist rank (+ True Naming with a true name) against the difficulty tier the GM
 * sets. The margin gives the outcome: fail, partial, full or exceptional. Components are spent
 * either way; a bad failure backlashes.
 *
 * What a ritual can do:
 *   read    — make sense of a tome or a writing           (reveals secrets marked 'read')
 *   seek    — feel out what is hidden here; the noun says what: Force magic, Earth traps and
 *             hidden ways, Life the living, Spirit the dead and spirits, Mind lies and minds
 *             (reveals 'seek' or 'seek:<noun>' secrets)
 *   divine  — ask about a person, place or thing       (reveals 'divine')
 *   speak   — with the dead (Life), spirits (Spirit) or beasts (Vine)  (reveals 'speak')
 *   mend    — heal a patient far better than in a fight (CON, bleeding; exceptional cures poison
 *             and disease)
 *   prepare — lay a ward, boon or rune in advance; it takes hold when the next fight starts,
 *             twice as long
 *   summon / raise — call a named creature onto a binding circle / raise the dead (the GM
 *             decides what answers; the draft records it)
 *
 * Secrets (app state, written by the GM): { id, subject, reveals: ['read', 'seek:force', …],
 * tier, text, revealed }. A ritual about a subject reveals that subject's unrevealed secrets the
 * roll could reach (tier number ≤ the total), as many as the outcome allows.
 */
(function (G) {
  'use strict';
  const CONFIG = G.CONFIG;
  const C = () => G.Character;
  const R = () => CONFIG.ritual;

  // Can this character perform this kind of ritual (feats and words)?
  function knows(c, kind) {
    const K = R().kinds[kind];
    if (!K) return false;
    if (K.feat && !C().rank(c, K.feat)) return false;
    if (K.verbFeat && !C().rank(c, K.verbFeat)) return false;
    return true;
  }

  function nounsFor(c, kind) {
    const K = R().kinds[kind];
    const mine = c.nouns || [];
    if (!K.nouns) return [];
    return K.nouns === true ? mine.slice() : mine.filter((n) => K.nouns.includes(n));
  }

  // The spells this caster could prepare in advance (ward, boon and rune shapes).
  function preparable(c) {
    if (!G.Magic) return [];
    return G.Magic.spellOptions(c).filter((o) => o.kind === 'cast' && ['ward', 'boon', 'rune'].includes(o.spell.shape));
  }

  // Spell points and components a ritual needs; `opts.spell` for prepare.
  function cost(c, kind, opts) {
    const K = R().kinds[kind];
    const sp = Math.max(0, (opts && opts.spell ? opts.spell.spCost : K.sp) - C().rank(c, 'ritualist'));
    return { sp, components: Object.assign({}, K.components), minutes: Math.max(5, Math.round(K.minutes / (1 + 0.25 * C().rank(c, 'ritualist')))) };
  }

  // What's missing to perform it now (null if nothing).
  function missing(c, kind, opts) {
    if (!knows(c, kind)) return `Needs ${(R().kinds[kind].needs || 'the right feats')}`;
    const K = R().kinds[kind];
    if (K.nouns && !nounsFor(c, kind).length) return 'Needs a noun for it';
    if (K.nouns && opts && opts.noun && !nounsFor(c, kind).includes(opts.noun)) return 'Unknown noun';
    if (K.needsName && !(opts && opts.trueName)) return 'Needs the creature\'s true name';
    if (kind === 'prepare' && !(opts && opts.spell)) return 'Choose a spell to prepare';
    const k = cost(c, kind, opts);
    if (G.Magic && k.sp > G.Magic.availableSP(c)) return 'Not enough spell points';
    const inv = (c.inventory && c.inventory.components) || {};
    const short = Object.entries(k.components).filter(([id, n]) => (inv[id] || 0) < n).map(([id]) => R().components[id].name.toLowerCase());
    if (short.length) return `Short of ${short.join(', ')}`;
    return null;
  }

  function outcomeOf(margin) {
    const O = R().outcomes;
    if (margin >= O.exceptional) return 'exceptional';
    if (margin >= O.full) return 'full';
    if (margin >= O.partial) return 'partial';
    return 'fail';
  }

  const norm = (s) => String(s || '').trim().toLowerCase();

  // Secrets this ritual could reveal about the subject, easiest first.
  function candidates(secrets, kind, noun, subject) {
    const keys = [kind, noun ? `${kind}:${noun}` : null].filter(Boolean);
    const subj = norm(subject);
    return (secrets || []).filter((s) => !s.revealed && (s.reveals || []).some((r) => keys.includes(r)) &&
      (!subj || norm(s.subject).includes(subj) || subj.includes(norm(s.subject))))
      .sort((a, b) => R().tiers[a.tier] - R().tiers[b.tier]);
  }

  // Perform a ritual. spec: { kind, noun, subject, tier, patient (a character), spell (an option
  // from preparable), target (a character, for a prepared ward or boon), trueName }. secrets: the
  // GM's list (mutated: revealed ones are marked). Returns { outcome, total, tn, lines, revealed }.
  async function perform(c, spec, roller, secrets) {
    const K = R().kinds[spec.kind];
    const why = missing(c, spec.kind, spec);
    if (why) return { outcome: 'not performed', lines: [why], revealed: [] };
    const k = cost(c, spec.kind, spec);
    // Pay: spell points and components, whatever comes of it.
    c.spSpent = (c.spSpent || 0) + k.sp;
    const inv = c.inventory.components;
    for (const [id, n] of Object.entries(k.components)) inv[id] -= n;
    const tn = R().tiers[spec.tier || 'moderate'];
    const bonus = Math.floor(C().attr(c, 'INT') / 2) + C().rank(c, 'ritualist') + (spec.trueName && C().rank(c, 'true_naming') ? R().trueNameBonus : 0);
    const r = (await roller({ actorId: c.id, sides: 10, count: 1, label: `${c.name}: ${K.name}`, detail: `d10 + ${bonus} against ${tn} (${spec.tier || 'moderate'})` }))[0];
    const total = r + bonus, margin = total - tn;
    const outcome = outcomeOf(margin);
    const lines = [`${c.name} performs ${K.name}${spec.noun ? ` (${G.CONFIG.magic.words[spec.noun].name})` : ''}${spec.subject ? ` on ${spec.subject}` : ''}: ${total} against ${tn} — ${outcome}. ${k.minutes} minutes; ${k.sp} spell points; ${Object.entries(k.components).map(([id, n]) => `${n} ${R().components[id].name.toLowerCase()}`).join(', ') || 'no components'}.`];
    const revealed = [];
    if (outcome === 'fail' && margin <= R().backlashAt) {
      const lost = (tn - total) * 2;
      c.stamina = Math.max(0, c.stamina - lost);
      lines.push(`The ritual turns on ${c.name}: −${lost} stamina.${K.evil || spec.kind === 'summon' ? ' Something else may have answered (the GM decides).' : ''}`);
    }
    if (outcome !== 'fail') {
      const n = R().reveals[outcome];
      if (K.reveals) {
        const found = candidates(secrets, K.reveals, spec.noun, spec.subject).filter((s) => R().tiers[s.tier] <= total).slice(0, n);
        for (const s of found) { s.revealed = true; s.revealedBy = c.name; revealed.push(s); }
        lines.push(found.length ? `Learned ${found.length}: ${found.map((s) => s.text).join(' / ')}` : 'Nothing more to learn there (or nothing written down yet: the GM may say).');
        if (outcome === 'exceptional') lines.push('Exceptional: the GM adds something unasked.');
      }
      if (spec.kind === 'mend' && spec.patient) {
        const p = spec.patient;
        const heal = R().heals[outcome] + (outcome !== 'partial' ? C().rank(c, 'wound_tending') : 0);
        const healed = Math.min(heal, p.damage.CON || 0);
        if (healed) C().healAttr(p, 'CON', healed);
        p.bleeds = p.bleeds.filter((b) => b.poison && outcome !== 'exceptional');
        if (outcome === 'exceptional' && G.Conditions) for (const key of ['poisoned', 'diseased']) G.Conditions.remove(p, key);
        lines.push(`${p.name}: +${healed} CON, bleeding stopped${outcome === 'exceptional' ? ', poison and disease drawn out' : ''}.`);
      }
      if (spec.kind === 'prepare' && spec.spell) {
        const rounds = Math.max(1, Math.round((spec.spell.spell.rounds || 3) * (outcome === 'partial' ? 1 : 2)));
        (c.prepared || (c.prepared = [])).push({ spellKey: spec.spell.spellKey, target: spec.target ? spec.target.id : c.id, rounds, label: spec.spell.label });
        lines.push(`${spec.spell.label} is laid ready: it takes hold when the next fight begins (${rounds} rounds).`);
      }
      if (spec.kind === 'summon') lines.push(`The binding circle holds what answers to ${spec.trueName} (the GM brings it).`);
      if (spec.kind === 'raise') lines.push('The dead stir and stand (the GM sets the servant).');
    }
    return { outcome, total, tn, lines, revealed };
  }

  // At the start of a fight: prepared wards and boons take hold, prepared runes are laid on
  // the square in front of the caster. Returns log lines.
  function applyPrepared(enc, chars) {
    const lines = [];
    for (const id of enc.ids) {
      const c = chars[id];
      if (!c || !c.prepared || !c.prepared.length) continue;
      for (const p of c.prepared) {
        const o = G.Magic.spellOptions(c).find((x) => x.spellKey === p.spellKey);
        if (!o) continue;
        const s = o.spell, N = CONFIG.magic.words[s.noun];
        const t = chars[p.target] && enc.ids.includes(p.target) ? chars[p.target] : c;
        if (s.shape === 'ward') {
          G.Conditions.add(t, 'warded', { rounds: p.rounds, mag: s.condMag, kind: N.ward, pool: N.ward === 'magic' ? s.magnitude * 3 : null, src: c.id });
          lines.push(`${c.name}'s prepared ${o.label} wraps ${t.name}.`);
        } else if (s.shape === 'boon') {
          G.Conditions.add(t, N.boon, { rounds: p.rounds, mag: s.condMag, src: c.id });
          lines.push(`${c.name}'s prepared ${o.label} takes hold on ${t.name}.`);
        } else if (s.shape === 'rune') {
          const pos = enc.pos[c.id];
          const dx = c.side === 'party' ? 1 : -1;
          const f = G.Terrain.add(enc, pos.x + dx, pos.y, 'rune', { noun: s.noun, mag: s.magnitude, owner: c.id, side: c.side, hidden: true });
          if (f) { f.radius = s.radius; f.condMag = s.condMag; lines.push(`${c.name}'s prepared rune lies hidden before them.`); }
        }
      }
      c.prepared = [];
    }
    return lines;
  }

  G.Ritual = { knows, nounsFor, preparable, cost, missing, outcomeOf, candidates, perform, applyPrepared };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
