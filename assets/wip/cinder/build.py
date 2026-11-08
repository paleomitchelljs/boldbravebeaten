# Builds the second pass of the fire-goblin mine's art and the Black Hills outside it (the user, 2026-11-07: the
# warm umber caves of the old goblin-cave screenshots; rocky hills and mounds of basalt and old flows outside):
#   python3 assets/wip/cinder/build.py "$PWD"
# Sheets (PixelLab pro tilesets, fetched with curl from https://api.pixellab.ai/mcp/tilesets/<id>/image?inline=true
# and /metadata into this folder) and decor (1-direction objects, one frame a file in wall/, floor/, hills/) become
# art/worldtiles/cinder/. Prints each cliff set's `cliff:` list and each strip's pieces for data/tilesets.yaml.
import json, sys
import numpy as np
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/cinder/'
out = root + '/art/worldtiles/cinder/'

SETS = {
    'mine-wall': '4bc07a72-21a8-40a8-bf1b-48ddcbbe1384',   # umber floor -> umber cave rock (cliff, 25)
    'lava-floor': '6940bb94-dee4-4a29-a674-4e3eb0586930',  # lava -> umber floor (16)
    'lava-ash': 'a4b3a080-aecc-4892-ad99-6c7c1e1c52cf',    # lava -> ash (16)
    'flow': '1ea280f7-2a3f-4a18-9afc-543c48a06868',        # ash -> old cooled flow (raised, 16)
    'path': '494e8251-fefd-4b12-99be-da3ffa2e6f84',        # ash -> umber floor, the trodden way to the mine (16)
    'hill': 'd12be571-d986-4cbc-97f1-5217ef3003a6',        # ash -> basalt hill (cliff, 25)
    'crag': '6a983f0d-b6c3-4cd5-94fa-374a965a44d6',        # hill top -> crag (cliff, 25)
}
CLIFFS = ('mine-wall', 'hill', 'crag')

def meta(name):
    d = json.load(open(here + name + '.meta.json'))
    return d.get('tileset_data', d)['tiles']

def plain(name, want):
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

# Wall tops toned (brightness, saturation kept): the crag's came out bright rust-orange and read as lava.
TOPS = {'crag': (0.55, 0.45)}

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

def cut(name):
    # The sheet with its molten lava made transparent (as assets/wip/lava/build.py does for the first lava sheet), so
    # the moving lava drawn under the map shows through; crust flecks floating inside a tile go too.
    a = np.array(Image.open(here + name + '.png').convert('RGBA'))
    lum = a[..., 0].astype(int) + a[..., 1]
    keep = ~((a[..., 0] >= 200) & (lum >= 280))
    H, W = keep.shape
    seen = np.zeros_like(keep)
    for ty in range(0, H, 64):
        for tx in range(0, W, 64):
            for y in range(ty, ty + 64):
                for x in range(tx, tx + 64):
                    if not keep[y, x] or seen[y, x]: continue
                    stack, comp, border = [(x, y)], [], False
                    seen[y, x] = True
                    while stack:
                        cx, cy = stack.pop(); comp.append((cx, cy))
                        if cx in (tx, tx + 63) or cy in (ty, ty + 63): border = True
                        for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                            if tx <= nx < tx + 64 and ty <= ny < ty + 64 and keep[ny, nx] and not seen[ny, nx]:
                                seen[ny, nx] = True; stack.append((nx, ny))
                    if not border and len(comp) < 200:
                        for cx, cy in comp: keep[cy, cx] = False
    a[..., 3] = np.where(keep, 255, 0)
    Image.fromarray(a).save(out + name + '-cut.png', optimize=True)

# Decor strips: (strip, [(folder, frame, name)]). Each piece is trimmed to its pixels and laid in a 64-px slot.
STRIPS = {
    'cave-decor': [('floor', i, n) for i, n in [
        (0, 'rocks'), (1, 'crack'), (2, 'rubble'), (3, 'pebbles'), (6, 'ore'), (7, 'stalagmite'), (9, 'embers'),
        (10, 'crystals'), (16, 'stalagmites'), (17, 'crack2'), (19, 'coal'), (32, 'shrooms'), (33, 'stone'),
        (34, 'ember'), (56, 'spikes'), (57, 'bones'), (59, 'coal2'), (5, 'skull'), (14, 'vent'), (4, 'crust')]],
    'cave-clutter': [('floor', i, n) for i, n in [
        (11, 'pickaxe'), (12, 'coins'), (13, 'pot'), (24, 'helm'), (25, 'sack'), (26, 'wheel'), (31, 'crate'),
        (39, 'ladder'), (44, 'lantern'), (48, 'anvil'), (49, 'rope'), (54, 'spears'), (61, 'hammer'), (62, 'bucket'),
        (38, 'boots'), (21, 'junk')]],
    'cave-wall': [('wall', i, n) for i, n in [
        (0, 'torch'), (1, 'banner'), (2, 'swag'), (3, 'glyph'), (5, 'brazier'), (6, 'seep'), (7, 'timber'),
        (8, 'shelf'), (9, 'shield'), (10, 'chains'), (11, 'handprints'), (12, 'torch2'), (13, 'runes'), (14, 'lantern'),
        (15, 'banner2')]],
    'hills-props': [('hills', i, n) for i, n in [
        (0, 'boulder'), (1, 'spire'), (2, 'columns'), (3, 'flowmound'), (4, 'deadtree'), (5, 'fumarole'),
        (6, 'scree'), (7, 'obsidian'), (8, 'lavarock'), (9, 'cairn'), (10, 'boulders'), (11, 'stump'),
        (12, 'lavapool'), (13, 'spire2'), (14, 'ribs'), (15, 'signpost')]],
}

def strip(name, items):
    slots, boxes = [], {}
    for k, (folder, i, n) in enumerate(items):
        im = Image.open(f'{here}{folder}/{i}.png').convert('RGBA')
        bb = im.getbbox()
        piece = im.crop(bb)
        slots.append(piece)
        boxes[n] = [name + '.png', k * 64, 0, piece.width, piece.height]
    sheet = Image.new('RGBA', (64 * len(slots), max(p.height for p in slots)))
    for k, p in enumerate(slots): sheet.alpha_composite(p, (k * 64, 0))
    sheet.save(out + name + '.png', optimize=True)
    return boxes

if __name__ == '__main__':
    import os
    os.makedirs(out, exist_ok=True)
    for n in SETS:
        img = Image.open(here + n + '.png').convert('RGBA')
        (tone_tops(n, img) if n in TOPS else img).save(out + n + '.png', optimize=True)
    for n in ('lava-floor', 'lava-ash'): cut(n)
    plain('mine-wall', 'lower').save(out + 'cave-floor.png')
    plain('flow', 'lower').save(out + 'ash.png')
    for n in CLIFFS: print(f'# {n}\n' + cliff(n))
    for s, items in STRIPS.items():
        print(f'# {s}')
        for n, b in strip(s, items).items(): print(f'    {n}: {json.dumps(b)}')
