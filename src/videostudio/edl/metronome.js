// The metronome EDL: a full-frame cut on every beat (or every N steps),
// alternating two high-contrast sources, so an export can be checked against
// ffmpeg's scene detector: every cut must land on round(T(step)·24).
//
//   const edl = metronomeEDL(plan, {format:'9:16', every:4});
//   const frames = expectedCuts(plan, edl);    // [0, 12, 24, ...] at 120 BPM; any tempo works
//
//   ffmpeg -i export.mp4 -vf "scdet=threshold=10,metadata=print" -f null -
// prints lavfi.scd.time for every detected cut; frame = round(time·24).
import {createEDL} from './schema.js';
import {stepTime, cutFrame, FPS} from './anchors.js';

export const METRONOME_SOURCES = ['gen:color:#000000', 'gen:color:#ffffff'];

export function metronomeEDL(plan, {format = '9:16', every = plan.beatSteps ?? 4, from = 0, to = plan.totalSteps, sources = METRONOME_SOURCES, cell = 'full', board = []} = {}) {
  const clips = [];
  for (let s = from, k = 0; s < to; s += every, k++) {
    const len = Math.min(every, to - s);
    clips.push({id:`m${k}`, at:s, len, cell, asset:sources[k % sources.length], why:`metronome: cut ${k} on step ${s}`});
  }
  return createEDL({form:plan.form ?? 'drop60', format, clips, board, steps:to});
}

// The frames the cuts must land on: round(T(step)·fps) for each clip after the first.
export const expectedCuts = (plan, edl, fps = FPS) => edl.clips.slice(1).map(c => cutFrame(stepTime(plan, c.at), fps));
