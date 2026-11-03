/*
 * MapView: the one top-down view the whole game uses. Exploring and fighting draw the same tiles, props and
 * sprites; only the camera and the overlays differ.
 *
 * A view is a canvas plus a `scene()` function the view calls each frame. A scene is
 *   { cell(x, y) -> Explore.cell-like info, w, h,          the dungeon grid
 *     seen(x, y) -> bool | null (null = show everything), light: {x, y, r},
 *     cam: {x, y} (tile the camera centres on) | origin: {x, y} (fixed top-left tile),
 *     actors: [{id, x, y, kind, tint, size, anim, flip, face: {x, y}, alpha, down, bar, ring, tag, label}],
 *     marks: [{x, y, type: 'move'|'late'|'target'|'cast'|'ghost'|'select', text}],
 *     describe(x, y) -> string }
 * Actors are smoothed: give their logical tile and the view walks them there. Tiles are 16 art pixels,
 * drawn at an integer scale. Without Image (Node) nothing is drawn.
 * A scene may name a `tileset` (data/tilesets.yaml, from the place's look): the ground and walls are then drawn flat
 * from it (Tilemap.planTiles) instead of the 3/4 dungeon walls, at the scale its cell size asks for (scaleFor).
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const { h } = UI;
  const Sprites = UI.Sprites;
  const Tilemap = UI.Tilemap;

  const T = 16;
  const WALK_HOLD = 120;
  const HAS_IMG = typeof Image !== 'undefined';
  const DIR = 'art/worldtiles/';

  // ---- Images and the atlas -----------------------------------------------------------------------
  const imgs = {};
  const redraw = [];
  // A name is a sheet in art/worldtiles; a path (with a slash) is used as it is.
  function img(name) {
    if (imgs[name]) return imgs[name];
    const o = imgs[name] = { ok: false, el: null };
    if (!HAS_IMG) return o;
    o.el = new Image();
    o.el.onload = () => { o.ok = true; };
    o.el.onerror = () => { o.failed = true; };
    o.el.src = name.includes('/') ? name : DIR + name + '.png';
    return o;
  }

  // Dungeon_Tiles.png, in 16px cells (col, row).
  // Props: [image, sx, sy, w, h]; drawn with their feet at the cell's bottom centre.
  const PROPS = {
    door: ['furniture', 134, 283, 20, 41],
    doorway: ['furniture', 32, 276, 32, 48],
    iron: ['furniture', 166, 281, 20, 43],
    bed: ['furniture', 0, 149, 32, 54],
    bed2: ['furniture', 32, 149, 32, 54],
    table: ['furniture', 0, 18, 50, 32],
    banner_red: ['props', 67, 70, 10, 21],
    banner_blue: ['props', 83, 70, 10, 21],
    sarcophagus: ['props', 97, 1, 14, 21],
    coffin: ['props', 113, 2, 14, 20],
    crate: ['objects', 1, 16, 23, 24],
    crates: ['objects', 40, 14, 30, 26],
    urn: ['objects', 76, 16, 24, 24],
    vase: ['objects', 78, 38, 20, 18],
    cauldron: ['objects', 90, 48, 28, 22],
    candelabra: ['objects', 34, 28, 18, 28],
    tomb: ['objects', 6, 52, 24, 22],
    statue: ['objects', 7, 68, 33, 28],
    cross: ['objects', 48, 74, 16, 21],
    grave: ['objects', 62, 76, 18, 19],
    web: ['objects', 108, 8, 20, 23],
    scroll: ['esoteric', 1, 100, 33, 20],
    chest: ['chest', 6, 16, 21, 16],
    chest_open: ['chest', 230, 13, 21, 19],
    gold: ['gold', 33, 5, 30, 40],
    stairs: ['stairs_down', 0, 0, 16, 16],
  };

  // Spell effects (data/fx.yaml; strips in art/fx): a bolt in flight, an impact where it lands, a burst over an area
  // spell, a flame on a burning square. A spell noun picks the colour of its bolt and impact.
  const FX = () => (G.Content && G.Content.world.fx) || null;
  const fxColour = (noun) => { const d = FX(); return d ? (d.nouns || {})[noun] || 'arcane' : null; };
  const fxImgs = {};
  function fxImg(file) {
    if (fxImgs[file]) return fxImgs[file];
    const o = fxImgs[file] = { ok: false, el: null };
    if (!HAS_IMG || !FX()) return o;
    o.el = new Image();
    o.el.onload = () => { o.ok = true; };
    o.el.onerror = () => { o.failed = true; };
    o.el.src = FX().dir + file;
    return o;
  }
  // Frame `i` of a strip whose frames are `w` x `h`, drawn centred on (x, y) at `scale` art pixels to screen pixels.
  function fxFrame(ctx, file, i, w, h, x, y, scale, alpha) {
    const im = fxImg(file);
    if (!im.ok) return false;
    ctx.save(); ctx.imageSmoothingEnabled = false; if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(im.el, i * w, 0, w, h, Math.round(x - w * scale / 2), Math.round(y - h * scale / 2), w * scale, h * scale);
    ctx.restore();
    return true;
  }

  // Taller walls. A cliff set's face is one square tall (half the wall's last row, half the square in front), shorter
  // than the figures. On a wall at least two squares thick, the face is raised half a square more: its lip and the
  // courses under it are drawn again over the lower half of the wall's last row, so the top recedes and the face
  // stands about a head taller than a person. A tileset with tallFaces: false keeps the short faces.
  let liftScratch = null;
  function liftFaces(ctx, sc, x0, y0, ox, oy, size) {
    if (typeof document === 'undefined' || !ctx.canvas) return;
    const solid = (x, y) => { const c = sc.cell(x, y); return !!c && (c.kind === 'wall' || c.kind === 'rock' || !!(c.def && c.def.wall)); };
    const L = Math.max(1, Math.round(size * 6 / 64)), half = Math.round(size / 2);
    if (!liftScratch) liftScratch = document.createElement('canvas');
    if (liftScratch.width !== size || liftScratch.height !== half + L) { liftScratch.width = size; liftScratch.height = half + L; }
    const sx = liftScratch.getContext('2d');
    for (let y = y0 - 1; y <= y0 + 12 + Math.ceil(ctx.canvas.height / size); y++) for (let x = x0 - 1; x <= x0 + 1 + Math.ceil(ctx.canvas.width / size); x++) {
      if (!solid(x, y) || solid(x, y + 1) || !solid(x, y - 1)) continue;
      const X = ox + x * size, Y = oy + y * size;
      if (X + size < 0 || Y + size < 0 || X > ctx.canvas.width || Y > ctx.canvas.height) continue;
      sx.clearRect(0, 0, size, half + L);
      sx.drawImage(ctx.canvas, X, Y + half, size, half + L, 0, 0, size, half + L);
      ctx.drawImage(liftScratch, 0, 0, size, L, X, Y, size, L);
      ctx.drawImage(liftScratch, 0, L, size, half, X, Y + L, size, half);
    }
  }

  const hash = (x, y, k) => { let n = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0); };

  // Draw part of a named image; false if it has not loaded yet.
  function blit(ctx, name, sx, sy, sw, sh, dx, dy, dw, dh) {
    const o = img(name);
    if (!o.ok) return false;
    ctx.drawImage(o.el, sx, sy, sw, sh, dx, dy, dw, dh);
    return true;
  }

  const clockNow = () => (typeof performance !== 'undefined' ? performance.now() : 0);

  // A prop by name: the tileset of the place being drawn first (its door replaces the stock one), then the table
  // above, then any tileset's (art drawn at its own cell size, so a 64-px tileset's well is as wide as a square).
  let placeTs = null;
  function propDef(key) {
    const fromTs = (id) => { const ts = Tilemap.tileset(id), p = ts && ts.props[key]; return p ? [ts.dir + p[0], p[1], p[2], p[3], p[4], T / ts.cell, p[5], p[6], p[7], p[8]] : null; };
    const own = placeTs && fromTs(placeTs);
    if (own) return own;
    if (PROPS[key]) return PROPS[key];
    for (const id of Object.keys((G.Content && G.Content.world.tilesets) || {})) {
      const p = fromTs(id);
      if (p) return p;
    }
    return null;
  }

  // A prop with its feet at (x, y); `fit` shrinks it to a width in art pixels (a door in a 16px cell).
  function prop(ctx, key, x, y, S, opts) {
    const p = propDef(key);
    if (!p) return;
    opts = opts || {};
    const k = (opts.scale || 1) * (p[5] || 1);
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    // Flipped upside down about its own middle, so it stays on its square.
    if (opts.flipY) { const mid = y - (p[4] * S * k) / 2; ctx.translate(0, mid); ctx.scale(1, -1); ctx.translate(0, -mid); }
    // squash narrows a prop (a door seen edge-on or swung open); anchor 'left' pins its left edge at x instead of its middle.
    const w = p[3] * S * k * (opts.squash || 1);
    // An animated prop [.., dx, dy, frames, fps] (a waterfall, grass in the wind): its frames side by side from x, each
    // `w` wide, played at fps; `phase` staggers props of one kind so they don't move in step.
    const sx = p[8] > 1 ? p[1] + (Math.floor(clockNow() * (p[9] || 8) / 1000 + (opts.phase || 0)) % p[8]) * p[3] : p[1];
    // A tileset prop with an offset [.., dx, dy] is laid at that many art pixels from its square's top-left corner (a
    // doorway cut to fit the wall around it) instead of standing on the square's bottom.
    if (p[6] != null) blit(ctx, p[0], sx, p[2], p[3], p[4], Math.round(x - (T * S) / 2 + p[6] * S * k), Math.round(y - T * S + p[7] * S * k), w, p[4] * S * k);
    else blit(ctx, p[0], sx, p[2], p[3], p[4], Math.round(opts.anchor === 'left' ? x : x - w / 2), Math.round(y - p[4] * S * k), w, p[4] * S * k);
    ctx.restore();
  }

  // ---- Standing things (layer 5) ----------------------------------------------------------------------------------
  // Furniture, chests and shrines: solid things with a body, drawn with their feet at the square's bottom.
  function drawObject(ctx, c, X, Y, S, mx, my) {
    const size = T * S, cx = X + size / 2, feet = Y + size;
    const d = c.def || {}, st = c.st || {};
    switch (c.kind) {
      case 'chest': prop(ctx, st.opened ? 'chest_open' : 'chest', cx, feet - S * 1, S); break;
      case 'shrine': prop(ctx, 'statue', cx, feet - S * 1, S, { scale: 0.8 }); break;
      case 'prop': {
        const key = d.sprite || 'crate';
        if (key === 'none') break; // the rest of something drawn from another square (a building's footprint)
        if (propDef(key)) { prop(ctx, key, cx, feet - S * (d.lift || 1), S, { scale: d.scale || 1, phase: hash(mx || 0, my || 0, 5) % 7 }); break; }
        // No art for it yet: a stone block with a dark top, so it reads as something in the way.
        ctx.fillStyle = '#8a7e66'; ctx.fillRect(X + size * 0.18, Y + size * 0.3, size * 0.64, size * 0.6);
        ctx.fillStyle = '#05070a'; ctx.fillRect(X + size * 0.26, Y + size * 0.36, size * 0.48, size * 0.3);
        break;
      }
      default: break;
    }
  }

  function twinkle(ctx, x, y, S, tick) {
    const a = 0.55 + 0.45 * Math.sin(tick / 6);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffe9a0';
    const r = S * 2.2;
    ctx.fillRect(x - S * 0.5, y - r, S, r * 2);
    ctx.fillRect(x - r, y - S * 0.5, r * 2, S);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - S * 0.5, y - S * 0.5, S, S);
    ctx.restore();
  }

  // ---- The view ----------------------------------------------------------------------------------------
  const MARK = {
    move: ['rgba(80,200,230,0.28)', 'rgba(110,225,255,0.9)'],
    late: ['rgba(230,190,80,0.22)', 'rgba(240,205,110,0.9)'],
    target: ['rgba(230,70,60,0.30)', 'rgba(255,110,95,0.95)'],
    cast: ['rgba(190,110,255,0.28)', 'rgba(210,150,255,0.95)'],
    ghost: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.5)'],
    select: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.9)'],
    ally: ['rgba(90,220,140,0.25)', 'rgba(120,240,170,0.95)'],
    // Quiet versions for whole areas: where the active character could move, or a spell would land.
    reach: ['rgba(90,200,235,0.09)', 'rgba(120,220,255,0.22)'],
    reachLate: ['rgba(240,205,110,0.07)', 'rgba(240,205,110,0.22)'],
    area: ['rgba(190,110,255,0.20)', 'rgba(210,150,255,0.55)'],
  };
  const QUIET = { reach: 1, reachLate: 1, area: 1 };
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // An icon from UI.Icons drawn onto the canvas at (cx, cy), `px` screen pixels per bit, on a dark tab.
  function drawIcon(ctx, name, cx, cy, px, color) {
    const rows = (UI.Icons && UI.Icons.BITS[name]) || [];
    const h = rows.length, w = Math.max(0, ...rows.map((r) => r.length));
    const x0 = Math.round(cx - (w * px) / 2), y0 = Math.round(cy - (h * px) / 2);
    ctx.fillStyle = 'rgba(5,8,11,0.82)';
    ctx.fillRect(x0 - px * 2, y0 - px * 2, (w + 4) * px, (h + 4) * px);
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, px * 0.6);
    ctx.strokeRect(x0 - px * 2, y0 - px * 2, (w + 4) * px, (h + 4) * px);
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#' && row[x] !== '+') continue;
      ctx.globalAlpha = row[x] === '+' ? 0.5 : 1;
      ctx.fillStyle = color; ctx.fillRect(x0 + x * px, y0 + y * px, px, px);
    } });
    ctx.globalAlpha = 1;
  }

  // opts: {cols, rows, scale, scene: () => scene, onCell(x, y, ev), onHover(x, y)}
  function create(opts) {
    const cols = opts.cols || 15, rows = opts.rows || 10, S = opts.scale || 3;
    const canvas = h('canvas', { class: 'mapcanvas', width: cols * T * S, height: rows * T * S, role: 'img', 'aria-label': opts.label || 'Map' });
    const view = { el: canvas, cols, rows, S, cam: null, vis: {}, hover: null, stop: false, tick: 0, last: 0, fx: [] };
    // Short effects, timed from now (+ delay ms): text rising off a figure, a lunge toward a square, a bolt between two figures, a shudder.
    view.popup = (id, text, color, delay) => view.fx.push({ k: 'text', id, text, color: color || '#fff', t0: clock() + (delay || 0), dur: 1300 });
    // A lunge plays the figure's strike frames (its thrust frames with clip 'thrust'); `still` keeps it in its square (a shot).
    view.lunge = (id, tx, ty, delay, still, clip) => view.fx.push({ k: 'lunge', id, tx, ty, still, clip: clip || 'attack', t0: clock() + (delay || 0), dur: 260 });
    // A bolt: a square of colour, an arrow (opts.shape), or (element given, and the effect sheets there) a fireball,
    // frost shard or spark from art/effects with a flash where it lands. opts.dur: its flight in ms.
    // opts.stop: the square (map coordinates) a wall stops it at, short of `to`.
    view.bolt = (from, to, color, delay, noun, opts) => {
      const t0 = clock() + (delay || 0), colour = noun ? fxColour(noun) : null, stop = (opts && opts.stop) || null;
      view.fx.push({ k: 'bolt', from, to, stop, color: color || '#ffe9a0', t0, dur: (opts && opts.dur) || (colour ? 320 : 200), colour, shape: opts && opts.shape });
      if (colour && !stop) view.fx.push({ k: 'flash', id: to, colour, t0: t0 + 320, dur: 300 });
    };
    // An area spell going off over a square (map coordinates).
    view.burst = (x, y, noun, delay) => view.fx.push({ k: 'burst', x, y, colour: fxColour(noun), t0: clock() + (delay || 0), dur: 860 });
    view.shudder = (id, delay) => view.fx.push({ k: 'shudder', id, t0: clock() + (delay || 0), dur: 300 });
    // A hit: the figure washes red and fades back (longer for a wound).
    view.hurt = (id, delay, wound) => view.fx.push({ k: 'hurt', id, t0: clock() + (delay || 0), dur: wound ? 520 : 360 });
    const scene = () => opts.scene();

    function cellAt(ev) {
      const r = canvas.getBoundingClientRect();
      const px = (ev.clientX - r.left) / (r.width || 1) * canvas.width;
      const py = (ev.clientY - r.top) / (r.height || 1) * canvas.height;
      const ox = view.org ? view.org.x : 0, oy = view.org ? view.org.y : 0;
      return { x: Math.floor(px / (T * S) + ox), y: Math.floor(py / (T * S) + oy) };
    }
    canvas.addEventListener('click', (ev) => { if (!opts.onCell) return; const c = cellAt(ev); opts.onCell(c.x, c.y, ev); });
    canvas.addEventListener('mousemove', (ev) => {
      const c = cellAt(ev);
      if (view.hover && view.hover.x === c.x && view.hover.y === c.y) return;
      view.hover = c;
      const sc = scene();
      const text = sc && sc.describe ? (sc.describe(c.x, c.y) || '') : '';
      // The game's hover card where it is loaded (at the pointer, at once); else the browser's slow title.
      if (UI.showHover) { if (text) UI.showHover(canvas, text, { x: ev.clientX, y: ev.clientY - 14 }); else UI.hideHover(); }
      else canvas.title = text;
      if (opts.onHover) opts.onHover(c.x, c.y);
    });
    canvas.addEventListener('mouseleave', () => { view.hover = null; if (UI.hideHover) UI.hideHover(); });

    // Move the camera and the actors toward where the scene says they are. Returns true while anything moves.
    function advance(sc, dt) {
      let moving = false;
      const W = cols, H = rows;
      const seen = {};
      for (const a of sc.actors || []) {
        seen[a.id] = 1;
        const v = view.vis[a.id] || (view.vis[a.id] = { x: a.x, y: a.y, f: 0, run: false, flip: !!a.flip, dir: a.flip ? 'south-west' : 'south-east' });
        const dx = a.x - v.x, dy = a.y - v.y, d = Math.hypot(dx, dy);
        // Facing: the way it walks; standing, toward `face` (a square) if the scene gives one, else the side `flip` says,
        // else the way it last walked.
        if (d > 0.02) {
          const step = Math.min(d, dt * (a.speed || 7.5));
          v.x += dx / d * step; v.y += dy / d * step;
          if (Math.abs(dx) > 0.05) v.flip = dx < 0;
          v.dir = Sprites.dirOf(dx, dy);
          v.travel = (v.travel || 0) + step;
          v.run = true; v.walked = clockNow(); moving = true;
        } else {
          // Arrived. A walk along a path pauses a moment at each square before the next step; the walk keeps playing
          // through that pause (WALK_HOLD ms) rather than snapping to the standing pose and back.
          v.x = a.x; v.y = a.y;
          if (v.run && clockNow() - (v.walked || 0) > WALK_HOLD) v.run = false;
          if (a.flip != null) v.flip = !!a.flip;
          if (a.face && (a.face.x !== a.x || a.face.y !== a.y)) v.dir = Sprites.dirOf(a.face.x - a.x, a.face.y - a.y);
          else if (a.flip != null && /west/.test(v.dir) !== !!a.flip) v.dir = a.flip ? 'south-west' : 'south-east';
        }
      }
      for (const id of Object.keys(view.vis)) if (!seen[id]) delete view.vis[id];
      let tx, ty, follow = false;
      if (sc.origin) { tx = sc.origin.x; ty = sc.origin.y; }
      else {
        // The camera follows the figure standing on its square as it glides (not the square itself, which jumps a
        // whole square each step and made the view surge).
        const on = (sc.actors || []).find((a) => a.x === sc.cam.x && a.y === sc.cam.y), fv = on && view.vis[on.id];
        const cx = fv ? fv.x : sc.cam.x, cy = fv ? fv.y : sc.cam.y;
        follow = fv && view.follow === on.id;
        view.follow = fv ? on.id : null;
        // `margin` {l, r, t, b}: squares past an edge the camera may show (the road running on past a way out).
        const mg = sc.margin || {};
        tx = Math.max(-(mg.l || 0), Math.min(Math.max(0, sc.w - W) + (mg.r || 0), cx + 0.5 - W / 2));
        // One row above the map is allowed: the caps of a top wall stand there.
        ty = Math.max(-Math.max(1, mg.t || 0), Math.min(Math.max(0, sc.h - H) + (mg.b || 0), cy + 0.5 - H / 2));
        if (sc.w < W) tx = (sc.w - W) / 2;
        if (sc.h < H) ty = (sc.h - H) / 2;
      }
      if (!view.org) view.org = { x: tx, y: ty };
      // Following the same figure as last frame, and close by (it is walking): move with it. Otherwise (a new place, a
      // fight's focus passing to someone else) ease across.
      const k = follow && Math.hypot(tx - view.org.x, ty - view.org.y) < 1.5 ? 1 : Math.min(1, dt * 9);
      view.org.x += (tx - view.org.x) * k; view.org.y += (ty - view.org.y) * k;
      if (Math.abs(tx - view.org.x) < 0.01) view.org.x = tx; else moving = true;
      if (Math.abs(ty - view.org.y) < 0.01) view.org.y = ty; else moving = true;
      return moving;
    }

    function drawMarks(ctx, sc, ox, oy) {
      const size = T * S;
      for (const m of sc.marks || []) {
        const col = MARK[m.type] || MARK.select;
        const X = ox + m.x * size, Y = oy + m.y * size;
        if (X < -size || Y < -size || X > canvas.width || Y > canvas.height) continue;
        ctx.fillStyle = col[0];
        ctx.fillRect(X, Y, size, size);
        ctx.strokeStyle = col[1];
        ctx.lineWidth = Math.max(1, S * (QUIET[m.type] ? 0.35 : 0.6));
        if (m.type === 'late' || m.type === 'reachLate') ctx.setLineDash([S * 2, S * 2]);
        ctx.strokeRect(X + S * 0.8, Y + S * 0.8, size - S * 1.6, size - S * 1.6);
        ctx.setLineDash([]);
        if (m.text) {
          ctx.fillStyle = col[1];
          ctx.font = `${S * 5}px "Pixelify Sans", monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(m.text, X + size / 2, Y + size / 2);
        }
      }
    }

    // Ground-level lines through square centres: a path ('dots'), or an aim line from one figure to another.
    // line: { pts: [{x, y}], color, style: 'dots' | 'dash' | 'solid', alpha }
    function drawLines(ctx, sc, ox, oy) {
      const size = T * S;
      const P = (p) => [ox + (p.x + 0.5) * size, oy + (p.y + 0.62) * size];
      for (const L of sc.lines || []) {
        if (!L.pts || L.pts.length < 2) continue;
        ctx.save();
        ctx.globalAlpha = L.alpha == null ? 1 : L.alpha;
        ctx.strokeStyle = L.color; ctx.fillStyle = L.color;
        if (L.style === 'dots') {
          for (let i = 1; i < L.pts.length; i++) {
            const [ax, ay] = P(L.pts[i - 1]), [bx, by] = P(L.pts[i]);
            for (const t of [0.33, 0.66, 1]) { const x = ax + (bx - ax) * t, y = ay + (by - ay) * t; const r = t === 1 ? S * 1.5 : S; ctx.fillRect(Math.round(x - r), Math.round(y - r), r * 2, r * 2); }
          }
        } else {
          ctx.lineWidth = S * 0.8;
          if (L.style === 'dash') ctx.setLineDash([S * 3, S * 2]);
          ctx.beginPath();
          L.pts.forEach((p, i) => { const [x, y] = P(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Corner brackets around a square: what the selected action is aimed at. Pulses gently.
    function drawReticles(ctx, sc, ox, oy, tick) {
      const size = T * S;
      for (const r of sc.reticles || []) {
        const pad = (r.strong ? 0.5 + 0.5 * Math.sin(tick / 2.5) : 0) * S;
        const X = ox + r.x * size - pad, Y = oy + r.y * size - pad, Z = size + pad * 2, L = size * 0.32, w = Math.max(1, S * (r.strong ? 1 : 0.6));
        ctx.save();
        ctx.globalAlpha = r.strong ? 1 : 0.6;
        ctx.fillStyle = r.color;
        for (const [cx, cy, dx, dy] of [[X, Y, 1, 1], [X + Z, Y, -1, 1], [X, Y + Z, 1, -1], [X + Z, Y + Z, -1, -1]]) {
          ctx.fillRect(dx > 0 ? cx : cx - L, dy > 0 ? cy : cy - w, L, w);
          ctx.fillRect(dx > 0 ? cx : cx - w, dy > 0 ? cy : cy - L, w, L);
        }
        ctx.restore();
      }
    }

    // Where a figure is drawn this frame (its walk position plus any lunge or shudder), in squares.
    function offsetOf(id, t) {
      let dx = 0, dy = 0;
      for (const f of view.fx) {
        if (f.id !== id || t < f.t0) continue;
        const p = (t - f.t0) / f.dur;
        if (p > 1) continue;
        if (f.k === 'lunge' && !f.still) { const v = view.vis[id]; if (!v) continue; const ddx = f.tx - v.x, ddy = f.ty - v.y, d = Math.hypot(ddx, ddy) || 1; const k = 0.3 * Math.sin(Math.PI * p); dx += (ddx / d) * k; dy += (ddy / d) * k; }
        if (f.k === 'shudder') dx += Math.sin(p * 28) * 0.07 * (1 - p);
      }
      return [dx, dy];
    }

    // Above the figures: icons over heads, flying bolts, rising text.
    function drawOver(ctx, sc, ox, oy, t) {
      const size = T * S, SS = Math.max(1, S - 1);
      const head = (id) => { const v = view.vis[id]; if (!v) return null; const a = (sc.actors || []).find((q) => q.id === id); const [dx, dy] = offsetOf(id, t); return [ox + (v.x + dx + 0.5) * size, oy + (v.y + dy + 1) * size - S * 1.5 - 31 * SS * ((a && (a.art && Sprites.artReady(a.art) ? a.artSize : a.size)) || 1)]; };
      // Fires burning on squares (a wall of fire): a looping flame standing in each.
      const fl = FX() && FX().flame;
      for (const q of sc.flames || []) if (fl) fxFrame(ctx, fl.file, (Math.floor(t / fl.ms) + q.x * 3 + q.y) % fl.frames, fl.w, fl.h, ox + (q.x + 0.5) * size, oy + (q.y + 1) * size - fl.h * size / 64 / 2, size / 64);
      for (const b of UI.cleanMap ? [] : sc.badges || []) {
        const at = b.id ? head(b.id) : [ox + (b.x + 0.5) * size, oy + b.y * size];
        if (!at) continue;
        drawIcon(ctx, b.icon, at[0], at[1] - S * 7 + Math.sin(view.tick / 3) * S * 0.8, Math.max(1, Math.round(S * 0.75)), b.color);
      }
      for (const f of view.fx) {
        if (t < f.t0) continue;
        const p = (t - f.t0) / f.dur;
        if (p > 1) continue;
        if (f.k === 'flash') {
          const at = head(f.id), d = FX();
          if (!at || !d) continue;
          fxFrame(ctx, `impact-${f.colour}.png`, Math.min(d.impact.frames - 1, Math.floor(p * d.impact.frames)), d.impact.size, d.impact.size, at[0], at[1] + 14 * SS, size / 64);
          continue;
        }
        if (f.k === 'burst') {
          const d = FX();
          if (!d) continue;
          // Fire's own explosion; another colour shows its impact, larger.
          const fire = f.colour === 'fire', b = d.burst;
          if (fire) fxFrame(ctx, b.file, Math.min(b.frames - 1, Math.floor(p * b.frames)), b.size, b.size, ox + (f.x + 0.5) * size, oy + (f.y + 0.5) * size, size * 2.4 / b.size);
          else fxFrame(ctx, `impact-${f.colour}.png`, Math.min(d.impact.frames - 1, Math.floor(p * d.impact.frames)), d.impact.size, d.impact.size, ox + (f.x + 0.5) * size, oy + (f.y + 0.5) * size, size * 2.4 / d.impact.size);
          continue;
        }
        if (f.k === 'bolt') {
          const a = head(f.from), b = f.stop ? [ox + (f.stop.x + 0.5) * size, oy + (f.stop.y + 0.5) * size - 14 * SS] : head(f.to);
          if (!a || !b) continue;
          const x = a[0] + (b[0] - a[0]) * p, y = a[1] + 14 * SS + (b[1] - a[1]) * p;
          const d = FX();
          if (f.colour && d && fxFrame(ctx, `bolt-${f.colour}.png`, Math.floor(t / d.bolt.ms) % d.bolt.frames, d.bolt.size, d.bolt.size, x, y, size / 64)) continue;
          if (f.shape === 'arrow') {
            // Shaft, head and fletching, drawn pointing right and turned to its flight.
            ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
            const L = 6 * S, w = Math.max(1, Math.round(S * 0.6));
            ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-L, -w, L * 2, w * 2 + 1);
            ctx.fillStyle = '#c9a46a'; ctx.fillRect(-L, -w / 2, L * 2 - S, w);
            ctx.fillStyle = '#e8eef0'; ctx.beginPath(); ctx.moveTo(L + S, 0); ctx.lineTo(L - S * 1.5, -S * 1.3); ctx.lineTo(L - S * 1.5, S * 1.3); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#e04a3a'; ctx.fillRect(-L, -S * 1.2, S * 2, S * 0.8); ctx.fillRect(-L, S * 0.4, S * 2, S * 0.8);
            ctx.restore();
            continue;
          }
          ctx.fillStyle = f.color; ctx.fillRect(Math.round(x - S * 1.5), Math.round(y - S * 1.5), S * 3, S * 3);
          ctx.globalAlpha = 0.4; ctx.fillRect(Math.round(x - (b[0] - a[0]) * 0.06 - S), Math.round(y - (b[1] - a[1]) * 0.06 - S), S * 2, S * 2); ctx.globalAlpha = 1;
        } else if (f.k === 'text') {
          const at = head(f.id);
          if (!at) continue;
          ctx.save();
          ctx.globalAlpha = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
          ctx.font = `bold ${Math.round(S * 6)}px "Pixelify Sans", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          const y = at[1] - S * 2 - p * size * 0.9;
          ctx.lineWidth = S * 1.4; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.strokeText(f.text, at[0], y);
          ctx.fillStyle = f.color; ctx.fillText(f.text, at[0], y);
          ctx.restore();
        }
      }
      view.fx = view.fx.filter((f) => t < f.t0 + f.dur);
    }

    // The little z's over a sleeper (decor layer: above the walls, below the figures).
    function drawSleep(ctx, v, ox, oy, S, tick) {
      const size = T * S, SS = Math.max(1, S - 1);
      const x = ox + (v.x + 0.5) * size, y = oy + (v.y + 1) * size - S * 1.5;
      ctx.fillStyle = 'rgba(200,220,255,0.9)'; ctx.font = `${S * 5}px "Pixelify Sans", monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('z', x + 5 * S, y - 20 * SS - (tick % 12) * 0.3 * S); ctx.fillText('z', x + 8 * S, y - 24 * SS - (tick % 12) * 0.3 * S);
    }

    // The tileset's ground and walls change only when the place does or something in it opens (a door, a secret): they
    // are drawn once into chunks of CHUNK squares and each frame copies the chunks in view, instead of planning and
    // painting hundreds of tiles 60 times a second (the user, 2026-11-01: movement lagged on an iPhone). A chunk is
    // painted with a square of margin all round (corner tiles, decor and raised faces reach over their square; the
    // raised faces copy from the square below) and only its inside is copied out. The scene's `tileKey` says when
    // the place's state has changed; a chunk painted while any of its images was still loading is painted again.
    const CHUNK = 8, CHUNKS_KEPT = 28;
    view.chunks = { key: null, map: new Map() };
    function paintChunk(sc, ts, env, cx, cy, size, old) {
      const cv = old ? old.canvas : document.createElement('canvas');
      cv.width = cv.height = (CHUNK + 2) * size;   // (re)setting the size clears it
      const c2 = cv.getContext('2d');
      c2.imageSmoothingEnabled = false;
      const X0 = cx * CHUNK - 1, Y0 = cy * CHUNK - 1, ox2 = -X0 * size, oy2 = -Y0 * size;
      let loading = false;
      const look = (n) => { const o = img(n); if (!o.ok && !o.failed) loading = true; return o; };
      const env2 = Object.assign({}, env, { ox: ox2, oy: oy2, img: look, imgAt: look });
      const tp = Tilemap.planTiles(sc, ts, X0 - 1, Y0 - 1, X0 + CHUNK + 2, Y0 + CHUNK + 2);
      for (const k of ['base', 'corner', 'decor', 'over']) for (const c of tp[k]) Tilemap.paintTiles(c2, c, ts, env2, k);
      if (ts.raw.tallFaces !== false) liftFaces(c2, sc, X0, Y0, ox2, oy2, size);
      return { canvas: cv, loading };
    }
    function groundChunks(ctx, sc, ts, env, x0, y0, ox, oy, size) {
      const cache = view.chunks, key = (sc.tileset || '') + '|' + (sc.tileKey != null ? sc.tileKey : '') + '|' + size;
      if (cache.key !== key) { cache.key = key; cache.map.clear(); }
      const cx0 = Math.floor((x0 - 1) / CHUNK), cy0 = Math.floor((y0 - 1) / CHUNK);
      const cx1 = Math.floor((x0 + cols) / CHUNK), cy1 = Math.floor((y0 + rows) / CHUNK);
      let painted = false;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const k = cx + ',' + cy;
        let ch = cache.map.get(k);
        if (!ch || ch.loading) { ch = paintChunk(sc, ts, env, cx, cy, size, ch); painted = true; }
        cache.map.delete(k); cache.map.set(k, ch);   // most recently used last
        ctx.drawImage(ch.canvas, size, size, CHUNK * size, CHUNK * size, ox + cx * CHUNK * size, oy + cy * CHUNK * size, CHUNK * size, CHUNK * size);
      }
      // A frame that painted nothing paints one chunk of the ring just outside the view, so the camera seldom has to
      // wait for one as it moves on.
      if (!painted) {
        ring: for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
          if (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) continue;
          if (cx * CHUNK >= sc.w + 1 || cy * CHUNK >= sc.h + 1 || (cx + 1) * CHUNK < -1 || (cy + 1) * CHUNK < -1) continue;
          const k = cx + ',' + cy;
          if (cache.map.has(k)) continue;
          cache.map.set(k, paintChunk(sc, ts, env, cx, cy, size, null));
          break ring;
        }
      }
      while (cache.map.size > CHUNKS_KEPT) cache.map.delete(cache.map.keys().next().value);
    }

    // Moving terrain (a tileset terrain with `anim`, lava): drawn each frame under the cached ground, which leaves those
    // squares clear and draws their edges from a sheet with the terrain cut away. anim: {sheet, size, frames, cols, fps}
    // is one seamless surface `size` art pixels a side (several squares), each square drawing the part under it, so
    // neighbours join. `spurt: [sheet, w, h, frames, fps]`, `every` (seconds): a jet now and then from one square in
    // five well inside it, each square on its own cycle of every to twice that.
    function animKnown(sc, ts) {
      const key = view.chunks.key;
      if (!view.anim || view.anim.key !== key || view.anim.ts !== ts) view.anim = { key, ts, at: new Map(), any: Object.values(ts.terrains).some((t) => t.anim) };
      return view.anim;
    }
    function animGround(ctx, sc, ts, x0, y0, ox, oy, size, now) {
      const A = animKnown(sc, ts);
      if (!A.any) return;
      const cell = ts.cell;
      for (let y = y0 - 1; y <= y0 + rows; y++) for (let x = x0 - 1; x <= x0 + cols; x++) {
        const k = x + ',' + y;
        let a = A.at.get(k);
        if (a === undefined) { a = Tilemap.animAt(sc, ts, x, y); A.at.set(k, a); }
        if (!a) continue;
        const d = a.t.anim, im = img(ts.dir + d.sheet);
        if (!im.ok) { ctx.fillStyle = a.t.color || '#d0461a'; ctx.fillRect(ox + x * size, oy + y * size, size, size); continue; }
        const f = Math.floor((now / 1000) * (d.fps || 8)) % d.frames, cols_ = d.cols || d.frames, n = Math.max(1, Math.round(d.size / cell));
        const sx = (f % cols_) * d.size + (((x % n) + n) % n) * cell, sy = Math.floor(f / cols_) * d.size + (((y % n) + n) % n) * cell;
        ctx.drawImage(im.el, sx, sy, cell, cell, ox + x * size, oy + y * size, size, size);
      }
    }
    function animSpurts(ctx, sc, ts, x0, y0, ox, oy, size, now, shown) {
      const A = view.anim;
      if (!A || !A.any) return;
      const own = (x, y) => { const a = A.at.get(x + ',' + y); return a && a.own; };
      for (let y = y0; y < y0 + rows; y++) for (let x = x0; x < x0 + cols; x++) {
        if (!own(x, y) || !shown[x + ',' + y] || hash(x, y, 17) % 5) continue;
        const a = A.at.get(x + ',' + y), d = a.t.anim, sp = d.spurt;
        if (!sp || !own(x - 1, y) || !own(x + 1, y) || !own(x, y - 1) || !own(x, y + 1)) continue;
        const every = d.every || 10, cycle = every * (1 + (hash(x, y, 18) % 100) / 100), t = (now / 1000 + (hash(x, y, 19) % 1000) / 1000 * cycle) % cycle;
        const f = Math.floor(t * (sp[4] || 12));
        if (f >= sp[3]) continue;
        const im = img(ts.dir + sp[0]);
        if (!im.ok) continue;
        // The sheet's surface line is 8 art pixels up from its foot: put it at the square's middle.
        const k = size / ts.cell, w = sp[1] * k, h = sp[2] * k;
        ctx.drawImage(im.el, f * sp[1], 0, sp[1], sp[2], Math.round(ox + (x + 0.5) * size - w / 2), Math.round(oy + (y + 0.5) * size + 8 * k - h), w, h);
      }
    }

    function draw(now) {
      const sc = scene();
      if (!sc) return;
      const ctx = canvas.getContext('2d');
      const dt = Math.min(0.1, view.last ? (now - view.last) / 1000 : 0.016);
      view.last = now;
      view.tick = Math.floor(now / 90);
      advance(sc, dt);
      const org = view.org;
      const size = T * S;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#080b0d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const x0 = Math.floor(org.x), y0 = Math.floor(org.y);
      const ox = Math.round(-org.x * size), oy = Math.round(-org.y * size);
      placeTs = sc.tileset || null;
      const env = { S, ox, oy, tick: view.tick, img, imgAt: img, animGround: HAS_IMG, prop, hasProp: (k) => !!propDef(k), twinkle, flat: !!sc.tileset, tileProp: (k) => !!(placeTs && (Tilemap.tileset(placeTs) || { props: {} }).props[k]) };
      const plan = Tilemap.plan(sc, x0 - 1, y0 - 1, x0 + cols, y0 + rows);
      const ts = sc.tileset ? Tilemap.tileset(sc.tileset) : null;
      if (ts) {
        // The chunks' key decides when moving terrain is looked up again, so it is settled before either is drawn.
        if (HAS_IMG) { const key = (sc.tileset || '') + '|' + (sc.tileKey != null ? sc.tileKey : '') + '|' + size; if (view.chunks.key !== key) { view.chunks.key = key; view.chunks.map.clear(); } animGround(ctx, sc, ts, x0, y0, ox, oy, size, now || 0); }
        // Layer 1 from the tileset: ground, the corner tiles of each wang terrain, bridges; then what hasn't been seen
        // is put back in the dark (the corner tiles spill half a square past what is known).
        if (HAS_IMG) groundChunks(ctx, sc, ts, env, x0, y0, ox, oy, size);
        else {
          const tp = Tilemap.planTiles(sc, ts, x0 - 1, y0 - 1, x0 + cols, y0 + rows);
          for (const k of ['base', 'corner', 'decor', 'over']) for (const c of tp[k]) Tilemap.paintTiles(ctx, c, ts, env, k);
          if (ts.raw.tallFaces !== false) liftFaces(ctx, sc, x0, y0, ox, oy, size);
        }
        plan.shown = {};
        for (let y = y0 - 1; y <= y0 + rows; y++) for (let x = x0 - 1; x <= x0 + cols; x++) {
          if (!sc.seen || sc.seen(x, y)) { plan.shown[x + ',' + y] = 1; continue; }
          ctx.fillStyle = '#080b0d'; ctx.fillRect(ox + x * size, oy + y * size, size, size);
        }
        if (HAS_IMG) animSpurts(ctx, sc, ts, x0, y0, ox, oy, size, now || 0, plan.shown);
        plan.decor = plan.decor.filter((c) => c.t !== 'banner');
      } else {
        // Layer 1: ground, with its edge shading.
        for (const c of plan.ground) Tilemap.paint(ctx, c, env);
      }
      // Move and aim marks lie on the ground, under everything standing: tints, paths and aim lines, target brackets.
      drawMarks(ctx, sc, ox, oy);
      drawLines(ctx, sc, ox, oy);
      drawReticles(ctx, sc, ox, oy, view.tick);
      // Layers 2 and 3: the walls, lower pieces then the upper face and caps (a tileset's walls are already down).
      if (!ts) {
        for (const c of plan.low) Tilemap.paint(ctx, c, env);
        for (const c of plan.high) Tilemap.paint(ctx, c, env);
      }
      // Layer 4: doorways and doors, banners, things on the floor, sleep markers.
      for (const c of plan.decor) Tilemap.paint(ctx, c, env);
      for (const a of sc.actors || []) if (a.sleep && view.vis[a.id]) drawSleep(ctx, view.vis[a.id], ox, oy, S, view.tick);
      // Layer 5: furniture and figures, back to front by their feet.
      const list = [];
      for (const c of plan.ground) {
        const cc = sc.cell(c.x, c.y);
        if (['chest', 'shrine', 'prop'].includes(cc.kind)) list.push({ y: c.y + 0.99, prop: { c: cc, x: c.x, y: c.y } });
      }
      for (const a of sc.actors || []) { const v = view.vis[a.id]; list.push({ y: v.y + 1, fig: { a, v } }); }
      list.sort((p, q) => p.y - q.y);
      for (const it of list) {
        if (it.prop) { const i = it.prop; drawObject(ctx, i.c, ox + i.x * size, oy + i.y * size, S, i.x, i.y); continue; }
        const [dx, dy] = offsetOf(it.fig.a.id, clock());
        drawActor(ctx, it.fig.a, dx || dy ? { x: it.fig.v.x + dx, y: it.fig.v.y + dy, run: it.fig.v.run, travel: it.fig.v.travel, flip: it.fig.v.flip, dir: it.fig.v.dir } : it.fig.v, ox, oy, S, view.tick);
      }
      // Fog: unlit squares fade; what has been seen but is out of the light is dim.
      if (sc.light) {
        const L = sc.light;
        for (let y = y0; y <= y0 + rows; y++) for (let x = x0; x <= x0 + cols; x++) {
          if (x < 0 || y < 0 || x >= sc.w || y >= sc.h) continue;
          if (!plan.shown[x + ',' + y]) continue;
          const d = Math.hypot(x - L.x, y - L.y);
          const a = Math.max(0.0, Math.min(0.72, (d - L.r * 0.45) / (L.r * 1.1)));
          if (a > 0.02) { ctx.fillStyle = `rgba(4,8,14,${a.toFixed(2)})`; ctx.fillRect(ox + x * size, oy + y * size, size, size); }
        }
      }
      // Icons over heads, bolts in flight and rising numbers sit above everything on the map.
      drawOver(ctx, sc, ox, oy, clock());
      // Hover outline.
      if (view.hover && sc.hoverable !== false) {
        const X = ox + view.hover.x * size, Y = oy + view.hover.y * size;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, S * 0.5);
        ctx.strokeRect(X + 0.5, Y + 0.5, size - 1, size - 1);
      }
      // Until what this view has asked for has loaded (or failed), it stays dark: no flat-colour tiles, no stand-in
      // figures flashing up before the art (at most 3 s).
      if (!view.ready) {
        view.firstDraw = view.firstDraw || now || 1;
        const waiting = Object.values(imgs).some((o) => o.el && !o.ok && !o.failed) || (sc.actors || []).some((a) => Sprites.pending(a));
        if (waiting && (now || 0) - view.firstDraw < 3000) { ctx.fillStyle = '#080b0d'; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
        view.ready = true;
      }
      // Vignette.
      const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.45, canvas.width / 2, canvas.height / 2, canvas.width * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawActor(ctx, a, v, ox, oy, S, tick) {
      const size = T * S;
      const x = ox + (v.x + 0.5) * size, y = oy + (v.y + 1) * size - S * 1.5;
      const idleFrame = Math.floor(tick / 2) + (a.phase || 0);
      const moving = v.run || (a.art && Sprites.floats(a.art));
      const anim = moving ? 'run' : 'idle';
      const frame = v.run ? tick : moving ? tick + (a.phase || 0) : idleFrame;
      if (a.ring) {
        ctx.strokeStyle = a.ring; ctx.lineWidth = Math.max(2, S * 0.8);
        ctx.beginPath(); ctx.ellipse(x, y - S * 1.2, 7 * S, 3 * S, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // Figures are drawn a notch smaller than the tiles so they stand a tile and a half tall, not two.
      const SS = Math.max(1, S - 1);
      // Creature art (data/art.yaml) where it is there: its attack frames while a lunge is under way.
      const lunge = view.fx.find((f) => f.k === 'lunge' && f.id === a.id && clock() >= f.t0 && clock() < f.t0 + f.dur + 140);
      const lunging = !!lunge, progress = lunge ? (clock() - lunge.t0) / (lunge.dur + 140) : null;  // how far through the blow
      // A fallen figure lies on its side, unless its art has a death picture.
      const dead = a.down && a.art && Sprites.hasClip(a.art, 'death');
      const rot = a.down && !dead ? (v.flip ? -1.45 : 1.45) : 0;
      if (a.art) { Sprites.warm(a.art); if (a.bar != null) Sprites.warm(a.art, true); }
      const art = a.art && Sprites.drawArt(ctx, a.art, dead ? 'death' : lunging ? lunge.clip : anim, frame, x, y, size, { flip: v.flip, dir: v.dir, tint: a.artTint, alpha: a.alpha, artScale: a.artScale, rot, progress, travel: v.run ? v.travel : null, shadow: !a.down, hold: view.vis[a.id] });
      if (art) a = Object.assign({}, a, { size: a.artSize || a.size });
      // Art still loading (all of it, or the picture for this direction or frame): nothing for a moment, never the
      // stand-in.
      if (!art && a.art && (Sprites.pending(a) || Sprites.ownArt(a))) return;
      const ok = art || Sprites.draw(ctx, a.kind, anim, frame, x, y, SS, { flip: v.flip, tint: a.tint, alpha: a.alpha, size: a.size || 1, rot, shadow: !a.down });
      // A hit: the same figure again, washed red and added on top (it glows), fading.
      const now = clock(), hit = view.fx.find((f) => f.k === 'hurt' && f.id === a.id && now >= f.t0 && now < f.t0 + f.dur);
      if (hit && ok) {
        const fade = (1 - (now - hit.t0) / hit.dur) * 0.85 * (a.alpha == null ? 1 : a.alpha);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        if (art) Sprites.drawArt(ctx, a.art, lunging ? lunge.clip : anim, frame, x, y, size, { flip: v.flip, dir: v.dir, tint: '#ff2a1a', alpha: fade, artScale: a.artScale, rot, progress });
        else Sprites.draw(ctx, a.kind, anim, frame, x, y, SS, { flip: v.flip, tint: '#ff2a1a', alpha: fade, size: a.size || 1, rot });
        ctx.restore();
      }
      if (!ok) { ctx.fillStyle = a.tag === 'enemy' ? '#c0504a' : '#5aa0d0'; ctx.fillRect(x - 5 * S, y - 20 * S, 10 * S, 20 * S); }
      if (a.bar && !a.down && !UI.cleanMap) {
        const w = 16 * S * (a.size ? Math.max(0.75, Math.min(1.2, a.size)) : 1), bx = x - w / 2, by = y - 31 * SS * (a.size || 1) - 2 * S;
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx - S * 0.5, by - S * 0.5, w + S, S * 2.6);
        ctx.fillStyle = a.tag === 'enemy' ? '#d2584c' : '#66c27c';
        ctx.fillRect(bx, by, w * Math.max(0, Math.min(1, a.bar)), S * 1.6);
      }
      if (a.label) {
        ctx.fillStyle = '#fff'; ctx.font = `${S * 4.5}px "Pixelify Sans", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = S;
        ctx.strokeText(a.label, x, y + 5 * S); ctx.fillText(a.label, x, y + 5 * S);
      }
    }

    view.draw = draw;
    view.start = () => {
      if (!HAS_IMG || typeof requestAnimationFrame === 'undefined') { draw(0); return; }
      const loop = (now) => {
        if (view.stop) return;
        if (!canvas.isConnected) { if (view._seen) { view.stop = true; return; } } else view._seen = true;
        try { draw(now); } catch (e) { console.error(e); view.stop = true; return; }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    };
    view.destroy = () => { view.stop = true; };
    return view;
  }

  // Warm the images so the first frame is not bare.
  function preload() { for (const n of ['tiles', 'furniture', 'props', 'objects', 'esoteric', 'chest', 'gold', 'stairs_down', 'spikes']) img(n); for (const s2 of ['Fire', 'Water', 'Green', 'Purple']) fxImg(s2); Sprites.preload(); }

  // The scale a place's map is drawn at: its tileset's cell over the 16-px grid (64-px tiles: 4), else `fallback`.
  function scaleFor(placeId, fallback) {
    const p = placeId && G.Content.world.places[placeId];
    const ts = p && p.look && p.look.tileset ? Tilemap.tileset(p.look.tileset) : null;
    return ts ? Math.max(1, Math.round(ts.cell / T)) : fallback || 3;
  }

  UI.MapView = { T, create, preload, PROPS, img, prop, propDef, scaleFor };
})(globalThis.BBB);
