// Finite arrangements of the same recorded phrase bank and house band as the studio.
// Titles are from the original /v2 design; durations now describe real transports.
export const LINES = {
  0: "I'm thrilled to announce", 1: 'Humbled and honored to share',
  4: 'Synergy', 5: "Let's circle back", 6: 'Leverage', 7: 'Pivot',
  12: 'Thoughts?', 13: 'Agree or disagree?', 14: 'Let that sink in',
  17: 'Read that again.', 26: 'Grateful for this incredible journey.',
  27: "Couldn't have done it without my amazing team.",
  28: 'Onwards and upwards!', 33: 'Hot take: teamwork makes a difference.',
  40: 'The journey continues.', 46: 'Proud of this team.', 53: 'Culture is everything.',
};
export const TRACKS = [
  {title:'Synergy in B2B Minor', seconds:167, bpm:112, root:35, phrases:[1,4,6,5,13,14], genre:'Boardroom house', color:'blue'},
  {title:'Let That Sink In (Remix)', seconds:192, bpm:118, root:33, phrases:[14,17,14,12,7,13], genre:'Thought-leader techno', color:'pink'},
  {title:'Per My Last Email', seconds:178, bpm:104, root:36, phrases:[5,6,7,5,12,14], genre:'Passive-aggressive disco', color:'red'},
  {title:'Thrilled to Announce', seconds:151, bpm:124, root:38, phrases:[0,1,40,26,28,0], genre:'Promotion pop', color:'yellow'},
  {title:'We Are a Family (Live)', seconds:244, bpm:96, root:33, phrases:[27,46,53,33,26,28], genre:'All-hands afterparty', color:'blue'},
];

export function arrangement(track, index = 0) {
  const steps = index === 3 ? [[0,0],[9,1],[5,0],[7,0]] : [[0,1],[8,0],[3,0],[10,0]];
  return {
    chords: steps.map(([off, minor]) => ({root:track.root+off, tones:[0,minor?3:4,7,minor?10:11].map(n=>track.root+off+n)})),
    bass: index % 2 ? [1,0,1,0,0,1,0,1,2,0,1,0,0,1,0,3] : [1,0,0,1,0,0,1,0,2,0,0,1,0,3,0,0],
    arp:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1],
    stab:[0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0],
    arpDir: index % 2 ? 'down' : 'updown', arpOct:2,
  };
}

// Find spoken audio instead of spending the first word's time on leading silence.
export function speechBounds(buffer) {
  const data = buffer.getChannelData(0), hop = Math.max(1, Math.floor(buffer.sampleRate * .01));
  const levels = [];
  for(let i=0;i<data.length;i+=hop){
    let energy=0, count=Math.min(hop,data.length-i);
    for(let j=0;j<count;j++) energy+=data[i+j]**2;
    levels.push(Math.sqrt(energy/count));
  }
  const threshold = Math.max(...levels) * .065;
  const first = levels.findIndex(v=>v>threshold);
  let last=levels.length-1;
  while(last>first && levels[last]<=threshold) last--;
  return first < 0 ? [0,buffer.duration] : [Math.max(0,(first*hop/buffer.sampleRate)-.02),Math.min(buffer.duration,((last+1)*hop/buffer.sampleRate)+.04)];
}

// Estimated word boundaries, not forced alignment. Kept separate so measured
// timestamps can replace this later without changing the player or typography.
export function wordTimings(text, start, end) {
  const words = text.split(/\s+/);
  const weights=words.map(w=> Math.max(1,(w.toLowerCase().match(/[aeiouy]+/g)||[]).length) + .15);
  const total=weights.reduce((a,b)=>a+b,0);
  let cursor=start;
  return words.map((word,i)=>{const from=cursor; cursor+=(end-start)*weights[i]/total; return {word,start:from,end:cursor};});
}

export function makeCues(track, buffers) {
  const bar=240/track.bpm, cues=[];
  let at=0, ix=0;
  while(at<track.seconds){
    const bank=track.phrases[ix++%track.phrases.length], buffer=buffers.get(bank);
    if(at+buffer.duration>track.seconds) break;
    const [start,end]=speechBounds(buffer);
    cues.push({bank,text:LINES[bank],at,duration:buffer.duration,words:wordTimings(LINES[bank],at+start,at+end)});
    at+=Math.max(2,Math.ceil((buffer.duration+.4)/bar))*bar;
  }
  return cues;
}

export function lyricAt(cues, seconds) {
  let cue=cues[0];
  for(const item of cues){ if(item.at>seconds) break; cue=item; }
  return {text:cue?.text || LINES[1], word:cue?.words.findIndex(w=>seconds>=w.start&&seconds<w.end) ?? -1};
}
export const formatTime = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;

export function siteBase(pathname = window.location.pathname) {
  return pathname.replace(/(?:v2|studio)\/(?:index\.html)?$/, '').replace(/index\.html$/, '').replace(/\/?$/, '/');
}
