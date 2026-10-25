# Temple court, second pass (2026-10-24): plain layers, decorated

The user, after the first pass: "A plainer base that we decorate is likely a better approach for the ground in
general—so layers. For the walls, we need flatter tops"; "Plain tiles that we decorate may generally be the better use
for all"; the walls should be "naturalistic walls with small stone block sides and large stone block tops", not "a
brick floor with a rind".

All PixelLab pro, 64 px, high top-down, lineless unless noted.

- court-wall-0.25 (court-wall.png in this folder, 8c0376d3): grass against a flat top, transition 0.25. Superseded: the
  face was ~12 px, too short to read. Its grass base tile 0d3b4bac-45a4-4926-b978-4b9f2f2b959e is the base everything
  below chains from.
- court-cliff.png (389b25fb), transition 1.0, the 25-tile cliff layout (pattern_4x4; layout in the metadata):
  lower "plain short soft olive green grass, even and low contrast"; upper "flat top of a massive ancient wall made of a
  few very large weathered light tan, slightly yellowed sandstone blocks, broad smooth faces, irregular worn edges,
  naturalistic"; transition "tall sheer wall face built of many small rough-cut tan sandstone blocks in irregular
  courses, shadowed mortar, weathered, a little moss at the foot". Upper base cb6499c4-e7cd-42a0-b884-a0c217d76c57.
- court-loam.png (d595407a) grass -> "plain dark rich jungle loam with a thin scatter of fallen leaves", transition 0,
  boundary_amplitude 0.2, raggedness 0.5 (the fern beds, ground `%`).
- court-paving.png (324222dc) grass -> "plain worn flat light tan sandstone paving of large even slabs, faint joints"
  (the rubble, ground `;`); base 8ecfe145-df4a-44e3-8cb7-0d96e42314ab.
- walltop-cliff.png (d8a80436): paving -> the same wall top, transition 1.0 (the wall-top place). Its edges have dark
  lines despite lineless, and its face is darker than the court's.
- The wall tops in art/ (row 8 of court-wall.png and walltop-wall.png) are the sheet's plain top [0, 6] with joints drawn
  by hand (a bevel lit from the upper left on each tile's edges, a joint across the middle in three of the four), so
  every top square reads as one or two large blocks. walltop-wall-light.png keeps that sheet; walltop-dark.py darkens its
  tops into art/ for the wall-top place, where light tops read as more of the walk.
- Decor pieces (create_map_object, basic shading, low detail): d-tuft "a small tuft of taller olive green grass
  blades"; d-fern "a small tuft of curled young jungle fern fronds"; d-bricks "three small broken weathered tan
  sandstone bricks half sunk in the ground"; d-pebbles; d-flowers "a few tiny pale yellow and white jungle flowers";
  d-moss (dark rim removed; unused, reads as a bush); d-wmoss "a patch of pale green and ochre moss growing flat on light
  tan sandstone"; d-crack (recoloured from black to mid-brown); d-sprig "a small sprig of green creeping vine";
  d-hangvine (view side) "a strand of green jungle vine hanging straight down with broad leaves"; d-mosaic-snake "a flat
  square stone mosaic inlaid ... a coiled snake made of small muted turquoise and terracotta tiles"; d-mosaic-lizard
  (came out as a lizard figure with an outline, unused); d-slab (a brick panel, unused). Packed into
  art/worldtiles/temple/court-decor.png.
