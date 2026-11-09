// A transparent writing scaffold, not a generated claim about the learner.
export function makeHook(fact){
 const clean=fact.trim().replace(/[.!?]+$/,'');
 const verbs={made:'make',sent:'send',went:'go',had:'have',wrote:'write',read:'read',finished:'finish',started:'start',joined:'join',helped:'help',built:'build',fixed:'fix',learned:'learn',learnt:'learn',met:'meet',bought:'buy'};
 const match=clean.match(/^I (\w+) (.+)$/i);
 if(match&&verbs[match[1].toLowerCase()])return `I almost didn’t ${verbs[match[1].toLowerCase()]} ${match[2]}${/\b(today|yesterday|morning|night|week|month)$/i.test(clean)?'':' today'}.\n\nHere’s why that matters.`;
 return `${clean}.\n\nAn ordinary update? That’s what I thought, too.`;
}
export function cleanHookDraft(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 return {stage:['example','practice','takeaway','done'].includes(raw.stage)?raw.stage:'example',fact:typeof raw.fact==='string'?raw.fact.slice(0,400):'I made coffee.',post:typeof raw.post==='string'?raw.post.slice(0,1000):'',tried:raw.tried===true};
}
