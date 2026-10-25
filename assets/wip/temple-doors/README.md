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
