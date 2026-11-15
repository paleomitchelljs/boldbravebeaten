# Step A report: one contest per blow, four locations

Branch `overhaul/A-blow`, from `bd310877`. Measured 2026-11-15, seed 4242, full n for every command (crawls 30,
duels 40, spiral 40, swarm 8). "Before" is the untouched branch run the same day, which differs from the
2026-11-11 baseline table in `sim/FINDINGS.md`: the code had moved on since then. Compare before with after
below, not with the old table.

## What changed

**The contest** (`src/rules/combat.js`). One opposed roll decides a blow: the attacker's d10 + strike bonus against
the defender's d10 + defence bonus, both from `defenseNumbers`. Its margin (the attacker's total less the
defender's; ties go to the defender) is kept. `defenseCheck` returns it, and `resolveAction` passes it to
`applyHit`, including through a failed cover block, a parry that is beaten through, and a block's push-through.
A blow nobody defends always lands. `applyHit` rolls one d10 for it against a fixed passive number:
`defenseNumbers(…, 'none', …)` returns the passive number in place of a defence roll. A blow now rolls the contest
(two d10s, or one if undefended), a d100 for location if it is not aimed, and then only step E's material: the
per-point attribute tables and the disarm, trip and stun percentages.

- **Penetration by margin.** `pierceNeed` gives the margin at or above which a point gets through:
  ⌈(1 − punch/resist)/perMargin⌉ − bonuses. Through, the piercing past P mitigation goes in whole. Below it, the
  armor turns the point (`deflectBlunt`, unchanged). Bonuses in margin points: Find the Gap 2, Spot Weakness 1,
  prone 3, half-sword 3. A pinned or helpless body is always through.
- **Vital by margin.** `vitalThreshold` = place threshold + armor there − round(10 × wound.vital) +
  round(4 × (size − 1)). A point or cut that reaches the body with margin ≥ threshold is vital. The effects are
  unchanged: ×3 CON for a point, the damage again for a cut.
- **Aim.** An aimed blow lands where it is aimed. Its cost now comes off the margin as well as the defence. A blow
  nobody defends pays the unguarded `penalty` table.
- **Unaimed shift.** A margin ≥ `contest.shift` moves the blow to the worst-guarded of {its place, the places
  beside it}. The log says "into a gap".
- **Carry-through** is deterministic: the cut carries into the worst-guarded place beside it, so there is no d2.
- **The log line** reads `by 4: through the mail at the arms`, `by 1: the plate at the torso turns the point`, or
  `by 6, into a gap: on the legs (bare)`.

**Four locations.** These are head 8%, torso 40%, arms 23% and legs 29%. Hands fold into arms and feet into legs
everywhere:
- shares, wound tables, effects (arms disarm 0.1, legs trip 0.08), aim tables, `carry`, `coverage` keywords
- the `pieces` names in `armor.yaml`, and the icon cells in `icons.yaml` (gloves for arms, boots for legs)
- the shop stock and the two hand and foot items in `items.yaml`, which now cover arms and legs
- the battle screen's aim picker and the "can still cover" line (both driven by `locations.order`)
- the sheets and `DATA.md`

Old saves: `save.js` VERSION 7 folds `covers` on worn, carried and pack pieces. `Character.normalize` then drops
any place not in `locations.order` and moves a piece that overlaps an earlier one into `inventory.items` (tested in
`tests/save.test.js`). `game.wornSlots` is untouched.

**The AI** (`src/rules/ai.js`). `hitValue` reads `computeHit`'s expectation over margins and places: `vitalCON`
and `killP`, plus `killChance` for spells' one-outcome hits. `sweepWorth` uses the same. The aim-hold factor is
gone.

**The panel** (`Combat.foresee`). `hit.margins` (undefended) and `defences[].margins` (conditional on beating that
defence) replace the gap, pass-through, vital and on-target dice. `through` and `turned` are the chances for a
point. A parry beaten through and a shield push-through use the margins on which the defence held.
`tests/odds.test.js` checks all of it against 3000 seeded resolutions, including a new plate scenario for
turned-versus-through.

**Deleted:**
- config keys: `piercePassThrough`, `pierceMode`, `passThroughByArmor`, `pierce.gapPass`, `natural10`, `gapDiv`,
  `coverageGap`, `coverage.*.passThrough`, `maneuver.pronePassThrough`, `vital.armor` multipliers (replaced by
  margin adds) and `vital.coverage`
- data: `rules.yaml locations.aim.hold`, `wounds.vital` multipliers (now thresholds), and every armor's `gap`
  number
- code: `pierceCheck`, `blendHits`, `resolveGap`, `aimHold`, `vitalNeed`, `sizedVital`, `woundsByLocation`,
  `locationBranches`, `binomial`, and the `passThrough` and `passBurst` armor-info fields
- `CONFIG.provisional` entries: "Piercing through armor" and "Wound roll"

**New, all PROVISIONAL.** The first three entries of `CONFIG.provisional` describe them; six older entries were
rewritten.

| Key | Value |
|---|---|
| `rules.yaml contest.passive` | ready 6, unaware 3, prone 3, held 2, down 0 |
| `rules.yaml contest.shift` | 6 |
| `CONFIG.pierce.perMargin` | 0.13 (of resist per margin point) |
| `rules.yaml locations.wounds.vital` | head 7, torso 9, arms 12, legs 11 |
| `CONFIG.vital` | lower 10, armor {padded 1, leather 1, mail 2, plate 6, chitin 2, golemStone 99, …}, otherArmor 1, perSize 4 |
| `rules.yaml locations.next` | head→[torso], torso→[arms, head, legs], arms→[torso, head], legs→[legs, torso]; `carry.from` [head, arms, legs] |
| armor P mitigation | padded, leather, mail 1 → 2; plate 4 → 4.5 (iron 5, steel 7) |
| `aim.penalty.head` | 2 → 3 (TUNED) |

**Plate calibration.** Cyrus's level-1 spear thrust into Beren's steel plate, landed undefended:
- before: 0.09 CON and 0.05 other attributes
- after: it needs a margin of 7 (a d10 of 10) and then does 1 point, which is about 0.1 point of harm

**Commits:** `8e5024e1` (core), `85c7265e` (AI, panel, sheets, save, tests), `f08b1371` (head cost, crawl log
parse, margin in `onHit`), plus this report.

## Before and after against the targets (party of 3)

| Goal | Measure | Target | Before | After |
|---|---|---|---|---|
| Fast | median rounds (court, hall, valley; duels) | 3–5 | 5, 3, 6; 2 | 4, 3, 5; 2 |
| Lethal but playable | heroes dead a fight | ≤ 0.5 | 0.43, 0.30, 0.53 | **0.26, 0.33, 0.61** |
| | cleared of 30 | ≥ 18 | 16, 1, 11 | **27**, 3, 10 |
| Death spiral | survivor with a STR/DEX/SPD wound | ≥ ⅓ | 26%, 11%, 37%; duels 11% | 23%, 5%, 8%; duels 8% |
| | wounded twin (pooled, k=4) | clearly < 50% | STR 6%, SPD 56%, DEX 30% | STR 1%, SPD 56%, DEX 28% |
| Stamina matters | someone under ½ | ≥ ⅓ | 79%, 41%, 71%; duels 32% | 55%, 38%, 55%; duels 18% |
| | collapses that get up | most | 50/106, 46/112, 7/82; duels 0/59 | 26/47, 14/63, 3/45; duels 0/28 |
| Depth | top action share of blows landed | < ½ | thrust 31%, 45%, 56%; duels 60% | thrust 41%, 41%, 56%; duels 60% |
| | head share of located blows | < ¼ | 22%, 21%, 16%; duels 27% | 18%, 16%, 11%; duels 21% |
| | kills by thrust | – | 42%, 53%, 63%; duels 91% | 55%, 66%, 64%; duels 88% |
| Action economy | swarm, all heroes, N = 1..6 | loses near N = 4 | 92 75 44 36 24 11 | 93 81 56 45 31 20 |

Share of blows landed by action:

| Place | Before | After |
|---|---|---|
| court | thrust 31, shoot 30, natural 15, spell 9, swing 5, punch 5, kick 4 | thrust 41, shoot 25, spell 15, natural 9, kick 4, swing 3, punch 3 |
| hall | thrust 45, shoot 24, spell 22, kick 7 | thrust 41, **kick 21**, spell 18, shoot 18 |
| valley | thrust 56, shoot 30, kick 8, spell 5 | thrust 56, shoot 31, kick 8, spell 5 |
| duels | thrust 60, spell 22, natural 6, swing 5 | thrust 60, spell 24, swing 5, natural 4 |

Duels by pair (A wins, before → after):

| Pair | Before | After |
|---|---|---|
| Beren v Cyrus | 98 | 100 |
| Beren v Jabiku | 65 | 90 |
| Cyrus v Jabiku | 100 | 100 |
| Beren v scaleward | 53 | 88 |
| Cyrus v scaleward | 75 | 78 |
| Jabiku v scaleward | 0 | 0 |
| Beren v fireGoblin | 100 | 100 |
| Cyrus v fireGoblin | 45 | 40 |
| Cyrus v goblinWarrior | 45 | 48 |
| Beren v wolf | 100 | 100 |

**Plate against mail, and rapier against plate.** These are archetype duels at level 1, n 40, seed 4242, from a
scratch script on `sim/lib.js` builds:

| Matchup | Before (A / B) | After (A / B) | Thrust share of blows, after (before) |
|---|---|---|---|
| knight (plate) v sellsword (mail) | 18% / 55% | **65% / 13%** | 100% (43%) |
| duelist (rapier) v knight | 33% / 63% | 33% / 68% | 99% |
| duelist v sellsword | 20% / 80% | 33% / 68% | 100% |
| heavy (plate, greatsword) v sellsword | 53% / 33% | 57% / 33% | 32% |
| brute (leather, warhammer) v knight | 28% / 65% | 15% / 83% | 82% |

## Margins seen

| Source | Blows | Range | Mean | Margin ≤ 0 | Margin ≥ 6 (shift) | Through / turned | Vital |
|---|---|---|---|---|---|---|---|
| court crawl | 665 | −5 to 17 | 2.77 | 25% | 21% | 475 / 1 | 7.5% |
| valley crawl | 540 | −5 to 12 | 2.76 | 22% | 19% | 127 / 104 | 10.9% |
| archetype duels | 434 | −5 to 14 | 2.48 | — | — | 158 / 136 | 4.4% |

The modal margin is 1 to 3, and about 3% of blows reach 10 or more. Margin ≤ 0 means an undefended blow, or a
weakened blow that beat through a parry.

## Recommendation for step I's die

**Keep d10 against d10 and scale skill gaps by about half. Do not move to 2d10 a side.** The difference of two
d10s is already a triangle peaking at 0, so a +1 already matters most in an even fight. 2d10 a side would widen
the difference (sd 5.7 against 4.1) and need every threshold re-derived for nothing gained.

What threatens margin is the size of the bonuses. `skillEdge` adds a share of skill gaps of 0–10, on top of
⌊(STR + SPD)/4⌋ and the aim cost. A full 10-point gap moves the whole distribution past every threshold here (the
torso vital wound at 9, a spear against steel plate at 7), so margin stops discriminating. Gaps scaled to 0–5 keep
the 1–9 band, where the thresholds sit, in play.

## What moved the wrong way

- **Heroes dead a fight in the valley:** 0.53 → 0.61, past the 0.5 target. Hall: 0.30 → 0.33. Hero deaths are
  now mostly torso thrusts by orc legionnaires: 81% of valley kills are at the torso (head 62% before). A point
  through padding now goes in whole: the pass-through dice are deleted, only partly offset by +1 P mitigation.
  Thrusts against light armor are deadlier. Beren's thrust kills Cyrus undefended 52% of the time, against 23%
  before (`foresee`).
- **The death spiral weakened:** a survivor with a STR/DEX/SPD wound fell in all three places (valley 37% → 8%).
  More of a point now lands as CON at the torso, and blows kill outright.
- **Collapses that get up fell** (court 50 → 26, though collapses also halved). Fights end sooner.
- **The hall's kicks rose to 21% of blows landed** (7% before). I did not test whether this is the AI or the rule.
  A plausible cause is that thrusts at the hall's armored goblins are now turned at low margins, which makes a
  kick's knockdown relatively worth more. This needs a scripted check before anyone acts on it.
- **Thrust still dominates where it did:** 41–56% of blows landed, and 55–66% of kills (up in court and hall).
  Plate against mail flipped from mail winning (55%) to plate winning (65%), with the knight thrusting 100% of the
  time. That suits "armor is king", but thrust gained against mail and padding. Step G is where this should be
  answered.
- **DEX lost its role in piercing armor.** The gap roll's ⌊DEX/4⌋ is gone, and the strike bonus is
  ⌊(STR + SPD)/4⌋. Step I gives DEX "precision: margin" back.
- **Half-swording against plate does little.** It gets through at 3 less margin, but a longsword point (5–7 P)
  then meets plate's P mitigation of 5–7. Before, a gap bypassed mitigation. Pinned and helpless bodies still
  bypass it. Step H rebuilds the armor answers.

Where things improved: temple court cleared 16 → 27 of 30, with heroes dead 0.43 → 0.26. Swarm heroes hold longer
(N = 4: 36% → 45%). The head share is under a quarter everywhere.

## Decisions the plan did not settle

1. **The scale of `perMargin`.** Read literally, punch + perMargin × margin could not bridge plate (resist 7.5)
   and mail (2) with one number. I made margin add to punch as a share of the armor's resist, so a weapon that
   used to burst an armor still needs no margin against it.
2. **Compensating the deleted pass-through roll.** The plan names plate only. I raised P mitigation by 1 on padded,
   leather and mail too, and plate by 0.5. Without this, a thrust's landed CON against padding was 2–3 times the
   old figure (Cyrus into Jabiku: 6.6 against 2.8). Even with it, thrusts are deadlier against light armor, as
   listed above. Reverting to plate-only is one line per armor in `armor.yaml`.
3. **A pinned or helpless body bypasses P mitigation** as well as getting through. Otherwise the pin-and-dagger
   finish could not hurt plate at all, which would pre-empt step H's target.
4. **The aim cost on a blow nobody defends:** the unguarded `penalty` table comes off the margin. The head cost
   went 2 → 3 because, with no on-target roll, the head share in duels rose to 35%. At 3 it is 21%.
5. **The shift candidates include the place itself,** so a found gap never moves a blow somewhere better guarded.
   Ties keep the first. I added `torso → [arms, head, legs]` to `locations.next`, and `carry.from` keeps torso cuts
   from carrying.
6. **Save migration:** the fold is a `save.js` step, where the project keeps old shapes. `Character.normalize` adds
   a generic check: no place outside `locations.order`, and no overlapping pieces.
7. **Other changes:**
   - `sim/crawl.js`'s own "landed on" tally now parses the new log line. The crawl metrics above come from
     `sim/metrics.js`, which needed no change.
   - `enc.onHit` now also carries the margin, the way the point met the armor, and vital, for observers only.
   - `sim/run.js`'s "gap" scenario and `sim/variants.json`'s `pierceMode` and `passThroughByArmor` sets are stale.
     I left them for step D.
