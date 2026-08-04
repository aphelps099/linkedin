// The house band. Every track arrives already produced: a key, a chord
// progression, a bassline, an arpeggio, chord stabs, and computer blips —
// so nobody has to program a good sequence to sound good.
const rint = n => Math.floor(Math.random()*n);
const pick = a => a[rint(a.length)];
const mtof = m => 440 * Math.pow(2, (m-69)/12);

// i–VI–III–VII, i–VII–VI–V, i–iv–VI–V, and one major-key discotheque turn
const PROGRESSIONS = [
  {name:'Quarterly outlook', steps:[[0,'min'],[8,'maj'],[3,'maj'],[10,'maj']]},
  {name:'Descending headcount', steps:[[0,'min'],[10,'maj'],[8,'maj'],[7,'maj']]},
  {name:'Performance review', steps:[[0,'min'],[5,'min'],[8,'maj'],[7,'maj']]},
  {name:'All-hands anthem', steps:[[0,'maj'],[9,'min'],[5,'maj'],[7,'maj']]},
];
const CHORD_TONES = {min:[0,3,7,10], maj:[0,4,7,11]};
const ROOTS = [33, 35, 36, 38, 40, 41]; // A1–F2 — bass register

// bass rhythms over 16 steps: 1 = root, 2 = accent/octave, 3 = fifth
const BASS_RHYTHMS = [
  [1,0,0,1,0,0,1,0,2,0,0,1,0,3,0,0],
  [1,0,1,0,0,1,0,1,2,0,1,0,0,1,0,3],
  [1,0,0,0,2,0,0,3,1,0,0,0,2,0,3,0],
  [1,1,0,1,0,0,1,0,1,1,0,1,0,3,0,0],
  [2,0,0,1,1,0,0,1,2,0,0,1,1,0,3,0],
];
const ARP_RHYTHMS = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,1,1,0,1,1,0,1,0,1,1,0,1,1,0],
  [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1],
];
const STAB_RHYTHMS = [
  [0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0],
  [2,0,0,0,0,0,2,0,0,0,0,2,0,0,0,0],
  [0,0,0,2,0,0,0,0,2,0,0,0,0,2,0,0],
];

// the setlist — a run that tells the story: opener → buzzword → AI tell → closer
const OPENERS = [0,1,2,3,16,29,32];
const BUZZ    = [4,5,6,7,20,34,35];
const TELLS   = [8,9,10,11,19,21,22,25,31,33];
const CLOSERS = [12,13,14,15,17,18,23,24,26,27,28,30,36];
const HOOKS   = [15,14,12,17,36]; // what the DROP says

export function makeSong(){
  const prog = pick(PROGRESSIONS);
  const root = pick(ROOTS);
  const chords = prog.steps.map(([off, type])=>{
    const r = root + off;
    return { root: r, type, tones: CHORD_TONES[type].map(t=> r + t) };
  });
  const setlist = [];
  const n = 6 + rint(3);
  for(let i=0;i<n;i++){
    const bank = i===0 ? OPENERS : i%3===1 ? BUZZ : i%3===2 ? TELLS : CLOSERS;
    setlist.push(pick(bank));
  }
  setlist.push(pick(CLOSERS));
  return {
    name: prog.name,
    root, chords,
    bass: pick(BASS_RHYTHMS),
    arp: pick(ARP_RHYTHMS),
    stab: pick(STAB_RHYTHMS),
    arpDir: pick(['up','down','updown','octaves']),
    arpOct: 2 + rint(2),
    setlist,
    hook: pick(HOOKS),
  };
}

function arpNote(song, chord, i){
  const tones = chord.tones;
  let ix;
  if(song.arpDir === 'down') ix = tones.length - 1 - (i % tones.length);
  else if(song.arpDir === 'updown'){ const p = i % ((tones.length-1)*2); ix = p < tones.length ? p : (tones.length-1)*2 - p; }
  else if(song.arpDir === 'octaves') ix = i % 2 ? 0 : 2;
  else ix = i % tones.length;
  const oct = song.arpDir === 'octaves' ? (Math.floor(i/2) % 2) : Math.floor(i / tones.length) % 2;
  return tones[ix] + 12*song.arpOct + 12*oct;
}

// What the band plays on a given step. energy: 0 groove · 1 build · 2 drop.
export function bandAt(song, step, energy){
  const bar = Math.floor(step/16);
  const s = step % 16;
  const chord = song.chords[bar % song.chords.length];
  const ev = [];

  const b = song.bass[s];
  if(b){
    const note = b===3 ? chord.root + 7 : b===2 ? chord.root + 12 : chord.root;
    ev.push({v:'bass', freq: mtof(note), vel: b===2 ? .95 : .8, dur: energy>=2 ? .22 : .18});
  }
  if(energy >= 1 && song.arp[s]){
    ev.push({v:'arp', freq: mtof(arpNote(song, chord, step)), vel: energy>=2 ? .7 : .5, dur: .12});
  }
  if(energy >= 2){
    if(song.stab[s]) ev.push({v:'stab', freqs: chord.tones.slice(0,3).map(t=> mtof(t+24)), vel:.8, dur:.3});
    if(s === 0) ev.push({v:'sub', freq: mtof(chord.root-12), vel:.9, dur:.5});
  }
  // computer chatter — the machine has opinions
  if(energy >= 1 && (s===7 || s===15) && Math.random() < .5){
    ev.push({v:'blip', freq: mtof(chord.tones[rint(4)] + 36), vel:.5, up: Math.random()<.5});
  }
  return ev;
}
