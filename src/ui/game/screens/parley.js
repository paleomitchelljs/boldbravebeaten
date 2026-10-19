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

  function mood(v) {
    const pct = ((v.disposition + 5) / 10) * 100;
    return h('div', { class: 'meters stack tight' },
      h('div', { class: 'meter-row' }, h('span', { class: 'label' }, 'They feel'),
        h('div', { class: 'track' }, h('span', { class: 'mark', style: { left: pct + '%' } }), h('span', { class: 'zero' })),
        h('span', { class: 'small' }, v.showDisp ? `${v.disposition > 0 ? '+' : ''}${v.disposition} · ${v.mood}` : v.mood)),
      h('div', { class: 'meter-row' }, h('span', { class: 'label' }, 'Willing'),
        v.showIntent ? h('span', { class: 'num' }, `${v.willingness} of 10`) : h('span', { class: 'muted small' }, 'unknown (Read Intent shows it)')),
      h('div', { class: 'meter-row' }, h('span', { class: 'label' }, 'Patience'),
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
    const moveBtn = (m) => {
      const [id, label, skill, blurb] = m;
      const who = speaker ? w.chars[speaker] : Skills.best(party, skill);
      const cost = v.costs[id];
      const bonus = who ? Skills.mod(who, skill) : 0;
      if (id === 'appeal') {
        const tags = v.allTags;
        const cur = ui.tag || (v.interests && v.interests[0]) || tags[0];
        return h('div', { class: 'move stack tight' },
          h('div', { class: 'row spread' }, h('b', null, label), h('span', { class: 'small muted' }, `${who ? who.name : ''} ${bonus >= 0 ? '+' : ''}${bonus} · ${cost} patience`)),
          h('p', { class: 'small muted' }, blurb),
          h('div', { class: 'row' },
            h('select', { 'aria-label': 'Appeal to', onchange: (e) => { ui.tag = e.target.value; } }, tags.map((t) => h('option', { value: t, selected: t === cur }, (v.interests && v.interests.includes(t) ? '★ ' : '') + t))),
            h('button', { disabled: disabled || spent, onclick: () => run('appeal', { tag: ui.tag || cur }) }, label)));
      }
      return h('div', { class: 'move stack tight' },
        h('div', { class: 'row spread' }, h('b', null, label), h('span', { class: 'small muted' }, `${who ? who.name : ''} ${bonus >= 0 ? '+' : ''}${bonus} · ${cost} patience`)),
        h('p', { class: 'small muted' }, blurb),
        h('button', { disabled: disabled || spent, onclick: () => run(id) }, label));
    };
    const topicRow = (t) => h('div', { class: `topic ${t.status}` },
      h('div', { class: 'stack tight grow' },
        h('b', null, t.label),
        h('span', { class: 'small muted' }, t.status === 'done' ? 'Settled.' : t.status === 'locked' ? (v.showIntent ? `Needs willingness ${t.need}; you have ${t.eff}.${t.tag ? ' Tag: ' + t.tag + '.' : ''}` : 'They look unwilling.') : (t.kind === 'quest' ? 'They have work for you.' : t.kind === 'pass' ? 'A way past.' : t.kind === 'favor' ? 'A favor.' : t.kind === 'trade' ? 'Business.' : 'They will tell you.') + (t.lie ? ' (You could bluff this one.)' : ''))),
      h('button', { class: t.status === 'open' ? 'primary small' : 'small', disabled: disabled || t.status === 'done' || (t.status === 'locked' && false), onclick: () => ask(t.id) }, t.status === 'locked' ? 'Press' : 'Ask'));
    const log = h('div', { class: 'chat', role: 'log' }, s.lines.map((l) => h('div', { class: `bubble ${l.cls}` }, l.who ? h('b', null, l.who + ': ') : null, l.text)));
    setTimeout(() => { if (log.isConnected) log.scrollTop = log.scrollHeight; }, 0);
    const ranks = npc.faction ? G.Factions.rank(w, npc.faction) : null;
    return h('div', { class: 'parley stack' },
      Bits.topBar(game, { title: 'Parley' }),
      h('div', { class: 'parley-main' },
        h('aside', { class: 'stack npc-card' },
          h('div', { class: 'npc-glyph' }, npc.glyph || '🧍'),
          h('h2', null, npc.name), h('p', { class: 'muted' }, npc.title),
          npc.faction ? h('p', { class: 'small' }, `${G.Factions.defs()[npc.faction].name}${ranks ? ' · you are ' + G.Factions.tier(w, npc.faction).toLowerCase() : ''}`) : null,
          h('p', { class: 'small muted' }, npc.look),
          mood(v),
          v.session.why && v.session.why.length && v.showDisp ? h('details', { class: 'small' }, h('summary', null, 'Why they feel this way'), v.session.why.map(([k, n]) => h('div', { class: 'row spread' }, h('span', null, k), h('span', { class: 'num' }, (n > 0 ? '+' : '') + n)))) : null,
          v.hasControl ? h('div', { class: 'stack tight' }, h('span', { class: 'label' }, 'Which side of your name?'),
            h('div', { class: 'row' }, [['', 'Both'], ['renown', 'Renown'], ['notoriety', 'Notoriety']].map(([k, l]) => h('button', { class: `small ${(s.side || '') === k ? 'selected' : ''}`, disabled: disabled, onclick: () => run('side', { side: k || null }) }, l)))) : null),
        h('div', { class: 'stack talk' },
          log,
          h('div', { class: 'row spread' },
            h('label', { class: 'inline' }, h('span', { class: 'label' }, 'Who speaks'),
              h('select', { 'aria-label': 'Speaker', onchange: (e) => { ui.speaker = e.target.value; game.render(); } },
                [h('option', { value: '', selected: !speaker }, 'Whoever is best')].concat(party.map((c) => h('option', { value: c.id, selected: c.id === speaker }, c.name))))),
            h('span', { class: 'gold num' }, `◈ ${w.gold}`)),
          h('section', { class: 'panel stack' },
            h('h3', null, s.ended ? (s.outcome === 'refused' ? 'They will not talk' : 'The talk is over') : s.last ? 'They have had enough. Ask what you came for.' : 'What do you say?'),
            h('div', { class: 'moves' }, MOVES.map(moveBtn),
              h('div', { class: 'move stack tight' },
                h('div', { class: 'row spread' }, h('b', null, 'Bribe'), h('span', { class: 'small muted' }, 'free')),
                h('p', { class: 'small muted' }, 'Gold buys willingness from the venal, a few coins at a time (at most three). Anyone else is insulted.'),
                h('div', { class: 'row' }, [1, 2, 3].map((n) => h('button', { class: 'small', disabled: disabled || w.gold < n * G.CONFIG.game.parley.bribeStep, onclick: () => run('bribe', { steps: n }) }, `${n * G.CONFIG.game.parley.bribeStep} ◈`)))),
              h('div', { class: 'move stack tight' },
                h('div', { class: 'row spread' }, h('b', null, 'Read them'), h('span', { class: 'small muted' }, 'free')),
                h('p', { class: 'small muted' }, 'Watch hands and eyes. Read the Room shows how they feel; Read Intent shows what they will do.'),
                h('button', { disabled: disabled, onclick: () => run('read') }, 'Read')))),
          h('section', { class: 'panel stack' }, h('h3', null, 'Ask'),
            v.topics.length ? v.topics.map(topicRow) : h('p', { class: 'muted' }, 'Nothing to ask.')),
          h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => game.endParley() }, s.ctx && s.ctx.type === 'encounter' ? 'End the talk' : 'Leave'))),
        h('aside', { class: 'stack side' }, h('h3', null, 'Company'), Bits.partyStrip(game), Bits.logPanel(game, 5))));
  };
})(globalThis.BBB);
