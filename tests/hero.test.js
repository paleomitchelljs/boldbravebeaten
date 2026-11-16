// Hero mode (the menu's checkbox; rules.yaml hero): the party hits harder, takes less, recovers faster and cannot die.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Battle, Auto, Rand, Combat, Character: C, CONFIG } = B;

test('hero mode: wounds take a hero down, never dead; off again, a wound on the down kills', () => {
  const w = World.create(World.presetParty(), { log: false });
  w.hero = true;
  World.syncHero(w);
  const c = World.party(w)[0];
  const cut = { place: 'torso', sev: 3, kind: 'cut', bleed: 3, pts: 7 };
  for (let i = 0; i < 4; i++) C.addWound(c, Object.assign({}, cut), null);
  assert.equal(c.status.dead, false);
  assert.equal(C.isDown(c), true);
  // Off again: the next wound on the down kills.
  w.hero = false;
  World.syncHero(w);
  C.addWound(c, Object.assign({}, cut), null);
  assert.equal(c.status.dead, true);
});

test('hero mode: blows by a hero land harder, blows on a hero softer, and a hero recovers more', () => {
  const w = World.create(World.presetParty(), { log: false });
  const [a, b] = World.party(w);
  const opt = { damage: [0, 30, 0] };
  const base = Combat.computeHit(a, b, opt, { location: 'torso' });
  const sum = (h) => h.pts + h.blunt + h.converted;
  const r0 = C.regen(a);
  a.hero = true;
  const harder = Combat.computeHit(a, b, opt, { location: 'torso' });
  assert.ok(sum(harder) > sum(base), `hero blow ${sum(harder)} vs ${sum(base)}`);
  assert.equal(C.regen(a), r0 + CONFIG.hero.regen);
  a.hero = false; b.hero = true;
  const softer = Combat.computeHit(a, b, opt, { location: 'torso' });
  assert.ok(sum(softer) < sum(base), `blow on a hero ${sum(softer)} vs ${sum(base)}`);
});

test('hero mode: a lost fight leaves no one dead', async () => {
  let lost = 0;
  for (const seed of [1, 2, 3]) {
    Rand.seed(seed);
    const w = World.create(World.presetParty(), { log: false });
    w.hero = true;
    Battle.start(w, { name: 'Too much', foes: [{ monster: 'hillGiant' }, { monster: 'hillGiant' }, { monster: 'ogre' }] });
    await Auto.battle(w);
    if (Battle.finish(w).result === 'lost') lost++;
    assert.ok(World.party(w).every((c) => !c.status.dead), `seed ${seed}`);
  }
  assert.ok(lost, 'two hill giants and an ogre beat a hero party at least once');
});
