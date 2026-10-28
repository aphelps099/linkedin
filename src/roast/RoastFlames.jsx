import React from 'react';
import './roast-flames.css';

// Decorative vector fire: no canvas loop, media download, or effect over the text.
export function RoastFlames({heat=2,animate=true}){
 return <div className="rp-fire" data-heat={heat} data-animate={animate} aria-hidden="true">
  <div className="rp-fire-glow"/>
  <svg className="rp-fire-tongues" viewBox="0 0 600 180" preserveAspectRatio="none">
   {Array.from({length:9},(_,index)=><g key={index} transform={`translate(${index*72-55} 0)`}>
    <g className="rp-flame" style={{'--flame-delay':`${index*-.31}s`,'--flame-speed':`${1.5+(index%4)*.23}s`,'--flame-scale':.72+(index%3)*.14}}>
     <path fill="#ed4528" d="M0 180C-9 139 20 121 22 93C35 103 37 121 34 135C58 114 43 62 65 15C63 69 102 89 85 130C106 113 101 89 97 76C142 117 126 180 95 180Z"/>
     <path fill="#ff8a32" d="M15 180C3 152 24 137 29 121C34 141 42 147 46 136C66 112 58 81 68 66C77 108 107 120 91 148C103 142 110 131 111 122C128 157 109 180 90 180Z"/>
     <path fill="#ffe796" d="M39 180C29 164 45 146 48 138C52 155 59 152 61 143C69 130 66 116 72 106C76 137 92 149 85 162C94 157 98 149 99 145C104 168 91 180 80 180Z"/>
    </g>
   </g>)}
  </svg>
  <span className="rp-ember"/><span className="rp-ember"/><span className="rp-ember"/>
 </div>;
}
