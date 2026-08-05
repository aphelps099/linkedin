const MODEL = 'gpt-4o-mini-tts';
const ELEVEN_MODEL = 'eleven_multilingual_v2';
export const DEFAULT_ELEVENLABS_VOICE_ID = 'hpp4J3VqNfWAUOO0d1Us';
const MAX_LINES = 8;
const MAX_LINE_LENGTH = 180;

export const ANNOUNCER_INSTRUCTIONS = [
  'Polished female corporate broadcast announcer with dry authority.',
  'Natural conversational pitch and a controlled, brisk cadence.',
  'Sound immaculate but faintly overproduced, like an internal awards video.',
  'Play the language completely straight. Never wink at the joke.',
  'Keep the read compact and rhythmic. Do not add words.',
  'Treat punctuation as timing direction.',
].join(' ');

export const ROBOT_INSTRUCTIONS = [
  'Vintage 1980s corporate text-to-speech terminal, not a human narrator.',
  'Use rigidly flat pitch, precise consonants, and a brisk, clipped cadence.',
  'Speak each status field distinctly, like a mainframe reading an audit record.',
  'Emotionally blank, mechanical, and authoritative.',
  'Never sound cheerful, inspirational, or conversational.',
  'Do not speak slowly and do not add dramatic pauses.',
  'Deliver the line as one compact rhythmic machine sample.',
  'Treat punctuation as rhythmic direction.',
].join(' ');

const PROFILES = {
  announcer:{voice:'shimmer', instructions:ANNOUNCER_INSTRUCTIONS},
  robot:{voice:'alloy', instructions:ROBOT_INSTRUCTIONS},
};

export function normalizeVoiceRequests(value){
  if(!Array.isArray(value)) throw new Error('lines must be an array');
  const clips = value
    .slice(0, MAX_LINES)
    .map(item=>{
      const source = typeof item === 'string' ? {text:item, role:'robot'} : (item || {});
      const text = String(source.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LINE_LENGTH);
      const role = source.role === 'announcer' ? 'announcer' : 'robot';
      return text ? {text, role} : null;
    })
    .filter(Boolean);
  if(!clips.length) throw new Error('at least one line is required');
  return clips;
}

export const normalizeVoiceLines = value => normalizeVoiceRequests(value).map(item=>item.text);

function bytesToBase64(bytes){
  let binary = '';
  const chunk = 0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function generateVoiceClips({
  clips,
  lines,
  apiKey,
  apiBaseUrl = 'https://api.openai.com',
  gatewayToken,
  elevenLabsApiKey,
  elevenLabsBaseUrl = 'https://api.elevenlabs.io',
  elevenLabsGatewayToken,
  elevenLabsVoiceId = DEFAULT_ELEVENLABS_VOICE_ID,
  fetchImpl = fetch,
}){
  const clean = normalizeVoiceRequests(clips || lines);
  return Promise.all(clean.map(async item=>{
    if(item.role === 'announcer'){
      if(!elevenLabsApiKey && !elevenLabsGatewayToken){
        throw new Error('ELEVENLABS_API_KEY is not configured');
      }
      const response = await fetchImpl(
        `${elevenLabsBaseUrl.replace(/\/$/, '')}/v1/text-to-speech/${elevenLabsVoiceId}?output_format=mp3_44100_128`,
        {
          method:'POST',
          headers:{
            ...(elevenLabsGatewayToken
              ? {'x-api-key':elevenLabsGatewayToken}
              : {'xi-api-key':elevenLabsApiKey}),
            'Content-Type':'application/json',
          },
          body:JSON.stringify({
            text:item.text,
            model_id:ELEVEN_MODEL,
            voice_settings:{
              stability:0.52,
              similarity_boost:0.8,
              style:0.24,
              use_speaker_boost:true,
              speed:1.0,
            },
          }),
        },
      );
      if(!response.ok){
        let detail = '';
        try{ detail = (await response.json())?.detail?.message || ''; }catch{}
        throw new Error(detail || `ElevenLabs voice request failed (${response.status})`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {audio:bytesToBase64(bytes), contentType:'audio/mpeg', role:item.role};
    }

    if(!apiKey && !gatewayToken) throw new Error('OPENAI_API_KEY is not configured');
    const profile = PROFILES[item.role];
    const response = await fetchImpl(`${apiBaseUrl.replace(/\/$/, '')}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        ...(gatewayToken
          ? {'x-api-key':gatewayToken}
          : {'Authorization':`Bearer ${apiKey}`}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        voice: profile.voice,
        input:item.text,
        instructions:profile.instructions,
        response_format: 'wav',
      }),
    });
    if(!response.ok){
      let detail = '';
      try{ detail = (await response.json())?.error?.message || ''; }catch{}
      throw new Error(detail || `OpenAI voice request failed (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {audio: bytesToBase64(bytes), contentType:'audio/wav', role:item.role};
  }));
}
