// Renders every game screen in a fake DOM and fails on any exception. Not a visual check.
const test = require('node:test');
const assert = require('node:assert/strict');
const fake = require('./fakedom.js');
fake.install();
const B = require('./load.js');
for (const f of ['ui/dom', 'ui/dice', 'ui/views/roster', 'ui/views/battle', 'ui/game/art', 'ui/game/icons', 'ui/game/sprites', 'ui/game/tilemap', 'ui/game/mapview', 'ui/game/bits', 'ui/game/game', 'ui/game/overlays', 'ui/game/charsheet',
  'ui/game/screens/title', 'ui/game/screens/create', 'ui/game/screens/town', 'ui/game/screens/explore', 'ui/game/screens/parley', 'ui/game/screens/battle']) require('../src/' + f + '.js');
const { UI, World, Explore, Rand, Content } = B;
const G = B;
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
  for (const id of Object.keys(Content.world.places).filter((k) => Content.world.places[k].map)) {
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
      for (let d = 0; d < 4; d++) { w.explore.x = x; w.explore.y = y; w.explore.dir = d; Game.ui.prompt = null; if (++n % 3 === 0) Game.render(); else if (Game.ui.mv) Game.ui.mv.draw(n * 50); }
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

test('ui: the temple court: drawn from its tileset at 4x, a drop prompt, and a fight on the court that others join', () => {
  const w = Game.world;
  Game.travel({ to: 'temple_court', arrive: '<' });
  check('enter the temple');
  assert.equal(Game.ui.mv.S, 4, '64-px tiles: the map is drawn at 4x');
  const ms = World.mapState(w, 'temple_court');
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) ms.seen[x + ',' + y] = 1;
  for (const [x, y] of [[2, 15], [15, 15], [26, 26], [29, 2]]) { w.explore.x = x; w.explore.y = y; Game.ui.mv.draw(x * 100 + y); }
  check('walked the court');
  // A drop prompt (the well is one way).
  Game.ui = { prompt: { type: 'stairs', def: { kind: 'drop', to: 'temple_wall', at: '1', label: 'A well' } } };
  show('explore', 'drop prompt');
  assert.match(text(), /no climbing back up/);
  // A fight at the gate with the court group close: they come too, and the battle screen draws the court.
  w.explore.x = 12; w.explore.y = 15;
  const def = Content.world.places.temple_court.legend.g;
  Game.startBattle(Explore.encounterSpec(w, def), { ctx: { x: 6, y: 15 } });
  check('temple battle');
  assert.equal(w.battle.joined.length, 1, 'the group in the middle of the court joins');
  assert.equal(Game.ui.mv.S, 4);
  Game.ui.mv.draw(1);
  check('temple battle drawn');
  w.battle = null;
  Explore.leave(w, 'stonebridge');
  Game.go('town');
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

test('ui: a player-run party is asked to react when a foe attacks, on the map, and the fight goes on', async () => {
  const w = Game.world;
  for (const c of World.party(w)) { c.control = 'manual'; c.status = G.Character.freshStatus(); c.stamina = G.Character.maxStamina(c); for (const k of Object.keys(c.damage)) c.damage[k] = 0; }
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (f) => realTimeout(f, 0);
  let asked = 0, turns = 0;
  try {
    // Foes that can hurt plate: wolves and level-1 bandits won't spend blows on Beren's, and hold off while he screens
    // the rest, so a party that only ends its turns would never be attacked.
    Game.startBattle({ name: 'Reactions', foes: [{ monster: 'koboldBand' }] });
    check('reaction battle start');
    for (let i = 0; i < 6000 && Game.screen === 'battle' && !Game.ui.result; i++) {
      await new Promise((r) => realTimeout(r, 0));
      if (Game.error) break;
      if (Game.ui.reacting) {
        asked++;
        Game.render();
        assert.ok(find('.popcard.react'), 'the reaction card is on the map');
        // Take the first defence on offer half the time, otherwise take the blow.
        const pick = asked % 2 ? find('.popcard.react button.act') : find('.popcard.react button.act.none');
        pick.click();
        continue;
      }
      const end = find('.cmd-foot .end');
      if (end && w.battle && w.battle.enc.phase === 'turn') { turns++; end.click(); }
    }
    check('reaction battle');
    assert.ok(asked > 0, 'at least one reaction was asked of the party');
    assert.ok(turns > 0, 'the party took turns');
  } finally { globalThis.setTimeout = realTimeout; }
});

test('ui: a strike at someone in mixed armor offers a Location, defaulting to the best place', async () => {
  const w = Game.world;
  for (const c of World.party(w)) { c.control = 'manual'; c.status = G.Character.freshStatus(); c.stamina = G.Character.maxStamina(c); for (const k of Object.keys(c.damage)) c.damage[k] = 0; }
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (f) => realTimeout(f, 0);
  try {
    Game.startBattle({ name: 'Aim', foes: [{ template: 'bandit', level: 1, n: 1 }] });
    const enc = w.battle.enc, chars = G.Battle.table(w).characters;
    for (const id of enc.ids) if (chars[id].side !== 'party') { chars[id].armor = G.Items.makeArmor('plate', null, 'average', { covers: ['torso'] }); chars[id].pieces = []; }
    let seen = false;
    for (let i = 0; i < 3000 && Game.screen === 'battle' && !Game.ui.result && !seen; i++) {
      await new Promise((r) => realTimeout(r, 0));
      if (Game.error) break;
      if (Game.ui.reacting) { find('.popcard.react button.act.none').click(); continue; }
      const cur = enc.phase === 'turn' && G.Combat.currentActor(enc);
      if (cur && chars[cur].side === 'party') {
        // Bring the foe next to whoever's turn it is, and render the command panel.
        const foe = enc.ids.find((id) => chars[id].side !== 'party' && G.Character.isActive(chars[id]));
        if (!foe) break;
        enc.pos[foe] = { x: enc.pos[cur].x + 1, y: enc.pos[cur].y };
        const bu = UI.Views.battleParts.bui(Game.ui.bs.app);
        bu.cmd = null;
        Game.render();
        // The game waits for the player to pick a target on the map: pick the foe.
        bu.cmd.target = foe;
        Game.render();
        const sel = find('#cmd-location');
        if (sel) {
          seen = true;
          assert.match(sel.textContent, /Best \(/, 'a best choice');
          assert.match(sel.textContent, /Legs/);
          assert.match(sel.textContent, /bare/);
        } else { const end = find('.cmd-foot .end'); if (end) end.click(); }
      }
    }
    check('aim battle');
    assert.ok(seen, 'the Location menu appeared');
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

test('tilemap: 47-case floor shading; walls are a cap row over a face row, lit only on top; floor runs through doorways', () => {
  const TM = UI.Tilemap;
  const B = TM.bits;
  const seen = new Set();
  for (let m = 0; m < 256; m++) seen.add(TM.canon(m));
  assert.equal(seen.size, 47, 'a corner counts only when both its sides are open');
  assert.equal(TM.canon(B.NE), B.NE);
  assert.equal(TM.canon(B.NE | B.N), B.N);
  const grid = (rows) => ({ w: rows[0].length, h: rows.length, seen: null,
    cell: (x, y) => { const ch = rows[y][x]; return ch === '#' ? { kind: 'wall', ch } : ch === '+' ? { kind: 'door', ch } : { kind: 'floor', ch }; } });
  const at = (list, t, x, y) => list.find((c) => c.t === t && c.x === x && c.y === y);

  // A thick wall over a room: face on the wall square touching the floor, cap on the square above it.
  let p = TM.plan(grid(['#####', '#####', '#####', '#...#', '#...#', '#####']), 0, 0, 4, 5);
  assert.ok(at(p.low, 'face', 2, 2), 'face where the wall meets the floor');
  assert.ok(at(p.high, 'cap', 2, 1), 'cap directly above the face');
  assert.ok(!p.low.concat(p.high).some((c) => c.x >= 1 && c.x <= 3 && (c.y === 3 || c.y === 4)), 'no wall drawn over the room\'s floor');
  // A horizontal run: caps merge east and west, faces have no inner ends.
  assert.equal(at(p.high, 'cap', 2, 1).mask & (B.E | B.W), B.E | B.W);
  assert.equal(at(p.low, 'face', 2, 2).ends, 0);
  // The south wall of the room is seen from above: a cap lit along its top edge only.
  const south = at(p.high, 'cap', 2, 5);
  assert.equal(south.edge, 'light');
  for (const c of p.high) if (c.edge === 'light') assert.ok(!(c.mask & B.N), 'light only where the north is open');
  // Faces never carry a light edge, and floor under a face gets the ambient-occlusion baseboard.
  assert.ok(p.low.every((c) => c.edge == null));
  assert.ok(at(p.ground, 'floor', 2, 3).mask & B.N);

  // A thin wall with a doorway between two rooms: the floor runs through, the face and cap runs stop with ends.
  p = TM.plan(grid(['#####', '#...#', '##+##', '#...#', '#####']), 0, 0, 4, 4);
  assert.ok(at(p.ground, 'floor', 2, 2), 'floor under the door');
  assert.equal(at(p.ground, 'floor', 2, 2).mask & (B.E | B.W), 0, 'no wall shading inside the doorway');
  assert.ok(!at(p.low, 'face', 2, 2) && !at(p.high, 'cap', 2, 2), 'no wall in the doorway');
  assert.equal(at(p.low, 'face', 1, 2).ends & 2, 2, 'finished end on the wall west of the door');
  assert.equal(at(p.low, 'face', 3, 2).ends & 1, 1, 'finished end on the wall east of the door');
  assert.ok(at(p.high, 'cap', 1, 1) && at(p.high, 'cap', 3, 1), 'the thin wall\'s caps stand on the row above');
  assert.ok(!at(p.high, 'cap', 2, 1), 'and leave a gap over the doorway');
  assert.equal(at(p.high, 'cap', 1, 1).mask & B.E, 0, 'the cap ends at the doorway (side shadow, not a light)');
  assert.ok(p.decor.some((c) => c.t === 'door' && c.x === 2 && c.horizontal));

  // A vertical wall: its caps run north-south and merge; its sides are shadow, not light.
  p = TM.plan(grid(['#####', '#.#.#', '#.#.#', '#.#.#', '#...#', '#####']), 0, 0, 4, 5);
  const col = p.high.filter((c) => c.x === 2 && c.y >= 1 && c.y <= 2);
  assert.equal(col.length, 2);
  for (const c of col) { assert.equal(c.mask & (B.E | B.W), 0, 'open sides'); assert.equal(c.edge, null, 'no light on a cap with cap to the north'); }
  assert.ok(at(p.low, 'face', 2, 3), 'the wall\'s foot shows a face');
  assert.equal(at(p.low, 'face', 2, 3).ends, 3, 'finished on both sides');
});
