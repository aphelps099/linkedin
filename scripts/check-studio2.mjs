import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';

const bundled=await build({entryPoints:['src/studio-2/remix-engine.js'],bundle:true,format:'esm',platform:'node',write:false});
const {createRemixEngine,TRACKS,VOCABULARY,durationOf,responseOffset}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const manifest=JSON.parse(await readFile('src/studio-2/audio-manifest.json','utf8'));
for(const track of TRACKS){
  const pack=manifest.tracks[track.id];
  assert.equal(Object.keys(pack.music.stems).length,4);
  const length=pack.music.duration;
  assert(Math.abs(length-1920/track.bpm)<1/manifest.sampleRate);
  Object.values(pack.music.stems).forEach((segment,i)=>{
    assert(Math.abs(segment.start-i*length)<1e-9);assert.equal(segment.duration,length);
  });
  for(const pairs of [track.pairs,track.visionary,VOCABULARY.map(v=>v.pair)]){
    const clips=pairs===track.pairs||pairs===track.visionary?pack.voice.clips:manifest.vocabulary.clips;
    for(const [first,second] of pairs)for(const speaker of ['M','F']){
      const a=clips[first].M,b=clips[second][speaker];
      assert(a.duration>0&&b.duration>0);
      const reply=responseOffset(a.duration,track.bpm);
      assert(reply>=a.duration+.18,'call and response overlap');
      assert(reply+b.duration+.18<960/track.bpm,'pair runs into the next phrase slot');
    }
  }
}

class Param{constructor(v=0){this.value=v;this.events=[];}setTargetAtTime(v,t){this.value=v;this.events.push([v,t]);}cancelScheduledValues(){}}
class AudioNode{constructor(type){this.type=type;this.gain=new Param();this.connections=[];}connect(node){this.connections.push(node);return node;}disconnect(){this.disconnected=true;}}
class Context{
  constructor(){this.currentTime=0;this.state='suspended';this.destination=new AudioNode('destination');this.nodes=[];this.sources=[];}
  createGain(){const node=new AudioNode('gain');this.nodes.push(node);return node;}
  createDynamicsCompressor(){const node=new AudioNode('compressor');for(const key of ['threshold','knee','ratio','attack','release'])node[key]=new Param();return node;}
  createAnalyser(){const node=new AudioNode('analyser');node.frequencyBinCount=64;node.getByteFrequencyData=a=>a.fill(0);return node;}
  createBufferSource(){const node=new AudioNode('source');node.start=(...args)=>{node.startArgs=args;};node.stop=time=>{node.stopAt=time;};this.sources.push(node);return node;}
  decodeAudioData(bytes){return Promise.resolve({id:new TextDecoder().decode(bytes)});}
  async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function harness(fetchImpl){
  const context=new Context();let callback;const requests=[];
  const engine=createRemixEngine({contextFactory:()=>context,
    fetchImpl:fetchImpl|| (async url=>{requests.push(url);return{ok:true,arrayBuffer:async()=>new TextEncoder().encode(url).buffer};}),
    setTimer:fn=>{callback=fn;return 1;},clearTimer:()=>{callback=undefined;}});
  return{engine,context,requests,advance(time){context.currentTime=time;callback?.();}};
}
const h=harness();assert.equal(h.requests.length,0,'no autoplay or preload');
await h.engine.toggle();assert(h.engine.getState().playing);assert.equal(h.requests.length,2);
const loops=h.context.sources.filter(n=>n.loop);assert.equal(loops.length,4);
loops.forEach((node,i)=>{assert(Math.abs(node.loopStart-i*manifest.tracks.offline.music.duration)<1e-9);assert(Math.abs(node.loopEnd-node.loopStart-manifest.tracks.offline.music.duration)<1e-9);});
let voices=h.context.sources.filter(n=>!n.loop);assert.equal(voices.length,2);
assert(voices[1].startArgs[0]>voices[0].startArgs[0]+voices[0].startArgs[2]);
h.advance(2);await h.engine.toggle();const paused=h.engine.getState().elapsed;assert(!h.engine.getState().playing);assert.equal(h.context.state,'suspended');
await h.engine.toggle();assert(h.engine.getState().playing);assert.equal(h.engine.getState().elapsed,paused);
h.engine.setting('energy',2);assert.equal(h.engine.getState().energy,2);assert(h.context.nodes.some(n=>n.gain.events.some(([v,t])=>v===1&&t>2)),'energy lands at a future bar');
h.engine.setting('confidence',1);h.engine.setting('voice','robot');
h.advance(960/92+.06);voices=h.context.sources.filter(n=>!n.loop);assert.equal(voices.length,4);
const expected=manifest.tracks.offline.voice.clips[TRACKS[0].visionary[1][1]].M;
assert.equal(voices.at(-1).startArgs[1],expected.start,'confidence and robot selection change actual audio');
await h.engine.vocabulary('paradigm');assert.equal(h.engine.getState().queued,'paradigm');
h.advance(2*960/92+.06);assert.equal(h.engine.getState().queued,'');
assert(h.context.sources.filter(n=>!n.loop).at(-1).buffer.id.includes('vocabulary-voices'));
h.engine.circleBack();h.advance(3*960/92+.06);assert(h.engine.getState().elapsed<.01);assert.equal(h.engine.getState().queued,'');
await h.engine.toggle();h.engine.seek(30);assert.equal(h.engine.getState().elapsed,30);assert(!h.engine.getState().playing);
await h.engine.toggle();assert(h.engine.getState().playing);assert(h.engine.getState().elapsed>=29.9);
h.engine.volume(0);assert.equal(h.engine.getState().volume,0);
h.engine.reset();assert.equal(h.engine.getState().confidence,0);assert.equal(h.engine.getState().voice,'duet');
await h.engine.select(5);assert.equal(h.engine.getState().index,5);
const before=h.context.currentTime;h.advance(before+durationOf(TRACKS[5])+.2);await flush();assert.equal(h.engine.getState().index,0,'playlist wraps');
h.engine.dispose();assert.equal(h.context.state,'closed');

// Canceling a network load must not start it later. Switching while loading
// must only play the most recently chosen track, even if old replies finish last.
let release;const gate=new Promise(resolve=>{release=resolve;});
const slow=harness(async url=>{await gate;return{ok:true,arrayBuffer:async()=>new TextEncoder().encode(url).buffer};});
const pending=slow.engine.toggle();await slow.engine.toggle();release();await pending;
assert(!slow.engine.getState().playing);assert.equal(slow.context.sources.length,0);slow.engine.dispose();
const gates=[];const racing=harness(url=>new Promise(resolve=>gates.push({url,resolve})));
const old=racing.engine.select(0),latest=racing.engine.select(3);
for(const g of gates.filter(g=>g.url.includes('humbled')))g.resolve({ok:true,arrayBuffer:async()=>new TextEncoder().encode(g.url).buffer});
await latest;
for(const g of gates.filter(g=>g.url.includes('offline')))g.resolve({ok:true,arrayBuffer:async()=>new TextEncoder().encode(g.url).buffer});
await old;assert.equal(racing.engine.getState().index,3);assert(racing.context.sources.every(n=>n.buffer.id.includes('humbled')));racing.engine.dispose();
const failure=harness(async()=>({ok:false}));await failure.engine.toggle();assert(failure.engine.getState().error);assert(!failure.engine.getState().playing);failure.engine.dispose();
console.log('Studio 02 passed: all phrase pairs fit, four stems align, playback/seek/pause/queues work, controls alter audio, cancellation and selection races are safe, failed audio recovers, playlist advances.');
