// Squares off wall shapes a place's cliff set has no tile for (a one-square diagonal step, a wall one square thick
// north-south), by flipping single squares between plain wall (#) and plain floor, greedily, keeping only flips that
// cut the count of corners no tile fits, never touching a legend square, and never joining or cutting off floor
// (a flip must keep the floor squares round it connected through its 8 neighbours). Prints the new map rows.
//   node tools/squarewalls.js <place>
const path = require('path');
const repo = path.resolve(__dirname, '..');
process.chdir(repo + '/tests');
require(repo + '/tests/load.js');
const G = globalThis.BBB; G.UI = G.UI || {}; require(repo + '/src/ui/game/tilemap.js');
const Tm = G.UI.Tilemap, id = process.argv[2], pl = G.Content.world.places[id];
const gl = (pl.look && pl.look.ground) || '.';
const rows = pl.map.map((r) => [...r]), H = rows.length, W = rows[0].length;
const ts = Tm.tileset(pl.look.tileset);
const walk = (ch) => ch !== '#' && ch !== ' ' && !(G.Explore.groundOf(ch) && (G.Explore.groundOf(ch).wall || G.Explore.groundOf(ch).walk === false));
const sc = { w: W, h: H, misfits: true, cell: (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return { kind: 'rock', ch: ' ' };
  const ch = rows[y][x];
  if (ch === '#') return { kind: 'wall', ch };
  if (ch === ' ') return { kind: 'rock', ch };
  if (ch === '+') return { kind: 'door', ch, ground: G.Explore.groundOf(gl) };
  const def = pl.legend && pl.legend[ch];
  if (def) return { kind: def.kind, ch, def, ground: G.Explore.groundOf(def.on || gl) };
  const gr = G.Explore.groundOf(ch);
  if (gr && gr.wall) return { kind: 'wall', ch, ground: gr };
  return { kind: gr && gr.walk === false ? 'water' : 'floor', ch, ground: gr || G.Explore.groundOf(gl) };
} };
const bad = () => (Tm.planTiles(sc, ts, 0, 0, W - 1, H - 1).misfit || []).filter((m) => m.full - m.score >= 40);
// The floor round (x, y), within its 8 neighbours, is one piece (so filling or opening it adds or cuts no way through).
const locallyOne = (x, y) => {
  const ring = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].map(([dx, dy]) => [x + dx, y + dy]);
  const open = ring.filter(([a, b]) => rows[b] && rows[b][a] !== undefined && walk(rows[b][a]));
  if (!open.length) return true;
  const key = ([a, b]) => a + ',' + b, set = new Set(open.map(key)), seen = new Set([key(open[0])]), q = [open[0]];
  while (q.length) { const [a, b] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (a + dx) + ',' + (b + dy); if (set.has(k) && !seen.has(k)) { seen.add(k); q.push([a + dx, b + dy]); } } }
  return seen.size === open.length;
};
// The walkable areas, counted (4-way): a flip must leave the count as it was, so it neither cuts a way nor makes one.
const areas = () => {
  const seen = new Set(); let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!walk(rows[y][x]) || seen.has(x + ',' + y)) continue;
    n++; seen.add(x + ',' + y); const q = [[x, y]];
    while (q.length) { const [a, b] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (a + dx) + ',' + (b + dy); if (rows[b + dy] && rows[b + dy][a + dx] !== undefined && walk(rows[b + dy][a + dx]) && !seen.has(k)) { seen.add(k); q.push([a + dx, b + dy]); } } }
  }
  return n;
};
const nAreas = areas();
let cur = bad();
const start = cur.length;
for (let round = 0; round < 200 && cur.length; round++) {
  let bestFlip = null, bestN = cur.length;
  const cand = new Set();
  for (const m of cur) for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) cand.add((m.x + dx) + ',' + (m.y + dy));
  // Single squares first; a pair (side by side or one above the other) only when no single flip helps: a wall that
  // steps down one row at a time needs its steps two rows tall.
  for (const pairs of [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]]]) {
    for (const k of cand) {
      const [x, y] = k.split(',').map(Number);
      const sq = pairs.map(([dx, dy]) => [x + dx, y + dy]);
      if (sq.some(([a, b]) => a < 1 || b < 1 || a >= W - 1 || b >= H - 1)) continue;
      const chs = sq.map(([a, b]) => rows[b][a]);
      if (new Set(chs).size > 1) continue;
      const ch = chs[0], to = ch === '#' ? gl : ch === gl ? '#' : null;
      if (!to) continue;
      const saved = chs.slice();
      let ok = true;
      for (const [a, b] of sq) {
        if (!locallyOne(a, b)) { ok = false; break; }
        rows[b][a] = to;
      }
      // New floor must join floor on a side, or it is an island (a wall square in the water).
      if (ok && to !== '#') ok = sq.every(([a, b]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => walk(rows[b + dy][a + dx])));
      const n = ok && areas() === nAreas ? bad().length : Infinity;
      sq.forEach(([a, b], i) => { rows[b][a] = saved[i]; });
      if (n < bestN) { bestN = n; bestFlip = sq.map(([a, b]) => [a, b, to]); }
    }
    if (bestFlip) break;
  }
  if (!bestFlip) break;
  for (const [a, b, to] of bestFlip) rows[b][a] = to;
  cur = bad();
}
console.error(`${id}: ${start} -> ${cur.length} corners no tile fits`);
console.log(rows.map((r) => `    - "${r.join('')}"`).join('\n'));
