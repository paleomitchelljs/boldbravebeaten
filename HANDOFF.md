# To do

Last updated at commit: e615d40

Keep this a short list. Tick things off, add new ones, and refresh the commit line after every push (`git log -1 --format=%h`).

## Look and feel (needs a human eye)
- [ ] Play it on a phone-width screen: stage, dock, toolbar, command bar and sheet have only been checked on desktop.
- [ ] Restyle the town, parley, title and pack/journal/standing screens to match the pixel theme (they only inherit colours).
- [ ] Walls one square thick with floor on both sides draw their cap over the floor row to their north (the true 3/4
  projection): that row's floor is hidden under the cap, though figures and items there still show. If it reads badly,
  thicken those walls in the maps rather than special-casing the renderer.
- [ ] Cap tops are a flat procedural slate with a cyan edge; a hand-drawn cap tile set would look better.
- [ ] Beasts (rat, wolf, spider, snake, cat) borrow tinted orc sprites; find or draw real ones.
- [ ] Fights: attacks now lunge or fire a bolt, with floating numbers and "Blocked"/"Dodged"/"Down"; still no real attack or
  death animation frames (a body is the idle sprite on its side).
- [ ] Fights: the outcome of an attack (odds to hit, expected damage through armor) is not previewed when choosing a target.
- [ ] Click-to-walk and the explore prompts need a pass on touch screens.

## Art and licences
- [ ] `assets/env/{chest,objects,gold,stairs_down,spikes,plate,stairs}.png` come from the paid Cute Fantasy Dungeons pack, whose licence forbids redistribution: they are git-ignored, so a fresh clone or the Pages build draws those props blank. Replace them with Pixel Crawler or own art, or keep the repo private.
- [ ] Pixel Crawler terms are in `assets/PIXEL-CRAWLER-TERMS.txt`; credit the author in the game's About.

## Combat after the turn-model change (whole-pool turns, reactions, opportunity strikes)
- [ ] Retune: fights against armed groups got much deadlier (skeleton squad 70% → 27% wins, horde 57% → 13%); see
  sim/FINDINGS.md. Tune the AI's choices first (its defence reserve, defend threshold, moving past reach), then rule numbers
  (parry/dodge cost against attack cost, pool size), never single monsters.
- [ ] The turn budget (pool 6, AP in tenths, swing 4, move 2, contested blocks, armor AP, Quick feats halve at the top
  rank): playtest it. From the sims (sim/FINDINGS.md):
  - the level-1 skeleton squad is now unwinnable (11% → 0%): an encounter-design question;
  - the rapier rose to 91% in the weapon sweep (all fighters in mail); check whether that is realistic.
  The brawler losing most duels to armed fighters (14% → 1%) is realistic and stays (the user's rule: in 1v1, realism
  beats balance; styles get their place from encounters built around them).
- [ ] Rapier in mail still wins 90% of the weapon sweep: reach (thrust reaches 3) and mail stopping 1 piercing, not
  wear. Decide whether light points should do worse against metal (momentum); see sim/FINDINGS.md.
- [ ] Weapon wear, "Rest and repair" after fights and weariness (−1 max stamina a round until camp) are untested over a
  whole dungeon run; the encounter sim starts every fight fresh. A multi-fight sim would show attrition.
- [ ] Weapon materials exist on items (an iron longsword) but nothing generates them yet: loot and shops make the type's
  default material.
- [ ] The UI shows fractional AP (pips with a half pip, "1.5 AP"); only the fake DOM has run it.
- [ ] AI oddities seen in logs: a sword-and-board fighter drops the longsword for a dagger; everyone reads intent every round;
  archers and mages often draw opportunity strikes backing off.
- [ ] "Always ask" puts a pop-up on every blow at the party (several a round against a group). Playtest; if it drags, add a
  per-character standing order as an option.
- [ ] The GM table's reaction pop-up (gm.html) has only run in the fake DOM; look at it.
- [ ] The design docs (Mechanics Outline, Specifics) still describe passes and guards; update them to the turn model.

## Game
- [ ] Magic in play: nouns are scarce (books, creation pick) and the Lore/ritual screen exists only in the GM table.
- [ ] Monsters do not move on the map; fleeing returns you to the stairs.
- [ ] Feats that need rules code outside a fight (tracker, appraise, diagnose, alchemy, light fingers) are `auto: false`.
- [ ] No companions, hiring, restocking vendors, torch resource or hunger.
- [ ] Social balance has no sim yet (a bot that tries fight / parley / sneak through the Undercroft).
- [ ] Save format has a version field but no migration.
- [ ] More dungeon maps in the new style; the other three are still the old layouts with no scenery props.

## Done recently
- Weapons wear (durability by material, quality and fragility; metal armor, parries and blocks wear them; worn weapons
  hit softer, broken ones need a smith). Thrusts wear armor. After a fight, "Rest and repair" or "Press on". Weariness:
  −1 max stamina per round of combat until a long rest.
- The turn budget: pool 3.5 + SPD/2 in tenths of an AP; quick actions 2, a swing 4, a two-handed swing 6, a move 2;
  one big action allowed with an unspent pool; armor adds AP per action; Quick feats halve at the top rank; blocks
  contested; defences cost stamina (block most, dodge none); Bind feat. The log sits under the map.
- Top-down map shared by exploring and fighting; fights are played on a 15x10 slice of the dungeon.
- Turn model: one turn per round spending as much of the AP pool as wanted, every action resolving at once; defences are
  reactions paid from the pool, asked of the player on the map with odds and what the blow would do; opportunity strikes
  when leaving a foe's reach. Passes, guards and the held point are gone.
- Five-layer tile renderer (`src/ui/game/tilemap.js`): ground, wall faces, wall caps, decor and doors, entities.
- Walls are a cap row over a one-tile brick face: light only on cap tops facing open floor, dark side shadows,
  caps auto-tiled to merge at corners and T-junctions, finished face ends at gaps, an ambient-occlusion baseboard
  under every face, floor unbroken through doorways, doors in vertical walls drawn edge-on.
- Compact battle screen, character sheet pop-up and character creation with dropdowns and (i) tooltips.
- Fights: targets are chosen (click to aim, click again or Enter to commit); a move shows a phantom and a dotted path;
  guards and self-actions show an icon over the character; resolution shows lunges, bolts and floating results.
