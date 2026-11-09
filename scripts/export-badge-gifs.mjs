import {createServer} from 'vite';
import {createServer as createHttpServer} from 'node:http';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {BADGE_CYCLE_MS,BADGE_FRAME_MS} from '../src/program/components/badge-motion.js';
// Load the actual component with Vite's JSX/raw-SVG support, without site APIs.
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:{server:createHttpServer()}},appType:'custom',logLevel:'error'});
try{
 const {BadgeArtwork}=await vite.ssrLoadModule('/src/program/components/BadgeArtwork.jsx');
 const {REWARDS}=await vite.ssrLoadModule('/src/program/components/Rewards.jsx');
 const width=630,height=450,frames=BADGE_CYCLE_MS/BADGE_FRAME_MS;
 await mkdir('public/learn/badges',{recursive:true});
 const manifest={};
 for(let n=1;n<=5;n++){
  const raw=[];
  for(let frame=0;frame<frames;frame++){
   let svg=renderToStaticMarkup(React.createElement(BadgeArtwork,{number:n,reward:REWARDS[n-1],timeMs:frame*BADGE_FRAME_MS}));
   svg=svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="630" height="450" ');
   raw.push(await sharp(Buffer.from(svg)).resize(width,height).ensureAlpha().raw().toBuffer());
  }
  const gif=await sharp(Buffer.concat(raw),{raw:{width,height:height*frames,channels:4,pageHeight:height}}).gif({loop:0,delay:Array(frames).fill(BADGE_FRAME_MS),colours:128,dither:0,effort:7,interFrameMaxError:0,interPaletteMaxError:0}).toBuffer();
  const file=`lesson-${n}-marquee.gif`,hash=createHash('sha256').update(gif).digest('hex').slice(0,12);
  await writeFile(`public/learn/badges/${file}`,gif);
  const meta=await sharp(gif,{animated:true}).metadata();
  if(meta.width!==width||meta.pageHeight!==height||meta.pages<2||meta.loop!==0||meta.delay.reduce((a,b)=>a+b,0)!==BADGE_CYCLE_MS)throw Error(`Invalid animation for lesson ${n}`);
  manifest[n]={url:`/learn/badges/${file}?v=${hash}`,width,height,bytes:gif.length,cycleMs:BADGE_CYCLE_MS};
  console.log(`Lesson ${n}: ${meta.pages} frames, ${(gif.length/1024).toFixed(0)} KB, ${BADGE_CYCLE_MS/1000}s loop`);
 }
 await writeFile('src/program/components/badge-gifs.json',JSON.stringify(manifest,null,2)+'\n');
}finally{await vite.close();}
