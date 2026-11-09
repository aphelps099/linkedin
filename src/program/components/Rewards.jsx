import React, {useId, useRef, useState} from 'react';
import {Check, Download} from 'lucide-react';
import {DotArrow} from '../arcade/Artwork.jsx';
import {SynergyTip} from './SynergyTip.jsx';
import {BadgeArtwork} from './BadgeArtwork.jsx';
import badgeGifs from './badge-gifs.json';
import {certificateMarkup} from './certificate-art.js';
import wordmark from '../../../public/home-2/brand/wordmark-horizontal.svg?raw';
import monogram from '../../../public/home-2/brand/monogram.svg?raw';

export const REWARDS = [
  {name:'Certified Attention Seeker', lines:['CERTIFIED','ATTENTION','SEEKER'], color:'#a8cfff', ink:'#142337', foot:'A STRONG OPENING.'},
  {name:'Humbled & Promoted', lines:['HUMBLED &','PROMOTED'], color:'#ffad99', ink:'#142337', foot:'A SMALL BUT MEANINGFUL MILESTONE.'},
  {name:'Fluent in Synergy', lines:['FLUENT IN','SYNERGY'], color:'#e7c4fa', ink:'#142337', foot:'WORDS WERE DEFINITELY USED.'},
  {name:'Strategic Line Breaker', lines:['STRATEGIC','LINE BREAKER'], color:'#c5e9bf', ink:'#142337', foot:'LEAVING ROOM FOR IMPACT.'},
  {name:'Officially Optimized', lines:['OFFICIALLY','OPTIMIZED'], color:'#ffe18b', ink:'#142337', foot:'CONSIDERABLE EFFORT. VERIFIED.'},
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
  return <BadgeArtwork number={number} reward={REWARDS[number-1]} svgRef={svgRef}/>;
}

export function BadgeDownloads({number,svgRef,compact=false}){
  const [status,setStatus]=useState('');
  const png=async()=>{setStatus('Preparing PNG…');try{await downloadArt(svgRef.current,`linkedin-beats-lesson-${number}.png`);setStatus('PNG downloaded.');}catch{setStatus('Could not download. Please try again.');}};
  return <div className={`pg-badge-downloads${compact?' is-compact':''}`} style={{'--badge-accent':REWARDS[number-1].color}}>
    <div><a className="pg-badge-gif" href={badgeGifs[number].url} download={`linkedin-beats-lesson-${number}.gif`} aria-label={`Download animated ${REWARDS[number-1].name} GIF`}><Download size={15}/>{compact?'GIF':'Animated GIF'}</a><button type="button" className="pg-text-button" onClick={png} aria-label={`Download ${REWARDS[number-1].name} PNG`}>Still PNG</button></div>
    <span className="pg-download-status" role="status">{status}</span>
  </div>;
}

export function LessonReward({chapter, nextTitle, final, onContinue}){
  const art=useRef(null);
  return <section className="pg-end" aria-label="Lesson complete">
    <div className="pg-complete-label"><Check size={15}/>Lesson {String(chapter.number).padStart(2,'0')} complete</div>
    <h2>{final ? 'Considerable effort. Officially recognized.' : 'A little more LinkedIn. A little less human.'}</h2>
    <p>You unlocked <strong>{REWARDS[chapter.number-1].name}</strong>.</p>
    <div className="pg-sticker-stage"><Sticker number={chapter.number} svgRef={art}/></div>
    <BadgeDownloads number={chapter.number} svgRef={art}/>
    <SynergyTip celebrate content={final ? "Five lessons. One beat. Your professional development is now **officially overdeveloped.**" : "That is another milestone for the feed. Please remain **appropriately humbled.**"}/><div className="pg-end-next"><span>{final ? 'Your five-lesson journey, in writing.' : <>Up next<br/><strong>{nextTitle}</strong></>}</span><button type="button" className="pg-btn" onClick={onContinue}>{final ? 'View my certificate' : 'Begin next lesson'}<DotArrow/></button></div>
  </section>;
}

export function CertificateArt({name, svgRef}){
  const id=useId().replace(/:/g,'');
  return <svg ref={svgRef} className="pg-certificate-art" viewBox="0 0 1200 850" role="img" aria-label={`Certificate of Professional Effort awarded to ${name}. Certified Thought Leader.`} dangerouslySetInnerHTML={{__html:certificateMarkup(name,{wordmark,monogram},id)}}/>;
}
