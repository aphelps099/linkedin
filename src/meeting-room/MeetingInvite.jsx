import React,{useEffect,useRef,useState} from 'react';
import {X,Copy,Mail,Share2} from 'lucide-react';
import {meetingInvitation} from './invitation.js';
import {LinkedInPublish} from '../sharing/LinkedInPublish.jsx';
export function MeetingInvite({meeting,onClose}){
 const dialog=useRef(null),invite=meetingInvitation(meeting);
 const [caption,setCaption]=useState(invite.text),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const cover=`/api/meeting/cover/${meeting.id}.png`;
 useEffect(()=>{dialog.current.showModal();},[]);
 async function copy(value){try{await navigator.clipboard.writeText(value);setNotice('Copied. Attendance is now someone else’s responsibility.');}catch{setNotice('Copy is unavailable here. Select and copy the invitation below.');}}
 async function share(){try{await navigator.share({title:invite.title,text:caption});}catch(e){if(e.name!=='AbortError')setNotice('Sharing is unavailable. Copy the invitation instead.');}}
 async function getFile(){const response=await fetch(cover);if(!response.ok)throw Error('The invitation image is unavailable. Copy the invitation link instead.');return new File([await response.blob()],`meeting-${meeting.id}.png`,{type:'image/png'});}
 return <dialog ref={dialog} className="mr-invite" aria-labelledby="mr-invite-title" onCancel={e=>{if(busy)e.preventDefault();}} onClose={onClose}>
  <header><div><span>MEETING INVITATION</span><h2 id="mr-invite-title">Your presence is requested.</h2></div><button aria-label="Close invitation" disabled={busy} onClick={()=>dialog.current.close()}><X size={20}/></button></header>
  <img className="mr-invite-cover" src={cover} alt={`Meeting invitation: ${meeting.title}`}/>
  <label>Invitation<textarea value={caption} onChange={e=>setCaption(e.target.value)} maxLength={3000} disabled={busy}/></label>
  <div className="mr-invite-options"><button disabled={busy} onClick={()=>copy(caption)}><Copy size={15}/> Copy invite</button><button disabled={busy} onClick={()=>copy(invite.url)}>Copy link</button>{typeof navigator!=='undefined'&&navigator.share&&<button disabled={busy} onClick={share}><Share2 size={15}/> Share…</button>}<a aria-disabled={busy} onClick={e=>{if(busy)e.preventDefault();}} href={`mailto:?subject=${encodeURIComponent(invite.title)}&body=${encodeURIComponent(caption)}`}><Mail size={15}/> Email invite</a></div>
  <LinkedInPublish getFile={getFile} mediaKey={meeting.id} title={meeting.title} caption={caption} onBusyChange={setBusy}/>
  <p className="mr-invite-notice" role="status">{notice||'Opens this recorded meeting. No sign-in needed to watch.'}</p>
 </dialog>;
}
