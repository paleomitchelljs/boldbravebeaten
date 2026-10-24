/*
 * Loot tables (items.yaml `tables`) and what a defeated foe leaves behind.
 */
(function (G) {
  'use strict';
  const R = G.Rand;
  const Items = G.Items;

  const tables = () => ((G.Content.world.items || {}).tables) || {};

  // Roll a table once. Returns { gold, goods: [{id, n}], gear: [item] }.
  function roll(tableId, times) {
    const out = { gold: 0, goods: [], gear: [] };
    const t = tables()[tableId];
    if (!t) return out;
    for (let i = 0; i < (times || 1); i++) {
      const e = R.weighted(t);
      if (e.nothing) continue;
      if (e.table) merge(out, roll(e.table)); // a nested table: a rare find within a hoard
      else if (e.gold) out.gold += R.amount(e.gold);
      else if (e.good) out.goods.push({ id: e.good, n: R.amount(e.n) });
      else {
        const item = G.Economy.makeFromSpec(e);
        if (item) out.gear.push(item);
      }
    }
    return out;
  }

  function merge(a, b) {
    a.gold += b.gold;
    a.goods.push(...b.goods);
    a.gear.push(...b.gear);
    return a;
  }

  const natural = (item) => !!item && ((item.kind === 'armor' && G.DATA.ARMOR[item.type].natural) || (item.kind === 'weapon' && G.DATA.WEAPONS[item.type].natural));

  // What one fallen foe drops: carried gear, purse, and its table.
  function fromFoe(foe) {
    const out = { gold: 0, goods: [], gear: [] };
    for (const it of [foe.armor, foe.shield].concat(foe.pieces || [], foe.weapons || [])) if (it && !natural(it)) out.gear.push(it);
    out.gold += (foe.inventory && foe.inventory.gold) || 0;
    if (foe.inventory) {
      if (foe.inventory.bandages) out.goods.push({ id: 'bandage', n: foe.inventory.bandages });
      if (foe.inventory.arrows >= 10) out.goods.push({ id: 'arrows', n: Math.floor(foe.inventory.arrows / 10) });
    }
    if (foe.lootTable) merge(out, roll(foe.lootTable));
    return out;
  }

  // Put loot in the party's hands. Returns lines to show.
  function give(world, loot) {
    const lines = [];
    if (loot.gold) { world.gold += loot.gold; lines.push(`${loot.gold} gold`); }
    for (const g of loot.goods) {
      G.World.addGood(world, g.id, g.n);
      lines.push(`${g.n > 1 ? g.n + '× ' : ''}${G.World.goodDef(g.id).name}`);
    }
    for (const it of loot.gear) {
      world.pack.gear.push(it);
      lines.push(Items.itemName(it));
    }
    return lines;
  }

  G.Loot = { roll, merge, fromFoe, give, natural };
})(typeof globalThis !== 'undefined' ? (globalThis.BBB = globalThis.BBB || {}) : {});
