// The battle panel's odds (docs/PLAN.md step 7): Combat.foresee lays out the dice of one blow from what the attacker
// can see. Each number it gives is checked here against many seeded resolutions of the same blow through the engine
// (resolveAction: the contest and its margin, the location, a gap found, the vital wound, the wound's severity and
// the shock check: docs/OVERHAUL.md step E).
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
  const s = { lands: 0, drop: 0, down: 0, kill: 0, vital: 0, sev1: 0, sev2: 0, sev3: 0, stamina: 0, turned: 0, n };
  for (let i = 0; i < n; i++) {
    // A friend of the target's stands far off, so the fight goes on (a body left bleeding when a fight ends may die:
    // Combat.settleFallen; that is not the blow's doing).
    const a = mkA(), t = mkT(), u = body('U', 'enemy', null);
    const chars = { [a.id]: a, [t.id]: t, U: u };
    const enc = Combat.createEncounter('t', [a.id, t.id, 'U'], chars, 12, 3);
    enc.pos[a.id] = { x: 1, y: 1 }; enc.pos[t.id] = { x: 1 + dist, y: 1 }; enc.pos.U = { x: 11, y: 2 };
    enc.round = 1; enc.ap[a.id] = 999; enc.ap[t.id] = 999;
    const o = optFn(a);
    const st0 = t.stamina, w0 = C.wounds(t).length, up0 = C.isActive(t), down0 = C.isDown(t);
    await Combat.resolveAction(enc, chars, { actor: a.id, target: t.id, type: 'strike', option: o, ap: o.ap, stamina: o.stamina, targetWasDown: !C.isActive(t) }, io);
    const text = enc.log.map((l) => l.text || l).join('\n');
    if (/ hits T/.test(text)) s.lands++;
    if (/VITAL/.test(text)) s.vital++;
    if (/turns the point/.test(text)) s.turned++;
    if (up0 && !C.isActive(t)) s.drop++;
    if (!down0 && (C.isDown(t) || t.status.dead)) s.down++;
    if (t.status.dead) s.kill++;
    const worst = C.wounds(t).slice(w0).reduce((m, w) => Math.max(m, w.sev), 0);
    if (worst) s['sev' + worst]++;
    s.stamina += st0 - t.stamina;
  }
  for (const k of ['lands', 'drop', 'down', 'kill', 'vital', 'sev1', 'sev2', 'sev3', 'stamina', 'turned']) s[k] /= n;
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
    down: d ? d.downP : f.hit.down,
    kill: d ? d.kill : f.hit.kill,
    vital: w * harm.vital + (thr ? d.odds * thr.vital : 0),
  };
  // The chance of each severity (of the worst wound the blow leaves).
  for (const i of [1, 2, 3]) exp['sev' + i] = w * harm.sev[i] + (thr ? d.odds * thr.sev[i] : 0);
  const keys = ['lands', 'drop', 'down', 'kill', 'vital', 'sev1', 'sev2', 'sev3'];
  if (process.env.ODDS_DEBUG) console.log(name, keys.map((k) => `${k} ${s[k].toFixed(3)}/${exp[k].toFixed(3)}`).join('  '));
  for (const k of keys) assert.ok(Math.abs(s[k] - exp[k]) <= 0.035, `${name}: ${k} ${s[k].toFixed(3)} rolled, ${exp[k].toFixed(3)} foreseen`);
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
  const d = f.defences.find((x) => x.kind === 'dodge');
  assert.ok(d.margins.every((x) => x.m >= 1), 'a blow that beats a dodge does so by 1 or more');
  const prone = () => body('T', 'enemy', 'shortsword', (c) => { mailed(c); c.status.prone = true; });
  const g = await scenario('aimed head thrust, prone', () => body('A', 'party', 'spear'), prone, aimHead, null, 2);
  assert.ok(!g.f.defences.some((x) => x.kind === 'dodge'), 'no dodge from the ground');
  const mean = (ms) => ms.reduce((n, x) => n + x.m * x.p, 0);
  assert.ok(mean(g.f.hit.margins) > mean(Combat.foresee(body('A', 'party', 'spear'), body('T', 'enemy', 'shortsword', mailed), aimHead(body('A', 'party', 'spear')), { distance: 2 }).hit.margins), 'the prone are easier to beat by much');
});

test('a thrust at plate: how often the point gets through, as the margins fall', async () => {
  const plated = (c) => { c.armor = Items.makeArmor('plate', 'full', 'average'); };
  const thrust = (a) => pick(a, (o) => o.motion === 'thrust');
  const { f, s } = await scenario('spear vs plate, taken', () => body('A', 'party', 'spear'), () => body('T', 'enemy', 'shortsword', plated), thrust, null, 2);
  assert.ok(f.hit.turned > 0 && f.hit.through > 0, 'some get through, some are turned');
  assert.ok(Math.abs(s.turned - f.hit.turned) <= 0.035, `turned ${s.turned} rolled, ${f.hit.turned} foreseen`);
});

test('a tired foe: a blunt blow that winds the last of their stamina out of them, collapsing them, is foreseen as a drop', async () => {
  const tired = () => { const t = body('T', 'enemy', null, (c) => { c.armor = Items.makeArmor('mail', 'half', 'average'); }); t.stamina = 7; return t; };
  const swing = (a) => pick(a, (o) => o.motion === 'swing' && !o.unarmed);
  const { f } = await scenario('mace vs tired mail', () => body('A', 'party', 'flangedMace'), tired, swing, null);
  // Winding is fixed by the blunt's severity (wounds.winding): a mace's on mail is the same every time.
  assert.ok(f.hit.collapse > 0.8 && f.hit.stamina > 0, `collapse ${f.hit.collapse}`);
  const fresher = () => { const t = tired(); t.stamina = f.hit.stamina + 1; return t; };
  const g = await scenario('mace vs fresher mail', () => body('A', 'party', 'flangedMace'), fresher, swing, null);
  assert.ok(g.f.hit.collapse < 0.05, `collapse ${g.f.hit.collapse}`);
});

test('a collapsed foe: no defence, every blow lands, its armor still on; a wound may put them down, never kill', async () => {
  const mk = () => { const t = body('T', 'enemy', 'shortsword', mailed); t.stamina = 0; C.updateCondition(t); return t; };
  const thrust = (a) => pick(a, (o) => o.motion === 'thrust');
  const { f } = await scenario('thrust at the collapsed', () => body('A', 'party', 'longsword'), mk, thrust, null);
  assert.equal(f.defences.length, 0);
  assert.equal(f.lands, 1);
  assert.equal(f.best, null);
  assert.equal(f.kill, 0);
  assert.equal(f.down, true);
  assert.ok(f.hit.down > 0, 'down');
});

test('a foe down from wounds: any wound kills (a finishing blow); in hero mode, never', async () => {
  const mk = () => { const t = body('T', 'enemy', 'shortsword', mailed); for (let i = 0; i < C.boxes(t); i++) C.addWound(t, { place: 'torso', sev: 1, kind: 'cut', bleed: 0, pts: 1 }, null); return t; };
  const thrust = (a) => pick(a, (o) => o.motion === 'thrust');
  const { f } = await scenario('thrust at the down', () => body('A', 'party', 'longsword'), mk, thrust, null);
  assert.ok(Math.abs(f.kill - (1 - f.hit.sev[0])) < 1e-9, 'kill is the chance of a wound');
  const h = mk(); h.hero = true;
  assert.equal(Combat.foresee(body('A', 'party', 'longsword'), h, thrust(body('A', 'party', 'longsword')), { distance: 1 }).kill, 0);
});

test('foresee leaves both fighters as it found them', () => {
  const a = body('A', 'party', 'longsword');
  const t = body('T', 'enemy', 'shortsword', mailed);
  a.stamina = 2; t.stamina = 5;
  const before = JSON.stringify([a, t]);
  for (const o of C.attackOptions(a)) Combat.foresee(a, t, o, { distance: 1 });
  assert.equal(JSON.stringify([a, t]), before);
});
