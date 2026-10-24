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
    const ps = w.npcs[id];
    return h('div', { class: 'npc' },
      h('span', { class: 'glyph big' }, n.glyph || '🧍'),
      h('div', { class: 'stack tight grow' },
        h('b', null, n.name), h('span', { class: 'small muted' }, n.title),
        n.faction ? h('span', { class: 'small' }, `${G.Factions.defs()[n.faction].name} · you are ${G.Factions.tier(w, n.faction).toLowerCase()}`) : null,
        ps && ps.met ? null : h('span', { class: 'small muted' }, n.look)),
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
      h('h3', null, s.name || 'Rest'),
      h('p', { class: 'muted' }, `A room and a hot meal. Everyone's stamina is restored, wounds get a heal roll (two in town), and armor is partly repaired. ${w.flags.inn_tab ? 'Marta has you on her tab: half price.' : ''}`),
      h('div', { class: 'row' },
        h('button', { class: 'primary', disabled: w.gold < cost, onclick: async () => { const r = await G.Town.innRest(w); if (!r.ok) { toast(r.reason); return; } game.ui.rested = r.lines; game.save(); game.render(); } }, `Sleep until morning — ${cost} gold`)),
      res && res.length ? h('div', { class: 'gamelog' }, res.map((l) => h('p', { class: 'l' }, l))) : null);
  }

  function itemLine(item) {
    return h('span', { class: 'stack tight' }, h('b', null, Items.itemName(item)), h('span', { class: 'small muted' }, G.Equip.describe(item)));
  }

  function shop(game, s) {
    const w = game.world;
    const tab = game.ui['shop_' + s.id] || 'buy';
    const setTab = (t) => { game.ui['shop_' + s.id] = t; game.render(); };
    const tabs = [['buy', 'Buy'], ['sell', 'Sell']].concat(s.repair ? [['repair', 'Repair']] : []);
    let body;
    if (tab === 'buy') {
      const stock = Econ.stock(w, s);
      body = h('div', { class: 'ledger' }, stock.map((e) => {
        const g = e.spec.good ? G.World.goodDef(e.spec.good) : null;
        return h('div', { class: 'ledger-row' },
          g ? h('span', { class: 'stack tight' }, h('b', null, e.name + (e.per > 1 ? ` ×${e.per}` : '')), h('span', { class: 'small muted' }, g.blurb)) : itemLine(e.item),
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
          rows.push(h('div', { class: 'ledger-row' }, h('span', { class: 'stack tight' }, h('b', null, `${g.name} ×${w.pack.goods[id]}`), h('span', { class: 'small muted' }, g.blurb)), h('span', { class: 'num' }, `${price} ◈`), h('button', { class: 'small', onclick: () => { Econ.sellGood(w, id, s); game.save(); game.render(); } }, 'Sell one')));
        }
      }
      body = rows.length ? h('div', { class: 'ledger' }, rows) : h('p', { class: 'muted' }, 'Nothing in the pack that this trader will buy. (Worn gear is not for sale; take it off first.)');
    } else {
      const rows = [];
      const all = [];
      for (const c of World.party(w)) { for (const p of G.Character.armorPieces(c)) all.push([c.name, p]); if (c.shield) all.push([c.name, c.shield]); for (const x of c.weapons) all.push([c.name, x]); }
      for (const it of w.pack.gear) if (it.kind === 'armor' || it.kind === 'shield' || it.kind === 'weapon') all.push(['Pack', it]);
      for (const [who, it] of all) {
        const cost = Econ.repairCost(w, it, s);
        if (!cost) continue;
        rows.push(h('div', { class: 'ledger-row' }, h('span', { class: 'stack tight' }, h('b', null, Items.itemName(it)), h('span', { class: 'small muted' }, `${who} · ${G.Equip.describe(it)}`)), h('span', { class: 'num' }, `${cost} ◈`), h('button', { class: 'small', disabled: w.gold < cost, onclick: () => { Econ.repair(w, it, s); game.save(); game.render(); } }, 'Repair')));
      }
      body = rows.length ? h('div', { class: 'ledger' }, rows) : h('p', { class: 'muted' }, 'Everything is in order.');
    }
    return h('div', { class: 'stack' },
      h('div', { class: 'row spread' }, h('h3', null, s.name), h('span', { class: 'gold num' }, `◈ ${w.gold}`)),
      s.faction ? h('p', { class: 'small muted' }, `${G.Factions.defs()[s.faction].name}: you are ${G.Factions.tier(w, s.faction).toLowerCase()}. Prices follow your standing, and better stock opens as it rises.`) : null,
      h('div', { class: 'tabs' }, tabs.map(([id, label]) => h('button', { class: `tab ${tab === id ? 'active' : ''}`, onclick: () => setTab(id) }, label))),
      body);
  }

  function healer(game, s) {
    const w = game.world;
    return h('div', { class: 'stack' },
      h('h3', null, s.name),
      s.faction ? h('p', { class: 'small muted' }, `The Lantern tends friends cheaper (Friendly 25+: 30% off; Revered: free). It raises the dead only for those it counts as friends (standing 25). You are ${G.Factions.tier(w, s.faction).toLowerCase()}.`) : null,
      h('div', { class: 'ledger' }, World.party(w).map((c) => {
        const dead = c.status.dead;
        const cost = dead ? Econ.raiseCost(c) : Econ.healCost(w, c, s);
        const hurt = C.totalDamage(c) || c.bleeds.length || c.stamina < C.maxStamina(c);
        return h('div', { class: 'ledger-row' },
          h('span', { class: 'row' }, UI.Art.portrait(c, 36), h('span', { class: 'stack tight' }, h('b', null, c.name), h('span', { class: 'small muted' }, dead ? 'Dead' : C.totalDamage(c) ? `${C.totalDamage(c)} points of attribute damage` : hurt ? 'Tired' : 'Well'))),
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
      h('h3', null, s.name),
      h('p', { class: 'muted' }, `${payer} pays ${B.gold} gold for each outlaw who dies by your hand (friends only, standing ${B.minStanding}).`),
      h('div', { class: 'row spread' }, h('span', null, `${n} outlaw${n === 1 ? '' : 's'} on the list`),
        h('button', { class: 'primary', disabled: !n || st < B.minStanding, onclick: () => { const r = G.Town.collectBounty(w); toast(r.ok ? `+${r.gold} gold` : r.reason); game.save(); game.render(); } }, 'Collect')),
      st < B.minStanding && n ? h('p', { class: 'small muted' }, `Your standing with ${payer} is ${st}.`) : null);
  }

  // ---- The Training Yard ----------------------------------------------------------------------------------------
  function trainer(game, s) {
    const w = game.world;
    const members = World.party(w).filter((c) => !c.status.dead);
    const cur = (game.ui.trainer && w.chars[game.ui.trainer]) || members[0];
    if (!cur) return h('p', null, 'No one is fit to train.');
    const left = C.featBudget(cur) - C.featCount(cur);
    const dbg = game.debug;
    const trees = C.TREES.map((t) => ({ t, feats: Object.values(G.DATA.FEATS).filter((f) => f.tree === t.id && (f.auto || dbg)) })).filter((x) => x.feats.length);
    const open = game.ui.trainTree;
    return h('div', { class: 'stack' },
      h('h3', null, s.name),
      h('p', { class: 'muted' }, 'Levels give feats; feats are taught here, for a price, and only between adventures. Each costs more the higher the rank.'),
      h('div', { class: 'party-strip' }, members.map((c) => h('button', { class: `member ${c.id === cur.id ? 'selected' : ''}`, onclick: () => { game.ui.trainer = c.id; game.render(); } },
        UI.Art.portrait(c, 40), h('span', { class: 'stack tight' }, h('b', null, c.name), h('span', { class: 'small muted num' }, `L${c.level} · ${C.featBudget(c) - C.featCount(c)} to spend`))))),
      h('div', { class: 'row spread' }, h('b', null, `${cur.name}: ${C.featCount(cur)} of ${C.featBudget(cur)} feats`), h('span', { class: 'gold num' }, `◈ ${w.gold}`)),
      left <= 0 ? h('p', { class: 'small muted' }, `No feat to spend. The next level is at ${G.World.xpFor(cur.level + 1)} XP (you have ${cur.xp || 0}).`) : null,
      trees.map(({ t, feats }) => h('details', { class: 'feat-tree', open: open === t.id, ontoggle: (e) => { if (e.target.open) game.ui.trainTree = t.id; } },
        h('summary', null, h('span', null, t.name), h('span', { class: 'muted small' }, t.attrs)),
        h('div', { class: 'stack tight pad' }, feats.map((f) => {
          const rk = C.rank(cur, f.id);
          const tr = G.Town.trainable(cur, f.id);
          const full = rk >= f.ranks.length;
          return h('div', { class: 'feat-row' },
            h('span', { class: 'stack tight' },
              h('b', null, f.name, ' ', h('span', { class: 'muted small' }, f.ranks.map((r, i) => (i < rk ? '●' : '○')).join(''))),
              h('span', { class: 'small muted' }, f.effect)),
            full ? h('span', { class: 'chip ok' }, 'Mastered') : tr.ok ? h('button', { class: 'small', disabled: w.gold < tr.cost || left <= 0, onclick: () => { const r = G.Town.train(w, cur, f.id); if (!r.ok) toast(r.reason); game.save(); game.render(); } }, `Train — ${tr.cost} ◈`)
              : dbg ? h('button', { class: 'small', onclick: () => { G.Town.train(w, cur, f.id, { bench: true, free: true }); game.render(); } }, 'Grant (debug)') : h('span', { class: 'small muted' }, tr.reason));
        })))));
  }

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
