export const ROOMS=[['desk','At your desk','Close, dry vocals.'],['call','Conference call','A softer, narrow-band mix.'],['boardroom','Conference room','A little space around the voices.']];
export const GROOVES=[['original','House beat'],['keys','Keyboard session'],['drums','Drum-pad meeting']];
export const SOUNDS=[['printer','Printer rhythm'],['typing','Keyboard clicks'],['notification','Notification chime']];
export const DEFAULT_MIX={room:'desk',groove:'original',sounds:[]};
export function normalizeMix(value){return {room:ROOMS.some(([id])=>id===value?.room)?value.room:'desk',groove:GROOVES.some(([id])=>id===value?.groove)?value.groove:'original',sounds:SOUNDS.map(([id])=>id).filter(id=>Array.isArray(value?.sounds)&&value.sounds.includes(id))};}
