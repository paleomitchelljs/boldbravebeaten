# Step F report: the clock (2026-11-16)

Branch `overhaul/F-clock`, from main at 5e30e958. F1 (rules, AI, sims), F2 (the battle screen's timeline) and F3 (saves,
the exploring layer's callers, `docs/DATA.md`) are all in.

## For the user to confirm: the terminology

`CLAUDE.md`'s table now reads **tick** (the unit), **action** (one thing done, with a lead and a recovery; waiting is
one), **reaction** (as before, paid in ticks on the reactor's clock), **beat** (the timeline's period for bleeding,
regeneration and durations). The words are used in code, data and the UI. Round, turn and AP are gone everywhere but
history notes. You have not answered the plan's proposal yet: say if any of the four should be another word.

## What changed

**The engine** (`src/rules/combat.js`). Every fighter has a clock (`enc.clock`); whoever's is lowest chooses one
action (`phase 'act'`, `enc.actor`); its ticks go on the clock. Ties: higher SPD, gear's `init`, then a d10 rolled once
at `Combat.begin` (which replaces `startRound`). An action with a lead is committed (`enc.pending`, `enc.committed`) and
lands when the lead is up (`landAction`); in between others act. Knocked down, grappled, disarmed or put down, it is
spoiled (`Combat.spoil`, which replaces `loseWindUp`). Reactions (block, parry, dodge, cover, opportunity strike,
riposte, Iron Grip, Human Shield) put their ticks on the reactor's clock (`pushClock`); more than `overreach` ticks ahead
of now, a fighter is offered none (`canReact`). A block or parry rebounds onto the attacker's clock. Waiting is an action
(`{type: 'wait'}`): until the next thing happens (another's action, a landing, a beat), until just after a named fighter
has acted (`for`), or by n ticks (`ticks`); a waiting fighter can react, and a reaction ends the wait. Every `beat`
ticks the timeline runs `Combat.beat`. The game's hook on the beat (`io.onBeat`, `Battle.onBeat`) brings in joiners and
checks getting away (phase `'away'`). `Combat.foresee` gives `timing`: ticks, lead, when it lands, whether the attacker
can still react after it (`react`), and `open` when the target is too far ahead to react (then no defences, and it
lands).

**Costs** (`src/rules/character.js`): `ticksFor`, `leadOf`, `moveTicks`, `pace`, `squaresIn`, `spdFactor`,
`armorTicks`, `quickTicks`, `tempo`, `fatigueShare`, `exposesMotion`; `actionCost` returns `{ticks, lead, stamina}`, an
attack option carries `ticks`, `lead`, `exposes`. Deleted: `apPool`, `projectedPool`, `apScale`, `costScale`,
`quantAP`, `fmtAP`, `minAP`, `baseAP`, `armorAP`, `quickCut`, `moveCost`, `squaresFor`, `squaresPerAP`, `gearAP`,
`fatiguePenalty`, `needsWindUp`, `weaponApLess` (now `weaponTicksLess`), `wearyRound` (now `wearyBeat`), `roundRegen`
(now `beatRegen`).

**The AI** (`src/rules/ai.js`) chooses one action at a time. It sees the timeline: everyone's clock, a committed
action and when it lands (never intentions). `rate` is value per 2.5 ticks (the old AP's worth, so thresholds keep
their size); `timing()` weighs a blow's lead against the target's clock (×0.8 if the target acts before a melee blow
with a lead of 2+ lands, ×1.3 if it can't react when it lands, ×1.1 if it is committed with block and parry closed);
`bareAfter()` replaces the AP reserve (×0.85 on an action that takes it past overreach while a foe who can reach it
acts first); a defence costs 0.4 a tick and a little more if it takes the defender past overreach; Bait's worth is
reckoned over the ticks to the next beat (baited lasts till then); Rally's over fatigue steps; Command's over the ticks
it gives. Waits are tagged with a reason (`why`: winded, held, feigning, trap, nothing better). Wind-up logic is gone.

**Elsewhere.** Conditions, terrain features, conjured creatures, prepared spells, traps' reset, venom, collapse and the
revive window count beats (`beats`, `beatsMult`, `diedBeat`, `collapsed.beat`). `Conditions.endRound` → `beat`,
`Terrain.endRound` → `beat`, `Magic.endRound` → `beat`, `Combat.endRound` → `beatBodies` (the body's beat is
`beatBody`). Standing orders (`src/game/orders.js`) no longer check a budget (the engine offers nothing to a hero past
overreach). `Battle.start`'s surprise is ticks (`CONFIG.clock.surprise`, doubled by an ambusher). `Auto.play`/`battle`,
`sim/lib.js` (`play`, `beatsOf`), `sim/crawl.js`, `sim/sweep.js`, `sim/aicheck.js` (the noBareApproach pin now: no move
into a foe's reach whose clock comes before mine; "turn first" is now "acted first in a beat"), `sim/run.js` (endurance
in beats), the print sims; `sim/ap-rounding.js` deleted (AP rounding is gone).

**Saves.** Version 9. A character's conditions, prepared spells, conjuring, collapse and death stamps go from rounds to
beats; a wind-up is dropped. A battle saved in rounds and AP (`Save.toClock`, also used by the GM table's store) starts
the clock afresh where everyone stands. `tests/save.test.js` checks a version-8 save.

**Data.** `data.js` MOTIONS and ACTIONS carry `ticks` and `lead`; shields `blockTicks`; bows `shootTicks` and
`draw.ticks`; spells' shapes and modifiers `ticks` (Strong is `gather`); enchantments `ticksLess` and `effects.ticks`;
monsters' `traits.tempo` (was `apMult`); the silk sash `ticks: -2`; `rules.yaml` arm wounds `ticks`; every `rounds:` is
`beats:`, terrain `perRound` is `perBeat`. `docs/DATA.md` follows.

**Deleted config keys:** `apScale`, `apDisplay`, `costScale`, `apStep`, `apBase`, `apDie`, `apSpdDivisor`,
`apSpdContinuous`, `apCurve`, `moveAP`, `wholeTurnAction`, `defer`, `armorActionAP`, `quickCut`, `moveScale`,
`moveSpdContinuous`, `minActionAP`, `minStrikeAP`, `veryLightApDiscount`, `initiativeDie`, `windUp` (whole),
`defense.rebound` (moved), `maneuver.proneDefenseExtraAP`/`grappledDefenseExtraAP` (now `…Ticks`), `standUp.ap`,
`web.ap`, `magic.castAP`, `conditions.*.ap`/`drainAP`, `stamina.collapse.rounds`, `social.readIntent.rounds`,
`magic.revive.rounds`, `weariness.perRound`. `CONFIG.provisional`: deleted the entries for half APs, AP rolled, Defer,
wind-ups (two), the turn budget, rounds and turns, initiative, trip/disarm AP, daggers' −1 AP; rewrote armor, reactions,
prone, getting up, movement, read intent and others; added six for the clock (111 entries now, was 110).

**New keys (all PROVISIONAL, listed in `CONFIG.provisional`):**

| Key | Value | What |
|---|---|---|
| `clock.spd` | `{base: 3, per: 0.5}` | cost × (3 + 2.5) / (3 + SPD/2): the old pool's SPD share |
| `clock.armor` | 0.5 | ticks an action a point of armor's SPD penalty (mail +0.5, plate +1.5) |
| `clock.quick` | 1 a rank (Heavy Tempo 2) | Quick feats in whole ticks |
| `clock.stretch` | 5 | ticks a stretch of a move (`pace` squares) |
| `clock.min` | 1 | no action under a tick (dropping: 0) |
| `clock.exposes` | power, bows, Strong spells; guards block, parry | committed and unable to block or parry |
| `clock.overreach` | 10 | past this many ticks ahead, no reaction |
| `clock.beat` | **14** (TUNED, started at 20) | the beat |
| `clock.surprise` | 10 | ticks a surprised side starts late |
| `clock.die` | 10 | the tie-break die |
| `clock.rebound` | block 1/3, parry 1/6, perRank 1/6 | ticks a blocked or parried blow costs its attacker |
| `clock.command` | 3 | ticks Command gives |
| `clock.moveMax` | 14 | the longest move, in ticks |
| `clock.veryLight` | 2.5 | the table model's very light weapons |
| `fatigueSteps` | +20% below ½, +40% below ¼ | of every action's ticks |
| `magic.castTicks`, `lead`, `gather`, `joins` | 5; 0.2; {ticks 2.5, lead 0.5}; 10 | casting |
| `conditions.slowed/shocked/withering.ticks` | +2 | hasted −2, concentrating +1; stunned `stagger` 5 |
| `standUp.ticks` | none/padded/leather 3, mail 5, plate 15 | half of it lead |
| `web.ticks` | 3 | a layer |
| `disengage.outrun` | 3 beats | was 4 rounds |

## The cost table, in ticks (STR 7 unless the hero's own)

Base: thrust 5, swing 10 (the standard), two-handed 15, power 15, parry 5, dodge 5, block by shield (buckler 2.5,
round and heater 5, tower 10), punch 2.5, kick 5, shove 5, trip and disarm 10, clinch 5, grapple, pin and throw 10,
bandage 10, draw a weapon 1.25, bait 2.5, read intent 1.25, a move 5 a stretch. The old costs were carried over as they
were at the old curve (an AP on the curve = 2.5 ticks), so nothing changed its price against anything else.

A cost below is `ticks` or `ticks/lead` (SPD 5, unarmored):

| Weapon | Thrust | Swing | Two-handed | Power |
|---|---|---|---|---|
| dagger | 4 | 7/2 | – | – |
| rapier | 5 | 9/3 | – | – |
| shortsword | 4 | 9/3 | – | – |
| longsword | 6 | 10/3 | 15/6 | – |
| spear | 5 | – | – | – |
| flanged mace | – | 9/3 | – | 14/7 |
| greatsword | 7 | – | 18/7 | 18/9 |
| great axe | – | – | 16/6 | 16/8 |
| warhammer | – | 10/3 | 15/6 | 15/8 |
| shortbow, longbow | shoot 8/3, 15/5 | | | |

| SPD | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|
| longsword swing | 12/4 | 11/3 | 10/3 | 9/3 | 8/2 | 8/2 | 7/2 |
| longsword thrust | 7 | 6 | 6 | 5 | 5 | 5 | 4 |

| Armor | none, padded, leather | mail | plate |
|---|---|---|---|
| swing / thrust / parry / a square | 10 / 6 / 5 / 2 | 11 / 6 / 6 / 3 | 12 / 7 / 7 / 5 |

Quick feats: Quick Thrust 0–3 on a longsword 6, 5, 4, 3; on a rapier 5, 4, 3, 2. Quick Parry 0–2: 5, 4, 3. Heavy Tempo
0–2 on a greatsword's two-handed swing: 18, 16, 14. Fatigue: +20% and +40%.

The presets: Beren (SPD 5, plate) thrust 7, swing 11/3, parry 6, dodge 6, block 5. Lorc (SPD 7, leather) longbow 13/4,
parry and dodge 4. Cyrus (SPD 9, padded, Quick Thrust) thrust 2, swing 7/2, off-hand thrust 2, parry and dodge 4.
Jabiku (SPD 5) staff thrust 5, two-handed swing 69/28 (the staff strains her badly, as before).

## Every former "each round" use, and its period now

| Use | Now |
|---|---|
| bleeding, a torso wound's drain (`beatBody`) | each beat |
| regeneration (struck: a share), Second Wind, hero regen | each beat (`struck` this beat) |
| conditions' harm over time and durations | each beat; durations in beats, the same numbers |
| regrowth (unless burned this beat) | each beat |
| weariness by effort | each beat (stamina at the beat's start) |
| a collapse running its course | `collapseBeats` (2 − ⌊WIL/5⌋) beats after the beat it began in |
| hold upkeep, constriction | each beat |
| webs loosening | each beat |
| the revive window | `revive.beats` (2) after the beat of death |
| terrain's harm (lava, fire walls, miasma…), features counting down | each beat (`Terrain.beat`) |
| Delayed spells breaking | at the next beat |
| conjured creatures fading, the raised falling with their caster | each beat (`Magic.beat`) |
| traps resetting (`reset.beats`) | in beats |
| auras | at the start and each beat |
| groups joining (`Battle.reinforce`) | at the start and each beat (`Battle.onBeat`) |
| getting away (`Battle.disengaged`) | each beat (the game screen); `outrun` 3 beats |
| wind-ups lapsing | gone (no wind-ups) |
| `enc.round` in the log | `tick` and `beat` on each line |
| `hitThisRound` | `enc.struck`, reset at each beat |
| `burned`, `fortressUsed` (Living Fortress once a round) | reset at each beat |
| `dodged` (Untouchable's free dodge) | reset at each beat |
| `fled` (fear's owed step) | each beat's first action |
| `charging` (Charge) | the next action after the move |
| `counterStep` | a window of one beat's ticks after the dodge |
| `rallied`, Rally once a round | once a beat |
| `declared(standUp/pickUp/release/tearFree/feign)` | gone (each is one action; a lead holds the fighter) |
| surprise "round 1" | a start offset; "caught off guard" until the side's first action |
| `conceded` (joins act next round) | `Combat.enter`: a joiner comes in 10 ticks (summons) or half a beat (groups) later |
| `canWindUp`, `attackUnavailable`'s wind-up reasons | gone |
| AI: `apWorth`, `reserveAP`, `apGuess`, `seemsSpent`, `turnDone`, `acted`, edge/wariness rounds, walk-field cache | a tick's worth; `bareAfter`; the clock; beats |
| `settleFallen` | when the fight ends (unchanged) |

## Before and after (seed 4242; party of 3, 30 crawls a place; duels n 40, mirrors n 200)

Before is main at 5e30e958 (step E merged), measured on an untouched copy. "Waiting" before was a share of turns; after it
is a share of decisions and, the plan's measure, a share of time.

| Target | Measure | Before | After |
|---|---|---|---|
| First to strike wins 50–60% of even duels | mirrors, first blow landed: its side won (pooled) | 77% ± 2 | **75% ± 2** |
| | Beren mirror | 58% ± 6 | 67% ± 5 |
| | Lorc mirror | 60% ± 4 | 50% ± 4 |
| | Cyrus mirror | 98% ± 1 | 100% |
| | Jabiku mirror | (all time out) | (all time out) |
| | ten pairings (not even) | 61% ± 2 | 75% ± 2 |
| | crawls court, hall, valley | 87, 65, 76% | 78, 69, 74% |
| Under 15% of the fight waiting with a harmful blow in reach | court, hall, valley, duels (time) | (turns: 6, 20, 11, 4%) | **12, 13, 7, 0%** (decisions: 30, 7, 3, 1%) |
| | deliberate waits / idle, share of all ticks | – | court 6% / 1%, hall 1% / 8%, valley 0% / 9%, duels 0% / 6% |
| | why (court) | – | winded 587, nothing better 4 (heroes) |
| Heavy blows' share no lower | court, hall, valley, duels, mirrors | 25, 14, 18, 0, 16% | 27, 15, 16, 0, 21% |
| | actions with a lead spoiled | wind-ups 5, 8, 2% | 3, 5, 3% |
| Median fight length in beats about the old rounds (3–5) | court, hall, valley; duels | rounds 3, 4, 6; 3 | **beats 3, 3, 4; 2** |
| | 90th percentile | 10, 13, 14; 5 | 7, 11, 12; 4 |
| Wounded-SPD twin loses, falling with the wound | `sim/spiral.js` legs | see below | see below |
| Level 8 vs N level-1 loses at about N = 4 | `sim/swarm.js` all heroes | 87 62 38 22 11 10% | see below |
| Beren's +1 SPD no longer a penalty | `aicheck spd` Δ as is | −0.4 ± 2.1 | see below |
| (context) cleared of 30 | court, hall, valley | 28, 12, 11 | 23, 17, 11 |
| (context) heroes down / dead a fight | court, hall, valley | 0.20/0.00, 0.27/0.05, 0.97/0.31 | 0.27/0.02, 0.12/0.02, 0.69/0.26 |
| (context) duels: deaths a fight; timeouts | | 0.65; 0% | 0.58; 2% |
| (context) mirrors timing out | | 41% | 39% |

SPIRAL_SWARM_AICHECK

**Reading the first-blow numbers.** The pooled mirror is 75%, outside 50–60%, but it is not the clock's doing on the
whole: it is Cyrus. In his mirror the first thrust that lands decides the fight 100% of the time (195 of 195; it was 98%
before): a rapier point into a padded arm or leg is a severity-3 wound (87% of the downing blows), shock and down. That is
step A/E's damage (a point through padding), and step G's to settle (damage by role), not tempo. Without Cyrus the
decided mirrors pool to (67% × 89 + 50% × 165) / 254 = 56%, inside the band: Beren's plate mirror rose from 58 to 67
(a first landing blow on plate is a rare, telling one), Lorc's fell from 60 to 50 (a drawn bow is now a committed lead,
and the other archer often looses inside it). Jabiku's mirror still times out every time (both winded with a torso
wound, waiting for breath that the drain eats), as before. The ten (uneven) pairings rose from 61 to 75%: in an uneven
duel the better fighter usually lands first, and now more often (no AP die to reshuffle who goes first).

**Acting first is no longer a penalty.** The clock removed the AP-order effect step D found (`aicheck spd`, below).

## The screens (F2), and what I looked at

The game's battle screen (`src/ui/game/screens/battle.js`): a **timeline** in place of the initiative bar. Fighters in
the order their clocks come up, each marker with "now" or "+N" ticks; a committed fighter has a dashed outline and "in N"
(when its action lands); a waiting one "…"; **identical foes share a marker** ("×3 +10": same kind, side and state,
ready within 3 ticks of each other, none committed); the next beat sits in the row where it falls ("beat +14"). The
command pane's head carries a **clock meter**: the band within which the hero can still react (overreach), the chosen
or **hovered** action's ticks over it (red past overreach) and its lead marked, with the words "+6 · lands +2 · can
react" or "no reaction till +5". Committed actions draw dashed lines to their targets on the map. **Wait** replaces End
turn (E); **"Again: …"** repeats the hero's last action when it can still be taken as it was (**R**); Defer and its key
are gone. Reaction cards show each choice's ticks and the hero's "+N" ahead. The top bar shows "Beat N · tN". The GM
table's view (`src/ui/views/battle.js`, whose command pane the game reuses) was ported with it: Begin replaces Roll
initiative, phases `act`/`acting`/`over`/`away`, the roster in clock order.

Looked at with `tools/shot.sh` (a copy on port 8791 serving the worktree): desktop 1280 wide and phone 500 wide, a fight
in the temple court against a kobold band, at the start (heroes acting, surprise on the foes) and 14 virtual seconds in
(foes committed: dashed markers, "in 3"; grouped kobolds "×2 +7"). Fixed from the look: the group count collided with
the clock label; the "⚔" glyph does not exist in the pixel font. **Not looked at:** the reaction card, the clock meter
while hovering, the GM table in a browser, a fight with ten or more foes, the map's dashed lead lines in motion. The fake
DOM tests catch exceptions only.

## The risks the plan names

(a) **Quick weapons interrupting every lead.** Actions with a lead are spoiled 3–5% of the time (wind-ups were 2–8%),
and heavy blows' share held (27/15/16% against 25/14/18%; the valley is a point or two lower, inside the noise of one
side's spears). But quick weapons got quicker: at whole ticks a Quick Thrust rank is a tick off a 3–6-tick thrust (a
quarter to a third, against a sixth before), so Cyrus thrusts every 2 ticks (SPD 9, Quick Thrust I) and his parry is 4.
That compounds the Cyrus mirror above. If it matters in play, `clock.quick` at 0.5 a rank brings it back near the old
share; I left it at the plan's "visible as whole ticks".

(b) **An unreadable timeline.** Grouping keeps the kobold band to one marker for three; a fight with ten I did not look
at. Markers are 38 px, 30 on a phone, wrapping onto a second row.

(c) **Click count.** One action a decision is more decisions than one turn a round, and moves are capped at 14 ticks
(about six squares at SPD 5). Standing orders answer reactions as before; "Again" (R) repeats a blow or a cast; Wait (E)
is one key. I did not count clicks in play.

## What moved the wrong way

- **Court cleared 23 of 30, was 28.** Heroes down a fight 0.27 (was 0.20); collapses that get up 35 of 77 (61 of 98).
  The hall went the other way (17, was 12) and the valley stayed (11). I have not separated why the court fell; the
  winded waits (below) are the likeliest part.
- **Heroes wait while winded.** In the court 39% of heroes' decisions with a harmful blow in reach were waits (17% of
  their time), every one of them "winded": the AI's rule (R2, unchanged) throws a spent blow only if it could finish
  someone, else waits for breath. Before, the same choice ended a turn once; now it is a wait per decision until the
  beat. The time share is under the 15% target in the crawls (12, 13, 7%) but not in the mirrors (38%, Beren's and
  Jabiku's winded stand-offs, as before).
- **First blow decides more in uneven duels** (61 → 75%) and in the Beren mirror (58 → 67%).
- **The Lorc mirror's first-blow rate fell to 50%**, the bottom of the band.

## Decisions the plan did not settle

1. **The beat is 14 ticks, not 20.** The plan said start at 20 (about two standard actions), but the old round held
   5.5 AP, about 14 ticks of actions at the carried-over prices, not 20. At 20 every per-round number (regeneration,
   bleeding, a condition's length) fell by a third against actions taken: a probe (court n 10, duels n 20, mirrors n 60)
   gave the court 3 of 10 cleared at 20 against 6 at 14, heroes' waiting in reach 19% of time against 6%, and fights 2
   beats long. I kept condition durations' numbers (a 3-round condition is 3 beats).
2. **Prices carried over from the old curve** (1 AP = 2.5 ticks; a swing 10, a thrust 5), so step F changes tempo, not
   prices. Step G is where prices move.
3. **Leads**: a thrust, a kick, a punch and a shove have none (they happen now); a swing 30%, two-handed 40%, power 50%,
   a bow its draw, a cast 20%, a Strong spell 50%, bandaging and standing up 50%. Only power, bows and Strong spells close
   block and parry (the old wind-up set).
4. **Overreach 10** (one standard action): after a swing a fighter can still react once.
5. **A wait** with no target lasts until the next thing happens or the next beat; waits for a named fighter end when it
   has acted (the released waiter goes first at that tick). A refused action becomes such a wait.
6. **Moves** resolve at once (no lead) and are capped at 14 ticks of walking.
7. **Surprise** is a start offset (10 ticks; ×1.5 and ×2 against ambushers), not a share of AP.
8. **Command** gives 3 ticks; **Stunned** puts 5 ticks on the clock.
9. **The timeline is in plain sight**: the AI sees clocks and committed actions (not intentions), so the old "the AI
   guesses a foe spent" became exact.
10. **Fights time out at 30 beats** in duels (40 in crawls), as rounds before.

## Commands

```
node sim/crawl.js temple_court --party 3 --n 30 --metrics     # and ember_hall, orc_valley
node sim/duels.js --n 40 --seed 4242 --metrics
node sim/duels.js --n 200 --seed 4242 --mirror --metrics
node sim/spiral.js --n 40
node sim/swarm.js --n 8
node sim/aicheck.js spd --jobs 2
```

VERIFICATION
