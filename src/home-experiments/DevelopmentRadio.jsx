import React, {memo, useEffect, useState} from 'react';
import {ArrowUpRight, LoaderCircle, Pause, Play, SkipBack, SkipForward} from 'lucide-react';
import {formatTime} from '../home/tracks.js';

const PocketPlayer=memo(function PocketPlayer(){
  return <div className="development-art" aria-hidden="true">
    <svg className="development-agenda" viewBox="0 0 460 650" focusable="false">
      <path fill="#5486f4" d="M65 12 137 44 399 58 435 183 414 287 450 377 409 471 437 620 307 601 203 640 105 598 16 610 38 467 12 351 45 238 22 115Z"/>
      <path fill="#779ef7" d="m65 12 72 32-42 57-73 14Zm72 32 262 14 36 125-75-54-265-28ZM45 238 12 351l75 42 29-105Zm159 232 103 131-104 39-98-42ZM414 287l36 90-56 41-34-83Z"/>
      <path fill="#3971e5" d="m65 12 30 89 21 187-71-50-23-123Zm51 276-29 105 117 77-72-130Zm278 130 15 53 28 149-130-19-103-131 91 9Z"/>
      <g fill="#123fa5" fontFamily="C2Hoves, Arial, sans-serif" fontSize="17" letterSpacing="2"><text x="145" y="173">ALIGNMENT MEETING</text></g>
      <g stroke="#2459c6" strokeWidth="3" opacity=".65"><path d="M148 210h212M148 245h182M148 280h196M148 315h160M148 350h180"/></g>
    </svg>
    <div className="development-device">
      <svg viewBox="0 0 440 720" focusable="false">
        <rect x="8" y="8" width="424" height="704" rx="43" fill="#d8e2f5"/>
        <rect x="22" y="8" width="410" height="704" rx="40" fill="#fff"/>
        <rect x="55" y="59" width="344" height="335" rx="13" fill="#dce5f4" stroke="#152956" strokeWidth="1.5"/>
        <rect x="146" y="132" width="162" height="162" rx="13" fill="#0b4bef"/>
        <g fill="#fff">
          <circle cx="178" cy="168" r="11"/>
          <path d="M168 189h21v78h-21Zm35 0h20v11c7-10 15-13 26-13 22 0 33 14 33 39v41h-22v-40c0-14-4-20-15-20-12 0-20 8-20 23v37h-22Z"/>
        </g>
        <text x="227" y="336" textAnchor="middle" fill="#142d67" fontFamily="C2Hoves, Arial, sans-serif" fontSize="21" letterSpacing="1">LinkedIn Beats</text>
        <circle cx="227" cy="557" r="133" fill="#eceef3" stroke="#bec6d4" strokeWidth="1"/>
        <circle cx="227" cy="557" r="94" fill="#fff" stroke="#bec6d4" strokeWidth="1"/>
        <circle cx="227" cy="557" r="31" fill="#dce4f3"/>
        <path d="m133 463 27 27m134 134 27 27m0-188-27 27M133 651l27-27" stroke="#bec6d4" fill="none"/>
        <text x="227" y="458" textAnchor="middle" fill="#173369" fontFamily="C2Hoves, Arial, sans-serif" fontSize="20" fontWeight="600">MENU</text>
      </svg>
    </div>
  </div>;
});

export function DevelopmentRadio({base,state,track,seconds,motion,onToggle,onSkip,onSeek}){
  const [scrub,setScrub]=useState(null);
  useEffect(()=>setScrub(null),[track.title]);
  const position=scrub??seconds;
  const commitSeek=value=>{setScrub(null);onSeek(Number(value));};
  return <section className={`development-radio${motion?'':' is-still'}`} id="c2-player" aria-labelledby="development-title">
    <div className="development-inner">
      <div className="development-copy">
        <p className="development-eyebrow">Professional development</p>
        <h2 id="development-title">Professional development.<br/>Questionable lyrics.</h2>
        <p className="development-intro">Build your executive presence through repetitive exposure to synergy, strategic alignment, and a surprisingly good beat.</p>
        <div className="development-transport" role="group" aria-label="LinkedIn Beats music player">
          <div className="development-transport-row">
            <div className="development-buttons">
              <button type="button" aria-label="Previous track or restart" onClick={()=>onSkip('previous')}><SkipBack fill="currentColor"/></button>
              <button type="button" className="development-play" aria-label={state.loading?'Cancel loading':state.playing?'Pause':'Play'} aria-pressed={state.playing} onClick={onToggle}>{state.loading?<LoaderCircle className="c2-spin"/>:state.playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button>
              <button type="button" aria-label="Next track" onClick={()=>onSkip('next')}><SkipForward fill="currentColor"/></button>
            </div>
            <div className="development-track" aria-live="polite" aria-atomic="true"><span>{state.loading?'Tuning in…':state.playing?'Now playing':state.elapsed>0?'Paused':'Ready to play'}</span><strong key={track.title}>{track.title}</strong></div>
            <time className="development-duration" aria-label={`Duration ${formatTime(track.seconds)}`}>{formatTime(track.seconds)}</time>
          </div>
          <input className="development-seek" type="range" aria-label="Track position" aria-valuetext={`${formatTime(position)} of ${formatTime(track.seconds)}`} min="0" max={track.seconds} step="1" value={position} style={{'--progress':`${Math.min(100,position/track.seconds*100)}%`}} onChange={e=>setScrub(Number(e.target.value))} onPointerUp={e=>commitSeek(e.currentTarget.value)} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))commitSeek(e.currentTarget.value);}} onBlur={e=>{if(scrub!==null)commitSeek(e.currentTarget.value);}} onPointerCancel={()=>setScrub(null)}/>
          {state.error&&<p className="development-error" role="alert">{state.error}</p>}
        </div>
        <a className="development-studio" href={`${base}studio/`}>Make your own corporate anthem <ArrowUpRight aria-hidden="true"/></a>
      </div>
      <PocketPlayer/>
    </div>
  </section>;
}
