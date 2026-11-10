# Ground that does not repeat (the user, 2026-11-10: "just the same tile over and over, more ground diversity").
# A flat-style ground tile is one colour with a few marks (tufts, pebbles, cracks), and laid square on square the marks
# make a grid. Here each such tile gets VARIANTS more: its own marks, fewer or more of them, moved to other places;
# one is bare. Marks that touch the tile's edge stay where they are, so every variant joins every other.
#   python3 assets/wip/ground/build.py "$PWD"
# A corner set gets the variants as two more rows of its sheet (all-upper tiles: list them in the terrain's `corners`
# as eight more UUUU and set `vary`); run it before tools/cutsheet.py, which carries the rows into the cut sheet.
# A plain tile gets <tile>-1.png ... beside it (the terrain's `tile` as a list).
import sys, random
from collections import deque
from PIL import Image

root = sys.argv[1] + '/art/worldtiles/'
CELL, VARIANTS = 64, 8
P16 = 'UULU ULUL LULL UULL LUUL ULLL LLLL LLLU ULUU LLUU LLUL LULU UUUU UUUL ULLU LUUU'.split()
WEST = 'LLUL LULU ULUU LLUU ULLU LUUU UUUU UUUL LULL UULL UULU ULUL LLLL LLLU LUUL ULLL'.split()
SHEETS = [  # sheet, its corner order, how far from the ground's colour a pixel is a mark
    ('desert/shore.png', P16, 20), ('west/shore.png', P16, 8), ('west/soil.png', WEST, 10), ('west/road.png', WEST, 10)]
# Not the canyon's shelves or slopes: faceted rock all over, with no marks to move.
TILES = [('west/grass.png', 8)]

def variants(tile, thr, seed):
    px = tile.load(); rnd = random.Random(seed)
    cols = {}
    for y in range(CELL):
        for x in range(CELL): cols[px[x, y][:3]] = cols.get(px[x, y][:3], 0) + 1
    mode = max(cols, key=cols.get)
    mark = [[max(abs(a - b) for a, b in zip(px[x, y][:3], mode)) > thr for x in range(CELL)] for y in range(CELL)]
    # The marks in pieces: pixels within two of each other are one piece.
    piece, pieces = {}, []
    for y in range(CELL):
        for x in range(CELL):
            if not mark[y][x] or (x, y) in piece: continue
            pts, todo = [], deque([(x, y)]); piece[(x, y)] = len(pieces)
            while todo:
                cx, cy = todo.popleft(); pts.append((cx, cy))
                for dy in range(-2, 3):
                    for dx in range(-2, 3):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < CELL and 0 <= ny < CELL and mark[ny][nx] and (nx, ny) not in piece: piece[(nx, ny)] = len(pieces); todo.append((nx, ny))
            pieces.append(pts)
    fixed = [p for p in pieces if any(x < 2 or y < 2 or x > CELL - 3 or y > CELL - 3 for x, y in p)]
    loose = [p for p in pieces if p not in fixed and len(p) < CELL * CELL // 8]
    fixed = [p for p in pieces if p not in loose]
    # The bare tile: each loose mark filled from the nearest ground in its row.
    bare = tile.copy(); bp = bare.load()
    gone = {q for p in loose for q in p}
    for x, y in gone:
        for d in range(1, CELL):
            for nx in ((x - d) % CELL, (x + d) % CELL):
                if not mark[y][nx]: bp[x, y] = px[nx, y]; break
            else: continue
            break
    out = [bare]
    for v in range(1, VARIANTS):
        im = bare.copy(); ip = im.load()
        taken = [(min(x for x, _ in p) - 3, min(y for _, y in p) - 3, max(x for x, _ in p) + 3, max(y for _, y in p) + 3) for p in fixed]
        want = max(1, round(len(loose) * (0.25 + 0.75 * v / (VARIANTS - 1)))) if loose else 0
        for p in rnd.sample(loose, len(loose))[:want]:
            x0, y0 = min(x for x, _ in p), min(y for _, y in p)
            w, h = max(x for x, _ in p) - x0 + 1, max(y for _, y in p) - y0 + 1
            for _ in range(40):
                nx, ny = rnd.randint(3, CELL - 3 - w), rnd.randint(3, CELL - 3 - h)
                box = (nx - 2, ny - 2, nx + w + 2, ny + h + 2)
                if all(box[2] < t[0] or box[0] > t[2] or box[3] < t[1] or box[1] > t[3] for t in taken):
                    for x, y in p: ip[x - x0 + nx, y - y0 + ny] = px[x, y]
                    taken.append(box); break
        out.append(im)
    return out, len(loose), len(fixed)

if __name__ == '__main__':
    for k, (path, corners, thr) in enumerate(SHEETS):
        sheet = Image.open(root + path).convert('RGBA').crop((0, 0, 4 * CELL, 4 * CELL))
        i = corners.index('UUUU')
        vs, loose, fixed = variants(sheet.crop(((i % 4) * CELL, (i // 4) * CELL, (i % 4 + 1) * CELL, (i // 4 + 1) * CELL)), thr, k)
        big = Image.new('RGBA', (4 * CELL, 4 * CELL + CELL * -(-len(vs) // 4))); big.paste(sheet, (0, 0))
        for n, v in enumerate(vs): big.paste(v, ((n % 4) * CELL, (4 + n // 4) * CELL))
        big.save(root + path, optimize=True)
        print(path, loose, 'marks moved,', fixed, 'kept')
    for k, (path, thr) in enumerate(TILES):
        vs, loose, fixed = variants(Image.open(root + path).convert('RGBA'), thr, 100 + k)
        for n, v in enumerate(vs): v.save(root + path[:-4] + f'-{n + 1}.png', optimize=True)
        print(path, loose, 'marks moved,', fixed, 'kept')
