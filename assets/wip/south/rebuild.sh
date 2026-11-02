#!/bin/sh
# Re-seeds the southern places' maps in data/places.yaml from layout.py, then squares off the corners the cliff sets
# can't draw (tools/squarewalls.js: the mountains, the forest and the fortress walls, each against grass), raises the
# mountains in rings (tiers.py) and squares those. Overwrites any hand edits to those maps.
set -e
cd "$(dirname "$0")/../../.."
python3 assets/wip/south/layout.py --write
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
for p in south_hills tarnhold tarnvale_west tarnvale_east; do
  for w in '#' '}' '@'; do square $p "$w" ,; done
done
# The mountains in rings (tiers.py), each squared against the one below.
python3 assets/wip/south/tiers.py
for p in south_hills tarnhold tarnvale_west tarnvale_east; do
  square $p '(' '#'; square $p '?' '('
done
