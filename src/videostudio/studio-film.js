// The draft cut the studio monitor opens on: "Circle Back, Drop Edition 60" over the
// sample post, built from the move library (moves/) on the real shot index, until the
// export's draft cut replaces it. One passage per section of the drop60 form:
//
//   bar 0       cold open: BACK. as peg video, the rewind from bar 17, Pat's black tile
//   bars 1-3    grid bloom: the band joins one tile a beat, muted, then the call unmutes
//   bars 4-7    verse: Synergy pushing in, Pat's board, reactors cut on the sung words
//   bars 8-9    hook: Synergy's screen shared, the board between the banner and the strip
//   bars 10-11  verse 2: the speaking border chases the loudest stem
//   bars 12-19  the build follows the ladder: freeze the call, breakout rooms, cell split,
//               the retrigger roll, poor connection, the board alone, black at the choke
//   bar 20      BACK.: the board ignites over peg video
//   bars 20-22  drop A: the ensemble pushing in, Synergy, the pads hit-warped and punched
//   bar 23      Sink In: tape coupling, every R1 tile at the tape's speed
//   bars 24-27  drop B: the Droste dive into Pat's tile, the speaker chase with punch-ins
//   bars 28-29  everyone leaves the meeting; the tape stops
//
// Pure: the same plan and shots give the same EDL (every move draws on the seed).
import {MOVES} from './moves/index.js';
import {createEDL, merge} from './edl/schema.js';
import {barSteps} from './edl/anchors.js';

export const CAST = {
  synergy:'synergy-camera-v2-listening', synergyClose:'synergy-enthusiastic-training-close-up',
  ops:'drums-playing', opsArrive:'drummer-arrival-performance', pads:'drum-pad-detail', keys:'keys-listening', keysPlay:'keys-playing-wide-keys',
  kevin:'guitar-listening', people:'people-listening', peopleTalk:'people-speaking', arjun:'arjun-listening',
  linda:'linda-listening', strategy:'strategy-listening', synthia:'synthia-clean-face-plate',
  ensemble:'office-ensemble', applause:'corporate-applause-closer-reaction', arrive:'the-professionals-arrive',
  keysOffice:'keys-office-performance', kevinOffice:'guitar-office-performance', synthiaClose:'synthia-conference-closeup', peopleDesk:'people-linkedin-computer',
};
// What the monitor's cut list calls each scene.
export const SCENE_LABELS = {cold:'Cold open', join:'Grid bloom', verse:'Vocal cuts', hook:'Screen share', chase:'Speaker chase', freeze:'Freeze the call',
  rooms:'Breakout rooms', split:'Cell split', roll:'Retrigger roll', poor:'Poor connection', tag:'The choke', dropA:'BACK.', sink:'Sink In',
  dropB:'Droste dive', dropB2:'Punch-ins', leave:'Leave meeting'};
const PAT = 'gen:camera-off', BOARD = 'gen:board';
const ROOMS = {[CAST.ensemble]:'Boardroom 3B', [CAST.applause]:'Town hall', [CAST.arrive]:'Lobby'};
// The speaking border bound to a stem: lit when that player is loud, out when quiet.
const SPEAK = {voice:'voice', [CAST.synergy]:'voice', [CAST.ops]:'drums', [CAST.opsArrive]:'drums', [CAST.keys]:'keys', [CAST.keysPlay]:'keys', [CAST.kevin]:'guitar', [PAT]:'bass'};
const speaking = stem => ({bind:`stem:${stem}`, scale:1.5, base:-.3, attack:.02, release:.3});

export function studioFilm(plan, shots, {format = '9:16', features, seed = 7} = {}) {
  const BS = barSteps(plan), bar = n => n * BS;
  const m = (name, ctx) => MOVES[name].fn({plan, shots, features, format, seed, ...ctx});
  const c = (id, at, len, cell, asset, more = {}) => ({clips:[{id, at, len, cell, asset, ...more}]});
  const unmute = plan.call?.until ?? bar(2);
  // 16:9 lays stack3 out as three tall columns: only 1080p masters stay inside their zoom ceiling there.
  const columns = format === '16:9';
  const host = columns ? CAST.synergyClose : CAST.synergy;
  const reactors = columns ? [CAST.keysOffice, CAST.peopleDesk, CAST.synthiaClose, CAST.kevinOffice, CAST.applause] : [CAST.keys, CAST.people, CAST.arjun, CAST.linda, CAST.strategy];
  const patches = [
    // Cold open: the drop, flashed forward; then the tape rewinds from bar 17; then Pat's black tile.
    m('pegTakeover', {id:'open', at:0, len:6, pool:[CAST.arrive], instant:true, scene:'cold'}),
    m('rewind', {at:6, len:2, from:{anchor:'bar:17'}}),
    c('pat', 8, 8, 'full', PAT, {scene:'cold', chrome:{mic:'muted'}}),
    // Pat's tile takes the frame and the board with it; the board is home again as the call assembles (lint G14).
    {boardMoves:[{id:'pat.grow', at:8, frames:4, align:'start'}, {id:'pat.home', at:bar(1), frames:4, align:'end'}]},
    {board:[{id:'back', at:0, len:6, text:{ref:'song:impact#0'}}]},
    // The call assembles, one tile a beat, everyone muted until the call unmutes.
    m('gridBloom', {id:'join', at:bar(1), len:bar(3), pool:[PAT, CAST.opsArrive, CAST.keysPlay, CAST.kevin, CAST.synergy, CAST.people], scene:'join'}),
    // Verse: Synergy, Pat's board, the reactors cut on Synergy's words.
    m('slowPush', {id:'host', at:bar(4), len:bar(4), pool:[host], cell:'stack3.0', scene:'verse'}),
    c('patboard', bar(4), bar(4), 'stack3.1', PAT, {scene:'verse', chrome:{name:'Pat', mic:'on'}}),   // stack3 carries the board in its own band
    m('vocalCut', {id:'react', at:bar(4), len:bar(4), pool:reactors, cell:'stack3.2', scene:'verse'}),
    // The hook: Synergy shares his screen; the board takes the middle of the frame.
    c('share', bar(8), bar(2), 'BOARD+STRIP.0', `shot:${CAST.synergy}`, {scene:'hook', time:{in:2}, chrome:{banner:"You are viewing Synergy's screen", speaking:speaking('voice')}}),
    c('shareKeys', bar(8), bar(2), 'BOARD+STRIP.1', `shot:${CAST.keysPlay}`, {scene:'hook', time:{in:1}, chrome:{speaking:speaking('keys')}}),
    c('shareKevin', bar(8), bar(2), 'BOARD+STRIP.2', `shot:${CAST.kevin}`, {scene:'hook', time:{in:3}, chrome:{speaking:speaking('guitar')}}),
    // The board grows out of its home for the share and is home again on the cut that ends it (lint G14).
    {boardMoves:[{id:'share.grow', at:bar(8), frames:4, align:'start'}, {id:'share.home', at:bar(10), frames:4, align:'end'}]},
    // Verse 2: the border chases the loudest player.
    m('speakerChase', {id:'chase', at:bar(10), len:bar(2), pool:[CAST.synergy, CAST.ops, CAST.keys, CAST.kevin, CAST.people, PAT], scene:'chase'}),
    // The build. Freeze the call: everyone but Operations stops and greys.
    m('freezeTheCall', {id:'freeze', at:bar(12), len:bar(2), pool:[CAST.synergy, CAST.ops, CAST.keys, CAST.kevin, PAT, CAST.people, CAST.arjun, CAST.synthia, BOARD], scene:'freeze'}),
    m('breakoutRooms', {id:'rooms', at:bar(14), len:bar(2), skip:1, pool:[CAST.synergy, CAST.keys, CAST.people, CAST.arjun, CAST.synthia, CAST.strategy, CAST.linda, BOARD], scene:'rooms'}),
    m('cellSplit', {id:'split', at:bar(16), len:bar(1), pool:[CAST.pads], cell:'L1.0', scene:'split'}),
    m('retriggerRoll', {id:'roll', at:bar(17), len:bar(1), pool:[CAST.keysPlay, CAST.synergy, CAST.kevin, CAST.applause], cells:['G4.0', 'G4.1', 'G4.2', 'G4.3'], scene:'roll'}),
    c('poorHost', bar(18), bar(1), 'G6.0', `shot:${CAST.synergy}`, {scene:'poor', time:{in:4}, chrome:{speaking:speaking('voice')}}),
    m('poorConnection', {id:'poorA', at:bar(18), len:bar(1), pool:[CAST.keys], cell:'G6.1', scene:'poor'}),
    m('poorConnection', {id:'poorB', at:bar(18), len:bar(1), pool:[CAST.people], cell:'G6.2', scene:'poor', in:2}),
    c('poorPat', bar(18), bar(1), 'G6.3', PAT, {scene:'poor'}),
    m('poorConnection', {id:'poorC', at:bar(18), len:bar(1), pool:[CAST.arjun], cell:'G6.4', scene:'poor', in:1}),
    c('poorBoard', bar(18), bar(1), 'G6.5', BOARD, {scene:'poor', chrome:{name:'Pat'}}),
    c('ladder', bar(19), plan.choke.at - bar(19), 'full', 'gen:color:#000000', {scene:'tag'}),   // the board alone, grown to the frame over black
    {boardMoves:[{id:'ladder.grow', at:bar(19), frames:4, align:'start'}]},
    c('black', plan.choke.at, plan.choke.until - plan.choke.at, 'full', 'gen:color:#000000', {scene:'tag'}),
    // BACK.
    m('pegTakeover', {id:'ignite', at:{anchor:'cue:impact'}, len:8, pool:[CAST.arrive], scene:'dropA'}),
    m('slowPush', {id:'ens', at:plan.choke.until + 8, len:bar(23) - plan.choke.until - 8, pool:[CAST.ensemble], cell:'stack3.0', to:1.25, scene:'dropA'}),
    c('host2', plan.choke.until + 8, bar(23) - plan.choke.until - 8, 'stack3.1', `shot:${host}`, {scene:'dropA', time:{in:1.5}, chrome:{speaking:speaking('voice')}}),
    m('hitWarp', {id:'pads', at:plan.choke.until + 8, len:bar(23) - plan.choke.until - 8, pool:[CAST.pads], cell:'stack3.2', scene:'dropA'}),
    // Sink In.
    m('tapeCoupling', {id:'sink', pool:[CAST.synthia, CAST.applause, CAST.arrive, CAST.synergy], cells:['G4.0', 'G4.1', 'G4.2', 'G4.3'], scene:'sink'}),
    // Drop B: the Droste dive into Pat's tile, the call around it chasing the loudest player.
    m('speakerChase', {id:'chaseB', at:bar(24), len:bar(2), pool:[CAST.synergy, CAST.ops, CAST.keys, CAST.kevin, PAT, CAST.people, CAST.arjun, CAST.synthia, CAST.strategy], scene:'dropB'}),
    m('drosteDive', {id:'droste', at:bar(24), len:bar(1), cell:'G9.4', scene:'dropB'}),
    m('speakerChase', {id:'chaseC', at:bar(26), len:bar(2), pool:[CAST.synergy, CAST.ops, CAST.keysPlay, CAST.kevin, CAST.people, PAT], scene:'dropB2'}),
    // Outro: one tile leaves a beat; Synergy closes the film; the tape stops under him.
    m('leaveMeeting', {id:'leave', at:bar(28), len:bar(2), pool:[CAST.synergyClose, CAST.kevin, CAST.keysPlay, CAST.synthia, CAST.people, PAT, CAST.arjun], scene:'leave'}),
    m('tapeStop', {len:4}),
    c('tail', plan.totalSteps - 4, 4, 'full', 'gen:color:#000000', {scene:'leave'}),
  ];
  const edl = merge(createEDL({format, loop:true, seed}), ...patches);
  for (const clip of edl.clips) {
    const step = typeof clip.at === 'number' ? clip.at : null;
    // Room cameras join the call under the room's name, not the first face in shot.
    const room = ROOMS[clip.asset.replace(/^shot:/, '')];
    if (room && !clip.chrome?.name) clip.chrome = {...(clip.chrome || {}), name:room};
    // The call is muted until the unmute; after it, borders follow the players.
    if (clip.id.startsWith('join.')) {
      clip.chrome = {...(clip.chrome || {})};
      if (step !== null && step >= unmute) {
        clip.chrome.mic = 'on';
        const stem = SPEAK[clip.asset.replace(/^shot:/, '')] ?? SPEAK[clip.asset];
        if (stem) clip.chrome.speaking = speaking(stem);
      }
    }
    // The cell split: one decode of the pads, mosaic coarsening as the tile divides (and
    // never mirrored: an instrument keeps its hands).
    if (clip.id.startsWith('split.')) {
      if (clip.frame) delete clip.frame.mirror;
      if (clip.frame && !Object.keys(clip.frame).length) delete clip.frame;
      clip.fx = [{type:'mosaic', px:[[0, 8], [4, 10, 'step'], [8, 13, 'step'], [12, 16, 'step']]}];
    }
    // Drop B's second half: punch-ins on the snares.
    if (clip.id.startsWith('chaseC.') && !clip.asset.startsWith('gen:')) Object.assign(clip, MOVES.snarePunch.fn({plan, shots, features, format, seed, clip, at:clip.at, len:clip.len, to:1.1}).clips[0]);
    if (clip.id.startsWith('pads.')) Object.assign(clip, MOVES.snarePunch.fn({plan, shots, features, format, seed, clip, at:clip.at, len:clip.len, to:1.12}).clips[0]);
  }
  // The dive pushes the call's outer tiles out of the frame: their upscale is the camera's, not theirs.
  for (const clip of edl.clips) if ((clip.id === 'chaseB' || clip.id.startsWith('chaseB.')) && !clip.asset.startsWith('gen:'))
    edl.overrides.push({target:clip.id, rule:'G10', note:'The Droste dive carries this tile out of frame; it is never seen at the full push'});
  return edl;
}
