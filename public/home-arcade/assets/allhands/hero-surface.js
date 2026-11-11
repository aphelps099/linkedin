import {f as peg5,e as normalize,J as layout,m as createBoard,t as createRenderer,v as resetBoard,w as psych,y as prepareCue,p as renderScreens,G as pitchForStage} from './stage-CDrfDtUj.js';
const hero=document.querySelector('#home'),canvas=document.querySelector('#heroPegSurface'),screen=document.querySelector('.mission-screen'),video=document.querySelector('#heroVideo');
const typeCanvas=document.querySelector('#heroTypeOverlay'),typeContext=typeCanvas.getContext('2d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,font=normalize(peg5),renderer=createRenderer(canvas,{pixelRatio:Math.min(2,devicePixelRatio||1),quality:{bloom:0,socketShading:false}}),sample=document.createElement('canvas'),ctx=sample.getContext('2d',{willReadFrequently:true});
let board,layer,geo,mode='welcome',start=performance.now(),last=0,visible=true,idle=false,sampleFailed=false,cues=[],layouts=new Map();
function cue(text,from,reveal,accent=-1){return prepareCue({kind:'title',voice:'board',from,to:1e9,text,words:text.split(' ').map((text,i)=>({text,start:from+i*.16,end:from+(i+1)*.16,units:[{chars:[0,text.length],start:from+i*.16}]})),accent,reveal,tone:'white',k:1,release:'cut',fx:{}})}
function resize(){const w=hero.clientWidth,h=hero.clientHeight;if(!w||!h)return;const hr=hero.getBoundingClientRect(),sr=screen.getBoundingClientRect(),pitch=mode==='welcome'?(w<700?4:6):pitchForStage(sr.width,sr.height),cols=Math.ceil(w/pitch)+2,rows=Math.ceil(h/pitch)+2;board=createBoard(cols,rows);layer=createBoard(cols,rows);geo={w,h,pitch,x:((sr.left-hr.left+Math.floor((sr.width-Math.floor(sr.width/pitch)*pitch)/2))%pitch)-pitch,y:((sr.top-hr.top+Math.floor((sr.height-Math.floor(sr.height/pitch)*pitch)/2))%pitch)-pitch,screen:{left:sr.left-hr.left,top:sr.top-hr.top,width:sr.width,height:sr.height}};renderer.resize(w,h);const ratio=Math.min(2,devicePixelRatio||1);typeCanvas.width=Math.round(w*ratio);typeCanvas.height=Math.round(h*ratio);typeContext.setTransform(ratio,0,0,ratio,0,0);sample.width=cols;sample.height=rows;layouts=new Map();cues=[cue('THE SOUNDTRACK',.45,'typewriter'),cue('FOR THOUGHT',.8,'centre'),cue('LEADERS.',1.1,'centre')];
 const maxCols=Math.floor((Math.min(sr.width-40,680))/pitch);for(const c of cues){let k=1;let shape=layout(c.text,{font,k,maxCols,maxLines:1});if(shape.pages.length>1||shape.width>maxCols){k=1;shape=layout(c.text,{font,k,maxCols,maxLines:w<450?2:1})}layouts.set(c,shape)}
}
function frame(){if(video.readyState<2||!video.videoWidth||sampleFailed)return null;try{const {cols,rows}=board,scale=Math.max(cols/video.videoWidth,rows/video.videoHeight),sw=cols/scale,sh=rows/scale;ctx.drawImage(video,(video.videoWidth-sw)/2,(video.videoHeight-sh)/2,sw,sh,0,0,cols,rows);canvas.dataset.footage='live-video';return{cols,rows,data:ctx.getImageData(0,0,cols,rows).data}}catch(e){sampleFailed=true;canvas.dataset.footage='unavailable';return null}}
function draw(now){requestAnimationFrame(draw);if(!board||!visible||document.hidden||now-last<40)return;last=now;const t=reduced?5:(now-start)/1000;resetBoard(board);typeContext.clearRect(0,0,geo.w,geo.h);
 if(mode==='welcome'&&!idle){
 // Render footage on an empty board first. This avoids the original text-protection
 // distance mask, which creates a broad black halo around the letter shapes.
 const clearFilm=hero.dataset.filmTreatment==='clear';
 const footage=clearFilm?null:frame();
 if(!clearFilm)psych(board,{look:footage?'footage':'ripples',seed:3,params:{gamma:.82,sharpen:1.1,colour:1,speed:.35}},reduced?2:t,{drive:{beat:t*1.8,voice:0,clap:0},frame:footage});
 // The headline uses the same mono family as the controls, over clear footage.
 if(t>=.45){
   const mobile=geo.w<700,size=mobile?Math.min(36,(geo.w-40)/8):Math.min(62,geo.w*.048);
   typeContext.font=`400 ${size}px Founders, Mono, monospace`;
   typeContext.textBaseline='top';typeContext.fillStyle='#fff';
   const lines=['THE SOUNDTRACK','FOR THOUGHT','LEADERS.'],lineHeight=size*1.16;
   const bottom=mobile?132:138,left=mobile?20:geo.w*.035;
   lines.forEach((line,i)=>{typeContext.globalAlpha=reduced?1:Math.max(0,Math.min(1,(t-.45-i*.12)/.35));typeContext.fillText(line,left,geo.h-bottom-3*lineHeight+i*lineHeight)});
   typeContext.globalAlpha=1;
 }

 // Keep the film visible across the entire hero; reserve contrast only beneath the copy and controls.
 if(!clearFilm)for(let y=0;y<board.rows;y++)for(let x=0;x<board.cols;x++){const i=y*board.cols+x,px=x*geo.pitch,py=y*geo.pitch;{const bottom=Math.max(0,Math.min(1,(py-(geo.h-380))/260));const left=Math.max(0,Math.min(1,(geo.w*.8-px)/(geo.w*.25)));const top=Math.max(0,1-py/160);board.I[i]*=(.82-.60*bottom*left)*(1-.25*top);if(!footage){board.I[i]*=.25;board.tone[i]=0;board.white[i]=0}}}
 canvas.dataset.phase=clearFilm?'clear-film':t<2?'film-reveal':'pixel-film';

 }else canvas.dataset.phase=mode;
 board.ambient=.85;board.sockets=.28;board.bloom=0;if(!(mode==='welcome'&&hero.dataset.filmTreatment==='clear'))renderer.draw(board,{pitch:geo.pitch,x:geo.x,y:geo.y,time:reduced?0:t});hero.classList.add('peg-ready');
}
new ResizeObserver(resize).observe(hero);new ResizeObserver(resize).observe(screen);new IntersectionObserver(entries=>{visible=entries[0].isIntersecting}).observe(hero);
document.addEventListener('hero-mode',e=>{mode=e.detail.mode;idle=false;typeCanvas.hidden=mode!=='welcome';resize()});document.addEventListener('hero-idle',e=>{idle=e.detail});document.addEventListener('hero-replay',()=>{start=performance.now();sampleFailed=false});document.fonts.ready.then(resize);resize();requestAnimationFrame(draw);
