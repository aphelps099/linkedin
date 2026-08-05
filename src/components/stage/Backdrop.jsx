import React, { useEffect, useRef } from 'react';
import { drawAsciiField, drawFocusRamp } from '../../ascii.js';
import { drawGrain } from '../../grain.js';

// The room the stage stands in: the equalizer at four times scale, filling the
// browser window behind everything, with a gradient ramp that burns brightest
// behind the monitor and falls away into flat blue at the edges.
export function Backdrop({ stateRef, focusRef }){
  const ref = useRef(null);
  useEffect(()=>{
    let raf, w = 0, h = 0;
    const cv = ref.current;
    const ctx = cv.getContext('2d');
    const resize = ()=>{
      w = window.innerWidth; h = window.innerHeight;
      cv.width = Math.max(1, Math.round(w));      // 1:1 pixels — this is texture, not type
      cv.height = Math.max(1, Math.round(h));
    };
    resize();
    window.addEventListener('resize', resize);
    const loop = ()=>{
      const now = performance.now();
      try{
        ctx.fillStyle = '#0a66c2';
        ctx.fillRect(0, 0, w, h);
        drawAsciiField(ctx, stateRef.current || {}, now, {
          width: w, height: h, cell: 76, alpha: .3,
        });
        // the ramp centres on the monitor, so the eye lands on the words
        const box = focusRef && focusRef.current ? focusRef.current.getBoundingClientRect() : null;
        const cx = box ? box.left + box.width/2 : w/2;
        const cy = box ? box.top + box.height/2 : h/2;
        // the field burns around the monitor and is fully spent before the
        // corners, so the room frames the words instead of competing with them
        const inner = box ? Math.max(box.width, box.height)*.38 : Math.min(w,h)*.26;
        drawFocusRamp(ctx, {width:w, height:h, cx, cy, inner, outer: inner + Math.min(w, h)*.52});
        drawGrain(ctx, w, h, .085);
      }catch(e){ /* keep the room lit */ }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  },[stateRef, focusRef]);
  return <canvas ref={ref} aria-hidden="true"
    style={{position:'fixed',inset:0,width:'100%',height:'100%',zIndex:0,pointerEvents:'none',display:'block'}}/>;
}
