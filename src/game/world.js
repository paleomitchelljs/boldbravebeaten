/*
 * The world: everything a save file holds. DOM-free, so Node tests drive it.
 *
 *   world = { chars, partyIds, place, explore, maps, flags, quests, standing, rep, gold,
 *             supplies, pack, minutes, log, battle, … }
 *
 * Gold, supplies and the pack belong to the party. Supplies (bandages, arrows, bodkins, components)
 * are dealt out to members when a fight starts and collected afterward (see loadSupplies).
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const Items = G.Items;
  const CONFIG = G.CONFIG;

  const cfg = () => CONFIG.game;
  const content = () => G.Content.world;

  // ---- Characters ---------------------------------------------------------
  const LOOKS = {
    skin: ['#f0d2b4', '#e0b48a', '#c58f60', '#9a6a45', '#6d4630', '#4a2f22'],
    hair: ['#2a1c14', '#5a3a22', '#8a5a2c', '#b8893c', '#d9d2c4', '#8b2f1e', '#3a3f4a'],
    cloth: ['#7a5a3a', '#4f6b52', '#52607a', '#7a4f5a', '#6b5b7a', '#7a6d45'],
  };

  // spec: { name, attrs, kit, feats: [ids], nouns: [ids], look: {sprite, tint (0-6), ...} }
  function makeCharacter(spec) {
    const kits = (content().start || {}).kits || [];
    const kit = kits.find((k) => k.id === spec.kit) || kits[0] || {};
    const c = C.newCharacter({ name: spec.name || 'Adventurer', base: spec.attrs, starterGear: false });
    c.gold = undefined;
    c.inventory.gold = 0;
    c.inventory.bandages = 0;
    if (kit.armor) c.armor = Items.makeArmor(kit.armor, 'full', 'average');
    if (kit.shield) c.shield = Items.makeShield(kit.shield, 'wood', 'average');
    for (const [i, t] of [kit.wield, kit.sidearm].entries()) {
      if (!t) continue;
      const w = Items.makeWeapon(t, 'average');
      c.weapons.push(w);
      if (i === 0) c.wield = w.id; else c.sidearm = w.id;
    }
    const main = C.wieldedWeapon(c);
    if (main && G.DATA.WEAPONS[main.type].hands === 2) { c.shield = null; }
    if (kit.sidearm === 'parryingDagger') { c.offhand = c.sidearm; c.sidearm = null; }
    // A spec may name its own gear (item specs as in the loot tables) in place of the kit's, and start above level 1.
    const E = G.Economy;
    if (spec.armorItem) c.armor = E.makeFromSpec(spec.armorItem);
    if (spec.shieldItem !== undefined) c.shield = spec.shieldItem ? E.makeFromSpec(spec.shieldItem) : null;
    if (spec.weaponItems) {
      c.weapons = spec.weaponItems.map(E.makeFromSpec);
      c.wield = c.weapons[0] ? c.weapons[0].id : null;
      c.sidearm = c.weapons[1] ? c.weapons[1].id : null;
    }
    if (spec.level > 1) { c.level = spec.level; c.xp = xpFor(spec.level); }
    if (spec.bonusFeats) c.bonusFeats = spec.bonusFeats;
    for (const f of spec.feats || []) if (C.canTakeFeat(c, f).ok) C.addFeat(c, f);
    c.nouns = (spec.nouns || []).slice();
    c.look = Object.assign({ skin: 1, hair: 1, cloth: 0, build: 1, sprite: null, tint: 0 }, spec.look || {}, { kit: spec.kit || (spec.look && spec.look.kit) || null });
    c.xp = 0;
    c.control = 'manual';
    c.stamina = C.maxStamina(c);
    return c;
  }

  // The ready-made party in start.yaml (the New Game screen's quick start).
  function presetParty() {
    return (((content().start || {}).presets) || []).map((p, i) => Object.assign({}, p, { look: { skin: [1, 2, 0, 3][i % 4], hair: [1, 2, 4, 5][i % 4], cloth: i % 6, build: 1, sprite: null, tint: [0, 2, 3, 1][i % 4] } }));
  }

  // A trial start (start.yaml trials): its party specs, each with its own look.
  function trialParty(id) {
    const t = ((content().start || {}).trials || []).find((x) => x.id === id);
    return t ? t.party.map((p) => Object.assign({}, p, { look: Object.assign({ skin: 1, hair: 1, cloth: 0, build: 1, sprite: null, tint: 0 }, p.look || {}) })) : [];
  }

  function create(specs, opts) {
    opts = opts || {};
    const S = content().start || {};
    const world = {
      version: 2, id: Items.uid('world'), created: Date.now(),
      chars: {}, partyIds: [],
      minutes: 8 * 60, day: 1,
      gold: S.gold != null ? S.gold : cfg().party.startGold,
      supplies: Object.assign({ bandages: 0, arrows: 0, bodkins: 0, components: {} }, S.supplies || {}),
      pack: { gear: [], goods: {} },
      flags: {}, quests: {}, standing: {}, rep: { renown: 0, notoriety: 0 },
      place: S.place || 'stonebridge', location: null, explore: null, maps: {}, npcs: {},
      battle: null, log: [], stats: { kills: 0, fights: 0, rests: 0, deaths: 0 },
      secrets: [], settings: { autoRoll: 'all', aiEnemies: true, gmView: false },
    };
    for (const f of S.flags || []) world.flags[f] = true;
    for (const spec of specs) {
      const c = makeCharacter(spec);
      world.chars[c.id] = c;
      world.partyIds.push(c.id);
      if (spec.kit) { const k = (S.kits || []).find((x) => x.id === spec.kit); if (k && k.arrows) world.supplies.arrows += k.arrows; }
      for (const t of spec.trinkets || []) { addGood(world, t, 1); G.Equip.equipTrinket(world, c, t); }
    }
    for (const id of Object.keys(content().factions || {})) G.Factions.standing(world, id);
    if (opts.log !== false) logLine(world, 'Your party arrives in Stonebridge.', 'info');
    return world;
  }

  // ---- Party --------------------------------------------------------------
  const party = (world) => world.partyIds.map((id) => world.chars[id]).filter(Boolean);
  const living = (world) => party(world).filter((c) => !c.status.dead);
  const active = (world) => party(world).filter((c) => C.isActive(c));

  // ---- Log, time ----------------------------------------------------------
  function logLine(world, text, cls) {
    world.log.push({ day: world.day, t: world.minutes % 1440, text, cls: cls || '' });
    if (world.log.length > 300) world.log.splice(0, world.log.length - 300);
    return text;
  }

  function advance(world, minutes) {
    world.minutes += minutes;
    world.day = 1 + Math.floor(world.minutes / 1440);
  }

  function clockText(world) {
    const m = world.minutes % 1440;
    const h = Math.floor(m / 60);
    const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
    return `Day ${world.day}, ${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} (${part})`;
  }

  const isNight = (world) => { const h = Math.floor((world.minutes % 1440) / 60); return h < 5 || h >= 21; };

  // ---- Flags --------------------------------------------------------------
  const flag = (world, id) => !!world.flags[id];
  function setFlag(world, id, v) {
    if (v === false) delete world.flags[id]; else world.flags[id] = true;
  }

  // ---- Goods and supplies -------------------------------------------------
  const goodDef = (id) => (content().items || {}).goods && content().items.goods[id];

  function goodCount(world, id) {
    const g = goodDef(id);
    if (g && g.kind === 'supply' && g.engine) return world.supplies[g.engine] || 0;
    if (g && g.kind === 'component') return world.supplies.components[id] || 0;
    return world.pack.goods[id] || 0;
  }

  function addGood(world, id, n) {
    n = n == null ? 1 : n;
    const g = goodDef(id);
    if (!g) throw new Error('Unknown good: ' + id);
    if (g.kind === 'supply' && g.engine) world.supplies[g.engine] = (world.supplies[g.engine] || 0) + n * (g.per || 1);
    else if (g.kind === 'component') world.supplies.components[id] = (world.supplies.components[id] || 0) + n;
    else world.pack.goods[id] = (world.pack.goods[id] || 0) + n;
  }

  function removeGood(world, id, n) {
    n = n == null ? 1 : n;
    const g = goodDef(id);
    const need = n * ((g && g.per) || 1);
    if (goodCount(world, id) < need) return false;
    if (g && g.kind === 'supply' && g.engine) world.supplies[g.engine] -= need;
    else if (g && g.kind === 'component') world.supplies.components[id] -= n;
    else { world.pack.goods[id] -= n; if (world.pack.goods[id] <= 0) delete world.pack.goods[id]; }
    return true;
  }

  // Deal supplies to members at the start of a fight; collect them afterward.
  function loadSupplies(world) {
    const members = active(world);
    if (!members.length) return;
    const S = world.supplies;
    members.forEach((c) => { c.inventory.bandages = 0; c.inventory.arrows = 0; c.inventory.bodkins = 0; c.inventory.components = {}; });
    const deal = (total, targets, key) => {
      let i = 0;
      for (let n = 0; n < total; n++, i++) targets[i % targets.length].inventory[key] += 1;
    };
    deal(S.bandages, members, 'bandages');
    const archers = members.filter((c) => { const w = C.wieldedWeapon(c); return w && G.DATA.WEAPONS[w.type].ranged; });
    const shooters = archers.length ? archers : members;
    deal(S.arrows, shooters, 'arrows');
    deal(S.bodkins, shooters, 'bodkins');
    const casters = members.filter((c) => (c.nouns || []).length || C.rank(c, 'ritualist'));
    const holders = casters.length ? casters : members;
    for (const [id, n] of Object.entries(S.components)) {
      for (let k = 0; k < n; k++) { const c = holders[k % holders.length]; c.inventory.components[id] = (c.inventory.components[id] || 0) + 1; }
    }
  }

  function collectSupplies(world) {
    const S = world.supplies;
    S.bandages = 0; S.arrows = 0; S.bodkins = 0; S.components = {};
    for (const c of party(world)) {
      S.bandages += c.inventory.bandages || 0;
      S.arrows += c.inventory.arrows || 0;
      S.bodkins += c.inventory.bodkins || 0;
      for (const [id, n] of Object.entries(c.inventory.components || {})) if (n > 0) S.components[id] = (S.components[id] || 0) + n;
      c.inventory.bandages = 0; c.inventory.arrows = 0; c.inventory.bodkins = 0; c.inventory.components = {};
      // Loose items picked up in a fight go to the pack.
      for (const it of c.inventory.items || []) world.pack.gear.push(it);
      c.inventory.items = [];
    }
  }

  // ---- XP and levels ------------------------------------------------------
  function levelFor(xp) {
    let L = 1;
    while (L < cfg().maxLevel && xp >= cfg().xpBase * L * (L + 1) / 2) L++;
    return L;
  }
  const xpFor = (level) => cfg().xpBase * (level - 1) * level / 2;

  function grantXP(world, amount) {
    const lines = [];
    if (!amount) return lines;
    for (const c of living(world)) {
      c.xp = (c.xp || 0) + amount;
      const L = levelFor(c.xp);
      if (L > c.level) {
        c.level = L;
        lines.push(`${c.name} reaches level ${L}. (Spend the new feat at the Training Yard.)`);
      }
    }
    lines.unshift(`+${amount} XP`);
    return lines;
  }

  // ---- Quests -------------------------------------------------------------
  const questDef = (id) => (content().quests || {})[id];

  function startQuest(world, id) {
    const q = questDef(id);
    if (!q || world.quests[id]) return null;
    for (const x of q.exclusive || []) if (world.quests[x] && !world.quests[x].done) world.quests[x].failed = true;
    world.quests[id] = { stage: 0, done: false, startedDay: world.day };
    return logLine(world, `New quest: ${q.name}.`, 'quest');
  }

  function giveReward(world, r, label) {
    const lines = [];
    if (!r) return lines;
    if (r.gold) { world.gold += r.gold; lines.push(`+${r.gold} gold`); }
    if (r.xp) lines.push(...grantXP(world, r.xp));
    for (const [f, d] of Object.entries(r.standing || {})) lines.push(...G.Factions.change(world, f, d, label));
    if (r.renown) { G.Factions.addRep(world, 'renown', r.renown); lines.push(`Renown +${r.renown}`); }
    if (r.notoriety) { G.Factions.addRep(world, 'notoriety', r.notoriety); lines.push(`Notoriety +${r.notoriety}`); }
    if (r.good) { addGood(world, r.good, r.n || 1); lines.push(`Received ${goodDef(r.good).name}`); }
    for (const f of r.flags || []) setFlag(world, f);
    return lines;
  }

  // Advance every active quest whose stage condition now holds. Returns log lines.
  function updateQuests(world) {
    const out = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const [id, st] of Object.entries(world.quests)) {
        const q = questDef(id);
        if (!q || st.done || st.failed) continue;
        const stage = q.stages[st.stage];
        if (stage && G.Cond.test(world, stage.done_when)) {
          st.stage += 1;
          changed = true;
          if (st.stage >= q.stages.length) {
            st.done = true;
            out.push(logLine(world, `Quest complete: ${q.name}.`, 'quest'));
            for (const l of giveReward(world, q.reward, q.name)) out.push(logLine(world, l, 'quest'));
          } else {
            out.push(logLine(world, `${q.name}: ${q.stages[st.stage].text}`, 'quest'));
          }
        }
      }
    }
    return out;
  }

  // ---- Per-place persistent state ------------------------------------------
  function mapState(world, placeId) {
    return world.maps[placeId] || (world.maps[placeId] = { seen: {}, ents: {} });
  }

  // ---- Death and defeat -----------------------------------------------------
  const wiped = (world) => active(world).length === 0;

  // Stamina back, bleeding settled, bandages used. Between fights, not a night's rest.
  function breather(world) {
    loadSupplies(world);
    const members = living(world);
    let bandages = members.reduce((t, c) => t + (c.inventory.bandages || 0), 0);
    for (const c of members) {
      if (!c.bleeds.length) continue;
      if (bandages > 0) {
        const holder = members.find((x) => x.inventory.bandages > 0);
        holder.inventory.bandages--; bandages--;
        c.bleeds = c.bleeds.filter((b) => b.poison);
      }
      const left = c.bleeds.reduce((t, b) => t + b.remaining, 0);
      if (left) C.damageAttr(c, 'CON', left);
      c.bleeds = [];
      C.updateCondition(c);
    }
    for (const c of party(world)) {
      if (c.status.dead) continue;
      if (C.attr(c, 'CON') <= 0) { c.status.dead = true; world.stats.deaths++; continue; }
      // With CONFIG.afterBattle, stamina comes back only if the party stops to rest (restAndRepair).
      if (!CONFIG.afterBattle) c.stamina = C.maxStamina(c);
      c.status = Object.assign(C.freshStatus(), { dead: false });
      C.updateCondition(c);
    }
    collectSupplies(world);
  }

  // After a fight, one click: catch your breath and patch up the gear (CONFIG.afterBattle). Time
  // passes; stamina refills to the weary maximum; armor, shields and weapons get a share back
  // (Field Repair in the party doubles it). Returns what happened, line by line.
  function restAndRepair(world) {
    const A = CONFIG.afterBattle || { minutes: 15 };
    advance(world, A.minutes);
    const members = living(world);
    const handy = members.some((c) => C.rank(c, 'field_repair'));
    const frac = CONFIG.restRepairFraction * (handy ? 2 : 1);
    const lines = [`You stop for ${A.minutes} minutes to catch your breath and see to your gear.`];
    for (const c of members) {
      c.stamina = C.maxStamina(c);
      C.updateCondition(c);
      const mended = G.Recovery.mendGear(c, frac);
      if (mended.length) lines.push(`${c.name}: ${mended.join(' ')}`);
      if (c.weary) lines.push(`${c.name} is wearied: stamina tops out at ${C.maxStamina(c)} of ${C.freshStamina(c)} until a long rest.`);
    }
    if (G.Companions) G.Companions.rest(world, false);
    for (const l of lines) logLine(world, l, 'info');
    return lines;
  }

  G.World = {
    LOOKS, makeCharacter, presetParty, trialParty, create, party, living, active,
    logLine, advance, clockText, isNight,
    flag, setFlag,
    goodDef, goodCount, addGood, removeGood, loadSupplies, collectSupplies,
    levelFor, xpFor, grantXP,
    questDef, startQuest, updateQuests, giveReward,
    mapState, wiped, breather, restAndRepair,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
