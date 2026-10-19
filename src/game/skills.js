/*
 * Skill checks away from the fight: d10 + ⌊mean of attrs / 2⌋ + feat ranks × weight − armor penalty
 * against a target number. Skills are defined in data/skills.yaml; target numbers in rules.yaml.
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const R = G.Rand;

  const defs = () => (G.Content.world.skills || {});
  const tns = () => G.CONFIG.game.tn;

  function mod(c, id) {
    const s = defs()[id];
    if (!s) return 0;
    let m = Math.floor(s.attrs.reduce((t, a) => t + C.attr(c, a), 0) / s.attrs.length / 2);
    for (const [feat, w] of Object.entries(s.feats || {})) m += C.rank(c, feat) * w;
    if (s.armorPenalty) {
      const a = C.armorInfo(c);
      m -= Math.floor(((a.spd + a.dex) / 2) * s.armorPenalty);
    }
    return m;
  }

  const tn = (t) => (typeof t === 'number' ? t : tns()[t] || 8);

  // One character's check. bonus adds to the total (circumstance); returns the full breakdown.
  function check(c, id, target, bonus) {
    const need = tn(target);
    const roll = R.d(10);
    const m = mod(c, id);
    const total = roll + m + (bonus || 0);
    return { who: c.id, name: c.name, skill: id, roll, mod: m, bonus: bonus || 0, total, tn: need, ok: total >= need, margin: total - need, fumble: roll === 1, crit: roll === 10 };
  }

  const able = (chars) => chars.filter((c) => C.isActive(c));

  // The best member rolls (or a named one).
  function best(chars, id) {
    return able(chars).slice().sort((a, b) => mod(b, id) - mod(a, id))[0] || chars[0];
  }
  function bestCheck(chars, id, target, bonus) {
    return check(best(chars, id), id, target, bonus);
  }

  // How well the party as a whole keeps quiet: its best scout helps, but the clanker hurts most.
  function groupStealth(chars) {
    const mods = able(chars).map((c) => mod(c, 'stealth')).sort((a, b) => a - b);
    if (!mods.length) return 0;
    return Math.round((mods[mods.length - 1] + 2 * mods[0]) / 3);
  }

  function groupCheck(chars, id, target, bonus) {
    const need = tn(target);
    const roll = R.d(10);
    const m = id === 'stealth' ? groupStealth(chars) : mod(best(chars, id), id);
    const total = roll + m + (bonus || 0);
    return { who: null, name: 'The party', skill: id, roll, mod: m, bonus: bonus || 0, total, tn: need, ok: total >= need, margin: total - need, fumble: roll === 1, crit: roll === 10 };
  }

  G.Skills = { mod, check, best, bestCheck, groupCheck, groupStealth, tn, defs };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
