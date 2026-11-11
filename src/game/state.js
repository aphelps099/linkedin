// SYNERGY.EXE shared state. One object the shell, the world and the scenes all read.

export const $ = id => document.getElementById(id);
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarse = matchMedia('(hover:none), (pointer:coarse)').matches;

export const G = {
  W:160, H:240, S:2, u:2.4,           // view in game units, device pixels per unit, CSS pixels per unit
  t:0,                                // seconds on the clock, for animation
  mode:'title', paused:false,
  floor:0, run:null,
  parts:[], toast:null, fade:0, shake:0, layout:0,
  keys:{ left:false, right:false, jump:false },
  go:null,                            // set by main.js: go(mode, detail)
};

// One career: what the player is carrying up the building.
export const newRun = () => ({
  collected:[], lost:null,            // phrases caught; the one Kevin kept, if any
  mugs:[], reactions:0, facts:1, title:'Associate',
  time:0, bumps:0, posted:{}, honest:false, post:null, ending:null,
});

export const pad2 = n => String(n).padStart(2, '0');
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const clock = s => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;
export const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not on this device */ } };
