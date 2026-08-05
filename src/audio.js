// CBAudio — drum synth ported from reference/transient-16.html (WebAudio, no samples)
// Extended for the sampler + clip export: buffer decode/playback and a MediaStream
// tap on the master bus so everything (drums, exhibits, vox bank) can be recorded.
// waveshaper curves for the corporate distortions
function driveCurve(k){
  const n = 1024, c = new Float32Array(n), norm = Math.tanh(k) || 1;
  for(let i=0;i<n;i++){ const x = i/(n-1)*2 - 1; c[i] = Math.tanh(x*k)/norm; }
  return c;
}
function crushCurve(bits){
  const n = 1024, c = new Float32Array(n), levels = Math.pow(2, bits);
  for(let i=0;i<n;i++){ const x = i/(n-1)*2 - 1; c[i] = Math.round(x*levels)/levels; }
  return c;
}

// Corporate distortions. Each character re-voices the phrase bus.
export const CHARACTERS = [
  {id:'boardroom',  name:'Boardroom',       filter:'peaking',  freq:1400, q:.9,  gain:5,   ring:40,  drive:1},
  {id:'conference', name:'Conference call', filter:'bandpass', freq:1700, q:.85, gain:0,   ring:110, drive:1.3},
  {id:'allhands',   name:'All-hands PA',    filter:'bandpass', freq:1000, q:1.6, gain:0,   ring:62,  drive:1.7},
  {id:'replyall',   name:'Reply-all',       filter:'peaking',  freq:2800, q:1.4, gain:8,   ring:214, drive:1.2},
  {id:'bandwidth',  name:'Bandwidth',       filter:'lowpass',  freq:2200, q:1.1, gain:0,   ring:88,  drive:1.5},
];

export const CBAudio = (() => {
  let ctx, master, comp, noiseBuf, streamDest, analyser, specArr, lp, voxIn, voxDelay,
      voxChar, voxDrive, voxCrush, voxDry, voxRing, voxRingOsc, voxWob, voxFb, voxVerb;
  let fx = {weird:0, dist:.12, character:'boardroom'};
  function init(){
    if(ctx) return;
    ctx = new (window.AudioContext||window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .85;
    // performance filter — the build/drop sweeps this
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 1.2;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6; comp.ratio.value = 12; comp.attack.value = .003; comp.release.value = .15;
    master.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
    // the vox bus — character filter → drive → bitcrush → ring mod → wobble →
    // presence peak → master, with a tempo-locked delay send (the talkbox trick)
    voxIn = ctx.createGain();
    voxChar = ctx.createBiquadFilter(); voxChar.type = 'peaking'; voxChar.frequency.value = 1400; voxChar.Q.value = .9; voxChar.gain.value = 5;
    voxDrive = ctx.createWaveShaper(); voxDrive.curve = driveCurve(1.8);
    voxCrush = ctx.createWaveShaper(); voxCrush.curve = crushCurve(16);
    const sum = ctx.createGain();
    voxDry = ctx.createGain(); voxDry.gain.value = 1;
    const ringMul = ctx.createGain(); ringMul.gain.value = 0; // gain is driven by the oscillator
    voxRingOsc = ctx.createOscillator(); voxRingOsc.type = 'sine'; voxRingOsc.frequency.value = 40;
    voxRingOsc.connect(ringMul.gain); voxRingOsc.start();
    voxRing = ctx.createGain(); voxRing.gain.value = 0;
    const wob = ctx.createDelay(.05); wob.delayTime.value = .006;
    voxWob = ctx.createGain(); voxWob.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = .7;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = .0035;
    lfo.connect(lfoAmt); lfoAmt.connect(wob.delayTime); lfo.start();
    const peak = ctx.createBiquadFilter(); peak.type = 'peaking'; peak.frequency.value = 2600; peak.Q.value = 1.1; peak.gain.value = 3;

    voxIn.connect(voxChar); voxChar.connect(voxDrive); voxDrive.connect(voxCrush);
    voxCrush.connect(voxDry); voxDry.connect(sum);
    voxCrush.connect(ringMul); ringMul.connect(voxRing); voxRing.connect(sum);
    sum.connect(peak);
    sum.connect(wob); wob.connect(voxWob); voxWob.connect(peak);
    peak.connect(master);
    // a room to put the voice in — synthesized impulse, exponential decay
    const irLen = Math.floor(ctx.sampleRate * 2.1);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for(let c=0;c<2;c++){
      const d = ir.getChannelData(c);
      for(let i=0;i<irLen;i++){
        const decay = Math.pow(1 - i/irLen, 2.6);
        d[i] = (Math.random()*2 - 1) * decay;
      }
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    voxVerb = ctx.createGain(); voxVerb.gain.value = .08;   // a little room by default
    const verbOut = ctx.createGain(); verbOut.gain.value = .9;
    peak.connect(voxVerb); voxVerb.connect(conv); conv.connect(verbOut); verbOut.connect(master);

    voxDelay = ctx.createDelay(1.5); voxDelay.delayTime.value = .28;
    voxFb = ctx.createGain(); voxFb.gain.value = .34;
    const wet = ctx.createGain(); wet.gain.value = .3;
    peak.connect(voxDelay); voxDelay.connect(voxFb); voxFb.connect(voxDelay); voxDelay.connect(wet); wet.connect(master);
    streamDest = ctx.createMediaStreamDestination();
    comp.connect(streamDest);
    analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .78;
    comp.connect(analyser);
    specArr = new Uint8Array(analyser.frequencyBinCount);
    const len = ctx.sampleRate*2, b = ctx.createBuffer(1,len,ctx.sampleRate), d = b.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
    noiseBuf = b;
  }
  const rs = ()=> ctx && ctx.state==='suspended' && ctx.resume();

  // Mobile audio unlock. Must be called synchronously from inside a real user
  // gesture handler (tap/click/keydown):
  // - iOS/Android only honor AudioContext.resume() during a gesture;
  // - a one-sample buffer through the graph seals the deal on older WebKit;
  // - a looping (silent) <audio> element flips iOS into the "playback" audio
  //   session so the ringer/silent switch stops muting WebAudio.
  let unlocked = false, silentEl;
  function silentWavUrl(){
    const sr = 8000, n = 400; // 50ms of digital silence
    const buf = new ArrayBuffer(44 + n*2), v = new DataView(buf);
    const w = (o, s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i, s.charCodeAt(i)); };
    w(0,'RIFF'); v.setUint32(4, 36 + n*2, true); w(8,'WAVE'); w(12,'fmt ');
    v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
    v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
    w(36,'data'); v.setUint32(40, n*2, true);
    return URL.createObjectURL(new Blob([buf], {type:'audio/wav'}));
  }
  function unlock(){
    init();
    try{ if(ctx.state === 'suspended') ctx.resume(); }catch(e){}
    if(unlocked) return;
    unlocked = true;
    try{
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource(); s.buffer = b;
      s.connect(ctx.destination); s.start(0);
    }catch(e){}
    try{
      silentEl = document.createElement('audio');
      silentEl.setAttribute('playsinline',''); silentEl.setAttribute('data-cb-unlock','');
      silentEl.loop = true;
      silentEl.src = silentWavUrl();
      document.body.appendChild(silentEl);
      const p = silentEl.play();
      if(p && p.catch) p.catch(()=>{ unlocked = false; try{ silentEl.remove(); }catch(e){} });
    }catch(e){}
  }
  function noise(t,dur){ const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = .8+Math.random()*.4; s.start(t, Math.random()*1.5, dur+.02); return s; }
  function env(t,peak,dur,atk){ const g = ctx.createGain(); const a = atk===undefined?.001:atk;
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak,.0002),t+a);
    g.gain.exponentialRampToValueAtTime(.0001,t+a+dur); return g; }
  function osc(type,f,t){ const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f,t); o.start(t); return o; }
  function filt(type,f,q){ const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if(q!==undefined) b.Q.value = q; return b; }
  const METAL = [2,3,4.16,5.43,6.79,8.21];
  function trigger(v, vel=1, when, P){
    init(); rs();
    P = P || {};
    const t = when===undefined ? ctx.currentTime+.001 : when;
    const out = ctx.createGain(); out.gain.value = .8*vel; out.connect(master);
    const T = x => x.stop(t+4);
    if(v==='kick'){
      const o = osc('sine',150,t); o.frequency.exponentialRampToValueAtTime(46,t+.07);
      const g = env(t,1,.36,.002); o.connect(g); g.connect(out); T(o);
      const nz = noise(t,.03), hp = filt('highpass',1200), ng = env(t,.25,.025);
      nz.connect(hp); hp.connect(ng); ng.connect(out);
    } else if(v==='snare'){
      const nz = noise(t,.4), hp = filt('highpass',2000), bp = filt('bandpass',1900,.7);
      const ng = env(t,.9,.17); nz.connect(hp); hp.connect(bp); bp.connect(ng); ng.connect(out);
      const o = osc('triangle',185,t); o.frequency.exponentialRampToValueAtTime(120,t+.08);
      const g = env(t,.55,.1); o.connect(g); g.connect(out); T(o);
    } else if(v==='clap'){
      const bp = filt('bandpass',950,1.1), hp = filt('highpass',600);
      bp.connect(hp); hp.connect(out);
      [0,.011,.023].forEach(off=>{ const nz = noise(t+off,.03), g = env(t+off,.9,.02); nz.connect(g); g.connect(bp); });
      const nz = noise(t+.034,.3), g = env(t+.034,.75,.19); nz.connect(g); g.connect(bp);
    } else if(v==='ch' || v==='oh'){
      const open = v==='oh';
      const hp = filt('highpass',7500), bp = filt('bandpass',10000,.8);
      hp.connect(bp); bp.connect(out);
      const g = env(t,.55,open?.42:.052);
      METAL.forEach(r=>{ const o = osc('square',40*r,t); o.connect(g); T(o); });
      g.connect(hp);
      const nz = noise(t,.1), nh = filt('highpass',8000), ng = env(t,.25,open?.3:.04);
      nz.connect(nh); nh.connect(ng); ng.connect(out);
    } else if(v==='shk'){
      const bp = filt('bandpass',6200,2.9), hp = filt('highpass',3500);
      bp.connect(hp); hp.connect(out);
      const nz = noise(t,.3), g = env(t,.8,.075,.012); nz.connect(g); g.connect(bp);
    } else if(v==='cow'){
      const bp = filt('bandpass',2600,3.4); bp.connect(out);
      const g = env(t,.55,.32);
      [540,800].forEach(f=>{ const o = osc('square',f,t); o.connect(g); T(o); });
      g.connect(bp);
    } else if(v==='zap'){
      const o = osc('sine',1900,t); o.frequency.exponentialRampToValueAtTime(55,t+.16);
      const g = env(t,.85,.22); o.connect(g); g.connect(out); T(o);
    }
    // ---- the band: pitched voices, driven by song.js ----
    else if(v==='sub'){
      const f = P.freq||55, d = P.dur||.42;
      const o = osc('sine',f,t); const g = env(t,1,d,.006); o.connect(g); g.connect(out); T(o);
    } else if(v==='bass'){
      const f = P.freq||82, d = P.dur||.2;
      const flt = filt('lowpass', f*3.2, 7);
      flt.frequency.setValueAtTime(Math.min(f*9, 3200), t);
      flt.frequency.exponentialRampToValueAtTime(Math.max(f*1.6, 60), t+d*.9);
      const g = env(t,.95,d,.004);
      [0,-7].forEach((c,i)=>{ const o = osc(i?'square':'sawtooth', f*Math.pow(2,c/1200), t); o.connect(flt); T(o); });
      flt.connect(g); g.connect(out);
      const s = osc('sine', f/2, t); const sg = env(t,.5,d*.8,.004); s.connect(sg); sg.connect(out); T(s);
    } else if(v==='arp'){
      const f = P.freq||440, d = P.dur||.13;
      const flt = filt('lowpass', 5200, 6);
      flt.frequency.setValueAtTime(6800, t); flt.frequency.exponentialRampToValueAtTime(900, t+d);
      const g = env(t,.5,d,.003);
      [-6, 6].forEach(c=>{ const o = osc('sawtooth', f*Math.pow(2,c/1200), t); o.connect(flt); T(o); });
      flt.connect(g); g.connect(out);
    } else if(v==='stab'){
      const freqs = P.freqs||[220,277,330], d = P.dur||.26;
      const flt = filt('lowpass', 4200, 4);
      flt.frequency.setValueAtTime(5200, t); flt.frequency.exponentialRampToValueAtTime(1100, t+d);
      const g = env(t,.42,d,.004);
      freqs.forEach(f=> [-8,8].forEach(c=>{ const o = osc('sawtooth', f*Math.pow(2,c/1200), t); o.connect(flt); T(o); }));
      flt.connect(g); g.connect(out);
    } else if(v==='blip'){
      const f = P.freq||1760;
      const o = osc('square', f, t); o.frequency.exponentialRampToValueAtTime(f*(P.up?2:.55), t+.05);
      const g = env(t,.3,.06,.002); o.connect(g); g.connect(out); T(o);
    } else if(v==='impact'){
      const o = osc('sine',110,t); o.frequency.exponentialRampToValueAtTime(32,t+.5);
      const g = env(t,1,.85,.004); o.connect(g); g.connect(out); T(o);
      const nz = noise(t,.7), hp = filt('highpass',300), ng = env(t,.55,.6,.004);
      nz.connect(hp); hp.connect(ng); ng.connect(out);
    } else if(v==='riser'){
      const d = P.dur||2;
      const nz = noise(t,d), bp = filt('bandpass',400,4);
      bp.frequency.setValueAtTime(320,t); bp.frequency.exponentialRampToValueAtTime(7200,t+d);
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001,t);
      g.gain.exponentialRampToValueAtTime(.5,t+d);
      g.gain.exponentialRampToValueAtTime(.0001,t+d+.12);
      nz.connect(bp); bp.connect(g); g.connect(out);
      const o = osc('sawtooth',200,t); o.frequency.exponentialRampToValueAtTime(2400,t+d);
      const og = env(t,.16,d,.4); o.connect(og); og.connect(out); o.stop(t+d+.2);
    }
  }
  // performance filter sweep — the whole mix ducks and opens
  function setFilter(hz, seconds){
    init();
    const t = ctx.currentTime;
    try{
      lp.frequency.cancelScheduledValues(t);
      lp.frequency.setValueAtTime(Math.max(60, lp.frequency.value), t);
      if(seconds) lp.frequency.exponentialRampToValueAtTime(Math.max(60, hz), t + seconds);
      else lp.frequency.setTargetAtTime(Math.max(60, hz), t, .02);
    }catch(e){}
  }
  const setVoxDelay = s => { init(); try{ voxDelay.delayTime.setTargetAtTime(s, ctx.currentTime, .05); }catch(e){} };
  const setVoxVerb = amt => { init(); try{ voxVerb.gain.setTargetAtTime(amt, ctx.currentTime, .03); }catch(e){} };

  // Weirdness scrubs ring modulation, bitcrush, wobble and delay feedback together;
  // Distortion scrubs the drive. Character re-voices the whole bus.
  function setVoxFx(next){
    init();
    fx = {...fx, ...next};
    const w = Math.max(0, Math.min(1, fx.weird));
    const d = Math.max(0, Math.min(1, fx.dist));
    const ch = CHARACTERS.find(c=> c.id === fx.character) || CHARACTERS[0];
    try{
      voxChar.type = ch.filter;
      voxChar.frequency.value = ch.freq;
      voxChar.Q.value = ch.q;
      if(ch.filter === 'peaking') voxChar.gain.value = ch.gain;
      voxDrive.curve = driveCurve(1 + d*18*ch.drive);
      voxCrush.curve = crushCurve(Math.max(3, 16 - w*12));
      voxRing.gain.value = w*.6;
      voxDry.gain.value = 1 - w*.45;
      voxWob.gain.value = w*.45;
      voxRingOsc.frequency.value = ch.ring * (1 + w*1.6);
      voxFb.gain.value = .3 + w*.28;
      voxIn.gain.value = 1/(1 + d*1.1); // makeup so drive doesn't just get louder
    }catch(e){}
  }
  function decode(arrayBuffer){ init(); return ctx.decodeAudioData(arrayBuffer); }
  function playBuffer(buffer, opts){
    const o = opts || {};
    init(); rs();
    const t = o.when===undefined ? ctx.currentTime+.001 : o.when;
    const src = ctx.createBufferSource(); src.buffer = buffer;
    if(o.rate!==undefined) src.playbackRate.value = o.rate;
    if(o.detune) try{ src.detune.value = o.detune; }catch(e){ /* detune unsupported */ }
    if(o.warble){
      // A restrained tape/terminal drift. Even at maximum this is cents, not
      // semitones, so the voice moves without becoming a novelty voice.
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = .55 + o.warble*.75;
      depth.gain.value = 3 + o.warble*12;
      try{
        lfo.connect(depth); depth.connect(src.detune);
        lfo.start(t); lfo.stop(t + buffer.duration + 1);
      }catch(e){ /* detune modulation unsupported */ }
    }
    const g = ctx.createGain(); g.gain.value = .9*(o.vel===undefined?1:o.vel);
    if(o.robot){
      // An early corporate speech terminal: restricted telephone bandwidth,
      // coarse amplitude resolution, a hard carrier and a tiny metal enclosure.
      // This is intentionally unlike the global musical vox effects.
      const high = ctx.createBiquadFilter();
      high.type = 'highpass'; high.frequency.value = 320; high.Q.value = .8;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass'; low.frequency.value = 3100; low.Q.value = 1.15;
      const quantize = ctx.createWaveShaper(); quantize.curve = crushCurve(5);
      const dry = ctx.createGain(); dry.gain.value = .44;
      const ring = ctx.createGain(); ring.gain.value = .34;
      const carrier = ctx.createOscillator(); carrier.type = 'square'; carrier.frequency.value = 72;
      const depth = ctx.createGain(); depth.gain.value = .3;
      const enclosure = ctx.createDelay(.05); enclosure.delayTime.value = .011;
      const enclosureGain = ctx.createGain(); enclosureGain.gain.value = .2;
      carrier.connect(depth); depth.connect(ring.gain);
      src.connect(high); high.connect(low); low.connect(quantize);
      quantize.connect(dry); quantize.connect(ring); quantize.connect(enclosure);
      dry.connect(g); ring.connect(g); enclosure.connect(enclosureGain); enclosureGain.connect(g);
      carrier.start(t); carrier.stop(t + buffer.duration + 1);
    } else {
      src.connect(g);
    }
    g.connect(o.bus === 'vox' ? voxIn : master); src.start(t);
    return { source: src, gain: g };
  }
  return {
    init, resume: rs, unlock, trigger, decode, playBuffer, setFilter, setVoxDelay, setVoxVerb, setVoxFx,
    now: ()=>{ init(); return ctx.currentTime; },
    stream: ()=>{ init(); return streamDest.stream; },
    audioTrack: ()=>{ init(); return streamDest.stream.getAudioTracks()[0]; },
    sampleRate: ()=>{ init(); return ctx.sampleRate; },
    spectrum: ()=>{ if(!analyser) return null; analyser.getByteFrequencyData(specArr); return specArr; },
    state: ()=> ctx ? ctx.state : 'uninitialized',
  };
})();

// handy for debugging on a phone
if(typeof window !== 'undefined'){ window.CBAudio = CBAudio; }

export function exposeVoice(){ if(typeof window !== 'undefined') window.CBVoice = CBVoice; }

// CBVoice — the LinkedIn larynx. Prefers the recorded phrase bank (routed through
// CBAudio's master bus, so it lands in exports); falls back to speechSynthesis,
// which the browser cannot capture into a recording.
// Tiny tonal differences keep repeated reads alive without turning the speaker
// into a chipmunk. Values are cents, and lean slightly below the source voice.
const READ_CYCLE = [0, -35, 15, -70, -105];
const SLOWEST_READ = Math.min(...READ_CYCLE);
const deliveryRate = deliv => .9 + deliv*.2; // deliberate 0.90x → brisk 1.10x
const sincerityDetune = sinc => -120 + sinc*100; // warm -1.2st → neutral -0.2st

export const CBVoice = {
  bank: new Map(),
  current: null,
  async loadBank(base, count){
    const tryLoad = async i => {
      for(const ext of ['wav','mp3','m4a']){
        try{
          const res = await fetch(`${base}${String(i+1).padStart(2,'0')}.${ext}`);
          if(!res.ok) continue;
          const buf = await CBAudio.decode(await res.arrayBuffer());
          this.bank.set(i, buf);
          return;
        }catch(e){ /* try next ext */ }
      }
    };
    await Promise.allSettled(Array.from({length:count}, (_,i)=> tryLoad(i)));
    return this.bank.size;
  },
  // how long this line actually takes to say, at the given delivery rate —
  // the randomizer uses this to give every phrase room to finish
  durationOf(i, text, deliv = .5){
    // detune moves playback speed with pitch, so the least-lifted read is the
    // longest; the sequencer budgets for that or the next phrase talks over it
    const rate = deliveryRate(deliv) * Math.pow(2, SLOWEST_READ/1200);
    const buf = this.bank.get(i);
    if(buf) return buf.duration / rate;
    return Math.max(.7, String(text||'').length * .065) / rate; // estimate before the bank loads
  },
  durationOfBuffer(buffer, deliv = .5){
    if(!buffer) return 1.6;
    const rate = deliveryRate(deliv) * Math.pow(2, SLOWEST_READ/1200);
    return buffer.duration / rate;
  },
  // Sincerity is tonal posture, not a pitch fader: it moves from a warmer,
  // faintly unstable read toward a polished neutral read. Delivery controls a
  // deliberately narrow cadence range close to normal conversation.
  // decay governs what happens to the PREVIOUS phrase when a new one lands:
  // 0 = choked instantly (the chair recognizes no one), 1 = rings out in full.
  // pitch is a semitone offset (-12..+12) applied on top of Sincerity
  pitch: 0,
  // Every so often a read is dunked in reverb, for no reason anyone could defend.
  reads: 0,
  readOffset(){ return READ_CYCLE[this.reads++ % READ_CYCLE.length]; },
  speakPhrase(i, text, sinc, deliv, decay, overrideBuffer, voiceRole){
    const d = decay===undefined ? .5 : decay;
    const octave = this.readOffset();
    CBAudio.setVoxVerb(Math.random() < .22 ? .55 : .08);
    const buf = overrideBuffer || this.bank.get(i);
    if(buf){
      const prev = this.current;
      if(prev && d < .97){
        const rel = .02 + d*1.2;
        try{
          const now = CBAudio.now();
          prev.gain.gain.setTargetAtTime(0, now, Math.max(.01, rel/3));
          prev.source.stop(now + rel + .1);
        }catch(e){ /* already ended */ }
      }
      this.current = CBAudio.playBuffer(buf, {
        vel: .95,
        // The mainframe is only slightly slow. The character comes from its
        // restricted signal, not from dragging a normal voice into the floor.
        rate: voiceRole === 'robot' ? .96 : deliveryRate(deliv),
        detune: voiceRole === 'robot'
          ? -60
          : sincerityDetune(sinc) + this.pitch*100 + octave,
        bus: 'vox', // through the drive + delay chain
        robot: voiceRole === 'robot',
        warble: voiceRole === 'robot' ? .24 : .15 + (1-sinc)*.55,
      });
      return;
    }
    this.speak(text, {
      pitch: Math.max(.75, Math.min(1, 1 + (sincerityDetune(sinc) + octave)/1200)),
      rate: deliveryRate(deliv),
    });
  },
  speak(text, opts){
    const o = opts || {};
    try{
      speechSynthesis.cancel();
      // emoji live in the display copy, not in the larynx
      const clean = String(text).replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, '').trim();
      const u = new SpeechSynthesisUtterance(clean);
      u.pitch = Math.max(0, Math.min(2, (o.pitch===undefined ? 1 : o.pitch) + CBVoice.pitch/12));
      u.rate = o.rate===undefined ? 1 : o.rate;
      u.volume = o.volume===undefined ? 1 : o.volume;
      speechSynthesis.speak(u);
    }catch(e){ console.warn('speech unavailable', e); }
  }
};
