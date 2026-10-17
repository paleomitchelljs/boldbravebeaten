/* Company view: party and enemy rosters, resting, save/load. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h, bar, confirmButton, toast } = UI;
  const C = G.Character;
  const Items = G.Items;

  function statusChips(c) {
    const st = c.status;
    const out = [];
    if (st.dead) out.push(h('span', { class: 'chip bad' }, 'Dead'));
    else if (st.unconscious) out.push(h('span', { class: 'chip bad' }, 'Unconscious'));
    if (st.prone) out.push(h('span', { class: 'chip warn' }, 'Prone'));
    if (st.webbed) out.push(h('span', { class: 'chip warn', title: 'Every action costs more AP and stamina' }, `Webbed ×${st.webbed}`));
    if (st.clinch) out.push(h('span', { class: 'chip warn' }, 'Clinched'));
    if (st.grappledBy && st.grappledBy.length) out.push(h('span', { class: 'chip warn' }, st.pinned ? 'Pinned' : 'Held'));
    if (st.grappling) out.push(h('span', { class: 'chip' }, st.grapplingPin ? 'Pinning' : 'Holding'));
    if (st.dropped && st.dropped.length) out.push(h('span', { class: 'chip warn' }, 'Weapon on the ground'));
    if (st.windUp) out.push(h('span', { class: 'chip warn', title: 'Cannot block or parry until the blow is released' }, 'Wound up: ' + st.windUp.label));
    if (c.bleeds.length && !st.dead) out.push(h('span', { class: 'chip bad' }, `Bleeding ${C.bleedPerRound(c).toFixed(1)}/rd`));
    return out;
  }

  function gearLine(c) {
    const w = C.wieldedWeapon(c);
    const nat = (c.natural || []).map((t) => G.DATA.WEAPONS[t].name.toLowerCase());
    return [Items.itemName(c.armor), c.shield ? Items.itemName(c.shield) + (c.shield.durability <= 0 ? ' (broken)' : '') : null, nat.length ? nat.join(', ') : w ? Items.itemName(w) : 'Unarmed']
      .filter(Boolean).join(' · ');
  }

  function card(app, c, extra) {
    const max = C.maxStamina(c);
    const down = c.status.dead || c.status.unconscious;
    return h('article', { class: `ccard ${c.side === 'party' ? '' : 'enemy'} ${down ? 'down' : ''}` },
      h('div', { class: 'row spread' },
        h('span', { class: 'name' }, c.name),
        h('span', { class: 'row', style: { gap: '4px' } },
          h('span', { class: 'chip ' + (c.side === 'party' ? 'party' : 'enemy') }, `L${c.level}`),
          h('span', { class: 'chip ' + (c.control === 'auto' ? '' : 'manual'), title: c.control === 'auto' ? 'Dice roll automatically' : 'Player types in dice' }, c.control === 'auto' ? 'auto dice' : 'own dice'))),
      h('div', { class: 'gear' }, gearLine(c)),
      h('div', { class: 'stack tight' },
        h('div', { class: 'row spread small' }, h('span', { class: 'muted' }, 'Stamina'), h('span', { class: 'num' }, `${c.stamina} / ${max}`)),
        bar(c.stamina, max)),
      h('div', { class: 'stat-line' },
        h('span', null, 'CON ', h('b', null, `${C.attr(c, 'CON')}/${C.attrMax(c, 'CON')}`)),
        h('span', null, 'AP ', h('b', null, C.apPool(c))),
        h('span', null, 'Feats ', h('b', null, `${C.featCount(c)}/${C.featBudget(c)}`)),
        C.totalDamage(c) ? h('span', null, 'Wounds ', h('b', null, C.totalDamage(c))) : null),
      statusChips(c).length ? h('div', { class: 'row', style: { gap: '4px' } }, statusChips(c)) : null,
      extra || null);
  }

  function rosterCard(app, c) {
    return card(app, c, h('div', { class: 'row' },
      h('button', { class: 'small primary', onclick: () => app.go('sheet', c.id) }, 'Open sheet'),
      h('button', { class: 'small', onclick: () => {
        const copy = JSON.parse(JSON.stringify(c));
        copy.id = Items.uid('chr');
        copy.name = c.name + ' (copy)';
        for (const w of copy.weapons) {
          const old = w.id;
          w.id = Items.uid('wpn');
          if (copy.wield === old) copy.wield = w.id;
          if (copy.sidearm === old) copy.sidearm = w.id;
        }
        app.addCharacter(copy);
        toast(`Copied ${c.name}`);
      } }, 'Duplicate'),
      confirmButton('Delete', 'Confirm delete', () => app.removeCharacter(c.id))));
  }

  function restPanel(app) {
    const s = app.state;
    const party = s.order.map((id) => s.characters[id]).filter((c) => c.side === 'party' && !c.status.dead);
    const ui = app.ui.rest || (app.ui.rest = { tender: '', town: false, results: null });
    const busy = s.encounter && s.encounter.phase !== 'over';
    return h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', null, 'Long rest'), h('span', { class: 'muted small' }, 'Once per day, between fights')),
      h('p', { class: 'small muted' }, 'Restores stamina, partly repairs armor and shields, and rolls each wounded character\'s daily heal roll (d6: 1 worsens, 2 nothing, 3–6 heals 1). A tender rerolls 1s and adds their Wound Tending rank. Resting in town rolls twice.'),
      h('div', { class: 'row' },
        h('label', { class: 'field', for: 'rest-tender' }, h('span', { class: 'label' }, 'Tended by'),
          UI.select('rest-tender', ui.tender, [['', 'No one']].concat(party.map((c) => [c.id, c.name + (C.rank(c, 'wound_tending') ? ` (Wound Tending ${C.rank(c, 'wound_tending')})` : '')])), (v) => { ui.tender = v; app.render(); })),
        h('label', { class: 'inline', for: 'rest-town' }, h('input', { id: 'rest-town', type: 'checkbox', checked: ui.town, onchange: (e) => { ui.town = e.target.checked; } }), 'Resting in town')),
      h('div', { class: 'row' },
        h('button', { class: 'primary', disabled: busy || !party.length, onclick: async () => {
          const tender = ui.tender ? s.characters[ui.tender] : null;
          const roller = UI.Dice.makeRoller(app);
          const results = [];
          for (const c of party) {
            const lines = await G.Recovery.longRest(c, { tender, town: ui.town }, roller);
            results.push({ name: c.name, lines });
          }
          ui.results = results;
          app.save();
          app.render();
          toast('The party rests');
        } }, 'Rest the party'),
        busy ? h('span', { class: 'small muted' }, 'Finish the battle first.') : null),
      ui.results ? h('div', { class: 'stack tight small' }, ui.results.map((r) => h('div', null, h('b', null, r.name + ': '), r.lines.join(' ')))) : null);
  }

  function savePanel(app) {
    const ui = app.ui.save || (app.ui.save = { text: '' });
    const exportBox = h('textarea', { id: 'export-text', readonly: true, rows: 4, 'aria-label': 'Exported table data' }, UI.Store.exportJSON(app.state));
    const importBox = h('textarea', { id: 'import-text', rows: 4, placeholder: 'Paste exported text here', value: ui.text, oninput: (e) => (ui.text = e.target.value) });
    const doImport = (text) => {
      try {
        app.replaceState(UI.Store.importJSON(text));
        ui.text = '';
        toast('Table loaded');
      } catch (e) {
        toast('Could not load: ' + e.message);
      }
    };
    return h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', null, 'Save and move'), h('span', { class: 'muted small' }, 'Saved automatically in this browser')),
      h('p', { class: 'small muted' }, 'To move the table to another device, copy this text and load it there. It includes every character and any battle in progress.'),
      exportBox,
      h('div', { class: 'row' },
        h('button', { class: 'small', onclick: async () => {
          try { await navigator.clipboard.writeText(exportBox.value); toast('Copied'); } catch (e) { exportBox.select(); toast('Selected — press Ctrl+C to copy'); }
        } }, 'Copy'),
        h('label', { class: 'btn small', for: 'import-file' }, 'Load from file…'),
        h('input', { id: 'import-file', type: 'file', accept: '.json,.txt,application/json,text/plain', hidden: true, onchange: (e) => {
          const f = e.target.files[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = () => doImport(String(r.result));
          r.readAsText(f);
        } })),
      importBox,
      h('div', { class: 'row spread' },
        h('button', { class: 'small', onclick: () => doImport(ui.text) }, 'Load pasted text'),
        confirmButton('Reset to examples', 'Erase everything?', () => { app.replaceState(UI.Store.sampleState()); toast('Example table restored'); })));
  }

  function view(app) {
    const s = app.state;
    const all = s.order.map((id) => s.characters[id]);
    const party = all.filter((c) => c.side === 'party');
    const foes = all.filter((c) => c.side !== 'party');
    return h('div', { class: 'stack', style: { gap: '20px' } },
      h('div', { class: 'view-head' },
        h('div', { class: 'stack tight' }, h('h1', null, 'The Company'),
          h('p', { class: 'muted' }, 'Characters, the foes they face, and the state of their wounds. Open a sheet to edit attributes, gear and feats; the numbers update as you go.')),
        h('div', { class: 'row' },
          h('button', { class: 'primary', onclick: () => { const c = C.newCharacter({ name: 'New adventurer' }); app.addCharacter(c); app.go('sheet', c.id); } }, 'New character'),
          h('button', { onclick: () => app.go('enemies') }, 'Generate enemies'))),
      h('section', { class: 'stack' },
        h('div', { class: 'section-title' }, h('h2', null, 'Party'), h('span', { class: 'muted small' }, `${party.length} characters`)),
        party.length ? h('div', { class: 'grid-3' }, party.map((c) => rosterCard(app, c))) : h('p', { class: 'muted' }, 'No party yet. Make a new character to begin.')),
      h('section', { class: 'stack' },
        h('div', { class: 'section-title' }, h('h2', null, 'Enemies'),
          h('div', { class: 'row' },
            h('span', { class: 'muted small' }, `${foes.length} on file`),
            foes.some((c) => c.status.dead || c.status.unconscious)
              ? confirmButton('Remove defeated', 'Remove them?', () => { foes.filter((c) => c.status.dead || c.status.unconscious).forEach((c) => app.removeCharacter(c.id, true)); app.save(); app.render(); })
              : null)),
        foes.length ? h('div', { class: 'grid-3' }, foes.map((c) => rosterCard(app, c))) : h('p', { class: 'muted' }, 'No enemies on file. Use Generate enemies to roll some up.')),
      h('div', { class: 'grid-2' }, restPanel(app), savePanel(app)));
  }

  UI.Views = UI.Views || {};
  UI.Views.roster = view;
  UI.Cards = { card, statusChips, gearLine };
})(globalThis.BBB);
