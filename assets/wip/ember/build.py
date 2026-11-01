# Builds the fire-goblin mine's tiles in art/worldtiles/ember/ from the PixelLab sets (prompts in README.md).
#   python3 assets/wip/ember/build.py "$PWD" [--fetch]
# --fetch downloads each set's sheet and metadata into this folder first. Prints each cliff set's `cliff:` list for
# data/tilesets.yaml (from the metadata: [col, row, the 4x4 pattern, 255 written as '.']).
import json, sys, urllib.request
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/ember/'
out = root + '/art/worldtiles/ember/'
SETS = {
    'basalt-wall': 'c3dc1a8d-8321-4447-9ea8-24f8a84f2ab8',   # basalt floor -> basalt rock (cliff, 25)
    'lava': '80268dd2-d2ce-442c-bc0a-199aa8e0d1f9',          # lava -> basalt floor (16)
    'masonry-wall': '5ba59c78-3119-436a-b6a1-712ecc472d18',  # grey mine-stone flags -> grey masonry (cliff, 25)
    'gnome-wall': '8922c5ae-df65-4feb-a8a4-754da95a6de5',    # mottled slabs -> mottled stone (cliff, 25)
}

def fetch(name, tid):
    base = f'https://api.pixellab.ai/mcp/tilesets/{tid}'
    urllib.request.urlretrieve(base + '/image?inline=true', here + name + '.png')
    urllib.request.urlretrieve(base + '/metadata', here + name + '.meta.json')

def meta(name):
    d = json.load(open(here + name + '.meta.json'))
    return d.get('tileset_data', d)['tiles']

def plain(name, want):
    # The tile whose four corners are all `want` (lower or upper): the plain floor or the plain top.
    sheet = Image.open(here + name + '.png').convert('RGBA')
    for t in meta(name):
        if all(v == want for v in t['corners'].values()):
            b = t['bounding_box']
            return sheet.crop((b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height']))

# How each cliff set's wall tops are toned: (brightness, saturation kept). The basalt's tops came out orange-red and
# read as lava; the masonry's came out near-white. Both are pulled down so the tops recede behind the faces.
TOPS = {'basalt-wall': (0.55, 0.12), 'masonry-wall': (0.3, 0.4), 'gnome-wall': (0.6, 0.7)}

def tone_tops(name, img):
    px = img.load(); bright, sat = TOPS[name]
    for t in meta(name):
        b, p = t['bounding_box'], t['pattern_4x4']
        nw, ne, sw, se = p['row_1'][1], p['row_1'][2], p['row_2'][1], p['row_2'][2]
        top = [nw == 1, ne == 1, sw in (1, 2), se in (1, 2)]   # the face row's square shows the top in its upper half
        for q in range(4):
            if not top[q]: continue
            x0, y0 = b['x'] + (q % 2) * 32, b['y'] + (q // 2) * 32
            for y in range(y0, y0 + 32):
                for x in range(x0, x0 + 32):
                    r, g, bl, a = px[x, y]
                    m = (r + g + bl) / 3
                    px[x, y] = tuple(round((m + (c - m) * sat) * bright) for c in (r, g, bl)) + (a,)
    return img

def cliff(name):
    rows = []
    for t in meta(name):
        b, p = t['bounding_box'], t['pattern_4x4']
        pat = ''.join('.' if v == 255 else str(v) for r in ('row_0', 'row_1', 'row_2', 'row_3') for v in p[r])
        rows.append(f'        - [{b["x"] // 64}, {b["y"] // 64}, "{pat}"]')
    return '\n'.join(rows)

if __name__ == '__main__':
    import os
    os.makedirs(out, exist_ok=True)
    if '--fetch' in sys.argv:   # (Python's own TLS may lack certificates here; curl the two URLs in fetch() instead)
        for n, t in SETS.items(): fetch(n, t)
    for n in SETS:
        try: img = Image.open(here + n + '.png').convert('RGBA')
        except Exception: print(f'# {n}: no sheet yet'); continue
        (tone_tops(n, img) if n in TOPS else img).save(out + n + '.png')
    plain('basalt-wall', 'lower').save(out + 'basalt-floor.png')
    plain('masonry-wall', 'lower').save(out + 'masonry-floor.png')
    plain('gnome-wall', 'lower').save(out + 'gnome-floor.png')
    for n in ('basalt-wall', 'masonry-wall', 'gnome-wall'):
        print(f'# {n}\n' + cliff(n))
