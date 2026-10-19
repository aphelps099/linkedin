// Compile only reviewed human takes for the existing season renderer.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildLibrary,productionTake} from '../src/meeting-room/voice-bank/library.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const bank=buildLibrary();
const recordings=JSON.parse(await readFile(resolve(root,'public/studio/voices/recordings.json'),'utf8'));
const result={version:1,characters:{},lines:{}};
const needed=bank.lines.filter(line=>bank.characters[line.character].kind==='human'&&line.usages.some(use=>use.type!=='audition'));
for(const line of needed){
  const profile=bank.characters[line.character];
  const take=productionTake(line,profile,recordings.takes,recordings.rendererByCharacter[line.character]);
  result.characters[line.character]=profile.version;
  result.lines[JSON.stringify([line.character,line.text])]={file:take.master,character:line.character,text:line.text,status:take.status};
}
const destination=process.argv[2];
if(!destination) throw new Error('Pass an export path. Example: /tmp/approved-meeting-voices.json');
await writeFile(destination,JSON.stringify(result,null,2)+'\n');
console.log(`Exported ${needed.length} reviewed human lines to ${destination}. Robot delivery is preserved.`);
