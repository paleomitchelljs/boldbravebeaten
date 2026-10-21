# Simulation findings

## The user's armor research: picks, rondels, mail and heavy cuts, cuts through padding, hardened steel (2026-10-20)

**The user's brief.** Adopt the first five mismatches between the rules and the user's armor report:
- the warhammer's pick should rupture plate ("Warhammer (Pick) … Plate: High");
- a rondel-type dagger should burst mail ("purpose-built to defeat mail");
- a heavy cut on mail does blunt trauma ("capable of snapping collarbones or collapsing ribs");
- padding stops cuts "unless the blade carries massive momentum (e.g., a two-handed greatsword chop)";
- hardened steel plate takes more than mild steel (">250–300 Joules" against "~150–200").
Layering is not needed: "padded cloth can be assumed to exist under any plate armor item".

**Adopted (data).**
- **Warhammer beak** punch 4 (weapons.yaml). Two-handed 5.2 bursts iron plate (5); a power blow 6.4 does too, and it
  bursts hardened steel (7.5) only from STR 9 up.
  - A point that bursts armor takes the coverage pass-through without plate's glancing factor (0.4), since it has
    gone through.
  - Before, nothing burst plate, so the factor now only touches gap hits.
- **Rondel dagger** (new): punch 1.4, bursts iron mail, not steel. It and the other daggers are flagged `dagger`, so
  Coup de Grâce and the AI's stab in a grapple take it.
- **Mail** `transmit: 1.5`: a cut's leftover force lands as blunt at 1.5× the motion's share, capped at all of it.
  - A greatsword power cut on iron mail lands 12 stamina and crushes 2 CON.
  - A one-handed sword swing stays 1–2 stamina.
- **Padding and leather** `cutThrough: 8` (× protection; less as they wear): slashing beyond 8 after mitigation cuts
  through to the body.
  - A greatsword two-handed cut puts about 4 through padding; a one-handed sword swing nothing.
  - Mail and plate never let a cut through.
- **Steel** protection 1.25 → 1.5: steel mail resists 1.95 (an average spearman needs a gap), steel plate 7.5.

**Sims** (V4 → now; weapon and armor sweeps at n 60, duels and encounters at 100):
- **Warhammer in the all-plate sweep: 1% → 39%.** In mail it stays at 47%.
- **Unchanged within noise:**
  - plate beats mail 92–5 in sword-and-board duels;
  - armor order: plate 85, steel mail 73, padded 43, leather 38, iron mail 36%;
  - rapier in mail 40%; longsword in mail 82%.
- **Rondel against the common dagger, both in mail:** 73–25. Both lose to a longsword in the open (3%); daggers are
  for the clinch and the finish.
- **Encounters:** identical but for Rusk's crew, 93% → 88% won (deaths 1.37 → 1.39).

## Why plate lost to mail, and V4 (2026-10-20)

**The user's brief.** "Mail should have substantially less protection than plate. A sword swing against a plate wearer
should do almost nothing, and thrusts to find a gap should be less effective. What specifically is causing the plate
wearers to lose to the mail wearers?"

**Diagnosis** (100 duels, level-4 sellswords with longsword and round shield, trained in their armor; plate 48, mail 50):
- **One gap killed.** A gap hit put all 6 piercing into CON 6: 61 of 62 gap hits killed outright.
  - Mail's thrusts found a gap in plate on 11% of landed thrusts, all of them on a lucky 10, but 28 of mail's 50 wins
    were one such thrust.
  - Plate's thrusts found a gap in mail on 22%.
- **Against a longsword, mail was nearly plate.** No sword thrust burst either: mail resisted 1.6 against a thrust of
  1.54. Slashing never wounds through armor (it converts to blunt), so swings did 0–1 stamina to either. The gap number
  (10 against 12) was the only difference that counted.
- **Plate tired itself out.** 23 of plate's 50 losses were collapses at 0 stamina (mail: 10 of 48), though mail's blows
  did no stamina damage to plate.
  - Plate pays 1 more stamina per thrust.
  - Its regeneration penalty (−3) is more than these fighters regenerate (2), so it loses stamina every round.
- **Plate's blocks failed 33% of the time, mail's 17%.** Plate's SPD penalty makes its own blows slower, so the
  expected block odds are 79% against 85%. The rest of the gap is not traced.
- **Swings against plate already did almost nothing:** a sword swing 0 stamina, a greatsword power swing 3 (mail: 1 and 8).

**Variants** (duels: plate–mail wins; sweeps as in the section below):

| variant | duels | plate collapsed | trained: plate / steel mail / iron mail | rapier in mail | spiked mace in plate |
|---|---|---|---|---|---|
| V0 (as pushed) | 48–50 | 23 | 73 / 58 / 66% | 65% | 53% |
| V1 gap hits take the pass-through roll | 83–16 | 6 | 93 / 64 / 59% | 44% | 43% |
| V2 no automatic 10 | 60–38 | 40 | 84 / 53 / 58% | 65% | 49% |
| V3 = V1 + V2 | 65–33 | 33 | 83 / 69 / 61% | 44% | 49% |
| **V4 = V3 + mail resists 1.3** | **92–5** | 8 | **87 / 71 / 37%** | **40%** | 49% |
| V5 = V3 + plate regeneration penalty 2 | 80–4 (16 unresolved) | 1 | 90 / 63 / 57% | 44% | 23% |

- V2 and V3 show the exhaustion directly: once gaps stop killing it, plate loses by collapsing.
- V5 cures the collapses but costs maces their place against plate (their job is draining stamina) and leaves fights
  unresolved.
- V4 keeps plate's cost and makes mail what the user described.

**Adopted: V4** (`pierce.gapPass`, `pierce.natural10: false`, mail resist 1.3), with two fixes it needed:
- **Rapier:** its punch is capped at 1.2 (`maxPunch`: a flexible blade bends). Without the cap, a rapier at STR 9+
  reached 1.32 and burst mail.
- **Shortbow:** punch 1.0 → 0.8, so its bodkin (1.2) can't burst mail.

The armor sweep is monotonic for the first time: none 16, leather 39, padded 43, iron mail 37, steel mail 71, plate
87% (trained). The weapon sweep in mail: longsword 82%, rapier 40%, dagger 42%.

**Encounters** (100 each; as pushed → V4): rat nest deaths 0.21 → 0.17, crew 89 → 93% won, horde 17 → 21% (deaths
2.70 → 2.14), knight 10 → 0% (no lucky gaps in his plate), troll 100 → 95%.

**Still open.**
- **The warhammer is the worst weapon against plate (1%).** Its notes and the user's research say it should be the
  best (a pick that ruptures plate).
- **The longsword dominates duels in mail (82%).**

## Reach by motion, points against armor, item tags, plate spreads a blow (2026-10-20)

**The user's brief.**
- **Reach:** "daggers only hit one square away on a thrust/slash. Rapiers/swords/maces/standard one handed weapons hit
  one square away on a swing, two squares on a thrust. Typical two handed weapons hit 2 squares away on a swing, three
  on a thrust. Spears can thrust up to 4 squares away. Specialist weapons can deviate (a Scythe can hit 3 squares away on
  a swing, but is nearly useless on a thrust)."
- **Points against metal:** "On a thrust, there should be a roll for a chance of finding a joint in the armor. Otherwise
  a hit does blunt damage as a result of the armor blocking & damages the weapon a lot." The roll depends on "the type of
  armor & the attacker's skill & feats"; "the weight of the weapon has a big impact". "Heavy spears can pierce mail &
  worse, but not plate (must find a gap). Rapiers can pierce padded & worse but not mail or better."
- **Armor tiers:** none, padded, leather/hide, chain-mail, plate. Materials cloth, leather, bronze, iron, steel; rare
  exotics. Every item has a type, material, craft origin and enchantments ("usually 0").
- **Craftsmanship** (poor/average/master) "controls how fast an item degrades/how easily it is broken, while origin
  controls how its durability/damage/protection scales with weight".
- **Plate** "should dissipate more of the damage (less makes it through as blunt damage to stamina)".

**Adopted (PROVISIONAL; `src/rules/config.js` `pierce`, data files).**
- **Reach** (`weapons.yaml` `reach: {swing, thrust, min}`): as the brief. Inside `min` (greatsword, spears, scythe at 1)
  a blow is cramped. A clinch now cramps long blades and spears (`closeOK` means "works in a clinch"), since range 1 is
  sword distance, no longer the clinch. Heavy spear added (two hands, 2.6 kg). The scythe has no thrust at all.
- **Punch:** the mass behind the point (× 1.5 two-handed; a swung beak or spikes, the head's mass × the haft × 2.5),
  × the motion, × (1 + 0.1 × STR bonus). Daggers have an explicit 0.9 (driven by the arm); arrows take the bow's
  (shortbow 1, longbow 1.8) × the head (bodkin 1.5, broadhead 0.7).
- **Resistance:** padded 0.75, leather 1, mail 1.6, plate 5; × material and origin protection.
- **Three outcomes:**
  - **Burst** (punch ≥ resistance): mitigation and the old pass-through roll, as before.
  - **Gap** (otherwise): d10 + ⌊DEX/4⌋ + Find the Gap (+2) + Spot Weakness (+1) (+3 prone or half-sword) ≥ the gap
    number (padded 8, leather 8, mail 10, plate 12; half coverage −2, partial −4). A 10 always finds one; a pinned foe
    always gives one. All of the piercing goes in.
  - **Turned:** half the piercing lands as blunt and the weapon takes `weaponWear.deflected` 1.0 (a blow that lands takes
    0.4).
- **Items:** type + material (materials.yaml) + origin (origins.yaml) + craft (crafts.yaml) + enchantments
  (enchantments.yaml), the same for weapons, armor and shields.
  - Material and origin scale protection (P and S mitigation, resistance), weight (armor penalties; a weapon's mass,
    so speed, damage and punch follow the physics) and durability.
  - Craft only touches durability, wear taken and the shield break threshold.
  - Old `quality` is read as craft. Scale armor became steel mail. Foes roll craft, metal and origin by level band
    (rules.yaml `enemyGear`).
- **Plate dissipation** (armor.yaml `dissipate: {glancing: 0.5, crushing: 0}`): half the blunt left after mitigation
  from a cut or a turned point never reaches stamina; a mainly blunt blow carries as before.

**Tried and dropped.**
- **A burst point puts all its piercing past mitigation into the body** (no pass-through). Padding became nearly
  useless:
  - crew 94% → 75% won (deaths 1.18 → 2.13), rat nest deaths 0.02 → 0.25;
  - the greatsword won 92% of mailed duels (it alone thrusts at 3 and bursts iron mail).
  Keeping the Specifics' pass-through for bursts brought these back (below).
- **Plate spreads every blow, crushing ones included.** Maces lost their place against plate: in the all-plate
  sweep the flanged mace fell to 2% and the spiked mace to 13% (48% and 53% when crushing blows carry).
  `crushing: 0.5` turns it back on.
- **Padded gap 7** (now 8); gap 9 was tried for the encounters below (rat nest deaths 0.21 → 0.14; within noise).

**Weapon sweep** (`sim/run.js --n 60 --only weapons`, level-4 sellswords, no shields; average win, before → after):

| weapon | everyone in mail | everyone in plate |
|---|---|---|
| rapier | 90% → 65% | 37% → 33% |
| longsword | 72% → 64% | 71% → 41% |
| greatsword | 59% → 63% | 88% → 61% |
| dagger | 56% → 51% | – |
| warhammer | 46% → 46% | 4% → 8% |
| flanged mace | 25% → 38% | 64% → 48% |
| spiked mace | 24% → 30% | 10% → 53% |
| club | 20% → 34% | 5% → 10% |

**Armor sweep** (sword and board, trained in their armor; before → after): none 13 → 13%, padded 41 → 45%,
leather 45 → 41%, iron mail 38 → 66%, steel mail (was scale) 70 → 58%, plate 83 → 73%. Plate against mail head to head
(60 fights): 75/17 → 48/52, no time-outs, median 4 rounds.

**Encounters** (`tools/encounters.js --n 100`; columns: before, new reach only, final):

| encounter | won | dead per fight |
|---|---|---|
| undercroft_1/rat_nest | 100 / 100 / 100% | 0.02 / 0.03 / 0.21 |
| undercroft_2/crew | 94 / 93 / 89% | 1.18 / 1.41 / 1.55 |
| barrow/squad | 4 / 0 / 0% | 3.73 / 3.96 / 3.96 |
| barrow/horde | 18 / 17 / 17% | 1.59 / 1.77 / 2.70 |
| barrow/knight | 0 / 0 / 10% | 3.79 / 3.96 / 3.66 |
| trollhole/wolves | 99 / 99 / 100% | 0.37 / 0.44 / 0.43 |
| trollhole/troll | 97 / 99 / 100% | 0.20 / 0.20 / 0.00 |

**Reading.**
- **The rapier is no longer dominant in mail** (90% → 65%). It bursts padding and leather but must find a gap in mail
  (20% at DEX 5), and a turned point wears it hard.
- **Mail went from middling to strong** (38% → 66% trained). Sword thrusts no longer pass it; only the half-sword
  thrust (×1.5, a technique) bursts it.
- **Plate's edge over mail between swordsmen is gone** (75/17 → 48/52). Neither side's sword gets through the other's
  armor easily, fights run longer, and plate's stamina and AP costs tell.
  - If plate should still beat mail here, the lever is plate's encumbrance (armorAdjust stamina and regen, the SPD
    penalty behind armor AP) relative to mail's, not its protection.
- **Blunt is now the plate-killer it should be.** Spiked and flanged maces 48–53% in the all-plate sweep; blades
  dropped there (longsword 71% → 41%).
- **The level-1 party bleeds more against bites and stabs in padding.** Rat-nest deaths 0.02 → 0.21, horde 1.59 → 2.70.
  - The cause is the gap: a bite that finds a gap in padding puts in all its piercing; before, it lost a point to
    mitigation and half the rest to pass-through.
  - Reach alone changed little (second column).
  - Levers: a higher gap number for padding (9 was tried, within noise), or gap hits taking the pass-through roll too.
- **The warhammer stays weak in both sweeps** (46% / 8%). It is slow, and its beak needs a gap in plate like any point.
## Weapon wear, rest and repair after a fight, weariness (2026-10-20)

**The user's brief.**
- **Weapon durability:** weapons have a durability and lose efficacy as they wear, until repaired.
- **What wears them:** hitting metal armor, being parried and being blocked wear a weapon fast; a dodge or flesh
  barely at all.
- **The rapier** is fragile: parrying with it wears it by the force it meets, and using it on heavy metal armor is
  risky with a good payoff.
- **Armor** wears with its quality and the intensity of the blows. Material is a meaningful attribute.
- **After a fight:** one click rests and repairs.
- **On trial:** every round of combat lowers max stamina, to end endless fights and give a reason to rest.

**Adopted (PROVISIONAL, `src/rules/config.js` and data).**
- **Durability:** weapons.yaml `durability` and `fragility` per weapon (rapier 40 / 2, longsword 100 / 1, maces
  120 / 0.5, warhammer 140 / 0.5, club 60 / 1).
- **Material and quality:** an instance may carry its own `material` (an iron longsword 87 durability against
  steel's 100). Toughness: wood 0.6, iron 1, steel 1.5, adamant 3.
- **Hardness:** cloth 0.1, leather 0.3, hide 0.5, wood and bone 1, chitin 1.5, iron 2, steel 3, adamant 5. Every
  armor type now names its material (mail iron, plate steel, padded cloth…).
- **Wear per blow** (`weaponWear`) = force × rate × fragility × (hardness met ÷ own hardness):
  - landing on armor 0.4; being parried 0.15; parrying 0.25; being blocked 0.25; a dodge 0;
  - a rapier thrust on plate costs 5 of its 40; a longsword thrust 2 of 100; nothing on padded or flesh.
- **Worn and broken weapons:** a worn weapon keeps 60% of its damage at the end of its life. A broken one counts as
  not in hand until a smith mends it. The smith, repair kits and long rests now mend weapons.
- **Armor:** thrusts now wear it too (`armorPierceWear` 0.5 of the piercing). Quality already scales armor
  durability (crude ×0.6 to legendary ×2.2), so better armor lasts longer under the same blows.
- **After a fight** (`afterBattle`): "Rest and repair" passes 15 minutes, refills stamina to the weary maximum and
  gives armor, shields and weapons 25% back (50% with Field Repair; broken ones need a smith). "Press on" keeps stamina
  where it is. Before, stamina refilled for free.
- **Weariness** (`weariness`): −1 max stamina per round of combat, at most half; a long rest (camp, inn) clears it.

**Sims** (`sim/run.js --n 60`; columns: both off / wear only / weariness only / both):

| measure | off | wear | weary | both |
|---|---|---|---|---|
| rapier, weapon sweep in plate | 46% | 37% | 46% | 37% |
| rapier, weapon sweep in mail | 91% | 90% | 91% | 90% |
| level-1 knight vs level-8 duelist, corridor | 75% | 93% | 75% | 93% |
| 2 sellswords vs level-8 duelist | 57% | 65% | 57% | 65% |
| flanged mace, weapon sweep in plate | 56% | 58% | 61% | 64% |

Encounters (100 each) do not move with wear: single fights are too short. Weariness costs the party a little against
groups (squad 0 → 4%, horde 25 → 18%; within noise of each other).

**Reading.**
- **Against plate the rapier is now the risky choice:** it wears out on the armor, and a level-8 duelist beats a
  level-1 plate knight 7% of the time instead of 25%.
- **Wear does not touch the rapier's 90% in mail,** even at three times the rates (`--set weaponWear=…`). Duels end in
  one to three rounds, and the rapier wins them by reach: its thrust reaches 3 squares to the longsword's 2, for the
  same 6 piercing. Mail stops 1 point of it (it stops cuts, S 4).
- **Under the realism rule, the open question is whether a light point should burst mail rings as well as a heavy
  one.** A lever: piercing armor by the blow's momentum (mass), so light points do worse against metal.
- **Wear will mostly show over a dungeon,** fight after fight, which the encounter sim (a fresh party every fight)
  does not measure.

## The turn budget: pool 6, fractional AP, contested blocks, armor AP (2026-10-20)

**The user's brief.**
- **Turn budget:** at level 1 a turn holds one big action (a powerful swing), a step and a medium action (step and
  swing), or three quick actions (dodge, parry, thrust, a step, block).
- **Growth:** feats and SPD add to how much a turn holds; fractional AP are fine.
- **Defences:** all three are contested. Block is the easiest to make and costs the most stamina; dodge the hardest,
  and costs no stamina from the blow; parry in between, and it can open a disarm or riposte if feated.
- **Armor** is strong, but makes actions dearer in AP and stamina.
- **Fast against armored:** a fast unarmored swordsman struggles to fell a slightly lower-level armored foe in close
  quarters, but can get away.
- **Reach** matters. The once-a-round Quick rule is out.

**Adopted (all PROVISIONAL switches in `src/rules/config.js`).**
- **AP in tenths** (`apScale 10`, `apDisplay 10`): costs like 1.5 with no rounding drift.
- **Pool** `3.5 + SPD/2`, unrounded: 6 at SPD 5, every point of SPD worth half an AP.
- **Cost curve** (`apCurve`): Specifics costs up to 2 stand; each AP above that costs 2. Thrust, parry, dodge and block
  2; swing 4; two-handed swing 6; power swing 2 + 4. Weapon speed multiplies: dagger thrust 1.5, club swing 3.4.
- **A move is a quick action** (`moveAP 2`): 2 AP for up to (1 + ⌊SPD/4⌋) × 2 squares (4 at SPD 5).
- **One big action** (`wholeTurnAction`): with nothing spent this round, one action dearer than the pool takes the whole
  turn. A SPD-4 fighter (5.5 AP) can still swing a two-handed warhammer (5.8).
- **Armor AP** (`armorActionAP 1/6`): the armor's SPD penalty adds AP to every action (plate +0.5, scale +0.3, mail
  +0.2) instead of shrinking the pool. The penalty still slows moving, initiative, dodging and fleeing.
- **Quick feats** (`quickCut 0.5`): every use; half the cost at the top rank.
- **Defences:**
  - Contested blocks: d10 + Shield Training + shield size (1–4) + ⌊(STR + DEX)/4⌋ against the blow.
  - Dodge −2.
  - A successful defence still costs stamina (`absorb`): block half the blow's force, parry a quarter, dodge none.
  - Dodge exertion 1 base stamina (Specifics 2).
  - Untrained against a sword swing: block 72% (3 + 4 stamina), parry 64% (3 + 2), dodge 36% (3 + 0).
- **Bind** (new feat, apprentice, needs Parry Training): a successful parry tries a disarm at once.
- **Longbow** shootAP 4 → 5, so it is a big action (2 to draw, 4 to loose) and no cheaper than the shortbow (4).
- **Removed:** the per-action surcharge and the once-a-round Quick rule.

**Level-1 preset party under these rules** (sheet AP):
- **Brenna** (longsword, SPD 5): pool 6; thrust 2, swing 4; parry, dodge and block 2; a move 2 for 4 squares.
- **Ysolde** (dagger): thrust 1.5, swing 2.8.
- **Osk** (warhammer, SPD 4): pool 5.5; two-handed swing 5.8 (the one-big-action rule).

**Encounters** (`tools/encounters.js`, 100 fights each). Columns: old (pool 10, flat feat cuts, old defences) / new AP
with old defences / old AP with new defences / **both**:

| encounter | won | dead per fight |
|---|---|---|
| undercroft_2/crew | 88 / 95 / 93 / **96%** | 1.78 / 1.27 / 1.39 / **1.22** |
| barrow/squad | 11 / 2 / 12 / **0%** | 3.54 / 3.89 / 3.39 / **3.74** |
| barrow/horde | 28 / 13 / 25 / **25%** | 1.33 / 1.93 / 1.54 / **1.62** |
| trollhole/wolves | 95 / 100 / 95 / **99%** | 0.78 / 0.44 / 0.63 / **0.34** |

**Duels** (`sim/run.js --n 60 --only builds,weapons,twoOnOne,length,gap`), old → new:
- **Armored against the fast duelist (gap):** a level-1 knight beats a level-4 duelist in a corridor 87% → 82%, a
  level-8 one 78% → 75%; the level-1 heavy 88–93% → 100%. Fleeing uses armor-reduced SPD, so the duelist always gets
  away from plate.
- **Two sellswords against one level-8 duelist** (Quick Thrust III, Quick Parry II): 13% → 57%. The flat −1 per rank let
  the duelist thrust for 1 AP; half at the top rank does not.
- **Builds (average win, open):** duelist 66 → 63%, sellsword 42 → 52%, knight 88%, heavy 81 → 89%, brute 30 → 33%,
  militia 18 → 20%, **brawler 14 → 1%**.
- **Weapons (mail):** rapier 80 → 91%, dagger 66 → 57%, spiked mace 34 → 24%, others within a few points.

**Reading.**
- **The defences behave as asked.** The new defences help the party against groups (horde 13% → 25% with the new AP).
  A milder dodge penalty (−1) helped the horde more than the party (25% → 12%), so it stays at −2.
- **Reach decides featless duels under both rule sets.** In a weapon matrix of level-4 fighters in mail without
  feats or shields, the spear beats everything 67–93%; it strikes first and fights end in round 1.
- **The brawler loses nearly every duel against an armed fighter** (14% → 1%). It has no weapon to parry with, a dodge
  now succeeds 36% of the time, and walking up to a greatsword (thrust reach 3) draws an opportunity strike per move.
  Exempting the grapple steps from the curve (tried, then removed) only reached 3%.
  - **The user's ruling:** this is realistic and stays. In 1v1, realism beats balance; a style gets its place from
    monsters and challenges built around it, not from its duel win rate.
- **The skeleton squad is now unwinnable at level 1** (11% → 0%), mostly from the new AP. The party's blunt weapons
  swing, and a swing now costs twice a thrust.

## Turns buy less: +1 AP on every action; Quick feats once a round per rank (2026-10-20, superseded the same day)

_Superseded by the turn budget above; kept for its sims._

### Turns buy less: +1 AP on every action; Quick feats once a round per rank (2026-10-20)

**The problem (the user's playtest).** At level 1 a fighter could move in, swing hard and move away in one turn: with
whole-pool turns nothing caps a turn, and a 10-AP pool held two steps and a 6-AP swing.

**Adopted (PROVISIONAL, `src/rules/config.js`).**
- **`actionSurcharge: 1`:** every action costs 1 AP more on top of its ×2 cost: moves, reactions and spells too;
  dropping a weapon is free. A sword thrust is 5, a swing 7, a parry 5, a two-squares step 2. Moving in, swinging a sword
  and moving away is 11 against a pool of 10. A dagger can still do it (9): the quick weapon's niche.
- **`quickPerRound: true`:** Quick feats (Thrust, Parry, Block, Dodge, Hands, Heavy Tempo, Casting) take 1 AP off as
  many such actions a round as their rank, not off every one.
- **The pool stays 3 + ⌊SPD/2⌋ × 2** (10 at SPD 5).

**Tried and dropped.**
- **Pool 5** (`apScale 1`, the user's first suggestion). Halving the pool and every cost leaves what a turn buys the
  same. Whole AP at that size also flattens weapon speed: every thrust rounds to 2 and every one-handed swing but the
  dagger's to 3.
- **All costs ×2.5 or ×3** (`costScale`). Heavy blows outgrow the pool: at ×2.5 a greatsword's two-handed swing costs
  11 against a pool of 10, at ×3 a warhammer's 12. Brute mirrors at ×3 time out at 30 rounds.
- **No surcharge on blocks, parries and dodges** (to favour reacting). It helped the party's foes more than the party
  (horde 21% → 13%), so it is out.

**Encounters** (`tools/encounters.js`, example party at level 1, 100 fights each):

| encounter (won; dead per fight) | old ×2 | pool 5 | costs ×2.5 | **+1 per action** |
|---|---|---|---|---|
| undercroft_2/crew | 88%; 1.78 | 94%; 1.24 | 98%; 1.08 | 96%; 1.06 |
| barrow/squad | 11%; 3.54 | 9%; 3.47 | 9%; 3.74 | 5%; 3.74 |
| barrow/horde | 28%; 1.33 | 34%; 1.10 | 31%; 1.58 | 21%; 1.78 |
| barrow/knight (rounds) | 4.4 | 5.3 | 6.1 | 7.1 |
| trollhole/wolves | 95%; 0.78 | 98%; 0.41 | 98%; 0.72 | 100%; 0.28 |
| trollhole/troll | 99%; 0.04 | 99%; 0.05 | 98%; 0.12 | 97%; 0.39 |

**Duels** (`sim/run.js --n 60 --only builds,weapons,twoOnOne,length`; every column but "old" has Quick feats once a
round):

| measure | old ×2 | pool 5 | costs ×2.5 | costs ×3 | **+1 per action** |
|---|---|---|---|---|---|
| 2 sellswords vs one L8 duelist (pair wins) | 13% | 60% | 83% | 98% | 90% |
| 2 sellswords vs one L8 heavy (pair wins) | 12% | – | 47% | 5% | 2% |
| heavy mirror L4: median rounds; deaths | 3; 0.53 | 3; 0.25 | 7; 0.17 | 7; 0.17 | 4; 0.73 |
| militia mirror L8: median rounds | 5 | 17 | 8 | 16 | 8 |
| weapons in mail: dagger / rapier / longsword | 66 / 80 / 66 | 49 / 87 / 69 | 60 / 80 / 77 | 65 / 81 / 68 | 59 / 89 / 72 |
| weapons in mail: club / greatsword | 20 / 57 | 21 / 61 | 15 / 59 | 18 / 67 | 12 / 57 |

**Reading.**
- **Why a flat surcharge over a multiplier.** The complaint is about turns of several actions. A surcharge taxes a
  three-action turn three times and one big blow once, and leaves the gap between weapons as it was. A multiplier hits
  the heaviest blows hardest. Under the surcharge, heavy-weapon mirrors stay short and deadly (4 rounds, 0.73 deaths),
  where ×2.5 made them long and safe.
- **The Quick cap is what tames the high-level duelist.** With the surcharge but the cut on every use, two sellswords
  beat a level-8 duelist 42% of the time; once a round, 90%. The same build won 87% under the old rules.
- **Costs.**
  - **Groups are deadlier:** squad 11% → 5%, horde 28% → 21%. That adds to the turn-model retune already on the list.
  - **A level-8 plate heavy now beats two sellswords 98% of the time** (88% before).
  - **The club fell further** (20% → 12%).
  - **Drawing a weapon and reading intent cost 2.**
- Single-number sweeps: `--set actionSurcharge=0|1|2`, `--set costScale=2.5`, `--set quickPerRound=false`. At +2,
  militia mirrors at level 8 time out and knight mirrors at level 4 run 30 rounds.

## Whole-pool turns with reactions replace passes (2026-10-19; `node tools/encounters.js`)

**The change (the user's model).**
- **Turns:** each character takes one turn per round and may spend their whole AP pool on it. Every action resolves as
  it is taken.
- **Reactions:** defences are no longer declared ahead. When a blow comes, the target may block, parry or dodge, paying
  from the same pool. A step that starts inside a foe's melee reach lets that foe strike as the mover goes, and a hit
  stops the move.
- **Removed:** passes, the per-pass cap (`apPerPass`), late-landing actions (`spanLands`), guards (`guardLasts`), the held
  point (`readyStrike`) and "struck, so you lose your move".
- **Reinterpreted:** Feint now means the defender chooses a defence blind, and a wrong guess is wasted.
- **The AI:**
  - It keeps AP back for one cheap defence per foe still to act who could reach and hurt it.
  - It defends when the blow's value through armour, times its odds, beats the AP. An AP is worth twice as much while
    its own turn is still to come.
  - It takes an opportunity strike when worth it.
  - It prices opportunity strikes into where it moves.

**Encounters, example party at level 1, 30 fights each.**

| encounter | won, passes → now | dead per fight, passes → now |
|---|---|---|
| undercroft_1/rat_nest | 100% → 100% | 0.00 → 0.07 |
| undercroft_1/guards_one | 100% → 100% | 0.13 → 0.33 |
| undercroft_2/crew | 97% → 80% | 0.90 → 1.87 |
| undercroft_2/store_guards | 100% → 100% | 0.10 → 0.10 |
| barrow/squad | 70% → 27% | 1.53 → 3.13 |
| barrow/horde | 57% → 13% | 1.33 → 1.63 |
| barrow/knight | 0% → 0% | 3.13 → 3.97 |
| trollhole/wolves | 100% → 90% | 0.60 → 0.93 |
| trollhole/troll | 100% → 100% | 0.43 → 0.10 |

**What the instrumented runs show (barrow/squad, 30 fights).**
- **Opportunity strikes:** about 240 were offered and about 220 taken.
  - The party drew most of them: about 6 per fight.
  - Many came from the archer and the mage stepping away from skeletons that had reached them. That is the trade-off
    the rule creates, not a bug.
- **Defending:** the party defended about 80% of the blows it could; the skeletons about 60%.
- **AP kept back:** about 3 of 10 AP at the end of each party turn.

**Reading.**
- **As expected, groups and the side that acts first gain most.** Two attackers drain one defender's pool, and the
  second attacker's blows land unanswered.
- **Fights against single big creatures got easier:** the troll lost most of its kills.
- **Fights against armed groups got much deadlier:** skeletons, the horde, Rusk's crew.
- **The AI is a large confounder.** Its reserve, its defend threshold and how it weighs walking past reach are first
  drafts. Before retuning any rule number, tune the AI's choices and re-run.

**Levers if it stays too deadly** (fundamentals, not monsters):
- the AP cost of a parry or dodge relative to an attack;
- the pool size;
- whether a failed defence still costs its full AP;
- making opportunity strikes optional per weapon (only reach weapons).

## The death knight as a recurring foe (`node sim/dk-scaling.js`, page: `sim/dk-scaling-page.js`)

The death knight was run at levels 5, 10, 15 and 20, with a martial or caster build and four
cumulative gear tiers, against the core trio plus a mage, cleric, duelist or grappler at party
levels 2, 6 and 15. There were 30 fights per cell. "Consistent" means he wins at least 80%
against every lineup.

| His level | vs early (L2) | vs mid (L6) | vs high (L15) |
|---|---|---|---|
| 5 | caster, legendary plate and adamant shield | caster, full gear | none |
| 10 | caster, legendary plate and adamant shield | caster, full gear | none |
| 15 | martial, legendary plate and adamant shield | caster, full gear | none |
| 20 | caster, basic gear | caster, full gear | none |

- **Gear matters more than his level.** His attributes are at the human cap throughout, so level
  only adds feats.
  - Against mid parties, the sash and the aura take him from 30–73% to 97–98% at every level.
  - A level-5 caster in full gear beats level-6 parties 98% of the time.
- **Magic matters at every level.** The martial build never beats mid parties consistently: 60%
  at best, even at level 20 in full gear.
- **High parties beat every version, and the duelist and grappler are why.**
  - At level 20 in full gear he beats the mage and cleric lineups 93–97% of the time, but the
    grappler lineup only 40% and the duelist lineup 17%.
  - The duelist's speed and the grappler's hold (plate is easy to grab) get past his plate and
    shield.
- **For a recurring villain:**
  - Early parties: a level-5 to level-10 caster with legendary plate and the adamant shield.
  - Mid parties: the same with the sash and the aura.
  - High parties: he needs a counter to grapplers and duelists, which no feat or item he has
    gives him.

## Weapon strain, impact and force parries (party arena at level 5; arena baseline `arena-r13`)

- **Duels barely moved.** Strain was calibrated so the arena builds keep their speeds; every
  style-against-style rate is within about 4 points of before.
- **Big creatures became deadly.** Their blunt blows now crush (CON as well as stamina), knock
  back, and can't be parried by an ordinary weapon. Party win rate and deaths per fight:
  - The troll chieftain kills 2.3–3.0 of the party per fight and loses only 0–35% (was 3–83%
    with almost no deaths).
  - The cave troll drops to 15–98%, with up to 2.4 deaths.
  - The ogre and the hill giant kill 0.5–2.4.
- **The weapon must suit the creature.** STR-3 kobolds with a man's spear strained 1.9×, and the
  band went from a coin flip to losing every fight. With a short spear they are back to dangerous:
  the light party wins 0–25%, full parties 55–98%.
- **Thrust load (70% of the mass) keeps an ordinary spear easy for an average person.**

## The gauntlet by party level (`node sim/gauntlet.js --level 2|6|15`, then `node sim/gauntlet-page.js --levels`)

There are 13 rooms: a rat, a rat swarm, a wolf, then the eight earlier rooms, then the spectre and
the death knight. Camps fall after rooms 4, 8 and 11. Party levels:

- **Early:** level 2, standard gear.
- **Mid:** level 6, fine gear.
- **High:** level 15, masterwork gear and magical weapons.

There are 100 runs per lineup per mode. Mean rooms cleared in a row (attrition) / won by a fresh
party (reset):

| Lineup | L2 | L6 | L15 |
|---|---|---|---|
| Core trio | 4.8 / 6.5 | 5.5 / 8.1 | 7.6 / 11.3 |
| + Mage | 5.0 / 8.5 | 5.8 / 10.5 | 8.4 / 12.0 |
| + Cleric | 5.4 / 7.5 | 7.3 / 9.9 | 9.3 / 11.9 |
| + Duelist | 6.3 / 8.8 | 7.8 / 10.4 | 10.2 / 12.6 |

- **Level carries the run as it should.** Each step up buys about 1–3 rooms. Under attrition,
  early parties stall at the kennels and the trapped corridor. Mid parties stall at the cistern
  and the kobold warren. High parties reach the chieftain.
- **The spectre separates the styles.** Without magic weapons, only spells hurt it. At level 6 the
  mage party wins against it 75% of the time and the cleric party 34%; every party without a
  caster wins 0–3%. With the high-level party's magic weapons, everyone beats it.
- **The death knight is beaten only by high grapplers and duelists.** At level 15 with a fresh
  party, the trio plus the duelist wins 65% and plus the grappler 50%. Every other high lineup
  wins 0–2%. Grappling gets past his plate and shield; so does the duelist's speed.
- **A member's worth changes with level.**
  - The cleric adds most at level 6 under attrition: +1.80 rooms, the most of any member there.
    Healing matters when wounds are what end the run.
  - The early mage adds almost nothing under attrition (+0.24). It dies in the rat swarm 71% of
    the time, because the rats surround the unarmored.
  - At level 6 at full strength, the mage adds +2.40 rooms (bands and the spectre).
- **The enchanter adds the least at every level** (+0.17 to +1.12).

## Arena after the AI fixes (baseline `sim/results/arena-r12`)

The fixes: a character kites only when its ranged attacks beat its melee; bursts can land beside
foes; a raise goes to a body where it lies; a caster who can raise keeps spell points for it; one
read of intent a round. Open field, head to head:

- **The cleric gained most.** It averages about 51%, up from 42%, because it now closes in with
  its mace instead of kiting. It beats the enchanter 82%, the mage 64% and the archer 54%, and
  now splits even with the grappler (50%).
- **The enchanter rose a little** (it reads intent less), and is still the weakest duelist.
- **The other styles moved by sampling noise** (within about 5 points).

## The death knight against level-5 parties (`node sim/gauntlet.js --rooms boss --mode reset`)

The death knight is a level-20 character with an aura of dread and a silk sash (14 AP). He was
run against every gauntlet lineup at level 5, fresh each time, 100 fights per lineup per room:
alone in his chapel, and with two skeletons.

- **He wins essentially every fight.** The only wins against him are 3 of 100 for the trio plus
  the grappler, alone in the chapel. Grappling is the one crack: plate is easy to grab.
- **The deaths show where his power lands.** With him alone, the two-hander dies in 47–98% of
  fights (the most) and the knight in 9–33% (the least). With the skeletons, the archer dies in
  88–94% of fights and the casters in 92–93%.
- **As a benchmark, he is past what level-5 parties can measure.** Every difference between
  lineups reads zero. The next step is parties of higher level, not a weaker knight.

## The cleric: Restore + Life, Wide and Name (gauntlet)

The cleric is a mage in mail with a mace who knows Life, Light and Force. Its spells are Restore
(plain, Wide and Name) and a Strike bolt; Light doubles against the undead. It was run as the
fourth member with the core trio, 100 runs per mode, paired with the other lineups.

| | Attrition: rooms cleared | Reset: rooms won | Adds (attrition / reset) | Dies |
|---|---|---|---|---|
| + Cleric | 3.10 | 5.14 | +1.19 / +1.55 | 61% of runs / 1.8 per 8 rooms |
| + Mage | 2.81 | 5.23 | +0.90 / +1.64 | 94% / 3.6 |
| + Enchanter | 2.19 | 4.71 | +0.28 / +1.12 | 99% / 5.0 |
| + Duelist | 3.78 | 6.11 | +1.87 / +2.52 | 80% / — |

- **Under attrition, the cleric is the second-best fourth member,** behind the duelist and level
  with the grappler. Healing keeps the party going: 95% clear the kennels, against 85% with the
  mage.
- **It has a room of its own: the crypt.** It wins there 30% of the time, the best of any lineup
  (duelist 25%, mage 11%). Light burns the skeletons.
- **It's weaker than the mage against bands** (the kobold warren: 21% against 42%).
- **It survives where the other casters don't.** It dies about half as often as the mage, because
  it wears mail and its party keeps itself standing.
- **One-on-one (arena), the cleric is a middling duelist.** Averaged over its opponents, it wins
  about 42% in the open field and 49% in close quarters. It beats the other casters (mage 54–66%,
  enchanter 71–72%) and archers in close quarters (79%). It loses to the duelist and the grappler
  up close (22–26%) and to sword and shield. Head to head, the matchups between the older styles
  stayed within sampling noise of the baseline taken before the cleric (`sim/results/arena-r11`).

## The gauntlet: an eight-room crawl (`sim/gauntlet.js`)

A level-5 party fights eight rooms in order, from goblins to the troll chieftain. The rooms have
pillars, pits, rough ground, darkness, hot coals and hidden trap runes. There are two modes, each
with 100 runs per lineup and the same seeds for every lineup:

- **Attrition:** one party goes through all eight rooms. Wounds, spell points, arrows and shield
  damage carry on. There is a breather between rooms and a camp (the long-rest rules) after room 4.
  The run ends at the first room lost.
- **Reset:** a fresh, full-strength party fights every room, with the dead restored. Every room is
  tested, and deaths are recorded room by room.

The lineups are a core trio (knight, mail two-hander, archer), the trio plus each fourth member,
and the mage party with each core member left out.

| Lineup | Attrition: rooms cleared | Reset: rooms won (of 8) |
|---|---|---|
| Core trio | 1.91 | 3.59 |
| + Enchanter | 2.19 | 4.71 |
| + Mage | 2.81 | 5.23 |
| + Grappler | 3.07 | 5.08 |
| + Duelist | 3.78 | 6.11 |

**What a member adds.** Each number is the score with the member minus the score without, paired
on seeds (attrition / reset, ± about 0.15):

| Member | Attrition | Reset |
|---|---|---|
| Two-hander | +1.76 | +3.01 |
| Duelist | +1.87 | +2.52 |
| Knight | +0.99 | +1.84 |
| Mage | +0.90 | +1.64 |
| Grappler | +1.16 | +1.49 |
| Archer | +1.05 | +1.47 |
| Enchanter | +0.28 | +1.12 |

- **The camp barely helps.** Few runs reach room 5, and a long rest heals only one point of CON. It
  adds only 1–3 points to the share of runs that clear the cistern. Attrition is decided by the
  kennels and the trapped corridor.
- **Reset mode shows the differentiation the attrition mode hid.** Each fourth member has a room
  where it is the best pick:
  - Mage: the kobold warren, 42% against 8–22% for the enchanter and grappler. Area spells work
    against a band.
  - Grappler: the cistern, 62%.
  - Enchanter: the chieftain's hall, 44% against 14% for the core trio. Mind spells work against
    a lone big foe.
  - Duelist: best or close to best in every room.
- **The hardest rooms at full strength** are the crypt (skeletons: 4–25% wins) and the kobold
  warren (3–42%). The troll den is easy fresh (86–100%) but a wall under attrition.
- **The casters die.** At full strength, out of eight fights, the enchanter dies 5.0 times, the
  mage 3.6 and the knight 0.5. The enchanter dies even in the gatehouse (60%). Its value is
  real when it's fresh (+1.1 rooms), but it can't keep itself alive, and nothing lets the knight
  protect it.

## Magic phases 2 and 3 (mind, body, venom, light and shadow; rituals)

A new arena style, the **Enchanter**, is a mind mage: Hex and Beguile with Dream, Rage, Calm and
Fear, a Force ward and Blink, with Word Doubling (Dream + Rage confuses). Rituals are out of
combat and not simulated. The baseline is the phase 1 run (`sim/results/arena-r10`).

- **The enchanter is the weakest duelist in the arena.** It wins 24% on average in the open
  field and 27% in close quarters. It wins no matchup on either map, losing 6–10% to sword and
  shield and to rapier and dagger. Against archers it is about even (48% open, 41% close). During
  development it beat archers about 95%. I haven't diagnosed the drop; my best guess is that the
  later changes to read intent and the ward pool cost it its edge. Mind spells use fixed durations
  with no saves each round, so this is a draft number.
- **The other styles barely moved.** Head to head, every matchup among the six old styles is
  within about 5 points of phase 1, which is sampling noise. The armor-by-style averages rose
  2–9 points for most styles because they all get to fight the weak enchanter.
- **Parties: no clear change.** The party with a mage (which still runs the phase 1 mage) and
  the veterans are within about 10 points of phase 1 everywhere. Each cell has 40 fights, so a
  10-point gap is under two standard errors. Kobold band, open field: veterans 53 → 48%, mage
  party 78 → 63%. Froglok patrol, open field: veterans 45 → 57%, mage party 73 → 70%. The
  kobold drop for the mage party is the largest, and it is still within noise.

## Magic overhaul, phase 1 (with wards, blink, bait and read intent)

The arena mage is unarmored or armored like everyone else. It knows Fire, Earth, Vine and Force;
its verbs are Strike, Ward, Launch, Build and Blink, and it has Casting II.

- **One-on-one, the mage is a middling style.** It averages 42% in the open field and 39% in
  close quarters, against 48–60% for the melee styles. It beats archers 80% in the open and 57%
  up close: its ward of force soaks arrows. It loses to sword and shield (18–23%), whose shields
  block bolts.
- **In a party, magic is a force multiplier.** Compare a party with a mage in place of the
  grappler (knight, mail two-hander, archer, mage) with the veterans. Wins in the open field / the
  cramped room:

  | Encounter | Veterans | With a mage |
  |---|---|---|
  | Kobold band | 53 / 45% | 78 / 55% |
  | Froglok patrol | 45 / 50% | 73 / 70% |
  | Wolf pack | 100 / 88% | 100 / 100% |
  | Troll chieftain | 65 / 57% | 85 / 50% |
  | Skeleton squad | 23 / 20% | 30 / 48% |
  | Zombie horde | 55 / 15% | 15 / 28% |

  Deaths per fight drop by about half against the bands. The zombie horde in the open is the
  exception, and I haven't diagnosed it.
- **New actions in use** (240 sample duels): 342 reads of intent, 74 wards, 72 blinks, 28 walls,
  12 baits. Read intent is used almost every round a melee fighter is engaged, which may be too
  automatic for 2 AP. Bait is rare because the AI only baits a foe whose guard it can already see.
- **Engine changes behind this:** square-by-square movement around walls, line of sight for
  missiles and reach, timed conditions, and casting at 2 base AP (bolts at 3 cost a third of a
  sword thrust's value).

## Opposed parries and dodges, parrying dagger, natural weapons from physics

- **Parry and dodge are opposed rolls.** Defender d10 + Training + ⌊(DEX + SPD)/4⌋ (armor-reduced)
  against attacker d10 + ⌊(STR + SPD)/4⌋ + motion penalty. A parry also faces +1 per weight class
  the attacking weapon has over the parrying one. Ties go to the defender, so equal fighters parry
  about 55–65% of the time. A STR-20 troll is much harder to dodge. **A power blow can't be
  parried**, only dodged or blocked. Block keeps its target number.
- **Parrying dagger** (main-gauche, 0.45 kg): held in the off hand (no shield, no two-handed
  weapon). It stabs (off-hand thrust, 2 AP), and its Off-hand parry (2 AP on the sheet, +1)
  meets thrusts only. New arena style **Rapier & dagger** (DEX 7, SPD 7; Parry Training II,
  Riposte, Quick Thrust, Quick Parry, Lunge, Precision).
- **Natural weapons come from physics:** jaw or limb mass and length, teeth depth and width,
  claw edge, fist mass. STR counts in full, since the body drives the blow; the weight class stays
  the catalog's. Bites got lighter (wolf 4 → 3, zombie 3 → 1); fists heavier (troll 7 → 10,
  golem 8 → 11, tail 4 → 6); the displacer's tentacles hit for 2/2/6 rather than 3/2/3.

Arena (now five styles, so averages move with the field), open field / close quarters:
two-handed 52 / 59%; sword and shield 59 / 53%; grappler 35 / 39%; rapier and dagger 47 / 60%;
archery 45 / 29%. Rapier and dagger beats sword and shield 76% in close quarters (its off-hand
parry catches thrusts, and the shield fighter's AI mostly thrusts) but loses 40% in the open.
Successful off-hand parries: 0.15–0.19 per fight for the duelist. Parries with the main weapon
are rare for every style (the AI seldom picks them).

Parties against groups (veterans, open / room), before → after: zombie horde 33/35 → 65/40%
(zombie bites now do 1); displacer pair 75/83 → 83/85%. Light party against the cave troll
85/78 → 73/70% (fists 10 + STR).

## Ready a thrust, fend off, shoves spoil a move

The user asked for a way to hold a foe off. **Ready a thrust:** on your turn you hold a long
thrust ready, paying its AP now and its stamina only if you make it. It lasts the pass. A foe
whose move brings them closer and into its reach is thrust at first, where they enter the reach.
A hit stops the advance, and their guards meet it as usual. **Fend off:** a long weapon shoves
at range 2, and a ready shield adds +1. **A shove that drives a foe back or floors them spoils
their move that pass.**

The AI readies only against a move a foe has already declared this pass. A foe still to act
would see the point and wait: with speculative readies, mirror matches in close quarters stood
off and timed out every fight. So the advantage goes to whoever acts later, as the user wants.
When planning a distance, the AI counts the cost of walking past a long thrust (half its rate,
once). It puts up a guard before stepping onto a point it can see, or doesn't step.

Unarmored sword and two-hander duels (320 fights): fights where someone drew the dagger 240 → 65;
fighters met a readied point 310 times and were stopped 131 times; mean length 1.57 → 1.24
rounds. All unarmored pairings (2,000): both die 2% (34% in the sword-and-shield mirror in the
open, the same pass); no timeouts.

Arena by style, open field / close quarters, weapon pass → now: two-handed 48 → 49 / 47 → 58%;
sword and shield 61 → 59 / 66 → 62%; grappler 33 → 33 / 45 → 41%; archery 49 → 49 / 32 → 32%.
In close quarters the greatsword's reach-3 point holds the line. Parties against groups
recovered some (veterans, open / room): kobold band 60/53 → 80/48%, wolf pack 90/50 → 90/83%.
Skeletons and zombies don't care: they're tireless and immune to the point.

## Weapons from physics and the wound roll (`CONFIG.weaponModel: 'physical'`)

Each weapon has a mass, a length, hands and a point (depth, width), an edge or a head
(`data.js` `phys`). `Items.weaponStats(item)` works out the faces, AP speed, weight class, STR
multiplier and wounds from those. Every rules reader goes through it, so materials and enchantments
can act on its inputs or outputs later. `weaponModel: 'table'` brings back the hand-set values.
A blow that reaches the body rolls a d10 wound roll (vital = ×3 CON, double bleeding; vital cuts
take their damage again from CON), and armor guards the vitals. Baseline: `results/arena-r9base`.

One blow on an unarmored CON-9 target, killed outright / killed if the bleeding goes untended
(4,000 trials per row, engine code):

| | STR 5 | STR 13 | vs mail, STR 13 | Old table, STR 5 |
|---|---|---|---|---|
| Dagger thrust (3 AP) | 10 / 10% | 9 / 9% | 0 / 0% | 0 / 100% |
| Rapier thrust (4) | 20 / 20% | 20 / 100% | 0 / 0% | 0 / 100% |
| Longsword thrust (4) | 20 / 100% | 20 / 100% | 0 / 11% | 0 / 100% |
| Longsword cut (6) | 2 / 26% | 9 / 100% | 0 / 0% | 0 / 55% |
| Greatsword thrust (4) | 31 / 100% | 100 / 100% | 0 / 74% | 0 / 100% |
| Spear thrust (4) | 30 / 100% | 100 / 100% | 0 / 73% | 0 / 100% |
| Warhammer beak (6) | 21 / 21% | 100 / 100% | 0 / 8% | 0 / 100% |

Arena (40 fights per pairing), average win rate by style, open field / close quarters, before →
after: two-handed 45 → 48 / 37 → 47%; sword and shield 57 → 61 / 61 → 66%; grappler 44 → 33 /
60 → 45%; archery 49 → 49 / 36 → 32%. Grapplers lose the most because their dagger now does 3
rather than 5. Letting a pin open the armor's guard on the vitals (`vital.pinnedOpensArmor`) moved
them less than a point.

Unarmored duels (all style pairings, 2,000 fights): both die 2% → 0%; at least one dead counting
untended bleeding 95% → 87%.

Parties against groups got much harder (veterans, open / room): skeleton squad 95/90% → 50/35%,
zombie horde 85/78% → 30/20%, wolf pack 100/100% → 90/50%, kobold band 90/90% → 60/53%. Two
causes. Party blows are weaker: swords cut 6 rather than 7, greatsword cuts are lower, and the
grappler's dagger does 3. And monsters' natural weapons are still on the old table with full STR.
They haven't been given physical descriptions yet.

The AI still steps inside a sword's reach with a dagger. At range 2 its rate is 40 but the foe's
threat is just as high; at range 1 the foe's sword is a half-force blunt jab, and the dagger's
rate is 20 against a threat of 3. That's a reach and positioning rule question, not damage.

## Monster attributes past the human range

Humans run 1–10, 13 with Conditioning feats. Big creatures now go past that (CONFIG.monsterAttrMax 30,
PROVISIONAL): cave troll STR 20 / CON 18, owlbear 18/16, stone golem 22/22, troll chieftain 24/24,
sarnak 12/11, displacer 12/11, rust beetle 10/12, giant spider 8/6, zombie STR 9. Wolves and the small
humanoids stay in the human range. No formula changed: STR 20 gives +7 damage and +10 to grapple.
The chieftain's boss multiplier fell from ×2.5 AP and stamina to ×2 AP only, since CON 24 already
gives it the stamina. Baseline: `results/monsters-r8`.

One-on-one, monster wins (before → after): rust beetle 56 → 89%, displacer 56 → 83%, owlbear
55 → 86%, cave troll 82 → 99%, stone golem 78 → 90%, sarnak 66 → 90%, zombie 51 → 62%, spider
61 → 65%. A troll now beats any lone level-5 human, as it should.

Against parties (party win rate, before → after):

- Veterans still beat every single monster except the chieftain. The chieftain was 95–100% for
  the veterans and is now 40–53%; the light party went from 63–68% to 5–10%. Its multiplier
  variants (veterans open / room): ×2.5 AP ×1.5 stamina 18/18%; ×2 AP 70/50% at n = 40; ×1.5 AP
  70/78%.
- The cave troll drops to 83–90% against the light party (was 100%), and the sarnak to 88–95%.
- Sarnak pair against the light party: 83% → 10–13%. Displacer pair: 90–100% → 38–75%.
- Stone golem against the light party: 100% → 15–18%. That party carries no blunt weapon, and
  they're beaten unconscious over about 14 rounds.
- The zombie horde against the veterans: 78–85% → 50–68%.

## Party arena, tireless undead, scaled humanoids, odd properties

Runs: `node sim/monsters.js` (one-on-one, 30 per pairing per arena), `node sim/party-arena.js`
(40 per cell): two parties (veterans: plate knight with shield, mail two-hander, archer,
grappler; light: leather shield, archer, unarmored grappler) against 19 encounters in an open
field and a cramped 8×4 room. Both sides now pick targets as a team (engaged or hurt foes first).

- **Groups, not single monsters, threaten a party.** Every single creature loses to both parties.
  Against the light party: kobold band 87–90% win, zombie horde 100%, froglok patrol 72–90%,
  skeleton squad 72–85%, wolf pack 25%. Veterans beat every group but lose 55% to frogloks in the
  open and about one person a fight to kobolds.
- **Tireless** (undead, constructs): no stamina, damage to attributes (blunt to CON), no bleeding
  or venom, act on every AP. Skeletons (no piercing, half slashing) beat archers 88–93% and
  dagger grapplers 100%; two-handers beat them. The stone golem loses only to two-handers. Zombies
  (piercing halved) beat archers 68–95%.
- **Humanoids:** kobolds and goblins are weak alone (8–19%) and strong in bands; frogloks
  (leaping, slippery) are the strongest small humanoids; sarnak 63–70% one-on-one.
- **Odd properties:** springy chitin (each landed blow costs the attacker 3 stamina); sticky webs
  (each layer +2 AP and +3 stamina on every action; one layer wears off per round). Webs took the
  spider from 55% to 68–82% one-on-one (and to 60%+ against plate) before the wear-off; with it,
  61–62% (35% against plate). The spider had to stop kiting: with a ranged web the AI treated it
  as an archer and fights ran to timeouts.
- The displacer (attacks roll to find it) and the displacer pair still don't threaten a party.

## Monster draft (`sim/monsters.js`, `sim/monster-party.js`, page `results/monsters/report.html`)

Seven monsters and a boss, each built to beat one kind of fighter, against all 16 level-5 arena
fighters (30 fights per pairing per arena) and two parties of three (40 per arena). "Edge" =
(win rate vs target − own average) − the same for the other single monsters, so fighters' own
strength by armor doesn't mislead.

| Monster | Built to beat | 1v1 open / close | Edge | Vs a party |
|---|---|---|---|---|
| Wolf | (baseline animal) | 38 / 50 | — | 0% |
| Wolf pack (alpha + 2) | anyone alone | 97 / 99 | — | 3–30% |
| Rust beetle | plate | 48 / 55 | +20 / +26 | 0% |
| Displacer beast | archers | 54 / 57 | +7 / −6 | 0% |
| Giant spider | the unarmored | 55 / 56 | +13 / +10 | 0–3% |
| Owlbear | two-handers | 44 / 66 | +15 / +2 | 0% |
| Cave troll | sword and shield | 78 / 87 | +9 / +10 | 0% |
| Troll chieftain (boss) | a whole party | 100 / 100 | — | 30–60% |

- **Action economy dominates.** A lone monster loses to a party of three almost every time, even
  the troll that wins 78–87% one-on-one. A boss needed AP, per-pass allowance and stamina ×2.5 and
  CON 15 to win 23–60% against a party (×2: 0–43%; ×3 with CON 15: 65–83%).
- Rust beetle and giant spider work as counters. Owlbear works in the open; in close quarters it
  beats nearly everyone. Displacer misses: arena archers drop the bow for a dagger as soon as
  anything fast closes, so displacement against arrows rarely matters. The troll beats everyone,
  so it reads as a boss, not a shield counter.
- Engine additions: natural weapons and armor; traits knockdown, pack, venom, rust, displacement,
  shieldCrush, regen, and boss multipliers (apMult raises the pool and per-pass allowance,
  staminaMult). Fixed along the way: natural attacks couldn't be wound up (the wind-up check
  wanted a weapon in hand).

## Round 9: arrows and armor (history), broadheads and bodkins

Changes (PROVISIONAL; the user agreed after a look at the historical record: good plate was close
to arrow-proof, mail over padding was penetrable but wounds were shallow, padded textile was
surprisingly good, arrowheads were specialized):

- Extra piercing protection against arrows only: padded +2, leather / mail / scale +1, plate 0.
- Broadheads: bleed ×1.5, +1 protection for metal armor. Bodkins: −1 damage, −2 protection for
  metal armor. Arena archers carry 20 broadheads and 10 bodkins; the AI picks per target.

Results (against `results/arena-r8/`):

- Archers 46 → 49 (open), 31 → 36 (close); other styles within 2 points.
- Archers vs plate wearers 9 → 15 (open); vs mail unchanged; vs leather 20 → 36 in close quarters,
  almost all from broadhead bleeding (leather two-handers hit hardest). The bleed multiplier is
  the knob if that's too strong.

## Round 8: the grappling ladder, and a grappler style in the arena

Changes (PROVISIONAL, designed with the user): free → clinch (mutual) → hold → pin, plus throw and
break; every step a directly opposed d10 roll (⌊STR/2⌋ + Grappler; breaking may use DEX + Escape
Artist); win by 5+ for two steps, lose by 5+ to reverse. Clinch: no two-handed swings or bows, no
stepping away. Hold: the held fighter is cramped (dagger too) and can't move; the holder keeps a
dagger hand and can drag. Pin: only breaking; piercing and Coup de Grâce go through armor (a mere
hold no longer opens armor). Armor option 4: plate +2 to be grappled or pinned (mail and scale +1),
footing against throws. Guards never meet grapples. Arena: a Grappler style (padded through plate,
dagger, Grappler ×2, Brawler's Wind, Trip, Toughness, Strength at level 5).

- Grapplers average 45% open / 61% close. Close quarters: 69% vs two-handers, 80% vs archers,
  43% vs sword & shield.
- By opponent armor, close / open: plate 48 / 33, mail 70 / 45, leather 63 / 45, unarmored 74 / 53.
- Ladder use per fight with a grappler: clinch 0.43, hold on a big win 0.49, pin 0.34, dagger
  stabs 1.3, successful breaks 0.30, holder too spent to keep the hold 0.23. No throws: the AI pins
  and stabs.
- The other styles moved at most 2 points against the opponents they already had.

## Round 7: steep stand-up cost by armor; exhausting grapples

Changes (PROVISIONAL, the user's calls): getting up from prone costs base AP / stamina 1/1
(none to leather), 2/2 (mail), 3/3 (scale), 4/5 (plate), capped at the AP pool; on the sheet a
plate fighter spends the whole round (8 AP) and about 16 stamina. Grapple 5, takedown 6, escape 3
base stamina, plus 2 base stamina upkeep per round of holding.

Result: **no measurable change** (every style and armor average within 1 point of round 6). The
arena barely exercises these rules: in a 528-fight sample there were 0.011 knockdowns and no
grapples per fight (kicks 0.12 a fight, rarely winning by the 3 needed). Testing them needs a
grappler/tripper fighting style and an AI that goes for knockdowns against plate.

## Round 6: blunt blows inside reach, cheap draws, cramped grapples; magic users dropped

Changes (PROVISIONAL, the user's calls):

- **Inside a long weapon's reach** (range 1), its blows land at half their total force, all blunt
  (`range.closeRule: 'blunt'`). A spear can jab with the shaft again.
- **Drop weapon** costs 0 AP; **drawing** a weapon costs 1 AP on the sheet (was 4). Drawing while
  holding a non-dagger drops it; a dagger is sheathed. Pick up costs 4. Several weapons can lie on
  the ground; they're gathered after the fight.
- **Held in a grapple**, any weapon (dagger included) fights cramped (`grappledWeaponsCramped`).
- **Magic users are out of the arena** for now (`--with-magic` brings them back). Round 5 numbers
  below are recomputed over the same twelve fighters.

| | Open field | Close quarters |
|---|---|---|
| Two-handed | 32 → 40 | 38 → 43 |
| Sword & shield | 64 → 60 | 73 → 64 |
| Archery | 50 → 44 | 33 → 38 |
| Best − worst style | 32 → 20 pts | 40 → 26 pts |
| Heavy armor | 74 → 81 | 71 → 76 |
| Unarmored | 27 → 25 | 29 → 22 |

- Weapon styles are the most even they've been; sword & shield lost most where it relied on
  stepping inside reach with a dagger.
- Cramped blows are rare (about 0.1 a fight); the AI mostly drops the long weapon and draws a
  dagger instead (0.3–0.95 times a fight).
- Armor now dominates: plate fighters win 64–87%, unarmored 11–35%. Likely (not isolated) because
  cramped blows are blunt, which plate soaks, where before a dagger's piercing got through.

## Round 5: guards instead of a defense step

Change (PROVISIONAL): defenses are **guards** readied on your own turn: a block, parry or dodge
that meets the next attack landing on you this pass, or the next from a foe you name. A guard
lapses at the end of the pass (`guardLasts: 'pass'`). A guard that can't meet an attack (a parry
against an arrow) stays up. There is no longer a defense step; the user found one arbitrary,
and wants saved AP (late actions the spent can't answer) to be the main edge.

Results (40 fights per pairing; compared against `results/arena-r4/`), open / close:

| Rules | Two-handed | Sword & shield | Archery | Heavy armor | Spread | Rounds |
|---|---|---|---|---|---|---|
| Round 4 (defense step, cap 4) | 35 / 53 | 63 / 72 | 55 / 43 | 54 / 70 | 28 / 29 | 5.6 / 3.8 |
| **Guards, end of pass (default)** | 35 / 50 | 68 / 78 | 52 / 41 | 53 / 64 | 33 / 37 | 5.9 / 4.3 |
| Guards last the round | 35 / 48 | 69 / 78 | 51 / 41 | 53 / 63 | 34 / 37 | 5.9 / 4.2 |
| Guards, cap 6 | 46 / 51 | 65 / 73 | 57 / 50 | 52 / 64 | 19 / 23 | 5.5 / 4.2 |

- Guards favor sword & shield: a 2–4 AP block can be readied blind and still leave room to attack.
  Defenses rose about 40%, hits fell about 10%, fights got slightly longer.
- Guard duration doesn't matter with this AI (it guards against attacks due this pass).
- Guards with a 6-AP cap are the most even version so far (spread 19 / 23).
- Actions per turn (separate measure, 4 fights per pairing, cap 4): mean 0.82, variance 0.30;
  26% of turns are empty, 66% one action, 8% two. Only sword & shield regularly fits two (17%).

## Round 4: passes resolve one at a time, and a per-pass AP cap (trial)

Changes (PROVISIONAL; see the Rules tab and `src/rules/config.js`):

- **Terms.** A round starts with initiative. Characters take **turns** in initiative order; one
  set of everyone's turns is a **pass**. After the turns comes a defense step, in which anyone
  with an attack landing on them may answer it. Then every action of the pass resolves. Passes
  repeat until no one has actions left (or a pass goes by in which nobody does anything).
  Before this, every pass was declared first and the whole round resolved at the end.
- **AP per pass** (`apPerPass: 2` base AP, 4 on the sheet). A turn may hold several actions up to
  the cap, so cheap, feat-reduced actions fit two to a pass. An action costing more keeps paying
  from the next passes' allowance and lands when fully paid (`spanLands: 'late'`); a 6-AP swing
  lands a pass later, where the target can see it coming. Defenses act at once and borrow the
  overspend from the next pass. Moving and drawing a longbow can no longer share a pass.

Results (40 fights per pairing; `results/arena/report.html`, compared against `results/arena-r3/`).
Style averages, open field / close quarters:

| Rules | Two-handed | Sword & shield | Archery | Heavy armor | Rounds |
|---|---|---|---|---|---|
| Round 3 | 41 / 60 | 68 / 70 | 59 / 44 | 52 / 62 | 5.8 / 4.2 |
| Passes resolve, no cap | 44 / 52 | 63 / 74 | 53 / 45 | 51 / 68 | 5.2 / 3.5 |
| **Cap 4 AP (default)** | 35 / 53 | 63 / 72 | 55 / 43 | 54 / 70 | 5.6 / 3.8 |
| Cap 4, overflow lands at once | 37 / 57 | 61 / 71 | 57 / 42 | 58 / 70 | 5.5 / 3.6 |
| Cap 6 AP | 44 / 54 | 61 / 72 | 54 / 44 | 52 / 69 | 5.4 / 3.7 |

What it means:

- Resolving each pass on its own barely moves the balance. In particular it **does not keep a
  shorter weapon out**: the step in and the dagger thrust still happen with no reaction from the
  reach weapon. Shove use stays near 0.05 a fight. The reach question still needs a rule
  (stop-thrust, extra AP to step into reach, shove costs the target AP, no dagger with a shield).
- The 4-AP cap costs **two-handers** most (−9 points in the open against no cap): their 7–8 AP
  swings span two passes and are telegraphed. Sidearm (dagger) draws rose by about half, because
  dagger thrusts fit inside the cap. If the cap stays, two-handed and power swing costs probably
  need a look (for example, let a heavy swing land in the pass it starts but cost the next pass's
  allowance, as with `spanLands: 'now'`, which recovered 2–4 points).
- A 6-AP cap balanced the open field best (17 points between weapon styles, against 28 at 4 AP),
  but close quarters is unchanged.
- Noise: each style figure averages about 2,400 fights, but they share opponents; treat
  differences under about 3 points as noise.

## Round 3: longbow draw, inside-reach rule, shove, shields vs power, plate retune

Changes (PROVISIONAL; see the Rules tab and `src/rules/config.js`):

- **Longbow draw:** a longbow shot is a wind-up, drawn one round and loosed the next; an archer
  may redraw after loosing. The shortbow stays a single action.
- **Inside a weapon's reach** (range 1), long weapons (rapier, longsword, greatsword, spear)
  can't attack at all; daggers, clubs, maces, hammers, half-swording and the murder stroke can.
  This replaces "half damage up close" (still available as `range.closeRule: 'half'`).
  The spear's shaft strike is gone.
- **Shove** (2 AP, range 1): opposed STR check; pushes the target back 1 square (2 on a big win).
- **Shields vs power attacks:** a blocked power swing breaks the shield if the weapon is at least
  as hard (wood < iron < steel) and the shield isn't masterwork; force above the break threshold
  drives through as blunt. Shields wear twice as fast.
- **Plate retune:** +1 stamina per action (was +2), −3 regen (was −4), chosen from five arena variants.

Results (`results/arena/report.html`, compared against `results/arena-r2/`):

| | Open field | Close quarters |
|---|---|---|
| Heavy armor | 44% → 52% | 49% → 62% |
| Two-handed | 36% → 41% | 42% → 60% |
| Sword & shield | 58% → 68% | 72% → 70% |
| Archery | 63% → 59% | 50% → 44% |
| Magic (deferred) | 32% → 23% | 25% → 17% |
| Best − worst style, leaving out magic | 27 → 26 pts | 30 → 27 pts |
| Average fight length | 3.7 → 5.8 rounds | 2.9 → 4.2 rounds |

- Matchups moved a lot, but overall dominance didn't shrink. **Sword & shield still leads.** Its
  fighters step inside a longer weapon's reach and fight with dagger plus shield. Shove can't
  hold the distance: it is used about 0.04 times a fight, because re-closing costs 1 AP per square.
- Tested: halving movement (Specifics rate) cuts sword & shield to 55% in the open but lifts
  archers to 65%, with no change in close quarters. Faster shield wear changes nothing; fights
  end before shields wear out.
- **Decision needed:** how should a reach weapon keep a shorter one out without attacks of
  opportunity? Options: a set/stop-thrust; extra AP to step into an enemy's reach; a shove that
  also costs the target AP; no dagger in a shield hand.
- Fights got longer, mostly mages and kiting archers in the open.
- Next test worth running: group fights (many-v-1, monster vs heroes), where styles that are weak
  in duels may shine.

---

## Round 2: ranges, wind-ups, archery, magic, and the arena

New rules (all PROVISIONAL, listed on the in-app Rules tab and in `src/rules/config.js`):

- **Range bands.** A grid square is about a pace (1 = clinch, 2 = sword distance). Swings reach
  1 to the weapon's reach; thrusts can reach farther (rapier +1, spear +2), and spears can't
  thrust at 1. Most attacks do half damage at 1; daggers, half-swording and murder strokes don't.
- **Wind-up.** A power swing (and a Strong spell) is wound up one round and released the next.
  While wound up you can't block or parry. The wind-up is lost if you're knocked down, grappled,
  disarmed or drop, or if you don't release it the following round.
- **Spear, shortbow, longbow, and a magic stub** (verbs Attack/Launch, nouns Fire/Force,
  modifier Strong, spell points, backlash) so the arena could test archery and magic.
- **Magic feat tiers count across all four magic sub-trees.** As transcribed, Casting and
  Fire Affinity could never pass rank I. Please confirm this reading.

The arena (`node sim/arena.js`, then `node sim/arena-page.js` for the results page) runs 16
level-5 fighters (heavy/medium/light/unarmored × two-handed/sword & shield/magic/archery) in
an open field and in close quarters, 12,000 fights in all. Full results:
[`results/arena/report.html`](results/arena/report.html); tidy data:
`results/arena/matchups.csv`.

Main findings (details and options are on the results page):

1. **A shield stops anything, and the dagger does the work.** Sword & shield is the best melee
   style (light: 79% open, 90% close). Two-handers win only 25% / 14% against it. A block negates
   any blow, the wind-up tells the defender which strike to block, and the up-close penalty makes
   shield + dagger the best clinch combination.
2. **Heavy armor protects, then exhausts.** Plate wearers almost never die but lose by collapsing
   (0.4–0.6 per fight). Heavy armor averages 44% / 49%, light 58% / 54%. The round-one ×3 stamina
   tuning now looks too harsh on plate. The round-one checks also fell from 87 to 81 of 101
   passing under the new rules.
3. **One arrow decides an open-field fight.** Archers win 63% in the open and about 50% in close
   quarters. Arrows never miss, and a longbow hit kills an unarmored target.
4. **Magic is weak and risky.** Casters average 32% / 25%. They get 1–2 spells a fight, backlash
   on about 40% of casts, and a fire bolt does about 1 CON through leather.
5. **The wind-up works, but power swings rarely land** (0.1–0.6 per fight).
6. Working as intended: short fights, terrain that matters, fighters holding their best range,
   unarmored fighters winning at range rather than in melee.

---

## Round 1

First broad pass over the combat rules, driven by the questions in the Specifics
"Simulation plan" and the targets in the Philosophy doc. Full tables:
[`results/as-written/report.md`](results/as-written/report.md) (Specifics numbers as
written) and [`results/tuned/report.md`](results/tuned/report.md) (current defaults).
Both use 200 fights per matchup.

**Read these numbers with one caveat.** Every fight is played by the built-in AI
(`src/rules/ai.js`). It defends by expected value, picks attacks by damage per AP,
closes distance and switches to its sidearm when that's better. It does not kite,
retreat, flank, use terrain, or plan across rounds. A result like "the duelist wins
65%" means "under these rules, played competently but simply." Pass/fail thresholds
are my numeric readings of qualitative goals; they live in `sim/targets.js`.

## What changed

### Bugs found by the sims (fixed)

- Piercing through armor rounded 0.5 up, so a thrust that barely beat plate always did
  1 CON. That alone let a level-8 duelist beat a level-8 knight 68% of the time.
- After declaring "draw sidearm", later passes still offered attacks with the old
  weapon, which then fizzled. Attack options now reflect declared weapon swaps.
- "Stand up" (and draw/pick up) could be declared twice in one round.
- AI: it read strikes hidden by Feint (cheating); it valued kicks that armor stopped
  completely; it picked defenses in a fixed order rather than by odds; it never
  drew a better sidearm.

### Tuning adopted (all in `src/rules/config.js`, each a single switch)

| Change | Why | Evidence (as written → tuned) |
|---|---|---|
| **Stamina costs ×3** (`staminaScale`) | Outline: early unarmored "tires within a few rounds"; armored "tires much faster"; "2v1 drains stamina". At Specifics numbers an early fighter could attack flat out for 30+ rounds, and turning fatigue off changed fight length by 0.01 rounds. | Rounds of full effort, early unarmored: 30+ → **4**; mid-level with cost feats: 30+ → 30+; plate L5: 6 → **3**. Knight mirror median: 5–6 → **4** rounds. |
| **AP ×2, feats still −1** (`apScale`) | With 4–6 AP pools, a "−1 AP" feat halved a 2-AP thrust or block, so play collapsed into 1-AP thrust/block spam. Outline asks for pools "around 4–10 AP so costs can differ meaningfully". | Without it (all else tuned): 2 sellswords beat an L4 knight 43%, dagger averages 91%. With it: 89%, 79%. |
| **Piercing through armor by roll** (`pierceMode: 'roll'`), the Outline's "coverage-based chance" | With rounding, plate's value hinged on one integer threshold: thrusts did exactly 0 or 1 CON, and armored matchups flipped from trivial to invincible with no setting between. | Smooth response to the pass-through dial instead of cliffs. |
| **Plate pass-through 20%** (`passThroughByArmor.plate: 0.4`) | Philosophy: "full plate is exceedingly good"; "armor is king in melee". | Trained plate's average win rate against other armors: 40% → **77%**. Plate builds now lead the equal-level matrix (knight 75%). |
| **Armor wear ⅓, mitigation floor 75%** | Three fully-absorbed kicks knocked a point off plate's piercing mitigation. | Removing this sends the starting party back to 100% wins against the plate knight. |
| **Block odds by shield size** (buckler 5, round 4, heater 3, tower 2 on d10) | Smaller shields cover less. Placeholder for an Open rule. | Buckler average 89% → 69%. Small effect; see shields below. |

The removal test (`node sim/compare.js` with one change removed at a time) showed
each of the first five matters. Removing stamina ×3 or roll mode alone breaks
several targets.

## Answers to the Specifics questions

| Question | Answer (tuned rules) |
|---|---|
| Does the stamina→AP fatigue link shorten or lengthen fights? | **Neither, measurably.** Fights end in 1–5 rounds, mostly by wounds, before the −1/−2 AP steps bite (knight mirror 4.25 rounds with fatigue, 4.08 without). It matters in long many-on-one fights, where it is how the knight loses. |
| How many rounds does plate + two-hander last? | **3 rounds** of all-out attacking at L1 and L5, **5** at L8. |
| Armored heavy vs. fast unarmored across level gaps (confined space) | L1 plate beats an L1 duelist 67–70%, an L4–L6 duelist about 55%, an L8 duelist 40–45%. Close to your goal but short of "across a large level gap". |
| Does 2v1 end quickly for every build? | Yes. Two sellswords beat a lone knight or heavy 89–100% of the time, median 4–5 rounds. The exception is an L8 duelist, who wins 44% against two L8 sellswords. |
| Is any weapon, armor or shield dominant? | **Armor:** plate leads (77%), as intended; **scale is the worst armor (10%)**, see below. **Weapons:** dagger 79% and longsword 80% lead; maces and club trail. **Shields:** buckler leads, tower is last (11%). |
| Fight length between equals, early vs late | Median 2–4 rounds at every level for every build except militia at L8 (5). Duelist mirrors end in round 1. |
| Mutual kills among unarmored fighters | Duelist mirrors: 0% (the faster one strikes first and the strike kills). Mirrors overall: 3–27% end with both down, highest in plate mirrors. |
| Feint vs Read Attack gap | **0%.** See below; Feint barely does anything as written. |
| Does kick spam dominate? | **Not one-on-one** (a kicker wins 5–52% of mirrors). As written, it did dominate many-on-one against plate. Kicks caused more knockdowns of the knight than trips did, and every point of his CON damage came while prone. With the tuned rules his losses are mostly exhaustion instead. |
| Can a starting party beat a plate-and-tower knight? | **Yes, almost always**: 3 level-1 starters win 97% against a level-6 knight with a steel tower shield, losing 0.3–0.8 of their own per fight. They win by wearing him out (he blocks their trips with a 3-AP tower block and collapses) and by stabbing him while prone. |

## Decisions that need you

The sims can't settle these; each is a rule question, not a number.

1. **What does reach do?** Specifics gives weapons very short / short / medium / long
   reach, but on a 1-square grid the first three are identical. The dagger's
   intended drawback therefore costs nothing, which is a large part of why it leads
   the weapon table (it thrusts the same 5 piercing as a longsword, cheaper).
   Options: longer reach resolves first within a pass; or reach is in half-squares;
   or a shorter weapon must spend AP to close inside a longer one.

2. **Feint has almost no mechanical bite.** It hides an attack's type and AP cost,
   but any declared block, parry or dodge still works against a hidden strike, and
   only parry and dodge odds depend on the motion. Knowing the type barely changes
   the right response, so a 0% gap is the expected result, not an AI artifact. If
   Feint should matter, a defense might need to match the attack (parry vs swings,
   dodge vs thrusts), or a hidden strike might add to the defense's target number.

3. **What are big shields for?** A block negates the whole hit whatever the shield,
   so the only difference in a duel is AP cost, and breakage rarely happens in
   short fights. Even at 40% block odds the buckler beat larger shields. The tower
   shield's stated role ("holds a line") needs rules that don't exist yet: ranged
   fire, formations, Shield Wall, or cover against attacks you didn't declare a
   block for.

4. **Scale armor is strictly worse than mail.** It has more SPD, DEX, stamina and
   regen penalty for one more point of P and B mitigation, and there's no
   Scale Mobility/Endurance feat to train it off. It averaged 10% against the other
   armors. Either give it training feats or lighten its penalties.

5. **How hard should the plate-and-tower knight be?** At 97% for three level-1
   starters, "extremely hard to beat" isn't true in this model. I didn't tune
   further because the levers (plate stamina penalty, stand-up cost, knockdown
   odds) all also shift two-on-one and armored mirrors. Tell me the outcome you
   want (e.g. "three starters win about half the time and usually lose someone")
   and I can tune toward it.

6. **Level-gap target.** L1 plate against an L6–L8 unarmored duelist is about a coin
   flip (40–55%). Raising it further also makes the knight harder for parties, so
   these two targets pull against each other.

7. **Smaller things:** Quick Thrust II–III do nothing for a rapier at the old AP
   numbers (cost already at the 1-AP floor); fixed by the AP scale. The unarmored
   two-handed brute loses to almost everything (18%), as written and tuned. Militia
   mirrors at level 8 run 5 rounds (club against padded and a shield is slow).

## Not tested

Terrain, confined vs open space (in one-on-one fights both sides close in the
first pass, so the "corridor" plays like open ground until terrain and retreat
exist), ranged combat, magic, social, recovery.

## Reproduce

```
node sim/run.js                              # full sweep with current defaults → sim/results/
node sim/run.js --n 60 --only party,gap      # quicker, selected scenarios
node sim/run.js --set staminaScale=1         # any config value can be overridden
node sim/compare.js --n 60                   # side-by-side variants from sim/variants.json
node sim/inspect.js knight:6 militia:1 open 3 1 3   # print one fight's log
```

`results/*/summary.csv` has one row per measured value (scenario, condition,
metric, value, target, verdict) for analysis in R:

```r
s <- read.csv("sim/results/tuned/summary.csv")
subset(s, verdict == "FAIL")
```
