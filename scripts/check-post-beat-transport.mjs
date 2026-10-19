import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPostBeat,makeTimedCues} from '../src/post-beat/audio.js';
import {makeRecipe,voiceLines,DURATION} from '../src/post-beat/composition.js';
function wav(path){
 const data=fs.readFileSync(path);let rate,channels,bits,samples,format;
 for(let p=12;p+8<=data.length;){const size=data.readUInt32LE(p+4),id=data.toString('ascii',p,p+4);if(id==='fmt '){format=data.readUInt16LE(p+8);channels=data.readUInt16LE(p+10);rate=data.readUInt32LE(p+12);bits=data.readUInt16LE(p+22);}if(id==='data')samples=data.subarray(p+8,p+8+size);p+=8+size+(size%2);}
 const floats=Float32Array.from({length:samples.length/(bits/8)/channels},(_,i)=>format===3?samples.readFloatLE(i*4*channels):samples.readInt16LE(i*2*channels)/32768);
 return {duration:floats.length/rate,sampleRate:rate,getChannelData:()=>floats};
}
const recipe=makeRecipe("I'm thrilled to announce that Sarah joined the team. The next chapter starts now. Let that sink in.");
const fixture=wav(new URL('../public/phrases/02.wav',import.meta.url));
const buffers=voiceLines(recipe).map(line=>line.bank===undefined?fixture:wav(new URL(`../public/phrases/${String(line.bank+1).padStart(2,'0')}.wav`,import.meta.url)));
const cues=makeTimedCues(recipe,buffers);
assert.equal(cues[0].bank,0,'reuse the actual female opener recording');
for(let i=0;i<cues.length;i++){
 const c=cues[i];assert(c.end<=DURATION);if(i)assert(c.start>cues[i-1].end,'voice cues must not overlap');
 assert.equal(c.words.map(w=>w.word).join(' '),c.text);
 assert(c.words[0].start>=c.start);assert(c.words.at(-1).end<=c.end+.001);
 for(let j=1;j<c.words.length;j++)assert(c.words[j].start>=c.words[j-1].end);
}
let tick=null;const engines=[];
const player=createPostBeat({engineFactory:()=>{const e={clock:0,events:[],unlock(){this.suspended=false;},setVolume(){},setVoxDelay(){},setVoxVerb(){},now(){return this.clock;},trigger(...args){this.events.push(['band',...args]);},playBuffer(...args){this.events.push(['voice',...args]);},dispose(){this.disposed=true;},suspend(){this.suspended=true;}};engines.push(e);return e;},interval:fn=>{tick=fn;return 1;},clear:()=>{tick=null;}});
player.unlock();player.play(recipe,buffers);const engine=engines.at(-1);
assert(engine.events.some(e=>e[0]==='band'));assert(engine.events.some(e=>e[0]==='voice'));
engine.clock=6;tick();const pausedAt=player.elapsed();player.pause();assert.equal(tick,null);assert(engine.suspended);assert.equal(player.elapsed(),pausedAt);
player.resume();assert(tick);assert(!engine.suspended);assert.equal(player.elapsed(),pausedAt);
player.play(recipe,buffers);assert(engine.disposed);assert.equal(player.elapsed(),0);
engines.at(-1).clock=31;tick();assert.equal(tick,null);player.dispose();assert(engines.at(-1).disposed);
console.log('Post-beat transport passed: original recorded female vocals, homepage band, bounded word cues, no overlap, pause/resume, clean restart and cleanup.');
