import express from 'express';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {certificateSvg,escapeCertificateText as esc} from '../src/program/components/certificate-art.js';
import {certificateShareUrl,certificateImageUrl,linkedInCertificateUrl,readCertificateName,CERTIFICATE_FILENAME} from '../src/program/components/certificate-share.js';

const assets=Promise.all(['wordmark-horizontal.svg','monogram.svg'].map(file=>readFile(new URL(`../public/home-2/brand/${file}`,import.meta.url),'utf8'))).then(([wordmark,monogram])=>({wordmark,monogram}));
const images=new Map();
export async function renderCertificateImage(name,download=false){
  const key=JSON.stringify([name,download]);
  if(images.has(key))return images.get(key);
  const pending=(async()=>{
    const svg=certificateSvg(name,await assets);
    // Pad the whole certificate to LinkedIn's 1.91:1 preview ratio: no cropped border.
    const size=download?{width:2400,height:1700}:{width:1200,height:630};
    return sharp(Buffer.from(svg),{density:download?144:96}).resize({...size,fit:'contain',background:'#10182f'}).png().toBuffer();
  })();
  if(images.size>=32)images.delete(images.keys().next().value);
  images.set(key,pending);
  try{return await pending;}catch(error){images.delete(key);throw error;}
}
export async function renderCertificatePage(name,origin='https://linkedinbeats.com'){
  const title=`${name} — Certified Thought Leader`, description='Five lessons. Considerable effort. Unclear business impact. A Certificate of Professional Effort from LinkedIn Beats Academy.';
  const url=certificateShareUrl(name,origin),image=certificateImageUrl(name,origin);
  const svg=certificateSvg(name,await assets).replace('<svg ','<svg class="certificate" role="img" aria-label="'+esc(`Certificate of Professional Effort awarded to ${name}`)+'" ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | LinkedIn Beats Academy</title>
  <meta name="description" content="${esc(description)}"><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="website"><meta property="og:site_name" content="LinkedIn Beats Academy"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:secure_url" content="${esc(image)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(title+' — Certificate of Professional Effort')}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(image)}">
  <style>*{box-sizing:border-box}body{margin:0;background:#f6f5ef;color:#10182f;font-family:Arial,sans-serif}header{border-bottom:1px solid #deded5}nav,main{max-width:1100px;margin:auto;padding:24px 30px}nav{display:flex;justify-content:space-between;gap:20px;align-items:center}a{color:#0757ec}nav a{font-weight:700;text-decoration:none}nav strong{font-size:22px;letter-spacing:-.7px}nav span{font-weight:400;margin-left:8px;font-size:16px}main{padding-top:38px;padding-bottom:60px}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:1.8px;color:#0757ec;font-weight:700}h1{font-size:38px;letter-spacing:-1.3px;line-height:1.1;margin:12px 0}p{line-height:1.6;color:#45566e}.actions{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0 14px}.actions a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:12px 18px;border:1px solid #c9d2dc;border-radius:6px;font-size:14px;text-decoration:none;font-weight:700}.actions .primary{background:#0757ec;color:white;border-color:#0757ec}.note{font-size:12px;margin-bottom:24px}.certificate{display:block;width:100%;height:auto;box-shadow:0 14px 30px #10182f0a}footer{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:18px;border-top:1px solid #deded5;margin-top:32px;padding-top:22px}footer strong{display:block;font-size:20px}footer p{margin:6px 0}footer a{font-weight:700;text-decoration:none}@media(max-width:600px){nav,main{padding-inline:18px}nav strong{font-size:18px}nav span{display:none}nav a{font-size:13px}h1{font-size:30px}.actions .primary{width:100%}}@media print{header,.intro,footer{display:none}main{padding:0;max-width:none}.certificate{box-shadow:none}@page{size:landscape;margin:10mm}}</style></head><body>
  <header><nav><a href="/learn/"><strong>linkedinbeats<span>Academy</span></strong></a><a href="/">Main site ↗</a></nav></header><main><div class="intro"><span class="eyebrow">A very public milestone</span><h1>Considerable effort. Officially recognized.</h1><p>${esc(name)}’s Certificate of Professional Effort from LinkedIn Beats Academy.</p><div class="actions"><a class="primary" href="${esc(linkedInCertificateUrl(name,origin))}" target="_blank" rel="noopener noreferrer">Post to LinkedIn ↗</a><a href="${esc(image+'&download=1')}" download="${CERTIFICATE_FILENAME}">Download certificate</a></div><p class="note">Opens LinkedIn with this certificate as a link preview. Review it, add a thought, then post.</p></div>${svg}<footer><div><strong>Become equally qualified.</strong><p>Five short lessons. A lifetime of strategic alignment.</p></div><a href="/learn/">Explore the Academy →</a></footer></main></body></html>`;
}
export function createCertificateShareRouter({origin='https://linkedinbeats.com'}={}){
  const router=express.Router();
  router.get(['/learn/certificate','/learn/certificate/','/api/learn/certificate.png'],async(req,res,next)=>{
    const name=readCertificateName(req.originalUrl);
    res.set('X-Robots-Tag','noindex, nofollow');
    if(!name)return res.status(404).type('html').send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificate unavailable</title><h1>This certificate link is incomplete.</h1><p><a href="/learn/">Visit LinkedIn Beats Academy</a></p></html>');
    try{
      if(req.path==='/api/learn/certificate.png'){
        const download=req.query.download==='1';
        if(download)res.attachment(CERTIFICATE_FILENAME);
        return res.set('Cache-Control','public, max-age=86400').type('png').send(await renderCertificateImage(name,download));
      }
      res.set('Cache-Control','no-cache').set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'").type('html').send(await renderCertificatePage(name,origin));
    }catch(error){next(error);}
  });
  return router;
}
export function certificateSharePreview(){
  const mount=server=>{const app=express();app.use(createCertificateShareRouter());server.middlewares.use(app);};
  return {name:'academy-certificate-sharing',configureServer:mount,configurePreviewServer:mount};
}
