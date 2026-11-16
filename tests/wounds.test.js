// Wounds and life (docs/OVERHAUL.md step E): named wounds by place and severity, wound boxes by size, shock, pain,
// bleeding, winding, down before dead; the AI's expectation matches the dice.
const test = require('node:test');
const assert = require('node:assert');
const B = require('./load');
const Clock = require('./clock');
const { Character: C, Combat, Items, Enemies, CONFIG } = B;
// Blows here land at a fixed force (vigor has its own test).
CONFIG.vigor = null;
const W = CONFIG.wounds;

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
  c.armor = null; c.pieces = [];
  for (const p of pieces || []) { if (Items.coversOf(p).includes('torso')) c.armor = p; else c.pieces.push(p); }
  if (traits) c.traits = Object.assign({}, c.traits, traits);
  c.stamina = C.maxStamina(c);
  return c;
}
const enc0 = () => ({ struck: {}, fortressUsed: {}, log: [], pos: {} });
const opt = (a, motion) => C.attackOptions(a).find((o) => o.motion === motion && !o.power && !o.windUp && !o.halfSword && !o.unarmed);
const wound = (place, sev, extra) => Object.assign({ place, sev, kind: 'cut', bleed: 0, pts: W.severity[sev - 1] }, extra || {});

test('severity: points past the armor against the thresholds (× size), a step more when vital', () => {
  const t = body();
  assert.strictEqual(C.severityOf(t, 0), 0);
  for (let i = 0; i < W.severity.length; i++) {
    assert.strictEqual(C.severityOf(t, W.severity[i]), i + 1);
    if (W.severity[i] > 1) assert.strictEqual(C.severityOf(t, W.severity[i] - 1), i);
  }
  const big = body(null, { size: 2 });
  assert.strictEqual(C.severityOf(big, W.severity[1]), 1, 'a man-sized wound is shallower in a big body');
  assert.strictEqual(C.boxes(big), Math.round(W.boxes * 2));
  // A blow at a fixed place and margin: its points and severity; at the vital margin, a step worse.
  const a = armed('longsword');
  const thrust = opt(a, 'thrust');
  const low = Combat.computeHit(a, t, thrust, { location: 'torso', margin: 1 });
  assert.ok(low.pts > 0 && low.kind === 'point');
  assert.strictEqual(low.sev, C.severityOf(t, low.pts));
  const vital = Combat.computeHit(a, t, thrust, { location: 'torso', margin: low.vitalAt });
  assert.ok(vital.vital);
  assert.strictEqual(vital.sev, Math.min(3, low.sev + 1));
  assert.ok(vital.bleed > low.bleed, 'a vital wound bleeds more');
});

test('boxes: filling them takes a body down; a wound on a body already down kills it; hero mode only ever downs', () => {
  const t = body();
  const n = C.boxes(t);
  for (let i = 0; i < n - 1; i++) C.addWound(t, wound('arms', 1), null);
  assert.ok(C.isActive(t), 'one box short');
  let r = C.addWound(t, wound('legs', 1), null);
  assert.ok(r.down && C.isDown(t) && !t.status.dead && t.status.prone);
  r = C.addWound(t, wound('arms', 1), null);
  assert.ok(r.dead && t.status.dead, 'struck again while down');
  const h = body();
  h.hero = true;
  for (let i = 0; i < n + 3; i++) C.addWound(h, wound('torso', 1), null);
  assert.ok(C.isDown(h) && !h.status.dead, 'a hero is down, never dead');
});

test('shock: a severity-3 wound downs unless d10 + CON reaches wounds.shock; a head wound of 3 drops outright', () => {
  const need = W.shock;
  let t = body();
  const con = C.attr(t, 'CON');
  let r = C.addWound(t, wound('arms', 3), need - con);
  assert.ok(r.shock.held && C.isActive(t), 'resisted');
  t = body();
  r = C.addWound(t, wound('arms', 3), need - con - 1);
  assert.ok(!r.shock.held && C.isDown(t), 'failed');
  t = body();
  r = C.addWound(t, wound('head', W.places.head.down), 10);
  assert.ok(!r.shock && C.isDown(t), 'the head drops it with no check');
  // The tireless feel no shock: down only by the boxes.
  t = body(null, { tireless: true });
  r = C.addWound(t, wound('arms', 3), 1);
  assert.ok(C.isActive(t) && !r.shock);
  // The chance the AI and the panel see.
  t = body();
  assert.strictEqual(Combat.downChance(t, 'arms', 3), Math.max(0, Math.min(1, (need - con - 1) / 10)));
  assert.strictEqual(Combat.downChance(t, 'head', 3), 1);
  assert.strictEqual(Combat.downChance(t, 'arms', 2), 0);
});

test('places: an arm wound weakens blows and makes them dearer and drops what is held at 3; a leg wound slows, fells and keeps the body down; a head wound stuns', async () => {
  const a = armed('longsword');
  const swing0 = opt(a, 'swing');
  const parry0 = C.actionCost(a, 'parry').ap;
  a.base.WIL = 1; // no grit: every severity tells
  a.wounds.push(wound('arms', 2));
  const swing2 = opt(a, 'swing');
  assert.strictEqual(swing2.damage[C.mainIndex(swing2.damage)], swing0.damage[C.mainIndex(swing0.damage)] - W.places.arms.damage[1]);
  assert.ok(swing2.ap > swing0.ap && C.actionCost(a, 'parry').ap > parry0, 'dearer');
  // Pain: WIL acts through floor(WIL / pain) of a place's severity.
  a.base.WIL = 2 * W.pain;
  assert.strictEqual(C.grit(a), 2);
  assert.strictEqual(opt(a, 'swing').damage[C.mainIndex(swing0.damage)], swing0.damage[C.mainIndex(swing0.damage)], 'acted through');
  // A leg: fewer squares, a worse dodge.
  const r = body();
  r.base.WIL = 1;
  const sq = C.squaresPerAP(r);
  r.wounds.push(wound('legs', 1));
  assert.strictEqual(C.squaresPerAP(r), Math.max(1, sq - W.places.legs.move[0]));
  // Laid on by a blow: severity 3 at the arms drops the weapon; at the legs, down and can't stand.
  const t = armed('longsword');
  t.side = 'enemy';
  const hit = { kind: 'strike', motion: 'swing', damage: [0, W.severity[2], 0], label: 'axe', wound: { kind: 'S', vital: 0, bleed: 1 } };
  const enc = enc0();
  await Combat.applyHit(enc, { [a.id]: a, [t.id]: t }, a, t, hit, fixed([], 10), { location: 'arms', margin: 1 });
  assert.ok(!C.wieldedWeapon(t), 'dropped');
  const u = armed();
  u.side = 'enemy';
  await Combat.applyHit(enc0(), { [a.id]: a, [u.id]: u }, a, u, hit, fixed([], 10), { location: 'legs', margin: 1 });
  assert.ok(u.status.prone && C.cannotStand(u));
  // A head wound of 2 stuns with no save.
  const v = armed();
  v.side = 'enemy';
  const two = { kind: 'strike', motion: 'swing', damage: [0, W.severity[1], 0], label: 'cut', wound: { kind: 'S', vital: 0, bleed: 1 } };
  await Combat.applyHit(enc0(), { [a.id]: a, [v.id]: v }, a, v, two, fixed([], 10), { location: 'head', margin: 1 });
  assert.ok(B.Conditions.has(v, 'stunned'));
});

test('winding: blunt that breaks nothing costs a fixed winding by its severity, not point for point', () => {
  const a = armed();
  const t = body([Items.makeArmor('padded', 'full', 'average')]);
  for (const B0 of [1, 3, 5, 8]) {
    const h = Combat.computeHit(a, t, { kind: 'strike', motion: 'swing', damage: [0, 0, B0], label: 'club' }, { location: 'torso', margin: 1 });
    const s = C.severityOf(t, h.blunt);
    assert.strictEqual(h.winding, s ? W.winding[s - 1] : 0, `B ${B0}: blunt ${h.blunt}`);
  }
  // A tireless body has no stamina: blunt breaks its frame.
  const g = body(null, { tireless: true });
  const h = Combat.computeHit(a, g, { kind: 'strike', motion: 'swing', damage: [0, 0, 6], label: 'club' }, { location: 'torso', margin: 1 });
  assert.ok(h.crush > 0 && h.kind === 'crush' && !h.winding && !h.bleed);
  // An untrained punch winds only.
  const p = Combat.computeHit(a, body(), { kind: 'strike', motion: 'swing', damage: [0, 0, 8], label: 'fist', staminaOnly: true }, { location: 'arms', margin: 1 });
  assert.strictEqual(p.pts, 0);
});

test('bleeding: each round is blood lost (harm), less CON; at the fight\'s end the down are bound by a side that stands, else bleed out or not by d10 + CON', async () => {
  const t = body();
  t.wounds.push(wound('torso', 1, { bleed: 2 }));
  assert.strictEqual(C.bleedLoss(t), Math.max(0, 2 * W.bleed.harm - Math.floor(C.attr(t, 'CON') / W.bleed.conPer)));
  const ally = body(), foe = armed();
  ally.side = 'enemy';
  const down = () => { const c = body(); for (let i = 0; i < C.boxes(c) - 1; i++) c.wounds.push(wound('torso', 1)); C.addWound(c, wound('legs', 1, { bleed: 2 }), null); return c; };
  // Their side stands: bound.
  let d = down();
  let enc = Combat.createEncounter('t', [d.id, ally.id, foe.id], { [d.id]: d, [ally.id]: ally, [foe.id]: foe }, 6, 6);
  await Combat.settleFallen(enc, { [d.id]: d, [ally.id]: ally, [foe.id]: foe }, fixed([], 1));
  assert.ok(!d.status.dead && C.bleeding(d) === 0);
  // Nobody of theirs stands: d10 + CON against survive + bleeding.
  d = down();
  enc = Combat.createEncounter('t', [d.id, foe.id], { [d.id]: d, [foe.id]: foe }, 6, 6);
  await Combat.settleFallen(enc, { [d.id]: d, [foe.id]: foe }, fixed([], 1));
  assert.ok(d.status.dead, 'bled out');
  const alone = (c) => Combat.createEncounter('t', [c.id, foe.id], { [c.id]: c, [foe.id]: foe }, 6, 6);
  d = down();
  await Combat.settleFallen(alone(d), { [d.id]: d, [foe.id]: foe }, fixed([], 10));
  assert.ok(!d.status.dead && C.bleeding(d) === 0, 'it clots');
  d = down();
  d.hero = true;
  await Combat.settleFallen(alone(d), { [d.id]: d, [foe.id]: foe }, fixed([], 1));
  assert.ok(!d.status.dead, 'hero mode');
});

test('healing: a bandage binds every wound and Medicine mends the worst a step; mended under its boxes, a body that was down comes to', async () => {
  const a = armed();
  a.skills.medicine = 10;
  const t = body();
  for (let i = 0; i < C.boxes(t) - 2; i++) t.wounds.push(wound('torso', 1));
  C.addWound(t, wound('arms', 2, { bleed: 2 }), null);
  assert.ok(C.isDown(t));
  a.inventory.bandages = 1;
  const chars = { [a.id]: a, [t.id]: t };
  const enc = Combat.createEncounter('t', [a.id, t.id], chars, 6, 6);
  enc.pos[a.id] = { x: 1, y: 1 }; enc.pos[t.id] = { x: 2, y: 1 };
  t.side = 'party';
  await Clock.start(enc, chars, fixed([], 6));
  enc.turn = enc.order.indexOf(a.id); enc.phase = 'turn';
  const la = Combat.legalActions(enc, chars, a.id);
  assert.ok(la.other.some((o) => o.type === 'bandage' && o.targets.some((x) => x.id === t.id)));
  await Clock.act(enc, chars, { actor: a.id, type: 'bandage', target: t.id }, { roller: fixed([], 10) });
  assert.strictEqual(C.bleeding(t), 0);
  assert.ok(C.wounds(t).some((w) => w.place === 'arms' && w.sev === 1), 'a step better');
  assert.ok(C.isActive(t), 'under the boxes: they come to');
  // Give + Life mends condMag steps and binds.
  const u = body();
  u.wounds.push(wound('legs', 3, { bleed: 3 }));
  const line = B.Magic.mend(u, { condMag: 2, magnitude: 4 }, 1);
  assert.ok(/bleeding stops/.test(line) && C.wounds(u)[0].sev === 1, line);
});

test('harm over time adds to one wound of its kind; a joint lock wrenches the arm', () => {
  const t = body();
  C.harm(t, 1, 'torso', 'poison');
  C.harm(t, 2, 'torso', 'poison');
  assert.strictEqual(C.wounds(t).filter((w) => w.kind === 'poison').length, 1);
  assert.strictEqual(C.wounds(t)[0].sev, C.severityOf(t, 3));
  C.harm(t, W.severity[1], 'torso', 'poison');
  assert.strictEqual(C.wounds(t)[0].sev, C.severityOf(t, 3 + W.severity[1]));
  // A condition's dot is harm of its kind.
  const u = body();
  B.Conditions.add(u, 'burning', { beats: 2, mag: 1 });
  B.Conditions.endRound(u);
  assert.ok(C.wounds(u).some((w) => w.kind === 'fire' && w.sev >= 1));
});

test('wounds: the expectation the AI sees matches applyHit on average (severity, down, winding)', async () => {
  const compare = async (name, mk, a, option, n) => {
    const h = Combat.computeHit(a, mk(), option, {});
    const roll = rng(4242);
    let sev = 0, down = 0, st = 0;
    for (let i = 0; i < n; i++) {
      const t = mk();
      const s0 = t.stamina;
      const r = await Combat.applyHit(enc0(), { [a.id]: a, [t.id]: t }, a, t, option, roll, {});
      sev += r.hit.sev;
      if (C.isDown(t)) down++;
      st += s0 - t.stamina;
    }
    sev /= n; down /= n; st /= n;
    const tol = (x, k) => (k || 0.06) * Math.max(1, x);
    assert.ok(Math.abs(sev - h.sev) < tol(h.sev), `${name}: severity ${sev.toFixed(3)} rolled, ${h.sev.toFixed(3)} expected`);
    assert.ok(Math.abs(down - h.downP) < 0.03, `${name}: down ${down.toFixed(3)} rolled, ${h.downP.toFixed(3)} expected`);
    assert.ok(Math.abs(st - h.winding) < tol(h.winding, 0.08), `${name}: winding ${st.toFixed(2)} rolled, ${h.winding.toFixed(2)} expected`);
    return h;
  };
  const sword = armed('longsword');
  const thrust = opt(sword, 'thrust');
  await compare('thrust, bare', () => body(), sword, thrust, 3000);
  await compare('thrust, padded half', () => body([Items.makeArmor('padded', 'half', 'average')]), sword, thrust, 3000);
  await compare('thrust, mail', () => body([Items.makeArmor('mail', 'full', 'average')]), sword, thrust, 3000);
  await compare('thrust aimed at the legs', () => body(), sword, Object.assign({}, thrust, { aim: 'legs' }), 3000);
  const hammer = armed('warhammer');
  const crush = await compare('warhammer, padded', () => body([Items.makeArmor('padded', 'full', 'average')]), hammer, opt(hammer, 'swing'), 3000);
  assert.ok(crush.winding > 0);
});

test('maximum stamina reads current attributes; a condition that lowers it clamps current stamina', () => {
  const c = body();
  const full = C.maxStamina(c);
  assert.strictEqual(full, CONFIG.stamina.base + C.attr(c, 'STR') + C.attr(c, 'SPD') + C.attr(c, 'DEX'), 'no CON in it');
  const key = Object.keys(CONFIG.conditions).find((k) => CONFIG.conditions[k].attrs && Object.entries(CONFIG.conditions[k].attrs).some(([x, v]) => v < 0 && ['STR', 'SPD', 'DEX'].includes(x)));
  assert.ok(key, 'a condition that lowers an attribute');
  c.stamina = C.maxStamina(c);
  B.Conditions.add(c, key, { beats: 2 });
  assert.ok(c.stamina <= C.maxStamina(c) && C.maxStamina(c) < full, 'clamped');
  const low = c.stamina;
  B.Conditions.remove(c, key);
  assert.strictEqual(c.stamina, low, 'not raised when it ends');
});
