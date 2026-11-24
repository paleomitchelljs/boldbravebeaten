# The five cities seen from outside (2026-11-24)

TILES_TO_GET W1 item 7. One PixelLab `create_1_direction_object` each (256 px, top-down view, 10 generations), drawn
as the `C` prop of every city stamp in `assets/world/w1-layout.yaml`: the picture stands four squares wide on the
stamp's walled block, its gate on the square the party arrives at.

| City | Object id | Prompt (each ends "16-bit RPG pixel art") |
|---|---|---|
| Zhomelonga | 066be66c-7d27-4f08-ab65-65a7cfcab872 | a walled lizardfolk river-fortress city seen from above at a three-quarter angle: a great stepped stone pyramid rising at its centre behind thick grey-green stone walls, a tall carved stone gate facing south, stepped plazas, reed-thatched roofs and a copper smelter's smoking chimney, palms between the buildings |
| Muawi | 9f33069c-dd61-48fd-b0bc-232b8bcdc096 | a lizardfolk lake city seen from above at a three-quarter angle: reed-thatched stone houses crowded on a low island, a long stone causeway running south from its gate, a small stepped pyramid among the roofs, wooden pontoons of a floating market on the water at its edge |
| Burbuma | 16da7a7c-7456-415a-b4ea-aa83afdf9c51 | a frontier town seen from above at a three-quarter angle: a half-built wall, part grey stone and part rough log palisade, a timber gatehouse facing south, timber inns and farmhouses with thatched roofs inside, canvas trade tents and a wooden watchtower |
| Barjiy | ee2986f9-5dc3-4f27-9ee9-c8ed92fcf2c8 | a walled human city seen from above at a three-quarter angle: crenellated grey stone walls with round towers flying red banners, iron-shod twin-towered gatehouse facing south, red clay-tiled roofs inside and a tall cathedral of dark stone at its centre |
| Emagshir | 9798995e-5f4c-4b26-b8dc-52d5ed072ce0 | a sun-baked walled port city seen from above at a three-quarter angle: pale sandstone walls and a gate facing south, flat-roofed whitewashed houses with awnings, a tall lighthouse tower, a stone harbour wall at the back with two sailing ships moored |

Download any of them again: `https://api.pixellab.ai/mcp/map-objects/<id>/download`.

- `raw/` holds the pictures as PixelLab made them.
- The top-level PNGs are the ones in use. Three are unchanged. **Muawi** and **Emagshir** came with their water left
  transparent, so the pontoons and ships sat on the grass. The lake country's water (`west/water.png`) is painted under
  them by hand, edged with a pale inner line (#9ad8d0) and a dark rim (#243a30):
  - Muawi's water is an ellipse (6, 8, 250, 236).
  - Emagshir's is a polygon behind the harbour wall.
- `art/worldtiles/cities.png` is the five in a 1280x256 strip, in the order Zhomelonga, Muawi, Burbuma, Barjiy,
  Emagshir.
- They are drawn as `city_<name>` props in `w1_wild`, `w1_jungle` and `w1_desert` (`data/tilesets.yaml`).
- Burbuma, Barjiy and Emagshir are cut to the picture's height (245, 243 and 240 px), so their gate stands on the
  square's foot.
