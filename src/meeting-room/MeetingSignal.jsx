import React from 'react';

// Follow the performance clock, so the signal freezes whenever the meeting pauses.
export default function MeetingSignal({time,playing,bpm}){
  const phase=time*bpm/60*Math.PI*2;
  return <div className={`mr-signal${playing?' is-active':''}`} aria-hidden="true">
    {Array.from({length:175},(_,i)=>{
      const x=i%25,y=Math.floor(i/25);
      const envelope=Math.sin(x/24*Math.PI);
      const wave=playing?Math.sin(x*.55-phase)*envelope*2.5:Math.sin(x*.48)*envelope*1.5;
      const lit=Math.abs(y-3-wave)<.65;
      return <i key={i} className={lit?'is-lit':''}/>;
    })}
  </div>;
}
