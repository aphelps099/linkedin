// Read the actual isolated vocal samples, never the drums or a text-based timer.
export const ENVELOPE_HZ = 50;
const envelopes = new WeakMap();

export function voiceEnvelope(buffer, clip) {
  if (!buffer?.getChannelData || !buffer.sampleRate) return null;
  let clips = envelopes.get(buffer);
  if (!clips) { clips = new Map(); envelopes.set(buffer, clips); }
  const key = `${clip.start}:${clip.duration}`;
  if (clips.has(key)) return clips.get(key);
  const samples = buffer.getChannelData(0), rate = buffer.sampleRate;
  const levels = new Float32Array(Math.ceil(clip.duration * ENVELOPE_HZ));
  for (let frame = 0; frame < levels.length; frame++) {
    const start = Math.floor((clip.start + frame / ENVELOPE_HZ) * rate);
    const end = Math.min(samples.length, Math.floor((clip.start + Math.min(clip.duration, (frame + 1) / ENVELOPE_HZ)) * rate));
    let sum = 0;
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    levels[frame] = Math.sqrt(sum / Math.max(1, end - start));
  }
  const ordered = [...levels].sort((a,b) => a-b);
  const peak = Math.max(.015, ordered[Math.floor(ordered.length * .94)] || 0);
  for (let i = 0; i < levels.length; i++) levels[i] = Math.min(1, levels[i] / peak);
  clips.set(key, levels);
  return levels;
}

export function levelAt(envelope, seconds) {
  return envelope?.[Math.floor(seconds * ENVELOPE_HZ)] || 0;
}
