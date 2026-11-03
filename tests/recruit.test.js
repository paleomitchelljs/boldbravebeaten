// Recruits (start.yaml recruits): heroes waiting in the village who take a fallen member's place or fill an empty one.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World } = B;

test('recruits: one takes a fallen member\'s place, not a living one\'s; a full party has no room', () => {
  const w = World.create(World.presetParty(), { log: false });
  assert.deepEqual(World.recruits(w, 'village').map((r) => r.id), ['kalavar', 'arvir', 'jadier', 'crusader', 'spawnee']);
  assert.equal(World.recruit(w, 'kalavar').ok, false, 'four alive: no room');
  const lorc = w.partyIds[1];
  assert.equal(World.recruit(w, 'kalavar', lorc).ok, false, 'Lorc lives');
  w.chars[lorc].status.dead = true;
  const r = World.recruit(w, 'kalavar', lorc);
  assert.ok(r.ok);
  assert.equal(w.partyIds[1], r.char.id, 'in the fallen member\'s slot');
  assert.equal(w.partyIds.length, 4);
  assert.ok(w.fallen.includes(lorc));
  assert.equal(World.recruits(w, 'village').length, 4, 'no longer waiting');
  assert.equal(World.recruit(w, 'kalavar', lorc).ok, false, 'already joined');
});

test('recruits: every one can be made into a character with their gear', () => {
  for (const r of World.recruits(World.create(World.presetParty(), { log: false }))) {
    const w = World.create(World.presetParty().slice(0, 3), { log: false });
    const res = World.recruit(w, r.id);
    assert.ok(res.ok, r.id + ': ' + res.reason);
    assert.ok(res.char.wield, r.id + ' holds a weapon');
  }
});

test('heroes: every one holds every feat listed (in order, within tier rules), and has an id, a blurb and a home', () => {
  const { Character: C } = B;
  for (const h of World.heroes()) {
    const c = World.makeCharacter(h);
    assert.equal(C.featCount(c), h.feats.length, `${h.name}: a listed feat could not be taken`);
    assert.ok(h.id && h.blurb && h.place && h.at, `${h.name}: id, blurb, place and at`);
  }
});
