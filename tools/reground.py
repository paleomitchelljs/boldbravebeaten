# Lays a sheet's ground anew: every pixel that is the old plain ground tile's pixel at its place (x mod cell, y mod
# cell) becomes the new tile's pixel there. For a wall or corner set drawn over one ground and wanted over another
# (the older cliffs over the restyled grass and gravel). Shadows and fringes drawn on the old ground keep its tint.
#   python3 tools/reground.py sheet.png old-ground.png new-ground.png out.png [--near 0]
import sys
from PIL import Image
def reground(sheet, old, new, out, near=0, cell=64):
    im = Image.open(sheet).convert('RGBA'); px = im.load()
    o, n = Image.open(old).convert('RGBA').load(), Image.open(new).convert('RGBA').load()
    hit = 0
    for y in range(im.height):
        for x in range(im.width):
            c, g = px[x, y], o[x % cell, y % cell]
            if c[3] == 255 and all(abs(a - b) <= near for a, b in zip(c[:3], g[:3])): px[x, y] = n[x % cell, y % cell]; hit += 1
    im.save(out, optimize=True)
    print(f'{out}: {hit * 100 // (im.width * im.height)}% laid anew')
if __name__ == '__main__':
    a = sys.argv[1:]; near = 0
    if '--near' in a: k = a.index('--near'); near = int(a[k + 1]); del a[k:k + 2]
    reground(*a, near=near)
