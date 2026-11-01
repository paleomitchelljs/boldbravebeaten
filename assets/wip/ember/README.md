# The fire-goblin mine's art (2026-10-31)

Plan: `assets/ideas/ember-mine.md`. Maps: `layout.py` (seeded into data/places.yaml by `places.py`). Tiles:
`build.py` makes art/worldtiles/ember/ from the sheets here (downloaded with curl from
`https://api.pixellab.ai/mcp/tilesets/<id>/image?inline=true` and `/metadata`). All PixelLab pro, 64 px, high
top-down, 25 generations a cliff set and 25 the lava set.

- basalt-wall (c3dc1a8d), transition 1.0, roundness 1: lower "plain rough cave floor of dark grey-black basalt, uneven
  worn rock with a little fine gravel, dim, soft and low contrast, low detail" (base c8879281); upper "flat top of
  massive black basalt rock, rough cracked dark stone, a few large blocks, low contrast"; transition "tall sheer cave
  wall face of black columnar basalt, rough vertical hexagonal columns, a faint warm red glow on the lower rock, darker
  toward the foot"; palette "black basalt and ember" (#0e0c0c … #6b6058, #3a1a12 #5a2414 #7a3018 #a0401c). The tops
  came out orange-red (they read as lava): build.py greys and darkens them.
- lava (80268dd2), 16 tiles, transition 0.25, roundness 1, boundary 0.15: lower "molten lava, glowing bright orange
  and yellow, slow swirls, a few dark cooling crusts floating on it" (base 9a112ff6), upper the basalt floor (chained),
  transition "the broken black basalt edge of the floor dropping to the lava, its lip crusted and lit red-orange from
  below, glowing cracks"; palette "lava and basalt".
- masonry-wall (5ba59c78), transition 1.0, roundness 0: lower "plain floor of worn grey mine-stone flagstones, square
  cut, fitted close, dusty, soft and low contrast, low detail"; upper "flat top of a thick wall of grey cut mine-stone,
  a few large squared blocks, low contrast"; transition "tall wall face of grey cut mine-stone blocks laid in even
  courses, crude goblin masonry, soot-darkened toward the top, darker toward the foot"; palette "grey mine-stone".
  The tops came out near-white: darkened.
- gnome-wall (8922c5ae), transition 1.0, roundness 0: lower "plain floor of dark mottled grey stone slabs, speckled
  with darker and lighter flecks, carefully fitted, clean, soft and low contrast, low detail"; upper "flat top of a
  thick wall of dark mottled grey-blue stone, large precise blocks, low contrast"; transition "tall wall face of dark
  mottled grey-blue stone blocks, precisely cut and tightly fitted gnome masonry with thin bright mortar lines, darker
  toward the foot"; palette "gnome mottled stone".

Still to make: the stone bridge deck over lava, stair steps, the murder hole, props (portcullis, throne, bar, bunks,
mine carts, the winch, braziers, the forge), decor (rubble, ore, glowing cracks).
