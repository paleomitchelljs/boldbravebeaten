# Makes a corner set's `cut` sheet: the same 16 tiles with the lower ground cut away, so whatever lies there shows
# (moving water under a shore; a third ground where three meet, which tools/joins.js lists). A pixel is the lower
# ground's if it is the all-lower tile's pixel at that place and joins, through such pixels, a lower corner of its tile.
#   python3 tools/cutsheet.py art/worldtiles/desert/oasis.png [...]     writes oasis-cut.png beside each
# --corners UULU,ULUL,... if the sheet is not in PixelLab's order; --cell 64; --near 0 lets a pixel differ by that much.
import sys
from collections import deque
from PIL import Image
PIXELLAB16 = 'UULU ULUL LULL UULL LUUL ULLL LLLL LLLU ULUU LLUU LLUL LULU UUUU UUUL ULLU LUUU'.split()
def cut(path, corners=PIXELLAB16, cell=64, near=0, cols=4):
    im = Image.open(path).convert('RGBA'); px = im.load()
    k0 = corners.index('LLLL'); lx, ly = (k0 % cols) * cell, (k0 // cols) * cell
    low = im.crop((lx, ly, lx + cell, ly + cell)).load()
    gone = 0
    for k, code in enumerate(corners):
        if 'L' not in code: continue
        x0, y0 = (k % cols) * cell, (k // cols) * cell
        same = lambda x, y: all(abs(a - b) <= near for a, b in zip(px[x0 + x, y0 + y][:3], low[x, y][:3]))
        seen, todo = set(), deque()
        for ch, (cx, cy) in zip(code, ((0, 0), (cell - 1, 0), (0, cell - 1), (cell - 1, cell - 1))):
            if ch == 'L' and same(cx, cy): todo.append((cx, cy)); seen.add((cx, cy))
        while todo:
            x, y = todo.popleft()
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < cell and 0 <= ny < cell and (nx, ny) not in seen and same(nx, ny): seen.add((nx, ny)); todo.append((nx, ny))
        for x, y in seen: px[x0 + x, y0 + y] = (0, 0, 0, 0)
        gone += len(seen)
    out = path[:-4] + '-cut.png'
    im.save(out, optimize=True)
    print(f'{out}: {gone * 100 // (len(corners) * cell * cell)}% cut away')
if __name__ == '__main__':
    a = sys.argv[1:]; kw = {}
    while a and a[0].startswith('--'):
        key, val = a[0][2:], a[1]; a = a[2:]
        kw[key] = val.split(',') if key == 'corners' else int(val)
    for p in a: cut(p, **kw)
