import React, {memo} from 'react';
import {SynthPreview} from './SynthPreview.jsx';

function PixelArrow() {
  return <svg className="lp-pixel-arrow" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M4 0h10v10h-2V4h-2v2H8v2H6v2H4v2H2v2H0v-2h2v-2h2V8h2V6h2V4h2V2H4Z"/></svg>;
}
export const Campaigns = memo(function Campaigns({base='/'}) {
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
      <span className="lp-pill">THE SYNTH</span>
      <h2 id="lp-studio-title">This meeting<br/>has a beat.</h2>
      <SynthPreview/>
      <a className="lp-enter" href={`${base}synth/`}>Open the synth<PixelArrow/></a>
      <p className="lp-caption">Sequence beats. Sample the team.</p>
    </section>
  </div></div>;
});
