# python3 render.py <repo> <tileset> <ground letter> <out.png> <row> <row> ...: a made-up map drawn at art scale as the
# game draws it (no decor), the faces of walls two or more thick raised half a square as mapview.js liftFaces does.
import sys, json, subprocess, os
from PIL import Image
repo, tsid, gl, out, rows = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5:]
here = os.path.dirname(os.path.abspath(__file__))
d = json.loads(subprocess.run(['node', here + '/scene.js', repo, tsid, gl, *rows], capture_output=True, text=True, check=True).stdout)
C = d['cell']; W, H = len(rows[0]), len(rows)
im = Image.new('RGBA', (W * C, H * C), (0, 0, 0, 255))
cache = {}
def img(f):
    if f not in cache: cache[f] = Image.open(os.path.join(repo, d['dir'], f)).convert('RGBA')
    return cache[f]
for b in d['base']:
    t = d['terr'].get(b['t'])
    if not t: continue
    tile = t['tile'][0] if isinstance(t['tile'], list) else t['tile']
    if tile: im.alpha_composite(img(tile), (b['x'] * C, b['y'] * C)); continue
    w = next((v for v in d['terr'].values() if v.get('over') == b['t'] and v.get('index') and '0' in v['index']), None)
    if w:
        cx, cy = w['index']['0']
        im.alpha_composite(img(w['wang']).crop((cx * C, cy * C, cx * C + C, cy * C + C)), (b['x'] * C, b['y'] * C))
big = Image.new('RGBA', ((W + 2) * C, (H + 2) * C))
big.paste(im, (C, C))
for c in d['corner']:
    t = d['terr'][c['t']]
    at = c.get('at') or t['index'][str(c['m'])]
    tile = img(t['wang']).crop((at[0] * C, at[1] * C, at[0] * C + C, at[1] * C + C))
    big.alpha_composite(tile, (int((c['x'] + 0.5) * C), int((c['y'] + 0.5) * C)))
im = big.crop((C, C, (W + 1) * C, (H + 1) * C))
# liftFaces: a wall square with wall north of it and none south has its lower half (and a lip) copied up half a square.
solid = lambda x, y: not (0 <= x < W and 0 <= y < H) or rows[y][x] in '#+'
L, half = max(1, round(C * 6 / 64)), C // 2
for y in range(H):
    for x in range(W):
        if not solid(x, y) or solid(x, y + 1) or not solid(x, y - 1) or rows[y][x] == '+' and False:
            continue
        strip = im.crop((x * C, y * C + half, x * C + C, y * C + half + half + L))
        im.paste(strip.crop((0, 0, C, L)), (x * C, y * C))
        im.paste(strip.crop((0, L, C, L + half)), (x * C, y * C + L))
im.save(out); print(out, im.size)
