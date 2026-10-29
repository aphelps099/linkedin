// Locked character geometry: eyes 2×2, mouth 1×10 using the same pixel unit.
// Speech fills left to right from a fixed left edge. Never animate its height.
export const SYNERGY_DISPLAY = Object.freeze({eyeRows:2,eyeColumns:2,mouthRows:1,mouthColumns:10,pixelSize:6,idleOpacity:.1});
export function synergyMouthCells(level){
  const energy=Number.isFinite(level)?Math.max(0,Math.min(1,level)):0;
  return energy<=.08?0:Math.max(2,Math.min(10,Math.ceil(energy*10)));
}
export function drawSynergyEQ(ctx,level,centerX=0,centerY=0){
  const unit=SYNERGY_DISPLAY.pixelSize,count=synergyMouthCells(level);
  const left=centerX-SYNERGY_DISPLAY.mouthColumns*unit/2,top=centerY-unit/2;
  ctx.save();ctx.shadowBlur=0;ctx.fillStyle='#60ff9b';
  // The full row remains faintly visible even during silence. The bright
  // speech layer shares this exact baseline and fills only toward the right.
  ctx.globalAlpha=SYNERGY_DISPLAY.idleOpacity;
  ctx.fillRect(left,top,SYNERGY_DISPLAY.mouthColumns*unit,unit);
  if(count>0){ctx.globalAlpha=1;ctx.fillRect(left,top,count*unit,unit);}
  ctx.restore();
}
