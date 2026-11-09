import React from 'react';
import {PEG9} from '../../pegboard/fonts/peg9.js';
import {PEG3} from '../../pegboard/fonts/peg3.js';
import {BrandArtwork} from './BrandArtwork.jsx';
import {badgeLetterDelay,badgeLetterIsLit} from './badge-motion.js';
import hook from '../../../public/learn/art/peg/hook.svg?raw';
import inflation from '../../../public/learn/art/peg/inflation.svg?raw';
import vocabulary from '../../../public/learn/art/peg/vocabulary.svg?raw';
import shape from '../../../public/learn/art/peg/shape.svg?raw';
import single from '../../../public/learn/art/peg/single.svg?raw';

// Trusted local SVG paths and font dots are embedded, so downloads need no fonts,
// images or animation state from the page. The printed badge matches the screen.
const emblems=[hook,inflation,vocabulary,shape,single].map(raw=>raw.replace(/<style[\s\S]*?<\/style>/g,'').replace(/<svg[^>]*>|<\/svg>|<title>.*?<\/title>/g,''));
function pegLayout(text,font){let advance=0;const dots=[];for(const letter of text){const glyph=font.glyphs[letter];if(!glyph){advance+=font.space;continue;}glyph.bits.forEach((row,y)=>[...row].forEach((bit,x)=>{if(bit==='#')dots.push([advance+x,y]);}));advance+=glyph.w+font.tracking;}return {dots,width:advance-font.tracking};}
function PegLine({text,x,y,pitch,color,font=PEG9,marquee=false,line=0,timeMs}){
 let advance=0;
 return <g>{[...text].map((letter,i)=>{const glyph=font.glyphs[letter];if(!glyph){advance+=font.space;return null;}const start=advance;advance+=glyph.w+font.tracking;const lit=marquee&&timeMs!==undefined&&badgeLetterIsLit(timeMs,i,line);return <g key={i} className={marquee?'badge-letter':undefined} style={marquee?{'--letter-delay':`${badgeLetterDelay(i,line)}ms`,'--letter-color':color}:undefined} fill={lit?'#fff9e7':color}>{glyph.bits.flatMap((row,dy)=>[...row].flatMap((bit,dx)=>bit==='#'?[<circle key={`${dx}-${dy}`} cx={x+(start+dx+.5)*pitch} cy={y+(dy+.5)*pitch} r={pitch*.36}/ >]:[]))}</g>;})}</g>;
}
export function BadgeArtwork({number,reward,svgRef,timeMs}){
 const lines=number===4?['STRATEGIC','LINE','BREAKER']:reward.lines;
 const pitch=Math.min(3.55,238/Math.max(...lines.map(line=>pegLayout(line,PEG9).width)));
 const lineHeight=pitch*12;
 const titleY=145-(lines.length*lineHeight-pitch*3)/2;
 const rim=[...Array.from({length:35},(_,i)=>[40+i*10,20]),...Array.from({length:35},(_,i)=>[40+i*10,280]),...Array.from({length:23},(_,i)=>[20,40+i*10]),...Array.from({length:23},(_,i)=>[400,40+i*10])];
 return <svg ref={svgRef} className="pg-sticker" viewBox="0 0 420 300" role="img" aria-label={reward.name}>
  <path d="M28 4H392V12H408V28H416V272H408V288H392V296H28V288H12V272H4V28H12V12H28Z" fill="#fff2d7"/>
  <path d="M32 11H388V19H401V32H409V268H401V281H388V289H32V281H19V268H11V32H19V19H32Z" fill="#142331"/>
  <g fill={reward.color}>{rim.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i%5===0?2.6:1.5} opacity={i%5===0?1:.55}/>)}</g>
  <BrandArtwork x={36} y={36} width={207} height={24} color="#fff2d7"/>
  <PegLine text={`0${number}`} x={345} y={35} pitch={4.6} color={reward.color} font={PEG3}/>
  <g transform="translate(38 99) scale(.29)" dangerouslySetInnerHTML={{__html:emblems[number-1]}}/>
  {lines.map((line,i)=><PegLine key={line} text={line} x={149} y={titleY+i*lineHeight} pitch={pitch} color={reward.color} marquee line={i} timeMs={timeMs}/>)}
  <path d="M46 234H374V240H382V260H374V266H46V260H38V240H46Z" fill={reward.color}/>
  <g fill="#142331"><path d="m55 249 5 5 10-12 3 3-13 15-8-8Z"/><text x="217" y="255" textAnchor="middle" fontFamily="monospace" fontWeight="bold" fontSize="12" letterSpacing="1.25">EFFORT VERIFIED.</text></g>
 </svg>;
}
