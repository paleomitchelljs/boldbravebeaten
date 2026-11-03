// node scene.js <repo> <tileset> <ground letter> <row> <row> ...: tile commands for a made-up map ('#' wall, '+' a
// doorway, anything else that ground letter), as JSON, for render.py.
const repo = process.argv[2];
process.chdir(repo + '/tests');
require(repo + '/tests/load.js');
const G = globalThis.BBB; G.UI = G.UI || {}; require(repo + '/src/ui/game/tilemap.js');
const [tsId, gl, ...rows] = process.argv.slice(3);
const E = G.Explore;
const sc = { w: rows[0].length, h: rows.length, cell: (x, y) => {
  const ch = rows[y] && rows[y][x];
  if (ch == null || ch === '#') return { kind: 'wall', ch: '#' };
  if (ch === '+') return { kind: 'door', ch, ground: E.groundOf(gl) };
  return { kind: 'floor', ch, ground: E.groundOf(gl) };
} };
const Tm = G.UI.Tilemap, ts = Tm.tileset(tsId);
const p = Tm.planTiles(sc, ts, 0, 0, sc.w - 1, sc.h - 1);
const terr = {};
for (const [n, t] of Object.entries(ts.terrains)) terr[n] = { tile: t.tile || null, wang: t.wang || null, index: t.index || null, over: t.over || null };
console.log(JSON.stringify({ dir: ts.dir, cell: ts.cell, base: p.base, corner: p.corner, terr, rows }));
