#!/usr/bin/env node
// Builds the outdoor places of an open world from a world raster and a layout (assets/world/*-layout.yaml):
// one place per land slot of a grid laid over the raster, every walkable square that meets one across a shared edge a
// way across, the layout's sites stamped on, roads between them, and the places written to data/outdoors.yaml.
// It also writes a gap report (what the art still lacks) beside the layout.
//   node tools/worldgen.js assets/world/w1-layout.yaml [--preview out.ppm] [--json out.json] [--out data/outdoors.yaml]
// The world named by the layout is content: this tool names none.
//
// Every place draws from one tileset, so land runs on across a place's edge as it lies: each square's ground is its
// region's (the layout's `regions`: grassland, jungle, desert, by the raster's biome, the jungle's edge dappled into the
// grassland's over a few squares), not its place's. Forest and jungle are canopy in whole masses (no lone stands) with
// open woods of single trees round them; grassland is grass, dry grass and a few trees.
'use strict';
const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const layoutPath = path.resolve(argv[0] || 'assets/world/w1-layout.yaml');
const outPath = path.resolve(opt('--out') || path.join(repo, 'data/outdoors.yaml'));
process.chdir(repo + '/tests');
require(repo + '/tests/load.js');
const G = globalThis.BBB; G.UI = G.UI || {}; require(repo + '/src/ui/game/tilemap.js');
process.chdir(repo);
const Tm = G.UI.Tilemap;
const L = G.Yaml.parse(fs.readFileSync(layoutPath, 'utf8'));
const GROUND = G.CONFIG.game.ground;
const RG = L.regions;                          // region -> {chars, look, scatter}

// ---- Randomness and noise (seeded, so a layout always builds the same world) -----------------------------------
const SEED = L.seed || 1;
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s + SEED) * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const fbm = (x, y, s, oct = 3) => { let t = 0, amp = 1, f = 1, norm = 0; for (let o = 0; o < oct; o++) { t += vnoise(x * f, y * f, s + o * 17) * amp; norm += amp; amp *= 0.5; f *= 2; } return t / norm; };

// ---- The raster --------------------------------------------------------------------------------------------------
const csv = fs.readFileSync(path.resolve(repo, L.cells), 'utf8').trim().split('\n');
const hdr = csv[0].split(',');
const cells = new Map();
for (const line of csv.slice(1)) {
  const v = line.split(','), o = {};
  hdr.forEach((h, i) => { o[h] = v[i] === undefined ? '' : v[i].replace(/"/g, ''); });
  for (const k of ['row', 'col', 'land', 'strahler', 'flow_to', 'lake', 'swamp']) o[k] = +o[k] || 0;
  for (const k of ['lon', 'lat', 'elev', 'relief', 'q', 'arid', 'temp']) o[k] = +o[k] || 0;
  if (o.flow_to === 0 && v[hdr.indexOf('flow_to')] === '-1') o.flow_to = -1;
  cells.set(o.row * 720 + o.col, o);
}
const cellIdx = (lon, lat) => Math.floor((90 - lat) / 0.5) * 720 + Math.floor((lon + 180) / 0.5);
// The continent: land joined to the layout's seed cell.
const continent = new Set();
{
  const s = cellIdx(L.continent[0], L.continent[1]); const q = [s]; continent.add(s);
  while (q.length) { const k = q.pop(); const c = cells.get(k); for (const d of [720, -720, 1, -1]) { const n = k + d, nc = cells.get(n); if (nc && nc.land && !continent.has(n) && Math.abs(nc.col - c.col) <= 1) { continent.add(n); q.push(n); } } }
}
// Each cell's share of jungle, desert and forest over itself and its eight neighbours (land only): smooth fields, so a
// region's edge wanders over a band of squares rather than following the raster's half-degree steps.
for (const k of continent) {
  const c = cells.get(k); let n = 0, j = 0, d = 0, f = 0;
  for (const dk of [0, 1, -1, 720, -720, 721, 719, -721, -719]) { const o = continent.has(k + dk) ? cells.get(k + dk) : null; if (!o) continue; n++; j += o.biome === 'J'; d += o.biome === 'D'; f += o.biome === 'F'; }
  c.jS = j / n; c.dS = d / n; c.fS = f / n;
}
// Where swamp may lie (`terrain.swamp`): low, flat land that is wet (rain beyond what the sun takes up) or on a big
// river. (The cells' own swamp flag is set on their lakes, and read as swamp it ringed every lake with marsh, the
// highland's too.)
const TER = L.terrain || {}, UP = TER.upland || {}, SCARP = TER.scarp || {}, SWP = TER.swamp || {}, ARID = TER.arid || {}, STREAM = TER.streams || {};
for (const k of continent) {
  const c = cells.get(k);
  let big = 0; for (const dk of [0, 1, -1, 720, -720, 721, 719, -721, -719]) { const o = continent.has(k + dk) ? cells.get(k + dk) : null; if (o) big = Math.max(big, o.strahler); }
  c.wetS = c.elev < (SWP.below ?? 0.2) && c.relief < (SWP.relief ?? 0.3) && (c.arid > (SWP.wet ?? 1) || big >= (SWP.river ?? 3)) ? 1 : 0;
}
const landAt = (lon, lat) => { const k = cellIdx(lon, lat); return continent.has(k) ? cells.get(k) : null; };
// A value interpolated between cell centres (smooth fields for relief and the regions).
function field(lon, lat, key) {
  const x = (lon + 180) / 0.5 - 0.5, y = (90 - lat) / 0.5 - 0.5, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const v = (r, c) => { const k = r * 720 + c; return continent.has(k) ? cells.get(k)[key] : 0; };
  return v(iy, ix) * (1 - fx) * (1 - fy) + v(iy, ix + 1) * fx * (1 - fy) + v(iy + 1, ix) * (1 - fx) * fy + v(iy + 1, ix + 1) * fx * fy;
}
// The same over land cells only (a climate, which the sea beyond the coast must not dilute).
function landField(lon, lat, key) {
  const x = (lon + 180) / 0.5 - 0.5, y = (90 - lat) / 0.5 - 0.5, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  let sw = 0, sv = 0;
  for (const [r, c, w] of [[iy, ix, (1 - fx) * (1 - fy)], [iy, ix + 1, fx * (1 - fy)], [iy + 1, ix, (1 - fx) * fy], [iy + 1, ix + 1, fx * fy]]) {
    const k = r * 720 + c; if (!continent.has(k) || w <= 0) continue; sw += w; sv += w * cells.get(k)[key];
  }
  return sw ? sv / sw : 0;
}

// ---- The grid ------------------------------------------------------------------------------------------------------
const { lon0, lat0, step, cols, rows, size: N } = L.grid;
const spd = N / step;                         // squares a degree
const GW = cols * N, GH = rows * N;
const toG = (lon, lat) => [Math.floor((lon - lon0) * spd), Math.floor((lat0 - lat) * spd)];
const lonOf = (gx) => lon0 + (gx + 0.5) / spd, latOf = (gy) => lat0 - (gy + 0.5) / spd;
const slotOf = (gx, gy) => [Math.floor(gy / N), Math.floor(gx / N)];
const slotKey = (r, c) => r + ',' + c;
const land = {};
for (const k of continent) { const c = cells.get(k); const [gx, gy] = toG(c.lon, c.lat); const [r, cc] = slotOf(gx, gy); if (r < 0 || cc < 0 || r >= rows || cc >= cols) continue; const s = (land[slotKey(r, cc)] = land[slotKey(r, cc)] || { n: 0, b: {} }); s.n++; s.b[c.biome] = (s.b[c.biome] || 0) + 1; }
const sites = (L.sites || []).map((s) => Object.assign({}, s, { g: toG(s.at[0], s.at[1]) }));
for (const s of sites) s.slot = slotOf(s.g[0], s.g[1]);
const included = new Set(Object.keys(land).filter((k) => land[k].n >= (L.minLand || 1)));
for (const s of sites) included.add(slotKey(...s.slot));
const zones = {};
for (const k of included) {
  const [r, c] = k.split(',').map(Number);
  const b = (land[k] || { b: { G: 1 } }).b, dom = Object.entries(b).sort((x, y) => y[1] - x[1])[0][0];
  const over = (L.slots || {})[k] || {};
  zones[k] = { r, c, key: k, id: `${L.prefix}${r}_${c}`, over, dom, biomes: b, land: (land[k] || {}).n || 0 };
}
const zoneAt = (gx, gy) => (gx < 0 || gy < 0 || gx >= GW || gy >= GH) ? null : zones[slotKey(...slotOf(gx, gy))] || null;

// ---- Terrain classes and regions over the whole world -----------------------------------------------------------------
// One class a square first (ocean, lake, river, swamp, ground, dry, woods, forest, hill, mountain, ledge, summit, sand,
// road, bridge, ford) and its region (G grassland and temperate forest, J jungle, D desert); letters come after.
const CLS = new Array(GW * GH).fill('ocean');
const REG = new Array(GW * GH).fill('G');
const RIM = new Uint8Array(GW * GH);          // a caldera's rim (its rock is the rim's, not the mountains')
const FIX = new Uint8Array(GW * GH);          // stamped: later passes leave it
const CH = new Array(GW * GH).fill(null);     // letters, once decided
const I = (x, y) => y * GW + x;
const WARP = 0.35, WF = 0.8;                  // degrees of warp, and its wavelength in degrees
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
  const z = zoneAt(gx, gy); if (!z) continue;
  const lon = lonOf(gx), lat = latOf(gy);
  const wl = lon + (fbm(lon / WF, lat / WF, 1) - 0.5) * 2 * WARP, wt = lat + (fbm(lon / WF, lat / WF, 2) - 0.5) * 2 * WARP;
  // Land or sea under a finer warp of its own: the raster's coast runs along half-degree cell edges, and the broad warp
  // alone leaves long straight shores (one on a place's edge reads as a wall of sea).
  const c = landAt(wl + (fbm(lon / 0.35, lat / 0.35, 3, 2) - 0.5) * 1.2, wt + (fbm(lon / 0.35, lat / 0.35, 4, 2) - 0.5) * 1.2);
  if (!c) continue;
  // The region: the smoothed shares with a noise of a few squares, so the jungle's edge comes in tongues and islands.
  const jn = field(wl, wt, 'jS') + (fbm(lon * 2.2, lat * 2.2, 51) - 0.5) * 0.55, dn = field(wl, wt, 'dS') + (fbm(lon * 2.2, lat * 2.2, 52) - 0.5) * 0.35;
  // Height (km) with a little noise, so the upland's edge wanders; how steeply the land rises (km a square, from the
  // cells' heights alone).
  const el = field(wl, wt, 'elev') + (fbm(lon * 3, lat * 3, 13) - 0.5) * (UP.noise ?? 0.1), h = 0.5 / spd;
  const grad = Math.hypot(field(wl + h, wt, 'elev') - field(wl - h, wt, 'elev'), field(wl, wt + h, 'elev') - field(wl, wt - h, 'elev'));
  let reg = z.over.region || (dn > 0.5 ? 'D' : jn > 0.5 ? 'J' : 'G');
  // Above the upland's height the land is highland (H): its own grass, pines and lakes with stony shores.
  if (!z.over.region && reg !== 'D' && RG.H && el > (UP.elev ?? 0.75)) reg = 'H';
  REG[I(gx, gy)] = reg;
  // Lakes by the cells' lake share interpolated, with a fine noise: a lake of one cell is a rounded pond, not a block.
  if (field(wl, wt, 'lake') + (fbm(lon * 6, lat * 6, 61) - 0.5) * 0.4 > 0.42) { CLS[I(gx, gy)] = 'lake'; continue; }
  const rel = field(lon, lat, 'relief') + (fbm(lon * 3, lat * 3, 5) - 0.5) * 0.45;
  // The upland's rim (an escarpment): within a band of its height, rock where the land rises steeply, hillside where
  // it rises less; where it rises gently there is no rim, and that is the way up.
  const rim = Math.abs(el - (UP.elev ?? 0.75)) < Math.max(SCARP.band ?? 0.07, grad * (SCARP.wide ?? 1.8));
  const swampy = c.wetS && field(wl, wt, 'wetS') > 0.5 && fbm(lon * 4, lat * 4, 7) > (SWP.noise ?? 0.45);
  const arid = landField(wl, wt, 'arid') + (fbm(lon * 2, lat * 2, 14) - 0.5) * 0.25;
  let k;
  if (rel > 1.32) k = 'summit'; else if (rel > 1.2) k = 'ledge'; else if (rel > 1.06) k = 'mountain';
  else if (rim && grad > (SCARP.rock ?? 0.07)) k = 'mountain';
  else if (swampy) k = 'swamp';
  else if ((rel > 0.86 && fbm(lon * 3, lat * 3, 8) > 0.45) || (rim && grad > (SCARP.hill ?? 0.035))) k = 'hill';
  else {
    // Trees: a noise over a few squares; canopy where it is high, open woods round it, open ground below. Temperate
    // forest only where the raster has forest (on the highland, its forest or its jungle); the grassland keeps a few
    // copses. Dry grass by how dry the land is (`terrain.arid`): all of it below the first figure, in patches that
    // shrink as the land wets, none above the second; no trees where it is drier than `trees`.
    const n = fbm(lon * 2.5, lat * 2.5, 9), tS = field(wl, wt, 'fS') + (reg === 'H' ? field(wl, wt, 'jS') : 0);
    const [a0, a1] = ARID.dry || [0.25, 0.65], dryness = Math.min(1, Math.max(0, (a1 - arid) / (a1 - a0)));
    const patch = Math.min(1, Math.max(0, (fbm(lon * 1.5, lat * 1.5, 12) - 0.28) / 0.44)), treesOk = arid > (ARID.trees ?? 0.6);
    if (reg === 'J') k = n > 0.54 ? 'forest' : n > 0.43 ? 'woods' : 'ground';
    else if (reg === 'D') k = 'ground';
    else if (patch < dryness) k = 'dry';
    else if (tS > 0.4 && treesOk) k = n > 0.56 ? 'forest' : n > 0.44 ? 'woods' : 'ground';
    else k = treesOk && fbm(lon * 3, lat * 3, 11) > 0.74 ? 'woods' : 'ground';
  }
  if (z.over.dry && ['ground', 'woods', 'forest'].includes(k)) k = 'dry';
  CLS[I(gx, gy)] = k;
}
// Mountains climb a ring a square: a ledge stands wholly on mountain, a summit wholly on ledge.
const rankOf = { mountain: 1, ledge: 2, summit: 3 };
for (let pass = 0; pass < 3; pass++) for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
  const k = CLS[I(gx, gy)], r = rankOf[k]; if (!r || r === 1) continue;
  let ok = true;
  for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if ((rankOf[CLS[I(gx + dx, gy + dy)]] || 0) < r - 1) { ok = false; break; }
  if (!ok) CLS[I(gx, gy)] = r === 3 ? 'ledge' : 'mountain';
}
// Regions smoothed: a square takes the region of six or more of its eight neighbours (no one-square specks of grass in
// the jungle).
for (let pass = 0; pass < 2; pass++) {
  const next = REG.slice();
  for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
    const n = {};
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) { const r = REG[I(gx + dx, gy + dy)]; n[r] = (n[r] || 0) + 1; }
    const [best, cnt] = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
    const z = zoneAt(gx, gy); if (z && cnt >= 6 && best !== REG[I(gx, gy)] && !z.over.region) next[I(gx, gy)] = best;
  }
  for (let i = 0; i < REG.length; i++) REG[i] = next[i];
}
// Mountains of a few squares are hills (a lone crag of grey rock in the grass reads as a mistake).
{
  const seen = new Uint8Array(GW * GH);
  for (let s = 0; s < GW * GH; s++) {
    if (!rankOf[CLS[s]] || seen[s]) continue;
    const comp = [s], q = [s]; seen[s] = 1;
    while (q.length) { const i = q.pop(), x = i % GW; for (const d of [1, -1, GW, -GW]) { const j = i + d; if (j < 0 || j >= GW * GH || seen[j] || !rankOf[CLS[j]] || Math.abs((j % GW) - x) > 1) continue; seen[j] = 1; comp.push(j); q.push(j); } }
    if (comp.length < 24) for (const i of comp) CLS[i] = 'hill';
  }
}
// A summit of fewer than four squares is crag (a lone square of snow reads as a block of ice).
{
  const seen = new Uint8Array(GW * GH);
  for (let s = 0; s < GW * GH; s++) {
    if (CLS[s] !== 'summit' || seen[s]) continue;
    const comp = [s], q = [s]; seen[s] = 1;
    while (q.length) { const i = q.pop(), x = i % GW; for (const d of [1, -1, GW, -GW]) { const j = i + d; if (j < 0 || j >= GW * GH || seen[j] || CLS[j] !== 'summit' || Math.abs((j % GW) - x) > 1) continue; seen[j] = 1; comp.push(j); q.push(j); } }
    if (comp.length < 4) for (const i of comp) CLS[i] = 'ledge';
  }
}
// Soft land (ground, dry grass, woods, hills, swamp) smoothed: a square takes the class most of its eight neighbours
// have when five or more share it, so patches have round edges and no one-square specks.
const SOFT = new Set(['ground', 'dry', 'woods', 'hill', 'swamp']);
for (let pass = 0; pass < 2; pass++) {
  const next = CLS.slice();
  for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
    const i = I(gx, gy); if (!SOFT.has(CLS[i])) continue;
    const n = {};
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) { const k = CLS[I(gx + dx, gy + dy)]; if (SOFT.has(k)) n[k] = (n[k] || 0) + 1; }
    const [best, cnt] = Object.entries(n).sort((a, b) => b[1] - a[1])[0] || [];
    if (best && cnt >= 5 && best !== CLS[i]) next[i] = best;
    else if ((n[CLS[i]] || 0) <= 1 && CLS[i] !== 'ground') next[i] = best || 'ground';
  }
  for (let i = 0; i < CLS.length; i++) CLS[i] = next[i];
}
// Rivers: each reach of Strahler order `terrain.streams.strahler` and up (the first order a stream a square wide), and
// each lake's outlet, from its cell's centre to the next downstream, wider as it grows.
for (const k of continent) {
  const c = cells.get(k); if ((c.strahler < (STREAM.strahler ?? 2) && !c.lake) || c.flow_to < 0) continue;
  const d = cells.get(c.flow_to); if (!d || (c.lake && d.lake)) continue;
  const [x0, y0] = [(c.lon - lon0) * spd, (lat0 - c.lat) * spd], [x1, y1] = [(d.lon - lon0) * spd, (lat0 - d.lat) * spd];
  const so = Math.max(c.strahler, c.lake ? d.strahler : 0, 1), w = so >= 4 ? 1.6 : so >= 3 ? 1.1 : so >= 2 ? 0.55 : (STREAM.width ?? 0.35);
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3) + 1;
  // A gentle meander: the reach bows to one side by noise.
  const bow = (vnoise(x0 / 7, y0 / 7, 21) - 0.5) * 3, nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, b = Math.sin(Math.PI * t) * bow;
    const x = x0 + (x1 - x0) * t + nx / nl * b, y = y0 + (y1 - y0) * t + ny / nl * b;
    for (let gy = Math.floor(y - w); gy <= Math.ceil(y + w); gy++) for (let gx = Math.floor(x - w); gx <= Math.ceil(x + w); gx++) {
      if (!zoneAt(gx, gy) || Math.hypot(gx + 0.5 - x, gy + 0.5 - y) > w + 0.15) continue;
      const cl = CLS[I(gx, gy)]; if (cl === 'ocean' || cl === 'lake' || (cl === 'river' && so < 2)) continue;
      CLS[I(gx, gy)] = so < 2 ? 'stream' : 'river';   // a first-order stream: shallow water, waded
    }
  }
}
// Calderas: a ring of peaks round a crater (forest and a lake in it); the ring is the rim's own rock.
for (const s of sites) if (s.ring) {
  const [cx, cy] = s.g, { inner, rim, outer } = s.ring;
  for (let gy = cy - outer - 1; gy <= cy + outer + 1; gy++) for (let gx = cx - outer - 1; gx <= cx + outer + 1; gx++) {
    if (!zoneAt(gx, gy)) continue;
    const d = Math.hypot(gx - cx, gy - cy) + (vnoise(gx / 3, gy / 3, 31) - 0.5) * 1.2;
    let k = null;
    if (d < inner - 1.5) k = 'lake';
    else if (d < inner) k = 'woods';
    else if (d <= outer) { const h = 3 * (1 - Math.abs(d - rim) / (d < rim ? rim - inner : outer - rim)); k = h >= (s.ring.crest || 1.6) ? 'mountain' : 'ground'; if (k === 'mountain') RIM[I(gx, gy)] = 1; }
    if (k) CLS[I(gx, gy)] = k;
  }
}
// Canopy in whole masses: on the 2x2 blocks the cliff tiles need, a block is canopy when most of it is; blocks with
// fewer than two canopy blocks beside them go, masses under eight blocks go, and so does canopy within a square of water,
// a hill or a mountain (trunks don't stand in a lake). What goes becomes open woods.
{
  const BW = GW / 2, BH = GH / 2, B = new Uint8Array(BW * BH);
  for (let by = 0; by < BH; by++) for (let bx = 0; bx < BW; bx++) {
    let n = 0; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) n += CLS[I(bx * 2 + dx, by * 2 + dy)] === 'forest';
    B[by * BW + bx] = n >= 2 ? 1 : 0;
  }
  const near = (bx, by) => { for (let y = by * 2 - 1; y <= by * 2 + 2; y++) for (let x = bx * 2 - 1; x <= bx * 2 + 2; x++) { if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const k = CLS[I(x, y)]; if (['ocean', 'lake', 'river', 'stream', 'swamp', 'hill', 'mountain', 'ledge', 'summit'].includes(k) || !zoneAt(x, y)) return true; } return false; };
  for (let pass = 0; pass < 2; pass++) for (let by = 1; by < BH - 1; by++) for (let bx = 1; bx < BW - 1; bx++) {
    const i = by * BW + bx, n = B[i - 1] + B[i + 1] + B[i - BW] + B[i + BW];
    if (B[i] && (n < 2 || near(bx, by))) B[i] = 0; else if (!B[i] && n >= 3 && !near(bx, by)) B[i] = 1;
  }
  // Notches: a third of the blocks on a mass's edge go (by position), so its outline is ragged, not a run of straight
  // walls; a block left with fewer than two beside it goes too.
  { const edge = [];
    for (let by = 1; by < BH - 1; by++) for (let bx = 1; bx < BW - 1; bx++) { const i = by * BW + bx; if (B[i] && (!B[i - 1] || !B[i + 1] || !B[i - BW] || !B[i + BW]) && hash(bx, by, 71) < 0.33) edge.push(i); }
    for (const i of edge) B[i] = 0;
    for (let by = 1; by < BH - 1; by++) for (let bx = 1; bx < BW - 1; bx++) { const i = by * BW + bx; if (B[i] && B[i - 1] + B[i + 1] + B[i - BW] + B[i + BW] < 2) B[i] = 0; } }
  const seen = new Uint8Array(BW * BH);
  for (let s = 0; s < BW * BH; s++) {
    if (!B[s] || seen[s]) continue;
    const comp = [s], q = [s]; seen[s] = 1;
    while (q.length) { const i = q.pop(); for (const d of [1, -1, BW, -BW]) { const j = i + d; if (j >= 0 && j < B.length && B[j] && !seen[j] && Math.abs((j % BW) - (i % BW)) <= 1) { seen[j] = 1; comp.push(j); q.push(j); } } }
    if (comp.length < 8) for (const i of comp) B[i] = 0;
  }
  for (let by = 0; by < BH; by++) for (let bx = 0; bx < BW; bx++) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const i = I(bx * 2 + dx, by * 2 + dy);
    if (B[by * BW + bx]) { if (SOFT.has(CLS[i]) || CLS[i] === 'forest') CLS[i] = 'forest'; }
    else if (CLS[i] === 'forest') CLS[i] = 'woods';
  }
}
// Coasts: sand along the sea, a square or two deep.
for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
  const i = I(gx, gy); if (!zoneAt(gx, gy) || !SOFT.has(CLS[i]) && CLS[i] !== 'forest') continue;
  const deep = fbm(gx / 4, gy / 4, 61) > 0.5 ? 2 : 1;
  let sea = false;
  for (let dy = -deep; dy <= deep && !sea; dy++) for (let dx = -deep; dx <= deep; dx++) { if (Math.abs(dx) + Math.abs(dy) > deep) continue; const x = gx + dx, y = gy + dy; if (zoneAt(x, y) && CLS[I(x, y)] === 'ocean') { sea = true; break; } }
  if (sea) CLS[i] = 'sand';
}

// ---- Canyons: passes and gorges carved into raised rock ------------------------------------------------------------------
// A site's `pass` (after Highpass Hold) or `gorge` (after the Gorge of King Xorbb) is a canyon: a floor along each of its
// `routes` (lines through the world's squares [gx, gy], smoothed; one whose last point is its first is a loop) and round
// its `rooms` (ragged widenings with marks in them, offsets from their centres) and `ponds`, walled by rock raised
// `walls` squares deep (by a noise) over the open land round it. Water stays (a river runs through the walls); a stream
// in the walls becomes rock, and a pocket of open land the walls shut in (under `pocket` squares) is filled. A pass's
// routes carry a road (a ford over a river), which narrows to the road alone at each of its `gates`; a gorge has no
// road. No road or way is cut through the walls later. Both set classes only (letters come after). The rock is then
// tiered by its distance from open ground, so the walls rise from slope to crag (`top`, the highest tier), and the rock
// between two ravines stands up as an island of crags.
const ROCKC = new Set(['mountain', 'ledge', 'summit']), TIER = ['mountain', 'ledge', 'summit'];
function rng(seed) { let st = seed >>> 0; return () => { st = (st + 0x6d2b79f5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const NEAR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], NEAR8 = [...NEAR4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const carvedBy = {};                           // site id -> {placed: [[gx, gy, ch, litter?]], mouths: [[gx, gy]]}
const SEAL = new Uint8Array(GW * GH);          // a canyon's walls: nothing later cuts through them
const FLOOR = new Uint8Array(GW * GH);         // a canyon's floor: another canyon's walls stop at it
// A disc of radius r (squares) round (cx, cy) (in squares, a square's centre at +0.5): its squares into `out`.
function disc(out, cx, cy, r) { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r + 0.05) out.add(I(x, y)); }
// A smooth line (Catmull-Rom) through squares' centres, a point every quarter square; closed if it ends where it began.
function smoothLine(pts) {
  const closed = pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  const P = (closed ? pts.slice(0, -1) : pts).map(([x, y]) => [x + 0.5, y + 0.5]), n = P.length, out = [];
  const at = (k) => (closed ? P[(k + n) % n] : P[Math.max(0, Math.min(n - 1, k))]);
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const p0 = at(k - 1), p1 = at(k), p2 = at(k + 1), p3 = at(k + 2), steps = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 4);
    for (let t = 0; t < steps; t++) {
      const u = t / steps, u2 = u * u, u3 = u2 * u, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(closed ? out[0] : P[n - 1]);
  return out;
}
function carveCanyon(s, m, isPass) {
  const rnd = rng(m.seed || 5), ph = rnd() * 1000, WET = new Set(['river', 'lake', 'ocean']);
  const routes = (m.routes || []).map((r, k) => ({ ...r, k, line: smoothLine(r.path) }));
  if (!routes.length) throw new Error(`${s.id}: a canyon needs routes`);
  const gates = (m.gates || []).map((g) => {
    // The route's point nearest the gate's square, and the way the route runs there.
    let best = null;
    for (const r of routes) r.line.forEach(([x, y], j) => { const d = Math.hypot(x - g.at[0] - 0.5, y - g.at[1] - 0.5); if (!best || d < best.d) best = { d, r, j }; });
    if (best.d > 1.5) throw new Error(`${s.id}: gate ${g.ch} at ${g.at} is not on a route`);
    const L = best.r.line, a = L[Math.max(0, best.j - 4)], b = L[Math.min(L.length - 1, best.j + 4)];
    return { ...g, along: Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? [1, 0] : [0, 1] };
  });
  const nearGate = (x, y) => gates.some((g) => Math.hypot(x - g.at[0] - 0.5, y - g.at[1] - 0.5) < 1.6);
  // The floor: along the routes (half-width by a noise along each), round the rooms (ragged), the ponds.
  const floor = new Set(), road = [];
  for (const r of routes) {
    const [w0, w1] = r.width || m.width || [1, 1.6];
    r.line.forEach(([x, y], j) => disc(floor, x, y, nearGate(x, y) ? 0.45 : w0 + (w1 - w0) * vnoise(ph + j / 10, r.k * 7, 906)));
    if (!isPass || r.road === false) continue;
    // Its road: the line's squares, a diagonal step gone round by the square beside it.
    for (const [x, y] of r.line) {
      const sq = I(Math.floor(x), Math.floor(y)), last = road[road.length - 1];
      if (last === sq) continue;
      if (last != null && last % GW !== sq % GW && Math.floor(last / GW) !== Math.floor(sq / GW)) road.push(I(sq % GW, Math.floor(last / GW)));
      road.push(sq);
    }
  }
  for (const h of m.rooms || []) { const [hx, hy] = [h.at[0] + 0.5, h.at[1] + 0.5], R = h.radius || 3;
    for (let y = Math.floor(hy - R - 2); y <= hy + R + 2; y++) for (let x = Math.floor(hx - R - 2); x <= hx + R + 2; x++) if (Math.hypot(x + 0.5 - hx, y + 0.5 - hy) < R + (vnoise(x / 2, y / 2, 907) - 0.5) * 1.5) floor.add(I(x, y)); }
  const pond = new Set();
  for (const p of m.ponds || []) { disc(pond, p.at[0] + 0.5, p.at[1] + 0.5, p.radius || 1.5); disc(floor, p.at[0] + 0.5, p.at[1] + 0.5, (p.radius || 1.5) + 1.2); }
  for (const i of floor) if (!zoneAt(i % GW, Math.floor(i / GW))) floor.delete(i);
  // The walls: open land within `walls` squares (eight ways) of the floor, the depth wandering by a noise; none within
  // `mouthOpen` squares of a mouth (the ends of the floor that open onto the land round it).
  const mouths = (m.mouths || [routes[0].path[0], routes[0].path[routes[0].path.length - 1]]).map(([x, y]) => [x, y]);
  const byMouth = (x, y) => mouths.some(([mx, my]) => Math.hypot(x - mx, y - my) < (m.mouthOpen ?? 5));
  const [d0, d1] = m.walls || [3, 6], depth = new Map(), q = [];
  for (const i of floor) { depth.set(i, 0); q.push(i); }
  const wall = new Set();
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % GW, y = Math.floor(i / GW), d = depth.get(i);
    for (const [dx, dy] of NEAR8) {
      const nx = x + dx, ny = y + dy, j = I(nx, ny); if (depth.has(j) || !zoneAt(nx, ny) || byMouth(nx, ny)) continue;
      const lim = d0 + (d1 - d0) * Math.min(1, Math.max(0, (fbm(nx / 5, ny / 5, 908) - 0.28) / 0.44));
      if (d + 1 > lim) continue;
      depth.set(j, d + 1); q.push(j); if (!FLOOR[j] && !WET.has(CLS[j])) wall.add(j);
    }
  }
  const top = m.top || 'summit';
  for (const i of wall) { CLS[i] = top; RIM[i] = 0; SEAL[i] = 1; }
  for (const i of floor) { FLOOR[i] = 1; SEAL[i] = 0; if (!WET.has(CLS[i]) && CLS[i] !== 'stream') { CLS[i] = m.floor || 'ground'; RIM[i] = 0; } }
  for (const i of pond) CLS[i] = 'lake';
  // Pockets of open land the walls shut in (not reaching the box round the canyon's edge): filled.
  let bx0 = GW, by0 = GH, bx1 = 0, by1 = 0;
  for (const i of wall) { const x = i % GW, y = Math.floor(i / GW); bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
  bx0 -= 6; by0 -= 6; bx1 += 6; by1 += 6;
  const open = (i) => !ROCKC.has(CLS[i]) && !WET.has(CLS[i]), seen = new Set();
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const i0 = I(x, y); if (seen.has(i0) || !zoneAt(x, y) || !open(i0) || FLOOR[i0]) continue;
    const comp = [i0], cq = [i0]; seen.add(i0); let free = false;
    while (cq.length) { const i = cq.pop(), cx = i % GW, cy = Math.floor(i / GW);
      if (cx <= bx0 || cy <= by0 || cx >= bx1 || cy >= by1) free = true;
      for (const [dx, dy] of NEAR4) { const j = I(cx + dx, cy + dy); if (seen.has(j) || !zoneAt(cx + dx, cy + dy) || !open(j)) continue; if (FLOOR[j]) { free = true; continue; } seen.add(j); comp.push(j); cq.push(j); } }
    if (!free && comp.length < (m.pocket ?? 120)) for (const i of comp) { CLS[i] = top; SEAL[i] = 1; }
  }
  // The road (a ford where it crosses a river or a stream); at each gate the road alone for a square either side of it,
  // rock to its left and right.
  for (const i of road) CLS[i] = ['river', 'stream'].includes(CLS[i]) ? 'ford' : WET.has(CLS[i]) ? 'bridge' : 'road';
  const placed = [], bad = [], mark = (x, y, ch) => {
    const i = I(x, y), ex = x % N, ey = y % N;
    if (ROCKC.has(CLS[i]) || WET.has(CLS[i]) || ['road', 'ford', 'bridge'].includes(CLS[i]) || ex === 0 || ey === 0 || ex === N - 1 || ey === N - 1) bad.push(`${ch} at ${x},${y} (${CLS[i]}${ex === 0 || ey === 0 || ex === N - 1 || ey === N - 1 ? ', a place\'s edge' : ''})`);
    placed.push([x, y, ch]);
  };
  for (const g of gates) {
    const [gx, gy] = g.at, side = [g.along[1], g.along[0]];
    for (let t = -1; t <= 1; t++) { const x = gx + g.along[0] * t, y = gy + g.along[1] * t; CLS[I(x, y)] = 'road'; for (const sg of [-1, 1]) { const j = I(x + side[0] * sg, y + side[1] * sg); CLS[j] = 'mountain'; SEAL[j] = 1; FLOOR[j] = 0; } }
    placed.push([gx, gy, g.ch]);
  }
  for (const h of m.rooms || []) for (const [ch, off] of Object.entries(h.marks || {})) for (const [dx, dy] of Array.isArray(off[0]) ? off : [off]) mark(h.at[0] + dx, h.at[1] + dy, ch);
  for (const [ch, at] of Object.entries(m.marks || {})) for (const [x, y] of Array.isArray(at[0]) ? at : [at]) mark(x, y, ch);
  // Litter on the open floor (every square round it floor too).
  for (const i of floor) {
    const x = i % GW, y = Math.floor(i / GW); if (CLS[i] !== (m.floor || 'ground') || NEAR8.some(([dx, dy]) => !floor.has(I(x + dx, y + dy)))) continue;
    let acc = 0; const r = hash(x, y, 905); for (const [ch, p] of Object.entries(m.litter || {})) { acc += p; if (r < acc) { placed.push([x, y, ch, true]); break; } }
  }
  if (bad.length) throw new Error(`${s.id}: marks on the rock, the water, the road or a place's edge: ${bad.join('; ')}`);
  carvedBy[s.id] = { placed, mouths };
}
for (const s of sites) if (s.gorge) carveCanyon(s, s.gorge, false);
for (const s of sites) if (s.pass) carveCanyon(s, s.pass, true);
// The rock tiered by its distance from open ground (a square's eight neighbours): slope beside it, crag a square in,
// snow from three in (and no higher than it was: an old range keeps its own tiers).
{
  const d = new Int16Array(GW * GH).fill(-1), q = [];
  for (let i = 0; i < GW * GH; i++) if (!ROCKC.has(CLS[i])) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % GW, y = Math.floor(i / GW); for (const [dx, dy] of NEAR8) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const j = I(nx, ny); if (d[j] < 0) { d[j] = d[i] + 1; q.push(j); } } }
  for (let i = 0; i < GW * GH; i++) if (ROCKC.has(CLS[i])) CLS[i] = TIER[Math.min(TIER.indexOf(CLS[i]), Math.min(3, d[i]) - 1)];
  // A summit of fewer than four squares is crag (as above).
  const seenS = new Uint8Array(GW * GH);
  for (let s0 = 0; s0 < GW * GH; s0++) {
    if (CLS[s0] !== 'summit' || seenS[s0]) continue;
    const comp = [s0], cq = [s0]; seenS[s0] = 1;
    while (cq.length) { const i = cq.pop(), x = i % GW; for (const dd of [1, -1, GW, -GW]) { const j = i + dd; if (j < 0 || j >= GW * GH || seenS[j] || CLS[j] !== 'summit' || Math.abs((j % GW) - x) > 1) continue; seenS[j] = 1; comp.push(j); cq.push(j); } }
    if (comp.length < 4) for (const i of comp) CLS[i] = 'ledge';
  }
}

// ---- Letters: each square's class in its region's letters -------------------------------------------------------------
// A mountain, a hill, a canopy or a swamp is one region's throughout (the region most of it lies in), so a range across
// the jungle's edge is one rock, not two.
const GROUPS = { mountain: 'm', ledge: 'm', summit: 'm', hill: 'h', forest: 'f', swamp: 's' };
// Outcrops of rock within three squares of each other are one range (so foothills between them don't split its rock).
const NEAR1 = [[1, 0], [-1, 0], [0, 1], [0, -1]], NEAR3 = [];
for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx || dy) NEAR3.push([dx, dy]);
{
  const seen = new Uint8Array(GW * GH);
  for (let s = 0; s < GW * GH; s++) {
    const gk = GROUPS[CLS[s]]; if (!gk || seen[s] || RIM[s]) continue;
    const comp = [s], q = [s]; seen[s] = 1; const votes = {};
    while (q.length) {
      const i = q.pop(); votes[REG[i]] = (votes[REG[i]] || 0) + 1;
      const x = i % GW;
      for (const d of gk === 'm' ? NEAR3 : NEAR1) { const j = i + d[0] + d[1] * GW; if (j < 0 || j >= GW * GH || seen[j] || GROUPS[CLS[j]] !== gk || RIM[j] || Math.abs((j % GW) - x) > 3) continue; seen[j] = 1; comp.push(j); q.push(j); }
    }
    const r = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
    for (const i of comp) REG[i] = r;
  }
}
// A patch of desert of fewer than 40 squares (counting its open land, not sea or rock, whose region its range has
// voted) takes the region round it: a speck of sand amid the grass reads as stray beach. (The jungle's tongues and
// islands stay; they are what grades it into the grass.)
{
  const ROCK = new Set(['ocean', 'mountain', 'ledge', 'summit']);
  const seen = new Uint8Array(GW * GH);
  for (let s = 0; s < GW * GH; s++) {
    if (seen[s] || REG[s] !== 'D' || ROCK.has(CLS[s]) || !zoneAt(s % GW, Math.floor(s / GW)) || zoneAt(s % GW, Math.floor(s / GW)).over.region) continue;
    const comp = [s], q = [s], round = {}; seen[s] = 1;
    while (q.length) {
      const i = q.pop(), x = i % GW;
      for (const d of [1, -1, GW, -GW]) { const j = i + d; if (j < 0 || j >= GW * GH || Math.abs((j % GW) - x) > 1 || CLS[j] === 'ocean' || !zoneAt(j % GW, Math.floor(j / GW))) continue; if (REG[j] !== 'D') { round[REG[j]] = (round[REG[j]] || 0) + 1; continue; } if (!ROCK.has(CLS[j]) && !seen[j]) { seen[j] = 1; comp.push(j); q.push(j); } }
    }
    const best = Object.entries(round).sort((a, b) => b[1] - a[1])[0];
    if (comp.length < 40 && best) for (const i of comp) REG[i] = best[0];
  }
}
const chOf = (i, k) => RG[REG[i]].chars[k] || RG[REG[i]].chars.ground;
const groundCh = (i) => RG[REG[i]].chars.ground;
function letter(i, gx, gy) {
  const k = CLS[i];
  if (RIM[i]) return RG[REG[i]].chars.rim;
  // A jungle swamp is marsh with pools of dark water in it.
  if (k === 'swamp' && RG[REG[i]].chars.pool && vnoise(gx / 2, gy / 2, 41) > 0.6) return RG[REG[i]].chars.pool;
  return chOf(i, k);
}
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { if (zoneAt(gx, gy)) CH[I(gx, gy)] = letter(I(gx, gy), gx, gy); }

// Where the jungle meets the grassland, a band of mossy grass between them (`moss`, the region's letter for it): two
// squares deep on the jungle's side, one on the grass's, so the brown floor and the bright grass never touch.
{
  const SOFTG = new Set(['ground', 'dry', 'woods']);
  const mossy = (i, band) => { const x = i % GW, y = Math.floor(i / GW), r = REG[i];
    for (let dy = -band; dy <= band; dy++) for (let dx = -band; dx <= band; dx++) { const j = I(x + dx, y + dy); if (zoneAt(x + dx, y + dy) && REG[j] !== r && RG[REG[j]].chars.moss && RG[REG[j]].chars.ground !== RG[r].chars.ground && SOFTG.has(CLS[j])) return true; } return false; };
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const i = I(gx, gy), m = RG[REG[i]].chars.moss; if (!m || !zoneAt(gx, gy) || !SOFTG.has(CLS[i]) || RIM[i]) continue;
    if (mossy(i, RG[REG[i]].mossBand || 1)) CH[i] = m;
  }
  // Where the grassland meets the desert, its grass goes dry for two squares (a region's `dryBand`), so the green
  // fades through straw to the sand.
  const nearDesert = (i, band) => { const x = i % GW, y = Math.floor(i / GW);
    for (let dy = -band; dy <= band; dy++) for (let dx = -band; dx <= band; dx++) { const j = I(x + dx, y + dy); if (zoneAt(x + dx, y + dy) && REG[j] === 'D' && SOFTG.has(CLS[j])) return true; } return false; };
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const i = I(gx, gy), R = RG[REG[i]]; if (!R.dryBand || !zoneAt(gx, gy) || !['ground', 'woods'].includes(CLS[i]) || RIM[i] || CH[i] === R.chars.moss) continue;
    if (nearDesert(i, R.dryBand)) { CLS[i] = 'dry'; CH[i] = R.chars.dry; }
  }
}
// Walkable by letter (as tests/game.test.js and tools/diagonals.js read it).
const groundOf = (ch) => GROUND[ch];
const walkCh = (ch) => { if (ch == null || ch === '#' || ch === ' ') return false; const g = groundOf(ch); return !(g && (g.wall || g.walk === false)); };
const wetCh = (ch) => { const g = groundOf(ch); return !!(g && g.walk === false); };
const legendOf = {};                           // zone key -> { letter: def }
const isLegend = (gx, gy) => { const z = zoneAt(gx, gy); return !!(z && legendOf[z.key] && legendOf[z.key][CH[I(gx, gy)]]); };
const walk = (gx, gy) => { const z = zoneAt(gx, gy); if (!z) return false; const c = CH[I(gx, gy)]; if (legendOf[z.key] && legendOf[z.key][c]) return true; return walkCh(c); };

// Cliff sets (forest, jungle, red rock, a fort) draw only shapes made of whole 2x2 blocks on the even grid: no one-row
// steps, no one-square spurs or strips. So a block is all one cliff letter or none: a block mostly cliff over plain
// ground is filled, the rest cleared. Every later cut clears whole blocks (layPath), and nothing later lays a cliff
// letter.
const cliffLetters = new Set(['}', ']', '▧', '@']);
const blockOf = (i) => { const x = (i % GW) & ~1, y = Math.floor(i / GW) & ~1; return [I(x, y), I(x + 1, y), I(x, y + 1), I(x + 1, y + 1)]; };
const clearSq = (i) => { CH[i] = groundCh(i); CLS[i] = CLS[i] === 'forest' ? 'woods' : 'ground'; };
const sameZoneXY = (x0, y0, x1, y1) => Math.floor(x0 / N) === Math.floor(x1 / N) && Math.floor(y0 / N) === Math.floor(y1 / N);
for (let by = 0; by < GH; by += 2) for (let bx = 0; bx < GW; bx += 2) {
  if (!zoneAt(bx, by)) continue;
  const q = blockOf(I(bx, by)), c = q.map((i) => CH[i]).find((ch) => cliffLetters.has(ch));
  if (!c) continue;
  const n = q.filter((i) => CH[i] === c).length, plain = q.every((i) => CH[i] === c || walkCh(CH[i]));
  for (const i of q) if (n >= 2 && plain) CH[i] = c; else if (cliffLetters.has(CH[i])) clearSq(i);
}
// Clear (to plain ground) every cliff square not in a whole block of it, and one of two whole blocks that meet only at
// a corner. Stamped squares stay. Returns how many squares it cleared.
function alignCliffs() {
  let n = 0;
  for (let by = 0; by < GH; by += 2) for (let bx = 0; bx < GW; bx += 2) {
    if (!zoneAt(bx, by)) continue;
    const q = blockOf(I(bx, by)), c = CH[q[0]];
    // A whole block stays unless another cliff set (a stamped fort) touches it: each counts the other as its own.
    const touches = () => { for (let y = by - 1; y <= by + 2; y++) for (let x = bx - 1; x <= bx + 2; x++) { const k = CH[I(x, y)]; if (zoneAt(x, y) && sameZoneXY(bx, by, x, y) && cliffLetters.has(k) && k !== c) return true; } return false; };
    if (cliffLetters.has(c) && q.every((i) => CH[i] === c) && !touches()) continue;
    for (const i of q) if (cliffLetters.has(CH[i]) && !FIX[i]) { clearSq(i); n++; }
  }
  const whole = (bx, by) => { const q = blockOf(I(bx, by)), c = CH[q[0]]; return cliffLetters.has(c) && q.every((i) => CH[i] === c) ? c : null; };
  for (let by = 0; by + 2 < GH; by += 2) for (let bx = 0; bx + 2 < GW; bx += 2) {
    if (bx % N === N - 2 || by % N === N - 2 || !zoneAt(bx, by)) continue;   // the four blocks in one place
    const a = whole(bx, by), b = whole(bx + 2, by), c = whole(bx, by + 2), d = whole(bx + 2, by + 2);
    const pairs = [];
    if (a && a === d && b !== a && c !== a) pairs.push([bx + 2, by + 2], [bx, by]);
    if (b && b === c && a !== b && d !== b) pairs.push([bx, by + 2], [bx + 2, by]);
    for (let k = 0; k < pairs.length; k += 2) {
      const pick = [pairs[k], pairs[k + 1]].find(([x, y]) => blockOf(I(x, y)).every((i) => !FIX[i]));
      if (pick) for (const i of blockOf(I(...pick))) { clearSq(i); n++; }
    }
  }
  return n;
}

// ---- Mazes: a site's labyrinth of two-square passages between two-square walls (so cliff tiles fit) ----------------------
// m: {cols, rows, seed, loops, wall, floor, ring, doors: [{side, at}], rooms: [{cell, span, marks}], ends: [letter...],
// litter: {letter: share}}. Returns stamp rows with a ring (`ring`, else the land as it is) round the outside, '+' (road)
// before each door. Long winding
// passages and dead ends (a depth-first walk), a few loops; rooms are cells run together; `ends` go in the dead ends
// farthest from the doors, farthest first.
function makeMaze(m) {
  let st = (m.seed || 7) >>> 0;
  const rnd = () => { st = (st + 0x6d2b79f5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const C = m.cols, R = m.rows, P = 4, W = C * P + 2, H = R * P + 2;
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const D = [[0, -1, 'N'], [1, 0, 'E'], [0, 1, 'S'], [-1, 0, 'W']];
  const open = Array.from({ length: R }, () => Array.from({ length: C }, () => new Set()));
  const link = (i, j, d) => { const [dx, dy, n] = D[d]; open[j][i].add(n); open[j + dy][i + dx].add(D[(d + 2) % 4][2]); };
  const roomOf = {};
  (m.rooms || []).forEach((rm, k) => { for (let j = 0; j < rm.span[1]; j++) for (let i = 0; i < rm.span[0]; i++) roomOf[(rm.cell[0] + i) + ',' + (rm.cell[1] + j)] = k; });
  const seen = new Set(), start = [Math.floor(C / 2), Math.floor(R / 2)], stack = [start];
  seen.add(start.join(','));
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const nx = shuffle([0, 1, 2, 3]).find((d) => { const ii = i + D[d][0], jj = j + D[d][1]; return ii >= 0 && jj >= 0 && ii < C && jj < R && !seen.has(ii + ',' + jj); });
    if (nx == null) { stack.pop(); continue; }
    link(i, j, nx);
    const ii = i + D[nx][0], jj = j + D[nx][1]; seen.add(ii + ',' + jj); stack.push([ii, jj]);
  }
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) for (const d of [1, 2]) {
    const ii = i + D[d][0], jj = j + D[d][1];
    if (ii >= C || jj >= R) continue;
    const a = roomOf[i + ',' + j], b = roomOf[ii + ',' + jj];
    if (a != null && a === b) link(i, j, d);
    else if (!open[j][i].has(D[d][2]) && rnd() < (m.loops || 0)) link(i, j, d);
  }
  const carve = (x, y) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) g[y][x] = '.'; };
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
    const x = 2 + P * i, y = 2 + P * j;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) carve(x + a, y + b);
    if (open[j][i].has('E')) for (let a = 2; a < P; a++) for (let b = 0; b < 2; b++) carve(x + a, y + b);
    if (open[j][i].has('S')) for (let a = 0; a < 2; a++) for (let b = 2; b < P; b++) carve(x + a, y + b);
    // Inside a room the wall pillars between four of its cells go too.
    const rm = roomOf[i + ',' + j];
    if (rm != null && roomOf[(i + 1) + ',' + j] === rm && roomOf[i + ',' + (j + 1)] === rm && roomOf[(i + 1) + ',' + (j + 1)] === rm) for (let a = 2; a < P; a++) for (let b = 2; b < P; b++) carve(x + a, y + b);
  }
  // Doors: through the outer wall at a cell's row (W, E) or column (N, S).
  const doorSq = [];
  for (const dr of m.doors || []) {
    const k = 2 + P * dr.at;
    const sq = dr.side === 'W' ? [[0, k], [1, k], [0, k + 1], [1, k + 1]] : dr.side === 'E' ? [[W - 1, k], [W - 2, k], [W - 1, k + 1], [W - 2, k + 1]]
      : dr.side === 'N' ? [[k, 0], [k, 1], [k + 1, 0], [k + 1, 1]] : [[k, H - 1], [k, H - 2], [k + 1, H - 1], [k + 1, H - 2]];
    for (const [x, y] of sq) { g[y][x] = '.'; doorSq.push([x, y]); }
  }
  // Distances from the doors, to put things in the far dead ends.
  const dist = new Map(), q = [];
  for (const [x, y] of doorSq) { dist.set(x + ',' + y, 0); q.push([x, y]); }
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of D) { const k = (x + dx) + ',' + (y + dy); if (g[y + dy] && g[y + dy][x + dx] === '.' && !dist.has(k)) { dist.set(k, dist.get(x + ',' + y) + 1); q.push([x + dx, y + dy]); } } }
  const ends = [];
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) if (open[j][i].size === 1 && roomOf[i + ',' + j] == null) { const x = 2 + P * i, y = 2 + P * j; ends.push({ x, y, d: dist.get(x + ',' + y) || 0 }); }
  ends.sort((a, b) => b.d - a.d);
  (m.ends || []).forEach((ch, k) => { const e = ends[k]; if (e) g[e.y + (k % 2)][e.x + ((k >> 1) % 2)] = ch; });
  (m.rooms || []).forEach((rm) => { for (const [ch, [dx, dy]] of Object.entries(rm.marks || {})) g[2 + P * rm.cell[1] + dy][2 + P * rm.cell[0] + dx] = ch; });
  // Litter (bones, a skull): on floor squares with floor all round them, by position.
  let n = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (g[y][x] !== '.') continue;
    let acc = 0; const r = hash(x, y, 91 + (m.seed || 0));
    for (const [ch, p] of Object.entries(m.litter || {})) { acc += p; if (r < acc) { g[y][x] = ch; n++; break; } }
  }
  const unreached = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] !== '#' && !dist.has(x + ',' + y)) unreached.push([x, y]);
  if (unreached.filter(([x, y]) => g[y][x] === '.').length) console.warn(`maze: ${unreached.length} squares not reached from a door`);
  // The stamp: a ring of land round it, road before each door.
  const out = Array.from({ length: H + 2 }, () => Array(W + 2).fill(m.ring || ' '));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y + 1][x + 1] = g[y][x] === '#' ? m.wall : g[y][x] === '.' ? m.floor : g[y][x];
  for (const [x, y] of doorSq) { const ox = x === 0 ? 0 : x === W - 1 ? W + 1 : x + 1, oy = y === 0 ? 0 : y === H - 1 ? H + 1 : y + 1; if (ox === 0 || oy === 0 || ox === W + 1 || oy === H + 1) out[oy][ox] = '+'; }
  return out.map((r) => r.join(''));
}

// ---- Sites: stamps, rings' marks ---------------------------------------------------------------------------------------
const recruits = [];
const siteAnchor = {};                         // site id -> [gx, gy] squares the roads may start from
function stampSite(s) {
  const z = zoneAt(...s.g); if (!z) throw new Error(`site ${s.id} is off the map`);
  // A site's legend and encounters go into its place; a canyon's, into each place a mark of it lands in (only the
  // letters that land there).
  const legendIn = (zz, k) => { const lgz = (legendOf[zz.key] = legendOf[zz.key] || {}), d = (s.legend || {})[k]; if (!d) return lgz;
    // (The same entry may stand on another ground where an earlier mark of it set `·` to its own.)
    const same = (a, b) => JSON.stringify({ ...a, on: 0 }) === JSON.stringify({ ...b, on: 0 }) && (a.on === b.on || a.on === '·' || b.on === '·');
    if (lgz[k] && !same(lgz[k], d)) throw new Error(`site ${s.id}: legend "${k}" is taken in ${zz.id}`);
    if (!lgz[k]) lgz[k] = { ...d }; zz.encounters = Object.assign(zz.encounters || {}, s.encounters || {}); return lgz; };
  const lg = (legendOf[z.key] = legendOf[z.key] || {});
  if (!carvedBy[s.id]) for (const k of Object.keys(s.legend || {})) legendIn(z, k);
  z.encounters = Object.assign(z.encounters || {}, s.encounters || {});
  if (s.wandering) z.wandering = (z.wandering || []).concat(s.wandering);
  const anchors = [];
  const stamp = s.maze ? makeMaze(s.maze) : s.stamp;
  if (stamp) {
    // `·` the ground of the square's region, `+` its road, a space the terrain as it is; any other letter as written.
    const st = stamp.map((row) => [...row]), h = st.length, w = st[0].length;
    st.forEach((r, i) => { if (r.length !== w) throw new Error(`site ${s.id}: stamp row ${i} is ${r.length} wide, not ${w}`); });
    // Keep it inside its place, two squares off the edges (the edges are the ways across); a stamp with cliff letters
    // laid so its blocks fall on the even grid (`parity`: the column and row of its first block, 0 or 1).
    const zx0 = z.c * N, zy0 = z.r * N;
    let x0 = Math.max(zx0 + 2, Math.min(zx0 + N - 2 - w, s.g[0] - Math.floor(w / 2)));
    let y0 = Math.max(zy0 + 2, Math.min(zy0 + N - 2 - h, s.g[1] - Math.floor(h / 2)));
    const par = s.maze ? 1 : s.parity;
    if (par != null) { if ((x0 - par) % 2) x0 -= 1; if ((y0 - par) % 2) y0 -= 1; }
    s.origin = [x0, y0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = x0 + x, gy = y0 + y, i = I(gx, gy);
      let c = st[y][x]; if (c === ' ') continue;
      if (lg[c] && lg[c].on === '·') lg[c] = Object.assign({}, lg[c], { on: groundCh(i) });
      if (c === '+') { c = chOf(i, 'road'); anchors.push([gx, gy]); CLS[i] = 'road'; }
      else if (c === '·') c = groundCh(i);
      if (/[1-8]/.test(c)) { recruits.push({ n: +c, place: z.id, at: [gx - zx0, gy - zy0] }); c = groundCh(i); }
      CH[i] = c; FIX[i] = 1;
    }
  }
  for (const m of s.marks || []) { const gx = s.g[0] + m.at[0], gy = s.g[1] + m.at[1]; CH[I(gx, gy)] = m.char; FIX[I(gx, gy)] = 1; anchors.push([gx, gy]);
    // clear the ground round a mark so its door stands free
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = I(gx + dx, gy + dy); if (!FIX[j] && !walkCh(CH[j]) && !['lake', 'ocean'].includes(CLS[j])) { RIM[j] = 0; CLS[j] = 'ground'; CH[j] = groundCh(j); } }
  }
  // What a gorge or a pass put down (litter only on the plain ground, so the ground under it is the one it names), and
  // its mouths for the roads.
  const cv = carvedBy[s.id];
  if (cv) {
    for (const [gx, gy, c, litter] of cv.placed) {
      const i = I(gx, gy);
      if (litter && CH[i] !== groundCh(i)) continue;
      const lgz = legendIn(zoneAt(gx, gy), c);
      if (lgz[c] && lgz[c].on === '·') lgz[c] = Object.assign({}, lgz[c], { on: groundCh(i) });
      CH[i] = c; FIX[i] = 1;
    }
    anchors.push(...cv.mouths);
  }
  if (!anchors.length) anchors.push(s.g);
  siteAnchor[s.id] = anchors;
}
for (const s of sites) stampSite(s);

// ---- Falls: where a river or a stream drops `terrain.falls.drop` km or more from one cell to the next, flowing south (the
// cascade's art falls down the screen), a waterfall on its square where the land is halfway down, in a notch of cliff
// two squares either side and two up; none within `apart` squares of another.
if (TER.falls) {
  const F = TER.falls, fch = F.char, def = { kind: 'prop', sprite: F.sprite || 'waterfall', label: F.label || 'A waterfall' };
  let nFalls = 0; const fallsAt = [];
  for (const k of continent) {
    const c = cells.get(k); if (c.flow_to < 0 || (c.strahler < (STREAM.strahler ?? 2) && !c.lake)) continue;
    const d = cells.get(c.flow_to); if (!d || (c.lake && d.lake) || c.elev - d.elev < (F.drop ?? 0.4)) continue;
    const [x0, y0] = [(c.lon - lon0) * spd, (lat0 - c.lat) * spd], [x1, y1] = [(d.lon - lon0) * spd, (lat0 - d.lat) * spd];
    if (y1 - y0 < Math.abs(x1 - x0) * 0.7) continue;
    const mid = (c.elev + d.elev) / 2;
    let best = null;
    for (let t = 0; t <= 1; t += 0.05) { const e = field(c.lon + (d.lon - c.lon) * t, c.lat + (d.lat - c.lat) * t, 'elev'); if (!best || Math.abs(e - mid) < best.e) best = { e: Math.abs(e - mid), t }; }
    const fx = x0 + (x1 - x0) * best.t, fy = y0 + (y1 - y0) * best.t;
    let sq = null;
    for (let gy = Math.floor(fy - 3); gy <= fy + 3; gy++) for (let gx = Math.floor(fx - 3); gx <= fx + 3; gx++) {
      const i = I(gx, gy), z = zoneAt(gx, gy), ex = gx % N, ey = gy % N;
      if (!z || !['river', 'stream'].includes(CLS[i]) || FIX[i] || ex < 3 || ey < 3 || ex > N - 4 || ey > N - 2) continue;
      // Land on both sides of it, here and a square up (not a stream's mouth into a lake).
      const dryAt = (dx, dy) => !['river', 'stream', 'lake', 'ocean', 'swamp'].includes(CLS[I(gx + dx, gy + dy)]);
      if (!(dryAt(-1, 0) && dryAt(1, 0) && (dryAt(-1, -1) || dryAt(-2, -1)) && (dryAt(1, -1) || dryAt(2, -1)))) continue;
      const dd = Math.hypot(gx + 0.5 - fx, gy + 0.5 - fy); if (!sq || dd < sq.d) sq = { d: dd, gx, gy, z };
    }
    if (!sq || fallsAt.some(([x, y]) => Math.hypot(x - sq.gx, y - sq.gy) < (F.apart ?? 8))) continue;
    fallsAt.push([sq.gx, sq.gy]);
    for (let dy = -2; dy <= 0; dy++) for (const dx of [-2, -1, 1, 2]) {
      const i = I(sq.gx + dx, sq.gy + dy);
      if (!zoneAt(sq.gx + dx, sq.gy + dy) || !sameZoneXY(sq.gx, sq.gy, sq.gx + dx, sq.gy + dy) || FIX[i] || ['river', 'stream', 'lake', 'ocean'].includes(CLS[i])) continue;
      CLS[i] = 'mountain'; CH[i] = chOf(i, 'mountain');
    }
    const lg = (legendOf[sq.z.key] = legendOf[sq.z.key] || {});
    if (lg[fch] && lg[fch].sprite !== def.sprite) throw new Error(`falls: the letter ${fch} is taken in ${sq.z.id}`);
    lg[fch] = { ...def, on: CH[I(sq.gx, sq.gy)] };
    CH[I(sq.gx, sq.gy)] = fch; FIX[I(sq.gx, sq.gy)] = 1; nFalls++;
  }
  console.log(`${nFalls} falls`);
}

// ---- Roads -------------------------------------------------------------------------------------------------------------
// A binary heap for the searches.
class Heap { constructor() { this.a = []; } push(p, v) { const a = this.a; a.push([p, v]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } } pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; } get size() { return this.a.length; } }
const COST = { ground: 1, gorge: 1, dry: 1, sand: 1.2, woods: 1.4, hill: 1.6, swamp: 2.5, stream: 1.6, forest: 3, river: 7, lake: 14, mountain: 18, ledge: 60, summit: Infinity, ocean: Infinity, road: 0.35, bridge: 0.5, ford: 0.5 };
function stepCost(gx, gy) {
  const z = zoneAt(gx, gy); if (!z) return Infinity;
  const i = I(gx, gy);
  if (SEAL[i]) return Infinity;
  let c;
  if (FIX[i]) c = walk(gx, gy) && !isLegend(gx, gy) ? (CLS[i] === 'road' ? 0.35 : 1) : Infinity;
  else c = RIM[i] ? Infinity : (COST[CLS[i]] ?? 2);
  const ex = gx % N, ey = gy % N;
  if (ex === 0 || ey === 0 || ex === N - 1 || ey === N - 1) c += 3;   // not along the edges
  // Open ground costs more or less by a slow noise, so over flat land a road bends along the cheap hollows instead of
  // running ruler-straight; an old road (cost below 1) is still followed.
  return c >= 1 && c < Infinity ? c * (0.35 + 0.8 * fbm(gx / 9, gy / 9, 31) + 0.6 * vnoise(gx / 2.5, gy / 2.5, 37)) : c;
}
const DIST = new Float64Array(GW * GH), PREV = new Int32Array(GW * GH);
// Cheapest way from any start to a square isGoal accepts; a goal square may be entered whatever it costs.
function search(starts, isGoal, costFn) {
  DIST.fill(Infinity); PREV.fill(-1);
  const h = new Heap();
  for (const [x, y] of starts) { const i = I(x, y); DIST[i] = 0; h.push(0, i); }
  while (h.size) {
    const [d, i] = h.pop(); if (d > DIST[i]) continue;
    const x = i % GW, y = Math.floor(i / GW);
    if (isGoal(x, y, i)) { const p = []; for (let k = i; k >= 0; k = PREV[k]) p.push(k); return p.reverse(); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const j = I(nx, ny);
      let c = costFn(nx, ny); if (c === Infinity) { if (!isGoal(nx, ny, j)) continue; c = 1; }
      const nd = d + c;
      if (nd < DIST[j]) { DIST[j] = nd; PREV[j] = i; h.push(nd, j); }
    }
  }
  return null;
}
// Lay a path: a road (its region's road letter; a ford over a river, a bridge over a lake) or a way cut ('ground').
function layPath(p, how) {
  for (const i of p) {
    if (FIX[i]) continue;
    if (cliffLetters.has(CH[i])) for (const j of blockOf(i)) if (!FIX[j] && cliffLetters.has(CH[j])) clearSq(j);
    const was = CLS[i];
    RIM[i] = 0;
    if (was === 'river') { CH[i] = chOf(i, 'ford'); CLS[i] = 'ford'; }
    else if (['lake', 'ocean'].includes(was) || wetCh(CH[i])) { CH[i] = chOf(i, 'bridge'); CLS[i] = 'bridge'; }
    else if (how === 'road') { CH[i] = chOf(i, 'road'); CLS[i] = 'road'; }
    else if (!walkCh(CH[i])) { CH[i] = groundCh(i); CLS[i] = 'ground'; }
  }
}
let roadsLaid = 0;
const siteById = Object.fromEntries(sites.map((s) => [s.id, s]));
for (const s of sites) for (const t of s.road || []) {
  const T = siteById[t]; if (!T) throw new Error(`site ${s.id}: road to unknown site ${t}`);
  const goals = new Set(siteAnchor[t].map(([x, y]) => I(x, y)));
  const p = search(siteAnchor[s.id], (x, y, i) => goals.has(i), stepCost);
  if (!p) { console.warn(`no road from ${s.id} to ${t}`); continue; }
  layPath(p, 'road'); roadsLaid++;
}

// ---- One world: each place one piece of walkable ground, and every place reached from home's --------------------------
const wet = (i) => wetCh(CH[i]);
const sameZone = (x0, y0, x1, y1) => Math.floor(x0 / N) === Math.floor(x1 / N) && Math.floor(y0 / N) === Math.floor(y1 / N);
// Closing (x, y) cuts no way: the walkable squares round it stay one piece through its eight neighbours.
function locallyOne(x, y) {
  const ring = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => sameZone(x, y, a, b) && walk(a, b));
  if (!ring.length) return true;
  const key = ([a, b]) => a + ',' + b, set = new Set(ring.map(key)), seen = new Set([key(ring[0])]), q = [ring[0]];
  while (q.length) { const [a, b] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (a + dx) + ',' + (b + dy); if (set.has(k) && !seen.has(k)) { seen.add(k); q.push([a + dx, b + dy]); } } }
  return seen.size === ring.length;
}
// A square turned to water: the water beside it (a river's, a lake's or a swamp's pool).
function flood(i) {
  const n = [1, -1, GW, -GW].map((d) => CH[i + d]).find((c) => wetCh(c));
  CH[i] = n || chOf(i, 'lake'); CLS[i] = n === chOf(i, 'river') ? 'river' : 'lake';
}
// Walkable squares that touch only at a corner (tools/diagonals.js): beside water, one of them becomes water if that
// cuts nothing; else the cheaper square between is opened (a whole block of a cliff set); else one is closed.
function fixDiagonals() {
  let n = 0;
  for (let gy = 0; gy < GH - 1; gy++) for (let gx = 0; gx < GW - 1; gx++) {
    if (gx % N === N - 1 || gy % N === N - 1 || !zoneAt(gx, gy)) continue;
    const a = walk(gx, gy), b = walk(gx + 1, gy), c = walk(gx, gy + 1), d = walk(gx + 1, gy + 1);
    if (!((a && d && !b && !c) || (b && c && !a && !d))) continue;
    const walkers = (a && d ? [[gx, gy], [gx + 1, gy + 1]] : [[gx + 1, gy], [gx, gy + 1]]).filter(([x, y]) => !FIX[I(x, y)] && !isLegend(x, y));
    const blockers = a && d ? [[gx + 1, gy], [gx, gy + 1]] : [[gx, gy], [gx + 1, gy + 1]];
    if (blockers.some(([x, y]) => wet(I(x, y)))) {
      const w = walkers.find(([x, y]) => locallyOne(x, y));
      if (w) { flood(I(...w)); n++; continue; }
    }
    const opens = blockers.filter(([x, y]) => !FIX[I(x, y)] && !SEAL[I(x, y)]).sort((p, q) => (COST[CLS[I(...p)]] ?? 9) - (COST[CLS[I(...q)]] ?? 9));
    if (opens.length) { layPath([I(...opens[0])], 'ground'); n++; continue; }
    if (walkers.length) { flood(I(...walkers[0])); n++; }
  }
  return n;
}
// Walkable pieces within each place (not across its edges).
function components() {
  const comp = new Int32Array(GW * GH).fill(-1), sizes = [], zoneOfComp = [];
  for (let i = 0; i < GW * GH; i++) {
    const x0 = i % GW, y0 = Math.floor(i / GW);
    if (comp[i] >= 0 || !walk(x0, y0)) continue;
    const id = sizes.length; let n = 0; const q = [i]; comp[i] = id;
    while (q.length) {
      const j = q.pop(); n++; const x = j % GW, y = Math.floor(j / GW);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || !sameZone(x, y, nx, ny)) continue; const k = I(nx, ny); if (comp[k] < 0 && walk(nx, ny)) { comp[k] = id; q.push(k); } }
    }
    sizes.push(n); zoneOfComp.push(zoneAt(x0, y0).key);
  }
  return { comp, sizes, zoneOfComp };
}
const homeSite = siteById[L.home];
const CARVE = { ground: 1, gorge: 1, dry: 1, sand: 1, woods: 1, hill: 1, swamp: 1, road: 1, bridge: 1, ford: 1, forest: 2.5, river: 6, lake: 10, mountain: 8, ledge: 30, summit: 200, ocean: 80 };
const carveCost = (x, y) => { const z = zoneAt(x, y); if (!z) return Infinity; const i = I(x, y); if (SEAL[i]) return Infinity; if (FIX[i]) return walk(x, y) && !isLegend(x, y) ? 1 : Infinity; return walk(x, y) ? 1 : (CARVE[CLS[i]] ?? 3) + (RIM[i] ? 40 : 0); };
let carved = 0, filled = 0;
// In each place, pieces cut off from its largest: a small one by water becomes water; the rest are joined to the
// largest by the cheapest way within the place. Returns how many pieces it dealt with.
function joinPlaces() {
  const { comp, sizes, zoneOfComp } = components();
  // Pieces joined across places' edges (a pair of walkable squares facing each other, not at a corner): the ones in
  // home's are reached, however far round, and stay as they are (a canyon's floor is a piece of its place of its own).
  const up = sizes.map((_, k) => k), root = (k) => { while (up[k] !== k) k = up[k] = up[up[k]]; return k; };
  for (let i = 0; i < GW * GH; i++) {
    if (comp[i] < 0) continue; const x = i % GW, y = Math.floor(i / GW), ex = x % N, ey = y % N;
    if ((ex === 0 || ex === N - 1) && (ey === 0 || ey === N - 1)) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) { const j = I(x + dx, y + dy); if (x + dx < GW && y + dy < GH && comp[j] >= 0 && !sameZone(x, y, x + dx, y + dy) && !isLegend(x, y) && !isLegend(x + dx, y + dy)) up[root(comp[i])] = root(comp[j]); }
  }
  const homeSq = siteAnchor[L.home].map(([x, y]) => I(x, y)).find((i) => comp[i] >= 0), homeRoot = homeSq == null ? -1 : root(comp[homeSq]);
  // Each place's main piece: its largest reached one, else its largest.
  const main = {};
  const better = (a, b) => b === undefined || (root(a) === homeRoot) > (root(b) === homeRoot) || ((root(a) === homeRoot) === (root(b) === homeRoot) && sizes[a] > sizes[b]);
  for (let id = 0; id < sizes.length; id++) { const k = zoneOfComp[id]; if (better(id, main[k])) main[k] = id; }
  const members = {};
  for (let i = 0; i < GW * GH; i++) if (comp[i] >= 0 && comp[i] !== main[zoneOfComp[comp[i]]]) (members[comp[i]] = members[comp[i]] || []).push(i);
  let dealt = 0;
  for (const [idS, sq] of Object.entries(members)) {
    const id = +idS, z = zones[zoneOfComp[id]];
    // A piece reached from home's across the places' edges stays (so a coast running along a place's edge stays where
    // the land puts it, not flooded back to the edge).
    if (root(id) === homeRoot) continue;
    dealt++;
    const byWater = sq.some((i) => [1, -1, GW, -GW].some((d) => wet(i + d)));
    if (sizes[id] < 24 && byWater && sq.every((i) => !FIX[i] && !isLegend(i % GW, Math.floor(i / GW)))) { for (const i of sq) { flood(i); filled++; } continue; }
    const inZ = (x, y) => zoneAt(x, y) === z ? carveCost(x, y) : Infinity;
    const p = search(sq.map((i) => [i % GW, Math.floor(i / GW)]), (x, y, i) => comp[i] === main[z.key], inZ);
    if (!p) { console.warn(`${z.id}: a piece of ${sizes[id]} squares can't be joined; flooded`); for (const i of sq) if (!FIX[i]) flood(i); continue; }
    layPath(p, 'ground'); carved++;
  }
  return dealt;
}
// Places reached from home's across their edges (a pair of walkable squares facing each other); one not reached gets
// the cheapest way to one that is.
function joinWorld() {
  const homeZ = zoneAt(...siteAnchor[L.home][0]), seen = new Set([homeZ.key]), q = [homeZ];
  const crosses = (z, o, dx, dy) => { for (let t = 1; t < N - 1; t++) { const x = z.c * N + (dx === 1 ? N - 1 : dx === -1 ? 0 : t), y = z.r * N + (dy === 1 ? N - 1 : dy === -1 ? 0 : t); if (walk(x, y) && walk(x + dx, y + dy) && !isLegend(x, y) && !isLegend(x + dx, y + dy)) return true; } return false; };
  while (q.length) { const z = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = zones[slotKey(z.r + dy, z.c + dx)]; if (o && !seen.has(o.key) && crosses(z, o, dx, dy)) { seen.add(o.key); q.push(o); } } }
  const lost = Object.values(zones).filter((z) => !seen.has(z.key));
  if (!lost.length) return 0;
  const z = lost[0], starts = [];
  for (let y = z.r * N; y < z.r * N + N; y++) for (let x = z.c * N; x < z.c * N + N; x++) if (walk(x, y)) starts.push([x, y]);
  if (!starts.length) { const c = [z.c * N + N / 2, z.r * N + N / 2]; starts.push(c); }
  const p = search(starts, (x, y) => { const o = zoneAt(x, y); return !!o && seen.has(o.key) && walk(x, y); }, (x, y) => { const c = carveCost(x, y); const ex = x % N, ey = y % N; return c + ((ex === 0 || ey === 0 || ex === N - 1 || ey === N - 1) && !walk(x, y) ? 2 : 0); });
  if (!p) { console.warn(`${z.id} can't be reached`); return 0; }
  layPath(p, 'ground'); carved++;
  return 1;
}
alignCliffs();
// Each step can undo another's work (opening a block makes a corner elsewhere; a way cut leaves a piece): until still.
let settle = 0;
for (; settle < 30; settle++) {
  const n = fixDiagonals() + joinPlaces() + joinWorld() + alignCliffs();
  if (!n) break;
}
if (settle === 30) console.warn('the map did not settle: some corners or pieces may be left');

// ---- Looks: a place's light and colours by the region most of it is ----------------------------------------------------
for (const z of Object.values(zones)) {
  const v = {};
  for (let y = z.r * N; y < z.r * N + N; y++) for (let x = z.c * N; x < z.c * N + N; x++) if (walk(x, y)) v[REG[I(x, y)]] = (v[REG[I(x, y)]] || 0) + 1;
  z.reg = (Object.entries(v).sort((a, b) => b[1] - a[1])[0] || ['G'])[0];
}

// ---- What the cliff sets still cannot draw (should be nothing) -----------------------------------------------------------
const TS = Tm.tileset(L.tileset);
function zoneScene(z) {
  const zx0 = z.c * N, zy0 = z.r * N, lg = legendOf[z.key] || {};
  return { w: N, h: N, misfits: true, cell: (x, y) => {
    if (x < 0 || y < 0 || x >= N || y >= N) return { kind: 'rock', ch: ' ' };
    const ch = CH[I(zx0 + x, zy0 + y)];
    if (ch === '#') return { kind: 'wall', ch, ground: G.Explore.groundOf('#') };
    const def = lg[ch];
    if (def) return { kind: def.kind, ch, def, ground: def.on ? G.Explore.groundOf(def.on) : null };
    const gr = G.Explore.groundOf(ch);
    if (gr && gr.wall) return { kind: 'wall', ch, ground: gr };
    return { kind: gr && gr.walk === false ? 'water' : 'floor', ch, ground: gr };
  } };
}
const misfits = {};
for (const z of Object.values(zones)) { const m = Tm.planTiles(zoneScene(z), TS, 0, 0, N - 1, N - 1).misfit || []; if (m.length) misfits[z.id] = m; }
const misfitLeft = Object.values(misfits).reduce((t, m) => t + m.length, 0);

// ---- Scattered props: trees, bushes, rocks, reeds ---------------------------------------------------------------------------
// By the square's region and class (the layout's `scatter`); `shore` for squares beside a lake or a river, `edge` for
// a square of one region within three of another's (the jungle's ferns out onto the grass). A solid prop only where
// enough of its neighbours are open and none is laid (see below).
const propsUsed = {};
const POOL = [...'ŧɨƥǥǿʀƙϻƨçαβδεζηθικλμνξπρστυφχψωϐϑϒϕϖϗϙϛϝϟϡϣϥϧϩϫϭϯбгджзийклмнптфцчшщъыьэюяђѓєѕіїјљњћќўџѡѣѥѧѩѫѭѯѱѳѵѷѹѻѽѿ'];
const nearOther = (gx, gy) => { const r = REG[I(gx, gy)]; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = gx + dx, y = gy + dy; if (zoneAt(x, y) && walkCh(CH[I(x, y)]) && REG[I(x, y)] !== r && CLS[I(x, y)] !== 'road') return REG[I(x, y)]; } return null; };
const byWaterSq = (gx, gy) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ['lake', 'river', 'stream'].includes(CLS[I(gx + dx, gy + dy)]));
for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
  const z = zoneAt(gx, gy), i = I(gx, gy); if (!z || FIX[i]) continue;
  const ex = gx % N, ey = gy % N; if (ex < 1 || ey < 1 || ex > N - 2 || ey > N - 2) continue;
  const c = CH[i], cl = CLS[i], reg = REG[i], sc = RG[reg].scatter || {};
  if (['road', 'bridge', 'ford'].includes(cl) || !walkCh(c)) continue;
  const tables = [];
  if (sc[cl]) tables.push(sc[cl]);
  if (sc.shore && byWaterSq(gx, gy)) tables.push(sc.shore);
  const other = sc.edge && nearOther(gx, gy);
  if (other && sc.edge[other]) tables.push(sc.edge[other]);
  if (!tables.length) continue;
  // A solid prop: nothing stamped or laid beside it (so trees stand a square apart), five of its eight neighbours open,
  // and the open squares round it still one piece without it (it shuts no way). It may stand beside a canopy or a
  // cliff, so a wood's trees run up to the forest's edge.
  let open = true, nWalk = 0;
  for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const j = I(gx + dx, gy + dy); if (FIX[j] || isLegend(gx + dx, gy + dy)) { open = false; break; } if (walkCh(CH[j])) nWalk++; }
  // Nor right below a canopy or a cliff: the tree would stand in front of its face, hiding it.
  if (open) open = nWalk >= 5 && [-1, 0, 1].every((dx) => walkCh(CH[I(gx + dx, gy - 1)])) && locallyOne(gx, gy);
  for (const [t, table] of tables.entries()) {
    const r = hash(gx, gy, 77 + t * 13);
    let acc = 0, placed = false;
    for (const [p, w] of Object.entries(table)) {
      acc += w; if (r >= acc) continue;
      const def = L.props[p]; if (!def) throw new Error(`scatter: no prop ${p}`);
      if (def.solid !== false && !open) break;
      // A letter for each prop on each ground it stands on (a legend entry has one ground under it).
      const lg = (legendOf[z.key] = legendOf[z.key] || {}), used = (propsUsed[z.key] = propsUsed[z.key] || {}), key = p + '|' + c;
      if (!used[key]) {
        const ch = POOL.find((x) => !lg[x]); if (!ch) { console.warn(`${z.id}: out of prop letters`); break; }
        used[key] = ch;
        lg[ch] = Object.assign({ kind: 'prop' }, def); if (c !== '.') lg[ch].on = c;
      }
      CH[i] = used[key]; FIX[i] = 2; placed = true;
      break;
    }
    if (placed) break;
  }
}

// ---- Ways across: every pair of walkable squares facing each other over a shared edge ---------------------------------
// Each side's squares take a letter by the ground they are on (a legend entry has one ground); each arrives on the
// letter facing it (Explore.enter puts you on the square across from where you left). A step off the edge from one
// crosses (`edge: true`).
const EXIT = { N: [...'NŇṄṆŊṈṊ'], S: [...'SŠṠȘŚṢṤ'], E: [...'EĒĖĘĚẸẺ'], W: [...'WŴẀẂẄẈẆ'] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const DIRN = { N: 'North', S: 'South', E: 'East', W: 'West' };
const zoneOf = (r, c) => zones[slotKey(r, c)];
const exitsOf = {};
// An edge square's ground letter (a prop or legend square stands on its `on`).
const groundAt = (i) => { const z = zoneAt(i % GW, Math.floor(i / GW)), d = legendOf[z.key] && legendOf[z.key][CH[i]]; return d ? (d.on || '.') : CH[i]; };
for (const z of Object.values(zones)) for (const [d, dx, dy] of [['E', 1, 0], ['S', 0, 1]]) {
  const o = zoneOf(z.r + dy, z.c + dx); if (!o) continue;
  const pairs = [];
  for (let t = 1; t < N - 1; t++) {   // not the corners: each belongs to two edges
    const gx = z.c * N + (dx ? N - 1 : t), gy = z.r * N + (dy ? N - 1 : t), ox = gx + dx, oy = gy + dy;
    if (walk(gx, gy) && walk(ox, oy) && !isLegend(gx, gy) && !isLegend(ox, oy)) pairs.push([I(gx, gy), I(ox, oy)]);
  }
  const sides = [[z, o, d, 0], [o, z, OPP[d], 1]];
  const letters = [{}, {}];
  for (const [me, them, dd, k] of sides) for (const pr of pairs) { const on = groundAt(pr[k]); if (!(on in letters[k])) letters[k][on] = EXIT[dd][Object.keys(letters[k]).length] || null; }
  for (const pr of pairs) if (!letters[0][groundAt(pr[0])] || !letters[1][groundAt(pr[1])]) { pr.skip = true; }
  for (const [me, them, dd, k] of sides) {
    const lg = (legendOf[me.key] = legendOf[me.key] || {});
    for (const pr of pairs) {
      if (pr.skip) continue;
      const on = groundAt(pr[k]), ch = letters[k][on], facing = letters[1 - k][groundAt(pr[1 - k])];
      if (lg[ch] && lg[ch].kind !== 'stairs') throw new Error(`${me.id}: exit letter ${ch} is taken`);
      if (!lg[ch]) lg[ch] = { kind: 'stairs', to: them.id, at: facing, edge: true, sprite: 'none', label: `${DIRN[dd]}, to ${them.over.name || '{{name:' + them.key + '}}'}`, on: on === '.' ? undefined : on };
      pr['ch' + k] = ch;
    }
  }
  for (const pr of pairs) if (!pr.skip) { CH[pr[0]] = pr.ch0; CH[pr[1]] = pr.ch1; (exitsOf[z.key] = exitsOf[z.key] || []).push(pr.ch0); (exitsOf[o.key] = exitsOf[o.key] || []).push(pr.ch1); }
}

// ---- Names, levels, blurbs ---------------------------------------------------------------------------------------------
const homeZone = zoneAt(...homeSite.g);
{ const dist = { [homeZone.key]: 0 }, q = [homeZone];
  while (q.length) { const z = q.shift(); for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = zoneOf(z.r + dr, z.c + dc); if (o && !(o.key in dist) && (exitsOf[z.key] || []).length) { dist[o.key] = dist[z.key] + 1; q.push(o); } } }
  for (const z of Object.values(zones)) { z.dist = dist[z.key] ?? 99; z.level = Math.min(L.level.max, L.level.base + Math.round((z.dist === 99 ? 12 : z.dist) * L.level.per)); }
}
const biomeWord = { G: 'grassland', F: 'forest', J: 'jungle', D: 'desert' };
for (const z of Object.values(zones)) {
  const share = Object.entries(z.biomes).sort((a, b) => b[1] - a[1]).map(([b, n]) => `${biomeWord[b] || b} ${Math.round(100 * n / Math.max(1, z.land))}%`).join(', ');
  z.name = z.over.name || null;
  z.blurb = z.over.blurb || `${biomeWord[z.dom] ? biomeWord[z.dom][0].toUpperCase() + biomeWord[z.dom].slice(1) : 'Land'}: ${share} of it, by the world map. Not yet crafted.`;
}
// A place the layout leaves unnamed is named by its land and the nearest named one ("Jungle west of Zhomelonga"), and
// listed in the gap report: every place should have a name of its own.
const unnamed = [];
{
  const named = Object.values(zones).filter((z) => z.name), taken = {};
  const cap = (w) => w[0].toUpperCase() + w.slice(1);
  for (const z of Object.values(zones).filter((q) => !q.name).sort((a, b) => a.r - b.r || a.c - b.c)) {
    const a = named.slice().sort((p, q) => Math.hypot(p.r - z.r, p.c - z.c) - Math.hypot(q.r - z.r, q.c - z.c))[0];
    const dr = z.r - a.r, dc = z.c - a.c, ns = Math.abs(dr) * 2 > Math.abs(dc) ? (dr < 0 ? 'north' : 'south') : '', ew = Math.abs(dc) * 2 > Math.abs(dr) ? (dc < 0 ? 'west' : 'east') : '';
    let n = `${cap(biomeWord[z.dom] || 'land')} ${Math.max(Math.abs(dr), Math.abs(dc)) >= 2 ? 'far ' : ''}${ns}${ew} of ${a.name.replace(/^The /, 'the ')}`;
    taken[n] = (taken[n] || 0) + 1; if (taken[n] > 1) n += ` (${taken[n]})`;
    z.name = n; unnamed.push(z.id);
  }
}
for (const z of Object.values(zones)) for (const d of Object.values(legendOf[z.key] || {})) if (d.label && d.label.includes('{{name:')) d.label = d.label.replace(/\{\{name:([0-9,]+)\}\}/, (_, k) => zones[k].name);

// ---- Write ----------------------------------------------------------------------------------------------------------------
const q = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const bare = (s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && !['true', 'false', 'null', 'yes', 'no', 'on', 'off', 'y', 'n'].includes(s.toLowerCase());
function flow(v) {
  if (v === null || v === undefined) return '~';
  if (Array.isArray(v)) return '[' + v.map(flow).join(', ') + ']';
  if (typeof v === 'object') return '{' + Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${bare(k) ? k : q(k)}: ${flow(x)}`).join(', ') + '}';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return bare(v) ? v : q(v);
}
const out = ['# Generated by tools/worldgen.js from ' + path.relative(repo, layoutPath) + '. The outdoor places of the open world: one a',
  '# slot of the layout\'s grid. Regenerating overwrites this file: edit the layout, or edit a map here and keep it.', ''];
const order = Object.values(zones).sort((a, b) => a.r - b.r || a.c - b.c);
// `.` is plain floor, not a ground letter: a legend entry or look without a ground stands on the floor.
const noFloor = (d) => { if (d.on !== '.') return d; const e = Object.assign({}, d); delete e.on; return e; };
for (const z of order) {
  const zx0 = z.c * N, zy0 = z.r * N;
  out.push(`${z.id}:`, `  name: ${q(z.name)}`, '  kind: dungeon', '  open: true', `  world: [${z.r}, ${z.c}]`, `  blurb: ${q(z.blurb)}`, `  level: ${z.level}`,
    `  look: ${flow(Object.assign({}, RG[z.reg].look, { tileset: L.tileset }))}`, '  map:');
  for (let y = 0; y < N; y++) { let row = ''; for (let x = 0; x < N; x++) row += CH[I(zx0 + x, zy0 + y)]; out.push(`    - ${q(row)}`); }
  out.push('  legend:');
  const lg = legendOf[z.key] || {};
  const onMap = new Set(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) onMap.add(CH[I(zx0 + x, zy0 + y)]);
  for (const [k, d] of Object.entries(lg)) if (onMap.has(k)) out.push(`    ${q(k)}: ${flow(noFloor(d))}`);
  out.push('  encounters:' + (z.encounters && Object.keys(z.encounters).length ? '' : ' {}'));
  for (const [k, e] of Object.entries(z.encounters || {})) out.push(`    ${k}: ${flow(e)}`);
  if (z.wandering) { out.push('  wandering:'); for (const w of z.wandering) out.push(`    - ${flow(w)}`); }
  out.push('');
}
fs.writeFileSync(outPath, out.join('\n'));

// ---- The gap report ---------------------------------------------------------------------------------------------------------
const regCount = {};
for (const z of order) regCount[z.reg] = (regCount[z.reg] || 0) + 1;
const regName = { G: 'grassland or forest', J: 'jungle', D: 'desert', H: 'highland' };
const gaps = ['# Gaps in the open world\'s art (generated by tools/worldgen.js; ' + new Date().toISOString().slice(0, 10) + ')', '',
  `${order.length} places from ${path.relative(repo, layoutPath)}, all on the \`${L.tileset}\` tileset: ` + Object.entries(regCount).map(([r, n]) => `${n} mostly ${regName[r] || r}`).join(', ') + '.', ''];
if (unnamed.length) gaps.push('## Places with no name of their own', '', unnamed.join(', '), '');
const spriteMiss = {};
for (const z of order) for (const d of Object.values(legendOf[z.key] || {})) { const s = typeof d.sprite === 'string' ? d.sprite : null; if (s && s !== 'none' && d.kind !== 'npc' && !(TS.props || {})[s]) (spriteMiss[s] = spriteMiss[s] || []).push(z.id); }
if (Object.keys(spriteMiss).length) gaps.push('## Sprites the tileset has no picture for (drawn as a stone block)', '', ...Object.entries(spriteMiss).map(([k, v]) => `- ${k}: ${v.join(', ')}`), '');
if (L.gaps) gaps.push('## Known kludges (from the layout\'s `gaps`)', '', ...L.gaps.map((g) => `- ${g}`), '');
fs.writeFileSync(path.join(path.dirname(layoutPath), path.basename(layoutPath).replace(/-layout\.yaml$/, '') + '-gaps.md'), gaps.join('\n'));

// ---- Preview: the world as one picture, and the data for the map page ------------------------------------------------------
// Preview colours: a ground letter's colour; the floor (`.`, the road) brown; a legend entry its ground's, a door red, a
// fight orange, a tree dark green.
const groundColour = (ch) => ch === '.' ? '#9a6a44' : (GROUND[ch] && GROUND[ch].color) || '#ff00ff';
const colour = (ch, z) => {
  const lg = z && legendOf[z.key] && legendOf[z.key][ch];
  if (lg) {
    if (lg.kind === 'stairs' && !lg.edge) return '#ff3030';
    if (['monster', 'chest', 'trap', 'note', 'npc'].includes(lg.kind)) return '#ff9020';
    if (lg.kind === 'prop' && lg.solid !== false && lg.sprite !== 'none') return '#1a3a18';
    return groundColour(lg.on || '.');
  }
  if (ch === '#') return '#6a6a6a';
  return groundColour(ch);
};
const pv = opt('--preview');
if (pv) {
  const buf = Buffer.alloc(GW * GH * 3);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const z = zoneAt(gx, gy); let hex = z ? colour(CH[I(gx, gy)], z) : '#1a2a40';
    if (z && (gx % N === 0 || gy % N === 0) && argv.includes('--grid')) hex = '#000000';
    const v = parseInt(hex.slice(1), 16), i = (gy * GW + gx) * 3; buf[i] = v >> 16; buf[i + 1] = (v >> 8) & 255; buf[i + 2] = v & 255;
  }
  fs.writeFileSync(pv, Buffer.concat([Buffer.from(`P6\n${GW} ${GH}\n255\n`), buf]));
}
const js = opt('--json');
if (js) {
  const palette = {}; const zonesOut = {};
  for (const z of order) { const zx0 = z.c * N, zy0 = z.r * N, rowsOut = []; for (let y = 0; y < N; y++) { let row = ''; for (let x = 0; x < N; x++) { const ch = CH[I(zx0 + x, zy0 + y)]; palette[z.key + ch] = palette[z.key + ch] || colour(ch, z); row += ch; } rowsOut.push(row); }
    const lg = {}; for (const [k, d] of Object.entries(legendOf[z.key] || {})) if (rowsOut.some((r) => r.includes(k))) lg[k] = [d.kind, d.label || d.sprite || ''];
    zonesOut[z.id] = { r: z.r, c: z.c, name: z.name, level: z.level, region: z.reg, rows: rowsOut, blurb: z.blurb, legend: lg, sites: sites.filter((s) => zoneAt(...s.g) === z).map((s) => s.id) }; }
  fs.writeFileSync(js, JSON.stringify({ N, cols, rows, lon0, lat0, step, palette, zones: zonesOut, sites: sites.map((s) => ({ id: s.id, at: s.at, g: s.g })) }));
}
console.log(`${order.length} places (${Object.entries(regCount).map(([r, n]) => n + ' ' + r).join(', ')}); ${roadsLaid} roads, ${carved} ways cut, ${filled} squares flooded, settled in ${settle} rounds, ${misfitLeft} cliff corners no tile fits${unnamed.length ? `, ${unnamed.length} places unnamed` : ''}`);
for (const [id, ms] of Object.entries(misfits)) console.log(`  ${id}: ` + ms.slice(0, 6).map((m) => `${m.x},${m.y} ${m.t} ${m.g.match(/..../g).join(' ')}`).join('; '));
console.log('recruits: ' + recruits.sort((a, b) => a.n - b.n).map((r) => `${r.n} ${r.place} [${r.at}]`).join('; '));
console.log('entrances: ' + sites.flatMap((s) => Object.entries(s.legend || {}).filter(([, d]) => d.kind === 'stairs').map(([k, d]) => `${zoneAt(...s.g).id} ${k} -> ${d.to}`)).join('; '));
