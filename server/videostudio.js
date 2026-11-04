import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Same-origin media for the Video Studio compositor.
//
//   GET|HEAD /api/videostudio/media/:key
//
// 1. A local proxy (public/videostudio/proxies/<key>, or the same path under
//    dist/) is served from disk.
// 2. Otherwise the object media/<key> is streamed from the Cutting Room bucket
//    through this server. In production that is the signed bucket URL (the
//    same signer as server/cutting-room.js); in local dev without bucket
//    credentials it is https://linkedinbeats.com/api/cutting-room/media/<key>,
//    whose 302 is followed server-side. Signed URLs never reach the browser.
// 3. A forward proxy key that the bucket does not have yet falls back to the
//    shot's master, so the compositor never sees a hole before Aaron uploads.
//
// Range requests return 206 with Content-Range and Content-Length. Keys that
// end in an 8-hex content hash (every master and proxy key the shot index
// writes) are cached immutable for a year. Being same-origin, the bytes can be
// uploaded to WebGL with no CORS headers.

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const VALID_KEY = /^[a-z0-9][a-z0-9-]{1,110}\.(mp4|jpg|webp)$/;
const HASHED_KEY = /-[0-9a-f]{8}\.(mp4|jpg|webp)$/;
const TYPES = {mp4:'video/mp4', jpg:'image/jpeg', webp:'image/webp'};
const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];
const IMMUTABLE = 'public, max-age=31536000, immutable';
const SHORT = 'public, max-age=300';

export const isValidMediaKey = key => VALID_KEY.test(key);
export const isHashedMediaKey = key => HASHED_KEY.test(key);

// Forward-proxy key -> the master to stream when the proxy is missing.
function loadFallbacks(file) {
  const map = new Map();
  try {
    const index = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const shot of index.shots || []) {
      if (!shot.proxy) continue;
      const key = shot.proxy.split('/').pop();
      if (shot.src.startsWith('/api/videostudio/media/')) map.set(key, {remote:shot.src.split('/').pop()});
      else map.set(key, {local:shot.src.replace(/^\//, '')});
    }
  } catch {}
  return map;
}

export function createVideoStudioRouter({
  env = process.env,
  proxyDirs = [path.join(root, 'public/videostudio/proxies'), path.join(root, 'dist/videostudio/proxies')],
  staticDirs = [path.join(root, 'dist'), path.join(root, 'public')],
  origin = env.VIDEOSTUDIO_MEDIA_ORIGIN || null,
  shotIndex = path.join(root, 'src/videostudio/media/shots.json'),
  fetchImpl = globalThis.fetch,
} = {}) {
  const router = express.Router();
  const fallbacks = loadFallbacks(shotIndex);
  let client;
  const hasBucket = () => Boolean(env.CATALOG_S3_BUCKET && env.CATALOG_S3_ENDPOINT);
  const storage = () => client ||= new S3Client({
    endpoint:env.CATALOG_S3_ENDPOINT, region:env.CATALOG_S3_REGION || 'auto',
    credentials:{accessKeyId:env.CATALOG_S3_ACCESS_KEY, secretAccessKey:env.CATALOG_S3_SECRET_KEY},
    requestChecksumCalculation:'WHEN_REQUIRED', responseChecksumValidation:'WHEN_REQUIRED',
  });
  async function upstreamUrl(key) {
    if (hasBucket()) return getSignedUrl(storage(), new GetObjectCommand({Bucket:env.CATALOG_S3_BUCKET, Key:`media/${key}`}), {expiresIn:600});
    if (origin) return `${origin.replace(/\/$/, '')}/api/cutting-room/media/${key}`;
    return null;
  }
  // A fallback answers a proxy key with master bytes: never pin that for a year.
  const cacheFor = (req, source) => source !== 'master' && isHashedMediaKey(req.params.key) ? IMMUTABLE : SHORT;

  function sendLocal(req, res, file, key, source) {
    res.set('X-Videostudio-Source', source);
    res.sendFile(file, {
      acceptRanges:true, lastModified:true, etag:true, cacheControl:false, dotfiles:'deny',
      headers:{'Cache-Control':cacheFor(req, source), 'Content-Type':TYPES[key.split('.').pop()]},
    }, err => { if (err && !res.headersSent) res.sendStatus(err.statusCode || 404); });
  }

  // Streams media/<key> from the bucket. Resolves false on a 404 so the caller
  // can try the master instead; true once a response has been sent.
  async function sendRemote(req, res, key, source) {
    const url = await upstreamUrl(key);
    if (!url) { res.status(503).json({error:'Media storage unavailable'}); return true; }
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const headers = {};
    const head = req.method === 'HEAD';
    // A signed URL is signed for GET, so HEAD asks for one byte and reports the total.
    if (head) headers.range = 'bytes=0-0';
    else if (req.headers.range) headers.range = req.headers.range;
    if (req.headers['if-none-match']) headers['if-none-match'] = req.headers['if-none-match'];
    let upstream;
    try {
      upstream = await fetchImpl(url, {headers, redirect:'follow', signal:controller.signal});
    } catch (error) {
      if (!res.headersSent && !controller.signal.aborted) res.status(502).json({error:'This clip is temporarily unavailable.'});
      return true;
    }
    if (upstream.status === 404 || upstream.status === 403) { upstream.body?.cancel().catch(() => {}); return false; }
    if (![200, 206, 304, 416].includes(upstream.status)) {
      upstream.body?.cancel().catch(() => {});
      res.status(502).json({error:'This clip is temporarily unavailable.'});
      return true;
    }
    res.set('X-Videostudio-Source', source);
    res.set('Accept-Ranges', 'bytes');
    if (head) {
      const total = /\/(\d+)$/.exec(upstream.headers.get('content-range') || '')?.[1] || upstream.headers.get('content-length');
      res.status(200);
      res.set({'Content-Type':TYPES[key.split('.').pop()], 'Cache-Control':cacheFor(req, source)});
      if (total) res.set('Content-Length', total);
      upstream.body?.cancel().catch(() => {});
      res.end();
      return true;
    }
    res.status(upstream.status);
    for (const name of PASS_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) res.set(name, value);
    }
    if (!upstream.headers.get('content-type') || /octet-stream/.test(upstream.headers.get('content-type'))) res.set('Content-Type', TYPES[key.split('.').pop()]);
    res.set('Cache-Control', upstream.status === 416 ? 'no-store' : cacheFor(req, source));
    if (!upstream.body || upstream.status === 304) { res.end(); return true; }
    const body = Readable.fromWeb(upstream.body);
    body.on('error', () => res.destroy());
    body.pipe(res);
    return true;
  }

  const findLocal = (dirs, rel) => {
    for (const dir of dirs) {
      const file = path.join(dir, rel);
      if (file.startsWith(dir + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    }
    return null;
  };

  async function handle(req, res) {
    const {key} = req.params;
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (!isValidMediaKey(key)) return res.sendStatus(404);
    const local = findLocal(proxyDirs, key);
    if (local) return sendLocal(req, res, local, key, 'proxy');
    if (await sendRemote(req, res, key, 'bucket')) return;
    const master = fallbacks.get(key);
    if (master?.local) {
      const file = findLocal(staticDirs, master.local);
      if (file) return sendLocal(req, res, file, key, 'master');
    }
    if (master?.remote && await sendRemote(req, res, master.remote, 'master')) return;
    if (!res.headersSent) res.status(404).json({error:'Not found'});
  }
  // GET also answers HEAD (Express routes HEAD to GET handlers).
  router.get('/media/:key', (req, res) => { handle(req, res).catch(() => { if (!res.headersSent) res.sendStatus(500); }); });
  return router;
}

// Vite dev server: the same route, with linkedinbeats.com as the upstream when
// no bucket credentials are present (mirrors the cutting-room dev proxy).
export function videoStudioMediaApi() {
  return {name:'videostudio-media', configureServer(server) {
    const app = express();
    app.use('/api/videostudio', createVideoStudioRouter({origin:process.env.VIDEOSTUDIO_MEDIA_ORIGIN || 'https://linkedinbeats.com'}));
    server.middlewares.use((req, res, next) => req.url?.startsWith('/api/videostudio/') ? app(req, res, next) : next());
  }};
}
