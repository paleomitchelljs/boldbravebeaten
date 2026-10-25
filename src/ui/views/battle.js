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
  // What the map should show for the current choice: who can be targeted, where one can move or cast, the ground.
  function mapState(app, enc, legal) {
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
    const late = () => false; // (no passes: a move lands as it is made)
    return { actor, ghosts, targets, reach, castable, ground, late };
  }

  function mapView(app, enc, legal) {
    const chars = app.state.characters;
    const ui = bui(app);
    const { actor, ghosts, targets, reach, castable, ground, late } = mapState(app, enc, legal);
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
          'aria-label': (c ? `${c.name} at ${x + 1}, ${y + 1}` : `Square ${x + 1}, ${y + 1}${canMove ? `, move for ${C.fmtAP(reach[key])} AP` : ''}`) + (g.length ? ` — ${g.map((t) => t.def.name).join(', ')}` : ''),
          onclick: () => cellClick(app, enc, legal, x, y, id, reach, castable),
        }, token || (canMove ? C.fmtAP(reach[key]) : glyph)));
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
    if (id) openSheet(app, enc, id);
  }

  function finishTarget(app, enc, targetId) {
    const ui = bui(app);
    const actor = Combat.currentActor(enc);
    const p = ui.pending;
    if (p.kind === 'strike') declare(app, enc, { actor, type: 'strike', option: p.option, target: targetId });
    else if (p.kind === 'cast') declare(app, enc, { actor, type: 'cast', option: p.option, target: targetId });
    else declare(app, enc, { actor, type: p.type, target: targetId });
  }

  // What the engine needs from the screen: dice, and a reaction from whoever is attacked or
  // passed. Computer-run fighters decide for themselves; players are asked (the host's prompt, or
  // the GM table's pop-up).
  function ioFor(app) {
    return {
      roller: UI.Dice.makeRoller(app),
      react: (req, enc, chars) => {
        const c = chars[req.actor];
        if (aiControlled(app, c)) return G.AI.react(enc, chars, req);
        return app.hooks && app.hooks.react ? app.hooks.react(req, enc, chars) : askReaction(app, req, enc, chars);
      },
    };
  }

  // Take an action: it resolves at once (with any reactions it draws), then the screen redraws.
  async function declare(app, enc, decl) {
    const ui = bui(app);
    if (enc.phase !== 'turn' || ui.busy) return;
    ui.busy = true;
    app.render();
    let err;
    try { err = await Combat.act(enc, app.state.characters, decl, ioFor(app)); } finally { ui.busy = false; }
    if (err) toast(err);
    else {
      ui.mode = null;
      ui.pending = null;
      if (ui.cmd) { ui.cmd.moveTo = null; ui.cmd.castAt = null; }
    }
    app.save();
    app.render();
  }

  async function finishTurn(app, enc, id) {
    const ui = bui(app);
    if (ui.busy) return;
    ui.busy = true;
    try { await Combat.endTurn(enc, app.state.characters, id, ioFor(app)); } finally { ui.busy = false; }
    ui.mode = null;
    ui.pending = null;
    app.save();
    app.render();
  }

  // What an undefended blow would do through the target's armor, for the reaction prompt.
  function blowPreview(enc, chars, req) {
    const d = req.decl || {};
    const atk = chars[d.actor || req.actor], tgt = chars[d.target || req.target];
    const option = d.option || (req.options && req.options[0]);
    if (!atk || !tgt || !option || d.type && d.type !== 'strike') return null;
    const h = Combat.computeHit(atk, tgt, option, { distance: Combat.dist(enc.pos[atk.id], enc.pos[tgt.id]) });
    const wound = Math.round(h.toCON + h.slashToAttrs + h.bluntToCON);
    const stamina = Math.round(h.bluntToStamina + (h.converted || 0));
    // A point against armor (CONFIG.pierce): it bursts through, or it must find a gap.
    const point = h.gap ? ` (the point must find a gap: ${Math.round(h.gap.chance * 100)}%)` : h.pierce === 'burst' ? ' (the point bursts the armor)' : '';
    return { wound, stamina, text: (wound || stamina ? `${wound ? `~${wound} wound` : ''}${wound && stamina ? ', ' : ''}${stamina ? `~${stamina} stamina` : ''}` : 'armor stops it') + point };
  }

  // The words for a reaction request: who, what, and each choice with its AP and odds.
  function reactionModel(app, req, enc, chars) {
    const me = chars[req.actor];
    const ap = Combat.apLeft(enc, req.actor);
    if (req.kind === 'defend') {
      const a = chars[req.attacker];
      const what = req.hidden ? 'a blow you can\'t read' : req.decl.type === 'strike' ? req.decl.option.label : D.ACTIONS[req.decl.type].name;
      const prev = req.hidden ? null : blowPreview(enc, chars, req);
      return {
        title: `${a.name} → ${me.name}`, sub: `${what}${prev ? ` · if it lands: ${prev.text}` : ''}`, ap,
        choices: req.options.map((o) => ({ value: o.type, label: o.name, cost: `${C.fmtAP(o.ap)} AP${o.stamina ? ` · ${o.stamina} st` : ''}`, odds: o.odds != null ? `${Math.round(o.odds * 100)}%` : '?' })),
        none: { label: 'Take it', note: 'keep the AP' },
      };
    }
    const t = chars[req.target];
    const why = { enters: 'comes into', leaves: 'leaves', moves: 'moves about in' }[req.why] || 'leaves';
    return {
      title: `${t.name} ${why} ${me.name}'s reach`, sub: req.why === 'enters' ? 'Strike as they come in? A hit stops them.' : 'Strike as they go? A hit stops them.', ap,
      choices: req.options.map((o) => { const p = blowPreview(enc, chars, { decl: { actor: req.actor, target: req.target, type: 'strike', option: o } }); return { value: o, label: o.label, cost: `${C.fmtAP(o.ap)} AP`, odds: p ? p.text : '' }; }),
      none: { label: 'Let them go', note: 'keep the AP' },
    };
  }

  // The GM table's reaction pop-up (the game draws its own over the map).
  function askReaction(app, req, enc, chars) {
    return new Promise((resolve) => {
      const m = reactionModel(app, req, enc, chars);
      const done = (v) => { closeModal(); resolve(v); };
      const box = h('div', { class: 'modal info-pop', role: 'dialog', 'aria-modal': 'true', onclick: (e) => e.stopPropagation() },
        h('span', { class: 'label' }, `Reaction · ${C.fmtAP(m.ap)} AP left`), h('h2', null, m.title), h('p', { class: 'small muted' }, m.sub),
        h('div', { class: 'stack tight' }, m.choices.map((c) => h('button', { class: 'act', onclick: () => done(c.value) }, h('span', null, c.label), h('span', { class: 'small muted num' }, `${c.cost} · ${c.odds}`))),
          h('button', { class: 'act', onclick: () => done(null) }, h('span', null, m.none.label), h('span', { class: 'small muted' }, m.none.note))));
      const root = document.getElementById('modal-root');
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'modal-backdrop' }, box));
    });
  }

  // ---- Command panel -----------------------------------------------------
  // Under the map: the name, a type dropdown (Martial, Magic, Move, Other), the action
  // dropdown(s), a target and Declare. Numbers and rules sit behind ⓘ buttons and pop-ups.
  // One pip per AP on the sheet; a part-spent AP shows as a half pip.
  function apMeter(pool, left, flash, now) {
    const D = G.CONFIG.apDisplay || 1, P = pool / D, L = left / D;
    const out = [];
    for (let i = 0; i < Math.ceil(P - 1e-9); i++) {
      const just = flash && i + 1 > flash.to / D + 1e-9 && i < flash.from / D - 1e-9;
      out.push(h('i', { class: (L >= i + 1 ? '' : L > i ? 'part' : 'spent') + (just ? ' just' : ''), style: just ? { animationDelay: `-${now - flash.at}ms` } : null }));
    }
    return h('span', { class: 'ap-meter', 'aria-label': `${C.fmtAP(left)} of ${C.fmtAP(pool)} AP left this round` }, out);
  }

  function costText(ap, st, sp) {
    return [`${C.fmtAP(ap)} AP`, st ? `${st} st` : null, sp ? `${sp} SP` : null].filter(Boolean).join(' · ');
  }

  // A select with option groups: groups = [[label|null, [[value, label, disabled]]]].
  function selectGroups(id, value, groups, onchange, attrs) {
    const opt = ([v, label, disabled]) => h('option', { value: v, selected: String(v) === String(value), disabled: !!disabled }, label);
    return h('select', Object.assign({ id, onchange: (e) => onchange(e.target.value) }, attrs || {}),
      groups.filter((g) => g[1].length).map(([label, opts]) => (label ? h('optgroup', { label }, opts.map(opt)) : opts.map(opt))));
  }

  function openInfo(title, body) {
    const box = h('div', { class: 'modal info-pop', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'info-title', onclick: (e) => e.stopPropagation() },
      h('div', { class: 'row spread' }, h('h2', { id: 'info-title' }, title), h('button', { class: 'small ghost', onclick: closeModal, 'aria-label': 'Close' }, '✕')),
      h('div', { class: 'stack tight small' }, body));
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    root.appendChild(h('div', { class: 'modal-backdrop', onclick: closeModal }, box));
    document.addEventListener('keydown', escClose);
  }

  // The (i): hover for the details where the game's hover card is loaded (UI.tip); the GM table opens a pop-up.
  function infoButton(title, body) {
    if (UI.tip) return UI.tip(() => [h('b', null, title), body()], `About ${title}`);
    return h('button', { class: 'info-btn', type: 'button', 'aria-label': `About ${title}`, title: 'Details', onclick: (e) => { e.stopPropagation(); openInfo(title, body()); } }, 'i');
  }

  function facts(rows) {
    return h('dl', { class: 'facts' }, rows.filter((r) => r && r[1] != null && r[1] !== '').map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
  }

  const ACTION_INFO = {
    block: 'Meets the next blow, arrow or bolt with the shield: a fixed roll against the shield\'s target number.',
    parry: 'Meets the next blow with the weapon: your DEX/SPD against the attacker\'s STR/SPD, ties to you. No parry against arrows, spells or power blows; it waits for the next blow.',
    dodge: 'Slips the next attack of any kind: your DEX/SPD against the attacker\'s STR/SPD, ties to you.',
    offParry: 'The off-hand dagger meets the next thrust only.',
    trip: 'Knocks a foe down: opposed roll.',
    disarm: 'Knocks the weapon from a foe\'s hand: opposed roll.',
    shove: 'Pushes a foe back a square; a foe pushed mid-move loses the move.',
    clinch: 'Closes in and takes hold: the first step of the grappling ladder.',
    grapple: 'From a clinch to a hold.',
    pin: 'From a hold to a pin: the pinned can only try to break free, and armor no longer guards their vitals.',
    throw: 'Throws a held foe to the ground.',
    break: 'Breaks free of a hold.',
    bait: 'CHA against the foe\'s WIS. Won: they commit too early and defend worse for the round.',
    readIntent: 'A cheap glance: WIS against the foe\'s CHA. Read right, you gain on guarding against them and on hitting through their guards. You can misread, and a misread costs you.',
    bandage: 'Stops one bleed on yourself or someone adjacent.',
    windUp: 'Gathers a power swing or a Strong spell; release it next round.',
  };

  const SHAPE_INFO = {
    strike: 'A bolt at one target.', launch: 'A bolt at one target.',
    area: 'Bursts over every square within the radius. Friends too.',
    ground: 'Covers the ground for some rounds. Friends too.',
    wall: 'Raises a wall across squares, square by square from the one you tap.',
    terrain: 'Opens or changes the ground.',
    rune: 'A hidden rune that springs on the first foe to step on it.',
    bane: 'A curse on one foe; resisted.', mind: 'Works on one mind; WIL resists.',
    boon: 'A blessing on an ally or yourself.', ward: 'A ward on an ally or yourself.',
    blink: 'Steps through space, through walls and out of any hold.',
    conjure: 'Calls up a creature that fights for some rounds.',
  };

  const sortTargets = (ts, chars, me, preferAlly) => ts.slice().sort((a, b) => {
    const fa = (chars[a.id].side !== me.side) !== !!preferAlly, fb = (chars[b.id].side !== me.side) !== !!preferAlly;
    return (fb - fa) || (b.inReach - a.inReach) || ((a.distance || 0) - (b.distance || 0));
  });

  // Every choice open to the actor, by type. Each entry knows how to declare and explain itself.
  function commandModel(app, enc, legal, c) {
    const chars = app.state.characters;
    const why = (o) => o.why || (o.affordable ? null : 'Not enough AP');
    const martial = [], maneuver = [], magic = [], other = [];
    for (const o of legal.attacks) {
      const e = { key: 'a:' + C.optionKey(o), option: o, ap: o.ap, stamina: o.stamina, sp: o.spCost, affordable: o.affordable, why: why(o) };
      if (o.spell) magic.push(Object.assign(e, { kind: 'strike', label: o.label, targets: sortTargets(o.targets, chars, c) }));
      else {
        const w = o.weaponId ? c.weapons.find((x) => x.id === o.weaponId) : null;
        martial.push(Object.assign(e, { group: 'Attacks', kind: 'strike', label: o.label + (w ? ` · ${Items.itemName(w)}` : ''), weapon: w, targets: sortTargets(o.targets, chars, c) }));
      }
    }
    for (const m of legal.maneuvers) {
      const e = { key: 'm:' + m.type, kind: 'maneuver', type: m.type, label: D.ACTIONS[m.type].name, ap: m.ap, stamina: m.stamina, affordable: m.affordable, why: m.affordable ? null : m.targets.some((t) => t.inReach) ? 'Not enough AP' : 'No one in reach', targets: sortTargets(m.targets, chars, c) };
      if (m.type === 'bait' || m.type === 'readIntent') other.push(Object.assign(e, { group: 'Wits' }));
      else maneuver.push(Object.assign(e, { group: 'Maneuvers' }));
    }
    for (const o of legal.spells || []) {
      magic.push({ key: 's:' + o.spellKey, kind: 'cast', option: o, label: o.label, ap: o.ap, stamina: 0, sp: o.spCost, affordable: o.affordable, why: why(o),
        square: o.target === 'square', targets: o.target === 'square' ? null : sortTargets(o.targets || [], chars, c, o.target === 'ally') });
    }
    legal.other.forEach((o, i) => other.push({ key: 'o:' + o.type + (o.option ? ':' + C.optionKey(o.option) : ''), group: o.type === 'windUp' ? 'Wind up' : 'Gear and self', kind: 'other', type: o.type, option: o.option,
      label: o.name.replace(/^Wind up: /, '') + (o.note ? ` (${o.note})` : ''), ap: o.ap, stamina: o.stamina, affordable: o.affordable, why: why(o),
      targets: o.targets ? sortTargets(o.targets, chars, c, true) : null }));
    const move = legal.move ? { key: 'move', kind: 'move', label: 'Move', ap: C.moveCost(c, 1), stamina: legal.move.stamina, affordable: true, move: legal.move } : null;
    // The tabs: [key, label, icon, any affordable].
    const types = [];
    const ok = (list) => list.some((e) => e.affordable);
    if (martial.length) types.push(['martial', 'Attack', 'sword', ok(martial)]);
    if (maneuver.length) types.push(['maneuver', 'Maneuver', 'hand', ok(maneuver)]);
    if (magic.length) types.push(['magic', 'Magic', 'star', ok(magic)]);
    if (move) types.push(['move', 'Move', 'boot', legal.move.maxSquares > 0]);
    if (other.length) types.push(['other', 'Other', 'dots', ok(other)]);
    return { martial, maneuver, magic, other, move, types };
  }

  // Keep the chosen type and action valid, and set the map's highlighting to match: targets to
  // tap, squares to cast at, or squares to move to. Runs before the map draws.
  function syncCommand(app, enc, legal) {
    const ui = bui(app);
    const id = Combat.currentActor(enc);
    const c = app.state.characters[id];
    const model = commandModel(app, enc, legal, c);
    if (!ui.cmd || ui.cmd.for !== id) {
      ui.cmd = { for: id, type: null, act: null, target: null, vs: '' };
    }
    const cmd = ui.cmd;
    if (!model.types.some((t) => t[0] === cmd.type)) cmd.type = model.types[0] ? model.types[0][0] : null;
    let entry = null;
    if (cmd.type === 'move') entry = model.move;
    else if (cmd.type === 'magic') entry = pickMagic(model.magic, cmd);
    else if (cmd.type) {
      const list = model[cmd.type];
      entry = list.find((e) => e.key === cmd.act) || list.find((e) => e.affordable) || list[0] || null;
      cmd.act = entry ? entry.key : null;
    }
    if (entry && entry.targets) {
      // The preferred side first, in reach first; a host that wants the player to pick (app.hooks.choose) starts with none.
      if (!entry.targets.some((t) => t.id === cmd.target)) cmd.target = app.hooks && app.hooks.choose ? null : entry.targets[0] ? entry.targets[0].id : null;
    }
    // The map follows the choice.
    if (ui.mode !== 'place') {
      ui.mode = null;
      ui.pending = null;
      if (entry && entry.kind === 'move') ui.mode = 'move';
      else if (entry && entry.square) { ui.mode = 'cast'; ui.pending = { option: entry.option }; }
      else if (entry && entry.targets && entry.targets.length) {
        ui.mode = 'target';
        ui.pending = { kind: entry.kind === 'strike' || entry.kind === 'cast' ? entry.kind : 'other', type: entry.type, option: entry.option, label: entry.label, targets: entry.targets };
      }
    }
    return { model, entry };
  }

  // Magic: verb, then noun (or a doubled pair), then modifier, each filtered to what combines.
  function pickMagic(list, cmd) {
    const verbs = [...new Set(list.map((e) => e.option.spell.verb))];
    const firstGood = (xs) => xs.find((e) => e.affordable) || xs[0];
    if (!verbs.includes(cmd.mVerb)) cmd.mVerb = (firstGood(list) || {}).option.spell.verb;
    const byVerb = list.filter((e) => e.option.spell.verb === cmd.mVerb);
    const nounKey = (e) => e.option.spell.nouns.join('+');
    if (!byVerb.some((e) => nounKey(e) === cmd.mNoun)) cmd.mNoun = nounKey(firstGood(byVerb.filter((e) => !e.option.spell.mod)) || firstGood(byVerb));
    const byNoun = byVerb.filter((e) => nounKey(e) === cmd.mNoun);
    if (!byNoun.some((e) => (e.option.spell.mod || '') === cmd.mMod)) cmd.mMod = (byNoun.find((e) => !e.option.spell.mod) || byNoun[0]).option.spell.mod || '';
    const entry = byNoun.find((e) => (e.option.spell.mod || '') === cmd.mMod);
    cmd.act = entry.key;
    return entry;
  }

  function magicPicker(app, model, cmd) {
    const W = G.CONFIG.magic.words;
    const set = (k) => (v) => { cmd[k] = v; app.render(); };
    const verbs = [...new Set(model.magic.map((e) => e.option.spell.verb))];
    const byVerb = model.magic.filter((e) => e.option.spell.verb === cmd.mVerb);
    const nouns = [...new Map(byVerb.map((e) => [e.option.spell.nouns.join('+'), e.option.spell])).entries()];
    const byNoun = byVerb.filter((e) => e.option.spell.nouns.join('+') === cmd.mNoun);
    const nounLabel = (s) => s.nouns.map((n) => W[n].name).join(' + ') + (s.combo ? ` → ${s.combo}` : '');
    const field = (label, el) => h('label', { class: 'pick' }, h('span', { class: 'label' }, label), el);
    return h('div', { class: 'spell-pick' },
      field('Verb', UI.select('cmd-verb', cmd.mVerb, verbs.map((v) => [v, W[v].name]), set('mVerb'))),
      field('Noun', UI.select('cmd-noun', cmd.mNoun, nouns.map(([k, s]) => [k, nounLabel(s)]), set('mNoun'))),
      field('Modifier', UI.select('cmd-mod', cmd.mMod, byNoun.map((e) => [e.option.spell.mod || '', e.option.spell.mod ? W[e.option.spell.mod].name : '—']), set('mMod'))));
  }

  function entryInfo(app, enc, c, e) {
    const o = e.option;
    const rows = [['Cost', costText(e.ap, e.stamina, e.sp)]];
    const notes = [];
    if (e.kind === 'strike' && !o.spell) {
      const range = (o.minRange === o.maxRange ? `${o.maxRange}` : `${o.minRange}–${o.maxRange}`) + (o.closePenalty ? (G.CONFIG.range.closeRule === 'blunt' ? ' (half force, blunt, at 1)' : ' (half at 1)') : '');
      rows.unshift(['Weapon', e.weapon ? Items.itemName(e.weapon) : 'Unarmed'], ['Damage', `P/S/B ${o.damage.join('/')}`], ['Range', range]);
      if (o.strain > 1) rows.push(['Strain', `${o.strain.toFixed(1)}× your strength: slow and tiring (AP and stamina ×${(o.strain * o.strain).toFixed(1)})`]);
      if (o.windUp) notes.push('Needs a wind-up the round before (under Other).');
    } else if (o && o.spell) {
      const s = o.spell;
      const shape = { area: `radius ${s.radius}`, ground: `radius ${s.radius}, ${s.rounds} rounds`, wall: `${s.length} squares, ${s.rounds} rounds`, terrain: `${s.length} square${s.length > 1 ? 's' : ''}`, bane: `${s.rounds} rounds`, boon: `${s.rounds} rounds`, conjure: `${s.rounds} rounds`, ward: `${s.rounds} rounds`, mind: `${s.rounds} rounds` }[s.shape];
      rows.unshift(['Power', `${s.magnitude}${s.element ? ' ' + s.element : ''}`], ['Range', s.named ? 'anyone whose name you know, anywhere' : `${o.minRange}–${o.maxRange}`], shape ? ['Reach', shape] : null);
      notes.push(SHAPE_INFO[s.shape] || '');
      if (e.square) notes.push('Tap a highlighted square on the map to cast.');
    } else if (e.kind === 'move') {
      const m = e.move;
      rows.unshift(['With your AP', `up to ${m.maxSquares} squares`]);
      notes.push('Click a square; the number is its AP. Walls are walked around; rough ground costs more. Stepping into a foe\'s reach, out of it, or twice within it lets them strike at you; one step within it is free.');
    } else notes.push(ACTION_INFO[e.type] || '');
    if (e.why) rows.push(['Unavailable', e.why]);
    return [facts(rows), notes.filter(Boolean).map((n) => h('p', null, n))];
  }

  // Where a blow may be aimed (CONFIG.locations.aim): anywhere once wounds differ by location, else only at someone
  // whose armor differs. Returns null, or
  // { best, rows: [[value, label]] } with 'best' (the expected-best place, the default), 'unaimed', each location.
  function aimChoices(enc, chars, id, e, targetId) {
    const L = G.CONFIG.locations;
    const a = chars[id], t = targetId ? chars[targetId] : null;
    if (!L || !L.aim || !t || e.kind !== 'strike' || !e.option || e.option.spell || e.option.unarmed || (!L.wounds && C.armorUniform(t))) return null;
    const d = Combat.dist(enc.pos[id], enc.pos[targetId]);
    const best = G.AI.bestAim(a, t, e.option, d);
    const show = (loc) => {
      const o = Object.assign({}, e.option, loc ? { aim: loc } : {});
      const p = blowPreview(enc, chars, { decl: { actor: id, target: targetId, type: 'strike', option: o } });
      const pen = loc ? Combat.aimPenalty(o, loc) : 0;
      const piece = loc ? C.armorAt(t, loc) : null;
      return `${loc ? L.names[loc] || loc : 'Unaimed'}${pen ? ` (−${pen})` : ''}${loc ? (piece ? '' : ' · bare') : ''}${p ? ` · ${p.text}` : ''}`;
    };
    const bestLabel = best && best.loc ? (L.names[best.loc] || best.loc) : 'unaimed';
    return { best: best ? best.loc : null, rows: [['best', `Best (${bestLabel})`], ['unaimed', show(null)]].concat(L.order.map((l) => [l, show(l)])) };
  }

  function declareEntry(app, enc, id, e, cmd) {
    const t = cmd.target;
    if (e.kind === 'strike') {
      const ac = aimChoices(enc, app.state.characters, id, e, t);
      const pick = !ac || !cmd.location || cmd.location === 'unaimed' ? null : cmd.location === 'best' ? ac.best : cmd.location;
      return declare(app, enc, Object.assign({ actor: id, type: 'strike', option: e.option, target: t }, pick ? { location: pick } : {}));
    }
    if (e.kind === 'strike' || e.kind === 'cast') return declare(app, enc, { actor: id, type: e.kind, option: e.option, target: t });
    if (e.kind === 'guard') return declare(app, enc, { actor: id, type: e.type, against: cmd.vs || null });
    return declare(app, enc, e.targets ? { actor: id, type: e.type, target: t } : { actor: id, type: e.type, option: e.option });
  }

  // The pane's head: who, their AP as pips (the ones just spent flash), stamina and SP.
  function paneHead(app, enc, id, legal) {
    const chars = app.state.characters;
    const c = chars[id];
    const ui = bui(app);
    const pool = legal ? legal.pool : null, left = legal ? legal.ap : enc.ap[id] != null ? Combat.apLeft(enc, id) : null;
    // Pips spent since the last look flash for a moment (the flash outlives re-renders: its delay is set back by the time gone).
    const now = Date.now();
    const seen = ui.apSeen;
    if (left != null && seen && seen.id === id && seen.round === enc.round && left < seen.ap - 1e-9) ui.apFlash = { id, from: seen.ap, to: left, at: now };
    if (left != null) ui.apSeen = { id, ap: left, round: enc.round };
    const fl = ui.apFlash && ui.apFlash.id === id && now - ui.apFlash.at < 900 ? ui.apFlash : null;
    const sp = G.Magic && G.Magic.maxSP(c) ? G.Magic.availableSP(c) : null;
    const max = C.maxStamina(c);
    return h('div', { class: 'cmd-head' },
      UI.Sprites ? h('button', { class: 'cmd-face', title: 'Character sheet', 'aria-label': `${c.name}: character sheet`, onclick: () => openSheet(app, enc, id) }, UI.Sprites.portrait(c, 40)) : null,
      h('div', { class: 'cmd-id' },
        h('button', { class: 'who linkish', onclick: () => openSheet(app, enc, id), title: 'Character sheet' }, c.name),
        h('div', { class: 'cmd-stats', title: `Stamina ${c.stamina}/${max}${sp != null ? ` · ${sp} SP` : ''}` }, bar(c.stamina, max), h('span', { class: 'small num muted' }, `${c.stamina}${sp != null ? ` · ${sp} SP` : ''}`))),
      pool != null ? h('div', { class: 'cmd-ap', title: `${C.fmtAP(left)} of ${C.fmtAP(pool)} AP left this round` }, apMeter(pool, left, fl, now), h('span', { class: 'num' }, C.fmtAP(left))) : null);
  }

  function pane(cls, head, body, foot) {
    return h('section', { class: 'panel cmd' + (cls ? ' ' + cls : '') }, head, h('div', { class: 'cmd-body' }, body), foot ? h('div', { class: 'cmd-foot' }, foot) : null);
  }

  // What the chosen target would take if the blow lands, for the pane and the map's hover card.
  function strikePreview(enc, chars, id, entry, targetId) {
    if (!entry || entry.kind !== 'strike' || !entry.option || entry.option.spell || !targetId) return null;
    return blowPreview(enc, chars, { decl: { actor: id, target: targetId, type: 'strike', option: entry.option } });
  }

  function declarePanel(app, enc, legal, sync) {
    const chars = app.state.characters;
    const ui = bui(app);
    const id = Combat.currentActor(enc);
    const c = chars[id];
    // A computer-run foe's AP stays hidden, as everywhere else.
    if (aiControlled(app, c)) return pane('waiting ' + (c.side === 'party' ? 'party' : 'enemy'), paneHead(app, enc, id, c.side === 'party' || app.state.settings.gmView ? legal : null), h('p', { class: 'muted small' }, c.side === 'party' ? 'Deciding…' : 'Their turn. You will be asked if one of yours can react.'));
    const head = paneHead(app, enc, id, legal);

    const { model, entry } = sync;
    const cmd = ui.cmd;
    const rerender = () => app.render();
    const tabs = model.types.length > 1 ? h('div', { class: 'cmd-tabs', role: 'tablist' }, model.types.map(([k, label, ic, can], i) =>
      h('button', { class: 'cmd-tab' + (cmd.type === k ? ' on' : '') + (can ? '' : ' dim'), role: 'tab', 'aria-selected': cmd.type === k ? 'true' : 'false', title: `${label} (${i + 1})`,
        onclick: () => { cmd.type = k; cmd.act = null; cmd.moveTo = null; cmd.castAt = null; rerender(); } },
      UI.icon ? UI.icon(ic, 16) : null, h('span', null, label)))) : null;
    const rows = [];
    const field = (label, el, extra) => h('label', { class: 'pick' }, h('span', { class: 'label' }, label), el, extra || null);
    const info = entry ? infoButton(entry.label, () => entryInfo(app, enc, c, entry)) : null;
    if (cmd.type === 'magic') rows.push(magicPicker(app, model, cmd));
    else if (cmd.type && cmd.type !== 'move') {
      const list = model[cmd.type];
      const groups = [...new Set(list.map((e) => e.group))].map((g) => [list.length > 4 && g ? g : null, list.filter((e) => e.group === g).map((e) => [e.key, `${e.label} — ${e.affordable ? C.fmtAP(e.ap) + ' AP' : e.why}`, !e.affordable])]);
      rows.push(field('Action', selectGroups('cmd-act', cmd.act, groups, (v) => { cmd.act = v; cmd.castAt = null; rerender(); }), info));
    }
    // What the action is aimed at.
    let target = null;
    if (entry && entry.targets) {
      target = entry.targets.find((t) => t.id === cmd.target) || null;
      rows.push(field('Target', entry.targets.length
        ? UI.select('cmd-target', cmd.target || '', (cmd.target ? [] : [['', 'Choose a target…']]).concat(entry.targets.map((t) => [t.id, `${chars[t.id].name}${t.distance != null ? ` · ${t.distance} sq` : ''}${t.inReach ? '' : t.tooClose ? ' · too close' : ' · out of reach'}`])), (v) => { cmd.target = v || null; rerender(); })
        : h('span', { class: 'muted small' }, 'No one in sight')));
      // Where to aim it (armor by location): the expected-best place by default.
      const ac = aimChoices(enc, chars, id, entry, cmd.target);
      if (ac) {
        if (!ac.rows.some((r) => r[0] === cmd.location)) cmd.location = 'best';
        rows.push(field('Aim', UI.select('cmd-location', cmd.location, ac.rows, (v) => { cmd.location = v; rerender(); })));
      }
      const prev = strikePreview(enc, chars, id, entry, cmd.target);
      if (prev) rows.push(h('div', { class: 'cmd-preview' + (prev.wound || prev.stamina ? '' : ' nil') }, h('span', { class: 'label', title: 'If it lands, through their armor' }, 'On hit'), h('span', null, prev.text)));
    } else if (entry && (entry.kind === 'guard' || entry.kind === 'ready')) {
      const vs = legal.guardAgainst.includes(cmd.vs) ? cmd.vs : '';
      rows.push(field('Against', UI.select('cmd-vs', vs, [['', 'The next attack']].concat(legal.guardAgainst.map((o) => [o, chars[o].name])), (v) => { cmd.vs = v; rerender(); })));
    }
    if (entry && cmd.type === 'move') rows.push(h('div', { class: 'cmd-preview' }, h('span', { class: 'label' }, 'Move'), h('span', null, `up to ${entry.move.maxSquares} sq`), info));
    else if (entry && cmd.type === 'magic') rows.push(h('div', { class: 'cmd-preview' }, h('span', { class: 'label' }, 'Cost'), h('span', null, costText(entry.ap, entry.stamina, entry.sp)), info));

    // The button that does it, and End turn: always at the foot of the pane.
    let go = null;
    if (entry) {
      const tapOnly = entry.kind === 'move' || entry.square;
      const blocked = !entry.affordable || (entry.targets && !target);
      const chosen = entry.kind === 'move' ? cmd.moveTo : entry.square ? cmd.castAt : null;
      const reachAP = chosen && entry.kind === 'move' && app.ui.lastReach ? app.ui.lastReach[chosen.x + ',' + chosen.y] : null;
      const name = entry.label.split(' · ')[0].replace(/\s*\(.*\)$/, '');
      go = chosen
        ? h('button', { class: 'primary', onclick: () => declare(app, enc, entry.kind === 'move' ? { actor: id, type: 'move', to: chosen } : { actor: id, type: 'cast', option: entry.option, at: chosen }) },
          h('span', null, entry.kind === 'move' ? 'Move here' : `${name} here`), h('span', { class: 'cost' }, entry.kind === 'move' ? (reachAP != null ? `${C.fmtAP(reachAP)} AP` : '') : costText(entry.ap, entry.stamina, entry.sp)))
        : tapOnly
        ? h('span', { class: 'tap-hint' }, 'Click a square on the map')
        : entry.targets && entry.targets.length && !target && app.hooks && app.hooks.choose
        ? h('span', { class: 'tap-hint' }, 'Click a target on the map')
        : h('button', { class: 'primary', disabled: blocked, title: entry.why || 'Enter', onclick: () => declareEntry(app, enc, id, entry, cmd) },
          h('span', null, target ? `${name} → ${chars[target.id].name}` : name), h('span', { class: 'cost' }, costText(entry.ap, entry.stamina, entry.sp)));
    }
    return pane('', h('div', null, head, tabs), rows, [
      go ? h('div', { class: 'cmd-go' }, go) : null,
      h('div', { class: 'cmd-end' },
        h('button', { class: 'end', title: (legal.ap ? `Keep ${C.fmtAP(legal.ap)} AP to defend with until the round ends` : 'Nothing left this round') + ' (E)', onclick: () => finishTurn(app, enc, id) }, legal.ap ? `End turn · keep ${C.fmtAP(legal.ap)} AP` : 'End turn'),
        infoButton('Turns and AP', () => [
          h('p', null, 'Spend as much AP as you like on your turn; each action resolves as you take it.'),
          h('p', null, 'AP you keep pays for reactions: a block, parry or dodge when a blow comes, or a strike at a foe who enters your reach, leaves it, or steps twice in it. AP left when the round ends is lost.')])),
    ]);
  }

  function phasePanel(app, enc, legal, sync) {
    const chars = app.state.characters;
    const ui = bui(app);
    const roller = UI.Dice.makeRoller(app);
    if ((enc.phase === 'setup' || enc.phase === 'roundEnd') && app.hooks) {
      // Inside the game: rounds begin by themselves; the party may try to flee between them.
      return pane('waiting', h('div', { class: 'who' }, `Round ${enc.round + 1}`), null, [
        h('div', { class: 'cmd-go' }, h('button', { class: 'primary', onclick: async () => { await Combat.startRound(enc, chars, roller); app.save(); app.render(); } }, 'Roll initiative')),
        app.hooks.flee ? h('div', { class: 'cmd-end' }, h('button', { class: 'end', onclick: () => app.hooks.flee(app, enc) }, 'Flee')) : null]);
    }
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
    if (enc.phase === 'turn' && legal && !ui.busy) return declarePanel(app, enc, legal, sync);
    if (enc.phase === 'turn' || enc.phase === 'acting') {
      const id = Combat.currentActor(enc) || enc.order[enc.turn];
      if (!id || !chars[id]) return pane('waiting', h('div', { class: 'who' }, 'Resolving'), null);
      const mine = chars[id].side === 'party';
      return pane('waiting ' + (mine ? 'party' : 'enemy'), paneHead(app, enc, id, (mine || app.state.settings.gmView) && enc.ap[id] != null ? { pool: enc.apStart[id] || Combat.apLeft(enc, id), ap: Combat.apLeft(enc, id) } : null),
        h('p', { class: 'muted small' }, mine ? 'Acting…' : 'Their turn. You will be asked if one of yours can react.'));
    }
    if (enc.phase === 'over') return app.hooks && app.hooks.over ? app.hooks.over(app, enc) : lootPanel(app, enc);
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
    return app.state.settings.gmView || id === Combat.currentActor(enc) || enc.phase === 'roundEnd' || enc.phase === 'over';
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
    if (app.hooks && app.hooks.sheet) return app.hooks.sheet(id);
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
        h('div', { class: 'row spread small' }, h('span', { class: 'num' }, `Stamina ${c.stamina}/${max} · regen ${C.regen(c)}`), seeAP ? h('span', { class: 'num' }, `${C.fmtAP(enc.ap[id])} AP left this round`) : h('span', { class: 'muted' }, 'AP hidden')),
        bar(c.stamina, max)),
      UI.Cards.statusChips(c).length ? h('div', { class: 'row', style: { gap: '4px' } }, UI.Cards.statusChips(c)) : null,
      h('div', { class: 'derived attrs' }, attrs),
      h('div', { class: 'stack tight small' },
        h('div', null, h('b', null, 'Wielding: '), w ? Items.itemName(w) : 'Unarmed'),
        c.weapons.length > 1 ? h('div', null, h('b', null, 'Also carrying: '), c.weapons.filter((x) => x !== w).map(Items.itemName).join(', ')) : null,
        h('div', null, h('b', null, 'Armor: '), c.armor ? `${Items.itemName(c.armor)} · durability ${ai.durability}/${ai.maxDurability}` : 'none'),
        c.shield ? h('div', null, h('b', null, 'Shield: '), `${Items.itemName(c.shield)} · durability ${c.shield.durability}`) : null,
        c.inventory.arrows || c.inventory.bodkins ? h('div', null, h('b', null, 'Arrows: '), `${c.inventory.arrows || 0} broadhead, ${c.inventory.bodkins || 0} bodkin`) : null,
        (c.trinkets || []).length ? h('div', null, h('b', null, 'Wearing: '), c.trinkets.map((t) => t.name).join(', ')) : null,
        c.traits && c.traits.aura ? h('div', null, h('b', null, 'Aura: '), `${c.traits.aura.name || 'aura'} — foes within ${c.traits.aura.radius} squares lose ${c.traits.aura.stamina} stamina each round${c.traits.aura.cond ? ` and fall into ${G.CONFIG.conditions[c.traits.aura.cond].name.toLowerCase()}` : ''}`) : null,
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
    if (app.hooks && app.hooks.autoStart && (enc.phase === 'setup' || enc.phase === 'roundEnd') && !app.ui.starting) {
      app.ui.starting = true;
      setTimeout(async () => {
        app.ui.starting = false;
        if (app.state.encounter !== enc || !(enc.phase === 'setup' || enc.phase === 'roundEnd')) return;
        await Combat.startRound(enc, chars, UI.Dice.makeRoller(app));
        app.save();
        app.render();
      }, enc.phase === 'setup' ? 500 : 1100);
      return;
    }
    if (enc.phase !== 'turn') return;
    const id = Combat.currentActor(enc);
    if (!id || !aiControlled(app, chars[id]) || app.ui.aiPending || bui(app).busy) return;
    app.ui.aiPending = true;
    setTimeout(async () => {
      if (app.state.encounter !== enc || enc.phase !== 'turn' || Combat.currentActor(enc) !== id) { app.ui.aiPending = false; return; }
      try { await Combat.submit(enc, chars, G.AI.choose(enc, chars, id), ioFor(app)); } finally { app.ui.aiPending = false; }
      app.save();
      app.render();
    }, 450);
  }

  function view(app) {
    const enc = app.state.encounter;
    if (!enc) return setupView(app);
    const chars = app.state.characters;
    const legal = enc.phase === 'turn' ? Combat.legalActions(enc, chars, Combat.currentActor(enc)) : null;
    scheduleAI(app, enc);
    const human = legal && !aiControlled(app, chars[Combat.currentActor(enc)]);
    const sync = human ? syncCommand(app, enc, legal) : null;
    if (legal && !human && bui(app).mode !== 'place') { bui(app).mode = null; bui(app).pending = null; }
    const status = enc.phase === 'turn' || enc.phase === 'acting' ? `${(app.state.characters[enc.order[enc.turn]] || {}).name || ''}'s turn` : enc.phase === 'over' ? 'The fight is over' : '';
    return h('div', { class: 'battle-view' },
      h('div', { class: 'battle-head' },
        h('h1', null, enc.round ? `Round ${enc.round}` : 'Battle'),
        h('span', { class: 'small muted' }, status),
        enc.phase !== 'over' && !app.hooks ? UI.confirmButton('Abandon', 'Abandon? Wounds stay', () => {
          Combat.cleanup(enc, chars);
          app.state.encounter = null;
          app.ui.battleSetup = null;
          app.save(); app.render();
        }) : null),
      h('div', { class: 'battle' },
        rosterView(app, enc),
        h('div', { class: 'battle-map' }, mapView(app, enc, legal)),
        h('div', { class: 'battle-side stack' }, phasePanel(app, enc, legal, sync), declsView(app, enc), logView(app, enc))));
  }

  UI.Views.battle = view;
  // The pieces the game's own battle screen (src/ui/game/screens/battle.js) reuses.
  UI.Views.battleParts = { bui, mapState, cellClick, declarePanel, phasePanel, scheduleAI, syncCommand, aiControlled, openInfo, closeModal, declare, declareEntry, finishTurn, ioFor, reactionModel, blowPreview, aimChoices, TILE_GLYPH };
})(globalThis.BBB);
