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
  m.skills.arcane = 2; m.feats.verb_strike = 1; m.nouns = ['fire'];
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
  m.skills.arcane = 2; m.feats.verb_strike = 1; m.nouns = ['fire'];
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
  m.skills.arcane = 2; m.feats.verb_cover = 1; m.feats.mod_wide = 1; m.nouns = ['fire'];
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

// ---- The new trees (phase 3): Archery, Shadow, Leadership, Survival, Lore, Athletics, Deception ----------------------
const { World, Battle, Explore, Conditions: Cond } = B;
const bow = (name, type) => { const c = armed(name, type || 'shortbow', 'party'); c.inventory.arrows = 20; return c; };
const shot = (c) => C.attackOptions(c).find((x) => x.ranged && x.motion === 'shoot');

test('Archery: Point Blank shoots at 1; Quick Draw draws cheaper; Far Shot loses nothing at long range; Deadeye aims free', () => {
  const a = bow('Archer');
  assert.equal(shot(a).minRange, 2);
  const draw0 = C.actionCost(a, 'windUp', { option: shot(a) }).ap;
  a.feats.point_blank = 1; a.feats.quick_draw = 2;
  assert.equal(shot(a).minRange, 1);
  assert.ok(C.actionCost(a, 'windUp', { option: shot(a) }).ap < draw0);
  const t = armed('Mark', null, 'enemy');
  const o = shot(a);
  const far = (o.longRange || 8) + 2;
  const sum = (h) => h.toCON + h.slashToAttrs + h.bluntToStamina + h.bluntToCON;
  const before = sum(Combat.computeHit(a, t, o, { distance: far, location: 'torso' }));
  a.feats.far_shot = 1;
  assert.ok(sum(Combat.computeHit(a, t, o, { distance: far, location: 'torso' })) > before);
  const aimed = Object.assign({}, o, { aim: 'head' });
  const p0 = Combat.defenseOdds(t, 'block', o.motion, a, aimed);
  a.feats.deadeye = 1;
  const p1 = Combat.defenseOdds(t, 'block', o.motion, a, aimed);
  assert.ok(p1 <= p0, `aimed shot no harder to land with Deadeye (${p0} → ${p1})`);
});

test('Shadow: Vanish (no foe beside) makes you unseen; Shadow Step moves unanswered; Backstab hits harder', async () => {
  const a = armed('Shade', 'dagger', 'party');
  a.feats.stealth = 1; a.feats.vanish = 1;
  const b = armed('Guard', 'longsword', 'enemy');
  const f = await field([[a, 1, 1], [b, 2, 1]]);
  f.enc.ap[a.id] = 500;
  assert.ok(!Combat.legalActions(f.enc, f.chars, a.id).other.some((o) => o.type === 'vanish'), 'not with a foe beside');
  f.enc.pos[a.id] = { x: 5, y: 1 };
  assert.equal(await Combat.act(f.enc, f.chars, { actor: a.id, type: 'vanish' }, io(recorder([]))), null);
  assert.ok(Cond.has(a, 'unseen'));
  // Shadow Step: walking out past the guard's reach draws nothing while unseen.
  a.feats.shadow_step = 1;
  f.enc.pos[a.id] = { x: 3, y: 1 };
  const r = recorder([]);
  assert.equal(await Combat.act(f.enc, f.chars, { actor: a.id, type: 'move', to: { x: 6, y: 1 } }, io(r)), null);
  assert.equal(r.asked.filter((q) => q.kind === 'opportunity').length, 0);
  // Backstab: +3 to the main damage of a melee blow from unseen.
  a.feats.backstab = 1;
  f.enc.pos[a.id] = { x: 3, y: 1 };
  const o = C.attackOptions(a).find((x) => x.weaponId && C.inRange(x, 1));
  const decl = { actor: a.id, type: 'strike', option: o, target: b.id };
  f.enc.ap[a.id] = 500;
  assert.equal(await Combat.act(f.enc, f.chars, decl, io(recorder([]))), null);
  assert.equal(Math.max(...decl.option.damage), Math.max(...o.damage) + 3);
  assert.ok(!Cond.has(a, 'unseen'), 'striking gives it away');
});

test('Leadership: Rally lets the struck regenerate; Command gives AP; To Your Feet wakes; Demoralize and Dread frighten', async () => {
  const cap = armed('Captain', null, 'party'), ally = armed('Ally', null, 'party');
  const f1 = armed('Foe1', null, 'enemy'), f2 = armed('Foe2', null, 'enemy');
  for (const k of ['rally', 'command', 'to_your_feet', 'demoralize']) cap.feats[k] = 1;
  cap.base.CHA = 10;
  const f = await field([[cap, 1, 1], [ally, 2, 1], [f1, 4, 1], [f2, 4, 2]]);
  f.enc.ap[cap.id] = 500;
  const x = io(recorder([]), [10, 1, 10, 1, 10, 1]);
  assert.equal(await Combat.act(f.enc, f.chars, { actor: cap.id, type: 'rally' }, x), null);
  assert.equal(f.enc.rallied[ally.id], f.enc.round);
  const ap0 = f.enc.ap[ally.id];
  assert.equal(await Combat.act(f.enc, f.chars, { actor: cap.id, type: 'command', target: ally.id }, x), null);
  assert.ok(f.enc.ap[ally.id] > ap0);
  f.enc.ap[cap.id] = 500;
  ally.stamina = 0; ally.status.unconscious = true;
  assert.equal(await Combat.act(f.enc, f.chars, { actor: cap.id, type: 'rouse', target: ally.id }, x), null);
  assert.ok(C.isActive(ally) && ally.stamina === Math.floor(C.maxStamina(ally) / 4));
  assert.ok(!Combat.legalActions(f.enc, f.chars, cap.id).other.some((o) => o.type === 'rouse'), 'once a fight');
  assert.equal(await Combat.act(f.enc, f.chars, { actor: cap.id, type: 'demoralize', target: f1.id }, x), null);
  assert.ok(Cond.has(f1, 'frightened') && !Cond.has(f2, 'frightened'));
  cap.feats.dread = 1;
  Cond.remove(f1, 'frightened');
  assert.equal(await Combat.act(f.enc, f.chars, { actor: cap.id, type: 'demoralize', target: f1.id }, x), null);
  assert.ok(Cond.has(f1, 'frightened') && Cond.has(f2, 'frightened'), 'Dread: every foe within 3');
});

test('Lore: Bane Lore hits creatures harder (not people); Name the Weakness strips a skeleton\'s resistance; Monster Lore briefs', () => {
  const a = armed('Sage', 'dagger', 'party');
  const [skel] = B.Enemies.makeMonster('skeleton');
  const person = armed('Bandit', null, 'enemy');
  const o = C.attackOptions(a).find((x) => x.motion === 'thrust');
  const sum = (h) => h.toCON + h.slashToAttrs + h.bluntToStamina + h.bluntToCON;
  const p0 = sum(Combat.computeHit(a, person, o, { location: 'torso' }));
  a.feats.bane_lore = 2;
  assert.equal(sum(Combat.computeHit(a, person, o, { location: 'torso' })), p0, 'not people');
  assert.ok(skel, 'a skeleton');
  const s0 = sum(Combat.computeHit(a, skel, o, { location: 'torso' }));
  Cond.add(skel, 'named', { rounds: 2 });
  assert.ok(sum(Combat.computeHit(a, skel, o, { location: 'torso' })) > s0, 'piercing gets through once named');
  const w = World.create(World.presetParty(), { log: false });
  World.party(w)[0].feats.monster_lore = 1;
  Battle.start(w, { name: 'Bones', foes: [{ monster: 'skeleton' }] });
  assert.ok(w.battle.enc.log.some((l) => /knows the Skeleton: it takes nothing from piercing; little from slashing/.test(l.text)), w.battle.enc.log.map((l) => l.text).join('\n'));
});

test('Survival: Pathfinder shortens each step', () => {
  const w = World.create(World.presetParty(), { log: false });
  w.explore = { sneak: false };
  const m0 = Explore.minutesPerStep(w);
  World.party(w)[0].feats.pathfinder = 1;
  assert.equal(Explore.minutesPerStep(w), m0 * 0.75);
});

test('Athletics: Bull Rush follows the shove; Charge adds to the next blow; Unstoppable walks through a hit', async () => {
  const a = armed('Bull', null, 'party'), b = armed('Mark', null, 'enemy');
  a.feats.bull_rush = 1; a.base.STR = 12;
  const f = await field([[a, 1, 1], [b, 2, 1]]);
  assert.equal(await Combat.act(f.enc, f.chars, { actor: a.id, type: 'shove', target: b.id }, io(recorder([]), [10, 1])), null);
  assert.ok(f.enc.pos[b.id].x >= 3);
  assert.deepEqual(f.enc.pos[a.id], { x: 2, y: 1 }, 'followed');
  const c = armed('Charger', 'shortsword', 'party'), t = armed('Target', null, 'enemy');
  c.feats.charge = 1;
  const g = await field([[c, 0, 1], [t, 4, 1]]);
  assert.equal(await Combat.act(g.enc, g.chars, { actor: c.id, type: 'move', to: { x: 3, y: 1 } }, io(recorder([]))), null);
  assert.equal(c.status.charging, g.enc.round);
  const o = C.attackOptions(c).find((x) => x.weaponId && C.inRange(x, 1));
  const decl = { actor: c.id, type: 'strike', option: o, target: t.id };
  g.enc.ap[c.id] = 500;
  assert.equal(await Combat.act(g.enc, g.chars, decl, io(recorder([]))), null);
  assert.equal(Math.max(...decl.option.damage), Math.max(...o.damage) + 2);
  // Unstoppable: an opportunity blow that lands does not stop the walk.
  const u = armed('Ram', null, 'party'), gd = armed('Guard', 'longsword', 'enemy');
  u.feats.unstoppable = 1; u.base.CON = 30; u.stamina = 300;
  const h = await field([[u, 2, 1], [gd, 1, 1]]);
  assert.equal(await Combat.act(h.enc, h.chars, { actor: u.id, type: 'move', to: { x: 5, y: 1 } }, io(recorder(['leaves']), [10, 10, 1, 1, 1, 1])), null);
  assert.deepEqual(h.enc.pos[u.id], { x: 5, y: 1 });
});

test('Deception: Feign Death hides you even up close; Dirty Trick leaves a baited foe exposed; Deception adds to bait and feints', async () => {
  const a = armed('Trickster', 'dagger', 'party'), b = armed('Mark', 'longsword', 'enemy');
  a.feats.feign_death = 1; a.feats.dirty_trick = 1; a.base.CHA = 12;
  const f = await field([[a, 1, 1], [b, 2, 1]]);
  assert.equal(await Combat.act(f.enc, f.chars, { actor: a.id, type: 'bait', target: b.id }, io(recorder([]), [10, 1])), null);
  assert.ok(Cond.has(b, 'exposed'));
  f.enc.ap[a.id] = 500;
  assert.equal(await Combat.act(f.enc, f.chars, { actor: a.id, type: 'feign' }, io(recorder([]))), null);
  assert.ok(a.status.prone && Combat.unseenBy(f.enc, f.chars, a, b), 'unseen beside them');
  assert.equal(Combat.feintScore(a), 0);
  a.skills.deception = 2;
  assert.equal(Combat.feintScore(a), 2);
});

test('Deception in parley: Cover Story loses no disposition when caught; The Big Lie lands for 2', () => {
  const P = B.Parley, R = B.Rand;
  // Caught every time (a hopeless liar), with and without a cover story.
  for (const cover of [false, true]) {
    R.seed(5);
    const w = World.create(World.presetParty(), { log: false });
    for (const c of World.party(w)) { c.base.CHA = 1; c.base.INT = 1; if (cover) c.feats.cover_story = 1; }
    P.start(w, 'marta_quill');
    let caught = 0;
    for (let i = 0; i < 4 && !w.parley.last; i++) { const d0 = w.parley.dispMod; const r = P.move(w, 'bluff'); if (r.check && !r.check.ok) { caught++; assert.equal(w.parley.dispMod, cover ? d0 : d0 - 2); } }
    assert.ok(caught > 0, 'caught at least once');
  }
  // A practised liar with the Big Lie.
  R.seed(5);
  const w = World.create(World.presetParty(), { log: false });
  for (const c of World.party(w)) { c.base.CHA = 10; c.feats.liar = 3; c.feats.big_lie = 1; }
  P.start(w, 'marta_quill');
  const m0 = w.parley.willMod;
  const r = P.move(w, 'bluff');
  assert.ok(r.check.ok, 'it lands');
  assert.equal(w.parley.willMod, m0 + 2);
});
