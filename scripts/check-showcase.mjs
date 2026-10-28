import assert from 'node:assert/strict';
import fs from 'node:fs';
import {showcaseSelection,filmSource} from '../src/home-2/showcase-selection.js';
import {library} from '../src/meeting-room/scripts.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/cutting-room/catalog.json',import.meta.url)));
const ids=new Set();
for(const item of showcaseSelection){
  assert(!ids.has(item.id),`Duplicate showcase id: ${item.id}`);ids.add(item.id);
  assert(Boolean(item.meeting)!==Boolean(item.film),`Each card needs exactly one destination: ${item.id}`);
  if(item.film){
    const film=catalog.assets.find(asset=>asset.id===item.film);
    assert(film,`Missing film: ${item.film}`);
    assert.equal(filmSource(item.film),film.src);
    assert(fs.existsSync(new URL(`../public${film.poster}`,import.meta.url)),`Missing poster: ${film.poster}`);
    const [minutes,seconds]=item.duration.split(':').map(Number);
    assert(Math.abs(minutes*60+seconds-film.duration)<1,`Duration mismatch: ${item.id}`);
  }else{
    const [agenda,variant]=item.meeting.split('-');
    assert.equal(library[agenda]?.[variant]?.title,item.title,`Meeting title/destination mismatch: ${item.id}`);
  }
}
for(const plate of ['room-to-scale','quick-sync','on-mute'])assert(fs.statSync(new URL(`../public/home-2/artwork/meetings/${plate}.webp`,import.meta.url)).size<200_000,`Artwork too large: ${plate}`);
console.log(`Verified ${ids.size} homepage destinations, film durations/posters, and optimized art plates.`);
