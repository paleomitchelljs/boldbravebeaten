/*
 * The first-person dungeon view: a grid raycaster in the spirit of the old CRPGs. It draws walls,
 * doors and sprites (monsters, chests, people) from what Explore reports, and a minimap of what has
 * been seen. Pure drawing: no game state changes here.
 */
(function (G) {
  'use strict';
  const UI = G.UI;
  const Explore = G.Explore;

  const FOV = 0.66; // half-width of the camera plane

  function hex(c) {
    const n = parseInt((c || '#666666').slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const css = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;

  function look(world) {
    const p = Explore.place(world);
    const l = (p && p.look) || {};
    return { wall: hex(l.wall || '#6e5f4d'), floor: hex(l.floor || '#3a3228'), ceiling: hex(l.ceiling || '#241e18'), fog: hex(l.fog || '#0e0b09'), torch: l.torch == null ? 0.9 : l.torch };
  }

  // What stands on a square, if anything worth drawing.
  function spriteAt(world, x, y) {
    const c = Explore.cell(world, x, y);
    const d = c.def;
    if (!d) return null;
    const st = c.st || {};
    switch (c.kind) {
      case 'monster': {
        if (st.done) return null;
        const spec = Explore.encounterSpec(world, d);
        const first = spec.foes && spec.foes[0];
        const m = first && first.monster ? G.Enemies.MONSTERS[first.monster] : null;
        const glyph = d.glyph || (m && (m.glyph || (m.group && G.Enemies.MONSTERS[m.group[0]].glyph))) || (first && first.template ? '🗡' : '👹');
        return { glyph, size: 0.9, tint: st.pacified ? 'friendly' : null, dim: !!(d.asleep && !st.woken) };
      }
      case 'chest': return st.opened ? { glyph: '📭', size: 0.45 } : { glyph: '📦', size: 0.55 };
      case 'npc': return { glyph: (G.Content.world.npcs[d.npc] || {}).glyph || '🧍', size: 0.9, tint: 'friendly' };
      case 'stairs': return { glyph: d.to && (G.Content.world.places[d.to] || {}).kind === 'town' ? '⬆' : (d.at === '<' || d.at === '>' ? (d.at === '<' ? '⬇' : '⬆') : '▤'), size: 0.8, tint: 'stairs' };
      case 'trap': return st.found && !st.disarmed && !st.sprung ? { glyph: '⚠', size: 0.35, ground: true } : null;
      case 'pickup': return st.done ? null : { glyph: '✦', size: 0.4, ground: true };
      case 'note': return st.done ? null : { glyph: '📜', size: 0.4, ground: true };
      case 'shrine': return { glyph: '⛩', size: 0.8 };
      default: return null;
    }
  }

  function render(canvas, world) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const ex = world.explore;
    const L = look(world);
    const flicker = 0.94 + 0.06 * Math.sin(Date.now() / 260);
    const reach = G.CONFIG.game.lightRadius;
    const dirX = Explore.DIRS[ex.dir][0], dirY = Explore.DIRS[ex.dir][1];
    const planeX = -dirY * FOV, planeY = dirX * FOV;
    const px = ex.x + 0.5, py = ex.y + 0.5;

    // Ceiling and floor.
    let g = ctx.createLinearGradient(0, 0, 0, h / 2);
    g.addColorStop(0, css(mix(L.ceiling, L.fog, 0.5))); g.addColorStop(1, css(mix(L.ceiling, L.fog, 0.1)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h / 2);
    g = ctx.createLinearGradient(0, h / 2, 0, h);
    g.addColorStop(0, css(mix(L.floor, L.fog, 0.55))); g.addColorStop(1, css(mix(L.floor, [255, 255, 255], 0.06)));
    ctx.fillStyle = g; ctx.fillRect(0, h / 2, w, h / 2);

    const zbuf = new Array(w);
    for (let col = 0; col < w; col++) {
      const camX = 2 * col / w - 1;
      const rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      let mx = ex.x, my = ex.y;
      const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
      let sx, sy, sdx, sdy;
      if (rdx < 0) { sx = -1; sdx = (px - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - px) * ddx; }
      if (rdy < 0) { sy = -1; sdy = (py - my) * ddy; } else { sy = 1; sdy = (my + 1 - py) * ddy; }
      let side = 0, hit = null, guard = 0;
      while (!hit && guard++ < 40) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        const c = Explore.cell(world, mx, my);
        if (c.opaque) hit = c;
      }
      if (!hit) { zbuf[col] = 99; continue; }
      const dist = side === 0 ? sdx - ddx : sdy - ddy;
      zbuf[col] = dist;
      const lineH = Math.min(h * 3, Math.floor(h / Math.max(0.05, dist)));
      const top = Math.floor((h - lineH) / 2);
      let wallX = side === 0 ? py + dist * rdy : px + dist * rdx;
      wallX -= Math.floor(wallX);
      let base = L.wall;
      if (hit.kind === 'door') base = [96, 66, 38];
      else if (hit.kind === 'locked') base = [78, 80, 86];
      else if (hit.kind === 'rock') base = mix(L.wall, L.fog, 0.4);
      // Bricks: mortar lines.
      const row = Math.floor(((wallX * 3) % 1) * 8);
      const brickRow = Math.floor(wallX * 3 * 0 + (wallX * 2));
      let tex = 1;
      if (hit.kind === 'wall' || hit.kind === 'rock') {
        const fy = (wallX * 4) % 1;
        tex = (fy < 0.06 || fy > 0.97) ? 0.78 : 1;
        tex *= 0.93 + 0.07 * (((mx * 7 + my * 13 + Math.floor(wallX * 4) * 5) % 5) / 4);
      } else if (hit.kind === 'door' || hit.kind === 'locked') {
        tex = (wallX < 0.08 || wallX > 0.92) ? 0.6 : (Math.abs(wallX - 0.5) < 0.02 ? 0.7 : 1);
      }
      const dark = Math.max(0.05, 1 - dist / (reach + 1)) * L.torch * flicker * (side ? 0.78 : 1) * tex;
      ctx.fillStyle = css(mix(L.fog, base, Math.min(1, dark)));
      ctx.fillRect(col, top, 1, lineH);
      if (hit.kind === 'locked' && Math.abs(wallX - 0.5) < 0.05 && lineH > 20) {
        ctx.fillStyle = `rgba(210,180,90,${Math.min(1, dark + 0.2)})`;
        ctx.fillRect(col, top + lineH * 0.52, 1, lineH * 0.06);
      }
    }

    // Sprites, far to near.
    const sprites = [];
    const r = Math.ceil(reach);
    for (let y = ex.y - r; y <= ex.y + r; y++) for (let x = ex.x - r; x <= ex.x + r; x++) {
      if (x === ex.x && y === ex.y) continue;
      const s = spriteAt(world, x, y);
      if (!s) continue;
      const rx = x + 0.5 - px, ry = y + 0.5 - py;
      const inv = 1 / (planeX * dirY - dirX * planeY);
      const tx = inv * (dirY * rx - dirX * ry);
      const ty = inv * (-planeY * rx + planeX * ry);
      if (ty <= 0.2) continue;
      sprites.push({ s, tx, ty, x, y });
    }
    sprites.sort((a, b) => b.ty - a.ty);
    for (const sp of sprites) {
      const screenX = Math.floor((w / 2) * (1 + sp.tx / sp.ty));
      const col = Math.max(0, Math.min(w - 1, screenX));
      if (zbuf[col] < sp.ty - 0.3) continue;
      const size = Math.floor((h / sp.ty) * sp.s.size);
      if (size < 6) continue;
      const dark = Math.max(0.15, 1 - sp.ty / (reach + 1.5));
      const yMid = sp.s.ground ? h / 2 + (h / sp.ty) * 0.28 : h / 2 + (h / sp.ty) * (0.5 - sp.s.size / 2) + size * 0.05;
      ctx.save();
      ctx.globalAlpha = dark * (sp.s.dim ? 0.8 : 1);
      ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (sp.s.tint === 'friendly') { ctx.shadowColor = 'rgba(120,200,150,0.9)'; ctx.shadowBlur = size / 5; }
      else if (sp.s.tint === 'stairs') { ctx.shadowColor = 'rgba(240,210,120,0.9)'; ctx.shadowBlur = size / 4; }
      else if (!sp.s.ground) { ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = size / 6; }
      ctx.fillText(sp.s.glyph, screenX, yMid);
      if (sp.s.dim) { ctx.globalAlpha *= 0.9; ctx.font = `${Math.max(10, size / 4)}px serif`; ctx.fillText('z z', screenX + size * 0.35, yMid - size * 0.45); }
      ctx.restore();
    }

    // Vignette.
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }

  // ---- Minimap -------------------------------------------------------------------------------------
  function minimap(canvas, world, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const g = Explore.here(world);
    const ms = G.World.mapState(world, world.place);
    const ex = world.explore;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,10,10,0.9)';
    ctx.fillRect(0, 0, W, H);
    let x0 = 0, y0 = 0, x1 = g.w, y1 = g.h;
    if (!opts.full) { const R = 6; x0 = Math.max(0, ex.x - R); x1 = Math.min(g.w, ex.x + R + 1); y0 = Math.max(0, ex.y - R); y1 = Math.min(g.h, ex.y + R + 1); }
    const cw = Math.floor(Math.min(W / (x1 - x0), H / (y1 - y0)));
    const ox = Math.floor((W - cw * (x1 - x0)) / 2), oy = Math.floor((H - cw * (y1 - y0)) / 2);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (!ms.seen[x + ',' + y]) continue;
      const c = Explore.cell(world, x, y);
      const X = ox + (x - x0) * cw, Y = oy + (y - y0) * cw;
      if (c.kind === 'rock') continue;
      ctx.fillStyle = c.kind === 'wall' ? '#4a4f4c' : c.kind === 'door' ? '#8a6238' : c.kind === 'locked' ? '#6a6f78' : '#2c3431';
      ctx.fillRect(X, Y, cw, cw);
      if (c.kind !== 'wall' && c.kind !== 'door' && c.kind !== 'locked') { ctx.fillStyle = '#35403c'; ctx.fillRect(X + 1, Y + 1, cw - 2, cw - 2); }
      const s = spriteAt(world, x, y);
      if (s) {
        ctx.fillStyle = c.kind === 'monster' ? (c.st.pacified ? '#7bbf8a' : '#e0655b') : c.kind === 'chest' ? '#e6c96b' : c.kind === 'npc' ? '#74a8d8' : c.kind === 'stairs' ? '#f2e2a0' : c.kind === 'trap' ? '#e0a03c' : '#c0c0c0';
        ctx.beginPath(); ctx.arc(X + cw / 2, Y + cw / 2, Math.max(2, cw / 3.2), 0, 6.283); ctx.fill();
      }
    }
    // The party.
    const X = ox + (ex.x - x0) * cw + cw / 2, Y = oy + (ex.y - y0) * cw + cw / 2;
    const d = Explore.DIRS[ex.dir];
    ctx.fillStyle = '#5db09d';
    ctx.beginPath();
    ctx.moveTo(X + d[0] * cw * 0.45, Y + d[1] * cw * 0.45);
    ctx.lineTo(X - d[1] * cw * 0.35 - d[0] * cw * 0.3, Y + d[0] * cw * 0.35 - d[1] * cw * 0.3);
    ctx.lineTo(X + d[1] * cw * 0.35 - d[0] * cw * 0.3, Y - d[0] * cw * 0.35 - d[1] * cw * 0.3);
    ctx.closePath(); ctx.fill();
  }

  UI.FirstPerson = { render, minimap, spriteAt };
})(globalThis.BBB);
