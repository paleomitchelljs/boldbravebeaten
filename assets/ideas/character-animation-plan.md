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
14. [x] **Alligator** (quadruped template; has `attack`): attack ×5 [5]; death (v3) [1].
15. [x] **Gorilla** (80 px): pound ×5 [5-10]; death [1-2].
16. [x] **Skeleton**: claw swipe ×5 [5]; death [1].

Estimated A+B: about 150-230.

### C. If generations are left (in this order)
17. [x] Idles, breathing (heroes ×8, monsters ×5): Beren, Cyrus, Arvir, Spawnee, Jabiku, Lorc, then the monsters in
    the order above.
18. [x] Jabiku SE/NW staff hand (done before the monster idles: the user ranked mirroring above idles) (`edit_image` of both) [10-25].

### D. Later (not this cycle)
- Dread shaman staff hand (rotations and walks).
- Lizardfolk_Alt2 (the knight): walk, strike, death. Left out on purpose (the user).
- Jabiku walk (has none).
- The rest of the library: Krump (walk or a clean hop, strike, death; the jump loses the sword), Crusader (walks,
  strike, death), Tevax (strike, death; may be regenerated), Raptor (to be regenerated; wanted in the labyrinth, 2026-10-28: walk, strike, death, idle), Bear (death), Warrior woman
  (death), Goblin green and orange (walks, strike, death), Gowra (walk, strike, death), Singe (flight N/S, strike,
  death), Snake person (walk, strike, death), Spectre (strike, death), Farmer and Old man (none needed).

### E. Engine
- [ ] A `death` clip in `art.yaml`: a fallen pixellab figure shows the clip's last frame (or plays it once as it falls)
  instead of a rotated idle.
- [ ] A longer lunge when a figure has a strike clip (the lunge is 400 ms; 6-9 frames flash by). Look in play.

## Where it stands (2026-10-28, 5 generations left)

Steps A, B, 17 and 18 are done: every character on the list has its glitches fixed, a strike, a death and an idle,
wired in `data/art.yaml` and seen drawing in headless Chrome. Left, all free:
- Step 7 (specks): Lizardfolk_Alt walk S f3 (a detached speck), SE f2, NW f3, SW f2; Varanus walk N f1 (ghost tail);
  Golem walk N f0; Gorilla walk N f2. Fix in the PNGs and `save_to_asset` them back so a re-pull keeps them.
- Done: the shadows. The skeleton's N view, N walk, and the first frame of its N idle and strike drew a flat grey
  shadow (52,52,52) no other view has; the alligator's SW view had a heavy one (50,49,49; its south views keep their
  small jaw shadow, which every south clip shares). Cleared and saved back to PixelLab.
- Done: outline repair. The first `gif.py` used black for its transparent palette slot and let Pillow optimise, so on
  every frame after the first the figure's outermost pure-black outline rows and columns were dropped. That hit the
  saves of Beren's E strike and NW/SE walks, Arvir's W walk and Spawnee's SW walk (Cyrus's outline is not pure black,
  so his came through). The originals were gone; the outline was redrawn by rule (a black pixel beyond each edge
  pixel on the cropped sides; on intact frames this rule recovers ~86% of the outline) and saved back. Any future GIF
  must round-trip exactly before upload: the transparent slot is now magenta and `optimize=False`.
- For the user to judge: the Avatar's south strike ends in a burst of fire at its fists (no fire in its rules); Cyrus's
  strikes end on a frame where the blade looks doubled; the alligator's death lies flat rather than belly up; bodies
  lie about two squares long.
- Not this cycle (needs generations): the Dread shaman's staff hand (its SE, N, NW views and their clips; ~30 gens).

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
| Skeleton | claw ×5, death | 6 | | good |
| Alligator | bite SE, E, NE, N; N re-rolled; death | 6 | 116 | N first turned sideways mid-clip |
| Beren | idle S (v3, 4 frames + the standing view) | 1 | | good: a gentle breathing loop |
| Jabiku, Lorc | idle ×8 each | 16 | | good |
| Jabiku | SE, NW views (`edit_image`, 2 frames, 10); strike and idle SE, NW again (4) | 14 | ~60 | staff now in the right hand in every view; held across the body in those two |
| Monsters | idle ×5 each (Avatar 2 a direction) | 51 | 5 | all good; the skeleton's N idle starts on the standing view with the stray shadow (step 7) |
| Beren, Cyrus, Arvir, Spawnee | idle ×8 each (Beren's S above) | 31 | | all good; some drift (Cyrus's sabre sinks facing N): idles play ping-pong (`pingpong: true`) so they never jump |

## Cycle 2 (2026-10-31): the rest of the library and the user's four new characters

The user, 2026-10-31: "pick up generating the still missing animations from before as well as the animations for
these new characters." Balance at the start: 2190 generations (refill 2026-11-24). Same methods as above. Order, by
what the next dungeon (the fire-goblin mine, `assets/ideas/ember-mine.md`) needs first:

1. [x] Goblin, orange (the fire goblin) and green: walk ×8 (orange has N, S), claw strike ×5, death, idle ×5.
2. [x] Singe (the red drake): strike ×5 (bite), death. Flight N/S if the hovering wingbeat doesn't serve.
3. [~] The new four (the user's, 2026-10-31), each walk ×8 (v3), strike ×8, death, idle ×8:
   Hooded_Knight (e10aeecc, 72 px; sword and wolf shield), Dragonborn_Scimitars (713108d2; two scimitars),
   Orc_Warrior (3f1f5df5; falchion and skull shield), Mummy_Lord (f9fecb8f; bat-headed staff).
4. [ ] Section D, in its order: Dread shaman staff hand; Lizardfolk_Alt2 (walk, strike, death, idle); Jabiku walk;
   Krump (walk, strike, death); Crusader (walks, strike, death); Tevax (walk NE/NW, strike, death); Bear death;
   Warrior woman death; Gowra (walk, strike, death); Snake person (walk, strike, death); Spectre (strike, death).
   Raptor skipped: PixelLab's copy lacks the tail redrawn by hand in the repo; it waits on the user's regeneration.

### Ledger (cycle 2)

| Step | Asked | Charged | Balance after | Notes |
|---|---|---|---|---|
| start | | | 2190 | |
| Goblins (orange, green) | walk 6+8 (template), claw strike ×5 each, re-roll of orange S (drifted dark red; deleted), death ×2, idle ×5 each | 37 | | good; the strikes are a modest rake |
| Singe | bite ×5, death | 6 | | the bite is mostly wingbeat with a small snap |
| Hooded knight, dragonborn | walk S, strike S (each), knight death; knight walk ×7, strike ×3 | 15 | 2122 | walks shuffle but keep the weapons |
| Mine tiles (4 pro sets) | basalt, lava, masonry, gnome stone | 100 | | see assets/wip/ember/README.md (not character work, logged here for the balance) |
| Item icons | one 64-cell object sheet | 10 | | assets/wip/icons/README.md |
| Raptor_Red (the user's new raptor) | walk ×8, bite ×5, death, idle ×5 | 19 | | good; the south bite barely shows (seen head on) |
| Hooded knight | strike ×4 more | 4 | | good |
| Dragonborn | walk ×7, strike ×7, death | 15 | | walks shuffle; strikes cross the blades |
| Orc warrior | walk ×8, strike ×8, death | 17 | | NE strike turned the shield into a white disc and SE lost it: both re-rolled |
| Mummy lord | walk ×8, strike ×2 (the 1st lost its helm flames; deleted) then ×7, death | 17 | 1948 | |
| Outside (village, swamp, hills) | 3 pro tilesets, 24 props | ~115 | | assets/wip/outside/README.md (not character work) |
| Thrusts (the user, 2026-11-01: every non-archer hero a swing and a thrust) | Beren ×8 (`Thrust`; W re-rolled: the point went behind him); Cyrus S ×2 (1st raised the blade to the side and made it straight; deleted), ×7 (`Thrust2`; E, W re-rolled: blade drawn back); Jabiku S ×2 (1st swung the staff round and kept it level; deleted), ×7 (`Thrust2`) | 32 | | Jabiku jabs with the butt in SE, N, NW, SW, as the rules have it; Cyrus E frames 4-5 show the sabre in both hands for a moment |

| South, Tarnhold, grassland (not character work) | 18 pro tilesets, ~70 props, 4 object animations | ~610 | | assets/wip/south/, assets/wip/tarn/ |
| Tarnhold second pass, the orc valley (not character work, 2026-11-08) | 19 pro tilesets (one road re-rolled), 5 prop sheets | ~525 | 2117 | assets/wip/orc/ |

## Cycle 3 (2026-11-01): the recruits and the new creatures

The user, 2026-11-01: "the unused hero characters ... milling about in the starting town ... Some of them need more
animations. ... then I'd like the new creatures I've added to PixelLab to have animations added." All v3, 64-80 px.

| Step | Asked | Charged | Notes |
|---|---|---|---|
| Crusader | walk ×8 (6 frames), strike ×8, idle ×8, death | 25 | strike N frames 3-4 and SE 3 flashed white: patched with neighbouring frames in the repo |
| Kalavar (Orc_Warrior), Jadier (Dragonborn_Scimitars) | idle ×8 each | 16 | good |
| Venril | glide ×8 (its own idle was there), strike ×8, death | 17 | |
| Xalgoz, minotaur, hill giant, lizardfolk skeleton, wolf, lion, grizzly, orc, gnoll | death each | 9 | |
| Xalgoz | walk ×8 (its own south scary-walk kept), strike ×8 | 16 | strike N 3, S 3 and SE 4-5 flashed: patched |
| Minotaur | walk ×8, strike ×8 (fist and horns) | 16 | good |
| Hill giant | walk ×8, strike ×8 (both fists: they swelled into red mitts; kept in the folder, unused), sweep ×8 (`Sweep`, used) | 24 | |
| Lizardfolk skeleton | walk ×8, strike ×8 | 16 | good |
| Grey wolf | trot ×8, bite ×8 | 16 | good |
| Lion | walk ×8, pounce ×8 | 16 | good |
| Grizzly | walk ×8, rear-and-swipe ×8 | 16 | S and SW frames 3-4 flashed: patched |
| Orc (the blue brute; its chain-mail state not animated) | walk ×8, punch ×8 | 16 | the cape flies about in the punch |
| Gnoll (blue-grey; its white state not animated) | walk ×8, claw ×8 | 16 | N strike loses a third of the figure mid-lunge (seen from behind): kept |
| | | balance 841 | idles for these nine not made (about 72) |

## The mine's new figures and a familiar (the user, 2026-11-04)

The user: "getting the orange skinned goblin sprites, the Efreeti, and one familiar in place are the priorities in that
order. Could you please generate the animations and poses for them". 183 generations at the start, 86 at the end.
The calls below come to 57 by their receipts; the balance fell 97 (the rest is not accounted for here: other use of
the account the same day, perhaps).

| Character | Clip | How | Receipt |
|---|---|---|---|
| Goblin warlord (orange) | walk ×8 | template walking-6-frames; SE, E, NW dropped the halberd: deleted, redone in v3 into the same group | 8 + 3 |
| | halberd chop ×5 | v3, 6 frames (south first, then 4) | 1 + 4 |
| | death (south) | v3 | 1 |
| | breathing idle (south) | template; not wired (south only) | 1 |
| Goblin shaman (orange) | walk ×8 | template walking-6-frames | 8 |
| | fire cast ×5 | v3 | 1 + 4 |
| | death (south) | v3 | 1 |
| Efreeti | walk ×8 | template walking-6-frames | 8 |
| | flaming punch ×5 (`Strike2`) | v3; the first `Strike` (south) had a shapeless smoke frame: deleted. SE frame 4 washed out: replaced by frame 3 in the repo (a re-pull brings it back) | 1 + 1 + 4 |
| | death (south, into embers) | v3 | 1 |
| Fae drake | hover ×5 (8 frames) | v3, played standing and moving | 4 + 1 |
| | bite ×5 | v3 | 5 |

Left for later: idles for the warlord (4 more directions), the shaman and the Efreeti (breathing-idle, 5 each); the
drake's death; Tylo (its south view needs fixing first).


## The mine's fire creatures, and a bat and a spider (the user, 2026-11-07)

The user: "I'd also like the animations updated, including a few new ones added like a floating imp, floating efreet,
lava beetle, fire elemental, and more." 2975 generations at the start (with the mine's tiles and decor), 2664 at the
end; the animation calls below come to about 101. All v3, monsters 5 directions (the game mirrors the other 3).

| Character | Clip | How | Charged |
|---|---|---|---|
| Imp (hovering state) | wingbeat SE, E, NE, N | appended to the user's own south clip (`Hover`) | 4 |
| | claw rake ×5, death | | 6 |
| Efreeti | float ×5 (`Float`) | the first south folds its arms one way only: played ping-pong. A second try (`Float2`, legs dangling) barely moved: deleted. E re-rolled (rings of fire round its legs) | 1 + 1 + 4 + 1 |
| Lava beetle | scuttle ×5, bite ×5, death | E walk re-rolled (the shell flashed white); N bite re-rolled (a white bar), still shows a mouth for 3 frames; first death sprang back to life on its last frame: re-rolled | 5 + 1 + 5 + 1 + 1 + 1 |
| Fire elemental | flicker ×5, punch ×5, death | first south punch dissolved into a blob, first death sprang back: both re-rolled | 5 + 1 + 5 + 1 + 1 |
| Giant bat | wingbeat ×5, bite ×5, death | N bite frames 3-4 flashed white: patched in the repo | 11 |
| Black widow | crawl ×5, bite ×5, death | E and NE bites grew a fanged mouth on the abdomen: re-rolled; E frame 6 patched | 11 + 2 |

Not animated (the user's other new figures): the badger-man, Sorkvild the Raven, the troll knight.
