// Company Store checks — run with: node scripts/check-store.mjs
// 1. Catalog integrity: nine SKUs, four categories, sized shirts, honest prices.
// 2. Cart pricing is server-side: carts are priced from the catalog, never the client.
// 3. The ticker's promise: free shipping at $50, flat rate below it.
// 4. Webhook signatures verify, and tampered or stale payloads do not.
// 5. Printify orders map SKUs and sizes to variants; unmapped SKUs are refused.
import crypto from 'node:crypto';
import { CATEGORIES, PRODUCTS, bySku, fmt } from '../src/store/products.js';
import { normalizeCart, buildCheckoutParams, verifyStripeSignature, buildPrintifyOrder, FREE_SHIPPING_CENTS } from '../server/store-service.js';

let failures = 0;
const fail = msg => { failures++; console.error('FAIL ' + msg); };
const expectThrow = (fn, why) => { try{ fn(); fail(why); }catch{ /* correct */ } };

// --- catalog ---
if(PRODUCTS.length !== 9) fail(`expected 9 SKUs, found ${PRODUCTS.length}`);
if(new Set(PRODUCTS.map(p => p.sku)).size !== PRODUCTS.length) fail('duplicate SKUs');
const cats = new Set(PRODUCTS.map(p => p.cat));
if(cats.size !== 4 || [...cats].some(c => !CATEGORIES.includes(c))) fail('categories do not match the filter chips');
for(const p of PRODUCTS){
  if(!/^CS-\d{3}$/.test(p.sku)) fail(`malformed SKU: ${p.sku}`);
  if(!(p.price > 0) || Math.round(p.price * 100) !== p.price * 100) fail(`price is not whole cents: ${p.sku}`);
  if(p.cat === 'Shirts' && (!p.sizes || p.sizes.length !== 4)) fail(`shirt without S–XL sizes: ${p.sku}`);
  if(p.cat !== 'Shirts' && p.sizes) fail(`unexpected sizes on ${p.sku}`);
  if(!p.desc || !p.ph || !p.specs?.length) fail(`incomplete product copy: ${p.sku}`);
}
if(fmt(28) !== '$28.00') fail('price format is not $XX.XX');

// --- cart normalization (the server prices the cart, the client only names it) ---
const priced = normalizeCart([{ sku: 'CS-101', size: 'M', qty: 2, price: 0.01 }]);
if(priced[0].price !== bySku('CS-101').price) fail('client-supplied price was believed');
expectThrow(() => normalizeCart([]), 'empty cart accepted');
expectThrow(() => normalizeCart([{ sku: 'CS-999', qty: 1 }]), 'unknown SKU accepted');
expectThrow(() => normalizeCart([{ sku: 'CS-101', size: 'M', qty: 0 }]), 'zero quantity accepted');
expectThrow(() => normalizeCart([{ sku: 'CS-101', size: 'XXL', qty: 1 }]), 'unknown size accepted');
expectThrow(() => normalizeCart([{ sku: 'CS-101', qty: 1 }]), 'shirt without a size accepted');
if(normalizeCart([{ sku: 'CS-301', size: 'M', qty: 1 }])[0].size !== null) fail('size not stripped from an unsized product');

// --- checkout params ---
const origin = 'https://linkedinbeats.com';
const small = buildCheckoutParams(normalizeCart([{ sku: 'CS-302', qty: 1 }]), origin, { flatShippingCents: 500 });
if(small.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]') !== '500') fail('small order did not get the flat rate');
if(small.get('line_items[0][price_data][unit_amount]') !== '400') fail('sticker not priced at 400 cents');
if(small.get('success_url') !== origin + '/store/?order=filed') fail('success_url is off the form');
if(small.get('cancel_url') !== origin + '/store/?order=tabled') fail('cancel_url is off the form');

const big = buildCheckoutParams(normalizeCart([{ sku: 'CS-101', size: 'L', qty: 2 }]), origin, { flatShippingCents: 500 });
if(big.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]') !== '0') fail(`$56 order was not shipped free (threshold ${FREE_SHIPPING_CENTS})`);
if(!big.get('line_items[0][price_data][product_data][name]').includes('— L')) fail('size missing from the line item name');

const everything = normalizeCart(PRODUCTS.map(p => ({ sku: p.sku, size: p.sizes ? 'XL' : null, qty: 9 })));
const full = buildCheckoutParams(everything, origin, {});
const meta = full.get('metadata[cart]');
if(meta.length > 500) fail(`metadata cart overflows Stripe's 500-char limit (${meta.length})`);
if(JSON.parse(meta).length !== 9) fail('metadata cart does not round-trip');

// --- webhook signature ---
const secret = 'whsec_test';
const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
const t = 1_700_000_000;
const sign = (p, ts) => crypto.createHmac('sha256', secret).update(`${ts}.${p}`).digest('hex');
const header = `t=${t},v1=${sign(payload, t)}`;
if(!verifyStripeSignature({ payload, header, secret, now: t + 10 })) fail('valid signature rejected');
if(verifyStripeSignature({ payload: payload + ' ', header, secret, now: t + 10 })) fail('tampered payload accepted');
if(verifyStripeSignature({ payload, header, secret, now: t + 3600 })) fail('stale timestamp accepted');
if(verifyStripeSignature({ payload, header: `t=${t},v1=deadbeef`, secret, now: t + 10 })) fail('wrong signature accepted');

// --- Printify order building ---
const session = {
  id: 'cs_test_abcdefgh',
  metadata: { cart: JSON.stringify([['CS-101', 'M', 2], ['CS-301', null, 1]]) },
  customer_details: { name: 'Brenda Synergy', email: 'brenda@example.com', phone: '' },
  shipping_details: { name: 'Brenda Synergy', address: { line1: '1 Alignment Way', line2: '', city: 'Austin', state: 'TX', postal_code: '73301', country: 'US' } },
};
const skuMap = {
  'CS-101': { productId: 'p1', variants: { S: 11, M: 12, L: 13, XL: 14 } },
  'CS-301': { productId: 'p3', variantId: 31 },
};
const { order, unmapped } = buildPrintifyOrder({ session, skuMap });
if(unmapped.length) fail('mapped SKUs reported unmapped');
if(order.line_items[0].variant_id !== 12) fail('shirt size did not map to its variant');
if(order.line_items[1].variant_id !== 31) fail('unsized product did not map to its variant');
if(order.external_id !== session.id) fail('order not tied to the Stripe session');
if(order.address_to.first_name !== 'Brenda' || order.address_to.last_name !== 'Synergy') fail('name split failed');
if(order.address_to.zip !== '73301' || order.address_to.country !== 'US') fail('address mapping failed');
if(order.send_shipping_notification !== true) fail('shipping notification not requested');

const partial = buildPrintifyOrder({ session, skuMap: { 'CS-101': skuMap['CS-101'] } });
if(partial.order !== null || !partial.unmapped.includes('CS-301')) fail('unmapped SKU not refused');

if(failures){ console.error(`${failures} failure(s)`); process.exit(1); }
console.log('Company Store checks pass — the form is in order.');
