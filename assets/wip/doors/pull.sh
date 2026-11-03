#!/bin/sh
# Downloads each inpainted door in jobs.txt (name job) to out-<name>.png, skipping ones already there.
cd "$(dirname "$0")"
while read n id; do
  [ -z "$id" ] && continue
  [ -s "out-$n.png" ] && continue
  curl -sf -o "out-$n.png" "https://api.pixellab.ai/mcp/images/$id/download" || { rm -f "out-$n.png"; echo "not ready: $n"; }
done < jobs.txt
