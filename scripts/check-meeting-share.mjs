import assert from 'node:assert/strict';
import express from 'express';
import sharp from 'sharp';
import {readFile,access} from 'node:fs/promises';
import {createMeetingShareRouter,meetingRecord,invitationHTML,renderMeetingCover} from '../server/meeting-share.js';
import {meetingInvitation,meetingPortraits} from '../src/meeting-room/invitation.js';
import {library} from '../src/meeting-room/scripts.js';
const audio=JSON.parse(await readFile('src/meeting-room/audio-manifest.json','utf8'));
const html=await readFile('studio/index.html','utf8');
for(const agenda of Object.keys(library))for(let variant=0;variant<2;variant++){
 const id=`${agenda}-${variant}`,meeting={...meetingRecord(id),duration:audio.meetings[id].duration};
 const invite=meetingInvitation(meeting);assert.equal(new URL(invite.url).searchParams.get('meeting'),id);
 for(const person of meetingPortraits(meeting))await access(`public${person.url}`);
 const output=invitationHTML(html,meeting);assert.equal((output.match(/property="og:title"/g)||[]).length,1);assert(output.includes(`/api/meeting/cover/${id}.png`));assert(!output.includes('linkedin-beats-v1.jpg'));assert(!output.includes('undefined'));
 const cover=await renderMeetingCover(meeting,'public'),meta=await sharp(cover).metadata();assert.equal(meta.width,1200);assert.equal(meta.height,630);assert(cover.length<12*1024*1024);
}
for(const id of ['../secrets','standup-3','fake-0','standup-0<script>'])assert.equal(meetingRecord(id),null);
const escaped=invitationHTML(html,{id:'standup-0',title:'<script>alert("x")</script>',duration:40});assert(!escaped.includes('<script>alert'));
const app=express();app.use(createMeetingShareRouter({template:'studio/index.html',assets:'public'}));app.use((req,res)=>res.status(404).end());
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
try{const base=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(`${base}/studio/?meeting=onboarding-1`);assert.equal(response.status,200);assert((await response.text()).includes('/studio/?meeting=onboarding-1'));
 const image=await fetch(`${base}/api/meeting/cover/standup-0.png`);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
 assert.equal((await fetch(`${base}/api/meeting/cover/invalid.png`)).status,404);
}finally{server.close();}
console.log('Meeting sharing passed: all 14 covers, exact invitation links, escaped metadata, route responses and invalid-ID handling.');
