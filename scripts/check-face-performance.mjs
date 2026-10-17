import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {voiceEnvelope,levelAt} from '../src/studio-2/voice-envelope.js';
import {mouthPose,blinkAmount} from '../src/meeting-studio/portrait-renderer.js';
import {speakingParticipant} from '../src/meeting-studio/room.js';

const manifest=JSON.parse(await readFile('src/studio-2/audio-manifest.json','utf8'));
const pcm=execFileSync('ffmpeg',['-v','error','-i','public/studio-2/audio/offline-voices.mp3','-f','f32le','-ar','32000','-ac','1','-'],{maxBuffer:16*1024*1024});
const samples=new Float32Array(pcm.buffer.slice(pcm.byteOffset,pcm.byteOffset+pcm.byteLength));
const vocalBuffer={sampleRate:32000,getChannelData:()=>samples};
const first=manifest.tracks.offline.voice.clips["Let's take it offline."].M;
const envelope=voiceEnvelope(vocalBuffer,first);
assert(envelope.some(v=>v>.8));assert(envelope.some(v=>v<.09),'real silence closes the mouth');
assert.equal(levelAt(envelope,100),0);assert.equal(mouthPose(0),0);assert.equal(mouthPose(.15),1);assert.equal(mouthPose(.4),2);assert.equal(mouthPose(.9),3);
assert.equal(blinkAmount(0),0);assert.equal(blinkAmount(4.78),1);assert.equal(blinkAmount(5),0);

const bundle=await build({entryPoints:['src/studio-2/remix-engine.js'],bundle:true,format:'esm',platform:'node',write:false});
const {createRemixEngine,TRACKS,responseOffset}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
class Param{constructor(value=0){this.value=value;}cancelScheduledValues(){}setTargetAtTime(value){this.value=value;}}
class Node{constructor(){this.gain=new Param();this.connections=[];}connect(n){this.connections.push(n);}disconnect(){}}
class Context{
 constructor(){this.currentTime=0;this.state='suspended';this.destination=new Node();this.sources=[];}
 createGain(){return new Node();}
 createDynamicsCompressor(){const n=new Node();for(const k of ['threshold','knee','ratio','attack','release'])n[k]=new Param();return n;}
 createAnalyser(){const n=new Node();n.frequencyBinCount=64;n.getByteFrequencyData=a=>a.fill(0);return n;}
 createBufferSource(){const n=new Node();n.start=(...args)=>{n.args=args;};n.stop=()=>{};this.sources.push(n);return n;}
 async decodeAudioData(){return vocalBuffer;}async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}
}
const ctx=new Context();let tick;
const engine=createRemixEngine({meetingVoices:true,contextFactory:()=>ctx,fetchImpl:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}),setTimer:fn=>{tick=fn;return 1;},clearTimer:()=>{tick=null;}});
const advance=t=>{ctx.currentTime=t;tick?.();};
await engine.toggle();
const [male,female]=ctx.sources.filter(n=>!n.loop);
assert.notEqual(male.connections[0].connections[0],female.connections[0].connections[0],'each voice has its own mute bus');
advance(.4);assert.equal(engine.performanceFrame().speaker,'M');assert.equal(speakingParticipant(engine.getState()),'drums');
const measured=[];for(let t=.2;t<first.duration;t+=.02){advance(.16+t);measured.push(engine.performanceFrame().level);}
assert(measured.some(v=>v>.8));assert(measured.some(v=>v<.09));
const reply=.16+responseOffset(first.duration,TRACKS[0].bpm);
advance(reply+.25);assert.equal(engine.performanceFrame().speaker,'F');assert.equal(speakingParticipant(engine.getState()),'keys');
engine.participant('keys');assert.equal(female.connections[0].connections[0].gain.value,0);assert.equal(male.connections[0].connections[0].gain.value,1);assert.equal(engine.performanceFrame().speaker,null);
engine.participant('keys');assert.equal(engine.performanceFrame().speaker,'F');
engine.participant('vocals');assert.equal(engine.performanceFrame().speaker,'F','copier mute does not silence the people');
engine.volume(0);assert.equal(engine.performanceFrame().level,0);assert.equal(engine.performanceFrame().speaker,null);engine.volume(.8);
await engine.toggle();assert.equal(engine.performanceFrame().speaker,null);await engine.toggle();assert.equal(engine.performanceFrame().speaker,'F');
await engine.seek(reply-.06+.35);assert.equal(engine.performanceFrame().speaker,'F','seeking into a reply selects the female mouth immediately');
engine.setting('voice','instrumental');assert.equal(engine.performanceFrame().speaker,null);assert.equal(engine.getState().speaking,false);
engine.setting('voice','robot');await engine.select(0);advance(ctx.currentTime+reply+.25);assert.equal(engine.performanceFrame().speaker,'M','single voice delivery stays with the male portrait');
await engine.vocabulary('paradigm');advance(ctx.currentTime+960/92);assert.equal(engine.getState().queued,'');
engine.reset();await engine.select(3);assert.equal(engine.getState().index,3);assert.equal(engine.performanceFrame().speaker,null,'new song cannot retain an old speaking cue');
engine.dispose();
console.log('Face performance passed: real vocal envelopes, silence, speaker handoffs, independent mutes, pause/resume, seek, delivery changes, vocabulary queue and track changes.');
