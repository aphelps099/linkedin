import React from 'react';
import {Disc, Dots, Silhouette, Frame, Spinner} from './icons.jsx';

const AVATAR_BASE = '/films/day-one/avatars/';

export function Avatar({id, size, crops}) {
  if (id === 'silhouette' || !crops[id]) return <span className="av" style={{width:size, height:size}}><Silhouette size={size} /></span>;
  const files = crops[id].files, file = size > 32 && files['144'] ? files['144'] : files['96'];
  return <span className="av" style={{width:size, height:size}}>
    <img src={AVATAR_BASE + file} width={size} height={size} alt="" decoding="sync" />
  </span>;
}

export const Text = ({parts}) => parts.map((p, i) => typeof p === 'string' ? <React.Fragment key={i}>{p}</React.Fragment> : <span key={i} className="mention">{p.mention}</span>);

const FRAMES = {hiring:'hiring', opentowork:'otw'};   // the ring's token

// One comment (or reply): avatar, the grey bubble (name line with time and dots, headline,
// text), and the actions under it. Pitch: 98 px without a headline, 114 with one.
export function Comment({row, crops, reply = false}) {
  const size = reply ? 24 : 32;
  const ring = FRAMES[row.frame];
  return <div className={`c${reply ? ' c-reply' : ''}${row.uniform ? ' c-uniform' : ''}`} data-row={row.n} data-wave={row.wave ?? ''}>
    <span className="c-av" style={{width:size, height:size}}>
      <Avatar id={row.avatar} size={size} crops={crops} />
      {ring && <Frame kind={ring} size={size} />}
    </span>
    <div className="c-main">
      <div className="bubble">
        <div className="c-name">
          <span className="c-who">
            <span className="c-n">{row.name}</span>
            {row.pronouns && <span className="sm"> ({row.pronouns})</span>}
            {row.degree && <span className="sm"> • {row.degree}</span>}
          </span>
          {row.author && <span className="author">Author</span>}
          <span className="c-time">{row.time}</span>
          <Dots className="c-dots" />
        </div>
        {row.headline && <div className="c-headline">{row.headline}</div>}
        <div className="c-text"><Text parts={row.text} /></div>
      </div>
      <div className="c-actions">
        <span>Like</span>
        {row.reactions > 0 && <>
          <span className="mid">·</span>
          <span className="c-reacts">{row.reactTypes.slice(0, row.reactions > 1 ? 2 : 1).map(k => <Disc key={k} kind={k} />)}</span>
          <span className="c-rn">{row.reactions}</span>
        </>}
        <span className="rule" />
        <span>Reply</span>
        {row.replies.length > 0 && <span className="c-replies" data-count={row.replies.length}>
          <span className="mid">·</span>{row.replies.length} {row.replies.length === 1 ? 'reply' : 'replies'}
        </span>}
      </div>
      {row.replies.length > 0 && <div className="c-thread">
        {row.replies.map(r => <Comment key={r.n} row={r} crops={crops} reply />)}
      </div>}
    </div>
  </div>;
}

// "Load more comments": pressed (#EBEBEB, 4 frames), then a spinner for the rest of the beat.
export const LoadMore = () => <div className="load">
  <span className="load-btn"><span className="load-label">Load more comments</span><Spinner /></span>
</div>;
