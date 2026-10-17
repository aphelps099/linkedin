import React, {memo, useEffect, useRef, useState} from 'react';

const PHRASES=['Humbled and honored to share','Thrilled to announce','Let’s take this offline'];

// A 16px reduction of the office droid: squat body, dome, offset visor and blue collar.
function MicroDroid(){
  return <svg className="development-tow-droid" viewBox="0 0 16 16" width="16" height="16" fill="none" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <path fill="#f4f6ef" d="M5 2h5v1h2v1h1v2h1v3H2V6h1V4h2Z"/>
    <path fill="#c1d0da" d="M8 2h2v1h2v1h1v2h1v2h-3V6H9V4H8Z"/>
    <path fill="#10263c" d="M10 4h3v3h-3Z"/>
    <path fill="#64b6ff" d="M1 8h14v2H1Z"/>
    <path fill="#eef2e9" d="M1 10h14v3H1Z"/>
    <path fill="#9aafbf" d="M2 13h3v2H2Zm9 0h3v2h-3Z"/>
    <path fill="#456077" d="M5 13h6v1H5Z"/>
    <path className="development-tow-light" fill="#5ed9ff" d="M12 10h2v2h-2Z"/>
  </svg>;
}

export const RadioRacingBanner=memo(function RadioRacingBanner({motion}){
  const root=useRef(null),lap=useRef(null);
  const [visible,setVisible]=useState(false),[paused,setPaused]=useState(false);
  useEffect(()=>{
    let inView=false;
    const sync=()=>setVisible(inView&&!document.hidden);
    const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;sync();});
    observer.observe(root.current);
    document.addEventListener('visibilitychange',sync);
    // Keep the towing pace consistent after font loading and viewport changes.
    const measure=()=>root.current?.style.setProperty('--tow-duration',`${(lap.current.getBoundingClientRect().width/34).toFixed(2)}s`);
    const resize=new ResizeObserver(measure);
    resize.observe(lap.current);
    measure();
    return()=>{observer.disconnect();resize.disconnect();document.removeEventListener('visibilitychange',sync);};
  },[]);
  const running=motion&&visible&&!paused;
  return <button ref={root} type="button" className={`development-tow${motion?'':' is-still'}`} data-running={running}
    aria-label={motion?`${paused?'Resume':'Pause'} scrolling corporate phrases`:'Humbled and honored to share. Thrilled to announce. Let’s take this offline.'}
    aria-pressed={motion?paused:undefined} disabled={!motion} onClick={()=>setPaused(value=>!value)}>
    <span className="development-tow-track" aria-hidden="true">
      {/* Three identical, viewport-wide laps cover both edges of the rightward loop.
          Text comes first: the robot stays at the leading end of its tow line. */}
      {[0,1,2].map(copy=><span className="development-tow-lap" ref={copy===0?lap:undefined} key={copy}>
        <span className="development-tow-words">{PHRASES.map((phrase,index)=><React.Fragment key={phrase}>{index>0&&<span className="development-tow-dot">·</span>}<span className="development-tow-phrase">{phrase}</span></React.Fragment>)}</span>
        <span className="development-tow-line"/>
        <MicroDroid/>
        <span className="development-tow-gap"/>
      </span>)}
    </span>
  </button>;
});
