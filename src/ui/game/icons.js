/*
 * Icons: small pixel bitmaps drawn as inline SVG in the current text colour, so every button can be an icon
 * with a tooltip. '#' is ink, '+' is ink at half strength. UI.icon(name, px) returns an <svg>.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const NS = 'http://www.w3.org/2000/svg';

  const BITS = {
    hand: ['....#.#.#...', '....#.#.#.#.', '....#.#.#.#.', '.##.#######.', '.###########', '..##########', '...#########', '....########', '.....#######', '......#####.', '......####..', '......####..'],
    search: ['..#####.....', '.#+++++#....', '#+++++++#...', '#+++++++#...', '#+++++++#...', '.#+++++#....', '..#####.#...', '........##..', '.........##.', '..........##', '...........#', '............'],
    eye: ['............', '............', '...######...', '..#......#..', '.#...##...#.', '#...####...#', '#...####...#', '.#...##...#.', '..#......#..', '...######...', '............', '............'],
    tent: ['.....##.....', '....####....', '....####....', '...######...', '...######...', '..###..###..', '..###..###..', '.####..####.', '.####..####.', '############', '............', '............'],
    pack: ['....####....', '...#....#...', '...######...', '..########..', '.##########.', '.##########.', '.###.##.###.', '.###.##.###.', '.##########.', '.##########.', '..########..', '............'],
    book: ['.#########..', '##+++++++##.', '#+#######+#.', '#+#+++++#+#.', '#+#######+#.', '#+#+++++#+#.', '#+#######+#.', '#+++++++++#.', '###########.', '............'],
    banner: ['############', '#++++++++++#', '#++++++++++#', '#++++++++++#', '#++++##++++#', '#+++####+++#', '#++++++++++#', '.#++++++++#.', '..#++++++#..', '...#++++#...', '....#++#....', '.....##.....'],
    menu: ['............', '............', '############', '............', '............', '############', '............', '............', '############', '............'],
    info: ['...######...', '..#++++++#..', '.#++++#++++#', '.#++++++++#.', '.#+++##+++#.', '.#+++##+++#.', '.#+++##+++#.', '.#+++##+++#.', '..#++++++#..', '...######...'],
    shield: ['############', '#++++++++++#', '#++++++++++#', '#++++++++++#', '#++++++++++#', '.#++++++++#.', '.#++++++++#.', '..#++++++#..', '...#++++#...', '....#++#....', '.....##.....'],
    sword: ['..........##', '.........###', '........###.', '.......###..', '......###...', '.#...###....', '.##.###.....', '..####......', '...###......', '..###.##....', '.###...#....', '##..........'],
    star: ['.....##.....', '.....##.....', '....####....', '############', '.##########.', '..########..', '...######...', '..###..###..', '.###....###.', '.##......##.'],
    boot: ['............', '.....#......', '.....##.....', '..#######...', '..########..', '..#######...', '.....##.....', '.....#......'],
    dots: ['............', '............', '............', '.##..##..##.', '.##..##..##.', '............', '............', '............'],
    hourglass: ['############', '.##########.', '..########..', '...######...', '....####....', '.....##.....', '.....##.....', '....####....', '...######...', '..########..', '.##########.', '############'],
    flee: ['..#.........', '.##.........', '###########.', '.##.........', '..#.........', '............'],
    scroll: ['.##########.', '#..........#', '.#.######.#.', '..#......#..', '..#.####.#..', '..#......#..', '.#.######.#.', '#..........#', '.##########.'],
    play: ['.#..........', '.###........', '.#####......', '.#######....', '.#########..', '.#######....', '.#####......', '.###........', '.#..........'],
    close: ['#..........#', '##........##', '.##......##.', '..##....##..', '...##..##...', '....####....', '....####....', '...##..##...', '..##....##..', '.##......##.', '##........##', '#..........#'],
    plus: ['....##....', '....##....', '....##....', '##########', '##########', '....##....', '....##....', '....##....'],
    minus: ['..........', '..........', '..........', '##########', '##########', '..........', '..........', '..........'],
    check: ['..........#.', '.........##.', '........##..', '#......##...', '##....##....', '.##..##.....', '..####......', '...##.......'],
    skull: ['..########..', '.##########.', '##########..', '#..##..##..#', '#..##..##..#', '.##########.', '..###..###..', '...######...', '...#.##.#...', '...######...'],
    heart: ['.###..###.', '#####.####', '##########', '##########', '.########.', '..######..', '...####...', '....##....'],
    coin: ['...####...', '..#++++#..', '.#++##++#.', '.#+#++#+#.', '.#+#++#+#.', '.#++##++#.', '..#++++#..', '...####...'],
    door: ['..######..', '.#++++++#.', '.#++++++#.', '.#++++++#.', '.#++++#+#.', '.#++++++#.', '.#++++++#.', '.#++++++#.', '##########'],
    up: ['....##....', '...####...', '..######..', '.########.', '....##....', '....##....'],
    layers: ['.....##.....', '...######...', '.##########.', '############', '.##########.', '...######...', '.##..##..##.', '####....####', '.##########.', '...######...', '.....##.....'],
    log: ['##########', '..........', '##########', '..........', '######....', '..........', '##########'],
  };

  const cache = {};
  function pathFor(name) {
    if (cache[name]) return cache[name];
    const rows = BITS[name] || BITS.dots;
    const solid = [], soft = [];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch !== '#' && ch !== '+') continue;
        let e = x;
        while (e < row.length && row[e] === ch) e++;
        (ch === '#' ? solid : soft).push(`M${x} ${y}h${e - x}v1h${x - e}z`);
        x = e - 1;
      }
    });
    return (cache[name] = { solid: solid.join(''), soft: soft.join(''), w: Math.max(...rows.map((r) => r.length)), h: rows.length });
  }

  function icon(name, px) {
    const p = pathFor(name);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${p.w} ${p.h}`);
    svg.setAttribute('width', px || 18);
    svg.setAttribute('height', Math.round((px || 18) * p.h / p.w));
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('shape-rendering', 'crispEdges');
    if (p.soft) { const s = document.createElementNS(NS, 'path'); s.setAttribute('d', p.soft); s.setAttribute('fill', 'currentColor'); s.setAttribute('opacity', '0.5'); svg.appendChild(s); }
    if (p.solid) { const s = document.createElementNS(NS, 'path'); s.setAttribute('d', p.solid); s.setAttribute('fill', 'currentColor'); svg.appendChild(s); }
    return svg;
  }

  // An icon-only button with a tooltip and accessible name: ibtn('pack', 'Pack (P)', onclick, {on: true})
  function ibtn(name, label, onclick, opts) {
    opts = opts || {};
    const b = document.createElement('button');
    b.setAttribute('class', 'ibtn' + (opts.on ? ' on' : '') + (opts.cls ? ' ' + opts.cls : ''));
    b.setAttribute('type', 'button');
    b.setAttribute('title', label);
    b.setAttribute('aria-label', label);
    if (opts.disabled) b.disabled = true;
    b.addEventListener('click', (e) => { e.stopPropagation(); if (onclick) onclick(e); });
    b.appendChild(icon(name, opts.size || 18));
    if (opts.text) { const t = document.createElement('span'); t.setAttribute('class', 'ibtn-text'); t.appendChild(document.createTextNode(opts.text)); b.appendChild(t); }
    return b;
  }

  // One floating card for every (i) and hover explanation. It lives on the page body, so no scrolling pane clips it.
  // content: a string, a node or array of nodes, or a function returning one (called when the card opens).
  let card = null, cardFor = null, pinned = false;
  function hideHover() {
    if (card) card.setAttribute('class', 'hovercard');
    cardFor = null; pinned = false;
  }
  function showHover(anchor, content, at) {
    if (typeof document === 'undefined' || !document.body) return;
    if (!card) { card = document.createElement('div'); card.setAttribute('role', 'tooltip'); document.body.appendChild(card); }
    const body = typeof content === 'function' ? content() : content;
    if (body == null || body === '') { hideHover(); return; }
    card.innerHTML = '';
    card.appendChild(UI.h('div', null, body));
    card.setAttribute('class', 'hovercard show');
    cardFor = anchor;
    const r = at ? { left: at.x, top: at.y, width: 0, height: 0 } : anchor.getBoundingClientRect();
    const vw = typeof innerWidth !== 'undefined' ? innerWidth : 1000;
    const w = card.offsetWidth || 0, hh = card.offsetHeight || 0;
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, vw - w - 8));
    let y = r.top - hh - 8;
    if (y < 8) y = r.top + r.height + (at ? 24 : 8);
    card.style.left = Math.round(x) + 'px';
    card.style.top = Math.round(y) + 'px';
  }
  // A card that gone-from-the-page anchors don't leave behind (call after a render).
  function sweepHover() { if (cardFor && !cardFor.isConnected) hideHover(); }
  // Hover or focus `el` for the card; a tap or click pins it open (touch screens), another closes it.
  function hover(el, content) {
    el.addEventListener('mouseenter', () => { if (!pinned) showHover(el, content); });
    el.addEventListener('mouseleave', () => { if (!pinned) hideHover(); });
    el.addEventListener('focus', () => showHover(el, content));
    el.addEventListener('blur', hideHover);
    return el;
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cardFor) hideHover(); });
  // A click closes a hover card (a pinned one stays: its (i) stops the click). On a touch screen a tap shows the card
  // with no leave after it, so the toolbar's own label stayed over the menu the tap opened.
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', () => { if (cardFor && !pinned) hideHover(); });
  // In the game every `title` shows as this card (at once, styled, wrapped) instead of the browser's slow tooltip.
  // The title moves to data-hint on first hover so the browser's own does not show as well.
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('mouseover', (e) => {
    if (pinned || !document.documentElement.dataset || document.documentElement.dataset.mode !== 'game') return;
    let el = e.target;
    while (el && el.nodeType === 1 && !(el.getAttribute('title') || (el.dataset && el.dataset.hint))) el = el.parentNode;
    if (!el || el.nodeType !== 1 || el.tagName === 'CANVAS') return;
    if (el.getAttribute('title')) { el.dataset.hint = el.getAttribute('title'); el.removeAttribute('title'); }
    if (cardFor === el) return;
    showHover(el, el.dataset.hint);
    const leave = () => { el.removeEventListener('mouseleave', leave); if (cardFor === el && !pinned) hideHover(); };
    el.addEventListener('mouseleave', leave);
  });

  // The small (i): hover or focus it for the explanation. text may be a string, nodes, or a function returning them.
  function tip(text, label) {
    const el = document.createElement('span');
    el.setAttribute('class', 'tip');
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'note');
    if (typeof text === 'string') el.setAttribute('aria-label', (label ? label + ': ' : '') + text);
    else if (label) el.setAttribute('aria-label', label);
    el.appendChild(document.createTextNode('i'));
    el.addEventListener('click', (e) => { e.stopPropagation(); if (pinned && cardFor === el) hideHover(); else { showHover(el, text); pinned = true; } });
    return hover(el, text);
  }

  // ---- Item icons (data/icons.yaml) -------------------------------------------------------------------------
  // The cell of an item (a weapon, armor or shield object), a good (its id, or its definition with `kind`), a worn
  // trinket ({id, at}), or a line of loot text ("5 gold", "Poor goblin warhammer": the longest known name in it).
  const ICONS = () => (G.Content && G.Content.world.icons) || null;
  let byName = null;
  function nameIndex() {
    if (byName) return byName;
    const d = ICONS(), D = G.DATA || {}, W = G.Content.world;
    const out = [];
    for (const [k, v] of Object.entries(D.WEAPONS || {})) if (d.weapons[k] != null) out.push([v.name.toLowerCase(), d.weapons[k]]);
    for (const [k, v] of Object.entries((W.items && W.items.goods) || {})) { const c = d.goods[k] != null ? d.goods[k] : d.kinds[v.kind]; if (c != null) out.push([v.name.toLowerCase(), c]); }
    for (const [k, c] of Object.entries(d.shields)) out.push([k + ' shield', c]);
    for (const [k, c] of Object.entries(d.armor)) out.push([k, c]);
    out.push(['buckler', d.shields.buckler], ['gold', d.gold]);
    byName = out.sort((a, b) => b[0].length - a[0].length);
    return byName;
  }
  // `loc`: the body part it is shown for (a character sheet's slot), so full plate shows a helm in the head slot.
  function iconCell(x, loc) {
    const d = ICONS();
    if (!d || !x) return null;
    const goods = (G.Content.world.items && G.Content.world.items.goods) || {};
    if (typeof x === 'string') {
      if (d.goods[x] != null) return d.goods[x];
      if (goods[x]) return d.kinds[goods[x].kind] != null ? d.kinds[goods[x].kind] : null;
      const t = x.toLowerCase();
      const hit = nameIndex().find(([n]) => t.includes(n));
      return hit ? hit[1] : null;
    }
    if (x.kind === 'weapon') return d.weapons[x.type] != null ? d.weapons[x.type] : null;
    if (x.kind === 'shield') return d.shields[x.size] != null ? d.shields[x.size] : null;
    if (x.kind === 'armor') {
      const cov = loc ? [loc] : G.Items.coversOf(x);
      if (cov.length === 1 && cov[0] === 'head') return ['mail', 'plate'].includes(x.type) ? d.pieces.headMetal : d.pieces.head;
      if (cov.length === 1 && d.pieces[cov[0]] != null) return d.pieces[cov[0]];
      return d.armor[x.type] != null ? d.armor[x.type] : null;
    }
    const id = x.id || x.good;
    if (id && d.goods[id] != null) return d.goods[id];
    const named = x.name ? iconCell(String(x.name)) : null;
    if (named != null) return named;
    return x.kind && d.kinds[x.kind] != null ? d.kinds[x.kind] : null;
  }
  // A span showing the icon at `px` screen pixels (default 24), or null when there is none.
  function itemIcon(x, px, loc) {
    const d = ICONS(), cell = iconCell(x, loc);
    if (cell == null) return null;
    const z = px || 24, k = z / d.size, sheet = d.size * d.cols * k;
    return UI.h('span', { class: 'itemicon', 'aria-hidden': 'true', style: { width: z + 'px', height: z + 'px', backgroundImage: `url(${d.sheet})`, backgroundSize: `${sheet}px auto`, backgroundPosition: `-${(cell % d.cols) * d.size * k}px -${Math.floor(cell / d.cols) * d.size * k}px` } });
  }

  UI.itemIcon = itemIcon;
  UI.iconCell = iconCell;
  UI.tip = tip;
  UI.hover = hover;
  UI.showHover = showHover;
  UI.hideHover = hideHover;
  UI.sweepHover = sweepHover;
  UI.icon = icon;
  UI.ibtn = ibtn;
  UI.Icons = { BITS, icon, ibtn };
})(globalThis.BBB);
