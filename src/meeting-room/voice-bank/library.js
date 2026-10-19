import {createHash} from 'node:crypto';
import {library} from '../scripts.js';
import {characters, silentCharacters, auditionLines} from './characters.js';

export const normalizeText = text => text.normalize('NFC').replace(/\s+/g,' ').trim();
export const lineId = (character,text) => `${character}-${createHash('sha256').update(normalizeText(text)).digest('hex').slice(0,16)}`;

// A change to ANY acoustic input makes a new take. Editorial tags don't.
export function takeKey(line,profile,renderer) {
  return createHash('sha256').update(JSON.stringify({
    character:line.character,text:line.text,spokenText:line.spokenText,
    version:profile.version,provider:profile.provider,voice:profile.voice,
    speed:profile.speed,pitch:profile.pitch,renderer,
  })).digest('hex');
}

export function buildLibrary() {
  const lines=new Map();
  const add=(character,text,usage)=>{
    if(!characters[character]) throw new Error(`No voice identity for ${character}`);
    const normalized=normalizeText(text),id=lineId(character,normalized);
    if(!lines.has(id)) lines.set(id,{id,character,text:normalized,spokenText:normalized,
      scriptStatus:usage.type==='audition'?'draft':'authored',usages:[],tags:[]});
    const line=lines.get(id);
    line.usages.push(usage);
    if(usage.type!=='audition') line.scriptStatus='authored';
    line.tags=[...new Set([...line.tags,usage.type,usage.role,usage.agenda].filter(Boolean))];
    return id;
  };
  const meetings={};
  for(const [agenda,variants] of Object.entries(library)) {
    variants.forEach((meeting,variant)=>{
      const id=`${agenda}-${variant}`;
      meetings[id]={title:meeting.title,bpm:meeting.bpm,roster:meeting.roster,cues:meeting.lines.map(([speaker,text],index)=>{
        const role=index<2?'opening':index===6?'transition':index===7?'chorus':index===8?'button':'exchange';
        const usage={type:'meeting',meeting:id,agenda,index,role};
        if(speaker!=='all') return {speaker,line:add(speaker,text,usage)};
        // Short hook phrases are separate recordings. Dialogue remains whole sentences.
        const phrases=text.split('.').map(t=>t.trim()).filter(Boolean).map(t=>`${t}.`);
        return {speaker,text,phrases:phrases.map((phrase,phraseIndex)=>Object.fromEntries(
          meeting.roster.filter(who=>!silentCharacters.includes(who)).map(who=>[
            who,add(who,phrase,{...usage,type:'chorus',phraseIndex}),
          ]),
        ))};
      })};
    });
  }
  const auditions=Object.fromEntries(Object.entries(auditionLines).map(([who,texts])=>[
    who,texts.map((text,index)=>add(who,text,{type:'audition',index,role:index===0?'shared-read':'character-read'})),
  ]));
  return {version:1,characters,lines:[...lines.values()],meetings,auditions};
}

export function productionTake(line,profile,recordings,renderer) {
  const key=takeKey(line,profile,renderer),take=recordings[key];
  if(!['approved','existing'].includes(profile.status)) throw new Error(`Voice casting not approved: ${line.character}`);
  if(!take||take.status!=='approved') throw new Error(`Recording not approved: ${line.id}`);
  if(take.line!==line.id||take.character!==line.character) throw new Error(`Recording identity mismatch: ${line.id}`);
  return take;
}
