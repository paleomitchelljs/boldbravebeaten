// Walked towns (tools/citygen.js, assets/world/cities.yaml): a town with a map is entered like any place; its
// buildings' doors open its locations (people, services), and every door can be walked to from the way in.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Explore, Content } = B;

const towns = Object.entries(Content.world.places).filter(([, p]) => p.kind === 'town' && p.map);

test('walked towns: generated ones exist, each door names one of its locations, each location has a door', () => {
  assert.ok(towns.length >= 1, 'data/cities.yaml gives at least one town streets');
  for (const [id, p] of towns) {
    const doors = new Set(Object.values(p.legend).filter((d) => d.kind === 'enter').map((d) => d.location));
    for (const loc of doors) assert.ok(p.locations.some((l) => l.id === loc), `${id}: door into ${loc}`);
    for (const l of p.locations) assert.ok(doors.has(l.id), `${id}: no door into ${l.id}`);
  }
});

test('walked towns: in through the way out, every door reached on foot, a step into one opens it', () => {
  for (const [id] of towns) {
    const w = World.create(World.presetParty(), { log: false });
    Explore.enter(w, id);
    assert.ok(w.explore, `${id}: walked, not a menu`);
    const g = Explore.here(w);
    const start = { x: w.explore.x, y: w.explore.y };
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const c = Explore.peek(w, x, y);
      if (c.kind !== 'enter') continue;
      Object.assign(w.explore, start);
      const route = Explore.path(w, x, y);
      assert.ok(route.length > 0, `${id}: no way to the door at ${x},${y}`);
      let evs = [];
      for (const d of route) evs = evs.concat(Explore.go(w, d).events);
      const e = evs.find((v) => v.type === 'enter');
      assert.ok(e && e.def.location === c.def.location, `${id}: stepping into ${x},${y} opens ${c.def.location}`);
    }
  }
});

test('walked towns: leaving a dungeon for one puts you on its streets; a menu town is still a menu', () => {
  const w = World.create(World.presetParty(), { log: false });
  const [id] = towns[0];
  Explore.leave(w, id);
  assert.equal(w.place, id);
  assert.ok(w.explore);
  Explore.leave(w, 'stonebridge');
  assert.equal(w.place, 'stonebridge');
  assert.equal(w.explore, null);
});

test('walked towns: townsfolk with a home are in that location; the rest stand on the streets', () => {
  for (const [id, p] of towns) {
    const homed = Object.values(Content.world.npcs).filter((n) => n.home && n.home.place === id);
    for (const n of homed) assert.ok(p.locations.some((l) => l.id === n.home.location));
    const onMap = Object.values(p.legend).filter((d) => d.kind === 'npc');
    for (const d of onMap) assert.ok(Content.world.npcs[d.npc], `${id}: ${d.npc} is a person`);
  }
});
