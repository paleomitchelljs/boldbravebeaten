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

  UI.tip = tip;
  UI.hover = hover;
  UI.showHover = showHover;
  UI.hideHover = hideHover;
  UI.sweepHover = sweepHover;
  UI.icon = icon;
  UI.ibtn = ibtn;
  UI.Icons = { BITS, icon, ibtn };
})(globalThis.BBB);
