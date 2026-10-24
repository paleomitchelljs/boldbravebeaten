# Proposals awaiting a ruling (2026-10-24)

Nothing here is in the code yet. Each section gives the current rule, the options, and a recommendation.

## 1. Opportunity strikes: which steps provoke

**Now** (`combat.js opportunities`, `CONFIG.opportunityStrikes`): a step that *starts* inside a foe's melee reach
lets that foe strike once per move. So a sidestep that stays adjacent provokes; the step that first enters reach
does not (it starts outside), but the next one does; leaving reach provokes.

**What real fencing suggests** (judgement from the historical manuals' ideas of *measure* and *tempo*, not data):
the dangerous moments are crossing into the foe's measure, where a waiting fighter's stop-thrust meets you, and
turning away. Footwork inside measure is normal and guarded: fighters circle all the time. A step straight back in
guard is the standard safe move, but it gains nothing if the foe follows. A long weapon's advantage is that it
punishes the approach.

| Option | Provokes | Effect |
|---|---|---|
| A. Now | any step starting in reach | Footwork in measure is punished; a spear gets its stop-thrust only on the second step in |
| B. Leaving only (the CLAUDE.md wording) | a step that ends outside reach | Sidesteps and approaches are free; reach weapons lose their stop-thrust: least realistic |
| C. Measure | entering a foe's reach; leaving it; a *second* step within it in one move | One guarded step is free; the approach is where the danger is, so reach matters from the first step |
| D. C plus a guarded withdrawal | as C, but a withdrawal (a step back costing +½ AP) leaving reach doesn't provoke | Disengaging costs time instead of a blow |

**Recommendation: C**, then D if retreat turns out too costly in play. C changes every melee approach (the waiting
side gets the first blow, paid from its held AP; held AP is lost at round's end, so waiting has a price), so it
needs the duel and encounter sims before it goes in. I'm not confident about how the AI will handle it: it may stand
off at the edge of measure. That's realistic, but a sim would show whether fights stall.

## 2. Armor by body part

**Now** (`armor.yaml`, `Items.armorBase`, `CONFIG.coverage`): one piece per character, the whole harness, with a
coverage keyword. Coverage sets mitigation (−0/−1/−2), the armor penalties, piercing pass-through (50/60/75%), the gap
number (0/−2/−4), the vital-wound factor (×1/1.5/2) and durability. Padding is assumed under mail and plate (no
layering). A slashing blow already rolls a d4 location per point: 1 STR, 2 CON, 3 SPD, 4 DEX, which reads as arm,
torso, leg, hand.

Whatever is chosen, one design question comes first: **do armor pieces and the worn magic share slots?** In the
game the item list comes from, they are the same thing: boots are armor that may also carry magic. If the head,
arms, hands, legs and feet slots hold armor, Journeyman's Boots should become boots (leather, say) with an effect,
not a separate thing beside the sabatons. I'd do that: one item per slot, magic or not.

### Option A: the pieces set the coverage (smallest change)

Armor goes in the chest, arms, legs and head slots (shoulders, hands and feet optional). The chest piece decides the
type: plate, mail and so on. The other pieces decide the coverage: chest only = partial, chest plus two of
arms/legs/head = half, all four = full. Penalties and weight add up by piece.

- All the existing coverage numbers and sims stand: this only changes how the coverage keyword is reached.
- Mixed types (mail sleeves under a plate breastplate) count as the chest's type. That's a simplification.
- No new rolls.

### Option B: a blend by body share (no new rolls, mixed types count)

Each location gets a share of blows (say torso 40, arms 20, legs 20, head 10, hands 10). Each piece gives its own
mitigation, gap number and pass-through, and the armor that faces a blow is the share-weighted average (rounded),
worked out once on equip. Penalties and durability are per piece; wear goes to pieces by share.

- Mixed harnesses matter (plate legs over mail are better than mail alone) without a location roll.
- An average blurs what armor-by-physics does: a blow either meets plate or doesn't. Bursting (punch vs resist)
  against an average resist is a fiction.
- Moderate change: `armorBase` becomes a sum over pieces; the coverage keyword goes.

### Option C: a hit location per blow (most realistic)

A blow that lands rolls its location (d10, say: 1 head, 2–3 arm, 4–7 torso, 8–9 leg, 10 hand; the shares are a
guess, not historical data). The piece on that spot, or nothing, does everything the whole armor does now: resist,
gap, mitigation, pass-through and wear. Vital wounds use the location (head and torso high, a limb low, except the
thigh and armpit arteries). Find the Gap becomes literal: aiming at a missing piece.

- One location roll **replaces** the per-point slashing d4s: the location picks the attribute (arm STR, torso CON,
  leg SPD, hand DEX), and the head can carry stun or vital. The roll count doesn't grow; it probably falls.
  But all a cut's points then go to one attribute, which is swingier than now.
- An optional aimed blow (−2 to beat the defence, choose the location) makes "go for the unarmored leg" a real
  choice, which suits "knowledge and preparation matter".
- The AI and the outcome preview see the expectation over locations, which is what `computeHit` already does for
  gap rolls.
- The biggest change: `computeHit`/`applyHit`, the armor tests, every armor sim in `sim/FINDINGS.md` and the
  coverage keyword would all need redoing. The plate-vs-mail ordering would need re-checking.

### Recommendation

**A now, built so C can follow.** Store armor per slot from the start (one piece per slot, the same objects C
would read) and derive the coverage keyword from the pieces. That gives the slots meaning at once, keeps every
simmed number, and adds no rolls. Go to C if playtest says a mixed harness should matter. I'd skip B: it costs
nearly as much as C and blurs the physics the armor model is built on.

Layering (a gambeson under mail as separate pieces) is a separate question; the one-piece-per-slot model allows it
later as a chest "under" slot, but nothing above needs it.
