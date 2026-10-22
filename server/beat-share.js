import express from 'express';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {readSharedBeat,shareUrl,coverPreviewUrl,SLEEVE_THEMES} from '../src/post-beat/share.js';

const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function videoId(recipe,coverId,artist=''){
  const data=JSON.stringify({chorus:recipe.chorus,cover:coverId,artist});
  const hash=data.split('').reduce((h,c)=>(((h<<5)-h)+c.charCodeAt(0))|0,0);
  return Math.abs(hash).toString(16).padStart(16,'0').slice(0,16);
}

export function renderBeatShare(html,href,origin='https://linkedinbeats.com',options={}){
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
    'og:title':title,
    'og:description':description,
    'og:url':canonical,
    'og:image':image,
    'og:image:width':1200,
    'og:image:height':630,
    'og:image:alt':title,
    'twitter:title':title,
    'twitter:description':description,
    'twitter:image':image
  };

  // Add video OG tags if video is available
  if(options.includeVideo){
    const vid=videoId(recipe,cover.id,artist);
    const videoUrl=`${origin}/api/beat/video/${vid}.mp4`;
    values['og:type']='video.other';
    values['og:video']=videoUrl;
    values['og:video:secure_url']=videoUrl;
    values['og:video:type']='video/mp4';
    values['og:video:width']='1080';
    values['og:video:height']='1080';
    values['twitter:card']='player';
    values['twitter:player']=videoUrl;
    values['twitter:player:width']='1080';
    values['twitter:player:height']='1080';
  }

  let result=html.replace(/<title>[^<]*<\/title>/,()=>`<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+(?:property|name)="([^"]+)"\s+content="[^"]*"\s*\/?\s*>/g,(tag,key)=>Object.hasOwn(values,key)?`<meta ${key.startsWith('og:')?'property':'name'}="${key}" content="${escapeHtml(values[key])}" />`:tag)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/,()=>`<link rel="canonical" href="${escapeHtml(canonical)}" />`)
    .replace('</head>','<meta name="robots" content="noindex" />\n</head>');

  // Add missing video tags if needed
  if(options.includeVideo && !html.includes('og:video')){
    const videoTags=`
    <meta property="og:type" content="video.other" />
    <meta property="og:video" content="${escapeHtml(values['og:video'])}" />
    <meta property="og:video:secure_url" content="${escapeHtml(values['og:video:secure_url'])}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="1080" />
    <meta property="og:video:height" content="1080" />
    <meta name="twitter:card" content="player" />
    <meta name="twitter:player" content="${escapeHtml(values['twitter:player'])}" />
    <meta name="twitter:player:width" content="1080" />
    <meta name="twitter:player:height" content="1080" />`;
    result=result.replace('</head>',`${videoTags}\n</head>`);
  }

  return result;
}

const previewCache=new Map();
export async function renderBeatCover({recipe,cover,artist=''},style='rich'){
  const key=JSON.stringify([recipe.chorus,cover.id,artist,style]);if(previewCache.has(key))return previewCache.get(key);
  const [base,stripe,ink,accent]=SLEEVE_THEMES[cover.id];

  // Background pattern
  const bg=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="s" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="48" height="48" fill="${base}"/><rect width="22" height="48" fill="${stripe}"/></pattern></defs><rect width="1200" height="630" fill="url(#s)"/></svg>`);

  const text=async(value,font,size,color,width,height)=>sharp({text:{text:`<span foreground="${color}">${escapeHtml(value)}</span>`,font:`${font==='anton'?'Anton':'TT Hoves'} ${size}`,fontfile:fileURLToPath(new URL(font==='anton'?'../public/home/fonts/anton.ttf':'../public/home-2/fonts/tt-hoves-demibold.ttf',import.meta.url)),width,...(height?{height}:{}),rgba:true,wrap:'word-char'}}).png().toBuffer();

  const [heading,label,byline]=await Promise.all([
    text(recipe.chorus.toUpperCase(),'anton',150,ink,1072,390),
    text(`${cover.name.toUpperCase()} SERIES  /  LINKEDIN BEATS`,'hoves',22,accent,1072),
    text(artist||'LinkedIn Beats','hoves',28,ink,1072),
  ]);

  const composites=[{input:label,left:64,top:42},{input:heading,left:64,top:130},{input:byline,left:64,top:558}];

  // Add player UI elements for 'rich' style
  if(style==='rich'){
    // Play button overlay - large circular button in center-right
    const playButton=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/></filter>
      </defs>
      <circle cx="950" cy="315" r="72" fill="white" opacity="0.95" filter="url(#shadow)"/>
      <path d="M 930 285 L 930 345 L 975 315 Z" fill="${ink}" opacity="0.9"/>
    </svg>`);

    // Waveform visualization - bottom third
    const bars=[12,28,18,42,55,38,22,45,52,32,18,48,62,44,26,38,58,48,30,20,42,56,35,22,48,32,60,40,28,16,38,52];
    const waveform=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.6">
        ${bars.map((h,i)=>`<rect x="${64+i*34}" y="${520-h}" width="24" height="${h}" fill="${accent}" rx="2"/>`).join('')}
      </g>
    </svg>`);

    // Duration badge
    const durationBadge=Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect x="64" y="470" width="80" height="36" rx="18" fill="${ink}" opacity="0.9"/>
      <text x="104" y="493" font-family="TT Hoves" font-size="18" font-weight="600" fill="white" text-anchor="middle">0:30</text>
    </svg>`);

    // "NOW PLAYING" indicator
    const nowPlaying=await text('▸ TAP TO PLAY','hoves',20,ink,300);

    composites.push(
      {input:waveform,left:0,top:0},
      {input:playButton,left:0,top:0},
      {input:durationBadge,left:0,top:0},
      {input:nowPlaying,left:780,top:42}
    );
  }

  const png=await sharp(bg).composite(composites).png().toBuffer();
  if(previewCache.size>=48)previewCache.delete(previewCache.keys().next().value);previewCache.set(key,png);return png;
}

export function createBeatShareRouter({template,origin='https://linkedinbeats.com',beatVideoStore}){
  const router=express.Router();
  router.get('/api/beat/cover.png',async(req,res,next)=>{
    const shared=readSharedBeat(req.originalUrl);if(!shared)return res.status(404).end();
    try{
      const style=req.query.style||'rich';
      res.set('Cache-Control','public, max-age=86400').type('png').send(await renderBeatCover(shared,style));
    }catch(error){next(error);}
  });
  router.get(['/lessons','/lessons/','/lessons/index.html'],async(req,res,next)=>{
    if(!new URL(req.originalUrl,origin).searchParams.has('beat'))return next();
    const shared=readSharedBeat(req.originalUrl);
    if(!shared){
      res.status(404).type('html').send('<!doctype html><html lang="en"><title>Beat not found</title><meta name="viewport" content="width=device-width,initial-scale=1"><body><h1>This beat link is incomplete.</h1><p>Ask the sender for a new link, or <a href="/lessons/">make your own beat</a>.</p></body></html>');
      return;
    }
    try{
      const html=await readFile(template,'utf8');
      let includeVideo=false;

      // Check if video exists for this beat
      if(beatVideoStore){
        const vid=videoId(shared.recipe,shared.cover.id,shared.artist||'');
        const result=await beatVideoStore.retrieve(vid).catch(()=>null);
        includeVideo=!!result;
      }

      res.set('Cache-Control','no-cache').type('html').send(renderBeatShare(html,req.originalUrl,origin,{includeVideo}));
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
