# Campfires (2026-11-02)

The user: animated campfires of a few sizes for the grasslands and the temple court. `flame.py` draws looping flames
by code (three tongues licking on their own phases, noise rising through them cross-faded so the loop closes, sparks).
`build.py` lays them over PixelLab bases (`../front/props/fire_*.png`: a stone ring, logs in a ring, a bonfire, a
cauldron on a tripod), whose painted flames it first turns to char and embers, and writes `art/worldtiles/fires.png`
(8 frames each: campfire_small, campfire, bonfire, cookfire). The traps' fire vent uses `flame.py` too.
