import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildLibrary,lineId,takeKey,productionTake} from '../src/meeting-room/voice-bank/library.js';
import {library} from '../src/meeting-room/scripts.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const bank=buildLibrary();
const stored=JSON.parse(await readFile(resolve(root,'public/studio/voices/catalog.json'),'utf8'));
assert.deepEqual(stored,bank,'Published catalog must match the authored source');
assert.equal(new Set(bank.lines.map(line=>line.id)).size,bank.lines.length);
for(const [agenda,variants] of Object.entries(library)) for(const [index,meeting] of variants.entries()){
  const saved=bank.meetings[`${agenda}-${index}`];
  assert.equal(saved.cues.length,meeting.lines.length);
  saved.cues.forEach((cue,i)=>{
    const [speaker,text]=meeting.lines[i];
    assert.equal(cue.speaker,speaker);
    if(speaker==='all'){
      for(const phrase of cue.phrases){
        assert(!phrase.printer&&!phrase.droid&&!phrase.pat,'Silent characters must never speak');
        for(const [who,id] of Object.entries(phrase)) assert.equal(bank.lines.find(line=>line.id===id).character,who);
      }
    } else assert.equal(bank.lines.find(line=>line.id===cue.line).text,text);
  });
}
const recordings=JSON.parse(await readFile(resolve(root,'public/studio/voices/recordings.json'),'utf8'));
let count=0;
const expectedHash=data=>createHash('sha256').update(data).digest('hex');
for(const [who,ids] of Object.entries(bank.auditions)) {
  assert.equal(ids.length,3);
  const profile=bank.characters[who],renderer=recordings.rendererByCharacter[who];
  for(const id of ids){
    const line=bank.lines.find(line=>line.id===id);
    const key=takeKey(line,profile,renderer),take=recordings.takes[key];
    assert(take,`Missing audition ${id}`);
    assert.equal(take.character,who);
    assert.equal(take.line,id);
    assert(take.duration>.2&&take.rms>.005&&take.peak<.999);
    assert(Math.abs(take.level.length-take.duration*25)<=1);
    assert(take.level.every(level=>Number.isInteger(level)&&level>=0&&level<=100));
    for(const [path,hash] of [[`public/studio/voices/${take.file}`,take.audioSha256],[take.master,take.masterSha256]]) {
      assert.equal(expectedHash(await readFile(resolve(root,path))),hash,`Hash mismatch: ${path}`);
      execFileSync('ffmpeg',['-v','error','-i',resolve(root,path),'-f','null','-'],{stdio:'pipe'});
    }
    assert.notEqual(takeKey(line,{...profile,speed:profile.speed+.1},renderer),key);
    assert.notEqual(takeKey({...line,spokenText:line.spokenText+' Again.'},profile,renderer),key);
    assert.notEqual(takeKey(line,profile,{...renderer,modelSha256:'different-weights'}),key);
    assert.throws(()=>productionTake(line,{...profile,status:'candidate'},recordings.takes,renderer),/casting not approved/);
    assert.throws(()=>productionTake(line,{...profile,status:'approved'},{[key]:{...take,status:'needs-listening'}},renderer),/Recording not approved/);
    assert.throws(()=>productionTake(line,profile,{[key]:{...take,status:'validated',validation:{}}},renderer),/Recording not approved/);
    const approved={...take,status:'approved'};
    assert.equal(productionTake(line,{...profile,status:'approved'},{[key]:approved},renderer),approved);
    count++;
  }
  const audition=recordings.auditions[who];
  assert.deepEqual(audition.lines,ids);
  const path=resolve(root,`public/studio/voices/${audition.file}`);
  assert.equal(expectedHash(await readFile(path)),audition.sha256);
  execFileSync('ffmpeg',['-v','error','-i',path,'-f','null','-'],{stdio:'pipe'});
}
assert.equal(count,21);
assert.equal(lineId('keys',' A  small update. '),lineId('keys','A small update.'));
assert.notEqual(lineId('keys','A small update.'),lineId('people','A small update.'));
assert.equal(new Set(Object.values(bank.characters).filter(p=>p.kind==='human').map(p=>p.voice)).size,7);
const season=JSON.parse(await readFile(resolve(root,'src/meeting-room/audio-manifest.json'),'utf8'));
let mapped=0;
for(const [id,meeting] of Object.entries(bank.meetings)){
  const rendered=season.meetings[id];
  for(const [index,cue] of meeting.cues.entries()){
    const expected=cue.speaker==='all'?cue.phrases.flatMap(phrase=>Object.values(phrase)):[cue.line];
    assert.equal(rendered.cues[index].sources.length,expected.length);
    for(const [i,lineId] of expected.entries()){
      const line=bank.lines.find(l=>l.id===lineId),profile=bank.characters[line.character],source=rendered.cues[index].sources[i];
      assert.equal(source.character,line.character);assert.equal(source.text,line.text);
      if(profile.kind==='robot'){assert.equal(source.voice,profile.voice);assert.equal(source.pitch,profile.pitch);continue;}
      assert.equal(season.voiceCast[line.character].voice,profile.voice);assert.equal(season.voiceCast[line.character].speed,profile.speed);
      const renderer=recordings.rendererByCharacter[line.character],take=productionTake(line,profile,recordings.takes,renderer);
      assert.equal(source.take,takeKey(line,profile,renderer));assert.equal(source.line,line.id);assert.equal(source.masterSha256,take.masterSha256);
      assert.equal(expectedHash(await readFile(resolve(root,take.master))),source.masterSha256);
      mapped++;
    }
  }
  const data=await readFile(resolve(root,`public/studio/season/audio/${rendered.voice}`));
  assert(rendered.voice.endsWith(`${expectedHash(data).slice(0,12)}.mp3`),'Voice URLs must change with their contents');
}
console.log(`Voice bank checked: ${bank.lines.length} indexed lines, ${mapped} human cue/chorus mappings across 14 scripts, 21 decoded auditions. Exact approved identities and timeline hashes verified.`);
