import React, {useEffect, useRef, useState} from 'react';
import {Copy, Download, ExternalLink, Share2, X} from 'lucide-react';
import {renderArt, downloadBlob} from './Rewards.jsx';
import {copyText} from '../../post-beat/handoff.js';
import {canShareCertificate, shareCertificateFile, CERTIFICATE_FILENAME} from './certificate-share.js';

const CAPTION='Humbled. Honored. Dangerously optimized.\n\nI’ve completed LinkedIn Beats Academy and earned my Certificate of Professional Effort.\n\nFive lessons. Considerable effort. Unclear business impact.\n\nYour professional development awaits:\nhttps://linkedinbeats.com/learn/\n\n#ThoughtLeadership #ProfessionalDevelopment #Synergy';

export function CertificateShare({art, name, onClose}){
  const [prepared,setPrepared]=useState(null), [error,setError]=useState(false), [status,setStatus]=useState(''), [sharing,setSharing]=useState(false);
  const caption=useRef(null), heading=useRef(null);
  const file=prepared?.name===name ? prepared.file : null;
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
  useEffect(()=>{
    let active=true;
    setError(false); setStatus('');
    renderArt(art.current).then(blob=>{if(active)setPrepared({name,file:new File([blob],CERTIFICATE_FILENAME,{type:'image/png'})});},()=>{if(active)setError(true);});
    return()=>{active=false;};
  },[art,name]);
  const copy=async()=>{
    try{await copyText(CAPTION);setStatus('Caption copied. Paste it into your post.');}
    catch{caption.current?.focus();caption.current?.select();setStatus('Select and copy the caption below.');}
  };
  const share=()=>{
    setSharing(true);setStatus('');
    // File is prepared before the tap; sharing keeps the browser's user activation.
    shareCertificateFile(file).then(result=>{
      setSharing(false);
      setStatus(result==='shared' ? 'Certificate handed to your share sheet.' : result==='cancelled' ? 'Sharing cancelled. Your certificate is still here.' : 'Sharing is unavailable here. Download the image and copy the caption instead.');
    });
  };
  const download=()=>{
    try{downloadBlob(file,CERTIFICATE_FILENAME);setStatus('Image downloaded. Attach it to your LinkedIn post.');}
    catch{setStatus('Download unavailable. Use Print / save PDF instead.');}
  };
  return <section className="pg-certificate-share" aria-labelledby="pg-share-heading" onKeyDown={e=>{if(e.key==='Escape')onClose();}}>
    <div className="pg-share-heading"><div><span className="pg-eyebrow pg-eyebrow-blue">A very public milestone</span><h2 id="pg-share-heading" ref={heading} tabIndex={-1}>Remain appropriately humbled.</h2></div><button className="pg-icon-button" type="button" aria-label="Close sharing options" onClick={onClose}><X size={20}/></button></div>
    <p>For LinkedIn: download your certificate, start a post, then attach the image and paste your caption.</p>
    <div className="pg-share-actions">
      <button className="pg-btn" type="button" disabled={!file} onClick={download}><Download size={16}/>{file ? 'Download image' : error ? 'Image unavailable' : 'Preparing image…'}</button>
      <button className="pg-pill" type="button" onClick={copy}><Copy size={16}/>Copy caption</button>
      <a className="pg-pill" href="https://www.linkedin.com/feed/" target="_blank" rel="noopener noreferrer">Open LinkedIn<ExternalLink size={15}/></a>
      {canShareCertificate(file) && <button className="pg-pill" type="button" disabled={sharing} onClick={share}><Share2 size={16}/>{sharing ? 'Sharing…' : 'Share image…'}</button>}
    </div>
    <label className="pg-caption"><span>Your announcement. Naturally.</span><textarea ref={caption} readOnly rows={7} value={CAPTION}/></label>
    <p className="pg-share-status" role="status">{error ? 'Image preparation failed. Close and reopen sharing to retry, or use Print / save PDF.' : status}</p>
  </section>;
}
