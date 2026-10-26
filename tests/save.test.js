// Save versions (src/game/save.js): old shapes are upgraded step by step on load; supplies are in one place at a time.
const test = require('node:test');
const assert = require('node:assert');
const B = require('./load.js');
const { World, Save, Rand } = B;

const fresh = () => { Rand.seed(3); return World.create(World.presetParty(), { log: false }); };

test('save: a new world is at the current version; a save from a newer one is refused', () => {
  const w = fresh();
  assert.equal(w.version, Save.VERSION);
  const text = Save.serialize(Object.assign({}, w, { version: Save.VERSION + 1 }));
  assert.throws(() => Save.deserialize(text), /newer version/);
});

test('save: a version-2 save comes up to the current shape', () => {
  const w = fresh();
  const c = World.party(w)[0];
  c.trinkets = [{ name: 'Sash', slot: 'charm', effects: { apMult: 0.8 } }];
  c.status.grappledBy = ['x']; c.status.pinned = true; delete c.status.grapple;
  c.gold = 5;
  w.pack.gear.push({ id: 'old1', kind: 'weapon', type: 'longsword', quality: 'masterwork', enchant: { drain: { stamina: 0.5 } } });
  w.battle = { foes: { t1: Object.assign(B.Enemies.makeMonster('caveTroll')[0], { id: 't1' }) } };
  w.battle.foes.t1.traits = { regen: { con: 1, stamina: 6 }, nimble: 1, magicImmune: true };
  w.supplies.bandages = 4;
  w.version = 2;
  const back = Save.deserialize(Save.serialize(w));
  const d = World.party(back)[0];
  assert.equal(back.version, Save.VERSION);
  assert.deepEqual(d.trinkets[0].effects, { costMult: 0.8 });
  assert.equal(d.trinkets[0].slot, 'neck');
  assert.deepEqual(d.status.grapple, { partner: 'x', level: 'pin', role: 'held' });
  assert.ok(!('grappledBy' in d.status) && !('gold' in d));
  const sword = back.pack.gear.find((it) => it.id === 'old1');
  assert.equal(sword.craft, 'master');
  assert.deepEqual(sword.enchantments, ['drinking']);
  assert.ok(!('enchant' in sword) && !('quality' in sword));
  assert.deepEqual(back.battle.foes.t1.traits, { regrow: { con: 1, stamina: 6 }, dodge: 1, resist: { magic: 0 } });
  assert.equal(back.supplies.bandages, 0, 'a mid-fight save held the dealt bandages in hand, not in the pool too');
});

test('supplies: dealt out of the pool for a fight, added back after; something gained meanwhile is kept', () => {
  const w = fresh();
  w.supplies.bandages = 4;
  World.loadSupplies(w);
  const inHand = () => World.party(w).reduce((t, c) => t + c.inventory.bandages, 0);
  assert.equal(w.supplies.bandages, 0);
  assert.equal(inHand(), 4);
  World.addGood(w, Object.keys(B.Content.world.items.goods).find((id) => B.Content.world.items.goods[id].engine === 'bandages'), 1);
  const gained = w.supplies.bandages;
  assert.ok(gained > 0);
  World.collectSupplies(w);
  assert.equal(w.supplies.bandages, 4 + gained);
  assert.equal(inHand(), 0);
});
