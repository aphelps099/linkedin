import {certificateName} from './certificate-art.js';
export const CERTIFICATE_FILENAME='linkedin-beats-certificate-of-professional-effort.png';
export const CERTIFICATE_SHARE_VERSION='2';
export function certificateShareUrl(name,origin='https://linkedinbeats.com'){
  const url=new URL('/learn/certificate/',origin);
  url.searchParams.set('name',certificateName(name));
  url.searchParams.set('v',CERTIFICATE_SHARE_VERSION);
  return url.href;
}
export function certificateImageUrl(name,origin='https://linkedinbeats.com'){
  const url=new URL(certificateShareUrl(name,origin));url.pathname='/api/learn/certificate.png';return url.href;
}
export function linkedInCertificateUrl(name,origin='https://linkedinbeats.com'){
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certificateShareUrl(name,origin))}`;
}
export function readCertificateName(href){
  try{
    if(href.length>1000)return null;
    const url=new URL(href,'https://linkedinbeats.com'), names=url.searchParams.getAll('name');
    if(names.length!==1||!names[0].trim()||[...names[0]].length>60||url.searchParams.get('v')!==CERTIFICATE_SHARE_VERSION)return null;
    return certificateName(names[0]);
  }catch{return null;}
}
