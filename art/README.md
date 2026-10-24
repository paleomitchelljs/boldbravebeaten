# art/: what the game draws

Everything here is loaded by the game as it stands; the Pages build publishes this folder as is. Raw packs, ideas and
work in progress go in `assets/` (the scratch pad), never here. The art to-do list is in `HANDOFF.md` (Art TODO).

| Folder | What | Read by | Source and licence | In git |
|---|---|---|---|---|
| `characters/pixelcrawler/` | Party figures, foes and the fallback for every creature: `<kind>_idle.png` (4 frames of 32 px), `<kind>_run.png` (6 frames of 64 px) | `src/ui/game/sprites.js` | Pixel Crawler (Anokolisa, free): use in any project, no resale of the art itself (`PIXEL-CRAWLER-TERMS.txt`) | yes |
| `characters/creatures/` | Creature sheets: `<key>-<anim>.png`, two frames side by side (idle, attack, walk, walk-up, walk-down, fly…) | `sprites.js` through `data/art.yaml` | Not recorded: **licence to confirm** | no (git-ignored) |
| `characters/pixellab/` | 8-direction characters made in PixelLab (idle rotations, 4-frame walks) | `sprites.js` through `data/art.yaml` (`type: pixellab`) | PixelLab output: **terms to confirm** | no (git-ignored) |
| `worldtiles/` | Dungeon tiles and props, 16-px cells: `tiles`, `props`, `furniture`, `esoteric` (Pixel Crawler); `chest`, `objects`, `gold`, `stairs`, `stairs_down`, `spikes`, `plate` (Cute Fantasy Dungeons) | `src/ui/game/mapview.js`, `tilemap.js` | Pixel Crawler (as above); Cute Fantasy is paid and may not be redistributed, even modified | Pixel Crawler yes; Cute Fantasy no |
| `items/` | Item icons (none yet) | — | — | — |
| `effects/` | Spell bolts and flashes: `<Colour> Effect and Bullet 16x16.png` | `mapview.js` (`FX_SHEET`) | Not recorded: **licence to confirm** | no (git-ignored) |

What isn't in git isn't on the published site: there the map draws the Pixel Crawler figure for every creature, plain
bolts for spells, and nothing for the Cute Fantasy props. `.gitignore` lists each such file or folder; once a licence is
confirmed, delete its line and commit the files.

Adding art: process it in `assets/wip/`, then put the finished sheet in the matching folder here, name it the way the
reader expects (above), add it to `data/art.yaml` if it is creature art, and record its source in this table.
