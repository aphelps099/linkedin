import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {buildLibrary} from '../src/meeting-room/voice-bank/library.js';

const directory=fileURLToPath(new URL('../public/studio/voices/',import.meta.url));
await mkdir(directory,{recursive:true});
const library=buildLibrary();
await writeFile(`${directory}/catalog.json`,JSON.stringify(library,null,2)+'\n');
console.log(`${library.lines.length} unique character lines; ${Object.keys(library.meetings).length} complete meeting scripts; 7 human casting auditions.`);
