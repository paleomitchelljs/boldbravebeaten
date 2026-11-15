# Step D report: sims you can trust (2026-11-15)

Branch `overhaul/D-sims`. Only `sim/` and `tests/` changed, plus one sim-only flag in `src/rules/enemies.js`
(`Enemies.strict`, never set by the game). No rule changed: the crawl baselines below clear exactly what they cleared
before the measures were added (16, 1 and 11 of 30), and a test checks that a watched fight's whole log is the same as
an unwatched one's.

Step F was re-ruled while this step ran (the user, 2026-11-14: straight to a tick clock). The tempo measures are
written for that: they read time through a small clock adapter (below), and the one measure that only makes sense
with an AP die is marked "baseline only".

## 1. Stale sims: rebuilt, nothing deleted

| Sim | What was wrong | What it is now |
|---|---|---|
| `sim/arena.js` | Strategy feat lists named retired feats (`parry_training`, `shield_training`, `dodge_training`, `casting`, `verb_ward`, `verb_launch`, `word_doubling`…) that `Enemies.chooseFeats` skipped without a word, then filled at random; no skills at all | Each combatant is an armor class × a strategy. A strategy is a `sim/lib.js` archetype (two-handed = `heavy`, sword and shield = `sellsword`, grappler = `brawler`, rapier and dagger = `duelist` with a parrying dagger) or a start.yaml hero's plan (archery = Lorc, magic = Spawnee's fire spellsword, cleric = Jabiku's Life). The armor class swaps the plan's armor feats and Armor ranks for its own. Built by `L.build`, so skills grow with the feats. `--keys` runs a subset. |
| `sim/gauntlet.js` | Took its members from the arena | Follows the arena. The **enchanter is gone** (no plan names mind spells); the mage is Spawnee's plan, the cleric Jabiku's. |
| `sim/run.js` | Explicit feat sets named `shield_training`, `parry_training`, `dodge_training`, `read_attack` (and Feint III, which no longer exists); explicit-feat builds had **no skills** (skill 0 everywhere) | Retired ids replaced (Quick Block, Quick Parry, Quick Dodge, Read Intent; Feint one rank). `L.build` with explicit feats now grows the archetype's skills for the level (or takes `opts.skills`). The feint scenario's three duelists share one skill set with Perception 2 so the reader can hold Read Intent. |
| `sim/monsters.js`, `party-arena.js`, `monster-party.js`, `styles.js`, `arena-inspect.js` | Used the arena's combatants | Unchanged code; they get the rebuilt combatants. All but `monsters.js` were run at n = 1. |

**Failing loudly.** `sim/lib.js` sets `Enemies.strict = true`; `chooseFeats` then throws on an unknown id
(`Enemies.chooseFeats: no such feat: …`). `L.build` checks every feat and skill id of an archetype or of explicit
feats, and an explicit rank above a feat's ranks, and throws. `L.checkIds(where, feats, skills)` is exported for
other sims. Templates and monsters name no unknown feat today (checked), so the flag changes no fight.

Notes. The unarmored two-hander and the unarmored sword-and-shield hold 6 of their 7 feats at level 5 (their plans run
out once the armor feats are dropped); the rest spend all 7. `tests/sims-run.test.js` allows one short.

## 2. Tempo measures (`sim/metrics.js`)

**The adapter.** Measures read time only through `apClock(enc, chars)`, which answers per fighter: time available,
time spent on its own actions, time spent on reactions, time unused, and "now" (round and share of the round's turns
gone). Step F replaces the adapter with a tick clock; the measures stay. Today: available = AP rolled
(`enc.apStart`); a fall in a fighter's AP during its own action is its own spending except the defences it declared
as reactions; a fall in anyone else's AP is a reaction; what is left at the round's end is unused; in the round the
fight ends in, the leftover is "cut" and kept out of the shares. A test checks own + reactions + unused + cut =
available. A riposte or opportunity strike a fighter answers during its own turn is booked as its own (the engine
does not mark those as reactions in `enc.decls`).

The watcher now has `before(id)` (called by `sim/lib.js` and `sim/crawl.js` before each action) and `poll()` after.

What is counted:

- **First blow**: the first blow landed (through `applyHit`) and the first tried (a strike or wind-up declared at a
  foe); whether that side won; when. Timeouts are left out.
- **Waiting**: a turn that began with a standing foe in reach of an attack the fighter could pay for, with no attack
  made in it. Also counted only over turns where a blow in reach **could harm** the foe (`computeHit` above 0): plate
  against plate makes the first count large for a good reason.
- **Time shares**: own, reactions, unused, of the time available (AP here), per side.
- **Heavy blows** (added for the clock): the share of blows landed that are a wind-up (power blow, drawn bow, Strong
  spell) or two-handed; and wind-ups started, released, and **spoiled** before release.
- **Win rate by AP rolled that round**: marked `[baseline only]` in the output; the AP die goes in step F.

Standard errors are binomial and treat turns and fights as independent; turns cluster within fights, so the waiting
errors are too small (read them as lower bounds).

### Baseline (step F's "before")

Commands, seed 4242: `node sim/crawl.js <place> --party 3 --n 30 --metrics`, `node sim/duels.js --n 40 --seed 4242
--metrics`, and, for step F's even-duel target, `node sim/duels.js --n 200 --seed 4242 --mirror --metrics` (each preset
against its twin; new flag; deals supplies so Lorc has arrows).

| Setting | Cleared / wins | First blow landed: its side won | First tried: its side won | First landed in round 1 | Waiting (any attack in reach) | Waiting (a harmful blow in reach) | Own / reactions / unused | Heavy blows | Wind-ups spoiled |
|---|---|---|---|---|---|---|---|---|---|
| temple_court (102 fights) | 16/30 | 76% ± 4 | 72% ± 4 | 82% | 13% ± 1 (heroes 16, foes 7) | 9% ± 1 | 68 / 8 / 24% | 31% ± 2 (shots 273, two-handed 5) | 11 of 294 (4%) |
| ember_hall (228 fights) | 1/30 | 71% ± 3 | 64% ± 3 | 19% | 12% ± 1 (heroes 8, foes 20) | 11% ± 1 | 69 / 6 / 25% | 24% ± 2 (shots) | 8 of 187 (4%) |
| orc_valley (102 fights) | 11/30 | 80% ± 4 | 74% ± 4 | 13% | 30% ± 1 (heroes 10, foes 57) | 9% ± 1 (foes 5) | 67 / 9 / 24% | 30% ± 2 (shots) | 8 of 276 (3%) |
| duels, ten pairings (400) | – | 67% ± 2 | 64% ± 2 | 49% | 8% ± 1 | 4% ± 1 | 70 / 16 / 14% | 0% (two-handed 5 of 1261) | none started |
| **mirror duels, all (800)** | 21% timeouts | **59% ± 2** | **48% ± 2** | 61% | 57% | **6%** | 69 / 1 / 30% | 16% ± 1 | 14 of 740 (2%) |
| Beren vs Beren (200) | 74% timeouts | 47% ± 7 (n 51) | 47% ± 7 | 0% | 63% | 10% ± 1 | 62 / 1 / 37% | 0% | – |
| Lorc vs Lorc (200) | | 56% ± 4 | 56% ± 4 | 86% | 1% | 1% | 83 / 1 / 15% | 92% (shots) | 14 of 740 (2%) |
| Cyrus vs Cyrus (200) | | **92% ± 2** | 61% ± 3 | 100% | 0% | 0% | 87 / 10 / 3% | 0% | – |
| Jabiku vs Jabiku (200) | | 28% ± 3 | 28% ± 3 | 10% | 66% | 0% | 79 / 0 / 21% | 0% | – |

Against step F's targets: the first to land wins 59% of even duels overall, inside 50–60%, but that average hides the
spread: in Cyrus's mirror the first blow landed wins 92% (one landed thrust decides it), in Jabiku's 28%, and Beren's
mirror mostly times out (74%: plate on plate, nobody can hurt anybody). Waiting with a harmful blow in reach is
already under 15% everywhere (4–11%); the large "any attack" figures are plate (Beren mirror) and the valley's
foes standing off. Unused AP is 14–30% of AP available, against a target under 10%: this is the measure the old step
F (no die, whole costs) would have moved most. Heavy blows are almost all drawn bows; two-handed blows are 5 of 900 in
the court and none elsewhere (the AI rarely swings a two-hander: the thrust shortfall, #4).

Win rate by AP rolled (baseline only): in the crawls it zigzags (temple court: 5.5 AP 67%, 6 AP 30%, 6.5 AP 69%):
whole and half values come from different fighters (SPD's parity), so it reads who rolls, not what the roll does. In
the mirrors, where both sides are the same, it is flat within noise (4.5 AP: 58%, 5.5: 47%, 6.5: 46%, 7.5: 54%): the
round's AP roll decides little on its own.

## 3. Party size (`sim/partysize.js`)

`node sim/partysize.js --n 60 --seed 4242 --jobs 3`. Level 1. Up to four heroes drawn at random from the presets (as
`crawl.js --party` does); five and six are the four presets and one or two random recruits. Crawl i of every cell
shares its seed. n = 60 crawls a cell (the step-1 n is 30; 60 halves the variance); ± is one standard error.

| Place | Size | Cleared | Fights a crawl | Heroes dead a fight | Dead a crawl | Nobody dead |
|---|---|---|---|---|---|---|
| temple_court | 1 | 0/60 | 1.4 | 0.26 ± 0.05 | 0.35 | 65% |
| | 2 | 4/60 (7% ± 3) | 2.5 | 0.45 ± 0.04 | 1.10 | 7% |
| | 3 | 25/60 (42% ± 6) | 3.3 | 0.40 ± 0.05 | 1.30 | 25% |
| | 4 | 52/60 (87% ± 4) | 3.9 | 0.23 ± 0.04 | 0.90 | 50% |
| | 5 | 58/60 (97% ± 2) | 4.0 | 0.18 ± 0.03 | 0.73 | 52% |
| | 6 | 60/60 (100%) | 4.0 | 0.03 ± 0.01 | 0.12 | 88% |
| ember_hall | 1 | 0/60 | 3.2 | 0.21 ± 0.03 | 0.67 | 33% |
| | 2 | 2/60 (3% ± 2) | 5.3 | 0.26 ± 0.02 | 1.38 | 0% |
| | 3 | 3/60 (5% ± 3) | 7.2 | 0.31 ± 0.02 | 2.23 | 0% |
| | 4 | 21/60 (35% ± 6) | 9.6 | 0.28 ± 0.02 | 2.67 | 3% |
| | 5 | 38/60 (63% ± 6) | 10.3 | 0.28 ± 0.02 | 2.88 | 5% |
| | 6 | 53/60 (88% ± 4) | 10.7 | 0.23 ± 0.02 | 2.50 | 7% |
| orc_valley | 1 | 0/60 | 1.4 | 0.54 ± 0.08 | 0.73 | 27% |
| | 2 | 10/60 (17% ± 5) | 2.7 | 0.42 ± 0.05 | 1.15 | 12% |
| | 3 | 29/60 (48% ± 6) | 3.5 | 0.52 ± 0.04 | 1.80 | 7% |
| | 4 | 37/60 (62% ± 6) | 3.6 | 0.64 ± 0.04 | 2.30 | 7% |
| | 5 | 40/60 (67% ± 6) | 3.6 | 0.94 ± 0.03 | 3.37 | 2% |
| | 6 | 51/60 (85% ± 5) | 3.5 | 0.98 ± 0.05 | 3.42 | 0% |

Reading it. The court scales as a dungeon should: each hero added lowers the deaths a fight, and four or more clear
it nearly always. The hall is a long place (10 fights) where a party of three almost never gets through; deaths a
fight stay flat (0.21–0.31) at every size, so it is the length, not any one fight, that beats small parties. **The
valley is the odd one**: more heroes clear it more often, but heroes dead a fight *rise* with party size (0.42 at
two, 0.98 at six) and nobody walks out unhurt at six. More bodies on the open slope means more of them in reach of the
orcs' spears and arrows at once; this is the kind of thing step B (reach and flanking) should be checked against.
The composition changes with size (a party of one is a random preset; five and six add recruits), so a column is
"a party of that size as the game offers it", not "one more of the same".

A solo hero never clears, but comes out alive in 65% of court crawls and 33% of hall crawls: beaten usually means
down, not dead.

## 4. AI or rule? (`sim/aicheck.js`)

`node sim/aicheck.js spd,anticipation,rally --n 200 --seed 700 --jobs 6`. The paired duels of `sim/feats.js` (the hero
grown to its level along its plan, the gear ladder; against the other presets of that level and three monsters for
it), 200 seeds a foe, **1,200 paired fights an arm**. Δ is the change in win rate in points (a timeout ½), ± the
standard error of the paired difference. Pins (scripted, over the AI; rules untouched): `hide` makes every AI decision
as if the change were not there, `hideSelf` only the hero's own, `hideFoes` only the foes'; `noBareApproach` stops
the hero ending a move in a foe's reach without the AP for a blow from there (it holds instead).

| Finding (step 9) | Δ as is | Pin | Δ pinned | Δ pinned − Δ as is | Verdict |
|---|---|---|---|---|---|
| +1 SPD, Beren, level 3 (was −9.9 ± 3.5) | **−7.0 ± 1.1** | noBareApproach (the suspected "moves up for a blow he can't afford") | −9.1 ± 1.1 | −2.1 ± 0.7 | not that choice: pinning it makes the change worse |
| | | hide | −6.7 ± 1.2 | +0.3 ± 0.3 | **the rule** |
| | | hideSelf / hideFoes | −6.8 ± 1.2 / −7.0 ± 1.1 | +0.2 ± 0.3 / +0.0 ± 0.1 | the rule |
| +1 Anticipation, Beren, level 3 (was −6.8 ± 1.9) | **−7.7 ± 0.8** | hide | 0.0 ± 0.0 | +7.7 ± 0.8 | **the AI: the foes'** |
| | | hideSelf | −7.7 ± 0.8 | 0.0 ± 0.0 | (Beren's own decisions are not it) |
| | | hideFoes | 0.0 ± 0.0 | +7.7 ± 0.8 | the foes' AI |
| Rally held, Cyrus, level 5 lab (was −11.7 ± 4.2) | **−9.2 ± 0.9** | hide / hideSelf | 0.0 ± 0.0 | +9.2 ± 0.9 | **the AI** |

**+1 SPD: the rule.** With every AI decision made as if Beren had his planned SPD, the loss is the same (−6.7 against
−7.0; the difference +0.3 ± 0.3). The suspected choice is not the cause: forbidding the bare approach costs the faster
Beren a further 2.1 ± 0.7 points. What changes is the turn order: Beren's turn comes first in 21.0% of rounds as
planned and 41.1% with the point (8,885 and 8,720 rounds), and the loss sits against the orc centurion (−18.5 ± 3.2)
and the gnome warrior (−26.0 ± 3.5), near zero against the rest. That is shortfall #3, acting first is a penalty
under the order by AP rolled, which step F removes. Caveat: `hide` cannot hide the extra AP the rules roll, so "the
rule" here is SPD's whole effect on AP, order and movement, not one of them; the first-turn shares point at order.

**+1 Anticipation: the AI, but the foes', not Beren's.** Held to the decisions of the planned Beren and his foes, the
rank changes nothing: all 1,200 fights end as they did without it (Δ 0.0 exactly; its rule effects, +1 to dodge and
to reading, never decided a fight). Beren's own decisions with the rank change nothing either (`hideSelf` −7.7, as
is). The loss comes from the foes' AI reading his higher Anticipation: their Bait is chosen only when their
Deception beats his reading (`ai.js` 1307), so with the rank they stop baiting him, and they do better for it
(gnome warrior −38.3 ± 3.0, orc centurion −8.0 ± 3.1). The fault is the foes' Bait: it is worth less than what they
would do instead, and the planned Beren profits from their wasting AP on it. Beren's shoves also fall (593 to 185 in
1,200 fights), a consequence, not checked further.

**Rally held: the AI.** Cyrus's AI Rallies 1,170 times in 1,200 fights. Hidden from his decisions (he never Rallies),
every fight ends as without the feat (Δ 0.0; the skill rank the lab adds does nothing in a duel either). The whole
loss is the choice: 2 AP for a round's regeneration on himself, against the sarnak knight above all (−51.7 ± 3.5).
In a duel Rally has nothing to give; whether the rule is worth a feat is a party question this tool cannot answer.

Exact zeros are expected where they appear: with the change hidden from every decision that reads it, the AI makes
the same choices on the same dice, so the fights repeat move for move. That is also a check on the tool: the pinned
arms reproduce the base arm exactly when the change has no effect through the rules.

## Commands

```
node sim/crawl.js temple_court --party 3 --n 30 --metrics        # and ember_hall, orc_valley (seed 4242 is the default)
node sim/duels.js --n 40 --seed 4242 --metrics
node sim/duels.js --n 200 --seed 4242 --mirror --metrics
node sim/partysize.js --n 60 --seed 4242 --jobs 3
node sim/aicheck.js spd,anticipation,rally --n 200 --seed 700 --jobs 6
node --test tests/metrics-tempo.test.js tests/sims-run.test.js tests/lib-sim.test.js tests/metrics.test.js
```

`--json <file>` on each appends the numbers, one line each.

## For step F (and A, B): what these tools rely on

Files that read rounds, AP or turn order directly, which step F must port:

- `sim/metrics.js`: only inside `apClock` (`enc.apStart`, `enc.ap`, `enc.order`, `enc.turn`, `enc.round`,
  `Combat.apLeft`, `CONFIG.apDie`) and the old `aiWatch` (`enc.round` for idle rounds, `Combat.apLeft`). Write a tick
  adapter with the same face (`before`, `after`, `newTurn`, `now`, `canPay`, `rolled` → null, `close`, `time`); the
  tempo measures need no other change. "newTurn" becomes "the first action after the fighter's last".
- `sim/lib.js` (`fight`/`playRound`: `Combat.startRound`, `currentActor`, `enc.round` for maxRounds), `sim/crawl.js`
  (`watched`, the same loop), `sim/sweep.js` (its own loop), `sim/effort.js` (`enc.round`).
- `sim/aicheck.js`: the `noBareApproach` pin reads `Combat.apLeft`, `C.moveCost`, `Combat.dist`; its "turn first"
  share reads `enc.order[0]`.
- `apPool` for printing: `sim/arena.js`, `arena-inspect.js`, `inspect.js`, `run.js` (the stamina scenario simulates
  rounds of AP by hand).

Step A may break the log-text readers: `sim/crawl.js` reads blows from the log (`'s X hits … → on the Y`), the wind-up
counts read "winds up … — exposed", "draws for a … — exposed", "loses the wind-up". Step A's four locations change the
location names in the reports but nothing in the code. Step B changes `Combat.dist` (used everywhere for reach) and
`C.moveCost` (used by the pin); the calls are through the public functions, so they follow.

## Verification

`node --test` (whole suite, `NODE_OPTIONS=--max-old-space-size=8192`, beside other sessions' sims): 333 tests, 333
pass, 0 fail (708 s). `node tools/validate.js`: data/ is consistent.

## Open decisions

1. Step F's even-duel target averages very different mirrors (92% for Cyrus, 28% for Jabiku, plate timing out).
   Read the target per style, or on a pooled mirror? I would read it per style: a 59% pool can hide a duel that one
   landed blow decides.
2. Unused AP is the tempo measure furthest from target (14–30% against under 10%). On the clock "unused" becomes
   "waiting": decide whether a deliberate wait (an action under step F) counts as unused.
3. The valley's deaths rising with party size: a question for steps B and E, not this one.
4. Bait (from the Anticipation check): the AI's Bait loses its user fights. Fix the AI's valuation of Bait, or the
   rule, before step I gives WIS and CHA their fight roles; `sim/aicheck.js` can test either.
5. Duels without supplies: `sim/duels.js`'s standard pairings fight without the party's bandages and arrows (as the
   step-1 baseline always has); only `--mirror` deals them. Lorc is not in the pairings for that reason. Changing it
   would change the step-1 baseline, so I left it.
