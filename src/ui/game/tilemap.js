/*
 * Tilemap: turns the dungeon grid into drawing commands for five layers, back to front:
 *   1 ground        floor tiles, with an ambient-occlusion baseboard under every wall face (47-case bitmask)
 *   2 wall faces    the brick surface facing the camera, one tile tall
 *   3 wall caps     the top surface of the walls, auto-tiled from its neighbours
 *   4 decor, doors  doors, banners, floor markings, sleep markers
 *   5 entities      figures and furniture, sorted by their feet (drawn by MapView)
 *
 * Wall anatomy, in the 3/4 view: a wall square with open floor to its south shows its FACE in its own square, and its
 * CAP one row up. A thick wall's cap is simply the wall square above the face; a wall one square thick with floor on
 * both sides has its cap drawn over the floor row to its north, as the real projection would (figures there are drawn on
 * top of it). Every other wall square is cap.
 *   Caps: a light edge along the top only where the square to the north is open; dark side shadows where the square to
 *   the east or west is not cap; nothing along the bottom (a cap always sits on a cap or a face). Caps that touch merge,
 *   so corners and T-junctions run on without inner borders.
 *   Faces: plain brick, no highlight anywhere; where a run of face stops (a doorway, a gap, a wall turning south) the end
 *   tile shows finished, shadowed side masonry.
 *   Floor runs on through doorways untouched. The planner is pure (no canvas); paint() draws.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const T = 16;

  // ---- Bitmask auto-tiling ------------------------------------------------------------------------------------
  const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;

  // A corner only matters when neither of its two sides is set: that reduces 256 masks to the 47 distinct tiles.
  function canon(m) {
    let c = m & (N | E | S | W);
    if (!(m & N) && !(m & E) && (m & NE)) c |= NE;
    if (!(m & S) && !(m & E) && (m & SE)) c |= SE;
    if (!(m & S) && !(m & W) && (m & SW)) c |= SW;
    if (!(m & N) && !(m & W) && (m & NW)) c |= NW;
    return c;
  }

  const solid = (c) => !c || c.kind === 'wall' || c.kind === 'rock';
  const doorLike = (c) => !!c && (c.kind === 'door' || c.kind === 'locked' || (c.kind === 'floor' && (c.ch === '+' || (c.def && (c.def.kind === 'secret' || c.def.kind === 'locked')))));

  const hash = (x, y, k) => { let n = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0); };

  // The wall geometry of a grid: which squares show face, which show cap.
  function geometry(sc) {
    const cache = {};
    const inGrid = (x, y) => x >= 0 && y >= 0 && x < sc.w && y < sc.h;
    const cell = (x, y) => { const k = x + ',' + y; return k in cache ? cache[k] : (cache[k] = inGrid(x, y) ? sc.cell(x, y) : null); };
    const solidAt = (x, y) => !inGrid(x, y) || solid(cell(x, y));
    const isFace = (x, y) => inGrid(x, y) && solidAt(x, y) && !solidAt(x, y + 1);
    // The cap of a one-square-thick wall, drawn over the floor square to its north.
    const raised = (x, y) => inGrid(x, y) && !solidAt(x, y) && !doorLike(cell(x, y)) && isFace(x, y + 1);
    const isCap = (x, y) => (solidAt(x, y) && solidAt(x, y + 1)) || raised(x, y);
    return { inGrid, cell, solidAt, isFace, raised, isCap };
  }

  // The 8-neighbour mask of a floor square for its shading: bits set where the neighbour is wall or void.
  function maskAt(solidAt, x, y) {
    let m = 0;
    if (solidAt(x, y - 1)) m |= N;
    if (solidAt(x + 1, y - 1)) m |= NE;
    if (solidAt(x + 1, y)) m |= E;
    if (solidAt(x + 1, y + 1)) m |= SE;
    if (solidAt(x, y + 1)) m |= S;
    if (solidAt(x - 1, y + 1)) m |= SW;
    if (solidAt(x - 1, y)) m |= W;
    if (solidAt(x - 1, y - 1)) m |= NW;
    return m;
  }

  // The five layers' commands for the squares x0..x1, y0..y1 (inclusive), in grid squares.
  function plan(sc, x0, y0, x1, y1) {
    const g = geometry(sc);
    const known = (x, y) => g.inGrid(x, y) && (sc.seen ? sc.seen(x, y) : true);
    const out = { ground: [], low: [], high: [], decor: [], shown: {} };
    const cap = (x, y) => {
      const m = (g.isCap(x, y - 1) ? N : 0) | (g.isCap(x + 1, y) ? E : 0) | (g.isCap(x - 1, y) ? W : 0);
      // Only an open square to the north gets the light edge; a face there (two thin walls one row apart) gets a dark seam.
      const edge = m & N ? null : g.isFace(x, y - 1) ? 'dark' : 'light';
      out.high.push({ t: 'cap', x, y, mask: m, edge });
      if (g.inGrid(x, y)) out.shown[x + ',' + y] = 1;
    };
    for (let y = y0 - 1; y <= y1 + 1; y++) {
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        if (!g.solidAt(x, y)) {
          const c = g.cell(x, y);
          if (known(x, y)) {
            out.shown[x + ',' + y] = 1;
            const door = doorLike(c);
            let m = canon(maskAt(g.solidAt, x, y)) & ~(S | SE | SW);
            if (door) m &= N; // the floor runs straight through a doorway
            out.ground.push({ t: 'floor', x, y, mask: m, v: hash(x, y), color: c.ground ? c.ground.color : null });
            if (door) {
              const horizontal = g.solidAt(x - 1, y) && g.solidAt(x + 1, y);
              out.decor.push({ t: 'door', x, y, open: c.kind === 'floor', locked: c.kind === 'locked' || (c.def && c.def.kind === 'locked'), horizontal });
            } else decal(out, c, x, y);
          }
          if (g.raised(x, y) && (known(x, y) || known(x, y + 1))) cap(x, y);
        } else if (g.isFace(x, y)) {
          if (!known(x, y)) continue;
          const ends = (g.isFace(x - 1, y) ? 0 : 1) | (g.isFace(x + 1, y) ? 0 : 2);
          out.low.push({ t: 'face', x, y, ends });
          out.shown[x + ',' + y] = 1;
          // A banner now and then on a plain stretch of wall.
          if (!ends && hash(x, y, 5) % 7 === 0 && !doorLike(g.cell(x - 1, y)) && !doorLike(g.cell(x + 1, y))) out.decor.push({ t: 'banner', x, y, color: hash(x, y, 9) % 2 });
        } else if (known(x, y) || (g.isFace(x, y + 1) && known(x, y + 1)) || (!g.inGrid(x, y) && g.isCap(x, y + 1) && known(x, y + 1))) {
          // (a cap off the edge of the map continues the cap of the edge square below it)
          cap(x, y);
        }
      }
    }
    return out;
  }

  // Things lying flat on the floor.
  function decal(out, c, x, y) {
    const st = c.st || {};
    switch (c.kind) {
      case 'stairs': out.decor.push({ t: 'stairs', x, y, sprite: c.def.sprite || null, up: c.def.up != null ? !!c.def.up : c.def.at === '>' || ((G.Content.world.places[c.def.to] || {}).kind === 'town') }); break;
      case 'drop': out.decor.push({ t: 'drop', x, y, sprite: c.def.sprite || null }); break;
      case 'trap': if (st.found || st.sprung || st.disarmed) out.decor.push({ t: 'trap', x, y, state: st.disarmed ? 'off' : st.sprung ? 'sprung' : 'armed' }); break;
      case 'pickup': if (!st.done) out.decor.push({ t: 'twinkle', x, y }); break;
      case 'note': if (!st.done) out.decor.push({ t: 'note', x, y }); break;
      default: break;
    }
  }

  // ---- Tiles, built once ---------------------------------------------------------------------------------------------------
  const COL = {
    cap: '#1d262d', capFleck: '#232e36', capPit: '#182027',
    lightTop: '#b4cde0', lightMid: '#7193b0', underLight: '#2c3b48',
    sideDark: '#080b0e', sideMid: '#10161b', seam: '#0a0e12',
  };
  const capCache = {}, shadeCache = {};
  let faces = null;

  const canvas16 = () => { const cv = document.createElement('canvas'); cv.width = T; cv.height = T; return cv; };

  // A cap tile for a mask (N/E/W: is the neighbour cap) and its top edge ('light', 'dark' or none).
  function capTile(mask, edge) {
    const key = mask + edge;
    if (capCache[key]) return capCache[key];
    const cv = canvas16();
    const x = cv.getContext('2d');
    const px = (c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
    px(COL.cap, 0, 0, T, T);
    for (let yy = 0; yy < T; yy++) for (let xx = 0; xx < T; xx++) {
      const hsh = hash(xx, yy, 3) % 23;
      if (hsh === 0) px(COL.capFleck, xx, yy, 1, 1); else if (hsh === 1) px(COL.capPit, xx, yy, 1, 1);
    }
    const top = edge === 'light' ? 3 : edge === 'dark' ? 1 : 0;
    // Dark side shadows where the cap stops to the west or east; they start below the top edge, never wrapping it.
    if (!(mask & W)) { px(COL.sideDark, 0, top, 1, T - top); px(COL.sideMid, 1, top, 1, T - top); }
    if (!(mask & E)) { px(COL.sideDark, 15, top, 1, T - top); px(COL.sideMid, 14, top, 1, T - top); }
    if (edge === 'light') {
      px(COL.lightTop, 0, 0, T, 1); px(COL.lightMid, 0, 1, T, 1); px(COL.underLight, 0, 2, T, 1);
      // Round the outer corners of the edge where the cap also stops at the side.
      if (!(mask & W)) { px(COL.lightMid, 0, 0, 1, 1); px(COL.sideMid, 0, 1, 1, 2); }
      if (!(mask & E)) { px(COL.lightMid, 15, 0, 1, 1); px(COL.sideMid, 15, 1, 1, 2); }
    } else if (edge === 'dark') px(COL.seam, 0, 0, T, 1);
    return (capCache[key] = cv);
  }

  // Face tiles from Dungeon_Tiles.png row 16 (plain brick, its light bottom row darkened). The sheet's tiles carry coloured trim down their edges, so the
  // plain piece repeats the tile's middle columns 4-11; the end pieces add shadowed side masonry, with no light at all.
  function buildFaces(tilesImg) {
    const cv = document.createElement('canvas');
    cv.width = 4 * T; cv.height = T;
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(tilesImg, T + 4, 16 * T, 8, T, 0, 0, 8, T);
    x.drawImage(tilesImg, T + 4, 16 * T, 8, T, 8, 0, 8, T);
    // The sheet's bottom row is the light lip of its base trim; where our face meets the floor it must be dark, so lay the
    // tile's own dark mortar course (row 11) over it.
    x.drawImage(cv, 0, 11, T, 1, 0, 15, T, 1);
    for (let v = 1; v < 4; v++) {
      x.drawImage(cv, 0, 0, T, T, v * T, 0, T, T);
      const side = (left) => {
        const a = left ? v * T : v * T + T;
        const at = (i) => (left ? a + i : a - 1 - i);
        x.fillStyle = COL.sideDark; x.fillRect(at(0), 0, 1, T);
        x.fillStyle = 'rgba(4,7,10,0.6)'; x.fillRect(Math.min(at(1), at(2)), 0, 2, T);
        x.fillStyle = 'rgba(4,7,10,0.3)'; x.fillRect(at(3), 0, 1, T);
      };
      if (v & 1) side(true);
      if (v & 2) side(false);
    }
    return cv;
  }

  // The shading laid over a floor square: an ambient-occlusion baseboard under a wall face (N), soft side shadow along a
  // wall (E, W), and a little spill at the corners. Nothing for walls to the south: the floor meets their lit cap edge.
  function shade(mask) {
    if (shadeCache[mask]) return shadeCache[mask];
    const cv = canvas16();
    const x = cv.getContext('2d');
    const dark = (a, px, py, w, h) => { x.fillStyle = `rgba(3,6,10,${a.toFixed(3)})`; x.fillRect(px, py, w, h); };
    if (mask & N) { dark(0.78, 0, 0, T, 1); dark(0.62, 0, 1, T, 1); for (let y = 2; y < 14; y++) dark(0.55 * Math.pow(1 - y / 14, 1.4), 0, y, T, 1); }
    if (mask & W) { dark(0.32, 0, 0, 1, T); dark(0.2, 1, 0, 1, T); dark(0.1, 2, 0, 2, T); }
    if (mask & E) { dark(0.32, 15, 0, 1, T); dark(0.2, 14, 0, 1, T); dark(0.1, 12, 0, 2, T); }
    if (mask & NW) { dark(0.35, 0, 0, 2, 3); dark(0.2, 2, 0, 1, 2); }
    if (mask & NE) { dark(0.35, 14, 0, 2, 3); dark(0.2, 13, 0, 1, 2); }
    return (shadeCache[mask] = cv);
  }

  // ---- Painting ---------------------------------------------------------------------------------------------------------------
  // env: { S: pixels per art pixel, ox, oy: pixel offset of grid (0,0), img(name) -> {ok, el}, prop(...), twinkle(...), tick }
  const FLOORS = [[4, 1], [5, 1], [6, 1], [7, 1], [5, 2], [6, 2], [4, 2], [7, 2]];

  function paint(ctx, cmd, env) {
    const S = env.S, size = T * S;
    const X = env.ox + cmd.x * size, Y = env.oy + cmd.y * size;
    const tiles = env.img('tiles');
    switch (cmd.t) {
      case 'floor': {
        const f = FLOORS[cmd.v % FLOORS.length];
        if (cmd.color) { ctx.fillStyle = cmd.color; ctx.fillRect(X, Y, size, size); }
        else if (tiles.ok) ctx.drawImage(tiles.el, f[0] * T, f[1] * T, T, T, X, Y, size, size);
        else { ctx.fillStyle = '#26363a'; ctx.fillRect(X, Y, size, size); }
        if (cmd.mask) ctx.drawImage(shade(cmd.mask), 0, 0, T, T, X, Y, size, size);
        break;
      }
      case 'face': {
        if (!tiles.ok) { ctx.fillStyle = '#3a4656'; ctx.fillRect(X, Y, size, size); break; }
        faces = faces || buildFaces(tiles.el);
        ctx.drawImage(faces, cmd.ends * T, 0, T, T, X, Y, size, size);
        break;
      }
      case 'cap': ctx.drawImage(capTile(cmd.mask, cmd.edge), 0, 0, T, T, X, Y, size, size); break;
      case 'door': {
        // Seen from above (a tileset's flat walls): the tileset's door, else a slab of planks across the gap, swung to
        // one side when open.
        if (env.flat) {
          const key = cmd.locked ? 'door_locked' : 'door';
          if (env.tileProp && env.tileProp(key)) { env.prop(ctx, key, X + size / 2, Y + size, S); break; }
          const across = cmd.horizontal, th = size * 0.3;
          const r = cmd.open ? (across ? [X, Y + size / 2 - th / 2, th, size * 0.9] : [X + size / 2 - th / 2, Y, size * 0.9, th])
            : (across ? [X, Y + size / 2 - th / 2, size, th] : [X + size / 2 - th / 2, Y, th, size]);
          ctx.fillStyle = '#2a1a0e'; ctx.fillRect(r[0] - S, r[1] - S, r[2] + 2 * S, r[3] + 2 * S);
          ctx.fillStyle = cmd.locked ? '#5a3e24' : '#7a5232'; ctx.fillRect(r[0], r[1], r[2], r[3]);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          const n = 4;
          for (let i = 1; i < n; i++) { if (r[2] > r[3]) ctx.fillRect(r[0] + (r[2] * i) / n, r[1], Math.max(1, S / 2), r[3]); else ctx.fillRect(r[0], r[1] + (r[3] * i) / n, r[2], Math.max(1, S / 2)); }
          if (cmd.locked) { ctx.fillStyle = '#9aa0a6'; if (r[2] > r[3]) { ctx.fillRect(r[0] + r[2] * 0.2, r[1], S, r[3]); ctx.fillRect(r[0] + r[2] * 0.8, r[1], S, r[3]); } else { ctx.fillRect(r[0], r[1] + r[3] * 0.2, r[2], S); ctx.fillRect(r[0], r[1] + r[3] * 0.8, r[2], S); } }
          break;
        }
        const feet = Y + size;
        const key = cmd.locked ? 'iron' : 'door';
        if (cmd.horizontal) {
          if (cmd.open) env.prop(ctx, key, X + S, feet, S, { scale: 0.8, squash: 0.28, anchor: 'left' });
          else env.prop(ctx, key, X + size / 2, feet, S, { scale: 0.8 });
        } else if (!cmd.open) env.prop(ctx, key, X + size / 2, feet, S, { scale: 0.8, squash: 0.32 }); // seen edge-on
        break;
      }
      case 'banner': env.prop(ctx, cmd.color ? 'banner_blue' : 'banner_red', X + size / 2, Y + size - S * 1.5, S, { scale: 0.7 }); break;
      case 'stairs': {
        const cx = X + size / 2;
        // A legend `sprite` (a tileset's steps up the wall) is drawn as it is; the stock stairs flip to point up.
        if (cmd.sprite && env.hasProp(cmd.sprite)) env.prop(ctx, cmd.sprite, cx, Y + size, S);
        else env.prop(ctx, 'stairs', cx, Y + size, S, { flipY: cmd.up });
        ctx.fillStyle = 'rgba(255,230,150,0.9)';
        ctx.font = `${S * 6}px "Pixelify Sans", monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(cmd.up ? '▲' : '▼', cx, Y + size / 2);
        break;
      }
      case 'trap': {
        const f = env.img('spikes');
        if (cmd.state === 'off') { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X + S * 3, Y + S * 3, size - S * 6, size - S * 6); }
        else if (f.ok) ctx.drawImage(f.el, cmd.state === 'armed' ? 96 : 0, 0, 32, 29, X + size / 2 - 16 * S * 0.6, Y + size - 29 * S * 0.6 - S, 32 * S * 0.6, 29 * S * 0.6);
        break;
      }
      case 'drop': {
        // A well or a hole: its prop if the place's tileset has one, else a dark mouth with a lip.
        if (cmd.sprite && env.hasProp(cmd.sprite)) { env.prop(ctx, cmd.sprite, X + size / 2, Y + size, S); break; }
        ctx.fillStyle = 'rgba(120,110,90,0.9)'; ctx.beginPath(); ctx.ellipse(X + size / 2, Y + size / 2, size * 0.4, size * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#05070a'; ctx.beginPath(); ctx.ellipse(X + size / 2, Y + size / 2, size * 0.3, size * 0.21, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'twinkle': env.twinkle(ctx, X + size / 2, Y + size * 0.62, S, env.tick); break;
      case 'note': env.prop(ctx, 'scroll', X + size / 2, Y + size - S * 2, S, { scale: 0.5 }); break;
      default: break;
    }
  }

  // ---- Tilesets (data/tilesets.yaml): flat top-down terrain on the dual grid ---------------------------------------------
  // A place with look.tileset is drawn from it instead of the 3/4 walls above. Every square has a terrain (grass, wall,
  // water…). A wang terrain is a 16-tile corner set of itself (upper) over another (lower): each tile sits on a corner
  // between four squares, half a square up and left of the square below-right of it, and is picked by which of those
  // four are this terrain or one listed after it. Plain terrains are an image per square, or a flat colour until the art
  // exists. Ground with `under` (a bridge) is drawn over the terrain it spans.
  const PIXELLAB16 = ['UULU', 'ULUL', 'LULL', 'UULL', 'LUUL', 'ULLL', 'LLLL', 'LLLU', 'ULUU', 'LLUU', 'LLUL', 'LULU', 'UUUU', 'UUUL', 'ULLU', 'LUUU'];
  const tsCache = {};

  // The tileset with its terrains ranked and each wang sheet's corner masks indexed (NW 8, NE 4, SW 2, SE 1).
  function tileset(id) {
    const raw = ((G.Content && G.Content.world.tilesets) || {})[id];
    if (!raw) return null;
    if (tsCache[id] && tsCache[id].raw === raw) return tsCache[id];
    const names = Object.keys(raw.terrains || {});
    const terrains = {};
    names.forEach((n, i) => {
      const t = Object.assign({ name: n, rank: i }, raw.terrains[n]);
      if (t.wang) {
        const cols = t.cols || 4;
        t.index = {};
        t.variants = {};
        (t.corners || PIXELLAB16).forEach((code, k) => {
          const m = [...code].reduce((a, ch, b) => a | (ch === 'U' ? 8 >> b : 0), 0);
          const at = [k % cols, Math.floor(k / cols)];
          // The first tile for a mask is the plain one; later tiles with the same corners are variants (a mosaic).
          if (!(m in t.index)) t.index[m] = at;
          else (t.variants[m] = t.variants[m] || []).push(at);
        });
      }
      terrains[n] = t;
    });
    const out = { id, raw, cell: raw.cell || 16, dir: raw.dir || 'art/worldtiles/', terrains, floor: raw.floor || names[0], wall: raw.wall || 'wall', props: raw.props || {} };
    return (tsCache[id] = out);
  }

  // The terrain name a square is drawn as, and the ground drawn over it (a bridge), if any.
  function terrainOf(sc, ts, x, y) {
    const c = x >= 0 && y >= 0 && x < sc.w && y < sc.h ? sc.cell(x, y) : null;
    if (!c || c.kind === 'rock' || (c.kind === 'wall' && !(c.ground && ts.terrains[c.ground.tile]))) return { t: ts.wall };
    let gr = c.ground, over = null;
    if (gr && gr.under) { over = gr; gr = (G.Explore && G.Explore.groundOf(gr.under)) || null; }
    if (!gr) return { t: ts.floor, over };
    return { t: ts.terrains[gr.tile] ? gr.tile : 'color:' + (gr.color || '#555'), over };
  }

  function tdef(ts, name) {
    return ts.terrains[name] || (name.startsWith('color:') ? { name, rank: -1, color: name.slice(6) } : { name, rank: -1, color: '#555' });
  }

  // Commands for squares x0..x1, y0..y1: `base` per square, `corner` per dual-grid corner and wang terrain, `over` for
  // bridges. Pure, like plan().
  function planTiles(sc, ts, x0, y0, x1, y1) {
    const at = {};
    const T_ = (x, y) => { const k = x + ',' + y; return at[k] || (at[k] = terrainOf(sc, ts, x, y)); };
    const out = { base: [], corner: [], over: [] };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let t = tdef(ts, T_(x, y).t);
      // A wang terrain's square is covered by its corners; under them lies what it is drawn over.
      while (t.wang && t.over && ts.terrains[t.over]) t = ts.terrains[t.over];
      out.base.push({ x, y, t: t.name });
      const o = T_(x, y).over;
      if (o) {
        // Water to the east or west: the bridge runs north-south.
        const wet = (xx, yy) => { const n = T_(xx, yy); return !n.over && n.t === T_(x, y).t; };
        out.over.push({ x, y, g: o, vertical: wet(x - 1, y) || wet(x + 1, y) });
      }
    }
    for (const w of Object.values(ts.terrains)) {
      if (!w.wang) continue;
      for (let y = y0; y <= y1 + 1; y++) for (let x = x0; x <= x1 + 1; x++) {
        const up = (xx, yy) => tdef(ts, T_(xx, yy).t).rank >= w.rank;
        const m = (up(x - 1, y - 1) ? 8 : 0) | (up(x, y - 1) ? 4 : 0) | (up(x - 1, y) ? 2 : 0) | (up(x, y) ? 1 : 0);
        if (m) out.corner.push({ x, y, t: w.name, m });
      }
    }
    return out;
  }

  // env: as paint(), plus imgAt(path) -> {ok, el}.
  function paintTiles(ctx, p, ts, env, kind) {
    const S = env.S, size = T * S, cell = ts.cell;
    if (kind === 'base') {
      const t = tdef(ts, p.t), X = env.ox + p.x * size, Y = env.oy + p.y * size;
      const im = t.tile ? env.imgAt(ts.dir + (Array.isArray(t.tile) ? t.tile[hash(p.x, p.y) % t.tile.length] : t.tile)) : null;
      if (im && im.ok) { ctx.drawImage(im.el, 0, 0, cell, cell, X, Y, size, size); return; }
      // Plain ground under a wang set: its all-lower tile.
      const w = Object.values(ts.terrains).find((q) => q.wang && q.over === p.t && q.index[0]);
      const wi = w ? env.imgAt(ts.dir + w.wang) : null;
      if (wi && wi.ok) { const [cx, cy] = w.index[0]; ctx.drawImage(wi.el, cx * cell, cy * cell, cell, cell, X, Y, size, size); return; }
      // No art: the colour, laid over the floor at the terrain's alpha (a patch of rubble in the grass).
      if (t.alpha != null && t.alpha < 1 && p.t !== ts.floor) paintTiles(ctx, { x: p.x, y: p.y, t: ts.floor }, ts, env, 'base');
      ctx.save(); ctx.globalAlpha = t.alpha == null ? 1 : t.alpha;
      ctx.fillStyle = t.color || '#555'; ctx.fillRect(X, Y, size, size);
      ctx.restore();
    } else if (kind === 'corner') {
      const t = ts.terrains[p.t], X = env.ox + (p.x - 0.5) * size, Y = env.oy + (p.y - 0.5) * size;
      const im = env.imgAt(ts.dir + t.wang), vs = t.variants[p.m];
      // A variant at a share `vary` (default 0.25) of the corners that have one, picked by position.
      const at = vs && hash(p.x, p.y, 11) % 100 < (t.vary == null ? 0.25 : t.vary) * 100 ? vs[hash(p.x, p.y, 12) % vs.length] : t.index[p.m];
      if (im.ok && at) { ctx.drawImage(im.el, at[0] * cell, at[1] * cell, cell, cell, X, Y, size, size); return; }
      // No art yet: the upper quarters in the terrain's colour.
      ctx.fillStyle = t.color || '#888';
      const hs = size / 2;
      if (p.m & 8) ctx.fillRect(X, Y, hs, hs);
      if (p.m & 4) ctx.fillRect(X + hs, Y, hs, hs);
      if (p.m & 2) ctx.fillRect(X, Y + hs, hs, hs);
      if (p.m & 1) ctx.fillRect(X + hs, Y + hs, hs, hs);
    } else if (kind === 'over') {
      const X = env.ox + p.x * size, Y = env.oy + p.y * size;
      const t = ts.terrains[p.g.tile];
      const im = t && t.tile ? env.imgAt(ts.dir + t.tile) : null;
      ctx.save();
      if (p.vertical) { ctx.translate(X + size / 2, Y + size / 2); ctx.rotate(Math.PI / 2); ctx.translate(-(X + size / 2), -(Y + size / 2)); }
      if (im && im.ok) ctx.drawImage(im.el, 0, 0, cell, cell, X, Y, size, size);
      else {
        // Planks across the square, running the way the bridge goes.
        ctx.fillStyle = p.g.color || '#7a5a36'; ctx.fillRect(X, Y + size * 0.15, size, size * 0.7);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let i = 1; i < 4; i++) ctx.fillRect(X + (size * i) / 4, Y + size * 0.15, Math.max(1, S / 2), size * 0.7);
      }
      ctx.restore();
    }
  }

  UI.Tilemap = { plan, paint, canon, geometry, solid, doorLike, tileset, planTiles, paintTiles, PIXELLAB16, bits: { N, NE, E, SE, S, SW, W, NW } };
})(globalThis.BBB);
