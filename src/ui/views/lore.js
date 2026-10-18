/* Lore: rituals (out of combat) and the GM's secrets they reveal. Draft (magic phase 3). */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, select } = UI;
  const CONFIG = G.CONFIG;
  const C = G.Character;
  const R = G.Ritual;

  function lui(app) {
    return app.ui.lore || (app.ui.lore = { caster: null, kind: 'seek', noun: '', subject: '', tier: 'moderate', patient: '', spell: '', target: '', trueName: '', busy: false });
  }

  function lore(app) {
    const s = app.state;
    if (!s.secrets) s.secrets = [];
    if (!s.lore) s.lore = { log: [] };
    return s;
  }

  function party(app) {
    const s = app.state;
    return s.order.map((id) => s.characters[id]).filter((c) => c && c.side === 'party');
  }

  function ritualPanel(app) {
    const s = lore(app);
    const ui = lui(app);
    const casters = party(app);
    if (!casters.length) return h('section', { class: 'panel' }, h('h2', null, 'Perform a ritual'), h('p', { class: 'muted' }, 'No party members yet.'));
    if (!ui.caster || !s.characters[ui.caster]) ui.caster = (casters.find((c) => Object.keys(CONFIG.ritual.kinds).some((k) => R.knows(c, k))) || casters[0]).id;
    const c = s.characters[ui.caster];
    const K = CONFIG.ritual.kinds[ui.kind];
    const nouns = R.nounsFor(c, ui.kind);
    if (K.nouns && !nouns.includes(ui.noun)) ui.noun = nouns[0] || '';
    const spells = ui.kind === 'prepare' ? R.preparable(c) : [];
    if (ui.kind === 'prepare' && !spells.some((o) => o.spellKey === ui.spell)) ui.spell = spells[0] ? spells[0].spellKey : '';
    const spell = spells.find((o) => o.spellKey === ui.spell) || null;
    const spec = () => ({
      kind: ui.kind, noun: K.nouns ? ui.noun : null, subject: ui.subject, tier: ui.tier,
      patient: ui.kind === 'mend' ? s.characters[ui.patient || c.id] : null,
      spell, target: ui.kind === 'prepare' ? s.characters[ui.target || c.id] : null, trueName: ui.trueName || null,
    });
    const why = R.missing(c, ui.kind, spec());
    const k = R.cost(c, ui.kind, spec());
    const subjects = [...new Set(s.secrets.map((x) => x.subject))];
    const set = (key) => (v) => { ui[key] = v; app.render(); };
    const field = (label, id, el) => h('label', { class: 'stack tight', for: id }, h('span', { class: 'label' }, label), el);
    return h('section', { class: 'panel' },
      h('h2', null, 'Perform a ritual'),
      h('p', { class: 'small muted' }, 'Out of combat. Time, spell points and components (spent win or lose); d10 + ⌊INT/2⌋ + Ritualist against the GM\'s tier. Information rituals reveal the GM\'s secrets about the subject.'),
      h('div', { class: 'grid-2' },
        field('Caster', 'r-caster', select('r-caster', ui.caster, casters.map((x) => [x.id, x.name]), set('caster'))),
        field('Ritual', 'r-kind', select('r-kind', ui.kind, Object.entries(CONFIG.ritual.kinds).map(([id, x]) => [id, `${x.name}${R.knows(c, id) ? '' : ` (needs ${x.needs})`}`]), set('kind'))),
        K.nouns ? field('Noun', 'r-noun', nouns.length ? select('r-noun', ui.noun, nouns.map((n) => [n, CONFIG.magic.words[n].name]), set('noun')) : h('span', { class: 'muted small' }, 'None known that fits')) : null,
        K.reveals ? field('Subject', 'r-subject', h('input', { id: 'r-subject', list: 'r-subjects', value: ui.subject, placeholder: K.subject, oninput: (e) => { ui.subject = e.target.value; } })) : null,
        K.reveals ? h('datalist', { id: 'r-subjects' }, subjects.map((x) => h('option', { value: x }))) : null,
        ui.kind === 'mend' ? field('Patient', 'r-patient', select('r-patient', ui.patient || c.id, party(app).map((x) => [x.id, `${x.name}${x.damage.CON ? ` (−${x.damage.CON} CON)` : ''}`]), set('patient'))) : null,
        ui.kind === 'prepare' ? field('Spell to lay ready', 'r-spell', spells.length ? select('r-spell', ui.spell, spells.map((o) => [o.spellKey, o.label]), set('spell')) : h('span', { class: 'muted small' }, 'No ward, boon or rune known')) : null,
        ui.kind === 'prepare' && spell && spell.spell.shape !== 'rune' ? field('On', 'r-target', select('r-target', ui.target || c.id, party(app).map((x) => [x.id, x.name]), set('target'))) : null,
        K.needsName ? field('True name', 'r-name', h('input', { id: 'r-name', value: ui.trueName, oninput: (e) => { ui.trueName = e.target.value; } })) : null,
        field('Difficulty (GM)', 'r-tier', select('r-tier', ui.tier, Object.entries(CONFIG.ritual.tiers).map(([id, tn]) => [id, `${id.replace(/([A-Z])/g, ' $1').toLowerCase()} (${tn})`]), set('tier')))),
      h('p', { class: 'small' }, `${k.minutes} minutes · ${k.sp} spell points · ${Object.entries(k.components).map(([id, n]) => `${n} ${CONFIG.ritual.components[id].name.toLowerCase()} (have ${(c.inventory.components || {})[id] || 0})`).join(', ') || 'no components'}`),
      h('div', { class: 'row' },
        h('button', { class: 'primary', disabled: !!why || ui.busy, title: why || '', onclick: async () => {
          ui.busy = true;
          app.render();
          const res = await R.perform(c, spec(), UI.Dice.makeRoller(app), s.secrets);
          s.lore.log.unshift({ at: Date.now(), lines: res.lines, revealed: res.revealed.map((x) => x.id) });
          ui.busy = false;
          app.save();
          app.render();
        } }, `Perform ${K.name}`),
        why ? h('span', { class: 'chip warn' }, why) : null));
  }

  function learnedPanel(app) {
    const s = lore(app);
    const got = s.secrets.filter((x) => x.revealed);
    const bySubject = {};
    for (const x of got) (bySubject[x.subject] || (bySubject[x.subject] = [])).push(x);
    return h('section', { class: 'panel' },
      h('h2', null, 'What has been learned'),
      got.length ? Object.entries(bySubject).map(([subj, list]) => h('div', { class: 'stack tight' },
        h('b', null, subj),
        h('ul', null, list.map((x) => h('li', null, x.text, x.revealedBy ? h('span', { class: 'small muted' }, ` — ${x.revealedBy}`) : null)))))
        : h('p', { class: 'muted' }, 'Nothing yet. Rituals reveal what the GM has written down about a subject.'));
  }

  function secretsPanel(app) {
    const s = lore(app);
    const ui = lui(app);
    if (!app.state.settings.gmView && !ui.showSecrets) {
      return h('section', { class: 'panel' }, h('h2', null, 'Secrets (GM)'),
        h('p', { class: 'small muted' }, `${s.secrets.length} written, ${s.secrets.filter((x) => !x.revealed).length} still hidden.`),
        h('button', { class: 'small', onclick: () => { ui.showSecrets = true; app.render(); } }, 'Show the GM\'s secrets'));
    }
    const kinds = ['read', 'seek', 'divine', 'speak'].concat(Object.keys(CONFIG.magic.words).filter((n) => CONFIG.magic.words[n].kind === 'noun').map((n) => 'seek:' + n));
    const row = (x) => h('tr', null,
      h('td', null, h('input', { value: x.subject, 'aria-label': 'Subject', onchange: (e) => { x.subject = e.target.value; app.save(); app.render(); } })),
      h('td', null, h('input', { value: (x.reveals || []).join(', '), 'aria-label': 'Revealed by', title: 'read, seek, seek:force, divine, speak…', onchange: (e) => { x.reveals = e.target.value.split(',').map((t) => t.trim()).filter(Boolean); app.save(); } })),
      h('td', null, select('tier-' + x.id, x.tier, Object.keys(CONFIG.ritual.tiers).map((t) => [t, t]), (v) => { x.tier = v; app.save(); app.render(); }, { 'aria-label': 'Difficulty' })),
      h('td', null, h('textarea', { rows: 2, 'aria-label': 'Secret', onchange: (e) => { x.text = e.target.value; app.save(); } }, x.text)),
      h('td', null, h('input', { type: 'checkbox', checked: !!x.revealed, 'aria-label': 'Revealed', onchange: (e) => { x.revealed = e.target.checked; app.save(); app.render(); } })),
      h('td', null, h('button', { class: 'small ghost', onclick: () => { s.secrets = s.secrets.filter((y) => y !== x); app.save(); app.render(); } }, 'Delete')));
    return h('section', { class: 'panel' },
      h('div', { class: 'row spread' }, h('h2', null, 'Secrets (GM)'), !app.state.settings.gmView ? h('button', { class: 'small ghost', onclick: () => { ui.showSecrets = false; app.render(); } }, 'Hide') : null),
      h('p', { class: 'small muted' }, `Write down what can be learned, about what, by which rituals (${kinds.slice(0, 6).join(', ')}, …), and how hard it is to reach. A ritual reveals those its roll reaches, as many as its outcome allows.`),
      h('div', { class: 'scroll-x' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, ['Subject', 'Revealed by', 'Difficulty', 'Secret', 'Known', ''].map((x) => h('th', null, x)))),
        h('tbody', null, s.secrets.map(row)))),
      h('button', { class: 'small', onclick: () => { s.secrets.push({ id: G.Items.uid('sec'), subject: 'New subject', reveals: ['divine'], tier: 'moderate', text: '', revealed: false }); app.save(); app.render(); } }, 'Add a secret'));
  }

  function logPanel(app) {
    const s = lore(app);
    return h('section', { class: 'panel' }, h('h2', null, 'Ritual log'),
      s.lore.log.length ? h('ul', { class: 'stack tight' }, s.lore.log.slice(0, 30).map((e) => h('li', { class: 'small' }, e.lines.join(' ')))) : h('p', { class: 'muted' }, 'No rituals yet.'));
  }

  function view(app) {
    return h('div', { class: 'stack' },
      h('h1', null, 'Lore and rituals'),
      ritualPanel(app),
      learnedPanel(app),
      secretsPanel(app),
      logPanel(app),
      h('p', { class: 'small muted' }, 'Draft (magic phase 3). Summon and Raise only record that something answers; the GM brings it.'));
  }

  UI.Views.lore = view;
})(globalThis.BBB);
