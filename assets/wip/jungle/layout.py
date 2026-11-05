# The jungle west of the grassland (jungle_west in data/places.yaml): a trail from the grassland's west road (Q, east
# edge) through forest floor under big gnarled trees, past a marsh with swamp pools in the south, to the trail west (Z,
# not built yet). Prints the map rows; --write puts them in data/places.yaml (squared by tools/squarewalls.js; the rows below are its output).
#   # canopy (the wall)   . forest floor   ≈ marsh   _ shallow swamp   ~ deep swamp   ≡ trail
#   K kapok  M mangrove  F strangler fig  C cypress  A mossy oak  D dead mossy tree  L leaning mossy tree  B mossy branch
import sys

MAP = r'''
####################################
####################################
######..............K.......########
######...A.........F........########
####........##..........D.....######
####....K...##................######
####........##.......B...A....######
###....F.........................###
###.......B.......K.......F......###
##.....................A..........##
##...D.....≡≡≡≡≡≡......≡≡≡≡.......##
##.....≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡......#
Z≡≡≡≡≡≡≡≡≡......≡≡≡≡≡≡.....≡≡≡≡≡≡≡≡#
Z≡≡≡≡≡......................≡≡≡≡≡≡≡Q
#.........≈≈≈≈........≈≈≈.......≡≡≡Q
##...C...≈≈≈≈≈≈≈.....≈≈≈≈≈≈........#
##.....≈≈≈__≈≈≈≈≈...≈≈≈__≈≈≈..L....#
###...≈≈__~~__≈≈≈M.≈≈__~~_≈≈≈.....##
###..≈≈_~~~~~__≈≈≈≈≈≈_~~~~__≈≈....##
###..≈≈__~~~~__≈≈C≈≈≈__~~___≈≈...###
####..≈≈___~__≈≈≈≈≈≈≈≈≈__≈≈≈≈M..####
####..M≈≈≈___≈≈≈..D..≈≈≈≈≈≈≈...#####
#####...≈≈≈≈≈≈.........≈≈≈.A..######
######.......####...........########
########...#######.....#############
####################################
'''.strip('\n').split('\n')

assert all(len(r) == len(MAP[0]) for r in MAP), [len(r) for r in MAP]
rows = ['    - "' + r + '"\n' for r in MAP]
if '--write' in sys.argv:
    p = 'data/places.yaml'; s = open(p).read()
    i = s.index('\njungle_west:\n'); j = s.index('  map:\n', i) + len('  map:\n'); k = s.index('  legend:', j)
    open(p, 'w').write(s[:j] + ''.join(rows) + s[k:])
else:
    print(''.join(rows), end='')
