# Front-on props (2026-11-02)

The user: the houses and other props were drawn in an oblique (isometric) view though the grid is square NSEW; they
should face the viewer, and read medieval fantasy ("the bench and fence look too modern, and the tent would fit into a
1950's campground"). Also: campfires, lizardfolk huts, tents for minotaur, orc, gnoll and bandit camps, and clutter
for the temple and the goblin mine.

All from PixelLab `create_map_object` (basic mode, 1 generation each; `ids.txt` lists every object, `pull.sh`
downloads them to `props/`, `sheet.py` makes contact sheets). `build.py` packs the keepers into
`art/worldtiles/front.png` and prints the props: lines.

What worked:
- Buildings: "... Seen from the front and above like a classic 16-bit top-down RPG town: the front wall faces straight
  toward the viewer, parallel to the bottom edge, no corner showing, not isometric", view `high top-down`, 160-192 px.
- Small things came out angled at 64 px. "front view, ... parallel to the bottom edge, symmetrical, seen slightly from
  above", view `low top-down`, 96 px, fixed most of them.
- Lead with "medieval fantasy" and name the materials (rough-hewn timber, wattle, hide, wrought iron, canvas on wooden
  poles). Without it: planed park benches, picket fences, ridge tents.

Still angled after several tries: the bandit tents (`tent_bandit_chief` is the least angled; `tent_bandit` uses the
round canvas tent), the stilt hut, the handcart, the mine cart. Not regenerated (not placed anywhere): the pyramid.
The inn's sign said "MIN": its letters were painted over with the board's colour.
