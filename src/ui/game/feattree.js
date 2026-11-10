/* The feat trees, drawn: tabs for the trees (grouped by the setting each serves), the chosen tree as a graph (its root
 * across the top, a column for each branch, a row for each tier), lines from each feat to what it needs, and a card for
 * the feat picked. The tabs are two rows: the six settings, then the trees of the one chosen; a mark shows where
 * there is something to train now. The graph narrows its cards to fit the window before it scrolls. Used by the Training Yard and camp (to train), the sheet (to read) and character creation (to add).
 *
 * UI.FeatTree.view(opts): opts = { c, tree, sel, onTree(id), onSel(id), feats(tree) → the feats to show,
 *   can(f) → {ok, reason} (whether it could be taken now), action(f) → an element for the card (a Train button),
 *   room: the widest the graph may be, px (the modal's width; 760) }. */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h } = UI;
  const C = G.Character;
  const NS = 'http://www.w3.org/2000/svg';

  const GROUPS = [['body', 'Body'], ['combat', 'Combat'], ['sneaking', 'Sneaking'], ['talking', 'Talking'], ['exploring', 'Exploring'], ['magic', 'Magic']];
  const TIERS = ['novice', 'apprentice', 'adept', 'expert', 'master'];
  const WMAX = 132, WMIN = 92, H = 50, GX = 14, GY = 28, PAD = 10, HEAD = 34, AXIS = 22;

  const trees = () => G.DATA.TREES;
  const featsOf = (treeId) => Object.values(G.DATA.FEATS).filter((f) => f.tree === treeId);

  // The branch a character has gone furthest down in each tree: what they are becoming.
  function paths(c) {
    const out = [];
    for (const t of trees()) {
      let best = null;
      for (const b of t.branches) {
        let n = 0, cap = null;
        for (const f of featsOf(t.id)) if (f.branch === b.id && C.rank(c, f.id)) { n += C.rank(c, f.id); if (f.capstone) cap = f; }
        if (n && (!best || n > best.n || (cap && !best.cap))) best = { tree: t, branch: b, n, cap };
      }
      if (best) out.push(best);
    }
    return out.sort((a, b) => (b.cap ? 1 : 0) - (a.cap ? 1 : 0) || b.n - a.n);
  }

  function state(c, f, can) {
    const rk = C.rank(c, f.id);
    if (rk >= f.ranks.length) return 'maxed';
    if (!f.auto) return rk ? 'owned unbuilt' : 'unbuilt';
    if (C.closedBy(c, f.id)) return 'closed';
    const ok = can(f).ok;
    if (rk) return ok ? 'owned open' : 'owned';
    return ok ? 'open' : 'locked';
  }

  // Rows and columns. A feat's row is the tier its first rank needs, pushed down below anything in its branch it
  // requires; feats sharing a branch and a row sit side by side.
  function layout(tree, feats, W) {
    W = W || WMAX;
    const shown = new Set(feats.map((f) => f.id));
    const byId = {};
    for (const f of feats) byId[f.id] = f;
    const root = feats.filter((f) => !f.branch);
    const row = {};
    const rowOf = (f, seen) => {
      if (row[f.id] != null) return row[f.id];
      let r = Math.max(0, TIERS.indexOf(f.ranks[0]));
      seen = seen || new Set();
      seen.add(f.id);
      for (const g of f.requires) for (const s of g) {
        const q = byId[C.parseReq(s).id];
        if (q && q.branch && q.branch === f.branch && !seen.has(q.id)) r = Math.max(r, rowOf(q, seen) + 1);
      }
      return (row[f.id] = r);
    };
    const branches = tree.branches.map((b) => ({ b, feats: feats.filter((f) => f.branch === b.id) })).filter((x) => x.feats.length);
    const pos = {};
    let x = AXIS + PAD, rows = 0;
    const top = PAD + (root.length ? H + GY : 0) + HEAD;
    const heads = [];
    for (const { b, feats: fs } of branches) {
      const cells = {};
      for (const f of fs) (cells[rowOf(f)] = cells[rowOf(f)] || []).push(f);
      const width = Math.max(1, ...Object.values(cells).map((l) => l.length));
      const span = width * W + (width - 1) * GX;
      heads.push({ b, x, w: span, n: fs.length });
      for (const [r, list] of Object.entries(cells)) {
        const off = (span - (list.length * W + (list.length - 1) * GX)) / 2;
        list.forEach((f, i) => { pos[f.id] = { x: x + off + i * (W + GX), y: top + Number(r) * (H + GY) }; });
        rows = Math.max(rows, Number(r) + 1);
      }
      x += span + GX * 2;
    }
    const width = Math.max(x - GX * 2 + PAD, AXIS + PAD * 2 + root.length * (W + GX));
    root.forEach((f, i) => { pos[f.id] = { x: AXIS + PAD + i * (W + GX), y: PAD }; });
    return { W, pos, heads, top, rows, width, height: top + rows * (H + GY) - GY + PAD, shown, rootY: root.length ? PAD : null };
  }

  function line(svg, a, b, cls, W) {
    const p = document.createElementNS(NS, 'path');
    const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y, my = (y1 + y2) / 2;
    p.setAttribute('d', `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`);
    p.setAttribute('class', cls);
    svg.appendChild(p);
  }

  function graph(o, tree, feats) {
    const c = o.c;
    // Narrow the cards until the tree fits what the window gives it (o.width, or the modal's share of the window).
    const room = o.width || (typeof window !== 'undefined' && window.innerWidth ? Math.min(window.innerWidth * 0.96, o.room || 760) - 36 : 0);
    let L = layout(tree, feats);
    if (room && L.width > room) L = layout(tree, feats, Math.max(WMIN, Math.floor(WMAX * (room / L.width))));
    if (room && L.width > room) L = layout(tree, feats, WMIN);
    const W = L.W;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'ft-lines');
    svg.setAttribute('width', L.width);
    svg.setAttribute('height', L.height);
    svg.setAttribute('aria-hidden', 'true');
    for (const f of feats) for (const g of f.requires) for (const s of g) {
      const r = C.parseReq(s);
      if (!r.id || !L.pos[r.id] || !L.pos[f.id]) continue;
      line(svg, L.pos[r.id], L.pos[f.id], 'ft-line' + (C.rank(c, r.id) >= r.rank ? ' met' : '') + (g.length > 1 ? ' alt' : ''), W);
    }
    const nodes = feats.map((f) => {
      const p = L.pos[f.id];
      const rk = C.rank(c, f.id);
      const st = state(c, f, o.can);
      return h('button', {
        class: `ft-node ${st}${f.capstone ? ' cap' : ''}${o.sel === f.id ? ' sel' : ''}`, style: { left: p.x + 'px', top: p.y + 'px', width: W + 'px', height: H + 'px' },
        title: f.effect, 'aria-pressed': o.sel === f.id ? 'true' : 'false', onclick: () => o.onSel(f.id),
      },
      h('span', { class: 'ft-name' }, f.capstone ? '★ ' : '', f.name),
      h('span', { class: 'ft-pips' }, f.ranks.map((r, i) => h('i', { class: i < rk ? 'on' : '' }))));
    });
    const heads = L.heads.map((x) => h('div', { class: 'ft-head', style: { left: x.x + 'px', top: (L.top - HEAD) + 'px', width: x.w + 'px' }, title: x.b.blurb }, x.b.name));
    const axis = [];
    for (let r = 0; r < L.rows; r++) axis.push(h('div', { class: 'ft-axis', style: { top: (L.top + r * (H + GY)) + 'px', height: H + 'px' }, title: TIERS[r] || '' }, r < TIERS.length ? C.roman(r + 1) : ''));
    if (L.rootY != null) axis.push(h('div', { class: 'ft-axis root', style: { top: L.rootY + 'px', height: H + 'px' } }, '◆'));
    return h('div', { class: 'ft-scroll' }, h('div', { class: 'ft-graph', style: { width: L.width + 'px', height: L.height + 'px' } }, svg, axis, heads, nodes));
  }

  function card(o, f) {
    const c = o.c;
    const rk = C.rank(c, f.id);
    const tree = trees().find((t) => t.id === f.tree);
    const br = tree.branches.find((b) => b.id === f.branch);
    const T = G.CONFIG.tierThresholds;
    const sk = C.featSkill(f);
    const skName = sk ? ((G.Skills.skillDefs()[sk] || {}).name || sk) : null;
    const reqs = f.requires.map((g) => {
      const met = g.some((s) => C.reqMet(c, s));
      return h('li', { class: met ? 'met' : '' }, met ? '✓ ' : '✗ ', C.reqText(g));
    });
    const tierAt = (i) => sk ? `${f.ranks[i]} (${skName} ${G.CONFIG.skills.tiers[f.ranks[i]]})` : `${f.ranks[i]} (${T[f.ranks[i]]} in ${tree.name})`;
    const closed = C.closedBy(c, f.id);
    const chk = o.can(f);
    return h('div', { class: 'ft-card panel stack tight' },
      h('div', { class: 'row spread' }, h('b', null, f.name), h('span', { class: 'row' },
        f.capstone ? h('span', { class: 'chip warn', title: 'One capstone to a tree: taking it closes the others.' }, '★ Capstone') : null,
        h('span', { class: 'chip' }, br ? br.name : 'Root'))),
      h('p', null, f.effect),
      !f.auto ? h('p', { class: 'small warn' }, 'Not in the game yet: it does nothing.') : null,
      h('div', { class: 'small muted' }, f.ranks.length > 1 ? `Rank ${rk} of ${f.ranks.length}. Next: ${rk < f.ranks.length ? tierAt(rk) : '—'}` : rk ? 'Taken.' : `Needs ${tierAt(0)}`),
      reqs.length ? h('ul', { class: 'ft-reqs small' }, reqs) : null,
      closed ? h('p', { class: 'small warn' }, `Closed: ${G.DATA.FEATS[closed].name} is their capstone here.`) : null,
      !chk.ok && !closed && rk < f.ranks.length && f.auto ? h('p', { class: 'small muted' }, chk.reason) : null,
      o.action ? o.action(f) : null);
  }

  // Something in this tree could be trained now.
  const ready = (o, t) => !!o.can && o.feats(t).some((f) => f.auto && C.rank(o.c, f.id) < f.ranks.length && !C.closedBy(o.c, f.id) && o.can(f).ok);

  function tabs(o, shown) {
    const c = o.c;
    const groupOf = (t) => t.group || 'combat';
    const cur = groupOf(shown.find((t) => t.id === o.tree) || shown[0]);
    const mark = () => h('span', { class: 'ft-ready', title: 'Something here can be trained now' }, '●');
    const groups = GROUPS.map(([g, name]) => {
      const ts = shown.filter((t) => groupOf(t) === g);
      if (!ts.length) return null;
      const n = ts.reduce((a, t) => a + C.treeCount(c, t.id), 0);
      // Into a setting: the tree there the character has gone furthest in.
      const first = ts.slice().sort((a, b) => C.treeCount(c, b.id) - C.treeCount(c, a.id))[0];
      return h('button', { class: 'tab ft-gtab' + (cur === g ? ' active' : '') + (n ? ' has' : ''), onclick: () => o.onTree(first.id) }, name, n ? h('span', { class: 'ft-count' }, String(n)) : null, ts.some((t) => ready(o, t)) ? mark() : null);
    });
    const row = shown.filter((t) => groupOf(t) === cur).map((t) => {
      const n = C.treeCount(c, t.id);
      const tip = t.skill ? `${(G.Skills.skillDefs()[t.skill] || {}).name || t.skill} ${C.skill(c, t.skill)}` : `${C.tierName(C.tierCount(c, t.id))} tier`;
      return h('button', { class: 'small ft-tab' + (o.tree === t.id ? ' selected' : '') + (n ? ' has' : ''), title: `${t.attrs} · ${tip}`, onclick: () => o.onTree(t.id) }, t.name, n ? h('span', { class: 'ft-count' }, String(n)) : null, ready(o, t) ? mark() : null);
    });
    return h('div', { class: 'ft-tabs' }, h('div', { class: 'tabs ft-groups' }, groups), h('div', { class: 'row wrap ft-trees' }, row));
  }

  function pathLine(c) {
    const p = paths(c);
    if (!p.length) return null;
    return h('div', { class: 'ft-paths row wrap small' }, h('span', { class: 'label' }, 'Path'),
      p.slice(0, 4).map((x) => h('span', { class: 'chip' + (x.cap ? ' warn' : ''), title: `${x.tree.name}: ${x.branch.blurb}` }, (x.cap ? '★ ' : '') + x.branch.name)));
  }

  function view(o) {
    const shown = trees().filter((t) => o.feats(t).length);
    if (!shown.length) return h('p', { class: 'muted' }, 'No feats to show.');
    // Nothing chosen yet: the tree the character has gone furthest in.
    const tree = shown.find((t) => t.id === o.tree) || shown.slice().sort((a, b) => C.treeCount(o.c, b.id) - C.treeCount(o.c, a.id))[0];
    const feats = o.feats(tree);
    const sel = feats.find((f) => f.id === o.sel);
    return h('div', { class: 'feattree stack' },
      tabs(Object.assign({}, o, { tree: tree.id }), shown),
      h('div', { class: 'row spread small muted' }, h('span', null, `${tree.name} · ${tree.attrs}`), h('span', null, `${C.tierName(C.tierCount(o.c, tree.id))} tier · ${C.treeCount(o.c, tree.id)} taken`)),
      graph(o, tree, feats),
      sel ? card(o, sel) : h('p', { class: 'small muted' }, 'Pick a feat to see what it does. ★ marks a capstone: one to a tree.'));
  }

  UI.FeatTree = { view, paths, pathLine, layout };
})(globalThis.BBB);
