#!/bin/sh
# Screenshot the game in headless Chrome, after running some JavaScript in the page (BBB is the game).
#   tools/shot.sh out.png "Game.newGame(BBB.World.presetParty()); Game.travel({to: 'temple_court', arrive: '<'});"
# SIZE=w,h sets the window (default 1280,900), e.g. SIZE=500,860 for a phone (headless Chrome will not go narrower than 500).
# CHROME=path picks the browser (default: Google Chrome on a Mac, else the pre-installed Chromium, else chromium on PATH).
# Serves this folder on port 8765 (starts a server if none is there). Its temporaries (a page and a script, named by
# the process id so shots can run side by side) go in tmp/shot/, which git ignores, and are removed after, even on a
# failure. The page carries <base href="/"> so it loads the game's files from the folder's root.
# Inside the script: Game = BBB.UI.Game. To show the whole map, mark it seen:
#   const ms = BBB.World.mapState(Game.world, Game.world.place); for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) ms.seen[x + ',' + y] = 1; Game.render();
set -e
out="$1"; js="$2"
cd "$(dirname "$0")/.."
if [ -z "$CHROME" ]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" /opt/pw-browsers/chromium "$(command -v chromium 2>/dev/null)"; do
    [ -n "$c" ] && [ -x "$c" ] && { CHROME="$c"; break; }
  done
fi
curl -s -o /dev/null http://localhost:8765/index.html || { python3 -m http.server 8765 >/dev/null 2>&1 & sleep 1; }
tmp=tmp/shot
mkdir -p "$tmp"
prof="$(mktemp -d)"
trap 'rm -rf "$prof" "$tmp/$$.html" "$tmp/$$.js"' EXIT
printf 'setTimeout(() => { const Game = BBB.UI.Game; %s; Game.render(); }, 1500);\n' "$js" > "$tmp/$$.js"
{ echo '<!doctype html>'; echo '<base href="/">'; tail -n +2 index.html; echo "<script src=\"$tmp/$$.js\"></script>"; } > "$tmp/$$.html"
"$CHROME" --headless=new --disable-gpu --no-sandbox --user-data-dir="$prof" --window-size="${SIZE:-1280,900}" --virtual-time-budget=6000 --screenshot="$out" "http://localhost:8765/$tmp/$$.html" 2>/dev/null
echo "$out"
