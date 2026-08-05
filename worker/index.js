import { generateVoiceClips } from '../server/voice-service.js';

const DEFAULT_ORIGINS = [
  'https://linkedinbeats.com',
  'https://www.linkedinbeats.com',
  'https://aphelps099.github.io',
];

function cors(origin, env){
  const configured = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(x=>x.trim())
    .filter(Boolean);
  const allowed = configured.length ? configured : DEFAULT_ORIGINS;
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  return {
    'Access-Control-Allow-Origin': local || allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    const headers = cors(request.headers.get('Origin'), env);
    if(request.method === 'OPTIONS') return new Response(null, {status:204, headers});
    if(url.pathname !== '/api/voice' || request.method !== 'POST'){
      return Response.json({error:'Not found'}, {status:404, headers});
    }
    try{
      const body = await request.json();
      const clips = await generateVoiceClips({
        lines: body.lines,
        apiKey: env.OPENAI_API_KEY,
      });
      return Response.json({clips, provider:'openai'}, {headers});
    }catch(error){
      const status = /required|array|configured/i.test(error.message) ? 400 : 502;
      return Response.json({error:error.message || 'Voice generation failed'}, {status, headers});
    }
  },
};
