import React,{useId} from 'react';
import {PostBeat} from '../../post-beat/PostBeat.jsx';
import {PegText,DotArrow,DotPlay} from '../arcade/Artwork.jsx';
import {BrandArtwork} from './BrandArtwork.jsx';
import './graduation-single.css';

function DebutSleeve({artist}){
 const dots=[];
 for(const [ring,radius] of [42,57,73,89,105].entries()){
  const count=Math.round(radius*.69);
  for(let i=0;i<count;i++){
   const angle=i/count*Math.PI*2;
   dots.push(<circle key={`${ring}-${i}`} cx={150+Math.cos(angle)*radius} cy={145+Math.sin(angle)*radius} r={2.1} fill={i/count>.73&&i/count<.88?'#f4ecce':'#24394b'} opacity={ring%2?.55:1}/>);
  }
 }
 return <div className="gs-sleeve" aria-label={`Graduation single artwork for ${artist}`}>
  <div className="gs-sleeve-top"><BrandArtwork width={145} height={20} color="#24394b"/><span aria-label="All five lessons complete">05 / 05</span></div>
  <svg className="gs-record" viewBox="0 0 300 280" aria-hidden="true"><g className="gs-record-grooves">{dots}</g><circle cx="150" cy="145" r="31" fill="#ffae99"/><circle cx="150" cy="145" r="5" fill="#24394b"/><path d="M135 139v-12m15 6v-12m15 18v-12M135 163v-12m15 18v-12m15 6v-12" stroke="#24394b" strokeWidth="3" strokeDasharray="1 4" strokeLinecap="round"/></svg>
  <div className="gs-sleeve-title"><PegText text="SIDE HUSTLE" face="peg5" label="Side hustle"/><span>{artist}</span></div>
 </div>;
}
export function GraduationSingle({post,artist='Aspiring Thought Leader'}){
 const headingId=useId();
 const cleanPost=typeof post==='string'?post.trim():'';
 const excerpt=cleanPost.length>160?`${cleanPost.slice(0,157).trimEnd()}…`:cleanPost;
 return <section className="pg-graduation-single" aria-labelledby={headingId}>
  <div className="gs-reveal">
   <DebutSleeve artist={artist}/>
   <div className="gs-copy">
    <div className="gs-unlocked"><span aria-hidden="true"/>Graduation single unlocked</div>
    <h2 id={headingId} aria-label="Your debut."><PegText text="YOUR" face="peg9"/><PegText text="DEBUT." face="peg9"/></h2>
    <p className="gs-intro">Five lessons. One questionable hit.</p>
    {cleanPost?<blockquote>{excerpt}</blockquote>:<p className="gs-empty">Your credential is official. Give your final post a bassline.</p>}
   </div>
  </div>
  {cleanPost?<PostBeat post={cleanPost} initialArtist={artist} initialCover="side-hustle" presentation="graduation" playIcon={<DotPlay/>}/>:<a className="pg-btn gs-create" href="#/single">Finish your single<DotArrow/></a>}
  <p className="gs-footnote">Considerable effort. Now available on repeat.</p>
 </section>;
}
