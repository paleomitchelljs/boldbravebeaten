#!/usr/bin/env node
// A one-off labyrinth layout for data/places.yaml: winding two-square passages between two-square walls (so every wall
// shows a top and a face), long dead ends, a few loops, and the bends rounded off. Prints the map rows; paste them into
// the place and hand-edit. The map stays data: this only saves typing it.
//   node tools/labyrinth.js [--seed N] [--cols 9] [--rows 6] [--loops 0.12]
// Letters: N the way in (top), E the far door (east side), W a well, 1-5 lairs and C, c caches in the dead ends farthest
// from the way in, nearest last.
'use strict';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const seed = arg('seed', 7), COLS = arg('cols', 9), ROWS = arg('rows', 6), LOOPS = arg('loops', 0.12);

// Mulberry32: the same seed gives the same labyrinth.
let st = seed >>> 0;
const rnd = () => { st = (st + 0x6d2b79f5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Cell (i, j) is the 2x2 floor at (2 + 4i, 2 + 4j); walls between cells are two squares thick.
const W = COLS * 4 + 2, H = ROWS * 4 + 2;
const g = Array.from({ length: H }, () => Array(W).fill('#'));
const DIRS = [[0, -1, 'N'], [1, 0, 'E'], [0, 1, 'S'], [-1, 0, 'W']];
const open = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => new Set()));
const link = (i, j, d) => { const [dx, dy, n] = DIRS[d]; open[j][i].add(n); open[j + dy][i + dx].add(DIRS[(d + 2) % 4][2]); };

// A depth-first walk: long winding corridors with many dead ends.
const seen = new Set();
const stack = [[Math.floor(COLS / 2), 0]];
seen.add(stack[0].join(','));
while (stack.length) {
  const [i, j] = stack[stack.length - 1];
  const next = shuffle([0, 1, 2, 3]).find((d) => { const ii = i + DIRS[d][0], jj = j + DIRS[d][1]; return ii >= 0 && jj >= 0 && ii < COLS && jj < ROWS && !seen.has(ii + ',' + jj); });
  if (next == null) { stack.pop(); continue; }
  link(i, j, next);
  const ii = i + DIRS[next][0], jj = j + DIRS[next][1];
  seen.add(ii + ',' + jj);
  stack.push([ii, jj]);
}
// A few extra openings, so passages intersect and loop as well as branch.
for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) for (const d of [1, 2]) {
  const ii = i + DIRS[d][0], jj = j + DIRS[d][1];
  if (ii < COLS && jj < ROWS && !open[j][i].has(DIRS[d][2]) && rnd() < LOOPS) link(i, j, d);
}

// Carve the cells and the passages between them.
const carve = (x, y) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) g[y][x] = '.'; };
for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
  const x = 2 + 4 * i, y = 2 + 4 * j;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) carve(x + a, y + b);
  if (open[j][i].has('E')) for (let a = 2; a < 4; a++) for (let b = 0; b < 2; b++) carve(x + a, y + b);
  if (open[j][i].has('S')) for (let a = 0; a < 2; a++) for (let b = 2; b < 4; b++) carve(x + a, y + b);
}

// Round the bends: where a cell turns (two openings at right angles), cut the wall square on the inside of the turn
// and fill the floor square on the outside, so the passage swings round instead of turning square.
for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
  const o = open[j][i];
  if (o.size !== 2) continue;
  const v = o.has('N') ? -1 : o.has('S') ? 1 : 0, h = o.has('E') ? 1 : o.has('W') ? -1 : 0;
  if (!v || !h || (j === 0 && i === Math.floor(COLS / 2))) continue; // not the way in: the door opens onto its corner
  const x = 2 + 4 * i, y = 2 + 4 * j;
  const ix = h > 0 ? x + 2 : x - 1, iy = v > 0 ? y + 2 : y - 1; // the wall square inside the turn
  carve(ix, iy);
  const ox = h > 0 ? x : x + 1, oy = v > 0 ? y : y + 1; // the floor square outside it
  g[oy][ox] = '#';
}

// Distances from the way in, to place things in the far dead ends.
const start = [2 + 4 * Math.floor(COLS / 2), 2];
const dist = new Map([[start.join(','), 0]]);
const q = [start];
while (q.length) {
  const [x, y] = q.shift();
  for (const [dx, dy] of DIRS) {
    const k = x + dx + ',' + (y + dy);
    if (g[y + dy] && g[y + dy][x + dx] === '.' && !dist.has(k)) { dist.set(k, dist.get(x + ',' + y) + 1); q.push([x + dx, y + dy]); }
  }
}
const ends = [];
for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (open[j][i].size === 1) {
  const x = 2 + 4 * i, y = 2 + 4 * j;
  ends.push({ x, y, d: dist.get(x + ',' + y) || 0 });
}
ends.sort((a, b) => b.d - a.d);

// The way in through the north wall, the far door in the east wall, and what lives in the dead ends.
g[1][start[0]] = 'N';
const ej = Math.floor(ROWS / 2), ey = 2 + 4 * ej;
for (let x = W - 2; x > 0 && g[ey][x] === '#'; x--) g[ey][x] = '.';
g[ey][W - 1] = 'E';
const marks = ['1', '2', 'C', '3', 'W', '4', 'c', '5'];
ends.filter((e) => !(e.x === start[0] && e.y === start[1])).slice(0, marks.length).forEach((e, k) => { g[e.y][e.x] = marks[k]; });

const unreached = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === '.' && !dist.has(x + ',' + y) && y !== ey) unreached.push([x, y]);
if (unreached.length) console.error('unreached squares:', unreached.length);
console.log(g.map((r) => `    - "${r.join('')}"`).join('\n'));
