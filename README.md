# Bold Brave Beaten

A browser-based platform for a classless, lethal fantasy RPG. Players keep their
character sheets here, type in their own dice rolls when asked, and the platform
does the arithmetic: initiative, AP, stamina, armor mitigation, slashing→blunt
conversion, hit locations, bleed, shield breaks, healing. The GM can generate
enemies from templates and run turn-based battles on a grid.

The rules come from three design docs: *Game Design Philosophy*, *Mechanics
Outline* and *Game System Specifics*.

## Running it

No build step and no dependencies. Either:

- open `index.html` directly in a browser, or
- serve the folder (`npx serve .`) or turn on GitHub Pages for the repo.

Everything is saved in the browser's local storage. **Company → Save and move**
exports the whole table (characters and any battle in progress) as text that can
be loaded on another device.

## How a session runs

1. **Company / Sheet**: build characters. Attributes, gear (quality + size + type
   keywords), and feats from all trees, with tier and prerequisite checks. Derived
   numbers (max stamina, regen, AP, attack costs and damage) update live.
2. **Enemies**: pick a template (bandit, militia, sellsword, brute, duelist,
   brawler, man-at-arms, knight) and a level. Level sets feat count and gear
   rarity, so plate only appears on high-level foes.
3. **Battle**: choose combatants and a grid size, place tokens, then for each round:
   - roll initiative (players enter a d10);
   - declare in initiative order, one action per pass: strikes, block/parry/dodge
     answering a specific declared strike, moves, trips, disarms, grapples,
     bandaging, and so on. Remaining AP is hidden; Feint hides strikes from anyone
     whose Read Attack rank is lower;
   - resolve: the platform replays the declarations pass by pass and asks each
     player for the rolls it needs (defense checks, slashing d4s, opposed checks);
   - end of round: bleed and regeneration are applied automatically.
4. After a battle, take loot from the fallen. Then use **Long rest** on the Company
   tab for daily heal rolls, with an optional tender and town bonus.

Characters set to **Roll automatically** have their dice rolled for them, and
(optionally) an AI declares their actions. Usually that means enemies, but any
character can be switched.

## Layout

```
index.html            page shell
css/style.css         styles (light and dark)
src/rules/            the rules engine — no DOM, runs in Node too
  config.js           every tunable number; PROVISIONAL marks placeholders
  data.js             weapons, armor, shields, keywords, rarity, feat trees
  items.js            item generation from keywords
  character.js        derived stats, feats, action costs, damage vectors
  combat.js           round structure, declarations, resolution, damage pipeline
  enemies.js          enemy templates and generator
  recovery.js         long rest and daily heal roll
  ai.js               simple declaration policy for computer-run combatants
src/ui/               the browser interface
tests/                Node tests for the rules engine
```

## Tests

```
npm test   # or: node --test
```

The tests check the Specifics worked examples (a longsword swing against mail
costs 1 stamina; the same swing unarmored deals 7 slashing and then 7 CON of
bleed), feat prerequisites, declaration order, Feint visibility, healing, and
120 randomized AI-vs-AI fights.

## Simulations

`sim/` drives the real rules engine with the AI over thousands of fights to answer
the questions in the Specifics simulation plan. Start with
[`sim/FINDINGS.md`](sim/FINDINGS.md): what changed, the evidence, and the design
questions the sims can't settle.

```
node sim/run.js            # full sweep (about a minute) → sim/results/
node sim/compare.js        # rule variants side by side (sim/variants.json)
node sim/arena.js          # armor × style arena (about 3 minutes) → sim/results/arena/
node sim/arena-page.js --baseline sim/results/arena-r2/arena.json --baseline-label "round 2"   # results page
node sim/arena-inspect.js light/shield heavy/twoHanded close 3   # one arena fight's log
```

## Placeholder rulings

Where the Mechanics Outline marks a rule **Open** (defense success checks,
knockdown chances, armor durability values, and so on), `src/rules/config.js`
supplies a placeholder so the game can run. Values marked TUNED were changed from
the Specifics numbers on simulation evidence (see `sim/FINDINGS.md`). Each one is listed in
`CONFIG.provisional` and on the in-app **Rules** tab. Change them there as
playtesting and simulation settle them.

## Not implemented yet

The full magic system (only a placeholder stub of a few words exists), the social system, terrain and stealth, and feats tagged "table ruling" on
the sheet (Cleave, Sweep, Shield Wall, Flurry, and others). These feats can still
be recorded on the sheet, but the GM has to apply them by hand.
