# Feats audit (step 9 of `docs/PLAN.md`, 2026-11-12)

Every combat-facing feat, what it does in code, whether it is built, and what it is worth after steps 2 to 8, with the measure
behind it (`sim/feats.js`, new). Rulings wanted are at the end (§8). Read `data/feats.yaml`'s header for the schema.

## 1. Headlines

- **144 feats audited**: the body group (8), combat (67), magic (52), and 17 from the Leadership, Shadow, Deception, Athletics and
  Lore trees, whose actions touch a fight (they sit in the talking, sneaking and exploring groups). 93 + 24 + 63 + 19 = 199 ranks.
- **58 of the 144 (40%) are only a number**: an AP or stamina discount, a damage or magnitude point, a penalty trimmed. The 2026-11-07
  ruling says those belong in skills. 86 are mechanics (an unlock, an action, a condition).
- **13 are not built**: Off-hand Dagger, Quick Donning, Focus Bond, Shape, Swift, and the eight ritual feats. (Of the 24 `auto: false`
  feats in `feats.yaml` at the start of this step, 10 belong to Persuasion, Perception, Medicine and Deception and are out of scope, and one, **Cauterize, is built now**.) The
  PLAN's "25" was 24 and is 23.
- **Capstones**: the branches with none were Striker, Fencer, Assassin, Reaper, Technique and Runner. **Reaper's is built** (Whirlwind,
  from the effect written in `docs/PROPOSALS.md` §3.2); the other five have no effect written anywhere and are in §8 (F5) with a design each.
- **Measured** (`sim/feats.js`; §2, §7): 832 runs on seven heroes: 383 one-rank feat changes at levels 3 and 5 (83 feats), 147 at level 10, 150 lab variants (44 feats), 72 attribute
  points and 80 skill ranks; 114 of the 144 feats were measured somewhere. Of the 383, 35 moved the win rate by more than two standard errors, twice what luck alone gives
  if nothing did anything, so read each as a lean, not a measure; 17 moved it by 10 points or more, and those are not luck. They are: **a mage's words and Quick Casting, Half-swording for a sword, Toughness
  (+1 CON), Find the Gap for a rapier, Quick Dodge.**
- **+1 CON (Toughness) was the first or second best change** for Cyrus (levels 3 and 5), Beren (3), Arvir and Jadier (5), and the best of all for Cyrus at 3 and Arvir at 5: a bigger pool, against the philosophy (§8 F1).
- **The attributes** (+1 to each in turn; §7.1): CON and SPD are worth 4 to 11 points for the fast and the frail, STR 3 to 4; INT, WIS and CHA
  are worth nothing in a fight (0.0 for all four heroes, both levels).
- **Feats the sim shows nothing for** (§7.3) are mostly feats a 1v1 duel cannot exercise (allies, crowds, grapples, bows against a
  closing foe), not feats nobody would take; the "nobody would take" and "must take" lists in §3 say which is which.
- **Changes** (§4): Whirlwind, Cauterize, `sim/lib.js` rebuilt and `sim/dk-scaling.js` deleted, `maxLevel` 20. **Rulings wanted** (§8): 13.

## 2. The audit, and how it was measured

`node sim/feats.js --level 3 --n 16 --attrs --skills` and `--level 5 --n 12 --attrs`, then `--level 5` for Kalavar, Arvir and Jadier (mail,
sword and shield; a duellist), `--lab` for feats the heroes' skills do not open, and a crawl of the temple court (`--crawl`). Each variant
fights the same seeds as the hero *as planned*, so the difference carries no luck of the draw but the fights that flip:

- **The hero**: a start.yaml hero grown to the level along its plan (`World.settle`), with the gear ladder of `sim/grow.js`
  (steel from 3 and 5), the bandages and arrows dealt as a fight deals them. Beren (plate, sword, heater), Cyrus (rapier, unarmored),
  Lorc (longbow), Jabiku (Life mage); at level 5 also Kalavar, Arvir (mail, sword and shield) and Jadier (a duellist).
- **The change**: one rank of a feat the hero could hold (its skill tier and requirements met, the budget ignored: *the worth of a
  marginal feat*), one rank of a held feat taken away, one point on an attribute, or one rank of a skill.
- **The foes**: the other three presets at the same level, and three monsters that stand for the level (goblin warrior, scaleward, orc
  centurion at level 3; kobold champion, sarnak knight, orc warlord at 5). With `--n 16` that is 96 fights a variant at level 3, 72 at 5.
- **Reported**: win rate (a timeout is a half) and the paired change in it with its standard error (a star: more than two); heroes dead
  a fight; rounds; "harm" (attribute points lost, plus the share of fresh stamina gone, at the end), taken and dealt. A duel is a 12 × 6 room,
  AI on both sides.

**What it cannot see.** A 1v1 duel cannot show a feat for allies (Rally, Command, To Your Feet, Shield Wall), for crowds (Cleave, Sweep,
Whirlwind), for the clinch (the Wrestler branch), for a bow against a closing foe, or for a healer. Those got the lab (`--lab`: the feat and
what it needs given to a hero) and a crawl. The crawl at 24 crawls a variant has a standard error of about ten points, so it can see
nothing short of a large change: its numbers are in §7.6 and say little. A mage with one noun (Jabiku knows Life) cannot show most magic feats.
The heroes use few feats' actions in the sim at all (HANDOFF: the AI has Rally, Command, Demoralize, Vanish and the rest since step 5, but no
hero's plan takes them). Treat the sim's **zeros as "no measurable effect for this hero in a duel"**, not as "worthless".

### 2.1 The tables

One row a feat. **Kind**: a *number* is a bonus or a discount, a *mechanic* is something you can do or a rule that changes. **Built**: `no` is unbuilt; ★ marks a branch capstone. **Sim**: the change in win rate, in points, from one more rank of the feat (a held feat shows the loss from taking a rank away, marked "held, −1"), at level 3, 5 and 10; B Beren, C Cyrus, L Lorc, J Jabiku, K Kalavar, A Arvir, D Jadier; a star is more than two standard errors; "lab" is the feat given with what it needs (§7.4); – is not measured (no hero's skills open it, or the feat is unbuilt). One-hero, one-level, a lean at best (§2).

#### Conditioning (`conditioning`; group body; unlocked by feats in the tree; branches: body, mind)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Strength (`strength`) | body | 3 | +1 STR a rank (cap 3): the attribute tree, numbers by design | number | yes | 3: B +0, C +4*, L +0, J +2; 5: K +4*, A +3, D +0; 10: B(held, −1) -2, B +0, C +0, L +0, J +0 |
| Toughness (`toughness`) | body | 3 | +1 CON a rank | number | yes | 3: B +4*, C +11*, L +0, J +2; 5: K(held, −1) -4, A +14*, D +9*; 10: B(held, −1) -2, B +2, C +0, L +0, J +0 |
| Agility (`agility`) | body | 3 | +1 DEX a rank | number | yes | 3: B +1, C +3, L(held, −1) +0, J +0; 5: K +0, A +2, D +1; 10: B +0, C +0, L(held, −1) +0, L +0, J +0 |
| Quickness (`quickness`) | body | 3 | +1 SPD a rank (AP and movement) | number | yes | 3: B -10*, C(held, −1) +3, L +1, J +1; 5: K -6, A -2, D(held, −1) +8; 10: B +1, C(held, −1) -2, L(held, −1) +5, L +4, J +2 |
| Intellect (`intellect`) | mind | 3 | +1 INT; nothing in a fight reads it but spell points | number | yes | 3: B +0, C +0, L +0, J +0; 5: K +0, A +0, D +0; 10: B +0, C +0, L +0, J +0 |
| Resolve (`resolve`) | mind | 3 | +1 WIL (resists, backlash) | number | yes | 3: B +1, C +0, L +0, J +0; 5: K +0, A +6*, D +0; 10: B +1, C +0, L +0, J +0 |
| Insight (`insight`) | mind | 3 | +1 WIS; no fight rule reads it | number | yes | 3: B +0, C +0, L +0, J +0; 5: K +0, A +0, D +0; 10: B +0, C +0, L +0, J +0 |
| Presence (`presence`) | mind | 3 | +1 CHA; no fight rule reads it | number | yes | 3: B +0, C +1, L +0, J -3; 5: K +0, A +0, D +0; 10: B +0, C +0, L +0, J -4 |

#### Hand-to-hand (`handToHand`; group combat; unlocked by melee; branches: striker, wrestler [athletics], scrapper [athletics])

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Quick Hands (`quick_hands`) | striker | 3 | punch and kick AP −⅙ a rank (character.js baseActionCost); rounds away at ranks I and III (step 8) | number | yes | 3: B +2, C +0; 5: B +0, C +0, K +0, A -2, D +0; 10: B +0, C +0 |
| Brawler's Wind (`brawlers_wind`) | root | 2 | punch, kick and grapple −1 stamina a rank | number | yes | 3: B +1, C +0; 5: B +0, C +0, K +0, A +0, D +1; 10: B +0, C +0 |
| Heavy Hands (`heavy_hands`) | striker | 2 | a punch or kick may harm CON (the user, 2026-11-10); +1 blunt a rank | mechanic | yes | 3: B +0, C +0; 5: B +0, C +0, K +4, A +0, D +1; 10: B +0, C +0 |
| Trip (`trip`) | root | 1 | +bonus to the knockdown roll (a maneuver anyone may try) | number | yes | 3: B +1, C +0; 5: B +0, C +0, K -1, A -1, D +0; 10: B +0, C +0 |
| Disarm (`disarm`) | root | 1 | +bonus to the disarm roll (anyone may try) | number | yes | 3: B +0, C +0; 5: B +0, C +0, K +0, A +0, D +0; 10: B +0, C +0 |
| Pin (`pin`) | wrestler | 1 | +2 to pin and to keep a pin | number | yes | 10: B +0, C +0; lab 5: B -2, C -2, L +0, K -3 |
| Dogpile (`dogpile`) | wrestler | 1 | allies beside the target add +2, not +1, to your grapple rolls | number | yes | 10: B +0, C +0; lab 5: B -2, C -2, L +0, K -3 |
| Takedown (`takedown`) ★ | scrapper | 1 | throw from a clinch with no hold first (Scrapper capstone) | mechanic | yes | lab 5: B -2, C -2, L +0, K -1 |
| Joint Lock (`joint_lock`) | wrestler | 1 | a hold that holds wrenches a joint: −1 DEX | mechanic | yes | lab 5: B -1, C -2, L +0, K +1 |
| Human Shield (`human_shield`) | wrestler | 1 | a blow at a holder lands on the held foe | mechanic | yes | lab 5: B -1, C -2, L +0, K -5 |
| Iron Grip (`iron_grip`) ★ | wrestler | 1 | pay a step of AP and the held foe cannot break free (Wrestler capstone) | mechanic | yes | lab 5: B -1, C -3, L +0, K +4 |

#### Light weapons (`lightWeapons`; group combat; unlocked by melee; branches: fencer, duelist, assassin)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Quick Thrust (`quick_thrust`) | duelist | 3 | thrust AP −⅙ a rank; Quick Thrust II rounds away on a rapier or dagger (step 8) | number | yes | 3: B +3, C(held, −1) +1, C +0; 5: B +7, C(held, −1) -7, C +0, K +5, A +7*, D(held, −1) +0, D +5; 10: B +5, C(held, −1) -1 |
| Light Touch (`light_touch`) | root | 2 | light-weapon blows −1 stamina a rank | number | yes | 3: B +0, C +7*; 5: B +0, C +4, K +0, A +0, D +9*; 10: B +1, C +8* |
| Precision (`precision`) | assassin | 2 | +1 damage with light weapons a rank | number | yes | 3: B +0, C +7; 5: B +0, C(held, −1) +2, K +6, A +0, D(held, −1) +2, D +6; 10: B -4 |
| Feint (`feint`) | duelist | 1 | Deception beats a lower Anticipation: they defend blind (combat.js 1003, 1791) | mechanic | yes | 3: B +0, C(held, −1) +0; 5: B +0, C(held, −1) -4, K +0, A +0, D(held, −1) +4; 10: B +0, C(held, −1) +0; lab 5: L +0 |
| Quick Parry (`quick_parry`) | fencer | 2 | parry AP −¼ a rank | number | yes | 3: B +0, C(held, −1) -1, C +0; 5: B +0, C(held, −1) +0, C +1, K +0, A(held, −1) +0, A +0, D(held, −1) -2, D +3; 10: B +0, C(held, −1) +0 |
| Economical Parry (`economical_parry`) | fencer | 2 | parry −1 stamina a rank | number | yes | 3: B +0, C +2; 5: B +0, C +1, K +0, A +0, D +1; 10: B +0, C +0 |
| Riposte (`riposte`) | fencer | 1 | the answer after a parry costs no AP (anyone may riposte for AP since 2026-11-03: this is the discount) | mechanic | yes | 3: B +0, C(held, −1) +2; 5: B +0, C(held, −1) +0, K +0, A +0, D(held, −1) -1; 10: B +0, C(held, −1) +0 |
| Beat (`beat`) | fencer | 2 | recoil: a parried blow loses more AP (effects {recoil}); worth is large | number | yes | 3: B +0, C +6*; 5: B +0, C +1, K +0, A +0, D +1; 10: B +0, C +4; lab 5: L +0 |
| Bind (`bind`) | fencer | 1 | a good parry may try a disarm free | mechanic | yes | 3: B +0, C +4; 5: B +0, C +1, K +0, A +0, D +1; 10: B +0, C +5; lab 5: L +0 |
| Off-hand Dagger (`offhand_dagger`) | duelist | 1 | NOT BUILT, and redundant: anyone holding an off-hand dagger may already parry with it (combat.js offParry) | mechanic | **no** | – |
| Find the Gap (`find_the_gap`) | assassin | 1 | +2 to find a gap in armor; more of a burst point passes | number | yes | 5: C +15*; lab 5: B +9, L +14*, K +27* |
| Coup de Grâce (`coup_de_grace`) | assassin | 1 | a dagger against a prone or pinned foe ignores armor | mechanic | yes | 3: C +0; 5: B +0, C +0, K +0, A +0, D +0; 10: B +0, C +2; lab 5: L +0 |
| Lunge (`lunge`) | duelist | 1 | thrust at +1 reach (HANDOFF: reach already looks long) | number | yes | 10: C(held, −1) -11* |
| Flurry (`flurry`) ★ | duelist | 1 | two thrusts as one action, 1.5× AP, 2× stamina (Duelist capstone) | mechanic | yes | 10: C +5; lab 5: B +19*, C +10, L +1, K +11* |

#### Heavy weapons (`heavyWeapons`; group combat; unlocked by melee; branches: breaker, reaper, technique)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Heavy Weapon Training (`heavy_weapon_training`) | root | 3 | −1 effective weight a rank (stamina) | number | yes | 3: B +0, C +0; 5: B +0, C +0, K +0, A +3, D +0; 10: B +0, C +0 |
| Heavy Tempo (`heavy_tempo`) | reaper | 2 | two-handed and power swings AP −¼ a rank | number | yes | – |
| Weight of the Blow (`weight_of_the_blow`) | breaker | 2 | +1 damage on two-handed and power swings a rank | number | yes | 3: B +0, C +0; 5: B +0, C +0, K(held, −1) +0, K +0, A +0, D +0; 10: B +0, C +0 |
| Power Swing (`power_swing`) | root | 1 | unlocks the wind-up power swing | mechanic | yes | 3: B +0, C +0; 5: B +0, C +0, K(held, −1) +0, A +0, D +0; 10: B +0, C +0 |
| Half-Swording (`half_swording`) | technique | 1 | unlocks the half-sword thrust at close range | mechanic | yes | 3: B +6*, C +0; 5: B +1, C +0, K +14*, A +2, D +18*; 10: B +8, C +0 |
| Murder Stroke (`murder_stroke`) | technique | 1 | unlocks the hilt strike with swords | mechanic | yes | 3: B +1, C +0; 5: B -1, C +0, K +6*, A +0, D +0; 10: B +0, C +0 |
| Hook (`hook`) | technique | 1 | a hooked weapon can trip (three weapons in weapons.yaml) | mechanic | yes | 3: B +0, C +0; 5: B +0, C +0, K +0, A +0, D +0; 10: B +0, C +0 |
| Shield Breaker (`shield_breaker`) | breaker | 1 | blows count double against a shield's break threshold | mechanic | yes | 5: K +0; lab 5: B +0, C +0, L +0 |
| Crushing Blow (`crushing_blow`) | breaker | 1 | blunt ignores 2 points of mitigation | number | yes | lab 5: B +0, C +1, L +3, K +5* |
| Cleave (`cleave`) | reaper | 1 | a blow that drops its foe carries on into another (R8 made part of this ordinary) | mechanic | yes | 5: K +0; lab 5: B +7*, C +0, L +1 |
| Sweep (`sweep`) | reaper | 1 | a two-handed swing carries into a foe beside, at half (R8 made part of this ordinary) | mechanic | yes | lab 5: B +7*, C +0, L +1, K +0 |
| Whirlwind (`whirlwind`) ★ | reaper | 1 | NEW (this step): a two-handed swing struck at every foe it reaches (Reaper capstone) | mechanic | yes | – |
| Juggernaut (`juggernaut`) ★ | breaker | 1 | power swings can't be parried (Breaker capstone) | mechanic | yes | lab 5: B +10*, C -2, L +4, K +6* |

#### Armor and shields (`armorShields`; group combat; unlocked by armor; branches: bulwark [block], mail, plate)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Padded/Leather Training (`light_armor_training`) | root | 1 | halve padded and leather SPD/DEX penalties (the Armor skill already cuts 5% a rank) | number | yes | 3: B +0, L(held, −1) +0, L(held, −1) +0; 5: B +0, L(held, −1) +0, K +0, A +0; 10: B +0, L(held, −1) +0 |
| Mail Mobility (`mail_mobility`) | mail | 2 | −1 SPD/DEX penalty a rank in mail (Armor skill overlaps) | number | yes | 3: B +0, L +0, L +0; 5: B +0, L +0, K +0, A +0; 10: B +0, L +0 |
| Mail Endurance (`mail_endurance`) | mail | 1 | removes mail's stamina cost per action (Armor skill overlaps) | number | yes | 5: K(held, −1) -2, A(held, −1) -11* |
| Plate Mobility (`plate_mobility`) | plate | 3 | −1 SPD/DEX penalty a rank in plate (Armor skill overlaps) | number | yes | 3: B -5, L +0, L +0; 5: B(held, −1) -1, B +1, L +0, K +0, A +0; 10: B(held, −1) +0, B +0, L +0 |
| Plate Endurance (`plate_endurance`) | plate | 2 | −1 plate stamina cost a rank (Armor skill overlaps) | number | yes | 3: B(held, −1) -1, B +0; 5: B(held, −1) +0, B +0; 10: B(held, −1) +0 |
| Quick Block (`quick_block`) | bulwark | 2 | block AP −¼ a rank | number | yes | 3: B(held, −1) +0, B +1; 5: B(held, −1) -1, K(held, −1) -1, K +1, A(held, −1) -3; 10: B(held, −1) +2 |
| Economical Block (`economical_block`) | bulwark | 2 | block −1 stamina a rank | number | yes | 3: B +0; 5: B -1, K(held, −1) -1, K -2, A(held, −1) -3, A +1; 10: B(held, −1) +0, B +0 |
| Shield Bash (`shield_bash`) | bulwark | 1 | unlocks the shield strike (blunt, knockdown) | mechanic | yes | 3: B(held, −1) -1; 5: B(held, −1) +0, K +4, A(held, −1) +0; 10: B(held, −1) +0 |
| Field Repair (`field_repair`) | root | 1 | mend armor outside town: no fight effect | mechanic | yes | 3: B +0, L +0, L +0; 5: B +0, L +0, K +0, A +0; 10: B +0, L +0 |
| Quick Donning (`quick_donning`) | root | 1 | NOT BUILT: the game has no donning time to halve | mechanic | **no** | – |
| Iron Stance (`iron_stance`) | plate | 1 | resist knockdown and disarm | mechanic | yes | 3: B(held, −1) +1; 5: B(held, −1) -3, K -2, A +0; 10: B(held, −1) +0 |
| Second Wind (`second_wind`) ★ | mail | 1 | regenerate in full when struck; a collapse lasts out its round (reworked in step 2) | mechanic | yes | 5: K +3, A +8*; lab 5: B +1, C +2, L +0 |
| Shield Wall (`shield_wall`) ★ | bulwark | 1 | cover an ally two squares off at no penalty (Bulwark capstone) | mechanic | yes | 5: B +0, A +0; 10: B(held, −1) +0; lab 5: C +0, L +0, K +0 |
| Living Fortress (`living_fortress`) ★ | plate | 1 | the first blocked or converted hit each round costs no stamina (Plate capstone) | mechanic | yes | lab 5: B +0, C +0, L +2, K +3 |

#### Evasion (`evasion`; group combat; unlocked by evasion; branches: dodger, runner)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Quick Dodge (`quick_dodge`) | dodger | 2 | dodge AP −¼ a rank | number | yes | 3: C +9*, L +1, L +4*; 5: C +7*, L +1, D +4; 10: C +6, L(held, −1) +0, L +1, J +2 |
| Light on Your Feet (`light_on_your_feet`) | root | 2 | dodge and movement −1 stamina a rank | number | yes | 3: C +2, L +0, J +0, L +0; 5: C +1, L +0, J +0, D +4; 10: C +1, L +0, J +0 |
| Fleet Foot (`fleet_foot`) | runner | 3 | +1 square per movement AP a rank | number | yes | 3: C +0, L +1, J -1, L +1; 5: C +0, L +1, J +6, D +5; 10: C +0, L +2, J +6 |
| Kip-up (`kip_up`) | root | 1 | stand for 1 AP: no gain unarmored or in padded or leather (they stand for 1 already), 1 saved in mail, 3 in plate | mechanic | yes | 3: C +0, L +0, J +0, L +0; 5: C +0, L +0, J +0, D +0; 10: C +0, L +0, J +0 |
| Escape Artist (`escape_artist`) | runner | 1 | +2 to break a clinch, hold or pin | number | yes | 3: C +0, L +1, L +0; 5: C +0, L +0, D -1; 10: C +0, L +0, J +0 |
| Slip Through (`slip_through`) | runner | 1 | only closing in draws an opportunity strike | mechanic | yes | – |
| Roll With It (`roll_with_it`) | dodger | 1 | a failed dodge halves the damage | mechanic | yes | 5: C +3, L +1, D +2*; 10: C +0, L +2 |
| Counter-step (`counter_step`) | dodger | 1 | after a dodge, the next move's first square is free and unanswered | mechanic | yes | 10: C +6, L +0 |
| Untouchable (`untouchable`) ★ | dodger | 1 | dodges after the first each round cost nothing (Dodger capstone) | mechanic | yes | lab 5: B +0, C +31*, L +0, K -1 |

#### Magic: casting (`magicCasting`; group magic; unlocked by arcane; branches: control, battle, bond)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Control (`control`) | control | 3 | +1 a rank to the backlash roll | number | yes | 3: J(held, −1) +1, J +0; 5: J(held, −1) +0, J +0; 10: J(held, −1) +0 |
| Quick Casting (`quick_casting`) | battle | 2 | spell AP −¼ a rank | number | yes | 3: J(held, −1) -11*, J -5; 5: J(held, −1) -11*, J +14*; 10: J(held, −1) -8*, J +6 |
| Battle Casting (`battle_casting`) | battle | 1 | cast with both hands full | mechanic | yes | 3: J +0; 5: J +0; 10: J +0 |
| Steady Mind (`steady_mind`) | control | 1 | cast while grappled | mechanic | yes | 3: J +0; 5: J +0; 10: J(held, −1) +0 |
| Familiar (`familiar`) | bond | 2 | a small companion that fights, +2 spell points a rank | mechanic | yes | 3: J +0; 5: J +0; 10: J +0 |
| Focus Bond (`focus_bond`) | bond | 1 | NOT BUILT, and overlaps Battle Casting (cast with a weapon or shield in hand) | mechanic | **no** | – |
| Overchannel (`overchannel`) ★ | control | 1 | cast past an empty pool, a CON a point (Control capstone) | mechanic | yes | 10: J +0 |

#### Magic: words (`magicWords`; group magic; unlocked by arcane; branches: first, higher, mods)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Verb: Strike (`verb_strike`) | first | 1 | the verb Strike (bolts) | mechanic | yes | 3: J +0; 5: J +0; 10: J +0 |
| Verb: Give (`verb_give`) | first | 1 | the verb Give (heal, curse) | mechanic | yes | 3: J +4; 5: J +4; 10: J -4 |
| Verb: Take (`verb_take`) | first | 1 | the verb Take (slow a foe, ward an ally) | mechanic | yes | 3: J +23*; 5: J +13*; 10: J +4 |
| Verb: See (`verb_see`) | first | 1 | the verb See | mechanic | yes | 3: J +0; 5: J +0; 10: J +0 |
| Verb: Move (`verb_move`) | higher | 1 | the verb Move (step through space, drain) | mechanic | yes | 3: J(held, −1) -29*; 5: J(held, −1) -18*; 10: J(held, −1) -10* |
| Verb: Raise (`verb_raise`) | higher | 1 | the verb Raise | mechanic | yes | – |
| Verb: Bind (`verb_bind`) | higher | 1 | the verb Bind | mechanic | yes | – |
| Verb: Summon (`verb_summon`) | higher | 1 | the verb Summon | mechanic | yes | – |
| Verb: Shape (`verb_shape`) | higher | 1 | NOT BUILT: no Shape spells exist | mechanic | **no** | – |
| Modifier: Strong (`mod_strong`) | mods | 1 | the modifier Strong | mechanic | yes | 3: J +0; 5: J +0; 10: J(held, −1) +0 |
| Modifier: Wide (`mod_wide`) | mods | 1 | the modifier Wide | mechanic | yes | 3: J(held, −1) +0; 5: J(held, −1) +0 |
| Modifier: Long (`mod_long`) | mods | 1 | the modifier Long | mechanic | yes | 3: J +0; 5: J +0; 10: J +0 |
| Modifier: Far (`mod_far`) | mods | 1 | the modifier Far | mechanic | yes | 3: J(held, −1) -17*; 5: J(held, −1) -18*; 10: J(held, −1) -10* |
| Modifier: Hidden (`mod_hidden`) | mods | 1 | the modifier Hidden | mechanic | yes | 3: J +0; 5: J +0; 10: J +0 |
| Modifier: Swift (`mod_swift`) | mods | 1 | NOT BUILT: no Swift modifier is defined in spells.yaml | mechanic | **no** | – |
| Modifier: Delayed (`mod_delayed`) | mods | 1 | the modifier Delayed | mechanic | yes | 3: J +0; 5: J +0; 10: J +0 |

#### Magic: necromancy (`magicNecromancy`; group magic; unlocked by arcane; branches: blight, grave)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Grave Touch (`grave_touch`) | blight | 2 | +2 magnitude a rank to Take Life, Move Life, Give Death | number | yes | 3: J +23*; 5: J +15*; 10: J +6 |
| Hexer (`hexer`) | blight | 1 | Take on a foe costs 1 spell point less | number | yes | 3: J +0; 5: J +0; 10: J +0 |
| Raise the Flesh (`raise_zombie`) | grave | 1 | Raise Death raises a zombie | mechanic | yes | – |
| Deathless Command (`deathless_command`) | grave | 1 | +3 to bind the undead | number | yes | – |
| Ghost Caller (`ghost_caller`) | grave | 1 | ghosts last twice as long, +2 magnitude | number | yes | – |
| Raise the Wrapped Dead (`raise_mummy`) ★ | grave | 1 | Raise Death raises a mummy (Grave capstone) | mechanic | yes | – |

#### Magic: devotion (`magicDevotion`; group magic; unlocked by arcane; branches: mercy, warding)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Mending Hands (`mending_hands`) | mercy | 2 | +2 magnitude a rank to Give Life | number | yes | 3: J +0; 5: J(held, −1) +0, J +0; 10: J(held, −1) +0 |
| Blessing (`blessing`) | warding | 1 | Give on an ally costs 1 spell point less | number | yes | 3: J +0; 5: J +0; 10: J +0 |
| Wide Mercy (`wide_mercy`) | mercy | 1 | Give Life Wide reaches 2 squares | mechanic | yes | 5: J +0; 10: J(held, −1) +0 |
| Cleansing (`cleansing`) | warding | 1 | Take on an ally costs 1 less and lasts twice as long | number | yes | – |
| Turn the Dead (`turn_the_dead`) | warding | 1 | +3 magnitude to Take Death | number | yes | – |
| Call Back (`call_back`) ★ | mercy | 1 | Raise Life costs 2 points less (Mercy capstone) | number | yes | – |

#### Magic: summoning (`magicSummoning`; group magic; unlocked by arcane; branches: calling)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Binder (`binder`) | calling | 2 | +2 a rank to bind an outsider | number | yes | 3: J +0; 5: J +0; 10: J +0 |
| Banisher (`banisher`) | calling | 1 | +3 to banish an outsider | number | yes | 3: J +0; 5: J +0; 10: J +0 |
| Long Summons (`long_summons`) | calling | 1 | summons last twice as long | number | yes | – |

#### Magic: affinity (fire) (`magicAffinity`; group magic; unlocked by arcane; branches: fire)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Fire Affinity (`fire_affinity`) | fire | 3 | +magnitude a rank to Fire spells | number | yes | 3: J +0; 5: J +0; 10: J +0 |
| Kindling (`kindling`) | fire | 1 | fire spells set what they hit burning | mechanic | yes | – |
| Cauterize (`cauterize`) | fire | 1 | NEW (this step): an action that stops a bleeding wound, for 1 CON | mechanic | yes | – |
| Firestorm (`firestorm`) | fire | 1 | Fire + Wide costs 1 point less | number | yes | – |
| Ember Heart (`ember_heart`) | fire | 1 | fire harms you half as much | number | yes | – |
| Living Flame (`living_flame`) ★ | fire | 1 | fire elementals come bound (Fire capstone) | mechanic | yes | – |

#### Magic: ritual (`magicRitual`; group magic; unlocked by arcane; branches: circle, craft, rites)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Ritualist (`ritualist`) | root | 3 | NOT BUILT (rituals, out of a fight) | mechanic | **no** | – |
| Binding Circle (`binding_circle`) | circle | 1 | NOT BUILT (rituals) | mechanic | **no** | – |
| Warding (`warding`) | circle | 1 | NOT BUILT (rituals) | mechanic | **no** | – |
| Rite of Healing (`rite_of_healing`) | rites | 1 | NOT BUILT (rituals) | mechanic | **no** | – |
| True Naming (`true_naming`) | circle | 1 | NOT BUILT (rituals) | mechanic | **no** | – |
| Imbue (`imbue`) | craft | 1 | NOT BUILT (item crafting) | mechanic | **no** | – |
| Necromancy (`necromancy`) | rites | 1 | NOT BUILT (rituals) | mechanic | **no** | – |
| Archmage's Seal (`archmages_seal`) ★ | craft | 1 | NOT BUILT (item crafting) | mechanic | **no** | – |

#### Archery (`archery`; group combat; unlocked by ranged; branches: marksman, skirmisher)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Quick Draw (`quick_draw`) | root | 2 | drawing a bow AP −¼ a rank | number | yes | 3: L(held, −1) +1, L +0, L(held, −1) -2, L +2; 5: L(held, −1) +0; 10: L(held, −1) +2 |
| Far Shot (`far_shot`) | marksman | 1 | no damage lost at long range | number | yes | 3: L +0, L +6; 5: L(held, −1) -2 |
| Pinning Shot (`pinning_shot`) | marksman | 1 | an arrow in the legs roots the target a round | mechanic | yes | 5: L +2; lab 5: B +0, C +0, K +0 |
| Deadeye (`deadeye`) ★ | marksman | 1 | aimed arrows pay no aim penalty (Marksman capstone) | mechanic | yes | 10: L(held, −1) +0; lab 5: B +0, C +0, L +3, K +0 |
| Point Blank (`point_blank`) | skirmisher | 1 | shoot a foe beside you | mechanic | yes | 3: L +0, L +3; 5: L +0; 10: L(held, −1) -2; lab 5: B +0, C +0, K +0 |
| Snap Shot (`snap_shot`) ★ | skirmisher | 1 | loose a drawn bow as an opportunity strike (Skirmisher capstone) | mechanic | yes | lab 5: B +0, C +0, L +0, K +0 |

#### Shadow (`shadow`; group sneaking; unlocked by stealth; branches: hider, cutthroat)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Ambusher (`ambusher`) | cutthroat | 2 | a fight begun from hiding costs the enemy ¾ of its first-round AP | mechanic | yes | 5: L +0; lab 5: B +0, C +0, K +0 |
| Vanish (`vanish`) | hider | 1 | 2 AP: unseen for 2 rounds | mechanic | yes | 5: L +6*; lab 5: B -4, C -2, K -2 |
| Shadow Step (`shadow_step`) ★ | hider | 1 | while unseen, moves draw no opportunity strikes | mechanic | yes | lab 5: B -4, C -2, L +4, K -2 |
| Backstab (`backstab`) | cutthroat | 1 | +3 damage on a blow struck unseen | number | yes | 5: L +0; lab 5: B +0, C +0, K +0 |

#### Leadership (`leadership`; group talking; unlocked by persuasion; branches: captain, terror [intimidation])

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Rally (`rally`) | root | 1 | 2 AP: a round's regeneration at once to you and allies within 3; the collapsed come round (reworked in step 2) | mechanic | yes | lab 5: B -3, C -12*, L -2, K -9* |
| Command (`command`) | captain | 1 | 2 AP: an ally within 4 gains 1 AP | mechanic | yes | lab 5: B -3, C -12*, L -2, K -9* |
| To Your Feet! (`to_your_feet`) ★ | captain | 1 | 2 AP: an unconscious ally beside you rises at ¼ stamina; once per ally (Captain capstone) | mechanic | yes | lab 5: B -3, C -12*, L -2, K -9* |
| Demoralize (`demoralize`) | terror | 1 | 2 AP: a foe within 3 frightened for a round, if it fails WIL | mechanic | yes | lab 5: B -12*, C -12*, L +2 |
| Dread (`dread`) ★ | terror | 1 | Demoralize reaches every foe within 3 (Terror capstone) | mechanic | yes | lab 5: B -2, C -6, L +2, K -13* |

#### Lore (`lore`; group exploring; unlocked by nature; branches: bestiary)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Monster Lore (`monster_lore`) | root | 1 | know a creature's resistances at the start | mechanic | yes | 5: L +0, J +0; lab 5: B +0, C +0, K +0 |
| Bane Lore (`bane_lore`) | bestiary | 2 | +1 damage a rank against creatures | number | yes | lab 5: B +7, C +3, L +3, K +0 |
| Name the Weakness (`name_weakness`) ★ | bestiary | 1 | 2 AP: for 2 rounds everyone's blows ignore its resistances (Bestiary capstone) | mechanic | yes | lab 5: B -2, C -11*, L +0, K -1 |

#### Athletics (`athletics`; group exploring; unlocked by athletics; branches: brawn, stride)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Bull Rush (`bull_rush`) | brawn | 1 | +2 to shove, follow into the square | mechanic | yes | 5: B +0, C +0; lab 5: L +0, K +1 |
| Unstoppable (`unstoppable`) ★ | brawn | 1 | a hit that opportunity-strikes you does not stop your move | mechanic | yes | lab 5: B -2, C +5, L +0, K +1 |
| Charge (`charge`) | stride | 1 | a 2-square move ending beside a foe: next blow +2 | mechanic | yes | lab 5: B -2, C -2, L +0, K +6 |

#### Deception (`deception`; group talking; unlocked by deception; branches: liar, trickster)

| Feat | Branch | Ranks | Does, in code | Kind | Built | Sim: win-rate change, hero as planned ±1 rank (B C L J K A D) |
|---|---|---|---|---|---|---|
| Leading Questions (`leading_questions`) | liar | 1 | (unclassified) | mechanic | no (now built) | – |
| Cover Story (`cover_story`) | liar | 1 | (unclassified) | mechanic | yes | lab 5: B -2, C +0, L +0, K -1 |
| The Big Lie (`big_lie`) ★ | liar | 1 | (unclassified) | mechanic | yes | lab 5: B +0, C -9*, L +0, K -1 |
| Feign Death (`feign_death`) | trickster | 1 | 2 AP: lie still, no foe can aim at you | mechanic | yes | lab 5: B -2, C +0, L +0, K -1 |
| Dirty Trick (`dirty_trick`) ★ | trickster | 1 | a bait that wins leaves them exposed this round | mechanic | yes | lab 5: B +3, C -9*, L +0, K -1 |

## 3. What the audit found

### 3.1 Only a number (58 of 144)

Rows marked "number" in §2's tables. They cluster:

| Cluster | Feats | Note |
|---|---|---|
| Attributes | Strength, Toughness, Agility, Quickness, Intellect, Resolve, Insight, Presence (24 ranks) | the attribute tree: numbers by design; but see F1 and F2 |
| AP discounts ("Quick") | Quick Hands, Thrust, Parry, Block, Dodge, Draw, Casting; Heavy Tempo | the AP currency: *reacting more*; measured large |
| Stamina discounts | Economical Parry, Economical Block, Light Touch, Light on Your Feet, Brawler's Wind, Heavy Weapon Training, Mail and Plate Endurance | R1 (stamina back every round) made most of them small; Light Touch still reads +4 to +9 for the light-weapon heroes, who throw many blows |
| Armor penalties | Light Armor Training, Mail and Plate Mobility, Mail and Plate Endurance | the Armor skill already trims them 5% a rank; Plate Mobility II measured −1.4 ± 1.4 when taken from Beren (Armor 7) |
| Damage or magnitude | Precision, Weight of the Blow, Crushing Blow, Backstab, Bane Lore, Grave Touch, Mending Hands, Fire Affinity, Turn the Dead, Ghost Caller | in the rules the weapon sets damage (physics); these add points to it |
| Rolls and costs | Trip, Disarm, Pin, Dogpile, Find the Gap, Beat, Lunge, Escape Artist, Fleet Foot, Far Shot, Control, Binder, Banisher, Hexer, Blessing, Cleansing, Firestorm, Call Back, Deathless Command, Long Summons, Ember Heart | a bonus to a roll or a point off a cost |

Three of them measured large and are not "just a number" in play: **Find the Gap** (+14.6 ± 4.1 for Cyrus at level 5: how a rapier gets past
mail), **Beat** (+6.3 ± 2.8 at 3: it costs the attacker AP, so it is a number that is the Fencer's tempo). Fleet Foot read +5 to +6 for Jadier and Jabiku, inside the noise.
The recommendation in §8 F3 keeps the Quick feats and Find the Gap and folds the rest.

### 3.2 Feats nobody would take

Judged from the code and the sim together (a zero in the sim is only "for this hero, in a duel"; these are zero for every hero that could hold
them *and* have no use the code gives them):

- **Trip and Disarm**: a bonus to a maneuver anyone can try; −1.2 to +1.0 in all seven hero-levels. **Escape Artist** (+2 to break a hold): 0.0 (no one is held in a duel).
- **Brawler's Wind**: −1 stamina on a punch, kick or grapple; 0.0. **Quick Hands** since step 8: two of its three ranks round away (HANDOFF's open ruling) and
  it measured 0.0 for Beren, Cyrus, Kalavar and −2.4 ± 1.7 for Arvir.
- **Light Armor Training**, **Mail Mobility I**: 0.0; the Armor skill does it.
- **Kip-Up**: stands you for 1 AP, which unarmored, padded and leather fighters already pay (§8 F7). 0.0 in eight hero-levels.
- **Hook**: three weapons carry the feat's hook in `weapons.yaml`; 0.0. **Coup de Grace**: a dagger against a prone or pinned foe; 0.0 (nobody lies still long enough in a 1v1).
- **Intellect and Insight**: nothing in a fight reads INT beyond spell points (0.0 for Jabiku, whose spell points are Arcane's) or WIS; 0.0.
- **Field Repair, Quick Donning**: outside a fight, or no rule to attach to (Quick Donning is unbuilt).
- **Economical Block and Parry**: −2.4 to +2.1, no sign.

### 3.3 Feats everybody must take

- **Half-swording** for anyone with a sword (F4): +14.3, +18.5, +6.3.
- **Toughness** for anyone who can: +1 CON measured +3.6 to +13.7 for the fighters (F1), first or second among their changes. A feat that is among every fighter's best
  is the one the philosophy argues against (a bigger pool).
- **Lunge** for a rapier: taking it from Cyrus at level 10 cost 11.5 ± 5.4 (+1 reach on a thrust; the play note in HANDOFF says reach already reads as too long).
- **A mage's words**: taking Move or Far from Jabiku costs 18 to 29 points, Quick Casting II +14. The words are the build: a caster who skips them has no spells.
  That is the feats' job and not a flaw. (Taking the verb **Take** or **Grave Touch** (+2 magnitude to his drain) was worth +12.5 to +22.9 to him; why is not established,
  and a mage with one noun is a poor test of which words every mage needs.)
- **Mail Endurance** in mail (Arvir −11.3 ± 3.8 when taken away; Kalavar −1.8 ± 1.3): mail's stamina cost every action is a tax the feat removes. Plate Mobility
  and Plate Endurance measure small because the plate wearer's Armor skill already trims them.
- **Second Wind** is a trade, not a must: +3.0 ± 1.6 and +7.7 ± 2.0 on win rate for the mail fighters, but +0.19 and +0.15 heroes dead a fight and +1.5 and +4.0
  rounds: more regeneration makes a fight last longer, and a longer fight kills more of the body that has taken wounds. (Step 2 made it that.)

### 3.4 What steps 2 to 8 changed

- **Step 2 (stamina every round, spent actions, collapse):** the stamina savers lost most of their worth (3.1); **Second Wind** and **Rally** were
  reworked there and still do something (Second Wind above; Rally is in §7.4). **To Your Feet** was not: Rally now brings the collapsed round at once, for allies within 3, so
  the capstone's one job (a single ally beside you) is mostly done by a novice feat (F6). **Kip-Up** is untouched by step 2 and was already ordinary (F7).
- **Step 3 (wounds weaken):** a wound to an arm or leg takes STR, DEX or SPD, so the attributes matter more than they did (Toughness and Strength measure above; no before-and-after was taken), and **Heavy Hands** (a punch or kick may harm CON) gives the unarmed fighter something to wound with.
- **Step 4 (the guarded head):** a blow aimed at a small target costs more against a defender who can react: **Feint** (they defend blind) and **Find the Gap**
  gain, since the head is set up by taking away their defences.
- **Step 6 (R8, the swing carries):** every swing now carries into a second foe when it drops or passes its target. **Sweep** (a half-force carry that needs no drop)
  and **Cleave** (a full-force free blow at any foe in reach after a drop) are each half-ordinary now; Whirlwind (§4) is built on them.
- **Step 8 (half APs):** Quick Hands I and III, Quick Thrust II on a rapier or dagger, and Quick Thrust I and III on a short spear round away (HANDOFF's open ruling).

### 3.5 Do the branches lead to different ways to fight?

| Tree | Branch | Feats | A way of fighting? |
|---|---|---|---|
| Hand-to-hand | Striker | Quick Hands (number), Heavy Hands (unlock); **no capstone** | no: a number and an unlock |
| | Wrestler | Pin, Dogpile (numbers), Joint Lock, Human Shield, Iron Grip ★ | yes: control, the hold as a weapon |
| | Scrapper | Takedown ★ (needs the root's Trip and Athletics 4) | thin: a capstone and a root feat |
| Light weapons | Duelist | Quick Thrust, Feint, Lunge, Flurry ★ | yes: tempo and the unreadable blow |
| | Fencer | Quick Parry, Economical Parry, Beat (numbers), Riposte, Bind; **no capstone** | half: three numbers, two mechanics |
| | Assassin | Precision, Find the Gap (numbers), Coup de Grace; **no capstone** | half |
| Heavy weapons | Breaker | Shield Breaker, Crushing Blow, Weight of the Blow, Juggernaut ★ | yes: the answer to shields and armor |
| | Reaper | Heavy Tempo, Cleave, Sweep, **Whirlwind ★ (new)** | yes now: the crowd |
| | Technique | Half-swording, Murder Stroke, Hook; **no capstone** | a toll for swords, not a branch (F4) |
| Armor and shields | Mail | Mail Mobility, Endurance, **Second Wind ★** | no: three numbers and a regeneration rule |
| | Plate | Plate Mobility, Endurance, Iron Stance, **Living Fortress ★** | no: numbers and two rules |
| | Bulwark | Quick Block, Economical Block, Shield Bash, **Shield Wall ★** | partly: Shield Wall and the bash |
| Evasion | Dodger | Quick Dodge, Roll With It, Counter Step, **Untouchable ★** | yes: the dodge as a defence that pays |
| | Runner | Fleet Foot, Escape Artist, Slip Through; **no capstone** | partly: movement; no finish |
| Archery | Marksman, Skirmisher | Far Shot, Pinning Shot, **Deadeye ★**; Point Blank, **Snap Shot ★** | yes |

Branches that lead only to "a bigger number": Striker, Mail and Plate (their feats are armor penalties and stamina), and in part Fencer and
Assassin. The Mail and Plate branches are the two to rethink: the armor five should go into the Armor skill (F3), and the branches be
rebuilt on rules (Living Fortress and Second Wind are the pattern: a thing a mailed or plated fighter does that no one else does).

## 4. What was changed in this step

Only what needed no ruling: an effect already written down, or a tool that was broken.

| Change | Where | Why it needed no ruling |
|---|---|---|
| **Whirlwind** (Reaper capstone, master tier, needs Sweep and Cleave; closes Juggernaut). A two-handed weapon's swing becomes a Whirlwind option: the same AP, 1.5× the stamina, struck as made at its target and at ¾ force on every other foe the blow reaches, each defending for itself. `CONFIG.whirlwind` (PROVISIONAL, listed in `CONFIG.provisional`; `null` switches the feat off) | `data/feats.yaml`, `src/rules/config.js`, `character.js` (the option), `combat.js` (`whirlwind`), `ai.js` (`whirlwindWorth`: the AI adds the blows on the other foes in reach to its value) | `docs/PROPOSALS.md` §3.2 wrote it: "**Reaper** (cleave, sweep → *Whirlwind*: a swing at every foe in reach)". The cost and force are mine, first guesses. First check: a level-7 two-hander with Sweep and Cleave, ringed at two squares by four goblin warriors, wins 9 of 40 without it and 23 of 40 with it (96 whirlwind blows); a goblin at a time, the AI never chooses it (a thrust is worth more per AP). Its setting is a crowd. |
| **Cauterize** (Fire, apprentice) is built: an action (2 AP, needs the Fire noun and Field Dressing, no bandage) that stops a bleeding wound on yourself or someone beside you; the burn costs the patient 1 CON, never the last; a poison's venom stays. The AI uses it on itself with no bandage to be had and more than 1 CON still to bleed | `feats.yaml` (`auto: true`), `data.js` `ACTIONS.cauterize`, `combat.js`, `ai.js`, `screens/battle.js` icon | the effect line was "Stop bleeding with fire; costs 1 CON" |
| `sim/lib.js`: archetypes rewritten on current feats and skills (a plan, as start.yaml's heroes have, grown by `World.growAlongPlan`); `tests/lib-sim.test.js` fails on a feat or skill that does not exist | `sim/lib.js` | HANDOFF: "fix or delete" |
| `sim/dk-scaling.js` deleted | | listed retired feats, depended on `sim/arena.js`'s lists (which also name retired feats and verbs: see HANDOFF), and measured one level-20 monster; `sim/feats.js` and `tools/tiers.js` do its job with real heroes |
| `game.maxLevel` 10 → 20 | `data/rules.yaml` | R10, approved |
| `sim/feats.js` (new; the feat, attribute and skill sim) | `sim/feats.js` | the step's second deliverable |

**Not changed, and why** (each is in §8 with a recommendation): the five capstones whose effect is written nowhere (Striker, Fencer, Assassin,
Technique, Runner; F5); Shape and Swift (no spell uses either word; F8); Off-hand Dagger, Quick Donning and Focus Bond, whose written effects
cannot be built as written (the rule the first would gate already holds for everyone who holds an off-hand dagger, the game has no donning
time to halve, and Battle Casting already lets a caster cast with a weapon or shield in hand; F8); the eight ritual feats (out of a fight); To Your
Feet and Kip-Up (F6, F7: a rework changes what the feat is); and every retune of a feat's numbers (F3).

## 5. R10 and the XP curve

**Done:** `data/rules.yaml game.maxLevel` 10 → 20 (R10, as approved). Nothing else about levels was touched: XP to reach level n is
`xpBase × n(n−1)/2` (`xpBase` 60: 60, 180, 360, 600, … 2,700 at 10, 11,400 at 20); a level gives 3 skill points and 1 feat
(`skills.perLevel`, `featsPerLevel`); a skill still stops at 10; tiers need skill ranks 1, 3, 5, 7, 9
(`skills.tiers`), and `tierThresholds` (feats held in the tree, 0, 2, 4, 6, 8) now governs only Conditioning.

### What the curve gives to 20

| Level | XP to reach | Skill points (total) | Feats (total) | What a build can hold |
|---|---|---|---|---|
| 5 | 600 | 22 | 7 | 4 skills at 5–7 (a fighter), or Arcane 9 and a spare 13 (a caster) |
| 10 | 2,700 | 37 | 12 | the four fighting skills at 9 (36), or Arcane 10, Medicine 9 and 18 spare |
| 12 | 3,960 | 43 | 14 | four skills at 10 and 3 spare: a specialist's skills are full |
| 15 | 6,300 | 52 | 17 | each point past this goes to a second line of play, not a deeper first |
| 20 | 11,400 | 67 | 22 | six skills at 10 and seven spare; 22 feat ranks: more than one full weapon or armor tree (they hold 15 to 21 ranks each), less than two |

So the points curve is sensible to 20 and the "cost of the points" does bound a build: from about level 12 a specialist has nothing
deeper to buy and every further level broadens (a second skill line, a second tree), and a broad character is still weaker in
any one setting than a focused one of the same level. Nothing needs changing for that. The tier thresholds still fit: master (9)
is reachable by 10 with one line, and the capstones (master tier) wait for it.

**What does not fit is the XP.** Every group's foes' `xp` summed over the authored places (`Explore.encounterSpec` over each map's
monster squares; every hero gets the full amount; each place cleared once, in level order):

| Places cleared, in level order | Cumulative XP | Level at xpBase 60 | 120 | 200 | 300 | 500 |
|---|---|---|---|---|---|---|
| the four level-1 places | 995 | 6 | 4 | 3 | 3 | 2 |
| + the six level-2 places | 2,861 | 10 | 7 | 5 | 4 | 3 |
| + the six level-3 places | 7,017 | 15 | 11 | 8 | 7 | 5 |
| + the six level-4 places | 12,459 | **20** | 14 | 11 | 9 | 7 |
| + level 5 and 6 places | 13,754 | 20 | 15 | 12 | 10 | 7 |
| + the Giants' Citadel (9,220 XP alone) | 22,974 | 20 | 20 | 15 | 12 | 10 |
| + the Dragon's Lair | 24,974 | 20 | 20 | 16 | 13 | 10 |

With `xpBase: 60` a party that clears the four level-1 places once is level 6 and the level-4 places are done at the cap of 20:
the places a level-5 to 8 party should be meeting are met by level-20 heroes, and the citadel (23 groups, 9,220 XP) is worth more
than everything before it, so it ends nothing. HANDOFF already notes "levels come fast" (a party leaves the court at 3.9).
**Recommendation (not changed):** `xpBase` 200 and the cap at 20. Then level ≈ place level + 1 after each tier (3, 5, 8, 11 …) and
20 (38,000 XP) is a long road past the content, not a stop inside it. A monster's XP also needs to fall off against a hero
many levels above it (the usual way), or the citadel's 9,220 stays an outlier; that is a content and formula ruling, listed in §8.

### The open XP question: every hero gets the full amount whatever the party's size

`World.grantXP` gives each living hero the whole amount; a fight's XP is the sum of its foes' `xp`. So a party of four levels each
hero at the pace of a party of one, while having four times the XP in all. Measured by `node sim/crawl.js temple_court orc_valley
--party N --n 30 --seed 4242` (the presets are four heroes, so N = 4 is the most the crawl can field; a party of 6 needs recruits it
does not use, so it is unmeasured):

| Party | Court cleared (of 30) | Valley cleared (of 30) | Court, first fight won | Valley, third fight won (4 to 6 foes with joiners) |
|---|---|---|---|---|
| 1 | 0 | 1 | 27% | 14% (of the 7 that got there) |
| 2 | 1 | 6 | 100% | 59% (of 17) |
| 3 | 16 | 11 | 100% | 70% (of 27) |
| 4 | 24 | 14 | 100% | 67% (of 30) |

A hero added is a large step in what a party can clear: court clears go 0, 1, 16, 24 and valley clears 1, 6, 11, 14. That is the action
economy of the targets (`sim/swarm.js`) working as designed, and it means that full XP to every hero hands the larger party more
clears *and* the same growth a hero at a time. (Deaths are not compared: the crawl's "heroes dead so far" column is read at fights
that only the survivors reach, which flatters the weak parties.)

**Recommendation (not changed): full XP to each hero for a party of up to three, and `3 ÷ party size` of it above that**, so a
party of four levels at three quarters of the pace and one of six at half. Reasons: (1) three is the size the tuning assumes
(CLAUDE.md), so a party of three loses nothing; (2) below three a party barely clears a first area (one hero: 0 and 1 of 30 in
the court and the valley; two: 1 and 6), so splitting XP among fewer would only punish the ones already being beaten; (3) levels buy skills and feats, so the extra bodies' price being slower growth is the cheapest lever and
needs no change in the fights; (4) the fallen get nothing already, which taxes a bad fight. If you would rather not
touch XP, another lever is `game.joinDistance`, which pulls more of the place into a large party's fight (not tried). A party of six is
unmeasured: measure it with recruits before trusting any number past four.

## 6. The cost of magic against the cost of fighting

Nothing here is changed; every number is from the code and the sims, and the recommendation waits for a ruling (§8).

### What the points buy

Each build below is what `World.settle` makes of a start.yaml hero's plan at level 5: 22 skill points and 7 feats
(`node` over `Character.skillBudget`/`featBudget`; Beren and Jabiku's plans).

| | Level-5 fighter (Beren: plate, sword, heater) | Level-5 caster (Jabiku: Life, staff) |
|---|---|---|
| Skills | Melee 6, Block 7, Armor 7, Athletics 2 (22 of 22) | **Arcane 9**, Medicine 5, Anticipation 3, Nature 2, Perception 2, Evasion 1 (22 of 22) |
| Skill points that decide the fight | all 22 (Melee, Block, Armor; nothing in Evasion, so no dodge) | 9 (Arcane); the other 13 are spare |
| Feat ranks whose skill tier is open | 60 of the 93 combat ranks (the three weapon trees to adept on Melee 6, Armor and Bulwark to expert; nothing of Evasion or Archery) | **63 of 63** magic ranks, every tree to master (Arcane 9) |
| Feats (7) | Plate Mobility ×2, Plate Endurance, Quick Block ×2, Shield Bash, Iron Stance | Far, Wide, Move (three words), Control ×2, Quick Casting, Mending Hands |
| Resource the skill gives | none (Armor trims penalties 5% a rank) | spell points: 26 (Arcane 2 a rank, with INT) |
| Roll the skill adds to | blows and parries (Melee), blocks (Block ½ gap) | the casting roll against a target's resistance |
| Gear | plate, steel shield, steel sword: gold | a staff |

**What a point is worth in the sim** (`sim/feats.js --skills`, level 3, one more rank, paired seeds, win rate against the mirror
duels; see §2):

| One more rank in | Hero | Δ win rate |
|---|---|---|
| Arcane (7 → 8) | Jabiku | **+7.3 ± 2.6 \*** |
| Melee (4 → 5) | Beren | +3.6 ± 2.0 |
| Melee (5 → 6) | Cyrus | +1.6 ± 2.8 |
| Evasion (4 → 5) | Cyrus | +4.7 ± 2.1 \* |
| Armor (5 → 6) | Beren | +1.6 ± 1.7 |
| Block (5 → 6) | Beren | +0.0 ± 0.0 |

Here the marginal caster's point is worth about twice the fighter's best, and it also adds 2 spell points. That is one hero each at
one level against one set of foes, so it is a lean, not a number to tune to.

### Where the asymmetry is

1. **Breadth for 9 points against 36.** One skill, Arcane, gates 65 feat ranks and Arcane 9 opens every tier of seven trees. No
   fighting skill gates more than 47 (Melee: the three weapon trees), and the rest of the fighting ranks sit behind Armor (14), Evasion (13),
   Athletics (9), Ranged (7) and Block (6). A fighter who wants the tiers of the whole combat set at master needs Melee, Armor, Block
   and Evasion at 9: 36 points, which is the whole of a level-10 budget (37). The caster's
   other 28 points at level 10 are free (Jabiku's plan spends 34 of 37 and leaves the rest on Medicine and Anticipation).
2. **Arcane pays three ways.** A rank adds to the casting roll, adds 2 spell points and opens a tier in all seven trees; a Melee
   rank adds to blows and parries only, and a fighter's defence is paid for in three more skills.
3. **The feat budget is the same** (7 at level 5) and is fully spent by both: a word is a feat, as a weapon technique is a feat.
   So the caster's real price is feats, as the fighter's is skills, and nobody can compare them by points alone.
4. **What offsets it:** spell points are finite (26), backlash and Control, `spWeary` (a rest does not give all of them back), words
   need nouns that are found in the world (`c.nouns`; Jabiku knows one), Jabiku's duel record at level 5 is 18% against a fighter's 84% and
   the AI casts little (HANDOFF: "casters barely cast"). The caster's cheaper skills are a real advantage on paper that the sims do not yet
   show as a strong one, because the feat that matters, a second noun, is content.

### Recommendation

No change to the points now. If the next casters' sims (with the AI fixed to cast, and heroes with a second noun) still show
Arcane worth about twice a fighting skill, then: **split Arcane**, as the fighter's skills are split. Cheapest: keep Arcane as the
casting skill (spell points, the roll, Casting and Words trees), and unlock the other six magic trees by a second skill each pair
can share with something a caster uses anyway (Devotion and Mending by Medicine, Necromancy by Nature or Arcane + feats,
Summoning and Affinity by the noun's own skill, Ritual by Lore). A caster who wants breadth then pays 2 to 3 skills as a fighter does, and
Medicine and Nature stop being spare. The alternative is to price a caster's rank higher (`spPerRank` 2 → 1, so a rank is a point of
spell pool, not two), which changes the pool, not the unlock: it does not fix the breadth.

## 7. The sim, in detail

### 7.1 Attributes: one more point, one at a time (`--attrs`)

Win-rate change in points, ± the standard error of the paired difference; a star is more than two. Level 3: 96 fights a variant; level 5: 72.

**Level 3**

| Hero | STR | CON | DEX | SPD | INT | WIL | WIS | CHA |
|---|---|---|---|---|---|---|---|---|
| Beren | +0.0 ± 1.0 | +3.6 ± 1.7 \* | +1.0 ± 1.0 | -9.9 ± 3.5 \* | +0.0 ± 0.0 | +1.0 ± 1.0 | +0.0 ± 0.0 | +0.0 ± 0.0 |
| Cyrus | +4.2 ± 2.1 \* | +11.5 ± 3.2 \* | +3.1 ± 1.8 | +7.8 ± 4.8 | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 | +1.0 ± 1.0 |
| Lorc | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 | +1.0 ± 1.0 | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 |
| Jabiku | +1.6 ± 1.2 | +1.6 ± 0.9 | +0.0 ± 0.0 | +1.0 ± 3.9 | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 | -2.6 ± 1.7 |

**Level 5**

| Hero | STR | CON | DEX | SPD | INT | WIL | WIS | CHA |
|---|---|---|---|---|---|---|---|---|
| Beren | +2.8 ± 2.8 | +0.7 ± 1.6 | +0.0 ± 0.0 | -2.8 ± 3.9 | +0.0 ± 0.0 | +1.4 ± 1.4 | +0.0 ± 0.0 | +0.0 ± 0.0 |
| Cyrus | +2.8 ± 3.4 | +7.6 ± 3.4 \* | +1.4 ± 1.4 | +7.6 ± 3.1 \* | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 |
| Lorc | +0.0 ± 0.0 | +2.1 ± 1.5 | +0.0 ± 0.0 | +4.2 ± 3.2 | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 |
| Jabiku | +0.0 ± 0.0 | +2.1 ± 1.5 | +0.0 ± 0.0 | +9.0 ± 4.6 | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 | +2.8 ± 2.0 |

Reading it: **CON** and **SPD** are the points worth buying for the frail and the quick (Cyrus +11.5 and +7.6 CON, +7.8 and +7.6 SPD; Jabiku SPD +9.0 at 5, inside the noise at 4.6; Lorc +10.4 SPD at 3); STR is worth 3 to 4 where the hero strikes; **DEX is small** (0 to +3) and **INT, WIS and CHA are 0.0 for all four heroes at both levels** (Jabiku's INT: his spell points come from Arcane). Beren's SPD is **negative** at level 3 (−9.9 ± 3.5) and at 5 (−2.8 ± 3.9): in plate, more SPD means more movement and a pool that the AI does not spend as well; that is an AI finding (it moves up for a blow it then cannot afford), not a rule. Armor-wearers do not want SPD; the unarmored do.

### 7.2 Skills: one more rank (`--skills`, level 3 only)

Only changes that moved anything are listed (a rank in a skill no rule reads in a duel, such as Medicine or Stealth, is 0.0).

| Hero | Skill | Δ win rate |
|---|---|---|
| Jabiku | arcane | +7.3 ± 2.6 \* |
| Cyrus | evasion | +4.7 ± 2.1 \* |
| Beren | melee | +3.6 ± 2.0 |
| Jabiku | evasion | +2.6 ± 1.5 |
| Jabiku | anticipation | +2.6 ± 1.5 |
| Beren | armor | +1.6 ± 1.7 |
| Cyrus | melee | +1.6 ± 2.8 |
| Beren | deception | -1.6 ± 0.9 |
| Jabiku | deception | -2.6 ± 1.7 |
| Beren | anticipation | -6.8 ± 1.9 \* |

Anticipation is the oddity: one more rank made Beren **worse** (−6.8 ± 1.9 \*) and Jabiku better (+2.6). Anticipation feeds the dodge (with Evasion), reading intent and seeing through feints; the AI's read-intent and bait choices change with it. It is an AI artifact to look at, not a finding about the skill. Deception reads −1.6 and −2.6 the same way.

### 7.3 Feats that moved nothing

43 of 90 feats measured showed no change (under 1.5 points on win rate and under 0.02 heroes dead a fight) for any hero and level that could hold or held them; the count in brackets is how many hero-levels. A duel cannot exercise most of them (§2), so this is a list of what the sim could not see, with a few feats that nobody would take (§3.2):

intellect (11), insight (11), brawlers_wind (9), trip (9), disarm (9), weight_of_the_blow (10), power_swing (9), hook (9), light_armor_training (9), mail_mobility (9), plate_endurance (5), field_repair (9), kip_up (11), escape_artist (9), control (5), battle_casting (3), steady_mind (3), familiar (3), verb_strike (3), verb_see (3), mod_strong (3), mod_wide (2), mod_long (3), mod_hidden (3), mod_delayed (3), hexer (3), mending_hands (4), blessing (3), binder (3), banisher (3), fire_affinity (3), shield_wall (3), wide_mercy (2), shield_breaker (1), cleave (1), bull_rush (2), ambusher (1), backstab (1), monster_lore (2), pin (2), dogpile (2), deadeye (1), overchannel (1).

### 7.4 The lab: feats the heroes' skills do not open

`--lab` gives a hero the feat and whatever skills and feats it needs (so the figure includes the worth of opening it; for Stealth, Persuasion, Intimidation and the like that includes the skill itself). Level 5, 10 seeds a foe (60 fights a variant), Beren, Cyrus, Lorc, Kalavar.

| Feat | Beren | Cyrus | Lorc | Kalavar |
|---|---|---|---|---|
| untouchable | +0.0 ± 0.0 | +30.8 ± 6.0 \* | +0.0 ± 0.0 | -1.4 ± 1.4 |
| find_the_gap | +9.2 ± 5.0 | – | +14.2 ± 4.5 \* | +27.1 ± 5.4 \* |
| flurry | +19.2 ± 5.1 \* | +10.0 ± 5.5 | +0.8 ± 0.8 | +10.7 ± 4.4 \* |
| dread | -2.5 ± 5.8 | -5.8 ± 4.5 | +1.7 ± 1.7 | -12.9 ± 3.9 \* |
| demoralize | -12.5 ± 5.3 \* | -12.5 ± 4.8 \* | +1.7 ± 1.7 | – |
| rally | -3.3 ± 3.5 | -11.7 ± 4.2 \* | -2.5 ± 3.0 | -8.6 ± 3.5 \* |
| command | -3.3 ± 3.5 | -11.7 ± 4.2 \* | -2.5 ± 3.0 | -8.6 ± 3.5 \* |
| to_your_feet | -3.3 ± 3.5 | -11.7 ± 4.2 \* | -2.5 ± 3.0 | -8.6 ± 3.5 \* |
| name_weakness | -2.5 ± 4.8 | -10.8 ± 4.6 \* | +0.0 ± 0.0 | -1.4 ± 1.4 |
| juggernaut | +10.0 ± 3.9 \* | -2.5 ± 3.0 | +4.2 ± 2.5 | +6.4 ± 2.5 \* |
| big_lie | +0.0 ± 2.4 | -9.2 ± 4.4 \* | +0.0 ± 0.0 | -1.4 ± 1.4 |
| dirty_trick | +2.5 ± 3.0 | -9.2 ± 4.4 \* | +0.0 ± 0.0 | -1.4 ± 1.4 |
| cleave | +6.7 ± 3.2 \* | +0.0 ± 0.0 | +0.8 ± 0.8 | – |
| sweep | +6.7 ± 3.2 \* | +0.0 ± 0.0 | +0.8 ± 0.8 | +0.0 ± 0.0 |
| bane_lore | +6.7 ± 3.8 | +3.3 ± 4.6 | +3.3 ± 2.3 | +0.0 ± 2.0 |
| charge | -1.7 ± 1.7 | -1.7 ± 1.7 | +0.0 ± 0.0 | +5.7 ± 3.7 |
| human_shield | -0.8 ± 1.9 | -1.7 ± 1.7 | +0.0 ± 0.0 | -5.0 ± 3.7 |
| crushing_blow | +0.0 ± 0.0 | +0.8 ± 2.5 | +3.3 ± 2.3 | +5.0 ± 2.1 \* |
| unstoppable | -1.7 ± 1.7 | +5.0 ± 3.7 | +0.0 ± 0.0 | +1.4 ± 4.7 |
| iron_grip | -0.8 ± 1.9 | -3.3 ± 2.3 | +0.0 ± 0.0 | +4.3 ± 3.8 |
| vanish | -4.2 ± 4.8 | -2.5 ± 5.6 | – | -2.1 ± 5.0 |
| shadow_step | -4.2 ± 4.8 | -2.5 ± 5.6 | +4.2 ± 3.4 | -2.1 ± 5.0 |
| deadeye | +0.0 ± 0.0 | +0.0 ± 0.0 | +3.3 ± 2.3 | +0.0 ± 0.0 |
| pin | -1.7 ± 1.7 | -1.7 ± 1.7 | +0.0 ± 0.0 | -2.9 ± 2.5 |
| dogpile | -1.7 ± 1.7 | -1.7 ± 1.7 | +0.0 ± 0.0 | -2.9 ± 2.5 |
| living_fortress | +0.0 ± 1.2 | +0.0 ± 0.0 | +1.7 ± 1.7 | +2.9 ± 2.9 |
| takedown | -1.7 ± 1.7 | -1.7 ± 1.7 | +0.0 ± 0.0 | -1.4 ± 3.2 |
| joint_lock | -0.8 ± 1.9 | -1.7 ± 1.7 | +0.0 ± 0.0 | +0.7 ± 4.1 |
| second_wind | +0.8 ± 0.8 | +1.7 ± 1.7 | +0.0 ± 0.0 | – |
| cover_story | -1.7 ± 1.7 | +0.0 ± 0.0 | +0.0 ± 0.0 | -1.4 ± 1.4 |
| feign_death | -1.7 ± 1.7 | +0.0 ± 0.0 | +0.0 ± 0.0 | -1.4 ± 1.4 |
| bull_rush | – | – | +0.0 ± 0.0 | +0.7 ± 0.7 |
| shield_breaker | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 | – |
| pinning_shot | +0.0 ± 0.0 | +0.0 ± 0.0 | – | +0.0 ± 0.0 |
| point_blank | +0.0 ± 0.0 | +0.0 ± 0.0 | – | +0.0 ± 0.0 |
| snap_shot | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 |
| ambusher | +0.0 ± 0.0 | +0.0 ± 0.0 | – | +0.0 ± 0.0 |
| backstab | +0.0 ± 0.0 | +0.0 ± 0.0 | – | +0.0 ± 0.0 |
| monster_lore | +0.0 ± 0.0 | +0.0 ± 0.0 | – | +0.0 ± 0.0 |
| shield_wall | – | +0.0 ± 0.0 | +0.0 ± 0.0 | +0.0 ± 0.0 |
| feint | – | – | +0.0 ± 0.0 | – |
| beat | – | – | +0.0 ± 0.0 | – |
| bind | – | – | +0.0 ± 0.0 | – |
| coup_de_grace | – | – | +0.0 ± 0.0 | – |

### 7.5 Level 10 (`--level 10 --n 8`, 48 fights a variant)

As planned: Beren 75%, Cyrus 77%, Lorc 26%, Jabiku 10%. With twelve feats held, **no marginal feat moves a fighter much**: the largest are Half-swording +8.3 ± 5.0 (Beren) and Light Touch +8.3 ± 4.0 \*
(Cyrus); Quick Thrust +5.2 for Beren; taking **Lunge** from Cyrus costs him 11.5 ± 5.4 \* (the one feat of the level-10 run that is plainly doing the work: +1 reach on a thrust, which
the play notes in HANDOFF already say reads as too long). Jabiku loses 8 to 10 points without Move, Far or Quick Casting. The foes are the same level-5 monster set, so this is a weak test of level 10:
it says a tenth-level hero's twelve feats are saturated against level-5 foes, which is as it should be (a bigger number is not the design), not how a level-10 hero fares against
level-10 foes. For that, `tools/tiers.js --level 10` is the tool.

### 7.6 The crawls (`--crawl temple_court`, party Beren, Cyrus, Lorc)

Beren at level 1, 24 crawls a variant (about 3.7 fights each): cleared 58% as planned (heroes dead a crawl 1.3); **nothing is beyond two standard errors** (the largest are Quick Block II −20.8 ± 12.0 and
+CON +8.3 ± 10.3). The standard error of a crawl at this n is 6 to 15 points, so a crawl sees nothing short of a 25-point change. The lab crawl for the ally feats (Beren at level 3, Rally, Command, To Your
Feet, Demoralize, Dread; 24 crawls each) reads +4.2 ± 15.3 to −16.7 ± 11.5, which is nothing. To measure a feat for allies, a party sim of several hundred crawls a variant is needed (about an hour of the
sim's cores); this step did not run one.

## 8. Rulings wanted

The step stops here for each of these. The number in brackets is where the evidence is.

| # | Question | Recommendation |
|---|---|---|
| F1 | **Toughness: +1 CON a rank is a bigger pool.** CON is life: every wound lands on it, and the philosophy says power is never a bigger pool. +1 CON was the best or second best change in the sim for Cyrus (+11.5 ± 3.2 at level 3, +7.6 at 5), Beren (+3.6 at 3), Arvir (+13.7 at 5) and Jadier (+8.9 at 5): the best of all for Cyrus at 3 and Arvir at 5 [§2, §7.1]. | Take CON out of the feats: the attribute tree stays for STR, DEX and SPD (AP and reach, which are *reacting more*), and Toughness becomes a **mitigation** feat, not a pool: for example "the first point of each blow's CON harm goes to stamina instead" (lasting longer, not more life). If you want the pool kept, cap Toughness at one rank. |
| F2 | **Conditioning's mind branch** (Intellect, Insight, Presence) does nothing in a fight (0.0 for every hero; Presence is −3 to +3, noise) and sits in the `body` group. Resolve helps backlash and resists. | Leave the data, move the branch's group to `exploring` or `talking` where INT, WIS and CHA are read; no code. |
| F3 | **The number feats** (58 of 144, §3.1) against the 2026-11-07 ruling that numbers belong in skills. Five clusters: the **armor penalty** five (Light Armor Training, Mail and Plate Mobility, Mail and Plate Endurance), which the Armor skill already does at 5% a rank; the **stamina** savers (Economical Parry and Block, Light Touch, Light on Your Feet, Brawler's Wind, Heavy Weapon Training), which regeneration every round (R1) made small; the **damage** numbers (Precision, Weight of the Blow, Crushing Blow, Backstab, Bane Lore); the **Quick** feats (Thrust, Hands, Parry, Block, Dodge, Draw, Casting); the **magic** numbers (Grave Touch, Mending Hands, Fire Affinity and the like). | Fold the first three clusters into skills: delete the armor five and raise `skills.armorPerRank` (0.05 now; 0.08, untested, would have Armor 9 and 10 remove most of a penalty), delete Economical Parry and Block, Brawler's Wind, Light on Your Feet and Heavy Weapon Training and leave their stamina to the skill that governs the action (**Light Touch is the exception**: +6.8, +4.2, +8.3 and +8.9 for the four light-weapon hero-levels; the duellist's many cheap blows still tire him, so give Melee a stamina effect on light weapons before folding it), turn the damage numbers into `effects` on the unlock feats. **Keep the Quick feats**: they are the AP currency, "reacting more", and the sim says they are among the strongest numbers (Quick Casting II +13.9 ± 4.1, Quick Dodge +9.4 and +6.9, Quick Thrust +7.1 and +6.9; Quick Parry and Quick Block measure nothing against these foes); a quarter off the AP of the action you do most is a large benefit. |
| F4 | **Half-swording is a must for a sword.** +14.3 ± 4.2 (Kalavar), +18.5 ± 4.9 (Jadier), +6.3 ± 2.4 (Beren at 3); +2.4 (Arvir, who closes less). What it is: a +3 to find a gap in armor and the point's pass-through, at +1 AP and reach 1 (`CONFIG.pierce.feats`, `character.js`), so it is the longsword's answer to the armor the foes in these sims wear. By the philosophy ("armor is king in melee") a sword *should* need an answer to armor, so this is not a flaw; it is a flag, because a sword hero who skips it is 15 points down, and the Technique branch it lives in has no capstone to make the branch more than a toll. | Leave the feat. Give Technique its capstone (F5). Note the answers to armor now: Find the Gap (light points), Half-swording (swords), Crushing Blow and Shield Breaker (blunt, shields); an axe has none. |
| F5 | **The six capstones that are written nowhere:** Striker, Fencer, Assassin, Technique, Runner (and Charmer, Menace, Wilds, outside a fight). One line each, in the "a way of fighting, not a bigger number" shape; none needs a new rule beyond a condition that exists. | **Striker: Knockout**: a punch or kick to the head of a foe under half stamina collapses them at once (an unarmed finisher). **Fencer: Opening**: a parry that wins by 5 or more leaves the attacker *exposed* (the Dirty Trick's condition) against the answering blow. **Assassin: Dead Weight**: vital rolls against a foe who is held, prone, surprised or unseen count double (the knife in the down; double the head's existing weight). **Technique: Hold the Line** (written in PROPOSALS §3.2 for a polearm branch): a foe that closes within your reach stops there, as a shield-bash's knockdown would. **Runner: Slip the Hold**: once a round, break any clinch, hold or pin at no AP and no roll. Say which to build. |
| F6 | **To Your Feet** (Captain capstone) is dominated by Rally since step 2: Rally brings the collapsed round at once, for allies within 3, at a round's regeneration; To Your Feet raises one ally beside you at a quarter stamina, once. What it still has over Rally is the ally downed by wounds, not a collapse. | Raise its reach to 3 squares and give the ally the AP to act, not only their feet: "they rise at half stamina and may act at once with 2 AP", so it is the capstone's mark, a second action in a fight. |
| F7 | **Kip-Up** stands you for 1 AP: nothing to anyone unarmored or in padded or leather, who already stand for 1 (`CONFIG.standUp`); 1 saved in mail, 3 in plate. It sits in Evasion, which a plate fighter seldom has. 0.0 for all eight hero-levels measured. | Rework: standing costs half an AP and no stamina, and the standing fighter may **dodge or parry in the same breath** (a prone fighter can neither today). Or move it to the Plate branch and keep the text. |
| F8 | **Off-hand Dagger, Quick Donning, Focus Bond: delete.** Off-hand Dagger gates what anyone holding an off-hand dagger can already do (`offParry`); the game has no donning time to halve; Focus Bond duplicates Battle Casting. **Shape and Swift** (one feat a word, no spell uses either word): design the word or delete the feat. The eight **ritual** feats are all unbuilt and out of a fight: leave them for the content step. | Delete the first three now (a small data change and a `skills.retired` style note); keep Shape, Swift and the rituals on the list. |
| F9 | **Sweep and Cleave after R8.** A swing now carries into a second foe when it drops or passes its target. Cleave still adds a full-force free blow at any foe in reach when the first drops; Sweep a half-force carry that does not need a drop. Both still read as feats, but each is half-ordinary. Whirlwind sits on them as the capstone. | Leave as they are until Whirlwind has had a swarm crawl (its numbers are first guesses). |
| F10 | **XP** (§5): the content is worth 25,000 XP a hero; level 20 is 11,400 at `xpBase: 60`, so the level-4 places end at the cap. | `xpBase: 200` (level ≈ the place's level + 1 after each tier; 20 is 38,000), and a falloff of a foe's XP against a hero many levels above it, so the citadel's 9,220 is not an outlier. Party size: see §5. |
| F11 | **Magic's price** (§6): Arcane gates 65 feat ranks and gives spell points; a marginal Arcane rank is worth about twice a fighter's best. | Hold until casters are measured with a second noun and an AI that casts; then split Arcane's unlocks across the skills a caster would have anyway (Medicine, Nature, Lore). Not before. |
| F12 | **Whirlwind's cost and force** (same AP, 1.5× stamina, ¾ on the others): a guess. | Run it in a swarm crawl (`sim/swarm.js`) and a two-hander mirror before treating it as tuned. |
| F13 | **The Quick feats' half-AP rounding** is already the open ruling in HANDOFF (step 8). | Quick feats cut a whole half AP a rank (the recommendation stands). |

