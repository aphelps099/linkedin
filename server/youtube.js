import express from 'express';
import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {existsSync, readFileSync} from 'node:fs';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import path from 'node:path';

export const CHANNEL_ID = 'UCek60SLgrY7-XX03sz1A_fg';
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const seed = JSON.parse(readFileSync(new URL('../src/youtube/catalog.json', import.meta.url), 'utf8'));
const parser = new XMLParser({ignoreAttributes:false, parseTagValue:false, processEntities:true});
const validId = /^[\w-]{11}$/;

export function normalizeVideo(item) {
  if (!item || !validId.test(item.id) || typeof item.title !== 'string' || !item.title.trim()) return null;
  const kind = item.kind === 'short' ? 'short' : 'video';
  return {id:item.id, title:item.title.slice(0,300), kind,
    url:kind === 'short' ? `https://www.youtube.com/shorts/${item.id}` : `https://www.youtube.com/watch?v=${item.id}`,
    thumbnail:`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    publishedAt:Number.isFinite(Date.parse(item.publishedAt)) ? new Date(item.publishedAt).toISOString() : null,
    description:typeof item.description === 'string' ? item.description.slice(0,3000) : ''};
}

export function parseFeed(xml) {
  if (xml.length > 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid YouTube feed');
  const feed = parser.parse(xml).feed;
  if (!feed || ![CHANNEL_ID, CHANNEL_ID.slice(2)].includes(feed['yt:channelId'])) throw new Error('Unexpected YouTube channel');
  const entries = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];
  return entries.filter(entry => entry['yt:channelId'] === CHANNEL_ID).map(entry => {
    const links = Array.isArray(entry.link) ? entry.link : [entry.link];
    const href = links.find(link => link?.['@_rel'] === 'alternate')?.['@_href'] || '';
    return normalizeVideo({id:entry['yt:videoId'], title:entry.title,
      kind:href.startsWith('https://www.youtube.com/shorts/') ? 'short' : 'video',
      publishedAt:entry.published, description:entry['media:group']?.['media:description']});
  }).filter(Boolean);
}

export function mergeVideos(previous, incoming, excluded = []) {
  const hidden = new Set(excluded);
  const merged = new Map();
  for (const item of [...previous, ...incoming]) {
    const video = normalizeVideo(item);
    if (video && !hidden.has(video.id)) merged.set(video.id, video);
  }
  return [...merged.values()].sort((a,b) => (Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
}

export function createYouTubeFeed({fetchImpl=fetch, now=Date.now,
  file=process.env.YOUTUBE_ARCHIVE_FILE || path.join(existsSync('/data') ? '/data' : '.cache', 'youtube-archive.json'),
  excluded=(process.env.YOUTUBE_EXCLUDE_IDS || '').split(',').map(id=>id.trim()),
}={}) {
  let items=mergeVideos([],seed,excluded), updatedAt=null, nextRefresh=0, pending;
  const ready=readFile(file,'utf8').then(raw=>{
    const saved=JSON.parse(raw);
    if (Array.isArray(saved.items)) items=mergeVideos(items,saved.items,excluded);
    updatedAt=saved.updatedAt || null;
  }).catch(()=>{});
  async function refresh() {
    try {
      const response=await fetchImpl(FEED,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/atom+xml'}});
      if(!response.ok) throw new Error('YouTube unavailable');
      const fresh=parseFeed(await response.text());
      items=mergeVideos(items,fresh,excluded);
      updatedAt=new Date(now()).toISOString();
      nextRefresh=now()+15*60*1000;
      try {
        await mkdir(path.dirname(file),{recursive:true});
        await writeFile(`${file}.tmp`,JSON.stringify({items,updatedAt}));
        await rename(`${file}.tmp`,file);
      } catch { console.warn('YouTube archive persistence unavailable; serving memory cache.'); }
      return {items,updatedAt,stale:false};
    } catch {
      nextRefresh=now()+60*1000;
      return {items,updatedAt,stale:true};
    }
  }
  let stale=true;
  return async () => {
    await ready;
    if(now() >= nextRefresh) {
      if(!pending) pending=refresh().then(result=>{stale=result.stale;return result;}).finally(()=>{pending=null;});
      return pending;
    }
    return {items,updatedAt,stale};
  };
}

export function createYouTubeRouter(options) {
  const router=express.Router(), getFeed=createYouTubeFeed(options);
  router.get('/',async (_req,res)=>{
    const feed=await getFeed();
    res.set('Cache-Control',feed.stale?'public, max-age=60':'public, max-age=300').json(feed);
  });
  return router;
}
