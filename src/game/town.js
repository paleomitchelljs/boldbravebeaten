/*
 * What happens in town and in camp: resting, healing, raising the dead, training, using goods.
 * DOM-free. The only random rolls are the engine's heal rolls, taken automatically.
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const R = G.Rand;
  const W = G.World;
  const E = G.Economy;

  const autoRoller = async (req) => Array.from({ length: req.count }, () => R.d(req.sides));

  // Rest everyone: stamina, a daily heal roll, partial repairs. 'inn' costs gold and reaches morning;
  // 'camp' is eight hours in the dark and may bring visitors (see rest()).
  async function sleep(world, mode) {
    const lines = [];
    const members = W.living(world);
    const tender = members.slice().sort((a, b) => C.rank(b, 'wound_tending') - C.rank(a, 'wound_tending'))[0] || null;
    W.loadSupplies(world);
    for (const c of members) {
      const t = tender && tender.id !== c.id && C.isActive(tender) ? tender : (C.rank(c, 'wound_tending') ? c : null);
      const out = await G.Recovery.longRest(c, { tender: t, town: mode === 'inn' }, autoRoller);
      lines.push(...out.filter((l) => !l.startsWith('Stamina restored')).map((l) => `${c.name}: ${l}`));
    }
    W.collectSupplies(world);
    for (const c of W.party(world)) if (!c.status.dead && C.attr(c, 'CON') <= 0) c.status.dead = true;
    // Companions rest too; in town a lost one is replaced.
    if (G.Companions) { G.Companions.rest(world, true); lines.push(...G.Companions.ensure(world, { town: mode === 'inn' })); }
    if (mode === 'inn') {
      const m = world.minutes % 1440;
      W.advance(world, m < 8 * 60 ? 8 * 60 - m : 1440 - m + 8 * 60);
    } else W.advance(world, 8 * 60);
    world.stats.rests++;
    return lines;
  }

  async function innRest(world) {
    const cost = E.innCost(world);
    if (world.gold < cost) return { ok: false, reason: `A night costs ${cost} gold.` };
    world.gold -= cost;
    const lines = await sleep(world, 'inn');
    W.logLine(world, `You sleep at the inn (${cost} gold).`, 'info');
    return { ok: true, lines };
  }

  // Camp in a dungeon. Returns { ok, lines } or { interrupted: spec, surprise }.
  async function campRest(world) {
    const p = G.Explore.place(world);
    const wander = G.CONFIG.game.camp.wanderingChance;
    if (!world.peaceful && R.chance(wander)) {
      const w = G.Explore.wanderingFor(world);
      if (w && !w.nothing) {
        // The member with the best eyes keeps the watch.
        const r = G.Skills.bestCheck(W.active(world), 'perception', 8, 0);
        W.advance(world, 3 * 60);
        return { interrupted: { foes: w.foes, text: w.text, name: 'Camp attacked' }, surprise: r.ok ? null : 'party', check: r };
      }
    }
    const lines = await sleep(world, 'camp');
    W.logLine(world, 'You camp and rest.', 'info');
    return { ok: true, lines };
  }

  // A fight lost but not to the last life: the fallen are found, robbed and left. Whoever is not
  // dead wakes in town three days later, lighter by half their gold.
  function leftForDead(world) {
    const survivors = W.living(world);
    if (!survivors.length) return { ok: false };
    const lost = Math.floor(world.gold / 2);
    world.gold -= lost;
    W.advance(world, 3 * 1440);
    const home = (G.Content.world.start || {}).place || 'stonebridge';
    world.place = home; world.explore = null; world.location = null; world.battle = null; world.parley = null;
    for (const c of survivors) {
      c.status = C.freshStatus();
      c.bleeds = [];
      C.damageAttr(c, 'CON', 1);
      c.stamina = C.maxStamina(c);
      C.updateCondition(c);
    }
    W.logLine(world, `You wake in Stonebridge three days later. Someone took ${lost} gold for the trouble.`, 'hurt');
    return { ok: true, lost };
  }

  // ---- Temple ---------------------------------------------------------------------------
  function heal(world, c, service) {
    const cost = E.healCost(world, c, service);
    if (!C.totalDamage(c) && !c.bleeds.length && c.stamina >= C.maxStamina(c)) return { ok: false, reason: 'Nothing to heal.' };
    if (world.gold < cost) return { ok: false, reason: `That costs ${cost} gold.` };
    world.gold -= cost;
    for (const a of G.CONFIG.attributes) c.damage[a] = 0;
    c.bleeds = [];
    c.stamina = C.maxStamina(c);
    c.status = Object.assign(C.freshStatus(), { dead: c.status.dead });
    C.updateCondition(c);
    if (cost && service && service.faction) G.Factions.change(world, service.faction, 0.5, null, true);
    W.logLine(world, `${c.name} is tended${cost ? ` (${cost} gold)` : ''}.`, 'info');
    return { ok: true, cost };
  }

  function raise(world, c, service) {
    if (!c.status.dead) return { ok: false, reason: 'They are not dead.' };
    if (service && service.faction && G.Factions.standing(world, service.faction) < 25) return { ok: false, reason: 'The Lantern does not raise strangers (needs Friendly standing).' };
    const cost = E.raiseCost(c);
    if (world.gold < cost) return { ok: false, reason: `That costs ${cost} gold.` };
    world.gold -= cost;
    c.status = C.freshStatus();
    for (const a of G.CONFIG.attributes) c.damage[a] = 0;
    c.damage.CON = 3; // the price: they come back barely
    c.bleeds = [];
    c.stamina = Math.max(1, Math.floor(C.maxStamina(c) / 2));
    C.updateCondition(c);
    W.logLine(world, `${c.name} is called back (${cost} gold).`, 'info');
    return { ok: true, cost };
  }

  // ---- Training ------------------------------------------------------------------------------
  // opts.camp: training at a camp in a dungeon (rules.yaml game.campTraining scales the price).
  const trainPrice = (c, id, opts) => Math.round(E.trainCost(c, id) * (opts && opts.camp ? (G.CONFIG.game.campTraining != null ? G.CONFIG.game.campTraining : 1) : 1));

  function trainable(c, id, opts) {
    const f = G.DATA.FEATS[id];
    const chk = C.canTakeFeat(c, id);
    return { ok: chk.ok && f.auto, reason: !f.auto ? 'Not yet in the game' : chk.reason, cost: chk.ok ? trainPrice(c, id, opts) : null };
  }

  function train(world, c, id, opts) {
    const t = trainable(c, id, opts);
    if (!t.ok && !(opts && opts.bench)) return { ok: false, reason: t.reason };
    const cost = trainPrice(c, id, opts);
    if (world.gold < cost && !(opts && opts.free)) return { ok: false, reason: `Instruction costs ${cost} gold.` };
    if (!(opts && opts.free)) world.gold -= cost;
    C.addFeat(c, id);
    W.logLine(world, `${c.name} trains ${G.DATA.FEATS[id].name}.`, 'info');
    return { ok: true, cost };
  }

  // ---- Using goods ------------------------------------------------------------------------------
  function useGood(world, id, c) {
    const g = W.goodDef(id);
    if (!g) return { ok: false, reason: 'Unknown item' };
    if (W.goodCount(world, id) < 1) return { ok: false, reason: 'None left' };
    const lines = [];
    if (g.kind === 'potion' || (g.kind === 'supply' && g.use)) {
      const u = g.use || {};
      if (u.heal) { const a = G.Recovery.healTarget(c); if (!a) return { ok: false, reason: `${c.name} is unhurt.` }; C.healAttr(c, a, u.heal); lines.push(`${c.name} heals ${u.heal} ${a}.`); }
      if (u.cure === 'bleeding') { if (!c.bleeds.length) return { ok: false, reason: 'Not bleeding.' }; c.bleeds = []; lines.push(`${c.name}'s bleeding stops.`); }
      if (u.cure === 'poison') { c.bleeds = c.bleeds.filter((b) => !b.poison); c.status.conds = (c.status.conds || []).filter((x) => !['venom', 'plague', 'poisoned', 'diseased'].includes(x.key)); lines.push(`${c.name} is cleansed.`); }
      if (u.repair) {
        const items = [c.shield].filter(Boolean).concat(G.Character.armorPieces(c)).concat(c.weapons.filter((x) => G.Items.weaponMaxDurability(x) && !G.Items.weaponBroken(x)));
        if (!items.length) return { ok: false, reason: 'Nothing to repair.' };
        for (const it of items) {
          const max = it.kind === 'armor' ? G.Items.armorMaxDurability(it) : it.kind === 'shield' ? G.Items.shieldStats(it).maxDurability : G.Items.weaponMaxDurability(it);
          const cur = it.durability == null ? max : it.durability;
          it.durability = Math.min(max, cur + Math.ceil(max * u.repair));
        }
        lines.push(`${c.name}'s gear is patched up.`);
      }
      W.removeGood(world, id, 1);
    } else if (g.kind === 'book') {
      if (g.teaches && g.teaches.noun) {
        if ((c.nouns || []).includes(g.teaches.noun)) return { ok: false, reason: `${c.name} already knows ${g.teaches.noun}.` };
        c.nouns = (c.nouns || []).concat(g.teaches.noun);
        lines.push(`${c.name} learns the word ${g.teaches.noun}.`);
      }
      for (const s of g.reveals || []) { W.setFlag(world, s); lines.push('You work out what the marks mean.'); }
      W.removeGood(world, id, 1);
    } else return { ok: false, reason: 'It does nothing on its own.' };
    for (const l of lines) W.logLine(world, l, 'info');
    return { ok: true, lines };
  }

  // A faction pays for dead members of another once you stand well enough with it (rules.yaml game.bounty:
  // {on, payer, gold, minStanding, standingPer}).
  const bountyCfg = () => Object.assign({ on: null, payer: null, gold: 15, minStanding: 10, standingPer: 0.5 }, G.CONFIG.game.bounty || {});
  function bountyDue(world) { return world.bounty || 0; }
  function collectBounty(world) {
    const B = bountyCfg();
    const n = world.bounty || 0;
    const payer = B.payer && G.Factions.defs()[B.payer] ? G.Factions.defs()[B.payer].name : 'The payer';
    if (!n || !B.payer) return { ok: false, reason: 'No bounty to collect.' };
    if (G.Factions.standing(world, B.payer) < B.minStanding) return { ok: false, reason: `${payer} pays bounties only to its friends (standing ${B.minStanding}).` };
    world.bounty = 0;
    world.gold += n * B.gold;
    const lines = G.Factions.change(world, B.payer, n * B.standingPer, 'bounties');
    W.logLine(world, `${payer} pays ${n * B.gold} gold for ${n} outlaw${n > 1 ? 's' : ''}.`, 'info');
    return { ok: true, gold: n * B.gold, lines };
  }

  G.Town = { leftForDead, bountyCfg, bountyDue, collectBounty, autoRoller, sleep, innRest, campRest, heal, raise, trainable, train, useGood };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
