/*
 * Parley: conversation as a small contest, structured like combat (Philosophy: Social).
 *
 * The NPC (data/npcs.yaml) has a disposition (how they feel about you, −5..+5), a willingness (how
 * much they will do, 0..10; each topic has a `need`), a courage, a patience and a temperament that
 * says which side of your reputation they respond to. You make moves; each costs patience and
 * changes disposition or willingness for this talk. Then you ask. Asking costs nothing: it only
 * works once their willingness reaches the topic's need.
 *
 *   charm        Charm vs their WIS      +disposition (Silver Tongue adds; Flattery halves the patience cost)
 *   appeal tag   Appeal vs their WIL     +willingness on topics with that tag (easier if it is one of their interests)
 *   intimidate   Intimidation vs courage +willingness, −disposition; notoriety grows; a bad failure ends it
 *   bluff        Deception vs their WIS  +willingness (more on topics you can lie about); caught lying costs
 *   bribe        gold                    +willingness for the venal; an insult to anyone else
 *   read         free                    shows their mood; Read the Room and Read Intent show numbers
 *
 * Willingness for a topic = their base + ⌊disposition/2⌋ + moves this talk + reputation (fearful:
 * notoriety; starstruck: renown) + appeals matching the topic's tag.
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const R = G.Rand;
  const W = G.World;
  const S = G.Skills;

  const npcs = () => G.Content.world.npcs || {};
  const cfg = () => G.CONFIG.game.parley;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function persistent(world, id) {
    return world.npcs[id] || (world.npcs[id] = { met: false, delta: 0, done: {}, day: 0, spent: 0, refuseUntil: 0, exposed: 0 });
  }

  // Which side of your reputation counts: with Reputation Control you choose; without, both do.
  function repSides(world, session) {
    const r = world.rep;
    const controlled = Math.max(0, ...W.active(world).map((c) => C.rank(c, 'reputation_control'))) > 0;
    if (controlled && session && session.side === 'renown') return { renown: r.renown, notoriety: 0 };
    if (controlled && session && session.side === 'notoriety') return { renown: 0, notoriety: r.notoriety };
    return { renown: r.renown, notoriety: r.notoriety };
  }

  const best = (world, skill) => S.best(W.active(world), skill);
  const rankAny = (world, feat) => Math.max(0, ...W.active(world).map((c) => C.rank(c, feat)));
  const has = (npc, t) => (npc.temperament || []).includes(t);

  // Starting disposition and the reasons for it.
  function baseDisposition(world, npc, ps, session) {
    const rep = repSides(world, session);
    const why = [];
    let d = npc.disposition || 0;
    if (ps.delta) { d += ps.delta; why.push(['history', ps.delta]); }
    if (npc.faction) {
      let st = Math.trunc(G.Factions.standing(world, npc.faction) / cfg().standingPerDisposition);
      if (has(npc, 'loyal')) st *= 2;
      st = clamp(st, -4, 4);
      if (st) { d += st; why.push([G.Factions.defs()[npc.faction].name, st]); }
    }
    if (has(npc, 'moral')) { const v = Math.trunc(rep.renown / 20) - Math.trunc(rep.notoriety / 20); if (v) { d += v; why.push(['deeds', v]); } }
    if (has(npc, 'starstruck')) { const v = Math.trunc(rep.renown / 15); if (v) { d += v; why.push(['renown', v]); } }
    if (has(npc, 'fearful')) { const v = -Math.trunc(rep.notoriety / 30); if (v) { d += v; why.push(['notoriety', v]); } }
    if (has(npc, 'provincial')) {
      const known = rep.renown >= 10 || (npc.faction && G.Factions.standing(world, npc.faction) >= 10);
      if (!known) { d -= 2; why.push(['stranger', -2]); }
    }
    if (ps.exposed) { d -= ps.exposed; why.push(['caught lying', -ps.exposed]); }
    return { value: clamp(d, -cfg().dispositionRange, cfg().dispositionRange), why };
  }

  function start(world, npcId, ctx) {
    const npc = npcs()[npcId];
    if (!npc) throw new Error('Unknown NPC ' + npcId);
    const ps = persistent(world, npcId);
    if (ps.day !== world.day) { ps.day = world.day; ps.spent = 0; }
    const session = {
      npc: npcId, ctx: ctx || null, appeals: {}, willMod: 0, dispMod: 0, bribes: 0, side: null,
      patienceMax: npc.patience, patience: Math.max(0, npc.patience - ps.spent), last: false,
      read: { mood: false, disp: false, intent: false }, lines: [], started: world.day, ended: false, outcome: null, hostile: false,
    };
    if (ps.refuseUntil > world.day) {
      session.ended = true; session.outcome = 'refused';
      session.lines.push({ who: npc.name, text: 'I have nothing more to say to you today.', cls: 'npc' });
    } else if (G.Factions.kos(world, npc.faction)) {
      session.ended = true; session.outcome = 'refused';
      session.lines.push({ who: npc.name, text: 'You are not welcome here.', cls: 'npc' });
    } else {
      const base = baseDisposition(world, npc, ps, session);
      session.baseDisp = base.value; session.why = base.why;
      if (!ps.met) { ps.met = true; session.first = true; }
      session.lines.push({ who: npc.name, text: npc.greeting || '...', cls: 'npc' });
    }
    world.parley = session;
    return session;
  }

  const disposition = (world, session) => clamp(session.baseDisp + session.dispMod, -cfg().dispositionRange, cfg().dispositionRange);

  // Willingness for a topic (or in general with no topic).
  function willingness(world, session, topic) {
    const npc = npcs()[session.npc];
    const rep = repSides(world, session);
    let w = (npc.willingness || 0) + Math.trunc(disposition(world, session) / 2) + session.willMod;
    if (has(npc, 'fearful')) w += Math.trunc(rep.notoriety / 25);
    if (has(npc, 'starstruck')) w += Math.trunc(rep.renown / 25);
    if (topic && topic.tag) w += session.appeals[topic.tag] || 0;
    if (topic && topic.lie && session.bluffed) w += 2;
    return clamp(w, 0, cfg().willingnessMax + 3);
  }

  const topicState = (world, session, t) => {
    const ps = persistent(world, session.npc);
    if (t.once && ps.done[t.id]) return 'done';
    if (t.hide && G.Cond.test(world, t.hide)) return 'hidden';
    if (t.requires && !G.Cond.test(world, t.requires)) return 'hidden';
    return willingness(world, session, t) >= (t.need || 0) ? 'open' : 'locked';
  };

  // What the UI shows.
  function view(world) {
    const s = world.parley;
    if (!s) return null;
    const npc = npcs()[s.npc];
    const ps = persistent(world, s.npc);
    const reads = rankAny(world, 'read_the_room') > 0;
    const intent = rankAny(world, 'read_intent') > 0;
    const topics = (npc.topics || []).map((t) => ({ t, st: topicState(world, s, t) })).filter((x) => x.st !== 'hidden');
    const interestHint = rankAny(world, 'appeal_to_interest') > 0 || rankAny(world, 'read_intent') > 0 || s.read.intent;
    return {
      session: s, npc, ps,
      disposition: disposition(world, s),
      willingness: willingness(world, s),
      mood: moodWord(disposition(world, s)),
      showDisp: reads || s.read.disp, showIntent: intent || s.read.intent,
      topics: topics.map(({ t, st }) => ({ id: t.id, label: t.label, need: t.need || 0, status: st, eff: willingness(world, s, t), tag: t.tag, kind: t.kind, lie: !!t.lie })),
      interests: interestHint ? npc.interests : null,
      allTags: allTags(),
      patience: s.patience, patienceMax: s.patienceMax,
      hasControl: rankAny(world, 'reputation_control') > 0,
      costs: moveCosts(world),
    };
  }

  function allTags() {
    const t = new Set();
    for (const n of Object.values(npcs())) for (const i of n.interests || []) t.add(i);
    return Array.from(t).sort();
  }

  function moodWord(d) {
    return d <= -4 ? 'hostile' : d <= -2 ? 'cold' : d < 0 ? 'guarded' : d === 0 ? 'neutral' : d < 3 ? 'warm' : d < 5 ? 'friendly' : 'devoted';
  }

  function moveCosts(world) {
    return { charm: rankAny(world, 'flattery') > 0 ? 0.5 : 1, appeal: 1, intimidate: 1, bluff: 1, bribe: 0, read: 0 };
  }

  // ---- Moves -------------------------------------------------------------------------
  function say(s, who, text, cls) { s.lines.push({ who, text, cls: cls || '' }); }

  function spend(world, s, n) {
    const ps = persistent(world, s.npc);
    ps.spent += n;
    s.patience = Math.max(0, s.patience - n);
    if (s.patience <= 0) {
      s.last = true;
      say(s, null, `${npcs()[s.npc].name} is running out of patience. Ask what you came to ask.`, 'sys');
    }
  }

  const npcAttr = (npc, a) => (npc.attrs && npc.attrs[a]) || 5;

  // args: { who: charId (optional), tag, steps }
  function move(world, kind, args) {
    const s = world.parley;
    args = args || {};
    if (!s || s.ended) return { ok: false, reason: 'No conversation' };
    const npc = npcs()[s.npc];
    const party = W.active(world);
    const speaker = (skill) => (args.who && world.chars[args.who]) || S.best(party, skill);
    if (s.last && kind !== 'read' && kind !== 'bribe') return { ok: false, reason: 'They will hear no more of it. Ask, or leave.' };
    const costs = moveCosts(world);
    const result = { ok: true, check: null };
    const ps = persistent(world, s.npc);

    switch (kind) {
      case 'charm': {
        const who = speaker('charm');
        const flat = rankAny(world, 'flattery') > 0;
        const tn = 5 + Math.floor(npcAttr(npc, 'WIS') / 2) + (flat ? Math.max(0, npcAttr(npc, 'WIS') - 6) : 0) - Math.max(0, disposition(world, s)) ;
        const r = S.check(who, 'charm', Math.max(3, tn));
        result.check = r;
        spend(world, s, costs.charm);
        if (r.ok) {
          const gain = 1 + rankAny(world, 'silver_tongue') + (r.margin >= 5 ? 1 : 0);
          s.dispMod += gain;
          say(s, who.name, flat ? 'Warm words, well aimed.' : 'A kind word.', 'pc');
          say(s, npc.name, reply(npc, 'warm'), 'npc');
        } else if (r.margin <= -5) {
          s.dispMod -= 1;
          say(s, who.name, 'It lands badly.', 'pc');
          say(s, npc.name, reply(npc, 'cold'), 'npc');
        } else {
          say(s, who.name, 'A pleasantry, politely received.', 'pc');
        }
        break;
      }
      case 'appeal': {
        const who = speaker('appeal');
        const tag = args.tag;
        if (!tag) return { ok: false, reason: 'Appeal to what?' };
        const known = (npc.interests || []).includes(tag);
        const tn = 6 + Math.floor(npcAttr(npc, 'WIL') / 2) - (known ? 3 : 0);
        const r = S.check(who, 'appeal', tn);
        result.check = r;
        spend(world, s, costs.appeal);
        if (r.ok) {
          const gain = (known ? 2 : 1) + (r.margin >= 5 ? 1 : 0);
          s.appeals[tag] = (s.appeals[tag] || 0) + gain;
          say(s, who.name, `You put it in terms of ${tag}.`, 'pc');
          say(s, npc.name, known ? reply(npc, 'moved') : reply(npc, 'maybe'), 'npc');
        } else {
          say(s, who.name, `You put it in terms of ${tag}.`, 'pc');
          say(s, npc.name, known ? reply(npc, 'unmoved') : reply(npc, 'blank'), 'npc');
          if (!known) s.dispMod -= 0;
        }
        break;
      }
      case 'intimidate': {
        const who = speaker('intimidation');
        const presence = presenceOf(who);
        const tn = 5 + (npc.courage || 5);
        const r = S.check(who, 'intimidation', tn, presence + Math.trunc(world.rep.notoriety / 20));
        result.check = r;
        spend(world, s, costs.intimidate);
        say(s, who.name, 'You let them see exactly how this could go.', 'pc');
        if (r.ok) {
          s.willMod += r.margin >= 5 ? 3 : 2;
          s.dispMod -= 1;
          G.Factions.addRep(world, 'notoriety', 1);
          say(s, npc.name, reply(npc, 'afraid'), 'npc');
        } else {
          s.dispMod -= 2;
          say(s, npc.name, reply(npc, 'defiant'), 'npc');
          if (r.margin <= -5) {
            s.hostile = true;
            if (npc.faction) result.lines = G.Factions.change(world, npc.faction, -3, 'threatened one of theirs');
            G.Factions.addRep(world, 'notoriety', 1);
            ps.refuseUntil = world.day + 1;
            end(world, 'insulted');
          }
        }
        break;
      }
      case 'bluff': {
        const who = speaker('deception');
        const tn = 5 + Math.floor(npcAttr(npc, 'WIS') / 2);
        const r = S.check(who, 'deception', tn);
        result.check = r;
        spend(world, s, costs.bluff);
        if (r.ok) {
          s.bluffed = true;
          s.willMod += 1;
          say(s, who.name, 'You tell it with a straight face.', 'pc');
          say(s, npc.name, reply(npc, 'believes'), 'npc');
        } else {
          s.dispMod -= 2;
          s.patience = Math.max(0, s.patience - 1);
          persistent(world, s.npc).spent += 1;
          say(s, who.name, 'The story wobbles.', 'pc');
          say(s, npc.name, reply(npc, 'catches'), 'npc');
          if (r.margin <= -5) {
            ps.exposed = Math.min(3, (ps.exposed || 0) + 1);
            if (npc.faction) result.lines = G.Factions.change(world, npc.faction, -2, 'caught lying');
          }
        }
        break;
      }
      case 'bribe': {
        const steps = Math.max(1, args.steps || 1);
        const cost = steps * cfg().bribeStep;
        if (world.gold < cost) return { ok: false, reason: 'Not enough gold' };
        world.gold -= cost;
        if (has(npc, 'venal')) {
          const room = 3 - s.bribes;
          const gain = Math.max(0, Math.min(steps, room));
          s.bribes += gain;
          s.willMod += gain;
          say(s, null, `You leave ${cost} gold where it can be found.`, 'pc');
          say(s, npc.name, gain ? reply(npc, 'bought') : reply(npc, 'enough'), 'npc');
        } else {
          s.dispMod -= 2;
          say(s, null, `You offer ${cost} gold.`, 'pc');
          say(s, npc.name, reply(npc, 'insulted'), 'npc');
        }
        break;
      }
      case 'read': {
        const who = speaker('insight');
        const r = S.check(who, 'insight', 5);
        result.check = r;
        const d = disposition(world, s);
        s.read.mood = true;
        if (rankAny(world, 'read_the_room') > 0 || r.ok) s.read.disp = true;
        if (rankAny(world, 'read_intent') > 0) s.read.intent = true;
        say(s, who.name, `You watch ${npc.name}'s hands and eyes. They seem ${moodWord(d)}.`, 'pc');
        break;
      }
      case 'side': {
        if (rankAny(world, 'reputation_control') < 1) return { ok: false, reason: 'You cannot choose what they hear.' };
        s.side = args.side || null;
        const base = baseDisposition(world, npc, ps, s);
        s.baseDisp = base.value; s.why = base.why;
        say(s, null, s.side ? `You let them hear about your ${s.side === 'renown' ? 'good name' : 'reputation for violence'}.` : 'You let them make up their own mind.', 'pc');
        break;
      }
      default: return { ok: false, reason: 'Unknown move' };
    }
    return result;
  }

  // Heavy armor and a big weapon make a point without words.
  function presenceOf(c) {
    const a = c.armor ? c.armor.type : null;
    let p = a === 'plate' ? 3 : a === 'mail' ? 1 : 0;
    const w = C.wieldedWeapon(c);
    if (w && G.DATA.WEAPONS[w.type].hands >= 2) p += 1;
    return p;
  }

  const REPLIES = {
    warm: ['That helps.', 'You are more pleasant than most.', 'A smile, finally.'],
    cold: ['Don\'t flatter me.', 'I\'ve heard prettier lies.'],
    moved: ['Now that is a thing worth caring about.', 'Hm. You have a point.'],
    maybe: ['I\'m not sure why that would matter to me.', 'Perhaps.'],
    unmoved: ['I know my own interest, thank you.'],
    blank: ['What has that to do with anything?'],
    afraid: ['All right. All right. Say what you want.', 'There\'s no need for that.'],
    defiant: ['You\'ll have to do better than that.', 'Do your worst, and see what it costs you.'],
    believes: ['If that\'s so, it changes things.', 'I hadn\'t heard.'],
    catches: ['That is not what I heard.', 'Do I look like I fell off a cart yesterday?'],
    bought: ['A fine day for it.', 'Very well. My ears are your ears.'],
    enough: ['You have been generous enough.'],
    insulted: ['I don\'t take coin for that. Take it back.'],
  };
  function reply(npc, key) {
    const list = REPLIES[key] || ['...'];
    return list[Math.floor(R.rng() * list.length)];
  }

  // ---- Asking ---------------------------------------------------------------------------
  function ask(world, topicId) {
    const s = world.parley;
    if (!s || s.ended) return { ok: false, reason: 'No conversation' };
    const npc = npcs()[s.npc];
    const t = (npc.topics || []).find((x) => x.id === topicId);
    if (!t) return { ok: false, reason: 'Unknown topic' };
    const st = topicState(world, s, t);
    if (st === 'done' || st === 'hidden') return { ok: false, reason: 'Already settled' };
    if (st === 'locked') {
      say(s, npc.name, 'I\'d rather not say.', 'npc');
      return { ok: false, reason: 'locked' };
    }
    const lines = [];
    say(s, null, t.label, 'pc');
    say(s, npc.name, t.text || '...', 'npc');
    const ps = persistent(world, s.npc);
    if (t.takes_gold) world.gold = Math.max(0, world.gold - t.takes_gold);
    if (t.takes) W.removeGood(world, t.takes, 1);
    for (const f of t.sets || []) W.setFlag(world, f);
    if (t.starts) { const l = W.startQuest(world, t.starts); if (l) lines.push(l); }
    if (t.gives) lines.push(...W.giveReward(world, Object.assign({}, t.gives, t.gives.flag ? { flags: [t.gives.flag] } : {})));
    if (t.standing) for (const [f, d] of Object.entries(t.standing)) lines.push(...G.Factions.change(world, f, d, npc.name));
    if (t.renown) G.Factions.addRep(world, 'renown', t.renown);
    if (t.notoriety) G.Factions.addRep(world, 'notoriety', t.notoriety);
    if (t.once) ps.done[t.id] = true;
    for (const l of W.updateQuests(world)) lines.push(l);
    for (const l of lines) say(s, null, l, 'sys');
    return { ok: true, lines };
  }

  // ---- Ending ---------------------------------------------------------------------------
  function end(world, outcome) {
    const s = world.parley;
    if (!s || s.ended) return s;
    const ps = persistent(world, s.npc);
    // Half of what you changed about how they feel stays with them.
    ps.delta = clamp(ps.delta + Math.trunc(s.dispMod / 2), -4, 4);
    s.ended = true;
    s.outcome = outcome || s.outcome || 'left';
    return s;
  }

  function close(world) {
    const s = world.parley;
    if (s && !s.ended) end(world, 'left');
    world.parley = null;
    return s;
  }

  G.Parley = { start, view, move, ask, end, close, disposition, willingness, topicState, persistent, moveCosts, baseDisposition };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
