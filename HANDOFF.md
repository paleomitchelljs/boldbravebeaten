# Handoff

State of the project after the first conversion of the rules testbed into a game. Read `CLAUDE.md` for the working
rules and `docs/DATA.md` for the content schema.

## What exists

| Layer | Files | Notes |
|---|---|---|
| Content | `data/*.yaml` | Source of truth for everything an author edits. The engine's old in-code catalogs (armor, weapons, feats, monsters…) were exported to YAML (`archive/tools/extract-content.js`) and removed from code. |
| Loader | `src/data/yaml.js`, `content.js` | Own YAML-subset parser (round-trips every catalog; no dependency). `Content.installAll` fills the engine's catalog objects in place, so a live edit takes effect without reload. `Content.validate()` is the cross-reference checker. |
| Engine | `src/rules/*` | Unchanged except: catalogs now come from YAML; `surprise` on an encounter (`enc.surprise = {side, factor, round}` halves that side's AP in a round); monsters/foes carry `faction, xp, glyph, lootTable`. |
| Game | `src/game/*` | `world` (save shape, supplies, XP, quests), `explore` (grid movement, awareness, locks, traps, camp), `parley`, `factions`, `skills`, `economy`, `equip`, `loot`, `battle` (build foes, start, settle), `town`, `save`, `auto` (AI plays a whole battle). |
| UI | `src/ui/game/*` | Title, creation, town, first-person explore, parley, battle (wraps the old battle screen through `app.hooks`), sheet with paper doll, pack, journal, standing, menu + debug. |
| Bench | `bench.html`, `src/ui/bench/` | Content editor with patch-in-localStorage, sim runner, tools. `gm.html` is the original GM table. |

Content: one town (Stonebridge) with an inn, forge, market, temple, training yard and gatehouse; four dungeons
(Undercroft ×2, Hollow Barrow, Gallows Cave); 10 people; 6 factions; 5 quests, two of them a faction quarrel; loot tables.
All names are placeholders and setting-free; the content is meant to be replaced.

## Verified, and not

- Verified: `node --test` (119 at the time of writing) covers the rules, the content cross-references, map reachability,
  the game layer (parley, factions, exploring, economy, equipment, training, saves, a fight with XP and loot), and renders
  every screen, overlay, shop tab and every square of every map in a fake DOM (`tests/fakedom.js`). A battle is played
  through the real battle screen with the AI on both sides.
- **Not verified: how any of it looks.** The sandbox this was written in could neither serve a page nor let a browser
  open a file, so the CSS, the first-person renderer, the paper doll and the layout at phone width have never been seen.
  Expect cosmetic bugs. First thing to do: serve the folder, play through once, and fix what's ugly. The emoji used as
  sprites depend on the system's emoji font.
- The first-person view is a plain grid raycaster with flat shading, brick lines and emoji billboards. It is a base to
  replace with real art, not final.

## Design decisions made (change any of them)

- **Party of four, shared gold, shared pack, pooled supplies.** Bandages, arrows and components are dealt to members at the
  start of a fight and collected after (`World.loadSupplies`). Simpler than per-character inventory; loses "who carries what".
- **Levels grant feats, not power.** A level gives a feat to buy at the Training Yard, for gold, only in town. A freshly
  levelled party is no stronger until it trains (the encounter tool shows this). XP: 60 × n(n−1)/2.
- **Stamina refills after a fight; wounds don't.** The attrition is CON damage, bleeding, durability, arrows. A "breather"
  is free; a night's rest is the heal roll.
- **Hidden things and awareness.** Passive perception gets one roll per hidden thing, three worse than a deliberate search.
  Sleepers notice you at 2 squares, watchers at 4; sneaking rolls the group's stealth (mean of best and twice the worst).
  An ambush gives the enemy half AP in round one (a quarter, or none, with the Ambusher feat).
- **Parley is deterministic once willing.** Dice go into the moves; asking succeeds if willingness ≥ the topic's need.
- **Faction standing** spreads a quarter to allies and half, inverted, to enemies. Kills cost 3 with the victim's faction
  (not for "wilds"); knocking foes out costs nothing.
- **Table-ruling feats are hidden from the Training Yard** (`auto: false`). I set `auto: true` on the ones the game layer
  now implements (the social and perception feats, stealth, herbalism) and added a Subterfuge tree (lockpicking, trap craft,
  ambusher).
- **Renamed** the few creatures taken from published games (displacer beast → mirage cat, owlbear → beakbear, sarnak →
  scaleward, froglok → bogfolk, death knight → revenant knight). `archive/` keeps the old names.
- **Left alone on purpose:** the old open questions (AP cap at 4, item materials/maker tags, teaching the AI to throw,
  beats within a pass). They are in `archive/docs/HANDOFF-rules-testbed.md`.

## Known gaps and cheap next steps

1. Look at it in a browser and fix layout. Mobile: the controls pad and sheet are the likeliest to need work.
2. **Magic in play**: casting works in fights (via the engine) but nouns are scarce (books, creation pick) and the Lore/ritual
   screen exists only in the GM table. A "Rituals" overlay over `Ritual.perform` with `secrets` from `places.yaml` would
   close that. The `secrets:` lists in places are already authored.
3. Feats that need rules code to mean anything outside a fight (tracker, appraise, diagnose, alchemy, light fingers,
   danger sense beyond camp) are `auto: false`.
4. Monsters don't move on the map; fleeing returns you to the stairs. Wandering is only camp interruptions.
5. No companions, hiring or vendors that restock. No lighting/torch resource, no hunger. Add if wanted; each is a small
   data-plus-rules change.
6. Combat balance for the slice (`node tools/encounters.js`): the first dungeon is easy for the example party with the AI
   driving (rats 100%, guards 100%, Rusk's crew about 97% with ~1 death per fight); the barrow squad is 70%; the revenant knight
   ~0% by design (seal the door instead). Troll alone is trivial for four. Tune with data, not code.
7. Social balance has no sim yet: a bot that tries each path (fight / parley / sneak) through the Undercroft would show
   whether every style has a route. `Parley` and `Explore` are DOM-free, so it can be written in Node.
8. Save format is the whole world as JSON (`Save.serialize`); a version field exists but no migration yet.
9. GitHub Pages: the workflow assumes the default branch is `main`.
