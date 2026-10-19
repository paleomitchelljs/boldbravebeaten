# Bold Brave Beaten

A turn-based party RPG for the browser, in the spirit of the first-person CRPGs of the 1990s with a tabletop
rules core. You lead four adventurers out of a river town into dungeons, sneak, pick locks, talk, bribe,
threaten, trade, and sometimes fight, in a combat system where one unarmored stab can kill anyone and armor is king.

It is a **draft**: a playable vertical slice with one town and four dungeons, built to be changed. The game is its
data: monsters, items, spells, feats, skills, factions, people, quests and maps are YAML files in `data/`.

## Play

No build step, no dependencies. Serve the folder and open it:

```
python3 -m http.server 8000      # or: npx serve .
# then open http://localhost:8000/
```

Opening `index.html` straight from disk also works after `node tools/bundle.js` (browsers will not let a page
read other files from disk, so this packs the data into one script).

On GitHub Pages: push, and the workflow in `.github/workflows/pages.yml` runs the tests and publishes the site.
(Repository settings → Pages → Source: GitHub Actions.)

## What's in it

- **First-person dungeons** on a grid: doors, locks, secret doors, hidden traps, chests, sleeping and watching foes,
  camping with wandering visitors, a map that fills in as you see. Sneak (H) is slower and quiet; heavy armor rings.
- **Parley**: a conversation is a small contest with its own resources. Each person has disposition, willingness,
  courage, patience and a temperament that says which side of your reputation they care about. You charm, appeal to
  what they care about, intimidate, bluff, bribe or read them, then ask. Information, quests, favors and passage are
  topics with a price in willingness.
- **Factions and reputation**: standing with six factions, spreading to allies and (inverted) to enemies; renown and
  notoriety as two sides of your name. Standing changes prices, stock, who talks to you and what you may ask.
- **Combat**: the engine from the earlier rules testbed (see below): passes and AP, guards, physical weapons and
  wounds, armor and shields that wear, grappling, a verb × noun × modifier magic grammar, monsters with traits.
  The AI plays the foes and can play your side too (Bench simulations, the Auto-battle in debug).
- **Character sheet** with a paper doll that follows what is equipped. Gear is shared in a party pack.
- **Training only in town**: levels give feats, feats are bought at the Training Yard.
- **Test bench** (`bench.html`): edit any data file in the browser, validate it, apply it live, run many AI fights
  from the real content; plus the original GM table (`gm.html`) for sheets, enemy generation and typed-dice battles.

## Layout

```
index.html  bench.html  gm.html
data/            all content, YAML (docs/DATA.md)
src/data/        YAML reader/writer; content loader and validator
src/rules/       combat and magic engine (no DOM)
src/game/        world, exploring, parley, factions, economy, loot, saves (no DOM)
src/ui/game/     the game's screens, first-person view, paper doll
src/ui/bench/    the test bench;   src/ui/views/ and app.js: the GM table and the battle screen
tools/           validate, bundle, encounters   sim/  rules experiments   archive/  the testbed's old notes and results
tests/           node --test (rules, content, game, every screen rendered in a fake DOM)
```

## Tests and checks

```
node --test                 # about 120 tests, a few seconds
node tools/validate.js      # data cross-references
node tools/encounters.js    # how the example party does against every authored fight
```

## Where the rules came from

The combat and magic rules were worked out in an earlier project (a browser testbed for a tabletop RPG) from three
design documents: a Philosophy, a Mechanics Outline and a Specifics doc. This repo turns that testbed into a game.
The earlier notes and simulation results are in `archive/` for reference; nothing there is binding.
`sim/FINDINGS.md` holds the evidence behind each tuned combat number.
