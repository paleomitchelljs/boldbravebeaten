/*
 * Conditions in content files (a topic's `requires`, a map entity's `reveal`, a quest's `done_when`).
 * A condition is a map; every key must hold. Keys:
 *   flag: id | [ids]          noflag: id         item: id (in the pack)        gold: n
 *   quest: id | id:stage      standing: {faction, min, max}                   level: n (party best)
 *   renown: n   notoriety: n  any: [conditions]  not: condition               day: n (or later)
 */
(function (G) {
  'use strict';

  function test(world, cond) {
    if (!cond) return true;
    const W = G.World;
    for (const k of Object.keys(cond)) {
      const v = cond[k];
      let ok = true;
      switch (k) {
        case 'flag': ok = (Array.isArray(v) ? v : [v]).every((f) => W.flag(world, f)); break;
        case 'noflag': ok = !(Array.isArray(v) ? v : [v]).some((f) => W.flag(world, f)); break;
        case 'item': ok = W.goodCount(world, v) > 0; break;
        case 'gold': ok = world.gold >= v; break;
        case 'quest': {
          const [id, stage] = String(v).split(':');
          const q = world.quests[id];
          ok = !!q && (stage == null || (q.stage || 0) >= Number(stage) || q.done);
          break;
        }
        case 'standing': ok = G.Factions.standing(world, v.faction) >= (v.min == null ? -Infinity : v.min) && G.Factions.standing(world, v.faction) <= (v.max == null ? Infinity : v.max); break;
        case 'level': ok = Math.max(0, ...W.party(world).map((c) => c.level)) >= v; break;
        case 'renown': ok = world.rep.renown >= v; break;
        case 'notoriety': ok = world.rep.notoriety >= v; break;
        case 'day': ok = world.day >= v; break;
        case 'any': ok = v.some((c) => test(world, c)); break;
        case 'not': ok = !test(world, v); break;
        default: ok = true;
      }
      if (!ok) return false;
    }
    return true;
  }

  G.Cond = { test };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
