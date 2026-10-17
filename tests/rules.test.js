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
  const saved = { apScale: C0.apScale, staminaScale: C0.staminaScale, pierceMode: C0.pierceMode, passThroughByArmor: C0.passThroughByArmor, moveScale: C0.moveScale, armorAdjust: C0.armorAdjust };
  Object.assign(C0, { apScale: 1, staminaScale: 1, pierceMode: 'floor', passThroughByArmor: null, moveScale: 1, armorAdjust: {} });
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

test('range bands: inside a weapon\'s reach it cannot attack; short weapons and daggers can', () => {
  const spear = opt(armed('S', 'spear'), (o) => o.motion === 'thrust');
  assert.deepStrictEqual([spear.minRange, spear.maxRange], [2, 4]);
  assert.ok(!C.inRange(spear, 1) && C.inRange(spear, 4));
  const dagger = opt(armed('D', 'dagger'), (o) => o.motion === 'thrust');
  assert.deepStrictEqual([dagger.minRange, dagger.maxRange], [1, 1]);
  const rapier = opt(armed('R', 'rapier'), (o) => o.motion === 'thrust');
  assert.deepStrictEqual([rapier.minRange, rapier.maxRange], [2, 3]);
  const swing = opt(armed('L', 'longsword'), (o) => o.motion === 'swing' && o.face === 'edge');
  assert.deepStrictEqual([swing.minRange, swing.maxRange], [2, 2]);
  const mace = opt(armed('M', 'flangedMace'), (o) => o.motion === 'swing');
  assert.deepStrictEqual([mace.minRange, mace.maxRange], [1, 2], 'short hafted weapons work up close');
  const half = armed('H', 'longsword');
  half.feats.half_swording = 1;
  assert.deepStrictEqual([opt(half, (o) => o.halfSword).minRange, opt(half, (o) => o.halfSword).maxRange], [1, 1]);
});

test('the older half-damage-up-close rule is still available as an option', () => {
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
});

async function duel(a, b, seedQueue) {
  a.side = 'party'; b.side = 'enemy';
  const chars = { [a.id]: a, [b.id]: b };
  const enc = Combat.createEncounter('t', [a.id, b.id], chars, 6, 1);
  enc.pos[a.id] = { x: 0, y: 0 };
  enc.pos[b.id] = { x: 2, y: 0 };
  await Combat.startRound(enc, chars, roller(1, seedQueue || [10, 1]));
  return { enc, chars };
}

test('a power swing must be wound up the round before, and the swinger is exposed', async () => {
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
  // Foe strikes; the winding heavy can't parry it.
  const thrust = Combat.legalActions(enc, chars, b.id).attacks.find((o) => o.motion === 'thrust');
  assert.strictEqual(Combat.declare(enc, chars, { actor: b.id, type: 'strike', option: thrust, target: a.id }), null);
  la = Combat.legalActions(enc, chars, a.id);
  assert.strictEqual(la.defenses[0].options.find((o) => o.type === 'parry').why, 'Winding up');
  assert.strictEqual(la.attacks.find((o) => o.motion === 'power').why, 'Release next round');
  Combat.concede(enc, a.id);
  Combat.concede(enc, b.id);
  await Combat.resolveRound(enc, chars, roller(2));
  assert.ok(a.status.windUp, 'wound up after resolution');
  await Combat.startRound(enc, chars, roller(3, [10, 1]));
  la = Combat.legalActions(enc, chars, a.id);
  const ready = la.attacks.find((o) => o.motion === 'power');
  assert.strictEqual(ready.why, null);
  assert.strictEqual(Combat.declare(enc, chars, { actor: a.id, type: 'strike', option: ready, target: b.id }), null);
});

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
  const parry = Combat.legalActions(enc, chars, b.id).defenses[0].options.find((o) => o.type === 'parry');
  assert.strictEqual(parry.why, "Can't parry an arrow");
  Combat.concede(enc, b.id);
  Combat.concede(enc, a.id);
  await Combat.resolveRound(enc, chars, roller(2));
  assert.strictEqual(a.inventory.arrows, 0);
  assert.strictEqual(Combat.legalActions(enc, chars, a.id).attacks.find((o) => o.motion === 'shoot').why, 'No arrows');
});

test('magic: words make spells; spell points, fire through armor, backlash', async () => {
  const m = fighter('Mage');
  m.feats = { casting: 2, verb_attack: 1, verb_launch: 1, mod_strong: 1 };
  m.nouns = ['fire'];
  m.stamina = C.maxStamina(m);
  assert.strictEqual(B.Magic.maxSP(m), 5 + 3 * 2);
  const labels = C.attackOptions(m).filter((o) => o.spell).map((o) => o.label).sort();
  assert.deepStrictEqual(labels, ['Attack + Fire', 'Attack + Fire + Strong', 'Launch + Fire', 'Launch + Fire + Strong']);
  const bolt = opt(m, (o) => o.label === 'Launch + Fire');
  assert.strictEqual(bolt.spCost, 4);
  assert.strictEqual(opt(m, (o) => o.label === 'Launch + Fire + Strong').windUp, true);
  const knight = fighter('Knight');
  knight.armor = Items.makeArmor('plate', 'full', 'standard'); // B mitigation 3 → stops 2 fire
  const h = Combat.computeHit(m, knight, bolt, {});
  assert.strictEqual(h.fire, 3);
  assert.strictEqual(h.toCON + h.bluntToStamina, 1);
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

test('a longbow must be drawn a round ahead; an archer can redraw after loosing', async () => {
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
  la = Combat.legalActions(enc, chars, a.id);
  assert.ok(la.other.find((o) => o.type === 'windUp'), 'can redraw after loosing');
});

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
    Combat.declare(enc, chars, { actor: b.id, type: 'block', answers: enc.decls[0].n });
    Combat.concede(enc, a.id);
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
