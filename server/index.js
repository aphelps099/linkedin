import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVoiceClips } from './voice-service.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');

app.disable('x-powered-by');
app.use(express.json({limit:'32kb'}));

app.post('/api/voice', async (req, res)=>{
  try{
    const clips = await generateVoiceClips({
      clips:req.body?.clips,
      lines:req.body?.lines,
      apiKey:process.env.OPENAI_API_KEY,
      apiBaseUrl:process.env.CUSTOM_CRED_API_OPENAI_COM_URL || 'https://api.openai.com',
      gatewayToken:process.env.CUSTOM_CRED_API_OPENAI_COM_TOKEN,
    });
    res.json({clips, provider:'openai'});
  }catch(error){
    const message = error?.message || 'Voice generation failed';
    const status = /required|array|configured/i.test(message) ? 400 : 502;
    res.status(status).json({error:message});
  }
});

app.get('/api/health', (_req, res)=>{
  res.json({
    ok:true,
    voiceConfigured:Boolean(
      process.env.OPENAI_API_KEY ||
      process.env.CUSTOM_CRED_API_OPENAI_COM_TOKEN
    ),
  });
});

app.use(express.static(dist, {
  extensions:['html'],
  maxAge:'1h',
  setHeaders(res, file){
    if(file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

app.get('*', (req, res)=>{
  if(req.path.startsWith('/api/')){
    res.status(404).json({error:'Not found'});
    return;
  }
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(port, '0.0.0.0', ()=>{
  console.log(`Circle Back listening on ${port}`);
});
