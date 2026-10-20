// The Company Store catalog — Form CS-1. Pure data, no imports: the storefront
// renders from it and the Express server prices checkout from it, so the client
// can never quote its own prices. Seed catalog from the design handoff; in
// production this becomes data driven from Printify (see README).
export const CATEGORIES = ['All', 'Sweatshirts', 'Hats', 'Mugs', 'Shirts', 'Stickers', 'Posters'];

// img is a filename under public/store/ (served beside the page at /store/);
// products without photography fall back to the placeholder slot (ph).
const collectionImage = (filename,label,options={}) => ({img:`new-collection/${filename}.webp`,label,...options});
const flatLay = filename => collectionImage(filename,'Garment design preview');
const model = (filename,alt,width=1024,height=1536) => collectionImage(filename,'On-model design preview',{kind:'model',alt,width,height});
const comingSoon = (sku,cat,name,filename,desc,specs,images) => ({
  sku,cat,name,price:null,sizes:null,img:`new-collection/${filename}.webp`,previewOnly:true,
  ph:`Design preview — ${name}`,desc,
  specs:[...specs,['Status','Design preview — not yet available']],
  ...(images?{images}:{}),
});
const FEATURED_ORDER = ['CS-108','CS-107','CS-203','CS-201','CS-202','CS-103','CS-104','CS-105','CS-106','CS-109','CS-110','CS-501','CS-403','CS-404','CS-405','CS-303','CS-101','CS-102'];

export const PRODUCTS = [
  { sku: 'CS-104', cat: 'Sweatshirts', name: 'Out of Office Crewneck', price: null, sizes: null, img: 'cs-104.webp', previewOnly: true,
    ph: 'Design preview — dusty pink crewneck',
    desc: 'Your status, permanently set. Dusty pink with a small Out of Office chest print and a cobalt full stop. A preview of the new collection; pricing and availability are not yet set.',
    specs: [['Design', 'Dusty pink crewneck'], ['Artwork', 'Black chest print with cobalt accent'], ['Status', 'Design preview — not yet available']] },
  { sku: 'CS-203', cat: 'Hats', name: 'Circle Back Cap', price: null, sizes: null, img: 'cs-203.webp', previewOnly: true,
    images: [model('model-circle-back-cap','Adult model wearing the cobalt Circle Back Cap outdoors — design preview'),collectionImage('circle-back-cap','Cap design preview')],
    ph: 'Design preview — cobalt Circle Back cap',
    desc: 'A gentle reminder with a very good brim. Cobalt blue, cream Circle Back lettering, and one directional suggestion. A preview of the new collection; pricing and availability are not yet set.',
    specs: [['Design', 'Cobalt six-panel cap'], ['Artwork', 'Cream lettering and arrow'], ['Status', 'Design preview — not yet available']] },
  { sku: 'CS-501', cat: 'Mugs', name: 'This Could Have Been an Email Mug', price: null, sizes: null, img: 'cs-501.webp', previewOnly: true,
    ph: 'Design preview — cream and cobalt mug',
    desc: 'For meetings that outlast your coffee. Cream with a cobalt rim and a message that should have been sent earlier. A preview of the new collection; pricing and availability are not yet set.',
    specs: [['Design', 'Cream mug with cobalt rim'], ['Artwork', 'This Could Have Been an Email'], ['Status', 'Design preview — not yet available']] },
  { sku: 'CS-101', cat: 'Shirts', name: 'The Circle Back Tee', price: 28, sizes: ['S', 'M', 'L', 'XL'], img: 'new-collection/circle-back-tee.webp', designPreview: true,
    ph: 'Design preview — cobalt Circle Back tee',
    desc: 'A directional suggestion. Cobalt blue with stacked cream Circle Back lettering and an up-right arrow.',
    specs: [['Design', 'Cobalt tee'], ['Artwork', 'Cream Circle Back lettering and arrow']] },
  { sku: 'CS-102', cat: 'Shirts', name: 'Per My Last Email Tee', price: 28, sizes: ['S', 'M', 'L', 'XL'], img: 'new-collection/per-my-last-email-tee.webp', designPreview: true,
    images: [{img:'cs-102.webp',label:'On-model design preview',kind:'model',alt:'Model wearing the cream Per My Last Email Tee — design preview',width:1024,height:1024},collectionImage('per-my-last-email-tee','Garment design preview')],
    ph: 'Drop mockup — tee, flat lay',
    desc: 'For people who have typed it, deleted it, and typed it again. Set in Helvetica across the chest.',
    specs: [['Stock', 'Heavyweight cotton'], ['Print', 'Screen, one colour'], ['Fit', 'Unisex, true to size']] },
  { sku: 'CS-103', cat: 'Shirts', name: 'The Serious Tee', price: 28, sizes: ['S', 'M', 'L', 'XL'],
    img: 'new-collection/serious-tee.webp',
    ph: 'Drop mockup — tee, flat lay',
    desc: 'Says SERIOUS. In Helvetica, obviously. Worn by people who are.',
    specs: [['Stock', 'Heavyweight cotton'], ['Print', 'Screen, one colour'], ['Fit', 'Unisex, true to size']] },
  { sku: 'CS-201', cat: 'Hats', name: 'Thought Leader Cap', price: 24, sizes: null,
    img: 'new-collection/thought-leader-cap.webp',
    images: [model('model-thought-leader-cap','Adult model wearing the cobalt Thought Leader Cap outdoors — design preview'),collectionImage('thought-leader-cap','Cap design preview')],
    ph: 'Drop mockup — cap, 3/4 view',
    desc: 'Unstructured six-panel in corporate blue. Says THOUGHT LEADER and declares nothing else.',
    specs: [['Body', 'Unstructured six-panel'], ['Embroidery', 'White, front'], ['Size', 'One size, adjustable']] },
  { sku: 'CS-202', cat: 'Hats', name: 'Take This Offline Cap', price: 24, sizes: null, img: 'cs-202.webp',
    designPreview: true,
    images: [model('model-take-this-offline-cap','Adult model wearing the washed black Take This Offline Cap outdoors — design preview',1254,1254),collectionImage('take-this-offline-cap','Cap design preview')],
    ph: 'Drop mockup — cap, 3/4 view',
    desc: 'The meeting-ender, embroidered in white on ink. Wearing it does not end meetings.',
    specs: [['Body', 'Unstructured six-panel'], ['Embroidery', 'White, front'], ['Size', 'One size, adjustable']] },
  comingSoon('CS-105','Sweatshirts','Out of Office Hoodie','out-of-office-hoodie',
    'Your status, permanently set. A dusty pink hoodie with a small Out of Office chest print and a cobalt full stop.',
    [['Design','Dusty pink pullover hoodie'],['Artwork','Black chest lettering with cobalt accent']]),
  comingSoon('CS-106','Shirts','Out of Office Tee','out-of-office-tee',
    'A quiet status update. Washed charcoal with a compact Out of Office chest print.',
    [['Design','Washed charcoal tee'],['Artwork','Cream chest lettering with cobalt accent']]),
  comingSoon('CS-107','Shirts','Humbled to Announce Tee','humbled-tee',
    'After months of building in public, leaning in and doubling down. Cream type on washed charcoal, with a small Agree? to close.',
    [['Design','Washed charcoal tee'],['Artwork','Cream announcement text with a cobalt Agree?']],
    [model('model-humbled','Adult model wearing the Humbled to Announce Tee on a city street — design preview'),flatLay('humbled-tee')]),
  comingSoon('CS-108','Shirts','Strategic Synergy Tee','jargon-tee',
    'Thought leadership. Extreme ownership. Strategic synergy. Scalable authenticity. Relentless value creation.',
    [['Design','Cream tee'],['Artwork','Five lines of corporate ambition in black and cobalt']],
    [model('model-jargon','Adult model wearing the cream Strategic Synergy Tee on a city street — design preview'),flatLay('jargon-tee')]),
  comingSoon('CS-109','Shirts','Paper Jam Tee','paper-jam-tee',
    'The printer has joined the band. A small front graphic and a poster-sized paper jam on the back.',
    [['Design','Bone tee'],['Artwork','Printer and flowing paper illustration, front and back']]),
  comingSoon('CS-110','Shirts','Please Hold Tee','please-hold-tee',
    'A familiar office soundtrack. A small phone graphic up front, with the handset and record artwork on the back.',
    [['Design','Charcoal tee'],['Artwork','Telephone and vinyl illustration, front and back']]),
  comingSoon('CS-403','Posters','Paper Jam Print','paper-jam-print',
    'One printer. An entirely new rhythm section. Cobalt profile sheets spill into a black-and-cream paper wave.',
    [['Artwork','Paper Jam'],['Palette','Black, cream and cobalt'],['Format','Final print size to come']]),
  comingSoon('CS-404','Posters','Please Hold Print','please-hold-print',
    'The hold music is the main event. An office handset and a spinning record, set against warm yellow.',
    [['Artwork','Please Hold'],['Palette','Yellow, black, cream and cobalt'],['Format','Final print size to come']]),
  comingSoon('CS-405','Posters','The Feedback Loop Print','feedback-loop-print',
    'A bass player, a speaker stack and a very productive inbox. An original LinkedIn Beats print in rust red and cream.',
    [['Artwork','The Feedback Loop'],['Palette','Rust red, black and cream'],['Format','Final print size to come']]),
  comingSoon('CS-303','Stickers','Office Essentials Sticker Kit','sticker-synergy',
    'Synergy on keys, an onboarding conversation taken offline, and two very different paper jams. Four designs from the LinkedIn Beats office.',
    [['Designs','Synergy; Onboarding Offline; Paper Jam; Paper Jam Session'],['Format','Final sizes and finish to come']],
    [{layout:'kit',label:'The four-design kit'},
      collectionImage('sticker-synergy','Synergy design preview'),
      collectionImage('sticker-onboarding-offline','Onboarding Offline design preview'),
      collectionImage('sticker-paper-jam','Paper Jam design preview'),
      collectionImage('sticker-paper-jam-session','Paper Jam Session design preview')]),
].sort((a,b)=>FEATURED_ORDER.indexOf(a.sku)-FEATURED_ORDER.indexOf(b.sku));

export const bySku = sku => PRODUCTS.find(p => p.sku === sku);
export const fmt = n => '$' + n.toFixed(2);
