import {generate,mulberry32} from './generator.js';
import {scorePost} from './score.js';

// Tune the composition, never the displayed score. Unusually long or jargon-heavy
// answers can land outside these targets; their actual measured score still wins.
const STANDARD_CLOSINGS = [
  '',
  'Grateful for everyone who made this possible.',
  'Excited for the next chapter.',
  'Grateful for the journey so far. Excited for what comes next.',
];
const TURBO_CLOSINGS = ['', 'This is what synergy looks like.'];

export function generateStage({category,answers,seed,stage='standard',minimumScore=0}){
  const turbo=stage==='supercharged';
  const target=Math.max(turbo?93:63,minimumScore);
  const rng=mulberry32(seed);
  let best;
  let distance=Infinity;
  // A bounded search keeps editing responsive. Only generated dressing and
  // hashtags vary; the user's facts always go through the category builder.
  for(let attempt=0;attempt<4;attempt++){
    const candidateSeed=attempt===0?seed:Math.floor(rng()*0xffffffff);
    const paragraphs=generate({category,answers,seed:candidateSeed,level:turbo?5:3}).split('\n\n');
    const tags=paragraphs.pop().split(' ');
    for(const closing of turbo?TURBO_CLOSINGS:STANDARD_CLOSINGS){
      for(let count=tags.length;count>=1;count--){
        const text=[...paragraphs,closing,tags.slice(0,count).join(' ')].filter(Boolean).join('\n\n');
        const score=scorePost(text);
        const delta=Math.abs(score.index-target)+(score.index<minimumScore?100:0);
        if(delta<distance){best={text,score};distance=delta;}
        if(distance===0)return best;
      }
    }
  }
  return best;
}
