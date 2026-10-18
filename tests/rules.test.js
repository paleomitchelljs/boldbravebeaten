const test = require('node:test');
const assert = require('node:assert');
const B = require('./load');
const { Character: C, Combat, Items, Enemies, Recovery, AI } = B;

// Deterministic roller: returns queued values, then falls back to a seeded RNG.
function roller(seed, queue) {
  const rng = Enemies.makeRng(seed || 7);
  const q = (queue || []).slice();
  return async (req) => {
    const out = [];
    for (let i = 0; i < req.count; i++) out.push(q.length ? q.shift() : 1 + Math.floor(rng() * req.sides));
    return out;
  };
}

// Run fn with the numbers exactly as Specifics writes them (before simulation tuning).
function asWritten(fn) {
  const C0 = B.CONFIG;
  const saved = { apScale: C0.apScale, staminaScale: C0.staminaScale, pierceMode: C0.pierceMode, passThroughByArmor: C0.passThroughByArmor, moveScale: C0.moveScale, armorAdjust: C0.armorAdjust, standUp: C0.standUp, grappling: C0.grappling, weaponModel: C0.weaponModel };
  Object.assign(C0, { apScale: 1, staminaScale: 1, pierceMode: 'floor', passThroughByArmor: null, moveScale: 1, armorAdjust: {}, standUp: null, grappling: null, weaponModel: 'table' });
  let out;
  try { out = fn(); } catch (e) { Object.assign(C0, saved); throw e; }
  if (out && typeof out.then === 'function') return out.finally(() => Object.assign(C0, saved));
  Object.assign(C0, saved);
  return out;
}

// The hand-set weapon tables of rounds 1–8 (the Specifics numbers), everything else as tuned.
function tableWeapons(fn) {
  const saved = B.CONFIG.weaponModel;
  B.CONFIG.weaponModel = 'table';
  let out;
  try { out = fn(); } catch (e) { B.CONFIG.weaponModel = saved; throw e; }
  if (out && typeof out.then === 'function') return out.finally(() => { B.CONFIG.weaponModel = saved; });
  B.CONFIG.weaponModel = saved;
  return out;
}

function fighter(name, opts) {
  const c = C.newCharacter({ name, side: opts && opts.side, starterGear: false });
  return c;
}

test('derived stats for an average starting character', () => asWritten(() => {
  const c = fighter('Avg');
  assert.strictEqual(C.maxStamina(c), 4 * 5 + 5 + 5 + 5);
  assert.strictEqual(C.apPool(c), 3 + 2);
  assert.strictEqual(C.squaresPerAP(c), 1 + 1);
  assert.strictEqual(C.regen(c), 2, 'CON 5, WIL 5 regenerates 2 unarmored');
  c.armor = Items.makeArmor('plate', 'full', 'standard');
  assert.strictEqual(C.combatAttr(c, 'SPD'), 2);
  assert.strictEqual(C.apPool(c), 4);
  assert.strictEqual(C.regen(c), -2, 'heavy armor regen can go negative');
}));

test('AP scale doubles pools and base costs but feats still cut a flat 1', () => {
  const S = B.CONFIG.apScale;
  const c = fighter('Scaled');
  c.weapons.push(Items.makeWeapon('rapier'));
  c.wield = c.weapons[0].id;
  assert.strictEqual(C.apPool(c), 5 * S);
  const thrust = () => C.attackOptions(c).find((o) => o.motion === 'thrust');
  assert.strictEqual(thrust().ap, 2 * S);
  c.feats.quick_thrust = 1;
  assert.strictEqual(thrust().ap, 2 * S - 1);
});

test('fatigue lowers the AP pool', () => {
  const S = B.CONFIG.apScale;
  const c = fighter('Tired');
  const max = C.maxStamina(c);
  c.stamina = Math.floor(max * 0.49);
  assert.strictEqual(C.apPool(c), 4 * S);
  c.stamina = Math.floor(max * 0.24);
  assert.strictEqual(C.apPool(c), 3 * S);
});

test('Specifics worked example: longsword swing vs mail = 1 stamina', () => tableWeapons(() => {
  const atk = fighter('Swordsman');
  atk.weapons.push(Items.makeWeapon('longsword'));
  atk.wield = atk.weapons[0].id;
  const tgt = fighter('Mailed');
  tgt.armor = Items.makeArmor('mail', 'full', 'standard');
  const swing = C.attackOptions(atk).find((o) => o.motion === 'swing' && o.face === 'edge');
  assert.deepStrictEqual(swing.damage, [0, 7, 1]);
  const h = Combat.computeHit(atk, tgt, swing);
  assert.strictEqual(h.converted, 1);
  assert.strictEqual(h.bluntToStamina, 1);
  assert.strictEqual(h.toCON, 0);
}));

test('Specifics worked example: same swing unarmored = 7 slashing + 7 CON of bleed', () => tableWeapons(async () => {
  const enc = { hitThisRound: {}, fortressUsed: {} };
  const atk = fighter('Swordsman');
  atk.weapons.push(Items.makeWeapon('longsword'));
  atk.wield = atk.weapons[0].id;
  const tgt = fighter('Naked');
  tgt.base.CON = 10; // survive the bleed so we can measure it
  tgt.stamina = C.maxStamina(tgt);
  const swing = C.attackOptions(atk).find((o) => o.motion === 'swing' && o.face === 'edge');
  // d4s: 1,1,3,3,4,4,4 → 2 STR, 2 SPD, 3 DEX (no CON so we can isolate bleed)
  await Combat.applyHit(enc, { [atk.id]: atk, [tgt.id]: tgt }, atk, tgt, swing, roller(1, [1, 1, 3, 3, 4, 4, 4]));
  assert.strictEqual(tgt.damage.STR, 2);
  assert.strictEqual(tgt.damage.SPD, 2);
  assert.strictEqual(tgt.damage.DEX, 3);
  assert.strictEqual(tgt.bleeds.length, 1);
  const chars = { [tgt.id]: tgt };
  const e = { ids: [tgt.id], hitThisRound: { [tgt.id]: 1 }, log: [], round: 1 };
  for (let i = 0; i < 3; i++) Combat.endRound(e, chars);
  assert.strictEqual(tgt.damage.CON, 7, 'an untreated cut costs its damage again in CON');
}));

test('losing an attribute lowers max and current stamina', () => {
  const c = fighter('Hurt');
  c.stamina = 30;
  C.damageAttr(c, 'CON', 1);
  assert.strictEqual(C.maxStamina(c), 31);
  assert.strictEqual(c.stamina, 26);
});

test('plate stops a thrust; a half-sword thrust finds the gaps', () => asWritten(() => {
  const atk = fighter('Knight');
  atk.weapons.push(Items.makeWeapon('longsword'));
  atk.wield = atk.weapons[0].id;
  atk.feats.half_swording = 1;
  const tgt = fighter('Plated');
  tgt.armor = Items.makeArmor('plate', 'full', 'standard');
  const opts = C.attackOptions(atk);
  const thrust = opts.find((o) => o.motion === 'thrust' && !o.halfSword);
  const half = opts.find((o) => o.halfSword);
  assert.strictEqual(half.ap, thrust.ap + 1);
  assert.strictEqual(Combat.computeHit(atk, tgt, thrust).toCON, 0, '(5−4)×0.5 rounds down to 0');
  tgt.armor = Items.makeArmor('plate', 'full', 'crude'); // mitigation 3
  assert.strictEqual(Combat.computeHit(atk, tgt, half).toCON, 2);
}));

test('roll mode: each leftover piercing point has a chance to reach CON', async () => {
  const atk = fighter('Stabber');
  atk.weapons.push(Items.makeWeapon('rapier'));
  atk.wield = atk.weapons[0].id;
  const tgt = fighter('Mailed');
  tgt.armor = Items.makeArmor('mail', 'full', 'standard'); // P mitigation 1, pass-through 0.5
  const thrust = C.attackOptions(atk).find((o) => o.motion === 'thrust');
  const h = Combat.computeHit(atk, tgt, thrust);
  assert.strictEqual(h.pierceLeft, 5);
  assert.strictEqual(h.toCON, 2.5, 'expectation used by the AI');
  const enc = { hitThisRound: {}, fortressUsed: {} };
  // d10s 1,5,6,9,10 → two of five are ≤ 5
  await Combat.applyHit(enc, { [atk.id]: atk, [tgt.id]: tgt }, atk, tgt, thrust, roller(1, [1, 5, 6, 9, 10]));
  assert.strictEqual(tgt.damage.CON, 2);
});

test('feat tiers and prerequisites', () => {
  const c = fighter('Learner');
  c.level = 10;
  assert.strictEqual(C.canTakeFeat(c, 'quick_parry').ok, false);
  C.addFeat(c, 'parry_training');
  assert.strictEqual(C.canTakeFeat(c, 'quick_parry').ok, false, 'apprentice tier needs 2 feats in the tree');
  C.addFeat(c, 'quick_thrust');
  assert.strictEqual(C.canTakeFeat(c, 'quick_parry').ok, true);
  assert.strictEqual(C.canTakeFeat(c, 'iron_stance').ok, false);
  assert.strictEqual(C.canRemoveFeat(c, 'parry_training').ok, true, 'nothing depends on it yet');
  C.addFeat(c, 'quick_parry');
  assert.strictEqual(C.canRemoveFeat(c, 'parry_training').ok, false);
});

test('two-handed swings are unavailable while carrying a shield', () => {
  const c = fighter('Shielded');
  c.weapons.push(Items.makeWeapon('longsword'));
  c.wield = c.weapons[0].id;
  assert.ok(C.attackOptions(c).some((o) => o.motion === 'twoHanded'));
  c.shield = Items.makeShield('round', 'wood');
  assert.ok(!C.attackOptions(c).some((o) => o.motion === 'twoHanded'));
});

test('a pass: turns in initiative order, the per-pass cap, then resolution', async () => {
  const a = fighter('A', { side: 'party' });
  const b = fighter('B', { side: 'enemy' });
  a.base.SPD = 8;
  for (const c of [a, b]) {
    c.weapons.push(Items.makeWeapon('dagger'));
    c.wield = c.weapons[0].id;
    c.stamina = C.maxStamina(c);
  }
  const chars = { [a.id]: a, [b.id]: b };
  const enc = Combat.createEncounter('t', [a.id, b.id], chars, 4, 3);
  enc.pos[a.id] = { x: 1, y: 1 };
  enc.pos[b.id] = { x: 2, y: 1 };
  await Combat.startRound(enc, chars, roller(3, [5, 5]));
  assert.strictEqual(enc.pass, 1);
  assert.strictEqual(Combat.currentActor(enc), a.id);
  assert.strictEqual(Combat.passCap(), B.CONFIG.apPerPass * B.CONFIG.apScale);
  const thrust = C.attackOptions(a).find((o) => o.motion === 'thrust');
  assert.strictEqual(thrust.ap, 2 * B.CONFIG.apScale - 1, 'dagger thrust is 1 AP below a normal thrust');
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'strike', option: thrust, target: b.id }), null);
  // 1 AP is left in this pass, so it is still A's turn until A ends it.
  assert.strictEqual(Combat.currentActor(enc), a.id);
  assert.strictEqual(Combat.passLeft(enc, a.id), Combat.passCap() - thrust.ap);
  Combat.endTurn(enc, a.id);
  assert.strictEqual(Combat.currentActor(enc), b.id);
  const la = Combat.legalActions(enc, chars, b.id);
  assert.strictEqual(la.incoming.length, 1, 'B sees the thrust coming');
  assert.strictEqual(Combat.declare(enc, chars, { actor: b.id, type: 'parry' }), null);
  assert.strictEqual(enc.phase, 'resolve', 'B spent the pass; it resolves');
  await Combat.resolvePass(enc, chars, roller(3, [10]));
  assert.ok(enc.log.some((l) => /parries/.test(l.text)));
  assert.strictEqual(enc.pass, 2, 'both still have AP, so a second pass begins');
  assert.strictEqual(enc.phase, 'declare');
  Combat.concede(enc, a.id);
  Combat.concede(enc, b.id);
  await Combat.resolveRound(enc, chars, roller(3));
  assert.strictEqual(enc.phase, 'roundEnd');
});

test('an action costing more than the pass allows lands in a later pass and can be answered then', async () => {
  const a = fighter('A', { side: 'party' });
  const b = fighter('B', { side: 'enemy' });
  a.base.SPD = 8;
  a.weapons.push(Items.makeWeapon('longsword'));
  a.wield = a.weapons[0].id;
  b.weapons.push(Items.makeWeapon('longsword'));
  b.wield = b.weapons[0].id;
  for (const c of [a, b]) c.stamina = C.maxStamina(c);
  const chars = { [a.id]: a, [b.id]: b };
  const enc = Combat.createEncounter('t', [a.id, b.id], chars, 6, 1);
  enc.pos[a.id] = { x: 0, y: 0 };
  enc.pos[b.id] = { x: 2, y: 0 };
  await Combat.startRound(enc, chars, roller(3, [5, 5]));
  const swing = Combat.legalActions(enc, chars, a.id).attacks.find((o) => o.motion === 'swing');
  assert.ok(swing.ap > Combat.passCap() && swing.spans);
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'strike', option: swing, target: b.id }), null);
  const d = enc.decls[0];
  assert.strictEqual(d.pass, 2, 'a 6-AP swing under a 4-AP cap lands in pass 2');
  assert.notStrictEqual(Combat.currentActor(enc), a.id, 'the swing used all of pass 1');
  let la = Combat.legalActions(enc, chars, b.id);
  assert.strictEqual(la.incoming.length, 0, 'nothing lands this pass');
  assert.strictEqual(la.incomingLater.length, 1, 'but the swing is visible');
  Combat.endTurn(enc, b.id);
  await Combat.resolvePass(enc, chars, roller(3));
  assert.strictEqual(enc.pass, 2);
  assert.strictEqual(Combat.passLeft(enc, a.id), 2 * Combat.passCap() - swing.ap);
  Combat.endTurn(enc, a.id);
  la = Combat.legalActions(enc, chars, b.id);
  assert.strictEqual(la.incoming.length, 1, 'it lands this pass, so a guard now meets it');
});

test('guards: a general guard meets the next attack, a named one only that attacker', () => tableWeapons(async () => {
  const a = armed('A', 'dagger', { side: 'party' });
  const b = armed('B', 'dagger', { side: 'party' });
  const t = armed('T', 'longsword', { side: 'enemy' });
  a.base.SPD = 9; b.base.SPD = 8; t.base.SPD = 1;
  t.base.CON = 12;
  for (const c of [a, b, t]) c.stamina = C.maxStamina(c);
  const chars = { [a.id]: a, [b.id]: b, [t.id]: t };
  const enc = Combat.createEncounter('t', [a.id, b.id, t.id], chars, 4, 3);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[b.id] = { x: 0, y: 2 }; enc.pos[t.id] = { x: 1, y: 1 };
  await Combat.startRound(enc, chars, roller(3, [5, 5, 5]));
  for (const x of [a, b]) {
    const th = Combat.legalActions(enc, chars, x.id).attacks.find((o) => o.motion === 'thrust');
    assert.strictEqual(Combat.declare(enc, chars, { actor: x.id, type: 'strike', option: th, target: t.id }), null);
    Combat.endTurn(enc, x.id);
  }
  assert.strictEqual(Combat.currentActor(enc), t.id);
  // A guard aimed at B: A's thrust (first to land) gets through, B's meets the parry.
  assert.strictEqual(Combat.declare(enc, chars, { actor: t.id, type: 'parry', against: b.id }), null);
  await Combat.resolvePass(enc, chars, roller(4, [10]));
  const text = enc.log.map((l) => l.text).join('\n');
  assert.match(text, /A's Thrust \(point\) hits T/);
  assert.match(text, /T parries B's Thrust/);
}));

test('Feint hides an attack from a defender without Read Attack', async () => {
  const a = fighter('Feinter', { side: 'party' });
  const b = fighter('Mark', { side: 'enemy' });
  a.feats.feint = 1;
  a.weapons.push(Items.makeWeapon('dagger'));
  a.wield = a.weapons[0].id;
  const chars = { [a.id]: a, [b.id]: b };
  const enc = Combat.createEncounter('t', [a.id, b.id], chars, 4, 3);
  const d = { actor: a.id, type: 'strike', option: C.attackOptions(a)[0], target: b.id, ap: 1 };
  assert.ok(Combat.describeDecl(enc, chars, d, b.id).hidden);
  b.feats.read_attack = 1;
  assert.ok(!Combat.describeDecl(enc, chars, d, b.id).hidden);
});

test('long rest restores stamina and rolls healing', async () => {
  const c = fighter('Patient');
  c.damage.CON = 2;
  c.stamina = 3;
  const lines = await Recovery.longRest(c, {}, roller(1, [5]));
  assert.strictEqual(c.damage.CON, 1);
  assert.strictEqual(c.stamina, C.maxStamina(c));
  assert.ok(lines.some((l) => /\+1 CON/.test(l)));
});

test('generated enemies are legal characters', () => {
  for (const t of Object.keys(Enemies.TEMPLATES)) {
    for (const lvl of [1, 4, 8]) {
      const e = Enemies.generate(t, lvl, { seed: lvl * 31 + t.length });
      assert.ok(C.featCount(e) <= C.featBudget(e), `${t} L${lvl} feat budget`);
      assert.ok(C.maxStamina(e) > 0);
      assert.ok(C.attackOptions(e).length > 0, `${t} L${lvl} has an attack`);
    }
  }
});

test('AI-vs-AI encounters always finish without errors', async () => {
  const templates = Object.keys(Enemies.TEMPLATES);
  let finished = 0, rounds = 0;
  for (let i = 0; i < 120; i++) {
    const rng = Enemies.makeRng(1000 + i);
    const a = Enemies.generate(templates[i % templates.length], 1 + (i % 6), { seed: i * 7 + 1 });
    const b = Enemies.generate(templates[(i * 3 + 1) % templates.length], 1 + ((i * 5) % 6), { seed: i * 13 + 2 });
    const c2 = Enemies.generate(templates[(i * 5 + 2) % templates.length], 1, { seed: i * 17 + 3 });
    a.side = 'party';
    const ids = i % 3 === 0 ? [a.id, b.id, c2.id] : [a.id, b.id];
    const chars = { [a.id]: a, [b.id]: b, [c2.id]: c2 };
    const enc = Combat.createEncounter('sim', ids, chars, 8, 6);
    const roll = roller(i + 5);
    while (enc.phase !== 'over' && enc.round < 60) {
      await Combat.startRound(enc, chars, roll);
      let guard = 1000;
      while ((enc.phase === 'declare' || enc.phase === 'resolve') && guard-- > 0) {
        if (enc.phase === 'resolve') { await Combat.resolvePass(enc, chars, roll); continue; }
        const id = Combat.currentActor(enc);
        Combat.submit(enc, chars, AI.choose(enc, chars, id, rng));
      }
      assert.ok(guard > 0, 'round loop terminates');
    }
    rounds += enc.round;
    if (enc.phase === 'over') finished++;
    for (const id of ids) {
      const c = chars[id];
      assert.ok(c.stamina >= 0 && Number.isFinite(c.stamina), 'stamina stays a finite non-negative number');
    }
  }
  assert.ok(finished >= 110, `most fights end (finished ${finished}/120, avg ${(rounds / 120).toFixed(1)} rounds)`);
});

// ---- Range bands, wind-up, archery, magic --------------------------------

function armed(name, type, opts) {
  const c = fighter(name, opts);
  const w = Items.makeWeapon(type);
  c.weapons.push(w);
  c.wield = w.id;
  c.stamina = C.maxStamina(c);
  return c;
}

const opt = (c, pred) => C.attackOptions(c).find(pred);

test('range bands: inside a long weapon\'s reach its blows land half as hard, all blunt', () => tableWeapons(() => {
  const spear = opt(armed('S', 'spear'), (o) => o.motion === 'thrust');
  assert.deepStrictEqual([spear.minRange, spear.maxRange, spear.closePenalty], [1, 4, true], 'a spear can jab with the shaft');
  const dagger = opt(armed('D', 'dagger'), (o) => o.motion === 'thrust');
  assert.deepStrictEqual([dagger.minRange, dagger.maxRange, dagger.closePenalty], [1, 1, false]);
  const rapier = opt(armed('R', 'rapier'), (o) => o.motion === 'thrust');
  assert.deepStrictEqual([rapier.minRange, rapier.maxRange], [1, 3]);
  const mace = opt(armed('M', 'flangedMace'), (o) => o.motion === 'swing');
  assert.strictEqual(mace.closePenalty, false, 'short hafted weapons work fully up close');
  const a = armed('L', 'longsword');
  const t = fighter('T');
  const swing = opt(a, (o) => o.motion === 'swing' && o.face === 'edge');
  assert.deepStrictEqual(Combat.computeHit(a, t, swing, { distance: 2 }).vec, [0, 7, 1]);
  assert.deepStrictEqual(Combat.computeHit(a, t, swing, { distance: 1 }).vec, [0, 0, 4], '8 force → 4 blunt');
  const bow = opt(armed('B', 'shortbow'), (o) => o.motion === 'shoot');
  assert.strictEqual(bow.minRange, 2, 'bows still need range 2');
}));

test('weapons in hand: drop is free, a draw is cheap and drops what you hold', async () => {
  const a = armed('A', 'longsword', { side: 'party' });
  const d = Items.makeWeapon('dagger');
  a.weapons.push(d);
  a.sidearm = d.id;
  const b = armed('B', 'longsword', { side: 'enemy' });
  const chars = { [a.id]: a, [b.id]: b };
  const enc = Combat.createEncounter('t', [a.id, b.id], chars, 6, 1);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[b.id] = { x: 3, y: 0 };
  a.base.SPD = 9;
  await Combat.startRound(enc, chars, roller(1, [10, 1]));
  const la = Combat.legalActions(enc, chars, a.id);
  assert.strictEqual(la.other.find((o) => o.type === 'dropWeapon').ap, 0);
  const draw = la.other.find((o) => o.type === 'drawSidearm');
  assert.strictEqual(draw.ap, Math.max(1, Math.round(0.5 * B.CONFIG.apScale)));
  assert.match(draw.note, /drops/);
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'drawSidearm' }), null);
  assert.ok(Combat.legalActions(enc, chars, a.id).attacks.some((o) => o.weaponType === 'dagger'), 'plans with the dagger');
  Combat.concede(enc, a.id); Combat.concede(enc, b.id);
  await Combat.resolveRound(enc, chars, roller(2));
  assert.strictEqual(C.wieldedWeapon(a).type, 'dagger');
  assert.deepStrictEqual(a.status.dropped, [a.weapons[0].id], 'the longsword is on the ground');
  Combat.cleanup(enc, chars);
  assert.deepStrictEqual(a.status.dropped, []);
});

test('held in a grapple, even a dagger fights cramped', () => {
  const a = armed('A', 'dagger');
  const t = fighter('T');
  const th = opt(a, (o) => o.motion === 'thrust');
  const free = Combat.computeHit(a, t, th, { distance: 1 }).vec;
  a.status.grappledBy = [t.id];
  const held = Combat.computeHit(a, t, th, { distance: 1 }).vec;
  assert.ok(free[0] > 0);
  assert.deepStrictEqual(held, [0, 0, Math.floor(free[0] / 2)]);
});

test('the older half-damage-up-close rule is still available as an option', () => tableWeapons(() => {
  const saved = B.CONFIG.range.closeRule;
  B.CONFIG.range.closeRule = 'half';
  try {
    const a = armed('L', 'longsword');
    const t = fighter('T');
    const swing = opt(a, (o) => o.motion === 'swing' && o.face === 'edge');
    assert.strictEqual(swing.minRange, 1);
    assert.strictEqual(Combat.computeHit(a, t, swing, { distance: 2 }).S, 7);
    assert.strictEqual(Combat.computeHit(a, t, swing, { distance: 1 }).S, 3);
  } finally {
    B.CONFIG.range.closeRule = saved;
  }
}));

async function duel(a, b, seedQueue) {
  a.side = 'party'; b.side = 'enemy';
  const chars = { [a.id]: a, [b.id]: b };
  const enc = Combat.createEncounter('t', [a.id, b.id], chars, 6, 1);
  enc.pos[a.id] = { x: 0, y: 0 };
  enc.pos[b.id] = { x: 2, y: 0 };
  await Combat.startRound(enc, chars, roller(1, seedQueue || [10, 1]));
  return { enc, chars };
}

test('a power swing must be wound up the round before, and the swinger is exposed', () => tableWeapons(async () => {
  const a = armed('Heavy', 'greatsword');
  a.feats.power_swing = 1;
  a.base.CON = 10; // survive the foe's thrust so the wind-up isn't lost
  a.stamina = C.maxStamina(a);
  const b = armed('Foe', 'longsword');
  b.shield = null;
  const { enc, chars } = await duel(a, b);
  assert.strictEqual(Combat.currentActor(enc), a.id);
  let la = Combat.legalActions(enc, chars, a.id);
  const power = la.attacks.find((o) => o.motion === 'power');
  assert.strictEqual(power.why, 'Wind up first');
  const wind = la.other.find((o) => o.type === 'windUp');
  assert.ok(wind, 'wind-up offered');
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'windUp', option: wind.option }), null);
  la = Combat.legalActions(enc, chars, a.id);
  assert.strictEqual(la.attacks.find((o) => o.motion === 'power').why, 'Release next round');
  // Foe strikes; the winding heavy can't parry it.
  assert.strictEqual(Combat.currentActor(enc), b.id);
  const thrust = Combat.legalActions(enc, chars, b.id).attacks.find((o) => o.motion === 'thrust');
  assert.strictEqual(Combat.declare(enc, chars, { actor: b.id, type: 'strike', option: thrust, target: a.id }), null);
  la = Combat.legalActions(enc, chars, a.id);
  assert.strictEqual(la.defenses.find((o) => o.type === 'parry').why, 'Winding up');
  Combat.concede(enc, a.id);
  Combat.concede(enc, b.id);
  await Combat.resolveRound(enc, chars, roller(2));
  assert.ok(a.status.windUp, 'wound up after resolution');
  await Combat.startRound(enc, chars, roller(3, [10, 1]));
  la = Combat.legalActions(enc, chars, a.id);
  const ready = la.attacks.find((o) => o.motion === 'power');
  assert.strictEqual(ready.why, null);
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'strike', option: ready, target: b.id }), null);
}));

test('an unreleased wind-up is lost at the end of the next round', async () => {
  const a = armed('Heavy', 'greatsword');
  a.feats.power_swing = 1;
  const b = armed('Foe', 'longsword');
  const { enc, chars } = await duel(a, b);
  const wind = Combat.legalActions(enc, chars, a.id).other.find((o) => o.type === 'windUp');
  Combat.declare(enc, chars, { actor: a.id, type: 'windUp', option: wind.option });
  Combat.concede(enc, b.id);
  Combat.concede(enc, a.id);
  await Combat.resolveRound(enc, chars, roller(2));
  await Combat.startRound(enc, chars, roller(3, [10, 1]));
  Combat.concede(enc, a.id);
  Combat.concede(enc, b.id);
  await Combat.resolveRound(enc, chars, roller(4));
  assert.strictEqual(a.status.windUp, null);
});

test('arrows: range 2+, use ammunition, cannot be parried', async () => {
  const a = armed('Archer', 'shortbow');
  a.inventory.arrows = 1;
  const shot = opt(a, (o) => o.motion === 'shoot');
  assert.deepStrictEqual([shot.minRange, shot.maxRange, shot.ranged], [2, 12, true]);
  const b = armed('Foe', 'longsword');
  const { enc, chars } = await duel(a, b);
  const la = Combat.legalActions(enc, chars, a.id);
  const s = la.attacks.find((o) => o.motion === 'shoot');
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'strike', option: s, target: b.id }), null);
  const lands = enc.decls[0].pass;
  while (enc.pass < lands) {
    Combat.endTurn(enc, Combat.currentActor(enc));
    if (enc.phase === 'resolve') await Combat.resolvePass(enc, chars, roller(2));
  }
  if (Combat.currentActor(enc) === a.id) Combat.endTurn(enc, a.id);
  // A parry guard can't meet the arrow; it stays up and the arrow lands.
  assert.strictEqual(Combat.declare(enc, chars, { actor: b.id, type: 'parry' }), null);
  Combat.concede(enc, b.id);
  Combat.concede(enc, a.id);
  await Combat.resolveRound(enc, chars, roller(2));
  assert.ok(enc.log.some((l) => /hits Foe/.test(l.text)), 'the arrow lands');
  assert.ok(!enc.decls.find((d) => d.type === 'parry').used, 'the parry was not spent on it');
  assert.strictEqual(a.inventory.arrows, 0);
  assert.strictEqual(Combat.legalActions(enc, chars, a.id).attacks.find((o) => o.motion === 'shoot').why, 'No broadheads');
});

test('magic: words make spells; spell points, fire through armor, backlash', async () => {
  const m = fighter('Mage');
  m.feats = { casting: 2, verb_strike: 1, verb_launch: 1, mod_strong: 1 };
  m.nouns = ['fire'];
  m.stamina = C.maxStamina(m);
  assert.strictEqual(B.Magic.maxSP(m), 5 + 3 * 2);
  const labels = C.attackOptions(m).filter((o) => o.spell).map((o) => o.label).sort();
  assert.deepStrictEqual(labels, ['Launch + Fire', 'Launch + Fire + Strong', 'Strike + Fire', 'Strike + Fire + Strong']);
  const bolt = opt(m, (o) => o.label === 'Launch + Fire');
  assert.strictEqual(bolt.spCost, 4);
  assert.strictEqual(opt(m, (o) => o.label === 'Launch + Fire + Strong').windUp, true);
  const knight = fighter('Knight');
  knight.armor = Items.makeArmor('plate', 'full', 'standard'); // B mitigation 3 → stops 2 fire
  const h = Combat.computeHit(m, knight, bolt, {});
  const mag = B.CONFIG.magic.words.launch.mag;
  assert.strictEqual(h.fire, mag);
  assert.strictEqual(h.toCON + h.bluntToStamina, mag - 2, 'plate stops 2 of the fire');
  // Tired casters draw less power.
  m.stamina = Math.floor(C.maxStamina(m) / 2);
  assert.strictEqual(B.Magic.availableSP(m), 5);
  // Backlash: d10 = 1 vs cost 4 → 3 short → 6 stamina.
  assert.strictEqual(await B.Magic.backlash(m, 4, roller(1, [1])), 6);
  assert.strictEqual(await B.Magic.backlash(m, 4, roller(1, [7])), 0);
});

test('every feat rank can eventually be taken (no tier deadlocks)', () => {
  const F = B.DATA.FEATS;
  const c = fighter('Collector');
  c.level = 999;
  let progress = true;
  while (progress) {
    progress = false;
    for (const id in F) if (C.canTakeFeat(c, id, true).ok) { C.addFeat(c, id); progress = true; }
  }
  const stuck = Object.keys(F).filter((id) => C.rank(c, id) < F[id].ranks.length);
  assert.deepStrictEqual(stuck, []);
});

test('shove pushes an enemy back out to range', async () => {
  const a = armed('Spearman', 'spear');
  a.base.STR = 8;
  const b = armed('Rusher', 'dagger');
  const { enc, chars } = await duel(a, b);
  enc.pos[b.id] = { x: 1, y: 0 };
  const sh = Combat.legalActions(enc, chars, a.id).maneuvers.find((m) => m.type === 'shove');
  assert.ok(sh.targets.find((t) => t.id === b.id).inReach);
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'shove', target: b.id }), null);
  Combat.concede(enc, b.id);
  Combat.concede(enc, a.id);
  await Combat.resolveRound(enc, chars, roller(2, [9, 1])); // 13 vs 3: a margin of 5+ pushes 2 squares
  assert.strictEqual(enc.pos[b.id].x, 3);
});

test('a longbow must be drawn a round ahead; an archer can redraw after loosing', () => tableWeapons(async () => {
  const a = armed('Archer', 'longbow');
  a.inventory.arrows = 5;
  const shot = opt(a, (o) => o.motion === 'shoot');
  assert.strictEqual(shot.windUp, true);
  assert.strictEqual(opt(armed('S', 'shortbow'), (o) => o.motion === 'shoot').windUp, false);
  const b = armed('Foe', 'longsword');
  b.base.CON = 12;
  b.stamina = C.maxStamina(b);
  const { enc, chars } = await duel(a, b);
  enc.pos[b.id] = { x: 5, y: 0 };
  let la = Combat.legalActions(enc, chars, a.id);
  assert.strictEqual(la.attacks.find((o) => o.motion === 'shoot').why, 'Wind up first');
  Combat.declare(enc, chars, { actor: a.id, type: 'windUp', option: la.other.find((o) => o.type === 'windUp').option });
  Combat.concede(enc, b.id);
  Combat.concede(enc, a.id);
  await Combat.resolveRound(enc, chars, roller(2));
  await Combat.startRound(enc, chars, roller(3, [10, 1]));
  la = Combat.legalActions(enc, chars, a.id);
  const loose = la.attacks.find((o) => o.motion === 'shoot');
  assert.strictEqual(loose.why, null);
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'strike', option: loose, target: b.id }), null);
  Combat.concede(enc, b.id);
  await Combat.resolveRound(enc, chars, roller(2));
  assert.strictEqual(Combat.currentActor(enc), a.id, 'a second pass for the archer');
  la = Combat.legalActions(enc, chars, a.id);
  assert.ok(la.other.find((o) => o.type === 'windUp'), 'can redraw after loosing');
}));

test('a blocked power swing breaks a shield of equal or softer material and drives through', async () => {
  const run = async (material, quality) => {
    const a = armed('Heavy', 'greatsword');
    a.feats.power_swing = 1;
    a.status.windUp = null;
    const b = armed('Shield', 'longsword');
    b.base.CON = 12;
    b.shield = Items.makeShield('round', material, quality);
    b.stamina = C.maxStamina(b);
    const { enc, chars } = await duel(a, b);
    const power = C.attackOptions(a).find((o) => o.motion === 'power');
    a.status.windUp = { key: C.optionKey(power), label: power.label, round: 0 };
    assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'strike', option: power, target: b.id }), null);
    const lands = enc.decls[0].pass;
    while (enc.pass < lands) {
      Combat.endTurn(enc, Combat.currentActor(enc));
      if (enc.phase === 'resolve') await Combat.resolvePass(enc, chars, roller(2));
    }
    Combat.concede(enc, a.id);
    assert.strictEqual(Combat.declare(enc, chars, { actor: b.id, type: 'block' }), null);
    Combat.concede(enc, b.id);
    const staminaBefore = b.stamina;
    await Combat.resolveRound(enc, chars, roller(2, [10]));
    return { shield: b.shield.durability, lost: staminaBefore - b.stamina, log: enc.log.map((l) => l.text).join('\n') };
  };
  const wood = await run('wood', 'standard');
  assert.strictEqual(wood.shield, 0);
  assert.match(wood.log, /BREAKS it/);
  assert.match(wood.log, /drives through the shield/);
  const master = await run('steel', 'masterwork');
  assert.ok(master.shield > 0, 'a masterwork steel shield survives');
});

test('getting up gets steeply harder in heavier armor', () => {
  const c = fighter('Down');
  c.base.SPD = 6;
  const cost = (armor) => { c.armor = armor ? Items.makeArmor(armor, 'full', 'standard') : null; return C.actionCost(c, 'standUp'); };
  const none = cost(null), mail = cost('mail'), plate = cost('plate');
  assert.ok(none.ap < mail.ap && mail.ap < plate.ap, 'AP climbs with armor');
  assert.ok(plate.stamina >= 4 * none.stamina, 'plate stamina is several times unarmored');
  assert.ok(plate.ap <= C.apPool(c), 'never more than the pool');
  const spec = asWritten(() => cost('plate'));
  assert.strictEqual(spec.ap, 2 + 2, 'Specifics: 2 AP + 2 for plate');
});

test('grappling is exhausting: costly to start and to keep', async () => {
  const a = armed('A', 'dagger', { side: 'party' });
  const t = armed('T', 'dagger', { side: 'enemy' });
  const g = C.actionCost(a, 'grapple');
  assert.ok(g.stamina >= 5 * B.CONFIG.staminaScale, 'grapple costs a lot of stamina');
  const chars = { [a.id]: a, [t.id]: t };
  const enc = Combat.createEncounter('t', [a.id, t.id], chars, 4, 1);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[t.id] = { x: 1, y: 0 };
  await Combat.startRound(enc, chars, roller(1, [10, 1]));
  a.status.grappling = t.id; t.status.grappledBy = [a.id];
  const before = a.stamina;
  Combat.concede(enc, a.id); Combat.concede(enc, t.id);
  await Combat.resolveRound(enc, chars, roller(2));
  assert.ok(a.stamina < before, 'holding costs stamina at the end of the round');
  a.stamina = 1;
  await Combat.startRound(enc, chars, roller(3, [10, 1]));
  Combat.concede(enc, a.id); Combat.concede(enc, t.id);
  await Combat.resolveRound(enc, chars, roller(4));
  assert.strictEqual(a.status.grappling, null, 'too spent to keep the hold');
  assert.deepStrictEqual(t.status.grappledBy, []);
});

// Two adjacent fighters for grappling tests; rolls come from the queue, attacker first.
async function grapplePair(armor) {
  const a = armed('Grappler', 'dagger', { side: 'party' });
  a.base.STR = 8; a.base.SPD = 9; a.base.CON = 10; a.feats.grappler = 1;
  const t = armed('Mark', 'longsword', { side: 'enemy' });
  t.base.STR = 6;
  if (armor) t.armor = Items.makeArmor(armor, 'full', 'standard');
  for (const c of [a, t]) c.stamina = C.maxStamina(c);
  const chars = { [a.id]: a, [t.id]: t };
  const enc = Combat.createEncounter('t', [a.id, t.id], chars, 6, 1);
  enc.pos[a.id] = { x: 1, y: 0 }; enc.pos[t.id] = { x: 2, y: 0 };
  return { a, t, chars, enc };
}

async function step(g, type, rolls) {
  await Combat.startRound(g.enc, g.chars, roller(1, [10, 1]));
  assert.strictEqual(Combat.currentActor(g.enc), g.a.id);
  const err = Combat.declare(g.enc, g.chars, { actor: g.a.id, type, target: g.t.id });
  assert.strictEqual(err, null, type + ': ' + err);
  Combat.concede(g.enc, g.a.id); Combat.concede(g.enc, g.t.id);
  await Combat.resolveRound(g.enc, g.chars, roller(2, rolls));
  return g.enc.log.map((l) => l.text).join('\n');
}

test('grappling ladder: clinch, hold, pin, each a directly opposed roll', async () => {
  const g = await grapplePair(null);
  const la = Combat.legalActions(g.enc, g.chars, g.a.id);
  // Free: only a clinch is offered from the ladder.
  await Combat.startRound(g.enc, g.chars, roller(1, [10, 1]));
  assert.deepStrictEqual(Combat.legalActions(g.enc, g.chars, g.a.id).maneuvers.filter((m) => Combat.GRAPPLE_STEPS.includes(m.type)).map((m) => m.type), ['clinch']);
  Combat.concede(g.enc, g.a.id); Combat.concede(g.enc, g.t.id); await Combat.resolveRound(g.enc, g.chars, roller(2));
  // Clinch: 6+5=11 vs 4+3=7 → win by 4: a clinch, not yet a hold.
  await step(g, 'clinch', [6, 4]);
  assert.strictEqual(g.a.status.clinch, g.t.id);
  assert.strictEqual(g.t.status.clinch, g.a.id);
  assert.ok(!C.attackOptions(g.t).some((o) => o.motion === 'twoHanded'), 'no two-handed swings in a clinch');
  assert.strictEqual(Combat.legalActions(g.enc, g.chars, g.t.id).move, null, "can't step away without breaking");
  // Grapple: win by 1 → hold.
  await step(g, 'grapple', [3, 4]);
  assert.strictEqual(g.a.status.grappling, g.t.id);
  assert.deepStrictEqual(g.t.status.grappledBy, [g.a.id]);
  // Pin: break score max(STR 6, DEX 5)/2 = 3; 5+5=10 vs 1+3=4.
  await step(g, 'pin', [5, 1]);
  assert.ok(g.t.status.pinned);
  assert.deepStrictEqual(C.attackOptions(g.t), [], 'a pinned fighter can only try to break');
  void la;
});

test('grappling: a big win jumps two rungs; a big loss reverses', async () => {
  const g = await grapplePair(null);
  await step(g, 'clinch', [10, 1]); // 15 vs 4: straight to a hold
  assert.strictEqual(g.a.status.grappling, g.t.id);
  const h = await grapplePair(null);
  await step(h, 'clinch', [6, 4]);
  await step(h, 'grapple', [1, 10]); // 6 vs 13: lose by 7 → they hold you
  assert.strictEqual(h.t.status.grappling, h.a.id);
});

test('grappling and armor: plate is easy to grab but hard to throw', async () => {
  // Same rolls; the attacker's grapple roll ties against unarmored but wins against plate (+2 handles).
  const tie = await grapplePair(null);
  await step(tie, 'clinch', [6, 4]);
  await step(tie, 'grapple', [2, 4]); // 7 vs 7
  assert.ok(!tie.a.status.grappling);
  const plate = await grapplePair('plate');
  await step(plate, 'clinch', [6, 4]);
  await step(plate, 'grapple', [2, 4]); // 7 + 2 vs 7
  assert.strictEqual(plate.a.status.grappling, plate.t.id);
  // Throw: grapple score 5 vs 3 + plate footing 2: rolls 4 vs 6 → 9 vs 11, kept.
  const log = await step(plate, 'throw', [4, 6]);
  assert.match(log, /keeps their feet/);
  // The same throw against an unarmored, held fighter lands: 9 vs 9 is a tie, so roll 5 vs 6.
  const bare = await grapplePair(null);
  await step(bare, 'clinch', [10, 1]);
  await step(bare, 'throw', [5, 6]);
  assert.ok(bare.t.status.prone, 'thrown prone');
  assert.ok(!bare.a.status.grappling, 'the throw ends the grapple');
});

test('grappling: guards never meet a grapple; pinned armor is pierced', async () => {
  const g = await grapplePair('plate');
  await step(g, 'clinch', [10, 1]);
  await step(g, 'pin', [10, 1]);
  assert.ok(g.t.status.pinned);
  const stab = C.attackOptions(g.a).find((o) => o.motion === 'thrust');
  const pinned = Combat.computeHit(g.a, g.t, stab, { distance: 1 });
  g.t.status.pinned = false;
  const held = Combat.computeHit(g.a, g.t, stab, { distance: 1 });
  assert.ok(pinned.pass > held.pass, 'a pin opens the armor');
  assert.ok(Combat.legalActions(g.enc, g.chars, g.t.id).defenses.length > 0);
});

test('arrows and armor: textile catches arrows; bodkins for metal, broadheads for flesh', () => {
  const a = armed('Archer', 'longbow');
  a.inventory.arrows = 3; a.inventory.bodkins = 3;
  const shots = C.attackOptions(a).filter((o) => o.motion === 'shoot');
  const broad = shots.find((o) => o.arrowHead === 'broadhead');
  const bodkin = shots.find((o) => o.arrowHead === 'bodkin');
  assert.ok(broad && bodkin, 'one shot per arrowhead carried');
  const target = (armor) => { const t = fighter('T'); if (armor) t.armor = Items.makeArmor(armor, 'full', 'standard'); return t; };
  const con = (o, armor) => Combat.computeHit(a, target(armor), o, { distance: 4 }).toCON;
  assert.ok(con(broad, null) > con(bodkin, null), 'broadheads hit flesh harder');
  assert.ok(con(bodkin, 'mail') > con(broad, 'mail'), 'bodkins go through mail better');
  assert.ok(con(bodkin, 'plate') > con(broad, 'plate'));
  // Padded stops an arrow better than the same piercing from a thrust.
  const spear = opt(armed('S', 'spear'), (o) => o.motion === 'thrust');
  const pad = target('padded');
  assert.ok(Combat.computeHit(a, pad, broad, { distance: 4 }).mitigated.P > Combat.computeHit(a, pad, spear, { distance: 2 }).mitigated.P);
  // Out of bodkins: only broadheads are offered.
  a.inventory.bodkins = 0;
  assert.deepStrictEqual(C.attackOptions(a).filter((o) => o.motion === 'shoot').map((o) => o.arrowHead), ['broadhead']);
});

test('monsters: natural weapons are always ready; traits work', async () => {
  const [wolf] = Enemies.makeMonster('wolf');
  assert.ok(C.attackOptions(wolf).some((o) => o.natural && o.knockdown), 'a wolf bites, and the bite can drag you down');
  assert.ok(!C.attackOptions(wolf).some((o) => o.unarmed), 'no punching wolves');
  assert.strictEqual(Enemies.makeMonster('wolfPack').length, 3);
  // Venom: a bite that wounds poisons, and a bandage doesn't draw it out.
  const [spider] = Enemies.makeMonster('giantSpider');
  const bite = C.attackOptions(spider).find((o) => o.venom);
  const t = fighter('Victim');
  t.stamina = C.maxStamina(t);
  const chars = { [spider.id]: spider, [t.id]: t };
  const enc = Combat.createEncounter('t', [spider.id, t.id], chars, 4, 1);
  await Combat.applyHit(enc, chars, spider, t, bite, roller(1), {});
  assert.ok(t.bleeds.some((b) => b.poison), 'poisoned');
  // Rust: corrodes metal armor and does nothing else.
  const [beetle] = Enemies.makeMonster('rustBeetle');
  const touch = C.attackOptions(beetle).find((o) => o.rust);
  assert.ok(touch && touch.rust > 0);
  // Bosses: more AP than their attributes alone give.
  const [boss] = Enemies.makeMonster('trollChieftain');
  const [troll] = Enemies.makeMonster('caveTroll');
  assert.ok(C.apPool(boss) >= C.apPool(troll) * 2);
  assert.ok(C.maxStamina(boss) > C.maxStamina(troll));
  // Big monsters are stronger and tougher than any human can be (10 base + 3 Conditioning).
  const human = B.CONFIG.attrMax + B.CONFIG.conditioningCap;
  assert.ok(C.attr(troll, 'STR') > human && C.attr(troll, 'CON') > human);
  assert.ok(C.strBonus(troll) > Math.floor((human - B.CONFIG.strBonusPivot) / B.CONFIG.strBonusDivisor));
});

test('monster fights finish without errors', async () => {
  for (const mk of Object.keys(Enemies.MONSTERS)) {
    const foe = armed('Hero', 'longsword', { side: 'party' });
    foe.armor = Items.makeArmor('mail', 'full', 'standard');
    foe.shield = Items.makeShield('round', 'iron');
    foe.stamina = C.maxStamina(foe);
    const mons = Enemies.makeMonster(mk);
    const chars = { [foe.id]: foe };
    for (const m of mons) chars[m.id] = m;
    const enc = Combat.createEncounter('t', Object.keys(chars), chars, 8, 4);
    const roll = roller(9);
    const rng = Enemies.makeRng(3);
    while (enc.phase !== 'over' && enc.round < 30) {
      await Combat.startRound(enc, chars, roll);
      let guard = 2000;
      while ((enc.phase === 'declare' || enc.phase === 'resolve') && guard-- > 0) {
        if (enc.phase === 'resolve') { await Combat.resolvePass(enc, chars, roll); continue; }
        const id = Combat.currentActor(enc);
        Combat.submit(enc, chars, AI.choose(enc, chars, id, rng, chars[id].policy));
      }
      assert.ok(guard > 0, mk + ': round loop terminates');
    }
  }
});

test('tireless undead: no stamina, damage to the body, no bleeding; skeletons shrug off piercing', () => {
  const [sk] = Enemies.makeMonster('skeleton');
  assert.ok(C.tireless(sk));
  assert.strictEqual(C.actionCost(sk, 'parry').stamina, 0, 'actions cost no stamina');
  assert.strictEqual(C.fatiguePenalty(sk), 0);
  const a = armed('Hero', 'longsword');
  const thrust = C.attackOptions(a).find((o) => o.motion === 'thrust');
  const swing = C.attackOptions(a).find((o) => o.motion === 'swing' && o.face === 'edge');
  const mace = C.attackOptions(armed('M', 'flangedMace')).find((o) => o.motion === 'swing');
  const hT = Combat.computeHit(a, sk, thrust, { distance: 2 });
  assert.deepStrictEqual([hT.P, hT.toCON], [0, 0], 'a thrust passes between the ribs');
  const hS = Combat.computeHit(a, sk, swing, { distance: 2 });
  assert.ok(hS.S < Combat.computeHit(a, fighter('Living'), swing, { distance: 2 }).S, 'slashing is reduced');
  const hB = Combat.computeHit(armed('M', 'flangedMace'), sk, mace, { distance: 2 });
  assert.ok(hB.bluntToCON > 0 && hB.bluntToStamina === 0, 'blunt goes straight to the bones');
  assert.ok(hB.noBleed);
  // It never passes out: only destroying its body stops it.
  sk.stamina = 0;
  C.updateCondition(sk);
  assert.ok(!sk.status.unconscious);
});

test('sticky webs: every action costs more until torn free', async () => {
  const [spider] = Enemies.makeMonster('giantSpider');
  const spit = C.attackOptions(spider).find((o) => o.web);
  assert.ok(spit && spit.ranged && spit.minRange === 2);
  const t = armed('Hero', 'longsword', { side: 'party' });
  const before = { thrust: C.attackOptions(t).find((o) => o.motion === 'thrust').ap, parry: C.actionCost(t, 'parry') };
  t.status.webbed = 1;
  const after = { thrust: C.attackOptions(t).find((o) => o.motion === 'thrust').ap, parry: C.actionCost(t, 'parry') };
  assert.strictEqual(after.thrust, before.thrust + B.CONFIG.web.ap * B.CONFIG.apScale);
  assert.strictEqual(after.parry.stamina, before.parry.stamina + B.CONFIG.web.stamina * B.CONFIG.staminaScale);
  assert.strictEqual(C.actionCost(t, 'dropWeapon').ap, 0, 'dropping is still free');
});

test('weapons from physics: deeper points hit harder, heavier weapons are slower, STR needs mass', () => {
  const S = (t) => Items.weaponStats(t);
  // A dagger stab is shallow next to a sword or spear thrust.
  assert.ok(S('dagger').faces.point[0] < S('longsword').faces.point[0]);
  assert.ok(S('longsword').faces.point[0] < S('spear').faces.point[0]);
  // Deeper points find vital spots more often; wider wounds bleed more.
  assert.ok(S('dagger').wound.point.vital < S('longsword').wound.point.vital);
  assert.ok(S('rapier').wound.point.bleed < S('longsword').wound.point.bleed);
  // Swing cost rises with mass × length; thrust cost with mass.
  const swingAP = (t) => opt(armed('X', t), (o) => o.motion === 'swing').ap;
  const thrustAP = (t) => opt(armed('X', t), (o) => o.motion === 'thrust').ap;
  assert.ok(swingAP('dagger') < swingAP('club') && swingAP('club') <= swingAP('longsword'));
  assert.ok(thrustAP('dagger') < thrustAP('longsword'));
  // STR: a rapier thrust barely cares; a mace swing depends on it.
  assert.ok(S('rapier').strMult.thrust < 0.5 && S('flangedMace').strMult.swing >= 1);
  const gain = (t) => { const a = armed('A', t); a.base.STR = 13; const b = armed('B', t); b.base.STR = 5; const m = t === 'rapier' ? 'thrust' : 'swing'; return opt(a, (o) => o.motion === m).damage.reduce((x, y) => Math.max(x, y)) - opt(b, (o) => o.motion === m).damage.reduce((x, y) => Math.max(x, y)); };
  assert.ok(gain('rapier') < gain('flangedMace'), 'STR adds more to a mace than to a rapier');
});

test('wound roll: armor guards the vitals; a vital stab triples its CON damage', async () => {
  const a = armed('A', 'longsword');
  const thrust = opt(a, (o) => o.motion === 'thrust');
  const naked = fighter('N');
  const mailed = fighter('M'); mailed.armor = Items.makeArmor('mail', 'full', 'standard');
  const plated = fighter('P'); plated.armor = Items.makeArmor('plate', 'full', 'standard');
  const v = (t) => Combat.computeHit(a, t, thrust).pierceVital;
  assert.ok(v(naked) > v(mailed) && v(mailed) > v(plated));
  // Pinned: the armor no longer guards the vitals.
  plated.status.pinned = 'A';
  assert.strictEqual(v(plated), v(naked));
  // A wound roll of 1 is vital: ×3 CON.
  const t = fighter('T'); t.base.CON = 30; t.stamina = C.maxStamina(t);
  const enc = { hitThisRound: {}, fortressUsed: {} };
  await Combat.applyHit(enc, { [a.id]: a, [t.id]: t }, a, t, thrust, roller(1, [1]));
  assert.strictEqual(t.damage.CON, thrust.damage[0] * B.CONFIG.vital.mult);
  const u = fighter('U'); u.base.CON = 30; u.stamina = C.maxStamina(u);
  await Combat.applyHit(enc, { [a.id]: a, [u.id]: u }, a, u, thrust, roller(1, [10]));
  assert.strictEqual(u.damage.CON, thrust.damage[0]);
});

test('ready a thrust: stepping closer into a readied point meets it first and is stopped', async () => {
  const s = armed('S', 'longsword', { side: 'party' });
  const d = armed('D', 'dagger', { side: 'enemy' });
  s.base.SPD = 9; d.base.SPD = 1; d.base.CON = 12;
  for (const c of [s, d]) c.stamina = C.maxStamina(c);
  const chars = { [s.id]: s, [d.id]: d };
  const enc = Combat.createEncounter('t', [s.id, d.id], chars, 8, 1);
  enc.pos[s.id] = { x: 0, y: 0 }; enc.pos[d.id] = { x: 3, y: 0 };
  await Combat.startRound(enc, chars, roller(3, [5, 5]));
  const ready = Combat.legalActions(enc, chars, s.id).readies.find((o) => o.option.motion === 'thrust');
  assert.ok(ready && ready.affordable);
  assert.strictEqual(Combat.declare(enc, chars, { actor: s.id, type: 'readyStrike', option: ready.option }), null);
  Combat.endTurn(enc, s.id);
  assert.strictEqual(Combat.declare(enc, chars, { actor: d.id, type: 'move', to: { x: 1, y: 0 } }), null);
  Combat.endTurn(enc, d.id);
  await Combat.resolvePass(enc, chars, roller(4, [10]));
  const text = enc.log.map((l) => l.text).join('\n');
  assert.match(text, /steps into S's readied point/);
  assert.match(text, /S's Thrust \(point\) hits D/);
  assert.deepStrictEqual(enc.pos[d.id], { x: 3, y: 0 }, 'the advance is stopped');
  assert.ok(C.totalDamage(d) > 0);
});

test('fend off: a long weapon shoves at range 2, and a foe driven back loses that move', async () => {
  const s = armed('S', 'spear', { side: 'party' });
  const d = armed('D', 'dagger', { side: 'enemy' });
  s.base.SPD = 9; d.base.SPD = 1; s.base.STR = 9;
  for (const c of [s, d]) c.stamina = C.maxStamina(c);
  const chars = { [s.id]: s, [d.id]: d };
  const enc = Combat.createEncounter('t', [s.id, d.id], chars, 8, 1);
  enc.pos[s.id] = { x: 0, y: 0 }; enc.pos[d.id] = { x: 2, y: 0 };
  await Combat.startRound(enc, chars, roller(3, [5, 5]));
  const shove = Combat.legalActions(enc, chars, s.id).maneuvers.find((m) => m.type === 'shove');
  assert.ok(shove.targets.find((t) => t.id === d.id).inReach, 'the spear reaches 2 squares');
  assert.strictEqual(Combat.declare(enc, chars, { actor: s.id, type: 'shove', target: d.id }), null);
  Combat.endTurn(enc, s.id);
  assert.strictEqual(Combat.declare(enc, chars, { actor: d.id, type: 'move', to: { x: 1, y: 0 } }), null);
  Combat.endTurn(enc, d.id);
  await Combat.resolvePass(enc, chars, roller(4, [5, 5]));
  const text = enc.log.map((l) => l.text).join('\n');
  assert.match(text, /S shoves D back 1 square/);
  assert.match(text, /D is driven back and can't press on/);
  assert.deepStrictEqual(enc.pos[d.id], { x: 3, y: 0 });
});

test('parries and dodges are opposed rolls; a power blow cannot be parried', () => {
  const d = armed('D', 'longsword');
  const human = armed('H', 'longsword');
  const [troll] = Enemies.makeMonster('caveTroll');
  // Harder to dodge a STR-20 troll than a man.
  assert.ok(Combat.defenseOdds(d, 'dodge', 'swing', troll) < Combat.defenseOdds(d, 'dodge', 'swing', human));
  // Equal fighters: the defender wins ties.
  const even = Combat.defenseOdds(d, 'parry', 'thrust', human, opt(human, (o) => o.motion === 'thrust'));
  assert.ok(even > 0.5 && even < 0.75, String(even));
  // A heavier attacking weapon is harder to parry.
  const g = armed('G', 'greatsword');
  const gs = opt(g, (o) => o.motion === 'thrust');
  assert.ok(Combat.defenseOdds(d, 'parry', 'thrust', g, gs) < Combat.defenseOdds(d, 'parry', 'thrust', human, opt(human, (o) => o.motion === 'thrust')));
  // No parrying a power blow.
  const power = { type: 'strike', actor: g.id, option: Object.assign({}, gs, { motion: 'power' }) };
  assert.strictEqual(Combat.defenseUnavailable(d, 'parry', power, { [g.id]: g }, null), "Can't parry a power blow");
  assert.strictEqual(Combat.defenseUnavailable(d, 'dodge', power, { [g.id]: g }, null), null);
});

test('parrying dagger: off-hand thrust, and an off-hand parry that meets only thrusts', () => {
  const c = armed('R', 'rapier');
  const pd = Items.makeWeapon('parryingDagger');
  c.weapons.push(pd);
  c.offhand = pd.id;
  assert.ok(C.offhandWeapon(c));
  assert.ok(C.attackOptions(c).some((o) => o.offhand && o.motion === 'thrust'));
  const foe = armed('F', 'longsword');
  const thrust = { type: 'strike', actor: foe.id, option: opt(foe, (o) => o.motion === 'thrust') };
  const swing = { type: 'strike', actor: foe.id, option: opt(foe, (o) => o.motion === 'swing') };
  assert.strictEqual(Combat.defenseUnavailable(c, 'offParry', thrust, { [foe.id]: foe }, null), null);
  assert.strictEqual(Combat.defenseUnavailable(c, 'offParry', swing, { [foe.id]: foe }, null), 'Only meets thrusts');
  // The off-hand parry gets its bonus.
  assert.ok(Combat.defenseOdds(c, 'offParry', 'thrust', foe) > Combat.defenseOdds(c, 'parry', 'thrust', foe));
  // A shield on the arm takes the off hand.
  c.shield = Items.makeShield('buckler', 'wood', 'standard');
  assert.strictEqual(C.offhandWeapon(c), null);
});

test('natural weapons come from physics too, with STR in full', () => {
  const S = Items.weaponStats('trollFists');
  assert.strictEqual(S.model, 'physical');
  assert.ok(S.strMult.swing === 1);
  const [troll] = Enemies.makeMonster('caveTroll');
  const fist = C.attackOptions(troll).find((o) => o.weaponType === 'trollFists' && o.motion === 'swing');
  assert.strictEqual(fist.damage[2], S.faces.head[2] + C.strBonus(troll));
});

test('terrain: walls are walked around or block, pits catch, solid walls stop arrows', async () => {
  const T = B.Terrain;
  const a = armed('A', 'longsword', { side: 'party' });
  const f = armed('F', 'shortbow', { side: 'enemy' });
  f.inventory.arrows = 5;
  for (const c of [a, f]) c.stamina = C.maxStamina(c);
  const chars = { [a.id]: a, [f.id]: f };
  const enc = Combat.createEncounter('t', [a.id, f.id], chars, 8, 3);
  enc.pos[a.id] = { x: 0, y: 1 }; enc.pos[f.id] = { x: 7, y: 1 };
  // A wall across the middle: the path goes around through a gap; fully closed, no way through.
  T.add(enc, 3, 0, 'stoneWall'); T.add(enc, 3, 1, 'stoneWall');
  const around = T.pathCost(enc, { x: 0, y: 1 }, { x: 5, y: 1 }, a);
  assert.ok(around.reaches && around.steps.some((q) => q.x === 3 && q.y === 2));
  T.add(enc, 3, 2, 'stoneWall');
  assert.ok(!T.pathCost(enc, { x: 0, y: 1 }, { x: 5, y: 1 }, a).reaches);
  // The solid wall blocks the archer's line.
  assert.ok(T.lineCheck(enc, enc.pos[f.id], enc.pos[a.id], 'missile').blocked);
  // A pit: stepping in ends the move, prone.
  T.remove(enc, 3, 2, () => true);
  T.add(enc, 3, 2, 'pit');
  await Combat.startRound(enc, chars, roller(3, [9, 1]));
  assert.strictEqual(Combat.currentActor(enc), a.id);
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'move', to: { x: 4, y: 2 } }), null);
  Combat.endTurn(enc, a.id);
  Combat.endTurn(enc, f.id);
  await Combat.resolvePass(enc, chars, roller(4, []));
  assert.deepStrictEqual(enc.pos[a.id], { x: 3, y: 2 });
  assert.ok(a.status.prone);
});

test('conditions: slowed costs AP, rooted can\'t move, stoneskin turns blunt', () => {
  const Cn = B.Conditions;
  const c = armed('C', 'longsword');
  const ap = C.apPool(c);
  Cn.add(c, 'slowed', { rounds: 2, mag: 1 });
  assert.strictEqual(C.apPool(c), ap - C.apScale());
  Cn.add(c, 'rooted', { rounds: 1 });
  assert.ok(!Cn.canMove(c));
  Cn.endRound(c);
  assert.ok(Cn.canMove(c), 'rooted wears off');
  assert.ok(Cn.has(c, 'slowed'));
  const atk = armed('A', 'club');
  const blow = opt(atk, (o) => o.motion === 'swing');
  const before = Combat.computeHit(atk, c, blow).B;
  Cn.add(c, 'stoneskin', { rounds: 2, mag: 1 });
  assert.strictEqual(Combat.computeHit(atk, c, blow).B, Math.max(0, before - 2));
});

// A caster who knows every verb and modifier and the given nouns.
function mage(name, nouns, opts) {
  const m = fighter(name, opts);
  m.feats = { casting: 3 };
  for (const [k, w] of Object.entries(B.CONFIG.magic.words)) if (w.feat) m.feats[w.feat] = 1;
  m.base.INT = 8;
  m.nouns = nouns;
  m.stamina = C.maxStamina(m);
  return m;
}

async function castAt(m, foes, spellKey, aim, rolls) {
  const chars = { [m.id]: m };
  for (const f of foes) chars[f.id] = f;
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, 10, 5);
  enc.pos[m.id] = { x: 1, y: 2 };
  foes.forEach((f, i) => { enc.pos[f.id] = f.at || { x: 6, y: 2 + i }; });
  const o = B.Magic.spellOptions(m).find((x) => x.spellKey === spellKey);
  assert.ok(o, 'spell ' + spellKey);
  const d = Object.assign({ actor: m.id, type: 'cast', option: o, pass: 1, n: 1 }, aim);
  const pos = JSON.parse(JSON.stringify(enc.pos));
  await B.Magic.resolveCast(enc, chars, d, roller(5, rolls || []), pos);
  return { enc, chars, o };
}

test('magic grammar: verbs take nouns broadly; a few pairings make nothing', () => {
  const M = B.Magic;
  assert.ok(M.combines('build', 'earth') && M.combines('build', 'vine') && M.combines('build', 'fire'));
  assert.ok(!M.combines('build', 'life'), 'no wall of life');
  assert.ok(M.combines('open', 'earth') && !M.combines('open', 'fire'), 'pits are earth');
  assert.ok(M.combines('hex', 'life') && M.combines('bless', 'life') && M.combines('conjure', 'life'));
  assert.ok(!M.combines('hex', 'wind'));
  assert.ok(!M.combines('strike', 'fire', 'wide'), 'Wide makes no sense for a bolt');
  const m = mage('M', ['fire', 'earth', 'vine', 'life']);
  const keys = M.spellOptions(m).map((o) => o.spellKey);
  assert.ok(keys.includes('build+earth') && keys.includes('cover+vine+wide') && keys.includes('hex+life+long'));
  assert.ok(keys.length > 60, `${keys.length} spells`);
});

test('build a stone wall across the line; it blocks the way and arrows', async () => {
  const m = mage('M', ['earth']);
  const f = armed('F', 'shortbow', { side: 'enemy' });
  const { enc } = await castAt(m, [f], 'build+earth', { at: { x: 4, y: 2 } }, [10]);
  const walls = B.Terrain.all(enc).filter((t) => t.f.kind === 'stoneWall').map((t) => t.y).sort();
  assert.deepStrictEqual(walls, [1, 2, 3], 'three squares across');
  assert.ok(B.Terrain.lineCheck(enc, enc.pos[f.id], enc.pos[m.id], 'missile').blocked);
});

test('hex with vine roots a foe unless they resist; bless with life closes wounds', async () => {
  const m = mage('M', ['vine', 'life']);
  const f = armed('F', 'longsword', { side: 'enemy' });
  // Backlash 10, caster rolls 9, target rolls 1: rooted.
  await castAt(m, [f], 'hex+vine', { target: f.id }, [10, 9, 1]);
  assert.ok(!B.Conditions.canMove(f));
  const g = armed('G', 'longsword', { side: 'enemy' });
  await castAt(m, [g], 'hex+vine', { target: g.id }, [10, 1, 9]);
  assert.ok(B.Conditions.canMove(g), 'resisted');
  const ally = armed('A', 'longsword');
  ally.at = { x: 2, y: 2 };
  ally.damage.CON = 2;
  ally.bleeds = [{ remaining: 4, rounds: 3 }];
  await castAt(m, [ally], 'bless+life', { target: ally.id }, [10]);
  assert.strictEqual(ally.bleeds.length, 0);
  assert.strictEqual(ally.damage.CON, 1);
  assert.ok(B.Conditions.has(ally, 'innervated'));
});

test('burst hits everyone in the area, friend or foe; dodging aside halves it', async () => {
  const m = mage('M', ['fire']);
  const f = armed('F', 'longsword', { side: 'enemy' }); f.at = { x: 6, y: 2 };
  const pal = armed('P', 'longsword'); pal.at = { x: 6, y: 3 };
  for (const c of [f, pal]) c.base.CON = 20;
  // backlash 10; F: caster 9 vs 1 (full); P: caster 1 vs 9 (half)
  const { enc } = await castAt(m, [f, pal], 'burst+fire', { at: { x: 6, y: 2 } }, [10, 9, 1, 1, 9]);
  const text = enc.log.map((l) => l.text).join('\n');
  assert.match(text, /Burst \+ Fire hits F:/);
  assert.match(text, /Burst \+ Fire hits P \(half/);
});

test('an inscribed rune springs on a foe who steps on it; lightning goes through plate', async () => {
  const m = mage('M', ['lightning']);
  const f = armed('F', 'longsword', { side: 'enemy' });
  f.armor = Items.makeArmor('plate', 'full', 'standard');
  f.at = { x: 4, y: 2 };
  const { enc, chars } = await castAt(m, [f], 'inscribe+lightning', { at: { x: 2, y: 2 } }, [10]);
  const rune = B.Terrain.at(enc, 2, 2).find((t) => t.kind === 'rune');
  assert.ok(rune && rune.hidden);
  assert.ok(!B.Terrain.visible(rune, 'enemy'));
  const stop = await B.Terrain.enter(enc, chars, f, 2, 2, roller(6, [1, 9]), (t) => enc.log.push({ text: t }));
  assert.ok(!B.Terrain.at(enc, 2, 2).some((t) => t.kind === 'rune'), 'used up');
  const hit = Combat.computeHit(m, f, { kind: 'strike', motion: 'spell', spell: { element: 'lightning', magnitude: 4 }, damage: [0, 0, 0] }, {});
  assert.strictEqual(hit.fire, 4);
  assert.ok(!hit.fireStopped, 'plate stops none of it');
  assert.ok(typeof stop === 'boolean');
});

test('conjure: a fire elemental joins the caster for a few rounds; life raises the dead', async () => {
  const m = mage('M', ['fire', 'life']);
  const f = armed('F', 'longsword', { side: 'enemy' });
  const { enc, chars } = await castAt(m, [f], 'conjure+fire', { at: { x: 2, y: 2 } }, [10]);
  const el = Object.values(enc.extra || {})[0];
  assert.ok(el && el.side === m.side && el.traits.element === 'fire');
  assert.ok(enc.ids.includes(el.id) && chars[el.id] === el);
  // Raise: no body, no spell; with a body nearby, the dead rise.
  const r1 = await castAt(m, [f], 'conjure+life', { at: { x: 3, y: 2 } }, [10]);
  assert.ok(!r1.enc.extra);
  const corpse = armed('Dead', 'club', { side: 'enemy' }); corpse.status.dead = true; corpse.at = { x: 3, y: 1 };
  m.spSpent = 0;
  const r2 = await castAt(m, [f, corpse], 'conjure+life', { at: { x: 3, y: 2 } }, [10]);
  const z = Object.values(r2.enc.extra || {})[0];
  assert.ok(z && z.side === m.side && corpse.raised);
});

test('ward of force soaks spells and missiles; ward of wind turns missiles aside', async () => {
  const m = mage('M', ['force', 'wind', 'fire']);
  const ally = armed('A', 'longsword'); ally.at = { x: 2, y: 2 };
  await castAt(m, [ally], 'ward+force', { target: ally.id }, [10]);
  const w = B.Conditions.get(ally, 'warded');
  assert.ok(w && w.kind === 'magic' && w.pool === B.CONFIG.magic.words.ward.mag * 3);
  const enc = { log: [] };
  const bolt = B.Magic.spellOptions(m).find((o) => o.spellKey === 'launch+fire');
  const out = B.Magic.wardAgainst(enc, ally, bolt, true);
  assert.strictEqual(out.magnitude, 0, 'the bolt is soaked');
  assert.ok(out.blocked);
  assert.strictEqual(B.Conditions.get(ally, 'warded').pool, w.pool > 0 ? 6 - bolt.spell.magnitude : 0);
  const other = armed('O', 'longsword'); other.at = { x: 2, y: 2 };
  m.spSpent = 0;
  await castAt(m, [other], 'ward+wind', { target: other.id }, [10]);
  assert.strictEqual(B.Magic.wardAgainst(enc, other, { damage: [5, 0, 0] }, true).deflect, 0.5);
});

test('blink: a caster held in a grapple steps out of it to a square', async () => {
  const m = mage('M', ['wind']);
  const g = armed('G', 'dagger', { side: 'enemy' }); g.at = { x: 2, y: 2 };
  const chars = { [m.id]: m, [g.id]: g };
  m.status.grappledBy = [g.id]; g.status.grappling = m.id;
  const enc = Combat.createEncounter('t', [m.id, g.id], chars, 10, 5);
  enc.pos[m.id] = { x: 1, y: 2 }; enc.pos[g.id] = { x: 2, y: 2 };
  await Combat.startRound(enc, chars, roller(1, [9, 1]));
  const la = Combat.legalActions(enc, chars, m.id);
  const blink = la.spells.find((o) => o.spell.shape === 'blink');
  assert.ok(blink && blink.affordable, 'blink is open even while held');
  assert.ok(!la.spells.some((o) => o.spell.shape === 'wall'), 'nothing else while held');
  await B.Magic.resolveCast(enc, chars, { actor: m.id, type: 'cast', option: blink.option || blink, at: { x: 4, y: 0 } }, roller(2, [10]), JSON.parse(JSON.stringify(enc.pos)));
  assert.deepStrictEqual(enc.pos[m.id], { x: 4, y: 0 });
  assert.ok(!m.status.grappledBy.length && !g.status.grappling);
});

test('bait draws out guards and leaves a foe off balance; reading intent gives +2 both ways', async () => {
  const a = armed('A', 'longsword', { side: 'party' }); a.base.CHA = 8; a.base.WIS = 8;
  const t = armed('T', 'longsword', { side: 'enemy' });
  const chars = { [a.id]: a, [t.id]: t };
  const swing = opt(a, (o) => o.motion === 'thrust');
  const before = Combat.defenseOdds(t, 'parry', 'thrust', a, swing);
  B.Conditions.add(t, 'baited', { rounds: 1 });
  assert.ok(Combat.defenseOdds(t, 'parry', 'thrust', a, swing) < before);
  B.Conditions.remove(t, 'baited');
  B.Conditions.add(a, 'reading', { rounds: 1, vs: t.id });
  assert.ok(Combat.defenseOdds(t, 'parry', 'thrust', a, swing) < before, 'harder to parry one who reads you');
  const theirs = opt(t, (o) => o.motion === 'thrust');
  assert.ok(Combat.defenseOdds(a, 'parry', 'thrust', t, theirs) > Combat.defenseOdds(t, 'parry', 'thrust', a, swing));
  // The action: bait wins, the foe's guard is spent.
  B.Conditions.remove(a, 'reading');
  const enc = Combat.createEncounter('t', [a.id, t.id], chars, 6, 1);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[t.id] = { x: 2, y: 0 };
  t.base.SPD = 9;
  await Combat.startRound(enc, chars, roller(1, [5, 9]));
  assert.strictEqual(Combat.currentActor(enc), t.id);
  assert.strictEqual(Combat.declare(enc, chars, { actor: t.id, type: 'parry' }), null);
  Combat.endTurn(enc, t.id);
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'bait', target: t.id }), null);
  Combat.endTurn(enc, a.id);
  await Combat.resolvePass(enc, chars, roller(2, [9, 1]));
  assert.ok(B.Conditions.has(t, 'baited'));
  assert.ok(enc.decls.find((d) => d.actor === t.id && d.type === 'parry').used);
});

test('read intent: a true read shows their real plan (+2); a bad roll misreads it (−2) and looks the same', async () => {
  const a = armed('A', 'longsword', { side: 'party' }); a.base.WIS = 6;
  const t = armed('T', 'longsword', { side: 'enemy' }); t.base.CHA = 4;
  const chars = { [a.id]: a, [t.id]: t };
  const enc = Combat.createEncounter('t', [a.id, t.id], chars, 6, 1);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[t.id] = { x: 2, y: 0 };
  t.base.SPD = 9;
  await Combat.startRound(enc, chars, roller(1, [5, 9]));
  const th = Combat.legalActions(enc, chars, t.id).attacks.find((o) => o.motion === 'thrust');
  assert.strictEqual(Combat.declare(enc, chars, { actor: t.id, type: 'strike', option: th, target: a.id }), null);
  Combat.endTurn(enc, t.id);
  assert.strictEqual(C.actionCost(a, 'readIntent').ap, 1, 'cheap');
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'readIntent', target: t.id }), null);
  Combat.endTurn(enc, a.id);
  // TN = 5 + 2 = 7; WIS 6 → +3. Roll 9: 12, a true read. (Then the parry-less thrust resolves.)
  await Combat.resolvePass(enc, chars, roller(2, [9, 10, 10]));
  const r = B.Conditions.get(a, 'reading');
  assert.ok(r && r.truth === true && /thrust/i.test(r.note), r && r.note);
  const tt = opt(t, (o) => o.motion === 'thrust');
  const withRead = Combat.defenseOdds(a, 'parry', 'thrust', t, tt);
  r.truth = false; // a misread
  assert.ok(Combat.defenseOdds(a, 'parry', 'thrust', t, tt) < withRead);
});

test('phase 2: beguile — mesmerized until harmed; controlled fights for the caster, then returns', async () => {
  const m = mage('M', ['dream', 'will', 'calm']);
  const f = armed('F', 'longsword', { side: 'enemy' });
  // backlash 10, caster 9 vs target 1 → mesmerized.
  const { enc, chars } = await castAt(m, [f], 'beguile+dream', { target: f.id }, [10, 9, 1]);
  assert.ok(B.Conditions.has(f, 'mesmerized'));
  assert.strictEqual(C.apPool(f), 0, 'no actions');
  const a = armed('A', 'club');
  await Combat.applyHit(enc, chars, a, f, opt(a, (o) => o.motion === 'swing'), roller(1, []), {});
  assert.ok(!B.Conditions.has(f, 'mesmerized'), 'a blow wakes them');
  m.spSpent = 0;
  const g = armed('G', 'longsword', { side: 'enemy' });
  const r = await castAt(m, [g], 'beguile+will', { target: g.id }, [10, 9, 1]);
  assert.strictEqual(g.side, m.side, 'fights for the caster');
  assert.ok(B.Conditions.has(m, 'concentrating'));
  B.Conditions.remove(g, 'controlled');
  Combat.endRound(r.enc, r.chars);
  assert.strictEqual(g.side, 'enemy', 'back to themselves');
});

test('phase 2: doubled nouns — rage and dream make confusion; calmed foes cannot attack', async () => {
  const m = mage('M', ['rage', 'dream', 'calm']);
  m.feats.word_doubling = 1;
  const keys = B.Magic.spellOptions(m).map((o) => o.spellKey);
  assert.ok(keys.includes('beguile+rage+dream') || keys.includes('beguile+dream+rage'));
  const key = keys.find((k) => /beguile\+(rage\+dream|dream\+rage)$/.test(k));
  const f = armed('F', 'longsword', { side: 'enemy' });
  await castAt(m, [f], key, { target: f.id }, [10, 9, 1]);
  assert.ok(B.Conditions.has(f, 'confused') && !B.Conditions.has(f, 'enraged'));
  const c = armed('C', 'longsword', { side: 'enemy' });
  B.Conditions.add(c, 'calmed', { rounds: 2 });
  const chars = { [c.id]: c, [m.id]: m };
  const enc = Combat.createEncounter('t', [c.id, m.id], chars, 6, 1);
  enc.pos[c.id] = { x: 0, y: 0 }; enc.pos[m.id] = { x: 1, y: 0 };
  c.base.SPD = 9;
  await Combat.startRound(enc, chars, roller(1, [9, 1]));
  const th = Combat.legalActions(enc, chars, c.id).attacks.find((o) => o.motion === 'thrust');
  assert.strictEqual(th.affordable, false);
  assert.match(Combat.declare(enc, chars, { actor: c.id, type: 'strike', option: th, target: m.id }), /Calmed/);
});

test('phase 2: light sears the undead; darkness blocks sight; disease outlasts the fight', async () => {
  const m = mage('M', ['light']);
  const [skel] = Enemies.makeMonster('skeleton');
  const man = armed('Man', 'longsword', { side: 'enemy' });
  const bolt = { kind: 'strike', motion: 'spell', spell: { element: 'light', magnitude: 4 }, damage: [0, 0, 0] };
  const hs = Combat.computeHit(m, skel, bolt, {}), hm = Combat.computeHit(m, man, bolt, {});
  assert.ok(hs.toCON + hs.bluntToCON + hs.bluntToStamina > hm.toCON + hm.bluntToStamina);
  const enc = Combat.createEncounter('t', [m.id, man.id], { [m.id]: m, [man.id]: man }, 8, 3);
  B.Terrain.add(enc, 3, 1, 'darkness');
  assert.ok(B.Terrain.lineCheck(enc, { x: 1, y: 1 }, { x: 5, y: 1 }, 'missile').blocked);
  assert.ok(!B.Terrain.lineCheck(enc, { x: 2, y: 1 }, { x: 4, y: 1 }, 'melee').blocked, 'blades still reach through darkness');
  B.Conditions.add(man, 'diseased', { rounds: 10 });
  B.Conditions.add(man, 'slowed', { rounds: 2 });
  Combat.cleanup(enc, { [m.id]: m, [man.id]: man });
  assert.ok(B.Conditions.has(man, 'diseased') && !B.Conditions.has(man, 'slowed'));
});
