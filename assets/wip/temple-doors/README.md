# Doorways and steps, cut to fit their walls (2026-10-24)

The user: "Doors and stairs need some transition to walls." With `doorsInWall` the wall is drawn unbroken through a
doorway, and the door is a picture laid over it. Each picture was made by rendering the real tiles around a door
(`<name>.png`, 3x3 or 4x3 squares at art scale, no decor) and inpainting a rectangle of it with PixelLab
(`inpaint_image`, 10 generations each), so the rest of the image, and the join, stays exactly the wall's. The result is
`out-<name>.png`; the inpainted rectangle is cut out into `art/worldtiles/temple/temple-doors.png` (rects and offsets
from the door's square in `rects.json`).

- court-gate (the gate out, floor east; mask 0,70 110x52): "seen from directly above: a gateway cut through the thick
  sandstone wall, a worn stone threshold running left to right with a heavy closed wooden gate of dark planks and bronze
  bands lying across it, stone jambs, the plain wall top on either side". A white bar came out at its top; painted
  over with the wall-top colour.
- court-steps (steps up the west wall, floor east; mask 70,68 100x56): "seen from above: a narrow flight of worn
  sandstone steps built against the wall, climbing from the grass on the right up onto the flat top of the wall on the
  left, each step a little lighter, small stone blocks at its side". Used for both flights.
- court-L (the south door, floor north; mask 72,108 48x148): as the gate, "a doorway ... threshold running top to bottom".
- court-P (the palace door, floor west; mask 86,70 106x52): "a carved and painted doorway ... carved stone jambs".
- maze-N (the labyrinth's way in, a door in the face; mask 74,66 44x84): "a heavy closed wooden door of dark planks with
  bronze bands set into the small-block stone wall face, a carved stone frame and lintel around it, its foot on the
  floor".
- maze-E (the east door, floor west; mask 86,70 106x52): as court-L. Came out small.
- wall-door (the guardhouse doors on the wall top, in the face; mask 74,56 44x94): as maze-N, "its foot on the paving".

The renders come from `render.py` (it runs `plan.js`, planTiles in Node, and composites in Python with Pillow):
`python3 assets/wip/temple-doors/render.py "$PWD" temple_court 0 14 2 16 out.png`. To redo one, render the door's
surroundings the same way and inpaint the same rectangle.

## Redone: doors in east and west walls (out3-*)

The user: "The doors all seem to be north-south oriented and so the doors in east/west walls are rotated incorrectly."
The first gate, palace door and labyrinth east door came out as a door seen face-on, which only reads in a wall that
runs east-west. Seen from above, a door in a wall that runs north-south closes a passage running left to right, so it
shows as a thin strip of planks running top to bottom. Prompt (the gate's; the others the same with "door"):
"top-down view straight down: a stone-floored passage running left to right through the thick sandstone wall. Across
the passage stands a closed heavy wooden gate seen from directly above, so it appears only as a thin vertical strip of
dark wood plank edges with bronze fittings running from the top of the passage to the bottom, set between square stone
jambs. The plain wall top above and below the passage." The masks now run to the wall's edge (gate 0,70 122x52; palace
70,70 122x52; labyrinth 122,70 70x52). The labyrinth's came out with no door; the gate's door strip (columns 103-112)
was pasted into it. The first versions are still in the sheet, unused.

## Doors in north-south walls, the palace's way out, its stair down (2026-10-25)

The user: "some objects (eg doors) are not flush" and "we should probably use pixel lab to generate east-west opening
doors". The palace's doors in its narrow north-south walls, its way out to the court and the guardhouse door on the
wall top were drawn face-on in the gap (the palace set had no `doorsInWall`, the wall top no `door_east`). Now the
palace draws doorways as wall too, and each picture is inpainted into a render of its own spot, with the gate's prompt
("a passage running left to right through the wall ... a closed heavy wooden door seen from directly above, so it
appears only as a thin vertical strip"):

- pstair-E (a door in a one-square palace wall, temple_palace_stair 7..9, 6..8; mask 56,70 80x52): the palace's
  `door_east` and `door_west`. The passage came out grey stone, lighter than the floor.
- palace-W (the way out, temple_palace 0..2, 14..16; mask 0,70 140x52): `palace_gate`, the W legend's sprite.
- wall-E (the guardhouse door, temple_wall 4..6, 7..9; mask 56,70 80x52): the wall top's `door_east`.
- palace-D (the stair down in the great hall's niche, temple_palace 28..31, 27..30; mask 116,112 88x104): "a
  rectangular stairwell cut into the dark grey-brown stone slab floor, a flight of worn sandy yellow-tan stone steps
  descending downward toward the bottom of the image, each step lower and darker, fading into deep shadow at the
  bottom under the wall" (the palace's `stair_down`; the map object had come out a dark box).

render.py now draws plain ground under a corner set (the palace's floor has no tile of its own). add.py appends the
cut rectangles to temple-doors.png and records them in rects.json.
