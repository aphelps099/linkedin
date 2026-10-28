import assert from 'node:assert/strict';
import fs from 'node:fs';
import express from 'express';
import {showcaseSelection} from '../src/home-2/showcase-selection.js';
import {showcaseShareUrl,showcaseShareTargets,sharedFilm} from '../src/home-2/showcase-sharing.js';
import {filmShareHTML,createShowcaseShareRouter} from '../server/showcase-share.js';
const template=fs.readFileSync('index.html','utf8');
for(const item of showcaseSelection){
  const targets=showcaseShareTargets(item),url=new URL(targets.url);
  assert.equal(url.origin,'https://linkedinbeats.com');
  assert.equal(new URL(targets.facebook).searchParams.get('u'),targets.url);
  assert.equal(new URL(targets.x).searchParams.get('url'),targets.url);
  assert(decodeURIComponent(targets.email).includes(targets.url));
  assert(decodeURIComponent(targets.sms).includes(targets.url));
  assert(showcaseShareTargets(item,{appleMobile:true}).sms.startsWith('sms:&body='));
  if(item.film){
    assert.equal(sharedFilm(url.search),item);
    const html=filmShareHTML(template,item);
    assert(html.includes(item.film+'.jpg'));assert(html.includes('summary_large_image'));
    assert.equal((html.match(/property="og:title"/g)||[]).length,1);
    assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
  }else{assert.equal(url.pathname,'/studio/');assert.equal(url.searchParams.get('meeting'),item.meeting);}
}
for(const query of ['','?film=unknown','?film=room-to-scale','?film=%3Cscript%3E','?film=__proto__'])assert.equal(sharedFilm(query),null);
const attack=filmShareHTML(template,{...showcaseSelection[1],title:'<script>alert("bad")</script>'});
assert(!attack.includes('<script>alert('));assert(attack.includes('&lt;script&gt;'));
const app=express();app.use(createShowcaseShareRouter({template:'index.html'}));app.use((_req,res)=>res.status(404).end());
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
try{
 const origin=`http://127.0.0.1:${server.address().port}`;
 for(const item of showcaseSelection.filter(x=>x.film)){
   const url=new URL(showcaseShareUrl(item));const response=await fetch(origin+url.pathname+url.search);
   assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-cache');assert((await response.text()).includes(item.film+'.jpg'));
 }
 assert.equal((await fetch(origin+'/?film=unknown')).status,404);
 assert.equal((await fetch(origin+'/')).status,404);
}finally{server.close();}
console.log('Verified all card sharing destinations, film deep links, crawler previews, escaping and unknown-film fallthrough.');
