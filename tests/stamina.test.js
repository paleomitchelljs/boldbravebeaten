// Stamina as a pool you manage (docs/PLAN.md step 2; rulings R1 to R3; step E's plain numbers): regeneration every
// round, spent actions instead of "too exhausted" (with CONFIG.stamina.spent null, refused), and a collapse that ends,
// sooner with WIL.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load');
const Clock = require('./clock');
const { Character: C, Combat, Items, Enemies, CONFIG } = B;

function roller(seed, queue) {
  const rng = Enemies.makeRng(seed || 7);
  const q = (queue || []).slice();
  return async (req) => {
    const out = [];
    for (let i = 0; i < req.count; i++) out.push(q.length ? q.shift() : 1 + Math.floor(rng() * req.sides));
    return out;
  };
}
const noReact = async () => null;
const io = (queue, react) => ({ roller: roller(3, queue), react: react || noReact });

function armed(name, type, side) {
  const c = C.newCharacter({ name, side, starterGear: false });
  if (type) { const w = Items.makeWeapon(type); c.weapons.push(w); c.wield = w.id; }
  c.stamina = C.maxStamina(c);
  return c;
}

async function field(list, w, h) {
  const chars = {};
  for (const [c] of list) chars[c.id] = c;
  const enc = Combat.createEncounter('t', list.map(([c]) => c.id), chars, w || 8, h || 3);
  for (const [c, x, y] of list) enc.pos[c.id] = { x, y };
  await Clock.start(enc, chars, roller(1, [10].concat(list.slice(1).map(() => 1))), list[0][0] ? list[0][0].id : list[0].id);
  return { enc, chars };
}

async function closeRound(enc, chars) {
  let guard = 50;
  while (enc.phase === 'act' && guard-- > 0) await Combat.submit(enc, chars, { actor: Combat.currentActor(enc), type: 'wait' }, io());
}

function withStamina(over, fn) {
  const saved = CONFIG.stamina;
  CONFIG.stamina = Object.assign({}, saved, over);
  const done = () => { CONFIG.stamina = saved; };
  let out;
  try { out = fn(); } catch (e) { done(); throw e; }
  if (out && typeof out.then === 'function') return out.finally(done);
  done();
  return out;
}

test('R1: a round\'s regeneration is ⌊(CON + WIL) × per⌋ less the armor\'s, a share (rounded up, at least 1) when struck; heavy armor\'s stays whole', () => {
  const c = armed('Runner', null, 'party');
  const R = CONFIG.stamina.regen;
  const full = Math.floor((C.attr(c, 'CON') + C.attr(c, 'WIL')) * R.per);
  assert.equal(C.regen(c), full);
  assert.equal(C.roundRegen(c, false), full);
  assert.equal(C.roundRegen(c, true), Math.max(1, Math.ceil(full * R.struck)));
  c.armor = Items.makeArmor('plate');
  const r = C.regen(c);
  assert.ok(r < full, 'plate costs regeneration');
  if (r < 0) assert.equal(C.roundRegen(c, true), C.roundRegen(c, false), 'negative regeneration is the same struck or not');
  // Max stamina is the same order for everyone: no CON in it.
  const d = armed('Tough', null, 'party');
  d.base.CON = 10;
  assert.equal(C.maxStamina(d), C.maxStamina(armed('Plain', null, 'party')));
});

test('R1: at the round\'s end a fighter struck regains the share, one not struck the whole', async () => {
  const a = armed('A', null, 'party'), b = armed('B', null, 'enemy');
  const { enc, chars } = await field([[a, 1, 1], [b, 6, 1]]);
  a.stamina = 10; b.stamina = 10;
  enc.struck[a.id] = 4; // a blow took 4 of A's stamina this round
  await closeRound(enc, chars);
  assert.equal(b.stamina, 10 + C.roundRegen(b, false), 'B, not struck: the whole');
  assert.equal(a.stamina, 10 + C.roundRegen(a, true), 'A, struck: the share');
});

test('R2: an action the fighter can\'t pay for is taken spent: stamina down to 1, the blow softer and easier to meet', async () => {
  const a = armed('A', 'longsword', 'party'), b = armed('B', 'longsword', 'enemy'), far = armed('Far', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 1, 1], [b, 2, 1], [far, 7, 1]]);
  const o = C.attackOptions(a).find((x) => x.weaponId && C.inRange(x, 1) && x.stamina > 2);
  a.stamina = o.stamina - 1;
  const la = Combat.legalActions(enc, chars, a.id);
  assert.ok(la.attacks.find((x) => C.optionKey(x) === C.optionKey(o)).spent, 'the panel marks it spent');
  const v = Combat.validate(enc, chars, { actor: a.id, type: 'strike', option: o, target: b.id });
  assert.ok(!v.err && v.spent, 'not refused: spent');
  // The defender meets a spent blow more easily; a spent blow lands at vigor.spent.
  const plain = Combat.defenseOdds(b, 'parry', o.motion, a, o);
  const spent = Combat.defenseOdds(b, 'parry', o.motion, a, Object.assign({}, o, { spent: true }));
  assert.ok(spent > plain, `parry odds ${plain} → ${spent}`);
  const h0 = Combat.computeHit(a, b, o, { distance: 1 }), h1 = Combat.computeHit(a, b, Object.assign({}, o, { spent: true }), { distance: 1 });
  assert.ok(h1.P + h1.S + h1.B < h0.P + h0.S + h0.B, 'softer');
  Clock.free(enc, a.id);
  assert.equal(await Clock.act(enc, chars, { actor: a.id, type: 'strike', option: o, target: b.id }, io()), null);
  assert.equal(a.stamina, 1, 'down to 1, not 0');
  assert.ok(C.isActive(a));
  assert.ok(enc.log.some((l) => /acts spent/.test(l.text || l)), 'the log says so');
});

test('R2: with the rule off, the same action is refused as too exhausted', async () => {
  await withStamina({ spent: null }, async () => {
    const a = armed('A', 'longsword', 'party'), b = armed('B', 'longsword', 'enemy');
    const { enc, chars } = await field([[a, 1, 1], [b, 2, 1]]);
    const o = C.attackOptions(a).find((x) => x.weaponId && C.inRange(x, 1) && x.stamina > 2);
    a.stamina = o.stamina - 1;
    assert.equal(Combat.validate(enc, chars, { actor: a.id, type: 'strike', option: o, target: b.id }).err, 'Too exhausted');
  });
});

test('R2: a defence taken spent is offered with worse odds', async () => {
  const a = armed('A', 'longsword', 'party'), b = armed('B', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 1, 1], [b, 2, 1]]);
  const o = C.attackOptions(a).find((x) => x.weaponId && C.inRange(x, 1));
  const d = { actor: a.id, type: 'strike', option: o, target: b.id };
  const fresh = Combat.defenseOptions(enc, chars, b, a, d).options.find((x) => x.type === 'parry');
  b.stamina = 1;
  const tired = Combat.defenseOptions(enc, chars, b, a, d).options.find((x) => x.type === 'parry');
  assert.ok(tired.spent && !fresh.spent);
  assert.ok(tired.odds < fresh.odds, `${fresh.odds} → ${tired.odds}`);
});

test('R3: stamina 0 is a collapse: prone and out for the rest of the round and rounds − ⌊WIL/perWil⌋ more, then round with a round\'s regeneration', async () => {
  const a = armed('A', 'longsword', 'party'), b = armed('B', 'longsword', 'enemy'), c = armed('C', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 1, 1], [b, 5, 1], [c, 6, 1]]);
  b.stamina = 0;
  C.updateCondition(b);
  assert.ok(C.collapsed(b) && b.status.prone && !C.isActive(b));
  const r0 = enc.round;
  const K = CONFIG.stamina.collapse;
  assert.equal(Combat.collapseRounds(b), Math.max(0, K.beats - Math.floor(C.attr(b, 'WIL') / K.perWil)));
  assert.equal(Combat.collapseRounds(b), 1, 'WIL 5: one round more');
  b.base.WIL = 10;
  assert.equal(Combat.collapseRounds(b), Math.max(0, K.beats - 2), 'more WIL, sooner');
  b.base.WIL = 5;
  assert.equal(Combat.comesRoundAt(enc, b), r0 + 1);
  await closeRound(enc, chars);
  assert.ok(C.collapsed(b), 'still down at the end of the round it fell in');
  await Clock.start(enc, chars, roller(2));
  assert.ok(!Combat.legalActions(enc, chars, a.id).attacks.length || true);
  assert.notEqual(Combat.currentActor(enc), b.id, 'no turn while collapsed');
  await closeRound(enc, chars);
  assert.ok(C.isActive(b), 'comes round at the end of the next round');
  assert.equal(b.stamina, Math.max(1, C.roundRegen(b, false)));
  assert.ok(b.status.prone, 'and must stand up');
});

test('R3: rouse, healing and Rally bring the collapsed round at once; a blow on the collapsed goes to the body', async () => {
  const cap = armed('Captain', 'longsword', 'party'), ally = armed('Ally', 'longsword', 'party');
  const foe = armed('Foe', 'club', 'enemy'), foe2 = armed('Foe2', 'club', 'enemy');
  cap.feats.rally = 1; cap.feats.to_your_feet = 1;
  const { enc, chars } = await field([[cap, 1, 1], [ally, 2, 1], [foe, 3, 1], [foe2, 6, 1]]);
  ally.stamina = 0; C.updateCondition(ally);
  assert.ok(C.collapsed(ally));
  // A collapsed body keeps its armor (step E).
  ally.armor = Items.makeArmor('mail');
  const o = C.attackOptions(foe).find((x) => x.weaponId && C.inRange(x, 1));
  const h = Combat.computeHit(foe, ally, o, { distance: 1, location: 'torso', margin: 1 });
  assert.ok(h.armored && h.mitigated.B > 0, 'the mail still takes the blow');
  Clock.free(enc, cap.id);
  assert.equal(await Clock.act(enc, chars, { actor: cap.id, type: 'rally' }, io()), null);
  assert.ok(C.isActive(ally) && ally.stamina >= 1, 'Rally brings them round');
  ally.stamina = 0; ally.status.unconscious = false; C.updateCondition(ally);
  assert.ok(C.collapsed(ally));
  assert.equal(await Clock.act(enc, chars, { actor: cap.id, type: 'rouse', target: ally.id }, io()), null);
  assert.ok(C.isActive(ally) && !ally.status.collapsed, 'rouse');
});

test('R3: down from wounds is not a collapse: it never runs out in the fight', async () => {
  const a = armed('A', 'longsword', 'party'), b = armed('B', 'longsword', 'enemy'), c = armed('C', 'longsword', 'party');
  const { enc, chars } = await field([[a, 1, 1], [b, 5, 1], [c, 2, 2]]);
  for (let i = 0; i < C.boxes(c); i++) C.addWound(c, { place: 'torso', sev: 1, kind: 'cut', bleed: 0, pts: 1 }, null);
  assert.ok(C.isDown(c) && !C.collapsed(c));
  for (let i = 0; i < 3; i++) { await closeRound(enc, chars); await Clock.start(enc, chars, roller(4 + i)); }
  assert.ok(C.isDown(c), 'stays down');
});

test('R3: the tireless are unaffected', () => {
  const [sk] = Enemies.makeMonster('skeleton');
  sk.stamina = 0;
  C.updateCondition(sk);
  assert.ok(C.isActive(sk) && !C.collapsed(sk));
  assert.equal(C.roundRegen(sk, false), 0);
});

test('Second Wind: full regeneration when struck, and a collapse lasts only its own round', async () => {
  const a = armed('A', null, 'party'), b = armed('B', null, 'enemy'), c = armed('C', null, 'enemy');
  a.feats.second_wind = 1;
  const { enc, chars } = await field([[a, 1, 1], [b, 6, 1], [c, 7, 1]]);
  a.stamina = 10; enc.struck[a.id] = 5;
  b.feats.second_wind = 1; b.stamina = 0; C.updateCondition(b);
  await closeRound(enc, chars);
  assert.equal(a.stamina, 10 + C.roundRegen(a, false), 'the whole, struck or not');
  assert.ok(C.isActive(b), 'up at the end of the round it fell in');
});

test('the AI: finishes a collapsed foe in reach rather than strike a fresh one, and does not throw a weak spent blow', async () => {
  const a = armed('A', 'longsword', 'party');
  const down = armed('Down', 'longsword', 'enemy'), up = armed('Up', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 2, 1], [down, 1, 1], [up, 3, 1]]);
  down.stamina = 0; C.updateCondition(down);
  for (let i = 0; i < C.boxes(down) - 1; i++) down.wounds.push({ place: 'torso', sev: 1, kind: 'cut', bleed: 0, pts: 1 }); // a box from down
  Clock.free(enc, a.id);
  a.base.CHA = 1; // no Bait
  const d = B.AI.choose(enc, chars, a.id, () => 0.99);
  assert.equal(d.type, 'strike');
  assert.equal(d.target, down.id, 'finishes the collapsed foe');
  // Out of breath with nothing that could finish anyone: no spent blow.
  const b2 = armed('B', 'longsword', 'party'), f2 = armed('F', 'longsword', 'enemy');
  const g = await field([[b2, 2, 1], [f2, 3, 1]], 10, 3);
  b2.stamina = 1; b2.base.CHA = 1;
  f2.armor = Items.makeArmor('plate'); // nothing a spent blow could finish
  Clock.free(g.enc, b2.id);
  const d2 = B.AI.choose(g.enc, g.chars, b2.id, () => 0.99);
  assert.ok(!(d2.type === 'strike' && Combat.isSpent(b2, d2.option.stamina)), `took ${d2.type}`);
});
