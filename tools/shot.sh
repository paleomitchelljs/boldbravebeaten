#!/bin/sh
# Screenshot the game in headless Chrome, after running some JavaScript in the page (BBB is the game).
#   tools/shot.sh out.png "Game.newGame(BBB.World.presetParty()); Game.travel({to: 'temple_court', arrive: '<'});"
# Serves this folder on port 8765 (starts a server if none is there) and writes _shot.html / _shot.js, removed after.
# Inside the script: Game = BBB.UI.Game. To show the whole map, mark it seen:
#   const ms = BBB.World.mapState(Game.world, Game.world.place); for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) ms.seen[x + ',' + y] = 1; Game.render();
set -e
out="$1"; js="$2"
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
curl -s -o /dev/null http://localhost:8765/index.html || { python3 -m http.server 8765 >/dev/null 2>&1 & sleep 1; }
printf 'setTimeout(() => { const Game = BBB.UI.Game; %s; Game.render(); }, 1500);\n' "$js" > _shot.js
{ cat index.html; echo '<script src="_shot.js"></script>'; } > _shot.html
prof="$(mktemp -d)"
"$CHROME" --headless=new --disable-gpu --user-data-dir="$prof" --window-size=1280,900 --virtual-time-budget=6000 --screenshot="$out" "http://localhost:8765/_shot.html" 2>/dev/null
rm -rf "$prof" _shot.html _shot.js
echo "$out"
