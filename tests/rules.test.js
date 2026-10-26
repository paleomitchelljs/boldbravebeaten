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
  const D0 = C0.defense;
  const spec = {
    apScale: 1, apDisplay: 1, costScale: null, apBase: 3, apSpdContinuous: false, apCurve: null, moveAP: null, wholeTurnAction: false,
    armorActionAP: 0, quickCut: null, minActionAP: 1, minStrikeAP: 1, weaponWear: null, weariness: null, armorPierceWear: 0,
    defense: Object.assign({}, D0, { block: Object.assign({}, D0.block, { opposed: false }), dodgeBonus: 0, absorb: null, dodgeStamina: null }),
    staminaScale: 1, pierceMode: 'floor', passThroughByArmor: null, pierce: null, moveScale: 1, armorAdjust: {}, standUp: null, grappling: null, weaponModel: 'table',
    // The Specifics had no hit locations: one d4 per point of a cut, wherever it lands.
    locations: Object.assign({}, C0.locations, { wounds: null }),
  };
  const saved = {};
  for (const k of Object.keys(spec)) saved[k] = C0[k];
  Object.assign(C0, spec);
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

// The screen's side of a fight: dice, and who reacts how. By default nobody reacts.
const noReact = () => null;
// Run fn with some CONFIG keys set (restored after).
function withConfig(patch, fn) {
  const saved = {};
  for (const k of Object.keys(patch)) saved[k] = B.CONFIG[k];
  Object.assign(B.CONFIG, patch);
  let out;
  try { out = fn(); } catch (e) { Object.assign(B.CONFIG, saved); throw e; }
  if (out && typeof out.then === 'function') return out.finally(() => Object.assign(B.CONFIG, saved));
  Object.assign(B.CONFIG, saved);
  return out;
}

// Wounds the same wherever they land (no location tables): the tests below script their rolls without a
// location roll.
function noWounds(fn) { return withConfig({ locations: Object.assign({}, B.CONFIG.locations, { wounds: null }) }, fn); }

function io(seed, queue, react) { return { roller: roller(seed, queue), react: react || noReact }; }
// Everyone still to take a turn ends it: the round closes (bleeding, regeneration, wind-ups lapse).
async function closeRound(enc, chars, x) {
  let guard = 50;
  while (enc.phase === 'turn' && guard-- > 0) await Combat.endTurn(enc, chars, Combat.currentActor(enc), x || io(99));
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

test('the turn budget: pool 6 at SPD 5 holds one big action, a step and a swing, or three quick actions', () => {
  const c = armed('Budget', 'longsword');
  const AP = (n) => n * B.CONFIG.apScale;
  const pool = C.apPool(c);
  assert.strictEqual(C.fmtAP(pool), '6');
  const cost = (motion) => C.attackOptions(c).find((o) => o.motion === motion).ap;
  const quick = [cost('thrust'), C.actionCost(c, 'parry').ap, C.actionCost(c, 'dodge').ap, C.moveCost(c, 4)];
  assert.deepStrictEqual(quick, [AP(2), AP(2), AP(2), AP(2)], 'thrust, parry, dodge and a 4-square move are quick');
  assert.strictEqual(cost('swing'), AP(4), 'a swing is medium');
  assert.strictEqual(cost('twoHanded'), AP(6), 'a two-handed swing is big');
  assert.strictEqual(C.moveCost(c, 5), AP(4), 'a longer move is two moves');
  assert.ok(3 * AP(2) <= pool && C.moveCost(c, 2) + cost('swing') <= pool && cost('twoHanded') <= pool);
  assert.ok(C.moveCost(c, 2) + cost('swing') + C.moveCost(c, 2) > pool, 'but not in, swing and out');
  c.base.SPD = 6;
  assert.strictEqual(C.apPool(c), AP(6.5), 'every point of SPD is half an AP');
  // Weapon speed shows: a dagger thrust is quicker than a sword thrust.
  assert.ok(opt(armed('D', 'dagger'), (o) => o.motion === 'thrust').ap < cost('thrust'));
});

test('Quick feats take a share off every use: half at the top rank', () => {
  const c = armed('Quick', 'longsword');
  const thrust = () => C.attackOptions(c).find((o) => o.motion === 'thrust').ap;
  const full = thrust();
  const cuts = [1, 2, 3].map((r) => { c.feats.quick_thrust = r; return thrust(); });
  assert.deepStrictEqual(cuts, [full - Math.round(full / 6), full - Math.round(full / 3), full / 2]);
  c.feats.quick_parry = 2;
  assert.strictEqual(C.actionCost(c, 'parry').ap, C.actionCost(fighter('X'), 'parry').ap / 2, 'Quick Parry II halves a parry');
});

test('armor makes every action dearer instead of shrinking the pool', () => {
  const c = armed('Plated', 'longsword');
  const before = { pool: C.apPool(c), thrust: opt(c, (o) => o.motion === 'thrust').ap, move: C.moveCost(c, 1), spa: C.squaresPerAP(c) };
  c.armor = Items.makeArmor('plate', 'full', 'standard');
  const plate = Math.round(3 * B.CONFIG.armorActionAP * B.CONFIG.apScale);
  assert.strictEqual(C.apPool(c), before.pool, 'the pool stays');
  assert.strictEqual(opt(c, (o) => o.motion === 'thrust').ap, before.thrust + plate);
  assert.strictEqual(C.moveCost(c, 1), before.move + plate);
  assert.ok(C.squaresPerAP(c) < before.spa, 'and it still slows the feet');
  c.feats.plate_mobility = 1;
  assert.ok(opt(c, (o) => o.motion === 'thrust').ap < before.thrust + plate, 'Plate Mobility eases it');
});

test('fatigue lowers the AP pool', () => {
  const S = B.CONFIG.apScale;
  const c = fighter('Tired');
  const full = C.apPool(c);
  const max = C.maxStamina(c);
  c.stamina = Math.floor(max * 0.49);
  assert.strictEqual(C.apPool(c), full - S);
  c.stamina = Math.floor(max * 0.24);
  assert.strictEqual(C.apPool(c), full - 2 * S);
});

test('one big action: with nothing spent, an action dearer than the pool takes the whole turn', async () => {
  const a = armed('Big', 'greatsword', { side: 'party' });
  const b = armed('B', 'longsword', { side: 'enemy' });
  a.base.STR = 8; a.base.SPD = 3; b.base.CON = 14;
  for (const x of [a, b]) x.stamina = C.maxStamina(x);
  const chars = { [a.id]: a, [b.id]: b };
  const enc = Combat.createEncounter('t', [a.id, b.id], chars, 4, 1);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[b.id] = { x: 1, y: 0 };
  await Combat.startRound(enc, chars, roller(3, [10, 1]));
  const big = Combat.legalActions(enc, chars, a.id).attacks.find((o) => o.motion === 'twoHanded');
  assert.ok(big.ap > enc.ap[a.id] && big.affordable, 'dearer than the pool, but allowed');
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: big, target: b.id }, io(4)), null);
  assert.strictEqual(enc.ap[a.id], 0, 'it took the whole turn');
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

test('Specifics worked example: same swing unarmored = 7 slashing + 7 CON of bleed', () => noWounds(() => tableWeapons(async () => {
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
})));

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
  const onFull = Combat.computeHit(atk, tgt, half).toCON;
  // A half harness (torso, arms, legs: CONFIG.locations) is full plate where it is and bare where it isn't.
  tgt.armor = Items.makeArmor('plate', 'half', 'average');
  assert.strictEqual(Combat.computeHit(atk, tgt, half, { location: 'torso' }).toCON, onFull);
  assert.strictEqual(Combat.computeHit(atk, tgt, half, { location: 'head' }).toCON, half.damage[0], 'the bare head takes the whole point');
  const mixed = Combat.computeHit(atk, tgt, half).toCON;
  assert.ok(mixed > onFull && mixed < half.damage[0], 'the AI sees the expectation over the locations');
}));

test('roll mode (without CONFIG.pierce): each leftover piercing point has a chance to reach CON', () => noWounds(() => withConfig({ pierce: null }, async () => {
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
})));

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

test('turns (the user\'s example): actions resolve at once; parries are paid from the defender\'s pool; the round ends when everyone has gone', async () => {
  // Clubs: blows that wind C, so C is still standing for its turn.
  const a = armed('A', 'club', { side: 'party' });
  const b = armed('B', 'club', { side: 'party' });
  const c = armed('C', 'longsword', { side: 'enemy' });
  a.base.SPD = 9; b.base.SPD = 8; c.base.SPD = 1;
  c.base.CON = 14;
  for (const x of [a, b, c]) x.stamina = C.maxStamina(x);
  const chars = { [a.id]: a, [b.id]: b, [c.id]: c };
  const enc = Combat.createEncounter('t', [a.id, b.id, c.id], chars, 6, 3);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[b.id] = { x: 0, y: 2 }; enc.pos[c.id] = { x: 3, y: 1 };
  await Combat.startRound(enc, chars, roller(3, [5, 5, 5]));
  assert.deepStrictEqual(enc.order, [a.id, b.id, c.id], 'initiative order A, B, C');
  assert.strictEqual(enc.phase, 'turn');
  assert.strictEqual(Combat.currentActor(enc), a.id);
  // C parries everything it can; A and B never react.
  const x = io(4, [], (req) => (req.kind === 'defend' && req.actor === c.id ? 'parry' : null));
  enc.ap[c.id] = 6 * B.CONFIG.apScale; // enough for two parries and a turn
  const pool = enc.ap[c.id];
  const parry = C.actionCost(c, 'parry').ap;
  // A moves up to C and swings: the blow resolves at once, and C's parry comes out of C's AP.
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'move', to: { x: 2, y: 0 } }, x), null);
  assert.deepStrictEqual(enc.pos[a.id], { x: 2, y: 0 }, 'the move happened already');
  const thrust = Combat.legalActions(enc, chars, a.id).attacks.find((o) => o.motion === 'swing');
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: thrust, target: c.id }, x), null);
  assert.ok(enc.log.some((l) => /C parries A's|C's parry fails/.test(l.text)), 'C reacted');
  assert.strictEqual(enc.ap[c.id], pool - parry);
  await Combat.endTurn(enc, chars, a.id, x);
  // B does the same; C parries again.
  assert.strictEqual(Combat.currentActor(enc), b.id);
  assert.strictEqual(await Combat.act(enc, chars, { actor: b.id, type: 'move', to: { x: 2, y: 2 } }, x), null);
  const thrustB = Combat.legalActions(enc, chars, b.id).attacks.find((o) => o.motion === 'swing');
  assert.strictEqual(await Combat.act(enc, chars, { actor: b.id, type: 'strike', option: thrustB, target: c.id }, x), null);
  assert.strictEqual(enc.ap[c.id], pool - 2 * parry, 'two parries, paid before C ever had a turn');
  await Combat.endTurn(enc, chars, b.id, x);
  // C's turn comes with what is left; when C is done the round ends.
  assert.strictEqual(Combat.currentActor(enc), c.id);
  assert.strictEqual(Combat.legalActions(enc, chars, c.id).ap, pool - 2 * parry);
  await Combat.endTurn(enc, chars, c.id, x);
  assert.strictEqual(enc.phase, 'roundEnd');
});

test('a turn may spend the whole pool; a fighter out of AP takes the blow on the armor', async () => {
  const a = armed('A', 'longsword', { side: 'party' });
  const b = armed('B', 'longsword', { side: 'enemy' });
  a.base.SPD = 9; b.base.SPD = 1; b.base.CON = 14;
  b.armor = Items.makeArmor('mail', 'full', 'standard');
  for (const x of [a, b]) x.stamina = C.maxStamina(x);
  const chars = { [a.id]: a, [b.id]: b };
  const enc = Combat.createEncounter('t', [a.id, b.id], chars, 6, 1);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[b.id] = { x: 1, y: 0 };
  await Combat.startRound(enc, chars, roller(3, [5, 5]));
  const asked = [];
  const x = io(4, [], (req) => { asked.push(req.actor); return null; });
  enc.ap[b.id] = 0; // B spent everything already
  const swing = Combat.legalActions(enc, chars, a.id).attacks.find((o) => o.motion === 'swing' && o.affordable);
  assert.ok(swing.ap > B.CONFIG.apScale * 2, 'a heavy blow, more than the old per-pass cap');
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: swing, target: b.id }, x), null);
  assert.deepStrictEqual(asked, [], 'no AP, no reaction offered');
  assert.ok(enc.log.some((l) => /A's .* hits B/.test(l.text)));
  // A keeps going until the pool is spent; then the turn passes by itself.
  while (Combat.currentActor(enc) === a.id) {
    const la = Combat.legalActions(enc, chars, a.id);
    const any = la.attacks.find((o) => o.affordable && o.targets.some((t) => t.id === b.id && t.inReach));
    if (!any) { await Combat.endTurn(enc, chars, a.id, x); break; }
    await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: any, target: b.id }, x);
  }
  assert.notStrictEqual(Combat.currentActor(enc), a.id);
});



test('reactions: the AI defends a blow worth stopping and lets armor take one that is not', () => tableWeapons(async () => {
  const atk = armed('Atk', 'dagger', { side: 'enemy' });
  const bare = armed('Bare', 'longsword', { side: 'party' });
  const plated = armed('Plated', 'longsword', { side: 'party' });
  plated.armor = Items.makeArmor('plate', 'full', 'standard');
  const chars = { [atk.id]: atk, [bare.id]: bare, [plated.id]: plated };
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, 6, 3);
  enc.pos[atk.id] = { x: 1, y: 1 }; enc.pos[bare.id] = { x: 2, y: 1 }; enc.pos[plated.id] = { x: 0, y: 1 };
  await Combat.startRound(enc, chars, roller(1, [10, 1, 1]));
  // A dagger's slash: plate stops all of it (a stab might still find a gap, CONFIG.pierce).
  const stab = C.attackOptions(atk).find((o) => o.motion === 'swing');
  for (const t of [bare, plated]) enc.ap[t.id] = 5 * B.CONFIG.apScale;
  const ask = (t) => {
    const d = { actor: atk.id, type: 'strike', option: stab, target: t.id };
    const { options } = Combat.defenseOptions(enc, chars, t, atk, d);
    assert.ok(options.some((o) => o.type === 'parry'), 'a parry is offered, with its odds');
    assert.ok(options.every((o) => o.odds > 0 && o.odds <= 1));
    return AI.react(enc, chars, { kind: 'defend', actor: t.id, attacker: atk.id, decl: d, hidden: false, options });
  };
  assert.ok(ask(bare), 'unarmored: parry the dagger');
  assert.strictEqual(ask(plated), null, 'in plate: let it glance off');
}));

test('Feint hides a blow from a defender without Read Attack: they defend blind, and a wrong guess is wasted', async () => {
  const a = fighter('Feinter', { side: 'party' });
  const b = fighter('Mark', { side: 'enemy' });
  a.feats.feint = 1;
  a.weapons.push(Items.makeWeapon('dagger'));
  a.wield = a.weapons[0].id;
  const chars = { [a.id]: a, [b.id]: b };
  const enc = Combat.createEncounter('t', [a.id, b.id], chars, 4, 3);
  const d = { actor: a.id, type: 'strike', option: C.attackOptions(a)[0], target: b.id, ap: 1 };
  assert.ok(Combat.describeDecl(enc, chars, d, b.id).hidden);
  enc.ap[b.id] = 5 * B.CONFIG.apScale;
  const blind = Combat.defenseOptions(enc, chars, b, a, d);
  assert.ok(blind.hidden && blind.options.length && blind.options.every((o) => o.odds === null), 'no odds when you cannot read it');
  b.feats.read_attack = 1;
  assert.ok(!Combat.describeDecl(enc, chars, d, b.id).hidden);
  assert.ok(Combat.defenseOptions(enc, chars, b, a, d).options.every((o) => o.odds != null));
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
      while (enc.phase === 'turn' && guard-- > 0) {
        const id = Combat.currentActor(enc);
        await Combat.submit(enc, chars, AI.choose(enc, chars, id, rng), { roller: roll });
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

test('range bands (the user\'s reach): one-handers swing 1 and thrust 2, two-handers 2 and 3, spears to 4; inside a long weapon\'s reach or in a clinch its blows land half as hard, all blunt', () => tableWeapons(() => {
  const band = (type, motion) => { const o = opt(armed('X', type), (x) => x.motion === motion); return [o.minRange, o.maxRange, o.closePenalty]; };
  assert.deepStrictEqual(band('dagger', 'thrust'), [1, 1, false]);
  assert.deepStrictEqual(band('dagger', 'swing'), [1, 1, false]);
  assert.deepStrictEqual(band('rapier', 'swing'), [1, 1, false]);
  assert.deepStrictEqual(band('rapier', 'thrust'), [1, 2, false]);
  assert.deepStrictEqual(band('longsword', 'thrust'), [1, 2, false]);
  assert.deepStrictEqual(band('flangedMace', 'swing'), [1, 1, false]);
  assert.deepStrictEqual(band('greatsword', 'twoHanded'), [1, 2, true], 'a two-hander swings to 2, cramped at 1');
  assert.deepStrictEqual(band('greatsword', 'thrust'), [1, 3, true]);
  assert.deepStrictEqual(band('spear', 'thrust'), [1, 4, true], 'a spear thrusts to 4 and can jab with the shaft');
  assert.deepStrictEqual(band('heavySpear', 'thrust'), [1, 4, true]);
  assert.deepStrictEqual(band('warScythe', 'twoHanded'), [1, 3, true], 'a scythe sweeps to 3');
  assert.ok(!opt(armed('X', 'warScythe'), (x) => x.motion === 'thrust'), 'and does not thrust');
  const a = armed('L', 'longsword');
  const t = fighter('T');
  const swing = opt(a, (o) => o.motion === 'swing' && o.face === 'edge');
  assert.deepStrictEqual(Combat.computeHit(a, t, swing, { distance: 1 }).vec, [0, 7, 1], 'a sword works at arm\'s length');
  a.status.grapple = { partner: t.id, level: 'clinch', role: 'mutual' };
  assert.deepStrictEqual(Combat.computeHit(a, t, swing, { distance: 1 }).vec, [0, 0, 4], 'in a clinch it is cramped: 8 force → 4 blunt');
  a.status.grapple = null;
  const g = armed('G', 'greatsword');
  const gs = opt(g, (o) => o.motion === 'twoHanded' && o.face === 'edge');
  const full = Combat.computeHit(g, t, gs, { distance: 2 }).vec;
  assert.deepStrictEqual(Combat.computeHit(g, t, gs, { distance: 1 }).vec, [0, 0, Math.floor((full[0] + full[1] + full[2]) / 2)], 'a greatsword at 1 is cramped');
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
  assert.strictEqual(draw.ap, Math.max(C.minAP(), Math.round(C.baseAP(0.5))));
  assert.match(draw.note, /drops/);
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'drawSidearm' }, io(2)), null);
  assert.ok(Combat.legalActions(enc, chars, a.id).attacks.some((o) => o.weaponType === 'dagger'), 'fights with the dagger at once');
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
  a.status.grapple = { partner: t.id, level: 'hold', role: 'held' };
  const held = Combat.computeHit(a, t, th, { distance: 1 }).vec;
  assert.ok(free[0] > 0);
  assert.deepStrictEqual(held, [0, 0, Math.floor(free[0] / 2)]);
});

test('the older half-damage-up-close rule is still available as an option', () => tableWeapons(() => {
  const saved = B.CONFIG.range.closeRule;
  B.CONFIG.range.closeRule = 'half';
  try {
    const a = armed('G', 'greatsword');
    const t = fighter('T');
    const swing = opt(a, (o) => o.motion === 'twoHanded' && o.face === 'edge');
    assert.strictEqual(swing.minRange, 1);
    const S = Combat.computeHit(a, t, swing, { distance: 2 }).S;
    assert.strictEqual(Combat.computeHit(a, t, swing, { distance: 1 }).S, Math.floor(S / 2));
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
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'windUp', option: wind.option }, io(2)), null);
  assert.ok(a.status.windUp, 'wound up at once');
  la = Combat.legalActions(enc, chars, a.id);
  assert.strictEqual(la.attacks.find((o) => o.motion === 'power').why, 'Release next round');
  await Combat.endTurn(enc, chars, a.id, io(2));
  // Foe strikes; the winding heavy is offered no parry.
  assert.strictEqual(Combat.currentActor(enc), b.id);
  const thrust = Combat.legalActions(enc, chars, b.id).attacks.find((o) => o.motion === 'thrust');
  const offered = [];
  const x = io(3, [], (req) => { offered.push(...req.options.map((o) => o.type)); return null; });
  await Combat.act(enc, chars, { actor: b.id, type: 'strike', option: thrust, target: a.id }, x);
  assert.ok(!offered.includes('parry'), 'no parry while winding up');
  await closeRound(enc, chars);
  assert.ok(a.status.windUp, 'still wound up for next round');
  await Combat.startRound(enc, chars, roller(3, [10, 1]));
  la = Combat.legalActions(enc, chars, a.id);
  const ready = la.attacks.find((o) => o.motion === 'power');
  assert.strictEqual(ready.why, null);
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: ready, target: b.id }, io(4)), null);
}));

test('an unreleased wind-up is lost at the end of the next round', async () => {
  const a = armed('Heavy', 'greatsword');
  a.feats.power_swing = 1;
  const b = armed('Foe', 'longsword');
  const { enc, chars } = await duel(a, b);
  const wind = Combat.legalActions(enc, chars, a.id).other.find((o) => o.type === 'windUp');
  await Combat.act(enc, chars, { actor: a.id, type: 'windUp', option: wind.option }, io(2));
  await closeRound(enc, chars);
  await Combat.startRound(enc, chars, roller(3, [10, 1]));
  await closeRound(enc, chars);
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
  const offered = [];
  const x = io(2, [], (req) => { offered.push(...req.options.map((o) => o.type)); return null; });
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: s, target: b.id }, x), null);
  assert.ok(!offered.includes('parry'), 'no parry is offered against an arrow');
  assert.ok(enc.log.some((l) => /hits Foe/.test(l.text)), 'the arrow lands');
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
  // 13 vs 3: a margin of 5+ pushes 2 squares.
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'shove', target: b.id }, io(2, [9, 1])), null);
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
  await Combat.act(enc, chars, { actor: a.id, type: 'windUp', option: la.other.find((o) => o.type === 'windUp').option }, io(2));
  await closeRound(enc, chars);
  await Combat.startRound(enc, chars, roller(3, [10, 1]));
  la = Combat.legalActions(enc, chars, a.id);
  const loose = la.attacks.find((o) => o.motion === 'shoot');
  assert.strictEqual(loose.why, null);
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: loose, target: b.id }, io(4)), null);
  la = Combat.legalActions(enc, chars, a.id);
  assert.ok(la.other.find((o) => o.type === 'windUp'), 'can redraw after loosing');
}));

test('a blocked power swing breaks a shield of equal or softer material and drives through', async () => {
  const run = async (material, quality) => {
    const a = armed('Heavy', 'greatsword');
    a.base.STR = 7; // a greatsword wants a strong wielder (weapon strain)
    a.feats.power_swing = 1;
    a.status.windUp = null;
    const b = armed('Shield', 'longsword');
    b.base.CON = 12;
    b.shield = Items.makeShield('round', material, quality);
    b.stamina = C.maxStamina(b);
    const { enc, chars } = await duel(a, b);
    const power = C.attackOptions(a).find((o) => o.motion === 'power');
    a.status.windUp = { key: C.optionKey(power), label: power.label, round: 0 };
    const staminaBefore = b.stamina;
    // B blocks (d10 = 10 holds it), and the blow still breaks or drives through.
    const x = io(2, [10], (req) => (req.kind === 'defend' && req.actor === b.id ? 'block' : null));
    assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: power, target: b.id }, x), null);
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
  a.status.grapple = { partner: t.id, level: 'hold', role: 'holder' }; t.status.grapple = { partner: a.id, level: 'hold', role: 'held' };
  const before = a.stamina;
  await closeRound(enc, chars);
  assert.ok(a.stamina < before, 'holding costs stamina at the end of the round');
  a.stamina = 1;
  await Combat.startRound(enc, chars, roller(3, [10, 1]));
  await closeRound(enc, chars);
  assert.strictEqual(a.status.grapple, null, 'too spent to keep the hold');
  assert.strictEqual(t.status.grapple, null);
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
  const err = await Combat.act(g.enc, g.chars, { actor: g.a.id, type, target: g.t.id }, io(2, rolls));
  assert.strictEqual(err, null, type + ': ' + err);
  await closeRound(g.enc, g.chars);
  return g.enc.log.map((l) => l.text).join('\n');
}

test('grappling ladder: clinch, hold, pin, each a directly opposed roll', async () => {
  const g = await grapplePair(null);
  const la = Combat.legalActions(g.enc, g.chars, g.a.id);
  // Free: only a clinch is offered from the ladder.
  await Combat.startRound(g.enc, g.chars, roller(1, [10, 1]));
  assert.deepStrictEqual(Combat.legalActions(g.enc, g.chars, g.a.id).maneuvers.filter((m) => Combat.GRAPPLE_STEPS.includes(m.type)).map((m) => m.type), ['clinch']);
  await closeRound(g.enc, g.chars);
  // Clinch: 6+5=11 vs 4+3=7 → win by 4: a clinch, not yet a hold.
  await step(g, 'clinch', [6, 4]);
  assert.deepStrictEqual(g.a.status.grapple, { partner: g.t.id, level: 'clinch', role: 'mutual' });
  assert.deepStrictEqual(g.t.status.grapple, { partner: g.a.id, level: 'clinch', role: 'mutual' });
  assert.ok(!C.attackOptions(g.t).some((o) => o.motion === 'twoHanded'), 'no two-handed swings in a clinch');
  assert.strictEqual(Combat.legalActions(g.enc, g.chars, g.t.id).move, null, "can't step away without breaking");
  // Grapple: win by 1 → hold.
  await step(g, 'grapple', [3, 4]);
  assert.strictEqual(C.holding(g.a), g.t.id);
  assert.deepStrictEqual(g.t.status.grapple, { partner: g.a.id, level: 'hold', role: 'held' });
  // Pin: break score max(STR 6, DEX 5)/2 = 3; 5+5=10 vs 1+3=4.
  await step(g, 'pin', [5, 1]);
  assert.ok(C.isPinned(g.t));
  assert.deepStrictEqual(C.attackOptions(g.t), [], 'a pinned fighter can only try to break');
  void la;
});

test('grappling: a big win jumps two rungs; a big loss reverses', async () => {
  const g = await grapplePair(null);
  await step(g, 'clinch', [10, 1]); // 15 vs 4: straight to a hold
  assert.strictEqual(C.holding(g.a), g.t.id);
  const h = await grapplePair(null);
  await step(h, 'clinch', [6, 4]);
  await step(h, 'grapple', [1, 10]); // 6 vs 13: lose by 7 → they hold you
  assert.strictEqual(C.holding(h.t), h.a.id);
});

test('grappling and armor: plate is easy to grab but hard to throw', async () => {
  // Same rolls; the attacker's grapple roll ties against unarmored but wins against plate (+2 handles).
  const tie = await grapplePair(null);
  await step(tie, 'clinch', [6, 4]);
  await step(tie, 'grapple', [2, 4]); // 7 vs 7
  assert.ok(!C.holding(tie.a));
  const plate = await grapplePair('plate');
  await step(plate, 'clinch', [6, 4]);
  await step(plate, 'grapple', [2, 4]); // 7 + 2 vs 7
  assert.strictEqual(C.holding(plate.a), plate.t.id);
  // Throw: grapple score 5 vs 3 + plate footing 2: rolls 4 vs 6 → 9 vs 11, kept.
  const log = await step(plate, 'throw', [4, 6]);
  assert.match(log, /keeps their feet/);
  // The same throw against an unarmored, held fighter lands: 9 vs 9 is a tie, so roll 5 vs 6.
  const bare = await grapplePair(null);
  await step(bare, 'clinch', [10, 1]);
  await step(bare, 'throw', [5, 6]);
  assert.ok(bare.t.status.prone, 'thrown prone');
  assert.ok(!bare.a.status.grapple && !bare.t.status.grapple, 'the throw ends the grapple');
});

test('grappling: guards never meet a grapple; pinned armor is pierced', async () => {
  const g = await grapplePair('plate');
  await step(g, 'clinch', [10, 1]);
  await step(g, 'pin', [10, 1]);
  assert.ok(C.isPinned(g.t));
  const stab = C.attackOptions(g.a).find((o) => o.motion === 'thrust');
  const pinned = Combat.computeHit(g.a, g.t, stab, { distance: 1 });
  g.t.status.grapple = Object.assign({}, g.t.status.grapple, { level: 'hold' });
  const held = Combat.computeHit(g.a, g.t, stab, { distance: 1 });
  assert.strictEqual(pinned.pierce, 'gap', 'a pin opens the armor: the point goes in at a gap');
  assert.ok(held.gap && pinned.toCON > held.toCON, 'held but not pinned, it must find one');
  // Guards never meet a grapple: no reaction is offered against one.
  g.enc.ap[g.t.id] = 10;
  assert.deepStrictEqual(Combat.defenseOptions(g.enc, g.chars, g.t, g.a, { actor: g.a.id, type: 'grapple', target: g.t.id }).options, []);
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
  const hit = (o, armor) => Combat.computeHit(a, target(armor), o, { distance: 4 });
  assert.strictEqual(hit(bodkin, 'mail').pierce, 'burst', 'a longbow bodkin bursts mail');
  assert.ok(hit(broad, 'mail').gap, 'a broadhead must find a gap in it');
  assert.ok(hit(bodkin, 'plate').gap && hit(broad, 'plate').gap, 'plate: every arrow must find a gap');
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
      while (enc.phase === 'turn' && guard-- > 0) {
        const id = Combat.currentActor(enc);
        await Combat.submit(enc, chars, AI.choose(enc, chars, id, rng, chars[id].policy), { roller: roll });
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
  assert.strictEqual(after.thrust, before.thrust + Math.round(B.CONFIG.web.ap * C.costScale()));
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

test('wound roll: armor guards the vitals; a vital stab triples its CON damage', () => noWounds(async () => {
  const a = armed('A', 'longsword');
  const thrust = opt(a, (o) => o.motion === 'thrust');
  const naked = fighter('N');
  const mailed = fighter('M'); mailed.armor = Items.makeArmor('mail', 'full', 'standard');
  const plated = fighter('P'); plated.armor = Items.makeArmor('plate', 'full', 'standard');
  const v = (t) => Combat.computeHit(a, t, thrust).pierceVital;
  assert.ok(v(naked) > v(mailed) && v(mailed) > v(plated));
  // Pinned: the armor no longer guards the vitals.
  plated.status.grapple = { partner: 'A', level: 'pin', role: 'held' };
  assert.strictEqual(v(plated), v(naked));
  // A wound roll of 1 is vital: ×3 CON.
  const t = fighter('T'); t.base.CON = 30; t.stamina = C.maxStamina(t);
  const enc = { hitThisRound: {}, fortressUsed: {} };
  await Combat.applyHit(enc, { [a.id]: a, [t.id]: t }, a, t, thrust, roller(1, [1]));
  assert.strictEqual(t.damage.CON, thrust.damage[0] * B.CONFIG.vital.mult);
  const u = fighter('U'); u.base.CON = 30; u.stamina = C.maxStamina(u);
  await Combat.applyHit(enc, { [a.id]: a, [u.id]: u }, a, u, thrust, roller(1, [10]));
  assert.strictEqual(u.damage.CON, thrust.damage[0]);
}));

test('opportunity strikes: entering a foe\'s reach, leaving it, or a second step within it draws a blow; one step within is free', async () => {
  const make = (weapon, h) => {
    const s = armed('S', weapon, { side: 'party' });
    const d = armed('D', 'dagger', { side: 'enemy' });
    s.base.SPD = 1; d.base.SPD = 9; d.base.CON = 12;
    for (const c of [s, d]) c.stamina = C.maxStamina(c);
    const chars = { [s.id]: s, [d.id]: d };
    const enc = Combat.createEncounter('t', [s.id, d.id], chars, 8, h || 1);
    return { s, d, chars, enc };
  };
  const strikeIfAsked = (asked) => (req) => { if (req.kind === 'opportunity') { asked.push(req); return req.options[0]; } return null; };
  const run = async (f, sAt, dAt, to, rolls) => {
    f.enc.pos[f.s.id] = sAt; f.enc.pos[f.d.id] = dAt;
    await Combat.startRound(f.enc, f.chars, roller(3, [1, 9]));
    assert.strictEqual(Combat.currentActor(f.enc), f.d.id);
    const asked = [];
    await Combat.act(f.enc, f.chars, { actor: f.d.id, type: 'move', to }, io(4, rolls || [10, 10, 10, 10], strikeIfAsked(asked)));
    return asked;
  };
  // Walking away from an adjacent swordsman: one step back is within his thrust (free); he strikes as D
  // steps out of it, and a hit stops D at its edge.
  let f = make('longsword');
  const reach = Math.max(...C.attackOptions(f.s).filter((o) => !o.ranged).map((o) => o.maxRange));
  let asked = await run(f, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 0 });
  assert.strictEqual(asked.length, 1, 'one chance, from the swordsman');
  assert.strictEqual(asked[0].why, 'leaves');
  assert.ok(f.enc.log.some((l) => /S strikes at D as they go/.test(l.text)));
  if (C.totalDamage(f.d) > 0 || !C.isActive(f.d)) assert.deepStrictEqual(f.enc.pos[f.d.id], { x: reach, y: 0 }, 'a hit stops the move');
  // Walking up to a sword from outside its reach: the thrust meets D as he comes in, at the edge.
  f = make('longsword');
  asked = await run(f, { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 1, y: 0 });
  assert.strictEqual(asked.length, 1, 'entering the reach provokes, once');
  assert.strictEqual(asked[0].why, 'enters');
  if (C.totalDamage(f.d) > 0 || !C.isActive(f.d)) assert.deepStrictEqual(f.enc.pos[f.d.id], { x: reach, y: 0 }, 'a hit stops him at the edge');
  // One guarded step within reach (a sidestep) is free.
  f = make('longsword', 3);
  asked = await run(f, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 });
  assert.strictEqual(asked.length, 0, 'a single step within reach provokes nothing');
  assert.deepStrictEqual(f.enc.pos[f.d.id], { x: 1, y: 1 });
  // Two steps within reach: the second provokes.
  f = make('longsword', 3);
  asked = await run(f, { x: 0, y: 1 }, { x: 2, y: 0 }, { x: 2, y: 2 });
  assert.strictEqual(asked.length, 1, 'circling inside the reach provokes');
  assert.strictEqual(asked[0].why, 'moves');
  // Walking right up to a spearman: one blow, as you come into his reach.
  f = make('spear');
  asked = await run(f, { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 1, y: 0 });
  assert.strictEqual(asked.length, 1, 'the spear gets its blow on the way in');
  // Stepping to the edge of a reach from far off still provokes; stopping short of it does not.
  f = make('longsword');
  asked = await run(f, { x: 0, y: 0 }, { x: 6, y: 0 }, { x: reach + 1, y: 0 });
  assert.strictEqual(asked.length, 0, 'short of the reach, nothing');
});

test('fend off: a long weapon shoves at range 2', async () => {
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
  assert.strictEqual(await Combat.act(enc, chars, { actor: s.id, type: 'shove', target: d.id }, io(4, [5, 5])), null);
  assert.match(enc.log.map((l) => l.text).join('\n'), /S shoves D back 1 square/);
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
  // A harder blow (more force) is harder to parry: a greatsword's two-handed swing against a thrust.
  const g = armed('G', 'greatsword');
  g.base.STR = 7;
  const gs = opt(g, (o) => o.motion === 'thrust');
  const big = opt(g, (o) => o.motion === 'twoHanded');
  assert.ok(Combat.defenseOdds(d, 'parry', 'twoHanded', g, big) < Combat.defenseOdds(d, 'parry', 'thrust', human, opt(human, (o) => o.motion === 'thrust')));
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
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'move', to: { x: 4, y: 2 } }, io(4)), null);
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
  assert.ok(M.combines('hex', 'life') && M.combines('bless', 'life') && M.combines('raise', 'life') && !M.combines('conjure', 'life'));
  assert.ok(M.combines('raise', 'bone') && M.combines('raise', 'spirit') && !M.combines('raise', 'fire'), 'Raise takes Bone, Life, Spirit');
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

test('hex with vine roots a foe unless they resist; bless with life innervates (healing is Restore)', async () => {
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
  assert.strictEqual(ally.bleeds.length, 1, 'Bless is a boon: no mending');
  assert.strictEqual(ally.damage.CON, 2);
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
  // Raise: no body, no spell; with a body nearby, the dead rise (Raise + Life: a zombie, for the whole fight).
  const r1 = await castAt(m, [f], 'raise+life', { at: { x: 3, y: 2 } }, [10]);
  assert.ok(!r1.enc.extra);
  const corpse = armed('Dead', 'club', { side: 'enemy' }); corpse.status.dead = true; corpse.at = { x: 3, y: 1 };
  m.spSpent = 0;
  const r2 = await castAt(m, [f, corpse], 'raise+life', { at: { x: 3, y: 2 } }, [10]);
  const z = Object.values(r2.enc.extra || {})[0];
  assert.ok(z && z.side === m.side && corpse.raised && z.monster === 'zombie' && z.conjured.rounds == null);
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
  m.status.grapple = { partner: g.id, level: 'hold', role: 'held' }; g.status.grapple = { partner: m.id, level: 'hold', role: 'holder' };
  const enc = Combat.createEncounter('t', [m.id, g.id], chars, 10, 5);
  enc.pos[m.id] = { x: 1, y: 2 }; enc.pos[g.id] = { x: 2, y: 2 };
  await Combat.startRound(enc, chars, roller(1, [9, 1]));
  const la = Combat.legalActions(enc, chars, m.id);
  const blink = la.spells.find((o) => o.spell.shape === 'blink');
  assert.ok(blink && blink.affordable, 'blink is open even while held');
  assert.ok(!la.spells.some((o) => o.spell.shape === 'wall'), 'nothing else while held');
  await B.Magic.resolveCast(enc, chars, { actor: m.id, type: 'cast', option: blink.option || blink, at: { x: 4, y: 0 } }, roller(2, [10]), JSON.parse(JSON.stringify(enc.pos)));
  assert.deepStrictEqual(enc.pos[m.id], { x: 4, y: 0 });
  assert.ok(!m.status.grapple && !g.status.grapple);
});

test('bait leaves a foe off balance; reading intent gives +2 both ways', async () => {
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
  // The action: bait wins (9 + 4 vs 1 + 2), and the foe is off balance.
  B.Conditions.remove(a, 'reading');
  const enc = Combat.createEncounter('t', [a.id, t.id], chars, 6, 1);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[t.id] = { x: 2, y: 0 };
  a.base.SPD = 9;
  await Combat.startRound(enc, chars, roller(1, [9, 5]));
  assert.strictEqual(Combat.currentActor(enc), a.id);
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'bait', target: t.id }, io(2, [9, 1])), null);
  assert.ok(B.Conditions.has(t, 'baited'));
});

test('read intent: a true read shows their real plan (+2); a bad roll misreads it (−2) and looks the same', async () => {
  const a = armed('A', 'longsword', { side: 'party' }); a.base.WIS = 6;
  const t = armed('T', 'longsword', { side: 'enemy' }); t.base.CHA = 4;
  const chars = { [a.id]: a, [t.id]: t };
  const enc = Combat.createEncounter('t', [a.id, t.id], chars, 6, 1);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[t.id] = { x: 2, y: 0 };
  a.base.SPD = 9;
  await Combat.startRound(enc, chars, roller(1, [9, 5]));
  assert.strictEqual(C.actionCost(a, 'readIntent').ap, Math.max(C.minAP(), Math.round(C.baseAP(0.5))), 'cheap');
  // TN = 5 + 2 = 7; WIS 6 → +3. Roll 9: 12, a true read.
  assert.strictEqual(await Combat.act(enc, chars, { actor: a.id, type: 'readIntent', target: t.id }, io(2, [9])), null);
  const r = B.Conditions.get(a, 'reading');
  assert.ok(r && r.truth === true && r.note, r && r.note);
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
  assert.match(await Combat.act(enc, chars, { actor: c.id, type: 'strike', option: th, target: m.id }, io(2)), /Calmed/);
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

test('phase 3: rituals spend components and points, reveal secrets the roll can reach', async () => {
  const R = B.Ritual;
  const m = mage('M', ['force', 'life', 'spirit']);
  m.feats.ritualist = 1;
  m.inventory.components = { salt: 2, ink: 1, candle: 2, silverDust: 1 };
  const secrets = [
    { id: 's1', subject: 'Old chapel', reveals: ['seek:force'], tier: 'easy', text: 'A ward of warding glyphs under the altar.' },
    { id: 's2', subject: 'Old chapel', reveals: ['seek:force'], tier: 'legendary', text: 'The bell is a bound demon.' },
    { id: 's3', subject: 'Old chapel', reveals: ['divine'], tier: 'easy', text: 'The priest lied about the fire.' },
  ];
  assert.ok(!R.missing(m, 'seek', { noun: 'force' }));
  assert.match(R.missing(m, 'speak', { noun: 'life' }), /Short of/);
  // INT 8 → +4, Ritualist +1; d10 = 8 → 13 vs moderate 8: margin 5, full; reaches easy (6), not legendary (14).
  const res = await R.perform(m, { kind: 'seek', noun: 'force', subject: 'old chapel', tier: 'moderate' }, roller(1, [8]), secrets);
  assert.strictEqual(res.outcome, 'full');
  assert.deepStrictEqual(res.revealed.map((s) => s.id), ['s1'], 'the legendary secret is out of reach; divine-only stays hidden');
  assert.strictEqual(m.inventory.components.salt, 1);
  // A bad failure: components gone, backlash.
  const st = m.stamina;
  const bad = await R.perform(m, { kind: 'seek', noun: 'force', subject: 'old chapel', tier: 'legendary' }, roller(2, [1]), secrets);
  assert.strictEqual(bad.outcome, 'fail');
  assert.ok(m.stamina < st);
  assert.strictEqual(m.inventory.components.salt, 0);
});

test('phase 3: mend heals far better than in a fight; prepared wards take hold when the fight starts', async () => {
  const R = B.Ritual;
  const m = mage('M', ['force', 'life']);
  m.feats.ritualist = 1; m.feats.rite_of_healing = 1; m.feats.warding = 1;
  m.inventory.components = { herbs: 2, chalk: 1 };
  const p = armed('P', 'club');
  p.damage.CON = 4; p.bleeds = [{ remaining: 3, rounds: 3 }];
  const res = await R.perform(m, { kind: 'mend', patient: p, tier: 'moderate' }, roller(1, [7]), []);
  assert.strictEqual(res.outcome, 'full');
  assert.strictEqual(p.damage.CON, 2);
  assert.strictEqual(p.bleeds.length, 0);
  const ward = R.preparable(m).find((o) => o.spellKey === 'ward+force');
  assert.ok(ward);
  await R.perform(m, { kind: 'prepare', spell: ward, target: p, tier: 'easy' }, roller(2, [8]), []);
  assert.strictEqual(m.prepared.length, 1);
  const f = armed('F', 'club', { side: 'enemy' });
  const chars = { [m.id]: m, [p.id]: p, [f.id]: f };
  const enc = Combat.createEncounter('t', [m.id, p.id, f.id], chars, 8, 3);
  await Combat.startRound(enc, chars, roller(3, [5, 5, 5]));
  const w = B.Conditions.get(p, 'warded');
  assert.ok(w && w.kind === 'magic' && w.rounds === 6);
  assert.strictEqual(m.prepared.length, 0);
});

test('Restore: + Life mends (bleeding, CON, stamina; wakes the downed); Wide reaches all around; other nouns lift their conditions', async () => {
  const m = mage('Cleric', ['life', 'venom']);
  const ally = fighter('Ally');
  ally.side = m.side;
  ally.at = { x: 2, y: 2 };
  C.damageAttr(ally, 'CON', 2);
  ally.bleeds.push({ remaining: 4, rounds: 3 }, { remaining: 3, rounds: 3, poison: true });
  ally.stamina = 0;
  ally.status.unconscious = true;
  const maxBefore = C.maxStamina(ally);
  const { o } = await castAt(m, [ally], 'restore+life', { target: ally.id });
  const H = B.CONFIG.magic.heal;
  assert.equal(ally.damage.CON, 1, 'one CON back');
  assert.deepEqual(ally.bleeds.map((b) => !!b.poison), [true], 'bleeding stops, poison stays');
  // A point of CON back raises max stamina, and that comes back too (Character.healAttr).
  assert.equal(ally.stamina, (C.maxStamina(ally) - maxBefore) + H.stamina + H.staminaPerMag * o.spell.magnitude);
  assert.equal(ally.status.unconscious, false, 'the downed come to');
  // Restore + Venom drains the poison and lifts Poisoned.
  B.Conditions.add(ally, 'poisoned', { rounds: 3 });
  await castAt(m, [ally], 'restore+venom', { target: ally.id });
  assert.equal(ally.bleeds.length, 0);
  assert.ok(!B.Conditions.has(ally, 'poisoned'));
  // Bless + Life is a boon only; Restore doesn't combine with a noun that inflicts nothing.
  assert.ok(B.Magic.combines('bless', 'life') && !B.Magic.combines('restore', 'wind'));
  // Wide: everyone within a square of the target, friend or foe, at a share of the stamina.
  const friend = fighter('Friend');
  friend.side = m.side;
  friend.stamina = 1;
  friend.at = { x: 2, y: 2 };
  const foe = fighter('Foe');
  foe.stamina = 1;
  foe.at = { x: 2, y: 3 };
  const r = await castAt(m, [friend, foe], 'restore+life+wide', { target: friend.id });
  const gain = Math.round((H.stamina + H.staminaPerMag * r.o.spell.magnitude) * H.areaShare);
  assert.equal(friend.stamina, 1 + gain);
  assert.equal(foe.stamina, 1 + gain);
});

test('Name: a named spell finds a companion anywhere, past walls; a foe only if their name is known', async () => {
  const m = mage('Cleric', ['life', 'calm']);
  const ally = fighter('Far Ally');
  ally.side = m.side;
  ally.at = { x: 9, y: 4 };
  ally.stamina = 1;
  const foe = fighter('Grath');
  foe.side = 'enemy';
  foe.at = { x: 8, y: 0 };
  const chars = { [m.id]: m, [ally.id]: ally, [foe.id]: foe };
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, 10, 5);
  enc.pos[m.id] = { x: 1, y: 2 };
  enc.pos[ally.id] = ally.at;
  enc.pos[foe.id] = foe.at;
  for (let y = 0; y < 5; y++) B.Terrain.add(enc, 5, y, 'stoneWall');
  const named = B.Magic.spellOptions(m).find((x) => x.spellKey === 'restore+life+name');
  assert.ok(named && named.spell.named);
  const la = Combat.legalActions(enc, chars, m.id);
  const opt = la.spells.find((x) => x.spellKey === 'restore+life+name');
  assert.ok(opt.targets.find((t) => t.id === ally.id).inReach, 'a companion is always in reach by name');
  await B.Magic.resolveCast(enc, chars, { actor: m.id, type: 'cast', option: named, target: ally.id, pass: 1, n: 1 }, roller(5, []), JSON.parse(JSON.stringify(enc.pos)));
  assert.ok(ally.stamina > 1, 'mended through the wall, eight squares off');
  assert.ok(!B.Magic.knowsName(m, foe));
  assert.ok(!Combat.legalActions(enc, chars, m.id).spells.find((x) => x.spellKey === 'beguile+calm+name').targets.find((t) => t.id === foe.id).inReach);
  m.knownNames = ['grath'];
  assert.ok(B.Magic.knowsName(m, foe), 'a learned name reaches a foe');
  assert.ok(Combat.legalActions(enc, chars, m.id).spells.find((x) => x.spellKey === 'beguile+calm+name').targets.find((t) => t.id === foe.id).inReach);
});

test('revenant knight: Battle Casting casts with sword and shield; Soulreaver drinks stamina and wounds', async () => {
  const [dk] = B.Enemies.makeMonster('revenantKnight');
  assert.equal(dk.level, 20);
  assert.ok(dk.shield && C.handsBusy(dk) === 2 && C.castingHands(dk), 'hands full, still casting');
  assert.ok(C.attackOptions(dk).some((o) => o.spell), 'bolts offered with sword and shield in hand');
  const blade = dk.weapons.find((w) => (w.enchantments || []).includes('drinking'));
  assert.equal(Items.itemName(blade), 'Soulreaver');
  // A thrust that wounds: the knight, worn and wounded, takes some back.
  C.damageAttr(dk, 'CON', 3);
  dk.stamina = 10;
  const t = fighter('Victim');
  t.side = 'party';
  const chars = { [dk.id]: dk, [t.id]: t };
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, 6, 3);
  const opt = C.attackOptions(dk).find((o) => o.weaponId === blade.id && o.motion === 'thrust');
  const r = await Combat.applyHit(enc, chars, dk, t, opt, roller(10, []), {});
  assert.match(r.text, /Soulreaver drinks/);
  assert.ok(dk.damage.CON < 3 || dk.stamina > 10, 'healed or refreshed');
});

test('revenant knight: his aura of dread saps foes near him each round; the silk sash quickens him', async () => {
  const [dk] = B.Enemies.makeMonster('revenantKnight');
  const plain = Object.assign(JSON.parse(JSON.stringify(dk)), { trinkets: [] });
  assert.ok(C.apPool(dk) > C.apPool(plain), 'the sash adds AP');
  assert.equal(C.attr(dk, 'SPD'), C.attr(plain, 'SPD') + 1);
  const near = fighter('Near'), far = fighter('Far');
  near.side = far.side = 'party';
  const chars = { [dk.id]: dk, [near.id]: near, [far.id]: far };
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, 12, 3);
  enc.pos[dk.id] = { x: 5, y: 1 }; enc.pos[near.id] = { x: 3, y: 1 }; enc.pos[far.id] = { x: 10, y: 1 };
  const st = near.stamina, st2 = far.stamina;
  await Combat.startRound(enc, chars, roller(5, []));
  assert.equal(near.stamina, st - dk.traits.aura.stamina);
  assert.ok(B.Conditions.has(near, 'dread'));
  assert.equal(far.stamina, st2);
  assert.ok(!B.Conditions.has(far, 'dread'));
});

test('spectre: ordinary weapons pass through; magical weapons and spells hurt it', async () => {
  const [sp] = B.Enemies.makeMonster('spectre');
  assert.ok(sp.traits.incorporeal && C.tireless(sp));
  const swordsman = fighter('Swordsman');
  const w = Items.makeWeapon('longsword', 'standard');
  swordsman.weapons.push(w);
  swordsman.wield = w.id;
  const thrust = C.attackOptions(swordsman).find((o) => o.weaponId === w.id && o.motion === 'thrust');
  const chars = { [sp.id]: sp, [swordsman.id]: swordsman };
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, 6, 3);
  const plain = await Combat.applyHit(enc, chars, swordsman, sp, thrust, roller(10, []), {});
  assert.match(plain.text, /passes through/);
  assert.equal(C.totalDamage(sp), 0);
  w.enchantments = ['keen'];
  await Combat.applyHit(enc, chars, swordsman, sp, thrust, roller(1, []), {});
  assert.ok(C.totalDamage(sp) > 0, 'a magical blade bites');
  // No grabbing or tripping a ghost.
  enc.pos[sp.id] = { x: 2, y: 1 }; enc.pos[swordsman.id] = { x: 1, y: 1 };
  const la = Combat.legalActions(enc, chars, swordsman.id);
  for (const m of la.maneuvers.filter((m) => !['bait', 'readIntent'].includes(m.type))) assert.ok(!m.targets.some((t) => t.inReach), m.type);
});

test('golem is immune to magic; a constrictor crushes whoever it holds; fliers pass over pits and traps', async () => {
  // Magic washes off the golem.
  const [golem] = B.Enemies.makeMonster('stoneGolem');
  const m = mage('Mage', ['fire']);
  golem.at = { x: 3, y: 2 };
  await castAt(m, [golem], 'strike+fire', { target: golem.id }, [1, 1, 1, 1]);
  assert.equal(C.totalDamage(golem), 0);
  assert.equal(await B.Magic.afflict(Combat.createEncounter('t', [m.id, golem.id], { [m.id]: m, [golem.id]: golem }, 6, 3), m, golem, 'slowed', { rounds: 2 }, roller(10, [])), false);
  // The constrictor crushes the one it holds at the end of the round.
  const [snake] = B.Enemies.makeMonster('constrictor');
  const victim = fighter('Victim');
  victim.side = 'party';
  const chars = { [snake.id]: snake, [victim.id]: victim };
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, 6, 3);
  snake.status.grapple = { partner: victim.id, level: 'hold', role: 'holder' };
  victim.status.grapple = { partner: snake.id, level: 'hold', role: 'held' };
  const st = victim.stamina;
  Combat.endRound(enc, chars);
  assert.ok(victim.stamina <= st - snake.traits.constrict.stamina, 'crushed (a CON wound costs some stamina too)');
  assert.equal(victim.damage.CON, snake.traits.constrict.con);
  // A drake flies over a pit and a hidden rune; a walker falls in.
  const [drake] = B.Enemies.makeMonster('drake');
  const e2 = Combat.createEncounter('t', [drake.id], { [drake.id]: drake }, 6, 3);
  B.Terrain.add(e2, 2, 1, 'pit');
  assert.equal(B.Terrain.stepCost(e2, 2, 1, drake), 1);
  assert.equal(await B.Terrain.enter(e2, { [drake.id]: drake }, drake, 2, 1, roller(5, []), () => {}), false);
  assert.ok(!drake.status.prone);
  assert.equal(await B.Terrain.enter(e2, { [victim.id]: victim }, victim, 2, 1, roller(5, []), () => {}), true);
});

test('size: a man-sized wound bleeds a giant less, and its vitals are harder to reach; grip helps a giant seize a man', async () => {
  const [giant] = B.Enemies.makeMonster('hillGiant');
  const man = fighter('Man');
  assert.ok(Combat.grappleScore(giant) >= Math.floor(C.attr(giant, 'STR') / 2) + giant.traits.grip);
  const spear = Items.makeWeapon('spear', 'standard');
  man.weapons.push(spear);
  man.wield = spear.id;
  const thrust = C.attackOptions(man).find((o) => o.weaponId === spear.id && o.motion === 'thrust');
  const plain = fighter('Plain');
  for (const t of [giant, plain]) t.armor = null;
  const chars = { [giant.id]: giant, [plain.id]: plain, [man.id]: man };
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, 6, 3);
  await Combat.applyHit(enc, chars, man, plain, thrust, roller(10, []), {});
  await Combat.applyHit(enc, chars, man, giant, thrust, roller(10, []), {});
  const bled = (c) => c.bleeds.reduce((t, b) => t + b.remaining, 0);
  assert.ok(bled(giant) < bled(plain), `giant bleeds ${bled(giant)}, a man ${bled(plain)}`);
});

test('weapon strain: strength never speeds a light weapon, makes a heavy one functional, and a weapon far too heavy is unusable', () => {
  const swingAP = (type, str) => {
    const c = fighter('W');
    c.base.STR = str;
    const w = Items.makeWeapon(type, 'standard');
    c.weapons.push(w);
    c.wield = w.id;
    const o = C.attackOptions(c).find((x) => x.weaponId === w.id && (x.motion === 'swing' || x.motion === 'twoHanded'));
    return o ? o.ap : null;
  };
  assert.equal(swingAP('rapier', 5), swingAP('rapier', 15), 'no faster with more STR');
  assert.ok(swingAP('greatsword', 4) > swingAP('greatsword', 7), 'a weak wielder strains');
  assert.equal(swingAP('greatsword', 10), swingAP('greatsword', 20), 'past capacity, natural speed');
  assert.equal(swingAP('giantClub', 6), null, 'a giant\'s club is beyond a man');
  assert.ok(swingAP('giantClub', 23) <= swingAP('greatsword', 10), 'an ogre swings it like a sword');
});

test('impact: heavy blunt crushes, a hard blow throws its target back, and big blows cannot be parried', async () => {
  const [giant] = B.Enemies.makeMonster('hillGiant');
  const club = C.attackOptions(giant).find((o) => o.motion === 'swing');
  const man = fighter('Man');
  man.side = 'party';
  man.base.CON = 10;
  man.stamina = C.maxStamina(man);
  const h = Combat.computeHit(giant, man, club, {});
  assert.ok(h.crushed > 0 && h.bluntToCON >= h.crushed, 'bones break');
  // A troll's fist into a sturdy man: crushed a little, hurled back.
  const [troll] = B.Enemies.makeMonster('caveTroll');
  const fist = C.attackOptions(troll).find((o) => o.label === 'Fists');
  const sturdy = fighter('Sturdy');
  sturdy.side = 'party';
  sturdy.base.CON = 10;
  sturdy.stamina = C.maxStamina(sturdy);
  const chars = { [troll.id]: troll, [sturdy.id]: sturdy };
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, 12, 3);
  enc.pos[troll.id] = { x: 3, y: 1 };
  enc.pos[sturdy.id] = { x: 4, y: 1 };
  await Combat.applyHit(enc, chars, troll, sturdy, fist, roller(5, []), {});
  assert.ok(enc.pos[sturdy.id].x > 4, 'thrown back');
  // A parry meets force with force: a sword against a giant's club is hopeless (it may meet the club, but most
  // of the blow beats through: CONFIG.defense.parryCarry); a strong two-hander trained to parry has a chance;
  // a soft blow is easier than a hard one. `saved`: the share of the blow a parry keeps off, on average.
  const saved = (c, o) => Combat.defenseOdds(c, 'parry', o.motion, null, o) * (1 - Combat.parryCarryShare(c, 'parry', o));
  sturdy.weapons.push(Items.makeWeapon('longsword', 'standard'));
  sturdy.wield = sturdy.weapons[0].id;
  assert.ok(saved(sturdy, club) < 0.1, `a sword against a giant (${saved(sturdy, club).toFixed(2)})`);
  assert.ok(Combat.parryCarryShare(sturdy, 'parry', club) > 0.5, 'most of the club beats through the sword');
  const barb = fighter('Barbarian');
  barb.base.STR = 10; barb.base.DEX = 6; barb.base.SPD = 6;
  barb.feats = { parry_training: 3, heavy_weapon_training: 2, strength: 2 };
  const gs = Items.makeWeapon('greatsword', 'fine');
  barb.weapons.push(gs);
  barb.wield = gs.id;
  const pBarb = saved(barb, club);
  assert.ok(pBarb > 0.1 && pBarb < 0.6, `a barbarian has a chance (${pBarb.toFixed(2)})`);
  assert.ok(Combat.parryCarryShare(barb, 'parry', club) < Combat.parryCarryShare(sturdy, 'parry', club), 'a greatsword meets more of it');
  // A thrust parried is stopped, however hard: a point is turned aside with little force.
  assert.strictEqual(Combat.parryCarryShare(sturdy, 'parry', { damage: [20, 0, 0], motion: 'thrust' }), 0);
  const soft = { damage: [0, 4, 0], motion: 'swing' }, hard = { damage: [0, 16, 2], motion: 'swing' };
  assert.ok(Combat.defenseOdds(sturdy, 'parry', 'swing', null, soft) > Combat.defenseOdds(sturdy, 'parry', 'swing', null, hard));
});



// ---- Weapon wear, weariness (the user's call) ----------------------------------------------------
async function blowAt(atkWeapon, setupTarget, react) {
  const a = armed('A', atkWeapon, { side: 'party' });
  const b = armed('B', 'longsword', { side: 'enemy' });
  a.base.SPD = 9; b.base.CON = 30;
  setupTarget(b);
  for (const x of [a, b]) x.stamina = C.maxStamina(x);
  const chars = { [a.id]: a, [b.id]: b };
  const enc = Combat.createEncounter('t', [a.id, b.id], chars, 4, 1);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[b.id] = { x: 1, y: 0 };
  await Combat.startRound(enc, chars, roller(3, [10, 1]));
  enc.ap[b.id] = 6 * B.CONFIG.apScale;
  const thrust = Combat.legalActions(enc, chars, a.id).attacks.find((o) => o.motion === 'thrust');
  // Rolls: B's defence roll 10 against A's 1 when B reacts; otherwise the blow lands.
  await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: thrust, target: b.id }, io(5, [10, 1], react || noReact));
  return { a, b, w: a.weapons[0], bw: b.weapons[0] };
}

test('weapons wear on metal armor, not on flesh; a rapier wears fastest', async () => {
  const plate = (t) => { t.armor = Items.makeArmor('plate', 'full', 'standard'); };
  const bare = await blowAt('longsword', () => {});
  assert.strictEqual(Items.weaponDurability(bare.w), Items.weaponMaxDurability(bare.w), 'flesh does not dull a blade');
  const sword = await blowAt('longsword', plate);
  const rapier = await blowAt('rapier', plate);
  const lost = (r) => Items.weaponMaxDurability(r.w) - Items.weaponDurability(r.w);
  assert.ok(lost(sword) > 0, 'plate chews the sword');
  assert.ok(lost(rapier) / Items.weaponMaxDurability(rapier.w) > lost(sword) / Items.weaponMaxDurability(sword.w), 'and the rapier faster');
  const padded = await blowAt('longsword', (t) => { t.armor = Items.makeArmor('padded', 'full', 'standard'); });
  assert.ok(Items.weaponMaxDurability(padded.w) - Items.weaponDurability(padded.w) < lost(sword), 'cloth barely touches it');
});

test('a parry wears both blades, the parrying one by the force it meets; a dodge wears nothing', async () => {
  const parry = await blowAt('longsword', () => {}, (req) => (req.kind === 'defend' ? 'parry' : null));
  assert.ok(Items.weaponDurability(parry.bw) < Items.weaponMaxDurability(parry.bw), 'the parrying sword wears');
  assert.ok(Items.weaponDurability(parry.w) < Items.weaponMaxDurability(parry.w), 'and so does the parried one');
  const dodge = await blowAt('longsword', () => {}, (req) => (req.kind === 'defend' ? 'dodge' : null));
  assert.strictEqual(Items.weaponDurability(dodge.w), Items.weaponMaxDurability(dodge.w));
  assert.strictEqual(Items.weaponDurability(dodge.bw), Items.weaponMaxDurability(dodge.bw));
});

test('a worn weapon hits softer; a broken one is out of the fight until a smith mends it', () => {
  const c = armed('Worn', 'longsword');
  const swing = () => opt(c, (o) => o.motion === 'swing').damage.reduce((x, y) => x + y);
  const whole = swing();
  c.weapons[0].durability = Math.round(Items.weaponMaxDurability(c.weapons[0]) / 4);
  assert.ok(swing() < whole);
  c.weapons[0].durability = 0;
  assert.strictEqual(C.wieldedWeapon(c), null, 'a broken weapon is no weapon');
  assert.ok(!C.attackOptions(c).some((o) => o.weaponType === 'longsword'));
  const lines = Recovery.mendGear(c, 0.25);
  assert.strictEqual(c.weapons[0].durability, 0, 'no field repair for a broken blade');
  assert.ok(lines.some((l) => /broken/.test(l)));
});

test('weariness: every round of fighting lowers max stamina until a long rest', async () => {
  const a = armed('A', 'longsword', { side: 'party' });
  const b = armed('B', 'longsword', { side: 'enemy' });
  const fresh = C.maxStamina(a);
  const chars = { [a.id]: a, [b.id]: b };
  const enc = Combat.createEncounter('t', [a.id, b.id], chars, 6, 1);
  enc.pos[a.id] = { x: 0, y: 0 }; enc.pos[b.id] = { x: 5, y: 0 };
  for (let r = 0; r < 3; r++) { await Combat.startRound(enc, chars, roller(3, [5, 5])); await closeRound(enc, chars); }
  assert.strictEqual(C.maxStamina(a), fresh - 3 * B.CONFIG.weariness.perRound);
  await Recovery.longRest(a, {}, roller(1, [5]));
  assert.strictEqual(C.maxStamina(a), fresh);
});

// ---- Items: type + material + origin + craft + enchantments ---------------------------------
test('item tags: material and origin scale protection and weight; craft only durability and wear; old qualities still read', () => {
  const D = B.DATA;
  const iron = Items.makeArmor('mail', 'full', 'average');
  const steel = Items.makeArmor('mail', 'full', 'average', { material: 'steel' });
  const bronze = Items.makeArmor('mail', 'full', 'average', { material: 'bronze' });
  const elven = Items.makeArmor('mail', 'full', 'average', { origin: 'elven' });
  const dwarven = Items.makeArmor('mail', 'full', 'average', { origin: 'dwarven' });
  const master = Items.makeArmor('mail', 'full', 'master');
  const poor = Items.makeArmor('mail', 'full', 'poor');
  const base = (a) => Items.armorBase(a);
  assert.strictEqual(iron.material, 'iron', 'every piece names its material');
  assert.strictEqual(Items.itemName(iron), 'Iron mail armor');
  assert.strictEqual(Items.itemName(Items.makeArmor('plate', 'half', 'master', { material: 'steel', origin: 'dwarven', enchantments: ['warding'] })), 'Masterwork dwarven steel plate armor (torso, arms, legs) of warding');
  assert.ok(base(steel).pierce.resist > base(iron).pierce.resist && base(iron).pierce.resist > base(bronze).pierce.resist, 'steel > iron > bronze');
  assert.ok(base(steel).mit.S > base(iron).mit.S);
  assert.ok(base(elven).spd < base(iron).spd && base(dwarven).spd > base(iron).spd, 'origin moves the weight');
  assert.ok(base(dwarven).pierce.resist > base(iron).pierce.resist && base(dwarven).maxDurability > base(iron).maxDurability);
  assert.deepStrictEqual(base(master).mit, base(iron).mit, 'craft never changes protection');
  assert.ok(base(master).maxDurability > base(iron).maxDurability && base(iron).maxDurability > base(poor).maxDurability);
  assert.ok(Items.wearMult(master) < Items.wearMult(iron) && Items.wearMult(iron) < Items.wearMult(poor), 'and how fast it wears');
  // The old quality names still name a craft; an old save's scale armor is steel mail (save.js upgrades it).
  assert.strictEqual(Items.makeWeapon('dagger', 'crude').craft, 'poor');
  assert.strictEqual(Items.makeWeapon('dagger', 'masterwork').craft, 'master');
  const old = Items.normalizeItem(B.Save.upgradeCharacter({ armor: { id: 'x', kind: 'armor', type: 'scale', coverage: 'full', quality: 'fine', durability: 10 } }).armor);
  assert.deepStrictEqual([old.type, old.material, old.craft, old.quality], ['mail', 'steel', 'average', undefined]);
  // Weapons: origin and material change the mass, so speed and damage follow the physics.
  const sword = Items.makeWeapon('longsword');
  const light = Items.makeWeapon('longsword', 'average', null, { origin: 'elven' });
  assert.ok(Items.weaponMass(light) < Items.weaponMass(sword));
  assert.ok(Items.weaponStats(light).punch.point < Items.weaponStats(sword).punch.point, 'less weight behind the point');
  assert.ok(Items.weaponMaxDurability(Items.makeWeapon('longsword', 'master')) > Items.weaponMaxDurability(sword));
  // Enchantments are rare and named; any makes a weapon magical.
  const keen = Items.makeWeapon('longsword', 'average', null, { enchantments: ['keen'] });
  assert.ok(Items.weaponStats(keen).faces.edge[1] > Items.weaponStats(sword).faces.edge[1]);
  assert.strictEqual(Items.itemRarity(keen), 'very rare');
  assert.ok(D.ENCHANTMENTS.keen && D.CRAFTS.master && D.ORIGINS.elven && D.MATERIALS.starIron);
});

test('a point against armor: it bursts through, finds a gap, or is turned (the user\'s rule)', () => noWounds(async () => {
  const stab = (weapon, armorType, tags, attrs) => {
    const a = armed('A', weapon);
    Object.assign(a.base, attrs || {});
    const t = fighter('T');
    if (armorType) t.armor = Items.makeArmor(armorType, 'full', 'average', tags);
    const o = opt(a, (x) => x.motion === 'thrust');
    return Combat.computeHit(a, t, o, { distance: o.maxRange });
  };
  // The user's anchors: a rapier bursts padding but not mail; a heavy spear any mail but not plate.
  assert.strictEqual(stab('rapier', 'padded').pierce, 'burst');
  assert.strictEqual(stab('rapier', 'leather').pierce, 'burst');
  assert.ok(stab('rapier', 'mail').gap, 'mail: the rapier must find a gap');
  assert.ok(stab('rapier', 'mail', null, { STR: 10 }).gap, 'however strong the arm: the blade bends');
  assert.strictEqual(stab('longsword', 'mail').pierce, 'burst', 'a longsword thrust bursts iron mail');
  assert.ok(stab('longsword', 'mail', { material: 'steel' }).gap, 'but not steel');
  assert.strictEqual(stab('spear', 'mail').pierce, 'burst', 'a spear bursts iron mail');
  assert.ok(stab('spear', 'mail', { material: 'steel' }).gap, 'hardened steel holds against an average spearman');
  assert.strictEqual(stab('heavySpear', 'mail', { material: 'steel' }).pierce, 'burst');
  assert.ok(stab('heavySpear', 'plate').gap, 'nothing bursts plate');
  assert.strictEqual(stab('dagger', 'mail', { material: 'bronze' }).gap ? 'gap' : 'burst', 'gap', 'a dagger needs a gap even in bronze');
  // Skill and feats find gaps: DEX and Find the Gap raise the odds; an average fighter finds none in plate.
  const clumsy = stab('rapier', 'mail', null, { DEX: 3 }), deft = stab('rapier', 'mail', null, { DEX: 9 });
  assert.ok(deft.gap.chance > clumsy.gap.chance);
  assert.strictEqual(stab('rapier', 'plate').gap.chance, 0, 'no lucky 10');
  assert.ok(stab('rapier', 'plate', null, { DEX: 10 }).gap.chance > 0, 'skill does it');
  // Bows: a longbow bodkin bursts mail, a shortbow's doesn't.
  const shot = (bow, armorType) => {
    const a = armed('A', bow);
    a.inventory.bodkins = 3;
    const t = fighter('T');
    t.armor = Items.makeArmor(armorType, 'full', 'average');
    const o = C.attackOptions(a).find((x) => x.arrowHead === 'bodkin');
    return Combat.computeHit(a, t, o, { distance: 4 });
  };
  assert.strictEqual(shot('longbow', 'mail').pierce, 'burst');
  assert.ok(shot('shortbow', 'mail').gap);
  // The roll: through a gap the piercing takes the pass-through roll (CONFIG.pierce.gapPass); failing, the
  // point lands as a little blunt.
  const run = async (die) => {
    const a = armed('A', 'rapier', { side: 'party' });
    const t = fighter('T', { side: 'enemy' });
    t.armor = Items.makeArmor('mail', 'full', 'average');
    t.stamina = C.maxStamina(t);
    const before = t.stamina;
    const enc = { hitThisRound: {}, fortressUsed: {}, log: [], round: 1 };
    const o = opt(a, (x) => x.motion === 'thrust');
    // Dice: the gap roll (a DEX-5 rapier needs 9 against mail's 10), six pass-through d10s, the wound roll.
    const r = await Combat.applyHit(enc, { [a.id]: a, [t.id]: t }, a, t, o, roller(1, [die, 1, 1, 1, 1, 1, 1, 10]));
    return { r, con: t.damage.CON, stamina: before - t.stamina, wear: Items.weaponMaxDurability(a.weapons[0]) - Items.weaponDurability(a.weapons[0]) };
  };
  const found = await run(10);
  assert.match(found.r.text, /finds a gap/);
  assert.strictEqual(found.con, opt(armed('X', 'rapier'), (x) => x.motion === 'thrust').damage[0], 'every point that passes reaches the body');
  const turned = await run(1);
  assert.match(turned.r.text, /turns the point/);
  assert.strictEqual(turned.con, 0);
  assert.ok(turned.stamina > 0, 'a turned point still bruises');
  assert.ok(turned.wear > found.wear, 'and wears the blade hard');
  // Pinned: the point goes in at a gap, no roll.
  const g = await grapplePair('mail');
  await step(g, 'clinch', [10, 1]);
  await step(g, 'pin', [10, 1]);
  const dagger = C.attackOptions(g.a).find((o) => o.motion === 'thrust');
  assert.strictEqual(Combat.computeHit(g.a, g.t, dagger, { distance: 1 }).pierce, 'gap');
}));

test('rust eats iron but not bronze; a masterwork shield shrugs off the shattering blow', async () => {
  const touchWith = async (material) => {
    const [beetle] = Enemies.makeMonster('rustBeetle');
    const t = fighter('T', { side: 'party' });
    t.armor = Items.makeArmor('mail', 'full', 'average', { material });
    const chars = { [beetle.id]: beetle, [t.id]: t };
    const enc = Combat.createEncounter('t', [beetle.id, t.id], chars, 4, 1);
    enc.pos[beetle.id] = { x: 0, y: 0 }; enc.pos[t.id] = { x: 1, y: 0 };
    await Combat.startRound(enc, chars, roller(1, [10, 1]));
    const touch = C.attackOptions(beetle).find((o) => o.rust);
    const before = t.armor.durability;
    assert.strictEqual(await Combat.act(enc, chars, { actor: beetle.id, type: 'strike', option: touch, target: t.id }, io(1, [10, 10, 10])), null);
    return { lost: before - t.armor.durability, t, log: enc.log.map((l) => l.text).join('\n') };
  };
  const bronze = await touchWith('bronze');
  assert.strictEqual(bronze.lost, 0, 'bronze does not rust');
  assert.match(bronze.log, /nothing that rusts/);
  assert.ok(C.armorInfo(bronze.t).metal, 'though it is metal (lightning)');
  assert.ok((await touchWith('iron')).lost > 0, 'iron does');
  const s1 = Items.shieldStats(Items.makeShield('heater', 'wood', 'master'));
  const s0 = Items.shieldStats(Items.makeShield('heater', 'wood', 'average'));
  assert.ok(s1.unbreakable && !s0.unbreakable && s1.threshold > s0.threshold);
});

test('plate spreads a blow it turns: less of a cut\'s or a turned point\'s force reaches stamina; a crushing blow still carries (armor.yaml dissipate)', () => {
  const a = armed('A', 'greatsword');
  a.base.STR = 10;
  const t = fighter('T');
  t.armor = Items.makeArmor('plate', 'full', 'average');
  const cut = opt(a, (o) => o.motion === 'twoHanded' && o.face === 'edge');
  const spread = Combat.computeHit(a, t, cut, { distance: 2 });
  const saved = B.DATA.ARMOR.plate.dissipate;
  B.DATA.ARMOR.plate.dissipate = { glancing: 0, crushing: 0 };
  try {
    const whole = Combat.computeHit(a, t, cut, { distance: 2 });
    assert.ok(whole.bluntToStamina > 0 && spread.bluntToStamina < whole.bluntToStamina, 'plate keeps part of it off');
    assert.strictEqual(spread.dissipated + spread.bluntToStamina, whole.bluntToStamina);
  } finally { B.DATA.ARMOR.plate.dissipate = saved; }
  const m = armed('M', 'flangedMace');
  const blow = opt(m, (o) => o.motion === 'swing');
  assert.ok(!Combat.computeHit(m, t, blow, { distance: 1 }).dissipated, 'a mace\'s blow is not spread');
  t.armor = Items.makeArmor('mail', 'full', 'average');
  assert.ok(!Combat.computeHit(a, t, cut, { distance: 2 }).dissipated, 'mail passes a blow on');
});

test('the user\'s armor research: picks rupture plate, rondels burst mail, mail passes a heavy cut\'s force, a heavy cut goes through padding, steel is much harder', () => {
  const hit = (weapon, motion, face, armorType, tags, attrs) => {
    const a = armed('A', weapon);
    Object.assign(a.base, attrs || {});
    a.feats.power_swing = 1;
    const t = fighter('T');
    if (armorType) t.armor = Items.makeArmor(armorType, 'full', 'average', tags);
    const o = opt(a, (x) => x.motion === motion && (!face || x.face === face));
    return Combat.computeHit(a, t, o, { distance: o.maxRange });
  };
  // 1. The warhammer's beak: a two-handed blow bursts iron plate, a strong power blow steel; a one-handed one neither.
  assert.ok(hit('warhammer', 'swing', 'beak', 'plate').gap);
  const two = hit('warhammer', 'twoHanded', 'beak', 'plate');
  assert.strictEqual(two.pierce, 'burst');
  assert.ok(two.toCON >= 1, 'and wounds through it');
  assert.ok(hit('warhammer', 'power', 'beak', 'plate', { material: 'steel' }, { STR: 6 }).gap, 'steel holds against an average arm');
  assert.strictEqual(hit('warhammer', 'power', 'beak', 'plate', { material: 'steel' }, { STR: 10 }).pierce, 'burst');
  // 2. The rondel bursts iron mail where the common dagger can't; plate it must find a gap in.
  assert.strictEqual(hit('rondel', 'thrust', null, 'mail').pierce, 'burst');
  assert.ok(hit('dagger', 'thrust', null, 'mail').gap);
  assert.ok(hit('rondel', 'thrust', null, 'plate').gap);
  assert.ok(B.DATA.WEAPONS.rondel.dagger, 'it counts as a dagger (Coup de Grâce)');
  // 3. A greatsword power cut breaks bones through mail; plate spreads it; a sword swing on mail stays a bruise.
  const onMail = hit('greatsword', 'power', 'edge', 'mail', null, { STR: 7 });
  assert.ok(onMail.crushed > 0 && onMail.bluntToCON > 0, 'collarbones');
  assert.ok(!hit('greatsword', 'power', 'edge', 'plate', null, { STR: 7 }).bluntToCON);
  assert.ok(hit('longsword', 'swing', 'edge', 'mail').bluntToStamina <= 2);
  // 4. Padding stops a sword cut, not a greatsword chop.
  assert.strictEqual(hit('longsword', 'swing', 'edge', 'padded').slashToAttrs, 0);
  assert.ok(hit('greatsword', 'twoHanded', 'edge', 'padded').slashToAttrs > 0, 'massive momentum cuts through');
  assert.strictEqual(hit('greatsword', 'twoHanded', 'edge', 'mail').slashToAttrs, 0, 'never through mail');
  // 5. Hardened steel: half again iron's protection.
  const iron = Items.armorBase(Items.makeArmor('plate', 'full')), steel = Items.armorBase(Items.makeArmor('plate', 'full', 'average', { material: 'steel' }));
  assert.strictEqual(steel.pierce.resist, iron.pierce.resist * 1.5);
});
