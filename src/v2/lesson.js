// The Corporate Phrasebook — the /v2 homepage's audio director.
//
// Strike a key and the page teaches you the phrase, in the cadence of a
// language tape that has been through a compliance review:
//
//   "Let's say"  →  [the phrase, in the recorded library voice]
//   ~ the beat arrives ~
//   [the phrase, on the downbeat, two or three times]
//   "Just say"   →  [the phrase]
//   "Remember"   →  [the phrase]  →  everything phases and decays out
//
// The instructional cues are the browser's own speech voice; the phrase itself
// is always the recorded bank (the "library voice"), so the two never blur.
//
// Every phrase in the bank is a different length (0.5s to 2.7s against a 2.14s
// bar at 112 BPM), so the lesson is laid out in BARS, not seconds: one
// utterance claims however many whole bars it needs, and the structure above is
// identical for every phrase. planLesson() is pure and covered by
// scripts/check-lesson.mjs; the director below adds the audio graph.

export const CUES = {
  intro: "Let's say",
  recap: 'Just say',
  closing: 'Remember',
};

// How many whole bars one utterance claims. The tail keeps a phrase from
// butting straight into the next downbeat.
export const barsFor = (phraseSec, barSec, tail = .3) =>
  Math.max(1, Math.ceil((Math.max(0, phraseSec) + tail) / barSec));

// The lesson as a list of bar-aligned slots. Short phrases get three drills,
// long ones get two — the arc stays the same length in feel, not in seconds.
export function planLesson({ phraseSec, barSec, drills, cueBars = 1, decayBars = 2 }) {
  if (!(barSec > 0)) throw new Error('barSec must be positive');
  const phraseBars = barsFor(phraseSec, barSec);
  const reps = drills === undefined ? (phraseBars > 1 ? 2 : 3) : drills;
  const slots = [];
  let at = 0;
  const push = (stage, bars) => { slots.push({ stage, atBar: at, bars }); at += bars; };
  for (let i = 0; i < reps; i++) push('drill', phraseBars);
  push('recap-cue', cueBars);
  push('recap', phraseBars);
  push('closing-cue', cueBars);
  push('closing', phraseBars);
  push('decay', decayBars);
  return { phraseBars, drills: reps, slots, totalBars: at, barSec, seconds: at * barSec };
}

// speechSynthesis will not tell you how long it intends to take, and on some
// browsers it never fires onend at all — so every cue is raced against an
// estimate and the lesson keeps its shape either way.
export const estimateSpeech = text => Math.max(.6, String(text || '').length * .075 + .35);

// A browser with no installed voices fires onerror instantly (and a browser
// whose voice list has not populated yet does the same), which would drop the
// phrase on top of the cue that introduces it. FLOOR keeps a beat of silence
// there either way, so the lesson still reads as two separate speakers.
export const CUE_FLOOR = .45;

export function speakAndWait(voice, text, opts) {
  const budget = estimateSpeech(text) + 1.2;
  const started = Date.now();
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const held = (Date.now() - started) / 1000;
      if (held >= CUE_FLOOR) resolve();
      else setTimeout(resolve, (CUE_FLOOR - held) * 1000);
    };
    const timer = setTimeout(finish, budget * 1000);
    try {
      const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
      if (!synth) { clearTimeout(timer); setTimeout(finish, estimateSpeech(text) * 1000); return; }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.rate = (opts && opts.rate) || .95;
      u.pitch = (opts && opts.pitch) || 1;
      u.onend = () => { clearTimeout(timer); finish(); };
      u.onerror = () => { clearTimeout(timer); finish(); };
      synth.speak(u);
    } catch (e) { clearTimeout(timer); finish(); }
  });
}

// Pull one clip out of the recorded bank on demand. The whole bank is 9MB, far
// too much to hand a marketing page up front, so a strike fetches only what it
// is about to say and leaves it in CBVoice's Map for next time.
export async function ensureClip(audio, voice, base, bankIx) {
  if (voice.bank.has(bankIx)) return voice.bank.get(bankIx);
  for (const ext of ['wav', 'mp3', 'm4a']) {
    try {
      const res = await fetch(`${base}${String(bankIx + 1).padStart(2, '0')}.${ext}`);
      if (!res.ok) continue;
      const buf = await audio.decode(await res.arrayBuffer());
      voice.bank.set(bankIx, buf);
      return buf;
    } catch (e) { /* try the next extension */ }
  }
  return null;
}

// The transport + lesson runner. `getPattern` reads the live sequencer grid so
// edits land on the next bar; `onState` drives the UI (readout, Barry, playhead).
export function createDirector({ audio, voice, phraseBase, tempo = 112, onState = () => {} }) {
  const stepSec = 60 / tempo / 4;      // 16ths — 134ms at 112 BPM, per the design
  const barSec = stepSec * 16;
  let pattern = null, getPattern = () => pattern;
  let iv = null, timers = [], step = 0, nextTime = 0;
  let token = 0;                        // bumped by every stop/restart; stale work checks it
  let fadeFrom = null;                  // audio time the decay began
  let lessonActive = false;
  let state = { playing: false, stage: null, phrase: null, step: null, loading: false };

  const emit = next => { state = { ...state, ...next }; onState(state); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const at = (t, fn) => { timers.push(setTimeout(fn, Math.max(0, (t - audio.now()) * 1000))); };

  function transportTick() {
    const p = getPattern();
    while (nextTime < audio.now() + .12) {
      const s = step % 16, t = nextTime;
      // during the decay the kit thins out instead of stopping dead
      let duck = 1;
      if (fadeFrom !== null) {
        const gone = (t - fadeFrom) / (barSec * 2);
        duck = Math.max(0, 1 - gone);
      }
      if (duck > .02 && p) {
        const hit = (row, id, base) => { const v = p[row] && p[row][s]; if (v) audio.trigger(id, (v === 2 ? 1 : base) * duck, t); };
        hit(0, 'kick', .72); hit(1, 'snare', .72); hit(2, 'ch', .62);
        // The vox row speaks only when a lesson is not already talking, and
        // only once its recording has arrived — a row that fell back to the
        // browser voice would put two different speakers in the same bar.
        if (!lessonActive && p[3] && p[3][s]) {
          const pad = padAt(s);
          const buf = pad && voice.bank.get(pad.bank);
          if (buf) audio.playBuffer(buf, { when: t, vel: .8, bus: 'vox', detune: -20, warble: .18 });
        }
      }
      const kick = !!(p && p[0] && p[0][s]);
      at(t, () => emit({ step: s, kickAt: kick ? Date.now() : state.kickAt }));
      nextTime += stepSec; step++;
    }
  }

  let pads = [];
  const padAt = s => pads[s] || null;
  const setPads = list => { pads = list || []; };

  function speakClip(pad, when, vel = .95) {
    const buf = voice.bank.get(pad.bank);
    if (buf) {
      audio.playBuffer(buf, { when, vel, bus: 'vox', detune: -20, warble: .18 });
      return buf.duration;
    }
    // no recording reached us — the browser voice says the actual line instead,
    // so the lesson never silently skips a beat
    at(when, () => voice.speak(pad.say, { rate: .95 }));
    return estimateSpeech(pad.say);
  }

  function startTransport(t0) {
    step = 0; nextTime = t0; fadeFrom = null;
    clearInterval(iv);
    iv = setInterval(transportTick, 25);
    transportTick();
    emit({ playing: true });
  }

  function stopTransport() {
    clearInterval(iv); iv = null;
    clearTimers();
    fadeFrom = null; lessonActive = false;
    try { audio.setFilter(20000, 0); audio.setVoxFx({ weird: 0 }); } catch (e) {}
    emit({ playing: false, stage: null, step: null });
  }

  return {
    barSec, stepSec,
    setPads,
    setPattern(p) { pattern = p; getPattern = () => p; },
    getState: () => state,

    // CONVENE / ADJOURN — the plain loop, no lesson
    toggleBeat() {
      audio.unlock();
      token++;
      if (state.playing) { stopTransport(); return false; }
      lessonActive = false;
      startTransport(audio.now() + .08);
      // pull down whatever the vox row is going to say, so it speaks in the
      // library voice from the next bar rather than skipping all session
      const p = getPattern();
      if (p && p[3]) {
        const wanted = new Set();
        p[3].forEach((v, s) => { if (v && pads[s]) wanted.add(pads[s].bank); });
        wanted.forEach(ix => { ensureClip(audio, voice, phraseBase, ix).catch(() => {}); });
      }
      return true;
    },

    // Strike a key: the full phrasebook lesson.
    async strike(pad) {
      audio.unlock();
      const mine = ++token;
      const alive = () => token === mine;

      clearTimers();
      clearInterval(iv); iv = null;
      lessonActive = true;
      fadeFrom = null;
      try { audio.setFilter(20000, 0); audio.setVoxFx({ weird: 0 }); } catch (e) {}
      emit({ playing: true, stage: 'loading', phrase: pad, loading: true });

      const buf = await ensureClip(audio, voice, phraseBase, pad.bank);
      if (!alive()) return;
      emit({ loading: false });

      const phraseSec = buf ? buf.duration : estimateSpeech(pad.say);
      const plan = planLesson({ phraseSec, barSec });

      // --- preamble, off the clock: the instruction, then the specimen ---
      emit({ stage: 'intro' });
      await speakAndWait(voice, CUES.intro);
      if (!alive()) return;

      emit({ stage: 'specimen' });
      speakClip(pad, audio.now() + .05);
      await new Promise(r => setTimeout(r, (phraseSec + .35) * 1000));
      if (!alive()) return;

      // --- the beat arrives; everything below is bar-aligned ---
      const t0 = audio.now() + .12;
      startTransport(t0);

      for (const slot of plan.slots) {
        const when = t0 + slot.atBar * barSec;
        if (slot.stage === 'drill' || slot.stage === 'recap' || slot.stage === 'closing') {
          at(when - .01, () => { if (alive()) emit({ stage: slot.stage }); });
          if (buf) audio.playBuffer(buf, { when, vel: .95, bus: 'vox', detune: -20, warble: .18 });
          else at(when, () => alive() && voice.speak(pad.say, { rate: .95 }));
        } else if (slot.stage === 'recap-cue' || slot.stage === 'closing-cue') {
          const text = slot.stage === 'recap-cue' ? CUES.recap : CUES.closing;
          at(when, () => { if (!alive()) return; emit({ stage: slot.stage }); voice.speak(text, { rate: .95 }); });
        } else if (slot.stage === 'decay') {
          at(when, () => {
            if (!alive()) return;
            emit({ stage: 'decay' });
            fadeFrom = audio.now();
            // phase out: the room opens, the delay smears, the top end closes
            try {
              audio.setVoxFx({ weird: .85 });
              audio.setVoxVerb(.5);
              audio.setFilter(190, slot.bars * barSec);
            } catch (e) {}
          });
        }
      }

      // let the tails ring past the last bar, then reset the bus
      at(t0 + plan.totalBars * barSec + 1.2, () => {
        if (!alive()) return;
        stopTransport();
        try { audio.setVoxVerb(.08); } catch (e) {}
      });
    },

    stop() { token++; stopTransport(); },
  };
}
