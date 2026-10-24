# To do

Last updated at commit: cd13619

Keep this a short list. Tick things off, add new ones, and refresh the commit line after every push (`git log -1 --format=%h`).

## Look and feel (needs a human eye)
- [ ] Play it on a phone-width screen: stage, dock, toolbar, command bar and sheet have only been checked on desktop.
- [ ] Restyle the town, parley, title and pack/journal/standing screens to match the pixel theme (they only inherit colours).
- [ ] Fights: the outcome of an attack (odds to hit, expected damage through armor) is not previewed when choosing a target.
- [ ] Click-to-walk and the explore prompts need a pass on touch screens.

## Art TODO
Where art lives: `art/` is what the game draws (published; see `art/README.md`), `assets/` the scratch pad (raw packs,
ideas, work in progress; see `assets/README.md`). New PixelLab output goes to `assets/wip/` first and moves into `art/`
once it is cut, mapped in `data/art.yaml` and seen in play. The PixelLab MCP server is configured (user scope, not in
the repo); its tools load when Claude Code restarts.

Current goal (2026-10-24): a cohesive-ish set of art for one trial dungeon, the temple. Plan, open questions and build
order: `assets/ideas/temple-dungeon.md`. Priorities: **3. the temple tileset first, then 2. its creatures; 1. new heroes
are deferred** (keep the current heroes for now). Everything else is under *Later*.

**0. Notes for generating (not blocking)**
The art is a deliberate mix while we prototype (the user, 2026-10-24: combine assets now, do art passes later). No
common standard is needed yet. Where it costs nothing, make new PixelLab figures as Tevax was (64 px, low top-down,
mannequin template) so they at least match each other, and save each prompt beside its output. Useful animations:
idle, walk, attack, hurt, death. PixelLab gives 8 directions; the map mirrors 2, so 4- or 8-way facing in
`src/ui/game/sprites.js` is an option if the extra directions seem worth using.

**1. Heroes (four; deferred, current heroes stay for now)**
- [ ] The vampire. No art yet.
- [ ] Beren, the knight. A creature sheet exists (`beren`: idle, attack, side/up/down walk, 2 frames, 150 px); redo it to
  the new standard.
- [ ] A Yuan-Ti. A creature sheet exists (`yuan-ti`: idle and attack only), not mapped to anything; redo it.
- [ ] The red Dragonborn death knight. Tevax (`art/characters/pixellab/Tevax_Thaukori`) is a red dragonborn with
  breastplate, black teardrop shield and silver broadsword: idle in 8 directions and walks, no attack. Either give it a
  death knight's look (darker plate, a two-hander or a rune blade, a deathly glow) or keep it as the base and add the
  missing animations. The prompt it was made from is in its `metadata.json`.
- [ ] Add each to `data/art.yaml` with `party: true` so a party member can pick it.

**2. Creatures for the dungeon**
- [ ] Skeletons (`skeleton`, used by Skeleton and the squad; idle and attack only, 216×207). A warrior and an archer or
  caster would let the squad read as more than three copies.
- [ ] Rats (`rat`, 77 px, idle and attack; the rat and rat pack). Small and soft beside the tiles.
- [ ] Lizardfolk (`lizardfolk`, used by the Scaleward; idle and attack). A temple of lizardfolk wants several: warrior,
  shaman, a larger brute.
- [ ] Large red drake. The Drake monster borrows the `dragon` sheet (idle, attack, fly). Needs walk, fly, breath and
  bite.
- [ ] Fae drake. A `fae-drake` sheet exists (idle and attack) but no monster uses it; it needs a monster in
  `data/monsters.yaml` as well as art.

**3. Temple tileset (prototype dungeon after the Temple of Cazic-Thule): see `assets/ideas/temple-dungeon.md`**
- [x] The plan's questions are answered (§0 and §2: places and their links listed).
- [ ] Engine: a tileset per place (`look.tileset`, 64-px cells; the renderer now takes one 16-px set), terrain
  (water, bridges, grass/rubble floor, pyramid tier faces), one-way drops (the validator pairs every staircase), and
  fights that draw in nearby groups (the open courtyard has four guard posts).
- [ ] Style target: the PixelLab dragonborn (64 px). Tiles at 64 px to match (plan §4).
- [ ] Once courtyard 1 plays: archive the Undercroft and the Barrow for tests and sims only; start at the temple.
- [ ] Courtyard 1 alone, as the trial of the pipeline (prompt, PixelLab, `assets/wip/`, cut, `art/`, seen in play).
- [ ] Then labyrinth, courtyard 2 and pyramid, sewers, ritual chamber, palace (plan §5).
- [ ] Monsters: an alligator monster for the sewers (the sheet exists); lizardfolk variants; the avatar of fear as the
  ritual chamber's boss.
- [ ] The temple props also replace the Cute Fantasy props the published site may not show.

**Later**
- Licences: the creature sheets (`art/characters/creatures`), the PixelLab figure and the spell effects (`art/effects`)
  are git-ignored until their licences are confirmed, so the published site shows the Pixel Crawler figure for every
  creature and plain bolts for spells. Credit Pixel Crawler (Anokolisa) in an About screen.
- Pixel Crawler figures (every NPC and fallback): idle and run only, no attack, hurt or death.
- Other creature sheets: two frames each, mostly idle and attack only; no art for wolf, alpha wolf, rust beetle, mirage
  cat or the foe templates (militia, sellsword, brawler, man-at-arms, knight); 17 sheets unmapped; stray divider lines
  on goblin and gowra.
- Walls one square thick draw their cap over the floor row to their north; thicken those walls in the maps if it reads
  badly.
- Outdoor cliff pieces from Cute Fantasy are in `assets/wip/cliffs` (no outdoor map yet).
- Items: no item art; the Pixel Crawler Icons and Weapons folders are unprocessed in `assets/packs/`; icons go in
  `art/items/`.
- Effects: four colour sheets cover every element (light, shadow, spirit, force, mind and the rest fall back to purple);
  no art for areas, ground, walls, wards or conjuring.
- For the eventual art pass: resolutions (16-px tiles at 3x, creature sheets 61-363 px, PixelLab 64 px), frame counts
  (2, 4, 6) and palettes differ between sources; heights and facings in `data/art.yaml` were set by eye.

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
