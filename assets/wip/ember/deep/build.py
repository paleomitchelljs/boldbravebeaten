# Builds the giants' citadel art (the user, 2026-11-08: "a basalt castle made by fire giants ... around the dragon's
# lair"): python3 assets/wip/ember/deep/build.py "$PWD"
# tiles/ holds two PixelLab pro cliff sets (fetched with curl from
# https://api.pixellab.ai/mcp/tilesets/<id>/image?inline=true and /metadata) sharing one floor of giant-cut basalt
# flagstones; props/ the frames of one 1-direction object sheet. Out: art/worldtiles/citadel/. Prints the `cliff:`
# lists and the props for data/tilesets.yaml.
import json, os, sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/ember/deep/'
out = root + '/art/worldtiles/citadel/'

SETS = {
    'citadel-wall': '5d0718b6-ca6d-4276-aee4-c0f4ef899434',  # flagstones -> the giants' dressed basalt walls (cliff, 25)
    'citadel-cave': 'ceb2e2d6-e013-436f-931b-0f302cb2a834',  # flagstones -> black glassy cavern rock (cliff, 25)
}
# Wall tops darkened (brightness, saturation kept): they came out the same grey as the floor and read as floor.
TOPS = {'citadel-wall': (0.45, 0.6), 'citadel-cave': (0.5, 0.6)}

def meta(name):
    d = json.load(open(here + 'tiles/' + name + '.meta.json'))
    return d.get('tileset_data', d)['tiles']

def plain(name, want):
    sheet = Image.open(here + 'tiles/' + name + '.png').convert('RGBA')
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

def tone_tops(name, img):
    px = img.load(); bright, sat = TOPS[name]
    for t in meta(name):
        b, p = t['bounding_box'], t['pattern_4x4']
        nw, ne, sw, se = p['row_1'][1], p['row_1'][2], p['row_2'][1], p['row_2'][2]
        top = [nw == 1, ne == 1, sw in (1, 2), se in (1, 2)]
        for q in range(4):
            if not top[q]: continue
            x0, y0 = b['x'] + (q % 2) * 32, b['y'] + (q // 2) * 32
            for y in range(y0, y0 + 32):
                for x in range(x0, x0 + 32):
                    r, g, bl, a = px[x, y]
                    m = (r + g + bl) / 3
                    px[x, y] = tuple(round((m + (c - m) * sat) * bright) for c in (r, g, bl)) + (a,)
    return img

# The prop sheet's frames (object f17febe1, 16 at 64 px), each trimmed and laid in a 64-px slot.
PROPS = ['c_brazier', 'c_statue', 'c_table', 'c_chair', 'c_anvil', 'c_forge', 'c_dragon', 'c_whitedragon',
         'c_coffin', 'c_sphere', 'c_banner', 'c_rack', 'c_bed', 'c_cauldron', 'c_bench', 'c_hoard']

def props():
    pieces = [Image.open(f'{here}props/{i}.png').convert('RGBA') for i in range(len(PROPS))]
    pieces = [p.crop(p.getbbox()) for p in pieces]
    sheet = Image.new('RGBA', (64 * len(pieces), 64))
    boxes = {}
    for k, (n, p) in enumerate(zip(PROPS, pieces)):
        x, y = k * 64 + (64 - p.width) // 2, 64 - p.height
        sheet.alpha_composite(p, (x, y))
        boxes[n] = ['props.png', x, y, p.width, p.height]
    sheet.save(out + 'props.png', optimize=True)
    return boxes

if __name__ == '__main__':
    os.makedirs(out, exist_ok=True)
    for n in SETS:
        tone_tops(n, Image.open(here + 'tiles/' + n + '.png').convert('RGBA')).save(out + n + '.png', optimize=True)
        print(f'# {n}\n' + cliff(n))
    plain('citadel-wall', 'lower').save(out + 'flags.png')
    print('# props')
    for n, b in props().items(): print(f'    {n}: {json.dumps(b)}')
