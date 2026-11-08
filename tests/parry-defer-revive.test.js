// The user, 2026-11-07: skill tells in a parry (CONFIG.defense.skill), Defer (CONFIG.defer), and a fight won in time
// leaves the party a chance to save one who has just fallen (CONFIG.magic.revive.afterFight).
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Battle, Combat, Enemies, Magic, Rand, Character: C, CONFIG } = B;

const party = () => World.party(World.create(World.presetParty(), { log: false }));

test('skill in defence: parry Melee, dodge Evasion + Anticipation, block half of Block, each against the striker', () => {
  const ps = party();
  const cyrus = ps.find((c) => c.name === 'Cyrus'), beren = ps.find((c) => c.name === 'Beren');
  const lorc = ps.find((c) => c.name === 'Lorc');
  const [kobold] = Enemies.makeMonster('kobold');
  const [goblin] = Enemies.makeMonster('goblin');
  const [archer] = Enemies.makeMonster('goblinArcher');
  const thrust = C.attackOptions(kobold).find((o) => o.motion === 'thrust');
  const swing = C.attackOptions(goblin).find((o) => o.motion === 'swing');
  const shot = C.attackOptions(archer).find((o) => o.ranged);
  const rapier = C.attackOptions(cyrus).find((o) => o.motion === 'thrust' && !o.unarmed);
  // Cyrus: Melee 5, Evasion 4, Anticipation 4. Beren: Block 5. A goblin: Melee 1, Evasion 1; its archer Ranged 2.
  assert.equal(C.attackSkill(goblin, swing), 1);
  assert.equal(C.attackSkill(archer, shot), 2);
  assert.equal(C.attackSkill(lorc, C.attackOptions(lorc).find((o) => o.ranged)), 5);
  assert.equal(Combat.skillEdge(cyrus, goblin, 'parry', swing), 4);
  assert.equal(Combat.skillEdge(cyrus, goblin, 'dodge', swing), 7);
  assert.equal(Combat.skillEdge(goblin, cyrus, 'dodge', rapier), -4, 'a skilled blow is hard to dodge (1 + 0 against 5)');
  assert.equal(Combat.skillEdge(beren, goblin, 'block', swing), 2, 'half of 5 − 1');
  assert.equal(Combat.skillEdge(beren, archer, 'block', shot), 2, 'half of 5 − 2, rounded');
  assert.ok(Combat.defenseOdds(cyrus, 'parry', 'thrust', kobold, thrust) >= 0.94);
  assert.ok(Combat.defenseOdds(cyrus, 'parry', 'swing', goblin, swing) >= 0.97);
  // Gear and traits add to skills.
  goblin.traits.skills = { melee: 4 };
  assert.equal(Combat.skillEdge(cyrus, goblin, 'parry', swing), 0);
  // Not knowing who strikes: no edge either way.
  assert.equal(Combat.skillEdge(cyrus, null, 'parry'), 0);
});

test('skills: points by level, spent one at a time to 10; a skill a feat needs can\'t be taken back', () => {
  const c = C.newCharacter({ name: 'Learner', starterGear: false });
  assert.equal(C.skillBudget(c), CONFIG.skills.start);
  c.level = 3;
  assert.equal(C.skillBudget(c), CONFIG.skills.start + 2 * CONFIG.skills.perLevel);
  for (let i = 0; i < 10; i++) C.raiseSkill(c, 'melee');
  assert.equal(C.canRaiseSkill(c, 'melee').ok, false, 'at the top');
  assert.ok(C.canRaiseSkill(c, 'block').ok);
  while (C.skillsLeft(c) > 0) C.raiseSkill(c, 'block');
  assert.equal(C.canRaiseSkill(c, 'evasion').ok, false, 'no points left');
  C.addFeat(c, 'quick_parry');
  for (let i = 0; i < 7; i++) C.lowerSkill(c, 'melee');
  assert.equal(C.canLowerSkill(c, 'melee').ok, false, 'Quick Parry needs Melee 3');
});

test('skills: an old save\'s number-only feats become skill ranks', () => {
  const c = { name: 'Old', feats: { parry_training: 2, casting: 1, feint: 3, riposte: 1 }, skills: {} };
  B.Save.upgradeCharacter(c, 4);
  assert.deepEqual(c.skills, { melee: 4, arcane: 2 });
  assert.deepEqual(c.feats, { feint: 1, riposte: 1 });
});

async function fight() {
  const ps = party();
  const [g] = Enemies.makeMonster('goblin');
  const chars = Object.fromEntries(ps.concat([g]).map((c) => [c.id, c]));
  const ids = Object.keys(chars);
  const enc = Combat.createEncounter('t', ids, chars, 9, 5);
  ids.forEach((id, i) => { enc.pos[id] = { x: i, y: id === g.id ? 4 : 0 }; });
  await Combat.startRound(enc, chars, async (req) => Array.from({ length: req.count }, () => 5));
  enc.order = ps.map((c) => c.id).concat([g.id]);
  enc.phase = 'turn'; enc.turn = 0;
  return { enc, chars, ps, g };
}

test('defer: 1 AP lets the next one go now; my turn picks up after theirs, and again as long as the AP lasts', async () => {
  const { enc, chars, ps } = await fight();
  const [a, b, c] = ps;
  const ap = Combat.apLeft(enc, a.id);
  const legal = Combat.legalActions(enc, chars, a.id);
  assert.equal(legal.defer.next, b.id);
  assert.equal(await Combat.submit(enc, chars, { actor: a.id, type: 'defer' }, {}), null);
  assert.equal(Combat.currentActor(enc), b.id);
  assert.equal(Combat.apLeft(enc, a.id), ap - Math.round(CONFIG.defer.ap * (CONFIG.apDisplay || 1)));
  await Combat.endTurn(enc, chars, b.id);
  assert.equal(Combat.currentActor(enc), a.id, 'back to the one who deferred');
  await Combat.submit(enc, chars, { actor: a.id, type: 'defer' }, {});
  assert.equal(Combat.currentActor(enc), c.id, 'past the next one');
  await Combat.endTurn(enc, chars, c.id);
  assert.equal(Combat.currentActor(enc), a.id);
  await Combat.endTurn(enc, chars, a.id);
  assert.equal(Combat.currentActor(enc), ps[3].id, 'and on in order');
  // The last in the order has no one to defer to.
  enc.turn = enc.order.length - 1;
  assert.equal(Combat.legalActions(enc, chars, enc.order[enc.turn]).defer, null);
});

function wonWithOneDown(seed) {
  Rand.seed(seed);
  const w = World.create(World.presetParty(), { log: false });
  Battle.start(w, { name: 'One goblin', foes: [{ monster: 'goblin' }] });
  const chars = Battle.table(w).characters;
  const enc = w.battle.enc;
  const beren = World.party(w).find((c) => c.name === 'Beren');
  const jab = World.party(w).find((c) => c.name === 'Jabiku');
  C.damageAttr(beren, 'CON', C.attr(beren, 'CON') + 2);
  C.updateCondition(beren);
  beren.status.diedRound = enc.round;
  for (const id of enc.ids) if (chars[id].side !== 'party') { chars[id].status.dead = true; chars[id].status.diedRound = enc.round; }
  return { w, beren, jab };
}

test('after a fight won in time: a companion with a Life spell calls the fallen back', () => {
  const { w, beren, jab } = wonWithOneDown(3);
  assert.ok(beren.status.dead);
  const sp = Magic.availableSP(jab);
  const r = Battle.finish(w);
  assert.equal(r.result, 'won');
  assert.ok(r.lines.some((l) => /Jabiku casts Move \+ Life \(on an ally\) over Beren/.test(l)), r.lines.join('\n'));
  assert.ok(!beren.status.dead);
  assert.ok(Magic.availableSP(jab) < sp, 'the points are spent');
});

test('after a fight won in time: with no spell for it, the best healer makes a Medicine check', () => {
  let saved = 0, lost = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { w, beren, jab } = wonWithOneDown(seed);
    jab.spSpent = Magic.maxSP(jab);
    const r = Battle.finish(w);
    const line = r.lines.find((l) => /works over Beren/.test(l));
    assert.ok(line, r.lines.join('\n'));
    assert.match(line, /Medicine \d+ \+ -?\d+ = -?\d+ against 8/);
    if (/too late/.test(line)) { lost++; assert.ok(beren.status.dead); } else { saved++; assert.ok(!beren.status.dead); }
  }
  assert.ok(saved && lost, `saved ${saved}, lost ${lost}`);
});
