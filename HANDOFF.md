# To do

Last updated at commit: 20a5bf9

Keep this a short list. Tick things off, add new ones, and refresh the commit line after every push (`git log -1 --format=%h`).

## Look and feel (needs a human eye)
- [ ] Play it on a phone-width screen: stage, dock, toolbar, command bar and sheet have only been checked on desktop.
- [ ] Restyle the town, parley, title and pack/journal/standing screens to match the pixel theme (they only inherit colours).
- [ ] Fights: the outcome of an attack (odds to hit, expected damage through armor) is not previewed when choosing a target.
- [ ] Click-to-walk and the explore prompts need a pass on touch screens.

## Art TODO
Where art lives: `art/` is what the game draws (published; see `art/README.md`), `assets/` the scratch pad (raw packs,
ideas, work in progress; see `assets/README.md`). Audited 2026-10-24 from the files and headless screenshots of the
Undercroft, the Barrow and a fight; nothing here was checked on a phone.

**Licences and the published site**
- [ ] Confirm the licences of the creature sheets (`art/characters/creatures`: 42 creatures, 102 files), the PixelLab
  character and temple tileset, and the spell effects (`art/effects`). Until then they are git-ignored, so the
  published site shows the Pixel Crawler figure for every creature and plain bolts for spells.
- [ ] The Cute Fantasy props (`chest`, `objects`: crates, urns, tombs, statues, crosses, graves, webs, cauldrons,
  candelabras; `gold`, `stairs`, `stairs_down`, `spikes`, `plate`) may not be redistributed, so on the published site
  chests, stairs, traps and that furniture draw nothing. Replace them from the Pixel Crawler pack (its Environment
  folder, unprocessed in `assets/packs/`) or with our own art.
- [ ] Credit Pixel Crawler (Anokolisa) in an About screen (`art/PIXEL-CRAWLER-TERMS.txt`).

**Characters: missing movements and missing art**
- [ ] Pixel Crawler figures (11 kinds, every party member, foe and fallback): idle (4 frames) and run (6) only, side view,
  left and right by mirroring. No attack, hurt or death frames, no facing up or down; a fallen body is the idle frame
  turned on its side.
- [ ] Creature sheets: two frames per animation. 33 of 42 have idle and attack only. Full walks (side, up, down): beren,
  gowra, spawnee, swash. Side walk only: lich, spellblade, turquoise. Dragon: a fly set. Dusk bat: idle only (no
  attack). None has hurt or death frames; a creature with no walk slides across the map in its idle frames.
- [ ] PixelLab character (Tevax): idle in 8 directions and 4-frame walks, no attack; the only 8-way figure in a 2-way game.
- [ ] No art yet: wolf, alpha wolf, rust beetle, mirage cat (monsters); militia, sellsword, brawler, man-at-arms, knight
  (foe templates); every NPC uses a Pixel Crawler figure.
- [ ] 17 creature sheets are not mapped to any monster: alligator, basilisk, cerenasp, clay golem, evil eye, fae drake,
  fungus, gargoyle, gowra, iron golem, lich, minotaur, raptor, skeleton lizard, slime, turquoise, yuan-ti.
- [ ] The goblin and gowra sheets have a stray divider line at the frame edge.

**World tiles**
- [ ] Wall caps are a flat procedural slate with a cyan edge, not hand-drawn tiles.
- [ ] Outer room corners: in the Barrow's entry room the side walls' caps start a row below the north wall's, leaving dark
  notches at the two outer corners. Seen in a screenshot; they may be unexplored squares rather than missing tiles.
  Check in play.
- [ ] Doors in north-south walls are drawn as a thin side-on door; there is no door art for that orientation.
- [ ] Walls one square thick with floor on both sides draw their cap over the floor row to their north (the true 3/4
  projection), hiding that row's floor. If it reads badly, thicken those walls in the maps rather than special-casing the
  renderer.
- [ ] One tileset only (the Pixel Crawler dungeon). Waiting in `assets/wip/`: a 64-px PixelLab temple wang tileset (four
  times the grid) and outdoor cliff pieces cut from Cute Fantasy (no outdoor map yet). The renderer takes one tileset.

**Items**
- [ ] No item art: the pack, shops, loot and the sheet are text only. The Pixel Crawler pack's Icons and Weapons folders
  are unprocessed in `assets/packs/`; finished icons go in `art/items/`.

**Effects**
- [ ] Four colour sheets (fire, water, green, purple) cover every element: lightning and wind use water, earth uses fire,
  and light, shadow, spirit, force, mind and the rest fall back to purple. One bolt cell and one flash cell are used; no
  art for areas, ground, walls, wards or conjuring.

**A common standard (quality differences)**
- [ ] Resolution: tiles and Pixel Crawler figures are 16–32-px art drawn at 3×. Creature frames run from 61 to 363 px
  tall (fungus 61, gargoyle 68; rat, ogre, minotaur, slime and evil eye 77; most 150; bone wraith 228; cerenasp 340;
  coatl 363), drawn smoothed and scaled to a set height, so they look painted and soft beside the pixel tiles. Choose
  one standard: pixelate creature art to the 16-px grid (nearest-neighbour downscale, a shared palette), or move
  everything to a higher-resolution style.
- [ ] Frame counts differ (creatures 2, Pixel Crawler 4 and 6, PixelLab 4), so figures side by side animate at visibly
  different rates.
- [ ] No shared palette: Pixel Crawler figures get a per-character multiply tint; creature art keeps its own colours.
- [ ] Heights, widths and facing for each creature sheet were set by eye (`data/art.yaml`); line them up against one
  reference figure.

## Combat after the turn-model change (whole-pool turns, reactions, opportunity strikes)
- [ ] Retune: fights against armed groups got much deadlier (skeleton squad 70% → 27% wins, horde 57% → 13%); see
  sim/FINDINGS.md. Tune the AI's choices first (its defence reserve, defend threshold, moving past reach), then rule numbers
  (parry/dodge cost against attack cost, pool size), never single monsters.
- [ ] The turn budget (pool 6, AP in tenths, swing 4, move 2, contested blocks, armor AP, Quick feats halve at the top
  rank): playtest it. From the sims (sim/FINDINGS.md):
  - the level-1 skeleton squad is now unwinnable (11% → 0%): an encounter-design question.
  The brawler losing most duels to armed fighters (14% → 1%) is realistic and stays (the user's rule: in 1v1, realism
  beats balance; styles get their place from encounters built around them).
- [ ] Reach by motion (swords swing 1 and thrust 2, two-handers 2 and 3, spears 4) and points against armor (burst,
  find a gap, or turned): playtest. Open questions from sim/FINDINGS.md:
  - V4 adopted (gap hits take the pass-through roll, no automatic 10, mail resists 1.3): plate beats mail 92–5 in
    duels, armor order is monotonic. The longsword dominates duels in mail (82%): it thrusts from 2 and bursts iron
    mail; decide whether that is realistic or the sword's reach or punch wants a look (sim/FINDINGS.md);
  - the level-1 party still bleeds a little more in padding than before the pierce rule (rat-nest deaths 0.02 → 0.17);
  - plate spreads glancing blows but not crushing ones (`dissipate: {glancing: 0.5, crushing: 0}`); spreading
    crushing blows too costs maces their place against plate (2–13% in the all-plate sweep);
  - the scythe has no thrust at all ("nearly useless" would need a butt-jab face, which is rules code);
  - the AI does not weigh weapon wear: a rapier fighter keeps thrusting at plate until the blade breaks.
- [ ] Item tags in play: foes roll craft, metal and origin, and shops stock bronze and steel mail and the heavy spear;
  no loot table or shop yet offers an origin, an exotic material or an enchantment (placed by hand only: the
  revenant knight). Add some rare finds.
- [ ] The GM sheet's armor row now has five selects (type, material, origin, craft, coverage); only the fake DOM has
  rendered it. Enchantments show but cannot be edited there.
- [ ] Weapon wear, "Rest and repair" after fights and weariness (−1 max stamina a round until camp) are untested over a
  whole dungeon run; the encounter sim starts every fight fresh. A multi-fight sim would show attrition.
- [ ] The UI shows fractional AP (pips with a half pip, "1.5 AP"); only the fake DOM has run it.
- [ ] AI oddities seen in logs: a sword-and-board fighter drops the longsword for a dagger; everyone reads intent every round;
  archers and mages often draw opportunity strikes backing off.
- [ ] "Always ask" puts a pop-up on every blow at the party (several a round against a group). Playtest; if it drags, add a
  per-character standing order as an option.
- [ ] The GM table's reaction pop-up (gm.html) has only run in the fake DOM; look at it.
- [ ] The design docs (Mechanics Outline, Specifics) still describe passes, guards, the old reach, quality and scale
  armor; update them to the turn model, reach by motion, points against armor and the item tags.

## Magic items, spells, companions (added 2026-10-24; see docs/REVIEW.md)
- [x] The published site never had `assets/` (the Pages workflow didn't copy it): figures were coloured blocks, no tiles. Fixed 2026-10-24.
- [x] Ruled: ordinary shields can't block spell bolts (`CONFIG.defense.blockSpells: false`); Spellbreaker can.
- [x] Waist and two ear slots added (sashes on the waist; Orc Fang Earring and Ivandyr's Hoop in the ears).
- [x] Opportunity strikes on entering a foe's reach, leaving it, or a second step within it (ruled; sim/FINDINGS.md).
- [x] Armor by hit location, step 1: pieces cover locations, unaimed location rolls against mixed armor, carry-through
  for cuts (docs/PROPOSALS.md §2; sim/FINDINGS.md; `sim/locations.js`).
- [x] Step 2: aimed blows and a Location menu beside each attack (default: the best expected location, `AI.bestAim`).
- [x] Step 3: wounds by location (attribute tables, vital odds, disarm, trip, stun), rules.yaml `locations.wounds`.
- [ ] Sim the location numbers (shares, aim penalties, effect odds: all guesses) in duels with mixed harnesses; the
  arena builds wear full harnesses, so they show only the wound tables and the AI's aiming.
- [x] Parry carry-through (the user's idea): a parried swing whose force beats the parrying weapon's carries through,
  weakened; a parried thrust is stopped; the overwhelm term left the parry odds (`CONFIG.defense.parryCarry`).
- [ ] Sim the strong items (all draft): the Flowing Black Silk Sash (×0.8 AP on everything), the Scimitar of Speed,
  the at-will Circlet of Shadow (probably wants charges); Raise + Spirit (revenant) in the gauntlet; companions over a multi-fight run.
- [ ] Magic items use the user's names (the no-published-names rule was dropped). Only `relic_cache` (nested in the barrow, troll and strongbox hoards) offers them; no shop does.
- [ ] Choosing a companion: `c.companionChoice` picks among those on offer, but no screen sets it yet (the last on offer
  is taken). Companions show on the battle map but have no sheet of their own in town.
- [ ] The AI's worth tables for conditions live in `ai.js`; move a `worth` into `CONFIG.conditions` so a new condition
  needs no code.

## Game
- [ ] Magic in play: nouns are scarce (books, creation pick) and the Lore/ritual screen exists only in the GM table.
- [ ] Monsters do not move on the map; fleeing returns you to the stairs.
- [ ] Feats that need rules code outside a fight (tracker, appraise, diagnose, alchemy, light fingers) are `auto: false`.
- [ ] No hiring, restocking vendors, torch resource or hunger.
- [ ] Social balance has no sim yet (a bot that tries fight / parley / sneak through the Undercroft).
- [ ] Save format has a version field but no migration.
- [ ] More dungeon maps in the new style; the other three are still the old layouts with no scenery props.

## Done recently
- Review of mechanics and code (docs/REVIEW.md). Fixed: shoves and throws went through walls; pushes ignored pits,
  runes and fire; any shield stopped spell bolts for free; the bounty factions were in code (now `rules.yaml
  game.bounty`); Raise ignored the body; frightened AI didn't flee.
- Magic items (effects, on-hit, powers with charges; 13 enchantments, 15 worn things), the user's ten worn slots, Acid,
  Charm, Stillness, Veil, Bone, chilling frost, chain lightning, harmful darkness, Delayed, Raise (skeleton, zombie,
  revenant), Conjure + Vine summons, Familiar and Animal Companion, creature art and spell effects.
- The user's armor research: the warhammer's beak bursts iron plate two-handed (steel on a strong power blow); a rondel
  dagger bursts mail; mail passes 1.5× a cut's force as blunt (a greatsword power cut breaks bones through it);
  padding and leather let a heavy cut through; hardened steel protects ×1.5. Padding is assumed under mail and plate
  (the user's ruling: no layering).
- This folder is the git repository (the separate bbb-push clone is gone); commit and push `main` from here.
- Reach by motion (the user's table); points burst armor by punch, find a gap (d10 + ⌊DEX/4⌋ + feats) or are turned
  (blunt, hard wear). Every weapon, armor piece and shield is type + material + origin + craftsmanship + enchantments
  (materials.yaml, origins.yaml, crafts.yaml, enchantments.yaml); armor tiers padded, leather, mail, plate; old saves
  migrate. Plate spreads glancing blows. Rapier in mail 90% → 65% of the weapon sweep.
- Weapons wear (durability by material, quality and fragility; metal armor, parries and blocks wear them; worn weapons
  hit softer, broken ones need a smith). Thrusts wear armor. After a fight, "Rest and repair" or "Press on". Weariness:
  −1 max stamina per round of combat until a long rest.
- The turn budget: pool 3.5 + SPD/2 in tenths of an AP; quick actions 2, a swing 4, a two-handed swing 6, a move 2;
  one big action allowed with an unspent pool; armor adds AP per action; Quick feats halve at the top rank; blocks
  contested; defences cost stamina (block most, dodge none); Bind feat. The log sits under the map.
- Top-down map shared by exploring and fighting; fights are played on a 15x10 slice of the dungeon.
- Turn model: one turn per round spending as much of the AP pool as wanted, every action resolving at once; defences are
  reactions paid from the pool, asked of the player on the map with odds and what the blow would do; opportunity strikes
  on entering a foe's reach, leaving it, or a second step within it. Passes, guards and the held point are gone.
- Five-layer tile renderer (`src/ui/game/tilemap.js`): ground, wall faces, wall caps, decor and doors, entities.
- Walls are a cap row over a one-tile brick face: light only on cap tops facing open floor, dark side shadows,
  caps auto-tiled to merge at corners and T-junctions, finished face ends at gaps, an ambient-occlusion baseboard
  under every face, floor unbroken through doorways, doors in vertical walls drawn edge-on.
- Compact battle screen, character sheet pop-up and character creation with dropdowns and (i) tooltips.
- Fights: targets are chosen (click to aim, click again or Enter to commit); a move shows a phantom and a dotted path;
  guards and self-actions show an icon over the character; resolution shows lunges, bolts and floating results.
