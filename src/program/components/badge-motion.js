export const BADGE_CYCLE_MS=4800;
export const BADGE_FRAME_MS=120;
export const badgeLetterDelay=(letter,line)=>letter*120+line*240;
export function badgeLetterIsLit(timeMs,letter,line){
 const phase=((timeMs-badgeLetterDelay(letter,line))%BADGE_CYCLE_MS+BADGE_CYCLE_MS)%BADGE_CYCLE_MS;
 return phase>=480&&phase<1080;
}
