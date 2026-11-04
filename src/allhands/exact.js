// Exact sums, so two renders of the same plan are the same bytes.
//
// Chromium adds a node's input connections in an order that changes from run
// to run, and float addition is not associative: with three or more inputs
// sounding at once, every render differs in its last bits, and the bus
// compressors turn those bits into audible LSBs. Two inputs are exact
// (a + b = b + a), and an input that is silent adds exact zeros. A second
// source of drift: a filter, delay or shaper whose input changes channel count
// (the last stereo voice on a bus leaves) re-creates its kernels and loses its
// state, and the old code's disconnects landed on a different quantum every run.
//
// So no input here ever hears more than two connections at once, and no
// stateful node ever sees its channel count change:
//
//   - Voices reach a bus (any node made while the graph was built) through the
//     bus's head: a unity gain with a fixed channel count, the most any of its
//     voices has, so the bus always hears the same layout the old code gave it.
//   - A head sums its voices on lanes. A lane holds one voice at a time, by the
//     voice's scheduled start and stop plus a tail margin. Lanes chain: lane k
//     hears its voice and lane k + 1, two inputs; lane 0 is the head itself.
//     Any other input that would hear three at once chains the same way.
//   - Offline, a voice is attached to its lane at a suspend point before it
//     starts and detached at one after it ends (OfflineAudioContext.suspend):
//     every graph change lands on the same render quantum in every run, and the
//     render carries only the voices that can sound. The engine's onended
//     disconnects are ignored offline (they arrive whenever the main thread
//     gets to them).
//   - Live, connections are placed at the end of the task that made them
//     (a microtask), on the same lanes.
//
// Usage: const x = exactSession(ctx) before building; nodes made then are the
// structure. x.bus(node) names a bus voices will join. x.play() before
// scheduling: nodes made after are voices. Offline, x.finalize() before
// startRendering().

const RECS = new WeakMap();
const SESSION = Symbol('exact.session'), INSTALLED = Symbol('exact.installed');
const CREATORS = ['createGain', 'createBiquadFilter', 'createOscillator', 'createBufferSource', 'createConstantSource', 'createWaveShaper', 'createDelay',
  'createConvolver', 'createDynamicsCompressor', 'createStereoPanner', 'createChannelSplitter', 'createChannelMerger', 'createAnalyser', 'createIIRFilter', 'createPanner'];
const SOURCES = new Set(['createOscillator', 'createBufferSource', 'createConstantSource']);
export const MARGIN = .5;        // seconds of tail after a voice's last source stops
const WINDOW = .5, LEAD = .05;   // offline attach and detach points, every half second
const PERM = Object.freeze([-Infinity, Infinity]);

const USER = Symbol('exact.userFrames'), OWN = Symbol('exact.ownFrames'), NATIVE_SUSPEND = Symbol('exact.suspend');
const quantumOf = (ctx, t) => Math.floor(t * ctx.sampleRate / 128 + 1e-9);

function install(ctx) {
  if (ctx[INSTALLED]) return;
  if (typeof ctx.startRendering === 'function') {
    // Offline: a graph built without render() is finalized when rendering starts,
    // and the caller's own suspend points share ours instead of colliding with them.
    const nativeStart = ctx.startRendering, nativeSuspend = ctx.suspend;
    ctx[USER] = new Set(); ctx[OWN] = new Map();
    if (typeof nativeSuspend === 'function') {
      ctx[NATIVE_SUSPEND] = t => nativeSuspend.call(ctx, t);
      ctx.suspend = function (t) {
        const q = quantumOf(ctx, t), own = ctx[OWN].get(q);
        if (own) { own.user = true; return own.promise; }
        ctx[USER].add(q);
        return nativeSuspend.call(ctx, t);
      };
    }
    ctx.startRendering = function () {
      const s = ctx[SESSION];
      if (s && !s.finalized) s.finalize();
      return nativeStart.apply(ctx, arguments);
    };
  }
  for (const name of CREATORS) {
    const native = ctx[name];
    if (typeof native !== 'function') continue;
    ctx[name] = function (...args) {
      const node = native.apply(ctx, args), s = ctx[SESSION];
      return s ? s.adopt(node, name, args) : node;
    };
  }
  ctx[INSTALLED] = true;
}

// The node's own methods, routed to its session. `this` is the node.
function connect(dest, output = 0, input = 0) { const rec = RECS.get(this); return rec.session.edge(rec, dest, output, input); }
function disconnect(...args) { const rec = RECS.get(this); rec.session.cut(rec, args); }
function start(when = 0, offset, duration) {
  const rec = RECS.get(this);
  rec.start = when; rec.offset = offset ?? 0; rec.duration = duration;
  return rec.native.start.apply(this, arguments);
}
function stop(when = 0) {
  const rec = RECS.get(this);
  rec.stop = when;
  return rec.native.stop.apply(this, arguments);
}

const isParam = dest => typeof dest.connect !== 'function';

export function exactSession(ctx) {
  if (globalThis.__exact === 'off') return {offline:false, phase:'play', bus() {}, play() {}, flush() {}, finalize() { return {windows:0}; }, report() { return []; }};
  install(ctx);
  const offline = typeof ctx.startRendering === 'function';
  let phase = 'build', ids = 0, edgeIds = 0, pending = [], queued = false, memo = new Map(), chanMemo = new Map();
  const dests = new Map();     // dest (node or param) → Map(input → state)
  const proto = Object.getPrototypeOf(ctx);
  const rawGain = () => { const g = proto.createGain ? proto.createGain.call(ctx) : ctx.createGain(); g.exactLink = true; return g; };

  const session = {
    offline,
    get phase() { return phase; },
    play() { phase = 'play'; },
    adopt(node, kind, args, structural = phase === 'build') {
      const rec = {id:++ids, node, kind, session, structural, source:SOURCES.has(kind), inputs:[], edges:[], args,
        tail:kind === 'createDelay' ? (args[0] ?? 1) : kind === 'createBiquadFilter' ? .25 : kind === 'createDynamicsCompressor' ? 1 : 0,
        native:{connect:node.connect, disconnect:node.disconnect, start:node.start, stop:node.stop}};
      RECS.set(node, rec);
      node.connect = connect; node.disconnect = disconnect;
      if (rec.source) { node.start = start; node.stop = stop; }
      return node;
    },
    // A bus voices will join: its head exists from the start, so live playback
    // places it with the rest of the structure.
    bus(node, input = 0) { headOf(stateOf(node, input)); },
    edge(rec, dest, output, input) {
      const param = isParam(dest), destRec = param ? null : RECS.get(dest);
      const e = {id:++edgeIds, src:rec, dest, orig:dest, param, output, input:param ? 0 : input, origInput:param ? 0 : input, destRec, placed:false, attached:false, cut:false};
      rec.edges.push(e);
      if (destRec) destRec.inputs.push(e);
      pending.push(e);
      if (!offline && !queued) { queued = true; queueMicrotask(() => { queued = false; session.flush(); }); }
      return dest;
    },
    cut(rec, args) {
      // Offline a voice leaves the graph at its detach point, not when the main thread hears onended.
      if (offline && !rec.structural) return;
      const [a, b, c] = args, all = !args.length, byOutput = typeof a === 'number';
      for (const e of rec.edges) {
        if (e.cut) continue;
        if (!all && (byOutput ? e.output !== a : e.orig !== a || (b !== undefined && e.output !== b) || (c !== undefined && e.origInput !== c))) continue;
        e.cut = true;
        if (e.attached) { try { detach(e); } catch {} }
      }
      pending = pending.filter(e => !e.cut);
      if (all || byOutput) { try { rec.native.disconnect.apply(rec.node, args); } catch {} }
    },
    // Live: place everything made since the last flush.
    flush() {
      const batch = pending.filter(e => !e.cut); pending = []; memo = new Map(); chanMemo = new Map();
      place(batch);
      for (const e of batch) attach(e);
    },
    // Offline: place everything; attach voices at suspend points before they
    // start and detach them after they end (without suspend: all at once).
    finalize() {
      session.finalized = true;
      const batch = pending.filter(e => !e.cut); pending = []; memo = new Map(); chanMemo = new Map();
      place(batch);
      const length = ctx.length && ctx.sampleRate ? ctx.length / ctx.sampleRate : Infinity, quantum = 128 / (ctx.sampleRate || 44100);
      const windows = typeof ctx[NATIVE_SUSPEND] === 'function' && Number.isFinite(length) && globalThis.__exact !== 'nowindows', at = new Map();
      const later = (t, kind, e) => { const k = Math.round(t / WINDOW); if (!at.has(k)) at.set(k, {attach:[], detach:[]}); at.get(k)[kind].push(e); };
      for (const e of batch) {
        const voice = !e.src.structural && (e.param || !e.destRec || e.destRec.structural);
        if (!windows || !voice) { attach(e); continue; }
        const [s, end] = activity(e.src) || [0, 0];
        const on = Math.floor((s - LEAD) / WINDOW) * WINDOW, off = Math.ceil((end + quantum) / WINDOW) * WINDOW;
        if (!(on > 0)) attach(e); else if (on < length - quantum) later(on, 'attach', e); else continue;
        if (Number.isFinite(off) && off < length - quantum) later(off, 'detach', e);
      }
      for (const k of [...at.keys()].sort((a, b) => a - b)) {
        const {attach:on, detach:off} = at.get(k);
        // A quantum of our own, a little early if the caller suspends near it.
        let q = Math.round(k * WINDOW * ctx.sampleRate / 128);
        while ([q - 1, q, q + 1, q + 2].some(x => ctx[USER].has(x) || ctx[OWN].has(x))) q--;
        const entry = {user:false};
        entry.promise = ctx[NATIVE_SUSPEND]((q * 128 + 1) / ctx.sampleRate).then(() => {
          try { off.forEach(e => { if (e.attached) detach(e); }); on.forEach(attach); } finally { if (!entry.user) ctx.resume(); }
        });
        ctx[OWN].set(q, entry);
      }
      session.schedule = at;
      return {windows:at.size};
    },
    // For checks: every input, its lanes, and the most connections it can hear at once.
    report() {
      memo = new Map();
      const out = [];
      for (const [, m] of dests) for (const [, st] of m) {
        const lanes = st.lanes || [{edges:st.direct}];
        const overlap = Math.max(0, ...lanes.map((l, k) => maxOverlap(l.edges.map(e => activity(e.src))) + (k < lanes.length - 1 ? 1 : 0)));
        out.push({kind:st.head ? 'head' : RECS.get(st.dest)?.kind ?? (isParam(st.dest) ? 'param' : 'node'), lanes:lanes.length, edges:lanes.reduce((n, l) => n + l.edges.length, 0), overlap, channels:st.channels});
      }
      return out;
    },
  };
  ctx[SESSION] = session;

  // When a node can sound: a source from its start to its stop (or the end of
  // its buffer at half its rate) plus the margin; anything else, while any of
  // its inputs can, plus its own tail. The structure can always sound.
  function activity(rec) {
    if (rec.structural) return PERM;
    if (memo.has(rec)) return memo.get(rec);
    memo.set(rec, PERM);                              // a cycle sounds forever
    let a = null;
    if (rec.source) {
      if (rec.start !== undefined) {
        let end = rec.stop;
        if (end === undefined && rec.kind === 'createBufferSource' && !rec.node.loop) {
          const buffer = rec.node.buffer, rate = Math.max(.01, Math.abs(rec.node.playbackRate?.value ?? 1)) * .5;
          end = rec.start + (rec.duration ?? (buffer ? buffer.duration - rec.offset : Infinity)) / rate;
        }
        a = [rec.start - .01, (end ?? Infinity) + MARGIN];
      }
    } else {
      for (const e of rec.inputs) {
        if (e.cut) continue;
        const s = activity(e.src);
        if (s) a = a ? [Math.min(a[0], s[0]), Math.max(a[1], s[1])] : [s[0], s[1]];
      }
      if (a) a = [a[0], a[1] + (rec.kind === 'createConvolver' ? (rec.node.buffer?.duration ?? 3) : rec.tail)];
    }
    memo.set(rec, a);
    return a;
  }

  // How many channels a voice node puts out (Web Audio's mixing rules).
  function channels(rec) {
    if (chanMemo.has(rec)) return chanMemo.get(rec);
    chanMemo.set(rec, 1);
    const node = rec.node, kind = rec.kind;
    let n;
    if (kind === 'createStereoPanner' || kind === 'createPanner') n = 2;
    else if (kind === 'createChannelMerger') n = rec.args[0] ?? 6;
    else if (kind === 'createChannelSplitter' || kind === 'createOscillator' || kind === 'createConstantSource') n = 1;
    else if (kind === 'createBufferSource') n = node.buffer?.numberOfChannels ?? 1;
    else {
      const ins = rec.inputs.filter(e => !e.cut && !e.param).map(e => e.src.kind === 'createChannelSplitter' ? 1 : channels(e.src));
      const max = Math.max(1, ...ins), mode = node.channelCountMode, count = node.channelCount;
      n = mode === 'explicit' ? count : mode === 'clamped-max' ? Math.min(count ?? 2, max) : max;
      if (kind === 'createConvolver') n = 2;
    }
    chanMemo.set(rec, n);
    return n;
  }

  function stateOf(dest, input) {
    let m = dests.get(dest);
    if (!m) dests.set(dest, m = new Map());
    let st = m.get(input);
    if (!st) m.set(input, st = {dest, input, direct:[], lanes:null, head:null, channels:0});
    return st;
  }
  // A bus's head: a unity gain the voices join, whose channel count never changes.
  function headOf(st) {
    if (st.head) return st.head;
    const node = session.adopt(rawGain(), 'createGain', [], true);
    node.gain.value = 1;
    const head = st.head = stateOf(node, 0);
    head.isHead = true; head.channels = 1;
    setChannels(node, 1);
    node.connect(st.dest, 0, st.input);
    return head;
  }
  function setChannels(node, n) {
    try { node.channelCountMode = 'explicit'; node.channelCount = n; node.channelInterpretation = 'speakers'; } catch {}
  }

  function place(batch) {
    // Voices that join a bus go through its head.
    for (const e of batch) {
      if (e.src.structural || e.param || (e.destRec && !e.destRec.structural) || (e.destRec && stateOf(e.dest, e.input).isHead)) continue;
      const head = headOf(stateOf(e.dest, e.input));
      e.dest = head.dest; e.input = 0; e.destRec = RECS.get(head.dest);
      e.destRec.inputs.push(e);
    }
    batch.push(...pending.splice(0));                     // the heads' own connections
    const groups = new Map();
    for (const e of batch) {
      const st = stateOf(e.dest, e.input);
      if (!groups.has(st)) groups.set(st, []);
      groups.get(st).push(e);
    }
    for (const [st, list] of groups) {
      const timed = list.map(e => ({e, a:activity(e.src)})).sort((x, y) => (x.a ? x.a[0] : Infinity) - (y.a ? y.a[0] : Infinity) || x.e.id - y.e.id);
      if (st.isHead) {
        const n = Math.max(st.channels, ...list.map(e => channels(e.src)));
        if (n !== st.channels) { st.channels = n; setChannels(st.dest, n); (st.lanes || []).slice(1).forEach(l => setChannels(l.node, n)); }
      }
      if (!st.lanes) {
        if (maxOverlap([...st.direct.map(e => activity(e.src)), ...timed.map(x => x.a)]) <= 2) {
          for (const {e} of timed) { e.target = st.dest; e.targetInput = st.input; st.direct.push(e); }
          continue;
        }
        // Lane 0 is the destination itself; whatever it already hears stays there.
        st.lanes = [{node:st.dest, input:st.input, until:Math.max(-Infinity, ...st.direct.map(e => (activity(e.src) || [0, -Infinity])[1])), edges:[...st.direct]}];
      }
      for (const {e, a} of timed) {
        const lane = a ? laneFor(st, a) : st.lanes[0];
        lane.edges.push(e);
        e.target = lane.node; e.targetInput = lane.input;
      }
    }
    for (const e of batch) e.placed = true;
  }

  function laneFor(st, [from, to]) {
    let lane = st.lanes.find(l => l.until <= from);
    if (!lane) {
      // A new link in the chain: it hears its voice and the next link, and feeds the previous one.
      const g = rawGain(), prev = st.lanes.at(-1);
      g.gain.value = 1;
      if (st.isHead) setChannels(g, st.channels);
      if (isParam(prev.node)) g.connect(prev.node, 0); else g.connect(prev.node, 0, prev.input);
      st.lanes.push(lane = {node:g, input:0, until:-Infinity, edges:[]});
    }
    lane.until = Math.max(lane.until, to);
    return lane;
  }

  function attach(e) {
    if (e.attached || e.cut || !e.placed) return;
    const fn = e.src.native.connect;
    if (isParam(e.target)) fn.call(e.src.node, e.target, e.output); else fn.call(e.src.node, e.target, e.output, e.targetInput);
    e.attached = true;
  }
  function detach(e) {
    const fn = e.src.native.disconnect;
    if (isParam(e.target)) fn.call(e.src.node, e.target, e.output); else fn.call(e.src.node, e.target, e.output, e.targetInput);
    e.attached = false;
  }
  return session;
}

// The most intervals that overlap at any moment ([a, b]; null never sounds).
export function maxOverlap(intervals) {
  const ev = [];
  for (const a of intervals) if (a) ev.push([a[0], 1], [a[1], -1]);
  ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let n = 0, max = 0;
  for (const [, d] of ev) { n += d; if (n > max) max = n; }
  return max;
}

// The session building on a context (checks read its report and schedule).
export const sessionOf = ctx => ctx[SESSION];
