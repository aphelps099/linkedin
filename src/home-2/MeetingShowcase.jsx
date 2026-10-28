import React, {useRef} from 'react';
import {ArrowLeft, ArrowRight, ArrowUpRight, Play} from 'lucide-react';
import {agendas, meetingSequence, timeLabel} from '../meeting-room/catalog.js';
import {meetingPortraits} from '../meeting-room/invitation.js';
import './meeting-showcase.css';

const labels=Object.fromEntries(agendas);
export function MeetingShowcase({base='/',motion=true}){
  const rail=useRef(null);
  const move=direction=>rail.current?.scrollBy({left:direction*rail.current.clientWidth*.8,behavior:motion?'smooth':'instant'});
  return <section className="meeting-showcase" id="c2-dispatch" aria-labelledby="meetings-heading">
    <header className="meeting-showcase-heading">
      <div><p className="meeting-kicker">The meetings worth attending</p><h2 id="meetings-heading"><a href={`${base}studio/#meetings`}>Humbled to share.</a></h2><p>{meetingSequence.length} meetings. Seven agendas. Absolutely no action items.</p></div>
      <a className="meeting-all" href={`${base}studio/#meetings`}>View all meetings <ArrowUpRight aria-hidden="true"/></a>
    </header>
    <div className="meeting-rail" ref={rail} tabIndex={0} role="region" aria-label="Browse all recorded meetings">
      {meetingSequence.map(meeting=><article className="meeting-preview" key={meeting.id}>
        <a href={`${base}studio/?meeting=${meeting.id}`} aria-label={`Watch ${meeting.title}`}>
          <div className="meeting-preview-art">
            <span className="meeting-preview-cast" aria-hidden="true">{meetingPortraits(meeting).map(person=><img src={`${base}${person.url.slice(1)}`} key={person.id} alt="" loading="lazy" decoding="async"/>)}</span>
            <span className="meeting-preview-play"><Play fill="currentColor" aria-hidden="true"/></span>
            <span className="meeting-preview-time">{timeLabel(meeting.duration)}</span>
          </div>
          <div className="meeting-preview-copy"><p>{labels[meeting.agenda]} / Take {meeting.variant+1}</p><h3>{meeting.title}</h3><span>Watch meeting <ArrowUpRight aria-hidden="true"/></span></div>
        </a>
      </article>)}
    </div>
    <div className="meeting-showcase-bottom"><a href={`${base}archives/`}>Press, posts & other humble announcements <span>Visit the archives <ArrowUpRight aria-hidden="true"/></span></a><div aria-label="Meeting carousel controls"><button type="button" onClick={()=>move(-1)} aria-label="Previous meetings"><ArrowLeft/></button><button type="button" onClick={()=>move(1)} aria-label="Next meetings"><ArrowRight/></button></div></div>
  </section>;
}
