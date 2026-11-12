// The AI plays the game the player plays (docs/PLAN.md step 5). One test or seeded fight for each fault fixed: the
// approach budget, trading a weapon down, blows at a body immune to them, stand-offs, the feat actions, overchannel;
// and that what it reads of the other side is what its character could see. The seeded fights are ones in which the
// AI before step 5 showed the fault (sim/metrics.js counts it; see sim/FINDINGS.md "The AI plays the game").
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const B = require('./load');
const { Character: C, Combat, Items, Enemies, AI, Terrain, CONFIG } = B;

function roller(seed, queue) {
  const rng = Enemies.makeRng(seed || 7);
  const q = (queue || []).slice();
  return async (req) => {
    const out = [];
    for (let i = 0; i < req.count; i++) out.push(q.length ? q.shift() : 1 + Math.floor(rng() * req.sides));
    return out;
  };
}

function armed(name, type, side, extra) {
  const c = C.newCharacter({ name, side, starterGear: false });
  if (type) { const w = Items.makeWeapon(type); c.weapons.push(w); c.wield = w.id; }
  Object.assign(c, extra || {});
  c.base.CHA = 1; // no Bait in these
  c.stamina = C.maxStamina(c);
  return c;
}

// The first in the list has the first turn.
async function field(list, w, h) {
  const chars = {};
  for (const [c] of list) chars[c.id] = c;
  const enc = Combat.createEncounter('t', list.map(([c]) => c.id), chars, w || 10, h || 5);
  for (const [c, x, y] of list) enc.pos[c.id] = { x, y };
  await Combat.startRound(enc, chars, roller(1, [10].concat(list.slice(1).map(() => 1))));
  assert.equal(Combat.currentActor(enc), list[0][0].id);
  return { enc, chars };
}

// A seeded fight from the sims, with the step-5 metrics watching it.
const SIM = path.join(__dirname, '..', 'sim');
async function watched(make, grid, seed, maxRounds) {
  const L = require(path.join(SIM, 'lib'));
  const M = require(path.join(SIM, 'metrics')).create();
  const { A, B: Bs } = make();
  await L.fight({ A, B: Bs, grid, seed, maxRounds: maxRounds || 30, watch: (enc, chars) => M.watch(enc, chars, []) });
  return M.ai;
}
const styles = (a, b) => () => {
  const { makeCombatant } = require(path.join(SIM, 'arena'));
  return { A: makeCombatant(a, 'twoHanded', 'A'), B: makeCombatant(b, 'shield', 'B') };
};

// ---- The approach budget ---------------------------------------------------------------------------------------

test('approach: a fighter does not walk into a spear\'s reach with no AP left to meet its thrust', async () => {
  const a = armed('Sword', 'longsword', 'party');
  const s = armed('Spear', 'spear', 'enemy');
  const { enc, chars } = await field([[a, 0, 2], [s, 7, 2]], 12, 5);
  const def = Math.min(...['parry', 'dodge'].map((k) => C.actionCost(a, k).ap));
  // Enough to walk three squares (into the spear's reach of 4) and nothing after.
  enc.ap[a.id] = C.moveCost(a, 3);
  const d = AI.choose(enc, chars, a.id, () => 0.99);
  if (d.type === 'move') {
    const inReach = Combat.dist(d.to, enc.pos[s.id]) <= 4;
    const left = enc.ap[a.id] - C.moveCost(a, Combat.dist(d.to, enc.pos[a.id]));
    assert.ok(!inReach || left >= def, `walked in to ${Combat.dist(d.to, enc.pos[s.id])} with ${left} AP (a defence costs ${def})`);
  }
  // With a full round's AP it still comes on (it may wait at the edge for the spear to step in: that is a choice).
  enc.ap[a.id] = 99;
  const d2 = AI.choose(enc, chars, a.id, () => 0.99);
  assert.equal(d2.type, 'move');
  assert.ok(Combat.dist(d2.to, enc.pos[s.id]) < 7);
});

test('approach (seeded): the sword-and-shield fighter no longer walks in bare (arena, medium against medium, seed 7003)', async () => {
  const ai = await watched(styles('medium', 'medium'), { w: 20, h: 12 }, 7003);
  assert.equal(ai.intoReachBare, 0);
});

test('approach: what it guesses of a foe\'s AP comes from what it saw, not the foe\'s pool', async () => {
  const a = armed('Sword', 'longsword', 'party');
  const s = armed('Spear', 'spear', 'enemy');
  const { enc, chars } = await field([[a, 0, 2], [s, 7, 2]], 12, 5);
  enc.ap[a.id] = C.moveCost(a, 3);
  const pick = (foeAP) => { enc.ap[s.id] = foeAP; return JSON.stringify(AI.choose(enc, chars, a.id, () => 0.99)); };
  assert.equal(pick(0), pick(999), 'the foe\'s true AP changed the choice');
});

test('defence: a block that leaves no AP for the blow I\'d strike on my turn costs that blow too', async () => {
  const t = armed('Shield', 'longsword', 'party');
  t.shield = Items.makeShield('round', 'iron');
  const a = armed('Axe', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 2, 2], [t, 3, 2]]);
  const thrust = C.attackOptions(a).find((o) => o.motion === 'thrust');
  const decl = { actor: a.id, type: 'strike', option: thrust, target: t.id, ap: thrust.ap };
  const block = Combat.defenseOptions(enc, chars, t, a, decl).options.find((o) => o.type === 'block');
  assert.ok(block);
  const mine = Math.min(...C.attackOptions(t).filter((o) => !o.unarmed).map((o) => o.ap));
  const ask = (ap) => AI.react(enc, chars, { kind: 'defend', actor: t.id, attacker: a.id, decl, hidden: false, options: [block], ap });
  // With AP for a block and a blow, it blocks; the cost of losing the blow can only make it less keen when short.
  assert.equal(ask(block.ap + mine + 5), 'block');
  const short = ask(block.ap + mine - 1);
  assert.ok(short === null || short === 'block');
});

// ---- Weapon choice ---------------------------------------------------------------------------------------------

test('weapons (seeded): a greatsword is not dropped for a dagger while it still reaches (arena, light against heavy, seed 7000)', async () => {
  const ai = await watched(styles('light', 'heavy'), { w: 20, h: 12 }, 7000);
  assert.equal(ai.tradeDown, 0);
});

test('weapons: a spear with the foe inside its reach.min may go to the dagger; a longsword in reach does not', async () => {
  const sp = armed('Spear', 'spear', 'party');
  const dg = Items.makeWeapon('dagger'); sp.weapons.push(dg); sp.sidearm = dg.id;
  const f = armed('Foe', 'longsword', 'enemy');
  f.armor = Items.makeArmor('plate');
  const g1 = await field([[sp, 2, 2], [f, 3, 2]]);
  const d1 = AI.choose(g1.enc, g1.chars, sp.id, () => 0.99);
  assert.notEqual(d1.type, 'endTurn');
  const ls = armed('Sword', 'longsword', 'party');
  const dg2 = Items.makeWeapon('dagger'); ls.weapons.push(dg2); ls.sidearm = dg2.id;
  const f2 = armed('Foe', 'longsword', 'enemy');
  f2.armor = Items.makeArmor('plate');
  const g2 = await field([[ls, 2, 2], [f2, 3, 2]]);
  for (let i = 0; i < 4; i++) {
    const d = AI.choose(g2.enc, g2.chars, ls.id, () => 0.99);
    assert.notEqual(d.type, 'drawSidearm', 'traded the longsword down');
    if (d.type === 'endTurn') break;
    await Combat.submit(g2.enc, g2.chars, d, { roller: roller(5), react: async () => null });
    if (Combat.currentActor(g2.enc) !== ls.id) break;
  }
});

// ---- A body immune to the blow ---------------------------------------------------------------------------------

test('immune: no kick or punch at a clay golem (immune to blunt); a foe it can hurt is chosen instead', async () => {
  const h = armed('Fists', null, 'party');
  const g = Enemies.makeMonster('clayGolem', {})[0];
  g.side = 'enemy';
  const { enc, chars } = await field([[h, 2, 2], [g, 3, 2]]);
  const kick = C.attackOptions(h).find((o) => o.unarmed === 'kick');
  assert.ok(AI.immuneTo(h, g, kick), 'a kick does nothing to it');
  const d = AI.choose(enc, chars, h.id, () => 0.99);
  assert.ok(!(d.type === 'strike' && d.target === g.id), `struck it with ${d.option && d.option.label}`);
  // With a goblin about as well, the fists go to the goblin.
  const h2 = armed('Fists', null, 'party');
  const g2 = Enemies.makeMonster('clayGolem', {})[0]; g2.side = 'enemy';
  const gob = armed('Goblin', null, 'enemy');
  const f2 = await field([[h2, 2, 2], [g2, 3, 2], [gob, 2, 3]]);
  const d2 = AI.choose(f2.enc, f2.chars, h2.id, () => 0.99);
  if (d2.type === 'strike') assert.equal(d2.target, gob.id);
});

test('immune (seeded): Beren and Cyrus no longer kick the clay golem (seed 3: six kicks before)', async () => {
  const ai = await watched(() => {
    const hero = (name) => { const w = B.World.create(B.World.presetParty(), { log: false }); const c = B.World.party(w).find((x) => x.name === name); c.policy = undefined; return c; };
    return { A: [hero('Beren'), hero('Cyrus')], B: [Enemies.makeMonster('clayGolem', {})[0]] };
  }, { w: 12, h: 6 }, 3, 20);
  assert.equal(ai.immune, 0);
});

// ---- Stand-offs ------------------------------------------------------------------------------------------------

test('stand-off: two spears with a wall between wait at most five rounds, then one comes round it', async () => {
  const a = armed('Spear', 'spear', 'party');
  const f = armed('Foe', 'spear', 'enemy');
  const { enc, chars } = await field([[a, 2, 2], [f, 4, 2]]);
  Terrain.add(enc, 3, 2, 'stoneWall');
  const t = Combat.legalActions(enc, chars, a.id).attacks.find((o) => !o.unarmed).targets.find((x) => x.id === f.id);
  assert.ok(t.blockedBy, 'the wall blocks the thrust');
  // The first round at the edge: wary of the foe's thrust as it steps round (the thrust ignores the wall: the rule).
  AI.choose(enc, chars, a.id, () => 0.99);
  // Each round at the edge with nobody striking halves that (it used to count from the fight's first round, so a
  // fighter came in careless by round 3 of a long walk up, and two waiting at the edge never did).
  const moved = [2, 3, 4, 5, 6].find((r) => { enc.round = r; return AI.choose(enc, chars, a.id, () => 0.99).type === 'move'; });
  assert.ok(moved, 'never came round the wall');
});

test('stand-off: an archer with a wall between it and its mark moves to where it can shoot', async () => {
  const a = armed('Archer', 'shortbow', 'party');
  a.inventory.arrows = 20;
  const f = armed('Foe', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 2, 4], [f, 10, 4]], 14, 9);
  for (let y = 3; y <= 5; y++) Terrain.add(enc, 6, y, 'stoneWall');
  assert.ok(Terrain.lineCheck(enc, enc.pos[a.id], enc.pos[f.id], 'missile').blocked);
  const d = AI.choose(enc, chars, a.id, () => 0.99);
  assert.equal(d.type, 'move', `took ${d.type}`);
  assert.ok(!Terrain.lineCheck(enc, d.to, enc.pos[f.id], 'missile').blocked, 'still no line from there');
});

// ---- The feat actions ------------------------------------------------------------------------------------------

test('Rally: a collapsed friend within 3 is brought round', async () => {
  const a = armed('Captain', 'longsword', 'party'); a.feats.rally = 1;
  const b = armed('Down', 'longsword', 'party');
  const f = armed('Foe', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 2, 2], [b, 3, 3], [f, 8, 2]]);
  b.stamina = 0; C.updateCondition(b);
  assert.ok(C.collapsed(b) || !C.isActive(b));
  const d = AI.choose(enc, chars, a.id, () => 0.99);
  assert.equal(d.type, 'rally');
});

test('To Your Feet: a collapsed friend beside me is hauled up', async () => {
  const a = armed('Captain', 'longsword', 'party'); a.feats.to_your_feet = 1;
  const b = armed('Down', 'longsword', 'party');
  const f = armed('Foe', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 2, 2], [b, 3, 2], [f, 8, 2]]);
  b.stamina = 0; C.updateCondition(b);
  const d = AI.choose(enc, chars, a.id, () => 0.99);
  assert.equal(d.type, 'rouse');
  assert.equal(d.target, b.id);
});

test('Command: an AP for a hard-hitting friend in reach of a foe, from one who can\'t strike', async () => {
  const a = armed('Captain', null, 'party'); a.feats.rally = 1; a.feats.command = 1;
  const b = armed('Axe', 'greatsword', 'party'); b.base.STR = 8;
  const f = armed('Foe', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 0, 0], [b, 3, 2], [f, 5, 2]]);
  enc.ap[a.id] = C.actionCost(a, 'command').ap; // a Command's worth: no walking anywhere useful
  const d = AI.choose(enc, chars, a.id, () => 0.99);
  assert.equal(d.type, 'command');
  assert.equal(d.target, b.id);
});

test('Demoralize: a foe in reach of a friend frightened, by one with no blow that reaches', async () => {
  const a = armed('Brute', null, 'party'); a.feats.demoralize = 1; a.base.STR = 9;
  const f = armed('Foe', 'longsword', 'enemy'); f.base.WIL = 1;
  const b = armed('Friend', 'longsword', 'party');
  const { enc, chars } = await field([[a, 2, 2], [f, 5, 2], [b, 6, 2]]);
  enc.ap[a.id] = C.actionCost(a, 'demoralize').ap;
  const d = AI.choose(enc, chars, a.id, () => 0.99);
  assert.equal(d.type, 'demoralize');
});

test('Name the Weakness: a skeleton (no harm from points) named for a side of spears', async () => {
  const a = armed('Lore', null, 'party'); a.feats.name_weakness = 1;
  const b = armed('Spear1', 'spear', 'party'), b2 = armed('Spear2', 'spear', 'party');
  const sk = Enemies.makeMonster('skeleton', {})[0]; sk.side = 'enemy';
  const { enc, chars } = await field([[a, 0, 0], [sk, 5, 2], [b, 3, 2], [b2, 3, 3]], 12, 6);
  const d = AI.choose(enc, chars, a.id, () => 0.99);
  assert.equal(d.type, 'nameWeakness');
  assert.equal(d.target, sk.id);
});

test('Vanish: out of the archers\' sight when they have me in range and I can\'t answer', async () => {
  const a = armed('Hider', 'longsword', 'party'); a.feats.vanish = 1;
  const f = armed('Archer', 'longbow', 'enemy'); f.inventory.arrows = 20;
  const { enc, chars } = await field([[a, 0, 2], [f, 9, 2]], 12, 5);
  enc.ap[a.id] = C.actionCost(a, 'vanish').ap;
  const d = AI.choose(enc, chars, a.id, () => 0.99);
  assert.equal(d.type, 'vanish');
});

test('Feign Death: badly hurt, a friend still up, a foe beside me: lie still, and stay down while the friend fights', async () => {
  const a = armed('Faker', 'longsword', 'party'); a.feats.feign_death = 1;
  const b = armed('Friend', 'longsword', 'party');
  const f = armed('Foe', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 2, 2], [f, 3, 2], [b, 7, 2]]);
  a.damage.CON = C.attr(a, 'CON') - 1;
  f.armor = Items.makeArmor('plate'); // nothing my blow could finish
  const d = AI.choose(enc, chars, a.id, () => 0.99);
  assert.equal(d.type, 'feign');
  await Combat.submit(enc, chars, d, { roller: roller(2), react: async () => null });
  if (Combat.currentActor(enc) === a.id) assert.equal(AI.choose(enc, chars, a.id, () => 0.99).type, 'endTurn');
});

// ---- Overchannel -----------------------------------------------------------------------------------------------

test('Overchannel: a caster with an empty pool and CON to spare pays CON for a bolt that finishes a foe, never under 3 CON', async () => {
  const m = Enemies.makeMonster('goblinShaman', {})[0];
  m.side = 'party'; m.base.CHA = 1; m.base.CON = 10; m.stamina = C.maxStamina(m);
  m.feats.overchannel = 1;
  const f = armed('Foe', 'longsword', 'enemy');
  f.damage.CON = C.attr(f, 'CON') - 1; // a bolt finishes them
  const { enc, chars } = await field([[m, 2, 2], [f, 5, 2]]);
  const bolt = C.attackOptions(m).find((o) => o.spell);
  assert.ok(bolt, 'a fire bolt');
  m.spSpent = B.Magic.maxSP(m); // the pool is empty
  assert.ok(B.Magic.availableSP(m) < bolt.spCost);
  const d = AI.choose(enc, chars, m.id, () => 0.99);
  assert.ok(d.type === 'strike' && d.option.spell, `took ${d.type}`);
  // Down to its last few CON it doesn't.
  m.damage.CON = C.attr(m, 'CON') - 2 + (m.damage.CON || 0);
  const d2 = AI.choose(enc, chars, m.id, () => 0.99);
  assert.ok(!(d2.type === 'strike' && d2.option.spell), 'overchannelled below 3 CON');
});

// ---- The worth of a condition ----------------------------------------------------------------------------------

test('conditions: the AI\'s worth comes from CONFIG.conditions; one written without it gets a guess', () => {
  assert.equal(AI.conditionWorth('paralyzed'), CONFIG.conditions.paralyzed.worth);
  CONFIG.conditions.testDaze = { name: 'Dazed', resistedBy: 'CON', ap: -1, defense: -1 };
  try { assert.ok(AI.conditionWorth('testDaze') > 4); } finally { delete CONFIG.conditions.testDaze; }
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'src', 'rules', 'ai.js'), 'utf8');
  const named = Object.keys(CONFIG.conditions).filter((k) => new RegExp(`\\b${k}\\s*:\\s*\\d`).test(src));
  assert.deepEqual(named, [], 'a worth table keyed by condition is back in ai.js');
});

test('grappling: a fighter wrestles only by skill when its blows can\'t hurt the foe (a level-8 Beren clinched every bandit)', async () => {
  const a = armed('Sword', 'longsword', 'party'); a.skills.athletics = 3;
  const f = armed('Bandit', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 2, 2], [f, 3, 2]]);
  assert.notEqual(AI.choose(enc, chars, a.id, () => 0.99).type, 'clinch', 'clinched a foe its sword could cut');
  // A grappler by policy still works the ladder.
  const b = armed('Grappler', 'longsword', 'party', { policy: { grappler: true } });
  const g = armed('Bandit', 'longsword', 'enemy');
  const f2 = await field([[b, 2, 2], [g, 3, 2]]);
  assert.equal(AI.choose(f2.enc, f2.chars, b.id, () => 0.99, b.policy).type, 'clinch');
});
