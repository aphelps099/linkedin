import React from 'react';
import {ThumbsUp, MessageSquareText, Repeat2, Send, Smile, Image, ChevronDown, ChevronLeft, Plus} from 'lucide-react';

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
export const BackIcon = () => <ChevronLeft size={28} strokeWidth={2} />;

// The phone's status bar icons, drawn here: four signal bars, three Wi-Fi arcs, a battery.
export const StatusIcons = () => (
  <svg className="status-icons" width="66" height="12" viewBox="0 0 66 12" aria-hidden>
    <g fill="currentColor">
      <rect x="0" y="8" width="3" height="4" rx=".7" /><rect x="4.5" y="6" width="3" height="6" rx=".7" />
      <rect x="9" y="3.5" width="3" height="8.5" rx=".7" /><rect x="13.5" y="1" width="3" height="11" rx=".7" />
    </g>
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M22.6 4.6a8.4 8.4 0 0 1 11.8 0" /><path d="M24.9 7a5.1 5.1 0 0 1 7.2 0" />
    </g>
    <circle cx="28.5" cy="10.1" r="1.4" fill="currentColor" />
    <rect x="40" y=".75" width="22.5" height="10.5" rx="3" fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth="1" />
    <rect x="42" y="2.75" width="13.4" height="6.5" rx="1.6" fill="currentColor" />
    <path d="M63.8 4.2v3.6c.8-.3 1.3-1 1.3-1.8s-.5-1.5-1.3-1.8z" fill="currentColor" fillOpacity=".4" />
  </svg>
);

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

// White glyphs for the reaction discs, drawn on a 16 px grid, each inside the central 10 px so the
// 4 px overlap of the stack only ever covers a disc's rim.
const GLYPHS = {
  like: <path d="M4.2 7.2h1.9v5.1H4.2zM6.9 7.1l2-3.1c.32-.48 1.04-.3 1.08.27l-.2 2.13h2.1c.62 0 1.07.58.93 1.18l-.72 3.18c-.1.45-.5.76-.96.76H6.9z" fill="#fff" />,
  // Two palms meeting in a shallow V (the moment before a clap), a three-tick burst above them.
  celebrate: <g transform="translate(8 8.4) scale(.82) translate(-8 -8.4)">
    <rect x="4.7" y="5.6" width="3.3" height="7" rx="1.65" fill="#fff" transform="rotate(-24 6.35 9.1)" />
    <rect x="8" y="5.6" width="3.3" height="7" rx="1.65" fill="#fff" stroke="var(--celebrate)" strokeWidth=".7" transform="rotate(22 9.65 9.1)" />
    <path d="M6.1 4.3 5.5 3.1M8.05 3.7V2.4M10 4.3l.6-1.2" stroke="#fff" strokeWidth=".95" strokeLinecap="round" fill="none" />
  </g>,
  love: <path transform="translate(8 8.6) scale(.86) translate(-8 -8.6)" d="M8 12.6 4.1 8.9C2.9 7.7 3 5.9 4.3 5.1c1.1-.7 2.5-.4 3.2.6l.5.6.5-.6c.7-1 2.1-1.3 3.2-.6 1.3.8 1.4 2.6.2 3.8z" fill="#fff" />,
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
    {/* Our own white caps along the band, from 9 to 5 o'clock: at 32 px a speckle with a letter's rhythm, never legible. */}
    <path clipPath={`url(#${id})`} fill="none" stroke="var(--card)" strokeWidth={size * .03} strokeLinecap="butt"
      strokeDasharray={[.9, .55, .6, .55, 1.1, .55, .7, 1.4, .8, .55, .6, .55, 1, .55, .7, .55].map(x => +(x * size / 32).toFixed(3)).join(' ')}
      d={`M${(r - .93 * r * Math.cos(Math.PI * .06)).toFixed(3)},${(r + .93 * r * Math.sin(Math.PI * .06)).toFixed(3)}A${(.93 * r).toFixed(3)},${(.93 * r).toFixed(3)} 0 0 0 ${(r + .93 * r * Math.cos(Math.PI * .3)).toFixed(3)},${(r + .93 * r * Math.sin(Math.PI * .3)).toFixed(3)}`} />
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
