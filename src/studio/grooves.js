// Original four-bar corporate grooves. Each owns its drums, harmony, bass and keys.
const rhythm=s=>s.split('').map(Number);
export const GROOVES=[
  {id:'reply-all',name:'Reply-All Disco',genre:'AFTER-HOURS DISCO',bpm:118,swing:0,root:33,major:false,
    progression:[0,8,3,10],types:['min','maj','maj','maj'],bass:'1001001020010300',arp:'1010101010101011',stab:'0020002000200020',arpDir:'up',
    drums:[[0,4,8,12],[4,12],[12],[0,2,4,6,8,10,12,14],[2,6,10,14],[3,7,11,15],[6,14],[]],phrases:[1,5,4,6,14,15]},
  {id:'quarterly-funk',name:'Quarterly Funk',genre:'EXPENSE-ACCOUNT FUNK',bpm:104,swing:.12,root:36,
    progression:[0,5,8,7],types:['min','min','maj','maj'],bass:'1001010020100301',arp:'1001001010010010',stab:'0002002000020020',arpDir:'down',
    drums:[[0,3,8,10],[4,12],[14],[0,2,4,6,8,10,12,14],[7,15],[1,5,9,13],[3,10],[]],phrases:[0,7,5,10,13,15]},
  {id:'mandatory-rave',name:'Mandatory Rave',genre:'TEAM-BUILDING TECHNO',bpm:132,swing:0,root:38,
    progression:[0,0,8,10],types:['min','min','maj','maj'],bass:'1010101020101030',arp:'1111111111111111',stab:'2000002000200000',arpDir:'octaves',
    drums:[[0,4,8,12],[],[4,12],[0,2,4,6,8,10,12,14],[2,6,10,14],[3,7,11,15],[],[15]],phrases:[4,6,7,11,14,15]},
  {id:'inbox-zero',name:'Inbox Zero',genre:'LO-FI ADMIN',bpm:88,swing:.2,root:35,
    progression:[0,5,3,7],types:['min','min','maj','min'],bass:'1000000010030000',arp:'1000001000001000',stab:'2000000020000000',arpDir:'down',
    drums:[[0,7,10],[4,12],[],[0,2,4,6,8,10,12,14],[],[3,11],[],[]],phrases:[3,5,23,14,15]},
  {id:'executive-decision',name:'Executive Decision',genre:'BOARDROOM ELECTRO',bpm:112,swing:0,root:40,
    progression:[0,10,8,7],types:['min','maj','maj','maj'],bass:'1001000120010030',arp:'1011011010110110',stab:'0020000000200002',arpDir:'updown',
    drums:[[0,6,10],[4,12],[12],[0,2,6,8,10,14],[7,15],[3,7,11,15],[2],[11]],phrases:[32,8,20,6,13,15]},
  {id:'lunch-break',name:'Lunch Break',genre:'OUT-OF-OFFICE GARAGE',bpm:124,swing:.16,root:41,
    progression:[0,9,5,7],types:['maj','min','maj','maj'],bass:'1000010030100100',arp:'1001100110011001',stab:'0002002000020020',arpDir:'up',
    drums:[[0,6,10,15],[4,12],[12],[0,2,4,6,8,10,12,14],[3,11],[1,5,9,13],[],[14]],phrases:[2,28,5,34,12,15]},
];
export function createGroove(id,nSamples=0){
  const g=GROOVES.find(x=>x.id===id)||GROOVES[0];
  const pattern=Array.from({length:9+nSamples},()=>Array(64).fill(0));
  g.drums.forEach((hits,row)=>{for(let bar=0;bar<4;bar++)hits.forEach(s=>{pattern[row][bar*16+s]=(row<3||s%8===0)?2:1;});});
  // One small turnaround, keeping the first three bars recognisable.
  pattern[1][62]=1;pattern[1][63]=1;
  const chords=g.progression.map((off,i)=>{const root=g.root+off,type=g.types[i];return {root,type,tones:(type==='min'?[0,3,7,10]:[0,4,7,11]).map(n=>root+n)};});
  return {id:g.id,bpm:g.bpm,pattern,song:{name:g.name,root:g.root,chords,bass:rhythm(g.bass),arp:rhythm(g.arp),stab:rhythm(g.stab),arpDir:g.arpDir,arpOct:2,setlist:[...g.phrases],hook:g.phrases.at(-1),swing:g.swing,arranged:true}};
}

// Standard MIDI File format 1: tempo first, then drums, bass, chords and arp.
// https://midi.org/standard-midi-files — no voice samples or effect audio in MIDI.
const bytes=s=>Array.from(new TextEncoder().encode(s));
const be32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
const vlq=n=>{const out=[n&127];while((n>>>=7))out.unshift((n&127)|128);return out;};
function track(name,events,end){
  const label=bytes(name),data=[0,255,3,...vlq(label.length),...label];let last=0;
  events.sort((a,b)=>a.at-b.at||a.priority-b.priority).forEach(e=>{data.push(...vlq(e.at-last),...e.data);last=e.at;});
  data.push(...vlq(Math.max(0,end-last)),255,47,0);
  return [...bytes('MTrk'),...be32(data.length),...data];
}
export function grooveMidi({song,pattern,tempo}){
  const len=pattern[0].length,end=len*120,swing=song.swing||0;
  const at=s=>Math.round((s+(s%2?swing:0))*120);
  const drums=[],bass=[],chords=[],arp=[];
  const note=(events,ch,pitch,start,duration,velocity)=>{const off=Math.min(end,start+duration);events.push({at:start,priority:1,data:[0x90|ch,pitch,velocity]},{at:off,priority:0,data:[0x80|ch,pitch,0]});};
  [36,38,39,42,46,70,56,75].forEach((pitch,row)=>pattern[row].forEach((v,s)=>{if(v)note(drums,9,pitch,at(s),60,v===2?110:78);}));
  for(let step=0;step<len;step++){
    const s=step%16,c=song.chords[Math.floor(step/16)%song.chords.length],b=song.bass[s];
    if(b)note(bass,0,c.root+(b===2?12:b===3?7:0),at(step),100,b===2?108:90);
    if(song.stab[s])c.tones.slice(0,3).forEach(n=>note(chords,1,n+24,at(step),200,86));
    if(song.arp[s]){
      const tones=c.tones,n=tones.length;let ix=step%n,oct=Math.floor(step/n)%2;
      if(song.arpDir==='down')ix=n-1-ix;
      else if(song.arpDir==='updown'){const p=step%((n-1)*2);ix=p<n?p:(n-1)*2-p;}
      else if(song.arpDir==='octaves'){ix=step%2?0:2;oct=Math.floor(step/2)%2;}
      note(arp,2,tones[ix]+12*song.arpOct+12*oct,at(step),72,74);
    }
  }
  const us=Math.round(60_000_000/Math.max(60,Math.min(200,tempo)));
  const conductor=[{at:0,priority:0,data:[255,81,3,(us>>16)&255,(us>>8)&255,us&255]},{at:0,priority:0,data:[255,88,4,4,2,24,8]}];
  const tracks=[track(song.name,conductor,end),track('Corporate drums',drums,end),track('Bass',[{at:0,priority:-1,data:[192,38]},...bass],end),track('Office keys',[{at:0,priority:-1,data:[193,5]},...chords],end),track('After-hours arp',[{at:0,priority:-1,data:[194,81]},...arp],end)];
  return new Uint8Array([...bytes('MThd'),0,0,0,6,0,1,0,tracks.length,1,224,...tracks.flat()]);
}
