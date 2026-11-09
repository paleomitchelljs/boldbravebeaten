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
| Alligator | `alligator` | 66466883-3daa-4483-95ee-579e697cd929 | 64 | idle ×8, walk ×4 dirs, bite ×5 (`Strike`, v3; the quadruped `attack` template shrank it mid-clip), death (south, lies flat), idle anim ×5 (`Idle`, ping-pong; the west side mirrored) | — |
| Arvir | `arvir` | ee3ed543-32ad-49bd-b428-65c78341e629 | 64 | idle ×8, walk ×8 (6 frames; W redone 2026-10-28: the sword vanished), strike ×8 (`Strike`, 7 frames), death (south), idle anim ×8 (`Idle`, 5 frames, ping-pong) | — |
| Avatar_of_Fear | `avatar` | 87521e4a-f274-4ab8-a84a-08fed819a240 | 128 | idle ×8, walk ×8, strike ×5 (claw sweep; the south one ends in a burst of fire at its fists; 160-px canvas), death (south), idle anim ×5 (`Idle`, ping-pong; the west side mirrored) | — |
| Bear | `bear` | c71b5d64-37ac-4f6d-b6c8-f9b2b3a9d922 | 96 | idle ×8, walk ×8, attack ×8 (9 frames); Run and Jump_Attack unused | death |
| Beren | `beren` | 7cd3c25e-88e8-43dd-b20f-e003b2c418de | 64 | idle ×8, walk ×8 (SE, NW redone 2026-10-28: hands had swapped), strike ×8 (`Strike2`, 7 frames), thrust ×8 (`Thrust`, 7 frames), death (south), idle anim ×8 (`Idle`, 5 frames, ping-pong) | — |
| Crusader | `crusader` | 9b7d3dac-2b67-483e-a6e0-9c33ff0a7f2e | 64 | idle ×8, walk south only | walk in the other directions, attack, death |
| Cyrus | `cyrus` | 57400efc-503b-472e-8b97-3c1b38147ffa | 64 | idle ×8 (south regenerated 2026-10-28 from the SW view), walk ×8 (S, NE, NW redone: the sabre vanished or swapped hands), strike ×8 (`Strike2`, 7 frames), thrust ×8 (`Thrust2`, 7 frames), death (south), idle anim ×8 (`Idle`, 5 frames, ping-pong) | — |
| Efreeti | `efreeti` | cd0f9ce3-7f31-4d98-a949-1b91b33ea660 | 64 | idle ×8, walk ×8 (template, 6 frames; unused since it floats), float ×5 (`Float`, v3, 9 frames: rises, arms folding; played ping-pong, moving and standing, `floats`; E re-rolled: rings of fire round the legs), flaming punch ×5 (`Strike2`, v3; the first `Strike` had a shapeless smoke frame and was deleted), death (south, into embers) | — |
| Fae_Drake | `fae-drake-pl` (the `faeDrake` familiar) | 6fac4d64-c508-4cc1-8a86-a84d7fbd29f7 | 64 | idle ×8, hover ×5 (`Hover`, v3, 8 frames; played standing and moving, `floats`), bite ×5 (`Strike`, v3), the user's south idle (`Idle`, unused), death (south: wings fold, it drops; 2026-11-08) | — |
| Farmer | `farmer` | 96889e20-bfd8-419f-aa01-ddec9e1b4590 | 48 | idle ×8 with an 8-frame idle animation, walk ×8 | — |
| Goblin | `goblin` (Idle, green), `goblin-orange` (Orange_skinned_gobli) | 71e3ab4e-d83b-410e-94de-8fb0493d200c (green), 6bee6343-c2f2-4333-8df8-a3dac88a705d (orange) | 64 | each: idle ×8, walk ×8 (6 frames), claw strike ×5 (`Strike`), idle anim ×5 (`Idle`, ping-pong), death (south) | — |
| Goblin_Shaman | `goblin-shaman` (with_lava-orange_red; the high shaman) | 627a7f10-8fd8-4e6d-9312-50a2a19c6f4a (orange), 07c1a3b3-699d-4312-883d-142ae5654c4f (Idle, green, unused) | 64 | orange: idle ×8, walk ×8 (template, 6 frames), fire cast ×5 (`Strike`, v3; a staff appears in the north one), death (south), idle anim ×5 (`Idle`, template, ping-pong; 2026-11-08) | — |
| Goblin_Warlord | `goblin-warlord` (Lava-orange-red_skin; the goblin champion) | 1e16ff39-5552-443a-b8c8-a6b7672818c8 (orange), 5dfe600c-bf88-41ae-b4ef-840be0b5f591 (Idle, green, unused) | 64 | orange: idle ×8, walk ×8 (template; SE, E, NW redone in v3, which kept the halberd), halberd chop ×5 (`Strike`, v3), death (south), idle anim south (`Idle`); idle anim SE, E, NE, N added in v3 (2026-11-08), so ×5 | — |
| Imp | `imp` | 3537fcaf-3af1-438a-83f8-5552bd3cd4b3 (hovering), e4260d30-3056-44c5-8c6f-2f76e235b7d8 (Idle, standing, unused) | 60 | hovering: idle ×8, wingbeat ×5 (`Hover`, 9 frames; the user's south, the rest v3; played standing and moving, `floats`), claw rake ×5 (`Strike`), death (south, drops out of the air) | — |
| Lava_Beetle | `lava-beetle` | 527e6e91-d53f-4c61-91e9-44c57a563d8d | 64 | idle ×8, scuttle ×5 (`Walk`, v3, 6 frames; E re-rolled: the shell flashed white), bite ×5 (`Strike`; N re-rolled, still shows a mouth on the back of the head for 3 frames), death (south, slumps and goes dark; the first sprang back to life on its last frame) | — |
| Fire_Elemental | `fire-elemental` | 207828df-e444-44ed-9ae8-45cb67db63e8 | 64 | idle ×8, flicker ×5 (`Flicker`, 9 frames; played standing and moving, `floats`), flaming punch ×5 (`Strike`; the first dissolved into a blob), death (south, burns out to a dark husk) | — |
| Giant_Bat | `giant-bat` (the dusk bat) | 281d2697-32ed-4727-b62c-3a991b232174 | 56 | idle ×8, wingbeat ×5 (`Fly`, 9 frames, `floats`; barely flaps facing S and N), bite ×5 (`Strike`; N frames 3-4 flashed white: patched with frames 2 and 5 in the repo, a re-pull brings them back), death (south) | — |
| Black_Widow | `black-widow` (the giant spider) | 81df4955-0b39-497b-bec2-7cebd62dddf9 | 56 | idle ×8, crawl ×5 (`Walk`, 6 frames), bite ×5 (`Strike`; E and NE re-rolled: a fanged mouth grew on the abdomen; E frame 6 lost the hourglass: frame 0 in the repo), death (south, curls up) | — |
| Golem | `clay-golem`, `iron-golem`, `stone-golem` | 522fdcbf-daea-4936-ab74-a07a96189774 | 80 | idle ×8, walk ×8, strike ×5 (two-fisted slam), death (south, falls on its face), idle anim ×5 (`Idle`, ping-pong; the west side mirrored) | — |
| Gorilla | `gorilla` | 4715ec68-7f75-4217-a783-6ae6ba7b20c5 | 80 | idle ×8, walk ×8, strike ×5 (overhead smash), death (south), idle anim ×5 (`Idle`, ping-pong; the west side mirrored) | — |
| Gowra | `gowra` | c23f4935-af47-46d9-9898-6f583de25120 | 64 | idle ×8, a tail sway (9 frames) east, north, south, played standing and moving | walk, attack, death |
| Jabiku | `jabiku` | 0d63f08a-8af6-47e3-9294-3fc5c229d145 | 64 | idle ×8 (2026-10-28: N mirrored and SE, NW redrawn by `edit_image` so the staff is in the right hand throughout), strike ×8 (`Strike`, 7 frames), thrust ×8 (`Thrust2`, 7 frames: a jab, often with the butt), idle anim ×8 (`Idle`, 5 frames, ping-pong), death (south) | walk |
| Krump | `krump` | 1583e709-7b5c-4544-8c3f-beb640168735 | 64 | idle ×8; a 7-frame two-footed jump ×8 (not used: the sword vanishes in several frames) | walk (or a clean hop), attack, death |
| Lizardfolk_Alt | `lizardfolk-alt` (Idle), `lizardfolk-alt-purple` (recolour), `dread-shaman` (Dread_shaman) | 5bbe8c27-f61a-4b38-a04b-2d8a7aa437b6, ecd357da-378c-4ce8-90c2-b9ca3886b301 | 64 | each idle ×8, walk ×8 (shaman 6 frames), strike ×5 (S, SE, E, NE, N; the west side mirrored; `Strike`, 7 frames: a claw rake, a staff blow), death (south), idle anim ×5 (`Idle`, ping-pong; the west side mirrored) | the shaman's staff changes hands between views |
| Lizardfolk_Alt2 | `lizardfolk-knight` | 418cefa3-69cf-4c05-b797-4b1cf7fd0760 | 80 | idle ×8 | walk, attack, death |
| Lizardfolk_Varanus | `lizardfolk-varanus`, `-black`, `-brown` (recolours) | d91406aa-b523-4a73-98f4-8da72da0f440 | 64 | idle ×8, walk ×8, strike ×5 (a bite, `Strike`), death (south), idle anim ×5 (`Idle`, ping-pong; the west side mirrored) | — |
| Lizardfolk_Warrior | `lizardfolk-warrior`, `lizardfolk-warrior-tan` (recolour) | 5a2d243e-b78f-4b46-9fa8-adbdc18edc92 | 64 | idle ×8, walk ×4 dirs (6 frames); bite (fighting_pose_head state, 80be2814-aa6b-4a37-85cb-6ac94fc9c8fa) S, SE, E, NE, N, 9 frames; death (south), idle anim ×5 (`Idle`, ping-pong; the west side mirrored) | — |
| Lorc | `lorc` | 5cdcb694-3e2a-4aae-ae45-ebd006e2dbf7 | 64 | idle ×8, walk ×8, strike ×8 (bow draw and loose, `Strike`, 7 frames), death (south), idle anim ×8 (`Idle`, 5 frames, ping-pong) | — |
| Old_Man | `old-man` | a754c86c-4b3e-4df3-bd60-ec66e9ed09d7 | 44 | idle ×8, walk ×8 (7 frames) | — |
| Raptor | (none; replaced by Raptor_Red) | b423209f-cb0e-48a5-bc26-4d5555b00696 | 96 | idle ×8, its tail redrawn by hand (not in `exports.json`) | — |
| Raptor_Red | `raptor` | 650325f8-5760-4f60-a8e2-d476cf3ce77c | 76 | idle ×8, walk ×8 (v3, 6 frames), bite ×5 (`Strike`), idle anim ×5 (`Idle`, ping-pong), death (south) | — |
| Singe | `singe` | 7232310b-be96-49eb-8755-a1ba806f6427 (hovering), f5da2868-1795-42c6-993a-307c5220ede2 (flying) | 76 (flying 124×76) | hovering: idle ×8 with wingbeats ×8, bite ×5 (`Strike`), death (south); flying: wingbeats east only (west mirrored) | flight north and south |
| Skeleton | `skeleton` | 07ca48e9-30fe-4cdf-b513-b802a07fe1fd | 64 | idle ×8, walk ×8, claw ×5 (`Strike`), death (south: a heap of bones), idle anim ×5 (`Idle`, ping-pong; the west side mirrored) | — |
| Snake_Person | `snake-person` | 9fe6b1b1-3788-4124-a6c2-acea96787303 | 80 | idle ×8 | walk, attack, death |
| Spawnee | `spawnee` | d8994796-4a0b-4c54-810d-5ce541e272d6 | 64 | idle ×8, walk ×8 (SW redone 2026-10-28: the shield had swapped sides), strike ×8 (`Strike`, 7 frames; the NW blade glows), death (south), idle anim ×8 (`Idle`, 5 frames, ping-pong) | — |
| Spectre | `spectre` | 046bf345-29ab-4e14-96a5-fcf1923f529d | 64 | idle ×8, float ×8 (9 frames; it plays standing too, `floats: true`) | attack, death |
| Tevax_Thaukori | `tevax` | 68625c81-093c-4ebc-bb30-5c72ac9fb6b3 (armed), 87ba5874-ad22-4b8a-ad46-cc4a1d4c254e (unarmed, not used) | 64 | idle ×8, walk ×6 dirs | attack, death |
| Tylo (not pulled) | — | 8cc3c85c-2598-468a-a157-dc2b66ad4d20 | 48 | idle ×8 (the south view is wrong, the user says); a newt familiar to be | a fixed south view, animations |
| Warrior_Woman | `warrior-woman` | ab8eb5c0-22fd-4735-99ec-c4ac649879c7 (+ slash 8f00f35f, spell c8428b0b) | 64 (slash 80, spell 60) | idle ×8 with an idle animation, walk ×8, slash ×8 (9 frames); Run, Jump, Spell unused | death |
| Badger_Man (not pulled) | — | cd92ea30-98f4-40f8-a93d-1c3e781181d0 | 64 | idle ×8 (a badger-man in red armour) | walk, strike, death |
| Sorkvild (not pulled) | — | ea333085-05ad-46d0-87a1-25e8ab93fb8f | 64 | idle ×8 (Sorkvild the Raven) | walk, strike, death |
| Troll_Knight (not pulled) | — | c6d1d8ab-c1fe-427f-ae6b-3a3725bd5b72 | 76 | idle ×8 | walk, strike, death |
| Hooded_Knight | `hooded-knight` | e10aeecc-ba1a-4638-b6af-2deca4f9a7b3 | 72 | idle ×8, walk ×8 (v3), strike ×8 (overhead slash), death (south) | idle anim |
| Dragonborn_Scimitars | `dragonborn-blue` | 713108d2-cb1b-4c27-a1cb-917f3f3222c8 | 64 | idle ×8, walk ×8 (v3), strike ×8 (crossing double cut), death (south) | idle anim |
| Orc_Warrior | `orc-warrior` (the goblin champion's stand-in) | 3f1f5df5-eba7-4fb9-953c-105c2fc89645 | 64 | idle ×8, walk ×8 (v3), strike ×8 (falchion hack; NE and SE re-rolled), death (south) | idle anim |
| Mummy_Lord | `mummy-lord` (the high shaman's stand-in) | f9fecb8f-bc19-4202-ae6b-86fee3bc2a25 | 64 | idle ×8, walk ×8 (v3), strike ×8 (`Strike2`: staff blow; the first try lost the helm flames), death (south) | idle anim |
| Goblin_King | `goblin-king` (the goblin king) | d9d283b8-a1e4-42ba-a9ba-f5b9533f6aa7 | 64 | idle ×8 (the SW view holds no sceptre), walk ×8 (v3), sceptre blow ×8 (`Strike`; N, NW, SW re-rolled), death (south), idle anim ×8 (`Idle`, v3, ping-pong) | — |
| Orc_Emperor | `orc-emperor` (the orc emperor) | b7c6d615-f691-4ec9-8609-bdb9cf1f3cce | 64 | idle ×8, walk ×8 (v3), spear thrust ×8 (`Strike`; NW, W re-rolled), death (south), idle anim ×8 (`Idle`; S, W, NW template, the rest v3: the template dropped the spear) | — |
| Ambassador | `ambassador` (the orc emissaries) | cdb7a0a4-d335-4ed9-ade5-f406c2e5ac6a | 64 | idle ×8, walk ×8 (v3), curved-sword cut ×8 (`Strike`; E re-rolled twice, its last frame is frame 0 in the repo), death (south), idle anim ×8 (`Idle`, v3) | — |
| Orc | `orc-brute` (Idle), `orc-mail` (No_cape_chain_mail; the centurion) | 03d5d660-c9f6-4117-8f2a-c488908590db (Idle), 7e78d593-072c-4d6f-b71b-4a8ca2931305 (mail) | 64 | Idle: idle ×8, walk ×8, punch ×8, death. Mail: idle ×8, walk ×8 (template), punch ×5 (E re-rolled), death (south), idle anim ×5 (2026-11-08) | — |
| Gnome_Miner | `gnome-miner` (gnome warriors; the mine's gnome sergeant, eastwatch, prisoner) | 3447a6de-fb7e-409a-b9fd-debcaf0c6b9b | 48 | idle ×8, walk ×8 (v3), pick blow ×8 (`Strike`; SW re-rolled), death (south), idle anim ×8 (`Idle`, v3) | — |
| Gnome_Surveyor | `gnome-surveyor` (the gnome warden) | ea3a0442-51b3-45c1-ada3-ee0b08550cc0 | 48 | idle ×8, walk ×8 (template), shove ×5, death (south), idle anim ×5 | — |
| Gnome_Surveyor_2 | `gnome-surveyor-f` (Surveyor Wila, the gnome fort) | e7a9ea85-2193-49da-b049-b376e114bcf9 | 48 | idle ×8, walk ×8 (template), shove ×5, death (south), idle anim ×5 | — |
| Clockwork_Gnome | `clockwork-gnome` (the gnome fort's `clockworkGnome`) | 755ca151-d194-4b37-900e-fd41f26dd9ad | 48 | idle ×8, walk ×8 (template), punch ×5, death (south; re-rolled: the first stood still), idle anim ×5 | — |
| Clockwork_Spider | `clockwork-spider` (the gnome fort's `clockworkSpider`) | 5a5b4d35-ad15-40e5-911e-29202f4710db | 64 | idle ×8, scuttle ×5 (`Walk`, v3), bite ×5 (`Strike`), idle anim ×5 (`Idle`, v3) | death (three tries left it standing) |
| Sarnak, Sarnak_Ghost, Sarnak_Skeleton (not pulled) | — | 7d8ba5cb-483a-4796-928c-98455cf24704 (1 anim), 5774a17b-de11-47ec-ba45-57f8e441416a / 4d25d8de-1fdf-4dc1-b015-f85f540c8f80 (ghost states), 29d05620-5479-49e5-a07b-ed4e5294e78d | 80 | idle ×8 | walk, strike, death, idle |
| Burynai, Burynai_Warrior (not pulled) | — | f0d3f3ed-69ca-4949-9b32-8eb340257c20, a796dedb-4af9-4f9b-889b-4083167b40a8 | 64 | idle ×8 | walk, strike, death, idle |
| Daedroth (not pulled) | — | aa998ea1-a7a9-48f3-959b-e53ee8a6272b (Idle), 9702f39b-caa0-4ca0-bfcc-0b9003c54547, aeec61ad-6c73-41ca-8827-3eebedaae060 | 80 | idle ×8 (three states) | walk, strike, death, idle |
| Guar (not pulled) | — | 43677f20-f5f8-42f6-8628-86d34a54e44a (Idle, 64), bab1be58-3972-4bd3-b548-8cc09ba5183b (Walking, 100×68, 4 anims) | 64 | idle ×8 | strike, death, idle |
| Werewolf (not pulled) | — | a2128e45-abbf-495e-aa42-396ff854a60d | 64 | idle ×8, 1 anim | walk, strike, death, idle |
| Kregon (not pulled) | — | a43ef526-0f63-427a-a252-d9ce856ae42b | 56 | idle ×8 (a dwarf with a hammer) | walk, strike, death, idle |
| Nagafen | `dragon-lord` (the great red dragon) | 2fdfacac-bc68-4b29-8a4c-7b313c282a27 (Idle, 168), a1e0af1b-11c9-4db5-9fb8-8fc0885b2fce (Angry, 232×188) | 168 | Idle: idle ×8, walk ×5 (v3), death (south), idle anim ×5 (v3). Angry: fire breath ×5 (`Strike`, v3), played as the attack | — |
| Fire_Giant | `fire-giant` (Idle; giants, young giants at 0.8), `fire-giant-armored` (Armored; warriors, the warlord), `fire-giant-wizard` (Wizard; wizards, the magus), `fire-giant-king` (King) | 79f9a392-d83d-4f71-ac24-71390b90b341 (Idle), c657f92c-a502-4dc3-9ff7-ccdc2db9e984 (Armored), 95c9ba18-f70b-42d9-9663-e23f6020cd4a (Wizard), 893b7a2a-b4e7-4035-a4b8-9d16698cf230 (King) | 100 (states 128, 112, 128) | Idle: idle ×8, walk ×8, punch ×5, death, idle anim ×5. Armored, Wizard, King (states made 2026-11-08 at the user's word): each idle ×8, walk ×8, strike ×8, death, idle anim ×8 (the King's SE idle frames 0-1 patched in the repo) | — |

"Death" here means a single death sprite, not a full animation, unless the user asks for one. "idle ×8" means
standing views only; none of these has an idle animation yet.
| Kobold | `kobold-claws` (skin_patterned_with: `koboldWorker`), `kobold-spear` (holding_a_short_spea: `kobold`), `kobold-bow` (holding_a_bone_bow: `koboldHunter`) | d4bc847f-c8e0-459b-8776-861b927962ea (+ edfc7891 spear, ac10a069 bow) | 48 | each: idle ×8, strike (claws ×5; spear, bow ×8), walk ×8, death (south); idle anim (claws ×5 template, armed ×8 v3) | — |
| Kobold_Warrior | `kobold-warrior` (wearing_patchwork_br: `koboldWarrior`), `kobold-warrior-spear` (`koboldSpearman`), `kobold-warrior-bow` (`koboldHuntLeader`) | 20fd3de0-3dfb-4afc-a56d-47592d3bc3e5 (+ 0d0b2ef6 spear, 80653106 bow) | 48 | as Kobold | — |
| Kobold_Skirmisher | `kobold-champion` (wearing_mottled_leat, red hat: `koboldChampion`), `kobold-duelist` (wielding_a_bronze_ra, brown hat: `koboldDuelist`) | 0d373ddd-1578-4e22-8aeb-372973257432 (+ 23abdb68) | 48 | each: idle ×8, rapier lunge ×8, walk ×8, death, idle anim ×8 | — |
| Kobold_King | `kobold-king` (`koboldKing`) | 10c4d2fa-745d-4927-a41b-7534ea710f58 | 48 | idle ×8, axe chop ×8, walk ×8, death, idle anim ×8 | — |
| Kobold_Necromancer | `kobold-shaman` (`koboldShaman`, `koboldElder` and `koboldHighShaman` tinted) | e2f7275d-f09f-4c8a-a842-74c7d241390f | 48 | idle ×8, staff blow ×8, walk ×8, death, idle anim ×8 | — |
