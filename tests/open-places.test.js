// Outdoors and its edges (the user, 2026-11-02): an open place hides nothing; a way out on the map's edge has its road
// running on past the edge, which a click can aim at. The open world (data/outdoors.yaml, tools/worldgen.js): every
// square on an edge that can be walked off leads into the place next door, onto the square across from it.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Explore, Content } = B;

const home = Content.world.start.go.to;

test('open places: the whole map is seen on arrival; a dungeon still starts dark', () => {
  const w = World.create(World.presetParty(), { log: false });
  Explore.enter(w, home, Content.world.start.go.arrive);
  const g = Explore.here(w), ms = World.mapState(w, w.place);
  assert.equal(Object.keys(ms.seen).length, g.w * g.h);
  Explore.enter(w, 'ember_hall', 'L');
  const h = Explore.here(w);
  assert.ok(Object.keys(World.mapState(w, w.place).seen).length < h.w * h.h / 2);
});

test('edge exits: found on the edge, with the way they lead off; the road runs three squares past', () => {
  const ex = Explore.exits(home), g = Explore.grid(home);
  assert.ok(ex.length > 20, 'an open place is open along most of its edges');
  for (const e of ex) assert.ok(e.dx ? e.x === (e.dx === 1 ? g.w - 1 : 0) : e.y === (e.dy === 1 ? g.h - 1 : 0));
  const e = ex.find((q) => q.dx === 1);
  assert.equal(Explore.beyond(home, e.x + 3, e.y).x, e.x);
  assert.equal(Explore.beyond(home, e.x + 4, e.y), null, 'only three squares out');
  assert.ok(Explore.beyond(home, e.x - 3, e.y) === null, 'only beyond the edge');
});

test('the open world: every way across has one back, square for square', () => {
  const places = Content.world.places;
  for (const [id, p] of Object.entries(places)) {
    if (!p.world) continue;
    const g = Explore.grid(id);
    for (const e of Explore.exits(id)) {
      const def = g.legend[g.rows[e.y][e.x]];
      if (!places[def.to].world) continue;
      const o = Explore.grid(def.to);
      const x = e.dx ? (e.dx === 1 ? 0 : o.w - 1) : e.x, y = e.dy ? (e.dy === 1 ? 0 : o.h - 1) : e.y;
      const back = o.legend[o.rows[y][x]];
      assert.ok(back && back.kind === 'stairs' && back.to === id, `${id} (${e.x},${e.y}) faces a way back in ${def.to}`);
      assert.ok(o.rows[y].includes(def.at) || o.rows.some((r) => r.includes(def.at)), `${def.to} has ${def.at}`);
    }
  }
});

test('the open world: off an edge you come in across from where you left, not at the first way back', () => {
  const w = World.create(World.presetParty(), { log: false });
  Explore.enter(w, home, 'I');
  const g = Explore.here(w), ex = Explore.exits(home).filter((e) => e.dy === -1);
  for (const e of [ex[0], ex[ex.length - 1]]) {
    Explore.enter(w, home, 'I');
    const def = g.legend[g.rows[e.y][e.x]];
    Explore.enter(w, def.to, def.at, { place: home, x: e.x, y: e.y });
    assert.equal(w.place, def.to);
    assert.deepEqual([w.explore.x, w.explore.y], [e.x, Explore.here(w).h - 1]);
  }
  // Without where you came from, the first square of the arrival letter.
  const def = g.legend[g.rows[ex[0].y][ex[0].x]];
  Explore.enter(w, def.to, def.at);
  assert.deepEqual([w.explore.x, w.explore.y], [Explore.findChar(def.to, def.at).x, Explore.findChar(def.to, def.at).y]);
});

test('the open world: stepping onto a way across asks nothing; a step on off the edge crosses', () => {
  const w = World.create(World.presetParty(), { log: false });
  Explore.enter(w, home, 'I');
  const g = Explore.here(w), e = Explore.exits(home).find((q) => q.dx === 1);
  // Stand one square in from the way across, facing it.
  Explore.enter(w, home, 'I');
  Object.assign(w.explore, { x: e.x - 1, y: e.y, dir: 1 });
  assert.equal(Explore.DIRS[1][0], 1, 'direction 1 is east');
  const on = Explore.move(w, 0);
  assert.ok(on.moved, 'onto the way across');
  assert.ok(!on.events.some((v) => v.type === 'stairs'), 'no prompt on the edge');
  const off = Explore.move(w, 0);
  assert.equal(off.moved, false);
  const cross = off.events.find((v) => v.type === 'cross');
  assert.ok(cross, 'a step off the edge crosses');
  assert.equal(cross.def.to, g.legend[g.rows[e.y][e.x]].to);
});

test('the open world: past a place\'s edge lies the next place\'s land, as that place has it', () => {
  const p = Content.world.places[home], g = Explore.grid(home);
  const east = Explore.placeAt(p.world[0], p.world[1] + 1), o = Explore.grid(east);
  for (let y = 0; y < g.h; y += 7) {
    const c = Explore.across(home, g.w + 2, y), ch = o.rows[y][2], def = o.legend[ch];
    if (def) { if (def.kind === 'prop' && def.sprite !== 'none') assert.equal(c.kind, 'prop'); continue; }
    assert.equal(c.ch, ch, `square 2,${y} of ${east}`);
  }
  // Off the open world altogether: the sea.
  assert.equal(Explore.across(home, -1000, 0).kind, 'water');
});

test('the open world: no cliff set (a canopy, the red cliff) is drawn under another terrain\'s squares', () => {
  // A cliff set counts the squares of terrains ranked after it as its own upper ground (so stacked tiers run under one
  // another). Unrelated ones must not: the red cliff drew its face under the jungle canopy, showing at its corners.
  const G = globalThis.BBB; G.UI = G.UI || {}; require('../src/ui/game/tilemap.js');
  const Tm = G.UI.Tilemap, under = {};
  for (const [id, pl] of Object.entries(Content.world.places)) {
    if (!pl.world) continue;
    const w = World.create(World.presetParty(), { log: false });
    Explore.enter(w, id, Object.keys(pl.legend).find((k) => pl.legend[k].kind === 'stairs'));
    const g = Explore.here(w), sc = { w: g.w, h: g.h, cell: (x, y) => Explore.peek(w, x, y) }, ts = Tm.tileset(pl.look.tileset);
    for (const c of Tm.planTiles(sc, ts, 0, 0, g.w - 1, g.h - 1).corner) {
      if (!ts.terrains[c.t].cliffTiles) continue;
      if (![[-1, -1], [0, -1], [-1, 0], [0, 0]].some(([dx, dy]) => Tm.terrainAt(sc, ts, c.x + dx, c.y + dy) === c.t)) under[`${id} ${c.t}`] = (under[`${id} ${c.t}`] || 0) + 1;
    }
  }
  assert.deepEqual(under, {});
});
