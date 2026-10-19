// Renders every game screen in a fake DOM and fails on any exception. Not a visual check.
const test = require('node:test');
const assert = require('node:assert/strict');
const fake = require('./fakedom.js');
fake.install();
const B = require('./load.js');
for (const f of ['ui/dom', 'ui/dice', 'ui/views/roster', 'ui/views/battle', 'ui/game/art', 'ui/game/firstperson', 'ui/game/bits', 'ui/game/game', 'ui/game/overlays',
  'ui/game/screens/title', 'ui/game/screens/create', 'ui/game/screens/town', 'ui/game/screens/explore', 'ui/game/screens/parley', 'ui/game/screens/battle']) require('../src/' + f + '.js');
const { UI, World, Explore, Rand, Content } = B;
const Game = UI.Game;
const app = () => fake.doc.getElementById('app');
const find = (sel) => app().querySelector(sel);
const text = () => app().textContent;

function check(label) {
  assert.equal(Game.error, null, `${label}: ${Game.error && Game.error.stack}`);
}
function show(screen, label) {
  Game.error = null;
  Game.screen = screen;
  Game.render();
  check(label || screen);
}
const overlay = (type, data) => { Game.error = null; Game.openOverlay(type, data); check('overlay ' + type); return fake.doc.getElementById('modal-root'); };

test('ui: title and creation screens render, and the example party starts a game', () => {
  Rand.seed(5);
  show('title');
  assert.match(text(), /New game/);
  Game.ui = {};
  show('create');
  assert.match(text(), /Your company/);
  // Every character tab, with and without a caster.
  const st = Game.ui.create;
  for (let i = 0; i < 4; i++) { st.slot = i; show('create', 'create slot ' + i); }
  st.members[0].feats = ['verb_strike', 'casting', 'keen_eye']; st.members[0].nouns = ['fire'];
  show('create', 'caster');
  Game.newGame(World.presetParty());
  assert.equal(Game.screen, 'town');
  assert.ok(Game.world.partyIds.length === 4);
  check('town after new game');
});

test('ui: the street and every location, shop tab, healer and trainer', () => {
  const places = Content.world.places;
  Game.ui = {};
  show('town');
  assert.match(text(), /Beyond the gate/);
  for (const loc of places.stonebridge.locations) {
    Game.ui = { loc: loc.id };
    show('town', 'location ' + loc.id);
    for (const s of loc.services || []) {
      if (s.kind === 'shop') for (const tab of ['buy', 'sell', 'repair']) { Game.ui['shop_' + s.id] = tab; show('town', `${s.id} ${tab}`); }
    }
  }
  Game.world.gold = 5000;
  Game.world.pack.gear.push(B.Items.makeWeapon('longsword', 'fine'), B.Items.makeArmor('mail', 'full', 'standard'));
  World.addGood(Game.world, 'tome_ember');
  Game.ui = { loc: 'forge', shop_forge: 'sell' }; show('town', 'sell with goods');
  Game.ui = { loc: 'forge', shop_forge: 'repair' };
  World.party(Game.world)[0].armor.durability = 1;
  show('town', 'repair with damage');
  Game.ui = { loc: 'yard', trainerTree: 'conditioning' }; World.party(Game.world)[0].level = 3;
  show('town', 'trainer');
  Game.debug = true; show('town', 'trainer in debug'); Game.debug = false;
  Game.ui = { loc: 'lantern_house' };
  World.party(Game.world)[1].status.dead = true;
  show('town', 'healer with the dead');
  World.party(Game.world)[1].status.dead = false;
});

test('ui: talking to everyone in town', () => {
  const w = Game.world;
  for (const id of Object.keys(Content.world.npcs)) {
    Game.talk(id, { type: 'town' });
    check('parley ' + id);
    assert.equal(Game.screen, 'parley');
    const v = B.Parley.view(w);
    // Try each move once through the rules, re-rendering after.
    w.gold = 300;
    for (const m of ['read', 'charm', 'appeal', 'bluff', 'intimidate', 'bribe']) {
      if (w.parley.ended) break;
      B.Parley.move(w, m, { tag: v.allTags[0], steps: 1 });
      Game.render(); check(`parley ${id} ${m}`);
    }
    for (const t of Content.world.npcs[id].topics || []) { if (!w.parley.ended) B.Parley.ask(w, t.id); }
    Game.render(); check('parley after asks ' + id);
    Game.endParley();
    check('after parley ' + id);
  }
});

test('ui: every overlay, and every slot picker on the sheet', () => {
  const w = Game.world;
  Game.go('town');
  const c = World.party(w)[0];
  for (const tab of ['stats', 'feats', 'skills', 'notes']) overlay('sheet', { id: c.id, tab });
  for (const slot of ['main', 'off', 'side', 'shield', 'body', 'ring', 'charm']) overlay('sheet', { id: c.id, pick: slot });
  World.addGood(w, 'sash_quick'); World.addGood(w, 'ring_iron');
  overlay('sheet', { id: c.id, pick: 'charm' });
  overlay('pack'); overlay('map', {});
  for (const tab of ['quests', 'known', 'log']) overlay('journal', { tab });
  World.startQuest(w, 'rats_in_cellars'); World.startQuest(w, 'lost_shipment'); World.startQuest(w, 'crates_for_corvin');
  overlay('journal', { tab: 'quests' });
  overlay('factions'); overlay('menu'); Game.debug = true; overlay('menu'); Game.debug = false;
  overlay('text', { title: 't', text: 'a\nb' }); overlay('loot', { title: 'x', lines: ['a'] });
  Game.closeOverlay();
});

test('ui: exploring: every square of every map renders from every direction', () => {
  const w = Game.world;
  for (const id of ['undercroft_1', 'undercroft_2', 'barrow', 'trollhole']) {
    Game.travel({ to: id, arrive: '<' });
    check('enter ' + id);
    const g = Explore.grid(id);
    // Reveal everything, then stand on each floor square, facing each way.
    const ms = World.mapState(w, id);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) ms.seen[x + ',' + y] = 1;
    let n = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.rows[y][x] === '#' || g.rows[y][x] === ' ') continue;
      if (Explore.cell(w, x, y).solid) continue;
      for (let d = 0; d < 4; d++) { w.explore.x = x; w.explore.y = y; w.explore.dir = d; Game.ui.prompt = null; if (++n % 3 === 0) Game.render(); else { UI.FirstPerson.render(app().querySelector('canvas') || fake.doc.createElement('canvas'), w); } }
    }
    check('walked ' + id);
    Game.world.explore.x = 1; Game.world.explore.y = 1;
  }
});

test('ui: prompts: doors, locks, chests, people, stairs, traps and sleepers', () => {
  const w = Game.world;
  Game.travel({ to: 'undercroft_1', arrive: '<' });
  const stand = (x, y, dir) => { w.explore.x = x; w.explore.y = y; w.explore.dir = dir; };
  // Stairs prompt.
  stand(2, 1, 3); Game.ui = {};
  const ev = Explore.move(w, 0).events; assert.ok(ev.some((e) => e.type === 'stairs'));
  Game.ui = { prompt: { type: 'stairs', def: ev.find((e) => e.type === 'stairs').def } }; show('explore', 'stairs prompt');
  // Locked door prompt, chest prompt, npc prompt.
  stand(18, 11, 2); Game.ui = { prompt: { type: 'face' } }; show('explore', 'locked prompt');
  stand(20, 7, 1); Game.ui = { prompt: { type: 'face' } }; show('explore', 'chest prompt');
  stand(10, 10, 2); Game.ui = { prompt: { type: 'face' } }; show('explore', 'cell door prompt');
  // Encounter prompts, aware and unaware.
  const def = Content.world.places.undercroft_1.legend.r;
  Game.ui = { prompt: { type: 'encounter', x: 9, y: 2, def, aware: true } }; show('explore', 'aware prompt');
  Game.ui = { prompt: { type: 'encounter', x: 9, y: 2, def, aware: false } }; show('explore', 'unaware prompt');
  // Sneaking toggles, search, camp (async), map.
  Game.ui = {}; w.explore.sneak = true; show('explore', 'sneaking');
  Explore.search(w); show('explore', 'after search');
});

test('ui: a battle plays through the real battle screen with the AI on both sides', async () => {
  const w = Game.world;
  Explore.leave(w, 'stonebridge');
  Game.go('town');
  for (const c of World.party(w)) { c.control = 'auto'; }
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (f) => realTimeout(f, 0); // the screen paces itself with timers; hurry it
  try {
    Game.startBattle({ name: 'Smoke test', foes: [{ monster: 'rat', n: 2 }] });
    check('battle start');
    for (let i = 0; i < 4000 && Game.screen === 'battle' && !Game.ui.result; i++) {
      await new Promise((r) => realTimeout(r, 0));
      if (Game.error) break;
    }
    check('battle');
    assert.ok(Game.ui.result, 'the battle ended and was settled');
    assert.match(text(), /Victory|Defeat|No one stands/);
    Game.afterBattle();
    check('after battle');
  } finally { globalThis.setTimeout = realTimeout; }
});

test('ui: the result of a flight, and the game-over screen', () => {
  const w = Game.world;
  Game.screen = 'gameover'; Game.render(); check('gameover');
  Game.ui.result = { result: 'fled', lines: ['x'], loot: [] }; show('battle', 'fled');
  for (const c of World.party(w)) c.status.dead = true;
  show('gameover', 'gameover all dead');
});

// ---- Bench and GM table ----------------------------------------------------------------------------------
test('ui: the bench renders each tab, checks an edit, and runs a small simulation', async () => {
  require('../src/ui/store.js');
  require('../src/ui/bench/bench.js');
  const bench = UI.Bench;
  const get = () => fake.doc.getElementById('app');
  bench.render();
  for (const t of ['content', 'sim', 'tools']) { bench.bench.tab = t; bench.render(); assert.ok(get().textContent.length > 50, t); }
  // A broken edit is refused and leaves the content alone.
  bench.bench.tab = 'content'; bench.bench.file = 'factions.yaml'; bench.render();
  const before = JSON.stringify(Content.world.factions);
  get().querySelector('#bench-text').value = 'a: [unclosed';
  bench.bench.draft['factions.yaml'] = 'a: [unclosed';
  const res = Content.installAll({ 'factions.yaml': 'a: [unclosed' });
  assert.equal(res.ok, false);
  assert.equal(JSON.stringify(Content.world.factions), before);
  // A small sim.
  bench.bench.tab = 'sim'; bench.simCfg;
  bench.bench.simCfg = { foe: 'm:rat', level: 1, n: 3, armor: '', plev: 1, shield: true };
  bench.render();
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (f) => realTimeout(f, 0);
  try {
    const btn = (function find(n) { if (n.localName === 'button' && /Run/.test(n.textContent)) return n; for (const c of n.childNodes) { const r = c.localName && find(c); if (r) return r; } return null; })(get());
    btn.click();
    for (let i = 0; i < 200 && bench.bench.sim.running !== false; i++) await new Promise((r) => realTimeout(r, 5));
    for (let i = 0; i < 400 && !bench.bench.sim.rows.length; i++) await new Promise((r) => realTimeout(r, 5));
  } finally { globalThis.setTimeout = realTimeout; }
  assert.equal(bench.bench.sim.rows.length, 1);
  assert.equal(bench.bench.sim.rows[0].r.n, 3);
});

test('ui: the GM table renders every tab', () => {
  const tabs = fake.doc.createElement('nav'); tabs.setAttribute('id', 'tabs'); fake.doc.body.appendChild(tabs);
  for (const f of ['ui/views/sheet', 'ui/views/enemies', 'ui/views/lore', 'ui/views/rules', 'ui/app']) require('../src/' + f + '.js');
  const gm = UI.app;
  for (const t of ['roster', 'sheet', 'enemies', 'battle', 'lore', 'rules']) {
    gm.state.tab = t;
    gm.render();
    assert.ok(!/Something broke/.test(fake.doc.getElementById('app').textContent), `GM tab ${t} broke: ${fake.doc.getElementById('app').textContent.slice(0, 400)}`);
  }
  const enc = B.Combat.createEncounter('t', Object.keys(gm.state.characters).slice(0, 2), gm.state.characters, 8, 6);
  gm.state.encounter = enc; gm.state.tab = 'battle'; gm.render();
  assert.ok(!/Something broke/.test(fake.doc.getElementById('app').textContent));
});
