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
  const saved = { apScale: C0.apScale, staminaScale: C0.staminaScale, pierceMode: C0.pierceMode, passThroughByArmor: C0.passThroughByArmor };
  Object.assign(C0, { apScale: 1, staminaScale: 1, pierceMode: 'floor', passThroughByArmor: null });
  try { return fn(); } finally { Object.assign(C0, saved); }
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
  assert.strictEqual(C.regen(c), 2, 'Specifics: CON 5, WIS 5 regenerates 2 unarmored');
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

test('Specifics worked example: longsword swing vs mail = 1 stamina', () => {
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
});

test('Specifics worked example: same swing unarmored = 7 slashing + 7 CON of bleed', async () => {
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
});

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

test('declaration passes follow initiative and AP', async () => {
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
  assert.strictEqual(Combat.currentActor(enc), a.id);
  const thrust = C.attackOptions(a).find((o) => o.motion === 'thrust');
  assert.strictEqual(thrust.ap, 2 * B.CONFIG.apScale - 1, 'dagger thrust is 1 AP below a normal thrust');
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'strike', option: thrust, target: b.id }), null);
  assert.strictEqual(Combat.currentActor(enc), b.id);
  const la = Combat.legalActions(enc, chars, b.id);
  assert.strictEqual(la.defenses.length, 1);
  assert.strictEqual(Combat.declare(enc, chars, { actor: b.id, type: 'parry', answers: enc.decls[0].n }), null);
  Combat.concede(enc, a.id);
  Combat.concede(enc, b.id);
  assert.strictEqual(enc.phase, 'resolve');
  await Combat.resolveRound(enc, chars, roller(3, [10]));
  assert.ok(enc.log.some((l) => /parries/.test(l.text)));
});

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
      let guard = 500;
      while (enc.phase === 'declare' && guard-- > 0) {
        const id = Combat.currentActor(enc);
        const d = AI.choose(enc, chars, id, rng);
        if (d.type === 'concede') Combat.concede(enc, id);
        else {
          const err = Combat.declare(enc, chars, d);
          if (err) Combat.concede(enc, id);
        }
      }
      assert.ok(guard > 0, 'declaration loop terminates');
      await Combat.resolveRound(enc, chars, roll);
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
