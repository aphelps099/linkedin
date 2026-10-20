// PROFESSIONAL DEVELOPMENT PROGRAM — the step contract.
//
// A chapter is an ordered list of steps. The player reveals them one at a time:
// passive steps auto-advance on a timer, interactive steps wait for the learner.
// Nothing here renders; this file is the schema that chapters/*.js are written
// against and that scripts/check-program.mjs validates.
//
// Every step: { type, id, ... }. Ids must be unique within a chapter — they are
// React keys and the keys of the player's output map.
//
// Passive (auto-advance):
//   bot-message   { content, delayMs? }                 markdown paragraph from the guide.
//                                                       {{name}} and {{title}} are substituted.
//   output-card   { content, label? }                   a canned "LinkedIn version".
//   insight-card  { title, content }                    "notice what happened" explainer.
//   takeaway-card { takeaways: string[] }               three key points.
//   before-after  { before, after, beforeLabel?, afterLabel? }
//   divider       {}
//
// Interactive (wait):
//   pause         { buttonLabel? }                      one pill button.
//   buttons       { buttons: [{label, action:'next'|'nextChapter', variant?}] }
//   name-input    { placeholder?, buttonLabel?, askTitle? }
//                                                       captures {{name}} (and {{title}} when askTitle).
//   prompt-card   { prompt, label?, tryMe? }            a dark card showing text. tryMe adds Play,
//                                                       which performs the next live-output.
//   live-output   { performs, source, label? }          the local "AI" writes into this card.
//                   performs: 'linkedinify' | 'humanize' | 'generate' | 'score'
//                   source:   id of an earlier prompt-card / exercise-card / intake-card /
//                             dial, whose current text (or answers) is the input.
//   exercise-card { title, description?, template, blanks:[{id,label,placeholder,defaultValue?}],
//                   performs?, level? }                 fill-in-the-blank. Run performs on the
//                                                       filled template (default 'linkedinify').
//   intake-card   { title, description?, category, fields?: string[] }
//                                                       the Lessons intake form for one category
//                                                       from src/lessons/categories.js. Run performs
//                                                       generate() at `level` (default 3).
//   dial          { title?, source, min?, max?, initial? }
//                                                       level slider 1–5 that re-renders the source
//                                                       intake-card's answers live.
//   score-card    { source, title? }                    the Thought Leadership Index of the source's
//                                                       latest output, with sub-metrics.
//   spot-the-trope{ title, text, answers: string[], explanation }
//                                                       the learner clicks the lines that are tropes.
//   beat-card     { source, title? }                    make the source's latest output a beat
//                                                       (wraps src/post-beat/PostBeat.jsx).
//   chapter-end   { nextChapterTitle?, isFinal? }
//
// Chapter: { id, number, title, subtitle, level, levelName, minutes, steps }
//   level/levelName: the dial level (1–5) the learner "earns" by finishing.

export const INTERACTIVE = new Set([
  'pause', 'buttons', 'name-input', 'live-output', 'exercise-card', 'intake-card',
  'dial', 'spot-the-trope', 'beat-card', 'chapter-end',
]);

export const PASSIVE_DELAY = {
  'bot-message': 700,
  'output-card': 900,
  'insight-card': 1000,
  'takeaway-card': 1000,
  'before-after': 1100,
  'score-card': 900,
  'prompt-card': 600,
  divider: 250,
};

export const PERFORMS = new Set(['linkedinify', 'humanize', 'generate', 'score']);

export function isInteractive(step){
  if(step.type === 'prompt-card') return !!step.tryMe;
  return INTERACTIVE.has(step.type);
}
