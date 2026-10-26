// Effect keys (src/rules/effects.js): validate rejects a key no rule reads, and the registry lists every key the code reads.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const B = require('./load');
const { Effects, Enemies, Content, CONFIG, Character: C, Conditions } = B;

const srcFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? srcFiles(path.join(dir, d.name)) : d.name.endsWith('.js') ? [path.join(dir, d.name)] : []));
const code = srcFiles(path.join(__dirname, '..', 'src')).filter((f) => !f.endsWith('effects.js')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const found = (re) => new Set([...code.matchAll(re)].map((m) => m[1]));

test('effects: validate names a misspelt trait, weapon trait, gear effect and condition field', () => {
  const M = Enemies.MONSTERS.raptor, W = B.DATA.WEAPONS.sickleClaw, E = Object.values(B.DATA.ENCHANTMENTS)[0], K = CONFIG.conditions.rooted;
  const saved = [M.traits, W.trait, E.effects, K.flier];
  M.traits = Object.assign({}, M.traits, { flier: true });
  W.trait = { knockdwn: 1 };
  E.effects = Object.assign({}, E.effects, { regenn: 1 });
  K.flier = true;
  try {
    const p = Content.validate().join('\n');
    assert.match(p, /monsters\.raptor\.traits: "flier"/);
    assert.match(p, /weapons\.sickleClaw\.trait: "knockdwn"/);
    assert.match(p, /\.effects: "regenn"/);
    assert.match(p, /conditions\.rooted: "flier"/);
  } finally {
    [M.traits, W.trait, E.effects] = saved; delete K.flier;
    if (saved[1] === undefined) delete W.trait;
  }
  assert.deepEqual(Content.validate(), []);
});

test('effects: every trait and effect key the code reads is in the registry', () => {
  const traits = found(/traits(?:\s*&&\s*[\w.\[\]]+?\.traits)?\??\.(\w+)/g);
  for (const k of traits) assert.ok(k in Effects.KEYS.traits, `code reads traits.${k}; add it to Effects.KEYS.traits`);
  // Effects.sum/mult/has/list read every source, so the key must be a known one for some bag.
  const K = Effects.KEYS, any = (k) => k in K.traits || k in K.gearEffects || k in K.condition;
  const asked = found(/Effects\.(?:sum|mult|has|list)\([^,]+,\s*'(\w+)'/g);
  for (const k of asked) assert.ok(any(k), `code asks Effects for ${k}; add it to a bag in Effects.KEYS`);
  const strike = found(/weaponStrike\([^)]*\)\)?\.(\w+)/g);
  for (const k of strike) assert.ok(k in K.strike, `code reads strike.${k}`);
  assert.ok(traits.size > 5 && asked.size > 15, 'the scan found the readers');
});

test('conditions: a spirit shield guards only against the undead; frightened is read through fearOf', () => {
  const t = C.newCharacter({ name: 'T', starterGear: false });
  Conditions.add(t, 'spiritShield', { rounds: 3 });
  const living = C.newCharacter({ name: 'L', side: 'enemy', starterGear: false });
  const dead = Enemies.makeMonster(Object.keys(Enemies.MONSTERS).find((k) => (Enemies.MONSTERS[k].traits || {}).undead))[0];
  assert.equal(Conditions.mitigation(t, 'S', living), 0);
  assert.ok(Conditions.mitigation(t, 'S', dead) > 0);
  Conditions.add(t, 'frightened', { rounds: 2, src: 'x' });
  assert.equal(Conditions.fear(t).key, 'frightened');
});

test('lookup: one key adds up over traits, gear, conditions (per magnitude) and feats (per rank)', () => {
  const c = C.newCharacter({ name: 'D', starterGear: false });
  assert.equal(Effects.sum(c, 'dodge'), 0);
  c.feats.dodge_training = 2;
  assert.equal(Effects.sum(c, 'dodge'), 2, 'Dodge Training counts per rank');
  c.traits = { dodge: 1 };
  c.trinkets = [{ name: 'Ring', effects: { dodge: 1 } }];
  assert.equal(Effects.sum(c, 'dodge'), 4, 'feat + trait + ring');
  const ap = C.apPool(c);
  Conditions.add(c, 'slowed', { rounds: 2, mag: 2 });
  assert.equal(Effects.sum(c, 'ap'), 2 * CONFIG.conditions.slowed.ap, 'a condition counts per magnitude');
  assert.ok(C.apPool(c) < ap);
  assert.equal(Effects.has(c, 'noMove'), false);
  Conditions.add(c, 'rooted', { rounds: 2 });
  assert.equal(Effects.has(c, 'noMove'), true);
  assert.equal(Conditions.canMove(c), false);
});

test('lookup: a frost ward halves a fire bolt through the resist keyword; magic: 0 is immune to every spell', () => {
  const a = C.newCharacter({ name: 'A', side: 'enemy', starterGear: false });
  const t = C.newCharacter({ name: 'T', starterGear: false });
  const bolt = { kind: 'strike', motion: 'spell', spell: { element: 'fire', magnitude: 12 }, damage: [0, 0, 0] };
  const plain = B.Combat.computeHit(a, t, bolt, {}).fire;
  Conditions.add(t, 'frostWard', { rounds: 3 });
  assert.equal(C.damageMult(t, 'fire'), 0.5);
  assert.ok(B.Combat.computeHit(a, t, bolt, {}).fire < plain);
  t.traits = { resist: { magic: 0 } };
  assert.ok(B.Combat.computeHit(a, t, bolt, {}).magicImmune);
});

test('grapple: one link per fighter, written to both at once; an old save\'s five fields become it', () => {
  const a = C.newCharacter({ name: 'A', starterGear: false }), t = C.newCharacter({ name: 'T', side: 'enemy', starterGear: false });
  assert.equal(a.status.grapple, null);
  assert.ok(!('grappledBy' in a.status) && !('pinned' in a.status));
  const old = { status: { grappling: null, grappledBy: ['X'], clinch: null, pinned: true, grapplingPin: false } };
  C.normalize(old);
  assert.deepEqual(old.status.grapple, { partner: 'X', level: 'pin', role: 'held' });
  assert.ok(!('grappledBy' in old.status));
  assert.ok(C.isPinned(old) && C.isHeld(old) && !C.holding(old));
});
