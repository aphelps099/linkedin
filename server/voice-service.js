const MODEL = 'gpt-4o-mini-tts';
const VOICE = 'onyx';
const MAX_LINES = 9;
const MAX_LINE_LENGTH = 180;

export const VOICE_INSTRUCTIONS = [
  'Deadpan corporate compliance robot.',
  'Crisp, clipped cadence.',
  'Completely serious and slightly ominous.',
  'Never sound cheerful, inspirational, or conversational.',
  'No dramatic pauses; deliver the line as one compact rhythmic sample.',
  'Treat punctuation as rhythmic direction.',
].join(' ');

export function normalizeVoiceLines(value){
  if(!Array.isArray(value)) throw new Error('lines must be an array');
  const lines = value
    .slice(0, MAX_LINES)
    .map(line=> String(line || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LINE_LENGTH))
    .filter(Boolean);
  if(!lines.length) throw new Error('at least one line is required');
  return lines;
}

function bytesToBase64(bytes){
  let binary = '';
  const chunk = 0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function generateVoiceClips({
  lines,
  apiKey,
  apiBaseUrl = 'https://api.openai.com',
  gatewayToken,
  fetchImpl = fetch,
}){
  if(!apiKey && !gatewayToken) throw new Error('OPENAI_API_KEY is not configured');
  const clean = normalizeVoiceLines(lines);
  return Promise.all(clean.map(async input=>{
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
        voice: VOICE,
        input,
        instructions: VOICE_INSTRUCTIONS,
        response_format: 'mp3',
      }),
    });
    if(!response.ok){
      let detail = '';
      try{ detail = (await response.json())?.error?.message || ''; }catch{}
      throw new Error(detail || `OpenAI voice request failed (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {audio: bytesToBase64(bytes), contentType:'audio/mpeg'};
  }));
}
