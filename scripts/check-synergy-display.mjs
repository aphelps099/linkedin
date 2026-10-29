import assert from 'node:assert/strict';
import {drawSynergyEQ,SYNERGY_DISPLAY,synergyMouthCells} from '../src/meeting-room/synergy-display.js';
// Exercise the public painter across silence, ramps, emphatic peaks and invalid
// input. Check actual painted bounds, not a duplicated animation formula.
let previousWidth=0,draws=0;
for(let i=0;i<=1000;i++){
 const level=i/1000,rects=[],ctx={save(){},restore(){},fillRect(...r){rects.push(r)}};
 drawSynergyEQ(ctx,level,90,88);assert.equal(rects.length,1,'Mouth must remain one contiguous bar');
 const [x,y,w,h]=rects[0];assert.equal(h,6);assert.equal(y,85);assert.equal(x,60,'Left edge must stay fixed at every speech level');assert.ok(x+w<=120);
 assert.equal(h/(SYNERGY_DISPLAY.eyeRows*SYNERGY_DISPLAY.pixelSize),.5);
 assert.ok(w>=12&&w<=60&&w%6===0);assert.ok(w>=previousWidth);assert.equal(ctx.shadowBlur,0,'No expanding vertical glow');previousWidth=w;draws++;
}
assert.equal(synergyMouthCells(1),10);assert.equal(synergyMouthCells(0),2);
for(const value of [NaN,Infinity,-Infinity,-1])assert.equal(synergyMouthCells(value),2);
console.log(`Synergy display: ${draws} levels checked. Left-to-right fill from a fixed left edge; one fixed-height row; 2×2 eyes / 1×10 mouth; full ten-cell peak.`);
