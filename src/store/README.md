# Company Store

The storefront uses the homepage's approved record-label header and footer, TT Hoves for readable product names, GT America Mono for prices and quantities, and Anton for campaign headings.

The October 2026 layout takes its retail sequence from https://store.bethelmusic.com/: a wide campaign, a consistent product grid, and collection browsing. No reference-site imagery or branding is reused. The LinkedIn Beats campaign now uses the supplied `image(20261015-201915).png` photograph, encoded as `public/store/linkedin-beats-campaign.webp` without retouching. A wide desktop crop keeps the faces and embedded wordmark visible; mobile shows the complete image. The campaign runs edge to edge, without the repeated title, tagline or collection CTA underneath. It flows directly into the catalog filters. Warm ivory (#FBF6E8) connects the page, controls, dialogs and header. The catalog is neutral, with three columns on desktop and two on phones. The catalog now flows directly into the footer; the department tiles and radio band were removed.

Department filters group the existing catalog into Apparel, Hats and Desk supplies. Sorting supports featured order, name and both price directions. Unpriced preview products remain last in price sorts. The three preview designs retain their unavailable-to-order state; existing product prices and checkout behavior are unchanged.

The `/home-2/` product preview retains its matte-black setting, with larger image areas, quieter full product names and color captions that match the store.

Validation: production build, existing store service checks, and temporary DOM interaction checks covering filters, sorting, preview deep links, size selection, cart persistence/quantity/removal and checkout failure handling. The homepage interaction checks also pass after sharing its header. Browser visual QA is unavailable in the current managed session.


## First in line

A fixed cobalt circle in the lower left opens a native email dialog. It scales 5% on hover (except with reduced motion), can be dismissed for the current visit, and stays hidden while product/cart dialogs are open. Escape and backdrop clicks close the signup; keyboard focus returns to its trigger. The shared footer marks are now 64px wide, retaining the graphite shimmer.

`POST /api/newsletter` validates the email and explicit subscription consent, rejects cross-origin browser requests, uses a honeypot and limits each client to eight requests per 15 minutes. Successful signups are written atomically as private JSON records, deduplicated by a hash of the normalized email. Emails are never logged or returned by a public list endpoint. Missing/unwritable storage returns an error, never a signup success.

Production requires a persistent Railway volume mounted at `/data`, with `NEWSLETTER_DATA_DIR=/data/newsletter`. Files use mode 0600 and the directory uses 0700. The collection endpoint only saves opt-ins; it does not send mail. Before sending campaigns, export these consent records into the chosen email platform with unsubscribe handling. Authorized operators can read/export the records from the mounted volume using Railway SSH. No subscriber records belong in Git.

Run `npm run check:newsletter` for local HTTP/storage checks. The check uses a temporary directory and makes no external email calls. `GET /api/health` reports `newsletterConfigured` once the directory is writable.
