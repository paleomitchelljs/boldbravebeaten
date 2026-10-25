// Lists the places where two walkable squares touch only at a corner, with the two squares between them not walkable
// (wall or deep water): drawn, the ground runs on through the corner and looks like a way through, but you can't step
// it. node tools/diagonals.js [place...]; exits 1 if any.
const path = require('path');
const repo = path.resolve(__dirname, '..');
process.chdir(repo + '/tests');
require(repo + '/tests/load.js');
const G = globalThis.BBB, places = G.Content.world.places;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(places).filter((id) => places[id].look && places[id].look.tileset);
// Walkable by its letter: not wall or rock, and not ground you can't walk (deep water) or that is a wall (a riser).
const walk = (pl, ch) => {
  if (ch === undefined || ch === '#' || ch === ' ') return false;
  const def = pl.legend && pl.legend[ch];
  const gr = G.Explore.groundOf(def ? def.on || (pl.look && pl.look.ground) || '.' : ch);
  return !(gr && (gr.wall || gr.walk === false));
};
let total = 0;
for (const id of ids) {
  const pl = places[id], rows = pl.map, bad = [];
  const at = (x, y) => walk(pl, rows[y] && rows[y][x]);
  for (let y = 0; y + 1 < rows.length; y++) for (let x = 0; x + 1 < rows[y].length; x++) {
    const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1), d = at(x + 1, y + 1);
    if ((a && d && !b && !c) || (b && c && !a && !d)) bad.push(`${x},${y}`);
  }
  total += bad.length;
  console.log(`${id}: ${bad.length} corner(s) where walkable squares touch only diagonally${bad.length ? ': ' + bad.join(' ') : ''}`);
}
process.exitCode = total ? 1 : 0;
