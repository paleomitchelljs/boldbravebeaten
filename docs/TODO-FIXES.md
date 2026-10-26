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

## 2. One effect lookup: done

- [x] `Effects.sum(c, key, sub)`, `Effects.mult`, `Effects.has` and `Effects.list` read every source with one
  vocabulary:
  - monster traits;
  - gear (trinkets and enchantments);
  - conditions, whose numbers count per magnitude;
  - feats, whose `effects` count per rank.
- [x] The readers use it: AP pool and `apMult`, `costMult`, stamina and `staminaMult`, regeneration, `moveMult` and
  `move`, `resist` (`damageMult`), aura, retaliate, init, hit, spell points and magnitude, heal, standing, `dodge`,
  `grip`, `slippery`, `pack`, slay, and the flags (`flying`, `incorporeal`, `undead`, `noBleed`, `tireless`, and every
  condition flag that was `Conditions.flag`).
  - So a ring can now grant `freedom` or `flying`, and a condition can grant `resist`.
  - `Conditions.flag`, `apMod`, `regenMod` and `moveMult` are gone, as are `gearMult`, `gearList` and `trinketAP`.
- [x] Vocabulary fixed where one word meant two things:
  - monster `regen` (regrowth) is now `regrow`;
  - a condition's `resist` (the attribute that shakes it off) is now `resistedBy`, freeing `resist` for keywords;
  - `nimble` is now `dodge`, the key Dodge Training also grants.
- [x] The frost ward and radiance are now `resist: {fire: 0.5}` and `resist: {shadow: 0.5}`.
  - Before, `halveFire` halved only bursts, runes and walls of fire, not a fire bolt.
  - `halveShadow` halved after armour; the keyword applies before it.
- [x] `traits.magicImmune` retired. In its place, a `magic` keyword multiplies every spell: `resist: {magic: 0}` is
  immune to all spells and to any condition a caster lays.
- [x] Six feats that were only a number declare `effects` in `feats.yaml`: Dodge, Parry and Shield Training (`dodge`,
  `parry`, `block`), Grappler (`grip`), Feint (`feint`) and Read Attack (`readAttack`).
- [x] One `blankHit()` replaces the four copies of the empty hit result.
- Checked: seeded `node tools/encounters.js --n 30` gives the same results to the digit before and after. It runs
  about 7% slower (118 s against 110 s), because every question now walks every source.
- Left in code on purpose:
  - Feats with a condition or a scale attached: Precision (light weapons only), Casting (two scalings), Fleet Foot
    (added before the move multiplier), Iron Stance (a flag times a config number), the armour mobility feats.
  - Traits that are a body measure or a monster's own mechanism, read only from traits: `size`, `displacement`,
    `element`, `constrict`, `regrow`.
  - A condition's attribute changes are still read apart from gear's, because gear raises the maximum and a condition
    does not.

## 3. A grapple stored as one link: done

- [x] Each fighter has `status.grapple = { partner, level: clinch | hold | pin, role: mutual | holder | held }` or
  null. It replaces five fields spread over the two fighters: `clinch`, `grappling`, `grappledBy[]`, `pinned` and
  `grapplingPin` (which was missing from `freshStatus`).
- [x] Only `Combat.setGrapple` writes it, to both fighters at once. Readers ask `Character.grapple/holding/isHeld/
  isPinned/inClinch`.
- [x] `Character.normalize` turns an old save's five fields into the link.
- Departure from the plan: the link lives on each fighter, not on the encounter. The character rules that read it
  (attack options, defence costs) are handed a character without its encounter, so moving the link there would mean
  threading the encounter through the Character API. Two mirrored copies written by one function keep the guarantee
  that mattered: the two sides can't disagree.
- Checked: the seeded encounter sims give the same results to the digit, the alligators' grapples included.

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
