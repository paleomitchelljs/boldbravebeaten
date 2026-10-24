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

test('parry carry-through: a heavy swing beats through a light parry, weakened; a parried thrust stops dead', async () => {
  const atk = armed('A', 'greatsword');
  atk.base.STR = 14; atk.base.SPD = 1;
  const def = armed('D', 'rapier');
  def.side = 'enemy'; def.base.SPD = 9; def.base.CON = 30; def.stamina = C.maxStamina(def);
  const chars = { [atk.id]: atk, [def.id]: def };
  const enc = Combat.createEncounter('t', [atk.id, def.id], chars, 6, 1);
  enc.pos[atk.id] = { x: 0, y: 0 }; enc.pos[def.id] = { x: 2, y: 0 }; // the greatsword's own reach (cramped at 1)
  await Combat.startRound(enc, chars, roller([10, 1]));
  const cut = C.attackOptions(atk).find((o) => o.motion === 'twoHanded');
  const share = Combat.parryCarryShare(def, 'parry', cut);
  assert.ok(share > 0.3, `a rapier meets little of a greatsword's cut (${share.toFixed(2)} carries)`);
  // The defender parries (and wins the roll: 10 against 1); the blow still lands, weakened.
  const io = { roller: roller([10, 1], 5), react: (req) => (req.kind === 'defend' ? 'parry' : null) };
  const before = def.stamina + C.totalDamage(def) * 10;
  const err = await Combat.act(enc, chars, { actor: atk.id, type: 'strike', option: cut, target: def.id }, io);
  assert.strictEqual(err, null);
  assert.ok(enc.log.some((l) => /beats through the parry/.test(l.text)), enc.log.map((l) => l.text).join('\n'));
  assert.ok(def.stamina + C.totalDamage(def) * 10 < before, 'some of it landed');
  const thrust = C.attackOptions(atk).find((o) => o.motion === 'thrust');
  assert.strictEqual(Combat.parryCarryShare(def, 'parry', thrust), 0);
});

test('aimed blows: a location costs its penalty against a defence (less for a thrust); a shield guards the torso and arm; the AI aims at bare legs', () => {
  const a = armed('A', 'longsword');
  const t = body('Breastplate', [Items.makeArmor('plate', null, 'average', { covers: ['torso'] }), Items.makeArmor('plate', null, 'average', { covers: ['head'] })]);
  t.weapons.push(Items.makeWeapon('longsword')); t.wield = t.weapons[0].id;
  const cut = C.attackOptions(a).find((o) => o.motion === 'swing');
  const thrust = C.attackOptions(a).find((o) => o.motion === 'thrust');
  assert.strictEqual(Combat.aimPenalty(cut, 'feet'), 3);
  assert.strictEqual(Combat.aimPenalty(thrust, 'feet'), 2, 'a point is placed more easily');
  assert.strictEqual(Combat.aimPenalty(cut, 'torso'), 0);
  const odds = (o) => Combat.defenseOdds(t, 'parry', o.motion, a, o);
  assert.ok(odds(Object.assign({}, cut, { aim: 'head' })) > odds(cut), 'an aimed blow is easier to parry');
  // The AI goes for what the plate doesn't cover.
  const aim = B.AI.bestAim(a, t, cut, 1);
  assert.ok(aim && aim.loc && !['torso', 'head'].includes(aim.loc), JSON.stringify(aim));
  assert.ok(aim.ratio > 1);
  // A full harness: nothing to aim at.
  const full = body('Full', [Items.makeArmor('plate', 'full', 'average')]);
  assert.strictEqual(B.AI.bestAim(a, full, cut, 1), null);
  // A shield makes blows at the torso easier to block, not those at the legs.
  t.shield = Items.makeShield('round', 'wood'); t.weapons = []; t.wield = null;
  const blk = (loc) => Combat.defenseOdds(t, 'block', cut.motion, a, Object.assign({}, cut, { aim: loc }));
  assert.ok(blk('torso') > blk('legs') - 0.11 && blk('torso') >= blk('legs'));
});

test('aimed blows: a declared location goes where it is aimed, with no location roll', async () => {
  const a = armed('A', 'longsword');
  const t = body('Helmed', [Items.makeArmor('plate', null, 'average', { covers: ['head'] })]);
  const chars = { [a.id]: a, [t.id]: t };
  const enc = Combat.createEncounter('t', [a.id, t.id], chars, 4, 1);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[t.id] = { x: 1, y: 0 };
  await Combat.startRound(enc, chars, roller([10, 1]));
  const cut = C.attackOptions(a).find((o) => o.motion === 'swing');
  const asked = [];
  const err = await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: cut, target: t.id, location: 'legs' }, { roller: roller([], 5, asked), react: () => null });
  assert.strictEqual(err, null);
  assert.ok(!asked.includes('Hit location'));
  assert.ok(enc.log.some((l) => /on the legs \(bare\)/.test(l.text)), enc.log.map((l) => l.text).join('\n'));
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: cut, target: t.id, location: 'tail' }, { roller: roller(), react: () => null }), 'No such place to aim at');
});
