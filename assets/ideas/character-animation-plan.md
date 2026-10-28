# Character fixes and animations for the temple dungeon (plan and log)

Started 2026-10-28 at the user's request. The user lifted the "never animate" rule for this plan only; making new
characters (`create_character`) is still off. Work it top to bottom. Tick each step, write what it actually cost
in the ledger, and commit after each character so the work can stop and pick up again at any point.

**Budget:** 265 generations at the start (not 300; `get_balance`). They refill 2026-11-24.

**Order (the user's):** Beren, Cyrus, Arvir, Spawnee, Jabiku, Lorc; then the lizardfolk (all but Lizardfolk_Alt2, the
armored knight), the Avatar of Fear, the golem, the alligator, the gorilla and the skeleton. For each one: fix the
sprites that would glitch (weapon errors first, then mirrored hands), then a strike, then one death sprite. Idles come
last, and only if generations are left.

## How

- **A fix to a walk direction:** v3 from the rotation (`action_description` "walking forward, <weapon> in right hand
  and <shield> on left arm kept in place", `frame_count` = the original's, `keep_first_frame: false`; 1 gen). The
  template walk was tried first for Beren and Cyrus and lost the shield or the sword again; v3 kept them every time.
  Then pad the frames to the original group's canvas (centred), make a lossless GIF (scratch `gif.py`), upload it
  (`get_upload_url`) and `save_to_asset` it into `character:<id>:<dir>:<walk group>`; delete the extra group; re-pull.
- **A bad frame or two at the end of a clip** (a smear, a turn to face the viewer): replace them with the clip's frame
  0 (the standing pose) the same way. Free.
  Until a fix lands, leaving a bad direction out of `art.yaml`'s `walks` makes the engine use the walk one step off.
- **Stray pixels** (specks, ghost tails, a lone shadow): fix them in the repo's PNGs by hand (free) and save them back
  with `save_to_asset` so a re-pull keeps them.
- **A strike:** v3, `action_description` for that character's weapon, 6 frames. Heroes get all 8 directions: a mirror
  swaps the weapon hand, which is the glitch we are fixing. Monsters without a weapon get 5 (S, SE, E, NE, N); the
  game mirrors the other 3 (`a clip missing a direction plays its mirror twin`). Try south first and look at it before
  doing the rest.
- **Death:** v3, south only, "collapses and falls to the ground, dead", 6 frames (1 gen). The last frame is the death
  sprite. The engine has no `death` clip yet (a fallen figure is a rotated idle); wiring it is step E below.
- **Idle:** template `breathing-idle` (4 frames, 1 gen a direction). Heroes 8 directions, monsters 5.
- After each character: `node tools/pixellab-pull.js <Folder>`, add the clip to `data/art.yaml`, update the
  README row in `art/characters/pixellab/README.md`, then run `node --test` and `node tools/validate.js` and commit.

## Inspection (2026-10-28, from contact sheets of every rotation and walk frame)

Hands: in a south view the right hand is on the viewer's left; SE has it on the viewer's left, NE and NW on the
viewer's right; in E and W views the weapon is in front.

| Character | Weapon errors | Mirrored hands | Specks | Verdict |
|---|---|---|---|---|
| Beren | none | walk SE and walk NW: sword and shield swapped (the rotations are right) | — | regenerate walk SE, NW |
| Cyrus | walk S frames 0-1: no cutlass; walk NE frame 3: hilt with no blade | walk NW: blade on the wrong side | — | regenerate walk S, NE, NW; south rotation from the others (the user) |
| Arvir | walk W frames 4-5: no sword | — | walk S frame 5: a smudge at the feet | regenerate walk W |
| Spawnee | — | walk SW: shield on the wrong side | — | regenerate walk SW |
| Jabiku | — | rotations SE, N, NW hold the staff in the left hand (S, SW, NE in the right) | — | N: mirror the N view (a robe from behind; free). SE, NW: one `edit_image` of both (10-25 gens), late |
| Lorc | — | — | — | nothing |
| Lizardfolk_Alt (Idle) | unarmed | — | walk S f3, SE f2, NW f3, SW f2 | hand fix |
| Dread shaman | — | staff hand changes as for Jabiku (SE, N, NW, and their walks) | — | low: an `edit_image` of the rotations, then new walks; 30+ gens, probably not this cycle |
| Lizardfolk_Varanus | unarmed | — | walk N f1: a ghost tail | hand fix |
| Lizardfolk_Warrior | unarmed | — | — | nothing (the south walk barely moves; known, leave it) |
| Avatar of Fear | unarmed | — | — | nothing |
| Golem | unarmed | — | walk N f0: a speck at the tail | hand fix |
| Alligator | — | — | SW rotation has a shadow, the others none | hand fix |
| Gorilla | — | — | walk N f2: a speck at the feet | hand fix |
| Skeleton | — | — | the N rotation and walk N have a shadow, the others none | hand fix |

## Steps (estimated cost in brackets)

### A. Priority characters
1. [x] **Beren**: walk SE, NW [2]; strike ×8, sword slash [8-16]; death [1].
2. [x] **Cyrus**: south rotation regenerated with the SE/SW views as reference (`edit_image`) [10-25]; walk S, NE, NW
   [3]; strike ×8, cutlass slash [8-16]; death [1].
3. [x] **Arvir**: walk W [1]; strike ×8, sword slash behind the shield [8-16]; death [1].
4. [x] **Spawnee**: walk SW [1]; strike ×8, curved-sword slash [8-16]; death [1].
5. [x] **Jabiku**: N rotation mirrored [0]; strike ×8, overhead staff blow [8-16]; death [1]. (SE/NW staff hand: step C.)
6. [x] **Lorc**: strike ×8, draw and loose an arrow [8-16]; death [1].

### B. Monsters (5 directions each, mirrored)
7. [ ] Specks and shadows by hand on Lizardfolk_Alt, Varanus, Golem, Alligator, Gorilla, Skeleton [0]. Moved to the
   end (after step 18): only Lizardfolk_Alt walk S frame 3 has a detached speck; the rest touch the figure or share its
   colours, so they need picking by hand, and none is a weapon or mirroring error.
8. [x] **Lizardfolk_Alt** (Idle): claw swipe ×5 [5]; death [1].
9. [x] **Dread shaman**: staff strike ×5 [5]; death [1].
10. [x] **Lizardfolk_Varanus**: bite-and-claw ×5 [5]; death [1].
11. [x] **Lizardfolk_Warrior**: the bite exists facing S; add SE, E, NE, N [4]; death [1].
12. [x] **Avatar of Fear** (128 px; 2-3 gens a direction): claw sweep ×5 [10-15]; death [2-3].
13. [x] **Golem** (80 px; one figure for clay, iron and stone): two-fisted slam ×5 [5-10]; death [1-2].
14. [ ] **Alligator** (quadruped template; has `attack`): attack ×5 [5]; death (v3) [1].
15. [x] **Gorilla** (80 px): pound ×5 [5-10]; death [1-2].
16. [ ] **Skeleton**: claw swipe ×5 [5]; death [1].

Estimated A+B: about 150-230.

### C. If generations are left (in this order)
17. [ ] Idles, breathing (heroes ×8, monsters ×5): Beren, Cyrus, Arvir, Spawnee, Jabiku, Lorc, then the monsters in
    the order above.
18. [ ] Jabiku SE/NW staff hand (`edit_image` of both) [10-25].

### D. Later (not this cycle)
- Dread shaman staff hand (rotations and walks).
- Lizardfolk_Alt2 (the knight): walk, strike, death. Left out on purpose (the user).
- Jabiku walk (has none).
- The rest of the library: Krump (walk or a clean hop, strike, death; the jump loses the sword), Crusader (walks,
  strike, death), Tevax (strike, death; may be regenerated), Raptor (to be regenerated), Bear (death), Warrior woman
  (death), Goblin green and orange (walks, strike, death), Gowra (walk, strike, death), Singe (flight N/S, strike,
  death), Snake person (walk, strike, death), Spectre (strike, death), Farmer and Old man (none needed).

### E. Engine
- [ ] A `death` clip in `art.yaml`: a fallen pixellab figure shows the clip's last frame (or plays it once as it falls)
  instead of a rotated idle.
- [ ] A longer lunge when a figure has a strike clip (the lunge is 400 ms; 6-9 frames flash by). Look in play.

## Ledger

| Step | Asked | Charged | Balance after | Notes |
|---|---|---|---|---|
| start | | | 265 | |
| Beren | walk SE, NW (template) | 2 | | shield lost; deleted |
| Beren | walk SE, NW (v3) | 2 | | good; saved into `Walking` |
| Beren | strike S (low sweep), strike S (overhead) | 2 | | kept the overhead one (`Strike2`) |
| Beren | strike ×7 more, SW re-rolled | 8 | | SW lost the sword in 2 frames; E last frame a smear, replaced by frame 0 |
| Beren | death S | 1 | | good first time |
| Cyrus | south rotation (`edit_image`, reference SW) | 10 | | good |
| Cyrus | walk S, NE, NW (template) | 3 | | S, NE good; NW lost the sabre |
| Cyrus | walk NW (v3) | 1 | | good |
| Cyrus | strike S ×2, strike ×7 more | 9 | | 2nd try kept the vest; NW, W last frame turned to face the viewer, replaced by frame 0 |
| Cyrus | death S | 1 | | good |
| Arvir, Spawnee | walk W, walk SW (v3) | 2 | | good; saved |
| Arvir | strike ×8, death | 9 | | all good first time |
| Spawnee | strike ×8, death | 9 | | all good first time (NW blade glows cyan: kept, she is a spellsword) |
| Jabiku | N rotation mirrored | 0 | | SE and NW are exact mirrors of SW and NE, so they stay left-handed until step 18 |
| Jabiku | strike ×8, death | 9 | | good; in W/NW/SW the staff swings behind him for a frame (a wind-up) |
| Lorc | strike ×8, death | 9 | | good first time |
| Lizardfolk_Alt | strike S (an orange club appeared), re-roll "bare-handed", ×4 more, death | 7 | | good after the re-roll |
| Dread shaman | strike ×5, death | 6 | | good; the staff keeps changing hands as in its standing views |
| Varanus | bite ×5, death | 6 | | good |
| Lizardfolk_Warrior | bite SE, E, NE, N; N re-rolled ("seen from behind"); death | 6 | | N first turned to face the viewer |
| Avatar of Fear | strike ×5 (3 a direction, 160-px canvas), death | 18 | | the S strike ends in a burst of fire at its fists: the user's call whether to keep it |
| Golem | slam ×5 (N cost 2), death, death re-rolled | 8 | | 1st death: a halo, no fall |
| Gorilla | strike S, re-roll, ×4 more, death | 7 | | 1st barely moved |
| Alligator | template `attack` S (it shrank sideways mid-clip; deleted), v3 bite S | 2 | | |
| Skeleton | claw S, SE, death | 3 | | |
