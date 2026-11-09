# Builds the kobold dens' props (one PixelLab 1-direction object sheet, 559fed0c, 16 frames at 64 px; frames fetched
# from its rotations/frame_<i>.png into props/): each trimmed and laid in a 64-px slot of
# art/worldtiles/ember/kobold-props.png. Prints the `props:` lines for ember_basalt in data/tilesets.yaml.
#   python3 assets/wip/ember/kobolds/build.py "$PWD"
import json, sys
from PIL import Image
root = sys.argv[1]
here = root + '/assets/wip/ember/kobolds/'
PROPS = ['k_pool', 'k_pool_long', 'k_mat', 'k_refuse', 'k_statue', 'k_mandibles', 'k_skulls', 'k_throne',
         'k_brazier', 'k_bench', 'k_shards', 'k_crate', 'k_trough', 'k_chain', 'k_box', 'k_mobile']
pieces = [Image.open(f'{here}props/{i}.png').convert('RGBA') for i in range(len(PROPS))]
pieces = [p.crop(p.getbbox()) for p in pieces]
sheet = Image.new('RGBA', (64 * len(pieces), 64))
for k, (n, p) in enumerate(zip(PROPS, pieces)):
    x, y = k * 64 + (64 - p.width) // 2, 64 - p.height
    sheet.alpha_composite(p, (x, y))
    print(f'    {n}: {json.dumps(["kobold-props.png", x, y, p.width, p.height])}')
sheet.save(root + '/art/worldtiles/ember/kobold-props.png', optimize=True)
