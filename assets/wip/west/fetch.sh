# Fetches the PixelLab tilesets in ids.txt into sheets/ (sheet and metadata) and the map objects in objs.txt into
# props/. sh fetch.sh [name...]
cd "$(dirname "$0")"
while read n id; do
  [ $# -gt 0 ] && ! echo " $* " | grep -q " $n " && continue
  curl -sf -o sheets/$n.png "https://api.pixellab.ai/mcp/tilesets/$id/image?inline=true" && curl -sf -o sheets/$n.meta.json "https://api.pixellab.ai/mcp/tilesets/$id/metadata" && echo "$n ok" || echo "$n not ready"
done < ids.txt
while read n id; do
  [ $# -gt 0 ] && ! echo " $* " | grep -q " $n " && continue
  curl -sfL -o props/$n.png "https://api.pixellab.ai/mcp/map-objects/$id/download" && echo "$n ok" || echo "$n not ready"
done < objs.txt
