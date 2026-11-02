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
