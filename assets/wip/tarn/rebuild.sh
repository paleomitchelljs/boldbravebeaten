#!/bin/sh
# Re-seeds Tarnhold's, the vales' and the grasslands' maps in data/places.yaml from layout.py, squares off the rock the
# cliff sets can't draw (tools/squarewalls.js), raises the mountains in rings (../south/tiers.py) and squares those.
# Overwrites any hand edits to those maps.
set -e
cd "$(dirname "$0")/../../.."
python3 assets/wip/tarn/layout.py --write
square() {  # place wall floor
  p=$1
  node tools/squarewalls.js $p "$2" "$3" > /tmp/sq_$p.txt
    python3 - $p <<'PY'
import sys
pid=sys.argv[1]
rows=[l for l in open(f'/tmp/sq_{pid}.txt') if l.startswith('    - "')]
p='data/places.yaml'; s=open(p).read()
i=s.index(f'\n{pid}:\n'); j=s.index('  map:\n',i)+len('  map:\n'); k=s.index('  legend:',j)
assert s[j:k].count('\n')==len(rows)
open(p,'w').write(s[:j]+''.join(rows)+s[k:])
PY
  rm -f /tmp/sq_$p.txt
}
for p in tarnhold tarnvale_west tarnvale_east; do square $p '#' ,; done
python3 assets/wip/south/tiers.py tarnhold tarnvale_west tarnvale_east
for p in tarnhold tarnvale_west tarnvale_east; do square $p '(' '#'; square $p '?' '('; done
