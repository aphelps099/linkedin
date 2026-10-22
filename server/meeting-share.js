import express from 'express';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {library} from '../src/meeting-room/scripts.js';
import {meetingInvitation,meetingPortraits,MEETING_ORIGIN} from '../src/meeting-room/invitation.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function meetingRecord(id){
 const match=/^([a-z]+)-([01])$/.exec(id||'');
 if(!match||!library[match[1]]?.[+match[2]])return null;
 return {...library[match[1]][+match[2]],id,agenda:match[1],variant:+match[2]};
}
export function invitationHTML(html,meeting){
 const invite=meetingInvitation(meeting),title=escape(invite.title),description=escape(`Hosted by Synergy. ${Math.round(meeting.duration)} seconds. Your attendance has been anticipated.`),url=escape(invite.url),image=`${MEETING_ORIGIN}/api/meeting/cover/${meeting.id}.png`;
 return html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${title} — LinkedIn Beats</title>`)
 .replace(/<meta\s+(?:property|name)="(?:og:[^"]+|twitter:[^"]+|description)"[^>]*>/gi,'')
 .replace(/<link\s+rel="canonical"[^>]*>/gi,'')
 .replace('</head>',`<link rel="canonical" href="${url}"/><meta name="description" content="${description}"/><meta property="og:type" content="website"/><meta property="og:site_name" content="LinkedIn Beats"/><meta property="og:title" content="${title}"/><meta property="og:description" content="${description}"/><meta property="og:url" content="${url}"/><meta property="og:image" content="${image}"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:image:type" content="image/png"/><meta property="og:image:alt" content="Invitation to ${escape(meeting.title)}, hosted by Synergy"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${title}"/><meta name="twitter:description" content="${description}"/><meta name="twitter:image" content="${image}"/></head>`);
}
export async function renderMeetingCover(meeting,assets){
 const lines=[];let line='';for(const word of meeting.title.split(' ')){if(line.length+word.length>21&&line){lines.push(line);line='';}line+=(line?' ':'')+word;}if(line)lines.push(line);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0d1523"/><rect x="0" y="0" width="12" height="630" fill="#064bff"/><g fill="#f4f6ff" font-family="Liberation Sans,Arial,sans-serif"><text x="48" y="69" font-size="18" letter-spacing="2" fill="#9bb8ef">MEETING INVITATION / 0${meeting.variant+1}</text>${lines.map((text,i)=>`<text x="46" y="${175+i*61}" font-size="51" font-weight="bold">${escape(text)}</text>`).join('')}<text x="48" y="455" font-size="24" fill="#adbcd3">Hosted by Synergy.</text><rect x="46" y="492" width="265" height="57" rx="28" fill="#064bff"/><text x="75" y="529" font-size="23">Join the meeting →</text><text x="48" y="593" font-size="18" fill="#7d8ea7">LINKEDIN BEATS / STUDIO</text></g></svg>`;
 const portraits=await Promise.all(meetingPortraits(meeting).map(async(person,i)=>({input:await sharp(path.join(assets,person.url)).resize(258,258,{fit:'cover'}).png().toBuffer(),left:632+(i%2)*270,top:48+Math.floor(i/2)*270})));
 return sharp(Buffer.from(svg)).composite(portraits).png().toBuffer();
}
export function createMeetingShareRouter({template,assets}){
 const router=express.Router(),covers=new Map();
 async function record(id){const meeting=meetingRecord(id);if(!meeting)return null;const audio=JSON.parse(await readFile(new URL('../src/meeting-room/audio-manifest.json',import.meta.url),'utf8'));return {...meeting,duration:audio.meetings[id].duration};}
 router.get('/api/meeting/cover/:id.png',async(req,res,next)=>{
  try{const meeting=await record(req.params.id);if(!meeting)return res.status(404).json({error:'Meeting not found.'});
   if(!covers.has(meeting.id))covers.set(meeting.id,renderMeetingCover(meeting,assets).catch(e=>{covers.delete(meeting.id);throw e;}));
   res.set('Cache-Control','public, max-age=86400').type('png').send(await covers.get(meeting.id));
  }catch(error){next(error);}
 });
 router.get(['/studio','/studio/','/studio/index.html'],async(req,res,next)=>{
  if(typeof req.query.meeting!=='string')return next();
  try{const meeting=await record(req.query.meeting);if(!meeting)return next();res.set('Cache-Control','no-cache').type('html').send(invitationHTML(await readFile(template,'utf8'),meeting));}catch(error){next(error);}
 });
 return router;
}
