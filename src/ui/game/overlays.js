/* Overlays: the character sheet with its paper doll, the pack, journal, standing, menu, map and notices. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, bar, toast } = UI;
  const C = G.Character;
  const World = G.World;
  const Items = G.Items;
  const Equip = G.Equip;

  UI.Overlays = UI.Overlays || {};

  const shell = (title, body, close, wide) => h('div', { class: `modal game-modal ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true', onclick: (e) => e.stopPropagation() },
    h('div', { class: 'row spread' }, h('h2', null, title), UI.ibtn('close', 'Close', close, { size: 14 })), body);

  // ---- Pack ------------------------------------------------------------------------------------------------------------
  UI.Overlays.pack = function (game, o) {
    const w = game.world;
    const members = World.living(w);
    const target = o.target && w.chars[o.target] ? o.target : (members[0] && members[0].id);
    const tc = w.chars[target];
    const close = () => game.closeOverlay();
    const S = w.supplies;
    const goodRows = Object.entries(w.pack.goods).map(([id, n]) => {
      const g = World.goodDef(id);
      const usable = g.kind === 'potion' || g.kind === 'book' || (g.kind === 'supply' && g.use);
      return h('div', { class: 'ledger-row' }, UI.Bits.goodLine(`${g.name}${n > 1 ? ' ×' + n : ''}`, g),
        g.kind === 'trinket' ? h('span', { class: 'small muted', title: 'Put it on from a worn slot on the character sheet' }, 'worn') : usable ? h('button', { class: 'small', onclick: () => { const r = G.Town.useGood(w, id, tc); toast(r.ok ? r.lines[0] || 'Done' : r.reason); game.save(); game.openOverlay('pack', o); game.render(); } }, 'Use on ' + tc.name) : null);
    });
    const useSupply = ['repair_kit'].filter((id) => World.goodCount(w, id) > 0).map((id) => {
      const g = World.goodDef(id);
      return h('div', { class: 'ledger-row' }, UI.Bits.goodLine(`${g.name} ×${World.goodCount(w, id)}`, g), h('button', { class: 'small', onclick: () => { const r = G.Town.useGood(w, id, tc); toast(r.ok ? r.lines[0] : r.reason); game.save(); game.openOverlay('pack', o); game.render(); } }, 'Use on ' + tc.name));
    });
    const equipTo = (it) => {
      // An armor piece takes every slot it covers at once: one button.
      const slots = it.kind === 'armor' ? Equip.fits(it).slice(0, 1) : Equip.fits(it);
      return h('div', { class: 'row' }, slots.map((s) => h('button', { class: 'small', disabled: !Equip.canEquip(tc, it, s).ok, onclick: () => { const r = Equip.equip(w, tc, it, s); if (!r.ok) toast(r.reason); game.save(); game.openOverlay('pack', o); game.render(); } }, `${Equip.slotList().find((x) => x[0] === s)[1]}`)));
    };
    const gear = w.pack.gear.map((it) => h('div', { class: 'ledger-row' }, UI.Bits.itemLine(it), equipTo(it)));
    const comps = Object.entries(S.components).filter(([, n]) => n > 0).map(([id, n]) => `${World.goodDef(id).name} ×${n}`);
    return shell('Pack', h('div', { class: 'stack' },
      h('div', { class: 'row spread' }, h('span', { class: 'gold num big' }, `◈ ${w.gold}`),
        h('label', { class: 'inline' }, h('span', { class: 'label' }, 'For'), h('select', { 'aria-label': 'Character', onchange: (e) => { o.target = e.target.value; game.openOverlay('pack', o); } }, members.map((m) => h('option', { value: m.id, selected: m.id === target }, m.name))))),
      h('section', { class: 'stack tight' }, h('div', { class: 'row' }, h('h3', null, 'Supplies'), UI.tip('Shared, and dealt out when a fight starts. Archers get the arrows.')),
        h('p', null, `${S.bandages} bandages · ${S.arrows} arrows · ${S.bodkins} bodkin heads`), comps.length ? h('p', { class: 'small muted' }, comps.join(', ')) : null),
      gear.length ? h('section', { class: 'stack tight' }, h('h3', null, 'Spare gear'), gear) : null,
      goodRows.length || useSupply.length ? h('section', { class: 'stack tight' }, h('h3', null, 'Goods'), useSupply, goodRows) : null,
      !gear.length && !goodRows.length ? h('p', { class: 'muted' }, 'Nothing else in the pack.') : null), close, true);
  };

  // ---- Journal -----------------------------------------------------------------------------------------------------------
  function learned(w) {
    const out = [];
    for (const [nid, n] of Object.entries(G.Content.world.npcs)) {
      for (const t of n.topics || []) {
        if (t.kind !== 'info' && !(t.sets && t.sets.length)) continue;
        const ps = w.npcs[nid];
        const known = (t.sets || []).length ? t.sets.every((f) => w.flags[f]) : false;
        if (known) out.push({ who: n.name, label: t.label, text: t.text });
      }
    }
    return out;
  }

  UI.Overlays.journal = function (game, o) {
    const w = game.world;
    const tab = o.tab || 'quests';
    const Q = G.Content.world.quests;
    const close = () => game.closeOverlay();
    const quests = Object.entries(w.quests);
    const q = (filter) => quests.filter(([, st]) => filter(st));
    const questView = ([id, st]) => {
      const d = Q[id];
      return h('div', { class: 'quest' }, h('b', null, d.name), h('p', { class: 'small muted' }, d.summary),
        st.done ? h('p', { class: 'small' }, '✓ Complete') : st.failed ? h('p', { class: 'small', style: { color: 'var(--warn)' } }, 'Closed: you took the other side.') : h('p', { class: 'small' }, '→ ' + d.stages[st.stage].text),
        !st.done && !st.failed && d.reward ? h('p', { class: 'small muted' }, 'Reward: ' + [d.reward.gold ? d.reward.gold + ' gold' : null, d.reward.xp ? d.reward.xp + ' XP' : null].filter(Boolean).join(', ')) : null);
    };
    const tabBtn = (id, label) => h('button', { class: `tab ${tab === id ? 'active' : ''}`, onclick: () => { o.tab = id; game.openOverlay('journal', o); } }, label);
    let body;
    if (tab === 'quests') {
      const active = q((s) => !s.done && !s.failed), done = q((s) => s.done), failed = q((s) => s.failed);
      body = h('div', { class: 'stack' }, active.length ? active.map(questView) : h('p', { class: 'muted' }, 'No open quests. People in town have work, if they like you enough.'),
        done.length ? h('details', null, h('summary', null, `Completed (${done.length})`), done.map(questView)) : null,
        failed.length ? h('details', null, h('summary', null, `Closed (${failed.length})`), failed.map(questView)) : null);
    } else if (tab === 'known') {
      const k = learned(w);
      body = k.length ? h('div', { class: 'stack' }, k.map((x) => h('div', { class: 'quest' }, h('b', null, x.who), h('p', { class: 'small muted' }, x.label), h('p', { class: 'small' }, x.text)))) : h('p', { class: 'muted' }, 'Nothing learned yet. Knowledge is power here: ask around.');
    } else {
      body = h('div', { class: 'gamelog tall' }, w.log.slice(-80).reverse().map((l) => h('p', { class: 'l ' + l.cls }, `Day ${l.day}: ${l.text}`)));
    }
    return shell('Journal', h('div', { class: 'stack' }, h('div', { class: 'tabs' }, tabBtn('quests', 'Quests'), tabBtn('known', 'What you know'), tabBtn('log', 'Log')), body), close);
  };

  // ---- Standing --------------------------------------------------------------------------------------------------------------
  UI.Overlays.factions = function (game) {
    const w = game.world;
    const defs = G.Factions.defs();
    const close = () => game.closeOverlay();
    const track = (v) => h('div', { class: 'track wide' }, h('span', { class: 'mark', style: { left: ((v + 100) / 2) + '%' } }), h('span', { class: 'zero' }));
    const rep = (label, v, hint) => h('div', { class: 'stack tight' }, h('div', { class: 'row spread' }, h('b', { title: hint }, label), h('span', { class: 'num' }, v)), bar(v, 100));
    return shell('Standing', h('div', { class: 'stack' },
      h('div', { class: 'grid-2' },
        rep('Renown', w.rep.renown, 'Your good name. Moral and starstruck people respond to it.'),
        rep('Notoriety', w.rep.notoriety, 'Your name for violence. The fearful yield to it; the moral shun it.')),
      Object.entries(defs).filter(([id]) => id !== 'wilds').map(([id, f]) => {
        const v = G.Factions.standing(w, id);
        return h('div', { class: 'faction panel stack tight' },
          h('div', { class: 'row spread' }, h('b', { title: [f.blurb, (f.allies || []).length ? 'Friends: ' + f.allies.map((a) => defs[a].name).join(', ') : null, (f.enemies || []).length ? 'Foes: ' + f.enemies.map((a) => defs[a].name).join(', ') : null].filter(Boolean).join('\n') }, f.name), h('span', { class: 'chip' }, `${G.Factions.tier(w, id)} · ${v > 0 ? '+' : ''}${v}`)),
          track(v),
          G.Factions.rank(w, id) ? h('p', { class: 'small' }, 'Rank: ' + G.Factions.rank(w, id)) : null,
          (f.perks || []).length ? h('div', { class: 'small stack tight' }, f.perks.map(([min, text]) => h('span', { style: { opacity: v >= min ? 1 : 0.5 } }, `${v >= min ? '✓' : '○'} ${text} (${min}+)`))) : null);
      })), close, true);
  };

  // ---- Menu ------------------------------------------------------------------------------------------------------------------------
  function download(name, text) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
  }

  UI.Overlays.menu = function (game, o) {
    const w = game.world;
    const close = () => game.closeOverlay();
    const slots = G.Save.list().filter((s) => ['1', '2', '3'].includes(s.slot));
    return shell('Menu', h('div', { class: 'stack' },
      h('section', { class: 'stack tight' }, h('h3', null, 'Save'),
        slots.map((s) => h('div', { class: 'row spread' }, h('span', null, `Slot ${s.slot}: ${s.info ? s.info.place + ', day ' + s.info.day : 'empty'}`),
          h('button', { class: 'small', onclick: () => { toast(G.Save.write(s.slot, w) ? 'Saved' : 'Could not save'); game.openOverlay('menu'); } }, 'Save here'))),
        h('p', { class: 'small muted' }, 'The game also saves itself as you go (the autosave slot, and one before each fight).')),
      h('section', { class: 'stack tight' }, h('h3', null, 'Keep a copy'),
        h('div', { class: 'row' }, h('button', { onclick: () => download(`bbb-day${w.day}.json`, G.Save.serialize(w)) }, 'Export save file'))),
      h('section', { class: 'stack tight' }, h('h3', null, 'Other'),
        h('div', { class: 'row' },
          h('button', { onclick: () => { game.save(); game.closeOverlay(); game.go('title'); } }, 'Save and go to title'),
          h('a', { class: 'button', href: 'bench.html' }, 'Test bench'),
          h('button', { class: game.debug ? 'selected' : '', onclick: () => { game.debug = !game.debug; try { localStorage.setItem('bbb-debug', game.debug ? '1' : ''); } catch (e) { /* none */ } game.openOverlay('menu'); toast(game.debug ? 'Debug tools on' : 'Debug tools off'); } }, game.debug ? 'Debug tools: on' : 'Debug tools: off')),
        game.debug ? debugTools(game) : null)), close);
  };

  function debugTools(game) {
    const w = game.world;
    const places = G.Content.world.places;
    const items = Object.keys(G.Content.world.items.goods);
    const refresh = () => { game.save(); game.render(); game.openOverlay('menu'); };
    return h('div', { class: 'panel stack tight debug' },
      h('b', null, 'Debug'),
      h('div', { class: 'row' },
        h('button', { class: 'small', onclick: () => { w.gold += 500; refresh(); } }, '+500 gold'),
        h('button', { class: 'small', onclick: () => { World.grantXP(w, 200); refresh(); } }, '+200 XP'),
        h('button', { class: 'small', onclick: () => { for (const c of World.living(w)) { c.stamina = C.maxStamina(c); for (const a of G.CONFIG.attributes) c.damage[a] = 0; c.bleeds = []; c.status = C.freshStatus(); } refresh(); } }, 'Heal all'),
        h('button', { class: w.peaceful ? 'small selected' : 'small', title: 'Foes ignore the party and can be walked through; traps do not spring; no one comes while you camp', onclick: () => { w.peaceful = !w.peaceful; toast(w.peaceful ? 'No fights: foes and traps leave you alone' : 'Fights back on'); refresh(); } }, w.peaceful ? 'No fights: on' : 'No fights: off'),
        h('button', { class: 'small', onclick: () => { if (w.explore) { const ms = World.mapState(w, w.place); const g = G.Explore.here(w); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) ms.seen[x + ',' + y] = 1; } refresh(); } }, 'Reveal map')),
      h('div', { class: 'row' },
        h('select', { id: 'dbg-place', 'aria-label': 'Go to' }, Object.entries(places).map(([id, p]) => h('option', { value: id }, p.name))),
        h('button', { class: 'small', onclick: () => { const id = document.getElementById('dbg-place').value; if (places[id].kind === 'town') { G.Explore.leave(w, id); game.closeOverlay(); game.go('town'); } else { G.Explore.enter(w, id, '<'); game.closeOverlay(); game.go('explore'); } } }, 'Teleport')),
      h('div', { class: 'row' },
        h('select', { id: 'dbg-item', 'aria-label': 'Item' }, items.map((id) => h('option', { value: id }, G.World.goodDef(id).name))),
        h('button', { class: 'small', onclick: () => { World.addGood(w, document.getElementById('dbg-item').value, 1); refresh(); } }, 'Give')),
      h('div', { class: 'row' },
        h('select', { id: 'dbg-fac', 'aria-label': 'Faction' }, Object.entries(G.Factions.defs()).map(([id, f]) => h('option', { value: id }, f.name))),
        h('button', { class: 'small', onclick: () => { G.Factions.change(w, document.getElementById('dbg-fac').value, 20); refresh(); } }, '+20'),
        h('button', { class: 'small', onclick: () => { G.Factions.change(w, document.getElementById('dbg-fac').value, -20); refresh(); } }, '−20')),
      h('div', { class: 'row' },
        h('select', { id: 'dbg-mon', 'aria-label': 'Monster' }, Object.entries(G.Enemies.MONSTERS).map(([id, m]) => h('option', { value: id }, m.name))),
        h('button', { class: 'small', onclick: () => { const id = document.getElementById('dbg-mon').value; game.closeOverlay(); game.startBattle({ name: 'Test fight', foes: [{ monster: id }] }); } }, 'Fight it'),
        h('button', { class: 'small', onclick: async () => { const id = document.getElementById('dbg-mon').value; G.Battle.start(w, { name: 'Test fight', foes: [{ monster: id }] }); await G.Auto.battle(w); const r = G.Battle.finish(w); toast(r.result); refresh(); } }, 'Auto-resolve')));
  }

  // ---- Map, text, loot ---------------------------------------------------------------------------------------------------------------------
  UI.Overlays.map = function (game) {
    const close = () => game.closeOverlay();
    const w = game.world;
    if (!w.explore) return shell('Map', h('p', { class: 'muted' }, 'There is no map of the town. Ask around.'), close);
    const g = G.Explore.here(w), ms = World.mapState(w, w.place), ex = w.explore;
    const mv = UI.MapView.create({ cols: g.w, rows: g.h, scale: 2, label: 'Map of what you have seen', scene: () => ({
      w: g.w, h: g.h, origin: { x: 0, y: 0 }, cell: (x, y) => G.Explore.peek(w, x, y), seen: (x, y) => !!ms.seen[x + ',' + y],
      actors: [Object.assign({ id: 'me', x: ex.x, y: ex.y, size: 1 }, UI.Sprites.look(World.active(w)[0]), { size: 1, ring: 'rgba(255,255,255,0.85)' })], marks: [], hoverable: false }) });
    mv.start();
    return shell(G.Explore.place(w).name, h('div', { class: 'stack' }, h('div', { class: 'mapfull' }, mv.el), h('p', { class: 'small muted' }, 'What you have seen, as you saw it. The ring is your party.')), close, true);
  };

  // o.actions: extra buttons [{label, onclick}] beside Close (the camp's Train).
  UI.Overlays.text = function (game, o) {
    const close = () => game.closeOverlay();
    return shell(o.title || '', h('div', { class: 'stack' }, String(o.text).split('\n').map((p) => h('p', null, p)),
      h('div', { class: 'row' }, (o.actions || []).map((a) => h('button', { onclick: a.onclick }, a.label)), h('button', { class: 'primary', onclick: close }, 'Close'))), close);
  };

  // Training at camp: the Training Yard's panel, priced for a camp.
  UI.Overlays.train = function (game) {
    const close = () => game.closeOverlay();
    return shell('Training at camp', h('div', { class: 'stack' }, UI.Bits.trainer(game, { name: 'Drill and practice' }, { camp: true }),
      h('button', { class: 'primary', onclick: close }, 'Done')), close);
  };

  UI.Overlays.loot = function (game, o) {
    const close = () => game.closeOverlay();
    return shell(o.title || 'You find', h('div', { class: 'stack' }, o.lines.length ? h('ul', { class: 'loot-list' }, o.lines.map((l) => h('li', null, l))) : h('p', { class: 'muted' }, 'Nothing but dust.'), h('button', { class: 'primary', onclick: close }, 'Take it')), close);
  };
})(globalThis.BBB);
