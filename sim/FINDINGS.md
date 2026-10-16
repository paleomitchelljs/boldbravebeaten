# Simulation findings, round 1

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
