// Company Store assets:
// 1. Re-encodes the product photography from the design handoff (1.2–1.5MB
//    PNGs) into web-weight WebP files in public/store/.
// 2. Composes public/store-og.png (1200×630), the store's social card — the
//    CS-1 masthead and title beside the conference-room turntable photograph
//    (public/store/press-conference-turntable.webp).
// Uses the same pre-installed Chromium the other make-*-assets scripts draw
// with. Run with: node scripts/make-store-assets.mjs
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';

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

const SRC = 'design_handoff_company_store/uploads/';
const OUT = 'public/store/';
const SIZE = 1024;    // photos are 1024×1024; keep full resolution, recompress only
const QUALITY = 0.82;

// SKU → handoff photo (the three shot products; the rest await photography)
const PHOTOS = {
  'cs-101': 'aaronphelps_man_in_his_mid_30s_in_the_same_off-white_tee_tuck_6c921634-af9d-49b5-a0ee-6fc92a305af6_0.png',
  'cs-102': 'aaronphelps_1._woman_in_her_mid_30s_wearing_an_off-white_t-sh_75d9b143-7eba-4f0b-ba30-f31fdeb25541_1.png',
  'cs-202': 'aaronphelps_woman_in_her_mid_30s_in_business_casual_wearing_a_68ed172e-dd2e-4662-b8f3-a8020a32ca2c_0.png',
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });
const page = await browser.newPage();

for(const [sku, file] of Object.entries(PHOTOS)){
  const dataUri = 'data:image/png;base64,' + readFileSync(SRC + file).toString('base64');
  const webp = await page.evaluate(async ({ src, size, quality }) => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    // cover-crop to square, matching the storefront's object-fit: cover
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    return canvas.toDataURL('image/webp', quality).split(',')[1];
  }, { src: dataUri, size: SIZE, quality: QUALITY });
  const out = `${OUT}${sku}.webp`;
  writeFileSync(out, Buffer.from(webp, 'base64'));
  console.log(`${out} — ${(Buffer.from(webp, 'base64').length / 1024).toFixed(0)}KB`);
}

// ---- the social card: left panel in the house voice, photograph right ----
const pressUri = 'data:image/webp;base64,' +
  readFileSync(`${OUT}press-conference-turntable.webp`).toString('base64');
const og = await page.evaluate(async ({ src }) => {
  const PAPER = '#f6f5f1', INK = '#111111', INK40 = 'rgba(17,17,17,.4)', BLUE = '#0a66c2';
  const SANS = '"Helvetica Neue",Helvetica,Arial,sans-serif';
  const MONO = '"IBM Plex Mono",Menlo,Consolas,monospace';
  const W = 1200, H = 630, SPLIT = 570, PAD = 44;

  const img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // left panel: paper
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, SPLIT, H);
  // right panel: the photograph, cover-cropped to 630×630
  const s = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, SPLIT, 0, W - SPLIT, H);
  // the rule between them, drawn not shadowed
  ctx.fillStyle = INK; ctx.fillRect(SPLIT - 3, 0, 3, H);

  // masthead: wordmark + heavy rule
  ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 34px ${SANS}`; ctx.letterSpacing = '-0.7px';
  ctx.fillText('Circle Back', PAD, PAD + 34);
  const wm = ctx.measureText('Circle Back').width;
  ctx.letterSpacing = '0px';
  ctx.font = `700 14px ${SANS}`;
  ctx.fillText('®', PAD + wm + 3, PAD + 16);
  ctx.fillRect(PAD, PAD + 52, SPLIT - 2 * PAD, 3);

  // kicker
  ctx.fillStyle = BLUE; ctx.font = `700 12.5px ${SANS}`; ctx.letterSpacing = '2px';
  ctx.fillText('THE CIRCLE BACK® ECOSYSTEM · MERCHANDISE DIVISION', PAD, PAD + 96);

  // title, corporate blue, tight
  ctx.font = `700 82px ${SANS}`; ctx.letterSpacing = '-3.7px';
  ctx.fillText('The Company', PAD - 4, 262);
  ctx.fillText('Store', PAD - 4, 339);
  ctx.letterSpacing = '0px';

  // the form line
  ctx.fillStyle = INK40; ctx.font = `500 15px ${MONO}`;
  ctx.fillText('Form CS-1 · Rev. 2026-08 · All sales final', PAD, 396);

  // the stamp, pre-tilted −4°
  ctx.save();
  ctx.translate(PAD + 4, 484); ctx.rotate(-4 * Math.PI / 180);
  ctx.strokeStyle = BLUE; ctx.lineWidth = 3;
  ctx.font = `700 17px ${SANS}`; ctx.letterSpacing = '2.5px';
  const label = 'FREE SHIPPING OVER $50';
  const lw = ctx.measureText(label).width;
  ctx.strokeRect(0, 0, lw + 32, 46);
  ctx.fillStyle = BLUE; ctx.fillText(label, 16, 31);
  ctx.restore();

  // fine print
  ctx.fillStyle = INK40; ctx.font = `500 11px ${MONO}`; ctx.letterSpacing = '1.2px';
  ctx.fillText('PRINTED ON DEMAND · COMPLAINTS PROCESSED LOCALLY ▮', PAD, H - PAD + 6);

  return canvas.toDataURL('image/png').split(',')[1];
}, { src: pressUri });
writeFileSync('public/store-og.png', Buffer.from(og, 'base64'));
console.log(`public/store-og.png — ${(Buffer.from(og, 'base64').length / 1024).toFixed(0)}KB`);

await browser.close();
