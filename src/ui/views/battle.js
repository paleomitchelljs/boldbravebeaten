/* Battle view: setup, the map, declarations, resolution, loot. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, num, bar, toast, initials } = UI;
  const C = G.Character;
  const Combat = G.Combat;
  const Items = G.Items;
  const D = G.DATA;

  function bui(app) {
    return app.ui.battle || (app.ui.battle = { mode: null, pending: null, placeSel: null, lootTo: '', removeDefeated: true });
  }

  function aiControlled(app, c) {
    return app.state.settings.aiEnemies && c.control === 'auto';
  }

  function occupantAt(enc, chars, x, y) {
    let best = null;
    for (const id of enc.ids) {
      const p = enc.pos[id];
      if (!p || p.x !== x || p.y !== y) continue;
      if (!best || (C.isActive(chars[id]) && !C.isActive(chars[best]))) best = id;
    }
    return best;
  }

  // ---- Setup -------------------------------------------------------------
  function setupView(app) {
    const s = app.state;
    const all = s.order.map((id) => s.characters[id]).filter((c) => !c.status.dead);
    const su = app.ui.battleSetup || (app.ui.battleSetup = {});
    if (!su.picked) {
      su.picked = {};
      all.forEach((c) => { if (C.isActive(c)) su.picked[c.id] = true; });
    }
    su.w = su.w || 10;
    su.h = su.h || 7;
    const picked = all.filter((c) => su.picked[c.id]);
    const sides = new Set(picked.map((c) => c.side));
    const row = (c) => h('label', { class: 'row small', for: 'pick-' + c.id, style: { gap: '8px' } },
      h('input', { id: 'pick-' + c.id, type: 'checkbox', checked: !!su.picked[c.id], onchange: (e) => { su.picked[c.id] = e.target.checked; app.render(); } }),
      h('span', { class: 'chip ' + (c.side === 'party' ? 'party' : 'enemy') }, 'L' + c.level),
      h('span', null, c.name), h('span', { class: 'muted' }, UI.Cards.gearLine(c)),
      !C.isActive(c) ? h('span', { class: 'chip bad' }, 'Unconscious') : null);
    return h('div', { class: 'stack', style: { gap: '20px' } },
      h('div', { class: 'view-head' }, h('div', { class: 'stack tight' }, h('h1', null, 'Battle'),
        h('p', { class: 'muted' }, 'Pick who fights, then place them on the grid. Each round, players declare one action at a time in initiative order and type in their own dice when asked; the platform does the arithmetic.'))),
      h('div', { class: 'grid-2' },
        h('section', { class: 'panel' }, h('h2', null, 'Party'), all.filter((c) => c.side === 'party').map(row)),
        h('section', { class: 'panel' },
          h('div', { class: 'panel-head' }, h('h2', null, 'Enemies'), h('button', { class: 'small', onclick: () => app.go('enemies') }, 'Generate more')),
          all.filter((c) => c.side !== 'party').length ? all.filter((c) => c.side !== 'party').map(row) : h('p', { class: 'muted small' }, 'No enemies on file yet.'))),
      h('section', { class: 'panel' },
        h('div', { class: 'row', style: { alignItems: 'end', gap: '14px' } },
          h('label', { class: 'field', for: 'grid-w' }, h('span', { class: 'label' }, 'Grid width'), num('grid-w', su.w, (v) => { su.w = Math.max(3, Math.min(20, Math.round(v))); app.render(); }, { min: 3, max: 20 })),
          h('label', { class: 'field', for: 'grid-h' }, h('span', { class: 'label' }, 'Grid height'), num('grid-h', su.h, (v) => { su.h = Math.max(2, Math.min(16, Math.round(v))); app.render(); }, { min: 2, max: 16 })),
          h('span', { class: 'small muted', style: { maxWidth: '40ch' } }, 'A narrow grid is a corridor: confined space favors armor. A wide one lets the quick escape and flank.'),
          h('button', { class: 'primary', disabled: sides.size < 2, onclick: () => {
            const enc = Combat.createEncounter('Battle', picked.map((c) => c.id), s.characters, su.w, su.h);
            s.encounter = enc;
            bui(app).mode = 'place';
            app.save(); app.render();
          } }, 'Set up the field')),
        sides.size < 2 ? h('p', { class: 'small muted' }, 'Pick at least one character from each side.') : null));
  }

  // ---- Map ---------------------------------------------------------------
  function mapView(app, enc, legal) {
    const chars = app.state.characters;
    const ui = bui(app);
    const actor = Combat.currentActor(enc);
    const ghosts = {};
    for (const d of enc.decls) if (d.type === 'move') ghosts[d.to.x + ',' + d.to.y] = true;
    const targets = {};
    if (ui.mode === 'target' && ui.pending) for (const t of ui.pending.targets) targets[t.id] = t;
    let reach = null;
    if (ui.mode === 'move' && legal && legal.move) {
      reach = {};
      const m = legal.move;
      const blocked = {};
      for (const id of enc.ids) {
        if (id === actor || !C.isActive(chars[id])) continue;
        const p = Combat.projectedPos(enc, id);
        blocked[p.x + ',' + p.y] = true;
      }
      for (let y = 0; y < enc.grid.h; y++) for (let x = 0; x < enc.grid.w; x++) {
        const d = Combat.dist(m.from, { x, y });
        const need = C.moveCost(app.state.characters[actor], d);
        if (d > 0 && need <= m.maxAP && !blocked[x + ',' + y]) reach[x + ',' + y] = need;
      }
    }
    const cells = [];
    for (let y = 0; y < enc.grid.h; y++) {
      for (let x = 0; x < enc.grid.w; x++) {
        const id = occupantAt(enc, chars, x, y);
        const key = x + ',' + y;
        const c = id ? chars[id] : null;
        let token = null;
        if (c) {
          const cls = ['token', c.side === 'party' ? '' : 'enemy', C.isActive(c) ? '' : 'down', c.status.dead ? 'dead' : '', c.status.prone ? 'prone' : '',
            id === actor ? 'active' : '', targets[id] ? 'targetable' : '', ui.placeSel === id ? 'active' : ''].join(' ');
          token = h('span', { class: cls, title: c.name }, initials(c.name));
        }
        const canMove = reach && reach[key] != null;
        cells.push(h('button', {
          class: 'cell' + (canMove ? ' can-move' : '') + (ghosts[key] && !c ? ' ghost' : '') + (c ? ' has-token' : ''),
          'aria-label': c ? `${c.name} at ${x + 1}, ${y + 1}` : `Square ${x + 1}, ${y + 1}${canMove ? `, move for ${reach[key]} AP` : ''}`,
          onclick: () => cellClick(app, enc, legal, x, y, id, reach),
        }, token || (canMove ? reach[key] + ' AP' : '')));
      }
    }
    return h('div', { class: 'stack tight' },
      h('div', { class: 'map-wrap' }, h('div', { class: 'map', style: { gridTemplateColumns: `repeat(${enc.grid.w}, auto)` } }, cells)),
      h('div', { class: 'legend' },
        h('span', null, h('b', { style: { color: 'var(--party)' } }, '●'), ' party'),
        h('span', null, h('b', { style: { color: 'var(--enemy)' } }, '●'), ' enemy'),
        h('span', null, 'gold ring = acting now'),
        h('span', null, 'dashed circle = declared move'),
        ui.mode === 'place' ? h('span', null, h('b', null, 'Placing: '), 'click a token, then a square') : null));
  }

  function cellClick(app, enc, legal, x, y, id, reach) {
    const ui = bui(app);
    if (ui.mode === 'place') {
      if (id) ui.placeSel = ui.placeSel === id ? null : id;
      else if (ui.placeSel) { enc.pos[ui.placeSel] = { x, y }; ui.placeSel = null; app.save(); }
      app.render();
      return;
    }
    const actor = Combat.currentActor(enc);
    if (ui.mode === 'move' && reach && reach[x + ',' + y] != null) {
      declare(app, enc, { actor, type: 'move', to: { x, y } });
      return;
    }
    if (ui.mode === 'target' && id && ui.pending.targets.some((t) => t.id === id)) {
      finishTarget(app, enc, id);
    }
  }

  function finishTarget(app, enc, targetId) {
    const ui = bui(app);
    const actor = Combat.currentActor(enc);
    const p = ui.pending;
    if (p.kind === 'strike') declare(app, enc, { actor, type: 'strike', option: p.option, target: targetId });
    else declare(app, enc, { actor, type: p.type, target: targetId });
  }

  function declare(app, enc, decl) {
    const ui = bui(app);
    const err = Combat.declare(enc, app.state.characters, decl);
    if (err) { toast(err); return; }
    ui.mode = null;
    ui.pending = null;
    app.save();
    app.render();
  }

  // ---- Command panel -----------------------------------------------------
  function apMeter(start, left) {
    const out = [];
    for (let i = 0; i < start; i++) out.push(h('i', { class: i < left ? '' : 'spent' }));
    return h('span', { class: 'ap-meter', 'aria-label': `${left} of ${start} AP left` }, out);
  }

  function costText(ap, st) {
    return `${ap} AP · ${st} st`;
  }

  function declarePanel(app, enc, legal) {
    const chars = app.state.characters;
    const ui = bui(app);
    const id = Combat.currentActor(enc);
    const c = chars[id];

    if (aiControlled(app, c)) {
      return h('section', { class: 'panel cmd' },
        h('span', { class: 'label' }, `Pass ${enc.pass}`),
        h('div', { class: 'who' }, c.name),
        h('p', { class: 'muted' }, 'Deciding…'));
    }

    const pick = (pending) => {
      ui.pending = pending;
      ui.mode = 'target';
      app.render();
    };

    const sections = [];

    if (ui.mode === 'target' && ui.pending) {
      sections.push(h('div', { class: 'note' },
        h('div', { class: 'row spread' }, h('b', null, `Target for ${ui.pending.label}`), h('button', { class: 'small', onclick: () => { ui.mode = null; ui.pending = null; app.render(); } }, 'Cancel')),
        h('p', { class: 'small' }, 'Click a highlighted token on the map, or choose:'),
        h('div', { class: 'row', style: { marginTop: '6px' } }, ui.pending.targets.map((t) =>
          h('button', { class: 'small' + (t.inReach ? '' : ' ghost'), onclick: () => finishTarget(app, enc, t.id) }, chars[t.id].name + (t.distance != null ? ` · ${t.distance} sq` : '') + (t.inReach ? '' : t.tooClose ? ' (too close now)' : ' (out of reach now)'))))));
    }
    if (ui.mode === 'move') {
      sections.push(h('div', { class: 'note row spread' }, h('span', null, 'Click a highlighted square. The number is its AP cost.'),
        h('button', { class: 'small', onclick: () => { ui.mode = null; app.render(); } }, 'Cancel')));
    }

    if (legal.defenses.length) {
      sections.push(h('div', { class: 'stack tight' }, h('span', { class: 'label' }, 'Answer a strike'),
        legal.defenses.map((inc) => h('div', { class: 'stack tight' },
          h('div', { class: 'small' }, Combat.describeDecl(enc, chars, inc.decl, id).text),
          h('div', { class: 'row' }, inc.options.map((o) => h('button', {
            class: 'small', disabled: !o.affordable, title: o.why || '',
            onclick: () => declare(app, enc, { actor: id, type: o.type, answers: inc.decl.n }),
          }, `${D.ACTIONS[o.type].name} · ${costText(o.ap, o.stamina)}${o.why ? ' — ' + o.why : ''}`)))))));
    }

    const foes = new Set(enc.ids.filter((o) => chars[o].side !== c.side));
    const sortTargets = (ts) => ts.slice().sort((a, b) => (foes.has(b.id) - foes.has(a.id)) || (b.inReach - a.inReach));
    sections.push(h('div', { class: 'stack tight' }, h('span', { class: 'label' }, 'Attack'),
      h('div', { class: 'action-list' }, legal.attacks.map((o) => {
        const w = o.weaponId ? c.weapons.find((x) => x.id === o.weaponId) : null;
        const anyReach = o.targets.some((t) => t.inReach && foes.has(t.id));
        const range = (o.minRange === o.maxRange ? `range ${o.maxRange}` : `range ${o.minRange}–${o.maxRange}`) + (o.closePenalty ? ' (½ at 1)' : '');
        const dmg = o.spell ? `${o.spell.magnitude} ${o.spell.element} · ${o.spCost} SP` : `P/S/B ${o.damage.join('/')}`;
        return h('button', { class: 'action', disabled: !o.affordable, title: o.why || '', onclick: () => pick({ kind: 'strike', option: o, label: o.label, targets: sortTargets(o.targets) }) },
          h('span', null, o.label, w ? h('span', { class: 'muted' }, ' — ' + Items.itemName(w)) : null),
          h('span', { class: 'cost' }, costText(o.ap, o.stamina)),
          h('span', { class: 'meta' }, `${dmg} · ${range}${o.why ? ' · ' + o.why : anyReach ? '' : ' · no foe in range'}`));
      }))));

    if (legal.move || legal.maneuvers.length) {
      sections.push(h('div', { class: 'stack tight' }, h('span', { class: 'label' }, 'Move and maneuver'),
        h('div', { class: 'row' },
          legal.move ? h('button', { class: ui.mode === 'move' ? 'selected' : '', onclick: () => { ui.mode = 'move'; ui.pending = null; app.render(); } },
            `Move · up to ${legal.move.maxSquares} sq · ${legal.move.stamina} st`) : null,
          legal.maneuvers.map((m) => h('button', { disabled: !m.affordable, onclick: () => pick({ kind: 'maneuver', type: m.type, label: D.ACTIONS[m.type].name, targets: sortTargets(m.targets) }) },
            `${D.ACTIONS[m.type].name} · ${costText(m.ap, m.stamina)}`)))));
    }

    if (legal.other.length) {
      sections.push(h('div', { class: 'stack tight' }, h('span', { class: 'label' }, 'Other'),
        h('div', { class: 'row' }, legal.other.map((o) => h('button', {
          disabled: !o.affordable,
          title: o.why || '',
          onclick: () => (o.targets ? pick({ kind: 'other', type: o.type, label: o.name, targets: o.targets }) : declare(app, enc, { actor: id, type: o.type, option: o.option })),
        }, `${o.name} · ${costText(o.ap, o.stamina)}`)))));
    }

    return h('section', { class: 'panel cmd' },
      h('div', { class: 'row spread' },
        h('div', { class: 'stack tight' }, h('span', { class: 'label' }, `Round ${enc.round} · pass ${enc.pass} · your declaration`), h('div', { class: 'who' }, c.name)),
        h('div', { class: 'stack tight', style: { alignItems: 'flex-end' } },
          apMeter(enc.apStart[id], enc.ap[id]),
          h('span', { class: 'small num' }, `${enc.ap[id]} AP left · stamina ${c.stamina}/${C.maxStamina(c)}`))),
      h('p', { class: 'small muted' }, 'Your remaining AP is hidden from the other side. Pass the screen only after declaring.'),
      sections,
      h('div', { class: 'row spread' },
        h('span', { class: 'small muted' }, 'No holding: ending now forfeits the rest of your AP.'),
        h('button', { onclick: () => { Combat.concede(enc, id); ui.mode = null; ui.pending = null; app.save(); app.render(); } }, `End ${c.name.split(' ')[0]}'s round`)));
  }

  function phasePanel(app, enc) {
    const chars = app.state.characters;
    const ui = bui(app);
    const roller = UI.Dice.makeRoller(app);
    if (enc.phase === 'setup' || enc.phase === 'roundEnd') {
      return h('section', { class: 'panel cmd' },
        h('span', { class: 'label' }, enc.phase === 'setup' ? 'Ready' : `Round ${enc.round} done`),
        h('div', { class: 'who' }, `Round ${enc.round + 1}`),
        h('p', { class: 'muted small' }, enc.phase === 'setup' ? 'Click Move tokens to adjust starting positions: click a token, then a square.' : 'Adjust positions if the GM rules it, then roll initiative.'),
        h('div', { class: 'row' },
          h('button', { class: 'primary', onclick: async () => {
            ui.mode = null; ui.placeSel = null;
            await Combat.startRound(enc, chars, roller);
            app.save(); app.render();
          } }, 'Roll initiative'),
          h('button', { class: ui.mode === 'place' ? 'selected' : '', onclick: () => { ui.mode = ui.mode === 'place' ? null : 'place'; ui.placeSel = null; app.render(); } }, ui.mode === 'place' ? 'Done placing' : 'Move tokens')));
    }
    if (enc.phase === 'initiative') {
      return h('section', { class: 'panel cmd' }, h('span', { class: 'label' }, `Round ${enc.round}`), h('div', { class: 'who' }, 'Rolling initiative'),
        h('p', { class: 'muted small' }, 'Each player rolls d10; their SPD in armor is added.'));
    }
    if (enc.phase === 'declare') return declarePanel(app, enc, Combat.legalActions(enc, chars, Combat.currentActor(enc)));
    if (enc.phase === 'resolve' || enc.phase === 'resolving') {
      return h('section', { class: 'panel cmd' },
        h('span', { class: 'label' }, `Round ${enc.round}`),
        h('div', { class: 'who' }, 'All declared'),
        h('p', { class: 'muted small' }, 'Replay every declaration pass by pass. Players will be asked for defense rolls, hit-location d4s and opposed checks.'),
        h('button', { class: 'primary', disabled: enc.phase === 'resolving', onclick: async () => {
          await Combat.resolveRound(enc, chars, roller);
          app.save(); app.render();
        } }, enc.phase === 'resolving' ? 'Resolving…' : 'Resolve the round'));
    }
    if (enc.phase === 'over') return lootPanel(app, enc);
    return null;
  }

  // ---- Loot --------------------------------------------------------------
  function lootPanel(app, enc) {
    const s = app.state;
    const chars = s.characters;
    const ui = bui(app);
    const party = s.order.map((id) => chars[id]).filter((c) => c.side === 'party' && !c.status.dead);
    const fallen = enc.ids.map((id) => chars[id]).filter((c) => c.side !== 'party' && !C.isActive(c));
    if (!ui.lootTo || !chars[ui.lootTo]) ui.lootTo = party[0] ? party[0].id : '';
    const to = chars[ui.lootTo];
    const take = (from, item) => {
      if (!to) return;
      if (item === from.armor) from.armor = null;
      else if (item === from.shield) from.shield = null;
      else {
        from.weapons = from.weapons.filter((w) => w !== item);
        if (from.wield === item.id) from.wield = null;
        if (from.sidearm === item.id) from.sidearm = null;
        if (from.status.dropped === item.id) from.status.dropped = null;
      }
      to.inventory.items.push(item);
    };
    const rows = [];
    for (const f of fallen) {
      const items = [f.armor, f.shield].concat(f.weapons).filter(Boolean);
      rows.push(h('div', { class: 'stack tight' },
        h('div', { class: 'row spread' }, h('b', null, f.name), h('span', { class: 'chip bad' }, f.status.dead ? 'Dead' : 'Unconscious')),
        items.map((it) => h('div', { class: 'row spread small' },
          h('span', null, Items.itemName(it), it.durability != null ? h('span', { class: 'muted num' }, ` · dur ${it.durability}`) : null, ' ', h('span', { class: 'chip' }, Items.itemRarity(it))),
          h('button', { class: 'small', disabled: !to, onclick: () => { take(f, it); app.save(); app.render(); } }, 'Take'))),
        (f.inventory.gold || f.inventory.bandages) ? h('div', { class: 'row spread small' },
          h('span', null, `${f.inventory.gold} gold, ${f.inventory.bandages} bandages`),
          h('button', { class: 'small', disabled: !to, onclick: () => { to.inventory.gold += f.inventory.gold; to.inventory.bandages += f.inventory.bandages; f.inventory.gold = 0; f.inventory.bandages = 0; app.save(); app.render(); } }, 'Take')) : null,
        !items.length && !f.inventory.gold && !f.inventory.bandages ? h('span', { class: 'small muted' }, 'Nothing left.') : null));
    }
    return h('section', { class: 'panel cmd' },
      h('span', { class: 'label' }, `After ${enc.round} rounds`),
      h('div', { class: 'who' }, enc.winner === 'party' ? 'Victory' : enc.winner ? 'Defeat' : 'No one stands'),
      fallen.length && party.length ? h('div', { class: 'stack' },
        h('label', { class: 'inline', for: 'loot-to' }, h('span', { class: 'label' }, 'Loot goes to'), UI.select('loot-to', ui.lootTo, party.map((c) => [c.id, c.name]), (v) => { ui.lootTo = v; app.render(); })),
        rows) : null,
      h('label', { class: 'inline small', for: 'remove-defeated' }, h('input', { id: 'remove-defeated', type: 'checkbox', checked: ui.removeDefeated, onchange: (e) => (ui.removeDefeated = e.target.checked) }), 'Remove defeated enemies from the roster'),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => {
        Combat.cleanup(enc, chars);
        if (ui.removeDefeated) fallen.forEach((f) => app.removeCharacter(f.id, true));
        s.encounter = null;
        app.ui.battleSetup = null;
        ui.mode = null;
        app.save();
        app.go('roster');
        toast('Battle over. Rest to recover.');
      } }, 'End battle')));
  }

  // ---- Side panels -------------------------------------------------------
  function combatantsView(app, enc) {
    const chars = app.state.characters;
    const actor = Combat.currentActor(enc);
    const gm = app.state.settings.gmView;
    const ids = enc.order.length ? enc.order.concat(enc.ids.filter((id) => !enc.order.includes(id))) : enc.ids;
    return h('div', { class: 'combatants' }, ids.map((id) => {
      const c = chars[id];
      const max = C.maxStamina(c);
      const showAP = gm || id === actor || enc.phase !== 'declare';
      const ai = C.armorInfo(c);
      return h('div', { class: `mini ${c.side === 'party' ? '' : 'enemy'} ${C.isActive(c) ? '' : 'down'} ${id === actor ? 'current' : ''}` },
        h('div', { class: 'nm' }, h('span', null, c.name), enc.initiative[id] != null ? h('span', { class: 'num muted', title: 'Initiative' }, 'init ' + enc.initiative[id]) : null),
        h('div', { class: 'row spread small' }, h('span', { class: 'num' }, `Stamina ${c.stamina}/${max}`),
          enc.phase === 'declare' && enc.ap[id] != null ? h('span', { class: 'num muted' }, showAP ? `${enc.ap[id]} AP` : 'AP hidden') : null),
        bar(c.stamina, max),
        h('div', { class: 'stat-line' },
          h('span', null, 'CON ', h('b', null, `${C.attr(c, 'CON')}/${C.attrMax(c, 'CON')}`)),
          c.armor ? h('span', null, 'Armor ', h('b', null, `${ai.durability}/${ai.maxDurability}`)) : null,
          c.shield ? h('span', null, 'Shield ', h('b', null, `${c.shield.durability}`)) : null,
          C.totalDamage(c) - c.damage.CON > 0 ? h('span', null, 'Other wounds ', h('b', null, C.totalDamage(c) - c.damage.CON)) : null),
        UI.Cards.statusChips(c).length ? h('div', { class: 'row', style: { gap: '4px' } }, UI.Cards.statusChips(c)) : null);
    }));
  }

  function declsView(app, enc) {
    const chars = app.state.characters;
    if (!enc.decls.length) return null;
    const viewer = app.state.settings.gmView ? null : Combat.currentActor(enc);
    return h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h3', null, 'Declared this round'), h('span', { class: 'small muted' }, viewer ? `as ${chars[viewer].name} sees it` : 'GM view')),
      h('div', { class: 'decls' }, enc.decls.map((d) => {
        const desc = viewer === null && app.state.settings.gmView ? Combat.describeDecl(enc, chars, d, d.actor) : Combat.describeDecl(enc, chars, d, viewer);
        return h('div', { class: 'decl' + (desc.hidden ? ' hidden' : '') }, h('span', { class: 'p' }, 'P' + d.pass), h('span', null, desc.text));
      })));
  }

  function logView(app, enc) {
    const box = h('div', { class: 'log', id: 'battle-log' }, enc.log.slice(-200).map((l) => h('div', { class: 'l ' + (l.cls || '') }, l.text)));
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
    return h('section', { class: 'panel' }, h('h3', null, 'Battle log'), enc.log.length ? box : h('p', { class: 'muted small' }, 'Nothing has happened yet.'));
  }

  // ---- AI turns ----------------------------------------------------------
  function scheduleAI(app, enc) {
    const chars = app.state.characters;
    if (enc.phase !== 'declare') return;
    const id = Combat.currentActor(enc);
    if (!id || !aiControlled(app, chars[id]) || app.ui.aiPending) return;
    app.ui.aiPending = true;
    setTimeout(() => {
      app.ui.aiPending = false;
      if (app.state.encounter !== enc || enc.phase !== 'declare' || Combat.currentActor(enc) !== id) return;
      const d = G.AI.choose(enc, chars, id);
      if (d.type === 'concede' || Combat.declare(enc, chars, d)) Combat.concede(enc, id);
      app.save();
      app.render();
    }, 450);
  }

  function view(app) {
    const enc = app.state.encounter;
    if (!enc) return setupView(app);
    const chars = app.state.characters;
    const legal = enc.phase === 'declare' ? Combat.legalActions(enc, chars, Combat.currentActor(enc)) : null;
    scheduleAI(app, enc);
    return h('div', { class: 'stack', style: { gap: '16px' } },
      h('div', { class: 'view-head' },
        h('div', { class: 'stack tight' }, h('h1', null, enc.round ? `Round ${enc.round}` : 'Battle'),
          h('p', { class: 'muted small' }, enc.phase === 'declare' ? `Declaration pass ${enc.pass}` : enc.phase === 'over' ? 'The fight is over' : '')),
        enc.phase !== 'over' ? UI.confirmButton('Abandon battle', 'Abandon? Wounds stay', () => {
          Combat.cleanup(enc, chars);
          app.state.encounter = null;
          app.ui.battleSetup = null;
          app.save(); app.render();
        }) : null),
      h('div', { class: 'battle' },
        h('div', { class: 'stack' }, mapView(app, enc, legal), combatantsView(app, enc), logView(app, enc)),
        h('div', { class: 'stack' }, phasePanel(app, enc), declsView(app, enc))));
  }

  UI.Views.battle = view;
})(globalThis.BBB);
