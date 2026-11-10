# Moving water (the user, 2026-11-10: "animated water (different for rivers and lakes)"). Made here by code from each
# place's own plain water tile, so the palette and the drawn wave marks are the art's and the loop closes exactly:
#   python3 assets/wip/water/build.py "$PWD"
# Writes, beside each tile, <tile>-anim.png: FRAMES frames of one seamless SIZE x SIZE surface, COLS to a row (the
# `anim` of a tileset terrain; the shore sets over it need a `cut` sheet, tools/cutsheet.py).
#   river  the tile slides south a whole tile a loop (so it joins), its marks swaying sideways on a slow noise, each
#          part of the surface out of step with the next: a current.
#   lake   nothing travels: the marks rock a pixel or two in place and each fades out and comes back on its own beat,
#          a few catching the light as they return.
# A river on these maps runs any way it likes and the current always runs down the screen: one sheet, not one per bend.
import sys, math
import numpy as np
from PIL import Image

root = sys.argv[1]
SIZE, FRAMES, COLS, CELL = 512, 16, 4, 64
WATER = [  # tile (under art/worldtiles/), kind
    ('highland/water.png', 'river'),
    ('orc/moat-water.png', 'lake'),
    ('west/water.png', 'lake'),
    ('outside/water.png', 'lake'),
    ('jungle/water.png', 'lake'),
    ('vale/water.png', 'river'),
]

def vnoise(x, y, grid):
    p = grid.shape[0]
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    g = lambda i, j: grid[j % p, i % p]
    a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx
    b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx
    return a + (b - a) * sy

def field(cell, seed):
    # Smooth noise in 0..1 that tiles every SIZE pixels; `cell` pixels to a lattice square.
    Y, X = np.mgrid[0:SIZE, 0:SIZE].astype(float)
    return vnoise(X / cell, Y / cell, np.random.default_rng(seed).random((SIZE // cell, SIZE // cell)))

def build(path, kind):
    tile = np.asarray(Image.open(root + '/art/worldtiles/' + path).convert('RGB'))
    lum = tile.astype(float) @ np.array([0.3, 0.59, 0.11])
    cols = sorted({tuple(c) for c in tile.reshape(-1, 3)}, key=lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2])
    base = np.array(max(cols, key=lambda c: (tile.reshape(-1, 3) == c).all(1).sum()))      # the commonest colour: open water
    light = np.array(cols[-1])
    Y, X = np.mgrid[0:SIZE, 0:SIZE]
    p1, p2, p3 = field(128, 5), field(128, 9), field(64, 13)
    sheet = Image.new('RGB', (COLS * SIZE, -(-FRAMES // COLS) * SIZE))
    for f in range(FRAMES):
        s = f / FRAMES; th = 2 * math.pi * s
        if kind == 'river':
            dx = np.rint(2.6 * np.sin(th + p1 * 2 * math.pi * 2) + 1.2 * np.sin(2 * th + p3 * 2 * math.pi)).astype(int)
            dy = np.rint(1.5 * np.sin(th + p2 * 2 * math.pi * 2)).astype(int) - round(s * CELL)
            img = tile[(Y + dy) % CELL, (X + dx) % CELL]
        else:
            dx = np.rint(1.6 * np.sin(th + p1 * 2 * math.pi * 2)).astype(int)
            dy = np.rint(1.1 * np.sin(th + p2 * 2 * math.pi * 2)).astype(int)
            u, v = (X + dx) % CELL, (Y + dy) % CELL
            img = tile[v, u].copy()
            # Each mark on its own beat: under the water for a third of the loop, bright as it comes back.
            beat = (s + p3 * 3 + p1) % 1
            mark = lum[v, u] > lum.mean() + 0.35 * lum.std()
            img[mark & (beat < 0.3)] = base
            img[mark & (beat > 0.3) & (beat < 0.42) & (lum[v, u] > lum.mean() + 1.2 * lum.std())] = light
        sheet.paste(Image.fromarray(img.astype(np.uint8)), ((f % COLS) * SIZE, (f // COLS) * SIZE))
    out = root + '/art/worldtiles/' + path[:-4] + '-anim.png'
    sheet.quantize(colors=min(64, len(cols) + 1), dither=Image.Dither.NONE).save(out, optimize=True)
    print(out[len(root) + 1:], kind, len(cols), 'colours')

if __name__ == '__main__':
    for path, kind in WATER: build(path, kind)
