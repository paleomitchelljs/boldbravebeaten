# court-wall.png (PixelLab create_topdown_tileset, 2026-10-24, tileset 06073c9b-099c-409e-80dc-a175b7b488dd)

mode pro, tile 64, transition_size 0.25, step_slope 0, view high top-down, lineless, medium shading, medium detail,
roundness 0.6. Corner layout = the tilesets.yaml default (checked against court-wall.metadata.json).

- lower: temple courtyard ground: soft olive green jungle grass and small curled ferns growing up through broken,
  scattered small weathered sandstone paving bricks, some bricks cracked and half buried
- upper: top of a high wall of large light tan, slightly yellowed sandstone blocks, worn and weathered, with fine
  mortar lines and a few creeping vines
- transition: tall sheer sandstone wall face of large blocks rising from the grass, its foot overgrown with ferns
- palette ("sun-yellowed sandstone and jungle green"): greens #34482e #3f5934 #4d6a3a #5f7d42 #73914c #8aa45a,
  fern #4f7a3e #6a9850, paving #7d6c50 #968461 #ad9a72 #c2ae84, wall #8a6f48 #a6865a #bf9f6a #d4b67e #e3c993 #efdbab,
  earth #6e5a3e, moss #5a6b3a #7b8a45. No near-black, so the floor stays softer than the figures' black outlines.
- base tile ids: grass 0a87b4aa-e919-4be2-859c-362dc7d85df2, wall da9f3791-8b71-45ac-818e-894ab3bdc230

# The rest of the court set (2026-10-24)

- court-ferns.png: create_topdown_tileset, pro, 64, transition 0, roundness 1, raggedness 0.6, lower_base_tile_id = the
  grass above (so it joins), upper "thick lush patch of jungle ferns and tall soft grass, fronds overlapping, no bricks",
  greens and paving of the palette above. Tileset 571b7f60-0875-4bcc-83d7-f1fc260fd11f; corners = the default layout.
- Wall-face variants (inpaint_image on face-UULL.png, the straight south face, mask x2 y31 60x15 unless noted):
  face-snake.png "a carved stone mosaic frieze set into the sandstone wall face: a long sinuous snake in muted
  turquoise and terracotta tiles, its body winding left to right"; face-lizard.png "... a lizard seen in profile, legs
  splayed, in muted jade green and ochre tiles with a terracotta border" (it lightened the shadowed band: redo);
  face-vines.png (mask x6 y16 52x32) "thick green jungle vines and leaves hanging down over the top of the sandstone
  wall and trailing down its face to the grass".
- Grass variants (inpaint_image on grass-LLLL.png, the sheet's all-grass tile, mask x4 y4 56x56, so the edges still
  join): grass-plain.png "plain soft olive green jungle grass with a few small curled fern fronds, no bricks or
  stones"; grass-slab.png "one large cracked weathered tan sandstone flagstone half sunk in olive green grass";
  grass-bits.png came out flat and is unused.
- Map objects (create_map_object, 64x64): door.png (low top-down, selective outline) "heavy closed wooden temple door
  seen from above, thick dark brown vertical planks bound with two weathered bronze bands and a ring handle, set in a
  light tan sandstone threshold"; well.png (low top-down, selective) "old round stone well of light tan sandstone
  blocks, dark water deep inside, a weathered wooden crossbeam frame with a rope and bucket, a few ferns at its base";
  fern-large.png / fern-small.png (low top-down, lineless) "a large clump of jungle ferns, broad soft green curling
  fronds spreading outward" / "a small low clump of young jungle ferns and broad leaves"; steps.png (unused, too
  narrow) and steps-v2.png (high top-down, lineless; came out rising north, so steps-west.png is it turned a quarter
  turn: its light now falls from the lower left).
