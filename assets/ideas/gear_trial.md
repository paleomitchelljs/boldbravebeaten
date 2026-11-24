# Gear trial: one weapon on the froglok

Status: **planned, not started** (2026-11-24). Answers whether weapons can be drawn as their own layer on a figure,
the first step of `potential_equipment_art.md`. One weapon, one figure, before building anything general.

## The question

Can PixelLab's Equipment creator (website only, experimental) give a weapon layer that sits in the figure's hand on
every frame, closely enough to draw over the bare body in the game? It takes a character's frames and an item
description and returns the item alone on each frame, with no anchor data. `potential_equipment_art.md` assumed
PixelLab could not give aligned layers and planned a magenta rod to find anchors. This tests that assumption.

A second question, free once the layer exists: can the layer serve as the magenta rod? A line fitted to the blade on
each frame gives a hand point and an angle. If another weapon's sprite drawn at those anchors looks right, one pass per
body serves every one-handed weapon.

## Why the froglok

- `froglok-plain` (Krump, state `No_sword`) is a bare body with every clip the game plays: 8 standing views, waddle
  (8 directions × 6 frames), leap (5 × 7), idle (5 × 5), punch (5 × 7) and death (south × 7).
- It is in the game as the bogfolk, so it can be seen in a fight without touching the heroes.
- Krump's armed state (`Idle`) is the same figure with a greatsword, made whole by PixelLab. At game scale it shows
  what a layer has to match.

## Where layers pay off

A layer is made on one figure's frames and fits only that figure. For a monster with a fixed kit it saves nothing:
bake the weapon in, as Krump's armed state does. Layers pay off for heroes, whose figure stays the same while their
weapons change all game. Baked, each hero × weapon pair is a full clip set (about 40-60 generations); layered, it is
one pass over clips already made. So the froglok stands in for the heroes here. If the trial works, a hero figure is
the first real use.

## The weapon: a shortsword

One-handed and short. The body's clips hold fists, and a one-handed sword fits any fist. A two-handed weapon does not:
in the waddle the arms swing apart, so a greatsword needs body clips posed for it. The punch with a sword in the fist
reads as a thrust, a real shortsword motion. Two of the start heroes carry one.

## Steps

### 1. The user: make the layer (website)

- Open Krump, state `No_sword`, in the Equipment creator. Item, as a first wording: "a short steel sword held in the
  right fist, blade forward".
- **a.** Run it on the 8 standing views and the south punch (15 frames). Stop and send them. This is cheap, and it
  shows a still and a moving clip.
- **b.** If (a) looks seated, run it on the rest: idle, leap and punch in S, SE, E, NE and N; the waddle in all 8
  directions. That makes about 150 frames. The death needs no layer (the weapon falls away). The price isn't in the
  MCP help: check it on the site before (b).
- Export as transparent PNGs, one per frame, on the body's 64 × 64 canvas. Ideal layout:
  `art/characters/pixellab/Krump/No_sword/gear/shortsword/`, mirroring the body (`rotations/<dir>.png`,
  `animations/<Clip>/<dir>/frame_NNN.png`). In any other layout (sheets, other names), drop it in `assets/wip/gear/` and
  I'll cut and file it.

### 2. Claude: check the layer (no generations)

Composite sheets of body + layer for every clip, at 4× and at game size. On each frame:

- **seat:** is the grip in the fist? Measure the offset in pixels.
- **steadiness:** do the blade's length, angle and colours hold from frame to frame?
- **occlusion:** do the fingers cover the grip, so the sword looks held when drawn over the body? Is the blade cut
  where the body should hide it (facing N and NE it should pass behind)?
- **canvas:** are the size and origin the body's?

Fix seat errors by shifting frames (workbench) and time the fixes: that time is the real cost per figure × weapon.
**Gate:** if more than about 1 frame in 10 needs redrawing rather than shifting, stop. Layering would be no cheaper
than baking.

### 3. Claude: draw it in the game (only if step 2 passes)

- `art.yaml`: froglok-plain gets
  `gear: {shortsword: {dir: art/characters/pixellab/Krump/No_sword/gear/shortsword, behind: [north, north-east, north-west]}}`.
  The layer follows the body's clip, direction, frame and mirror; `behind` lists the facings where it is drawn before
  the body. A frame with no layer file draws the body alone.
- `sprites.js`: `drawArt` takes a gear key. Once the body frame is picked, it draws the layer file at the same path
  under the gear `dir`, before or after the body. `warm` loads the layers too.
- Which layer: the gear key is the wielded weapon's id (`shortsword`). The battle screen passes the main-hand weapon on
  the actor, and no layer is drawn when there's no match. Exploring is left for later.
- `content.js` and `validate.js` check the `gear` field and that its files exist. A fake-DOM test checks that a figure
  with gear draws, and that a missing layer falls back to the body.
- `monsters.yaml`: a `bogfolkBlade` (the bogfolk with a shortsword), so the layer is seen in a fight. Its tier comes
  from `tools/tiers.js`: the bare-fisted bogfolk is tier 1 (M 0.25), and with spear and shield it was tier 3 (M 1.30).

### 4. Look

- `tools/shot.sh` stills of a fight against `bogfolkBlade` in each facing. Note: stills don't show the waddle or the
  hop.
- Side by side with Krump's armed standing views at game scale.
- Try the second question: fit a line to each layer frame for a hand point and angle, and draw a different one-handed
  weapon at them (a mace from the item art). Compare.
- The user judges how it looks.

### 5. Decide

- **Go:** write the hero pipeline from the trial's numbers: which hero bodies, and which weapon classes. A one-handed
  weapon fits a fist; two-handed weapons and swings need body clips posed for them. Say whether layers or anchors
  (step 4) are the cheaper source.
- **No go:** weapons stay baked per figure, as now. Record why here and in `potential_equipment_art.md`.

## What the trial leaves open

- **Two-handed weapons and swings.** The punch serves the thrust; a swing needs its own body clip. An empty-handed
  swing from a template tends to sprout a blade (the froglok's leap did, facing N and NE), so it would need hand
  cleaning. A second trial if this one works.
- **Shields and helmets.** A shield would be a second layer on the other fist. Armour stays in the body.
- **Mirroring.** The game mirrors W, SW and NW from E, SE and NE for the idle, punch and leap, so there the sword
  changes hands, as every mirrored figure's weapon already does. The waddle has all 8 directions and doesn't.

## Cost

- PixelLab: one Equipment creator pass of about 165 frames (15 in step a, then about 150). The price is unknown: check
  it on the site. No MCP generations.
- Claude: steps 2-4. The engine work is about a day; the rest is free tools.
