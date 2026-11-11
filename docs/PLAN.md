# Combat tuning plan (2026-11-11)

Nine prompts to hand to an implementing model, one session each, in this order. Each is written to be pasted whole:
the session reads `CLAUDE.md` and `HANDOFF.md` by itself, and the prompt tells it to read this file.

**Scope.** Fights, feats, combat mechanics and the battle UI. Out of scope until the world is less of a draft
(the user, 2026-11-11): magic items, parley, factions, and any content or world-building decision. A session
that finds a problem there adds a line to `HANDOFF.md` and leaves it.

**Why this order.** Step 1 makes the goals measurable. Steps 2 to 4 change what a fight is (stamina, wounds, the
head). Step 5 fixes the AI so the sims can be trusted, and step 6 re-tunes on top. Steps 7 and 8 are the battle
UI, which should describe the rules as they will be, so it comes after them. Step 9 is feats, last, because several
feats patch things steps 2 to 4 make ordinary rules.

## Rulings (approved by the user, 2026-11-11, all ten as written)

The prompts say "as approved in the plan's rulings table": this is that table.

| # | Ruling | Approved | Used in |
|---|---|---|---|
| R1 | Stamina comes back every round | Yes: full regeneration in a round you took no stamina loss, half (rounded up, at least 1) in a round you did | 2 |
| R2 | An action you can't pay the stamina for | Allowed as a *spent* action: it costs the stamina you have left down to 1, damage and defence rolls take a penalty, never refused | 2 |
| R3 | Stamina 0 | Collapse, not out for the fight: prone and helpless for one full round, then comes round at regeneration's worth of stamina and must stand. Blows at a collapsed body still go to attributes as now | 2 |
| R4 | A point that goes in | Takes the location's attributes: head and torso CON as now; arms, hands, legs, feet from the location's list in `rules.yaml` (`locations.wounds.attrs`), CON only on a vital roll | 3 |
| R5 | Blunt on an unarmored location | Breaks bone much sooner: a lower `crushAt` where the location has no armor, and the points go to the location's attributes | 3 |
| R6 | Aiming at the head | Harder against a defender who can still react (has AP left and is not prone, held or unaware); as now against one who can't | 4 |
| R7 | Starting kits | Every hero kit and most humanoid foes of level 2 and up get head cover of their armor's type | 4 |
| R8 | The swing's setting | A swung edge or head that drops or passes its first target carries on into a second body in reach beside it (a sweep), at reduced force | 6 |
| R9 | AP shown to the player | Costs rounded to the nearest half AP for play, not only for show | 8 |
| R10 | `maxLevel: 10` and the skill cap of 10 | Raise `maxLevel` to 20 for now; keep the skill cap (it is the cost of specialising) | 9 |

## Targets (proposals; step 1 measures where we are)

These turn the design goals into numbers a sim can report. They are my proposals, not rulings.

| Goal | Measure | Target |
|---|---|---|
| Fast | Median rounds per fight, party of 3 in first areas | 3 to 5 (duels now: 2) |
| Lethal but playable | Heroes dead per fight, party of 3, first areas | at most 0.5 (now about 0.3 to 1.8) |
| | First areas cleared by a party of 3, of 30 crawls | at least 18 (now 10, 0, 2) |
| Death spiral | Fights in which a survivor carries a wound to STR, DEX or SPD | at least a third |
| | A wounded fighter's win rate against a fresh twin | clearly below 50%, falling with wounds |
| Stamina matters | Fights in which someone drops under half stamina | at least a third |
| | Collapses that get back up in the same fight | most of them |
| Tactical depth | Largest share of blows landed by one action | under half (thrust now 56 to 83% of kills) |
| | Share of blows landing on the head | under a quarter (now 41 to 58%) |
| Action economy | One level-8 hero against N level-1 foes | loses by about N = 4 |

---

## Prompt 1: baseline and a metrics report

```text
Read docs/PLAN.md (the scope note, the targets table and this step). You are doing step 1 only. Change no rule.

Goal: make the plan's targets measurable, and record where the game stands today.

1. Add a metrics report to the sims. sim/crawl.js and sim/duels.js should be able to print (a --metrics flag),
   per place or pairing: median and 90th-centile rounds per fight; heroes dead per fight; share of fights in which
   any fighter fell below half stamina, and below a quarter; collapses (stamina 0) and how many of those got up
   again in the same fight; share of fights in which a survivor ends with damage to STR, DEX or SPD; blows landed by
   action (thrust, swing, two-handed, power, shoot, bash, kick, punch, spell) as shares; blows landed by location
   as shares. Collect these from the encounter's log or state without changing combat.js behaviour; if a hook
   is needed in src/rules, make it an optional observer that costs nothing when unset.
2. Add two small sims: sim/spiral.js (a preset hero against a twin who starts with k wounds to STR, SPD or DEX, k
   = 0..4: win rate by k) and sim/swarm.js (one hero grown along its start.yaml plan to level 8, as tools/tiers.js
   grows them, against N level-1 foes from foes.yaml, N = 1..6: win rate by N).
3. Run the baseline with seed 4242: crawl for temple_court, ember_hall, orc_valley with parties of 3 and 4 (30
   crawls each), duels (--n 40), spiral and swarm. Do not run the test suite beside the sims.
4. Write the results at the top of sim/FINDINGS.md under "Baseline for the tuning plan", as one table per sim,
   beside the plan's targets. Say plainly which targets are met and which are not.
5. Housekeeping in the same commit series: delete the scratch files committed at the repo root (_shot_*, _t_*,
   _a.png), add them to .gitignore, and make tools/shot.sh write its temporaries somewhere ignored.

Finish: node --test and node tools/validate.js pass; commit, push, update HANDOFF.md as CLAUDE.md says. Report the
baseline table and anything in it that contradicts the plan's assumptions.
```

## Prompt 2: stamina as a pool you manage

```text
Read docs/PLAN.md (rulings R1 to R3, the targets, this step) and the "Baseline for the tuning plan" section of
sim/FINDINGS.md. You are doing step 2 only.

The design goal: stamina is the moment-to-moment energy pool. It comes back quickly, it is what blocked and
parried blows cost, a fighter is never locked out of acting, and running out means collapsing for a time, not
leaving the fight. Today regeneration is about 2 a round and none in a round you were struck or blocked a blow
(combat.js, end of round); an action whose stamina you lack is refused ("Too exhausted": validate and payStamina
in combat.js); and stamina 0 is unconscious until someone rouses you (Character.updateCondition;
CONFIG.unconsciousRegenerates false).

Build, each behind a CONFIG key so the old behaviour can be restored, marked PROVISIONAL and listed in
CONFIG.provisional, with tests that check Specifics numbers still wrapped in asWritten():

1. R1, regeneration every round: full when the fighter lost no stamina to a blow that round, a share when they
   did. Heavy armor's negative regeneration stays. Second Wind and Rally currently buy what this gives everyone:
   give each a new, larger effect of the same kind and say what you chose.
2. R2, the action floor: an action whose stamina cost the fighter can't pay may still be taken as a spent
   action. It takes stamina down to 1 at most, and it is weaker: a penalty to the roll to beat a defence and to
   the blow's damage (the vigor multiplier already scales damage by stamina; extend it, don't add a second
   mechanism). Defences taken spent get a penalty to their roll. The battle command panel marks a spent action.
3. R3, collapse: at stamina 0 a living fighter collapses: prone, no actions or reactions for the rest of this
   round and all of the next, then comes round with one round's regeneration and must stand up as usual (the
   stand-up costs already scale with armor). A blow that lands on a collapsed fighter goes to attributes as it
   does now on an unconscious one. Rouse, healing and Rally bring them round at once, as they wake the
   unconscious now. Keep "unconscious" for CON-related and spell causes if any exist; otherwise retire the word
   in the UI and log in favour of "collapsed". Tireless bodies are unaffected.
4. The AI: it must value finishing a collapsed foe against turning to a standing one, and must not waste a turn
   on a spent action when a step back to recover is better. Keep to what its character could see.

Then measure with the step-1 sims (same seeds, --metrics) and write a section at the top of sim/FINDINGS.md:
before and after for every target, and for 2 or 3 values of the new numbers using --set. Tune the new numbers
toward the "stamina matters" targets without changing any monster. If fights get much longer than the "fast"
target, say so and say which number does it; do not paper over it.

Finish as CLAUDE.md says (tests, validate, commit, push, HANDOFF). Report the before/after table and any ruling
you had to make that the plan did not cover.
```

## Prompt 3: wounds that weaken (the death spiral)

```text
Read docs/PLAN.md (rulings R4 and R5, the targets, this step) and the newest sections of sim/FINDINGS.md,
including "The crawl baseline; the swing nobody uses". You are doing step 3 only.

The design goal: taking unmitigated damage makes you fundamentally weaker; attributes heal slowly. Today a
point that goes in takes CON wherever it lands (rules.yaml locations.wounds: "a point that goes in still takes
CON"), so the commonest wound makes a fighter dead or untouched; only cuts lower STR, DEX and SPD, and almost
nobody swings; blunt on bare skin takes stamina only until it passes CONFIG.impact.crushAt (8).

Build, PROVISIONAL, behind config keys in data/rules.yaml or config.js, listed in CONFIG.provisional:

1. R4: piercing that reaches the body takes attributes by location. Head and torso: CON, as now. Arms, hands,
   legs, feet: the location's attributes in locations.wounds.attrs, rolled per point as a cut's are; the vital
   roll (already weighted by location) is what sends a limb wound to CON. Bleeding is unchanged. Check the
   expected-value path the AI and the preview use (computeHit, hitAt, the blend of gap outcomes) gives the same
   answer as applyHit on average: add a test that compares them over many rolls.
2. R5: blunt that lands on a location with no armor crushes from a lower threshold (a new number beside
   impact.crushAt; start near 3 and tune), and what it takes goes to the location's attributes, not only CON.
   Unarmed blows without Heavy Hands still take stamina only (the user's ruling, 2026-11-10).
3. Make sure every formula reads current attributes, so a wound shows at once: the AP pool and move from SPD,
   damage and strain from STR, parry and gap rolls from DEX, maximum stamina. List any that read the unwounded
   value and say whether that is intended. docs/REVIEW.md section 2 item 3 (conditions and wounds changing
   maximum stamina without clamping the current value) is the known loose end: settle it here.
4. The golems and other tireless bodies: FINDINGS says a cut on a tireless body goes to STR/DEX/SPD by
   location and little reaches CON. With R4 a point would do the same. Decide the simplest rule that keeps
   "a point does nothing to bone" and lets a tireless body be destroyed by what should destroy it, and say what
   you chose. Do not tune an individual monster.

Measure with the step-1 sims, sim/spiral.js above all, and write the before/after in sim/FINDINGS.md. What to
look for: the spiral targets, whether the thrust's share of kills fell, and whether fights got longer (limb
wounds kill less). If first-area clears fall, report it; attrition is step 6's job.

Finish as CLAUDE.md says. Report the table and what R4 did to the thrust against the swing per AP, bare and
padded, in the form of the table in "The swing nobody uses".
```

## Prompt 4: the head

```text
Read docs/PLAN.md (rulings R6 and R7, this step) and sim/FINDINGS.md's newest sections. Step 4 only.

The problem: blows land on the head 41 to 58% of the time although it is 8% of the body, because aiming there
costs a thrust 1 (rules.yaml locations.aim: penalty 2, thrustLess 1), vital wounds there count double, the
command panel defaults to the expected-best location, and most bodies have a bare head. The lethality is wanted;
the single best answer to every fight is not.

Build, PROVISIONAL:

1. R6: an aimed blow's penalty depends on whether the defender can still react. Against a defender with AP left
   who is standing, free and aware, small targets (head, hands, feet) cost markedly more to aim at than now;
   against one who is prone, held, collapsed, surprised or out of AP, the present numbers stand. Put both sets
   in rules.yaml. This makes the head something you set up (a knockdown, a hold, a flank, draining their AP),
   which is the tactical depth the plan is after. The AI must apply the same rule from what it can see: it
   does not see the other side's AP, so let it judge from what it has watched them spend this round.
2. R7: give every kit in data/start.yaml head cover of its armor's type, and the humanoid templates in
   data/foes.yaml and humanoid monsters of level 2 and up likewise unless their description says bare-headed.
   This is data only. Do not touch magic items or loot tables.
3. The command panel's default aim (src/ui/views/battle.js, "the expected-best place by default") stays, but
   shows why: the chosen location and its penalty are visible without a hover.

Measure: blows by location and deaths per fight, before and after, from the step-1 sims; tiers for the first
areas' foes (node tools/tiers.js) since helms change them. Write it up in sim/FINDINGS.md.

Finish as CLAUDE.md says. Report the head's share, deaths per fight, and whether any foe's tier moved by more
than one.
```

## Prompt 5: the AI plays the game the player plays

```text
Read docs/PLAN.md (this step) and HANDOFF.md's "Rules and AI" section. Step 5 only. No rule changes.

The sims are only as good as the AI. Known faults (HANDOFF and FINDINGS): it uses none of the newer actions
(Vanish, Rally, Command, To Your Feet, Demoralize, Name the Weakness, Feign); it never overchannels; it drops a
longsword for a dagger; a sword-and-shield fighter spends its pool on the approach and has nothing left to
strike or defend with; it can stand off for rounds; it kicks a body that is immune to blunt; casters barely
cast. Steps 2 to 4 added: spent actions, collapse, aim that depends on the defender's state.

1. Fix those faults in src/rules/ai.js, in order of how much they distort fights: the approach budget (keep AP
   for a blow or a defence when closing), weapon choice (never trade down without a reason: the foe is inside
   reach.min, the weapon is broken, the target is immune), not attacking with something the target is immune
   to, stand-offs, then the newer actions, then casting.
2. Move the AI's worth of each condition out of ai.js into CONFIG.conditions (a `worth` field), as HANDOFF
   asks, so a new condition needs no AI edit. tests/effects.test.js guards the key registry: extend it.
3. The AI sees only what its character could see. Add a test for any new place you read the other side's state.
4. Add a regression sim or test for each fault fixed (a seeded fight in which the old behaviour showed).

Measure: the step-1 metrics before and after, plus the two-handed against sword-and-shield duel (68% in the open
at last count) and casters' tier alone (M about 2). Write it up in sim/FINDINGS.md. If a matchup moves a lot, that
is a finding about the AI, not a reason to change a rule here.

Finish as CLAUDE.md says. Report which faults are fixed, which are not and why.
```

## Prompt 6: re-tune fights on the new rules

```text
Read docs/PLAN.md (ruling R8, the targets, this step) and everything in sim/FINDINGS.md dated 2026-11-09 or
later. Step 6 only.

Steps 2 to 5 changed stamina, wounds, the head and the AI. Now bring the fights to the plan's targets by tuning
fundamentals. Rules of the house (CLAUDE.md): do not tune an individual monster to fix a style's weakness;
balance is differentiation, not parity; a party is three for tuning; every departure from the design docs is
TUNED or PROVISIONAL in config with evidence in FINDINGS.

1. Give the crawl what it lacks, so it can be trusted past first areas (HANDOFF): the fallen are recruited
   again or replaced between places as the game allows, and heroes grow along their start.yaml plans with
   their feats and skills (tools/tiers.js already grows them; share that code). World.grantXP raises level but
   not power: use the plan growth, not grantXP alone.
2. Re-run every baseline from step 1 and lay the numbers against the targets.
3. Attrition. If a party of three still loses more than about half a hero a fight in first areas, find out what
   kills (the metrics name the action, the location and whether the victim had AP left) and tune the
   fundamental behind it. Candidates, in the order I would try them: the AP die's swing (who goes first decides
   too much: CONFIG.apDie), the vital numbers (CONFIG.vital), cover with a shield (CONFIG.defense.cover),
   encounter joins (game.joinDistance pulls neighbours into one fight). Encounter sizes in data/places.yaml are
   content and may be cut where a first area fields more than the party can face, as was done for the hall.
4. R8, the swing's setting. A swing that drops its target or passes it (dodged, or the target was already down)
   carries into one more body within the weapon's swing reach and adjacent to the first, at reduced force, drawing
   that body's own defence. Two-handed and power swings carry more. PROVISIONAL, a config key. Measure whether the
   longsword's swing is now chosen against two or more unarmored foes and still not against armor.
5. Weapon roles left open in HANDOFF: the shield bash against bone, the great axe against mail, nobody carrying
   the battle axe. Settle each with a number or a note saying why it stands.
6. The golems, the desert spectres and casters alone (HANDOFF): re-measure after steps 3 and 5; fix by rule if
   a rule is wrong, otherwise list what content would fix them and leave the content alone.

Write one FINDINGS section with the final table against every target, what was tuned, and what could not be
brought to target and why. Update the tuning numbers quoted in HANDOFF.

Finish as CLAUDE.md says. The sims here are long: run them one at a time, never beside the test suite.
```

## Prompt 7: the battle panel tells you the odds

```text
Read docs/PLAN.md (this step). Step 7 only: UI, no rule changes.

The player cannot see what the engine knows. A blow can involve a defence roll, a location, a gap roll,
pass-through, a vital roll, attribute dice, knockback and shield break; the panel shows expected harm on a hit
("On hit": src/ui/views/battle.js, reused by src/ui/game/screens/battle.js) but not the chance to land it, nor
what the defender is likely to do. HANDOFF: "The battle panel shows no chance to hit or expected harm for an
action".

1. Add to the rules layer (no DOM, runs in Node) one function that, for an attacker, a target and an option,
   returns what the attacker's character could know: the chance to beat each defence the target could put up
   (block, parry, dodge) given what the attacker has seen (the shield and weapon in hand, armor worn, whether
   they are prone, held, collapsed; not their AP, not hidden feats), the expected harm on a hit by kind (CON,
   other attributes, stamina, armor wear), the chance of a vital wound, and the chance the blow drops them. Build
   it on computeHit and the defence-odds code the AI already uses; do not write a second model. Test it against
   simulated frequencies (many seeded resolutions of the same blow): each number within a few points.
2. Show it in the command panel for the chosen action and target: one line, for example "Lands 55% (they
   parry) · 4 CON, 2 STR · drops them 20%", with the breakdown on hover or tap. Show the same for aimed
   locations in the aim picker, so the choice of where to strike is a comparison of lines.
3. When the player is asked to react (block, parry, dodge, cover), show the same kind of line for each choice:
   chance it works, what it costs in AP and stamina, what gets through if it fails.
4. Spent actions (step 2), collapse and wounds must read clearly: a wounded attribute shows its loss on the
   fighter's card; a collapsed fighter shows the round they come round.

You must look at it. Use tools/shot.sh to take screenshots of a fight with the panel open on a thrust, a swing,
an aimed blow and a reaction prompt, at desktop and phone widths, and attach or describe exactly what you saw.
If you could not look, say so plainly. The fake DOM catches exceptions, not layout.

Finish as CLAUDE.md says.
```

## Prompt 8: fewer clicks, rounder numbers

```text
Read docs/PLAN.md (ruling R9, this step). Step 8 only.

Rounds are fast; a player's turn is not. Costs like 2.3 and 6.9 AP are hard to plan with, and "Always ask" puts
a pop-up on every blow at the party.

1. R9: quantise. Every action's AP cost, after all multipliers, rounds to the nearest half AP (CONFIG, a
   `apStep` key in sheet AP; null restores the present behaviour). AP is counted in tenths internally (apScale),
   so this is a rounding at the end of the cost functions in character.js, not a new scale. Check the Quick
   feats, armor's per-action cost and weapon strain still each make a visible difference somewhere; where a
   bonus now rounds away at every rank, report it rather than hiding it. Re-run the step-1 duels and crawl to
   confirm nothing moved beyond noise, and record it in FINDINGS. PROVISIONAL.
2. Reactions: replace the three-way choice of always ask, never ask with standing orders per hero, set before or
   during a fight: for example "block if I have a shield and AP for it; parry thrusts; dodge only when
   unarmored; ask me when the blow could drop me". The prompt then appears only for blows that matter, using
   step 7's odds to decide what matters. Keep a way to be asked every time.
3. The turn: show the AP pool as pips in halves, with the cost of the hovered action and what would be left for
   reactions marked on the same pips. Let the player pan the battle view by hand (HANDOFF). Make the battle view
   use the window as the explore view does (game.view in rules.yaml) instead of 15 by 10.
4. End-of-fight summary: who was wounded where, stamina and weariness, gear wear, in one panel, so the cost of
   a fight is read at a glance before the rest-and-mend choice.

Look at it with tools/shot.sh at desktop and phone widths and report what you saw, or say plainly that you
could not. Finish as CLAUDE.md says.
```

## Prompt 9: feats

```text
Read docs/PLAN.md (ruling R10, this step), data/feats.yaml's header, data/skills.yaml and rules.yaml's skills
section. Step 9 only. Magic items, loot and parley content are out of scope; magic feats are in scope only where
they touch a fight.

The design goal: classless, freeform trees; feats give large benefits, numbers come from skills; power comes
from reacting more, lasting longer and mitigating, never from a bigger pool; no caps but the cost of the points.

1. Audit every combat-facing feat (groups body, combat, magic) into a table in docs/FEATS-AUDIT.md: what it
   does in code, whether it is built (25 are `auto: false`; branch capstones such as Striker, Fencer, Assassin,
   Reaper, Technique and Runner are not built), and whether steps 2 to 8 changed its worth. Flag feats that are
   only a number (they belong in a skill, per the user's ruling of 2026-11-07), feats nobody would take, and
   feats everybody must take.
2. Measure. Add a sim (sim/feats.js) that takes a preset hero at a given level and fights the step-1 duels and
   one first-area crawl with and without each feat the hero could hold, reporting the change in win rate and in
   the plan's metrics. HANDOFF also asks for an attribute sim (+1 to each attribute in turn): include it. Fix or
   delete sim/lib.js and sim/dk-scaling.js, which list retired feats.
3. From the audit and the sim, propose changes and make the ones that need no ruling: build the unbuilt
   capstones and `auto: false` combat feats whose effect is already written down; rework feats that step 2 made
   ordinary (Second Wind, Rally, To Your Feet, Kip-Up) if that was not finished there; make each tree's branches
   lead to a different way of fighting, not a bigger number. List the ones that need a ruling at the end of the
   audit file with a recommendation each, and stop there for those.
4. R10: raise game.maxLevel as approved, check that XP, points per level and the tier thresholds still give a
   sensible curve to the new cap, and settle the open XP question in HANDOFF (every hero gets the full amount
   whatever the party's size) with a recommendation, not a change.
5. Check the cost of magic against the cost of fighting: seven magic trees unlock from the one Arcane skill,
   which also gives spell points, while a fighter splits points over Melee, Block, Armor and Evasion. Report
   what a level-5 caster and a level-5 fighter can each afford, and recommend; change nothing here without a
   ruling.

Finish as CLAUDE.md says. Report the audit's headline numbers, the feats changed, and the rulings wanted.
```

---

## After the nine

- One short current-rules page, generated from or checked against `CONFIG` and `rules.yaml`, to replace the
  Mechanics Outline and Specifics as the description of play. `docs/REVIEW.md`, `docs/PROPOSALS.md` and
  `docs/TODO-FIXES.md` move to `archive/docs/`.
- Then, and only when the world is settled enough: magic items (slots, charges, rarity) and parley.
