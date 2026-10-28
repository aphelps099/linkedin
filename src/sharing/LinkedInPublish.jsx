import React,{useEffect,useRef,useState} from 'react';
import {Linkedin,LoaderCircle,ExternalLink} from 'lucide-react';
import './linkedin-publish.css';
import {InviteOval} from '../brand/InviteOval.jsx';

async function request(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',signal:AbortSignal.timeout(120000),...options});
  const data=await response.json().catch(()=>({error:'Sharing is temporarily unavailable. Please try again.'}));
  if(!response.ok)throw Object.assign(new Error(data.error||'LinkedIn could not complete this request.'),{status:response.status,code:data.code});
  return data;
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function LinkedInPublish({file,getFile,mediaKey,title,caption,disabled=false,onBusyChange,playful=false}){
  const [account,setAccount]=useState(null),[busy,setBusy]=useState(false),[stage,setStage]=useState(''),[error,setError]=useState(''),[result,setResult]=useState(null),[visibility,setVisibility]=useState('PUBLIC');
  const alive=useRef(true),running=useRef(false),popup=useRef(null),prepared=useRef(null),cancelConnection=useRef(false);
  const refresh=async()=>{const value=await request('/api/auth/linkedin/status');if(alive.current)setAccount(value);return value;};
  useEffect(()=>{alive.current=true;refresh().catch(e=>{if(alive.current)setError(e.message);});return()=>{alive.current=false;popup.current?.close();};},[]);
  useEffect(()=>{prepared.current=null;setResult(null);setError('');},[file,mediaKey]);
  const working=(value,label='')=>{running.current=value;if(alive.current){setBusy(value);setStage(label);onBusyChange?.(value);}};
  async function connect(){
    if(running.current)return;
    popup.current=window.open('about:blank','linkedin-beats-connect','popup,width=600,height=760');
    if(!popup.current){setError('Allow the LinkedIn connection window, then try again. Your preview will stay here.');return;}
    cancelConnection.current=false;working(true,'Connecting…');setError('');
    try{
      const {url}=await request('/api/auth/linkedin/start',{method:'POST'});popup.current.location.href=url;
      const deadline=Date.now()+5*60000;
      while(alive.current&&Date.now()<deadline){
        await pause(1500);if(!alive.current||cancelConnection.current)return;
        const value=await refresh();
        if(value.connected){popup.current.close();return;}
        // Some providers isolate the popup with COOP and report it as closed.
        // Poll our own session instead of abandoning a valid authorization.
      }
      throw Error('The connection window timed out. Please try again.');
    }catch(e){if(alive.current)setError(e.message);popup.current?.close();}
    finally{working(false);}
  }
  async function disconnect(){
    if(running.current)return;working(true,'Disconnecting…');setError('');
    try{await request('/api/auth/linkedin/disconnect',{method:'POST',headers:{'X-CSRF-Token':account.csrf}});prepared.current=null;setResult(null);await refresh();}
    catch(e){if(alive.current)setError(e.message);}finally{working(false);}
  }
  async function publish(){
    if(running.current||!account?.connected)return;working(true,'Preparing media…');setError('');
    // Snapshot the reviewed caption and audience at the explicit Publish click.
    const content={caption,title,visibility,confirm:true};
    let publishing=false;
    try{
      if(!prepared.current){
        const blob=file||await getFile?.();
        if(!blob||!['video/mp4','image/png'].includes(blob.type))throw Error('Prepare an MP4 video or PNG certificate first.');
        if(blob.size>12*1024*1024)throw Error('This media exceeds the 12 MB sharing limit.');
        if(alive.current)setStage('Uploading to LinkedIn…');
        prepared.current=await request('/api/linkedin/media',{method:'POST',headers:{'Content-Type':blob.type,'X-CSRF-Token':account.csrf},body:blob});
      }
      let media=prepared.current;
      const deadline=Date.now()+90000;
      while(media.state==='processing'&&Date.now()<deadline){
        if(alive.current)setStage('LinkedIn is processing your video…');
        await pause(2000);if(!alive.current)return;
        media=await request(`/api/linkedin/media/${media.id}`);prepared.current=media;
      }
      if(!alive.current)return;
      if(media.state==='published'){setResult(media);return;}
      if(media.state==='sending'||media.state==='unknown')throw Object.assign(Error('LinkedIn may already have received this post. Check your profile before creating another.'),{code:'publish_uncertain'});
      if(media.state==='failed'){prepared.current=null;throw Error('LinkedIn could not process this media. Save the file or try a new preview.');}
      if(media.state!=='ready')throw Error('LinkedIn is still processing. Click Publish again in a moment to check; the upload will be reused.');
      setStage('Publishing…');publishing=true;
      const posted=await request(`/api/linkedin/media/${media.id}/publish`,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':account.csrf},body:JSON.stringify(content)});
      prepared.current=posted;setResult(posted);
    }catch(e){
      if(!alive.current)return;
      // Recover a lost success response without submitting a second post.
      if(publishing&&prepared.current){try{const recovered=await request(`/api/linkedin/media/${prepared.current.id}`);prepared.current=recovered;if(recovered.state==='published'){setResult(recovered);return;}}catch{}}
      if(e.status===401){setAccount({enabled:true,connected:false});prepared.current=null;}
      setError(e.message||'We could not confirm the post. Check LinkedIn before trying again.');
    }finally{working(false);}
  }
  if(account?.enabled===false)return <p className="lip-note">Direct publishing is temporarily unavailable. You can use the sharing options below.</p>;
  return <section className="lip" aria-label="Publish directly to LinkedIn">
    {result?<><p className="lip-success" role="status">Your post is live. Considerable visibility.</p><a className="lip-button" href={result.url} target="_blank" rel="noopener noreferrer">View your post <ExternalLink size={18}/></a></>:<>
      {account?.connected?<div className="lip-account"><span>Posting as <strong>{account.name}</strong></span><button type="button" disabled={busy} onClick={disconnect}>Disconnect</button></div>:<p className="lip-note">Connect once. Publish your media and caption here. Nothing posts until you choose Publish.</p>}
      {account?.connected&&<label className="lip-audience">Audience<select value={visibility} disabled={busy} onChange={e=>setVisibility(e.target.value)}><option value="PUBLIC">Anyone on LinkedIn</option><option value="CONNECTIONS">Connections only</option></select></label>}
      <button className="lip-button" type="button" onClick={account?.connected?publish:account?connect:()=>refresh().catch(e=>setError(e.message))} disabled={busy||account?.connected&&(disabled||!caption.trim())}><span className={playful?'lip-button-label':undefined}>{busy?stage:account?.connected?'Publish to LinkedIn':account?'Connect LinkedIn':'Check LinkedIn connection'}{playful&&!busy&&<InviteOval/>}</span>{busy?<LoaderCircle className="lip-spinner" size={19}/>:<Linkedin size={19}/>}</button>
      <p className="lip-note lip-small">{account?.connected?'Publishes the media shown above and your caption to your personal feed.':'Uses your profile name and posting permission. No email access requested.'} <a href="/privacy/" target="_blank" rel="noopener noreferrer">Privacy</a></p>
    </>}
    {busy&&stage==='Connecting…'&&<button className="lip-cancel" type="button" onClick={()=>{cancelConnection.current=true;popup.current?.close();}}>Cancel connection</button>}
    {error&&<p className="lip-error" role="alert">{error}</p>}
  </section>;
}
