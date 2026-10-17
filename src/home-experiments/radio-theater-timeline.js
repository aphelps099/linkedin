export const THEATER_ACT_MS = 6000;
export const THEATER_COMMENTS = [
  {name:'Casey Park', face:'b', text:'This changed the way I circle back.'},
  {name:'Alex Morgan', face:'a', text:'Powerful. Reposting for visibility.'},
  {name:'Riley James', face:'d', text:'This belongs in the boardroom.'},
];
export const THEATER_LOOP_MS = THEATER_ACT_MS * THEATER_COMMENTS.length;

const HITS = [480,820,1110,1370,1620,1890,2250,3550];
const TYPES = [0,1,0,2,1,0,1,2];
const BASE = [1184,823,496];

// A short burst of approval, one readable reply, then a quiet reset.
// Counts reset only while the entire social layer is faded out.
export function theaterFrame(elapsed) {
  const position = ((elapsed % THEATER_LOOP_MS) + THEATER_LOOP_MS) % THEATER_LOOP_MS;
  const act = Math.floor(position / THEATER_ACT_MS);
  const time = position % THEATER_ACT_MS;
  const hits = HITS.filter(at=>time>=at).length;
  const counts = [...BASE];
  for(let i=0;i<act*HITS.length+hits;i++) counts[TYPES[i%TYPES.length]]+=3+(i%4);
  const age = hits ? time-HITS[hits-1] : Infinity;
  return {
    act, counts, hit:act*HITS.length+hits,
    active:age<420?TYPES[hits-1]:-1,
    commentVisible:time>=1650&&time<5400,
    socialOpacity:Math.min(1,time/300,(THEATER_ACT_MS-time)/400),
  };
}
