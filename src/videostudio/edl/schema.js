// The edit decision list. One JSON document per film:
//
//   EDL {version:1, song:{form, track?, post?, seed?, loop?, steps?}, format:'9:16'|'1:1'|'16:9', fps:24,
//        clips:VideoClip[], board:BoardCue[] | 'song', transports:Transport[], camera?:CameraCue[],
//        boardMoves?:BoardMove[], overrides:Override[], template?:bool, boardPitch?:px}
//   boardPitch: the board's own grid, output px a peg at frame size (Delve.: 12, a 90 x 160 board at 1080 x 1920,
//     the same pegs at any render scale); without it the board takes the stage's pitch for its region.
//
//   VideoClip {id, at:At, len (steps), cell, asset:'shot:<id>'|'role:<stem>.<kind>'|'gen:<name>', z?,
//     time?:{in (s), rate:Param, reverse, repeat?:{unit, count?, pingpong?, vary?, loop?}, freezeAt?, tape?, map?},
//     frame?:{crop?:{[format|'all']:Rect}, zoom, cx, cy, rot, dx, dy, opacity:Param, mirror?:'x'|'y'|'xy'},
//     fx?:[{type, ...Param}], chrome?:{name, role, mic, speaking:Param, toast, banner, cameraOff},
//     origin?, scene?, signature?, why?}
//   BoardCue {id?, at, len, text | {ref}, font?, k?, lines?, reveal?, release?, palette?, fx?:{detune, slow, strike, ...}, cell?, z?, ghost?, zone?:[top, bottom]}
//          | {type:'psych', id?, at, len, look, params?, seed?, fade?, cell?, events?}   imagery on the dot grid (PSYCH)
//   zone: the rows a screen centres in (pegs, top and bottom inclusive). events: a look's own moments (stars:
//   [[t0, t1, x, y, len, tone, hero, x0?, y0?, travel?], ...] in song seconds and 0..1 of the board).
//   text.ref 'phrase:P<n>' sets one of the river's phrases (plan.band) on its own word times.
//   Transport {id?, at, len, kind:'rewind'|'tapestop'|'jump', audio:true, rate?, from?:At, seconds?}
//   CameraCue {id?, at, len, zoom, cx, cy, rot, dx, dy:Param, fx?:[...], board?, clock?:'song'|'film'}   the whole composite
//   BoardMove {id?, at, frames? (3-24, default 4), ease? (default inOutSine), align?:'start'|'end', why?}
//     the only place the Peg Board's rect may change (lint G14): it eases from the rect its layout
//     gave it on the frame before the move to the rect its layout gives it on the move's last frame,
//     starting on `at` (start: a full-board moment grows out of the home) or landing on it (end)
//   Override {target, set?:{'dotted.path':value}, rule?:'G7'|'S4', note}   rule: waive that lint for the target
//
// Units: at/len/keys/off in 16th steps of the plan (any tempo); `frames` in
// output frames; source times (in, map, freezeAt.src) in source seconds;
// rot in degrees; cx/cy in 0..1 of the crop; dx/dy and fx lengths in output px.
// validate() returns [{path, message}]; stringify() is canonical, so a document
// round-trips byte for byte.
import {checkParam, EASE_NAMES} from './params.js';
import {FORMAT_NAMES, cellRect} from '../layouts.js';
import {LOOKS, PSYCH_LOOKS, lookParams} from '../../pegboard/psych.js';

export const VERSION = 1;
export const FPS = 24;

// The compositor's effect vocabulary. Every parameter is a Param (evaluated to a
// number per frame) unless it lists `values` (a string). `identity` is the value
// at which the effect does nothing; compile drops identity effects. `warps`
// marks effects that displace, resample or replace pixels: refused on Synergy.
export const FX = {
  zoomBlur:{warps:true, params:{amount:{d:0, doc:'0..1: the 8 taps reach this fraction of the way to the centre'}, cx:{d:.5, doc:'0..1 in the cell'}, cy:{d:.5, doc:'0..1 in the cell'}}, identity:f => f.amount <= 0},
  dirBlur:{warps:true, params:{px:{d:0, doc:'blur length, output px'}, angle:{d:0, doc:'degrees, 0 = along +x'}}, identity:f => f.px <= 0},
  mosaic:{warps:true, params:{px:{d:0, doc:'block size, output px, blocks aligned to the cell origin'}}, identity:f => f.px <= 1},
  chromaDrop:{warps:false, params:{amount:{d:0, doc:'0..1: 1 keeps luma only'}}, identity:f => f.amount <= 0},
  saturation:{warps:false, params:{amount:{d:1, doc:'multiplier: 1 unchanged, 0 grey, .4 is -60 %'}}, identity:f => f.amount === 1},
  rgbSplit:{warps:true, params:{px:{d:0, doc:'output px: red moves +px along angle, blue -px, green stays'}, angle:{d:0, doc:'degrees'}}, identity:f => f.px <= 0},
  fold:{warps:true, mirrors:true, params:{axis:{d:'x', values:['x', 'y', 'xy'], doc:'UV fold about the cell centre: x reflects the left half onto the right'}}, identity:() => false},
  tile:{warps:true, mirrors:f => !!f.mirror, params:{cols:{d:2, doc:'tiles across the cell'}, rows:{d:2, doc:'tiles down'}, mirror:{d:1, doc:'1 mirrors alternate tiles (kaleido)'}}, identity:f => f.cols <= 1 && f.rows <= 1},
  iris:{warps:false, params:{r:{d:1, doc:'0..1 of the cell half-diagonal; 1 open, 0 closed'}, cx:{d:.5, doc:'0..1 in the cell (source px with space:source)'}, cy:{d:.5, doc:'as cx'}, feather:{d:2, doc:'edge softness, output px'}, space:{d:'cell', values:['cell', 'source'], doc:'compile converts source px to cell units'}},
    // (Open when the circle holds every corner of any cell: r of 2 × the centre's farthest reach in cell units; 1 when centred.)
    identity:f => f.space !== 'source' && f.r >= 2 * Math.max(f.cx ?? .5, 1 - (f.cx ?? .5), f.cy ?? .5, 1 - (f.cy ?? .5))},
  droste:{warps:true, params:{depth:{d:0, doc:'0..3 levels of the previous output frame nested in the cell; fractional = partway in'}, scale:{d:1 / 3, doc:'inner frame size, fraction of the cell'}, cx:{d:.5, doc:'0..1 centre of the inner frame'}, cy:{d:.5, doc:'as cx'}}, identity:f => f.depth <= 0},
  pegVideo:{warps:true, params:{mix:{d:1, doc:'0..1 footage to peg video'}, pitch:{d:12, doc:'output px between peg centres'}, levels:{d:6, doc:'blue levels, luma^gamma quantised'}, gamma:{d:1.4, doc:'luma exponent'}}, identity:f => f.mix <= 0},
  scanline:{warps:true, params:{amount:{d:0, doc:'0..1 line darkening'}, wobble:{d:0, doc:'horizontal displacement, output px'}, period:{d:6, doc:'output px per line pair'}}, identity:f => f.amount <= 0 && f.wobble <= 0},
  echo:{warps:true, params:{taps:{d:0, doc:'trail copies'}, frames:{d:1, doc:'frames between copies'}, decay:{d:.6, doc:'opacity of each copy relative to the one before'}}, identity:f => f.taps <= 0 || f.decay <= 0},
  // The psychedelic pixelation (offsite-psych): mosaics that breathe with the voices, duotone washes,
  // trails of earlier frames, kaleidoscope wedges, pegs blooming out of the board, a slow colour drift.
  breathe:{warps:true, params:{px:{d:0, doc:'block size, output px (bind it to the voices and the claps); between octaves the two nested grids crossfade, so the blocks breathe instead of stepping'}, cx:{d:.5, doc:'0..1 in the cell: the blocks grow from here'}, cy:{d:.5, doc:'as cx'}}, identity:f => f.px <= 1},
  paletteWash:{warps:false, params:{mix:{d:0, doc:'0..1 the original to the wash'}, hue:{d:0, doc:'the duotone: 0 Peg Board blue, 1 violet, 2 warm (coral), fractional between; never green; luma kept'}}, identity:f => f.mix <= 0},
  trail:{warps:true, params:{taps:{d:0, doc:'copies of the clip as it was earlier: its own earlier source frames and transforms (at most 6)'}, frames:{d:2, doc:'output frames between copies'}, decay:{d:.5, doc:'0..1 each copy relative to the one before (bind it to the claps to smear on the beat)'}, blend:{d:'lighten', values:['lighten', 'over'], doc:'lighten: a copy only brightens (feedback trails); over: an echo laid over'}}, identity:f => f.taps < 1 || f.decay <= 0},
  radialFold:{warps:true, mirrors:true, params:{wedges:{d:6, doc:'mirrored wedges about the centre: a kaleidoscope (2 or more)'}, angle:{d:0, doc:'degrees: the wedges turn with it'}, cx:{d:.5, doc:'0..1 in the cell'}, cy:{d:.5, doc:'as cx'}}, identity:f => f.wedges < 2},
  pegBloom:{warps:true, params:{amount:{d:0, doc:'0..1: how far the footage has turned into pegs, from the centre out'}, cx:{d:.5, doc:'the centre, 0..1 of the cell (of the frame with space:frame)'}, cy:{d:.5, doc:'as cx'}, band:{d:.2, doc:'the pixel front ahead of the pegs (blocks a peg wide), fraction of the reach'}, reach:{d:0, doc:'output px amount 1 reaches; 0: the cell\'s farthest corner (space:frame sets it to the frame\'s farthest corner, so one circle grows across every tile)'}, pitch:{d:12, doc:'output px between peg centres'}, levels:{d:6, doc:'blue levels, luma^gamma quantised'}, gamma:{d:1.4, doc:'luma exponent'}, space:{d:'cell', values:['cell', 'frame'], doc:'frame: cx, cy are 0..1 of the frame (the board home), compile maps them into the cell'}}, identity:f => f.amount <= 0},
  chromaDrift:{warps:true, params:{px:{d:0, doc:'output px: red, green and blue each orbit, 120 degrees apart (green at half)'}, angle:{d:0, doc:'degrees: drift it slowly with keys'}, radial:{d:0, doc:'output px at the cell corner: red outwards, blue inwards, from the centre'}}, identity:f => f.px <= 0 && f.radial <= 0},
  // Little stars drawn in pegs over a clip, turning (the printer's dream): each lives 2.4-3.6 s in a place of
  // its own, its arms growing from one peg and shrinking back, so it twinkles by size, never by a blink.
  // Over the picture only (lighten), in the clip's cell: never on the Peg Board, so never over the words.
  sparkle:{warps:false, params:{amount:{d:0, doc:'0..1: the stars\' light (key it in and out over a second or more)'}, count:{d:6, doc:'stars alive at once in the cell, 1 to 12'}, pitch:{d:12, doc:'output px between pegs'}, size:{d:3, doc:'arm length, pegs'}, spin:{d:.2, doc:'turns a second (each star turns its own way)'}, tone:{d:0, doc:'the arms: 0 blue, .5 white, 1 signal (between them through white, never green); the core is white-hot'}, seed:{d:0, doc:'which stars, a whole number'}}, identity:f => f.amount <= 0},
  // Square-edged psychedelics: stepped contour bands of a squarish distance field (rings with stair-stepped
  // corners, an eye when wide), in big hard-edged blocks of flat house colour, no anti-aliasing. The bands
  // take the picture block by block (a pixel dissolve, or a front from the centre out), or fill only where the
  // picture is not (under: a letterbox becomes a tunnel round the picture). Never green.
  contour:{warps:false, params:{mix:{d:0, doc:'0..1: the share of blocks the bands have taken (by hash, or from the centre out with grow 1)'},
    px:{d:24, doc:'the block, output px (a big pixel: about 37 across a 1080 frame is 29)'}, band:{d:3, doc:'blocks per band: one light stripe and its dark ground'},
    duty:{d:1 / 3, doc:'0..1: the light stripe\'s share of each band (keep duty × band a whole number of blocks, so a stripe never changes width as it moves)'}, travel:{d:0, doc:'bands travelled outward (negative: inward); key it on the song\'s steps'},
    cx:{d:.5, doc:'the centre, 0..1 of the cell (of the frame with space:frame)'}, cy:{d:.5, doc:'as cx'},
    twin:{d:0, doc:'0..1 of the cell\'s width: two centres this far apart about cx (two eyes); the nearer wins'},
    aspect:{d:1.6, doc:'how much wider than tall the rings are: 1 square, 2 an eye'}, corner:{d:.7, doc:'.5 square corners, .7 an octagon\'s stepped cut, 1 a diamond'},
    luma:{d:0, doc:'0..2: the picture\'s own light bends the bands (contours that follow the image)'},
    hole:{d:0, doc:'a pupil: blocks nearer the centre than this (field units, blocks) stay picture'},
    grow:{d:0, doc:'0: blocks turn by hash (a dissolve); 1: a front from the centre out (mix 1 reaches reach)'},
    reach:{d:0, doc:'output px the front reaches at mix 1; 0: the cell\'s farthest corner (space:frame: the frame\'s)'},
    under:{d:0, doc:'1: the bands fill only where the picture is not (a letterbox): the picture stays whole over them'},
    tone:{d:0, doc:'0 white stripes, every fourth blue, on socket black; 1 blue stripes, every fourth white; 2 white stripes, every fourth signal (the LEDs\' amber)'},
    space:{d:'cell', values:['cell', 'frame'], doc:'frame: cx, cy are 0..1 of the frame (the board home), compile maps them into the cell'}}, identity:f => f.mix <= 0},
  // Pixel motion tiles: the cell cut into square tiles; on each tick some are dealt again: each drops to a
  // coarser block (px, px/2 or px/4), its picture rolled a whole number of blocks inside it, its light
  // re-quantised to a few levels (its hue kept). Size and place, not light: a moving tile keeps its picture's average.
  pixelTiles:{warps:true, params:{amount:{d:0, doc:'0..1: the share of tiles moving'}, tile:{d:96, doc:'the tile, output px'},
    px:{d:24, doc:'the coarsest block a moving tile drops to, output px (it steps between px, px/2 and px/4)'},
    slide:{d:1, doc:'how far a moving tile\'s picture rolls inside it, blocks (whole numbers)'},
    levels:{d:4, doc:'a moving tile\'s light re-quantised to this many levels, its hue kept (0: not)'},
    tick:{d:0, doc:'a whole number: each new value deals the tiles again (key it with steps on the song\'s grid)'}, seed:{d:0, doc:'which tiles'}}, identity:f => f.amount <= 0},
};
// Effects compile expands into extra layers (the trail's copies); never on a camera cue.
export const LAYER_ONLY_FX = ['trail'];
export const FX_TYPES = Object.keys(FX);
export const GEN = ['black', 'white', 'board', 'camera-off', 'feedback'];
export const REVEALS = ['pop', 'typewriter', 'scanline', 'wipe', 'sparkle', 'centre', 'stroke', 'steady'];
export const RELEASES = ['cut', 'afterglow', 'dissolve'];
export const PALETTES = ['blue', 'white', 'deep', 'signal'];
export const FONTS = ['peg9', 'peg5', 'peg3'];
export const TRANSPORTS = ['rewind', 'tapestop', 'jump'];
export const MIRRORS = ['x', 'y', 'xy'];

// 'shot:<id>' | 'role:<stem>.<kind>' | 'gen:<name>' | 'gen:color:#rrggbb'
export function parseAsset(asset) {
  const s = String(asset ?? '');
  if (s.startsWith('shot:') && s.length > 5) return {kind:'shot', id:s.slice(5)};
  if (s.startsWith('role:') && /^role:[a-z]+(\.[a-z]+)?$/.test(s)) { const [stem, kind = 'any'] = s.slice(5).split('.'); return {kind:'role', stem, role:kind}; }
  if (s.startsWith('gen:')) {
    const g = s.slice(4), c = /^color:#([0-9a-fA-F]{6})$/.exec(g);
    if (c) return {kind:'gen', gen:'color', color:`#${c[1].toLowerCase()}`};
    if (GEN.includes(g)) return {kind:'gen', gen:g};
  }
  return null;
}

// ---- validation ---------------------------------------------------------------------
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
const isRect = r => isObj(r) && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(r[k])) && r.w > 0 && r.h > 0;

function checkAt(at, path, out) {
  if (typeof at === 'number') { if (!Number.isFinite(at) || at < 0) out.push([path, 'a step must be a finite number of 0 or more']); return; }
  if (!isObj(at) || typeof at.anchor !== 'string') { out.push([path, 'At is a step number or {anchor, off?, frames?, hit?}']); return; }
  if (!/^[a-z]+(:[^#]+)?(#-?\d+)?$/i.test(at.anchor)) out.push([`${path}.anchor`, `cannot read anchor "${at.anchor}"`]);
  for (const k of ['off', 'frames']) if (at[k] !== undefined && !Number.isFinite(at[k])) out.push([`${path}.${k}`, 'must be a finite number']);
  if (at.hit !== undefined && typeof at.hit !== 'boolean') out.push([`${path}.hit`, 'hit is true for a moment tied to a transient (the frame that holds its audible onset)']);
  for (const k of Object.keys(at)) if (!['anchor', 'off', 'frames', 'hit'].includes(k)) out.push([`${path}.${k}`, 'is not a field of At']);
}
function checkFx(list, path, out) {
  if (!Array.isArray(list)) { out.push([path, 'fx is a list of {type, ...}']); return; }
  list.forEach((fx, i) => {
    const p = `${path}[${i}]`, spec = FX[fx?.type];
    if (!spec) { out.push([`${p}.type`, `unknown effect "${fx?.type}" (${FX_TYPES.join(', ')})`]); return; }
    for (const [k, v] of Object.entries(fx)) {
      if (k === 'type') continue;
      const ps = spec.params[k];
      if (!ps) { out.push([`${p}.${k}`, `${fx.type} has no parameter "${k}" (${Object.keys(spec.params).join(', ')})`]); continue; }
      if (ps.values) { if (!ps.values.includes(v)) out.push([`${p}.${k}`, `must be one of ${ps.values.join(', ')}`]); }
      else for (const [q, m] of checkParam(v, `${p}.${k}`)) out.push([q, m]);
    }
  });
}
const FIELDS = {
  clip:['id', 'at', 'len', 'cell', 'asset', 'z', 'time', 'frame', 'fx', 'chrome', 'origin', 'scene', 'signature', 'why', 'tags'],
  time:['in', 'rate', 'reverse', 'repeat', 'freezeAt', 'tape', 'map'],
  frame:['crop', 'zoom', 'cx', 'cy', 'rot', 'dx', 'dy', 'opacity', 'mirror'],
  chrome:['name', 'role', 'mic', 'speaking', 'toast', 'banner', 'cameraOff'],
  repeat:['unit', 'count', 'pingpong', 'vary', 'loop'],
  cue:['id', 'at', 'len', 'text', 'font', 'k', 'lines', 'reveal', 'release', 'palette', 'fx', 'cell', 'z', 'ghost', 'zone', 'why'],
  psych:['id', 'type', 'at', 'len', 'look', 'params', 'seed', 'fade', 'cell', 'events', 'why'],
  transport:['id', 'at', 'len', 'kind', 'audio', 'rate', 'from', 'seconds', 'signature', 'why'],
  camera:['id', 'at', 'len', 'zoom', 'cx', 'cy', 'rot', 'dx', 'dy', 'fx', 'board', 'clock', 'why'],
  boardMove:['id', 'at', 'frames', 'ease', 'align', 'why'],
  override:['target', 'set', 'rule', 'note'],
};
const unknown = (obj, kind, path, out) => { for (const k of Object.keys(obj)) if (!FIELDS[kind].includes(k)) out.push([`${path}.${k}`, `is not a field of ${kind}`]); };

function checkClip(c, path, out, format) {
  if (!isObj(c)) { out.push([path, 'a clip is an object']); return; }
  unknown(c, 'clip', path, out);
  if (typeof c.id !== 'string' || !c.id) out.push([`${path}.id`, 'every clip needs a string id']);
  checkAt(c.at, `${path}.at`, out);
  if (!(Number.isFinite(c.len) && c.len > 0)) out.push([`${path}.len`, 'len is a positive number of steps']);
  if (typeof c.cell !== 'string') out.push([`${path}.cell`, 'cell is a cell id such as "G6.3" or "full"']);
  else if (format && !cellRect(format, c.cell)) out.push([`${path}.cell`, `no cell "${c.cell}" in ${format}`]);
  if (!parseAsset(c.asset)) out.push([`${path}.asset`, `asset must be shot:<id>, role:<stem>.<kind> or gen:<${GEN.join('|')}|color:#rrggbb>, got "${c.asset}"`]);
  if (c.z !== undefined && !Number.isFinite(c.z)) out.push([`${path}.z`, 'must be a number']);
  const t = c.time;
  if (t !== undefined) {
    if (!isObj(t)) out.push([`${path}.time`, 'must be an object']);
    else {
      unknown(t, 'time', `${path}.time`, out);
      if (t.in !== undefined && !(Number.isFinite(t.in) && t.in >= 0)) out.push([`${path}.time.in`, 'in is source seconds, 0 or more']);
      if (t.rate !== undefined) for (const e of checkParam(t.rate, `${path}.time.rate`)) out.push(e);
      for (const k of ['reverse', 'tape']) if (t[k] !== undefined && typeof t[k] !== 'boolean') out.push([`${path}.time.${k}`, 'must be true or false']);
      if (t.repeat !== undefined) {
        const r = t.repeat, rp = `${path}.time.repeat`;
        if (!isObj(r)) out.push([rp, 'repeat is {unit, count?, pingpong?, vary?}']);
        else {
          unknown(r, 'repeat', rp, out);
          const u = r.unit;
          if (!(Number.isFinite(u) && u > 0) && !(isObj(u) && ((Number.isFinite(u.steps) && u.steps > 0) || (Number.isInteger(u.frames) && u.frames > 0))))
            out.push([`${rp}.unit`, 'unit is a positive number of steps, {steps} or {frames}']);
          if (r.count !== undefined && !(Number.isInteger(r.count) && r.count >= 1)) out.push([`${rp}.count`, 'count is a whole number of plays, 1 or more']);
          for (const k of ['pingpong', 'loop']) if (r[k] !== undefined && typeof r[k] !== 'boolean') out.push([`${rp}.${k}`, 'must be true or false']);
          if (r.vary !== undefined) {
            if (!Array.isArray(r.vary)) out.push([`${rp}.vary`, 'vary is a list of per-repeat changes']);
            else r.vary.forEach((v, i) => {
              if (!isObj(v)) { out.push([`${rp}.vary[${i}]`, 'is an object']); return; }
              for (const [k, x] of Object.entries(v)) {
                if (k === 'mirror') { if (x !== null && !MIRRORS.includes(x)) out.push([`${rp}.vary[${i}].mirror`, 'is x, y, xy or null']); }
                else if (['zoom', 'cx', 'cy', 'rot', 'rate'].includes(k)) { if (!Number.isFinite(x)) out.push([`${rp}.vary[${i}].${k}`, 'must be a number']); }
                else out.push([`${rp}.vary[${i}].${k}`, 'can vary zoom, cx, cy, rot, rate or mirror']);
              }
            });
          }
        }
      }
      const fz = t.freezeAt;
      if (fz !== undefined && !(Number.isFinite(fz) && fz >= 0) && !(isObj(fz) && Object.keys(fz).every(k => ['at', 'len', 'src'].includes(k) && Number.isFinite(fz[k]) && fz[k] >= 0)))
        out.push([`${path}.time.freezeAt`, 'freezeAt is local steps, or {at?, len?, src?} (steps, steps, source seconds)']);
      if (t.map !== undefined && !(Array.isArray(t.map) && t.map.length && t.map.every((p, i) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && (!i || p[0] > t.map[i - 1][0]))))
        out.push([`${path}.time.map`, 'map is [[localStep, sourceSeconds], ...] in time order']);
    }
  }
  const f = c.frame;
  if (f !== undefined) {
    if (!isObj(f)) out.push([`${path}.frame`, 'must be an object']);
    else {
      unknown(f, 'frame', `${path}.frame`, out);
      for (const k of ['zoom', 'cx', 'cy', 'rot', 'dx', 'dy', 'opacity']) if (f[k] !== undefined) for (const e of checkParam(f[k], `${path}.frame.${k}`)) out.push(e);
      if (f.mirror !== undefined && f.mirror !== null && !MIRRORS.includes(f.mirror)) out.push([`${path}.frame.mirror`, 'is x, y or xy']);
      if (f.crop !== undefined) {
        if (!isObj(f.crop)) out.push([`${path}.frame.crop`, 'crop is {"9:16":Rect, "1:1":Rect, "16:9":Rect, all?:Rect}']);
        else for (const [k, r] of Object.entries(f.crop)) {
          if (![...FORMAT_NAMES, 'all'].includes(k)) out.push([`${path}.frame.crop.${k}`, 'crop keys are formats or all']);
          else if (!isRect(r)) out.push([`${path}.frame.crop.${k}`, 'a Rect is {x, y, w, h} in source px with w, h > 0']);
        }
      }
    }
  }
  if (c.fx !== undefined) checkFx(c.fx, `${path}.fx`, out);
  const ch = c.chrome;
  if (ch !== undefined) {
    if (!isObj(ch)) out.push([`${path}.chrome`, 'must be an object']);
    else {
      unknown(ch, 'chrome', `${path}.chrome`, out);
      for (const k of ['name', 'role']) if (ch[k] !== undefined && typeof ch[k] !== 'string') out.push([`${path}.chrome.${k}`, 'must be a string']);
      if (ch.mic !== undefined && !['on', 'muted'].includes(ch.mic)) for (const e of checkParam(ch.mic, `${path}.chrome.mic`)) out.push([e[0], `${e[1]}; or "on" / "muted"`]);
      if (ch.speaking !== undefined) for (const e of checkParam(ch.speaking, `${path}.chrome.speaking`)) out.push(e);
      const notes = (x, p) => (Array.isArray(x) ? x : [x]).forEach((n, i) => {
        const q = Array.isArray(x) ? `${p}[${i}]` : p;
        if (typeof n === 'string') return;
        if (!isObj(n) || typeof n.text !== 'string') out.push([q, 'is a string or {text, at?, len?}']);
        else for (const k of ['at', 'len']) if (n[k] !== undefined && !(Number.isFinite(n[k]) && n[k] >= 0)) out.push([`${q}.${k}`, 'is local steps']);
      });
      if (ch.toast !== undefined) notes(ch.toast, `${path}.chrome.toast`);
      if (ch.banner !== undefined) notes(ch.banner, `${path}.chrome.banner`);
      if (ch.cameraOff !== undefined && typeof ch.cameraOff !== 'boolean') out.push([`${path}.chrome.cameraOff`, 'must be true or false']);
    }
  }
  for (const k of ['origin', 'scene', 'signature', 'why']) if (c[k] !== undefined && typeof c[k] !== 'string') out.push([`${path}.${k}`, 'must be a string']);
}

// A psych cue: generative imagery on the dot grid (pegboard/psych.js), under the board's type.
//   {type:'psych', id?, at, len, look, params?:{name:Param}, seed?, fade? (steps, default 4), cell?}
// No cell: painted into the board's own region at each frame (the home, the share's board, the
// full-bleed board), under its words. cell: its own peg board laid over that tile ('full': the frame).
export const PSYCH = Object.freeze({looks:PSYCH_LOOKS, params:look => lookParams(look), describe:look => LOOKS[look]});
function checkPsych(c, path, out, format) {
  unknown(c, 'psych', path, out);
  checkAt(c.at, `${path}.at`, out);
  if (!(Number.isFinite(c.len) && c.len > 0)) out.push([`${path}.len`, 'len is a positive number of steps']);
  if (!PSYCH_LOOKS.includes(c.look)) { out.push([`${path}.look`, `is one of ${PSYCH_LOOKS.join(', ')}`]); return; }
  if (c.params !== undefined) {
    if (!isObj(c.params)) out.push([`${path}.params`, 'params is {name: Param}']);
    else { const spec = lookParams(c.look); for (const [k, v] of Object.entries(c.params)) { if (!spec[k]) out.push([`${path}.params.${k}`, `${c.look} has no parameter "${k}" (${Object.keys(spec).join(', ')})`]); else for (const [q, m] of checkParam(v, `${path}.params.${k}`)) out.push([q, m]); } }
  }
  if (c.seed !== undefined && !Number.isInteger(c.seed)) out.push([`${path}.seed`, 'seed is a whole number']);
  if (c.fade !== undefined && !(Number.isFinite(c.fade) && c.fade >= 2)) out.push([`${path}.fade`, 'fade is at least 2 steps: a pattern never switches on or off in one frame']);
  if (c.cell !== undefined && format && !cellRect(format, c.cell)) out.push([`${path}.cell`, `no cell "${c.cell}" in ${format}`]);
  if (c.events !== undefined && !(Array.isArray(c.events) && c.events.every(e => Array.isArray(e) && e.length >= 5 && e.length <= 10 && e.every(Number.isFinite) && e[1] > e[0])))
    out.push([`${path}.events`, 'events are [[t0, t1, x, y, len, tone?, hero?, x0?, y0?, travel?], ...]: finite numbers, t1 after t0']);
}

function checkCue(c, path, out, format) {
  if (!isObj(c)) { out.push([path, 'a board cue is an object']); return; }
  if (c.type !== undefined) { if (c.type === 'psych') checkPsych(c, path, out, format); else out.push([`${path}.type`, 'a board cue\'s type is "psych" (generative imagery) or none (type)']); return; }
  unknown(c, 'cue', path, out);
  checkAt(c.at, `${path}.at`, out);
  if (!(Number.isFinite(c.len) && c.len > 0) && !(c.len === undefined && c.text?.ref === 'song')) out.push([`${path}.len`, 'len is a positive number of steps (only a {ref:"song"} cue may run to the end)']);
  if (typeof c.text !== 'string' && !(isObj(c.text) && typeof c.text.ref === 'string')) out.push([`${path}.text`, 'text is a string or {ref:"song" | "song:<kind>#n" | "lady:<role>#n" | "line:<kind>#n"}']);
  if (c.font !== undefined && !FONTS.includes(c.font)) out.push([`${path}.font`, `is one of ${FONTS.join(', ')}`]);
  if (c.k !== undefined && !(Number.isInteger(c.k) && c.k >= 1 && c.k <= 4)) out.push([`${path}.k`, 'k is a whole block size from 1 to 4']);
  if (c.lines !== undefined && !(Number.isInteger(c.lines) && c.lines >= 1 && c.lines <= 4)) out.push([`${path}.lines`, 'lines is how many lines the screen may set, 1 to 4 (default: 3 at k 1, 1 above)']);
  if (c.reveal !== undefined && !REVEALS.includes(c.reveal)) out.push([`${path}.reveal`, `is one of ${REVEALS.join(', ')}`]);
  if (c.release !== undefined && !RELEASES.includes(c.release)) out.push([`${path}.release`, `is one of ${RELEASES.join(', ')}`]);
  if (c.palette !== undefined && typeof c.palette !== 'string') out.push([`${path}.palette`, `is a palette name (${PALETTES.join(', ')})`]);
  if (c.cell !== undefined && format && !cellRect(format, c.cell)) out.push([`${path}.cell`, `no cell "${c.cell}" in ${format}`]);
  if (c.z !== undefined && !['over', 'under'].includes(c.z)) out.push([`${path}.z`, 'is over or under']);
  if (c.fx !== undefined && !isObj(c.fx)) out.push([`${path}.fx`, 'board fx is {detune?, slow?, rowShift?, sparkle?, outline?}']);
  if (c.ghost !== undefined && !(Number.isFinite(c.ghost) && c.ghost > 0 && c.ghost <= .5)) out.push([`${path}.ghost`, 'ghost is the intensity of a ghost screen (only its letters, flat, on true black), above 0 and at most .5']);
  if (c.zone !== undefined && !(Array.isArray(c.zone) && c.zone.length === 2 && c.zone.every(Number.isInteger) && c.zone[0] >= 0 && c.zone[1] > c.zone[0])) out.push([`${path}.zone`, 'zone is [top, bottom]: whole rows of pegs, bottom below top']);
  if (isObj(c.fx)) for (const k of ['echo', 'harmony']) if (c.fx[k] !== undefined && !(Array.isArray(c.fx[k]) && c.fx[k].every(x => isObj(x) && Object.values(x).every(v => typeof v === 'string' || Number.isFinite(v) || Array.isArray(v)))))
    out.push([`${path}.fx.${k}`, `${k} is a list of {..} with numbers, tone names and curves`]);
}

// Structural problems, as [{path, message}]. References to the plan and the shot
// index (anchors, assets) are checked by compile, which has them.
export function validate(edl) {
  const out = [];
  if (!isObj(edl)) return [{path:'', message:'an EDL is a JSON object'}];
  for (const k of Object.keys(edl)) if (!['version', 'song', 'format', 'fps', 'clips', 'board', 'transports', 'camera', 'boardMoves', 'overrides', 'template', 'boardPitch'].includes(k)) out.push([k, 'is not a field of an EDL']);
  if (edl.boardPitch !== undefined && !(Number.isInteger(edl.boardPitch) && edl.boardPitch >= 6 && edl.boardPitch <= 24)) out.push(['boardPitch', 'boardPitch is the board\'s grid in output px a peg at frame size, a whole number from 6 to 24']);
  if (edl.version !== VERSION) out.push(['version', `must be ${VERSION}`]);
  if (!isObj(edl.song) || typeof edl.song.form !== 'string') out.push(['song', 'song is {form, track?, post?, seed?, loop?, steps?}']);
  else {
    for (const k of Object.keys(edl.song)) if (!['form', 'track', 'post', 'seed', 'loop', 'steps', 'hash'].includes(k)) out.push([`song.${k}`, 'is not a field of song']);
    if (edl.song.steps !== undefined && !(Number.isInteger(edl.song.steps) && edl.song.steps > 0)) out.push(['song.steps', 'is a whole number of steps']);
  }
  const format = FORMAT_NAMES.includes(edl.format) ? edl.format : null;
  if (!format) out.push(['format', `must be one of ${FORMAT_NAMES.join(', ')}`]);
  if (edl.fps !== FPS) out.push(['fps', `must be ${FPS}: the studio masters at 24 fps and every cut lands on round(t·24)`]);
  if (!Array.isArray(edl.clips)) out.push(['clips', 'clips is a list']);
  else {
    const ids = new Set();
    edl.clips.forEach((c, i) => {
      checkClip(c, `clips[${i}]`, out, format);
      if (c?.id) { if (ids.has(c.id)) out.push([`clips[${i}].id`, `duplicate clip id "${c.id}"`]); ids.add(c.id); }
    });
  }
  if (edl.board !== 'song' && !Array.isArray(edl.board)) out.push(['board', 'board is "song" or a list of BoardCues']);
  else if (Array.isArray(edl.board)) edl.board.forEach((c, i) => checkCue(c, `board[${i}]`, out, format));
  if (!Array.isArray(edl.transports)) out.push(['transports', 'transports is a list']);
  else edl.transports.forEach((t, i) => {
    const p = `transports[${i}]`;
    if (!isObj(t)) { out.push([p, 'a transport is an object']); return; }
    unknown(t, 'transport', p, out);
    checkAt(t.at, `${p}.at`, out);
    if (!(Number.isFinite(t.len) && t.len > 0)) out.push([`${p}.len`, 'len is a positive number of steps']);
    if (!TRANSPORTS.includes(t.kind)) out.push([`${p}.kind`, `is one of ${TRANSPORTS.join(', ')}`]);
    if (t.audio !== true) out.push([`${p}.audio`, 'must be true: the audio runs the same transport over the same span (R2 parity)']);
    if (t.rate !== undefined && !(Number.isFinite(t.rate) && t.rate > 0)) out.push([`${p}.rate`, 'is a positive speed']);
    if (t.from !== undefined) checkAt(t.from, `${p}.from`, out);
    if (t.seconds !== undefined && !(Number.isFinite(t.seconds) && t.seconds > 0)) out.push([`${p}.seconds`, 'is a positive number of seconds']);
  });
  if (edl.camera !== undefined) {
    if (!Array.isArray(edl.camera)) out.push(['camera', 'camera is a list of CameraCues']);
    else edl.camera.forEach((c, i) => {
      const p = `camera[${i}]`;
      if (!isObj(c)) { out.push([p, 'a camera cue is an object']); return; }
      unknown(c, 'camera', p, out);
      checkAt(c.at, `${p}.at`, out);
      if (!(Number.isFinite(c.len) && c.len > 0)) out.push([`${p}.len`, 'len is a positive number of steps']);
      for (const k of ['zoom', 'cx', 'cy', 'rot', 'dx', 'dy']) if (c[k] !== undefined) for (const e of checkParam(c[k], `${p}.${k}`)) out.push(e);
      if (c.fx !== undefined) checkFx(c.fx, `${p}.fx`, out);
      if (Array.isArray(c.fx)) c.fx.forEach((x, j) => { if (LAYER_ONLY_FX.includes(x?.type)) out.push([`${p}.fx[${j}].type`, `${x.type} belongs on a clip (its copies are the clip's own earlier frames), not on a camera cue`]); });
      if (c.board !== undefined && typeof c.board !== 'boolean') out.push([`${p}.board`, 'board is true when the move carries the Peg Board with the picture (default: the board holds still)']);
      if (c.clock !== undefined && !['song', 'film'].includes(c.clock)) out.push([`${p}.clock`, "clock is 'song' (default: the song time a transport shows) or 'film' (the film's own frames)"]);
    });
  }
  if (edl.boardMoves !== undefined) {
    if (!Array.isArray(edl.boardMoves)) out.push(['boardMoves', 'boardMoves is a list of BoardMoves']);
    else edl.boardMoves.forEach((m, i) => {
      const p = `boardMoves[${i}]`;
      if (!isObj(m)) { out.push([p, 'a board move is an object']); return; }
      unknown(m, 'boardMove', p, out);
      checkAt(m.at, `${p}.at`, out);
      if (m.frames !== undefined && !(Number.isInteger(m.frames) && m.frames >= 3 && m.frames <= 24)) out.push([`${p}.frames`, 'frames is a whole number from 3 to 24: a board move is never a jump']);
      if (m.ease !== undefined && !EASE_NAMES.includes(m.ease)) out.push([`${p}.ease`, `is one of ${EASE_NAMES.join(', ')}`]);
      if (m.align !== undefined && !['start', 'end'].includes(m.align)) out.push([`${p}.align`, "align is 'start' (the move starts on at) or 'end' (it lands on at)"]);
      if (m.why !== undefined && typeof m.why !== 'string') out.push([`${p}.why`, 'must be a string']);
    });
  }
  if (!Array.isArray(edl.overrides)) out.push(['overrides', 'overrides is a list']);
  else edl.overrides.forEach((o, i) => {
    const p = `overrides[${i}]`;
    if (!isObj(o)) { out.push([p, 'an override is an object']); return; }
    unknown(o, 'override', p, out);
    if (typeof o.target !== 'string' || !o.target) out.push([`${p}.target`, 'names a clip id (or clip:<id>, cue:<id>, transport:<id>)']);
    if (o.set !== undefined && !isObj(o.set)) out.push([`${p}.set`, 'is {"dotted.path": value}']);
    if (o.rule !== undefined && !/^(G([1-9]|1[0-3])|S4)$/.test(o.rule)) out.push([`${p}.rule`, 'names one rule: G1 to G13, or S4 (a shot that needs review)']);
    if (typeof o.note !== 'string' || !o.note.trim()) out.push([`${p}.note`, 'every override carries a note saying why']);
  });
  if (edl.template !== undefined && typeof edl.template !== 'boolean') out.push(['template', 'must be true or false']);
  return out.map(([path, message]) => ({path, message}));
}

// ---- canonical JSON ------------------------------------------------------------------
// Keys in one fixed order (known keys first, the rest alphabetically), one clip,
// cue, transport or override per line. stringify(parse(s)) === s for any s that
// stringify produced.
const ORDER = ['version', 'song', 'format', 'fps', 'template', 'form', 'track', 'post', 'seed', 'loop', 'steps', 'hash',
  'id', 'type', 'kind', 'at', 'anchor', 'off', 'frames', 'len', 'cell', 'asset', 'z', 'text', 'ref', 'font', 'k', 'lines', 'reveal', 'release', 'palette',
  'time', 'in', 'rate', 'reverse', 'repeat', 'unit', 'count', 'pingpong', 'loop', 'vary', 'freezeAt', 'src', 'tape', 'map',
  'frame', 'crop', 'all', '9:16', '1:1', '16:9', 'x', 'y', 'w', 'h', 'zoom', 'cx', 'cy', 'rot', 'dx', 'dy', 'opacity', 'mirror',
  'keys', 'unit', 'bind', 'base', 'scale', 'attack', 'release', 'mul', 'add',
  'fx', 'chrome', 'name', 'role', 'mic', 'speaking', 'toast', 'banner', 'cameraOff',
  'audio', 'from', 'seconds', 'ease', 'align', 'target', 'set', 'rule', 'note', 'origin', 'scene', 'signature', 'why', 'tags',
  'clips', 'board', 'transports', 'camera', 'boardMoves', 'overrides'];
const RANK = new Map();
ORDER.forEach((k, i) => { if (!RANK.has(k)) RANK.set(k, i); });
const byRank = (a, b) => { const ra = RANK.get(a) ?? 1e9, rb = RANK.get(b) ?? 1e9; return ra - rb || (a < b ? -1 : a > b ? 1 : 0); };
export function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical);
  if (isObj(x)) {
    const out = {};
    for (const k of Object.keys(x).sort(byRank)) if (x[k] !== undefined) out[k] = canonical(x[k]);
    return out;
  }
  if (typeof x === 'number' && Object.is(x, -0)) return 0;
  return x;
}
export function stringify(edl) {
  const c = canonical(edl), lines = ['{'], keys = Object.keys(c);
  keys.forEach((k, i) => {
    const v = c[k], comma = i < keys.length - 1 ? ',' : '';
    if (Array.isArray(v) && v.length && v.every(isObj)) lines.push(`  ${JSON.stringify(k)}: [`, ...v.map((e, j) => `    ${JSON.stringify(e)}${j < v.length - 1 ? ',' : ''}`), `  ]${comma}`);
    else lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}${comma}`);
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}
export const parse = text => JSON.parse(text);

// A minimal valid EDL for a song form and format.
export function createEDL({form = 'drop60', format = '9:16', clips = [], board = 'song', transports = [], camera, boardMoves, overrides = [], boardPitch, ...song} = {}) {
  const edl = {version:VERSION, song:{form, ...song}, format, fps:FPS, clips, board, transports, overrides};
  if (boardPitch) edl.boardPitch = boardPitch;
  if (camera) edl.camera = camera;
  if (boardMoves) edl.boardMoves = boardMoves;
  return edl;
}

// A patch of clips, cues, transports, camera cues and board moves (what a move returns) merged into an EDL.
export function merge(edl, ...patches) {
  const out = {...edl, clips:[...edl.clips], board:Array.isArray(edl.board) ? [...edl.board] : edl.board, transports:[...edl.transports], overrides:[...edl.overrides]};
  for (const p of patches) {
    if (!p) continue;
    if (p.clips) out.clips.push(...p.clips);
    // Cues over a 'song' board keep the song underneath: it becomes a {ref:'song'} cue.
    if (p.board?.length) out.board = [...(Array.isArray(out.board) ? out.board : [{id:'song', at:0, text:{ref:'song'}}]), ...p.board];
    if (p.transports) out.transports.push(...p.transports);
    if (p.camera?.length) out.camera = [...(out.camera || []), ...p.camera];
    if (p.boardMoves?.length) out.boardMoves = [...(out.boardMoves || []), ...p.boardMoves];
    if (p.overrides) out.overrides.push(...p.overrides);
  }
  return out;
}

export {EASE_NAMES};
