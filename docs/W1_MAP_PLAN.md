# W1 outdoors: the open world (first draft, 2026-11-24)

## What was wrong (commit e008101b)
- The outdoor zones were 24x18 stamps on an abstract grid that ignored W1: Muawi drawn far west (it is the NW coast),
  Barjiy centre-west (it is the SE coast), the Naalda between Iaza and Barjiy (it runs south from Iitanii).
- The older hand-made outdoor maps (village, approaches, tarn plains, orc valley...) existed only to make tilesets.
  All 34 are gone; the dungeons and towns stay, their doors stamped into the new places.

## What it is now
- `assets/world/w1-cells.csv`: the reference world's 0.5-degree cells over W1 (from
  `docs/reference_world/wp16_seed103/world_v2.gpkg`, table `cells`; that folder is 446 MB and kept out of git, the
  extract is all the generator needs): land, elevation, biome, Strahler order, flow, lake, swamp, relief.
- `assets/world/w1-layout.yaml`: a grid of 5-degree slots (lon -117.5 + 5c, lat 22.5 - 5r; 13 x 11), each a place of
  40 x 40 squares (8 a degree) where at least 8 continent cells are land: 74 places, ids `bz_<row>_<col>`. Families of
  tilesets by the slot's main biome, names for the slots that matter, and the sites: Shiwgoiwo's green (the inn, the
  smithy, the shop, the recruits' squares), the wolves, the Exeomo caldera (a ring of peaks; the mine and the kobold
  cave in its rim), the temple and its dam, the sarnak blocks on Lake Eyenuma, the orc castle and quarry, the red
  labyrinth, the spectres' island, and the five cities' gates. Roads join them.
- `tools/worldgen.js` reads both and writes `data/outdoors.yaml` (merged over places.yaml by the loader), the gap
  report `assets/world/w1-gaps.md`, and with `--preview out.ppm` / `--json out.json` a picture of the whole world.
  Terrain a square: the nearest cell's biome through a domain warp, relief interpolated (hills, mountain, ledge,
  summit, each tier wholly on the one below), rivers as lines from each cell to the cell it flows to (wider by Strahler
  order, bowed by noise), lakes, swamp. Forest and jungle in whole 2x2 blocks (the only shapes their cliff tiles fit).
  Then the stamps, roads (cheapest path; a river crossed by a bridge), and until nothing changes: corners where walkable
  squares touch only diagonally fixed, each place made one piece (a cut-off piece joined to the rest, or flooded if it
  is a scrap by water), every place reached from Shiwgoiwo's across an edge. About 2 seconds.
- Ways across: every pair of walkable squares facing each other over a shared edge is a pair of stairs (`sprite:
  none`), one letter per side per ground. `Explore.enter(world, place, at, from)` puts you on the square across from
  the one you left by; `game.js` passes `from` when you take stairs.
- Levels rise 0.6 a place of distance from Shiwgoiwo (1 to 10). Names: the layout's, else the land and the nearest
  named place ("Jungle far north of Exeomo").

## Still to do
- Encounters and wandering monsters for the generated places (only the sites have any).
- Art: `TILES_TO_GET.md` (top section) and `assets/world/w1-gaps.md`. Each new set goes into a family's tileset and
  the layout's `chars`; regenerate.
- Hand-crafting: a generated map can be edited in `data/outdoors.yaml`, but regenerating overwrites it. Before crafting
  by hand, decide which places are frozen (a `keep: true` slot the generator copies through is the simple way).
- Shedantha (the NE island) and Uvue's corner are outside the extract.
