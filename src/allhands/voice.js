// Fetch Synergy's word takes once; keep them decoded for the whole visit.
const API = '/api/allhands/voice';
const decoded = new Map();

function measure(audio) {
  const d = audio.getChannelData(0), threshold = .012;
  let first = 0, last = d.length - 1;
  while (first < d.length && Math.abs(d[first]) < threshold) first++;
  while (last > first && Math.abs(d[last]) < threshold) last--;
  const lead = Math.max(0, first / audio.sampleRate - .004);
  return {audio, lead, duration:Math.max(.08, (last - first) / audio.sampleRate + .02)};
}

export async function loadWords(ctx, words, {signal, fetcher = fetch} = {}) {
  const missing = words.filter(w => !decoded.has(w));
  if (missing.length) {
    const response = await fetcher(API, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({words:missing}), signal});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(body.error || 'Synergy could not be reached.');
    await Promise.all(Object.entries(body.words).map(async ([word, base64]) => {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      decoded.set(word, measure(await ctx.decodeAudioData(bytes.buffer)));
    }));
  }
  const buffers = new Map(words.filter(w => decoded.has(w)).map(w => [w, decoded.get(w)]));
  return {buffers, durations:Object.fromEntries([...buffers].map(([w, b]) => [w, b.duration]))};
}
