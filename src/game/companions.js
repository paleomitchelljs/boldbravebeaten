/*
 * Companions (PROVISIONAL, the user's idea): a familiar (feat Familiar, magic) or an animal companion (feat Animal
 * Companion, perception). Each is a full character kept on its owner (c.companion), so its wounds carry from fight
 * to fight like anyone's. It joins every fight on the party's side, run by the AI, and rests when the party rests.
 *
 * What may follow whom is data (rules.yaml game.companions): for each kind, the monsters.yaml keys on offer by feat
 * rank (rank II offers stronger beasts). The owner picks one (c.companionChoice); otherwise the first on offer.
 *   familiar  +2 spell points per Familiar rank while it lives (Magic.maxSP); its death costs the owner `death`
 *             attribute points (the bond tears)
 *   beast     a fighter at your side
 * A dead companion is gone until the party rests in town (a new one answers the call). DOM-free.
 */
(function (G) {
  'use strict';
  const C = G.Character;

  const cfg = () => (G.CONFIG.game && G.CONFIG.game.companions) || {};

  // What this character's feats entitle them to: { kind, rank, options: [monster keys] } or null.
  function entitlement(c) {
    const fam = C.rank(c, 'familiar'), beast = C.rank(c, 'animal_companion');
    const pick = (kind, rank) => {
      const K = cfg()[kind] || {};
      const byRank = K.ranks || [];
      const options = [].concat(...byRank.slice(0, rank)).filter((k) => G.Enemies.MONSTERS[k]);
      return options.length ? { kind, rank, options } : null;
    };
    // A character with both keeps the beast: it is the bigger help in a fight (the familiar's points aside).
    return (beast && pick('beast', beast)) || (fam && pick('familiar', fam)) || null;
  }

  function make(c, ent) {
    const key = ent.options.includes(c.companionChoice) ? c.companionChoice : ent.options[ent.options.length - 1];
    const [b] = G.Enemies.makeMonster(key);
    b.name = `${c.name.split(' ')[0]}'s ${G.Enemies.MONSTERS[key].name.toLowerCase()}`;
    b.side = 'party';
    b.control = 'auto';
    b.lootTable = null;
    b.xp = 0;
    b.faction = null;
    b.owner = c.id;
    b.familiar = ent.kind === 'familiar';
    b.companionKind = key;
    return b;
  }

  // Bring every member's companion in line with their feats. `town`: a dead one is replaced (it answers the call
  // in town). Returns lines for the log.
  function ensure(world, opts) {
    opts = opts || {};
    const lines = [];
    for (const c of G.World.party(world)) {
      const ent = entitlement(c);
      if (!ent) { if (c.companion) c.companion = null; continue; }
      const cur = c.companion;
      const wrong = cur && (!ent.options.includes(cur.companionKind) || (cur.familiar !== (ent.kind === 'familiar')) || (c.companionChoice && c.companionChoice !== cur.companionKind && ent.options.includes(c.companionChoice)));
      if (!cur || wrong || (cur.status.dead && opts.town)) {
        c.companion = make(c, ent);
        if (cur || opts.announce) lines.push(`${c.companion.name} answers ${c.name}'s call.`);
      } else C.normalize(cur);
    }
    return lines;
  }

  // Companions who come into a fight: those of members still on their feet, themselves alive.
  function fighting(world) {
    return G.World.active(world).map((c) => c.companion).filter((b) => b && C.isActive(b));
  }

  // After a fight: a familiar that died tears at its owner (once).
  function afterFight(world) {
    const lines = [];
    const D = (cfg().familiar || {}).death || { WIL: 2 };
    for (const c of G.World.party(world)) {
      const b = c.companion;
      if (!b || !b.status.dead || b.mourned) continue;
      b.mourned = true;
      if (b.familiar) for (const [a, n] of Object.entries(D)) C.damageAttr(c, a, n);
      lines.push(b.familiar ? `${b.name} is dead; the torn bond costs ${c.name} ${Object.entries(D).map(([a, n]) => `${n} ${a}`).join(', ')}.` : `${b.name} is dead.`);
    }
    return lines;
  }

  // Rest: the living get their stamina back and the day's heal, as their owners do.
  function rest(world, long) {
    for (const c of G.World.party(world)) {
      const b = c.companion;
      if (!b || b.status.dead) continue;
      if (long) {
        b.weary = 0;
        const a = G.Recovery.healTarget(b);
        if (a) C.healAttr(b, a, 1);
        b.bleeds = [];
        b.status = C.freshStatus();
      }
      b.stamina = C.maxStamina(b);
      b.status.unconscious = false;
      C.updateCondition(b);
    }
  }

  G.Companions = { entitlement, ensure, fighting, afterFight, rest, make };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
