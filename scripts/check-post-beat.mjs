import assert from 'node:assert/strict';
import {generateStage} from '../src/lessons/stages.js';
import {extractPost,makeRecipe,voiceLines,arrangement,DURATION,encodeRecipe,decodeRecipe} from '../src/post-beat/composition.js';
const categories={announce:{kind:'A new hire',name:'Sarah',role:'Designer',company:'Acme',quality:'kindness',goal:'build useful things'},lesson:{source:'A stranger at the airport',moment:'A stranger shared his sandwich',lesson:'Generosity scales',topic:'B2B sales'},sell:{offer:'pipeline consulting',customer:'Dana',problem:'a leaky funnel',result:'312% more leads',cta:'DM me'},urgency:{kind:"We’re hiring",thing:'a Senior Designer',scarcity:'48 hours',audience:'designers'},ai:{tool:'ChatGPT',task:'write our board deck',multiplier:'10x',doomed:'consulting'}};
let count=0;
for(const [category,answers] of Object.entries(categories))for(const seed of [1,42,777,2026])for(const stage of ['standard','supercharged']){
  const {text}=generateStage({category,answers,seed,stage});
  const {choruses,keywords}=extractPost(text);
  assert(choruses.length>0&&keywords.length>0&&keywords.length<=4);
  for(const chorus of choruses)assert(text.includes(chorus),'chorus must be a real post excerpt');
  for(const keyword of keywords)assert(text.toLowerCase().includes(keyword.toLowerCase()),'keywords must come from the post');
  const recipe=makeRecipe(text);assert.deepEqual(decodeRecipe('#mix='+encodeRecipe(recipe)),recipe);
  assert(voiceLines(recipe).every(v=>v.text.length<=180));
  assert(voiceLines(recipe).some(v=>v.role==='robot')&&voiceLines(recipe).some(v=>v.role==='announcer'));
  for(const event of arrangement(recipe)){assert(event.clip<voiceLines(recipe).length);assert((event.beat+event.length)*60/recipe.bpm<=DURATION);}
  count++;
}
const unicode=makeRecipe('Zoë joins the team. Welcome to the journey, Zoë.');
assert.deepEqual(decodeRecipe('#mix='+encodeRecipe(unicode)),unicode);
assert.equal(decodeRecipe('#mix=bad'),null);
assert.equal(decodeRecipe('#mix='+encodeRecipe({...unicode,bpm:10000})),null);
assert.equal(decodeRecipe('#mix='+encodeRecipe({...unicode,keywords:[]})),null);
assert.equal(decodeRecipe('#mix='+encodeRecipe({...unicode,chorus:'x'.repeat(300)})),null);
console.log(`${count} post-to-song fixtures passed: exact excerpts, two voices, 30-second arrangement, stable preview links, invalid-link rejection.`);
