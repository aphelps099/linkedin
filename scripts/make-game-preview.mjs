// Rebuild the attract-mode route from the same level and physics as the game.
import {writeFileSync} from 'node:fs';
import {FLOORS,parseFloor,T} from '../src/game/level.js';
import {explore,goalsOf} from '../src/game/plan.js';
const floor=parseFloor(FLOORS[0]), goals=goalsOf(floor), cache=new Map(), legs=[];
let from=floor.spawn;
for(const goal of ['word:HUMBLED','word:JOURNEY','word:THRILLED','desk']){
  const result=explore(floor,from,goals,cache), route=result.route(goal);
  if(!route)throw new Error(`Game preview cannot reach ${goal}`);
  let at=result.start;
  for(const edge of route){legs.push({cx:at.cx,cy:at.cy,to:edge.to,recipe:edge.recipe});at=edge.to;}
  from={x:at.cx*T+T/2,y:at.cy*T};
}
writeFileSync(new URL('../src/game/preview-route.json',import.meta.url),JSON.stringify(legs)+'\n');
console.log(`Game preview: ${legs.length} moves through three phrases and the posting desk.`);
