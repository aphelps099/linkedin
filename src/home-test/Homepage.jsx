import React, {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, LoaderCircle, Pause, Play} from 'lucide-react';
import ConceptHome from '../home-2/ConceptHome.jsx';
import {PocketPlayer} from '../home-experiments/DevelopmentRadio.jsx';
import {PostDemo, CertificateFan} from './PostDemo.jsx';
import '../brand/hoves-black.css';
import './home-test.css';
import './post-demo.css';

function PlaybackIcon({state}) {
  return state.loading ? <LoaderCircle className="c2-spin" aria-hidden="true"/> : state.playing ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>;
}

function SamplerLights({playing}) {
  const ref=useRef(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));
    observer.observe(ref.current);
    return ()=>observer.disconnect();
  },[]);
  return <svg ref={ref} className="test-sampler-lights" viewBox="0 0 1536 1024" aria-hidden="true" data-visible={visible} data-playing={playing}>
    <g className="test-screen-meter" transform="matrix(1 .018 -.12 1 677 248)">
      {Array.from({length:29},(_,i)=><rect key={i} x={i*10} y={-((i*13)%25)} width="5" height={20+(i*13)%25} rx="1" style={{'--delay':`${i*-.17}s`,'--speed':`${1.1+(i%5)*.19}s`}}/>)}
    </g>
    <g className="test-pad-lights" fill="none" stroke="#58ceff" strokeWidth="5">
      {['M224 326L366 330Q378 330 374 346L352 463Q350 478 334 477L198 470Q184 468 188 453L211 340Q214 326 224 326Z',
        'M582 334L726 340Q740 342 736 357L718 478Q716 492 700 491L557 486Q544 484 548 470L569 347Q572 334 582 334Z',
        'M366 504L513 512Q527 514 523 530L500 655Q498 671 482 670L332 660Q320 658 324 643L351 519Q354 504 366 504Z',
        'M744 526L897 535Q912 536 910 550L893 681Q891 696 876 694L720 684Q707 682 710 668L730 541Q732 526 744 526Z'].map((d,i)=><path key={d} d={d} style={{'--delay':`${i*-.8}s`}}/>)}
    </g>
    <g className="test-step-lights" fill="#b5f4ff">
      {[0,1,2,3,4,5,6,7].map(i=><rect key={i} x={154+i*154} y={722+i*16} width="18" height="16" rx="3" style={{'--delay':`${i*-.4}s`}}/>)}
    </g>
  </svg>;
}

function SamplerBeats({base, state, track, onToggle}) {
  return <section className="test-beats" id="c2-player" aria-labelledby="test-beats-title">
    <img className="test-stage" src={`${base}home-test/beats-signal-field.svg`} alt="" width="1600" height="600" loading="lazy"/>
    <div className="test-beats-inner">
      <div className="test-beats-copy">
        <p className="test-eyebrow">The corporate sampler</p>
        <h2 id="test-beats-title">BEATS</h2>
        <p className="test-beats-intro">Corporate jargon. Robot vocals.<br/>Unreasonably good beats.</p>
        <a className="test-outline-button" href={`${base}synth/`}>Open the synth <ArrowUpRight aria-hidden="true"/></a>
        <div className="test-preview-controls">
          <button type="button" onClick={onToggle} aria-pressed={state.playing}>
            <span className="test-play-ring"><PlaybackIcon state={state}/></span>
            {state.loading?'Cancel loading':state.playing?'Pause preview':'Hear a preview'}
          </button>
          <span className="test-preview-track">{track.title}</span>
        </div>
        {state.error && <p className="test-audio-error" role="status">{state.error}</p>}
      </div>
      <div className="test-sampler-stage">
        <a className="test-sampler-link" href={`${base}synth/`} aria-label="Open the CB–08 sampler">
          <img src={`${base}home-test/cb08-metal.webp`} alt="CB–08 sampler in brushed aluminum, with eight pads, metal dials and a glass track display" width="1536" height="1024" loading="lazy" decoding="async"/>
          <SamplerLights playing={state.playing}/>
        </a>
      </div>
    </div>
  </section>;
}

function ListeningCard(props) {
  const {state,onToggle}=props;
  return <section className="lp-studio test-radio-card" aria-labelledby="test-radio-title">
    <span className="lp-pill">Circle Back Radio</span>
    <h2 id="test-radio-title">All business.<br/>No skips.</h2>
    <PocketPlayer {...props} motion={false}/>
    <div className="test-radio-footer">
      <button className="test-outline-button" type="button" onClick={onToggle} aria-pressed={state.playing}>
        <PlaybackIcon state={state}/>{state.loading?'Cancel loading':state.playing?'Pause radio':'Listen now'}
      </button>
      <p>Corporate jargon. On repeat.</p>
    </div>
  </section>;
}

function TestCampaigns(props) {
  return <div id="c2-tools" className="lb-feature-cards test-tools"><div className="lc-pair">
    <PostDemo base={props.base} motion={props.motion}/>
    <ListeningCard {...props}/>
  </div></div>;
}

export default function Homepage({assetBase='/'}) {
  return <div className="home-test"><ConceptHome variant="conversation" assetBase={assetBase} BeatsComponent={SamplerBeats} CampaignsComponent={TestCampaigns} certificateFan={<CertificateFan/>}/></div>;
}
