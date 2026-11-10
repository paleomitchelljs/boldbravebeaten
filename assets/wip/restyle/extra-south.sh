# South hills and tarnvale restyle (2026-11-10). Run from the repo root: sh assets/wip/restyle/extra-south.sh
# The lake country's road read the other way up (grass over road): its plain road tile and eight road variants cut out
# as base tiles, and the sheet with its variant rows replaced by the grass variants, so the grass corners vary.
python3 - <<'EOF'
from PIL import Image
w = 'art/worldtiles/west/'; v = 'art/worldtiles/vale/'
road = Image.open(w + 'road.png').convert('RGBA')
tile = lambda c, r: road.crop((c * 64, r * 64, c * 64 + 64, r * 64 + 64))
tile(2, 1).save(v + 'dirt-road.png', optimize=True)
for k in range(8): tile(k % 4, 4 + k // 4).save(v + f'dirt-road-{k + 1}.png', optimize=True)
sheet = road.copy()
for k in range(8): sheet.paste(Image.open(w + f'grass-{k + 1}.png').convert('RGBA'), ((k % 4) * 64, (4 + k // 4) * 64))
sheet.save(v + 'grass-road.png', optimize=True)
EOF
python3 tools/reground.py art/worldtiles/south/fort-wall.png art/worldtiles/south/grass.png art/worldtiles/west/grass.png art/worldtiles/vale/vale-fort.png
