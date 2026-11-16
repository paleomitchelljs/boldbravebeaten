// Step 8 of docs/PLAN.md (costs now in ticks: step F), standing orders for reactions, the end-of-fight account.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load');
const { Character: C, Combat, Items, Enemies, CONFIG, Orders, Battle, World } = B;
const Clock = require('./clock');

const hero = (name, kit) => {
  const c = C.newCharacter({ name, side: 'party', starterGear: false });
  c.id = name;
  if (kit) kit(c);
  c.stamina = C.maxStamina(c);
  return c;
};
const armed = (c, type) => { const w = Items.makeWeapon(type); c.weapons.push(w); c.wield = w.id; return c; };

test('step F: every cost is a whole number of ticks, never under the floor', () => {
  const world = World.create(World.presetParty(), { log: false });
  const costs = [];
  for (const c of World.party(world)) {
    for (const o of C.attackOptions(c)) costs.push(o.ticks, o.lead);
    for (const k of ['block', 'parry', 'dodge', 'standUp', 'bandage', 'clinch']) { const x = C.actionCost(c, k); costs.push(x.ticks, x.lead); }
    for (const d of [1, 2, 3, 5, 8]) costs.push(C.moveTicks(c, d));
  }
  assert.ok(costs.length > 40);
  for (const t of costs) assert.ok(Number.isInteger(t) && t >= 0, `${t} is a whole tick`);
  for (const c of World.party(world)) for (const o of C.attackOptions(c)) assert.ok(o.ticks >= CONFIG.clock.min && o.lead <= o.ticks);
});

// A defence request as the engine builds it, for a hero (T) meeting a blow from A.
function fixture(mkT, mkA) {
  const a = mkA(), t = mkT();
  a.id = 'A'; t.id = 'T'; a.side = 'enemy';
  const chars = { A: a, T: t };
  const enc = Combat.createEncounter('t', ['A', 'T'], chars, 8, 3);
  enc.pos.A = { x: 1, y: 1 }; enc.pos.T = { x: 2, y: 1 };
  Clock.onClock(enc);
  const option = (motion) => C.attackOptions(a).find((o) => !o.spell && (!motion || o.motion === motion));
  const req = (opt, options) => ({ kind: 'defend', actor: 'T', attacker: 'A', decl: { type: 'strike', actor: 'A', target: 'T', option: opt }, hidden: false, options, ahead: 0 });
  return { a, t, chars, enc, option, req };
}
const OPTS = [{ type: 'block', name: 'Block', ticks: 5, stamina: 2, odds: 0.6 }, { type: 'parry', name: 'Parry', ticks: 5, stamina: 2, odds: 0.5 }, { type: 'dodge', name: 'Dodge', ticks: 5, stamina: 2, odds: 0.4 }];

test('orders: asks only for a blow that could drop the hero, and answers the rest by the orders', () => {
  const f = fixture(() => armed(hero('Tam'), 'longsword'), () => armed(hero('Ash'), 'longsword'));
  const opt = f.option('thrust');
  const fs = Combat.foresee(f.a, f.t, opt, { enc: f.enc, chars: f.chars, distance: 1 });
  assert.ok(fs && fs.hit.drop >= 0, 'the engine gives the odds');
  // Make the threshold sit just above and just below this blow's drop chance.
  Orders.set(f.t, 'drop', 0.5);
  f.t.orders.drop = fs.hit.drop + 0.01;
  const calm = Orders.decide(f.enc, f.chars, f.req(opt, OPTS));
  assert.equal(calm.ask, undefined, 'under the threshold: no prompt');
  f.t.orders.drop = Math.max(0, fs.hit.drop - 0.01);
  if (fs.hit.drop > 0.01) assert.equal(Orders.decide(f.enc, f.chars, f.req(opt, OPTS)).ask, true, 'over it: asked');
  // Never asking answers even a dangerous blow by the orders.
  f.t.orders.drop = 0; f.t.orders.ask = 'never';
  assert.equal(Orders.decide(f.enc, f.chars, f.req(opt, OPTS)).ask, undefined);
  // Every time asks always.
  f.t.orders = { ask: 'every' };
  assert.equal(Orders.decide(f.enc, f.chars, f.req(opt, OPTS)).ask, true);
});

test('orders: which defence the orders pick', () => {
  const f = fixture(() => armed(hero('Tam'), 'longsword'), () => armed(hero('Ash'), 'longsword'));
  const thrust = f.option('thrust');
  const swing = f.option('swing');
  const take = (opt, options, o) => { f.t.orders = Object.assign({ ask: 'never' }, o); return Orders.decide(f.enc, f.chars, f.req(opt, options)); };
  // Unarmored, default orders (parry thrusts, dodge unarmored, block on): the best odds of those allowed. Block (0.6) wins.
  assert.equal(take(thrust, OPTS).answer, 'block');
  assert.equal(take(thrust, OPTS, { block: 'off' }).answer, 'parry', 'a thrust: parry (0.5) over dodge (0.4)');
  assert.equal(take(swing, OPTS, { block: 'off' }).answer, 'dodge', 'a swing is not parried by default; an unarmored hero dodges');
  assert.equal(take(swing, OPTS, { block: 'off', parry: 'all' }).answer, 'parry');
  assert.equal(take(swing, OPTS, { block: 'off', dodge: 'off' }).answer, null, 'nothing allowed: take it');
  // Armored: no dodge under 'unarmored'.
  f.t.armor = Items.makeArmor('mail');
  assert.equal(take(swing, OPTS, { block: 'off' }).answer, null);
  assert.equal(take(swing, OPTS, { block: 'off', dodge: 'always' }).answer, 'dodge');
  // Never a spent defence.
  assert.equal(take(thrust, [Object.assign({}, OPTS[0], { spent: true })]).answer, null);
});

test('orders: the free blow at a foe passing', () => {
  const f = fixture(() => armed(hero('Tam'), 'longsword'), () => armed(hero('Ash'), 'longsword'));
  const options = C.attackOptions(f.t).filter((o) => !o.exposes && !o.spell);
  assert.ok(options.length);
  const req = { kind: 'opportunity', actor: 'T', target: 'A', options, ahead: 0, why: 'leaves' };
  f.t.orders = { opportunity: 'ask' };
  assert.equal(Orders.decide(f.enc, f.chars, req).ask, true);
  f.t.orders = { opportunity: 'off' };
  assert.equal(Orders.decide(f.enc, f.chars, req).answer, null);
  f.t.orders = {};
  const pick = Orders.decide(f.enc, f.chars, req);
  assert.ok(options.includes(pick.answer), 'strikes with one of its options');
  // Foes are never put under orders.
  assert.equal(Orders.decide(f.enc, f.chars, Object.assign({}, req, { actor: 'A', target: 'T' })).ask, true);
});

test('orders: set() keeps to the known choices, describe() reads them back', () => {
  const c = hero('Tam');
  Orders.set(c, 'parry', 'all'); Orders.set(c, 'parry', 'nonsense'); Orders.set(c, 'bogus', 'x');
  assert.deepEqual(c.orders, { parry: 'all' });
  assert.match(Orders.describe(c), /Parry every blow/);
  Orders.reset(c, true);
  assert.equal(Orders.describe(c), 'Asks every time');
  Orders.reset(c, false);
  assert.equal(Orders.of(c).ask, 'matters');
});

test('the end-of-fight account: wounds, stamina, weariness and gear, against what the fight began with', () => {
  const world = World.create(World.presetParty(), { log: false });
  const [a, b] = World.party(world);
  const snap = Battle.snapshot(world);
  a.stamina -= 4; a.weary = (a.weary || 0) + 2;
  C.addWound(a, { place: 'arms', sev: 2, kind: 'cut', bleed: 1, pts: 5 }, null);
  const piece = C.armorPieces(b)[0];
  const loss = piece ? Math.min(3, piece.durability) : 0;
  if (piece) piece.durability -= loss;
  const sum = Battle.summary(world, snap, { [a.id]: { 'left arm': 3.2, torso: 0.2 } });
  const ra = sum.find((r) => r.id === a.id), rb = sum.find((r) => r.id === b.id);
  assert.ok(ra.stamina.was - ra.stamina.now >= 4, 'the four spent');
  assert.equal(ra.weary.now - ra.weary.was, 2);
  assert.deepEqual(ra.wounds.map((x) => [x.place, x.sev, x.bleed, x.fresh]), [['arms', 2, 1, true]]);
  assert.ok(ra.wounds[0].does, 'what it does, in a few words');
  assert.deepEqual(ra.where.map((x) => x.points), [3], 'under half a point is left out');
  assert.equal(ra.state, 'standing');
  if (piece) assert.ok(rb.gear.some((g) => g.was - g.now === loss), 'the worn armor is listed with what it lost');
});

test('the enc.onHit watcher tallies harm to the party by place and passes the blow on to any other observer', () => {
  const world = World.create(World.presetParty(), { log: false });
  const [a] = World.party(world);
  const seen = [];
  const enc = { onHit: (e) => seen.push(e) };
  const tally = Battle.watch(enc, { [a.id]: a, F: { id: 'F', side: 'enemy' } });
  enc.onHit({ target: a, sev: 2, location: 'head' });
  enc.onHit({ target: a, sev: 1.5 });
  enc.onHit({ target: { id: 'F' }, sev: 9, location: 'head' });
  assert.deepEqual(tally[a.id], { head: 2, body: 1.5 });
  assert.equal(seen.length, 3);
});
