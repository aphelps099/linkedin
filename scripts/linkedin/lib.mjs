// Shared pieces for the LinkedIn Beats page pipeline: the queue file, its
// validation, and a small client for the LinkedIn Posts API that reuses the
// request shapes already proven in server/linkedin.js.
import {readFile, writeFile, rename, stat} from 'node:fs/promises';
import {resolve, dirname, extname, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {linkedInPlainText} from '../../server/linkedin.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const QUEUE_PATH = resolve(ROOT, 'docs/linkedin/queue.json');
export const TOKEN_PATH = resolve(ROOT, 'scripts/linkedin/token.local.json');

export const STATUSES = ['draft', 'approved', 'published', 'failed', 'skipped'];
export const FORMATS = ['achievement', 'transcript', 'clip', 'credential', 'document', 'link'];
export const GENRES = ['tool-confession', 'humbling', 'unexpected-lesson', 'rejection-reframe', 'vulnerable-share', 'anti-hustle', 'announcement', 'none'];
export const TOPICS = ['onboarding', 'drive-sharing', 'website-update', 'intern-impressions', 'professional-development', 'conference-followup', 'general'];
export const CHARACTERS = ['synergy', 'synthia', 'people', 'strategy', 'kevin', 'keys', 'operations', 'arjun', 'linda', 'printer', 'droid', 'pat', 'page'];
export const MEDIA_TYPES = {'.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.mp4': 'video', '.pdf': 'document'};
export const COMMENTARY_LIMIT = 3000;

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,80}$/;
const URN_PATTERN = /^urn:li:(person|organization):[\w-]+$/;

export async function loadQueue(path = QUEUE_PATH) {
  const queue = JSON.parse(await readFile(path, 'utf8'));
  const problems = validateQueue(queue);
  if (problems.length) throw new Error(`Queue is invalid:\n  ${problems.join('\n  ')}`);
  return queue;
}

export async function saveQueue(queue, path = QUEUE_PATH) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(queue, null, 2)}\n`);
  await rename(temporary, path);
}

export function validateQueue(queue) {
  const problems = [];
  if (!queue || typeof queue !== 'object' || !Array.isArray(queue.items)) return ['queue.items must be an array'];
  const seen = new Set();
  for (const item of queue.items) {
    const where = `item ${item?.id ?? '(no id)'}`;
    if (!ID_PATTERN.test(item?.id ?? '')) problems.push(`${where}: id must be lowercase letters, digits and hyphens`);
    if (seen.has(item?.id)) problems.push(`${where}: duplicate id`);
    seen.add(item?.id);
    if (!STATUSES.includes(item?.status)) problems.push(`${where}: status must be one of ${STATUSES.join(', ')}`);
    if (!Number.isFinite(Date.parse(item?.scheduled_at ?? ''))) problems.push(`${where}: scheduled_at must be an ISO 8601 date with offset`);
    else if (!/[+-]\d\d:\d\d$|Z$/.test(item.scheduled_at)) problems.push(`${where}: scheduled_at needs an explicit offset such as -08:00`);
    if (!FORMATS.includes(item?.format)) problems.push(`${where}: format must be one of ${FORMATS.join(', ')}`);
    if (item?.genre !== undefined && !GENRES.includes(item.genre)) problems.push(`${where}: unknown genre ${item.genre}`);
    if (item?.topic !== undefined && !TOPICS.includes(item.topic)) problems.push(`${where}: unknown topic ${item.topic}`);
    if (item?.character !== undefined && !CHARACTERS.includes(item.character)) problems.push(`${where}: unknown character ${item.character}`);
    if (typeof item?.text !== 'string' || !item.text.trim()) problems.push(`${where}: text is required`);
    else if ([...item.text].length > COMMENTARY_LIMIT) problems.push(`${where}: text exceeds ${COMMENTARY_LIMIT} characters`);
    else {
      if (/#\w/.test(item.text)) problems.push(`${where}: no hashtags (playbook rule)`);
      if (/\p{Extended_Pictographic}/u.test(item.text)) problems.push(`${where}: no emoji (playbook rule)`);
    }
    if (item?.media) {
      if (typeof item.media.path !== 'string' || isAbsolute(item.media.path) || item.media.path.includes('..')) problems.push(`${where}: media.path must be a repository-relative path`);
      else if (!MEDIA_TYPES[extname(item.media.path).toLowerCase()]) problems.push(`${where}: media.path must be png, jpg, gif, mp4 or pdf`);
      if (item.media.title !== undefined && typeof item.media.title !== 'string') problems.push(`${where}: media.title must be a string`);
    }
    if (item?.article) {
      let ok = false;
      try { ok = new URL(item.article.url).protocol === 'https:'; } catch {}
      if (!ok) problems.push(`${where}: article.url must be an https URL`);
      if (typeof item.article.title !== 'string' || !item.article.title) problems.push(`${where}: article.title is required`);
      if (item.article.thumbnail !== undefined && (typeof item.article.thumbnail !== 'string' || !['.png', '.jpg', '.jpeg'].includes(extname(item.article.thumbnail).toLowerCase()))) problems.push(`${where}: article.thumbnail must be a png or jpg path`);
    }
    if (item?.media && item?.article) problems.push(`${where}: choose media or article, not both`);
    if (item?.status === 'published' && !item?.result?.id) problems.push(`${where}: published items need result.id`);
  }
  return problems;
}

export function dueItems(queue, now = Date.now()) {
  return queue.items
    .filter(item => item.status === 'approved' && Date.parse(item.scheduled_at) <= now)
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
}

export function characterLabel(id) {
  return {synergy: 'Synergy, Host', synthia: 'Synthia, Corporate Training', people: 'People & Culture', strategy: 'Strategy', kevin: 'Kevin, Partnerships', keys: 'Keys, Enablement', operations: 'Operations', arjun: 'Arjun, Finance', linda: 'Linda, Governance', printer: 'Deliverables', droid: 'Internal Distribution', pat: 'Thought Leadership', page: 'Linked Beats'}[id] || id;
}

// Pure: builds the Posts API body for an item. Media and thumbnails are
// passed in as URNs so this can be tested without uploads.
export function buildPostBody(item, authorUrn, {mediaUrn, thumbnailUrn} = {}) {
  if (!URN_PATTERN.test(authorUrn || '')) throw new Error('author must be urn:li:person:... or urn:li:organization:...');
  const body = {
    author: authorUrn,
    commentary: linkedInPlainText(item.text.trim()),
    visibility: 'PUBLIC',
    distribution: {feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: []},
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (item.media) {
    if (!mediaUrn) throw new Error(`item ${item.id} has media but no uploaded URN`);
    const media = {id: mediaUrn};
    if (item.media.title) media.title = item.media.title;
    if (item.media.alt && mediaUrn.startsWith('urn:li:image:')) media.altText = item.media.alt;
    body.content = {media};
  } else if (item.article) {
    const article = {source: item.article.url, title: item.article.title};
    if (item.article.description) article.description = item.article.description;
    if (thumbnailUrn) article.thumbnail = thumbnailUrn;
    body.content = {article};
  }
  return body;
}

export function postUrl(id) {
  return /^urn:li:(share|ugcPost):\d+$/.test(id || '') ? `https://www.linkedin.com/feed/update/${id}/` : 'https://www.linkedin.com/feed/';
}

export async function readLocalToken(path = TOKEN_PATH) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

export async function resolveCredentials(env = process.env) {
  const local = await readLocalToken();
  const token = env.LINKEDIN_ACCESS_TOKEN?.trim() || local?.access_token;
  const author = env.LINKEDIN_AUTHOR_URN?.trim() || local?.person_urn;
  const expiresAt = env.LINKEDIN_TOKEN_EXPIRES_AT?.trim() || local?.expires_at;
  return {token, author, expiresAt, source: env.LINKEDIN_ACCESS_TOKEN ? 'environment' : local ? 'token.local.json' : 'none'};
}

export class LinkedInError extends Error {
  constructor(message, {status, body, uncertain = false} = {}) { super(message); this.status = status; this.body = body; this.uncertain = uncertain; }
}

export function createClient({token, authorUrn, version = '202610', fetchImpl = fetch, root = ROOT, log = () => {}, pollInterval = 3000, pollLimit = 40}) {
  if (!token) throw new Error('No LinkedIn access token. Run `npm run linkedin:auth` or set LINKEDIN_ACCESS_TOKEN.');
  if (!URN_PATTERN.test(authorUrn || '')) throw new Error('Set LINKEDIN_AUTHOR_URN to urn:li:person:... or urn:li:organization:...');

  async function api(path, {method = 'GET', body, legacy = false, timeout = 30000} = {}) {
    const response = await fetchImpl(`https://api.linkedin.com${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(timeout),
      headers: {Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0', ...(legacy ? {} : {'LinkedIn-Version': version}), ...(body ? {'Content-Type': 'application/json'} : {})},
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const hint = response.status === 401 ? 'The access token is expired or revoked. Run `npm run linkedin:auth` and update LINKEDIN_ACCESS_TOKEN.'
        : response.status === 403 ? 'LinkedIn denied the request. For an organization author this needs the Community Management API product and an admin role on the page.'
        : response.status === 429 ? 'LinkedIn is rate limiting this member or app.'
        : `LinkedIn returned ${response.status}.`;
      throw new LinkedInError(`${hint} ${method} ${path}: ${text.slice(0, 400)}`, {status: response.status, body: text});
    }
    return response;
  }

  async function uploadBytes(url, bytes, {withToken = true} = {}) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !['linkedin.com', 'licdn.com'].some(host => target.hostname === host || target.hostname.endsWith(`.${host}`))) throw new LinkedInError('LinkedIn returned an unexpected upload destination.');
    const response = await fetchImpl(url, {method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(120000), headers: {'Content-Type': 'application/octet-stream', ...(withToken ? {Authorization: `Bearer ${token}`} : {})}, body: bytes});
    if (!response.ok) throw new LinkedInError(`Upload failed with ${response.status}.`, {status: response.status});
    return response.headers.get('etag')?.replace(/^"|"$/g, '') || '';
  }

  async function waitForAsset(kind, urn) {
    for (let attempt = 0; attempt < pollLimit; attempt++) {
      const result = await (await api(`/rest/${kind}/${encodeURIComponent(urn)}`, {legacy: kind === 'images'})).json();
      if (result.status === 'AVAILABLE') return;
      if (result.status === 'PROCESSING_FAILED') throw new LinkedInError(`LinkedIn could not process ${urn}.`);
      log(`  ${urn} is ${result.status || 'processing'}; waiting`);
      await new Promise(done => setTimeout(done, pollInterval));
    }
    throw new LinkedInError(`${urn} did not become available in time.`);
  }

  async function uploadMedia(relativePath) {
    const kind = MEDIA_TYPES[extname(relativePath).toLowerCase()];
    const path = resolve(root, relativePath);
    if (!path.startsWith(root)) throw new Error(`media path escapes the repository: ${relativePath}`);
    const bytes = await readFile(path);
    log(`  uploading ${kind} ${relativePath} (${(bytes.length / 1048576).toFixed(1)} MB)`);
    if (kind === 'video') {
      const {value} = await (await api('/rest/videos?action=initializeUpload', {method: 'POST', body: {initializeUploadRequest: {owner: authorUrn, fileSizeBytes: bytes.length, uploadCaptions: false, uploadThumbnail: false}}})).json();
      if (!/^urn:li:video:[\w-]+$/.test(value?.video || '') || !value.uploadInstructions?.length) throw new LinkedInError('LinkedIn could not prepare the video upload.');
      const parts = [];
      let next = 0;
      for (const part of value.uploadInstructions) {
        if (part.firstByte !== next || part.lastByte < part.firstByte || part.lastByte >= bytes.length) throw new LinkedInError('LinkedIn returned invalid upload instructions.');
        parts.push(await uploadBytes(part.uploadUrl, bytes.subarray(part.firstByte, part.lastByte + 1), {withToken: false}));
        next = part.lastByte + 1;
      }
      if (next !== bytes.length) throw new LinkedInError('The complete video could not be uploaded.');
      await api('/rest/videos?action=finalizeUpload', {method: 'POST', body: {finalizeUploadRequest: {video: value.video, uploadToken: value.uploadToken || '', uploadedPartIds: parts}}});
      await waitForAsset('videos', value.video);
      return value.video;
    }
    const resource = kind === 'image' ? 'images' : 'documents';
    const {value} = await (await api(`/rest/${resource}?action=initializeUpload`, {method: 'POST', body: {initializeUploadRequest: {owner: authorUrn}}})).json();
    const urn = kind === 'image' ? value?.image : value?.document;
    if (!new RegExp(`^urn:li:${kind}:[\\w-]+$`).test(urn || '')) throw new LinkedInError(`LinkedIn could not prepare the ${kind} upload.`);
    await uploadBytes(value.uploadUrl, bytes);
    await waitForAsset(resource, urn);
    return urn;
  }

  async function whoAmI() {
    const response = await fetchImpl('https://api.linkedin.com/v2/userinfo', {redirect: 'error', headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new LinkedInError(response.status === 401 ? 'The access token is expired or revoked. Run `npm run linkedin:auth` and update LINKEDIN_ACCESS_TOKEN.' : `userinfo returned ${response.status}.`, {status: response.status});
    return response.json();
  }

  async function publish(item) {
    let mediaUrn, thumbnailUrn;
    if (item.media) mediaUrn = await uploadMedia(item.media.path);
    if (item.article?.thumbnail) thumbnailUrn = await uploadMedia(item.article.thumbnail);
    const body = buildPostBody(item, authorUrn, {mediaUrn, thumbnailUrn});
    let response;
    try {
      response = await api('/rest/posts', {method: 'POST', body});
    } catch (error) {
      // A 4xx means LinkedIn rejected it and nothing was created. Anything
      // else (timeout, reset, 5xx) may have created the post: never retry blind.
      if (error instanceof LinkedInError && error.status >= 400 && error.status < 500) throw error;
      throw new LinkedInError(`Unknown outcome: LinkedIn may have published this post. Check the page before setting it back to approved. (${error.message})`, {uncertain: true});
    }
    const id = response.headers.get('x-restli-id') || '';
    return {id, url: postUrl(id), media: mediaUrn || null};
  }

  return {api, uploadMedia, whoAmI, publish};
}

export async function fileExists(relativePath, root = ROOT) {
  try { await stat(resolve(root, relativePath)); return true; } catch { return false; }
}
