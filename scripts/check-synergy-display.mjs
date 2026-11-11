import assert from 'node:assert/strict';
import {drawSynergyEQ,SYNERGY_DISPLAY,synergyMouthCells} from '../src/meeting-room/synergy-display.js';
// Inspect actual paint calls: the permanent dim track and speech overlay must
// occupy exactly the same row. Silence must not retain a bright short dash.
let previousWidth=0,draws=0;
for(let i=0;i<=1000;i++){
 const level=i/1000,rects=[],ctx={save(){},restore(){},fillRect(...r){rects.push({r,alpha:this.globalAlpha})}};
 drawSynergyEQ(ctx,level,90,88);
 assert.deepEqual(rects[0],{r:[60,85,60,6],alpha:.1},'Full ten-cell track must always remain at 10% opacity');
 assert.equal(rects.length,level<=.08?1:2,'Silence has only the dim track');
 const bright=rects[1],width=bright?.r[2]||0;
 if(bright){const [x,y,w,h]=bright.r;assert.equal(x,60);assert.equal(y,85);assert.equal(h,6);assert.equal(bright.alpha,1);assert.ok(w>=12&&w<=60&&w%6===0);}
 assert.ok(width>=previousWidth);assert.equal(ctx.shadowBlur,0);assert.equal(6/(SYNERGY_DISPLAY.eyeRows*SYNERGY_DISPLAY.pixelSize),.5);previousWidth=width;draws++;
}
assert.equal(synergyMouthCells(1),10);assert.equal(synergyMouthCells(0),0);
for(const value of [NaN,Infinity,-Infinity,-1])assert.equal(synergyMouthCells(value),0);
console.log(`Synergy display: ${draws} levels checked. Permanent 10% full-width track; no bright bar at rest; fixed-height left-to-right speech overlay.`);
