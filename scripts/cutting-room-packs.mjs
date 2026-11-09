// The Cutting Room's sound packs: which files each one lists, the words on every row (from the
// manifests that made them), how they group, and the record's own copy. Writes a pack's item list
// and prints the publish command that files it, so a pack can be rebuilt when its sources change
// (a changed pack is republished with --replaces <its id>).
//
//   node scripts/cutting-room-packs.mjs <pack|all> --out DIR [--replaces ID] [--dry-run]
//   node scripts/cutting-room-packs.mjs --list
//
// The instruments pack lists what scripts/render-instrument-pack.mjs rendered: pass its folder with
// --instruments DIR. Items already in public/ are listed where they are; the film voice takes (in
// assets/, not served) are encoded to MP3 128k under public/cutting-room/sounds/film-voices/.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, PUBLIC} from './lib/cutting-room.mjs';

const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const pub = (...p) => path.join(PUBLIC, ...p);
const cap = s => s[0].toUpperCase() + s.slice(1);
// House style: no em dashes. "Not just a job \u2014 a calling." reads "Not just a job, a calling." (as DELVE. sings it).
const tidy = s => String(s).replace(/\s*\u2014\s*/g, ', ').replace(/\s+/g, ' ').trim();

// The meeting room's people, by their recording ids, named as the catalog's cast list names them.
const PEOPLE = {people:'People & Culture', strategy:'Strategy', guitar:'Kevin', keys:'Keys', operations:'Operations', accountant:'Arjun', linda:'Linda'};
// One dialogue take has no line in public/studio/voices/catalog.json (an earlier script); its words, as Whisper small.en heard them.
const HEARD = {'people-eb54a611e2869e8e':'I’ve already called it a movement.'};

export const PACKS = {
  lady:{
    title:'The Lady’s Recordings', madeIn:['All Hands'], groupLabel:'Voice', cast:['The lady'], tags:['the lady', 'voice', 'phrases', 'all hands'],
    description:'Fifty-seven things LinkedIn says out loud, each said once. All Hands builds its songs from them.',
    items:() => read('src/allhands/lady-phrases.json').map(p => ({file:pub('phrases', p.file), text:tidy(p.text)})),
  },
  'voice-bank':{
    title:'All Hands Voice Bank', madeIn:['All Hands'], groupLabel:'Voice', cast:['Strategy', 'Synthia'], tags:['voice bank', 'strategy', 'synthia', 'all hands'],
    description:'Every line a song can cast, recorded before anyone asked.',
    items:() => {
      const bank = read('src/allhands/voices/song-voices.json');
      const order = ['strategy', 'synthia'];
      return bank.entries.map((e, i) => [e, i]).sort((a, b) => order.indexOf(a[0].voice) - order.indexOf(b[0].voice) || a[1] - b[1])
        .map(([e]) => ({file:pub(bank.base, e.file), text:tidy(e.text), group:cap(e.voice)}));
    },
  },
  'day-one-voices':{
    title:'Day One. Voices', madeIn:['Claude Code films'], groupLabel:'Voice', cast:['Strategy', 'Synthia'], tags:['day one', 'congrats', 'voice takes'],
    description:'Five ways to say Congrats on the new role!',
    items:() => {
      const v = read('src/films/day-one/voices.json');
      return v.takes.map(t => ({file:pub(v.base, t.file), text:`${tidy(t.text)} (${t.id.toUpperCase()}${t.motif ? ', the one the film sings' : ''})`, group:cap(t.voice)}));
    },
  },
  'meeting-dialogue':{
    title:'Meeting Dialogue', madeIn:['Studio and meeting rooms'], groupLabel:'Character', coverSub:'Meeting rooms',
    cast:['People & Culture', 'Strategy', 'Kevin', 'Keys', 'Operations', 'Arjun', 'Linda'], tags:['meeting', 'dialogue', 'voices', 'studio'],
    description:'130 lines from seven colleagues. It could have been an email.',
    items:() => {
      const cat = read('public/studio/voices/catalog.json'), rec = read('public/studio/voices/recordings.json');
      const lines = new Map(cat.lines.map((l, i) => [l.id, {text:l.text, i}]));
      const who = Object.keys(PEOPLE);
      return Object.values(rec.takes).map(t => ({t, line:lines.get(t.line)}))
        .sort((a, b) => who.indexOf(a.t.character) - who.indexOf(b.t.character) || (a.line?.i ?? 1e9) - (b.line?.i ?? 1e9))
        .map(({t, line}) => {
          const text = line?.text ?? HEARD[t.line];
          if (!text) throw new Error(`no words for dialogue take ${t.line}`);
          return {file:pub('studio/voices', t.file), text:tidy(text), group:PEOPLE[t.character]};
        });
    },
  },
  auditions:{
    title:'Casting Auditions', madeIn:['Studio and meeting rooms'], groupLabel:'Character', coverSub:'Meeting rooms',
    cast:['People & Culture', 'Strategy', 'Kevin', 'Keys', 'Operations', 'Arjun', 'Linda'], tags:['casting', 'auditions', 'voices', 'studio'],
    description:'Seven voices read for the part. Three reads each.',
    items:() => {
      const cat = read('public/studio/voices/catalog.json'), rec = read('public/studio/voices/recordings.json');
      const lines = new Map(cat.lines.map(l => [l.id, l.text]));
      return Object.keys(PEOPLE).filter(k => rec.auditions[k]).map(k => ({
        file:pub('studio/voices', rec.auditions[k].file), group:PEOPLE[k],
        text:rec.auditions[k].lines.map(id => tidy(lines.get(id) ?? HEARD[id] ?? '')).filter(Boolean).join(' / '),
      }));
    },
  },
  'season-audio':{
    title:'Meeting Season Audio', madeIn:['Studio and meeting rooms'], groupLabel:'Agenda', coverSub:'Meeting rooms', cast:[],
    tags:['meeting', 'season', 'beds', 'voice tracks', 'guitar fill', 'studio'],
    description:'Seven agendas, each with a bed and its voice tracks. One guitar fill, for the founder.',
    items:() => {
      // Every meeting's voice track and its agenda's bed, as src/meeting-room/audio-manifest.json plays them.
      // Standup and Offline share one bed (standup-bed.mp3 is the same bytes as offline-bed.mp3): it is listed once.
      const m = read('src/meeting-room/audio-manifest.json').meetings, cat = read('public/studio/voices/catalog.json');
      const fills = read('src/meeting-room/guitar-fills.json');
      const dir = (...f) => pub('studio/season/audio', ...f);
      const agendas = [...new Set(Object.keys(m).map(k => k.replace(/-\d+$/, '')))];
      const sameBytes = (a, b) => fs.readFileSync(dir(a)).equals(fs.readFileSync(dir(b)));
      const out = [], beds = [];
      for (const agenda of agendas) {
        const keys = Object.keys(m).filter(k => k.replace(/-\d+$/, '') === agenda), bed = m[keys[0]].bed;
        const twin = beds.find(b => sameBytes(b.file, bed));
        if (twin) twin.also.push(cap(agenda));
        else { const b = {file:bed, agenda:cap(agenda), also:[]}; beds.push(b); out.push(b); }
        for (const k of keys) out.push({file:m[k].voice, agenda:cap(agenda), text:`${tidy(cat.meetings[k]?.title ?? k)} (the voices)`});
        if (fills.file && agenda === 'founder') out.push({file:fills.file, agenda:'Founder', text:`Founder guitar fill: ${fills.variants.length} variations, ${fills.key}, ${fills.bpm} BPM`});
      }
      return out.map(o => ({file:dir(o.file), group:o.agenda, text:o.text ?? `${[o.agenda, ...o.also].join(' and ')} bed`}));
    },
  },
  'room-anthems':{
    title:'Room Anthems', madeIn:['Studio and meeting rooms'], groupLabel:'Room', coverSub:'Meeting rooms', cast:[], tags:['rooms', 'anthems', 'beds', 'voice clips', 'studio'],
    description:'Four rooms, four themes. A music bed and a sheet of voice clips for each.',
    items:() => Object.entries(read('src/meeting-studio/room-audio.json').tracks).flatMap(([key, t]) => {
      const room = read('src/meeting-studio/rooms.json').rooms.find(r => r.tracks[0] === key)?.title ?? key;
      return [
        {file:pub(t.music.file.replace(/^\//, '')), group:room, text:`${room}: the music bed`},
        {file:pub(t.voice.file.replace(/^\//, '')), group:room, text:`${room}: ${Object.keys(t.voice.clips).map(tidy).join(' / ')}`},
      ];
    }),
  },
  'studio-2-kits':{
    title:'Studio 2 Song Kits', madeIn:['Studio and meeting rooms'], groupLabel:'Song', coverText:'Studio 2|Song Kits', coverSub:'Studio 2', cast:[], tags:['studio 2', 'stems', 'kits', 'voice clips'],
    description:'The parts, not the songs: drums, bass, keys and lift end to end, and every line read twice.',
    items:() => {
      const s = read('src/studio-2/audio-manifest.json'), titles = new Map(read('src/studio-2/score.json').tracks.map(t => [t.id, t.title]));
      const song = key => tidy(titles.get(key) ?? key);
      const kits = Object.entries(s.tracks).flatMap(([key, t]) => [
        ...(t.music ? [{file:pub('studio-2/audio', t.music.file), group:song(key), text:`${song(key)}: ${Object.keys(t.music.stems).join(', ')}, end to end`}] : []),
        ...(t.voice ? [{file:pub('studio-2/audio', t.voice.file), group:song(key), text:`${song(key)}: ${Object.keys(t.voice.clips).map(tidy).join(' / ')}`}] : []),
      ]);
      const v = s.vocabulary;                                              // lines only, no music
      if (v?.file) kits.push({file:pub('studio-2/audio', v.file), group:'Vocabulary', text:`Vocabulary: ${Object.keys(v.clips).map(tidy).join(' / ')}`});
      return kits;
    },
  },
  instruments:{
    title:'All Hands Instruments', madeIn:['All Hands'], groupLabel:'Family', cast:[], tags:['instruments', 'synthesis', 'drums', 'tambourine', 'bass', 'all hands'],
    description:'Every drum, tambourine and bass the song engine plays. No samples. Just arithmetic.',
    itemsDir:'instruments', coverText:'Every|Instrument',                 // INSTRUMENTS will not set in PEG-9 on a cover
    items:({instruments}) => {
      if (!instruments) throw new Error('the instruments pack lists a render: node scripts/render-instrument-pack.mjs --out DIR, then --instruments DIR');
      return JSON.parse(fs.readFileSync(path.join(instruments, 'items.json'), 'utf8')).items;
    },
  },
  'film-voices':{
    title:'Film Voice Takes', madeIn:['Cutting Room originals', 'Claude Code films'], groupLabel:'Film', cast:['Synergy', 'Synthia', 'Linda'],
    tags:['voice takes', 'welcome to the office', 'synthia', 'printer song'], itemsDir:'film-voices', itemBitrate:'128k', coverSub:'Three films',
    description:'Short lines for Welcome to the Office, a Synthia follow-up, and Synergy’s Loading.',
    items:() => {
      // Welcome to the Office V1 lines as Whisper small.en heard them (no script survives); V2 from its phrase-timings.json.
      const A = (...p) => path.join(ROOT, 'assets', ...p), W = 'Welcome to the Office';
      const v2 = read('assets/films/welcome-to-office/v2/phrase-timings.json');
      const who = {synergy:'Synergy', synthia:'Synthia'};
      return [
        ['welcome', 'Synergy', 'Welcome. You already know how to work.'], ['describe', 'Synergy', 'We’ll teach you how to describe it.'],
        ['linda', 'Linda', 'We did this last year.'], ['humbled', 'Synergy', 'Humbled.'], ['honored', 'Synthia', 'Honored.'],
        ['share-m', 'Synergy', 'Excited to share.'], ['share-f', 'Synthia', 'Excited to share.'],
      ].map(([f, by, text]) => ({file:A('films/welcome-to-office/voices', `${f}.wav`), name:`welcome-${f}`, group:W, text:`${text} (${by})`}))
        .concat(Object.entries(v2).map(([f, p]) => ({file:A('films/welcome-to-office/v2/voices', `${f}.wav`), name:`welcome-v2-${f}`, group:W, text:`${tidy(p.text)} (${who[p.speaker]}, V2)`})))
        .concat([{file:A('film-corrections/synthia-followup/reply.wav'), name:'synthia-follow-up', group:'Synthia follow-up', text:`${tidy(read('assets/film-corrections/synthia-followup/production.json').voice.text)} (Synthia)`},
          {file:A('printer-song/printer-intro-voice.flac'), name:'printer-loading', group:'Printer Song', text:'Loading. (Synergy)'}]);
    },
  },
};

const q = s => /^[\w./@:+-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`;
export function command(key, file, extra = []) {
  const p = PACKS[key], args = ['node', 'scripts/publish-to-cutting-room.mjs', '--pack', file, '--title', p.title, '--category', 'Sounds',
    ...p.madeIn.flatMap(m => ['--made-in', m]), '--description', p.description, '--group-label', p.groupLabel,
    ...(p.cast.length ? ['--cast', p.cast.join(',')] : []), ...(p.tags.length ? ['--tags', p.tags.join(',')] : []),
    ...(p.coverText ? ['--cover-text', p.coverText] : []), ...(p.coverSub ? ['--cover-sub', p.coverSub] : []), ...(p.itemsDir ? ['--items-dir', p.itemsDir] : []), ...(p.itemBitrate ? ['--item-bitrate', p.itemBitrate] : []), ...extra];
  return args.map(q).join(' ');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), arg = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes('--list') || !argv[0]) { for (const [k, p] of Object.entries(PACKS)) console.log(`${k.padEnd(16)} ${p.title}`); process.exit(0); }
  const out = arg('out');
  if (!out) { console.error('pass --out DIR'); process.exit(2); }
  fs.mkdirSync(out, {recursive:true});
  const keys = argv[0] === 'all' ? Object.keys(PACKS) : [argv[0]];
  for (const key of keys) {
    if (!PACKS[key]) { console.error(`no pack ${key}; --list shows them`); process.exit(2); }
    const items = PACKS[key].items({instruments:arg('instruments')});
    const file = path.resolve(out, `${key}.json`);
    fs.writeFileSync(file, JSON.stringify({groupLabel:PACKS[key].groupLabel, items}, null, 1) + '\n');
    const extra = [...(arg('replaces') ? ['--replaces', arg('replaces')] : []), ...(argv.includes('--dry-run') ? ['--dry-run'] : [])];
    console.error(`${key}: ${items.length} items -> ${file}`);
    console.log(command(key, file, extra));
  }
}
