import {mkdir,readFile,writeFile,rename,unlink,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';

// The browser only receives a random session identifier. Provider tokens remain
// encrypted on the private Render disk; rotating the client secret invalidates them.
export function createLinkedInSessionStore(directory,secret){
  const key=createHash('sha256').update(`linkedin-beats/session/v1:${secret}`).digest();
  const filename=id=>join(directory,`${createHash('sha256').update(id).digest('hex')}.enc`);
  const decode=bytes=>{
    const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(12,28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());
  };
  const ready=mkdir(directory,{recursive:true,mode:0o700});
  async function remove(id){await unlink(filename(id)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  async function get(id){
    if(!/^[a-f0-9]{64}$/.test(id||''))return null;
    await ready;
    try{const record=decode(await readFile(filename(id)));if(record.expires<=Date.now()){await remove(id);return null;}return record;}
    catch(e){if(e.code==='ENOENT')return null;await remove(id);return null;}
  }
  async function put(id,record){
    await ready;
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
    const body=Buffer.concat([cipher.update(JSON.stringify(record)),cipher.final()]);
    const destination=filename(id),temporary=`${destination}.${randomBytes(8).toString('hex')}.tmp`;
    try{await writeFile(temporary,Buffer.concat([iv,cipher.getAuthTag(),body]),{mode:0o600,flag:'wx'});await rename(temporary,destination);}
    finally{await unlink(temporary).catch(()=>{});}
  }
  async function prune(){
    await ready;
    for(const name of await readdir(directory)){
      if(!/^[a-f0-9]{64}\.enc$/.test(name))continue;
      try{if(decode(await readFile(join(directory,name))).expires>Date.now())continue;}catch{}
      await unlink(join(directory,name)).catch(()=>{});
    }
  }
  return {ready,get,put,remove,prune};
}
