/* Parley: a conversation as a contest. See src/game/parley.js for the rules. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, toast } = UI;
  const Parley = G.Parley;
  const World = G.World;
  const Skills = G.Skills;
  const Bits = UI.Bits;

  const MOVES = [
    ['charm', 'Charm', 'charm', 'Warm them to you. Raises how they feel; they remember a little of it.'],
    ['appeal', 'Appeal', 'appeal', 'Show how helping you serves something they care about. Pick what.'],
    ['intimidate', 'Intimidate', 'intimidation', 'Make willingness by fear. Costs how they feel; armor and a violent name help. A bad failure ends the talk.'],
    ['bluff', 'Bluff', 'deception', 'Say what is not so. Helps with some requests; caught lying, it costs.'],
  ];

  // The meters flash green or red for a moment when a move shifts them (the flash outlives re-renders).
  function shift(ui, key, now) {
    const seen = ui.parleySeen || (ui.parleySeen = {});
    const t = Date.now();
    if (seen[key] != null && now != null && now !== seen[key]) seen[key + 'Flash'] = { up: now > seen[key], at: t };
    seen[key] = now;
    const f = seen[key + 'Flash'];
    return f && t - f.at < 900 ? { class: f.up ? ' up' : ' down', style: { animationDelay: `-${t - f.at}ms` } } : { class: '', style: null };
  }

  function mood(v, ui) {
    if (!ui.parleySeen || ui.parleySeen.session !== v.session) ui.parleySeen = { session: v.session };
    const pct = ((v.disposition + 5) / 10) * 100;
    const fd = shift(ui, 'disp', v.disposition), fw = shift(ui, 'will', v.showIntent ? v.willingness : null), fp = shift(ui, 'pat', Math.ceil(v.patience));
    return h('div', { class: 'meters stack tight' },
      h('div', { class: 'meter-row' + fd.class, style: fd.style }, h('span', { class: 'label' }, 'They feel'),
        h('div', { class: 'track' }, h('span', { class: 'mark', style: { left: pct + '%' } }), h('span', { class: 'zero' })),
        h('span', { class: 'small' }, v.showDisp ? `${v.disposition > 0 ? '+' : ''}${v.disposition} · ${v.mood}` : v.mood)),
      h('div', { class: 'meter-row' + fw.class, style: fw.style }, h('span', { class: 'label' }, 'Willing'),
        v.showIntent ? h('span', { class: 'num' }, `${v.willingness} of 10`) : h('span', { class: 'muted small', title: 'Read them (Read Intent) to see it' }, '?')),
      h('div', { class: 'meter-row' + fp.class, style: fp.style }, h('span', { class: 'label' }, 'Patience'),
        h('span', { class: 'pips' }, Array.from({ length: v.patienceMax }, (_, i) => h('span', { class: `pip ${i < Math.ceil(v.patience) ? 'on' : ''}` })))));
  }

  UI.Screens.parley = function (game) {
    const w = game.world;
    const v = Parley.view(w);
    if (!v) { game.go(w.explore ? 'explore' : 'town'); return h('div'); }
    const s = v.session;
    const npc = v.npc;
    const ui = game.ui;
    const party = World.active(w);
    const speaker = ui.speaker && w.chars[ui.speaker] && party.includes(w.chars[ui.speaker]) ? ui.speaker : '';
    const run = (kind, args) => {
      const r = Parley.move(w, kind, Object.assign({ who: speaker || undefined }, args || {}));
      if (!r.ok) { toast(r.reason); return; }
      if (r.check) World.logLine(w, Bits.checkText(r.check), r.check.ok ? 'find' : 'check');
      for (const l of r.lines || []) World.logLine(w, l, 'info');
      game.save(); game.render();
    };
    const ask = (id) => {
      const r = Parley.ask(w, id);
      if (!r.ok && r.reason !== 'locked') { toast(r.reason); }
      game.save(); game.render();
    };
    const disabled = s.ended;
    const spent = s.last;
    // A move is one button: its name, the speaker's bonus and its patience cost; what it does on hover.
    const moveBtn = (m) => {
      const [id, label, skill, blurb] = m;
      const who = speaker ? w.chars[speaker] : Skills.best(party, skill);
      const cost = v.costs[id];
      const bonus = who ? Skills.mod(who, skill) : 0;
      const tip = `${blurb}\n${who ? who.name : ''} ${bonus >= 0 ? '+' : ''}${bonus} · costs ${cost} patience`;
      const btn = (extra) => h('button', { class: 'move-btn', title: tip, disabled: disabled || spent, onclick: () => run(id, extra ? extra() : undefined) },
        h('b', null, label), h('span', { class: 'small muted num' }, `${bonus >= 0 ? '+' : ''}${bonus} · ${cost}◷`));
      if (id !== 'appeal') return btn();
      const tags = v.allTags;
      const cur = ui.tag || (v.interests && v.interests[0]) || tags[0];
      return h('div', { class: 'move-pair' },
        btn(() => ({ tag: ui.tag || cur })),
        h('select', { 'aria-label': 'Appeal to', title: '★ marks what they care about, once you know it', onchange: (e) => { ui.tag = e.target.value; } }, tags.map((t) => h('option', { value: t, selected: t === cur }, (v.interests && v.interests.includes(t) ? '★ ' : '') + t))));
    };
    const step = G.CONFIG.game.parley.bribeStep;
    const bribe = h('div', { class: 'move-pair' },
      h('button', { class: 'move-btn', title: 'Gold buys willingness from the venal, a few coins at a time (at most three steps). Anyone else is insulted.', disabled: disabled || w.gold < (ui.bribe || 1) * step, onclick: () => run('bribe', { steps: ui.bribe || 1 }) },
        h('b', null, 'Bribe'), h('span', { class: 'small muted num' }, 'free')),
      h('select', { 'aria-label': 'How much', onchange: (e) => { ui.bribe = Number(e.target.value); game.render(); } }, [1, 2, 3].map((n) => h('option', { value: n, selected: n === (ui.bribe || 1) }, `${n * step} ◈`))));
    const read = h('button', { class: 'move-btn', title: 'Watch hands and eyes. Read the Room shows how they feel; Read Intent shows what they will do.', disabled, onclick: () => run('read') }, h('b', null, 'Read them'), h('span', { class: 'small muted num' }, 'free'));
    const topicNote = (t) => (t.status === 'done' ? 'Settled.' : t.status === 'locked' ? (v.showIntent ? `Needs willingness ${t.need}; you have ${t.eff}.${t.tag ? ' Tag: ' + t.tag + '.' : ''}` : 'They look unwilling.') : (t.kind === 'quest' ? 'They have work for you.' : t.kind === 'pass' ? 'A way past.' : t.kind === 'favor' ? 'A favor.' : t.kind === 'trade' ? 'Business.' : 'They will tell you.') + (t.lie ? ' You could bluff this one.' : ''));
    const KIND_MARK = { quest: '!', pass: '→', favor: '♥', trade: '◈' };
    const topicRow = (t) => h('div', { class: `topic ${t.status}`, title: topicNote(t) },
      h('span', { class: 'topic-mark' }, t.status === 'done' ? '✓' : t.status === 'locked' ? '🔒' : KIND_MARK[t.kind] || '?'),
      h('b', { class: 'grow' }, t.label),
      t.status === 'locked' && v.showIntent ? h('span', { class: 'small muted num' }, `${t.eff}/${t.need}`) : null,
      t.status === 'done' ? null : h('button', { class: t.status === 'open' ? 'primary small' : 'small', disabled, onclick: () => ask(t.id) }, t.status === 'locked' ? 'Press' : 'Ask'));
    const log = h('div', { class: 'chat', role: 'log' }, s.lines.map((l) => h('div', { class: `bubble ${l.cls}` }, l.who ? h('b', null, l.who + ': ') : null, l.text)));
    setTimeout(() => { if (log.isConnected) log.scrollTop = log.scrollHeight; }, 0);
    const ranks = npc.faction ? G.Factions.rank(w, npc.faction) : null;
    return h('div', { class: 'parley stack' },
      Bits.topBar(game, { title: 'Parley' }),
      h('div', { class: 'parley-main' },
        h('aside', { class: 'stack npc-card' },
          h('div', { class: 'npc-glyph' }, npc.glyph || '🧍'),
          h('h2', { title: npc.look }, npc.name), h('p', { class: 'muted' }, npc.title),
          npc.faction ? h('p', { class: 'small muted' }, `${G.Factions.defs()[npc.faction].name}${ranks ? ': ' + G.Factions.tier(w, npc.faction).toLowerCase() : ''}`) : null,
          mood(v, ui),
          v.session.why && v.session.why.length && v.showDisp ? h('details', { class: 'small' }, h('summary', null, 'Why they feel this way'), v.session.why.map(([k, n]) => h('div', { class: 'row spread' }, h('span', null, k), h('span', { class: 'num' }, (n > 0 ? '+' : '') + n)))) : null,
          v.hasControl ? h('div', { class: 'stack tight' }, h('span', { class: 'label' }, 'Which side of your name?'),
            h('div', { class: 'row' }, [['', 'Both'], ['renown', 'Renown'], ['notoriety', 'Notoriety']].map(([k, l]) => h('button', { class: `small ${(s.side || '') === k ? 'selected' : ''}`, disabled: disabled, onclick: () => run('side', { side: k || null }) }, l)))) : null),
        h('div', { class: 'stack talk' },
          log,
          h('section', { class: 'panel stack tight' }, h('h3', null, 'Ask'),
            v.topics.length ? v.topics.map(topicRow) : h('p', { class: 'muted' }, 'Nothing to ask.')),
          h('section', { class: 'panel stack tight' },
            h('div', { class: 'row spread' },
              h('h3', null, s.ended ? (s.outcome === 'refused' ? 'They will not talk' : 'The talk is over') : s.last ? 'They have had enough. Ask what you came for.' : 'What do you say?'),
              h('label', { class: 'inline' }, h('span', { class: 'label' }, 'Speaker'),
                h('select', { 'aria-label': 'Speaker', onchange: (e) => { ui.speaker = e.target.value; game.render(); } },
                  [h('option', { value: '', selected: !speaker }, 'Whoever is best')].concat(party.map((c) => h('option', { value: c.id, selected: c.id === speaker }, c.name)))))),
            h('div', { class: 'move-grid' }, MOVES.map(moveBtn), bribe, read)),
          h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => game.endParley() }, s.ctx && s.ctx.type === 'encounter' ? 'End the talk' : 'Leave'))),
        h('aside', { class: 'stack side' }, h('h3', null, 'Company'), Bits.partyStrip(game), Bits.logPanel(game, 5))));
  };
})(globalThis.BBB);
