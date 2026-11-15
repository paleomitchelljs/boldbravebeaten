# Step B report: space (distance, reach, flanking)

Branch `overhaul/B-space`. All sims at seed 4242 and the plan's full n (crawls 30, duels 40, spiral 40, swarm 8).
"Before" ran on an untouched copy of the branch's base (`bd310877`), "after" on a copy of the finished code.

## What changed

### Two distance functions, in `Combat`

- `Combat.dist(a, b)` = `Math.round(Math.hypot(dx, dy))`: reach, range, spell radii and every "within n squares".
  Reach 1 is still the eight squares around; reach 2 drops the (2, 2) corners; (3, 3) is 4.
- `Combat.steps(a, b)` = `max(dx, dy) + floor(min(dx, dy) / 2)`: squares walked on open ground, every second
  diagonal counting two. `Terrain.costMap` now searches over (square, diagonals-so-far odd/even), so a walk round
  walls charges the same rule wherever its diagonals fall, and `Terrain.pathCost` and `Combat.resolveMove` count it
  step by step. A test checks the cost map against `Combat.steps` on open ground. `costMap` also moved from a linear
  scan to a binary heap, since the state space doubled.

No Chebyshev distance is left in `src/` or `sim/` (no switch back: rule 1).

**Callers changed:**

| File | What |
|---|---|
| `src/rules/combat.js` | `dist` redefined (all ~50 internal callers now Euclidean: reach, auras, cover, opportunity strikes, maneuvers, sweep, whirlwind, riposte, shout radii, fear); `validate` move cost uses `steps`; `resolveMove` counts every second diagonal; new `steps`, `flanked`, `flankerAt`, `flankedAt`, `threatens`, `bind` |
| `src/rules/terrain.js` | `costMap` (parity, heap), `trace`, `pathCost` (diagonals), `path` fallback "nearest reachable" by `Combat.dist`, wall-of-fire scorching by `Combat.dist` |
| `src/rules/ai.js` | `planMove` squares by `Combat.steps` (was Chebyshev inline); `fleeFrom` checks `steps` on open ground; flank terms (below) |
| `src/rules/magic.js` | `within` by `Combat.dist`; new `area(at, r)` for the four square-loop areas (delayed area, ground, dispel ground, see) |
| `src/game/explore.js` | `cheb` replaced by `dist` (= `Combat.dist`): search, notice distance, waking; exported as `Explore.dist` |
| `src/game/battle.js` | joiners' distance, wandering group's seed square, disengage "is on you / can reach you" by `Combat.dist` |
| `src/ui/views/battle.js` | the move wash: open-ground squares by `Combat.steps` (terrain via the new cost map); odds line and breakdown show the flank |
| `src/ui/game/screens/battle.js` | spell area preview by `Combat.dist`; strike animation duration by `Combat.dist` |
| `src/ui/views/rules.js` | rules text: reach scale, distance, flanking |
| `sim/crawl.js`, `sim/feats.js` | nearest-group sort by `Combat.dist` |

Not changed: `Explore.markSeen` (already a Euclidean disc), `Terrain.danger`'s 3 × 3 "beside" check (same as
`dist ≤ 1`), exploring movement (one square a step on the map; `node tools/pace.js` is identical before and after:
4919 steps, 13.7 h to see everything).

### Reach, compressed to 1–3 (`data/weapons.yaml`)

| Weapon | Before | After |
|---|---|---|
| Spear | thrust 2–4 | thrust 2–3 (cramped at 1) |
| Heavy spear | thrust 2–4 | thrust 2–3 (cramped at 1) |
| Short spear | thrust 1–3 | thrust 1–2 |
| War scythe | swing 2–3 | swing 2 (cramped at 1) |
| Giant club | swing 3 | swing 3 (unchanged) |
| Greatsword | swing 2, thrust 2–3 | unchanged |
| Staff | swing 2, jab 2 | unchanged |
| One-handed swords, maces, axes | swing 1, thrust 2 | unchanged |
| Daggers | 1 | unchanged |
| Natural weapons | 1–2 | unchanged (already in scale) |

Lunge stays +1 to a thrust (so a lunging spear reaches 4). The thrust-one-more-than-a-swing rule is untouched (step
G). Shove's `fendReach` still applies to weapons reaching 3 (spears, greatsword, giant club; no longer the scythe).

### Flanking (`CONFIG.flank.penalty: 2`, PROVISIONAL)

`Combat.flanked(enc, defender, attacker)` returns the penalty, called in one line from `defenseNumbers`
(`m.def -= flanked(enc, defender, attacker)`). A defender is flanked against a blow when another foe stands on the
far side (bearings from the defender to the attacker and to that foe more than 120° apart) and that foe
`threatens` them: active, not prone, not held or clinched, a melee option in range, the line clear of walls. A foe
whose way in is covered (the first square from the defender towards it holds a wall or a standing ally of the
defender) doesn't count. No facing. Any blow is affected, ranged included (an archer's arrow is harder to meet with
a sword at your back).

`defenseNumbers` has no `chars`, so `Combat` keeps a `WeakMap` from encounter to its characters, set in
`createEncounter`, `startRound`, `legalActions` and `defenseOptions`. Without it (a bare `defenseOdds` call with no
encounter, as the AI's own estimates make) flanking counts 0.

`Combat.foresee` returns `flank` (the penalty in its odds, from the same function); the odds line reads "Flanked:"
and the breakdown says "X defends at −2".

**The AI** (`src/rules/ai.js`):
- `planMove` scores each square with `flankTerms`: −6 (FLANK_SEEK) where its blow at the target would have an ally
  on the target's far side, +8 (FLANK_GUARD) where two foes would have it between them (`Combat.flankedAt`). A
  move that gains no distance is allowed when it gains a flank and scores better than staying.
- `sidestep`: before a melee blow, one step to a square from which the blow still reaches and either flanks the
  target or leaves the place between two foes, if the step draws no opportunity strike (still within, and no nearer
  to, every foe whose reach it is in), is on plain ground, is the turn's first move, and leaves the blow and the kept
  defence AP paid for.
- A target already flanked from where the AI stands is worth ×1.25 when choosing whom to strike.

Tests: `tests/space.test.js` (distances, the cost map against `steps`, a diagonal move charged 6 for 4, reach in the
data and Lunge, the flank geometry, the covering ally, the corner, the panel, the AI's sidestep into a flank and out
from between two foes).

## Measures, before → after

**Crawls** (party of 3, 30 each, `--metrics`):

| Place | cleared | rounds median / 90th | heroes dead a fight | under ½ | survivor attr wound | top action (all; heroes') | kills by thrust |
|---|---|---|---|---|---|---|---|
| temple_court | 16 → 17 | 5/10 → 5/11 | 0.43 → 0.43 | 79% → 73% | 26% → 28% | thrust 31% → shoot 34%; 44% → 46% | 42% → 39% |
| ember_hall | 1 → 1 | 3/9 → 4/13 | 0.30 → 0.35 | 41% → 38% | 11% → 8% | thrust 45% → 45%; 46% → 43% | 53% → 56% |
| orc_valley | 11 → 10 | 6/13 → 6/11 | **0.53 → 0.69** | 71% → 72% | 37% → 29% | thrust 56% → 61%; 47% → 56% | 63% → 72% |

(These "before" numbers differ from `sim/FINDINGS.md`'s 2026-11-11 baseline because the base has moved since; both
columns here are from the same day's runs.)

**Duels** (40 each): all-fight median 2 rounds and deaths 0.88 → 0.89 a fight; every pairing within a few points
(Cyrus vs scaleward 75% → 70%, Cyrus vs fire goblin 45/55 → 45/43). Expected: one against one there is nobody to
flank, and the duelists' weapons (reach 1–2) did not change.

**Spiral** (wounded twin, pooled): STR 36/23/9/9/6% → 38/25/9/8/6%; SPD 36/44/56/57/56% → 38/47/58/57/58%; DEX
36/34/33/31/30% → 38/36/36/34/29%. Unchanged within noise; the SPD inversion is not this step's.

**Swarm** (level-8 hero against N level-1 foes, all heroes, 8 a cell):

| | N=1 | N=2 | N=3 | N=4 | N=5 | N=6 |
|---|---|---|---|---|---|---|
| before | 92% | 75% | 44% | 36% | 24% | 11% |
| after | 93% | 76% | 45% | 37% | 25% | 13% |
| after, flanking off (`--set flank.penalty=0`) | 93% | 75% | 44% | 35% | 25% | 13% |

**Flanking does not help numbers in the swarm, measurably**: on minus off is 0 to +2 points at every N, inside
the noise of 8 fights a cell (about ±5 points per cell over the 72 fights of a column). The target ("loses at about
N = 4") is unmoved.

Is that the AI failing to flank? Checked with a counter on `Combat.flanked` (a scratch copy, swarm `--n 1 --max 4`):
of 6052 defence-odds checks for the lone hero, 1128 (19%) were flanked. So the foes do get round the hero about a
fifth of the time; a −2 on that share of defences is simply too little to move a level-8 hero's results. If the
user wants numbers to tell, the lever is `flank.penalty` (or a stronger wall reading, below), not the AI.

**A hero with a wall behind** (scratch sim, `swarm-wall.js` in the session scratchpad: the open arena with a stone
wall along the top row, and for "corner" down the left column too; the hero starts against it; 4 fights each hero,
template and N, after the change):

| | N=2 | N=3 | N=4 |
|---|---|---|---|
| open, flank 0 | 79% | 43% | 33% |
| open, flank 2 | 79% | 41% | 36% |
| wall, flank 0 | 82% | 42% | 32% |
| wall, flank 2 | 82% | 42% | 33% |
| corner, flank 0 | 79% | 43% | 34% |
| corner, flank 2 | 79% | 43% | 35% |

The wall does not hold measurably better, and the corner no better than the open floor, with flanking on or off.

**Who dies to spears in the valley** (scratch crawl that tallies each death by victim and killer, 30 runs; the
legionnaire's spear is the short spear, now reach 2; the centurion has a longsword):

| Killed | before | after |
|---|---|---|
| Cyrus by legionnaire | 18 | 12 |
| Cyrus by centurion | 6 | 10 |
| Jabiku by legionnaire / centurion | 8 / 5 | 10 / 3 |
| Lorc by legionnaire / centurion | 8 / 1 | 4 / 4 |
| Beren by legionnaire / centurion | 1 / 1 | 3 / 6 |
| legionnaires killed by Lorc | 63 | 34 |
| legionnaires killed by Beren | 65 | 66 |

Cyrus (padded) dies most, before and after; after, fewer to the spears and more to the centurion's sword. What
changed most is Lorc: he killed half as many legionnaires.

## What moved the wrong way

- **orc_valley: heroes dead a fight 0.53 → 0.69, cleared 11 → 10; fight 3 (four orcs) won 70% → 41%.** It is not
  flanking: with `flank.penalty=0` the same code gives 0.70 and 8 cleared (fight 3 won 31%). So it comes from the
  distance and reach change, most plausibly Lorc's loss of reach advantage (his kills of legionnaires halved) and
  the shorter spear letting the line close. I did not isolate which of the two (Euclidean distance, the short spear
  3 → 2) does it, and I have not tested whether it is an AI fault; I don't call it one.
- ember_hall: dead a fight 0.30 → 0.35, 90th-percentile rounds 9 → 13. Small, likely noise at this n.
- Kills by thrust rose in the valley (63% → 72%); thrust's share of blows rose there too. The plan wants it lower
  (step A/G's goal); this step did not help it.

## Decisions the plan did not settle

1. **"A wall or an ally at their back"** read without facing as: a flanker whose way in (the square beside the
   defender towards it) is a wall or a standing ally doesn't count. A wall otherwise protects only by leaving no
   square to stand on, so against a straight wall two foes at the defender's left and right (180°) still flank; a
   corner leaves no two squares far enough apart. The stronger reading (any wall or ally in the back arc cancels
   all flanks) was not built. The wall sim says neither the wall nor the corner helps the hero now, so the user may
   want the stronger reading.
2. **"Threatens"** = could strike now from where it stands with a melee blow (prone, held, clinched don't; AP is not
   counted, since the defender can't see it; an unseen foe counts).
3. **Ranged blows** are affected by flanking too.
4. **War scythe** kept its `min: 2`: it now reaches only distance 2 (a ring of 12 squares), cramped at 1.
5. **`Combat.steps` vs the path's diagonal parity**: the second diagonal is the one charged, counting from the
   start of each move (a new move starts the count afresh, as in most tabletop rules).
6. **The AI's flank weights** (seek 6, guard 8, ×1.25 a flanked target) are AI constants in `ai.js`, not rules.
7. Explore's notice distance, waking radius and joining distance are now Euclidean (rounded): a group at (4, 3)
   from the party is 5 away, not 4. `pace.js` is unchanged; I did not measure encounter rates.

## Looking at it

`tools/shot.sh` served another session's folder on port 8765 (a 404 page); with my own server on another port the
fight screen rendered (orc valley, two legionnaires), but the move wash is too faint on stone and the fighter sat at
the view's edge, so **I could not look at the shape of a reach or move ring**. The fake DOM tests cover the code
paths, not the look.

## Checks

SUITE_RESULT. `node tools/validate.js`: "data/ is consistent." `node tools/pace.js`: identical before and after.
