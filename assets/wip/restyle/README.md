# The vale restyled (2026-11-10)

The older areas' river, road, granite mountains, mud, scree and forest, made again in the lake country's flat-colour
style (`assets/wip/west/README.md`). The art is in `art/worldtiles/vale/`.

All seven sets were generated 2026-11-10 with PixelLab, pro, 64 px, high top-down, every prompt ending "clean flat
colour areas, no speckle noise, bold stylised 16-bit JRPG pixel art". The six 16-tile sets are in PixelLab's usual
order and the terrain the game names is PixelLab's *upper* in each, so none needs a swapped `corners:` list.

| Set | PixelLab id | Lower | Upper | Becomes |
|---|---|---|---|---|
| river | 762f7959 | river water | grey-brown gravel (bank between) | `river.png` (+ 8 gravel variant tiles in two rows), `river-cut.png`, `water.png`, `water-anim.png`, `gravel.png`, `gravel-1..8.png` |
| road | 40baac84 | the river's gravel | pale cobble road | `road.png`, `road-cut.png`, `cobbles.png` |
| slope | 8fe7d391 | the river's gravel | grey granite mountain top (sloped bank) | `slope.png`, `slope-cut.png`, `granite.png` |
| ring | 7f885809 | the granite top | a higher granite shelf (sloped bank) | `ring1..6.png`, `ring1..6-cut.png` |
| mud | c63104f1 | the lake country's grass | dark pit mud | `mud.png` (+ variant rows), `mud-cut.png`, `mud-plain.png`, `mud-plain-1..8.png` |
| scree | 1bd8f0a2 | the lake country's grass | pale scree | `scree.png` (+ variant rows), `scree-cut.png`, `scree-plain.png`, `scree-plain-1..8.png` |
| forest | d88608b7 | the lake country's grass | forest canopy (a face of trunks) | `forest.png` (25-tile cliff set); its `cliff:` list is in `forest-cliff.txt` |

The shared grounds came out pixel-identical: road's and slope's gravel is the river's, ring's lower is slope's top,
and mud's, scree's and the forest's grass is `art/worldtiles/west/grass.png`. `build.py` still makes them one if a
later fetch differs.

## Build

    sh assets/wip/restyle/fetch.sh                  # the sheets from PixelLab (ids.txt)
    python3 assets/wip/restyle/build.py "$PWD"

`build.py` copies the sheets, crops the plain tiles, draws rings 2–6 from the one ring set (from ring 2 both grounds
are the shelf, each ring 10% nearer a pale blue-grey), then runs `assets/wip/ground/build.py` (gravel, mud and scree
variants; not granite or cobbles, whose facets and joints do not survive moving), `tools/cutsheet.py` on the five
flat sheets and the six rings, and `assets/wip/water/build.py` (the river's water as a `river`).

## Known compromises

- The river's cut leaves a few water-coloured pixels beside the banks; they stay still over the moving water.
  `--near` up to 20 does not remove them.
- Only 4 of the forest's 14 face tiles show trunks; the rest are canopy edge or shadow.
