# Useful assets, TK

The running list of art the game wants and doesn't have yet: tiles, decor, props, figures. Work through it when
PixelLab generations come back. Add a row whenever a map uses a stand-in; strike it (or delete it) when the art lands
and is wired up.

- **Figures are the user's to make** (CLAUDE.md: never `create_character`). They are listed here so the list is in one
  place; animation work on existing figures is tracked in `character-animation-plan.md`.
- Style and size: 64-px cells, the 64-px PixelLab dragonborn as the target (`temple-dungeon.md` §4 has the prompt
  notes). Props face the viewer square to the grid and read medieval fantasy.
- Older lists this one doesn't repeat: the temple's tiles and props (`temple-dungeon.md` §4), the mine's original
  figures (`ember-mine.md` §3).

Columns: **what**; **where** (place, and the legend letter or ground letter that would use it); **now** (the
stand-in); **kind** (tile: a terrain or cliff set; decor: scattered pieces or wall faces; prop: a map object;
figure).

## The fire-goblin mine

### Ground and walls

| What | Where | Now | Kind |
|---|---|---|---|
| Stair steps cut in basalt | `ember_hall` `/` (the way down at G-1) | a flat colour | tile |
| Stone bridge deck over lava | `ember_hall`, `ember_warrens` `)` | a flat colour | tile |
| Murder hole in a basalt wall | `ember_hall` `'` | a flat colour | tile |
| Hewn-stone wall for built rooms inside the caves, joining the basalt at its ends (`underWalls: all`) | `ember_castle`: the gate (G-13), bar (G-14), prison pits (G-16), wizards' hall (G-19), audience chamber (G-23), king's rooms (G-24) | plain basalt | tile |
| Hewn flagstone floor for those rooms | as above | basalt floor | tile |
| A wall's foot standing in lava: a crust rim, as the floor has, to lay along a wall's sides and back (today the lava stops in a straight cut) | `ember_lake`, `ember_hall`, `ember_warrens`, `mine_approach`: every `~` beside `#` | nothing | decor (and a placement rule in `planTiles`) |
| The same for water: a waterline (slime, a dark wet band) along a wall standing in the channel | `temple_sewer` (37 wall squares beside water) | nothing | decor |
| A lava rivulet beside a path (a duct with lava down both sides) | `ember_hall` G-3, the duct from G-1 to G-11 | plain floor | tile or decor |

### Decor

| What | Where | Now | Kind |
|---|---|---|---|
| Fungus beds on ash and guano, hanging moss, lichen | `ember_hall` G-8 (the fungus farm) | a few mushroom props (`k`) | decor |
| Sulphur vents and steaming cracks | `ember_hall` G-2 (the bubbling cavern) | — | decor |
| Painted pictograms on the walls, some defaced; broken statuary in a heap | `ember_hall` G-9 (the war-priests' hall) | — | decor (wall faces) |
| Kobold skulls and hides hung as trophies | `ember_hall` G-6, G-12 | — | decor (wall faces) |
| Drake-skin rugs in half-circles round a throne | `ember_hall` G-12 (the baron's seat) | — | decor |
| Painted war-faces on walls and floor | `ember_castle` G-15, G-17, G-21 | — | decor |
| Rose and violet quartz in the walls, catching the light | `ember_castle` G-21 (the guard post), G-23 | — | decor (wall faces) |
| Sleeping furs and blankets heaped on the floor | `ember_castle` G-18 (the forge), G-22 | — | decor |

### Props

| What | Where | Now | Kind |
|---|---|---|---|
| A lever set into a wall, chain running off | `ember_castle` `w` (the portcullis lever) | no sprite (a note) | prop |
| A narrow pit in a stone floor | `ember_castle` `p` (the prison pits) | the pit trap's sprite | prop |
| A pit under boards weighed down with rock, a rope tied off | `ember_castle` `D` (the harvester pit) | the pit trap's sprite | prop |
| A pillar of quartz-studded rock | `ember_castle` G-23 (eight of them) | none placed (one-square walls don't draw) | prop |
| A crude pillar carved as a goblin holding a pick | `ember_castle` G-24 | — | prop |
| A throne cut from the wall, set with gems | `ember_castle` `T` | the mine's throne | prop |
| A throne of black lava rock | `ember_hall` `z` (the baron's seat) | none placed | prop |
| Windows of orange glaze looking over lava | `ember_castle` G-14 (the bar, north wall) | — | prop or wall face |
| A beaded curtain across a doorway | `ember_castle` G-17a (the patriarch's room) | — | prop |
| Cushions, candles, a platter of sweets | `ember_castle` G-17a | — | prop |
| Poles with rope bridges and platforms overhead | `ember_castle` G-17 | — | prop |
| Carpets, shelves cut in the wall holding jars and slates | `ember_castle` G-19 (the wizards' hall) | — | prop |
| Anvils, bellows, a smelter sunk in the floor | `ember_castle` G-18 (the forge) | the forge (`F`) | prop |
| A wrecked clockwork guardian | `ember_castle` G-21 | — | prop |
| Pallets with furs, trays, an ale cask | `ember_castle` G-22 (the champions) | — | prop |
| Bags of down for a bed | `ember_castle` `e` | the bunk | prop |
| Braziers for the built rooms | `ember_castle` G-16, G-23 | none placed | prop (exists in the basalt set: place it) |
| Already made, not yet placed: bar counter, tables, carts, ore, barrels, crates, winch, racks, cages | the mine (HANDOFF) | — | placing only |

### Figures (the user's)

| What | Where | Now |
|---|---|---|
| Inferno goblin warrior with a longspear | `ember_castle` gate, guard post, forge | the orange goblin, larger |
| Inferno goblin wizard | `ember_castle` G-19 | the mummy lord (high shaman) |
| The patriarch: tall, lean, one milky eye, heavily painted | `ember_castle` `V` | the orange goblin (shaman) |
| The baron: an old goblin, a staff topped with a glowing crystal | `ember_hall` `z` | the orange goblin (shaman) |
| A goblin painted all over as a clockwork man | `ember_castle` `u` | the orange goblin, larger |
| A gnome crossbowman (Watchman Tibb) | `ember_gnomes` `W` | the bald old man at 0.8× |
| The rest of the mine's cast | `ember-mine.md` §3 | see there |

## The orc valley (2026-11-08; assets/ideas/orc-valley.md)

| What | Where | Now | Kind |
|---|---|---|---|
| Mine clutter in grey (picks, ladders, buckets) | `orc_mines` | the fire mine's umber clutter | prop |
| The gold coin over the throne, as a wall piece placed by hand | `orc_castle` throne room | only in the throne's label (the piece is in wall-decor.png, scattered at random) | placing |
| Bigger front-on orc hide tents for the camps | `orc_valley` `h` | the first pass's 62-px tent, small beside the new longhuts | prop |
| An animated waterfall from PixelLab, front-on, grey granite | Tarnhold, the vales, `orc_valley` `A` | drawn from the river's colours (assets/wip/orc2/drawn.py) | prop |
| Small ground details without outlines (pebbles, ruts, twigs) beyond the ones cut from the tiles | the canyon floor, roads | seven gravel bits, twenty-odd road bits | decor |

### Figures (the user's)

| What | Where | Now |
|---|---|---|
| Orc legionnaire (spear, round shield), centurion (mail, longsword) | `orc_valley`, `orc_castle` | the orc |
| The emperor: huge, blue-grey, scale armour, a hammer | `orc_castle` `E` | the orc at 1.35× |
| The prophet (bones, a staff), the emissaries, the warlord | `orc_castle` | the orc tinted; the orc warrior |
| Slaves (human, elf, dwarf), the gnome in the pits | `orc_valley`, `orc_mines` | notes, no figures |
