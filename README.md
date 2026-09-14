# Hopits — Shopify D2C theme

A custom Shopify **Online Store 2.0** theme for [Hopits](https://www.hopits.com), a kids'
footwear brand selling direct to consumers in India.

Built from scratch — no Dawn fork, no page-builder app. Vanilla Liquid, CSS and JS,
with every merchandising decision exposed in the theme editor.

---

## Design language

Playful and bright: candy accents on a warm off-white ground, rounded geometry,
bouncy motion, and big friendly type — a kids' brand a parent still trusts with
₹2,000.

| Token | Default | Role |
| --- | --- | --- |
| `--hp-primary` | `#FF5F9E` | Bubblegum pink — buttons, links, highlights |
| `--hp-yellow` | `#FFC53D` | Sunshine — badges, squiggles, marquee |
| `--hp-teal` | `#2EC4B6` | Splash — "new" badges, accents |
| `--hp-grape` | `#7C5CFF` | Grape — focus rings, accents |
| `--hp-coral` | `#FF7A5A` | Coral — low-stock urgency |
| `--hp-ink` | `#16203A` | Text, footer, dark buttons |
| `--hp-surface` | `#FFF8F0` | Soft warm ground for alternating sections |

Everything above is a theme setting, so the palette, corner radii, shadow depth and
type scale can be retuned without touching code. Two presets ship in
`config/settings_data.json`: **Hopits Playful** (default) and **Hopits Calm**.

---

## What's built for this catalogue specifically

Hopits sells 170+ SKUs of kids' footwear in EU sizes 21–34, cut by age, gender and
category. The theme is shaped around that:

- **Size picker on the product card.** Sizing is the number one reason kids'
  footwear gets returned, so shoppers choose a size directly in the grid and add to
  cart without a page load. On multi-option products the row shows the sizes for the
  colour currently pictured.
- **Kids size finder.** Enter a foot length in cm and the theme recommends a size,
  adding 0.5 cm of growing room and highlighting the matching row in the chart. The
  chart is merchant-editable in *Theme settings → Kids size guide* (`SIZE | CM | AGE`,
  one row per line) and opens from any product page, the mobile menu, or the
  variant picker.
- **Shop by age.** Round bubble navigation mapped to the Age 1-5 / 3-9 / 9-13 and
  Toddlers collections, each labelled with its size range.
- **Colour swatches** mapped to the real option values in this catalogue — Sea Green,
  Lavender, Peach, Royal Blue, Cyan, Multicolor, White & Pink and friends — with a
  fallback to swatch images uploaded to Files as `<handle>.png`.
- **India D2C trust signals.** Free-shipping progress bar, COD messaging, 7-day size
  exchange, and a floating WhatsApp button for sizing questions.
- **Low-stock urgency** at a merchant-set threshold, driven by real inventory.

---

## Structure

```
assets/      base.css (design system), theme.js (cart, variants, search, size finder)
config/      settings_schema.json, settings_data.json + presets
layout/      theme.liquid, password.liquid
locales/     en.default.json, en.default.schema.json
sections/    35 sections incl. header/footer groups
snippets/    18 snippets (product card, size guide, facets, icons…)
templates/   19 JSON templates incl. customer account pages
```

### Notable sections

| Section | Purpose |
| --- | --- |
| `hero` | Multi-slide hero with eyebrow, dual CTAs and a trust-stats row |
| `usp-bar` | Four-up benefit strip (shipping, exchange, COD, materials) |
| `shop-by-age` | Age bubbles with size-range sublabels |
| `collection-tiles` | Category grid, 3/4/6 columns |
| `featured-collection` | Grid or horizontal scroller |
| `image-with-text` | Brand story with icon feature list |
| `marquee` | Scrolling brand-message strip |
| `testimonials`, `faq` | Social proof and objection handling (FAQ emits FAQPage schema) |
| `main-product` | Block-based PDP: gallery, variant picker, stock, buy, trust, collapsibles |
| `main-collection` | Faceted filtering and sorting without full page reloads |
| `cart-drawer` / `main-cart` | Slide-out or page cart, switchable in settings |

### JavaScript

One 900-line vanilla file, no dependencies. Progressive by design — forms post
normally and links navigate with JS disabled.

- Cart add/change via the AJAX API using the **Section Rendering API**, so a cart
  mutation is a single round trip
- Variant picker with cross-option availability greying and URL sync
- Quick add from the grid with a "pick a size" nudge instead of a silent default
- Predictive search, faceted filtering, focus-trapped drawers, accordions,
  slideshow, size finder, product recommendations

---

## Running it

```bash
npm install -g @shopify/cli@latest

shopify theme dev  --store hopits.myshopify.com   # local preview with hot reload
shopify theme check                               # lint (currently: 0 offenses)
shopify theme push --unpublished                  # upload as a draft theme
```

`shopify.theme.toml` defines `development` and `production` environments.

### Before going live

1. **Push unpublished and preview first.** `shopify theme push --unpublished` — the
   live theme is untouched until you publish from Online Store → Themes.
2. **Re-add app embeds.** The current live theme runs GoKwik/Fastrr checkout.
   App embeds and script tags do **not** carry over to a new theme — re-enable them
   under Theme settings → App embeds, and verify checkout end to end on the preview
   before publishing.
3. **Set theme settings**: logo, favicon, WhatsApp number, social links, and the
   free-shipping threshold (defaults to ₹999).
4. **Build the menus.** The header expects a `main-menu`; the mega menu is driven by
   a *Mega menu* block whose "top level menu item" matches a menu item exactly
   (e.g. `Shop`). Collection pages show sub-collection pills when a menu exists whose
   handle matches the collection handle.
5. **Check the size chart** against real Hopits lasts — the shipped chart is a
   standard EU kids' mapping and should be confirmed against actual measurements.
6. **Tag bestsellers** with `bestseller` to surface the badge on product cards.
