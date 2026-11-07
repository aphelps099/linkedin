import React from 'react';

// One finite burst. Every light sits on the page's eight-pixel PEG field.
export default function PegFlames({ burst, anchorRef }) {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    if (!burst.id) return;
    const heat = burst.heat;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const anchor = anchorRef.current;
    if (!ctx || !anchor) return;
    let frame;
    let stopped = false;
    const start = performance.now();
    const duration = 1100;
    const stop = () => { stopped = true; cancelAnimationFrame(frame); ctx.clearRect(0, 0, canvas.width, canvas.height); };
    const draw = now => {
      if (stopped) return;
      const elapsed = now - start;
      const t = elapsed / duration;
      if (t >= 1) { stop(); return; }
      const width = window.innerWidth, height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== width*dpr || canvas.height !== height*dpr) {
        canvas.width = width*dpr; canvas.height = height*dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const box = anchor.getBoundingClientRect();
      const center = box.left + box.width/2;
      const base = box.top + 12;
      const reach = Math.min(195, 115 + heat*20);
      const spread = box.width*.6;
      const envelope = Math.min(1, t*7) * Math.max(0, Math.min(1, (1-t)*4));
      const phase = Math.floor(elapsed/90);
      const gridY = 4 - (window.scrollY % 8);
      for (let x = Math.floor((center-spread)/8)*8+4; x <= center+spread; x+=8) {
        const u = (x-center)/spread;
        // Five tapered tongues, with a taller central flame and drifting tips.
        const sway = Math.sin(phase*.7)*.06;
        const tongue = Math.max(...[-.72,-.35,0,.35,.72].map((c,i)=>{
          const peak = [0.46,.72,1,.68,.44][i];
          return peak*Math.max(0,1-Math.abs(u-c-sway)/.24);
        }));
        const flameHeight = reach * envelope * (tongue*.82 + Math.max(0,1-u*u)*.18);
        for (let y = Math.floor((base-flameHeight-gridY)/8)*8+gridY; y <= base; y+=8) {
          const rise = (base-y)/Math.max(1,flameHeight);
          if (rise>1 || flameHeight<8) continue;
          const grain = (Math.abs(Math.round(x/8)*13 + Math.round(y/8)*7 + phase*3)%11)/11;
          const opacity = Math.floor(Math.max(0, (1-rise*.55) * envelope - grain*.17)*5)/5;
          if (opacity<=0) continue;
          ctx.globalAlpha = opacity;
          ctx.fillStyle = rise<.25 ? '#fff3b7' : rise<.65 ? '#ffb06c' : '#ff806b';
          ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 7;
          ctx.beginPath(); ctx.arc(x,y,2.15,0,Math.PI*2);ctx.fill();
        }
      }
      ctx.globalAlpha=1;ctx.shadowBlur=0;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    media.addEventListener('change', stop);
    return () => { stop(); media.removeEventListener('change', stop); };
  }, [burst, anchorRef]);
  return <canvas ref={canvasRef} className="rp-peg-flames" aria-hidden="true"/>;
}
