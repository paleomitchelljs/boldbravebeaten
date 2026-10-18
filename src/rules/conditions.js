/*
 * Conditions (PROVISIONAL): timed effects on a character — slowed, rooted, burning, hasted…
 *
 * c.status.conds is a list of { key, rounds, mag, src }. What each key does lives in
 * CONFIG.conditions:
 *   ap        AP pool change per magnitude (base AP; × apScale)
 *   attrs     combat attribute changes per magnitude, e.g. { DEX: -1, SPD: -1 }
 *   mit       mitigation per magnitude, e.g. { B: 2 }, also for the unarmored
 *   dot       loss at the end of each round per magnitude, e.g. { CON: 1 } or { stamina: 2 }
 *   regen     stamina regeneration per magnitude
 *   noMove    can't move (rooted); `breakAttr` is what breaks free (the Break free action)
 *   freedom   ignores difficult ground, slick ice and roots
 *   kindled   the bearer's melee blows set the target burning
 *   halveFire fire and heat do half damage
 * A condition lasts `rounds` round ends. Applying one that is already there keeps the longer
 * duration and the larger magnitude.
 */
(function (G) {
  'use strict';
  const CONFIG = G.CONFIG;

  function defs() {
    return CONFIG.conditions || {};
  }

  function list(c) {
    return (c.status && c.status.conds) || [];
  }

  function get(c, key) {
    return list(c).find((x) => x.key === key) || null;
  }

  function has(c, key) {
    return !!get(c, key);
  }

  function add(c, key, opts) {
    if (!defs()[key]) return null;
    opts = opts || {};
    const conds = c.status.conds || (c.status.conds = []);
    const cur = conds.find((x) => x.key === key);
    const rounds = opts.rounds || 1, mag = opts.mag || 1;
    // Extra details some conditions carry: vs (whom it concerns), kind (a ward's kind), pool.
    const extra = {};
    for (const k of ['vs', 'kind', 'pool']) if (opts[k] != null) extra[k] = opts[k];
    if (cur) {
      cur.rounds = Math.max(cur.rounds, rounds);
      cur.mag = Math.max(cur.mag, mag);
      Object.assign(cur, extra);
      return cur;
    }
    const n = Object.assign({ key, rounds, mag, src: opts.src || null }, extra);
    conds.push(n);
    return n;
  }

  function remove(c, key) {
    if (c.status && c.status.conds) c.status.conds = c.status.conds.filter((x) => x.key !== key);
  }

  function sum(c, field, sub) {
    let t = 0;
    for (const x of list(c)) {
      const d = defs()[x.key];
      if (!d || d[field] == null) continue;
      t += (sub ? d[field][sub] || 0 : d[field]) * x.mag;
    }
    return t;
  }

  const apMod = (c) => sum(c, 'ap');
  const attrMod = (c, a) => sum(c, 'attrs', a);
  const mitigation = (c, k) => sum(c, 'mit', k);
  const regenMod = (c) => sum(c, 'regen');
  const flag = (c, f) => list(c).some((x) => (defs()[x.key] || {})[f]);
  const canMove = (c) => !flag(c, 'noMove');

  // End of round: damage over time, then every condition ticks down a round.
  function endRound(c) {
    const lines = [];
    const conds = list(c);
    if (!conds.length) return lines;
    for (const x of conds) {
      const d = defs()[x.key];
      if (!d || !d.dot) continue;
      for (const [what, per] of Object.entries(d.dot)) {
        const amt = per * x.mag;
        if (!amt) continue;
        if (what === 'stamina') c.stamina = Math.max(0, c.stamina - amt);
        else G.Character.damageAttr(c, what, amt);
        lines.push(`${d.name} costs ${c.name} ${amt} ${what === 'stamina' ? 'stamina' : what}.`);
      }
    }
    for (const x of conds) x.rounds -= 1;
    const gone = conds.filter((x) => x.rounds <= 0).map((x) => (defs()[x.key] || {}).name || x.key);
    c.status.conds = conds.filter((x) => x.rounds > 0);
    if (gone.length) lines.push(`${c.name}: ${gone.join(', ')} wears off.`);
    return lines;
  }

  // Short labels for the roster.
  function labels(c) {
    return list(c).map((x) => `${(defs()[x.key] || {}).name || x.key}${x.kind ? ': ' + x.kind : ''}${x.pool != null ? ' ' + x.pool : x.mag > 1 ? ' ' + x.mag : ''} (${x.rounds})`);
  }

  G.Conditions = { list, get, has, add, remove, apMod, attrMod, mitigation, regenMod, flag, canMove, endRound, labels };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
