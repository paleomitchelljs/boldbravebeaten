# Prototype dungeon 1: the temple (after the Temple of Cazic-Thule)

From the user's voice memos of 2026-10-24, quoted where the wording matters. Status (2026-10-24): courtyard 1, the wall top, the labyrinth and courtyard 2 with the pyramid, the sewers, the ritual chamber and the palace (both floors and the stair down) are built (HANDOFF §3). §0 overrides
§1 where they differ. The questions in §2 are answered; the build order is §5.

## 0. Decided since (the user, 2026-10-24)

- **One dungeon first.** "The second prototype dungeon will come later after we try this one." The Undercroft and the
  Barrow are to be "archived or saved for testing only". Do that once courtyard 1 is playable, so the game always has a
  dungeon: move them to a test-only place file the tests and sims still load, and start the game at the temple.
- **Courtyard 1** is "a flat grassy area surrounded by sandstone walls, and those walls have wooden doors leading to the
  other areas". It should be
  "large enough for about 4 separate encounters despite being wide open (guards at the entrance, guards at the door to
  the labyrinth, guards at the palace, and a central encounter). Since it's open, these might spill and connect."
- **Wells** "are mostly drop downs, with the only 'way out' being the one by the entrance (that can be climbed) and via
  the ritual chamber". So the courtyard well stands near the entrance and climbs both ways; the labyrinth and pyramid
  wells are one-way drops.
- **The gatehouse, not a platform.** "There should just be steps on either side of the entrance that lead to the top of
  the wall over the entrance which has a small guard house where the well is. So it's an area 'above' the entrance and
  'on' the courtyard walls." How to build that on a flat grid: §3, *Elevation*.
- **The ritual chamber** "has a one-way entrance from the sewers (falling down into the shallow water) and the stairs
  to/from the palace". So the way out of the deep levels is the palace stair, back through the palace to the
  courtyard. Landing in water: no falling damage (my suggestion), unlike the pit trap.
- **Getting there.** No outer world yet: "this is a demo dungeon so they just appear at the entrance", as with the
  Undercroft and the Barrow. The west door out returns to town as their exits do now.
- **Layout confirmed** as drawn below: palace east of courtyard 1, labyrinth south, courtyard 2 east of the palace,
  entered from the labyrinth's east end.
- **No servants' level.** "Let's just have the servants quarters be the upstairs of the palace, and we can have a few
  small rooms branching off from the stairs down." So the palace's second floor is the denizens' and servants'
  quarters, and the stair down from the great hall's niche runs to the ritual chamber with a few small rooms off it.
  The palace has no way into the sewers: the sewers' ways in are the three wells (gatehouse, labyrinth, pyramid).
- **The avatar of fear is a fight.** The ritual chamber is a boss arena: about 15×15, the pool in the middle.
- **Who lives where:** "Alligators and rats in the sewers, lizardfolk throughout." The lizardfolk are the
  **Suracayl** (the user, 2026-10-28), a faction of their own, with "a population of Suracayl in every area":
  | Area | Who (monster key; colour by the encounter's `sprite`) |
  |---|---|
  | Court | warriors, green and tan (`scaleward`: "the alligator lizard variants populate the rest of the courtyard"); two temple gorillas guard the palace door (`templeGorillaPair`) |
  | Wall | a tan warrior in the guardhouse |
  | Labyrinth | skinks, black and purple with yellow eye rings (`suracaylSkink`), in twos and threes; raptors (see below) |
  | Pyramid court | varanus, blue, black and brown (`suracaylVaranus`); the dread shaman with two varanus on the top (`dreadShaman`; "the dread shaman (when done) should guard the top of the pyramid", in place of the drake) |
  | Sewers | two skinks hunting rats (`hunter`), with the alligators and rats |
  | Palace | warriors; Jabiku on the throne with a skeleton guard (`jabiku`: "Jabiku should be in the Palace on the Throne with skeleton guards") |
  | Palace upper floor, stair | warriors (and the kobold servants, the iron golem) |
  | Ritual chamber | the Avatar alone (open question: the user asked for Suracayl in every area) |
  Sims (`node tools/encounters.js`, the level-1 example party): skinks are a nuisance to an armored party (four of
  them start to hurt), varanus pairs are a real fight (93% won, 0.7 dead), gorillas grind (5 rounds, no deaths), the
  pyramid top is 77% won with 1.3 dead, Jabiku's throne 50% with 2.2 dead (two skeletons made it 3%: skeletons are
  the hard counter to points and blades, and Jabiku raises the fallen).
- **Raptors in the labyrinth** (the user: "I'd like raptors in the labyrinth too but those sprites aren't done so let's
  just plan that"). The two raptor packs already placed (`raptors`, `raptors2`) stay; their PixelLab sprite (Raptor,
  96 px) has no clips and is to be regenerated (`assets/ideas/character-animation-plan.md`, *Later*). When it is, give
  it walk, strike, death and idle like the rest. In the sims raptors are harmless to the armored example party (0.03
  dead a fight), like the skinks; whether that is right is a design call (they suit an unarmored party, or a chase).
- **Style target.** The PixelLab dragonborn (`art/characters/pixellab/Tevax_Thaukori/Idle/rotations/south.png`, 64 px)
  is "the level of NPC detail and style that I ultimately think we're aiming for, so the tiles should be generated to
  match". That settles the tile size at **64 px** (reasons in §4).

## 1. What the memo asks for

**Surface (level 1)**
- *Entry and first courtyard.* "The entryway through a wooden door with high, light, tan, slightly yellowed sandstone
  walls ringing the courtyard, snake motifs and lizard mosaics are on the walls." Ground: "ferns and green plants
  growing through broken, small sandstone bricks." Walls: "large sandstone brick walls with the snake and lizard
  mosaics, overgrown with jungle plants like vines." "Roughly square, very large"; the entry is on the west side.
  Steps either side of the entrance lead up onto the wall over it, to a small guardhouse with the well (§0). The palace entry is on the east side; "on the
  South side of the courtyard are doors that lead into the labyrinth".
- *Labyrinth.* "Where the occupants of the city temple largely reside in a twisting set of cul-de-sacs and dead ends."
  "Carved stone that's been worked", "that same light tan, though damper and a little darker". "It should twist with
  curves, rather than sharp right angles, and have a complex route with many bifurcating and intersecting passages."
  A well (to the sewer). "On the far east side of the labyrinth should be a door that leads to another large
  courtyard."
- *Second courtyard and pyramid.* "Approximately the same size as the first." The same walls and ground, but the ground
  "forms only a rind around the outside"; "a large step pyramid" fills the rest. "Four tiers". You enter "from the
  labyrinth on the south end of this courtyard". Route up: tier 1 stairs in the north-west corner, tier 2 in the
  south-east, tier 3 in the north-west, tier 4 "centrally located on the south face", and "at the top of it is a very
  small altar. With another well going down."
  Built (2026-10-24) with every stair on a south face instead (the user: "a single, well-matched set of north-south
  stairs and use those at all levels"): west end, east end, west end, middle.
- *Palace, ground floor.* Entered "from the first courtyard through an arched and decorated doorway", past statues into
  a long chamber; "a great hall with a throne room", "several side chambers", stairs up to a second floor. "In a niche
  on the first floor off the great hall" a stairwell down (to the ritual chamber, §0).
- *Palace, second floor.* "The living quarters of the denizens of the temple", and the servants' quarters (§0).

**Underground**
- *Sewers (level 2).* "Beneath all of the dungeon", reached by the well in the gatehouse, the well in the labyrinth and
  the well at the top of the pyramid (the memo's fourth way, the palace's basement steps, was dropped in §0). "Dark gray stone, and natural
  stone, for the most part carved in organic twists", with "rank water, slimy water" in "shallow channels", "stone
  walkways around the edges and many plank bridges crossing those waters. The plank bridges should be the only
  passable way." The sewers lead to the space beneath "where the palace and the pyramid would be. So not directly under
  either, but kind of in the space between them".
- *Ritual chamber (level 3, the deepest).* Below the sewers. "The stairway from the palace should lead directly to this
  ritual chamber"; "the sewers should let you drop down into the ritual chamber from above". "About a quarter of the
  size of the main courtyard", "a large room with a pool of water in the center", draining down from the sewer above,
  and an orb with the avatar of fear inside (see §2, question 4).

**Plan view as I read it** (north up; the memo doesn't fix the palace and second courtyard as neighbours, see §2)

```
        +-----------+-----------+-----------+
        |           |           |  court 2  |
 entry  |  court 1  |  palace   |  pyramid  |
 (W) -> |  grass    |  2 floors |  4 tiers  |
        |  steps up |           |           |
        |  to gate- |           |           |
        |  house +  |           |           |
        |  well     |           |           |
        +--doors----+-----------+---door----+
        |              labyrinth             |
        +------------------------------------+
   below everything: sewers; below the sewers, between the palace and the pyramid: the ritual chamber
```

## 2. Questions (answered 2026-10-24)

All answered; the answers are in §0. Sizes as I proposed them, unless they look wrong in play:
- courtyard 1 about 28×28 inside the walls, with four guard posts about 10 squares apart: entrance, labyrinth door,
  palace door, centre. A group notices an unhidden party at 4 squares (`noticeDistance`), and a fight is played on a
  15×10 slice of the map.
- courtyard 2 about 32×32: a 2-square rind around a 28-square pyramid, each tier 3 squares in from the last (28, 22,
  16, 10), with a small altar on top.
- the ritual chamber about 15×15, a quarter of courtyard 1 by area.

**The places**, each a map in `data/places.yaml`:

| Place | Ways in and out |
|---|---|
| Courtyard 1 | west door (arrive; out to town), steps up to the wall top, south door to the labyrinth, east door to the palace |
| On the wall (gatehouse) | steps down to courtyard 1; the well, climbable both ways, to the sewers |
| Labyrinth | north door to courtyard 1; east door to courtyard 2; a well, a drop to the sewers |
| Courtyard 2 and the pyramid | south door to the labyrinth; the well on the altar, a drop to the sewers |
| Palace, ground floor | west door to courtyard 1; stairs up; the niche stair down |
| Palace, upper floor | stairs down |
| Palace stair (a few small rooms) | up to the palace; down to the ritual chamber. It could be part of the ritual chamber's map |
| Sewers | the gatehouse well (climb up); the drop into the ritual chamber |
| Ritual chamber | the fall from the sewers (in only); the stair up to the palace |

The labyrinth and courtyard 2 could share one map if the size allows, which would let a fight at the door between them
spill across.

## 3. What the engine can't do yet

**Built 2026-10-24**: tilesets per place, ground letters (water, bridges, grass, rubble, steps), one-way drops, fights
that draw in nearby groups, and courtyard 1 with the wall top as option A below (see HANDOFF and `docs/DATA.md`). Still
to build from this list: the raised layer (option B, if wanted) and the labyrinth generator. What follows is the
original list.

Checked against `data/places.yaml`, `docs/DATA.md` and `src/ui/game/mapview.js`. Each is a code change, small unless
noted.

- **Terrain.** A map knows wall, floor, door and rock. The temple needs:
  - water that blocks walking (but not sight, missiles or flyers);
  - bridges you can walk over water;
  - grass or rubble floor drawn differently from flagstone;
  - pyramid tier edges, which block like a wall but are drawn as a step face.
  
  This would be a `terrain` legend kind, or new map letters with a fixed meaning. Fights would need to respect it too:
  the arena takes walls from the map, so water and bridges would carry over into battles.
- **A tileset per place.** The renderer draws one tileset in 16-px cells. Every place already has a `look` (colours,
  torch), so `look.tileset` is the natural field, with each tileset saying its cell size. This is the biggest of these
  changes.
- **One-way links.** The validator wants every staircase paired. The drop into the ritual chamber (and the wells, if
  labyrinth and pyramid wells) need a `drop` kind with no return, with optional falling damage like the pit trap's.
  The validator's reachability check also has to allow areas you can only leave by another route.
- **Curves.** The map is a square grid, so a curved passage is a stair-stepped diagonal. A wang tileset (the kind
  PixelLab makes) rounds the corners, which goes a long way towards "organic twists". True curves would need a
  different map model; I don't recommend it.
- **Elevation.** There is none. The pyramid doesn't need it: each tier is a ring of floor walled off from the next,
  with one stair square through. It reads as a climb only if the tier faces look like steps, which is an art question.
  The gatehouse does need it, because the walk on top of the wall crosses over the entrance passage, and a flat grid has
  one square per place. Two ways to build it:
  - *A. A separate small place, "On the wall"*: the two sets of steps are a pair of stairs up to a map of the wall top,
    the guardhouse and the well. Works with today's engine. But guards up there can't join a fight in the courtyard or
    shoot down into it.
  - *B. A raised layer in the courtyard map*: squares marked raised, reached only through stair squares. Below, fighters
    can't strike up at them, but missiles and spells can reach, and the guardhouse can be drawn over the gate. The two
    or three squares directly over the entrance passage would need two levels each (the passage beneath, the walk
    above). This touches movement, the arena, line of sight and the AI's pathing: the largest change on this list.
  
  I recommend A for the prototype and B later, if archers on the wall turn out to matter. With A, the guardhouse guards
  are a fifth encounter, upstairs, and the climbable well is the reason to go up there.
- **Fights that spill and connect.** Each encounter is its own fight now: nothing pulls a nearby group in. For the open
  courtyard, a fight should draw in any other group that would notice it (within its notice range of the fight, or
  inside the arena slice), arriving on a later round from where it stood. Medium-sized change in `src/game/explore.js`
  and the battle setup; it also makes noise a reason to fight quietly, which serves sneaking.
- **Big maps.** A 30×30 courtyard is about three times the area of the current maps. Exploring should cope; check the
  minimap and fog draw at that size.
- **Labyrinth layout.** "Many bifurcating and intersecting passages" with dead ends is tedious to type as strings. I
  can write a one-off generator in `tools/` (winding passages, loops, dead ends, kept fully reachable) whose output is
  pasted into `places.yaml` and hand-edited. The map stays data. Fights in narrow, winding passages cramp long weapons,
  which suits the setting.

## 4. Art to generate (PixelLab), by area

**Tile size: 64 px.** (I suggested 32 earlier, before the style target was set; 64 is the better fit.) The rule
that decides it is that tiles and figures should show pixels of one size on screen. The target figure is drawn on a
64-px canvas and stands about 62 px tall and 51 wide.
- With 64-px tiles at the same pixel size, a figure fits its own square, slightly taller than wide, which suits a game
  where each fighter holds one square and reach is counted in squares.
- With 32-px tiles at the same pixel size, a figure is two squares tall and 1.6 wide, overlapping its neighbours in a
  shield wall. Drawing the tiles at 2× to fix that makes their pixels twice the size of the figures', the mismatch we
  have now.
- PixelLab already makes 64-px wang tilesets: the two in `assets/wip/temple-tileset/` are 5×4 sheets of 64-px tiles.

Costs:
- A square becomes 64 screen px instead of 48 at 1×, so the 15×10 battle slice is 960×640.
- The current 16-px tiles and creature sheets will look coarse beside the new ones until replaced. That's acceptable
  while prototyping.
- `height` in `data/art.yaml` (1.4 squares for Tevax now) drops to about 1.0 for a figure on its own canvas.

**Matching the target's style:** a strong dark outline, 3–4 tones per colour, flat shading lit from the upper left,
moderate saturation. Tiles should use the same pixel size and light direction but softer contrast and no black
outlines on the floor, so figures stand out from the ground. Put this in every prompt and pass the target image as
the style reference where the tool takes one.

Tilesets are wang tilesets between two terrains, top-down. Props are map objects on a transparent background, in the
"low top-down" view the PixelLab characters use. The two sandstone tilesets in `assets/wip/temple-tileset/` predate
the style target: try them first, and regenerate if they don't match the dragonborn.

| Area | Tilesets | Props and special tiles |
|---|---|---|
| Courtyard 1 | flat grass, with ferns and plants through broken small sandstone bricks ↔ sandstone wall ("light, tan, slightly yellowed") | wall faces with snake and lizard mosaics (2–3 variants), vines, ferns, wooden doors (west, south, east), steps up the inside of the wall (both sides of the entrance) |
| Wall top (gatehouse) | sandstone wall-walk ↔ parapet or drop | small guardhouse, a well with a rope or rungs, crenellations |
| Labyrinth | worked stone floor ↔ wall, "damper and a little darker" | rounded corner pieces, door, well, rubble, bones, urns |
| Courtyard 2 | as courtyard 1 | step-pyramid tier face (top-down and side), stairs in four facings, a very small altar, well |
| Palace | carved interior floor ↔ wall | arched and decorated doorway, statues, columns, throne, banners, braziers, beds, cots and tables (upper floor: living and servants' quarters), a niche with a stair down |
| Palace stair rooms | plain worked stone, darker going down | cots, tables, barrels, a long stair |
| Sewers | "dark gray stone, and natural stone" ↔ "rank water, slimy water" | stone walkway edge, plank bridges (both directions), drain grates, the three well shafts (one with rungs), the hole down to the ritual chamber |
| Ritual chamber | dark stone ↔ shallow pool water | dais, the orb with the avatar of fear inside, the drain or shaft you fall from, the stair to the palace, ritual objects |

These temple props also stand in for the Cute Fantasy props the published site may not show: chest, stairs, traps,
urns, statues.

## 5. Build order

Each step ends with something walkable, to look at in the browser before the next.

1. **Engine: a tileset per place (64-px cells) and the terrain kinds.** Mostly code, testable with placeholder tiles.
   Done first so generated art lands somewhere real.
2. **Courtyard 1 alone**, with its four guard posts and fights that draw in neighbours; then archive the Undercroft
   and the Barrow (§0). One map, one tileset, the doors, the mosaic walls, the steps up to the wall top and its
   guardhouse and well (a separate place, §3), a few props. This is
   the trial of the whole pipeline: prompt → PixelLab → `assets/wip/` → cut → `art/` → `look.tileset` → seen in play.
   Fix what it shows about scale and style before generating the rest.
3. **Labyrinth**, with its generator, and lizardfolk in it.
4. **Courtyard 2 and the pyramid**, with the red drake or the skeletons.
5. **Sewers**, with water, bridges and the drop links; alligators and rats.
6. **Ritual chamber** and the avatar of fear, as a boss fight.
7. **Palace** (both floors and the stair rooms) last: the most props, and the least new in engine terms.

Placing the sewers before the palace is a choice: the sewers test the new terrain hardest, and they tie the three
wells together. Swap them if the palace matters more to you.
