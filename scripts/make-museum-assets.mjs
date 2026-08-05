// Renders the Museum brand assets with the house canvas vocabulary.
// Signature motif: redaction bars — text lines with one blacked out — where
// the mixer has its beat ribbon, Lessons its dial, Roast its stamp.
//   npm i -D playwright-core   # only needed to regenerate
//   node scripts/make-museum-assets.mjs
import { chromium } from 'playwright-core';
import { writeFileSync, existsSync, readdirSync } from 'fs';

const OUT = new URL('../public/', import.meta.url).pathname;

function chromiumPath(){
  const pool = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if(pool && existsSync(pool)){
    for(const d of readdirSync(pool)){
      for(const p of [`${pool}/${d}/chrome-linux/chrome`, `${pool}/${d}/chrome-linux64/chrome`]){
        if(d.startsWith('chromium') && !d.includes('headless') && existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

const PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#0a1a2b}canvas{display:block}</style>
<canvas id="c"></canvas>
<script>
const BLUE='#0a66c2', TINT='#9fc8ea', WHITE='#fff', INK='#111';
const SANS='"Helvetica Neue",Helvetica,Arial,sans-serif';
const MONO='"IBM Plex Mono",Menlo,Consolas,monospace';

// the signature: three text lines, the middle one redacted
function redactionMark(ctx, x, y, w, lineH, gap){
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(x, y, w*.86, lineH);
  ctx.fillStyle = WHITE;
  ctx.fillRect(x, y + lineH + gap, w, lineH);         // the redaction bar, solid
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(x, y + 2*(lineH + gap), w*.62, lineH);
}

function icon(ctx, S){
  const u = S/64;
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,S,S);
  ctx.fillStyle = WHITE;
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.font = \`700 \${35*u}px \${SANS}\`;
  ctx.letterSpacing = \`\${-1.7*u}px\`;
  ctx.fillText('MM', S/2, 35*u);
  ctx.letterSpacing = '0px';
  ctx.fillRect(11*u, 41*u, 42*u, 3.2*u);
  redactionMark(ctx, 14*u, 48*u, 36*u, 3.4*u, 2.4*u);
}

function iconSmall(ctx, S){
  const u = S/64;
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,S,S);
  ctx.fillStyle = WHITE;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = \`700 \${42*u}px \${SANS}\`;
  ctx.letterSpacing = \`\${-2.4*u}px\`;
  ctx.fillText('MM', S/2, S/2 + 2*u);
  ctx.letterSpacing='0px';
  ctx.fillStyle = TINT;
  ctx.fillRect(10*u, 52*u, 44*u, 4*u);
}

function wrap(ctx,text,maxW){
  const words=text.split(' '); const lines=[]; let cur='';
  for(const w of words){ const t=cur?cur+' '+w:w;
    if(ctx.measureText(t).width>maxW&&cur){lines.push(cur);cur=w;} else cur=t; }
  if(cur)lines.push(cur); return lines;
}

function og(ctx, W, H){
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,W,H);
  const M = 64;

  // masthead
  ctx.fillStyle = WHITE; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.font = \`700 34px \${SANS}\`; ctx.letterSpacing='-0.6px';
  ctx.fillText('The Museum of Professional Communication', M, 82);
  ctx.textAlign='right'; ctx.fillStyle=TINT;
  ctx.font = \`500 17px \${MONO}\`; ctx.letterSpacing='1px';
  ctx.fillText('FORM MM-1 · EST. 2026', W - M, 80);
  ctx.letterSpacing='0px';
  ctx.fillStyle = WHITE; ctx.fillRect(M, 104, W - 2*M, 4);

  // headline + dek
  ctx.textAlign='left'; ctx.fillStyle=WHITE;
  ctx.font = \`700 88px \${SANS}\`; ctx.letterSpacing='-3.4px';
  ctx.fillText('The permanent', M, 220);
  ctx.fillText('collection.', M, 304);
  ctx.letterSpacing='0px';
  ctx.font = \`400 26px \${SANS}\`; ctx.fillStyle='rgba(255,255,255,.92)';
  const dek = wrap(ctx, 'Landmark posts of the professional internet, preserved as redacted exhibits.', 560);
  let dy = 354;
  dek.forEach(l=>{ ctx.fillText(l, M, dy); dy += 34; });
  ctx.fillStyle = TINT; ctx.font = \`700 26px \${SANS}\`;
  ctx.fillText('Authors anonymized. Clichés immortal.', M, dy + 10);

  // wings
  const kw = 196, kh = 92, ky = H - 150;
  ['Collection','Redaction','Archive'].forEach((label,i)=>{
    const x = M + i*(kw+16);
    const on = i===1;
    if(on){ ctx.fillStyle = WHITE; ctx.fillRect(x, ky, kw, kh); }
    else { ctx.strokeStyle = WHITE; ctx.lineWidth = 3; ctx.strokeRect(x, ky, kw, kh); }
    ctx.fillStyle = on ? BLUE : WHITE;
    ctx.font = \`700 28px \${SANS}\`; ctx.letterSpacing='-0.8px';
    ctx.fillText(label, x + 16, ky + 42);
    ctx.letterSpacing='2.4px';
    ctx.font = \`700 12px \${SANS}\`;
    ctx.fillStyle = on ? 'rgba(10,102,194,.75)' : 'rgba(255,255,255,.75)';
    ctx.fillText(['WING I','WING II','WING III'][i], x + 16, ky + 70);
    ctx.letterSpacing='0px';
  });

  // a redacted exhibit document, right column
  const gx = 744, gy = 150, gw = W - gx - M, gh = 330;
  ctx.fillStyle = '#f6f5f1';
  ctx.fillRect(gx, gy, gw, gh);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(gx, gy, gw, gh);
  ctx.fillStyle = INK; ctx.font = \`700 15px \${MONO}\`; ctx.letterSpacing='1.4px';
  ctx.fillText('EXHIBIT A-05 · C. 2023', gx + 22, gy + 36);
  ctx.fillStyle = 'rgba(17,17,17,.25)'; ctx.fillRect(gx + 22, gy + 50, gw - 44, 1.5);
  // document lines with redaction bars
  const lines = [
    [1, .92], [0, .74], [1, .88], [2, .5], [1, .95], [0, .6], [1, .8], [2, .68], [1, .55],
  ];
  let ly = gy + 76;
  lines.forEach(([kind, frac])=>{
    if(kind === 0){ ctx.fillStyle = BLUE; ctx.fillRect(gx + 22, ly, (gw - 44)*frac, 15); }
    else if(kind === 2){ ctx.fillStyle = INK; ctx.fillRect(gx + 22, ly, (gw - 44)*frac, 15); }
    else { ctx.fillStyle = 'rgba(17,17,17,.34)'; ctx.fillRect(gx + 22, ly, (gw - 44)*frac, 9); }
    ly += 27;
  });

  // stamp across the document corner
  ctx.save();
  ctx.translate(gx + gw - 128, gy + gh - 6); ctx.rotate(-6*Math.PI/180);
  ctx.font = \`700 19px \${SANS}\`; ctx.letterSpacing='3px'; ctx.textAlign='center';
  const sw = ctx.measureText('ACQUIRED — PERMANENT COLLECTION').width + 30;
  ctx.strokeStyle = BLUE; ctx.lineWidth = 3.5; ctx.strokeRect(-sw/2, -24, sw, 46);
  ctx.fillStyle = BLUE; ctx.fillText('ACQUIRED — PERMANENT COLLECTION', 0, 6);
  ctx.restore();
  ctx.letterSpacing='0px';

  // fine print
  ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,.72)';
  ctx.font = \`500 16px \${MONO}\`; ctx.letterSpacing='1.4px';
  ctx.fillText('ADMISSION FREE · DIGNITY OPTIONAL', M, H - 34);
  ctx.letterSpacing='0px';
}

window.render = (kind, W, H) => {
  const c = document.getElementById('c');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if(kind==='og') og(ctx, W, H);
  else if(kind==='small') iconSmall(ctx, W);
  else icon(ctx, W);
  return true;
};
</script>`;

const browser = await chromium.launch({ executablePath: chromiumPath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await page.setContent(PAGE);
await page.waitForTimeout(400);

const shot = async (kind, w, h, file) => {
  await page.evaluate(([k, W, H]) => window.render(k, W, H), [kind, w, h]);
  await page.waitForTimeout(120);
  const buf = await page.locator('#c').screenshot();
  writeFileSync(OUT + file, buf);
  return `${file} ${w}x${h} ${buf.length}b`;
};

const results = [];
results.push(await shot('icon', 512, 512, 'museum-icon-512.png'));
results.push(await shot('icon', 192, 192, 'museum-icon-192.png'));
results.push(await shot('icon', 180, 180, 'museum-apple-touch-icon.png'));
results.push(await shot('small', 32, 32, 'museum-favicon-32.png'));
results.push(await shot('small', 16, 16, 'museum-favicon-16.png'));
results.push(await shot('og', 1200, 630, 'museum-og.png'));
console.log(results.join('\n'));
await browser.close();
