// The swing's setting (docs/PLAN.md R8, step 6; CONFIG.sweep): a swung edge or head that drops its target, or passes
// it, carries on into one more foe in reach beside the first, at reduced force, and that foe defends as against any blow.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load');
const { Character: C, Combat, Items, Enemies, AI, CONFIG } = B;

function roller(seed, queue) {
  const rng = Enemies.makeRng(seed || 7);
  const q = (queue || []).slice();
  return async (req) => {
    const out = [];
    for (let i = 0; i < req.count; i++) out.push(q.length ? q.shift() : 1 + Math.floor(rng() * req.sides));
    return out;
  };
}

function body(name, side, weapon) {
  const c = C.newCharacter({ name, side, starterGear: false });
  if (weapon) { const w = Items.makeWeapon(weapon); c.weapons.push(w); c.wield = w.id; }
  c.base.CHA = 1;
  c.stamina = C.maxStamina(c);
  return c;
}

async function field(list) {
  const chars = {};
  for (const [c] of list) chars[c.id] = c;
  const enc = Combat.createEncounter('t', list.map(([c]) => c.id), chars, 10, 5);
  for (const [c, x, y] of list) enc.pos[c.id] = { x, y };
  await Combat.startRound(enc, chars, roller(1, [10].concat(list.slice(1).map(() => 1))));
  return { enc, chars };
}

const swingOf = (c) => C.attackOptions(c).find((o) => o.motion === 'swing' && !o.unarmed);

test('a swing that drops its target carries on into the foe beside it, at half force', async () => {
  const a = body('Axe', 'party', 'battleAxe');
  const t = body('First', 'enemy');
  const b = body('Second', 'enemy');
  const { enc, chars } = await field([[a, 2, 2], [t, 3, 2], [b, 3, 3]]);
  t.stamina = 1; // the blow drops it
  enc.ap[t.id] = 0; enc.ap[b.id] = 0; // nobody can meet it
  const o = swingOf(a);
  assert.ok(Combat.sweeps(o));
  assert.equal(Combat.sweepTarget(enc, chars, a, t, o).id, b.id);
  const before = C.totalDamage(b) + (C.maxStamina(b) - b.stamina);
  await Combat.resolveAction(enc, chars, { actor: a.id, target: t.id, type: 'strike', option: o }, { roller: roller(3) });
  const text = enc.log.map((l) => l.text || l).join('\n');
  assert.match(text, /carries through First into Second/);
  assert.match(text, /\(sweep\) hits Second/);
  assert.ok(C.totalDamage(b) + (C.maxStamina(b) - b.stamina) > before);
});

test('a sweep carries no further, a thrust does not sweep, and off means off', async () => {
  const a = body('Sword', 'party', 'longsword');
  const t = body('First', 'enemy');
  const b = body('Second', 'enemy');
  const c = body('Third', 'enemy');
  const { enc, chars } = await field([[a, 2, 2], [t, 3, 2], [b, 3, 3], [c, 3, 1]]);
  const swing = swingOf(a), thrust = C.attackOptions(a).find((o) => o.motion === 'thrust');
  assert.ok(!Combat.sweeps(thrust));
  assert.ok(!Combat.sweeps(Object.assign({}, swing, { sweep: true })));
  assert.ok(!Combat.sweeps(C.attackOptions(a).find((o) => o.unarmed === 'kick')));
  assert.equal(Combat.sweepForce(swing), CONFIG.sweep.force);
  assert.equal(Combat.sweepForce(Object.assign({}, swing, { motion: 'twoHanded' })), CONFIG.sweep.heavy);
  // Not beside the first: out of it.
  enc.pos[b.id] = { x: 5, y: 4 }; enc.pos[c.id] = { x: 6, y: 1 };
  assert.equal(Combat.sweepTarget(enc, chars, a, t, swing), null);
  const keep = CONFIG.sweep;
  try { CONFIG.sweep = null; assert.ok(!Combat.sweeps(swing)); } finally { CONFIG.sweep = keep; }
});

test('the AI counts what a sweep could add, and nothing with nobody beside the target', async () => {
  const a = body('Axe', 'party', 'battleAxe');
  const t = body('First', 'enemy');
  const b = body('Second', 'enemy');
  const { enc, chars } = await field([[a, 2, 2], [t, 3, 2], [b, 3, 3]]);
  const o = swingOf(a);
  t.stamina = 2; // the blow will likely drop it
  assert.ok(AI.sweepWorth(enc, chars, a, t, o, 1) > 0);
  enc.pos[b.id] = { x: 8, y: 4 };
  assert.equal(AI.sweepWorth(enc, chars, a, t, o, 1), 0);
});
