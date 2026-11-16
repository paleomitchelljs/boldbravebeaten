// Traps as terrain (docs/OVERHAUL.md step C): found by degrees, passed in several ways, sprung as a blow through the
// combat engine on whoever is on the square by marching order, and carried into a fight as hidden terrain.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const Clock = require('./clock');
const { World, Explore, Skills, Traps, Terrain, Combat, Character: C, Enemies, Items, AI, Battle, Rand, Content } = B;

const fresh = (seed) => { Rand.seed(seed || 1); return World.create(World.presetParty(), { log: false }); };
const legend = (place, ch) => Content.world.places[place].legend[ch];
const sapling = () => legend('temple_court', 'S');
const roller = async (req) => Array.from({ length: req.count }, () => Rand.d(req.sides));
const byName = (w, n) => World.party(w).find((c) => c.name === n);

// Fixes every skill check's margin (and fumble) while fn runs.
function rigged(margin, fn, fumble) {
  const g = Skills.groupCheck, c = Skills.check;
  const fake = (who) => (chars, id, tn) => ({ who: who ? (chars.id || chars[0].id) : null, name: who ? chars.name : 'The party', skill: id, roll: fumble ? 1 : 5, mod: 0, bonus: 0, total: 8 + margin, tn: 8, ok: margin >= 0, margin, fumble: !!fumble, crit: false });
  Skills.groupCheck = fake(false);
  Skills.check = (who, id, tn) => Object.assign(fake(true)(who, id, tn), { who: who.id, name: who.name });
  try { return fn(); } finally { Skills.groupCheck = g; Skills.check = c; }
}

// The temple court's gate, the party two squares short of the sapling trap at (4, 15), facing east.
function atGate(seed) {
  const w = fresh(seed);
  Explore.enter(w, 'temple_court', '<');
  w.explore.x = 2; w.explore.y = 15; w.explore.dir = 1;
  w.peaceful = false;
  return w;
}

test('traps: finding by degrees: nothing, the tell, the square, the square and its working', () => {
  const want = [[-6, {}], [-2, { wary: true }], [1, { wary: true, found: true }], [4, { wary: true, found: true, known: true }]];
  for (const [margin, got] of want) {
    const w = atGate(3);
    w.explore.x = 3; // beside it: the passive look
    rigged(margin, () => Explore.turn(w, 0));
    const st = Explore.state(w, 4, 15);
    for (const k of ['wary', 'found', 'known']) assert.equal(!!st[k], !!got[k], `margin ${margin}: ${k}`);
    assert.equal(Explore.cell(w, 4, 15).solid, !!got.found, 'a found trap stands in the way; a tell does not');
  }
});

test('traps: the tell gives text but no square; knowing (reveal) gives the working without a roll', () => {
  const w = atGate(4);
  w.explore.x = 3;
  const ev = rigged(-2, () => Explore.turn(w, 0)).events;
  assert.ok(ev.some((e) => /Something is off here: a sapling/.test(e.text)));
  // Knowledge beats skill: a trap whose reveal holds is made out whatever the roll.
  const def = sapling();
  def.reveal = { flag: 'knows_snares' };
  try {
    const w2 = atGate(5);
    World.setFlag(w2, 'knows_snares');
    w2.explore.x = 3;
    const ev2 = rigged(-20, () => Explore.turn(w2, 0)).events;
    assert.ok(Explore.state(w2, 4, 15).known);
    assert.ok(ev2.some((e) => /You know this one/.test(e.text)));
  } finally { delete def.reveal; }
});

test('traps: the facing prompt offers the ways past, by what is known and carried', () => {
  const w = atGate(6);
  w.explore.x = 3;
  rigged(1, () => Explore.turn(w, 0));
  let ids = Explore.facing(w).actions.map((a) => a.id);
  assert.ok(ids.includes('disarm') && ids.includes('leap') && ids.includes('mark'));
  assert.ok(!ids.includes('stone') && !ids.includes('pole'), 'the working unknown: no stone; no pole carried');
  World.addGood(w, 'pole', 1);
  Explore.state(w, 4, 15).known = true;
  ids = Explore.facing(w).actions.map((a) => a.id);
  assert.ok(ids.includes('pole') && ids.includes('stone') && ids.includes('shield'), ids.join());
});

function facingFound(seed) {
  const w = atGate(seed);
  w.explore.x = 3;
  Object.assign(Explore.state(w, 4, 15), { wary: true, found: true, known: true, passive: true, passiveNear: true });
  return w;
}

test('traps: disarm: success makes it safe; a fumble springs it on the one disarming, who knew it was coming', async () => {
  let w = facingFound(7);
  let r = rigged(2, () => Explore.act(w, 'disarm'));
  assert.ok(Explore.state(w, 4, 15).disarmed);
  assert.ok(!r.pending);
  assert.ok(!Explore.cell(w, 4, 15).solid);
  w = facingFound(8);
  const t0 = w.minutes;
  r = rigged(-3, () => Explore.act(w, 'disarm'), true);
  assert.ok(w.minutes - t0 >= 10, 'time passes');
  assert.ok(Explore.state(w, 4, 15).sprung);
  const more = await r.pending;
  const who = Skills.best(World.active(w), 'trapcraft');
  assert.ok(more.some((e) => e.text.includes(who.name)), 'it is the disarmer it catches: ' + JSON.stringify(more));
});

test('traps: leap and edge: the party ends past it; the first to fall short in marching order sets it off', async () => {
  let w = facingFound(9);
  let r = rigged(1, () => Explore.act(w, 'leap'));
  assert.deepEqual([w.explore.x, w.explore.y], [5, 15]);
  assert.ok(!Explore.state(w, 4, 15).sprung && !r.pending);
  w = facingFound(10);
  sapling().bypass = ['edge'];
  try { r = rigged(-1, () => Explore.act(w, 'edge')); } finally { delete sapling().bypass; }
  assert.deepEqual([w.explore.x, w.explore.y], [5, 15]);
  assert.ok(Explore.state(w, 4, 15).sprung);
  const lead = World.active(w)[0];
  const more = await r.pending;
  assert.ok(r.events.some((e) => e.text === `${lead.name} puts a foot wrong.`));
  assert.ok(more.some((e) => e.text.includes(lead.name)));
});

test('traps: spring it from a distance (a pole, a stone: loud, nobody hurt), under a shield, or mark it', async () => {
  let w = facingFound(11);
  World.addGood(w, 'pole', 1);
  const d0 = w.explore.danger || 0;
  let r = Explore.act(w, 'pole');
  assert.ok(Explore.state(w, 4, 15).sprung);
  assert.deepEqual(await r.pending, [], 'nobody stands on it');
  assert.ok((w.explore.danger || 0) > d0, 'loud: it counts toward wanderers');
  w = facingFound(12);
  r = Explore.act(w, 'stone');
  assert.ok(Explore.state(w, 4, 15).sprung, 'a wire is set off by a thrown stone');
  w = facingFound(13);
  r = Explore.act(w, 'shield');
  const bearer = World.active(w).find((c) => C.shieldReady(c));
  const more = await r.pending;
  assert.ok(more.some((e) => e.text.includes(bearer.name)), JSON.stringify(more));
  w = facingFound(14);
  Explore.act(w, 'mark');
  assert.ok(Explore.state(w, 4, 15).marked && !Explore.state(w, 4, 15).sprung);
  assert.ok(!Explore.facing(w).actions.some((a) => a.id === 'mark'));
});

test('traps: walked onto unseen, it strikes the first in marching order', async () => {
  const w = atGate(15);
  // Put Cyrus in front.
  const cy = byName(w, 'Cyrus');
  w.partyIds = [cy.id].concat(w.partyIds.filter((id) => id !== cy.id));
  Object.assign(Explore.state(w, 4, 15), { passive: true, passiveNear: true });
  w.explore.x = 3;
  const r = Explore.move(w, 0);
  assert.ok(r.events.some((e) => e.type === 'trap'));
  const more = await r.pending;
  assert.ok(more.some((e) => /A sharpened sapling hits Cyrus/.test(e.text)), JSON.stringify(more));
  // `who: next` takes the one behind instead; a radius takes everyone.
  const party = World.active(w);
  assert.equal(Traps.victims({ effect: { who: 'next' } }, party)[0], party[1]);
  assert.equal(Traps.victims({ effect: { radius: 1 } }, party).length, party.length);
});

test('traps: a sprung trap is a blow through the combat engine: plate turns what padding does not', async () => {
  const N = 150;
  const harm = async (name) => {
    let t = 0;
    for (let i = 0; i < N; i++) {
      const w = World.create(World.presetParty(), { log: false });
      const v = byName(w, name), chars = { [v.id]: v };
      const enc = Combat.createEncounter('t', [v.id], chars, 5, 5);
      await Traps.strike(enc, chars, v, sapling(), roller, {});
      t += C.woundLoad(v) + C.bleeding(v);
    }
    return t / N;
  };
  Rand.seed(4242);
  const beren = await harm('Beren'), cyrus = await harm('Cyrus');
  assert.ok(beren < 0.2, `Beren in plate: ${beren}`);
  assert.ok(cyrus > 1.5, `Cyrus in a gambeson: ${cyrus}`);
});

// A fight on a bare floor with a trap at (3, 2), seen by `knownBy`.
function field(foeExtra, knownBy) {
  const w = fresh(20);
  const hero = byName(w, 'Cyrus');
  const gob = Enemies.makeMonster('fireGoblin')[0];
  gob.side = 'enemy'; gob.control = 'auto';
  Object.assign(gob, foeExtra || {});
  const chars = { [hero.id]: hero, [gob.id]: gob };
  const enc = Combat.createEncounter('t', [hero.id, gob.id], chars, 7, 5);
  const f = Terrain.add(enc, 3, 2, 'trap');
  f.def = sapling(); f.knownBy = knownBy || []; f.key = 'test';
  return { w, enc, chars, hero, gob, f };
}

test('traps in a fight: a group that knows its trap walks it safely and paths round it; driven onto it, it springs', async () => {
  const { enc, chars, gob, f } = field({}, ['enemy']);
  assert.ok(!Traps.knows(f.def, gob), 'a Suracayl snare: not a goblin\'s');
  const lizard = Enemies.makeMonster('scaleward')[0];
  lizard.side = 'enemy';
  chars[lizard.id] = lizard; enc.ids.push(lizard.id); enc.pos[lizard.id] = { x: 2, y: 2 };
  assert.ok(Traps.knows(f.def, lizard));
  assert.equal(await Terrain.enter(enc, chars, lizard, 3, 2, roller, () => {}), false);
  assert.ok(!f.sprung, 'its own walk it safely');
  const steps = Terrain.path(enc, { x: 2, y: 2 }, { x: 4, y: 2 }, lizard);
  assert.ok(!steps.some((q) => q.x === 3 && q.y === 2), 'and go round it when they can: ' + JSON.stringify(steps));
  await Terrain.enter(enc, chars, lizard, 3, 2, roller, () => {}, 'driven');
  assert.ok(f.sprung, 'driven onto it, it springs on anyone');
});

test('traps in a fight: a foe shoved onto a trap the party has found springs it; the AI shoves onto a trap it knows', async () => {
  const { enc, chars, hero, gob, f } = field({}, ['party']);
  enc.pos[hero.id] = { x: 1, y: 2 }; enc.pos[gob.id] = { x: 2, y: 2 };
  assert.ok(Terrain.visible(f, 'party') && !Terrain.visible(f, 'enemy'));
  // The goblin can't see it and walks the straight way over it.
  const steps = Terrain.path(enc, { x: 2, y: 2 }, { x: 4, y: 2 }, gob);
  assert.ok(steps.some((q) => q.x === 3 && q.y === 2));
  await B.Magic.push(enc, chars, gob, enc.pos[hero.id], 1, roller, false);
  assert.ok(f.sprung, 'shoved onto it');
  assert.ok(enc.log.some((l) => /driven onto/.test(l.text)), enc.log.map((l) => l.text).join('\n'));
  // The AI: a goblin who knows a live trap behind the hero shoves the hero onto it.
  const g = field({ base: Object.assign({}, Enemies.makeMonster('fireGoblin')[0].base, { STR: 9 }) }, ['enemy']);
  g.enc.pos[g.gob.id] = { x: 1, y: 2 }; g.enc.pos[g.hero.id] = { x: 2, y: 2 };
  g.hero.skills.athletics = 0;
  await Clock.start(g.enc, g.chars, async (req) => Array.from({ length: req.count }, () => (req.label || '').includes(g.gob.name) ? 10 : 1));
  const d = AI.choose(g.enc, g.chars, g.gob.id, () => 0.99);
  assert.equal(d.type, 'shove', JSON.stringify(d));
  g.f.knownBy = [];
  assert.notEqual(AI.choose(g.enc, g.chars, g.gob.id, () => 0.99).type, 'shove', 'without the trap it strikes');
});

test('traps in a fight: a fight on the map lays its live traps as hidden terrain, and writes back what sprang', () => {
  const w = fresh(30);
  Explore.enter(w, 'temple_court', '<');
  w.explore.x = 3; w.explore.y = 15;
  const def = legend('temple_court', 'g');
  Battle.start(w, Object.assign({ name: 'Gate' }, Explore.encounterSpec(w, def)), { ctx: { x: 6, y: 15 } });
  const enc = w.battle.enc, A = w.battle.arena;
  const f = Terrain.at(enc, 4 - A.ox, 15 - A.oy).find((x) => x.kind === 'trap');
  assert.ok(f, 'the sapling trap is in the fight');
  assert.ok(f.hidden && f.knownBy.includes('enemy') && !f.knownBy.includes('party'), JSON.stringify(f.knownBy));
  f.sprung = true;
  Battle.finish(w, 'fled');
  assert.ok(Explore.state(w, 4, 15).sprung && Explore.state(w, 4, 15).found);
});
