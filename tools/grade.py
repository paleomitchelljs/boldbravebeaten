#!/usr/bin/env python3
"""Grade a tileset's greens: less saturated, a little darker, hue drawn toward olive.

    ~/.venvs/worldsim/bin/python tools/grade.py art/worldtiles/w1 [--sat 0.75 --val 0.94 --hue 100 --pull 0.3]

Every PNG in the folder and its plain/ (not props*.png) is changed in place, the same colour to the same colour, so
sheets that met before still meet. Each graded file's hash is kept in <folder>/graded.json: a file is graded once,
and again only after it is remade (tools/plaingrounds.py, a new cut sheet).

    --calm plain/west-road.png plain/west-road-cut.png   (with --dir as above)

calms a noisy ground instead: every colour near the sheet's commonest one is drawn halfway (--still) to it, so the
speckle softens and the edges (dark rims, grass) stay. Run it once per remade sheet.
"""
import sys, os, json, hashlib, colorsys, argparse
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('dir'); ap.add_argument('--sat', type=float, default=0.75); ap.add_argument('--val', type=float, default=0.94)
ap.add_argument('--hue', type=float, default=100); ap.add_argument('--pull', type=float, default=0.3)
ap.add_argument('--calm', nargs='*', default=[]); ap.add_argument('--still', type=float, default=0.5)
ap.add_argument('--lo', type=float, default=75); ap.add_argument('--hi', type=float, default=155)
a = ap.parse_args()
log_p = os.path.join(a.dir, 'graded.json')
log = json.load(open(log_p)) if os.path.exists(log_p) else {}
sha = lambda p: hashlib.sha1(open(p, 'rb').read()).hexdigest()
cache = {}
def grade(c):
    if c in cache: return cache[c]
    r, g, b = c; h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255); hd = h * 360
    out = c
    if a.lo <= hd <= a.hi and s > 0.25:
        # The further from the band's edges, the fuller the grade (no hard line between a graded green and a teal).
        w = min(1, (hd - a.lo) / 10, (a.hi - hd) / 10, (s - 0.25) / 0.1)
        h2 = (hd + (a.hue - hd) * a.pull * w) / 360
        s2 = s * (1 - (1 - a.sat) * w); v2 = v * (1 - (1 - a.val) * w)
        out = tuple(round(x * 255) for x in colorsys.hsv_to_rgb(h2, s2, v2))
    cache[c] = out; return out
if a.calm:
    import collections
    for key in a.calm:
        p = os.path.join(a.dir, key); im = Image.open(p).convert('RGBA'); px = im.load()
        cnt = collections.Counter(px[x, y][:3] for y in range(im.height) for x in range(im.width) if px[x, y][3])
        m = cnt.most_common(1)[0][0]
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, al = px[x, y]
                if al and abs(r - m[0]) + abs(g - m[1]) + abs(b - m[2]) < 90:
                    px[x, y] = tuple(round(c + (mc - c) * a.still) for c, mc in zip((r, g, b), m)) + (al,)
        im.save(p); log[key] = sha(p); print('calmed', key, 'toward', m)
    json.dump(log, open(log_p, 'w'), indent=1, sort_keys=True); sys.exit()
n = 0
for sub in ('', 'plain'):
    d = os.path.join(a.dir, sub)
    for f in sorted(os.listdir(d)):
        if not f.endswith('.png') or f.startswith('props') or f == 'bridge.png': continue
        p = os.path.join(d, f); key = os.path.join(sub, f)
        if log.get(key) == sha(p): continue
        im = Image.open(p).convert('RGBA'); px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, al = px[x, y]
                if al: px[x, y] = grade((r, g, b)) + (al,)
        im.save(p); log[key] = sha(p); n += 1
json.dump(log, open(log_p, 'w'), indent=1, sort_keys=True)
print(f'{n} sheets graded')
