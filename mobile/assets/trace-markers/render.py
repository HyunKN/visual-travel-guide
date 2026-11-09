"""Rebuild transparent native assets and a standalone SVG preview; no app runs."""
import hashlib
import json
import re
from pathlib import Path

import fitz
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
metadata = []
for source in sorted(HERE.glob('*.svg')):
    document = fitz.open(stream=source.read_bytes(), filetype='svg')
    for density in (1, 2, 3):
        output = source.with_name(source.stem + (f'@{density}x' if density > 1 else '') + '.png')
        pixels = document[0].get_pixmap(matrix=fitz.Matrix(density, density), alpha=True)
        pixels.save(output)
        metadata.append({'file': output.name, 'width': pixels.width, 'height': pixels.height,
                         'alpha': bool(pixels.alpha), 'bytes': output.stat().st_size,
                         'sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
    # Geometric paint must remain within the canvas at a finer sampling density.
    pixels = document[0].get_pixmap(matrix=fitz.Matrix(8, 8), alpha=True)
    alpha = pixels.samples[3::4]
    border = alpha[:pixels.width] + alpha[-pixels.width:] + alpha[::pixels.width] + alpha[pixels.width-1::pixels.width]
    assert max(border) == 0, f'{source.name}: painted canvas edge'

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
(HERE / 'metadata.json').write_text(json.dumps({'renderer': 'PyMuPDF '+fitz.VersionBind, 'assets': metadata}, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'preview': str(preview.with_suffix('.png')), 'assets': len(metadata), 'canvas_edges_clear_at_8x': True}))
