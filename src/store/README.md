# Company Store

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

`StoreMarquee.jsx` places a narrow navy sales strip immediately before the shared footer. TT Hoves phrases travel rightward behind a 24px-tall (34px-wide) office droid. Its simplified inline SVG preserves the dome, offset visor, silver panel and blue collar of `public/home-experiments/office-droid.svg`; a tiny cyan status light blinks slowly. Copy reads: “Dress for the job you post about. Shop the Circle Back collection. Take it offline.” No discount or product availability is implied.

The strip links back to the collection and moves keyboard focus to its heading. Three equal laps loop seamlessly at 36px/second; ResizeObserver maintains that pace after font/viewport changes. Animation stops offscreen, in hidden tabs, on hover or link focus, and through its separate pause control. Reduced motion displays a static “Shop the Circle Back collection” with the droid. The homepage marquee remains on hold.
