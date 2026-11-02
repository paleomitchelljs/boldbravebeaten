# Tarnhold, the Tarnvales and the grassland beyond (2026-11-01, second pass)

The user, after a first look: Tarnhold should feel like closed-off mountain passes (their reference: a canyon road
winding between cliffs, a lake, structures in nooks, a keep off the road); roads substantially narrower and less grassy;
waterfalls and rope bridges over rivers; overlooks and alternate routes; gates and towers built into the walls, not
sprites stood in front of them; trees drawn at their own pixel size; tilesets for a rolling grassland with animated
tall grass; wooden barricades and other war debris (both vales are raided often).

Places: `tarnhold` (the pass comes down to a junction; the river falls from the north-east heights past it under a
rope bridge on the east road into a lake; the fortress east of the river, towers on its north corners and either side
of its gate, the keep a tower block in a flagged court; an overlook west of the junction; a loop road round a crag; an
inn in a nook; an army camp below the fort), `tarnvale_west` / `tarnvale_east` (canyon roads dog-legging through
glades with an inn and a tavern, a river from a waterfall crossing on a rope bridge, an overlook with steps, raid
debris along the road, a gate wall with towers either side of the road, a camp and barricades in the gate yard),
`tarn_plains_west` / `tarn_plains_east` (rolling grassland, tall grass in the wind, the road running on to a note).

Maps: `rebuild.sh` (layout.py writes them and prunes unused legend letters; tools/squarewalls.js; ../south/tiers.py for
the rings). Art: `build.py "$PWD" --yaml` makes art/worldtiles/tarn/ and rewrites the props numbers in tilesets.yaml.

## Tilesets (PixelLab pro, 64 px, high top-down)
Gravel canyon floor, base c4c81e36 ("mountain canyon floor of packed grey-brown gravel and dirt with a few small stones
and only sparse little tufts of grass").
- canyon-road (927b21cd), flat: lower the south's cobbles (74ce347f), upper the gravel. The tileset reads it the other
  way up (`corners` swapped): cobbles over gravel, so the gravel can be the river's upper ground.
- river (d85bed1c), 0.25: lower "a fast cold mountain river, deep grey-green water with white foam streaks" (base
  28dc470c), upper the gravel, transition "a rocky river bank of wet grey boulders and pebbles".
- ropebridge (7d31ed1f), 0.25: lower the river, upper "the weathered wooden plank walkway of a rope bridge", transition
  "a rope railing strung along wooden posts". build.py cuts the water out so the deck lies over the river (`apart`).
- canyon-mountain (d16bea65), cliff: gravel under the south's granite top (37105f97), so the ledge and summit rings
  still chain. canyon-mountain-cut.png: the same with the gravel cut away, for the gate walls' ends.
- canyon-fort (c1465b38), cliff: gravel under the south's wall walk (65fe0b74).
- tower (e0e18d6c), cliff over the wall walk: "the flat roof of a square stone tower ringed by crenellated
  battlements". Its roofs came out nearly black; build.py lifts them toward the wall's slate.
- overlook (f524c329), cliff: "the flat top of a raised rock shelf you can walk on" (base 0d00b36e).
Grassland, base 0c3bb2ec ("open rolling grassland, short golden-green prairie grass with a few small wildflowers"):
- grassland-road (b59ad8ad), flat: lower the village's dirt path (30168bad), upper the prairie.
- grassland-rise (0f22cdf4), raised 0.25, step_slope 1.8: a low rise; the lime tops toned down in build.py.

## Props
- War, 64 px (eb30cbab): barricade, palisade, cheval de frise, stakes, burned cart, rubble, spear rack, shields,
  arrows, pavise, brazier, supplies, fallen banner, scorch, ladders (a crossed heap), earthwork.
- War, 160 px (37cfa11c): tent, watch platform, catapult, palisade gate.
- Trees, 128 px (dc4b9941), drawn at scale 1 (the south's 64-px trees at 1.5 mixed pixel sizes): pine, fir, oak, birch.
- Pass and grassland, 64 px (cbb34cdd): two kinds of rock steps, three tall-grass clumps, boulder, rocks, lantern,
  signpost, dead stump, sapling, rope post, dry-stone wall, hay bale, shrine, trough.
- Waterfall, 128 px (12eacea3; the straight fall kept as 48191981), animated with animate_object v3 ("water pouring
  and falling continuously ... a seamless loop; the rocks stay still", 8 frames). The tall grass likewise ("swaying
  gently back and forth in the wind", 8 frames each: 2a80ea11, 7ac26cfa, a41534ce). Animated props are
  [image, x, y, w, h, dx, dy, frames, fps] in tilesets.yaml.

## Known
- The overlook's top is close to the canyon floor in colour; its rim and steps carry it.
- The towers' roofs still read dark.
