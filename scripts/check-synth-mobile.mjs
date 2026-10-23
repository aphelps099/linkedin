import assert from 'node:assert/strict';
import {createMobileAudio} from '../src/synth/mobile-audio.js';
import {claimAudio} from '../src/brand/audio-focus.js';

const events=[],elements=[];
let deny=false,resolveContext;
globalThis.document={body:{appendChild(el){elements.push(el);}},createElement(){return {
 paused:true,attrs:new Set(),setAttribute(k){this.attrs.add(k);},hasAttribute(k){return this.attrs.has(k);},
 play(){events.push('media play');this.paused=false;return deny?Promise.reject(Error('Gesture required')):Promise.resolve();},
 pause(){this.paused=true;},remove(){elements.splice(elements.indexOf(this),1);},
};},querySelectorAll(){return elements;}};
const ctx={state:'suspended',destination:{},resume(){events.push('context resume');return new Promise(resolve=>{resolveContext=()=>{this.state='running';resolve();};});},
 createBuffer(){return {};},createBufferSource(){return {connect(){},disconnect(){},start(){events.push('prime buffer');}};}};
const audio=createMobileAudio(ctx);
const first=audio.resume();
assert.deepEqual(events,['context resume','prime buffer','media play'],'Both playback paths must begin synchronously, before loading samples.');
assert(elements[0].hasAttribute('playsinline'));assert(elements[0].hasAttribute('data-cb-unlock'));
assert(elements[0].loop);assert(elements[0].hidden);
resolveContext();await first;
audio.pause();assert(elements[0].paused);
ctx.state='interrupted';const resumed=audio.resume();resolveContext();await resumed;
assert(!elements[0].paused);assert.equal(elements.length,1,'Resume reuses its silent media element.');
const recording={paused:false,muted:false,hasAttribute(){return false;},pause(){this.paused=true;}};
const other={...recording};elements.push(recording,other);
claimAudio('mobile-check',{media:recording});
assert(!recording.paused,'The selected recording keeps playing.');assert(other.paused,'Other media relinquishes focus.');
assert(!elements[0].paused,'Audio focus must not stop the mobile unlock element.');
elements.splice(1);audio.dispose();assert.equal(elements.length,0);
await assert.rejects(()=>audio.resume(),/closed/);
deny=true;const retry=createMobileAudio(ctx),rejected=retry.resume();resolveContext();await rejected;
assert.equal(elements.length,0,'A rejected media unlock is cleaned up and can be retried.');
deny=false;const successful=retry.resume();resolveContext();await successful;assert.equal(elements.length,1);retry.dispose();
console.log('Synth mobile checks passed: synchronous gesture unlock, interrupted resume, denied-play retry, media focus and cleanup.');
