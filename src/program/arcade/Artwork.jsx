import React from 'react';
import {PEG5} from '../../pegboard/fonts/peg5.js';
import {PEG3} from '../../pegboard/fonts/peg3.js';
import {PEG9} from '../../pegboard/fonts/peg9.js';

export function PegText({text,className='',label,face='peg5'}){
 const font={peg3:PEG3,peg5:PEG5,peg9:PEG9}[face]||PEG5;
 let x=0;const dots=[];
 for(const letter of text.toUpperCase()){
  const glyph=font.glyphs[letter];
  if(!glyph){x+=font.space;continue;}
  glyph.bits.forEach((row,y)=>[...row].forEach((bit,col)=>{if(bit==='#')dots.push(<circle key={`${x}-${col}-${y}`} cx={x+col+.5} cy={y+.5} r=".36" style={{'--peg-column':x+col}}/>);}));
  x+=glyph.w+font.tracking;
 }
 return <svg className={`ac-peg-type ${className}`} viewBox={`0 0 ${Math.max(1,x-1)} ${font.rows+font.descent}`} role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true} fill="currentColor">{dots}</svg>;
}
const shapes={
 hook:['     #       ','    # #      ','     #       ','             ','  ########   ','  #      # ##','  #      #  #','  #      ####','   #    #    ','    ####     ',' ##########  '],
 inflation:['          #  ','       ####  ','   ####   #  ','####      ###','#  #      # #','####      ###','   ####   #  ','    # #####  ','    # #   #  ','     ##      '],
 vocabulary:[' #########   ','#         #  ','# ## ## # #  ','#         #  ','# ## ##   #  ','#         #  ',' ##########  ','       #     ','      #      '],
 shape:['############','            ','#########   ','            ','############','            ','######      ','            ','############'],
 single:['    #####    ','  ##     ##  ',' #         # ','#    ###    #','#   #   #   #','#   # # #   #','#   #   #   #','#    ###    #',' #         # ','  ##     ##  ','    #####    '],
 bot:['     #     ','     # #   ','   #####   ',' ######### ','#         #','#  #   #  #','#         #','#   ###   #',' ######### ','  #     #  ']
};
export function PegIcon({name='bot',className=''}){const rows=shapes[name]||shapes.bot;return <svg className={`ac-peg-icon ${className}`} viewBox={`0 0 15 13`} fill="currentColor" aria-hidden="true">{rows.flatMap((row,y)=>[...row].flatMap((bit,x)=>bit==='#'?[<circle key={`${x}-${y}`} cx={x+1} cy={y+1} r=".36"/>]:[]))}</svg>;}
export function DotArrow({back=false}){return <svg className={`ac-dot-arrow${back?' is-back':''}`} viewBox="0 0 30 22" fill="currentColor" aria-hidden="true">{[[2,11],[7,11],[12,11],[17,11],[22,11],[27,11],[17,1],[22,6],[22,16],[17,21]].map(([x,y])=><circle key={`${x}-${y}`} cx={x} cy={y} r="1.65"/>)}</svg>;}
export function CourseDots({completed=[],current,compact=false}){const ids=['hook','inflation','vocabulary','shape','single'];return <div className={`ac-progress${compact?' is-compact':''}`} aria-label={`${completed.length} of 5 lessons complete`}><div className="ac-progress-pegs">{ids.map((id,i)=><span key={id} className={`${completed.includes(id)?'is-done':''} ${i===current?'is-current':''}`} aria-current={i===current?'step':undefined} title={`Lesson ${i+1}${completed.includes(id)?' complete':i===current?' · Up next':''}`}/>)}</div>{!compact&&<span>{completed.length} of 5 complete</span>}</div>;}
export function PreviewCertificate(){
 const lamps=[...Array.from({length:29},(_,i)=>[40+i*20,15]),...Array.from({length:20},(_,i)=>[625,40+i*20]),...Array.from({length:29},(_,i)=>[600-i*20,435]),...Array.from({length:20},(_,i)=>[15,420-i*20])];
 return <svg className="ac-certificate-preview ac-prize-certificate" viewBox="0 0 640 464" role="img" aria-label="Certificate of Professional Effort. Your name here. Considerable effort. Verified.">
 <path d="M24 14H616V22H632V38H640V440H624V456H608V464H32V456H16V440H0V38H8V22H24Z" fill="#f58e80"/>
 <path d="M24 0H616V8H632V24H640V426H632V442H616V450H24V442H8V426H0V24H8V8H24Z" fill="#294fe5"/>
 <path d="M40 30H600V38H610V412H600V420H40V412H30V38H40Z" fill="#fff2d2"/>
 <g aria-hidden="true">{lamps.map(([x,y],i)=><g key={i} className="ac-prize-lamp" style={{'--lamp-phase':i%4}}><circle cx={x} cy={y} r="5.7" fill="#0e246b"/><circle cx={x} cy={y} r="3.4" fill="#ffe5a0"/></g>)}</g>
 <image href="/home-arcade/assets/wordmark.svg" x="239" y="57" width="162" height="24" style={{filter:'brightness(0)'}}/>
 <g fill="#142a50" textAnchor="middle">
 <text x="320" y="116" fontFamily="monospace" fontSize="12" letterSpacing="2.4">CERTIFICATE OF</text>
 <text x="320" y="153" fontFamily="SynergyArcade,monospace" fontSize="28">PROFESSIONAL</text>
 <text x="320" y="211" fontFamily="SynergyArcade,monospace" fontSize="36">EFFORT</text>
 <text x="257" y="246" fontFamily="monospace" fontSize="9" letterSpacing="1.5">THIS CERTIFIES THAT</text>
 <text x="257" y="293" fontFamily="Georgia,serif" fontSize="33" fontStyle="italic">Your name here</text>
 <path d="M94 307H422" stroke="#c28257" strokeWidth="1.4"/>
 <text x="257" y="335" fontFamily="monospace" fontSize="9" letterSpacing=".9">HAS COMPLETED THE LINKEDIN BEATS ACADEMY</text>
 </g>
 <path d="M62 361H578V367H588V394H578V400H62V394H52V367H62Z" fill="#294fe5"/>
 <text x="320" y="386" fill="#fff2d2" textAnchor="middle" fontFamily="monospace" fontWeight="bold" fontSize="13" letterSpacing=".9">CONSIDERABLE EFFORT. VERIFIED.</text>
 <g transform="translate(507 280)"><circle r="48" fill="#f18e80"/><circle r="42" fill="#294fe5" stroke="#fff2d2" strokeWidth="2" strokeDasharray="3 5"/><circle r="32" fill="none" stroke="#9bb9ff" strokeWidth="1.5"/><g fill="none" stroke="#fff0ab" strokeWidth="4"><path d="M-19 11V-12H19V11ZM-11-18H11M0-25V-18M-11 18V11M11 18V11M-11-3H-5M5-3H11M-8 5H8"/></g></g>
 </svg>;
}

export function DotPlay(){return <svg className="ac-dot-play" viewBox="0 0 25 29" fill="currentColor" aria-hidden="true">{[0,1,2,3,4].flatMap(x=>Array.from({length:9-2*x},(_,y)=><circle key={`${x}-${y}`} cx={3+x*4.5} cy={2+(x+y)*3.1} r="1.3"/>))}</svg>;}
