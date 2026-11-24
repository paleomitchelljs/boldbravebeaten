# Tiles to Get — Burazese Continental Overhaul

Art needed for the continental map. Each entry notes priority, the tileset it belongs to,
PixelLab prompt guidance, and whether existing art can be adapted.

All tiles are 64×64 px to match the existing PixelLab pipeline.

---

## Available tilesets (what we have)

| Tileset | Dir | Covers |
|---|---|---|
| `outside_village` | `outside/` | Village buildings, paths, grass, trees |
| `grassland` | `highland/` | Grass, trail, road, sparse trees |
| `jungle` | `jungle/` | Jungle floor, canopy, marsh, swamp, trail |
| `cinder_hills` | `cinder/` | Ash, lava channels, volcanic rock |
| `desert` | `desert/` | Sand, mesa, oasis |
| `lakeland` | `tarn/` | Lake shore, water edge, grass |
| `south_hills` | `south/` | Forest, hills, mountains, grass |
| `tarnvale` / `tarnhold` | `vale/`, `tarn/` | Canyon, grassland, highland, fort |
| `orc_valley` / `orc_castle` / `orc_mine` | `orc/` | Orc fort, mine, valley |
| `ember_*` / `ember_basalt` | `ember/`, `cinder/` | Lava, basalt, citadel interiors |
| `temple_*` | `temple/` | Pyramid courts, walls, sewers, ritual chambers |

---

## 1. Continental road tiles — HIGH

The trade roads connecting cities. Needed for every overworld zone.

**New tileset: `road` (or extend `grassland`)**

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| Packed-earth road wang set | 16-tile corner set: packed brown-earth road over grass. Worn ruts, pebbles, sparse weeds at edges. | "Top-down pixel art, 64px tile, packed earth road, brown dirt, wheel ruts, grass border, fantasy RPG" | `grassland` has a trail; this needs to be wider (3+ squares) and more defined |
| Road over savanna | Same road wang but over tall dry grass instead of green. | "…dry golden grass border instead of green" | Recolour the grass-road set |
| Road over jungle | Packed earth / boardwalk road over jungle floor. | "…jungle undergrowth border, vines encroaching" | Adapt jungle trail tiles to wider road |
| Stone bridge (small) | 3×1 prop: stone arch bridge over a river or stream. Top-down. | "Top-down stone arch bridge, grey stone, pixel art, 3 tiles wide, water visible beneath" | None — new asset |
| Wooden bridge (small) | 3×1 prop: plank bridge over marsh or stream. | "Top-down plank bridge, rough timber, rope rails, pixel art" | None |
| Crossroads marker | 1×1 prop: a stone milestone or waymarker. | "Top-down carved stone milestone, weathered, pixel art, fantasy RPG" | None |

---

## 2. City building tiles — HIGH

Each city needs buildings at the existing village scale. Three architectural styles needed.

### 2a. Lizardfolk buildings (Muawi, Zhomelonga)

**New tileset: `lizard_city`**

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| Reed-and-stone house (2×2) | Rectangular building, reed thatch roof over grey-green stone walls. | "Top-down pixel art building, reed thatch roof, stone walls, 128×128px, Mesoamerican-tropical style" | None |
| Stepped plaza (3×3 prop) | Raised stone platform with carved glyphs. | "Top-down stone plaza, stepped edges, carved serpent glyphs, pixel art" | Temple court paving, partially |
| Copper-roofed hall (3×2) | Long hall, greenish copper roof, stone pillars visible. | "Top-down pixel art hall, verdigris copper roof, stone columns, tropical" | None |
| Stone causeway | 1×1 tile: raised stone path over water/marsh. | "Top-down stone causeway, fitted blocks, dark water visible at edges" | Temple paving + water underneath |
| Market awning (2×1) | Open-sided market stall, cloth awning over baskets. | "Top-down market stall, cloth shade, baskets of fish, tropical pixel art" | None |
| Guard tower (1×1) | Small watchtower, stone base, reed roof. | "Top-down guard tower, stone and reed, pixel art" | None |

### 2b. Human buildings (Barjiy, Burbuma, Emagshir)

**New tileset: `human_city`**

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| Timber-frame house (2×2) | Plaster and timber walls, clay tile roof. | "Top-down pixel art building, timber-frame, white plaster, red-brown clay tile roof" | Outside village houses — recolour/reshape |
| Stone town wall segment | 1×1 wang-compatible: crenellated stone wall. | "Top-down castle wall, grey stone, crenellations, pixel art" | Orc castle walls, partially |
| Iron gate (1×1 prop) | Portcullis gate in a wall. | "Top-down iron portcullis gate, stone arch, pixel art" | None |
| Cathedral (4×3 prop) | Large stone building, tall peaked roof, rose window suggested. | "Top-down cathedral, grey stone, peaked slate roof, pixel art, fantasy medieval" | None |
| Market stalls (2×2) | Cluster of wooden market stalls, awnings, crates. | "Top-down market square, wooden stalls, awnings, crates, pixel art" | Outside village market, adapt |
| Stone forge (2×1) | Forge building with chimney smoke. | "Top-down blacksmith forge, stone walls, chimney, anvil visible, pixel art" | Brannock's forge sprite, adapt |

### 2c. Frontier/mixed buildings (Burbuma)

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| Wooden palisade | 1×1 wang-compatible: rough log palisade wall. | "Top-down wooden palisade wall, rough-hewn logs, pixel art" | None |
| Tent market (2×2) | Canvas tents over trade goods. | "Top-down tent market, canvas shelters, crates, barrels, frontier pixel art" | None |
| Frontier inn (2×2) | Rough timber building, porch, lantern. | "Top-down frontier tavern, timber planks, wide porch, lantern, pixel art" | Outside village inn, rougher |

---

## 3. Savanna / open grassland — MEDIUM

For zones between cities on the central plateau.

**Extend tileset: `grassland` or new `savanna`**

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| Tall-grass wang set | 16-tile corners: tall golden savanna grass over short green grass. | "Top-down tall golden grass, African savanna, pixel art, 64px tile" | Grassland grass — recolour to gold/amber |
| Acacia tree (1×2 prop) | Flat-topped acacia, casting a round shadow. | "Top-down acacia tree, flat canopy, golden grass, African savanna pixel art" | None — distinctive silhouette |
| Baobab tree (2×2 prop) | Massive thick-trunk tree. | "Top-down baobab tree, huge trunk, sparse canopy, pixel art" | None |
| Watering hole (2×2 prop) | Small muddy pond, animal tracks around it. | "Top-down watering hole, muddy water, animal tracks, dry grass, pixel art" | Lakeland water tiles, muddied |
| Termite mound (1×1 prop) | Tall red-earth termite mound. | "Top-down termite mound, red earth, tall cone, pixel art" | None |
| Herd animals (1×1 prop) | Small cluster of antelope/wildebeest shapes. | "Top-down herd of antelope, 3-4 animals, pixel art, golden grass" | None |

---

## 4. Lake shore — MEDIUM

For Lake Eseumbu and the Muawi zones.

**Extend tileset: `lakeland`**

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| Sandy shore wang set | 16-tile corners: sand beach over lake water. | "Top-down sandy beach, blue lake water, pixel art, 64px tile" | Desert sand + lakeland water edge — combine |
| Reed bed wang set | 16-tile corners: dense reeds/cattails over water. | "Top-down cattail reed bed, tall green reeds, dark water, pixel art" | Jungle marsh reeds — denser, standing water |
| Fishing boat (1×1 prop) | Small outrigger or dugout canoe, beached or in shallows. | "Top-down fishing canoe, wooden dugout, beached on sand, pixel art" | None |
| Wooden dock (2×1 prop) | Simple wooden pier extending into water. | "Top-down wooden dock, weathered planks, posts in water, pixel art" | None |
| Fishing nets (1×1 prop) | Nets drying on frames. | "Top-down drying fishing nets on wooden frames, pixel art" | None |

---

## 5. Marsh / deep swamp — MEDIUM

For the Eseumbu marshlands and temple swamp expansion.

**Extend tileset: `jungle` (or new `deep_swamp`)**

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| Deep swamp wang set | 16-tile corners: dark stagnant water with floating algae over murky ground. | "Top-down deep swamp, dark stagnant water, green algae, murky, pixel art" | Jungle marsh — darker, more stagnant |
| Dead tree in water (1×1 prop) | Bare grey trunk standing in swamp water. | "Top-down dead tree in swamp water, bare branches, grey bark, pixel art" | None |
| Floating log (1×1 prop) | Fallen log half-submerged, moss-covered. | "Top-down fallen log in swamp, moss-covered, half submerged, pixel art" | None |
| Plank walkway | 1×1 tile: rough wooden boards over swamp. Ground type with `under: true`. | "Top-down wooden plank walkway, rough boards, swamp water visible at edges" | None |
| Swamp gas (animated) | 1×1: green-yellow bubbles rising from water (4-frame). | "Top-down swamp gas bubbles, greenish, rising from water, pixel art, animation frames" | None |

---

## 6. Volcanic / caldera — LOW

For the Exeomo caldera zones. The existing `cinder_hills` and `ember_*` tilesets cover most needs.

**Extend tileset: `cinder_hills`**

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| Caldera rim edge wang set | 16-tile corners: dark volcanic rock dropping away to a lower basin. Looking down over the edge. | "Top-down caldera rim, dark basalt edge, drop-off visible, volcanic pixel art" | Cinder hills rock — add cliff edge treatment |
| Lava lake (animated) | Like existing lava animation but scaled for a wider body. Needs a 128×128 or 256×256 seamless sheet. | "Seamless top-down lava lake, glowing orange, slow-moving surface, pixel art" | Existing lava anim — scale up |
| Obsidian formation (1×1 prop) | Glossy black rock outcrop, angular. | "Top-down obsidian formation, glossy black angular rocks, pixel art" | None |
| Steam vent (animated, 1×1 prop) | White/grey steam wisps rising from a crack (4-frame). | "Top-down volcanic steam vent, white wisps from rock crack, pixel art, animation" | None |
| Ash dune wang set | 16-tile corners: grey volcanic ash over darker rock. | "Top-down ash dune, grey volcanic ash, dark rock beneath, pixel art" | Desert sand recoloured grey |

---

## 7. Ruins — MEDIUM

For ancient Lizardfolk/Froglok ruins scattered across the continent.

**New tileset: `ruins` (or extend `temple_court`)**

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| Cracked ancient paving | 1×1 tile: broken stone floor with grass/roots growing through. | "Top-down cracked stone floor, ancient, grass growing through cracks, pixel art" | Temple court paving — cracked version |
| Broken pyramid wall (1×2 prop) | Ruined stepped wall, overgrown with vines. | "Top-down ruined pyramid wall, broken steps, vine-covered, pixel art" | Temple wall art — damaged version |
| Fallen column (1×1 prop) | Toppled stone column, broken in sections. | "Top-down fallen stone column, broken sections, moss-covered, pixel art" | None |
| Carved glyph wall (1×1 prop) | Stone wall fragment with carved serpent/lizard reliefs. | "Top-down stone wall fragment, carved lizardfolk glyphs, weathered, pixel art" | None |
| Overgrown altar (1×1 prop) | Small stone altar, cracked, with vines and offerings. | "Top-down stone altar, cracked, vine-covered, old offerings, pixel art" | None |
| Ruin archway (1×1 prop) | Free-standing stone arch, partially collapsed. | "Top-down ruined stone arch, partially collapsed, ancient, pixel art" | None |

---

## 8. Desert / arid — LOW

For the dry central plateau. The existing `desert` tileset covers basic sand/mesa.

**Extend tileset: `desert`**

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| Dry grassland transition wang | 16-tile corners: brown dried grass over sand. The grass-to-desert transition. | "Top-down dried brown grass over sand, arid transition, pixel art" | Grassland grass recoloured brown + desert sand |
| Dried riverbed | 1×1 tile: cracked mud with exposed pebbles. | "Top-down dried riverbed, cracked mud, exposed stones, pixel art" | None |
| Sandstone wall segment | 1×1 wang: low sandstone wall/fort ruin. | "Top-down sandstone wall, desert fort, weathered blocks, pixel art" | Desert mesa tiles — shaped into walls |

---

## 9. River tiles — MEDIUM

For major rivers (Naalda, Muloenyo).

**New tileset: `river` (or animated terrain in existing sets)**

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| River water (animated) | Seamless animated water surface, 128×128 or 256×256, blue-green, visible current. | "Seamless top-down river water, blue-green, flowing current, pixel art" | Existing lake water anim — add current lines |
| River bank (grass) wang | 16-tile corners: grassy bank over river water. | "Top-down river bank, grass edge, brown earth, river water, pixel art" | Lakeland shore tiles — adapt |
| River bank (sand) wang | 16-tile corners: sandy bank over river water. | "Top-down sandy river bank, sand edge, river water, pixel art" | Desert + lakeland — combine |
| River ford | 1×1 tile: shallow crossing, stones visible under water. | "Top-down river ford, shallow water, stepping stones, pixel art" | None |
| River rapids (animated) | 1×1: white-water rapids (4-frame). | "Top-down river rapids, white water, rocks, pixel art, animation" | None |

---

## 10. Port / coastal — LOW

For Emagshir and any future coastal zones.

**New tileset: `port`**

| Tile | Description | Prompt guidance | Adapt? |
|---|---|---|---|
| Ocean water (animated) | Deep blue-green sea, slow rolling. | "Seamless top-down ocean water, deep blue, slow waves, pixel art" | Lake water — recoloured deeper blue |
| Harbour wall | 1×1 wang: stone harbour wall/breakwater. | "Top-down stone harbour wall, grey blocks, moored rope, pixel art" | None |
| Ship (3×2 prop) | Cargo ship docked, top-down. | "Top-down cargo ship, wooden hull, furled sails, docked, pixel art" | None |
| Warehouse (2×2) | Stone-and-timber warehouse building. | "Top-down warehouse, stone base, timber upper, loading doors, pixel art" | Human city buildings — dock variant |

---

## Priority summary

| Priority | Category | Tiles needed | Blocking? |
|---|---|---|---|
| **HIGH** | Continental road | ~6 assets | Yes — every zone uses roads |
| **HIGH** | City buildings (all 3 styles) | ~18 assets | Yes — cities need buildings |
| **MEDIUM** | Savanna grassland | ~6 assets | Recolour of grassland works as placeholder |
| **MEDIUM** | Lake shore | ~5 assets | Lakeland tileset works partially |
| **MEDIUM** | Marsh / deep swamp | ~5 assets | Jungle marsh works as placeholder |
| **MEDIUM** | Ruins | ~6 assets | Temple court works partially |
| **MEDIUM** | River | ~5 assets | Lake water works as placeholder |
| **LOW** | Volcanic / caldera | ~5 assets | Existing cinder_hills/ember covers most |
| **LOW** | Desert / arid | ~3 assets | Existing desert tileset covers most |
| **LOW** | Port / coastal | ~4 assets | Emagshir can use lakeland initially |

**Total new assets needed: ~63** (many can share sheets or be variants of existing art).
