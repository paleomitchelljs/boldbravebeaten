# Writes the fire-goblin mine's places (YAML) from layout.py's maps and the legends below. Run once to seed
# data/places.yaml: `python3 places.py > /tmp/ember.yaml`, then paste. After that the YAML in data/ is the source.
import layout

LOOK_BASALT = '{wall: "#2a2624", floor: "#3c3632", ceiling: "#140c08", fog: "#120604", torch: 1, tileset: ember_basalt, light: 8}'
LOOK_MASONRY = '{wall: "#6a6866", floor: "#57534f", ceiling: "#1a1614", fog: "#0e0a08", torch: 1, tileset: ember_masonry, light: 8}'
LOOK_GNOME = '{wall: "#3e4044", floor: "#4a4a4c", ceiling: "#14141a", fog: "#0a0a0e", torch: 1, tileset: ember_gnome, light: 9}'

P = {}
P['ember_hall'] = dict(name='The Cinder Hall', level=2, look=LOOK_BASALT,
  blurb="A tunnel of black basalt climbing from the surface: a winding stair, a gallery over the lava, and a great hall with three ways on.",
  legend='''
    "<": {kind: stairs, to: stonebridge, at: ~, sprite: door, wall: true, label: "Back down the stair and out"}
    A: {kind: trap, on: "/", tn: 9, disarm: 9, damage: {CON: 2}, label: "A slot in the rock across the stair", text: "A blade on a chain swings out of the slot at chest height."}
    g: {kind: monster, encounter: murderhole, label: "Goblins at the murder hole"}
    h: {kind: monster, encounter: hall, label: "Goblins in the great hall"}
    p: {kind: monster, encounter: patrol, label: "A goblin patrol"}
    G: {kind: monster, encounter: gate, label: "The gate guards"}
    P: {kind: locked, see: true, forceTn: 15, opensWhen: {flag: ember_winch}, label: "A portcullis of black iron", text: "A portcullis of black iron bars. Its chain runs to a winch in the gate court's wall, and another on the far side.", alt: [{label: "Haul on the gate winch", requires: {flag: ember_gate_won}, opens: true, text: "With the guards dead, nobody stops you. The winch groans, and the portcullis rattles up into the rock."}]}
    K: {kind: stairs, to: ember_castle, at: S, up: true, sprite: door, wall: true, label: "Into the goblin castle"}
    D: {kind: prop, label: "The tunnel drops away into heat and dark: the way to the deep lair (not built yet)"}
    S: {kind: secret, tn: 10, label: "A seam in the tunnel wall"}
    Q: {kind: stairs, to: ember_castle, at: Q, up: true, sprite: door, wall: true, label: "A goblin door at the end of the secret passage"}
    M: {kind: stairs, to: ember_warrens, at: m, sprite: door, wall: true, label: "On into the mine workings"}
    L: {kind: stairs, to: ember_lake, at: l, sprite: door, wall: true, label: "Steps down towards a red glow"}
    w: {kind: monster, encounter: chamber, label: "Goblins resting in the small chamber"}''',
  encounters='''
    murderhole: {foes: [{monster: fireGoblinArcher, n: 2}, {monster: fireGoblin}], text: "Bowstrings creak behind the murder hole. Goblin faces, lit red from below."}
    hall: {foes: [{monster: fireGoblin, n: 3}], text: "Three fire goblins across the hall turn and come at a run, spears low."}
    patrol: {foes: [{monster: fireGoblin, n: 2}, {monster: fireGoblinArcher}], text: "A patrol rounds the column of rock."}
    gate: {foes: [{monster: goblinWarrior, n: 2}, {monster: fireGoblinArcher}], flags: [ember_gate_won], text: "The gate guards close ranks in front of the portcullis."}
    chamber: {foes: [{monster: goblinMiner, n: 2}], text: "Two goblin miners scramble up from their blankets."}''',
  wandering='''
    - {w: 1, foes: [{monster: fireGoblin, n: 2}], text: "Two fire goblins come along the hall."}
    - {w: 4, nothing: true}''')

P['ember_warrens'] = dict(name='The Warrens', level=3, look=LOOK_BASALT,
  blurb="The goblins' working mine: low winding tunnels of black rock, a few hidden doors, the barracks at the far end, and a drake that hunts in it.",
  legend='''
    m: {kind: stairs, to: ember_hall, at: M, sprite: door, wall: true, label: "Back over the bridge to the hall"}
    B: {kind: stairs, to: ember_barracks, at: b, sprite: door, wall: true, label: "The barracks gate"}
    T: {kind: trap, tn: 11, disarm: 10, damage: {CON: 1}, to: ember_pit, at: t, label: "A stretch of floor that rings hollow", text: "The floor tips under you, and you fall into heat and red light."}
    Z: {kind: secret, tn: 11, label: "A seam in the rock"}
    U: {kind: stairs, to: ember_pit, at: u, sprite: door, wall: true, label: "A narrow way down, warm air rising"}
    J: {kind: stairs, to: ember_lake, at: j, sprite: door, wall: true, label: "Steps down to the lava lake"}
    Y: {kind: stairs, to: ember_lake, at: y, sprite: door, wall: true, label: "A worked slope down to the lava lake"}
    z: {kind: secret, tn: 10, label: "A seam in the rock"}
    N: {kind: stairs, to: ember_gnomes, at: n, sprite: door, wall: true, label: "The gnomes' bridgehead"}
    n: {kind: monster, encounter: gnomes, label: "Gnomes at the bridge"}
    "1": {kind: monster, encounter: miners, label: "Miners in the gallery"}
    "2": {kind: monster, encounter: miners2, label: "Picks ringing in the dark"}
    "3": {kind: monster, encounter: overseer, label: "An overseer and its miners"}
    "4": {kind: monster, encounter: miners, label: "Miners in the gallery"}
    "5": {kind: monster, encounter: archers, label: "Goblins in the dead end"}
    d: {kind: monster, encounter: drake, label: "Something large, breathing"}
    C: {kind: chest, label: "A goblin's hidden cache", loot: strongbox, tn: 9}
    c: {kind: chest, label: "An ore cart with a false bottom", loot: smuggler_cache, tn: 8}''',
  encounters='''
    gnomes: {foes: [{monster: gnomeWarrior, n: 3}], parley: gnome_sergeant, peaceFlags: [gnomes_trust], text: "Three gnomes in black mail step out of the bridgehead, hammers up."}
    miners: {foes: [{monster: goblinMiner, n: 3}], text: "Goblin miners drop their picks and pick up clubs."}
    miners2: {foes: [{monster: goblinMiner, n: 2}, {monster: fireGoblin}], text: "Two miners and a fire goblin driving them."}
    overseer: {foes: [{monster: goblinShaman}, {monster: goblinMiner, n: 2}], text: "A goblin with a bone staff shrieks at the miners to fight."}
    archers: {foes: [{monster: fireGoblinArcher, n: 2}], text: "Two archers in the dead end, nocking arrows."}
    drake: {foes: [{monster: redDrake}], text: "The red drake lifts its head from what it was eating."}''',
  wandering='''
    - {w: 1, foes: [{monster: redDrake}], text: "Wingbeats in the tunnel. The drake is hunting."}
    - {w: 2, foes: [{monster: goblinMiner, n: 2}], text: "Two goblin miners with a cart."}
    - {w: 5, nothing: true}''')

P['ember_lake'] = dict(name='The Lava Lake', level=3, look=LOOK_BASALT,
  blurb="A great chamber of moving lava under a black roof, crossed only on a line of stones.",
  legend='''
    l: {kind: stairs, to: ember_hall, at: L, up: true, sprite: door, wall: true, label: "Back up to the hall"}
    j: {kind: stairs, to: ember_warrens, at: J, up: true, sprite: door, wall: true, label: "Up into the warrens"}
    y: {kind: stairs, to: ember_warrens, at: Y, up: true, sprite: door, wall: true, label: "Up into the warrens"}
    X: {kind: chest, label: "A chest on the island, its iron blackened", loot: relic_cache, tn: 10}
    e: {kind: monster, encounter: keepers, label: "Flame standing on the island"}''',
  encounters='''
    keepers: {foes: [{monster: fireElemental, n: 2}], text: "The flames on the island stand up into the shapes of men."}''',
  wandering='''
    - {w: 1, foes: [{monster: fireElemental}], text: "A figure of fire walks up out of the lava."}
    - {w: 5, nothing: true}''')

P['ember_pit'] = dict(name='The Burning Pit', level=4, look=LOOK_BASALT,
  blurb="A round pit under the warrens, its floor cracked with lava. Something lives here.",
  legend='''
    t: {kind: note, label: "Where you fell", text: "The hole you fell through is far overhead, and the walls are smooth with heat."}
    E: {kind: monster, encounter: efreet, label: "A great shape of fire"}
    z: {kind: secret, tn: 10, label: "A seam in the pit wall"}
    u: {kind: stairs, to: ember_warrens, at: U, up: true, sprite: door, wall: true, label: "A narrow way up into the warrens"}''',
  encounters='''
    efreet: {foes: [{monster: efreetLord}, {monster: fireElemental, n: 2}], text: "The fire in the middle of the pit stands up, and up, and looks down at you. Two smaller flames rise at its sides."}''',
  wandering='')

P['ember_barracks'] = dict(name='The Goblin Barracks', level=3, look=LOOK_MASONRY,
  blurb="Built goblin masonry of grey mine stone at the north end of the warrens: a drill hall, bunks, a mess and an armory.",
  legend='''
    b: {kind: stairs, to: ember_warrens, at: B, sprite: door, wall: true, label: "Back out into the warrens"}
    "1": {kind: monster, encounter: bunks, asleep: true, label: "Goblins asleep in the bunks"}
    "2": {kind: monster, encounter: mess, label: "Goblins at the mess tables"}
    "3": {kind: monster, encounter: drill, label: "Warriors at drill"}
    "4": {kind: monster, encounter: captain, label: "The barracks captain"}
    C: {kind: chest, label: "The captain's strongbox", loot: strongbox, tn: 10}
    r: {kind: pickup, good: repair_kit, text: "A whetstone and rivets on the armorer's bench."}''',
  encounters='''
    bunks: {foes: [{monster: goblinWarrior, n: 2}, {monster: fireGoblin, n: 2}], text: "Goblins roll out of the bunks grabbing for weapons."}
    mess: {foes: [{monster: goblinWarrior, n: 2}, {monster: fireGoblinArcher}], text: "The mess goes over in a crash of bowls."}
    drill: {foes: [{monster: goblinWarrior, n: 3}], text: "The warriors at drill turn as one."}
    captain: {foes: [{monster: goblinChampion}, {monster: goblinShaman}], text: "A goblin as big as a man stands up from a table of maps."}''',
  wandering='''
    - {w: 1, foes: [{monster: goblinWarrior, n: 2}], text: "Two warriors on their rounds."}
    - {w: 4, nothing: true}''')

P['ember_gnomes'] = dict(name='The Gnome Fort', level=3, look=LOOK_GNOME,
  blurb="A walled fort of dark mottled stone across the lava chasm, held by gnome miners cut off from the surface.",
  legend='''
    n: {kind: stairs, to: ember_warrens, at: N, sprite: door, wall: true, label: "Back over the bridge to the warrens"}
    P: {kind: locked, see: true, forceTn: 15, opensWhen: {flag: gnomes_trust}, label: "The fort's gate", text: "An iron gate, and gnome eyes behind it. They will open it to a friend."}
    K: {kind: npc, npc: gnome_warden, label: "Warden Odda"}
    k: {kind: shrine, heal: 1, label: "The fort's infirmary", text: "A gnome with a lamp and very steady hands sees to your hurts."}
    w: {kind: prop, label: "The fort's forge, never let go out"}
    h: {kind: note, label: "Gnome bunks", text: "Bunks in rows, a name burned into the head of each. Some of the names are crossed through."}
    C: {kind: note, label: "The fort's stores", text: "Sacks of cave-grain, dried mushroom, lamp oil, and not much else. They have been careful for eleven years."}''',
  encounters='',
  wandering='')

P['ember_castle'] = dict(name='The Goblin Castle', level=4, look=LOOK_MASONRY,
  blurb="The goblin king's castle, built of grey mine stone behind its portcullis: a loop of halls round the throne.",
  legend='''
    S: {kind: stairs, to: ember_hall, at: K, sprite: door, wall: true, label: "Out through the gatehouse"}
    Q: {kind: stairs, to: ember_hall, at: Q, sprite: door, wall: true, label: "The secret passage back to the west tunnel"}
    w: {kind: note, sets: [ember_winch], label: "The portcullis winch", text: "A great winch for the portcullis chain. You throw your weight on it; somewhere south, the portcullis rattles up into the rock."}
    g: {kind: monster, encounter: hallguard, label: "Guards in the entrance hall"}
    b: {kind: monster, encounter: bar, label: "Goblins at the bar"}
    r: {kind: monster, encounter: sleepers, asleep: true, label: "Goblins asleep"}
    v: {kind: monster, encounter: sleepers2, asleep: true, label: "A goblin snoring in the bunk room"}
    y: {kind: pickup, good: tome_ember, text: "A shaman's book of fire-words lies open on the desk."}
    m: {kind: note, sets: [knows_castle_seam], label: "The map room", text: "A map of the mine scratched into a slate table. In the castle's east wing, the passage north of the champions' room is drawn to go through into the king's rooms, though the wall there looks solid. West of the great hall, a second line runs from the tunnel to inside the portcullis."}
    T: {kind: prop, sprite: throne, label: "A throne of basalt"}
    k: {kind: monster, encounter: throne, label: "The goblin king and his champions"}
    J: {kind: stairs, to: ember_jail, at: j, sprite: door, wall: true, label: "Stairs down, north of the throne"}
    Z: {kind: secret, tn: 11, label: "A seam in the end of the passage"}
    C: {kind: chest, label: "The king's hoard", loot: relic_cache, rolls: 2, tn: 12}
    q: {kind: monster, encounter: bodyguard, label: "The king's bodyguard"}
    e: {kind: prop, sprite: bed, label: "The king's bed, piled with furs"}
    c: {kind: monster, encounter: champions, label: "Champions in the front room"}
    x: {kind: monster, encounter: shaman, label: "The high shaman's fire"}''',
  encounters='''
    hallguard: {foes: [{monster: goblinWarrior, n: 2}], text: "Two guards in the entrance hall shout and come on."}
    bar: {foes: [{monster: goblinWarrior}, {monster: fireGoblin, n: 2}], text: "The drinkers come over the bar at you."}
    sleepers: {foes: [{monster: fireGoblin, n: 3}], text: "Goblins tumble out of their blankets."}
    sleepers2: {foes: [{monster: goblinMiner}], text: "A goblin sits up, blinking."}
    throne: {foes: [{monster: goblinKing}, {monster: goblinChampion, n: 2}], flags: [ember_king_dead], text: "The king heaves himself up from the throne. Two champions step down from the dais in front of him."}
    bodyguard: {foes: [{monster: goblinChampion}], text: "A champion guarding the king's rooms turns, astonished, as the wall opens."}
    champions: {foes: [{monster: goblinChampion}, {monster: goblinWarrior, n: 2}], text: "A champion and two warriors in the front room."}
    shaman: {foes: [{monster: goblinHighShaman}, {monster: goblinShaman}], text: "The high shaman looks up from its fire, and the fire looks up with it."}''',
  wandering='''
    - {w: 1, foes: [{monster: goblinWarrior, n: 2}], text: "Two castle guards on their rounds."}
    - {w: 4, nothing: true}''')

P['ember_jail'] = dict(name='The Goblin Jail', level=4, look=LOOK_MASONRY,
  blurb="Cells and question rooms under the throne, and a stair that goes on down.",
  legend='''
    j: {kind: stairs, to: ember_castle, at: J, up: true, sprite: door, wall: true, label: "Up to the throne room"}
    L: {kind: locked, tn: 8, forceTn: 10, label: "A cell door", text: "A barred cell door on a goblin lock."}
    t: {kind: monster, encounter: questioner, label: "The questioner at work"}
    g: {kind: monster, encounter: jailers, label: "Jailers"}
    p: {kind: npc, npc: gnome_prisoner, label: "A gnome in a cell"}
    o: {kind: note, label: "An empty cell", text: "Chains, and what is left of whoever wore them."}
    D: {kind: prop, label: "The stair goes on down into heat and dark: the way to the deep lair (not built yet)"}''',
  encounters='''
    questioner: {foes: [{monster: goblinShaman}, {monster: fireGoblin}], text: "The questioner puts down its irons."}
    jailers: {foes: [{monster: goblinWarrior}, {monster: fireGoblin}], text: "The jailers grab their keys and their spears."}''',
  wandering='')

def out():
    lines = ['', '# ---- The fire-goblin mine (prototype dungeon 2; plan in assets/ideas/ember-mine.md). Maps laid out by',
             '# assets/wip/ember/layout.py, then hand-edited here. ----------------------------------------------------------']
    for pid, d in P.items():
        m = layout.MAPS[pid]()
        lines += [f'{pid}:', f'  name: {d["name"]}', '  kind: dungeon', f'  blurb: {d["blurb"]}', f'  level: {d["level"]}', f'  look: {d["look"]}', '  map:']
        lines += [f'    - "{r}"' for r in m.rows()]
        lines += ['  legend:' + d['legend']]
        if d['encounters']: lines += ['  encounters:' + d['encounters']]
        if d['wandering']: lines += ['  wandering:' + d['wandering']]
        lines += ['  secrets: []', '']
    return '\n'.join(lines)

if __name__ == '__main__':
    print(out())
