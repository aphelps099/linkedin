import originalScore from '../studio-2/score.json';
import originalAudio from '../studio-2/audio-manifest.json';
import roomData from './rooms.json';
import roomAudio from './room-audio.json';

export const ROOMS=roomData.rooms;
export const STUDIO_TRACKS=[...roomData.tracks,...originalScore.tracks];
export const STUDIO_AUDIO={...originalAudio,tracks:{...originalAudio.tracks,...roomAudio.tracks}};
export const roomForTrack=id=>ROOMS.find(room=>room.tracks.includes(id))||ROOMS[0];
export const queueForRoom=room=>room.tracks.map(id=>STUDIO_TRACKS.findIndex(track=>track.id===id)).filter(index=>index>=0);
export const isRoomAnthem=track=>roomData.tracks.some(t=>t.id===track.id);
