# Trace the goblin map onto tiles. Regions between outlines (sealed at the east edge) are classed floor/rock by
# texture, with the lava regions named by id; small outlined blobs are lava pools. Outlines go to the nearest region,
# except where they face rock, so tunnels keep their width and lava banks stay open.
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
X0, Y0, X1, Y1 = [int(v) for v in sys.argv[3].split(",")]; T = int(sys.argv[2])
LAVA = set(int(v) for v in sys.argv[4].split(",") if v)
im = np.asarray(Image.open(sys.argv[1]).convert('L')).astype(float)[Y0:Y1, X0:X1]
raw = im < 100
line = nd.binary_dilation(raw, iterations=9)
line[:2, :] = line[-2:, :] = line[:, :2] = line[:, -2:] = True
line[:, 1866:1874] = True
lab, n = nd.label(~line); idx = range(1, n + 1)
hp = (np.abs(im - nd.gaussian_filter(im, 3)) > 5).astype(float)
size = nd.sum(np.ones_like(im), lab, idx); tx = nd.mean(hp, lab, idx)
cls = np.zeros(n + 1, np.uint8)
for i in range(n):
    k = i + 1
    cls[k] = 3 if k in LAVA else (1 if size[i] >= 300 and tx[i] > 0.17 else 2)
for sd in (sys.argv[5].split(';') if len(sys.argv) > 5 else []):
    sx, sy = [float(v) for v in sd.split(',')]
    py, px = int(sy * T + T / 2), int(sx * T + T / 2)
    k = lab[py, px]
    print('seed', sd, 'region', k, int(size[k - 1]) if k else 0, file=sys.stderr)
    if k: cls[k] = 1
    if k and size[k - 1] > 500000: merged = k
c = cls[lab]
if 'merged' in dir():
    near = nd.binary_dilation(im < 100, iterations=4)
    hp2 = ((np.abs(im - nd.gaussian_filter(im, 3)) > 5) & ~near).astype(float)
    loc = nd.uniform_filter(hp2, 81) / np.maximum(nd.uniform_filter((~near).astype(float), 81), 0.05)
    c[(lab == merged) & (loc < float(sys.argv[7]))] = 2
_, (iy, ix) = nd.distance_transform_edt(lab == 0, return_indices=True)
fill = c[iy, ix]
core = nd.binary_erosion(lab == 0, iterations=9)
nearrock = nd.binary_dilation(c == 2, iterations=30)
c = np.where(lab == 0, np.where(core & nearrock, 2, fill), c)
# small outlined blobs (pools): fill them as lava
bl, bn = nd.label(raw)
bs = nd.sum(raw, bl, range(1, bn + 1))
for i, v in enumerate(bs):
    if v < 6000:
        m = nd.binary_fill_holes(bl == i + 1)
        if m.sum() > 1.6 * v: c[m & (c == 1)] = 3
c[:, 1834:] = 2
H, W = c.shape[0] // T, c.shape[1] // T
for j in range(H):
    r = ''
    for i in range(W):
        s = c[j*T:(j+1)*T, i*T:(i+1)*T]
        r += '$' if (s == 3).mean() > 0.35 else ('.' if (s == 1).mean() > 0.4 else '#')
    print(r)
