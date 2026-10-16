export const TURN_DURATION = 5000;
export const CONVERSATION_DURATION = TURN_DURATION * 2;
export const CONVERSATION = [
  {speaker:'left', lines:['Let’s circle back','on our alignment.']},
  {speaker:'right', lines:['Absolutely. I’ll align','on the circle back.']},
];

// The silent film is the clock: two five-second turns in a ten-second loop.
// Text begins with the lips, then holds while the speaker returns to rest.
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
