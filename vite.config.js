import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { generateVoiceClips } from './server/voice-service.js';
import { createCheckoutSession } from './server/store-service.js';

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
              clips:body.clips,
              lines:body.lines,
              apiKey:process.env.OPENAI_API_KEY,
              apiBaseUrl:process.env.CUSTOM_CRED_API_OPENAI_COM_URL
                || 'https://api.openai.com',
              gatewayToken,
              elevenLabsApiKey:process.env.ELEVENLABS_API_KEY,
              elevenLabsBaseUrl:process.env.CUSTOM_CRED_API_ELEVENLABS_IO_URL
                || 'https://api.elevenlabs.io',
              elevenLabsGatewayToken:process.env.CUSTOM_CRED_API_ELEVENLABS_IO_TOKEN,
              elevenLabsVoiceId:process.env.ELEVENLABS_VOICE_ID,
            });
            res.end(JSON.stringify({clips, provider:'elevenlabs+openai'}));
          }catch(error){
            res.statusCode = /required|array|configured/i.test(error.message) ? 400 : 502;
            res.end(JSON.stringify({error:error.message || 'Voice generation failed'}));
          }
        });
      });
    },
  };
}

function localCheckoutApi(){
  return {
    name: 'circle-back-local-checkout-api',
    configureServer(server){
      server.middlewares.use('/api/checkout', (req, res)=>{
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
            const session = await createCheckoutSession({
              cart:body.cart,
              origin:req.headers.origin || 'http://localhost:5173',
              secretKey:process.env.STRIPE_SECRET_KEY,
              apiBaseUrl:process.env.STRIPE_API_BASE || 'https://api.stripe.com',
              flatShippingCents:Number(process.env.STORE_FLAT_SHIPPING_CENTS || 500),
              shipCountries:(process.env.STORE_SHIP_COUNTRIES || 'US,CA,GB,AU').split(',').map(c=>c.trim()).filter(Boolean),
            });
            res.end(JSON.stringify({url:session.url, id:session.id}));
          }catch(error){
            const message = error.message || 'Checkout failed';
            res.statusCode = /required|configured|Unknown|range|size|exceeds/i.test(message) ? 400 : 502;
            res.end(JSON.stringify({error:message}));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localVoiceApi(), localCheckoutApi()],
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
        // The Company Store — Circle Back merchandise, served at /store/
        store: fileURLToPath(new URL('./store/index.html', import.meta.url)),
        // LinkedIn Beats — the umbrella-brand homepage (future home), served at /v2/
        v2: fileURLToPath(new URL('./v2/index.html', import.meta.url)),
      },
    },
  },
});
