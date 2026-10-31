// Getting away from a fight (no flee roll: put a wall between you, or be out of reach), the wall of fire, spell points
// across rests, and the labyrinth's test items: an oil worked into a blade and a journal to read.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Battle, Rand, Combat, Terrain, Magic, Town, Explore, Character: C, Enemies, CONFIG } = B;

const fresh = (seed) => { Rand.seed(seed || 1); return World.create(World.presetParty(), { log: false }); };
const roll = (seed) => { const rng = Enemies.makeRng(seed || 7); return async (req) => Array.from({ length: req.count }, () => 1 + Math.floor(rng() * req.sides)); };

// The party at the west end of a two-square passage, a clay golem at the east end.
function corridor(w) {
  const b = Battle.start(w, { foes: [{ monster: 'clayGolem' }], arena: { w: 12, h: 4 } });
  const enc = b.enc;
  for (let x = 0; x < 12; x++) { Terrain.add(enc, x, 0, 'stoneWall'); Terrain.add(enc, x, 3, 'stoneWall'); }
  const mine = World.active(w);
  mine.forEach((c, i) => { enc.pos[c.id] = { x: Math.floor(i / 2), y: 1 + (i % 2) }; });
  const golem = Object.values(b.foes)[0];
  enc.pos[golem.id] = { x: 11, y: 1 };
  return { b, enc, golem, mine };
}

test('getting away: a wall of fire across the passage lets the party go; without it the golem comes on', () => {
  const w = fresh(3);
  const { enc, golem } = corridor(w);
  assert.equal(Battle.disengaged(w).ok, false, 'nothing in the way: it can reach them');
  for (const y of [1, 2]) Terrain.add(enc, 6, y, 'fireWall', { rounds: 3 });
  assert.ok(!Terrain.passable(enc, 6, 1), 'a wall of fire cannot be walked through');
  assert.equal(Battle.disengaged(w).ok, true, 'the golem has no way round and nothing to throw');
  // Held fast but already in reach is not away.
  enc.pos[golem.id] = { x: 2, y: 1 };
  assert.equal(Battle.disengaged(w).ok, false);
  w.battle.canFlee = false;
  enc.pos[golem.id] = { x: 11, y: 1 };
  assert.equal(Battle.disengaged(w).ok, false, 'some fights cannot be left');
});

test('getting away: the fight ends and the party stands where it was on the field', () => {
  const w = fresh(4);
  Explore.enter(w, 'temple_maze', 'N');
  const { enc, mine } = corridor(w);
  w.battle.arena = { place: 'temple_maze', ox: 10, oy: 5, w: 12, h: 4 };
  const at = enc.pos[mine[0].id];
  const res = Battle.getAway(w);
  assert.equal(res.result, 'fled');
  assert.equal(w.battle, null);
  assert.deepEqual({ x: w.explore.x, y: w.explore.y }, { x: 10 + at.x, y: 5 + at.y });
});

test('wall of fire: scorches whoever ends the round beside it, once however many squares; not who stands off', async () => {
  const w = fresh(5);
  const { enc, b, mine } = corridor(w);
  for (const y of [1, 2]) Terrain.add(enc, 2, y, 'fireWall', { rounds: 3 });
  const chars = Battle.table(w).characters;
  await Terrain.endRound(enc, chars, roll(2), () => {});
  // Members 2 and 3 stand at x 1, beside the wall at x 2; 0 and 1 at x 0, a square farther.
  const hit = (c) => enc.log.filter((l) => l.text.startsWith(`Wall of fire hits ${c.name}`)).length;
  assert.deepEqual(mine.map(hit), [0, 0, 1, 1], 'once each, only those beside it (two squares of wall)');
  assert.ok(b.enc.tiles['2,1'].some((f) => f.kind === 'fireWall' && f.rounds === 2), 'it burns down');
});

test('spell points: a rest brings them back, each spent point wears spWeary off the maximum; a night clears it', async () => {
  const w = fresh(6);
  const mage = World.party(w).find((c) => Magic.maxSP(c) > 0);
  const full = Magic.maxSP(mage);
  mage.spSpent = 6;
  World.restAndRepair(w);
  assert.equal(mage.spSpent, 0);
  const after = Math.floor(full - 6 * B.CONFIG.magic.spWeary);
  assert.ok(after < full);
  assert.equal(Magic.maxSP(mage), after);
  assert.equal(Magic.availableSP(mage) <= after, true);
  await B.Recovery.longRest(mage, {}, roll(1));
  assert.equal(Magic.maxSP(mage), full);
});

test('jabiku knows Build and Fire: a wall of fire to cast', () => {
  const w = fresh(7);
  const j = World.party(w).find((c) => c.name === 'Jabiku');
  assert.ok(Magic.spellOptions(j).some((o) => o.spellKey === 'build+fire'));
});

test('golem-bane oil: worked into the blade in hand, it bites golems a landed blow at a time; the journal reads, and stays', async () => {
  const w = fresh(8);
  const c = World.party(w)[0];
  World.addGood(w, 'golem_bane_oil');
  assert.ok(Town.useGood(w, 'golem_bane_oil', c).ok);
  const blade = C.wieldedWeapon(c);
  assert.equal(blade.coat.hits, 5);
  assert.equal(World.goodCount(w, 'golem_bane_oil'), 0);
  World.addGood(w, 'maze_journal');
  const r = Town.useGood(w, 'maze_journal', c);
  assert.ok(r.ok && /lose control of the golem/.test(r.lines[0]));
  assert.equal(World.goodCount(w, 'maze_journal'), 1, 'reading does not use it up');
  // Five blows that land, then it is gone. Nobody defends; the golem only ends its turns.
  const [golem] = Enemies.makeMonster('clayGolem');
  golem.side = 'enemy';
  c.side = 'party';
  c.stamina = C.maxStamina(c);
  const chars = { [c.id]: c, [golem.id]: golem };
  const enc = Combat.createEncounter('t', [c.id, golem.id], chars, 6, 3);
  enc.pos[c.id] = { x: 1, y: 1 }; enc.pos[golem.id] = { x: 2, y: 1 };
  const x = { roller: roll(9), react: () => null };
  for (let guard = 0; guard < 40 && blade.coat; guard++) {
    if (enc.phase !== 'turn') await Combat.startRound(enc, chars, x.roller);
    const id = Combat.currentActor(enc);
    const opt = id === c.id && Combat.legalActions(enc, chars, c.id).attacks.find((o) => o.weaponId === blade.id && o.affordable);
    if (opt && C.isActive(golem)) await Combat.act(enc, chars, { actor: c.id, type: 'strike', option: opt, target: golem.id }, x);
    else await Combat.endTurn(enc, chars, id, x);
  }
  assert.equal(enc.log.filter((l) => /golem-bane oil \+4/.test(l.text)).length, 5);
  assert.ok(!blade.coat && enc.log.some((l) => /oil on .* is spent/.test(l.text)));
});
