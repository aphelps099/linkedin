import React,{useEffect,useRef,useState} from 'react';
import {X,Copy,Mail,Share2,Check} from 'lucide-react';
import {meetingInvitation} from './invitation.js';
import {LinkedInPublish} from '../sharing/LinkedInPublish.jsx';
import './meeting-invite.css';
export function MeetingInvite({meeting,onClose}){
 const dialog=useRef(null),closeButton=useRef(null),backdropPointer=useRef(false),invite=meetingInvitation(meeting);
 const [caption,setCaption]=useState(invite.text),[notice,setNotice]=useState(''),[copied,setCopied]=useState(''),[busy,setBusy]=useState(false);
 const cover=`/api/meeting/cover/${meeting.id}.png?v=invite-2`;
 useEffect(()=>{const opener=document.activeElement,overflow=document.body.style.overflow;dialog.current.showModal();document.body.style.overflow='hidden';closeButton.current?.focus();return()=>{document.body.style.overflow=overflow;opener?.focus({preventScroll:true});};},[]);
 async function copy(value,kind){try{await navigator.clipboard.writeText(value);setCopied(kind);setNotice('Copied. Drop it in the group chat. Attendance is optional.');}catch{setNotice('Copy is unavailable here. Select and copy the meeting link below.');}}
 async function share(){try{await navigator.share({title:invite.title,text:caption.replace(invite.url,''),url:invite.url});}catch(e){if(e.name!=='AbortError')setNotice('Sharing is unavailable. Copy the invitation instead.');}}
 async function getFile(){const response=await fetch(cover);if(!response.ok)throw Error('The invitation image is unavailable. Copy the invitation link instead.');return new File([await response.blob()],`meeting-${meeting.id}.png`,{type:'image/png'});}
 function outside(event){const rect=dialog.current.getBoundingClientRect();return event.target===dialog.current&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);}
 return <dialog ref={dialog} className="mr-invite mr-invite--ticket" aria-labelledby="mr-invite-title" onCancel={e=>{if(busy)e.preventDefault();}} onClose={onClose} onPointerDown={e=>{backdropPointer.current=outside(e);}} onClick={e=>{if(!busy&&backdropPointer.current&&outside(e))dialog.current.close();backdropPointer.current=false;}}>
  <header><div><span>MAKE THIS SOMEONE ELSE’S MEETING.</span><h2 id="mr-invite-title">Bring a +1.</h2></div><button ref={closeButton} aria-label="Close invitation" disabled={busy} onClick={()=>dialog.current.close()}><X size={20}/></button></header>
  <section className="mr-invite-linkedin" aria-label="Invite your LinkedIn network">
   <p className="mr-invite-channel">FIRST, YOUR PROFESSIONAL NETWORK.</p>
   <img className="mr-invite-cover" src={cover} alt={`Meeting invitation: ${meeting.title}`}/>
   <details className="mr-invite-caption"><summary>Personalize your invitation</summary><label>Invitation<textarea value={caption} onChange={e=>{setCaption(e.target.value);setCopied('');}} maxLength={3000} disabled={busy}/></label></details>
   <LinkedInPublish getFile={getFile} mediaKey={meeting.id} title={meeting.title} caption={caption} onBusyChange={setBusy} playful/>
  </section>
  <p className="mr-invite-other">Or invite the group chat.</p>
  <div className="mr-invite-primary"><button disabled={busy} onClick={()=>copy(caption,'invite')}>{copied==='invite'?<Check/>:<Copy/>}{copied==='invite'?'Invitation copied!':'Copy invitation'}</button><button disabled={busy} onClick={()=>copy(invite.url,'link')}>{copied==='link'?<Check/>:<Share2/>}{copied==='link'?'Link copied!':'Copy link'}</button></div>
  <p className="mr-invite-notice" role="status">{notice||'Send a little calendar chaos. No account needed to watch.'}</p>
  <div className="mr-invite-options">{typeof navigator!=='undefined'&&navigator.share&&<button disabled={busy} onClick={share}><Share2 size={16}/> Share via…</button>}<a aria-disabled={busy} onClick={e=>{if(busy)e.preventDefault();}} href={`mailto:?subject=${encodeURIComponent(invite.title)}&body=${encodeURIComponent(caption)}`}><Mail size={16}/> Email invitation</a></div>
  <label className="mr-invite-link-label">Meeting link<input readOnly value={invite.url} onFocus={e=>e.target.select()}/></label>

 </dialog>;
}
