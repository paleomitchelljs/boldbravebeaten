#!/bin/sh
# Re-seeds the mine's places in data/places.yaml from layout.py and places.py, then squares off the wall corners the
# cliff sets can't draw (tools/squarewalls.js). Overwrites any hand edits to those places: only for early layout work.
set -e
cd "$(dirname "$0")/../../.."
python3 - <<'PY'
p='data/places.yaml'; s=open(p).read()
i=s.index('\n# ---- The fire-goblin mine'); open(p,'w').write(s[:i].rstrip('\n')+'\n')
PY
python3 assets/wip/ember/places.py >> data/places.yaml
for p in ember_hall ember_warrens ember_lake ember_pit ember_barracks ember_gnomes ember_castle ember_jail; do
  node tools/squarewalls.js $p > /tmp/sq_$p.txt
  head -1 /tmp/sq_$p.txt
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
done
