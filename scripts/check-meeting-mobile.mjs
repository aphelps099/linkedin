import assert from 'node:assert/strict';
import {createMeetingEngine} from '../src/meeting-room/engine.js';
import {claimAudio} from '../src/brand/audio-focus.js';

const media=[],events=[];
globalThis.document={body:{appendChild(el){media.push(el);}},createElement(){return {
 paused:true,attrs:new Set(),setAttribute(k){this.attrs.add(k);},hasAttribute(k){return this.attrs.has(k);},
 play(){events.push('native play');this.paused=false;return Promise.resolve();},pause(){this.paused=true;},
 remove(){const i=media.indexOf(this);if(i>=0)media.splice(i,1);},
};},querySelectorAll(){return media;}};
class Param{constructor(){this.value=0;}setTargetAtTime(v){this.value=v;}cancelScheduledValues(){}}
class Node{constructor(){this.gain=new Param();this.connections=[];}connect(n){this.connections.push(n);}disconnect(){}}
class Context{
 constructor(){this.state='suspended';this.currentTime=0;this.destination=new Node();this.sources=[];}
 createGain(){return new Node();}
 createDynamicsCompressor(){const n=new Node();for(const k of ['threshold','knee','ratio','attack','release'])n[k]=new Param();return n;}
 createBuffer(){return {duration:1/22050};}
 createBufferSource(){const n=new Node();n.start=(...args)=>{n.started=args;events.push(n.buffer.duration>1?'meeting start':'prime');};n.stop=()=>{n.stopped=true;};this.sources.push(n);return n;}
 async resume(){events.push('resume');this.state='running';}async close(){this.state='closed';}
 async decodeAudioData(){return {duration:50};}
}
const meeting={id:'test',duration:40,voice:'voice.mp3',bed:'bed.mp3',loopDuration:8,cues:[{start:2,duration:3}]};
const response=()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const ctx=new Context();let requests=0;
const engine=createMeetingEngine({contextFactory:()=>ctx,fetcher:async()=>{events.push('fetch');requests++;return response();}});
engine.setMeeting(meeting);assert.equal(media.length,0,'No media or autoplay before a tap.');
const starting=engine.play();
assert.deepEqual(events,['resume','prime','native play'],'Both audio paths must start inside the tap, before downloading.');
await starting;assert(engine.snapshot().playing);assert.equal(requests,2);assert(!media[0].paused);
const sounds=()=>ctx.sources.filter(s=>s.buffer.duration>1);
assert.equal(sounds().length,2);assert.equal(sounds()[0].started[0],sounds()[1].started[0],'Voices and music stay synchronized.');
assert.notEqual(sounds()[0].connections[0],sounds()[1].connections[0],'Voice and music retain independent mix controls.');
ctx.currentTime=8.05;engine.pause();assert.equal(engine.elapsed(),8);assert(media[0].paused);
ctx.state='interrupted';await engine.play();assert(engine.snapshot().playing);assert(!media[0].paused);
assert.equal(sounds().at(-2).started[1],8);assert.equal(requests,2,'Resume reuses decoded files.');
ctx.state='interrupted';ctx.onstatechange();assert(!engine.snapshot().playing);assert.match(engine.snapshot().error,/interrupted/);
await engine.play();assert(engine.snapshot().playing);
claimAudio('synth');assert(!engine.snapshot().playing);assert(media[0].paused);
await engine.play();sounds().at(-2).onended();assert(!engine.snapshot().playing);assert(media[0].paused);
engine.dispose();assert.equal(media.length,0);assert.equal(ctx.state,'closed');

// Safari can suspend audio while recordings are downloading. Never show a
// moving timeline for a suspended context; the next tap uses the cached files.
const lateContext=new Context(),responses=[];let downloads=0;
const late=createMeetingEngine({contextFactory:()=>lateContext,fetcher:()=>{downloads++;return new Promise(r=>responses.push(r));}});
late.setMeeting(meeting);const pending=late.play();await flush();lateContext.state='suspended';responses.forEach(r=>r(response()));await pending;
assert(!late.snapshot().playing);assert(!late.snapshot().loading);assert.match(late.snapshot().error,/Retry audio/);assert(media[0].paused);
await late.play();assert(late.snapshot().playing);assert.equal(downloads,2);late.dispose();

const cancelledContext=new Context(),resolvers=[];let signal;
const cancelled=createMeetingEngine({contextFactory:()=>cancelledContext,fetcher:(_url,options)=>{signal=options.signal;return new Promise(r=>resolvers.push(r));}});
cancelled.setMeeting(meeting);const cancelledPlay=cancelled.play();await flush();cancelled.pause();assert(signal.aborted);resolvers.forEach(r=>r(response()));await cancelledPlay;
assert(!cancelled.snapshot().playing);assert(media[0].paused);cancelled.dispose();

const timeout=createMeetingEngine({contextFactory:()=>new Context(),loadTimeoutMs:5,fetcher:()=>new Promise(()=>{})});
timeout.setMeeting(meeting);await timeout.play();assert(!timeout.snapshot().loading);assert.match(timeout.snapshot().error,/too long/);assert(media[0].paused);timeout.dispose();
assert.equal(media.length,0);
console.log('Meeting mobile checks passed: tap-time unlock, synchronized voice/music, interrupted resume, cached retry, focus, cancellation, timeout and cleanup.');
