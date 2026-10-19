(function (G) {
  'use strict';
  (async function () {
    document.documentElement.dataset.theme = (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const res = await G.Content.load('data/');
    if (!res.ok) {
      document.getElementById('app').appendChild(G.UI.h('div', { class: 'panel stack' }, G.UI.h('h2', null, 'The data did not load'), G.UI.h('ul', null, res.errors.map((e) => G.UI.h('li', { class: 'mono small' }, e))),
        G.UI.h('p', null, 'A bad patch from the bench can cause this. '), G.UI.h('button', { onclick: () => { try { localStorage.removeItem('bbb-content-patch'); } catch (e) { /* none */ } location.reload(); } }, 'Drop all patches and reload')));
      return;
    }
    G.UI.Bench.render();
  })();
})(globalThis.BBB);
