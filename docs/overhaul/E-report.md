# Step E report: wounds and life

Branch `overhaul/E-wounds`, from `778db7a4`. Measured 2026-11-15, seed 4242. "Before" is the untouched branch run
the same day from a frozen copy; "after" is the branch head run the same way. Crawls n 30, duels n 40, spiral n 40
(after: rewritten on wounds, see below), swarm n 8, party size n 20 (cut from step D's 60 to save time, the same n
before and after).

## Headline

| Target (OVERHAUL.md step E) | Before | After |
|---|---|---|
| heroes dead a fight ≤ 0.15 (court, hall, valley) | 0.24, 0.36, 0.60 | **0.00, 0.05, 0.31** |
| heroes down a fight about 0.5 | – (collapses 62, 77, 18 in 111/221/106 fights) | 0.20, 0.27, 0.97 |
| a party of 3 clears a first area ≥ 18 of 30 | 22, 4, 15 | **28, 12, 11** |
| a survivor carries a wound in ≥ ⅓ of fights (any / a hero) | 18/15%, 10/9%, 11/2% (STR/DEX/SPD wound) | 86/44%, 68/44%, 88/70% |
| the wounded twin loses clearly, arm and leg alike | (old spiral: STR 38→1%, SPD 38→57%, DEX 38→29%) | arms 24→18%, legs 24→18% pooled; see the spiral |

Met: deaths in the court and the hall, the survivor's wound everywhere, the court's clears. Not met: the valley
(deaths 0.31, clears 11, down 0.97), the hall's clears (12, though up from 4), and the spiral (the wounded twin loses,
but not clearly, and mirrors of Beren and Jabiku mostly time out). The hall improved most because its goblin warrior
lost his CON 13 padding.


## What changed

### The rule

A blow that gets past the armor leaves a **named wound** `{place, sev 1–3, kind, bleed, pts}` (`c.wounds`). No rolls
per point; attribute damage (`c.damage`) and per-wound bleed timers (`c.bleeds`) are gone.

- **Severity** from the points past the armor (`point + cut + crush`, where crush is bone broken by blunt past
  `impact.crushAt`/`crushBare`): 1+, 4+, 7+ points for severity 1, 2, 3, each × size. Step A's vital margin makes the
  wound one step worse (and bleed 1 more).
- **Wound boxes**: a body holds 6 × size of severity. Filling them takes it **down**: out of the fight, prone, keeping
  its armor (`status.down`, with `unconscious`).
- **Shock** (CON): a severity-3 wound anywhere but the head calls for d10 + CON ≥ 11 or the body goes down. A head
  wound of 3 drops it outright. The tireless feel no shock and go down only by the boxes, and down is broken for good
  (dead).
- **Death**: a wound on a body already down kills it (a finishing blow; a cut carried on from the same blow does not).
  When the fight ends, a body down and still bleeding is bound if anyone of its side stands; otherwise d10 + CON
  against 10 + its bleeding, or it bleeds out (`Combat.settleFallen`). Hero mode: a hero is only ever down.
- **Bleeding** is a property of the wound: a cut 1 a severity, a point ⌈severity × width factor⌉, a vital wound +1,
  ÷ size, ×1.5 for a broadhead. Each round a standing bleeder loses `bleeding − ⌊CON/5⌋` points of blood as harm on
  one "blood loss" wound at the torso (it fills boxes). A body already down loses nothing more until the fight ends.
- **Harm without a blow** (burning, poison, withering dots; joint lock; constriction; overchannelling; sap; falls;
  familiar's death; cauterize; an old save's attribute damage) adds points to one ongoing wound of its kind at its
  place and reads the severity again (`Character.harm`); no shock check. Spells that land nowhere in particular
  (fire, Life) add to one burn/wither wound the same way.
- **Pain** (WIL): each place's penalties read its total severity (at most 3) less ⌊WIL/4⌋.
- **Stamina is exertion only**: max = 20 + STR + SPD + DEX (no CON); regeneration ⌊(CON + WIL) × 0.75⌋ − armor.
  Blunt that breaks nothing **winds** by the severity its blunt would be (2 / 4 / 7 stamina), not point for point. A
  spell's heat and a ghost's chill still take stamina point for point.
- **Collapse** (stamina 0) lasts 2 − ⌊WIL/5⌋ rounds after the one it began in (WIL 5: one, as before; WIL 10: none).
  A collapsed body keeps its armor and can be wounded down, not killed.
- **Medicine**: a bandage binds every bleeding wound, and d10 + Medicine + ⌊(INT + WIS)/4⌋ against 6 + severity mends
  the worst untended wound a step (each wound once). After a fight the party's best at Medicine tends every wound once;
  an unbandaged bleeding wound is a step worse before it clots. **Give + Life**: binds, mends condMag severity steps,
  stamina back; a down body mended under its boxes comes to. Revive mends 1 step and leaves the body down. Long rest:
  the d6 heal roll mends (3–6) or worsens (1) the worst wound a step.
- **Finishing is a trait**: the AI strikes foes down from wounds only with `finishes: true` (wolves, rats, the
  spider, beakbear, trolls, raptor, alligator, constrictor, the undead, revenant knight, dread shaman, avatar of
  fear). Collapsed foes are still struck by anyone (they get up).
- **Toughness** (+1 CON a rank) no longer adds life: CON is shock, bleeding, poison/disease resistance, regeneration.

### The wound table (`rules.yaml wounds.places`, by severity 1 / 2 / 3; penalties less pain)

| Place | What it does | At 3 |
|---|---|---|
| arms | +0 / 0.5 / 1 AP to weapon blows, parries, blocks, punches; −1 / 2 / 3 main damage | drops what is in hand (and shock) |
| legs | −1 / 2 / 3 squares a move stretch; −1 / 2 / 3 dodge | knocked down and can't stand while it lasts (and shock) |
| head | stunned on the blow: at 1 CON resists (as a spell), at 2 no save | down outright |
| torso | −2 / 4 / 6 stamina each round (pain doesn't touch it) | shock check |

The sheet (stats tab "Wounds" panel), the battle screen (initiative chips show boxes filled, popups show "Arms 2",
the end-of-fight panel lists each wound with what it does, the odds line and breakdown), the GM sheet and roster show
each wound as place, severity, bleeding and what it does in a few words (`Character.describeWounds`).

### The panel

`Combat.foresee` now gives, for an undefended hit and each defence: `sev` (the chance of each severity of the worst
wound the blow leaves, 0–3), `sevMean`, `bleed`, `stamina` (winding), `places`, and the chances `vital`, `down`
(wounds), `collapse` (stamina), `drop` (either), `kill`; overall `downP` beside `drop` and `kill`.
`tests/odds.test.js` checks lands, drop, down, kill, vital and each severity's chance against 3000 seeded resolutions
in nine scenarios (a bystander keeps the fight going so the end-of-fight bleed-out is not counted as the blow's), plus
a collapsed foe (a wound can put them down, never kill) and a foe already down (kill = the chance of any wound; hero
mode 0).

### Files

`src/rules/character.js` (wounds core: `wounds, boxes, woundLoad, severityOf, bleeding, bleedLoss, grit, painAt,
woundEffect, worstAt, cannotStand, isDown, addWound, harm, mendWounds, bindWounds, healAll, describeWounds`; stamina,
regen, place penalties in costs, damage and movement), `combat.js` (armorHit/hitAt/woundOutcome/bleedOf/needsShock/
downChance, applyHit, placeEffects, bodyRound, settleFallen, tendWound, foresee/hitOutcomes/outcomeDown/sumOutcomes,
leg dodge, can't-stand, bandage/cauterize/joint lock/sap/overchannel/constrict/regrow), `config.js`, `conditions.js`,
`effects.js`, `magic.js`, `recovery.js`, `items.js`, `enemies.js`, `ritual.js`, `ai.js`, `data.js`; `src/game/world.js`
(breather), `battle.js` (summary), `town.js`, `companions.js`, `explore.js`, `economy.js`, `save.js`; the UI
(`charsheet.js`, `screens/battle.js`, `views/battle.js`, `views/sheet.js`, `views/roster.js`, `bits.js`, `overlays.js`,
`screens/town.js`, `screens/explore.js`, `screens/create.js`, `views/lore.js`, `views/rules.js`, `bench.js`); data
(`rules.yaml`, `monsters.yaml`, `armor.yaml`, `weapons.yaml`, `enchantments.yaml`, `items.yaml`, `feats.yaml`,
`places.yaml`); `docs/DATA.md`; sims (`metrics.js`, `spiral.js`, `gauntlet.js`, `locations.js`, `run.js`,
`variants.json`); `tools/tiers.js`; tests.

### Deleted

- config: `staminaWeights`, `regenDivisor`, `staminaScale`, `stamina.regen.scale`, `slashAttributeTable`,
  `bleedRounds`, `weaponPhysics.bleedRounds`, `vital.mult`, `impact.crushAttrs`, `negativeRegenAlwaysApplies`,
  `unconsciousRegenerates`, `grappling.jointLock.attr`, `magic.revive.con`
- rules.yaml: `locations.wounds` (attrs, pointToCON, tirelessCON, effects; `vital` moved to `wounds.vital`)
- code: `damageAttr, healAttr, totalDamage, bleedPerRound`, `woundTable, pointIntoLimb, expectWounds, vitalExtra,
  rollWound, woundEffects, laidOut, dmgKey`, the `unconscious` armor bypass and blunt-to-CON on the unconscious, the
  non-R1 regeneration branch, weapon wound `rounds`
- `CONFIG.provisional`: "Wounds that weaken (R4)", "Stamina scale ×3", "Excess blunt beyond remaining stamina…",
  "Blunt damage on an unconscious or collapsed target goes to CON", "Wounds by location (step 3)"; rewritten: vital
  wounds, blunt on bare skin, tireless bodies, max stamina, impact, ogre/size, WIL, monster attributes, monsters
  (venom, tireless, finishes), plate, stamina as a pool, heavy-armor regen, saving the fallen, unarmed, bandage

### New keys, all PROVISIONAL (`rules.yaml wounds`, `config.js stamina`)

| Key | Value |
|---|---|
| `wounds.boxes` | 6 (× size) |
| `wounds.severity` | [1, 4, 7] points (× size) |
| `wounds.vital` | head 7, torso 9, arms 12, legs 11 (step A's, moved) |
| `wounds.shock` | 11 |
| `wounds.places` | the table above |
| `wounds.pain` | 4 (⌊WIL/4⌋ severity acted through) |
| `wounds.winding` | [2, 4, 7] |
| `wounds.bleed` | cut 1, vital 1, harm 1, conPer 5, survive 10 |
| `wounds.attrPlace` | STR, DEX arms; SPD legs; CON torso; INT, WIL, WIS, CHA head |
| `wounds.tend` | tn 6 |
| `wounds.cauterize` | 2 |
| `locations.carry.limb` | 3 → 7 (a limb takes a severity-3 wound's worth before a cut carries on) |
| `stamina.base` | 20 |
| `stamina.regen` | per 0.75, struck 0.5 |
| `stamina.collapse` | rounds 2, perWil 5 |
| `grappling.jointLock` | place arms, points 2 |
| `magic.revive.mend` | 1 |
| folded ×3 | MOTIONS/ACTIONS stamina, weapons `shootStamina`/`draw`, standUp, grappling, holdUpkeep 6, windUp 3, dodgeStamina 3, web 3, chitin recoil 3; armor `regen` (padded and leather 3, mail 6, plate 12), plate `armorAdjust` regen 9, Innervated 6, Diseased −6, the enchantment and the Ring of the Dain 3, hero regen 6 |

The stamina fold was checked by script: every action and attack cost of the four presets and five monsters is
identical before and after.

Five new `CONFIG.provisional` entries describe the rule (wounds and life; down before dead; bleeding and harm; stamina
as exertion; monsters' CON). The list is 115 entries.

## Every monster's conversion

CON above 10 (the human range) was cut to 10. Where the creature is big it already had a `size`, which now gives it
boxes × size and severity × size: that is where its toughness lives (ogre, trolls, giants, beakbear, gorilla, golems,
drakes, wyvern, constrictor, alligator, minotaurs, avatar, efreet lord, giant shade, elementals). Where it is
tough-skinned its hide is already its armor (scaleward and varanus scales, chitin, drake scales, troll/ogre/giant
hides); nothing was added. The rest was padding and goes to nothing. Sizes were not changed, armor was not changed.

| Monster | CON | Why |
|---|---|---|
| rustBeetle | 12 → 10 | chitin is its armor |
| mirageCat | 11 → 10 | padding |
| beakbear | 16 → 10 | size 1.3 |
| caveTroll | 18 → 10 | size 1.3; regrow mends a step a round |
| trollChieftain | 24 → 10 | size 1.5; regrow |
| ogre | 21 → 10 | size 1.5 |
| hillGiant | 26 → 10 | size 2.5 |
| zombie, mummy, spectre | 12, 14, 14 → 10 | tireless: CON does nothing for them |
| clay/stone/iron golem | 22 → 10 | size 1.3, golemBody armor, resistances (tireless) |
| drake, redDrake | 16 → 10 | drake scales |
| wyvern | 16 → 10 | size 1.5, scales |
| constrictor | 15 → 10 | size 1.2, scale hide; constrict con → harm 1 |
| alligator | 11 → 10 | size 1.2, gator hide; constrict harm 1 |
| scaleward | 11 → 10 | scales |
| suracaylVaranus | 12 → 10 | size 1.1, scales |
| templeGorilla | 12 → 10 | size 1.3 |
| dreadShaman, venril | 18, 30 → 10 | padding (bosses by apMult) |
| avatarOfFear | 36 → 10 | size 1.8, hide |
| goblinWarrior, goblinChampion, goblinKing, goblinHighShaman | 13, 13, 14, 15 → 10 | padding (champion and king: mail, plate) |
| efreeti, efreetLord | 16, 14 → 10 | size 1.1, 1.6 |
| fireGiant, fireGiantYoung, Guard, Warlord, Wizard, Magus, King | 30, 34, 18, 22, 30, 22, 16 → 10 | size 2–2.7, hides/plate |
| giantShade | 32 → 10 | size 2.2, tireless |
| dragonLord | 40 → 10 | size 4, scales |
| orcSlaver, orcProphet, orcWarlord, orcEmperor | 12, 16, 12, 26 → 10 | padding |
| koboldHuntLeader, koboldChampion, koboldKing | 11, 14, 28 → 10 | padding |
| steamElemental | 18 → 10 | size 1.3, tireless |
| sarnakWarden | 13 → 10 | mail |
| minotaur, minotaurLord | 14, 18 → 10 | size 1.25, 1.4 |

Small animals got a size under 1 so a rat is not a man's worth of wounds: rat 0.5, dusk bat 0.4, fae drake 0.4, fire
sprite 0.5. Goblins and kobolds stay man-sized (noted as a decision below). `finishes: true` was added to the 19
listed above.

## The "each round" places, for step F

All in `src/rules/combat.js`:

1. `endRound` (one function, its header lists everything): constriction; `bodyRound` (blood loss, the torso wound's
   stamina); `Conditions.endRound` (dots as harm, durations); regrowth; weariness; regeneration (`Character.roundRegen`);
   a collapse running its course (`collapseRounds`, `comesRoundAt`); hold upkeep; webs loosening; wind-ups lapsing;
   the revive window.
2. `finishRound` → `settleFallen` when the fight ends (not periodic, but it is where the end of a fight is decided).

Step F can move `bodyRound`, regeneration and the collapse count to its beat by calling them from the timeline.

## Before and after against the baseline table (party of 3, seed 4242)

| Goal | Measure | Before | After |
|---|---|---|---|
| Fast | median rounds (court, hall, valley; duels) | 4, 3, 5; 2 | 3, 4, 6; 3 |
| | 90th percentile rounds | 6, 11, 14; 4 | 10, 13, 14; 5 |
| Lethal but playable | heroes dead a fight | 0.24, 0.36, 0.60; duels 0.48 | 0.00, 0.05, 0.31; duels 0.37 |
| | heroes down a fight | – | 0.20, 0.27, 0.97; duels 0.45 |
| | cleared of 30 | 22, 4, 15 | 28, 12, 11 |
| Death spiral | survivor with a wound | 18%, 10%, 11% (STR/DEX/SPD) | 86%, 68%, 88% (any wound) |
| Stamina matters | someone under ½ | 49%, 37%, 53%; duels 17% | 52%, 48%, 82%; duels 26% |
| | heroes out (collapse or down) / got up | 62/41, 77/38, 18/3 | 98/61, 160/77, 119/16 |
| Depth | top action share of blows landed | thrust 38, 45, 64%; duels 60% | thrust 37, 37, 62%; duels 60% |
| | head share of located blows | 16, 17, 13%; duels 22% | **25, 22, 21%; duels 28%** |
| | kicks of blows landed (hall) | 6% | **25%** |
| Action economy | swarm, all heroes, N = 1..6 | 95 84 60 48 33 19 | **87 62 38 22 11 10** |

Wounds dealt by severity 1/2/3: court 410/374/76, hall 293/331/278, valley 252/379/219; duels 217/639/294. Heroes taken
down by a blow (the last wound): court 20 (templeGorilla and scaleward; severity 3 95%), hall 40 (goblin warrior 50%,
fire goblin 40%; at the arms 53%), valley 80 (orc legionnaire 75%; severity 2 53%, 3 39%; at the arms 43%). No hero
was struck dead while down anywhere: no foe in these places finishes; every death is a bleed-out after a lost fight.

Duels by pair (A wins %, before → after): Beren v Cyrus 100 → 100, Beren v Jabiku 90 → 95, Cyrus v Jabiku 100 → 100,
Beren v scaleward 88 → 63, Cyrus v scaleward 75 → 100, Jabiku v scaleward 0 → 0, Beren v fireGoblin 100 → 100, Cyrus
v fireGoblin 48 → 48, Cyrus v goblinWarrior 48 → 83, Beren v wolf 100 → 100.

Party size (n 20 a cell, cleared / heroes dead a fight):

| Place | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| court before | 1 / 0.17 | 8 / 0.23 | 14 / 0.27 | 20 / 0.07 | 20 / 0.04 | 20 / 0.01 |
| court after | 0 / 0.11 | 4 / 0.07 | 18 / 0.01 | 20 / 0.00 | 20 / 0.00 | 20 / 0.00 |
| hall before | 0 / 0.13 | 0 / 0.25 | 1 / 0.28 | 9 / 0.26 | 18 / 0.16 | 19 / 0.24 |
| hall after | 0 / 0.09 | 0 / 0.06 | 4 / 0.05 | 17 / 0.00 | 20 / 0.00 | 20 / 0.00 |
| valley before | 0 / 0.41 | 1 / 0.55 | 8 / 0.62 | 10 / 0.77 | 18 / 0.78 | 18 / 0.71 |
| valley after | 0 / 0.33 | 2 / 0.51 | 5 / 0.51 | 7 / 0.45 | 17 / 0.12 | 15 / 0.35 |

The valley's deaths no longer rise with party size (step D's open question): from five heroes they fall, because a
side that holds the field binds its fallen.

## Down against dead

Down is now the common outcome and death the rare one, which is the step's intent. Court: 0.20 down, 0.00 dead. Hall:
0.27 down, 0.05 dead. Valley: 0.97 down, 0.31 dead. Duels (no ally to bind the loser): 0.45 down, 0.37 dead. Every
hero death in the crawls is a bleed-out (`settleFallen`) after a lost fight; none was finished (no foe in the three
places has `finishes`). Before, 48% (court), 19% (hall) and 16% (valley) of hero deaths were blows on a body already
down; that path is now the trait's only.

## The spiral by wound (`sim/spiral.js --n 40`, rewritten)

The twin starts with one bound wound at the arms or the legs, severity k. The wounded twin's win rate (timeouts in
brackets):

| Hero | place | k=0 | 1 | 2 | 3 |
|---|---|---|---|---|---|
| Beren | arms | 18% (70%) | 18% (70%) | 15% (73%) | 13% (75%) |
| Beren | legs | 18% (70%) | 18% (70%) | 20% (65%) | 28% (73%) |
| Lorc | arms | 33% | 33% | 33% | 40% |
| Lorc | legs | 33% | 33% | 38% | 5% (95%) |
| Cyrus | arms | 48% | 43% | 23% | 20% |
| Cyrus | legs | 48% | 48% | 40% | 40% |
| Jabiku | arms | 0% (100%) | 3% (98%) | 0% (100%) | 0% (88%) |
| Jabiku | legs | 0% (100%) | 3% (98%) | 0% (100%) | 0% (100%) |
| pooled | arms | 24% (43%) | 24% (43%) | 18% (43%) | 18% (41%) |
| pooled | legs | 24% (43%) | 25% (42%) | 24% (41%) | 18% (67%) |

Only Cyrus shows the spiral clearly (arms 48 → 20%). Severity 1 does nothing for anyone with WIL 4+ (pain takes it),
which is the rule working, but it means k=1 is a mirror. Beren's and Jabiku's mirrors mostly time out at every k, as
they did before (plate on plate; two casters of Life who wither each other a point at a time), so their columns say
little. Lorc's arm wound does nothing to a bow: arms penalise weapon blows' AP and damage, and the shot's damage is
the bow's (I did not check why the arm wound's damage penalty does not tell on the shot). Lorc's leg 3 keeps him down and the fight times out.

## What moved the wrong way

- **The valley.** Clears 15 → 11, heroes down 0.97 a fight. Deaths fell (0.60 → 0.31) but stay over the 0.15 target,
  all bleed-outs after a lost fight. I tried shock 11 vs 12, boxes 5 and 7, thresholds [1,3,6] and [1,4,8], survive 8,
  and winding [2,4,7] vs [3,6,10]: every variant cleared 5–11 of 30 (n 30: ±2.5). The valley's third fight (three
  heroes against four spearmen) is long (14 rounds at the 90th percentile) and the numbers tell.
- **Swarm.** A level-8 hero against N level-1 foes now loses near N = 3 (38%), was near N = 4 (48%). A hero's CON no
  longer carries them through many small wounds, and a lone hero has no one to bind them.
- **Head share** rose to 21–28% (court and duels at or over the ¼ target). The AI's aim (`bestAim`) now weighs every
  place, armor or no, since every place's wound does something different, and a head wound of 3 drops outright and a
  head wound of 1–2 stuns. Step A tuned the head's aim cost for the old wounds.
- **Kicks** are 25% of blows landed in the hall (6% before). Not tested whether this is the AI: a kick's winding is a
  fixed 2–4 stamina and its knockdown is now worth more against goblins who no longer have padding CON.
- **Collapses and long tails.** Collapses (stamina 0) are 2–7 times as many, and the 90th-percentile fight is longer
  (court 6 → 10 rounds). A collapsed body keeps its armor and gets up, and bleeding no longer kills mid-fight, so fights
  that once ended in a kill on a collapsed foe go on.
- **Golems and CON-resisted banes**: CON 22 → 10, so Slowed and the other CON-resisted banes now land on golems.
- **Bosses lost their padding** (venril, the orc emperor, the kobold king, the dread shaman: CON 18–30 → 10). They
  are bosses by apMult and gear; `tools/tiers.js` was not rerun.

## Decisions the plan did not settle

1. **Head and torso at 3.** The plan says both "drop" at 3, and also that shock resists a severity-3 wound. I made the
   head drop outright and gave the torso (and the limbs) the shock check, so CON matters somewhere.
2. **Bleeding during a fight is blood loss, not stamina.** First built as stamina (2 a point a round): collapses
   tripled and fights dragged. Blood loss as harm (filling boxes) brings a heavy bleeder down in a few rounds; a body
   already down is settled only when the fight ends.
3. **Death after the fight** is a roll (d10 + CON against 10 + bleeding) for a down body whose side has no one
   standing; a side that holds the field binds its own. Sims and the game see the same rule (`Combat.settleFallen`,
   from `finishRound`).
4. **Spells that land nowhere** (fire, Life) and harm over time add to one wound of their kind, so a run of small
   burns does not fill a box each. Blows are each their own wound.
5. **Carry-through limb** raised 3 → 7 points so a cut can make a limb wound of severity 3 before carrying on.
6. **Pain** reduces a place's penalties, not its drops, falls or the shock check.
7. **Small animals** got sizes under 1 (rat, bat, fae drake, fire sprite). Goblins and kobolds stay 1; making them
   0.8 would mirror their old frailty but changes the first areas more than this step should.
8. **Medicine after a fight** is free (a skill check per wound, once); bleeding needs a bandage or the wound worsens.
9. **Old saves** (VERSION 8): each attribute's damage becomes harm where `wounds.attrPlace` puts it (STR and DEX the
   arms, SPD the legs, CON the torso, the rest the head), one wound a place; old bleeding is dropped as stopped.
10. **WIL's "fear, spent actions"** were left as they are (fear already uses WIL; R2's spent action has no WIL term).
    Step I can give WIL the spent action.
11. Not looked at: the battle screen and the sheet were rendered only in the fake DOM (the UI tests pass); I did not
    take a screenshot, so the layout of the wound panel and chips is unseen.

## Verification

`NODE_OPTIONS=--max-old-space-size=8192 node --test`: 357 tests, 357 pass, 0 fail (188 s). `node tools/validate.js`:
data/ is consistent. `node tools/bundle.js` run (data/bundle.js is gitignored).

## Commands

```
node sim/crawl.js temple_court|ember_hall|orc_valley --party 3 --n 30 --metrics
node sim/duels.js --n 40 --seed 4242 --metrics
node sim/spiral.js --n 40
node sim/swarm.js --n 8
node sim/partysize.js --n 20 --seed 4242 --jobs 2
```

`sim/metrics.js` now reports heroes down and dead a fight (bled out and struck down), the wound severities dealt, and
the blows that took a hero down (action, place, severity, foe).
