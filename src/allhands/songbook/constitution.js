// The composition constitution (CONSTITUTION.md) as data, and its lint.
//
//   lintTrack(track)        the chart and its declarations: tempo, swing, key and
//                           mode, the pentatonic melody, everyone in key, the band
//                           and the story, the pump, the tape, the filters, the form
//                           (the track's own: the Drop Edition, or the river for a
//                           track whose form is 'wander'; {form:'drop60'} lints the
//                           Drop Edition chart a river track keeps)
//   lintPlan(plan, render?) one arranged song: a Drop Edition (the form and its
//                           moments, the impact gap and its silence, every note in
//                           key, the ending) or a river (the ramps, the lush texture
//                           before any layer, the loop in every bar, the few clear
//                           phrases, every note in key); with `render`
//                           (scripts/measure-allhands.py --json), the mix targets
//                           measured from the file (the river: its swells)
//
// Both return violations, [{rule, level:'error'|'warning', reason}], worst
// first. A track may break a rule on purpose and say which (track.breaks:
// {rule:why}, "the other ten percent"): that error is then reported as a
// warning with its reason. Each track also declares what the constitution asks
// of it: `references` (which of the five, and how), `palette` (the band, role by
// role) and `story` (the backstory: Synergy keeps it simple, Synthia is the
// fluent one; backstory, not a feature, so a track may give Synthia no part
// and says null; a part it names must be played). Pure: no audio.
import {IMPACT_GAP, ladyClock, ladyLength} from '../drop.js';
import {trackOf, DEFAULT_CAST} from './index.js';
import {LADY_TABLE} from '../lady-table.js';
import {RIVER, WANDER_SECTIONS} from '../wander.js';

// ---- the rules as data -----------------------------------------------------------

export const REFERENCES = Object.freeze({
  'daft-punk':{name:'Daft Punk', take:'The spine: a filtered house groove, four-on-the-floor or half-time, sidechain on everything, the vocoder lead, disco guitar and bass.'},
  'panda-bear':{name:'Panda Bear', take:'The haze of voices: layered, looping, reverb-washed harmonies; tom-heavy patterns; delay that becomes rhythm.'},
  'washed-out':{name:'Washed Out', take:'The warmth: soft-focus pads, tape saturation and wow, nostalgia at a walking tempo.'},
  air:{name:'Air', take:'The lounge: Rhodes, Moog bass, analog strings, vocoder melancholy, room to breathe.'},
  kraftwerk:{name:'Kraftwerk', take:'The machine: sequenced 16ths, minimal motifs, the robot voice, electronic percussion, clarity.'},
});
export const SPINE = 'daft-punk';
export const BAND = Object.freeze(['synth', 'keys', 'drums', 'bass', 'guitar']);
export const FORM = Object.freeze(['Intro', 'Verse', 'Build', 'Drop A', 'Sink In', 'Drop B', 'Outro']);
// Intervals above the tonic. Home is minor; the haze songs (a track that takes
// Panda Bear or Washed Out) may live in major or Mixolydian.
export const MODES = Object.freeze({aeolian:[0, 2, 3, 5, 7, 8, 10], dorian:[0, 2, 3, 5, 7, 9, 10]});
export const HAZE_MODES = Object.freeze({ionian:[0, 2, 4, 5, 7, 9, 11], mixolydian:[0, 2, 4, 5, 7, 9, 10]});
export const HAZE = Object.freeze(['panda-bear', 'washed-out']);

export const RULES = Object.freeze({
  tempo:{bpm:[90, 130], home:120, maxKicksPerBar:4},
  swing:{max:.12},
  harmony:{modes:MODES, haze:HAZE_MODES, loop:[2, 4]},
  melody:{pentatonic:5},
  production:{maxDuck:.9, voiceReverb:.25, reverb:.45, wobbleShare:.25},
  form:{order:FORM, seconds:[55, 65], about:60},
  impact:IMPACT_GAP,
  // The film's loop seam: her stop line is heard (the engine's 16 ms look-ahead
  // included) at least 60 ms before the last two frames at 24 fps, the ghost BACK.
  seam:{fps:24, frames:2, clear:.06, latency:720 / 44100},
  mix:{integrated:[-11, -9], truePeak:-1, dropLift:2.5, silence:-60, wer:.5},
  never:['supersaw', 'trap', 'brostep'],
  // The river (CONSTITUTION.md, "The river"): the haze lane's form.
  river:{...RIVER, seconds:[55, 65], swellLift:2, acoustic:2},
});

// Each rule: its id, the line of CONSTITUTION.md it encodes, its level (an
// error unless the rule is advice).
export const RULE_TEXT = Object.freeze({
  'tempo.range':'90 to 130 BPM. Home is 120.',
  'tempo.doubleTime':'Half-time drops are welcome. Double-time is not.',
  'swing.light':'Swing is light, 0 to .12 of a 16th.',
  'swing.ladder':'The ladder always tightens to straight.',
  'harmony.home':'Home is minor, Dorian or Aeolian. The haze songs (Panda Bear, Washed Out lane) may live in major or Mixolydian.',
  'harmony.colour':'Major sevenths and ninths are colour, not the default.',
  'harmony.loop':'Loops of two to four chords.',
  'harmony.texture':'Change the texture, not the progression.',
  'melody.pentatonic':'Melody lives in the pentatonic.',
  'melody.everyChord':'So every note sits on every chord.',
  'inKey.everyone':'Everyone is in key: Synergy, every rung of the lady\'s ladder, her deep voice.',
  'inKey.tag':'Everyone is in key (her tag, spoken over the silence).',
  'band.roles':'The band: synth, keys, drums (Ops), bass (Pat), guitar (Kevin).',
  'band.printer':'The printer is the shaker.',
  'references':'Five references, one sound; Daft Punk is the spine.',
  'story.synergy':'Synergy\'s lines stay simple and a little stiff (backstory, not a feature: no song announces it).',
  'story.synthia':'Synth: two players. Synthia is fluent; Synergy keeps it simple.',
  'production.pump':'The kick drives a sidechain pump on pads and bass.',
  'production.tape':'Tape on the master: wow and flutter only as an event (Sink In, the tape stop).',
  'production.space':'Reverb and delay are space, never mud. Verses stay close and dry.',
  'production.filters':'Filters arrange the song: the intro opens up, the outro closes down.',
  'production.wobble':'Wobble is a spice, not the meal.',
  'form.order':'The Drop Edition, always in this order.',
  'form.length':'About 60 seconds.',
  'form.moments':'The muted call unmutes on Synergy\'s welcome; the ladder; the choke; the impact; Sink In; the tape stop.',
  'form.ladder':'The lady\'s ladder, retriggering faster and climbing in key.',
  'impact.downbeat':'The impact word on the downbeat.',
  'impact.gap':'About 0.4 s after her tag ends. Circle Back\'s gap is the reference.',
  'impact.silence':'The choke, then true silence.',
  'impact.wholeTag':'Her whole tag is heard.',
  'form.seam':'The tape stop under the closing phrase; the film loops on the ghost BACK.',
  'mix.loudness':'-10 LUFS integrated, true peak -1 dBTP or lower.',
  'mix.drops':'Every drop at least +2.5 LU over the verse, including on a phone speaker.',
  'mix.silence':'Digital silence before the impact.',
  'mix.intelligible':'Synergy and the lady stay intelligible: Whisper must hear her lines.',
  'never':'Never: festival EDM, supersaw hooks, trap hi-hat rolls or brostep as the main idea.',
  // The river.
  'river.form':'The river has no ladder, no choke and no BACK.: a loop that thickens, about 60 seconds.',
  'river.lush':'Repetition is the instrument: one pattern first, alone, repeating and thickening; layer only once the texture is lush.',
  'river.ramps':'Always ramp in: no layer arrives or leaves in less than two bars (and none takes more than eight).',
  'river.loop':'The steady rhythmic loop runs throughout.',
  'river.phrases':'Few clear vocal phrases, one or two that rise out of the stream and sink back in; Synergy at most once. Singers never trade phrases back to back.',
  'river.tambourine':'Tambourine in the background, up a little where the texture swells.',
  'river.acoustic':'Acoustic colours woven through a sound that stays about 90% electronic.',
  'river.flow':'No hard section boundaries: the flow changes gently.',
  'mix.swells':'Every swell at least +2 LU over the stream it grew from, on a phone speaker.',
});
const ADVICE = new Set(['harmony.colour', 'harmony.texture', 'melody.everyChord', 'inKey.tag', 'production.space', 'production.wobble', 'story.synthia', 'mix.intelligible', 'river.flow']);

// ---- helpers ------------------------------------------------------------------------

const pc = m => ((Math.round(m) % 12) + 12) % 12;
const NAMES = {C:0, D:2, E:4, F:5, G:7, A:9, B:11};
const NOTE = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const midiOf = hz => 69 + 12 * Math.log2(hz / 440);
// "A minor", "E-flat major", "F# dorian": {tonic, quality}.
export function parseKey(key) {
  const m = /^([A-G])(?:-?(flat|sharp)|([b♭#♯]))?\s+(\w+)/i.exec(String(key).trim());
  if (!m) return null;
  const acc = (m[2] || m[3] || '').toLowerCase(), shift = /flat|b|♭/.test(acc) ? -1 : /sharp|#|♯/.test(acc) ? 1 : 0;
  return {tonic:(NAMES[m[1].toUpperCase()] + shift + 12) % 12, quality:m[4].toLowerCase()};
}
const sectionsOf = D => Object.fromEntries(D.sections.map(s => [s.name, s]));
const sectionAt = (D, bar) => D.sections.find(s => bar >= s.from && bar < s.to) || D.sections.at(-1);
const barsOf = (D, name) => { const s = sectionsOf(D)[name]; return s ? Array.from({length:s.to - s.from}, (_, i) => s.from + i) : []; };
const periodOf = rung => rung.hits.length > 1 ? rung.hits[1] - rung.hits[0] : 16;
// Notes of a chord as pitch classes (root and voicings).
const chordPcs = c => new Set([c.root, ...c.notes, ...(c.keys || [])].map(pc));
// The pentatonic notes that sit a semitone over a chord tone without being one (a flat-nine rub).
const rubs = (c, penta) => { const tones = chordPcs(c); return penta.filter(p => !tones.has(p) && tones.has((p + 11) % 12)); };

function finish(out, track, unused = false) {
  const breaks = track?.breaks || {};
  const seen = new Set(out.map(v => v.rule));
  // A hard violation (v.hard) is what a declared break still keeps (Delve.'s ten phrases stay four bars apart; its
  // two minutes stay inside the chart's own window): it is never excused.
  const res = out.map(v => v.level === 'error' && breaks[v.rule] && !v.hard ? {...v, level:'warning', reason:`${v.reason}. Broken on purpose: ${breaks[v.rule]}`, declared:true} : v);
  if (unused) for (const rule of Object.keys(breaks)) if (!seen.has(rule)) res.push({rule, level:'warning', reason:RULE_TEXT[rule] ? `declares a break of "${rule}" but keeps the rule` : `declares a break of "${rule}", which is no rule`});
  return res.sort((a, b) => (a.level === 'error' ? 0 : 1) - (b.level === 'error' ? 0 : 1));
}
const collector = () => {
  const out = [];
  const flag = (rule, ok, reason) => { if (!ok) out.push({rule, level:ADVICE.has(rule) ? 'warning' : 'error', reason:typeof reason === 'function' ? reason() : reason}); };
  const hard = (rule, ok, reason) => { if (!ok) out.push({rule, level:'error', hard:true, reason:typeof reason === 'function' ? reason() : reason}); };
  return {out, flag, hard};
};

// ---- lintTrack ------------------------------------------------------------------------

// A track (a song book entry, or a new chart not yet in the book) or its id.
export function lintTrack(trackOrId, {form} = {}) {
  const tr0 = trackOrId && typeof trackOrId === 'object' && (trackOrId.drop || trackOrId.wander) ? trackOrId : trackOf(trackOrId);
  if ((form ?? tr0.form) === 'wander') return lintRiver(tr0);
  const tr = tr0, D = tr.drop, {out, flag} = collector(), R = RULES, name = tr.title;
  const penta = D.ladder.pentatonic, inKey = m => tr.pitchClasses.includes(pc(m)), allBars = Array.from({length:D.bars}, (_, b) => b);
  // Tempo and groove.
  flag('tempo.range', tr.bpm >= R.tempo.bpm[0] && tr.bpm <= R.tempo.bpm[1], `${name} is ${tr.bpm} BPM, outside ${R.tempo.bpm.join('-')}`);
  const busy = allBars.filter(b => tr.kicksOf(b, D.layers(b)).length > R.tempo.maxKicksPerBar);
  flag('tempo.doubleTime', !busy.length, () => `bars ${busy.join(', ')} kick more than four to the bar: that is double time`);
  const swung = allBars.filter(b => D.swing(b) > R.swing.max + 1e-9);
  flag('swing.light', tr.swing <= R.swing.max + 1e-9 && !swung.length, () => `swing ${tr.swing} of a 16th: ${swung.length} of ${D.bars} bars swing more than ${R.swing.max}`);
  const fast = D.ladder.rungs.filter(r => periodOf(r) <= 2).map(r => r.bar), chokeBar = D.choke.bar, loose = [...new Set([...fast, chokeBar])].filter(b => D.swing(b) !== 0);
  flag('swing.ladder', !loose.length, () => `the ladder swings in bars ${loose.join(', ')}: her 8ths and faster must sit straight`);
  // Harmony.
  const key = parseKey(tr.key), intervals = key && [...new Set(tr.pitchClasses.map(p => (p - key.tonic + 12) % 12))].sort((a, b) => a - b);
  const haze = HAZE.some(r => tr.references?.[r]), modes = haze ? {...MODES, ...HAZE_MODES} : MODES;
  const mode = key && Object.entries(modes).find(([, iv]) => iv.join() === intervals.join())?.[0], third = mode && MODES[mode] ? 3 : 4;
  const home = key && Object.values(tr.chords).find(c => pc(c.root) === key.tonic), homePcs = home && chordPcs(home), homeOk = home && homePcs.has((key.tonic + third) % 12) && !homePcs.has((key.tonic + 7 - third) % 12);
  flag('harmony.home', !!mode && !!homeOk, () => `${tr.key}: ${!key ? 'no key' : mode ? mode : `not Aeolian or Dorian${haze ? ', Ionian or Mixolydian' : ' (major or Mixolydian is for the haze songs: Panda Bear, Washed Out)'}`}${home ? (homeOk ? '' : `, home chord ${home.name} does not sit on the mode's third`) : ', no chord on the tonic'}`);
  flag('harmony.colour', !home || !homePcs.has((key.tonic + 11) % 12), () => `the home chord ${home.name} carries a major seventh: colour as the default`);
  const verse = barsOf(D, 'Verse').map(b => tr.chordAt(b)), loop = [1, 2, 3, 4].find(p => verse.every((c, i) => i + p >= verse.length || verse[i + p] === c));
  const loopChords = new Set(verse.slice(0, loop));
  flag('harmony.loop', loop >= R.harmony.loop[0] && loop <= R.harmony.loop[1], () => `the verse is not a loop of 2 to 4 chords (${verse.map(c => c.name).join(' ')})`);
  const extra = [...new Set(allBars.map(b => tr.chordAt(b)).filter(c => !loopChords.has(c)))];
  flag('harmony.texture', !extra.length, () => `chords outside the verse loop: ${extra.map(c => `${c.name} (${D.sections.filter(s => barsOf(D, s.name).some(b => tr.chordAt(b) === c)).map(s => s.name).join(', ')})`).join('; ')}`);
  // Melody.
  const scalePcs = [...new Set(tr.music.scale.map(pc))];
  flag('melody.pentatonic', penta.length === R.melody.pentatonic && penta.every(p => tr.pitchClasses.includes(p)) && scalePcs.every(p => penta.includes(p)),
    () => `Synergy's melody table (${scalePcs.map(p => NOTE[p]).join(' ')}) is not the ${penta.length}-note pentatonic ${penta.map(p => NOTE[p]).join(' ')}`);
  const rubbed = Object.values(tr.chords).map(c => ({c, notes:rubs(c, penta).filter(p => !c.avail || c.avail.includes(p))})).filter(x => x.notes.length);
  flag('melody.everyChord', !rubbed.length, () => rubbed.map(({c, notes}) => `${notes.map(p => NOTE[p]).join(', ')} rubs a semitone over ${c.name}${c.avail ? '' : ' (no avail: Synergy may sing it there)'}`).join('; '));
  // Everyone in key.
  const notIn = [];
  for (const c of Object.values(tr.chords)) for (const m of [c.root, ...c.notes, ...(c.keys || [])]) if (!inKey(m)) notIn.push(`${c.name} ${m}`);
  for (const [what, list] of [['melody', tr.music.scale], ['home', tr.music.home], ['answers', D.answers.notes], ['stammer', D.stutter.notes], ['ladder targets', D.ladder.targets], ['impact', [D.impactNote]], ['saw riser', tr.sound.sawRiser || []]]) for (const m of list) if (!inKey(m)) notIn.push(`${what} ${m}`);
  for (const [what, hz] of [['drop kick', tr.sound.dropKick?.settle], ['sub drop', tr.sound.subDrop?.from], ['sub drop end', tr.sound.subDrop?.to]]) if (hz && (Math.abs(midiOf(hz) - Math.round(midiOf(hz))) > .5 || !inKey(midiOf(hz)))) notIn.push(`${what} ${hz} Hz`);
  flag('inKey.everyone', !notIn.length, () => `out of ${tr.key}: ${notIn.join(', ')}`);
  const tag = LADY_TABLE[DEFAULT_CAST.tag.file];
  if (!D.tag.tune && tag?.f0) {
    const m = midiOf(tag.f0 * D.tag.rate), cents = Math.round((m - Math.round(m)) * 100);
    flag('inKey.tag', inKey(m) && Math.abs(cents) <= 50, `her tag plays at a fixed ${D.tag.rate}x: "Let's circle-" lands on ${NOTE[pc(m)]} (${cents >= 0 ? '+' : ''}${cents} cents), outside ${tr.key}; the tuned tracks set drop.tag.tune`);
  }
  // The band and the story.
  const palette = tr.palette || {}, missing = BAND.filter(r => !palette[r]);
  const layers = allBars.map(b => D.layers(b)), plays = {keys:layers.some(L => L.keys || L.stabs), drums:layers.some(L => L.kick), bass:layers.some(L => L.bass), guitar:layers.some(L => L.guitar)};
  const silent = Object.entries(plays).filter(([, v]) => !v).map(([k]) => k);
  flag('band.roles', !missing.length && !silent.length && /clap|snap/i.test(palette.drums || ''), () => [missing.length && `no palette for ${missing.join(', ')}`, silent.length && `${silent.join(', ')} never play`, !/clap|snap/i.test(palette.drums || '') && 'the drums name no claps'].filter(Boolean).join('; '));
  flag('band.printer', layers.some(L => L.shaker), 'the printer (the shaker) never plays');
  const refs = tr.references || {}, unknown = Object.keys(refs).filter(k => !REFERENCES[k]), unsaid = Object.entries(refs).filter(([, how]) => !String(how || '').trim()).map(([k]) => k);
  flag('references', Object.keys(refs).length && refs[SPINE] && !unknown.length && !unsaid.length, () => [!Object.keys(refs).length && 'declares no references', Object.keys(refs).length && !refs[SPINE] && 'no Daft Punk, the spine', unknown.length && `unknown references ${unknown.join(', ')}`, unsaid.length && `${unsaid.join(', ')} without how`].filter(Boolean).join('; '));
  const story = tr.story || {};
  flag('story.synergy', !!String(story.synergy || '').trim(), 'the story does not say what Synergy plays (simple, a little stiff)');
  const synthiaPlays = !!tr.band?.synthia || layers.some(L => L.synthia);
  // Synergy learning the synth is backstory (CONSTITUTION.md): no song has to show
  // Synthia's part, so none is asked for; a part a track names must be heard.
  flag('story.synthia', !story.synthia || synthiaPlays, () => `the story gives Synthia "${story.synthia}" but no bar plays her part (band.synthia, layers.synthia)`);
  // Production.
  const S = tr.mix.stems;
  flag('production.pump', S.bass.duck <= R.production.maxDuck && S.keys.duck <= R.production.maxDuck, `the kick ducks bass to ${S.bass.duck} and the pads (keys stem) to ${S.keys.duck}; a pump ducks both to ${R.production.maxDuck} or below`);
  const tapeBars = allBars.filter(b => layers[b].tape), sinkOk = tapeBars.length === 1 && tapeBars[0] === D.sink && layers[D.sink].tape === 'sink' && sectionAt(D, D.sink).name === 'Sink In';
  flag('production.tape', sinkOk && sectionAt(D, D.stop.bar).name === 'Outro' && D.stop.seconds > 0, () => `wow belongs to Sink In (bar ${D.sink}) and the tape stop in the outro; tape events in bars ${tapeBars.join(', ') || 'none'}, the stop in ${sectionAt(D, D.stop.bar).name}`);
  const wet = Object.entries(S).filter(([n, s]) => (s.reverb ?? 0) > (n === 'voice' ? R.production.voiceReverb : R.production.reverb));
  flag('production.space', !wet.length, () => `wet sends: ${wet.map(([n, s]) => `${n} reverb ${s.reverb}`).join(', ')}`);
  const intro = barsOf(D, 'Intro'), outro = barsOf(D, 'Outro'), cut = b => D.cutoff(b).keys;
  flag('production.filters', cut(intro[0])[0] < cut(intro.at(-1))[1] && cut(outro[0])[0] > cut(outro.at(-1))[1], `the keys filter must open across the intro (${cut(intro[0])[0]} to ${cut(intro.at(-1))[1]} Hz) and close across the outro (${cut(outro[0])[0]} to ${cut(outro.at(-1))[1]} Hz)`);
  const wobbly = allBars.filter(b => layers[b].bass === 'wobble' || layers[b].bass === 'drop' || layers[b].wobble);
  flag('production.wobble', wobbly.length / D.bars <= R.production.wobbleShare, `the wobble plays ${wobbly.length} of ${D.bars} bars`);
  // The form.
  flag('form.order', D.sections.map(s => s.name).join() === FORM.join(), `sections ${D.sections.map(s => s.name).join(', ')}; the Drop Edition is ${FORM.join(', ')}`);
  const seconds = D.bars * 16 * tr.step;
  flag('form.length', seconds >= R.form.seconds[0] && seconds <= R.form.seconds[1], `${seconds.toFixed(1)} s, not about ${R.form.about}`);
  const at = n => sectionAt(D, n).name, host = D.slots({hook:'a b', verses:['a', 'b', 'c', 'd']})[0];
  const moments = [[at(D.unmute) === 'Intro' && host.bar === D.unmute && host.kind === 'host', `the call unmutes at bar ${D.unmute}, on ${host.kind} line ${host.text}`],
    [D.ladder.rungs.every(r => at(r.bar) === 'Build'), 'the ladder leaves the build'], [at(D.choke.bar) === 'Build' && D.choke.bar === sectionsOf(D).Build.to - 1, `the choke falls in bar ${D.choke.bar}, not the build's last`],
    [D.impact === sectionsOf(D)['Drop A'].from, `the impact (bar ${D.impact}) is not Drop A's downbeat`], [at(D.sink) === 'Sink In', 'Sink In is not where the tape sinks'], [at(D.rise) === 'Build', 'the board brightens outside the build']];
  const bad = moments.filter(([ok]) => !ok).map(([, why]) => why);
  flag('form.moments', !bad.length, () => bad.join('; '));
  const periods = D.ladder.rungs.map(periodOf), degs = D.ladder.rungs.flatMap(r => r.deg || r.glide);
  flag('form.ladder', periods.every((p, i) => !i || p <= periods[i - 1]) && periods[0] === 16 && periods.at(-1) === .5 && degs.every((d, i) => !i || d >= degs[i - 1]) && degs.at(-1) === 5,
    `her ladder must retrigger from 1 bar down to 1/32 (${periods.join(', ')} 16ths) and climb the pentatonic to the octave (degrees ${degs[0]} to ${degs.at(-1)})`);
  const words = Object.values(palette).join(' ').toLowerCase(), banned = R.never.filter(w => new RegExp(`\\b${w}\\b`).test(words));
  flag('never', !banned.length, () => `the palette names ${banned.join(', ')}`);
  return finish(out, tr, true);
}

// ---- lintPlan -------------------------------------------------------------------------

// render: scripts/measure-allhands.py --json of that plan's render (optional).
export function lintPlan(plan, render) {
  const tr = trackOf(plan.track), D = tr.drop, {out, flag} = collector(), R = RULES, T = plan.timing, at = e => ladyClock(T, plan.step, e.at);
  if (plan.form === 'wander') return lintRiverPlan(plan, render);
  if (plan.form !== 'drop60') { flag('form.order', false, `${plan.title ?? plan.form} is not the Drop Edition`); return finish(out); }
  const penta = D.ladder.pentatonic, inKey = m => tr.pitchClasses.includes(pc(m)), seconds = T[plan.totalSteps];
  flag('form.length', seconds >= R.form.seconds[0] && seconds <= R.form.seconds[1], `${seconds.toFixed(1)} s, not about ${R.form.about}`);
  flag('form.order', plan.sections.map(s => s.name).join() === FORM.join(), `sections ${plan.sections.map(s => s.name).join(', ')}`);
  const m = plan.marks, host = plan.lines[0];
  flag('form.moments', plan.call?.until === m.unmute && host?.words[0]?.at === m.unmute && m.unmute < m.build && m.build < m.choke && m.choke < m.impact && m.impact < m.sink && m.sink < m.stop && m.stop < plan.totalSteps,
    'the moments are out of order: unmute on his welcome, ladder, choke, BACK., Sink In, the tape stop');
  // The ladder: faster and climbing, straight from the 8ths, ending at the choke.
  const ladder = plan.lady.filter(e => e.role === 'ladder');
  flag('form.ladder', ladder.length > 0 && ladder.every((e, i) => !i || (e.midi >= ladder[i - 1].midi - 1e-9 && e.period <= ladder[i - 1].period + 1e-9) || e.rung === ladder[i - 1].rung) && ladder.every(e => e.at < plan.choke.at),
    'her ladder must retrigger faster, climb, and stop at the choke');
  const loose = [...new Set([...ladder.filter(e => e.period <= 2).map(e => Math.floor(e.at / 16)), Math.floor(plan.choke.at / 16)])].filter(b => plan.bars[b].swing !== 0);
  flag('swing.ladder', !loose.length, () => `the ladder swings in bars ${loose.join(', ')}`);
  // The choke, the silence, the impact.
  const tag = plan.lady.find(e => e.role === 'tag'), impact = plan.lady.find(e => e.role === 'impact'), impactT = T[plan.choke.until];
  flag('impact.downbeat', plan.choke.until % 16 === 0 && plan.choke.until === m.impact && (!impact || impact.at === m.impact) && plan.kicks.includes(m.impact), 'BACK. is not on the downbeat with the drop kick');
  const gap = impactT - plan.choke.tagEnd;
  flag('impact.gap', !tag || (gap >= R.impact.min - 1e-9 && gap <= R.impact.max + 1e-9), `her tag ends ${(gap * 1000).toFixed(0)} ms before BACK.; the reference is ${(R.impact.target * 1000).toFixed(0)} ms (${R.impact.min}-${R.impact.max} s)`);
  const heard = [...plan.words.map(w => [T[w.at], T[w.at] + w.gate, w.display]), ...plan.lady.filter(e => e.role !== 'tag').map(e => [at(e), at(e) + ladyLength(e), e.display])].filter(([a, b]) => b > plan.choke.time + 1e-9 && a < impactT - 1e-9);
  flag('impact.silence', !heard.length, () => `${heard.map(x => x[2]).join(', ')} sound between the choke and BACK.`);
  flag('impact.wholeTag', !tag || tag.gate >= (tag.to - tag.from) / tag.rate - 1e-9, () => `her tag is gated at ${tag.gate.toFixed(3)} s of ${((tag.to - tag.from) / tag.rate).toFixed(3)} s`);
  // Everyone in key; the melody in the pentatonic, on the chord.
  const notIn = [];
  for (const w of plan.words) for (const n of w.notes) if (!inKey(n.midi)) notIn.push(`"${w.display}" ${n.midi}`);
  for (const x of plan.stutters) if (!inKey(x.midi)) notIn.push(`stammer ${x.midi}`);
  for (const e of plan.lady) { if (e.role === 'ladder' && Math.abs(e.midi - Math.round(e.midi)) < 1e-9 && !inKey(e.midi)) notIn.push(`ladder ${e.midi}`); if (e.root !== undefined && !inKey(e.root)) notIn.push(`${e.role} root ${e.root}`); }
  flag('inKey.everyone', !notIn.length, () => `out of ${tr.key}: ${notIn.slice(0, 6).join(', ')}${notIn.length > 6 ? ` and ${notIn.length - 6} more` : ''}`);
  const offPenta = [...plan.words.flatMap(w => w.notes), ...plan.stutters].filter(n => !penta.includes(pc(n.midi)));
  flag('melody.pentatonic', !offPenta.length, () => `${offPenta.length} of Synergy's notes leave the pentatonic`);
  const rubbing = plan.words.flatMap(w => w.notes.map(n => ({w, n}))).filter(({n}) => rubs(plan.bars[Math.floor(n.at / 16)].chord, penta).includes(pc(n.midi)));
  flag('melody.everyChord', !rubbing.length, () => `${rubbing.length} of Synergy's notes rub a semitone over their chord (${[...new Set(rubbing.map(({n}) => `${NOTE[pc(n.midi)]} on ${plan.bars[Math.floor(n.at / 16)].chord.name}`))].join(', ')})`);
  if (tag && LADY_TABLE[tag.file]?.f0) {
    const mm = midiOf(LADY_TABLE[tag.file].f0 * tag.rate), cents = Math.round((mm - Math.round(mm)) * 100);
    flag('inKey.tag', inKey(mm) && Math.abs(cents) <= 50, `"${tag.display}" at ${tag.rate.toFixed(3)}x lands on ${NOTE[pc(mm)]} (${cents >= 0 ? '+' : ''}${cents} cents), outside ${tr.key}`);
  }
  // The pump: the kick plays in every bar of both drops.
  const dropBars = plan.bars.filter(b => /^Drop/.test(b.section)), unkicked = dropBars.filter(b => !plan.kicks.some(k => Math.floor(k / 16) === b.index));
  flag('production.pump', !unkicked.length, () => `no kick to pump in bars ${unkicked.map(b => b.index).join(', ')}`);
  const tape = plan.tape || [], sink = tape.find(x => x.kind === 'sink'), stop = tape.find(x => x.kind === 'stop'), line = plan.stop?.line;
  flag('production.tape', tape.length === 2 && sink?.from === m.sink && sink.rate?.join() === '1,0.5' && stop?.from === m.stop && (line === null || line === undefined || Math.abs(line - T[stop.from]) <= .1),
    'the tape is Sink In (half speed) and the stop under her closing phrase, and nothing else');
  // The ending and the film's loop seam.
  if (plan.stop?.end !== null && plan.stop?.end !== undefined) {
    const N = Math.round(seconds * R.seam.fps), seam = (N - R.seam.frames) / R.seam.fps, heardTo = plan.stop.end + R.seam.latency;
    flag('form.seam', heardTo + R.seam.clear <= seam + 1e-9, `her stop line is heard to ${heardTo.toFixed(3)} s, ${((seam - heardTo) * 1000).toFixed(0)} ms before the ghost BACK. (frame ${N - R.seam.frames}); it needs ${R.seam.clear * 1000} ms`);
  }
  // The mix, measured.
  if (render) {
    const L = render.loudness || {}, I = L.integrated_lufs, tp = L.true_peak_dbtp;
    flag('mix.loudness', Number.isFinite(I) && I >= R.mix.integrated[0] && I <= R.mix.integrated[1] && Number.isFinite(tp) && tp <= R.mix.truePeak + 1e-9, `${I?.toFixed?.(2)} LUFS integrated, true peak ${tp?.toFixed?.(2)} dBTP`);
    const lifts = (render.drop_vs_verse || []).filter(d => !(d.lift_lu >= R.mix.dropLift && d.phone_lift_lu >= R.mix.dropLift));
    flag('mix.drops', (render.drop_vs_verse || []).length >= 2 && !lifts.length, () => lifts.length ? lifts.map(d => `${d.drop} +${d.lift_lu} LU (phone +${d.phone_lift_lu})`).join(', ') : 'no drop measured over the verse');
    const loud = (render.silence || []).filter(s => s.peak_dbfs !== null && s.peak_dbfs >= R.mix.silence);
    flag('mix.silence', (render.silence || []).length > 0 && !loud.length, () => loud.length ? loud.map(s => `${s.span}: ${s.peak_dbfs} dBFS`).join(', ') : 'no silence window measured before the impact');
    const missed = (render.whisper || []).filter(w => w.wer > R.mix.wer);
    flag('mix.intelligible', !missed.length, () => missed.map(w => `"${w.expected}" heard as "${w.heard}"`).join('; '));
  }
  return finish(out, tr);
}

// Readable lines, for checks and logs.
export const describe = violations => violations.map(v => `${v.level === 'error' ? 'ERROR' : 'warn '} ${v.rule}: ${v.reason}`);

// ---- the river ----------------------------------------------------------------------------

// The mode a key and its pitch classes make (haze modes allowed for a haze song), and whether the home chord sits on its third.
function modeOf(tr, chords) {
  const key = parseKey(tr.key), intervals = key && [...new Set(tr.pitchClasses.map(p => (p - key.tonic + 12) % 12))].sort((a, b) => a - b);
  const haze = HAZE.some(r => tr.references?.[r] || tr.wander?.references?.[r]), modes = haze ? {...MODES, ...HAZE_MODES} : MODES;
  const mode = key && Object.entries(modes).find(([, iv]) => iv.join() === intervals.join())?.[0], third = mode && MODES[mode] ? 3 : 4;
  const home = key && chords.find(c => pc(c.root) === key.tonic), homePcs = home && chordPcs(home);
  return {key, mode, haze, home, ok:!!mode && !!home && homePcs.has((key.tonic + third) % 12) && !homePcs.has((key.tonic + 7 - third) % 12)};
}

// A river chart (track.wander): the rules every song keeps, and the river's own.
export function lintRiver(trackOrId) {
  const tr = trackOrId && typeof trackOrId === 'object' && trackOrId.wander ? trackOrId : trackOf(trackOrId), W = tr.wander, {out, flag, hard} = collector(), R = RULES, V = R.river, name = tr.title;
  const inKey = m => tr.pitchClasses.includes(pc(m)), bar = 16 * tr.step, layers = W.layerSpec, refs = W.references ?? tr.references ?? {};
  flag('tempo.range', tr.bpm >= R.tempo.bpm[0] && tr.bpm <= R.tempo.bpm[1], `${name} is ${tr.bpm} BPM`);
  flag('swing.light', W.swing <= R.swing.max + 1e-9, `the river swings ${W.swing} of a 16th`);
  const chords = [...new Set(Array.from({length:W.bars}, (_, b) => W.chordAt(b)))], m = modeOf(tr, chords);
  flag('harmony.home', m.ok, () => `${tr.key}: ${m.mode ?? 'no mode it may live in'}${m.home ? '' : ', no chord on the tonic'}`);
  flag('harmony.loop', chords.length >= R.harmony.loop[0] && chords.length <= R.harmony.loop[1], `the river moves through ${chords.length} chords`);
  // Every pentatonic the river sings (a chart may move it by bar: W.pentatonicAt, Delve.'s Pool), each five notes in key.
  const pentas = [...new Map((W.pentatonicAt ? Array.from({length:W.bars}, (_, b) => W.pentatonicAt(b)) : [W.pentatonic]).map(p => [p.join(), p])).values()];
  flag('melody.pentatonic', pentas.every(pen => pen.length === R.melody.pentatonic && pen.every(p => tr.pitchClasses.includes(p))), () => `the river sings ${pentas.length > 1 ? 'pentatonics' : 'a pentatonic'} ${pentas.map(p => p.join('.')).join(' and ')}: five notes in key each`);
  const notIn = [];
  for (const c of chords) for (const x of [c.root, ...c.notes, ...(c.keys || [])]) if (!inKey(x)) notIn.push(`${c.name} ${x}`);
  flag('inKey.everyone', !notIn.length, () => `out of ${tr.key}: ${notIn.join(', ')}`);
  // The band and the story.
  const palette = W.palette || {}, missing = BAND.filter(r => !palette[r]), stems = new Set(layers.map(l => l.stem));
  const heard = {keys:stems.has('keys'), drums:stems.has('drums'), bass:stems.has('bass'), guitar:stems.has('guitar'), synth:stems.has('lady') || !!W.hook};
  const silent = Object.entries(heard).filter(([, v]) => !v).map(([k]) => k);
  flag('band.roles', !missing.length && !silent.length && /clap|snap/i.test(palette.drums || ''), () => [missing.length && `no palette for ${missing.join(', ')}`, silent.length && `${silent.join(', ')} never play`].filter(Boolean).join('; '));
  flag('band.printer', !!W.loop?.shake?.some(v => v > 0), 'the printer (the shaker) never plays');
  const unknown = Object.keys(refs).filter(k => !REFERENCES[k]);
  flag('references', Object.keys(refs).length && refs[SPINE] && !unknown.length, 'the river declares its references, Daft Punk the spine');
  flag('story.synergy', !!String((W.story ?? tr.story)?.synergy || '').trim(), 'the story does not say what Synergy plays');
  flag('production.pump', tr.mix.stems.bass.duck <= R.production.maxDuck && tr.mix.stems.keys.duck <= R.production.maxDuck, 'the stomps pump Pat and the drone');
  const first = layers.reduce((a, b) => (b.in[0] < a.in[0] ? b : a)), last = layers.reduce((a, b) => (b.out[1] > a.out[1] ? b : a));
  flag('production.filters', (first.shut ?? 300) < (first.open ?? 12000) && (last.shut ?? 300) < (last.open ?? 12000), 'every layer opens its filter as it ramps in and closes it as it leaves');
  // The river's own rules.
  const seconds = W.bars * bar;
  flag('river.form', !W.ladder && !W.choke && !W.impact && seconds >= V.seconds[0] && seconds <= V.seconds[1], `${seconds.toFixed(1)} s${W.ladder || W.choke || W.impact ? ', with a ladder, choke or impact' : ''}`);
  // A declared break of the length keeps the chart's own window (W.seconds), and never a ladder, choke or impact.
  if (W.breaks?.['river.form']) hard('river.form', !W.ladder && !W.choke && !W.impact && W.seconds && seconds >= W.seconds[0] && seconds <= W.seconds[1], `${seconds.toFixed(1)} s, outside the chart's own window ${W.seconds?.join('-') ?? '(none declared)'}`);
  const short = layers.filter(l => l.in[1] - l.in[0] < V.minRamp - 1e-9 || l.out[1] - l.out[0] < V.minRamp - 1e-9 || l.in[1] - l.in[0] > V.maxRamp + 1e-9 || l.out[1] - l.out[0] > V.maxRamp + 1e-9);
  flag('river.ramps', !short.length, () => `layers ramping in or out outside ${V.minRamp}-${V.maxRamp} bars: ${short.map(l => `${l.id} ${l.in.join('-')} / ${l.out.join('-')}`).join(', ')}`);
  // The first texture sounds first and alone for lushBefore bars before its first copy; other
  // samples join only once every layer of it that came before them is fully in (the texture is lush).
  const textures = layers.filter(l => l.kind === 'texture'), src0 = textures.reduce((a, b) => (b.in[0] < a.in[0] ? b : a)), mine = textures.filter(l => l.source === src0.source);
  const otherAt = Math.min(...textures.filter(t => t.source !== src0.source).map(t => t.in[0])), copies = mine.filter(l => l !== src0).sort((a, b) => a.in[0] - b.in[0]);
  // Lush: her first copy fully in, and every layer of hers that started before the others.
  const lush = Math.max(copies[0]?.in[1] ?? Infinity, ...mine.filter(l => l.in[0] < otherAt).map(l => l.in[1]));
  const copyAt = copies[0]?.in[0] ?? Infinity, early = textures.filter(l => l.source !== src0.source && l.in[0] < lush - 1e-9);
  flag('river.lush', mine.length >= 2 && src0.in[0] <= Math.min(...layers.map(l => l.in[0])) && copyAt - src0.in[0] >= V.lushBefore && !early.length,
    () => `the first texture (${src0.id}) must sound first and alone ${V.lushBefore} bars, then thicken (${mine.length} layers of it) before other samples join: ${early.map(l => l.id).join(', ') || 'none early'}`);
  const loop = layers.find(l => l.kind === 'loop'), bars = Array.from({length:W.bars}, (_, b) => b), kicked = bars.filter(b => W.kicksOf(b, W.layers(b)).length);
  flag('river.loop', !!loop && loop.in[0] <= 3 && loop.out[0] >= W.fade[0] - 1e-9 && kicked.length >= W.bars - 1, () => `the loop plays ${kicked.length} of ${W.bars} bars${loop ? `, from bar ${loop.in[0]} to ${loop.out[1]}` : ', no loop layer'}`);
  // The clear phrases: the chart's own (W.phrases and his hook), or a setlist's (Delve.: her vocabulary, W.setlist).
  const at = W.setlist ? W.setlist.map(p => p.bar + (p.step ?? 0) / 16).sort((a, b) => a - b) : [W.hook?.bar, W.phrases?.y, W.phrases?.refrain].filter(x => x !== undefined && x !== null).sort((a, b) => a - b);
  const count = W.setlist ? W.setlist.length + (W.hook ? 1 : 0) : Object.keys(W.phrases || {}).length, spaced = at.every((x, i) => !i || x - at[i - 1] >= V.phraseGap);
  flag('river.phrases', count <= V.phrases && spaced, `clear phrases at bars ${at.join(', ')}: at most ${V.phrases} and Synergy once, ${V.phraseGap} bars apart`);
  // Under a declared break of the count, the spacing still holds: four bars from start to start.
  if (W.breaks?.['river.phrases']) hard('river.phrases', spaced, () => `clear phrases at bars ${at.join(', ')}: ${V.phraseGap} bars apart even when there are many`);
  const tamb = layers.find(l => l.kind === 'tambourine'), swellMax = Math.max(1, ...(tamb?.swell || []).map(x => x[1]));
  flag('river.tambourine', !!tamb && swellMax <= 1.6, tamb ? `the tambourine comes up ${swellMax}x: a little` : 'no tambourine');
  const acoustic = layers.filter(l => (W.acoustic || []).includes(l.id) && l.kind === 'colour');
  flag('river.acoustic', acoustic.length >= V.acoustic, `${acoustic.length} acoustic colours`);
  const e = Array.from({length:W.bars}, (_, b) => W.energy(b)), jumps = e.map((x, i) => (i && i < W.fade[0] ? Math.abs(x - e[i - 1]) : 0)).filter(d => d > .12);
  flag('river.flow', !jumps.length, () => `the energy jumps ${jumps.map(d => d.toFixed(2)).join(', ')} between bars`);
  const words = Object.values(palette).join(' ').toLowerCase(), banned = R.never.filter(w => new RegExp(`\\b${w}\\b`).test(words));
  flag('never', !banned.length, () => `the palette names ${banned.join(', ')}`);
  return finish(out, {...tr, breaks:W.breaks ?? {}}, true);
}

// One arranged river (wander.js): its form, its ramps, its loop, its few clear phrases, every note in key;
// with a render, the loudness and the swells.
export function lintRiverPlan(plan, render) {
  const tr = trackOf(plan.track), W = tr.wander, {out, flag, hard} = collector(), R = RULES, V = R.river, T = plan.timing, bar = 16 * plan.step, seconds = T[plan.totalSteps];
  const inKey = m => tr.pitchClasses.includes(pc(m)), penta = W.pentatonic;
  // The river's length (as the chart lint names it, river.form); a declared break keeps the chart's own window.
  flag('river.form', seconds >= R.form.seconds[0] && seconds <= R.form.seconds[1], `${seconds.toFixed(1)} s, not about ${R.form.about}`);
  if (W.breaks?.['river.form']) hard('river.form', W.seconds && seconds >= W.seconds[0] && seconds <= W.seconds[1], `${seconds.toFixed(1)} s, outside the chart's own window ${W.seconds?.join('-')}`);
  flag('river.form', !plan.choke && !plan.lady.some(e => ['ladder', 'tag', 'impact'].includes(e.role)) && !(plan.tape || []).some(x => x.kind === 'sink') && plan.sections.every(s => WANDER_SECTIONS.includes(s.name)),
    'a river has no ladder, choke or impact, and its sections are its phases');
  const bad = plan.layers.filter(l => l.in[1] - l.in[0] < V.minRamp * bar - 1e-6 || l.out[1] - l.out[0] < V.minRamp * bar - 1e-6);
  flag('river.ramps', !bad.length, () => `${bad.map(l => l.id).join(', ')} ramp in or out in under ${V.minRamp} bars`);
  const tex = plan.layers.filter(l => l.kind === 'texture'), firstTex = tex.reduce((a, b) => (b.in[0] < a.in[0] ? b : a), tex[0]);
  const others = tex.filter(l => l.source !== firstTex?.source), hers = tex.filter(l => l.source === firstTex?.source && l !== firstTex).sort((a, b) => a.in[0] - b.in[0]);
  const lushAt = Math.max(hers[0]?.in[1] ?? Infinity, ...tex.filter(l => l.source === firstTex?.source && (!others.length || l.in[0] < Math.min(...others.map(o => o.in[0])))).map(l => l.in[1]));
  flag('river.lush', !!firstTex && others.every(l => l.in[0] >= lushAt - 1e-6), 'other samples join only once her texture is lush');
  const unkicked = plan.bars.filter(b => b.index >= 1 && T[b.index * 16] < plan.stop.fade[0] - 1e-9 && !plan.kicks.some(k => Math.floor(k / 16) === b.index)).map(b => b.index);
  flag('river.loop', !unkicked.length, () => `the loop drops out in bars ${unkicked.join(', ')}`);
  // The clear phrases: the band's (a pickup and its word are one phrase) and Synergy's lines.
  const groups = [];
  for (const e of plan.band) { const g = groups.find(x => x.part === e.part && x.couplet === e.couplet && e.start - x.end < .6); if (g) { g.end = Math.max(g.end, e.end); g.voices.add(e.voice); } else groups.push({part:e.part, couplet:e.couplet, start:e.start, end:e.end, voices:new Set([e.voice])}); }
  const his = plan.lines.map(l => ({part:'synergy', start:T[l.words[0].at], end:Math.max(...l.words.map(w => T[w.at] + w.gate)), voices:new Set(['synergy'])}));
  const all = [...groups, ...his].sort((a, b) => a.start - b.start), gaps = all.slice(1).map((p, i) => p.start - all[i].end);
  const hooks = plan.lines.reduce((n, l) => n + 1 + l.words.some(w => w.repeat), 0);
  flag('river.phrases', groups.length <= V.phrases && hooks <= V.synergy && gaps.every(g => g >= (V.phraseGap - 1) * bar - 1e-6),
    () => `${groups.length} clear band phrases, Synergy ${hooks}x, gaps ${gaps.map(g => g.toFixed(1)).join(', ')} s`);
  // Under a declared break of the count (a setlist), the spacing still holds: three bars of stream from one phrase's
  // end to the next one's start, four from start to start, and never two voices back to back.
  if (W.breaks?.['river.phrases']) {
    const starts = all.slice(1).map((p, i) => p.start - all[i].start), trade = all.slice(1).filter((p, i) => gaps[i] < V.phraseGap * bar && [...p.voices].some(v => !all[i].voices.has(v)));
    hard('river.phrases', hooks <= V.synergy && gaps.every(g => g >= (V.phraseGap - 1) * bar - 1e-6) && starts.every(d => d >= V.phraseGap * bar - 2 * plan.step - 1e-6) && !trade.length,
      () => `gaps ${gaps.map(g => g.toFixed(1)).join(', ')} s, starts ${starts.map(d => d.toFixed(1)).join(', ')} s apart${trade.length ? `, voices trading at ${trade.map(p => p.start.toFixed(1)).join(', ')} s` : ''}`);
  }
  const notIn = [];
  for (const e of plan.band) for (const n of e.notes || []) if (!inKey(n.midi)) notIn.push(`"${e.display}" ${n.midi}`);
  for (const w of plan.words) for (const n of w.notes) if (!inKey(n.midi)) notIn.push(`"${w.display}" ${n.midi}`);
  for (const l of plan.loops) for (const c of l.cuts) if (l.key && !penta.includes(pc(c.base))) notIn.push(`loop ${l.id} ${c.text} ${c.base}`);
  // Her vocabulary (a setlist): every phrase tuned in key, every composed note of her echoes, her choir and the stars.
  for (const e of plan.band) if (e.own && Number.isFinite(e.midi) && Math.abs(e.midi - Math.round(e.midi)) < 1e-9 && !inKey(e.midi)) notIn.push(`"${e.display}" ${e.midi}`);
  for (const h of plan.echoes || []) for (const m of [...(h.kind === 'step' ? [h.midi] : []), ...(h.notes || []).map(n => n[2])]) if (!inKey(m)) notIn.push(`${h.phrase} ${h.kind} ${m}`);
  for (const c of plan.choir || []) for (const m of c.midi) if (!inKey(m)) notIn.push(`choir ${c.syllable} ${m}`);
  for (const s of plan.stars?.twinkles || []) if (!inKey(s.midi) || !(W.pentatonicAt ? W.pentatonicAt(Math.floor((s.t + 1e-6) / bar)) : penta).includes(pc(s.midi))) notIn.push(`star ${s.t.toFixed(2)} ${s.midi}`);
  flag('inKey.everyone', !notIn.length, () => `out of ${tr.key}: ${notIn.slice(0, 6).join(', ')}`);
  flag('river.tambourine', plan.layers.some(l => l.kind === 'tambourine'), 'no tambourine in the river');
  flag('river.acoustic', plan.layers.filter(l => l.kind === 'colour').length >= V.acoustic, 'the acoustic colours are missing');
  if (render) {
    const L = render.loudness || {}, I = L.integrated_lufs, tp = L.true_peak_dbtp;
    flag('mix.loudness', Number.isFinite(I) && I >= R.mix.integrated[0] && I <= R.mix.integrated[1] && Number.isFinite(tp) && tp <= R.mix.truePeak + 1e-9, `${I?.toFixed?.(2)} LUFS integrated, true peak ${tp?.toFixed?.(2)} dBTP`);
    const sw = render.swells || [], weak = sw.filter(w => !(w.phone_lift_lu >= V.swellLift));
    flag('mix.swells', sw.length > 0 && !weak.length, () => weak.length ? weak.map(w => `${w.name} +${w.phone_lift_lu?.toFixed?.(2)} LU on the phone`).join(', ') : 'no swell measured');
    const missed = (render.whisper || []).filter(w => w.wer > R.mix.wer);
    flag('mix.intelligible', !missed.length, () => missed.map(w => `"${w.expected}" heard as "${w.heard}"`).join('; '));
  }
  return finish(out, {...tr, breaks:{...(tr.breaks || {}), ...(W.breaks || {})}});
}
