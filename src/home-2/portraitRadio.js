import {createRadio} from '../home/radio.js';
import {createAudioEngine} from '../audio.js';
import {TRACKS, makeCues} from '../home/tracks.js';
import {ensureClip} from '../v2/lesson.js';

export const REST = 'rest';
export const MOUTH_STATES = ['rest', 'ah', 'ee', 'oh', 'oo', 'closed'];

// Read only the recorded vocal, before music/effects. Instrumental beats cannot
// open the mouth. Cache this once per decoded clip; transport time drives it.
export function vocalEnvelope(buffer) {
  const data = buffer.getChannelData(0), hop = Math.max(1, Math.round(buffer.sampleRate / 100));
  const levels = new Float32Array(Math.ceil(data.length / hop));
  let peak = 0;
  for (let i = 0; i < levels.length; i++) {
    let sum = 0, count = Math.min(hop, data.length - i * hop);
    for (let j = 0; j < count; j++) sum += data[i * hop + j] ** 2;
    levels[i] = Math.sqrt(sum / count); peak = Math.max(peak, levels[i]);
  }
  return {levels, hopSeconds:hop / buffer.sampleRate, peak};
}

// A deliberately stylized approximation, not phoneme/forced alignment. Word
// timing is supplied by the existing lyric cues; silence is measured from PCM.
export function wordShapes(word) {
  const groups = word.toLowerCase().match(/ee|ea|oo|ou|ow|oa|ai|ay|[aeiouymbp]/g) || [];
  return groups.map(g => /^[mbp]$/.test(g) ? 'closed'
    : /^(oo|ou|u)$/.test(g) ? 'oo'
    : /^(o|ow|oa)$/.test(g) ? 'oh'
    : /^(ee|ea|i|y|e)$/.test(g) ? 'ee' : 'ah');
}

export function mouthAt(cues, envelopes, seconds, playing = true) {
  if (!playing || !cues.length) return REST;
  // Hold artwork for ~83ms; changing on every audio tick looks jittery.
  const t = Math.floor(seconds * 12) / 12;
  let cue;
  for (const item of cues) { if (item.at > seconds) break; cue = item; }
  if (!cue || seconds >= cue.at + cue.duration) return REST;
  const envelope = envelopes.get(cue.bank);
  if (!envelope || !envelope.peak) return REST;
  const frame = Math.floor((seconds - cue.at) / envelope.hopSeconds);
  if ((envelope.levels[frame] || 0) < envelope.peak * .07) return REST;
  const word = cue.words.find(w => seconds >= w.start && seconds < w.end);
  if (!word) return REST;
  const shapes = wordShapes(word.word);
  if (!shapes.length) return 'ah';
  const progress = Math.max(0, Math.min(.999, (t - word.start) / (word.end - word.start)));
  return shapes[Math.floor(progress * shapes.length)] || REST;
}

// The concept gets its own visual adapter. The shipping homepage and its audio
// engine remain unchanged, including their cancellation/seek/pause behavior.
export function createPortraitRadio({onState, loadClip = ensureClip, engineFactory = createAudioEngine, ...options}) {
  const buffers = new Map(), envelopes = new Map(), timelines = new Map();
  let engine;
  return createRadio({
    ...options,
    engineFactory:() => (engine = engineFactory()),
    loadClip:async (...args) => {
      const buffer = await loadClip(...args), bank = args[3];
      if (buffer && !buffers.has(bank)) {
        buffers.set(bank, buffer); envelopes.set(bank, vocalEnvelope(buffer));
      }
      return buffer;
    },
    onState:state => {
      const track = TRACKS[state.index];
      if (!track.src && !timelines.has(state.index) && track.phrases.every(bank => buffers.has(bank)))
        timelines.set(state.index, makeCues(track, buffers));
      const spectrum = state.playing ? engine?.spectrum?.() : null;
      const levels = spectrum ? Array.from({length:48}, (_, i) => {
        const from = Math.floor(i * spectrum.length / 48), to = Math.max(from + 1, Math.floor((i + 1) * spectrum.length / 48));
        let peak = 0; for (let j = from; j < to; j++) peak = Math.max(peak, spectrum[j] || 0);
        return peak / 255;
      }) : null;
      onState({...state, mouth:mouthAt(timelines.get(state.index) || [], envelopes, state.elapsed, state.playing), levels});
    },
  });
}
