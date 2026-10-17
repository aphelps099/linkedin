import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToString} from 'react-dom/server';

async function bundled(path){const r=await build({entryPoints:[path],bundle:true,format:'esm',platform:'node',write:false});return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);}
const {ROOMS,STUDIO_TRACKS:tracks,STUDIO_AUDIO:audioManifest,roomForTrack,queueForRoom}=await bundled('src/meeting-studio/catalog.js');
const {createRemixEngine,durationOf,responseOffset,VOCABULARY}=await bundled('src/studio-2/remix-engine.js');
assert.equal(tracks.length,10);assert.equal(ROOMS.length,4);
assert.deepEqual([...new Set(ROOMS.flatMap(r=>r.tracks))].sort(),tracks.map(t=>t.id).sort());
for(const room of ROOMS)assert([2,3].includes(room.tracks.length));
const decoded=new Map();
for(const track of tracks.slice(0,4)){
 const meta=audioManifest.tracks[track.id];assert.equal(meta.music.mode,'bed');
 assert(Math.abs(meta.music.duration-32*60/track.bpm)<1/32000);
 for(const [pairs,clips] of [[track.pairs.concat(track.visionary),meta.voice.clips],[VOCABULARY.map(v=>v.pair),audioManifest.vocabulary.clips]])for(const pair of pairs){
  const slot=960/track.bpm,replyAt=responseOffset(clips[pair[0]].M.duration,track.bpm);
  for(const speaker of ['M','F'])assert(.1+replyAt+clips[pair[1]][speaker].duration<slot,`${track.id}: ${pair.join(' / ')} must have space before the next pair`);
 }
 for(const part of ['music','voice']){
  const raw=execFileSync('ffmpeg',['-v','error','-i','public'+meta[part].file,'-f','f32le','-ar','32000','-ac','1','-'],{maxBuffer:32*1024*1024});
  const pcm=new Float32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
  assert(pcm.every(Number.isFinite));
  if(part==='music'){
   assert(Math.abs(pcm.length/32000-meta.music.duration)<.05,'loop duration matches the beat grid');
   const tail=pcm.slice(-32000,-3200);assert(Math.sqrt(tail.reduce((s,v)=>s+v*v,0)/tail.length)>.01,'loop has no padded silent tail');
  }else decoded.set(track.id,{sampleRate:32000,getChannelData:()=>pcm});
 }
}
class Param{constructor(value=0){this.value=value;}cancelScheduledValues(){}setTargetAtTime(v){this.value=v;}}
class Node{constructor(){this.gain=new Param();this.connections=[];}connect(n){this.connections.push(n);}disconnect(){}}
class Context{
 constructor(){this.currentTime=0;this.state='suspended';this.destination=new Node();this.sources=[];}
 createGain(){return new Node();}createBiquadFilter(){const n=new Node();n.frequency=new Param();n.Q=new Param();this.filter=n;return n;}
 createDynamicsCompressor(){const n=new Node();for(const k of ['threshold','knee','ratio','attack','release'])n[k]=new Param();return n;}
 createAnalyser(){const n=new Node();n.frequencyBinCount=64;n.getByteFrequencyData=a=>a.fill(0);return n;}
 createBufferSource(){const n=new Node();n.start=(...args)=>{n.args=args;};n.stop=()=>{n.stopped=true;};this.sources.push(n);return n;}
 async decodeAudioData(){return decoded.get('founder-mode');}async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}
}
const ctx=new Context(),requests=[];let tick;
const options={tracks,audioManifest,meetingVoices:true,initialQueue:queueForRoom(ROOMS[0]),contextFactory:()=>ctx,fetchImpl:async url=>{requests.push(url);return{ok:true,arrayBuffer:async()=>new ArrayBuffer(0)};},setTimer:fn=>{tick=fn;return 1;},clearTimer:()=>{tick=null;}};
const engine=createRemixEngine(options);assert.equal(requests.length,0);
await engine.toggle();assert.equal(engine.getState().playing,true);
assert(requests.includes('/studio/rooms/audio/founder-mode-music.mp3'));
const bed=ctx.sources.find(n=>n.loop).connections[0];assert.equal(ctx.sources.filter(n=>n.loop).length,1);
const [male,female]=ctx.sources.filter(n=>!n.loop).map(n=>n.connections[0].connections[0]);
assert.notEqual(male,female);engine.participant('drums');assert.equal(male.gain.value,0);assert.equal(female.gain.value,1);assert(bed.gain.value>0);
engine.participant('vocals');assert.equal(bed.gain.value,0);assert.equal(female.gain.value,1);
engine.participant('bass');assert.equal(engine.getState().muted.bass,false,'camera-off mic has no pretend stem');
engine.participant('keys');assert.equal(female.gain.value,0);engine.reset();assert(bed.gain.value>0&&male.gain.value>0&&female.gain.value>0);
engine.setting('energy',0);assert.equal(ctx.filter.frequency.value,2600);engine.setting('energy',2);assert.equal(ctx.filter.frequency.value,18000);
ctx.currentTime=.5;tick();assert.equal(engine.performanceFrame().speaker,'M');assert(engine.performanceFrame().level>0);
const reply=.16+responseOffset(audioManifest.tracks['founder-mode'].voice.clips[tracks[0].pairs[0][0]].M.duration,120);
ctx.currentTime=reply+.2;tick();assert.equal(engine.performanceFrame().speaker,'F');
await engine.toggle();assert.equal(engine.performanceFrame().speaker,null);await engine.toggle();assert.equal(engine.performanceFrame().speaker,'F');
await engine.seek(reply);ctx.currentTime+=.2;tick();assert.equal(engine.performanceFrame().speaker,'F');
await engine.next();assert.equal(tracks[engine.getState().index].id,'synergy');await engine.next();assert.equal(engine.getState().index,0);
ctx.currentTime+=durationOf(tracks[0])+1;tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(tracks[engine.getState().index].id,'synergy','automatic advance stays in selected room');
engine.setQueue(queueForRoom(ROOMS[3]));await engine.select(queueForRoom(ROOMS[3])[0]);await engine.previous();assert.equal(tracks[engine.getState().index].id,'circle-back','previous wraps inside room');
engine.dispose();
// A slow room request cannot replace a more recently selected room.
let resolveSlow;
const ctx2=new Context();const slow=createRemixEngine({...options,contextFactory:()=>ctx2,fetchImpl:url=>url.includes('founder-mode-music')?new Promise(resolve=>{resolveSlow=()=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});}):Promise.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)})});
const pending=slow.select(0);await slow.select(1);resolveSlow();await pending;assert.equal(slow.getState().index,1);assert.equal(slow.getState().playing,true);slow.dispose();
// Deep links select the matching names, playlist and initial song without playback.
const temp='node_modules/.cache/check-rooms-render.mjs';await mkdir('node_modules/.cache',{recursive:true});
const ui=await build({entryPoints:['src/meeting-studio/MeetingStudio.jsx'],bundle:true,format:'esm',platform:'node',packages:'external',write:false});await writeFile(temp,ui.outputFiles[0].text);
globalThis.window={location:{search:''},matchMedia:()=>({matches:false})};
try{const {MeetingStudio}=await import(pathToFileURL(process.cwd()+'/'+temp));
 for(const room of ROOMS){window.location.search='?room='+room.id;const html=renderToString(React.createElement(MeetingStudio));assert(html.includes(room.title+' music player'));assert(html.includes(room.names[3]+': connecting to audio'));assert(!/<video[^>]*autoPlay/i.test(html));for(const id of room.tracks)assert(html.includes(tracks.find(t=>t.id===id).title.replaceAll('&','&amp;').replaceAll("'",'&#x27;')));}
 window.location.search='?track=offline';const html=renderToString(React.createElement(MeetingStudio));assert(html.includes('Weekly Alignment'));assert(html.includes('The Pre-Meeting music player'));assert.equal((html.match(/aria-label="Mute [^"]+: /g)||[]).length,4);
}finally{await unlink(temp);delete globalThis.window;}
console.log('Rooms passed: 10 tracks / 4 queues, real decoded assets, phrase spacing, no silent tails, isolated voice/backing mutes, audio-driven portraits, energy, skip/wrap/auto-advance, stale-load protection and deep links.');
