import sys, numpy as np
from scipy import ndimage as nd
rows = [r for r in open(sys.argv[1]).read().split('\n') if r]
g = np.array([list(r) for r in rows])
f = g != '#'
for _ in range(2):
    n = nd.convolve(f.astype(int), np.ones((3, 3), int), mode='constant')
    f = np.where(n >= 6, True, np.where(n <= 3, False, f))
lab, k = nd.label(f); s = nd.sum(f, lab, range(1, k + 1))
for i, v in enumerate(s):
    if v < 12: f[lab == i + 1] = False
lab, k = nd.label(~f); s = nd.sum(~f, lab, range(1, k + 1))
for i, v in enumerate(s):
    if v < 3: f[lab == i + 1] = True
f[0, :] = f[-1, :] = f[:, 0] = f[:, -1] = False
# lava keeps its own letter where the trace had it, else what its neighbours mostly are
lv = g == '$'
H, W = f.shape
print('    ' + ''.join(str(x // 10) for x in range(W)))
print('    ' + ''.join(str(x % 10) for x in range(W)))
for y in range(H):
    print('%3d ' % y + ''.join('$' if (lv[y, x] and f[y, x]) else ('.' if f[y, x] else '#') for x in range(W)))
