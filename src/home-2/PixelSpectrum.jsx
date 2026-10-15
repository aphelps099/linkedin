import React, {memo, useEffect, useRef} from 'react';

const CHANNELS=Array.from({length:48},(_,i)=>i);

// Quantized LED columns rise from a common baseline. Peaks hold briefly before
// falling; no animation clock or pretend signal runs when playback is stopped.
export const PixelSpectrum=memo(function PixelSpectrum({levels,active}) {
  const root=useRef(null),peaks=useRef(CHANNELS.map(()=>({row:0,until:0})));
  useEffect(()=>{
    const now=performance.now();
    root.current?.childNodes.forEach((column,i)=>{
      const value=active?Number(levels?.[i])||0:0;
      const row=Math.round(Math.max(0,Math.min(1,value))*11);
      const peak=peaks.current[i];
      if(!active){peak.row=0;peak.until=0;}
      else if(row>=peak.row){peak.row=row;peak.until=now+230;}
      else if(now>=peak.until){peak.row=Math.max(row,peak.row-1);peak.until=now+55;}
      column.style.setProperty('--eq-height',`${Math.max(1,row)*4}px`);
      column.style.setProperty('--eq-peak',`${Math.max(0,peak.row-1)*4}px`);
      column.dataset.lit=row>0?'true':'false';
      column.lastChild.hidden=peak.row===0;
    });
  },[levels,active]);
  return <div ref={root} className="c2-spectrum" aria-hidden="true">{CHANNELS.map(i=><span key={i} className="c2-spectrum-column"><i/><b hidden/></span>)}</div>;
});
