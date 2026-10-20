// LESSON 05 — Release Your Single. Level 5: Corporate Hallucination.
export const single = {
  id: 'single',
  number: 5,
  title: 'Release Your Single',
  subtitle: 'Everything at once. Then a bassline. Then a certificate.',
  level: 5,
  levelName: 'Corporate Hallucination',
  minutes: 6,
  steps: [
    { type: 'bot-message', id: 'r-1', content: "{{name}}, this is the final lesson. You know the hook, the inflation, the vocabulary and the shape. Now we turn the dial to **five** and put all of it in one post.", delayMs: 300 },
    { type: 'bot-message', id: 'r-2', content: "Pick a genre. Announce something, teach a lesson, sell without selling, manufacture urgency, or discover AI. Fill in what actually happened. The department does the rest.", delayMs: 500 },
    { type: 'intake-card', id: 'r-intake', title: 'Your single', description: 'Choose a genre and state the facts. Level five is applied automatically.', category: 'announce', choose: true, level: 5, runLabel: 'Cut the record', outputLabel: 'Level 5 · Corporate Hallucination' },
    { type: 'score-card', id: 'r-score', source: 'r-intake', title: 'Final score' },
    { type: 'insight-card', id: 'r-i1', title: 'What you are looking at', content: "A hook that withholds the point. Inflation at full stretch. Gratitude in triplicate. Six one-liners. A hashtag wall. This is every lesson in one object.\n\nIt is also, technically, unpublishable. That is the point of level five." },
    { type: 'pause', id: 'r-p1', buttonLabel: 'Give it a bassline' },
    { type: 'bot-message', id: 'r-3', content: "Your words deserve a beat. The chorus is a line from your own post; the robot handles the keywords. **Press play.**", delayMs: 300 },
    { type: 'beat-card', id: 'r-beat', source: 'r-intake', title: 'Your words. On repeat.', buttonLabel: 'Collect my certificate' },
    { type: 'bot-message', id: 'r-4', content: "💡 **Before you actually post anything:** turn the dial back to two, run it through the humanizer, and keep only what survives. The Program certifies fluency, not sincerity.", delayMs: 400 },
    { type: 'takeaway-card', id: 'r-t', takeaways: [
      'A level-five post is the hook, the inflation, the vocabulary and the shape in one object.',
      'Any post can become a single. The chorus is already in there.',
      'Fluency is the certificate. Sincerity is your problem.',
    ] },
    { type: 'chapter-end', id: 'r-end', isFinal: true },
  ],
};
