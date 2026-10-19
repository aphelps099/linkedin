import express from 'express';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,readdir,stat,unlink,utimes} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {localAnnouncer} from './local-announcer.js';
import {beatRobot} from './beat-robot.js';

export const synthesizeBeatVoice = ({text,role}) => role==='announcer'?localAnnouncer(text):beatRobot(text);
const fault=(status,message)=>Object.assign(new Error(message),{status});
const validWave=bytes=>bytes.length>44&&bytes.length<=2_000_000&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE';
export function normalizeBeatClips(value){
  if(!Array.isArray(value)||!value.length||value.length>8)throw fault(400,'Choose up to eight short voice lines.');
  const clips=value.map(clip=>{
    if(!clip||!['announcer','robot'].includes(clip.role)||typeof clip.text!=='string'||clip.text.length>180||!/[\p{L}\p{N}]/u.test(clip.text))throw fault(400,'Choose up to eight short voice lines.');
    return {text:clip.text.replace(/\s+/g,' ').trim(),role:clip.role};
  });
  if(clips.reduce((total,c)=>total+c.text.length,0)>600)throw fault(400,'Keep the vocal lines short.');
  return clips;
}

export function createPostBeatService({
  directory=process.env.POST_BEAT_CACHE_DIR||join(process.env.RAILWAY_ENVIRONMENT_ID?'/data':tmpdir(),'linkedin-beat-cache'),
  synthesize=synthesizeBeatVoice,maxBytes=32*1024*1024,maxPending=4,requestLimit=20,windowMs=10*60*1000,
}={}){
  const router=express.Router(),requests=new Map(),inFlight=new Map();
  let pending=0,tail=Promise.resolve(),configured=false;
  const ready=mkdir(directory,{recursive:true,mode:0o700}).then(()=>{configured=true;});
  const filename=clip=>join(directory,createHash('sha256').update(`kokoro-heart-097-robot-v1:${JSON.stringify(clip)}`).digest('hex')+'.wav');
  const cached=async clip=>{
    try{
      const path=filename(clip),bytes=await readFile(path);
      if(!validWave(bytes))return null;
      const now=new Date();await utimes(path,now,now).catch(()=>{});
      return bytes;
    }catch(error){if(error.code==='ENOENT')return null;throw error;}
  };
  const prune=async()=>{
    const files=await Promise.all((await readdir(directory)).filter(n=>/^[a-f0-9]{64}\.wav$/.test(n)).map(async name=>({name,...await stat(join(directory,name))})));
    let size=files.reduce((n,f)=>n+f.size,0);
    for(const file of files.sort((a,b)=>a.mtimeMs-b.mtimeMs)){
      if(size<=maxBytes&&file.mtimeMs>Date.now()-7*86400000)continue;
      await unlink(join(directory,file.name));size-=file.size;
    }
  };
  const generate=async clips=>{
    await ready;
    const available=await Promise.all(clips.map(cached));
    if(available.every(Boolean))return available;
    const key=JSON.stringify(clips);
    if(inFlight.has(key))return inFlight.get(key);
    if(pending>=maxPending)throw fault(429,'The studio is busy. Try again in a moment.');
    pending++;
    const job=tail.catch(()=>{}).then(async()=>{
      const result=[];
      for(const clip of clips){
        let bytes=await cached(clip);
        if(!bytes){
          bytes=await synthesize(clip);
          if(!validWave(bytes))throw new Error('Invalid generated audio');
          const target=filename(clip),temp=target+'.'+randomUUID()+'.tmp';
          try{await writeFile(temp,bytes,{mode:0o600});await rename(temp,target);}
          finally{await unlink(temp).catch(()=>{});}
        }
        result.push(bytes);
      }
      await prune();return result;
    });
    tail=job;inFlight.set(key,job);
    try{return await job;}finally{pending--;inFlight.delete(key);}
  };
  router.post('/',async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{
      const origin=req.get('origin');
      if(origin){try{if(new URL(origin).host!==req.get('host'))throw new Error();}catch{throw fault(403,'Please make your beat on LinkedIn Beats.');}}
      const now=Date.now();
      for(const [key,bucket] of requests)if(bucket.until<=now)requests.delete(key);
      const key=req.ip,bucket=requests.get(key)||{count:0,until:now+windowMs};
      if(bucket.count>=requestLimit||(!requests.has(key)&&requests.size>=10000))throw fault(429,'You’re making plenty of beats. Try again in a few minutes.');
      bucket.count++;requests.set(key,bucket);
      const clips=normalizeBeatClips(req.body?.clips);
      const audio=await generate(clips);
      res.json({clips:audio.map((bytes,i)=>({audio:bytes.toString('base64'),contentType:'audio/wav',role:clips[i].role})),provider:'kokoro+retro'});
    }catch(error){
      const status=error.status||503;
      if(status===429)res.set('Retry-After','30');
      if(status>=500)console.error('post-beat: generation failed',error.message);
      res.status(status).json({error:error.status?error.message:'The vocals couldn’t be prepared. Please try again shortly.'});
    }
  });
  router.all('/',(_req,res)=>res.status(405).set('Allow','POST').json({error:'Use POST.'}));
  ready.catch(()=>{});
  return {router,ready,isConfigured:()=>configured,generate,prune};
}
