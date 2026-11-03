# Animated traps (2026-11-02)

The user: "We need animated traps, like the swinging blades in the goblin mine." `build.py` moves PixelLab parts
(`../front/props/trap_*.png`) by code and writes `art/worldtiles/traps.png`: a blade swinging as a pendulum (rotated
through an EPX upscale so its edges stay clean, its shadow sweeping the floor), a spike plate whose spikes stab up,
a fire vent that throws a jet, a sprung pit. A trap in a place picks one with `sprite` (the mine's stair trap is
`blade`, its false floor `pit`); without one a tileset map draws the spike plate. Each has a `_still` frame for sprung
or disarmed; a found pit not yet sprung shows faintly (`pit_hint`).
