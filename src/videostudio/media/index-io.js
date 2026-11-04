// Read and write src/videostudio/media/shots.json. Pure: no fs, no DOM.
//
// Layout: header fields one per line, then one shot per line, so a rebuild
// diffs per shot. scripts/build-shot-index.py writes the same bytes
// (write_index); scripts/check-shot-index.mjs checks that a parse and rewrite
// round-trips exactly.

export const ROUTE = '/api/videostudio/media/';
export const PROXY_RECIPE = 'h264-high-540-crf20-g12-bf0-v1';

// The band and the people who share their video call.
export const BAND = ['Kevin', 'Keys', 'Operations', 'Synergy', 'Synthia', 'Arjun', 'Linda', 'People & Culture', 'Strategy', 'Printer'];
const PROXY_CATEGORIES = new Set(['Instruments', 'Office scenes', 'Screen inserts']);

// Which shots get 540p proxies: every season plate, every Instruments, Office
// scenes and Screen inserts take, and every performance by a band member.
export function wantsProxy(shot) {
  if (shot.kind === 'plate') return true;
  if (PROXY_CATEGORIES.has(shot.category)) return true;
  return shot.category === 'Character performances' && shot.characters.some(c => BAND.includes(c));
}

export function proxyKeys(entry) {
  return {fwd:entry.fwd, rev:entry.rev, poster:entry.poster};
}

export function readIndex(text) {
  const {shots, ...meta} = JSON.parse(text);
  return {meta, shots};
}

export function writeIndex({meta, shots}) {
  const lines = ['{'];
  for (const [k, v] of Object.entries(meta)) lines.push(`${JSON.stringify(k)}:${JSON.stringify(v)},`);
  lines.push('"shots":[');
  shots.forEach((s, i) => lines.push(JSON.stringify(s) + (i < shots.length - 1 ? ',' : '')));
  lines.push(']}');
  return lines.join('\n') + '\n';
}
