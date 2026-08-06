# Handoff: The Company Store — Circle Back® Merchandise

## Overview
A single-page storefront for Circle Back® merchandise (Form CS-1): a filterable product grid, a slide-in product detail panel, and a slide-in order drawer. Nine SKUs across four categories (Shirts, Hats, Stickers, Posters). Fulfilment is **Printify** (print on demand) and payment is **Stripe** — see "Commerce integration" below.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing intended look and behavior, not production code to ship. Your task is to **recreate this design in your codebase's environment** (Next.js/React recommended if starting fresh, since both Printify and Stripe have first-class Node SDKs) using its established patterns. `CompanyStore.dc.html` is the canonical reference: its inline styles carry the exact values, and its logic class describes the exact state machine.

## Fidelity
**High-fidelity.** Recreate pixel-perfectly: every color, border weight, letter-spacing and size in the reference is intentional. The design follows the Circle Back Design System (tokens included in `tokens/`), whose core rules are non-negotiable:
- Border-radius **0 everywhere**. No shadows anywhere on this page. Depth is border weight only: 3px masthead/footer, 2px panel headers, 1.5px cards/buttons, 1px grid lines, 1px dotted list rows.
- Hover = invert to solid ink (`#111` bg, white text). Nothing dims, scales or lifts.
- Two fonts: Helvetica Neue (system stack) for everything; IBM Plex Mono (Google Fonts) for prices, readouts, SKUs, the banner, +/− controls. Never mono for prose.

## Screens / Views

### 1. Storefront grid (default view)
- Page: `#f6f5f1` background, 1120px max-width centered, padding 34px 44px 60px.
- **Masthead**: "Circle Back®" wordmark (22px/700/-.02em, superscript ® at 9px) left; right-aligned meta labels "Form CS-1 · Rev. 2026-08 · All sales final" (9.5px/700/.14em uppercase). 3px solid `#111` bottom border.
- **Ticker banner** (toggleable): full-width `#0a66c2` bar, white IBM Plex Mono 11px/.08em uppercase: "Free shipping over $50 · Printed on demand · Complaints processed locally ▮".
- **Hero**: kicker label (9.5px/700/.16em uppercase, blue) "The Circle Back® ecosystem · Merchandise division"; H1 "The Company Store" 64px/700/-.045em/line-height .94, **blue `#0a66c2`**; dek 13px/1.45, max-width 540px, with one bold blue sentence.
- **Filter row**: category chips (All, Shirts, Hats, Stickers, Posters) — 10px/700/.14em uppercase, 8px 14px padding, 1.5px border. Active: blue fill/white text. Inactive: white/ink, hover inverts to ink. Right side: "Order form · N" button in mono, opens drawer.
- **Product grid**: 3 columns, 1px gaps rendered as ink lines (grid background `#111`, 1.5px outer border, white cells). Each card:
  - Square (1:1) product image, object-fit cover, 1px hairline below. Products without photos show an image placeholder slot.
  - Info block (14px 16px padding): category · SKU label (9.5px/700/.16em uppercase, 45% opacity); product name 19px/700/-.02em beside a 44×44 "+" button (mono 24px, 1.5px ink border, hover fills blue); price in mono 13px pinned to bottom.
  - Whole info block is clickable → opens product detail; hover inverts block to ink/white.
  - Partial last row filled with paper-colored filler cells reading "Further SKUs pending" (mono 10px, muted).

### 2. Product detail panel (fixed right, 560px, max 92vw)
- White, 3px ink left border, z-index above drawer, scrolls internally, padding 22px 28px 30px.
- Header row: "Product detail · SKU" label + 30×30 "×" close button, 2px ink bottom border.
- Square product image (1.5px ink border), then: category·SKU label; product name 40px/700/-.045em/.98 **blue**; action row: "Add to the order" (blue fill, white, 11px/700/.14em uppercase, 13px 26px padding, hover → ink), qty stepper (32×32 mono − / +, count between), line total in mono 18px.
- Size selector (shirts only): "Size" label + 42px-wide S/M/L/XL buttons; selected = blue fill.
- Description paragraph 13.5px/1.55, max-width 420px.
- Stamp: "In stock — print on demand" — 2px blue border, blue text, 9.5px/700/.16em uppercase, rotated −4°.
- Spec table: dotted 1px rows, label (muted uppercase) left, value (mono 12px) right.

### 3. Order drawer (fixed right, 380px)
- White, 3px ink left border, flex column, padding 22px 24px.
- Header "Order form · CS-1" + × close, 2px border.
- Empty state: 2px dashed hairline box, "Awaiting merchandise" (mono, muted).
- Line items: dotted rows — name (13.5px/700) with meta line "SKU · size · Qty n" (mono 10px muted) left; line price (mono 12px) and × remove right.
- Footer: 1.5px top rule; "Subtotal" label vs mono 16px amount; fine print "Shipping calculated by the fulfilment partner. All sales final."; full-width "Submit the order" button (white/ink, hover inverts) → this is the **Stripe Checkout** trigger.
- Footer of page: 3px top rule, two muted labels ("Unlocking Synergistic Rhythms for Professional Communicators · Merchandise printed and shipped by a third party" / "Form CS-1 · Rev. 2026-08").

## Interactions & Behavior
- Category chip → filters grid (client-side).
- Card / "+" → opens detail panel for that SKU; resets qty to 1, default size = second size (M).
- "Add to the order" → merges into cart (same SKU+size increments qty), closes detail, opens drawer.
- "Order form · N" → opens drawer; × closes. Detail × returns to grid.
- Cart line × → removes line.
- "Submit the order" → create Stripe Checkout Session and redirect (see below).
- Motion: color/background transitions ≤ .08s. **No slide-in animations, no overlays/scrims** — panels simply appear. Keep it that mechanical.
- Copy voice: deadpan institutional. Buttons use institutional verbs ("Add to the order", "Submit the order" — never "Buy now"). No emoji, no exclamation marks.

## State Management
```
filter: 'All' | 'Shirts' | 'Hats' | 'Stickers' | 'Posters'
view:   'grid' | 'detail'      sel: sku | null
size:   string | null          qty: number (min 1)
cart:   [{ sku, name, price, size, qty }]
drawer: boolean
```
Cart should persist (localStorage) in production. Prices formatted as `$XX.XX`.

## Commerce integration (Printify + Stripe)
The prototype's product array is the seed catalog; in production it becomes data driven:
1. **Catalog**: create the 9 products in Printify (blueprints: unisex heavyweight tee, unstructured six-panel cap, kiss-cut sticker/sheet, matte poster 18×24). Map each local SKU (CS-101…CS-402) to `{ printifyProductId, variantId per size }`. Serve the catalog from your backend (or a static JSON built from the Printify API) so titles/prices stay in sync.
2. **Checkout**: "Submit the order" → POST cart to your backend → create a **Stripe Checkout Session** (line items from the cart, shipping address collection enabled, shipping rates from Printify's shipping API or flat rates). Redirect to Stripe.
3. **Fulfilment**: on `checkout.session.completed` webhook, create a Printify order via API (`line_items` = mapped variant ids + quantities, `address_to` from the Stripe session, `send_shipping_notification: true`) and submit it to production.
4. **Free shipping over $50** (the ticker's promise): implement as a $0 Stripe shipping rate conditional on subtotal ≥ $50.
5. Success/cancel pages should stay in voice: e.g. "ORDER FILED — CS-1" / "The order was tabled."
6. Keep secrets server-side; the storefront itself needs no Printify credentials.

## Design Tokens
Colors: `--paper #f6f5f1` · `--white #fff` · `--ink #111` · `--ink-40 #11111166` · `--hair #11111122` · `--blue #0a66c2` · `--blue-light #9fc8ea` · `--blue-dark #084d92`. No greys, no gradients, no green/red semantics.
Type: Helvetica Neue stack + IBM Plex Mono (Google Fonts). Steps used: 64 (H1), 40 (detail title), 22 (wordmark), 19 (card title), 13.5/13 (body/dek), 11–13 mono data, 9.5/700/.14–.16em uppercase labels.
Borders: 3 / 2 / 1.5 / 1 / 1px-dotted ladder. Radius: 0. Shadows: none.
Layout: 1120px measure; 34/44px page padding; 3-col grid, 1px ink gaps; panels 560px (detail) / 380px (drawer).

## Assets
- `uploads/` — three product photos (Per My Last Email Tee CS-102, The Circle Back Tee CS-101, Take This Offline Cap CS-202), AI-generated model shots, 1024×1024. Remaining six SKUs need photography or Printify mockups.
- `tokens/` — the design system token CSS, value-for-value.
- No icons anywhere: glyphs are typed characters (× · ▮ + −) only.

## Files
- `CompanyStore.dc.html` — the full prototype: template (markup + exact inline styles) and logic class (state machine + product data). Read both.
- `tokens/*.css` — colors, typography, spacing, effects, fonts, base reset.
- `uploads/*.png` — product photos.
