// Day One's comment rows, ready to draw: the script with the company filled in, mentions
// parsed, replies nested under their parents, wave rows made uniform (spec 3: a one-line
// headline, one line of text, "Like | Reply", no pronouns, no reaction counts), and about one
// time in four swapped with its neighbour inside each wave (the "Most relevant" tell, on top of the
// few times script.json sets far out of sequence). Pure.
import {COMPANY, waveOf, JAMIE_ROW, DOUG_ROW, LAST_WARM_ROW} from './timeline.js';

const fill = (s, company) => String(s ?? '').split('{COMPANY}').join(company);

// "{Jamie Okafor} YES!!!" -> [{mention:'Jamie Okafor'}, ' YES!!!']
export function segments(text) {
  const out = [], re = /\{([^}]+)\}/g;
  let at = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > at) out.push(text.slice(at, m.index));
    out.push({mention:m[1]});
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function prepare(script, avatars, company = COMPANY) {
  const post = {
    ...script.post,
    headline:fill(script.post.headline, company),
    // The company is a mention in the post (blue, semibold).
    text:segments(script.post.text.split('{COMPANY}').join(`{${company}}`)),
  };
  const all = script.rows.filter(r => r.kind !== 'ui').map(r => {
    const wave = waveOf(r.n), uniform = wave !== null && wave > 0;
    return {
      n:r.n, kind:r.kind, wave, uniform,
      name:r.name, pronouns:uniform ? '' : r.pronouns, degree:r.degree,
      frame:r.frame || '', headline:fill(r.headline, company), time:r.time,
      reactions:uniform ? 0 : r.reactions, reactTypes:r.reactTypes || ['like'],
      text:segments(fill(r.text, company)), plain:fill(r.text, company),
      reply:!!r.reply, author:!!r.author,
      avatar:avatars.assign[String(r.n)] || 'silhouette',
      replies:[],
    };
  });
  // "Most relevant": inside each wave, about 1 row in 4 trades its time with its neighbour.
  const rand = mulberry32(0x5EED);
  for (let i = 0; i + 1 < all.length; i++) {
    const a = all[i], b = all[i + 1];
    if (a.uniform && b.uniform && a.wave === b.wave && a.time !== b.time && rand() < .25) {
      [a.time, b.time] = [b.time, a.time];
      i++;
    }
  }
  // Nest replies under the comment before them.
  const top = [];
  for (const r of all) {
    if (r.reply && top.length) top[top.length - 1].replies.push(r);
    else top.push(r);
  }
  const jamie = top.find(r => r.n === JAMIE_ROW);
  if (!jamie || !jamie.replies.some(r => r.n === DOUG_ROW)) throw Error('Doug must reply to Jamie.');
  const loadAfter = LAST_WARM_ROW;   // "Load more comments" sits after the warm block
  return {post, rows:top, loadAfter, company, all};
}
