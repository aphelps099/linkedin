// Shot index loader and queries for the compositor and the director.
//
//   import {loadShots, srcFor} from './media/shots.js';
//   const shots = await loadShots();                 // lazy JSON chunk in Vite
//   const hero = shots.byRole('drums.hero')[0];
//   const url = srcFor(hero, {preferProxy:true});    // same-origin, WebGL-safe
//
// In Node: createShotIndex(JSON.parse(fs.readFileSync('src/videostudio/media/shots.json', 'utf8'))).
// Schema and rules: src/videostudio/README.md (Media).

export const STEMS = ['drums', 'keys', 'guitar', 'voice'];
const TIERS = {A:3, B:2, C:1};

const b64 = s => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const lumaCache = new WeakMap(), energyCache = new WeakMap();

// Per-frame luma 0..255 of the content box (for the flash governor).
export function lumaTrack(shot) {
  if (!lumaCache.has(shot)) lumaCache.set(shot, b64(shot.lumaTrack));
  return lumaCache.get(shot);
}

// Per-frame motion energy 0..1 (mean |dY| over the content box; 1.0 = 6 levels at 320 px wide).
export function energyTrack(shot) {
  if (!energyCache.has(shot)) energyCache.set(shot, Float32Array.from(b64(shot.energy), v => v / 255));
  return energyCache.get(shot);
}

// Reverse rules (plan section 3.2). R0 shots never play reversed at clip
// level; a Transport{kind:'rewind'} event reverses the whole mix and is the
// only exception (pass {transport:true}).
export function canReverse(shot, {transport = false} = {}) {
  return transport || shot.reverseClass === 'R1';
}

// A master that iOS Safari and most hardware decoders cannot play (H.264 High 4:4:4 or 4:2:2:
// shot.masterChroma, from the builder's probe). Its 540p 4:2:0 proxy plays everywhere, so the
// studio always asks for the proxy, even where it would otherwise read the master.
export const needsProxy = shot => !!shot?.masterChroma && shot.masterChroma !== '4:2:0';

// URL for a shot. preferProxy picks the 540p proxy when one is recorded (always, for a
// master that needs it). reverse:true returns the reversed proxy, or null when none exists
// (a <video> cannot play backwards; the caller freezes or uses another shot).
export function srcFor(shot, {reverse = false, preferProxy = true, transport = false} = {}) {
  if (!shot) throw new Error('srcFor: no shot');
  if (reverse) {
    if (!canReverse(shot, {transport})) throw new Error(`srcFor: ${shot.id} is ${shot.reverseClass} (${shot.reverseWhy}); it never plays reversed`);
    return shot.rev || null;
  }
  return ((preferProxy || needsProxy(shot)) && shot.proxy) || shot.src;
}

// Where a shot's forward picture really comes from on this server: the media route answers
// its proxy key with X-Videostudio-Source 'proxy' (on disk), 'bucket' (uploaded) or 'master'
// (the proxy is not uploaded yet, so the route serves the master in its place). 'none' when the
// index records no proxy; null when the server cannot be asked.
export async function mediaSource(shot, fetcher = (u, o) => fetch(u, o)) {
  if (!shot?.proxy) return 'none';
  try {
    const res = await fetcher(shot.proxy, {method:'HEAD'});
    return res.ok ? res.headers.get('x-videostudio-source') ?? 'proxy' : null;
  } catch { return null; }
}

export function posterFor(shot) {
  return shot.poster || null;
}

// Zoom ceiling for a shot drawn renderedH pixels tall (plan section 3.3).
export function maxZoom(shot, renderedH) {
  return shot.maxUpscale * shot.contentBox[3] / renderedH;
}

// Map a source-pixel rect [x,y,w,h] into proxy pixels.
export function toProxyRect(shot, [x, y, w, h]) {
  if (!shot.proxyInfo) return [x, y, w, h];
  const sx = shot.proxyInfo.w / shot.width, sy = shot.proxyInfo.h / shot.height;
  return [x * sx, y * sy, w * sx, h * sy];
}

// Playback rate that lands the shot's measured hit period on a song grid.
// subdivision: hits per beat (2 = 8ths). Null when the shot has no hits.
// Instrument plates may only be conformed inside 0.85..1.15 (plan 3.2).
export function conformRate(shot, bpm, subdivision = 2) {
  if (!shot.hitPeriod) return null;
  const rate = shot.hitPeriod / (60 / bpm / subdivision);
  return {rate, ok:rate >= .85 && rate <= 1.15};
}

export function createShotIndex(data) {
  const all = data.shots;
  const byKey = new Map();
  for (const s of all) byKey.set(s.id, s);
  for (const s of all) for (const a of s.aliases) if (!byKey.has(a)) byKey.set(a, s);

  // Default pool for the director: current, available and source takes.
  // E never loads; R only when asked for (allow:['R']).
  const usable = (s, allow = []) => s.status === 'C' || s.status === 'A' || s.status === 'S' || allow.includes(s.status);

  function filter(q = {}) {
    const as = v => v === undefined ? null : Array.isArray(v) ? v : [v];
    const action = as(q.action), shotType = as(q.shotType), character = as(q.character), stem = as(q.stem),
      role = as(q.role), kind = as(q.kind), status = as(q.status);
    return all.filter(s =>
      (status ? status.includes(s.status) : usable(s, q.allow)) &&
      (!action || s.action.some(a => action.includes(a))) &&
      (!shotType || shotType.includes(s.shotType)) &&
      (!character || s.characters.some(c => character.includes(c))) &&
      (!stem || stem.includes(s.stem)) &&
      (!role || s.roles.some(r => role.includes(r)) || (role.some(r => STEMS.includes(r)) && role.includes(s.stem))) &&
      (!kind || kind.includes(s.kind)) &&
      (q.reverseClass === undefined || s.reverseClass === q.reverseClass) &&
      (q.reversible === undefined || canReverse(s) === q.reversible) &&
      (q.mirrorable === undefined || s.mirrorable === q.mirrorable) &&
      (q.minTier === undefined || TIERS[s.sharpTier] >= TIERS[q.minTier]) &&
      (q.hasProxy === undefined || Boolean(s.proxy) === q.hasProxy) &&
      (q.lipSync === undefined || s.lipSync === q.lipSync) &&
      (!q.tag || s.tags.includes(q.tag)));
  }

  return {
    all, meta:Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'shots')),
    byId:id => byKey.get(id) || null,
    // 'drums' matches the stem; 'drums.hero', 'listener', 'wide'... match roles.
    byRole:(role, q = {}) => filter({...q, role}),
    byStem:(stem, q = {}) => filter({...q, stem}),
    byAction:(action, q = {}) => filter({...q, action}),
    byShotType:(shotType, q = {}) => filter({...q, shotType}),
    byCharacter:(character, q = {}) => filter({...q, character}),
    reversible:(q = {}) => filter({...q, reversible:true}),
    mirrorable:(q = {}) => filter({...q, mirrorable:true}),
    filter,
  };
}

let loaded;
export function loadShots() {
  return loaded ||= import('./shots.json').then(m => createShotIndex(m.default || m));
}
