// Re-encodes the Company Store product photography from the design handoff
// (1.2–1.5MB PNGs) into web-weight WebP files in public/store/, using the
// same pre-installed Chromium the other make-*-assets scripts draw with.
// Run with: node scripts/make-store-assets.mjs
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

await browser.close();
