// The battle panel's odds (docs/PLAN.md step 7): Combat.foresee lays out the dice of one blow from what the attacker
// can see. Each number it gives is checked here against many seeded resolutions of the same blow through the engine
// (resolveAction: the defence roll, the location, the gap, pass-through, the vital roll, the wound tables).
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load');
const { Character: C, Combat, Items, Enemies } = B;

function roller(rng) {
  return async (req) => Array.from({ length: req.count }, () => 1 + Math.floor(rng() * req.sides));
}
function body(name, side, weapon, kit) {
  const c = C.newCharacter({ name, side, starterGear: false });
  c.id = name;
  if (weapon) { const w = Items.makeWeapon(weapon); c.weapons.push(w); c.wield = w.id; }
  if (kit) kit(c);
  c.stamina = C.maxStamina(c);
  return c;
}
const pick = (c, pred) => C.attackOptions(c).find((o) => !o.windUp && !o.halfSword && pred(o));

// n resolutions of a's blow at t, t meeting it with `kind` (null: taking it). Fresh bodies every time.
async function simulate(mkA, mkT, optFn, kind, n, dist, seed) {
  const rng = Enemies.makeRng(seed || 99);
  const io = { roller: roller(rng), react: async (req) => (req.kind === 'defend' && req.actor === 'T' ? kind : null) };
  const s = { lands: 0, drop: 0, kill: 0, vital: 0, CON: 0, other: 0, stamina: 0, n };
  for (let i = 0; i < n; i++) {
    const a = mkA(), t = mkT();
    const chars = { [a.id]: a, [t.id]: t };
    const enc = Combat.createEncounter('t', [a.id, t.id], chars, 8, 3);
    enc.pos[a.id] = { x: 1, y: 1 }; enc.pos[t.id] = { x: 1 + dist, y: 1 };
    enc.round = 1; enc.ap[a.id] = 999; enc.ap[t.id] = 999;
    const o = optFn(a);
    const st0 = t.stamina;
    await Combat.resolveAction(enc, chars, { actor: a.id, target: t.id, type: 'strike', option: o, ap: o.ap, stamina: o.stamina }, io);
    const text = enc.log.map((l) => l.text || l).join('\n');
    if (/ hits T/.test(text)) s.lands++;
    if (/VITAL/.test(text)) s.vital++;
    if (!C.isActive(t)) s.drop++;
    if (t.status.dead) s.kill++;
    for (const k in t.damage) if (k === 'CON') s.CON += t.damage[k]; else s.other += t.damage[k] || 0;
    s.stamina += st0 - t.stamina;
  }
  for (const k of ['lands', 'drop', 'kill', 'vital', 'CON', 'other', 'stamina']) s[k] /= n;
  return s;
}

function check(name, f, kind, s) {
  const d = kind ? f.defences.find((x) => x.kind === kind) : null;
  if (kind) assert.ok(d, `${name}: ${kind} is offered`);
  const lands = d ? 1 - d.odds : 1;
  // What lands (failed or beat through) is in the hit numbers; a stopped blow only jars.
  const harm = d ? d.failed : f.hit;
  const w = d ? 1 - d.odds : 1;
  const thr = d && d.through ? d.through : null;
  const exp = {
    lands: lands + (thr && d.kind !== 'block' ? d.odds : 0),
    drop: d ? d.drop : f.hit.drop,
    kill: d ? d.kill : f.hit.kill,
    vital: w * harm.vital + (thr ? d.odds * thr.vital : 0),
    CON: w * harm.CON + (thr ? d.odds * thr.CON : 0),
    other: w * Object.values(harm.attrs).reduce((x, y) => x + y, 0) + (thr ? d.odds * Object.values(thr.attrs).reduce((x, y) => x + y, 0) : 0),
  };
  if (process.env.ODDS_DEBUG) console.log(name, ['lands', 'drop', 'kill', 'vital', 'CON', 'other'].map((k) => `${k} ${s[k].toFixed(3)}/${exp[k].toFixed(3)}`).join('  '));
  const pts = (x) => 0.035 + 0.06 * x; // a few points; a little more on counts of attribute points
  for (const k of ['lands', 'drop', 'kill', 'vital']) assert.ok(Math.abs(s[k] - exp[k]) <= 0.035, `${name}: ${k} ${s[k].toFixed(3)} rolled, ${exp[k].toFixed(3)} foreseen`);
  for (const k of ['CON', 'other']) assert.ok(Math.abs(s[k] - exp[k]) <= pts(exp[k]), `${name}: ${k} ${s[k].toFixed(3)} rolled, ${exp[k].toFixed(3)} foreseen`);
}

async function scenario(name, mkA, mkT, optFn, kind, dist) {
  const a = mkA(), t = mkT();
  const f = Combat.foresee(a, t, optFn(a), { distance: dist || 1 });
  assert.ok(f, name);
  const s = await simulate(mkA, mkT, optFn, kind, 3000, dist || 1);
  check(name, f, kind, s);
  return { f, s };
}

const mailed = (c) => { c.armor = Items.makeArmor('mail', 'full', 'average'); };
const shielded = (c) => { c.shield = Items.makeShield('round', 'wood', 'average'); };

test('a thrust at a mailed swordsman who parries: lands, wounds, vital and drop as the dice fall', async () => {
  const { f } = await scenario('thrust vs mail, parried', () => body('A', 'party', 'longsword'), () => body('T', 'enemy', 'shortsword', mailed), (a) => pick(a, (o) => o.motion === 'thrust'), 'parry');
  assert.equal(f.best != null, true);
  assert.ok(f.lands > 0 && f.lands < 1);
});

test('a swing at a shield-bearer who blocks, and at one who takes it', async () => {
  const mkT = () => body('T', 'enemy', 'shortsword', shielded);
  const swing = (a) => pick(a, (o) => o.motion === 'swing' && !o.unarmed);
  await scenario('swing vs shield, blocked', () => body('A', 'party', 'battleAxe'), mkT, swing, 'block');
  await scenario('swing vs shield, taken', () => body('A', 'party', 'battleAxe'), mkT, swing, null);
});

test('a heavy swing beats through a light parry, weakened', async () => {
  const { f } = await scenario('mace vs dagger parry', () => body('A', 'party', 'greatAxe'), () => body('T', 'enemy', 'dagger'), (a) => pick(a, (o) => o.motion === 'twoHanded' || o.motion === 'swing'), 'parry');
  const p = f.defences.find((d) => d.kind === 'parry');
  assert.ok(p.carry > 0 && p.through, 'some of it carries through the parry');
});

test('an aimed blow at the head of a dodging foe, and one at a prone foe who cannot cover it', async () => {
  const aimHead = (a) => Object.assign({}, pick(a, (o) => o.motion === 'thrust'), { aim: 'head' });
  const { f } = await scenario('aimed head thrust, dodged', () => body('A', 'party', 'spear'), () => body('T', 'enemy', 'shortsword', mailed), aimHead, 'dodge', 2);
  assert.ok(f.hit.aimHold > 0 && f.hit.aimHold < 1);
  const prone = () => body('T', 'enemy', 'shortsword', (c) => { mailed(c); c.status.prone = true; });
  const g = await scenario('aimed head thrust, prone', () => body('A', 'party', 'spear'), prone, aimHead, null, 2);
  assert.equal(g.f.hit.aimHold, 1);
  assert.ok(!g.f.defences.some((d) => d.kind === 'dodge'), 'no dodge from the ground');
});

test('a tired foe: a blunt blow whose wounds lower their stamina, collapsing them, is foreseen as a drop', async () => {
  const tired = () => { const t = body('T', 'enemy', null, (c) => { c.armor = Items.makeArmor('mail', 'half', 'average'); }); t.stamina = 9; return t; };
  const { f } = await scenario('mace vs tired mail', () => body('A', 'party', 'flangedMace'), tired, (a) => pick(a, (o) => o.motion === 'swing' && !o.unarmed), null);
  assert.ok(f.hit.drop > 0.1 && f.hit.drop < 0.9, `drop ${f.hit.drop}`);
});

test('a collapsed foe: no defence, every blow lands, and drop is the kill', () => {
  const a = body('A', 'party', 'longsword');
  const t = body('T', 'enemy', 'shortsword');
  t.stamina = 0; C.updateCondition(t);
  const f = Combat.foresee(a, t, pick(a, (o) => o.motion === 'thrust'), { distance: 1 });
  assert.equal(f.defences.length, 0);
  assert.equal(f.lands, 1);
  assert.equal(f.best, null);
  assert.ok(Math.abs(f.drop - f.kill) < 1e-9);
  assert.equal(f.down, true);
});

test('foresee leaves both fighters as it found them', () => {
  const a = body('A', 'party', 'longsword');
  const t = body('T', 'enemy', 'shortsword', mailed);
  a.stamina = 2; t.stamina = 5;
  const before = JSON.stringify([a, t]);
  for (const o of C.attackOptions(a)) Combat.foresee(a, t, o, { distance: 1 });
  assert.equal(JSON.stringify([a, t]), before);
});
