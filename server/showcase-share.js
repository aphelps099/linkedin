import express from 'express';
import {readFile} from 'node:fs/promises';
import {sharedFilm,showcaseShareUrl,SHOWCASE_ORIGIN} from '../src/home-2/showcase-sharing.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function filmShareHTML(html,item){
  const title=escape(`${item.title} — LinkedIn Beats`);
  const description=escape(`Watch ${item.title}. A ${item.duration} film from LinkedIn Beats.`);
  const url=escape(showcaseShareUrl(item));
  const image=`${SHOWCASE_ORIGIN}/cutting-room/posters/${item.film}.jpg`;
  return html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${title}</title>`)
    .replace(/<meta\s+(?:property|name)="(?:og:[^"]+|twitter:[^"]+|description)"[^>]*>/gi,'')
    .replace(/<link\s+rel="canonical"[^>]*>/gi,'')
    .replace('</head>',`<link rel="canonical" href="${url}"/><meta name="description" content="${description}"/><meta property="og:type" content="website"/><meta property="og:site_name" content="LinkedIn Beats"/><meta property="og:title" content="${title}"/><meta property="og:description" content="${description}"/><meta property="og:url" content="${url}"/><meta property="og:image" content="${image}"/><meta property="og:image:width" content="640"/><meta property="og:image:height" content="360"/><meta property="og:image:alt" content="${escape(item.title)}"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${title}"/><meta name="twitter:description" content="${description}"/><meta name="twitter:image" content="${image}"/></head>`);
}
export function createShowcaseShareRouter({template,transform}){
  const router=express.Router();
  router.get(['/','/index.html'],async(req,res,next)=>{
    const item=sharedFilm(req.originalUrl.slice(req.originalUrl.indexOf('?')));
    if(!item)return next();
    try{
      let html=filmShareHTML(await readFile(template,'utf8'),item);
      if(transform)html=await transform(html,req);
      res.set('Cache-Control','no-cache').type('html').send(html);
    }catch(error){next(error);}
  });
  return router;
}
