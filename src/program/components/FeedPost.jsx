import React, {useId, useLayoutEffect, useRef, useState} from 'react';
import {Check, ChevronDown, Copy, Globe2, Heart, Lightbulb, MessageSquare, MoreHorizontal, Repeat2, Send, ThumbsUp} from 'lucide-react';

export function Profile({name, title, composer = false}){
  const displayName = name || 'Your Name';
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  return <div className={`pg-profile${composer ? ' pg-profile-composer' : ''}`}>
    <span className="pg-avatar" aria-hidden="true">{initials}</span>
    <div><div className="pg-author"><strong>{displayName}</strong>{!composer && <span>· You</span>}</div>
      {composer ? <span className="pg-audience">Post to anyone <ChevronDown size={12}/></span> : <><span className="pg-profile-title">{title || 'Strategic thinker. Occasional coffee maker.'}</span><small>1h · <Globe2 size={12} aria-label="Public post preview"/></small></>}
    </div>
  </div>;
}

// Feed copy is plain text, as on LinkedIn. Lessons keep their own markdown.
function PostText({text}){
  return String(text).replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*\n]+)\*/g,'$1').split(/(#[\p{L}\p{N}_]+)/gu).map((part,i)=>part.startsWith('#') ? <span className="pg-hashtag" key={i}>{part}</span> : part);
}

export function FeedPost({text, name, title, label = 'Worked example', streaming, onCopy, copied}){
  const [expanded,setExpanded]=useState(false),[overflows,setOverflows]=useState(false),[liked,setLiked]=useState(false),[reposted,setReposted]=useState(false);
  const [menu,setMenu]=useState(false),[commentsOpen,setCommentsOpen]=useState(false),[comment,setComment]=useState(''),[comments,setComments]=useState([]),[status,setStatus]=useState('');
  const body=useRef(null),commentInput=useRef(null),id=useId();
  useLayoutEffect(()=>{
    const el=body.current;if(!el)return;
    const measure=()=>setOverflows(el.scrollHeight>62);
    measure();const observer=new ResizeObserver(measure);observer.observe(el);
    return()=>observer.disconnect();
  },[text]);
  const copy=async()=>{
    try{if(onCopy){if(await onCopy()===false)return;}else await navigator.clipboard.writeText(text || '');setStatus('Post text copied.');}
    catch{setStatus('Select the post text to copy it.');}
    setMenu(false);
  };
  const toggleComments=()=>setCommentsOpen(v=>!v);
  const collapsed=!expanded&&!streaming&&overflows;
  return <section className="pg-feed-wrap" aria-label={label} aria-busy={!!streaming}>
    <div className="pg-feed-label"><span className="pg-eyebrow">{label}</span><span>Practice feed</span></div>
    <article className="pg-feed">
      <div className="pg-feed-head"><Profile name={name} title={title}/><div className="pg-post-menu" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setMenu(false);}} onKeyDown={e=>{if(e.key==='Escape')setMenu(false);}}>
        <button type="button" className="pg-icon-button" aria-label="Post options" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}><MoreHorizontal size={22}/></button>
        {menu && <div className="pg-post-menu-panel"><button type="button" onClick={copy} disabled={streaming}>{copied ? <Check size={16}/> : <Copy size={16}/>}Copy post text</button></div>}
      </div></div>
      <div className={`pg-post${collapsed ? ' is-collapsed' : ''}`}>
        <div ref={body} id={id} className="pg-post-text"><PostText text={text || (streaming ? 'Writing your post…' : '')}/>{streaming && <span className="pg-cursor" aria-hidden="true"/>}</div>
        {collapsed && <button type="button" className="pg-see-more" aria-expanded={false} aria-controls={id} onClick={()=>setExpanded(true)}>…more</button>}
      </div>
      <div className="pg-reactions" aria-label="Simulated engagement"><span><i><ThumbsUp size={10} fill="currentColor"/></i><i><Heart size={10} fill="currentColor"/></i><i><Lightbulb size={10}/></i><span>{liked ? 'You and 48 others' : '48'}</span></span><button type="button" onClick={toggleComments}>{12+comments.length} comments · {2+Number(reposted)} reposts</button></div>
      <div className="pg-feed-actions">
        <button type="button" aria-pressed={liked} onClick={()=>setLiked(v=>!v)}><ThumbsUp fill={liked ? 'currentColor' : 'none'}/><span>Like</span></button>
        <button type="button" aria-expanded={commentsOpen} onClick={toggleComments}><MessageSquare/><span>Comment</span></button>
        <button type="button" aria-pressed={reposted} onClick={()=>{setReposted(v=>!v);setStatus(reposted ? 'Practice repost removed.' : 'Reposted in this practice preview only.');}}><Repeat2/><span>Repost</span></button>
        <button type="button" onClick={copy} disabled={streaming} title="Copy this practice post to send"><Send/><span>Send</span></button>
      </div>
      {commentsOpen && <div className="pg-comments"><p className="pg-simulation-note">Your practice feed. Only you can see this.</p><form onSubmit={e=>{e.preventDefault();if(comment.trim()){setComments(c=>[...c,comment.trim()]);setComment('');commentInput.current?.focus();}}}><span className="pg-avatar pg-avatar-small" aria-hidden="true">{(name||'Y')[0].toUpperCase()}</span><input ref={commentInput} aria-label="Add a practice comment" placeholder="Add a comment…" value={comment} maxLength={500} onChange={e=>setComment(e.target.value)}/><button type="submit" aria-label="Add comment to practice preview" disabled={!comment.trim()}><Send size={17}/></button></form>{comments.map((c,i)=><div className="pg-comment" key={i}><strong>{name || 'You'}</strong><p>{c}</p></div>)}</div>}
    </article>
    <span className="pg-sr-only" role="status">{status}</span>
  </section>;
}
