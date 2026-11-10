# Builds the vale's art (art/worldtiles/vale/) from the PixelLab sets in sheets/ (ids.txt): the older areas' river,
# road, granite mountains, mud, scree and forest restyled to the lake country's flat colour. sh fetch.sh first.
#   python3 assets/wip/restyle/build.py "$PWD"
# Then, in order: ground variants (assets/wip/ground/build.py), the cut sheets (tools/cutsheet.py), the moving river
# (assets/wip/water/build.py); this script runs all three. Prints the forest's `cliff:` list (also forest-cliff.txt).
import json, os, subprocess, sys
from PIL import Image
root = sys.argv[1]
here = root + '/assets/wip/restyle/'
out = root + '/art/worldtiles/vale/'
SETS = ['river', 'road', 'slope', 'mud', 'scree', 'forest']
def meta(name):
    d = json.load(open(here + 'sheets/' + name + '.meta.json'))
    return d.get('tileset_data', d)['tiles']
def plain(name, want):
    sheet = Image.open(here + 'sheets/' + name + '.png').convert('RGBA')
    for t in meta(name):
        if all(v == want for v in t['corners'].values()):
            b = t['bounding_box']
            return sheet.crop((b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height']))
def ground(name):
    # The forest's ground: its all-0 tile (a cliff set has no all-lower tile in `corners` terms we can trust).
    sheet = Image.open(here + 'sheets/' + name + '.png').convert('RGBA')
    for t in meta(name):
        if all(v in (0, 255) for r in t['pattern_4x4'].values() for v in r):
            b = t['bounding_box']
            return sheet.crop((b['x'], b['y'], b['x'] + 64, b['y'] + 64))
def cliff(name):
    rows = []
    for t in meta(name):
        b, p = t['bounding_box'], t['pattern_4x4']
        pat = ''.join('.' if v == 255 else str(v) for r in ('row_0', 'row_1', 'row_2', 'row_3') for v in p[r])
        rows.append(f'        - [{b["x"] // 64}, {b["y"] // 64}, "{pat}"]')
    return '\n'.join(rows)

# One gravel and one grass: road and slope stand on the river's gravel, mud, scree and the forest on the lake country's
# grass. Each set's own copy of that ground is made the shared one, pixel by pixel (a no-op when they already match, as
# they did on 2026-11-10).
def unify(name, own, shared):
    img = Image.open(out + name + '.png').convert('RGBA'); px = img.load()
    o, s = own.load(), shared.load(); n = 0
    for y in range(img.height):
        for x in range(img.width):
            if px[x, y] == o[x % 64, y % 64] and px[x, y] != s[x % 64, y % 64]: px[x, y] = s[x % 64, y % 64]; n += 1
    if n: img.save(out + name + '.png', optimize=True)
    print(f'{name}: {n} pixels of its ground replaced')

# The mountains' rings: one set (the granite top -> a higher shelf) climbs ring on ring. A pixel is a ground's if it is
# its plain tile's pixel there; from the second ring both grounds are the shelf's tile, each ring a step paler and
# cooler than the one below, the bank between them toned with its top.
PALE = (214, 222, 232)
def toward(c, t):
    return tuple(round(v + (w - v) * t) for v, w in zip(c[:3], PALE)) + (c[3],)
def ring(k, step=0.1):
    img = Image.open(here + 'sheets/ring.png').convert('RGBA'); px = img.load()
    up, low = plain('ring', 'upper').load(), plain('ring', 'lower').load()
    for y in range(img.height):
        for x in range(img.width):
            c = px[x, y]
            if c == up[x % 64, y % 64]: px[x, y] = toward(c, step * (k - 1))
            elif c == low[x % 64, y % 64]:
                if k > 1: px[x, y] = toward(up[x % 64, y % 64], step * (k - 2))
            else: px[x, y] = toward(c, step * (k - 1.5) if k > 1 else 0)
    return img

# The cut sheets, and how near a pixel must be to the lower ground's to go (0: exact; these sets came clean).
CUT = {'river': 0, 'road': 0, 'slope': 0, 'mud': 0, 'scree': 0, **{f'ring{k}': 0 for k in range(1, 7)}}

if __name__ == '__main__':
    os.makedirs(out, exist_ok=True)
    for n in SETS: Image.open(here + 'sheets/' + n + '.png').save(out + n + '.png', optimize=True)
    plain('river', 'lower').save(out + 'water.png')
    plain('river', 'upper').save(out + 'gravel.png')
    plain('road', 'upper').save(out + 'cobbles.png')
    plain('slope', 'upper').save(out + 'granite.png')
    plain('mud', 'upper').save(out + 'mud-plain.png')
    plain('scree', 'upper').save(out + 'scree-plain.png')
    gravel, grass = plain('river', 'upper'), Image.open(root + '/art/worldtiles/west/grass.png').convert('RGBA')
    for n in ('road', 'slope'): unify(n, plain(n, 'lower'), gravel)
    for n in ('mud', 'scree'): unify(n, plain(n, 'lower'), grass)
    unify('forest', ground('forest'), grass)
    for k in range(1, 7): ring(k).save(out + f'ring{k}.png', optimize=True)
    text = '# forest cliff\n' + cliff('forest')
    open(here + 'forest-cliff.txt', 'w').write(text + '\n')
    print(text)
    run = lambda *a: subprocess.run([sys.executable, *a], check=True)
    run(root + '/assets/wip/ground/build.py', root)
    for n, near in CUT.items(): run(root + '/tools/cutsheet.py', '--near', str(near), out + n + '.png')
    run(root + '/assets/wip/water/build.py', root)
