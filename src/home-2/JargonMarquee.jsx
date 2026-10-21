import React, {memo, useState} from 'react';
import {ArrowUpRight, Pause, Play} from 'lucide-react';
import './marquee.css';

const PHRASES = ['Corporate jargon. Actual bangers.', 'Circle back', 'Synergy', 'Per my last email', 'Thrilled to announce'];

export const JargonMarquee = memo(function JargonMarquee({base}) {
  const [paused, setPaused] = useState(false);
  return <aside className={`c2-marquee ${paused ? 'is-paused' : ''}`} aria-label="Corporate jargon. Actual bangers.">
    <div className="c2-container c2-marquee-inner">
      <span className="c2-marquee-slash" aria-hidden="true"/>
      <div className="c2-marquee-window" aria-hidden="true">
        <div className="c2-marquee-track">
          {[0, 1].map(copy => <div className="c2-marquee-group" key={copy}>
            {PHRASES.map(phrase => <React.Fragment key={phrase}><span>{phrase}</span><b>✳</b></React.Fragment>)}
          </div>)}
        </div>
      </div>
      <button type="button" className="c2-marquee-pause" aria-label={paused ? 'Resume marquee' : 'Pause marquee'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
        {paused ? <Play aria-hidden="true"/> : <Pause aria-hidden="true"/>}
      </button>
      <a className="c2-marquee-link" href={`${base}synth/`}>Make a beat <ArrowUpRight aria-hidden="true"/></a>
    </div>
  </aside>;
});
