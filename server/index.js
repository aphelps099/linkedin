import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVoiceClips } from './voice-service.js';
import { createCheckoutSession, verifyStripeSignature, fulfilOrder, parseSkuMap } from './store-service.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');

app.disable('x-powered-by');

// The Stripe webhook must see the raw payload (its signature covers the exact
// bytes), so this route is registered ahead of the JSON body parser.
app.post('/api/store/webhook', express.raw({type:'application/json'}), async (req, res)=>{
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret){
    res.status(501).json({error:'The webhook is not configured'});
    return;
  }
  const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if(!verifyStripeSignature({payload, header:req.get('stripe-signature'), secret})){
    res.status(400).json({error:'Bad signature'});
    return;
  }
  const event = JSON.parse(payload);
  if(event.type === 'checkout.session.completed'){
    try{
      const result = await fulfilOrder({
        session:event.data.object,
        apiKey:process.env.PRINTIFY_API_KEY,
        shopId:process.env.PRINTIFY_SHOP_ID,
        skuMap:parseSkuMap(process.env.PRINTIFY_SKU_MAP),
      });
      console.log('store:', event.data.object.id, JSON.stringify(result));
    }catch(error){
      // a 5xx makes Stripe retry the event, so a Printify hiccup is not a lost order
      console.error('store: fulfilment failed —', error.message);
      res.status(502).json({error:'Fulfilment failed'});
      return;
    }
  }
  res.json({received:true});
});

app.use(express.json({limit:'32kb'}));

app.post('/api/checkout', async (req, res)=>{
  try{
    const session = await createCheckoutSession({
      cart:req.body?.cart,
      origin:req.get('origin') || process.env.STORE_PUBLIC_ORIGIN || 'https://linkedinbeats.com',
      secretKey:process.env.STRIPE_SECRET_KEY,
      apiBaseUrl:process.env.STRIPE_API_BASE || 'https://api.stripe.com',
      flatShippingCents:Number(process.env.STORE_FLAT_SHIPPING_CENTS || 500),
      shipCountries:(process.env.STORE_SHIP_COUNTRIES || 'US,CA,GB,AU').split(',').map(c=>c.trim()).filter(Boolean),
    });
    res.json({url:session.url, id:session.id});
  }catch(error){
    const message = error?.message || 'Checkout failed';
    const status = /required|configured|Unknown|range|size|exceeds/i.test(message) ? 400 : 502;
    res.status(status).json({error:message});
  }
});

app.post('/api/voice', async (req, res)=>{
  try{
    const clips = await generateVoiceClips({
      clips:req.body?.clips,
      lines:req.body?.lines,
      apiKey:process.env.OPENAI_API_KEY,
      apiBaseUrl:process.env.CUSTOM_CRED_API_OPENAI_COM_URL || 'https://api.openai.com',
      gatewayToken:process.env.CUSTOM_CRED_API_OPENAI_COM_TOKEN,
      elevenLabsApiKey:process.env.ELEVENLABS_API_KEY,
      elevenLabsBaseUrl:process.env.CUSTOM_CRED_API_ELEVENLABS_IO_URL || 'https://api.elevenlabs.io',
      elevenLabsGatewayToken:process.env.CUSTOM_CRED_API_ELEVENLABS_IO_TOKEN,
      elevenLabsVoiceId:process.env.ELEVENLABS_VOICE_ID,
    });
    res.json({clips, provider:'elevenlabs+openai'});
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
      (process.env.OPENAI_API_KEY || process.env.CUSTOM_CRED_API_OPENAI_COM_TOKEN) &&
      (process.env.ELEVENLABS_API_KEY || process.env.CUSTOM_CRED_API_ELEVENLABS_IO_TOKEN)
    ),
    checkoutConfigured:Boolean(process.env.STRIPE_SECRET_KEY),
    fulfilmentConfigured:Boolean(
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.PRINTIFY_API_KEY &&
      process.env.PRINTIFY_SHOP_ID
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
