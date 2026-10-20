import React, {useId} from 'react';
import {BrandArtwork} from './BrandArtwork.jsx';

// Engraved, self-contained vector details survive PNG export and printing.
function Fleur({transform, color='#a18443'}){
  return <g transform={transform} fill={color}>
    <path d="M0-23C-8-14-8-7-3 2H3C8-7 8-14 0-23ZM-3 2C-5-13-20-15-20-5C-20 2-13 5-8 0C-10-5-14-4-14-1C-12-3-8-1-7 3ZM3 2C5-13 20-15 20-5C20 2 13 5 8 0C10-5 14-4 14-1C12-3 8-1 7 3Z"/>
    <rect x="-9" y="3" width="18" height="3" rx="1"/>
    <path d="M-4 7C-4 12-8 15-12 15C-7 19-2 15 0 12C2 15 7 19 12 15C8 15 4 12 4 7Z"/>
  </g>;
}

export function CertificateBorder(){
  return <g aria-hidden="true">
    <g fill="none" stroke="#a18443">
      <rect x="18" y="18" width="1164" height="814" strokeWidth="1.5"/>
      <rect x="25" y="25" width="1150" height="800" strokeWidth=".65" strokeDasharray="1 3"/>
      <path d="M85 33H550M650 33H1115M85 817H550M650 817H1115M33 85V765M1167 85V765" strokeWidth=".8"/>
      {['translate(41 41)','translate(1159 41) scale(-1 1)','translate(41 809) scale(1 -1)','translate(1159 809) scale(-1 -1)'].map(t=><g key={t} transform={t}>
        <path d="M0 40V0H40M6 48V6H48M13 43C32 43 43 32 43 13M18 31C32 32 32 18 24 19C16 20 22 26 26 23" strokeWidth=".85"/>
      </g>)}
      <path d="M552 33C566 18 580 48 591 33M609 33C620 48 634 18 648 33M552 817C566 802 580 832 591 817M609 817C620 832 634 802 648 817" strokeWidth=".8"/>
    </g>
    <Fleur transform="translate(600 34) scale(.53)"/>
    <Fleur transform="translate(600 817) scale(.53)"/>
    <Fleur transform="translate(61 61) rotate(-45) scale(.65)"/>
    <Fleur transform="translate(1139 61) rotate(45) scale(.65)"/>
    <Fleur transform="translate(61 789) rotate(-135) scale(.65)"/>
    <Fleur transform="translate(1139 789) rotate(135) scale(.65)"/>
    {[280,425,570].map(y=><g key={y}><Fleur transform={`translate(33 ${y}) rotate(-90) scale(.37)`}/><Fleur transform={`translate(1167 ${y}) rotate(90) scale(.37)`}/></g>)}
  </g>;
}

const rosette=Array.from({length:144},(_,i)=>{
  const angle=i*Math.PI/72, radius=i%2 ? 108 : 114;
  return `${i ? 'L' : 'M'}${(Math.cos(angle)*radius).toFixed(2)} ${(Math.sin(angle)*radius).toFixed(2)}`;
}).join(' ')+'Z';

export function CertificateSeal(){
  const id=useId().replace(/:/g,'');
  return <g transform="translate(990 635)" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a17831"/><stop offset=".26" stopColor="#f2dfaa"/><stop offset=".51" stopColor="#c7a15a"/><stop offset=".74" stopColor="#f8e8b8"/><stop offset="1" stopColor="#9b722e"/></linearGradient>
      <path id={`${id}-upper`} d="M-83 0A83 83 0 0 1 83 0"/>
      <path id={`${id}-lower`} d="M-87 0A87 87 0 0 0 87 0"/>
    </defs>
    <path d="M-70 64L-84 140L-52 123L-25 143L-16 76M16 76L25 143L52 123L84 140L70 64" fill="#10182f" stroke="#b08b46" strokeWidth="1.5"/>
    <path d="M-62 80L-69 120M62 80L69 120" fill="none" stroke="#e4c782" strokeWidth="2"/>
    <path d={rosette} fill={`url(#${id}-gold)`} stroke="#92703a"/>
    <circle r="102" fill="none" stroke="#fff0c6" strokeWidth="2"/>
    <circle r="98" fill="none" stroke="#98733b" strokeWidth=".8"/>
    <circle r="92" fill="none" stroke="#98733b" strokeWidth=".6" strokeDasharray="1 3"/>
    <g fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" letterSpacing="2.1" textAnchor="middle" fill="#493819">
      <text><textPath href={`#${id}-upper`} startOffset="50%">EFFORT VERIFIED</textPath></text>
      <text><textPath href={`#${id}-lower`} startOffset="50%">LINKEDIN BEATS</textPath></text>
    </g>
    <g fill="#83652e">{[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}>
      <path d="M-23 66C-65 48-76 4-54-37" fill="none" stroke="#83652e" strokeWidth="1.1"/>
      {[-42,-24,-6,12,30,48].map((a,i)=><g key={a} transform={`translate(${-59-Math.sin(i/5*Math.PI)*11} ${a}) rotate(${-30+i*13})`}><ellipse rx="3" ry="8"/><ellipse cx="8" cy="5" rx="3" ry="7" transform="rotate(60 8 5)"/></g>)}
    </g>)}</g>
    <circle r="54" fill="#10182f" stroke="#f4dda1" strokeWidth="2"/>
    <circle r="48" fill="none" stroke="#cfad69" strokeWidth=".7"/>
    <BrandArtwork variant="monogram" x={-32} y={-32} width={64} height={64} color="#f5e5bc"/>
    <Fleur transform="translate(0 67) scale(.25)" color="#765824"/>
  </g>;
}
