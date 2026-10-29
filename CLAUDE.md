# Project memory: Bold Brave Beaten (working title)

A browser party RPG in the style of the old first-person CRPGs, with tabletop-RPG rules underneath.
Read `HANDOFF.md` first: it is the to-do list. **After every push, update it** (tick or add items, and set its "Last updated at commit" line to `git log -1 --format=%h`). Content is in `data/`;
`docs/DATA.md` is the schema reference for it.

## What the game is for

- **Philosophy** (the user's design doc): classless; gear, preparation, knowledge and roleplay matter more than
  level. Fights are lethal and fast; power comes from reacting more, lasting longer and mitigating damage, never
  from a bigger HP pool. Armor is king in melee. Magic is learned, risky and feat-heavy. Social play is structured
  like combat. Training happens only between adventures.
- **Balance is differentiation, not parity** (as in classic EverQuest). A style can be hopeless in one setting and
  vital in another; hard counters are fine; every style needs a use somewhere, not necessarily in a fight. Judge sims
  by whether each style has a setting where it matters, not by even win rates. Combat, sneaking and talking are
  three settings of equal standing: when you add a mechanic ask which setting it serves.
- **No setting.** The engine and rules name no world, no gods, no history. Content (names, places, factions) lives
  in `data/` and is replaceable without touching code. Don't write lore into code or docs. This is a personal project:
  content may use names from published settings and games (the user's item list does).
- The rules came from three Claude Docs (Philosophy, Mechanics Outline, Specifics). They are drafts and open to
  pushback; the Specifics most of all. The old testbed's notes are in `archive/docs/`, as reference not instruction.

## Working rules

- **Data, not code.** Anything an author might want to change (monsters, items, weapons, armor, spells, feats,
  skills, factions, NPCs, quests, maps, loot, prices, rule numbers) is YAML in `data/`. The code reads it through
  `Content` (`src/data/content.js`). Adding a creature or a town should never need a code change. If it does, move
  the thing into data first.
- **Layers.** `src/rules/` is the combat/magic engine (no DOM; attaches to `globalThis.BBB`). `src/game/` is the world
  around it (exploring, parley, factions, economy, saves; no DOM). `src/ui/` is screens: one top-down map (`src/ui/game/mapview.js`; the art it draws is in `art/`) serves exploring and fighting; fights are played on a slice of the dungeon map (`Battle.dungeonArena`). The game's battle screen is `src/ui/game/screens/battle.js`; `src/ui/views/battle.js` is the older GM-table view and exports the command panel it reuses. Rules and game code run in
  Node; keep it that way so tests and sims can drive them.
- **No dependencies, no build step** for the game. `data/bundle.js` is optional (`node tools/bundle.js`) and exists
  only so `index.html` can open from disk; when served, the loader reads the YAML directly.
- **Before finishing a change:** `node --test` (rules, content, game, and every screen rendered in a fake DOM) and
  `node tools/validate.js`. **Encounter tuning is deferred** (the user, 2026-10-28: core changes first): don't run,
  report or tune against `tools/encounters.js` win rates until asked. After a map change run `node tools/pace.js` (time to
  explore; a thorough look at a dungeon should take about a day). The fake DOM catches
  exceptions, not bad layout: if you change CSS or the first-person view, say plainly that you could not look at it
  unless you did. `tools/shot.sh out.png "<js>"` takes a headless-Chrome screenshot after running some JavaScript in
  the page (start a game, travel somewhere, start a fight); use it to look. `node tools/encounters.js --n 300` takes
  about 7 minutes. In sims, `World.grantXP` raises the level but not the party's power (feats come from training in
  town), so a "level 3" party fights like a level-1 one.
- **Departures from the design docs** go in `data/rules.yaml` or `src/rules/config.js`, marked TUNED or PROVISIONAL and
  listed in `CONFIG.provisional`, with evidence from a sim in `sim/FINDINGS.md`. Tests that check Specifics numbers
  wrap them in `asWritten()`; update that helper when a new tuned value is added.
- **The AI sees only what its character could see.** It doesn't see hidden strikes or the other side's AP.
- Weapons come from physics: go through `Items.weaponStats(item)`, never the catalog's damage numbers directly.
- Don't tune individual monsters to fix a style's weakness; tune fundamentals.
- **Never generate or animate characters in PixelLab** (create_character, animate_character and the like): they are
  costly and the user makes them. Inspect, cut, map and wire up what the user exports. Tiles, props and pixel edits are
  still fine. Exception (the user, 2026-10-28): the fixes, strikes, deaths and idles listed in
  `assets/ideas/character-animation-plan.md` may be generated, in its order, logging each spend there. Never
  `create_character`.

## Terminology (the user's standard; apply it everywhere)

| Term | Meaning |
|---|---|
| Round | Starts with everyone rolling initiative. Ends when everyone has had their turn; unspent AP is lost. |
| Turn | One character's go in initiative order: as many actions as their AP pays for, each resolving as it is taken. |
| Reaction | Out of turn, paid from the same AP pool: a block, parry or dodge when a blow comes; an opportunity strike at a foe entering your reach, leaving it, or taking a second step within it. |

There are no passes (removed at the user's request): AP kept back from your turn is what you react with. In the
exploring and social layers the words are: *step* (one square), *move* (a social action, costing patience), *topic*
(something you can ask).

## The user

- Codes in R and builds Stan models; comfortable with simulation-based reasoning.
- Wants a plain position stated and defended. When unsure, say so.
- This is a draft-stage project: take what's here as ideas and guidance, not requirements.
