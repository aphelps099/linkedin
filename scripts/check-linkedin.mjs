import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLinkedInRouter,linkedInPlainText} from '../server/linkedin.js';
import {createLinkedInSessionStore} from '../server/linkedin-session-store.js';

// All provider calls are simulated. This suite never contacts LinkedIn or posts.
assert.equal(linkedInPlainText('Q4 (aligned) #growth @team'),String.raw`Q4 \(aligned\) \#growth \@team`);
const directory=await mkdtemp(join(tmpdir(),'lb-linkedin-test-'));
const origin='https://linkedinbeats.com';
const env={LINKEDIN_CLIENT_ID:'test-client',LINKEDIN_CLIENT_SECRET:'test-secret',LINKEDIN_REDIRECT_URI:`${origin}/api/auth/linkedin/callback`,LINKEDIN_DATA_DIR:directory};
let exchanges=0,posts=0,initializations=0,owner='',postBody=null,uncertain=false,badUpload=false,parts=[],imageRead=false;
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}});
async function provider(url,options={}){
  const body=options.body instanceof URLSearchParams?Object.fromEntries(options.body):typeof options.body==='string'?JSON.parse(options.body):null;
  if(url.endsWith('/oauth/v2/accessToken')){exchanges++;assert.equal(body.redirect_uri,env.LINKEDIN_REDIRECT_URI);return json({access_token:'private-provider-token',expires_in:3600,scope:'openid profile w_member_social'});}
  if(url.endsWith('/v2/userinfo'))return json({sub:'member-123',name:'Test Member',email:'must-not-store@example.com',picture:'must-not-store'});
  if(url.includes('action=initializeUpload')){
    initializations++;owner=body.initializeUploadRequest.owner;
    if(url.includes('/images'))return json({value:{image:'urn:li:image:image1',uploadUrl:'https://www.linkedin.com/dms-uploads/image'}});
    const n=body.initializeUploadRequest.fileSizeBytes;
    return json({value:{video:'urn:li:video:video1',uploadToken:'part-token',uploadInstructions:[{firstByte:0,lastByte:39999,uploadUrl:badUpload?'https://attacker.example/upload':'https://www.linkedin.com/dms-uploads/part1'},{firstByte:40000,lastByte:n-1,uploadUrl:'https://www.linkedin.com/dms-uploads/part2'}]}});
  }
  if(url.includes('/dms-uploads/')){parts.push(options.body.length);if(url.endsWith('/image'))assert.equal(options.headers.Authorization,'Bearer private-provider-token');else assert.equal(options.headers.Authorization,undefined);return new Response('',{headers:{etag:'"part-confirmed"'}});}
  if(url.includes('action=finalizeUpload')){assert.deepEqual(body.finalizeUploadRequest.uploadedPartIds,['part-confirmed','part-confirmed']);return new Response(null,{status:200});}
  if(url.includes('/rest/images/')){imageRead=true;assert.equal(options.headers['LinkedIn-Version'],undefined);return json({status:'AVAILABLE'});}
  if(url.includes('/rest/videos/'))return json({status:'AVAILABLE'});
  if(url.endsWith('/rest/posts')){posts++;postBody=body;if(uncertain)throw Error('simulated lost response');return json({},201,{'x-restli-id':'urn:li:share:12345'});}
  assert.fail(`Unexpected provider request ${url}`);
}
const service=createLinkedInRouter({env,fetchImpl:provider});await service.ready;
const app=express();app.use(service.router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
const call=(path,options={})=>fetch(base+path,{redirect:'manual',...options});
const stateCookie=r=>r.headers.getSetCookie().find(v=>v.startsWith('__Host-lb-linkedin-state=')).split(';')[0];
async function login(){
  const response=await call('/api/auth/linkedin/start',{method:'POST',headers:{Origin:origin}});assert.equal(response.status,200);
  const state=new URL((await response.json()).url).searchParams.get('state');const cookie=stateCookie(response);
  assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/Secure/);assert.match(response.headers.get('set-cookie'),/SameSite=Lax/);
  const result=await call(`/api/auth/linkedin/callback?state=${state}&code=test`,{headers:{Cookie:cookie}});
  assert.match(await result.text(),/Connection established/);
  const sessionCookie=result.headers.getSetCookie().find(v=>v.startsWith('__Host-lb-linkedin=')).split(';')[0];
  const status=await(await call('/api/auth/linkedin/status',{headers:{Cookie:sessionCookie}})).json();
  return {cookie:sessionCookie,status,state};
}
try{
  assert.deepEqual(await(await call('/api/auth/linkedin/status')).json(),{enabled:true,connected:false});
  assert.equal((await call('/api/auth/linkedin/start',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);
  const start=await call('/api/auth/linkedin/start',{method:'POST',headers:{Origin:origin}}),state=new URL((await start.json()).url).searchParams.get('state');
  await call(`/api/auth/linkedin/callback?state=${state}&code=test`);assert.equal(exchanges,0,'state is bound to the initiating browser');
  const a=await login(),headers={Cookie:a.cookie,Origin:origin,'X-CSRF-Token':a.status.csrf};
  assert.equal(a.status.name,'Test Member');assert.equal(a.status.token,undefined);
  await call(`/api/auth/linkedin/callback?state=${a.state}&code=test`,{headers:{Cookie:a.cookie}});assert.equal(exchanges,1,'state is single-use');
  const stored=await readFile(join(directory,(await readdir(directory))[0]));assert(!stored.includes('private-provider-token'));assert(!stored.includes('Test Member'));
  const reopened=createLinkedInSessionStore(directory,env.LINKEDIN_CLIENT_SECRET);assert.equal((await reopened.get(a.cookie.split('=')[1])).token,'private-provider-token');
  assert(!JSON.stringify(await reopened.get(a.cookie.split('=')[1])).includes('must-not-store'),'userinfo is minimized');
  const mp4=Buffer.alloc(80000);mp4.write('ftyp',4);
  assert.equal((await call('/api/linkedin/media',{method:'POST',headers:{...headers,'X-CSRF-Token':'wrong','Content-Type':'video/mp4'},body:mp4})).status,403);
  assert.equal((await call('/api/linkedin/media',{method:'POST',headers:{...headers,Origin:'https://evil.example','Content-Type':'video/mp4'},body:mp4})).status,403);
  assert.equal((await call('/api/linkedin/media',{method:'POST',headers:{...headers,'Content-Type':'video/mp4'},body:Buffer.alloc(80000)})).status,400);
  let media=await(await call('/api/linkedin/media',{method:'POST',headers:{...headers,'Content-Type':'video/mp4'},body:mp4})).json();assert.equal(media.state,'processing');assert.equal(owner,'urn:li:person:member-123');assert.deepEqual(parts,[40000,40000]);
  const again=await(await call('/api/linkedin/media',{method:'POST',headers:{...headers,'Content-Type':'video/mp4'},body:mp4})).json();assert.equal(again.id,media.id);assert.equal(initializations,1,'upload retries reuse the existing asset');
  media=await(await call(`/api/linkedin/media/${media.id}`,{headers})).json();assert.equal(media.state,'ready');
  const b=await login();assert.equal((await call(`/api/linkedin/media/${media.id}`,{headers:{Cookie:b.cookie}})).status,404,'another connection cannot use the uploaded asset');
  const payload={caption:'Reviewed caption',title:'My beat',visibility:'CONNECTIONS',confirm:true};
  const publish=body=>call(`/api/linkedin/media/${media.id}/publish`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await publish({...payload,confirm:false})).status,400);assert.equal(posts,0);
  const posted=await(await publish(payload)).json();assert.equal(posted.state,'published');assert.equal(postBody.author,'urn:li:person:member-123');assert.equal(postBody.commentary,payload.caption);assert.equal(postBody.visibility,'CONNECTIONS');
  assert.equal((await publish(payload)).status,200);assert.equal(posts,1,'repeat publish must not duplicate the post');
  const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
  media=await(await call('/api/linkedin/media',{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:png})).json();
  media=await(await call(`/api/linkedin/media/${media.id}`,{headers})).json();assert.equal(media.state,'ready');assert(imageRead);
  uncertain=true;assert.equal((await publish(payload)).status,502);assert.equal(posts,2);
  assert.equal((await publish(payload)).status,409);assert.equal(posts,2,'an uncertain upstream result must never be automatically reposted');
  badUpload=true;mp4[30]=1;assert.equal((await call('/api/linkedin/media',{method:'POST',headers:{...headers,'Content-Type':'video/mp4'},body:mp4})).status,502,'unexpected upload hosts are rejected');
  assert.equal((await call('/api/auth/linkedin/disconnect',{method:'POST',headers})).status,200);
  assert.equal((await(await call('/api/auth/linkedin/status',{headers})).json()).connected,false);
  assert.equal(await reopened.get(a.cookie.split('=')[1]),null,'disconnect deletes the token and publishing records');
  console.log('LinkedIn checks passed: OAuth state and cookie binding, replay, CSRF, encrypted restart-safe sessions, data minimization, multipart upload, owner isolation, image auth, explicit consent, idempotent publishing, ambiguous failures, upload-host restrictions, disconnect. No real posts created.');
}finally{service.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
