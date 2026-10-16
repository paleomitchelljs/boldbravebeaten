/*
 * Dice entry. The engine asks for rolls through roller(request); this decides
 * whether to roll automatically or ask the player to type in their physical dice.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h } = UI;

  function randomRolls(req) {
    const out = [];
    for (let i = 0; i < req.count; i++) out.push(1 + Math.floor(Math.random() * req.sides));
    return out;
  }

  function shouldAuto(app, actorId) {
    const mode = app.state.settings.autoRoll;
    if (mode === 'all') return true;
    if (mode === 'none') return false;
    const c = app.state.characters[actorId];
    return !c || c.control === 'auto';
  }

  function makeRoller(app) {
    return async (req) => {
      if (shouldAuto(app, req.actorId)) return randomRolls(req);
      app.render();
      return prompt(app, req);
    };
  }

  function prompt(app, req) {
    return new Promise((resolve) => {
      const root = document.getElementById('modal-root');
      const who = app.state.characters[req.actorId];
      const inputs = [];
      const err = h('p', { class: 'small', style: { color: 'var(--blood)' }, role: 'alert' });
      for (let i = 0; i < req.count; i++) {
        inputs.push(h('input', { id: 'die-' + i, type: 'number', min: 1, max: req.sides, inputmode: 'numeric', 'aria-label': `Die ${i + 1} of ${req.count}` }));
      }
      const done = (vals) => {
        root.innerHTML = '';
        resolve(vals);
      };
      const submit = () => {
        const vals = inputs.map((x) => Number(x.value));
        const bad = vals.findIndex((v) => !Number.isInteger(v) || v < 1 || v > req.sides);
        if (bad >= 0) {
          err.textContent = `Each die must be a whole number from 1 to ${req.sides}.`;
          inputs[bad].focus();
          return;
        }
        done(vals);
      };
      const form = h('form', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dice-title',
        onsubmit: (e) => { e.preventDefault(); submit(); } },
        h('div', { class: 'row spread' },
          h('div', { class: 'stack tight' },
            h('span', { class: 'label' }, who ? who.name + ' rolls' : 'Roll'),
            h('h2', { id: 'dice-title' }, req.label)),
          h('span', { class: 'die-label' }, `${req.count > 1 ? req.count : ''}d${req.sides}`)),
        req.detail ? h('p', { class: 'muted' }, req.detail) : null,
        h('div', { class: 'dice' }, inputs),
        err,
        h('div', { class: 'row spread' },
          h('button', { type: 'button', onclick: () => done(randomRolls(req)) }, 'Roll for me'),
          h('button', { type: 'submit', class: 'primary' }, 'Enter roll')));
      root.innerHTML = '';
      root.appendChild(h('div', { class: 'modal-backdrop' }, form));
      inputs[0].focus();
    });
  }

  UI.Dice = { makeRoller, randomRolls };
})(globalThis.BBB);
