# Bookkeeping fixes

This list comes from the bookkeeping review of 2026-10-26. The order is the order of work. Each item is ticked when
it is pushed, with its commit. Tests (`node --test`) and `node tools/validate.js` pass at every tick.

The problem behind all five: each mechanic added its own place to store what it does and its own key names, and
nothing checked those names (the leg-wound trip read `traits.flier`; the trait is `flying`).

## 1. A list of valid keys, checked by validate.js: done

- [x] One registry, `src/rules/effects.js` (`Effects.KEYS`), names every key the code understands in each bag:
  monster `traits`, a weapon's `trait`, enchantment `effects` and `strike`, a trinket's `effects`, and a condition's
  fields.
- [x] `Content.validate()` rejects an unknown key and names the bag it was in.
- [x] `tests/effects.test.js` scans `src/` for every `traits.X`, `gearSum/gearMult/gearList(c, 'X')` and
  `Conditions.flag(c, 'X')` and requires each key to be in the registry, so the registry can't fall behind the code.
- [x] Fixed a collision: gear's `apMult` is now `costMult`. On a monster, `apMult` multiplies the AP pool; on gear it
  multiplied each action's cost.
- Found while building it: three condition fields the data set and no code read.
  - `vsUndead`: the spirit shield guarded against everyone; now it guards only against the undead.
  - `breakAttr`: Break free now rolls the named attribute.
  - `fearOf`: fear is now found by this flag, not by the key `frightened`.
- Not covered: top-level fields of monsters, weapons and the like. Those are checked by reference (an armour must
  exist), but a misspelt top-level field is still silent.

## 2. One effect lookup

- [ ] `Effects.sum(c, key)`, `Effects.mult(c, key)`, `Effects.has(c, key)` and `Effects.list(c, key)` read every
  source with one vocabulary:
  - monster traits;
  - gear effects (trinkets and enchantments);
  - condition flags.
- [ ] Move the trait and gear readers onto it. Examples: `traits.moveMult` with gear `move`, `traits.aura` with gear
  `aura`, `traits.regen`, `staminaMult`, `nimble`, `grip`, `slippery`.
- [ ] Feats that are only a number (+N to a roll, −N mitigation) declare it in `feats.yaml` (`effects: {key: perRank}`)
  and feed the same lookup. Feats that are their own maneuver stay in code.
- [ ] Retire `traits.magicImmune`: no data uses it now that resist keywords exist.

## 3. A grapple stored as one link

- [ ] Grapples live on the encounter as `{ holder, held, level }` entries (level: clinch or pin). This replaces the
  five fields spread over two characters (`grappling`, `grappledBy[]`, `clinch`, `pinned`, `grapplingPin`).
- [ ] The helpers (`holds`, `heldBy`, `release`) are the only code that touches it.

## 4. Harm as a list of entries (deferred)

- [ ] Rebuild the hit result as entries of `{ keyword, to: CON|stamina|attr, amount, location }` in place of about
  20 parallel fields.
- Do this when the next new damage destination or a keyword *boost* arrives, not before. It is the riskiest change of
  the five and touches every reader of a hit result (combat, AI, UI log).

## 5. Saves carry a version

- [ ] Save data says which version it is. `save.js` upgrades an old save step by step at load time.
- [ ] The old-save fallbacks inside the rules move into that upgrade:
  - `blade.enchant.drain`;
  - a single `status.dropped` id;
  - `armor` alongside armour `pieces`;
  - `c.gold`.
- [ ] Supplies: one party pool. Each character's `inventory` keeps no bandages or arrows outside a fight.
