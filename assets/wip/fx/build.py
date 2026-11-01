# Builds art/fx/ from the PixelLab effect exports here (vfx_workbench; each saved to the user's My effects as
# "Bolt <colour>", "Impact grey", "Burst fire", "Fire wall"): one horizontal strip per effect.
#   bolt-<colour>.png    the energy-orb preset, 0.6x, in that colour ramp: 8 frames of 48 px, a loop (a bolt in flight)
#   impact-<colour>.png  the impact-burst preset exported grey and recoloured here with that bolt's own colours,
#                        darkest to lightest: 5 frames of 64 px (the two blank tail frames dropped)
#   burst-fire.png       the explosion preset: 12 frames of 96 px (an area spell)
#   flame.png            the flame preset, 64x76, 8 frames, a loop (a wall of fire)
#   python3 assets/wip/fx/build.py "$PWD"
import json, sys
from PIL import Image

root = sys.argv[1]
here, out = root + '/assets/wip/fx/', root + '/art/fx/'
COLOURS = ['fire', 'frost', 'lightning', 'venom', 'nature', 'light', 'shadow', 'arcane', 'wind', 'earth']

def frames(name):
    sheet = Image.open(here + name + '.png').convert('RGBA')
    meta = json.load(open(here + name + '.json')) if name in ('impact-grey', 'burst-fire', 'fire-wall') else None
    if meta: return [sheet.crop((f['frame']['x'], f['frame']['y'], f['frame']['x'] + f['frame']['w'], f['frame']['y'] + f['frame']['h'])) for f in meta['frames']]
    n, s = 8, 48  # the bolts: 8 frames of 48 in a 3x3 grid
    return [sheet.crop(((i % 3) * s, (i // 3) * s, (i % 3 + 1) * s, (i // 3 + 1) * s)) for i in range(n)]

def strip(fs, path):
    w, h = fs[0].size
    o = Image.new('RGBA', (w * len(fs), h))
    for i, f in enumerate(fs): o.paste(f, (i * w, 0))
    o.save(path)

def palette(fs):
    cols = {c[:3] for f in fs for c in f.getdata() if c[3] > 0}
    return sorted(cols, key=lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2])

def recolour(fs, pal):
    out = []
    for f in fs:
        g = Image.new('RGBA', f.size); px = f.load(); gp = g.load()
        for y in range(f.size[1]):
            for x in range(f.size[0]):
                r, gg, b, a = px[x, y]
                if a == 0: continue
                l = r / 255
                gp[x, y] = pal[min(len(pal) - 1, round(l * (len(pal) - 1)))] + (a,)
        out.append(g)
    return out

if __name__ == '__main__':
    import os
    os.makedirs(out, exist_ok=True)
    impact = [f for f in frames('impact-grey') if f.getbbox()]
    for c in COLOURS:
        fs = frames('bolt-' + c)
        strip(fs, out + f'bolt-{c}.png')
        strip(recolour(impact, palette(fs)), out + f'impact-{c}.png')
    strip([f for f in frames('burst-fire') if f.getbbox()], out + 'burst-fire.png')
    strip(frames('fire-wall'), out + 'flame.png')
    print('ok', len(impact), 'impact frames')
