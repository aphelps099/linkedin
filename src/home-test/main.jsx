import React from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUpRight, LoaderCircle, Pause, Play} from 'lucide-react';
import ConceptHome from '../home-2/ConceptHome.jsx';
import {Campaigns} from '../home-2/Campaigns.jsx';
import {PocketPlayer} from '../home-experiments/DevelopmentRadio.jsx';
import '../brand/hoves-black.css';
import './home-test.css';

function PlaybackIcon({state}) {
  return state.loading ? <LoaderCircle className="c2-spin" aria-hidden="true"/> : state.playing ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>;
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
        <p className="test-beats-footnote">Eight pads. Endless alignment.</p>
      </div>
      <div className="test-sampler-stage">
        <a className="test-sampler-link" href={`${base}synth/`} aria-label="Open the CB–08 sampler">
          <img src={`${base}home-test/cb08-metal.webp`} alt="CB–08 sampler in brushed aluminum, with eight pads, metal dials and a glass track display" width="1536" height="1024" loading="lazy" decoding="async"/>
        </a>
        <div className="test-preview-controls">
          <button type="button" onClick={onToggle} aria-pressed={state.playing}>
            <span className="test-play-ring"><PlaybackIcon state={state}/></span>
            {state.loading?'Cancel loading':state.playing?'Pause preview':'Hear a preview'}
          </button>
          <span className="test-preview-track">{track.title}</span>
        </div>
        {state.error && <p className="test-audio-error" role="status">{state.error}</p>}
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
  return <Campaigns base={props.base} listeningCard={<ListeningCard {...props}/>}/>;
}

const assetBase=new URL('../',window.location.href).pathname;
createRoot(document.getElementById('root')).render(<div className="home-test"><ConceptHome variant="conversation" assetBase={assetBase} BeatsComponent={SamplerBeats} CampaignsComponent={TestCampaigns}/></div>);
