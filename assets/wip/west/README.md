# The lake country and the clay canyon (2026-11-10)

Three places west and south of Tarnhold's grassland (`data/places.yaml`, between the `# >>> west` and `# <<< west`
markers, written by `layout.py`), two tilesets (`lakeland`, `clay_canyon` in `data/tilesets.yaml`) and their art in
`art/worldtiles/west/`.

| Place | What |
|---|---|
| `tarn_lake` | Grassland north of `tarn_plains_west`: a big lake, the fortress on its south shore in two blocks either side of the gate road, a jetty behind it, an island of standing stones reached by a plank walk from the east shore. |
| `sarnak_fort` | The fortress's upper floor: a hall in each block, joined by a rope bridge over the gate road. Each block's door (`W`, `E` in the lake map) leads up to its hall. From the ground the bridge is overhead: a prop with `over: true`, drawn after the figures, and you walk under it. |
| `tarn_plains_south` | Grassland south of `tarn_plains_west`, on the way to the desert; on its east a canyon of red clay, a labyrinth of courts and passages with minotaurs, the mountains behind it climbing in six rings that pale toward tan. |

## Style

The brief was a key "more in tune with the character sprites (slightly more heightened)" than the older landscape.
Every prompt therefore asks for *clean flat colour areas, no speckle noise, bold stylised 16-bit JRPG pixel art*,
low detail and basic shading for ground, saturated colour. The older sets (Tarnhold's grass, the orc valley) are
noisier and greyer; these two places do not match them, by intent. The grass props (oak, birch, tall grass) are
still Tarnhold's and are the older style.

## Build

    sh assets/wip/west/fetch.sh                      # the sheets and props from PixelLab (ids.txt, objs.txt)
    python3 assets/wip/west/build.py "$PWD" > assets/wip/west/build.out
    python3 assets/wip/west/layout.py                # rewrites the three places in data/places.yaml

`build.py` also draws, by hand: slab joints on the wall-top tile (it came as one flat colour); rings 2–6 of the
mountains from the one ring set (each ring 13% nearer tan); the tower without its disc of turf; the door cut from
the tower; a rope-bridge square running east-west (Tarnhold's planks turned, rope rails drawn); the gate passage as
the upper floor sees it (the paving at half size, at half brightness) and the bridge over it.

## PixelLab (pro, 64 px, high top-down; map objects low top-down)

Seven tilesets and ten map objects; the balance was about 289 before the last three sets and was not read after.

| Sheet | Lower | Upper | Transition |
|---|---|---|---|
| shore | deep lake water, rich teal-blue, calm, a few bold light ripple strokes | lush meadow grass, saturated mid green, plain and smooth with only a few bold darker green blade marks | a low bank of dark wet earth with a thin pale foam line at the water's edge (0.25) |
| road | a trodden dirt road of warm brown packed earth, a few bold darker ruts and small stones | the shore's grass (base tile) | none |
| flag | old courtyard paving of big worn grey-green flagstones with dark mossy joints | the shore's grass | none |
| fort | the flagstones (base tile) | the flat top of a thick fortress wall, big plain slabs of pale grey-green stone with dark joints | a tall fortress wall face of small grey-green mossy stone blocks with a carved band of angular glyphs just under the top (1, roundness 0) |
| slope | dry canyon floor of pale tan packed soil and sand, a few bold darker cracks and small pebbles | the top of a red clay rock mesa, warm terracotta and ochre sandstone in broad flat layered slabs with bold dark crevices | a steep slope of banded red clay and tan rock strata with fallen scree at its foot (0.25, step_slope 2) |
| soil | the canyon floor (base tile) | the shore's grass | none |
| ring | the mesa top (base tile) | a higher shelf of red clay rock, terracotta and pale ochre | a steep slope of banded red clay and tan rock strata (0.25, step_slope 2) |

Road, flag and soil have the ground as PixelLab's *lower*, so their tilesets.yaml entries carry a swapped `corners:`
list. Objects: `tusk_tower` (128×192, after the user's reference: grey-green mossy blocks, a glyph frieze, a brown
conical roof ringed with bone tusks), `standing_stone`, `tusk_standard`, `brazier`, `reeds`, `egg_nest`,
`clay_boulder`, `dead_tree`, `bone_heap`, `horn_totem`.

## Known compromises

- The upper floor is a separate place, so the roofs you see from the ground are solid slab while "upstairs" has
  halls. A true two-storey map needs engine work.
- The towers are 120 px wide beside walls eight squares deep: the reference has the towers dominating. Bigger towers
  (or a wall of fewer squares) would be nearer it.
- Two flat sets that meet (road against soil or paving) each draw a grass fringe at the seam, so the road stops short
  of the canyon and the gate passage is paved, not dirt.
- The stairs down inside the fortress are the default icon. The minotaurs' tent is Tarnhold's yurt.
- The ring corners show a small notch where two slopes meet (the set's own corner tile).
