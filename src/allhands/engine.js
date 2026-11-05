// One arrangement, two clocks: the live AudioContext and the offline render
// share buildGraph() and scheduleStep(), so the download is the performance.
// The plan names its song book track (plan.track); the track supplies the band
// (songbook/*.js band.step), the mix and the 16th. A plan without one is Circle Back.
//
// Master chain:  stems + returns → master → call | full (muted intro)
//   → section energy → choke → tape (varispeed delay line) → glue → limiter
//   → soft clip → out.   Post-choke: the tag.   Post-tape: the deep voice.
import {BAR_STEPS} from './song.js';
import * as I from './instruments.js';
import {trackOf} from './songbook/index.js';
import {createVocoder} from './vocoder.js';
import {createMobileAudio} from '../audio-session.js';
import {truePeakLimit} from './master.js';
import {exactSession, sessionOf} from './exact.js';
import {ladyLength, withColdOpen} from './drop.js';

export const STEMS = ['drums', 'bass', 'keys', 'guitar', 'voice', 'lady'];
export const VOICE_MODES = {sung:{vocoder:1, dry:.06}, spoken:{vocoder:0, dry:.9}, both:{vocoder:.85, dry:.42}};
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

// plan: the song to be played (its track decides the mix); omitted, Circle Back.
export function buildGraph(ctx, {mode = 'sung', muted = {}, tune = {}} = {}, plan) {
  const track = trackOf(plan?.track), mix = track.mix, STEP = plan?.step ?? track.step;
  // Every sum in the graph is exact (exact.js): nodes made here are the structure, later ones voices.
  const exact = exactSession(ctx);
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
  // plan.makeup (dB): a band cast's level (band.js BAND_MAKEUP): his repeats were the loudest thing in the room.
  const output = I.amp(ctx, (tune.output ?? mix.output ?? 1.25) * dB(plan?.makeup ?? 0)), analyser = ctx.createAnalyser();
  analyser.fftSize = 1024; analyser.smoothingTimeConstant = .72;
  // tune.raw skips the bus compressor and limiter, for measuring stem balance.
  // Trim: the drop should arrive just under the limiter, not deep into it.
  const trim = I.amp(ctx, tune.trim ?? mix.trim ?? .4); post.connect(trim);
  if (tune.raw) trim.connect(output); else { trim.connect(glue); glue.connect(limiter); limiter.connect(output); }
  const softClipper = softClip(ctx), clip = I.amp(ctx, 1);         // clip: the soft clipper, then the cold open's gate
  softClipper.connect(clip);
  const eqAnalyser = ctx.createAnalyser(); eqAnalyser.fftSize = 4096; eqAnalyser.smoothingTimeConstant = 0;
  output.connect(softClipper); clip.connect(analyser); clip.connect(eqAnalyser);
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

  const reverb = ctx.createConvolver(); reverb.buffer = mix.room ? I.impulse(ctx, ...mix.room) : I.impulse(ctx);
  const reverbIn = I.biquad(ctx, 'highpass', 280), reverbOut = I.amp(ctx, .55);
  reverbIn.connect(reverb); reverb.connect(reverbOut); reverbOut.connect(master);
  const delayIn = I.biquad(ctx, 'highpass', 350), delay = ctx.createDelay(2), feedback = I.amp(ctx, .34), damp = I.biquad(ctx, 'lowpass', 3200), delayOut = I.amp(ctx, .5);
  delay.delayTime.value = STEP * 6;                                     // dotted eighth
  delayIn.connect(delay); delay.connect(damp); damp.connect(feedback); feedback.connect(delay); damp.connect(delayOut); delayOut.connect(master);
  const sends = {reverb:reverbIn, delay:delayIn};

  const stems = {
    drums:stem(ctx, master, sends, mix.stems.drums),
    bass:stem(ctx, master, sends, mix.stems.bass),
    keys:stem(ctx, master, sends, mix.stems.keys),
    guitar:stem(ctx, master, sends, mix.stems.guitar),
    voice:stem(ctx, master, sends, mix.stems.voice),
    lady:stem(ctx, master, sends, {...mix.stems.lady, level:tune.ladyLevel ?? mix.stems.lady.level ?? 1.1}),
  };
  // Drum-bus high-pass for the build; Synergy's answer filter in the build.
  const drumHp = I.biquad(ctx, 'highpass', 20, .7); drumHp.connect(stems.drums.input);
  // Stabs and pad stay out of the bass's way: everything under ~200 Hz belongs to Pat.
  const keysFilter = I.biquad(ctx, 'lowpass', 3000, .9), padFilter = I.biquad(ctx, 'lowpass', 1100, .8);
  const keysHp = I.biquad(ctx, 'highpass', mix.keysHp ?? 210, .6), padHp = I.biquad(ctx, 'highpass', 180, .6);
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
  const graph = {ctx, track, master, output, analyser, eqAnalyser, eqTap, spectra, stems, keysFilter, padFilter, drumHp, voiceLp, words, dry, sung, vocoder, ladySend, lead, harmony, oscillators, sources:new Set(),
    full, call, callGap, energy, choke, tag, deep, tapeDry, tapeWet, tapeDelay, tapeLp, reverbOut, delayOut, feedback, exact, gate:clip};
  // The buses voices join (exact.js gives each a head with a fixed channel count).
  for (const bus of [drumHp, keysFilter, padFilter, words, ladySend, tag, deep, ...STEMS.map(n => stems[n].input)]) exact.bus(bus);
  if (tune.voiceLevel) stems.voice.out.gain.value = tune.voiceLevel;
  if (tune.under !== undefined) ['keys', 'guitar'].forEach(n => { stems[n].under = tune.under; });
  // A track's own structure (band.graph: Offsite's round of voices and its
  // bloom), built with the rest of the graph; the choke closes it and the
  // impact reopens it through its own choke(c) and release(t).
  graph.own = bandOf(track, plan).graph?.({ctx, I, graph, step:STEP, sends, master, plan, tune}) ?? null;
  for (const bus of graph.own?.buses ?? []) exact.bus(bus);
  setMuted(graph, muted, 0);
  exact.play();
  return graph;
}

export function setMuted(graph, muted, ramp = .015) {
  const t = graph.ctx.currentTime;
  for (const name of STEMS) graph.stems[name].mute.gain.setTargetAtTime(muted[name] ? 0 : 1, t, ramp || .0001);
  // A track's own voices that skip a stem (Offsite's chord of her BACK. in the bloom) read this, so they mute with it.
  graph.muted = {...muted};
}

export function setVoiceMode(graph, mode) {
  const m = VOICE_MODES[mode] || VOICE_MODES.sung, t = graph.ctx.currentTime;
  graph.dry.gain.setTargetAtTime(m.dry, t, .02); graph.sung.gain.setTargetAtTime(m.vocoder, t, .02);
}

// The buffer one of the voices' events plays: her recording, or (a pixel voice,
// e.key) the take sung onto its notes (lady.js prepareLady), by the event's id.
const voiceBuffer = (lady, e, id) => (e.key ? lady.sung?.get(id) : lady.files.get(e.file));

// The band that plays a plan: the track's own, or its river's (the wander form, river.js).
export const bandOf = (track, plan) => (plan?.form === 'wander' && track.wander ? track.wander.band : track.band);

// Index the plan's events by step, once. `lady` holds decoded files, the sung
// takes of the pixel voices and baked deep takes.
export function prepare(plan, buffers, lady = {files:new Map(), deep:new Map(), sung:new Map()}) {
  const track = trackOf(plan.track), step = plan.step ?? track.step;
  const at = new Map(), push = (step, key, value) => { if (!at.has(step)) at.set(step, {words:[], notes:[], stutters:[], lady:[]}); at.get(step)[key].push(value); };
  // A silent word (the cold open's source, below) keeps its notes and its choir bar: only his voice is gone.
  plan.words.forEach(w => { if (buffers.get(w.word) && !w.silent) push(w.at, 'words', w); w.notes.forEach(n => push(n.at, 'notes', n)); });
  plan.stutters.forEach(s => { if (buffers.get(s.word)) push(s.at, 'stutters', s); });
  (plan.lady || []).forEach((e, i) => { if (voiceBuffer(lady, e, i)) push(Math.floor(e.at), 'lady', {...e, index:i}); });
  // The band's parts (band.js) play as her events do, on her stem.
  (plan.band || []).forEach((e, i) => { if (voiceBuffer(lady, e, `b${i}`)) push(Math.floor(e.at), 'lady', {...e, index:`b${i}`}); });
  const harmonyBars = new Set(plan.words.filter(w => w.harmony).map(w => Math.floor(w.at / BAR_STEPS)));
  // The couplet drop's impact word, when it asks for the downbeat to itself (drop.js unmask).
  const unmask = (plan.lady || []).find(e => e.role === 'impact' && e.unmask) ?? null;
  return {plan, buffers, lady, at, harmonyBars, track, step, band:bandOf(track, plan), unmask};
}

// The kick's sidechain. A track may pump harder (depth per stem, release time
// constant) for its own sections: duck(graph, t, {bass:.05, keys:.2}, .11).
function duck(graph, t, depth, release = graph.track.mix.duckRelease ?? .075) {
  for (const name of STEMS) {
    const s = graph.stems[name], d = depth?.[name] ?? s.duck;
    if (!d) continue;
    const g = s.ducker.gain;
    g.setValueAtTime(1, t); g.linearRampToValueAtTime(d, t + .008); g.setTargetAtTime(1, t + .03, release);
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
  const {ctx} = graph, buffer = voiceBuffer(song.lady, e, e.index);
  if (!buffer) return;
  const length = ladyLength(e), gain = dB(e.gain || 0);
  const s = ctx.createBufferSource(), env = I.amp(ctx);
  s.buffer = buffer; s.playbackRate.value = e.rate;
  if (e.bend) {
    s.detune.setValueAtTime(0, t); s.detune.linearRampToValueAtTime(e.bend.cents, t + length * e.bend.at); s.detune.linearRampToValueAtTime(0, t + length * e.bend.back);
  }
  if (e.lift) { s.detune.setValueAtTime(0, t + length * e.lift.from); s.detune.linearRampToValueAtTime(e.lift.cents, t + length); }
  // A couplet's impact word (unmask.boost, dB): its first consonant up, so "v" and "d" speak over what
  // is left of the band, then the word at its level from its vowel on.
  const u0 = e.role === 'impact' ? e.unmask : null, lift = u0?.boost ? dB(u0.boost) : 1;
  env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(lift, t + .003);
  if (lift !== 1) { env.gain.setValueAtTime(lift, t + u0.lead); env.gain.linearRampToValueAtTime(1, t + u0.lead + .03); }
  // A band part's last word lifts into its release (band.js RELEASE_LIFT: the final "t" of "double-booked").
  const rel = e.release && e.release.at < length - .04 ? e.release : null;
  if (rel) { env.gain.setValueAtTime(1, t + rel.at); env.gain.linearRampToValueAtTime(dB(rel.gain), t + rel.at + .02); }
  env.gain.setValueAtTime(rel ? dB(rel.gain) : 1, t + Math.max(.004, length - .015)); env.gain.linearRampToValueAtTime(0, t + length);
  s.connect(env);
  const dryLevel = gain * (1 - (e.blend || 0) * .5);
  const dryOut = I.amp(ctx, dryLevel), nodes = [s, env, dryOut];
  env.connect(dryOut);
  // The tag, and a couplet's impact word (unmask.dry): dry and centred, past the stems' sends.
  if (e.role === 'tag' || (e.role === 'impact' && e.unmask?.dry)) dryOut.connect(graph.tag);
  // A clear phrase of the river (wander.js): dry and centred over the stream, its tail sent into the river's
  // diffusion, where it sinks back in (river.js washIn). It skips her stem, so it reads graph.muted and mutes with it.
  else if (e.clear && graph.own?.washIn) { if (!graph.muted?.lady) { dryOut.connect(graph.tag); const w = I.amp(ctx, .3); dryOut.connect(w); w.connect(graph.own.washIn); nodes.push(w); } }
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
    // The kick's transient passes, then drums and bass dip under the word and swell back
    // (a couplet's impact word, unmask: deeper, and the keys and guitar with them).
    // A couplet's impact word (unmask): the band is out from the downbeat while its first consonant speaks
    // (to its vowel, `lead` seconds in: the drop kick's transient took "v" and "d" off VIBE. and DEMAND.),
    // then under the word at `dip`, and back as it ends.
    const u = e.role === 'impact' ? e.unmask : null, depth = e.role === 'impact' ? u?.dip ?? .45 : e.dip;
    for (const name of u?.all ? STEMS.filter(n => n !== 'lady' && n !== 'voice') : ['drums', 'bass']) {
      const g = graph.stems[name].voiced.gain;
      if (u?.hold !== undefined) { const h = t + u.lead + (u.holdFor ?? .01); g.setValueAtTime(u.hold, t); g.setValueAtTime(u.hold, h); g.linearRampToValueAtTime(depth, h + .03); }
      else { g.setValueAtTime(1, t + .015); g.linearRampToValueAtTime(depth, t + .03); }
      const back = t + length + (u?.tail ?? 0);
      g.setValueAtTime(depth, back); g.linearRampToValueAtTime(1, back + .16);
    }
  }
  const deep = song.lady.deep.get(e.index);
  // e.deepUntil (seconds from its start): the deep voice fades out by then on a raised cosine (the cold open's source).
  const cut = deep && e.deepUntil !== undefined && e.deepUntil < deep.duration;
  if (deep && (!cut || e.deepUntil > .005)) {
    const d = ctx.createBufferSource(), dg = I.amp(ctx, gain * e.deep), at = t + (e.deepAt || 0) * song.step;
    d.buffer = deep; d.connect(dg); dg.connect(graph.deep);
    const room = e.role === 'sink' ? e.gate : cut ? e.deepUntil : deep.duration;          // the sink holds its bar
    if (cut) {
      const fade = Math.min(DEEP_FADE, room), curve = new Float32Array(65);
      for (let i = 0; i < curve.length; i++) curve[i] = gain * e.deep * .5 * (1 + Math.cos(Math.PI * i / (curve.length - 1)));
      dg.gain.setValueCurveAtTime(curve, at + room - fade, fade);
    } else { dg.gain.setValueAtTime(gain * e.deep, at + room - .03); dg.gain.linearRampToValueAtTime(0, at + room); }
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
    // Live, a late tick can find `start` already past; Web Audio then starts the
    // curve at currentTime, and a reset at end + .01 would land inside it and throw,
    // losing the whole Sink In downbeat. Offline, currentTime is 0: nothing changes.
    const begin = Math.max(start, graph.ctx.currentTime || 0);
    for (let i = 0; i < points; i++) { const u = i / (points - 1); curve[i] = .25 * D * u * u; }
    tapeWet.gain.setValueAtTime(1, start); tapeDry.gain.setValueAtTime(0, start);
    tapeDelay.delayTime.setValueCurveAtTime(curve, begin, D);
    tapeWet.gain.setValueAtTime(1, end - .004); tapeWet.gain.linearRampToValueAtTime(0, end);
    tapeDry.gain.setValueAtTime(0, end - .004); tapeDry.gain.linearRampToValueAtTime(1, end);
    tapeDelay.delayTime.setValueAtTime(0, (begin > start ? begin + D : end) + .01);
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

function songEvents(graph, plan, step, T, STEP) {
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
    if (step === Math.floor(plan.choke.at)) {
      // Everything stops in 6 ms, returns included, so the silence is silent. The
      // choke is where her tag starts (drop.js): a step's fraction on the lady's clock.
      const c = t + (plan.choke.at - step) * STEP;
      for (const g of [graph.choke.gain, ...STEMS.map(n => graph.eqTap[n].gain)]) { g.setValueAtTime(1, c); g.linearRampToValueAtTime(0, c + .006); }
      graph.feedback.gain.setValueAtTime(0, c);
      graph.reverbOut.gain.setValueAtTime(.55, c); graph.reverbOut.gain.linearRampToValueAtTime(0, c + .006);
      graph.own?.choke?.(c);
    }
    if (step === plan.choke.until) {
      for (const g of [graph.choke.gain, ...STEMS.map(n => graph.eqTap[n].gain)]) g.setValueAtTime(1, t);
      graph.feedback.gain.setValueAtTime(.34, t);
      graph.reverbOut.gain.setValueAtTime(0, t); graph.reverbOut.gain.linearRampToValueAtTime(.55, t + .4);
      graph.own?.release?.(t);
    }
  }
  for (const tape of plan.tape || []) if (tape.from === step) tapeEvent(graph, tape, T);
}

// ---- the band ----------------------------------------------------------------
// The track plays its own drums, bass, keys and guitar (songbook/*.js band);
// the engine keeps what every Drop Edition shares: filters, energy, the choir,
// crashes and risers, the impact, the voices.

function bandApi(graph, song) {
  if (graph.api?.song === song) return graph.api;
  return graph.api = {song, graph, ctx:graph.ctx, I, step:song.step, plan:song.plan, track:song.track, duck:(t, depth, release) => duck(graph, t, depth, release)};
}

export function scheduleStep(graph, song, step, t0) {
  const {ctx, stems} = graph, {plan, buffers, at, harmonyBars, track} = song, band = song.band ?? track.band, STEP = song.step, api = bandApi(graph, song);
  const T = n => t0 + plan.timing[Math.min(n, plan.timing.length - 1)];
  const bar = Math.floor(step / BAR_STEPS), s = step % BAR_STEPS, t = T(step);
  const D = graph.drumHp;
  songEvents(graph, plan, step, T, STEP);
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
    // The section's energy, less the room the verse leaves the drops (plan.energyTrim, dB).
    if (plan.form === 'drop60') graph.energy.gain.setTargetAtTime((track.drop.energy[b.section] ?? 1) * dB(-(plan.energyTrim?.[b.section] ?? 0)), t, .02);
    // The river's energy drifts: a slow glide toward each bar's level, never a step.
    else if (plan.form === 'wander' && b.energy !== undefined) { if (bar === 0) graph.energy.gain.setValueAtTime(b.energy, t); else graph.energy.gain.setTargetAtTime(b.energy, t, 1.1); }
    const choir = harmonyBars.has(bar);
    graph.harmony.forEach((h, i) => { h.o.frequency.setValueAtTime(I.mtof(chord.notes[i]), t); h.g.gain.setTargetAtTime(choir ? .2 : 0, t, .03); });
    if (L.pad) band.pad(api, t, chord, barEnd - t, b);
    // A couplet's impact word (drop.js unmask) keeps the downbeat to itself: the crash and the downlifter wait for it to end.
    const word = L.impact ? song.unmask : null, after = word ? ladyLength(word) + (word.unmask.after ?? .04) : 0;
    if (L.crash) I.crash(ctx, D, t + (L.impact ? Math.max(.12, after) : 0), L.impact ? .3 : .42);    // after the vowel of "BACK." has spoken
    if (L.riser === true && bar === 14) I.riser(ctx, D, t, T(step + 2 * BAR_STEPS) - t);
    if (L.riser === 'short') I.riser(ctx, D, t, barEnd - t, .2);
    if (L.riser === 'long') {
      const end = T(Math.floor(plan.choke.at)) + (plan.choke.at % 1) * STEP;
      I.riser(ctx, D, t, end - t, .3); I.sawRiser(ctx, stems.keys.input, t, end - t, ...(track.sound.sawRiser || []));
    }
    if (bar === 16 && plan.form === 'soundcheck') I.impact(ctx, D, t, .8);   // the sound check's drop (the river has none)
    // A track may make its own impact (band.impact: Offsite's stomp and bloom of voices, no bass slam).
    if (L.impact && band.impact) band.impact(api, b, bar, t, barEnd, T, step);
    else if (L.impact) {
      // The impact is tuned: the drop kick settles on, and the sub falls through, the track's key.
      const boom = word?.unmask.boom ?? 1;
      I.dropKick(ctx, D, t, boom, track.sound.dropKick); duck(graph, t); I.subDrop(ctx, stems.bass.input, t, .75 * boom, track.sound.subDrop); I.impact(ctx, D, t, .6 * boom);
      const down = Math.max(.25, after);
      I.downlifter(ctx, D, t + down, barEnd - t - down);   // after the word, not over it
    }
    if (L.reverseCrash) I.reverseCrash(ctx, D, T(step + 12), barEnd - T(step + 12));
    band.bar?.(api, b, bar, t, barEnd, T, step);
  }
  band.step(api, b, bar, s, t, T, step);

  const events = at.get(step);
  if (!events) return;
  events.notes.forEach(n => note(graph, t, n.midi));
  events.words.forEach(w => playWord(graph, buffers.get(w.word), t, {rate:w.rate, gate:w.gate}));
  events.stutters.forEach(x => { note(graph, t, x.midi); playWord(graph, buffers.get(x.word), t, {rate:1, gate:STEP * .8}); });
  lady(graph, song, events, T);
}

function lady(graph, song, events, T) {
  if (!events) return;
  for (const e of events.lady) playLady(graph, song, e, T(Math.floor(e.at)) + (e.at - Math.floor(e.at)) * song.step);
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

// For checks: exact.js's report on the graph a context rendered (every input, its lanes, the most it hears at once).
export const exactReport = ctx => sessionOf(ctx)?.report() ?? [];

export const RENDER_OFFSET = .05;   // renders start 50 ms in, so the first transient is whole

// The stems of a tune.stems render, by name: Float32Array per stem, after the master's two channels.
export const stemChannels = audio => Object.fromEntries(STEMS.map((name, i) => [name, audio.getChannelData(2 + i)]));

// ---- the cold open ---------------------------------------------------------
// plan.coldOpen (drop.js withColdOpen): the impact as the drop plays it, then
// the end of the ladder rewound at 4x, both cut from the track's own render;
// the song itself is heard from coldOpen.resume. Offline, render() splices it
// in (the same plan rendered whole is its own source); live, prepareColdOpen()
// renders the source first and Performance.start() plays it in front of the song.

const XFADE = .006;   // equal-power crossfades at the joins, seconds
const DEEP_FADE = .12;   // the cold open's deep echo fades out over this, ending before the first join

// What the cold open's impact is cut from: the same song, with Synergy silent
// from the impact on (plan.md section 2: the cold open is the BACK. stack, the
// crash and the sub; his hook comes in half a beat after BACK. and would be cut
// mid-word by the rewind) and her deep "BACK." faded out before the impact part
// ends, so the rewind cuts nothing. Everything else is the song's own: the
// band, her dry and vocoded BACK. on his carrier and choir, the bus.
export function coldSourcePlan(plan, cold = coldOpenOf(plan, {coldOpen:true})) {
  const impact = plan.marks.impact, gone = cold.impact.until - XFADE / 2 - .001;   // seconds after the impact
  return {...plan,
    words:plan.words.map(w => w.at >= impact ? {...w, silent:true} : w),
    lady:plan.lady.map(e => e.role === 'impact' && e.deep ? {...e, deepUntil:gone - (e.deepAt || 0) * plan.step} : e)};
}

export function coldOpenOf(plan, options = {}) {
  if (options.coldOpen === false || plan.form !== 'drop60') return null;
  return plan.coldOpen ?? (options.coldOpen ? withColdOpen(plan).coldOpen : null);
}

// A low-pass for the 4x rewind (windowed sinc at 0.45 of the new Nyquist), so it does not alias.
const REWIND_FIR = (() => {
  const taps = 95, fc = .45 / 4, k = new Float64Array(taps);
  let sum = 0;
  for (let i = 0; i < taps; i++) { const x = i - (taps - 1) / 2, w = .42 - .5 * Math.cos(2 * Math.PI * i / (taps - 1)) + .08 * Math.cos(4 * Math.PI * i / (taps - 1)); k[i] = (x ? Math.sin(2 * Math.PI * fc * x) / (Math.PI * x) : 2 * fc) * w; sum += k[i]; }
  return k.map(v => v / sum);
})();

// The cold open's audio, from a source render whose sample 0 is song time `srcT0`
// (srcT0 = plan time at that render's file time 0): per channel, the samples of
// file time [0, resume + offset + XFADE/2), weighted for the crossfade into the
// song, and the song's own weight over the same samples.
export function coldOpenParts(cold, channels, sampleRate, srcT0) {
  const sr = sampleRate, at = t => t + RENDER_OFFSET;              // plan seconds → file seconds of the output
  const A = at(cold.impact.until), B = at(cold.resume), n = Math.ceil((B + XFADE) * sr);
  // Both renders put song time u at file time u - t0 + RENDER_OFFSET. The impact is an integer
  // sample shift; the rewind reads the source backwards, `rate` samples per sample.
  const shift = Math.round((cold.impact.source - srcT0) * sr);
  const rw = cold.rewind, base = Math.round((rw.sourceFrom - srcT0 + RENDER_OFFSET) * sr), stride = rw.rate;
  const fade = (x, edge) => { const u = Math.min(1, Math.max(0, (x - edge) / XFADE + .5)); return [Math.cos(u * Math.PI / 2), Math.sin(u * Math.PI / 2)]; };
  const out = channels.map(() => new Float32Array(n)), song = new Float32Array(n), half = (REWIND_FIR.length - 1) / 2;
  for (let i = 0; i < n; i++) {
    const f = i / sr, [aOut, aIn] = fade(f, A), [bOut, bIn] = fade(f, B);
    const wI = aOut, wR = aIn * bOut;
    song[i] = bIn;
    // rewind sample: the source at song time sourceFrom - rate · (t - from), filtered
    const j = base - stride * Math.round((f - A) * sr);
    channels.forEach((c, k) => {
      let v = 0;
      if (wI > 0) { const s = i + shift; v += wI * (s >= 0 && s < c.length ? c[s] : 0); }
      if (wR > 0) { let r = 0; for (let t = 0; t < REWIND_FIR.length; t++) { const s = j + t - half; if (s >= 0 && s < c.length) r += REWIND_FIR[t] * c[s]; } v += wR * r; }
      out[k][i] = v;
    });
  }
  return {cold, sampleRate:sr, length:n, channels:out, song};
}

// The bars a cold open's source needs. Exact: the song from the top through the
// bar after the impact, which renders the source spans sample for sample as the
// whole song does (a render only depends on what came before, and its clock
// starts where the whole song's does). Quick (live): two bars before the
// rewind's start, for the reverb and the delay; the same music, not the same samples.
function sourceBars(plan, cold, exact = true) {
  const T = plan.timing, stepOf = t => { let s = 0; while (s < plan.totalSteps && T[s + 1] <= t) s++; return s; };
  return [exact ? 0 : Math.max(0, Math.floor(stepOf(cold.rewind.sourceTo) / BAR_STEPS) - 2), Math.floor(stepOf(cold.impact.source) / BAR_STEPS) + 2];
}

async function coldSource(plan, buffers, options, lady, cold, exact = true) {
  const bars = sourceBars(plan, cold, exact);
  const audio = await render(coldSourcePlan(plan, cold), buffers, {...options, coldOpen:false, limit:false, bars}, lady);
  return {channels:Array.from({length:audio.numberOfChannels}, (_, c) => audio.getChannelData(c)), sampleRate:audio.sampleRate, t0:plan.timing[bars[0] * BAR_STEPS]};
}

// Live: render the cold open's source and cut its parts, before Performance.start(plan, buffers, {coldOpen:parts}).
// options.exact renders the source from the top (the render's own samples; slower).
export async function prepareColdOpen(plan, buffers, lady, options = {}) {
  const cold = coldOpenOf(plan, {coldOpen:true});
  if (!cold) return null;
  const src = await coldSource(plan, buffers, {mode:options.mode, muted:options.muted, tune:options.tune}, lady, cold, !!options.exact);
  return coldOpenParts(cold, src.channels.slice(0, 2), src.sampleRate, src.t0);
}

// Live: play prepared parts from song time 0 (t0 is the context time of song time 0),
// and open the song's own gate at the join.
export function scheduleColdOpen(graph, parts, t0) {
  const {ctx} = graph, buffer = ctx.createBuffer(parts.channels.length, parts.length, parts.sampleRate);
  parts.channels.forEach((c, i) => buffer.getChannelData(i).set(c));
  const s = ctx.createBufferSource(), start = t0 - RENDER_OFFSET;
  s.buffer = buffer; s.connect(graph.analyser); s.connect(graph.eqAnalyser); s.connect(ctx.destination);
  s.start(Math.max(ctx.currentTime, start)); s.stop(start + parts.length / parts.sampleRate + .01);
  const curve = new Float32Array(64), from = parts.length / parts.sampleRate - XFADE * 1.5;
  for (let i = 0; i < curve.length; i++) curve[i] = parts.song[Math.min(parts.length - 1, Math.round((from + i / 63 * XFADE * 1.5) * parts.sampleRate))];
  graph.gate.gain.setValueAtTime(0, Math.max(ctx.currentTime, start));
  graph.gate.gain.setValueCurveAtTime(curve, start + from, XFADE * 1.5);
  graph.sources.add(s); s.onended = () => { graph.sources.delete(s); s.disconnect(); };
}

// bars: [from, to) renders an excerpt, for quick listening tests.
export async function render(plan, buffers, options = {}, lady) {
  const [from, to] = options.bars || [0, plan.bars.length + 1];
  const first = from * BAR_STEPS, last = Math.min(plan.totalSteps, to * BAR_STEPS);
  const t0 = RENDER_OFFSET - plan.timing[first];
  const duration = last >= plan.totalSteps ? plan.duration - plan.timing[first] : plan.timing[last] - plan.timing[first] + 1.5;
  const stems = !!options.tune?.stems, ctx = new OfflineAudioContext(stems ? 2 + STEMS.length : 2, Math.ceil(duration * 44100), 44100);
  if (stems) { ctx.destination.channelCount = 2 + STEMS.length; ctx.destination.channelInterpretation = 'discrete'; }
  const graph = buildGraph(ctx, options, plan), song = prepare(plan, buffers, lady);
  graph.oscillators.forEach(o => o.start(0));
  // Song-level state (call, choke, tape) must be right even when starting mid-song.
  if (first > 0 && plan.call && first >= plan.call.until) { graph.full.gain.value = 1; graph.call.gain.value = 0; }
  for (let step = first; step <= last; step++) scheduleStep(graph, song, step, t0);
  graph.exact.finalize();
  const out = await ctx.startRendering();
  // The cold open replaces the first second, cut from its own source render
  // (coldSourcePlan: the song from the top, Synergy silent from the impact on).
  const cold = first === 0 ? coldOpenOf(plan, options) : null;
  if (cold) {
    const channels = Array.from({length:out.numberOfChannels}, (_, c) => out.getChannelData(c));
    const src = await coldSource(plan, buffers, options, lady, cold);
    const parts = coldOpenParts(cold, src.channels, src.sampleRate, src.t0);
    channels.forEach((c, k) => { const p = parts.channels[k]; for (let i = 0; i < Math.min(parts.length, c.length); i++) c[i] = p[i] + parts.song[i] * c[i]; });
  }
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
    const ctx = this.ctx, graph = this.graph = buildGraph(ctx, options, plan), song = prepare(plan, buffers, lady);
    const t0 = this.t0 = ctx.currentTime + .12;
    graph.oscillators.forEach(o => o.start(t0));
    // options.coldOpen: the parts prepareColdOpen() made for this plan.
    if (options?.coldOpen?.channels) scheduleColdOpen(graph, options.coldOpen, t0);
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
