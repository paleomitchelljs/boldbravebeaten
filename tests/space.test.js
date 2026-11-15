// Space (docs/OVERHAUL.md step B): reach and range by rounded Euclidean distance, a move counting every second
// diagonal as two squares, reach 1–3 in the data, and flanking with no facing.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load');
const { Character: C, Combat, Items, Enemies, AI, Terrain, CONFIG, DATA } = B;

function roller(seed, queue) {
  const rng = Enemies.makeRng(seed || 7);
  const q = (queue || []).slice();
  return async (req) => {
    const out = [];
    for (let i = 0; i < req.count; i++) out.push(q.length ? q.shift() : 1 + Math.floor(rng() * req.sides));
    return out;
  };
}

function armed(name, type, side) {
  const c = C.newCharacter({ name, side, starterGear: false });
  if (type) { const w = Items.makeWeapon(type); c.weapons.push(w); c.wield = w.id; }
  c.base.CHA = 1;
  c.stamina = C.maxStamina(c);
  return c;
}

async function field(list, w, h) {
  const chars = {};
  for (const [c] of list) chars[c.id] = c;
  const enc = Combat.createEncounter('t', list.map(([c]) => c.id), chars, w || 10, h || 7);
  for (const [c, x, y] of list) enc.pos[c.id] = { x, y };
  await Combat.startRound(enc, chars, roller(1, [10].concat(list.slice(1).map(() => 1))));
  return { enc, chars };
}

test('distance: rounded Euclidean for reach, every second diagonal two for a move', () => {
  const o = { x: 0, y: 0 };
  const d = (x, y) => Combat.dist(o, { x, y });
  assert.deepEqual([d(1, 0), d(1, 1), d(2, 1), d(2, 2), d(3, 1), d(3, 2), d(3, 3), d(4, 4)], [1, 1, 2, 3, 3, 4, 4, 6]);
  // Reach 1 is the eight squares around; reach 2 drops the far corners (20 squares around, not 24).
  let r2 = 0;
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if ((x || y) && d(x, y) <= 2) r2++;
  assert.equal(r2, 20);
  const s = (x, y) => Combat.steps(o, { x, y });
  assert.deepEqual([s(1, 0), s(1, 1), s(2, 2), s(3, 3), s(4, 4), s(5, 2)], [1, 1, 3, 4, 6, 6]);
});

test('distance: a walk round foes counts diagonals as Combat.steps does, and the walk itself charges the same', async () => {
  const a = armed('A', 'longsword', 'party');
  const f = armed('F', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 0, 0], [f, 9, 6]], 10, 7);
  // The open-ground count and the cost map agree.
  const map = Terrain.costMap(enc, { x: 0, y: 0 }, a, null, Combat.foeSquares(enc, chars, a));
  for (const [x, y] of [[4, 4], [3, 1], [5, 3], [6, 6]]) assert.equal(Math.round(map.cost[map.idx(x, y)]), Combat.steps({ x: 0, y: 0 }, { x, y }), `${x},${y}`);
  assert.equal(Terrain.pathCost(enc, { x: 0, y: 0 }, { x: 4, y: 4 }, a, Combat.foeSquares(enc, chars, a)).cost.toFixed(0), '6');
  // A move four squares diagonally is charged six.
  const v = Combat.validate(enc, chars, { actor: a.id, type: 'move', to: { x: 4, y: 4 } });
  assert.ok(!v.err, v.err);
  const d = { actor: a.id, type: 'move', to: { x: 4, y: 4 } };
  Combat.validate(enc, chars, d);
  assert.equal(d.squares, 6);
});

test('reach: compressed to 1–3 in the data; Lunge still adds one', () => {
  const W = DATA.WEAPONS;
  for (const [id, w] of Object.entries(W)) {
    if (!w.reach || typeof w.reach !== 'object') continue;
    for (const k of ['swing', 'thrust']) if (w.reach[k] != null) assert.ok(w.reach[k] >= 1 && w.reach[k] <= 3, `${id} ${k} ${w.reach[k]}`);
  }
  assert.equal(Items.reachOf(W.spear, 'thrust'), 3);
  assert.equal(Items.reachOf(W.heavySpear, 'thrust'), 3);
  assert.equal(Items.reachOf(W.shortSpear, 'thrust'), 2);
  assert.equal(Items.reachOf(W.warScythe, 'swing'), 2);
  const c = armed('L', 'spear', 'party');
  const base = C.attackOptions(c).find((o) => o.motion === 'thrust').maxRange;
  c.feats = Object.assign({}, c.feats, { lunge: 1 });
  assert.equal(C.attackOptions(c).find((o) => o.motion === 'thrust').maxRange, base + 1);
});

test('flanking: a foe on the far side takes 2 off the defence; one at the side or covered does not', async () => {
  const d = armed('D', 'longsword', 'party');
  const a = armed('A', 'longsword', 'enemy');
  const f = armed('F', 'longsword', 'enemy');
  const { enc, chars } = await field([[d, 4, 3], [a, 3, 3], [f, 5, 4]], 10, 7);
  const odds = () => Combat.defenseOdds(d, 'parry', 'thrust', a, C.attackOptions(a).find((o) => o.motion === 'thrust'), 0, enc);
  // F at 135° from A: flanked.
  assert.equal(Combat.flanked(enc, d, a), CONFIG.flank.penalty);
  const flankedOdds = odds();
  // F at 90°: not.
  enc.pos[f.id] = { x: 4, y: 4 };
  assert.equal(Combat.flanked(enc, d, a), 0);
  assert.ok(odds() > flankedOdds);
  // F prone does not flank; nor one too far off to strike.
  enc.pos[f.id] = { x: 5, y: 3 };
  f.status.prone = true;
  assert.equal(Combat.flanked(enc, d, a), 0);
  f.status.prone = false;
  assert.equal(Combat.flanked(enc, d, a), CONFIG.flank.penalty);
  enc.pos[f.id] = { x: 8, y: 3 };
  assert.equal(Combat.flanked(enc, d, a), 0);
});

test('flanking: a spear reaching over a friend\'s shoulder does not flank; a wall leaves nowhere to stand', async () => {
  const d = armed('D', 'longsword', 'party');
  const ally = armed('Ally', 'longsword', 'party');
  const a = armed('A', 'longsword', 'enemy');
  const s = armed('S', 'spear', 'enemy');
  const { enc, chars } = await field([[d, 4, 3], [a, 3, 3], [s, 6, 3], [ally, 0, 0]], 10, 7);
  assert.equal(Combat.flanked(enc, d, a), CONFIG.flank.penalty, 'a spear at 2 on the far side flanks');
  enc.pos[ally.id] = { x: 5, y: 3 };
  assert.equal(Combat.flanked(enc, d, a), 0, 'an ally between covers that side');
  // In a corner, two foes can't stand far enough apart.
  const { enc: e2, chars: c2 } = await field([[d, 0, 0], [a, 1, 0], [s, 0, 2], [ally, 9, 6]], 10, 7);
  assert.ok(!Combat.flankedAt(e2, c2, d, { x: 0, y: 0 }));
});

test('flanking: the odds panel shows it', async () => {
  const d = armed('D', 'longsword', 'party');
  const a = armed('A', 'longsword', 'enemy');
  const f = armed('F', 'longsword', 'enemy');
  const { enc, chars } = await field([[d, 4, 3], [a, 3, 3], [f, 5, 3]], 10, 7);
  const o = C.attackOptions(a).find((x) => x.motion === 'thrust');
  const fl = Combat.foresee(a, d, o, { enc, chars });
  assert.equal(fl.flank, CONFIG.flank.penalty);
  enc.pos[f.id] = { x: 4, y: 4 };
  const plain = Combat.foresee(a, d, o, { enc, chars });
  assert.equal(plain.flank, 0);
  assert.ok(fl.lands > plain.lands);
});

test('flanking (AI): a fighter in reach takes a free step to put the foe between itself and an ally', async () => {
  const me = armed('Me', 'longsword', 'party');
  const ally = armed('Ally', 'longsword', 'party');
  const foe = armed('Foe', 'longsword', 'enemy');
  // Foe at (4,3); ally west of it at (3,3); I stand north of it at (4,2) (90° from the ally: no flank).
  const { enc, chars } = await field([[me, 4, 2], [ally, 3, 3], [foe, 4, 3]], 10, 7);
  enc.ap[me.id] = 99;
  assert.equal(Combat.flanked(enc, foe, me), 0);
  const d = AI.choose(enc, chars, me.id, () => 0.99);
  assert.equal(d.type, 'move', JSON.stringify(d));
  assert.ok(Combat.flankerAt(enc, chars, foe, enc.pos[foe.id], d.to, [me.id]), `stepped to ${JSON.stringify(d.to)}`);
});

test('flanking (AI): a fighter caught between two foes steps out from between them before its blow', async () => {
  const me = armed('Me', 'longsword', 'party');
  const f1 = armed('F1', 'club', 'enemy');
  const f2 = armed('F2', 'club', 'enemy');
  const { enc, chars } = await field([[me, 4, 3], [f1, 3, 3], [f2, 5, 3]], 10, 7);
  enc.ap[me.id] = 99;
  assert.ok(Combat.flankedAt(enc, chars, me, enc.pos[me.id]));
  const d = AI.choose(enc, chars, me.id, () => 0.99);
  assert.equal(d.type, 'move', JSON.stringify(d));
  assert.ok(!Combat.flankedAt(enc, chars, me, d.to), `stepped to ${JSON.stringify(d.to)}`);
  // The step draws no blow: still within both clubs' reach and no nearer either.
  for (const f of [f1, f2]) assert.equal(Combat.dist(d.to, enc.pos[f.id]), 1);
});
