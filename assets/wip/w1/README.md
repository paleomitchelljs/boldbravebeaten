# W1 open world: the first tiles (2026-11-24)

Seventeen PixelLab pro top-down sets (64 px, high top-down, 25 generations each) for the gaps in `TILES_TO_GET.md`'s
W1 section, in its order. Generated and fetched; **none is wired into a tileset yet** (see the end).

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
| savanna | ba5400d0 | grass -> dry gold grass | flat | 5 |
| marsh | 703c117b | bog moss and pools -> grass | flat | 6 |
| redrock | 754b4f69 | grass -> red clay mesa, a banded slope | cliff | 8, the labyrinth's rock |
| basalt | 16725d75 | grass -> black basalt, a cinder slope | cliff | 8, Exeomo's rim |

The prompts are in each sheet's `.meta.json`. Their shared style line: "clean flat colour areas, no speckle noise, bold
stylised 16-bit JRPG pixel art" for the lake-country side, "chunky 16-bit RPG pixel art ... flat cel shading with three
tones, simple bold shapes" for the jungle side (the jungle set's own wording).

## Faults to fix by hand before use (free pixel edits)

- `jdune`: a thin yellow rim where the sand meets the jungle floor.
- `sea`: the deep water came out indigo rather than navy; shift its hue toward the lake water's.

## Wiring (not done; proposed to the user)

1. **The engine.** A wang terrain has one `over` (`src/ui/game/tilemap.js` planTiles), so sand can sit over sea, lake
   or swamp water but not all three at once. The beach needs a per-neighbour choice of sheet (sand's sheet picked by
   the water below it), or the generator must keep sea, lake and swamp coasts apart.
2. **The generator.** New classes in `assets/world/w1-layout.yaml` and `tools/worldgen.js`: beach (sand behind every
   coast), savanna, marsh, jungle hill and jungle mountain, sea apart from lake.
3. **The tilesets.** Each sheet as a terrain in `w1_wild` or `w1_jungle` (`data/tilesets.yaml`), its class in the
   family's `chars`; then `node tools/worldgen.js assets/world/w1-layout.yaml` to recount `assets/world/w1-gaps.md`.
