// Lists the wall corners in tiled places where the best tile of their cliff set gets one of the corner's own four
// squares wrong: the shapes that draw broken (a wall stepping down one row at a time, a wall one square thick
// north-south). A tile that only misses an outer square of the 4x4 is fine and not listed. tools/squarewalls.js fixes
// most of them. node tools/walls.js [place...]
const path = require('path');
const repo = path.resolve(__dirname, '..');
process.chdir(repo + '/tests');
require(repo + '/tests/load.js');
const G = globalThis.BBB; G.UI = G.UI || {}; require(repo + '/src/ui/game/tilemap.js');
const Tm = G.UI.Tilemap, places = G.Content.world.places;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(places).filter((id) => places[id].look && places[id].look.tileset);
let total = 0;
for (const id of ids) {
  const pl = places[id];
  const w = G.World.create(G.World.presetParty(), { log: false });
  G.Explore.enter(w, id, Object.keys(pl.legend || {}).find((k) => ['stairs', 'drop', 'note'].includes(pl.legend[k].kind)) || '<');
  const g = G.Explore.here(w);
  const sc = { w: g.w, h: g.h, cell: (x, y) => G.Explore.peek(w, x, y), misfits: true };
  const p = Tm.planTiles(sc, Tm.tileset(pl.look.tileset), 0, 0, g.w - 1, g.h - 1);
  const bad = (p.misfit || []).filter((m) => m.full - m.score >= 40);
  total += bad.length;
  console.log(`${id}: ${bad.length} corner(s) drawn broken`);
  for (const m of bad) console.log(`  corner ${m.x},${m.y} (${m.t}) ${m.g.match(/..../g).join(' ')} -> tile ${m.at} score ${m.score}/${m.full}`);
}
process.exitCode = total ? 1 : 0;
