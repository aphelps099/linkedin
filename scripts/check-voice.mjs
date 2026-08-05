import assert from 'node:assert/strict';
import { generateVoiceClips, normalizeVoiceLines } from '../server/voice-service.js';

assert.deepEqual(normalizeVoiceLines(['  Milestone   unlocked.  ', '', 'Chat G P T.']), [
  'Milestone unlocked.',
  'Chat G P T.',
]);
assert.throws(()=>normalizeVoiceLines([]), /required/);

const calls = [];
const clips = await generateVoiceClips({
  lines:['Milestone unlocked.', 'Chat G P T.'],
  apiKey:'test-key',
  fetchImpl:async (url, options)=>{
    calls.push({url, body:JSON.parse(options.body), authorization:options.headers.Authorization});
    return new Response(new Uint8Array([1, 2, 3]), {
      status:200,
      headers:{'Content-Type':'audio/mpeg'},
    });
  },
});

assert.equal(calls.length, 2);
assert.equal(calls[0].url, 'https://api.openai.com/v1/audio/speech');
assert.equal(calls[0].body.model, 'gpt-4o-mini-tts');
assert.equal(calls[0].body.voice, 'alloy');
assert.match(calls[0].body.instructions, /Vintage 1980s corporate text-to-speech terminal/);
assert.equal(calls[0].authorization, 'Bearer test-key');
assert.equal(clips[0].contentType, 'audio/mpeg');
assert.ok(clips[0].audio);

const gatewayCalls = [];
await generateVoiceClips({
  lines:['Approved.'],
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
