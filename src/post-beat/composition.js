import {normalizeMix} from './mix.js';
import {LINES} from '../home/tracks.js';
// A post supplies the words; the arrangement supplies the repetition.
export const BPM=96;
export const BARS=12;
export const DURATION=BARS*4*60/BPM;
const words=s=>s.match(/[\p{L}\p{N}’'-]+/gu)||[];
const buzzwords=['next chapter','humbled','honored','thrilled','journey','leadership','synergy','alignment','growth','momentum','impact','purpose','innovation','community','transformation','grateful','opportunity','future','team','proud','excited'];
export function extractPost(post){
  if(typeof post!=='string'||!post.trim())throw new Error('Write a post before making a beat.');
  const sentences=(post.match(/[^.!?\n]+[.!?]?/g)||[]).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));
  const candidates=sentences.filter(s=>words(s).length>=3&&words(s).length<=14&&s.length<=120);
  const score=s=>(/chapter|journey|starts|future|welcome|growth|momentum|together|movement|dream|becoming/i.test(s)?8:0)+(words(s).length>=4&&words(s).length<=9?5:0)-(/https?:|@/.test(s)?20:0);
  // Even the fallback remains an exact excerpt. Never invent a chorus.
  const choruses=[...new Set(candidates.sort((a,b)=>score(b)-score(a)))].slice(0,8);
  if(!choruses.length){const line=sentences[0]||post.trim();choruses.push(line.length<=120?line:line.slice(0,120).replace(/\s+\S*$/,''));}
  const keywords=[];
  const add=s=>{if(s&&s.length<=60&&keywords.length<4&&!keywords.some(k=>k.toLowerCase()===s.toLowerCase()))keywords.push(s);};
  // Keep one distinctive name when there is one, then familiar corporate words.
  const names=post.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g)||[];
  const generic=/^(I|We|They|The|This|That|It|My|Our|Your|Not|For|But|And|Let|Read|Take|Some|Ready|Good|Welcome|Great|Growth|Humbled|Honored|With|As|A|An|There|What|Three|Five|In|To|From|Today|Thank|Leadership|Momentum|When|Once|Everyone|Every|Together|Here|Now|People|One|First|Second|Sometimes|Never|Always|More|After|Before|At|So|Then|Cross|Best|Fully|Looking|Passion|Purpose|Excited|Thrilled|Grateful|Thank You|Next Chapter)$/;
  names.filter(s=>!generic.test(s)&&!post.includes('#'+s)&&!buzzwords.includes(s.toLowerCase())).slice(0,1).forEach(add);
  buzzwords.filter(w=>new RegExp(`\\b${w}\\b`,'i').test(post)).forEach(w=>add(post.match(new RegExp(`\\b${w}\\b`,'i'))[0]));
  if(keywords.length<4)words(choruses[0]).filter(w=>w.length>4).forEach(add);
  return {choruses,keywords:keywords.length?keywords:[choruses[0].slice(0,24).trim()]};
}
const canonical=text=>text.toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9' ]/g,'').replace(/\s+/g,' ').trim();
export function recordingFor(text){return Object.keys(LINES).map(Number).find(i=>canonical(LINES[i])===canonical(text));}
export function makeRecipe(post,index=0){
  const {choruses,keywords}=extractPost(post);
  const matches=Object.keys(LINES).map(Number).filter(i=>LINES[i].split(/\s+/).length>=3&&canonical(post).includes(canonical(LINES[i])));
  return {version:2,bpm:BPM,chorus:choruses[index%choruses.length],keywords,opening:matches[0]??1,answer:matches.find(i=>i!==matches[0])??14};
}
export function voiceLines(recipe){
  const chorusBank=recordingFor(recipe.chorus);
  const opening=recipe.opening??1,answer=recipe.answer??14;
  return [
    {text:recipe.chorus,role:'announcer',...(chorusBank===undefined?{}:{bank:chorusBank})},
    {text:recipe.chorus,role:'robot'},
    {text:LINES[opening],role:'announcer',bank:opening},
    {text:LINES[answer],role:'announcer',bank:answer},
    ...recipe.keywords.map(text=>{const bank=recordingFor(text);return {text,role:bank===undefined?'robot':'announcer',...(bank===undefined?{}:{bank})};}),
  ];
}
export function arrangement(recipe){
  const word=(at,i)=>({beat:at,clip:4+(i%recipe.keywords.length),length:1.8});
  return [{beat:0,clip:2,length:5.5},word(6,0),{beat:8,clip:0,length:7.5},
    {beat:16,clip:3,length:5.5},word(22,1),{beat:24,clip:1,length:7.5},
    word(32,2),word(34,3),{beat:36,clip:3,length:3.5},{beat:40,clip:0,length:7.5}];
}
export function encodeRecipe(recipe){return btoa(unescape(encodeURIComponent(JSON.stringify(recipe)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function decodeRecipe(hash){
  try{
    const raw=hash.replace(/^#mix=/,'');if(raw.length>2500)return null;
    const r=JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g,'+').replace(/_/g,'/')))));
    if(![1,2].includes(r.version)||r.bpm!==BPM||typeof r.chorus!=='string'||!r.chorus.trim()||r.chorus.length>120||!Array.isArray(r.keywords)||r.keywords.length<1||r.keywords.length>4||r.keywords.some(k=>typeof k!=='string'||!k.trim()||k.length>60))return null;
    if(r.version===2&&(!Number.isInteger(r.opening)||!Number.isInteger(r.answer)||!LINES[r.opening]||!LINES[r.answer]))return null;
    return {version:r.version,bpm:BPM,chorus:r.chorus,keywords:r.keywords,...(r.mix?{mix:normalizeMix(r.mix)}:{}),...(r.version===2?{opening:r.opening,answer:r.answer}:{})};
  }catch{return null;}
}
