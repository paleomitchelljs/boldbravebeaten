# Builds the jungle's art in art/worldtiles/jungle/ from the PixelLab sheets in sheets/, the trees in props/ and the
# moss animation frames in anim/ (prompts in README.md).
#   python3 assets/wip/jungle/build.py "$PWD" [--yaml]
# Prints the props: lines for data/tilesets.yaml; --yaml writes them into the jungle tileset.
import json, os, re, sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/jungle/'
out = root + '/art/worldtiles/jungle/'

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
    # One plain tile for each ground, put into every set's all-that-ground tile, so open ground doesn't change from
    # set to set (PixelLab redraws the shared ground a little differently in each).
    for t in meta(name):
        if all(v == side for v in t['corners'].values()):
            im.paste(tile, (t['bounding_box']['x'], t['bounding_box']['y']))
    return im

# Trees in the strip's order; the moss-hung ones are animated (anim/<name>/0..7.png, cut to one box so they don't jump).
STILL = ['kapok', 'mangrove', 'strangler', 'cypress', 'mossleaning']
ANIM = ['mossoak', 'mossdead', 'mossbranch']
FRAMES, FPS = 8, 5
# played there and back (0..7..1), for a take whose last frame doesn't lead into its first
PINGPONG = ['mossbranch']

# Small pieces scattered over each ground (decor/, 64-px candidates cut to their largest piece), and how thickly.
DECOR = {
    'floor': ({'density': 0.3, 'clump': 5, 'flip': True, 'spread': 10},
              ['fern', 'fern_small', 'broadleaf', 'toadstools', 'mossrock', 'log', 'root', 'violets', 'stump', 'leaves',
               'vine', 'glowcaps', 'fern', 'fern_small', 'leaves']),
    'marsh': ({'density': 0.45, 'clump': 4, 'flip': True, 'spread': 10, 'edge': True}, ['reeds', 'cattails', 'swampgrass', 'swampgrass']),
    'shallows': ({'density': 0.25, 'flip': True, 'spread': 6, 'edge': True}, ['lilypad']),
    'water': ({'density': 0.25, 'flip': True, 'spread': 6}, ['lilypad']),
}

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

def decor_strip():
    names = sorted({n for _, ns in DECOR.values() for n in ns})
    ims = []
    for n in names:
        im = largest_piece(Image.open(here + 'decor/' + n + '.png').convert('RGBA')); ims.append((n, im.crop(im.getbbox())))
    out_im = Image.new('RGBA', (sum(im.width + 4 for _, im in ims), max(im.height for _, im in ims)))
    x, at = 0, {}
    for n, im in ims:
        out_im.paste(im, (x, 0)); at[n] = (x, im.width, im.height); x += im.width + 4
    out_im.save(out + 'decor.png')
    lines = {}
    for terrain, (opts, ns) in DECOR.items():
        o = ', '.join(f'{k}: {str(v).lower() if isinstance(v, bool) else v}' for k, v in opts.items())
        ps = ', '.join(f'[decor.png, {at[n][0]}, 0, {at[n][1]}, {at[n][2]}]' for n in ns)
        lines[terrain] = f'decor: {{{o}, pieces: [{ps}]}}'
    return lines

def strip():
    ims = []
    for n in STILL:
        im = Image.open(here + 'props/' + n + '.png').convert('RGBA'); ims.append((n, [im.crop(im.getbbox())]))
    for n in ANIM:
        d = here + 'anim/' + n + '/'
        if not os.path.exists(d + '0.png'):
            im = Image.open(here + 'props/' + n + '.png').convert('RGBA'); ims.append((n, [im.crop(im.getbbox())])); continue
        fr = [Image.open(d + f'{i}.png').convert('RGBA') for i in range(FRAMES)]
        if n in PINGPONG: fr = fr + fr[-2:0:-1]
        box = fr[0].getbbox()
        for f in fr[1:]:
            b = f.getbbox()
            box = (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        ims.append((n, [f.crop(box) for f in fr]))
    w = sum(sum(f.width for f in fr) + 4 for _, fr in ims)
    h = max(fr[0].height for _, fr in ims)
    im = Image.new('RGBA', (w, h))
    x, lines = 0, []
    for n, fr in ims:
        for i, f in enumerate(fr): im.paste(f, (x + i * f.width, 0))
        extra = f', null, null, {len(fr)}, {FPS}' if len(fr) > 1 else ''
        lines.append(f'    {n}: [props.png, {x}, 0, {fr[0].width}, {fr[0].height}{extra}]')
        x += sum(f.width for f in fr) + 4
    im.save(out + 'props.png')
    return '\n'.join(lines)

if __name__ == '__main__':
    os.makedirs(out, exist_ok=True)
    floor = plain('jungle-marsh', 'upper'); floor.save(out + 'floor.png')
    marsh = plain('jungle-marsh', 'lower'); marsh.save(out + 'marsh.png')
    plain('jungle-swamp', 'lower').save(out + 'water.png')
    plain('jungle-trail', 'lower').save(out + 'trail.png')
    put_plain(sheet('jungle-marsh'), 'jungle-marsh', 'upper', floor).save(out + 'jungle-marsh.png')
    put_plain(sheet('jungle-swamp'), 'jungle-swamp', 'upper', marsh).save(out + 'jungle-swamp.png')
    put_plain(sheet('jungle-trail'), 'jungle-trail', 'upper', floor).save(out + 'jungle-trail.png')
    sheet('jungle-canopy').save(out + 'jungle-canopy.png')
    lines = strip()
    print('# props\n' + lines)
    decor = decor_strip()
    for k, v in decor.items(): print(f'# {k}: {v}')
    if '--yaml' in sys.argv:
        new = dict(re.findall(r'    (\S+): (\[props\.png,[^\]]*\])', lines))
        p = root + '/data/tilesets.yaml'; t = open(p).read()
        i = t.index('\njungle:'); j = t.find('\n', t.index('  props:', i))
        k = re.search(r'\n\S', t[j:]); k = j + k.start() if k else len(t)
        t = t[:j] + re.sub(r'(    (\S+): )\[props\.png,[^\]]*\]', lambda m: m.group(1) + new.get(m.group(2), m.group(0)[len(m.group(1)):]), t[j:k]) + t[k:]
        # each ground's decor: line (one line, in the terrain's block of the jungle tileset)
        i = t.index('\njungle:'); j = t.index('  props:', i)
        block = t[i:j]
        for k, v in decor.items():
            m = re.search(rf'\n    {k}:\n.*?(?=\n    \S|\n  \S|$)', block, re.S)
            seg = m.group(0)
            if re.search(r'\n      decor: .*', seg): new_seg = re.sub(r'\n      decor: .*', '\n      ' + v, seg)
            else: new_seg = seg + '\n      ' + v
            block = block.replace(seg, new_seg, 1)
        t = t[:i] + block + t[j:]
        open(p, 'w').write(t)
