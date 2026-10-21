export const TURN_DURATION = 5000;
export const VIDEO_DURATION = TURN_DURATION * 2;
export const CONVERSATION = [
  {speaker:'left', lines:['Let’s circle back.']},
  {speaker:'right', lines:['Let’s take it offline.']},
  {speaker:'left', lines:['Humbled and honored.']},
  {speaker:'right', lines:['Thought leadership.']},
  {speaker:'left', lines:['Move the needle.']},
  {speaker:'right', lines:['Unlock our potential.']},
  {speaker:'left', lines:['Cross-functional synergy.']},
  {speaker:'right', lines:['Let’s align on that.']},
];
export const CONVERSATION_DURATION = TURN_DURATION * CONVERSATION.length;

// The film remains the clock: count its ten-second loops to advance vocabulary.
// Every five-second turn still matches the left/right mouths in the source film.
export function conversationFrame(milliseconds) {
  const time=((milliseconds%CONVERSATION_DURATION)+CONVERSATION_DURATION)%CONVERSATION_DURATION;
  const index=Math.floor(time/TURN_DURATION), turn=time%TURN_DURATION;
  const words=CONVERSATION[index].lines.join(' ').split(' ').length;
  return {
    index,
    words:turn<550?0:Math.min(words,1+Math.floor((turn-550)/385)),
    speaking:turn>=500&&turn<3500,
    leaving:turn>=4500,
  };
}
