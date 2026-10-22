import express from 'express';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {join,dirname} from 'node:path';
import {createLinkedInSessionStore} from './linkedin-session-store.js';

const random=()=>randomBytes(32).toString('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const fail=(status,message,code)=>Object.assign(new Error(message),{status,code});
const cookie=(req,name)=>String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1);
const DAY=86400000;
// Posts API parses "little" markup. Preserve user-entered punctuation literally.
export const linkedInPlainText=text=>text.replace(/[|{}@\[\]()<>#\\*_~]/g,char=>`\\${char}`);
export function createLinkedInRouter({env=process.env,fetchImpl=fetch,store:providedStore}={}){
  const router=express.Router(),pending=new Map(),limits=new Map(),busy=new Set();
  const clientId=env.LINKEDIN_CLIENT_ID?.trim(),secret=env.LINKEDIN_CLIENT_SECRET?.trim(),redirectUri=env.LINKEDIN_REDIRECT_URI?.trim();
  let origin='';try{const u=new URL(redirectUri);if(u.protocol==='https:'&&u.pathname==='/api/auth/linkedin/callback'&&!u.search&&!u.hash)origin=u.origin;}catch{}
  const directory=env.LINKEDIN_DATA_DIR||(env.NEWSLETTER_DATA_DIR?join(dirname(env.NEWSLETTER_DATA_DIR),'linkedin-auth'):env.RENDER?'/data/linkedin-auth':null);
  const configured=Boolean(clientId&&secret&&origin&&(directory||providedStore));
  const store=configured?(providedStore||createLinkedInSessionStore(directory,secret)):null;
  let storageReady=false;
  const ready=store?store.ready.then(()=>store.prune()).then(()=>{storageReady=true;}).catch(()=>console.error('linkedin: private session storage unavailable')):Promise.resolve();
  const timer=setInterval(()=>{for(const [key,value] of pending)if(value.expires<Date.now())pending.delete(key);for(const [key,value] of limits)if(value.until<Date.now())limits.delete(key);store?.prune().catch(()=>{});},3600000);timer.unref();
  const sessionCookie='__Host-lb-linkedin',stateCookie='__Host-lb-linkedin-state';
  const cookieOptions={httpOnly:true,secure:true,sameSite:'lax',path:'/'};
  router.use(['/api/auth/linkedin','/api/linkedin'],(_req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});next();});
  const available=async(_req,_res,next)=>{await ready;next(configured&&storageReady?undefined:fail(503,'LinkedIn connection is not configured yet.'));};
  const sameOrigin=(req,_res,next)=>next(req.get('origin')===origin?undefined:fail(403,'Open sharing on LinkedIn Beats and try again.'));
  const rate=(req,_res,next)=>{
    const key=req.ip||'unknown',now=Date.now();let item=limits.get(key);
    if(!item||item.until<now){if(limits.size>5000)return next(fail(429,'Please try again shortly.'));item={count:0,until:now+15*60000};limits.set(key,item);}
    next(++item.count>30?fail(429,'Please wait a few minutes before trying again.'):undefined);
  };
  const auth=async(req,_res,next)=>{try{req.liId=cookie(req,sessionCookie);req.li=await store.get(req.liId);next(req.li?undefined:fail(401,'Connect LinkedIn to continue.','connect_required'));}catch{next(fail(503,'The connection could not be loaded. Try again.'));}};
  const csrf=(req,_res,next)=>next(equal(req.get('x-csrf-token'),req.li.csrf)?undefined:fail(403,'Refresh the sharing window and try again.'));
  const exclusive=async(req,_res,next)=>{if(busy.has(req.liId))return next(fail(409,'Another sharing request is still running.'));busy.add(req.liId);req.liLock=true;try{req.li=await store.get(req.liId);next(req.li?undefined:fail(401,'Connect LinkedIn to continue.'));}catch{next(fail(503,'The connection could not be loaded.'));}};
  const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next).finally(()=>{if(req.liLock){busy.delete(req.liId);req.liLock=false;}});
  async function api(session,path,{method='GET',body,legacy=false}={}){
    const response=await fetchImpl(`https://api.linkedin.com${path}`,{method,redirect:'error',signal:AbortSignal.timeout(25000),headers:{Authorization:`Bearer ${session.token}`,...(legacy?{}:{'LinkedIn-Version':env.LINKEDIN_API_VERSION||'202610'}),'X-Restli-Protocol-Version':'2.0.0',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok){const error=fail(response.status===401?401:response.status===429?429:502,response.status===401?'Your LinkedIn connection expired. Reconnect to continue.':response.status===403?'LinkedIn denied access. Check the app’s Share on LinkedIn product and reconnect.':response.status===429?'LinkedIn is limiting requests. Try again later.':'LinkedIn could not complete this request. Please try again.');error.providerStatus=response.status;throw error;}
    return response;
  }
  async function upload(url,bytes,token){
    const u=new URL(url);
    if(u.protocol!=='https:'||u.username||u.password||u.port||!['linkedin.com','licdn.com'].some(host=>u.hostname===host||u.hostname.endsWith(`.${host}`)))throw fail(502,'LinkedIn returned an unexpected upload destination.');
    const response=await fetchImpl(url,{method:'PUT',redirect:'error',headers:{'Content-Type':'application/octet-stream',...(token?{Authorization:`Bearer ${token}`}:{})},body:bytes,signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw fail(502,'The media upload did not finish. Please try again.');
    return response.headers.get('etag')?.replace(/^"|"$/g,'');
  }
  const publicMedia=media=>({id:media.id,state:media.state,url:media.url||null});
  function getMedia(req){const media=req.li.media.find(m=>m.id===req.params.id);if(!media)throw fail(404,'This preview has expired. Prepare it again.');return media;}

  router.get('/api/auth/linkedin/status',wrap(async(req,res)=>{await ready;const enabled=configured&&storageReady,session=enabled?await store.get(cookie(req,sessionCookie)):null;res.json({enabled,connected:!!session,...(session?{name:session.name,csrf:session.csrf}:{})});}));
  router.post('/api/auth/linkedin/start',available,sameOrigin,rate,wrap(async(req,res)=>{
    if(pending.size>=2000)throw fail(429,'Please try connecting again shortly.');
    const state=random(),binding=random();pending.set(state,{binding,expires:Date.now()+10*60000});
    res.cookie(stateCookie,binding,{...cookieOptions,maxAge:10*60000});
    const url=new URL('https://www.linkedin.com/oauth/v2/authorization');
    for(const [key,value] of Object.entries({response_type:'code',client_id:clientId,redirect_uri:redirectUri,state,scope:'openid profile w_member_social'}))url.searchParams.set(key,value);
    res.json({url:url.href});
  }));
  function callbackPage(res,ok,message){
    const nonce=random();res.set({'Content-Security-Policy':`default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`});
    res.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LinkedIn connection — LinkedIn Beats</title><body style="background:#101319;color:#fff;font:18px/1.5 system-ui;padding:8vw;max-width:600px"><p style="color:#8bb5ff">LINKEDIN BEATS</p><h1>${ok?'Connection established.':'Connection paused.'}</h1><p>${message}</p><p>You can close this window and return to your preview.</p><a style="color:#8bb5ff" href="/lessons/">Back to LinkedIn Beats</a><script nonce="${nonce}">if(window.opener){window.opener.postMessage({type:'linkedin-connected',ok:${ok}},${JSON.stringify(origin)});if(${ok})setTimeout(()=>window.close(),500);}</script></body></html>`);
  }
  router.get('/api/auth/linkedin/callback',available,wrap(async(req,res)=>{
    const state=typeof req.query.state==='string'?req.query.state:'',entry=pending.get(state);
    if(!entry||entry.expires<Date.now()||!equal(entry.binding,cookie(req,stateCookie)))return callbackPage(res,false,'This connection request expired or belongs to another browser. Please start again from your sharing preview.');
    pending.delete(state);res.clearCookie(stateCookie,cookieOptions);
    if(req.query.error)return callbackPage(res,false,'Authorization was not completed. Your preview is still waiting for you.');
    if(typeof req.query.code!=='string'||req.query.code.length>4096)return callbackPage(res,false,'LinkedIn did not return an authorization code. Please try again.');
    try{
      const response=await fetchImpl('https://www.linkedin.com/oauth/v2/accessToken',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code:req.query.code,redirect_uri:redirectUri,client_id:clientId,client_secret:secret})});
      if(!response.ok)throw Error('token');const token=await response.json();
      if(!token.access_token||!Number.isFinite(token.expires_in)||token.expires_in<=0)throw Error('token');
      if(token.scope&&!['openid','profile','w_member_social'].every(s=>token.scope.split(/[ ,]+/).includes(s)))throw Error('scope');
      const profileResponse=await fetchImpl('https://api.linkedin.com/v2/userinfo',{redirect:'error',headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(15000)});
      if(!profileResponse.ok)throw Error('profile');const profile=await profileResponse.json();
      if(!/^[A-Za-z0-9_-]{1,128}$/.test(profile.sub||''))throw Error('profile');
      const id=random(),expires=Date.now()+Math.min(token.expires_in*1000,30*DAY);
      await store.put(id,{token:token.access_token,person:`urn:li:person:${profile.sub}`,name:String(profile.name||'LinkedIn member').slice(0,100),csrf:random(),expires,media:[]});
      const previous=cookie(req,sessionCookie);if(/^[a-f0-9]{64}$/.test(previous||''))await store.remove(previous);
      res.cookie(sessionCookie,id,{...cookieOptions,maxAge:expires-Date.now()});callbackPage(res,true,'You are connected. Nothing has been posted. Review your caption and choose Publish when you are ready.');
    }catch{callbackPage(res,false,'We could not finish connecting. Check that both LinkedIn products are enabled and the callback URL matches, then try again.');}
  }));
  router.post('/api/auth/linkedin/disconnect',available,sameOrigin,auth,csrf,exclusive,wrap(async(req,res)=>{await store.remove(req.liId);res.clearCookie(sessionCookie,cookieOptions);res.json({connected:false});}));

  router.post('/api/linkedin/media',available,sameOrigin,auth,csrf,rate,exclusive,express.raw({type:['video/mp4','image/png'],limit:'12mb'}),wrap(async(req,res)=>{
    const bytes=req.body,type=req.is('video/mp4')?'video':req.is('image/png')?'image':null;
    if(!Buffer.isBuffer(bytes)||!type||bytes.length<16||type==='video'&&(bytes.length<75000||bytes.toString('ascii',4,8)!=='ftyp')||type==='image'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw fail(400,'Choose a valid MP4 video or PNG certificate.');
    const digest=createHash('sha256').update(bytes).digest('hex');
    const existing=req.li.media.find(m=>m.digest===digest);if(existing)return res.json(publicMedia(existing));
    req.li.media=req.li.media.filter(m=>m.created>Date.now()-7*DAY);
    if(req.li.media.length>=20)throw fail(429,'You have reached the weekly sharing limit for this connection.');
    let urn;
    if(type==='video'){
      const {value}=await (await api(req.li,'/rest/videos?action=initializeUpload',{method:'POST',body:{initializeUploadRequest:{owner:req.li.person,fileSizeBytes:bytes.length,uploadCaptions:false,uploadThumbnail:false}}})).json();
      if(!/^urn:li:video:[\w-]+$/.test(value?.video||'')||!value.uploadInstructions?.length)throw fail(502,'LinkedIn could not prepare the video upload.');
      const parts=[];let nextByte=0;
      for(const part of value.uploadInstructions){
        if(part.firstByte!==nextByte||!Number.isSafeInteger(part.lastByte)||part.lastByte<part.firstByte||part.lastByte>=bytes.length)throw fail(502,'LinkedIn returned invalid upload instructions.');
        const etag=await upload(part.uploadUrl,bytes.subarray(part.firstByte,part.lastByte+1));if(!etag)throw fail(502,'LinkedIn did not confirm the uploaded video part.');parts.push(etag);nextByte=part.lastByte+1;
      }
      if(nextByte!==bytes.length)throw fail(502,'The complete video could not be uploaded.');
      await api(req.li,'/rest/videos?action=finalizeUpload',{method:'POST',body:{finalizeUploadRequest:{video:value.video,uploadToken:value.uploadToken||'',uploadedPartIds:parts}}});urn=value.video;
    }else{
      const {value}=await (await api(req.li,'/rest/images?action=initializeUpload',{method:'POST',body:{initializeUploadRequest:{owner:req.li.person}}})).json();
      if(!/^urn:li:image:[\w-]+$/.test(value?.image||''))throw fail(502,'LinkedIn could not prepare the image upload.');
      await upload(value.uploadUrl,bytes,req.li.token);urn=value.image;
    }
    const media={id:random(),digest,type,urn,created:Date.now(),state:'processing'};req.li.media.push(media);await store.put(req.liId,req.li);res.json(publicMedia(media));
  }));
  router.get('/api/linkedin/media/:id',available,auth,exclusive,wrap(async(req,res)=>{
    const media=getMedia(req);
    if(media.state==='processing'){
      const result=await(await api(req.li,`/rest/${media.type==='video'?'videos':'images'}/${encodeURIComponent(media.urn)}`,{legacy:media.type==='image'})).json();
      if(result.status==='AVAILABLE')media.state='ready';else if(result.status==='PROCESSING_FAILED')media.state='failed';
      await store.put(req.liId,req.li);
    }
    res.json(publicMedia(media));
  }));
  router.post('/api/linkedin/media/:id/publish',available,sameOrigin,auth,csrf,rate,exclusive,express.json({limit:'16kb'}),wrap(async(req,res)=>{
    const media=getMedia(req),caption=req.body?.caption,title=req.body?.title;
    if(media.state==='published')return res.json(publicMedia(media));
    if(media.state==='sending'||media.state==='unknown')throw fail(409,'LinkedIn may already have received this post. Check your LinkedIn profile before making another.','publish_uncertain');
    if(media.state!=='ready')throw fail(409,'LinkedIn is still preparing the media. Try again shortly.');
    if(typeof caption!=='string'||!caption.trim()||[...caption].length>3000||typeof title!=='string'||[...title].length>200||req.body?.confirm!==true||!['PUBLIC','CONNECTIONS'].includes(req.body?.visibility))throw fail(400,'Review your caption and audience before publishing.');
    // Durable intent is recorded BEFORE sending. A timeout or restart must never
    // cause an automatic retry of the external, non-idempotent post creation.
    media.state='sending';await store.put(req.liId,req.li);
    try{
      const response=await api(req.li,'/rest/posts',{method:'POST',body:{author:req.li.person,commentary:linkedInPlainText(caption),visibility:req.body.visibility,distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},content:{media:{id:media.urn,title}},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false}});
      const post=response.headers.get('x-restli-id');media.state='published';media.url=/^urn:li:(share|ugcPost):\d+$/.test(post||'')?`https://www.linkedin.com/feed/update/${post}/`:'https://www.linkedin.com/feed/';await store.put(req.liId,req.li);res.json(publicMedia(media));
    }catch(error){
      media.state=error.providerStatus>=400&&error.providerStatus<500?'ready':'unknown';
      await store.put(req.liId,req.li);
      if(media.state==='unknown')throw fail(502,'We could not confirm whether LinkedIn published the post. Check your profile before trying again.','publish_uncertain');
      throw error;
    }
  }));
  router.use((error,req,res,_next)=>{if(req.liLock){busy.delete(req.liId);req.liLock=false;}res.status(error.type==='entity.too.large'?413:error.status||502).json({error:error.type==='entity.too.large'?'This media is too large. The limit is 12 MB.':error.status?error.message:'LinkedIn is taking longer than expected. Please try again.',code:error.code||null});});
  return {router,ready,isConfigured:()=>configured&&storageReady,close:()=>clearInterval(timer)};
}
