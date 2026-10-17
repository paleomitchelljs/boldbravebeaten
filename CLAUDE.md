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
| Turn | One character's single action, taken in initiative order. |
| Pass | One set of everyone's turns. All of a pass's actions resolve at the end of that pass, then the next pass begins. |

Characters take part in as many passes as their AP and action choices allow.
Characters who spend early sit out the last passes.

## Queued work (not started)

1. **Terminology.** Includes the engine change to resolve each pass at its end.
2. **Mobile battle UI.** The main view is the map, the current character's name
   and a compact action panel with dropdowns. Names go in a sidebar, and
   clicking one opens that character's sheet.
3. **Items.** Materials (bronze, iron, steel, bone, leather, cloth, plus rare
   ebony- or Daedric-like ones), maker tags (dwarven-forged, elven-forged) and
   keywords (silvered, runic, magic). Propose mechanics to the user first.
4. **AP spend cap.** Undecided. I recommended a defense cap over a blanket cap.

Also open:

- the reach-keeping rule;
- a group-fight arena;
- the magic overhaul (deferred);
- confirming the pooled magic feat tiers.
