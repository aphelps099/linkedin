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
import { Monitor } from './components/broadcast/Monitor.jsx';
import { CBAudio, CBVoice } from './audio.js';
import { VIDEO_MIMES, AUDIO_MIMES, pickMime, extFor, downloadBlob, mp4Support, startMp4Capture } from './exporter.js';
import { randomPattern } from './randomizer.js';
import { randomComment } from './feed.js';

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
  // extended bank — no pads of their own; reachable from the phrase index and the Reorg
  {code:'EX', name:'Excited', say:"I'm excited to share…"},
  {code:'RA', name:'Read again', say:'Read that again.'},
  {code:'HL', name:'Learned', say:"Here's what I learned. 👇"},
  {code:'CE', name:'Changed', say:'This changed everything for me.'},
  {code:'MP', name:'Most people', say:"Most people won't understand this. But you will."},
  {code:'XY', name:'X vs Y', say:"It's not about X. It's about Y."},
  {code:'NB', name:'Nobody else', say:"I'll say what nobody else will…"},
  {code:'SM', name:'Small moment', say:'A small moment that taught me a big lesson.'},
  {code:'NF', name:'Never forget', say:"And then he said something I'll never forget."},
  {code:'RH', name:'History', say:'The rest is history.'},
  {code:'GR', name:'Grateful', say:'Grateful for this incredible journey.'},
  {code:'AT', name:'Amazing team', say:"Couldn't have done it without my amazing team."},
  {code:'OU', name:'Onwards', say:'Onwards and upwards! 🚀'},
  {code:'DJ', name:'Delighted', say:'Delighted to have joined…'},
  {code:'FP', name:'Fast-paced', say:"In today's fast-paced world…"},
  {code:'PI', name:'Intersection', say:'Passionate about driving impact at the intersection of…'},
  {code:'JC', name:'A calling', say:'Not just a job — a calling.'},
  {code:'HT', name:'Hot take', say:'Hot take: teamwork makes a difference.'},
  {code:'UO', name:'Unpopular', say:'Unpopular opinion: Fridays are great.'},
  {code:'CS', name:'Synergies', say:"Let's connect and explore synergies."},
  {code:'DC', name:'Drop a comment', say:'What do you think? Drop a comment below. 👇'},
];
const KEYMAP = '1234qwetasdfzxcv'; // R is reserved: it calls a reorg (randomize)
const DRUMS = [
  {name:'Kick', id:'kick'},{name:'Snare', id:'snare'},{name:'Clap', id:'clap'},{name:'Cl. hat', id:'ch'},
  {name:'Op. hat', id:'oh'},{name:'Shaker', id:'shk'},{name:'Cowbell', id:'cow'},{name:'Zap', id:'zap'},
];
const DEFAULT_LEN = 32, MAX_SAMPLES = 5;
const voxRowOf = samples => DRUMS.length + samples.length;
const emptyPattern = (n, len=DEFAULT_LEN) => Array(DRUMS.length + n + 1).fill(0).map(()=> Array(len).fill(0));
// the sample mix: the classic 16-step agenda, tiled across the meeting
const seedPattern = (n, len=DEFAULT_LEN) => {
  const p = emptyPattern(n, len);
  const put = (i, arr, acc=[]) => arr.forEach(s=>{ for(let o=s;o<len;o+=16) p[i][o] = acc.includes(s) ? 2 : 1; });
  put(0,[0,3,8,10],[0,8]); put(1,[4,12],[4,12]); put(2,[12]);
  put(3,[0,2,4,6,8,10,12,14],[0,8]); put(4,[7,15]); put(5,[3,7,11,15]);
  const vr = DRUMS.length + n;
  // phrases get the longer runway: HU opens, CB mid-meeting, MP closes the second bar
  p[vr][0] = 2; p[vr][10] = 6;
  if(len >= 32){ p[vr][16] = 21; p[vr][28] = 16; } else p[vr][12] = 16;
  return p;
};
const exhibitLetter = i => String.fromCharCode(65+i);

export default function CircleBack(){
  const [rack, setRack] = React.useState(()=>({samples:[], pattern:seedPattern(0)}));
  const [armed, setArmed] = React.useState(1);
  const [ticker, setTicker] = React.useState('Sample mix loaded — press Play');
  const [playing, setPlaying] = React.useState(false);
  const [rec, setRec] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const [tempo, setTempo] = React.useState(96);
  const [sinc, setSinc] = React.useState(.12);
  const [deliv, setDeliv] = React.useState(.5);
  const [decay, setDecay] = React.useState(.5);
  const [selRow, setSelRow] = React.useState(0);
  const [loops, setLoops] = React.useState(4); // 4 cycles of 32 steps ≈ 20s at 96 BPM
  const [studio, setStudio] = React.useState(false);
  const [exp, setExp] = React.useState(null);   // {mode, total, done}
  const [take, setTake] = React.useState(null); // {url, name, mode}
  const bufRef = React.useRef(new Map());       // sample id -> AudioBuffer
  const expRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const fileRef = React.useRef(null);

  const patLen = rack.pattern[0].length;
  const voxRow = voxRowOf(rack.samples);
  const VOICES = [
    ...DRUMS.map(d=>({name:d.name})),
    ...rack.samples.map((s,i)=>({name:`Exh. ${exhibitLetter(i)}`})),
    {name:'Vox', vox:true},
  ];
  const voxCodes = rack.pattern[voxRow].map(x=> x>0 ? PHRASES[x-1].code : null);

  // mutable mirror of state for the scheduler + monitor render loops (avoids stale closures).
  // Imperative fields (lastStep, phraseAt, lastKeyAt, spoken, stepCount, comments, eng,
  // exportStartedAt, sceneDur) live on ref.current directly and are NOT overwritten here.
  const ref = React.useRef({});
  Object.assign(ref.current, {
    pattern: rack.pattern, samples: rack.samples, voxRow, patLen, armed, tempo, sinc, deliv, decay, rec, playing,
    pos, tickerText: ticker, voices: VOICES, voxCodes, exporting: !!exp, phrases: PHRASES,
  });

  React.useEffect(()=>{
    CBVoice.loadBank(`${import.meta.env.BASE_URL}phrases/`, PHRASES.length).catch(()=>{});
  },[]);

  const speak = React.useCallback((i)=>{
    const r = ref.current;
    CBVoice.speakPhrase(i, PHRASES[i].say, r.sinc, r.deliv, r.decay);
    r.spoken = true; r.phraseAt = performance.now();
    setTicker(PHRASES[i].say);
  },[]);
  const pressKey = React.useCallback((i)=>{
    ref.current.lastKeyAt = performance.now();
    setArmed(i); speak(i);
    const r = ref.current;
    if(r.rec && r.playing && r.lastStep !== undefined){
      setRack(rk=>{
        const p = rk.pattern.map(x=>[...x]);
        p[voxRowOf(rk.samples)][r.lastStep] = i+1;
        return {...rk, pattern:p};
      });
    }
  },[speak]);

  const finishExport = React.useCallback(()=>{
    const ex = expRef.current;
    if(!ex || ex.finishing) return;
    ex.finishing = true;
    const stepMs = 60000/ref.current.tempo/4;
    setTimeout(()=>{
      expRef.current = null;
      if(ex.finish) ex.finish(false).catch(e=> console.warn('export finish', e));
      setExp(null); setPlaying(false);
    }, stepMs + 300);
  },[]);

  // lookahead scheduler: 25ms interval, schedules a 120ms horizon against the AudioContext clock
  React.useEffect(()=>{
    if(!playing){ setPos(null); return; }
    const A = CBAudio; A.init(); A.resume();
    // every convene is a fresh post: engagement builds from zero
    ref.current.stepCount = 0;
    ref.current.comments = [];
    ref.current.eng = {reactions:0, reposts:0, comments:0, nextAt: 6 + Math.floor(Math.random()*6)};
    let step = 0, nextTime = A.now() + .06, timers = [];
    const iv = setInterval(()=>{
      const r = ref.current;
      while(nextTime < A.now() + .12){
        const s = step, t = nextTime;
        const ex = expRef.current;
        if(ex && !ex.started && s===0){
          ex.started = true;
          try{ ex.beginCapture(); ref.current.exportStartedAt = performance.now(); }catch(e){}
        }
        DRUMS.forEach((d,i)=>{ const v = r.pattern[i][s]; if(v) A.trigger(d.id, v===2?1:.72, t); });
        r.samples.forEach((sm,ix)=>{
          const v = r.pattern[DRUMS.length+ix][s];
          if(v){ const b = bufRef.current.get(sm.id); if(b) A.playBuffer(b, {vel:v===2?1:.72, when:t}); }
        });
        const vx = r.pattern[r.voxRow][s];
        const ms = Math.max(0,(t - A.now())*1000);
        timers.push(setTimeout(()=>{
          const rr = ref.current;
          rr.lastStep = s; setPos(s);
          if(vx) speak(vx-1);
          // the algorithm at work: reactions tick up, comments roll in
          rr.stepCount++;
          const eng = rr.eng;
          if(eng){
            eng.reactions += Math.floor(Math.random()*8);
            if(Math.random() < .06) eng.reposts++;
            if(rr.stepCount >= eng.nextAt){
              eng.nextAt = rr.stepCount + 8 + Math.floor(Math.random()*10);
              eng.comments++;
              rr.comments.push({...randomComment(), at: performance.now()});
              if(rr.comments.length > 6) rr.comments.shift();
            }
          }
          const e2 = expRef.current;
          if(e2 && e2.started && !e2.finishing){
            e2.remaining--;
            setExp(x=> x && {...x, done: x.total - e2.remaining});
            if(e2.remaining <= 0) finishExport();
          }
        }, ms));
        nextTime += 60/r.tempo/4;
        step = (s+1)%r.patLen;
      }
    }, 25);
    return ()=>{
      clearInterval(iv); timers.forEach(clearTimeout);
      const ex = expRef.current;
      if(ex && !ex.finishing){ // playback adjourned mid-take: the take is stricken from the record
        expRef.current = null;
        if(ex.finish) ex.finish(true).catch(()=>{});
        setExp(null);
      }
    };
  },[playing, speak, finishExport]);

  const doReorg = React.useCallback(()=>{
    const { pattern, style } = randomPattern(ref.current.samples.length, PHRASES, ref.current.patLen);
    setRack(rk=> voxRowOf(rk.samples)+1 === pattern.length ? {...rk, pattern} : rk);
    ref.current.spoken = true; ref.current.phraseAt = performance.now();
    setTicker(`Reorg complete — ${style} cadence adopted`);
  },[]);

  const setSteps = n => setRack(rk=>{
    const cur = rk.pattern[0].length;
    if(n === cur) return rk;
    const pattern = rk.pattern.map(row=>{
      const out = Array(n).fill(0);
      for(let s=0;s<n;s++) out[s] = s < cur ? row[s] : row[s % cur]; // extend by tiling, shrink by truncating
      return out;
    });
    return {...rk, pattern};
  });

  React.useEffect(()=>{
    const down = e=>{
      if(e.metaKey||e.ctrlKey||e.altKey) return;
      if(e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if(e.code==='Space'){ e.preventDefault(); setPlaying(x=>!x); return; }
      if(e.shiftKey && e.key.startsWith('Arrow')){
        e.preventDefault();
        const step = .05;
        if(e.key==='ArrowUp') setDeliv(v=> Math.min(1, v+step));
        else if(e.key==='ArrowDown') setDeliv(v=> Math.max(0, v-step));
        else if(e.key==='ArrowRight') setSinc(v=> Math.min(1, v+step));
        else if(e.key==='ArrowLeft') setSinc(v=> Math.max(0, v-step));
        return;
      }
      if(e.key.toLowerCase()==='r' && !e.repeat){ e.preventDefault(); doReorg(); return; }
      const k = KEYMAP.indexOf(e.key.toLowerCase());
      if(k>=0 && !e.repeat){ e.preventDefault(); pressKey(k); }
    };
    window.addEventListener('keydown', down);
    return ()=> window.removeEventListener('keydown', down);
  },[pressKey, doReorg]);

  const onGrid = p => {
    const vr = ref.current.voxRow;
    const q = p.map(r=>[...r]);
    for(let s=0;s<q[vr].length;s++) if(q[vr][s]===-1) q[vr][s] = ref.current.armed+1;
    setRack(rk=>({...rk, pattern:q}));
  };

  const addExhibits = async files => {
    for(const f of Array.from(files)){
      if(ref.current.samples.length >= MAX_SAMPLES){ setTicker('The record is full.'); break; }
      try{
        const buf = await CBAudio.decode(await f.arrayBuffer());
        const id = (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2);
        bufRef.current.set(id, buf);
        setRack(rk=>{
          if(rk.samples.length >= MAX_SAMPLES) return rk;
          const pattern = rk.pattern.map(x=>[...x]);
          pattern.splice(voxRowOf(rk.samples), 0, Array(rk.pattern[0].length).fill(0));
          const name = f.name.replace(/\.[^.]+$/,'');
          return {samples:[...rk.samples, {id, name}], pattern};
        });
        setTicker(`Exhibit admitted — ${f.name}`);
      }catch(e){ setTicker('Exhibit rejected — unreadable format'); }
    }
  };
  const removeExhibit = id => {
    bufRef.current.delete(id);
    setRack(rk=>{
      const ix = rk.samples.findIndex(s=>s.id===id);
      if(ix<0) return rk;
      const pattern = rk.pattern.map(x=>[...x]);
      pattern.splice(DRUMS.length+ix, 1);
      return {samples: rk.samples.filter(s=>s.id!==id), pattern};
    });
    setSelRow(0);
  };
  const audition = id => { const b = bufRef.current.get(id); if(b) CBAudio.playBuffer(b, {vel:1}); };

  const startExport = async mode => {
    if(expRef.current) return;
    CBAudio.init(); CBAudio.resume();
    const totalSteps = loops * ref.current.patLen;
    const ex = {remaining: totalSteps, started:false, finishing:false, discard:false, mode};
    if(mode==='video' && canvasRef.current && await mp4Support(CBAudio.sampleRate())){
      // real H.264 + AAC mp4 via WebCodecs — plays everywhere the feed does
      const name = 'thought-leadership.mp4';
      ex.beginCapture = ()=>{
        ex.capture = startMp4Capture({canvas: canvasRef.current, audioTrack: CBAudio.audioTrack(), sampleRate: CBAudio.sampleRate()});
      };
      ex.finish = async discard => {
        const blob = ex.capture ? await ex.capture.stop(discard) : null;
        if(blob && !discard){
          const url = downloadBlob(blob, name);
          setTake(prev=>{ if(prev) URL.revokeObjectURL(prev.url); return {url, name, mode}; });
          setTicker('Clip circulated to your downloads.');
        }
      };
    } else {
      const mime = pickMime(mode==='video' ? VIDEO_MIMES : AUDIO_MIMES);
      if(!mime || typeof MediaRecorder === 'undefined'){ setTicker('This browser declines to be recorded.'); return; }
      const audioTracks = CBAudio.stream().getAudioTracks();
      let stream;
      if(mode==='video'){
        const cv = canvasRef.current; if(!cv) return;
        stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...audioTracks]);
      } else {
        stream = new MediaStream(audioTracks);
      }
      const recorder = new MediaRecorder(stream, {mimeType:mime, videoBitsPerSecond:8_000_000, audioBitsPerSecond:192_000});
      const chunks = [];
      const ext = extFor(mime);
      const name = mode==='video' ? `thought-leadership.${ext}` : `thought-leadership-audio.${ext}`;
      recorder.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        if(ex.discard || !chunks.length) return;
        const blob = new Blob(chunks, {type:mime});
        const url = downloadBlob(blob, name);
        setTake(prev=>{ if(prev) URL.revokeObjectURL(prev.url); return {url, name, mode}; });
        setTicker('Clip circulated to your downloads.');
      };
      ex.beginCapture = ()=> recorder.start();
      ex.finish = async discard => {
        ex.discard = !!discard;
        try{ if(recorder.state !== 'inactive') recorder.stop(); }catch(e){}
      };
    }
    expRef.current = ex;
    // director's run of show: cut between closeup scenes so every take shows
    // the phrase, the pads, the mix, the grid, and the comments
    const totalSec = totalSteps*(60/ref.current.tempo/4);
    ref.current.sceneDur = Math.min(5, Math.max(2.5, totalSec/5));
    ref.current.exportStartedAt = performance.now();
    setExp({mode, total: totalSteps, done:0});
    if(ref.current.playing){ setPlaying(false); setTimeout(()=> setPlaying(true), 60); }
    else setPlaying(true);
  };

  const voxLabels = VOICES.map((v)=> v.vox ? voxCodes : null);
  return <Unit>
    <Masthead meta={["Form CB-16","Rev. 2026-08","For internal thought leadership only"]}/>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:30,marginTop:18}}>
      <h1 style={{margin:0,fontSize:40,lineHeight:.96,letterSpacing:'-.045em',fontWeight:700,color:'var(--blue)'}}>The professional phrase organ.</h1>
      <p style={{margin:0,fontSize:13,lineHeight:1.45,maxWidth:400}}>The LinkedIn remixer — corporate phrases, spoken in time over a live drum machine. <b style={{color:'var(--blue)'}}>It’s not an instrument. It’s a journey.</b></p>
    </div>
    <Ticker style={{marginTop:16}}>{ticker}</Ticker>

    {/* the broadcast — front and center, sample mix loaded */}
    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 280px',gap:'var(--space-col)',alignItems:'start',marginTop:16}}>
      <Monitor ref={canvasRef} stateRef={ref}/>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <Button style={{padding:'14px 20px'}} onClick={()=>{ doReorg(); setPlaying(true); }}>▶ Play a random mix</Button>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <Button on={playing} onClick={()=>setPlaying(x=>!x)}>{playing?'Pause':'Play'}</Button>
          <Button onClick={doReorg}>New beat (R)</Button>
        </div>
        <div>
          <div style={{marginBottom:6}}><Silk>Run of show</Silk>{' '}<Readout style={{marginLeft:8}}>≈ {Math.round(loops*patLen*(60/tempo/4))}s</Readout></div>
          <div style={{display:'flex',gap:6}}>
            {[2,4,8].map(n=>
              <Button key={n} on={loops===n} onClick={()=>setLoops(n)} style={{padding:'7px 11px'}}>{n} loops</Button>)}
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <Button variant="rec" on={exp?.mode==='video'} onClick={()=>startExport('video')}>Export video (mp4)</Button>
          <Button variant="rec" on={exp?.mode==='audio'} onClick={()=>startExport('audio')}>Export audio</Button>
        </div>
        <div><Silk>Status</Silk>{' '}<Readout style={{marginLeft:8}}>{exp ? `ON THE RECORD ${String(Math.min(exp.done,exp.total)).padStart(2,'0')}/${exp.total}` : take ? 'CLEARED FOR THE FEED' : '—'}</Readout></div>
        {take && (take.mode==='video'
          ? <video controls src={take.url} style={{width:'100%',border:'var(--rule-frame) solid var(--ink)',display:'block'}}/>
          : <audio controls src={take.url} style={{width:'100%',display:'block'}}/>)}
        {take && <a href={take.url} download={take.name} style={{fontFamily:'var(--mono)',fontSize:10.5,color:'var(--blue)'}}>Download again — {take.name}</a>}
        <Silk muted>Exports tape the monitor — the phrase, the pads, the mix, the grid, the comments — into a square clip for your LinkedIn feed.</Silk>
      </div>
    </div>

    {/* the studio, filed under separate cover */}
    <div style={{marginTop:22,borderTop:'var(--rule-section) solid var(--ink)',paddingTop:12,display:'flex',alignItems:'center',gap:12}}>
      <Button onClick={()=>setStudio(x=>!x)}>{studio ? 'Close the audio tools' : 'Open the audio tools'}</Button>
      <Silk muted>{studio ? 'The studio is in session' : 'Make your own LinkedIn remix — keys, registers, sequencer, uploads'}</Silk>
    </div>

    {studio && <>
    <div style={{display:'grid',gridTemplateColumns:'200px 1fr 230px',gap:'var(--space-col)',marginTop:'var(--space-section)'}}>
      <Bay title="Phrase index" aside={`01–${String(PHRASES.length).padStart(2,'0')}`}>
        <div style={{maxHeight:600,overflowY:'auto'}}>
          {PHRASES.map((p,i)=>
            <div key={i} onClick={()=>pressKey(i)} style={{display:'flex',gap:12,fontSize:11.5,lineHeight:1.9,borderBottom:'1px dotted var(--hair)',cursor:'pointer',fontWeight:armed===i?700:400,color:armed===i?'var(--blue)':'var(--ink)'}}>
              <Readout style={{lineHeight:'1.9em',fontSize:10.5}}>{String(i+1).padStart(2,'0')}</Readout>
              <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.say}</span>
            </div>)}
        </div>
      </Bay>
      <Bay title="Keys" aside="Press to opine">
        <KeyPlate columns={4}>
          {PHRASES.slice(0,16).map((p,i)=>
            <Pad key={i} index={String(i+1).padStart(2,'0')} hotkey={KEYMAP[i].toUpperCase()} name={p.name} hot={armed===i} onTrigger={()=>pressKey(i)}/>)}
        </KeyPlate>
        <p style={{margin:'10px 0 0',fontSize:10.5,color:'var(--text-meta)'}}>Type the letter shown on each key to speak it · <Kbd>R</Kbd> new random beat · <Kbd>space</Kbd> play/pause · <Kbd>⇧</Kbd><Kbd>↑</Kbd>/<Kbd>↓</Kbd> delivery · <Kbd>⇧</Kbd><Kbd>←</Kbd>/<Kbd>→</Kbd> sincerity</p>
      </Bay>
      <Bay title="Registers" aside="Cal. A">
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <Knob label="Sincerity" value={sinc} onChange={setSinc}/>
          <Knob label="Delivery" value={deliv} onChange={setDeliv}/>
          <Knob label="Decay" value={decay} onChange={setDecay}/>
          <Knob label="Tempo" value={(tempo-60)/140} onChange={v=>setTempo(Math.round(60+v*140))} format={()=>tempo+' BPM'}/>
        </div>
      </Bay>
    </div>
    <Bay title={`Sequencer · ${patLen} steps`} aside={<Readout>{pos===null?'—':String(pos+1).padStart(2,'0')}</Readout>} style={{marginTop:'var(--space-section)'}}>
      <StepGrid voices={VOICES} steps={patLen} pattern={rack.pattern} onChange={onGrid} playhead={pos} selected={selRow} onSelect={setSelRow}
        onClearRow={i=> setRack(rk=>{ const pattern = rk.pattern.map(x=>[...x]); pattern[i] = Array(rk.pattern[i].length).fill(0); return {...rk, pattern}; })}
        voxLabels={voxLabels}/>
      <div style={{display:'flex',gap:9,alignItems:'center',marginTop:16,flexWrap:'wrap'}}>
        <Button on={playing} onClick={()=>setPlaying(x=>!x)}>{playing?'Pause':'Play'}</Button>
        <Button variant="rec" on={rec} onClick={()=>setRec(x=>!x)}>{rec?'Recording keys':'Record keys'}</Button>
        <Button onClick={doReorg}>Random beat</Button>
        <Button onClick={()=>setRack(rk=>({...rk, pattern:seedPattern(rk.samples.length, rk.pattern[0].length)}))}>Demo beat</Button>
        <Button onClick={()=>setRack(rk=>({...rk, pattern:emptyPattern(rk.samples.length, rk.pattern[0].length)}))}>Clear all</Button>
        <span style={{display:'inline-flex',gap:6,alignItems:'center',marginLeft:6}}>
          <Silk>Steps</Silk>
          {[16,32,48].map(n=>
            <Button key={n} on={patLen===n} onClick={()=>setSteps(n)} style={{padding:'7px 10px'}}>{n}</Button>)}
        </span>
        <span style={{marginLeft:'auto'}}><Silk muted>Longer meetings give long phrases room to land · double-click a track name to clear it</Silk></span>
      </div>
      <div style={{display:'flex',gap:9,alignItems:'center',marginTop:12,flexWrap:'wrap',borderTop:'1px dotted var(--hair)',paddingTop:12}}>
        <Silk>Exhibits</Silk>
        {rack.samples.map((s,i)=>
          <span key={s.id} style={{display:'inline-flex',alignItems:'center',gap:7,border:'var(--rule-frame) solid var(--ink)',background:'var(--white)',padding:'5px 8px'}}>
            <span onClick={()=>audition(s.id)} role="button" style={{cursor:'pointer',color:'var(--blue)',fontFamily:'var(--mono)',fontSize:10.5}}>▸</span>
            <span style={{fontFamily:'var(--mono)',fontSize:9.5,letterSpacing:'.08em',textTransform:'uppercase',maxWidth:130,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{exhibitLetter(i)} · {s.name}</span>
            <span onClick={()=>removeExhibit(s.id)} role="button" aria-label={`Strike exhibit ${exhibitLetter(i)}`} style={{cursor:'pointer',fontFamily:'var(--mono)',fontSize:10.5}}>×</span>
          </span>)}
        <Button onClick={()=>fileRef.current && fileRef.current.click()}>Upload sound</Button>
        <input ref={fileRef} type="file" accept="audio/*" multiple style={{display:'none'}}
          onChange={e=>{ addExhibits(e.target.files); e.target.value=''; }}/>
        <span style={{marginLeft:'auto'}}><Silk muted>Audio admitted into the record becomes a sequencer row</Silk></span>
      </div>
    </Bay>
    </>}

    <div style={{marginTop:26,borderTop:'var(--rule-heavy) solid var(--ink)',paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <Silk muted>An equal opportunity instrument</Silk>
      <Silk muted>Circle Back® is not affiliated with your network</Silk>
      <Stamp>Approved — HR</Stamp>
    </div>
  </Unit>;
}
