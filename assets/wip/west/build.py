# Builds the lake country's and the clay canyon's art (art/worldtiles/west/) from the PixelLab sets in sheets/
# (ids.txt) and the map objects in props/ (objs.txt); sh fetch.sh first. README.md has the prompts.
#   python3 assets/wip/west/build.py "$PWD"
# Prints the fortress wall's `cliff:` list and the props for data/tilesets.yaml.
import json, os, sys
from PIL import Image
root = sys.argv[1]
here = root + '/assets/wip/west/'
out = root + '/art/worldtiles/west/'
SETS = ['shore', 'road', 'flag', 'fort', 'slope', 'soil']
def meta(name):
    d = json.load(open(here + 'sheets/' + name + '.meta.json'))
    return d.get('tileset_data', d)['tiles']
def plain(name, want):
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

# The canyon's rings: one set (the clay top -> a higher shelf) climbs ring on ring. A pixel is a ground's if it is its
# plain tile's pixel there; from the second ring both grounds are the shelf's tile, each ring a step paler and tanner
# than the one below (the user: "clay and tan rock"), the bank between them toned with its top.
TAN = (226, 190, 142)
def toward(c, t):
    return tuple(round(v + (w - v) * t) for v, w in zip(c[:3], TAN)) + (c[3],)
def ring(k, step=0.13):
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

def slabs():
    # The wall's top came as one flat colour: joints are drawn on its plain tile (big slabs, a course offset from the
    # next), so a wide roof is not a blank sheet. Only the all-top tile; the rim tiles keep their plain margin.
    img = Image.open(out + 'fort.png').convert('RGBA'); px = img.load()
    for t in meta('fort'):
        p = t['pattern_4x4']
        if any(v not in (1, 255) for r in ('row_0', 'row_1', 'row_2', 'row_3') for v in p[r]): continue
        x0, y0 = t['bounding_box']['x'], t['bounding_box']['y']
        tone = lambda c, k: tuple(min(255, round(v * k)) for v in c[:3]) + (255,)
        for y in range(64):
            for x in range(64):
                c = px[x0 + x, y0 + y]
                joint = y % 32 == 0 or (x == (0 if y < 32 else 32))
                light = y % 32 == 1 or (x == (1 if y < 32 else 33))
                if joint: px[x0 + x, y0 + y] = tone(c, 0.78)
                elif light: px[x0 + x, y0 + y] = tone(c, 1.05)
    img.save(out + 'fort.png', optimize=True)

def strip(items):
    pieces = []
    for n, im in items: pieces.append((n, im.crop(im.getbbox())))
    slot = max(p.width for _, p in pieces) + 2
    h = max(p.height for _, p in pieces)
    sheet = Image.new('RGBA', (slot * len(pieces), h))
    boxes = {}
    for k, (n, p) in enumerate(pieces):
        x, y = k * slot + (slot - p.width) // 2, h - p.height
        sheet.alpha_composite(p, (x, y))
        boxes[n] = [x, y, p.width, p.height]
    return sheet, boxes

def tower():
    # The tower came on a disc of turf: cut it away (grass, its earth rim and the path), so it stands on the paving.
    im = Image.open(here + 'props/tusk_tower.png').convert('RGBA'); px = im.load()
    for y in range(128, im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            grass = g > r * 1.18 and g > b * 1.6
            earth = r > g > b and r - b > 30 and y > 150 and not 45 <= x < 84
            if grass or earth or y >= 176: px[x, y] = (0, 0, 0, 0)
    return im
def door():
    # The tower's own door, for the door in each block's face.
    return Image.open(here + 'props/tusk_tower.png').convert('RGBA').crop((45, 126, 84, 175))
def deck():
    # A square of rope bridge running east-west: Tarnhold's planks turned on their side, a rope rail each side on
    # posts, drawn here.
    sheet = Image.open(root + '/art/worldtiles/tarn/ropebridge.png').convert('RGBA')
    full = next(sheet.crop((x, y, x + 64, y + 64)) for y in range(0, 256, 64) for x in range(0, 256, 64)
                if sheet.crop((x, y, x + 64, y + 64)).getextrema()[3][0] == 255)
    planks = full.rotate(90).crop((0, 12, 64, 50))
    im = Image.new('RGBA', (64, 48)); im.alpha_composite(planks, (0, 5))
    px = im.load()
    rope, dark, post = (168, 128, 84, 255), (74, 50, 34, 255), (112, 78, 50, 255)
    for x in range(64):
        for y0 in (3, 42):
            px[x, y0] = rope if x % 4 else dark
            px[x, y0 + 1] = dark
        px[x, 5], px[x, 41] = dark, dark
        px[x, 44] = px[x, 45] = (20, 24, 28, 90)                  # its shadow on whatever lies below
    for x0 in (6, 38):
        for y0 in (0, 39):
            for y in range(y0, y0 + 7):
                for x in range(x0, x0 + 3): px[x, y] = post if x > x0 else dark
    return im

def below():
    # The gate passage seen from the upper floor: its paving at half size (it is a storey down) and in shadow.
    small = plain('flag', 'lower').convert('RGBA').resize((32, 32), Image.NEAREST)
    im = Image.new('RGBA', (64, 64))
    for x in (0, 32):
        for y in (0, 32): im.paste(small, (x, y))
    return im.point(lambda v: round(v * 0.5)).convert('RGB').convert('RGBA')

def span():
    # The bridge as the upper floor sees it: the deck over the drop.
    im = below(); im.alpha_composite(deck(), (0, 9))
    return im

if __name__ == '__main__':
    os.makedirs(out, exist_ok=True)
    for n in SETS: Image.open(here + 'sheets/' + n + '.png').save(out + n + '.png', optimize=True)
    slabs()
    plain('shore', 'lower').save(out + 'water.png')
    plain('shore', 'upper').save(out + 'grass.png')
    plain('flag', 'lower').save(out + 'flagstone.png')
    plain('soil', 'lower').save(out + 'canyon-soil.png')
    for k in range(1, 7): ring(k).save(out + f'ring{k}.png', optimize=True)
    print('# fort cliff\n' + cliff('fort'))
    names = ['standing_stone', 'tusk_standard', 'brazier', 'reeds', 'egg_nest', 'clay_boulder', 'dead_tree', 'bone_heap', 'horn_totem']
    items = [(n, Image.open(here + f'props/{n}.png').convert('RGBA')) for n in names] + [('tusk_tower', tower()), ('door', door()), ('deck', deck()), ('below', below()), ('span', span())]
    sheet, boxes = strip(items)
    sheet.save(out + 'props.png', optimize=True)
    print('# props')
    for n, b in boxes.items(): print(f'    {n}: {json.dumps(["props.png"] + b)}')
