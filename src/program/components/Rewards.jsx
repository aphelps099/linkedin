import React, {useRef, useState} from 'react';
import {ArrowRight, Check, Download} from 'lucide-react';
import {SynergyTip} from './SynergyTip.jsx';

export const REWARDS = [
  {name:'Certified Attention Seeker', lines:['CERTIFIED','ATTENTION','SEEKER'], color:'#0757ec', ink:'#fff', foot:'A STRONG OPENING.'},
  {name:'Humbled & Promoted', lines:['HUMBLED &','PROMOTED'], color:'#fff349', ink:'#11110e', foot:'A SMALL BUT MEANINGFUL MILESTONE.'},
  {name:'Fluent in Synergy', lines:['FLUENT IN','SYNERGY'], color:'#d9e6ff', ink:'#0757ec', foot:'WORDS WERE DEFINITELY USED.'},
  {name:'Strategic Line Breaker', lines:['STRATEGIC','LINE BREAKER'], color:'#11110e', ink:'#fff', foot:'LEAVING ROOM FOR IMPACT.'},
  {name:'Officially Optimized', lines:['OFFICIALLY','OPTIMIZED'], color:'#ecebea', ink:'#0757ec', foot:'CONSIDERABLE EFFORT. VERIFIED.'},
];

// Serialize the same artwork shown on screen, then render a portable, high-res PNG.
// All artwork is self-contained: no external images, fonts or network requests.
export async function downloadArt(svg, filename){
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const [,,w,h] = svg.getAttribute('viewBox').split(' ').map(Number);
  clone.setAttribute('width', w); clone.setAttribute('height', h);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], {type:'image/svg+xml'}));
  try{
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload=resolve; img.onerror=reject; img.src=url; });
    const canvas=document.createElement('canvas'); canvas.width=w*2; canvas.height=h*2;
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob) throw new Error('Image export unavailable');
    const fileUrl=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=fileUrl; link.download=filename; document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(fileUrl),1000);
  }finally{ URL.revokeObjectURL(url); }
}

export function Sticker({number = 1, svgRef}){
  const reward=REWARDS[number-1];
  const y=reward.lines.length===3 ? 94 : 111;
  return <svg ref={svgRef} className="pg-sticker" viewBox="0 0 400 264" role="img" aria-label={reward.name}>
    <rect x="8" y="8" width="384" height="248" rx="22" fill="white"/>
    <rect x="16" y="16" width="368" height="232" rx="16" fill={reward.color}/>
    <g fill={reward.ink} fontFamily="Arial, sans-serif" textAnchor="middle">
      <text x="200" y="49" fontSize="12" letterSpacing="3">LINKEDIN BEATS · LESSON 0{number}</text>
      {reward.lines.map((line,i)=><text key={line} x="200" y={y+i*40} fontSize="35" fontWeight="900" letterSpacing="-1">{line}</text>)}
      <path d="M38 195H362" stroke={reward.ink} opacity=".45"/>
      <text x="200" y="222" fontSize="9" letterSpacing="1.4">{reward.foot}</text>
    </g>
  </svg>;
}

export function LessonReward({chapter, nextTitle, final, onContinue}){
  const art=useRef(null), [status,setStatus]=useState('');
  const download=async()=>{setStatus('Preparing…');try{await downloadArt(art.current,`linkedin-beats-lesson-${chapter.number}.png`);setStatus('Sticker downloaded.');}catch{setStatus('Could not download. Please try again.');}};
  return <section className="pg-end" aria-label="Lesson complete">
    <div className="pg-complete-label"><Check size={15}/>Lesson {String(chapter.number).padStart(2,'0')} complete</div>
    <h2>{final ? 'Considerable effort. Officially recognized.' : 'A little more LinkedIn. A little less human.'}</h2>
    <p>You unlocked <strong>{REWARDS[chapter.number-1].name}</strong>.</p>
    <div className="pg-sticker-stage"><Sticker number={chapter.number} svgRef={art}/></div>
    <button type="button" className="pg-text-button" onClick={download}><Download size={15}/>Download sticker</button>
    <span className="pg-download-status" role="status">{status}</span>
    <SynergyTip celebrate content={final ? "Five lessons. One beat. Your professional development is now **officially overdeveloped.**" : "That is another milestone for the feed. Please remain **appropriately humbled.**"}/><div className="pg-end-next"><span>{final ? 'Your five-lesson journey, in writing.' : <>Up next<br/><strong>{nextTitle}</strong></>}</span><button type="button" className="pg-btn" onClick={onContinue}>{final ? 'View my certificate' : 'Begin next lesson'}<ArrowRight size={16}/></button></div>
  </section>;
}

export function CertificateArt({name, svgRef}){
  const nameSize=Math.min(90, 1350/Math.max(name.length,1));
  return <svg ref={svgRef} className="pg-certificate-art" viewBox="0 0 1200 850" role="img" aria-label={`Certificate of Professional Effort awarded to ${name}. Certified Thought Leader.`}>
    <defs><linearGradient id="pg-silver" x2="1" y2="1"><stop stopColor="#f8f8f5"/><stop offset=".48" stopColor="#b5b7b7"/><stop offset=".7" stopColor="#eee"/><stop offset="1" stopColor="#999c9e"/></linearGradient></defs>
    <rect width="1200" height="850" fill="#fbf8ef"/>
    <g fill="#11110e" fontFamily="Arial, sans-serif">
      <text x="65" y="75" fontSize="32" fontWeight="700" letterSpacing="-1.5">linkedin<tspan fill="#0757ec"> beats</tspan></text>
      <g fontFamily="monospace" fontSize="11" letterSpacing="2"><text x="850" y="54">DEPARTMENT OF</text><text x="850" y="73">PROFESSIONAL DEVELOPMENT</text></g>
      <path d="M65 99H1135" stroke="#11110e"/>
      <text x="65" y="144" fill="#0757ec" fontFamily="monospace" fontSize="13" letterSpacing="2">OFFICIAL RECORD OF COMPLETION</text>
      <g fontWeight="900" fontSize="65" letterSpacing="-3"><text x="60" y="220">CERTIFICATE OF</text><text x="60" y="293">PROFESSIONAL EFFORT</text></g>
      <text x="65" y="343" fontFamily="monospace" fontSize="12" letterSpacing="2">THIS CERTIFIES THAT</text>
      <text x="62" y="435" fontFamily="Georgia, serif" fontSize={nameSize}>{name}</text>
      <path d="M65 462H1135" stroke="#11110e"/>
      <g fontSize="23"><text x="65" y="504">has completed five lessons in strategic self-importance,</text><text x="65" y="539">demonstrated advanced synergy, and remained</text><text x="65" y="574">humbled throughout.</text></g>
      <text x="65" y="622" fontFamily="monospace" fontSize="12" letterSpacing="2">AND IS HEREBY RECOGNIZED AS A</text>
      <text x="63" y="665" fontSize="37" fontWeight="900" fill="#0757ec" letterSpacing="-1">CERTIFIED THOUGHT LEADER</text>
      <text x="70" y="719" fontFamily="Georgia, serif" fontStyle="italic" fontSize="29">The Department</text>
      <path d="M65 730H420" stroke="#11110e"/>
      <text x="65" y="752" fontFamily="monospace" fontSize="10" letterSpacing="1.3">DIRECTOR OF STRATEGIC ALIGNMENT</text>
      <g fontFamily="monospace" textAnchor="middle" fontSize="12" letterSpacing="1.8"><text x="622" y="716">PROGRAM COMPLETED</text><text x="622" y="741">5 OF 5 LESSONS</text></g>
      <g transform="translate(1000 625)"><circle r="115" fill="url(#pg-silver)" stroke="#8b8e91" strokeWidth="3" strokeDasharray="2 5"/><circle r="99" fill="none" stroke="#666"/><circle r="64" fill="#0757ec" stroke="#fff"/><text y="35" textAnchor="middle" fontSize="110" fill="#e5e7e7">*</text><g textAnchor="middle" fontFamily="monospace" fontSize="12" letterSpacing="2"><text y="-78">EFFORT VERIFIED</text><text y="88">LINKEDIN BEATS</text></g></g>
      <path d="M65 785H1135" stroke="#11110e"/>
      <g fontFamily="monospace" fontSize="11" letterSpacing="1"><text x="65" y="815">Considerable effort. Unclear business impact.</text><text x="1135" y="815" textAnchor="end" fill="#0757ec">LINKEDINBEATS.COM</text></g>
    </g>
  </svg>;
}
