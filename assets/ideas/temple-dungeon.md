# Prototype dungeon 1: the temple (after the Temple of Cazic-Thule)

From the user's voice memo of 2026-10-24, quoted where the wording matters. Status: plan, nothing built. The open
questions in §2 come first; the build order in §5 assumes the answers I recommend there.

## 1. What the memo asks for

**Surface (level 1)**
- *Entry and first courtyard.* "The entryway through a wooden door with high, light, tan, slightly yellowed sandstone
  walls ringing the courtyard, snake motifs and lizard mosaics are on the walls." Ground: "ferns and green plants
  growing through broken, small sandstone bricks." Walls: "large sandstone brick walls with the snake and lizard
  mosaics, overgrown with jungle plants like vines." "Roughly square, very large"; the entry is on the west side.
  Stairways north and south "lead up to a raised platform with a well". The palace entry is on the east side; "on the
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
- *Palace, ground floor.* Entered "from the first courtyard through an arched and decorated doorway", past statues into
  a long chamber; "a great hall with a throne room", "several side chambers", stairs up to a second floor. "In a niche
  on the first floor off the great hall" a stairwell down to the servants' quarters.
- *Palace, second floor.* "The living quarters of the denizens of the temple."

**Underground**
- *Servants' quarters* (below the palace), which "lead further down to the deepest level".
- *Sewers (level 2).* "Beneath all of the dungeon", reached by four ways: the well in the first courtyard, the well in
  the labyrinth, the well at the top of the pyramid, and the palace's basement steps. "Dark gray stone, and natural
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
 (W) -> |  platform |  2 floors |  4 tiers  |
        |  + well   |           |           |
        +--doors----+-----------+---door----+
        |              labyrinth             |
        +------------------------------------+
   below everything: sewers; below the sewers, between the palace and the pyramid: the ritual chamber
```

## 2. Questions for after the restart

1. **"The two prototype dungeons."** The memo describes one. What is the second? Do the two replace the Undercroft
   and the Barrow, or sit beside them? How does the party get to the temple from Stonebridge (a road exit, as the Barrow
   has)?
2. **Where things sit in courtyard 1.** The memo says the stairs are "north and south" and the palace entry is "on the
   north and east side". I've read it as a central raised platform with stairs on its north and south faces, the palace
   on the east, the labyrinth on the south. Is that right? And is the second courtyard east of the palace, as drawn?
3. **The servants' stair.** The memo has the palace's basement steps going to the sewers, and also a stairway from the
   palace leading "directly to this ritual chamber". Are these the same stair (palace → servants' quarters → sewers, with
   a separate way down to the ritual chamber), or does the servants' stair skip the sewers? My suggestion: servants'
   quarters → a locked or hidden stair straight to the ritual chamber (the back door), plus a door into the sewers. The
   drop from the sewers is then the front door, one-way.
4. **The ritual chamber's centre.** The memo's audio garbled here ("Draining down from the sewer above the day. Orb of
   it with the avatar of fear inside"). My reading: water drains from the sewer into a central pool, and above the pool
   (or on a dais in it) is an orb with the avatar of fear inside. Is the avatar a fight, something sealed, or a choice?
   This decides whether the room needs a fight arena.
5. **Wells.** Climbing down a well into the sewer: is it two-way (a rope or rungs, so you can climb back) or a drop?
   Is the drop into the ritual chamber one-way (you can't climb back up)?
6. **Who lives where.** The creatures we've prioritized are skeletons, rats, lizardfolk and drakes. A guess: lizardfolk
   in the labyrinth and palace (warriors, shamans, a chieftain on the throne), rats and slimes in the sewers, skeletons
   in the servants' quarters or the pyramid, the red drake on the pyramid or in the second courtyard, the fae drake
   somewhere unexpected. Corrections welcome.
7. **Size.** "Very large" in squares: the current maps are about 25×15. I suggest courtyard 1 at 30×30 and courtyard 2
   at 32×32 (a 2-square rind around a 28-square pyramid, each tier 3 squares in from the last: 28, 22, 16, 10, with a
   small altar on top). "A quarter of the size" of courtyard 1 is then 15×15 by area (or 8×8 if you meant a quarter of
   the side; 15×15 fits "still a large room" better).

## 3. What the engine can't do yet

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
  they're drops) need a `drop` kind with no return, perhaps with falling damage like the pit trap's.
- **Curves.** The map is a square grid, so a curved passage is a stair-stepped diagonal. A wang tileset (the kind
  PixelLab makes) rounds the corners, which goes a long way towards "organic twists". True curves would need a
  different map model; I don't recommend it.
- **Elevation.** There is none, and the pyramid doesn't need it: each tier is a ring of floor walled off from the next,
  with one stair square through. It reads as a climb only if the tier faces look like steps, which is an art question.
- **Big maps.** A 30×30 courtyard is about three times the area of the current maps. Exploring should cope; check the
  minimap and fog draw at that size.
- **Labyrinth layout.** "Many bifurcating and intersecting passages" with dead ends is tedious to type as strings. I
  can write a one-off generator in `tools/` (winding passages, loops, dead ends, kept fully reachable) whose output is
  pasted into `places.yaml` and hand-edited. The map stays data. Fights in narrow, winding passages cramp long weapons,
  which suits the setting.

## 4. Art to generate (PixelLab), by area

Tilesets are wang tilesets between two terrains, top-down, one cell size for all (I suggest 32 px: room for mosaic
detail, and drawn at 1.5× where the 16-px tiles are drawn at 3×). Props are map objects on a transparent background,
in the "low top-down" view the PixelLab characters use. Two 64-px sandstone wang tilesets are already in
`assets/wip/temple-tileset/` (grass-covered ground with weathered sandstone; moss-covered sandstone). Use them as a
style reference, or regenerate them at the chosen size.

| Area | Tilesets | Props and special tiles |
|---|---|---|
| Courtyard 1 | jungle ground ("ferns and green plants growing through broken, small sandstone bricks") ↔ sandstone wall ("light, tan, slightly yellowed") | wall faces with snake and lizard mosaics (2–3 variants), vines, ferns, wooden door, stairs, raised platform edge, well |
| Labyrinth | worked stone floor ↔ wall, "damper and a little darker" | rounded corner pieces, door, well, rubble, bones, urns |
| Courtyard 2 | as courtyard 1 | step-pyramid tier face (top-down and side), stairs in four facings, a very small altar, well |
| Palace | carved interior floor ↔ wall | arched and decorated doorway, statues, columns, throne, banners, braziers, beds and tables (2nd floor), a niche with a stair down |
| Servants' quarters | plain worked stone | cots, tables, barrels, stair |
| Sewers | "dark gray stone, and natural stone" ↔ "rank water, slimy water" | stone walkway edge, plank bridges (both directions), drain grates, the four arrival points |
| Ritual chamber | dark stone ↔ pool water | dais, the orb with the avatar of fear inside, drain from above, ritual objects |

These temple props also stand in for the Cute Fantasy props the published site may not show: chest, stairs, traps,
urns, statues.

## 5. Build order

Each step ends with something walkable, to look at in the browser before the next.

1. **Answers to §2** (questions 2, 3 and 7 at least).
2. **Engine: a tileset per place and the terrain kinds.** Mostly code, testable with placeholder tiles. Done first so
   generated art lands somewhere real.
3. **Courtyard 1 alone.** One map, one tileset, the door, the mosaic walls, the platform and well, a few props. This is
   the trial of the whole pipeline: prompt → PixelLab → `assets/wip/` → cut → `art/` → `look.tileset` → seen in play.
   Fix what it shows about scale and style before generating the rest.
4. **Labyrinth**, with its generator, and lizardfolk in it.
5. **Courtyard 2 and the pyramid**, with the red drake or the skeletons.
6. **Sewers**, with water, bridges and the drop links; rats and slimes.
7. **Ritual chamber** and the avatar of fear.
8. **Palace and the servants' quarters** last: the most props, and the least new in engine terms.

Placing the sewers before the palace is a choice: the sewers test the new terrain hardest, and they tie the four
entrances together. Swap them if the palace matters more to you.
