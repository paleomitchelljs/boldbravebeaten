# To do

Last updated at commit: 9db6f11

Keep this a short list: open items only, a line or two each. Tick things off, add new ones, and refresh the commit
line after every push (`git log -1 --format=%h`). What was done, and the detail behind each item below, is in
`archive/docs/HANDOFF-to-2026-11-09.md` (the list up to that day, 1,070 lines) and in git.

## Now: tuning (begun 2026-11-09)
- [ ] **The plan** (`docs/PLAN.md`, 2026-11-11): nine prompts in order (metrics, stamina, wounds, the head, AI, re-tune,
  two UI steps, feats), rulings R1 to R10 approved by the user 2026-11-11. Magic items and parley are out of scope for now.
  - [x] Step 1, metrics and baseline: `--metrics` on `sim/crawl.js` and `sim/duels.js` (`sim/metrics.js`), new
    `sim/spiral.js` and `sim/swarm.js`; the baseline is the top section of `sim/FINDINGS.md`. Next: prompt 2.
  - [x] Step 2, stamina as a pool (`CONFIG.stamina`: regeneration every round, spent actions, collapse; Second Wind and
    Rally reworked; the AI finishes the collapsed and steps back rather than throw a weak spent blow). FINDINGS "Stamina
    as a pool". Court of 3 clears 17/30 (was 12), deaths a fight up everywhere (0.21 → 0.33 in the court), fights no
    longer. Next: prompt 3.
  - [ ] **Ruling wanted (step 2)**: "most collapses get up" is not met (11 of 54 in the court) because the AI now
    finishes a body that lies a full round beside it. Recommendation: keep R3 and the finishing, drop the target; or
    `stamina.collapse.rounds: 0` (163 of 177 get up). FINDINGS has both.
  - [x] Ahead of step 4 (the user's note, 2026-11-11): an aimed blow lands where aimed with 0.4 + 0.05 × skill (max 0.85),
    else where the location roll puts it; always where aimed on a prone, down, held or blind defender
    (`rules.yaml locations.aim.hold`). Head share 45–49% → 25–33% in crawls, 66% → 42% in duels; deaths flat.
    Step 4 still owes the dearer aim against a defender who can react, and helms (R7).
  - [x] Step 3, wounds that weaken (R4 `locations.wounds.pointToCON`, R5 `impact.crushBare` 3 and `crushAttrs`, tireless
    bodies take CON wherever `locations.wounds.tirelessCON`; stamina clamped to a lowered maximum, REVIEW §2.3 settled).
    FINDINGS "Wounds that weaken". Survivors carrying a STR/DEX/SPD wound 0% → 9–17% (target ⅓); party-of-3 clears down
    (court 17 → 15, valley 8 → 2), deaths a fight up a little; the thrust's kills did not fall reliably. Next: prompt 4.
  - [x] Step 4, the head (R6 `locations.aim.guarded` head 5 / hands 4 / feet 5 against a defender who can react, the AI's
    AP guess from what it saw spent; R7 `halfHead`/`partialHead` coverage for foe templates and armored humanoid monsters
    L2+, Cyrus's cap; the Aim line in the panel). FINDINGS "The head". Head 32–34% → 20–22% of located blows (duels
    45 → 27%), deaths a fight about flat, no tier moved by more than one. Next: prompt 5.
  - [x] Step 5, the AI (`src/rules/ai.js`; no rule changed): approach budget and the blow a defence costs, no trading
    down, no blows at the immune, the edge clock and lines of fire for stand-offs, the feat actions, overchannel, grappling
    by skill only when blows are futile; `worth` on every condition. AI metrics in `sim/metrics.js`, `sim/styles.js`,
    `tests/ai.test.js`. FINDINGS "The AI plays the game". Valley of 3 clears 1 → 6 (0.83 → 0.64 dead a fight), court 11 → 12,
    hall 0 → 1; two-handed against sword & shield 68 → 61% open, 76 → 53% close; casters' tiers unmoved. Next: prompt 6.
  - [x] Step 6, re-tune (FINDINGS "Re-tuned on the new rules"): `sim/crawl.js --campaign` (town between places and after a
    wipe: the fallen recruited again, the living trained along their plans by `World.growAlongPlan`, the gear ladder);
    "heroes killed" in the metrics; R8 `CONFIG.sweep` (`sim/sweep.js`); the valley's `legion` groups cut to one. No rule
    number tuned: AP die, vital, cover, joins, head vital, collapse length all within noise. Party of 3: court 12, hall 1,
    valley 6 → 13 cleared in one go (0.45, 0.38, 0.61 dead a fight); as a campaign 18/20, 12/20, 17/20. Next: prompt 7.
  - [x] Step 7, the panel tells you the odds (UI; no rule changed): `Combat.foresee(attacker, target, option, {enc})` lays out
    applyHit's dice (aim hold, location, gap, carried cut, pass-through, vital, wound tables, stamina lost to a wound) on
    computeHit and defenseOdds; `tests/odds.test.js` checks every number against 3,000 seeded resolutions (all within ~1
    point). The pane's foot: "Lands 55% (they block) · 4 CON, 1 SPD · drops them 22%", breakdown on hover or the (i); the aim
    picker is a table of places (lands, on a hit, drops); reaction choices say odds, cost and what gets through; the init bar
    shows wounds (−n) and a collapse's round (up R2). Next: prompt 8.
  - [ ] From step 7: `foresee` leaves out what it can't see or the engine adds outside applyHit: the defender's AP (it
    assumes their likeliest defence: the best odds), Living Fortress, Untouchable, Roll With It, a ward, displacement, pack
    bonus, bane gear and oils (the attacker's own: could be added), knockback into hazards, bleeding after. Say if any matter.
  - [ ] From step 7: the aim table's "Suggested" row is the AI's `bestAim`, which also weighs disarms, falls and stuns and
    guesses the target's AP, so it often contradicts the columns (hands at 2% to drop over torso at 39%). Rule whether
    the suggestion should follow the table, or drop it.
  - [ ] From step 7: on a phone the aim table is a scroll down in the pane (its cap raised 40vh → 50vh); the reaction card
    with three defences reaches the top of the screen. Looked at in headless Chromium only (`tools/shot-pw.js`).
  - [ ] **From step 6**: the longsword's swing is still never chosen (R8 can't close a factor of two per AP; it does give
    the battle axe a setting). The two lethal targets: recommend ≤ 0.5 a fight plus the campaign, drop one-go clears.
  - [ ] From step 6 (content, left alone): each dungeon stops at one body: the maze's clay golem (M 5), the warrens' red
    drake, the castle's orc emperor (1.5 dead a fight at level 5). The sewer and barracks fights run to the 40-round cap
    with nobody dead (not run down). Desert spectres: 0% for six level-4 heroes (a level-15 body, needs magic).
  - [ ] From step 6: levels come fast: a party leaves the level-1 court at 3.9 and the hall at 2.9 (full XP each, retries).
  - [ ] From step 6: a body at stamina 0 has no armor (`computeHit` `unconscious`), so every collapse is a bare body. Kept
    (keeping the armor changed nothing measured: spears burst padding); rule on it if collapses in plate matter.
  - [ ] From step 5: two plate Berens still time out (the grapple can't finish: a longsword in the hand, no dagger);
    an opportunity strike ignores walls, so two spears with a corner between wait up to five rounds. Both want a rule.
  - [ ] From step 5: no hero or monster carries Rally, Command, To Your Feet, Demoralize, Name the Weakness, Vanish, Feign
    Death or Overchannel, so no sim measures them; the arena's mage (`sim/arena.js` magic) has no castable spell.
  - [ ] From step 5: a party of 4 in the court clears less (29 → 24): heroes now wait at the edge for the foe to come.
  - [x] **From step 4** (settled in step 6: the guarded head was not the lever; deaths are near-even fights): party-of-3 clears fell (court 15 → 11, hall 2 → 0, valley 2 → 1) because the head was the heroes'
    answer and the AI doesn't set it up on purpose (knock down, hold, drain AP, then aim high). Step 5 should teach it;
    if clears aren't back by step 6, try guarded head 4 / hands 3 / feet 4 (court 13 clears, head 26%).
  - [ ] R7 doesn't reach the first areas' level-1 foes (no armor to match): the kits were already helmed. Say whether
    those foes should get caps.
  - [x] For step 6: the clay golem: still M 5.07 (iron > 6, stone 1.88); no rule found wrong, content listed in FINDINGS.
  - [ ] Holding a grapple is now free at steady state (upkeep 6 = an unstruck holder's regeneration). Look at in step 6.
  - [x] For step 6 (from the baseline; answered there with the campaign): the two "lethal" targets disagree. Each fight's own deaths are 0.21 / 0.34 / 0.81
    (court, hall, valley) yet clears are 12 / 0 / 3: deaths are attrition over a place, so ≥ 18 clears needs well under 0.5
    a fight. The plan's "0.3 to 1.8" was the crawl's cumulative column (now labelled "dead so far").
  - [ ] Still after step 5: an SPD wound *wins* the spear mirror (90% at k = 4: the slower one waits and takes the first
    thrust; the AI can't tell waiting from being slow). A level-1 `knight` beats a level-8 hero 11% of the time (was 28%).
- [ ] **Weapon roles** (PROVISIONAL, 2026-11-10; top of `sim/FINDINGS.md`): a swung edge's blunt comes from its
  weight, heavy points thrust slower (longsword 2.3 AP), the staff's jab is 3, a battle axe exists. Punches and kicks
  take stamina only without Heavy Hands (the user's ruling), so shieldless fighters now swing at bone. Still open: the
  shield bash, the great axe against mail and the unused battle axe were settled in step 6 (FINDINGS): all three stand,
  the battle axe's carrier being content.
- [ ] **Sarnaks and minotaurs** (first numbers, top of `sim/FINDINGS.md`): spears carry the sarnaks (the plain one
  is M 1.3); a minotaur beats one hero and loses to two; only `apMult` made the lord a boss, and half mail made it
  worse (not run down). Every fight in both places costs a party of three about 1.8 heroes. No crawl run there.
- [ ] Crawl numbers (seed 4242, 2026-11-12, step 6): a party of 3 clears the court 12/30, the hall 1/30, the valley 13/30
  in one go (0.45, 0.38, 0.61 dead a fight); a party of 4 24, 5, 11. As a campaign (`--campaign`, town and up to three
  tries a place, n 20) the first areas fall 18, 12, 17 of 20; the second places 1 (maze), 17 (mines), 1 (warrens).
- [ ] The golems: clay M 5, iron > 6, stone 1.9 (step 6). Desert spectres: six level-4 heroes 0%. Casters alone M 1.4–2.5.
  No rule wrong; content fixes listed in FINDINGS "Re-tuned on the new rules". Unplaced monsters (wolves, trolls, drakes, wyverns…) have no tier.
- [ ] XP: every hero gets the full amount whatever the party's size; `maxLevel: 10` stands against the no-caps ruling.
- [ ] Content mix: 128 monster squares against 6 asleep, 5 locked, 5 secret, 2 traps, 2 parleys, 1 quest. Sneaking
  and talking have almost nowhere to matter. No social sim (a bot that tries fight / parley / sneak).
- [ ] (Unchanged in step 6.) Two-handed beats sword & shield 61% in the open, 53% in close quarters after step 5's AI (was 68%, 76%).
- [ ] Not simmed: the spell words (numbers are guesses), hit-location numbers, the strong magic items, an attribute
  sim (+1 to each in turn), weapon wear and weariness over a long crawl.
- [ ] `sim/lib.js` and `dk-scaling.js` list retired feats and have no skills: fix or delete before using them.
- [ ] `node --test` takes 5 minutes of CPU but 15 of wall time on this Mac; cause unknown. In the cloud container
  `tests/ui-node.test.js` runs out of heap at the default 2.2 GB (before and after 2026-11-11's changes); it passes with
  `NODE_OPTIONS=--max-old-space-size=8192` (7 minutes alone). Something in it holds a lot of memory.
- [ ] `tools/shot.sh` hangs in the cloud container (headless Chromium never ends its `--virtual-time-budget`, also with
  the old script); `node tools/shot-pw.js out.png "<js>"` (Playwright, same page, SIZE=w,h) works there.

## Play notes (the user, 2026-11-11, from the game as it was on 2026-11-10; the plan wins where they conflict)
- [ ] **Reach looks too long**: "orcs hit from very far away". Spears thrust 2–4 squares (`weapons.yaml` spear and heavy
  spear, `reach: {thrust: 4, min: 2}`); a square is an arm and a step, so four reads as far on the map. Re-check the
  scale (or how reach is drawn) in step 7; not looked at in step 6 (the valley's killers are these spears: FINDINGS), nor in step 7 (its prompt left it out).
- [ ] **Healing feels broken; CON can't be restored in a fight**: Give + Life mends 1 CON (2 with Strong:
  `CONFIG.magic.heal`, condMag), the rest is stamina; Move Life mends CON from a foe. The user wants Give/Move Life to
  be able to prevent death and restore CON. Out of the plan's scope (magic) until ruled on.
- [ ] Random encounters roll too often; foes should stand on the map unless the party rests. Monsters don't move or
  patrol (also under Game below).
- [ ] Defeat: the old "wake in Stone Bridge" text menu still shows instead of simply reappearing in the village. The whole
  party should come back together (with an option to swap any hero), not be re-recruited one by one. Saving should
  work at any village, with a way to set the place you return to.
- [ ] Merchant and trainer NPCs can't be triggered in town.
- [ ] Later: heroes scattered in the world (Arvir found in the orc slave pen unlocks his quest and becomes recruitable
  when its conditions are met). Content and quest work; not now.
- [ ] D-pad movement in exploring; in a fight, the camera should shift to show the whole of a move's reach (with
  the plan's step 8, pan the battle view).
- [ ] Maps: Kalavar's east and west walls are flipped; the kobold den is entered walking north and then you walk south
  (a twisting tunnel should look like one).
- [x] Kept as is: the circle of darkness ("I like it").

## Rules and AI
- [ ] Not built: Shape, Ethereal, Counterspell and Reflect as reactions; crafting (alchemy, metalwork, carpentry do
  nothing); feats needing rules outside a fight (`auto: false`); Off-hand Dagger, Quick Donning; branch capstones
  (Striker, Fencer, Assassin, Reaper, Technique, Runner, Charmer, Menace, Wilds…); using an item in a fight; running
  off the edge of a fight; cover in the AI's footing; a companion-choice screen; keywords (bleeding, falls, sap).
- [ ] Hero mode does not scale auras, constriction, traps or condition damage.
- [ ] Only a single-target Restore calls back the dead; town priests raise at any time.
- [ ] Harm as a list of entries (`docs/TODO-FIXES.md` 4), deferred. Save format has a version but no migration.
- [ ] Game: monsters do not move on the map; no hiring, restocking, torches or hunger; nouns are scarce and the
  Lore/ritual screen exists only in the GM table.
- [ ] The design docs (Mechanics Outline, Specifics) still describe passes, guards, the old reach.

## UI
- [ ] The battle view is still 15×10 (the explore view now fits the window: `game.view` in rules.yaml). (The odds: step 7.)
- [ ] Feat tree: a prerequisite line that skips a tier runs behind the cards between (Plate Mobility → Living
  Fortress); on a phone the graph still scrolls sideways at the narrowest card.
- [ ] No way to pan the battle view by hand. "Always ask" puts a pop-up on every blow at the party.
- [ ] Never clicked through in a real browser (headless shots only): the body as a target, the new-game editor,
  touch (click-to-walk, prompts), moving lava, spurts, fires and traps, gm.html's reaction pop-up, fractional AP pips.
- [ ] Restyle parley, title, pack, journal and standing to the pixel theme. Then character creation, title, journal.
- [ ] The Hollin Hills still drop a few frames on the iPhone. Followers cluster onto an exit square (drawn only).

## Art and maps
- [ ] **Liquid against walls** (reviewed 2026-11-09 in the lava lake and the sewer): lava and water meet a wall's
  side or back in a straight cut with no rim, while against floor they have a crust or a kerb. Needs a wall-foot
  piece per liquid (`assets/ideas/useful-assets-tk.md`) and a placement rule; not a code fix.
- [ ] The sewer's wall tops are lighter than its floor, so a wall block reads as a paved yard. The lava surface's
  dark blobs repeat on a visible three-square grid when zoomed out.
- [ ] **Restyle to the lake country's look** (the user, 2026-11-10: the older art should follow it). Done: the two
  grasslands (`grassland` tileset: west grass and road, a new rise). To do, a 25-generation PixelLab set each: Tarnhold
  gravel/river, road, slope, ring; pit mud; scree; the forest wall (about 175 of the 181 left; resets 2026-11-24), then
  jungle, cinder, mine approach, swamp, temple. Props (trees, tall grass) and buildings are still the older style.
- [ ] **Buildings are out of scale** (the user's `house_not_to_scale`): every building in `front.png` is about two
  squares wide beside heroes 73 px tall. Not changed: it needs larger buildings and the yards relaid, not a 2x blit.
- [ ] **Moving water** (2026-11-10; `assets/wip/water/build.py`): rivers slide down-screen whatever way the river
  runs (one sheet per tileset); lakes shimmer in place. Never watched moving, only still shots. The ford stones'
  own water and the sewer do not move.
- [ ] **Ground variants** (`assets/wip/ground/build.py`): sand, lake grass, road and canyon soil draw eight
  variants of the plain tile with its marks moved. Rock (rings, slopes) has none: its facets do not survive moving.
- [ ] Joins: `node tools/joins.js` lists corners laid over a third ground (0 now; `cut` sheets from
  `tools/cutsheet.py`). `lift: false` on a cliff set whose face is not rock below the last row (forest trunks, the
  mesa). Lake country leftovers: the fortress's upper floor is a separate place; the towers are small beside the
  walls; the road cannot join paving or soil cleanly.
- [ ] Not reviewed for edges: ember_hall, ember_warrens.
- [ ] Sewer: the main channel's diagonal stair-steps. Court, pyramid, palace, ritual: the "still open" lists in the
  archived handoff. The citadel's floor is lighter than the black basalt asked for. A grey strip north of the south
  hills. The trail ends in a straight edge at the swamp's east exit. Tarnhold: overlook top close to the canyon floor.
- [ ] A stone bridge deck over lava; a bluer oasis water for the desert; doors for the other tilesets; shallow and
  deep swamp water drawn alike.
- [ ] Not built in the maps: the web chasm, the vestibule's statue traps, the kobold queen and pups, the mine's
  remaining furniture, the slaves and the slave-cabin quest, people in the desert, the inns and Tarnhold.
- [ ] Characters: `assets/ideas/character-animation-plan.md` is the ledger (fixes, strikes, deaths, idles; never
  `create_character`). Stand-ins still in use: the efreet lord, the avatar of fear, the legionnaire, slaver, warlord
  and prophet. The user's newer figures are not wired to monsters. Floating figures have no bob.
- [ ] Wanted, no art: the vampire; redo Beren, the Yuan-Ti, skeletons, rats; raptor, red drake, fae drake.

## Ask the user
- [ ] Should a shield bash break bone without its feat (above)? An unbound summons: a third side? Spell bolts cannot be dodged: confirm.
- [ ] Put the mine's groups back when testing is done? The Lantern raises only friends: fine for testing?
- [ ] A blank hero to build from scratch? A full padded suit for Cyrus? Give someone the wall of fire back?
- [ ] What "slow" means in play: rounds, exchanges, or the AI's pauses. Narrow places (palace stairs, sewer walks).
- [ ] The hall's side duct is a way out only: give `mine_approach` a way in? Stonebridge stays as home?
