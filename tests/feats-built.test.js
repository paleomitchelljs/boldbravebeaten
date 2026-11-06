// Feats that were on the sheet but did nothing, now built (feat trees overhaul, phase 2; docs/PROPOSALS.md §3).
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load');
const { Character: C, Combat, Items, Enemies } = B;

function roller(seed, queue) {
  const rng = Enemies.makeRng(seed || 7);
  const q = (queue || []).slice();
  return async (req) => {
    const out = [];
    for (let i = 0; i < req.count; i++) out.push(q.length ? q.shift() : 1 + Math.floor(rng() * req.sides));
    return out;
  };
}

function armed(name, type, side) {
  const c = C.newCharacter({ name, side, starterGear: false });
  if (type) { const w = Items.makeWeapon(type); c.weapons.push(w); c.wield = w.id; }
  c.stamina = C.maxStamina(c);
  return c;
}

// An encounter with everyone placed; the first listed acts first (initiative rolls 10, then 1s).
async function field(list, w, h) {
  const chars = {};
  for (const [c] of list) chars[c.id] = c;
  const enc = Combat.createEncounter('t', list.map(([c]) => c.id), chars, w || 8, h || 3);
  for (const [c, x, y] of list) enc.pos[c.id] = { x, y };
  await Combat.startRound(enc, chars, roller(1, [10].concat(list.slice(1).map(() => 1))));
  return { enc, chars };
}

// A react that records what was asked and takes the first option of the kinds named.
function recorder(take) {
  const asked = [];
  const react = async (req) => {
    asked.push(req);
    if (take && take.includes(req.why || req.kind)) return req.options[0];
    return null;
  };
  return { asked, react };
}
const io = (r, queue) => ({ roller: roller(3, queue), react: r.react });

test('Slip Through: stepping out of a foe\'s reach draws no opportunity strike; without it, it does', async () => {
  for (const feat of [false, true]) {
    const a = armed('Runner', 'dagger', 'party');
    if (feat) a.feats.slip_through = 1;
    const b = armed('Guard', 'longsword', 'enemy');
    const { enc, chars } = await field([[a, 2, 1], [b, 1, 1]]);
    const r = recorder([]);
    assert.equal(await Combat.act(enc, chars, { actor: a.id, type: 'move', to: { x: 5, y: 1 } }, io(r)), null);
    const asked = r.asked.filter((q) => q.kind === 'opportunity');
    assert.equal(asked.length, feat ? 0 : 1, feat ? 'slips away' : 'draws a blow');
  }
});

test('Counter Step: after a good dodge, the next move\'s first square is free and draws no strike', async () => {
  const a = armed('Dancer', 'dagger', 'party');
  a.feats.counter_step = 1;
  a.status.counterStep = null;
  const b = armed('Guard', 'longsword', 'enemy');
  const { enc, chars } = await field([[a, 2, 1], [b, 1, 1]]);
  a.status.counterStep = enc.round; // as a successful dodge leaves it
  const r = recorder([]);
  const ap0 = enc.ap[a.id];
  assert.equal(await Combat.act(enc, chars, { actor: a.id, type: 'move', to: { x: 3, y: 1 } }, io(r)), null);
  assert.equal(r.asked.filter((q) => q.kind === 'opportunity').length, 0);
  assert.equal(enc.ap[a.id], ap0, 'one square, free');
  assert.equal(a.status.counterStep, null, 'used up');
});

test('Shield Wall: covers an ally two squares off, at no penalty', async () => {
  const atk = armed('Raider', 'longsword', 'enemy');
  const t = armed('Friend', null, 'party');
  const s = armed('Wall', 'shortsword', 'party');
  s.shield = Items.makeShield('heater', 'wood');
  const { enc, chars } = await field([[atk, 0, 1], [t, 1, 1], [s, 3, 1]]);
  const d = { actor: atk.id, target: t.id, type: 'strike', option: C.attackOptions(atk).find((x) => x.weaponId) };
  assert.equal(Combat.coverOptions(enc, chars, t, atk, d).length, 0, 'two squares off: no cover');
  enc.pos[s.id] = { x: 2, y: 1 };
  const near = Combat.coverOptions(enc, chars, t, atk, d);
  assert.equal(near.length, 1, 'beside them: cover');
  assert.equal(near[0].penalty, B.CONFIG.defense.cover.penalty);
  enc.pos[s.id] = { x: 3, y: 1 };
  s.feats.shield_wall = 1;
  const o = Combat.coverOptions(enc, chars, t, atk, d);
  assert.equal(o.length, 1);
  assert.equal(o[0].penalty, 0);
});

test('Cleave: a blow that drops its foe carries on into another in reach', async () => {
  const a = armed('Reaper', 'greatsword', 'party');
  a.feats.cleave = 1;
  a.base.STR = 10; a.stamina = C.maxStamina(a);
  const f1 = armed('First', null, 'enemy'), f2 = armed('Second', null, 'enemy');
  const { enc, chars } = await field([[a, 1, 1], [f1, 2, 1], [f2, 2, 2]]);
  f1.stamina = 1; // one blow puts them down
  const r = recorder(['cleave']);
  const o = C.attackOptions(a).find((x) => x.weaponId && !x.windUp && C.inRange(x, 1));
  assert.ok(o, 'a blow in reach');
  assert.equal(await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: o, target: f1.id }, io(r, [10, 10, 10, 10])), null);
  assert.ok(!C.isActive(f1), 'the first is down');
  const ask = r.asked.find((q) => q.why === 'cleave');
  assert.ok(ask, 'offered a cleave');
  assert.equal(ask.target, f2.id);
  assert.ok(ask.options.every((x) => x.ap === 0), 'free');
  assert.ok(enc.decls.some((d) => d.cleave && d.target === f2.id), 'the cleave was struck');
});

test('Overchannel: a spell beyond the pool is paid in CON', async () => {
  const m = C.newCharacter({ name: 'Mage', side: 'party', starterGear: false });
  m.feats.casting = 1; m.feats.verb_strike = 1; m.nouns = ['fire'];
  m.feats.overchannel = 1;
  m.stamina = C.maxStamina(m);
  const o = C.attackOptions(m).find((x) => x.spell);
  assert.ok(o, 'a fire bolt');
  m.spSpent = B.Magic.maxSP(m); // pool empty
  assert.ok(B.Magic.overchannelSP(m) >= o.spCost);
  const con0 = C.attr(m, 'CON');
  const foe = armed('Target', null, 'enemy');
  const { enc, chars } = await field([[m, 1, 1], [foe, 2, 1]]);
  const r = recorder([]);
  assert.equal(await Combat.act(enc, chars, { actor: m.id, type: 'strike', option: o, target: foe.id }, io(r, [10, 10])), null);
  assert.equal(C.attr(m, 'CON'), con0 - o.spCost);
});

test('Steady Mind: bolts can be cast in a grapple', () => {
  const m = C.newCharacter({ name: 'Mage', side: 'party', starterGear: false });
  m.feats.casting = 1; m.feats.verb_strike = 1; m.nouns = ['fire'];
  m.status.grapple = { role: 'held', partner: 'someone' };
  assert.ok(C.isHeld(m));
  assert.ok(!C.attackOptions(m).some((x) => x.spell));
  m.feats.steady_mind = 1;
  assert.ok(C.attackOptions(m).some((x) => x.spell));
});

// A holder and the one they hold (level 'hold' or 'pin'), side by side; the first listed acts first.
async function held(level, first) {
  const h = armed('Holder', 'dagger', 'party');
  const v = armed('Held', null, 'enemy');
  const pair = first === 'held' ? [[v, 2, 1], [h, 1, 1]] : [[h, 1, 1], [v, 2, 1]];
  const f = await field(pair);
  h.status.grapple = { partner: v.id, level, role: 'holder' };
  v.status.grapple = { partner: h.id, level, role: 'held' };
  return Object.assign(f, { h, v });
}

test('Iron Grip: a held foe cannot break free while the holder pays a step\'s AP; Joint Lock bites when it holds', async () => {
  const { enc, chars, h, v } = await held('hold', 'held');
  h.feats.iron_grip = 1; h.feats.joint_lock = 1;
  const ap0 = enc.ap[h.id], dex0 = C.attr(v, 'DEX');
  assert.equal(await Combat.act(enc, chars, { actor: v.id, type: 'break', target: h.id }, io(recorder([]), [10, 10, 1, 1])), null);
  assert.equal(C.holding(h), v.id, 'still held');
  assert.equal(enc.ap[h.id], ap0 - C.minAP());
  assert.equal(C.attr(v, 'DEX'), dex0 - 1, 'the joint wrenched');
});

test('Human Shield: a blow at a holder lands on the one they hold', async () => {
  const { enc, chars, h, v } = await held('hold');
  h.feats.human_shield = 1;
  const atk = armed('Raider', 'longsword', 'enemy');
  chars[atk.id] = atk; enc.ids.push(atk.id); enc.pos[atk.id] = { x: 0, y: 1 };
  enc.ap[atk.id] = 10;
  const o = C.attackOptions(atk).find((x) => x.weaponId && !x.windUp && C.inRange(x, 1));
  const before = { h: [h.stamina, C.totalDamage(h)], v: [v.stamina, C.totalDamage(v)] };
  enc.turn = enc.order.indexOf(atk.id) >= 0 ? enc.order.indexOf(atk.id) : enc.turn;
  if (!enc.order.includes(atk.id)) { enc.order.splice(enc.turn, 0, atk.id); }
  assert.equal(await Combat.act(enc, chars, { actor: atk.id, type: 'strike', option: o, target: h.id }, io(recorder([]), [10, 10, 10, 10])), null);
  assert.deepEqual([h.stamina, C.totalDamage(h)], before.h, 'the holder untouched');
  assert.ok(v.stamina < before.v[0] || C.totalDamage(v) > before.v[1], 'the held one hurt');
});

test('Flurry: a light thrust doubled, for half again the AP; struck twice', async () => {
  const a = armed('Duelist', 'rapier', 'party');
  const t0 = C.attackOptions(a).find((x) => x.motion === 'thrust' && x.weaponId);
  assert.ok(!C.attackOptions(a).some((x) => x.flurry));
  a.feats.flurry = 1;
  const f = C.attackOptions(a).find((x) => x.flurry);
  assert.ok(f);
  assert.equal(f.ap, Math.round(t0.ap * 1.5));
  const foe = armed('Foe', null, 'enemy');
  foe.base.CON = 99; foe.stamina = 200;
  const { enc, chars } = await field([[a, 1, 1], [foe, 2, 1]]);
  assert.equal(await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: f, target: foe.id }, io(recorder([]))), null);
  assert.equal(enc.decls.filter((d) => d.actor === a.id && d.type === 'strike').length, 2);
});

test('Sweep: a two-handed swing carries into a foe beside its target at half force', async () => {
  const a = armed('Reaper', 'greatsword', 'party');
  a.feats.sweep = 1;
  const f1 = armed('One', null, 'enemy'), f2 = armed('Two', null, 'enemy');
  const { enc, chars } = await field([[a, 1, 1], [f1, 2, 1], [f2, 2, 2]]);
  const o = C.attackOptions(a).find((x) => x.weaponId && x.motion !== 'thrust' && !x.windUp && C.inRange(x, 1));
  assert.ok(o);
  assert.equal(await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: o, target: f1.id }, io(recorder([]))), null);
  const s = enc.decls.find((d) => d.sweep);
  assert.ok(s, 'swept');
  assert.equal(s.target, f2.id);
  assert.deepEqual(s.option.damage, o.damage.map((v) => Math.floor(v / 2)));
});

test('Firestorm makes Fire + Wide a point cheaper; Ember Heart halves fire', () => {
  const m = C.newCharacter({ name: 'Pyre', side: 'party', starterGear: false });
  m.feats.casting = 1; m.feats.verb_cover = 1; m.feats.mod_wide = 1; m.nouns = ['fire'];
  const key = (o) => o.spellKey === 'cover+fire+wide';
  const all = () => B.Magic.spellOptions(m);
  const before = all().find(key);
  assert.ok(before, 'a wide fire');
  m.feats.firestorm = 1;
  assert.equal(all().find(key).spCost, before.spCost - 1);
  assert.equal(all().find((o) => o.spellKey === 'cover+fire').spCost, 4, 'not without Wide');
  assert.equal(C.damageMult(m, 'fire'), 1);
  m.feats.ember_heart = 1;
  assert.equal(C.damageMult(m, 'fire'), 0.5);
});
