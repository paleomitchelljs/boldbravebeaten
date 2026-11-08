# Builds Tarnhold's second pass (art/worldtiles/highland/) and the orc valley, castle and caves (art/worldtiles/orc/)
# from the PixelLab sheets in sheets/ (ids.txt; prompts in README.md) and the props in valley/, furniture/, wall/, big/,
# big2/ (one candidate frame a file).
#   python3 assets/wip/orc/build.py "$PWD"
# Prints each cliff set's `cliff:` list (they have all come out the same) and each strip's pieces for data/tilesets.yaml.
import json, os, sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/orc/'
OUT = {'highland': root + '/art/worldtiles/highland/', 'orc': root + '/art/worldtiles/orc/'}

# sheet -> (output folder, toning). Toning: ('tops', bright, sat) the cliff set's wall tops only; ('all', bright, sat)
# the whole sheet (a set whose lower terrain is itself a toned top, so they still meet); ('lime', k) pull bright
# yellow-greens part of the way to the valley grass.
SETS = {
    'mountain': ('highland', ('tops', 0.68, 0.8)),        # gravel -> granite rock (cliff)
    'shoulder': ('highland', ('shoulder', 0.68, 0.8, 0.82)),         # rock top -> shoulder (sloped, the mountains' second ring)
    'peak': ('highland', ('shoulder', 0.82, 0.8, 0.9)),             # shoulder -> snow-dusted peak (sloped, the third ring)
    'road2': ('highland', ('upper', 0.66, 0.7)),                          # gravel -> trodden road (flat)
    'river': ('highland', None),                          # water -> gravel (bank)
    'upland': ('highland', None),                         # gravel -> upland (sloped, walkable)
    'highland': ('highland', ('flatten', 0.45)),          # its plain top repeated in a strong chevron: contrast cut                       # upland -> high plateau (sloped, walkable)
    'overlook': ('highland', ('tops', 0.8, 0.85)),        # gravel -> overlook shelf (cliff, walkable top)
    'fort': ('highland', ('tops', 0.8, 0.85)),            # gravel -> fortress wall (cliff)
    'tower': ('highland', ('all', 0.85, 0.9)),            # wall walk -> tower (cliff)
    'valley-mountain': ('orc', ('tops', 0.68, 0.8)),      # valley grass -> granite rock (cliff; the highland's rings go on it)
    'valley-path': ('orc', ('all', 0.9, 0.8)),            # grass -> trampled mud path (flat)
    'moat': ('orc', None),                                # water -> grass (bank)
    'orc-fort': ('orc', None),                            # grass -> the castle's outer wall (cliff)
    'quarry': ('orc', ('tops', 0.85, 0.9)),               # grass -> quarried hill (cliff)
    'trainer-hill': ('orc', ('lime', 0.45)),              # grass -> the trainer hill (sloped, walkable)
    'castle': ('orc', ('tops', 0.5, 0.9)),                # marble floor -> castle wall (cliff)
    'mine': ('orc', ('lower', 0.6, 0.9, 0.8)),            # the floor darker still (it came out pale)                  # mine floor -> rock (cliff)
}
CLIFFS = ('mountain', 'overlook', 'fort', 'tower', 'valley-mountain', 'orc-fort', 'quarry', 'castle', 'mine')

def meta(name):
    d = json.load(open(here + 'sheets/' + name + '.meta.json'))
    return d.get('tileset_data', d)['tiles']

def plain(img, name, want):
    for t in meta(name):
        if all(v == want for v in t['corners'].values()):
            b = t['bounding_box']
            return img.crop((b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height']))

def cliff(name):
    rows = []
    for t in meta(name):
        b, p = t['bounding_box'], t['pattern_4x4']
        pat = ''.join('.' if v == 255 else str(v) for r in ('row_0', 'row_1', 'row_2', 'row_3') for v in p[r])
        rows.append(f'[{b["x"] // 64}, {b["y"] // 64}, "{pat}"]')
    return rows

def shade(px, x, y, bright, sat):
    r, g, b, a = px[x, y]
    m = (r + g + b) / 3
    px[x, y] = tuple(max(0, min(255, round((m + (c - m) * sat) * bright))) for c in (r, g, b)) + (a,)

def tone(name, img, how):
    px = img.load()
    if how[0] == 'all':
        for y in range(img.height):
            for x in range(img.width): shade(px, x, y, how[1], how[2])
    elif how[0] == 'tops':
        # the quarters of each cliff tile that are wall top (1, or 2 in the bottom row: the face hangs below them)
        for t in meta(name):
            b, p = t['bounding_box'], t['pattern_4x4']
            nw, ne, sw, se = p['row_1'][1], p['row_1'][2], p['row_2'][1], p['row_2'][2]
            for q, top in enumerate([nw == 1, ne == 1, sw in (1, 2), se in (1, 2)]):
                if not top: continue
                x0, y0 = b['x'] + (q % 2) * 32, b['y'] + (q // 2) * 32
                for y in range(y0, y0 + 32):
                    for x in range(x0, x0 + 32): shade(px, x, y, how[1], how[2])
    elif how[0] in ('shoulder', 'upper'):
        # Each pixel is lower ground or not by colour (the set's plain lower tile); lower pixels take the lower
        # ground's toning, the rest their own, so the bank meets the ground below and the top reads a step up.
        low = set(p[:3] for p in plain(img, name, 'lower').get_flattened_data())
        lo_b, sat = (how[1], how[2]) if how[0] == 'shoulder' else (1.0, 1.0)
        up_b, up_s = (how[3], how[2]) if how[0] == 'shoulder' else (how[1], how[2])
        for y in range(img.height):
            for x in range(img.width):
                if px[x, y][:3] in low: shade(px, x, y, lo_b, sat)
                else: shade(px, x, y, up_b, up_s)
    elif how[0] == 'lower':
        # the whole sheet by the last number, the lower ground's pixels (by colour) by the first as well
        low = set(p[:3] for p in plain(img, name, 'lower').get_flattened_data())
        for y in range(img.height):
            for x in range(img.width):
                was = px[x, y][:3] in low
                shade(px, x, y, how[3], how[2])
                if was: shade(px, x, y, how[1], 1.0)
    elif how[0] == 'flatten':
        # the upper ground's pixels pulled toward the upper tile's mean colour (less contrast, so its repeat hides)
        low = set(p[:3] for p in plain(img, name, 'lower').get_flattened_data())
        up = [p for p in plain(img, name, 'upper').get_flattened_data()]
        mean = [sum(p[i] for p in up) / len(up) for i in range(3)]
        for y in range(img.height):
            for x in range(img.width):
                r, g, b, a = px[x, y]
                if (r, g, b) not in low:
                    px[x, y] = tuple(int(mean[i] + how[1] * (c - mean[i])) for i, c in enumerate((r, g, b))) + (a,)
    elif how[0] == 'lime':
        grass = plain(img, name, 'lower')
        gp = [p for p in grass.get_flattened_data()]
        mean = [sum(p[i] for p in gp) / len(gp) for i in range(3)]
        for y in range(img.height):
            for x in range(img.width):
                r, g, b, a = px[x, y]
                if g > 90 and g > b + 30 and r > 60:
                    px[x, y] = tuple(int(c + how[1] * (mean[i] - c)) for i, c in enumerate((r, g, b))) + (a,)
    return img

def cut_ground(img):
    # The rock's sheet with the gravel cut away (warmer than the granite), laid over a gate wall's end where it runs
    # into the rock (`underWalls`, `cut`).
    out = img.copy(); px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if r > b + 14 and r - b > (g - b) * 0.6 and r < 150: px[x, y] = (0, 0, 0, 0)
    return out

# Strips: (folder, [(frame, name)]); each piece trimmed to its pixels and laid in a slot as wide as the widest piece.
STRIPS = {
    'valley-props': ('valley', [(0, 'banner'), (1, 'tent'), (2, 'campfire'), (3, 'torchpost'), (4, 'skullpike'),
        (5, 'weaponrack'), (6, 'dummy'), (7, 'minecart'), (8, 'stoneblocks'), (9, 'rubble'), (10, 'cage'),
        (11, 'chainpost'), (12, 'palisade'), (13, 'totem'), (14, 'scaffold'), (15, 'woodpile')]),
    'furniture': ('furniture', [(0, 'pillar'), (1, 'brazier'), (2, 'feast'), (3, 'bench'), (4, 'bed'), (5, 'chest'),
        (6, 'rack'), (7, 'barrels'), (8, 'bones'), (9, 'maptable'), (10, 'altar'), (11, 'hoard'), (12, 'pallet'),
        (13, 'celldoor'), (14, 'cauldron'), (15, 'furs')]),
    'wall-decor': ('wall', [(0, 'banner'), (1, 'torch'), (2, 'shield'), (3, 'coin'), (4, 'axes'), (5, 'chains'),
        (6, 'boar'), (7, 'slit'), (8, 'swag'), (9, 'relief'), (10, 'shelf'), (11, 'crack'), (12, 'furs'),
        (13, 'lantern'), (14, 'flag'), (15, 'glyphs')]),
    'buildings': (None, [('big/2', 'gate'), ('big/3', 'throne'), ('big2/0', 'longhut'), ('big2/1', 'cabin'),
        ('big2/2', 'bigtent'), ('big2/3', 'watchtower')]),
}

def strip(name, folder, items):
    pieces, boxes = [], {}
    for i, n in items:
        im = Image.open(f'{here}{folder}/{i}.png' if folder else f'{here}{i}.png').convert('RGBA')
        pieces.append((n, im.crop(im.getbbox())))
    slot = max(p.width for _, p in pieces) + 4
    sheet = Image.new('RGBA', (slot * len(pieces), max(p.height for _, p in pieces)))
    for k, (n, p) in enumerate(pieces):
        sheet.alpha_composite(p, (k * slot, 0))
        boxes[n] = [name + '.png', k * slot, 0, p.width, p.height]
    sheet.save(OUT['orc'] + name + '.png', optimize=True)
    return boxes

if __name__ == '__main__':
    for d in OUT.values(): os.makedirs(d, exist_ok=True)
    first = None
    for n, (dest, how) in SETS.items():
        img = Image.open(here + 'sheets/' + n + '.png').convert('RGBA')
        if how: img = tone(n, img, how)
        img.save(OUT[dest] + n + '.png', optimize=True)
        if n == 'mountain':
            cut_ground(img).save(OUT[dest] + 'mountain-cut.png', optimize=True)
            plain(img, n, 'lower').save(OUT[dest] + 'gravel.png')
        if n == 'river': plain(img, n, 'lower').save(OUT[dest] + 'water.png')
        if n == 'moat': plain(img, n, 'lower').save(OUT[dest] + 'water.png'.replace('water', 'moat-water'))
        if n == 'valley-mountain':
            plain(img, n, 'lower').save(OUT[dest] + 'grass.png')
            cut_ground(img).save(OUT[dest] + 'valley-mountain-cut.png', optimize=True)
        if n == 'castle': plain(img, n, 'lower').save(OUT[dest] + 'castle-floor.png')
        if n == 'mine': plain(img, n, 'lower').save(OUT[dest] + 'mine-floor.png')
        if n in CLIFFS:
            c = cliff(n)
            if first is None: first = c; print('# cliff (all sets)\n' + '\n'.join('        - ' + r for r in c))
            elif c != first: print(f'# {n} differs\n' + '\n'.join('        - ' + r for r in c))
    for s, (folder, items) in STRIPS.items():
        print(f'# {s}')
        for n, b in strip(s, folder, items).items(): print(f'    {n}: {json.dumps(b)}')
