/* Town: the street, its locations, the people in them, and what they sell, mend and teach. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, toast } = UI;
  const C = G.Character;
  const World = G.World;
  const Items = G.Items;
  const Econ = G.Economy;

  const place = (game) => G.Content.world.places[game.world.place];

  // ---- The street -----------------------------------------------------------------------------------
  function street(game) {
    const p = place(game);
    const w = game.world;
    const look = p.look || {};
    const exits = (p.exits || []).filter((e) => G.Cond.test(w, e.requires));
    const hidden = (p.exits || []).length - exits.length;
    return h('div', { class: 'stack town-street' },
      h('div', { class: 'banner', style: { background: `linear-gradient(180deg, ${look.sky || '#6f8aa6'} 0%, ${look.ground || '#7a6a52'} 100%)` } },
        h('div', { class: 'banner-text' }, h('h1', null, p.name), h('p', null, p.blurb))),
      h('div', { class: 'grid-3 locations' }, p.locations.map((loc) => h('button', { class: 'loc-card', onclick: () => { game.ui.loc = loc.id; game.render(); } },
        h('span', { class: 'glyph' }, loc.glyph || '⌂'), h('b', null, loc.name), h('span', { class: 'small muted' }, loc.blurb),
        loc.npcs.length ? h('span', { class: 'small' }, loc.npcs.map((n) => G.Content.world.npcs[n].name).join(', ')) : null))),
      h('section', { class: 'panel stack' },
        h('h3', null, 'Beyond the gate'),
        exits.length ? exits.map((e) => h('div', { class: 'row spread' },
          h('span', null, e.label),
          h('button', { class: 'primary', onclick: () => { if (G.World.living(w).length === 0) return; if (World.active(w).length < World.living(w).length && !game.ui.confirmGo) { game.ui.confirmGo = true; toast('Some of the party are hurt or down. Heal first, or press again to go anyway.'); game.render(); return; } game.travel(e); } }, 'Go'))) : h('p', { class: 'muted' }, 'You have not heard of anywhere worth going yet. Ask around.'),
        hidden ? h('p', { class: 'small muted' }, `${hidden} more place${hidden > 1 ? 's' : ''} you have only half-heard of. People in the inns might know.`) : null));
  }

  // ---- A location ----------------------------------------------------------------------------------------
  function location(game, loc) {
    const w = game.world;
    return h('div', { class: 'stack' },
      h('div', { class: 'row spread' },
        h('div', { class: 'stack tight' }, h('span', { class: 'label' }, place(game).name), h('h1', null, `${loc.glyph || ''} ${loc.name}`), h('p', { class: 'muted' }, loc.blurb)),
        h('button', { onclick: () => { game.ui.loc = null; game.ui.svc = null; game.render(); } }, '← Back to the street')),
      loc.npcs.length ? h('section', { class: 'panel stack' }, h('h3', null, 'People'),
        h('div', { class: 'npcs' }, loc.npcs.map((id) => npcCard(game, id)))) : null,
      (loc.services || []).map((s, i) => h('section', { class: 'panel stack', key: i }, service(game, s))));
  }

  function npcCard(game, id) {
    const w = game.world;
    const n = G.Content.world.npcs[id];
    const rank = n.faction ? G.Factions.rank(w, n.faction) : null;
    return h('div', { class: 'npc' },
      h('span', { class: 'glyph big' }, n.glyph || '🧍'),
      h('div', { class: 'stack tight grow' },
        h('b', { title: n.look }, n.name), h('span', { class: 'small muted' }, n.title),
        n.faction ? h('span', { class: 'small muted' }, `${G.Factions.defs()[n.faction].name}: ${G.Factions.tier(w, n.faction).toLowerCase()}`) : null),
      h('button', { class: 'primary', onclick: () => game.talk(id, { type: 'town' }) }, 'Talk'));
  }

  // ---- Services ---------------------------------------------------------------------------------------------
  function service(game, s) {
    switch (s.kind) {
      case 'inn': return inn(game, s);
      case 'shop': return shop(game, s);
      case 'healer': return healer(game, s);
      case 'trainer': return trainer(game, s);
      case 'bounty': return bounty(game, s);
      default: return h('p', null, s.name);
    }
  }

  function inn(game, s) {
    const w = game.world;
    const cost = Econ.innCost(w);
    const res = game.ui.rested;
    return h('div', { class: 'stack' },
      h('div', { class: 'row' }, h('h3', null, s.name || 'Rest'), UI.tip(`A room and a hot meal. Everyone's stamina is restored, wounds get a heal roll (two in town), and armor is partly repaired.${w.flags.inn_tab ? ' You are on the house tab: half price.' : ''}`)),
      h('div', { class: 'row' },
        h('button', { class: 'primary', disabled: w.gold < cost, onclick: async () => { const r = await G.Town.innRest(w); if (!r.ok) { toast(r.reason); return; } game.ui.rested = r.lines; game.save(); game.render(); } }, `Sleep until morning — ${cost} gold`)),
      res && res.length ? h('div', { class: 'gamelog' }, res.map((l) => h('p', { class: 'l' }, l))) : null);
  }

  const { itemLine, goodLine } = UI.Bits;
  const KIND_NAME = { weapon: 'Weapons', armor: 'Armor', shield: 'Shields', good: 'Goods' };

  // Standing with a service's faction: one chip, the explanation on hover.
  function standingChip(w, faction, explain) {
    return h('span', { class: 'chip', title: explain }, `${G.Factions.defs()[faction].name}: ${G.Factions.tier(w, faction).toLowerCase()}`);
  }

  function shop(game, s) {
    const w = game.world;
    const tab = game.ui['shop_' + s.id] || 'buy';
    const setTab = (t) => { game.ui['shop_' + s.id] = t; game.render(); };
    const tabs = [['buy', 'Buy'], ['sell', 'Sell']].concat(s.repair ? [['repair', 'Repair']] : []);
    let body, filter = null;
    if (tab === 'buy') {
      const all = Econ.stock(w, s);
      const kindOf = (e) => (e.spec.good ? 'good' : e.item.kind);
      const kinds = [...new Set(all.map(kindOf))];
      const key = 'shopKind_' + s.id;
      if (!kinds.includes(game.ui[key])) game.ui[key] = '';
      const stock = game.ui[key] ? all.filter((e) => kindOf(e) === game.ui[key]) : all;
      filter = kinds.length > 1 && all.length > 6 ? UI.select('shop-kind-' + s.id, game.ui[key], [['', `Everything (${all.length})`]].concat(kinds.map((k) => [k, `${KIND_NAME[k] || k} (${all.filter((e) => kindOf(e) === k).length})`])), (v) => { game.ui[key] = v; game.render(); }) : null;
      body = h('div', { class: 'ledger' }, stock.map((e) => {
        const g = e.spec.good ? G.World.goodDef(e.spec.good) : null;
        return h('div', { class: 'ledger-row' },
          g ? goodLine(e.name + (e.per > 1 ? ` ×${e.per}` : ''), g) : itemLine(e.item),
          h('span', { class: 'num' }, `${e.price} ◈`),
          h('button', { class: 'small', disabled: w.gold < e.price, onclick: () => { const r = Econ.buy(w, s, e); if (!r.ok) toast(r.reason); game.save(); game.render(); } }, 'Buy'));
      }));
    } else if (tab === 'sell') {
      const rows = [];
      for (const it of w.pack.gear) {
        if (!Econ.canSell(s, it.kind)) continue;
        const price = Econ.sellPrice(w, Econ.value(it), s);
        rows.push(h('div', { class: 'ledger-row' }, itemLine(it), h('span', { class: 'num' }, `${price} ◈`), h('button', { class: 'small', onclick: () => { Econ.sellItem(w, it, s); game.save(); game.render(); } }, 'Sell')));
      }
      if (Econ.canSell(s, 'good')) {
        const ids = Object.keys(w.pack.goods).concat(['bandage', 'arrows', 'bodkin_arrows'].filter(() => false));
        for (const id of ids) {
          const g = G.World.goodDef(id);
          if (!g || g.kind === 'key') continue;
          const price = Econ.sellPrice(w, Econ.goodValue(id), s);
          rows.push(h('div', { class: 'ledger-row' }, goodLine(`${g.name} ×${w.pack.goods[id]}`, g), h('span', { class: 'num' }, `${price} ◈`), h('button', { class: 'small', onclick: () => { Econ.sellGood(w, id, s); game.save(); game.render(); } }, 'Sell one')));
        }
      }
      body = rows.length ? h('div', { class: 'ledger' }, rows) : h('p', { class: 'muted row' }, 'Nothing here they will buy.', UI.tip('Worn gear is not for sale: take it off first, on the sheet.'));
    } else {
      const rows = [];
      const all = [];
      for (const c of World.party(w)) { for (const p of G.Character.armorPieces(c)) all.push([c.name, p]); if (c.shield) all.push([c.name, c.shield]); for (const x of c.weapons) all.push([c.name, x]); }
      for (const it of w.pack.gear) if (it.kind === 'armor' || it.kind === 'shield' || it.kind === 'weapon') all.push(['Pack', it]);
      for (const [who, it] of all) {
        const cost = Econ.repairCost(w, it, s);
        if (!cost) continue;
        rows.push(h('div', { class: 'ledger-row' }, itemLine(it, who), h('span', { class: 'num' }, `${cost} ◈`), h('button', { class: 'small', disabled: w.gold < cost, onclick: () => { Econ.repair(w, it, s); game.save(); game.render(); } }, 'Repair')));
      }
      body = rows.length ? h('div', { class: 'ledger' }, rows) : h('p', { class: 'muted' }, 'Everything is in order.');
    }
    return h('div', { class: 'stack' },
      h('div', { class: 'row spread' }, h('h3', null, s.name), h('span', { class: 'row' }, s.faction ? standingChip(w, s.faction, 'Prices follow your standing, and better stock opens as it rises.') : null, h('span', { class: 'gold num' }, `◈ ${w.gold}`))),
      h('div', { class: 'row spread shop-bar' }, h('div', { class: 'tabs' }, tabs.map(([id, label]) => h('button', { class: `tab ${tab === id ? 'active' : ''}`, onclick: () => setTab(id) }, label))), filter),
      body);
  }

  function healer(game, s) {
    const w = game.world;
    return h('div', { class: 'stack' },
      h('div', { class: 'row spread' }, h('h3', null, s.name), s.faction ? standingChip(w, s.faction, 'Friends are tended cheaper (Friendly, standing 25+: 30% off; Revered: free), and only friends are raised from the dead.') : null),
      h('div', { class: 'ledger' }, World.party(w).map((c) => {
        const dead = c.status.dead;
        const cost = dead ? Econ.raiseCost(c) : Econ.healCost(w, c, s);
        const hurt = C.totalDamage(c) || c.bleeds.length || c.stamina < C.maxStamina(c);
        return h('div', { class: 'ledger-row' },
          h('span', { class: 'row' }, UI.Art.portrait(c, 36), h('span', { class: 'stack tight' }, h('b', null, c.name), h('span', { class: 'small muted' }, dead ? 'Dead' : C.totalDamage(c) ? `−${C.totalDamage(c)} attributes` : hurt ? 'Tired' : 'Well'))),
          h('span', { class: 'num' }, dead || hurt ? `${cost} ◈` : ''),
          dead ? h('button', { class: 'small', disabled: w.gold < cost, onclick: () => { const r = G.Town.raise(w, c, s); toast(r.ok ? `${c.name} breathes.` : r.reason); game.save(); game.render(); } }, 'Raise')
            : h('button', { class: 'small', disabled: !hurt || w.gold < cost, onclick: () => { const r = G.Town.heal(w, c, s); if (!r.ok) toast(r.reason); game.save(); game.render(); } }, 'Tend'));
      })));
  }

  function bounty(game, s) {
    const w = game.world;
    const n = G.Town.bountyDue(w);
    const B = G.Town.bountyCfg();
    const payer = (G.Factions.defs()[B.payer] || {}).name || 'The payer';
    const st = B.payer ? G.Factions.standing(w, B.payer) : 0;
    return h('div', { class: 'stack' },
      h('div', { class: 'row' }, h('h3', null, s.name), UI.tip(`${payer} pays ${B.gold} gold for each outlaw who dies by your hand (friends only, standing ${B.minStanding}).`)),
      h('div', { class: 'row spread' }, h('span', null, `${n} outlaw${n === 1 ? '' : 's'} on the list`),
        h('button', { class: 'primary', disabled: !n || st < B.minStanding, onclick: () => { const r = G.Town.collectBounty(w); toast(r.ok ? `+${r.gold} gold` : r.reason); game.save(); game.render(); } }, 'Collect')),
      st < B.minStanding && n ? h('p', { class: 'small muted' }, `Your standing with ${payer} is ${st}.`) : null);
  }

  // ---- The Training Yard ----------------------------------------------------------------------------------------
  // Also the camp's training (overlays.js): opts.camp prices it as rules.yaml game.campTraining says.
  function trainer(game, s, opts) {
    const w = game.world;
    const camp = opts && opts.camp ? { camp: true } : null;
    const members = World.party(w).filter((c) => !c.status.dead);
    const cur = (game.ui.trainer && w.chars[game.ui.trainer]) || members[0];
    if (!cur) return h('p', null, 'No one is fit to train.');
    const left = C.featBudget(cur) - C.featCount(cur);
    const dbg = game.debug;
    const trees = C.TREES.map((t) => ({ t, feats: Object.values(G.DATA.FEATS).filter((f) => f.tree === t.id && (f.auto || dbg)) })).filter((x) => x.feats.length);
    if (!trees.some((x) => x.t.id === game.ui.trainTree)) game.ui.trainTree = trees[0] && trees[0].t.id;
    const tree = trees.find((x) => x.t.id === game.ui.trainTree);
    const pick = (label, el) => h('label', { class: 'pick' }, h('span', { class: 'label' }, label), el);
    return h('div', { class: 'stack' },
      h('div', { class: 'row spread' }, h('div', { class: 'row' }, h('h3', null, s.name), UI.tip(camp ? 'Levels give feats. At camp you drill what you have seen and read, for the same price in gear and supplies as a teacher would ask. Each costs more the higher the rank.' : 'Levels give feats; feats are taught here, or practised at camp, for a price. Each costs more the higher the rank.')), h('span', { class: 'gold num' }, `◈ ${w.gold}`)),
      h('div', { class: 'row train-bar' },
        pick('Who', UI.select('train-who', cur.id, members.map((c) => [c.id, `${c.name} · L${c.level} · ${C.featBudget(c) - C.featCount(c)} to spend`]), (v) => { game.ui.trainer = v; game.render(); })),
        pick('Feats', UI.select('train-tree', game.ui.trainTree, trees.map(({ t, feats }) => [t.id, `${t.name} (${feats.filter((f) => C.rank(cur, f.id)).length}/${feats.length})`]), (v) => { game.ui.trainTree = v; game.render(); }))),
      h('div', { class: 'row small muted' }, `${C.featCount(cur)} of ${C.featBudget(cur)} feats`, left <= 0 ? ` · next level at ${G.World.xpFor(cur.level + 1)} XP (has ${cur.xp || 0})` : ` · ${left} to spend`, tree ? h('span', { class: 'chip' }, tree.t.attrs) : null),
      tree ? h('div', { class: 'ledger' }, tree.feats.map((f) => {
        const rk = C.rank(cur, f.id);
        const tr = G.Town.trainable(cur, f.id, camp);
        const full = rk >= f.ranks.length;
        return h('div', { class: 'ledger-row feat-row' },
          h('span', { class: 'row' }, h('b', null, f.name), h('span', { class: 'muted small' }, f.ranks.map((r, i) => (i < rk ? '●' : '○')).join('')), UI.tip(f.effect, f.name)),
          h('span'),
          full ? h('span', { class: 'chip ok' }, 'Mastered') : tr.ok ? h('button', { class: 'small', disabled: w.gold < tr.cost || left <= 0, onclick: () => { const r = G.Town.train(w, cur, f.id, camp); if (!r.ok) toast(r.reason); game.save(); game.render(); } }, `Train — ${tr.cost} ◈`)
            : dbg ? h('button', { class: 'small', onclick: () => { G.Town.train(w, cur, f.id, { bench: true, free: true }); game.render(); } }, 'Grant (debug)') : h('span', { class: 'small muted', title: tr.reason }, 'Locked'));
      })) : null);
  }

  UI.Bits.trainer = trainer;

  UI.Screens.town = function (game) {
    const w = game.world;
    let p = place(game);
    if (!p || p.kind !== 'town') {
      // Not in a town (a loaded or teleported game): go where we should be.
      if (w.explore) { game.go('explore'); return h('div'); }
      w.place = G.Content.world.start.place;
      p = place(game);
    }
    const loc = game.ui.loc ? p.locations.find((l) => l.id === game.ui.loc) : null;
    return h('div', { class: 'town stack' },
      UI.Bits.topBar(game),
      h('div', { class: 'town-main' },
        h('div', { class: 'town-view' }, loc ? location(game, loc) : street(game)),
        h('aside', { class: 'stack side' }, h('h3', null, 'Company'), UI.Bits.partyStrip(game), UI.Bits.logPanel(game, 8))));
  };
})(globalThis.BBB);
