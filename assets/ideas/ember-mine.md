# Prototype dungeon 2: the fire-goblin mine

From the user's voice memo of 2026-10-31 (transcribed by speech-to-text; quoted where the wording matters, the
transcription's slips noted). "It's gonna be based off" a classic fire-goblin zone; "Won't use any of the names. The
setting will be different, but as a tutorial dungeon, I like that to be an option as well." Built 2026-10-31 as eight
places in `data/places.yaml` (ids `ember_*`), laid out by `assets/wip/ember/layout.py` and seeded into the YAML by
`assets/wip/ember/places.py`. Reached from town ("The fire-goblin mine") or from the title screen's second quick
start (`start.yaml starts`).

## 1. What the memo asks for, and where it is

| The memo | Where it is built |
|---|---|
| "tunnel of basalt rock. You're faced with a [winding] stair. That goes forward. You're facing north." | `ember_hall`: the stair (`/`, two squares wide) climbs north from the way in at the south edge |
| "curves west before curving again east ... where it curves to the west, there is a murder hole, goblins on the other side" | the west leg runs under the gallery's south wall; the murder hole (`'`) is in that wall, two goblin archers and a spear behind it |
| "When it curves back east, you go up the stair through a swinging axe trap to the room where the goblins are staring through the hole" | the east leg narrows to one square through a slot with a blade trap (`A`, CON 2), then drops into the gallery |
| "raised high above lava. Lava beneath you." | the gallery is a shelf round a hole onto lava; the way on is a one-square ledge down its east side (a shove there is into lava) |
| "you enter a wide open space ... a [gate] to the north, Portcullis that leads into the goblin castle. There's a tunnel to the east that leads deeper down to [the dragon's] lair, and there is a small tunnel to the west" | the great hall, 26×25, columns and two lava pools; gate court and portcullis north; the east tunnel ends at a marker (the lair is not built) |
| "going to the west, there's a secret wall. To the north that connects to the other side of the portcullis" | a seam (`S`, TN 10) in the west tunnel's north wall; the passage behind it comes out in the castle's entrance hall, inside the portcullis |
| "There's a small chamber ... westward, go down ... you enter a large area, and there's [lava] everywhere. And small stones that can be walked upon to cross it." | the small chamber at the tunnel's west end, steps down to `ember_lake`: an oval of lava crossed by a one-square path of stones to an island (a chest, two fire elementals) and on to the north shore |
| "right after the secret door, moving north towards the castle, there's a bridge over the lava ... to the other part of the goblin realm ... the active mining areas" | the bridge (`)`) north over a lava channel just west of the seam, to `ember_warrens` |
| "The mining areas are warren, small tunnels, and a few secret passages. There are several connections down to [the lava lake] ... The warrens also empty out towards that large lava chamber. And a couple of places." | `ember_warrens`: a winding maze of two-square tunnels with loops, three seams where they save the most walking, two ways down to the lake |
| "a far north extent of this ends in another built and inhabited area, which is basically the goblin barracks" | the barracks gate at the warrens' north edge, to `ember_barracks` (grey masonry: drill hall, bunks, mess, armory, captain) |
| "There is a trap, pit, as you fall in, you face the [efreeti] Lord, with 2 ... fire elementals ... If you fall in, there is a secret passage back up. Uh, into the goblin warren." | a hidden false floor (`T`) on the north-east run towards the barracks drops the party into `ember_pit` (efreet lord, two fire elementals); a seam in the pit wall leads to a stair back up, which comes out behind a seam in the warrens |
| "an east passage. That leads to [a] lava chamber, but here there is a bridge ... [the] gnome castle. Guarded by a troop of gnomes who are also mining this area and are at war with the goblins. But they are cut off from the surface" | the warrens' east passage to a lava chasm and a bridge; a gnome patrol holds the bridgehead (they can be talked round), and across it `ember_gnomes` |
| "a fire Drake ... that patrols the goblin mining [warren] tunnels. Never entering the barracks" | the red drake: one placed in the warrens and in its wandering table; the barracks is a separate place it never appears in |
| "The North pass leads to the goblin castle. With the portcullis. Get either battle guards at the [portcullis] or find the secret pass." | beating the gate guards (`ember_gate_won`) lets you work the outer winch; the winch inside (a note, `ember_winch`) raises it for good; it can also be forced (TN 15, loud) |
| "the gray minestone. The masonry, as opposed to the black basaltic tunnels ... Same kind of gray stone, as used in the barracks, distinct from the darker gray, mottled stone used in the castle of the gnomes" | three tilesets: `ember_basalt` (tunnels, lava), `ember_masonry` (castle, barracks, jail), `ember_gnome` (the fort) |
| "go west, into sort of living segment, where there's a bar, sleeping chambers, studies, map chambers" | `ember_castle` west wing: a long hall with the bar, sleeping rooms, a study (a book of fire words) and the map room (a note that gives away both seams) |
| "or you can go east, front room. The king and his champions dwell, there is a secret passage in the eastern way, [that leads] to the back of the throne where the king's quarters are. If you miss that secret passage in the east, it looks like a dead end, and you turn north, and by going north, you come to the front of the throne. The whole castle makes sort of loop." | east wing: the champions' front room; a short passage from it ends in a seam (`Z`, TN 11) into the king's rooms behind the throne; the way north runs to the throne room's east door. The west wing comes round to its west door |
| "opposite, the throne room, east, the other side, the high shaman's chambers" | across the passage east of the throne room |
| "There are also stairs north of the throne that lead down to the goblin's jail. [And] torture rooms. If you go down from there, you're, again, entering [the dragon's] lair." | `ember_jail`: five cells (a gnome prisoner in one), two question rooms, and a stair down that ends at a marker |

Not built: the dragon's lair below (two markers point to it, from the hall's east tunnel and the jail).

### The Cinder Hall redrawn (the user, 2026-11-06)

The hall no longer follows the memo's first rows (winding stair, gallery over lava, great hall). It is the flame
goblins' half of the goblin map on page 12 of the EverQuest d20 adventure *Solusek's Eye* (G-1 to G-13), traced by
`assets/wip/ember/hall/` (its README maps each key to the hall). The PDF is in `docs/reference-adventures/`, which
is gitignored. What carried over from the memo: the blade trap on the stair down, the murder hole (now in G-1's east
wall), the portcullis with its guards and winch (the gate court, G-13, south end), a seam to inside the portcullis
(now behind the baron's throne, G-12), the ways on to the warrens (G-11, the mines), the lava lake (G-6's bridge post)
and the deep lair (G-10's). The castle behind the portcullis stays as built; it stands in for the inferno goblins' half.
`rebuild.sh` would overwrite it with the old layout: don't run it on `ember_hall`.

## 2. Engine additions (2026-10-31)

- Ground letters (`rules.yaml game.ground`): `$` lava (no walking into it; in a fight, terrain `lava`: Fire 6 on entering
  and at each round's end, `deadly` so the AI never steps in), `)` a stone bridge over lava, `/` cut stair steps,
  `'` a murder hole (no walking; sight, missiles and reach pass; terrain `bars`). `!` was the first choice for lava,
  but the retired test maps use it as a legend letter.
- `locked` takes `see: true` (a portcullis: shut but not opaque; in a fight it is bars, not a wall) and `opensWhen`
  (a condition that raises it, e.g. a winch's flag).
- A `trap` with `to` and `at` is a pit: when it springs, the party falls to that place.
- `start.yaml starts`: the title screen's quick-start buttons, one per dungeon.

Lava is PROVISIONAL (`src/rules/config.js`): whether a shove into lava should kill outright, and whether standing
beside it should scorch (`near`, as the wall of fire does), are open.

## 3. Who lives here

All new monsters are in `data/monsters.yaml` after the comment "The fire-goblin mine". Encounter sizes are first
guesses: **encounter tuning is deferred** (CLAUDE.md), so no sims have been run against them.

| Creature | Key | Art now | Wanted from the user |
|---|---|---|---|
| Fire goblin (spear), fire goblin archer | `fireGoblin`, `fireGoblinArcher` | the orange goblin (walk, claw strike, death, idle) | a goblin with a spear, a bow |
| Goblin miner | `goblinMiner` | the green goblin | a goblin with a pick |
| Goblin warrior (barracks, castle) | `goblinWarrior` | the orange goblin, a little larger | a goblin in mail with sword and shield |
| Goblin shaman, high shaman | `goblinShaman`, `goblinHighShaman` | orange goblin; the mummy lord | a goblin shaman; the high shaman |
| Goblin champion | `goblinChampion` | the orc warrior | (the orc warrior may do) |
| The goblin king | `goblinKing` | the orange goblin at 1.25× | the king |
| Red drake | `redDrake` | Singe (bite and death added) | — |
| Fire elemental | `fireElemental` | the golem in fire colours (`fire-elemental`) | a fire elemental |
| The efreet lord | `efreetLord` | the avatar in fire colours (`efreet`) | the efreet |
| Gnome warrior; the warden, a sergeant, a prisoner | `gnomeWarrior`; `gnome_warden`, `gnome_sergeant`, `gnome_prisoner` | the bald old man at 0.8× | gnomes (warrior, elder) |

Factions: `cinder_goblins` (hostile on sight) and `deep_gnomes` (start neutral), enemies of each other. The gnomes are
the dungeon's social setting: the patrol at the bridge lets you by if you convince Sergeant Brask you are no friends of
the goblins (that also opens the fort's gate), the warden gives the quest `ember_king` and tells you where both seams
are, and freeing Fennick from the jail pays in gold and standing.

## 4. Tiles to generate (PixelLab, 64 px, as the temple's were)

| Tileset | Terrains | Pieces and props |
|---|---|---|
| `ember_basalt` | basalt floor ↔ black basalt wall (cliff set, 25 tiles); lava ↔ basalt floor (the floor's edge a crusted lip); stone bridge deck over lava; stair steps | rubble, ore veins and glowing cracks for the wall faces, the murder hole, the blade slot, mine carts and rails, timber props |
| `ember_masonry` | grey mine-stone flagstones ↔ grey masonry wall | portcullis, throne, dais, bar counter, bunks, tables, map table, braziers, cell doors, racks, the winch |
| `ember_gnome` | dark mottled stone floor ↔ wall | forge, bunks, gate |

## 5. Status and next

- [x] Maps, legends, encounters, monsters, factions, people and the quest; validator, tests and the corner check pass.
- [ ] Tilesets (§4), then a look at each place in headless Chrome.
- [ ] `node tools/pace.js` on the eight places (a thorough look should take about a day).
- [ ] The user's figures (§3).
