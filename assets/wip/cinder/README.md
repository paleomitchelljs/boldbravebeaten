# The mine's second art pass and the Black Hills (2026-11-07)

The user: more of the colours, style and decor of the old goblin-cave screenshots (warm umber and black mottled rock,
dusty brown floors, torches, red war banners with a yellow skull, carved gold glyphs) in the mine; "rocky hills and
mounds of basalt and old flows in the blasted area leading to the mine" outside it, after a picture of a volcanic
zone's dark grey-purple slopes and red spires. Pixel style after the user's 16-bit dungeon map pictures.

`build.py` makes art/worldtiles/cinder/ from the sheets here (fetched with curl from
`https://api.pixellab.ai/mcp/tilesets/<id>/image?inline=true` and `/metadata`) and the object frames in wall/, floor/
and hills/ (`https://backblaze.pixellab.ai/file/pixellab-characters/objects/<user>/<object>/rotations/frame_<i>.png`).

## Tilesets (PixelLab pro, 64 px, high top-down, 25 generations each)
- mine-wall (4bc07a72), cliff, raggedness 0.7: lower "plain dusty cave floor of packed warm brown earth and worn umber
  stone" (base 6c375343); upper "flat top of massive dark brown-black cave rock"; transition "tall rough craggy cave
  wall of mottled umber and black rock, dappled warm brown and dark patches like old camouflage ... a faint orange glow
  on the lower rock"; a 16-colour umber-and-ember palette. The mine's basalt places (`ember_basalt`) draw with it.
- lava-floor (6940bb94), 16: the old lava (base 9a112ff6) under the new floor; `lava-floor-cut.png` has the lava cut
  away so the moving lava shows through.
- flow (1ea280f7), raised 16 (step_slope 1.2, meandering edge): lower "blasted barren ground of grey-brown volcanic ash
  and fine black cinders" (base 5520f9f5); upper "an old cooled lava flow of black basalt, ropy wrinkled folds".
- lava-ash (a4b3a080), 16: the lava under the ash, with a crusted black bank; `lava-ash-cut.png` as above.
- path (494e8251), flat 16: the mine's own brown floor as a trodden trail over the ash (the walk in matches the cave).
- hill (d12be571), cliff over the ash: "a steep craggy hillside of dark grey-purple and brown basalt, layered bands of
  old lava flows" (upper base 0a92cbc2).
- crag (6a983f0d), cliff over the hill top: "a steep jagged face of dark basalt streaked with rust-red rock". Its tops
  came out bright rust-orange and read as lava: build.py darkens and greys them. The summit tier repeats it.

## Decor (create_1_direction_object; 35 generations)
- wall/ (d0bae6e0, 64 px, 16): torches, two red war banners (skull, sun-claw), a red swag on gold chains, a carved gold
  tribal face, a rune panel, a brazier, a lava seep, a mine timber, a shelf of pots, a skull shield, chains, painted
  hands, a hanging lantern. Frame 4 (runes) came out as Latin letters: dropped. Drawn as the mine wall's `faces`.
- floor/ (294d2370, 40 px, 64): rocks, glowing cracks, rubble, ore, stalagmites, embers, crystals, coal, fungus, bones,
  a skull, a vent (`cave-decor.png`, scattered on the floor) and mine clutter (`cave-clutter.png`, props `cl_*` for
  legends).
- hills/ (cbf7432a, 64 px, 16): boulders, red spires, basalt columns, a flow mound, a dead tree, a fumarole, scree,
  obsidian, a cracked lava rock, a skull cairn, a stump, a small lava pool, bones, a goblin signpost
  (`hills-props.png`, the `cinder_hills` props).

## Known
- Only the basalt places changed. The masonry (the castle, barracks, jail) and the gnomes' stone keep their first-pass
  sets; the doors cut for the basalt wall (doors.png) were cut for the old wall's face and may not line up.
- The approach's map is only three rows deep at the top, so the hills climb in rings only at its corners and on the
  three big mounds (a crag crest drawn by hand).
