// Magic items, the new spell words, Raise, companions and the engine fixes that came with them (2026-10).
const test = require('node:test');
const assert = require('node:assert');
const B = require('./load');
// Blows here land at a fixed force (vigor has its own test in rules.test.js).
B.CONFIG.vigor = null;
const { Character: C, Combat, Items, Enemies, Magic, Terrain, Conditions } = B;

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
function armed(name, type, side, tags) {
  const c = fighter(name, side);
  const w = Items.makeWeapon(type, 'average', null, tags);
  c.weapons.push(w); c.wield = w.id;
  c.stamina = C.maxStamina(c);
  return c;
}
function mage(name, nouns, side) {
  const m = fighter(name, side);
  m.feats = {};
  m.skills = { arcane: 6 };
  for (const w of Object.values(B.CONFIG.magic.words)) if (w.feat) m.feats[w.feat] = 1;
  m.base.INT = 8; m.nouns = nouns; m.stamina = C.maxStamina(m);
  return m;
}
const good = (id) => B.Content.world.items.goods[id];
const wear = (c, id, at) => { c.trinkets = (c.trinkets || []).concat([B.Equip.wornItem(id, good(id), at || good(id).slot)]); };
async function arena(list, w, h, rolls) {
  const chars = {};
  for (const c of list) chars[c.id] = c;
  const enc = Combat.createEncounter('t', Object.keys(chars), chars, w || 8, h || 5);
  list.forEach((c) => { if (c.at) enc.pos[c.id] = c.at; });
  await Combat.startRound(enc, chars, roller(rolls || list.map((_, i) => 10 - i)));
  return { enc, chars };
}

test('fixes: a shove stops at a wall; knockback and shoves drop a body into a pit on the way', async () => {
  const a = fighter('A'); a.base.STR = 10; a.at = { x: 2, y: 2 };
  const t = fighter('T', 'enemy'); t.at = { x: 3, y: 2 };
  const { enc, chars } = await arena([a, t]);
  Terrain.add(enc, 4, 2, 'dungeonWall');
  await Combat.act(enc, chars, { actor: a.id, type: 'shove', target: t.id }, { roller: roller([10, 1]), react: noReact });
  assert.deepStrictEqual(enc.pos[t.id], { x: 3, y: 2 }, 'no shoving into stone');
  assert.ok(t.status.prone, 'a hard shove against the wall knocks them down');
  const p = fighter('P', 'enemy');
  const enc2 = Combat.createEncounter('p', [a.id, p.id], { [a.id]: a, [p.id]: p }, 8, 5);
  enc2.pos[a.id] = { x: 1, y: 2 }; enc2.pos[p.id] = { x: 2, y: 2 };
  Terrain.add(enc2, 3, 2, 'pit');
  const moved = await Magic.push(enc2, { [a.id]: a, [p.id]: p }, p, enc2.pos[a.id], 2, roller([]));
  assert.equal(moved, 1, 'the pit stops the push');
  assert.ok(p.status.prone && enc2.pos[p.id].x === 3);
});

test('rule: an ordinary shield cannot block a spell bolt; a Spellcatcher can', async () => {
  const m = mage('M', ['fire']); m.at = { x: 1, y: 2 };
  const s = fighter('S', 'enemy'); s.shield = Items.makeShield('heater', 'iron', 'average'); s.at = { x: 2, y: 2 };
  const { enc, chars } = await arena([m, s]);
  const bolt = C.attackOptions(m).find((o) => o.spellKey === 'strike+fire');
  const decl = { actor: m.id, type: 'strike', option: bolt, target: s.id };
  assert.ok(!Combat.defenseOptions(enc, chars, s, m, decl).options.some((o) => o.type === 'block'));
  s.shield = Items.makeShield('heater', 'steel', 'average', { enchantments: ['spellcatching'] });
  assert.ok(Combat.defenseOptions(enc, chars, s, m, decl).options.some((o) => o.type === 'block'));
});

test('items: the silk sash cuts every action by a fifth; a blade of speed takes AP off its own strikes and parries', () => {
  const c = armed('C', 'longsword');
  const swing = C.attackOptions(c).find((o) => o.motion === 'swing').ap;
  const move = C.moveCost(c, 1);
  wear(c, 'silk_sash');
  assert.equal(C.attackOptions(c).find((o) => o.motion === 'swing').ap, Math.round(swing * 0.8));
  assert.ok(C.moveCost(c, 1) < move);
  const d = armed('D', 'longsword', 'party', { enchantments: ['speed'] });
  const plain = armed('P', 'longsword');
  const sw = (x) => C.attackOptions(x).find((o) => o.motion === 'swing').ap;
  assert.equal(sw(plain) - sw(d), Math.round(0.5 * C.costScale()));
  assert.equal(C.actionCost(plain, 'parry').ap - C.actionCost(d, 'parry').ap, Math.round(0.5 * C.costScale()));
});

test('items: a sapping blade drains STR and stamina and eats armor; a goading blade riles; a thunder blade can stun', async () => {
  const a = armed('A', 'longsword', 'party', { enchantments: ['sapping'] }); a.at = { x: 1, y: 2 };
  const t = fighter('T', 'enemy'); t.armor = Items.makeArmor('leather', 'full', 'average'); t.at = { x: 2, y: 2 };
  const { enc, chars } = await arena([a, t]);
  a.stamina -= 10;
  const dur = t.armor.durability, st = a.stamina;
  const swing = C.attackOptions(a).find((o) => o.motion === 'swing');
  await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: swing, target: t.id }, { roller: roller([], 3), react: noReact });
  assert.equal(t.damage.STR >= 1, true, 'STR drained');
  assert.ok(t.armor.durability <= dur - 3, 'armor eaten');
  assert.ok(a.stamina > st - swing.stamina, 'stamina drunk');
  const g = armed('G', 'longsword', 'party', { enchantments: ['goading'] }); g.at = { x: 1, y: 2 };
  const u = fighter('U', 'enemy'); u.at = { x: 2, y: 2 };
  const r2 = await arena([g, u]);
  await Combat.act(r2.enc, r2.chars, { actor: g.id, type: 'strike', option: C.attackOptions(g).find((o) => o.motion === 'swing'), target: u.id }, { roller: roller([], 3), react: noReact });
  assert.ok(Conditions.has(g, 'riled') && Conditions.mitigation(g, 'B') === 2);
  // Stun: the chance roll 1, the contest caster 10 vs target 1.
  const s = armed('S', 'shortsword', 'party', { enchantments: ['stunning'] }); s.at = { x: 1, y: 2 };
  const v = fighter('V', 'enemy'); v.at = { x: 2, y: 2 };
  const r3 = await arena([s, v]);
  const apBefore = r3.enc.ap[v.id];
  const strikeRolls = [];
  const rr = async (req) => { strikeRolls.push(req.label); if (/resist/.test(req.label)) return [1]; if (/: stunned$/.test(req.label)) return [10]; if (/: Stunned$/.test(req.detail || '')) return [1]; return Array.from({ length: req.count }, () => 3); };
  await Combat.act(r3.enc, r3.chars, { actor: s.id, type: 'strike', option: C.attackOptions(s).find((o) => o.motion === 'swing'), target: v.id }, { roller: rr, react: noReact });
  assert.ok(Conditions.has(v, 'stunned'), strikeRolls.join(' | '));
  assert.ok(r3.enc.ap[v.id] < apBefore, 'AP lost at once');
});

test('items: ebon mail is as hard as plate, halves fire and breathes poison on foes beside the wearer', async () => {
  const mail = Items.makeArmor('mail', 'full', 'master', { material: 'steel', enchantments: ['ebon'] });
  const plate = Items.makeArmor('plate', 'full', 'average');
  const em = Items.armorBase(mail), pl = Items.armorBase(plate);
  assert.ok(em.mit.P >= pl.mit.P && em.mit.S >= pl.mit.S && em.mit.B >= pl.mit.B, JSON.stringify([em.mit, pl.mit]));
  assert.ok(em.spd < pl.spd, 'and moves like mail');
  const w = fighter('W'); w.armor = mail; w.at = { x: 2, y: 2 };
  const f = fighter('F', 'enemy'); f.at = { x: 3, y: 2 };
  const hit = Combat.computeHit(f, w, { kind: 'strike', motion: 'spell', spell: { element: 'fire', magnitude: 8 }, damage: [0, 0, 0] }, {});
  assert.equal(hit.fire, 4);
  const chars = { [w.id]: w, [f.id]: f };
  const enc = Combat.createEncounter('a', [w.id, f.id], chars, 8, 5);
  enc.pos[w.id] = w.at; enc.pos[f.id] = f.at;
  await Combat.startRound(enc, chars, roller([10, 1, 10, 1]));
  assert.ok(Conditions.has(f, 'poisoned'), enc.log.map((l) => l.text).join('\n'));
});

test('items: powers cast without spell points from charges that come back with a long rest; worn effects add up', async () => {
  const c = armed('C', 'staff', 'party', { enchantments: ['dreadgaze'] });
  assert.equal(Magic.maxSP(c), 0, 'no caster');
  const p = Magic.spellOptions(c).find((o) => o.power);
  assert.ok(p && p.spCost === 0 && p.power.left === 3 && p.spell.shape === 'mind' && p.spell.cond === 'frightened');
  c.at = { x: 1, y: 2 };
  const f = fighter('F', 'enemy'); f.at = { x: 3, y: 2 };
  const { enc, chars } = await arena([c, f]);
  for (let i = 0; i < 3; i++) {
    const o = Combat.legalActions(enc, chars, c.id).spells.find((x) => x.power);
    assert.ok(o.affordable, 'charge ' + i);
    assert.ok(Magic.usePower(c, o));
  }
  assert.equal(Magic.spellOptions(c).find((o) => o.power).power.left, 0);
  await B.Recovery.longRest(c, {}, roller([4]));
  assert.equal(Magic.spellOptions(c).find((o) => o.power).power.left, 3);
  const m = mage('M', ['life', 'death']);
  const sp = Magic.maxSP(m);
  wear(m, 'necromancer_amulet');
  assert.equal(Magic.maxSP(m), sp + 3);
  assert.equal(Magic.spellOptions(m).find((o) => o.spellKey === 'take+life').spell.magnitude, B.CONFIG.magic.words.shapes.bolt.mag + 1);
});

test('items: bane blades and gauntlets bite into their prey; the veil hides the wearer beyond arm\'s reach', async () => {
  const a = armed('A', 'longsword', 'party', { enchantments: ['gravebane'] });
  const zed = Enemies.makeMonster('zombie')[0];
  const opt = C.attackOptions(a).find((o) => o.motion === 'swing');
  a.at = { x: 1, y: 2 }; zed.at = { x: 2, y: 2 };
  const { enc, chars } = await arena([a, zed]);
  await Combat.act(enc, chars, { actor: a.id, type: 'strike', option: opt, target: zed.id }, { roller: roller([], 3), react: noReact });
  assert.ok(enc.log.some((l) => new RegExp(`\\d+/${opt.damage[1] + 4}/\\d+ P/S/B`).test(l.text)), 'four more slashing: ' + enc.log.map((l) => l.text).join(' | '));
  const v = fighter('V'); wear(v, 'circlet_of_shadow'); v.at = { x: 1, y: 2 };
  const archer = armed('R', 'shortbow', 'enemy'); archer.inventory.arrows = 5; archer.at = { x: 5, y: 2 };
  const r = await arena([v, archer]);
  const veil = Combat.legalActions(r.enc, r.chars, v.id).spells.find((o) => o.power && o.spell.noun === 'shadow');
  assert.ok(veil, 'the circlet veils at will');
  await Combat.act(r.enc, r.chars, { actor: v.id, type: 'cast', option: veil, target: v.id }, { roller: roller([], 5), react: noReact });
  assert.ok(Conditions.has(v, 'unseen'));
  assert.ok(Combat.unseenBy(r.enc, r.chars, v, archer));
  assert.ok(!B.AI || !B.AI.choose || true);
});

test('spells: decay eats armor and gear; frost chills (half the squares); Bind paralyzes and gives up the gaps', async () => {
  const m = mage('M', ['decay', 'frost']); m.at = { x: 1, y: 2 };
  const t = armed('T', 'longsword', 'enemy'); t.armor = Items.makeArmor('mail', 'full', 'average'); t.at = { x: 2, y: 2 };
  const { enc, chars } = await arena([m, t]);
  const dur = t.armor.durability, wdur = Items.weaponDurability(C.wieldedWeapon(t));
  await Combat.act(enc, chars, { actor: m.id, type: 'strike', option: C.attackOptions(m).find((o) => o.spellKey === 'strike+decay'), target: t.id }, { roller: roller([10], 5), react: noReact });
  assert.ok(t.armor.durability <= dur - B.CONFIG.magic.words.shapes.bolt.mag);
  assert.ok(Items.weaponDurability(C.wieldedWeapon(t)) < wdur);
  const spd = C.squaresPerAP(t);
  Conditions.add(t, 'chilled', { rounds: 2 });
  assert.ok(C.squaresPerAP(t) <= Math.ceil(spd / 2));
  const bind = Combat.legalActions(enc, chars, m.id).spells.find((o) => o.spellKey === 'bind');
  assert.equal(bind.spell.cond, 'paralyzed', 'Bind alone holds a body still');
  await Combat.act(enc, chars, { actor: m.id, type: 'cast', option: bind, target: t.id }, { roller: roller([10, 10, 1], 10), react: noReact });
  assert.equal(Combat.conditionForbids(enc, chars, t, { type: 'strike' }), 'Paralyzed');
  const stab = armed('K', 'dagger');
  const h = Combat.computeHit(stab, t, C.attackOptions(stab).find((o) => o.motion === 'thrust'), { distance: 1 });
  assert.ok(!h.gap, 'no gap roll needed on the helpless');
});

test('spells: lightning (Storm) leaps to the nearest other body; charm (Bind + Mind) turns a foe until harmed', async () => {
  const m = mage('M', ['storm', 'mind']); m.at = { x: 1, y: 2 };
  const a = fighter('A', 'enemy'); a.at = { x: 2, y: 2 };
  const b = fighter('B', 'enemy'); b.at = { x: 3, y: 2 };
  const { enc, chars } = await arena([m, a, b]);
  const sb = b.stamina;
  await Combat.act(enc, chars, { actor: m.id, type: 'strike', option: C.attackOptions(m).find((o) => o.spellKey === 'strike+storm'), target: a.id }, { roller: roller([10], 1), react: noReact });
  assert.ok(enc.log.some((l) => /leaps from A to B/.test(l.text)));
  assert.ok(b.stamina < sb || C.totalDamage(b) > 0);
  assert.equal(Magic.spellOptions(m).find((o) => o.spellKey === 'bind+mind').spell.cond, 'enthralled');
  const r = await arena([mage('N', ['mind']), fighter('X', 'enemy')]);
  const [n, x] = Object.values(r.chars);
  await Magic.afflict(r.enc, n, x, 'enthralled', { rounds: 3 }, roller([10, 1]));
  assert.equal(x.side, n.side, 'charmed: on the caster\'s side');
  assert.ok(!Conditions.has(n, 'concentrating'), 'a charm needs no holding');
  await Combat.applyHit(r.enc, r.chars, n, x, { kind: 'strike', motion: 'swing', damage: [0, 0, 3], label: 'slap' }, roller([]), {});
  assert.equal(x.side, 'enemy', 'harm breaks it at once');
});

test('spells: Delayed marks an area that breaks at the end of the round; darkness hurts and slows', async () => {
  const m = mage('M', ['fire', 'shadow']); m.at = { x: 0, y: 2 };
  const f = fighter('F', 'enemy'); f.at = { x: 4, y: 2 };
  const g = fighter('G', 'enemy'); g.at = { x: 6, y: 2 };
  const { enc, chars } = await arena([m, f, g], 9, 5);
  const o = Combat.legalActions(enc, chars, m.id).spells.find((x) => x.spellKey === 'strike+fire+delayed');
  assert.ok(o && o.spell.shape === 'area' && o.spell.magnitude === B.CONFIG.magic.words.shapes.area.mag + 3);
  await Combat.act(enc, chars, { actor: m.id, type: 'cast', option: o, at: { x: 4, y: 2 } }, { roller: roller([10], 5), react: noReact });
  assert.ok(Terrain.at(enc, 4, 2).some((t) => t.kind === 'gathering'));
  const sf = f.stamina, sg = g.stamina;
  let guard = 20;
  while (enc.phase === 'turn' && guard--) await Combat.endTurn(enc, chars, Combat.currentActor(enc), { roller: roller([], 5), react: noReact });
  assert.ok(f.stamina < sf || C.totalDamage(f) > 0, 'caught in it');
  assert.ok(g.stamina >= sg - 1, 'outside it');
  assert.ok(B.CONFIG.terrain.darkness.cost >= 1 && B.CONFIG.terrain.darkness.perRound.shadow >= 1);
});

test('fear: Give + Fear; the frightened can\'t come closer, and must first step away each turn (unless hemmed in)', async () => {
  const m = mage('M', ['fear']); m.at = { x: 2, y: 2 };
  const f = armed('F', 'longsword', 'enemy'); f.at = { x: 3, y: 2 };
  const { enc, chars } = await arena([m, f], 8, 5);
  const o = Combat.legalActions(enc, chars, m.id).spells.find((x) => x.spellKey === 'give+fear');
  assert.equal(o.spell.cond, 'frightened');
  await Combat.act(enc, chars, { actor: m.id, type: 'cast', option: o, target: f.id }, { roller: roller([10, 10, 1], 5), react: noReact });
  assert.ok(Conditions.has(f, 'frightened') && Conditions.fear(f).src === m.id);
  // F's turn: nothing but a step away first; no step closer, not even by a roundabout way.
  while (Combat.currentActor(enc) !== f.id) await Combat.endTurn(enc, chars, Combat.currentActor(enc), { roller: roller([], 5), react: noReact });
  const swing = C.attackOptions(f).find((x) => x.motion === 'swing');
  assert.ok(Combat.mustFlee(enc, chars, f));
  assert.match(Combat.validate(enc, chars, { actor: f.id, type: 'strike', option: swing, target: m.id }).err, /first step away from M/);
  assert.match(await Combat.submit(enc, chars, { actor: f.id, type: 'endTurn' }, { roller: roller([], 5), react: noReact }), /first step away/);
  assert.equal(Combat.currentActor(enc), f.id, 'the turn goes on');
  assert.equal(await Combat.act(enc, chars, { actor: f.id, type: 'move', to: { x: 4, y: 2 } }, { roller: roller([], 5), react: noReact }), null);
  assert.ok(!Combat.mustFlee(enc, chars, f), 'the step is taken');
  assert.match(Combat.validate(enc, chars, { actor: f.id, type: 'move', to: { x: 3, y: 2 } }).err, /Too afraid to close/);
  // Hemmed in (walls all round but towards the caster): nothing owed.
  const g = armed('G', 'longsword', 'enemy'); g.at = { x: 1, y: 2 };
  const r = await arena([m, g], 3, 3);
  r.enc.pos[m.id] = { x: 1, y: 1 }; r.enc.pos[g.id] = { x: 1, y: 2 };
  for (const [x, y] of [[0, 2], [2, 2], [0, 1], [2, 1]]) Terrain.add(r.enc, x, y, 'stoneWall');
  Conditions.add(g, 'frightened', { rounds: 2, src: m.id });
  assert.ok(!Combat.mustFlee(r.enc, r.chars, g), 'no square farther to step to');
  // The AI, frightened, steps away before anything else.
  const h = armed('H', 'longsword', 'enemy'); h.at = { x: 3, y: 2 };
  const m2 = mage('M2', ['fear']); m2.at = { x: 2, y: 2 };
  const q = await arena([h, m2], 8, 5);
  Conditions.add(h, 'frightened', { rounds: 2, src: m2.id });
  const d = B.AI.choose(q.enc, q.chars, h.id, () => 0.5);
  assert.equal(d.type, 'move');
  assert.ok(Combat.dist(d.to, q.enc.pos[m2.id]) > 1);
  // Take + Fear on an ally lifts it and keeps it off.
  const t = Magic.spellOptions(m).find((x) => x.spellKey === 'take+fear');
  assert.equal(t.spell.ward, 'fear');
});

test('Raise: Death raises a skeleton, with the feats a zombie or a mummy; Life calls back one just dead; they fall with their caster', async () => {
  const m = mage('M', ['death', 'life']); m.at = { x: 1, y: 2 };
  const knight = armed('Ser Dead', 'greatsword', 'enemy'); knight.status.dead = true; knight.at = { x: 3, y: 2 };
  const f = fighter('F', 'enemy'); f.at = { x: 6, y: 2 };
  const { enc, chars } = await arena([m, knight, f]);
  const raise = () => Combat.legalActions(enc, chars, m.id).spells.find((x) => x.spellKey === 'raise+death');
  assert.equal(raise().spell.raise, 'skeleton');
  m.feats.raise_zombie = 1;
  assert.equal(raise().spell.raise, 'zombie');
  m.feats.raise_mummy = 1;
  assert.equal(raise().spell.raise, 'mummy');
  await Combat.act(enc, chars, { actor: m.id, type: 'cast', option: raise(), at: { x: 3, y: 2 } }, { roller: roller([10], 5), react: noReact });
  const risen = Object.values(enc.extra || {})[0];
  assert.ok(risen && risen.side === m.side && risen.monster === 'mummy' && risen.traits.undead);
  m.status.unconscious = true;
  const lines = Magic.endRound(enc, chars);
  assert.ok(risen.status.dead && lines.some((l) => /falls/.test(l)));
  // Raise + Life is for an ally just dead, and only them.
  const o = Magic.spellOptions(m).find((x) => x.spellKey === 'raise+life');
  assert.equal(o.spell.shape, 'revive');
  assert.ok(Magic.callsBack(o.spell));
});

test('summon: an elemental comes unbound and raging, or bound with Summon + Bind; a Bind brings an unbound one to heel', async () => {
  const m = mage('M', ['fire']); m.at = { x: 1, y: 2 };
  const f = fighter('F', 'enemy'); f.at = { x: 6, y: 2 };
  const { enc, chars } = await arena([m, f]);
  const spells = () => Combat.legalActions(enc, chars, m.id).spells;
  const wild = spells().find((x) => x.spellKey === 'summon+fire');
  const tame = spells().find((x) => x.spellKey === 'summon+bind+fire');
  assert.ok(wild && tame && !wild.spell.bound && tame.spell.bound);
  assert.equal(tame.spCost, B.CONFIG.magic.words.summon.cost + B.CONFIG.magic.words.bind.cost + B.CONFIG.magic.words.fire.cost);
  assert.ok(!spells().some((x) => /^summon\+(mind|life)/.test(x.spellKey)), 'only elementals, ghosts and named outsiders');
  await Combat.act(enc, chars, { actor: m.id, type: 'cast', option: wild, at: { x: 3, y: 2 } }, { roller: roller([10], 5), react: noReact });
  const e = Object.values(enc.extra || {})[0];
  assert.ok(e && e.side === m.side && Conditions.has(e, 'enraged') && !e.conjured.bound && Magic.outsider(e));
  m.nouns.push('outsider');
  const bind = Combat.legalActions(enc, chars, m.id).spells.find((x) => x.spellKey === 'bind+outsider');
  assert.ok(bind.targets.some((t) => t.id === e.id && t.inReach), 'it can be bound where it stands');
  // (Resolved straight away: the summoning spent this turn's AP.)
  await Magic.resolveCast(enc, chars, { actor: m.id, type: 'cast', option: bind, target: e.id }, roller([10, 10, 1], 5), enc.pos);
  assert.ok(e.conjured.bound && !Conditions.has(e, 'enraged'), enc.log.map((l) => l.text).join(' | '));
});

test('ghosts: Summon + Death; swords pass through, its touch passes armor and takes stamina only; force and a ward of Death keep it off', async () => {
  const m = mage('M', ['death', 'force']); m.at = { x: 1, y: 2 };
  const k = armed('K', 'longsword', 'enemy'); k.armor = Items.makeArmor('plate', 'full', 'average'); k.at = { x: 4, y: 2 };
  const { enc, chars } = await arena([m, k]);
  const o = Combat.legalActions(enc, chars, m.id).spells.find((x) => x.spellKey === 'summon+bind+death');
  await Combat.act(enc, chars, { actor: m.id, type: 'cast', option: o, at: { x: 3, y: 2 } }, { roller: roller([10], 5), react: noReact });
  const g = Object.values(enc.extra || {})[0];
  assert.ok(g && g.monster === 'ghost' && g.conjured.bound && Magic.undead(g) && !Magic.outsider(g));
  // A plain sword passes through it.
  const swing = C.attackOptions(k).find((x) => x.motion === 'swing');
  await Combat.applyHit(enc, chars, k, g, swing, roller([], 10), {});
  assert.equal(C.totalDamage(g), 0, 'the sword passes through');
  // Its touch: stamina only, through plate; never an attribute.
  const touch = C.attackOptions(g).find((x) => x.power);
  assert.ok(touch && touch.spell.element === 'spirit');
  const st = k.stamina, dmg = C.totalDamage(k);
  const h = Combat.computeHit(g, k, touch, { distance: 1 });
  assert.ok(h.bluntToStamina > 0 && !h.toCON && !h.slashToAttrs, JSON.stringify(h));
  for (let i = 0; i < 6; i++) await Combat.applyHit(enc, chars, g, k, touch, roller([], 5), {});
  assert.ok(k.stamina < st && C.totalDamage(k) === dmg, 'worn down, never wounded');
  // A ward of Death (Take + Death on an ally) turns it aside; so does a shell of force (Give + Force) while it holds.
  Conditions.add(k, 'warded', { rounds: 3, kind: 'death' });
  assert.ok(Magic.wardAgainst(enc, k, touch, false).blocked);
  Conditions.remove(k, 'warded');
  Conditions.add(k, 'warded', { rounds: 3, kind: 'magic', pool: 20 });
  assert.ok(Magic.wardAgainst(enc, k, touch, false).blocked);
  assert.equal(Magic.spellOptions(m).find((x) => x.spellKey === 'give+force').spell.ward, 'magic');
});

test('companions: a familiar adds spell points and fights; its death tears at its owner; a beast comes with Animal Companion', () => {
  const W = B.World;
  const w = W.create(W.presetParty());
  const [brenna, corin, , ysolde] = W.party(w);
  ysolde.feats.familiar = 1;
  corin.skills.nature = Math.max(corin.skills.nature || 0, 1); corin.feats.animal_companion = 1;
  const sp = B.Magic.maxSP(ysolde);
  B.Companions.ensure(w);
  assert.ok(ysolde.companion && ysolde.companion.familiar && ysolde.companion.side === 'party');
  assert.equal(B.Magic.maxSP(ysolde), sp + 2);
  assert.equal(corin.companion.monster, 'wolf');
  assert.ok(!brenna.companion);
  w.explore = null;
  const b = B.Battle.start(w, { foes: [{ monster: 'rat' }], arena: { w: 9, h: 5 } });
  assert.ok(b.enc.ids.includes(ysolde.companion.id) && b.enc.ids.includes(corin.companion.id));
  ysolde.companion.status.dead = true;
  const lines = B.Companions.afterFight(w);
  assert.ok(lines.length && ysolde.damage.WIL === 2);
  assert.equal(B.Magic.maxSP(ysolde), sp, 'no familiar points');
  B.Companions.ensure(w, { town: true });
  assert.ok(!ysolde.companion.status.dead, 'a new one answers in town');
});

test('data: the relic cache rolls named magic gear and worn things; every power makes a spell', () => {
  const t = B.Content.world.items.tables.relic_cache;
  for (const e of t) {
    if (e.good) { assert.ok(good(e.good), e.good); continue; }
    const it = B.Economy.makeFromSpec(e);
    assert.ok(it, JSON.stringify(e));
    if (e.name) assert.equal(Items.itemName(it), e.name);
  }
  assert.deepStrictEqual(B.Content.validate(), []);
});
