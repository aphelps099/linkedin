import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TRACKS, LINES, makeCues, lyricAt, wordTimings, siteBase} from '../src/home/tracks.js';
import {claimAudio, onAudioFocus} from '../src/brand/audio-focus.js';
import {createRadio} from '../src/home/radio.js';

// Read the actual PCM voice bank, so cue spacing is tested against real clips.
function wav(bank){
  const data=fs.readFileSync(new URL(`../public/phrases/${String(bank+1).padStart(2,'0')}.wav`,import.meta.url));
  let rate,channels,bits,samples;
  for(let p=12;p+8<=data.length;){
    const size=data.readUInt32LE(p+4),id=data.toString('ascii',p,p+4);
    if(id==='fmt '){assert.equal(data.readUInt16LE(p+8),1);channels=data.readUInt16LE(p+10);rate=data.readUInt32LE(p+12);bits=data.readUInt16LE(p+22);}
    if(id==='data') samples=data.subarray(p+8,p+8+size);
    p+=8+size+(size%2);
  }
  assert.equal(bits,16);
  const floats=Float32Array.from({length:samples.length/2/channels},(_,i)=>samples.readInt16LE(i*2*channels)/32768);
  return {duration:floats.length/rate,sampleRate:rate,getChannelData:()=>floats};
}
const bank=new Map([...new Set(TRACKS.flatMap(t=>t.phrases))].map(i=>[i,wav(i)]));
for(const track of TRACKS.filter(track=>!track.src)){
  const cues=makeCues(track,bank);
  assert(cues.length>20);
  for(let i=0;i<cues.length;i++){
    const cue=cues[i];assert.equal(cue.text,LINES[cue.bank]);
    assert(cue.at+cue.duration<=track.seconds);
    assert(cue.words[0].start>=cue.at);
    assert(cue.words.at(-1).end<=cue.at+cue.duration+.00001);
    if(cues[i+1])assert(cue.at+cue.duration<cues[i+1].at,'phrases must not overlap');
    cue.words.forEach((word,ix)=>assert.equal(lyricAt(cues,(word.start+word.end)/2).word,ix));
    assert.equal(lyricAt(cues,cue.at+cue.duration+.01).word,-1);
  }
}
assert.equal(wordTimings('Humbled and honored',0,3).length,3);
assert.equal(siteBase('/'),'/');assert.equal(siteBase('/v2/'),'/');assert.equal(siteBase('/linkedin/v2/index.html'),'/linkedin/');assert.equal(siteBase('/linkedin/'),'/linkedin/');

let tick, last, engines=[];
function engineFactory(){
  const engine={clock:0,stopped:false,suspended:false,events:[],
    unlock(){this.suspended=false;},setVolume(v){this.volume=v;},now(){return this.clock;},
    decode:async()=>({duration:200}),suspend(){this.suspended=true;},dispose(){this.stopped=true;},
    trigger(...args){this.events.push(['drum',...args]);},playBuffer(...args){this.events.push(['voice',...args]);},
  };engines.push(engine);return engine;
}
const radio=createRadio({phraseBase:'/phrases/',onState:s=>last=s,engineFactory,fetchAudio:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}),
  loadClip:async(_audio,voice,_base,ix)=>{voice.bank.set(ix,bank.get(ix));return bank.get(ix);},
  interval:fn=>{tick=fn;return 1;},clear:()=>{tick=null;}});
await radio.play(0);assert(last.playing);assert.equal(last.index,0);assert(engines[0].events.some(e=>e[0]==='voice'));
engines[0].clock=12;tick();assert(Math.abs(last.elapsed-11.92)<.001);
radio.toggle();assert(!last.playing);assert(engines[0].suspended);assert.equal(tick,null);
radio.toggle();assert(last.playing);assert(!engines[0].suspended);
await radio.seek(45);assert(engines[0].stopped);assert.equal(last.elapsed,45);assert(last.playing);
radio.volume(.25);assert.equal(engines.at(-1).volume,.25);
await radio.next();assert.equal(last.index,1);assert.equal(last.elapsed,0);assert.equal(engines.at(-1).volume,.25);
radio.toggle();await radio.seek(70);assert(!last.playing);assert.equal(last.elapsed,70);
await radio.play();assert(last.playing);assert.equal(last.elapsed,70);
radio.shuffle();const before=last.index;await radio.next();assert.notEqual(last.index,before);
claimAudio('synth');assert(!last.playing);assert(engines.at(-1).suspended);assert.equal(tick,null);
let stoppedTool=0;const unsubscribe=onAudioFocus('synth',()=>stoppedTool++);
radio.toggle();assert(last.playing);assert.equal(stoppedTool,1);unsubscribe();
radio.dispose();assert(engines.at(-1).stopped);assert.equal(tick,null);

let complete;
const slow=createRadio({phraseBase:'/',onState:s=>last=s,engineFactory,interval:fn=>{tick=fn;return 1;},clear:()=>{tick=null;},
  loadClip:()=>new Promise(resolve=>{complete=resolve;})});
slow.play();assert(last.loading);claimAudio('studio');assert(!last.loading);assert(engines.at(-1).stopped);slow.dispose();
const failed=createRadio({phraseBase:'/',onState:s=>last=s,engineFactory,loadClip:async()=>null});
await failed.play();assert(last.error);assert(!last.playing);assert(!last.loading);failed.dispose();
console.log(`Homepage checks passed: ${TRACKS.length} arrangements, ${bank.size} real clips, word cues, pause/resume, seek, track selection, shuffle, volume, cancellation, audio focus and loading failures.`);

// Supplied recordings play their actual mix without generated drums or voice cues.
const recordingIndex=TRACKS.findIndex(t=>t.id==='untitled-alignment');
let requests=0;
const recorded=createRadio({initialIndex:recordingIndex,onState:s=>last=s,engineFactory:()=>{const e=engineFactory();e.decode=async()=>({duration:200});return e;},fetchAudio:async()=>{requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};},interval:fn=>(tick=fn,1),clear:()=>{tick=null;},loadClip:()=>{throw Error('Recordings must not load phrase clips');}});
assert.equal(recorded.getState().index,recordingIndex);
await recorded.play();assert(last.playing);assert.equal(last.text,'Untitled Alignment');assert.equal(last.word,-1);
assert.equal(engines.at(-1).events.length,1);assert.equal(engines.at(-1).events[0][2].bus,'samples');
await recorded.seek(4);assert.equal(last.elapsed,4);assert.equal(requests,1,'Seeking reuses the decoded recording');
recorded.toggle();assert(!last.playing);recorded.toggle();assert(last.playing);
await recorded.next();assert.equal(TRACKS[last.index].id,'circle-back');recorded.dispose();
let signal,resolveRecording;
const pending=createRadio({initialIndex:recordingIndex,onState:s=>last=s,engineFactory,fetchAudio:(_url,opts)=>{signal=opts.signal;return new Promise(resolve=>{resolveRecording=resolve;});}});
const waiting=pending.play();assert(last.loading);pending.toggle();assert(signal.aborted);pending.dispose();resolveRecording({ok:false});await waiting;assert(!last.playing);
console.log('Recording playback passed: featured default, original mix only, seek cache, pause/resume, playlist order and request cancellation.');
