#!/usr/bin/env python3
"""Rebuild Afterbeat SVG masters from the project's licensed TT Hoves font.
Requires fonttools and Pillow (RAQM recommended). No font files are distributed.
Run python3 scripts/build-afterbeat-identity.py, then node scripts/package-afterbeat-identity.mjs.
"""
from pathlib import Path
from xml.sax.saxutils import escape
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from PIL import ImageFont
import json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/brand/afterbeat'; OUT.mkdir(parents=True,exist_ok=True)
FONT=ROOT/'public/home-2/fonts/tt-hoves-demibold.ttf'
REG=ROOT/'public/home-2/fonts/tt-hoves-regular.ttf'
INK='#111111'; BLUE='#0757ec'; PAPER='#fafaf7'; WHITE='#ffffff'
font=TTFont(FONT); glyphs=font.getGlyphSet(); cmap=font.getBestCmap(); measure=ImageFont.truetype(str(FONT),1000)
regfont=TTFont(REG); regglyphs=regfont.getGlyphSet(); regcmap=regfont.getBestCmap(); regmeasure=ImageFont.truetype(str(REG),1000)

def text_paths(text,regular=False,split=None,first=INK,second=BLUE):
    gs,cm,ms=(regglyphs,regcmap,regmeasure) if regular else (glyphs,cmap,measure)
    out=[]
    for i,c in enumerate(text):
        if c==' ': continue
        x=ms.getlength(text[:i+1])-ms.getlength(c)
        pen=SVGPathPen(gs); gs[cm[ord(c)]].draw(pen)
        color=second if split is not None and i>=split else first
        out.append(f'<path fill="{color}" transform="translate({x:.3f} 0)" d="{pen.getCommands()}"/>')
    return ''.join(out),ms.getlength(text)

def make_word(text='linkedinbeats',mode='color',split=8):
    col=WHITE if mode=='white' else INK
    paths,advance=text_paths(text,split=split if mode=='color' else None,first=col,second=BLUE)
    # A custom terminal beat sits at the baseline, unlike a font underscore.
    x=advance+56; width=x+440+32-69
    lowest=0
    for c in text:
        pen=BoundsPen(glyphs);glyphs[cmap[ord(c)]].draw(pen)
        if pen.bounds: lowest=min(lowest,pen.bounds[1])
    height=max(810,738-lowest+32)
    mark=f'<g transform="translate(-37 738) scale(1 -1)">{paths}</g><rect data-afterbeat="true" x="{x-37:.3f}" y="658" width="440" height="120" fill="{BLUE if mode=="color" else col}"/>'
    return mark,(round(width,3),height)

def svg(body,size,label):
    w,h=size
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{escape(label)}"><title>{escape(label)}</title>{body}</svg>\n'

def save(name,body,size,label):
    (OUT/f'{name}.svg').write_text(svg(body,size,label))

def place(body,size,x,y,w,h=None):
    scale=min(w/size[0],h/size[1] if h else w/size[0])
    return f'<g transform="translate({x} {y}) scale({scale:.6f})">{body}</g>'

masters={}
for mode in ['color','black','white']:
    body,size=make_word(mode=mode);masters[mode]=(body,size)
    save(f'wordmark-{mode}',body,size,'LinkedIn Beats — Afterbeat wordmark')
    # Stacked lockup: plain linkedin above beats_ (only one terminal beat).
    tp,tw=text_paths('linkedin',first=WHITE if mode=='white' else INK)
    bp,bs=make_word('beats',mode=mode,split=0)
    stack=f'<g transform="translate(-37 738) scale(1 -1)">{tp}</g>'+place(bp,bs,0,830,bs[0])
    stacksz=(max(tw,bs[0])+32,1640)
    save(f'stacked-{mode}',stack,stacksz,'LinkedIn Beats — stacked Afterbeat wordmark')
    mono,msz=make_word('lb',mode=mode,split=0)
    # The transparent monogram has a square canvas for seals and avatars.
    small=place(mono,msz,10,(100-80*msz[1]/msz[0])/2,80)
    save(f'monogram-{mode}',small,(100,100),'LinkedIn Beats — lb underscore small mark')
    if mode in ['white','black']:
        bg=BLUE if mode=='white' else INK
        icon='<rect width="100" height="100" rx="17" fill="'+bg+'"/>'+place(*make_word('lb','white',split=0),14,26,72)
        save('icon-blue' if mode=='white' else 'icon-black',icon,(100,100),'LinkedIn Beats')
    for department in ['academy','studio','store']:
        dept,dsz=make_word(department,mode=mode,split=0)
        lock=place(body,size,0,0,4000)+place(dept,dsz,0,670,dsz[0])
        save(f'{department}-{mode}',lock,(max(4000,dsz[0]),670+dsz[1]),f'LinkedIn Beats {department}')

# Outline all guide typography too: the preview reproduces without font loading.
def label(text,x,y,size=24,color=INK,regular=True):
    body,_=text_paths(text,regular=regular,first=color)
    return f'<g transform="translate({x} {y}) scale({size/1000} {-size/1000})">{body}</g>'
board=f'<rect width="1800" height="1360" fill="{PAPER}"/>'
board+=label('LINKEDIN BEATS / AFTERBEAT IDENTITY',92,77,19,'#666666')
board+=label('01',1660,77,19,'#666666')
board+=place(*masters['color'],92,170,1616)
board+=label('Corporate identity. Slightly offbeat.',96,432,32,INK)
# No hairline rules: spacing and solid blocks organize the kit.
board+=label('THE WORDMARK',96,555,18,'#666666')
board+=place(*masters['black'],96,612,455)
board+=f'<rect x="92" y="725" width="480" height="132" rx="12" fill="{INK}"/>'+place(*masters['white'],116,764,432)
board+=label('One color. Full character.',96,914,23,INK)
board+=label('THE SMALL MARK',652,555,18,'#666666')
iconraw=(OUT/'icon-blue.svg').read_text().split('</title>',1)[1].split('</svg>')[0]
board+=place(iconraw,(100,100),654,606,248)
board+=place(*make_word('lb','color',0),930,645,90)
board+=label('Avatar, favicon, seal.',654,914,23,INK)
board+=label('THE FAMILY',1208,555,18,'#666666')
for i,dept in enumerate(['academy','studio','store']):
    b,s=make_word(dept,'color',0)
    board+=place(b,s,1208,601+i*106,360,80)
board+=label('One name. Three expressions.',1208,971,23,INK)
board+=label('PALETTE',96,1072,18,'#666666')
for i,(color,name,code) in enumerate([(INK,'Ink','#111111'),(BLUE,'Cobalt','#0757EC'),(PAPER,'Warm white','#FAFAF7')]):
    x=96+i*224
    if i==2: board+=f'<rect x="{x-4}" y="1096" width="180" height="64" rx="7" fill="{WHITE}"/>'
    board+=f'<rect x="{x}" y="1100" width="172" height="56" rx="5" fill="{color}"/>'
    board+=label(name,x,1195,22,INK)+label(code,x,1231,18,'#666666')
board+=label('TT HOVES DEMIBOLD',870,1072,18,'#666666')
board+=label('Lowercase. Optical spacing. One terminal beat.',870,1128,24,INK)
board+=label('Use clear space equal to the height of the lowercase b.',870,1180,21,'#555555')
board+=label('Keep the underscore attached. Let the content do the talking.',870,1220,21,'#555555')
save('identity-guide',board,(1800,1360),'LinkedIn Beats — Afterbeat identity guide')

(OUT/'tokens.css').write_text('''/* LinkedIn Beats / Afterbeat */
:root{--lb-ink:#111111;--lb-cobalt:#0757ec;--lb-paper:#fafaf7;--lb-white:#ffffff;--lb-type:"TT Hoves",Arial,sans-serif;}
/* The terminal beat may pulse once on deliberate interaction. Never blink continuously. */
@keyframes lb-afterbeat{0%,100%{opacity:1}45%{opacity:.3}}
.lb-afterbeat-motion:hover [data-afterbeat]{animation:lb-afterbeat 700ms ease-out 1;}
@media(prefers-reduced-motion:reduce){.lb-afterbeat-motion [data-afterbeat]{animation:none!important;}}
''')
manifest={'name':'LinkedIn Beats / Afterbeat','version':1,'font':'TT Hoves DemiBold (outlined; font not included)','colors':{'ink':INK,'cobalt':BLUE,'paper':PAPER,'white':WHITE},'wordmarkViewBox':f'0 0 {masters["color"][1][0]} {masters["color"][1][1]}','wordmarkAspect':masters['color'][1][0]/masters['color'][1][1],'minimumPixels':{'wordmark':160,'stacked':88,'icon':24},'clearSpace':'height of lowercase b on each side where practical; compact UI uses at least half this height','motion':'one 700ms opacity pulse on deliberate interaction; static at rest; reduced motion respected'}
(OUT/'identity.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Built {len(list(OUT.glob("*.svg")))} outlined SVGs; primary viewBox {manifest["wordmarkViewBox"]}.')
