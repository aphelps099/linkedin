import assert from 'node:assert/strict';
import express from 'express';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {makeRecipe,encodeRecipe} from '../src/post-beat/composition.js';
import {COVERS,DEFAULT_COVER,getCover,shareUrl,readSharedBeat,shareDestinations,suggestedCaption} from '../src/post-beat/share.js';
import {renderBeatShare,createBeatShareRouter} from '../server/beat-share.js';

const template=process.env.BEAT_SHARE_TEMPLATE||fileURLToPath(new URL('../lessons/index.html',import.meta.url));
const html=await readFile(template,'utf8');
const recipe=makeRecipe('Zoë joins the team. Welcome to the next chapter, Zoë.');
assert.equal(DEFAULT_COVER,'paper-jam');
const urls=new Set();
for(const cover of COVERS){
  const url=shareUrl('https://linkedinbeats.com/somewhere/?tracking=1#old',recipe,cover.id);
  const parsed=new URL(url);urls.add(url);
  assert.equal(parsed.pathname,'/lessons/');assert.equal(parsed.hash,'');
  assert.equal(parsed.searchParams.has('tracking'),false);
  assert.deepEqual(readSharedBeat(url),{recipe,cover});
  const output=renderBeatShare(html,url);
  assert(output.includes(`content="https://linkedinbeats.com${cover.image}"`));
  assert(output.includes(`content="${cover.width}"`));
  assert(output.includes(recipe.chorus));
  assert(output.includes('name="robots" content="noindex"'));
  assert(output.includes('name="twitter:card" content="summary_large_image"'));
  assert(output.includes('<div id="root"></div>'));
  assert(/<script\b[^>]*\btype="module"/.test(output),'sharing metadata must retain the app entry point');
  const canonical=output.match(/rel="canonical" href="([^"]+)"/)[1].replaceAll('&amp;','&');
  assert.equal(canonical,url);
  const file=new URL(`../public${cover.image}`,import.meta.url);
  assert((await stat(file)).size<5_000_000);
  const png=await readFile(file);
  assert.equal(png.readUInt32BE(16),cover.width);assert.equal(png.readUInt32BE(20),cover.height);
}
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

const app=express();app.use(createBeatShareRouter({template}));
app.use((_req,res)=>res.status(204).end());
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
try{
  for(const cover of COVERS){
    const url=shareUrl(origin,recipe,cover.id);
    const response=await fetch(url);
    assert.equal(response.status,200);assert(response.headers.get('content-type').includes('text/html'));
    assert((await response.text()).includes(`https://linkedinbeats.com${cover.image}`));
    assert.equal((await fetch(url,{method:'HEAD'})).status,200);
  }
  assert.equal((await fetch(origin+'/lessons/?beat=broken')).status,404);
  assert.equal((await fetch(origin+'/lessons/')).status,204,'ordinary editor route must continue to static handling');
  assert.equal((await fetch(origin+'/unrelated/?beat=broken')).status,204);
  console.log('Beat sharing passed: three cover URLs, exact recipe/legacy replay, safe server-rendered metadata, real image dimensions, platform links and invalid-link rejection.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
