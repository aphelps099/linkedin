import React from 'react';
import {PEG3} from '../pegboard/fonts/peg3.js';
import {PEG5} from '../pegboard/fonts/peg5.js';
import {PEG9} from '../pegboard/fonts/peg9.js';
import {normalize} from '../pegboard/font.js';

// Original site glyphs, with bounded wrapping for library sample names.
export default React.memo(function PegLabel({text,face=5,pitch=2,maxCols=180,maxLines=1}){
 const font=face===3?PEG3:face===9?PEG9:PEG5;
 const value=normalize(String(text)).text;
 const width=t=>[...t].reduce((n,c)=>n+(c===' '?font.space:(font.glyphs[c]?.w??font.space)+font.tracking),0);
 const lines=[];let line='';
 for(const word of value.split(' ')){const next=line?`${line} ${word}`:word;if(line&&width(next)>maxCols){lines.push(line);line=word;}else line=next;}
 if(line)lines.push(line);
 const visible=lines.slice(0,maxLines);
 if(lines.length>maxLines){let last=visible.at(-1);while(last&&width(last+'…')>maxCols)last=last.slice(0,-1);visible[visible.length-1]=last+'…';}
 const dots=[];let widest=1;
 visible.forEach((row,j)=>{let x=0;for(const c of row){if(c===' '){x+=font.space;continue;}const g=font.glyphs[c];if(!g)continue;g.bits.forEach((bits,y)=>[...bits].forEach((bit,i)=>{if(bit==='#')dots.push(<circle key={`${j}-${x+i}-${y}`} cx={x+i+.5} cy={j*(font.rows+3)+y+.5} r=".42"/>);}));x+=g.w+font.tracking;}widest=Math.max(widest,x-font.tracking);});
 const height=Math.max(font.rows,(visible.length-1)*(font.rows+3)+font.rows+font.descent);
 return <svg className={`syn-peg-label syn-peg-${face}`} width={widest*pitch} height={height*pitch} viewBox={`0 0 ${widest} ${height}`} role="img" aria-label={String(text)}><g fill="currentColor">{dots}</g></svg>;
});
