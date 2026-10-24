# Review of the core mechanics and their implementation (2026-10-24, at commit d861805)

What I read: `src/rules/` (combat, character, magic, conditions, terrain, items, enemies, ai, recovery), the game layer
where it touches fights (battle, town, world, parley, equip, loot, economy), `data/` and the tests. What I ran: the test
suite, `tools/encounters.js` at 30 and 300 fights per encounter, and small probe scripts for each suspected bug. Where a
claim below rests on a probe, the probe's result is quoted; where it is a judgement, I say so.

## 1. Bugs found and fixed in this pass

| # | What was wrong | Evidence | Fix |
|---|---|---|---|
| 1 | **Shoves and throws went through walls.** `resolveManeuver` checked only the grid edge and other bodies, not `Terrain.passable`. | Probe: STR 10 shove at a foe with dungeon wall squares behind it: `A shoves T back 2 squares`; the foe ended on (5, 2), `passable? false`. | Both now go through `Magic.push`, which stops at walls. A shove of margin 5+ against a wall knocks the target down, as the rule says. |
| 2 | **Knockback, shoves and wind blows ignored what they drove a body into.** A push over a pit, rune or fire square had no effect. | Probe: pushed 2 squares across a pit square: landed beyond it, `prone? false`. | Each square a body is driven into counts as entered (`Terrain.enter`): pits catch, runes spring, fire burns. This makes Wind, Force and shoves tactical tools, which the terrain spells seem to have been waiting for. |
| 3 | **Any shield stopped a spell bolt whole, for free.** `blowForce` of an energy bolt is 0 (its damage vector is empty), so the block cost no wear and absorbed nothing. | Probe: Strike + Fire against a heater block: `blocks … (durability −0)`, the defender lost only the block's own stamina. | Changed to your item list's premise ("Spellbreaker can be used to block spells"): ordinary shields can't block spell bolts, only dodge them; `blockSpells` shields can. `CONFIG.defense.blockSpells: false` (true restores "any shield blocks"). **This is a ruling; confirm it.** |
| 4 | **A content name was hard-coded in the game layer.** `battle.js` credited bounties for faction `cutthroats` and `town.js` paid them from `town_watch`. | `grep` of `src/`. | Moved to `rules.yaml game.bounty`; the validator checks the factions exist. (`'stonebridge'` remains as a last-resort fallback place in two spots.) |
| 5 | **Raise ignored the body.** Conjure + Life made a fresh zombie from the template for 4 rounds, whatever had died. | `Enemies.makeConjured('raise')`. | Replaced by the Raise verb (see §5). |
| 6 | **Fear did nothing visible to an AI.** A frightened creature couldn't close on or strike its source, so it stood or turned on someone else. | `ai.js` had no fear branch. | The AI now backs away while within 3 squares of what frightens it. |

Encounter sim, level-1 party, 300 fights each, before → after all of the above: every encounter within noise (crew 89% →
88% wins, troll 92% → 92%, horde 19% → 19%). Level-1 balance did not move, and the preset party doesn't use the new
spells or items, so the sim says nothing yet about whether *those* are balanced.

## 2. Problems found and left for a ruling

1. **Opportunity strikes fire on any step that starts in reach, not only on leaving it.** CLAUDE.md's terminology says
   "an opportunity strike at a foe leaving your reach"; `opportunities()` asks only whether the step *starts* in reach.
   Probe: a sidestep from (2, 2) to (2, 3) beside a longsword wielder, still 1 square away, drew a strike. The config
   comment wants stepping *in* past a longer thrust to provoke, so the rule is probably "provoke if the step ends out of
   reach or closer than it started". That would be a two-line change; I didn't make it because it changes how
   melee lines work.
2. **Stamina and ammunition are spent before the line check.** A strike or arrow stopped by a wall still costs its
   stamina and the arrow (`resolveAction` pays, then checks the line). Small, but a player will notice a lost arrow.
3. **Conditions that move STR, DEX or SPD change maximum stamina** (they are in its weights), and current stamina is
   neither raised nor clamped when the condition ends. A −2 STR Enfeeble lowers max stamina by 2; a +1 SPD sash raises
   it by 1. Probably harmless; decide whether stamina should read *base* attributes.
4. **Dead feats.** `mod_swift` teaches a modifier that doesn't exist in `spells.yaml`; `verb_summon` exists only for the
   ritual. A player can buy either for nothing. 65 feats are `auto: false` (known in HANDOFF; these two are not listed).
5. **Content in AI code.** The AI's value tables are keyed by condition names (`mesmerized: 30`, `rooted: 30`…), and
   I extended them for the new conditions. Every new condition needs an AI edit or it is valued at a default 6–10.
   Moving a `worth` field into `CONFIG.conditions` would keep it data. The recoil log line names `chitin` in code.
6. **Backlash makes the new top-end spells very risky.** d10 + Control against the spell's cost: Raise + Spirit
   costs 9, so with Control 0 it backlashes 80% of the time for about 7 stamina. That fits "magic is risky", but say so
   on the sheet, because a player won't infer it.

## 3. The mechanics: what holds up and where the risk is

**What holds up.** The engine does what the Philosophy asks. Damage goes to a stamina pool and to attributes, not to
a growing HP number. Armor works by physics (punch against resist, gap rolls, pass-through), and the sims show the
ordering you wanted (plate beats mail 92–5 in duels). Styles get their place from encounters rather than parity, and
the code keeps that distinction honest: monsters aren't hand-tuned against a style. Data-driven content is real
(every catalog comes through `Content`), and the validator catches cross-reference errors well.

**Risk 1: groups snowball, and the turn model is why.** Defences are reactions paid from the same pool as the
defender's own turn, one per blow. Each extra attacker therefore drains the defender's pool *and* its offence, so a
numbers advantage compounds faster than linearly. The sims show it: skeleton squad 0–1% wins, revenant knight 0%,
horde 19%. HANDOFF already says to tune the AI first. My judgement: AI tuning alone won't fix the shape of this,
because it is structural. Options that keep the turn model: a second defence against the *same* attacker in a round
costs less; or one free "cover" reaction per round for a shield-bearer beside an ally. Either should be simmed against
the squad and horde.

**Risk 2: a blow is hard to predict.** One sword blow can call for: an opposed defence roll, a gap d10, a d10 per
point of piercing for pass-through, a vital-wound d10, d4s per point of slashing, knockback, a shield-break d100 and
now on-hit procs. The AI sees expected values (`computeHit` blends the gap outcomes); the player sees none. HANDOFF
lists "outcome not previewed when choosing a target". I'd move it to the top of the list: without it the
armor-by-physics work is invisible to the player.

**Risk 3: magic items can route around "magic is learned and risky".** Powers cast with no spell points, no free hand
and no backlash, so the Veil circlet (at will) and the dread-eye staff give non-casters reliable magic. I followed your
list, but I'd put charges on the circlet before playtest. The silk sash (×0.8 AP on everything) stacks with the Quick
feats and is probably the strongest item in the game; it needs a duel sim. The Philosophy says power should come from
reacting more and mitigating; `hit` (+1 to beat a defence) is the one effect that is a plain bigger number.

**Risk 4: untested long-run economy.** Weariness, weapon wear, rest-and-repair and now companion wounds only show up
over a whole dungeon, and the encounter sim starts every fight fresh (HANDOFF). A multi-fight sim is the next sim to
write, before tuning any of these.

## 4. The implementation

- **Layering is clean.** `rules/` and `game/` have no DOM; everything runs in Node; 147 tests cover the rules, the game
  layer and every screen in a fake DOM. The fake DOM catches exceptions, not layout (as CLAUDE.md says).
- **`combat.js` is 2,100 lines, and `resolveAction`'s strike branch has become a list of special cases** (rust, webs,
  kindled, recoil, elementals, displacement, wards, now gear effects). I put the new weapon effects in one function
  (`strikeEffects`). The monster traits would read better as the same kind of on-hit hook table.
- **Performance.** `Character.attr()` now consults worn gear, so the encounter sim takes about 8% longer (12.9 s → 13.9 s
  for 30 fights × 9 encounters). There is a fast path when a character has no worn things or enchantments. If it starts
  to matter, cache gear effects per character and invalidate on equip.
- **Saves.** The format has a version field but no migration (HANDOFF). This pass migrates old trinkets in
  `Character.normalize` (charm → neck, ring → ring1/ring2), which is the pattern to keep using.
- **Design docs drift.** The Mechanics Outline and Specifics still describe passes and the old reach (HANDOFF). The code
  is now the only accurate description of the turn model; `CONFIG.provisional` is the nearest thing to a current spec.

## 5. What was added in this pass (for reference)

- **Equipment slots** (data-driven, `rules.yaml game.wornSlots`): head, neck, shoulders, cape, arms, hands, two rings,
  legs, boots; the chest is the armor. The body slots hold worn things only. **Open question:** do you want armor
  split by body part? That would replace the one-piece-with-coverage model you ruled on (coverage full/half/partial,
  no layering).
- **Magic items**: an effects layer (`Character.gearSources` and friends), weapon on-hit effects, powers with daily
  charges, 13 enchantments, 15 worn items, a black-forged origin, staff and short sword types, and a `relic_cache` loot
  table nested in three hoards. Names are placeholders: the project rule is no names from published settings, so
  none of the list's EverQuest names are in the data.
- **Spells**: Acid, Charm, Stillness (paralysis), Veil (unseen), Bone; frost chills (half the squares); lightning
  chains; darkness hurts and slows; the Delayed modifier; the Raise verb (skeleton, zombie, revenant); Conjure + Vine
  summons a wolf. Walls, pits and rune traps already existed (Build, Open, Inscribe).
- **Companions**: Familiar and Animal Companion feats, `src/game/companions.js`.
- **Art**: `data/art.yaml`, creature art in the map renderer with the Pixel Crawler figure as fallback, party looks,
  spell-bolt effects, and `art.html` to see them all.
