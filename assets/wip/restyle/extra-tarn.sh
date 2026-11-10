# Tarnhold and the desert onto the vale's ground (agent tarn, 2026-11-10). Run from the repo root, after build.py.
T=$(mktemp -d)
python3 tools/reground.py art/worldtiles/highland/plateau.png art/worldtiles/highland/gravel.png art/worldtiles/vale/gravel.png art/worldtiles/vale/tarn-shelf.png
python3 tools/reground.py art/worldtiles/highland/fort.png art/worldtiles/highland/gravel.png art/worldtiles/vale/gravel.png art/worldtiles/vale/tarn-fort.png
# The desert's foot (gravel over sand): its gravel is its own all-gravel tile (UUUU, col 0 row 3), not highland/gravel.png.
python3 -c "from PIL import Image; Image.open('art/worldtiles/desert/foot.png').crop((0,192,64,256)).save('$T/foot-uuuu.png')"
python3 tools/reground.py art/worldtiles/desert/foot.png $T/foot-uuuu.png art/worldtiles/vale/gravel.png art/worldtiles/vale/desert-foot.png
# Two rows of all-gravel variants (vale/gravel-1..8) below the 16 tiles, as river.png has.
python3 -c "from PIL import Image; d='art/worldtiles/vale/'; a=Image.open(d+'desert-foot.png').convert('RGBA'); b=Image.new('RGBA',(256,384)); b.paste(a,(0,0)); [b.paste(Image.open(d+'gravel-%d.png'%(i+1)).convert('RGBA'),((i%4)*64,256+(i//4)*64)) for i in range(8)]; b.save(d+'desert-foot.png',optimize=True)"
python3 tools/cutsheet.py --corners UULU,ULUL,LULL,UULL,LUUL,ULLL,LLLL,LLLU,ULUU,LLUU,LLUL,LULU,UUUU,UUUL,ULLU,LUUU,UUUU,UUUU,UUUU,UUUU,UUUU,UUUU,UUUU,UUUU art/worldtiles/vale/desert-foot.png
