# Campfires that burn (the user, 2026-11-02: animated campfires of a few sizes for the grasslands and the temple
# court): PixelLab bases (../front/props/fire_*.png) with the flames they were drawn with cut out (bright orange and
# yellow pixels become char and embers), and flames from flame.py laid over them, 8 frames.
#   python3 assets/wip/fire/build.py "$PWD"   -> art/worldtiles/fires.png, and prints its props: lines
import sys, os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
from flame import flames
root = sys.argv[1]
props = here + '/../front/props/'
# name: (base, flame width, height, where the flame's foot sits as a share of the base's width and height, seed)
FIRES = {
    'campfire_small': ('fire_small', 18, 26, 0.5, 0.55, 2),
    'campfire': ('fire_logs', 30, 44, 0.5, 0.62, 3),
    'bonfire': ('fire_bonfire', 50, 76, 0.5, 0.72, 4),
    'cookfire': ('fire_cauldron', 26, 26, 0.5, 0.78, 6),
}

def unflame(im):
    # The flame painted into the base: bright, saturated warm pixels. Char where it was dim, embers where bright.
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and r > 190 and g > 70 and b < 110 and r - b > 110:
                px[x, y] = (150, 46, 18, 255) if g > 160 else (64, 32, 24, 255)
    return im

out, lines, x = [], [], 0
for name, (base, fw, fh, fx, fy, seed) in FIRES.items():
    b = Image.open(props + base + '.png').convert('RGBA')
    b = unflame(b.crop(b.getbbox()))
    fl = flames(fw, fh, 8, seed, sparks=max(2, fw // 8))
    # Room above the base for the flame.
    top = max(0, fh - int(b.height * fy))
    W, H = b.width, b.height + top
    frames = []
    for f in fl:
        im = Image.new('RGBA', (W, H))
        im.paste(b, (0, top), b)
        im.alpha_composite(f, (int(W * fx - fw / 2), top + int(b.height * fy) - fh))
        frames.append(im)
    out.append((name, frames))
total = sum(fr[0].width * len(fr) + 4 for _, fr in out)
sheet = Image.new('RGBA', (total, max(fr[0].height for _, fr in out)))
for name, frames in out:
    w, h = frames[0].size
    for i, im in enumerate(frames):
        sheet.paste(im, (x + i * w, 0))
    lines.append(f'    {name}: [../fires.png, {x}, 0, {w}, {h}, null, null, 8, 10]')
    x += w * len(frames) + 4
sheet.save(root + '/art/worldtiles/fires.png', optimize=True)
print('\n'.join(lines))
