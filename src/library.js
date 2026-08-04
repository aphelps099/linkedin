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
  {file:'24.png', caption:'Open plan'},
  {file:'25.png', caption:'The elevator'},
  {file:'26.png', caption:'The offsite'},
  {file:'27.png', caption:'The call'},
  {file:'28.png', caption:'The interview'},
  {file:'29.png', caption:'The review'},
  {file:'30.png', caption:'The refrigerator'},
  {file:'31.png', caption:'Sprint planning'},
  {file:'32.png', caption:'The plaque'},
  {file:'33.png', caption:'Wall of leadership'},
  {file:'34.png', caption:'Standing desks'},
  {file:'35.png', caption:'The paper jam'},
  // the senior demographic — retro-futurist robots, current everything else
  {file:'36.png', caption:'The senior partner'},
  {file:'37.png', caption:'Two generations'},
  {file:'38.png', caption:'Executive portrait, 1957'},
  {file:'39.png', caption:'Mentorship'},
  {file:'40.png', caption:'The veterans applaud'},
  {file:'41.png', caption:'Old guard, new guard'},
  {file:'42.png', caption:'Tenured faculty'},
  {file:'43.png', caption:'Four eras, one row'},
  {file:'44.png', caption:'The send-off'},
  {file:'45.png', caption:'Desk of distinction'},
  {file:'46.png', caption:'The intergenerational call'},
  {file:'47.png', caption:'Leadership, assembled'},
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
