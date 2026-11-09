# Trace the kobold dens (page 33 of Solusek's Eye at 300 dpi) onto tiles, two to the map's 20-ft square.
# The tunnel mouths at the map's edge (A, B, D, the two roads out, K-1) are sealed with drawn lines; then every
# region is rock unless it is large, bright and carries the map's grid (the caves are one region once sealed). The lava band along the north is left as rock: hall.py-style hand edits paint it.
# python trace.py page.png [debug.png] > trace.txt
import sys, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
X0, Y0, X1, Y1 = 240, 360, 2330, 3040; T = 29
SEALS = [((300, 680), (560, 680)), ((1070, 525), (1145, 525)), ((1945, 470), (2015, 470)),
         ((2160, 1350), (2160, 1750)), ((1550, 2830), (1850, 2830)),
         ((455, 2315), (412, 2400)), ((498, 2335), (522, 2400))]
page = Image.open(sys.argv[1]).convert('L')
d = ImageDraw.Draw(page)
for a, b in SEALS: d.line([a, b], fill=0, width=8)
im = np.asarray(page).astype(float)[Y0:Y1, X0:X1]
raw = im < 90
line = nd.binary_dilation(raw, iterations=4)
line[:2, :] = line[-2:, :] = line[:, :2] = line[:, -2:] = True
lab, n = nd.label(~line); idx = list(range(1, n + 1))
border = set(np.unique(np.concatenate([lab[3, :], lab[-4, :], lab[:, 3], lab[:, -4]]))) - {0}
size = nd.sum(np.ones_like(im), lab, idx); br = nd.mean(im, lab, idx)
hp = (np.abs(im - nd.gaussian_filter(im, 1.5)) > 4).astype(float); tx = nd.mean(hp, lab, idx)
cls = np.zeros(n + 1, np.uint8)
for i in idx:
    cls[i] = 1 if (i not in border and br[i - 1] >= 225 and tx[i - 1] > 0.12 and size[i - 1] > 20000) else 2
c = cls[lab]
# inside the caves, a pixel is floor only where the grid shows nearby (islands leak in through labels' gaps)
grid = nd.uniform_filter(hp, 61)
thr = float(sys.argv[3]) if len(sys.argv) > 3 else 0.08
c[(c == 1) & (grid < thr)] = 2
_, (iy, ix) = nd.distance_transform_edt(lab == 0, return_indices=True)
c = np.where(lab == 0, c[iy, ix], c)
if len(sys.argv) > 2:
    rgb = np.zeros(c.shape + (3,), np.uint8); rgb[c == 1] = (230, 220, 180); rgb[c == 2] = (60, 50, 50)
    rgb[c == 3] = (220, 90, 20); rgb[raw] = (200, 0, 0)
    Image.fromarray(rgb).resize((c.shape[1] // 3, c.shape[0] // 3)).save(sys.argv[2])
H, W = c.shape[0] // T, c.shape[1] // T
for j in range(H):
    r = ''
    for i in range(W):
        s = c[j*T:(j+1)*T, i*T:(i+1)*T]
        r += '$' if (s == 3).mean() > 0.4 else ('.' if (s == 1).mean() > 0.4 else '#')
    print(r)
