# W1 outdoors: the open world (first draft and an art pass, 2026-11-24)

## What was wrong (commit e008101b)
- The outdoor zones were 24x18 stamps on an abstract grid that ignored W1: Muawi drawn far west (it is the NW coast),
  Barjiy centre-west (it is the SE coast), the Naalda between Iaza and Barjiy (it runs south from Iitanii).
- The older hand-made outdoor maps (village, approaches, tarn plains, orc valley...) existed only to make tilesets.
  All 34 are gone; the dungeons and towns stay, their doors stamped into the new places.

## What it is now
- `assets/world/w1-cells.csv`: the reference world's 0.5-degree cells over W1 (from
  `docs/reference_world/wp16_seed103/world_v2.gpkg`, table `cells`, by `python3 tools/w1cells.py`; that folder is 446 MB
  and kept out of git, the extract is all the generator needs): land, elevation, biome, Strahler order, flow, lake,
  swamp, relief, discharge, aridity (rain over what the sun takes up), temperature.
- `assets/world/w1-layout.yaml`: a grid of 5-degree slots (lon -117.5 + 5c, lat 22.5 - 5r; 13 x 11), each a place of
  40 x 40 squares (8 a degree) where at least 8 continent cells are land: 74 places, ids `bz_<row>_<col>`. One tileset
  (`w1`) for all; regions (grassland, jungle, desert) with their letters, looks and scattered props; a name for every
  slot (the land's own words: its lakes and rivers from the story bible, or the tongue spoken there); and the sites: Shiwgoiwo's green (the inn, the
  smithy, the shop, the recruits' squares), the wolves, the Exeomo caldera (a ring of peaks; the mine and the kobold
  cave in its rim), the temple and its dam, the sarnak blocks on Lake Eyenuma, the orc castle and quarry, the
  minotaurs' labyrinth and the high pass (below), the spectres' island, and the five
  cities' gates. Roads join them.
- The land follows the raster's physiography (2026-11-24): above 0.75 km the eastern plateau is highland (region H: grass,
  pine and birch, stony lake shores, no swamp), its rim an escarpment of rock and hillside where it rises steeply, with
  ways up where it rises gently; swamp only on low, flat, wet land (the north coast's jungle, the big rivers'
  floodplains); the west dry by aridity (dry grass throughout below 0.25, in patches to 0.65; no trees below 0.6);
  first-order streams drawn as wadeable shallows, lakes' outlets drawn, and a waterfall where a river drops 0.4 km or
  more flowing south. The high pass (after Highpass Hold) runs up the Oumombo from the plain to Shiwgoiwo through the
  plains gate and the upper gate, past a ford hamlet, the hub and the junction, a branch east through the old valley gate
  to the orc castle; the minotaurs' labyrinth (after the Gorge of King Xorbb) is cut into the high block south of it,
  loops round two islands of crag and a hook to the lord's den, opening only west onto the plain. Each is a canyon
  sealed by its walls: roads and the settle's ways never cut through them, and a place may be in pieces as long as every
  piece is reached from Shiwgoiwo's across the edges.
- `tools/worldgen.js` reads both and writes `data/outdoors.yaml` (merged over places.yaml by the loader), the gap
  report `assets/world/w1-gaps.md`, and with `--preview out.ppm` / `--json out.json` a picture of the whole world.
  Terrain a square: its region by the cells' smoothed biome shares through a domain warp and a few squares of noise
  (so the jungle's edge comes in tongues, inside places and across their edges), relief interpolated (hills, mountain,
  ledge, summit, each tier wholly on the one below; a range of a few squares is hills), rivers as lines from each cell
  to the cell it flows to (wider by Strahler order, bowed by noise), lakes, swamp, sand along the sea, mossy grass
  between the jungle floor and the grass. Canopy only in masses of eight 2x2 blocks or more (the only shapes its cliff
  tiles fit), notched; open woods of single trees round it; the grassland grass with dry-grass patches and few trees.
  Then canyons (passes and gorges: floors along authored routes, walled with raised rock, the rock re-tiered by its
  distance from open ground), falls,
  the stamps, roads (cheapest path; a river crossed by a ford, a lake by a bridge), and until nothing changes: corners where walkable
  squares touch only diagonally fixed, each place made one piece (a cut-off piece joined to the rest, or flooded if it
  is a scrap by water), every place reached from Shiwgoiwo's across an edge. About 2 seconds.
- Ways across: every pair of walkable squares facing each other over a shared edge is a pair of stairs (`edge: true`,
  `sprite: none`), one letter per side per ground. Stepping onto one asks nothing; a step on, off the map, crosses (a
  toast names the place). `Explore.enter(world, place, at, from)` puts you on the square across from the one you left
  by. Past the edge the map draws the next place's land (`Explore.across`), so the view runs on.
- Levels rise 0.6 a place of distance from Shiwgoiwo (1 to 10). Names: the layout's; a slot without one is named by
  the land and the nearest named place and listed in the gap report (none now).

## Still to do
- Encounters and wandering monsters for the generated places (only the sites have any).
- Art: `assets/world/w1-gaps.md` (the sea, dunes). A new set goes into the `w1` tileset and a region's `chars`;
  regenerate.
- Hand-crafting: a generated map can be edited in `data/outdoors.yaml`, but regenerating overwrites it. Before crafting
  by hand, decide which places are frozen (a `keep: true` slot the generator copies through is the simple way).
- Shedantha (the NE island) and Uvue's corner are outside the extract.
