# python3 render.py <repo> <place> <x0> <y0> <x1> <y1> <out.png>: the region drawn at art scale (no decor).
import sys, json, subprocess, os
from PIL import Image
repo, place, x0, y0, x1, y1, out = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7]), sys.argv[7]
here = os.path.dirname(os.path.abspath(__file__))
d = json.loads(subprocess.run(['node', here + '/plan.js', repo, place, str(x0), str(y0), str(x1), str(y1)], capture_output=True, text=True, check=True).stdout)
C = d['cell']; im = Image.new('RGBA', ((x1 - x0 + 1) * C, (y1 - y0 + 1) * C), (0, 0, 0, 255))
cache = {}
def img(f):
    if f not in cache: cache[f] = Image.open(os.path.join(repo, d['dir'], f)).convert('RGBA')
    return cache[f]
for b in d['base']:
    t = d['terr'].get(b['t'])
    if not t: continue
    tile = t['tile']
    if isinstance(tile, list): tile = tile[0]
    if tile: im.alpha_composite(img(tile), ((b['x'] - x0) * C, (b['y'] - y0) * C))
    else:
        # Plain ground under a corner set, as the game draws it: that set's all-lower tile.
        w = next((v for v in d['terr'].values() if v.get('over') == b['t'] and v.get('index') and '0' in v['index']), None)
        if w:
            cx, cy = w['index']['0']
            im.alpha_composite(img(w['wang']).crop((cx * C, cy * C, cx * C + C, cy * C + C)), ((b['x'] - x0) * C, (b['y'] - y0) * C))
for c in d['corner']:
    t = d['terr'][c['t']]
    at = c.get('at') or t['index'][str(c['m'])]
    tile = img(t['wang']).crop((at[0] * C, at[1] * C, at[0] * C + C, at[1] * C + C))
    X, Y = int((c['x'] - 0.5 - x0) * C), int((c['y'] - 0.5 - y0) * C)
    im.alpha_composite(tile, (X, Y)) if X >= 0 and Y >= 0 else im.paste(tile, (X, Y), tile)
im.save(out); print(out, im.size)
