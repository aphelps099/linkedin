// Professional Development Program checks — run with: node scripts/check-program.mjs
// The course is data: five chapters of typed steps that the player reveals
// one at a time. These checks pin the contract so a chapter can't ship with a
// live output that references nothing, a blank with no fallback, or an
// exercise that would throw when performed:
// 1. exactly five chapters, numbered 1–5, each earning the matching dial level;
// 2. every step has a known type and a chapter-unique id;
// 3. every live-output / score-card / beat-card / dial source resolves to an
//    EARLIER step of a type that can supply input;
// 4. every exercise blank has a placeholder; every intake category exists;
// 5. every performance actually runs on its example input and scores;
// 6. each chapter ends with chapter-end, and only the last one is final.
import {CHAPTERS} from '../src/program/chapters/index.js';
import {LESSON_PRESENTATION} from '../src/program/chapters/presentation.js';
import {existsSync} from 'node:fs';
import {INTERACTIVE, PASSIVE_DELAY, PERFORMS} from '../src/program/engine/types.js';
import {perform, score} from '../src/program/engine/performer.js';
import {byId, withDefaultAnswers} from '../src/lessons/categories.js';
import {loadProgress, saveProgress} from '../src/program/engine/progress.js';
// Example answers mirror src/lessons/Intake.jsx (JSX, so not importable here).
const EXAMPLES = {
  announce: {kind: 'A new hire', name: 'Jordan', role: 'Director of Vibes', before: 'a very long meeting', quality: 'an inbox at zero', goal: 'make Fridays feel like Fridays', company: 'Circle Back Inc.'},
  lesson: {source: 'A tiny everyday moment', moment: 'The office plant survived a three-day weekend', lesson: 'Sometimes growth just needs a little space', topic: 'Leadership'},
  sell: {offer: 'meeting reduction consulting', customer: 'Alex', problem: 'a calendar with no white space', result: '42% fewer meetings', cta: 'Send me the word OFFLINE'},
  urgency: {kind: 'Limited spots', thing: 'a workshop about having fewer workshops', scarcity: '3 seats', audience: 'people who have been on mute since Monday'},
  ai: {tool: 'ChatGPT', task: 'rewrite a three-word email', multiplier: '10x', doomed: 'the phrase per my last email'},
};
const ANNOUNCEMENT_EXAMPLES = {'A new hire': EXAMPLES.announce};

let failures = 0;
const fail = msg => { failures++; console.error('FAIL ' + msg); };

const KNOWN = new Set([...INTERACTIVE, ...Object.keys(PASSIVE_DELAY), 'prompt-card', 'score-card', 'before-after', 'divider']);
const SOURCES = new Set(['prompt-card', 'output-card', 'exercise-card', 'intake-card', 'dial', 'live-output']);

if(CHAPTERS.length !== 5) fail(`expected 5 chapters, found ${CHAPTERS.length}`);
CHAPTERS.forEach((ch, ci) => {
  const where = `chapter ${ch.id}`;
  if(ch.number !== ci + 1) fail(`${where}: number ${ch.number} should be ${ci + 1}`);
  if(ch.level !== ci + 1) fail(`${where}: level ${ch.level} should be ${ci + 1}`);
  if(!ch.title || !ch.subtitle || !ch.levelName || !ch.minutes) fail(`${where}: missing title/subtitle/levelName/minutes`);
  const presentation = LESSON_PRESENTATION[ch.id];
  if(!presentation?.heading || !presentation?.summary || !presentation?.format || !presentation?.image || !existsSync(new URL(`../public${presentation.image}`, import.meta.url))) fail(`${where}: missing presentation or artwork`);
  const ids = new Set();
  ch.steps.forEach((s, si) => {
    const at = `${where} step ${si} (${s.id})`;
    if(!s.id) fail(`${where} step ${si}: no id`);
    if(ids.has(s.id)) fail(`${at}: duplicate id`);
    ids.add(s.id);
    if(!KNOWN.has(s.type)) fail(`${at}: unknown type ${s.type}`);
    const earlier = ch.steps.slice(0, si);
    const resolve = (id, label) => {
      const src = earlier.find(e => e.id === id);
      if(!src) fail(`${at}: ${label} '${id}' is not an earlier step`);
      else if(!SOURCES.has(src.type)) fail(`${at}: ${label} '${id}' is a ${src.type}, which supplies no input`);
      return src;
    };
    switch(s.type){
      case 'bot-message': case 'synergy-tip': if(!s.content) fail(`${at}: empty content`); break;
      case 'live-output': {
        const src = resolve(s.source, 'source');
        if(!PERFORMS.has(s.performs || 'linkedinify')) fail(`${at}: unknown performs ${s.performs}`);
        if(src) try{
          const input = src.type === 'intake-card' ? {category: src.category, answers: withDefaultAnswers(src.category, EXAMPLES[src.category])}
            : src.type === 'prompt-card' ? src.prompt : src.type === 'exercise-card' ? src.template.replace(/\{\{(\w+)\}\}/g, (_, k) => src.blanks.find(b => b.id === k)?.defaultValue || '') : 'Today I made a cup of coffee.';
          const out = perform(s.performs || 'linkedinify', input, {seed: 7, level: s.level || 3});
          if(!out || !out.trim()) fail(`${at}: performance produced nothing`);
        }catch(e){ fail(`${at}: performance threw: ${e.message}`); }
        break;
      }
      case 'exercise-card':
        if(!s.template || !Array.isArray(s.blanks) || !s.blanks.length) fail(`${at}: needs template + blanks`);
        for(const b of s.blanks || []){
          if(!b.id || !b.label || !b.placeholder) fail(`${at}: blank ${b.id} needs id, label, placeholder`);
          if(!s.template.includes(`{{${b.id}}}`)) fail(`${at}: blank '${b.id}' not in template`);
        }
        for(const m of s.template.matchAll(/\{\{(\w+)\}\}/g)) if(!s.blanks.some(b => b.id === m[1])) fail(`${at}: template token {{${m[1]}}} has no blank`);
        if(s.performs && !PERFORMS.has(s.performs)) fail(`${at}: unknown performs ${s.performs}`);
        try{
          const filled = s.template.replace(/\{\{(\w+)\}\}/g, (_, k) => s.blanks.find(b => b.id === k).defaultValue || s.blanks.find(b => b.id === k).placeholder);
          const out = perform(s.performs || 'linkedinify', filled, {seed: 7, level: s.level || 3});
          if(!out.trim()) fail(`${at}: exercise performance produced nothing`);
        }catch(e){ fail(`${at}: exercise threw: ${e.message}`); }
        break;
      case 'intake-card': {
        const cat = byId(s.category);
        if(!cat?.steps) fail(`${at}: unknown category ${s.category}`);
        else{
          const example = s.category === 'announce' ? ANNOUNCEMENT_EXAMPLES['A new hire'] : EXAMPLES[s.category];
          const keys = cat.steps(example).map(f => f.key);
          for(const f of s.fields || []) if(!keys.includes(f)) fail(`${at}: field '${f}' is not in ${s.category}`);
          try{
            const out = perform('generate', {category: s.category, answers: example}, {seed: 7, level: s.level || 3});
            const sc = score(out);
            if(s.level === 5 && sc.index < 60) fail(`${at}: level 5 example scored only ${sc.index}`);
          }catch(e){ fail(`${at}: generate threw: ${e.message}`); }
        }
        break;
      }
      case 'dial': { const src = resolve(s.source, 'source'); if(src && src.type !== 'intake-card') fail(`${at}: dial source must be an intake-card`); break; }
      case 'score-card': case 'beat-card': resolve(s.source, 'source'); break;
      case 'spot-the-trope': {
        const lines = s.text.split('\n').map(l => l.trim()).filter(Boolean);
        for(const a of s.answers) if(!lines.includes(a.trim())) fail(`${at}: answer not a line of the text: ${a}`);
        if(!s.explanation) fail(`${at}: needs explanation`);
        break;
      }
      case 'video-recap':
        if(!s.title || !s.description || !/^\d+:\d{2}$/.test(s.duration || '')) fail(`${at}: needs recap title, description and duration`);
        if(!s.src?.startsWith('/api/cutting-room/media/') || !s.src.endsWith('.mp4')) fail(`${at}: recap needs a catalog video`);
        if(!s.poster?.startsWith('/cutting-room/posters/')) fail(`${at}: recap needs a poster`);
        if(!Array.isArray(s.recap) || s.recap.length!==3 || s.recap.some(line=>!line.trim())) fail(`${at}: recap needs three written takeaways`);
        break;
      case 'before-after': if(!s.before || !s.after) fail(`${at}: needs before + after`); break;
      case 'takeaway-card': if(!Array.isArray(s.takeaways) || s.takeaways.length !== 3) fail(`${at}: exactly three takeaways`); break;
      case 'chapter-end': if(si !== ch.steps.length - 1) fail(`${at}: chapter-end must be last`); break;
      default: break;
    }
  });
  const last = ch.steps[ch.steps.length - 1];
  if(last?.type !== 'chapter-end') fail(`${where}: must end with chapter-end`);
  if(!!last?.isFinal !== (ci === CHAPTERS.length - 1)) fail(`${where}: isFinal should be ${ci === CHAPTERS.length - 1}`);
  if(ci === 0 && !ch.steps.some(s => s.type === 'name-input')) fail(`${where}: the first chapter must ask for a name`);
});

// Existing learners keep v1 progress; malformed storage cannot unlock awards.
let stored=JSON.stringify({userName:'Alex',title:'Coordinator',currentChapter:1,completedChapters:['hook','hook','not-a-lesson'],posts:{hook:'A saved post'}});
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>stored,setItem:(_,value)=>{stored=value;}}});
const returning=loadProgress();
if(returning.userName!=='Alex' || returning.completedChapters.join(',')!=='hook' || returning.posts.hook!=='A saved post') fail('v1 learner progress did not migrate intact');
const next=saveProgress({completedChapters:['hook','inflation']},returning);
if(loadProgress().completedChapters.length!==2 || next.title!=='Coordinator') fail('chapter completion did not persist');
stored='{invalid';
if(loadProgress().completedChapters.length!==0) fail('invalid storage should start an incomplete course');
globalThis.localStorage.setItem=()=>{throw new Error('Storage blocked');};
const inMemory=saveProgress({title:'Director'},next);
if(inMemory.completedChapters.length!==2 || inMemory.userName!=='Alex') fail('blocked storage should retain in-memory course progress');
delete globalThis.localStorage;

if(failures){ console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log(`OK program: ${CHAPTERS.length} chapters, ${CHAPTERS.reduce((n, c) => n + c.steps.length, 0)} steps`);
