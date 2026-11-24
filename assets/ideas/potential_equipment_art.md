# Potential equipment art: gear that shows on party figures

Status: **idea, not started** (first version, 2026-11-20). A guide, not a commitment. Nothing here has been tested;
the PixelLab behaviour it relies on is unverified.

Next step (2026-11-24): `gear_trial.md`, one weapon layer from PixelLab's Equipment creator on the bare froglok.

## The problem

Today a PixelLab figure is baked: `Sprites.drawArt` (`src/ui/game/sprites.js`) draws one picture per frame, gear
included. A humanoid has ~200 frames (8 standing views, walk ×8 at ~6 frames, strike ×8 at ~7, thrust, idle ×8 at ~5,
death). Baking every gear combination multiplies: 5 slots × 4 options ≈ 4⁵ ≈ 1,000 characters. Not workable.

A true paper doll (one bare body, each item drawn as its own layer in every frame) adds instead of multiplying, but
needs pixel-exact registration in every frame. PixelLab generates each animation whole and does not hold details
steady across frames (see `art/characters/pixellab/README.md`: "the sword vanished", "hands had swapped"), so it
cannot supply aligned layers. Hand-drawing ~200 frames per item is the LPC route, not the PixelLab one.

## The plan: anchors + overlays + recolours

Treat each slot by how it moves:

| Slot | Method | Art cost per item |
|---|---|---|
| Weapon | One item sprite drawn at a per-frame **hand point and angle**, rotated in code | 1 image (8 for perspective) |
| Shield | Same, at the off-hand point | 1–8 |
| Helmet | One sprite per direction at a per-frame **head point** | 8 |
| Breastplate | A few body **silhouettes** (robe / leather / plate) × material by **recolour** | 0 per material; silhouettes are new bodies |
| Cloak | Behind-body layer per direction at the shoulder point, or folded into the silhouettes | 8, or 0 |

Materials (iron, bronze, leather) use the existing `recolor` ramps in `data/art.yaml` (how the clay, iron and stone
golems share one figure): data, not art.

Total cost: a few bodies × ~200 frames (made by the user, as now) + ~1–8 small images per item. Additive.

### Where per-frame anchors come from: the magenta prop

The untested idea everything depends on. The user makes each base body in PixelLab **holding a plain bright-magenta
rod** (and perhaps a magenta skullcap). A tool reads every frame and finds:

- the rod's endpoints → hand point and weapon angle;
- whether part of the rod is hidden → whether the weapon draws in front of or behind the body (z-order);
- the cap's centroid → head point for the helmet;
- then paints the magenta out (the drawn weapon covers where the rod was).

Frames where PixelLab drops or warps the rod get flagged, and their anchors filled in from the frames on either side.
Output: one anchor table per body (per clip, direction, frame), stored as data.

## What would change

Moderate, and only for party members. Monsters and NPCs keep baked art.

- **Renderer:** `drawArt` becomes body + layers in z-order at the frame's anchors. Contained in `sprites.js`, plus
  portraits.
- **New tool:** the magenta-anchor extractor (`tools/`), writing anchor tables.
- **Data:** item visuals (sprite, grip offset, which slot) in `data/`, beside the item catalog; body silhouettes and
  material ramps in `art.yaml`. `look()` in `sprites.js` maps equipped gear to layers instead of choosing one art key.
- **Content:** new weaponless base bodies. **The user makes these**: Claude never creates or animates characters in
  PixelLab (CLAUDE.md).

## Risks and unknowns

- Rotated weapons at 64 px can look pasted on, especially thrusts, which should foreshorten. 8-direction weapon
  sprites help, at 8× the art.
- Breastplate shape changes (pauldrons, bulk) cannot be overlaid cleanly, hence silhouettes + recolour for armour.
- Unverified: whether PixelLab keeps a pure-magenta prop through a whole animation (it may shade or tint it; detect by
  hue with a tolerance), and whether it can make 8-direction item sprites.

## First step: a cheap test

One body the user makes with a magenta rod; walk and strike clips only; a sword and an axe as overlays. About a day of
code. Look at it (`tools/shot.sh`) before going further: it either reads as one figure or it doesn't.
