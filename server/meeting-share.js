import express from 'express';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {meetingPoster} from '../src/meeting-room/poster-design.js';
import {library} from '../src/meeting-room/scripts.js';
import {meetingInvitation,meetingPortraits,MEETING_ORIGIN} from '../src/meeting-room/invitation.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function meetingRecord(id){
 const match=/^([a-z]+)-([01])$/.exec(id||'');
 if(!match||!library[match[1]]?.[+match[2]])return null;
 return {...library[match[1]][+match[2]],id,agenda:match[1],variant:+match[2]};
}
export function invitationHTML(html,meeting){
 const invite=meetingInvitation(meeting),title=escape(invite.title),description=escape(invite.description),url=escape(invite.url),image=`${MEETING_ORIGIN}/api/meeting/cover/${meeting.id}.png?v=invite-2`;
 return html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${title} — LinkedIn Beats</title>`)
 .replace(/<meta\s+(?:property|name)="(?:og:[^"]+|twitter:[^"]+|description)"[^>]*>/gi,'')
 .replace(/<link\s+rel="canonical"[^>]*>/gi,'')
 .replace('</head>',`<link rel="canonical" href="${url}"/><meta name="description" content="${description}"/><meta property="og:type" content="website"/><meta property="og:site_name" content="LinkedIn Beats"/><meta property="og:title" content="${title}"/><meta property="og:description" content="${description}"/><meta property="og:url" content="${url}"/><meta property="og:image" content="${image}"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:image:type" content="image/png"/><meta property="og:image:alt" content="Invitation to ${escape(meeting.title)}, hosted by Synergy"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${title}"/><meta name="twitter:description" content="${description}"/><meta name="twitter:image" content="${image}"/></head>`);
}
export async function renderMeetingCover(meeting,assets){
 const art=meetingPoster(meeting),lines=[];let line='';
 for(const word of meeting.title.split(' ')){if(line.length+word.length>22&&line){lines.push(line);line='';}line+=(line?' ':'')+word;}if(line)lines.push(line);
 const size=Math.min(104,Math.floor(1120/Math.max(...art.lines.map(line=>line.length))));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="${art.paper}"/><g fill="${art.ink}" font-family="Liberation Sans,Arial,sans-serif"><text x="48" y="66" font-size="20" font-weight="bold" letter-spacing="3">YOU’RE INVITED.</text><text x="1150" y="66" font-size="18" text-anchor="end">LINKEDINBEATS_ / MEETING 0${meeting.variant+1}</text><path d="M48 92H1152" stroke="${art.ink}"/>${art.lines.map((text,i)=>`<text x="44" y="${205+i*105}" font-size="${size}" font-weight="900" letter-spacing="-4">${escape(text)}</text>`).join('')}<path d="M755 126V463" stroke="${art.ink}" stroke-opacity=".35"/><text x="795" y="160" font-size="14" letter-spacing="2">THE AGENDA</text>${lines.map((text,i)=>`<text x="795" y="${203+i*33}" font-size="26" font-weight="bold">${escape(text)}</text>`).join('')}<text x="795" y="433" font-size="15">SYNERGY + THE TEAM. AND YOU.</text><path d="M0 500H1200" stroke="${art.ink}" stroke-dasharray="8 7"/><circle cy="500" r="16" fill="#fff"/><circle cx="1200" cy="500" r="16" fill="#fff"/><text x="48" y="551" font-size="16" letter-spacing="1">WHEN: WHENEVER.</text><text x="48" y="583" font-size="16" letter-spacing="1">${Math.round(meeting.duration||40)} SECONDS. ZERO ACTION ITEMS.</text><rect x="790" y="530" width="362" height="65" rx="32" fill="${art.ink}"/><text x="971" y="571" font-size="24" font-weight="bold" text-anchor="middle" fill="${art.paper}">JOIN THE MEETING ↗</text></g></svg>`;
 const mask=Buffer.from('<svg width="88" height="88"><circle cx="44" cy="44" r="44" fill="white"/></svg>');
 const portraits=await Promise.all(meetingPortraits(meeting).slice(0,3).map(async(person,i)=>({input:await sharp(path.join(assets,person.url)).resize(88,88,{fit:'cover'}).composite([{input:mask,blend:'dest-in'}]).png().toBuffer(),left:795+i*79,top:315})));
 const plus=Buffer.from(`<svg width="88" height="88"><circle cx="44" cy="44" r="42" fill="${art.ink}"/><text x="44" y="55" text-anchor="middle" fill="${art.paper}" font-family="Arial,sans-serif" font-size="32" font-weight="bold">+1</text></svg>`);
 return sharp(Buffer.from(svg)).composite([...portraits,{input:plus,left:1032,top:315}]).png().toBuffer();
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
