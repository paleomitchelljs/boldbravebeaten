# Handoff: Bold Brave Beaten

Where the project stands after round 4 (pass-by-pass resolution and the per-pass AP cap), and what comes next. Read this
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

The branch is `claude/game-platform`.

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

1. Initiative is d10 + SPD, rolled in armor.
2. **Turns** go in initiative order. A turn can hold several actions, up to `apPerPass`
   (2 base AP, 4 on the sheet). An action costing more pays from the next passes' allowance and
   lands at the end of the pass in which it is fully paid.
3. Defenses are **guards**, readied on your own turn: a block, parry or dodge that meets the next
   attack landing on you this pass, or the next from a named foe (`against`). A guard lapses at the
   end of the pass (`guardLasts: 'pass'`). A guard that can't meet an attack (a parry against an
   arrow) stays up. There is no separate defense step: the user found one arbitrary, and saving AP
   for unanswerable late actions is meant to be the big advantage.
4. The **pass** resolves (`Combat.resolvePass`): its actions land together, in initiative order;
   positions are taken from the start of the pass, and moves land last.
5. Passes repeat while anything is pending or anyone can act; a pass in which nobody starts or
   lands anything ends the round. At the end of the round: bleed, regeneration, wind-up expiry.

Engine API: `startRound`, `currentActor`, `legalActions` (with `passLeft`, `step`,
`incomingLater`), `declare`, `endTurn`, `concede` (done for the round), `submit` (one entry
point for AI decisions), `resolvePass`, and `resolveRound` (resolves passes until someone has to
decide something). Drivers: `sim/lib.js` `playRound`, the AI-vs-AI test, and `scheduleAI` in
`src/ui/views/battle.js`.

## Tuned values and why

Every value is in `src/rules/config.js`. The evidence is in `sim/FINDINGS.md`.

**Action economy**

- `apPerPass: 2` (trial; the user asked for it) and `spanLands: 'late'`. See round 4 in FINDINGS.
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

## Arena results (round 4)

See `sim/FINDINGS.md` and the arena page. With the 4-AP cap, style averages (open / close):
two-handed 35 / 53, sword and shield 63 / 72, archery 55 / 43, magic 33 / 24, heavy armor 54 / 70.
Fights last 5.6 / 3.8 rounds. The round 3 baseline is in `sim/results/arena-r3/`.

- Resolving each pass did not keep a dagger out of reach; sword and shield still leads.
- The cap hurts two-handers most (slow swings land a pass later).
- A 6-AP cap balanced the open field best.

## Open questions awaiting the user

1. **How a reach weapon keeps a shorter one out.** Pass-by-pass resolution didn't solve it.
   Options: a set or stop-thrust; extra AP to step inside an enemy's reach; a shove that also
   costs the target AP; no dagger in the shield hand.
2. **The AP cap.** On trial at 4 AP per pass. Does it stay, at 4 or 6? Do two-handed costs need
   adjusting (or `spanLands: 'now'`)?
3. **Item materials, maker tags and keywords.** A proposal went to the user (see below); nothing
   is built yet.
4. On hold at the user's request: the group-fight arena, the magic overhaul, the magic feat tiers.

## Done in round 4

- Terms standardized across the engine, UI, Rules tab, README and FINDINGS: round → initiative →
  turns → pass → resolution. (A defense step was tried, then replaced by guards in round 5.)
- The mobile battle UI was redesigned. The screen holds a strip of names (a sidebar on wide
  screens), the map, and the current character's panel with collapsible groups (attack, guard,
  move and maneuver, other). Tapping a name or token opens a pop-up sheet. The
  declarations and the log fold away. It was tested at 390px and 1280px with Playwright.
- Saved battles from before round 4 resume at the next round.

## Item system proposal (for the user to approve)

- Material table, replacing SHIELD_MATERIALS. Each material has hardness (used for shield breaks
  and edge damage), a durability multiplier, a weight step, and a small damage tweak:
  - cloth and leather for armor;
  - bone and bronze, softer and cheaper;
  - iron as the baseline;
  - steel, harder and more durable;
  - rare: an ebony-like material (hard and light) and a daedric-like one (hardest and heavy,
    with a corrupting keyword).
- Maker tags, each a trade-off:
  - dwarven: +durability, +weight;
  - elven: −weight, +edge (slashing), −durability;
  - orcish: +blunt, crude finish.
- Keywords as hooks:
  - silvered: extra damage against creatures tagged as vulnerable;
  - runic: carries one spell noun;
  - magic: one enchantment slot, effect TBD.
  Each keyword does nothing until a monster or spell asks for it.

## How to run things

```
node --test                                    # 26 tests
node sim/run.js [--set key=value]              # design-target sweep → sim/results/
node sim/compare.js                            # variants in sim/variants.json
node sim/arena.js                              # arena, ~3 min → sim/results/arena/
cp -r sim/results/arena sim/results/arena-r4   # keep a baseline before re-running
node sim/arena.js --out /tmp/x --set apPerPass=3  # a variant
node sim/arena-page.js --baseline sim/results/arena-r4/arena.json --baseline-label "round 4"
node sim/arena-inspect.js light/shield heavy/twoHanded close 3
```

Republishing:

- **Game:** publish `index.html` to the game URL, with a `files` map covering
  `css/style.css`, every `src/rules/*.js` and every `src/ui/**/*.js`, each at
  its own path.
- **Arena page:** publish `sim/results/arena/report.html` to the arena URL.
