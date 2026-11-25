# The W1 cells extract (assets/world/w1-cells.csv) from the reference world's GeoPackage, which is kept out of git
# (docs/reference_world/, 446 MB): the 0.5-degree cells over W1 with what tools/worldgen.js reads.
#   python3 tools/w1cells.py [docs/reference_world/wp16_seed103/world_v2.gpkg] [assets/world/w1-cells.csv]
# Columns: row, col, lon, lat; land; elev (km); biome (the climate model's: G grassland, J jungle, F temperate forest,
# D desert, blank for sea); strahler, flow_to (the cell downstream), lake, swamp (set on lake cells), relief (local
# relief, km); q (discharge, m3/s); arid (precipitation over potential evaporation: below 0.2 arid, 0.2-0.5 semi-arid,
# above 1 wet); temp (mean, C).
import sqlite3, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else 'docs/reference_world/wp16_seed103/world_v2.gpkg'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'assets/world/w1-cells.csv'
ROWS, COLS = (136, 239), (124, 251)
BIOME = {'Grassland': 'G', 'Jungle': 'J', 'Temperate forest': 'F', 'Desert': 'D', 'Tundra': 'T'}
con = sqlite3.connect(SRC)
q = con.execute('select row, col, lon, lat, fic_land, fic_elev_km, syn_biome, syn_strahler, syn_flow_to, syn_lake, syn_swamp, '
                'syn_relief_km, syn_discharge_m3s, syn_aridity, syn_temp_c from cells where row between ? and ? and col between ? and ? '
                'order by row, col', (*ROWS, *COLS))
from decimal import Decimal, ROUND_HALF_UP
# Rounded half away from zero (0.125 to 0.13), as the first extract was.
num = lambda v, d: '' if v is None else str(float(Decimal(repr(float(v))).quantize(Decimal(10) ** -d, rounding=ROUND_HALF_UP)))
with open(OUT, 'w') as f:
    f.write('row,col,lon,lat,land,elev,biome,strahler,flow_to,lake,swamp,relief,q,arid,temp\n')
    for r, c, lon, lat, land, e, b, s, ft, lk, sw, rl, dq, ar, t in q:
        f.write(','.join([str(r), str(c), str(lon), str(lat), str(land or 0), num(e, 2), BIOME.get(b, '') if land else '""',
                          str(s or 0), str(ft if ft is not None else -1), str(lk or 0), str(sw or 0), num(rl or 0, 2),
                          '' if dq is None else str(float(round(dq))), num(ar, 2) if land else '', num(t, 1) if land else '']) + '\n')
