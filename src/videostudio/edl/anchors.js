// Musical time for the EDL. An At names a moment of a song plan; this module
// turns it into song seconds and output frames, using plan.timing (the
// swing-aware Float64Array of step start times) and nothing else. No tempo is
// assumed: a step can be any length, and a step need not be a whole number of
// frames. Pure.
//
//   At = step                                    a 16th-note step, fractional allowed
//      | {anchor, off?, frames?}                 a named moment, then `off` steps, then `frames` frames
//
// Anchors:
//   bar:n                 the downbeat of bar n
//   step:n                step n
//   section:<name>[#k]    the first step of the k-th section called <name> (case, spaces and dashes ignored)
//   cue:impact|choke|unmute|sink|stop|start|end
//   lady:<role>[#n]       the n-th lady event of that role (ladder, tag, impact, punct, sink, stop)
//   lady:r<k>[#n]         the n-th retrigger of ladder rung k
//   lady[#n]              the n-th lady event of any role
//   word:<kind>[#n]       the n-th word Synergy sings in lines of that kind (host, verse, hook, answer); word:any
//   line:<kind>[#n]       the first word of the n-th line of that kind
//   stutter[#n]           the n-th of Synergy's stammered syllables
// n may be negative: #-1 is the last one.

export const FPS = 24;
export const PEG_LEAD = .010;        // pegs light on floor((t + .010)·24): they may lead the audio, never lag it

export const barSteps = plan => plan.barSteps ?? 16;
export const beatSteps = plan => plan.beatSteps ?? 4;

// A cut at song time t lands on this frame.
export const cutFrame = (t, fps = FPS) => Math.round(t * fps);
// A peg that lights at song time t lights on this frame.
export const pegFrame = (t, fps = FPS) => Math.floor((t + PEG_LEAD) * fps + 1e-9);

// Song seconds of a step, fractional steps interpolated inside their step.
// Outside the table the first and last step lengths extend it.
export function stepTime(plan, step) {
  const T = plan.timing, n = T.length - 1;
  if (!(n >= 1)) throw Error('plan.timing needs at least two entries');
  if (step <= 0) return step === 0 ? T[0] : T[0] + step * (T[1] - T[0]);
  if (step >= n) return T[n] + (step - n) * (T[n] - T[n - 1]);
  const i = Math.floor(step), u = step - i;
  return u ? T[i] + u * (T[i + 1] - T[i]) : T[i];
}

// The step (fractional) playing at song time t: the inverse of stepTime.
export function stepAtTime(plan, t) {
  const T = plan.timing, n = T.length - 1;
  if (t <= T[0]) return (t - T[0]) / (T[1] - T[0]);
  if (t >= T[n]) return n + (t - T[n]) / (T[n] - T[n - 1]);
  let lo = 0, hi = n;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid] <= t) lo = mid; else hi = mid; }
  return lo + (t - T[lo]) / (T[lo + 1] - T[lo]);
}

// The lady's events keep the engine's own clock: the floor step's time plus the
// fraction at the nominal step length (engine.js scheduleStep), so a 32nd of
// the ladder is exactly where she is heard.
export function ladyTime(plan, e) {
  const i = Math.floor(e.at), frac = e.at - i, nominal = plan.step ?? (plan.timing[1] - plan.timing[0]);
  return stepTime(plan, i) + frac * nominal;
}

const norm = s => String(s).toLowerCase().replace(/[\s_\-]+/g, '');
function pick(list, n, what) {
  const i = n < 0 ? list.length + n : n;
  if (!(i >= 0 && i < list.length)) throw Error(`${what}: index ${n} out of range (${list.length} available)`);
  return list[i];
}
function parseAnchor(anchor) {
  const m = /^([a-z]+)(?::([^#]+))?(?:#(-?\d+))?$/i.exec(String(anchor).trim());
  if (!m) throw Error(`cannot read anchor "${anchor}"`);
  return {kind:m[1].toLowerCase(), name:m[2] ?? '', n:m[3] === undefined ? 0 : +m[3]};
}

// The step (and, for lady events, the exact time) an anchor names.
export function anchorPoint(plan, anchor) {
  const {kind, name, n} = parseAnchor(anchor);
  const T = s => stepTime(plan, s);
  switch (kind) {
    case 'bar': { const b = +name; if (!Number.isFinite(b)) throw Error(`bar anchor needs a number: ${anchor}`); return {step:b * barSteps(plan)}; }
    case 'step': { const s = +name; if (!Number.isFinite(s)) throw Error(`step anchor needs a number: ${anchor}`); return {step:s}; }
    case 'section': {
      const list = (plan.sections || []).filter(s => norm(s.name) === norm(name));
      return {step:pick(list, n, `section "${name}"`).from * barSteps(plan)};
    }
    case 'cue': {
      const tape = k => (plan.tape || []).find(x => x.kind === k);
      const impact = plan.choke?.until ?? (plan.lady || []).find(e => e.role === 'impact')?.at;
      const steps = {start:0, end:plan.totalSteps, impact, choke:plan.choke?.at, unmute:plan.call?.until, sink:tape('sink')?.from, stop:tape('stop')?.from};
      const s = steps[norm(name)];
      if (s === undefined) throw Error(`this plan has no cue "${name}"`);
      return {step:s};
    }
    case 'lady': {
      const all = plan.lady || [];
      const r = /^r(\d+)$/i.exec(name);
      const list = !name ? all : r ? all.filter(e => e.role === 'ladder' && e.rung === +r[1]) : all.filter(e => e.role === norm(name));
      const e = pick(list, n, `lady "${name || 'any'}"`);
      return {step:e.at, time:ladyTime(plan, e), event:e};
    }
    case 'word': {
      const list = (plan.words || []).filter(w => norm(name) === 'any' || !name || w.kind === norm(name)).sort((a, b) => a.at - b.at);
      const w = pick(list, n, `word "${name}"`);
      return {step:w.at, word:w};
    }
    case 'line': {
      const list = (plan.lines || []).filter(l => (norm(name) === 'any' || !name || l.kind === norm(name)) && l.words.length);
      const l = pick(list, n, `line "${name}"`);
      return {step:l.words[0].at, line:l};
    }
    case 'stutter': return {step:pick(plan.stutters || [], n, 'stutter').at};
    default: throw Error(`unknown anchor kind "${kind}" in "${anchor}"`);
  }
}

// At -> {step, time, frame}. `step` includes `off` but not `frames`; `time` is
// song seconds (with `frames` applied); `frame` is the cut frame round(time·fps).
export function resolveAt(plan, at, fps = FPS) {
  if (typeof at === 'number') {
    if (!Number.isFinite(at)) throw Error(`step must be a finite number, got ${at}`);
    const time = stepTime(plan, at);
    return {step:at, time, shift:0, frame:cutFrame(time, fps)};
  }
  if (!at || typeof at !== 'object' || typeof at.anchor !== 'string') throw Error('At must be a step number or {anchor, off?, frames?}');
  const p = anchorPoint(plan, at.anchor), off = at.off ?? 0, frames = at.frames ?? 0;
  const base = off === 0 && p.time !== undefined ? p.time : stepTime(plan, p.step + off);
  const shift = frames / fps, time = base + shift;
  return {step:p.step + off, time, shift, frame:cutFrame(time, fps)};
}

// The span an EDL item covers: from its At for `len` steps. A `frames` offset
// shifts both ends, so back-to-back vocal cuts (word − 1 f) still abut.
export function resolveSpan(plan, at, len, fps = FPS) {
  const a = resolveAt(plan, at, fps);
  const end = stepTime(plan, a.step + len) + a.shift;
  return {...a, len, end, endFrame:cutFrame(end, fps)};
}

// Every anchor a plan offers, resolved: for the editor's snapping and for tests.
export function listAnchors(plan, fps = FPS) {
  const out = [], push = anchor => { try { out.push({anchor, ...resolveAt(plan, {anchor}, fps)}); } catch {} };
  for (const c of ['start', 'unmute', 'choke', 'impact', 'sink', 'stop', 'end']) push(`cue:${c}`);
  const seen = {};
  for (const s of plan.sections || []) { const k = norm(s.name); push(`section:${s.name}#${seen[k] = (seen[k] ?? -1) + 1}`); }
  const roles = {}, rungs = {};
  for (const e of plan.lady || []) {
    push(`lady:${e.role}#${roles[e.role] = (roles[e.role] ?? -1) + 1}`);
    if (e.role === 'ladder') push(`lady:r${e.rung}#${rungs[e.rung] = (rungs[e.rung] ?? -1) + 1}`);
  }
  const kinds = {};
  for (const w of [...(plan.words || [])].sort((a, b) => a.at - b.at)) push(`word:${w.kind}#${kinds[w.kind] = (kinds[w.kind] ?? -1) + 1}`);
  for (let b = 0; b <= Math.floor(plan.totalSteps / barSteps(plan)); b++) push(`bar:${b}`);
  return out;
}
