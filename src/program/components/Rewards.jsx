import React, {useId, useRef, useState} from 'react';
import {ArrowRight, Check, Download} from 'lucide-react';
import {SynergyTip} from './SynergyTip.jsx';
import {BrandArtwork} from './BrandArtwork.jsx';
import {certificateMarkup} from './certificate-art.js';
import wordmark from '../../../public/home-2/brand/wordmark-horizontal.svg?raw';
import monogram from '../../../public/home-2/brand/monogram.svg?raw';

export const REWARDS = [
  {name:'Certified Attention Seeker', lines:['CERTIFIED','ATTENTION','SEEKER'], color:'#0757ec', ink:'#fff', foot:'A STRONG OPENING.'},
  {name:'Humbled & Promoted', lines:['HUMBLED &','PROMOTED'], color:'#fff349', ink:'#11110e', foot:'A SMALL BUT MEANINGFUL MILESTONE.'},
  {name:'Fluent in Synergy', lines:['FLUENT IN','SYNERGY'], color:'#d9e6ff', ink:'#0757ec', foot:'WORDS WERE DEFINITELY USED.'},
  {name:'Strategic Line Breaker', lines:['STRATEGIC','LINE BREAKER'], color:'#11110e', ink:'#fff', foot:'LEAVING ROOM FOR IMPACT.'},
  {name:'Officially Optimized', lines:['OFFICIALLY','OPTIMIZED'], color:'#ecebea', ink:'#0757ec', foot:'CONSIDERABLE EFFORT. VERIFIED.'},
];

// Serialize the same artwork shown on screen, then render a portable, high-res PNG.
// All artwork is self-contained: no external images, fonts or network requests.
export async function renderArt(svg){
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
    return blob;
  }finally{ URL.revokeObjectURL(url); }
}

export function downloadBlob(blob, filename){
  const url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url; link.download=filename; document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export async function downloadArt(svg, filename){ downloadBlob(await renderArt(svg), filename); }

export function Sticker({number = 1, svgRef}){
  const reward=REWARDS[number-1];
  const y=reward.lines.length===3 ? 112 : 132;
  return <svg ref={svgRef} className="pg-sticker" viewBox="0 0 400 264" role="img" aria-label={reward.name}>
    <rect x="8" y="8" width="384" height="248" rx="22" fill="white"/>
    <rect x="16" y="16" width="368" height="232" rx="16" fill={reward.color}/>
    <BrandArtwork x={38} y={32} width={244} height={24} color={reward.ink}/>
    <g fill={reward.ink} fontFamily="Arial, sans-serif" textAnchor="middle">
      <text x="361" y="49" fontSize="11" fontWeight="700" textAnchor="end">0{number} / 05</text>
      <text x="38" y="74" fontSize="9" letterSpacing="1.5" textAnchor="start">ACADEMY · PROFESSIONAL EFFORT, VERIFIED</text>
      {reward.lines.map((line,i)=><text key={line} x="200" y={y+i*40} fontSize="35" fontWeight="900" letterSpacing="-1">{line}</text>)}
      <path d="M38 207H362" stroke={reward.ink} opacity=".45"/>
      <text x="200" y="229" fontSize="9" letterSpacing="1">{reward.foot}</text>
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
  const id=useId().replace(/:/g,'');
  return <svg ref={svgRef} className="pg-certificate-art" viewBox="0 0 1200 850" role="img" aria-label={`Certificate of Professional Effort awarded to ${name}. Certified Thought Leader.`} dangerouslySetInnerHTML={{__html:certificateMarkup(name,{wordmark,monogram},id)}}/>;
}
