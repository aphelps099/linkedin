import React from 'react';
import './pixel-divider.css';

// Shared section divider. Use edge inside a .lb-pixel-divided container
// to replace its top rule without changing the surrounding layout.
export function PixelDivider({edge=false}){
  return <div className={`lb-pixel-divider${edge?' is-edge':''}`} role={edge?undefined:'separator'} aria-hidden={edge?true:undefined}>
    {Array.from({length:128},(_,i)=><i key={i} style={{'--dust-delay':`${-((i*137)%83)/10}s`,'--dust-cycle':`${6+(i%7)*.43}s`,'--dust-rest':.29+(i%5)*.04,'--dust-y':`${i%11===3?-3:i%13===5?3:0}px`}}/>)}
  </div>;
}
