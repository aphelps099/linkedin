import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const exec = promisify(execFile);
export const robotKey = text => createHash('sha256').update(text.toLowerCase().replace(/[^\p{L}\p{N}' -]/gu,'').replace(/\s+/g,' ').trim()).digest('hex');

export async function beatRobot(text){
  // Preserve the familiar Fred takes on every platform. New phrases use Fred
  // on macOS and a portable, deliberately mechanical formant voice on Linux.
  try { return await readFile(new URL(`./beat-bank/${robotKey(text)}.wav`,import.meta.url)); }
  catch(error){ if(error.code!=='ENOENT')throw error; }
  const dir=await mkdtemp(join(tmpdir(),'linkedin-voice-'));
  try{
    const input=join(dir,'line.txt'),output=join(dir,'voice.wav');
    await writeFile(input,text,'utf8');
    if(process.platform==='darwin'){
      await exec('/usr/bin/say',['-v','Fred','-r','154','-f',input,'-o',output,'--file-format=WAVE','--data-format=LEI16@22050'],{timeout:15000});
    }else{
      await exec('espeak-ng',['-v','en-us','-s','154','-p','35','-a','125','-f',input,'-w',output],{timeout:15000});
    }
    return await readFile(output);
  }finally{await rm(dir,{recursive:true,force:true});}
}
