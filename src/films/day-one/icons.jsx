import React from 'react';
import {ThumbsUp, MessageSquareText, Repeat2, Send, Smile, Image, ChevronDown, Plus} from 'lucide-react';

// Our own icons. None of LinkedIn's artwork is shipped: the action bar uses lucide's generic
// strokes, and the reaction discs, globe, dots and spinner are drawn here from plain shapes.
// Colours come from the tokens in day-one.css (currentColor wherever a token applies).

export const BAR_ICONS = {like:ThumbsUp, comment:MessageSquareText, repost:Repeat2, send:Send};
export function BarIcon({name}) {
  const I = BAR_ICONS[name];
  return <I size={24} strokeWidth={1.75} absoluteStrokeWidth={false} aria-hidden />;
}
export const ComposerIcons = () => <span className="pill-tools"><Smile size={20} strokeWidth={1.75} /><Image size={20} strokeWidth={1.75} /></span>;
export const Chevron = () => <ChevronDown size={16} strokeWidth={2} />;
export const PlusIcon = () => <Plus size={16} strokeWidth={2.25} />;

// A small filled globe ("visible to anyone"), 12 px.
export const Globe = () => (
  <svg className="globe" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
    <circle cx="6" cy="6" r="5.1" fill="none" stroke="currentColor" strokeWidth="1.1" />
    <ellipse cx="6" cy="6" rx="2.2" ry="5.1" fill="none" stroke="currentColor" strokeWidth="1" />
    <path d="M1.2 4.4h9.6M1.2 7.6h9.6" fill="none" stroke="currentColor" strokeWidth="1" />
  </svg>
);

// Three 3 px dots.
export const Dots = ({className = 'dots'}) => (
  <span className={className} aria-hidden><i /><i /><i /></span>
);

// White glyphs for the reaction discs, drawn on a 16 px grid.
const GLYPHS = {
  like: <path d="M4.2 7.2h1.9v5.1H4.2zM6.9 7.1l2-3.1c.32-.48 1.04-.3 1.08.27l-.2 2.13h2.1c.62 0 1.07.58.93 1.18l-.72 3.18c-.1.45-.5.76-.96.76H6.9z" fill="#fff" />,
  celebrate: <g fill="#fff">
    <path d="M5.2 12.4 3.9 9.1a.75.75 0 0 1 1.38-.58l.62 1.4-.95-3.3a.72.72 0 0 1 1.38-.4l.74 2.4-.2-3.1a.72.72 0 0 1 1.43-.12l.44 3.05.2-2.15a.7.7 0 0 1 1.39.12l-.1 3.6c-.05 1.7-1.3 2.95-2.95 2.95-.94 0-1.72-.4-2.08-1z" />
    <path d="M10.6 3.4l.5-1.1M12.2 4.6l1.1-.4M11.9 6.4h1.1" stroke="#fff" strokeWidth=".9" strokeLinecap="round" />
  </g>,
  love: <path d="M8 12.6 4.1 8.9C2.9 7.7 3 5.9 4.3 5.1c1.1-.7 2.5-.4 3.2.6l.5.6.5-.6c.7-1 2.1-1.3 3.2-.6 1.3.8 1.4 2.6.2 3.8z" fill="#fff" />,
  insightful: <g fill="#fff">
    <path d="M8 3.2a3.4 3.4 0 0 0-2 6.15V10.6h4V9.35A3.4 3.4 0 0 0 8 3.2z" />
    <rect x="6.3" y="11.2" width="3.4" height="1.5" rx=".5" />
  </g>,
};
export function Disc({kind}) {
  return <span className={`disc disc-${kind}`} aria-hidden>
    <svg width="16" height="16" viewBox="0 0 16 16">{GLYPHS[kind]}</svg>
  </span>;
}

// LinkedIn's default avatar, as many real profiles show it: a plain silhouette on a warm grey.
export const Silhouette = ({size}) => (
  <svg className="silhouette" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <circle cx="16" cy="16" r="16" fill="var(--sil-ground)" />
    <clipPath id={`sil-${size}`}><circle cx="16" cy="16" r="16" /></clipPath>
    <g clipPath={`url(#sil-${size})`}>
      <ellipse cx="16" cy="32.2" rx="11.6" ry="10.2" fill="var(--sil-fig)" />
      <circle cx="16" cy="13.2" r="6.1" fill="var(--sil-shade)" />
    </g>
  </svg>
);

// The open-to-work and hiring frames: a crescent band 14% of the diameter at 7:30,
// tapering to nothing at 12 and 3 o'clock (the inner circle passes through those points).
export const Frame = ({kind, size}) => {
  const r = size / 2, c = .1193 * r, ri = .8888 * r, id = `fr-${kind}-${size}`;
  return <svg className={`frame frame-${kind}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
    <clipPath id={id}><circle cx={r} cy={r} r={r} /></clipPath>
    <path clipPath={`url(#${id})`} fillRule="evenodd" fill={`var(--${kind})`}
      d={`M${r},0a${r},${r} 0 1 0 .0001,0z M${r + c},${r - c - ri}a${ri},${ri} 0 1 0 .0001,0z`} />
  </svg>;
};

// A 20 px spinner: a blue arc over a hairline track, turned by the clock.
export const Spinner = ({angle = 0}) => (
  <svg className="spinner" width="20" height="20" viewBox="0 0 20 20" aria-hidden>
    <circle cx="10" cy="10" r="8" fill="none" stroke="var(--hair)" strokeWidth="2.5" />
    <g transform={`rotate(${angle} 10 10)`}>
      <path d="M10 2a8 8 0 0 1 8 8" fill="none" stroke="var(--link)" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  </svg>
);
