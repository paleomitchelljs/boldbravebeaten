# The jungle west of the grassland (2026-11-04)

The user: "new pixel art generated for a jungle area west of the grasslands. Forest floor tiles, swampy tiles, marshy
ground tiles, trees with gnarled roots and animated swaying moss."

Place: `jungle_west` (The Mire Wood). The western grassland's road west (`Z`) now leads here (`Q`); a trail winds west
under big trees to a note (`Z`, not built yet), past a marsh with swamp pools in the south. Props only, no foes.
Map: `layout.py` (its rows are `tools/squarewalls.js`'s output; `--write` puts them in data/places.yaml). Art:
`build.py "$PWD" --yaml` makes art/worldtiles/jungle/ and rewrites the props numbers in tilesets.yaml.

Ground letters (rules.yaml): `.` forest floor, `≈` marsh (fight: rough), `_` shallow swamp, `~` deep swamp, `≡` trail,
`#` the canopy. Shallow and deep swamp are drawn alike (one water tile).

## Tilesets (PixelLab pro, 64 px, high top-down; sheets fetched from /mcp/tilesets/<id>/image and /metadata)
Forest floor, base 3d87f1d9 ("dark jungle forest floor of damp brown leaf litter, fallen broad leaves, small ferns and
patches of moss, soft and low contrast, low detail"). Marsh, base f558d754 ("marshy wet ground, dark soft mud with
shallow brown puddles between tufts of green sedge and short reeds, soft and low contrast, low detail").
- jungle-marsh (45e0e547), flat, boundary 0.15: lower the marsh, upper the forest floor.
- jungle-swamp (3a7a3e29), 0.25, boundary 0.15: lower the temple swamp's water (816cf65a), upper the marsh, transition
  "a low sodden mud bank with reeds, cattails and tangled mangrove roots at the water's edge".
- jungle-trail (1ccd04bc), flat, boundary 0.1: lower "a narrow trodden dirt trail of dark brown earth, a few exposed
  roots and pebbles" (base 807a1a24), upper the floor. Read the other way up (`corners` swapped): trail over floor.
- jungle-canopy (0f9e42ab), cliff, raggedness 0.5: lower the floor, upper the temple jungle edge's canopy (2bcf8f68),
  transition "a tall wall of gnarled jungle tree trunks on twisted buttress roots, hanging vines and grey-green moss".
  Same 25-tile layout as outside/jungle-edge, so its cliff table is copied.

## Trees (create_1_direction_object, 128 px, drawn at scale 1; all eight kept, 20 generations)
- Gnarled roots: kapok (7a06d1c8, buttress roots), mangrove (fa703b34, stilt roots), strangler fig (059dae9d),
  cypress (e7dc0306, knees and some moss).
- Moss-hung: mossoak (671d7b05), mossdead (133eed36), mossleaning (f24b4832), mossbranch (f223d422, a branch with no
  trunk, not solid, set under the canopy's edge).
- Moss sway: animate_object v3, 8 frames, 2 generations each ("the long strands of hanging moss sway gently back and
  forth in a light breeze, a seamless loop; the trunk ... stay perfectly still"). The first takes of mossleaning
  (barely moved) and mossoak (two pops) were redone ("swing slowly side to side ... clearly visible movement"); the
  oak's second take jumps from its last frame to its first, so it plays there and back (`PINGPONG`, 14 frames).
  The animated frames are v3's redraw of the tree, a shade different from the still in props/.

## Known
- The canopy's bright green is the temple jungle edge's; against the darker floor it reads a little loud.
- The trail's band is wide and blobby where it forks (rows 10-13).
- Seen in headless Chrome (east arrival, the marsh); the sway not watched moving.
