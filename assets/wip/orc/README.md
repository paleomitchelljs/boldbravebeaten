# Tarnhold's second pass, and the orc valley (2026-11-08)

The user: "I'd like a new area attached to East Tarnhold as well as a revision and improvement of the Tarnhold pixels
to better match the style of the sprites and of the revised Lava hills & Cinder Mine. The new area should be a valley
with an orc fortress & orc mines." With a hand-drawn map of the classic orc valley, its key, and screenshots of the
quarried hills, the castle's outside and its throne room. Then: "the Tarnhold mountains should be a different color
than the lava hills, and ... we need 'slope' walls to make the tops look more like peaks, and to create more realistic
plateaus and winding mountain passes that vary in height."

Scripts: `build.py "$PWD"` (sheets to art/worldtiles/highland/ and art/worldtiles/orc/, toned; prints the cliff list
and the strips' piece boxes), `rebuild.sh` (maps: layout.py, interiors.py, squaring, rings, heights.py), `heights.py`
(Tarnhold's walkable levels; run after ../tarn/rebuild.sh too). Sheet ids in `ids.txt`.

## Tarnhold (tileset `tarnhold`, art/worldtiles/highland/)
All PixelLab pro, 64 px, high top-down, chained to one gravel floor (base 091b1684) and one granite top (a8d7ff88).
- mountain (cde12f36), cliff: "mountain canyon floor of packed grey-brown earth and fine gravel ..." under "the rough
  top of a grey granite mountain, broken weathered rock with patches of dark moss and lichen"; a craggy mottled cliff.
  Grey granite and moss, against the purple-brown basalt of the Black Hills. Tops toned darker in build.py.
- shoulder (e4b8b25f), sloped (0.25, step_slope 1.6): the mountains' second ring, "the higher rocky shoulder of a
  mountain rising toward a peak, grey granite boulders and loose pale scree".
- peak (f736a82e), sloped (step_slope 1.8): the third ring, "a high mountain peak of pale grey granite dusted with snow".
  The rings get brighter as they climb (build.py), so the tops read as peaks.
- road2 (6ecdb715), flat: "a smooth trodden road of pale tan packed earth" (toned down). The first roll (039c25cf) came
  out as dark lumpy rock and is unused.
- river (4cda36da), bank: "a cold mountain river, deep dark slate-green water".
- upland (0b4a71ff) and highland (5996c7c7), sloped: two walkable levels over the gravel ({ and ▓). The highland's
  plain tile repeated in a strong chevron; build.py cuts its contrast.
- overlook (1ffe501d), fort (5386c3bd), tower (76bf19e9), cliffs. The rope bridge and the props are the first pass's.

## The orc valley, castle and caves (tilesets `orc_valley`, `orc_castle`, `orc_mine`; art/worldtiles/orc/)
- valley-mountain (979415bf), cliff: mossy valley grass (base 14483f03) under Tarnhold's granite top, so the shoulder
  and peak rings go on it.
- valley-path (ede3d447), moat (8b0b1d04, the river's water), trainer-hill (d39895e2, sloped; lime toned toward the
  grass), quarry (58a1a0f5, cliff: "a quarried face of dark grey stone cut in blocky ledges"), orc-fort (4f6c934c,
  cliff: "big rough-cut dark grey-blue stone blocks ... slabs of dark green veined marble").
- castle (0ec197c5), cliff: "big worn slabs of dark green marble" floor, "rough-cut grey-blue and slate-green stone
  blocks" walls (the throne-room screenshot).
- mine (a6ed1b4f), cliff: grey stone dust floor, "mottled dark grey stone hacked with pick marks". Toned darker.
- Props, 64 px (16 a sheet): valley (36c43e9e: banner, tent, campfire, torch post, skull pike, weapon rack, dummy,
  mine cart, stone blocks, rubble, cage, chain post, palisade, totem, scaffold, woodpile), furniture (77726e0d), wall
  decor (781aa7c9: the green orc banner, torch, skull shield, the gold coin, crossed axes, chains, boar head, slit,
  swag, relief, shelf, crack, furs, lantern, flag, glyphs). 128 px: a3a46af5 (the marble gate, the throne; a longhut
  and cabin drawn corner-on, unused), b2c10ae5 (longhut, cabin, big tent, watchtower, asked front-on: the tent and
  tower are, the longhut and cabin still lean).

## Known
- Where an upland meets a cliff, a thin rim of gravel shows at the cliff's foot (the cliff tiles carry the floor).
- A road stops at an upland's bank; the levels carry no road.
- The mine reuses the fire mine's clutter and rock decor (umber), and a timber from its wall pieces.
