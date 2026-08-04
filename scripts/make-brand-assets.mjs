// Renders the brand assets with the same canvas vocabulary as the broadcast monitor,
// so the favicon and share card are drawn by the instrument they represent.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const OUT = '/home/user/linkedin/public/';

const PAGE = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#0a1a2b}canvas{display:block}</style>
<canvas id="c"></canvas>
<script>
const BLUE='#0a66c2', TINT='#9fc8ea', WHITE='#fff';
const SANS='"Helvetica Neue",Helvetica,Arial,sans-serif';
const MONO='"IBM Plex Mono",Menlo,Consolas,monospace';

function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}

// ---- the mark: type + rule + a playhead-framed beat, the house motifs ----
function icon(ctx, S){
  const u = S/64;                       // design grid: 64 units
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,S,S);

  // wordmark monogram
  ctx.fillStyle = WHITE;
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.font = \`700 \${35*u}px \${SANS}\`;
  ctx.letterSpacing = \`\${-1.7*u}px\`;
  ctx.fillText('CB', S/2, 35*u);
  ctx.letterSpacing = '0px';

  // masthead rule
  ctx.fillRect(11*u, 41*u, 42*u, 3.2*u);

  // the beat ribbon: four steps, two struck, one under the playhead
  const bw = 8*u, gap = 3.6*u, y = 48.5*u, h = 8*u;
  const startX = (S - (4*bw + 3*gap))/2;
  [1,0,1,0].forEach((on,i)=>{
    const x = startX + i*(bw+gap);
    if(on){ ctx.fillStyle = WHITE; ctx.fillRect(x,y,bw,h); }
    else { ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1.6*u; ctx.strokeRect(x+ .8*u,y+ .8*u,bw-1.6*u,h-1.6*u); }
  });
  const px = startX + 2*(bw+gap);
  ctx.strokeStyle = TINT; ctx.lineWidth = 1.8*u;
  ctx.strokeRect(px - 1.8*u, y - 1.8*u, bw + 3.6*u, h + 3.6*u);
}

// a compact mark for tiny sizes — the monogram alone, set larger
function iconSmall(ctx, S){
  const u = S/64;
  ctx.fillStyle = BLUE; ctx.fillRect(0,0,S,S);
  ctx.fillStyle = WHITE;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = \`700 \${42*u}px \${SANS}\`;
  ctx.letterSpacing = \`\${-2.4*u}px\`;
  ctx.fillText('CB', S/2, S/2 + 2*u);
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
  ctx.fillText('Circle Back', M, 84);
  const lw = ctx.measureText('Circle Back').width;
  ctx.font = \`700 18px \${SANS}\`; ctx.letterSpacing='0px';
  ctx.fillText('®', M + lw + 4, 66);
  ctx.textAlign='right'; ctx.fillStyle=TINT;
  ctx.font = \`500 17px \${MONO}\`; ctx.letterSpacing='1px';
  ctx.fillText('FORM CB-16 · REV. 2026-08', W - M, 80);
  ctx.letterSpacing='0px';
  ctx.fillStyle = WHITE; ctx.fillRect(M, 104, W - 2*M, 4);

  // headline
  ctx.textAlign='left'; ctx.fillStyle=WHITE;
  ctx.font = \`700 92px \${SANS}\`; ctx.letterSpacing='-3.6px';
  ctx.fillText('The LinkedIn', M, 218);
  ctx.fillText('remixer.', M, 306);
  ctx.letterSpacing='0px';

  // dek
  ctx.font = \`400 26px \${SANS}\`; ctx.fillStyle='rgba(255,255,255,.92)';
  const dek = wrap(ctx, 'Corporate phrases, spoken in time over a live drum machine.', 620);
  let dy = 356;
  dek.forEach(l=>{ ctx.fillText(l, M, dy); dy += 34; });
  ctx.fillStyle = TINT; ctx.font = \`700 26px \${SANS}\`;
  ctx.fillText('It’s not an instrument. It’s a journey.', M, dy + 10);

  // the three keys
  const kw = 196, kh = 92, ky = H - 150;
  ['Phrase','Build','Drop'].forEach((label,i)=>{
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
    ctx.fillText(['SAY THE NEXT LINE','RAISE THE ROOM','FULL STOP.'][i], x + 18, ky + 70);
    ctx.letterSpacing='0px';
  });

  // equalizer + beat grid on the right
  const gx = 760, gy = 176, gw = W - gx - M;
  const bars = 16, bgap = 6, bwid = (gw - bgap*(bars-1))/bars;
  const heights = [.35,.62,.48,.9,.55,.3,.72,.44,.85,.4,.58,.33,.68,.5,.78,.42];
  heights.forEach((v,i)=>{
    const h = v*150, x = gx + i*(bwid+bgap);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fillRect(x, gy + 150 - h, bwid, h);
    ctx.fillStyle = TINT; ctx.fillRect(x, gy + 150 - h - 7, bwid, 3);
  });
  const rows = 5, ry = gy + 190, cellH = 26, cellGap = 7;
  const seed = [
    [1,0,0,1,0,0,1,0,2,0,0,1,0,1,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0],
    [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1],
    [2,0,0,0,0,0,1,0,0,0,0,0,2,0,0,0],
  ];
  for(let r=0;r<rows;r++){
    for(let i=0;i<bars;i++){
      const x = gx + i*(bwid+bgap), y = ry + r*(cellH+cellGap);
      const v = seed[r][i];
      if(v){ ctx.fillStyle = WHITE; ctx.fillRect(x, y, bwid, cellH);
        if(v===2){ ctx.fillStyle = BLUE; ctx.fillRect(x + bwid/2 - 4, y + cellH/2 - 4, 8, 8); } }
      else { ctx.strokeStyle='rgba(255,255,255,.42)'; ctx.lineWidth=2; ctx.strokeRect(x+1, y+1, bwid-2, cellH-2); }
    }
  }
  // playhead
  ctx.strokeStyle = TINT; ctx.lineWidth = 4;
  const phx = gx + 8*(bwid+bgap);
  ctx.strokeRect(phx - 5, ry - 5, bwid + 10, rows*(cellH+cellGap) - cellGap + 10);

  // stamp
  ctx.save();
  ctx.translate(W - M - 118, H - 74); ctx.rotate(-4*Math.PI/180);
  ctx.font = \`700 17px \${SANS}\`; ctx.letterSpacing='3.4px'; ctx.textAlign='center';
  const sw = ctx.measureText('APPROVED — HR').width + 26;
  ctx.strokeStyle = WHITE; ctx.lineWidth = 3; ctx.strokeRect(-sw/2, -20, sw, 38);
  ctx.fillStyle = WHITE; ctx.fillText('APPROVED — HR', 0, 5);
  ctx.restore();
  ctx.letterSpacing='0px';

  // fine print
  ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,.72)';
  ctx.font = \`500 16px \${MONO}\`; ctx.letterSpacing='1.4px';
  ctx.fillText('AN EQUAL OPPORTUNITY INSTRUMENT', M, H - 34);
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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
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
results.push(await shot('icon', 512, 512, 'icon-512.png'));
results.push(await shot('icon', 192, 192, 'icon-192.png'));
results.push(await shot('icon', 180, 180, 'apple-touch-icon.png'));
results.push(await shot('small', 32, 32, 'favicon-32.png'));
results.push(await shot('small', 16, 16, 'favicon-16.png'));
results.push(await shot('og', 1200, 630, 'og.png'));
// preview blow-ups so the tiny marks can be eyeballed
await page.evaluate(() => window.render('small', 32, 32));
console.log(results.join('\n'));
await browser.close();
