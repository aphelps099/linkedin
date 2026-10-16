import assert from 'node:assert/strict';
import {FEED_SCENES, SCENE_DURATION, LOOP_DURATION, feedFrame} from '../src/home-experiments/feed-timeline.js';

assert.equal(FEED_SCENES.length,2);
assert.equal(feedFrame(2199).reactions,0,'leave time to read the post before the first click');
assert.equal(feedFrame(2200).reactions,1);
assert.deepEqual(feedFrame(6600).counts,[23,11,6]);
assert.equal(feedFrame(7000).comments,0,'comments start after the reaction burst');
for(const [time,count] of [[7100,1],[8800,2],[10500,3],[12200,4],[13900,5],[20000,5]]){
  assert.equal(feedFrame(time).comments,count);
  assert.equal(feedFrame(time+SCENE_DURATION).comments,count);
}
assert.equal(feedFrame(20000).leaving,false,'hold the completed conversation for reading');
assert.equal(feedFrame(20500).leaving,true);
assert.equal(feedFrame(SCENE_DURATION).sceneIndex,1);
assert.equal(feedFrame(SCENE_DURATION).reactions,0,'a new scene starts with fresh counts');
assert.equal(feedFrame(SCENE_DURATION).comments,0);
assert.deepEqual(feedFrame(LOOP_DURATION),feedFrame(0));
for(let time=0;time<LOOP_DURATION;time+=40){
  const frame=feedFrame(time);
  assert.equal(frame.counts.reduce((a,b)=>a+b),frame.reactions);
  assert(frame.reactions>=0&&frame.reactions<=40);
  assert(frame.comments>=0&&frame.comments<=5);
  assert.equal(FEED_SCENES[frame.sceneIndex].comments.length,5);
}
console.log('Feed timing passed: reading pause, 40 reactions per post, five staggered comments, reading hold, scene reset and seamless 42-second loop.');
