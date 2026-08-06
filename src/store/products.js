// The Company Store catalog — Form CS-1. Pure data, no imports: the storefront
// renders from it and the Express server prices checkout from it, so the client
// can never quote its own prices. Seed catalog from the design handoff; in
// production this becomes data driven from Printify (see README).
export const CATEGORIES = ['All', 'Shirts', 'Hats', 'Stickers', 'Posters'];

// img is a filename under public/store/ (served beside the page at /store/);
// products without photography fall back to the placeholder slot (ph).
export const PRODUCTS = [
  { sku: 'CS-101', cat: 'Shirts', name: 'The Circle Back Tee', price: 28, sizes: ['S', 'M', 'L', 'XL'], img: 'cs-101.webp',
    ph: 'Drop mockup — tee, flat lay',
    desc: 'Heavyweight cotton. The wordmark, front left chest, one colour. That is the entire design.',
    specs: [['Stock', 'Heavyweight cotton'], ['Print', 'Screen, one colour'], ['Fit', 'Unisex, true to size']] },
  { sku: 'CS-102', cat: 'Shirts', name: 'Per My Last Email Tee', price: 28, sizes: ['S', 'M', 'L', 'XL'], img: 'cs-102.webp',
    ph: 'Drop mockup — tee, flat lay',
    desc: 'For people who have typed it, deleted it, and typed it again. Set in Helvetica across the chest.',
    specs: [['Stock', 'Heavyweight cotton'], ['Print', 'Screen, one colour'], ['Fit', 'Unisex, true to size']] },
  { sku: 'CS-103', cat: 'Shirts', name: 'The Serious Tee', price: 28, sizes: ['S', 'M', 'L', 'XL'],
    ph: 'Drop mockup — tee, flat lay',
    desc: 'Says SERIOUS. In Helvetica, obviously. Worn by people who are.',
    specs: [['Stock', 'Heavyweight cotton'], ['Print', 'Screen, one colour'], ['Fit', 'Unisex, true to size']] },
  { sku: 'CS-201', cat: 'Hats', name: 'Thought Leader Cap', price: 24, sizes: null,
    ph: 'Drop mockup — cap, 3/4 view',
    desc: 'Unstructured six-panel in corporate blue. Says THOUGHT LEADER and declares nothing else.',
    specs: [['Body', 'Unstructured six-panel'], ['Embroidery', 'White, front'], ['Size', 'One size, adjustable']] },
  { sku: 'CS-202', cat: 'Hats', name: 'Take This Offline Cap', price: 24, sizes: null, img: 'cs-202.webp',
    ph: 'Drop mockup — cap, 3/4 view',
    desc: 'The meeting-ender, embroidered in white on ink. Wearing it does not end meetings.',
    specs: [['Body', 'Unstructured six-panel'], ['Embroidery', 'White, front'], ['Size', 'One size, adjustable']] },
  { sku: 'CS-301', cat: 'Stickers', name: 'Glyph Set Sticker Sheet', price: 6, sizes: null,
    ph: 'Drop mockup — sheet, straight on',
    desc: 'Nine glyphs from the official set, die-cut. The block cursor is the popular one.',
    specs: [['Material', 'Matte vinyl, die-cut'], ['Sheet', '4 × 6 in, 9 stickers'], ['Finish', 'Laptop-grade']] },
  { sku: 'CS-302', cat: 'Stickers', name: 'Approved — HR Sticker', price: 4, sizes: null,
    ph: 'Drop mockup — sticker, straight on',
    desc: 'The rubber stamp, for laptops and water bottles. Confers no actual approval.',
    specs: [['Material', 'Matte vinyl, die-cut'], ['Size', '3 in wide'], ['Angle', 'Pre-tilted, −4°']] },
  { sku: 'CS-401', cat: 'Posters', name: 'The Tagline Poster', price: 18, sizes: null,
    ph: 'Drop mockup — poster in frame',
    desc: '“It’s not an instrument. It’s a journey.” At 104 points, in corporate blue, on paper.',
    specs: [['Size', '18 × 24 in'], ['Stock', 'Matte, 200 gsm'], ['Ships', 'Rolled, in a tube']] },
  { sku: 'CS-402', cat: 'Posters', name: 'Museum Admission Poster', price: 18, sizes: null,
    ph: 'Drop mockup — poster in frame',
    desc: 'Wing I of the Museum of Professional Communication. Admission free; the poster is not.',
    specs: [['Size', '18 × 24 in'], ['Stock', 'Matte, 200 gsm'], ['Ships', 'Rolled, in a tube']] },
];

export const bySku = sku => PRODUCTS.find(p => p.sku === sku);
export const fmt = n => '$' + n.toFixed(2);
