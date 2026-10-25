// The sewers: channels of deep water (~) with stone walkways (.) on one side or the other, plank bridges (=) the only
// way across, a cistern with a plank ring round its drain in the east. Prints the map rows.
const W = 50, H = 34;
const g = Array.from({ length: H }, () => Array(W).fill('#'));
const inside = (x, y) => x >= 2 && y >= 2 && x < W - 2 && y < H - 2;
const disc = (cx, cy, r, ch, only) => {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    if (!inside(x, y) || (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
    if (only && !only.includes(g[y][x])) continue;
    g[y][x] = ch;
  }
};
const path = (pts, r, ch, only) => {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
    for (let k = 0; k <= n; k++) disc(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, r, ch, only);
  }
};
const line = (x0, y0, x1, y1, ch, only) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let k = 0; k <= n; k++) { const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n); if (!only || only.includes(g[y][x])) g[y][x] = ch; }
};

// Walkways first (the stone the channels run through), then the water cut into them.
path([[5, 6], [9, 8], [16, 9], [23, 8], [29, 11], [35, 15]], 2.9, '.');          // west: from the gatehouse shaft east
disc(5, 6, 3.2, '.');                                                             // the shaft's landing
path([[20, 30], [21, 25], [19, 20], [22, 15], [24, 10]], 2.7, '.');               // south: up from under the labyrinth well
disc(20, 29, 2.6, '.');
path([[38, 5], [39, 9], [39, 13]], 2.9, '.');                                     // north-east: down from the pyramid well
disc(37, 5, 2.8, '.');
disc(38, 19, 7.4, '.');                                                           // the cistern
path([[44, 23], [46, 28], [41, 31]], 2.4, '.');                                   // a dead end south-east
path([[9, 13], [8, 20], [11, 27]], 2.5, '.');                                     // a dead end south-west
path([[9, 8], [9, 13]], 1.6, '.');
disc(12.4, 18, 1.5, '.');                                                         // an alcove across the south-west channel
path([[9, 12.6], [21, 12.6]], 1.1, '.');                                       // the main channel's south walkway

// Water. The main channel runs from the west into the cistern; one branch comes up from the south.
path([[9, 9.5], [16, 10.2], [23, 9.6], [29, 12.6], [33, 16]], 1.25, '~');
path([[21.5, 30], [22.5, 25], [20.5, 20], [23, 15], [24.5, 11]], 1.15, '~', '.');
path([[39, 7], [39, 13]], 1.0, '~', '.');
path([[9.5, 14], [8.6, 20], [11, 26]], 1.0, '~', '.');
disc(38, 19, 5.6, '~');                                                           // the pool
path([[43, 23], [45.5, 28]], 1.0, '~', '.');

// Cut the walkways so one side of a channel stops and the other goes on: the bridges are the way through.
const rect = (x0, y0, x1, y1, ch, only) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y) && (!only || only.includes(g[y][x]))) g[y][x] = ch; };
rect(16, 5, 17, 8, '#', '.');      // the main channel's north walkway stops: cross at 12 to the south walkway
rect(25, 13, 27, 15, '#', '.');    // the south walkway can't reach the cistern: back across at 21
rect(23, 12, 24, 13, '#', '.');    // the south channel's east walkway is cut off from the main one: bridges at 20, 25
rect(5, 15, 7, 15, '#', '.');      // the south-west dead end: the west walkway stops
rect(10, 22, 12, 22, '#', '.');

// Bridges (straight), and the ring of planks round the drain.
const vbridge = (x, y0, y1) => rect(x, y0, x, y1, '=', '~'), hbridge = (y, x0, x1) => rect(x0, y, x1, y, '=', '~');
vbridge(12, 8, 12); vbridge(21, 8, 11);
hbridge(18, 5, 12);
// A square deck ring round a hole of open water, the drain on a pad in the middle, a plank out to it.
for (let y = 16; y <= 22; y++) for (let x = 35; x <= 41; x++) { const d = Math.max(Math.abs(x - 38), Math.abs(y - 19)); g[y][x] = d >= 2 ? '=' : '~'; }
hbridge(19, 31, 34); hbridge(19, 42, 45);
g[19][37] = '=';
g[19][38] = 'X';                                                                  // the drain down to the ritual chamber

// Shallows under the two shafts you fall down, and the letters.
disc(20, 30, 1.3, '_', '.'); disc(37, 4, 1.2, '_', '.');
g[6][4] = 'G'; g[30][20] = 'L'; g[4][37] = 'P';
g[18][13] = 'C';                                                                  // a cache in the alcove
g[29][44] = 'r';                                                                  // rats in the south-east dead end
// Check: every walkway reached from the shaft, and which bridges matter (the walkway reached falls without them).
const reach = (skip) => { const seen = new Set(['6,4']), q = [[4, 6]]; while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const X = x + dx, Y = y + dy, k = Y + ',' + X, ch = g[Y][X]; if (seen.has(k) || ch === '#' || ch === '~' || (skip && skip(X, Y))) continue; seen.add(k); q.push([X, Y]); } } return seen; };
let all = reach();
// Pockets nothing reaches go back to wall.
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] !== '#' && g[y][x] !== '~' && !all.has(y + ',' + x)) g[y][x] = '#';
all = reach(); let total = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] !== '#' && g[y][x] !== '~') { total++; if (!all.has(y + ',' + x)) console.error('unreached', x, y); }
const groups = []; const done = new Set();
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === '=' && !done.has(y + ',' + x)) { const grp = []; const st = [[x, y]]; done.add(y + ',' + x); while (st.length) { const [a, b] = st.pop(); grp.push([a, b]); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const k = (b + dy) + ',' + (a + dx); if (g[b + dy][a + dx] === '=' && !done.has(k)) { done.add(k); st.push([a + dx, b + dy]); } } } groups.push(grp); }
for (const grp of groups) { const set = new Set(grp.map(([a, b]) => b + ',' + a)); const n = reach((X, Y) => set.has(Y + ',' + X)).size; console.error('bridge at', grp[0], 'cuts off', all.size - n - grp.length, 'squares'); }
console.log(g.map((r) => `    - "${r.join('')}"`).join('\n'));
