# Simulation findings

## Aimed blows land where the body is open (2026-11-11; the user's note; PROVISIONAL, `rules.yaml locations.aim.hold`)

The user: targeting should be decided more by what happens to be open than by aim. An aimed blow now lands where aimed
with chance 0.4 + 0.05 × the attacker's Melee or Ranged (at most 0.85); otherwise the location roll decides, as for an
unaimed blow. Against a defender who can't cover (prone, down, held or pinned, or not seeing the blow) it lands where
aimed, as before. The aim's penalty to beat a defence is unchanged. The AI and the preview see the blend (a test checks
it against the rolled outcome). This takes the "defender who can't react" half of R6 ahead of step 4.

Seed 4242, on top of step 2 (party of 3; before → after):

| Place | cleared | dead a fight | head (of located blows) | top location after | kills by thrust |
|---|---|---|---|---|---|
| court | 17 → 17 | 0.33 → 0.35 | 45% → 33% | head 33% | 56% → 54% |
| hall | 2 → 1 | 0.39 → 0.40 | 49% → 26% | torso 30% | 65% → 71% |
| valley | 3 → 8 | 0.89 → 0.73 | 45% → 25% | torso 32% | 63% → 71% |
| duels (400) | | 0.46 → 0.47 heroes | 66% → 42% | | |

The head's share falls to about a quarter in the hall and the valley (target: under a quarter) and to a third in the
court; deaths a fight do not rise. Duels still go mostly to the head (42%): there both sides stand still and aim every
blow. **The sword-and-shield standoff is untouched** and could not be touched by this: it is two full plate harnesses,
the same everywhere (FINDINGS "Stamina as a pool", point 6). The spiral's Beren mirror timed out in 75% of even fights
before and after.

## Stamina as a pool (2026-11-11; step 2 of `docs/PLAN.md`, rulings R1 to R3; PROVISIONAL, `CONFIG.stamina`)

What changed (each part is a key of `CONFIG.stamina`; null restores the old rule, and with all three null the crawls
reproduce the baseline fight for fight):

- **R1 `regen: {scale: 3, struck: 0.5}`**: regeneration every round, regen × 3 (action costs were already × staminaScale
  3, regeneration was not), half of it (rounded up, at least 1) in a round a blow took stamina. Heavy armor's negative
  regeneration is whole every round. A crush (a constrictor) counts as a blow.
- **R2 `spent: {attack: 2, defense: 2}`** with `vigor.spent: 0.5`: an action the fighter can't pay for is taken spent,
  leaving them at 1; a spent blow is 2 easier to meet and lands at × 0.5; a defence taken spent is 2 harder. The
  command panel shows the stamina in the warning colour with a "!" and says why.
- **R3 `collapse: {rounds: 1}`**: stamina 0 is a collapse: prone, out for the rest of the round and the next, then
  round with a round's regeneration, on the ground. Rouse, healing and Rally bring them round at once.
- **Second Wind** (was: regenerate after up to 2 blunt): full regeneration when struck, and a collapse lasts only its
  own round. **Rally** (was: regenerate at the round's end though struck): a round's regeneration at once to the side
  within 3, and the collapsed among them come round.
- **AI**: a collapsed foe in reach is a target, weighed against a standing one (`stamina.ai.finish`: × 1.25 if they
  come round at this round's end, × 0.95 if later; it can't be met, and the blow goes to the body). A spent blow is
  thrown only if it could finish someone (`stamina.ai.spentWorth` 30, about a likely collapse); otherwise the fighter
  steps out of reach to get its full regeneration back, or stands and keeps its AP for a defence.
- Metrics: collapses now split into got up / died while down / still down when the fight ended (and of those, on the
  winning side, who come round after it). `sim/crawl.js` and `sim/swarm.js` `--set` now read JSON: before, `null`
  became the string "null".

Seed 4242, the step-1 commands. "Before" is the step-1 baseline (re-run with the three keys null, which matches it
exactly and adds the new columns).

**Against the targets** (first areas, party of 3; before → after):

| Goal | Measure | Target | Before | After | Met? |
|---|---|---|---|---|---|
| Fast | median rounds (90th) | 3 to 5 | court 4 (7), hall 4 (14), valley 5 (17); duels 2 | court 3 (7), hall 4 (11), valley 5 (13); duels 2 (5) | crawls yes; duels no (unchanged) |
| Lethal but playable | heroes dead a fight | ≤ 0.5 | 0.21, 0.34, 0.81 | 0.33, 0.39, 0.89 | 2 of 3; all three worse |
| | places cleared of 30 | ≥ 18 | 12, 0, 3 | 17, 2, 3 | no (court close) |
| Death spiral | survivor with a STR/DEX/SPD wound | ≥ ⅓ | 0% | 0% | no (step 3) |
| | wounded twin's win rate | < 50%, falling | STR yes; DEX barely; SPD rises | the same shape (table below) | no |
| Stamina matters | someone under ½ | ≥ ⅓ | 68%, 42%, 63%; duels 24% | 70%, 42%, 51%; duels 20% | crawls yes; duels no |
| | collapses that get up in the same fight | most | 5 of 55, 9 of 60, 2 of 37; duels 0 of 39 | 11 of 54, 24 of 80, 1 of 30; duels 0 of 41 | **no** |
| Tactical depth | largest share of blows by one action | < ½ | thrust 36%, 56%, 58% | thrust 38%, 50%, 57% | court only (unchanged) |
| | blows on the head | < ¼ | 47%, 49%, 46% | 45%, 49%, 45% | no (step 4) |
| Action economy | level-8 hero against N level-1 foes | loses at about N = 4 | 87, 65, 46, 42, 33, 24% | 88, 68, 48, 43, 36, 26% | roughly (unchanged) |

**Crawls** (30 each). Collapses: all / got up / died while down / down at the end (of those on the winning side);
heroes' alone after the slash.

| Run | cleared | rounds med / 90th | dead a fight | under ½ / ¼ | collapses | heroes' collapses | top action (all; heroes') | head | kills by thrust |
|---|---|---|---|---|---|---|---|---|---|
| court 3, before | 12 | 4 / 7 | 0.21 | 68% / 51% | 55 / 5 / 1 / 49 (15) | 52 / 5 / 1 / 46 (15) | thrust 36%; 50% | 47% | 61% |
| court 3, after | 17 | 3 / 7 | 0.33 | 70% / 48% | 54 / 11 / 18 / 25 (8) | 48 / 11 / 16 / 21 (8) | thrust 38%; 52% | 45% | 56% |
| hall 3, before | 0 | 4 / 14 | 0.34 | 42% / 34% | 60 / 9 / 10 / 41 (7) | 52 / 9 / 6 / 37 (7) | thrust 56%; 56% | 49% | 65% |
| hall 3, after | 2 | 4 / 11 | 0.39 | 42% / 36% | 80 / 24 / 29 / 27 (5) | 79 / 24 / 28 / 27 (5) | thrust 50%; 50% | 49% | 65% |
| valley 3, before | 3 | 5 / 17 | 0.81 | 63% / 54% | 37 / 2 / 11 / 24 (1) | 30 / 2 / 9 / 19 (1) | thrust 58%; 44% | 46% | 65% |
| valley 3, after | 3 | 5 / 13 | 0.89 | 51% / 44% | 30 / 1 / 11 / 18 (0) | 20 / 1 / 9 / 10 (0) | thrust 57%; shoot 48% | 45% | 63% |
| court 4, before | 29 | 3 / 5 | 0.10 | 69% / 50% | 48 / 18 | | thrust 46%; 56% | 53% | 67% |
| court 4, after | 30 | 3 / 5 | 0.21 | 60% / 34% | 33 / 14 / 14 / 5 (5) | 30 / 14 / 11 / 5 (5) | thrust 48%; 57% | 55% | 61% |
| hall 4, before | 6 | 4 / 10 | 0.36 | 55% / 39% | 81 / 11 | | thrust 56%; 61% | 51% | 70% |
| hall 4, after | 3 | 4 / 13 | 0.57 | 52% / 41% | 114 / 49 / 27 / 38 (12) | 109 / 49 / 27 / 33 (12) | thrust 56%; 64% | 50% | 75% |
| valley 4, before | 11 | 4 / 31 | 0.85 | 59% / 41% | 46 / 2 | | thrust 55%; 45% | 42% | 62% |
| valley 4, after | 12 | 4 / 18 | 1.04 | 47% / 35% | 38 / 6 / 22 / 10 (0) | 33 / 4 / 20 / 9 (0) | thrust 59%; 46% | 48% | 64% |

**The new numbers, tried with `--set`** (party of 3; court / hall / valley):

| Setting | cleared | dead a fight | heroes' collapses: got up / died down / of | rounds med (90th) |
|---|---|---|---|---|
| as built (regen.scale 3, spent 2/2, collapse.rounds 1) | 17 / 2 / 3 | 0.33 / 0.39 / 0.89 | 11/16/48, 24/28/79, 1/9/20 | 3 (7), 4 (11), 5 (13) |
| regen.scale 2 | 14 / 0 / 7 | 0.47 / 0.44 / 0.78 | 14/23/56, 24/23/73, 1/10/20 | 4 (8), 4 (11), 5 (18) |
| regen.scale 4 | 19 / 3 / 6 | 0.31 / 0.37 / 0.81 | 12/15/38, 15/19/55, 1/13/27 | 4 (8), 4 (11), 5 (15) |
| spent.attack and .defense 4 | 19 / 0 / 8 | 0.37 / 0.49 / 0.83 | 24/20/55, 15/27/67, 3/12/21 | 4 (9), 4 (11), 5 (12) |
| collapse.rounds 0 (not R3 as ruled) | 23 / 4 / 8 | 0.32 / 0.44 / 0.97 | 163/12/177, 65/21/94, 27/10/39 | 4 (8), 4 (11), 6 (17) |
| the AI never strikes the collapsed (ai.finish 0) | 22 / 2 / 10 | 0.28 / 0.37 / 0.70 | 38/1/49, 49/11/92, 20/3/39 | 3 (7), 4 (12), 5 (16) |

**Duels** (`--n 40`): win rates within a fight or two of the baseline everywhere (Beren beats Jabiku 78%, was 93%; the
rest unchanged or ±7). Median 2 rounds. 41 collapses, none got up: a duel ends the round its one fighter on a side
collapses (see the ruling below). **Spiral**: the same shape as the baseline. Pooled STR 38, 34, 21, 11, 8% at k = 0..4
(was 50, 45, 32, 12, 12), SPD 38, 43, 53, 53, 46% (still rises), DEX 38, 37, 33, 33, 33%. The Beren mirror times out in
75% of even fights (was 65%). **Swarm**: 88, 68, 48, 43, 36, 26% at N = 1..6 (was 87, 65, 46, 42, 33, 24).

**What this says.**

1. *Regeneration and the spent action do what they are for, but they are not the "get up" lever.* Between regen scale
   2 and 4 the share of heroes' collapses that get up hardly moves (a fifth to a third), and 30 crawls a place can't
   tell 3 from 4 on clears (the valley swings 3 to 7 between neighbouring settings). Faster regeneration means fewer
   collapses, not more recoveries. I kept the numbers as built: 3 is the one that matches costs to regeneration on
   principle, and nothing measured here argues for another.
2. *Two things decide whether a collapse gets up, and neither is a regeneration number.* One is the length of the
   collapse: with collapse.rounds 0, 163 of 177 heroes' collapses in the court get up. That is not R3 as approved (out
   for a full round), so I did not adopt it. It also produces a yo-yo: 177 collapses in 107 fights, the same heroes
   down and up again. The other is that the AI now finishes the collapsed. With the AI told never to (ai.finish 0),
   38 of 49 get up in the court, clears go to 22, and deaths fall to 0.28. Under R3 as approved, a body lying beside a
   foe for a round and a half is killed, so "most collapses get up" can only be met if collapses happen where no foe
   can reach them, or are shorter, or a foe would rather fight the standing. **This needs a ruling** (below).
3. *Fights are not longer.* Median rounds stay at 3 to 5 in every crawl and the 90th centile fell (hall 14 → 11, valley
   17 → 13, valley of 4 31 → 18): a fight no longer waits on unconscious bodies. No new number lengthens fights.
4. *Deaths rose everywhere* (court of 3 0.21 → 0.33, court of 4 0.10 → 0.21, hall of 4 0.36 → 0.57), almost all of it
   the AI finishing collapsed heroes ("died down"; 16, 28, 9 heroes in the three places of 3). Clears still rose in the
   court (12 → 17) because collapsed heroes now come back when their friends hold on. Before, the old AI ignored the
   unconscious, so a hero who dropped was out but alive.
5. *Duels can't show a recovery.* A fight ends at the round's end when a side has nobody standing, and a duel side is
   one fighter. Duels are unchanged in length and almost unchanged in result.
6. *The sword-and-shield stalemate is plate against a sword, not the shield.* Two Berens in full plate find the thrust
   turned every time, so they trade shield bashes and kicks, which plate takes 3 of every 4 or 5. Beren's plate gives
   him 0 regeneration, so it is a slow drain to the 30-round cap (75% of even fights). Hit locations make no difference
   here: a full harness is the same everywhere. What would: the AI wrestling or throwing a foe it can't otherwise hurt
   (step 5), or the user's call that two plated swordsmen should struggle and the answer is a hammer.
7. *Side effects worth knowing.* Holding a grapple costs 6 stamina a round and an unstruck holder now regains 6, so a
   hold costs nothing at steady state. A level-1 knight template still beats a level-8 hero almost one time in three
   (knights row of the swarm).

**Rulings I made that the plan did not cover.**

- A fight still ends at a round's end when one side has nobody standing; collapsed counts as down. (The alternative,
  fighting on until the collapsed come round, lets the winners finish them; same outcome, longer logs.)
- Unconscious (until roused or healed) is kept for two causes: hero mode's knockout (a CON blow past the last point)
  and a body called back from death by Raise + Life. Everything else at stamina 0 is a collapse, and the log and UI say
  "collapses" and "Collapsed".
- An action that would leave exactly 0 is spent, not paid (as `exertionCanKnockOut: false` had it refused): you never
  spend yourself into a collapse; only blows, armor's drain, auras and the like do that.
- Spent blows with a missile or a spell are easier to meet but no softer (vigor never touched them).
- A collapse that begins during the round's end (bleeding, heavy armor) lasts the next round, the same as one taken
  during the round.
- The AI's spent-blow threshold and finishing weights are AI judgement, put in `CONFIG.stamina.ai` only so sims can
  `--set` them.

**Ruling wanted.** "Most collapses get up" and "the AI finishes the collapsed" pull against each other under a full
round out. My recommendation: keep R3's length and the AI finishing; drop or change that target. The death it brings is
the point of the design (lethal, and the cost of running dry is real), and the counterplay exists: Rally, rouse,
healing, standing over a fallen friend. If the user wants more recoveries, the cleanest number is `collapse.rounds: 0`
(the rest of the round only).

## Baseline for the tuning plan (2026-11-11; step 1 of `docs/PLAN.md`, no rule changed)

Seed 4242 throughout. `node sim/crawl.js <place> --party 3|4 --n 30 --metrics`, `node sim/duels.js --n 40 --seed 4242
--metrics`, `node sim/spiral.js --n 40`, `node sim/swarm.js --n 8` (the metrics: `sim/metrics.js`, an observer on the
existing `enc.onHit` hook, which now also carries the option and the location; with it unset nothing changes, and
with it set the results are the same to the fight). "Heroes dead" is each fight's own deaths; the crawl's older
column, now labelled "heroes dead so far", counts the party's dead including earlier fights (that is where the plan's
"0.3 to 1.8" came from). Below-half and below-quarter count any fighter on either side who is not tireless.

**Against the targets** (first areas, party of 3 unless said):

| Goal | Measure | Target | Baseline | Met? |
|---|---|---|---|---|
| Fast | median rounds a fight | 3 to 5 | court 4, hall 4, valley 5 (90th: 7, 14, 17); duels 2 | yes (crawls); duels no |
| Lethal but playable | heroes dead a fight | ≤ 0.5 | court 0.21, hall 0.34, valley 0.81 | 2 of 3 |
| | places cleared of 30 | ≥ 18 | court 12, hall 0, valley 3 | no |
| Death spiral | fights where a survivor ends with a STR/DEX/SPD wound | ≥ ⅓ | 0% in every crawl and duel | no |
| | wounded twin against a fresh one | clearly < 50%, falling | STR yes; DEX barely; SPD rises (table below) | no |
| Stamina matters | fights where someone drops under ½ | ≥ ⅓ | crawls 42–68%; duels 24% | yes (crawls); duels no |
| | collapses that get up in the same fight | most | court 5 of 55, hall 9 of 60, valley 2 of 37; duels 0 of 39 | no |
| Tactical depth | largest share of blows landed by one action | < ½ | thrust: court 36%, hall 56%, valley 58% (the heroes' own 50%, 56%, 44%); duels 59% | court only |
| | blows on the head (of those with a location) | < ¼ | court 47%, hall 49%, valley 46%; duels 66% | no |
| Action economy | level-8 hero against N level-1 foes | loses at about N = 4 | wins 87, 65, 46, 42, 33, 24% at N = 1..6 | roughly (crosses ½ near N = 3), with a huge spread by hero |

**Crawls** (30 each):

| Place | party | cleared | rounds median / 90th | dead a fight | under ½ / ¼ | collapses / got up | attr wound | top action (all; heroes') | head | kills by thrust |
|---|---|---|---|---|---|---|---|---|---|---|
| temple_court | 3 | 12 | 4 / 7 | 0.21 | 68% / 51% | 55 / 5 | 0% | thrust 36%; 50% | 47% | 61% |
| ember_hall | 3 | 0 | 4 / 14 | 0.34 | 42% / 34% | 60 / 9 | 0% | thrust 56%; 56% | 49% | 65% |
| orc_valley | 3 | 3 | 5 / 17 | 0.81 | 63% / 54% | 37 / 2 | 0% | thrust 58%; 44% | 46% | 65% |
| temple_court | 4 | 29 | 3 / 5 | 0.10 | 69% / 50% | 48 / 18 | 0% | thrust 46%; 56% | 53% | 67% |
| ember_hall | 4 | 6 | 4 / 10 | 0.36 | 55% / 39% | 81 / 11 | 0% | thrust 56%; 61% | 51% | 70% |
| orc_valley | 4 | 11 | 4 / 31 | 0.85 | 59% / 41% | 46 / 2 | 0% | thrust 55%; 45% | 42% | 62% |

Blows landed by action, party of 3 (all blows): court thrust 36, shoot 24, punch 11, spell 11, natural 10, kick 4,
swing 2, two-handed 1; hall thrust 56, spell 19, shoot 18, kick 5, punch 2; valley thrust 58, shoot 27, spell 9, kick
5, swing 1. Nobody's bash, power or two-handed blow reaches 1% except the court's beaked foes. By location (party of 3):
head 46–49, torso 21–28, legs 11–12, arms 9–10, hands 2–9, feet 2–3.

**Duels** (40 each, seed 4242; heroes dead counts only heroes, so a hero against a hero is about 1):

| A vs B | A wins | rounds med / 90th | under ½ / ¼ | collapses / up | top action | head |
|---|---|---|---|---|---|---|
| Beren vs Cyrus | 100% | 1 / 4 | 38% / 28% | 2 / 0 | thrust 99% | 26% (hands 72%) |
| Beren vs Jabiku | 93% | 2 / 4 | 18% / 10% | 4 / 0 | spell 56% | 64% |
| Cyrus vs Jabiku | 83% | 2 / 2 | 3% / 0% | 0 / 0 | spell 60% | 90% |
| Beren vs scaleward | 60% | 5 / 7 | 80% / 57% | 15 / 0 | thrust 60% | 78% |
| Cyrus vs scaleward | 93% | 3 / 6 | 55% / 38% | 13 / 0 | thrust 82% | 88% |
| Jabiku vs scaleward | 0% | 3 / 5 | 8% / 3% | 1 / 0 | spell 52% | 20% |
| Beren vs fireGoblin | 100% | 2 / 3 | 3% / 0% | 0 / 0 | thrust 100% | 98% |
| Cyrus vs fireGoblin | 0% | 1 / 4 | 15% / 13% | 2 / 0 | thrust 100% | 95% |
| Cyrus vs goblinWarrior | 100% | 2 / 4 | 23% / 8% | 2 / 0 | thrust 100% | 100% |
| Beren vs wolf | 100% | 1 / 3 | 3% / 0% | 0 / 0 | thrust 100% | 68% |
| all 400 | | 2 / 5 | 24% / 16% | 39 / 0 | thrust 59% (heroes' 68%) | 66% |

Killing blows in duels: thrust 86%, two-handed 9%. No duel ends with an attribute wound on the survivor.

**Spiral** (`sim/spiral.js`: the wounded twin's wins of 40, the same seeds for every k; in brackets the share that
ran 30 rounds without a result):

| Hero | attr | k = 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|---|
| Beren (sword, shield) | STR | 20% (65%) | 8% (55%) | 3% (45%) | 0% (55%) | 5% (85%) |
| | SPD | 20% (65%) | 5% (80%) | 45% (50%) | 38% (55%) | 45% (48%) |
| | DEX | 20% (65%) | 8% (75%) | 5% (83%) | 8% (80%) | 10% (73%) |
| Lorc | STR | 48% | 43% | 30% | 35% | 33% |
| | SPD | 48% | 50% | 40% | 45% | 30% |
| | DEX | 48% | 45% | 40% | 38% | 40% |
| Cyrus (spear) | STR | 50% | 50% | 40% | 8% | 0% |
| | SPD | 50% | 68% | 88% | 88% | 98% |
| | DEX | 50% | 50% | 50% | 50% | 50% |
| Jabiku (caster) | STR | 40% (23%) | 45% (18%) | 33% (28%) | 0% | 0% |
| | SPD | 40% (23%) | 40% (25%) | 20% (63%) | 20% (63%) | 18% (57%) |
| | DEX | 40% (23%) | 40% (18%) | 35% (18%) | 33% (23%) | 33% (25%) |
| pooled, of decided fights | STR | 50% | 45% | 32% | 12% | 12% |
| | SPD | 50% | 56% | 68% | 68% | 64% |
| | DEX | 50% | 47% | 43% | 43% | 44% |

**Swarm** (`sim/swarm.js`: one level-8 hero against N level-1 foes of one foes.yaml template; 8 fights for each hero,
template and N, so 576 a column):

| Hero | N = 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Cyrus | 100% | 100% | 100% | 92% | 94% | 73% |
| Spawnee | 100% | 100% | 95% | 88% | 47% | 16% |
| The Crusader | 94% | 88% | 77% | 63% | 63% | 66% |
| Beren | 94% | 83% | 67% | 66% | 50% | 41% |
| Arvir | 95% | 84% | 44% | 50% | 41% | 19% |
| Jadier | 78% | 42% | 23% | 17% | 0% | 3% |
| Lorc | 92% | 38% | 6% | 2% | 0% | 0% |
| Jabiku | 69% | 50% | 3% | 0% | 0% | 0% |
| Kalavar | 64% | 5% | 0% | 2% | 0% | 0% |
| **all** | 87% | 65% | 46% | 42% | 33% | 24% |
| against knights only | 72% | 28% | 25% | 15% | 14% | 3% |
| against bandits only | 93% | 83% | 57% | 60% | 49% | 40% |

**What contradicts the plan's assumptions.**

1. *Deaths are attrition, not lethal fights.* The plan's "0.3 to 1.8 dead a fight" was the crawl's cumulative column.
   Each fight's own deaths are 0.21 (court), 0.34 (hall) and 0.81 (valley), so the per-fight target is already met in
   two first areas, yet they are cleared 12 and 0 times in 30. The hall is six fights or so (186 fights in 30 crawls):
   0.34 a fight is two of three heroes by the end. The valley's 0.81 is its third fight (7.1 foes with joiners, 1.79
   dead). The two "lethal but playable" targets disagree: with no healing of the dead between fights, ≥ 18 clears needs
   well under 0.5 a fight (about 0.1 in a six-fight place). Step 6 should pick which one rules.
2. *Stamina already matters.* Someone drops under half in 42–69% of crawl fights; the target is met there. What is
   missing is coming back: 5–38% of collapses get up (none in a duel), which is R3's job, not R1's.
3. *A wounded SPD can win.* In the spear mirror the twin with less SPD wins more (98% at k = 4), and in Beren's from k
   = 2 on: with fewer AP it waits, the other closes into its reach and takes the first thrust. DEX wounds hardly move
   anything (Cyrus is flat at 50%). STR is the only attribute whose loss reliably costs fights. A spiral will need step
   5's approach logic as well as step 3's wounds.
4. *Sword and board against itself is a stalemate.* Two Berens run out of 30 rounds in 65% of fights (Jabiku 23%), so
   "falling with wounds" can't be read from Beren's row; neither can cut through the other's shield.
5. *The swarm target is about met on average and nowhere in particular.* The pooled rate crosses ½ near N = 3, but
   heroes range from Kalavar (loses to two) to Cyrus (wins 73% against six), and a level-1 knight template beats a
   level-8 hero one time in four. The spread is the AI and the kits more than the action economy.
6. *What the plan assumed and holds:* the thrust carries the kills (61–70% in crawls, 86% in duels) and the head takes
   about half of located blows (42–53% in crawls, 66% in duels); duels last 2 rounds; no fight leaves a survivor with
   a STR/DEX/SPD wound (a shieldless Beren against the scaleward, 40 fights: every point of attribute harm on either
   side went to CON).

## Sarnaks and minotaurs (2026-11-10; first numbers)

`node tools/tiers.js` (M = heroes of the monster's level for an even fight; n 48–72):

| Monster | Kit | M | tier |
|---|---|---|---|
| sarnak | scales, spear in two hands, Melee 2 | 1.34 | 3 |
| sarnak knight | half mail, iron heater, spear | 1.50 | 4 |
| sarnak warden | full mail, iron heater, spear, `apMult` 1.4, Toughness | 2.00 | 4 |
| minotaur | ogre hide, great axe, gore, STR 15 | 1.56 | 4 |
| lord of the labyrinth | the same, STR 19 CON 18, `apMult` 3 | 2.42 | 4 |

What the tries showed. (1) The spear carries the sarnaks: with spear and hide shield the plain one was M 1.44, above
a knight in mail with a longsword (0.95) and a warden with the battle axe and `apMult` 1.8 (1.08; two heroes beat it
98%). All three now carry spears. The battle axe in one hand behind a shield is the weakest kit tried. (2) A minotaur
beats one hero 4 times in 5 and loses to two 2 times in 3: hide does not keep two attackers off. STR 19 and CON 18
added nothing (1.66 against 1.56), and half mail made the lord *worse* (1.28, no Armor skill or with Armor 3), which I did not
run down. Only `apMult` moved it: 2 gave 1.65, 3 gave 2.42.

Encounters as first written, three heroes / four (win %, dead per fight): gate (2 sarnaks) 63 / 58, 1.4 dead; patrol
(sarnak + knight) 58 / 75; hall (2 sarnaks + knight) 29 / 42; warden + knight 50 / 67; minotaur pair 63 / 71; lord +
minotaur 21 / 75. The hall was cut to sarnak + knight and the lord left alone (three heroes beat it 75%); the rest
stand, not re-run. About 1.8 heroes die in every one of these, win or lose: both places are hard for a party of three at
their level, like the rest of the game at present.

## Weapon roles (2026-11-10; PROVISIONAL, `CONFIG.weaponPhysics`)

**The ruling** (the user, 2026-11-09). Blunt swings are the best against armor and the undead; spear and rapier
thrusts the best against the living (reach, speed, lethality); the longsword is the generalist: "light so not a lot
of blunt damage on a swing (but non negligible) with good thrust reach and damage but heavier than a rapier so more
AP"; axes are "heavier, slower sword swings with no effective thrust option".

**What changed.** (1) A swung edge's blunt comes from its weight, `edgeBlunt` 2.2 × edge × √(mass × length × heft ×
grip), not a seventh of the cut (claws and other natural edges keep the seventh). (2) `thrustHeavy`: a point over
1.1 kg (÷ grip in two hands) with an edge behind it costs 0.6 × (mass/1.1 − 1) more; spears are exempt (held at the balance). (3) `buttDamage` 2.5: the staff's butt jab is 3 blunt,
not 6. (4) `phys.heft` (a head-heavy edge) and a one-handed `battleAxe` (1.6 kg, 0.8 m, edge 1.3, heft 1.2).

**The table** (STR 6, Melee 4; each cell is harm to CON c / attributes a / stamina s for a landed blow):

| Weapon, action | AP | reach | damage P/S/B | bare | padded | mail | plate | skeleton |
|---|---|---|---|---|---|---|---|---|
| rapier thrust | 1.9 | 2 | 6/0/0 | 8c | 4c | 1c 2s | 0 | 0 |
| short spear thrust | 1.7 | 3 | 6/0/0 | 8c | 4c | 1c 2s | 0 | 0 |
| spear thrust | 2.0 | 4 | 8/0/0 | 10c | 5c | 1c 3s | 1s | 0 |
| longsword thrust | 2.3 (was 2.0) | 2 | 6/0/0 | 8c | 4c | 1c 2s | 0 | 0 |
| longsword swing | 4.0 | 1 | 0/6/3 (was 0/6/1) | 8a 4s | 3s | 4s | 0 | 4c 4a |
| rapier swing | 3.8 | 1 | 0/2/1 | 3a 1s | 1s | 0 | 0 | 1c 1a |
| battle axe swing (new) | 4.6 | 1 | 0/7/4 | 9a 5s | 5s | 5s | 1s | 5c 4a |
| great axe, two hands | 8.0 | 2 | 0/14/8 (was 0/14/3) | 1c 18a 10s | 1c 9a 11s | 5c 18s | 6s | 10c 9a |
| club swing | 3.4 | 1 | 0/0/5 | 6s | 3s | 5s | 3s | 6c |
| warhammer head | 3.9 | 1 | 0/0/6 | 8s | 5s | 7s | 5s | 8c |
| staff, two hands | 6.9 | 2 | 0/0/10 | 2c 13s | 1c 10s | 2c 12s | 1c 10s | 13c |
| staff butt jab | 2.0 | 2 | 0/0/3 (was 0/0/6) | 4s | 1s | 3s | 1s | 4c |

The roles hold on paper: against plate only the hammers, maces and staff do anything; a point does nothing to bone;
the longsword's swing is worth about half a hammer's against bone and mail; the rapier and short spear give the
longsword's wound for 0.4–0.6 AP less. One exception: against **mail** the great axe (5c 18s for 8 AP) beats the
staff (2c 12s for 6.9) and the warhammer per AP, because mail turns a stopped cut into blunt and the axe now adds 8
of its own. Left as is; lower `edgeBlunt` or cap the two-handed case if that is wrong.

A blow's force (parry leverage, parry carry, wear) is the sum of its damage, so edged swings are now a little harder
to parry and wear a little more: a longsword's swing 7 → 9.

**In a crawl** (30 each, seed 4242; old → new): party of 3: temple_court 10 → 11, ember_hall 0 → 2, orc_valley 2 → 3,
temple_court2 (level 3, skeletons) 0 → 0; party of 4: 26 → 29, 1 → 6, 10 → 11, 1 → 0. Only the hall with four moves
by more than a few crawls (±9 points on a rate; cause not looked into). The heroes' swing is still at most 2% of
blows landed.

**Unarmed blows take stamina only** (the user, 2026-11-10: "unarmed attacks shouldn't do attribute damage at all
(even CON) without feats"; PROVISIONAL, `CONFIG.unarmed.attrFeat`). Before it, Beren without a shield kicked a
skeleton apart (a kick is 0/0/3 at 2.3 AP, and blunt goes straight to a tireless body's CON 4) and nobody swung.
Now a punch or kick without Heavy Hands does no CON harm and breaks nothing; a body with no stamina takes nothing
from it. Shieldless Beren against one skeleton, 20 fights: longsword won 19 (swings 20 of the blows landed, kicks 13
that did nothing), battle axe 18 (all swings), warhammer 19 (all head swings), rapier 9 (it swings, badly: the
thrust is useless on bone). So the roles show against bone once the kick is out of the way. The shield bash is
untouched (5 CON to a skeleton at 2.3 AP; it has its own feat) and is still what Beren does with a shield in hand:
that keeps the swing rare in the crawls, and it is the next thing to look at.

## The crawl baseline; the swing nobody uses (2026-11-09; `node sim/crawl.js`)

**Method.** `sim/crawl.js` walks start.yaml's heroes (level 1, as a new game gives them) into a place and fights its
groups nearest first on the dungeon map, joiners and all, resting between fights and never retreating, until the place
is clear or the party is beaten. 30 crawls a cell (so about ±9 points on a rate), seed 4242. `--set path=value` tries a
CONFIG number without editing it.

**Baseline** (places cleared of 30):

| Party | temple_court | ember_hall | orc_valley |
|---|---|---|---|
| 3 | 10 | 0 | 2 |
| 4 | 26 | 1 | 10 |

All three are level-1 places, and the target is that a level-1 party handles the first area of each dungeon. By
this measure only the court does, and only with four. But the crawl is harsher than play: the dead stay dead for the
rest of the crawl (in the game the fallen can be recruited again in the village), and nobody goes back to town. What
it shows is attrition. In the hall a party of three wins each of its first four fights 85–97% of the time, almost all
against a single foe, and loses a hero in about one fight in three doing it: one dead after four fights, and then it
cannot win. In the valley the first two pairs fall (93%, 100%) and the third fight is 6.7 foes with joiners (29%).
So: single foes in the hall kill too often for what they are, and the valley's third group pulls its neighbours.
One hero more takes the court from a third to nearly always: numbers decide more than anything else measured here.

**What kills.** Of killing blows in the court (party of 3): Thrust 56%, Shoot 18%, a beak's swing 17%, its two-handed
swing 9%. In the hall and valley: Thrust 72–83%, Shoot the rest. Blows land on the head 41–58% of the time. Two
cautions on reading that: the log's "Thrust" is every thrust (Beren's longsword, Cyrus's rapier, goblin and orc
spears, and the butt of Jabiku's staff, whose swing costs 27.6 AP at STR 3), and only one hero of four, Beren, carries
an edge at all. So the share of thrusts says more about who is in the fights than about the rules.

**The finding that does hold:** Beren never swings. Not once in any run. Per AP against bare skin
(STR 6 against CON 6, the AI's own value for a hit):

| Longsword | AP | Damage | Bare | Padded | Mail |
|---|---|---|---|---|---|
| Thrust | 2 | 6 P | 8 CON (a kill), value 75/AP | 3.5 CON, 20 | 0.8, 4 |
| Swing | 4 | 6 S + 1 B | 8 attribute points, 18 | nothing, 1 | nothing, 0 |

A thrust goes to CON whole and rolls for a vital spot; a cut spreads over the location's attributes (about a third
to CON) and any armor stops it. So the swing is worse bare and useless armored: it has no setting.

**Tried, and not adopted** (party of 4, cleared of 30 unless noted):

| Variant | court | hall | valley | Beren swings? |
|---|---|---|---|---|
| baseline | 26 | 1 | 10 | never |
| A: `apCurve.knee` 3 (a swing back at 3 AP) | 25 | 1 | 10 | never |
| B: `weaponPhysics.pointDamage` 0.18 | 27 | 3 | 5 | never |
| C: A and B | 23 | 5 | 6 | never |
| D: C and `edgeDamage.k` 6 (cuts ×1.6), of 20 | 13 | - | 4 | never |
| E: A and `edgeDamage.k` 5, of 20 | 17 | - | 6 | never |

None is distinguishable from the baseline on clears except that weaker points cost the party the valley (its own
killers are thrusters and an archer), and none makes the swing worth choosing: at k 6 a longsword swing is still
38/AP against 64. Numbers alone will not do it short of making cuts absurd. **No rule was changed.** What would
change it is structural, and a ruling: (1) a thrust to a limb wounds the limb's attributes as a cut does, and only
head and torso take it to CON (most realistic; but 70% of blows land there already, so a small effect); (2) the
swing's own setting: several unarmored foes (a sweep through two squares), where the thrust takes one; (3) accept it:
the point is what kills a man, the edge is for the unarmored and the fleeing, and a sword is carried for its thrust.
I lean to (2) with (3): it is differentiation, not parity, and it leaves armor king.

## Monster tiers, bosses and their leg-ups (2026-11-09; `node tools/tiers.js`)

The user (2026-11-09): heroes start at level 1; encounters fall in tiers, a rough continuous scale against heroes of the
same level; a party is three for tuning; one boss a place, each with a leg-up somewhere; a level-1 party handles the
first area of each dungeon, the orc valley falls to level 3, the Avatar of Fear to level 5, the dragon to level 8+.

**Method.** `tools/tiers.js` fights a monster against start.yaml's heroes grown along their plans to its level (a gear
ladder for loot: steel weapons from 3, steel armor and shield from 5, master star iron from 7), AI on both sides, and
finds M, the heroes at which it is an even fight (one hero against 1/M of them below one). Targets: 1 very weak ≈0.35,
2 weak ≈0.6, 3 moderate 1, 4 tough 2, 5 boss ≈3.5, 6 epic 6+. 16–24 fights a point, so ±10 points on a rate; I took
anything within ×1.5 of its target as on it. `--enc place/id` fights an encounter as authored.

**What moved M.** Level barely does (a scaleward is M 1.05 against level-1 heroes and the same against level-3 ones):
equipment and stats do. CON alone hardly moves a humanoid: hit locations end fights in one or two blows (the kobold
king, CON 20 and twice the AP, died to one thrust to his bare head). A helm and a full coat did more than +10 CON.
Bosses got `apMult` (1.5–3.5: they act like several fighters), the lever the Avatar already used. Casters (Venril, the
dread shaman) stay near M 2 alone however much CON or AP they get, because three heroes focus them: they are bosses
with their guard, which is how the encounter check measures them.

**Bosses, as authored** (win rate; dead heroes a fight in brackets):

| Boss (place level) | 2 heroes | 3 heroes | 3 with its oil |
|---|---|---|---|
| Dread shaman + varanus (pyramid court, 3) | 5% (1.6) | 80% (0.6) | 85% |
| Venril + skeleton (palace, 4) | 0% (1.1) | 10% (1.4) | 30% |
| Avatar of Fear (ritual chamber, 5) | 20% (0.8) | 45% (1.1) | 80% |
| Orc emperor (castle, 3) | 20% (1.6) | 35% (2.5) | 50% |
| Red drake (warrens, 2) | 5% (1.6) | 30% (1.9) | 40% |
| Goblin king (castle, 3) | 25% (0.0) | 70% (0.0) | 45% (noise?) |
| Kobold king + spearman (dens, 4) | 20% (1.0) | 45% (1.4) | 70% |
| Efreet lord (pit, 6) | 15% (1.6) | 70% (1.4) | 80% |
| Giant king (citadel, 7) | 0% (1.1) | 15% (1.0) | 20% |
| Dragon (lair, 8) | — | 0% (2.4); 6 heroes 40% (3.5) | 10% |

The dragon is epic as asked: six heroes of level 8 win 40%. Every giant measured M 2.5–4.9 at level 7 (all boss-tier);
the citadel's encounters were cut to one or two giants each.

**The golems don't fit yet.** One body, each immune to two of slash, blunt and fire (a tested design): clay 0% for
three heroes even with the oil, iron 5%, stone 95%. Traced: the clay golem's blows to the arms disarm the heroes (25
drops in 5 fights) and the AI then kicks a body immune to blunt; a cut on a tireless body goes to STR/DEX/SPD by
location, so little reaches CON. The bane oils add to the blade's own damage type, so they do nothing to a golem
immune to it: the sewer's leg-up is a masterwork warhammer in a chest, the palace's a Fire primer. Fixing the golems
needs a rules decision (see HANDOFF).

**First areas, three level-1 heroes:** temple court 90–100% (0.1 dead a fight), Cinder Hall 95–100% (0.3–0.6), orc
valley 90–95% (0.9, after the legionnaire came down to a short spear). Fights are lethal by design; the after-fight
Medicine check (now hard, 11) and the village's respawn are what keep a party going.

**AP rolled each round** (1 + d3 + SPD/2, turns in order of AP rolled) was in place for every number above.


## Block, parry and dodge differ in kind (2026-11-03; `node sim/arena.js --n 20`, before and after)

The user (2026-11-03): rebalance the greatsword against sword & shield by making the three defences differ, not by
changing opportunity strikes again. Built (CONFIG.defense `rebound`, `leverage`, `dodgeArmor`, `dodgeMeleeOnly`,
`riposteOpen`; feat Beat): a block rebounds a third of the blow's AP off the attacker, a parry a sixth (Beat: +a sixth
per rank); AP the attacker hasn't got come off their next round, and a fighter who owes can't take a whole-turn action;
a parry's odds come from leverage (0 between equal weapons, toward +3 as the parrying weapon outweighs the blow, toward
−3 as it is outweighed; replaces the force term) and a successful parry opens a riposte anyone can take for its AP (the
Riposte feat: for none), which the attacker may defend; a dodge meets melee blows only and pays the armor's SPD and DEX
penalties again (the flat −2 dropped). Untrained odds against a sword swing: block 72% (round shield), parry 64%
(unchanged), dodge 55% unarmored, 45% leather, 36% mail, 10% plate (was 36% in all but plate).

Row's win rate, averaged over armor pairs, before → after (±4 points or so on a difference):

| row vs | Two-handed | Sword & shield | Rapier & dagger | Archery | Magic |
|---|---|---|---|---|---|
| Two-handed, open | 50 → 49 | **69 → 68** | 79 → 80 | 82 → 81 | 49 → 39 |
| Two-handed, close | 50 → 50 | **68 → 67** | 80 → 80 | 58 → 50 | 47 → 42 |
| Sword & shield, open | 30 → 31 | 48 → 48 | 39 → 47 | 71 → 72 | 44 → 41 |
| Sword & shield, close | 31 → 32 | 49 → 48 | **30 → 51** | 83 → 80 | 19 → 13 |
| Rapier & dagger, close | 19 → 19 | **64 → 46** | 49 → 50 | 57 → 49 | 11 → 13 |
| Archery, open | 45 → 53 | 22 → 22 | 50 → 57 | 50 → 48 | 9 → 11 |
| Magic, close | 47 → 49 | **70 → 80** | 87 → 86 | 64 → 47 | 48 → 47 |

- **It did not move two-handed against sword & shield, and it can't.** Traced (`sim/arena-inspect.js
  medium/twoHanded medium/shield open 2–8`): the greatsword never swings in these duels; it holds the swordsman at its
  thrust (reach 3) and stop-thrusts as he steps inside. And the swordsman's AI spends its whole pool (6 AP) on one move
  toward it, so it comes into reach with 0 AP and can't block the thrust; in mail a thrust that bursts through and the
  bleeding that follows end most of these fights in round 2. A rebound off a 2-AP thrust is 0.7 AP. The lever is the
  AI's approach (stop at the edge of a longer reach with AP kept to block), not the defences. Not built.
- Sword & shield now beats rapier & dagger in close quarters (the riposte can be blocked, and every block costs the
  duelist AP); the duelist's average fell 2–3 points.
- No dodging missiles: archers gain against everyone who dodged (two-handed, the duelist), and magic gains against
  sword & shield in close quarters (bolts can't be blocked by an ordinary shield or dodged now). Magic's mirror fell.
- Grappler and enchanter unchanged. Encounter win rates not run (deferred).

## Opportunity strikes inside the edge (2026-11-03; `node sim/arena.js --n 20`, before and after)

The user (2026-11-02): a fast fighter who won initiative and closed on an equal weapon was struck first as they came
into reach. Now coming up to the edge of a foe's reach is free; stepping from within it to closer still, leaving it,
or a second step within it that brings you no closer provokes (docs/PROPOSALS.md §1, E). Level 5, every armor ×
strategy, 320 fights a cell (about ±4 points on a difference). Row's win rate, after − before:

| row vs | Two-handed | Sword & shield | Grappler | Rapier & dagger | row average |
|---|---|---|---|---|---|
| Two-handed, open | +1 | **+26** (43 → 69) | +18 | **+28** (51 → 79) | 56 → 67 |
| Two-handed, close quarters | +3 | **+37** (31 → 68) | +29 | **+31** (49 → 80) | 53 → 69 |
| Sword & shield, open | | 0 | +12 | −8 | 61 → 59 |
| Grappler, open | | | +2 | −5 | 35 → 30 |

- Mirror matches (two-handed against two-handed, sword & shield against itself) moved within noise, as they should:
  at equal reach both sides meet at the edge.
- **Reach now beats the shorter weapons by a lot.** Before, the swordsman paid one blow coming into a greatsword's
  thrust (3), then closed to 2 and to 1 (where the greatsword is cramped) for free. Now each step nearer is a blow, move
  after move. This removes the trick the duels showed (step inside and fight with dagger and shield) and swings past it:
  two-handed is now the strongest melee style in duels.
- Magic, archery and the enchanter barely moved. Encounter win rates not run (deferred).
- Lever if it is too much: let only the step past the edge provoke (the stop-thrust at measure); once inside the
  point, closing further is free. Not built or tested.

## Jabiku's Life words (2026-11-01, the user)

Jabiku now starts with Life and Increase, Decrease, Transfer, and the modifiers Launch and Burst, which go on a spell
together (12 spells; was Fire with Strike, Launch, Burst, Build: the party has no wall of fire to get away behind).
20 fights against a scaleward, 12 x 6 room: Jabiku wins 12, 5.1 rounds. Against one foe at range the AI casts only
Decrease + Life + Launch (3 CON a hit, no armor), then fights with the staff when the spell points run low.
Transfer is valued as its blow plus what comes back (a blow's worth if the caster has lost CON); hurt and beside a foe
the AI drains (`tests/life-words.test.js`). Increase and Burst need allies and crowds: not yet seen in a party fight.

## Draws and wind-ups (2026-11-01, the user)

The user: a draw and a shot are two actions, both in one turn if the AP is there (Lorc drew and could not loose with
4 AP left: not rounding, the rule held every wind-up to the next round); wind-ups may also be made ahead and carried
over; every bow is drawn, a stronger one dearer for more range and damage.

- `windUp.sameTurn` (PROVISIONAL): a wind-up (a draw, a power swing's, a Strong spell's) may be released the same
  turn; one not released is lost at the end of the next round, as before. Released and wound up again, it may be
  released again the same round: AP is the only limit.
- Bows draw by their own `draw` (weapons.yaml): shortbow 1 AP + loose 2 (was 4 in one action), longbow 2 + 4. The
  shortbow now looses twice in a 7-AP turn (6 AP); the longbow once, for 7 P to 16 squares and a bodkin that bursts mail.
- The AI may draw after a first action if the loose fits the same turn (a goblin archer that stepped back to range).
- 20 fights, 12 x 6 room: Lorc vs a scaleward loosed 49 shots (29 before), 43 drawn and loosed in one go; still 1
  win in 20 (the room is too small for an archer). The goblin archer vs Beren: 1 shot in 20 before and after (Beren
  reaches it in its first round).

## The AI: no reading, paths round water and foes (2026-11-01, the user's third set)

The user: the AI should stop reading intent; in the sewer two skinks stared across a canal at an archer on a bridge,
being shot, with an open way round. A skink against Lorc alone on the sewer map, from every square within 9 of five
bridge and plank squares (443 starts, 8 turns each; scratch harness, case tests in `tests/ai-paths.test.js`):

| | stuck | why |
|---|---|---|
| before | 50 | every one a move the rules refused, "A foe is in the way": the route went over the bridge, through the archer |
| foes gone round, distance as the crow flies | 42 | all on the cistern bank at (33, 14), as near the planks round the drain as a straight line gets |
| foes gone round, distance as walked | 0 | the mean approach is 2.2 turns (1.9 before, of those that got there at all) |

- Paths (rules and AI, and the battle screen's route and reach) now go round foes' squares; allies are still passed.
- Closing to blade's reach the AI scores a square by the walk from it to the foe (`walkField`); a goal beyond 2
  squares keeps the straight line, since a shot crosses water.
- The AI no longer reads intent (the player still can). Duels, `--n 20`: median 2 rounds, mean 2.7 (2.8 before),
  scaleward pairings 4-5: no change worth the name; what read did was fill turns, not lengthen fights.

## Duels: movement, vigor, reading (2026-11-01; `node sim/duels.js --n 40`)

The user: Cyrus crosses a courtyard in one round; duels are slow and spongy; perhaps damage should follow stamina.
`sim/duels.js` pits the presets against each other and common foes one on one (12 x 6 room, AI both sides).

- **Movement** was 4 / 12 / 12 / 24 squares for a round spent only moving (Beren in plate, Jabiku, Lorc, Cyrus). A stretch
  now covers 1 + SPD/4 squares (unrounded; ×2 before): 3 / 6 / 8 / 13. `disengage.outrun` 2 → 4 rounds, so the gap
  to open before getting away is as many squares as it was.
- **Duels are short in rounds** (median 2; against the scaleward 4-6). What fills them is not blows: in a hero vs
  scaleward fight there were ~7 weapon blows to ~6 reads of intent and ~2 failed shoves. A read lasted one round,
  so the AI read every round. Now 3 rounds (`social.readIntent.rounds`).
- **Vigor** (damage × 1.25 at full fresh stamina down to × 0.75 at none) hardly moves duel length: armor takes most
  of a blow, so a harder blow mostly feeds the armor (Beren's share of a scaleward's stamina per landed blow 0.17 →
  0.18). At 1.5 / 0.5 spent fighters stall (timeouts 2%). Kept at 1.25 / 0.75 for what it does to choices: a fresh
  fighter hits a quarter harder.
- **Smaller stamina pools** (CON ×3 or ×2.5 in the pool, was ×4) did not shorten duels either and were not taken.

| | median, 90th rounds before | after |
|---|---|---|
| Beren vs scaleward | 6, 9 | 5, 6 |
| Cyrus vs scaleward | 4, 7 | 4, 5 |
| Jabiku vs scaleward | 6, 8 | 5, 12 |
| all ten pairings | 2, 6 (mean 2.9) | 2, 5 (mean 2.8) |

## Weariness by effort (2026-11-01; `node sim/effort.js`)

The user: a fight won in one blow wore the whole party as much as a hard one (1 stamina off the maximum a round, for
everyone standing). Now each point of stamina spent or lost in a round takes `weariness.perStamina` off the maximum.
Stamina spent per fight by the presets, every authored encounter × 4, AI on both sides:

| | fresh | rounds | spent, mean | spent ÷ fresh, 10th / 50th / 90th centile |
|---|---|---|---|---|
| Beren | 45 | 3.2 | 8.3 | 0.00 / 0.07 / 0.73 |
| Lorc | 42 | 3.2 | 10.5 | 0.10 / 0.19 / 0.70 |
| Cyrus | 41 | 3.2 | ~12 | 0.07 / 0.34 / 1.14 |
| Jabiku | 33 | 3.2 | 8.4 | 0.00 / 0.18 / 1.31 |

The flat rate cost 3.2 points a fight on average. At 0.25 a point, the mean fight costs 2-3, a fight a member sat out
nothing, a hard one (30-50 spent) 8-12. Spell points already wore by points spent (0.15 each).

## Cover with a shield (2026-10-29; the user's choice against groups snowballing, docs/REVIEW.md Risk 1)

`CONFIG.defense.cover` (PROVISIONAL): a blow at someone who puts up no defence of their own may be blocked for them
by an ally within a square with a ready shield, paid from the bearer's AP and stamina, at −1 to the block. The
alternative (a cheaper second defence against the same attacker) was turned down: it answers a quick striker's
flurry, not several attackers, so it would move value from fast weapons to slow ones without touching the problem.

Probe (not encounter tuning): the preset level-3 party, AI on both sides, in the temple court against two or three
Suracayl warriors, 100 fights each, same seeds with cover off and on.

| Foes | Cover | Won | Party deaths per fight | Covers per fight (succeeded) | Rounds |
|---|---|---|---|---|---|
| 2 | off | 79% | 0.42 | – | 7.4 |
| 2 | on | 78% | 0.31 | 0.44 (68%) | 7.5 |
| 3 | off | 40% | 0.74 | – | 9.1 |
| 3 | on | 40% | 0.67 | 0.48 (60%) | 9.1 |

Deaths fall (Cyrus 22 → 15 against two), wins don't move. The effect is small because only Beren carries a shield and
the AI doesn't yet keep him beside the others; with n = 100 the drop against three (0.74 → 0.67) is within noise.
Next, if cover is to matter: an AI that stands a shield beside the ally most at risk.

## The temple court: ground, drops, fights that draw in their neighbours (2026-10-24; `node tools/encounters.js --n 300`)

New engine pieces for the temple (plan: `assets/ideas/temple-dungeon.md`): ground letters (grass, rubble, deep and
shallow water, bridges, pyramid steps), one-way drops, tilesets per place, and fights that draw in other awake groups
within `game.joinDistance` (6, PROVISIONAL) of the party or the group fought. Existing encounters are unchanged (same
numbers as the section below: crew 91/9/4.8/1.19, horde 28/70/11.4/1.74, troll 96/4/4.7/0.24); `tools/encounters.js`
starts fights off the map, so joining never applies there.

The court's posts one at a time, level-1 party (won / lost / rounds / dead per fight): gate, labyrinth door and
guardhouse (one scaleward each) 100/0/3.9/0.15; court and palace door (a pair each) 97/3/7.6/0.28. Fought together
(a one-off script, 200 fights): gate and court (three scaleward) 73/26/11.2/0.53; all four posts at once (six)
0/100/9.3/1.41. So drawing groups together is the court's danger, as intended: two posts at once is a hard fight, the
whole court at once is a wipe. Not tested: how often play actually pulls two posts together at joinDistance 6 with the
posts about 10 squares apart; that needs the courtyard walked, not simulated.

## Aimed blows and wounds by location, steps 2–3 (2026-10-24; against the parry commit 9d9da65)

Every blow now rolls where it lands (or is aimed); cuts take attributes by location; vital odds, disarm, trip and stun
follow the location; the AI aims by expected value. Encounters, level-1 party, 300 fights each (won / lost / rounds /
dead per fight): rat nest, guards, store guards, squad, knight and wolves unchanged; crew 91/8/5.2/1.35 →
91/9/4.8/1.19; horde 34/65/11.2/1.61 → 28/70/11.4/1.74 (about two standard errors); troll 92/7/4.8/0.39 →
96/4/4.7/0.24.

Duels (level 5, 320 fights a cell, about ±3 points): most cells within noise. Beyond it:

| row vs column | before | after |
|---|---|---|
| magic vs two-handed | 44% | 51% |
| sword & shield vs grappler | 78% | 68% |
| grappler vs sword & shield | 17% | 23% |
| rapier & dagger vs two-handed | 42% | 47% |

Not yet explained; plausible causes are disarms (a grappler doesn't care, a sword-and-shield fighter does) and head
wounds draining INT and WIL (which should hurt casters, though magic came out ahead). Per blow (`sim/locations.js`):
a longsword cut to a bare body now takes 4.8 CON instead of 3.2 (the location tables send about 41% of a cut's points
to CON, the old d4 25%), and a thrust into full mail can now be vital (0% → 4%: the vital roll's odds are whole
tenths, and the head's ×2 lifts mail's guard over the first step).

## Parry carry-through (2026-10-24; `node sim/arena.js --n 20`, `node tools/encounters.js --n 300`)

A parried swing whose force beats the parrying weapon's carries through, weakened; the overwhelm term left the parry
odds (`CONFIG.defense.parryForce.over` 2 → none). Encounters, level-1 party: all within noise (crew 90 → 91% wins,
troll 95 → 92%, the rest the same). Duels (level 5, 320 fights a cell, about ±3 points): every cell within noise but

| two-handed vs | before | after |
|---|---|---|
| rapier & dagger (open field) | 61% | 54% |
| magic (open field) | 53% | 47% |

The rapier parries a greatsword far more often now that force no longer piles onto the odds, and even with half or
more of each cut beating through, it keeps off more than before. That runs against the idea's intent (a light blade
shouldn't meet a heavy cut well). If it should go the other way, put a weaker overwhelm term back (`parryForce.over`
4, say): a heavy blow is then both harder to meet and partly carries through. Not changed.

## Armor by hit location, step 1 (2026-10-24; `node sim/locations.js --n 3000`, `node tools/encounters.js --n 300`)

Pieces cover locations (rules.yaml `locations`); a blow against mixed armor rolls where it lands; a cut through a bare
or soft-armored limb carries what is beyond 3 into the next location. What one landed blow does (STR 12, no defence,
fresh armor; CON and other attribute points per blow; vital %; how often a cut carried on):

| harness | longsword thrust | longsword cut | greatsword cut | carried (greatsword) |
|---|---|---|---|---|
| bare | 10.0 CON, 22% | 3.2 CON + 6.7 | 5.6 CON + 12.0 | — |
| full mail | 3.0, 0% | 0 | 0 | — |
| full plate | 0, 0% | 0 | 0 | — |
| half plate (torso, arms, legs) | 1.7, 3% | 0.2 + 0.4 | 0.2 + 0.4 | 17% |
| breastplate only | 5.9, 12% | 1.5 + 3.2 | 2.7 + 5.6 | 60% |
| breastplate, helm, mail limbs | 2.4, 2% | 0.1 + 0.2 | 0.1 + 0.2 | 10% |
| mail shirt (torso, arms) | 5.8, 8% | 1.0 + 2.3 | 1.8 + 3.9 | 43% |
| gambeson (torso, arms) | 6.2, 15% | 1.1 + 2.3 | 2.9 + 7.0 | 62% |

- The ordering is the design's: the more of the body covered, the less gets through, and a bare 18% (head, hands,
  feet of a half harness) still lets a point through often enough to matter. A gambeson stops a longsword cut about as
  well as a mail shirt, but not a greatsword's (it cuts through and carries on).
- Maces and hammers are unchanged in kind: they go to stamina whatever is worn (blunt has no carry-through).
- Encounters, level-1 party, before → after: identical except the crew (90/9/5.3/1.34 → 90/10/4.9/1.42, within noise).
  The party wears full harnesses and the monsters hides, so no location is rolled for them; only the human foes with
  half or partial armor (crew, guards) now have bare spots.

## Opportunity strikes on entering, leaving, or a second step within reach (2026-10-24; `node tools/encounters.js --n 300`)

The user's ruling (docs/PROPOSALS.md §1): a foe strikes at a mover who enters its reach, leaves it, or takes a second
step within it; one step within is free. The first version stalled: AI bandits stood at the edge of a passive party's
reach for good. The AI's fear of the stop-thrust now halves each round in which nobody struck (`ai.js wariness`).
Level-1 party, 300 fights each, old rule → new (won / lost / rounds / dead per fight):

| encounter | old | new |
|---|---|---|
| rat nest | 100 / 0 / 2.1 / 0.10 | 100 / 0 / 2.6 / 0.02 |
| guards (one) | 100 / 0 / 2.8 / 0.21 | 100 / 0 / 3.2 / 0.17 |
| crew | 88 / 12 / 4.3 / 1.61 | 90 / 9 / 5.3 / 1.34 |
| store guards | 100 / 0 / 2.3 / 0.11 | 100 / 0 / 2.4 / 0.04 |
| squad | 1 / 99 / 3.2 / 3.92 | 0 / 100 / 4.2 / 3.88 |
| horde | 19 / 79 / 10.0 / 2.17 | **34 / 65 / 11.2 / 1.61** |
| knight | 0 / 100 / 5.0 / 3.84 | 0 / 100 / 4.7 / 3.95 |
| wolves | 99 / 1 / 3.5 / 0.41 | 99 / 1 / 3.9 / 0.61 |
| troll | 92 / 7 / 4.5 / 0.25 | 95 / 5 / 4.3 / 0.38 |

- The horde is the one change beyond noise (about five standard errors): probably the skeletons now pay a blow each
  time they walk into the party's line, where before the approach was free. Not checked against fight logs.
- Fights run up to a round longer; none reached the 40-round cap, so the stand-off breaker works.
- The squad and the knight are untouched: outnumbering (docs/REVIEW.md §3, risk 1) is still the problem there.

**Duels** (`node sim/arena.js --n 20`, level 5, every armor × strategy; 320 fights a cell, so about ±3 points). Most
cells moved within noise. The two-handed style lost its edge over the shorter weapons (row's win rate, old → new):

| two-handed vs | open field | close quarters |
|---|---|---|
| sword & shield | 63% → 51% | 68% → 42% |
| rapier & dagger | 74% → 61% | 78% → 55% |
| magic | 66% → 53% | 67% → 54% |
| grappler | 78% → 67% | 84% → 62% |

Probably because entering an equal reach now provokes: the AI's two-hander goes in, and the sword-and-shield fighter's
thrust meets it on the way. Under the old rule only a longer reach got that blow. This is the rule doing what it says
(the side that waits gets the first blow); whether two-handers should then wait more is an AI question.

## Magic items, new spells, Raise, companions; engine fixes (2026-10-24; `node tools/encounters.js --n 300`)

Changes that touch every fight: shoves, throws and knockback stop at walls and drop bodies into pits on the way; an
ordinary shield no longer blocks a spell bolt (`CONFIG.defense.blockSpells: false`); frost chills instead of slowing;
darkness hurts; the AI flees what frightens it and can't see an unseen foe beyond arm's reach. The level-1 party, 300
fights each, before → after (won / lost / rounds / dead per fight):

| encounter | before | after |
|---|---|---|
| rat nest | 100 / 0 / 2.1 / 0.12 | 100 / 0 / 2.1 / 0.10 |
| guards | 100 / 0 / 2.9 / 0.29 | 100 / 0 / 2.8 / 0.21 |
| crew | 89 / 10 / 4.4 / 1.46 | 88 / 12 / 4.3 / 1.61 |
| store guards | 100 / 0 / 2.2 / 0.14 | 100 / 0 / 2.3 / 0.11 |
| skeleton squad | 0 / 100 / 3.3 / 3.94 | 1 / 99 / 3.2 / 3.92 |
| horde | 19 / 80 / 9.8 / 2.14 | 19 / 79 / 10.0 / 2.17 |
| revenant knight | 0 / 100 / 4.8 / 3.94 | 0 / 100 / 5.0 / 3.84 |
| wolves | 100 / 0 / 3.4 / 0.42 | 99 / 1 / 3.5 / 0.41 |
| troll | 92 / 7 / 4.5 / 0.25 | 92 / 7 / 4.5 / 0.25 |

All within noise (a win rate's standard error at n = 300 is about 2 points). The preset party carries none of the new
items and casts none of the new spells, so this shows the shared changes did no harm; it says nothing about the items'
or spells' own balance. Not yet simmed: the silk sash (×0.8 AP) and a blade of speed in duels; Raise + Spirit in the
gauntlet; companions over a multi-fight run. The full review is in `docs/REVIEW.md`.

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

## Getting away and the wall of fire (2026-10-29)

The user dropped the flee roll: getting away should cost movement and need a wall, a trap or a hold between you and
what chases you. `Battle.disengaged` (CONFIG.disengage, PROVISIONAL) asks at each round's end: can any foe still
standing reach striking distance of the party (path cost within 2 rounds of its running) or shoot or cast at them over a
clear line? The wall of fire (Build + Fire) became a true wall (can't be walked through, not solid: it can be seen and
shot across) that burns anyone within a square of it for Fire 2 at the end of each round.

Dry run in the labyrinth (seed 11, scratch script, not a sim): the party in the clay golem's east exit (2 squares
wide), the golem in its room. Before the wall: not away ("Clay golem can reach you"). Jabiku casts Build + Fire across
the exit (4 AP, 4 SP, 4 stamina of backlash): the golem walks up to the wall and stops; at the round's end the party is
away. The other exit loops back only outside the fight's window, which the check counts as out of reach. No numbers
were tuned against this; `tests/escape.test.js` holds the rule.

Spell points (the user): a rest after a fight brings them back, with half of each spent point off the maximum until a
long rest (CONFIG.magic.spWeary). Jabiku (14 SP) spending everything each fight has 14, 7, 3, 2, 1 in successive fights:
about two hard-casting fights a day, then a trickle. Not simulated.

## Weapon wear and spell points over a day (2026-10-30)

The user: wear should be real but not a tedium; a rapier should not break against the first lizards in less than a
cleared area; a party should need a long rest after an area of about 6 fights ("battles short, days long").

Scratch scripts (AI both sides, the default party, seeds 11 and 5, 30-40 fights a row). Durability lost per fight, as
a share of the weapon's life, against two Suracayl warriors (chitin scales: P resist 1.4, gap 9, so a rapier point
(punch 1.2) must find a gap or be turned) and against the same warriors in iron mail:

| wear rates (hit / turned / parried / parry / blocked), rapier fragility | rapier, scales | rapier, mail | longsword |
|---|---|---|---|
| 0.4 / 1.0 / 0.15 / 0.25 / 0.25, 2 (before) | 57% (censored: it breaks) | 76% | 3-4% |
| all × 0.25 | 17% | 25% | under 0.5% |
| × 0.5, turned 0.3, 2 | 21% | 34% | 1.1% |
| × 0.5, turned 0.3, 1.25 (chosen) | 14% | 22% | 1.3% |

Of the rapier's wear against scales before, turned points were 16 of ~27 points a fight, parried thrusts 7, landed
blows 4. A rapier was counted thin twice (durability 40 against a longsword's 100, and fragility 2), so scaling all
rates down far enough to save it left a longsword with no wear at all; its fragility came down instead. Wear per knock
was rounded to whole points (small knocks on a sturdy blade vanished, on a fragile one rounded up); the fraction now
carries on the weapon (`wearCarry`).

Fights against the court back to back, resting and repairing after each (the after-fight rest gives 25% back), means
over the parties still standing:

| fight | rapier life, before | rapier life, now | Jabiku's SP maximum, before (spWeary 0.5) | now (0.15) |
|---|---|---|---|---|
| 1 | 100% | 100% | 100% | 100% |
| 2 | 63% | 100% | 57% | 86% |
| 3 | 39% | 99% | 32% | 71% |
| 4 | 20% | 100% | 21% | 64% |
| 5 | broken | 100% | 21% | 56% |
| 6 | | 100% | | 46% |

Pressing on without rests the rapier now loses about 11% a fight against scales. With a rest after each fight wear no
longer accumulates at all against these foes: the after-fight repair (`restRepairFraction` 0.25) now outweighs it. Only
mail, pressing on, or a hard fight wears a weapon down over a day. Encounter win rates were not looked at (deferred).

Then (the user): breakage should be "a danger, not an annoyance"; the Suracayl scales were stronger than iron mail
(P2 S3 B2, burst 1.4, gap 9 against iron mail's P1 S4 B1, 1.3, 10) and should be bronze mail; organic armor may stop
a blow as well without wearing a blade the same way. The scales now have bronze mail's numbers (P1 S3 B1, burst 1.1:
a rapier's point gets through); materials.yaml marks grown materials `organic` (cloth, leather, hide, wood, bone,
chitin, silk, dragon hide) and a blade takes `weaponWear.organic` (0.5) of its wear against them (armor it strikes,
or a wooden or bone weapon that parries it). Same scratch script, 40 fights:

| | rapier, scales | rapier, iron mail | longsword, scales | longsword, mail |
|---|---|---|---|---|
| new scales, no organic tag | 13.6% | 22% | 0.7% | 1.6% |
| new scales, organic 0.5 | 8.0% | 22% | 0.3% | 1.5% |

Pressing on against the court without rests, the rapier stands at 92, 84, 82, 78% before fights 2-5. What wears a
blade now is metal: mail, a steel weapon that parries it, a shield. The bronze-mail scales make the court easier
(18 of 20 parties won a second fight in a row without rests, against 10 before); not looked at further (deferred).

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
