import React from 'react';
import {Linkedin} from 'lucide-react';
import {linkedInCertificateUrl} from './certificate-share.js';

export function CertificateShare({name}){
  // A normal link preserves popup activation and works without file/clipboard permissions.
  // LinkedIn fetches the public page's personalized og:image; the learner reviews and posts.
  return <a className="pg-btn pg-linkedin-share" href={linkedInCertificateUrl(name)} target="_blank" rel="noopener noreferrer" aria-describedby="pg-certificate-share-note"><Linkedin size={17}/>Post to LinkedIn</a>;
}
