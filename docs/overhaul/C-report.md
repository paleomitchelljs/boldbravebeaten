# Step C report: traps as terrain

Branch `overhaul/C-traps`, from `bd310877`. The plan is `docs/OVERHAUL.md` step C.

## What changed

The old trap (one passive Perception roll; walked onto, a random front-rank hero took `damage: {CON: 2}` with no
armor, save or choice) is gone, with its `damage` key and its code. A trap is now one object exploring and fighting:

- `src/rules/traps.js` (new, rules layer, no world): the trap as a striker (a featless, tireless pseudo-character);
  the blow as a weapon option; the get-clear roll for one who knows it is coming; `strike` (the blow through
  `Combat.applyHit`, an element through `Magic.elementBlow`); `victims` by marching order; `springInFight`;
  `rearm`; `describe`.
- `src/game/explore.js`: finding by degrees (passive from two squares off and again beside it; search), the
  ways past (`trapWays`, `trapAct`), the springing on the party (`springTrap`, `strikeParty`), lid traps on chests.
  `Explore.move` and `Explore.act` return `pending` (a promise of the harm's log events) when a trap springs,
  because `applyHit` is async and the explore calls are not.
- `src/game/battle.js`: `layTraps` puts live traps in the fight's field as hidden `trap` terrain;
  `writeBackTraps` marks on the map what sprang (and that the party now knows it) when the fight ends; joiners
  who know a trap make it known to their side.
- `src/rules/terrain.js`: a `trap` feature springs in `enter` (with `how`: `'driven'` from `Magic.push`, the
  one-word change in `magic.js`); `visible` reads `f.knownBy`; `avoid` and `danger` count a live, visible trap like a
  pit; `endRound` re-arms traps with `reset.rounds`.
- `src/rules/ai.js`: step 5a, shove a foe onto a pit, lava or a live trap my side can see (odds ≥ 0.35); step 8b,
  wait behind a trap my side knows and the foe can't see (the foe 2–4 squares off), so they come over it.
- `src/rules/config.js`: `terrain.trap`, and the provisional entry (before "Monster tiers").
- Data: `rules.yaml game.traps` (PROVISIONAL numbers) and `searchBonus`; two checks in `skills.yaml` (`leap`:
  STR, SPD, Athletics, armor penalty; `edge`: DEX, SPD, Athletics, armor penalty); a `pole` good, sold in
  Stonebridge's market; the eight traps; the legacy test fixture's four traps migrated.
- UI: the explore screen's face prompt lists the new ways (with odds where there is a check), shows the working when
  known, and handles `pending`; a trap stops a click-walk. The battle screen marks a visible trap `⚠`.
- `combat.js`: not touched.

## The schema

Documented in `docs/DATA.md` ("A trap"), checked by `Content.validate` (`trapOk`). In short:

| Key | |
|---|---|
| `tn` | Perception target. Margin −3 the tell, 0 the square, +3 the working (`game.traps.find`). |
| `tell`, `how`, `text` | What gives it away; how it works (shown at the last degree); what is seen when it springs. |
| `reveal` | A condition: known to the last degree without a roll (lore, a parley topic). |
| `trigger` | `step`, `wire`, `plate`, `lid`. Decides which ways of springing it from off it work. |
| `effect` | `blow {damage [P,S,B], motion, punch, aim, wound, venom, name}`; `element {noun, mag}`; `terrain` (+ `terrainRadius`, `rounds`); `to`/`at` (a drop); `radius`; `who` (`lead`, `next`); `dodge: false`; `block: false`. |
| `strike` | TN to get clear for one who knows it is coming (default 13). |
| `reset` | `{minutes, rounds}`. |
| `knownTo` | Factions or monster ids: walk it safely, path round it, see it in a fight. |
| `disarm` | Trapcraft TN (+2 while the working is unknown). Absent: can't be disarmed. |
| `bypass` | `leap`, `edge`, `spring` (= `pole`, `stone`, `shield` as the trigger allows), `mark`. |

## Finding, and the ways past

| Degree | Margin | What the party gets |
|---|---|---|
| nothing | < −3 | nothing |
| the tell | −3 to −1 | the `tell` text, no square. The party walks on wary: whoever sets it off gets the get-clear roll. |
| the square | 0 to +2 | it stands in the way (solid on the map); ways past offered; disarm at +2 |
| the working | ≥ +3 | `how` and a line of what it does; stone and shield offered (they need the trigger known) |

`reveal` gives the last degree without a roll. Ways past, each with its minutes (`game.traps.ways`): disarm 10
(Trapcraft; a fumble springs it on the disarmer, who gets the get-clear roll at −3); leap 1 and edge 3 (each member
in marching order rolls; the first to fail sets it off, at −3; the party ends past it); a pole 2 (needs the good),
a stone 1 (a wire only), a shield 1 (a step, plate or wire; the bearer walks on with +3 to the block): all loud
(wanderer noise, wakes sleepers within 6); mark 1 (leave it; it stays live, and a fight on the map can use it).

A sprung trap's victim is the first active member in marching order (the party's order), or the second for
`who: next`, or all for a radius; the blow is `Combat.applyHit` with the location `aim` names (else rolled), so the
armor there counts. Hero mode: `hero` is set on the victim as in a fight.

## The traps placed

| Where | Square | Kind | Trigger | Effect | knownTo | A fight on it |
|---|---|---|---|---|---|---|
| ember_hall `A` | (3, 4), the entry stair | swinging blade (migrated) | wire | cut [0,10,4] at the torso; resets (10 min, 2 rounds) | cinder_goblins | the murder hole archer |
| ember_hall `B` | (15, 6) | spike plate | plate | [4,0,1] punch 1.2 at the legs; resets | cinder_goblins | the bubbling-cavern goblin (`h`, "it knows where the floor is sound") |
| ember_hall `F` | (19, 29) | fire vent | plate | Fire 4, radius 1; hot ground 3×3 for 3 rounds | cinder_goblins | the patrol (`p`) |
| ember_hall `C` (chest) | (11, 61) | needle in the lock | lid | [1,0,0] at the arm, venom 1 for 2 rounds | – | – |
| ember_warrens `T` | (40, 2) | tipping floor (migrated) | plate | fall [0,0,6]; a pit; drops the party to ember_pit | cinder_goblins | – |
| orc_valley `D` | (38, 13), the bridge's end | staked pit | step | [5,0,2] punch 1.5 at the legs; a pit | orc_legion | the gate guards (`g`) |
| temple_court `S` | (4, 15), inside the gate | sapling spear | wire | [5,0,1] punch 1.6 at the torso | suracayl | the gate guard (`g`) |
| temple_court `D` | (15, 28), before the labyrinth door | deadfall | plate | [0,0,18] crushing at the head | suracayl | the labyrinth door guards (`l`) |

Six of the eight are inside the field of a fight that the crawl sims play (the arena is the whole map).

## What each does to Beren (plate), Cyrus (padded head and torso) and Jabiku (padded) at level 1

Expected harm, 400 springs each, seed 4242, the hero fresh each time. "attr" is attribute points lost (of which CON),
bleeding bound by a bandage as `World.breather` does after a trap, venom left to run. "st" is stamina.
(`scratchpad/harm.js`, not committed.)

Unaware (walked onto it unseen):

| Trap | Beren | Cyrus | Jabiku |
|---|---|---|---|
| orc_valley staked pit | 0.00 attr, 1.0 st | 6.17 attr (3.90 CON), 15.2 st, 14% dead | 2.02 attr (1.04 CON), 5.2 st |
| temple_court sapling | 0.00, 0.0 st | 2.44 (2.44 CON), 9.0 st, 7% dead | 2.38 (2.38 CON), 8.9 st, 5% dead |
| temple_court deadfall | 3.00 (1.00 CON), 19.0 st | 3.00 (0.99 CON), 19.0 st | 3.00 (0.97 CON), 18.9 st |
| ember_hall blade | 0.00, 0.0 st | 1.00 (0.49 CON), 6.5 st | 1.00 (0.54 CON), 6.6 st |
| ember_hall spikes | 0.00, 0.0 st | 4.00 (2.04 CON), 11.1 st | 1.46 (0.71 CON), 3.6 st |
| ember_hall fire vent | 1.00 (1.00 CON), 5.0 st | 1.00 (1.00 CON), 5.0 st | 1.00 (1.00 CON), 5.0 st |
| ember_hall needle (lid) | 0.00, 0.0 st | 3.00 (2.34 CON), 10.0 st | 0.61 (0.50 CON), 2.1 st |
| ember_warrens tipping floor | 0.00, 3.0 st | 0.52 (0.17 CON), 5.6 st | 0.00, 3.0 st |

Knowing it is coming (the tell seen, a fumbled disarm before the −3, a shield held over before the +3): the share
who get clear is Beren 78–83% where a shield can take it and 0% where it can't (spikes from below, a pit, fire, the
needle), Cyrus 65–74%, Jabiku 16–24%. With that, Cyrus's staked pit falls to 1.79 attr and 4% dead; Jabiku's sapling
to 1.88 attr.

Armor shows: plate turns every point and edge here (Cyrus's bare legs take the pit and the spikes, his bare arms the
needle). Two things it does not turn, by the engine's own rules: fire (armor stops only part of an element), and a
crush past the threshold (the deadfall breaks bone through a plate helm as through a padded hood: 3 points each;
plate's `dissipate.crushing` is 0). Whether a helm should matter more against a falling block is a question for
step G (damage by role), not for traps.

## Measured before and after

`node sim/crawl.js <place> --party 3 --n 30 --seed 4242` on `bd310877` and on this branch:

| Place | Cleared before → after | Heroes dead by the last fight | Notes |
|---|---|---|---|
| temple_court | 16/30 → 16/30 | 0.81 → 0.76 | fights 2–3 cheaper (0.87 → 0.50 dead after fight 2), fight 4 (the labyrinth door, on the deadfall) won 100% → 76% |
| ember_hall | 1/30 → 1/30 | 1.67 → 1.75 | the middle fights (5–8, the spikes and the vent) cost more: dead after fight 6, 0.50 → 1.09; kicks landed 9% → 17% of blows |
| orc_valley | 11/30 → 14/30 | 1.53 → 1.57 | fight 1 (the gate, over the staked pit) won 93% → 87% |

With n = 30 the differences in clears are inside the noise (a 3-in-30 change is about one standard error). The
direction is what the step aims for: the goblins' hall, where they know three traps, got harder in its middle; the
court and valley moved little. The crawl teleports the party to each group, so it measures traps only as fight
terrain, never the exploring side. The rise in kicks in the hall is not explained: possibly 5a's shoves being
declined and the AI falling back, possibly noise; I did not test it.

Only the crawls were run: traps touch no duel, spiral or swarm (those have no map traps), so `sim/duels.js`,
`sim/spiral.js` and `sim/swarm.js` were not rerun.

## Tests

`tests/traps.test.js` (11): each degree of finding; reveal; the prompt's ways by what is known and carried; disarm
(success, and a fumble springing it on the disarmer); leap and edge (past it, and the first short one in marching
order taking it); pole, stone, shield, mark; walked onto unseen, the first in marching order takes it, and `who`/
`radius`; plate against padding (sapling: Beren < 0.2, Cyrus > 1.5 expected harm); a `knownTo` group walking its own
trap safely and pathing round it, and springing it when driven on; a foe shoved onto a trap the party found; the AI
shoving onto a trap it knows (and not without it); a fight on the map laying the trap hidden and writing back what
sprang. `tests/game.test.js`'s old trap test is rewritten for the new rule.

## What I could and could not look at

I looked at the face prompt for the sapling trap in headless Chrome (my own server on another port: 8765 was serving
another worktree): the card shows the working and six ways, with odds on disarm and leap, and lays out cleanly. I did
not look at a trap springing in a fight on the battle screen, the `⚠` mark, or the tell's log line in the browser.
The fake-DOM suite renders the screens without error.

## Art wanted

The new traps use existing sprites: the sapling and the deadfall have none and draw the spike plate. Wanted: a
bent-sapling snare (armed and sprung), a deadfall stone in an arch, and a turf-covered pit (`pit_hint` stands in).
A mark for a trap the party has marked, and something for a trap whose tell was seen but not its square.

## Decisions the plan did not settle (my calls; the user may overrule)

1. **Who gets a defence.** The plan says "armor, shield and location count". A trap has no attacker roll, so I gave a
   get-clear roll (dodge, or a ready shield where `block` allows) only to a victim who knows it is coming: the tell
   seen, a fumbled disarm, a short leap, a shield held over. An unseen trap gets no roll. Strike 13 makes the roll
   real for a skilled dodger (Cyrus ~70%) and poor for a mage (~20%).
2. **The tell's use.** Degree 1 gives no square but makes the party wary (that roll). Without a use the degree would
   only be text.
3. **`knownTo` both walks safely and paths round.** The plan says both; I did both. Driven onto it, its own people
   spring it. A grapple throw (`combat.js` `throw`) doesn't pass `'driven'`, so a thrown goblin onto its own trap
   walks it safely: I left `combat.js` alone.
4. **Baiting** is the AI waiting behind its trap (8b), not the Bait maneuver.
5. **Leap and edge** are rolled by every member in marching order, with armor's penalty: plate makes leaping a trap
   hard, which is the point.
6. **Stone is always to hand**; a pole is a good bought in town (2 gold).
7. **A drop (`to`) in a fight** is a pit for the fight; the victim does not leave the map.
8. **Explore's API**: `move` and `act` return `pending`. Callers that ignore it still get the harm (the promise
   runs on the same tick's microtasks), but not its log lines.
9. **A lid trap** on a chest uses the same schema; the chest's `trap` key was documented before but never built.
10. **Reset** is `{minutes, rounds}` rather than one number, since a round and a minute differ.
