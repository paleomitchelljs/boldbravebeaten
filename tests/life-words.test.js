// Life's verbs (the user, 2026-11-01): Increase (heals), Decrease (withers) and Transfer (withers the target, heals the
// caster; aimed at an ally, gives the caster's own life), and the modifiers Launch (at range) and Burst (over an area),
// which go on one spell together. Jabiku knows Transfer alone (2026-11-07); tests of the others teach them.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./load.js');
const { World, Combat, Enemies, Magic, AI, Character: C } = B;

const noReact = async () => null;
// Dice: the caster's d10s come up 10, everyone else's 1 (every contest won, no backlash).
const io = (casterId) => ({ roller: async (req) => Array.from({ length: req.count }, () => (req.actorId === casterId ? 10 : 1)), react: noReact });

// Jabiku and the given foes (generated scalewards by default) on a 9 x 5 floor, Jabiku first to act.
async function table(foeAt, opts) {
  const w = World.create(World.presetParty(), { log: false });
  const party = World.active(w);
  const jab = party.find((c) => c.name === 'Jabiku');
  const ally = party.find((c) => c.name === 'Beren');
  const foes = foeAt.map(() => Enemies.makeMonster('scaleward', {})[0]);
  foes.forEach((f) => { f.side = 'enemy'; });
  const ids = [jab.id, ally.id].concat(foes.map((f) => f.id));
  const chars = Object.fromEntries([jab, ally].concat(foes).map((c) => [c.id, c]));
  const enc = Combat.createEncounter('t', ids, chars, 9, 5);
  enc.pos[jab.id] = { x: 4, y: 2 };
  enc.pos[ally.id] = (opts && opts.allyAt) || { x: 0, y: 0 };
  foeAt.forEach((p, i) => { enc.pos[foes[i].id] = p; });
  await Combat.startRound(enc, chars, async (req) => Array.from({ length: req.count }, () => (req.actorId === jab.id ? 10 : 1)));
  enc.order = ids; enc.turn = 0;
  return { enc, chars, jab, ally, foes };
}
const spell = (c, label) => Magic.spellOptions(c).find((o) => o.label === label);
const teach = (c) => Object.assign(c.feats, { verb_increase: 1, verb_decrease: 1 });
const cast = (enc, chars, jab, o, where) => Combat.act(enc, chars, Object.assign({ actor: jab.id, type: o.kind === 'strike' ? 'strike' : 'cast', option: o }, where), io(jab.id));

test('life words: Jabiku knows Transfer + Life alone, with Launch and Burst, and aimed at an ally to give', () => {
  const w = World.create(World.presetParty(), { log: false });
  const jab = World.active(w).find((c) => c.name === 'Jabiku');
  const labels = Magic.spellOptions(jab).map((o) => o.label);
  for (const m of ['', ' + Launch', ' + Burst', ' + Launch + Burst']) assert.ok(labels.includes(`Transfer + Life${m}`), `Transfer + Life${m}`);
  assert.ok(labels.includes('Transfer + Life (to an ally)') && labels.includes('Transfer + Life + Launch (to an ally)'));
  assert.ok(!labels.some((l) => /^(Increase|Decrease)/.test(l)), 'no other verb');
  assert.equal(jab.feats.casting, 2);
  teach(jab);
  const all = Magic.spellOptions(jab).map((o) => o.label);
  for (const v of ['Increase', 'Decrease']) for (const m of ['', ' + Launch', ' + Burst', ' + Launch + Burst']) assert.ok(all.includes(`${v} + Life${m}`), `${v} + Life${m}`);
  assert.equal(spell(jab, 'Decrease + Life + Burst').spell.shape, 'area');
  assert.deepEqual([spell(jab, 'Decrease + Life + Launch').minRange, spell(jab, 'Decrease + Life + Launch').maxRange], [2, 12]);
});

test('life words: Transfer withers the target and mends the caster by what it took', async () => {
  const { enc, chars, jab, foes } = await table([{ x: 5, y: 2 }]);
  jab.damage.CON = 1;
  const before = foes[0].damage.CON || 0;
  assert.equal(await cast(enc, chars, jab, spell(jab, 'Transfer + Life'), { target: foes[0].id }), null);
  assert.ok((foes[0].damage.CON || 0) > before, 'the target loses CON');
  assert.equal(jab.damage.CON || 0, 0, 'the caster\'s lost CON comes back');
  assert.ok(enc.log.some((l) => /draws in what was taken/.test(l.text)));
});

test('life words: Transfer at an ally gives the caster\'s own life: their CON mended, the caster\'s stamina paid', async () => {
  const { enc, chars, jab, ally } = await table([{ x: 0, y: 4 }], { allyAt: { x: 5, y: 2 } });
  ally.damage.CON = 1;
  ally.stamina = 0; ally.status.unconscious = true;
  const st = jab.stamina;
  assert.equal(await cast(enc, chars, jab, spell(jab, 'Transfer + Life (to an ally)'), { target: ally.id }), null);
  assert.equal(ally.damage.CON || 0, 0, 'the lost CON comes back');
  assert.ok(ally.stamina > 0 && !ally.status.unconscious, 'the rest is stamina, which wakes them');
  assert.equal(st - jab.stamina, 2 * B.CONFIG.magic.transfer.staminaPerCON, 'two points of life, paid in the caster\'s stamina');
});

test('life words: a given Transfer calls back an ally newly dead, and the AI reaches for it', async () => {
  const { enc, chars, jab, ally } = await table([{ x: 0, y: 4 }], { allyAt: { x: 5, y: 2 } });
  ally.status.dead = true; ally.status.diedRound = enc.round; ally.damage.CON = C.attr(ally, 'CON') + 2;
  const legal = Combat.legalActions(enc, chars, jab.id);
  const give = legal.spells.find((o) => o.label === 'Transfer + Life (to an ally)');
  assert.ok(give.targets.some((t) => t.id === ally.id && t.inReach), 'the body is a target');
  assert.ok(!give.targets.some((t) => t.id === jab.id), 'never the caster');
  const d = AI.choose(enc, chars, jab.id, () => 0.9);
  assert.equal(d.type, 'cast');
  assert.equal(d.option.spell.shape, 'give');
  assert.equal(await Combat.act(enc, chars, d, io(jab.id)), null);
  assert.ok(!ally.status.dead && ally.status.unconscious);
});

test('life words: Burst alone is round the caster, who is spared; with Launch it lands at range', async () => {
  const { enc, chars, jab, foes } = await table([{ x: 3, y: 2 }, { x: 5, y: 2 }]);
  teach(jab);
  const conJ = jab.damage.CON || 0;
  assert.equal(await cast(enc, chars, jab, spell(jab, 'Decrease + Life + Burst'), { at: { x: 4, y: 2 } }), null);
  assert.ok(foes.every((f) => (f.damage.CON || 0) > 0), 'both foes beside the caster wither');
  assert.equal(jab.damage.CON || 0, conJ, 'the caster is spared');
  const far = await table([{ x: 8, y: 2 }, { x: 8, y: 3 }]);
  teach(far.jab);
  assert.equal(await cast(far.enc, far.chars, far.jab, spell(far.jab, 'Decrease + Life + Launch + Burst'), { at: { x: 8, y: 2 } }), null);
  assert.ok(far.foes.every((f) => (f.damage.CON || 0) > 0), 'both foes four squares off wither');
});

test('life words: Increase + Life + Launch + Burst heals round a distant ally', async () => {
  const { enc, chars, jab, ally } = await table([], { allyAt: { x: 0, y: 2 } });
  teach(jab);
  ally.stamina = 5;
  assert.equal(await cast(enc, chars, jab, spell(jab, 'Increase + Life + Launch + Burst'), { target: ally.id }), null);
  assert.ok(ally.stamina > 5);
});

test('life words: the AI, hurt and beside a foe, drains it', async () => {
  const { enc, chars, jab, foes } = await table([{ x: 5, y: 2 }]);
  jab.damage.CON = 2;
  jab.stamina = Math.floor(C.maxStamina(jab) / 3);
  const d = AI.choose(enc, chars, jab.id, () => 0.9);
  assert.equal(d.type, 'cast');
  assert.match(d.option.label, /^Transfer \+ Life/);
  assert.ok(d.target === foes[0].id || d.at);
});
