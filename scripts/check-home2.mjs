import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TRACKS,makeCues} from '../src/home/tracks.js';
import {vocalEnvelope,mouthAt,wordShapes,MOUTH_STATES,createPortraitRadio} from '../src/home-2/portraitRadio.js';

function wav(bank){
  const data=fs.readFileSync(new URL(`../public/phrases/${String(bank+1).padStart(2,'0')}.wav`,import.meta.url));
  let rate,channels,bits,samples;
  for(let p=12;p+8<=data.length;){
    const size=data.readUInt32LE(p+4),id=data.toString('ascii',p,p+4);
    if(id==='fmt '){assert.equal(data.readUInt16LE(p+8),1);channels=data.readUInt16LE(p+10);rate=data.readUInt32LE(p+12);bits=data.readUInt16LE(p+22);}
    if(id==='data')samples=data.subarray(p+8,p+8+size);
    p+=8+size+(size%2);
  }
  assert.equal(bits,16);
  const floats=Float32Array.from({length:samples.length/2/channels},(_,i)=>samples.readInt16LE(i*2*channels)/32768);
  return {duration:floats.length/rate,sampleRate:rate,getChannelData:()=>floats};
}
const buffers=new Map([...new Set(TRACKS.flatMap(t=>t.phrases))].map(i=>[i,wav(i)]));
const envelopes=new Map([...buffers].map(([i,b])=>[i,vocalEnvelope(b)]));
const seen=new Set();
for(const track of TRACKS){
  const cues=makeCues(track,buffers);
  for(let t=0;t<track.seconds;t+=.04){
    const mouth=mouthAt(cues,envelopes,t);
    assert(MOUTH_STATES.includes(mouth));seen.add(mouth);
    assert.equal(mouthAt(cues,envelopes,t,false),'rest','pause always closes the mouth');
    const active=cues.find(c=>t>=c.at&&t<c.at+c.duration);
    if(!active)assert.equal(mouth,'rest','instrumental gaps must not move lips');
    if(active){const env=envelopes.get(active.bank),frame=Math.floor((t-active.at)/env.hopSeconds);if((env.levels[frame]||0)<env.peak*.07)assert.equal(mouth,'rest','silence inside a phrase must close lips');}
  }
}
assert.deepEqual([...seen].sort(),[...MOUTH_STATES].sort(),'real clips exercise all six mouth states');
assert(wordShapes('boom').includes('closed'));assert(wordShapes('you').includes('oo'));
assert.equal(mouthAt([],envelopes,0),'rest');
let tick,last,engines=[];
const engineFactory=()=>{const e={clock:0,stopped:false,unlock(){},setVolume(){},now(){return this.clock;},suspend(){},dispose(){this.stopped=true;},trigger(){},playBuffer(){},spectrum(){return new Uint8Array(128).fill(120);}};engines.push(e);return e;};
const radio=createPortraitRadio({phraseBase:'/phrases/',engineFactory,onState:s=>last=s,
  loadClip:async(_audio,voice,_base,i)=>{voice.bank.set(i,buffers.get(i));return buffers.get(i);},interval:fn=>(tick=fn,1),clear:()=>{tick=null;}});
await radio.play(0);assert(last.playing);assert.equal(last.levels.length,48);
engines.at(-1).clock=.5;tick();assert(MOUTH_STATES.includes(last.mouth));
radio.toggle();assert.equal(last.mouth,'rest');assert.equal(last.levels,null);
await radio.seek(23);assert.equal(last.elapsed,23);assert.equal(last.mouth,'rest');
await radio.play(4);assert.equal(last.index,4);assert.equal(last.elapsed,0);
radio.dispose();assert(engines.at(-1).stopped);assert.equal(tick,null);
let resolve;
const loading=createPortraitRadio({phraseBase:'/',engineFactory,onState:s=>last=s,loadClip:()=>new Promise(r=>resolve=r)});
loading.play();assert(last.loading);assert.equal(last.mouth,'rest');loading.toggle();assert(!last.loading);loading.dispose();
const failed=createPortraitRadio({phraseBase:'/',engineFactory,onState:s=>last=s,loadClip:async()=>null});
await failed.play();assert(last.error);assert.equal(last.mouth,'rest');assert(!last.playing);failed.dispose();
console.log(`Home-2 checks passed: all 5 real arrangements, ${buffers.size} voice clips, 6 mouth states, vocal silence gating, pause/seek, track selection, spectrum, disposal, loading cancellation and failure.`);
