import assert from 'node:assert/strict';
import {
  ANNOUNCER_INSTRUCTIONS,
  DEFAULT_ELEVENLABS_VOICE_ID,
  ROBOT_INSTRUCTIONS,
  generateVoiceClips,
  normalizeVoiceLines,
  normalizeVoiceRequests,
} from '../server/voice-service.js';

assert.deepEqual(normalizeVoiceLines(['  Milestone   unlocked.  ', '', 'Chat G P T.']), [
  'Milestone unlocked.',
  'Chat G P T.',
]);
assert.throws(()=>normalizeVoiceLines([]), /required/);
assert.deepEqual(normalizeVoiceRequests([
  {text:'  Quarterly   reflection. ', role:'announcer'},
  {text:'Milestone unlocked.', role:'robot'},
  {text:'Unknown role.', role:'pirate'},
]), [
  {text:'Quarterly reflection.', role:'announcer'},
  {text:'Milestone unlocked.', role:'robot'},
  {text:'Unknown role.', role:'robot'},
]);
assert.equal(normalizeVoiceRequests(['Archive compatibility.'])[0].role, 'robot');
assert.ok(ANNOUNCER_INSTRUCTIONS.includes('corporate broadcast announcer'));
assert.ok(ROBOT_INSTRUCTIONS.includes('Vintage 1980s corporate text-to-speech terminal'));

const calls = [];
const clips = await generateVoiceClips({
  clips:[
    {text:'Quarterly reflection.', role:'announcer'},
    {text:'Chat G P T.', role:'robot'},
  ],
  apiKey:'test-key',
  elevenLabsApiKey:'eleven-key',
  fetchImpl:async (url, options)=>{
    calls.push({url, body:JSON.parse(options.body), headers:options.headers});
    return new Response(new Uint8Array([1, 2, 3]), {
      status:200,
      headers:{'Content-Type':'audio/wav'},
    });
  },
});

assert.equal(calls.length, 2);
assert.equal(calls[0].url, `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`);
assert.equal(calls[0].body.model_id, 'eleven_multilingual_v2');
assert.equal(calls[0].headers['xi-api-key'], 'eleven-key');
assert.equal(calls[1].body.voice, 'alloy');
assert.match(calls[1].body.instructions, /Vintage 1980s corporate text-to-speech terminal/);
assert.equal(calls[1].body.response_format, 'wav');
assert.equal(calls[1].headers.Authorization, 'Bearer test-key');
assert.equal(clips[0].contentType, 'audio/mpeg');
assert.equal(clips[0].role, 'announcer');
assert.equal(clips[1].role, 'robot');
assert.ok(clips[0].audio);

const gatewayCalls = [];
await generateVoiceClips({
  clips:[{text:'Approved.', role:'robot'}],
  apiBaseUrl:'https://credential-gateway.example',
  gatewayToken:'gateway-token',
  fetchImpl:async (url, options)=>{
    gatewayCalls.push({url, headers:options.headers});
    return new Response(new Uint8Array([4, 5, 6]), {status:200});
  },
});
assert.equal(gatewayCalls[0].url, 'https://credential-gateway.example/v1/audio/speech');
assert.equal(gatewayCalls[0].headers['x-api-key'], 'gateway-token');
assert.equal(gatewayCalls[0].headers.Authorization, undefined);

console.log('voice checks passed');
