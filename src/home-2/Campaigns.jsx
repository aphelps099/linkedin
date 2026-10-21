import React, {memo} from 'react';
import {Mic, PhoneOff, Users, Video} from 'lucide-react';

function PixelArrow() {
  return <svg className="lp-pixel-arrow" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M4 0h10v10h-2V4h-2v2H8v2H6v2H4v2H2v2H0v-2h2v-2h2V8h2V6h2V4h2V2H4Z"/></svg>;
}
export const Campaigns = memo(function Campaigns({base='/'}) {
  const poster = name => `${base}studio/season/posters/${name}-listening.jpg`;
  return <div id="c2-tools" className="lb-feature-cards"><div className="lc-pair">
    <a className="lc-panel" href={`${base}lessons/`} aria-label="Open the LinkedInifier">
      <span className="lc-pill">LINKEDINIFIER</span>
      <h2 id="lc-title">Small news.<br/>Big deal.</h2>
      <p className="lc-description">Turn small news into a stronger LinkedIn post. Boost your post score.</p>
      <div className="lc-scene">
        <img className="lc-robot" src={`${base}home-2/certificate-robot.webp`} width="1774" height="887" alt="" loading="lazy" decoding="async"/>
        <div className="lc-paper">
          <img className="lc-stamp" src={`${base}home-2/approved-stamp.svg`} width="228" height="80" alt="Approved"/>
          <p className="lc-post" aria-live="polite">Humbled to announce:<strong>I made a cup of coffee.</strong></p>
        </div>
      </div>
      <div className="lc-entry"><span className="lc-example">I made coffee.</span><span className="lc-action">LinkedInify<PixelArrow/></span></div>
    </a>
    <section className="lp-studio" aria-labelledby="lp-studio-title">
      <span className="lp-pill">THE STUDIO</span>
      <h2 id="lp-studio-title">This meeting<br/>has a beat.</h2>
      <div className="lp-room" aria-label="Studio preview with Synergy and the band">
        <div className="lp-room-title"><span>SYNERGY &amp; CO.</span><span className="lp-status">STUDIO</span></div>
        <div className="lp-host"><img src={poster('synergy-camera-v2')} alt="Synergy at his desk with coffee" loading="lazy"/><span className="lp-person-label"><Mic aria-hidden="true"/>Synergy · Host</span></div>
        <div className="lp-team">{[['people','People'],['keys-full','Keys'],['strategy','Strategy']].map(([image,name])=><div className="lp-person" key={name}><img src={poster(image)} alt={`${name}, a member of the band`} loading="lazy"/><span className="lp-person-label">{name}</span></div>)}</div>
        <div className="lp-room-controls" aria-hidden="true"><span><Mic/></span><span><Video/></span><span><Users/></span><span className="lp-hangup"><PhoneOff/></span></div>
      </div>
      <a className="lp-enter" href={`${base}synth/`}>Enter the studio<PixelArrow/></a>
      <p className="lp-caption">No agenda. Excellent synergy.</p>
    </section>
  </div></div>;
});
