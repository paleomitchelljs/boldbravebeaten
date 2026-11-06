# The Cinder Hall's map

Traced from the goblin map (page 12) of the EverQuest d20 adventure *Solusek's Eye*, kept locally in
`docs/reference-adventures/` (gitignored). The hall is the flame goblins' half (G-1 to G-13); the inferno goblins'
half (the bar, the king) is `ember_castle`, behind the portcullis. One tile is a third of the map's 20-ft square.

    PDF=docs/reference-adventures/406881788-EverQuest-D20-Solusek-s-Eye.pdf
    pdftoppm -f 12 -l 12 -r 300 -png "$PDF" /tmp/eq          # -> /tmp/eq-012.png
    python trace.py /tmp/eq-012.png 25 > trace.txt            # needs numpy, scipy, Pillow
    python clean.py trace.txt > clean.txt
    python hall.py clean.txt > hall.txt                       # hand edits, legend letters; reports unreachable squares

Then paste `hall.txt` into `ember_hall.map` in `data/places.yaml`, run `node tools/squarewalls.js ember_hall` and
paste its rows, and fix the last few corners by hand (`node tools/walls.js ember_hall`). After that the YAML is the
source: the scripts are a record of how the map was made, not something to re-run over later edits.

| Map key | In the hall |
|---|---|
| G-1 The Winding Way Down | the way in (`<`), a stair with the blade trap, a ledge round a lava pool; the murder hole in its east wall |
| G-2 Bubbling Cavern | the first fight (`h`); the lava channel down its south side |
| G-3 Hidden Passage | a side duct out to the slopes (`H`), joining the duct from G-1 to G-11 |
| G-4, G-5 Flame Goblin Warren | the warren (`w`) |
| G-6 Bridge Guard Post (A) | the east post (`u`); the way down to the lava lake (`L`) |
| G-7 General Storage | the patrol (`p`), sacks, carts, tools |
| G-7a Guards' Chambers | two guards' caves (`x`, `y`) |
| G-8 Fungus Farm | fungus beds; the river along its south edge, bridged on the way to the gate court |
| G-9 Hall of the War-Priests | a shaman (`r`) |
| G-10 Bridge Guard Post (B) | the river post (`v`); the way to the deep lair (`D`, not built) |
| G-11 The Mines | miners (`m`); on into the warrens (`M`) |
| G-12 The Baron's Seat | the baron (`z`), a chest, and a seam behind the throne to the castle's inner hall (`S`, `Q`) |
| G-13 Gateway | the gate court, its guards (`G`) and the portcullis (`P`) into the castle (`K`) |
