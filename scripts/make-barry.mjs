// Barry from Compliance — the Linked Beats mascot. A hand-plotted 48-grid
// pigeon (top hat, cobalt lanyard, laminated chest badge) with ASCII-style
// speech bubbles: a 3×5 pixel font, dashed rules with + corners, a / tail.
// Everything is plotted as logical pixels in seven flat colors and rendered
// nearest-neighbor — no antialiasing anywhere. Outputs to public/barry/.
// Run with: node scripts/make-barry.mjs
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';

function chromiumPath(){
  const pool = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if(pool && existsSync(pool)){
    for(const d of readdirSync(pool)){
      for(const p of [`${pool}/${d}/chrome-linux/chrome`, `${pool}/${d}/chrome-linux64/chrome`]){
        if(d.startsWith('chromium') && !d.includes('headless') && existsSync(p)) return p;
      }
    }
  }
  const flat = '/opt/pw-browsers/chromium';
  if(existsSync(flat)) return flat;
  throw new Error('Chromium not found — set PLAYWRIGHT_BROWSERS_PATH');
}

const COLORS = {
  K: '#040103', // near black — hat, pupil, mouth line, bubble text
  C: '#4B4D4E', // charcoal — outlines, bubble rules
  O: '#FA9A05', // orange — beak, legs
  B: '#0608F7', // cobalt — lanyard, compliance chip
  W: '#FCF9FB', // white — eye, badge, bubble fill
  R: '#DF2319', // hat band
};

// ---------- Barry (13 wide × 25 tall; beak tip at 12,7) ----------
function barryCells(){
  const N = 48;
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  const set = (x, y, c) => { g[y][x] = c; };
  const hline = (x0, x1, y, c) => { for(let x = x0; x <= x1; x++) set(x, y, c); };
  const vline = (x, y0, y1, c) => { for(let y = y0; y <= y1; y++) set(x, y, c); };
  // top hat: crown, band, brim
  hline(22, 26, 12, 'K'); hline(22, 26, 13, 'K'); hline(22, 26, 14, 'K');
  hline(22, 26, 15, 'R'); hline(21, 27, 16, 'K');
  // hollow neck; the beak interrupts the right line
  vline(22, 17, 22, 'C'); vline(27, 17, 18, 'C'); set(27, 22, 'C');
  // eye: white block, pupil top-right
  set(24, 18, 'W'); set(25, 18, 'K'); set(24, 19, 'W'); set(25, 19, 'W');
  // beak: upper, mouth line, lower
  hline(27, 29, 19, 'O'); hline(27, 28, 20, 'K'); hline(27, 28, 21, 'O');
  // the lanyard
  set(22, 23, 'B'); set(23, 24, 'B'); set(24, 25, 'B'); set(25, 25, 'B');
  set(26, 24, 'B'); set(27, 23, 'B');
  // back edge stairs down to a solid tail tip, underside, belly line
  set(21, 24, 'C'); set(20, 25, 'C'); set(20, 26, 'C');
  set(19, 27, 'C'); set(19, 28, 'C'); set(18, 29, 'C'); set(18, 30, 'C');
  set(17, 31, 'C'); set(17, 32, 'C'); set(18, 31, 'C'); set(18, 32, 'C'); set(19, 32, 'C');
  hline(20, 27, 33, 'C');
  // right flank
  set(28, 24, 'C'); vline(28, 25, 30, 'C'); set(27, 31, 'C'); set(27, 32, 'C');
  // wing crease
  set(23, 26, 'C'); set(22, 27, 'C'); set(22, 28, 'C');
  set(21, 29, 'C'); set(20, 30, 'C'); set(19, 31, 'C');
  // the badge
  set(25, 27, 'W'); set(26, 27, 'W'); set(25, 28, 'W'); set(26, 28, 'W');
  // legs, toes to the right
  vline(22, 34, 35, 'O'); hline(22, 23, 36, 'O');
  vline(25, 34, 35, 'O'); hline(25, 26, 36, 'O');
  const cells = [];
  for(let y = 0; y < N; y++) for(let x = 0; x < N; x++)
    if(g[y][x] !== '.') cells.push([x - 17, y - 12, g[y][x]]);
  return cells;
}
const BARRY = barryCells();
const BARRY_W = 13, BARRY_H = 25;

// ---------- 3×5 pixel font (variable width) ----------
const FONT = {
  A: ['010','101','111','101','101'], B: ['110','101','110','101','110'],
  C: ['011','100','100','100','011'], D: ['110','101','101','101','110'],
  E: ['111','100','110','100','111'], F: ['111','100','110','100','100'],
  G: ['011','100','101','101','011'], H: ['101','101','111','101','101'],
  I: ['111','010','010','010','111'], J: ['001','001','001','101','010'],
  K: ['101','101','110','101','101'], L: ['100','100','100','100','111'],
  M: ['10001','11011','10101','10001','10001'], N: ['1001','1101','1011','1001','1001'],
  O: ['010','101','101','101','010'], P: ['110','101','110','100','100'],
  Q: ['010','101','101','010','001'], R: ['110','101','110','101','101'],
  S: ['011','100','010','001','110'], T: ['111','010','010','010','010'],
  U: ['101','101','101','101','111'], V: ['101','101','101','101','010'],
  W: ['10001','10001','10101','11011','10001'], X: ['101','101','010','101','101'],
  Y: ['101','101','010','010','010'], Z: ['111','001','010','100','111'],
  '.': ['0','0','0','0','1'], "'": ['1','1','0','0','0'], '!': ['1','1','1','0','1'],
  '-': ['00','00','11','00','00'], ':': ['0','1','0','1','0'], ' ': ['00','00','00','00','00'],
};

function textCells(str){
  const cells = []; let x = 0;
  for(const ch of str.toUpperCase()){
    const glyph = FONT[ch] || FONT[' '];
    for(let r = 0; r < 5; r++) for(let c = 0; c < glyph[r].length; c++)
      if(glyph[r][c] === '1') cells.push([x + c, r]);
    x += glyph[0].length + 1;
  }
  return { w: x - 1, h: 5, cells };
}

// ---------- bubbles ----------
// 'outline': white fill, dashed rule, + corners, / tail — the memo.
// 'chip': solid cobalt, white text — the ticker as a bubble; the escalation.
function bubble(lines, style = 'outline'){
  const rendered = lines.map(textCells);
  const textW = Math.max(...rendered.map(r => r.w));
  const pad = 2;
  const w = textW + pad * 2 + 2;
  const h = 2 + pad * 2 + lines.length * 5 + (lines.length - 1) * 2;
  const cells = [];
  if(style === 'chip'){
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) cells.push([x, y, 'B']);
  }else{
    for(let y = 1; y < h - 1; y++) for(let x = 1; x < w - 1; x++) cells.push([x, y, 'W']);
    for(let x = 1; x < w - 1; x++) if(x % 3 !== 0){ cells.push([x, 0, 'C']); cells.push([x, h - 1, 'C']); }
    for(let y = 1; y < h - 1; y++) if(y % 3 !== 0){ cells.push([0, y, 'C']); cells.push([w - 1, y, 'C']); }
    for(const [cx, cy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]])
      for(const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]])
        cells.push([cx + dx, cy + dy, 'C']);
  }
  const ink = style === 'chip' ? 'W' : 'K';
  rendered.forEach((line, i) => {
    const ty = 1 + pad + i * 7;
    for(const [x, y] of line.cells) cells.push([1 + pad + x, ty + y, ink]);
  });
  const tc = style === 'chip' ? 'B' : 'C';
  const tail = [[5, h], [4, h + 1], [3, h + 2]].map(([x, y]) => [x, y, tc]);
  if(style === 'chip') tail.push([6, h, 'B'], [5, h + 1, 'B']);
  return { w, h: h + 3, cells: cells.concat(tail) };
}

function compose(lines, style){
  const bub = bubble(lines, style);
  const margin = 3;
  const bubX = margin + 8;
  const barryX = margin, barryY = margin + bub.h - 6;
  const w = Math.max(bubX + bub.w + margin, barryX + BARRY_W + margin);
  const h = barryY + BARRY_H + margin;
  const cells = [];
  for(const [x, y, c] of bub.cells) cells.push([x + bubX, y + margin, c]);
  for(const [x, y, c] of BARRY) cells.push([x + barryX, y + barryY, c]);
  return { w, h, cells };
}

// Barry's approved statements. Add a line here and re-run.
const VARIANTS = [
  ['noted',        ['NOTED.'],                  'outline'],
  ['coo',          ['COO. COO.'],               'outline'],
  ['per-my-last',  ['PER MY LAST', 'EMAIL.'],   'outline'],
  ['circle-back',  ["LET'S", 'CIRCLE BACK.'],   'outline'],
  ['flagged',      ['FLAGGED FOR', 'REVIEW.'],  'chip'],
  ['policy',       ['AS PER POLICY.'],          'outline'],
];

// ---------- render (transparent, ×16 nearest-neighbor) ----------
const OUT = 'public/barry/';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });
const page = await browser.newPage();
const draw = (grid, scale) => page.evaluate(({ grid, scale, COLORS }) => {
  const canvas = document.createElement('canvas');
  canvas.width = grid.w * scale; canvas.height = grid.h * scale;
  const ctx = canvas.getContext('2d');
  for(const [x, y, c] of grid.cells){ ctx.fillStyle = COLORS[c]; ctx.fillRect(x * scale, y * scale, scale, scale); }
  return canvas.toDataURL('image/png').split(',')[1];
}, { grid, scale, COLORS });

const save = async (name, grid, scale) => {
  writeFileSync(`${OUT}${name}.png`, Buffer.from(await draw(grid, scale), 'base64'));
  console.log(`${OUT}${name}.png — ${grid.w}×${grid.h} logical ×${scale}`);
};

await save('barry', { w: BARRY_W, h: BARRY_H, cells: BARRY }, 16);
await save('barry-48', { w: BARRY_W, h: BARRY_H, cells: BARRY }, 1);
for(const [name, lines, style] of VARIANTS)
  await save(`barry-${name}`, compose(lines, style), 16);

await browser.close();
