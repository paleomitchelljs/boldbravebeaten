# To do

Last updated at commit: cc7e4ad

Keep this a short list: open items only, a line or two each. Tick things off, add new ones, and refresh the commit
line after every push (`git log -1 --format=%h`). What was done, and the detail behind each item below, is in
`archive/docs/HANDOFF-to-2026-11-09.md` (the list up to that day, 1,070 lines) and in git.

## Now: tuning (begun 2026-11-09)
- [ ] **The plan** (`docs/PLAN.md`, 2026-11-11): nine prompts in order (metrics, stamina, wounds, the head, AI, re-tune,
  two UI steps, feats), rulings R1 to R10 approved by the user 2026-11-11. Next: prompt 1. Magic items and parley are out of scope for now.
- [ ] **Weapon roles** (PROVISIONAL, 2026-11-10; top of `sim/FINDINGS.md`): a swung edge's blunt comes from its
  weight, heavy points thrust slower (longsword 2.3 AP), the staff's jab is 3, a battle axe exists. Punches and kicks
  take stamina only without Heavy Hands (the user's ruling), so shieldless fighters now swing at bone. Still open: the
  shield bash (5 CON to a skeleton at 2.3 AP) keeps the swing rare for anyone with a shield; against mail the great
  axe beats the hammers per AP; no hero or monster carries the battle axe; the crawls are not re-run since.
- [ ] **Sarnaks and minotaurs** (first numbers, top of `sim/FINDINGS.md`): spears carry the sarnaks (the plain one
  is M 1.3); a minotaur beats one hero and loses to two; only `apMult` made the lord a boss, and half mail made it
  worse (not run down). Every fight in both places costs a party of three about 1.8 heroes. No crawl run there.
- [ ] Crawl baseline (`node sim/crawl.js`): a party of 3 clears the court 10/30, the mine hall 0/30, the orc valley
  2/30; a party of 4 26/30, 1/30, 10/30. All level-1 places. The hall's single foes kill a hero in one fight of
  three; the valley's third group pulls its neighbours (6.7 foes). The crawl has no recruiting and no growth yet
  (`World.grantXP` raises level, not power): add both before trusting it past first areas.
- [ ] The golems: clay unbeatable, iron nearly, stone easy. Desert spectres (level 15, only magic hurts them) kill
  any party there. Casters are weak alone (M ≈ 2). Unplaced monsters (wolves, trolls, drakes, wyverns…) have no tier.
- [ ] XP: every hero gets the full amount whatever the party's size; `maxLevel: 10` stands against the no-caps ruling.
- [ ] Content mix: 128 monster squares against 6 asleep, 5 locked, 5 secret, 2 traps, 2 parleys, 1 quest. Sneaking
  and talking have almost nowhere to matter. No social sim (a bot that tries fight / parley / sneak).
- [ ] Two-handed beats sword & shield 68% in the open (the swordsman's AI spends its pool on the approach).
- [ ] Not simmed: the spell words (numbers are guesses), hit-location numbers, the strong magic items, an attribute
  sim (+1 to each in turn), weapon wear and weariness over a long crawl.
- [ ] `sim/lib.js` and `dk-scaling.js` list retired feats and have no skills: fix or delete before using them.
- [ ] `node --test` takes 5 minutes of CPU but 15 of wall time on this Mac; cause unknown.

## Rules and AI
- [ ] The AI uses none of the newer actions (Vanish, Rally, Command, To Your Feet, Demoralize, Name the Weakness,
  Feign…), never overchannels, drops a longsword for a dagger, reads intent every round, and can stand off for rounds.
- [ ] Not built: Shape, Ethereal, Counterspell and Reflect as reactions; crafting (alchemy, metalwork, carpentry do
  nothing); feats needing rules outside a fight (`auto: false`); Off-hand Dagger, Quick Donning; branch capstones
  (Striker, Fencer, Assassin, Reaper, Technique, Runner, Charmer, Menace, Wilds…); using an item in a fight; running
  off the edge of a fight; cover in the AI's footing; a companion-choice screen; keywords (bleeding, falls, sap).
- [ ] Hero mode does not scale auras, constriction, traps or condition damage.
- [ ] Only a single-target Restore calls back the dead; town priests raise at any time.
- [ ] The AI's worth tables for conditions live in `ai.js`: move a `worth` into `CONFIG.conditions`.
- [ ] Harm as a list of entries (`docs/TODO-FIXES.md` 4), deferred. Save format has a version but no migration.
- [ ] Game: monsters do not move on the map; no hiring, restocking, torches or hunger; nouns are scarce and the
  Lore/ritual screen exists only in the GM table.
- [ ] The design docs (Mechanics Outline, Specifics) still describe passes, guards, the old reach.

## UI
- [ ] The battle panel shows no chance to hit or expected harm for an action; the battle view is still 15×10 (the
  explore view now fits the window: `game.view` in rules.yaml).
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
