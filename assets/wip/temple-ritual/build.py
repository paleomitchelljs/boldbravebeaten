# Builds the ritual chamber's art in art/worldtiles/temple/ from the PixelLab sheets and pieces here:
#   ritual-wall.png   the wall cliff set (the court wall's 25-tile layout); copied as it is.
#   ritual-pool.png   the floor over the shallow pool (a 16-tile corner set, the default layout); copied as it is.
#   ritual-shallows.png  the plain pool tile (LLLL), for the ground under the shallows letter.
#   ritual-props.png  the orb on its dais (the orb laid over the dais, enlarged and see-through, so the horror coiled
#                     in the dais shows inside it), a small pyramid, the stair up to the palace, a wall niche.
#   python3 assets/wip/temple-ritual/build.py "$PWD"
import sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/temple-ritual/'
out = root + '/art/worldtiles/temple/'

Image.open(here + 'ritual-wall.png').convert('RGBA').save(out + 'ritual-wall.png')
pool = Image.open(here + 'ritual-pool.png').convert('RGBA')
pool.save(out + 'ritual-pool.png')
pool.crop((2 * 64, 1 * 64, 3 * 64, 2 * 64)).save(out + 'ritual-shallows.png')

# The orb: PixelLab drew it hovering above the dais, opaque. Enlarge it 1.3x and lay it at half strength over the dais
# (its highlights stronger), so it reads as a glass sphere with the thing inside.
src = Image.open(here + 'p-orb.png').convert('RGBA')
orb, dais = src.crop((0, 0, 192, 108)), src.crop((0, 108, 192, 208))
orb = orb.crop(orb.getbbox())
orb = orb.resize((round(orb.width * 1.3), round(orb.height * 1.3)), Image.NEAREST)
op = orb.load()
for y in range(orb.height):
    for x in range(orb.width):
        r, g, b, a = op[x, y]
        op[x, y] = (r, g, b, round(a * (0.85 if r + g + b > 600 else 0.5)))
orbd = Image.new('RGBA', (192, 240), (0, 0, 0, 0))
orbd.alpha_composite(dais, (0, 140))
orbd.alpha_composite(orb, (96 - orb.width // 2, 164 - orb.height // 2))
orbd = orbd.crop(orbd.getbbox())

pieces = [('orb', orbd), ('pyramid', Image.open(here + 'p-pyramid.png').convert('RGBA')),
          ('stair', Image.open(here + 'p-stair.png').convert('RGBA')), ('niche', Image.open(here + 'f-niche.png').convert('RGBA'))]
pieces = [(n, im.crop(im.getbbox())) for n, im in pieces]
sheet = Image.new('RGBA', (sum(im.width + 4 for _, im in pieces), max(im.height for _, im in pieces)), (0, 0, 0, 0))
x = 0
for n, im in pieces:
    sheet.paste(im, (x, 0))
    print(f'    {n}: [ritual-props.png, {x}, 0, {im.width}, {im.height}]')
    x += im.width + 4
sheet.save(out + 'ritual-props.png')
