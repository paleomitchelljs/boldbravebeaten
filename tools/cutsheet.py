# Makes a corner set's `cut` sheet: the same 16 tiles with the lower ground cut away, so whatever lies there shows
# (moving water under a shore; a third ground where three meet, which tools/joins.js lists). A pixel is the lower
# ground's if it is the all-lower tile's pixel at that place and joins, through such pixels, a lower corner of its tile.
#   python3 tools/cutsheet.py art/worldtiles/desert/oasis.png [...]     writes oasis-cut.png beside each
# --corners UULU,ULUL,... if the sheet is not in PixelLab's order; --cell 64; --near 0 lets a pixel differ by that much.
# --cliff: a 25-tile cliff set (forest, canopy, a cliff of rock) in PixelLab's layout: each tile's lower corners are read
# from its 4x4 pattern (the CLIFF list below, as in data/tilesets.yaml), the all-lower tile is the one at column 2, row 2.
import sys
from collections import deque
from PIL import Image
PIXELLAB16 = 'UULU ULUL LULL UULL LUUL ULLL LLLL LLLU ULUU LLUU LLUL LULU UUUU UUUL ULLU LUUU'.split()
# PixelLab's 25-tile cliff layout: [col, row, pattern] (the pattern's middle four are NW NE SW SE; 0 lower).
CLIFF = [[2, 2, '.....00..00.....'], [3, 2, '.....00..01.....'], [1, 4, '.....00..11.....'], [2, 4, '.....00..10.....'],
         [3, 3, '.00..01..01.....'], [3, 4, '.....01..01.....'], [0, 6, '.....11..11.....'], [1, 0, '.11..10..10.....'],
         [1, 1, '.....10..10.....'], [0, 4, '.....10..11.....'], [3, 6, '.....01..11.....'], [1, 6, '.....11..12...0.'],
         [3, 0, '.....11..22..00.'], [1, 2, '.....10..20..00.'], [1, 7, '.1...12..10.....'], [3, 1, '.11..22..00.....'],
         [1, 3, '.....20..00.....'], [2, 0, '.....01..02..00.'], [0, 0, '.....11..21..0..'], [2, 6, '.....10..21..01.'],
         [2, 1, '.....02..00.....'], [0, 1, '..1..21..01.....'], [2, 7, '.10..21..01.....'], [0, 2, '.....01..12..10.'],
         [0, 3, '.01..12..10.....']]
def cut(path, corners=PIXELLAB16, cell=64, near=0, cols=4, cliff=0):
    im = Image.open(path).convert('RGBA'); px = im.load()
    if cliff:
        tiles = [((c, r), ''.join('L' if p[i] == '0' else 'U' for i in (5, 6, 9, 10))) for c, r, p in CLIFF]
        lx, ly = 2 * cell, 2 * cell
    else:
        tiles = [((k % cols, k // cols), code) for k, code in enumerate(corners)]
        k0 = corners.index('LLLL'); lx, ly = (k0 % cols) * cell, (k0 // cols) * cell
    low = im.crop((lx, ly, lx + cell, ly + cell)).load()
    gone = 0
    for (tc, tr), code in tiles:
        if 'L' not in code: continue
        x0, y0 = tc * cell, tr * cell
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
    print(f'{out}: {gone * 100 // (len(tiles) * cell * cell)}% cut away')
if __name__ == '__main__':
    a = sys.argv[1:]; kw = {}
    while a and a[0].startswith('--'):
        if a[0] == '--cliff': kw['cliff'] = 1; a = a[1:]; continue
        key, val = a[0][2:], a[1]; a = a[2:]
        kw[key] = val.split(',') if key == 'corners' else int(val)
    for p in a: cut(p, **kw)
