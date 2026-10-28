# PixelLab characters

One folder per PixelLab export: one subfolder per state of the character (PixelLab's "group"), each with `rotations/`
(standing views) and `animations/<name>/<direction>/frame_NNN.png`. Each folder's `metadata.json` also holds the IDs
and the prompts. To open one in PixelLab, go to `https://www.pixellab.ai/create-character/<id>`. The user makes and
animates these characters in PixelLab; Claude only downloads them and wires them into the game, except for the fixes and
animations in `assets/ideas/character-animation-plan.md` (the user, 2026-10-28).

**Fetching.** `exports.json` maps each folder to a PixelLab ID (one per group: the export holds every state).
`node tools/pixellab-pull.js` re-fetches them all, replacing the folders; `node tools/pixellab-pull.js Singe Gorilla`
fetches some; `node tools/pixellab-pull.js New_Folder=<id>` fetches one not yet listed (add it to `exports.json`
to keep it). It prints each state's animations, directions and frame counts, which is what `data/art.yaml` needs.
The PixelLab MCP's `list_characters` shows what is in the library. An export that holds two versions of one direction
(`east-0d05e068`, `east-22608964`) keeps the first as `east`.

Every character the user sends goes in this table, including any not yet in the game. Raptor is not in
`exports.json`: its folder holds a hand-redrawn tail (96-px canvas) the export lacks, and a re-fetch would lose it.

| Folder | `art.yaml` key | PixelLab ID | Size | Has | Still wanted |
|---|---|---|---|---|---|
| Alligator | `alligator` | 66466883-3daa-4483-95ee-579e697cd929 | 64 | idle ×8, walk ×4 dirs, bite ×5 (`Strike`, v3; the quadruped `attack` template shrank it mid-clip), death (south, lies flat) | — |
| Arvir | `arvir` | ee3ed543-32ad-49bd-b428-65c78341e629 | 64 | idle ×8, walk ×8 (6 frames; W redone 2026-10-28: the sword vanished), strike ×8 (`Strike`, 7 frames), death (south), idle anim ×8 (`Idle`, 5 frames, ping-pong) | — |
| Avatar_of_Fear | `avatar` | 87521e4a-f274-4ab8-a84a-08fed819a240 | 128 | idle ×8, walk ×8, strike ×5 (claw sweep; the south one ends in a burst of fire at its fists; 160-px canvas), death (south) | — |
| Bear | `bear` | c71b5d64-37ac-4f6d-b6c8-f9b2b3a9d922 | 96 | idle ×8, walk ×8, attack ×8 (9 frames); Run and Jump_Attack unused | death |
| Beren | `beren` | 7cd3c25e-88e8-43dd-b20f-e003b2c418de | 64 | idle ×8, walk ×8 (SE, NW redone 2026-10-28: hands had swapped), strike ×8 (`Strike2`, 7 frames), death (south), idle anim ×8 (`Idle`, 5 frames, ping-pong) | — |
| Crusader | `crusader` | 9b7d3dac-2b67-483e-a6e0-9c33ff0a7f2e | 64 | idle ×8, walk south only | walk in the other directions, attack, death |
| Cyrus | `cyrus` | 57400efc-503b-472e-8b97-3c1b38147ffa | 64 | idle ×8 (south regenerated 2026-10-28 from the SW view), walk ×8 (S, NE, NW redone: the sabre vanished or swapped hands), strike ×8 (`Strike2`, 7 frames), death (south), idle anim ×8 (`Idle`, 5 frames, ping-pong) | — |
| Farmer | `farmer` | 96889e20-bfd8-419f-aa01-ddec9e1b4590 | 48 | idle ×8 with an 8-frame idle animation, walk ×8 | — |
| Goblin | `goblin` (Idle, green), `goblin-orange` (Orange_skinned_gobli) | 71e3ab4e-d83b-410e-94de-8fb0493d200c (green), 6bee6343-c2f2-4333-8df8-a3dac88a705d (orange) | 64 | green: idle ×8; orange: idle ×8, walk north and south (6 frames) | walks, attack, death |
| Golem | `clay-golem`, `iron-golem`, `stone-golem` | 522fdcbf-daea-4936-ab74-a07a96189774 | 80 | idle ×8, walk ×8, strike ×5 (two-fisted slam), death (south, falls on its face) | — |
| Gorilla | `gorilla` | 4715ec68-7f75-4217-a783-6ae6ba7b20c5 | 80 | idle ×8, walk ×8, strike ×5 (overhead smash), death (south) | — |
| Gowra | `gowra` | c23f4935-af47-46d9-9898-6f583de25120 | 64 | idle ×8, a tail sway (9 frames) east, north, south, played standing and moving | walk, attack, death |
| Jabiku | `jabiku` | 0d63f08a-8af6-47e3-9294-3fc5c229d145 | 64 | idle ×8 (N mirrored 2026-10-28 so the staff is in the right hand; SE and NW still hold it in the left), strike ×8 (`Strike`, 7 frames), death (south) | walk, idle animation, SE/NW staff hand |
| Krump | `krump` | 1583e709-7b5c-4544-8c3f-beb640168735 | 64 | idle ×8; a 7-frame two-footed jump ×8 (not used: the sword vanishes in several frames) | walk (or a clean hop), attack, death |
| Lizardfolk_Alt | `lizardfolk-alt` (Idle), `dread-shaman` (Dread_shaman) | 5bbe8c27-f61a-4b38-a04b-2d8a7aa437b6, ecd357da-378c-4ce8-90c2-b9ca3886b301 | 64 | each idle ×8, walk ×8 (shaman 6 frames), strike ×5 (S, SE, E, NE, N; the west side mirrored; `Strike`, 7 frames: a claw rake, a staff blow), death (south) | idle animations; the shaman's staff changes hands between views |
| Lizardfolk_Alt2 | `lizardfolk-knight` | 418cefa3-69cf-4c05-b797-4b1cf7fd0760 | 80 | idle ×8 | walk, attack, death |
| Lizardfolk_Varanus | `lizardfolk-varanus` | d91406aa-b523-4a73-98f4-8da72da0f440 | 64 | idle ×8, walk ×8, strike ×5 (a bite, `Strike`), death (south) | — |
| Lizardfolk_Warrior | `lizardfolk-warrior` | 5a2d243e-b78f-4b46-9fa8-adbdc18edc92 | 64 | idle ×8, walk ×4 dirs (6 frames); bite (fighting_pose_head state, 80be2814-aa6b-4a37-85cb-6ac94fc9c8fa) S, SE, E, NE, N, 9 frames; death (south) | — |
| Lorc | `lorc` | 5cdcb694-3e2a-4aae-ae45-ebd006e2dbf7 | 64 | idle ×8, walk ×8, strike ×8 (bow draw and loose, `Strike`, 7 frames), death (south) | — |
| Old_Man | `old-man` | a754c86c-4b3e-4df3-bd60-ec66e9ed09d7 | 44 | idle ×8, walk ×8 (7 frames) | — |
| Raptor | `raptor` (not in `exports.json`) | b423209f-cb0e-48a5-bc26-4d5555b00696 | 96 | idle ×8 | walk, attack, death |
| Singe | `singe` | 7232310b-be96-49eb-8755-a1ba806f6427 (hovering), f5da2868-1795-42c6-993a-307c5220ede2 (flying) | 76 (flying 124×76) | hovering: idle ×8 with wingbeats ×8; flying: wingbeats east only (west mirrored) | flight north and south, attack, death |
| Skeleton | `skeleton` | 07ca48e9-30fe-4cdf-b513-b802a07fe1fd | 64 | idle ×8, walk ×8, claw ×5 (`Strike`), death (south: a heap of bones) | — |
| Snake_Person | `snake-person` | 9fe6b1b1-3788-4124-a6c2-acea96787303 | 80 | idle ×8 | walk, attack, death |
| Spawnee | `spawnee` | d8994796-4a0b-4c54-810d-5ce541e272d6 | 64 | idle ×8, walk ×8 (SW redone 2026-10-28: the shield had swapped sides), strike ×8 (`Strike`, 7 frames; the NW blade glows), death (south), idle anim ×8 (`Idle`, 5 frames, ping-pong) | — |
| Spectre | `spectre` | 046bf345-29ab-4e14-96a5-fcf1923f529d | 64 | idle ×8, float ×8 (9 frames; it plays standing too, `floats: true`) | attack, death |
| Tevax_Thaukori | `tevax` | 68625c81-093c-4ebc-bb30-5c72ac9fb6b3 (armed), 87ba5874-ad22-4b8a-ad46-cc4a1d4c254e (unarmed, not used) | 64 | idle ×8, walk ×6 dirs | attack, death |
| Warrior_Woman | `warrior-woman` | ab8eb5c0-22fd-4735-99ec-c4ac649879c7 (+ slash 8f00f35f, spell c8428b0b) | 64 (slash 80, spell 60) | idle ×8 with an idle animation, walk ×8, slash ×8 (9 frames); Run, Jump, Spell unused | death |

"Death" here means a single death sprite, not a full animation, unless the user asks for one. "idle ×8" means
standing views only; none of these has an idle animation yet.
