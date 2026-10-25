# Builds the palace's art in art/worldtiles/temple/ from the PixelLab sheets and pieces here:
#   palace-wall.png   the wall cliff set (the court wall's 25-tile layout); copied as it is.
#   palace-dais.png   the raised dais over the floor (a 16-tile corner set, the default layout); copied as it is.
#   palace-props.png  the pieces in a row, cropped to their pixels; prints their rects for data/tilesets.yaml.
#   python3 assets/wip/temple-palace/build.py "$PWD"
import sys
from PIL import Image

root = sys.argv[1]
here = root + '/assets/wip/temple-palace/'
out = root + '/art/worldtiles/temple/'

for n in ('palace-wall', 'palace-dais'):
    Image.open(here + n + '.png').convert('RGBA').save(out + n + '.png')

PIECES = ['p-throne', 'p-statue', 'p-brazier', 'p-column', 'p-stairup', 'p-stairdown', 'p-bed', 'p-cot', 'p-table',
          'p-barrels', 'f-mask', 'f-banner']
ims = [Image.open(here + n + '.png').convert('RGBA') for n in PIECES]
ims = [im.crop(im.getbbox()) for im in ims]
sheet = Image.new('RGBA', (sum(im.width + 4 for im in ims), max(im.height for im in ims)), (0, 0, 0, 0))
x = 0
for n, im in zip(PIECES, ims):
    sheet.paste(im, (x, 0))
    print(f'    {n}: [palace-props.png, {x}, 0, {im.width}, {im.height}]')
    x += im.width + 4
sheet.save(out + 'palace-props.png')
