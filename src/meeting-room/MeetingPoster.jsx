import React from 'react';
import {ArrowUpRight, Play} from 'lucide-react';
import {meetingPoster} from './poster-design.js';
import {meetingPortraits} from './invitation.js';
import './meeting-poster.css';

export function MeetingPoster({meeting,base='/'}){
 const art=meetingPoster(meeting),people=meetingPortraits(meeting);
 return <div className={`meeting-poster meeting-poster--${meeting.agenda}`} style={{'--poster-size':`${Math.min(21,160/Math.max(...art.lines.map(line=>line.length)))}cqw`,'--poster-paper':art.paper,'--poster-ink':art.ink,'--poster-accent':art.accent}} aria-hidden="true">
  <div className="meeting-poster-top"><span>YOU’RE INVITED</span><ArrowUpRight/></div>
  <div className="meeting-poster-headline">{art.lines.map((line,index)=><span key={line} className={index===art.lines.length-1?'meeting-poster-last':''}>{line}{index===art.lines.length-1&&<svg viewBox="0 0 300 88" preserveAspectRatio="none"><path pathLength="1" d="M275 17C237-4 65-1 22 21C-20 48 16 81 148 79C260 79 312 54 281 30C260 12 137 5 72 16"/></svg>}</span>)}</div>
  <span className="meeting-poster-stamp">{art.stamp}</span>
  <div className="meeting-poster-guests"><div>{people.map(person=><img key={person.id} src={`${base}${person.url.slice(1)}`} alt="" loading="lazy"/>)}</div><span>SYNERGY + THE TEAM<br/>AND YOU, OBVIOUSLY.</span></div>
  <div className="meeting-poster-tear"><span><Play size={16} fill="currentColor"/>JOIN MEETING</span><span>{Math.round(meeting.duration)} SEC / ON DEMAND</span></div>
 </div>;
}
