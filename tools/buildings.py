# The buildings of a generated town, drawn from PixelLab building kits: each type the town's map asks for
# (tools/citygen.js writes the list, assets/wip/cities/<town>-buildings.json) becomes one picture in the town's art
# folder, and its tileset's props in data/tilesets.yaml (between the `>>> tools/buildings.py <town>` and `<<<` lines)
# are rewritten to match. The town's paving and planks are the kits' floors.
#   python3 tools/buildings.py assets/wip/cities/zhomelonga_city-buildings.json
#
# A kit (create_building_kit, square_topdown, 64 px, ground at 90 degrees, three wall tiles at 48.19 degrees) is 80
# pieces on a 102x246 canvas; a square's floor is (19, 163)-(83, 227), and a wall stands 128 px (two squares). A
# building w squares wide and d deep is its wall pieces round the footprint and its roof pieces over it, lifted the
# wall's height: the picture covers d+2 rows, the roof above and the front wall below, as the map's squares do.
# Doors: `single` (one square, the halves of the kit's two doorway pieces), `double` (both), `none`. Windows are
# painted on the front wall by the kit's style (`slit`, `arch`). City walls: `wall_h_l|m|r` (a run's west end, middle,
# east end: the walk over a two-square face) and `wall_v_n|m` (a north-south run's north end and middle: the walk).
import json, os, re, sys
from PIL import Image, ImageDraw

CELL, LIFT, FX, FY = 64, 128, 19, 163          # square size, wall height, floor origin on a piece's canvas
# Piece indices (the kit's placement rules).
WALL = {('N',): 1, ('E',): 2, ('S',): 3, ('W',): 4, ('N', 'W'): 12, ('E', 'N'): 9, ('S', 'W'): 11, ('E', 'S'): 10,
        ('N', 'S'): 54, ('E', 'W'): 55, ('N', 'S', 'W'): 51, ('E', 'N', 'S'): 49, ('E', 'N', 'W'): 50, ('E', 'S', 'W'): 52,
        ('E', 'N', 'S', 'W'): 53}
DOOR_A, DOOR_B, FLOOR, FLAT = 36, 37, 0, 44
ROOF = {'interior': 79, 'N': 60, 'E': 61, 'S': 62, 'W': 63, 'NE': 64, 'SE': 65, 'SW': 66, 'NW': 67,
        'ridgeEW': 72, 'ridgeNS': 73, 'endE': 74, 'endW': 75, 'endN': 76, 'endS': 77, 'peak': 78}
MX, MY = 24, 200                                 # margins round a footprint while drawing

_cache = {}
def piece(kit, i):
    k = (kit['dir'], i)
    if k not in _cache: _cache[k] = Image.open(os.path.join(kit['dir'], f'p{i}.png')).convert('RGBA')
    return _cache[k]

def door_single(kit):
    a, b = piece(kit, DOOR_A), piece(kit, DOOR_B)
    out = a.copy(); mid = FX + CELL // 2
    out.paste(b.crop((mid, 0, b.width, b.height)), (mid, 0))
    return out

def mask(x, y, w, d):
    m = []
    if x == w - 1: m.append('E')
    if y == 0: m.append('N')
    if y == d - 1: m.append('S')
    if x == 0: m.append('W')
    return tuple(m)

def roof_piece(x, y, w, d):
    if w == 1 and d == 1: return ROOF['peak']
    if d == 1: return ROOF['endW'] if x == 0 else ROOF['endE'] if x == w - 1 else ROOF['ridgeEW']
    if w == 1: return ROOF['endN'] if y == 0 else ROOF['endS'] if y == d - 1 else ROOF['ridgeNS']
    n, s, wv, e = y == 0, y == d - 1, x == 0, x == w - 1
    if n and wv: return ROOF['NW']
    if n and e: return ROOF['NE']
    if s and wv: return ROOF['SW']
    if s and e: return ROOF['SE']
    return ROOF['N'] if n else ROOF['S'] if s else ROOF['W'] if wv else ROOF['E'] if e else ROOF['interior']

def shade(img):
    """The darkest and lightest opaque colours in an image region (for painting windows in the wall's own tones)."""
    px = [p for p in img.convert('RGBA').get_flattened_data() if p[3] > 200] if hasattr(img, 'get_flattened_data') else [p for p in img.getdata() if p[3] > 200]
    px.sort(key=lambda p: p[0] + p[1] + p[2])
    return px[len(px) // 12][:3], px[-len(px) // 8][:3]

def window(dr, img, cx, top, style):
    dark, light = shade(img.crop((cx - 30, top, cx + 30, top + 60)))
    if style == 'arch':
        x0, x1, y0, y1 = cx - 9, cx + 9, top, top + 30
        dr.rectangle([x0 - 2, y0 + 6, x1 + 2, y1 + 2], fill=dark + (255,))
        dr.pieslice([x0 - 2, y0 - 2, x1 + 2, y0 + 16], 180, 360, fill=dark + (255,))
        dr.rectangle([x0, y0 + 7, x1, y1], fill=(232, 184, 96, 255))
        dr.pieslice([x0, y0, x1, y0 + 14], 180, 360, fill=(232, 184, 96, 255))
        dr.line([cx, y0 + 2, cx, y1], fill=dark + (255,), width=2)
        dr.line([x0, y0 + 16, x1, y0 + 16], fill=dark + (255,), width=2)
        dr.rectangle([x0 - 3, y1 + 1, x1 + 3, y1 + 3], fill=light + (255,))
    else:   # a slit, dark, under a pale lintel
        dr.rectangle([cx - 7, top - 3, cx + 7, top], fill=light + (255,))
        dr.rectangle([cx - 4, top + 1, cx + 4, top + 30], fill=(22, 20, 18, 255))
        dr.rectangle([cx - 4, top + 1, cx + 4, top + 4], fill=(10, 9, 8, 255))
        dr.rectangle([cx - 6, top + 31, cx + 6, top + 33], fill=light + (255,))

# A variant's roof: darker or lighter, warmer or cooler (variant 0 is the kit's own).
TONES = [(1.0, 0), (0.86, 6), (1.1, -6), (0.94, -10)]

def tone(img, k, warm):
    r, g, b, a = img.split()
    f = lambda ch, add: ch.point(lambda v: max(0, min(255, int(v * k + add))))
    return Image.merge('RGBA', (f(r, warm), f(g, 0), f(b, -warm), a))

def building(kit, w, d, door, variant=0):
    W, H = w * CELL + 2 * MX, d * CELL + MY + 8
    out = Image.new('RGBA', (W, H))
    at = lambda x, y, lift=0: (MX + x * CELL - FX, MY + y * CELL - FY - lift)
    cols = [] if door == 'none' else [w // 2 - 1, w // 2] if door == 'double' else [w // 2]
    for y in range(d):
        for x in range(w):
            m = mask(x, y, w, d)
            if not m: continue
            if y == d - 1 and x in cols and 'E' not in m and 'W' not in m:
                # One square deep: no back wall there, or its face would fill the doorway (the roof hides the gap).
                p = door_single(kit) if door == 'single' else piece(kit, DOOR_A if x == cols[0] else DOOR_B)
            else: p = piece(kit, WALL[m])
            out.alpha_composite(p, at(x, y))
    # The doorway: dark inside, a little light on the floor.
    fb = MY + d * CELL
    for x in cols:
        for yy in range(fb - 96, fb):
            for xx in range(MX + x * CELL, MX + (x + 1) * CELL):
                a = out.getpixel((xx, yy))
                if a[3] < 255:
                    t = (yy - (fb - 96)) / 96
                    c = (int(20 + 26 * t * t), int(16 + 18 * t * t), int(12 + 12 * t * t))
                    out.putpixel((xx, yy), c + (255,))
    style = kit.get('windows', 'slit')
    dr = ImageDraw.Draw(out)
    for x in range(w):
        if x in cols or (w >= 4 and x in (0, w - 1) and door == 'none'): continue
        if any(abs(x - c) == 0 for c in cols): continue
        window(dr, out, MX + x * CELL + CELL // 2, fb - CELL * 2 + 30, style)
    roof = Image.new('RGBA', out.size)
    for y in range(d):
        for x in range(w):
            roof.alpha_composite(piece(kit, roof_piece(x, y, w, d)), at(x, y, LIFT))
    if variant: roof = tone(roof, *TONES[variant % len(TONES)])
    out.alpha_composite(roof)
    # Its shadow on the street at its foot.
    sh = Image.new('RGBA', out.size); sd = ImageDraw.Draw(sh)
    for i in range(7): sd.line([MX + 2, fb + i, MX + w * CELL - 3, fb + i], fill=(0, 0, 0, int(70 * (1 - i / 7))))
    sh.alpha_composite(out)
    return sh, MX, fb    # the footprint's left edge and bottom on this picture

def wall(kit, which):
    """A slice of city wall: a run three squares long drawn whole, then one square of it cut out."""
    run = 3
    W, H = run * CELL + 2 * MX, CELL + MY + 8
    out = Image.new('RGBA', (W, H))
    at = lambda x, lift=0: (MX + x * CELL - FX, MY - FY - lift)
    top = piece(kit, FLOOR).crop((FX, FY, FX + CELL, FY + CELL))
    if which.startswith('wall_h'):
        for x in range(run):
            out.alpha_composite(piece(kit, {0: 11, run - 1: 10}.get(x, 3)), at(x))
        for x in range(run):
            out.alpha_composite(top, (MX + x * CELL, MY - LIFT))
        dr = ImageDraw.Draw(out)
        dr.line([MX, MY - LIFT, MX + run * CELL - 1, MY - LIFT], fill=(30, 34, 30, 255), width=3)
        dr.line([MX, MY - LIFT, MX, MY - LIFT + CELL], fill=(30, 34, 30, 255), width=3)
        dr.line([MX + run * CELL - 1, MY - LIFT, MX + run * CELL - 1, MY - LIFT + CELL], fill=(30, 34, 30, 255), width=3)
        i = {'wall_h_l': 0, 'wall_h_m': 1, 'wall_h_r': 2}[which]
        img = out.crop((MX + i * CELL, MY - LIFT, MX + (i + 1) * CELL, MY + CELL))
        return img, 0, 3 * CELL
    img = top.copy()
    dr = ImageDraw.Draw(img)
    dr.line([0, 0, 0, CELL - 1], fill=(30, 34, 30, 255), width=3)
    dr.line([CELL - 1, 0, CELL - 1, CELL - 1], fill=(30, 34, 30, 255), width=3)
    if which == 'wall_v_n': dr.line([0, 0, CELL - 1, 0], fill=(30, 34, 30, 255), width=3)
    return img, 0, CELL

def main(spec_path):
    S = json.load(open(spec_path))
    art, kits = S['art'], S['kits']
    os.makedirs(art, exist_ok=True)
    props = []
    for name, sp in sorted(S['sprites'].items()):
        kit = kits[sp['kit']]
        if 'wall' in sp:
            img, left, bottom = wall(kit, sp['wall'])
            box = (0, 0, img.width, img.height)
        else:
            img, left, bottom = building(kit, sp['w'], sp['d'], sp.get('door', 'single'), sp.get('variant', 0))
            box = img.getbbox()
        img = img.crop(box)
        img.save(os.path.join(art, name + '.png'))
        # Laid from the bottom-left square's top-left corner, in the art's pixels (mapview: an offset prop's top is
        # 4 px above its square's at dy 0).
        dx = box[0] - left
        dy = box[1] - (bottom - CELL) + 4
        props.append(f'    {name}: [{name}.png, 0, 0, {img.width}, {img.height}, {dx}, {dy}]')
    # The grounds: the kits' floors.
    floors = {'paving.png': 'saurian_house', 'planks.png': 'elven', 'stone.png': 'saurian_civic'}
    for f, k in floors.items():
        if k in kits: piece(kits[k], FLOOR).crop((FX, FY, FX + CELL, FY + CELL)).save(os.path.join(art, f))
    ts = 'data/tilesets.yaml'
    text = open(ts).read()
    begin, end = f'    # >>> tools/buildings.py {S["town"]}\n', '    # <<< tools/buildings.py\n'
    if begin not in text: sys.exit(f'{ts}: no "{begin.strip()}" line in the {S["tileset"]} tileset\'s props')
    a = text.index(begin) + len(begin); b = text.index(end, a)
    open(ts, 'w').write(text[:a] + '\n'.join(props) + '\n' + text[b:])
    print(f'{S["town"]}: {len(props)} pictures in {art}, props written to {ts}')

if __name__ == '__main__':
    main(sys.argv[1])
