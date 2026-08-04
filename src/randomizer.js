// The Reorg — pattern randomizer. Corporate restructuring for the sequencer:
// picks a meeting cadence (style), rebuilds the drum rows musically bar by bar,
// sprinkles the exhibits, and books phrases into the Vox row with breathing room.
// Length-aware: bar 0 sets the groove, later bars copy it with small mutations
// so a 32- or 48-step meeting stays coherent but never identical.
const rint = n => Math.floor(Math.random()*n);
const chance = p => Math.random() < p;
const shuffle = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=rint(i+1); [b[i],b[j]]=[b[j],b[i]]; } return b; };

export const STYLES = ['All-hands', 'Offsite', 'Sprint review', 'Town hall'];

// Long phrases need extra empty steps after them; pools are computed from the
// supplied phrase bank by spoken length so an extended bank just works.
const FALLBACK_LONG = [0, 1, 2, 3, 8];
const FALLBACK_SHORT = [4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];

// stepSec: seconds per 16th at the current tempo · stepsFor(i): seconds phrase i takes to say
// pool: restrict the vox to these phrase indices (a remix uses the jargon the author wrote)
// ordered: walk the pool in sequence instead of picking at random — a remix is
// a post, and a post has an order
export function randomPattern(nSamples, phrases, len = 16, stepSec = .14, stepsFor = null, pool = null, ordered = false){
  let LONG = FALLBACK_LONG, SHORT = FALLBACK_SHORT;
  if(phrases && phrases.length){
    LONG = []; SHORT = [];
    const allowed = pool && pool.length ? new Set(pool) : null;
    phrases.forEach((p,i)=>{
      if(allowed && !allowed.has(i)) return;
      ((p.say||'').length >= 30 ? LONG : SHORT).push(i);
    });
    if(!SHORT.length) SHORT = LONG.length ? LONG : [0];
    if(!LONG.length) LONG = [];
  }
  const bars = Math.max(1, Math.round(len/16));
  len = bars*16;
  const rows = 8 + nSamples + 1;
  const p = Array(rows).fill(0).map(()=> Array(len).fill(0));
  const style = rint(STYLES.length);
  const put = (r, s, acc) => { if(s>=0 && s<16) p[r][s] = acc ? 2 : 1; };
  const accent = () => chance(.3);

  // ---- bar 0: the groove ----
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
  for(let s=0;s<16;s+=hatStep) put(3,s, s%8===0 && chance(.6));
  if(hatStep===4 && chance(.6)) for(let s=2;s<16;s+=4) if(chance(.5)) put(3,s,false);
  // open hat (row 4)
  if(chance(.7)) [7,15].forEach(s=> chance(.75) && put(4,s,false));
  else if(chance(.5)) put(4, 2+rint(4)*4, false);
  // shaker (row 5)
  if(chance(.6)) [3,7,11,15].forEach(s=> put(5,s,accent()));
  else if(chance(.5)) for(let s=1;s<16;s+=2) if(chance(.4)) put(5,s,false);
  // cowbell, zap (rows 6, 7) — sparingly; this is a place of business
  if(chance(.35)) put(6, [2,6,10,14][rint(4)], chance(.2));
  if(chance(.3)) put(7, [3,7,11,15][rint(4)], false);
  if(chance(.12)) put(7, rint(16), false);
  // exhibits — sparse, admitted into the groove
  for(let i=0;i<nSamples;i++){
    for(let s=0;s<16;s++) if(chance(.12)) put(8+i, s, chance(.25));
    if(p[8+i].slice(0,16).every(v=>!v)) put(8+i, rint(16), false); // every exhibit deserves the floor once
  }

  // ---- later bars: copy the groove, mutate the details ----
  for(let b=1;b<bars;b++){
    const off = b*16;
    for(let r=0;r<8+nSamples;r++){
      for(let s=0;s<16;s++){
        let v = p[r][s];
        if(v && chance(.08)) v = 0;                      // drop a hit
        else if(!v && chance(.04)) v = 1;                // sneak one in
        else if(v===1 && chance(.08)) v = 2;             // promote to accent
        p[r][off+s] = v;
      }
    }
    // a small fill into the next bar — the meeting builds
    if(chance(.5)){ const r = chance(.6)?1:2; p[r][off-2] = Math.max(p[r][off-2],1); if(chance(.5)) p[r][off-1] = 2; }
  }

  // ---- vox: nobody talks over anybody ----
  // Each line is given as many steps as it actually takes to say (measured from
  // the recorded bank), plus a beat of silence, before the next one may start.
  const voxRow = 8 + nSamples;
  const placed = [];
  const roomFor = i => {
    const secs = stepsFor ? stepsFor(i) : 1.6;
    return Math.ceil(secs / Math.max(.05, stepSec)) + 2; // + a half-beat to breathe
  };
  let cursor = ordered ? 0 : rint(2) * 4;   // an ordered post opens on the one
  let guard = 0, seq = 0;
  while(cursor < len && guard++ < 32){
    let idx, need;
    if(ordered && pool && pool.length){
      idx = pool[seq % pool.length];
      need = roomFor(idx);
      if(cursor + need > len) break;        // the rest carries into the next loop
      seq++;
    } else {
      // a remix wants more of the author's lines to land, so it leans short
      const wantLong = LONG.length && chance(pool && pool.length ? .25 : .45);
      idx = (wantLong ? LONG : SHORT)[rint((wantLong ? LONG : SHORT).length)];
      need = roomFor(idx);
      // if the long line won't finish before the loop ends, take a short one instead
      if(cursor + need > len){
        idx = SHORT[rint(SHORT.length)];
        need = roomFor(idx);
        if(cursor + need > len) break;
      }
    }
    p[voxRow][cursor] = idx + 1;
    placed.push(idx);
    cursor += need + rint(3)*2;          // a little extra air, sometimes
    cursor = Math.ceil(cursor/2)*2;      // land on an even step
  }
  return { pattern: p, style: STYLES[style], placed };
}
