import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {CHANNEL_ID,parseFeed,mergeVideos,createYouTubeFeed} from '../server/youtube.js';

const entry=(id,kind='video',title='Team &amp; Synergy')=>`<entry><yt:videoId>${id}</yt:videoId><yt:channelId>${CHANNEL_ID}</yt:channelId><title>${title}</title><published>2026-11-03T10:00:00Z</published><link rel="alternate" href="https://www.youtube.com/${kind==='short'?'shorts/':'watch?v='}${id}"/></entry>`;
const feed=entries=>`<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><yt:channelId>${CHANNEL_ID.slice(2)}</yt:channelId>${entries}</feed>`;
const parsed=parseFeed(feed(entry('abcdefghijk','short')+entry('abcdefghij2')));
assert.equal(parsed[0].kind,'short');
assert.equal(parsed[1].kind,'video');
assert.equal(parsed[0].title,'Team & Synergy');
assert.equal(parseFeed(feed(entry('abcdefghijk'))).length,1);
assert.equal(parseFeed(feed('')).length,0);
assert.throws(()=>parseFeed(feed('').replace(CHANNEL_ID.slice(2),'another-channel')));
assert.throws(()=>parseFeed('<!DOCTYPE feed><feed/>'));
assert.throws(()=>parseFeed('<feed>'));
assert.equal(parseFeed(feed(entry('../unsafe'))).length,0);
const merged=mergeVideos(parsed,[{...parsed[0],title:'Updated title',url:'https://evil.example'}]);
assert.equal(merged.length,2);
assert.equal(merged[0].title,'Updated title');
assert.equal(merged[0].url,'https://www.youtube.com/shorts/abcdefghijk');
assert.equal(mergeVideos(parsed,[],['abcdefghijk']).length,1);

const directory=await mkdtemp(path.join(tmpdir(),'lb-youtube-'));
try {
  const file=path.join(directory,'archive.json');
  let time=Date.now(), calls=0, fail=false;
  const fetchImpl=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));if(fail)throw new Error('offline');return {ok:true,text:async()=>feed(entry('abcdefghijk','short'))};};
  const get=createYouTubeFeed({file,fetchImpl,now:()=>time});
  const [first,second]=await Promise.all([get(),get()]);
  assert.equal(calls,1,'concurrent requests share one refresh');
  assert.deepEqual(first,second);
  assert.equal(first.stale,false);
  assert(first.items.some(item=>item.id==='abcdefghijk'));
  assert(first.items.some(item=>item.id==='AcqQxz4C7Tg'),'older uploads remain outside recent feed');
  await get();assert.equal(calls,1,'cache prevents excessive upstream calls');
  time+=16*60*1000;fail=true;
  const offline=await get();assert.equal(offline.stale,true);assert.deepEqual(offline.items,first.items);
  await get();assert.equal(calls,2,'outage retry is throttled');
  const restart=createYouTubeFeed({file,fetchImpl,now:()=>time});
  assert((await restart()).items.some(item=>item.id==='abcdefghijk'),'archive survives restart');
  assert(JSON.parse(await readFile(file,'utf8')).items.length>17);
  const badDisk=createYouTubeFeed({file:path.join(file,'impossible'),fetchImpl:async()=>({ok:true,text:async()=>feed(entry('abcdefghij3'))})});
  assert.equal((await badDisk()).stale,false,'disk failure does not discard a successful refresh');
} finally {await rm(directory,{recursive:true,force:true});}
console.log('YouTube feed: parsing, safe links, Shorts classification, deduplication, cache, concurrent refresh, outage fallback and persistence passed.');
