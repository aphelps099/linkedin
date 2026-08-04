// CBAudio — drum synth ported from reference/transient-16.html (WebAudio, no samples)
// Extended for the sampler + clip export: buffer decode/playback and a MediaStream
// tap on the master bus so everything (drums, exhibits, vox bank) can be recorded.
export const CBAudio = (() => {
  let ctx, master, comp, noiseBuf, streamDest;
  function init(){
    if(ctx) return;
    ctx = new (window.AudioContext||window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .85;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6; comp.ratio.value = 12; comp.attack.value = .003; comp.release.value = .15;
    master.connect(comp); comp.connect(ctx.destination);
    streamDest = ctx.createMediaStreamDestination();
    comp.connect(streamDest);
    const len = ctx.sampleRate*2, b = ctx.createBuffer(1,len,ctx.sampleRate), d = b.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
    noiseBuf = b;
  }
  const rs = ()=> ctx && ctx.state==='suspended' && ctx.resume();
  function noise(t,dur){ const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = .8+Math.random()*.4; s.start(t, Math.random()*1.5, dur+.02); return s; }
  function env(t,peak,dur,atk){ const g = ctx.createGain(); const a = atk===undefined?.001:atk;
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak,.0002),t+a);
    g.gain.exponentialRampToValueAtTime(.0001,t+a+dur); return g; }
  function osc(type,f,t){ const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f,t); o.start(t); return o; }
  function filt(type,f,q){ const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if(q!==undefined) b.Q.value = q; return b; }
  const METAL = [2,3,4.16,5.43,6.79,8.21];
  function trigger(v, vel=1, when){
    init(); rs();
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
  }
  function decode(arrayBuffer){ init(); return ctx.decodeAudioData(arrayBuffer); }
  function playBuffer(buffer, opts){
    const o = opts || {};
    init(); rs();
    const t = o.when===undefined ? ctx.currentTime+.001 : o.when;
    const src = ctx.createBufferSource(); src.buffer = buffer;
    if(o.rate!==undefined) src.playbackRate.value = o.rate;
    if(o.detune) try{ src.detune.value = o.detune; }catch(e){ /* detune unsupported */ }
    const g = ctx.createGain(); g.gain.value = .9*(o.vel===undefined?1:o.vel);
    src.connect(g); g.connect(master); src.start(t);
    return src;
  }
  return {
    init, resume: rs, trigger, decode, playBuffer,
    now: ()=>{ init(); return ctx.currentTime; },
    stream: ()=>{ init(); return streamDest.stream; },
  };
})();

// CBVoice — the LinkedIn larynx. Prefers the recorded phrase bank (routed through
// CBAudio's master bus, so it lands in exports); falls back to speechSynthesis,
// which the browser cannot capture into a recording.
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
  // sinc/deliv are 0–1 registers; same voice math as the prototype:
  // pitch = .4 + sinc*1.4, rate = .6 + deliv*.8
  speakPhrase(i, text, sinc, deliv){
    const buf = this.bank.get(i);
    if(buf){
      try{ this.current && this.current.stop(); }catch(e){ /* already ended */ }
      this.current = CBAudio.playBuffer(buf, {
        vel: .95,
        rate: .6 + deliv*.8,
        detune: ((.4 + sinc*1.4) - 1) * 1200,
      });
      return;
    }
    this.speak(text, {pitch:.4 + sinc*1.4, rate:.6 + deliv*.8});
  },
  speak(text, opts){
    const o = opts || {};
    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.pitch = o.pitch===undefined ? 1 : o.pitch;
      u.rate = o.rate===undefined ? 1 : o.rate;
      u.volume = o.volume===undefined ? 1 : o.volume;
      speechSynthesis.speak(u);
    }catch(e){ console.warn('speech unavailable', e); }
  }
};
