import score from './score.json';
import manifest from './audio-manifest.json';
import {voiceEnvelope,levelAt} from './voice-envelope.js';

export const TRACKS = score.tracks;
export const VOCABULARY = score.vocabulary;
export const MIX_PARTS = ['drums', 'keys', 'vocals', 'bass'];
const freshMutes = () => Object.fromEntries(MIX_PARTS.map(name => [name, false]));
export const durationOf = track => 128 * 60 / track.bpm;
export const formatTime = time => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
export const responseOffset = (duration, bpm) => {
  const beat = 60 / bpm;
  return Math.max(beat * 4, Math.ceil((duration + .18) / beat) * beat);
};
const LEVELS = [
  {drums:.70, bass:.93, keys:.82, lift:0},
  {drums:.90, bass:.96, keys:1, lift:.52},
  {drums:1, bass:1, keys:1, lift:1},
];

export function createRemixEngine({onChange = () => {}, audioBase = '../studio-2/audio/',
  contextFactory = () => new (window.AudioContext || window.webkitAudioContext)(),
  fetchImpl = (...args) => fetch(...args), setTimer = setInterval, clearTimer = clearInterval,
  initialIndex = 0, meetingVoices = false, tracks = TRACKS, audioManifest = manifest, initialQueue} = {}) {
  let queue = initialQueue?.length ? [...initialQueue] : tracks.map((_,i)=>i);
  const adjacent = delta => queue[(Math.max(0,queue.indexOf(state.index))+delta+queue.length)%queue.length];
  let state = {index:initialIndex, playing:false, loading:false, elapsed:0, energy:1,
    confidence:0, voice:'duet', volume:.8, text:tracks[initialIndex].pairs[0][0],
    response:tracks[initialIndex].pairs[0][1], speaker:'M', speaking:false, vocalLevel:0,
    queued:'', muted:freshMutes(), status:'Choose a track. Make a small scene.', error:''};
  let ctx, master, compressor, analyser, spectrum, voiceBus, bedFilter;
  const speakerBuses = {};
  let buses = {}, sources = new Set(), voiceSources = new Set(), cueList = [];
  let timer, generation = 0, disposed = false, origin = 0, nextPair = 0;
  let loaded, queuedPair = null, canResume = false;
  const cache = new Map();
  const emit = patch => {state = {...state, ...patch}; if(!disposed) onChange({...state});};
  const track = () => tracks[state.index];
  const elapsed = () => ctx ? Math.max(0, Math.min(durationOf(track()), ctx.currentTime-origin)) : state.elapsed;
  const clearTick = () => {if(timer !== undefined) clearTimer(timer); timer = undefined;};

  function init() {
    if(ctx) return;
    ctx = contextFactory();
    // Prefer the playback session on supporting iOS versions.
    try {if(navigator.audioSession) navigator.audioSession.type = 'playback';} catch {}
    master = ctx.createGain(); master.gain.value = state.volume;
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -5; compressor.knee.value = 12;
    compressor.ratio.value = 4; compressor.attack.value = .004; compressor.release.value = .16;
    master.connect(compressor); compressor.connect(ctx.destination);
    analyser = ctx.createAnalyser(); analyser.fftSize = 128; analyser.smoothingTimeConstant = .82;
    compressor.connect(analyser); spectrum = new Uint8Array(analyser.frequencyBinCount);
    for(const name of ['drums','bass','keys','lift']) {
      buses[name] = ctx.createGain(); buses[name].gain.value = state.muted[name === 'lift' ? (meetingVoices?'vocals':'keys') : name] ? 0 : LEVELS[state.energy][name]; buses[name].connect(master);
    }
    buses.bed=ctx.createGain();
    bedFilter=ctx.createBiquadFilter?.();
    if(bedFilter){bedFilter.type='lowpass';bedFilter.frequency.value=7800;bedFilter.Q.value=.65;buses.bed.connect(bedFilter);bedFilter.connect(master);}
    else buses.bed.connect(master);
    voiceBus = ctx.createGain(); voiceBus.gain.value = state.voice === 'instrumental' || (!meetingVoices && state.muted.vocals) ? 0 : .82; voiceBus.connect(master);
    if(meetingVoices) for(const [speaker,part] of [['M','drums'],['F','keys']]) {
      speakerBuses[speaker]=ctx.createGain();speakerBuses[speaker].gain.value=state.muted[part]?0:1;speakerBuses[speaker].connect(voiceBus);
    }
    ctx.onstatechange = () => {
      if(ctx.state === 'interrupted' && state.playing) {
        clearTick(); emit({playing:false, elapsed:elapsed(), status:'Playback interrupted. Press play to continue.'});
      }
    };
  }

  async function fetchBuffer(file) {
    const result = await fetchImpl(file.startsWith('/')?file:audioBase + file);
    if(!result.ok) throw new Error('This track could not load. Please try again.');
    return ctx.decodeAudioData(await result.arrayBuffer());
  }
  function load(id) {
    if(cache.has(id)) return cache.get(id);
    const data = id === 'vocabulary' ? audioManifest.vocabulary : audioManifest.tracks[id];
    const promise = (id === 'vocabulary'
      ? fetchBuffer(data.file).then(voice => ({voice, metadata:data}))
      : Promise.all([fetchBuffer(data.music.file), fetchBuffer(data.voice.file)])
        .then(([music, voice]) => ({music, voice, metadata:data})))
      .catch(error => {cache.delete(id); throw error;});
    cache.set(id, promise);
    // At most two music packs plus the small shared vocabulary pack are retained.
    const musicKeys = [...cache.keys()].filter(key => key !== 'vocabulary');
    while(musicKeys.length > 2) cache.delete(musicKeys.shift());
    return promise;
  }
  function register(source, gain) {
    sources.add(source);
    if(gain) voiceSources.add(source);
    source.onended = () => {sources.delete(source); voiceSources.delete(source); source.disconnect(); gain?.disconnect();};
  }
  function stopSources(when = ctx?.currentTime || 0) {
    for(const source of sources) {try {source.stop(when);} catch {}}
    sources.clear(); voiceSources.clear(); canResume = false;
  }
  function musicAt(offset, when) {
    for(const [name, segment] of Object.entries(loaded.metadata.music.stems)) {
      const node = ctx.createBufferSource(); node.buffer = loaded.music;
      node.loop = true; node.loopStart = segment.start; node.loopEnd = segment.start + segment.duration;
      node.connect(buses[name]); register(node);
      node.start(when, segment.start + offset % segment.duration);
    }
    canResume = true;
  }
  function scheduleVoice(text, speaker, at, voice, metadata, offset) {
    const clip = metadata.clips[text][speaker];
    const skipped = Math.max(0, offset - at);
    if(skipped >= clip.duration || state.voice === 'instrumental') return;
    const start = Math.max(ctx.currentTime + .004, origin + at + skipped);
    // Align animation to the actual scheduled source start (including seek offsets).
    const cueAt = start - origin - skipped;
    cueList.push({at:cueAt, end:cueAt + clip.duration, text, speaker, envelope:voiceEnvelope(voice,clip)});
    const src = ctx.createBufferSource(); src.buffer = voice;
    const gain = ctx.createGain(); gain.gain.value = .86;
    src.connect(gain); gain.connect(speakerBuses[speaker] || voiceBus); register(src,gain);
    src.start(start, clip.start + skipped, clip.duration - skipped);
  }
  function schedulePair(pairIndex, offset) {
    const slot = 960 / track().bpm;
    const special = queuedPair?.kind === 'vocabulary' ? queuedPair : null;
    const pair = special?.item.pair || (state.confidence ? track().visionary : track().pairs)[pairIndex % 4];
    const data = special?.data || {voice:loaded.voice, metadata:loaded.metadata.voice};
    const at = pairIndex * slot + .10;
    const replyAt = at + responseOffset(data.metadata.clips[pair[0]].M.duration, track().bpm);
    scheduleVoice(pair[0], 'M', at, data.voice, data.metadata, offset);
    scheduleVoice(pair[1], state.voice === 'robot' ? 'M' : 'F', replyAt, data.voice, data.metadata, offset);
    if(queuedPair) {queuedPair = null; emit({queued:'',status:special ? `${special.item.label}. Now in circulation.` : 'Back to the chorus.'});}
  }
  function tick() {
    if(!state.playing || !loaded) return;
    let now = elapsed();
    if(now >= durationOf(track())-.01) {select(adjacent(1)); return;}
    const slot = 960 / track().bpm;
    // Skip missed slots after browser throttling; never fire a backlog of phrases.
    nextPair = Math.max(nextPair, Math.floor(now / slot));
    if(origin + nextPair*slot < ctx.currentTime + .12) {
      if(queuedPair?.kind === 'chorus') {
        const when = Math.max(ctx.currentTime+.008, origin + nextPair*slot);
        stopSources(when); origin = when; nextPair = 0; now = 0; cueList = [];
        musicAt(0,when);
      }
      schedulePair(nextPair++,now);
    }
    cueList = cueList.filter(cue => cue.end > now-12);
    const visual = performanceFrame();
    const current = [...cueList].reverse().find(cue => cue.at <= visual.time);
    const upcoming = cueList.find(cue => cue.at > now);
    emit({elapsed:now, ...(current ? {text:current.text, speaker:current.speaker,
      speaking:!!visual.speaker, vocalLevel:visual.level, response:upcoming?.text || ''} : {speaking:false,vocalLevel:0})});
  }

  function performanceFrame() {
    let time=elapsed();
    // On supporting browsers follow sound at the output, not audio still buffered.
    const stamp=ctx?.getOutputTimestamp?.();
    if(stamp?.contextTime>0 && typeof performance!=='undefined') {
      const outputTime=stamp.contextTime+(performance.now()-stamp.performanceTime)/1000;
      time=Math.max(0,Math.min(time,outputTime-origin));
    }
    const silent={speaker:null,level:0,time};
    if(!state.playing || !state.volume || state.voice==='instrumental' || (!meetingVoices&&state.muted.vocals)) return silent;
    const cue=[...cueList].reverse().find(c=>c.at<=time&&c.end>time);
    if(!cue || (meetingVoices&&state.muted[cue.speaker==='F'?'keys':'drums'])) return silent;
    return {speaker:cue.speaker,level:levelAt(cue.envelope,time-cue.at),time};
  }

  async function start(index, offset = 0) {
    if(disposed) return;
    const mine = ++generation;
    clearTick(); stopSources(); queuedPair = null; cueList = [];
    emit({index, loading:true, playing:false, elapsed:offset, error:'', queued:'',
      text:tracks[index].pairs[0][0], response:tracks[index].pairs[0][1], speaker:'M',speaking:false,status:'Loading your next career move…'});
    try {
      init();
      // This happens before any fetch: the user's original gesture unlocks audio.
      const resumed = ctx.resume();
      const [data] = await Promise.all([load(tracks[index].id), resumed]);
      if(mine !== generation || disposed) return;
      loaded = data; origin = ctx.currentTime + .06 - offset;
      nextPair = Math.floor(offset / (960 / track().bpm));
      musicAt(offset,ctx.currentTime+.06);
      applyLevels(ctx.currentTime);
      emit({loading:false, playing:true, status:'All changes. Perfectly aligned.'});
      timer = setTimer(tick,50); tick();
    } catch(error) {
      if(mine !== generation || disposed) return;
      stopSources(); emit({loading:false,playing:false,error:error.message || 'Audio is unavailable. Please try again.'});
    }
  }
  function select(index) {return start((index+tracks.length)%tracks.length);}
  function applyLevels(when) {
    if(!ctx) return;
    for(const name of Object.keys(buses)) {
      const p=buses[name].gain; p.cancelScheduledValues(ctx.currentTime);
      if(name==='bed'){p.setTargetAtTime(state.muted.vocals?0:[.72,.84,.95][state.energy],when,.035);continue;}
      p.setTargetAtTime(state.muted[name === 'lift' ? (meetingVoices?'vocals':'keys') : name] ? 0 : LEVELS[state.energy][name],when,.035);
    }
    if(bedFilter){bedFilter.frequency.cancelScheduledValues(ctx.currentTime);bedFilter.frequency.setTargetAtTime([2600,7800,18000][state.energy],when,.08);}
    voiceBus.gain.cancelScheduledValues(ctx.currentTime);
    voiceBus.gain.setTargetAtTime(state.voice === 'instrumental' || (!meetingVoices&&state.muted.vocals) ? 0 : .82,ctx.currentTime,.04);
    for(const [speaker,part] of [['M','drums'],['F','keys']]) {
      const p=speakerBuses[speaker]?.gain;if(!p)continue;
      p.cancelScheduledValues(ctx.currentTime);p.setTargetAtTime(state.muted[part]?0:1,ctx.currentTime,.025);
    }
  }
  function setting(key,value) {
    const valid = key === 'energy' ? [0,1,2].includes(value) : key === 'confidence' ? [0,1].includes(value) : key === 'voice' && ['robot','duet','instrumental'].includes(value);
    if(!valid) return;
    emit({[key]:value,status:state.playing ? (key === 'energy' ? 'New energy on the next bar.' : 'New delivery on the next phrase.') : 'Your mix is ready.'});
    if(key === 'voice' && value === 'instrumental') {
      for(const source of voiceSources) {try {source.stop(ctx.currentTime+.05);} catch {}}
      voiceSources.clear(); cueList=[]; queuedPair=null; emit({queued:'',speaking:false,vocalLevel:0,status:'The robots are on mute.'});
    }
    const bar = 240 / track().bpm;
    applyLevels(state.playing ? origin + Math.ceil(elapsed()/bar)*bar : ctx?.currentTime || 0);
  }
  return {
    getState:() => ({...state}), select, performanceFrame,
    async toggle() {
      if(state.loading) {generation++; clearTick(); stopSources(); emit({loading:false,playing:false,status:'Ready when you are.'}); return;}
      if(state.playing) {
        const mine=generation,position=elapsed(); clearTick(); await ctx.suspend();
        if(mine !== generation || disposed) return;
        emit({playing:false,elapsed:position,speaking:false,status:'Meeting adjourned. Temporarily.'}); return;
      }
      if(canResume && ctx && state.elapsed < durationOf(track())) {
        try {await ctx.resume(); emit({playing:true,error:'',status:'Back in circulation.'}); clearTick(); timer=setTimer(tick,50); tick();}
        catch {emit({error:'Playback could not resume. Choose a track to try again.'});}
      } else await start(state.index,state.elapsed);
    },
    setQueue(indices) {
      const valid=[...new Set(indices)].filter(i=>Number.isInteger(i)&&i>=0&&i<tracks.length);
      if(valid.length)queue=valid;
    },
    next:() => select(adjacent(1)),
    previous:() => select(state.elapsed>3 ? state.index : adjacent(-1)),
    seek(value) {
      const position=Math.max(0,Math.min(durationOf(track())-.05,Number(value)||0));
      if(state.playing || state.loading) return start(state.index,position);
      generation++; clearTick(); stopSources(); queuedPair=null; cueList=[];
      emit({elapsed:position,queued:'',speaking:false});
    },
    setting,
    participant(name) {
      if(!MIX_PARTS.includes(name) || (audioManifest.tracks[track().id]?.music.mode==='bed'&&name==='bass')) return;
      const muted = {...state.muted, [name]:!state.muted[name]};
      const bed=audioManifest.tracks[track().id]?.music.mode==='bed';
      const label=bed?({drums:'Voice 01',keys:'Voice 02',vocals:'Backing track'})[name]:meetingVoices?({drums:'Voice 01 and drums',keys:'Voice 02 and keys',vocals:'Automation synths',bass:'Bass'})[name]:name==='vocals'?'Robot vocals':name[0].toUpperCase()+name.slice(1);
      emit({muted,status:`${label} ${muted[name] ? 'muted' : 'back in the meeting'}.`});
      // A short gain ramp makes individual mic changes immediate and click-free.
      // Sources keep running, so unmuting always rejoins at the correct phase.
      applyLevels(ctx?.currentTime || 0);
    },
    circleBack() {
      if(!state.playing) {this.seek(0);emit({status:'Chorus ready. Press play.'});return;}
      queuedPair={kind:'chorus'};emit({queued:'chorus',status:'Chorus queued for the next phrase.'});
    },
    async vocabulary(id) {
      const item=VOCABULARY.find(v=>v.id===id);if(!item || state.loading || !state.playing) return;
      const mine=generation;
      emit({queued:id,status:`Preparing ${item.label.toLowerCase()}…`});
      try {
        const data=await load('vocabulary');
        if(mine !== generation || disposed || state.queued !== id) return;
        queuedPair={kind:'vocabulary',item,data};emit({status:`${item.label} queued for the next phrase.`});
      } catch {if(mine === generation) emit({queued:'',error:'That phrase could not load. The music will keep playing.'});}
    },
    reset() {queuedPair=null;emit({energy:1,confidence:0,voice:'duet',muted:freshMutes(),queued:'',status:'Original mix restored.'});applyLevels(ctx?.currentTime || 0);},
    volume(value) {const v=Math.max(0,Math.min(1,Number(value)||0));emit({volume:v});master?.gain.setTargetAtTime(v,ctx.currentTime,.03);},
    spectrum() {if(!analyser || !state.playing)return null;analyser.getByteFrequencyData(spectrum);return spectrum;},
    dispose() {disposed=true;generation++;clearTick();stopSources();cache.clear();if(ctx){ctx.onstatechange=null;ctx.close().catch(()=>{});}},
  };
}
