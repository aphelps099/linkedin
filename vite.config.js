import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { generateVoiceClips } from './server/voice-service.js';

function localVoiceApi(){
  return {
    name: 'circle-back-local-voice-api',
    configureServer(server){
      server.middlewares.use('/api/voice', (req, res)=>{
        if(req.method !== 'POST'){
          res.statusCode = 405;
          res.end(JSON.stringify({error:'Method not allowed'}));
          return;
        }
        let raw = '';
        req.on('data', chunk=>{ raw += chunk; });
        req.on('end', async ()=>{
          res.setHeader('Content-Type', 'application/json');
          try{
            const body = JSON.parse(raw || '{}');
            const gatewayToken = process.env.CUSTOM_CRED_API_OPENAI_COM_TOKEN;
            const clips = await generateVoiceClips({
              lines:body.lines,
              apiKey:process.env.OPENAI_API_KEY,
              apiBaseUrl:process.env.CUSTOM_CRED_API_OPENAI_COM_URL
                || 'https://api.openai.com',
              gatewayToken,
            });
            res.end(JSON.stringify({clips, provider:'openai'}));
          }catch(error){
            res.statusCode = /required|array|configured/i.test(error.message) ? 400 : 502;
            res.end(JSON.stringify({error:error.message || 'Voice generation failed'}));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localVoiceApi()],
  // Relative base so the built index.html works when served from a
  // GitHub Pages project path (https://<user>.github.io/linkedin/).
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // LinkedIn Lessons — the guided post generator, served at /lessons/
        lessons: fileURLToPath(new URL('./lessons/index.html', import.meta.url)),
        // Roast My LinkedIn — the inspection office, served at /roast/
        roast: fileURLToPath(new URL('./roast/index.html', import.meta.url)),
        // The Museum of Professional Communication, served at /museum/
        museum: fileURLToPath(new URL('./museum/index.html', import.meta.url)),
      },
    },
  },
});
