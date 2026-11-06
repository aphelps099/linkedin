import React from 'react';

const patterns={
  play:['#......','###....','#####..','#######','#####..','###....','#......'],
  grid:['##..##','##..##','......','##..##','##..##'],
  list:['#..####','#......','#..####','#......','#..####'],
};
export function DotIcon({kind='arrow',reverse=false}){
  // The exact seven-peg glyph used by the homepage carousel.
  if(kind==='arrow')return <svg className={`archive-dot-icon archive-carousel-arrow ${reverse?'is-reversed':''}`} viewBox="0 0 40 24" fill="currentColor" aria-hidden="true">{[[4,12],[12,12],[20,12],[28,12],[36,12],[28,4],[28,20]].map(([x,y])=><circle key={`${x}-${y}`} cx={x} cy={y} r="2.8"/>)}</svg>;
  const pattern=patterns[kind];
  return <svg className={`archive-dot-icon ${reverse?'is-reversed':''}`} viewBox={`-1 -1 ${pattern[0].length+2} ${pattern.length+2}`} fill="currentColor" aria-hidden="true">{pattern.flatMap((row,y)=>[...row].map((dot,x)=>dot==='#'?<circle key={`${x}-${y}`} cx={x+.5} cy={y+.5} r=".36"/>:null))}</svg>;
}

export function PegFrame(){
  return <span className="archive-peg-frame" aria-hidden="true">{['top','right','bottom','left'].map(side=><span key={side} className={`peg-edge peg-edge--${side}`}>{Array.from({length:side==='top'||side==='bottom'?32:20},(_,i)=><i key={i} style={{'--peg-delay':`${(i%8)*45}ms`}}/>)}</span>)}</span>;
}

// Object-bounding-box paint gives each PEG a small, consistent pearl highlight.
export function CandyPaint(){
  return <svg width="0" height="0" className="archive-paints" aria-hidden="true"><defs><radialGradient id="archive-pearl-peg" cx="35%" cy="25%" r="85%"><stop offset="0" stopColor="#ffffff"/><stop offset=".48" stopColor="#fff5dd"/><stop offset="1" stopColor="#d6c5f2"/></radialGradient></defs></svg>;
}
