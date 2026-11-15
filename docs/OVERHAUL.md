# Core overhaul plan (2026-11-14)

The plan that follows the critical assessment of 2026-11-14 (in that session's transcript; its findings are
restated under each step). `docs/PLAN.md` was tuning inside the existing rules; this plan replaces rules. The user
approved the direction on 2026-11-14 with one correction, recorded under "Attributes" below.

Each step is written to be handed whole to an implementing session. A session reads `CLAUDE.md`, `HANDOFF.md` and
this file, does one step, and writes a report to `docs/overhaul/<step>-report.md`.

## What the overhaul is for

The goals, as the project states them:

- "classless; gear, preparation, knowledge and roleplay matter more than level"
- "Fights are lethal and fast; power comes from reacting more, lasting longer and mitigating damage, never from a
  bigger HP pool"
- "Armor is king in melee"
- "Balance is differentiation, not parity ... every style needs a use somewhere, not necessarily in a fight"
- "Combat, sneaking and talking are three settings of equal standing"

Where the rules as of commit `b2671df4` fall short of them:

| # | Shortfall | Evidence |
|---|---|---|
| 1 | A blow is resolved by up to ten random stages; the player chooses little | `applyHit`; thrust is 36–58% of blows landed and 61–70% of kills; "the longsword's swing is still never chosen" |
| 2 | Life and stamina are pools, and monsters and feats scale them | goblin warrior (level 1) CON 13, stamina 73 against heroes' 5–7 and 33–45; Toughness "first or second best change" |
| 3 | Acting first is a penalty; waiting wins | the spear twin with less SPD wins 98%; Beren's +1 SPD is −9.9; "heroes now wait at the edge for the foe to come" |
| 4 | One motion dominates for structural reasons | thrust: cheaper per AP, longer reach, cheaper aim, goes to CON, triples on a vital |
| 5 | The answers to armor are feats, so level answers armor, not gear | Half-swording +14 to +18 points and a must-take |
| 6 | 58 of 144 feats are a number; 13 unbuilt | `docs/FEATS-AUDIT.md` |
| 7 | Traps are one roll and a fixed wound; two exist | `Explore.springTrap` |
| 8 | Distance is Chebyshev; reach reads too long; position matters only through reach | `Combat.dist`; "orcs hit from very far away" |
| 9 | Sims measure the AI as much as the rules | "an AI finding, not a rule" for SPD, Anticipation, Rally, Demoralize |

## Rules for every step

1. **Replace, don't switch.** The old rule is deleted with its config keys, its branches in the code and its entry
   in `CONFIG.provisional`. Git is the history. A new rule's numbers go in `data/rules.yaml` or
   `src/rules/config.js`, marked PROVISIONAL and listed in `CONFIG.provisional`, as `CLAUDE.md` says. Comments say
   what the rule is, not what it used to be.
2. **Measure before and after** with the step-1 commands of `sim/FINDINGS.md` ("Baseline for the tuning plan"),
   seed 4242: `node sim/crawl.js temple_court|ember_hall|orc_valley --party 3 --n 30 --metrics`,
   `node sim/duels.js --n 40 --seed 4242 --metrics`, `node sim/spiral.js --n 40`, `node sim/swarm.js --n 8`. Report
   both in the step's report. A step that moves a target the wrong way says so plainly; it is not re-tuned to hide it.
3. **The AI plays the new rule in the same step.** A rule the AI can't use can't be measured. Where a result looks
   like an AI fault, test that claim (script the choice by hand in a small sim) before writing it down as one.
4. **The panel tells the truth.** `Combat.foresee` and `tests/odds.test.js` are updated with the rule.
5. **Before finishing:** `node --test` and `node tools/validate.js`. The suite takes about 8 minutes on idle cores and
   much longer beside sims or other sessions: run single files (`node --test tests/<file>`) while working and the
   whole suite once at the end.
6. **Not every rule is for a fight.** Combat is the current focus, not the whole game (the user, 2026-11-14). A
   step must not remove or flatten something because it has no use in a fight: say what setting it serves (combat,
   sneaking, talking, exploring) and leave it a hook there. This applies most to attributes and skills.
7. **Parallel sessions** work in their own git worktree and branch, commit there, and do not push, merge, or edit
   `HANDOFF.md` or `sim/FINDINGS.md` (the coordinating session folds reports into both). Never use PixelLab.
8. Terminology is `CLAUDE.md`'s: round, turn, reaction; no passes.

## Order and dependencies

| Step | What | Depends on | Touches |
|---|---|---|---|
| A | One contest per blow, four locations | – | `combat.js` (computeHit, applyHit, foresee, aim), `ai.js`, `rules.yaml` locations, battle screen |
| B | Space: distance, reach, flanking | – | `Combat.dist` and its callers, `terrain.js`, `weapons.yaml`, `ai.js` footing |
| C | Traps as terrain | – | `explore.js`, `terrain.js`, `places.yaml`, `docs/DATA.md` |
| D | Sims you can trust: stale sims, tempo and party-size measures | – | `sim/` only |
| E | Wounds and life: fixed capacity, stamina as exertion, down before dead | A | `combat.js`, `character.js`, `recovery.js`, `monsters.yaml` |
| F | Tempo: no AP die, whole costs, a reason to act first | A, D | `character.js`, `combat.js` turn loop, `ai.js`, battle UI |
| G | Damage by role: cut, point, crush | A, E | `items.js` weaponStats, `weapons.yaml`, `armor.yaml` |
| H | Armor's answers as gear and techniques anyone can use | G | `feats.yaml`, `weapons.yaml`, `character.js` attackOptions |
| I | Attributes and skills: a job for each, the die | E, F | `character.js`, `skills.yaml`, `rules.yaml` |
| J | Feats cut to rule-breakers | E–I | `feats.yaml`, `combat.js` |
| K | Housekeeping: delete superseded switches, shrink `CONFIG.provisional` | after each of A, E, F | `config.js`, `combat.js` |

A, B, C and D start together (first wave). E and F follow A. G to J are in order. K runs after each large merge.

---

## Step A. One contest per blow, four locations

**Now.** A blow rolls: the opposed defence; the aim hold (0.4 + 0.05 × skill); the location d100; burst or a gap
d10; a d10 per point of pass-through; the vital d10; an attribute roll per point; carry; disarm, trip and stun
percentages. Locations and the gap roll both answer "did the blow get round the armor".

**Change.**

1. **The contest.** One opposed roll decides a blow: the attacker's d10 + strike bonus against the defender's d10 +
   defence bonus, as `defenseNumbers` computes them now. Its **margin** (attacker's total − defender's) is kept and
   does the work of the deleted rolls. A blow nobody defends still rolls for its margin, against a fixed passive
   number in `rules.yaml` (lower for a prone, held, collapsed or unaware target); it always lands.
2. **Penetration by margin; no gap roll, no pass-through roll.** A point's punch against the armor at the place it
   lands gains `perMargin` per point of margin. At or above the armor's resist it is through and the piercing past
   mitigation goes in whole; below, the armor turns it (the existing `deflectBlunt`). Delete `pierce.gapDiv`,
   `natural10`, `gapPass`, the armor `gap` numbers, `pierceMode`, `piercePassThrough`, `passThroughByArmor`,
   `coverage.*.passThrough`. Plate's old 0.4 pass-through becomes part of its resist and mitigation: choose numbers
   so plate against a level-1 thrust is about as safe as it measures now (Cyrus into Beren: 0.09 CON a thrust
   expected), and report what you chose. Find the Gap, Spot Weakness, half-swording, prone and pinned become
   bonuses to margin for penetration (a pinned or helpless target: through).
3. **Vital by margin; no vital roll.** A point or cut that reaches the body with margin at or above a threshold is
   a vital wound. The threshold is per location (head lowest, torso next, limbs high or never) and rises with the
   armor there; depth and edge lower it. Size raises it, as now.
4. **Aim is a penalty only; no aim hold.** Delete `locations.aim.hold`. An aimed blow that lands, lands where
   aimed. Keep `penalty` and `guarded`, re-tuned if head share leaves the target (< ¼ of located blows).
5. **Four locations.** `head, torso, arms, legs`. Hands fold into arms and feet into legs (shares, wound tables,
   aim costs, `carry.next`, `coverage` keywords, `pieces` names in `armor.yaml`, the body picker on the battle
   screen and the sheet). `Character.normalize` migrates an old save's `covers`. `game.wornSlots` (rings, gloves,
   boots as worn goods) is a different thing and stays.
6. **An unaimed blow** still rolls where it lands (one d100 by share). A margin at or above `shift` moves it to
   the worst-protected of the locations beside it (`carry.next`'s map), which is what a found gap was.
7. Leave for step E: the per-point attribute rolls, bleeding, disarm/trip/stun percentages. Do not redesign wounds.

**Also.** `Combat.foresee` lays out the margin distribution instead of the deleted dice (`tests/odds.test.js`
against seeded resolutions, as now). The AI's `computeHit` expectation integrates over margin. The log line for a
blow says the margin and what it did ("by 4: through the mail at the arm").

**Report.** Before and after on every target; the share of blows by action; head share; kills by thrust; plate
against mail and rapier against plate in duels; the distribution of margins seen, and whether a d10 against skill
gaps of 0–10 leaves room for margin to matter (a recommendation for step I's die question, not a change).

**Done when** a blow rolls two dice at most beyond the contest's two (location; nothing else before step E's wound
rolls), the deleted keys are gone from config and code, and the suite passes.

## Step B. Space: distance, reach, flanking

**Now.** `Combat.dist` is Chebyshev: a diagonal step is free and a reach-4 spear covers a 9 × 9 block. A square is
"an arm's length and a step", so reach 4 is six metres. There is no facing and no flanking; position matters only
through reach and opportunity strikes, which favours standing still.

**Change.**

1. **Reach and range** use rounded Euclidean distance (`Math.round(Math.hypot(dx, dy))`): reach 1 is the eight
   squares around; reach 2 drops the far corners. **Movement** counts every second diagonal step as two squares.
   One function each, in `Combat`, used by every caller (`terrain.js`, `ai.js`, `explore.js` notice distances,
   spells' ranges and radii). List every caller you changed.
2. **Reach compressed to 1–3** in `weapons.yaml`: spear and heavy spear thrust 3 (min 2), short spear 2, war
   scythe 2; natural weapons and monsters' reach checked against the same scale. Lunge stays +1. Leave the
   thrust-reaches-one-more-than-a-swing rule alone (step G decides it).
3. **Flanking.** A defence against a blow from a foe while another standing foe that threatens the defender is on
   the far side (the two bearings more than 120° apart) is at −`flank` (start at 2). A defender with a wall or an
   ally at their back is not flanked from there. No facing. Put it in one function (`Combat.flanked`) called from
   `defenseNumbers` in one line, so it merges cleanly with step A's work there. The AI seeks a flank and guards
   against one (a back to a wall, beside an ally); `foresee` shows it.

**Report.** The baseline commands before and after; `sim/swarm.js` in particular (flanking helps numbers: say by
how much, and whether a hero with a wall behind holds); who dies to spears in the valley; a screenshot of a reach
ring if `tools/shot.sh` works, else say you could not look.

## Step C. Traps as terrain

**Now.** A trap is a map square: one passive group Perception roll finds it or not; walked onto, a random
front-rank hero takes fixed attribute damage (`damage: {CON: 2}`) with no armor, save or choice. Two exist. A fight
on the same map does not know them.

**Change.** A trap is a thing in the world with a tell, a trigger, an effect and several ways past, and it is the
same object when exploring and when fighting.

1. **Schema** (`places.yaml` legend, documented in `docs/DATA.md`): `tell` (text seen from a distance by a party
   that notices; what it gives away), `trigger` (step, wire, plate, lid), `effect` (a blow as a weapon option:
   damage vector, motion, punch, aim or area; or a terrain: pit, fire, gas as a condition), `reset`, `knownTo`
   (factions or groups who walk it safely), `disarm`, `bypass` list.
2. **Finding has degrees.** The Perception check's margin gives: nothing; *something is off here* (the tell, no
   square); the square; the square and the mechanism (what it does and every way past). Lore or the right topic
   from a parley (`reveal`, already there) gives the last without a roll: knowledge beats skill.
3. **Ways past**, each a choice with a cost: disarm (Devices; a fumble springs it), spring it from a distance
   (a pole, a thrown stone, a shield held over: needs the item; loud), leap or edge round (Athletics, as now),
   mark it and leave it. Time passes for each, as searches do.
4. **Sprung, it is a blow.** The effect resolves through `Combat.computeHit`/`applyHit` on the victim (armor,
   shield and location count; a helm matters against a falling block). The victim is whoever is on the square by
   marching order, not a random pick. Hero mode scales it as it does blows.
5. **In a fight** (`Battle.dungeonArena`): live traps in the slice become terrain (hidden to the side that
   doesn't know them). Anyone stepping or driven onto one springs it; `knownTo` groups path round theirs and may
   shove or bait foes onto them; the party can do the same with a trap it has found. The AI values a shove onto a
   known trap as it does one into a pit.
6. **Content** (the world is a test draft): put five to eight traps of different kinds in the trial places, at
   least two where a fight happens on them. Run `node tools/validate.js` and `node tools/pace.js`.

**Report.** The schema; what each trap does to Beren (plate), Cyrus (padded) and Jabiku at level 1 (expected
harm), so armor visibly matters; tests for finding by degree, each way past, and a foe shoved onto a trap.

## Step D. Sims you can trust

Only `sim/` and `tests/` for it. No rule changes.

1. `sim/arena.js`, `sim/run.js`, `sim/gauntlet.js` name retired feats and verbs and fight without them silently.
   Rebuild each on `sim/lib.js`'s archetypes or delete it and say what replaces it. `Enemies.chooseFeats` skipping
   an unknown id "without a word" should fail loudly in sims (a flag; no change in the game).
2. **Tempo measures** in `sim/metrics.js`, for step F: who struck the first blow and whether they won; rounds in
   which a fighter able to reach a foe did not attack ("waiting"); the share of AP spent on the fighter's own turn,
   on reactions, and lost unspent; the win rate by AP rolled that round. Baseline them on the step-1 commands.
3. **`sim/partysize.js`**: clears and heroes dead a fight for parties of 1 to 6 (recruits from `start.yaml` beyond
   the four presets) in the three first areas, so encounter scaling can be judged.
4. **AI-or-rule check** (`sim/aicheck.js`): for a named change (+1 SPD on Beren, +1 Anticipation, Rally held), run
   the paired duel with the AI as is and with the suspect choice pinned by a scripted policy, and report both. Use
   it on the three "AI findings" in `HANDOFF.md` and say for each whether it is the AI or the rule.

**Report.** The tempo baseline (this is step F's "before"), the party-size table, the three verdicts.

---

## Step E. Wounds and life (after A)

**Now.** Life is CON (heroes 5–7; a level-1 goblin warrior 13). Stamina is 4 × CON + STR + SPD + DEX and is the
exertion pool, the blunt hit points, the vigor multiplier and the spell limit. Wounds subtract from attributes
point by point. In the court 74% of hero deaths are blows on a body already collapsed, and a collapsed body has no
armor.

**Change.**

1. **Wound capacity is set by size, not CON.** Every man-sized body has the same number of wound boxes; a big body
   more (`size`), which is where an ogre's toughness comes from. CON no longer adds life. Monsters'
   CON above the human range is converted: to `size` where the creature is big, to armor or a resistance where it
   is tough-skinned, to nothing where it was only padding.
2. **Named wounds by place**, replacing per-point attribute loss: a wound is {place, severity 1–3, kind}. What it
   does is a short table: an arm wound makes that arm's actions dearer and weaker and at severity 3 drops what it
   holds; a leg wound slows and at 3 fells; a head wound stuns and at 3 drops; a torso wound costs stamina each
   round and at 3 drops. Severity comes from damage past armor against a threshold, raised a step by step A's
   vital margin. Bleeding is a property of a wound. No rolls per point.
3. **What CON does instead:** resists shock (staying up at a severity-3 wound), bleeding, poison, disease and
   fatigue; sets regeneration with WIL. **What WIL does:** acting through pain (ignores the action penalties of
   wounds up to a number set by WIL), coming round from a collapse, fear, spent actions.
4. **Stamina is exertion only.** Blunt that doesn't break anything costs stamina as a small fixed "winding"
   by severity, not point for point. The formula loses its 4 × CON: stamina is the same order for everyone, with
   CON and WIL setting how fast it returns. `staminaScale` and the ×3 on regeneration are folded into plain numbers.
5. **Down before dead.** Filling the wound boxes, or a severity-3 wound that shock doesn't resist, takes a fighter
   *down* (out of the fight, bleeding or not). Death is a down body left bleeding past the fight, or one that is
   struck again on purpose. A down or collapsed body keeps its armor. The AI's finishing of the down is a trait
   (`finishes: true` on beasts that feed, the cruel, the undead), off by default. Medicine and Give + Life act on
   wounds (stop bleeding, lower severity), which also answers the play note that healing can't prevent death.
6. Toughness (the feat) is deleted or remade as mitigation in step J; here it stops adding life.

**Targets.** Heroes dead a fight ≤ 0.15 with heroes *down* a fight about 0.5; a party of 3 clears a first area in
one go at least 18 times in 30; a survivor carries a wound in at least a third of fights; the wounded twin loses
clearly for arm and leg wounds alike (`sim/spiral.js` rewritten on wounds).

## Step F. Tempo (after A and D)

**Now.** AP = 1 + d3 + SPD/2, rolled each round; turns go in order of AP rolled; costs are in half APs on a curve
(`apCurve`); reactions come from the same pool; closing provokes. Step D's measures say how much waiting wins.

**Decide by prototype, in this order.**

1. **F1, the cheap version:** no AP die (pool = a whole number from SPD, 3 to 5), whole-number costs (quick 1,
   standard 2, heavy 3; weapon speed moves a weapon between classes, not by fractions), `apCurve`, `apStep`,
   `quickCut` and `armorActionAP` replaced by class shifts. Order of turns by SPD with a d10 tie-break, rolled once
   a fight.
2. **F2, a reason to act first:** try each, measured on step D's tempo measures, and keep what makes the first
   blow worth having without making it decisive: (a) a fighter who has not yet acted this round reacts at +1 cost
   (caught flat); (b) *pressing*: a defender who defended against you this turn defends your next blow this turn
   at −1 (a chain rewards committing); (c) the first step into reach of a foe you attack this turn does not
   provoke from that foe (a charge).
3. **F3, the clock, only if F1 + F2 don't meet the targets:** each action costs ticks; the lowest clock acts
   next; reactions push your clock back; no rounds, so every "per round" rule (regeneration, conditions, bleeding)
   needs a period in ticks. Build it as a sim prototype first and report before touching the UI.

**Targets.** The first to strike wins 50–60% of even duels (not under 50); waiting rounds under 15%; AP lost
unspent under 10%; the wounded-SPD twin loses; every Quick feat rank changes something a player can see.

## Step G. Damage by role (after A and E)

**Now.** The thrust is cheaper per AP (6 P for 2.5 AP against 7 S + 3 B for 4.5), reaches a square farther, aims
at −1, goes to CON and triples on a vital. A rapier's thrust equals a longsword's.

**Change.** Each kind is best on its own ground and about equal per AP there:

| Kind | Best against | Weak against | Its wound |
|---|---|---|---|
| Cut | bare flesh and cloth | mail, plate | wide: severity up a step on bare flesh, heavy bleeding, limbs disabled |
| Point | mail, gaps, the vitals | plate without a gap; bone (skeletons) | deep: vital at lower margin, narrow bleeding |
| Crush | plate, bone, shields | padding | winds and breaks: stamina, stagger, knockdown; works through armor |

Costs come from the weapon's speed class (step F), not the motion; reach is the weapon's, with a thrust's extra
square kept only for weapons built to thrust (spears, the rapier, the estoc). The swing's sweep (R8) stays as the
cut's and the crush's answer to numbers. Target: no action above 40% of blows landed across the three first
areas, and each weapon family chosen first somewhere.

## Step H. Armor's answers as gear and technique (after G)

Half-swording and the murder stroke become options of any longsword or greatsword (dearer, shorter reach).
The pick, the warhammer's beak, the rondel, the estoc and the bodkin are the purchases that answer plate; a
grapple to a pin with a dagger in the hand finishes an armored man and must work in the plate mirror (it times out
now). Find the Gap stays a feat only as the difference between competent and expert. Target: the plate mirror
ends inside 12 rounds in 90% of fights; a party that brought the right gear beats plate that a party of higher
level without it does not.

## Step I. Attributes and skills (after E and F)

**The user's correction (2026-11-14):** not every attribute needs a use in a fight, because not everything will
be a fight. All eight stay. INT and WIL should gain combat roles; WIS and CHA may live mostly in the other
settings, and the roles named here are not the last ones they will have.

| Attr | In a fight | Elsewhere (hooks to keep) |
|---|---|---|
| STR | force of a blow, strain, grapples, shoves, carrying armor | forcing, intimidation |
| CON | shock, bleeding, poison, fatigue, regeneration (no life) | weariness over a day, disease, hunger when built |
| DEX | precision: margin for placement and vitals, the parry | devices, stealth |
| SPD | the AP pool, movement, the dodge | pace, getting away |
| INT | knowing the foe: with Lore or a topic learned, the panel shows a creature's armor, weak places and habits, and blows at a known weakness gain margin; a caster's control | magic, lore, appraisal, plans in a parley |
| WIL | acting through wounds, coming round, fear, spent actions, resisting magic | magic, resisting pressure in a parley, watch through the night |
| WIS | surprise and ambush (who acts in the first round), reading a feint (Anticipation) | perception, traps, insight, nature |
| CHA | Bait, Rally and Command, morale of foes (a broken side flees or yields) | parley, prices, followers |

**Skills.** Dodging needs one skill, not two (Evasion; Anticipation keeps reading, surprise and insight). Arcane's
unlocks are split as `docs/FEATS-AUDIT.md` F11 recommends once casters can be measured. The three craft skills
stay as hooks for exploring. **The die:** on step A's margin report, choose between a d10 with skill gaps scaled
down and 2d10 (a bell, so a +1 matters most in an even fight), and re-derive the defence numbers once.

## Step J. Feats (after E to I)

Cut to the feats that grant an action, a reaction or a broken rule (about 40 for combat). Every number goes to the
skill that governs the action; techniques that belong to a weapon are the weapon's (step H). Write no capstone
until its branch is a way of fighting by `docs/FEATS-AUDIT.md` §3.5's test. `skills.retired` carries old saves.
Measured with a party sim, not duels, for ally and crowd feats.

## Step K. Housekeeping (after each of A, E, F)

Delete every switch whose other position is the old rule (`defense.opposed: false`, `parryForce`, `closeRule`
alternatives, `block.tn`, `initiativeDie`…), the `asWritten()` cases they served, and the `CONFIG.provisional`
entries that describe deleted rules. Move dated history out of comments. Target: `CONFIG.provisional` under 40
entries, each a rule that exists.

## After the overhaul

Re-run `tools/tiers.js` for every placed monster, then the campaign crawl. The design docs (Mechanics Outline,
Specifics) are rewritten from the code, once, at the end.
