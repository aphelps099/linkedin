import {SOUNDS} from './model.js';
import {seededRandom} from './randomize.js';

export const playedDuration=(duration,slot)=>(slot.end-slot.start)*duration/2**(slot.pitch/12);

// Only the phrase ending repeats. The dry vocal stays at its chosen pitch.
// A saved seed + event index makes playback and WAV export use the same drops.
export function vocalEchoes(duration,slot,project,event=0){
 if(!project.vocalDub||!project.dubAmount||SOUNDS.find(sound=>sound.id===slot.sound)?.kind!=='VOICE')return [];
 const random=seededRandom((project.dubSeed^Math.imul(event+1,2654435761))>>>0);
 const drop=[5,7,12][Math.floor(random()*3)],beat=60/project.bpm;
 const start=Math.max(slot.start,slot.end-Math.min(.55,(slot.end-slot.start)*duration)/duration);
 return [0,1].map(index=>({after:playedDuration(duration,slot)+beat*(.25+index*.75),slot:{...slot,start,
  pitch:Math.max(-36,slot.pitch-drop-index*5),gain:slot.gain*project.dubAmount*(index===0?1:.5)}}));
}
