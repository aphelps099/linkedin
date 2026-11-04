// One arrangement, two clocks: the live AudioContext and the offline render
// share buildGraph() and scheduleStep(), so the download is the performance.
//
// Master chain:  stems + returns → master → call | full (muted intro)
//   → section energy → choke → tape (varispeed delay line) → glue → limiter
//   → soft clip → out.   Post-choke: the tag.   Post-tape: the deep voice.
import {BAR_STEPS, PATTERNS, hatVelocity, shakerVelocity, STEP} from './song.js';
import * as I from './instruments.js';
import {createVocoder} from './vocoder.js';
import {createMobileAudio} from '../audio-session.js';
import {truePeakLimit} from './master.js';

export const STEMS = ['drums', 'bass', 'keys', 'guitar', 'voice', 'lady'];
export const VOICE_MODES = {sung:{vocoder:1, dry:.06}, spoken:{vocoder:0, dry:.9}, both:{vocoder:.85, dry:.42}};
// Section energy before the bus compressor: the drops have somewhere to go.
const ENERGY = {Intro:.46, Verse:.45, Build:.56, 'Drop A':1, 'Sink In':.85, 'Drop B':1, Outro:.55};
const dB = x => 10 ** (x / 20);

function stem(ctx, master, sends, {duck = 0, under = 1, reverb = 0, delay = 0, level = 1, pan = 0, haas = 0} = {}) {
  const input = I.amp(ctx, 1), mute = I.amp(ctx, 1), ducker = I.amp(ctx, 1), voiced = I.amp(ctx, 1), out = I.amp(ctx, level), meter = ctx.createAnalyser();
  meter.fftSize = 512;
  input.connect(mute); mute.connect(ducker); ducker.connect(voiced); voiced.connect(out); out.connect(meter);
  if (haas) {
    // Width: the right channel arrives a few milliseconds late.
    const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2), late = ctx.createDelay(.05);
    late.delayTime.value = haas / 1000;
    out.connect(split); split.connect(merge, 0, 0); split.connect(late, 1); late.connect(merge, 0, 1); merge.connect(master);
  } else if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; out.connect(p); p.connect(master); } else out.connect(master);
  if (reverb) { const s = I.amp(ctx, reverb); out.connect(s); s.connect(sends.reverb); }
  if (delay) { const s = I.amp(ctx, delay); out.connect(s); s.connect(sends.delay); }
  return {input, mute, ducker, voiced, out, meter, duck, under};
}

function softClip(ctx) {
  // Transparent below -4.4 dBFS, a gentle shoulder to a -1.7 dBFS ceiling,
  // which leaves room for inter-sample peaks: true peak stays under -1 dBTP.
  // 4× oversampled so the shoulder itself does not alias.
  const clip = ctx.createWaveShaper(), curve = new Float32Array(4096);
  for (let i = 0; i < curve.length; i++) { const x = i / 2047.5 - 1, a = Math.abs(x); curve[i] = a < .6 ? x : Math.sign(x) * (.6 + .22 * Math.tanh((a - .6) / .22)); }
  clip.curve = curve; clip.oversample = '4x';
  return clip;
}

export function buildGraph(ctx, {mode = 'sung', muted = {}, tune = {}} = {}) {
  const master = I.amp(ctx, 1);
  // The muted intro: the band heard through a call, band-limited, mono, crushed.
  const full = I.amp(ctx, 1), call = I.amp(ctx, 0), callHp = I.biquad(ctx, 'highpass', 300, .7), callLp = I.biquad(ctx, 'lowpass', 3400, .7);
  const callMono = I.amp(ctx, 1); callMono.channelCount = 1; callMono.channelCountMode = 'explicit';
  const crush = ctx.createWaveShaper(), steps = new Float32Array(1024);
  for (let i = 0; i < steps.length; i++) steps[i] = Math.round((i / 511.5 - 1) * 24) / 24;
  crush.curve = steps;
  const callGap = I.amp(ctx, 1);
  master.connect(full); master.connect(call); call.connect(callHp); callHp.connect(callLp); callLp.connect(callMono); callMono.connect(crush); crush.connect(callGap);
  const energy = I.amp(ctx, 1), choke = I.amp(ctx, 1);
  full.connect(energy); callGap.connect(energy); energy.connect(choke);
  // Tape: a delay line whose delay grows makes everything after it slow down
  // and fall in pitch together (pitch = 1 - d'(t)): Sink In and the tape-stop.
  const tapeIn = I.amp(ctx, 1), tapeDry = I.amp(ctx, 1), tapeWet = I.amp(ctx, 0), tapeDelay = ctx.createDelay(2), tapeLp = I.biquad(ctx, 'lowpass', 20000, .7);
  tapeDelay.delayTime.value = 0;
  choke.connect(tapeIn); tapeIn.connect(tapeDry); tapeIn.connect(tapeDelay); tapeDelay.connect(tapeLp); tapeLp.connect(tapeWet);
  const tag = I.amp(ctx, 1); tag.connect(tapeIn);           // post-choke: the tag
  const post = I.amp(ctx, 1); tapeDry.connect(post); tapeWet.connect(post);
  const deep = I.amp(ctx, 1.4); deep.connect(post);          // post-tape: the deep voice
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -10; glue.ratio.value = 2; glue.knee.value = 6; glue.attack.value = .03; glue.release.value = .16;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3; limiter.ratio.value = 20; limiter.knee.value = 0; limiter.attack.value = .001; limiter.release.value = .09;
  const output = I.amp(ctx, tune.output ?? 1.25), analyser = ctx.createAnalyser();
  analyser.fftSize = 1024; analyser.smoothingTimeConstant = .72;
  // tune.raw skips the bus compressor and limiter, for measuring stem balance.
  // Trim: the drop should arrive just under the limiter, not deep into it.
  const trim = I.amp(ctx, tune.trim ?? .4); post.connect(trim);
  if (tune.raw) trim.connect(output); else { trim.connect(glue); glue.connect(limiter); limiter.connect(output); }
  const clip = softClip(ctx);
  const eqAnalyser = ctx.createAnalyser(); eqAnalyser.fftSize = 4096; eqAnalyser.smoothingTimeConstant = 0;
  output.connect(clip); clip.connect(analyser); clip.connect(eqAnalyser);
  // tune.stems: an offline render with every stem on its own channel after the
  // stereo master (channels 0-1 master, then one mono channel per stem), so an
  // export can compute the scene equalizer frame-exactly.
  let merger = null;
  if (tune.stems) {
    merger = ctx.createChannelMerger(2 + STEMS.length);
    const split = ctx.createChannelSplitter(2), stereo = I.amp(ctx, 1);
    stereo.channelCount = 2; stereo.channelCountMode = 'explicit';          // a mono master fills both sides
    clip.connect(stereo); stereo.connect(split); split.connect(merger, 0, 0); split.connect(merger, 1, 1); merger.connect(ctx.destination);
  } else clip.connect(ctx.destination);

  const reverb = ctx.createConvolver(); reverb.buffer = I.impulse(ctx);
  const reverbIn = I.biquad(ctx, 'highpass', 280), reverbOut = I.amp(ctx, .55);
  reverbIn.connect(reverb); reverb.connect(reverbOut); reverbOut.connect(master);
  const delayIn = I.biquad(ctx, 'highpass', 350), delay = ctx.createDelay(2), feedback = I.amp(ctx, .34), damp = I.biquad(ctx, 'lowpass', 3200), delayOut = I.amp(ctx, .5);
  delay.delayTime.value = STEP * 6;                                     // dotted eighth
  delayIn.connect(delay); delay.connect(damp); damp.connect(feedback); feedback.connect(delay); damp.connect(delayOut); delayOut.connect(master);
  const sends = {reverb:reverbIn, delay:delayIn};

  const stems = {
    drums:stem(ctx, master, sends, {reverb:.12, level:1}),
    bass:stem(ctx, master, sends, {duck:.12, level:.55}),
    keys:stem(ctx, master, sends, {duck:.28, under:.6, reverb:.38, delay:.16, level:2.3, haas:16}),
    guitar:stem(ctx, master, sends, {duck:.45, under:.6, reverb:.2, delay:.1, level:7, haas:18}),
    voice:stem(ctx, master, sends, {duck:.88, reverb:.2, delay:.24, level:1.35}),
    lady:stem(ctx, master, sends, {reverb:.16, delay:.12, level:tune.ladyLevel ?? 1.1}),
  };
  // Drum-bus high-pass for the build; Synergy's answer filter in the build.
  const drumHp = I.biquad(ctx, 'highpass', 20, .7); drumHp.connect(stems.drums.input);
  // Stabs and pad stay out of the bass's way: everything under ~200 Hz belongs to Pat.
  const keysFilter = I.biquad(ctx, 'lowpass', 3000, .9), padFilter = I.biquad(ctx, 'lowpass', 1100, .8);
  const keysHp = I.biquad(ctx, 'highpass', 210, .6), padHp = I.biquad(ctx, 'highpass', 180, .6);
  keysFilter.connect(keysHp); keysHp.connect(stems.keys.input); padFilter.connect(padHp); padHp.connect(stems.keys.input);

  // Synergy: speech into the vocoder; a saw choir as the carrier.
  const vocoder = createVocoder(ctx, tune.vocoder), words = I.amp(ctx, 1), dry = I.amp(ctx, tune.dry ?? VOICE_MODES[mode].dry), sung = I.amp(ctx, VOICE_MODES[mode].vocoder);
  const voiceHp = I.biquad(ctx, 'highpass', 130), voiceLp = I.biquad(ctx, 'lowpass', 20000, .7), voiceComp = ctx.createDynamicsCompressor();
  voiceComp.threshold.value = -28; voiceComp.ratio.value = 5; voiceComp.attack.value = .003; voiceComp.release.value = .12;
  const voiceGain = I.amp(ctx, 2.1);
  words.connect(vocoder.input); words.connect(dry); dry.connect(voiceHp);
  vocoder.output.connect(sung); sung.connect(voiceHp);
  voiceHp.connect(voiceLp); voiceLp.connect(voiceComp); voiceComp.connect(voiceGain); voiceGain.connect(stems.voice.input);
  // The lady can be pulled into the same vocoder (the ladder, the impact).
  const ladySend = I.amp(ctx, 1); ladySend.connect(vocoder.input);

  const lead = [], harmony = [];
  const carrierMix = I.amp(ctx, 1);
  carrierMix.connect(vocoder.carrier);
  [[0, .5], [7, .32], [-1200, .26]].forEach(([detune, level]) => {
    const o = ctx.createOscillator(), g = I.amp(ctx, level); o.type = 'sawtooth'; o.frequency.value = 220; o.detune.value = detune; o.connect(g); g.connect(carrierMix); lead.push(o);
  });
  for (let i = 0; i < 4; i++) {
    const o = ctx.createOscillator(), g = I.amp(ctx, 0); o.type = 'sawtooth'; o.frequency.value = 220; o.connect(g); g.connect(carrierMix); harmony.push({o, g});
  }
  const hiss = ctx.createBufferSource(), hissHp = I.biquad(ctx, 'highpass', 3800), hissGain = I.amp(ctx, .16);
  hiss.buffer = I.noiseBuffer(ctx); hiss.loop = true; hiss.connect(hissHp); hissHp.connect(hissGain); hissGain.connect(carrierMix);
  const oscillators = [...lead, ...harmony.map(h => h.o), hiss];

  // The scene equalizer hears each stem through a tap the choke also closes
  // (so nothing moves in the silence); the lady's tap adds her post-choke tag
  // and her deep voice. 2048-point analysers: the level meters' 86 Hz bins are
  // too coarse under 250 Hz. A tune.stems render puts the same taps on channels.
  const eqTap = {};
  for (const name of STEMS) { eqTap[name] = I.amp(ctx, 1); stems[name].out.connect(eqTap[name]); }
  const ladyEq = I.amp(ctx, 1); eqTap.lady.connect(ladyEq); tag.connect(ladyEq); deep.connect(ladyEq);
  const eqSource = {...eqTap, lady:ladyEq};
  const spectra = Object.fromEntries(STEMS.map(name => { const a = ctx.createAnalyser(); a.fftSize = 2048; a.smoothingTimeConstant = 0; eqSource[name].connect(a); return [name, a]; }));
  if (merger) STEMS.forEach((name, i) => eqSource[name].connect(merger, 0, 2 + i));
  const graph = {ctx, master, output, analyser, eqAnalyser, eqTap, spectra, stems, keysFilter, padFilter, drumHp, voiceLp, words, dry, sung, vocoder, ladySend, lead, harmony, oscillators, sources:new Set(),
    full, call, callGap, energy, choke, tag, deep, tapeDry, tapeWet, tapeDelay, tapeLp, reverbOut, delayOut, feedback};
  if (tune.voiceLevel) stems.voice.out.gain.value = tune.voiceLevel;
  if (tune.under !== undefined) ['keys', 'guitar'].forEach(n => { stems[n].under = tune.under; });
  setMuted(graph, muted, 0);
  return graph;
}

export function setMuted(graph, muted, ramp = .015) {
  const t = graph.ctx.currentTime;
  for (const name of STEMS) graph.stems[name].mute.gain.setTargetAtTime(muted[name] ? 0 : 1, t, ramp || .0001);
}

export function setVoiceMode(graph, mode) {
  const m = VOICE_MODES[mode] || VOICE_MODES.sung, t = graph.ctx.currentTime;
  graph.dry.gain.setTargetAtTime(m.dry, t, .02); graph.sung.gain.setTargetAtTime(m.vocoder, t, .02);
}

// Index the plan's events by step, once. `lady` holds decoded files and baked deep takes.
export function prepare(plan, buffers, lady = {files:new Map(), deep:new Map()}) {
  const at = new Map(), push = (step, key, value) => { if (!at.has(step)) at.set(step, {words:[], notes:[], stutters:[], lady:[]}); at.get(step)[key].push(value); };
  plan.words.forEach(w => { if (buffers.get(w.word)) push(w.at, 'words', w); w.notes.forEach(n => push(n.at, 'notes', n)); });
  plan.stutters.forEach(s => { if (buffers.get(s.word)) push(s.at, 'stutters', s); });
  (plan.lady || []).forEach((e, i) => { if (lady.files.get(e.file)) push(Math.floor(e.at), 'lady', {...e, index:i}); });
  const harmonyBars = new Set(plan.words.filter(w => w.harmony).map(w => Math.floor(w.at / BAR_STEPS)));
  return {plan, buffers, lady, at, harmonyBars};
}

function duck(graph, t) {
  for (const name of STEMS) {
    const s = graph.stems[name];
    if (!s.duck) continue;
    const g = s.ducker.gain;
    g.setValueAtTime(1, t); g.linearRampToValueAtTime(s.duck, t + .008); g.setTargetAtTime(1, t + .03, .075);
  }
}

// Keys and guitar step back while a voice is mid-word, then return.
function makeRoom(graph, t, length) {
  for (const name of STEMS) {
    const s = graph.stems[name];
    if (s.under === 1) continue;
    s.voiced.gain.setTargetAtTime(s.under, t - .01, .015); s.voiced.gain.setTargetAtTime(1, t + length, .09);
  }
}

function playWord(graph, buffer, t, {offset = 0, rate = 1, gate}) {
  const {ctx} = graph, s = ctx.createBufferSource(), g = I.amp(ctx);
  s.buffer = buffer.audio; s.playbackRate.value = rate;
  const start = buffer.lead + offset, available = (buffer.audio.duration - start) / rate, length = Math.min(gate, available);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .004);
  g.gain.setValueAtTime(1, t + Math.max(.005, length - .022)); g.gain.linearRampToValueAtTime(0, t + length);
  s.connect(g); g.connect(graph.words);
  s.start(t, start, length * rate + .01);
  makeRoom(graph, t, length);
  graph.sources.add(s); s.onended = () => { graph.sources.delete(s); s.disconnect(); g.disconnect(); };
}

function note(graph, t, midi) {
  const f = I.mtof(midi);
  graph.lead.forEach(o => o.frequency.setTargetAtTime(f, t, .007));
}

// One of the lady's events: dry to her stem (or the post-choke tag bus),
// optionally into Synergy's vocoder, optionally with a baked deep layer.
function playLady(graph, song, e, t) {
  const {ctx} = graph, buffer = song.lady.files.get(e.file);
  if (!buffer) return;
  const length = Math.min(e.gate, (e.to - e.from) / e.rate + .01), gain = dB(e.gain || 0);
  const s = ctx.createBufferSource(), env = I.amp(ctx);
  s.buffer = buffer; s.playbackRate.value = e.rate;
  if (e.bend) {
    s.detune.setValueAtTime(0, t); s.detune.linearRampToValueAtTime(e.bend.cents, t + length * e.bend.at); s.detune.linearRampToValueAtTime(0, t + length * e.bend.back);
  }
  if (e.lift) { s.detune.setValueAtTime(0, t + length * e.lift.from); s.detune.linearRampToValueAtTime(e.lift.cents, t + length); }
  env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + .003);
  env.gain.setValueAtTime(1, t + Math.max(.004, length - .015)); env.gain.linearRampToValueAtTime(0, t + length);
  s.connect(env);
  const dryLevel = gain * (1 - (e.blend || 0) * .5);
  const dryOut = I.amp(ctx, dryLevel), nodes = [s, env, dryOut];
  env.connect(dryOut);
  if (e.role === 'tag') dryOut.connect(graph.tag);
  else if (e.role === 'stop') { dryOut.gain.value = dryLevel / 1.4; dryOut.connect(graph.deep); }   // she stops the tape; the tape does not stop her
  else if (e.pan) { const p = ctx.createStereoPanner(); p.pan.value = e.pan; dryOut.connect(p); p.connect(graph.stems.lady.input); nodes.push(p); }
  else dryOut.connect(graph.stems.lady.input);
  const send = (e.vocoded ?? e.blend) || 0;
  if (send) {
    const g = I.amp(ctx, gain * send * 1.6); env.connect(g); g.connect(graph.ladySend); nodes.push(g);
    if (e.midi) note(graph, t, e.midi);
  }
  s.start(t, e.from, (e.to - e.from) + .01);
  makeRoom(graph, t, length);
  if (e.role === 'impact' || e.dip) {
    // The kick's transient passes, then drums and bass dip under the word and swell back.
    const depth = e.role === 'impact' ? .45 : e.dip;
    for (const name of ['drums', 'bass']) {
      const g = graph.stems[name].voiced.gain;
      g.setValueAtTime(1, t + .015); g.linearRampToValueAtTime(depth, t + .03); g.setValueAtTime(depth, t + length); g.linearRampToValueAtTime(1, t + length + .16);
    }
  }
  const deep = song.lady.deep.get(e.index);
  if (deep) {
    const d = ctx.createBufferSource(), dg = I.amp(ctx, gain * e.deep), at = t + (e.deepAt || 0) * STEP;
    d.buffer = deep; d.connect(dg); dg.connect(graph.deep);
    const room = e.role === 'sink' ? 2 : deep.duration;
    dg.gain.setValueAtTime(gain * e.deep, at + room - .03); dg.gain.linearRampToValueAtTime(0, at + room);
    // Its own lifetime: it may start after the dry word has ended (BACK.'s echo).
    d.start(at); d.stop(at + room + .01); d.onended = () => { d.disconnect(); dg.disconnect(); };
  }
  graph.sources.add(s); s.onended = () => { graph.sources.delete(s); nodes.forEach(n => n.disconnect()); };
}

// ---- section-level events --------------------------------------------------

function tapeEvent(graph, tape, T) {
  const {tapeDry, tapeWet, tapeDelay, tapeLp} = graph, start = T(tape.from), points = 256;
  const curve = new Float32Array(points);
  if (tape.kind === 'sink') {
    // pitch falls 1 → .5 linearly across the span: d(t) = 0.25·t²/D.
    const end = T(tape.to), D = end - start;
    for (let i = 0; i < points; i++) { const u = i / (points - 1); curve[i] = .25 * D * u * u; }
    tapeWet.gain.setValueAtTime(1, start); tapeDry.gain.setValueAtTime(0, start);
    tapeDelay.delayTime.setValueCurveAtTime(curve, start, D);
    tapeWet.gain.setValueAtTime(1, end - .004); tapeWet.gain.linearRampToValueAtTime(0, end);
    tapeDry.gain.setValueAtTime(0, end - .004); tapeDry.gain.linearRampToValueAtTime(1, end);
    tapeDelay.delayTime.setValueAtTime(0, end + .01);
  } else {
    // tape-stop: pitch 1 → 0 over `seconds`: d(t) = t²/(2·S); then silence.
    const S = tape.seconds;
    for (let i = 0; i < points; i++) { const u = i / (points - 1) * S; curve[i] = u * u / (2 * S); }
    tapeWet.gain.setValueAtTime(1, start); tapeDry.gain.setValueAtTime(0, start);
    tapeDelay.delayTime.setValueCurveAtTime(curve, start, S);
    tapeLp.frequency.setValueAtTime(12000, start); tapeLp.frequency.exponentialRampToValueAtTime(300, start + S);
    tapeWet.gain.setValueAtTime(1, start + S - .03); tapeWet.gain.linearRampToValueAtTime(0, start + S);
  }
}

function songEvents(graph, plan, step, T) {
  const t = T(step);
  if (plan.call) {
    if (step === 0) { graph.full.gain.setValueAtTime(0, t); graph.call.gain.setValueAtTime(1.6, t); }
    for (const d of plan.call.dropouts) if (d.at === step) { graph.callGap.gain.setValueAtTime(0, t); graph.callGap.gain.setValueAtTime(1, t + d.seconds); }
    if (step === plan.call.until) {
      // Unmute: the call band-pass opens to the full mix in one 16th.
      graph.call.gain.setValueAtTime(1.6, t); graph.call.gain.linearRampToValueAtTime(0, t + STEP);
      graph.full.gain.setValueAtTime(0, t); graph.full.gain.linearRampToValueAtTime(1, t + STEP);
    }
  }
  if (plan.choke) {
    if (step === plan.choke.at) {
      // Everything stops in 6 ms, returns included, so the silence is silent.
      for (const g of [graph.choke.gain, ...STEMS.map(n => graph.eqTap[n].gain)]) { g.setValueAtTime(1, t); g.linearRampToValueAtTime(0, t + .006); }
      graph.feedback.gain.setValueAtTime(0, t);
      graph.reverbOut.gain.setValueAtTime(.55, t); graph.reverbOut.gain.linearRampToValueAtTime(0, t + .006);
    }
    if (step === plan.choke.until) {
      for (const g of [graph.choke.gain, ...STEMS.map(n => graph.eqTap[n].gain)]) g.setValueAtTime(1, t);
      graph.feedback.gain.setValueAtTime(.34, t);
      graph.reverbOut.gain.setValueAtTime(0, t); graph.reverbOut.gain.linearRampToValueAtTime(.55, t + .4);
    }
  }
  for (const tape of plan.tape || []) if (tape.from === step) tapeEvent(graph, tape, T);
}

// ---- the band ----------------------------------------------------------------

function drums(graph, b, bar, s, t, T) {
  const {ctx} = graph, D = graph.drumHp, L = b.layers, style = L.drums || 'four';
  if (style === 'four') {
    const holdBreath = (L.holdBreath ?? bar === 11) && s >= 12;           // the room holds its breath
    if (L.kick && !holdBreath && PATTERNS.kick.includes(s) && s < (L.kickUntil ?? 16)) { I.kick(ctx, D, t, 1); duck(graph, t); }
    if (L.clap && PATTERNS.clap.includes(s)) I.clap(ctx, D, t, .62);
    if ((L.holdBreath ?? bar === 11) && (s === 14 || s === 15)) I.clap(ctx, D, t, s === 14 ? .35 : .5);
    if (L.fill && s >= 8 && s % 2 === 0) I.clap(ctx, D, t, .3 + .04 * (s - 8));
    if (L.fill && s >= 12) I.snareRoll(ctx, D, t, .35 + .05 * (s - 12));
    if (L.roll === true) { if (s % 2 === 0 || s >= 8) I.clap(ctx, D, t, .18 + .5 * s / 15); }
    if (L.hats) {
      const breakdown = b.section === 'Breakdown';
      const v = breakdown ? (s % 2 === 0 ? .2 + .05 * (bar - 14) * 4 : 0) : hatVelocity(s);
      if (v) I.hat(ctx, D, t, v * .55);
    }
    if (L.open && PATTERNS.open.includes(s)) I.openHat(ctx, D, t, .2);
    if (L.ride && PATTERNS.open.includes(s)) I.ride(ctx, D, t, .16);
  } else if (style === 'build') {
    if (L.kick && s % 4 === 0) { I.kick(ctx, D, t, 1); duck(graph, t); }
    if (L.hats) { const v = L.hatsStraight ? (s % 4 === 0 ? .3 : .2) : hatVelocity(s); if (v) I.hat(ctx, D, t, v * .55); }
    if (L.open && PATTERNS.open.includes(s)) I.openHat(ctx, D, t, .18);
    const [rate, v0, v1] = L.roll, last = bar === 19 ? 8 : 16;          // the last bar stops at the choke
    if (s < last) {
      const v = v0 + (v1 - v0) * s / 15, tone = 200 + 200 * L.rung / 7;
      if (rate >= 2) { if (s % rate === 0) I.clap(ctx, D, t, v); }
      else if (rate === 1) I.snareRoll(ctx, D, t, v, tone);
      else { I.snareRoll(ctx, D, t, v, tone); I.snareRoll(ctx, D, t + STEP / 2, v, tone); }
    }
  } else if (style === 'half') {
    if (s === 0 || (s === 10 && bar !== 20)) { I.kick(ctx, D, t, s ? .8 : 1); duck(graph, t); }
    if (s === 8) { I.snare(ctx, D, t, .9); I.clap(ctx, D, t, .45); }
    if (L.hats) I.hat(ctx, D, t, (s % 4 === 2 ? .32 : s % 2 ? .14 : .2) * .55);
    if (L.ride && s % 4 === 2) I.ride(ctx, D, t, .2);
  } else if (style === 'downbeat') {
    if (s === 0) { I.kick(ctx, D, t, 1); duck(graph, t); }
  }
  if (L.shaker) I.shaker(ctx, D, t, shakerVelocity(s) * .5);
  if (L.rim && PATTERNS.rim.includes(s)) I.rim(ctx, D, t, .16);
}

function bassline(graph, b, s, t, barEnd) {
  const {ctx} = graph, L = b.layers, chord = b.chord, out = graph.stems.bass.input;
  const style = L.bass === true ? 'offbeat' : L.bass;
  if (style === 'offbeat') { for (const [at, interval, length] of PATTERNS.bass) if (at === s) I.bass(ctx, out, t, chord.root + interval, length * STEP * .7, .85); }
  else if (style === 'wobble' && s === 0) I.wobble(ctx, out, t, chord.root + 12, barEnd - t, L.wobble * STEP, .78);
  else if (style === 'sustain' && s === 0) I.sustainBass(ctx, out, t, chord.root, barEnd - t, .8);
}

export function scheduleStep(graph, song, step, t0) {
  const {ctx, stems} = graph, {plan, buffers, at, harmonyBars} = song;
  const T = n => t0 + plan.timing[Math.min(n, plan.timing.length - 1)];
  const bar = Math.floor(step / BAR_STEPS), s = step % BAR_STEPS, t = T(step);
  const D = graph.drumHp;
  songEvents(graph, plan, step, T);
  if (bar >= plan.bars.length) {
    if (step === plan.totalSteps && plan.finale) {
      const last = plan.bars[0].chord;
      I.kick(ctx, D, t, 1); duck(graph, t); I.crash(ctx, D, t, .45); I.impact(ctx, D, t, .7);
      I.stab(ctx, graph.keysFilter, t, last.notes, 2.2, 1, 2600); I.pad(ctx, graph.padFilter, t, last.notes, 2.4, 1.1);
      I.bass(ctx, stems.bass.input, t, last.root, 1.4, .9);
    }
    lady(graph, song, at.get(step), T);
    return;
  }
  const b = plan.bars[bar], L = b.layers, chord = b.chord;
  if (s === 0) {
    const barEnd = T(step + BAR_STEPS);
    graph.keysFilter.frequency.setValueAtTime(b.cutoff.keys[0], t); graph.keysFilter.frequency.exponentialRampToValueAtTime(b.cutoff.keys[1], barEnd);
    graph.padFilter.frequency.setValueAtTime(b.cutoff.pad[0], t); graph.padFilter.frequency.exponentialRampToValueAtTime(b.cutoff.pad[1], barEnd);
    if (L.drumHp) { graph.drumHp.frequency.setValueAtTime(L.drumHp[0], t); graph.drumHp.frequency.exponentialRampToValueAtTime(L.drumHp[1], barEnd); }
    else graph.drumHp.frequency.setValueAtTime(20, t);
    graph.voiceLp.frequency.setValueAtTime(L.voiceLp || 20000, t);
    if (plan.form === 'drop60') graph.energy.gain.setTargetAtTime(ENERGY[b.section] ?? 1, t, .02);
    const choir = harmonyBars.has(bar);
    graph.harmony.forEach((h, i) => { h.o.frequency.setValueAtTime(I.mtof(chord.notes[i]), t); h.g.gain.setTargetAtTime(choir ? .2 : 0, t, .03); });
    if (L.pad) I.pad(ctx, graph.padFilter, t, chord.notes, barEnd - t, /^Drop/.test(b.section) ? .55 : 1);
    if (L.crash) I.crash(ctx, D, t + (L.impact ? .12 : 0), L.impact ? .3 : .42);    // after the vowel of "BACK." has spoken
    if (L.riser === true && bar === 14) I.riser(ctx, D, t, T(step + 2 * BAR_STEPS) - t);
    if (L.riser === 'short') I.riser(ctx, D, t, barEnd - t, .2);
    if (L.riser === 'long') {
      const end = T(plan.choke.at);
      I.riser(ctx, D, t, end - t, .3); I.sawRiser(ctx, stems.keys.input, t, end - t);
    }
    if (bar === 16 && plan.form !== 'drop60') I.impact(ctx, D, t, .8);
    if (L.impact) {
      I.dropKick(ctx, D, t, 1); duck(graph, t); I.subDrop(ctx, stems.bass.input, t, .75); I.impact(ctx, D, t, .6);
      I.downlifter(ctx, D, t + .25, barEnd - t - .25);   // after the word, not over it
    }
    if (L.reverseCrash) I.reverseCrash(ctx, D, T(step + 12), barEnd - T(step + 12));
  }
  drums(graph, b, bar, s, t, T);
  if (L.bass) bassline(graph, b, s, t, T(step + BAR_STEPS - s));
  if (L.stabs) for (const [at, length, v] of PATTERNS.stabs) if (at === s) I.stab(ctx, graph.keysFilter, t, chord.notes, length * STEP * .95, v * (L.light ? .7 : b.section === 'Verse' ? .85 : 1), 2800);
  if (L.guitar) for (const [at, v] of PATTERNS.guitar) if (at === s) I.chop(ctx, stems.guitar.input, t, chord.notes.slice(1).map(m => m + 12), v);

  const events = at.get(step);
  if (!events) return;
  events.notes.forEach(n => note(graph, t, n.midi));
  events.words.forEach(w => playWord(graph, buffers.get(w.word), t, {rate:w.rate, gate:w.gate}));
  events.stutters.forEach(x => { note(graph, t, x.midi); playWord(graph, buffers.get(x.word), t, {rate:1, gate:STEP * .8}); });
  lady(graph, song, events, T);
}

function lady(graph, song, events, T) {
  if (!events) return;
  for (const e of events.lady) playLady(graph, song, e, T(Math.floor(e.at)) + (e.at - Math.floor(e.at)) * STEP);
}

export function wav(buffer, channels = Math.min(2, buffer.numberOfChannels)) {
  const n = buffer.length, out = new ArrayBuffer(44 + n * channels * 2), v = new DataView(out);
  const str = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, out.byteLength - 8, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, channels, true); v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * channels * 2, true); v.setUint16(32, channels * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * channels * 2, true);
  const data = Array.from({length:channels}, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) { const x = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(44 + (i * channels + c) * 2, x < 0 ? x * 32768 : x * 32767, true); }
  return new Blob([out], {type:'audio/wav'});
}

export const RENDER_OFFSET = .05;   // renders start 50 ms in, so the first transient is whole

// The stems of a tune.stems render, by name: Float32Array per stem, after the master's two channels.
export const stemChannels = audio => Object.fromEntries(STEMS.map((name, i) => [name, audio.getChannelData(2 + i)]));

// bars: [from, to) renders an excerpt, for quick listening tests.
export async function render(plan, buffers, options = {}, lady) {
  const [from, to] = options.bars || [0, plan.bars.length + 1];
  const first = from * BAR_STEPS, last = Math.min(plan.totalSteps, to * BAR_STEPS);
  const t0 = RENDER_OFFSET - plan.timing[first];
  const duration = last >= plan.totalSteps ? plan.duration - plan.timing[first] : plan.timing[last] - plan.timing[first] + 1.5;
  const stems = !!options.tune?.stems, ctx = new OfflineAudioContext(stems ? 2 + STEMS.length : 2, Math.ceil(duration * 44100), 44100);
  if (stems) { ctx.destination.channelCount = 2 + STEMS.length; ctx.destination.channelInterpretation = 'discrete'; }
  const graph = buildGraph(ctx, options), song = prepare(plan, buffers, lady);
  graph.oscillators.forEach(o => o.start(0));
  // Song-level state (call, choke, tape) must be right even when starting mid-song.
  if (first > 0 && plan.call && first >= plan.call.until) { graph.full.gain.value = 1; graph.call.gain.value = 0; }
  for (let step = first; step <= last; step++) scheduleStep(graph, song, step, t0);
  const out = await ctx.startRendering();
  // The export gets a true-peak ceiling of -1.3 dBTP; live playback keeps the clipper.
  if (options.limit !== false && !options.tune?.raw) truePeakLimit([out.getChannelData(0), out.getChannelData(1)], out.sampleRate);
  return out;
}

export class Performance {
  constructor() { this.running = false; }
  async unlock() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw Error('This browser cannot play audio. Open the page in Safari or Chrome.');
      this.ctx = new AudioContext({latencyHint:'playback'});
      this.mobile = createMobileAudio(this.ctx);
    }
    return this.mobile.resume();
  }
  start(plan, buffers, options, onEnd, lady) {
    this.stop(true);
    const ctx = this.ctx, graph = this.graph = buildGraph(ctx, options), song = prepare(plan, buffers, lady);
    const t0 = this.t0 = ctx.currentTime + .12;
    graph.oscillators.forEach(o => o.start(t0));
    this.plan = plan; this.running = true;
    let next = 0;
    const tick = () => {
      if (!this.running) return;
      while (next <= plan.totalSteps && t0 + plan.timing[next] < ctx.currentTime + .3) scheduleStep(graph, song, next++, t0);
      if (ctx.currentTime > t0 + plan.duration) { this.stop(); onEnd?.(); }
    };
    tick(); this.timer = setInterval(tick, 30);
  }
  position() { return this.running && this.ctx ? this.ctx.currentTime - this.t0 - (this.ctx.outputLatency || 0) : -1; }
  levels() {
    if (!this.running || !this.graph) return null;
    const data = this.levelBuffer ||= new Float32Array(512), out = {};
    for (const name of STEMS) {
      this.graph.stems[name].meter.getFloatTimeDomainData(data);
      let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      out[name] = Math.sqrt(sum / data.length);
    }
    return out;
  }
  // Per-stem analysers for the scene equalizer (2048-point, unsmoothed) and the master's 4096.
  analysers() {
    if (!this.running || !this.graph) return null;
    return {master:this.graph.eqAnalyser, ...this.graph.spectra};
  }
  spectrum() {
    if (!this.running || !this.graph) return null;
    const bins = new Uint8Array(this.graph.analyser.frequencyBinCount); this.graph.analyser.getByteFrequencyData(bins); return bins;
  }
  mute(muted) { if (this.graph) setMuted(this.graph, muted); }
  voice(mode) { if (this.graph) setVoiceMode(this.graph, mode); }
  stop(keepSession = false) {
    this.running = false; clearInterval(this.timer);
    if (this.graph) {
      const {output, oscillators, sources} = this.graph, t = this.ctx.currentTime;
      output.gain.setTargetAtTime(0, t, .02);
      setTimeout(() => { oscillators.forEach(o => { try { o.stop(); } catch {} }); sources.forEach(s => { try { s.stop(); } catch {} }); output.disconnect(); }, 120);
      this.graph = null;
    }
    if (!keepSession) this.mobile?.pause();
  }
  close() { this.stop(); this.mobile?.dispose(); this.ctx?.close(); }
}
