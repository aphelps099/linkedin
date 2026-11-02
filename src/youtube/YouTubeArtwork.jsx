import React from 'react';
import {Play} from 'lucide-react';
import {thumbnailFor} from './feed.js';
import './youtube.css';

export function YouTubeArtwork({item}) {
  return <div className={`yt-art yt-art--${item.kind}`} aria-hidden="true">
    <div className="yt-image"><img src={thumbnailFor(item)} alt="" loading="lazy" decoding="async" onError={event=>{event.currentTarget.style.visibility='hidden';}}/></div>
    <span className="yt-format">{item.kind==='short'?'Short':'YouTube'}</span><span className="yt-play"><Play fill="currentColor"/></span>
  </div>;
}
