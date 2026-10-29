#!/usr/bin/env node
// Posts anything in the queue that is approved and due, then writes the
// result back into docs/linkedin/queue.json. One item per run by default,
// because the job runs hourly and a smaller blast radius beats throughput.
//
//   npm run linkedin:publish -- --dry-run          build the bodies, post nothing
//   npm run linkedin:publish -- --id <item id>     post one specific approved item now
//   npm run linkedin:publish -- --limit 2          post up to two due items
//   npm run linkedin:publish -- --now 2026-11-02T17:00:00Z   pretend it is that time
import {loadQueue, saveQueue, dueItems, buildPostBody, createClient, resolveCredentials, fileExists, characterLabel, QUEUE_PATH} from './lib.mjs';

const args = process.argv.slice(2);
const flag = name => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };
const dryRun = args.includes('--dry-run');
const onlyId = flag('--id');
const limit = Number(flag('--limit') || 1);
const now = flag('--now') ? Date.parse(flag('--now')) : Date.now();
const queuePath = flag('--queue') || QUEUE_PATH;
const log = (...parts) => console.log(...parts);

const queue = await loadQueue(queuePath);
let items = onlyId ? queue.items.filter(item => item.id === onlyId) : dueItems(queue, now);
if (onlyId && items.length && items[0].status !== 'approved') { console.error(`${onlyId} is ${items[0].status}, not approved. Nothing posted.`); process.exit(1); }
if (onlyId && !items.length) { console.error(`No item with id ${onlyId}.`); process.exit(1); }
items = items.slice(0, Math.max(1, limit));

if (!items.length) { log(`Nothing due at ${new Date(now).toISOString()}. ${queue.items.filter(i => i.status === 'approved').length} approved item(s) waiting.`); process.exit(0); }

for (const item of items) {
  const missing = [item.media?.path, item.article?.thumbnail].filter(Boolean);
  for (const path of missing) if (!(await fileExists(path))) { console.error(`${item.id}: ${path} does not exist in the repository.`); process.exit(1); }
}

const credentials = await resolveCredentials();
if (credentials.expiresAt) {
  const daysLeft = (Date.parse(credentials.expiresAt) - Date.now()) / 86400000;
  if (daysLeft < 0) { console.error(`::error::The LinkedIn token expired on ${credentials.expiresAt}. Run npm run linkedin:auth and update LINKEDIN_ACCESS_TOKEN.`); if (!dryRun) process.exit(1); }
  else if (daysLeft < 7) console.warn(`::warning::The LinkedIn token expires in ${daysLeft.toFixed(1)} days (${credentials.expiresAt}). Run npm run linkedin:auth soon.`);
}

if (dryRun) {
  const author = credentials.author || 'urn:li:person:DRY_RUN';
  log(`Dry run at ${new Date(now).toISOString()} as ${author} (credentials from ${credentials.source}).\n`);
  for (const item of items) {
    const body = buildPostBody(item, author, {mediaUrn: item.media ? 'urn:li:image:DRY_RUN' : undefined, thumbnailUrn: item.article?.thumbnail ? 'urn:li:image:DRY_RUN' : undefined});
    log(`── ${item.id}  ${item.scheduled_at}  ${item.format}  ${characterLabel(item.character || 'page')}`);
    log(item.text.trim().split('\n').map(line => `   ${line}`).join('\n'));
    if (item.media) log(`   [${item.media.path}]`);
    if (item.article) log(`   [link: ${item.article.url}]`);
    log(`   commentary bytes: ${Buffer.byteLength(body.commentary)}\n`);
  }
  log('Nothing was posted.');
  process.exit(0);
}

const client = createClient({token: credentials.token, authorUrn: credentials.author, version: process.env.LINKEDIN_API_VERSION || '202610', log});
const me = await client.whoAmI();
log(`Token belongs to ${me.name || me.sub}. Posting as ${credentials.author}.`);

let failures = 0;
for (const item of items) {
  log(`\nPublishing ${item.id} (${item.format}, scheduled ${item.scheduled_at})`);
  // Record intent before the external call so a crash afterwards cannot
  // trigger a blind retry on the next run.
  item.attempted_at = new Date().toISOString();
  try {
    const result = await client.publish(item);
    item.status = 'published';
    item.result = {...result, published_at: new Date().toISOString(), author: credentials.author};
    delete item.error;
    log(`  published: ${result.url}`);
  } catch (error) {
    failures++;
    item.status = 'failed';
    item.error = {message: String(error.message).slice(0, 600), at: new Date().toISOString(), uncertain: Boolean(error.uncertain)};
    console.error(`  failed: ${item.error.message}`);
  }
  await saveQueue(queue, queuePath);
}
process.exit(failures ? 1 : 0);
