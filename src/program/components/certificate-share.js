export const CERTIFICATE_FILENAME='linkedin-beats-certificate-of-professional-effort.png';
export function canShareCertificate(file,nav=navigator){
  try{return !!file && typeof nav.share==='function' && !!nav.canShare?.({files:[file]});}catch{return false;}
}
export function shareCertificateFile(file,nav=navigator){
  if(!canShareCertificate(file,nav))return Promise.resolve('unavailable');
  try{
    return Promise.resolve(nav.share({files:[file]})).then(()=> 'shared',error=>error.name==='AbortError' ? 'cancelled' : 'failed');
  }catch(error){return Promise.resolve(error.name==='AbortError' ? 'cancelled' : 'failed');}
}
