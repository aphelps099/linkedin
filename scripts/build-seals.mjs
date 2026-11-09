// Three seals for LinkedIn Beats. Vector, 600 x 600, written to public/brand/seals/.
// node scripts/build-seals.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {compileFont, layoutText} from '../src/pegboard/font.js';
import {PEG9} from '../src/pegboard/fonts/peg9.js';

const OUT = new URL('../public/brand/seals/', import.meta.url).pathname;
const mono = readFileSync(new URL('../public/home-2/brand/monogram.svg', import.meta.url), 'utf8');
const monoInner = mono.replace(/^[\s\S]*?<\/title>/, '').replace(/<\/svg>\s*$/, '');
const monogram = (x, y, size, color) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100">${monoInner.replace(/fill="#111111"/g, `fill="${color}"`)}</svg>`;
const ring = (id, r, cx = 300, cy = 300) => `<path id="${id}-top" d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none"/><path id="${id}-bot" d="M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}" fill="none"/>`;
const arcText = (id, where, text, {size = 28, spacing = 6, weight = 700, family = 'Helvetica Neue, Arial, sans-serif', fill = '#0757ec'} = {}) =>
  `<text font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" fill="${fill}"><textPath href="#${id}-${where}" startOffset="50%" text-anchor="middle">${text}</textPath></text>`;
const SANS = 'Helvetica Neue, Arial, sans-serif', HEAVY = "'LB Druk', 'Druk Heavy', 'Arial Black', Impact, sans-serif", MONO = "'LB Azeret Mono', 'Azeret Mono', Menlo, monospace";
const head = (title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="${title}"><title>${title}</title>`;

// Laurel: a branch of leaves along an arc, mirrored.
function laurel(color) {
  const leaf = 'M0 0C6 -6 8 -16 0 -26C-8 -16 -6 -6 0 0Z';
  const parts = [];
  const R = 178, a0 = Math.PI * .77, a1 = Math.PI * 1.04;
  parts.push(`<path d="M ${(300 + Math.cos(a0) * R).toFixed(1)} ${(300 + Math.sin(a0) * R).toFixed(1)} A ${R} ${R} 0 0 1 ${(300 + Math.cos(a1) * R).toFixed(1)} ${(300 + Math.sin(a1) * R).toFixed(1)}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`);
  for (let i = 0; i < 7; i++) {
    const a = a0 + (a1 - a0) * (i + .5) / 7, x = 300 + Math.cos(a) * R, y = 300 + Math.sin(a) * R, tangent = a * 180 / Math.PI + 90;
    for (const side of [-1, 1]) parts.push(`<path d="${leaf}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(tangent + side * 42).toFixed(1)})" fill="${color}"/>`);
  }
  const g = parts.join('');
  return `<g>${g}</g><g transform="translate(600 0) scale(-1 1)">${g}</g>`;
}

// 01 · The Great Seal: institutional, one colour, the monogram under laurels.
function great() {
  const C = '#0757ec', paper = '#fbf6e8';
  return `${head('The Great Seal of LinkedIn Beats')}<defs>${ring('g1', 252)}</defs>
<circle cx="300" cy="300" r="296" fill="${paper}"/>
<circle cx="300" cy="300" r="290" fill="none" stroke="${C}" stroke-width="4"/>
<circle cx="300" cy="300" r="278" fill="none" stroke="${C}" stroke-width="1.5"/>
<circle cx="300" cy="300" r="226" fill="none" stroke="${C}" stroke-width="1.5"/>
<circle cx="300" cy="300" r="220" fill="none" stroke="${C}" stroke-width="3"/>
${arcText('g1', 'top', 'THE GREAT SEAL OF LINKEDIN BEATS', {size:27, spacing:5.5, fill:C})}
${arcText('g1', 'bot', 'PROFESSIONAL DEVELOPMENT · ALLEGEDLY', {size:22, spacing:5, fill:C})}
<g fill="${C}"><path d="M46 300l7-7 7 7-7 7zM540 300l7-7 7 7-7 7z"/></g>
${laurel(C)}
${monogram(195, 162, 210, C)}
<g transform="translate(300 450)"><path d="M-140 -16H140L126 0L140 16H-140L-126 0Z" fill="${C}"/><text x="0" y="6" text-anchor="middle" font-family="${SANS}" font-size="16" font-weight="700" letter-spacing="3.5" fill="${paper}">LET’S CIRCLE BACK</text></g>
<text x="300" y="500" text-anchor="middle" font-family="${SANS}" font-size="14" font-weight="700" letter-spacing="5" fill="${C}">MMXXVI</text>
</svg>`;
}

// 02 · Certified Thought Leader: the rosette, a notary's edge, yellow and ink.
function certified() {
  const Y = '#ffe14d', I = '#11110e';
  const scallops = Array.from({length:40}, (_, i) => { const a = i / 40 * Math.PI * 2; return `<circle cx="${(300 + Math.cos(a) * 262).toFixed(2)}" cy="${(300 + Math.sin(a) * 262).toFixed(2)}" r="30" fill="${Y}" stroke="${I}" stroke-width="3"/>`; }).join('');
  return `${head('Certified Thought Leader · LinkedIn Beats seal')}<defs>${ring('c2', 212)}</defs>
${scallops}
<circle cx="300" cy="300" r="263" fill="${Y}"/>
<circle cx="300" cy="300" r="240" fill="none" stroke="${I}" stroke-width="3"/>
<circle cx="300" cy="300" r="231" fill="none" stroke="${I}" stroke-width="1.5" stroke-dasharray="2 5"/>
<circle cx="300" cy="300" r="186" fill="none" stroke="${I}" stroke-width="3"/>
${arcText('c2', 'top', 'CERTIFIED THOUGHT LEADER', {size:26, spacing:6, fill:I})}
${arcText('c2', 'bot', 'EFFORT VERIFIED · NO ACTION ITEMS', {size:20, spacing:5, fill:I})}
<g fill="${I}"><path d="M82 300l6-6 6 6-6 6zM506 300l6-6 6 6-6 6z"/></g>
<text x="300" y="236" text-anchor="middle" font-family="${SANS}" font-size="13" font-weight="700" letter-spacing="4" fill="${I}">OFFICIAL RECORD</text>
<g font-family="${SANS}" font-weight="900" fill="${I}" text-anchor="middle"><text x="300" y="318" font-size="58" letter-spacing="-1.5">HUMBLED</text><text x="300" y="382" font-size="58" letter-spacing="-1.5">HONORED</text></g>
<path d="M232 342H368" stroke="${I}" stroke-width="2"/>
<text x="300" y="422" text-anchor="middle" font-family="${SANS}" font-size="13" font-weight="700" letter-spacing="4" fill="${I}">ON REPEAT</text>
</svg>`;
}

// 03 · All Hands: the board as a seal. A ring of lit pegs, the mark in PEG-9.
function pegs() {
  const ink = '#0a0a0b', socket = '#1e1f24', blue = '#2b78ff', blueCore = '#ddebff', white = '#ffffff', signal = '#ffe14d';
  const font = compileFont(PEG9), layout = layoutText('LB', {font, k:1, maxCols:40, maxLines:1});
  const pitch = 14, R = 5.6;
  const w = layout.width * pitch, h = layout.height * pitch, ox = 300 - w / 2 - pitch, oy = 300 - h / 2 + 6;
  const peg = (x, y, tone) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R * 2.2}" fill="${tone}" fill-opacity=".16"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R}" fill="${tone}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R * .42}" fill="${tone === blue ? blueCore : white}" fill-opacity=".95"/>`;
  const sockets = [];
  for (let gy = -13; gy <= 13; gy++) for (let gx = -13; gx <= 13; gx++) { const x = 300 + gx * pitch, y = 300 + gy * pitch; if (Math.hypot(x - 300, y - 300) < 184) sockets.push(`<circle cx="${x}" cy="${y}" r="2.6" fill="${socket}"/>`); }
  const letters = [];
  for (const line of layout.pages[0].lines) for (const ch of line.chars) for (let i = 0; i < ch.pegs.length; i += 2) letters.push(peg(ox + ch.pegs[i] * pitch + pitch / 2, oy + ch.pegs[i + 1] * pitch + pitch / 2, blue));
  // the terminal beat: a 2 x 2 signal block after the B, on its baseline
  const lines = layout.pages[0].lines, last = lines[lines.length - 1].chars.at(-1);
  const bx = ox + (last.x + last.w + 1) * pitch + pitch / 2, by = oy + (last.y + last.h - 2) * pitch + pitch / 2;
  for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) letters.push(peg(bx + xx * pitch, by + yy * pitch, signal));
  const edge = Array.from({length:72}, (_, i) => { const a = i / 72 * Math.PI * 2 - Math.PI / 2; return peg(300 + Math.cos(a) * 262, 300 + Math.sin(a) * 262, i % 3 === 0 ? white : blue); }).join('');
  return `${head('All Hands · LinkedIn Beats peg seal')}<defs>${ring('p3', 214)}</defs>
<circle cx="300" cy="300" r="296" fill="${ink}"/>
<circle cx="300" cy="300" r="282" fill="none" stroke="#2a2b31" stroke-width="1.2"/>
<circle cx="300" cy="300" r="242" fill="none" stroke="#2a2b31" stroke-width="1.2"/>
${edge}
<circle cx="300" cy="300" r="236" fill="none" stroke="#3a3b42" stroke-width="1" stroke-dasharray="1 6"/>
${arcText('p3', 'top', 'ALL HANDS · LINKEDIN BEATS', {size:19, spacing:6, weight:500, family:MONO, fill:'#f2eee6'})}
${arcText('p3', 'bot', 'ONE POST · SIXTY SECONDS · 120 BPM', {size:16, spacing:5, weight:500, family:MONO, fill:'#9aa0ab'})}
<circle cx="300" cy="300" r="188" fill="#000"/>
${sockets.join('')}
${letters.join('')}
</svg>`;
}

writeFileSync(OUT + 'lb-seal-01-great.svg', great());
writeFileSync(OUT + 'lb-seal-02-certified.svg', certified());
writeFileSync(OUT + 'lb-seal-03-allhands.svg', pegs());
console.log('written');
