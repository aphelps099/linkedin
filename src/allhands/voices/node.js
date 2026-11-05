// Node only: read the published voice bank from disk, for render scripts and
// checks. In the page, voice-table.js loadVoices fetches the same files.
//   const takes = await loadVoices(files, {read:readVoice()});
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export const PUBLIC_VOICES = fileURLToPath(new URL('../../../public/allhands/voices/', import.meta.url));
export const readVoice = (dir = PUBLIC_VOICES) => async file => new Uint8Array(await readFile(dir.replace(/\/?$/, '/') + file));
