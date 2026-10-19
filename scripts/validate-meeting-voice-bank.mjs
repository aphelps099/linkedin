// Technical release validation is explicit; it is not an individual listening review.
import assert from 'node:assert/strict';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildLibrary,takeKey} from '../src/meeting-room/voice-bank/library.js';
const bank=buildLibrary(),path='public/studio/voices/recordings.json';
const recordings=JSON.parse(await readFile(path,'utf8'));
const sha=data=>createHash('sha256').update(data).digest('hex');
const counts={};
for(const line of bank.lines){
  const profile=bank.characters[line.character];
  if(profile.kind!=='human')continue;
  assert.equal(profile.status,'approved');
  const key=takeKey(line,profile,recordings.rendererByCharacter[line.character]),take=recordings.takes[key];
  assert(take,`Missing ${line.id}`);
  assert.equal(take.character,line.character);assert.equal(take.line,line.id);assert.equal(take.voiceVersion,profile.version);
  for(const [file,hash] of [[take.master,take.masterSha256],[`public/studio/voices/${take.file}`,take.audioSha256]]){
    assert.equal(sha(await readFile(file)),hash,`Changed recording: ${file}`);
    const raw=execFileSync('ffmpeg',['-v','error','-i',file,'-f','f32le','-ac','1','-ar','24000','pipe:1'],{maxBuffer:8*1024*1024});
    assert(Math.abs(raw.length/4/24000-take.duration)<.1,`Duration mismatch: ${line.id}`);
    let peak=0,energy=0,active=0;
    for(let i=0;i<raw.length;i+=4){const value=raw.readFloatLE(i);assert(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));energy+=value*value;if(Math.abs(value)>.005)active++;}
    assert(peak<.999&&Math.sqrt(energy/(raw.length/4))>.005&&active>2400,`Clipping/silence: ${line.id}`);
  }
  assert(take.level.length>0&&Math.abs(take.level.length-take.duration*25)<=1);
  assert(take.level.every(v=>Number.isInteger(v)&&v>=0&&v<=100));
  const audition=recordings.auditions[line.character];
  const heard=audition.takes.includes(key);
  take.status=heard?'approved':'validated';
  take.validation={decode:true,hashes:true,levels:true,identity:true};
  take.review={casting:'user-approved-2026-10-19',listening:heard?'approved-audition':'not-individually-reviewed',release:'map-approved-voices-2026-10-19'};
  counts[line.character]=(counts[line.character]||0)+1;
}
for(const audition of Object.values(recordings.auditions)){audition.status='approved';audition.approvedAt='2026-10-19';}
recordings.release={date:'2026-10-19',scope:'14 authored meetings',counts};
await writeFile(`${path}.tmp`,JSON.stringify(recordings,null,2)+'\n');await rename(`${path}.tmp`,path);
console.log('Approved cast / technically validated recordings:',counts);
