# Towns: building kits (2026-11-24)

The walked towns (tools/citygen.js, assets/world/cities.yaml) are built from PixelLab building kits. A kit is a
matched set of pieces (floor, walls by outline, doorways, roofs by edge); tools/buildings.py lays them round a
footprint and draws each building type the town asks for as one picture.

The user (2026-11-24): buildings must be orthogonal to the grid, and scaled so the heroes are not taller than them.
The settings that give that:

- `create_building_kit`, `tile_type: square_topdown`, `tile_size: 64` (the open world's cell), `layout: materials`
  (10 generations at any size).
- `tile_view_angle: 90`: the floor is a true 64x64 square, as the game's ground is. The default (about 48 degrees) drew
  it 64x48, foreshortened.
- `wall_tiles: 3`, `wall_angle: 48.19`: a storey is 64 x cos(angle) px, so three of them stand 128 px, exactly two
  squares. The doorway opening is 96 px, a little over a hero (93 px: lizardfolk 1.45 squares). At 45 degrees with
  two tiles the wall was 90 px and the doorway 62, shorter than a hero.

Each piece sits on a 102x246 canvas; a square's floor is (19, 163)-(83, 227). The piece indices (the kit's own
placement rules) are in tools/buildings.py. Every kit unpacks as `p<index>.png` in `<kit>/z/`.

| Kit | Folder | Tile id | Walls / floor / roof (floor2) | Roof |
|---|---|---|---|---|
| Lizardfolk houses | saurian/house | 61d8f72b-1e44-43de-b4f6-7dc967fbb37e | grey-green carved stone blocks, a band of jade-green glazed tiles / worn grey flagstone / thick golden-brown reed thatch | round |
| Lizardfolk civic | saurian/civic | c1729146-0b42-4649-bb42-22a395441de2 | massive pale grey-green dressed stone, carved serpent frieze, copper-green inlay / polished green-veined stone / dark green glazed ceramic roof tiles | gable |
| Elven townhouses | saurian/elven | 721cf5ae-e507-4f98-9320-88164836791b | white lime plaster over dark carved timber frames, leaf patterns / pale wooden planks / mossy green wooden shingles | gable |

All `seed: 7`. Wall descriptions end "16-bit RPG pixel art". Download again:
`https://api.pixellab.ai/mcp/tiles-pro/<id>/download`.

Trials, kept for reference: `saurian/kit` (f7db9f7c-…, default view: the squashed floor) and `saurian/kit90`
(a5225fda-…, floor square, two wall tiles at 45 degrees: walls too low).

## Spend

City art budget (the user, 2026-11-24): about 700 generations. Balance before: 7955.

| What | Generations | Balance after |
|---|---|---|
| Trial kits (default view; view 90 at 45 degrees) | 20 | |
| Zhomelonga's three kits | 30 | 7905 |
