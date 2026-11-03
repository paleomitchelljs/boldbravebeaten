# Cuts the inpainted doors (out-<set>-<side>-<style>.png; style door, locked, or portcullis: a legend `sprite`) into art/worldtiles/ember/doors.png and prints the props:
# lines for each mine tileset in data/tilesets.yaml.  python3 assets/wip/doors/build.py "$PWD"
# Each render is 3x3 squares with the doorway in the middle (its top-left at 64, 64); the rectangle inpainted is cut
# out and laid at its offset from the doorway's square. A west door is the east one mirrored.
import sys, os
from PIL import Image, ImageOps
root = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
RECT = {'south': (70, 56, 52, 104), 'east': (58, 60, 76, 72), 'north': (58, 56, 76, 72)}
SETS = {'basalt': 'ember_basalt', 'masonry': 'ember_masonry', 'gnome': 'ember_gnome'}
pieces = []
for n in SETS:
    for style in ('door', 'locked', 'portcullis'):
        for side in ('south', 'east', 'west', 'north'):
            src = 'east' if side == 'west' else side
            f = f'{here}/out-{n}-{src}-{style}.png'
            if not os.path.exists(f):
                continue
            x, y, w, h = RECT[src]
            im = Image.open(f).convert('RGBA').crop((x, y, x + w, y + h))
            if side == 'west':
                im = ImageOps.mirror(im)
            key = {'door': 'door_', 'locked': 'door_locked_', 'portcullis': 'portcullis_'}[style] + side
            pieces.append((n, key, im, x - 64, y - 64))
W = sum(p[2].width + 2 for p in pieces)
sheet = Image.new('RGBA', (W, max(p[2].height for p in pieces)))
x, lines = 0, {}
for n, key, im, dx, dy in pieces:
    sheet.paste(im, (x, 0))
    lines.setdefault(n, []).append(f'    {key}: [doors.png, {x}, 0, {im.width}, {im.height}, {dx}, {dy}]')
    x += im.width + 2
sheet.save(root + '/art/worldtiles/ember/doors.png', optimize=True)
for n, ls in lines.items():
    print(f'# {SETS[n]}'); print('\n'.join(ls))
