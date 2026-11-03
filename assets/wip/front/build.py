# Front-on props (the user, 2026-11-02: the houses were drawn in an oblique, isometric view on a square NSEW grid,
# and should read medieval fantasy). PixelLab create_map_object, 1 generation each; prompts and ids in ids.txt and
# README.md. Packs the keepers into art/worldtiles/front.png and prints their props: lines.
#   python3 assets/wip/front/build.py "$PWD"
import sys, os
from PIL import Image
root = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
# prop name: source in props/ (the later tries are the ones that came out front-on and medieval)
KEEP = {
    # village, hills and vale buildings
    'cottage': 'cottage', 'cottage_stone': 'cottage2', 'inn': 'inn', 'smithy': 'smithy', 'shop': 'shop',
    'roadinn': 'roadinn', 'tavern': 'tavern', 'stable': 'stable', 'keep': 'keep', 'gatetower': 'gatetower',
    'gatehouse': 'gatehouse', 'minemouth': 'minemouth2', 'totem': 'totem', 'arch': 'arch',
    'watchplatform': 'watchplatform', 'palisadegate': 'palisadegate', 'catapult': 'catapult3',
    # village things
    'well': 'well', 'stall': 'stall', 'fence': 'fence3', 'signpost': 'signpost2', 'woodpile': 'woodpile2',
    'trough': 'trough2', 'handcart': 'handcart2', 'crates': 'crates2', 'bench': 'bench3', 'lamppost': 'lamppost',
    'table': 'table', 'barricade': 'barricade',
    # camps (grassland, temple court)
    'tent': 'tent3', 'tent_canvas': 'tent2', 'tent_orc': 'tent_orc', 'tent_orc_small': 'tent_orc_small',
    'tent_gnoll': 'tent_gnoll', 'tent_minotaur': 'tent_minotaur', 'tent_bandit': 'tent2',
    'tent_bandit_chief': 'tent_bandit_chief', 'hut_round': 'hut_round', 'hut_stilts': 'hut_stilts3',
    # lizardfolk clutter (the temple)
    'liz_totem': 'liz_totem', 'liz_urns': 'liz_urns', 'liz_fishrack': 'liz_fishrack', 'liz_nest': 'liz_nest',
    'liz_idol': 'liz_idol', 'liz_bones': 'liz_bones',
    # goblin mine clutter
    'gob_cart': 'gob_cart', 'gob_tools': 'gob_tools', 'gob_ore': 'gob_ore', 'gob_powder': 'gob_powder',
    'gob_junk': 'gob_junk', 'gob_mushrooms': 'gob_mushrooms', 'gob_sacks': 'gob_sacks', 'gob_timber': 'gob_timber',
    'gob_pot': 'gob_pot',
}
ims = []
for name, src in KEEP.items():
    im = Image.open(f'{here}/props/{src}.png').convert('RGBA')
    ims.append((name, im.crop(im.getbbox())))
# Two rows keep the sheet under 4096 px wide (older phones).
rows, row, wsum = [], [], 0
for n, im in ims:
    if wsum + im.width + 2 > 4000 and row:
        rows.append(row); row, wsum = [], 0
    row.append((n, im)); wsum += im.width + 2
rows.append(row)
H = [max(im.height for _, im in r) for r in rows]
sheet = Image.new('RGBA', (max(sum(im.width + 2 for _, im in r) for r in rows), sum(H) + 2 * len(rows)))
y, lines = 0, []
for r, h in zip(rows, H):
    x = 0
    for n, im in r:
        sheet.paste(im, (x, y))
        lines.append(f'    {n}: [../front.png, {x}, {y}, {im.width}, {im.height}]')
        x += im.width + 2
    y += h + 2
sheet.save(root + '/art/worldtiles/front.png', optimize=True)
print('\n'.join(lines))
