// The songs a post can become. Each form arranges the same lyrics and voice.
import {arrange, voicedWords, SECTIONS} from './song.js';
import {arrangeDrop, dropVoicedWords, DROP_SECTIONS} from './drop.js';

export const FORMS = {
  drop60:{id:'drop60', title:'Drop edition', note:'60 s · the lady builds, the room drops', arrange:arrangeDrop, voiced:dropVoicedWords, sections:DROP_SECTIONS},
  soundcheck:{id:'soundcheck', title:'Sound check 00', note:'56 s · the original band', arrange, voiced:voicedWords, sections:SECTIONS},
};
export const DEFAULT_FORM = 'drop60';

// The 16th that contains a moment, from the plan's swing-aware timing table.
export function stepAt(plan, seconds) {
  const t = plan.timing;
  let lo = 0, hi = Math.min(t.length - 1, plan.totalSteps);
  if (seconds < t[0]) return -1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (t[mid] <= seconds) lo = mid; else hi = mid - 1; }
  return lo;
}
