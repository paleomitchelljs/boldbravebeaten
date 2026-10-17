# Project memory: Bold Brave Beaten

Read `HANDOFF.md` first. It covers the state, the file map, the tuned values,
the arena results and the queued work.

## Working rules

- **Rules source.** The rules come from three Claude Docs: Philosophy, Mechanics
  Outline and Specifics (links are in HANDOFF.md). Departures from them go in
  `src/rules/config.js`:
  - mark each one TUNED or PROVISIONAL;
  - list it in `CONFIG.provisional`;
  - back it up with sim evidence in `sim/FINDINGS.md`.
- **No dependencies, no build step.** Classic scripts attach to `globalThis.BBB`.
  Rules code never touches the DOM, so it runs in Node.
- **Before committing,** run `node --test`. After a rules change, re-run
  `node sim/arena.js` and rebuild the page against the previous baseline.
- **Tests.** Tests that check Specifics numbers wrap them in `asWritten()`.
  Update that helper when a new tuned value is added.
- **The AI sees only what its character could see.** It doesn't see hidden
  strikes or the other side's AP.
- **Branch:** `claude/game-platform`. Republish both artifacts after a
  user-visible change (URLs are in HANDOFF.md).

## The user

- Codes in R and builds Stan models. Comfortable with simulation-based reasoning.
- Wants a plain position stated and defended. When unsure, say so.

## Terminology (the user's standard; apply it everywhere)

| Term | Meaning |
|---|---|
| Round | Starts with everyone rolling initiative. Ends when everyone is out of actions. |
| Turn | One character's go in initiative order; it may hold several actions up to the per-pass AP cap. |
| Pass | One set of everyone's turns. All of a pass's actions resolve at the end of that pass, then the next pass begins. |

Characters take part in as many passes as their AP and action choices allow.
Characters who spend early sit out the last passes.

## Current state (round 8)

- Each pass resolves at its end. Defenses are guards readied on your own turn (the next attack,
  or the next from a named foe), lasting until used or the pass ends. No defense step: the user
  found it arbitrary.
- The AP-per-pass cap is on trial (4 AP on the sheet).
- Inside a long weapon's reach, blows land at half force, all blunt (`closeRule: 'blunt'`).
  Drop weapon is free; drawing costs 1 AP on the sheet. Held in a grapple, any weapon (dagger
  included) fights cramped.
- Grappling ladder built: clinch → hold → pin (+ throw, break), directly opposed rolls, costly in
  stamina; plate easy to grab (+2) but hard to throw. Plate dominating is accepted (rarity).
- The mobile battle UI has been redesigned.

## Waiting on the user

1. **The cap.** Keep it at 4, change it to 6, or adjust two-handed costs?
2. **Item materials, maker tags and keywords.** The proposal is in HANDOFF.md; build only after
   the user approves.
3. **Throws:** teach the AI to throw plate wearers?

On hold at the user's request: group fights, the magic overhaul, the magic feat tiers. Magic users
are dropped from the arena entirely for now (`node sim/arena.js --with-magic` brings them back).
