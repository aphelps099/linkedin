import React, {useEffect, useRef} from 'react';

const SEEN='lb_academy_celebrated_v1';

// A short, silent celebration. No library, network request or persistent animation.
export function GraduationConfetti(){
  const canvas=useRef(null);
  useEffect(()=>{
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    if(motion.matches)return;
    try{if(sessionStorage.getItem(SEEN))return;sessionStorage.setItem(SEEN,'1');}catch{/* Still celebrate if storage is unavailable. */}
    const el=canvas.current, ctx=el?.getContext('2d');
    if(!ctx)return;
    el.hidden=false;
    const width=window.innerWidth,height=window.innerHeight,dpr=Math.min(window.devicePixelRatio||1,2);
    el.width=width*dpr;el.height=height*dpr;ctx.scale(dpr,dpr);
    const colors=['#0757ec','#d2ae62','#ffe65c','#10182f','#f8edd1'];
    const pieces=Array.from({length:100},(_,i)=>({x:i%2 ? width*.94 : width*.06,y:height*.27,vx:(i%2 ? -1 : 1)*(80+Math.random()*300),vy:-110-Math.random()*220,angle:Math.random()*Math.PI,spin:(Math.random()-.5)*10,size:4+Math.random()*5,color:colors[i%colors.length]}));
    let frame, start, last, stopped=false;
    const stop=()=>{stopped=true;cancelAnimationFrame(frame);ctx.clearRect(0,0,width,height);el.hidden=true;};
    const draw=now=>{
      if(stopped)return;
      start??=now;last??=now;
      const elapsed=(now-start)/1000,dt=Math.min((now-last)/1000,.04);last=now;
      if(elapsed>4.2){stop();return;}
      ctx.clearRect(0,0,width,height);ctx.globalAlpha=Math.min(1,(4.2-elapsed)/1.2);
      for(const p of pieces){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=210*dt;p.vx*=Math.pow(.98,dt*60);p.angle+=p.spin*dt;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/3,p.size,p.size*.6);ctx.restore();}
      frame=requestAnimationFrame(draw);
    };
    const visibility=()=>{if(document.hidden)stop();};
    const preference=()=>{if(motion.matches)stop();};
    frame=requestAnimationFrame(draw);
    window.addEventListener('resize',stop,{once:true});document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',preference);
    return()=>{stop();window.removeEventListener('resize',stop);document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',preference);};
  },[]);
  return <canvas ref={canvas} className="pg-confetti" aria-hidden="true" hidden/>;
}
