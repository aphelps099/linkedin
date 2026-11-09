import React from 'react';
import {createRoot} from 'react-dom/client';
import '../brand/fonts.css';
import '../program/program.css';
import '../program/arcade/academy.css';
import '../program/components/graduation-single.css';
import {SiteFooter} from '../brand/SiteFooter.jsx';
import {PostBeat} from './PostBeat.jsx';
import {readSharedBeat,coverPreviewUrl} from './share.js';
import {PegText,DotArrow} from '../program/arcade/Artwork.jsx';
const shared=readSharedBeat(location.href);
function ListeningPage(){
 if(!shared)return <div className="pg-app"><main className="beat-listening-page"><h1>This single is missing.</h1><p>That link doesn’t contain a complete beat.</p><a className="pg-btn" href="/learn/">Make your own<DotArrow/></a></main><SiteFooter base="../"/></div>;
 const {recipe,cover,artist='LinkedIn Beats'}=shared;
 return <div className="pg-app"><main className="beat-listening-page pg-graduation-single"><div className="beat-listening-head"><span>A little professional development.</span><h1><PegText text="ON REPEAT." face="peg9" label="On repeat."/></h1><p>A single by <strong>{artist}</strong></p></div><img className="beat-listening-cover" src={coverPreviewUrl(location.origin,recipe,cover.id,artist)} width={1200} height={630} alt={`${recipe.chorus} — ${artist}`}/><PostBeat post="" initialRecipe={recipe} initialCover={cover.id} initialArtist={artist} presentation="listening"/><a className="beat-make-own" href="/learn/">Your career could use a chorus.<span>Make your own single<DotArrow/></span></a></main><SiteFooter base="../"/></div>;
}
createRoot(document.getElementById('root')).render(<ListeningPage/>);
