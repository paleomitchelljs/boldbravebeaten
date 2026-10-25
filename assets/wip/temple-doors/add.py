# Appends inpainted rectangles to art/worldtiles/temple/temple-doors.png and records them in rects.json.
#   python3 assets/wip/temple-doors/add.py "$PWD"
# Each entry: name, the inpaint output, the mask rect in it (x, y, w, h), and the door square's top-left in it; the
# rect's offset from that square is the prop's [dx, dy]. A name already in rects.json is left where it is.
import sys, json
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/temple-doors/'
sheet_path = root + '/art/worldtiles/temple/temple-doors.png'
NEW = [
    ('palace_east', 'out-palace-W.png', (0, 70, 140, 52), (64, 64)),     # the palace's way out, in the west wall
    ('pstair_east', 'out-pstair-E.png', (56, 70, 80, 52), (64, 64)),     # a door in a narrow palace wall
    ('walltop_east', 'out-wall-E.png', (56, 70, 80, 52), (64, 64)),      # the guardhouse door on the wall top
    ('palace_down', 'out-palace-D.png', (116, 112, 88, 104), (128, 128)),  # the stairwell down in the hall's niche
]
rects = json.load(open(here + 'rects.json'))
sheet = Image.open(sheet_path).convert('RGBA')
for name, f, (x, y, w, h), (sx, sy) in NEW:
    if name in rects:
        continue
    piece = Image.open(here + f).convert('RGBA').crop((x, y, x + w, y + h))
    at = sheet.width
    grown = Image.new('RGBA', (at + w, max(sheet.height, h)), (0, 0, 0, 0))
    grown.paste(sheet, (0, 0))
    grown.paste(piece, (at, 0))
    sheet = grown
    rects[name] = [at, 0, w, h, x - sx, y - sy]
sheet.save(sheet_path)
json.dump(rects, open(here + 'rects.json', 'w'))
for name, *_ in NEW:
    print(f'    {name}: [temple-doors.png, ' + ', '.join(map(str, rects[name])) + ']')
