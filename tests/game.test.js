// Tests for the game layer: content, world, exploring, parley, economy, equipment, battles, saves.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('./legacy.js');
const { World, Explore, Battle, Auto, Parley, Factions, Skills, Economy, Equip, Town, Save, Loot, Rand, Content, Character: C, Items } = B;

const fresh = (seed) => { Rand.seed(seed || 1); return World.create(World.presetParty(), { log: false }); };
const place = (id) => Content.world.places[id];

// ---- Content ------------------------------------------------------------------------------
test('content: every cross-reference between the YAML files resolves', () => {
  assert.deepEqual(Content.validate(), []);
});

test('content: each map is rectangular, and everything on it can be reached from a way in', () => {
  // The ways in: '<', and every square another place's stairs or drop arrives on.
  const arrivals = {};
  for (const p of Object.values(Content.world.places)) for (const def of Object.values(p.legend || {})) {
    if ((def.kind === 'stairs' || def.kind === 'drop') && def.at) (arrivals[def.to] = arrivals[def.to] || new Set()).add(def.at);
  }
  for (const [id, p] of Object.entries(Content.world.places)) {
    if (!p.map) continue;
    const g = Explore.grid(id);
    const starts = ['<', ...(arrivals[id] || [])].map((ch) => Explore.findChar(id, ch)).filter(Boolean);
    assert.ok(starts.length, `${id} has a way in`);
    // Walk everything that isn't rock, wall or deep water: doors, locks and secrets are passable for this purpose.
    const ground = B.CONFIG.game.ground || {};
    const closed = (ch) => ch === '#' || ch === ' ' || (ground[ch] && (ground[ch].wall || ground[ch].walk === false));
    const seen = new Set(starts.map((s0) => s0.x + ',' + s0.y));
    const q = starts.slice();
    while (q.length) {
      const { x, y } = q.shift();
      for (const [dx, dy] of Explore.DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
        const ch = g.rows[ny][nx];
        if (closed(ch) || seen.has(nx + ',' + ny)) continue;
        seen.add(nx + ',' + ny);
        q.push({ x: nx, y: ny });
      }
    }
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (!closed(g.rows[y][x])) assert.ok(seen.has(x + ',' + y), `${id}: (${x},${y}) '${g.rows[y][x]}' is cut off`);
    }
  }
});

test('content: staircases come in pairs', () => {
  for (const [id, p] of Object.entries(Content.world.places)) {
    for (const def of Object.values(p.legend || {})) {
      if (def.kind !== 'stairs' || !def.to) continue;
      const other = Content.world.places[def.to];
      if (other.kind === 'town') {
        assert.ok((other.exits || []).some((e) => e.to === id), `${def.to} has a way to ${id}`);
      } else {
        assert.ok(Object.values(other.legend).some((d) => d.kind === 'stairs' && d.to === id), `${def.to} leads back to ${id}`);
      }
    }
  }
});

test('content: the starting party obeys the creation rules', () => {
  const g = B.CONFIG.game.party;
  for (const p of Content.world.start.presets) {
    const total = Object.values(p.attrs).reduce((t, v) => t + v, 0);
    assert.equal(total, g.attrPool, `${p.name}: ${total} attribute points`);
    for (const v of Object.values(p.attrs)) assert.ok(v >= g.attrMin && v <= g.attrMax, `${p.name}: attribute ${v} out of range`);
  }
  const w = fresh();
  for (const c of World.party(w)) assert.equal(C.featCount(c), C.featBudget(c), `${c.name} spent every starting feat`);
});

test('yaml: values, flow collections, block text and errors', () => {
  const Y = B.Yaml;
  assert.deepEqual(Y.parse('a: 1\nb: [x, {y: "q: r"}]\nc: |\n  hi\n  there\nd: ~\ne: .inf'), { a: 1, b: ['x', { y: 'q: r' }], c: 'hi\nthere', d: null, e: Infinity });
  assert.throws(() => Y.parse('a: 1\na: 2'), /duplicate key/);
  assert.throws(() => Y.parse('a:\n\tb: 1'), /tabs/);
});

// ---- Skills, factions -------------------------------------------------------------------------------
test('skills: a trained scout out-sneaks a clanker, and a loud group is only as quiet as its worst', () => {
  const w = fresh();
  const [brenna, corin] = World.party(w);
  assert.ok(Skills.mod(corin, 'stealth') > Skills.mod(brenna, 'stealth'));
  const plate = World.makeCharacter({ name: 'Tank', attrs: { STR: 6, CON: 6, DEX: 5, SPD: 5, INT: 4, WIL: 5, WIS: 5, CHA: 4 }, kit: 'sword' });
  plate.armor = Items.makeArmor('plate', 'full', 'standard');
  assert.ok(Skills.mod(plate, 'stealth') < 0);
  assert.ok(Skills.groupStealth([corin, plate]) < Skills.mod(corin, 'stealth'));
});

test('factions: a change spreads to allies and, inverted, to enemies; kills cost standing', () => {
  const w = fresh();
  Factions.change(w, 'town_watch', 20);
  assert.equal(Factions.standing(w, 'town_watch'), 20);
  assert.ok(Factions.standing(w, 'merchants_guild') > 0, 'an ally gained');
  assert.ok(Factions.standing(w, 'cutthroats') < -5, 'an enemy lost');
  const before = Factions.standing(w, 'cutthroats');
  Factions.killed(w, 'cutthroats', 2);
  assert.equal(Factions.standing(w, 'cutthroats'), before - 6);
  assert.ok(Factions.standing(w, 'town_watch') > 20, 'their enemies approve');
  Factions.killed(w, 'wilds', 5);
  assert.equal(Factions.standing(w, 'wilds'), 0, 'beasts keep no ledger');
});

// ---- Parley -------------------------------------------------------------------------------------------
test('parley: willingness gates topics; a venal innkeeper can be bought', () => {
  const w = fresh(3);
  Parley.start(w, 'marta_quill');
  let v = Parley.view(w);
  const state = (id) => v.topics.find((t) => t.id === id).status;
  assert.equal(state('rumors'), 'open');
  assert.equal(state('tab'), 'locked');
  w.gold = 100;
  Parley.move(w, 'bribe', { steps: 3 });
  v = Parley.view(w);
  assert.equal(state('tab'), 'open', 'thirty gold opens a venal door');
  assert.equal(w.gold, 70);
  const res = Parley.ask(w, 'tab');
  assert.ok(res.ok);
  assert.ok(w.flags.inn_tab);
  assert.equal(Parley.view(w).topics.find((t) => t.id === 'tab').status, 'done', 'once-only topics close');
});

test('parley: a bribe insults someone who is not for sale', () => {
  const w = fresh(4);
  Parley.start(w, 'warden_ysa');
  const before = Parley.disposition(w, w.parley);
  w.gold = 50;
  Parley.move(w, 'bribe', { steps: 2 });
  assert.ok(Parley.disposition(w, w.parley) < before);
});

test('parley: patience runs out, and a failed threat can end the talk', () => {
  const w = fresh(5);
  Parley.start(w, 'captain_hollis');
  const p0 = w.parley.patience;
  for (let i = 0; i < 20 && !w.parley.last && !w.parley.ended; i++) Parley.move(w, 'charm');
  assert.ok(w.parley.last || w.parley.ended, 'the captain tires of it');
  assert.ok(w.parley.patience < p0);
  const r = Parley.move(w, 'charm');
  assert.equal(r.ok, false);
});

test('parley: reputation and standing change how people start out', () => {
  const w = fresh(6);
  Parley.start(w, 'captain_hollis');
  const base = w.parley.baseDisp;
  Parley.close(w);
  Factions.change(w, 'town_watch', 40);
  Factions.addRep(w, 'renown', 30);
  Parley.start(w, 'captain_hollis');
  assert.ok(w.parley.baseDisp > base, 'the Watch captain warms to a friend of the Watch with a good name');
  Parley.close(w);
  Parley.start(w, 'old_dagmar');
  const withRenown = Parley.willingness(w, w.parley);
  Parley.close(w);
  w.rep.renown = 0;
  Parley.start(w, 'old_dagmar');
  assert.ok(withRenown > Parley.willingness(w, w.parley), 'a starstruck veteran yields to renown');
});

test('parley: a quest topic starts the quest and the flag chain pays out', () => {
  const w = fresh(7);
  Parley.start(w, 'captain_hollis');
  assert.equal(Parley.view(w).topics.find((t) => t.id === 'rats').status, 'open');
  Parley.ask(w, 'rats');
  assert.ok(w.quests.rats_in_cellars);
  Parley.close(w);
  World.setFlag(w, 'cleared_rat_nest');
  World.updateQuests(w);
  assert.equal(w.quests.rats_in_cellars.stage, 1);
  Parley.start(w, 'captain_hollis');
  Parley.ask(w, 'rats_report');
  assert.ok(w.quests.rats_in_cellars.done);
  assert.ok(w.gold >= 100 && Factions.standing(w, 'town_watch') >= 8);
});

test('parley: taking one side of a faction quarrel closes the other', () => {
  const w = fresh(8);
  World.startQuest(w, 'lost_shipment');
  World.startQuest(w, 'crates_for_corvin');
  assert.ok(w.quests.lost_shipment.failed);
});

// ---- Exploring --------------------------------------------------------------------------------------------
const face = (w, d) => { while (w.explore.dir !== d) Explore.turn(w, 1); };
const walk = (w, d, n) => { face(w, d); let evs = []; for (let i = 0; i < n; i++) evs = evs.concat(Explore.move(w, 0).events); return evs; };

test('explore: you arrive on the stairs, doors open when walked into, walls stop you', () => {
  const w = fresh();
  Explore.enter(w, 'undercroft_1', '<');
  assert.deepEqual([w.explore.x, w.explore.y], [1, 1]);
  const evs = walk(w, 1, 3);
  assert.deepEqual([w.explore.x, w.explore.y], [4, 1]);
  assert.ok(Explore.markSeen && Object.keys(World.mapState(w, 'undercroft_1').seen).length > 5, 'fog lifts around you');
  const wall = Explore.move(w, 0);
  assert.equal(wall.moved, false, 'the east wall of the entry hall');
  assert.equal(wall.events[0].type, 'bump');
  // The door in the east wall opens when bumped into, then lets you through.
  w.explore.x = 4; w.explore.y = 2; w.explore.dir = 1;
  assert.equal(Explore.cell(w, 5, 2).kind, 'door');
  assert.equal(Explore.move(w, 0).moved, false);
  assert.equal(Explore.cell(w, 5, 2).kind, 'floor');
  assert.equal(Explore.move(w, 0).moved, true);
});

test('explore: hidden things stay hidden until found; a search finds them', () => {
  const w = fresh(21);
  Explore.enter(w, 'undercroft_1', '<');
  const c = Explore.cell(w, 22, 3);
  assert.equal(c.kind, 'wall', 'a secret door looks like wall');
  // Stand beside the secret door and search until it shows (bounded).
  w.explore.x = 21; w.explore.y = 3; w.explore.dir = 1;
  for (let i = 0; i < 40 && Explore.cell(w, 22, 3).kind === 'wall'; i++) Explore.search(w);
  assert.equal(Explore.cell(w, 22, 3).kind, 'door');
});

test('explore: an unseen trap springs on whoever steps on it, once', () => {
  const w = fresh(22);
  Explore.enter(w, 'undercroft_1', '<');
  Explore.state(w, 17, 3).sprung = false;
  w.explore.x = 16; w.explore.y = 3; w.explore.dir = 1;
  const hp = () => World.party(w).reduce((t, c) => t + C.totalDamage(c), 0);
  const before = hp();
  Explore.state(w, 17, 3).passive = true; // not noticed
  const evs = Explore.move(w, 0).events;
  assert.ok(evs.some((e) => e.type === 'trap'));
  assert.equal(hp(), before + 1);
  w.explore.x = 16;
  const again = Explore.move(w, 0).events;
  assert.ok(!again.some((e) => e.type === 'trap'), 'a sprung trap is spent');
});

test('explore: locked doors yield to keys, picks or force; the right tool shows up as an option', () => {
  const w = fresh(23);
  Explore.enter(w, 'undercroft_1', '<');
  w.explore.x = 18; w.explore.y = 11; w.explore.dir = 2; // facing the iron-banded door at (18,12)
  let f = Explore.facing(w);
  assert.equal(f.kind, 'locked');
  assert.ok(f.actions.some((a) => a.id === 'pick') && f.actions.some((a) => a.id === 'force'));
  assert.ok(!f.actions.some((a) => a.id === 'key'));
  World.addGood(w, 'cellar_key');
  f = Explore.facing(w);
  assert.ok(f.actions.some((a) => a.id === 'key'));
  Explore.act(w, 'key');
  assert.equal(Explore.cell(w, 18, 12).kind, 'floor');
});

test('explore: sleeping foes can be sneaked up on; walking in loudly wakes them at arm\'s length', () => {
  const quiet = fresh(31);
  Explore.enter(quiet, 'undercroft_1', '<');
  // The sleeping guards 'g' at (4,9): approach from the north along x=4.
  const approach = (w, sneak) => {
    w.explore.x = 4; w.explore.y = 6; w.explore.dir = 2; w.explore.sneak = sneak;
    const out = [];
    for (let i = 0; i < 2; i++) out.push(...Explore.scan(w, []) || []);
    const evs = [];
    Explore.scan(w, evs);
    return evs;
  };
  // At distance 3 a sleeping group is beyond the notice range of 2: nothing yet.
  assert.deepEqual(approach(quiet, false).filter((e) => e.type === 'encounter'), []);
  const loud = fresh(32);
  Explore.enter(loud, 'undercroft_1', '<');
  loud.explore.x = 4; loud.explore.y = 8; loud.explore.dir = 2;
  const evs = [];
  Explore.scan(loud, evs);
  assert.ok(evs.some((e) => e.type === 'encounter'), 'adjacent and unhidden: they wake');
});

test('explore: stairs are an event; leaving for town clears the map position', () => {
  const w = fresh();
  Explore.enter(w, 'undercroft_1', '<');
  w.explore.x = 2; w.explore.y = 1; w.explore.dir = 3;
  const evs = Explore.move(w, 0).events;
  assert.ok(evs.some((e) => e.type === 'stairs' && e.def.to === 'stonebridge'));
  Explore.leave(w, 'stonebridge');
  assert.equal(w.explore, null);
  assert.equal(w.place, 'stonebridge');
});

// ---- Battle ------------------------------------------------------------------------------------------------
test('battle: a fight plays out, pays XP and loot, sets the flag and settles the square', async () => {
  const w = fresh(41);
  Explore.enter(w, 'undercroft_1', '<');
  const spec = place('undercroft_1').encounters.rat_nest;
  Battle.start(w, spec, { ctx: { x: 9, y: 2 } });
  assert.ok(Battle.table(w).characters[Object.keys(w.battle.foes)[0]]);
  const enc = await Auto.battle(w);
  assert.equal(enc.phase, 'over');
  assert.equal(enc.winner, 'party');
  const res = Battle.finish(w);
  assert.equal(res.result, 'won');
  assert.ok(w.flags.cleared_rat_nest);
  assert.equal(w.battle, null);
  assert.equal(Explore.state(w, 9, 2).done, true);
  assert.ok(World.party(w).every((c) => c.xp > 0));
  // Stamina comes back only if the party stops: one click rests and mends (time passes, gear patched,
  // weariness stays until a long rest).
  const t0 = w.minutes;
  for (const c of World.party(w)) for (const x of c.weapons) if (Items.weaponMaxDurability(x)) x.durability = 1;
  const lines = World.restAndRepair(w);
  assert.equal(w.minutes - t0, B.CONFIG.afterBattle.minutes);
  for (const c of World.party(w)) {
    assert.equal(c.stamina, C.maxStamina(c), 'rested');
    assert.ok(c.weapons.every((x) => !Items.weaponMaxDurability(x) || x.durability > 1), 'weapons patched');
    if (enc.round > 0 && !c.status.dead) assert.ok(C.maxStamina(c) < C.freshStamina(c), 'the fight wearied them');
  }
  assert.ok(lines.some((l) => /repaired/.test(l)));
});

test('battle: killing a faction\'s people costs standing; sparing them (knocked out) does not', async () => {
  const w = fresh(42);
  const before = Factions.standing(w, 'cutthroats');
  Battle.start(w, { foes: [{ template: 'bandit', level: 1, n: 2 }] });
  await Auto.battle(w);
  const dead = Object.values(w.battle.foes).filter((f) => f.status.dead).length;
  Battle.finish(w);
  assert.equal(Factions.standing(w, 'cutthroats'), before - 3 * dead);
});

test('battle: an ambush costs the enemy AP in the first round, and an ambusher costs them more', async () => {
  const w = fresh(43);
  Battle.start(w, { foes: [{ monster: 'wolf', n: 2 }] }, { surprise: 'enemy', factor: Battle.ambushFactor(w) });
  const t = Battle.table(w);
  await B.Combat.startRound(w.battle.enc, t.characters, Town.autoRoller);
  const wolf = Object.values(w.battle.foes)[0];
  assert.ok(w.battle.enc.ap[wolf.id] <= Math.floor(C.apPool(wolf) / 2));
  const mate = World.party(w)[0];
  assert.equal(w.battle.enc.ap[mate.id], C.apPool(mate), 'the ambushers keep their AP');
  Battle.finish(w, 'fled');
  mate.feats.ambusher = 2;
  assert.equal(Battle.ambushFactor(w), 0);
});

test('battle: a bandit has a price on his gear, and plate armor is a prize', async () => {
  const w = fresh(44);
  const [bandit] = Battle.buildFoes({ foes: [{ template: 'bandit', level: 6 }] });
  assert.ok(Loot.fromFoe(bandit).gear.length >= 1);
});

// ---- Economy, equipment ---------------------------------------------------------------------------------------
test('economy: standing and bargaining change prices; selling pays a fraction', () => {
  const w = fresh();
  const forge = place('stonebridge').locations.find((l) => l.id === 'forge').services[0];
  const stock = Economy.stock(w, forge);
  const sword = stock.find((e) => e.spec.weapon === 'longsword');
  Factions.change(w, 'merchants_guild', 50);
  const cheaper = Economy.stock(w, forge).find((e) => e.spec.weapon === 'longsword');
  assert.ok(cheaper.price < sword.price);
  assert.ok(Economy.stock(w, forge).length > stock.length, 'friends see more of the shelves');
  const item = Items.makeWeapon('longsword', 'standard');
  assert.ok(Economy.sellPrice(w, Economy.value(item), forge) < cheaper.price);
});

test('economy: buy, sell and repair move gold and goods', () => {
  const w = fresh();
  w.gold = 500;
  const forge = place('stonebridge').locations.find((l) => l.id === 'forge').services[0];
  const e = Economy.stock(w, forge).find((x) => x.spec.armor === 'leather' && x.spec.coverage === 'full');
  assert.ok(Economy.buy(w, forge, e).ok);
  assert.equal(w.pack.gear.length, 1);
  assert.equal(w.gold, 500 - e.price);
  const armor = w.pack.gear[0];
  armor.durability = 3;
  const cost = Economy.repairCost(w, armor, forge);
  assert.ok(cost > 0);
  assert.ok(Economy.repair(w, armor, forge).ok);
  assert.equal(armor.durability, Items.armorMaxDurability(armor));
  const gold = w.gold;
  Economy.sellItem(w, armor, forge);
  assert.ok(w.gold > gold && w.pack.gear.length === 0);
  assert.equal(Economy.buy(Object.assign(w, { gold: 1 }), forge, e).ok, false);
});

test('equip: a two-handed weapon puts the shield away; a shield refuses a two-hander\'s hands', () => {
  const w = fresh();
  const brenna = World.party(w)[0];
  assert.ok(brenna.shield);
  const hammer = Items.makeWeapon('greatsword', 'standard');
  w.pack.gear.push(hammer);
  const r = Equip.equip(w, brenna, hammer, 'main');
  assert.ok(r.ok);
  assert.equal(brenna.shield, null);
  assert.equal(w.pack.gear.some((x) => x.kind === 'shield'), true);
  const shield = w.pack.gear.find((x) => x.kind === 'shield');
  assert.equal(Equip.equip(w, brenna, shield, 'shield').ok, false);
  // Back to the sword: the shield fits again.
  const sword = w.pack.gear.find((x) => x.kind === 'weapon');
  assert.ok(Equip.equip(w, brenna, sword, 'main').ok);
  assert.ok(Equip.equip(w, brenna, shield, 'shield').ok);
  // Every weapon the character holds is in a slot.
  assert.ok(brenna.weapons.every((x) => [brenna.wield, brenna.sidearm, brenna.offhand].includes(x.id)));
});

test('equip: trinkets add to attributes and come off again', () => {
  const w = fresh();
  const c = World.party(w)[0];
  World.addGood(w, 'sash_quick');
  const spd = C.attr(c, 'SPD');
  assert.ok(Equip.equipTrinket(w, c, 'sash_quick').ok);
  assert.equal(C.attr(c, 'SPD'), spd + 1);
  Equip.unequip(w, c, 'waist');
  assert.equal(C.attr(c, 'SPD'), spd);
  assert.equal(World.goodCount(w, 'sash_quick'), 1);
});

test('equip: the user\'s slots — two rings, two ears, a neck, a cape, a waist, head to boots; old charms move to the neck', () => {
  const w = fresh();
  const c = World.party(w)[0];
  const ids = Equip.slotList().map((x) => x[0]);
  for (const s of ['main', 'off', 'side', 'shield', 'body', 'head', 'neck', 'shoulders', 'cape', 'waist', 'ear1', 'ear2', 'arms', 'hands', 'ring1', 'ring2', 'legs', 'feet']) assert.ok(ids.includes(s), s);
  World.addGood(w, 'ring_iron', 2);
  assert.ok(Equip.equipTrinket(w, c, 'ring_iron').ok);
  assert.ok(Equip.equipTrinket(w, c, 'ring_iron').ok);
  assert.ok(Equip.itemIn(c, 'ring1') && Equip.itemIn(c, 'ring2'), 'one ring on each hand');
  assert.equal(C.attr(c, 'CON'), c.base.CON + 2);
  World.addGood(w, 'circlet_of_shadow');
  assert.equal(Equip.equipTrinket(w, c, 'circlet_of_shadow', 'neck').ok, false, 'a circlet goes on the head');
  // An old save's charm and ring.
  const old = { trinkets: [{ name: 'x', slot: 'charm', attrs: {} }, { name: 'y', slot: 'ring', attrs: {} }, { name: 'z', slot: 'ring', attrs: {} }] };
  C.normalize(B.Save.upgradeCharacter(old));
  assert.deepStrictEqual(old.trinkets.map((t) => t.at), ['neck', 'ring1', 'ring2']);
  // Earrings fill either ear.
  World.addGood(w, 'orc_fang_earring'); World.addGood(w, 'ivandyr_hoop');
  assert.ok(Equip.equipTrinket(w, c, 'orc_fang_earring').ok);
  assert.ok(Equip.equipTrinket(w, c, 'ivandyr_hoop').ok);
  assert.ok(Equip.itemIn(c, 'ear1') && Equip.itemIn(c, 'ear2'));
});

test('supplies: bandages and arrows are dealt to members for a fight and collected afterward', () => {
  const w = fresh();
  w.supplies.bandages = 6; w.supplies.arrows = 20;
  World.loadSupplies(w);
  const [brenna, corin] = World.party(w);
  assert.equal(World.party(w).reduce((t, c) => t + c.inventory.bandages, 0), 6);
  assert.equal(corin.inventory.arrows, 20, 'the archer gets the arrows');
  World.collectSupplies(w);
  assert.equal(w.supplies.bandages, 6);
  assert.equal(brenna.inventory.bandages, 0);
});

// ---- Training, rest, healing --------------------------------------------------------------------------------------
test('town: training spends a feat and gold; only implemented feats are taught', () => {
  const w = fresh();
  const c = World.party(w)[0];
  c.level += 1;  // one feat to spend
  w.gold = 500;
  assert.ok(Town.trainable(c, 'toughness').ok);
  assert.equal(Town.trainable(c, 'cleave').ok, false, 'table-ruling feats are not in the game');
  const before = w.gold;
  const r = Town.train(w, c, 'toughness');
  assert.ok(r.ok);
  assert.equal(C.rank(c, 'toughness'), 1);
  assert.ok(w.gold < before);
  assert.equal(Town.train(w, c, 'strength').ok, false, 'no free feats left');
  // At camp the price is rules.yaml game.campTraining × the Training Yard's.
  c.level += 1;
  const camp = Town.trainable(c, 'strength', { camp: true });
  assert.equal(camp.cost, Math.round(B.Economy.trainCost(c, 'strength') * B.CONFIG.game.campTraining));
  const g0 = w.gold;
  assert.ok(Town.train(w, c, 'strength', { camp: true }).ok);
  assert.equal(w.gold, g0 - camp.cost);
});

test('town: the inn costs gold and restores everyone; healers are cheaper to friends', async () => {
  const w = fresh(51);
  const c = World.party(w)[0];
  c.stamina = 3; c.damage.CON = 2; C.updateCondition(c);
  w.gold = 3;
  assert.equal((await Town.innRest(w)).ok, false);
  w.gold = 50;
  const day = w.day;
  const r = await Town.innRest(w);
  assert.ok(r.ok);
  assert.equal(c.stamina, C.maxStamina(c));
  assert.ok(w.day > day);
  c.damage.CON = 2;
  const temple = place('stonebridge').locations.find((l) => l.id === 'lantern_house').services[0];
  const full = Economy.healCost(w, c, temple);
  Factions.change(w, 'lantern_order', 30);
  assert.ok(Economy.healCost(w, c, temple) < full);
  w.gold = 1000;
  assert.ok(Town.heal(w, c, temple).ok);
  assert.equal(C.totalDamage(c), 0);
});

test('town: the dead are raised for a price, and come back hurt', () => {
  const w = fresh();
  const c = World.party(w)[1];
  c.status.dead = true;
  const temple = place('stonebridge').locations.find((l) => l.id === 'lantern_house').services[0];
  w.gold = 1000;
  assert.equal(Town.raise(w, c, temple).ok, false, 'the Lantern raises its friends');
  Factions.change(w, 'lantern_order', 30);
  assert.ok(Town.raise(w, c, temple).ok);
  assert.equal(c.status.dead, false);
  assert.equal(c.damage.CON, 3);
});

test('town: potions and books do what they say', () => {
  const w = fresh();
  const c = World.party(w)[0];
  World.addGood(w, 'salve');
  assert.equal(Town.useGood(w, 'salve', c).ok, false, 'unhurt');
  c.damage.CON = 2;
  assert.ok(Town.useGood(w, 'salve', c).ok);
  assert.equal(c.damage.CON, 1);
  World.addGood(w, 'tome_stone');
  const mage = World.party(w)[3];
  assert.ok(Town.useGood(w, 'tome_stone', mage).ok);
  assert.ok(mage.nouns.includes('earth'));
  assert.equal(World.goodCount(w, 'tome_stone'), 0);
});

// ---- XP --------------------------------------------------------------------------------------------------------------------
test('xp: levels come at 60, 180, 360 and give a feat each', () => {
  assert.deepEqual([0, 59, 60, 179, 180, 360, 600].map(World.levelFor), [1, 1, 2, 2, 3, 4, 5]);
  const w = fresh();
  World.grantXP(w, 200);
  const c = World.party(w)[0];
  assert.equal(c.level, 3);
  assert.equal(C.featBudget(c), 5);
});

// ---- Saves ---------------------------------------------------------------------------------------------------------------
test('save: a world survives a round trip, even in the middle of a fight', () => {
  const w = fresh(61);
  Explore.enter(w, 'undercroft_1', '<');
  World.addGood(w, 'salve');
  Factions.change(w, 'town_watch', 12);
  Battle.start(w, place('undercroft_1').encounters.guards_one);
  Battle.table(w); // runtime-only cache
  const text = Save.serialize(w);
  assert.ok(!text.includes('_table'));
  const back = Save.deserialize(text);
  assert.equal(back.standing.town_watch, w.standing.town_watch);
  assert.equal(back.pack.goods.salve, 1);
  assert.deepEqual(back.explore, w.explore);
  assert.ok(back.battle && Battle.table(back).characters[Object.keys(back.battle.foes)[0]]);
  const store = { m: {}, getItem(k) { return this.m[k] || null; }, setItem(k, v) { this.m[k] = v; }, removeItem(k) { delete this.m[k]; } };
  assert.ok(Save.write('1', w, store));
  assert.equal(Save.list(store).filter((s) => s.world).length, 1);
});

// ---- Whole-game smoke -----------------------------------------------------------------------------------------------------
test('play: a party can clear the first dungeon with the AI on both sides of every choice', async () => {
  const w = fresh(77);
  Explore.enter(w, 'undercroft_1', '<');
  for (const id of ['rat_nest', 'guards_one']) {
    Battle.start(w, place('undercroft_1').encounters[id], {});
    await Auto.battle(w);
    const res = Battle.finish(w);
    assert.ok(['won', 'lost', 'draw'].includes(res.result));
    if (res.result !== 'won') break;
    World.breather(w);
  }
  assert.ok(w.stats.fights >= 1);
});

test('armor pieces: each takes the slots it covers; a crown and a helm share the head; repairs and loot see every piece', () => {
  const w = fresh();
  // Someone in the padded harness with no armor feats (they would lower the penalties summed below).
  const c = World.party(w).find((x) => x.armor && x.armor.type === 'padded' && !Object.keys(x.feats).some((f) => /mobility|armor_training/.test(f)));
  const Items = B.Items;
  // Wearing a mail shirt (torso, arms) and a plate helm over the starting harness takes the harness off.
  const shirt = Items.makeArmor('mail', null, 'average', { covers: ['torso', 'arms'] });
  const helm = Items.makeArmor('plate', null, 'average', { covers: ['head'] });
  w.pack.gear.push(shirt, helm);
  assert.deepStrictEqual(Equip.fits(shirt), ['body', 'arms']);
  const old = c.armor;
  assert.ok(Equip.equip(w, c, shirt, 'body').ok);
  assert.ok(w.pack.gear.includes(old), 'the full harness went into the pack');
  assert.ok(Equip.equip(w, c, helm, 'head').ok);
  assert.strictEqual(Equip.itemIn(c, 'body'), shirt);
  assert.strictEqual(Equip.itemIn(c, 'arms'), shirt);
  assert.strictEqual(Equip.itemIn(c, 'head'), helm);
  assert.strictEqual(Equip.itemIn(c, 'legs'), null);
  assert.ok(!C.armorUniform(c));
  assert.strictEqual(Items.itemName(helm), 'Iron helm');
  // Penalties add up by piece: the shirt carries its share of mail's, the helm its share of plate's.
  const ai = C.armorInfo(c);
  const sum = Items.armorBase(shirt).spd + Items.armorBase(helm).spd;
  assert.ok(Math.abs(ai.spd - Math.max(0, sum)) < 0.11, JSON.stringify([ai.spd, sum]));
  // A crown on the head takes the helm off.
  World.addGood(w, 'crown_of_rile');
  assert.ok(Equip.equipTrinket(w, c, 'crown_of_rile').ok);
  assert.strictEqual(C.armorAt(c, 'head'), null);
  assert.ok(w.pack.gear.includes(helm));
  // Journeyman's Boots are leather boots now, and still quicken a move.
  const boots = Items.makeArmor('leather', null, 'master', { covers: ['feet'], enchantments: ['journeying'] });
  w.pack.gear.push(boots);
  const before = C.squaresPerAP(c);
  assert.ok(Equip.equip(w, c, boots, 'feet').ok);
  assert.equal(C.squaresPerAP(c), before + 1);
  // Field repairs reach every piece.
  shirt.durability = 1; boots.durability = 1;
  B.Recovery.mendGear(c, 0.5);
  assert.ok(shirt.durability > 1 && boots.durability > 1);
});

test('a trial start: Tevax at level 8 with every listed feat, his own gear and the sash worn', () => {
  const B = require('./load.js');
  const specs = B.World.trialParty('tevax');
  assert.equal(specs.length, 1);
  const w = B.World.create(specs);
  const c = B.World.party(w)[0];
  assert.equal(c.level, 8);
  const want = {};
  for (const f of specs[0].feats) want[f] = (want[f] || 0) + 1;
  for (const [f, n] of Object.entries(want)) assert.equal(B.Character.rank(c, f), n, `feat ${f}`);
  assert.equal(B.Items.itemName(c.armor), 'Ebony Mail');
  assert.equal(B.Items.itemName(B.Character.wieldedWeapon(c)), 'Ebony Blade');
  assert.ok((c.trinkets || []).some((t) => t.goodId === 'silk_sash'), 'the sash is worn');
  assert.equal(B.World.goodCount(w, 'silk_sash'), 0, 'and not left in the pack');
  assert.equal(c.look.sprite, 'art:tevax');
});

test('gear warnings: a worn or broken weapon, and arrows running out for a bow-carrier', () => {
  const w = fresh();
  const [beren, lorc] = World.party(w);
  assert.deepEqual(C.gearWarnings(beren), []);
  const sword = beren.weapons.find((x) => x.id === beren.wield);
  const max = Items.weaponMaxDurability(sword);
  sword.durability = Math.floor(max * B.CONFIG.gearWarn.weaponWorn);
  assert.equal(C.gearWarnings(beren)[0].kind, 'worn');
  sword.durability = 0;
  assert.equal(C.gearWarnings(beren)[0].kind, 'broken');
  assert.deepEqual(C.gearWarnings(lorc, 30), [], 'plenty of arrows');
  assert.equal(C.gearWarnings(lorc, 2)[0].kind, 'arrows');
  assert.match(C.gearWarnings(lorc, 0)[0].text, /No arrows/);
});
