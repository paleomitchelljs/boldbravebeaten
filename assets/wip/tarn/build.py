# Builds Tarnhold's and the grassland's art in art/worldtiles/tarn/ from the PixelLab sheets in sheets/, the props in
# props/ and the animation frames in anim/ (prompts in README.md).
#   python3 assets/wip/tarn/build.py "$PWD"
# Prints the props: lines for data/tilesets.yaml.
import json, os, sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/tarn/'
out = root + '/art/worldtiles/tarn/'

def meta(name):
    d = json.load(open(here + 'sheets/' + name + '.meta.json'))
    return d.get('tileset_data', d)['tiles']

def sheet(name):
    return Image.open(here + 'sheets/' + name + '.png').convert('RGBA')

def plain(name, want):
    s = sheet(name)
    for t in meta(name):
        if all(v == want for v in t['corners'].values()):
            b = t['bounding_box']
            return s.crop((b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height']))

def put_plain(im, name, side, tile):
    # The one plain ground goes into a flat set's all-`side` tile, so open ground doesn't change from set to set.
    for t in meta(name):
        if all(v == side for v in t['corners'].values()):
            im.paste(tile, (t['bounding_box']['x'], t['bounding_box']['y']))
    return im

def toward(im, mean, k, test):
    # Pull pixels that pass `test` part of the way toward a colour (a lime hilltop to the grass, a black roof to slate).
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] and test(p): px[x, y] = tuple(int(p[i] + k * (mean[i] - p[i])) for i in range(3)) + (p[3],)
    return im

def mean_of(im):
    ps = [p for p in im.getdata() if p[3]]
    return [sum(p[i] for p in ps) / len(ps) for i in range(3)]

def cut_green(im):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            # the canyon floor's browns and the sparse green: anything warmer or greener than grey granite
            if (g > b + 10 and g >= r - 4) or (r > b + 22): px[x, y] = (0, 0, 0, 0)
    return im

def cut_water(im, water):
    # The rope bridge's deck with the river cut away, so it lies over the river's own tiles.
    cols = set(p[:3] for p in water.getdata())
    near = lambda c: any(abs(c[0] - w[0]) + abs(c[1] - w[1]) + abs(c[2] - w[2]) < 18 for w in cols)
    px, seen = im.load(), {}
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y][:3]
            if c not in seen: seen[c] = near(c)
            if seen[c]: px[x, y] = (0, 0, 0, 0)
    return im

def largest_piece(im):
    a = im.split()[3].load()
    W, H = im.size
    seen, best = set(), set()
    for y in range(H):
        for x in range(W):
            if a[x, y] > 0 and (x, y) not in seen:
                comp, stack = set(), [(x, y)]
                seen.add((x, y))
                while stack:
                    cx, cy = stack.pop(); comp.add((cx, cy))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            q = (cx + dx, cy + dy)
                            if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and a[q] > 0:
                                seen.add(q); stack.append(q)
                if len(comp) > len(best): best = comp
    o = Image.new('RGBA', im.size)
    src, dst = im.load(), o.load()
    for p in best: dst[p] = src[p]
    return o

# Props, in the strip's order. Small ones (64-px review frames) keep their largest piece; animated ones are a strip of
# frames cut to one box (the union of every frame's) so they don't jump.
SMALL = ['barricade', 'palisade', 'cheval', 'stakes', 'burnedcart', 'rubble', 'spearrack', 'shields', 'arrows', 'pavise',
         'brazier', 'supplies', 'fallenbanner', 'scorch', 'ladders', 'earthwork',
         'steps_rough', 'steps_stone', 'boulder', 'rocks', 'lantern', 'signpost', 'deadstump', 'sapling', 'ropepost',
         'drystone', 'haybale', 'shrine', 'trough']
LARGE = ['pine', 'fir', 'oak', 'birch', 'tent', 'watchplatform', 'catapult', 'palisadegate']
ANIM = {'waterfall': 8, 'tallgrass_gold': 8, 'tallgrass_seed': 8, 'tallgrass_flower': 8}

def strip():
    ims = []
    for n in SMALL + LARGE:
        im = Image.open(here + 'props/' + n + '.png').convert('RGBA')
        if n in SMALL: im = largest_piece(im)
        ims.append((n, [im.crop(im.getbbox())]))
    for n, k in ANIM.items():
        d = here + 'anim/' + n + '/'
        if not os.path.exists(d + '0.png'):
            im = Image.open(here + 'props/' + n + '.png').convert('RGBA'); ims.append((n, [im.crop(im.getbbox())])); continue
        fr = [Image.open(d + f'{i}.png').convert('RGBA') for i in range(k)]
        box = fr[0].getbbox()
        for f in fr[1:]:
            b = f.getbbox()
            box = (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        ims.append((n, [f.crop(box) for f in fr]))
    w = sum(sum(f.width for f in fr) + 4 for _, fr in ims)
    h = max(fr[0].height for _, fr in ims)
    out_im = Image.new('RGBA', (w, h))
    x, lines = 0, []
    for n, fr in ims:
        for i, f in enumerate(fr): out_im.paste(f, (x + i * f.width, 0))
        extra = f', null, null, {len(fr)}, {8 if n == "waterfall" else 5}' if len(fr) > 1 else ''
        lines.append(f'    {n}: [props.png, {x}, 0, {fr[0].width}, {fr[0].height}{extra}]')
        x += sum(f.width for f in fr) + 4
    out_im.save(out + 'props.png')
    return '\n'.join(lines)

if __name__ == '__main__':
    os.makedirs(out, exist_ok=True)
    gravel = plain('canyon-road', 'upper'); gravel.save(out + 'gravel.png')
    plain('canyon-road', 'lower').save(out + 'cobbles.png')
    water = plain('river', 'lower'); water.save(out + 'water.png')
    put_plain(sheet('canyon-road'), 'canyon-road', 'upper', gravel).save(out + 'canyon-road.png')
    put_plain(sheet('river'), 'river', 'upper', gravel).save(out + 'river.png')
    cut_water(sheet('ropebridge'), water).save(out + 'ropebridge.png')
    for n in ('canyon-mountain', 'canyon-fort', 'overlook'): sheet(n).save(out + n + '.png')
    cut_green(sheet('canyon-mountain')).save(out + 'canyon-mountain-cut.png')
    # The tower roofs came out nearly black (they read as holes): lift the darkest pixels toward the wall top's slate.
    fort_top = plain('tower', 'lower')
    toward(sheet('tower'), [p * 0.8 for p in mean_of(fort_top)], 0.55, lambda p: sum(p[:3]) < 150).save(out + 'tower.png')
    # The grassland: its grass, the road, the rise (lime tops pulled back toward the grass).
    grass = plain('grassland-road', 'upper'); grass.save(out + 'grass.png')
    plain('grassland-road', 'lower').save(out + 'path.png')
    put_plain(sheet('grassland-road'), 'grassland-road', 'upper', grass).save(out + 'grassland-road.png')
    gm = mean_of(grass)
    rise = toward(sheet('grassland-rise'), gm, 0.55, lambda p: p[1] > gm[1] + 10)
    put_plain(rise, 'grassland-rise', 'lower', grass).save(out + 'grassland-rise.png')
    lines = strip()
    print('# props\n' + lines)
    if '--yaml' in sys.argv:
        # Put the new numbers in data/tilesets.yaml (every props.png line of the tarnhold and grassland tilesets).
        import re
        new = dict(re.findall(r'    (\S+): (\[props\.png,[^\]]*\])', lines))
        p = root + '/data/tilesets.yaml'; t = open(p).read()
        i = t.index('\ntarnhold:')
        t = t[:i] + re.sub(r'(    (\S+): )\[props\.png,[^\]]*\]', lambda m: m.group(1) + new.get(m.group(2), m.group(0)[len(m.group(1)):]), t[i:])
        open(p, 'w').write(t)
