// The ritual chamber: a square room about 15x15 inside its walls, a square of shallow pool, the dais standing in its middle in the middle
// (the orb with the avatar of fear on it), four small stone pyramids at the corners of the pool, the stair up to the
// palace in the middle of the north wall. You fall in from the sewer drain into the pool. Prints the map rows.
const W = 19, H = 19, C = 9;
const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? ' ' : x === 1 || y === 1 || x === W - 2 || y === H - 2 ? '#' : '.')));
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const d = Math.max(Math.abs(x - C), Math.abs(y - C));  // square: a round pool stair-steps on the grid
  if (g[y][x] === '.' && d >= 1 && d <= 3) g[y][x] = '_';
}
g[C][C] = 'O';                                    // the orb on its dais
for (const [x, y] of [[4, 4], [14, 4], [4, 14], [14, 14]]) g[y][x] = 'y';
g[2][C] = 'S';                                    // the stair up to the palace
g[7][C] = 'D';                                    // where you land from the sewer drain
g[13][C] = 'A';                                   // the avatar of fear (a stand-in) before the dais
console.log(g.map((r) => `    - "${r.join('')}"`).join('\n'));
