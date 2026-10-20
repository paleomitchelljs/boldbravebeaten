/*
 * Tilemap: turns the dungeon grid into drawing commands for five layers, back to front:
 *   1 ground        floor tiles and the shading where floor meets wall or void (47-case bitmask auto-tiling)
 *   2 walls, low    wall base and lower face, one tile each
 *   3 walls, high   upper face and the cap with its cyan edge
 *   4 decor, doors  doorways and doors, banners, floor markings, sleep markers
 *   5 entities      figures and furniture, sorted by their feet (drawn by MapView)
 *
 * A wall seen from the south is a stack going up from its front square (a wall square with open floor to its south):
 *   one tile   thin: upper face, with a base trim
 *   two        upper face / base
 *   three      cap / face / base
 *   four+      cap / upper face / face / base
 * with the stack ending in the wall's own end pieces where the run stops (a doorway's jambs are these ends).
 * The planner is pure (no canvas), so it can be tested in Node; paint() does the drawing.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const T = 16;

  // ---- Bitmask auto-tiling ------------------------------------------------------------------------------------
  // Bits for the eight neighbours of a square, set when that neighbour is wall or void.
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

  function maskAt(cell, x, y) {
    let m = 0;
    if (solid(cell(x, y - 1))) m |= N;
    if (solid(cell(x + 1, y - 1))) m |= NE;
    if (solid(cell(x + 1, y))) m |= E;
    if (solid(cell(x + 1, y + 1))) m |= SE;
    if (solid(cell(x, y + 1))) m |= S;
    if (solid(cell(x - 1, y + 1))) m |= SW;
    if (solid(cell(x - 1, y))) m |= W;
    if (solid(cell(x - 1, y - 1))) m |= NW;
    return m;
  }

  const hash = (x, y, k) => { let n = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0); };

  // Wall pieces, bottom to top, for a stack of n visible tiles.
  const STACKS = { 1: ['thin'], 2: ['base', 'faceTop'], 3: ['base', 'face', 'cap'], 4: ['base', 'face', 'faceTop', 'cap'] };
  const LAYER = { thin: 2, base: 2, face: 2, faceTop: 3, cap: 3 };

  // The five layers' commands for the squares x0..x1, y0..y1 (inclusive). `cell(x, y)` reads the grid; `seen(x, y)` is
  // null when everything is shown. Commands are { t, x, y, ... } in grid squares.
  function plan(sc, x0, y0, x1, y1) {
    const cache = {};
    const cell = (x, y) => { const k = x + ',' + y; return cache[k] || (cache[k] = sc.cell(x, y)); };
    const known = (x, y) => (sc.seen ? sc.seen(x, y) : true);
    const out = { ground: [], low: [], high: [], decor: [], shown: {} };
    const front = (x, y) => solid(cell(x, y)) && cell(x, y).kind !== 'rock' && !solid(cell(x, y + 1)) && y + 1 < sc.h;
    const inStack = {};

    // Walls with open floor to the south: the stacks.
    for (let y = y0; y <= Math.min(sc.h - 1, y1 + 3); y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || x >= sc.w || y < 0 || !front(x, y) || !known(x, y)) continue;
        let n = 1;
        while (n < 6 && y - n >= 0 && solid(cell(x, y - n))) n++;
        const vis = Math.min(n, 4);
        const ends = (front(x - 1, y) ? 0 : 1) | (front(x + 1, y) ? 0 : 2);
        const kinds = STACKS[vis];
        for (let i = 0; i < kinds.length; i++) {
          const py = y - i;
          if (py < y0 - 1) continue;
          (LAYER[kinds[i]] === 2 ? out.low : out.high).push({ t: 'wall', piece: kinds[i], ends, x, y: py });
          inStack[x + ',' + py] = 1;
          out.shown[x + ',' + py] = 1;
        }
        // A banner now and then on a long plain stretch of wall.
        if (vis >= 3 && ends === 0 && hash(x, y, 5) % 7 === 0 && !doorLike(cell(x - 1, y + 1)) && !doorLike(cell(x + 1, y + 1))) out.decor.push({ t: 'banner', x, y, color: hash(x, y, 9) % 2 });
      }
    }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= sc.w || y >= sc.h || !known(x, y)) continue;
        const c = cell(x, y);
        if (solid(c)) {
          if (inStack[x + ',' + y] || c.kind === 'rock') continue;
          // The top of a wall seen from the room to its north, or the side of a wall seen along a corridor.
          if (!solid(cell(x, y - 1))) { out.high.push({ t: 'roof', x, y }); out.shown[x + ',' + y] = 1; }
          else if (!solid(cell(x - 1, y)) || !solid(cell(x + 1, y))) { out.low.push({ t: 'side', x, y, west: !solid(cell(x - 1, y)), east: !solid(cell(x + 1, y)) }); out.shown[x + ',' + y] = 1; }
          continue;
        }
        out.shown[x + ',' + y] = 1;
        out.ground.push({ t: 'floor', x, y, mask: canon(maskAt(cell, x, y)), v: hash(x, y) });
        if (doorLike(c)) {
          const horizontal = solid(cell(x - 1, y)) && solid(cell(x + 1, y));
          out.decor.push({ t: 'door', x, y, open: c.kind === 'floor', locked: c.kind === 'locked' || (c.def && c.def.kind === 'locked'), horizontal });
        } else decal(out, c, x, y);
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

  // ---- Atlas of wall pieces, built once from Dungeon_Tiles.png -----------------------------------------------------------
  // Row 14 is the cap, 15 the upper face (cyan ledge), 16 the face, 17 the base. The sheet's tiles carry coloured banner
  // trim down one or both edges; the plain interior piece repeats the middle of the tile (columns 4-11) to leave the trim out,
  // and the run ends are that piece with a stone pilaster.
  const ROWS = { cap: 14, faceTop: 15, face: 16, base: 17 };
  let atlas = null;
  const shadeCache = {};

  function buildAtlas(tilesImg) {
    const cv = document.createElement('canvas');
    cv.width = 4 * T; cv.height = 6 * T;
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    const slot = (row) => ({ cap: 0, faceTop: 1, face: 2, base: 3, thin: 4, side: 5 }[row]);
    for (const name of ['cap', 'faceTop', 'face', 'base']) {
      const r = ROWS[name], y = slot(name) * T;
      // The interior piece repeats the sheet tile's plain middle (columns 4-11) twice, so it joins itself with no trim at the seams.
      x.drawImage(tilesImg, 1 * T + 4, r * T, 8, T, 0, y, 8, T);
      x.drawImage(tilesImg, 1 * T + 4, r * T, 8, T, 8, y, 8, T);
      for (let v = 1; v < 4; v++) x.drawImage(cv, 0, y, T, T, v * T, y, T, T);
      for (let v = 1; v < 4; v++) pilaster(x, v, y, v & 1, v & 2);
    }
    // thin: upper face with the base's foot
    for (let v = 0; v < 4; v++) {
      const y = slot('thin') * T;
      x.drawImage(cv, v * T, slot('faceTop') * T, T, T, v * T, y, T, T);
      x.drawImage(cv, v * T, slot('base') * T + 11, T, 5, v * T, y + 11, T, 5);
    }
    // side: the face in shadow
    for (let v = 0; v < 4; v++) {
      const y = slot('side') * T;
      x.drawImage(cv, 0, slot('face') * T, T, T, v * T, y, T, T);
      x.fillStyle = 'rgba(4,8,12,0.45)'; x.fillRect(v * T, y, T, T);
    }
    return cv;
  }

  function pilaster(x, v, y, left, right) {
    const vx = v * T;
    x.fillStyle = '#0a0e11';
    if (left) x.fillRect(vx, y, 1, T);
    if (right) x.fillRect(vx + 15, y, 1, T);
    x.fillStyle = '#5d6f86';
    if (left) x.fillRect(vx + 1, y, 2, T);
    if (right) x.fillRect(vx + 13, y, 2, T);
    x.fillStyle = '#8aa0b8';
    if (left) x.fillRect(vx + 1, y, 1, T);
    if (right) x.fillRect(vx + 14, y, 1, T);
  }

  // The shading laid over a floor square for one of the 47 neighbour patterns.
  function shade(mask) {
    if (shadeCache[mask]) return shadeCache[mask];
    const cv = document.createElement('canvas');
    cv.width = T; cv.height = T;
    const x = cv.getContext('2d');
    const dark = (a, px, py, w, h) => { x.fillStyle = `rgba(4,8,13,${a})`; x.fillRect(px, py, w, h); };
    if (mask & N) { dark(0.6, 0, 0, T, 2); dark(0.34, 0, 2, T, 2); dark(0.14, 0, 4, T, 2); }
    if (mask & W) { dark(0.5, 0, 0, 2, T); dark(0.26, 2, 0, 2, T); dark(0.1, 4, 0, 2, T); }
    if (mask & E) { dark(0.5, 14, 0, 2, T); dark(0.26, 12, 0, 2, T); dark(0.1, 10, 0, 2, T); }
    if (mask & S) { dark(0.4, 0, 14, T, 2); dark(0.18, 0, 12, T, 2); }
    // Inner corners: only where the two sides are open.
    if (mask & NW) { dark(0.55, 0, 0, 3, 3); dark(0.25, 3, 0, 2, 2); dark(0.25, 0, 3, 2, 2); }
    if (mask & NE) { dark(0.55, 13, 0, 3, 3); dark(0.25, 11, 0, 2, 2); dark(0.25, 14, 3, 2, 2); }
    if (mask & SW) { dark(0.45, 0, 13, 3, 3); }
    if (mask & SE) { dark(0.45, 13, 13, 3, 3); }
    return (shadeCache[mask] = cv);
  }

  // ---- Painting ---------------------------------------------------------------------------------------------------------------
  // env: { S: pixels per art pixel, ox, oy: pixel offset of grid (0,0), img(name) -> {ok, el}, prop(ctx, key, cx, feet, S, opts), tick }
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
        if (cmd.mask && tiles.ok) ctx.drawImage(shade(cmd.mask), 0, 0, T, T, X, Y, size, size);
        break;
      }
      case 'wall': {
        if (!tiles.ok) { ctx.fillStyle = '#44566a'; ctx.fillRect(X, Y, size, size); break; }
        atlas = atlas || buildAtlas(tiles.el);
        const row = { cap: 0, faceTop: 1, face: 2, base: 3, thin: 4 }[cmd.piece];
        ctx.drawImage(atlas, cmd.ends * T, row * T, T, T, X, Y, size, size);
        break;
      }
      case 'side': {
        if (!tiles.ok) break;
        atlas = atlas || buildAtlas(tiles.el);
        ctx.drawImage(atlas, 0, 5 * T, T, T, X, Y, size, size);
        ctx.fillStyle = '#7f95ad';
        if (cmd.east) ctx.fillRect(X + size - S * 1.5, Y, S * 1.5, size);
        if (cmd.west) ctx.fillRect(X, Y, S * 1.5, size);
        break;
      }
      case 'roof': {
        if (tiles.ok) ctx.drawImage(tiles.el, 1 * T, 0, T, T, X, Y, size, size);
        break;
      }
      case 'door': {
        const cx = X + size / 2, feet = Y + size;
        // The opening: darker floor and a threshold, then the door standing in its frame.
        ctx.fillStyle = 'rgba(6,10,14,0.3)';
        ctx.fillRect(X, Y, size, size);
        ctx.fillStyle = 'rgba(138,160,184,0.55)';
        ctx.fillRect(X, feet - S, size, S);
        if (cmd.open) env.prop(ctx, cmd.locked ? 'iron' : 'door', X + S * 1.5, feet - S * 1.5, S, { scale: 0.8, squash: 0.28, anchor: 'left' });
        else env.prop(ctx, cmd.locked ? 'iron' : 'door', cx, feet - S * 1.5, S, { scale: 0.8 });
        break;
      }
      case 'banner': {
        env.prop(ctx, cmd.color ? 'banner_blue' : 'banner_red', X + size / 2, Y - size * 0.35, S, { scale: 1 });
        break;
      }
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

  UI.Tilemap = { plan, paint, canon, maskAt, solid, doorLike, bits: { N, NE, E, SE, S, SW, W, NW } };
})(globalThis.BBB);
