import assert from 'node:assert/strict';
import {CONVERSATION, CONVERSATION_DURATION, TURN_DURATION, conversationFrame} from '../src/home-experiments/conversation-timeline.js';

assert.equal(conversationFrame(0).words,0,'allow a beat before speech starts');
assert.equal(conversationFrame(550).words,1);
assert.equal(conversationFrame(2475).words,6);
assert.equal(conversationFrame(3500).speaking,false,'mouths return to rest before text leaves');
assert.equal(conversationFrame(4499).leaving,false);
assert.equal(conversationFrame(4500).leaving,true);
assert.equal(conversationFrame(TURN_DURATION).index,1);
assert.equal(conversationFrame(TURN_DURATION).words,0,'clear the previous sentence on speaker change');
assert.equal(conversationFrame(TURN_DURATION+2860).words,7);
assert.deepEqual(conversationFrame(CONVERSATION_DURATION),conversationFrame(0),'seamless film wrap resets the text');
for(let t=0;t<CONVERSATION_DURATION;t+=20){
  const frame=conversationFrame(t);
  assert(frame.words>=0&&frame.words<=CONVERSATION[frame.index].lines.join(' ').split(' ').length);
  assert.equal(frame.index,t<TURN_DURATION?0:1);
}
console.log('Conversation timing passed: lip-aligned reveal, complete sentences, reading hold, speaker handoff and video loop reset.');
