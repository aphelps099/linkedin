import express from 'express';
import {readFile} from 'node:fs/promises';
import {readSharedBeat,shareUrl} from '../src/post-beat/share.js';

const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function renderBeatShare(html,href,origin='https://linkedinbeats.com'){
  const shared=readSharedBeat(href);
  if(!shared)return null;
  const {recipe,cover}=shared;
  const title=`${cover.name} — LinkedIn Beats`;
  const description=`“${recipe.chorus}” — A LinkedIn post with a bassline. Listen to this 30-second remix, then make your own.`;
  const canonical=shareUrl(origin,recipe,cover.id);
  const image=new URL(cover.image,origin).href;
  const values={description,'og:site_name':'LinkedIn Beats','og:title':title,'og:description':description,'og:url':canonical,'og:image':image,'og:image:width':cover.width,'og:image:height':cover.height,'og:image:alt':cover.alt,'twitter:title':title,'twitter:description':description,'twitter:image':image};
  return html.replace(/<title>[^<]*<\/title>/,()=>`<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+(?:property|name)="([^"]+)"\s+content="[^"]*"\s*\/?\s*>/g,(tag,key)=>Object.hasOwn(values,key)?`<meta ${key.startsWith('og:')?'property':'name'}="${key}" content="${escapeHtml(values[key])}" />`:tag)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/,()=>`<link rel="canonical" href="${escapeHtml(canonical)}" />`)
    .replace('</head>','<meta name="robots" content="noindex" />\n</head>');
}

export function createBeatShareRouter({template,origin='https://linkedinbeats.com'}){
  const router=express.Router();
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
