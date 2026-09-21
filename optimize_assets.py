from PIL import Image
from pathlib import Path

root = Path(__file__).resolve().parent / 'assets' / 'images'

bg_map = {
    'bg-home.png': 'bg-home.webp',
    'bg-fengjia.png': 'bg-fengjia.webp',
    'bg-raohe.png': 'bg-raohe.webp',
    'bg-dongdamen.png': 'bg-dongdamen.webp',
    'bg-huayuan.png': 'bg-huayuan.webp',
    'bg-wusheng.png': 'bg-wusheng.webp',
}

item_map = {
    'item-boba.png': 'item-boba.webp',
    'item-sweetpotato.png': 'item-sweetpotato.webp',
    'item-tofu.png': 'item-tofu.webp',
    'item-chicken.png': 'item-chicken.webp',
    'item-oyster.png': 'item-oyster.webp',
    'item-marshmallow.png': 'item-marshmallow.webp',
    'item-takoyaki.png': 'item-takoyaki.webp',
}


def convert_to_webp(src_name: str, dst_name: str, max_dim: int, quality: int):
    src = root / src_name
    dst = root / dst_name
    img = Image.open(src).convert('RGBA')
    scale = min(1.0, max_dim / max(img.size))
    new_size = (max(1, int(img.width * scale)), max(1, int(img.height * scale)))
    img = img.resize(new_size, Image.Resampling.LANCZOS)
    img.save(dst, format='WEBP', quality=quality, method=6)
    return new_size

for src_name, dst_name in bg_map.items():
    new_size = convert_to_webp(src_name, dst_name, 1600, 72)
    print(f'bg {src_name} -> {dst_name} {new_size[0]}x{new_size[1]}')

for src_name, dst_name in item_map.items():
    new_size = convert_to_webp(src_name, dst_name, 600, 78)
    print(f'item {src_name} -> {dst_name} {new_size[0]}x{new_size[1]}')

sprites = [
    'item-boba.webp',
    'item-sweetpotato.webp',
    'item-tofu.webp',
    'item-chicken.webp',
    'item-oyster.webp',
]

sprite_w = 320
sprite_h = 320
sheet = Image.new('RGBA', (sprite_w * len(sprites), sprite_h), (0, 0, 0, 0))
for idx, name in enumerate(sprites):
    img = Image.open(root / name).convert('RGBA')
    img.thumbnail((sprite_w, sprite_h), Image.Resampling.LANCZOS)
    x = (sprite_w - img.width) // 2
    y = (sprite_h - img.height) // 2
    sheet.paste(img, (idx * sprite_w + x, y), img)
    print(f'placed {name} at {idx}')

sheet.save(root / 'items-sprite.webp', format='WEBP', quality=80, method=6)
print('saved items-sprite.webp')
