# Jungle art, first pass (archived 2026-11-04)

Kept because the jungle was a trial for a broader art rework (the user: "I don't want to lose good assets in case
they're helpful later"). Not used by the game. Prompts, PixelLab IDs and how they were built are in
`assets/wip/jungle/README.md` as of commit 8a00379 (`git show 8a00379:assets/wip/jungle/README.md`).

- `ground/`: the first ground tilesets, painterly, PixelLab pro 64 px, chained to the temple swamp's water and the
  temple jungle edge's canopy. `sheets/` holds PixelLab's sheets and metadata (forest floor over marsh, marsh over
  swamp water, trail, canopy cliff); the other PNGs are what `build.py` made from them (plain tiles, and the sets with
  one plain tile pasted in); `tileset-jungle.yaml` is the tileset entry that drew them.
- `trees-painterly/`: the first trees, 128 px, painterly (fine roots, no outline, muted): kapok, mangrove, strangler
  fig, cypress, and four moss-hung (oak, dead, leaning, branch). `anim/` has their 8-frame moss sways (the oak's plays
  there and back); `props-built.png` is the strip the game drew them from. Replaced because they were "too detailed
  and realistic, not quite matching the art of the character sprites".
