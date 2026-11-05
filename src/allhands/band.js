// The band's parts in the Drop Edition (casting.js castSong: the couplet, the
// refrain, the exchanges, the sign-off, the stabs and the drop's tag). Synergy
// sings the post and his hook at most three times (the verse, Drop A, and once
// in Drop B after her "Read that again."); the band (Strategy, Synthia and the
// lady's recordings) sings the lexicon where his other repeats were. Strategy
// and Synthia are the voice bank's takes (voices/voice-table.js), sung through
// the pixel chain onto notes in the track's key at play time; the lady is cut
// on her measured words and tuned as her ladder is. Pure: every part, note and
// second is decided here, before any audio exists.
//
//   hasBand(cast)                       the cast carries band parts (castSong's do; today's cast does not)
//   bandSetlist(setlist, track, cast)   Synergy's slots and the ones he gives the band
//   coupletDrop(cast, track)            the couplet's tag and impact as drop parts, or null (her tag plays)
//   placeBand(...)                      the band's events (plan.band) and the parts left out (plan.bandLeft)
//   pixelLine(take, ...)                notes for a take: one per syllable, a wandering line in key
//   partOf(part)                        a cast part's audio: {voice, file, key, from, to, onset, words, gainDb, entry}
import {BAR_STEPS, hash, HOST} from './song.js';
import {slice, LADY_TABLE} from './lady-table.js';
import {TAKE_TABLE, VOICE_TABLE} from './voices/voice-table.js';
import {lineFor} from './voices/melody.js';
import {VOICES} from './voices/items.js';
import {pitchOf, ladyClock, ladyLength} from './drop.js';

export const BAND_PARTS = ['couplet', 'refrain', 'exchanges', 'signoff', 'stabs', 'dropTag'];
// Every voice's measured words by file: her recordings and the bank's takes, for
// the Peg Board and the exports (an event's words through its file, cut and rate).
export const SONG_TABLE = Object.freeze({...LADY_TABLE, ...VOICE_TABLE});
export const hasBand = cast => !!cast && BAND_PARTS.some(r => Array.isArray(cast[r]) ? cast[r].length : cast[r]);
// The most times Synergy sings his hook when the band is cast (the lead's rule, Nov 5).
export const SYNERGY_HOOKS = 3;
// Seconds of air a band part keeps from any other voice, before and after.
export const GUARD = .06;
// A band part may speed up this much (its notes sung lower to land in key) to fit its gap.
export const MAX_RATE = 1.12;
// Synthia's tag may be quicker, as her ladder's tag is (the lexicon: up to 1.25x).
export const TAG_MAX_RATE = 1.25;
// dB a part rises by in the drops (her puncts rise 3), and the share of his voice a part counts
// for in the verse's room for the drops (drop.js roomTrim), by voice: a pixel voice on her stem
// carries a drop on a phone less than his vocoder and choir do.
// BAND_GAIN: every part over the take's own level (the lady's -14 dBFS speech reference): the band
// carries the song where Synergy's repeats were, so it sits nearer his level than her asides do.
export const BAND_GAIN = 6, DROP_LIFT = 3.5;
// Per voice: Strategy sings low (D2 to D3), and most of his voice is under a phone speaker's 300 Hz.
export const PHONE_WEIGHT = Object.freeze({strategy:.35, synthia:.8, lady:.7});
// Synthia's Flite takes lose more to the band than Strategy's Kokoro takes do (Whisper on the full mix
// lost her short Ys in the drops): she sits this much higher.
export const VOICE_GAIN = Object.freeze({strategy:0, synthia:3, lady:0});
// dB the whole mix rises by when the band is cast (plan.makeup, engine.js output): Synergy's hook
// repeats with his choir were the loudest voice in the room, and the band replaces them at a level
// that leaves the drops their lift; this brings the song back to -10 LUFS.
export const BAND_MAKEUP = .7;
// How many more times the refrain comes round after its first (in the drops, where it fits).
export const REFRAIN_REPEATS = 2;

const NAMES = {C:0, D:2, E:4, F:5, G:7, A:9, B:11};
// The track's key as a tonic pitch class and its pentatonic as steps above it (melody.js scales).
export function keyOf(tr) {
  const m = /^([A-G])(?:-?(flat|sharp)|([b♭#♯]))?/i.exec(String(tr.key).trim()), acc = (m?.[2] || m?.[3] || '').toLowerCase();
  const tonic = ((NAMES[m[1].toUpperCase()] + (/flat|b|♭/.test(acc) ? -1 : /sharp|#|♯/.test(acc) ? 1 : 0)) % 12 + 12) % 12;
  const penta = tr.drop?.ladder?.pentatonic ?? tr.wander?.pentatonic;
  return {tonic, scale:[...new Set(penta.map(p => (p - tonic + 12) % 12))].sort((a, b) => a - b), penta};
}
const pc = m => ((Math.round(m) % 12) + 12) % 12;

// A cast part's audio. Strategy's and Synthia's are the voice bank's takes (or
// cuts of them, a drop's tag and impact); hers are her recordings, cut on her
// measured words. null when the bank has no take for it (the page did not pass
// castSong `available`): the part is left out.
export function partOf(part) {
  if (!part) return null;
  if (part.voice === 'lady') {
    const entry = LADY_TABLE[part.file];
    if (!entry) return null;
    const [a, b] = part.words, n = entry.words.length, ia = a < 0 ? n + a : a, ib = b < 0 ? n + b : b, [from, to] = slice(entry, ia, ib);
    const words = entry.words.slice(ia, ib + 1);
    return {voice:'lady', file:part.file, key:null, from, to, onset:words[0].onset ?? from, words, gainDb:entry.gainDb, entry, text:part.text ?? entry.text, display:part.display};
  }
  if (part.voice !== 'strategy' && part.voice !== 'synthia') return null;
  const take = TAKE_TABLE[`${part.voice}/${part.id}`];
  if (!take) return null;
  return {voice:part.voice, file:take.file, key:take.key, from:take.start, to:take.end, onset:take.onset ?? take.start, words:take.words, gainDb:take.gainDb,
    entry:VOICE_TABLE[take.file], amount:take.amount, text:part.text ?? take.text, display:part.display, cut:take.cut};
}

// Notes for a pixel take: one per syllable nucleus (melody.js lineFor), a seeded
// wandering line in the voice's register, in the track's pentatonic, each note
// moved to the nearest scale note the chord under it allows (track.chordAt(bar).avail).
// `at0` maps take seconds to song seconds, `barOf` song seconds to a bar.
export function pixelLine(src, tr, {seed, end = 'home', from = null, timeAt, barOf, last = null}) {
  const {tonic, scale} = keyOf(tr), register = VOICES[src.voice].register;
  let notes = lineFor(src.entry, {register, tonic, scale, seed, end, from});
  // A line that must land on a note (a drop's impact on the tonic) ends there.
  if (last !== null) {
    const target = [-24, -12, 0, 12, 24].map(o => last + o).filter(m => m >= register.lo - 2 && m <= register.hi + 2).sort((a, b) => Math.abs(a - notes.at(-1).midi) - Math.abs(b - notes.at(-1).midi))[0];
    if (target !== undefined) notes = notes.map((n, i) => i === notes.length - 1 ? {...n, midi:target} : n);
  }
  if (!timeAt || !barOf) return notes;
  const inScale = m => scale.includes((pc(m) - tonic + 12) % 12);
  return notes.map((n, i) => {
    if (last !== null && i === notes.length - 1) return n;
    const avail = tr.chordAt(barOf(timeAt(n.from)))?.avail;
    if (!avail || avail.includes(pc(n.midi))) return n;
    let best = n.midi;
    for (let d = 1; d <= 4; d++) { for (const m of [n.midi - d, n.midi + d]) if (inScale(m) && avail.includes(pc(m)) && m >= register.lo && m <= register.hi) { best = m; break; } if (best !== n.midi) break; }
    return {...n, midi:best};
  });
}

// Her cut tuned onto the nearest note of the pentatonic within two semitones of what it plays,
// or `step` scale steps from it (a refrain's repeats wander), never more than 4 semitones away.
export function ladyTune(src, tr, step = 0) {
  const m = pitchOf(src.file, src.from, src.to);
  if (m === null) return {rate:1, midi:null};
  const {penta} = keyOf(tr);
  let best = null;
  for (let d = -2; d <= 2; d++) { const t = Math.round(m) + d; if (penta.includes(pc(t)) && (best === null || Math.abs(t - m) < Math.abs(best - m))) best = t; }
  if (best === null) return {rate:1, midi:null};
  for (let k = 0, x = best; k < Math.abs(step); k++) { do x += Math.sign(step); while (!penta.includes(pc(x))); if (Math.abs(x - m) <= 4) best = x; }
  return {rate:2 ** ((best - m) / 12), midi:best};
}

// ---- Synergy's slots and the band's ----------------------------------------------

const sectionOf = (D, bar) => (D.sections.find(s => bar >= s.from && bar < s.to) || D.sections.at(-1)).name;

// With a band cast, Synergy keeps three of his hook slots, each sung once (no
// echo): the first before the build, the first of Drop A, the last of Drop B
// (after her "Read that again.", which is the joke). His other hook slots and
// the build's half-bar answers go to the band, and so does the last line, his
// "Let's circle back", unless the cast gives the sign-off back to him (Circle
// Back's title). Returns his setlist (each slot keeps `slot`, its index in the
// track's) and the slots he gave up.
export function bandSetlist(setlist, tr, cast, {give = []} = {}) {
  if (!hasBand(cast)) return {setlist, freed:[]};
  const D = tr.drop, build = D.sections.find(s => s.name === 'Build')?.from ?? Infinity;
  const hooks = setlist.map((s, i) => ({s, i})).filter(x => x.s.kind === 'hook');
  const keep = new Set([hooks.find(x => x.s.bar < build), hooks.find(x => sectionOf(D, x.s.bar) === 'Drop A'), hooks.filter(x => sectionOf(D, x.s.bar) === 'Drop B').at(-1)]
    .filter(x => x && !give.includes(sectionOf(D, x.s.bar))).map(x => x.i));
  const signoff = cast.signoff && cast.signoff.voice !== 'synergy';
  const out = [], freed = [];
  setlist.forEach((s, i) => {
    const hookLike = s.kind === 'hook' || s.kind === 'answer', close = s.kind === 'host' && s.text === HOST.close;
    if ((hookLike && !keep.has(i)) || (close && signoff)) {
      freed.push({...s, slot:i, section:sectionOf(D, s.bar), close});
      // A slot that gave way (give) still does: the line before it may run on into it.
      const prev = out.at(-1);
      if (s.give && prev && prev.slot === i - 1) out[out.length - 1] = {...prev, spillInto:s.give};
    } else out.push({...s, slot:i, ...(hookLike ? {once:true} : {})});
  });
  return {setlist:out, freed};
}

// The couplet's drop: Strategy's X over the build's answer bars, Synthia's (or
// his) lead-in tag before the choke, the silence, and the Y word as the impact.
// Both cut from one sung take, so the line runs on across the silence. null
// when the cast's drop is hers, or the bank lacks a take (her tag plays then).
export function coupletDrop(cast, tr) {
  const d = cast?.dropTag;
  if (!d || d.kind !== 'couplet' || (d.tracks && !d.tracks.includes(tr.id))) return null;
  const tag = partOf(d.tag), impact = partOf(d.impact), x = partOf(d.x);
  if (!tag || !impact) return null;
  return {id:d.id, x, tag, impact, parts:d};
}

// ---- placing the band ------------------------------------------------------------

// The fractional step (the lady's clock) where a part starts sounding at song time t, and the
// time it then really starts: inside a swung 16th's late gap the start moves to that 16th.
function stepAtTime(T, step, t) {
  let i = T.length - 2;
  while (i > 0 && T[i] > t) i--;
  const frac = (t - T[i]) / step;
  if (frac < 1 - 1e-9) return {at:i + Math.max(0, frac), t:T[i] + Math.max(0, frac) * step};
  return {at:i + 1, t:T[i + 1]};
}

// One part's event: where it starts (its first vowel on `anchor`), its notes, its words in song seconds.
export function eventOf(src, {role, part, anchor, rate = 1, gain = 0, pan = 0, tr, T, step, seed, end, from, last, wander = 0, extra = {}}) {
  const onsetT = T[anchor], lead = (src.onset - src.from) / rate;
  const {at, t} = stepAtTime(T, step, onsetT - lead), timeAt = x => t + (x - src.from) / rate, barOf = s => { let b = 0; while (b + 1 < T.length / BAR_STEPS && T[(b + 1) * BAR_STEPS] <= s) b++; return b; };
  const length = (src.to - src.from) / rate;
  const e = {role, part, voice:src.voice, text:src.text, display:src.display, file:src.file, from:src.from, to:src.to, at, rate, gate:length + .02, gain:src.gainDb + BAND_GAIN + (VOICE_GAIN[src.voice] ?? 0) + gain, pan};
  if (src.key) {
    e.key = src.key; e.amount = src.amount;
    e.notes = pixelLine(src, tr, {seed, end, from, last, timeAt, barOf});
    e.midi = e.notes.at(-1).midi;
  } else {
    const tune = ladyTune(src, tr, wander);
    Object.assign(e, {rate:rate * tune.rate, gate:(src.to - src.from) / (rate * tune.rate) + .02});
    if (tune.midi !== null) e.midi = tune.midi;
  }
  const r = e.rate;
  e.words = src.words.map((w, i) => ({text:w.text, display:(e.display ?? '').split(' ')[i] ?? w.text.toUpperCase(), start:t + (Math.max(w.start, e.from) - e.from) / r, end:t + (Math.min(w.end, e.to) - e.from) / r, onset:t + ((w.onset ?? w.start) - e.from) / r}));
  e.start = t; e.end = t + ladyLength(e);
  return Object.assign(e, extra);
}

// The band's parts in the gaps Synergy left them. Greedy, in this order, each
// part at the first 8th of its preferred sections where it fits whole without
// touching another voice (GUARD either side), sped up to MAX_RATE at most:
//   1. the couplet drop's X, over the build's answer bars (over her ladder, which steps back 4 dB under it)
//   2. the sign-off, where Synergy's "Let's circle back" was
//   3. the couplet, X then Y a beat apart (the anthem: Drop B, the outro, Drop A)
//   4. the refrain (Drop A, Drop B, the outro, the verse)
//   5. the first exchange, call then response (the verse hook's free bar, then the drops)
//   6. the stabs (the build's half-bar answers, then any gap)
//   7. a second exchange, anywhere it fits
// A part that fits nowhere is left out (plan.bandLeft says which and why).
export function placeBand({tr, cast, lyrics, words, stutters, lady, lines, timing:T, step, freed, couplet, chokeT, impactT}) {
  const D = tr.drop, seed0 = hash(`${lyrics.hook}|${tr.id}`), events = [], left = [];
  const busy = [];
  const take = (a, b, who) => busy.push([a, b, who]);
  for (const w of words) take(T[w.at], T[w.at] + w.gate, 'synergy');
  for (const s of stutters) take(T[s.at], T[s.at] + step * .8, 'synergy');
  for (const e of lady) { const s = ladyClock(T, step, e.at); take(s, s + ladyLength(e), e.role === 'ladder' ? 'ladder' : 'lady'); }
  take(chokeT - .25, impactT + .2, 'choke');
  const stopAt = T[D.stop.bar * BAR_STEPS + D.stop.step] - (D.stop.lead ?? 0), songEnd = T[D.bars * BAR_STEPS];
  take(stopAt, songEnd + 1, 'stop');
  const clear = (a, b, ignore = []) => busy.every(([x, y, who]) => ignore.includes(who) || b + GUARD <= x || a >= y + GUARD);
  const secAt = t => { let b = 0; while (b + 1 < D.bars && T[(b + 1) * BAR_STEPS] <= t) b++; return sectionOf(D, b); };

  // The regions the band may use: every slot Synergy gave up (to the next slot's start), and
  // the bar after each hook he now sings once.
  const regions = freed.map(f => {
    const from = f.bar * BAR_STEPS + (f.startStep ?? 0);
    return {from, to:from + (f.close ? D.bars * BAR_STEPS - from : (f.window ?? 30)), section:f.section, kind:f.close ? 'close' : f.kind};
  });
  for (const line of lines) {
    if (line.kind !== 'hook' || !line.words.length) continue;
    const endStep = Math.max(...line.words.map(w => w.at + w.steps)), from = endStep + (endStep % 2);
    const to = line.bar * BAR_STEPS + 32;
    if (to - from >= 6) regions.push({from, to, section:sectionOf(D, Math.floor(from / BAR_STEPS)), kind:'after-hook'});
  }
  regions.sort((a, b) => a.from - b.from);

  // Try a part (or a pair: call and response) at each 8th of each region, in order of preference.
  // `wait` (16ths): an answer may come that much later than right after its call, in the next gap
  // (Y a beat or a bar after X, where the pair does not fit back to back). `bind`: the parts that
  // never wait, sung on the next 16th after the one before them (Synthia's "It's a" and her lady's
  // word are one answer: the pair waits together, never "It's a" ... a bar ... "Pivot").
  const fit = (srcs, {pref, kinds, role, gains, pans, seeds, ends, part, gap = .1, ignore = [], after = 0, wander = 0, extra = {}, wait = 0, bind = []}) => {
    const rs = regions.filter(r => (!kinds || kinds.includes(r.kind)) && pref.includes(r.section) && T[r.from] >= after).sort((a, b) => (pref.indexOf(a.section) + 99 * (pref.indexOf(a.section) < 0)) - (pref.indexOf(b.section) + 99 * (pref.indexOf(b.section) < 0)) || a.from - b.from);
    for (const r of rs) for (const rate of [1, 1.06, MAX_RATE]) for (let s = r.from + (r.from % 2); s < r.to; s += 2) {
      const out = [], endStepT = T[Math.min(T.length - 1, r.to)];
      // Part k from `anchor` on (or up to `wait` 16ths later), then the rest after it; a part that leaves
      // the next nowhere to go tries its next 16th.
      const place = (k, anchor, prevLast) => {
        const span = k && !bind.includes(k) ? wait : 0;
        for (let a = anchor; a <= anchor + span && a < T.length - 1; a++) {
          const c = eventOf(srcs[k], {role:role[k], part, anchor:a, rate, gain:gains[k], pan:pans[k], tr, T, step, seed:seeds[k], end:ends[k], from:prevLast, wander, extra});
          if (a >= r.to + (k ? 32 : 0) || (!k || !wait ? c.end > endStepT + .25 : false) || !clear(c.start, c.end, ignore) || out.some(o => !(c.start >= o.end + gap || c.end <= o.start))) continue;
          out.push(c);
          if (k + 1 === srcs.length) return true;
          // The answer comes in on the next 16th after the call has finished, a breath later.
          let n = Math.floor(c.at) + 1;
          while (n < T.length - 1 && T[n] < c.end + gap + (srcs[k + 1].onset - srcs[k + 1].from) / rate) n++;
          if (place(k + 1, n, c.midi ?? null)) return true;
          out.pop();
        }
        return false;
      };
      if (place(0, s, null)) { for (const e of out) { events.push(e); take(e.start, e.end, 'band'); } return out; }
    }
    return null;
  };
  const say = (what, why) => left.push({part:what, why});

  // 1. The couplet drop's X, over the build's answer bars: the confession, under her climbing ladder.
  if (couplet?.x) {
    const x = couplet.x, A = D.answers;
    A.bars.forEach((bar, k) => {
      const anchor = bar * BAR_STEPS + A.steps[0], e = eventOf(x, {role:'x', part:'dropTag', anchor, gain:k ? 2.5 : 1.5, pan:0, tr, T, step, seed:seed0 + 11 * (k + 1), end:'open', extra:{couplet:couplet.id}});
      if (e.end < chokeT - GUARD && clear(e.start, e.end, ['ladder'])) { events.push(e); take(e.start, e.end, 'band'); }
      else say(`dropTag.x (bar ${bar})`, 'no room before the next answer bar or the choke');
    });
    // Her ladder steps back under his confession.
    for (const h of lady.filter(e => e.role === 'ladder')) { const s = ladyClock(T, step, h.at); if (events.some(x => x.role === 'x' && s < x.end && s + ladyLength(h) > x.start)) h.gain -= 4; }
  }
  // 2. The sign-off.
  const so = cast.signoff && cast.signoff.voice !== 'synergy' ? partOf(cast.signoff) : null;
  if (cast.signoff && cast.signoff.voice !== 'synergy') {
    if (!so) say('signoff', 'no take in the bank');
    else {
      const done = fit([so], {pref:['Outro'], kinds:['close'], role:['signoff'], gains:[0], pans:[0], seeds:[seed0 + 2], ends:['home'], part:'signoff'});
      // The last line before the tape stop: nothing of the band's after it.
      if (done) take(done[0].start, songEnd + 1, 'signoff');
      else say('signoff', 'no gap before her stop line');
    }
  }
  // 3. The couplet: X then Y (or her own word after Synthia's pickup).
  const cp = cast.couplet;
  if (cp) {
    const x = partOf(cp.x), y = partOf(cp.y), pick = cp.y?.pickup ? partOf(cp.y.pickup) : null;
    const srcs = [x, ...(pick ? [pick] : []), y];
    // (Her recorded couplets, 09 and 33, are her two halves of one recording: X and Y all the same.)
    if (srcs.some(s => !s)) say('couplet', 'no take in the bank');
    // When the drop is this couplet, its anthem is the payoff in Drop B or the outro (the drop's joke first,
    // and not again right after it), or not at all.
    else if (!fit(srcs, {pref:couplet?.id === cp.id ? ['Drop B', 'Outro'] : ['Drop B', 'Outro', 'Drop A', 'Verse'], after:couplet?.id === cp.id ? impactT : 0, role:pick ? ['couplet-x', 'pickup', 'couplet-y'] : ['couplet-x', 'couplet-y'], gains:pick ? [1.5, 2, 3.5] : [1.5, 3.5], pans:pick ? [-.12, .15, 0] : [-.12, .15],
      seeds:[seed0 + 3, seed0 + 4, seed0 + 5], ends:pick ? ['open', 'free', 'home'] : ['open', 'home'], part:'couplet', gap:.12})
      // Not back to back: Y in the next gap, up to a bar and a half after X.
      && !fit(srcs, {pref:couplet?.id === cp.id ? ['Drop B', 'Outro'] : ['Drop B', 'Outro', 'Drop A', 'Verse'], after:couplet?.id === cp.id ? impactT : 0,
        role:pick ? ['couplet-x', 'pickup', 'couplet-y'] : ['couplet-x', 'couplet-y'], gains:pick ? [1.5, 2, 3.5] : [1.5, 3.5], pans:pick ? [-.12, .15, 0] : [-.12, .15],
        seeds:[seed0 + 3, seed0 + 4, seed0 + 5], ends:pick ? ['open', 'free', 'home'] : ['open', 'home'], part:'couplet', gap:.12, wait:24, bind:pick ? [2] : []})) say('couplet', 'no gap long enough for X and Y');
    for (const e of events) if (e.part === 'couplet') e.couplet = cp.id;
  }
  // 4. The refrain.
  if (cast.refrain) {
    const r = partOf(cast.refrain);
    if (!r) say('refrain', 'no take in the bank');
    else {
      const first = fit([r], {pref:['Drop A', 'Drop B', 'Outro', 'Verse'], role:['refrain'], gains:[1], pans:[0], seeds:[seed0 + 6], ends:['home'], part:'refrain', extra:{repeat:0}});
      if (!first) say('refrain', 'no gap long enough');
      // It loops and wanders: up to REFRAIN_REPEATS more times after the first, in the drops,
      // each on a new path through the pentatonic (hers a scale step up or down).
      else for (let k = 1; k <= REFRAIN_REPEATS; k++) if (!fit([r], {pref:['Drop A', 'Drop B', 'Outro'], role:['refrain'], gains:[1], pans:[k % 2 ? .15 : -.15], seeds:[seed0 + 6 + 101 * k], ends:['home'], part:'refrain', after:first[0].end, wander:k % 2 ? 1 : -1, extra:{repeat:k}})) break;
    }
  }
  // 5-7. The exchanges and the stabs.
  const ex = cast.exchanges || [];
  const exchange = (x, k, pref) => {
    const c = partOf(x.call), r = partOf(x.response);
    if (!c || !r) { say(`exchanges.${k}`, 'no take in the bank'); return; }
    const ask = /\?$/.test(x.call.text ?? '');
    if (!fit([c, r], {pref, role:['call', 'response'], gains:[0, 1], pans:[.1, -.1], seeds:[seed0 + 7 + k, seed0 + 9 + k], ends:[ask ? 'up' : 'open', 'home'], part:`exchanges.${k}`, gap:.08})) say(`exchanges.${k}`, 'no gap long enough for call and answer');
  };
  if (ex[0]) exchange(ex[0], 0, ['Verse', 'Drop A', 'Drop B', 'Outro']);
  (cast.stabs || []).forEach((s, k) => {
    const src = partOf(s);
    if (!src) { say(`stabs.${k}`, 'no take in the bank'); return; }
    if (!fit([src], {pref:['Build', 'Verse', 'Drop A', 'Drop B', 'Outro'], role:['stab'], gains:[2], pans:[k ? -.2 : .2], seeds:[seed0 + 13 + k], ends:['home'], part:`stabs.${k}`})) say(`stabs.${k}`, 'no gap');
  });
  if (ex[1]) exchange(ex[1], 1, ['Drop B', 'Drop A', 'Outro', 'Verse', 'Build']);
  // In the drops a part cuts through as her lines do: up 2 dB, the drums and bass dipping under it.
  for (const e of events) if (e.start >= impactT - 1e-9) { e.gain += DROP_LIFT; e.dip = .7; }
  events.sort((a, b) => a.at - b.at);
  return {events, left, regions};
}
