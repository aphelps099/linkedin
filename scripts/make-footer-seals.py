"""Build outlined SVG footer seals from the approved certification concept.

Uses the site's existing Anton font; no webfont dependency in the final assets.
Run from the repository root with: python scripts/make-footer-seals.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parents[1]
font = TTFont(ROOT / 'public/home/fonts/anton.ttf')
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
out = ROOT / 'public/home-2/brand'


def lettering(text, top, height, max_width, tracking=0):
    cursor, parts, bounds = 0, [], []
    for char in text:
        glyph = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(pen)
        bound = BoundsPen(glyphs)
        glyph.draw(bound)
        parts.append(f'<path transform="translate({cursor} 0)" d="{pen.getCommands()}"/>')
        if bound.bounds:
            x0, y0, x1, y1 = bound.bounds
            bounds.append((cursor+x0, y0, cursor+x1, y1))
        cursor += glyph.width + tracking
    x0, y0 = min(b[0] for b in bounds), min(b[1] for b in bounds)
    x1, y1 = max(b[2] for b in bounds), max(b[3] for b in bounds)
    sy = height / (y1-y0)
    sx = max_width/(x1-x0)
    x = (300-(x1-x0)*sx)/2-x0*sx
    baseline = top+y1*sy
    return f'<g transform="translate({x:.4f} {baseline:.4f}) scale({sx:.6f} {-sy:.6f})">{"".join(parts)}</g>'


frame = '<path fill-rule="evenodd" d="M0 0H300V444H0Z M12 72V432H288V72Z"/>'
certified = lettering('CERTIFIED', 18, 39, 250, tracking=72)
marks = [
    ('global-nonsense', 'GLOBAL', 'NONSENSE',
     '<circle cx="150" cy="181" r="99"/>',
     '<g fill="none" stroke="#000" stroke-width="9"><path d="M150 80V282M48 181H252M62 135Q150 160 238 135M62 227Q150 202 238 227"/><ellipse cx="150" cy="181" rx="55" ry="99"/></g>'),
    ('synergy-checked', 'SYNERGY', 'CHECKED',
     '<path d="M150 86C114 107 84 114 55 116V174C55 224 90 257 150 286C210 257 245 224 245 174V116C216 114 186 107 150 86Z"/>',
     '<path fill="#000" d="M83 180L104 159L131 186L200 117L221 138L131 228Z"/>'),
    ('office-safe-ish', 'OFFICE', 'SAFE-ISH',
     '<path d="M58 180A92 92 0 0 1 242 180H220A70 70 0 0 0 80 180Z M77 186H88V275H77C58 275 41 258 41 239V221C41 202 58 186 77 186Z M95 186H108Q118 186 118 198V263Q118 275 108 275H95Z M223 186H212V275H223C242 275 259 258 259 239V221C259 202 242 186 223 186Z M205 186H192Q182 186 182 198V263Q182 275 192 275H205Z"/>', '')
]
for slug, top, bottom, icon, cutouts in marks:
    label = f'Certified {top.lower()} {bottom.lower()} — fictional corporate assurance mark'
    cut = f'<defs><mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="444"><rect width="300" height="444" fill="#fff"/><g fill="#000">{certified}</g>{cutouts}</mask></defs>'
    top_width = {'GLOBAL':228, 'SYNERGY':262, 'OFFICE':208}[top]
    bottom_width = {'NONSENSE':260, 'CHECKED':258, 'SAFE-ISH':260}[bottom]
    art = frame+icon+lettering(top, 296, 58, top_width)+lettering(bottom, 364, 56, bottom_width)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="444" viewBox="0 0 300 444"><title>{label}</title>{cut}<g fill="#232522" mask="url(#cut)">{art}</g></svg>\n'
    file = out / f'certified-{slug}.svg'
    file.write_text(svg)
    print(file.relative_to(ROOT))
