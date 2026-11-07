import React from 'react';
import {BarIcon, ComposerIcons, Chevron, PlusIcon, Globe, Dots, Disc, StatusIcons, BackIcon} from './icons.jsx';
import {Avatar, Text} from './Comment.jsx';

// The post card's top half, laid out as LinkedIn lays out a feed post on a phone: the social
// context line, the author lockup, the commentary clamped to three lines with "…more", the
// counts row, an inset hairline and the four-button action bar. Spec 6.
export function Context({who, what}) {
  return <div className="context"><span><b>{who}</b> {what}</span><Dots /></div>;
}

export function Lockup({post, crops}) {
  return <div className="lockup">
    <Avatar id="jamie" size={48} crops={crops} />
    <div className="who">
      <div className="name-line"><span className="n">{post.author}</span>{post.pronouns && <span className="deg"> ({post.pronouns})</span>}<span className="deg"> • {post.degree}</span></div>
      <div className="headline">{post.headline}</div>
      <div className="meta">1d •&nbsp;<Globe /></div>
    </div>
    <span className="follow"><PlusIcon />Follow</span>
  </div>;
}

export function Commentary({post}) {
  return <div className="commentary" data-more>
    <div className="commentary-text"><Text parts={post.text} /></div>
    <span className="more">…more</span>
  </div>;
}

// The counts row: the reaction discs and total on the left, comments and reposts on the right.
// Its numbers are written by seek() (data-n), so the in-card row and the sticky copy agree.
export function CountsRow() {
  return <div className="counts">
    <span className="counts-left"><span className="discs" data-discs><Disc kind="like" /><Disc kind="celebrate" /><Disc kind="love" /></span><span className="react-n" data-n="reactions">47</span></span>
    <span className="counts-right" data-n="right">12 comments</span>
  </div>;
}

export function ActionBar() {
  return <div className="actions">
    {[['like', 'Like'], ['comment', 'Comment'], ['repost', 'Repost'], ['send', 'Send']].map(([k, label]) =>
      <span className="act" key={k}><BarIcon name={k} /><span>{label}</span></span>)}
  </div>;
}

// The comment section's head: the viewer's composer, the suggested replies, the sort control.
export function CommentsHead({post}) {
  return <>
    <div className="composer">
      <Avatar id="silhouette" size={40} crops={{}} />
      <div className="pill"><span>{post.composer_placeholder}</span><ComposerIcons /></div>
    </div>
    <div className="chips">{post.suggested_chips.map(c => <span className="chip" key={c}>{c}</span>)}</div>
    <div className="sort"><span>{post.sort_label}</span><Chevron /></div>
  </>;
}

// The phone's status bar and the app's top bar: a screen recording's frame. Our own drawing: the
// time, signal, Wi-Fi and battery, then a plain back chevron. No app name, no logo, no search.
export function Chrome() {
  return <div className="chrome os" aria-hidden>
    <div className="statusbar"><span className="clock">9:47</span><StatusIcons /></div>
    <div className="topbar"><BackIcon /></div>
    <div className="home-ind" />
  </div>;
}
