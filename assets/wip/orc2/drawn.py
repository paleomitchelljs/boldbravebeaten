# Pieces drawn here from the tiles' own pixels, where PixelLab's came out wrong (the user, 2026-11-08: the waterfall
# "tilted and mismatched", the overlook's steps): the overlook's steps, cut into its face, and the waterfall, a cascade
# down the mountains' stepped slopes in the river's colours, eight frames.
#   python3 assets/wip/orc2/drawn.py "$PWD"
import random, sys
from PIL import Image
root = sys.argv[1]
OUT = root + '/art/worldtiles/highland/'

def steps():
    # Two squares wide, the ledge's face high: its straight run of face (the plateau set's corner tiles [3, 0], top
    # over face, and [3, 1], face over floor) with a flight of four steps cut into it: each tread the grey stone of the
    # face's lip, lit, its back edge in shadow; each riser the face's own rock, darker at its lip; dark cheeks either
    # side, lit on the left.
    sheet = Image.open(OUT + 'plateau.png').convert('RGBA')
    run = Image.new('RGBA', (64, 128)); run.paste(sheet.crop((192, 0, 256, 64)), (0, 0)); run.paste(sheet.crop((192, 64, 256, 128)), (0, 64))
    lum = lambda c: c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
    rp = run.load()
    dark = [y for y in range(128) if sum(lum(rp[x, y]) < 72 for x in range(64)) > 38]
    f0, f1 = min(dark), max(dark)
    lip = [y for y in range(f0 - 12, f0) if sum(lum(rp[x, y]) > 95 for x in range(64)) > 20] or [f0 - 4]
    W = 128; img = Image.new('RGBA', (W, 128), (0, 0, 0, 0))
    # laid half a square over, as the corner tiles are, so the cheeks run on from the face either side
    for x in range(-32, W, 64): img.paste(run, (x, 0))
    px = img.load()
    # Seen from above, a tread shows more than its riser: each step a wide lit tread of the lip's stone (flat, a little
    # grain, its front edge brightest) over a short dark riser of the face's rock.
    x0, x1, n = 16, W - 16, 4
    h = (f1 - f0 + 1) / n
    stone = sorted({rp[x, y][:3] for x in range(64) for y in lip}, key=lum)
    light, mid = stone[len(stone) * 3 // 4:], stone[len(stone) // 3:len(stone) * 3 // 4]
    rnd = random.Random(3)
    for k in range(n):
        ya, yb = round(f0 + k * h), round(f0 + (k + 1) * h)
        tread = round(h * 0.62)
        for y in range(ya, yb):
            for x in range(x0, x1):
                if y < ya + tread:
                    c = (light[-1] if y == ya + tread - 1 else rnd.choice(mid if y == ya else light + mid))
                    px[x, y] = c + (255,)
                else:
                    c = rp[(x + 32) % 64, f0 + 3 + (y - ya - tread)]
                    px[x, y] = tuple(int(v * 0.7) for v in c[:3]) + (255,)
            # the sides of the cut: lit on the left, in shadow on the right
            px[x0, y] = (34, 33, 31, 255); px[x0 + 1, y] = (130, 125, 116, 255)
            for d in range(3): px[x1 - 1 - d, y] = tuple(int(v * (0.35 + 0.15 * d)) for v in px[x1 - 1 - d, y][:3]) + (255,)
    out = img.crop((0, f0 - 1, W, f1 + 2))
    out.save(OUT + 'steps.png')
    return out.size, f0 - 1

def waterfall(frames=8, W=96, H=208, step=64):
    # Mostly white water, blue-grey where it is thin or shadowed, falling from the top over a lip every `step` pixels
    # (the mountains' rings), its sides ragged and wandering, a burst of foam at each lip and a pool of foam at the foot.
    # Streaks run down: frame k has them k * H / frames lower, so the frames loop.
    rnd = random.Random(7)
    pal = [(35, 70, 72), (53, 89, 90), (75, 113, 114), (101, 138, 138), (140, 172, 172), (182, 208, 206), (214, 232, 230), (240, 248, 246)]
    cols = []
    for x in range(W):
        s = [0.0] * H
        for _ in range(4):
            y0 = rnd.randrange(H); L = rnd.randrange(10, 46); a = rnd.uniform(-0.3, 0.35)
            for d in range(L): s[(y0 + d) % H] += a * (1 - d / L)
        cols.append(s)
    lips = list(range(step - 10, H - 24, step))
    # the sides: a half-width per row that wanders, wider below each lip
    wob = [rnd.uniform(-1, 1) for _ in range(H // 6 + 3)]
    def half(y):
        k = sum(1 for l in lips if y > l)
        t = y / 6; i = int(t); f = t - i
        return 18 + 5 * k + 3 * (wob[i] * (1 - f) + wob[i + 1] * f)
    strip = Image.new('RGBA', (W * frames, H + 14), (0, 0, 0, 0))
    for fr in range(frames):
        im = Image.new('RGBA', (W, H + 14), (0, 0, 0, 0)); px = im.load()
        shift = fr * H // frames
        for y in range(H):
            hw = half(y)
            for x in range(W):
                dx = abs(x - W / 2 + 0.5)
                if dx > hw + (1 if rnd.random() < 0.3 else 0): continue
                v = 0.72 + cols[x][(y - shift) % H] - 0.45 * (dx / hw) ** 4
                px[x, y] = pal[max(0, min(len(pal) - 1, int(v * len(pal))))] + (255,)
            for l in lips:
                if -2 <= y - l < 6:
                    for x in range(W):
                        dx = abs(x - W / 2 + 0.5)
                        if dx <= half(l + 6) + 3 and rnd.random() < 0.7 - 0.08 * abs(y - l - 2): px[x, y] = pal[-1 - rnd.randrange(2)] + (255,)
        for y in range(H - 16, H + 14):
            for x in range(W):
                e = ((x - W / 2 + 0.5) / (W / 2)) ** 2 + ((y - (H - 1)) / 13) ** 2
                if e < 1 and rnd.random() < 0.9 - 0.6 * e:
                    px[x, y] = pal[max(3, min(len(pal) - 1, int((1 - e) * 5 + 3 + rnd.random() * 1.5)))] + (255,)
        strip.alpha_composite(im, (fr * W, 0))
    strip.save(OUT + 'waterfall.png')
    return W, H + 14, frames

def window():
    # An arched window cut in the castle's own wall (the user, 2026-11-08: "windows that don't match their walls"): its
    # frame is the wall face's stone, lit on the left and top and shadowed on the right, the opening dark, two iron bars.
    face = Image.open(root + '/art/worldtiles/orc/orc-fort.png').convert('RGBA').crop((192, 0, 256, 64))
    fp = face.load()
    lum = lambda c: c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
    rows = [y for y in range(64) if sum(lum(fp[x, y]) < 80 for x in range(64)) > 40]
    stone = sorted({fp[x, y][:3] for x in range(64) for y in rows}, key=lum)
    lit, mid, shade_ = stone[-1], stone[len(stone) // 2], stone[len(stone) // 6]
    W, H = 18, 30
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); px = img.load()
    cx, r = (W - 1) / 2, (W - 1) / 2
    def inside(x, y, pad):   # an arch: a half circle on a rectangle
        if y >= r: return pad <= x <= W - 1 - pad and y <= H - 1 - pad
        return (x - cx) ** 2 + (y - r) ** 2 <= (r - pad) ** 2
    for y in range(H):
        for x in range(W):
            if not inside(x, y, 0): continue
            if inside(x, y, 3):
                c = (12, 15, 20) if not (x in (6, 11) and y > 4) else (58, 62, 66)   # the dark, two iron bars
                if y > H - 6: c = (20, 24, 30)                                       # the sill's shadow
            else:
                c = lit if (x < cx and not inside(x - 1, y, 0)) or (y < r and not inside(x, y - 1, 0)) else (shade_ if x > cx else mid)
            px[x, y] = c[:3] + (255,)
    for x in range(W): px[x, H - 1] = lit[:3] + (255,)                              # the sill, lit
    img.save(root + '/art/worldtiles/orc/window.png')
    return img.size

if __name__ == '__main__':
    print('window', window())
    print('steps', steps())
    print('waterfall', waterfall())
