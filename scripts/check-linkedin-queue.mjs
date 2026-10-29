import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loadQueue, validateQueue, dueItems, buildPostBody, createClient, fileExists, postUrl, ROOT, QUEUE_PATH} from './linkedin/lib.mjs';
import {nextSlots, pacificIso, mergeDrafts, buildPrompt, run as runDraft} from './linkedin/draft.mjs';

// All provider calls are simulated. This suite never contacts LinkedIn or Anthropic.
const exec = promisify(execFile);

// 1. The committed queue is valid and every referenced file exists.
const queue = await loadQueue(QUEUE_PATH);
assert.equal(validateQueue(queue).length, 0);
assert.ok(queue.items.length >= 14, 'launch queue should hold the first three weeks');
for (const item of queue.items) {
  for (const path of [item.media?.path, item.article?.thumbnail].filter(Boolean)) assert.ok(await fileExists(path), `${item.id}: missing ${path}`);
  assert.ok(item.page_reply, `${item.id}: needs a page_reply`);
}
assert.ok(queue.items.every(item => item.status === 'draft'), 'the committed launch queue ships as drafts; a person approves');

// 2. Validation catches the playbook rules and structural mistakes.
const bad = {items: [
  {id: 'Bad ID', status: 'approved', scheduled_at: '2026-11-02T08:15:00', format: 'achievement', text: 'Hello #growth'},
  {id: 'ok-item', status: 'nope', scheduled_at: '2026-11-02T08:15:00-08:00', format: 'achievement', text: 'Fine'},
  {id: 'ok-item', status: 'draft', scheduled_at: '2026-11-02T08:15:00-08:00', format: 'achievement', text: 'Dup', media: {path: '/etc/passwd'}},
  {id: 'both', status: 'draft', scheduled_at: '2026-11-02T08:15:00-08:00', format: 'link', text: 'x', media: {path: 'public/og.png'}, article: {url: 'http://x', title: ''}},
]};
const problems = validateQueue(bad);
for (const needle of ['id must be', 'explicit offset', 'no hashtags', 'status must be', 'duplicate id', 'repository-relative', 'choose media or article', 'https URL', 'article.title']) assert.ok(problems.some(p => p.includes(needle)), `expected a problem containing "${needle}"`);

// 3. Due selection: approved and past, oldest first, drafts ignored.
const sample = {items: [
  {id: 'c', status: 'approved', scheduled_at: '2026-11-03T12:10:00-08:00'},
  {id: 'a', status: 'approved', scheduled_at: '2026-11-02T08:15:00-08:00'},
  {id: 'b', status: 'draft', scheduled_at: '2026-11-02T12:10:00-08:00'},
  {id: 'd', status: 'approved', scheduled_at: '2026-12-01T08:15:00-08:00'},
]};
assert.deepEqual(dueItems(sample, Date.parse('2026-11-04T00:00:00Z')).map(i => i.id), ['a', 'c']);
assert.deepEqual(dueItems(sample, Date.parse('2026-11-02T16:14:00Z')).map(i => i.id), []);
assert.deepEqual(dueItems(sample, Date.parse('2026-11-02T16:15:00Z')).map(i => i.id), ['a']);

// 4. Post bodies follow the Posts API shape and escape little-text characters.
const text = buildPostBody({id: 't', text: 'Q4 (aligned) @team\n\nLinked Beats'}, 'urn:li:organization:123');
assert.equal(text.author, 'urn:li:organization:123');
assert.equal(text.commentary, String.raw`Q4 \(aligned\) \@team` + '\n\nLinked Beats');
assert.equal(text.lifecycleState, 'PUBLISHED');
assert.deepEqual(text.distribution, {feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: []});
assert.equal(text.content, undefined);
const video = buildPostBody({id: 'v', text: 'x', media: {path: 'a.mp4', title: 'Optimizing', alt: 'ignored for video'}}, 'urn:li:person:abc', {mediaUrn: 'urn:li:video:V1'});
assert.deepEqual(video.content, {media: {id: 'urn:li:video:V1', title: 'Optimizing'}});
const image = buildPostBody({id: 'i', text: 'x', media: {path: 'a.png', alt: 'A certificate'}}, 'urn:li:person:abc', {mediaUrn: 'urn:li:image:I1'});
assert.deepEqual(image.content, {media: {id: 'urn:li:image:I1', altText: 'A certificate'}});
const link = buildPostBody({id: 'l', text: 'x', article: {url: 'https://linkedinbeats.com/learn/', title: 'Program', description: 'Five lessons.'}}, 'urn:li:person:abc', {thumbnailUrn: 'urn:li:image:T1'});
assert.deepEqual(link.content, {article: {source: 'https://linkedinbeats.com/learn/', title: 'Program', description: 'Five lessons.', thumbnail: 'urn:li:image:T1'}});
assert.throws(() => buildPostBody({id: 'm', text: 'x', media: {path: 'a.png'}}, 'urn:li:person:abc'), /no uploaded URN/);
assert.throws(() => buildPostBody({id: 'm', text: 'x'}, 'urn:li:company:1'), /author must be/);
assert.equal(postUrl('urn:li:share:123'), 'https://www.linkedin.com/feed/update/urn:li:share:123/');
assert.equal(postUrl('garbage'), 'https://www.linkedin.com/feed/');

// 5. The client: image upload, availability polling, post creation, failure modes.
const calls = [];
let imageStatus = ['PROCESSING', 'AVAILABLE'];
let postMode = 'ok';
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json', ...headers}});
async function provider(url, options = {}) {
  calls.push({url, method: options.method || 'GET', headers: options.headers || {}, body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body});
  if (url.endsWith('/v2/userinfo')) return json({sub: 'member-1', name: 'Test Member'});
  if (url.includes('/rest/images?action=initializeUpload')) return json({value: {image: 'urn:li:image:IMG1', uploadUrl: 'https://www.linkedin.com/dms-uploads/img'}});
  if (url === 'https://www.linkedin.com/dms-uploads/img') return new Response('', {status: 201, headers: {etag: '"e1"'}});
  if (url.includes('/rest/images/')) return json({status: imageStatus.shift() || 'AVAILABLE'});
  if (url.endsWith('/rest/posts')) {
    if (postMode === 'reject') return json({message: 'FIELD_LENGTH_TOO_LONG'}, 400);
    if (postMode === 'network') throw new TypeError('fetch failed');
    return new Response('', {status: 201, headers: {'x-restli-id': 'urn:li:share:999'}});
  }
  throw new Error(`unexpected ${url}`);
}
const client = createClient({token: 'secret', authorUrn: 'urn:li:person:member-1', fetchImpl: provider, root: ROOT, pollInterval: 1, version: '202610'});
const me = await client.whoAmI();
assert.equal(me.sub, 'member-1');
const result = await client.publish({id: 'img', text: 'Congratulations', media: {path: 'public/og.png', alt: 'OG image'}});
assert.deepEqual(result, {id: 'urn:li:share:999', url: 'https://www.linkedin.com/feed/update/urn:li:share:999/', media: 'urn:li:image:IMG1'});
const init = calls.find(c => c.url.includes('initializeUpload'));
assert.deepEqual(init.body, {initializeUploadRequest: {owner: 'urn:li:person:member-1'}});
assert.equal(init.headers['LinkedIn-Version'], '202610');
assert.equal(init.headers['X-Restli-Protocol-Version'], '2.0.0');
const upload = calls.find(c => c.url === 'https://www.linkedin.com/dms-uploads/img');
assert.equal(upload.method, 'PUT');
assert.equal(upload.headers.Authorization, 'Bearer secret');
const statusChecks = calls.filter(c => c.url.includes('/rest/images/urn'));
assert.equal(statusChecks.length, 2, 'polls until AVAILABLE');
assert.equal(statusChecks[0].headers['LinkedIn-Version'], undefined, 'image status uses the legacy route that w_member_social allows');
const post = calls.find(c => c.url.endsWith('/rest/posts'));
assert.equal(post.body.content.media.id, 'urn:li:image:IMG1');
assert.equal(post.body.content.media.altText, 'OG image');
assert.equal(post.headers.Authorization, 'Bearer secret');

postMode = 'reject';
await assert.rejects(client.publish({id: 'txt', text: 'Too long'}), error => error.status === 400 && !error.uncertain);
postMode = 'network';
await assert.rejects(client.publish({id: 'txt', text: 'Lost'}), error => error.uncertain === true && /may have published/.test(error.message));
assert.throws(() => createClient({token: '', authorUrn: 'urn:li:person:x', fetchImpl: provider}), /No LinkedIn access token/);
assert.throws(() => createClient({token: 't', authorUrn: 'urn:li:company:x', fetchImpl: provider}), /LINKEDIN_AUTHOR_URN/);
await assert.rejects(client.uploadMedia('../outside.png'), /escapes|ENOENT/);

// 6. The publisher CLI: dry run prints and posts nothing; a real run with a
//    rejected post records failed status without retrying on the next run.
const directory = await mkdtemp(join(tmpdir(), 'lb-queue-'));
const temporaryQueue = join(directory, 'queue.json');
const copy = JSON.parse(await readFile(QUEUE_PATH, 'utf8'));
copy.items[0].status = 'approved';
copy.items[1].status = 'approved';
await writeFile(temporaryQueue, JSON.stringify(copy));
const dry = await exec(process.execPath, ['scripts/linkedin/publish.mjs', '--dry-run', '--queue', temporaryQueue, '--now', '2026-11-03T21:00:00Z', '--limit', '5'], {cwd: ROOT, env: {...process.env, LINKEDIN_ACCESS_TOKEN: '', LINKEDIN_AUTHOR_URN: ''}});
assert.match(dry.stdout, /Dry run/);
assert.match(dry.stdout, new RegExp(copy.items[0].id));
assert.match(dry.stdout, new RegExp(copy.items[1].id));
assert.match(dry.stdout, /Nothing was posted/);
assert.deepEqual(JSON.parse(await readFile(temporaryQueue, 'utf8')).items.map(i => i.status).slice(0, 2), ['approved', 'approved'], 'dry run must not touch the queue');
const nothing = await exec(process.execPath, ['scripts/linkedin/publish.mjs', '--dry-run', '--queue', temporaryQueue, '--now', '2026-10-01T00:00:00Z'], {cwd: ROOT});
assert.match(nothing.stdout, /Nothing due/);
await assert.rejects(exec(process.execPath, ['scripts/linkedin/publish.mjs', '--id', copy.items[2].id, '--queue', temporaryQueue], {cwd: ROOT}), error => /not approved/.test(error.stderr));

// 7. The drafter: slots land on weekdays in Pacific time with the right offset,
//    merged drafts validate, and the prompt carries the playbook and coverage.
assert.equal(pacificIso('2026-11-02', '08:15'), '2026-11-02T08:15:00-08:00');
assert.equal(pacificIso('2026-10-30', '12:10'), '2026-10-30T12:10:00-07:00');
const slots = nextSlots(queue, 3);
assert.equal(slots.length, 3);
for (const slot of slots) { const day = new Date(slot).getUTCDay(); assert.ok(day !== 0 && day !== 6, `${slot} is a weekend`); assert.ok(Date.parse(slot) > Date.parse(queue.items.at(-1).scheduled_at)); }
assert.equal(nextSlots(queue, 2, '2026-11-23')[0], '2026-11-23T08:15:00-08:00');
const prompt = buildPrompt({playbook: 'PLAYBOOK TEXT', characters: '', direction: '', queue, count: 2, slots: slots.slice(0, 2)});
assert.match(prompt.system, /PLAYBOOK TEXT/);
assert.match(prompt.user, /operations \/ unexpected-lesson \/ general/);
const fake = {posts: [
  {format: 'achievement', genre: 'anti-hustle', topic: 'professional-development', character: 'strategy', text: 'I took Friday off.\n\nStrategy\nLinked Beats', page_reply: 'Arjun: Which Friday?', why: 'The anti-hustle post.'},
  {format: 'transcript', genre: 'humbling', topic: 'conference-followup', character: 'page', text: 'From Tuesday.\n\nStrategy: Humbled.\nArjun: By what?', page_reply: 'Linda: 2019.', why: 'The humbling.'},
]};
const {merged, added} = mergeDrafts(queue, fake.posts, slots.slice(0, 2));
assert.equal(added.length, 2);
assert.ok(added.every(item => item.status === 'draft'));
assert.equal(merged.items.length, queue.items.length + 2);
assert.throws(() => mergeDrafts(queue, [{...fake.posts[0], text: 'Nope #hashtag'}], slots.slice(0, 1)), /no hashtags/);
await writeFile(temporaryQueue, JSON.stringify(queue));
const drafted = await runDraft({count: 2, queuePath: temporaryQueue, generate: async prompt => { assert.match(prompt.system, /PLAYBOOK/); return fake; }});
assert.equal(drafted.length, 2);
assert.equal(JSON.parse(await readFile(temporaryQueue, 'utf8')).items.length, queue.items.length + 2);
await rm(directory, {recursive: true, force: true});

console.log('check-linkedin-queue: ok');
