/*
 * Standing orders for reactions (docs/PLAN.md step 8). A hero's reactions (a block, parry or dodge when a blow comes, a
 * free strike at a foe passing, covering an ally) were each a pop-up. Now each hero carries orders (c.orders), set
 * before or during a fight, that answer for them; the player is asked only for a blow that matters.
 *
 *   block        'on' | 'off'                  block with a shield, if there is one and AP for it
 *   parry        'thrusts' | 'all' | 'off'     parry thrusts (a blow you can read), or every blow
 *   dodge        'unarmored' | 'always' | 'off'
 *   opportunity  'strike' | 'ask' | 'off'      the free blow at a foe closing, leaving or passing (and a riposte)
 *   ask          'matters' | 'every' | 'never' when to ask: only for a blow that could drop you (`drop`), every time, or not
 *                                              at all
 *   drop         the chance a blow, if nothing stops it, drops you, from which it matters (step 7's odds: Combat.foresee)
 *
 * Several orders may fit a blow: the one with the best odds is taken. An order never spends AP the hero hasn't, nor a
 * defence they can only make spent (out of stamina). Defaults are rules.yaml game.orders. DOM-free (Node runs it).
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const Combat = G.Combat;

  const FALLBACK = { block: 'on', parry: 'thrusts', dodge: 'unarmored', opportunity: 'strike', ask: 'matters', drop: 0.1 };
  const defaults = () => Object.assign({}, FALLBACK, (G.CONFIG.game && G.CONFIG.game.orders) || {});

  // What each order may be, in the words the screens show.
  const CHOICES = {
    block: [['on', 'Block if I have a shield and the AP'], ['off', 'Never block']],
    parry: [['thrusts', 'Parry thrusts'], ['all', 'Parry every blow'], ['off', 'Never parry']],
    dodge: [['unarmored', 'Dodge only when unarmored'], ['always', 'Always dodge'], ['off', 'Never dodge']],
    opportunity: [['strike', 'Strike a foe passing, if I can'], ['ask', 'Ask me'], ['off', 'Let them go']],
    ask: [['matters', 'Ask me when the blow could drop me'], ['every', 'Ask me every time'], ['never', 'Never ask']],
    drop: [[0.05, 'at 5%'], [0.1, 'at 10%'], [0.25, 'at 25%'], [0.5, 'at 50%']],
  };
  const LABELS = { block: 'Block', parry: 'Parry', dodge: 'Dodge', opportunity: 'Opportunity', ask: 'Ask', drop: 'Counts as a threat' };

  function of(c) {
    return Object.assign(defaults(), c && c.orders ? c.orders : {});
  }

  function set(c, key, value) {
    if (!c) return;
    const known = CHOICES[key];
    if (!known || !known.some(([v]) => String(v) === String(value))) return;
    c.orders = Object.assign({}, c.orders || {}, { [key]: key === 'drop' ? Number(value) : value });
  }

  // Back to the defaults, or to being asked every time.
  function reset(c, askEvery) {
    c.orders = askEvery ? { ask: 'every' } : null;
  }

  function foresee(enc, chars, attackerId, targetId, option) {
    const a = chars[attackerId], t = chars[targetId];
    if (!a || !t || !option) return null;
    try {
      return Combat.foresee(a, t, option, { enc, chars, distance: enc.pos[attackerId] && enc.pos[targetId] ? Combat.dist(enc.pos[attackerId], enc.pos[targetId]) : undefined });
    } catch (e) { return null; }
  }

  const unarmored = (c) => C.armorInfo(c).type === 'none';

  // Does an order let this defence be made against this blow? motion: the blow's motion if it can be read.
  function permits(c, O, o, motion) {
    if (o.type === 'block') return O.block === 'on';
    if (o.type === 'parry') return O.parry === 'all' || (O.parry === 'thrusts' && motion === 'thrust');
    if (o.type === 'offParry') return motion === 'thrust' && O.parry !== 'off';
    if (o.type === 'dodge') return O.dodge === 'always' || (O.dodge === 'unarmored' && unarmored(c));
    return false;
  }

  // → { ask: true } (put the question to the player) or { answer: <what the engine takes>, note }.
  function decide(enc, chars, req) {
    const c = chars[req.actor];
    if (!c || c.side !== 'party') return { ask: true };
    const O = of(c);
    if (O.ask === 'every') return { ask: true };
    const have = req.ap != null ? req.ap : Combat.apLeft(enc, req.actor);
    const never = O.ask === 'never';
    const first = c.name.split(' ')[0];
    if (req.kind === 'defend') {
      const readable = !req.hidden && req.decl && req.decl.type === 'strike' && req.decl.option;
      const f = readable ? foresee(enc, chars, req.attacker, req.actor, req.decl.option) : null;
      // A blow that can't be read, or isn't a strike (a hold, a spell), counts as one that matters.
      const matters = readable ? !!(f && f.hit.drop >= O.drop) : true;
      if (matters && !never) return { ask: true };
      const motion = readable ? req.decl.option.motion : null;
      let pick = null;
      for (const o of req.options) {
        if (o.spent || o.ap > have + 1e-9 || !permits(c, O, o, motion)) continue;
        const p = o.odds != null ? o.odds : 0.4;
        if (!pick || p > pick.p) pick = { p, type: o.type, name: o.name };
      }
      return { answer: pick ? pick.type : null, note: pick ? `${first}'s orders: ${(pick.name || pick.type).toLowerCase()}.` : `${first}'s orders: take it.` };
    }
    if (req.kind === 'cover') {
      const readable = !req.hidden && req.decl && req.decl.type === 'strike' && req.decl.option;
      const f = readable ? foresee(enc, chars, req.attacker, req.target, req.decl.option) : null;
      const matters = readable ? !!(f && f.hit.drop >= O.drop) : true;
      if (matters && !never) return { ask: true };
      const o = req.options[0];
      const take = matters && o && !o.spent && o.ap <= have + 1e-9;
      return { answer: take ? 'cover' : null, note: take ? `${first}'s orders: cover ${chars[req.target].name.split(' ')[0]}.` : null };
    }
    if (req.kind === 'opportunity') {
      if (O.opportunity === 'ask') return { ask: true };
      if (O.opportunity === 'off') return { answer: null, note: null };
      let pick = null;
      for (const o of req.options) {
        if (o.spent || o.ap > have + 1e-9) continue;
        const f = foresee(enc, chars, req.actor, req.target, o);
        const v = f ? f.lands : 0.3;
        if (!pick || v > pick.v) pick = { v, o };
      }
      return { answer: pick ? pick.o : null, note: pick ? `${first}'s orders: strike ${chars[req.target].name}.` : null };
    }
    return { ask: true };
  }

  // The orders in a line, for a card or a tooltip.
  function describe(c) {
    const O = of(c);
    const word = (k) => (CHOICES[k].find(([v]) => String(v) === String(O[k])) || [0, String(O[k])])[1];
    return O.ask === 'every' ? 'Asks every time' : [word('block'), word('parry'), word('dodge'), word('ask')].join('; ');
  }

  G.Orders = { CHOICES, LABELS, defaults, of, set, reset, decide, describe };
})(globalThis.BBB);
