import {PEG9} from '../pegboard/fonts/peg9.js';
import {normalize} from '../pegboard/font.js';

const clamp=n=>Math.max(0,Math.min(1,n));
const glyphCache=new Map();
function wordArt(text){
  if(glyphCache.has(text))return glyphCache.get(text);
  let x=0;const letters=[];
  for(const ch of normalize(text).text){
    const glyph=PEG9.glyphs[ch];if(!glyph){x+=PEG9.space;continue;}
    const dots=[];glyph.bits.forEach((row,y)=>[...row].forEach((bit,col)=>{if(bit==='#')dots.push([x+col+.5,y+.5]);}));
    letters.push(dots);x+=glyph.w+PEG9.tracking;
  }
  const art={width:Math.max(1,x-PEG9.tracking),letters};glyphCache.set(text,art);return art;
}
// Layout pages once. All timing below is absolute audio time, including exports.
export function prepareSingalong(cues,fallback){
  const source=cues.length?cues:[{id:0,text:fallback,start:0,end:Infinity,words:[]}];
  return source.map(cue=>{
    const tokens=cue.text.trim().split(/\s+/).map((text,i)=>({text,art:wordArt(text),timing:cue.words?.[i]}));
    const pages=[];let rows=[],row=[],width=0;
    const endRow=()=>{if(row.length){rows.push({tokens:row,width});row=[];width=0;}};
    const endPage=()=>{endRow();if(rows.length){pages.push({rows,start:pages.length?rows[0].tokens[0].timing?.start??Infinity:cue.start});rows=[];}};
    for(const token of tokens){
      const next=width+(row.length?PEG9.space:0)+token.art.width;
      if(row.length&&next>68){endRow();if(rows.length===2)endPage();}
      width+=(row.length?PEG9.space:0)+token.art.width;row.push(token);
    }
    endPage();return {...cue,pages};
  });
}
export function singalongFrame(score,time,{bpm=96,idle=false,reduced=false}={}){
  const cue=score.findLast(c=>time>=c.start)||score[0];
  const page=idle?cue.pages[0]:cue.pages.findLast(p=>time>=p.start)||cue.pages[0];
  const voice=cue.words?.some(w=>time>=w.start&&time<w.end)||false;
  const beat=time*bpm/60,phase=beat-Math.floor(beat);
  return {cue,page,voice,beat,grid:idle||reduced?0:Math.exp(-phase*9)*(voice?.035:.16),arrival:idle||reduced?1:clamp((time-page.start)/.16)};
}
export function letterLight(timing,index,count,time,idle=false,reduced=false){
  if(idle||!timing)return {lit:0,alpha:.82};
  if(time<timing.start)return {lit:0,alpha:.48};
  const progress=clamp((time-timing.start)/Math.max(.04,timing.end-timing.start));
  // A small leading edge reads as articulation, then settles to warm white.
  const lit=reduced?(time>=timing.start&&time<timing.end?1:0):clamp(progress*count-index+.5)*(1-clamp((time-timing.end)/.28));
  return {lit,alpha:time<timing.start?.48:time<timing.end?1:.86};
}
export function drawSingalong(ctx,score,time,box,{bpm=96,idle=false,reduced=false,paper='#f3f0e4',accent='#ffe18b',grid='#cbdde7',dark=false}={}){
  if(!score.length||box.w<=36||box.h<=48)return;
  const frame=singalongFrame(score,time,{bpm,idle,reduced}),{page}=frame;
  ctx.save();ctx.beginPath();ctx.rect(box.x,box.y,box.w,box.h);ctx.clip();
  // Grid pulse travels one peg at a time; never a full-screen opacity flash.
  if(!reduced&&!idle){
    const pitch=12,front=(frame.beat%4)/4*box.w;
    ctx.fillStyle=grid;
    for(let y=12;y<box.h;y+=pitch)for(let x=6;x<box.w;x+=pitch){
      const distance=Math.abs(x-front);if(distance>70)continue;
      ctx.globalAlpha=frame.grid*(1-distance/70);ctx.beginPath();ctx.arc(box.x+x,box.y+y,1.15,0,Math.PI*2);ctx.fill();
    }
  }
  const widest=Math.max(...page.rows.map(r=>r.width)),rowHeight=PEG9.rows+PEG9.descent+5;
  const pitch=Math.min((box.w-36)/widest,(box.h-48)/(page.rows.length*rowHeight),page.rows.length===1?10:8);
  const top=box.y+(box.h-(page.rows.length*rowHeight-5)*pitch)/2+(1-frame.arrival)*6;
  page.rows.forEach((row,j)=>{
    let x=box.x+(box.w-row.width*pitch)/2;
    for(const token of row.tokens){
      token.art.letters.forEach((dots,i)=>{
        const light=letterLight(token.timing,i,token.art.letters.length,time,idle,reduced);
        ctx.globalAlpha=(dark?Math.max(.84,light.alpha):light.alpha)*(.7+.3*frame.arrival);ctx.fillStyle=paper;
        for(const [dx,dy] of dots){ctx.beginPath();ctx.arc(x+dx*pitch,top+(j*rowHeight+dy)*pitch,pitch*.36,0,Math.PI*2);ctx.fill();}
        if(light.lit){
          ctx.globalAlpha=light.lit;ctx.fillStyle=accent;ctx.shadowColor=accent;ctx.shadowBlur=reduced||dark?0:pitch*1.1;
          for(const [dx,dy] of dots){ctx.beginPath();ctx.arc(x+dx*pitch,top+(j*rowHeight+dy)*pitch,pitch*.37,0,Math.PI*2);ctx.fill();}
          ctx.shadowBlur=0;
        }
      });x+=(token.art.width+PEG9.space)*pitch;
    }
  });ctx.restore();return frame;
}
