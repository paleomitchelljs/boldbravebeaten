// Recruits (start.yaml recruits): heroes waiting in the village who take a fallen member's place or fill an empty one.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World } = B;

test('recruits: one takes a fallen member\'s place, not a living one\'s; a full party has no room', () => {
  const w = World.create(World.presetParty(), { log: false });
  assert.deepEqual(World.recruits(w, 'village').map((r) => r.id), ['kalavar', 'arvir', 'jadier', 'crusader', 'spawnee']);
  assert.ok(World.recruit(w, 'arvir').ok && World.recruit(w, 'jadier').ok, 'four of six: room for two');
  assert.equal(World.recruit(w, 'kalavar').ok, false, 'six alive: no room');
  const lorc = w.partyIds[1];
  assert.equal(World.recruit(w, 'kalavar', lorc).ok, false, 'Lorc lives');
  w.chars[lorc].status.dead = true;
  const r = World.recruit(w, 'kalavar', lorc);
  assert.ok(r.ok);
  assert.equal(w.partyIds[1], r.char.id, 'in the fallen member\'s slot');
  assert.equal(w.partyIds.length, 6);
  assert.ok(w.fallen.includes(lorc));
  assert.equal(World.recruits(w, 'village').length, 3, 'Kalavar no longer waiting; the fallen Lorc is back in the village');
  assert.ok(World.recruits(w, 'village').some((x) => x.id === 'lorc'));
  assert.equal(World.recruit(w, 'kalavar', lorc).ok, false, 'already joined');
});

test('recruits (the user, 2026-11-09, for testing): the fallen come back to be recruited, at the party\'s level; a wipe raises them all', () => {
  const w = World.create(World.presetParty(), { log: false });
  for (const c of World.party(w)) { c.level = 4; }
  const [beren, lorc] = w.partyIds;
  w.chars[lorc].status.dead = true;
  const r = World.recruit(w, 'lorc', lorc);
  assert.ok(r.ok, r.reason);
  assert.equal(w.partyIds[1], r.char.id);
  assert.equal(r.char.level, 4, 'joins at the party\'s level');
  assert.equal(B.Character.featCount(r.char), 6, 'grown along the plan: 3 + 3 feats');
  for (const c of World.party(w)) c.status.dead = true;
  const back = B.Town.riseAgain(w);
  assert.ok(back.ok);
  assert.equal(World.living(w).length, w.partyIds.length, 'everyone back');
  assert.notEqual(w.partyIds[0], beren);
  assert.equal(World.party(w)[0].level, 4, 'at the level they fell at');
});

test('heroes start at level 1; their lists are a plan, and a level-10 hero holds twelve feats', () => {
  const C = B.Character;
  for (const h of World.heroes()) {
    const one = World.makeCharacter(h), ten = World.makeCharacter(Object.assign({}, h, { level: 10 }));
    assert.equal(one.level, 1, h.id);
    assert.equal(C.featCount(one), 3, h.id + ' at level 1');
    assert.equal(C.featCount(ten), 12, h.id + ' at level 10');
    assert.ok(C.skillsLeft(ten) <= 3, h.id + ' spends its skill points');
    const s = World.settle(h);
    assert.equal(s.feats.length, 3, 'settled to what they hold');
  }
});

test('recruits: every one can be made into a character with their gear', () => {
  for (const r of World.recruits(World.create(World.presetParty(), { log: false }))) {
    const w = World.create(World.presetParty().slice(0, 3), { log: false });
    const res = World.recruit(w, r.id);
    assert.ok(res.ok, r.id + ': ' + res.reason);
    assert.ok(res.char.wield, r.id + ' holds a weapon');
  }
});

test('heroes: grown far enough, every one holds every feat in their plan (in order, within tier rules), and has an id, a blurb and a home', () => {
  const { Character: C } = B;
  for (const h of World.heroes()) {
    const c = World.makeCharacter(Object.assign({}, h, { level: 20 }));
    assert.equal(C.featCount(c), new Set(h.feats).size === h.feats.length ? h.feats.length : C.featCount(c), `${h.name}: a listed feat could not be taken`);
    for (const f of h.feats) assert.ok(C.rank(c, f), `${h.name}: ${f} could not be taken`);
    assert.ok(h.id && h.blurb && h.place && h.at, `${h.name}: id, blurb, place and at`);
  }
});
