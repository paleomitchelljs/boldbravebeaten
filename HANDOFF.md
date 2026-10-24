# To do

Last updated at commit: a2f680d

Keep this a short list. Tick things off, add new ones, and refresh the commit line after every push (`git log -1 --format=%h`).

## Look and feel (needs a human eye)
- [ ] Play it on a phone-width screen: stage, dock, toolbar, command bar and sheet have only been checked on desktop.
- [ ] Restyle the town, parley, title and pack/journal/standing screens to match the pixel theme (they only inherit colours).
- [ ] Walls one square thick with floor on both sides draw their cap over the floor row to their north (the true 3/4
  projection): that row's floor is hidden under the cap, though figures and items there still show. If it reads badly,
  thicken those walls in the maps rather than special-casing the renderer.
- [ ] Cap tops are a flat procedural slate with a cyan edge; a hand-drawn cap tile set would look better.
- [ ] Creature art (`art/creatures`, `art/pixellab`, local only and git-ignored) now draws for 21 monsters, 3 foe templates
  and 11 party looks (`data/art.yaml`; `art.html` shows each beside its fallback). Seen in headless Chrome only on
  `art.html`, not in a real fight. Questions: the painted art is finer and softer than the 16-px tiles (decide whether to
  pixelate it or keep the mix); whether the art may be committed to `assets/` (then the Pages build shows it); wolf,
  mirage cat, rust beetle and the template knights still have no art. Facing and height per sheet were set by eye.
  The goblin and gowra sheets have a stray divider line at the frame edge.
- [ ] Not yet used from the new art: `art/pixellab/temple` (a 64-px wang tileset: a temple dungeon theme would need
  the tile renderer to take a second tileset) and `art/creatures/decor` (outdoor cliffs; there is no outdoor map).
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
- [x] Ruled: ordinary shields can't block spell bolts (`CONFIG.defense.blockSpells: false`); Spellbreaker can.
- [x] Waist and two ear slots added (sashes on the waist; Orc Fang Earring and Ivandyr's Hoop in the ears).
- [x] Opportunity strikes on entering a foe's reach, leaving it, or a second step within it (ruled; sim/FINDINGS.md).
- [ ] Armor by hit location (the user chose it; docs/PROPOSALS.md §2), in three steps: (1) pieces and unaimed
  locations, with carry-through for cuts (approved); (2) aimed blows and a Location menu; (3) disarm, trip, stun.
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
