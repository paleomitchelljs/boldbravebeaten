/* Minimal DOM helpers. */
(function (G) {
  'use strict';
  const UI = (G.UI = G.UI || {});

  // h('div', {class: 'x', onclick: fn}, child, [children], 'text')
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; }
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'open') el[k] = !!v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) kid.forEach((k) => append(el, k));
    else if (kid instanceof Node) el.appendChild(kid);
    else el.appendChild(document.createTextNode(String(kid)));
  }

  function select(id, value, options, onchange, attrs) {
    return h('select', Object.assign({ id, onchange: (e) => onchange(e.target.value) }, attrs || {}),
      options.map(([v, label]) => h('option', { value: v, selected: String(v) === String(value) }, label)));
  }

  function num(id, value, onchange, attrs) {
    return h('input', Object.assign({
      id, type: 'number', value, inputmode: 'numeric',
      onchange: (e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onchange(n); },
    }, attrs || {}));
  }

  function bar(value, max) {
    const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    const cls = 'bar' + (frac < 0.25 ? ' crit' : frac < 0.5 ? ' low' : '');
    return h('div', { class: cls, role: 'meter', 'aria-valuenow': value, 'aria-valuemin': 0, 'aria-valuemax': max },
      h('span', { style: { width: (frac * 100).toFixed(1) + '%' } }));
  }

  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2600);
  }

  // A button that asks for a second click before doing something destructive.
  function confirmButton(label, confirmLabel, onConfirm, attrs) {
    const b = h('button', Object.assign({ class: 'danger small' }, attrs || {}), label);
    let armed = false;
    b.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        b.textContent = confirmLabel;
        b.classList.add('solid');
        setTimeout(() => {
          if (armed && b.isConnected) {
            armed = false;
            b.textContent = label;
            b.classList.remove('solid');
          }
        }, 3500);
        return;
      }
      onConfirm();
    });
    return b;
  }

  function initials(name) {
    const parts = String(name || '?').replace(/\bthe\b/gi, '').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  Object.assign(UI, { h, select, num, bar, toast, confirmButton, initials });
})(globalThis.BBB);
