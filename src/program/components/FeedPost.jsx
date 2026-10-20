import React from 'react';
import {Check, Copy, Globe2, Heart, MessageSquare, Repeat2, Send, ThumbsUp} from 'lucide-react';
import {Markdown} from '../engine/markdown.jsx';

export function Profile({name, title}){
  const displayName = name || 'Your Name';
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  return <div className="pg-profile">
    <span className="pg-avatar" aria-hidden="true">{initials}</span>
    <div><strong>{displayName}</strong><span>{title || 'Strategic thinker. Occasional coffee maker.'}</span><small>Just now · <Globe2 size={11} aria-label="Public post preview"/></small></div>
  </div>;
}

export function FeedPost({text, name, title, label = 'Worked example', streaming, onCopy, copied}){
  return <section className="pg-feed-wrap" aria-label={label} aria-busy={!!streaming}>
    <div className="pg-feed-label"><span className="pg-eyebrow">{label}</span><span>Practice preview</span></div>
    <div className="pg-feed">
      <div className="pg-feed-head"><Profile name={name} title={title}/>{onCopy && <button type="button" className="pg-icon-button" onClick={onCopy} aria-label={copied ? 'Post copied' : 'Copy post'}>{copied ? <Check size={17}/> : <Copy size={17}/>}</button>}</div>
      <div className="pg-post"><Markdown text={text || (streaming ? 'Writing your post…' : '')}/>{streaming && <span className="pg-cursor" aria-hidden="true"/>}</div>
      <div className="pg-reactions" aria-label="Illustrative reactions"><span><i><ThumbsUp size={10}/></i><i><Heart size={10} fill="currentColor"/></i><span>You and 47 others</span></span><span>12 comments</span></div>
      <div className="pg-feed-actions" aria-hidden="true"><span><ThumbsUp/>Like</span><span><MessageSquare/>Comment</span><span><Repeat2/>Repost</span><span><Send/>Send</span></div>
    </div>
  </section>;
}
