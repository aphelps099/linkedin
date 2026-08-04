// The LinkedIn image library — corporate stock photography, if stock
// photography had robots in blazers. Shuffled into the broadcast so no two
// clips cut the same way.
// To add plates: drop them in public/library/ and list them here.
export const PLATES = [
  {file:'01.png', caption:'The quarterly alignment'},
  {file:'02.png', caption:'The handshake'},
  {file:'03.png', caption:'Synergy, explained'},
  {file:'04.png', caption:'The all-hands'},
  {file:'05.png', caption:'Attentive stakeholder'},
  {file:'06.png', caption:'Ideation in progress'},
  {file:'07.png', caption:'Dialling in'},
  {file:'08.png', caption:'The line goes up'},
  {file:'09.png', caption:'The team photo'},
  {file:'10.png', caption:'Coffee, procured'},
  {file:'11.png', caption:'Reflecting on the vision'},
  {file:'12.png', caption:'Networking'},
  {file:'13.png', caption:'Symmetrical stakeholders'},
  {file:'14.png', caption:"World's best manager"},
  {file:'15.png', caption:'The trust fall'},
  {file:'16.png', caption:'Hands in'},
  {file:'17.png', caption:'The keynote'},
  {file:'18.png', caption:'Awaiting the agenda'},
  {file:'19.png', caption:'Ribbon cutting'},
  {file:'20.png', caption:'Circular arrows'},
  {file:'21.png', caption:'Executive presence'},
  {file:'22.png', caption:'The high five'},
  {file:'23.png', caption:'One human remaining'},
];

const plates = [];   // {img, caption} once decoded
let order = [];
let cursor = 0;

const shuffle = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b; };

export function loadLibrary(base){
  if(plates.length) return Promise.resolve(plates.length);
  return Promise.allSettled(PLATES.map(p => new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>{ plates.push({img, caption:p.caption}); res(); };
    img.onerror = rej;
    img.src = `${base}library/${p.file}`;
  }))).then(()=>{
    order = shuffle(plates.map((_,i)=>i));
    return plates.length;
  });
}

export const libraryReady = () => plates.length > 0;

// the plate currently on screen
export function currentPlate(){
  if(!plates.length) return null;
  return plates[order[cursor % order.length]];
}

// called when the director cuts to the library, so every visit is a new plate
export function advancePlate(){
  if(!plates.length) return null;
  cursor++;
  if(cursor % order.length === 0) order = shuffle(order); // reshuffle each pass
  return currentPlate();
}
