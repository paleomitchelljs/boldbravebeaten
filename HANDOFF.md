# To do

Last updated at commit: 0e2cebb

Keep this a short list. Tick things off, add new ones, and refresh the commit line after every push (`git log -1 --format=%h`).

## Hero mode (the user, 2026-11-05)
- [x] A checkbox in the Menu (Play section): `world.hero`, copied onto each party member and companion as `c.hero`
  (`World.syncHero`; `Battle.start` sets it too). Numbers in rules.yaml `hero`: blows by a hero ×1.5, on a hero ×0.5
  (before armor; a spell's magnitude likewise), +2 stamina regen and regen even in a round they were hit. A hero's
  CON stops at 1 in `C.damageAttr`: the blow that would kill knocks out instead. tests/hero.test.js. Sim: three
  ogres kill a normal party (DDDD) and knock out a hero one (uuuu); one ogre, hero party wins in 2–3 rounds unhurt.
  Seen in headless Chrome (the menu).
- [ ] A hero party all knocked out still goes to the game-over screen ("Wake in Stonebridge, lose half your gold").
  Kinder for a child: wake where they fell, no gold lost? Ask the user.
- [ ] Not covered: auras, constriction's stamina, trap and condition damage are not scaled (CON still stops at 1).

## Village people; the mine's new figures (the user, 2026-11-04)
- [x] The start village has a priest (Warden Ysa), a merchant (Guildmaster Pell) and a trainer (the drillmaster) on
  the old placeholder sprites (wizard, rogue, knight). Each opens the town's own service there: legend `services:
  {place, location}` (`Explore.serviceList`; the explore screen shows `UI.TownService` in a card). A person may have
  services and no conversation (the drillmaster). Seen in headless Chrome (the priest's healing card).
- [ ] The Lantern still raises only friends (Friendly, standing 25). Fine for testing? Ask the user.
- [x] Mine: the goblin champion is the user's goblin warlord (lava-orange; was the orc warrior, Kalavar's figure), the
  high shaman the goblin shaman (lava-orange; was the mummy lord). A new monster, the efreeti (a lesser fire spirit:
  burning fists, fire bolts), wanders the lava lake. Walks, strikes and deaths generated for all three
  (assets/ideas/character-animation-plan.md has the ledger). Seen in headless Chrome in a staged fight.
- [x] The fae drake is a familiar (rank I, after the dusk bat and the rat, so the default there): hovers, bites.
  No hero starts with Familiar; seen in a staged fight with it given to Jabiku.
- [ ] Not generated (86 generations left until 2026-11-24): idles for the warlord, shaman and efreeti, the drake's
  death, anything for Tylo (its south view needs fixing first).

## Jungle west of the grassland; the mine tuned down (the user, 2026-11-04)
- [x] The mine (all eight ember_ places): every encounter and wanderer is one foe, not a group (the king alone, the
  efreet alone, one gnome at the bridgehead). Texts rewritten. The groups as designed are at commit 691d44f; a
  TUNED DOWN note in places.yaml says so.
- [ ] Put the mine's groups back when testing is done. Ask the user.
- [x] Jungle art (`assets/wip/jungle/`, art/worldtiles/jungle/, tileset `jungle`): forest floor, marsh, swamp water
  with a muddy bank, a dirt trail, a canopy wall of gnarled trunks; eight 128-px trees with gnarled roots (kapok,
  mangrove, strangler fig, cypress), five of them hung with moss that sways (8 frames, the oak there and back).
  New ground letters `≈` marsh (fight: rough) and `≡` trail. 140 generations.
- [x] A first place to show it: `jungle_west` (The Mire Wood), off the western grassland's road west (was a note);
  its own road west is a note. Props only, no foes. Seen in headless Chrome (east end, marsh); the sway not watched.
- [ ] Shallow and deep swamp water are drawn alike; the canopy's green is loud against the dark floor. Ask the user.
- [x] Trees and decor were too detailed and realistic for the sprites (the user): redone in the sprites' look (thick
  outlines, flat three-tone shading, saturated, max 16 colours), and 16 jungle decor pieces (ferns, toadstools, log,
  reeds, cattails, lily pads...) replace the temple court's ferns. Moss sways on the oak, dead tree and branch; the
  leaning tree is still (two takes redrew its crown every frame). 72 generations. Seen in headless Chrome.
- [x] Ground tiles redone in the same style (the user, a trial for a broader art rework): forest floor, marsh, swamp
  water and bank, trail, canopy wall, drawn fresh from a palette taken from the new trees and decor
  (`assets/wip/jungle/palette.json`). 98 generations (the marsh twice: the first came out teal, like water).
- [x] The first jungle art is archived, not lost: `archive/art/jungle-v1/` (painterly ground sheets and tiles, the
  rejected teal marsh, the painterly trees with their moss frames).
- [ ] The trail ends in a straight edge at the east exit (exit squares draw as plain floor; `on: trail` drew a square
  step instead). A tilemap fix: let exit squares and the ground past the edge take part in corner sets.
- [ ] The broader art rework: the same recipe (style words, max colours, a palette from the sprites) for other places?
  Ask the user which first.

## Death leaves a window (the user, 2026-11-04)
- [x] One who dies in a fight can be called back for three rounds after the round of death (three more turns of
  their own): Restore + Life aimed at the body brings CON up to 1, stops bleeding, and leaves them alive, unconscious,
  at 0 stamina. Then "X is beyond saving now." `CONFIG.magic.revive {rounds, con}`, `Magic.revivable/revive`, the
  round of death stamped as `status.diedRound` (`Combat` markDeaths after each action and at round end). Restore + Life
  lists bodies in the window as targets; the AI values calling one back above waking the downed. Test in rules.test.js.
- [ ] Only a single-target Restore calls back (Wide skips the dead). Town priests still raise the dead at any time for
  gold: should the window be the only way back? Ask the user.
- [ ] Not clicked through in a browser (the body as a target on the battle screen).

## Heroes and the swamp's edge (the user, 2026-11-03)
- [x] Cyrus wears a padded gambeson (torso only; blurb and pitch say so). The Crusader carries his longsword in one
  hand with a heater shield (blurb updated); feats now plate mobility and endurance, shield training, shield bash and
  heavy weapon training (half-swording and murder stroke dropped: they needed two-handed training first). The picker's
  buttons read Begin and Edit Characters.
- [x] Suracayl scales take padded armor's numbers (mit, pierce, cut-through, durability; vital-spot and arrow tables).
  Not simmed (encounter tuning deferred).
- [x] Outdoors, past the map's edge, the edge's own wall runs on (jungle west of the swamp, not the temple wall).
  Seen in headless Chrome at the west exit.
- [ ] Is a full padded suit wanted for Cyrus, not only the chest? Ask the user.
- [ ] `_shot.html` / `_shot.js` are tracked, but `tools/shot.sh` deletes them on every run. Untrack them? Ask the user.

## Block, parry and dodge differ in kind (the user, 2026-11-03)
- [x] Block rebounds a third of the blow's AP off the attacker, parry a sixth (Beat, new feat: +a sixth per rank);
  owed AP come off the next round and bar a whole-turn action. Parry odds by leverage (log weight ratio, toward a
  heater's +3; replaces the force term). A successful parry opens a riposte anyone may take for its AP (Riposte feat:
  free); the attacker may defend it. Dodge: melee only, pays armor's SPD/DEX penalties again, −2 dropped.
  `CONFIG.defense` rebound/leverage/dodgeArmor/dodgeMeleeOnly/riposteOpen; tests; sim/FINDINGS.md.
- [ ] Two-handed still beats sword & shield 68%: the swordsman's AI spends its whole pool on the approach and walks into
  the stop-thrust with 0 AP. Fix the AI's approach (stop at the edge of a longer reach, keep AP to block)? Ask the user.
- [ ] Spell bolts can no longer be dodged (dodge is melee only): only an enchanted shield meets them. Confirm with the user.

## Opportunity strikes inside the edge (the user, 2026-11-02)
- [x] Coming up to the edge of a foe's reach is free; stepping from within it to closer still provokes (a hit holds
  the mover at the square they stepped from), as do leaving it and a second step within it that brings no closer.
  `combat.js opportunities`, the AI's `entryCost` and route pricing, the prompt text; tests rewritten.
- [ ] Duels (sim/FINDINGS.md): mirrors unchanged, but two-handed now beats sword & shield 69% (was 43%) in the open
  and 68% (31%) in close quarters, and rapier & dagger about 80%. Ask the user whether that is too much; the lever is
  to let only the step past the edge provoke.

## New game (the user, 2026-11-02, third set)
- [x] New Game opens the heroes' portraits (`UI.Screens.heroes`, `World.heroes()`: the presets and the recruits, nine):
  pick up to four (in order), then Begin as they are, or Edit them first (`UI.Screens.create`, rewritten): name,
  attributes (each hero's own pool), feats (their level's budget, any feat they can hold; one removed flags those that
  needed it), words for casters, gear (armor, weapon in hand, at the belt, shield, each with an ordinary material).
  The draft lives on `game.draft` (going back keeps the picks and edits). Quick start and Custom are gone.
- [x] Those not picked wait in the village to be recruited (the presets now have home squares and pitches); those
  picked are not there twice (`World.create` marks a spec's `id` recruited). A second weapon made for the off hand
  (a parrying dagger) given as an item spec is held there, as kits did.
- [x] Four recruits listed feats they could not hold (tier rules), silently left out in play. Kalavar reordered;
  Arvir economical block for half-swording; Jadier quick thrust and parry training for flurry and light armor;
  the Crusader heavy weapon training and power swing for plate endurance and resolve. A test now checks every hero.
- [ ] Seen in headless Chrome (portraits at desktop and phone width, the editor); not clicked through in a browser.
- [ ] No blank hero to build from scratch any more (the old level-1 builder is gone). Ask the user if one is wanted.
- [x] Speed: `Explore.grid` joined the whole map to check its cache on every call, so every square looked at (each
  step of a line of sight) cost the whole map. Now it checks the rows' identity first: a fight move's reveal went from
  111 ms to 22 ms, a draw in the mine from 28 to 16 ms (fake DOM, Mac). A fight reveals only for the fighter who moved.

## Fog and edges (the user, 2026-11-02, second set)
- [x] A fight on the map reveals what the party's fighters see after every move (the battle screen's scene, when a
  fighter has moved), not only at round start. A square counts as seen if revealed or a party member stands on it
  (was: anyone), so foes in the dark are not drawn, named on hover, or followed by the camera. Test in
  `tests/ui-node.test.js`. Not watched in play.
- [x] `open: true` places (the nine outdoor ones) are seen whole on arrival (`markSeen`; `ms.allSeen`). The temple
  court is left dark (walled, with sneaking); ask the user.
- [x] Ways out on a map's edge (stairs, or a road's-end note drawn as nothing; `Explore.exits`) have their ground run
  on three squares past the edge (`sc.outside`, `sc.margin` lets the camera look there); outdoors the land past the
  edge is drawn as the place's wall instead of black. A click past the edge walks to the nearest way out within three
  squares; a click on a way out with a party member standing on it walks there instead of opening the sheet. Seen in
  headless Chrome (grassland east road, village north road); the clicks not tried in a browser.
- [ ] Followers still cluster onto an exit square when the leader stands beside it (only drawn there; harmless now).

## Art pass (the user, 2026-11-02)
- [x] Venril (its own art) rules the palace from the throne; the party's Jabiku stood in there.
- [x] Front-on props: buildings, the village's things, the vales' tents and engines redrawn facing the viewer square
  to the grid, medieval (`art/worldtiles/front.png`, `assets/wip/front/`, ~75 one-generation map objects). Still
  angled: the bandit tents, the stilt hut, handcart, mine cart. Seen in headless Chrome (village, camps).
- [x] Lava moves: one seamless surface 8 squares a side, 24 frames (flow, roiling crust, bubbles), drawn each frame
  under the cached ground; the rock's edge comes from a cut sheet; now and then a spurt (`anim`, `cut` in
  tilesets.yaml; `assets/wip/lava/build.py`, all code). Seen in headless Chrome (still frames only).
- [x] Campfires that burn (small, logs, bonfire, cauldron; `assets/wip/fire/`). Camps in the grasslands: orc and
  bandit (west), gnoll and minotaur (east). Props only: no foes placed (encounters wait for tuning).
- [x] The temple court is a lizardfolk village (two kinds of hut, fires, fish racks, urns, nests, totems, an idol);
  goblin clutter in the warrens and the hall (not solid).
- [x] Doors for the mine's three walls, each side, plain and locked, plus the hall's portcullis
  (`assets/wip/doors/`, ~200 generations). Engine: `door_locked_<side>`, a legend `sprite` per side, a doorway beside
  another no longer counts as open floor. Seen in headless Chrome (castle, jail, hall, gnome fort).
- [x] Traps move: blade (pendulum), spikes, fire vent, pit (`art/worldtiles/traps.png`, `assets/wip/traps/`; a trap's
  `sprite`). The stair blade seen in headless Chrome (one frame).
- [ ] Not seen moving in a browser: lava, spurts, fires, traps (screenshots are single frames). Not seen on the phone:
  lava-anim.png is 650 KB.
- [ ] The jail's cell doors open west (the map routes each cell out through the square beside its door), so they draw
  as strips, not faces. A map change if the user wants faces.
- [ ] Other tilesets' doors (temple sewer and ritual have no doorways today; the outdoor sets draw none).

## Phone
- [x] Home-screen app: manifest, icons (`art/icons/`, from the user's bear-and-wren medallion, which is also the title-screen logo and, as `bear-wren-badge.png`, the favicon), `sw.js` (network first; the Pages build lists
  every file in `precache.txt` and the worker fetches them in the background), saves exported through the share
  sheet on touch screens. Registration checked in headless Chrome; the background fill and the iPhone itself are
  not yet checked.
- [x] Fight effects: only spells and shots fly; every melee blow (a reach weapon's thrust at 2 squares too) lunges
  with the figure's strike frames. A shot plays the archer's strike in place, then a drawn arrow flies (45 ms a square).
- [x] Figures blinked out for a few frames on the phone when they turned a new way (each PixelLab frame is its own
  file, fetched lazily). Now `Sprites.warm` asks for a figure's standing views, walks and idles when it is first drawn
  (blows and deaths once it has a fight bar), and `drawArt`'s `hold` redraws the last picture until the new one lands.
  Not yet seen on the iPhone.
- [x] Walks were jerky: the frames ran on the clock (90 ms each, whatever the speed) and each figure dropped to its
  standing pose for a frame or two between path steps (a step every 150 ms, the glide 125 ms). Now a walk's frames
  follow distance walked (`stride` in art.yaml, default 2 squares a cycle) and the walk holds 120 ms through the
  pause. Exploring is now a walk, not a run: a step every 220 ms, gliding at 5 squares a second (`STEP_MS`, `GLIDE`
  in explore.js). Fights still glide at 9. Not yet seen on the iPhone; stride and pace may want tuning by eye.
- [x] Camera surged once a step (it eased toward the leader's square, which jumps). It now moves with the leader's
  glide, easing only across big jumps or when the focus passes to another figure. Not yet seen on the iPhone.
- [x] Fight routes walked through lava. Now nobody walks into lava (the user, 2026-11-02): `Terrain.costMap` never
  enters visible deadly ground unless the walker flies; only a shove or fall puts someone there, and they can walk
  out. Other visible hazards are detoured round (`Terrain.avoid`, DETOUR 50) when possible, and a move onto or across
  one needs one more tap/click naming it (`declareMove`). Tests in `tests/lava-paths.test.js`. Not tried on screen.

## The fire-goblin mine (prototype dungeon 2; the user, 2026-10-31; plan and status in `assets/ideas/ember-mine.md`)
- [x] Eight places (`ember_*` in `places.yaml`), laid out by `assets/wip/ember/layout.py`: the winding stair with the
  murder hole and the blade trap, the gallery over lava, the great hall, the warrens (seams, a pit trap to the efreet's
  pit), the lava lake on stepping stones, the barracks, the gnome fort, the castle loop with the seam to the king's
  rooms, the jail. From town or the title's second quick start (`start.yaml starts`).
- [x] Engine: lava (`$`), stone bridge (`)`), stair steps (`/`), murder hole (`'`); `locked` with `see` and
  `opensWhen` (the portcullis); a `trap` with `to` is a pit. Lava's numbers are PROVISIONAL.
- [x] Monsters, factions (`cinder_goblins`, `deep_gnomes`), three gnomes to talk to, the quest `ember_king`. Art is
  stand-in (the plan's §3 lists the figures wanted from the user). Encounter sizes untuned (deferred).
- [x] Tilesets: basalt, lava, masonry and gnome stone (`assets/wip/ember/build.py`; prompts in its README); every
  corner drawable (`assets/wip/ember/rebuild.sh` re-seeds the maps and squares them off).
- [x] Props: 16 from one PixelLab call (`art/worldtiles/ember/props.png`); throne, bed, forge, rubble, portcullis placed.
- [ ] Place the rest (braziers, bar, bunks, tables, carts, ore, winch, racks, cages); a murder-hole tile, stair steps
  and a stone bridge deck over lava (colours today); a look at each place in headless Chrome (props not yet seen).
- [ ] Idle animations for the four new characters (the hooded knight's 8 were queued 2026-11-01 and not yet pulled:
  `node tools/pixellab-pull.js Hooded_Knight`, then add `idle: {anim: Idle, frames: 4, pingpong: true}`); then
  the animation plan's section D.

## Next (the user, 2026-10-31, in this order)
- [x] Spell effects (`data/fx.yaml`, `art/fx/`; PixelLab's effect workbench, free): a bolt in ten colours by spell
  noun, its impact, a fire burst over area spells (other nouns: a large impact), a flame for the wall of fire. They
  replace the git-ignored pack in `art/effects/`, so the published site now shows them. Seen in headless Chrome.
- [x] Item icons (`data/icons.yaml`, `art/icons/items.png`, one PixelLab call of 64 for 10 gens): in the pack, the
  shops, the loot lists, the character sheet (armor by the slot's body part) and on the map for things lying there.
  Goods lose their kind word; the supplies line is icons and counts. Misses to redo: the war scythe (a pickaxe), a green
  antidote. Seen in headless Chrome.
- [x] A button above the map (and V) hides the on-map UI: the dock, the toolbar, the bars and icons over figures;
  remembered in the browser. Seen in headless Chrome on the explore screen.
- [x] Taller walls: on any wall two or more squares thick, the face is raised half a square (its lip and courses drawn
  again over the wall's last row), so faces stand about a head above the figures (`liftFaces` in mapview.js; a
  tileset can opt out with `tallFaces: false`). South and side walls still show only their tops, as a 3/4 view must.
- [x] The labyrinth's passages are three squares wide (`tools/labyrinth.js --wide 3`; seed 7, 10x6, loops 0.05).
- [ ] Other narrow places, if the user still finds them so: the palace stair rooms, the sewer walkways (two wide beside
  the water; the plank bridges are one wide by design). Figures drawn over a side wall's top (a sword reaching over
  the court's west wall) are not changed.
- [x] The user's new raptor (`Raptor_Red`, now the `raptor` art): walk ×8, bite ×5, idle ×5, death.
- [x] The animation plan's cycle 2, the new four: walk, strike, death in 8 directions (idles still to do).

## Outside (the user, 2026-11-01; art and prompts in `assets/wip/outside/`)
- [x] A new game starts in the village (`village`, "Stonebridge"): a green, the inn (its door is the old town screen),
  smithy, shop, cottages, a jungle edge round it. Roads north to the Black Hills (`mine_approach`: basalt, a lava
  channel, the mine mouth in the cliff) and east to the Temple Swamp (`temple_approach`: pools, a paved causeway to
  an arch between two small pyramids). The temple's gate and the mine's stair now lead out to these. Seen in headless
  Chrome. No people, no encounters yet.
- [x] Art: three PixelLab sets chained to the temple's grass (swamp water, dirt path, jungle edge) and 24 props
  (~115 generations). Open ground is plain grass with the court's decor scattered over it.
- [x] The props were drawn steeper (more isometric) than the tiles; the inn no bigger than a cottage. Redrawn front-on
  (see Art pass).
- [ ] A stone bridge deck over lava (the Black Hills and the mine both draw it as flat strips); brick bits left on
  the path's edge tiles.
- [x] The preset party's colour washes (there to tell stock figures apart) are off members with their own art (Cyrus
  was moss green); a save step (version 4) clears them in old saves.

## Tarnhold again, grassland, recruits (the user, 2026-11-01, fifth set; art and prompts in `assets/wip/tarn/`)
- [x] Tarnhold and both vales laid out again as closed-in canyon passes (the user's reference map): roads two wide on
  gravel, a river from a waterfall (animated) under rope bridges, overlooks up stone steps, a loop road, raid debris,
  the fortress and the vale gates built from tiles (towers raised on the wall: `■`, a cliff set over the wall walk;
  `solo` now lets a wall count what is built on it). Trees regenerated at 128 px, drawn at scale 1. Seen in headless
  Chrome (junction, falls, fort gate, overlook, a vale gate, a glade).
- [x] Grassland tilesets (prairie, a rise, the road) and two grasslands beyond the vale gates (`tarn_plains_west`,
  `_east`) with tall grass that sways (animated props: `[.., dx, dy, frames, fps]`).
- [x] Recruits (start.yaml `recruits`): Kalavar, Arvir, Jadier, the Crusader and Spawnee mill about the village (a step
  now and then near home; not saved); bump into or tap one to talk; they take a fallen member's place or fill an empty
  one (`World.recruit`). Tests in `tests/recruit.test.js`.
- [x] Crusader: walk ×8, strike ×8, idle ×8, death (25 generations). Two strike frames flashed white: patched with
  their neighbours (a fresh pull brings them back).
- [x] Kalavar's and Jadier's idles: all five recruits are fully animated.
- [x] The user's new creatures, walk ×8, strike ×8, death (cycle 3 of character-animation-plan.md): Venril (glide;
  its floating idle south), Xalgoz, minotaur, hill giant (a sweep: the fist strike swelled his hands), lizardfolk
  skeleton, grey wolf, lion, grizzly, orc brute, gnoll. In art.yaml under their own keys; no monster uses them yet.
  Flashed strike frames patched with their neighbours (a fresh pull brings them back).
- [ ] Idles for those nine (about 72 generations); the orc's chain-mail and the gnoll's white states unanimated.
- [ ] The overlook top is close to the canyon floor in colour; tower roofs read dark; the waterfall's square is solid
  (stand beside it).

## Walking lag on the iPhone (the user, 2026-11-01)
- [x] Cause: every frame planned and painted the whole visible map (600-950 draw calls, 7-12 ms of script on a Mac,
  several times that on a phone), and every step saved the whole game. Now the ground and walls are painted once
  into chunks of 8x8 squares (mapview.js `groundChunks`; redrawn when `Explore.tileKey` says a door, lock or secret
  changed, or while their images load; idle frames paint the ring outside the view): 15-37 draw calls, 1.3-2.2 ms.
  Seams, raised faces and unseen dark checked in headless Chrome. Not yet felt on the phone.
- [x] The game saves only at a camp, the inn, Rest and repair, on going to another place, when the app is put away
  (`visibilitychange`, `pagehide`; not asked for: a phone may close the page without warning), and from the menu.
- [ ] The Hollin Hills still drop a few frames (6 over 33 ms in a 30-step walk, from 20-31): likely the browser
  rasterising the many large tree sprites.
- [ ] `node --test` takes 5 minutes of CPU but 15 of wall time on this Mac (34% CPU: mostly waiting, cause unknown; the UI test that renders every square of every map is 8 of them). The new outdoor places
  added about 3,700.

## South of the village (the user, 2026-11-01, fourth set; art and prompts in `assets/wip/south/`)
- [x] A road south from the village to the Hollin Hills (`south_hills`): forest groves, low hills, scree, grey mountains
  closing in to a pass four squares wide. The pass comes down into Tarnhold (`tarnhold`), whose gates take the pass
  (north) and the valley road (west, east). The West and East Tarnvales: narrow valleys dog-legging between glades,
  an inn and a tavern in each, a gate wall with two towers at the far end, the road running on to a note at the edge.
  No people, encounters or interiors yet. Seen in headless Chrome.
- [x] Art: nine PixelLab sets chained to one temperate grass, 24 props (~265 generations). Maps by
  `assets/wip/south/rebuild.sh` (layout, squaring, rings).
- [x] Mountains climb in rings (rock, ledge, summit: each a cliff set over the last), not one flat-topped step. Built
  walls run on under the rock at their ends (`underWalls: all`, `solo`, the rock's grass-cut sheet). The gate's north
  join seen in headless Chrome; its south join not yet looked at.
- [x] A figure with its own art draws nothing for a moment while a direction or frame loads, never the stand-in
  (`Sprites.ownArt`). Not watched in play.
- [ ] A grey strip (the tileset's wall) shows past the hills' north edge, above the forest.
- [ ] What lies beyond the two vale gates; people in the inns and Tarnhold.

## The user's notes, 2026-11-01 (second set)
- [x] The Temple Swamp matches the temple: its outer wall (the court's tiles) with the gate in its face, two small
  pyramids of the court's tiers and stairs, jungle round the rest. Seen in headless Chrome.
- [x] Movement halved: a stretch is 1 + SPD/4 squares, unrounded (plate still slows); a round of moving carries the
  presets 3 / 6 / 8 / 13 squares (was 4 / 12 / 12 / 24). Getting away: 4 rounds' running (was 2).
- [x] Duels (`sim/duels.js`, `sim/FINDINGS.md`): median 2 rounds; against the scaleward 4-6. Vigor (blows × 1.25 fresh
  to × 0.75 spent) added; smaller stamina pools tried and not taken (no effect). A read of intent lasts 3 rounds:
  the AI read every round, half a duel's actions. Fights barely shorter; what fills them is reads, moves and shoves.
- [ ] Ask the user what "slow" is in play: rounds, the number of exchanges, or wall-clock (the AI's pauses).
- [x] Title: Continue, Load (saves, or a file), New Game (Quick start in the village, or Custom). The dungeon quick
  starts are gone (start.yaml `starts`).

## Jabiku's words (the user, 2026-11-01)
- [x] Jabiku: the noun Life, the verbs Increase (heals), Decrease (withers), Transfer (withers the target, mends the
  caster), the modifiers Launch (range) and Burst (area; alone round the caster), which stack. New verbs and mods sit
  beside the older ones (Strike, Launch and Burst as verbs, …); nobody else uses them. Tests in `tests/life-words.test.js`.
- [ ] The party lost Jabiku's wall of fire (its way to get away). Give it back to someone, or leave it.
- [ ] Watch the Life words in play: Burst alone aims at your own square (not seen in the browser); Increase and
  Burst in a party fight.
- [ ] Ask the user whether the whole grammar should go this way (verbs as what is done to a noun; delivery as modifiers).

## The AI (the user, 2026-11-01, third set)
- [x] Wind-ups (a bow's draw, a power swing's, a Strong spell's) can be released the same turn if the AP is there, or
  carried into the next round (`windUp.sameTurn`, PROVISIONAL). Every bow is drawn: `draw` in weapons.yaml, shortbow
  1 + 2 AP, longbow 2 + 4. The log says "draws for" a shot. Not yet watched in play.
- [x] The AI no longer reads intent (the player still can).
- [x] Paths go round foes (the rules refused a move whose route ran through one: skinks stood at a canal while an
  archer held the bridge), and an AI closing to blade's reach measures distance as walked, not as the crow flies.
  Probe in `sim/FINDINGS.md` (50 + 42 stuck of 443 starts in the sewer, now 0); tests in `tests/ai-paths.test.js`.
  Not yet watched in play.

## The swamp road (the user, 2026-11-01, third set)
- [x] The Temple Swamp turned: the temple wall runs down its east side, the road from the village goes straight east
  into the gate, and you come into the court still facing east (was: north into the gate, then east in the court).
- [x] The two pyramids are built into the wall either side of the gate; a door at each top leads into the guardhouse
  over the gate (the well to the sewers), through new doors in its north and south walls. Seen in headless Chrome.
- [x] The pyramids join the wall without a seam: tiers marked `underWalls` run on under it, and the wall's edge there
  comes from a cut copy of its sheet (`court-wall-cut.png`, grass transparent). The kinds of tile the place uses are
  listed in `assets/wip/outside/README.md` as a guide for future sets. Seen in headless Chrome.
- [x] A click closes the hover card (on a touch screen a toolbar button's label stayed over the menu it opened).
- [ ] The swamp's art, before tuning this dungeon (the user's priority): what else to refine is open.

## Thrusts and Jabiku's staff (the user, 2026-11-01)
- [x] Beren, Cyrus and Jabiku have a thrust ×8 (`art.yaml thrust`), played for a thrust; a swing plays the strike.
  Lorc (the archer) keeps his shot. 32 generations; ledger in `assets/ideas/character-animation-plan.md`. Not yet
  watched in play (only the frames, on contact sheets).
- [x] Jabiku starts with a staff (the `staff` kit wields one). PROVISIONAL rules so that works: a staff is a casting
  focus (`focus: true`: spells with it in both hands) and jabs with its butt (a blunt thrust, reach 2, 6 against the
  swing's 8).

## The user's notes, 2026-11-01
- [x] Weariness by effort: each point of stamina spent or lost in a round takes 0.25 off the maximum (was 1 a round
  for everyone standing; `sim/effort.js`, `sim/FINDINGS.md`). Spell points already wore by points spent.
- [x] Fights on the whole map (`game.arena.whole`): the camera follows whoever acts, unexplored squares stay dark,
  fighters reveal what they see, and each round a group within `joinDistance` of any fighter (clear line) joins
  (`Battle.reinforce`). Groups not in the fight are drawn where they stand. Fights now run 4.2 rounds (was 3.3) and
  draw in more groups (ember_barracks went to 24 rounds): untuned, as encounter tuning is deferred.
- [x] Shots and spells stopped by a wall fly only to the wall; the aim line stops there; the hover says what blocks.
  The rules already stopped them; only the drawing went through.
- [x] Followers clustered round the leader keep off wall squares. Arrival still puts the leader on the `<` square
  itself, inside a thick wall (the temple court's gate), so it looks like standing on the wall top.
- [x] No start-up flicker: the map stays dark until its tiles and figures' art have loaded or failed (3 s at most).
  Seen in headless Chrome only for the battle; the flicker itself is timing, not checked by eye.
- [ ] With the whole map there is no way to pan the battle view by hand (it follows the one acting).

## Core first (the user, 2026-10-28: core changes before tuning; **no encounter tuning until asked**)
- [x] Time in a dungeon costs something: a step is 10 s (sneaking 20), a search 10 min, the rest after a fight an
  hour. Wanderers are drawn from the place's table every 20 minutes spent there (35%), loud things count as extra
  minutes, a sneaking party can let them pass, a perception check hears them coming (`rules.yaml game.wanderers`).
- [x] Time wears: every awake hour takes 1/32 of fresh stamina off the maximum (half after 16 h), sleep excepted;
  combat weariness shares the cap (now 0.75). `tools/pace.js`: seeing all the temple takes 1013 steps (2.8 h),
  walking every square 4403 (12.2 h); a thorough look with searches should come near a 16-hour day.
- [x] Fight pane: actions are a table (name, AP, stamina) grouped by weapon, not a dropdown; a bow's Draw and a
  power swing's wind-up sit with the weapon's attacks; On hit is three numbers (wound, stamina, armor wear); Armor is
  the piece, its gap odds and Fine/Damaged/Broken; a Next round row when an action leaves you tired (fatigue is taken
  as the next round's pool is set). Blows are "Thrust", "Swing" (the part named only where a weapon has two blows of
  one name). The reaction card is the title, the choices with AP (and a defence's odds) and the AP left.
- [ ] The AI and waiting: in a browser shot (2026-10-28, party surprised, nobody acting) two Suracayl stood off for 8
  rounds; headless (25 runs: party waiting, surprised, or AI-run) they always struck by round 1-5, so it is not
  reproduced. Seen headless: an adjacent foe takes Read intent and then ends its turn without a blow (the read's
  AP check assumes a blow after it, which the defence reserve then forbids). The old case stands: foes whose blows
  can't hurt plate (wolves, bandits) won't close on Beren.
- [x] Groups snowball (docs/REVIEW.md Risk 1): the user chose cover (2026-10-29). A shield-bearer within a square of
  an ally who isn't defending may block for them (block AP and stamina, −1). Probe in `sim/FINDINGS.md`: deaths down,
  wins flat; few covers, since only Beren has a shield.
- [x] Getting away (the user, 2026-10-29): no flee roll, no pause between rounds. At a round's end the party is away
  if no foe can reach striking distance of them within 2 rounds' running and none can shoot or cast at them
  (`Battle.disengaged`); they stay on the map where they stood. Wall of fire (Build + Fire): impassable, Fire 2 to
  anyone beside it each round. Jabiku has Build (one bonus feat). Dry run on the labyrinth golem in `sim/FINDINGS.md`.
- [x] Spell points come back with a rest after a fight; 0.15 of each spent point comes off the maximum until a long
  rest (was half; 2026-10-30, so a caster lasts an area of ~6 fights: 100, 86, 71, 64, 56, 46%).
- [x] Weapon wear halved, a turned point 1.5× a landed blow (was 2.5×), rapier fragility 1.25 (was 2), fractions of a
  point carried (2026-10-30): a rapier loses ~14% a fight to Suracayl scales (was ~57%, broke in two), ~22% to mail.
- [ ] With a rest after each fight, wear no longer builds up against scales (the rest gives 25% back). If wear
  should tell across a day even with rests, lower `afterBattle.restRepairFraction` (0.25).
- [x] Suracayl scales have bronze mail's numbers (P1 S3 B1, burst 1.1; were stronger than iron mail). Materials
  marked `organic` (hide, chitin, bone, wood…) wear a blade at half the rate (`weaponWear.organic`); a rapier loses
  ~8% a fight to the scales, ~22% to iron mail (2026-10-30). Wear is meant to be a danger from metal, not a chore.
- [x] Items: oils worked into the weapon in hand (`coat`: slay damage for N landed blows), books with `text` that are
  read and kept. Golem-bane oil and a journal lie just inside the labyrinth's north door.
- [ ] Use an item in a fight (oil a blade, drink a potion) as an Other action; today it is only from the pack.
- [x] The wall of fire burns as a looping flame (`art/fx/flame.png`); the map's own lava, water and bars no longer get
  outlined marks in a fight.
- [ ] Getting away by running off the edge of the fight's window (today only out-of-reach counts).
- [ ] Cover in the AI's footing: stand a shield beside the ally most at risk (the probe's covers are incidental).
- [ ] An attribute sim: +1 to each attribute in turn against fixed fights, to see what SPD and CON buy over the
  others (CHA, WIS, INT need their settings, not parity).
- [ ] Targeted searches ("inspect the mechanism") as content, now that time costs something.

## Bookkeeping fixes (the user, 2026-10-26; the list and its progress are in `docs/TODO-FIXES.md`)
- [x] 1. Effect-key registry (`src/rules/effects.js`) checked by `validate` (1ebe64d).
- [x] 2. One effect lookup, `Effects.sum/mult/has/list` over traits, gear, conditions and feats (b18e704).
  - Data renames: `regen`→`regrow` (monster), condition `resist`→`resistedBy`, `nimble`→`dodge`, gear `apMult`→`costMult`.
  - `magicImmune` became the keyword `magic`.
- [x] 3. A grapple stored as one link, `status.grapple` on each fighter, written only by `setGrapple` (see TODO-FIXES for why not on the encounter).
- [ ] 4. Harm as a list of entries (deferred until a new damage destination or a keyword boost).
- [x] 5. Save versions (`Save.VERSION` 3, step-by-step upgrades in `save.js`; normalize only fills gaps); supplies move
  out of the pool for a fight and back, never in both (fixed a loss of anything gained mid-fight).

## Look and feel (needs a human eye)
- [ ] Play it on a phone-width screen: stage, dock, toolbar, command bar and sheet have only been checked on desktop.
- [ ] Restyle the parley, title and pack/journal/standing screens to match the pixel theme (they only inherit colours).
- [x] Fights: expected damage through armor is shown in the pane ("On hit") and in the map's hover card for a target.
  Odds that the target's block, parry or dodge succeeds are still not shown (the target's AP is hidden, so any figure
  would be a guess about what they keep back).
- [ ] Click-to-walk and the explore prompts need a pass on touch screens.

## Playability (the user, 2026-10-25: "a pain to play"; streamline, more feedback, less text)
**The town is a debug draft for testing mechanics (the user, 2026-10-25): don't refine its UI, art or text; keep it
working, nothing more.** The shop and trainer changes below were made before that was said; they stay as they are.
- [x] Battle screen: the map on the left, a command pane on the right (under the map below 1000 px, stuck to the
  bottom), sized to the window so Do-it and End turn never need a scroll. Action types are icon tabs (Attack, Maneuver,
  Magic, Move, Other; keys 1-5); action, target and aim stay dropdowns; costs are in the action list; E ends the turn.
- [x] Moving in a fight has no tab (2026-10-30): the squares one can reach are washed faintly on every tab (not while
  an area spell is aimed); hovering one draws the route and its AP; a click puts a silhouette there and the Do-it button
  becomes "Move here · AP"; a second click (or Enter) goes. The provoking rules are under the End turn (i).
- [x] (i) and the map's figures use one hover card (`UI.hover`/`UI.showHover` in `icons.js`) instead of pop-ups and
  the browser's slow title; a tap pins it on touch screens.
- [x] Feedback: a banner across the map at each new round and turn; spent AP pips flash; a hit washes the figure red;
  the click-a-target hint pulses. Seen in headless Chrome at 1280 and 500 px wide (the banner and the hit flash only
  as still frames).
- [x] Town company portraits were drawn at full panel width (a CSS rule meant for the dock); fixed.
- [x] Second pass (2026-10-25): every `title` in the game shows as the hover card (moved to `data-hint` on first
  hover); explore prompts number their actions (keys 1-9, Enter for the main button) and give a check's odds as a
  percentage, its details on hover; the sheet's gear is two columns, and empty slots with nothing to fill them are one
  line; shop, pack and repair rows are one line each (name plus a short tag, the full stats on hover) with a category
  dropdown when a shop has more than six things; the inn, healer, bounty, trainer and supplies explanations and
  faction blurbs are behind (i) or hover; the Training Yard picks who and which feats from two dropdowns.
- [x] Parley (2026-10-25): topics first, one line each (a mark for their kind, a lock while they are unwilling, why on
  hover); the moves are one grid of buttons (bonus and patience cost on the button, what it does on hover; Appeal and
  Bribe each with a dropdown); the speaker picker sits with the moves; the mood meters flash green or red when a move
  shifts them.
- [x] Less text (the user, 2026-10-31): level-up and faction lines short, Loot (tallied, ×2) not Spoils, the hover
  card is damage and miss chance, spell points a blue bar under stamina, feats free at camp (`campTraining: 0`).
- [ ] Next for the UI (the user's priority, 2026-10-25): character creation, then the title screen. Then the journal. The reaction card was left as it was (already short).

## Art TODO
Where art lives: `art/` is what the game draws (published; see `art/README.md`), `assets/` the scratch pad (raw packs,
ideas, work in progress; see `assets/README.md`). New PixelLab output goes to `assets/wip/` first and moves into `art/`
once it is cut, mapped in `data/art.yaml` and seen in play. The PixelLab MCP server is configured (user scope, not in
the repo); its tools load when Claude Code restarts.

Current goal (2026-10-24): a cohesive-ish set of art for one trial dungeon, the temple. Plan, open questions and build
order: `assets/ideas/temple-dungeon.md`. Priorities: **3. the temple tileset first, then 2. its creatures; 1. new heroes
are deferred** (keep the current heroes for now). Everything else is under *Later*.

**0. Notes for generating (not blocking)**
The art is a deliberate mix while we prototype (the user, 2026-10-24: combine assets now, do art passes later). No
common standard is needed yet. Where it costs nothing, make new PixelLab figures as Tevax was (64 px, low top-down,
mannequin template) so they at least match each other, and save each prompt beside its output. Useful animations:
idle, walk, attack, hurt, death. PixelLab gives 8 directions; the map mirrors 2, so 4- or 8-way facing in
`src/ui/game/sprites.js` is an option if the extra directions seem worth using.

**1. Heroes (four; deferred, current heroes stay for now)**
- [ ] The vampire. No art yet.
- [ ] Beren, the knight. A creature sheet exists (`beren`: idle, attack, side/up/down walk, 2 frames, 150 px); redo it to
  the new standard.
- [ ] A Yuan-Ti. A creature sheet exists (`yuan-ti`: idle and attack only), not mapped to anything; redo it.
- [ ] The red Dragonborn death knight. Tevax (`art/characters/pixellab/Tevax_Thaukori`) is a red dragonborn with
  breastplate, black teardrop shield and silver broadsword: idle in 8 directions and walks, no attack. Either give it a
  death knight's look (darker plate, a two-hander or a rune blade, a deathly glow) or keep it as the base and add the
  missing animations. The prompt it was made from is in its `metadata.json`.
- [ ] Add each to `data/art.yaml` with `party: true` so a party member can pick it.

**Characters are made by the user in PixelLab; never generate or animate them (CLAUDE.md).**
- [ ] **Character fixes and animations (the user, 2026-10-28): `assets/ideas/character-animation-plan.md`** is the
  plan, order and spend ledger (265 gens at the start). Work it top to bottom. Done (all paid steps; 5 gens left): fixes, strikes, deaths and idles for the heroes and monsters (walks fixed,
  strike ×8, death). Engine: `death` clip in `art.yaml` (a fallen figure shows its last frame), `pingpong` idles. Shadows cleared and GIF-cropped outlines restored (f491907). Left: free speck
  fixes (step 7) and a few calls for the user, listed under *Where it stands* in the plan.

**2. Creatures for the dungeon**
- [ ] Skeletons (`skeleton`, used by Skeleton and the squad; idle and attack only, 216×207). A warrior and an archer or
  caster would let the squad read as more than three copies.
- [ ] Rats (`rat`, 77 px, idle and attack; the rat and rat pack). Small and soft beside the tiles.
- [x] Lizardfolk warrior, PixelLab (2026-10-25, the user's export; `art/characters/pixellab/Lizardfolk_Warrior`,
  `lizardfolk-warrior` in `art.yaml`, party-pickable): 8 idle rotations, a 6-frame walk N/E/S/W. Now the Scaleward's look.
  Engine: `walkFrames`, and walk frames on PixelLab's 96-px canvas are cropped to the 64-px figure (Tevax's walk was
  drawn off-centre before this).
- [ ] Lizardfolk, still wanted: an attack (the map shows attack frames during a blow; without one it lunges in its idle
  pose), hurt and death (a fall is a rotated idle now); a weapon and some armor if it is to be the Scaleward (the stats
  give it a warhammer); the south walk barely moves its legs. (The open-mouth smudge on walk frames east 5 and west 1
  was painted over with the closed jaw of the frame before, 2026-10-25.) A temple of lizardfolk wants several: warrior,
  shaman, a larger brute.
- [x] The Suracayl (2026-10-28): the temple's lizardfolk, a faction, in every area but the ritual chamber
  (`assets/ideas/temple-dungeon.md`, *Who lives where*). Warriors (green and tan) in the court and palace, skinks in the
  labyrinth and sewers, varanus in the pyramid court, gorillas at the palace door, the dread shaman (with two varanus)
  on the pyramid top in place of the drake, Jabiku on the palace throne with a skeleton. An encounter's foe can wear
  another art entry (`sprite`), and the map square shows a mixed group mixed.
- [ ] Deferred (encounter tuning): Suracayl in the ritual chamber too (they said every area)? Skinks and raptors are
  harmless to an armored level-1 party in the sims; is that their place? Jabiku has one skeleton guard, not two.
- [x] Default party (the user, 2026-10-28; `data/start.yaml` presets, used by the quick start, every sim and most
  tests): level 3 Beren (plate, longsword, heater; blocks), Lorc (longbow, leather), Cyrus (unarmored; rapier and
  parrying dagger), and Jabiku as the mage until there is one of its own (fire: Strike, Launch, Burst).
- [ ] Open from the default party: there are no archery feats (Lorc is DEX, Perception and conditioning); the party
  mage and the palace boss are both "Jabiku"; in the sims Cyrus dies most (105 of 257 deaths over the temple), Beren
  least (12). Foes that can't hurt plate (wolves, level-1 bandits) won't close on Beren or past him, so a party that
  waits is never attacked (the AI judging its blows worthless; it attacks the others when he is not covering them).
- [x] The temple is the start (the user, 2026-10-28): `start.yaml go`; the title's Quick start and the creation
  screen's example party begin the presets as they are (the editor's copy had dropped their level and gear). The
  Undercroft, the Hollow Barrow, Gallows Cave and the town quests through them are retired to
  `tests/fixtures/legacy.yaml` (merged by `tests/legacy.js` for the engine tests). Stonebridge stays as home.
- [x] The mage could not cast: the magic feats were all `auto: false` (no caster could be made or trained), and the
  preset mage had a two-handed staff (a spell needs a free hand). Implemented magic feats are now in the game; the mage
  carries a dagger; `validate` refuses a preset caster with a two-hander and no Battle Casting. With a mage who casts,
  the temple is easy at level 3 (n=30: throne 93%, Avatar 100%, only the clay and iron golems unbeaten).
- [x] Training at camp (the user, 2026-10-28): making camp offers Train to anyone with a feat to spend, at
  `rules.yaml game.campTraining` x the Training Yard's price (0 since 2026-10-31: free).
- [x] Fights: the target defaults to the foe this fighter last went for, else the nearest; a click switches. A turn
  opens on the tab last used (a caster's first on Magic). Worn or broken weapons and low arrows show as a chip in the
  pane, a tag on the attack, and a mark on the explore dock (`CONFIG.gearWarn`). The log is a scrollable panel under
  the command pane (on a phone, under it in the bottom-stuck block).
- [ ] Ask the user: the town (Stonebridge) stays as home; abandon it too? (Temple difficulty: deferred with encounter tuning.)
- [ ] Phones (the user, 2026-10-28: "optimize for mobile"): seen at 500 px in headless Chrome only. The explore map
  leaves the lower half of a portrait screen empty (it keeps the 15x10 shape); show more rows when tall. Map clicks are
  small at 500 px.
- [ ] Raptor sprite (to be regenerated) for the labyrinth's raptor packs: walk, strike, death, idle.
- [x] PixelLab figures face eight ways (2026-10-25): walking uses the nearest direction the art has walks for
  (`walks` in `art.yaml`), standing uses the eight rotations; in a fight a figure faces its nearest foe (`face` on a
  scene actor), exploring it keeps the way it last walked.
- [x] Second PixelLab batch (the user's exports, 2026-10-25; `art/characters/pixellab/`): heroes Beren (sword and
  shield), Cyrus (swashbuckler; idle only; his south view came out wrong, so `rotations` leaves it out and the
  diagonals stand in) and Spawnee (spellsword), all party-pickable; Skeleton (now the skeleton's look), Alligator,
  Raptor (small by design; idle only; tail redrawn longer in the east/west views on a 96-px canvas), the Golem (80 px)
  as `clay-golem`, `iron-golem` and `stone-golem` (the last two recoloured on load by `recolor` ramps; Stone golem's
  look) and the Avatar of Fear (`avatar`, 128 px, 3 squares tall by design). The duelist foe wears Cyrus. They replace
  the old creature sheets of those names (still on disk, unused; `avatar-of-fear` stays: the trolls wear it).
- [x] Lorc, a gray-skinned orc archer in a blue hood (the user's PixelLab character, 2026-10-27; `art/characters/pixellab/Lorc`, `lorc` in
  `art.yaml`, party-pickable): 8 idle rotations and a 4-frame walk in all 8 directions. No attack (a bow draw) or death yet.
- [x] Spectre (the user's PixelLab character, 2026-10-27; `spectre` in `art.yaml`, not yet worn by any monster): 8 idle
  rotations and a 9-frame float in 8 directions. New `floats: true` in `art.yaml`: the walk plays standing still too.
- [x] Krump, a froglok knight with a rune greatsword (the user's PixelLab hero, 2026-10-27; `krump`, party-pickable): 8 idle
  rotations. Its one animation, a two-footed jump, is in the folder but unused (the sword vanishes in several frames).
  A figure with `walks: []` (Krump, Cyrus) or missing walk frames now moves in its standing view.
- [x] PixelLab library pulled straight from PixelLab (2026-10-28): `node tools/pixellab-pull.js` fetches every folder in
  `art/characters/pixellab/exports.json` (or some) and prints what each export holds; no downloading by hand. All
  existing exports refreshed (Cyrus with its south redraw and a walk; Raptor kept, its tail is hand-redrawn). New in
  `art.yaml`: goblin (green; replaces the creature sheet) and goblin-orange, gowra (replaces the creature sheet),
  gorilla, singe, jabiku, arvir, crusader, lizardfolk-alt, dread-shaman, lizardfolk-varanus, lizardfolk-knight,
  snake-person, warrior-woman, farmer, old-man, bear. Engine: `walk`, `idle` and `attack` clips by animation name,
  from another state's folder if need be (Singe hovers standing and flies moving; the warrior woman's slash and the
  lizardfolk warrior's bite are other states); a clip missing a direction plays its mirror twin; `size: [w, h]`.
- [ ] Wire the new figures to monsters and NPCs (none wears them yet except goblin and gowra by key): e.g. girallon ->
  gorilla?, a kobold -> goblin-orange?, the farmer and old man as town NPCs. The user's call.
- [ ] Attack animations exist for the bear, the warrior woman and the lizardfolk warrior (south only); the lunge is
  400 ms, so 9 frames flash by. A longer lunge for art with an attack clip may read better: look in play.
  None has hurt or death frames yet.
- [x] Bosses and new creatures placed (the user, 2026-10-25). Golems are one body (STR/CON 22, reach-2 fists, tireless)
  differing only in `resist`: clay immune to blunt and fire, weak to slashing (labyrinth dead end, `G`); stone immune to
  slashing and fire, weak to blunt (sewers, at the planks to the drain); iron immune to slashing and blunt, weak to fire
  (palace upper floor, by the masters' chest). All immune to mind and life magic. `golemBody` has `cutThrough: 0` (a
  cut past its hardness bites in; without it clay's weakness to cuts never landed). Raptor packs replace the
  labyrinth's rats; alligators (grapple and roll, as the constrictor) in the sewer channels; the Avatar of Fear
  (level 10, reach-2 claws that sap 5 stamina a landed blow, apMult 1.5, a dread aura of radius 1: my addition, the user
  asked only for the sap and reach) in the ritual chamber, shrunk to 11×10. Lizardfolk height 1.3.
- [x] Damage keywords (the user: every damage source has a type, for boosts and resistances as things grow): one
  `resist` map over P/S/B and spell elements, `Character.damageMult`; conditions carry `type`. docs/DATA.md.
- [ ] Keywords still missing: bleeding, falls, sap/drain stamina; boosts (more harm of a keyword) have no hook yet.
- [ ] Sims (example party, level 1, 40 each): raptor packs 100% (2.8 rounds, almost no deaths: easy), alligator 100%,
  two 90%, stone golem 100% (the party's hammer and turned arrows, now blunt ×1.5), Avatar 58% (1.65 dead a fight).
  Clay and iron golems 0%, but that is the AI: next to a reach-2 foe that hits for 19 it baits from outside its reach
  and never swings (Brenna's swing on clay scores 25 in hitValue and is never chosen). Played by hand they are
  beatable in principle; the AI's caution against heavy hitters wants a look.
- [x] Trial start "Tevax alone (level 8)" on the title screen (`start.yaml` trials; the user, 2026-10-25: a death
  knight, mostly martial, against the dungeon's low-level foes with nothing adjusted): Ebony Mail, Ebony Blade,
  Spellbreaker, the silk sash; 8 martial and 8 magic feats (Raise needs 8 with Battle Casting), so 6 over a level-8
  budget, trial only. Starts in the temple court. AI-played sim, 40 fights each: scaleward 100%, pair 50%, rat pack 98%,
  3 bandits 98%, drake 88%, spectre 85%, constrictor 23% (it pins him), zombie horde 15%, skeleton squad 0% (points
  find gaps). The AI opens with Conjure Shadow (backlash 2-10 stamina) and seldom raises (1 fight in 20 against
  skeletons, 7 in 20 against bandits): its casting choices for a fighter-caster want a look.
- [ ] Large red drake. The Drake monster borrows the `dragon` sheet (idle, attack, fly). Needs walk, fly, breath and
  bite.
- [ ] Fae drake. A `fae-drake` sheet exists (idle and attack) but no monster uses it; it needs a monster in
  `data/monsters.yaml` as well as art.

**3. Temple tileset (prototype dungeon after the Temple of Cazic-Thule): see `assets/ideas/temple-dungeon.md`**
- [x] The plan's questions are answered (§0 and §2: places and their links listed).
- [x] Engine (2026-10-24): a tileset per place (`look.tileset`; `data/tilesets.yaml`: colours, tiles, PixelLab corner
  sheets drawn on the dual grid, props), drawn at cell/16 (64-px tiles: 4×); ground letters (`rules.yaml game.ground`:
  grass, rubble, deep and shallow water, bridges, pyramid steps) that fights keep; one-way `drop`s; `look.ground` and
  `look.light`; fights draw in awake groups within `game.joinDistance` (6, PROVISIONAL; not tuned in play). Findings:
  two posts together 73% won at level 1, all four a wipe.
- [x] Courtyard 1 and the wall top are playable (`temple_court`, `temple_wall`; a town exit, "the temple in the jungle"),
  drawn with the two placeholder PixelLab sandstone sets (copied to `art/worldtiles/temple/`). Looked at
  in headless Chrome: walls, corners, doors, daylight and a fight on the court all draw. Not seen on a phone.
- [x] The placeholder sets are all replaced (`moss-wall.png` removed).
- [x] Courtyard art, first pass (2026-10-24; prompts and palette in `assets/wip/temple-court/court-wall.prompt.md`):
  a new palette (olive and fern greens against the dragonborn's crimson, sun-yellowed tan sandstone, no near-blacks on
  the ground); the court wall as a raised corner set; fern patches (`%`, a second set chained from the same grass); grass
  in three inpainted variants; snake, lizard and vine variants of the wall face (`vary`); door, steps, well, ferns as
  props. Engine: wang sheets take variant tiles (a corner code listed again), stairs take a legend `sprite`, and the
  place's own tileset props win over the stock ones (the tileset door was never drawn). Seen in headless Chrome.
- [x] Court art, second pass (2026-10-24; `assets/wip/temple-court/v2/README.md`): layers. Plain grass, plain loam
  (fern beds, `%`) and plain paving (rubble, `;`), chained from one grass tile so their meandering edges join; a PixelLab
  25-tile cliff set for the walls (small-block faces a square tall, flat tops redrawn as large blocks); the variety from
  `decor` pieces (tufts, ferns, bricks, pebbles, flowers; moss, sprigs, cracks on tops) clumped by noise, and `faces`
  (vines, the snake mosaic) on the wall faces. The wall top has its own set (`temple_walltop`). Engine: cliff sets
  picked by pattern, decor and faces in `tilemap.js`. Seen in headless Chrome.
- [x] Court decor, third pass (2026-10-24, after the user's notes): six kinds of vine on the faces (they had hung
  identically), four more plants with mirroring, no piece repeated beside itself, fewer plants in the fern beds, and the
  patches on the map smoothed (single-square notches made hard angles in the loam). The position hash was a float
  product past 2^53, so a few pieces came up far too often; it uses `Math.imul` now.
- [x] Doors and stairs joined to their walls (2026-10-24, the user: "Doors and stairs need some transition to walls"):
  with `doorsInWall` a doorway is drawn as the wall it stands in, and its door is a picture for the side it opens on
  (a door in the face, or a way through the wall top) inpainted by PixelLab into a render of the real tiles around it,
  so it joins by construction (`assets/wip/temple-doors/README.md`, with the render script). The same for the steps up
  the court wall and the stairwells on the wall top. The gate out is now the gate itself (no stock stairs). Props
  take an offset [.., dx, dy] to fit.
- [ ] Court art, still open:
  - the lizard mosaic came out as a figure: redo it as a face panel; the face mosaics show rarely;
  - the wall-top place's set has dark edge lines and a darker face than the court's; one-square walls between its rooms
    draw odd lips;
  - the jointed tops repeat a 64-px grid; the brick decor is pinkish beside the paving;
  - doors in east and west walls were redone as a passage with the door edge-on across it (they had come out face-on);
    an opened door still shows its closed picture (there is no open one);
    a new doorway means a render and an inpaint for it (the pictures fit their own spot, not any wall).
  - side walls show only their top edge (top-down): fine, but they look thin beside the faced north walls.
- [x] The labyrinth (`temple_maze`, through the court's south door): laid out by `tools/labyrinth.js` (seed 7, 11x7
  cells: two-square passages between two-square walls, a depth-first walk with 10% extra openings, bends rounded) and
  its own damp sandstone cliff set and pieces (`assets/wip/temple-maze/README.md`). A constrictor, a scaleward pair, a
  rat pack and a scaleward in the far dead ends, a cache, a well (a prop until the sewers exist), the east door locked
  "not built yet". Seen in headless Chrome; not played through. `tools/encounters.js` (level-1 party): snake, rats
  and watch 100% won, the pair 97%; easy for a place meant to be where the temple's people live, so it wants more
  or bigger groups once the lizardfolk variants exist.
- [x] Courtyard 2 and the pyramid (`temple_court2`, through the labyrinth's east door; 2026-10-24,
  `assets/wip/temple-pyramid/README.md`), after the user's reference (`assets/ideas/refs/pyramid-court-reference.jpg`:
  tall tiers carved in bands of relief). A 3-square rind of grass round a 28-square pyramid of four tiers; one stair
  design on the south face of every tier, zigzagging west end, east end, west end, middle (the user: "a single,
  well-matched set of north-south stairs ... at all levels"; the slanted flight and the west-face flights are gone),
  its join to the face repainted by PixelLab (a band along its outline, inpainted in place) so it meets the wall set; the altar and a well (a prop until the sewers exist)
  on top. Engine: ground letters `-` `:` `*` `&` for the terraces and `^` (now `rise`) for the risers, drawn as the
  tier they hold up; tileset terrains may copy another's fields (`like`); flat ground draws nothing under raised
  terrain. Each tier is a PixelLab cliff set over the one below (carved face, slab terrace), shaded a step lighter
  going up, with a cast shadow east of each tier. Monster placement and tuning: not wanted for now (the user). Seen in
  headless Chrome.
- [ ] Pyramid, still open:
  - the north and side edges of a tier read only as a rim with a shade change (top-down shows no face there);
  - the altar came out terracotta; every tier face is the same frieze;
  - risers stop sight, so groups on different terraces never join a fight or shoot down (plan §3, option B);
  - the drake on top wins 73% against a level-1 party (left as is; placement and tuning wait).
- [x] The sewers (`temple_sewer`, 2026-10-24, `assets/wip/temple-sewer/README.md`), after the user's references
  (`assets/ideas/refs/sewer-reference-*.jpg`): channels of rank green water, slimed stone walkways that stop on one
  side or the other so the plank bridges are the way through, a square plank deck on posts round the drain to the
  ritual chamber (a prop until that exists). The wells: the gatehouse's now goes down and back up (stairs); the
  labyrinth's and the pyramid's are one-way drops into shallow pools. A cache in an alcove across a channel, a rat nest
  in a dead end. Engine: a bridge whose terrain has a corner sheet is drawn as that terrain (the deck); `apart`
  terrains; flat ground counts the walls as its own again (cliff tiers still don't). Seen in headless Chrome.
- [ ] Sewers, still open: the diagonal stretch of the main channel stair-steps; slime and pipe face pieces show
  rarely; the drain's rim is tan; no alligators yet (the sheet exists, no monster); `render.py` doesn't draw plain
  water (the game does).
- [ ] Style target: the PixelLab dragonborn (64 px). Tiles at 64 px to match (plan §4). The user (2026-10-24) gave a
  red dragonborn knight as the NPC style (`assets/ideas/refs/npc-style-dragonborn-knight.jpg`: dark outline, black
  plate, shield with a dragon's head); creatures and NPCs wait until the dungeon's layout is settled.
- [ ] Archive the Undercroft and the Barrow for tests and sims only and start at the temple: every temple place now
  exists (ask the user first).
- [x] Debug: Menu → Debug → No fights (`world.peaceful`): foes never notice the party and can be walked through, traps
  don't spring, no one comes while you camp. For looking round places and their art (the user asked, 2026-10-24).
- [x] The wall top (gatehouse), after the user: "the sprites are squished, and the walls seem oddly placed making it
  hard to move". Its rooms were 5x2 with the wall faces over half of each; now 7x3, the outer edge one parapet square
  with the dark beyond (rock squares, ' ', are no longer drawn). "Squished" is my reading of the cramped rooms: confirm.
- [x] The ritual chamber (`temple_ritual`, `assets/wip/temple-ritual/README.md`), after the user's reference: rose stone
  walls with niches, teal marble, a square shallow pool with the dais and the orb in it, four small pyramids, the stair
  up to the palace (a prop until the palace exists). The sewer drain is now a one-way drop into the pool.
- [x] Broken wall shapes (the user: "The labyrinth has some odd wall features that look broken"): the cliff sets have no
  tile for a wall stepping down one row at a time or a wall one square thick north-south. `tools/walls.js` lists such
  corners in every tiled place (a test keeps it at none); `tools/squarewalls.js` squares them off by flipping single
  squares or pairs between wall and floor, keeping every way through as it was. The labyrinth (45), sewers (29) and
  wall top (16, redrawn by hand: the guardhouse is now a room beside a long walk, its door in a north-south wall) are
  clean; the courts and the ritual chamber had none. The wall top's wall tops are darkened (`walltop-dark.py`) so they
  don't read as more paving.
- [ ] Ritual chamber, still open: the avatar of fear is a stand-in (a spectre, which beats a level-1 party every time);
  the orb is smaller than the reference's (about two squares); the niche frames came out tan.
- [x] The palace (`temple_palace`, `temple_palace_up`, `temple_palace_stair`; `assets/wip/temple-palace/README.md`),
  after the user's hall and throne references: in by the court's east door, a gallery of statues with four side
  chambers, the great hall (columns, braziers, masks and banners on the walls, the throne on a raised dais: ground `|`),
  stairs up to the living quarters and servants' hall, and in a niche the stair down past a few small rooms to the
  ritual chamber. Every place of the temple is now joined up; the court's palace door opens.
- [x] Mismatched wall tiles, doors not flush, corner-only contacts, small decor (the user, 2026-10-25):
  - the wall picker broke score ties by position, so a wall's end tile (as good by score, one outer square wrong) was
    drawn partway along straight walls as a stray lip; now the tile with fewer wrong squares wins. Every corner in every
    temple place has an exact tile; `tools/walls.js` now lists any inexact corner and the test holds it at none;
  - doors in north-south walls, the palace's way out and the guardhouse door are inpainted into their own walls, seen
    from above edge-on (the palace set now has `doorsInWall`); the palace stair down is a stairwell inpainted into its
    niche (`assets/wip/temple-doors/README.md`);
  - `tools/diagonals.js` lists walkable squares that meet only at a corner (a test holds it at none): three in the
    sewer, where walkway touched the deck ring's corners, are now water;
  - larger statues (about 2.7 squares), stairs up (palace and ritual), masks, banners and ritual niches, sized to the
    wall face.
- [ ] Palace, still open: the wall face is greyer than the reference's sandy plaster; the statues came out golden, not
  sandstone; the narrow doors' passage is grey stone, lighter than the floor; no raised platform along the hall's
  sides as in the reference (only the dais); encounters are scaleward stand-ins. Columns, braziers and the orb were
  left at their size: say if they want to grow too.
- [ ] Monsters: an alligator monster for the sewers (the sheet exists); lizardfolk variants; the avatar of fear as the
  ritual chamber's boss.
- [ ] The temple props also replace the Cute Fantasy props the published site may not show.

**Later**
- Licences: PixelLab output is ours to publish (its terms 3.3) and is committed. The creature sheets
  (`art/characters/creatures`) and the spell effects (`art/effects`) are git-ignored until their licences are confirmed, so the published site shows the Pixel Crawler figure for every
  creature and plain bolts for spells. Credit Pixel Crawler (Anokolisa) in an About screen.
- Pixel Crawler figures (every NPC and fallback): idle and run only, no attack, hurt or death.
- Other creature sheets: two frames each, mostly idle and attack only; no art for wolf, alpha wolf, rust beetle, mirage
  cat or the foe templates (militia, sellsword, brawler, man-at-arms, knight); 17 sheets unmapped; stray divider lines
  on goblin and gowra.
- Walls one square thick draw their cap over the floor row to their north; thicken those walls in the maps if it reads
  badly.
- Outdoor cliff pieces from Cute Fantasy are in `assets/wip/cliffs` (no outdoor map yet).
- Items: no item art; the Pixel Crawler Icons and Weapons folders are unprocessed in `assets/packs/`; icons go in
  `art/items/`.
- Effects: four colour sheets cover every element (light, shadow, spirit, force, mind and the rest fall back to purple);
  no art for areas, ground, walls, wards or conjuring.
- For the eventual art pass: resolutions (16-px tiles at 3x, creature sheets 61-363 px, PixelLab 64 px), frame counts
  (2, 4, 6) and palettes differ between sources; heights and facings in `data/art.yaml` were set by eye.

## Combat after the turn-model change (whole-pool turns, reactions, opportunity strikes)
- [ ] Retune: fights against armed groups got much deadlier (skeleton squad 70% → 27% wins, horde 57% → 13%); see
  sim/FINDINGS.md. Tune the AI's choices first (its defence reserve, defend threshold, moving past reach), then rule numbers
  (parry/dodge cost against attack cost, pool size), never single monsters.
- [ ] The turn budget (pool 6, AP in tenths, swing 4, move 2, contested blocks, armor AP, Quick feats halve at the top
  rank): playtest it. From the sims (sim/FINDINGS.md):
  - the level-1 skeleton squad is now unwinnable (11% → 0%): an encounter-design question.
  The brawler losing most duels to armed fighters (14% → 1%) is realistic and stays (the user's rule: in 1v1, realism
  beats balance; styles get their place from encounters built around them).
- [ ] Reach by motion (swords swing 1 and thrust 2, two-handers 2 and 3, spears 4) and points against armor (burst,
  find a gap, or turned): playtest. Open questions from sim/FINDINGS.md:
  - V4 adopted (gap hits take the pass-through roll, no automatic 10, mail resists 1.3): plate beats mail 92–5 in
    duels, armor order is monotonic. The longsword dominates duels in mail (82%): it thrusts from 2 and bursts iron
    mail; decide whether that is realistic or the sword's reach or punch wants a look (sim/FINDINGS.md);
  - the level-1 party still bleeds a little more in padding than before the pierce rule (rat-nest deaths 0.02 → 0.17);
  - plate spreads glancing blows but not crushing ones (`dissipate: {glancing: 0.5, crushing: 0}`); spreading
    crushing blows too costs maces their place against plate (2–13% in the all-plate sweep);
  - the scythe has no thrust at all ("nearly useless" would need a butt-jab face, which is rules code);
  - the AI does not weigh weapon wear: a rapier fighter keeps thrusting at plate until the blade breaks.
- [ ] Item tags in play: foes roll craft, metal and origin, and shops stock bronze and steel mail and the heavy spear;
  no loot table or shop yet offers an origin, an exotic material or an enchantment (placed by hand only: the
  revenant knight). Add some rare finds.
- [ ] The GM sheet's armor row now has five selects (type, material, origin, craft, coverage); only the fake DOM has
  rendered it. Enchantments show but cannot be edited there.
- [ ] Weapon wear, "Rest and repair" after fights and weariness (−1 max stamina a round until camp) are untested over a
  whole dungeon run; the encounter sim starts every fight fresh. A multi-fight sim would show attrition.
- [ ] The UI shows fractional AP (pips with a half pip, "1.5 AP"); only the fake DOM has run it.
- [ ] AI oddities seen in logs: a sword-and-board fighter drops the longsword for a dagger; everyone reads intent every round;
  archers and mages often draw opportunity strikes backing off.
- [ ] "Always ask" puts a pop-up on every blow at the party (several a round against a group). Playtest; if it drags, add a
  per-character standing order as an option.
- [ ] The GM table's reaction pop-up (gm.html) has only run in the fake DOM; look at it.
- [ ] The design docs (Mechanics Outline, Specifics) still describe passes, guards, the old reach, quality and scale
  armor; update them to the turn model, reach by motion, points against armor and the item tags.

## Magic items, spells, companions (added 2026-10-24; see docs/REVIEW.md)
- [x] The published site never had `assets/` (the Pages workflow didn't copy it): figures were coloured blocks, no tiles. Fixed 2026-10-24.
- [x] Ruled: ordinary shields can't block spell bolts (`CONFIG.defense.blockSpells: false`); Spellbreaker can.
- [x] Waist and two ear slots added (sashes on the waist; Orc Fang Earring and Ivandyr's Hoop in the ears).
- [x] Opportunity strikes on entering a foe's reach, leaving it, or a second step within it (ruled; sim/FINDINGS.md). Revised 2026-11-02: the edge is free, stepping inside it provokes.
- [x] Armor by hit location, step 1: pieces cover locations, unaimed location rolls against mixed armor, carry-through
  for cuts (docs/PROPOSALS.md §2; sim/FINDINGS.md; `sim/locations.js`).
- [x] Step 2: aimed blows and a Location menu beside each attack (default: the best expected location, `AI.bestAim`).
- [x] Step 3: wounds by location (attribute tables, vital odds, disarm, trip, stun), rules.yaml `locations.wounds`.
- [ ] Sim the location numbers (shares, aim penalties, effect odds: all guesses) in duels with mixed harnesses; the
  arena builds wear full harnesses, so they show only the wound tables and the AI's aiming.
- [x] Parry carry-through (the user's idea): a parried swing whose force beats the parrying weapon's carries through,
  weakened; a parried thrust is stopped; the overwhelm term left the parry odds (`CONFIG.defense.parryCarry`).
- [ ] Sim the strong items (all draft): the Flowing Black Silk Sash (×0.8 AP on everything), the Scimitar of Speed,
  the at-will Circlet of Shadow (probably wants charges); Raise + Spirit (revenant) in the gauntlet; companions over a multi-fight run.
- [ ] Magic items use the user's names (the no-published-names rule was dropped). Only `relic_cache` (nested in the barrow, troll and strongbox hoards) offers them; no shop does.
- [ ] Choosing a companion: `c.companionChoice` picks among those on offer, but no screen sets it yet (the last on offer
  is taken). Companions show on the battle map but have no sheet of their own in town.
- [ ] The AI's worth tables for conditions live in `ai.js`; move a `worth` into `CONFIG.conditions` so a new condition
  needs no code.

## Game
- [ ] Magic in play: nouns are scarce (books, creation pick) and the Lore/ritual screen exists only in the GM table.
- [ ] Monsters do not move on the map; fleeing returns you to the stairs.
- [ ] Feats that need rules code outside a fight (tracker, appraise, diagnose, alchemy, light fingers) are `auto: false`.
- [ ] No hiring, restocking vendors, torch resource or hunger.
- [ ] Social balance has no sim yet (a bot that tries fight / parley / sneak through a dungeon).
- [ ] Save format has a version field but no migration.

## Done recently
- Review of mechanics and code (docs/REVIEW.md). Fixed: shoves and throws went through walls; pushes ignored pits,
  runes and fire; any shield stopped spell bolts for free; the bounty factions were in code (now `rules.yaml
  game.bounty`); Raise ignored the body; frightened AI didn't flee.
- Magic items (effects, on-hit, powers with charges; 13 enchantments, 15 worn things), the user's ten worn slots, Acid,
  Charm, Stillness, Veil, Bone, chilling frost, chain lightning, harmful darkness, Delayed, Raise (skeleton, zombie,
  revenant), Conjure + Vine summons, Familiar and Animal Companion, creature art and spell effects.
- The user's armor research: the warhammer's beak bursts iron plate two-handed (steel on a strong power blow); a rondel
  dagger bursts mail; mail passes 1.5× a cut's force as blunt (a greatsword power cut breaks bones through it);
  padding and leather let a heavy cut through; hardened steel protects ×1.5. Padding is assumed under mail and plate
  (the user's ruling: no layering).
- This folder is the git repository (the separate bbb-push clone is gone); commit and push `main` from here.
- Reach by motion (the user's table); points burst armor by punch, find a gap (d10 + ⌊DEX/4⌋ + feats) or are turned
  (blunt, hard wear). Every weapon, armor piece and shield is type + material + origin + craftsmanship + enchantments
  (materials.yaml, origins.yaml, crafts.yaml, enchantments.yaml); armor tiers padded, leather, mail, plate; old saves
  migrate. Plate spreads glancing blows. Rapier in mail 90% → 65% of the weapon sweep.
- Weapons wear (durability by material, quality and fragility; metal armor, parries and blocks wear them; worn weapons
  hit softer, broken ones need a smith). Thrusts wear armor. After a fight, "Rest and repair" or "Press on". Weariness:
  −1 max stamina per round of combat until a long rest.
- The turn budget: pool 3.5 + SPD/2 in tenths of an AP; quick actions 2, a swing 4, a two-handed swing 6, a move 2;
  one big action allowed with an unspent pool; armor adds AP per action; Quick feats halve at the top rank; blocks
  contested; defences cost stamina (block most, dodge none); Bind feat. The log sits under the map.
- Top-down map shared by exploring and fighting; fights are played on a 15x10 slice of the dungeon.
- Turn model: one turn per round spending as much of the AP pool as wanted, every action resolving at once; defences are
  reactions paid from the pool, asked of the player on the map with odds and what the blow would do; opportunity strikes
  on entering a foe's reach, leaving it, or a second step within it. Passes, guards and the held point are gone.
- Five-layer tile renderer (`src/ui/game/tilemap.js`): ground, wall faces, wall caps, decor and doors, entities.
- Walls are a cap row over a one-tile brick face: light only on cap tops facing open floor, dark side shadows,
  caps auto-tiled to merge at corners and T-junctions, finished face ends at gaps, an ambient-occlusion baseboard
  under every face, floor unbroken through doorways, doors in vertical walls drawn edge-on.
- Compact battle screen, character sheet pop-up and character creation with dropdowns and (i) tooltips.
- Fights: targets are chosen (click to aim, click again or Enter to commit); a move shows a phantom and a dotted path;
  guards and self-actions show an icon over the character; resolution shows lunges, bolts and floating results.
