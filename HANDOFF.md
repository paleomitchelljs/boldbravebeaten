# To do

Last updated at commit: 5198258

Keep this a short list. Tick things off, add new ones, and refresh the commit line after every push (`git log -1 --format=%h`).

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
  None has attack, hurt or death frames yet.
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
- [x] Opportunity strikes on entering a foe's reach, leaving it, or a second step within it (ruled; sim/FINDINGS.md).
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
- [ ] Social balance has no sim yet (a bot that tries fight / parley / sneak through the Undercroft).
- [ ] Save format has a version field but no migration.
- [ ] More dungeon maps in the new style; the other three are still the old layouts with no scenery props.

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
