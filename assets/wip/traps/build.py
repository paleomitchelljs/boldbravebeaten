# Animated traps (the user, 2026-11-02: "animated traps, like the swinging blades in the goblin mine"), built from
# PixelLab parts in ../front/props (trap_*.png) and moved by code, so each loop closes exactly:
#   python3 assets/wip/traps/build.py "$PWD"
# Writes art/worldtiles/traps.png and prints its props: lines (every tileset finds them through the props fallback).
#   blade     an axe blade on a rod swinging across the square (a pendulum), its shadow sweeping the floor
#   spiketrap an iron plate whose spikes stab up and sink back
#   vent      a floor grate that glows, then throws up a jet of flame
#   pit       a trapdoor fallen open (sprung); pit_hint, the same faint (found, not yet sprung)
# A trap in a place names one by `sprite`; one without draws the spiketrap. `<sprite>_still` is the trap at rest
# (sprung or disarmed).
import sys, os, math
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/../fire')
from flame import flames

root = sys.argv[1]
parts = os.path.dirname(os.path.abspath(__file__)) + '/../front/props/'
part = lambda n: (lambda im: im.crop(im.getbbox()))(Image.open(parts + n + '.png').convert('RGBA'))

def scale2x(im):
    # EPX: doubles a pixel-art image without blurring, so a rotation after it keeps clean edges (a cheap RotSprite).
    w, h = im.size
    s, out = im.load(), Image.new('RGBA', (w * 2, h * 2))
    o = out.load()
    for y in range(h):
        for x in range(w):
            P = s[x, y]
            A = s[x, y - 1] if y > 0 else P; B = s[x + 1, y] if x < w - 1 else P
            C = s[x - 1, y] if x > 0 else P; D = s[x, y + 1] if y < h - 1 else P
            o[2 * x, 2 * y] = A if C == A and C != D and A != B else P
            o[2 * x + 1, 2 * y] = B if A == B and A != C and B != D else P
            o[2 * x, 2 * y + 1] = C if D == C and D != B and C != A else P
            o[2 * x + 1, 2 * y + 1] = D if B == D and B != A and D != C else P
    return out

def rotsprite(im, deg, pivot):
    # Rotate about pivot (x, y in im's pixels); returns the rotated image and where the pivot now is (same canvas).
    big = scale2x(scale2x(scale2x(im)))
    r = big.rotate(deg, resample=Image.NEAREST, center=(pivot[0] * 8 + 4, pivot[1] * 8 + 4), expand=False)
    return r.resize(im.size, Image.NEAREST)

FR = 16
frames = {}

# Blade: the part sized to a pendulum about 84 px long, hung from a pivot over the square's top edge.
bl = part('trap_blade')
k = 84 / bl.height
bl = bl.resize((max(1, round(bl.width * k)), 84), Image.NEAREST)
W, H = 172, 98
pv = (W // 2, 3)
canvas = Image.new('RGBA', (W, H))
canvas.paste(bl, (pv[0] - bl.width // 2, pv[1] - 1), bl)
blade = []
for f in range(FR):
    a = 52 * math.sin(2 * math.pi * f / FR)
    im = Image.new('RGBA', (W, H))
    # Its shadow on the floor, under the blade's head.
    tip = pv[0] + math.sin(math.radians(a)) * 74
    sh = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(sh)
    d.ellipse((tip - 14, H - 9, tip + 14, H - 3), fill=(0, 0, 0, 90))
    im.alpha_composite(sh)
    im.alpha_composite(rotsprite(canvas, -a, pv))
    blade.append(im)
frames['blade'] = (blade, 12)
frames['blade_still'] = ([blade[0]], 0)

# Spike trap: the plate, with nine spikes rising out of its holes.
plate = part('trap_plate')
pw, ph = plate.size
holes = [(pw * (i + 1) // 4, ph * (j + 1) // 4) for j in range(3) for i in range(3)]
heights = [0, 0, 0, 0, 0, 0, 8, 16, 20, 20, 20, 20, 15, 10, 4, 0]
SH = ph + 22
spikes = []
for f in range(FR):
    im = Image.new('RGBA', (pw, SH))
    im.paste(plate, (0, SH - ph), plate)
    d = ImageDraw.Draw(im)
    hgt = heights[f]
    for hx, hy in sorted(holes, key=lambda p: p[1]):
        y0 = SH - ph + hy
        for t in range(hgt):
            w = max(0, round(3 * (1 - t / max(1, hgt))))
            d.line((hx - w, y0 - t, hx + w, y0 - t), fill=(72, 72, 78, 255))
            d.point((hx - w, y0 - t), fill=(40, 38, 42, 255))
            if w: d.point((hx + w - 1, y0 - t), fill=(176, 176, 184, 255))
        if hgt:
            d.point((hx, y0 - hgt), fill=(220, 220, 228, 255))
    spikes.append(im)
frames['spiketrap'] = (spikes, 8)
frames['spiketrap_still'] = ([spikes[0]], 0)

# Vent: the grate glowing, then a jet of flame for half the loop.
vent = part('trap_vent')
vw, vh = vent.size
fl = flames(28, 60, 8, 5, sparks=6)
VH = vh + 54
vents = []
for f in range(FR):
    im = Image.new('RGBA', (max(vw, 28), VH))
    gx = (im.width - vw) // 2
    im.paste(vent, (gx, VH - vh), vent)
    if f >= 8:
        g = [0.35, 0.8, 1, 1, 1, 0.9, 0.6, 0.3][f - 8]
        fr = fl[f % 8]
        hh = max(1, round(60 * g))
        fr = fr.resize((28, hh), Image.NEAREST)
        im.alpha_composite(fr, ((im.width - 28) // 2, VH - vh // 2 - hh))
    vents.append(im)
frames['vent'] = (vents, 10)
frames['vent_still'] = ([vents[0]], 0)

pit = part('trap_pit')
hint = pit.copy(); hint.putalpha(hint.getchannel('A').point(lambda a: a * 2 // 5))
frames['pit'] = ([pit], 0)
frames['pit_still'] = ([pit], 0)
frames['pit_hint'] = ([hint], 0)

# Pack: each animation's frames side by side, the animations one after another.
total = sum(len(fs) * fs[0].width + 4 for fs, _ in frames.values())
sheet = Image.new('RGBA', (total, max(fs[0].height for fs, _ in frames.values())))
x = 0
for name, (fs, fps) in frames.items():
    w, h = fs[0].size
    for i, im in enumerate(fs):
        sheet.paste(im, (x + i * w, 0))
    line = f'    {name}: [../traps.png, {x}, 0, {w}, {h}'
    if name == 'blade' or name == 'blade_still':
        # The pivot over the middle of the square's top edge, the blade's head swinging through the square.
        line += f', {32 - pv[0]}, {64 - h}'
        line += f', {len(fs)}, {fps}]' if fps else ']'
    else:
        line += f', null, null, {len(fs)}, {fps}]' if fps else ']'
    print(line)
    x += len(fs) * w + 4
sheet.save(root + '/art/worldtiles/traps.png', optimize=True)
