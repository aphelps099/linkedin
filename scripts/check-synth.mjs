import assert from 'node:assert/strict';
import {initialProject,validateProject,stepTime,wavBytes,patternFor} from '../src/synth/model.js';
const p=initialProject();assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
for(const mutate of [p=>p.bpm=NaN,p=>p.slots[0].start=1,p=>p.pattern[0][0]='yes',p=>p.slots[0].data='https://untrusted.test/x.mp3',p=>p.slots[0].pitch=99,p=>p.slots[0].name='<'.repeat(61)]){const q=structuredClone(p);mutate(q);assert.throws(()=>validateProject(q));}
for(const bpm of [60,112,180])for(const swing of [0,.25,.45]){let last=-1;for(let i=0;i<64;i++){const t=stepTime(i,bpm,swing);assert(t>last);last=t;}assert.equal(stepTime(16,bpm,swing),240/bpm);assert(Math.abs((stepTime(1,bpm,swing)-stepTime(0,bpm,swing))+(stepTime(2,bpm,swing)-stepTime(1,bpm,swing))-30/bpm)<1e-10);}
assert.equal(new Set([0,1,2].map(i=>JSON.stringify(patternFor(i)))).size,3);const a=patternFor(0);a[0][0]=false;assert(patternFor(0)[0][0]);
const b=Buffer.from(wavBytes({length:3,numberOfChannels:2,sampleRate:44100,getChannelData:i=>i?new Float32Array([1,0,-1]):new Float32Array([-.5,.5,2])}));assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt32LE(4),b.length-8);assert.equal(b.readUInt16LE(22),2);assert.equal(b.readUInt32LE(24),44100);assert.equal(b.readUInt32LE(40),12);assert.equal(b.readInt16LE(44),-16384);assert.equal(b.readInt16LE(46),32767);assert.equal(b.readInt16LE(52),32767);
console.log('Sampler checks passed: project validation, independent presets, swung timing, stereo PCM WAV headers/interleaving/clipping.');
