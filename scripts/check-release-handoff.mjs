import assert from 'node:assert/strict';
import {beginClipHandoff,canShareClip} from '../src/post-beat/handoff.js';
const file={name:'single.mp4',type:'video/mp4'};
// A slow clipboard operation must never delay the activation-sensitive share.
{
 let resolveCopy;const order=[],updates=[];
 const nav={canShare:({files})=>files[0]===file,clipboard:{writeText:()=>{order.push('copy');return new Promise(r=>resolveCopy=r);}},share:data=>{order.push('share');assert.deepEqual(Object.keys(data),['files']);assert.equal(data.files[0],file);return Promise.resolve();}};
 const done=beginClipHandoff({file,caption:'My single',nav,onUpdate:s=>updates.push(s),download:()=>assert.fail('native must not download'),open:()=>assert.fail('native must not open a tab')});
 assert.deepEqual(order,['copy','share']);assert(!updates.some(s=>s.caption==='copied'));resolveCopy();await done;assert.equal(updates.at(-1).caption,'copied');
}
// Desktop opens/downloads in the click, before clipboard permission resolves.
{
 let rejectCopy;const order=[],updates=[];
 const nav={canShare:()=>false,clipboard:{writeText:()=>new Promise((_,r)=>rejectCopy=r)}};
 const done=beginClipHandoff({file,caption:'Caption',nav,onUpdate:s=>updates.push(s),open:()=>{order.push('open');return false;},download:f=>{assert.equal(f,file);order.push('download');}});
 assert.deepEqual(order,['open','download']);assert.equal(updates.at(-1).opened,false);assert.equal(updates.at(-1).download,true);assert.equal(updates.at(-1).caption,'pending');rejectCopy(new Error('denied'));await done;assert.equal(updates.at(-1).caption,'failed');
}
// Cancelling the native sheet does not trigger a download or claim a post.
{
 const updates=[];const nav={canShare:()=>true,clipboard:{writeText:()=>Promise.resolve()},share:()=>Promise.reject(Object.assign(new Error('cancel'),{name:'AbortError'}))};
 await beginClipHandoff({file,caption:'Caption',nav,onUpdate:s=>updates.push(s),open:()=>assert.fail(),download:()=>assert.fail()});assert.equal(updates.at(-1).cancelled,true);assert.equal(updates.at(-1).error,'');
}
// No clipboard and a failed download remain actionable, not false checkmarks.
{
 const updates=[];await beginClipHandoff({file,caption:'Caption',nav:{},onUpdate:s=>updates.push(s),open:()=>true,download:()=>{throw Error('download blocked');}});assert.equal(updates.at(-1).caption,'failed');assert.equal(updates.at(-1).download,false);assert.match(updates.at(-1).error,/did not start/);
}
assert.equal(canShareClip(file,{share(){},canShare(){throw Error('policy');}}),false);
console.log('Release handoff passed: activation ordering, file-only sharing, desktop fallback, clipboard denial, cancellation and download failure.');
