# Fetches the PixelLab tilesets in ids.txt into sheets/ (sheet and metadata). sh fetch.sh [name...]
cd "$(dirname "$0")"
while read n id; do
  [ $# -gt 0 ] && ! echo " $* " | grep -q " $n " && continue
  curl -sf -o sheets/$n.png "https://api.pixellab.ai/mcp/tilesets/$id/image?inline=true" && curl -sf -o sheets/$n.meta.json "https://api.pixellab.ai/mcp/tilesets/$id/metadata" && echo "$n ok" || echo "$n not ready"
done < ids.txt
