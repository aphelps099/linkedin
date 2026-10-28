import React from 'react';
import './roast-flames.css';

export function roastEmojiCount(score){
 const value=Math.max(0,Math.min(100,Number(score)||0));
 return 1+Math.round(23*(value/100)**1.5);
}
export function RoastFlames({score=0,animate=true}){
 const count=roastEmojiCount(score);
 return <div className="rp-fire" data-emoji-count={count} data-animate={animate} aria-hidden="true" style={{'--emoji-columns':Math.min(count,6)}}>
  {Array.from({length:count},(_,index)=><span className="rp-fire-emoji" key={index} style={{'--emoji-delay':`${index*-.23}s`,'--emoji-speed':`${1.5+(index%4)*.2}s`}}>🔥</span>)}
 </div>;
}
