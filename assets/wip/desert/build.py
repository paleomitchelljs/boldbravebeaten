# Builds the desert's art (art/worldtiles/desert/) from the PixelLab sets in sheets/ (ids.txt; sh fetch.sh) and the
# props in props/ (one 16-frame sheet), palms/ (four) and tower.png. All pro, 64 px, high top-down, chained to the
# Tarnhold river's water (base 4f80f29e) and one desert sand (base 1b1d7f41); the foot's gravel is Tarnhold's (091b1684).
#   python3 assets/wip/desert/build.py "$PWD"
# Prints the sandstone's `cliff:` list and the props for data/tilesets.yaml.
import json, os, sys
from PIL import Image
root = sys.argv[1]
here = root + '/assets/wip/desert/'
out = root + '/art/worldtiles/desert/'
SETS = ['shore', 'foot', 'oasis', 'mesa', 'ford']     # water -> sand (beach), sand -> gravel, sand -> oasis grass, sand -> sandstone (cliff), water -> ford
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
PROPS = ['thornbush', 'drygrass', 'aloe', 'pebbles', 'boulder', 'skull', 'column', 'rubble', 'deadtree', 'reeds',
         'papyrus', 'blossom', 'bush', 'ruinwall', 'cairn', 'tumbleweed']
PALMS = ['palm', 'palms', 'youngpalm', 'deadpalm']
def strip(items):
    pieces = []
    for f, n in items:
        im = Image.open(here + f).convert('RGBA')
        pieces.append((n, im.crop(im.getbbox())))
    slot = max(p.width for _, p in pieces) + 2
    h = max(p.height for _, p in pieces)
    sheet = Image.new('RGBA', (slot * len(pieces), h))
    boxes = {}
    for k, (n, p) in enumerate(pieces):
        x, y = k * slot + (slot - p.width) // 2, h - p.height
        sheet.alpha_composite(p, (x, y))
        boxes[n] = [x, y, p.width, p.height]
    return sheet, boxes
if __name__ == '__main__':
    os.makedirs(out, exist_ok=True)
    for n in SETS: Image.open(here + 'sheets/' + n + '.png').save(out + n + '.png', optimize=True)
    plain('shore', 'upper').save(out + 'sand.png')
    plain('oasis', 'upper').save(out + 'grass.png')
    print('# mesa cliff\n' + cliff('mesa'))
    items = [(f'props/{i}.png', n) for i, n in enumerate(PROPS)] + [(f'palms/{i}.png', n) for i, n in enumerate(PALMS)] + [('tower.png', 'tower')]
    sheet, boxes = strip(items)
    sheet.save(out + 'props.png', optimize=True)
    print('# props')
    for n, b in boxes.items(): print(f'    {n}: {json.dumps(["props.png"] + b)}')
