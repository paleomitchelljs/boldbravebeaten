# South of the village: the Hollin Hills, Tarnhold, the Tarnvales (2026-11-01)

The user: south of the starting village, rolling forested hills that lead up to grey stone mountains; at the far south a
narrow pass into a series of twisting narrow valleys opening into small glades with inns and taverns; a fortress in the
pass; the road through the valleys east-west with a fortified gate at each end, the road clearly going on.

Places (data/places.yaml): `south_hills` (the road south from the village, forest groves, low hills, the mountains
closing in, the pass four squares wide), `tarnhold` (the pass comes down into the fortress; its north gate takes the
pass, its west and east gates the valley road), `tarnvale_west` and `tarnvale_east` (narrow valleys, six squares wide,
dog-legging between glades: an inn and a tavern in each vale; a gate wall with two towers at the far end; the road runs
on to a note at the map's edge). No people, encounters or interiors yet.

Maps: `rebuild.sh` (layout.py writes the maps; tools/squarewalls.js squares off what the cliff sets can't draw;
tiers.py raises the mountains in rings; those are squared too). Overwrites hand edits to these four maps.
Art: `build.py` makes art/worldtiles/south/ from sheets/ (each fetched with curl from
`https://api.pixellab.ai/mcp/tilesets/<id>/image?inline=true` and `/metadata`) and props/.

## Tilesets (PixelLab pro, 64 px, high top-down; 9 sets, 25 generations each)
All chained to one temperate meadow grass, base 2674f472 ("short green meadow grass of temperate hill country, cool mid
green, a few tiny clover leaves, soft and low contrast, low detail").
- hills-road (9ee9e983), flat, 16: lower the village's dirt path (base 30168bad), upper the meadow grass.
- forest-edge (790eeee8), cliff, raggedness 0.5: upper "dense dark green temperate forest canopy seen from above,
  overlapping crowns of pine and oak"; transition "a tall wall of pine and oak trunks with ferns and thick undergrowth".
- hill (0a300e46), raised 16 (transition 0.25, step_slope 1.6): the top of a low rounded hill. Its tops came out lime;
  build.py pulls them most of the way back to the meadow's colour.
- scree (41354af0), flat: loose grey mountain scree.
- mountain (cbfdef0a), cliff, raggedness 0.6: upper "flat top of massive grey granite mountain rock" (base 37105f97);
  transition "tall sheer mountain cliff face of grey granite, vertical cracks and rough ledges".
- mountain-ledge (352cfa63), cliff over the mountain top, raggedness 0.9: "higher rough ledge of grey granite, broken
  uneven rock with jagged boulders" (base a57691f0).
- mountain-summit (eaaf190b), cliff over the ledge, raggedness 1: "the bare summit rock ... a few patches of old snow".
- fort-wall (cc185a2b), cliff, roundness 0: a battlemented walk of grey slabs; face of dressed grey stone with arrow slits.
- cobble-road (12ea2c58), flat: the vales' and Tarnhold's road of grey setts (lower), the meadow grass (upper).

The user, 2026-11-01, after a first look: a single cliff with a flat top read as a small step up on its north, east and
west sides (a 3/4 view draws a face only on the south). So the mountains climb in rings: rock (#), ledge ((), summit (?),
each a cliff set over the last, by distance from open ground (tiers.py). Built walls meet the rock without a strip of
grass between: the fort wall is `underWalls: all` (runs on under the rock at its ends) and `solo` (the ledge and summit
are not its upper ground); the rock draws its edge there from mountain-cut.png (its sheet with the green cut away).

## Props (create_1_direction_object; 40 generations)
- 64 px, 16 in one call (80192ad4): pine, fir, oak, birch, boulder, rocks, stump, log, cairn, milestone, roadsign,
  hitch, table, campfire, banner, wildflowers. Some frames carried a sliver of the sprite above; build.py keeps each
  frame's largest piece.
- 160 px, 4 a call: roadinn, tavern, stable, keep (5f6b6f8b, "a building seen from above at a three-quarter angle, its
  front facing south"); watchtower, gatetower, gatehouse, crag (a40320be). Like the village's, they are drawn steeper
  than the tiles.
The well, barrels and crates are the village's (../outside/props.png).

## Known
- Past the hills' north edge the map draws the tileset's wall (the mountain), so a grey strip shows above the forest.
- The corner towers and the tavern are small beside the figures; the keep is scaled 1.4.
- Tarnhold's north gatehouse is a picture over the gap; the wall's face shows at its sides.
