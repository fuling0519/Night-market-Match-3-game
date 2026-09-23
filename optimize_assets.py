"""Build game-ready WebP assets without changing original PNGs.

Requires Pillow. Curated transparent masters in cutouts/ override original PNGs.
Run from any directory: python optimize_assets.py
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
IMAGES = ROOT / 'assets' / 'images'
REPORTS = ROOT / 'tools' / 'asset-review'
FOODS = ['boba', 'sweetpotato', 'tofu', 'chicken', 'grilledcorn']
ITEMS = [f'item-{food}' for food in FOODS]
ITEMS += [f'item-{food}-4' for food in FOODS]
ITEMS += ['item-takoyaki', 'item-marshmallow', 'item-oyster']
TILE_SIZE = 256
CONTENT_SIZE = 236


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
    REPORTS.mkdir(parents=True, exist_ok=True)
    report = {'tile_size': TILE_SIZE, 'content_size': CONTENT_SIZE, 'assets': []}
    previews = []
    for name in ITEMS:
        original = IMAGES / f'{name}.png'
        source = IMAGES / 'cutouts' / f'{name}.png'
        if not source.exists():
            source = original
        image = Image.open(source).convert('RGBA')
        alpha = image.getchannel('A')
        if alpha.getextrema()[0] != 0:
            raise ValueError(f'{source.name}: source has no transparent background')
        # Ignore near-invisible alpha noise only for bounding-box measurement.
        # Keep all original alpha within that box, including translucent glow.
        bbox = alpha.point(lambda value: 255 if value > 2 else 0).getbbox()
        if not bbox:
            raise ValueError(f'{source.name}: empty sprite')
        image = image.crop(bbox)
        image.thumbnail((CONTENT_SIZE, CONTENT_SIZE), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (TILE_SIZE, TILE_SIZE))
        canvas.alpha_composite(image, ((TILE_SIZE-image.width)//2, (TILE_SIZE-image.height)//2))
        output = IMAGES / f'{name}.webp'
        canvas.save(output, 'WEBP', quality=84, method=6, exact=True)
        with Image.open(output) as decoded:
            assert decoded.size == (TILE_SIZE, TILE_SIZE)
            output_alpha = decoded.convert('RGBA').getchannel('A').getextrema()
            assert output_alpha[0] == 0 and output_alpha[1] >= 240
            previews.append((name, decoded.convert('RGBA').copy()))
        report['assets'].append({'name':name,'source':str(source.relative_to(ROOT)).replace('\\','/'),
            'source_sha256':sha256(source),'original_bytes':original.stat().st_size,
            'output_bytes':output.stat().st_size,'size':[TILE_SIZE,TILE_SIZE], 'alpha':True})
    # Backgrounds already use a 1600px ceiling. Rebuild from originals, never
    # recompress existing WebP; they need no background extraction or tile padding.
    for source in sorted(IMAGES.glob('bg-*.png')):
        image = Image.open(source).convert('RGB')
        image.thumbnail((1600,1600),Image.Resampling.LANCZOS)
        output = source.with_suffix('.webp')
        image.save(output,'WEBP',quality=72,method=6)
        report['assets'].append({'name':source.stem,'source':str(source.relative_to(ROOT)).replace('\\','/'),
            'source_sha256':sha256(source),'original_bytes':source.stat().st_size,
            'output_bytes':output.stat().st_size,'size':list(image.size),'alpha':False})
    # Keep the five-slot compatibility sheet in the same order as CANDY_TYPES.
    sheet = Image.new('RGBA',(TILE_SIZE*len(FOODS),TILE_SIZE))
    for index,food in enumerate(FOODS):
        image=Image.open(IMAGES/f'item-{food}.webp').convert('RGBA')
        sheet.alpha_composite(image,(index*TILE_SIZE,0))
    sheet.save(IMAGES/'items-sprite.webp','WEBP',quality=84,method=6,exact=True)
    report['sprite']={'size':list(sheet.size),'columns':len(FOODS),
        'output_bytes':(IMAGES/'items-sprite.webp').stat().st_size}
    report['original_total_bytes']=sum(a['original_bytes'] for a in report['assets'])
    report['webp_total_bytes']=sum(a['output_bytes'] for a in report['assets'])+report['sprite']['output_bytes']
    (REPORTS/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    # Review on both backgrounds, plus a 40px miniature at actual phone scale.
    width=5*220
    height=3*300
    for theme,color in [('dark','#241418'),('light','#f3eadc')]:
        contact=Image.new('RGB',(width,height),color)
        draw=ImageDraw.Draw(contact)
        for index,(name,image) in enumerate(previews):
            x=(index%5)*220; y=(index//5)*300
            large=image.copy();large.thumbnail((180,180),Image.Resampling.LANCZOS)
            contact.paste(large,(x+20,y+20),large)
            small=image.resize((40,40),Image.Resampling.LANCZOS)
            contact.paste(small,(x+90,y+220),small)
            draw.text((x+8,y+275),name,fill='white' if theme=='dark' else 'black')
        contact.save(REPORTS/f'contact-{theme}.png')
    print(json.dumps({k:v for k,v in report.items() if k in ['original_total_bytes','webp_total_bytes']},indent=2))


if __name__ == '__main__':
    build()
