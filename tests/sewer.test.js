// The sewers: the wells lead down (the gatehouse's both ways, the others one way), the bridges are the way across,
// and a plank deck is drawn as its own terrain.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Explore, Rand, Content } = B;

test('sewers: the gatehouse well goes down and back up; the labyrinth and pyramid wells only down', () => {
  const pl = Content.world.places;
  assert.equal(pl.temple_wall.legend.W.kind, 'stairs');
  assert.equal(pl.temple_wall.legend.W.to, 'temple_sewer');
  assert.equal(pl.temple_sewer.legend.G.to, 'temple_wall');
  for (const id of ['temple_maze', 'temple_court2']) {
    assert.equal(pl[id].legend.W.kind, 'drop');
    assert.equal(pl[id].legend.W.to, 'temple_sewer');
  }
  // Each drop lands in a shallow pool, on its feet.
  Rand.seed(1);
  const w = World.create(World.presetParty(), { log: false });
  for (const at of ['L', 'P']) {
    Explore.enter(w, 'temple_sewer', at);
    const c = Explore.cell(w, w.explore.x, w.explore.y);
    assert.equal(c.ground.name, 'Shallow water');
    assert.equal(c.solid, false);
  }
});

test('sewers: every walkway is reached from the shaft, and only over the bridges', () => {
  Rand.seed(2);
  const w = World.create(World.presetParty(), { log: false });
  Explore.enter(w, 'temple_sewer', 'G');
  const rows = Content.world.places.temple_sewer.map;
  const walk = (noBridges) => {
    const seen = new Set([w.explore.x + ',' + w.explore.y]), q = [[w.explore.x, w.explore.y]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy, k = X + ',' + Y, c = Explore.cell(w, X, Y);
        if (seen.has(k) || (c.solid && c.kind !== 'monster' && c.kind !== 'chest' && c.kind !== 'prop') || (noBridges && rows[Y][X] === '=')) continue;
        seen.add(k); q.push([X, Y]);
      }
    }
    return seen;
  };
  const all = walk(false), dry = walk(true);
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) if ('._'.includes(rows[y][x])) assert.ok(all.has(x + ',' + y), `${x},${y} reached`);
  assert.ok(dry.size < all.size / 2, 'without the bridges most of the sewers are out of reach');
  // Deep water stops walkers.
  const deep = Explore.cell(w, rows[9].indexOf('~'), 9);
  assert.equal(deep.kind, 'water');
});

test('tilesets: a bridge with a corner sheet is drawn as its own terrain', () => {
  const UI = (globalThis.BBB.UI = globalThis.BBB.UI || {});
  if (!UI.Tilemap) require('../src/ui/game/tilemap.js');
  const Tm = globalThis.BBB.UI.Tilemap;
  Rand.seed(3);
  const w = World.create(World.presetParty(), { log: false });
  Explore.enter(w, 'temple_sewer', 'G');
  const rows = Content.world.places.temple_sewer.map;
  const sc = { w: rows[0].length, h: rows.length, cell: (x, y) => Explore.cell(w, x, y) };
  const ts = Tm.tileset('temple_sewer');
  const bx = rows[9].indexOf('=');
  const p = Tm.planTiles(sc, ts, bx - 1, 8, bx + 1, 11);
  assert.ok(p.corner.some((c) => c.t === 'bridge'), 'deck corners');
  assert.equal(p.over.length, 0, 'not laid over as a plank tile');
  assert.equal(p.base.find((b) => b.x === bx && b.y === 9).t, 'water', 'water under it');
});
