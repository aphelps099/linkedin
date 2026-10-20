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
  const description=`“${recipe.chorus}” — A LinkedIn post with a bassline. Listen to this 30-second remix, then make your own.`;
  const canonical=shareUrl(origin,recipe,cover.id,artist);
  const image=coverPreviewUrl(origin,recipe,cover.id,artist);
  const values={description,'og:site_name':'LinkedIn Beats','og:title':title,'og:description':description,'og:url':canonical,'og:image':image,'og:image:width':1200,'og:image:height':630,'og:image:alt':title,'twitter:title':title,'twitter:description':description,'twitter:image':image};
  return html.replace(/<title>[^<]*<\/title>/,()=>`<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+(?:property|name)="([^"]+)"\s+content="[^"]*"\s*\/?\s*>/g,(tag,key)=>Object.hasOwn(values,key)?`<meta ${key.startsWith('og:')?'property':'name'}="${key}" content="${escapeHtml(values[key])}" />`:tag)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/,()=>`<link rel="canonical" href="${escapeHtml(canonical)}" />`)
    .replace('</head>','<meta name="robots" content="noindex" />\n</head>');
}

const previewCache=new Map();
export async function renderBeatCover({recipe,cover,artist=''}){
  const key=JSON.stringify([recipe.chorus,cover.id,artist]);if(previewCache.has(key))return previewCache.get(key);
  const [base,stripe,ink,accent]=SLEEVE_THEMES[cover.id];
  const bg=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="s" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="48" height="48" fill="${base}"/><rect width="22" height="48" fill="${stripe}"/></pattern></defs><rect width="1200" height="630" fill="url(#s)"/></svg>`);
  const text=async(value,font,size,color,width,height)=>sharp({text:{text:`<span foreground="${color}">${escapeHtml(value)}</span>`,font:`${font==='anton'?'Anton':'TT Hoves'} ${size}`,fontfile:fileURLToPath(new URL(font==='anton'?'../public/home/fonts/anton.ttf':'../public/home-2/fonts/tt-hoves-demibold.ttf',import.meta.url)),width,...(height?{height}:{}),rgba:true,wrap:'word-char'}}).png().toBuffer();
  const [heading,label,byline]=await Promise.all([
    text(recipe.chorus.toUpperCase(),'anton',150,ink,1072,390),
    text(`${cover.name.toUpperCase()} SERIES  /  LINKEDIN BEATS`,'hoves',22,accent,1072),
    text(artist||'LinkedIn Beats','hoves',28,ink,1072),
  ]);
  const png=await sharp(bg).composite([{input:label,left:64,top:42},{input:heading,left:64,top:130},{input:byline,left:64,top:558}]).png().toBuffer();
  if(previewCache.size>=32)previewCache.delete(previewCache.keys().next().value);previewCache.set(key,png);return png;
}

export function createBeatShareRouter({template,origin='https://linkedinbeats.com'}){
  const router=express.Router();
  router.get('/api/beat/cover.png',async(req,res,next)=>{
    const shared=readSharedBeat(req.originalUrl);if(!shared)return res.status(404).end();
    try{res.set('Cache-Control','public, max-age=86400').type('png').send(await renderBeatCover(shared));}catch(error){next(error);}
  });
  router.get(['/lessons','/lessons/','/lessons/index.html'],async(req,res,next)=>{
    if(!new URL(req.originalUrl,origin).searchParams.has('beat'))return next();
    if(!readSharedBeat(req.originalUrl)){
      res.status(404).type('html').send('<!doctype html><html lang="en"><title>Beat not found</title><meta name="viewport" content="width=device-width,initial-scale=1"><body><h1>This beat link is incomplete.</h1><p>Ask the sender for a new link, or <a href="/lessons/">make your own beat</a>.</p></body></html>');
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
  return {name:'post-beat-share-preview',transformIndexHtml(html,context){
    const href=context.originalUrl;
    if(!href||!/^\/lessons(?:\/|\?|$)/.test(href))return html;
    return renderBeatShare(html,href)||html;
  }};
}
