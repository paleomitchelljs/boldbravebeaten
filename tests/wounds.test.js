// Wounds that weaken (docs/PLAN.md step 3, R4 and R5): a point into a limb takes the limb's attributes, blunt on bare
// skin breaks bone sooner and where it lands, a tireless body takes CON wherever; the AI's expectation matches the dice.
const test = require('node:test');
const assert = require('node:assert');
const B = require('./load');
const { Character: C, Combat, Items, Enemies, CONFIG } = B;
// Blows here land at a fixed force (vigor has its own test).
CONFIG.vigor = null;

function rng(seed) {
  const r = Enemies.makeRng(seed);
  return async (req) => Array.from({ length: req.count }, () => 1 + Math.floor(r() * req.sides));
}
function fixed(queue, fill) {
  const q = queue.slice();
  return async (req) => Array.from({ length: req.count }, () => (q.length ? q.shift() : fill));
}
function armed(type) {
  const c = C.newCharacter({ name: 'A', side: 'party', starterGear: false });
  if (type) { const w = Items.makeWeapon(type, 'average'); c.weapons.push(w); c.wield = w.id; }
  c.stamina = C.maxStamina(c);
  return c;
}
function body(pieces, traits) {
  const c = C.newCharacter({ name: 'T', side: 'enemy', starterGear: false });
  c.base.CON = 40;
  c.armor = null; c.pieces = [];
  for (const p of pieces || []) { if (Items.coversOf(p).includes('torso')) c.armor = p; else c.pieces.push(p); }
  if (traits) c.traits = Object.assign({}, c.traits, traits);
  c.stamina = C.maxStamina(c);
  return c;
}
const enc0 = () => ({ hitThisRound: {}, fortressUsed: {}, log: [], pos: {} });
const opt = (a, motion) => C.attackOptions(a).find((o) => o.motion === motion && !o.power && !o.windUp && !o.halfSword && !o.unarmed);
function harm(t) {
  let con = 0, other = 0;
  for (const k in t.damage) if (k === 'CON') con += t.damage[k]; else other += t.damage[k] || 0;
  return { con, other };
}

// The AI and the preview read computeHit's expectation (expCON, expAttrs: over locations, the gap roll, the wound and
// vital rolls); applyHit rolls them. Over many blows the two agree.
async function compare(name, mk, a, option, n) {
  const t0 = mk();
  const h = Combat.computeHit(a, t0, option, {});
  const roll = rng(4242);
  let con = 0, other = 0, pts = 0;
  for (let i = 0; i < n; i++) {
    const t = mk();
    const r = await Combat.applyHit(enc0(), { [a.id]: a, [t.id]: t }, a, t, option, roll, {});
    const got = harm(t);
    con += got.con; other += got.other;
    pts += r.hit.toCON + (r.hit.pointToAttrs || 0);
  }
  con /= n; other /= n; pts /= n;
  const tol = (x) => 0.06 * Math.max(1, x);
  assert.ok(Math.abs(con - h.expCON) < tol(h.expCON), `${name}: CON ${con.toFixed(3)} rolled, ${h.expCON.toFixed(3)} expected`);
  assert.ok(Math.abs(other - h.expAttrs) < tol(h.expAttrs), `${name}: other attributes ${other.toFixed(3)} rolled, ${h.expAttrs.toFixed(3)} expected`);
  return { h, con, other, pts };
}

test('wounds: the expectation the AI sees matches applyHit on average (points, gaps, crushes, the aim)', async () => {
  const sword = armed('longsword');
  const thrust = opt(sword, 'thrust');
  const bare = await compare('thrust, bare', () => body(), sword, thrust, 4000);
  assert.ok(bare.h.pointToAttrs > 0 && bare.h.expAttrs > 0, 'some of a bare thrust goes to limbs');
  await compare('thrust, padded half', () => body([Items.makeArmor('padded', 'half', 'average')]), sword, thrust, 4000);
  await compare('thrust, mail', () => body([Items.makeArmor('mail', 'full', 'average')]), sword, thrust, 4000);
  await compare('thrust aimed at the legs', () => body(), sword, Object.assign({}, thrust, { aim: 'legs' }), 4000);
  const hammer = armed('warhammer');
  const crush = await compare('warhammer, bare', () => body(), hammer, opt(hammer, 'swing'), 4000);
  assert.ok(crush.h.crushToAttrs > 0, 'a hammer on bare skin breaks bone');
  await compare('warhammer, padded', () => body([Items.makeArmor('padded', 'full', 'average')]), hammer, opt(hammer, 'swing'), 3000);
  await compare('thrust, a tireless body', () => body(null, { tireless: true }), sword, thrust, 2000);
});

test('R4: a point into a limb takes its attributes unless the wound roll is vital; head and torso take CON', async () => {
  const a = armed('longsword');
  const thrust = opt(a, 'thrust');
  const at = (loc) => Combat.computeHit(a, body(), thrust, { location: loc });
  assert.ok(at('torso').toCON > 0 && !at('torso').pointToAttrs);
  assert.ok(at('head').toCON > 0 && !at('head').pointToAttrs);
  const leg = at('legs');
  assert.strictEqual(leg.toCON, 0);
  assert.ok(leg.pointToAttrs > 0);
  // Rolled: the location (d100 80 is the legs), then the wound roll (10: not vital), then each point d2 (SPD, CON).
  let t = body();
  const r = await Combat.applyHit(enc0(), { [a.id]: a, [t.id]: t }, a, t, thrust, fixed([80, 10], 1), {});
  assert.strictEqual(r.hit.location, 'legs');
  assert.strictEqual(t.damage.SPD, leg.pointToAttrs, r.text);
  assert.ok(!t.damage.CON, r.text);
  assert.ok(t.bleeds.length, 'it still bleeds');
  // A vital roll sends it to CON × the vital multiplier.
  t = body();
  await Combat.applyHit(enc0(), { [a.id]: a, [t.id]: t }, a, t, thrust, fixed([80, 1], 1), {});
  assert.strictEqual(t.damage.CON, leg.pointToAttrs * CONFIG.vital.mult);
  // Off (pointToCON null): CON wherever.
  const W = CONFIG.locations.wounds.pointToCON;
  CONFIG.locations.wounds.pointToCON = null;
  try { assert.strictEqual(at('legs').toCON, leg.pointToAttrs); } finally { CONFIG.locations.wounds.pointToCON = W; }
});

test('R5: blunt on a bare location crushes from crushBare and takes the location\'s attributes', () => {
  const I = CONFIG.impact;
  const a = armed();
  const club = { kind: 'strike', motion: 'swing', damage: [0, 0, I.crushBare + 2 * I.crushPer], label: 'club' };
  const bare = Combat.computeHit(a, body(), club, { location: 'arms' });
  assert.strictEqual(bare.crushToAttrs, 2);
  assert.strictEqual(bare.bluntToCON, 0);
  // Under armor the old threshold.
  const padded = Combat.computeHit(a, body([Items.makeArmor('padded', 'full', 'average')]), club, { location: 'arms' });
  assert.strictEqual(padded.crushToAttrs + padded.bluntToCON, 0);
  // An untrained punch takes stamina only.
  const punch = Combat.computeHit(a, body(), Object.assign({}, club, { staminaOnly: true }), { location: 'arms' });
  assert.strictEqual(punch.crushToAttrs + punch.bluntToCON, 0);
});

test('tireless bodies take CON wherever a wound lands; what they resist is unchanged', () => {
  const a = armed('longsword');
  const golem = body(null, { tireless: true });
  const cut = Combat.computeHit(a, golem, opt(a, 'swing'), { location: 'legs' });
  assert.ok(cut.slashToAttrs > 0 && Math.abs(cut.expCON - cut.slashToAttrs - cut.bluntToCON) < 1e-9 && cut.expAttrs === 0);
  const pt = Combat.computeHit(a, golem, opt(a, 'thrust'), { location: 'arms' });
  assert.ok(pt.toCON > 0 && !pt.pointToAttrs);
  const bone = body(null, { tireless: true, resist: { P: 0 } });
  assert.strictEqual(Combat.computeHit(a, bone, opt(a, 'thrust'), { location: 'torso' }).toCON, 0, 'a point does nothing to bone');
});

test('maximum stamina reads current attributes; a condition that lowers it clamps current stamina', () => {
  const c = body();
  const full = C.maxStamina(c);
  c.stamina = full;
  C.damageAttr(c, 'STR', 2);
  assert.strictEqual(C.maxStamina(c), full - 2 * CONFIG.staminaWeights.STR);
  assert.ok(c.stamina <= C.maxStamina(c));
  const key = Object.keys(CONFIG.conditions).find((k) => CONFIG.conditions[k].attrs && Object.values(CONFIG.conditions[k].attrs).some((v) => v < 0) && Object.keys(CONFIG.conditions[k].attrs).some((x) => CONFIG.staminaWeights[x]));
  assert.ok(key, 'a condition that lowers an attribute');
  c.stamina = C.maxStamina(c);
  B.Conditions.add(c, key, { rounds: 2 });
  assert.ok(c.stamina <= C.maxStamina(c) && C.maxStamina(c) < full - 2, 'clamped');
  const low = c.stamina;
  B.Conditions.remove(c, key);
  assert.strictEqual(c.stamina, low, 'not raised when it ends');
});
