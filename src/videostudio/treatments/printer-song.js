// "Printer Song": Aaron's own track, as a plan the video studio can cut to. It is a recording, not the
// engine's song, so this module says what the engine's plans say for themselves: the clock, the gestures,
// and the words the printer sings on the Peg Board (the track has no lyrics; the printer sings in type).
//
//   const plan = printerPlan();                        // film time: 804 frames, 33.5 s
//   const edl = printerMouth(plan, SHOTS, {format:'9:16'});   // treatments/printer-mouth.js
//
// Two clocks. Film time is the file: a 3 s intro (frames 0-71: the loading screen, Synergy's "Loading.",
// Aaron's opening played backwards and slowed, swelling into the first frame of the song), then the song.
// Song time is the 30.5 s edit Aaron saw (frames 0-731 of the draft): film frame = song frame + INTRO.
// Everything measured on the song (the glides, the marks, B's onsets) is in song seconds, and the cut
// (printer-mouth.js) is written in song frames; LINES, the plan and the program are in film frames.
//
// The sound is assets/printer-song/printer-song-film.flac (scripts/edit-printer-song.py: the intro, then
// source 0-14.25 s and 24.0-39.52 s through a 30 ms crossfade, Aaron's hard stop at film 32.750, silence to
// 33.5 s). Song time = source time before 14.25 s, source - 9.75 s after.
//
// What was measured on the edit (scipy STFTs and band envelopes; docs/printer-song-video.md, The sound):
//   - The clock: a 16th of 0.125 s (120 BPM) is the sharpest periodicity in every band and both
//     sections; its phase is weak and no downbeat can be heard, so nothing here stands on a bar line.
//     A step is exactly 3 frames: step = frame / 3. The intro is 24 steps, so the grid runs on through it.
//   - The glides: zigzag pitch sweeps of the bright stack (the print head's squiggles), their vertices
//     (pitch turning points) in song seconds with the pitch in Hz. These are what the printer's mouth
//     sings: the paper slot opens with the pitch.
//   - A to B: the top end drains from 16.87 (above 4 kHz -30 to -38 dB), a breath 17.55-17.83, then B's
//     350-500 Hz swell (up 15 dB) starts at 17.826 and is clear by 17.839, in song frame 428; the hard stop
//     at 29.750 (-31 dBFS at 29.750, -49 at 29.752), in song frame 714.
// Pure data: the same plan every time, in Node and in the browser.
import {LINE_BREAK} from '../../pegboard/font.js';

export const FPS = 24, STEP = .125, INTRO = 72, SONG_FRAMES = 732, FRAMES = INTRO + SONG_FRAMES;
// A song frame (the draft's frame numbers, the cut's) as a film frame.
export const film = f => f + INTRO;
export const PRINTER_SONG = Object.freeze({
  track:'printer-song', title:'Printer Song', treatment:'printer-mouth',
  // The sound the film is cut to, from the repo root; outside public/, so the site never serves it.
  audio:'assets/printer-song/printer-song-film.flac',
  sampleRate:44100, seconds:FRAMES / FPS, intro:INTRO / FPS,
});

// A frame as steps, and the middle of a frame (pegs light on the frame that holds their time).
export const stepOf = f => f / 3;
export const midStep = f => (f + .5) / 3;

// Song seconds. voice: Synergy's "Loading." starts (film 0.500: the intro is song -3.0 to 0); splice: where
// source 14.25 meets 24.0; drain: the top end starts to fall; breath: the gap before B; b: B lands; stop:
// Aaron's hard stop (-31 dBFS at 29.750, -49 at 29.752).
export const MARKS = Object.freeze({voice:-2.5, splice:14.25, drain:16.87, breath:Object.freeze([17.55, 17.83]), b:17.85, stop:29.75, end:SONG_FRAMES / FPS});

// The glides, song seconds: [time, 'hi' | 'lo', Hz] per vertex (scipy STFT of the edit, 450-2200 Hz,
// the stack's pitch centroid; checked by eye on a spectrogram with the vertices drawn over it). g1-g7
// are section A's; the big ones are g4 and g7. B has fewer clear gestures: b1 is a low glide, and the
// strokes after it sit on B's measured onsets (BEATS_B) instead.
export const GLIDES = Object.freeze([
  {id:'g1', big:false, vertices:[[.386, 'hi', 1855], [.525, 'lo', 1032], [.685, 'hi', 1533], [.72, 'lo', 1148], [.84, 'hi', 1343], [.924, 'lo', 1111]]},
  {id:'g2', big:false, vertices:[[1.014, 'lo', 1138], [1.064, 'hi', 1380], [1.334, 'lo', 1059], [1.413, 'hi', 1444], [1.643, 'lo', 635], [1.782, 'hi', 1419], [1.932, 'lo', 680]]},
  {id:'g3', big:false, vertices:[[3.893, 'hi', 1344], [4.137, 'lo', 611], [4.337, 'hi', 1264]]},
  {id:'g4', big:true, vertices:[[6.272, 'lo', 972], [6.367, 'hi', 1628], [6.587, 'lo', 728], [6.716, 'hi', 1454]]},
  {id:'g5', big:false, vertices:[[8.238, 'hi', 1232], [8.527, 'lo', 1125]]},
  {id:'g6', big:false, vertices:[[10.862, 'lo', 979], [10.942, 'hi', 1281], [11.056, 'lo', 718], [11.316, 'hi', 1221], [11.401, 'lo', 767]]},
  {id:'g7', big:true, vertices:[[13.491, 'hi', 1472], [13.541, 'lo', 1164], [13.805, 'hi', 1526], [14.085, 'lo', 738], [14.184, 'hi', 1398]]},
  {id:'b1', big:false, vertices:[[19.906, 'lo', 1021], [19.956, 'hi', 1164], [20.001, 'lo', 1017]]},
].map(g => Object.freeze({...g, vertices:Object.freeze(g.vertices.map(v => Object.freeze(v)))})));
// The strongest onsets of B (spectral flux peaks, song seconds): the night's strokes.
export const BEATS_B = Object.freeze([17.981, 18.265, 21.737, 22.024, 23.284, 24.242, 24.483, 24.646, 26.042, 26.277, 29.44]);

// The printer's words, in song frames. Each word lights on its frame (the frame that holds the gesture it
// sits on); br: a hard line break before the word. One screen per phrase, in order.
//   LOADING.                       song -60 (film 12): Synergy says it, on the loading screen, to the fold (film 65)
//   READY.                         f47   it wakes on an onset
//   THRILLED TO PRINT.             f150 / 158 / 161: g4's lo, lo, hi
//   PAGE 2 OF 1.                   f262 / 265 / 271 / 273: g6's vertices (the eyes become a second mouth)
//   FULL BLEED.                    f323 / 331: g7's two peaks (the whole printer, then edge to edge)
//   TONER LOW.                     f404 / 410: the top end drains
//   OUT OF / OFFICE.               f428 / 431 / 434 as B lands; struck at f477 (b1)
//   STILL / PRINTING.              f494 / 497, in its place
//   PAPER JAM.                     f714: the hard stop
const SONG_LINES = [
  {name:'loading', words:[['LOADING.', -60]], to:-7},
  {name:'ready', words:[['READY.', 47]], to:71},
  {name:'thrilled', words:[['THRILLED', 150], ['TO', 158], ['PRINT.', 161]], to:196},
  {name:'page', words:[['PAGE', 262], ['2', 265], ['OF', 271], ['1.', 273]], to:302},
  {name:'bleed', words:[['FULL', 323], ['BLEED.', 331]], to:348},
  {name:'toner', words:[['TONER', 404], ['LOW.', 410]], to:428},
  {name:'office', words:[['OUT', 428], ['OF', 431], ['OFFICE.', 434, true]], to:494, strike:{frame:477, words:[0, 1, 2]}},
  {name:'still', words:[['STILL', 494], ['PRINTING.', 497, true]], to:548},
  {name:'jam', words:[['PAPER', 714], ['JAM.', 714]], to:SONG_FRAMES},
];
// The same lines in film frames (what the plan, the program and the checks read).
export const LINES = Object.freeze(SONG_LINES.map(l => Object.freeze({...l, words:l.words.map(([w, f, br]) => br ? [w, film(f), br] : [w, film(f)]), to:film(l.to),
  ...(l.strike ? {strike:{...l.strike, frame:film(l.strike.frame)}} : {})})));
export const LINE_INDEX = Object.freeze(Object.fromEntries(LINES.map((l, i) => [l.name, i])));
export const lineText = l => l.words.map(([w, , br], j) => (j ? (br ? LINE_BREAK : ' ') : '') + w).join('');

// The plan, in film time. Fields as the engine's plans have them where the studio reads them (timing,
// totalSteps, duration, barSteps, beatSteps, sections, lines, words, lady, kicks, claps, bars), plus what
// this song is: form 'recording', latency 0 (its sound sits at plan time: anchors.js audioLatency), the
// intro, the glides and marks. lines[].words: {display, at, steps, br?} in steps; the screen of a line holds
// each word to the line's end.
export function printerPlan() {
  const totalSteps = FRAMES / 3, timing = new Float64Array(totalSteps + 17);
  for (let i = 0; i < timing.length; i++) timing[i] = i * STEP;
  const lines = LINES.map(l => ({kind:'printer', name:l.name, text:lineText(l).replace(LINE_BREAK, ' '),
    words:l.words.map(([display, f, br]) => ({display, at:midStep(f), steps:midStep(l.to) - midStep(f), ...(br ? {br:true} : {})}))}));
  return {
    form:'recording', track:PRINTER_SONG.track, trackTitle:PRINTER_SONG.title, title:PRINTER_SONG.title, voice:'Printer',
    latency:0, step:STEP, timing, totalSteps, duration:FRAMES / FPS, barSteps:16, beatSteps:4,
    // Sections in bars of 16 steps (2 s), for the monitor and section anchors: A, the splice's tail, B.
    sections:[{name:'Loading', from:0, to:INTRO / 48}, {name:'Print run', from:INTRO / 48, to:(INTRO / FPS + MARKS.splice) / 2}, {name:'Low toner', from:(INTRO / FPS + MARKS.splice) / 2, to:(INTRO / FPS + MARKS.b) / 2},
      {name:'Night shift', from:(INTRO / FPS + MARKS.b) / 2, to:FRAMES / 48}],
    lines, words:[], lady:[], stutters:[], band:[], kicks:[], claps:[], bars:[],
    // (Song seconds: add intro for film seconds.)
    intro:INTRO / FPS, glides:GLIDES, beatsB:BEATS_B, marks:MARKS, audio:PRINTER_SONG.audio,
  };
}
