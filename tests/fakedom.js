// A just-enough DOM for rendering the UI in Node (no browser needed): elements, text, SVG, a
// canvas that records nothing, storage, timers. It cannot tell you a page looks right; it can tell
// you a screen throws, which is most of what goes wrong.
'use strict';

class FNode {
  constructor() { this.childNodes = []; this.parentNode = null; }
  appendChild(k) { if (k.parentNode) k.parentNode.removeChild(k); k.parentNode = this; this.childNodes.push(k); return k; }
  removeChild(k) { const i = this.childNodes.indexOf(k); if (i >= 0) this.childNodes.splice(i, 1); k.parentNode = null; return k; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === doc.documentElement || n === doc.body; }
  get firstChild() { return this.childNodes[0] || null; }
}
class FText extends FNode {
  constructor(t) { super(); this.nodeValue = String(t); }
  get textContent() { return this.nodeValue; }
}
class FElement extends FNode {
  constructor(tag, ns) {
    super();
    this.tagName = String(tag).toUpperCase(); this.localName = tag; this.namespaceURI = ns || null;
    this.attributes = {}; this.listeners = {}; this._style = {}; this.dataset = {};
    this.scrollTop = 0; this.scrollHeight = 0;
    const self = this;
    this.style = new Proxy(this._style, { get: (t, k) => (k === 'setProperty' ? (a, b) => { t[a] = b; } : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
    this.classList = { add: (...c) => { const s = new Set(self.className.split(/\s+/).filter(Boolean)); c.forEach((x) => s.add(x)); self.className = [...s].join(' '); }, remove: (...c) => { const s = new Set(self.className.split(/\s+/).filter(Boolean)); c.forEach((x) => s.delete(x)); self.className = [...s].join(' '); }, contains: (c) => self.className.split(/\s+/).includes(c) };
  }
  get className() { return this.attributes.class || ''; }
  set className(v) { this.attributes.class = String(v); }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  removeEventListener() {}
  dispatch(t, ev) { for (const f of this.listeners[t] || []) f(Object.assign({ target: this, currentTarget: this, preventDefault() {}, stopPropagation() {} }, ev || {})); }
  click() { this.dispatch('click'); }
  focus() {}
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) { this.childNodes = []; if (v) this.appendChild(new FText(v)); }
  set innerHTML(v) { this.childNodes = []; }
  get innerHTML() { return ''; }
  getContext() { return ctx; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  querySelectorAll(sel) { const out = []; walk(this, (n) => { if (n !== this && matches(n, sel)) out.push(n); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function walk(n, f) { f(n); for (const c of n.childNodes) if (c instanceof FElement) walk(c, f); }
function matches(el, sel) {
  const parts = sel.trim().split(/\s+/);
  const one = (e, s) => {
    const m = s.match(/^([a-z0-9]*)((?:[.#][\w-]+|\[[\w-]+(?:=[^\]]+)?\])*)$/i);
    if (!m) return false;
    if (m[1] && e.localName !== m[1]) return false;
    for (const q of m[2].match(/[.#][\w-]+|\[[^\]]+\]/g) || []) {
      if (q[0] === '.') { if (!e.className.split(/\s+/).includes(q.slice(1))) return false; }
      else if (q[0] === '#') { if (e.attributes.id !== q.slice(1)) return false; }
      else { const [k, v] = q.slice(1, -1).split('='); if (!(k in e.attributes)) return false; if (v != null && e.attributes[k] !== v.replace(/["']/g, '')) return false; }
    }
    return true;
  };
  if (!one(el, parts[parts.length - 1])) return false;
  let p = el.parentNode;
  for (let i = parts.length - 2; i >= 0; i--) { while (p && !(p instanceof FElement && one(p, parts[i]))) p = p.parentNode; if (!p) return false; p = p.parentNode; }
  return true;
}

const noop = () => {};
const grad = { addColorStop: noop };
const ctx = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => grad : k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });

const body = new FElement('body');
const doc = {
  documentElement: new FElement('html'), body, listeners: {},
  createElement: (t) => new FElement(t), createElementNS: (ns, t) => new FElement(t, ns), createTextNode: (t) => new FText(t),
  getElementById(id) { let r = null; walk(body, (n) => { if (n.attributes.id === id) r = n; }); return r; },
  querySelector: (s) => body.querySelector(s), querySelectorAll: (s) => body.querySelectorAll(s),
  addEventListener(t, f) { (doc.listeners[t] = doc.listeners[t] || []).push(f); }, removeEventListener: noop,
  activeElement: null,
};
doc.documentElement.appendChild(body);
for (const id of ['app', 'modal-root', 'toast']) { const e = new FElement('div'); e.setAttribute('id', id); body.appendChild(e); }

function install() {
  const store = {};
  Object.assign(globalThis, {
    document: doc, Node: FNode, Element: FElement,
    window: globalThis, scrollTo: noop, scrollY: 0,
    location: { protocol: 'http:', hash: '', search: '' }, history: { replaceState: noop },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    URL: Object.assign(function URLStub() {}, { createObjectURL: () => 'blob:x' }),
    URLSearchParams: globalThis.URLSearchParams,
    addEventListener: noop,
    setInterval: () => 0, clearInterval: noop, requestAnimationFrame: (f) => setTimeout(f, 0), matchMedia: () => ({ matches: false, addEventListener() {} }),
  });
  return { doc, FElement, store };
}

module.exports = { install, doc, FElement, FText };
