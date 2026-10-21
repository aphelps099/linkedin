import assert from 'node:assert/strict';
import {CONVERSATION, CONVERSATION_DURATION, VIDEO_DURATION, TURN_DURATION, conversationFrame} from '../src/home-experiments/conversation-timeline.js';

assert.equal(conversationFrame(0).words,0,'leave a beat before the lips move');
assert.equal(conversationFrame(550).words,1);
assert.equal(conversationFrame(3500).speaking,false,'mouths return to rest before text leaves');
assert.equal(conversationFrame(4499).leaving,false);
assert.equal(conversationFrame(4500).leaving,true);
assert.equal(conversationFrame(TURN_DURATION).index,1);
assert.equal(conversationFrame(TURN_DURATION).words,0,'clear text on speaker handoff');
assert.equal(conversationFrame(VIDEO_DURATION).index,2,'the next film loop advances to new vocabulary');
assert.deepEqual(conversationFrame(CONVERSATION_DURATION),conversationFrame(0),'the full vocabulary sequence wraps');
for(let t=0;t<CONVERSATION_DURATION;t+=20){
  const frame=conversationFrame(t);
  const wordCount=CONVERSATION[frame.index].lines.join(' ').split(' ').length;
  assert(frame.words>=0&&frame.words<=wordCount);
  assert.equal(CONVERSATION[frame.index].speaker,t%VIDEO_DURATION<TURN_DURATION?'left':'right','each phrase matches the face speaking in the film');
  if(t%TURN_DURATION>=3500)assert.equal(frame.words,wordCount,'all words are readable during the hold');
}
console.log('Vocabulary timing passed: eight phrases, alternating speakers across video loops, full reading hold and seamless sequence wrap.');
