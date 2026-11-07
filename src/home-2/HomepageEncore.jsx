import React, {useEffect,useRef} from 'react';
import './homepage-encore.css';

// The little tug: dome, paper tray, visor, belt and wheels share the field's lattice.
const TUG=[
'        ##########                ',
'       #          #               ',
'        ###########               ',
'       ##        ######           ',
'      #  ########     ####        ',
'     #                    ##      ',
'    #                 #######     ',
'   #                 #       #    ',
'  #                  #       ##   ',
'  #                   ######## #  ',
' ###############################  ',
' #                             #  ',
'##  ##                    ##    # ',
'#                         ##    # ',
'#                               # ',
' ################################ ',
'   ####     ####           ####   ',
'    ##       ##             ##    '
];
const GLYPHS={
'#':['101','111','101','111','101'],H:['101','101','111','101','101'],U:['101','101','101','101','111'],M:['101','111','111','101','101'],B:['110','101','110','101','110'],L:['100','100','100','100','111'],E:['111','100','110','100','111'],D:['110','101','101','101','110'],T:['111','010','010','010','010'],O:['111','101','101','101','111'],G:['111','100','101','101','111'],S:['111','100','111','001','111'],'?':['110','001','010','000','010']
};
const sprite=[],accent=[];
TUG.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='#')(y===10||(y>=6&&y<=9&&x>=21)?accent:sprite).push([x,y]);}));
// A compact lowercase LinkedIn 'in' mark, fitted between the belt and chassis.
['10000','00110','10101','10101'].forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')accent.push([16+x,11+y]);}));
// Printed letters remain attached to the paper as the whole convoy advances.
const print=[];
let cursor=-87;
for(const letter of '#HUMBLED  #THOUGHTS?'){
 const glyph=GLYPHS[letter];
 if(glyph)glyph.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')print.push([cursor+x,y]);}));
 cursor+=4;
}

function PegCrossing(){
 const canvas=useRef(null),phase=useRef(0);
 useEffect(()=>{
  const node=canvas.current,ctx=node.getContext('2d');
  if(!ctx)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,inView=false,timer;
  const grid=5.5,period=164;
  const draw=()=>{
   if(!width)return;
   ctx.clearRect(0,0,width,height);
   const cols=Math.ceil(width/grid),rows=Math.ceil(height/grid);
   const dot=(x,y,r=1.65)=>{const radius=r*grid/6,cx=(x+.5)*grid,cy=(y+.5)*grid;ctx.moveTo(cx+radius,cy);ctx.arc(cx,cy,radius,0,Math.PI*2);};
   ctx.fillStyle='rgba(239,242,238,.10)';ctx.beginPath();
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)dot(x,y,1.05);
   ctx.fill();
   ctx.fillStyle='#eff2ee';ctx.beginPath();
   const origin=Math.floor(cols*.54)+phase.current;
   const top=4;
   for(let offset=origin%period-period;offset<cols+95;offset+=period){
    for(const [x,y] of sprite)dot(offset+x,top+y);
    const sag=x=>Math.round(Math.sin((x+91)/80*Math.PI)*2);
    for(let x=-91;x<=-9;x++){
     const y=top+6+sag(x);
     dot(offset+x,y);dot(offset+x,y+8);
     if(x===-91||x===-9)for(let j=1;j<8;j++)dot(offset+x,y+j);
    }
    for(const [x,y] of print)dot(offset+x,top+9+y,1.55);
    for(let x=-8;x<1;x++)dot(offset+x,top+13-Math.round((x+8)/8));
    // Three bright pellets give the approaching droid an arcade rhythm.
    for(let x=Math.ceil((offset+37)/4)*4;x<offset+49;x+=4)dot(x,top+13,1.9);
   }
   ctx.fill();
   ctx.fillStyle='#a9c9df';ctx.beginPath();
   for(let offset=origin%period-period;offset<cols+95;offset+=period)for(const [x,y] of accent)dot(offset+x,top+y);
   ctx.fill();
  };
  const resize=()=>{
   const box=node.getBoundingClientRect();width=box.width;height=box.height;
   const dpr=Math.min(devicePixelRatio||1,2);node.width=Math.round(width*dpr);node.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();
  };
  const schedule=()=>{
   clearInterval(timer);
   if(!motion.matches&&inView&&!document.hidden)timer=setInterval(()=>{phase.current=(phase.current+1)%period;draw();},165);
  };
  const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;schedule();});observer.observe(node);
  const size=new ResizeObserver(resize);size.observe(node);
  motion.addEventListener('change',schedule);document.addEventListener('visibilitychange',schedule);resize();
  return()=>{clearInterval(timer);observer.disconnect();size.disconnect();motion.removeEventListener('change',schedule);document.removeEventListener('visibilitychange',schedule);};
 },[]);
 return <canvas ref={canvas} className="peg-crossing" aria-hidden="true"/>;
}
export function HomepageEncore(){
 return <section id="corporate-signoff" className="office-marquee" aria-label="The feed must go on. A dot-grid office droid with a LinkedIn in badge tows a paper banner reading hashtag Humbled and hashtag Thoughts across the grid.">
  <PegCrossing/>
  <div className="office-marquee-bottom"><p>The feed must go on.</p></div>
 </section>;
}
