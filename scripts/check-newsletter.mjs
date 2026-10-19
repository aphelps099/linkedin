import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp, readdir, readFile, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createNewsletter} from '../server/newsletter.js';

const directory = await mkdtemp(path.join(tmpdir(), 'linkedin-signup-'));
const servers = [];
async function serve(dir) {
  const newsletter = createNewsletter({directory:dir});
  await newsletter.ready;
  const app = express(); app.set('trust proxy', 1); app.use(express.json()); app.use('/api/newsletter', newsletter.router);
  const server = await new Promise(resolve => {const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  servers.push(server);
  const url = `http://127.0.0.1:${server.address().port}/api/newsletter`;
  return {newsletter, post:async(body,headers={}) => {
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  }};
}
try {
  const {newsletter,post} = await serve(directory);
  assert.equal(newsletter.isConfigured(),true);
  assert.equal((await post({email:'not-an-email',consent:true})).status,400);
  assert.equal((await post({email:'person@example.com'})).status,400);
  assert.equal((await post({email:'person@example.com',consent:true},{Origin:'https://unrelated.example'})).status,403);
  assert.equal((await post({email:'bot@example.com',consent:true,website:'filled'})).status,200);
  assert.deepEqual(await readdir(directory),[]);
  const results=await Promise.all([post({email:' Person@Example.com ',consent:true}),post({email:'person@example.com',consent:true})]);
  assert.ok(results.every(result=>result.status===200&&result.body.subscribed));
  const files=await readdir(directory); assert.equal(files.length,1);
  const original=await readFile(path.join(directory,files[0]),'utf8');
  const record=JSON.parse(original);
  assert.equal(record.email,'person@example.com'); assert.equal(record.source,'store-first-in-line');
  assert.ok(record.consent.includes('merch and music')); assert.ok(Date.parse(record.subscribedAt));
  const restarted=await serve(directory);
  assert.equal((await restarted.post({email:'PERSON@example.com',consent:true})).status,200);
  assert.equal(await readFile(path.join(directory,files[0]),'utf8'),original);
  for(let i=0;i<3;i++) await post({email:'person@example.com',consent:true});
  assert.equal((await post({email:'person@example.com',consent:true})).status,429);
  const unavailable=await serve(undefined);
  assert.equal(unavailable.newsletter.isConfigured(),false);
  assert.equal((await unavailable.post({email:'person@example.com',consent:true})).status,503);
  const monthly = await serve(directory);
  const signup = {source:'home-monthly',firstName:' Taylor ',lastName:' O’Neil ',email:'taylor@example.com',consent:true};
  assert.equal((await monthly.post({...signup,firstName:''})).status,400);
  assert.equal((await monthly.post({...signup,lastName:'x'.repeat(81)})).status,400);
  assert.equal((await monthly.post({...signup,firstName:{value:'Taylor'}})).status,400);
  assert.equal((await monthly.post({...signup,consent:false})).status,400);
  const joined = await Promise.all([monthly.post(signup),monthly.post(signup)]);
  assert.ok(joined.every(result=>result.status===200&&result.body.subscribed));
  const records = await Promise.all((await readdir(directory)).map(async filename => ({filename,record:JSON.parse(await readFile(path.join(directory,filename),'utf8'))})));
  assert.equal(records.length,2,'concurrent monthly joins must deduplicate');
  const saved = records.find(item=>item.record.email==='taylor@example.com');
  assert.equal(saved.record.firstName,'Taylor'); assert.equal(saved.record.lastName,'O’Neil');
  assert.equal(saved.record.source,'home-monthly'); assert.equal(saved.record.consentVersion,2);
  assert.equal(saved.record.monthlyOptIn.consent,'Monthly emails from LinkedIn Beats about new music, tools, and merch.');
  assert.equal((await stat(path.join(directory,saved.filename))).mode & 0o777,0o600);
  const beforeDuplicate = await readFile(path.join(directory,saved.filename),'utf8');
  assert.equal((await monthly.post(signup)).status,200);
  assert.equal(await readFile(path.join(directory,saved.filename),'utf8'),beforeDuplicate);
  assert.equal((await monthly.post({...signup,email:'person@example.com'})).status,200);
  const upgraded = JSON.parse(await readFile(path.join(directory,files[0]),'utf8'));
  assert.equal(upgraded.firstName,'Taylor'); assert.equal(upgraded.lastName,'O’Neil');
  assert.deepEqual(upgraded.monthlyOptIn.consentVersion,2);
  assert.equal(upgraded.consent,record.consent,'joining monthly must preserve the original store consent');
  assert.equal(upgraded.subscribedAt,record.subscribedAt);
  assert.equal((await monthly.post({...signup,source:'unrecognized'},{'X-Forwarded-For':'192.0.2.7'})).status,400);
  const afterRestart = await serve(directory);
  assert.equal((await afterRestart.post(signup)).status,200);
  assert.equal(await readFile(path.join(directory,saved.filename),'utf8'),beforeDuplicate);
  console.log('PASS: email/name validation, monthly consent and profile persistence, private permissions, duplicate and existing-store signups, cross-origin rejection, bot decoy, rate limiting and storage failures.');
} finally {
  await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));
  await rm(directory,{recursive:true,force:true});
}
