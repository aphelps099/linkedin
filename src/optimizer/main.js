// Old fragment-based singles retain their recipe on the dedicated listening page.
if(location.hash.startsWith('#mix='))location.replace('/beat/'+location.search+location.hash);
import {createBoard,clearBoard,light} from '../pegboard/board.js';
import {createRenderer} from '../pegboard/renderer.js';
import {compileFont} from '../pegboard/font.js';
import {PEG9} from '../pegboard/fonts/peg9.js';
import {claimAudio, onAudioFocus} from '../brand/audio-focus.js';
import {createMobileAudio} from '../audio-session.js';
import './player.css';
const glyphs=compileFont(PEG9).glyphs;
import bank from './clips.json';
import {CUTS,clipKeys} from './cuts.js';
const root=document.getElementById('optimize-player'),q=s=>root.querySelector(s),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const design={pause:600,glow:1.2};
const cuts=CUTS;
let canvas=q('[data-board]'),renderer,board,w=0,h=0,pitch=0,index=0,phase='ready',frame=0,serial=0,muted=false,ctx,mobileAudio,master,bus,nodes=[],audio=null,markAnnounced=false;
const decoded=new Map(),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const measure=text=>Math.max(0,[...text].reduce((n,c)=>n+(c===' '?4:(glyphs[c]?.w||4)+1),0)-1);
function wrap(text,width){const lines=[];let line='';for(const token of text.split(' ')){if(measure(line?line+' '+token:token)>width&&line){lines.push(line);line=token}else line=line?line+' '+token:token;}if(line)lines.push(line);return lines;}
function put(b,text,x,y,s=1,tone=0,I=1,limit=Infinity,sy=s){let count=0;for(const ch of text){if(ch===' '){x+=4*s;continue;}const g=glyphs[ch];if(g){if(count<limit)for(let gy=0;gy<g.h;gy++)for(let gx=0;gx<g.w;gx++)if(g.mask[gy*g.w+gx])for(let yy=0;yy<sy;yy++)for(let xx=0;xx<s;xx++)light(b,Math.round(x+gx*s+xx),Math.round(y+gy*sy+yy),I,{tone});x+=(g.w+1)*s;}count++;}}
function text(b,txt,y,s=1,tone=0,I=1,limit=Infinity,sy=s){put(b,txt,Math.floor((b.cols-measure(txt)*s)/2),y,s,tone,I,limit,sy);}
function line(b,x1,y1,x2,y2,tone=0,I=.2,width=1){const n=Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1)));for(let i=0;i<=n;i++)for(let j=0;j<width;j++)light(b,Math.round(x1+(x2-x1)*i/(n||1)),Math.round(y1+(y2-y1)*i/(n||1))+j,I,{tone});}
function ring(b,cx,cy,r,I=.12,shift=0,arc=1,tone=0){for(let a=0;a<Math.PI*2*arc;a+=1/Math.max(10,r*2))light(b,Math.round(cx+Math.cos(a+shift)*r),Math.round(cy+Math.sin(a+shift)*r),I,{tone});}
function block(b,lines,{cy=b.rows*.48,tone=0,I=1,maxScale=3,maxHeight=b.rows*.66,reveal=1,gap=6,tall=false}={}){const longest=Math.max(...lines.map(measure)),s=Math.max(1,Math.min(maxScale,Math.floor((b.cols-18)/longest),Math.floor((maxHeight-(lines.length-1)*gap)/(lines.length*9))));let sy=tall&&s===1?2:s;if(lines.length*9*sy+(lines.length-1)*gap>maxHeight)sy=s;const height=lines.length*9*sy+(lines.length-1)*gap,top=Math.round(cy-height/2);let budget=lines.join('').replace(/ /g,'').length*reveal;lines.forEach((txt,i)=>{text(b,txt,top+i*(9*sy+gap),s,tone,I,Math.ceil(Math.max(0,budget)),sy);budget-=txt.replace(/ /g,'').length;});return {s,sy,top,height};}
function mark(b,amount){if(amount<=0)return;const x0=b.cols-19,y0=b.rows-18,sz=13,progress=Math.ceil(amount*sz);for(let y=0;y<progress;y++)for(let x=0;x<sz;x++){if((x===0||x===sz-1)&&(y===0||y===sz-1))continue;let white=(x>=2&&x<=3&&y>=3&&y<=4)||(x>=2&&x<=3&&y>=6&&y<=10)||(x>=5&&x<=6&&y>=6&&y<=10)||(x>=7&&x<=9&&y===6)||(x>=8&&x<=10&&y===7)||(x>=9&&x<=10&&y>=8&&y<=10);light(b,x0+x,y0+y,white?1.5:.75,{tone:white?1:0});}}
function keys(c=cuts[index]){return clipKeys(c);}
function reveal(key,t){const ws=bank[key].words;let n=0;for(const word of ws)n+=word.text.length*clamp((t-word.start-.025)/Math.max(.08,(word.end-word.start)*.5));return n/ws.reduce((n,w)=>n+w.text.length,0);}
function geometry(){const nw=canvas.clientWidth,nh=canvas.clientHeight;if(!nw||!nh)return false;if(!renderer)renderer=createRenderer(canvas,{pixelRatio:Math.min(devicePixelRatio||1,2),quality:{bloom:2,renderScale:1,socketShading:true},onSwap:c=>canvas=c,onFallback:()=>{}});if(nw!==w||nh!==h){w=nw;h=nh;const cols=Math.max(nw<500?108:183,Math.ceil(nw/(nh/74)));pitch=nw/cols;board=createBoard(cols,Math.ceil(nh/pitch));renderer.resize(nw,nh);}return true;}
function time(){return audio?Math.max(0,ctx.currentTime-audio.start):0;}
function draw(){if(!geometry())return;const b=clearBoard(board),c=cuts[index],C=b.cols,R=b.rows,active=['playing','paused','ended'].includes(phase),t=phase==='ended'?audio?.end||9:time(),ks=keys(),callEnd=bank[ks[0]].words.at(-1).end+.025,response=audio?.response??callEnd+design.pause/1000,finish=(c.kind==='couplet'?response:0)+bank[ks.at(-1)].words.at(-1).end+.025,stamp=active?clamp((t-finish-.18)/.25):0;
 b.bloom=design.glow;b.exposure=.91;b.sockets=.96;const motion=reduced?0:active?t:0;
 if(c.shape==='clock'){ring(b,C/2,R*.46,R*.32,.09);ring(b,C/2,R*.46,R*.28,.06);const theta=-Math.PI/2+motion*1.5;line(b,C/2,R*.46,C/2+Math.cos(theta)*R*.25,R*.46+Math.sin(theta)*R*.25,0,.13);}
 if(c.shape==='bars'||c.shape==='stretch'||c.shape==='stairs'){for(let k=0;k<10;k++){const x=7+k*(C-14)/10,y=R-15-k*(R*.035);line(b,x,R-15,x,y,0,.1,2);line(b,x,y,x+(C-14)/10,y,0,.08);}}
 if(c.shape==='double'){for(const off of [-4,4]){line(b,11+off,R*.28+off,C-12+off,R*.28+off,0,.12);line(b,11+off,R*.28+off,11+off,R*.72+off,0,.12);line(b,11+off,R*.72+off,C-12+off,R*.72+off,0,.12);}}
 if(c.shape==='circle'||c.shape==='synergy'||c.shape==='halo'){for(let k=0;k<4;k++)ring(b,C/2+(c.shape==='synergy'?(k%2?1:-1)*Math.max(0,9-motion*7):0),R*.46,13+k*7,.08,motion*(k%2?-1:1),c.shape==='circle'?.85:1,c.shape==='halo'?2:0);}
 if(c.shape==='question'){block(b,['?'],{cy:R*.47,maxScale:5,I:.11});ring(b,C/2,R*.47,R*.36,.07);}
 if(c.shape==='pivot'){const angle=-.4+Math.sin(motion*2)*.3;line(b,C*.2,R*.67-Math.sin(angle)*C*.25,C*.8,R*.67+Math.sin(angle)*C*.25,0,.16);ring(b,C/2,R*.67,4,.2);}
 if(c.shape==='leverage'){line(b,C*.27,R*.72,C*.73,R*.63,0,.18,2);line(b,C*.48,R*.7,C*.43,R*.82,2,.15);line(b,C*.48,R*.7,C*.53,R*.82,2,.15);}
 if(c.shape==='delve'){for(let k=0;k<4;k++){const x=9+k*7,y=10+k*5;line(b,x,y,C-x,y,0,.06+k*.025);line(b,x,y,x,R-y,0,.06+k*.025);line(b,C-x,y,C-x,R-y,0,.06+k*.025);line(b,x,R-y,C-x,R-y,0,.06+k*.025);}}
 if(c.kind==='couplet'){
  const after=active&&t>=callEnd+.12,splitX=c.x.match(/^(A|AN) (.*)$/),prefix="IT'S NOT"+(splitX?' '+splitX[1]:''),noun=splitX?splitX[2]:c.x;
  if(!after){const nounBox=block(b,wrap(noun,C-16),{cy:R*.54,maxScale:3,maxHeight:R*.33,tone:1,I:1.1,reveal:active&&!reduced?reveal(ks[0],t):1,tall:C<120});text(b,prefix,nounBox.top-15,1,1,1);}
  else{const topLines=wrap("IT'S NOT "+c.x,C-20),a=block(b,topLines,{cy:R*.2,tone:1,I:.28,maxScale:1,gap:3,maxHeight:R*.25}),strike=reduced?1:clamp((t-callEnd-.12)/.2);let consumed=0;topLines.forEach((txt,n)=>{const p=Math.max(0,9-consumed);if(p<txt.length){const x=Math.floor((C-measure(txt))/2)+(p?measure(txt.slice(0,p))+1:0),y=a.top+n*12+4;line(b,x,y,x+measure(txt.slice(p))*strike,y,2,1,2);}consumed+=txt.length+1;});
   let bottom;if(c.id==='guess-forecast')bottom=["IT'S A",'FORECAST.'];else if(c.id==='more-work-stretch')bottom=["IT'S A STRETCH",'ASSIGNMENT.'];else{const y=c.y.match(/^(A|AN) (.*)$/);bottom=["IT'S"+(y?' '+y[1]:''),...(wrap(y?y[2]:c.y,C-20))];}const rr=t>=response?(reduced?1:reveal(ks[1],t-response)):0;block(b,bottom,{cy:R*.58,maxScale:3,maxHeight:R*.48,reveal:rr,tall:C<120,gap:6});
  }
 }else{let lines=c.kind==='keyword'?[c.text]:wrap(c.text,(C-18)/1.7);if(lines.length*9+(lines.length-1)*7>R*.6)lines=wrap(c.text,C-18);if(c.file==='06')lines=C>130?["LET'S",'CIRCLE BACK']:["LET'S",'CIRCLE','BACK'];if(c.file==='02')lines=['HUMBLED','AND HONORED','TO SHARE'];if(c.file==='55')lines=['FEEDBACK','IS A GIFT.'];if(c.file==='44')lines=["WE'RE JUST",'GETTING STARTED.'];if(c.file==='15')lines=['LET THAT','SINK IN'];const rr=active&&!reduced?reveal(ks[0],t):1;const yy=R*.46+(c.shape==='sink'&&active&&!reduced?Math.min(5,t*1.7):0);block(b,lines,{cy:yy,maxScale:c.kind==='keyword'?3:3,maxHeight:R*.6,reveal:rr,tall:C<120,tone:c.shape==='feedback'?2:0,gap:7});if(c.shape==='sink'){for(let k=0;k<3;k++)line(b,C*.2,R*.76+k*3,C*.8,R*.76+k*3,0,.11/(k+1));}}
 mark(b,reduced&&stamp>0?1:stamp);renderer.draw(b,{pitch,time:motion,kick:phase==='playing'&&!reduced?Math.max(0,.1*Math.cos(t*2*Math.PI*108/60)):0});
 if(stamp>0&&!markAnnounced){markAnnounced=true;q('[data-status]').textContent=c.kind==='couplet'?'OPTIMIZED.':'IN THE VOCABULARY.';q('[data-transcript]').textContent=(c.kind==='couplet'?"It's not "+c.x.toLowerCase()+" It's "+c.y.toLowerCase():c.label)+' LinkedIn mark illuminated.';}
}
function renderUI(){const c=cuts[index];if(phase==='ready')q('[data-transcript]').textContent=c.kind==='couplet'?"It's not "+c.x.toLowerCase():c.label;root.dataset.phase=phase;q('[data-count]').textContent=String(index+1).padStart(2,'0')+' / '+cuts.length;q('[data-category]').textContent='OPTIMIZE';q('[data-cast]').textContent=c.cast;q('[data-next-label]').textContent='UP NEXT: '+cuts[(index+1)%cuts.length].label.toUpperCase();const label=phase==='playing'?'PAUSE':phase==='paused'?'RESUME':phase==='loading'?'WAIT':phase==='ended'?'REPLAY':'PLAY';q('[data-play-label]').textContent=label;q('[data-play]').setAttribute('aria-label',phase==='playing'?'Pause playback':phase==='paused'?'Resume playback':phase==='loading'?'Cancel loading':'Play '+c.label+' with sound');q('[data-mute]').textContent=muted?'SOUND OFF':'SOUND ON';q('[data-mute]').setAttribute('aria-pressed',String(muted));q('[data-status]').textContent=phase==='loading'?'CUEING THE VOICES…':phase==='paused'?'PAUSED.':phase==='playing'?'ON AIR.':phase==='error'?'SOUND UNAVAILABLE · RETRY':phase==='ended'?(c.kind==='couplet'?'OPTIMIZED.':'IN THE VOCABULARY.'):'READY WHEN YOU ARE.';}
function save(){try{localStorage.setItem('lb-optimize-player',JSON.stringify({index,muted}));}catch{}}
function cancel(){serial++;mobileAudio?.pause();cancelAnimationFrame(frame);frame=0;if(bus&&ctx){const old=bus;old.gain.cancelScheduledValues(ctx.currentTime);old.gain.setTargetAtTime(0,ctx.currentTime,.012);setTimeout(()=>old.disconnect(),80);}for(const n of nodes)try{n.stop(ctx.currentTime+.04)}catch{}nodes=[];audio=null;markAnnounced=false;}
async function initSound(){if(!ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)throw Error('Audio unavailable');ctx=new A();mobileAudio=createMobileAudio(ctx);master=ctx.createGain();master.gain.value=muted?0:.8;master.connect(ctx.destination);}await mobileAudio.resume();}
async function getBuffer(key){
 if(!decoded.has(key)){
  const pending=fetch(bank[key].url).then(response=>{if(!response.ok)throw Error('Voice unavailable');return response.arrayBuffer();}).then(bytes=>ctx.decodeAudioData(bytes));
  decoded.set(key,pending);
  pending.catch(()=>{if(decoded.get(key)===pending)decoded.delete(key);});
 }
 return decoded.get(key);
}
function note(midi,at,dur,gain,type='triangle'){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=440*2**((midi-69)/12);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+dur);o.connect(g);g.connect(bus);o.start(at);o.stop(at+dur+.02);nodes.push(o);}
function groove(start,end,response,stamp){const beat=60/108;for(let i=0;start+i*beat<end-.6;i++){const at=start+i*beat,o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(115,at);o.frequency.exponentialRampToValueAtTime(42,at+.14);g.gain.setValueAtTime(.09,at);g.gain.exponentialRampToValueAtTime(.0001,at+.18);o.connect(g);g.connect(bus);o.start(at);o.stop(at+.2);nodes.push(o);if(i%2===1)note(86,at,.045,.007,'square');if(at+beat*.5<end-.6)note([38,45,38,50][i%4],at+beat*.5,.2,.022);}if(response!==null)[62,66,69].forEach((n,i)=>note(n,start+response+i*.065,.35,.012));note(74,start+stamp,.3,.025);note(81,start+stamp+.07,.24,.012);}
async function start(){cancel();claimAudio('optimize-player');const token=serial,ks=keys(),c=cuts[index];phase='loading';renderUI();draw();try{await initSound();const bs=await Promise.all(ks.map(getBuffer));if(token!==serial)return;if(ctx.state!=='running')throw Error('Audio suspended');bus=ctx.createGain();bus.connect(master);const start=ctx.currentTime+.08,response=c.kind==='couplet'?bank[ks[0]].words.at(-1).end+.025+design.pause/1000:null,stamp=(response||0)+bank[ks.at(-1)].words.at(-1).end+.025+.18,end=stamp+.65;bs.forEach((b,i)=>{const src=ctx.createBufferSource();src.buffer=b;src.connect(bus);src.start(start+(i?response:0));nodes.push(src);});groove(start,start+end,response,stamp);audio={start,end,stamp,response};phase='playing';renderUI();q('[data-transcript]').textContent=c.kind==='couplet'?"It's not "+c.x.toLowerCase():c.label;save();frame=requestAnimationFrame(tick);}catch{if(token!==serial)return;cancel();phase='error';renderUI();draw();}}
function tick(){frame=0;if(phase!=='playing')return;draw();if(time()>=audio.end){phase='ended';mobileAudio?.pause();renderUI();draw();return;}frame=requestAnimationFrame(tick);}
async function toggle(){if(phase==='loading'){cancel();phase='ready';renderUI();draw();}else if(phase==='playing'){const token=serial;phase='paused';cancelAnimationFrame(frame);frame=0;mobileAudio?.pause();await ctx.suspend();if(token!==serial)return;renderUI();draw();}else if(phase==='paused'){const token=serial;phase='loading';renderUI();try{claimAudio('optimize-player');await mobileAudio.resume();if(token!==serial)return;phase='playing';renderUI();frame=requestAnimationFrame(tick);}catch{if(token!==serial)return;cancel();phase='error';renderUI();draw();}}else start();}
function navigate(delta){cancel();index=(index+delta+cuts.length)%cuts.length;phase='ready';renderUI();draw();start();}
q('[data-play]').addEventListener('click',toggle);q('[data-prev]').addEventListener('click',()=>navigate(-1));q('[data-next]').addEventListener('click',()=>navigate(1));
q('[data-mute]').addEventListener('click',()=>{muted=!muted;if(master)master.gain.setTargetAtTime(muted?0:.8,ctx.currentTime,.02);renderUI();save();});
root.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.isContentEditable||e.target.matches('input,textarea,select'))return;if(e.key==='ArrowRight'){e.preventDefault();navigate(1);}else if(e.key==='ArrowLeft'){e.preventDefault();navigate(-1);}else if(e.code==='Space'&&!e.target.closest('button,a')){e.preventDefault();toggle();}});
function restore(p){if(!p)return;const next=Number.isInteger(p.index)?clamp(p.index,0,cuts.length-1):index;if(next!==index){cancel();index=next;phase='ready';}muted=p.muted===true;if(master)master.gain.setTargetAtTime(muted?0:.8,ctx.currentTime,.02);renderUI();draw();}
renderUI();draw();
try{restore(JSON.parse(localStorage.getItem('lb-optimize-player')));}catch{}
const resize=new ResizeObserver(draw);resize.observe(q('.op-stage'));
function stopForBackground(){if(['playing','paused','loading'].includes(phase)){cancel();mobileAudio?.pause();phase='ready';renderUI();draw();}}
onAudioFocus('optimize-player',stopForBackground);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopForBackground();});
window.addEventListener('pagehide',()=>{stopForBackground();mobileAudio?.pause();});
// Opening the site menu pauses the performance at its current audio position.
document.querySelector('#menuToggle')?.addEventListener('click',()=>{if(phase==='playing')toggle();else if(phase==='loading')stopForBackground();});
