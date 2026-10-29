#!/usr/bin/env node
// The drafting agent. Reads the playbook (and the project bible when it is
// present), looks at what the queue already covers, and asks Claude for new
// posts in the house voice. Everything it writes lands as status "draft";
// a person promotes the good ones to "approved".
//
//   ANTHROPIC_API_KEY=... npm run linkedin:draft -- --count 5
//   npm run linkedin:draft -- --count 3 --from 2026-11-23   (schedule from that date)
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import {loadQueue, saveQueue, validateQueue, ROOT, QUEUE_PATH, GENRES, TOPICS, CHARACTERS, characterLabel} from './lib.mjs';

const MODEL = 'claude-opus-5-5';
const DRAFT_FORMATS = ['achievement', 'transcript'];

const args = process.argv.slice(2);
const flag = name => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };

export async function readOptional(relativePath) {
  try { return await readFile(resolve(ROOT, relativePath), 'utf8'); } catch { return ''; }
}

// Pacific-time slots on weekdays, with the correct offset for the date.
export function pacificIso(date, time, timeZone = 'America/Los_Angeles') {
  const [hh, mm] = time.split(':').map(Number);
  const guess = new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {timeZone, timeZoneName: 'longOffset'}).formatToParts(guess);
  const name = parts.find(part => part.type === 'timeZoneName')?.value || 'GMT-08:00';
  const offset = name === 'GMT' ? '+00:00' : name.replace('GMT', '');
  return `${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00${offset}`;
}

export function nextSlots(queue, count, from) {
  const taken = new Set(queue.items.map(item => item.scheduled_at.slice(0, 10)));
  const slots = queue.slots?.length ? queue.slots : ['08:15', '12:10'];
  const last = queue.items.reduce((max, item) => Math.max(max, Date.parse(item.scheduled_at)), 0);
  let cursor = from ? new Date(`${from}T12:00:00Z`) : new Date(Math.max(last, Date.now()) + 86400000);
  let slotIndex = queue.items.length % slots.length;
  const out = [];
  while (out.length < count) {
    const day = cursor.toISOString().slice(0, 10);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !taken.has(day)) {
      out.push(pacificIso(day, slots[slotIndex % slots.length], queue.timezone));
      slotIndex++;
    }
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return out;
}

export function coverage(queue) {
  const cells = {};
  for (const item of queue.items) cells[`${item.character}|${item.genre}|${item.topic}`] = (cells[`${item.character}|${item.genre}|${item.topic}`] || 0) + 1;
  const recent = queue.items.slice(-6).map(item => item.character);
  return {cells, recent};
}

export function slugFor(scheduledAt, character, genre, existing) {
  const base = `${scheduledAt.slice(0, 10)}-${character}-${genre}`.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  let slug = base, n = 2;
  while (existing.has(slug)) slug = `${base}-${n++}`;
  existing.add(slug);
  return slug;
}

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['posts'],
  properties: {
    posts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['format', 'genre', 'topic', 'character', 'text', 'page_reply', 'why'],
        properties: {
          format: {type: 'string', enum: DRAFT_FORMATS},
          genre: {type: 'string', enum: GENRES.filter(g => g !== 'none')},
          topic: {type: 'string', enum: TOPICS},
          character: {type: 'string', enum: CHARACTERS.filter(c => !['printer', 'droid', 'pat'].includes(c))},
          text: {type: 'string', description: 'The full post, with line breaks, ending in the byline. No hashtags, no emoji.'},
          page_reply: {type: 'string', description: 'One in-character first comment from a different character, prefixed with their role and a colon.'},
          why: {type: 'string', description: 'One sentence on which real LinkedIn habit this post recognizes.'},
        },
      },
    },
  },
};

export function buildPrompt({playbook, characters, direction, queue, count, slots}) {
  const {cells, recent} = coverage(queue);
  const covered = Object.keys(cells).map(key => key.split('|').join(' / ')).join('\n');
  const system = [
    'You write posts for the LinkedIn company page of Linked Beats, a fictional company that exists to announce things. The page is run with total sincerity; nobody on it knows it is funny. Write like a careful, earnest professional, never like a comedian.',
    'Follow the playbook and the character sheet below exactly. The dry mechanic is the whole craft: a sincere post, a modest real outcome, significance inflated only by the ceremony around it, and a colleague who takes it literally. Never explain the joke, never wink, never use hashtags or emoji, never write "Agree?".',
    'Punch only at the format and the pressure to announce. Never at a junior person, a parent, or anyone\'s competence. No real people, no real companies other than linkedinbeats.com.',
    'Each post must be a single cell of the grid: one character, one genre, one topic. A transcript is four to six lines of meeting dialogue with a one-line frame. An achievement is 40 to 110 words plus the byline. Byline format: the character label on its own line, then "Linked Beats".',
    `Character labels: ${CHARACTERS.filter(c => c !== 'page').map(c => `${c} = "${characterLabel(c)}"`).join('; ')}.`,
    '',
    '=== PLAYBOOK ===', playbook,
    characters ? '\n=== CHARACTER SHEET ===\n' + characters : '',
    direction ? '\n=== CREATIVE DIRECTION ===\n' + direction : '',
  ].join('\n');
  const user = [
    `Write ${count} new posts for these slots: ${slots.join(', ')}.`,
    `Avoid cells already covered (character / genre / topic):\n${covered || '(none yet)'}`,
    `The most recent characters, newest last: ${recent.join(', ') || '(none)'}. Do not repeat the last character, and never use the same character twice in a row across your new posts.`,
    'Spread the genres. At most one tool confession in the batch. At least one transcript.',
    'Every achievement must name a specific, credible, small piece of work and its actual outcome. Keep numbers plausible and keep what they mean (impressions are not people).',
    'Return only the JSON object.',
  ].join('\n\n');
  return {system, user};
}

export async function generateWithClaude({system, user}, client = new Anthropic()) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: [{type: 'text', text: system, cache_control: {type: 'ephemeral'}}],
    messages: [{role: 'user', content: user}],
    output_config: {effort: 'high', format: {type: 'json_schema', schema: OUTPUT_SCHEMA}},
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error(`Claude declined: ${message.stop_details?.explanation || 'no explanation'}`);
  if (message.stop_reason === 'max_tokens') throw new Error('Claude ran out of output tokens; lower --count.');
  const text = message.content.filter(block => block.type === 'text').map(block => block.text).join('');
  try { return JSON.parse(text); } catch { const match = text.match(/\{[\s\S]*\}/); if (!match) throw new Error('Claude did not return JSON.'); return JSON.parse(match[0]); }
}

export function mergeDrafts(queue, posts, slots) {
  const existing = new Set(queue.items.map(item => item.id));
  const added = [];
  posts.slice(0, slots.length).forEach((post, index) => {
    const scheduled_at = slots[index];
    added.push({id: slugFor(scheduled_at, post.character, post.genre, existing), status: 'draft', scheduled_at, format: post.format, genre: post.genre, topic: post.topic, character: post.character, text: post.text.trim(), page_reply: post.page_reply.trim(), drafted_by: MODEL, why: post.why.trim()});
  });
  const merged = {...queue, items: [...queue.items, ...added].sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at))};
  const problems = validateQueue(merged);
  if (problems.length) throw new Error(`Drafts failed validation:\n  ${problems.join('\n  ')}`);
  return {merged, added};
}

export async function run({count = 5, from, queuePath = QUEUE_PATH, generate = generateWithClaude} = {}) {
  const queue = await loadQueue(queuePath);
  const playbook = await readOptional('docs/linkedin/playbook.md');
  const characters = await readOptional('docs/project/characters.md');
  const direction = await readOptional('docs/project/creative-direction.md');
  if (!playbook) throw new Error('docs/linkedin/playbook.md is missing.');
  const slots = nextSlots(queue, count, from);
  const prompt = buildPrompt({playbook, characters, direction, queue, count, slots});
  const result = await generate(prompt);
  if (!Array.isArray(result?.posts) || !result.posts.length) throw new Error('No posts came back.');
  const {merged, added} = mergeDrafts(queue, result.posts, slots);
  await saveQueue(merged, queuePath);
  return added;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const count = Math.min(10, Math.max(1, Number(flag('--count') || 5)));
  const added = await run({count, from: flag('--from'), queuePath: flag('--queue') || QUEUE_PATH});
  console.log(`Added ${added.length} draft(s) to ${QUEUE_PATH}:\n`);
  for (const item of added) {
    console.log(`── ${item.id}  ${item.scheduled_at}  ${item.format}  ${characterLabel(item.character)}`);
    console.log(item.text.split('\n').map(line => `   ${line}`).join('\n'));
    console.log(`   reply: ${item.page_reply}\n   why:   ${item.why}\n`);
  }
  console.log('Review them, edit freely, then set status to "approved" for the ones that should post.');
}
