/*
 * Character art: a layered SVG paper doll that follows the equipment (armor type and coverage, shield
 * size and material, weapons in each hand, worn trinkets). Everything is drawn from the same item data
 * the rules use, so a new armor or weapon in the YAML shows up with at least a sensible shape.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const NS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs || {}) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    for (let i = 2; i < arguments.length; i++) {
      const kid = arguments[i];
      if (Array.isArray(kid)) kid.forEach((x) => x && el.appendChild(x));
      else if (kid) el.appendChild(kid);
    }
    return el;
  }

  const SKIN = ['#f0d2b4', '#e0b48a', '#c58f60', '#9a6a45', '#6d4630', '#4a2f22'];
  const HAIR = ['#2a1c14', '#5a3a22', '#8a5a2c', '#b8893c', '#d9d2c4', '#8b2f1e', '#3a3f4a'];
  const CLOTH = ['#7a5a3a', '#4f6b52', '#52607a', '#7a4f5a', '#6b5b7a', '#7a6d45'];
  const ARMOR_COLOR = { padded: '#c9b37a', leather: '#7a4f2a', mail: '#9aa3a8', plate: '#cdd4da' };
  const METAL = { wood: '#8a6a3c', hide: '#8a6244', iron: '#6f7478', steel: '#b9c2c8', adamant: '#5a5f8f', stone: '#8a8a82', bone: '#d8d2bc' };

  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
  };

  // ---- Weapons (drawn upright in the right hand at about (150, 200)) -------------------------------
  function weaponShape(type, x, y, rot, metal, key) {
    const W = G.DATA.WEAPONS[type] || {};
    const g = svg('g', { transform: `translate(${x} ${y}) rotate(${rot})` });
    const wood = '#6b4a2a';
    const steel = metal;
    const add = (...e) => e.flat().forEach((k) => k && g.appendChild(k));
    const line = (x1, y1, x2, y2, w, col) => svg('line', { x1, y1, x2, y2, stroke: col, 'stroke-width': w, 'stroke-linecap': 'round' });
    if (W.ranged) {
      const long = /long/i.test(type);
      const h = long ? 90 : 66;
      add(svg('path', { d: `M0 ${-h / 2} Q ${long ? 22 : 18} 0 0 ${h / 2}`, fill: 'none', stroke: wood, 'stroke-width': 4, 'stroke-linecap': 'round' }), line(0, -h / 2, 0, h / 2, 1, '#d8d2bc'));
    } else if (/dagger/i.test(type)) {
      add(line(0, 8, 0, 22, 4, wood), line(-5, 8, 5, 8, 3, steel), svg('path', { d: 'M-3 8 L0 -14 L3 8 Z', fill: steel, stroke: shade(steel, 0.6), 'stroke-width': 0.8 }));
    } else if (/spear/i.test(type) || type === 'warScythe') {
      const len = type === 'shortSpear' ? 70 : 100;
      add(line(0, 30, 0, 30 - len, 3.5, wood));
      if (type === 'warScythe') add(svg('path', { d: `M0 ${-len + 30} Q 30 ${-len + 28} 34 ${-len + 52} Q 16 ${-len + 40} 0 ${-len + 42} Z`, fill: steel }));
      else add(svg('path', { d: `M-5 ${30 - len} L0 ${30 - len - 20} L5 ${30 - len} Z`, fill: steel, stroke: shade(steel, 0.6), 'stroke-width': 0.8 }));
    } else if (/mace|club|hammer/i.test(type) || type === 'giantClub') {
      const len = type === 'warhammer' ? 64 : type === 'giantClub' ? 90 : 52;
      add(line(0, 26, 0, 26 - len, 4, wood));
      if (type === 'club' || type === 'giantClub') add(svg('ellipse', { cx: 0, cy: 26 - len, rx: 7, ry: 12, fill: '#7d5a33' }));
      else if (type === 'warhammer') add(svg('rect', { x: -9, y: 26 - len - 6, width: 18, height: 12, fill: steel, stroke: shade(steel, 0.6), 'stroke-width': 0.8 }), svg('path', { d: `M9 ${26 - len - 4} l8 4 l-8 4 z`, fill: steel }));
      else add(svg('circle', { cx: 0, cy: 26 - len, r: 8, fill: steel, stroke: shade(steel, 0.6), 'stroke-width': 0.8 }), [0, 60, 120, 180, 240, 300].map((a) => svg('line', { x1: 0, y1: 26 - len, x2: 11 * Math.cos(a * Math.PI / 180), y2: 26 - len + 11 * Math.sin(a * Math.PI / 180), stroke: steel, 'stroke-width': 2.5 })));
    } else {
      // Swords: blade length from the weapon's physical length.
      const len = Math.max(40, Math.min(110, ((W.phys && W.phys.length) || 1.0) * 76));
      const wide = type === 'greatsword' ? 7 : type === 'rapier' ? 2.6 : 4.5;
      add(line(0, 26, 0, 12, 4, wood), line(-(wide + 6), 12, wide + 6, 12, 3, shade(steel, 0.8)), svg('path', { d: `M${-wide / 2} 12 L0 ${12 - len} L${wide / 2} 12 Z`, fill: steel, stroke: shade(steel, 0.6), 'stroke-width': 0.8 }));
    }
    return g;
  }

  function shieldShape(s, x, y) {
    const st = G.DATA.SHIELDS[s.size] || {};
    const mat = METAL[s.material] || METAL.wood;
    const g = svg('g', { transform: `translate(${x} ${y})` });
    const size = { buckler: 15, round: 25, heater: 28, tower: 34 }[s.size] || 22;
    let body;
    if (s.size === 'heater') body = svg('path', { d: `M${-size} ${-size} H${size} V${size * 0.2} Q ${size} ${size} 0 ${size * 1.5} Q ${-size} ${size} ${-size} ${size * 0.2} Z`, fill: mat });
    else if (s.size === 'tower') body = svg('rect', { x: -size * 0.7, y: -size * 1.4, width: size * 1.4, height: size * 2.8, rx: 4, fill: mat });
    else body = svg('circle', { cx: 0, cy: 0, r: size, fill: mat });
    body.setAttribute('stroke', shade(mat, 0.55));
    body.setAttribute('stroke-width', 2.5);
    g.appendChild(body);
    if (s.material !== 'wood' && s.material !== 'hide') g.appendChild(svg('circle', { cx: 0, cy: 0, r: 4, fill: shade(mat, 1.3), stroke: shade(mat, 0.5) }));
    else g.appendChild(svg('line', { x1: -size * 0.6, y1: 0, x2: size * 0.6, y2: 0, stroke: shade(mat, 0.7), 'stroke-width': 1.5 }));
    if (s.durability <= 0) g.appendChild(svg('path', { d: 'M-8 -12 L2 -2 L-4 4 L6 14', stroke: '#2a1c14', 'stroke-width': 2, fill: 'none' }));
    return g;
  }

  // ---- The doll ------------------------------------------------------------------------------------------
  // opts: { size: px height, bare: no gear }
  function paperDoll(c, opts) {
    opts = opts || {};
    const look = c.look || { skin: 1, hair: 1, cloth: 0, build: 1 };
    const skin = SKIN[look.skin % SKIN.length], hair = HAIR[look.hair % HAIR.length], cloth = CLOTH[look.cloth % CLOTH.length];
    const wide = [0.9, 1, 1.12][look.build == null ? 1 : look.build] || 1;
    const uid = 'pd' + String(c.id || 'x').replace(/\W/g, '');
    const a = !opts.bare && c.armor ? c.armor : null;
    const col = a ? ARMOR_COLOR[a.type] || '#999' : null;
    const cov = a ? a.coverage : null;
    const root = svg('svg', { viewBox: '0 0 200 360', class: 'doll', role: 'img', 'aria-label': `${c.name}, as equipped`, style: opts.size ? `height:${opts.size}px;width:auto` : null });
    root.appendChild(svg('defs', null,
      svg('pattern', { id: uid + 'mail', width: 6, height: 6, patternUnits: 'userSpaceOnUse' }, svg('rect', { width: 6, height: 6, fill: ARMOR_COLOR.mail }), svg('circle', { cx: 3, cy: 3, r: 2.2, fill: 'none', stroke: '#6d767a', 'stroke-width': 0.8 })),
      svg('pattern', { id: uid + 'quilt', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, svg('rect', { width: 8, height: 8, fill: ARMOR_COLOR.padded }), svg('path', { d: 'M0 0 L8 8 M8 0 L0 8', stroke: '#a38d55', 'stroke-width': 0.8 })),
      svg('linearGradient', { id: uid + 'plate', x1: 0, x2: 1, y1: 0, y2: 0 }, svg('stop', { offset: '0', 'stop-color': '#9aa4ab' }), svg('stop', { offset: '0.45', 'stop-color': '#eef2f4' }), svg('stop', { offset: '1', 'stop-color': '#8d979e' }))));
    const fillFor = (type) => type === 'mail' ? `url(#${uid}mail)` : type === 'padded' ? `url(#${uid}quilt)` : type === 'plate' ? `url(#${uid}plate)` : (ARMOR_COLOR[type] || '#888');
    const stroke = a ? shade(col, 0.45) : null;
    const armorFill = a ? fillFor(a.type) : null;
    const W = 54 * wide; // torso half-width scale
    const cx = 100;

    // Shadow
    root.appendChild(svg('ellipse', { cx, cy: 346, rx: 52, ry: 8, fill: 'rgba(0,0,0,0.25)' }));

    // Back arm and the shield side are drawn after the torso; legs first.
    const legCover = a && (cov === 'full');
    const legFill = legCover ? armorFill : cloth;
    root.appendChild(svg('g', { stroke: shade(cloth, 0.5), 'stroke-width': 1.5 },
      svg('rect', { x: cx - 26 * wide, y: 205, width: 22 * wide, height: 120, rx: 8, fill: legFill, stroke: legCover ? stroke : shade(cloth, 0.5) }),
      svg('rect', { x: cx + 4 * wide, y: 205, width: 22 * wide, height: 120, rx: 8, fill: legFill, stroke: legCover ? stroke : shade(cloth, 0.5) }),
      svg('rect', { x: cx - 28 * wide, y: 322, width: 26 * wide, height: 14, rx: 5, fill: '#3b2a1c' }),
      svg('rect', { x: cx + 2 * wide, y: 322, width: 26 * wide, height: 14, rx: 5, fill: '#3b2a1c' })));

    // Torso (cloth under armor).
    root.appendChild(svg('rect', { x: cx - W * 0.62, y: 92, width: W * 1.24, height: 124, rx: 14, fill: cloth, stroke: shade(cloth, 0.5), 'stroke-width': 1.5 }));
    // Arms (skin or sleeves)
    const sleeve = a && (cov === 'full' || cov === 'half');
    const armColor = sleeve ? armorFill : cloth;
    const armStroke = sleeve ? stroke : shade(cloth, 0.5);
    root.appendChild(svg('rect', { x: cx - W * 0.62 - 18, y: 98, width: 20, height: 92, rx: 9, fill: armColor, stroke: armStroke, 'stroke-width': 1.5 }));
    root.appendChild(svg('rect', { x: cx + W * 0.62 - 2, y: 98, width: 20, height: 92, rx: 9, fill: armColor, stroke: armStroke, 'stroke-width': 1.5 }));
    root.appendChild(svg('circle', { cx: cx - W * 0.62 - 8, cy: 196, r: 9, fill: skin }));
    root.appendChild(svg('circle', { cx: cx + W * 0.62 + 8, cy: 196, r: 9, fill: skin }));
    // Body armor over the torso.
    if (a) {
      const body = svg('g', { stroke, 'stroke-width': 2 });
      const tall = cov === 'full' ? 128 : cov === 'half' ? 104 : 70;
      body.appendChild(svg('rect', { x: cx - W * 0.7, y: 90, width: W * 1.4, height: tall, rx: a.type === 'plate' ? 10 : 14, fill: armorFill }));
      if (a.type === 'plate') {
        body.appendChild(svg('path', { d: `M${cx - W * 0.7 - 6} 94 q ${W * 0.7 + 6} -18 ${W * 1.4 + 12} 0 l -4 20 q -${W * 0.7} -12 -${W * 1.4 - 4} 0 z`, fill: armorFill }));
        body.appendChild(svg('line', { x1: cx, y1: 94, x2: cx, y2: 90 + tall, stroke: 'rgba(0,0,0,0.25)' }));
      } else if (a.type === 'leather') {
        [0.2, 0.5, 0.8].forEach((f) => body.appendChild(svg('circle', { cx: cx - W * 0.4 + f * W * 0.8, cy: 110, r: 1.8, fill: '#c9a46a' })));
      }
      if (cov !== 'partial') body.appendChild(svg('rect', { x: cx - W * 0.72, y: 90 + tall - 14, width: W * 1.44, height: 8, fill: shade(col, 0.7), stroke: 'none' }));
      root.appendChild(body);
    }
    // Head
    root.appendChild(svg('rect', { x: cx - 8, y: 68, width: 16, height: 26, rx: 6, fill: shade(skin, 0.9) }));
    root.appendChild(svg('ellipse', { cx, cy: 48, rx: 25, ry: 30, fill: skin, stroke: shade(skin, 0.6), 'stroke-width': 1.5 }));
    root.appendChild(svg('circle', { cx: cx - 9, cy: 50, r: 2.4, fill: '#2a1c14' }));
    root.appendChild(svg('circle', { cx: cx + 9, cy: 50, r: 2.4, fill: '#2a1c14' }));
    root.appendChild(svg('path', { d: `M${cx - 7} 64 Q ${cx} 68 ${cx + 7} 64`, fill: 'none', stroke: '#6b3b2a', 'stroke-width': 1.6, 'stroke-linecap': 'round' }));
    const helm = a && (a.type === 'plate' || (a.type === 'mail' && cov === 'full'));
    if (helm) {
      const hf = a.type === 'plate' ? `url(#${uid}plate)` : fillFor(a.type);
      root.appendChild(svg('path', { d: `M${cx - 27} 54 Q ${cx - 27} 12 ${cx} 12 Q ${cx + 27} 12 ${cx + 27} 54 L ${cx + 22} 54 L ${cx + 22} 44 L ${cx - 22} 44 L ${cx - 22} 54 Z`, fill: hf, stroke, 'stroke-width': 2 }));
      if (a.type === 'plate') root.appendChild(svg('line', { x1: cx, y1: 14, x2: cx, y2: 44, stroke: 'rgba(0,0,0,0.3)', 'stroke-width': 2 }));
    } else {
      root.appendChild(svg('path', { d: `M${cx - 26} 46 Q ${cx - 28} 14 ${cx} 14 Q ${cx + 28} 14 ${cx + 26} 46 Q ${cx + 22} 28 ${cx} 28 Q ${cx - 22} 28 ${cx - 26} 46 Z`, fill: hair, stroke: shade(hair, 0.6), 'stroke-width': 1 }));
    }

    if (!opts.bare) {
      // Shield (on the left of the picture, the character's right arm side).
      if (c.shield) root.appendChild(shieldShape(c.shield, cx - W * 0.62 - 26, 160));
      // Main hand weapon (picture right).
      const main = c.weapons.find((w) => w.id === c.wield);
      const metalOf = (w) => METAL[(G.DATA.WEAPONS[w.type] || {}).material] || METAL.steel;
      if (main) root.appendChild(weaponShape(main.type, cx + W * 0.62 + 8, 170, G.DATA.WEAPONS[main.type].ranged ? 0 : 8, metalOf(main)));
      const off = c.weapons.find((w) => w.id === c.offhand);
      if (off) root.appendChild(weaponShape(off.type, cx - W * 0.62 - 8, 186, -20, metalOf(off)));
      const side = c.weapons.find((w) => w.id === c.sidearm);
      if (side) root.appendChild(weaponShape(side.type, cx + 30 * wide, 250, 75, metalOf(side)));
      // Trinkets
      for (const t of c.trinkets || []) {
        if (t.slot === 'charm') root.appendChild(svg('circle', { cx, cy: 100, r: 5, fill: '#c9a24a', stroke: '#6b4f1a' }));
        if (t.slot === 'ring') root.appendChild(svg('circle', { cx: cx + W * 0.62 + 8, cy: 196, r: 3.5, fill: 'none', stroke: '#e6c96b', 'stroke-width': 2 }));
      }
    }
    if (c.status && c.status.dead) {
      root.appendChild(svg('rect', { x: 0, y: 0, width: 200, height: 360, fill: 'rgba(0,0,0,0.5)' }));
      root.appendChild(svg('text', { x: 100, y: 190, 'text-anchor': 'middle', fill: '#e0655b', 'font-size': 34, 'font-family': 'serif', transform: 'rotate(-14 100 190)' }, document.createTextNode('DEAD')));
    }
    return root;
  }

  // The head and shoulders: same art, cropped.
  function portrait(c, px) {
    const d = paperDoll(c, {});
    d.setAttribute('viewBox', '50 4 100 110');
    d.setAttribute('class', 'doll portrait');
    d.style.height = (px || 56) + 'px';
    d.style.width = (px || 56) + 'px';
    return d;
  }

  UI.Art = { paperDoll, portrait, SKIN, HAIR, CLOTH, svg };
})(globalThis.BBB);
