import assert from 'node:assert/strict';
import {canShareCertificate, shareCertificateFile} from '../src/program/components/certificate-share.js';

const file=new File(['certificate'],'certificate.png',{type:'image/png'});
assert.equal(canShareCertificate(file,{}),false);
assert.equal(canShareCertificate(null,{share(){},canShare:()=>true}),false);
assert.equal(canShareCertificate(file,{share(){},canShare(){throw Error('policy');}}),false);
assert.equal(await shareCertificateFile(file,{}),'unavailable');
let called=false,finish;
const pending=shareCertificateFile(file,{canShare:()=>true,share:data=>{
  called=true;assert.deepEqual(data,{files:[file]});
  return new Promise(resolve=>{finish=resolve;});
}});
assert(called,'Native share must run synchronously in the tap, before any rendering or awaits.');
finish();assert.equal(await pending,'shared');
assert.equal(await shareCertificateFile(file,{canShare:()=>true,share:()=>Promise.reject({name:'AbortError'})}),'cancelled');
assert.equal(await shareCertificateFile(file,{canShare:()=>true,share(){throw Error('blocked');}}),'failed');
assert.equal(await shareCertificateFile(file,{canShare:()=>true,share:()=>Promise.reject({name:'DataError'})}),'failed');
console.log('Certificate sharing: file-only payload, synchronous activation, unavailable API, cancellation and errors passed.');
