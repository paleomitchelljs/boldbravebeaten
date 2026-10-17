# Handoff: Bold Brave Beaten

Where the project stands after round 3 of tuning, and what comes next. Read this
together with `CLAUDE.md` (the short rules for working here) and
`sim/FINDINGS.md` (the evidence behind each tuned number).

## What it is

A fully browser-based, turn-based platform for the user's tabletop RPG:

- players keep character sheets on the site and type in their own dice rolls;
- the platform does the arithmetic;
- the GM generates enemies and runs battles on a grid.

The rules come from three Claude Docs. Treat them as the source of truth, and
check with the user before departing from them:

| Doc | URL | Doc id |
|---|---|---|
| Game Design Philosophy | https://claude.ai/artifact/3vj88djGNJmSf8ErNEDgrE | `17b2a804-f52e-4e8e-88e3-91f0e7954733` |
| Mechanics Outline (Game System Rules Reference) | https://claude.ai/artifact/FDKCXrjEGZtZgj5SWpMxvX | `731814f7-cc2f-4a32-abc4-875f5e5fc14c` |
| Game System Specifics | https://claude.ai/artifact/LS7SVkvhao9yeRQ52Yj8WD | `9d5f3283-d0bb-4ac0-ae71-f33d25f75c3a` |

Published artifacts:

- Game: https://claude.ai/artifact/WiZZp7VyJYCf7c7hZwVAQd (version 4).
- Arena results: https://claude.ai/artifact/8wLMyG578Csqdvxi9XErP7 (version 2).

The branch is `claude/game-platform`. The last commit before this handoff is
`140b7dc`.

## Architecture

The app is static, with no dependencies and no build step. Each file is a classic
script that attaches to `globalThis.BBB`, so `index.html` opens straight from
disk. The Node tests load the same files through `tests/load.js`.

```
index.html               shell; script order: config, data, items, character, magic,
                         combat, enemies, recovery, ai, then ui dom, store, dice, views, app
css/style.css            forged-iron theme, verdigris accent, light/dark tokens
src/rules/config.js      every tunable number; CONFIG.provisional is shown on the Rules tab
src/rules/data.js        ARMOR, SHIELDS, SHIELD_MATERIALS, QUALITY, COVERAGE, WEAPONS,
                         MOTIONS, ACTIONS, FEATS, TREES
src/rules/items.js       makeArmor/makeShield/makeWeapon, armorBase, shieldStats, itemName
src/rules/character.js   derived stats, feats (tier groups), attackOptions, strikeOption
                         (range bands, wind-up), actionCost
src/rules/magic.js       stub magic: SP, spellOptions, backlash
src/rules/combat.js      encounter, rounds, legalActions, declare, resolveRound,
                         computeHit/applyHit, shieldAbsorb, maneuvers, endRound
src/rules/ai.js          declaration policy: hit value per AP, preferred distance, kiting,
                         wind-up, sidearm swaps, odds-based defense
src/rules/enemies.js     templates (bandit … knight), generate, chooseFeats
src/rules/recovery.js    long rest
src/ui/                  dom, store (localStorage key bbb-table-v1), dice modal, app tabs,
                         views/{roster,sheet,enemies,battle,rules}
tests/                   node --test; 25 tests; asWritten() resets the tuned values to the Specifics
sim/                     lib, run, compare, targets, inspect, arena, arena-inspect,
                         arena-page (+ template), results/, FINDINGS.md
```

## How a round works now

> This is the old structure. Change it under idea 1 below.

1. Initiative is d10 + SPD, rolled in armor.
2. Declarations go in passes, in initiative order: one action per pass, and AP
   can't be held.
3. Resolution then replays the passes in order. Actions within a pass are
   simultaneous: positions are snapshotted at the start of the pass, and moves
   resolve at the end of it.
4. At the end of the round, bleed, regeneration and wind-up expiry are applied.

## Tuned values and why

Every value is in `src/rules/config.js`. The evidence is in `sim/FINDINGS.md`.

**Action economy**

- `apScale: 2`: AP pools and base costs are doubled, while a feat still cuts a
  flat 1. That makes feats a 1-in-4 saving instead of 1-in-2.
- `staminaScale: 3`, so a fight lasts more than one exchange.
- `moveScale: 2`: a square is roughly a pace.

**Damage**

- `pierceMode: 'roll'`: each leftover piercing point rolls a d10 against
  pass-through × 10 to see whether it reaches CON. Rounding piercing up leaked
  plate damage.
- `passThroughByArmor: { plate: 0.4 }`.
- `armorWearScale: 0.33` and `durabilityMitigationFloor: 0.75`.
- `armorAdjust: { plate: { stamina: 1, regen: 3 } }`: a slight plate retune
  the user asked for.

**Range**

- `range.closeRule: 'cannot'`: a weapon that isn't close-OK can't attack at
  range 1, rather than dealing half damage. The user explicitly asked for this.
- Close-OK weapons: dagger, club, maces, warhammer. Half-sword and the murder
  stroke also work at range 1.
- Thrust extension: rapier +1; spear +2, with a minimum range of 2.
- Greatsword reach is 3.

**Wind-up**

- Applies to the power motion, the longbow draw and Strong spells.
- Costs 2 AP base. Wind up in round N and release in round N+1.
- While wound up, the character can't block or parry.
- The wind-up is lost on knockdown, grapple, disarm or collapse.
- `rewindAfterRelease: true`.

**Shields**

- Block target on d10 by size: buckler 5, round 4, heater 3, tower 2.
- `shieldWearScale: 2`.
- A blocked power swing breaks the shield when the weapon's hardness ≥ the
  shield's hardness (wood 1, hide 1, iron 2, steel 3), unless the shield is
  masterwork.
- Force above the shield's break threshold pushes through as blunt.

**Shove**

- Costs 2 AP, range 1.
- Opposed roll: ⌊STR/2⌋ (+2 with a two-handed weapon) against footing.
- Pushes 1 square, or 2 on a margin of 5+. On a margin of 5+ with no room
  behind the target, it knocks them down instead.

**Bows**

- Shortbow: 5 P, range 2–12, 3 AP.
- Longbow: 7 P, range 2–16, with a draw wind-up.
- Both: −2 at long range, can't be parried, no STR bonus, and they use arrows.

**Magic stub**

- Verbs: Attack and Launch. Nouns: Fire and Force. Modifier: Strong.
- SP = INT + 3 × Casting rank.
- Feat tiers are pooled across the four magic sub-trees (`featTierGroups`).
  That fixed a deadlock, but the user hasn't confirmed it yet.

## Round 3 arena results

The arena is level 5, with 16 combatants (4 armor classes × 4 styles) in two
arenas: open field (20×12) and close quarters (6×2).

| | Open | Close |
|---|---|---|
| Heavy armor | 52% | 62% |
| Two-handed | 41% | 60% |
| Sword and shield | 68% | 70% |
| Archery | 59% | 44% |
| Magic (deferred) | 23% | 17% |
| Average fight length | 5.8 rounds | 4.2 rounds |

- **Sword and shield still dominates.** Its fighters step inside the longer
  weapon's reach and fight with dagger and shield.
- **Shove is almost never used**, about 0.04 per fight, because the target
  re-closes for 1 AP.
- **Halving movement** cut sword and shield to 55% in the open, but lifted
  archery to 65%.

## Open questions awaiting the user

1. **How a reach weapon keeps a shorter one out.** Options:
   - a set or stop-thrust;
   - extra AP to step inside an enemy's reach;
   - a shove that also costs the target AP;
   - no dagger in the shield hand.
2. **AP spend cap.** I recommended against a blanket cap: the pool is already
   the cap, and a lower cap only hurts fast or high-level characters. I
   suggested a defense cap instead (e.g. 2 blocks or parries per round) and
   offered to test it. No decision yet.
3. **A group-fight arena** (many-v-1, monster v heroes). The user noted that real
   scenarios are rarely 1v1.
4. **Magic overhaul.** Deferred by the user.
5. **Pooled magic feat tiers.** Needs confirmation.

## Next work: the user's four requests (not started)

### 1. Standardize terms

The user's definitions, verbatim:

> At the top of a round, everyone rolls initiative. Players then take their turns
> in order. One set of all players taking turns is a pass. All actions resolve at
> the end of the pass. Players begin taking their turns again for the second pass.
> Players get to participate in as many passes as their action points & action
> choices allow. Players that burn actions early may end up not participating in
> some of the final passes. Once everyone is out of actions, initiative is rerolled
> and a new round begins.

The glossary is **round → initiative → turn → pass**.

- **Engine change:** this is more than a rename. The engine currently declares
  every pass first and then resolves them all. The new definition resolves each
  pass at its end, before the next pass is declared.
- **What it touches:** `combat.js` (phases, `resolveRound`), the AI (it can now
  react to the results of the previous pass), the battle UI, the tests, the log
  text, the README, the Rules tab and FINDINGS.
- **Open sub-questions:**
  - Do defenses still answer a specific declared strike in the same pass?
    Probably yes, since a pass resolves simultaneously.
  - Does a wind-up that spans rounds still work as it does now?
  - Re-run the arena afterwards, because tempo changes.

### 2. Mobile battle UI

The user called it "unusable" on a phone: the actions sit at the bottom, below
a wall of combatant cards.

- The main view shows only the map, the current character's name, and the
  action panel.
- The action panel uses dropdowns or collapsible submenus (for example Attack ▸
  weapon ▸ motion ▸ target, then Defend, Move, Maneuver, Other) so it stays
  compact.
- Combatants move into a sidebar or drawer of names. Clicking a name opens that
  character's sheet as a pop-up or modal.
- The log and the declarations go into collapsible sections.
- Test at phone width (about 390px) with Playwright. Chromium is at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

### 3. Item materials, maker tags and keywords

These add to the existing quality + size + type.

- **Materials:** bronze, iron, steel, bone, leather, cloth, plus rare ones
  inspired by ebony or Daedric. The rarest tiers are undecided.
- **Maker tags:** dwarven-forged, elven-forged, and so on.
- **Keywords:** silvered, runic, magic, and so on.

The user is open to suggestions for the mechanics. Starting proposals, to put to
the user before building:

- Material sets hardness (already used for shield breaks), the durability
  multiplier, the weight/stamina modifier and the damage-vector tweak.
- Maker tags are a small trade-off: dwarven means more durability and more
  weight; elven means lighter, better edge retention and less durability.
- Keywords are hooks that mostly do nothing until monsters or magic need them.
  Silvered matters against certain creatures; runic carries a bound spell
  noun; magic is a generic enchantment slot.
- Fold SHIELD_MATERIALS into the general material table.

### 4. AP spend cap

This is optional. See open question 2.

## How to run things

```
node --test                                    # 25 tests
node sim/run.js [--set key=value]              # design-target sweep → sim/results/
node sim/compare.js                            # variants in sim/variants.json
node sim/arena.js                              # arena, ~3 min → sim/results/arena/
cp -r sim/results/arena sim/results/arena-r3   # keep a baseline before re-running
node sim/arena-page.js --baseline sim/results/arena-r3/arena.json --baseline-label "round 3"
node sim/arena-inspect.js light/shield heavy/twoHanded close 3
```

Republishing:

- **Game:** publish `index.html` to the game URL, with a `files` map covering
  `css/style.css`, every `src/rules/*.js` and every `src/ui/**/*.js`, each at
  its own path.
- **Arena page:** publish `sim/results/arena/report.html` to the arena URL.
