import React from 'react';
import { Unit } from './components/chassis/Unit.jsx';
import { Masthead } from './components/chassis/Masthead.jsx';
import { Ticker } from './components/chassis/Ticker.jsx';
import { Bay } from './components/chassis/Bay.jsx';
import { Silk } from './components/chassis/Silk.jsx';
import { Readout } from './components/chassis/Readout.jsx';
import { Stamp } from './components/chassis/Stamp.jsx';
import { Button } from './components/controls/Button.jsx';
import { Knob } from './components/controls/Knob.jsx';
import { Kbd } from './components/controls/Kbd.jsx';
import { Pad, KeyPlate } from './components/pads/Pad.jsx';
import { StepGrid } from './components/sequencer/StepGrid.jsx';
import { CBAudio, CBVoice } from './audio.js';

const PHRASES = [
  {code:'TH', name:'Thrilled', say:"I'm thrilled to announce"},
  {code:'HU', name:'Humbled', say:'Humbled and honored to share'},
  {code:'HA', name:'Happy to share', say:"I'm happy to share that I'm starting a new position"},
  {code:'RE', name:'Reflection', say:"After careful reflection, I've decided to pursue new opportunities"},
  {code:'SY', name:'Synergy', say:'Synergy'},
  {code:'CB', name:'Circle back', say:"Let's circle back"},
  {code:'LV', name:'Leverage', say:'Leverage'},
  {code:'PV', name:'Pivot', say:'Pivot'},
  {code:'NX', name:'Not X, but Y', say:"It's not about the tools. It's about the mindset."},
  {code:'DL', name:'Delve', say:'Delve'},
  {code:'TA', name:'Tapestry', say:'A rich tapestry'},
  {code:'GC', name:'Game-changer', say:'Game-changer'},
  {code:'T?', name:'Thoughts?', say:'Thoughts?'},
  {code:'AG', name:'Agree?', say:'Agree or disagree?'},
  {code:'SI', name:'Sink in', say:'Let that sink in'},
  {code:'FS', name:'Full stop', say:'Full stop.'},
];
const KEYMAP = '1234qwerasdfzxcv';
const DRUMS = [
  {name:'Kick', id:'kick'},{name:'Snare', id:'snare'},{name:'Clap', id:'clap'},{name:'Cl. hat', id:'ch'},
  {name:'Op. hat', id:'oh'},{name:'Shaker', id:'shk'},{name:'Cowbell', id:'cow'},{name:'Zap', id:'zap'},
];
const VOICES = [...DRUMS.map(d=>({name:d.name})), {name:'Vox', vox:true}];
const STEPS = 16, VOXROW = DRUMS.length;
const seedPattern = () => {
  const p = VOICES.map(()=> Array(STEPS).fill(0));
  const put = (i, arr, acc=[]) => arr.forEach(s=> p[i][s] = acc.includes(s) ? 2 : 1);
  put(0,[0,3,8,10],[0,8]); put(1,[4,12],[4,12]); put(2,[12]);
  put(3,[0,2,4,6,8,10,12,14],[0,8]); put(4,[7,15]); put(5,[3,7,11,15]);
  p[VOXROW][0] = 2; p[VOXROW][6] = 6; p[VOXROW][12] = 16; // HU, CB, FS (phrase idx+1)
  return p;
};

export default function CircleBack(){
  const [pattern, setPattern] = React.useState(seedPattern);
  const [armed, setArmed] = React.useState(1);
  const [ticker, setTicker] = React.useState('Press a key to opine');
  const [playing, setPlaying] = React.useState(false);
  const [rec, setRec] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const [tempo, setTempo] = React.useState(96);
  const [sinc, setSinc] = React.useState(.12);
  const [deliv, setDeliv] = React.useState(.5);
  const [selRow, setSelRow] = React.useState(0);
  // mutable mirror of state for the scheduler loop (avoids stale closures)
  const ref = React.useRef({}); Object.assign(ref.current, {pattern, armed, tempo, sinc, deliv, rec, playing});
  const speak = React.useCallback((i)=>{
    const r = ref.current;
    CBVoice.speak(PHRASES[i].say, {pitch:.4 + r.sinc*1.4, rate:.6 + r.deliv*.8});
    setTicker(PHRASES[i].say);
  },[]);
  const pressKey = React.useCallback((i)=>{
    setArmed(i); speak(i);
    const r = ref.current;
    if(r.rec && r.playing && r.lastStep !== undefined){
      const p = r.pattern.map(x=>[...x]); p[VOXROW][r.lastStep] = i+1; setPattern(p);
    }
  },[speak]);
  // lookahead scheduler: 25ms interval, schedules a 120ms horizon against the AudioContext clock
  React.useEffect(()=>{
    if(!playing){ setPos(null); return; }
    const A = CBAudio; A.init(); A.resume();
    let step = 0, nextTime = A.now() + .06, timers = [];
    const iv = setInterval(()=>{
      const r = ref.current;
      while(nextTime < A.now() + .12){
        const s = step, t = nextTime;
        DRUMS.forEach((d,i)=>{ const v = r.pattern[i][s]; if(v) A.trigger(d.id, v===2?1:.72, t); });
        const vx = r.pattern[VOXROW][s];
        const ms = Math.max(0,(t - A.now())*1000);
        timers.push(setTimeout(()=>{ ref.current.lastStep = s; setPos(s); if(vx) speak(vx-1); }, ms));
        nextTime += 60/r.tempo/4;
        step = (s+1)%STEPS;
      }
    }, 25);
    return ()=>{ clearInterval(iv); timers.forEach(clearTimeout); };
  },[playing, speak]);
  React.useEffect(()=>{
    const down = e=>{
      if(e.metaKey||e.ctrlKey||e.altKey) return;
      if(e.code==='Space'){ e.preventDefault(); setPlaying(x=>!x); return; }
      const k = KEYMAP.indexOf(e.key.toLowerCase());
      if(k>=0 && !e.repeat){ e.preventDefault(); pressKey(k); }
    };
    window.addEventListener('keydown', down);
    return ()=> window.removeEventListener('keydown', down);
  },[pressKey]);
  const onGrid = p => {
    const q = p.map(r=>[...r]);
    for(let s=0;s<STEPS;s++) if(q[VOXROW][s]===-1) q[VOXROW][s] = ref.current.armed+1;
    setPattern(q);
  };
  const voxLabels = VOICES.map((v,i)=> v.vox ? pattern[i].map(x=> x>0 ? PHRASES[x-1].code : null) : null);
  return <Unit>
    <Masthead meta={["Form CB-16","Rev. 2026-08","For internal thought leadership only"]}/>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:30}}>
      <h1 style={{margin:'26px 0 0',fontSize:64,lineHeight:.94,letterSpacing:'-.045em',fontWeight:700,color:'var(--blue)'}}>The professional<br/>phrase organ.</h1>
      <p style={{margin:0,fontSize:15,lineHeight:1.45,maxWidth:380}}>Sixteen keys of fluent LinkedIn, spoken in time over a live drum machine. <b style={{color:'var(--blue)'}}>It’s not an instrument. It’s a journey.</b></p>
    </div>
    <Ticker style={{marginTop:24}}>{ticker}</Ticker>
    <div style={{display:'grid',gridTemplateColumns:'250px 1fr 230px',gap:'var(--space-col)',marginTop:'var(--space-section)'}}>
      <Bay title="Phrase index" aside="01–16">
        {PHRASES.map((p,i)=>
          <div key={i} onClick={()=>pressKey(i)} style={{display:'flex',gap:12,fontSize:11.5,lineHeight:1.9,borderBottom:'1px dotted var(--hair)',cursor:'pointer',fontWeight:armed===i?700:400,color:armed===i?'var(--blue)':'var(--ink)'}}>
            <Readout style={{lineHeight:'1.9em',fontSize:10.5}}>{String(i+1).padStart(2,'0')}</Readout>
            <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.say}</span>
          </div>)}
      </Bay>
      <Bay title="Keys" aside="Press to opine">
        <KeyPlate columns={4}>
          {PHRASES.map((p,i)=>
            <Pad key={i} index={String(i+1).padStart(2,'0')} name={p.name} hot={armed===i} onTrigger={()=>pressKey(i)}/>)}
        </KeyPlate>
        <p style={{margin:'10px 0 0',fontSize:10.5,color:'var(--text-meta)'}}>Keys <Kbd>1</Kbd>–<Kbd>4</Kbd> <Kbd>Q</Kbd>–<Kbd>R</Kbd> <Kbd>A</Kbd>–<Kbd>F</Kbd> <Kbd>Z</Kbd>–<Kbd>V</Kbd> speak · <Kbd>space</Kbd> starts the meeting</p>
      </Bay>
      <Bay title="Registers" aside="Cal. A">
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <Knob label="Sincerity" value={sinc} onChange={setSinc}/>
          <Knob label="Delivery" value={deliv} onChange={setDeliv}/>
          <Knob label="Tempo" value={(tempo-60)/140} onChange={v=>setTempo(Math.round(60+v*140))} format={()=>tempo+' BPM'}/>
        </div>
      </Bay>
    </div>
    <Bay title="Sequencer · 16 steps" aside={<Readout>{pos===null?'—':String(pos+1).padStart(2,'0')}</Readout>} style={{marginTop:'var(--space-section)'}}>
      <StepGrid voices={VOICES} pattern={pattern} onChange={onGrid} playhead={pos} selected={selRow} onSelect={setSelRow} voxLabels={voxLabels}/>
      <div style={{display:'flex',gap:9,alignItems:'center',marginTop:16,flexWrap:'wrap'}}>
        <Button on={playing} onClick={()=>setPlaying(x=>!x)}>{playing?'Adjourn':'Convene'}</Button>
        <Button variant="rec" on={rec} onClick={()=>setRec(x=>!x)}>Minute-take</Button>
        <Button onClick={()=>setPattern(seedPattern())}>Load agenda</Button>
        <Button onClick={()=>setPattern(VOICES.map(()=>Array(STEPS).fill(0)))}>Table it</Button>
        <span style={{marginLeft:'auto'}}><Silk muted>Vox cells stamp the armed phrase · drums cycle hit / accent</Silk></span>
      </div>
    </Bay>
    <div style={{marginTop:26,borderTop:'var(--rule-heavy) solid var(--ink)',paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <Silk muted>An equal opportunity instrument</Silk>
      <Silk muted>Circle Back® is not affiliated with your network</Silk>
      <Stamp>Approved — HR</Stamp>
    </div>
  </Unit>;
}
