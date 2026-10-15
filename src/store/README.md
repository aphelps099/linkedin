# Company Store

The storefront uses the homepage's approved record-label header and footer, TT Hoves for readable product names, GT America Mono for prices and quantities, and Anton for campaign headings.

The October 2026 layout takes its retail sequence from https://store.bethelmusic.com/: a wide campaign, a consistent product grid, and collection browsing. No reference-site imagery or branding is reused. The LinkedIn Beats campaign uses the existing Out of Office crewneck artwork on cream beside a navy headline panel. The catalog is neutral, with four columns on desktop, three on intermediate widths and two on phones. A pair of department tiles and a compact radio link connect the store back to the rest of the site.

Department filters group the existing catalog into Apparel, Hats and Desk supplies. Sorting supports featured order, name and both price directions. Unpriced preview products remain last in price sorts. The three preview designs retain their unavailable-to-order state; existing product prices and checkout behavior are unchanged.

The `/home-2/` product preview retains its matte-black setting, with larger image areas, quieter full product names and color captions that match the store.

Validation: production build, existing store service checks, and temporary DOM interaction checks covering filters, sorting, department focus/scroll, preview deep links, size selection, cart persistence/quantity/removal and checkout failure handling. The homepage interaction checks also pass after sharing its header. Browser visual QA is unavailable in the current managed session.
