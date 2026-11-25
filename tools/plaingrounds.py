# Plainer grounds for a tileset: a ground's tile repeats every square, so its motifs (tufts, leaves, blade marks,
# pebbles) stand in a grid that reads at once at scale. This takes them out of the ground, in every sheet that
# carries that ground (the same pixels at the same place in each tile, as PixelLab's chained sets paste it), and cuts
# them into small sprites the map scatters at random (a terrain's `decor`), with soft patches of a darker or lighter
# shade for layers. The fine noise of the ground stays.
#   python3 tools/plaingrounds.py assets/wip/w1/plain.json
# The config: {"out": dir for the plain sheets, "dir": the tileset's dir, "decor": the decor sheet to write,
# "grounds": {name: {"from": sheet, "tile": [x, y], "thr": 70, "patches": [[shade, alpha], ...], "extra": [[sheet, x, y,
# w, h], ...]}}, "sheets": {output name: source
# sheet or tile}} (paths from the repo; a sheet's -cut sheet beside it is done too). It writes only the sheets it
# changed, and lists them in <out>/sheets.json (old path: new, from the tileset's dir) for the tileset to point at.
# Sources are never written: run it again after changing a source or a threshold.
import sys, json, colorsys, os
from collections import deque
from PIL import Image

N = 64
SHIFTS = [(17, 23), (41, 9), (29, 46), (7, 35), (53, 27), (23, 58), (37, 15), (11, 50), (47, 41), (3, 19), (59, 5), (33, 31)]

def tile(path, tx, ty):
    im = Image.open(path).convert('RGBA').crop((tx, ty, tx + N, ty + N)).load()
    return [[im[x, y][:3] for y in range(N)] for x in range(N)]

# Motif pixels: far from the local median (a 9x9 window, wrapping) or of another hue than the ground's, then grown by
# `grow` squares round them (their outlines and shadows).
def motifs(px, thr, grow=2, huetol=0.07, win=4):
    hue = sorted(colorsys.rgb_to_hsv(*[c / 255 for c in px[x][y]])[0] for x in range(N) for y in range(N))[N * N // 2]
    med = [[None] * N for _ in range(N)]
    for x in range(N):
        for y in range(N):
            v = [px[(x + a) % N][(y + b) % N] for a in range(-win, win + 1) for b in range(-win, win + 1)]
            med[x][y] = tuple(sorted(p[c] for p in v)[len(v) // 2] for c in range(3))
    def odd(x, y):
        h, s, _ = colorsys.rgb_to_hsv(*[c / 255 for c in px[x][y]])
        dh = min(abs(h - hue), 1 - abs(h - hue))
        return sum(abs(px[x][y][c] - med[x][y][c]) for c in range(3)) > thr or (s > 0.25 and dh > huetol)
    core = [[odd(x, y) for y in range(N)] for x in range(N)]
    mask = core
    for _ in range(grow):
        mask = [[mask[x][y] or any(mask[(x + a) % N][(y + b) % N] for a in (-1, 0, 1) for b in (-1, 0, 1)) for y in range(N)] for x in range(N)]
    return core, mask, med

# The plain ground: each motif pixel takes the ground's pixel from a shifted copy of the tile (so the noise runs on).
def plain(px, mask):
    out = [[None if mask[x][y] else px[x][y] for y in range(N)] for x in range(N)]
    for x in range(N):
        for y in range(N):
            if out[x][y] is None:
                for sx, sy in SHIFTS:
                    a, b = (x + sx) % N, (y + sy) % N
                    if not mask[a][b]: out[x][y] = px[a][b]; break
                else: out[x][y] = px[x][y]
    return out

# The motifs as sprites: each piece of the core grown by one, keeping the grown ring only where it is darker than the
# ground there (an outline or a shadow), found once each on a 2x2 tiling.
def sprites(px, core, med, keep=8):
    T = 2 * N
    at = lambda x, y: px[x % N][y % N]
    sm = [[core[x % N][y % N] for y in range(T)] for x in range(T)]
    ring = [[(not sm[x][y]) and any(sm[(x + a) % T][(y + b) % T] for a in (-1, 0, 1) for b in (-1, 0, 1)) and sum(at(x, y)) < sum(med[x % N][y % N]) - 25 for y in range(T)] for x in range(T)]
    m = [[sm[x][y] or ring[x][y] for y in range(T)] for x in range(T)]
    seen, out, keys = set(), [], set()
    for x0 in range(T):
        for y0 in range(T):
            if not m[x0][y0] or (x0, y0) in seen: continue
            comp, q = [], deque([(x0, y0)]); seen.add((x0, y0))
            while q:
                x, y = q.popleft(); comp.append((x, y))
                for a in (-1, 0, 1):
                    for b in (-1, 0, 1):
                        p = (x + a, y + b)
                        if 0 <= p[0] < T and 0 <= p[1] < T and m[p[0]][p[1]] and p not in seen: seen.add(p); q.append(p)
            xs, ys = [p[0] for p in comp], [p[1] for p in comp]
            if min(xs) == 0 or min(ys) == 0 or max(xs) == T - 1 or max(ys) == T - 1 or len(comp) < 5 or len(comp) > 500: continue
            key = (min(xs) % N, min(ys) % N, len(comp))
            if key in keys: continue
            keys.add(key)
            w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
            im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            for x, y in comp: im.putpixel((x - min(xs), y - min(ys)), at(x, y) + (255,))
            out.append(im)
    out.sort(key=lambda im: -im.width * im.height)
    return out[:keep]

# Soft patches (layers): a blob of the ground's own colour, darker or lighter (`patches`: [[shade, alpha], ...]), laid
# over the ground at that alpha so its noise shows through, the alpha stepping down to its ragged edge.
def patches(px, seed, spec):
    import random
    rnd = random.Random(seed)
    base = tuple(sorted(px[x][y][c] for x in range(N) for y in range(N))[N * N // 2] for c in range(3))
    out = []
    for k, (f, a) in enumerate(spec):
        w, h = [(84, 56), (64, 64), (96, 44), (60, 46)][k % 4]
        bumps = [(rnd.uniform(0.25, 0.75) * w + 20, rnd.uniform(0.3, 0.7) * h + 20, rnd.uniform(0.22, 0.36) * min(w, h) * 1.3) for _ in range(7)]
        w += 40; h += 40
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        col = tuple(max(0, min(255, round(v * f))) for v in base)
        for x in range(w):
            for y in range(h):
                d = max(1 - ((x - cx) ** 2 + (y - cy) ** 2) / r ** 2 for cx, cy, r in bumps)
                if d <= 0 or (d < 0.15 and (x + y) % 2): continue
                im.putpixel((x, y), col + (round(255 * a * (1 if d > 0.45 else 0.66 if d > 0.2 else 0.4)),))
        out.append(im.crop(im.getbbox()))
    return out

# Extra pieces for a ground (`extra`: [[sheet, x, y, w, h], ...]): each cut into its separate pieces (a bunch of
# flowers into single flowers).
def split(path, x0, y0, w, h):
    im = Image.open(path).convert('RGBA').crop((x0, y0, x0 + w, y0 + h)); p = im.load()
    seen, out = set(), []
    for x in range(w):
        for y in range(h):
            if not p[x, y][3] or (x, y) in seen: continue
            comp, q = [], deque([(x, y)]); seen.add((x, y))
            while q:
                a, b = q.popleft(); comp.append((a, b))
                for da in (-1, 0, 1):
                    for db in (-1, 0, 1):
                        n = (a + da, b + db)
                        if 0 <= n[0] < w and 0 <= n[1] < h and p[n][3] and n not in seen: seen.add(n); q.append(n)
            xs, ys = [c[0] for c in comp], [c[1] for c in comp]
            out.append(im.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1)))
    return out

def main(cfg_path):
    cfg = json.load(open(cfg_path))
    grounds = {}
    for name, g in cfg['grounds'].items():
        px = tile(g['from'], *g['tile'])
        core, mask, med = motifs(px, g.get('thr', 70), g.get('grow', 2))
        grounds[name] = dict(px=px, mask=mask, plain=plain(px, mask), sprites=sprites(px, core, med, g.get('keep', 8)))
        print(f"{name}: {sum(map(sum, mask))} motif pixels, {len(grounds[name]['sprites'])} sprites")
    # Every sheet: a pixel that is a ground's motif pixel, where most of the pixels round it are that ground's too, takes
    # the plain ground's pixel.
    os.makedirs(cfg['out'], exist_ok=True)
    done, plained = {}, {}
    for outname, src in cfg['sheets'].items():
        for suffix in ('', '-cut'):
            sp = src[:-4] + suffix + '.png'
            if not os.path.exists(sp): continue
            im = Image.open(sp).convert('RGBA'); p = im.load(); W, H = im.size
            changed = 0
            for g in grounds.values():
                px, mask, pl = g['px'], g['mask'], g['plain']
                same = lambda x, y: 0 <= x < W and 0 <= y < H and p[x, y][3] and p[x, y][:3] == px[x % N][y % N]
                hits = [(x, y) for y in range(H) for x in range(W) if mask[x % N][y % N] and same(x, y)]
                # Its neighbours in the same tile (the tile beside it in the sheet is another place altogether). All
                # are judged before any is changed.
                nbs = lambda x, y: [(x + a, y + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (x + a) // N == x // N and (y + b) // N == y // N]
                go = [(x, y) for x, y in hits if 3 * sum(same(*q) for q in nbs(x, y)) >= 2 * len(nbs(x, y))]
                for x, y in go: p[x, y] = pl[x % N][y % N] + (p[x, y][3],)
                changed += len(go)
            done[sp] = (im, changed)
    # A sheet and its cut sheet go together (both plain, or neither): the rest are left where they are.
    for outname, src in cfg['sheets'].items():
        pair = [src[:-4] + sfx + '.png' for sfx in ('', '-cut')]
        if not any(done.get(q, (0, 0))[1] for q in pair): continue
        for q, sfx in zip(pair, ('', '-cut')):
            if q not in done: continue
            dst = os.path.join(cfg['out'], outname[:-4] + sfx + '.png')
            done[q][0].save(dst, optimize=True); plained[q] = dst
            print(f'{dst}: {done[q][1]} pixels')
    json.dump({os.path.relpath(k, cfg['dir']): os.path.relpath(v, cfg['dir']) for k, v in plained.items()}, open(os.path.join(cfg['out'], 'sheets.json'), 'w'), indent=1)
    # The decor sheet: per ground, its sprites then its patches, in one row each; the tileset entries to paste.
    rows = []
    for name, g in grounds.items():
        gc = cfg['grounds'][name]
        g['extra'] = [im for e in gc.get('extra', []) for im in split(*e)]
        rows.append((name, g['sprites'] + g['extra'] + patches(g['px'], name, gc.get('patches', [[0.7, 0.16], [0.75, 0.12], [1.25, 0.12]]))))
    W = max(sum(im.width + 2 for im in r) for _, r in rows); H = sum(max(im.height for im in r) + 2 for _, r in rows)
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0)); y = 0; listing = {}
    rel = os.path.relpath(cfg['decor'], cfg.get('dir', 'art/worldtiles/w1'))
    for name, r in rows:
        x = 0; listing[name] = {'pieces': [], 'extra': [], 'patches': []}
        n1 = len(grounds[name]['sprites']); n2 = n1 + len(grounds[name]['extra'])
        for k, im in enumerate(r):
            sheet.paste(im, (x, y))
            listing[name]['pieces' if k < n1 else 'extra' if k < n2 else 'patches'].append([rel, x, y, im.width, im.height])
            x += im.width + 2
        y += max(im.height for im in r) + 2
    sheet.save(cfg['decor'], optimize=True)
    json.dump(listing, open(cfg['decor'][:-4] + '.json', 'w'), indent=1)
    print(f"{cfg['decor']}: {len(rows)} grounds; pieces in {cfg['decor'][:-4]}.json")

if __name__ == '__main__':
    main(sys.argv[1])
