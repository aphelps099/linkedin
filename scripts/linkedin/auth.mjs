#!/usr/bin/env node
// One-time (well, every 60 days) OAuth helper. Opens LinkedIn's consent page,
// catches the redirect on localhost, exchanges the code and writes
// scripts/linkedin/token.local.json, which git ignores.
//
//   LINKEDIN_CLIENT_ID=... LINKEDIN_CLIENT_SECRET=... npm run linkedin:auth
//   npm run linkedin:auth -- --organization   (adds page scopes; needs the approved product)
//
// Add http://localhost:8787/callback to the app's authorized redirect URLs first.
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {TOKEN_PATH} from './lib.mjs';

const args = process.argv.slice(2);
const wantsOrganization = args.includes('--organization');
const port = Number(process.env.LINKEDIN_AUTH_PORT || 8787);
const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
if (!clientId || !clientSecret) {
  console.error('Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET from the LinkedIn developer app (Auth tab).');
  process.exit(1);
}
const redirectUri = `http://localhost:${port}/callback`;
const scopes = ['openid', 'profile', 'w_member_social', ...(wantsOrganization ? ['w_organization_social', 'r_organization_social'] : [])];
const state = randomBytes(16).toString('hex');
const authorizeUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
for (const [key, value] of Object.entries({response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state, scope: scopes.join(' ')})) authorizeUrl.searchParams.set(key, value);

const page = (title, body) => `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="background:#101319;color:#fff;font:18px/1.5 system-ui;padding:8vw;max-width:600px"><p style="color:#8bb5ff">LINKED BEATS</p><h1>${title}</h1><p>${body}</p>`;

const code = await new Promise((resolveCode, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, redirectUri);
    if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
    const done = (status, title, body) => { res.writeHead(status, {'Content-Type': 'text/html; charset=utf-8'}).end(page(title, body)); server.close(); };
    if (url.searchParams.get('state') !== state) { done(400, 'State mismatch.', 'Start the helper again.'); reject(new Error('state mismatch')); return; }
    if (url.searchParams.get('error')) { done(400, 'Authorization paused.', url.searchParams.get('error_description') || 'LinkedIn did not authorize the app.'); reject(new Error(url.searchParams.get('error'))); return; }
    done(200, 'Connection established.', 'You can close this window and return to the terminal.');
    resolveCode(url.searchParams.get('code'));
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`\nOpen this URL and approve the app:\n\n${authorizeUrl.href}\n`);
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try { spawn(opener, [authorizeUrl.href], {stdio: 'ignore', detached: true}).on('error', () => {}).unref(); } catch {}
  });
  setTimeout(() => { server.close(); reject(new Error('Timed out waiting for the redirect (10 minutes).')); }, 600000).unref();
});

const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret})});
if (!tokenResponse.ok) { console.error('Token exchange failed:', tokenResponse.status, await tokenResponse.text()); process.exit(1); }
const token = await tokenResponse.json();
const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {headers: {Authorization: `Bearer ${token.access_token}`}});
if (!profileResponse.ok) { console.error('Could not read the member profile:', profileResponse.status); process.exit(1); }
const profile = await profileResponse.json();
const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
const record = {access_token: token.access_token, expires_at: expiresAt, scope: token.scope || scopes.join(' '), person_urn: `urn:li:person:${profile.sub}`, name: profile.name || '', created_at: new Date().toISOString()};
await writeFile(TOKEN_PATH, `${JSON.stringify(record, null, 2)}\n`, {mode: 0o600});

console.log(`Connected as ${record.name || profile.sub}.`);
console.log(`Person URN:  ${record.person_urn}`);
console.log(`Scopes:      ${record.scope}`);
console.log(`Expires:     ${expiresAt} (60 days by default; LinkedIn issues no refresh token to self-serve apps)`);
console.log(`Saved to:    ${TOKEN_PATH}\n`);
console.log('For GitHub Actions, set these repository secrets:');
console.log('  LINKEDIN_ACCESS_TOKEN      the access_token above (never commit it)');
console.log(`  LINKEDIN_AUTHOR_URN        ${record.person_urn}  (or urn:li:organization:<page id> once Community Management is approved)`);
console.log(`and the repository variable LINKEDIN_TOKEN_EXPIRES_AT=${expiresAt} so the publisher can warn before it lapses.`);
if (wantsOrganization) console.log('\nThe page id is the number in the admin URL: linkedin.com/company/<id>/admin/.');
