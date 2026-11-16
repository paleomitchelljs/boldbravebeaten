# Step E report: wounds and life

Branch `overhaul/E-wounds`, from `778db7a4`. Measured 2026-11-15, seed 4242. "Before" is the untouched branch run
the same day from a frozen copy; "after" is the branch head run the same way. Crawls n 30, duels n 40, spiral n 40
(after: rewritten on wounds, see below), swarm n 8, party size n 20 (cut from step D's 60 to save time, the same n
before and after).

AFTER_NUMBERS_PENDING

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

REST_PENDING
