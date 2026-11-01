# Outside: the village, the swamp before the temple, the Black Hills before the mine (2026-11-01)

Maps: `layout.py` (prints the `map:` rows for data/places.yaml). Art: `build.py` makes art/worldtiles/outside/ from the
sheets here (each fetched with curl from `https://api.pixellab.ai/mcp/tilesets/<id>/image?inline=true` and
`/metadata`) and from props/. The Black Hills use the mine's own ember_basalt tileset (basalt, lava), with two props
from the strip here.

All three tilesets are PixelLab pro, 64 px, high top-down, chained to the temple court's grass (base tile
0a87b4aa-e919-4be2-859c-362dc7d85df2), so the open ground is the court's grass throughout. That grass tile carries a
paving brick that repeats as a checker; build.py paints it out (`plain_grass`) and puts the result in the flat sets'
all-grass tile too. The variety on open ground is the court's decor pieces (bricks, ferns, larger plants).

- swamp-water (d166202a), 16 tiles, transition 0.25, roundness 1, boundary 0.15: lower "murky green-brown swamp water,
  still and dark, a little duckweed and a few lily pads floating, soft and low contrast" (base 816cf65a); upper the
  grass; transition "a low wet muddy bank with reeds and sedge at the water's edge"; palette "jungle swamp".
- village-path (776f919f), 16 tiles, transition 0, roundness 1, boundary 0.1: lower "a packed brown dirt village path,
  worn smooth, a few pebbles and cart ruts, soft and low contrast, low detail" (base 30168bad); upper the grass.
- jungle-edge (a8faa140), 25 tiles (a cliff set, the temple walls' layout), transition 1.0, roundness 1, raggedness
  0.5: lower the grass; upper "dense dark green jungle canopy seen from above, overlapping rounded treetops of broad
  leaves, low contrast" (base 2bcf8f68); transition "a tall wall of jungle tree trunks, hanging vines and thick
  undergrowth, dark in the shade under the canopy". The edge of the village and the swamp.

Props (create_1_direction_object, all kept; 40 generations): buildings at 160 px ("a small village building seen from
above at a three-quarter angle, its front door facing south": cottage, inn, smithy, shop); landmarks at 160 px (the
temple arch, the mine mouth, a small step pyramid, a goblin totem); village things at 64 px (well, market stall, fence,
signpost, haystack, woodpile, trough, handcart, barrels, crates, bench, cabbage patch, bush, tree, scarecrow, lamp
post). They came out in a steeper, more isometric view than the tiles: prototype art. A building's picture stands on
its door square; `x` squares (props drawn as nothing) hold the rest of its footprint.

The Temple Swamp (2026-11-01, the user: the outside should match the temple): the temple's outer wall down its
east side (so the road runs straight east into the court's west gate) is the court's own wall set (`#` on that map; the gate is the court's door in its face), and the two pyramids
are built of the court's tier sets with its stair props. The jungle round the rest is ground letter `]`. The arch and
the step-pyramid sprite from the landmark strip are no longer placed. The two pyramids are built into
the wall either side of the gate (half pyramids, their tops running into it); a door at each top leads into the
guardhouse over the gate (`temple_wall` N and S). Where a tier meets the wall they join without a seam: the tiers
are marked `underWalls` (they run on under a wall beside them, east or west), and the wall draws its edge there from
`court-wall-cut.png`, its own sheet with the grass cut away (every green pixel; `build.py` makes it).

## The kinds of tile this place uses (a guide for future sets)
- Plain ground (one tile, decor pieces scattered over it): grass.
- Flat corner sets (16 tiles, lower and upper ground): swamp water under grass, paving and loam over grass.
- Cliff sets (25 tiles, a top and a south face): the wall, each pyramid tier (each chained over the one below), the
  jungle edge. A cliff set's south face is the only side drawn tall; east, west and north edges are a lip.
- A cut copy of a cliff set (its ground transparent), for where it stands against anything other than its own ground.
  Any wall that will meet another raised set (a tier, a dais, a second wall) side by side wants one.
- Props cut to fit their wall: a door for each side it opens on (door_south in a face, door_west and door_east
  through a side wall's top, door_north), stairs for each tier's south face.
