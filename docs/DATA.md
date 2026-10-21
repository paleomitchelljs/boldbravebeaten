# Content reference: `data/*.yaml`

Everything an author might change is in these files. The loader (`src/data/content.js`) reads them when the
page starts; `node tools/validate.js` checks that every id used in one file exists in the file it points to, that
maps are rectangular and fully reachable, and that staircases come in pairs. The Test bench edits them live.

The dialect is a small YAML: maps, lists, `[a, b]` and `{a: 1}`, quoted strings, `|` text blocks, `#` comments.
No anchors or tags. Keys must be unique.

| File | What it holds |
|---|---|
| `rules.yaml` | Numbers: party creation, XP, training prices, time, skill target numbers, faction spread, parley, economy, the gear foes roll (`enemyGear`). `game:` keys are read by the game layer; anything else is deep-merged over `src/rules/config.js`. |
| `armor.yaml` | Armor types (padded, leather, mail, plate): mitigation per face (P pierce, S slash, B blunt), SPD/DEX penalties, stamina, regen, durability, usual and allowed materials, `pierce` (the punch that bursts it, the gap number), `transmit` (mail: more of a cut's force as blunt), `cutThrough` (padding and leather: how much cut they stop), `dissipate` (plate), rarity. Each piece is the whole harness: padding is assumed under mail and plate. `natural: true` for monster hides. |
| `shields.yaml` | `types` (block AP, threshold, durability) and `materials` (multiplier). |
| `materials.yaml` | What gear is made of: hardness, toughness, weight, protection, `metal`, `rusts`, `exotic`. |
| `origins.yaml` | Where and how gear was made (common, elven, dwarven, goblin): weight against protection, damage and durability. |
| `crafts.yaml` | Craftsmanship (poor, average, masterwork): durability, wear taken, shield break threshold. |
| `enchantments.yaml` | Rare enchantments: what they can be laid on and the multipliers or effects they add. |
| `weapons.yaml` | Weapons, including natural ones. `phys` (mass, length, point, edge, head…) generates damage, AP, STR scaling, wounds and punch through armor; `reach: {swing, thrust, min}`; `closeOK` (works in a clinch). |
| `feats.yaml` | Trees of feats: ranks, `requires`, effect line, `auto` (does the game implement it). |
| `spells.yaml` | The magic grammar: verbs, nouns, modifiers. |
| `monsters.yaml` | Creatures and packs. |
| `foes.yaml` | Templates for generated people (bandit, militia…), scaled by level. |
| `skills.yaml` | Checks outside combat: attributes, feats that add, armor penalty. |
| `items.yaml` | `goods` (supplies, potions, keys, books, trinkets, trade goods, components) and loot `tables`. |
| `factions.yaml` | Who is who, allies, enemies, start standing, ranks, perks. |
| `npcs.yaml` | People you can talk to, with topics. |
| `quests.yaml` | Staged quests with rewards. |
| `places.yaml` | The town and the dungeon maps. |
| `start.yaml` | New-game kits and the example party. |

## Adding things

**A monster** (`monsters.yaml`): copy one close to what you want.

```yaml
bogHag:
  name: Bog hag
  blurb: "Shown on the Enemies tab."
  faction: wilds          # whose standing a kill costs (wilds = nobody's)
  xp: 80                  # per creature
  glyph: "🧙"             # how it looks in the first-person view
  loot: beast_leavings    # a table in items.yaml, rolled when it dies
  attrs: {STR: 6, CON: 8, DEX: 5, SPD: 5, INT: 7, WIL: 9, WIS: 8, CHA: 3}   # may exceed 10
  natural: [claws]        # natural weapons, from weapons.yaml
  armor: fur              # natural armor, from armor.yaml
  traits: {regen: {con: 1, stamina: 4}}   # see the comment block in src/rules/enemies.js
  feats: {dodge_training: 1}
```
A pack is `{name, group: [wolf, wolf, alphaWolf]}`. Use it in an encounter: `{monster: bogHag}`.
People who carry gear come from `foes.yaml` templates: `{template: bandit, level: 2, n: 3}`.

**A weapon** (`weapons.yaml`): give it a `phys` block and a `reach` and the engine works out the rest. A new kind of
face, motion or trait still needs rules code; a new sword, mace or spear does not.

**An item's tags.** Every weapon, armor piece and shield is a type plus the same tags, wherever gear is written
(loot, shop stock, monsters): `material` (materials.yaml; armor only those its type lists), `origin` (origins.yaml),
`craft` (`poor | average | master`; an old `quality` is read as one) and `enchantments` (a list, usually absent).
Armor adds `coverage`; shields have a `size`. Material and origin set protection, weight and damage; craftsmanship
sets only how fast the item wears and how easily it breaks. A monster's carried gear: `craft` and `origin` for all
of it, or items spelled out: `armorItem: {type: plate, material: steel, origin: dwarven}`,
`weaponItems: [{type: longsword, name: Soulreaver, enchantments: [drinking]}]`, `shieldItem: {size: heater, material: adamant}`.

**An item** (`items.yaml` goods): `kind` is `supply | potion | key | book | trinket | trade | component`.
Potions have `use: {heal: 1}`, `{cure: bleeding}`, `{cure: poison}` or `{repair: 0.3}`. Books have
`teaches: {noun: fire}` or `reveals: [flag]`. Trinkets have `slot: ring|charm`, `attrs`, `ap`.
Loot entries: `{w: 3, gold: [5, 20]}`, `{w: 2, good: salve, n: [1, 2]}`, `{w: 1, weapon: dagger, craft: master}`,
`{w: 1, armor: mail, material: steel, coverage: half}`, `{w: 1, shield: round, material: iron}`, `{w: 4, nothing: true}`.

**A faction** (`factions.yaml`): `allies` and `enemies` say how a change in standing spreads (a quarter to allies,
half inverted to enemies; `rules.yaml`). `kos` is the standing at or below which members refuse to talk.
`perks` are shown to the player; a shop, topic or exit grants them by testing `{standing: {faction, min}}`.

**A person** (`npcs.yaml`): `disposition` (−5..5), `willingness` (0..10), `courage`, `patience`, `temperament`
(loyal, venal, moral, fearful, starstruck, provincial), `interests` (tags for the Appeal move), and `topics`:

```yaml
- id: mill
  label: "What do you know about the old mill?"
  need: 3                 # willingness required
  kind: info              # info | quest | favor | trade | pass
  tag: business           # an Appeal to this raises willingness for this topic
  lie: true               # a Bluff helps here
  requires: {flag: x}     # shown only when true     hide: {quest: y}  hidden when true
  once: true
  sets: [knows_mill]      # flags     starts: quest_id    takes: good_id    takes_gold: 100
  gives: {gold: 10, xp: 20, good: salve, flag: f}    standing: {town_watch: 3}    renown: 1    notoriety: 1
  text: "What they say."
```

**Conditions** (`requires`, `hide`, `reveal`, `done_when`, `req` on stock): `flag`, `noflag`, `item`, `gold`,
`quest` (`id` or `id:stage`), `standing: {faction, min, max}`, `level`, `renown`, `notoriety`, `day`, `any: [...]`,
`not: {...}`. All keys given must hold.

**A quest** (`quests.yaml`): `stages` each with a `text` and a `done_when` condition; the last stage completes it and pays
`reward` (`gold, xp, standing, renown, notoriety, good, flags`). `exclusive` closes the others when this one starts.

**A map** (`places.yaml`): one string per row. `#` wall, `.` floor, `+` door, space is solid rock. Every other character
is defined in the place's `legend`; the validator complains about a letter with no entry (or an entry not on the map).
Legend kinds: `stairs {to, at}`, `locked {tn, forceTn, key, alt[]}`, `secret {tn}`, `trap {tn, disarm, damage, text, reveal}`,
`monster {encounter, asleep}`, `chest {loot, tn}`, `pickup {good}`, `note {text, sets}`, `npc {npc}`, `shrine {heal}`,
`prop {sprite, scale, solid}` (scenery: a crate, bed, urn, candelabra… from the table in `src/ui/game/mapview.js`; solid by default).

**Looks.** `sprite:` on a monster, a foe template or an NPC names a sheet in `assets/sprites/` (knight, rogue, wizard, orc,
orc_rogue, orc_shaman, orc_warrior, skeleton, skeleton_mage, skeleton_rogue, skeleton_warrior) or is `{kind, scale, tint}` to resize
or colour-wash one. A party member's `look.sprite` / `look.tint` work the same way. Fights are played on a slice of the
dungeon map (`game.arena` in rules.yaml, 15x10): walls and furniture block, a shut ordinary door does not.
`encounters:` map an id to `{foes, flags, loot, text, parley, peaceFlags, arena}`. `wandering:` is what interrupts a camp.
A town has `locations` (people and services: `inn`, `shop`, `healer`, `trainer`, `bounty`) and `exits` to dungeons;
an exit with `requires` stays hidden until the player has heard of it. `look` colors the first-person view.

**The numbers** (`rules.yaml`): everything the game layer tunes. Anything outside `game:` is merged over the combat
engine's `CONFIG`, so a combat number can be changed beside the content it affects.

## Skill checks

`d10 + ⌊mean(attrs)/2⌋ + feat ranks × weight − armor penalty` against a target number (trivial 4, easy 6, moderate 8,
hard 11, formidable 14). The party's best member rolls for perception and appraisal; the chosen member for locks and
traps; stealth uses the group's quietest member weighted with its best. A 1 is a fumble, a 10 a clean success.
