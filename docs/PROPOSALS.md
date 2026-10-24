# Proposals awaiting a ruling (2026-10-24)

Each section gives the rule, the options and a recommendation. §1 is ruled and built; §2 step 1 (pieces, unaimed locations, carry-through) is built; steps 2 and 3 await a go-ahead.

## 1. Opportunity strikes: which steps provoke (ruled 2026-10-24: option C, built)

**Now** (`combat.js opportunities`, `CONFIG.opportunityStrikes`): a step that *starts* inside a foe's melee reach
lets that foe strike once per move. So a sidestep that stays adjacent provokes; the step that first enters reach
does not (it starts outside), but the next one does; leaving reach provokes.

**What real fencing suggests** (judgement from the historical manuals' ideas of *measure* and *tempo*, not data):
the dangerous moments are crossing into the foe's measure, where a waiting fighter's stop-thrust meets you, and
turning away. Footwork inside measure is normal and guarded: fighters circle all the time. A step straight back in
guard is the standard safe move, but it gains nothing if the foe follows. A long weapon's advantage is that it
punishes the approach.

| Option | Provokes | Effect |
|---|---|---|
| A. Now | any step starting in reach | Footwork in measure is punished; a spear gets its stop-thrust only on the second step in |
| B. Leaving only (the CLAUDE.md wording) | a step that ends outside reach | Sidesteps and approaches are free; reach weapons lose their stop-thrust: least realistic |
| C. Measure | entering a foe's reach; leaving it; a *second* step within it in one move | One guarded step is free; the approach is where the danger is, so reach matters from the first step |
| D. C plus a guarded withdrawal | as C, but a withdrawal (a step back costing +½ AP) leaving reach doesn't provoke | Disengaging costs time instead of a blow |

**Recommendation: C**, then D if retreat turns out too costly in play. C changes every melee approach (the waiting
side gets the first blow, paid from its held AP; held AP is lost at round's end, so waiting has a price), so it
needs the duel and encounter sims before it goes in. I'm not confident about how the AI will handle it: it may stand
off at the edge of measure. That's realistic, but a sim would show whether fights stall.

## 2. Armor by body part: hit locations (the user chose option C, 2026-10-24)

Step 1 built 2026-10-24 (`rules.yaml locations`, `Items.coversOf`, `Character.armorAt`, `Combat.rollLocation`/`carryCut`, `sim/locations.js`); steps 2 and 3 not. Numbers marked *guess* are placeholders for `rules.yaml`, to be set by sim.

### 2.1 What the evidence says

- **Where people were hit depended on what was covered.** At Visby (1361), Ingelmark counted 456 wounds from cutting
  weapons and 126 from arrows and bolts on about 1,185 bodies; most of the injuries were to the lower body, which the
  excavators put down to shields covering the upper body ([medievalists.net](https://www.medievalists.net/2024/03/medieval-battle-injuries/);
  the museum notes the torso was probably covered by mail and shields: [historiska.se](https://historiska.se/utstallningar/medieval-massacre/)).
  At Towton (1461) the trauma was mostly to the head: 113 wounds on 28 skulls, 73 of them sharp-force, 28 blunt, 12
  punctures ([Strange Remains](https://strangeremains.com/2015/02/11/the-game-of-thrones-written-in-bones-the-battle-of-towton/),
  a secondary source). Bones keep only the wounds that reached bone, so neither count is a full hit table. The
  lesson for the rules: a fixed random location table is wrong. Blows go where the guard and the armor are not.
- **A cut can cross two regions.** Ingelmark describes a man whose lower legs were both cut off, probably by one blow
  (medievalists.net, above). A cut that takes a raised forearm and goes on into the head is the classic case.
- **A thrust meets one point.** It goes where it is aimed, and only a thrust can go for the small gaps inside a
  piece (the armpit, the visor, the groin). The code already models that (the gap roll).
- **A cut's force is spent on what stops it.** An edge that a plate or a mail sleeve turns doesn't carry on into the
  next region at full force; it glances. So "slashes spread across regions" is realistic only as **carry-through**:
  a cut that gets *through* the first region (bare flesh, or cloth and leather it cuts through) carries what is left
  into the next. Spreading every cut's damage over two regions is not realistic.

### 2.2 Locations and the armor slots

Six locations, which are also the six armor slots: **head, torso, arms, hands, legs, feet**. Every other slot (neck,
shoulders, cape, waist, two ears, two rings) holds worn things only. Shoulder armor counts as part of the torso
(or the arms).

A piece of armor **covers** one or more locations: `covers: [torso, arms]` for a hauberk, `[legs]` for chausses,
`[head]` for a helm. A piece takes every slot it covers. That keeps one-piece harnesses possible (a full plate
harness covers all six) and gives an exact migration for old saves and content: `full` = all six, `half` = torso,
arms and legs, `partial` = torso alone.

Each location has a **share** of the body (*guess*: torso 0.40, legs 0.24, arms 0.18, head 0.08, hands 0.05,
feet 0.05). A piece's weight, penalties (SPD, DEX, stamina, regen) and durability are the type's figures × the
shares it covers. A full harness sums to 1, so it reproduces today's numbers exactly, and every armor sim to date
still holds for full armor.

### 2.3 Where a blow lands

Each attack gets a **Location** choice beside it (the user's idea), with an **Unaimed** entry:

- **Unaimed**: no penalty; the location is rolled from the share table (one d100, or a d20 table).
- **Aimed** at a location: a penalty to beat the defence (*guess*: torso 0, legs −1, arms −1, head −2, hands −2,
  feet −3). Thrusts aim more easily than cuts (*guess*: the penalty is one less for a thrust, never below 0).

**Pushback on "default to the least armored location".** With free aim, a fighter's armor becomes their weakest
piece, and nobody would pay for greaves. Aiming has to cost something; with a cost, the least armored spot isn't
always the best pick. The default should be the **best expected location**: the expectation `computeHit` already
works out, taken over each choice with its penalty. The menu shows each location's odds and what the blow would do
there, which is the outcome preview HANDOFF wants anyway. The AI makes the same choice, from what it can see of the
target's armor.

The defender's shield guards the torso and the shield arm (+1 to block blows aimed there, *guess*); that is how
Visby's wounds ended up on the legs.

### 2.4 What each location does

| Location | Attribute damage from a wound (one d-roll per point, as the slash d4 now) | Extra effect on a wound |
|---|---|---|
| Head | CON, INT, WIL | Vital chance high; blunt stuns (a helm stops the cut but not the concussion) |
| Torso | CON, STR | Vital chance high for thrusts (organs) |
| Arms | STR, DEX, CON | Chance to disarm (the hand loses its grip) |
| Hands | DEX, STR | Higher chance to disarm than the arm |
| Legs | SPD, CON | Chance to trip (knocked prone); the thigh artery makes deep cuts and thrusts here vital now and then |
| Feet | SPD | Slowed (lamed) |

This replaces today's fixed d4 (STR, CON, SPD, DEX) with one table per location, so the roll count stays the same.
Vital chances move from the armor type to the location and the piece there (*guess*: head ×1.5, torso ×1.2,
limbs ×0.3, legs ×0.5, hands and feet 0). Disarm, trip and stun use the existing manoeuvre and condition code, with
odds that grow with the wound (*guess*: 10% per point of damage that reached the body).

Head wounds to INT and WIL hit casters hardest. That fits differentiation, but it should be simmed.

### 2.5 Thrusts, cuts and blunt

- **Thrust**: one location; aims best; can try for a gap inside the piece there (today's gap roll, unchanged).
- **Cut**: one location, then **carry-through**. If slashing is left after that location's armor *and* the cut got
  through (the target was bare there, or it cut through cloth or leather), what is left beyond a limb's worth
  (*guess*: 3 points) goes on into the adjacent location: arm → torso or head, hand → arm, leg → the other leg
  (same location, a second wound), foot → leg. That location's armor then meets it. Against mail or plate the cut
  stops at the first region, as now (its force goes to blunt there). That gives cuts a real use against the lightly
  armored and none against the plated, which is the historical picture.
- **Blunt**: one location; it transmits through rigid armor as now. Its extra effect is the location's, and a blow
  to the head stuns.

### 2.6 What it costs to build

| Part | Work |
|---|---|
| Data | `armor.yaml` unchanged per type; armor items gain `covers` (coverage keyword migrated); `rules.yaml` gets the location table (shares, aim penalties, attributes, effects) |
| Equip | the six armor slots take pieces; one piece may fill several; shops and loot offer pieces |
| Engine | `computeHit` takes a location and reads the piece there (or bare); `applyHit` rolls the location (unaimed), the location's attributes, its effect and carry-through; the AI's expectation runs over locations |
| UI | a Location menu by each attack, with odds per location; the sheet shows the pieces |
| Tests and sims | armor tests rewritten around locations; a duel set (full plate vs a plate breastplate with mail limbs vs unarmored limbs) and the encounter sim, before and after |

It's the largest change since the turn model. I'd build it in three steps, each pushed and simmed: (1) pieces and
locations with unaimed rolls only (full harnesses behave exactly as now); (2) aimed blows and the Location menu;
(3) location effects (disarm, trip, stun, carry-through).
