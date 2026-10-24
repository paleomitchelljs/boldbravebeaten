# The labyrinth's art (2026-10-24)

The plan: "carved stone that's been worked", "that same light tan, though damper and a little darker"; "it should twist
with curves, rather than sharp right angles". Built like the court (plain layers, decorated; see
`assets/wip/temple-court/v2/README.md`). PixelLab pro, 64 px, high top-down, lineless.

- maze-cliff.png (ac362493): first try, a 12-colour palette; came out washed out and flat with near-black faces. Unused.
- maze-cliff-v2.png (36636c93), transition 1.0 (the 25-tile cliff layout, the same patterns as the court's), roundness 1:
  lower "plain worn floor of large smooth worked sandstone flagstones, damp, a little darker tan than sun-bleached
  stone, soft and low contrast, low detail"; upper "flat top of a thick curving carved wall made of a few very large damp
  tan sandstone blocks, worn smooth, rounded edges, naturalistic"; transition "tall curving carved wall face of small
  worked tan sandstone blocks in courses, damp, darker toward the foot, soft green moss in the lower joints"; palette
  "damp temple sandstone and moss" (#4a3e2c #5a4a34 #6e5a3e #7e6a4a #8a7656 #9a8462 #a8926c #b49e76 #c2ac82 #cdb88e
  #d8c49a and the court's greens). The corners round only a little: on a square grid the curves come from the layout
  (tools/labyrinth.js rounds its bends).
- art/worldtiles/temple/maze-wall.png is that sheet with row 8: its plain top redrawn as large blocks (joints a step
  lighter and darker than the top's mean colour). maze-floor.png is its plain floor tile.
- Pieces (create_map_object, basic shading, low detail): d-puddle "a small shallow puddle of dark still water on stone"
  (dark rim removed, made 55% opaque); d-bones "a few old scattered yellowed bones and a cracked skull" (rim removed);
  d-stone "a fallen chunk of carved tan sandstone and a few broken stone fragments"; d-urn "a broken terracotta clay urn
  lying on its side with shards scattered"; d-stain (came out as a pillar, unused). With the court's moss, sprig, crack,
  pebbles, bricks, ground cover and vines, packed into maze-decor.png (rects in maze-decor.rects.json).
