# The sewers (2026-10-24)

The plan (`assets/ideas/temple-dungeon.md`): "dark gray stone, and natural stone, for the most part carved in organic
twists", "rank water, slimy water" in "shallow channels", "stone walkways around the edges and many plank bridges
crossing those waters. The plank bridges should be the only passable way." The user's references
(`assets/ideas/refs/sewer-reference-slime.jpg`, `sewer-reference-platforms.jpg`): walls of bright green slime, dark
green water, raised wooden platforms on posts joined by plank walkways.

Layout: `layout.js` (node layout.js prints the map rows): channels cut through walkways along polylines, the walkways
cut so one side of a channel stops and the other goes on, straight bridges, a square deck ring round the drain to the
ritual chamber, then a check that every walkway is reached from the gatehouse shaft and how much each bridge cuts off.

All PixelLab pro, 64 px, high top-down, lineless, basic shading.

- sewer-wall.png (4a6cb555), transition 1.0 (the 25-tile cliff layout, the court wall's positions and patterns),
  roundness 0: lower "plain worn walkway of dark grey sewer flagstones, damp, a thin film of green grime in the joints,
  soft and low contrast" (base 977882c2), upper "flat top of a massive old sewer wall of rough dark grey-brown natural
  stone, a few large blocks, patches of dark moss, low contrast", transition "tall sheer sewer wall face of dark
  grey-brown stone blocks streaked with dripping bright green slime and dark moss, wet and glistening, darker and
  greener toward the foot"; palette "sewer stone and slime" (#1c221c #262e26 #2f382d #3a4436 #46503f #535c48 #626a52
  #73795c #4a3f30 #5c4e3a #2e5a22 #3f7a2a #5a9a34 #7ab840 #9ad04a). The tops came out light and mottled pink, the
  face's ends reddish.
- sewer-water.png (579ced9c), 16 tiles, transition 0.25, roundness 0.6: lower "deep still rank sewer water, murky
  dark green, a faint film of lighter green slime scum drifting on the surface, low contrast" (base 31a2e359), upper
  the walkway (chained), transition "the stone edge of the walkway dropping straight into the water, a wet dark lip with
  green slime at the waterline". Default corner layout.
- sewer-deck.png (3dee8583), 16 tiles, transition 0.25, roundness 0: lower the water (chained), upper "raised wooden
  walkway deck of thick old dark brown planks running left to right, worn and damp, a few dark gaps between boards",
  transition "the thick squared wooden beam along the edge of the deck, standing on dark wooden posts in the water, its
  shadow on the water below". Bridges and the ring round the drain, drawn as their own corner set (a square ring: a
  round one came out as stair steps).
- Pieces (create_map_object, low detail, lineless): f-slime (side) "bright green slime oozing over a stone ledge and
  dripping down a dark wall in long glistening streaks"; f-pipe (side) "a round rusted iron drain pipe mouth sticking
  out of a dark stone wall, a thin stream of green sludge pouring out of it and down"; d-scum "a flat floating patch of
  pale green slime scum with a few bubbles" (laid at half strength); d-debris "a broken rotten wooden plank and a few
  bits of floating rubbish half sunk"; d-post "the square top of a thick old dark wooden piling post sticking up out of
  water" (came out thin); d-grime; d-grate. Props: p-shaft (medium detail, selective outline) "the bottom of a round
  stone well shaft in a sewer floor: a low ring of dark stone, rusted iron rungs and a frayed rope hanging down from
  above, a patch of pale daylight falling on it"; p-drain "a large round heavy rusted iron grate over a dark drain hole,
  sluggish green water swirling round it" (its rim came out tan).
- build.py makes art/worldtiles/temple/sewer-*.png: the wall sheet's lower ground transparent (so a wall stands in the
  water as well as on the walkway) and its tops darkened and greyed, the face's reddish pixels greyed; the deck's water
  transparent where it is exactly the plain water tile (posts and shadow stay); the shallows (the plain water tile
  lightened); the decor and prop sheets.
