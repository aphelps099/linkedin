import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Linkedin,X} from 'lucide-react';
import {linkedInCertificateUrl,certificateImageUrl} from './certificate-share.js';
import {LinkedInPublish} from '../../sharing/LinkedInPublish.jsx';

function CertificatePreview({name,onClose}){
  const dialog=useRef(null),[busy,setBusy]=useState(false),[caption,setCaption]=useState('Humbled to announce that my professional development has been independently acknowledged.\n\nFive lessons. One certificate. Considerable effort.\n\nhttps://linkedinbeats.com/learn/');
  const image=certificateImageUrl(name,window.location.origin);
  useEffect(()=>{const focused=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current.showModal();return()=>{document.body.style.overflow=overflow;focused?.focus();};},[]);
  return createPortal(<dialog className="certificate-publish" ref={dialog} aria-labelledby="certificate-publish-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}} onClick={e=>{if(!busy&&e.target===dialog.current)onClose();}}>
    <header><h2 id="certificate-publish-title">Make it official.</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close certificate preview"><X size={18}/></button></header>
    <img src={image} alt={`Certificate of Professional Effort for ${name}`}/>
    <label htmlFor="certificate-caption">Your caption</label><textarea id="certificate-caption" maxLength={3000} value={caption} disabled={busy} onChange={e=>setCaption(e.target.value)}/>
    <LinkedInPublish mediaKey={name} getFile={async()=>{const response=await fetch(image);if(!response.ok)throw Error('The certificate image could not be prepared. Please try again.');return response.blob();}} title="Certificate of Professional Effort" caption={caption} onBusyChange={setBusy}/>
    <a href={linkedInCertificateUrl(name)} target="_blank" rel="noopener noreferrer">Share a certificate link instead ↗</a>
  </dialog>,document.body);
}
export function CertificateShare({name}){
  const [open,setOpen]=useState(false);
  return <><button type="button" className="pg-btn pg-linkedin-share" onClick={()=>setOpen(true)}><Linkedin size={17}/>Post to LinkedIn</button>{open&&<CertificatePreview name={name} onClose={()=>setOpen(false)}/>}</>;
}
