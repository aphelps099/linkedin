// Render missing player clips from the site's existing, approved recordings.
// Run from the repository root. Set FFMPEG when it is not on PATH.
import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {CUTS, clipKeys} from '../src/optimizer/cuts.js';
import {loadVoices, sing} from '../src/allhands/voices/voice-table.js';

const root=new URL('../',import.meta.url);
const destination=new URL('public/optimizer/audio/',root);
const metadata=new URL('src/optimizer/clips.json',root);
const bank=JSON.parse(await readFile(metadata,'utf8'));
const lady=JSON.parse(await readFile(new URL('src/allhands/lady-phrases.json',root),'utf8'));
await mkdir(destination,{recursive:true});

function ffmpeg(args,input){
 const run=spawnSync(process.env.FFMPEG||'ffmpeg',['-hide_banner','-loglevel','error',...args],{input,maxBuffer:16e6});
 if(run.error)throw run.error;
 if(run.status!==0)throw Error(run.stderr.toString());
 return run.stdout;
}
function normalize(samples){
 let peak=0,energy=0,count=0;
 for(const value of samples){peak=Math.max(peak,Math.abs(value));if(Math.abs(value)>.004){energy+=value*value;count++;}}
 if(!peak||!count)throw Error('A voice clip is silent.');
 const gain=Math.min(.89/peak,.15/Math.sqrt(energy/count));
 return Float32Array.from(samples,value=>value*gain);
}
async function encode(key,raw,words){
 const samples=normalize(raw);
 const encoded=ffmpeg(['-f','f32le','-ar','44100','-ac','1','-i','pipe:0','-c:a','libmp3lame','-b:a','80k','-write_xing','0','-f','mp3','pipe:1'],Buffer.from(samples.buffer));
 await writeFile(new URL(key+'.mp3',destination),encoded);
 bank[key]={duration:samples.length/44100,words:words.map(word=>({text:word.text,start:+word.start.toFixed(3),end:+word.end.toFixed(3)})),url:'/optimizer/audio/'+key+'.mp3'};
}
let added=0;
for(const key of new Set(CUTS.flatMap(clipKeys))){
 if(bank[key]){try{await access(new URL(key+'.mp3',destination));continue;}catch{}}
 if(/^lady-\d+$/.test(key)){
  const file=key.slice(5)+'.wav',entry=lady.find(item=>item.file===file);
  if(!entry)throw Error('Missing Lady recording: '+key);
  const bytes=ffmpeg(['-i',new URL('public/phrases/'+file,root).pathname,'-ar','44100','-ac','1','-f','f32le','pipe:1']);
  await encode(key,new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),entry.words);
 }else if(/^(strategy|synthia)-/.test(key)){
  const file=key.replace(/^(strategy|synthia)-/,'$1/')+'.flac';
  const takes=await loadVoices([file],{read:async name=>new Uint8Array(await readFile(new URL('public/allhands/voices/'+name,root)))});
  const take=takes.get(file),sung=sing(take,{key:'D',seed:44,end:key.endsWith('-call')?'open':'home'});
  await encode(key,sung.samples,take.entry.words);
 }else throw Error('Restore the retained custom clip before rendering: '+key);
 added++;
 console.log('Prepared '+key);
}
await writeFile(metadata,JSON.stringify(bank,null,2)+'\n');
console.log(`${added} new voice files; ${CUTS.length} player selections.`);
