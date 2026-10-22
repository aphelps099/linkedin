import React, {useEffect, useRef, useState} from 'react';
import {Pause, Play} from 'lucide-react';
import './synth-preview.css';

const NOTES = [0, 0, 4, 4, 7, 7, 4, 9, 0, 0, 11, 11, 7, 7, 4, 2];
const BLACK_KEYS = [1, 2, 4, 5, 6, 8, 9, 11, 12, 13];
const WAVE = Array.from({length:76}, (_,i) => {
  const envelope = .2 + .8 * Math.sin(i / 75 * Math.PI) ** 2;
  return 5 + Math.abs(Math.sin(i * 1.8) * Math.cos(i * .24)) * 45 * envelope;
});

// A lightweight, silent front-panel demo; the real sampler is loaded on demand.
export function SynthPreview() {
  const root = useRef(null), engine = useRef(null), request = useRef(0);
  const [step, setStep] = useState(0), [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false), [visible, setVisible] = useState(false);
  const [motion, setMotion] = useState(false), [error, setError] = useState('');
  const [animate, setAnimate] = useState(true);
  function stop() {
    request.current++;
    engine.current?.stop();
    setPlaying(false); setBusy(false);
  }
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => setMotion(!mq.matches);
    preference(); mq.addEventListener('change', preference);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {threshold:.1});
    observer.observe(root.current);
    const hidden = () => {if (document.hidden) {stop(); setVisible(false);}};
    const shown = () => {if (!document.hidden) setVisible(!!root.current && root.current.getBoundingClientRect().bottom > 0 && root.current.getBoundingClientRect().top < innerHeight);};
    document.addEventListener('visibilitychange', hidden);
    document.addEventListener('visibilitychange', shown);
    return () => {
      request.current++; observer.disconnect(); mq.removeEventListener('change', preference);
      document.removeEventListener('visibilitychange', hidden); document.removeEventListener('visibilitychange', shown);
      engine.current?.close();
    };
  }, []);
  useEffect(() => {if (!visible) stop();}, [visible]);
  useEffect(() => {
    if (!visible || !motion || !animate || playing) return;
    const id = setInterval(() => setStep(s => (s + 1) % 16), 125);
    return () => clearInterval(id);
  }, [visible, motion, animate, playing]);
  async function audition() {
    if (playing) {stop(); return;}
    const token = ++request.current;
    setBusy(true); setError('');
    try {
      const [{Sampler}, {initialProject}] = await Promise.all([import('../synth/engine.js'), import('../synth/model.js')]);
      if (token !== request.current) return;
      if (!engine.current) engine.current = new Sampler();
      const project = initialProject();
      project.bpm = 120; project.volume = .55; project.delay = .23; project.filter = 6400;
      project.slots[6].gain = .48;
      project.slots[7].mute = true;
      await engine.current.prepare(project);
      if (token !== request.current) {engine.current.stop(); return;}
      engine.current.start(() => project, setStep); setPlaying(true);
    } catch {setError('Preview unavailable. Open the synth to play.');}
    finally {if (token === request.current) setBusy(false);}
  }
  const moving = visible && motion && (animate || playing);
  const shownStep = moving ? step : 0;
  return <div ref={root} className={`sp-preview ${moving?'sp-moving':''} ${playing?'sp-playing':''}`}>
    <a className="sp-art-link" href="/synth/" aria-label="Open the CB–08 synthesizer">
      <div className="sp-machine" aria-hidden="true">
        <div className="sp-topline"><div className="sp-brand">CB–08<span>LINKEDIN BEATS / SAMPLE INSTRUMENT</span></div><div className="sp-power"><i/> POWER</div></div>
        <div className="sp-console">
          <div className="sp-control-bank"><div className="sp-knob-group"><i className="sp-knob sp-knob-large"/><span>MASTER</span></div><div className="sp-small-knobs">{['TONE','ECHO'].map((name,i)=><div className="sp-knob-group" key={name}><i className="sp-knob" style={{'--turn':`${i?30:-35}deg`}}/><span>{name}</span></div>)}</div></div>
          <div className="sp-screen"><div className="sp-screen-top"><span><i/> {playing?'PLAYING':'SEQUENCE / 01'}</span><span>120 <small>BPM</small></span></div><strong>SYNERGY</strong><div className="sp-wave"><svg viewBox="0 0 304 56" preserveAspectRatio="none">{WAVE.map((h,i)=><path key={i} d={`M${i*4+2} ${28-h/2}v${h}`} stroke="currentColor" strokeWidth="2"/>)}</svg><i style={{left:`${shownStep/16*100}%`}}/></div><div className="sp-screen-bottom"><span>CH. 01 / VOICE</span><span>STEP {String(shownStep+1).padStart(2,'0')} : 16</span></div></div>
          <div className="sp-output"><span>LEVEL</span><div className="sp-meters">{[0,1].map(channel=><div key={channel}>{Array.from({length:10},(_,i)=><i key={i} className={i < (moving ? 4+(shownStep*3+channel*2)%7 : 7)?'lit':''}/>)}</div>)}</div><span>L&nbsp;&nbsp;R</span></div>
        </div>
        <div className="sp-sequencer"><span>SEQ</span><div>{Array.from({length:16},(_,i)=><i key={i} className={`${i%4===0?'sp-beat':''} ${shownStep===i?'sp-current':''}`}/>)}</div><span>16</span></div>
        <div className="sp-keybed"><div className="sp-wheels"><i/><i/><span>PITCH<br/>MOD</span></div><div className="sp-keys"><div className="sp-white-keys">{Array.from({length:14},(_,i)=><i key={i} className={NOTES[shownStep]===i?'sp-lit-key':''}><b/></i>)}</div>{BLACK_KEYS.map(i=><i key={i} className="sp-black-key" style={{left:`${i/14*100}%`}}/>)}</div></div>
        <div className="sp-bottomline"><span>POLYPHONIC / STEREO</span><span>BUILT FOR THE AFTER HOURS. ↗</span></div>
        <i className="sp-screw sp-screw-left"/><i className="sp-screw sp-screw-right"/>
      </div>
    </a>
    <div className="sp-preview-controls"><button className="sp-audition" type="button" onClick={audition} disabled={busy} aria-pressed={playing}>{playing?<Pause size={12}/>:<Play size={12}/>} {busy?'Loading…':playing?'Pause sound':'Hear a preview'}</button><button type="button" className="sp-motion-toggle" onClick={()=>{if(playing)stop();setAnimate(a=>!a);}} aria-pressed={animate} hidden={!motion}>{animate?'Pause lights':'Resume lights'}</button></div>
    {error && <p className="sp-error" role="status">{error}</p>}
  </div>;
}
