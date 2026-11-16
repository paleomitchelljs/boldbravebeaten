# Step F report: the clock (in progress)

## Where I am (running notes; a stop loses nothing)

- Baseline ("before") sims run on an untouched copy of 5e30e958 in the scratchpad (`before/`).
- F1 under way: config (`CONFIG.clock`), data tables in ticks (data.js MOTIONS/ACTIONS, shields, bows, spells,
  monsters' `tempo`), Character cost functions (`ticksFor`, `leadOf`, `moveTicks`, `pace`), the engine (begin, advance,
  landAction, spoil, waits, beat), reactions pushing clocks, conditions/terrain/traps/magic on the beat, AI ported,
  sim/lib, crawl, metrics (tick adapter). Duels run.
- Next: fix behaviour (waiting, reactions), port the remaining sims and tests, measure, then F2 (screen), F3.
