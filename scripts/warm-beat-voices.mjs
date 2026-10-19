import {localAnnouncer} from '../server/local-announcer.js';
import {beatRobot} from '../server/beat-robot.js';
for(const audio of [await localAnnouncer('Ready for the next chapter.'),await beatRobot('The production voice service is ready.')]){
  if(audio.length<44||audio.toString('ascii',0,4)!=='RIFF')throw new Error('Voice warmup failed');
}
console.log('Beat voices ready: Kokoro Heart and retro robot.');
