// Damage keywords (C.damageMult): one resist map for blows (P, S, B) and magic elements; the golems and the Avatar.
const test = require('node:test');
const assert = require('node:assert');
const B = require('./load');
const { Character: C, Combat, Items, Enemies, Magic, Conditions } = B;

function roller(queue, fill) {
  const q = (queue || []).slice();
  return async (req) => Array.from({ length: req.count }, () => (q.length ? q.shift() : fill || 5));
}
const noReact = () => null;
function fighter(name, side) {
  const c = C.newCharacter({ name, side: side || 'party', starterGear: false });
  c.stamina = C.maxStamina(c);
  return c;
}
const golem = (id) => Enemies.makeMonster(id)[0];
const blow = (v) => ({ kind: 'strike', motion: 'swing', damage: v, label: 'test' });
const fire = (m) => ({ kind: 'strike', motion: 'spell', spell: { element: 'fire', magnitude: m }, damage: [0, 0, 0] });
const harm = (h) => h.toCON + h.bluntToStamina + h.slashToAttrs + (h.bluntToCON || 0) + (h.pierceVital || 0) + (h.cutVital || 0);

test('keywords: damageMult multiplies a monster trait and worn gear for one keyword; unknown keywords are 1', () => {
  const c = fighter('C');
  c.traits = { resist: { fire: 0.5, S: 0 } };
  assert.equal(C.damageMult(c, 'fire'), 0.5);
  assert.equal(C.damageMult(c, 'S'), 0);
  assert.equal(C.damageMult(c, 'frost'), 1);
  assert.equal(C.damageMult(c, null), 1);
});

test('golems: one body; each immune to two of fire, slashing and blunt and weak to the third; reach-2 fists', () => {
  const [clay, stone, iron] = ['clayGolem', 'stoneGolem', 'ironGolem'].map(golem);
  for (const k of ['STR', 'CON', 'DEX', 'SPD']) assert.ok(clay.base[k] === stone.base[k] && stone.base[k] === iron.base[k], k);
  assert.ok(C.attackOptions(clay).some((o) => o.maxRange >= 2), 'the fists reach 2');
  const a = fighter('A', 'enemy');
  const S = blow([0, 30, 0]), Bl = blow([0, 0, 30]);
  assert.equal(harm(Combat.computeHit(a, stone, S, { location: 'torso' })), 0, 'stone shrugs off a cut');
  assert.equal(harm(Combat.computeHit(a, iron, S, { location: 'torso' })), 0, 'and iron');
  assert.ok(harm(Combat.computeHit(a, clay, S, { location: 'torso' })) > 0, 'clay is cut');
  assert.equal(harm(Combat.computeHit(a, clay, Bl, { location: 'torso' })), 0, 'clay shrugs off a hammer');
  assert.equal(harm(Combat.computeHit(a, iron, Bl, { location: 'torso' })), 0, 'and iron');
  assert.ok(harm(Combat.computeHit(a, stone, Bl, { location: 'torso' })) > 0, 'stone cracks');
  assert.ok(Combat.computeHit(a, clay, fire(10), {}).magicImmune, 'fire washes off clay');
  assert.ok(Combat.computeHit(a, stone, fire(10), {}).magicImmune, 'and stone');
  const plain = golem('ironGolem'); plain.traits = Object.assign({}, plain.traits, { resist: {} });
  assert.ok(Combat.computeHit(a, iron, fire(10), {}).fire > Combat.computeHit(a, plain, fire(10), {}).fire, 'iron burns the more');
});

test('golems: mind and life magic do nothing; a fire-immune one does not catch fire', async () => {
  const caster = fighter('M', 'party');
  const g = golem('ironGolem'), c = golem('clayGolem');
  const chars = { [caster.id]: caster, [g.id]: g };
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, 8, 5);
  assert.equal(await Magic.afflict(enc, caster, g, 'frightened', { rounds: 3 }, roller([10, 1])), false);
  assert.equal(Conditions.has(g, 'frightened'), false);
  const life = { kind: 'strike', motion: 'spell', spell: { element: 'life', magnitude: 10 }, damage: [0, 0, 0] };
  assert.ok(Combat.computeHit(caster, g, life, {}).magicImmune);
  assert.equal(Conditions.add(c, 'burning', { rounds: 2 }), null, 'clay does not burn');
  assert.ok(Conditions.add(g, 'burning', { rounds: 2 }), 'iron does');
});

test('avatar of fear: reach-2 claws whose landed blows sap stamina into it', async () => {
  const av = Enemies.makeMonster('avatarOfFear')[0];
  const t = fighter('T', 'party');
  const claws = C.attackOptions(av).find((o) => o.sap);
  assert.ok(claws && claws.maxRange >= 2, 'reach 2, and it saps');
  const chars = { [av.id]: av, [t.id]: t };
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, 8, 5);
  enc.pos[av.id] = { x: 1, y: 2 }; enc.pos[t.id] = { x: 3, y: 2 };
  await Combat.startRound(enc, chars, roller([10, 1]));
  av.stamina -= 20;
  const before = av.stamina;
  await Combat.act(enc, chars, { actor: av.id, type: 'strike', option: claws, target: t.id }, { roller: roller([], 3), react: noReact });
  assert.ok(enc.log.some((l) => /saps/.test(l.text)), enc.log.map((l) => l.text).join('\n'));
  assert.ok(av.stamina > before - claws.stamina, 'stamina drunk back');
});
