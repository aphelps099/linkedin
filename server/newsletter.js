import express from 'express';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, access, open, link, unlink, readFile, writeFile, rename} from 'node:fs/promises';
import {constants} from 'node:fs';

const CONSENT = 'Occasional emails from LinkedIn Beats about new merch and music.';
const MONTHLY_CONSENT = 'Monthly emails from LinkedIn Beats about new music, tools, and merch.';

// One private record per address, on the mounted volume. No emails are sent here.
// Publishing a record with link() is atomic and also deduplicates concurrent joins.
async function saveSubscriber(directory, email, profile, source) {
  const filename = createHash('sha256').update(email).digest('hex') + '.json';
  const temporary = path.join(directory, `.${randomUUID()}.tmp`);
  const destination = path.join(directory, filename);
  const subscribedAt = new Date().toISOString();
  const monthly = source === 'home-monthly' || source === 'site-footer';
  const monthlyOptIn = monthly ? {source, consent:MONTHLY_CONSENT, consentVersion:2, subscribedAt} : undefined;
  const record = {email, subscribedAt, source, consent:monthly?MONTHLY_CONSENT:CONSENT, consentVersion:monthly?2:1,
    ...profile, ...(monthly ? {monthlyOptIn} : {})};
  try {
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(record) + '\n');
      await file.sync();
    } finally { await file.close(); }
    try { await link(temporary, destination); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (monthly) {
        // A store subscriber can join the monthly list without losing the
        // original consent record. Rename publishes the completed update atomically.
        const existing = JSON.parse(await readFile(destination, 'utf8'));
        if (!existing.monthlyOptIn || (profile && (existing.firstName !== profile.firstName || existing.lastName !== profile.lastName))) {
          await writeFile(temporary, JSON.stringify({...existing, ...profile, monthlyOptIn:existing.monthlyOptIn || monthlyOptIn}) + '\n');
          await rename(temporary, destination);
        }
      }
    }
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
      catch { res.status(403).json({error:'Please subscribe from the LinkedIn Beats website.'}); return; }
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
    let profile;
    if (req.body?.source === 'home-monthly' || (req.body?.source === 'site-footer' && (req.body.firstName !== undefined || req.body.lastName !== undefined))) {
      const name = value => typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
      const firstName = name(req.body.firstName), lastName = name(req.body.lastName);
      if (![firstName,lastName].every(value => value.length > 0 && value.length <= 80 && !/[\u0000-\u001f\u007f]/u.test(value))) {
        res.status(400).json({error:'Please enter your first and last name (up to 80 characters each).'}); return;
      }
      profile = {firstName, lastName};
    } else if (req.body?.source && !['store-first-in-line','site-footer'].includes(req.body.source)) {
      res.status(400).json({error:'Please subscribe from the LinkedIn Beats website.'}); return;
    }
    await ready;
    if (!configured) {
      res.status(503).json({error:'Signups are temporarily unavailable. Please try again shortly.'}); return;
    }
    try {
      await saveSubscriber(directory, email, profile, req.body.source || 'store-first-in-line');
      res.json({subscribed:true});
    } catch {
      console.error('newsletter: could not save a signup');
      res.status(503).json({error:'We couldn’t save your email. Please try again shortly.'});
    }
  });
  return {router, ready, isConfigured:() => configured};
}
