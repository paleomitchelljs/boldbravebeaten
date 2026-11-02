# Builds the southern country's art in art/worldtiles/south/ from the PixelLab sheets in sheets/ (prompts in
# README.md) and the props in props/.
#   python3 assets/wip/south/build.py "$PWD"
# Prints the props: lines for data/tilesets.yaml and each cliff set's `cliff:` list.
import json, os, sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/south/'
out = root + '/art/worldtiles/south/'

def meta(name):
    d = json.load(open(here + 'sheets/' + name + '.meta.json'))
    return d.get('tileset_data', d)['tiles']

def plain(name, want):
    # The tile whose four corners are all `want` (lower or upper).
    sheet = Image.open(here + 'sheets/' + name + '.png').convert('RGBA')
    for t in meta(name):
        if all(v == want for v in t['corners'].values()):
            b = t['bounding_box']
            return sheet.crop((b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height']))

def cliff(name):
    rows = []
    for t in meta(name):
        b, p = t['bounding_box'], t['pattern_4x4']
        pat = ''.join('.' if v == 255 else str(v) for r in ('row_0', 'row_1', 'row_2', 'row_3') for v in p[r])
        rows.append(f'        - [{b["x"] // 64}, {b["y"] // 64}, "{pat}"]')
    return '\n'.join(rows)

def tone_hill(im, grass):
    # The hilltops came out lime, far brighter than the meadow: pull every pixel brighter than the meadow's mean
    # most of the way back toward it (keeping some of its own light and shade), so a hilltop reads a shade lighter.
    gp = list(grass.getdata())
    mean = [sum(p[i] for p in gp) / len(gp) for i in range(3)]
    px, k = im.load(), 0.6
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[1] > mean[1] + 8:
                px[x, y] = tuple(int(p[i] - k * (p[i] - mean[i])) for i in range(3)) + (p[3],)
    return im

def largest_piece(im):
    # Keep the largest 8-connected run of opaque pixels: a 64-px review pack bleeds a sliver of the sprite above
    # into some frames (a pine top over the boulder).
    a = im.split()[3].load()
    W, H = im.size
    seen, best = set(), set()
    for y in range(H):
        for x in range(W):
            if a[x, y] > 0 and (x, y) not in seen:
                comp, stack = set(), [(x, y)]
                seen.add((x, y))
                while stack:
                    cx, cy = stack.pop(); comp.add((cx, cy))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            q = (cx + dx, cy + dy)
                            if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and a[q] > 0:
                                seen.add(q); stack.append(q)
                if len(comp) > len(best): best = comp
    o = Image.new('RGBA', im.size)
    src, dst = im.load(), o.load()
    for p in best: dst[p] = src[p]
    return o

# The sprites, in the strip's order (props/*.png; README.md). Small ones are 64-px review frames (largest piece kept).
SMALL = ['pine', 'fir', 'oak', 'birch', 'boulder', 'rocks', 'stump', 'log', 'cairn', 'milestone', 'roadsign', 'hitch',
         'table', 'campfire', 'banner', 'wildflowers']
LARGE = ['roadinn', 'tavern', 'stable', 'keep', 'watchtower', 'gatetower', 'gatehouse', 'crag']

def strip():
    ims = []
    for n in SMALL + LARGE:
        im = Image.open(here + 'props/' + n + '.png').convert('RGBA')
        if n in SMALL: im = largest_piece(im)
        ims.append((n, im.crop(im.getbbox())))
    w = sum(im.width + 4 for _, im in ims)
    h = max(im.height for _, im in ims)
    sheet = Image.new('RGBA', (w, h))
    x, lines = 0, []
    for n, im in ims:
        sheet.paste(im, (x, 0))
        lines.append(f'    {n}: [props.png, {x}, 0, {im.width}, {im.height}]')
        x += im.width + 4
    sheet.save(out + 'props.png')
    return '\n'.join(lines)

def grass_cut(name):
    # A cliff set with its grass cut away (every clearly green pixel: the granite is grey), drawn where a built wall
    # runs on under the rock (`underWalls: all`), so the rock's edge lies over the wall, not over a strip of grass.
    im = Image.open(out + name + '.png').convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if g > r + 6 and g > b + 6: px[x, y] = (0, 0, 0, 0)
    return im

if __name__ == '__main__':
    os.makedirs(out, exist_ok=True)
    grass = plain('hills-road', 'upper')
    grass.save(out + 'grass.png')
    plain('hills-road', 'lower').save(out + 'path.png')
    plain('cobble-road', 'lower').save(out + 'cobbles.png')
    for n in ('hills-road', 'hill', 'scree', 'cobble-road', 'forest-edge', 'mountain', 'mountain-ledge', 'mountain-summit',
              'fort-wall'):
        sheet = Image.open(here + 'sheets/' + n + '.png').convert('RGBA')
        if n == 'hill': sheet = tone_hill(sheet, grass)
        # Open grass in the flat sets is drawn from their all-grass tile: the one plain grass goes there in each, so
        # the meadow doesn't change shade from one set's grass to the next.
        if n in ('hills-road', 'cobble-road', 'hill', 'scree'):
            side = 'upper' if n in ('hills-road', 'cobble-road') else 'lower'
            for t in meta(n):
                if all(v == side for v in t['corners'].values()):
                    sheet.paste(grass, (t['bounding_box']['x'], t['bounding_box']['y']))
        sheet.save(out + n + '.png')
    grass_cut('mountain').save(out + 'mountain-cut.png')
    print('# props\n' + strip())
    for n in ('forest-edge', 'mountain', 'mountain-ledge', 'mountain-summit', 'fort-wall'):
        print(f'# {n}\n' + cliff(n))
