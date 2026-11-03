# Contact sheet of props/*.png (or the names given) on grey, labelled: python3 sheet.py out.png [names...]
import sys, os, glob
from PIL import Image, ImageDraw
here = os.path.dirname(os.path.abspath(__file__))
out, names = sys.argv[1], sys.argv[2:]
files = [f'{here}/props/{n}.png' for n in names] if names else sorted(glob.glob(here + '/props/*.png'))
ims = [(os.path.basename(f)[:-4], Image.open(f).convert('RGBA')) for f in files if os.path.exists(f)]
cols = 6; W = max(i.width for _, i in ims) + 8; H = max(i.height for _, i in ims) + 20
sheet = Image.new('RGBA', (cols * W, ((len(ims) + cols - 1) // cols) * H), (110, 130, 90, 255))
d = ImageDraw.Draw(sheet)
for k, (n, im) in enumerate(ims):
    x, y = (k % cols) * W, (k // cols) * H
    sheet.alpha_composite(im, (x + 4, y + 16)); d.text((x + 4, y + 2), n, fill=(255, 255, 255, 255))
sheet.save(out)
