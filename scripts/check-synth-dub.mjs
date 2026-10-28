import assert from 'node:assert/strict';
import {SOUNDS,initialProject,restoreProject,validateProject} from '../src/synth/model.js';
import {randomizeProject} from '../src/synth/randomize.js';
import {vocalEchoes,playedDuration} from '../src/synth/dub.js';
import {Sampler,graph} from '../src/synth/engine.js';

const original=initialProject(),snapshot=structuredClone(original),signatures=new Set();
for(let seed=0;seed<100;seed++){
 const p=randomizeProject(original,seed);
 assert.deepEqual(validateProject(p),p);
 assert.deepEqual(p,randomizeProject(original,seed),'A saved seed should reproduce the same beat.');
 assert.equal(p.pattern[0].length,64);
 assert(p.pattern[0].filter(Boolean).length>=12);
 assert(p.pattern[6].filter(Boolean).length===1&&p.pattern[7].filter(Boolean).length===1,'Leave room for each vocal and its echoes.');
 for(const slot of p.slots){assert.equal(slot.data,null);assert(SOUNDS.some(sound=>sound.id===slot.sound));}
 assert.notEqual(p.slots[6].sound,p.slots[7].sound);
 signatures.add(JSON.stringify([p.pattern,p.slots,p.bpm]));
}
assert(signatures.size>90);assert.deepEqual(original,snapshot,'Randomize must leave the Undo project untouched.');
const legacy=structuredClone(original);delete legacy.vocalDub;delete legacy.dubAmount;delete legacy.dubSeed;
assert.deepEqual(restoreProject(legacy),original);
const uploaded=structuredClone(legacy);uploaded.slots[0]={...uploaded.slots[0],data:'data:audio/wav;base64,AAAA',name:'Personal recording',pitch:12,start:.2};
assert.throws(()=>validateProject(uploaded));
const restored=restoreProject(uploaded);assert.deepEqual(restored.pattern,original.pattern);assert.equal(restored.slots[0].sound,'kick');assert.equal(restored.slots[0].data,null);assert.equal(restored.slots[0].name,'Kick');assert.equal(restored.slots[0].start,0);
const loader=new Sampler();loader.buffers.set('kick',{});
await assert.rejects(()=>loader.load(uploaded.slots[0]),/library/);
await assert.rejects(()=>loader.load({...original.slots[0],sound:'https://untrusted.test/sound.wav'}),/library/);
for(const bad of [{dubAmount:1},{dubAmount:NaN},{dubSeed:-1},{vocalDub:'yes'}])assert.throws(()=>validateProject({...original,...bad}));

const vocal=original.slots[6],drops=new Set();
for(let event=0;event<64;event++){
 const echoes=vocalEchoes(1.4,vocal,original,event);
 assert.equal(echoes.length,2);assert.deepEqual(echoes,vocalEchoes(1.4,vocal,original,event));
 for(const echo of echoes){assert(echo.slot.pitch<vocal.pitch);assert(echo.after>playedDuration(1.4,vocal));assert(echo.slot.gain<vocal.gain);assert(echo.slot.start>=vocal.start&&echo.slot.end===vocal.end);assert(Number.isFinite(playedDuration(1.4,echo.slot)));}
 assert(echoes[1].slot.pitch<=echoes[0].slot.pitch);assert(echoes[1].slot.gain<echoes[0].slot.gain);
 drops.add(echoes[0].slot.pitch);
}
assert.equal(drops.size,3);assert.equal(vocal.pitch,0);
assert.deepEqual(vocalEchoes(1.4,vocal,{...original,vocalDub:false}),[]);
assert.deepEqual(vocalEchoes(1.4,vocal,{...original,dubAmount:0}),[]);
assert.deepEqual(vocalEchoes(.6,original.slots[0],original),[]);

// Exercise the actual playback/export schedulers with a recording AudioContext.
const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}});
const node=()=>({gain:param(),frequency:param(),delayTime:param(),threshold:param(),ratio:param(),connect(){},disconnect(){}});
class RecordingContext{
 constructor(channels=2,length=1,rate=44100){this.numberOfChannels=channels;this.length=length;this.sampleRate=rate;this.currentTime=0;this.destination={};this.scheduled=[];}
 createGain(){return node();}createBiquadFilter(){return node();}createDynamicsCompressor(){return node();}createDelay(){return node();}
 createBufferSource(){const source={...node(),playbackRate:param(),addEventListener(){},start:(...args)=>{source.startArgs=args;this.scheduled.push(source);},stop(){this.stopped=true;}};return source;}
 async startRendering(){return {length:this.length,numberOfChannels:2,sampleRate:this.sampleRate,getChannelData:()=>new Float32Array(this.length)};}
}
const engine=new Sampler();engine.ctx=new RecordingContext();engine.bus=graph(engine.ctx,original);engine.project=original;engine.buffers.set(vocal.sound,{duration:1.4});
engine.hit(vocal,2,original,6);
assert.equal(engine.ctx.scheduled.length,3,'One dry vocal plus two tracked echoes.');
const rates=engine.ctx.scheduled.map(source=>source.playbackRate.value);assert.equal(rates[0],1);assert(rates[1]<1&&rates[2]<rates[1]);
assert(engine.ctx.scheduled[1].startArgs[0]>3.4);
engine.stopDub();assert(!engine.ctx.scheduled[0].stopped,'Turning dub off leaves the original vocal playing.');assert(engine.ctx.scheduled.slice(1).every(source=>source.stopped),'Turning dub off cancels its repeats immediately.');
engine.stop();assert(engine.ctx.scheduled.every(source=>source.stopped),'Stop must cancel the future echoes too.');assert.equal(engine.sources.size,0);
let rendered;
globalThis.OfflineAudioContext=class extends RecordingContext{constructor(...args){super(...args);rendered=this;}};
const exportProject={...original,pattern:Array.from({length:8},()=>Array(64).fill(false))};exportProject.pattern[6][0]=true;
engine.prepare=async()=>{};
const wav=await engine.export(exportProject);
assert.deepEqual(rendered.scheduled.map(source=>source.playbackRate.value),rates,'WAV export uses the same seeded pitch drops as playback.');
assert.equal(wav.type,'audio/wav');assert(wav.size>44);
for(const source of rendered.scheduled){const [when,,length]=source.startArgs;assert(when+length/source.playbackRate.value<rendered.length/rendered.sampleRate,'The WAV includes the complete pitched tail.');}
console.log('Synth dub checks passed: 100 usable seeded beats, library-only sources and legacy migration, lower vocal echoes, dry pitch, toggle/mix, Stop cancellation and matching WAV scheduling.');
