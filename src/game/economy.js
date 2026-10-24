/*
 * Money: values, shop stock, buying and selling, repairs, rest and healing.
 * Price = base value (rarity, or the entry's own value, × the item's tags × coverage) adjusted by standing with
 * the seller's faction, the Bargain feat and a small CHA nudge. Selling pays a fraction of value.
 */
(function (G) {
  'use strict';
  const C = G.Character;
  const Items = G.Items;
  const D = () => G.DATA;
  const E = () => G.CONFIG.game.economy;

  // ---- Specs: a stock/loot line becomes an item -----------------------------
  // A spec may carry an item's tags: material, origin, craft (an old `quality` is read as one), enchantments.
  function makeFromSpec(spec) {
    const craft = spec.craft || spec.quality || 'average';
    const tags = { material: spec.material, origin: spec.origin, enchantments: spec.enchantments, name: spec.name };
    if (spec.weapon) return Items.makeWeapon(spec.weapon, craft, spec.material, tags);
    if (spec.armor) return Items.makeArmor(spec.armor, spec.coverage || 'full', craft, tags);
    if (spec.shield) return Items.makeShield(spec.shield, spec.material || 'wood', craft, tags);
    return null;
  }

  function nameOfSpec(spec) {
    if (spec.good) return G.World.goodDef(spec.good).name;
    return Items.itemName(makeFromSpec(spec));
  }

  // ---- Value ------------------------------------------------------------------
  const rv = (r) => E().rarityValue[r] || E().rarityValue.common;

  function value(item) {
    if (!item) return 0;
    // The type's value × its tags' (material against the type's usual one, origin, craft, enchantments).
    if (item.kind === 'armor') {
      const base = D().ARMOR[item.type];
      return Math.max(1, Math.round((base.value || rv(base.rarity)) * Items.tagValue(item) * E().coverageMult[item.coverage]));
    }
    if (item.kind === 'shield') {
      const s = D().SHIELDS[item.size], m = D().SHIELD_MATERIALS[item.material];
      return Math.max(1, Math.round((s.value || rv(s.rarity)) * (1 + (m.mult - 1) * 1.2) * Items.tagValue(item)));
    }
    if (item.kind === 'weapon') {
      const w = D().WEAPONS[item.type];
      return Math.max(1, Math.round((w.value || rv(w.rarity)) * Items.tagValue(item)));
    }
    return 0;
  }

  const goodValue = (id) => { const g = G.World.goodDef(id); return g ? (g.value != null ? g.value : rv(g.rarity)) : 0; };

  // ---- Prices -------------------------------------------------------------------
  // The member who talks for the party at the counter: the best bargainer.
  function haggler(world) {
    const members = G.World.active(world);
    return members.slice().sort((a, b) => (C.rank(b, 'bargain') * 3 + C.attr(b, 'CHA')) - (C.rank(a, 'bargain') * 3 + C.attr(a, 'CHA')))[0] || null;
  }

  function priceFactor(world, faction, selling, service) {
    const f = 1 - (faction ? G.Factions.standing(world, faction) : 0) * E().priceStanding * (selling ? -1 : 1);
    const h = haggler(world);
    const bargain = h ? C.rank(h, 'bargain') * E().bargainRank + Math.max(0, C.attr(h, 'CHA') - 5) * 0.01 : 0;
    const smith = service && service.id === 'forge' && world.flags.smith_discount ? 0.1 : 0;
    return Math.max(0.5, Math.min(1.8, f * (selling ? 1 + bargain : 1 - bargain - smith)));
  }

  function buyPrice(world, base, service) {
    return Math.max(1, Math.round(base * priceFactor(world, service && service.faction, false, service)));
  }
  function sellPrice(world, base, service) {
    return Math.max(0, Math.round(base * E().sellRate * priceFactor(world, service && service.faction, true, service)));
  }

  // ---- Shops ----------------------------------------------------------------------
  function stock(world, service) {
    const out = [];
    (service.stock || []).forEach((spec, i) => {
      const ok = G.Cond.test(world, spec.req);
      if (!ok && !spec.show) return;
      const item = spec.good ? null : makeFromSpec(spec);
      const base = spec.good ? goodValue(spec.good) : value(item);
      out.push({ key: i, spec, item, base, name: nameOfSpec(spec), price: buyPrice(world, spec.price || base, service), per: spec.good ? (G.World.goodDef(spec.good).per || 1) : 1 });
    });
    return out;
  }

  function buy(world, service, entry) {
    if (world.gold < entry.price) return { ok: false, reason: 'Not enough gold' };
    world.gold -= entry.price;
    if (entry.spec.good) G.World.addGood(world, entry.spec.good, 1);
    else world.pack.gear.push(makeFromSpec(entry.spec));
    G.World.logLine(world, `Bought ${entry.name} for ${entry.price} gold.`, 'info');
    return { ok: true };
  }

  function sellItem(world, item, service) {
    const price = sellPrice(world, value(item), service);
    world.pack.gear = world.pack.gear.filter((x) => x.id !== item.id);
    world.gold += price;
    G.World.logLine(world, `Sold ${Items.itemName(item)} for ${price} gold.`, 'info');
    return price;
  }

  function sellGood(world, id, service) {
    if (!G.World.removeGood(world, id, 1)) return 0;
    const g = G.World.goodDef(id);
    const price = sellPrice(world, goodValue(id), service);
    world.gold += price;
    G.World.logLine(world, `Sold ${g.name} for ${price} gold.`, 'info');
    return price;
  }

  function canSell(service, kind) {
    return (service.buys || []).includes(kind);
  }

  // ---- Repairs ----------------------------------------------------------------------
  function repairCost(world, item, service) {
    if (!item) return 0;
    const max = maxDurability(item);
    if (!max) return 0;
    const missing = max - Math.max(0, item.durability == null ? max : item.durability);
    if (missing <= 0) return 0;
    return Math.max(1, Math.round(missing * value(item) * E().repairPerPoint / max * priceFactor(world, service && service.faction, false, service)));
  }

  function maxDurability(item) {
    return item.kind === 'armor' ? Items.armorMaxDurability(item) : item.kind === 'shield' ? Items.shieldStats(item).maxDurability : item.kind === 'weapon' ? Items.weaponMaxDurability(item) : 0;
  }

  function repair(world, item, service) {
    const cost = repairCost(world, item, service);
    if (!cost) return { ok: false, reason: 'Nothing to repair' };
    if (world.gold < cost) return { ok: false, reason: 'Not enough gold' };
    world.gold -= cost;
    item.durability = maxDurability(item);
    G.World.logLine(world, `Repaired ${Items.itemName(item)} for ${cost} gold.`, 'info');
    return { ok: true, cost };
  }

  // ---- Inn and healer --------------------------------------------------------------
  function innCost(world) {
    const per = E().innPerHead * (world.flags.inn_tab ? 0.5 : 1);
    return Math.round(per * G.World.living(world).length);
  }

  function healCost(world, c, service) {
    const pts = C.totalDamage(c);
    const st = service && service.faction ? G.Factions.standing(world, service.faction) : 0;
    if (st >= G.CONFIG.game.economy.healerStandingFree) return 0;
    const f = st >= 10 ? 0.7 : 1;
    return Math.round(pts * E().healCostPerPoint * f);
  }

  function raiseCost(c) { return 300 + 120 * c.level; }

  // Training: gold for the next rank of a feat.
  function trainCost(c, featId) {
    const f = D().FEATS[featId];
    const tierName = f.ranks[C.rank(c, featId)];
    return G.CONFIG.game.trainingCost[tierName] || 100;
  }

  G.Economy = {
    makeFromSpec, nameOfSpec, value, goodValue, haggler, priceFactor, buyPrice, sellPrice,
    stock, buy, sellItem, sellGood, canSell, repairCost, repair, innCost, healCost, raiseCost, trainCost,
  };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
