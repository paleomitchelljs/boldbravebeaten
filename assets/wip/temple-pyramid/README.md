# The pyramid court (court 2) (2026-10-24)

The user: "I'd like to try the second courtyard with the step pyramid. The game screenshot shows the style and general
idea of the pyramid in the courtyard" (`assets/ideas/refs/pyramid-court-reference.jpg`: tall tiers carved all over in
bands of relief, flat tops, a flight of steps running up along a face). The plan (`assets/ideas/temple-dungeon.md`):
"four tiers", tier 1 stairs in the north-west corner, tier 2 in the south-east, tier 3 in the north-west, tier 4
"centrally located on the south face", "a very small altar" and a well on top.

How it is built: each tier is a terrain of the court's tileset (`tier1`..`tier4`, ranked in order), drawn as a cliff set
over everything below it, so the tiers stack. A tier's outer ring is its riser (`^`, solid, drawn as the tier it holds
up); inside it its terrace (`-` `:` `*` `&`). Stairs are non-solid legend props on a riser square.

All PixelLab pro, 64 px, high top-down, lineless, basic shading, roundness 0, transition 1.0 (the 25-tile cliff layout,
the same tile positions and patterns as the court wall's).

- tier-cliff-green.png (239b0b35): lower the court grass (base 0d3b4bac), upper "flat terrace of an ancient stepped
  pyramid, paved with a few very large smooth weathered pale olive-tan stone slabs, broad flat faces, worn edges, low
  contrast", transition "tall sheer face of a pyramid tier carved all over in deep relief: two bands of interlocking
  glyphs, coiled serpents and scroll patterns in weathered olive-khaki stone, a plain projecting ledge along the top,
  soft shadow in the carving, darker toward the foot"; palette the court greens plus olive stone. The face came out
  dark green (it took the grass greens). Unused. Its terrace became the base 29890ff1.
- tier-step.png (9075bd72): lower that terrace (29890ff1), upper "the next higher flat terrace of the same stepped
  pyramid, the same large pale olive-tan stone slabs, very slightly lighter", the same face; palette "weathered olive
  temple stone" (#4e4a32 #5e5a3c #706a48 #837c56 #968e64 #a8a074 #bab286 #cac49a #d8d2ac #a6b090 #8a9a78 #6e7a58). The
  face is the olive-khaki wanted; the upper terrace came out one flat cream (#d8d2ac), filled by build.py.
- tier-cliff.png (d0d8cbe9): tier-cliff-green again with both ends chained (grass and 29890ff1) and the stone palette,
  so the first tier's face matches the others.
- build.py makes art/worldtiles/temple/pyramid-tier1..4.png: fills the cream, shades each tier's terrace a step lighter
  than the one below (0.86, 0.93, 1.0, 1.07) so the height reads from above, and casts a soft shadow on the terrace
  east of each tier (light from the upper left). A face's quarter tiles take the lower terrace's shade (the face doesn't
  fill them; left unshaded they showed as a light strip under each face). Seen from above the north and side edges of a tier are only a rim; the
  shading is what tells the levels apart there.
- The stair. The user, after the first pass: "The stairs do not seamlessly mesh with the surrounding tiles. The slant
  stairs should also go—let's just have a single, well-matched set of north-south stairs and use those at all levels."
  So one design, two squares wide, on the south face of every tier (west end, east end, west end, the middle): the
  central stair, inpainted (`inpaint_image`) into a render of the top tier's face (`ctx-d.png`, 4x4 squares from
  `assets/wip/temple-doors/render.py`, mask 60,112 136x108): "a broad straight stone staircase climbing straight up the
  carved face from the paving at the bottom onto the terrace at the top, many worn pale olive-tan steps running left to
  right, seen from above and in front, a low carved stone balustrade on each side" (out-d.png). pack.py keeps only the
  flight and its balustrades (an outline traced by hand, wider at the newel posts), so the tier's own face, ledge and
  terraces show round it: the first cut kept the whole rectangle, with plain block walls PixelLab drew beside the
  balustrades and its own repainted ledge, and showed as a patch. A copy is shaded for each tier.
  Superseded tries, kept for reference: the flight along the face (out-b.png, the reference's stair) and the west-face
  flights (out-a*.png, out-c*.png).
- altar.png (map object 5e303fd1, basic shading, selective outline): "a small ancient stone altar block of weathered
  olive-tan stone, carved with a coiled serpent on its front, a shallow dark-stained basin on top, a couple of melted
  candle stubs". Came out terracotta-red; kept.
- The join, repainted. The user, after the cut-out: "The stairs are still not flush—we may need pixel lab to generate a
  cleaner transition. Basically a tile that meshes cleanly with the wall set." (The stair's head stood above the
  ledge, a dark sliver of PixelLab's own wall ran beside the balustrades, and the newel posts stopped short.) seam.py
  lays the cut-out stair into a fresh render of its spot and masks a band 7 px either side of its outline, plus its
  head and foot; `inpaint_image` with that mask: "a seamless join between the stone staircase and the carved pyramid
  wall: the carved relief face runs right up against the outer side of each stone balustrade with no gap, the pale
  stone ledge along the top of the wall meets the top of the balustrades cleanly, the top step lies level with the
  paved terrace above, the foot of the stair and the base of each newel post rest flat on the paving below; same
  colours and pixel style as the surrounding stone" (grass for the first tier). Two spots, one per face sheet: the top
  tier (out-seam-top.png, used for tiers 2-4, darkened for 2 and 3) and the first tier (out-seam-first.png). One try
  each. The balustrades now end in caps on the terrace above, and cast a shadow to the right.
- pack.py keeps the stair and the repainted band (everything else transparent) and packs the copies (in halves, one
  per square) and the altar into art/worldtiles/temple/pyramid-props.png.
