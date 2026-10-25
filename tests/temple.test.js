// The temple's engine pieces: ground letters (grass, water, bridges), one-way drops, fights that draw in nearby
// groups, and tilesets drawn on the dual grid.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Explore, Battle, Rand, Content, Combat, CONFIG } = B;

const fresh = (seed) => { Rand.seed(seed || 1); return World.create(World.presetParty(), { log: false }); };

// A throwaway place, removed again after the test.
function withPlace(id, place, fn) {
  Content.world.places[id] = Object.assign({ name: id, kind: 'dungeon', level: 1, legend: {}, encounters: {} }, place);
  try { return fn(); } finally { delete Content.world.places[id]; }
}

test('ground: grass is floor to walk on, deep water stops walkers, a bridge crosses it', () => {
  withPlace('t_water', {
    look: { ground: ',' },
    map: ['#######', '#<,~,.#', '#.,=,.#', '#######'],
    legend: { '<': { kind: 'stairs', to: 'stonebridge', at: null } },
  }, () => {
    const w = fresh(2);
    Explore.enter(w, 't_water', '<');
    assert.equal(Explore.cell(w, 2, 1).kind, 'floor');
    assert.equal(Explore.cell(w, 2, 1).ground.name, 'Grass');
    // Plain floor and legend squares stand on the place's ground.
    assert.equal(Explore.cell(w, 1, 2).ground.ch, ',');
    assert.equal(Explore.cell(w, 1, 1).ground.ch, ',');
    const water = Explore.cell(w, 3, 1);
    assert.equal(water.kind, 'water');
    assert.ok(water.solid && !water.opaque, 'water keeps you out but not your eyes');
    w.explore.x = 2; w.explore.y = 1;
    const r = Explore.go(w, 1);
    assert.equal(r.moved, false);
    assert.match(r.events[0].text, /Deep water/);
    // The bridge is the way across.
    assert.equal(Explore.cell(w, 3, 2).kind, 'floor');
    w.explore.x = 2; w.explore.y = 2;
    assert.equal(Explore.go(w, 1).moved, true);
    assert.equal(Explore.go(w, 1).moved, true);
    assert.equal(w.explore.x, 4);
  });
});

test('ground: a fight on the map keeps its deep water; walkers go round it, fliers over it', () => {
  withPlace('t_pool', {
    map: ['###########', '#<...~....#', '#....~....#', '#....~....#', '#.........#', '###########'],
    legend: { '<': { kind: 'stairs', to: 'stonebridge', at: null }, },
  }, () => {
    const w = fresh(3);
    Explore.enter(w, 't_pool', '<');
    w.explore.x = 3; w.explore.y = 2;
    const arena = Battle.dungeonArena(w, { x: 7, y: 2 });
    assert.equal(arena.ground[(5 - arena.ox) + ',' + (2 - arena.oy)], 'deepWater');
    Battle.start(w, { foes: [{ monster: 'wolf' }] }, { ctx: { x: 7, y: 2 } });
    const enc = w.battle.enc;
    const wx = 5 - arena.ox, wy = 2 - arena.oy;
    assert.ok(!B.Terrain.passable(enc, wx, wy), 'deep water is not walked through');
    assert.ok(B.Terrain.canStand(enc, wx, wy, { traits: { flying: true } }), 'a flier may hang over it');
    // Nor does it block a blow or an arrow across it.
    assert.equal(B.Terrain.lineCheck(enc, { x: wx - 1, y: wy }, { x: wx + 1, y: wy }, 'melee').blocked, false);
    assert.equal(B.Terrain.lineCheck(enc, { x: wx - 2, y: wy }, { x: wx + 2, y: wy }, 'missile').blocked, false);
    // The way round is longer than the straight line.
    const walk = B.Terrain.pathCost(enc, { x: wx - 1, y: wy }, { x: wx + 1, y: wy }, {});
    assert.ok(walk.reaches && walk.cost > 2, `walk round costs ${walk.cost}`);
    const fly = B.Terrain.pathCost(enc, { x: wx - 1, y: wy }, { x: wx + 1, y: wy }, { traits: { flying: true } });
    assert.equal(fly.cost, 2);
  });
});

test('drops: a well is one way; the fall can hurt', () => {
  withPlace('t_top', {
    map: ['#####', '#<.O#', '#####'],
    legend: { '<': { kind: 'stairs', to: 'stonebridge', at: null }, O: { kind: 'drop', to: 't_bottom', at: 'X', label: 'A well', damage: { CON: 1 }, text: 'You let go.' } },
  }, () => withPlace('t_bottom', {
    map: ['#####', '#X..#', '#####'],
    legend: { X: { kind: 'note', text: 'Wet stone.' } },
  }, () => {
    const w = fresh(4);
    Explore.enter(w, 't_top', '<');
    w.explore.x = 2; w.explore.y = 1;
    const r = Explore.go(w, 1);
    const ev = r.events.find((e) => e.type === 'stairs');
    assert.ok(ev && ev.def.kind === 'drop', 'stepping on the well offers the drop');
    const before = World.active(w).map((c) => B.Character.totalDamage(c));
    Explore.fall(w, ev.def);
    Explore.enter(w, ev.def.to, ev.def.at);
    assert.equal(w.place, 't_bottom');
    World.active(w).forEach((c, i) => assert.equal(B.Character.totalDamage(c), before[i] + 1));
    assert.ok(!Object.values(Content.world.places.t_bottom.legend).some((d) => d.kind === 'stairs'), 'no way back up');
  }));
});

test('joining: an awake group near the fight comes; a sleeper or a far one does not; beating them settles them all', () => {
  withPlace('t_court', {
    map: [
      '##################',
      '#<...............#',
      '#................#',
      '#....a....b......#',
      '#................#',
      '#.............s..#',
      '#................#',
      '##################',
    ],
    legend: {
      '<': { kind: 'stairs', to: 'stonebridge', at: null },
      a: { kind: 'monster', encounter: 'one', label: 'The first' },
      b: { kind: 'monster', encounter: 'two', label: 'The second' },
      s: { kind: 'monster', encounter: 'sleepy', asleep: true, label: 'Sleepers' },
    },
    encounters: { one: { foes: [{ monster: 'wolf' }] }, two: { foes: [{ monster: 'wolf' }] }, sleepy: { foes: [{ monster: 'rat' }] } },
  }, () => {
    const w = fresh(5);
    Explore.enter(w, 't_court', '<');
    w.explore.x = 3; w.explore.y = 3;
    Battle.start(w, Explore.encounterSpec(w, { encounter: 'one' }), { ctx: { x: 5, y: 3 } });
    const b = w.battle;
    assert.deepEqual(b.joined.map((j) => [j.x, j.y]), [[10, 3]], 'the second group joins; the sleepers sleep on');
    assert.equal(Object.keys(b.foes).length, 2);
    // Each group stands where it was.
    const second = Object.keys(b.foes)[1];
    assert.equal(b.enc.pos[second].x + b.arena.ox, 10);
    for (const f of Object.values(b.foes)) { f.status.dead = true; }
    Battle.finish(w);
    assert.ok(Explore.state(w, 5, 3).done && Explore.state(w, 10, 3).done);
    assert.ok(!Explore.state(w, 14, 5).done);
  });
  // Out of range: nobody comes.
  const saved = CONFIG.game.joinDistance;
  CONFIG.game.joinDistance = 2;
  try {
    withPlace('t_court2', {
      map: ['############', '#<.a....b..#', '############'],
      legend: { '<': { kind: 'stairs', to: 'stonebridge', at: null }, a: { kind: 'monster', encounter: 'wolf' }, b: { kind: 'monster', encounter: 'wolf' } },
    }, () => {
      const w = fresh(6);
      Explore.enter(w, 't_court2', '<');
      Battle.start(w, { foes: [{ monster: 'wolf' }] }, { ctx: { x: 3, y: 1 } });
      assert.equal(w.battle.joined.length, 0);
    });
  } finally { CONFIG.game.joinDistance = saved; }
});

test('content: ground letters, drops and tilesets are checked', () => {
  assert.deepEqual(Content.validate(), []);
  withPlace('t_bad', {
    look: { ground: 'Q', tileset: 'nope' },
    map: ['#####', '#<.Z#', '#####'],
    legend: { '<': { kind: 'stairs', to: 'stonebridge', at: null }, Z: { kind: 'drop', to: 'nowhere', on: 'Q' }, '~': { kind: 'note', text: 'x' } },
  }, () => {
    const msgs = Content.validate().join('\n');
    assert.match(msgs, /look.ground: "Q" is not a ground letter/);
    assert.match(msgs, /look.tileset: "nope" is not in tilesets.yaml/);
    assert.match(msgs, /leads to unknown place "nowhere"/);
    assert.match(msgs, /on "Q" is not a ground letter/);
    assert.match(msgs, /legend "~" is a ground letter/);
  });
});

test('tilesets: wang corners follow the four squares around each corner; plain ground lies under them', () => {
  const UI = (globalThis.BBB.UI = globalThis.BBB.UI || {});
  if (!UI.Tilemap) require('../src/ui/game/tilemap.js');
  const Tm = globalThis.BBB.UI.Tilemap;
  // A 3x3 room of grass in a wall, with a bridge over water in the middle.
  const rows = ['#####', '#,,,#', '#,=,#', '#,~,#', '#####'];
  const sc = { w: 5, h: 5, cell: (x, y) => { const ch = rows[y][x]; if (ch === '#') return { kind: 'wall' }; const gr = Explore.groundOf(ch); return { kind: gr.walk === false ? 'water' : 'floor', ground: gr }; } };
  // A 16-tile set (the temple's are all cliff sets now, so one made up here): every one of the 16 masks has a tile in
  // the PixelLab layout.
  globalThis.BBB.Content.world.tilesets.test16 = { cell: 64, floor: 'grass', terrains: { grass: { color: '#5f7d42' }, wall: { color: '#ccc', wang: 'x.png', over: 'grass' } } };
  const maze = Tm.tileset('test16');
  assert.equal(Object.keys(maze.terrains.wall.index).length, 16);
  assert.deepEqual(maze.terrains.wall.index[15], [0, 3], 'all four corners wall: the solid tile');
  assert.deepEqual(maze.terrains.wall.index[0], [2, 1], 'no corner wall: plain floor');
  const pm = Tm.planTiles(sc, maze, 0, 0, 4, 4);
  const mc = (x, y) => pm.corner.find((c) => c.x === x && c.y === y && c.t === 'wall');
  assert.equal(mc(1, 1).m, 8 | 4 | 2, 'the room\'s inside corner: wall NW, NE and SW of it');
  assert.equal(mc(2, 2), undefined, 'no wall around the middle corner');
  assert.equal(mc(0, 0).m, 15);
  delete globalThis.BBB.Content.world.tilesets.test16;
  // A cliff set (the court): the wall's last row before the floor is its face, picked by pattern.
  const ts = Tm.tileset('temple_court');
  assert.equal(ts.cell, 64);
  const p = Tm.planTiles(sc, ts, 0, 0, 4, 4);
  const corner = (x, y) => p.corner.find((c) => c.x === x && c.y === y && c.t === 'wall');
  assert.deepEqual(corner(2, 1).at, [3, 1], 'the north wall over the room: a straight face');
  assert.equal(corner(0, 0).at[1], 8, 'deep in the wall: one of the plain tops (row 8), picked by position');
  assert.equal(corner(2, 2), undefined, 'no wall around the middle corner');
  // Walls draw grass beneath (their `over`); water draws its own terrain; the bridge goes over it, running north-south.
  assert.equal(p.base.find((b) => b.x === 0 && b.y === 0).t, 'grass');
  assert.equal(p.base.find((b) => b.x === 2 && b.y === 3).t, 'water');
  const br = p.over.find((o) => o.x === 2 && o.y === 2);
  assert.equal(br.g.name, 'Plank bridge');
  assert.equal(br.vertical, false, 'grass on both sides: it runs east-west');
});

test('pyramid: risers draw as the tier they hold up, tiers share a sheet by `like`, and the stairs lead to the top', () => {
  const UI = (globalThis.BBB.UI = globalThis.BBB.UI || {});
  if (!UI.Tilemap) require('../src/ui/game/tilemap.js');
  const Tm = globalThis.BBB.UI.Tilemap;
  const w = fresh(7);
  Explore.enter(w, 'temple_court2', 'S');
  const g = Content.world.places.temple_court2;
  const sc = { w: g.map[0].length, h: g.map.length, cell: (x, y) => Explore.cell(w, x, y) };
  const ts = Tm.tileset('temple_court');
  assert.equal(ts.terrains.tier3.cliffTiles.length, ts.terrains.tier1.cliffTiles.length, 'tier3 copies tier1\'s cliff list');
  assert.equal(ts.terrains.tier3.wang, 'pyramid-tier3.png', 'and keeps its own sheet');
  assert.ok(ts.terrains.tier4.rank > ts.terrains.tier3.rank && ts.terrains.tier4.rank < ts.terrains.wall.rank);
  const p = Tm.planTiles(sc, ts, 0, 0, sc.w - 1, sc.h - 1);
  const base = (x, y) => p.base.find((b) => b.x === x && b.y === y).t;
  assert.equal(base(5, 5), 'grass', 'a riser lies over the grass');
  assert.equal(p.corner.filter((c) => c.t === 'tier1').length > 0, true);
  // The riser of the second tier (8, 8) counts as tier2 for its corners; the terrace inside it as tier2 too.
  const at = (x, y) => p.corner.find((c) => c.x === x && c.y === y && c.t === 'tier2');
  assert.ok(at(9, 9), 'tier2 draws a corner where its riser meets its terrace');
  assert.equal(at(7, 7), undefined, 'and none out on the first terrace');
  // Walkers reach the top from the door, by the stairs only.
  const seen = new Set(['19,35']), q = [[19, 35]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (x + dx) + ',' + (y + dy);
      if (!seen.has(k) && !Explore.cell(w, x + dx, y + dy).solid) { seen.add(k); q.push([x + dx, y + dy]); }
    }
  }
  assert.ok(seen.has('18,18'), 'the top terrace is reached');
  const tops = [...seen].filter((k) => g.map[+k.split(',')[1]][+k.split(',')[0]] === '&');
  assert.ok(tops.length > 40);
});
