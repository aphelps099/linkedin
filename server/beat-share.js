import express from 'express';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {readSharedBeat,shareUrl,coverPreviewUrl,SLEEVE_THEMES} from '../src/post-beat/share.js';

const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function renderBeatShare(html,href,origin='https://linkedinbeats.com'){
  const shared=readSharedBeat(href);
  if(!shared)return null;
  const {recipe,cover,artist=''}=shared;
  const title=`${recipe.chorus} — ${artist||'LinkedIn Beats'}`;
  const description=`"${recipe.chorus}" — A LinkedIn post with a bassline. Listen to this 30-second remix, then make your own.`;
  const canonical=shareUrl(origin,recipe,cover.id,artist);
  const image=coverPreviewUrl(origin,recipe,cover.id,artist);

  const values={
    description,
    'og:site_name':'LinkedIn Beats',
    'og:type':'website',
    'twitter:card':'summary_large_image',
    'og:title':title,
    'og:description':description,
    'og:url':canonical,
    'og:image':image,
    'og:image:width':1200,
    'og:image:height':630,
    'og:image:alt':title,
    'og:image:type':'image/png',
    'twitter:title':title,
    'twitter:description':description,
    'twitter:image':image,
    'twitter:image:alt':title
  };

  let result=html.replace(/<title>[^<]*<\/title>/,()=>`<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+(?:property|name)="([^"]+)"\s+content="[^"]*"\s*\/?\s*>/g,(tag,key)=>Object.hasOwn(values,key)?`<meta ${key.startsWith('og:')?'property':'name'}="${key}" content="${escapeHtml(values[key])}" />`:tag)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/,()=>`<link rel="canonical" href="${escapeHtml(canonical)}" />`)
    .replace('</head>','<meta name="robots" content="noindex" />\n</head>');

  // A URL share is a listening-page preview. Native feed video requires a
  // separate upload to LinkedIn, not og:video pointing at a temporary cache.
  for(const [key,value] of Object.entries(values)){
    if(!result.includes(`="${key}"`))result=result.replace('</head>',`<meta ${key.startsWith('og:')?'property':'name'}="${key}" content="${escapeHtml(value)}" />\n</head>`);
  }

  return result;
}

const previewCache=new Map();
export async function renderBeatCover({recipe,cover,artist=''}){
  const key=JSON.stringify([recipe.chorus,cover.id,artist]);if(previewCache.has(key))return previewCache.get(key);
  const [base,stripe,ink,accent]=SLEEVE_THEMES[cover.id];
  // Reserve the right column for a signal graphic; title and CTA never overlap.
  const rings=Array.from({length:11},(_,i)=>`<ellipse cx="1160" cy="312" rx="${70+i*25}" ry="${85+i*34}" fill="none" stroke="${accent}" stroke-width="${i===5?5:1.5}" opacity="${i===5?.9:.35}"/>`).join('');
  const bg=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="s" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="${stripe}" stroke-width="1"/></pattern><clipPath id="signal"><rect x="900" y="0" width="300" height="630"/></clipPath></defs><rect width="1200" height="630" fill="${base}"/><rect width="1200" height="630" fill="url(#s)"/><g clip-path="url(#signal)">${rings}</g><rect x="56" y="520" width="325" height="58" rx="29" fill="${accent}"/><path d="M334 545h20m-8-8 8 8-8 8" stroke="${base}" stroke-width="2.5" fill="none"/></svg>`);
  const text=async(value,size,color,width,height)=>sharp({text:{text:`<span foreground="${color}">${escapeHtml(value)}</span>`,font:`TT Hoves DemiBold ${size}`,fontfile:fileURLToPath(new URL('../public/home-2/fonts/tt-hoves-demibold.ttf',import.meta.url)),width,...(height?{height}:{}),rgba:true,wrap:'word-char'}}).png().toBuffer();
  const [heading,label,byline,cta]=await Promise.all([
    text(recipe.chorus,112,ink,800,330),
    text('LINKEDIN BEATS  /  STUDIO RELEASE',22,accent,810),
    text((artist||'LinkedIn Beats').slice(0,48),24,ink,450,32),
    text('Listen to the remix',23,base,235,27),
  ]);
  const png=await sharp(bg).composite([{input:label,left:58,top:48},{input:heading,left:56,top:130},{input:cta,left:80,top:536},{input:byline,left:420,top:537}]).png().toBuffer();
  if(previewCache.size>=48)previewCache.delete(previewCache.keys().next().value);previewCache.set(key,png);return png;
}

export function createBeatShareRouter({template,origin='https://linkedinbeats.com'}){
  const router=express.Router();
  router.get('/api/beat/cover.png',async(req,res,next)=>{
    const shared=readSharedBeat(req.originalUrl);if(!shared)return res.status(404).end();
    try{
      res.set('Cache-Control','public, max-age=86400').type('png').send(await renderBeatCover(shared));
    }catch(error){next(error);}
  });
  router.get(['/optimizer'],async(req,res,next)=>{
    if(!new URL(req.originalUrl,origin).searchParams.has('beat'))return next();
    const shared=readSharedBeat(req.originalUrl);
    if(!shared){
      res.status(404).type('html').send('<!doctype html><html lang="en"><link rel="icon" type="image/svg+xml" href="/home-2/brand/favicon.svg?v=brand-20261022"><title>Beat not found</title><meta name="viewport" content="width=device-width,initial-scale=1"><body><h1>This beat link is incomplete.</h1><p>Ask the sender for a new link, or <a href="/optimizer">make your own beat</a>.</p></body></html>');
      return;
    }
    try{
      const html=await readFile(template,'utf8');
      res.set('Cache-Control','no-cache').type('html').send(renderBeatShare(html,req.originalUrl,origin));
    }catch(error){next(error);}
  });
  return router;
}

export function beatSharePreview(){
  return {name:'post-beat-share-preview',configureServer(server){
    const app=express();
    app.get('/api/beat/cover.png',async(req,res,next)=>{
      const shared=readSharedBeat(req.originalUrl);if(!shared)return res.status(404).end();
      try{res.type('png').send(await renderBeatCover(shared));}catch(error){next(error);}
    });
    server.middlewares.use(app);
  },transformIndexHtml(html,context){
    const href=context.originalUrl;
    if(!href||!/^\/optimizer(?:\/|\?|$)/.test(href))return html;
    return renderBeatShare(html,href)||html;
  }};
}
