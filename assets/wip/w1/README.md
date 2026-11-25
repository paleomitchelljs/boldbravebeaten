# W1 open world: the first tiles (2026-11-24)

Seventeen PixelLab pro top-down sets (64 px, high top-down, 25 generations each) for the gaps in `TILES_TO_GET.md`'s
W1 section, in its order. Generated, fetched and wired into the `w1` tileset (see the end).

    sh fetch.sh [name...]    # sets in ids.txt -> sheets/<name>.png and .meta.json

Every set is chained to existing art through its base tiles, so the shared grounds match exactly: the lake-country
grass is the west's (base 6cb738b4, checked pixel-identical in every sheet that has it), the water is the lake
country's (63daef8f), the jungle floor (9571a5ef) and swamp water (9a937a3e) are the jungle set's, and the canopies are
the jungle's (caa70d97) and the vale's forest (6e7a824e). Two new bases came out of this round and are reused: beach
sand 2ae2c281 and jungle mountain rock 5c9bf4aa.

| Set | Id | Lower -> upper | Kind | Fixes (TILES_TO_GET W1 item) |
|---|---|---|---|---|
| beach | 3e88e48b | lake water -> pale golden sand, a wet strip with surf | flat | 1, coast |
| sea | 345676bd | deep navy sea -> lake water | flat | 1, the sea told from the lakes |
| jbeach | b245e3f6 | swamp water -> beach sand, a mud strip | flat | 1, the jungle's coast |
| dune | 7837223a | beach sand -> grass | flat | 1, sand inland of a beach |
| jdune | 420a5e06 | beach sand -> jungle floor | flat | 1, the same in the jungle |
| jcanopy | e129d368 | grass -> jungle canopy, a wall of trunks | cliff | 2, jungle in grassland places |
| floorgrass | ea7a50aa | jungle floor -> grass | flat | 2, grass in jungle places |
| jforest | c480e965 | jungle floor -> temperate canopy, oak trunks | cliff | 2, forest in jungle places |
| jhill | 4f627f52 | jungle floor -> a lighter rise, an earthen bank | cliff | 3, jungle hills |
| jslope | 76da5771 | jungle floor -> mossy mountain rock, a cliff | cliff | 3, jungle mountains |
| jring | ddf52533 | mountain rock -> a higher, paler shelf | cliff | 3, the mountain's next ring |
| ford | 4e18a9bf | lake water -> a shallow ford over sand and stones | flat | 4, rivers |
| reeds | a489e0fb | lake water -> grass, a reedy bank | flat | 4, river banks |
| savanna | ba5400d0 | grass -> dry gold grass | flat; toned to olive-gold in the repo (2026-11-24: saturation ×0.8, hue +0.03, value ×0.86, so it reads as dry grass, not a yellow mat; a re-pull undoes it) | 5 |
| marsh | 703c117b | bog moss and pools -> grass | flat | 6 |
| redrock | 754b4f69 | grass -> red clay mesa, a banded slope | cliff | 8, the labyrinth's rock |
| basalt | 16725d75 | grass -> black basalt, a cinder slope | cliff | 8, Exeomo's rim |

The prompts are in each sheet's `.meta.json`. Their shared style line: "clean flat colour areas, no speckle noise, bold
stylised 16-bit JRPG pixel art" for the lake-country side, "chunky 16-bit RPG pixel art ... flat cel shading with three
tones, simple bold shapes" for the jungle side (the jungle set's own wording).

## Faults to fix by hand before use (free pixel edits)

- `jdune`: a thin yellow rim where the sand meets the jungle floor.
- `sea`: the deep water came out indigo rather than navy; shift its hue toward the lake water's.

## Wiring (done, 2026-11-24)

All of the open world's places draw from one tileset, `w1` (`data/tilesets.yaml`), with copies of these sheets (and their
`-cut` sheets, `python3 tools/cutsheet.py`) in `art/worldtiles/w1/`. A terrain may have `also` sheets, one a lower
ground, chosen per corner (`src/ui/game/tilemap.js`), so the beach sits over sea, lake or swamp water and grass over
water, a river, sand, the jungle floor, bog or moss. The generator (`tools/worldgen.js`) gives each square its region's
letters, so grassland and jungle run into each other inside a place and across its edges. `redrock` is not used: the
labyrinth and the desert's outcrops are `redcliff` (a 2x2-block cliff over sand), made in the same pass.

## The art pass of 2026-11-24 (budget 1000 generations; spent 161 by the balance)

| What | Id | Generations |
|---|---|---|
| `redcliff`: beach sand -> red sandstone cliff (tall, 25 tiles) | 8936ed17 | 25 |
| `moss`: jungle floor -> shady mossy grass, the band between the jungle and the grassland | 58e04ddd | 25 |
| `grassmoss`: mossy grass -> the lake-country grass | 609b31f9 | 25 |
| Map objects (`objects/`, cut into `art/worldtiles/w1/props.png`): oak, pine, thicket, meadow clump, broad tree, thorn tree (and a first try), ferns, bones, grass tuft, flowering shrub, wildflowers (and a first try) | see `ids.txt` | 11 |
| `gslope`: grass -> rough weathered granite, a craggy bank (the grassland's mountain, `#`; it replaces the vale's flagstone `orc-slope`, which read as paving across the south) | 8e2537c8 | 25 |
| `gledge`: granite -> a higher crag of pale boulders (`(`; replaces `ring1`) | 7659b4cb | 25 |
| `gsummit`: crag -> a summit of pale rock and old snow (`?`; replaces `ring2`) | 9788cee6 | 25 |

Free pixel edits in the same pass: `savanna` toned from saturated gold to olive-gold (see its row above).

The moss band: brown floor -> moss -> bright grass, two squares of moss on the jungle's side and one on the grass's.

## The art pass of 2026-11-25 (spent 177 by the balance: 7905 -> 7728)

| What | Id | Generations |
|---|---|---|
| `streamgrass`: stream -> grass, a narrow bank (the shallows' banks in the grassland) | 79f111d2 | 25 |
| `streamfloor`: stream -> jungle floor | 11b6478e | 25 |
| `streamlake`: lake -> stream (a stream running into a lake) | 8347666e | 25 |
| `streamswamp`: swamp water -> stream | b54cf28a | 25 |
| `swamplake`: swamp water -> lake (no hard join between the two waters) | bd57c2c1 | 25 |
| `gcliff`: grass -> granite, tall (25 tiles; the open mountains' first rise, `#`) | e488bc0f | 25 |
| `jcliff`: jungle floor -> mossy rock, tall (`▵`) | e57552b2 | 25 |
| Bridge map objects (`objects/bridge_v.png` used, cut into `art/worldtiles/w1/bridge.png`; `bridge_h.png` unused, its wood is another colour) | a3900e28, 72df8a12 | 2 |

Free edits in the same pass: `python tools/grade.py art/worldtiles/w1` (greens desaturated and pulled to olive, every
sheet alike; `graded.json` keeps what is done) and `--calm` on the road and jungle-trail sheets (speckle softened).
Rerun both after `tools/plaingrounds.py` remakes a sheet.
