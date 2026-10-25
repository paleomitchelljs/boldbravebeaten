# The ritual chamber (2026-10-24)

The plan (`assets/ideas/temple-dungeon.md`): level 3, "about a quarter of the size of the main courtyard", "a large room
with a pool of water in the center", entered one way by falling from the sewers into the shallow water, left by the
stair to the palace, with "an orb with the avatar of fear inside". The user's reference
(`assets/ideas/refs/ritual-chamber-reference.png`): walls of dusky rose stone with pointed green niches, a dark teal
marble floor, a round pale aqua dais, a huge translucent green orb with a brown tentacled thing in it, two small
pyramids of brown stone before it.

Layout: `layout.js` (node layout.js prints the map rows): 15x15 inside the walls, a 7x7 square pool (a round one
stair-steps on the grid) with the dais on the one floor square in its middle, four pyramids, the stair in the middle of
the north wall, the landing from the sewer drain in the pool's north half, the boss's square before the pool's south
edge.

All PixelLab pro, 64 px, high top-down, lineless, basic shading.

- ritual-wall.png (234d9023), transition 1.0, roundness 0 (the court wall's 25-tile layout, checked tile by tile):
  lower "polished floor of large dark teal-green marble flagstones with faint pale veins, cold and smooth, low contrast"
  (base 5854a372), upper "flat top of a massive temple wall of dusky rose-brown stone, a few large blocks, low
  contrast", transition "tall sheer wall face of smooth dusky rose-brown mauve stone blocks, faintly mottled, a carved
  band along the top, darker toward the foot"; palette "ritual chamber teal marble and rose stone" (#0e1c1c #14282a
  #1c3634 #244440 #2e544c #3a6658 #4a7a68 #5e8e7a #3a2a2c #4a3638 #5c4446 #6e5254 #806062 #927072 #a48284 #b49496).
- ritual-pool.png (2bb4caca), 16 tiles, transition 0.25, roundness 0.6: lower "shallow still pool of clear pale aqua
  water over a pale stone bottom, faint ripples, low contrast" (base 70d15c58), upper the marble (chained), transition
  "a low carved stone lip of the marble floor stepping down into the shallow pool, a thin wet dark line at the
  waterline".
- Pieces (create_map_object, high top-down, basic shading, selective outline unless said): p-orb (4914f6b2) "a huge
  translucent glowing green orb hovering above a round pale aqua stone dais, a dark brown tentacled horror with many
  limbs curled up inside the orb" (came out as an opaque orb above a dais with purple tentacles in it); p-pyramid
  (cfe613e6) "a small squat four-sided pyramid of rough dark brown mottled stone"; p-stair (3f2b2034) "a narrow stone
  staircase of dusky rose-brown steps climbing up and away into a dark arched doorway"; f-niche (23d918a6, side view,
  low detail, lineless) "a tall narrow pointed gothic arch niche ... dark green carved stone tracery inside" (its frame
  came out tan).
- build.py makes art/worldtiles/temple/ritual-*.png: the two sheets as they are, the plain pool tile, and the props
  sheet, where the orb is enlarged 1.3x and laid at half strength over the dais so the thing shows inside it.
- Larger pieces (2026-10-25, the user: decor "small relative to the tiles"): p-stair2 (2fb3962d, 112x144) "a wide
  round-arched dark doorway in a rose-brown stone wall with a broad flight of worn rose stone steps climbing up and
  away into darkness"; f-niche3 (7bdfcde1, 56x88) the niche again, sized to the wall face (about 85 px tall; f-niche2
  at 112 stood above the face).
