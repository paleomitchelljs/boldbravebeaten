# Builds the outdoor maps' art in art/worldtiles/outside/ from the PixelLab sheets here (prompts in README.md).
#   python3 assets/wip/outside/build.py "$PWD"
# Prints the props: lines for data/tilesets.yaml (each sprite cropped to what it draws and packed in one strip) and the
# jungle edge's `cliff:` list (from its metadata: [col, row, the 4x4 pattern, 255 written as '.']).
import json, os, sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/outside/'
out = root + '/art/worldtiles/outside/'

def meta(name):
    d = json.load(open(here + name + '.meta.json'))
    return d.get('tileset_data', d)['tiles']

def plain(name, want):
    # The tile whose four corners are all `want` (lower or upper).
    sheet = Image.open(here + name + '.png').convert('RGBA')
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

# The sprites, in the strip's order (props/*.png, from three create_1_direction_object calls; README.md).
PROPS = ['cottage', 'inn', 'smithy', 'shop', 'arch', 'minemouth', 'pyramid', 'totem',
         'well', 'stall', 'fence', 'signpost', 'haystack', 'woodpile', 'trough', 'handcart', 'barrels', 'crates',
         'bench', 'garden', 'bush', 'tree', 'scarecrow', 'lamppost']

def strip():
    ims = []
    for n in PROPS:
        im = Image.open(here + 'props/' + n + '.png').convert('RGBA')
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

def plain_grass():
    # The temple court's plain grass (assets/wip/temple-court/grass-plain.png) still has a brick in one corner, which
    # repeats as a checker over open ground: its tan pixels (and their outline) are patched from grass elsewhere in the
    # tile, wrapping, so the tile still repeats. Variety comes from decor pieces scattered over it.
    im = Image.open(root + '/assets/wip/temple-court/grass-plain.png').convert('RGBA')
    px, (W, H) = im.load(), im.size
    bad = {(x, y) for y in range(H) for x in range(W) if px[x, y][0] > px[x, y][1] - 4 and px[x, y][0] > 90}
    mask = set(bad)
    for x, y in bad:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = ((x + dx) % W, (y + dy) % H)
                if px[q][0] > px[q][1] - 12: mask.add(q)
    out_im = im.copy(); po = out_im.load()
    for x, y in mask:
        for ox, oy in ((17, 9), (23, 31), (31, 17), (9, 23), (40, 5)):
            q = ((x + ox) % W, (y + oy) % H)
            if q not in mask: po[x, y] = px[q]; break
    return out_im

def wall_cut():
    # The court's wall with its ground cut away (every green pixel: the sheet's 16 colours are tan stone, brown lip and
    # face, and seven greens of grass), so where the pyramids are built into the wall its edge lies over their tiers.
    im = Image.open(root + '/art/worldtiles/temple/court-wall.png').convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if g > r: px[x, y] = (0, 0, 0, 0)
    return im

if __name__ == '__main__':
    os.makedirs(out, exist_ok=True)
    grass = plain_grass()
    grass.save(out + 'grass.png')
    for n in ('swamp-water', 'village-path', 'jungle-edge'):
        try: sheet = Image.open(here + n + '.png').convert('RGBA')
        except FileNotFoundError: print(f'# {n}: no sheet yet'); continue
        # In the two flat sets grass is the upper terrain, so open grass is drawn from their all-upper tile: the plain
        # grass goes there too, or the court's bricks come back as a checker.
        if n != 'jungle-edge':
            for t in meta(n):
                if all(v == 'upper' for v in t['corners'].values()):
                    sheet.paste(grass, (t['bounding_box']['x'], t['bounding_box']['y']))
        sheet.save(out + n + '.png')
    plain('swamp-water', 'lower').save(out + 'water.png')
    plain('village-path', 'lower').save(out + 'path.png')
    wall_cut().save(root + '/art/worldtiles/temple/court-wall-cut.png')
    print('# props\n' + strip())
    if os.path.exists(here + 'jungle-edge.meta.json'): print('# jungle-edge\n' + cliff('jungle-edge'))
