// SYNERGY.EXE score. The band is the All Hands band (src/allhands/instruments.js),
// synthesized live, so the game ships no sample pack. The voices are the film
// takes from the Cutting Room, fetched once the player starts.
// Chords and tempo follow All Hands: Am9, Fmaj9, Cmaj9, G6/9 at 120 BPM.

import * as I from '../allhands/instruments.js';
import { createMobileAudio } from '../audio-session.js';

// Film voice takes, public/cutting-room/sounds/film-voices/.
const VOICES = {
  welcome:'welcome-welcome-7b219851',          // "Welcome. You already know how to work."
  describe:'welcome-describe-a8db6970',        // "We'll teach you how to describe it."
  linda:'welcome-linda-cbdc27fa',              // "We did this last year."
  humbled:'welcome-humbled-53568647',          // "Humbled."
  honored:'welcome-honored-7399bc82',          // "Honored."
  share:'welcome-share-m-1905fd3f',            // "Excited to share."
  shareF:'welcome-share-f-3ce59574',
  humbledShare:'welcome-v2-humbled-phrase-0306678f', // "Humbled and honored to share."
  circle:'welcome-v2-circle-phrase-b18779d7',  // "Let's circle back."
  optimized:'welcome-v2-optimized-f182e082',   // "Optimized."
  tagline:'welcome-v2-tagline-e781d585',       // "Sound like you mean business."
  followup:'synthia-follow-up-6d0a5c00',       // "Then we will schedule a follow-up."
  loading:'printer-loading-82ee956c',          // "Loading."
};

// Each instrument's level at v = 1 against the v1 sample pack, measured, so v1's mix carries over.
const K = { kick:.82, clap:2.12, hat:.66, ohat:.49, rim:.62, shaker:1.21, gang:4.78, crash:.42, impact:.85, down:.98,
  chime:3.28, mug:.65, key:1.22, creak:4.35, printer:1.4, tom:1.1 };

const CH = [{ b:45, n:[57, 60, 64, 67, 71] }, { b:41, n:[53, 57, 60, 64, 67] }, { b:36, n:[52, 55, 59, 60, 62] }, { b:43, n:[55, 59, 62, 64, 69] }];
const PENT = [0, 3, 5, 7, 10, 12, 10, 7, 12, 15];
const spb = 60 / 120 / 4;

let ac, mobile, master, music, tone, fx, vox, on = true, level = 0, stepN = 0, next = 0, timer = 0, held = false, wanted = false;
const buf = {};

function init() {
  if (ac) return;
  const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
  ac = new A({ latencyHint:'interactive' });
  mobile = createMobileAudio(ac);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.connect(ac.destination);
  master = ac.createGain(); master.gain.value = on ? .9 : 0; master.connect(comp);
  tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 18000; tone.Q.value = .5; tone.connect(master);
  music = ac.createGain(); music.gain.value = .75; music.connect(tone);
  fx = ac.createGain(); fx.gain.value = 1; fx.connect(master);
  vox = ac.createGain(); vox.gain.value = 1; vox.connect(master);
  next = ac.currentTime + .1;
  timer = setInterval(pump, 25);
  loadVoices();
}

const voiceUrl = k => new URL(`../cutting-room/sounds/film-voices/${VOICES[k]}.mp3`, location.href).href;
function loadVoices() {
  for (const k in VOICES) {
    fetch(voiceUrl(k)).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(a => new Promise((ok, no) => ac.decodeAudioData(a, ok, no)))
      .then(b => { buf[k] = b; }, () => {});   // a missing take is silence, never an error
  }
}

function hit(name, t, g = 1, dest = fx, o = {}) {
  const v = g * K[name];
  if (name === 'kick') I.kick(ac, dest, t, v);
  else if (name === 'clap') I.clap(ac, dest, t, v);
  else if (name === 'hat') I.hat(ac, dest, t, v);
  else if (name === 'ohat') I.openHat(ac, dest, t, v);
  else if (name === 'rim') I.rim(ac, dest, t, v);
  else if (name === 'shaker') I.shaker(ac, dest, t, v);
  else if (name === 'gang') I.gangClap(ac, dest, t, v);
  else if (name === 'crash') I.crash(ac, dest, t, v);
  else if (name === 'impact') I.impact(ac, dest, t, v);
  else if (name === 'down') I.downlifter(ac, dest, t, 1.2, v);
  else if (name === 'chime') I.chime(ac, dest, t, o.midi || 84, v);
  else if (name === 'mug') I.mug(ac, dest, t, o.midi || 72, v);
  else if (name === 'key') I.keyClick(ac, dest, t, v, (Math.random() * 5) | 0);
  else if (name === 'creak') I.creak(ac, dest, t, o.len || .5, v);
  else if (name === 'printer') I.printerFeed(ac, dest, t, v);
  else if (name === 'tom') I.floorTom(ac, dest, t, o.midi || 41, v);
}

function pump() {
  if (!ac || ac.state !== 'running') return;
  if (next < ac.currentTime - .5) next = ac.currentTime + .05;
  while (next < ac.currentTime + .14) { sched(stepN, next); stepN = (stepN + 1) % 64; next += spb; }
}

// level: 0 lobby, 1-3 the climb, 4 viral, 5 the VP, 6 a meeting, 7 the roof
function sched(s, t) {
  const b = s % 16, bar = s >> 4, ch = CH[bar % 4];
  if (level === 6) {                       // a meeting: a pad, a clock, nothing to dance to
    if (b === 0) I.warmPad(ac, music, t, ch.n.slice(0, 4), spb * 15, 1.6);
    if (b % 4 === 0) I.tick(ac, music, t, .16, { accent:b === 0 });
    if (b === 10) hit('rim', t, .1, music);
    return;
  }
  if (level === 7) {                       // the roof: held breath
    if (b === 0) { I.pad(ac, music, t, ch.n, spb * 15, .7); I.bass(ac, music, t, ch.b - 12, spb * 12, .18); }
    if (b % 8 === 4) hit('shaker', t, .06, music);
    return;
  }
  if (level === 5) {                       // the VP: four on the floor and a reese
    if (b % 4 === 0) hit('kick', t, .85, music);
    if (b === 4 || b === 12) I.snare(ac, music, t, .26);
    if (b % 2) hit('hat', t, .2, music);
    if (b % 4 === 2) hit('ohat', t, .16, music);
    if (b === 0 || b === 3 || b === 6 || b === 10) I.reese(ac, music, t, ch.b - 12, spb * (b === 0 ? 2.6 : 1.5), .1);
    if (b === 2 || b === 8 || b === 11) I.stab(ac, music, t, ch.n.slice(0, 4), spb * 2, .5, 2400);
    if (bar === 3 && b >= 12) hit('tom', t, .4, music, { midi:45 - (b - 12) * 2 });
    if (s === 0) hit('crash', t, .25, music);
    return;
  }
  if (level <= 2 && b === 0) I.rhodes(ac, music, t, ch.n.slice(0, 4), spb * 13, level ? .7 : .85);
  if (level === 0) { if (b === 4 || b === 12) hit('rim', t, .22, music); if (b === 10) hit('shaker', t, .12, music); return; }
  if (b % 8 === 0 || (level >= 2 && b % 4 === 0)) hit('kick', t, .8, music);
  if (b % 4 === 2) { hit(level >= 3 ? 'ohat' : 'hat', t, level >= 3 ? .22 : .3, music); I.bass(ac, music, t, ch.b, spb * 1.6, .34); }
  if (level >= 2) { if (b === 4 || b === 12) hit('clap', t, .42, music); if (b % 2) hit('shaker', t, .1, music);
    if (b === 3 || b === 6 || b === 11 || b === 14) I.chop(ac, music, t, ch.n.slice(1, 4), .6); }
  if (level >= 3 && (b === 0 || b === 6)) I.stab(ac, music, t, ch.n.slice(0, 4), spb * 3, .55);
  if (level >= 4) { if (b === 0) I.pad(ac, music, t, ch.n, spb * 14, .8); if (s === 0) hit('crash', t, .3, music);
    if (b === 4 || b === 12) hit('gang', t, .35, music);
    if (b % 2 === 0) I.rhodes(ac, music, t, [69 + PENT[(b / 2 + bar) % 10]], spb * 1.6, .7, { level:.045 }); }
}

function wake() {
  if (!ac || held || ac.state === 'running') return;
  mobile.resume().catch(() => {});
}

export const Score = {
  // Call inside a tap or key press. Safe to call every time.
  start() { init(); if (!ac) return; wanted = true; held = false; mobile.resume().catch(() => {}); },
  get running() { return !!ac && ac.state === 'running'; },
  get on() { return on; },
  setLevel(n) { level = n; },
  get level() { return level; },
  duck(d) { if (ac) music.gain.setTargetAtTime(d ? .22 : .75, ac.currentTime, .15); },
  // The host is looking: the band goes to the other side of a wall.
  watch(w) { if (!ac) return; tone.frequency.setTargetAtTime(w ? 420 : 18000, ac.currentTime, w ? .05 : .2); },
  pause() { held = true; if (ac && ac.state === 'running') { ac.suspend(); mobile.pause(); } },
  resume() { held = false; if (ac && wanted) mobile.resume().catch(() => {}); },
  // Browsers suspend audio on their own (a phone call, a tab switch). Any tap brings it back.
  nudge: wake,
  toggle() { on = !on; if (ac) master.gain.setTargetAtTime(on ? .9 : 0, ac.currentTime, .03); return on; },
  setOn(v) { if (v !== on) this.toggle(); },
  loaded() { return Object.keys(buf).length; },
  voices: Object.keys(VOICES).length,
  urls: () => Object.keys(VOICES).map(voiceUrl),
  voice(name, delay = 0, v = 1) {
    if (!ac || ac.state !== 'running' || !buf[name]) return 0;
    const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf[name]; g.gain.value = v;
    s.connect(g); g.connect(vox); s.onended = () => { s.disconnect(); g.disconnect(); }; s.start(ac.currentTime + delay);
    return buf[name].duration;
  },
  accent(kind, i = 0, word) {
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime + .005, m = n => ({ midi:n });
    switch (kind) {
      case 'word': hit('mug', t, .7, fx, m(72 + PENT[i % 10])); hit('mug', t + .09, .5, fx, m(79 + PENT[i % 10])); if (word === 'HUMBLED') this.voice('humbled', .12); break;
      case 'type': hit('key', t, .5); break;
      case 'ui': hit('key', t, .7); break;
      case 'react': if (Math.random() < .5) hit('mug', t, .28, fx, m(77 + PENT[(Math.random() * 10) | 0])); else hit('gang', t, .22); break;
      case 'bump': hit('tom', t, .7); hit('creak', t + .05, .6); break;
      case 'jump': I.tick(ac, fx, t, .22, { accent:true }); break;
      case 'bounce': hit('tom', t, .55, fx, m(53)); hit('mug', t + .03, .4, fx, m(84)); break;
      case 'bonk': hit('rim', t, .2); break;
      case 'flat': hit('creak', t + .1, .9, fx, { len:.8 }); break;
      case 'promote': hit('impact', t, .5); hit('gang', t + .12, .5); hit('gang', t + .37, .5); break;
      case 'big': hit('impact', t, .8); hit('crash', t, .5); break;
      case 'lights': hit('chime', t, .35); break;
      case 'off': hit('down', t, .5); break;
      case 'publish': hit('printer', t, .7); break;
      case 'printer': hit('printer', t, .9); break;
      case 'warn': hit('chime', t, .3, fx, m(88)); hit('chime', t + .16, .3, fx, m(88)); break;
      case 'caught': I.subDrop(ac, fx, t, .5); hit('creak', t + .1, .7, fx, { len:.9 }); break;
      case 'steal': hit('creak', t, .8, fx, { len:.35 }); hit('tom', t + .04, .5, fx, m(38)); break;
      case 'reclaim': [0, 4, 7, 12].forEach((n, j) => hit('mug', t + j * .07, .55, fx, m(76 + n))); break;
      case 'bop': hit('tom', t, .6, fx, m(48)); break;
      case 'secret': [0, 4, 7, 11].forEach((n, j) => hit('chime', t + j * .09, .28, fx, m(84 + n))); break;
      case 'mug': [0, 7, 12].forEach((n, j) => hit('mug', t + j * .08, .6, fx, m(79 + n))); break;
      case 'mail': I.snap(ac, fx, t, .5); break;
      case 'note': hit('rim', t, .25); break;
      case 'charge': I.riser(ac, fx, t, .85, .3); break;
      case 'daze': hit('crash', t, .35); hit('impact', t, .6); break;
      case 'bosshit': hit('impact', t, .7); hit('gang', t + .05, .6); hit('gang', t + .3, .5); break;
      case 'ding': hit('chime', t, .4, fx, m(91)); hit('chime', t + .22, .4, fx, m(86)); break;
      case 'count': I.tick(ac, fx, t, .5, { accent:true }); hit('rim', t, .3); break;
      case 'launch': I.sawRiser(ac, fx, t, 2.6, 45, 81, .09); I.subDrop(ac, fx, t + 2.5, .6); hit('crash', t + 2.5, .6); hit('impact', t + 2.5, .8); break;
      case 'fix': I.tick(ac, fx, t, .5); hit('rim', t + .02, .3); if (i % 2) hit('creak', t, .4, fx, { len:.2 }); break;
      case 'fixed': [0, 4, 7, 12, 16].forEach((n, j) => hit('chime', t + j * .1, .3, fx, m(79 + n))); hit('gang', t + .6, .5); break;
      case 'pour': I.riser(ac, fx, t, 1.1, .08); break;
      case 'linda': this.voice('linda', .5); break;
      case 'circle': this.voice('circle', .4); break;
    }
  },
};

// Any tap or key wakes audio the browser put to sleep.
addEventListener('pointerdown', wake, { passive:true });
addEventListener('keydown', wake);
