# The desert

The user, 2026-11-08: "a new outdoor area south of the west grasslands: a desert region. a broad coastal desert with a
large oasis in the center being fed by a stream running down from the mountains east of it (mountain walls of Tarnhold)
and flowing out of the oasis should be a river that joins the sea (far western edge of the map). In the center of the
large oasis lake should be a ruined tower guarded by spectres. Otherwise it should be a sandy & rocky desert with sparse
plant life away from the oasis/river."

Place `desert` (80 × 52), south of `tarn_plains_west` (its `S`, the desert's `N`).

    python3 layout.py > map.txt     # the map, deterministic; reports unreachable squares
    sh fetch.sh [name...]           # PixelLab sets in ids.txt -> sheets/
    python3 build.py "$PWD/../../.."  # art/worldtiles/desert/; prints the sandstone cliff list and the props

`layout.py` made the first map; then `node tools/squarewalls.js desert ▩ .` squared the outcrops and a few corners were
fixed by hand. The YAML is now the source: the script is a record, not something to re-run over later edits.

## Layout

- West: the sea, three or four squares deep, a beach before it (the edge's water runs on past the map).
- East: Tarnhold's mountains, one ring a square by distance into the mask (`# ( ? ▁ ▂ ▃ ▄`), with a spur west where
  the stream comes down through a notch (the waterfall `A`, Tarnhold's own), and a ragged gravel foot (`` ` ``).
- Middle: the oasis lake, an island in it (grass `,`, its tower `T` with two blocked squares `x` either side, the
  spectres `s`, a chest `X` in the doorway), a ford of shallows (`_`) out from the south shore, a ring of oasis grass
  with palms, reeds, papyrus and shrubs round it.
- The stream from the notch south-west into the lake, banked with grass, forded once; the river out of the lake west to
  the sea, forded once.
- Elsewhere: sand with sandstone outcrops (`▩`, a cliff set), patches of rocky ground (`;`), and sparse thorn bushes,
  aloes, dry grass, dead trees, bones, cairns, boulders, fallen columns and the stub of an old wall.
- `S` on the south edge: a note (the desert runs on; not built).

## Art (all PixelLab pro, 64 px, high top-down)

| Sheet | Id | What |
|---|---|---|
| shore | f84c88e0 | the Tarnhold river's water (base 4f80f29e) -> pale desert sand (base 1b1d7f41), a narrow wet strip |
| foot | 90756359 | sand -> Tarnhold's gravel (base 091b1684), flat, meandering |
| oasis | 57be0581 | sand -> lush oasis grass, flat, meandering |
| mesa | 663cbf93 | sand -> red sandstone outcrop (cliff, 25 tiles) |
| ford | 37d2c2d8 | water -> a shallow ford over sand and stepping stones |

Props: one 16-frame sheet (469210ba: thorn bush, dry grass, aloe, pebbles, boulder, skull, fallen column, rubble, dead
tree, reeds, papyrus, flowering shrub, bush, ruined wall, cairn, tumbleweed), four palms at 128 px (1beb4bad), the
ruined tower at 256 px (6dbe537d). The mountains reuse `../highland/` (slope20 and rings 1-6, the waterfall).

The water is Tarnhold's slate-green river water throughout (the stream comes from there), so the lake and the sea are
the same colour as the mountain river. A bluer oasis would need its own water and a new shore set.
