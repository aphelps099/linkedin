import React from 'react';
import { ChevronRight, Settings, Shuffle, X } from 'lucide-react';
import { Unit } from './components/chassis/Unit.jsx';
import { Masthead } from './components/chassis/Masthead.jsx';
import { Ticker } from './components/chassis/Ticker.jsx';
import { Bay } from './components/chassis/Bay.jsx';
import { Silk } from './components/chassis/Silk.jsx';
import { Readout } from './components/chassis/Readout.jsx';
import { Stamp } from './components/chassis/Stamp.jsx';
import { Button } from './components/controls/Button.jsx';
import { Knob } from './components/controls/Knob.jsx';
import { Scrubber } from './components/controls/Scrubber.jsx';
import { Kbd } from './components/controls/Kbd.jsx';
import { Pad, KeyPlate } from './components/pads/Pad.jsx';
import { StepGrid } from './components/sequencer/StepGrid.jsx';
import { Monitor } from './components/broadcast/Monitor.jsx';
import { StageKey } from './components/stage/StageKey.jsx';
import { Backdrop } from './components/stage/Backdrop.jsx';
import { ArrowKey } from './components/stage/ArrowKey.jsx';
import { CommentCards } from './components/stage/CommentCards.jsx';
import { RemixPanel } from './components/remix/RemixPanel.jsx';
import { analyze, optimize } from './remix.js';
import { CBAudio, CBVoice, CHARACTERS, exposeVoice } from './audio.js';
import { VIDEO_MIMES, AUDIO_MIMES, pickMime, extFor, downloadBlob, mp4Support, startMp4Capture } from './exporter.js';
import { randomPattern } from './randomizer.js';
import { randomComment } from './feed.js';
import { makeSong, bandAt } from './song.js';
import { requestRemixVoiceClip } from './voice.js';
import { StudioDesk } from './studio/StudioDesk.jsx';
import { StudioControls } from './studio/StudioControls.jsx';
import { RacingHeader,RacingConsole } from './studio-3/RacingStage.jsx';
import { ConceptFooter } from './home-2/ConceptFooter.jsx';
import { GROOVES, createGroove, grooveMidi } from './studio/grooves.js';

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
  // the optimizer's vocabulary — short lingo the machine can actually say,
  // which is what lets a rewritten post survive into the exported video
  {code:'BN', name:'Big news', say:'Big news.'},
  {code:'PN', name:'Personal news', say:'Some personal news.'},
  {code:'QU', name:'Quick update', say:'A quick update.'},
  {code:'JX', name:'Journey continues', say:'The journey continues.'},
  {code:'LL', name:'Lessons', say:'Lessons learned.'},
  {code:'TK', name:'Takeaway', say:"Here's the takeaway."},
  {code:'JG', name:'Just started', say:"We're just getting started."},
  {code:'MC', name:'More to come', say:'More to come.'},
  {code:'ST', name:'Stay tuned', say:'Stay tuned.'},
  {code:'PT', name:'Proud team', say:'Proud of this team.'},
  {code:'MU', name:'Milestone', say:'Milestone unlocked.'},
  {code:'TP', name:'Personal one', say:"This one's personal."},
  {code:'LB', name:"Let's build", say:"Let's build."},
  {code:'WS', name:'Watch this space', say:'Watch this space.'},
  {code:'ND', name:'Numbers', say:"The numbers don't lie."},
  {code:'XB', name:'Execution', say:'Execution beats strategy.'},
  {code:'CU', name:'Culture', say:'Culture is everything.'},
  {code:'FB', name:'Feedback', say:'Feedback is a gift.'},
  {code:'FD', name:'Failure', say:'Failure is just data.'},
  {code:'MO', name:'Momentum', say:'Momentum compounds.'},
];
const KEYMAP = '1234qwetasdfzxcv'; // studio only — on stage, 1/2/3 are the instrument
const REMIX_MAX_RUNTIME_MS = 30_000;
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
  // phrases get a wide berth in the sample mix — short lines, far apart
  const vr = DRUMS.length + n;
  p[vr][0] = 2;                                  // Humbled
  if(len >= 32) p[vr][16] = 6;                   // Circle back
  if(len >= 48) p[vr][32] = 16;                  // Full stop.
  return p;
};
// A locked Vox row stays empty: the beat plays, and phrases only happen when
// you press a key. Nothing loops a phrase at you.
const applyVoxLock = (pattern, nSamples, locked) => {
  if(!locked) return pattern;
  const p = pattern.map(r=>[...r]);
  p[DRUMS.length + nSamples] = Array(p[0].length).fill(0);
  return p;
};
const exhibitLetter = i => String.fromCharCode(65+i);
const SECTIONS = ['Groove', 'Build', 'Drop'];

// narrow-viewport flag for the inline-styled design system (media queries can't reach inline styles)
function useNarrow(bp = 760){
  const [narrow, setNarrow] = React.useState(()=> typeof window !== 'undefined' && window.matchMedia(`(max-width:${bp}px)`).matches);
  React.useEffect(()=>{
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const fn = e => setNarrow(e.matches);
    if(mq.addEventListener) mq.addEventListener('change', fn); else mq.addListener(fn);
    return ()=>{ if(mq.removeEventListener) mq.removeEventListener('change', fn); else mq.removeListener(fn); };
  },[bp]);
  return narrow;
}

export default function CircleBack({stagePreview=false,racingPreview=false}){
  const [initialGroove] = React.useState(()=>createGroove('reply-all'));
  const [grooveId,setGrooveId] = React.useState('reply-all');
  const [advanced,setAdvanced] = React.useState(false);
  const [mix,setMix] = React.useState({drums:.85,bass:.8,music:.7,vox:1});
  const [muted,setMuted] = React.useState({});
  const [masterVolume,setMasterVolume] = React.useState(.8);
  const [voxLocked, setVoxLocked] = React.useState(true);
  const [rack, setRack] = React.useState(()=>({samples:[], pattern:initialGroove.pattern}));
  const [song, setSong] = React.useState(()=>initialGroove.song);
  const [armed, setArmed] = React.useState(1);
  const [ticker, setTicker] = React.useState('Reply-All Disco loaded — press play, then hit a phrase pad');
  const [playing, setPlaying] = React.useState(false);
  const [rec, setRec] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const [energy, setEnergy] = React.useState(0);
  const [tempo, setTempo] = React.useState(initialGroove.bpm);
  const [sinc, setSinc] = React.useState(.12);
  const [deliv, setDeliv] = React.useState(.5);
  const [decay, setDecay] = React.useState(.5);
  const [weird, setWeird] = React.useState(.15);
  const [dist, setDist] = React.useState(.12);
  const [pitch, setPitch] = React.useState(.8); // 0..1 → −8..+2 semitones
  const [character, setCharacter] = React.useState('boardroom');
  const [selRow, setSelRow] = React.useState(0);
  const [loops, setLoops] = React.useState(4);
  const [studio, setStudio] = React.useState(!stagePreview);
  const [audioDrawer, setAudioDrawer] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [band, setBand] = React.useState(true);
  const [remixOpen, setRemixOpen] = React.useState(false);
  const [remix, setRemix] = React.useState(null);
  const [handoff, setHandoff] = React.useState(''); // post handed over from LinkedIn Lessons
  const [exp, setExp] = React.useState(null);   // {mode, total, done}
  const [take, setTake] = React.useState(null); // {url, name, mode}
  const bufRef = React.useRef(new Map());       // sample id -> AudioBuffer
  const expRef = React.useRef(null);
  const voiceJobRef = React.useRef(null);
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
  // Imperative fields (lastStep, lastStepAt, phraseAt, lastKeyAt, spoken, stepCount,
  // comments, eng, exportStartedAt, sceneDur, setlistIx, dropAt) live on ref.current
  // directly and are NOT overwritten here.
  const ref = React.useRef({setlistIx:0});
  Object.assign(ref.current, {
    pattern: rack.pattern, samples: rack.samples, voxRow, patLen, armed, tempo, sinc, deliv, decay, rec, playing,
    pos, tickerText: ticker, voices: VOICES, voxCodes, exporting: !!exp, phrases: PHRASES,
    song, energy, section: SECTIONS[energy], studio, band, remix, voxLocked,
    glass: !studio, stagePreview, racingPreview,
  });

  React.useEffect(()=>{
    CBVoice.loadBank(new URL('../phrases/', window.location.href).href, PHRASES.length).catch(()=>{});
    exposeVoice();
    if(typeof window !== 'undefined') window.CBState = ref.current; // on-device debugging
  },[]);
  React.useEffect(()=>{
    for(const [channel,value] of Object.entries(mix)) CBAudio.setChannelGain(channel,muted[channel]?0:value);
    CBAudio.setVolume(masterVolume);
    CBVoice.volume=(muted.vox?0:mix.vox)*masterVolume;
    if(CBVoice.volume===0 && typeof speechSynthesis!=='undefined') speechSynthesis.cancel();
  },[mix,muted,masterVolume]);
  React.useEffect(()=>{ CBAudio.setVoxDelay(60/tempo/4*3); },[tempo]);
  React.useEffect(()=>{ CBAudio.setVoxFx({weird, dist, character}); },[weird, dist, character]);
  React.useEffect(()=>{ CBVoice.pitch = Math.round(-8 + pitch * 10); },[pitch]);
  React.useEffect(()=>{
    const close = e=>{
      if(e.key !== 'Escape') return;
      setAudioDrawer(false);
      setAboutOpen(false);
    };
    window.addEventListener('keydown', close);
    return ()=>window.removeEventListener('keydown', close);
  },[]);

  // mobile audio: unlock/resume inside every real gesture (capture phase runs
  // in the same tap stack, before React handlers) — also re-resumes the
  // context after iOS interruptions like calls or backgrounding
  React.useEffect(()=>{
    const u = ()=> CBAudio.unlock();
    window.addEventListener('pointerdown', u, true);
    window.addEventListener('keydown', u, true);
    window.addEventListener('touchend', u, true);
    return ()=>{
      window.removeEventListener('pointerdown', u, true);
      window.removeEventListener('keydown', u, true);
      window.removeEventListener('touchend', u, true);
    };
  },[]);

  React.useEffect(()=>()=> voiceJobRef.current?.controller?.abort('unmounted'), []);

  // The machine speaks the jargon; when a remix is loaded, the screen shows the
  // author's own line instead — their words, our voice.
  const speak = React.useCallback((i, display, buffer, voiceRole)=>{
    const r = ref.current;
    CBVoice.speakPhrase(i, display || PHRASES[i].say, r.sinc, r.deliv, r.decay, buffer, voiceRole);
    r.spoken = true; r.phraseAt = performance.now();
    setTicker(display || PHRASES[i].say);
  },[]);
  const speakOverRemix = React.useCallback((i, step)=>{
    const r = ref.current;
    if(r.remixSequence && r.remixSequence.length){
      const item = r.remixSequence[r.remixSequenceIx % r.remixSequence.length];
      r.remixSequenceIx++;
      speak(item.phrase, item.text, item.buffer, item.voiceRole);
      return;
    }
    const line = r.remixByStep && r.remixByStep[step];
    const buffer = r.remixAudioByStep && r.remixAudioByStep[step];
    speak(i, line, buffer);
  },[speak]);
  const speakNextShowLine = React.useCallback(()=>{
    const r = ref.current;
    if(r.remixSequence && r.remixSequence.length){
      if(r.remixSequenceIx >= r.remixSequence.length){
        if(!expRef.current){
          setTicker('Remix complete — compliance filing closed.');
          setPlaying(false);
        }
        return;
      }
      const item = r.remixSequence[r.remixSequenceIx];
      r.remixSequenceIx++;
      speak(item.phrase, item.text, item.buffer, item.voiceRole);
      return;
    }
    const list = r.song.setlist;
    const i = list[(r.setlistIx || 0) % list.length];
    r.setlistIx = (r.setlistIx || 0) + 1;
    speak(i);
  },[speak]);

  // A remix is a finite performance, not an ambient subscription service.
  // Sequence completion normally stops it first; this cap catches timing or
  // scheduler failures without interrupting fixed-duration exports.
  React.useEffect(()=>{
    if(!playing || !ref.current.remixSequence?.length) return;
    const timer = setTimeout(()=>{
      if(expRef.current) return;
      setTicker('Remix complete — 30-second filing limit reached.');
      setPlaying(false);
    }, REMIX_MAX_RUNTIME_MS);
    return ()=>clearTimeout(timer);
  },[playing]);
  const pressKey = React.useCallback((i)=>{
    CBAudio.unlock();
    ref.current.lastKeyAt = performance.now();
    setArmed(i); speak(i);
    const r = ref.current;
    if(r.rec && r.playing && !r.voxLocked && r.lastStep !== undefined){
      setRack(rk=>{
        const p = rk.pattern.map(x=>[...x]);
        p[voxRowOf(rk.samples)][r.lastStep] = i+1;
        return {...rk, pattern:p};
      });
    }
  },[speak]);

  // stage gestures land on the grid: fire on the next 16th so nothing is ever off-beat
  const quantize = React.useCallback(fn=>{
    const r = ref.current;
    if(!r.playing || !r.lastStepAt){ fn(); return; }
    const stepMs = 60000/r.tempo/4;
    const wait = stepMs - ((performance.now() - r.lastStepAt) % stepMs);
    if(wait < 24 || wait > stepMs) fn(); else setTimeout(fn, wait);
  },[]);

  const setEnergyLevel = React.useCallback((lvl, options)=>{
    CBAudio.unlock();
    setEnergy(lvl);
    ref.current.energy = lvl;
    const stepSec = 60/ref.current.tempo/4;
    if(lvl === 0){ CBAudio.setFilter(18000); }
    else if(lvl === 1){
      CBAudio.setFilter(700);                     // duck the room…
      CBAudio.setFilter(9000, stepSec*12);        // …and open it over three beats
      CBAudio.trigger('riser', .8, undefined, {dur: stepSec*12});
    } else {
      CBAudio.setFilter(20000);                   // slam open
      CBAudio.trigger('impact', 1);
      ref.current.dropAt = ref.current.stepCount || 0;
      if(!options || options.speakHook !== false) quantize(()=> speak(ref.current.song.hook));
    }
  },[quantize, speak]);

  const firePhrase = React.useCallback(()=>{
    CBAudio.unlock();
    const r = ref.current;
    const list = r.song.setlist;
    const i = list[(r.setlistIx || 0) % list.length];
    r.setlistIx = (r.setlistIx || 0) + 1;
    r.lastKeyAt = performance.now();
    setArmed(i);
    quantize(()=>{
      speak(i);
      if(r.rec && r.playing && !r.voxLocked && r.lastStep !== undefined){
        setRack(rk=>{
          const p = rk.pattern.map(x=>[...x]);
          p[voxRowOf(rk.samples)][r.lastStep] = i+1;
          return {...rk, pattern:p};
        });
      }
    });
  },[quantize, speak]);

  // every fifth push forward raises the room on its own — the build arrives
  // without anyone having to know there is a build
  const stepPhrase = React.useCallback(dir => {
    CBAudio.unlock();
    const r = ref.current;
    const next = (r.armed + dir + PHRASES.length) % PHRASES.length;
    r.lastKeyAt = performance.now();
    setArmed(next);
    quantize(()=> speak(next));
    if(dir > 0){
      r.forward = (r.forward || 0) + 1;
      if(r.forward % 5 === 0) setEnergyLevel(r.energy === 2 ? 2 : 1);
    }
  },[quantize, speak, setEnergyLevel]);

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
    ref.current.setlistIx = 0;
    ref.current.remixSequenceIx = 0;
    ref.current.lastKeyAt = 0;
    ref.current.comments = [];
    ref.current.eng = {reactions:0, reposts:0, comments:0, nextAt: 6 + Math.floor(Math.random()*6)};
    let step = 0, nextTime = A.now() + .06, timers = [];
    const iv = setInterval(()=>{
      const r = ref.current;
      while(nextTime < A.now() + .12){
        const s = step, t = nextTime;
        const ex = expRef.current;
        if(ex && !ex.started && s===0){
          ex.started = true; ex.arming = false;
          try{ ex.beginCapture(); ref.current.exportStartedAt = performance.now(); }catch(e){}
        }
        DRUMS.forEach((d,i)=>{ const v = r.pattern[i][s]; if(v) A.trigger(d.id, v===2?1:.72, t); });
        // the band — bass always, arps on build, stabs and sub on the drop
        if(r.band) bandAt(r.song, s, r.energy).forEach(e=>
          A.trigger(e.v, e.vel, t, {freq:e.freq, freqs:e.freqs, dur:e.dur, up:e.up}));
        // build energy adds double-time hats and a snare roll into the drop
        if(r.energy >= 1 && s % 2 === 1) A.trigger('ch', .4, t);
        if(r.energy >= 1 && s >= 12 && s % 16 >= 12) A.trigger('snare', .3 + (s%16-12)*.14, t);
        r.samples.forEach((sm,ix)=>{
          const v = r.pattern[DRUMS.length+ix][s];
          if(v){ const b = bufRef.current.get(sm.id); if(b) A.playBuffer(b, {vel:v===2?1:.72, when:t}); }
        });
        const vx = r.pattern[r.voxRow][s];
        const ms = Math.max(0,(t - A.now())*1000);
        timers.push(setTimeout(()=>{
          const rr = ref.current;
          rr.lastStep = s; rr.lastStepAt = performance.now();
          rr.kickAt = rr.pattern[0][s] ? performance.now() : rr.kickAt;
          setPos(s);
          const manualIdle = !rr.lastKeyAt || performance.now() - rr.lastKeyAt > 6500;
          // Remix lines advance every six beats so the whole filing lands in
          // roughly 24 seconds; library tracks keep their roomier arrangement.
          const actLength = rr.remixSequence?.length ? 24 : Math.max(16, rr.patLen);
          const showStep = rr.stepCount % (actLength * 4);
          const act = Math.floor(showStep / actLength);
          const actOpening = showStep % actLength === 0;
          if(rr.studio){
            if(vx) speakOverRemix(vx-1, s);
          } else if(manualIdle && actOpening){
            // Play means "run the show": Groove → Groove → Build → Drop.
            // Each act advances the post by one line. A manual phrase control
            // pauses the director briefly rather than fighting the performer.
            if(act === 0) setEnergyLevel(0);
            if(act === 2) setEnergyLevel(1);
            if(act === 3) setEnergyLevel(2, {speakHook:false});
            speakNextShowLine();
          }
          // the algorithm at work: reactions tick up, comments roll in
          rr.stepCount++;
          const eng = rr.eng;
          if(eng){
            eng.reactions += 1 + Math.floor(Math.random()*(2 + rr.energy*7));
            if(Math.random() < .06 + rr.energy*.05) eng.reposts++;
            if(rr.stepCount >= eng.nextAt){
              eng.nextAt = rr.stepCount + 8 + Math.floor(Math.random()*10);
              eng.comments++;
              rr.comments.push({...randomComment(), at: performance.now()});
              if(rr.comments.length > 6) rr.comments.shift();
            }
          }
          // the drop is a moment, not a mode — it settles back into the groove
          if(rr.energy === 2 && rr.stepCount - (rr.dropAt||0) >= 32) setEnergyLevel(0);
          const e2 = expRef.current;
          if(e2 && e2.started && !e2.finishing){
            e2.remaining--;
            setExp(x=> x && {...x, done: x.total - e2.remaining});
            if(e2.remaining <= 0) finishExport();
          }
        }, ms));
        nextTime += 60/r.tempo/4 * (1 + (s%2?-1:1)*(r.song.swing||0));
        step = (s+1)%r.patLen;
      }
    }, 25);
    return ()=>{
      clearInterval(iv); timers.forEach(clearTimeout);
      const ex = expRef.current;
      // An arming take is mid-handover: startExport bounces playback so the
      // recording can begin cleanly at step 0. Only a genuine stop discards it.
      if(ex && !ex.finishing && !ex.arming){
        expRef.current = null;
        if(ex.finish) ex.finish(true).catch(()=>{});
        setExp(null);
      }
    };
  },[playing, speakOverRemix, speakNextShowLine, finishExport, setEnergyLevel]);

  const newTrack = React.useCallback(()=>{
    setGrooveId(null);
    const s = makeSong();
    const r = ref.current;
    const { pattern, style } = randomPattern(
      r.samples.length, PHRASES, r.patLen,
      60/r.tempo/4,
      i => CBVoice.durationOf(i, PHRASES[i].say, r.deliv),
    );
    setSong(s); ref.current.song = s; ref.current.setlistIx = 0;
    setRack(rk=> voxRowOf(rk.samples)+1 === pattern.length
      ? {...rk, pattern: applyVoxLock(pattern, rk.samples.length, r.voxLocked)} : rk);
    ref.current.spoken = true; ref.current.phraseAt = performance.now();
    setTicker(`${s.name} — ${style} cadence`);
  },[]);

  const loadGroove = React.useCallback(id=>{
    CBAudio.unlock();
    const r=ref.current, g=createGroove(id,r.samples.length);
    setGrooveId(g.id);setTempo(g.bpm);setSong(g.song);setBand(true);
    r.song=g.song;r.tempo=g.bpm;r.setlistIx=0;
    setRack(rk=>{
      const next=createGroove(id,rk.samples.length).pattern;
      // Keep uploaded sample and vocal programming when changing the backing groove.
      for(let row=DRUMS.length;row<next.length;row++){
        if(row===next.length-1&&r.voxLocked)continue;
        const previous=rk.pattern[row];if(previous)next[row]=next[row].map((_,i)=>previous[i%previous.length]);
      }
      return {...rk,pattern:next};
    });
    setTicker(`${g.song.name} — ${g.bpm} BPM. Press a phrase pad to join in.`);
  },[]);
  const exportMidi=()=>{
    const data=grooveMidi({song,pattern:rack.pattern,tempo});
    const name=`circle-back-${grooveId||'custom-groove'}-${tempo}bpm.mid`;
    const url=downloadBlob(new Blob([data],{type:'audio/midi'}),name);
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    setTicker('Groove MIDI downloaded — drums, bass, chords and arp.');
  };

  // Build the remix as call-and-response: concise post facts alternate with
  // short corporate commands. Phrase-bank indices remain attached for fallback.
  const buildRemix = React.useCallback(async text=>{
    CBAudio.unlock();
    if(voiceJobRef.current?.controller) voiceJobRef.current.controller.abort('replaced');
    const rx = analyze(text || '');
    if(!rx.lines.length){ setTicker('Nothing to remix — paste a post first.'); return; }
    let opt = optimize(text || '', PHRASES);
    opt = {...opt, lines:opt.lines.slice(0, 6)};
    const clean = value=>String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const archiveLines = opt.lines.map(line=>PHRASES[line.phrase].say);
    opt = {
      ...opt,
      lines:opt.lines.map((line, index)=>{
        const generatedText = clean(line.text);
        return {
          ...line,
          text:generatedText,
          sourceText:generatedText,
          archiveText:archiveLines[index],
          voiceRole:line.kind === 'compliance' ? 'robot' : 'announcer',
        };
      }),
    };

    const controller = new AbortController();
    const job = {controller, promise:null, pending:true};
    voiceJobRef.current = job;
    const voiceResults = Array(opt.lines.length).fill(null);
    const voiceErrors = Array(opt.lines.length).fill(null);
    let sequenceReady = false;

    // The stage is the user's performance, not a system-status console. Keep
    // their first selected line visible while voice clips are being generated.
    setTicker(opt.lines[0]?.sourceText || opt.lines[0]?.text || 'Preparing remix.');
    const requests = opt.lines.map((line, index)=>
      requestRemixVoiceClip(
        {text:line.text, role:line.voiceRole},
        {signal:controller.signal, retries:index === 0 ? 0 : 1, timeout:12000},
      ).then(result=>{
        if(voiceJobRef.current !== job) return result;
        voiceResults[index] = result;
        if(sequenceReady){
          const r = ref.current;
          const item = r.remixSequence?.[index];
          if(item){
            item.buffer = result.buffer;
            item.text = line.text;
            item.voiceRole = line.voiceRole;
            item.status = 'ready';
          }
          Object.entries(r.remixLineByStep || {}).forEach(([step, lineIndex])=>{
            if(lineIndex === index){
              r.remixAudioByStep[step] = result.buffer;
              r.remixByStep[step] = line.text;
            }
          });
          setRemix(current=>{
            if(!current) return current;
            const generatedLines = voiceResults.filter(Boolean).length;
            return {
              ...current,
              optimized:{
                ...current.optimized,
                lines:current.optimized.lines.map((currentLine, lineIndex)=>
                  lineIndex === index ? {...currentLine, text:line.text} : currentLine),
              },
              voice:{
                ...current.voice,
                status:generatedLines === opt.lines.length ? 'generated' : 'progressive',
                generatedLines,
                archiveLines:opt.lines.length - generatedLines,
              },
            };
          });
        }
        return result;
      }).catch(error=>{
        if(controller.signal.aborted) return null;
        voiceErrors[index] = error;
        console.warn(`dynamic remix voice line ${index + 1} unavailable`, error);
        return null;
      }),
    );

    // Playback starts when line one has either arrived or formally fallen back.
    // The other requests are already in flight and usually file before their act.
    await requests[0];
    if(voiceJobRef.current !== job) return;
    const allVoices = Promise.all(requests).then(()=>{
      if(voiceJobRef.current !== job) return {generatedLines:0, errors:[]};
      const generatedLines = voiceResults.filter(Boolean).length;
      job.pending = false;
      const status = generatedLines === opt.lines.length
        ? 'generated'
        : generatedLines > 0 ? 'partial' : 'fallback';
      setRemix(current=>current && ({
        ...current,
        optimized:{
          ...current.optimized,
          lines:opt.lines,
        },
        voice:{
          ...current.voice,
          status,
          generatedLines,
          archiveLines:opt.lines.length - generatedLines,
        },
      }));
      if(generatedLines === 0){
        const firstLine = opt.lines[0]?.sourceText || opt.lines[0]?.text;
        if(firstLine) setTicker(firstLine);
      }
      return {generatedLines, errors:voiceErrors.filter(Boolean)};
    });
    job.promise = allVoices;
    rx.voice = {
      provider:voiceResults.find(Boolean)?.provider || 'openai',
      status:'progressive',
      mode:'generated-duet',
      archiveLines:opt.lines.length - voiceResults.filter(Boolean).length,
      generatedLines:voiceResults.filter(Boolean).length,
    };
    rx.optimized = {
      ...opt,
      lines:opt.lines,
    };
    const r = ref.current;
    r.remix = rx;
    setRemix(rx);
    const s = makeSong();
    setSong(s); r.song = s; r.setlistIx = 0;
    const remixTempo = rx.score >= 60 ? 124 : rx.score >= 30 ? 112 : 104;
    // the optimized post, in order — the vox says it, the screen reads it
    const pool = opt.lines.map(l=> l.phrase);
    const { pattern } = randomPattern(
      r.samples.length, PHRASES, 48,
      60/remixTempo/4,
      (i, sequence) => voiceResults[sequence % voiceResults.length]?.buffer
        ? CBVoice.durationOfBuffer(voiceResults[sequence % voiceResults.length].buffer, r.deliv)
        : CBVoice.durationOf(i, PHRASES[i].say, r.deliv),
      pool, true,
    );
    // map each stamped step to the optimized line it performs, so the display
    // always matches what is being said
    const voxRow = voxRowOf(r.samples);
    const byStep = {};
    const audioByStep = {};
    const lineByStep = {};
    let k = 0;
    pattern[voxRow].forEach((v, step)=>{
      if(v){
        const lineIndex = k % opt.lines.length;
        const result = voiceResults[lineIndex];
        byStep[step] = opt.lines[lineIndex].text;
        if(result) audioByStep[step] = result.buffer;
        lineByStep[step] = lineIndex;
        k++;
      }
    });
    r.remixByStep = byStep;
    r.remixAudioByStep = audioByStep;
    r.remixLineByStep = lineByStep;
    r.remixSequence = opt.lines.map((line, index)=>({
      ...line,
      text:line.text,
      buffer:voiceResults[index]?.buffer || null,
      voiceRole:voiceResults[index] ? line.voiceRole : 'browser',
      status:voiceResults[index] ? 'ready' : 'pending',
    }));
    sequenceReady = true;
    r.remixSequenceIx = 0;
    // a remix is the one thing that writes the Vox row, so it takes the lock off
    setVoxLocked(false); r.voxLocked = false;
    setRack(rk=> voxRowOf(rk.samples)+1 === pattern.length ? {...rk, pattern} : rk);
    setTempo(remixTempo);
    r.spoken = true; r.phraseAt = performance.now();
    setTicker(opt.lines[0] ? opt.lines[0].text : rx.lines[0]);
    setHandoff(text);
    setRemixOpen(false); setStudio(false);
    setPlaying(true);
  },[]);

  // LinkedIn Lessons hands a finished post over via the URL hash ("Turn It
  // Into a Beat"). Stage it in the remix panel — playback still needs a
  // gesture, so the user reads their post and presses Remix it.
  React.useEffect(()=>{
    const m = location.hash.match(/^#beat=(.+)$/);
    if(!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    let text = '';
    try{ text = decodeURIComponent(m[1]); }catch{ return; }
    if(!text.trim()) return;
    const rx = analyze(text);
    rx.optimized = optimize(text, PHRASES);
    setRemix(rx);
    setHandoff(text);
    setRemixOpen(true);
    setTicker('Post received from LinkedIn Lessons — press Remix it.');
  },[]);

  React.useEffect(()=>{
    const down = e=>{
      if(e.metaKey||e.ctrlKey||e.altKey) return;
      if(e.target?.closest('dialog,input,textarea,select,[contenteditable="true"],[role="slider"]')) return;
      if(e.target?.closest('button,a,[role="button"]') && (e.code==='Space'||e.key==='Enter')) return;
      // the performance advances; it does not browse backward
      if(!e.shiftKey && e.key==='ArrowRight'){
        e.preventDefault();
        if(e.repeat) return;
        stepPhrase(1);
        return;
      }
      if(e.code==='Space'){ e.preventDefault(); if(!e.repeat)setPlaying(x=>!x); return; }
      if(e.shiftKey && e.key.startsWith('Arrow')){
        e.preventDefault();
        const step = .05;
        if(e.key==='ArrowUp') setDeliv(v=> Math.min(1, v+step));
        else if(e.key==='ArrowDown') setDeliv(v=> Math.max(0, v-step));
        else if(e.key==='ArrowRight') setSinc(v=> Math.min(1, v+step));
        else if(e.key==='ArrowLeft') setSinc(v=> Math.max(0, v-step));
        return;
      }
      const k = e.key.toLowerCase();
      if(k==='r' && !e.repeat){
        e.preventDefault();
        if(e.shiftKey){ CBAudio.unlock(); quantize(()=> speak(ref.current.armed)); } // say it again
        else newTrack();
        return;
      }
      if(!ref.current.studio){ // stage: three keys, nothing else
        if(e.repeat) return;
        if(k==='1'||k==='a'){ e.preventDefault(); firePhrase(); }
        else if(k==='2'||k==='s'){ e.preventDefault(); setEnergyLevel(ref.current.energy===1?0:1); }
        else if(k==='3'||k==='d'){ e.preventDefault(); setEnergyLevel(2); }
        return;
      }
      const ix = KEYMAP.indexOf(k);
      if(ix>=0 && !e.repeat){ e.preventDefault(); pressKey(ix); }
    };
    window.addEventListener('keydown', down);
    return ()=> window.removeEventListener('keydown', down);
  },[pressKey, newTrack, firePhrase, setEnergyLevel, quantize, speak, stepPhrase]);

  const onGrid = p => {
    const r = ref.current;
    const vr = r.voxRow;
    const q = p.map(row=>[...row]);
    for(let s=0;s<q[vr].length;s++) if(q[vr][s]===-1) q[vr][s] = r.armed+1;
    if(r.voxLocked) q[vr] = Array(q[vr].length).fill(0);
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
  const audition = id => { CBAudio.unlock(); const b = bufRef.current.get(id); if(b) CBAudio.playBuffer(b, {vel:1}); };

  const startExport = async mode => {
    try{
      const voiceJob = voiceJobRef.current;
      if(voiceJob?.pending){
        setTicker('Finalizing voice filings before export.');
        await voiceJob.promise;
      }
      await beginExport(mode);
    }
    catch(e){
      console.warn('export failed', e);
      expRef.current = null; setExp(null);
      setTicker(`Recording declined — ${e && e.message ? e.message : 'unsupported in this browser'}`);
    }
  };

  const beginExport = async mode => {
    if(expRef.current) return;
    CBAudio.unlock();
    const totalSteps = loops * ref.current.patLen;
    const ex = {remaining: totalSteps, started:false, finishing:false, discard:false, arming:true, mode};
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
          setTicker('MP4 filed with embedded audio.');
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
        setTicker(mode==='video' ? 'Video filed with embedded audio.' : 'Audio file circulated to your downloads.');
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

  const narrow = useNarrow();
  const toggleVoxLock = () => setVoxLocked(locked=>{
    const next = !locked;
    ref.current.voxLocked = next;
    if(next) setRack(rk=>({...rk, pattern: applyVoxLock(rk.pattern, rk.samples.length, true)}));
    setTicker(next ? 'Vox locked — phrases only when you press a key' : 'Vox live — the sequencer may speak');
    return next;
  });
  // a plain radio: filled when the row is locked shut
  const voxRadio = tone => <button type="button" onClick={toggleVoxLock} aria-pressed={voxLocked} aria-label="Lock vox"
    style={{display:'inline-flex',alignItems:'center',gap:8,cursor:'pointer',userSelect:'none',border:0,padding:0,background:'none'}}>
    <span style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${tone==='light'?'#fff':'var(--ink)'}`,
      display:'inline-flex',alignItems:'center',justifyContent:'center',flex:'none'}}>
      {voxLocked && <span style={{width:6,height:6,borderRadius:'50%',background:tone==='light'?'#fff':'var(--blue)'}}/>}
    </span>
    <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase',
      color:tone==='light'?'#fff':'var(--ink)'}}>Vox locked</span>
  </button>;
  // the stage is a blue room: the page itself goes blue behind the broadcast
  React.useEffect(()=>{
    const bg = studio ? 'var(--paper)' : 'var(--blue)';
    document.body.style.background = bg;
    document.documentElement.style.background = bg;
  },[studio]);

  const voxLabels = VOICES.map((v)=> v.vox ? voxCodes : null);
  // phrase navigation only moves forward, keeping the performance sequential
  const stageKeys = tone => <div style={{display:'grid',
    gridTemplateColumns: narrow ? '1fr' : 'repeat(3,1fr) 104px',gap:narrow?10:14,width:'100%'}}>
    <StageKey tone={tone} label="Phrase" hint="1 / A" caption="Say the next line" onFire={firePhrase}
      style={narrow?{gridColumn:'1 / -1'}:undefined}/>
    <StageKey tone={tone} label="Build" hint="2 / S" caption="Raise the room" on={energy===1} onFire={()=> setEnergyLevel(energy===1?0:1)}
      style={narrow?{gridColumn:'1 / -1'}:undefined}/>
    <StageKey tone={tone} label="Drop" hint="3 / D" caption="Full stop." on={energy===2} onFire={()=> setEnergyLevel(2)}
      style={narrow?{gridColumn:'1 / -1'}:undefined}/>
    <ArrowKey tone={tone} dir="right" hint="Next phrase" onFire={()=>stepPhrase(1)}/>
  </div>;
  const stageArrows = <div style={{display:'grid',
    gridTemplateColumns:narrow?'minmax(0,1fr)':'minmax(0,1fr) 146px',
    gap:narrow?8:14,alignItems:'stretch'}}>
    <div style={{height:104,minWidth:0}}>
      <CommentCards stateRef={ref} narrow={narrow}/>
    </div>
    <button
      type="button"
      data-testid="button-next-phrase"
      aria-label="Next phrase"
      onClick={()=>stepPhrase(1)}
      style={{minHeight:narrow?44:104,border:'2px solid #fff',background:'rgba(255,255,255,.06)',color:'#fff',
        display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:narrow?'9px 14px':'14px 12px',
        fontFamily:'var(--sans)',fontSize:narrow?11:10,fontWeight:750,letterSpacing:'.13em',textTransform:'uppercase',
        cursor:'pointer',touchAction:'manipulation',WebkitTapHighlightColor:'transparent'}}>
      <span>Next phrase</span>
      <ChevronRight size={narrow?18:22} strokeWidth={2.2} aria-hidden="true"/>
    </button>
  </div>;

  const controls = audioDrawer ? <StudioControls character={character} onCharacter={setCharacter} tempo={tempo} onTempo={setTempo}
    effects={{sinc,deliv,decay,weird,dist,pitch}} onPreset={p=>{setSinc(p.sinc);setDeliv(p.deliv);setDecay(p.decay);setWeird(p.weird);setDist(p.dist);setPitch(p.pitch);}}
    onPreview={()=>{CBAudio.unlock();speak(ref.current.armed);}} onClose={()=>setAudioDrawer(false)}/> : null;

  if(studio && !advanced) return <><StudioDesk
    playing={playing} pos={pos} tempo={tempo} grooveId={grooveId} song={song} phrases={PHRASES} armed={armed}
    onPhrase={pressKey} onPlay={()=>{CBAudio.unlock();setPlaying(p=>!p);}}
    onStop={()=>{setPlaying(false);try{CBVoice.current?.source.stop();if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();}catch{}}}
    onGroove={loadGroove} onRandom={()=>{const choices=GROOVES.filter(g=>g.id!==grooveId);loadGroove(choices[Math.floor(Math.random()*choices.length)].id);}}
    energy={energy} onEnergy={setEnergyLevel} mix={mix} onMix={(id,value)=>setMix(m=>({...m,[id]:value}))}
    muted={muted} onMute={id=>setMuted(m=>({...m,[id]:!m[id]}))} master={masterVolume} onMaster={setMasterVolume}
    effects={{sinc,deliv,pitch,weird}} onEffect={(id,value)=>({tempo:setTempo,sinc:setSinc,deliv:setDeliv,pitch:setPitch,weird:setWeird}[id]?.(value))}
    character={character} onCharacter={setCharacter} band={band} onBand={()=>setBand(b=>!b)}
    remixPanel={<RemixPanel narrow={narrow} result={remix} initial={handoff} onRemix={buildRemix} onClose={()=>setRemixOpen(false)}/>}
    onRemix={()=>setRemixOpen(o=>!o)} remixOpen={remixOpen} onStage={()=>setStudio(false)} onAdvanced={()=>setAdvanced(true)}
    onAudioTools={()=>setAudioDrawer(true)} ticker={ticker}
    voxLocked={voxLocked} onVoxLock={toggleVoxLock}
    pattern={rack.pattern} drums={DRUMS} rec={rec}
    onRecord={()=>{CBAudio.unlock();if(!rec){setVoxLocked(false);setPlaying(true);}setRec(r=>!r);}}
    onDrum={i=>{const d=DRUMS[i];if(!d)return;CBAudio.unlock();CBAudio.trigger(d.id,1);const r=ref.current;if(r.rec&&r.playing&&r.lastStep!==undefined)setRack(rk=>{const p=rk.pattern.map(row=>[...row]);p[i][r.lastStep]=2;return {...rk,pattern:p};});}}/>{controls}</>;

  if(!studio) return <><div className={stagePreview?`stage2${racingPreview?' stage3 c2-home':''}`:undefined} style={{position:'relative',minHeight:'100vh',background:'var(--blue)',color:'#fff',fontFamily:'var(--sans)',
    padding: narrow ? '14px 14px 26px' : '20px 26px 30px',boxSizing:'border-box',display:'flex',flexDirection:'column',gap:narrow?12:16,
    isolation:'isolate'}}>
    <Backdrop stateRef={ref} focusRef={canvasRef}/>
    {racingPreview ? <RacingHeader onAudioTools={()=>setAudioDrawer(true)}/> : stagePreview ? <header className="stage2-header">
      <a href="../" aria-label="LinkedIn Beats home"><img src="../home-2/brand/wordmark-horizontal.svg" alt="LinkedIn Beats"/></a>
      <span className="stage2-label">Studio</span>
      <nav aria-label="Studio navigation"><button onClick={()=>setAudioDrawer(true)}>Mix <Settings size={17}/></button><details onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary').focus();}}}><summary>Menu <span aria-hidden="true">☰</span></summary><div>
        <a href="../">Home</a><a href="../lessons/">LinkedInifier</a><a href="../store/">Shop</a>
        <button onClick={()=>{setStudio(true);setAdvanced(false);}}>Mixing desk ↗</button>
        <button onClick={()=>setRemixOpen(o=>!o)}>{remixOpen?'Close remix':'Build your remix'}</button>
      </div></details></nav>
    </header> : <>
    <div style={{position:'relative',zIndex:1,display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,flexWrap:'wrap'}}>
      <span style={{display:'inline-flex',alignItems:'baseline',gap:12,flexWrap:'wrap'}}>
        <span style={{fontSize:narrow?18:22,fontWeight:700,letterSpacing:'-.02em'}}>Circle Back<sup style={{fontSize:9,verticalAlign:10}}>®</sup></span>
        <span style={{fontFamily:'var(--mono)',fontSize:9,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase',opacity:.72}}>LinkedIn Training</span>
        <button
          type="button"
          aria-expanded={aboutOpen}
          onClick={()=>setAboutOpen(v=>!v)}
          style={{appearance:'none',border:0,borderBottom:'1px solid rgba(255,255,255,.75)',padding:'1px 0',background:'transparent',color:'#fff',fontFamily:'var(--sans)',fontSize:10,fontWeight:700,letterSpacing:'.13em',textTransform:'uppercase',cursor:'pointer'}}>
          About
        </button>
      </span>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <Button onClick={()=>{setStudio(true);setAdvanced(false);}} style={{background:'#fff349',color:'#111',borderColor:'#fff349'}}>Mixing desk</Button>
        <Button onClick={()=> setRemixOpen(o=>!o)}
          style={{background:remixOpen?'#fff':'var(--ink)',color:remixOpen?'var(--blue)':'#fff',borderColor:remixOpen?'#fff':'var(--ink)'}}>Build your remix</Button>
        <Button onClick={()=>{ CBAudio.unlock(); setPlaying(x=>!x); }}
          title={playing?'Pause performance':'Play auto-directed performance'}
          style={{background:playing?'#fff':'transparent',color:playing?'var(--blue)':'#fff',borderColor:'#fff'}}>{playing?'Pause':'Play'}</Button>
        <Button
          aria-label="Shuffle to a new track"
          title="New track (R)"
          onClick={newTrack}
          style={{background:'transparent',color:'#fff',borderColor:'#fff',padding:9,width:38,height:38,display:'inline-grid',placeItems:'center'}}>
          <Shuffle size={17} strokeWidth={1.8} aria-hidden="true"/>
        </Button>
        <Button
          aria-label="Open audio tools"
          title="Audio tools"
          onClick={()=>setAudioDrawer(true)}
          style={{background:'transparent',color:'#fff',borderColor:'#fff',padding:9,width:38,height:38,display:'inline-grid',placeItems:'center'}}>
          <Settings size={17} strokeWidth={1.8} aria-hidden="true"/>
        </Button>
      </div>
    </div>
    </>}
    {aboutOpen && <div
      role="dialog"
      aria-label="About LinkedIn Training"
      style={{position:'fixed',zIndex:31,top:narrow?88:70,left:narrow?14:26,width:narrow?'calc(100vw - 28px)':500,maxWidth:'calc(100vw - 52px)',boxSizing:'border-box',background:'var(--paper)',color:'var(--ink)',border:'var(--rule-frame) solid var(--ink)',padding:narrow?18:22,boxShadow:'10px 12px 0 rgba(4,42,82,.3)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',gap:18}}>
        <div>
          <div style={{fontFamily:'var(--mono)',fontSize:9.5,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--blue)'}}>About · Form LT-1</div>
          <h2 style={{margin:'7px 0 0',fontSize:23,lineHeight:1.05,letterSpacing:'-.035em'}}>LinkedIn Training</h2>
        </div>
        <button type="button" aria-label="Close About" onClick={()=>setAboutOpen(false)}
          style={{display:'grid',placeItems:'center',width:34,height:34,border:'var(--rule-frame) solid var(--ink)',background:'transparent',cursor:'pointer'}}>
          <X size={17} aria-hidden="true"/>
        </button>
      </div>
      <p style={{fontSize:15,lineHeight:1.45,margin:'18px 0 14px',maxWidth:'42ch'}}>
        Spot what helps your post — and what pushes it toward thought-leadership singularity.
      </p>
      <div style={{display:'grid',gridTemplateColumns:narrow?'1fr':'repeat(3, 1fr)',borderTop:'1px solid var(--hair)',borderBottom:'1px solid var(--hair)'}}>
        {['Inspect the language','Hear the genre','Keep the human part'].map((item,index)=>
          <span key={item} style={{padding:narrow?'8px 0':'10px 12px',borderLeft:!narrow&&index?'1px solid var(--hair)':'none',borderTop:narrow&&index?'1px solid var(--hair)':'none',fontFamily:'var(--mono)',fontSize:9,letterSpacing:'.08em',textTransform:'uppercase'}}>
            {item}
          </span>)}
      </div>
      <div style={{marginTop:14,fontFamily:'var(--mono)',fontSize:9.5,letterSpacing:'.1em',textTransform:'uppercase'}}>
        Educational outcomes subject to engagement.
      </div>
      <p style={{margin:'14px 0 0',paddingTop:12,borderTop:'1px dotted var(--hair)',fontSize:11,lineHeight:1.45,color:'var(--text-meta)'}}>
        Circle Back® is honored and humbled to have been built by{' '}
        <a
          href="https://www.linkedin.com/in/aaroncphelps"
          target="_blank"
          rel="noreferrer"
          style={{color:'var(--blue)',fontWeight:700,textUnderlineOffset:3,whiteSpace:'nowrap'}}>
          Aaron Phelps
        </a>.
      </p>
    </div>}
    {remixOpen && <div style={{position:'relative',zIndex:1}}>
      <RemixPanel narrow={narrow} result={remix} initial={handoff} onRemix={buildRemix} onClose={()=>setRemixOpen(false)}/>
    </div>}
    <main className={stagePreview?'stage2-screen':undefined} aria-label="Live performance" style={{position:'relative',zIndex:1,flex:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:0}}>
      <Monitor ref={canvasRef} stateRef={ref}
        style={{border:'1px solid rgba(255,255,255,.42)',width:'auto',height:'auto',maxWidth:'100%',
          maxHeight: narrow ? '58vh' : '68vh',
          backdropFilter:'blur(14px) saturate(1.15)', WebkitBackdropFilter:'blur(14px) saturate(1.15)',
          boxShadow:'inset 0 1px 0 rgba(255,255,255,.35), 0 24px 70px rgba(4,42,82,.34)'}}/>
    </main>
    {racingPreview ? <RacingConsole playing={playing} songName={remix?'Your remix':song.name} tempo={tempo} energy={energy}
      onPlay={()=>{CBAudio.unlock();setPlaying(p=>!p);}} onShuffle={newTrack} onPhrase={firePhrase} onEnergy={setEnergyLevel}
      voxLocked={voxLocked} onVoxLock={toggleVoxLock} onAudioTools={()=>setAudioDrawer(true)}
      phrases={PHRASES} drums={DRUMS} onPadPhrase={pressKey}
      onDrum={i=>{const d=DRUMS[i];if(d){CBAudio.unlock();CBAudio.trigger(d.id,1);}}} ticker={ticker}/>
    : stagePreview ? <section className="stage2-console" aria-label="Performance controls">
      <div className="stage2-transport"><button className="stage2-play" onClick={()=>{CBAudio.unlock();setPlaying(p=>!p);}} aria-label={playing?'Pause performance':'Play performance'}>{playing?'Ⅱ':'▶'}</button>
        <div className="stage2-track"><strong>{remix?'Your remix':song.name}</strong><span>{tempo} BPM · {SECTIONS[energy]}</span></div>
        <button className="stage2-shuffle" onClick={newTrack} aria-label="New track"><Shuffle size={21}/></button>
      </div>
      <div className="stage2-keys"><button onClick={firePhrase}>Phrase <span>↗</span></button><button aria-pressed={energy===1} onClick={()=>setEnergyLevel(energy===1?0:1)}>Build <span>＋</span></button><button aria-pressed={energy===2} onClick={()=>setEnergyLevel(2)}>Drop <span>↓</span></button></div>
      <div className="stage2-bottom"><button onClick={()=>stepPhrase(1)}>Next phrase →</button><button aria-pressed={!voxLocked} onClick={toggleVoxLock}>Auto phrases {voxLocked?'off':'on'}</button></div>
      <span className="stage2-accessible" aria-live="polite">{ticker}</span>
    </section> : <><div style={{position:'relative',zIndex:1}}>{stageArrows}</div>
    <div style={{position:'relative',zIndex:1,display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',opacity:.72,fontSize:9.5,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase'}}>
      <span>© Digital Creative 2026 · {remix ? `Your remix · index ${remix.score} · ${remix.rank}` : song.name} · {tempo} BPM · {SECTIONS[energy]}</span>
      <span style={{display:'inline-flex',gap:18,alignItems:'center',flexWrap:'wrap'}}>
        {voxRadio('light')}
        <span>Play runs the show · → next phrase · 2 build · 3 drop · Shift+R repeats · R new track</span>
      </span>
    </div>
    </>}
    {controls}
  </div>{racingPreview&&<ConceptFooter base="../" variant="dark"/>}</>;

  return <Unit style={narrow ? {padding:'20px 14px'} : undefined}>
    <Button onClick={()=>setAdvanced(false)} style={{marginBottom:18}}>← Back to the mixing desk</Button>
    <Masthead meta={narrow ? ["Form CB-16","Rev. 2026-08"] : ["Form CB-16","Rev. 2026-08","For internal thought leadership only"]}/>
    <div style={{display:'flex',flexDirection:narrow?'column':'row',justifyContent:'space-between',alignItems:narrow?'flex-start':'flex-end',gap:narrow?8:30,marginTop:18}}>
      <h1 style={{margin:0,fontSize:narrow?30:40,lineHeight:.96,letterSpacing:'-.045em',fontWeight:700,color:'var(--blue)'}}>The professional phrase organ.</h1>
      <p style={{margin:0,fontSize:narrow?12.5:13,lineHeight:1.45,maxWidth:400}}>The LinkedIn remixer — corporate phrases, spoken in time over a live drum machine. <b style={{color:'var(--blue)'}}>It’s not an instrument. It’s a journey.</b></p>
    </div>
    <Ticker style={{marginTop:16}}>{ticker}</Ticker>
    <div style={{marginTop:14}}>
      <Button onClick={()=> setRemixOpen(o=>!o)} style={{padding:'12px 18px'}}>Build your remix</Button>
    </div>
    {remixOpen && <div style={{marginTop:12}}>
      <RemixPanel narrow={narrow} result={remix} initial={handoff} onRemix={buildRemix} onClose={()=>setRemixOpen(false)}/>
    </div>}

    <div style={{display:'grid',gridTemplateColumns:narrow?'1fr':'minmax(0,1fr) 280px',gap:narrow?16:'var(--space-col)',alignItems:'start',marginTop:16}}>
      <Monitor ref={canvasRef} stateRef={ref}/>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <Button style={{padding:'14px 20px'}} onClick={()=>{ CBAudio.unlock(); setStudio(false); setPlaying(true); }}>▶ Back to the stage</Button>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          <Button on={playing} onClick={()=>{ CBAudio.unlock(); setPlaying(x=>!x); }}>{playing?'Pause':'Play'}</Button>
          <Button onClick={newTrack}>New track (R)</Button>
        </div>
      </div>
    </div>

    <Bay title="Stage keys" aside={`${song.name} · ${SECTIONS[energy]}`} style={{marginTop:'var(--space-section)'}}>
      {stageKeys('ink')}
    </Bay>

    <div style={{display:'grid',gridTemplateColumns:narrow?'1fr':'200px 1fr 230px',gap:narrow?20:'var(--space-col)',marginTop:'var(--space-section)'}}>
      <Bay title="Phrase index" aside={`01–${String(PHRASES.length).padStart(2,'0')}`} style={narrow?{order:3}:undefined}>
        <div style={{maxHeight:narrow?300:600,overflowY:'auto'}}>
          {PHRASES.map((p,i)=>
            <div key={i} onClick={()=>pressKey(i)} style={{display:'flex',gap:12,fontSize:11.5,lineHeight:1.9,borderBottom:'1px dotted var(--hair)',cursor:'pointer',fontWeight:armed===i?700:400,color:armed===i?'var(--blue)':'var(--ink)'}}>
              <Readout style={{lineHeight:'1.9em',fontSize:10.5}}>{String(i+1).padStart(2,'0')}</Readout>
              <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.say}</span>
            </div>)}
        </div>
      </Bay>
      <Bay title="Keys" aside="Press to opine" style={narrow?{order:1}:undefined}>
        <KeyPlate columns={4}>
          {PHRASES.slice(0,16).map((p,i)=>
            <Pad key={i} index={String(i+1).padStart(2,'0')} hotkey={narrow?undefined:KEYMAP[i].toUpperCase()} name={p.name} hot={armed===i} onTrigger={()=>pressKey(i)}/>)}
        </KeyPlate>
        {narrow
          ? <p style={{margin:'10px 0 0',fontSize:10.5,color:'var(--text-meta)'}}>Tap a key to speak it · tap grid cells to add hits · the armed phrase stamps into Vox</p>
          : <p style={{margin:'10px 0 0',fontSize:10.5,color:'var(--text-meta)'}}>Type the letter on each key to speak it · <Kbd>←</Kbd><Kbd>→</Kbd> scrub phrases · <Kbd>⇧</Kbd><Kbd>R</Kbd> repeat · <Kbd>R</Kbd> new track · <Kbd>space</Kbd> start the song · <Kbd>⇧</Kbd><Kbd>↑</Kbd>/<Kbd>↓</Kbd> delivery</p>}
      </Bay>
      <Bay title="Registers" aside="Cal. A" style={narrow?{order:2}:undefined}>
        <div style={{display:'flex',flexDirection:narrow?'row':'column',flexWrap:'wrap',gap:16}}>
          <Knob label="Sincerity" value={sinc} onChange={setSinc}/>
          <Knob label="Delivery" value={deliv} onChange={setDeliv}/>
          <Knob label="Decay" value={decay} onChange={setDecay}/>
          <Knob label="Tempo" value={(tempo-60)/140} onChange={v=>setTempo(Math.round(60+v*140))} format={()=>tempo+' BPM'}/>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12,marginTop:16,borderTop:'1px dotted var(--hair)',paddingTop:14}}>
          <Scrubber label="Pitch" value={pitch} onChange={setPitch}
            format={v=>{ const s = Math.round(-8+v*10); return `${s>0?'+':''}${s} st`; }}/>
          <Scrubber label="Weirdness" value={weird} onChange={setWeird}/>
          <Scrubber label="Distortion" value={dist} onChange={setDist}/>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {CHARACTERS.map(c=>
              <Button key={c.id} on={character===c.id} onClick={()=>setCharacter(c.id)} style={{padding:'6px 8px'}}>{c.name}</Button>)}
          </div>
        </div>
      </Bay>
    </div>
    <Bay title={`Sequencer · ${patLen} steps`} aside={<Readout>{pos===null?'—':String(pos+1).padStart(2,'0')}</Readout>} style={{marginTop:'var(--space-section)'}}>
      <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        <div style={{minWidth: narrow ? 84 + patLen*24 : undefined}}>
          <StepGrid voices={VOICES} steps={patLen} pattern={rack.pattern} onChange={onGrid} playhead={pos} selected={selRow} onSelect={setSelRow}
            labelW={narrow?84:110}
            onClearRow={i=> setRack(rk=>{ const pattern = rk.pattern.map(x=>[...x]); pattern[i] = Array(rk.pattern[i].length).fill(0); return {...rk, pattern}; })}
            voxLabels={voxLabels}/>
        </div>
      </div>
      <div style={{display:'flex',gap:9,alignItems:'center',marginTop:16,flexWrap:'wrap'}}>
        <Button on={playing} onClick={()=>{ CBAudio.unlock(); setPlaying(x=>!x); }}>{playing?'Pause':'Play'}</Button>
        <Button variant="rec" on={rec} onClick={()=>setRec(x=>!x)}>{rec?'Recording keys':'Record keys'}</Button>
        <Button onClick={newTrack}>New track</Button>
        <Button onClick={()=>setRack(rk=>({...rk, pattern:seedPattern(rk.samples.length, rk.pattern[0].length)}))}>Demo beat</Button>
        <Button onClick={()=>setRack(rk=>({...rk, pattern:emptyPattern(rk.samples.length, rk.pattern[0].length)}))}>Clear drums</Button>
        <Button on={band} onClick={()=>{ setBand(b=>{ setTicker(b ? 'Band dismissed — drums only' : 'The band is back'); return !b; }); }}>Band</Button>
        <span style={{display:'inline-flex',gap:6,alignItems:'center',marginLeft:6}}>
          <Silk>Steps</Silk>
          {[16,32,48,64].map(n=>
            <Button key={n} on={patLen===n} onClick={()=>setRack(rk=>{
              const cur = rk.pattern[0].length;
              if(n===cur) return rk;
              const pattern = rk.pattern.map(row=>{ const out = Array(n).fill(0); for(let s=0;s<n;s++) out[s] = s<cur ? row[s] : row[s%cur]; return out; });
              return {...rk, pattern};
            })} style={{padding:'7px 10px'}}>{n}</Button>)}
        </span>
        <span style={{marginLeft:8}}>{voxRadio('ink')}</span>
        <span style={{marginLeft:'auto'}}><Silk muted>Locked keeps the Vox row empty · double-click a track name to clear it</Silk></span>
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

    <div style={{marginTop:26,borderTop:'var(--rule-heavy) solid var(--ink)',paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
      <Silk muted>© Digital Creative 2026 · An equal opportunity instrument</Silk>
      {!narrow && <Silk muted>Circle Back® is not affiliated with your network</Silk>}
      <Stamp>Approved — HR</Stamp>
    </div>
  </Unit>;
}
