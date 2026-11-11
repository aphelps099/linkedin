// SYNERGY.EXE: the tower. Pure data and parsing, no DOM, so the game, the
// planner and scripts/check-game.mjs all read the same floors.
//
// Map legend (one character is one 8-unit tile):
//   #  solid          =  one-way platform (jump up through it)
//   %  false wall     o  exercise ball (bounces)
//   S  spawn          L  lift door       D  desk (post here)
//   W  phrase         w  phrase, hidden until the floor reveals it
//   M  mug (secret)   P  printer (secret)
//   c  rolling chair  K  Kevin           e  inbox, fires right
//   Z  the VP

export const T = 8;
export const EMPTY = 0, SOLID = 1, ONEWAY = 2, BALL = 3;

// The one true thing Synergy says, and what it becomes once leadership has had a look at it.
export const FACT = 'The onboarding is a PDF.';
export const OPTIMIZED = 'Proud to be optimizing the onboarding process.';

// slot: where the line lands in a post (0 opener, 2 body, 3 closer). say: the meeting version.
export const WORDS = {
  'HUMBLED':    { slot:0, line:'Humbled to share a moment from today.', say:'Humbled to be in this room.' },
  'THRILLED':   { slot:0, line:'Thrilled by what it taught me.', say:'Thrilled by the momentum.' },
  'JOURNEY':    { slot:2, line:'Grateful to be part of the journey.', say:'It has been a journey.' },
  'THOUGHTS?':  { slot:3, line:'Thoughts?', say:'Curious to hear thoughts.' },
  'RESILIENCE': { slot:2, line:'Most saw a problem. I saw a masterclass in resilience.', say:'This team is resilience.' },
  'VISIONARY':  { slot:2, line:'Visionary teams do not wait for permission.', say:'Truly visionary work.' },
  'ALIGNMENT':  { slot:2, line:'Alignment is not a meeting. It is a mindset.', say:'Feeling very aligned.' },
  'SYNERGY':    { slot:2, line:'This is what synergy looks like.', say:'That is synergy.' },
  '7 LESSONS':  { slot:2, line:'Here are 7 lessons it taught me about leadership.', say:'I have 7 lessons.' },
  'AGREE?':     { slot:3, line:'Agree?', say:'Agree?' },
};
export const FILLER = ['Circling back on that.', 'No updates. Just gratitude.', 'Echoing what was said.'];

export const INTRO = [
  { who:'syn', name:'Synergy', text:FACT, react:'0 reactions' },
  { who:'kev', name:'Kevin, Partnerships', text:'Thrilled to announce I’m entering my next chapter. Same role. Higher altitude.', react:'+128 reactions', burst:10 },
  { who:'lin', name:'Linda, Governance', text:'Humbled. Every setback is content.', react:'+2,048 reactions', burst:22 },
  { who:'syn', name:'Synergy', text:'…', react:'New objective: learn the language' },
];

// The meeting Synergy has to sit through. Three shares that land, or three facts nobody wants.
export const MEETING = {
  prompts:[
    'Does anyone have something to share for the good of the group?',
    'Any wins this week? Big or small.',
    'Before we wrap. Final thoughts?',
  ],
  again:['Anyone else?', 'Let’s hear another voice.', 'Someone we haven’t heard from?'],
  praise:['Love that.', 'So powerful.', 'Say more. Later.'],
  offline:'Let’s take that offline.',
  mute:'Synergy, you’re on mute.',
  listened:'Wait. It IS a PDF.',
  noted:'Noted. We will form a working group. Meeting adjourned.',
  wrap:'Great energy. Giving everyone four minutes back.',
};

// Raise the ceiling: n empty rows under the top wall. Everything placed by row moves down with the
// floor, except what hangs from the ceiling (top:true).
function tall(n, def) {
  const blank = '#' + '.'.repeat(def.map[0].length - 2) + '#', dy = o => o.top ? o : { ...o, y:o.y + n };
  return { ...def, map:[def.map[0], ...Array(n).fill(blank), ...def.map.slice(1)],
    zones:(def.zones || []).map(dy), signs:(def.signs || []).map(dy), decor:(def.decor || []).map(dy), mark:def.mark && dy(def.mark) };
}

export const FLOORS = [
  tall(7, {
    id:'open-plan', no:'02', name:'Open plan', music:1, lift:'post', wall:'cubicles', mark:{ x:12, y:12, k:7 },
    words:['THRILLED', 'JOURNEY', 'HUMBLED'],
    signs:[
      { x:7, y:24, t:'STEP 1: MOVE' }, { x:17, y:30, t:'STEP 2: JUMP' }, { x:12, y:20, t:'STEP 3: BOUNCE' },
    ],
    decor:[
      { k:'poster', x:6, y:27, t:['WELCOME', 'SEE PDF'] }, { k:'cooler', x:19, y:32 }, { k:'cubicle', x:24, y:32 },
      { k:'plant', x:31, y:32 }, { k:'poster', x:3, y:15, t:['THERE IS NO I', 'IN SYNERGY'] }, { k:'cubicle', x:20, y:22 }, { k:'plant', x:29, y:22 },
      { k:'lamp', x:12, y:23 }, { k:'lamp', x:24, y:23 }, { k:'lamp', x:8, y:1, top:true }, { k:'lamp', x:20, y:1, top:true }, { k:'lamp', x:32, y:1, top:true },
      { k:'window', x:8, y:3, w:9, h:6, top:true }, { k:'window', x:22, y:3, w:9, h:6, top:true },
      { k:'clock', x:33, y:5 },
    ],
    secret:'Supply closet',
    map:[
      '########################################',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#..W...................................#',
      '#.===..................................#',
      '#......................W...............#',
      '#.....................===..............#',
      '#......==..............................#',
      '#......................................#',
      '#................=====.......D.....L...#',
      '######...=====.............#######=====#',
      '#......................................#',
      '#......................................#',
      '#.................................====.#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#................................====..#',
      '#......................................#',
      '#......................................#',
      '#.........o.....c........c.............#',
      '###############################........#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '######..........................====...#',
      '######........W........................#',
      '######.................................#',
      '#....%......====.....====........=====.#',
      '#....%.................................#',
      '#.M..%..S...................c..........#',
      '########################################',
      '########################################',
    ],
  }),
  tall(7, {
    id:'meeting-rooms', no:'03', name:'Meetings', music:2, lift:'open', wall:'glass', mark:{ x:31, y:17, k:4 },
    words:['VISIONARY', 'ALIGNMENT', 'RESILIENCE', 'THOUGHTS?'],
    // Rooms where a meeting is in progress. Move while the host is looking and you get called on.
    zones:[
      { x:6, y:16, w:21, h:7, name:'Stand-up' },
      { x:10, y:8, w:21, h:7, name:'Sync' },
    ],
    signs:[{ x:28, y:19, t:'STEP 4:' }, { x:28, y:20, t:'HOLD STILL' }, { x:28, y:21, t:'WHEN WATCHED' }],
    decor:[
      { k:'cubicle', x:6, y:32 }, { k:'plant', x:17, y:32 }, { k:'cubicle', x:25, y:32 },
      { k:'poster', x:16, y:27, t:['HANG IN THERE', 'UNTIL Q4'] }, { k:'lamp', x:8, y:24 }, { k:'lamp', x:20, y:24 },
      { k:'screen', x:20, y:17, zone:0 }, { k:'screen', x:23, y:9, zone:1 },
      { k:'plant', x:8, y:23, lit:true }, { k:'plant', x:24, y:23, lit:true }, { k:'plant', x:29, y:15, lit:true },
      { k:'cooler', x:32, y:15 }, { k:'lamp', x:10, y:1, top:true }, { k:'lamp', x:28, y:1, top:true },
    ],
    secret:'Print room',
    map:[
      '########################################',
      '#.............######...................#',
      '#.............######...................#',
      '#.............%....#...................#',
      '#.W...........%....#...................#',
      '#.............%.P.M#...................#',
      '#====....===========...................#',
      '#......................................#',
      '#......................................#',
      '#....====..............................#',
      '#..................W...................#',
      '#e.....................................#',
      '#====.............====.................#',
      '#......................................#',
      '#.............c....................L...#',
      '#.....##################################',
      '#......................................#',
      '#===...................................#',
      '#...............W......................#',
      '#......................................#',
      '#.===..........====....................#',
      '#......................................#',
      '#...................c..................#',
      '###############################........#',
      '#......................................#',
      '#......................................#',
      '#...............................====...#',
      '#............W.........................#',
      '#......................................#',
      '#..........====..................=====.#',
      '#......................................#',
      '#..S..................K................#',
      '########################################',
      '########################################',
    ],
  }),
  { id:'boardroom', no:'04', name:'Boardroom', scene:'meeting' },
  tall(17, {
    id:'executive', no:'05', name:'Executive', music:3, lift:'post', boss:true, wall:'panels', mark:{ x:11, y:3, k:4, top:true },
    words:['SYNERGY', '7 LESSONS', 'AGREE?'],
    signs:[],
    decor:[
      { k:'window', x:2, y:8, w:7, h:14, top:true }, { k:'window', x:19, y:8, w:7, h:14, top:true },
      { k:'poster', x:11, y:10, t:['OPEN DOOR', 'POLICY'], top:true }, { k:'plant', x:8, y:21 }, { k:'plant', x:19, y:21 },
      { k:'lamp', x:4, y:1, top:true }, { k:'lamp', x:13, y:1, top:true }, { k:'lamp', x:22, y:1, top:true },
    ],
    secret:'Top shelf',
    map:[
      '############################',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#..........................#',
      '#.M........................#',
      '#===.........w.............#',
      '#..........................#',
      '#..........======..........#',
      '#..........................#',
      '#....w...............w.....#',
      '#..........................#',
      '#...====............====...#',
      '#..........................#',
      '#..........................#',
      '#.o.S.......D........Z..L..#',
      '############################',
      '############################',
      '############################',
    ],
  }),
];

const cellMid = (cx, cy) => ({ x:cx * T + T / 2, y:cy * T + T / 2 });

// Text map to tiles plus the things standing in it. Throws on a ragged row, so a typo fails loudly.
export function parseFloor(def) {
  const rows = def.map, h = rows.length, w = rows[0].length;
  const t = new Uint8Array(w * h);
  const f = { def, w, h, t, spawn:null, lift:null, desk:null, boss:null, printer:null,
    words:[], mugs:[], chairs:[], kevins:[], inboxes:[], illusions:[], balls:[] };
  let wi = 0;
  rows.forEach((row, cy) => {
    if (row.length !== w) throw new Error(`${def.id}: row ${cy} is ${row.length} wide, expected ${w}`);
    for (let cx = 0; cx < w; cx++) {
      const ch = row[cx], i = cy * w + cx, foot = (cy + 1) * T, left = cx * T;
      if (ch === '#') t[i] = SOLID;
      else if (ch === '=') t[i] = ONEWAY;
      else if (ch === 'o') { t[i] = BALL; f.balls.push({ cx, cy }); }
      else if (ch === '%') f.illusions.push({ cx, cy });
      else if (ch === 'S') f.spawn = { x:left + T / 2, y:foot };
      else if (ch === 'L') f.lift = { x:left, y:foot, w:16, h:26 };
      else if (ch === 'D') f.desk = { x:left, y:foot, w:36, h:13 };
      else if (ch === 'W' || ch === 'w') { const word = def.words[wi++]; if (!word) throw new Error(`${def.id}: more phrase markers than phrases`);
        f.words.push({ word, ...cellMid(cx, cy), hidden:ch === 'w' }); }
      else if (ch === 'M') f.mugs.push({ x:left + T / 2, y:foot });
      else if (ch === 'P') f.printer = { x:left, y:foot };
      else if (ch === 'c') f.chairs.push({ x:left, y:foot });
      else if (ch === 'K') f.kevins.push({ x:left + T / 2, y:foot });
      else if (ch === 'e') f.inboxes.push({ x:left, y:foot, dir:1 });
      else if (ch === 'Z') f.boss = { x:left + T / 2, y:foot };
      else if (ch !== '.') throw new Error(`${def.id}: unknown tile "${ch}" at ${cx},${cy}`);
    }
  });
  if (wi !== def.words.length) throw new Error(`${def.id}: ${def.words.length} phrases listed, ${wi} placed`);
  if (!f.spawn) throw new Error(`${def.id}: no spawn`);
  return f;
}

export const tileAt = (f, cx, cy) => (cx < 0 || cx >= f.w || cy < 0 || cy >= f.h) ? SOLID : f.t[cy * f.w + cx];

// How far something on the ground can roll from (x, footY) before a wall or a ledge, capped at `reach` tiles.
export function patrolRange(f, x, footY, reach = 5) {
  const cy = Math.round(footY / T), cx0 = Math.floor(x / T);
  const ok = cx => { const below = tileAt(f, cx, cy); return (below === SOLID || below === ONEWAY) && tileAt(f, cx, cy - 1) !== SOLID && tileAt(f, cx, cy - 2) !== SOLID; };
  let a = cx0, b = cx0;
  while (a > cx0 - reach && ok(a - 1)) a--;
  while (b < cx0 + reach && ok(b + 1)) b++;
  return { min:a * T, max:(b + 1) * T };
}
