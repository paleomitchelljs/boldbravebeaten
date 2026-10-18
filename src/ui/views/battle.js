/* Battle view: setup, the map, declarations, resolution, loot. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, num, bar, toast, initials } = UI;
  const C = G.Character;
  const Combat = G.Combat;
  const Items = G.Items;
  const D = G.DATA;

  // A mark for each kind of terrain on the map.
  const TILE_GLYPH = { stoneWall: '■', iceWall: '▦', brambleWall: '✶', forceWall: '▫', fireWall: '▲', windWall: '≋', stormWall: 'ϟ', hot: '♨', ice: '≈', charged: 'ϟ', winds: '~', rough: '∴', brambles: '✶', pit: '◯', rune: 'ᚱ' };

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
        h('p', { class: 'muted' }, 'Pick who fights, then place them on the grid. Each round starts with initiative; players take turns in that order, and when everyone has had a turn the pass resolves. Players type in their own dice when asked; the platform does the arithmetic.'))),
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
    for (const d of enc.decls) if (d.type === 'move' && !d.done) ghosts[d.to.x + ',' + d.to.y] = true;
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
      // With terrain: walls are walked around and rough ground costs more.
      const terrain = G.Terrain && enc.tiles && Object.keys(enc.tiles).length;
      const map = terrain ? G.Terrain.costMap(enc, m.from, chars[actor]) : null;
      for (let y = 0; y < enc.grid.h; y++) for (let x = 0; x < enc.grid.w; x++) {
        const d = Combat.dist(m.from, { x, y });
        const squares = map ? map.cost[map.idx(x, y)] : d;
        if (!isFinite(squares)) continue;
        const need = C.moveCost(chars[actor], Math.round(squares));
        if (d > 0 && need <= m.maxAP && !blocked[x + ',' + y]) reach[x + ',' + y] = need;
      }
    }
    // Casting at a square: those in range with a clear line.
    let castable = null;
    if (ui.mode === 'cast' && ui.pending && legal) {
      castable = {};
      const me = Combat.projectedPos(enc, actor);
      const o = ui.pending.option;
      for (let y = 0; y < enc.grid.h; y++) for (let x = 0; x < enc.grid.w; x++) {
        const d = Combat.dist(me, { x, y });
        if (d < o.minRange || d > o.maxRange) continue;
        if (d >= 2 && G.Terrain && enc.tiles && G.Terrain.lineCheck(enc, me, { x, y }, 'missile').blocked) continue;
        castable[x + ',' + y] = true;
      }
    }
    // Terrain this side can see (hidden runes only by those who laid them).
    const viewer = actor && chars[actor] && !aiControlled(app, chars[actor]) ? chars[actor].side : 'party';
    const ground = {};
    if (G.Terrain && enc.tiles) for (const t of G.Terrain.all(enc)) if (G.Terrain.visible(t.f, viewer)) (ground[t.x + ',' + t.y] || (ground[t.x + ',' + t.y] = [])).push(t);
    const late = (need) => legal && need > legal.passLeft;
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
        const canCast = castable && castable[key];
        const g = ground[key] || [];
        const tileCls = g.map((t) => ' tile-' + t.f.kind).join('');
        const glyph = !token && !canMove && g.length ? h('span', { class: 'glyph', 'aria-hidden': 'true' }, TILE_GLYPH[g[g.length - 1].f.kind] || '·') : null;
        cells.push(h('button', {
          class: 'cell' + tileCls + (canMove ? ' can-move' + (late(reach[key]) ? ' late' : '') : '') + (canCast ? ' can-cast' : '') + (ghosts[key] && !c ? ' ghost' : '') + (c ? ' has-token' : ''),
          title: g.length ? g.map((t) => `${t.def.name}${t.f.rounds != null ? ` (${t.f.rounds} rd)` : ''}`).join(', ') : null,
          'aria-label': (c ? `${c.name} at ${x + 1}, ${y + 1}` : `Square ${x + 1}, ${y + 1}${canMove ? `, move for ${reach[key]} AP` : ''}`) + (g.length ? ` — ${g.map((t) => t.def.name).join(', ')}` : ''),
          onclick: () => cellClick(app, enc, legal, x, y, id, reach, castable),
        }, token || (canMove ? String(reach[key]) : glyph)));
      }
    }
    return h('div', { class: 'map-wrap' }, h('div', { class: 'map', style: { gridTemplateColumns: `repeat(${enc.grid.w}, auto)`, '--cols': enc.grid.w } }, cells));
  }

  function cellClick(app, enc, legal, x, y, id, reach, castable) {
    const ui = bui(app);
    if (ui.mode === 'cast' && castable && castable[x + ',' + y]) {
      declare(app, enc, { actor: Combat.currentActor(enc), type: 'cast', option: ui.pending.option, at: { x, y } });
      return;
    }
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
      return;
    }
    if (id && !ui.mode) openSheet(app, enc, id);
  }

  function finishTarget(app, enc, targetId) {
    const ui = bui(app);
    const actor = Combat.currentActor(enc);
    const p = ui.pending;
    if (p.kind === 'strike') declare(app, enc, { actor, type: 'strike', option: p.option, target: targetId });
    else if (p.kind === 'cast') declare(app, enc, { actor, type: 'cast', option: p.option, target: targetId });
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

  function finishTurn(app, enc, id, wholeRound) {
    const ui = bui(app);
    if (wholeRound) Combat.concede(enc, id);
    else Combat.endTurn(enc, id);
    ui.mode = null;
    ui.pending = null;
    ui.open = null;
    app.save();
    app.render();
  }

  // ---- Command panel -----------------------------------------------------
  function apMeter(cap, passLeft, roundLeft) {
    const out = [];
    const n = Math.min(cap, Math.max(passLeft, 0));
    for (let i = 0; i < (Number.isFinite(cap) ? cap : roundLeft); i++) out.push(h('i', { class: i < n ? '' : 'spent' }));
    return h('span', { class: 'ap-meter', 'aria-label': `${passLeft} AP left this pass` }, out);
  }

  function costText(ap, st) {
    return `${ap} AP · ${st} st`;
  }

  // One collapsible group of actions; only one is open at a time.
  function section(ui, key, title, count, body) {
    return h('details', {
      class: 'cmd-sec', name: 'cmd-sections', open: ui.open === key,
      ontoggle: (e) => { if (e.target.open) ui.open = key; else if (ui.open === key) ui.open = 'none'; },
    }, h('summary', null, h('span', null, title), count != null ? h('span', { class: 'count' }, count) : null), h('div', { class: 'cmd-body' }, body));
  }

  function lateNote(o) {
    return o.spans ? ' · lands next pass' : '';
  }

  function declarePanel(app, enc, legal) {
    const chars = app.state.characters;
    const ui = bui(app);
    const id = Combat.currentActor(enc);
    const c = chars[id];
    const head = h('div', { class: 'cmd-head' },
      h('div', { class: 'stack tight' },
        h('span', { class: 'label' }, `Round ${enc.round} · pass ${enc.pass} · turn`),
        h('button', { class: 'who linkish', onclick: () => openSheet(app, enc, id), title: 'Open character sheet' }, c.name)),
      h('div', { class: 'stack tight', style: { alignItems: 'flex-end' } },
        h('div', { class: 'ap-line' }, apMeter(legal.passCap, legal.passLeft, legal.ap), h('span', { class: 'small num', title: 'AP left this pass / this round' }, `${legal.passLeft}/${legal.ap} AP`)),
        h('span', { class: 'small num muted' }, `stamina ${c.stamina}/${C.maxStamina(c)}`)));

    if (aiControlled(app, c)) {
      return h('section', { class: 'panel cmd' }, head, h('p', { class: 'muted' }, 'Deciding…'));
    }

    const pick = (pending) => {
      ui.pending = pending;
      ui.mode = 'target';
      app.render();
    };
    const notes = [];
    if (ui.mode === 'target' && ui.pending) {
      notes.push(h('div', { class: 'note' },
        h('div', { class: 'row spread' }, h('b', null, `Target for ${ui.pending.label}`), h('button', { class: 'small', onclick: () => { ui.mode = null; ui.pending = null; app.render(); } }, 'Cancel')),
        h('p', { class: 'small' }, 'Tap a highlighted token on the map, or choose:'),
        h('div', { class: 'row', style: { marginTop: '6px' } }, ui.pending.targets.map((t) =>
          h('button', { class: 'small' + (t.inReach ? '' : ' ghost'), onclick: () => finishTarget(app, enc, t.id) }, chars[t.id].name + (t.distance != null ? ` · ${t.distance} sq` : '') + (t.inReach ? '' : t.tooClose ? ' (too close now)' : ' (out of reach now)'))))));
    }
    if (ui.mode === 'cast' && ui.pending) {
      notes.push(h('div', { class: 'note row spread' }, h('span', null, `${ui.pending.option.label}: tap a highlighted square (range ${ui.pending.option.minRange}–${ui.pending.option.maxRange}).`),
        h('button', { class: 'small', onclick: () => { ui.mode = null; ui.pending = null; app.render(); } }, 'Cancel')));
    }
    if (ui.mode === 'move') {
      notes.push(h('div', { class: 'note row spread' }, h('span', null, 'Tap a highlighted square; the number is its AP. Striped squares land next pass.'),
        h('button', { class: 'small', onclick: () => { ui.mode = null; app.render(); } }, 'Cancel')));
    }
    if (legal.incomingLater.length) {
      notes.push(h('div', { class: 'note' }, h('b', null, 'On its way: '),
        legal.incomingLater.map((d) => Combat.describeDecl(enc, chars, d, id).text).join('; ')));
    }

    const groups = [];
    {
      const foes = new Set(enc.ids.filter((o) => chars[o].side !== c.side));
      const sortTargets = (ts) => ts.slice().sort((a, b) => (foes.has(b.id) - foes.has(a.id)) || (b.inReach - a.inReach));
      const attacks = legal.attacks.filter((o) => o.affordable || ui.showAll);
      groups.push(['attack', 'Attack', attacks.length, [
        h('div', { class: 'action-list' }, attacks.map((o) => {
          const w = o.weaponId ? c.weapons.find((x) => x.id === o.weaponId) : null;
          const anyReach = o.targets.some((t) => t.inReach && foes.has(t.id));
          const range = (o.minRange === o.maxRange ? `range ${o.maxRange}` : `range ${o.minRange}–${o.maxRange}`) + (o.closePenalty ? (G.CONFIG.range.closeRule === 'blunt' ? ' (½ blunt at 1)' : ' (½ at 1)') : '');
          const dmg = o.spell ? `${o.spell.magnitude} ${o.spell.element} · ${o.spCost} SP` : `P/S/B ${o.damage.join('/')}`;
          return h('button', { class: 'action', disabled: !o.affordable, title: o.why || '', onclick: () => pick({ kind: 'strike', option: o, label: o.label, targets: sortTargets(o.targets) }) },
            h('span', null, o.label, w ? h('span', { class: 'muted' }, ' — ' + Items.itemName(w)) : null),
            h('span', { class: 'cost' }, costText(o.ap, o.stamina)),
            h('span', { class: 'meta' }, `${dmg} · ${range}${o.why ? ' · ' + o.why : anyReach ? '' : ' · no foe in range'}${lateNote(o)}`));
        })),
        legal.attacks.length > attacks.length || ui.showAll ? h('button', { class: 'small ghost', onclick: () => { ui.showAll = !ui.showAll; app.render(); } },
          ui.showAll ? 'Hide unavailable attacks' : `Show ${legal.attacks.length - attacks.length} unavailable`) : null]]);
      // Spells cast at a square, a foe or an ally (bolts are under Attack).
      const spells = (legal.spells || []).filter((o) => o.affordable || ui.showAll);
      if ((legal.spells || []).length) {
        groups.push(['spell', 'Spells', spells.length, [
          h('div', { class: 'action-list' }, spells.map((o) => {
            const s = o.spell;
            const shape = { area: `radius ${s.radius}`, ground: `radius ${s.radius}, ${s.rounds} rd`, wall: `${s.length} squares, ${s.rounds} rd`, terrain: `${s.length} square${s.length > 1 ? 's' : ''}`, rune: 'hidden rune', bane: `${s.rounds} rd, resisted`, boon: `${s.rounds} rd`, conjure: `${s.rounds} rd`, ward: `${s.rounds} rd`, blink: 'through walls; out of any hold' }[s.shape] || '';
            const onclick = o.target === 'square'
              ? () => { ui.mode = 'cast'; ui.pending = { option: o }; app.render(); }
              : () => pick({ kind: 'cast', option: o, label: o.label, targets: sortTargets(o.targets.map((t) => Object.assign({}, t, { inReach: t.inReach }))) });
            return h('button', { class: 'action', disabled: !o.affordable, title: o.why || '', onclick },
              h('span', null, o.label),
              h('span', { class: 'cost' }, `${o.ap} AP · ${o.spCost} SP`),
              h('span', { class: 'meta' }, `mag ${s.magnitude} · range ${o.minRange}–${o.maxRange} · ${shape}${o.why ? ' · ' + o.why : ''}${lateNote(o)}`));
          })),
          h('p', { class: 'small muted' }, 'Spells cast at a square ask for a square on the map. Areas and hazards hit friends too.')]]);
      }
      // Guards: ready a defense for the next attack, or the next from one foe.
      const vs = legal.guardAgainst.includes(ui.guardAgainst) ? ui.guardAgainst : '';
      groups.push(['guard', 'Guard', legal.guards.length ? `${legal.guards.length} up` : null, [
        legal.incoming.length ? h('div', { class: 'small' }, h('b', null, 'Landing on you this pass: '),
          legal.incoming.map((d) => Combat.describeDecl(enc, chars, d, id).text).join('; ')) : null,
        legal.guards.length ? h('div', { class: 'small' }, h('b', null, 'Up: '), legal.guards.map((g) => Combat.describeDecl(enc, chars, g, id).text.replace(c.name + ': ', '')).join('; ')) : null,
        h('label', { class: 'inline small', for: 'guard-vs' }, h('span', { class: 'label' }, 'Against'),
          UI.select('guard-vs', vs, [['', 'the next attack']].concat(legal.guardAgainst.map((o) => [o, chars[o].name])), (v) => { ui.guardAgainst = v; app.render(); })),
        h('div', { class: 'row' }, legal.defenses.map((o) => h('button', {
          disabled: !o.affordable, title: o.why || '',
          onclick: () => declare(app, enc, { actor: id, type: o.type, against: vs || null }),
        }, `${D.ACTIONS[o.type].name} · ${costText(o.ap, o.stamina)}${o.why ? ' — ' + o.why : o.spans ? ' · borrows next pass' : ''}`))),
        (legal.readies || []).length ? h('div', { class: 'row' }, legal.readies.map((o) => h('button', {
          disabled: !o.affordable, title: o.why || '',
          onclick: () => declare(app, enc, { actor: id, type: 'readyStrike', option: o.option, against: vs || null }),
        }, `${o.name} · ${costText(o.ap, o.stamina)}${o.why ? ' — ' + o.why : o.spans ? ' · borrows next pass' : ''}`))) : null,
        (legal.readied || []).length ? h('div', { class: 'small' }, h('b', null, 'Point ready: '), legal.readied.map((g) => Combat.describeDecl(enc, chars, g, id).text.replace(c.name + ': ', '')).join('; ')) : null,
        h('p', { class: 'small muted' }, 'A guard lasts until it meets an attack or the pass ends. A parry can\'t meet an arrow or spell; it waits for the next blow. A readied thrust meets the first foe (or the named one) who steps closer into its reach this pass; a hit stops them. Stamina is paid only if it\'s made.')]]);
      if (legal.move || legal.maneuvers.length) {
        groups.push(['move', 'Move and maneuver', null, h('div', { class: 'row' },
          legal.move ? h('button', { class: ui.mode === 'move' ? 'selected' : '', onclick: () => { ui.mode = 'move'; ui.pending = null; app.render(); } },
            `Move · ${legal.move.passSquares} sq this pass (up to ${legal.move.maxSquares}) · ${legal.move.stamina} st`) : null,
          legal.maneuvers.map((m) => h('button', { disabled: !m.affordable, onclick: () => pick({ kind: 'maneuver', type: m.type, label: D.ACTIONS[m.type].name, targets: sortTargets(m.targets) }) },
            `${D.ACTIONS[m.type].name} · ${costText(m.ap, m.stamina)}${lateNote(m)}`)))]);
      }
      if (legal.other.length) {
        groups.push(['other', 'Other', legal.other.length, h('div', { class: 'row' }, legal.other.map((o) => h('button', {
          disabled: !o.affordable,
          title: o.why || '',
          onclick: () => (o.targets ? pick({ kind: 'other', type: o.type, label: o.name, targets: o.targets }) : declare(app, enc, { actor: id, type: o.type, option: o.option })),
        }, `${o.name}${o.note ? ` (${o.note})` : ''} · ${costText(o.ap, o.stamina)}${lateNote(o)}`)))]);
      }
    }
    if (legal.incoming.length && ui.guardHint !== enc.pass + ':' + id) { ui.open = 'guard'; ui.guardHint = enc.pass + ':' + id; }
    if (!ui.open || !groups.some((g) => g[0] === ui.open) && ui.open !== 'none') ui.open = groups[0] ? groups[0][0] : null;

    return h('section', { class: 'panel cmd' },
      head,
      notes,
      groups.map((g) => section(ui, g[0], g[1], g[2], g[3])),
      h('div', { class: 'cmd-foot' },
        h('button', { class: 'primary', onclick: () => finishTurn(app, enc, id, false) }, 'End turn'),
        h('button', { class: 'small ghost', title: 'Spend nothing more this round, including guards', onclick: () => finishTurn(app, enc, id, true) }, 'Done for the round')),
      h('p', { class: 'small muted' }, 'AP left over at the end of the round is lost. Other players can\'t see your AP; pass the device only after ending your turn.'));
  }

  function phasePanel(app, enc) {
    const chars = app.state.characters;
    const ui = bui(app);
    const roller = UI.Dice.makeRoller(app);
    if (enc.phase === 'setup' || enc.phase === 'roundEnd') {
      return h('section', { class: 'panel cmd' },
        h('span', { class: 'label' }, enc.phase === 'setup' ? 'Ready' : `Round ${enc.round} done`),
        h('div', { class: 'who' }, `Round ${enc.round + 1}`),
        h('p', { class: 'muted small' }, ui.mode === 'place' ? 'Tap a token, then a square.' : 'Everyone rolls initiative to start the round.'),
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
        h('span', { class: 'label' }, `Round ${enc.round} · pass ${enc.pass}`),
        h('div', { class: 'who' }, 'Resolving the pass'),
        h('p', { class: 'muted small' }, 'Players may be asked for defense rolls, hit-location d4s and opposed checks.'));
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
        from.status.dropped = from.status.dropped.filter((x) => x !== item.id);
      }
      to.inventory.items.push(item);
    };
    const rows = [];
    for (const f of fallen) {
      const items = [f.armor, f.shield].concat(f.weapons).filter((it) => it && !(G.DATA.ARMOR[it.type] && G.DATA.ARMOR[it.type].natural));
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

  // ---- Combatants: a slim list of names; a name opens that character's sheet ----
  function canSeeAP(app, enc, id) {
    return app.state.settings.gmView || id === Combat.currentActor(enc) || enc.phase !== 'declare';
  }

  function rosterView(app, enc) {
    const chars = app.state.characters;
    const actor = Combat.currentActor(enc);
    const ids = enc.order.length ? enc.order.concat(enc.ids.filter((id) => !enc.order.includes(id))) : enc.ids;
    return h('nav', { class: 'roster-strip', 'aria-label': 'Combatants' }, ids.map((id) => {
      const c = chars[id];
      const max = C.maxStamina(c);
      return h('button', {
        class: `rname ${c.side === 'party' ? '' : 'enemy'} ${C.isActive(c) ? '' : 'down'} ${id === actor ? 'current' : ''}`,
        onclick: () => openSheet(app, enc, id), title: 'Open character sheet',
      },
      h('span', { class: 'nm' }, c.name),
      h('span', { class: 'sub num' }, `${c.stamina}/${max}`, enc.initiative[id] != null ? ` · init ${enc.initiative[id]}` : ''),
      bar(c.stamina, max));
    }));
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root) root.innerHTML = '';
    document.removeEventListener('keydown', escClose);
  }

  function escClose(e) {
    if (e.key === 'Escape') closeModal();
  }

  // A pop-up character sheet: what matters in a fight, with a link to the full sheet.
  function openSheet(app, enc, id) {
    const chars = app.state.characters;
    const c = chars[id];
    if (!c) return;
    const max = C.maxStamina(c);
    const ai = C.armorInfo(c);
    const w = C.wieldedWeapon(c);
    const attrs = G.CONFIG.attributes.map((a) => h('div', { class: 'd' }, h('span', { class: 'label' }, a), h('b', null, `${C.attr(c, a)}`), C.attr(c, a) < C.attrMax(c, a) ? h('span', { class: 'small muted num' }, `of ${C.attrMax(c, a)}`) : null));
    const feats = Object.keys(c.feats).filter((f) => c.feats[f] > 0 && D.FEATS[f]).map((f) => `${D.FEATS[f].name}${D.FEATS[f].ranks.length > 1 ? ' ' + C.roman(c.feats[f]) : ''}`);
    const seeAP = canSeeAP(app, enc, id) && enc.ap[id] != null;
    const box = h('div', { class: 'modal sheet-pop', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pop-title', onclick: (e) => e.stopPropagation() },
      h('div', { class: 'row spread' },
        h('div', { class: 'stack tight' },
          h('span', { class: 'label' }, `${c.side === 'party' ? 'Party' : 'Enemy'} · level ${c.level}`),
          h('h2', { id: 'pop-title' }, c.name)),
        h('button', { class: 'small', onclick: closeModal, 'aria-label': 'Close' }, 'Close')),
      h('div', { class: 'stack tight' },
        h('div', { class: 'row spread small' }, h('span', { class: 'num' }, `Stamina ${c.stamina}/${max} · regen ${C.regen(c)}`), seeAP ? h('span', { class: 'num' }, `${enc.ap[id]} AP left this round`) : h('span', { class: 'muted' }, 'AP hidden')),
        bar(c.stamina, max)),
      UI.Cards.statusChips(c).length ? h('div', { class: 'row', style: { gap: '4px' } }, UI.Cards.statusChips(c)) : null,
      h('div', { class: 'derived attrs' }, attrs),
      h('div', { class: 'stack tight small' },
        h('div', null, h('b', null, 'Wielding: '), w ? Items.itemName(w) : 'Unarmed'),
        c.weapons.length > 1 ? h('div', null, h('b', null, 'Also carrying: '), c.weapons.filter((x) => x !== w).map(Items.itemName).join(', ')) : null,
        h('div', null, h('b', null, 'Armor: '), c.armor ? `${Items.itemName(c.armor)} · durability ${ai.durability}/${ai.maxDurability}` : 'none'),
        c.shield ? h('div', null, h('b', null, 'Shield: '), `${Items.itemName(c.shield)} · durability ${c.shield.durability}`) : null,
        c.inventory.arrows || c.inventory.bodkins ? h('div', null, h('b', null, 'Arrows: '), `${c.inventory.arrows || 0} broadhead, ${c.inventory.bodkins || 0} bodkin`) : null,
        h('div', null, h('b', null, 'Bandages: '), c.inventory.bandages)),
      feats.length ? h('details', { class: 'feat-tree' }, h('summary', null, h('span', null, 'Feats'), h('span', { class: 'muted' }, feats.length)), h('p', { class: 'small', style: { padding: '8px 12px' } }, feats.join(', '))) : null,
      h('div', { class: 'row spread' },
        h('span', { class: 'small muted' }, 'Edits happen on the full sheet.'),
        h('button', { class: 'small', onclick: () => { closeModal(); app.go('sheet', id); } }, 'Open full sheet')));
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    root.appendChild(h('div', { class: 'modal-backdrop', onclick: closeModal }, box));
    document.addEventListener('keydown', escClose);
  }

  function declsView(app, enc) {
    const chars = app.state.characters;
    const live = enc.decls.filter((d) => d.declaredPass != null);
    if (!live.length) return null;
    const viewer = app.state.settings.gmView ? null : Combat.currentActor(enc);
    const ui = bui(app);
    return h('details', { class: 'panel fold', open: !!ui.showDecls, ontoggle: (e) => (ui.showDecls = e.target.open) },
      h('summary', null, h('h3', null, 'Declared this round'), h('span', { class: 'small muted' }, `${live.length} · ${viewer ? `as ${chars[viewer].name} sees it` : 'GM view'}`)),
      h('div', { class: 'decls' }, live.map((d) => {
        const desc = viewer === null && app.state.settings.gmView ? Combat.describeDecl(enc, chars, d, d.actor) : Combat.describeDecl(enc, chars, d, viewer);
        return h('div', { class: 'decl' + (desc.hidden ? ' hidden' : '') + (d.done ? ' done' : '') }, h('span', { class: 'p' }, 'P' + d.declaredPass), h('span', null, desc.text));
      })));
  }

  function logView(app, enc) {
    const ui = bui(app);
    const last = enc.log.length ? enc.log[enc.log.length - 1].text : 'Nothing has happened yet.';
    const box = h('div', { class: 'log', id: 'battle-log' }, enc.log.slice(-200).map((l) => h('div', { class: 'l ' + (l.cls || '') }, l.text)));
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
    return h('details', { class: 'panel fold', open: ui.showLog !== false && (ui.showLog || window.matchMedia('(min-width: 921px)').matches), ontoggle: (e) => (ui.showLog = e.target.open) },
      h('summary', null, h('h3', null, 'Battle log'), h('span', { class: 'small muted last' }, last)),
      enc.log.length ? box : null);
  }

  // ---- Computer-run turns and pass resolution ----------------------------
  function scheduleAI(app, enc) {
    const chars = app.state.characters;
    if (enc.phase === 'resolve') {
      if (app.ui.resolvePending) return;
      app.ui.resolvePending = true;
      setTimeout(async () => {
        app.ui.resolvePending = false;
        if (app.state.encounter !== enc || enc.phase !== 'resolve') return;
        await Combat.resolvePass(enc, chars, UI.Dice.makeRoller(app));
        app.save();
        app.render();
      }, 350);
      return;
    }
    if (enc.phase !== 'declare') return;
    const id = Combat.currentActor(enc);
    if (!id || !aiControlled(app, chars[id]) || app.ui.aiPending) return;
    app.ui.aiPending = true;
    setTimeout(() => {
      app.ui.aiPending = false;
      if (app.state.encounter !== enc || enc.phase !== 'declare' || Combat.currentActor(enc) !== id) return;
      Combat.submit(enc, chars, G.AI.choose(enc, chars, id));
      app.save();
      app.render();
    }, 350);
  }

  function view(app) {
    const enc = app.state.encounter;
    if (!enc) return setupView(app);
    const chars = app.state.characters;
    const legal = enc.phase === 'declare' ? Combat.legalActions(enc, chars, Combat.currentActor(enc)) : null;
    scheduleAI(app, enc);
    const status = enc.phase === 'declare' ? `Pass ${enc.pass} · turns` : enc.phase === 'over' ? 'The fight is over' : enc.phase === 'resolve' || enc.phase === 'resolving' ? `Pass ${enc.pass} · resolving` : '';
    return h('div', { class: 'battle-view' },
      h('div', { class: 'battle-head' },
        h('h1', null, enc.round ? `Round ${enc.round}` : 'Battle'),
        h('span', { class: 'small muted' }, status),
        enc.phase !== 'over' ? UI.confirmButton('Abandon', 'Abandon? Wounds stay', () => {
          Combat.cleanup(enc, chars);
          app.state.encounter = null;
          app.ui.battleSetup = null;
          app.save(); app.render();
        }) : null),
      h('div', { class: 'battle' },
        rosterView(app, enc),
        h('div', { class: 'battle-map' }, mapView(app, enc, legal)),
        h('div', { class: 'battle-side stack' }, phasePanel(app, enc), declsView(app, enc), logView(app, enc))));
  }

  UI.Views.battle = view;
})(globalThis.BBB);
