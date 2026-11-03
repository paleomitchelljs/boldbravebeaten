#!/bin/sh
# Downloads every map object in ids.txt (name id) to props/<name>.png, skipping ones already there.
cd "$(dirname "$0")"
while read n id; do
  [ -z "$id" ] && continue
  [ -s "props/$n.png" ] && continue
  curl -sf -o "props/$n.png" "https://api.pixellab.ai/mcp/map-objects/$id/download" || { rm -f "props/$n.png"; echo "not ready: $n"; }
done < ids.txt
