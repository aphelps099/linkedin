export const MEETING_ORIGIN='https://linkedinbeats.com';
const portraits={synergy:'synergy-camera-v2',synthia:'synthia-camera-v2',guitar:'guitar',keys:'keys-full',operations:'drums',people:'people',strategy:'strategy',accountant:'arjun',linda:'linda'};
export function meetingPortraits(meeting){
 const people=meeting.roster.filter(id=>id!=='pat'&&id!=='droid');
 // Rotate the supporting cast between takes; the host remains recognizable.
 const supporting=people.filter(id=>id!=='synergy');
 if(meeting.id.endsWith('-1'))supporting.reverse();
 return ['synergy',...supporting].slice(0,4).map(id=>({id,url:`/studio/season/posters/${id==='printer'?'printer-printing':portraits[id]+'-listening'}.jpg`}));
}
export function meetingInvitation(meeting){
 const url=`${MEETING_ORIGIN}/studio/?meeting=${encodeURIComponent(meeting.id)}`;
 const description=`Hosted by Synergy. ${Math.round(meeting.duration)} seconds. Please join using the link below.`;
 return {url,title:`You're invited: ${meeting.title}`,description,text:`You're invited to “${meeting.title}”.\n\n${description}\n\nJoin the meeting: ${url}`};
}
