// Renders the Roast My LinkedIn brand assets with the house canvas vocabulary.
// Signature motif: the tilted ROASTED stamp, where the mixer has its beat
// ribbon and Lessons has its dial.
//   npm i -D playwright-core   # only needed to regenerate
//   node scripts/make-roast-assets.mjs
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
const BLUE='#0a66c2', TINT='#9fc8ea', WHITE='#fff';
const SANS='"Helvetica Neue",Helvetica,Arial,sans-serif';
const MONO='"IBM Plex Mono",Menlo,Consolas,monospace';

// the signature: a small tilted stamp frame
function stampMark(ctx, cx, cy, w, h, lw){
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-5*Math.PI/180);
  ctx.strokeStyle = TINT; ctx.lineWidth = lw;
  ctx.strokeRect(-w/2, -h/2, w, h);
  ctx.restore();
}

function icon(ctx, S){
  const u = S/64;
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,S,S);
  ctx.fillStyle = WHITE;
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.font = \`700 \${35*u}px \${SANS}\`;
  ctx.letterSpacing = \`\${-1.7*u}px\`;
  ctx.fillText('RM', S/2, 35*u);
  ctx.letterSpacing = '0px';
  ctx.fillRect(11*u, 41*u, 42*u, 3.2*u);
  stampMark(ctx, S/2, 52.5*u, 34*u, 9*u, 1.8*u);
}

function iconSmall(ctx, S){
  const u = S/64;
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,S,S);
  ctx.fillStyle = WHITE;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = \`700 \${42*u}px \${SANS}\`;
  ctx.letterSpacing = \`\${-2.4*u}px\`;
  ctx.fillText('RM', S/2, S/2 + 2*u);
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
  ctx.font = \`700 40px \${SANS}\`; ctx.letterSpacing='-0.8px';
  ctx.fillText('Roast My LinkedIn', M, 84);
  const lw = ctx.measureText('Roast My LinkedIn').width;
  ctx.font = \`700 18px \${SANS}\`; ctx.letterSpacing='0px';
  ctx.fillText('™', M + lw + 4, 66);
  ctx.textAlign='right'; ctx.fillStyle=TINT;
  ctx.font = \`500 17px \${MONO}\`; ctx.letterSpacing='1px';
  ctx.fillText('FORM RM-1 · REV. 2026-08', W - M, 80);
  ctx.letterSpacing='0px';
  ctx.fillStyle = WHITE; ctx.fillRect(M, 104, W - 2*M, 4);

  // headline
  ctx.textAlign='left'; ctx.fillStyle=WHITE;
  ctx.font = \`700 92px \${SANS}\`; ctx.letterSpacing='-3.6px';
  ctx.fillText('Official', M, 218);
  ctx.fillText('verdicts.', M, 306);
  ctx.letterSpacing='0px';

  // dek
  ctx.font = \`400 26px \${SANS}\`; ctx.fillStyle='rgba(255,255,255,.92)';
  const dek = wrap(ctx, 'Your post, your headline, your About section — inspected.', 600);
  let dy = 356;
  dek.forEach(l=>{ ctx.fillText(l, M, dy); dy += 34; });
  ctx.fillStyle = TINT; ctx.font = \`700 26px \${SANS}\`;
  const promise = wrap(ctx, 'Every roast ends with the version you should actually use.', 600);
  promise.forEach(l=>{ ctx.fillText(l, M, dy + 10); dy += 34; });

  // the four inspector keys
  const kw = 250, kh = 92, ky = H - 150;
  ['Partner','Recruiter','Intern','Algorithm'].forEach((label,i)=>{
    if(i > 2) return; // three fit the left column; the fourth inspects from off-card
    const x = M + i*(kw+16);
    const on = i===1;
    if(on){ ctx.fillStyle = WHITE; ctx.fillRect(x, ky, kw, kh); }
    else { ctx.strokeStyle = WHITE; ctx.lineWidth = 3; ctx.strokeRect(x, ky, kw, kh); }
    ctx.fillStyle = on ? BLUE : WHITE;
    ctx.font = \`700 30px \${SANS}\`; ctx.letterSpacing='-0.8px';
    ctx.fillText(label, x + 18, ky + 42);
    ctx.letterSpacing='2.6px';
    ctx.font = \`700 13px \${SANS}\`;
    ctx.fillStyle = on ? 'rgba(10,102,194,.75)' : 'rgba(255,255,255,.75)';
    ctx.fillText(['BILLS BY OBSERVATION','11,000 PROFILES DEEP','UNPAID, UNBOTHERED'][i], x + 18, ky + 70);
    ctx.letterSpacing='0px';
  });

  // roast intensity, right column
  const gx = 764, gw = W - gx - M;
  ctx.fillStyle = WHITE; ctx.font = \`700 22px \${SANS}\`; ctx.letterSpacing='1.6px';
  ctx.fillText('ROAST INTENSITY', gx, 196);
  ctx.letterSpacing='0px';
  const rows = [['1','GENTLE FEEDBACK',0],['2','PEER REVIEW',0],['3','PERFORMANCE REVIEW',0],['4','HR VIOLATION',1]];
  let ry = 232;
  rows.forEach(([n,label,on])=>{
    if(on){ ctx.fillStyle = WHITE; ctx.fillRect(gx, ry-24, gw, 36); }
    else { ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=2; ctx.strokeRect(gx, ry-24, gw, 36); }
    ctx.fillStyle = on ? BLUE : 'rgba(255,255,255,.9)';
    ctx.font = \`700 17px \${MONO}\`; ctx.letterSpacing='1.6px';
    ctx.fillText(n + ' · ' + label, gx + 14, ry);
    ry += 48;
  });
  ctx.letterSpacing='0px';

  // big stamp
  ctx.save();
  ctx.translate(gx + gw/2, 444); ctx.rotate(-5*Math.PI/180);
  ctx.font = \`700 26px \${SANS}\`; ctx.letterSpacing='4px'; ctx.textAlign='center';
  const sw = ctx.measureText('ROASTED — OFFICIAL').width + 34;
  ctx.strokeStyle = WHITE; ctx.lineWidth = 4; ctx.strokeRect(-sw/2, -26, sw, 52);
  ctx.fillStyle = WHITE; ctx.fillText('ROASTED — OFFICIAL', 0, 8);
  ctx.restore();
  ctx.letterSpacing='0px';

  // fine print
  ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,.72)';
  ctx.font = \`500 16px \${MONO}\`; ctx.letterSpacing='1.4px';
  ctx.fillText('COMPLAINTS PROCESSED LOCALLY', M, H - 34);
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
results.push(await shot('icon', 512, 512, 'roast-icon-512.png'));
results.push(await shot('icon', 192, 192, 'roast-icon-192.png'));
results.push(await shot('icon', 180, 180, 'roast-apple-touch-icon.png'));
results.push(await shot('small', 32, 32, 'roast-favicon-32.png'));
results.push(await shot('small', 16, 16, 'roast-favicon-16.png'));
results.push(await shot('og', 1200, 630, 'roast-og.png'));
console.log(results.join('\n'));
await browser.close();
