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
            out.ground.push({ t: 'floor', x, y, mask: m, v: hash(x, y) });
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
      case 'stairs': out.decor.push({ t: 'stairs', x, y, up: c.def.at === '>' || ((G.Content.world.places[c.def.to] || {}).kind === 'town') }); break;
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
        if (tiles.ok) ctx.drawImage(tiles.el, f[0] * T, f[1] * T, T, T, X, Y, size, size);
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
        env.prop(ctx, 'stairs', cx, Y + size, S, { flipY: cmd.up });
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
      case 'twinkle': env.twinkle(ctx, X + size / 2, Y + size * 0.62, S, env.tick); break;
      case 'note': env.prop(ctx, 'scroll', X + size / 2, Y + size - S * 2, S, { scale: 0.5 }); break;
      default: break;
    }
  }

  UI.Tilemap = { plan, paint, canon, geometry, solid, doorLike, bits: { N, NE, E, SE, S, SW, W, NW } };
})(globalThis.BBB);
