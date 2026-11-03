# Doors for the mine's walls (2026-11-02)

The user: "Door art also needs help, with a few door styles in different views (n/s/e/w) for each distinct tile set
that join cleanly to the wall tiles & match the local aesthetic." The mine's three tilesets (basalt, goblin masonry,
gnome stone) had no doors of their own: every doorway drew the old 16-px dungeon door scaled up.

The temple's method (assets/wip/temple-doors/): render the real tiles round a doorway, inpaint a rectangle of it
(PixelLab `inpaint_image`, 10 generations each), and keep only that rectangle, so the wall around it is the wall's own
pixels. Here the render is of a made-up map (`render.py` + `scene.js`, 3x3 squares, faces raised as mapview.js
`liftFaces` does), one per side:
- south (a door in the face): `### #+# ...`, mask 70,56 52x104
- north (seen from above, a strip across the wall top): `... #+# ###`, mask 58,56 76x72
- east (a strip across a passage through the wall): `.#. .+. .#.`, mask 58,60 76x72; west is it mirrored

Styles: basalt, a crude goblin door of spiked planks / iron-banded with a padlock, and a portcullis (the hall's gate,
legend `sprite: portcullis`); masonry, an oak door with iron studs under a pointed arch / a barred cell door; gnome
stone, a round-topped door with brass rivets / a brass-bound vault door. Prompts: the top-view ones follow the
temple's ("top-down view straight down: a passage running left to right through the wall ... so it appears only as a
thin vertical strip"). `jobs.txt` lists the jobs, `pull.sh` fetches them, `build.py` cuts them into
`art/worldtiles/ember/doors.png` and prints the props: lines. 20 inpaints, about 200 generations.

The engine now takes `door_locked_<side>` for a locked door before `door_<side>`, a legend `sprite` with a picture
for the side (`portcullis_north`) before both, and no longer counts a doorway beside it (a gate two squares wide) as
the floor it opens on.
