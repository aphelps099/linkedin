# Company Store

## Current storefront — October 21, 2026

The approved refresh preserves the existing five-model campaign and Ken Burns motion. The hero is inset and clipped to a 20px radius (16px on phones). The supplied Afterbeat SVG masters appear in the white navigation, over the hero in white, and beside the footer signup. Desktop retains a uniform three-column grid; phones use two columns with rounded white cards and clear gutters. Filters, product galleries, bag behavior, and preview-only purchase restrictions remain functional. The robot-towed bottom marquee and floating blue Be first in line signup are restored. The signup uses the existing newsletter endpoint and hides while product or bag dialogs are open. Store navigation is 88px tall on desktop and 80px on phones with larger logo and links.

The curated catalog contains ten existing items: Humbled to Announce, Serious, and Out of Office tees; Circle Back and Thought Leader caps; the Email mug; Paper Jam, Please Hold, and Feedback Loop posters; and the Office Essentials Sticker Pack. No new clothing items are included. The proposed Take This Offline tee and its generated asset were removed at the user’s direction. Existing Serious Tee and Thought Leader Cap prices are preserved. Homepage product features now use the retained Out of Office Tee.

Checks: production build, store service/catalog checks (including retirement and preview rejection), homepage audio checks, and newsletter service checks. Browser review covers the campaign, catalog, filters, product details, cart, and email dialog.

## Previous implementation notes

The storefront uses the homepage's approved record-label header and footer, TT Hoves for readable product names, GT America Mono for prices and quantities, and Anton for campaign headings.

The October 2026 layout takes its retail sequence from https://store.bethelmusic.com/: a wide campaign, a consistent product grid, and collection browsing. No reference-site imagery or branding is reused. The LinkedIn Beats campaign uses the supplied `599BFE4C-E083-45E3-9749-1991B9750AA1.jpeg` photograph, encoded as `public/store/linkedin-beats-store-campaign.webp` without retouching. The approved horizontal vector logo appears in white over the center of the people, with STORE below. Only the photograph moves: a 45-second, 8% Ken Burns zoom gently reverses, without a jump between cycles. A small pause/resume control is available in the lower right. Reduced-motion visitors see a static image with no motion control. The desktop image has a wide 16:9 crop; mobile uses a square crop centered at 54% to keep the group in view. The campaign runs edge to edge, without the repeated title, tagline or collection CTA underneath. It flows into a visible “Shop wears” heading on every screen, followed by the catalog filters. Mobile uses a centered heading and a collapsible Filter & sort row. The compact black navigation uses a smaller white wordmark, 68px desktop / 64px mobile height, and reduced vertical padding. Warm ivory (#FBF6E8) connects the catalog, controls and dialogs. Store interface text, including prices, metadata, cart details and footer fine print, uses TT Hoves instead of monospace. The catalog is neutral, with three columns on desktop and an edge-to-edge, two-column grid with single-pixel dividers and larger product names on phones. The catalog now flows directly into the footer; the department tiles and radio band were removed.

Department filters group the existing catalog into Apparel, Hats and Desk supplies. Sorting supports featured order, name and both price directions. Unpriced preview products remain last in price sorts. The three preview designs retain their unavailable-to-order state; existing product prices and checkout behavior are unchanged.

The homepage product preview retains its matte-black setting, with larger image areas, quieter full product names and color captions that match the store.

Validation: production build, existing store service checks, and temporary DOM interaction checks covering filters, sorting, preview deep links, size selection, cart persistence/quantity/removal and checkout failure handling. The homepage interaction checks also pass after sharing its header. Browser visual QA is unavailable in the current managed session.


## First in line

A fixed cobalt circle in the lower left opens a native email dialog. It scales 5% on hover (except with reduced motion), has no adjacent dismiss button, and stays hidden while product/cart dialogs are open. Escape and backdrop clicks close the signup; keyboard focus returns to its trigger. The shared footer marks are now 64px wide, retaining the graphite shimmer.

`POST /api/newsletter` validates the email and explicit subscription consent, rejects cross-origin browser requests, uses a honeypot and limits each client to eight requests per 15 minutes. Successful signups are written atomically as private JSON records, deduplicated by a hash of the normalized email. Emails are never logged or returned by a public list endpoint. Missing/unwritable storage returns an error, never a signup success.

Production requires a persistent Railway volume mounted at `/data`, with `NEWSLETTER_DATA_DIR=/data/newsletter`. Files use mode 0600 and the directory uses 0700. The collection endpoint only saves opt-ins; it does not send mail. Before sending campaigns, export these consent records into the chosen email platform with unsubscribe handling. Authorized operators can read/export the records from the mounted volume using Railway SSH. No subscriber records belong in Git.

Run `npm run check:newsletter` for local HTTP/storage checks. The check uses a temporary directory and makes no external email calls. `GET /api/health` reports `newsletterConfigured` once the directory is writable.

## Robot-towed store marquee

`StoreMarquee.jsx` places a narrow ivory sales strip with black text immediately before the shared footer, matching its background. TT Hoves phrases travel rightward behind a 24px-tall (34px-wide) office droid. Its simplified inline SVG preserves the dome, offset visor, silver panel and blue collar of `public/home-experiments/office-droid.svg`; a tiny cyan status light blinks slowly. Copy reads: “Dress for the job you post about. Shop the Circle Back collection. Take it offline.” No discount or product availability is implied.

The strip links back to the collection and moves keyboard focus to its heading. Three equal laps loop seamlessly at 36px/second; ResizeObserver maintains that pace after font/viewport changes. Animation stops offscreen, in hidden tabs, on hover or link focus. There is no visible pause button. Reduced motion displays a static “Shop the Circle Back collection” with the droid. The homepage marquee remains on hold.

## Original collection and product galleries — October 19, 2026

The catalog includes the approved Out of Office tee and hoodie, Strategic Synergy and Humbled to Announce tees, Paper Jam and Please Hold graphic tees, three original prints, and a four-design sticker kit. These ten additions are `previewOnly`, with no prices, sizes, manufacturing claims or checkout access. Existing SKU prices and orderability are retained. All generated garments and model shots are design previews, not photographs of manufactured stock.

`ProductGallery.jsx` adds labeled, keyboard-accessible view buttons to product dialogs. The two jargon tees and three caps pair an urban on-model concept with the garment mockup. The sticker kit has a four-design overview and individual views. Its overview is rendered from four separate transparent assets. Flat lays, prints and stickers under `public/store/new-collection/` are WebP encodings of the approved ImageGen outputs; composition is unchanged. The campaign hero, newsletter signup and Stripe/Printify adapters are unchanged.

Catalog cards lead with the garment view. Where an on-model view exists, fine-pointer hover or visible keyboard focus reveals it inside the same fixed image frame; touch users see the garment until opening details. The decorative hover layer is hidden from assistive technology, and reduced-motion preferences remove the fade and zoom. Product dialogs start with the on-model view and retain the garment thumbnail.

The public health endpoint on October 19 reported `checkoutConfigured: false` and `fulfilmentConfigured: false`. Publishing a design preview does not activate sales. Before enabling a SKU, create the actual supplier product and variants, confirm artwork placement with a physical sample, set its real price/specifications, and map it in `PRINTIFY_SKU_MAP`. Configure Stripe Checkout and its signed webhook, and verify a complete test order through production and tracking. Fulfilment failure/retry handling must be reviewed before accepting real payments.
