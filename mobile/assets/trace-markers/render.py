"""Rebuild transparent native assets and a standalone SVG preview; no app runs."""
import argparse
import base64
import hashlib
import json
import re
from pathlib import Path

import fitz
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--compare-before', type=Path, help='Preserved message SVG for optional photo comparison.')
args = parser.parse_args()
metadata = []
edge_samples = {}


def check_canvas_edge(pixels, source, density):
    alpha = pixels.samples[3::4]
    border = alpha[:pixels.width] + alpha[-pixels.width:] + alpha[::pixels.width] + alpha[pixels.width-1::pixels.width]
    maximum = max(border)
    edge_samples[f'{source.name}@{density}x'] = maximum
    if density == 8:
        assert maximum == 0, f'{source.name}: painted canvas edge at {density}x'


for source in sorted(HERE.glob('*.svg')):
    document = fitz.open(stream=source.read_bytes(), filetype='svg')
    for density in (1, 2, 3):
        output = source.with_name(source.stem + (f'@{density}x' if density > 1 else '') + '.png')
        pixels = document[0].get_pixmap(matrix=fitz.Matrix(density, density), alpha=True)
        check_canvas_edge(pixels, source, density)
        pixels.save(output)
        metadata.append({'file': output.name, 'width': pixels.width, 'height': pixels.height,
                         'alpha': bool(pixels.alpha), 'bytes': output.stat().st_size,
                         'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
    # Geometric paint must remain within the canvas at a finer sampling density.
    pixels = document[0].get_pixmap(matrix=fitz.Matrix(8, 8), alpha=True)
    check_canvas_edge(pixels, source, 8)

font = TTFont(HERE.parent / 'fonts' / 'SpoqaHanSansRegular.ttf')
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
font_scale = 10 / font['head'].unitsPerEm


def numeral(value, width):
    advance = sum(glyphs[cmap[ord(c)]].width for c in value)
    x = (width - advance * font_scale) / 2
    paths = []
    for char in value:
        glyph = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(pen)
        paths.append(f'<path transform="translate({x} 10.5) scale({font_scale} {-font_scale})" d="{pen.getCommands()}" fill="#292929"/>')
        x += glyph.width * font_scale
    return ''.join(paths)


def marker(name, count=None):
    raw = (HERE / (name + '.svg')).read_text(encoding='utf-8')
    body = re.search(r'<svg[^>]*>(.*)</svg>', raw, re.S).group(1)
    if count:
        width = 20 if len(count) > 1 else 14
        body = f'<rect x="1" y="2" width="{width-2}" height="10" rx="5" fill="white" opacity=".64"/>' + body + numeral(count, width)
    return body


parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="870" height="530" viewBox="0 0 870 530">',
         '<rect width="870" height="530" fill="#F5F5F3"/>',
         '<text x="16" y="23" font-family="sans-serif" font-size="14" fill="#292929">Trace markers · original pixels + 5x vector enlargement · Android not run</text>']
variants = [('message', None, 'message'), ('ring', '2', '2 notes'), ('group-wide', '12', '12 notes'), ('group-wide', '60', '60 notes'), ('selected', None, 'selected point')]
for row, (background, label, foreground) in enumerate([('#FFFFFF', 'white', '#292929'), ('#8B8B86', 'mid-gray', '#FFFFFF'), ('#202321', 'dark', '#FFFFFF')]):
    top = 40 + row * 160
    parts.append(f'<rect x="10" y="{top}" width="850" height="150" rx="6" fill="{background}"/>')
    parts.append(f'<text x="20" y="{top+18}" font-family="sans-serif" font-size="11" fill="{foreground}">{label} · 1x / 5x</text>')
    for column, (name, count, title) in enumerate(variants):
        x = 20 + column * 168
        art = marker(name, count)
        parts += [f'<g transform="translate({x+12} {top+65})">{art}</g>',
                  f'<g transform="translate({x+50} {top+40}) scale(5)">{art}</g>',
                  f'<text x="{x+12}" y="{top+130}" font-family="sans-serif" font-size="11" fill="{foreground}">{title}</text>']
parts.append('</svg>')
preview = ROOT / '.codex-build' / 'trace-marker-preview.svg'
preview.parent.mkdir(parents=True, exist_ok=True)
preview.write_text(''.join(parts), encoding='utf-8')
document = fitz.open(stream=preview.read_bytes(), filetype='svg')
document[0].get_pixmap(alpha=False).save(preview.with_suffix('.png'))

if args.compare_before:
    # A static asset comparison, not a screenshot or an Android density simulation.
    # 390dp image width follows the scene's project(anchor, rect) mapping; the
    # samples below choose photo coordinates directly and never alter app anchors.
    photo = ROOT / 'mobile' / 'assets' / 'places' / 'geunjeongjeon.jpg'
    photo_uri = 'data:image/jpeg;base64,' + base64.b64encode(photo.read_bytes()).decode('ascii')
    before = re.search(r'<svg[^>]*>(.*)</svg>', args.compare_before.read_text(encoding='utf-8'), re.S).group(1)
    after = marker('message')
    comparison = ['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="960" height="890" viewBox="0 0 960 890">',
                  '<rect width="960" height="890" fill="#F5F5F3"/>',
                  '<text x="20" y="26" font-family="sans-serif" font-size="16" fill="#292929">Message marker: before / after on the same photo</text>',
                  '<text x="20" y="48" font-family="sans-serif" font-size="12" fill="#555555">14dp = 14px at left; 4x raster enlargement at right. Static PyMuPDF composition; Android not run.</text>',
                  '<text x="20" y="68" font-family="sans-serif" font-size="12" fill="#555555">Photo width 390dp; original photo unmodified. Outer circle, center and hit target unchanged.</text>']
    samples = [('Dancheong', 900, 664), ('Bright stone wall', 1270, 824), ('Shade', 1850, 765)]
    for row, (label, photo_x, photo_y) in enumerate(samples):
        top = 100 + row * 260
        comparison.append(f'<text x="20" y="{top+18}" font-family="sans-serif" font-size="13" fill="#292929">{label}</text>')
        for column, (version, art) in enumerate([('Before', before), ('After', after)]):
            x = 180 + column * 380
            scale = 390 / 2000
            tile = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="60" height="60" viewBox="0 0 60 60">'
                    f'<image x="{30-photo_x*scale}" y="{30-photo_y*scale}" width="390" height="{1151*scale}" xlink:href="{photo_uri}"/>'
                    f'<g transform="translate(23 23)">{art}</g></svg>')
            tile_document = fitz.open(stream=tile.encode('utf-8'), filetype='svg')
            tile_pixels = tile_document[0].get_pixmap(alpha=False)
            tile_uri = 'data:image/png;base64,' + base64.b64encode(tile_pixels.tobytes('png')).decode('ascii')
            # Magnify the actual 60px rendered tile without inventing finer SVG detail.
            tile_pixels.set_dpi(72, 72)
            enlarged = fitz.Pixmap(tile_pixels, 240, 240)
            large_uri = 'data:image/png;base64,' + base64.b64encode(enlarged.tobytes('png')).decode('ascii')
            comparison += [f'<text x="{x}" y="{top+18}" font-family="sans-serif" font-size="12" fill="#292929">{version}: 14dp / 4x raster</text>',
                           f'<image x="{x}" y="{top+45}" width="60" height="60" xlink:href="{tile_uri}"/>',
                           f'<image x="{x+80}" y="{top+30}" width="240" height="240" xlink:href="{large_uri}"/>']
    comparison.append('</svg>')
    comparison_path = args.compare_before.parent / 'message-photo-comparison.svg'
    comparison_path.write_text(''.join(comparison), encoding='utf-8')
    comparison_document = fitz.open(stream=comparison_path.read_bytes(), filetype='svg')
    comparison_document[0].get_pixmap(alpha=False).save(comparison_path.with_suffix('.png'))
    print(json.dumps({'photo_comparison': str(comparison_path.with_suffix('.png'))}))
(HERE / 'metadata.json').write_text(json.dumps({'renderer': 'PyMuPDF '+fitz.VersionBind, 'assets': metadata}, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'preview': str(preview.with_suffix('.png')), 'assets': len(metadata),
                  'canvas_edges_clear_at_8x': True, 'canvas_edge_max_alpha': edge_samples}))
