// Armor by hit location (the user's choice, docs/PROPOSALS.md §2, step 1): pieces, the location roll, carry-through.
const test = require('node:test');
const assert = require('node:assert');
const B = require('./load');
const { Character: C, Combat, Items, CONFIG } = B;

// A roller that records what was asked and answers from a queue (then `fill`).
function roller(queue, fill, asked) {
  const q = (queue || []).slice();
  return async (req) => { if (asked) asked.push(req.label); return Array.from({ length: req.count }, () => (q.length ? q.shift() : fill || 5)); };
}
function armed(name, type) {
  const c = C.newCharacter({ name, side: 'party', starterGear: false });
  const w = Items.makeWeapon(type, 'average');
  c.weapons.push(w); c.wield = w.id;
  c.stamina = C.maxStamina(c);
  return c;
}
function body(name, pieces) {
  const c = C.newCharacter({ name, side: 'enemy', starterGear: false });
  c.base.CON = 30;
  c.armor = null; c.pieces = [];
  for (const p of pieces || []) { if (Items.coversOf(p).includes('torso')) c.armor = p; else c.pieces.push(p); }
  c.stamina = C.maxStamina(c);
  return c;
}
const enc0 = () => ({ hitThisRound: {}, fortressUsed: {}, log: [], pos: {} });
const swing = (c) => C.attackOptions(c).find((o) => o.damage[1] > 0 && !o.power && !o.windUp);

test('locations: shares sum to 1; a full harness keeps its old numbers; a half one is full plate where it is', () => {
  const L = CONFIG.locations;
  assert.strictEqual(Math.round(L.order.reduce((n, l) => n + L.share[l], 0) * 100), 100);
  const full = Items.armorBase(Items.makeArmor('plate', 'full', 'average'));
  const half = Items.armorBase(Items.makeArmor('plate', 'half', 'average'));
  assert.deepStrictEqual(half.mit, full.mit, 'no coverage penalty to mitigation any more');
  assert.ok(half.spd < full.spd && half.weight < full.weight, 'but less of the weight and the penalties');
  assert.deepStrictEqual(Items.coversOf(Items.makeArmor('plate', 'half', 'average')), ['torso', 'arms', 'legs']);
});

test('locations: no location is rolled against a full harness or a bare body; one is against mixed armor', async () => {
  const a = armed('A', 'longsword');
  const o = swing(a);
  for (const t of [body('Plate', [Items.makeArmor('plate', 'full', 'average')]), body('Bare')]) {
    const asked = [];
    await Combat.applyHit(enc0(), { [a.id]: a, [t.id]: t }, a, t, o, roller([], 5, asked));
    assert.ok(!asked.includes('Hit location'), t.name);
  }
  // A plate helm and nothing else: d100 of 1–8 is the head (the helm), anything else bare.
  const helmed = body('Helmed', [Items.makeArmor('plate', null, 'average', { covers: ['head'] })]);
  const asked = [];
  const r = await Combat.applyHit(enc0(), { [a.id]: a, [helmed.id]: helmed }, a, helmed, o, roller([5], 1, asked));
  assert.strictEqual(asked[0], 'Hit location');
  assert.strictEqual(r.hit.location, 'head');
  assert.ok(r.hit.armored);
  const r2 = await Combat.applyHit(enc0(), { [a.id]: a, [helmed.id]: helmed }, a, helmed, o, roller([30], 1));
  assert.strictEqual(r2.hit.location, 'torso');
  assert.ok(!r2.hit.armored, 'bare where the helm is not');
});

test('locations: the AI sees the expectation over locations; aimed at one, it sees that one', () => {
  const a = armed('A', 'longsword');
  const o = swing(a);
  const t = body('Shirted', [Items.makeArmor('mail', null, 'average', { covers: ['torso', 'arms'] })]);
  const atTorso = Combat.computeHit(a, t, o, { location: 'torso' });
  const atLeg = Combat.computeHit(a, t, o, { location: 'legs' });
  const mean = Combat.computeHit(a, t, o);
  assert.ok(atTorso.armored && !atLeg.armored);
  assert.ok(atLeg.slashToAttrs > atTorso.slashToAttrs);
  assert.ok(mean.slashToAttrs > atTorso.slashToAttrs && mean.slashToAttrs < atLeg.slashToAttrs);
  assert.ok(mean.byLocation && mean.byLocation.length === CONFIG.locations.order.length);
});

test('carry-through: a cut through a bare arm carries on into the torso, where the mail there meets it', async () => {
  const a = armed('A', 'greatsword');
  a.base.STR = 16;
  const o = swing(a);
  const K = CONFIG.locations.carry;
  const bare = body('Bare arms', [Items.makeArmor('mail', null, 'average', { covers: ['torso'] })]);
  const h = Combat.computeHit(a, bare, o, { location: 'arms' });
  assert.ok(h.slashToAttrs > K.limb, `a cut big enough to carry (${h.slashToAttrs})`);
  const asked = [];
  // d2 = 1: on into the torso.
  const r = await Combat.applyHit(enc0(), { [a.id]: a, [bare.id]: bare }, a, bare, o, roller([], 1, asked), { location: 'arms' });
  assert.ok(asked.includes('The cut carries on'));
  assert.match(r.text, /the cut carries \d+ into the torso/);
  const intoMail = Combat.computeHit(a, bare, Object.assign({}, o, { damage: [0, h.slashToAttrs - K.limb, 0] }), { location: 'torso', carried: true });
  assert.ok(r.hit.slashToAttrs <= K.limb + intoMail.slashToAttrs, 'the mail took its share of what carried');
  assert.ok(r.hit.slashToAttrs < h.slashToAttrs, 'less reaches the body than if the torso were bare too');
  // A thrust doesn't carry.
  const thrust = C.attackOptions(a).find((x) => x.motion === 'thrust');
  const asked2 = [];
  await Combat.applyHit(enc0(), { [a.id]: a, [bare.id]: bare }, a, bare, thrust, roller([], 1, asked2), { location: 'arms' });
  assert.ok(!asked2.includes('The cut carries on'));
  // Nor does a cut the mail on the arm stopped.
  const sleeved = body('Sleeved', [Items.makeArmor('mail', null, 'average', { covers: ['torso', 'arms'] }), Items.makeArmor('plate', null, 'average', { covers: ['head'] })]);
  const asked3 = [];
  await Combat.applyHit(enc0(), { [a.id]: a, [sleeved.id]: sleeved }, a, sleeved, o, roller([], 1, asked3), { location: 'arms' });
  if (Combat.computeHit(a, sleeved, o, { location: 'arms' }).slashToAttrs <= K.limb) assert.ok(!asked3.includes('The cut carries on'));
});
