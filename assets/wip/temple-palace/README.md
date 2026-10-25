# The palace (2026-10-25)

The plan (`assets/ideas/temple-dungeon.md`): entered "from the first courtyard through an arched and decorated
doorway", past statues into a long chamber; "a great hall with a throne room", "several side chambers", stairs up to a
second floor ("the living quarters of the denizens of the temple" and the servants' quarters); "in a niche on the
first floor off the great hall" a stair down, with "a few small rooms branching off from the stairs down", to the
ritual chamber. The user's references: `assets/ideas/refs/palace-hall-reference.png` (smooth sandy walls with a dark
band, a raised platform along the hall, a brazier, a great stone mask on the wall, a dark floor) and
`palace-throne-reference.png` (a lizardfolk templar before a dark wooden seat).

Layout: `layout.js` prints the three maps (ground, upper, stair). Rooms either side of an east-west wall join by
openings two squares wide: a door in such a wall can't be drawn by the cliff sets (`tools/walls.js`); doors are only in
north-south walls.

All PixelLab pro, 64 px, high top-down, lineless, basic shading.

- palace-wall.png (63eb1108), transition 1.0, roundness 0 (the court wall's 25-tile layout, checked): lower "palace
  interior floor of large worn smooth dark grey-brown stone slabs, faintly mottled, low contrast" (base 6c916114),
  upper "flat top of a thick palace wall of smooth sandy yellow-tan stone, a few large blocks, low contrast", transition
  "tall smooth palace wall face of sandy yellow-tan plastered stone, faintly mottled, a thin carved moulding along the
  top and a darker brown carved band along the foot"; palette "palace sandstone and dark slate" (#2a2620 #36312a #433d34
  #504940 #5e564b #6c6457 #7a7163 #5a4a2e #7a6a42 #9a8a58 #b4a26a #c8b67a #d8c88e #e6d8a2 #3e3424 #4e4430). The face
  came out greyer than the reference's.
- palace-dais.png (9ddbfafe), 16 tiles, transition 0.25, roundness 0, step_slope 0: lower the floor (chained), upper
  "raised stone dais of large smooth pale sandy tan slabs, low contrast", transition "a low sheer face of grey stone
  blocks along the edge of a knee-high raised platform, a thin pale lip along its top".
- Pieces (create_map_object, high top-down, basic shading, selective outline, medium detail unless said): p-throne
  (43e3ef54) "a heavy dark carved wooden throne with a tall straight back carved with a coiled serpent, worn green
  cushion, iron studs"; p-statue (31e8dd0b) "a weathered sandstone statue of a tall lizardfolk warrior standing on a
  square plinth, holding a spear upright" (came out bronze); p-brazier (b57ee20f); p-column (ddf53383) "a thick round
  smooth sandy yellow-tan stone column"; p-stairup (b2e608e5); p-stairdown (67489936) "a square opening in a stone floor
  with worn sandy stone steps going down into darkness" (came out a dark box); p-bed (29683d02); p-cot (15280208, low
  detail); p-table (9c95551f); p-barrels (af5ad924, low detail); faces (side view, lineless): f-mask (d48c3953) "a large
  carved stone mask of a long gaunt solemn face", f-banner (d5106f6d, low detail) "a long narrow hanging cloth banner of
  dark green with a coiled gold serpent emblem".
- build.py copies the two sheets into art/worldtiles/temple/ and packs the pieces into palace-props.png.
