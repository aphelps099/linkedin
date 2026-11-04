// The move library (plan §3.1), one file per family. Every move is a pure
// function move(ctx) -> {clips, board?, transports?, camera?, notes?}, a patch
// to merge into an EDL (schema.merge). `ctx` is described in util.js.
import * as cuts from './cuts.js';
import * as camera from './camera.js';
import * as time from './time.js';
import * as grid from './grid.js';
import * as look from './look.js';

const entry = (family, fn, extra = {}) => ({family, fn, ...extra});
export const MOVES = {
  downbeatCut:entry('cuts', cuts.downbeatCut, {n:1}),
  offbeatCut:entry('cuts', cuts.offbeatCut, {n:2}),
  vocalCut:entry('cuts', cuts.vocalCut, {n:3}),
  jCut:entry('cuts', cuts.jCut, {n:4}),
  lCut:entry('cuts', cuts.lCut, {n:5}),
  matchCut:entry('cuts', cuts.matchCut, {n:6, needs:'faceBox on both shots'}),
  jumpCut:entry('cuts', cuts.jumpCut, {n:8}),
  slowPush:entry('camera', camera.slowPush, {n:9}),
  crashZoom:entry('camera', camera.crashZoom, {n:10}),
  snapLadder:entry('camera', camera.snapLadder, {n:11}),
  snarePunch:entry('camera', camera.snarePunch, {n:12}),
  whipSlide:entry('camera', camera.whipSlide, {n:13}),
  hatRoll:entry('camera', camera.hatRoll, {n:14}),
  speedFit:entry('time', time.speedFit, {n:15}),
  hitWarp:entry('time', time.hitWarp, {n:16, needs:'shot.hits'}),
  tapeCoupling:entry('time', time.tapeCoupling, {n:17}),
  speedRamp:entry('time', time.speedRamp, {n:18}),
  freezeLabel:entry('time', time.freezeLabel, {n:19}),
  stutter:entry('time', time.stutter, {n:20}),
  retriggerRoll:entry('time', time.retriggerRoll, {n:21, needs:'plan.lady ladder'}),
  boomerang:entry('time', time.boomerang, {n:22, needs:'an R1 shot'}),
  rewind:entry('time', time.rewind, {n:23, signature:'rewind'}),
  tapeStop:entry('time', time.tapeStop, {n:23.5}),
  gridBloom:entry('grid', grid.gridBloom, {n:24}),
  gridCollapse:entry('grid', grid.gridCollapse, {n:24.5}),
  cellSplit:entry('grid', grid.cellSplit, {n:25}),
  breakoutRooms:entry('grid', grid.breakoutRooms, {n:26}),
  freezeTheCall:entry('grid', grid.freezeTheCall, {n:27}),
  reactionCanon:entry('grid', grid.reactionCanon, {n:28, signature:'canon'}),
  dubDelay:entry('grid', grid.dubDelay, {n:29}),
  speakerChase:entry('grid', grid.speakerChase, {n:30}),
  poorConnection:entry('look', look.poorConnection, {n:32}),
  pegTakeover:entry('look', look.pegTakeover, {n:33, signature:'ignition'}),
  drosteDive:entry('look', look.drosteDive, {n:34, signature:'droste'}),
  kaleido:entry('look', look.kaleido, {n:35, needs:'a mirrorable shot'}),
  rgbSplit:entry('look', look.rgbSplit, {n:36}),
  irisToEye:entry('look', look.irisToEye, {n:37}),
  leaveMeeting:entry('grid', grid.leaveMeeting, {n:38}),
};
export const MOVE_NAMES = Object.keys(MOVES);
export {cuts, camera, time, grid, look};
