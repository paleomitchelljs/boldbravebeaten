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
    h('div', { class: 'row spread' }, h('h2', null, title), h('button', { class: 'small', onclick: close, 'aria-label': 'Close' }, 'Close')), body);

  // ---- Character sheet -----------------------------------------------------------------------------------
  const SLOT_LAYOUT = { left: ['shield', 'off', 'ring'], right: ['main', 'side', 'charm'], bottom: ['body'] };

  function slotButton(game, o, c, slot) {
    const label = Equip.SLOTS.find((s) => s[0] === slot)[1];
    const it = Equip.itemIn(c, slot);
    const name = it ? (it.kind === 'weapon' || it.kind === 'armor' || it.kind === 'shield' ? Items.itemName(it) : it.name) : '—';
    return h('button', { class: `slot-btn ${o.pick === slot ? 'selected' : ''} ${it ? 'filled' : ''}`, onclick: () => { o.pick = o.pick === slot ? null : slot; game.openOverlay('sheet', o); }, title: it ? Equip.describe(it) || name : 'Empty' },
      h('span', { class: 'label' }, label), h('span', { class: 'nm' }, name));
  }

  function pickerFor(game, o, c) {
    const w = game.world;
    const slot = o.pick;
    const cur = Equip.itemIn(c, slot);
    const close = () => { o.pick = null; game.openOverlay('sheet', o); };
    const rows = [];
    if (slot === 'ring' || slot === 'charm') {
      for (const [id, n] of Object.entries(w.pack.goods)) {
        const g = World.goodDef(id);
        if (!g || g.kind !== 'trinket' || g.slot !== slot) continue;
        rows.push(h('div', { class: 'ledger-row' }, h('span', { class: 'stack tight' }, h('b', null, g.name), h('span', { class: 'small muted' }, g.blurb + (n > 1 ? ` (×${n})` : ''))),
          h('button', { class: 'small', onclick: () => { Equip.equipTrinket(w, c, id); game.save(); game.openOverlay('sheet', o); game.render(); } }, 'Wear')));
      }
    } else {
      for (const it of w.pack.gear) {
        if (!Equip.fits(it).includes(slot)) continue;
        const chk = Equip.canEquip(c, it, slot);
        rows.push(h('div', { class: 'ledger-row' }, h('span', { class: 'stack tight' }, h('b', null, Items.itemName(it)), h('span', { class: 'small muted' }, Equip.describe(it) + (chk.ok && chk.note ? ' — ' + chk.note : !chk.ok ? ' — ' + chk.reason : ''))),
          h('button', { class: 'small', disabled: !chk.ok, onclick: () => { const r = Equip.equip(w, c, it, slot); if (!r.ok) toast(r.reason); for (const l of r.lines || []) toast(l); game.save(); game.openOverlay('sheet', o); game.render(); } }, 'Equip')));
      }
    }
    return h('div', { class: 'picker stack tight' },
      h('div', { class: 'row spread' }, h('b', null, Equip.SLOTS.find((s) => s[0] === slot)[1]), h('button', { class: 'small', onclick: close }, 'Done')),
      cur ? h('div', { class: 'ledger-row' }, h('span', { class: 'stack tight' }, h('b', null, cur.kind ? Items.itemName(cur) : cur.name), h('span', { class: 'small muted' }, 'worn: ' + (Equip.describe(cur) || ''))),
        h('button', { class: 'small', onclick: () => { Equip.unequip(w, c, slot); game.save(); game.openOverlay('sheet', o); game.render(); } }, 'Take off')) : null,
      rows.length ? rows : h('p', { class: 'small muted' }, 'Nothing in the pack fits here.'));
  }

  function statsTab(c) {
    const max = C.maxStamina(c);
    const ai = C.armorInfo(c);
    const sh = c.shield ? Items.shieldStats(c.shield) : null;
    const attr = (a) => h('tr', null, h('th', { scope: 'row' }, a),
      h('td', { class: 'n' }, c.base[a]), h('td', { class: 'n' }, C.conditioning(c, a) ? '+' + C.conditioning(c, a) : '—'),
      h('td', { class: 'n' }, c.damage[a] ? '−' + c.damage[a] : '—'), h('td', { class: 'n' }, h('b', null, C.attr(c, a))));
    return h('div', { class: 'stack' },
      h('table', { class: 'data' }, h('thead', null, h('tr', null, ['Attribute', 'Base', 'Feats', 'Damage', 'Now'].map((t, i) => h('th', { class: i ? 'n' : '' }, t)))), h('tbody', null, G.CONFIG.attributes.map(attr))),
      h('div', { class: 'derived' }, [
        ['Stamina', `${c.stamina}/${max}`], ['Regen', (C.regen(c) >= 0 ? '+' : '') + C.regen(c)], ['AP', C.apPool(c)], ['Move', `${C.squaresPerAP(c)} sq`], ['Initiative', 'd10+' + C.combatAttr(c, 'SPD')], ['STR damage', (C.strBonus(c) >= 0 ? '+' : '') + C.strBonus(c)],
      ].map(([k, v]) => h('div', { class: 'd' }, h('span', { class: 'label' }, k), h('b', { class: 'num' }, v)))),
      bar(c.stamina, max),
      h('div', { class: 'small stack tight' },
        c.armor ? h('div', null, h('b', null, 'Armor '), Items.itemName(c.armor), ` · mitigation P${ai.effMit.P} S${ai.effMit.S} B${ai.effMit.B}`, ai.spd || ai.dex ? ` · SPD −${ai.spd} DEX −${ai.dex}` : '', ` · durability ${ai.durability}/${ai.maxDurability}`) : h('div', null, h('b', null, 'Armor '), 'none'),
        sh ? h('div', null, h('b', null, 'Shield '), Items.itemName(c.shield), ` · block ${sh.blockAP} AP · holds ${sh.threshold} · durability ${c.shield.durability}/${sh.maxDurability}`) : null,
        h('div', null, h('b', null, 'Bleeding '), c.bleeds.length ? `${C.bleedPerRound(c).toFixed(1)}/round` : 'none'),
        UI.Cards.statusChips(c).length ? h('div', { class: 'row' }, UI.Cards.statusChips(c)) : null),
      h('p', { class: 'small muted' }, 'CON is your life: 0 is death. Stamina is how long you can keep fighting: 0 is unconscious. Armor is how much of it you keep.'));
  }

  function featsTab(game, c) {
    const D = G.DATA;
    const owned = Object.keys(c.feats).filter((id) => D.FEATS[id]);
    const left = C.featBudget(c) - C.featCount(c);
    const inTown = game.world.place && G.Content.world.places[game.world.place].kind === 'town';
    return h('div', { class: 'stack' },
      h('div', { class: 'row spread' }, h('b', null, `${C.featCount(c)} of ${C.featBudget(c)} feats`), left > 0 ? h('span', { class: 'chip ok' }, `${left} to spend${inTown ? ' — see the Training Yard' : ' in town'}`) : null),
      h('div', { class: 'small muted' }, `Level ${c.level} · ${c.xp || 0} XP · next level at ${World.xpFor(c.level + 1)}`),
      owned.length ? owned.map((id) => { const f = D.FEATS[id]; return h('div', { class: 'feat-row' }, h('span', { class: 'stack tight' }, h('b', null, f.name + (f.ranks.length > 1 ? ' ' + C.roman(c.feats[id]) : '')), h('span', { class: 'small muted' }, f.effect)), f.auto ? null : h('span', { class: 'chip warn', title: 'Not yet implemented' }, 'no effect yet')); }) : h('p', { class: 'muted' }, 'No feats.'),
      (c.nouns || []).length ? h('div', { class: 'small' }, h('b', null, 'Words known: '), c.nouns.join(', ')) : null);
  }

  function skillsTab(c) {
    const defs = G.Skills.defs();
    return h('div', { class: 'stack tight' }, Object.entries(defs).map(([id, s]) => h('div', { class: 'feat-row' },
      h('span', { class: 'stack tight' }, h('b', null, s.name), h('span', { class: 'small muted' }, s.blurb)),
      h('span', { class: 'num' }, (G.Skills.mod(c, id) >= 0 ? '+' : '') + G.Skills.mod(c, id)))),
    h('p', { class: 'small muted' }, 'A check is d10 + this number against a target (easy 6, moderate 8, hard 11, formidable 14).'));
  }

  UI.Overlays.sheet = function (game, o) {
    const w = game.world;
    const members = World.party(w);
    const c = w.chars[o.id] || members[0];
    o.id = c.id;
    const tab = o.tab || 'stats';
    const close = () => game.closeOverlay();
    const tabBtn = (id, label) => h('button', { class: `tab ${tab === id ? 'active' : ''}`, onclick: () => { o.tab = id; game.openOverlay('sheet', o); } }, label);
    const inFight = !!w.battle;
    return shell(c.name, h('div', { class: 'stack' },
      h('div', { class: 'party-strip compact' }, members.map((m) => h('button', { class: `member ${m.id === c.id ? 'selected' : ''} ${m.status.dead ? 'down' : ''}`, onclick: () => { o.id = m.id; o.pick = null; game.openOverlay('sheet', o); } }, UI.Art.portrait(m, 34), h('span', { class: 'nm' }, m.name)))),
      h('div', { class: 'sheet-grid' },
        h('div', { class: 'stack doll-col' },
          h('div', { class: 'equip' },
            h('div', { class: 'slots left' }, SLOT_LAYOUT.left.map((s) => slotButton(game, o, c, s))),
            h('div', { class: 'doll-stage' }, UI.Art.paperDoll(c, { size: 340 })),
            h('div', { class: 'slots right' }, SLOT_LAYOUT.right.map((s) => slotButton(game, o, c, s)))),
          h('div', { class: 'slots bottom' }, SLOT_LAYOUT.bottom.map((s) => slotButton(game, o, c, s))),
          inFight ? h('p', { class: 'small muted' }, 'Changing gear mid-fight is not possible. Close this and keep fighting.') : null,
          o.pick && !inFight ? pickerFor(game, o, c) : null),
        h('div', { class: 'stack' },
          h('div', { class: 'tabs' }, tabBtn('stats', 'Stats'), tabBtn('feats', 'Feats'), tabBtn('skills', 'Skills'), tabBtn('notes', 'Notes')),
          tab === 'stats' ? statsTab(c) : tab === 'feats' ? featsTab(game, c) : tab === 'skills' ? skillsTab(c)
            : h('textarea', { 'aria-label': 'Notes', value: c.notes || '', placeholder: 'Notes about this character', onchange: (e) => { c.notes = e.target.value; game.save(); } })))), close, true);
  };

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
      return h('div', { class: 'ledger-row' }, h('span', { class: 'stack tight' }, h('b', null, `${g.name}${n > 1 ? ' ×' + n : ''}`), h('span', { class: 'small muted' }, g.blurb)),
        g.kind === 'trinket' ? h('span', { class: 'small muted' }, 'wear it on the sheet') : usable ? h('button', { class: 'small', onclick: () => { const r = G.Town.useGood(w, id, tc); toast(r.ok ? r.lines[0] || 'Done' : r.reason); game.save(); game.openOverlay('pack', o); game.render(); } }, 'Use on ' + tc.name) : null);
    });
    const useSupply = ['repair_kit'].filter((id) => World.goodCount(w, id) > 0).map((id) => {
      const g = World.goodDef(id);
      return h('div', { class: 'ledger-row' }, h('span', { class: 'stack tight' }, h('b', null, `${g.name} ×${World.goodCount(w, id)}`), h('span', { class: 'small muted' }, g.blurb)), h('button', { class: 'small', onclick: () => { const r = G.Town.useGood(w, id, tc); toast(r.ok ? r.lines[0] : r.reason); game.save(); game.openOverlay('pack', o); game.render(); } }, 'Use on ' + tc.name));
    });
    const equipTo = (it) => {
      const slots = Equip.fits(it);
      return h('div', { class: 'row' }, slots.map((s) => h('button', { class: 'small', disabled: !Equip.canEquip(tc, it, s).ok, onclick: () => { const r = Equip.equip(w, tc, it, s); if (!r.ok) toast(r.reason); game.save(); game.openOverlay('pack', o); game.render(); } }, `${Equip.SLOTS.find((x) => x[0] === s)[1]}`)));
    };
    const gear = w.pack.gear.map((it) => h('div', { class: 'ledger-row' }, h('span', { class: 'stack tight' }, h('b', null, Items.itemName(it)), h('span', { class: 'small muted' }, Equip.describe(it))), equipTo(it)));
    const comps = Object.entries(S.components).filter(([, n]) => n > 0).map(([id, n]) => `${World.goodDef(id).name} ×${n}`);
    return shell('Pack', h('div', { class: 'stack' },
      h('div', { class: 'row spread' }, h('span', { class: 'gold num big' }, `◈ ${w.gold}`),
        h('label', { class: 'inline' }, h('span', { class: 'label' }, 'For'), h('select', { 'aria-label': 'Character', onchange: (e) => { o.target = e.target.value; game.openOverlay('pack', o); } }, members.map((m) => h('option', { value: m.id, selected: m.id === target }, m.name))))),
      h('section', { class: 'stack tight' }, h('h3', null, 'Supplies'),
        h('p', null, `${S.bandages} bandages · ${S.arrows} arrows · ${S.bodkins} bodkin heads`), comps.length ? h('p', { class: 'small muted' }, comps.join(', ')) : null,
        h('p', { class: 'small muted' }, 'Supplies are shared and dealt out when a fight starts. Archers get the arrows.')),
      gear.length ? h('section', { class: 'stack tight' }, h('h3', null, 'Spare gear'), gear) : null,
      goodRows.length || useSupply.length ? h('section', { class: 'stack tight' }, h('h3', null, 'Goods'), useSupply, goodRows) : null,
      !gear.length && !goodRows.length ? h('p', { class: 'muted' }, 'Nothing else in the pack. Loot comes from the fallen, chests, and the people you help.') : null), close, true);
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
    const rep = (label, v, hint) => h('div', { class: 'stack tight' }, h('div', { class: 'row spread' }, h('b', null, label), h('span', { class: 'num' }, v)), bar(v, 100), h('span', { class: 'small muted' }, hint));
    return shell('Standing', h('div', { class: 'stack' },
      h('div', { class: 'grid-2' },
        rep('Renown', w.rep.renown, 'Your good name. Moral and starstruck people respond to it.'),
        rep('Notoriety', w.rep.notoriety, 'Your name for violence. The fearful yield to it; the moral shun it.')),
      Object.entries(defs).filter(([id]) => id !== 'wilds').map(([id, f]) => {
        const v = G.Factions.standing(w, id);
        return h('div', { class: 'faction panel stack tight' },
          h('div', { class: 'row spread' }, h('b', null, f.name), h('span', { class: 'chip' }, `${G.Factions.tier(w, id)} · ${v > 0 ? '+' : ''}${v}`)),
          h('p', { class: 'small muted' }, f.blurb),
          track(v),
          G.Factions.rank(w, id) ? h('p', { class: 'small' }, 'Rank: ' + G.Factions.rank(w, id)) : null,
          (f.perks || []).length ? h('div', { class: 'small stack tight' }, f.perks.map(([min, text]) => h('span', { style: { opacity: v >= min ? 1 : 0.5 } }, `${v >= min ? '✓' : '○'} ${text} (${min}+)`))) : null,
          h('p', { class: 'small muted' }, [(f.allies || []).length ? 'Friends: ' + f.allies.map((a) => defs[a].name).join(', ') : null, (f.enemies || []).length ? 'Foes: ' + f.enemies.map((a) => defs[a].name).join(', ') : null].filter(Boolean).join(' · ')));
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
    if (!game.world.explore) return shell('Map', h('p', { class: 'muted' }, 'There is no map of the town. Ask around.'), close);
    const cv = h('canvas', { class: 'mini big', width: 520, height: 520, role: 'img', 'aria-label': 'Map of what you have seen' });
    UI.FirstPerson.minimap(cv, game.world, { full: true });
    return shell(G.Explore.place(game.world).name, h('div', { class: 'stack' }, cv,
      h('p', { class: 'small muted' }, 'Green: you. Red: foes. Gold: chests. Blue: people. Pale: stairs. Orange: traps you have found. Brown: doors.')), close);
  };

  UI.Overlays.text = function (game, o) {
    const close = () => game.closeOverlay();
    return shell(o.title || '', h('div', { class: 'stack' }, String(o.text).split('\n').map((p) => h('p', null, p)), h('button', { class: 'primary', onclick: close }, 'Close')), close);
  };

  UI.Overlays.loot = function (game, o) {
    const close = () => game.closeOverlay();
    return shell(o.title || 'You find', h('div', { class: 'stack' }, o.lines.length ? h('ul', { class: 'loot-list' }, o.lines.map((l) => h('li', null, l))) : h('p', { class: 'muted' }, 'Nothing but dust.'), h('button', { class: 'primary', onclick: close }, 'Take it')), close);
  };
})(globalThis.BBB);
