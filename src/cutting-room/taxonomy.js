// The Cutting Room's vocabulary, shared by the page (main.jsx), the publish
// command and pack builder (scripts/lib/cutting-room.mjs) and the check
// (scripts/check-cutting-room.mjs). Plain data and pure helpers: no DOM, no Node.
//
// Schema v2 is additive. A record without `kind` is a video, a record without
// `aliases` has none, and so on: every field the page reads has a default here.

// Category pills, in order. "Everything" is the page's own first pill, not a category.
export const EVERYTHING = 'Everything';
export const CATEGORIES = ['Finished films', 'Songs', 'Character performances', 'Office scenes', 'Screen inserts', 'Instruments', 'Sounds', 'Experiments'];
export const PILLS = [EVERYTHING, ...CATEGORIES];
export const AUDIO_CATEGORIES = ['Songs', 'Sounds'];

// Where a record was made. The first value is primary (shown on cards); filters match any.
export const MADE_IN = ['Cutting Room originals', 'Studio and meeting rooms', 'Video Studio', 'All Hands', 'Claude Code films', "Aaron's tracks"];
export const STATUSES = ['Current edit', 'Available edit', 'Source take', 'Earlier version', 'Needs review'];
export const KINDS = ['video', 'audio', 'pack'];
export const ART = ['frame', 'triptych', 'type'];
// What a pack's items are grouped by (its group select reads "Every voice", "Every room"...).
export const GROUP_LABELS = ['Voice', 'Character', 'Agenda', 'Room', 'Song', 'Family', 'Film'];

export const kindOf = a => a?.kind || 'video';
export const madeInOf = a => (Array.isArray(a?.madeIn) ? a.madeIn : []);
export const aliasesOf = a => (Array.isArray(a?.aliases) ? a.aliases : []);
export const relatedOf = a => (Array.isArray(a?.related) ? a.related : a?.related ? [a.related] : []);
export const isPortrait = a => kindOf(a) === 'video' && a.width > 0 && a.height > a.width;

// Display: straight apostrophes in data ("Aaron's tracks") read as typographic ones on the page.
export const pretty = s => String(s ?? '').replace(/(\w)'(\w)/g, '$1\u2019$2');

// 75 -> "1:15", 3725 -> "1:02:05". Anything that is not a finite number gives "".
export function fmt(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n < 0) return '';
  const s = Math.floor(n), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

// "/songs/x-1a2b3c4d.mp3?download=1" -> "MP3"
export const extOf = url => (String(url ?? '').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1] || '').toUpperCase();

// The card chip: AUDIO / SILENT for video, SONG / SOUND for audio, PACK · 57 for packs.
export function chipOf(a) {
  const kind = kindOf(a);
  if (kind === 'pack') return `PACK \u00b7 ${a.count ?? 0}`;
  if (kind === 'audio') return a.category === 'Songs' ? 'SONG' : 'SOUND';
  return a.audio ? 'AUDIO' : 'SILENT';
}

// What the version select keeps: "current" hides earlier versions, "review" keeps only flagged ones.
export function inVersion(a, status) {
  if (status === 'all') return true;
  if (status === 'review') return a.status === 'Needs review';
  return a.status !== 'Earlier version';
}

const fold = s => String(s ?? '').toLowerCase().replace(/[\u2018\u2019]/g, "'");
// Everything search reads: words, people, where it was made, and every id it answers to.
export function searchText(a) {
  return fold([a.title, a.description, a.transcript, (a.tags || []).join(' '), (a.cast || []).join(' '),
    madeInOf(a).join(' '), a.id, aliasesOf(a).join(' '), a.category].join(' '));
}
export const matches = (a, query) => !query || searchText(a).includes(fold(query).trim());

// The hero: the featured record, or else the first Current edit video.
export function heroOf(assets) {
  return assets.find(a => a.featured && kindOf(a) === 'video')
    || assets.find(a => kindOf(a) === 'video' && a.status === 'Current edit')
    || assets.find(a => kindOf(a) === 'video') || assets[0];
}

// The newest records by `added` (ISO date), any kind, after the hero (already on show above the row) and
// without cuts that a newer one replaced. Ties keep catalog order (newest records go on top).
export function justMade(assets, n = 4) {
  const hero = heroOf(assets);
  return assets.map((a, i) => [a, i]).filter(([a]) => /^\d{4}-\d{2}-\d{2}/.test(a.added || '') && a !== hero && a.status !== 'Earlier version' && !a.replacedBy)
    .sort((x, y) => (y[0].added > x[0].added) - (y[0].added < x[0].added) || x[1] - y[1]).slice(0, n).map(([a]) => a);
}

// "#id", "#alias" or "#id/12" (a pack opened on its 12th row). A malformed link opens nothing.
export function parseHash(hash) {
  const h = String(hash ?? '').replace(/^#/, '');
  let raw; try { raw = decodeURIComponent(h); } catch { raw = h; }
  const m = raw.match(/^([a-z0-9][a-z0-9-]*)(?:\/(\d+))?$/);
  return m ? {key:m[1], row:m[2] ? Number(m[2]) : null} : {key:null, row:null};
}
export function indexById(assets) {
  const map = new Map();
  for (const a of assets) { map.set(a.id, a); for (const x of aliasesOf(a)) if (!map.has(x)) map.set(x, a); }
  return map;
}

// What a pack's items are called: the instruments are synthesised sounds, a song kit's items are its parts,
// everything else was recorded. itemNoun(a, 1) -> "recording", itemNoun(a, 54) -> "sounds".
const NOUNS = {Family:['sound', 'sounds'], Song:['part', 'parts']};
export const itemNoun = (a, n) => (NOUNS[a?.groupLabel] || ['recording', 'recordings'])[n === 1 ? 0 : 1];

// The hero's alt text: "Day One, film still" (a title's own full stop does not double up).
export const stillAlt = title => `${String(title ?? '').replace(/[.!?\s]+$/, '')}, film still`;

// Pack group select: "Every voice", "Every agenda"...
export const everyGroup = label => `Every ${String(label || 'group').toLowerCase()}`;
