import React, {useRef, useState} from 'react';
import {ArrowRight, Check, Download} from 'lucide-react';
import {SynergyTip} from './SynergyTip.jsx';
import {BrandArtwork} from './BrandArtwork.jsx';

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
  const nameSize=Math.min(90, 1350/Math.max(name.length,1));
  return <svg ref={svgRef} className="pg-certificate-art" viewBox="0 0 1200 850" role="img" aria-label={`Certificate of Professional Effort awarded to ${name}. Certified Thought Leader.`}>
    <rect width="1200" height="850" fill="#fbf8ef"/>
    <rect width="1200" height="150" fill="#10182f"/>
    <rect y="150" width="1200" height="7" fill="#0757ec"/>
    <BrandArtwork x={65} y={42} width={680} height={66} color="#fff"/>
    <g fill="#10182f" fontFamily="Arial, sans-serif">
      <text x="1135" y="75" textAnchor="end" fontSize="25" letterSpacing="5" fill="#fff349">ACADEMY</text>
      <text x="1135" y="101" textAnchor="end" fontSize="13" fill="#d6dfef">PROFESSIONAL DEVELOPMENT, ALLEGEDLY.</text>
      <text x="65" y="199" fill="#0757ec" fontSize="13" fontWeight="700" letterSpacing="2">OFFICIAL RECORD OF COMPLETION</text>
      <g fontWeight="900" fontSize="62" letterSpacing="-2.7"><text x="61" y="266">CERTIFICATE OF</text><text x="61" y="334">PROFESSIONAL EFFORT</text></g>
      <path d="M64 352C260 346 493 348 725 351" stroke="#ffe65c" strokeWidth="11" strokeLinecap="round"/>
      <text x="65" y="391" fontSize="12" letterSpacing="2">AWARDED WITH APPROPRIATE ENTHUSIASM TO</text>
      <text x="62" y="473" fontFamily="Georgia, serif" fontSize={nameSize}>{name}</text>
      <path d="M65 494H1135" stroke="#10182f" strokeOpacity=".3"/>
      <g fontSize="22"><text x="65" y="534">For completing five lessons in strategic self-importance,</text><text x="65" y="567">demonstrating advanced synergy, and remaining</text><text x="65" y="600">humbled throughout.</text></g>
      <text x="65" y="641" fontSize="12" letterSpacing="2">AND NOW OFFICIALLY RECOGNIZED AS A</text>
      <text x="63" y="681" fontSize="35" fontWeight="900" fill="#0757ec" letterSpacing="-1">CERTIFIED THOUGHT LEADER</text>
      <text x="65" y="733" fontFamily="Georgia, serif" fontStyle="italic" fontSize="29">Synergy</text>
      <path d="M65 745H345" stroke="#10182f"/>
      <text x="65" y="766" fontSize="10" letterSpacing="1">HEAD OF PROFESSIONAL DEVELOPMENT OPTIMIZATION</text>
      <g textAnchor="middle" fontSize="12" letterSpacing="1.5"><text x="643" y="731">FIVE LESSONS. ONE MILESTONE.</text><text x="643" y="754" fill="#0757ec" fontWeight="700">CONSIDERABLE EFFORT. VERIFIED.</text></g>
      <g transform="translate(1000 646)"><circle r="116" fill="#10182f"/><circle r="105" fill="none" stroke="#687184"/><circle r="93" fill="none" stroke="#687184" strokeOpacity=".6"/><circle r="67" fill="#fff349"/><BrandArtwork variant="monogram" x={-42} y={-42} width={84} height={84}/><g textAnchor="middle" fontSize="11" letterSpacing="2" fill="#fff"><text y="-80">EFFORT VERIFIED</text><text y="91">LINKEDIN BEATS</text></g></g>
      <path d="M65 790H1135" stroke="#10182f" strokeOpacity=".3"/>
      <g fontSize="12"><text x="65" y="820">Considerable effort. Unclear business impact.</text><text x="1135" y="820" textAnchor="end" fill="#0757ec" fontWeight="700" letterSpacing="1">LINKEDINBEATS.COM / LEARN</text></g>
    </g>
  </svg>;
}
