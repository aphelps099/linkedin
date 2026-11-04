// The live preview: the All Hands engine plays the song, the audio clock picks the frame,
// the compositor draws it.
//
//   const pv = createPreview({canvas, program, plan, shots, song:{buffers, lady}});
//   await pv.ready;
//   pv.play(); pv.pause(); pv.toggle();
//   pv.seek(seconds)            jumps (audio restarts on the 16th that holds it)
//   pv.scrub(seconds)           while dragging: the picture follows, the sound waits
//   pv.endScrub()               resumes if it was playing
//   pv.step(±frames)            frame by frame, paused
//   pv.setProgram(program)      a recompile (another format): the same moment, re-laid out
//   pv.on(fn)                   fn({f, t, playing, stats}) once per drawn frame
//
// The clock: f = floor((performance.position() + avOffset) · 24). position() is the audio
// context's time since the song's start, less the output latency, so the picture is drawn for
// the sound that is reaching the speakers. Paused, the picture holds on the paused time.
import {Performance, buildGraph, prepare, scheduleStep, scheduleColdOpen} from '../../allhands/engine.js';
import {createCompositor} from '../gl/compositor.js';
import {createElementPool} from '../media/element-pool.js';
import {createStutterCache} from '../media/stutter-cache.js';

const FPS = 24;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// The engine's Performance, able to start anywhere: the song is scheduled from the 16th that
// holds the requested time, with the song-level state (the call's band-pass) set as if it had
// played from the top. Everything else (levels, analysers, stop, the mobile audio session) is
// the engine's own.
// options.coldOpen: the parts prepareColdOpen() cut for this plan. Started inside the cold open
// (before plan.coldOpen.resume) the song starts from the top with them in front of it: the
// impact, then the rewind, picture and sound together.
export class StudioPerformance extends Performance {
  startAt(plan, buffers, options, onEnd, lady, seconds = 0) {
    this.stop(true);
    const cold = options?.coldOpen?.channels && plan.coldOpen && seconds < plan.coldOpen.resume ? options.coldOpen : null;
    let step = 0;
    if (!cold) while (step < plan.totalSteps && plan.timing[step + 1] <= seconds) step++;
    const ctx = this.ctx, graph = this.graph = buildGraph(ctx, options, plan), song = prepare(plan, buffers, lady);
    const start = ctx.currentTime + .12, t0 = this.t0 = start - plan.timing[step];
    graph.oscillators.forEach(o => o.start(start));
    if (cold) scheduleColdOpen(graph, cold, t0);
    if (plan.call && step > 0) {
      if (step >= plan.call.until) { graph.full.gain.value = 1; graph.call.gain.value = 0; }
      else { graph.full.gain.value = 0; graph.call.gain.value = 1.6; }
    }
    this.plan = plan; this.running = true;
    let next = step;
    const tick = () => {
      if (!this.running) return;
      while (next <= plan.totalSteps && t0 + plan.timing[next] < ctx.currentTime + .3) scheduleStep(graph, song, next++, t0);
      if (ctx.currentTime > t0 + plan.duration) { this.stop(); onEnd?.(); }
    };
    tick(); this.timer = setInterval(tick, 30);
    return plan.timing[step];
  }
}

export function createPreview({canvas, program, plan, shots, song = {}, compositor = null, scale = 1, avOffset = 0, voice = 'sung', loop = false} = {}) {
  const comp = compositor ?? createCompositor(canvas, {format:program.format, scale});
  const cache = createStutterCache();
  const pool = createElementPool({shots, cache});
  const perf = new StudioPerformance();
  const listeners = new Set();
  let prog = program, playing = false, held = 0, scrubbing = false, resume = false, raf = 0, lastF = -1, lastDraw = null, disposed = false;
  let audioOk = true;

  function setProgram(p) {
    prog = p;
    comp.prepare(p, {plan, shots});
    pool.setProgram(p);
    lastF = -1;
  }
  const ready = comp.ready.then(() => { setProgram(prog); loopFrame(); });

  const position = () => {
    if (!playing) return held;
    const p = perf.position();
    return p < 0 ? held : p + avOffset;
  };
  const frameAt = t => clamp(Math.floor(t * FPS + 1e-6), 0, prog.frames - 1);

  function loopFrame() {
    if (disposed) return;
    raf = requestAnimationFrame(loopFrame);
    let t = position();
    if (playing && t >= prog.duration) {
      if (loop) { seek(0); t = 0; }
      else { pause(); held = t = prog.duration - .5 / FPS; }
    }
    const f = frameAt(t);
    pool.update(f, t, playing && !scrubbing);
    if (f !== lastF || pool.dirty) draw(f, t);
  }
  function draw(f, t) {
    pool.clean();
    const stats = comp.drawFrame(prog.frame(f), pool.source, {program:prog});
    lastF = f; lastDraw = {f, t, playing, stats, pool:pool.stats, cache:cache.stats};
    for (const fn of listeners) fn(lastDraw);
  }

  async function play() {
    if (playing) return;
    await ready;
    const at = held >= prog.duration - 1 / FPS ? 0 : held;
    try {
      await perf.unlock();
      const from = perf.startAt(plan, song.buffers || new Map(), {mode:voice, coldOpen:song.coldOpen}, () => { if (playing) { playing = false; held = prog.duration - .5 / FPS; emit(); } }, song.lady, at);
      held = from; audioOk = true;
    } catch (e) { audioOk = false; throw e; }
    playing = true; emit();
  }
  function pause() {
    if (!playing) return;
    held = clamp(position(), 0, prog.duration - .5 / FPS);
    playing = false; perf.stop(true); pool.pause(); lastF = -1; emit();
  }
  function seek(seconds) {
    held = clamp(seconds, 0, prog.duration - .5 / FPS); lastF = -1;
    if (playing) { perf.stop(true); playing = false; play(); }
    else emit();
  }
  function scrub(seconds) {
    if (!scrubbing) { scrubbing = true; resume = playing; if (playing) pause(); }
    held = clamp(seconds, 0, prog.duration - .5 / FPS); lastF = -1; emit();
  }
  function endScrub() { if (!scrubbing) return; scrubbing = false; if (resume) play(); }
  function step(n) { if (playing) pause(); held = clamp((frameAt(held) + n + .5) / FPS, 0, prog.duration - .5 / FPS); lastF = -1; emit(); }
  const emit = () => { if (lastDraw) for (const fn of listeners) fn({...lastDraw, playing}); };

  // A new plan (the voice arrived, the post changed): the same moment in the new song.
  function setSong(nextPlan, nextSong, nextProgram) {
    const was = playing;
    if (playing) pause();
    plan = nextPlan; song = nextSong ?? song;
    setProgram(nextProgram);
    held = clamp(held, 0, nextProgram.duration - .5 / FPS);
    if (was) play();
  }

  return {
    ready, play, pause, seek, scrub, endScrub, step, setProgram, setSong,
    toggle:() => playing ? pause() : play(),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    redraw() { lastF = -1; },
    get playing() { return playing; }, get time() { return position(); }, get frame() { return frameAt(position()); },
    get program() { return prog; }, get compositor() { return comp; }, get pool() { return pool; }, get cache() { return cache; },
    get performance() { return perf; }, get audioOk() { return audioOk; },
    set avOffset(v) { avOffset = v; }, get avOffset() { return avOffset; },
    set voice(v) { voice = v; perf.voice?.(v); },
    dispose() { disposed = true; cancelAnimationFrame(raf); perf.close(); pool.dispose(); cache.clear(); if (!compositor) comp.dispose(); },
  };
}
