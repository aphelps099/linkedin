// Commerce for the Company Store (Form CS-1): Stripe Checkout takes payment,
// Printify prints and ships. The storefront never sees a credential and never
// quotes its own prices — carts arrive as {sku, size, qty} and are priced from
// the catalog here. Pure builders are exported for scripts/check-store.mjs;
// the fetch callers stay thin.
import crypto from 'node:crypto';
import { bySku } from '../src/store/products.js';

export const FREE_SHIPPING_CENTS = 5000; // the ticker's promise: free over $50

export function normalizeCart(raw){
  if(!Array.isArray(raw) || raw.length === 0) throw new Error('A cart is required');
  if(raw.length > 40) throw new Error('The order exceeds the form');
  return raw.map(line => {
    const p = bySku(line?.sku);
    if(!p) throw new Error(`Unknown SKU: ${String(line?.sku)}`);
    const qty = Number(line?.qty);
    if(!Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error(`Quantity out of range for ${p.sku}`);
    const size = p.sizes ? line?.size : null;
    if(p.sizes && !p.sizes.includes(size)) throw new Error(`A size is required for ${p.sku}`);
    return { sku: p.sku, name: p.name, price: p.price, size, qty };
  });
}

export function buildCheckoutParams(lines, origin, { flatShippingCents = 500, shipCountries = ['US'] } = {}){
  const subtotalCents = lines.reduce((t, l) => t + Math.round(l.price * 100) * l.qty, 0);
  const free = subtotalCents >= FREE_SHIPPING_CENTS;
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  lines.forEach((l, i) => {
    params.set(`line_items[${i}][quantity]`, String(l.qty));
    params.set(`line_items[${i}][price_data][currency]`, 'usd');
    params.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(l.price * 100)));
    params.set(`line_items[${i}][price_data][product_data][name]`, l.name + (l.size ? ` — ${l.size}` : ''));
    params.set(`line_items[${i}][price_data][product_data][description]`, `Form CS-1 · ${l.sku}`);
    params.set(`line_items[${i}][price_data][product_data][metadata][sku]`, l.sku);
  });
  shipCountries.forEach((c, i) =>
    params.set(`shipping_address_collection[allowed_countries][${i}]`, c));
  params.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  params.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', free ? '0' : String(flatShippingCents));
  params.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
  params.set('shipping_options[0][shipping_rate_data][display_name]', free ? 'Free shipping — order over $50' : 'Flat rate');
  params.set('success_url', origin + '/store/?order=filed');
  params.set('cancel_url', origin + '/store/?order=tabled');
  // compact [sku, size, qty] tuples keep the webhook's cart inside Stripe's
  // 500-character metadata value limit even with every SKU on the form
  params.set('metadata[cart]', JSON.stringify(lines.map(l => [l.sku, l.size, l.qty])));
  params.set('metadata[form]', 'CS-1');
  return params;
}

export async function createCheckoutSession({ cart, origin, secretKey,
  apiBaseUrl = 'https://api.stripe.com', flatShippingCents, shipCountries }){
  const lines = normalizeCart(cart);
  if(!secretKey) throw new Error('Checkout is not configured');
  const params = buildCheckoutParams(lines, origin, { flatShippingCents, shipCountries });
  const res = await fetch(`${apiBaseUrl}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(body?.error?.message || `Stripe refused the order (${res.status})`);
  return { id: body.id, url: body.url };
}

// --- Stripe webhook signature (t=…,v1=… header, HMAC-SHA256 of `${t}.${payload}`) ---
export function verifyStripeSignature({ payload, header, secret, toleranceSeconds = 300, now = Date.now() / 1000 }){
  if(!header || !secret) return false;
  const parts = header.split(',').map(p => p.split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if(!t || !sigs.length) return false;
  if(Math.abs(now - Number(t)) > toleranceSeconds) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return sigs.some(sig => {
    try{ return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)); }
    catch{ return false; }
  });
}

// --- Printify fulfilment ---
// skuMap comes from PRINTIFY_SKU_MAP (JSON), created once the nine products
// exist in the Printify shop:
//   { "CS-101": { "productId": "…", "variants": { "S": 1, "M": 2, "L": 3, "XL": 4 } },
//     "CS-301": { "productId": "…", "variantId": 5 } }
export function buildPrintifyOrder({ session, skuMap }){
  const tuples = JSON.parse(session?.metadata?.cart || '[]');
  if(!tuples.length) throw new Error('The session carries no cart');
  const unmapped = [];
  const line_items = tuples.map(([sku, size, qty]) => {
    const entry = skuMap?.[sku];
    const variantId = entry ? (entry.variants ? entry.variants[size] : entry.variantId) : null;
    if(!entry?.productId || !variantId){ unmapped.push(sku); return null; }
    return { product_id: entry.productId, variant_id: variantId, quantity: qty };
  });
  if(unmapped.length) return { order: null, unmapped };

  const shipping = session.collected_information?.shipping_details
    || session.shipping_details || session.customer_details || {};
  const addr = shipping.address || {};
  const name = (shipping.name || session.customer_details?.name || '').trim();
  const spaceAt = name.indexOf(' ');
  return {
    unmapped,
    order: {
      external_id: session.id,
      label: `CS-1 · ${session.id.slice(-8)}`,
      line_items,
      send_shipping_notification: true,
      address_to: {
        first_name: spaceAt > 0 ? name.slice(0, spaceAt) : name,
        last_name: spaceAt > 0 ? name.slice(spaceAt + 1) : '',
        email: session.customer_details?.email || '',
        phone: session.customer_details?.phone || '',
        country: addr.country || '',
        region: addr.state || '',
        address1: addr.line1 || '',
        address2: addr.line2 || '',
        city: addr.city || '',
        zip: addr.postal_code || '',
      },
    },
  };
}

export async function fulfilOrder({ session, apiKey, shopId, skuMap,
  apiBaseUrl = 'https://api.printify.com' }){
  if(!apiKey || !shopId) return { fulfilment: 'not configured' };
  if(!skuMap) return { fulfilment: 'skipped', reason: 'PRINTIFY_SKU_MAP is not set' };
  const { order, unmapped } = buildPrintifyOrder({ session, skuMap });
  if(!order) return { fulfilment: 'skipped', reason: `unmapped SKUs: ${unmapped.join(', ')}` };

  const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const created = await fetch(`${apiBaseUrl}/v1/shops/${shopId}/orders.json`, {
    method: 'POST', headers, body: JSON.stringify(order),
  });
  const body = await created.json().catch(() => ({}));
  if(!created.ok) throw new Error(body?.message || `Printify refused the order (${created.status})`);

  const production = await fetch(`${apiBaseUrl}/v1/shops/${shopId}/orders/${body.id}/send_to_production.json`, {
    method: 'POST', headers,
  });
  if(!production.ok) throw new Error(`Printify accepted the order but production failed (${production.status})`);
  return { fulfilment: 'submitted', printifyOrderId: body.id };
}

export function parseSkuMap(raw){
  if(!raw) return null;
  try{ return JSON.parse(raw); }
  catch{ throw new Error('PRINTIFY_SKU_MAP is not valid JSON'); }
}
