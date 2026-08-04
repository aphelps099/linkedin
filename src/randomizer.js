// The Reorg — pattern randomizer. Corporate restructuring for the sequencer:
// picks a meeting cadence (style), rebuilds the drum rows musically, sprinkles
// the exhibits, and books a few phrases into the Vox row with breathing room.
const STEPS = 16;
const rint = n => Math.floor(Math.random()*n);
const chance = p => Math.random() < p;
const shuffle = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=rint(i+1); [b[i],b[j]]=[b[j],b[i]]; } return b; };

export const STYLES = ['All-hands', 'Offsite', 'Sprint review', 'Town hall'];

// Long phrases need ≥6 empty steps after them; pools are computed from the
// supplied phrase bank by spoken length so an extended bank just works.
const FALLBACK_LONG = [0, 1, 2, 3, 8];
const FALLBACK_SHORT = [4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];

export function randomPattern(nSamples, phrases){
  let LONG = FALLBACK_LONG, SHORT = FALLBACK_SHORT;
  if(phrases && phrases.length){
    LONG = []; SHORT = [];
    phrases.forEach((p,i)=> ((p.say||'').length >= 30 ? LONG : SHORT).push(i));
    if(!SHORT.length) SHORT = LONG;
  }
  const rows = 8 + nSamples + 1;
  const p = Array(rows).fill(0).map(()=> Array(STEPS).fill(0));
  const style = rint(STYLES.length);
  const put = (r, s, acc) => { if(s>=0 && s<STEPS) p[r][s] = acc ? 2 : 1; };
  const accent = () => chance(.3);

  // kick (row 0)
  if(style===0){ [0,4,8,12].forEach(s=> put(0,s,s%8===0)); if(chance(.35)) put(0,14,false); }
  else if(style===1){ [0,3,8,10].forEach(s=> put(0,s,s===0||s===8)); if(chance(.4)) put(0,6,false); }
  else if(style===2){ [0,6,10].forEach(s=> put(0,s,s===0)); if(chance(.5)) put(0,13,false); }
  else { [0,5,8,11].forEach(s=> put(0,s,s===0||s===8)); }
  // snare / clap (rows 1, 2)
  if(chance(.75)){ [4,12].forEach(s=> put(1,s,true)); if(chance(.3)) put(1,15,false); }
  else { [4,12].forEach(s=> put(2,s,true)); }
  if(chance(.35)) put(2, chance(.5)?12:14, false);
  // closed hat (row 3)
  const hatStep = chance(.5) ? 2 : 4;
  for(let s=0;s<STEPS;s+=hatStep) put(3,s, s%8===0 && chance(.6));
  if(hatStep===4 && chance(.6)) for(let s=2;s<STEPS;s+=4) if(chance(.5)) put(3,s,false);
  // open hat (row 4)
  if(chance(.7)) [7,15].forEach(s=> chance(.75) && put(4,s,false));
  else if(chance(.5)) put(4, 2+rint(4)*4, false);
  // shaker (row 5)
  if(chance(.6)) [3,7,11,15].forEach(s=> put(5,s,accent()));
  else if(chance(.5)) for(let s=1;s<STEPS;s+=2) if(chance(.4)) put(5,s,false);
  // cowbell, zap (rows 6, 7) — sparingly; this is a place of business
  if(chance(.35)) put(6, [2,6,10,14][rint(4)], chance(.2));
  if(chance(.3)) put(7, [3,7,11,15][rint(4)], false);
  if(chance(.12)) put(7, rint(STEPS), false);
  // exhibits — sparse, admitted into the groove
  for(let i=0;i<nSamples;i++){
    for(let s=0;s<STEPS;s++) if(chance(.12)) put(8+i, s, chance(.25));
    if(p[8+i].every(v=>!v)) put(8+i, rint(STEPS), false); // every exhibit deserves the floor once
  }
  // vox — 3 to 5 phrases with breathing room
  const voxRow = 8 + nSamples;
  const want = 3 + rint(3);
  const slots = [];
  for(const s of shuffle([0,2,4,6,8,10,12,14])){
    if(slots.length >= want) break;
    if(slots.every(x => Math.abs(x-s) >= 3 && Math.abs(x-s) <= 13)) slots.push(s);
  }
  slots.sort((a,b)=>a-b);
  const placed = [];
  slots.forEach((s, ix) => {
    const next = ix+1 < slots.length ? slots[ix+1] : slots[0] + STEPS;
    const room = next - s;
    const pool = room >= 6 && LONG.length && chance(.45) ? LONG : SHORT;
    const phrase = pool[rint(pool.length)];
    p[voxRow][s] = phrase + 1;
    placed.push(phrase);
  });
  return { pattern: p, style: STYLES[style], placed };
}
