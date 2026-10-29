// Locked character geometry: eyes 2×2, mouth 1×10 using the same pixel unit.
// Speech fills left to right from a fixed left edge. Never animate its height.
export const SYNERGY_DISPLAY = Object.freeze({eyeRows:2,eyeColumns:2,mouthRows:1,mouthColumns:10,pixelSize:6});
export function synergyMouthCells(level){
  const energy=Number.isFinite(level)?Math.max(0,Math.min(1,level)):0;
  return energy<=.08?2:Math.max(2,Math.min(10,Math.ceil(energy*10)));
}
export function drawSynergyEQ(ctx,level,centerX=0,centerY=0){
  const unit=SYNERGY_DISPLAY.pixelSize,count=synergyMouthCells(level);
  ctx.save();ctx.shadowBlur=0;ctx.globalAlpha=level>.08?1:.4;
  ctx.fillStyle='#60ff9b';
  // centerX locates the full ten-cell display, not the illuminated portion.
  // The left edge stays fixed; only the right edge responds to speech.
  ctx.fillRect(centerX-SYNERGY_DISPLAY.mouthColumns*unit/2,centerY-unit/2,count*unit,unit);
  ctx.restore();
}
