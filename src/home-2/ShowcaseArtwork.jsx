import React from 'react';
import {Video, VideoOff, MicOff, Play} from 'lucide-react';
import './showcase-artwork.css';

const portraits = {
  people:'people-listening', arjun:'arjun-listening', operations:'drums-listening',
  synergy:'synergy-camera-v2-listening', keys:'keys-full-listening', printer:'printer-printing',
};
const plates = {
  'room-scale':'home-2/artwork/meetings/room-to-scale.webp',
  synergy:'home-2/artwork/meetings/quick-sync.webp',
  linda:'home-2/artwork/meetings/on-mute.webp',
  welcome:'cutting-room/posters/welcome-to-the-office-v6-5adc47bd.jpg',
  auth:'cutting-room/posters/authenticity-rollout-90-second-version-5733dfd7.jpg',
  coffee:'cutting-room/posters/synergy-caffeinated-typing-and-celebration-2ed6a793.jpg',
};
function Portrait({person,base}){
  return <img className={person==='synergy'?'msa-robot':undefined} src={`${base}studio/season/posters/${portraits[person]}.jpg`} alt="" loading="lazy" decoding="async" width="640" height="360"/>;
}
export function ShowcaseArtwork({item,base='/'}){
  const {art,film}=item;
  const grid=art==='gallery'||art==='circle';
  const people=art==='circle'?['keys','synergy','people','operations','arjun','printer']:['people','arjun','operations','synergy'];
  const Icon=film?Play:art==='linda'?MicOff:Video;
  return <div className={`msa-art msa-${art}${film&&!grid?' msa-film-art':''}${grid?' msa-grid-art':''}`} aria-hidden="true">
    {plates[art]&&<div className="msa-inner"><img className="msa-plate" src={`${base}${plates[art]}`} alt="" loading="lazy" decoding="async" width={film?640:1080} height={film?360:720}/></div>}
    {grid&&<div className="msa-tile-grid">{people.map(person=><div key={person} className={`msa-tile${person==='synergy'?' msa-active':''}`}><Portrait person={person} base={base}/>{art==='gallery'&&person!=='synergy'&&<MicOff className="msa-mic"/>}</div>)}</div>}
    {art==='windows'&&<>
      <div className="msa-window msa-w-one"><Portrait person="arjun" base={base}/></div>
      <div className="msa-window msa-w-three"><VideoOff/></div>
      <div className="msa-window msa-w-two"><Portrait person="people" base={base}/></div>
    </>}
    <span className="msa-glyph"><Icon/></span>
    {art==='room-scale'&&<p className="msa-headline"><span className="msa-highlight">Room<br/>to scale.</span></p>}
    {art==='synergy'&&<p className="msa-headline">Quick<br/>sync.</p>}
    {art==='linda'&&<p className="msa-headline"><span className="msa-highlight">On mute.</span></p>}
    {art==='windows'&&<p className="msa-headline"><span className="msa-highlight">Same link.</span></p>}
  </div>;
}
