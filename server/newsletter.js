import express from 'express';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, access, open, link, unlink} from 'node:fs/promises';
import {constants} from 'node:fs';

const CONSENT = 'Occasional emails from LinkedIn Beats about new merch and music.';

// One private record per address, on the mounted volume. No emails are sent here.
// Publishing a record with link() is atomic and also deduplicates concurrent joins.
async function saveSubscriber(directory, email) {
  const filename = createHash('sha256').update(email).digest('hex') + '.json';
  const temporary = path.join(directory, `.${randomUUID()}.tmp`);
  try {
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify({email, subscribedAt:new Date().toISOString(), source:'store-first-in-line', consent:CONSENT, consentVersion:1}) + '\n');
      await file.sync();
    } finally { await file.close(); }
    try { await link(temporary, path.join(directory, filename)); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  } finally { await unlink(temporary).catch(() => {}); }
}

export function createNewsletter({directory}) {
  const router = express.Router();
  let configured = false;
  const ready = directory ? mkdir(directory, {recursive:true, mode:0o700})
    .then(() => access(directory, constants.W_OK))
    .then(() => {configured = true;})
    .catch(() => {console.error('newsletter: persistent storage is unavailable');}) : Promise.resolve();
  const requests = new Map();
  const windowMs = 15 * 60 * 1000;

  router.post('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (origin) {
      try { if (new URL(origin).host !== req.get('host')) throw new Error(); }
      catch { res.status(403).json({error:'Please subscribe from the LinkedIn Beats store.'}); return; }
    }
    const now = Date.now();
    for (const [key, value] of requests) if (value.until <= now) requests.delete(key);
    const key = req.ip;
    const bucket = requests.get(key) || {count:0, until:now + windowMs};
    if (bucket.count >= 8 || (!requests.has(key) && requests.size >= 10000)) {
      res.set('Retry-After', String(Math.ceil((bucket.until-now)/1000)));
      res.status(429).json({error:'A few too many attempts. Please try again in 15 minutes.'}); return;
    }
    bucket.count++; requests.set(key, bucket);
    // The decoy field should remain empty. Do not save or send anything for bots.
    if (req.body?.website) { res.json({subscribed:true}); return; }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const parts = email.split('@');
    if (email.length > 254 || parts[0].length > 64 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
      res.status(400).json({error:'Please enter a valid email address.'}); return;
    }
    if (req.body?.consent !== true) {
      res.status(400).json({error:'Please agree to receive LinkedIn Beats emails.'}); return;
    }
    await ready;
    if (!configured) {
      res.status(503).json({error:'Signups are temporarily unavailable. Please try again shortly.'}); return;
    }
    try {
      await saveSubscriber(directory, email);
      res.json({subscribed:true});
    } catch {
      console.error('newsletter: could not save a signup');
      res.status(503).json({error:'We couldn’t save your email. Please try again shortly.'});
    }
  });
  return {router, ready, isConfigured:() => configured};
}
