import assert from 'node:assert/strict';
import express from 'express';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {makeRecipe,encodeRecipe} from '../src/post-beat/composition.js';
import {COVERS,DEFAULT_COVER,getCover,shareUrl,coverPreviewUrl,readSharedBeat,shareDestinations,suggestedCaption} from '../src/post-beat/share.js';
import {createOptimizerRedirects} from '../server/optimizer-routes.js';
import {renderBeatShare,renderBeatCover,createBeatShareRouter} from '../server/beat-share.js';

const template=process.env.BEAT_SHARE_TEMPLATE||fileURLToPath(new URL('../optimizer/index.html',import.meta.url));
const html=await readFile(template,'utf8');
const recipe=makeRecipe('Zoë joins the team. Welcome to the next chapter, Zoë.');
assert.equal(DEFAULT_COVER,'paper-jam');
const urls=new Set();
for(const cover of COVERS){
  const url=shareUrl('https://linkedinbeats.com/somewhere/?tracking=1#old',recipe,cover.id);
  const parsed=new URL(url);urls.add(url);
  assert.equal(parsed.pathname,'/optimizer');assert.equal(parsed.hash,'');
  assert.equal(parsed.searchParams.has('tracking'),false);
  assert.deepEqual(readSharedBeat(url),{recipe,cover});
  const output=renderBeatShare(html,url);
  assert(output.includes(coverPreviewUrl('https://linkedinbeats.com',recipe,cover.id).replaceAll('&','&amp;')));
  assert(output.includes('content="1200"'));
  assert(output.includes(recipe.chorus));
  assert(output.includes('name="robots" content="noindex"'));
  assert(output.includes('name="twitter:card" content="summary_large_image"'));
  assert(output.includes('<div id="root"></div>'));
  const cachedVideo=renderBeatShare(html,url,'https://linkedinbeats.com',{includeVideo:true});
  assert(!cachedVideo.includes('property="og:video"'),'temporary cached videos must not become link embeds');
  assert(!cachedVideo.includes('name="twitter:player"'),'an MP4 is not a Twitter player iframe');
  assert.equal((cachedVideo.match(/name="twitter:card"/g)||[]).length,1);
  assert(new URL(coverPreviewUrl('https://linkedinbeats.com',recipe,cover.id)).searchParams.has('art'),'new artwork must bypass the old preview image cache');
  assert(/<script\b[^>]*\btype="module"/.test(output),'sharing metadata must retain the app entry point');
  const canonical=output.match(/rel="canonical" href="([^"]+)"/)[1].replaceAll('&amp;','&');
  assert.equal(canonical,url);
  const file=new URL(`../public${cover.image}`,import.meta.url);
  assert((await stat(file)).size<5_000_000);
  const image=await readFile(file),metadata=await sharp(image).metadata();
  assert.equal(metadata.width,cover.width);assert.equal(metadata.height,cover.height);
  const preview=await renderBeatCover({recipe,cover});
  const crop={left:0,top:0,width:1200,height:558};
  assert.deepEqual(await sharp(preview).extract(crop).removeAlpha().raw().toBuffer(),await sharp(image).extract(crop).removeAlpha().raw().toBuffer(),'shared beat previews must contain the approved artwork above the personalized footer');
  if(cover.video)assert((await stat(new URL(`../public${cover.video}`,import.meta.url))).size>10000,'office band cover must ship its performance video');
}
const named=shareUrl('https://linkedinbeats.com',recipe,DEFAULT_COVER,'Jo Example');assert.equal(readSharedBeat(named).artist,'Jo Example');assert(renderBeatShare(html,named).includes('Jo Example'));
assert.equal(urls.size,3,'different cover choices must have distinct crawler URLs');
assert.equal(getCover('https://evil.example/image').id,DEFAULT_COVER);
assert.equal(readSharedBeat('/lessons/?beat=broken'),null);
assert.equal(readSharedBeat('/lessons/?beat='+('x'.repeat(2501))),null);
assert.deepEqual(readSharedBeat('/lessons/#mix='+encodeRecipe(recipe)).recipe,recipe);
const legacy={version:1,bpm:96,chorus:'A new chapter.',keywords:['chapter']};
assert.deepEqual(readSharedBeat('/lessons/#mix='+encodeRecipe(legacy)).recipe,legacy);
const hostile={...recipe,chorus:'</title><script>alert("private")</script> & <img src=x onerror=alert(1)>'};
const safe=renderBeatShare(html,shareUrl('https://linkedinbeats.com',hostile));
assert(safe.includes('&lt;script&gt;'));assert(!safe.includes('<script>alert'));assert(!safe.includes('<img src=x'));
const share=shareUrl('https://linkedinbeats.com',recipe,'hr-paper-storm');
const caption=suggestedCaption(recipe),targets=shareDestinations(share,caption);
assert.equal(new URL(targets.linkedin).searchParams.get('url'),share);
assert.equal(new URL(targets.facebook).searchParams.get('u'),share);
assert.equal(new URL(targets.x).searchParams.get('text'),caption);
assert.equal(new URL(targets.x).searchParams.get('url'),share);
assert(new URL(targets.email).searchParams.get('body').includes(share));

const app=express();app.use(createOptimizerRedirects());app.use(createBeatShareRouter({template}));
app.use((_req,res)=>res.status(204).end());
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
try{
  for(const cover of COVERS){
    const url=shareUrl(origin,recipe,cover.id);
    const response=await fetch(url);
    assert.equal(response.status,200);assert(response.headers.get('content-type').includes('text/html'));
    assert((await response.text()).includes('/api/beat/cover.png?beat='));
    const image=await fetch(coverPreviewUrl(origin,recipe,cover.id));assert.equal(image.status,200);assert(image.headers.get('content-type').includes('image/png'));const png=Buffer.from(await image.arrayBuffer());assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
    assert.equal((await fetch(url,{method:'HEAD'})).status,200);
  }
  for(const oldPath of ['/lessons','/lessons/','/lessons/index.html','/optimizer/','/optimizer/index.html']){
    const query=new URL(shareUrl(origin,recipe,DEFAULT_COVER,'Jo Example')).search;
    const response=await fetch(origin+oldPath+query,{redirect:'manual'});
    assert.equal(response.status,301);
    assert.equal(response.headers.get('location'),'/optimizer'+query,'redirect retains every shared recipe parameter');
    assert.equal((await fetch(origin+oldPath+query)).status,200,'legacy beat URLs resolve to the listening page');
  }
  assert.equal((await fetch(origin+'/optimizer?beat=broken')).status,404);
  assert.equal((await fetch(origin+'/lessons/?beat=broken')).status,404);
  assert.equal((await fetch(origin+'/optimizer')).status,204,'ordinary editor route must continue to static handling');
  assert.equal((await fetch(origin+'/unrelated/?beat=broken')).status,204);
  console.log('Beat sharing passed: three approved artwork covers, office-band video asset, exact recipe/legacy replay, safe server-rendered metadata, personalized PNG previews, artist names, platform links and invalid-link rejection.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
