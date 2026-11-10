// Lists the corners in tiled places where a corner set meets ground its sheet does not show: a set is drawn as itself
// over one other terrain (`over`), so where a third terrain lies in a corner's lower quarters the tile lays the wrong
// ground there (oasis grass beside water lays sand in the water) unless the set has a `cut` sheet (its lower ground
// cut away; tools/cutsheets.py makes them). node tools/joins.js [place...]
const path = require('path');
const repo = path.resolve(__dirname, '..');
process.chdir(repo + '/tests');
require(repo + '/tests/load.js');
const G = globalThis.BBB; G.UI = G.UI || {}; require(repo + '/src/ui/game/tilemap.js');
const Tm = G.UI.Tilemap, places = G.Content.world.places;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(places).filter((id) => places[id].look && places[id].look.tileset);
let total = 0; const need = {};
for (const id of ids) {
  const pl = places[id];
  const w = G.World.create(G.World.presetParty(), { log: false });
  G.Explore.enter(w, id, Object.keys(pl.legend || {}).find((k) => ['stairs', 'drop', 'note'].includes(pl.legend[k].kind)) || '<');
  const g = G.Explore.here(w);
  const sc = { w: g.w, h: g.h, cell: (x, y) => G.Explore.peek(w, x, y) };
  const ts = Tm.tileset(pl.look.tileset);
  const p = Tm.planTiles(sc, ts, 0, 0, g.w - 1, g.h - 1);
  const kinds = {};
  for (const c of p.corner) {
    if (!c.foreign || c.cut) continue;
    const k = `${c.t} beside ${c.foreign}`; need[`${pl.look.tileset} ${c.t} ${ts.dir}${ts.terrains[c.t].wang}`] = 1;
    (kinds[k] = kinds[k] || []).push(`${c.x},${c.y}`);
  }
  const n = Object.values(kinds).reduce((a, v) => a + v.length, 0);
  total += n;
  console.log(`${id} (${pl.look.tileset}): ${n} corner(s) laid over the wrong ground`);
  for (const [k, v] of Object.entries(kinds)) console.log(`  ${k}: ${v.length}  e.g. ${v.slice(0, 4).join('  ')}`);
}
if (process.env.NEED) console.log(Object.keys(need).join('\n'));
process.exitCode = total ? 1 : 0;
