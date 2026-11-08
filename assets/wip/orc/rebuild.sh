#!/bin/sh
# Re-seeds the orc valley's, castle's and caves' maps in data/places.yaml (layout.py, interiors.py), squares off the
# wall shapes the cliff sets can't draw (tools/squarewalls.js), raises the valley's mountains in rings
# (../south/tiers.py) and squares those, then puts Tarnhold's walkable levels back (heights.py; run it after
# ../tarn/rebuild.sh too). Overwrites hand edits to these maps.
set -e
cd "$(dirname "$0")/../../.."
python3 assets/wip/orc/layout.py --write
python3 assets/wip/orc/interiors.py --write
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
square orc_valley '#' ,
square orc_valley '▤' ,
square orc_valley '@' ,
square orc_castle '#' .
square orc_mines '#' .
python3 assets/wip/south/tiers.py orc_valley
square orc_valley '(' '#'; square orc_valley '?' '('
python3 assets/wip/orc/heights.py
