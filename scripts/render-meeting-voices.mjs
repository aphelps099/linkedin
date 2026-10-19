// Offline casting / line-bank renderer. Never invoked by a page view.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,mkdtemp,rename,rm,open,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {KokoroTTS} from 'kokoro-js';
import {StyleTextToSpeech2Model,AutoTokenizer,env} from '@huggingface/transformers';
import {buildLibrary,takeKey} from '../src/meeting-room/voice-bank/library.js';

const mode=process.argv[2]||'--auditions';
if(!['--auditions','--approved'].includes(mode)) throw new Error('Use --auditions or --approved');
const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'public/studio/voices');
const masters=resolve(root,'assets/meeting-voices/masters');
const manifestPath=resolve(output,'recordings.json');
const lockPath=resolve(root,'assets/meeting-voices/render.lock');
await mkdir(masters,{recursive:true});
await mkdir(resolve(output,'audio'),{recursive:true});
await mkdir(resolve(output,'auditions'),{recursive:true});
const lock=await open(lockPath,'wx').catch(()=>{throw new Error('Voice render already running. If it was interrupted, remove assets/meeting-voices/render.lock after checking the process.');});
await lock.close();
const temporary=await mkdtemp(resolve(tmpdir(),'meeting-voices-'));
const sha=data=>createHash('sha256').update(data).digest('hex');
const hashFile=async path=>sha(await readFile(path));
const ff=(...args)=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});
const atomicJson=async(path,value)=>{await writeFile(`${path}.tmp`,JSON.stringify(value,null,2)+'\n');await rename(`${path}.tmp`,path);};

try {
  const bank=buildLibrary();
  const wanted=new Set(mode==='--auditions'?Object.values(bank.auditions).flat():bank.lines.filter(line=>
    bank.characters[line.character].kind==='human'&&bank.characters[line.character].status==='approved').map(line=>line.id));
  if(!wanted.size) throw new Error('No approved human cast. Review the auditions before rendering the production bank.');
  const modelId='onnx-community/Kokoro-82M-v1.0-ONNX';
  console.log('Loading the local human speech model…');
  const [model,tokenizer]=await Promise.all([
    StyleTextToSpeech2Model.from_pretrained(modelId,{dtype:'q8',device:'cpu',session_options:{
      intraOpNumThreads:2,interOpNumThreads:1,extra:{session:{intra_op:{allow_spinning:'0'},inter_op:{allow_spinning:'0'}}},
    }}), AutoTokenizer.from_pretrained(modelId),
  ]);
  const tts=new KokoroTTS(model,tokenizer);
  const cache=resolve(env.cacheDir,modelId);
  const kokoroDirectory=resolve(dirname(fileURLToPath(import.meta.resolve('kokoro-js'))),'..');
  const identity={provider:'local-kokoro',modelId,dtype:'q8',kokoroVersion:'1.2.1',transformersVersion:'3.8.1',
    modelSha256:await hashFile(resolve(cache,'onnx/model_quantized.onnx')),
    tokenizerSha256:await hashFile(resolve(cache,'tokenizer.json')),
    configSha256:await hashFile(resolve(cache,'config.json')),
    processing:'mono-24k-loudnorm-minus20-tp-minus2-v1'};
  let manifest={version:1,rendererByCharacter:{},takes:{},auditions:{}};
  try {manifest=JSON.parse(await readFile(manifestPath,'utf8'));} catch(error) {if(error.code!=='ENOENT') throw error;}
  const selected=bank.lines.filter(line=>wanted.has(line.id));
  for(const [index,line] of selected.entries()) {
    const profile=bank.characters[line.character];
    if(profile.provider!=='local-kokoro') throw new Error('This renderer must never replace the established robot voices.');
    const renderer={...identity,voiceDataSha256:await hashFile(resolve(kokoroDirectory,`voices/${profile.voice}.bin`))};
    manifest.rendererByCharacter[line.character]=renderer;
    const key=takeKey(line,profile,renderer);
    const audioPath=resolve(output,`audio/${key}.mp3`);
    const masterPath=resolve(masters,`${key}.flac`);
    const existing=manifest.takes[key];
    if(existing) {
      const valid=await Promise.all([hashFile(audioPath),hashFile(masterPath)]).catch(()=>[]);
      if(valid[0]===existing.audioSha256&&valid[1]===existing.masterSha256) {
        console.log(`Cached ${index+1}/${selected.length}: ${line.character}`);
        continue;
      }
    }
    const audio=await tts.generate(line.spokenText,{voice:profile.voice,speed:profile.speed});
    await writeFile(resolve(temporary,'raw.wav'),Buffer.from(audio.toWav()));
    ff('-i',resolve(temporary,'raw.wav'),'-af','loudnorm=I=-20:TP=-2:LRA=7','-ar','24000','-ac','1','-c:a','flac',resolve(temporary,'master.flac'));
    ff('-i',resolve(temporary,'master.flac'),'-c:a','libmp3lame','-b:a','96k',resolve(temporary,'line.mp3'));
    const raw=ff('-i',resolve(temporary,'master.flac'),'-f','f32le','-acodec','pcm_f32le','pipe:1');
    const samples=Float32Array.from({length:raw.length/4},(_,i)=>raw.readFloatLE(i*4));
    let peak=0,energy=0;
    for(const sample of samples){peak=Math.max(peak,Math.abs(sample));energy+=sample*sample;}
    const rms=Math.sqrt(energy/samples.length),duration=samples.length/24000;
    if(!Number.isFinite(rms)||rms<.005||peak>=.999||duration<.2||duration>30) throw new Error(`Invalid audio for ${line.id}`);
    const levels=[];
    for(let i=0;i<samples.length;i+=960){let sum=0,n=Math.min(960,samples.length-i);for(let j=0;j<n;j++)sum+=samples[i+j]**2;levels.push(Math.sqrt(sum/n));}
    const ceiling=Math.max(.02,[...levels].sort((a,b)=>a-b)[Math.floor(levels.length*.93)]);
    await writeFile(`${masterPath}.tmp`,await readFile(resolve(temporary,'master.flac')));
    await rename(`${masterPath}.tmp`,masterPath);
    await writeFile(`${audioPath}.tmp`,await readFile(resolve(temporary,'line.mp3')));
    await rename(`${audioPath}.tmp`,audioPath);
    manifest.takes[key]={line:line.id,character:line.character,voiceVersion:profile.version,status:'needs-listening',
      file:`audio/${key}.mp3`,master:`assets/meeting-voices/masters/${key}.flac`,
      duration,sampleRate:24000,envelopeHz:25,level:levels.map(v=>Math.round(Math.min(1,v/ceiling)*100)),
      peak,rms,audioSha256:await hashFile(audioPath),masterSha256:await hashFile(masterPath)};
    await atomicJson(manifestPath,manifest);
    console.log(`Rendered ${index+1}/${selected.length}: ${line.character} · ${duration.toFixed(1)}s`);
  }
  if(mode==='--auditions') {
    for(const [character,ids] of Object.entries(bank.auditions)) {
      const paths=ids.map(id=>{
        const line=bank.lines.find(l=>l.id===id),key=takeKey(line,bank.characters[character],manifest.rendererByCharacter[character]);
        return {id,key,take:manifest.takes[key]};
      });
      const inputs=paths.flatMap(({take})=>['-i',resolve(root,take.master)]);
      const filters=paths.map((_,i)=>`[${i}:a]apad=pad_dur=0.45[p${i}]`).join(';')+';'+paths.map((_,i)=>`[p${i}]`).join('')+`concat=n=${paths.length}:v=0:a=1[out]`;
      ff(...inputs,'-filter_complex',filters,'-map','[out]','-c:a','libmp3lame','-b:a','128k',resolve(temporary,'audition.mp3'));
      const file=`auditions/${character}.mp3`;
      await writeFile(resolve(output,`${file}.tmp`),await readFile(resolve(temporary,'audition.mp3')));
      await rename(resolve(output,`${file}.tmp`),resolve(output,file));
      manifest.auditions[character]={file,lines:ids,takes:paths.map(p=>p.key),status:'candidate',
        duration:paths.reduce((sum,p)=>sum+p.take.duration+.45,0),sha256:await hashFile(resolve(output,file))};
    }
  }
  await atomicJson(manifestPath,manifest);
  await atomicJson(resolve(output,'catalog.json'),bank);
  console.log(`Complete: ${Object.keys(manifest.takes).length} cached takes. Casting and listening approval remain separate from rendering.`);
} finally {
  await rm(temporary,{recursive:true,force:true});
  await rm(lockPath,{force:true});
}
