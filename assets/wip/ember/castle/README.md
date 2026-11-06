# The goblin castle's map (`ember_castle`)

The inferno goblins' half (G-13 to G-24) of the goblin map on page 12 of *Solusek's Eye* (the PDF is local only, in
`docs/reference-adventures/`). The west caves and the forge were traced (`trace.py`, as for the hall: see
`../hall/README.md`); the rest is drawn in `castle.py` from the gridded page: the trace merged G-21 into G-22 and the
page margin. Diagonal corridors are drawn square. One tile is a third of the map's 20-ft square.

    python trace.py /tmp/eq-012.png 25 330,1650,2290,3030 21 "69,24;56,26;50,45" "64,51,74,51" 0.11 > trace.txt
    python clean.py trace.txt > clean.txt
    python castle.py clean.txt > castle.txt      # reports unreachable squares

Then the corners were squared (`tools/squarewalls.js`, a wider search, a few by hand) and the seam into the king's
rooms moved to their west wall (a seam in a wall one square thick north-south can't be drawn). The YAML is now the
source.

| Map key | In the castle |
|---|---|
| G-13 Gateway | the way in from the portcullis (`S`), the secret door from the baron's seat (`Q`), guards (`g`), the lever (`w`) up the north-east corridor |
| G-14 Lugol's Bar | the bar (`b`, `B`, `t`) |
| G-15, G-17 Warrens | sleepers (`r`, `v`) |
| G-16 Prison Pits | pits (`p`), the stair down to the cells (`J`, `ember_jail`) |
| G-17a | the patriarch (`V`) |
| G-18 Goin's Forge | the forge (`F`), smiths (`f`), the lava flow under it |
| G-19 Goblin Wizard Hall | the high shaman (`x`), the book of fire-words (`y`), the slates that give away both seams (`m`) |
| G-20 Harvester Pit | the way to the deep lair (`D`, not built) |
| G-21 Occupied Guard Post | the guard post (`u`); tunnel C on to the gnome fort's east gate (`N`) |
| G-22 Inferno Champions | a champion (`c`) |
| G-23 Audience Chamber | the king (`k`) and his throne (`T`) |
| G-24 King's Chambers | bed (`e`), hoard (`H`), bodyguard (`q`); the seam (`Z`) from G-17's south lobe |
