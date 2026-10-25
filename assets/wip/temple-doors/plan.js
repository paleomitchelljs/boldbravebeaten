// node plan.js <repo> <place> <x0> <y0> <x1> <y1>: tile commands (base, corner) for a region, as JSON.
const repo = process.argv[2];
process.chdir(repo + '/tests');
require(repo + '/tests/load.js');
const G = globalThis.BBB; G.UI = G.UI || {}; require(repo + '/src/ui/game/tilemap.js');
const [place, x0, y0, x1, y1] = [process.argv[3], ...process.argv.slice(4).map(Number)];
const pl = G.Content.world.places[place], rows = pl.map, E = G.Explore;
const gl = (pl.look && pl.look.ground) || '.';
const sc = { w: rows[0].length, h: rows.length, cell: (x, y) => {
  const ch = rows[y][x];
  if (ch === '#') return { kind: 'wall', ch };
  if (ch === '+') return { kind: 'door', ch, ground: E.groundOf(gl) };
  const def = pl.legend && pl.legend[ch];
  if (def) return { kind: def.kind, ch, def, ground: E.groundOf(def.on || gl) };
  const gr = E.groundOf(ch);
  return { kind: 'floor', ch, ground: gr || E.groundOf(gl) };
} };
const Tm = G.UI.Tilemap, ts = Tm.tileset(pl.look.tileset);
const p = Tm.planTiles(sc, ts, x0, y0, x1, y1);
const terr = {};
for (const [n, t] of Object.entries(ts.terrains)) terr[n] = { tile: t.tile || null, wang: t.wang || null, index: t.index || null, over: t.over || null, cell: ts.cell };
console.log(JSON.stringify({ dir: ts.dir, cell: ts.cell, base: p.base, corner: p.corner, terr }));
