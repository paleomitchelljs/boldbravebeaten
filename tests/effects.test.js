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

test('effects: every trait, gear effect and condition flag the code reads is in the registry', () => {
  const traits = found(/traits(?:\s*&&\s*[\w.\[\]]+?\.traits)?\??\.(\w+)/g);
  for (const k of traits) assert.ok(k in Effects.KEYS.traits, `code reads traits.${k}; add it to Effects.KEYS.traits`);
  const gear = found(/gear(?:Sum|Mult|List)\([^,]+,\s*'(\w+)'/g);
  for (const k of gear) assert.ok(k in Effects.KEYS.gearEffects, `code reads gear effect ${k}`);
  const flags = found(/Conditions\.flag\([^,]+,\s*'(\w+)'/g);
  for (const k of flags) assert.ok(k in Effects.KEYS.condition, `code reads condition flag ${k}`);
  assert.ok(traits.size > 10 && gear.size > 5 && flags.size > 5, 'the scan found the readers');
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
