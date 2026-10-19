/* Boot: load the content files, then show the title screen. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h } = UI;

  async function boot() {
    const root = document.getElementById('app');
    root.appendChild(h('p', { class: 'muted', style: { padding: '40px', textAlign: 'center' } }, 'Loading…'));
    document.documentElement.dataset.theme = 'dark';
    let res;
    try { res = await G.Content.load('data/'); } catch (e) { res = { ok: false, errors: [String(e)] }; }
    root.innerHTML = '';
    if (!res.ok) {
      root.appendChild(h('div', { class: 'game' }, h('div', { class: 'panel stack' },
        h('h2', null, 'The game data did not load'),
        h('ul', null, res.errors.map((e) => h('li', { class: 'mono small' }, e))),
        location.protocol === 'file:' ? h('p', null, 'This page was opened from disk, and browsers will not let it read the data files. Either serve the folder (for example "npx serve ." or "python3 -m http.server"), or run "node tools/bundle.js" once and reload.') : null,
        h('p', { class: 'small muted' }, 'If you edited a file in the Test bench, clear its saved patch there.'))));
      return;
    }
    if (res.warnings && res.warnings.length) console.warn('Content warnings:\n' + res.warnings.join('\n'));
    const q = new URLSearchParams(location.search);
    try { UI.Game.debug = q.has('debug') || localStorage.getItem('bbb-debug') === '1'; } catch (e) { UI.Game.debug = q.has('debug'); }
    UI.Game.warnings = res.warnings || [];
    UI.Game.go('title');
  }

  boot();
})(globalThis.BBB);
