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
    # (The first pass's cliff mountains, boulder rings, walkable levels and old overlook (mountain, shoulder, peak,
    # upland, highland, overlook, valley-mountain) are no longer built: the second pass replaced them. Their sheets stay
    # in sheets/; mountain's floor is still the gravel's source.)
    'road2': ('highland', ('upper', 0.66, 0.7)),                          # gravel -> trodden road (flat)
    'river': ('highland', None),                          # water -> gravel (bank)
    'fort': ('highland', ('tops', 0.8, 0.85)),            # gravel -> fortress wall (cliff)
    'tower': ('highland', ('all', 0.85, 0.9)),            # wall walk -> tower (cliff)
    'valley-path': ('orc', ('all', 0.9, 0.8)),            # grass -> trampled mud path (flat)
    'moat': ('orc', None),                                # water -> grass (bank)
    'orc-fort': ('orc', None),                            # grass -> the castle's outer wall (cliff)
    'quarry': ('orc', ('top', 'granite', 0.78, 0.85)),    # grass -> quarried hill (cliff): its flat top the mountains' granite
    'pit-mud': ('orc', ('upper', 0.7, 0.85), 'valley-path'),  # the slave pits: the path's mud, darker
    'trainer-hill': ('orc', ('ring', 'grass', 1.0, 1.08, 1.0, 1.0)),  # grass -> the trainer hill (sloped, walkable): its top the valley's grass, a shade lighter
    'castle': ('orc', ('tops', 0.5, 0.9)),                # marble floor -> castle wall (cliff)
    'mine': ('orc', ('lower', 0.6, 0.9, 0.8)),            # the floor darker still (it came out pale)                  # mine floor -> rock (cliff)
    # Second pass (the user, 2026-11-08: "simpler tiles that work as walls but appear as steep slopes instead of truly
    # vertical walls ... while keeping the mountain trails on the valley floor"): the mountains' walls as steep scree
    # slopes (16-tile corner sets, transition 0.25, step_slope 2 / 1.6), their tops toned as the cliff tops were.
    'slope20': ('highland', ('slope', 0.68, 0.8, 0.8, 0.85)),       # gravel -> granite top over steep scree
    'valley-slope': ('orc', ('slope', 0.68, 0.8, 0.8, 0.85)),       # valley grass -> granite top over steep scree
    # The rings above (the user: "the slope tiles should be able to line up so you can put two next to make stepped
    # mountains that are multiple tiles high"): one granite -> granite slope set (PixelLab won't chain both sides to
    # one tile, so its own top is replaced by the granite), each ring a step lighter. (sheet name, then its source)
    'ring1': ('highland', ('ring', 'granite', 0.68, 0.73, 0.7, 0.8), 'ring'),
    'ring2': ('highland', ('ring', 'granite', 0.73, 0.78, 0.75, 0.8), 'ring'),
    'ring3': ('highland', ('ring', 'granite', 0.78, 0.83, 0.8, 0.8), 'ring'),
    'ring4': ('highland', ('ring', 'granite', 0.83, 0.88, 0.85, 0.8), 'ring'),
    'ring5': ('highland', ('ring', 'granite', 0.88, 0.93, 0.9, 0.8), 'ring'),
    'ring6': ('highland', ('ring', 'granite', 0.93, 0.98, 0.95, 0.8), 'ring'),
    # The overlook: a low cliff (transition 0.5) whose top came out one flat colour; it is filled with the floor's
    # gravel, a raised ledge of the canyon floor.
    'plateau': ('highland', ('fill', 'gravel')),
}
# The ground shared by a group of sheets: wherever a sheet's pixel is the canonical tile's pixel at the same place in
# its tile (PixelLab lays the chained ground in unchanged), it becomes the ground's plain tile there, after toning. So
# toning never shifts a sheet's ground from its neighbours', and the ground is plain: its pebbles, ruts and blotches
# repeated every square (the user, 2026-11-08: "extremely repetitive ground tiling"; "plainer ground that is decorated
# would look less repetitive"), and the variety comes back as decor pieces. ground -> (sheet, which plain tile, the
# share of pixels whose colours are kept as the grain, toning of the plain tile or None, the sheets).
GROUNDS = {
    'gravel': ('mountain', 'lower', 0.75, None, ['mountain', 'road2', 'river', 'upland', 'overlook', 'fort', 'slope20', 'plateau']),
    'road': ('road2', 'upper', 0.75, (0.66, 0.7), ['road2']),
    'grass': ('moat', 'upper', 0.85, None, ['moat', 'valley-path', 'trainer-hill', 'orc-fort', 'quarry', 'valley-mountain', 'valley-slope']),
    # The mountains' top: laid in by the slope and ring tonings (each tones it its own way), so in no list here.
    'granite': ('slope20', 'upper', 0.85, None, []),
}
CLIFFS = ('fort', 'tower', 'orc-fort', 'quarry', 'castle', 'mine', 'plateau')

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
    elif how[0] == 'top':
        # (ground, b, s): the pixels of the set's own top become the named ground's plain tile at that toning.
        up, gr = plain(img, name, 'upper').load(), canonical(how[1]).load()
        for y in range(img.height):
            for x in range(img.width):
                if px[x, y] == up[x % 64, y % 64]: px[x, y] = gr[x % 64, y % 64]; shade(px, x, y, how[2], how[3])
    elif how[0] in ('slope', 'ring'):
        # A corner set's own plain tiles, pixel for pixel. slope (top b, s, bank b, s): its top becomes the plain
        # granite at the first toning, the bank (neither top nor lower ground) takes the second, the lower ground is
        # left. ring (ground, lower b, upper b, bank b, s): both grounds become that ground's plain tile, each at its
        # own toning, so one set climbs from ring to ring.
        up, low = plain(img, name, 'upper').load(), plain(img, name, 'lower').load()
        gr = canonical('granite' if how[0] == 'slope' else how[1]).load()
        if how[0] == 'ring': how = how[:1] + how[2:]
        def lay(x, y, b, sat):
            px[x, y] = gr[x % 64, y % 64]; shade(px, x, y, b, sat)
        for y in range(img.height):
            for x in range(img.width):
                c = px[x, y]
                if how[0] == 'slope':
                    if c == up[x % 64, y % 64]: lay(x, y, how[1], how[2])
                    elif c != low[x % 64, y % 64]: shade(px, x, y, how[3], how[4])
                else:
                    if c == up[x % 64, y % 64]: lay(x, y, how[2], how[4])
                    elif c == low[x % 64, y % 64]: lay(x, y, how[1], how[4])
                    else: shade(px, x, y, how[3], how[4])
    elif how[0] == 'fill':
        # The upper ground drawn as one flat colour: those pixels take the named ground's canonical tile.
        flat = plain(img, name, 'upper').getpixel((0, 0))
        tex = canonical(how[1]).load()
        for y in range(img.height):
            for x in range(img.width):
                if px[x, y] == flat: px[x, y] = tex[x % 64, y % 64]
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

def plainify(g, share):
    # Keeps the commonest colours (covering `share` of the pixels) as the grain; every other pixel (a pebble, a crack, a
    # tuft) takes the commonest grain colour round it; then light and dark blotches are evened out, each pixel moved
    # to the grain colour nearest its brightness less its neighbourhood's difference from the whole tile's.
    from collections import Counter
    g = g.convert('RGB'); N = g.width
    cnt = Counter(g.get_flattened_data()); base, acc = [], 0
    for c, n in cnt.most_common():
        if acc >= share * N * N: break
        base.append(c); acc += n
    bs = set(base); out = g.copy(); o = out.load()
    for _ in range(3):
        src = out.copy().load()
        for y in range(N):
            for x in range(N):
                if src[x, y] in bs: continue
                near = Counter(src[(x + i) % N, (y + j) % N] for i in range(-2, 3) for j in range(-2, 3) if src[(x + i) % N, (y + j) % N] in bs)
                if near: o[x, y] = near.most_common(1)[0][0]
    lum = lambda c: c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
    L = [[lum(o[x, y]) for x in range(N)] for y in range(N)]
    gm = sum(map(sum, L)) / (N * N); K = 5; n = (2 * K + 1) ** 2
    res = out.copy(); r = res.load()
    for y in range(N):
        for x in range(N):
            t = L[y][x] - (sum(L[(y + j) % N][(x + i) % N] for i in range(-K, K + 1) for j in range(-K, K + 1)) / n - gm)
            r[x, y] = min(base, key=lambda q: abs(lum(q) - t))
    return res

_canon = {}
def canonical(ground, raw=False):
    # A ground's tile as PixelLab made it (raw), or as it is drawn (plain, and toned as its sheet is).
    if (ground, raw) not in _canon:
        sheet, which, share, toned, _ = GROUNDS[ground]
        t = plain(Image.open(here + 'sheets/' + sheet + '.png').convert('RGBA'), sheet, which)
        _canon[(ground, True)] = t
        p = plainify(t, share).convert('RGBA')
        if toned:
            pp = p.load()
            for y in range(64):
                for x in range(64): shade(pp, x, y, *toned)
        _canon[(ground, False)] = p
    return _canon[(ground, raw)]

def bits(ground, minpx=6, maxw=26):
    # The ground's own details (the pebbles, ruts and tufts plainify took out of its tile), each cut out on clear
    # ground, to scatter as decor: in the ground's style, but never in a grid. Read off a 3x3 tiling of the raw tile, so a
    # detail across its edge comes whole; pixels within two of each other are one piece.
    from collections import Counter
    sheet, which, share, toned, _ = GROUNDS[ground]
    g = plain(Image.open(here + 'sheets/' + sheet + '.png').convert('RGBA'), sheet, which).convert('RGB')
    N = 64; cnt = Counter(g.get_flattened_data()); base, acc = set(), 0
    for c, n in cnt.most_common():
        if acc >= share * N * N: break
        base.add(c); acc += n
    big = Image.new('RGB', (3 * N, 3 * N))
    for i in range(3):
        for j in range(3): big.paste(g, (i * N, j * N))
    px = big.load(); W = 3 * N
    feat = [[px[x, y] not in base for x in range(W)] for y in range(W)]
    seen = [[False] * W for _ in range(W)]; out = []
    for y in range(W):
        for x in range(W):
            if not feat[y][x] or seen[y][x]: continue
            st, comp = [(x, y)], []; seen[y][x] = True
            while st:
                a, b = st.pop(); comp.append((a, b))
                for dx in range(-2, 3):
                    for dy in range(-2, 3):
                        u, v = a + dx, b + dy
                        if 0 <= u < W and 0 <= v < W and feat[v][u] and not seen[v][u]: seen[v][u] = True; st.append((u, v))
            xs, ys = [q[0] for q in comp], [q[1] for q in comp]
            x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
            if not (N <= (x0 + x1) // 2 < 2 * N and N <= (y0 + y1) // 2 < 2 * N): continue
            if len(comp) < minpx or x1 - x0 >= maxw or y1 - y0 >= maxw: continue
            piece = Image.new('RGBA', (x1 - x0 + 1, y1 - y0 + 1), (0, 0, 0, 0)); pp = piece.load()
            for a, b in comp:
                pp[a - x0, b - y0] = px[a, b] + (255,)
                if toned: shade(pp, a - x0, b - y0, *toned)
            out.append(piece)
    return out

def bits_strip(ground):
    pieces = bits(ground)
    sheet = Image.new('RGBA', (sum(p.width + 2 for p in pieces), max(p.height for p in pieces)))
    boxes, x = [], 0
    for p in pieces:
        sheet.alpha_composite(p, (x, 0)); boxes.append([ground + '-bits.png', x, 0, p.width, p.height]); x += p.width + 2
    sheet.save(OUT['orc'] + ground + '-bits.png', optimize=True)
    return boxes

def unify(name, raw, img):
    for g, (_, _, _, _, sheets) in GROUNDS.items():
        if name not in sheets: continue
        c, new, r, px = canonical(g, True).load(), canonical(g).load(), raw.load(), img.load()
        for y in range(img.height):
            for x in range(img.width):
                if r[x, y] == c[x % 64, y % 64]: px[x, y] = new[x % 64, y % 64]
    return img

def cut_exact(name, raw, img, ground):
    # The sheet with its ground cut away, by the pixels that are the ground's own (for a corner set laid over a
    # built wall that runs under it).
    out = img.copy(); px = out.load(); c, r = canonical(ground, True).load(), raw.load()
    for y in range(out.height):
        for x in range(out.width):
            if r[x, y] == c[x % 64, y % 64]: px[x, y] = (0, 0, 0, 0)
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
    # Second pass: ground decor (PixelLab 1-direction objects, 16 a sheet: 6359e2e8 the valley; the canyon's,
    # a4c36992, came out too big and outlined and is unused).
    'valley-decor': (None, [(f'../orc2/decor/valley_{i}', n) for i, n in enumerate(['clump', 'clover', 'mossstones',
        'mossrock', 'tallgrass', 'flowers', 'mud', 'fern', 'mushrooms', 'pebbles', 'moss', 'bone', 'thistle', 'reeds',
        'drygrass', 'stump'])]),
    # Second pass: front-on props (the user, 2026-11-08: "doors that don't face properly", cages "out of scale/style");
    # chosen and prepared by ../orc2/keep.py.
    'props2': (None, [(f'../orc2/keep/{n}', n) for n in ['gate', 'throne', 'longhut', 'cabin', 'cage', 'gibbet', 'feast',
        'bed', 'chest', 'maptable', 'rack', 'bench', 'altar', 'barrels']]),
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
    canonical('gravel').save(OUT['highland'] + 'gravel.png')
    canonical('grass').save(OUT['orc'] + 'grass.png')
    first = None
    for n, (dest, how, *src) in SETS.items():
        src = src[0] if src else n
        raw = Image.open(here + 'sheets/' + src + '.png').convert('RGBA')
        img = tone(src, raw.copy(), how) if how else raw.copy()
        img = unify(src, raw, img)
        if n == 'slope20': cut_exact(n, raw, img, 'gravel').save(OUT[dest] + 'slope20-cut.png', optimize=True)
        # The pits' mud lies over the path (it is ranked after it), so its grass is cut away: where it meets the path,
        # the path's mud shows round it instead of a strip of grass.
        if n == 'pit-mud': img = cut_exact(src, raw, img, 'grass')
        img.save(OUT[dest] + n + '.png', optimize=True)
        if n == 'river': plain(img, n, 'lower').save(OUT[dest] + 'water.png')
        if n == 'moat': plain(img, n, 'lower').save(OUT[dest] + 'water.png'.replace('water', 'moat-water'))
        if n == 'castle': plain(img, n, 'lower').save(OUT[dest] + 'castle-floor.png')
        if n == 'mine': plain(img, n, 'lower').save(OUT[dest] + 'mine-floor.png')
        if n in CLIFFS:
            c = cliff(n)
            if first is None: first = c; print('# cliff (all sets)\n' + '\n'.join('        - ' + r for r in c))
            elif c != first: print(f'# {n} differs\n' + '\n'.join('        - ' + r for r in c))
    for g in ('gravel', 'road', 'grass'): print(f'# {g}-bits\n    ' + json.dumps(bits_strip(g)))
    for s, (folder, items) in STRIPS.items():
        print(f'# {s}')
        for n, b in strip(s, folder, items).items(): print(f'    {n}: {json.dumps(b)}')
