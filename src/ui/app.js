/* App shell: state, tabs, rendering. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h } = UI;

  const TABS = [
    ['roster', 'Company'],
    ['sheet', 'Sheet'],
    ['enemies', 'Enemies'],
    ['battle', 'Battle'],
    ['lore', 'Lore'],
    ['rules', 'Rules'],
  ];

  const app = {
    state: UI.Store.load(),
    ui: {},
    save() {
      if (!UI.Store.save(app.state) && !app.ui.warnedStorage) {
        app.ui.warnedStorage = true;
        UI.toast('This browser is not saving. Use Save and move to keep your table.');
      }
    },
    render,
    go(tab, selected) {
      app.state.tab = tab;
      if (selected) app.state.selected = selected;
      try { history.replaceState(null, '', '#' + tab); } catch (e) { /* ignore */ }
      app.save();
      render();
      window.scrollTo(0, 0);
    },
    addCharacter(c, quiet) {
      app.state.characters[c.id] = c;
      app.state.order.push(c.id);
      if (!quiet) { app.save(); render(); }
    },
    removeCharacter(id, quiet) {
      const s = app.state;
      delete s.characters[id];
      s.order = s.order.filter((x) => x !== id);
      if (s.selected === id) s.selected = s.order[0] || null;
      if (s.encounter) {
        s.encounter.ids = s.encounter.ids.filter((x) => x !== id);
        s.encounter.order = s.encounter.order.filter((x) => x !== id);
      }
      if (!quiet) { app.save(); render(); }
    },
    replaceState(s) {
      app.state = s;
      app.ui = {};
      app.save();
      render();
    },
  };

  function renderTabs() {
    const nav = document.getElementById('tabs');
    nav.innerHTML = '';
    const enc = app.state.encounter;
    for (const [id, label] of TABS) {
      nav.appendChild(h('button', {
        class: 'tab', 'aria-current': app.state.tab === id ? 'page' : null, onclick: () => app.go(id),
      }, label, id === 'battle' && enc ? h('span', { class: 'pip' }, enc.phase === 'over' ? '✓' : enc.round || '•') : null));
    }
  }

  function render() {
    renderTabs();
    const main = document.getElementById('app');
    const view = UI.Views[app.state.tab] || UI.Views.roster;
    const scroll = window.scrollY;
    const active = document.activeElement && document.activeElement.id;
    main.innerHTML = '';
    try {
      main.appendChild(view(app));
    } catch (e) {
      console.error(e);
      main.appendChild(h('div', { class: 'panel' }, h('h2', null, 'Something broke on this page'), h('p', { class: 'mono small' }, String(e && e.stack || e)),
        h('button', { onclick: () => app.go('roster') }, 'Back to the company')));
    }
    window.scrollTo(0, scroll);
    if (active) {
      const el = document.getElementById(active);
      if (el && el.focus) el.focus({ preventScroll: true });
    }
  }

  const fromHash = (location.hash || '').slice(1);
  if (TABS.some(([id]) => id === fromHash)) app.state.tab = fromHash;
  window.addEventListener('hashchange', () => {
    const t = location.hash.slice(1);
    if (TABS.some(([id]) => id === t) && t !== app.state.tab) app.go(t);
  });

  UI.app = app;
  render();
})(globalThis.BBB);
