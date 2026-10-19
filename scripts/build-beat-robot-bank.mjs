// Run on macOS when intentionally updating the approved Fred sample bank.
import {mkdir,writeFile} from 'node:fs/promises';
import {beatRobot,robotKey} from '../server/beat-robot.js';
if(process.platform!=='darwin')throw new Error('Record Fred on macOS.');
const lines=[
  'next chapter','humbled','honored','thrilled','journey','leadership','synergy',
  'alignment','growth','momentum','impact','purpose','innovation','community',
  'transformation','grateful','opportunity','future','team','proud','excited',
  'Sarah','Jordan','Taylor','Dana','Circle Back','LinkedIn','ChatGPT',
  'The next chapter starts now.','A new chapter begins today.',
  'The story continues — louder.','The journey continues.',
  'The best is ahead of us.','Growth is a team sport.','Momentum is a choice.',
  'Excited for the next chapter.','Grateful for the journey so far.',
  "The future doesn't wait. Neither should you.",
  'Welcome to the movement.','Welcome to the journey, Sarah.',
  'Welcome to the journey, Jordan.','Together, we will make Fridays feel like Fridays.',
  "I'm thrilled to announce our next chapter.",
];
const directory=new URL('../server/beat-bank/',import.meta.url);
await mkdir(directory,{recursive:true});
for(const text of lines)await writeFile(new URL(`${robotKey(text)}.wav`,directory),await beatRobot(text));
await writeFile(new URL('manifest.json',directory),JSON.stringify({voice:'Fred',rate:154,sampleRate:22050,lines:lines.map(text=>({text,file:robotKey(text)+'.wav'}))},null,2)+'\n');
console.log(`Saved ${lines.length} original Fred recordings.`);
