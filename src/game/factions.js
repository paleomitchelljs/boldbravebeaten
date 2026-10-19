/*
 * Standing with factions, and reputation (renown and notoriety).
 * Standing runs −100..100 per faction. A change spreads: allies get a share, enemies the inverse.
 * Reputation has two sides, and an NPC reacts to the side their temperament cares about
 * (data/npcs.yaml); the Reputation Control feat lets you choose which side to show.
 */
(function (G) {
  'use strict';

  const defs = () => G.Content.world.factions || {};
  const cfg = () => G.CONFIG.game;

  function standing(world, id) {
    if (!id) return 0;
    if (world.standing[id] == null) world.standing[id] = (defs()[id] || {}).start || 0;
    return world.standing[id];
  }

  function tier(world, id) {
    const v = typeof id === 'number' ? id : standing(world, id);
    let name = cfg().standingTiers[0][1];
    for (const [min, label] of cfg().standingTiers) if (v >= min) name = label;
    return name;
  }

  function rank(world, id) {
    const f = defs()[id];
    if (!f || !f.ranks) return null;
    const v = standing(world, id);
    let r = null;
    for (const [min, title] of f.ranks) if (v >= min) r = title;
    return r;
  }

  // Change standing with `id`; returns lines describing everything that moved.
  function change(world, id, delta, reason, _spread) {
    const f = defs()[id];
    if (!f || !delta) return [];
    const lines = [];
    const before = standing(world, id);
    const after = Math.max(-cfg().standingMax, Math.min(cfg().standingMax, Math.round(before + delta)));
    world.standing[id] = after;
    if (after !== before) lines.push(`${f.name}: ${after > before ? '+' : ''}${after - before} (${tier(world, id)})${reason ? ' — ' + reason : ''}`);
    if (!_spread) {
      for (const a of f.allies || []) lines.push(...change(world, a, delta * cfg().allyShare, null, true));
      for (const e of f.enemies || []) lines.push(...change(world, e, -delta * cfg().enemyShare, null, true));
    }
    return lines;
  }

  function addRep(world, key, n) {
    world.rep[key] = Math.max(0, Math.min(100, (world.rep[key] || 0) + n));
  }

  // Killing a member of a faction.
  function killed(world, id, count) {
    if (!id || !defs()[id] || id === 'wilds') return [];
    return change(world, id, cfg().killStanding * (count || 1), 'blood spilled');
  }

  // Hostile on sight?
  function kos(world, id) {
    const f = defs()[id];
    return !!f && f.kos != null && f.kos > -100 && standing(world, id) <= f.kos;
  }

  G.Factions = { defs, standing, tier, rank, change, addRep, killed, kos };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
