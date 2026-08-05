// Renders the LinkedIn Lessons brand assets with the same canvas vocabulary as
// the Circle Back set (scripts/make-brand-assets.mjs) — sibling products, one
// drawing hand. Lessons' signature motif is the LinkedInification dial where
// the mixer has its beat ribbon.
//   npm i -D playwright-core   # only needed to regenerate
//   node scripts/make-lessons-assets.mjs
import { chromium } from 'playwright-core';
import { writeFileSync, existsSync, readdirSync } from 'fs';

const OUT = new URL('../public/', import.meta.url).pathname;

// find a chromium: playwright's own install, or a PLAYWRIGHT_BROWSERS_PATH pool
function chromiumPath(){
  const pool = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if(pool && existsSync(pool)){
    for(const d of readdirSync(pool)){
      for(const p of [`${pool}/${d}/chrome-linux/chrome`, `${pool}/${d}/chrome-linux64/chrome`]){
        if(d.startsWith('chromium') && !d.includes('headless') && existsSync(p)) return p;
      }
    }
  }
  return undefined; // let playwright resolve its default install
}

const PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#0a1a2b}canvas{display:block}</style>
<canvas id="c"></canvas>
<script>
const BLUE='#0a66c2', TINT='#9fc8ea', WHITE='#fff';
const SANS='"Helvetica Neue",Helvetica,Arial,sans-serif';
const MONO='"IBM Plex Mono",Menlo,Consolas,monospace';

// the dial: five blocks, level 4 latched — Peak LinkedIn
function dial(ctx, x, y, bw, h, gap, active){
  for(let i=0;i<5;i++){
    const bx = x + i*(bw+gap);
    if(i < active){ ctx.fillStyle = i===active-1 ? WHITE : 'rgba(255,255,255,.45)'; ctx.fillRect(bx,y,bw,h); }
    else { ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=Math.max(1.4, h*.07); ctx.strokeRect(bx+1,y+1,bw-2,h-2); }
  }
}

// ---- the icon: LL monogram + rule + the dial ----
function icon(ctx, S){
  const u = S/64;
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,S,S);
  ctx.fillStyle = WHITE;
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.font = \`700 \${35*u}px \${SANS}\`;
  ctx.letterSpacing = \`\${-1.7*u}px\`;
  ctx.fillText('LL', S/2, 35*u);
  ctx.letterSpacing = '0px';
  ctx.fillRect(11*u, 41*u, 42*u, 3.2*u);
  const bw = 7*u, gap = 2.2*u, w5 = 5*bw + 4*gap;
  dial(ctx, (S-w5)/2, 48.5*u, bw, 8*u, gap, 4);
}

function iconSmall(ctx, S){
  const u = S/64;
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,S,S);
  ctx.fillStyle = WHITE;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = \`700 \${42*u}px \${SANS}\`;
  ctx.letterSpacing = \`\${-2.4*u}px\`;
  ctx.fillText('LL', S/2, S/2 + 2*u);
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

// ---- the share card ----
function og(ctx, W, H){
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,W,H);
  const M = 64;

  // masthead
  ctx.fillStyle = WHITE; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  ctx.font = \`700 40px \${SANS}\`; ctx.letterSpacing='-0.8px';
  ctx.fillText('LinkedIn Lessons', M, 84);
  const lw = ctx.measureText('LinkedIn Lessons').width;
  ctx.font = \`700 18px \${SANS}\`; ctx.letterSpacing='0px';
  ctx.fillText('™', M + lw + 4, 66);
  ctx.textAlign='right'; ctx.fillStyle=TINT;
  ctx.font = \`500 17px \${MONO}\`; ctx.letterSpacing='1px';
  ctx.fillText('FORM LL-7 · REV. 2026-08', W - M, 80);
  ctx.letterSpacing='0px';
  ctx.fillStyle = WHITE; ctx.fillRect(M, 104, W - 2*M, 4);

  // headline
  ctx.textAlign='left'; ctx.fillStyle=WHITE;
  ctx.font = \`700 92px \${SANS}\`; ctx.letterSpacing='-3.6px';
  ctx.fillText('The guided', M, 218);
  ctx.fillText('post generator.', M, 306);
  ctx.letterSpacing='0px';

  // dek
  ctx.font = \`400 26px \${SANS}\`; ctx.fillStyle='rgba(255,255,255,.92)';
  const dek = wrap(ctx, 'What are we pretending to be humbled about today?', 600);
  let dy = 356;
  dek.forEach(l=>{ ctx.fillText(l, M, dy); dy += 34; });
  ctx.fillStyle = TINT; ctx.font = \`700 26px \${SANS}\`;
  const promise = wrap(ctx, 'Create a better LinkedIn post — or make it dramatically worse.', 600);
  promise.forEach(l=>{ ctx.fillText(l, M, dy + 10); dy += 34; });

  // the three doors, mirroring the mixer's three keys
  const kw = 196, kh = 92, ky = H - 150;
  ['Announce','Teach','Roast'].forEach((label,i)=>{
    const x = M + i*(kw+16);
    const on = i===2;
    if(on){ ctx.fillStyle = WHITE; ctx.fillRect(x, ky, kw, kh); }
    else { ctx.strokeStyle = WHITE; ctx.lineWidth = 3; ctx.strokeRect(x, ky, kw, kh); }
    ctx.fillStyle = on ? BLUE : WHITE;
    ctx.font = \`700 30px \${SANS}\`; ctx.letterSpacing='-0.8px';
    ctx.fillText(label, x + 18, ky + 42);
    ctx.letterSpacing='2.6px';
    ctx.font = \`700 13px \${SANS}\`;
    ctx.fillStyle = on ? 'rgba(10,102,194,.75)' : 'rgba(255,255,255,.75)';
    ctx.fillText(['SOMETHING','A LESSON','MY POST'][i], x + 18, ky + 70);
    ctx.letterSpacing='0px';
  });

  // the dial, large, on the right — Lessons' signature
  const gx = 760, gw = W - gx - M;
  const bw = (gw - 4*10)/5;
  dial(ctx, gx, 176, bw, 64, 10, 4);
  ctx.textAlign='left';
  for(let i=0;i<5;i++){
    ctx.fillStyle = i===3 ? BLUE : 'rgba(255,255,255,.85)';
    ctx.font = \`700 26px \${SANS}\`;
    const tx = gx + i*(bw+10) + bw/2;
    ctx.textAlign='center';
    ctx.fillText(String(i+1), tx, 176 + 42);
  }
  ctx.textAlign='left';
  ctx.fillStyle = WHITE; ctx.font = \`700 22px \${SANS}\`; ctx.letterSpacing='1.6px';
  ctx.fillText('LINKEDINIFICATION LEVEL 4', gx, 286);
  ctx.fillStyle = TINT; ctx.font = \`700 20px \${SANS}\`; ctx.letterSpacing='0.4px';
  ctx.fillText('Peak LinkedIn', gx, 316);
  ctx.letterSpacing='0px';

  // mini diagnostics readout
  const rows = [
    ['HUMBLE-BRAG SCORE','61%'],
    ['GRATITUDE INFLATION','+2 UNEARNED'],
    ['JOURNEY REFERENCES','2'],
    ['\\u201CWELL DESERVED!\\u201D ODDS','89%'],
  ];
  let ry = 372;
  rows.forEach(([k,vv])=>{
    ctx.fillStyle='rgba(255,255,255,.75)'; ctx.font=\`500 15px \${MONO}\`; ctx.letterSpacing='1px';
    ctx.fillText(k, gx, ry);
    ctx.textAlign='right'; ctx.fillStyle=WHITE; ctx.font=\`700 15px \${MONO}\`;
    ctx.fillText(vv, W - M, ry);
    ctx.textAlign='left';
    ctx.fillStyle='rgba(255,255,255,.28)'; ctx.fillRect(gx, ry+10, gw, 1);
    ry += 36;
  });
  ctx.letterSpacing='0px';

  // stamp
  ctx.save();
  ctx.translate(W - M - 148, H - 74); ctx.rotate(-4*Math.PI/180);
  ctx.font = \`700 17px \${SANS}\`; ctx.letterSpacing='3.4px'; ctx.textAlign='center';
  const sw = ctx.measureText('HUMBLED — ALLEGEDLY').width + 26;
  ctx.strokeStyle = WHITE; ctx.lineWidth = 3; ctx.strokeRect(-sw/2, -20, sw, 38);
  ctx.fillStyle = WHITE; ctx.fillText('HUMBLED — ALLEGEDLY', 0, 5);
  ctx.restore();
  ctx.letterSpacing='0px';

  // fine print
  ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,.72)';
  ctx.font = \`500 16px \${MONO}\`; ctx.letterSpacing='1.4px';
  ctx.fillText('AN EQUAL OPPORTUNITY CURRICULUM', M, H - 34);
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
results.push(await shot('icon', 512, 512, 'lessons-icon-512.png'));
results.push(await shot('icon', 192, 192, 'lessons-icon-192.png'));
results.push(await shot('icon', 180, 180, 'lessons-apple-touch-icon.png'));
results.push(await shot('small', 32, 32, 'lessons-favicon-32.png'));
results.push(await shot('small', 16, 16, 'lessons-favicon-16.png'));
results.push(await shot('og', 1200, 630, 'lessons-og.png'));
console.log(results.join('\n'));
await browser.close();
